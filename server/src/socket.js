/**
 * Socket.IO 实时推送服务
 *
 * 用途：用户支付成功后，服务端主动推送新订单到所有已连接的商家客户端，
 *       商家端无需刷新页面即可看到新订单。
 *
 * 鉴权：握手时验证 JWT token，仅允许 source='merchant' 的账号连接。
 * 认证逻辑复用 auth.js 的 verifyToken 模式（解析 JWT + 黑名单检查）。
 */

const jwt = require("jsonwebtoken");
const config = require("./config");
const { isTokenBlacklisted } = require("./utils/tokenBlacklist");
const logger = require("./utils/logger");

let io = null;

// ========== 鉴权中间件（Socket.IO 握手阶段） ==========

/**
 * 验证 Socket 连接的 JWT token
 * 逻辑与 middleware/auth.js verifyToken 一致，适配 Socket.IO middleware 签名
 */
async function authMiddleware(socket, next) {
  const token = socket.handshake.auth.token;

  if (!token) {
    return next(new Error("未提供认证令牌"));
  }

  try {
    const decoded = jwt.verify(token, config.jwt.accessSecret);

    // 只允许商家端账号连接（source === 'merchant'）
    if (decoded.source !== "merchant") {
      return next(new Error("仅商家端账号可连接"));
    }

    // Token 黑名单检查（Redis 故障时放行，与 HTTP 中间件策略一致）
    if (decoded.jti) {
      try {
        const blacklisted = await isTokenBlacklisted(decoded.jti);
        if (blacklisted) {
          return next(new Error("令牌已失效，请重新登录"));
        }
      } catch (_) {
        /* Redis 故障放行 */
      }
    }

    // 鉴权通过，附加用户信息到 socket 实例
    socket.user = {
      id: decoded.id,
      openid: decoded.openid,
      role: decoded.role || "staff",
      username: decoded.username || "",
      displayName: decoded.displayName || "",
      source: decoded.source,
    };

    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return next(new Error("令牌已过期"));
    }
    logger.error("[socket] JWT 验证失败:", err.message);
    next(new Error("无效的认证令牌"));
  }
}

// ========== 初始化 Socket.IO ==========

/**
 * 将 Socket.IO 绑定到 HTTP Server
 * @param {http.Server} httpServer
 * @returns {SocketIO.Server}
 */
function initSocket(httpServer) {
  const { Server } = require("socket.io");

  io = new Server(httpServer, {
    path: "/ws",                                        // WebSocket 路径（Nginx 需对此路径做升级代理）
    cors: { origin: "*", methods: ["GET", "POST"] },    // 允许跨域（商家端可能不同端口）
    pingInterval: 25000,                                // 每 25s 发心跳
    pingTimeout: 20000,                                 // 20s 无心跳即断线
    connectTimeout: 10000,                              // 握手超时
  });

  // 鉴权中间件
  io.use(authMiddleware);

  // 连接事件
  io.on("connection", (socket) => {
    logger.info(`[socket] 商家连接: ${socket.user.displayName} (${socket.user.role})`);

    // 加入商家群组（所有商家端在同一个房间接收新订单推送）
    socket.join("merchants");

    socket.on("disconnect", (reason) => {
      logger.info(`[socket] 商家断开: ${socket.user.displayName}, 原因: ${reason}`);
    });
  });

  logger.info("[socket] Socket.IO 已就绪，路径: /ws");
  return io;
}

// ========== 获取 io 实例 ==========

function getIo() {
  return io;
}

// ========== 推送新支付订单 ==========

/**
 * 订单支付成功后调用，广播新订单到所有商家客户端
 * @param {string} orderNo - 订单号
 */
async function emitNewPaidOrder(orderNo) {
  if (!io) {
    logger.warn("[socket] 推送跳过：Socket.IO 未初始化");
    return;
  }

  try {
    const db = require("./config/db");
    const order = await db.queryOne(
      `SELECT order_no, type, pay_amount, create_time, items
       FROM order_info WHERE order_no = ?`,
      [orderNo]
    );

    if (!order) {
      logger.warn(`[socket] 推送跳过：订单不存在 ${orderNo}`);
      return;
    }

    // 解析商品数量
    const items = typeof order.items === "string"
      ? JSON.parse(order.items)
      : (order.items || []);
    const itemCount = items.reduce((sum, i) => sum + (i.quantity || 1), 0);

    const payload = {
      orderNo: order.order_no,
      type: order.type,
      payAmount: order.pay_amount,
      itemCount,
      createTime: order.create_time,
      timestamp: Date.now(),
    };

    io.to("merchants").emit("order:new-paid", payload);
    logger.info(`[socket] ✅ 推送新订单: ${orderNo} (${itemCount}件, ¥${(order.pay_amount / 100).toFixed(2)})`);
  } catch (err) {
    logger.error(`[socket] 推送失败: ${orderNo}`, err.message);
  }
}

module.exports = { initSocket, getIo, emitNewPaidOrder };
