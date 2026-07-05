/**
 * 订单服务 — 核心业务逻辑
 *
 * 流程：
 *   创建订单 → 计价 → 锁库存 → 写MySQL → 微信预下单 → 返回支付参数
 *   支付回调 → 验签解密 → 幂等校验 → 确认库存 → 更新状态
 */
const db = require('../config/db');
const { redis } = require('../config/db');
const config = require('../config');
const { calculatePrice } = require('./pricing.service');
const stockService = require('./stock.service');
const wxpay = require('../utils/wxpay');
const { generateOrderNo } = require('../utils/idGenerator');
const logger = require('../utils/logger');

// ========== 创建订单 ==========

/**
 * 创建订单 + 锁库存 + 微信预下单
 * @param {object} params
 * @param {string} params.openid - 用户 openid
 * @param {Array} params.items - 商品列表
 * @param {string} params.type - delivery | pickup
 * @param {object} params.deliveryAddress - 收货地址
 * @param {boolean} params.isScheduled - 是否预约
 * @param {string} params.scheduledDate
 * @param {string} params.scheduledTime
 */
async function createOrder({ openid, items, type, deliveryAddress, isScheduled, scheduledDate, scheduledTime }) {
  // 1. 服务端计价
  const { totalFen, validatedItems } = await calculatePrice(items);

  // 2. 生成订单号
  const orderNo = await generateOrderNo();

  // 3. 锁定库存（Redis Lua 原子操作）
  // P0 阶段：每个商品一个库存锁，batch_no 默认 'default'
  for (const item of validatedItems) {
    const result = await stockService.lockStock(item.productId, 'default', item.quantity);
    if (!result.success) {
      // 回滚已锁定的库存
      for (const locked of validatedItems) {
        if (locked.productId === item.productId) break;
        await stockService.releaseStock(locked.productId, 'default', locked.quantity);
      }
      throw new Error(result.message || '库存不足');
    }
  }

  // 4. 写入 MySQL 事务（order_info + order_item + stock_lock_record + payment_record）
  const expireMinutes = config.business.payTimeoutMinute;
  const expireTime = new Date(Date.now() + expireMinutes * 60 * 1000);

  await db.transaction(async (conn) => {
    // 订单主表
    await conn.execute(
      `INSERT INTO order_info
       (order_no, user_id, type, order_status, status_label, items,
        total_amount, pay_amount, expire_time, is_scheduled, scheduled_date, scheduled_time,
        delivery_address)
       VALUES (?, ?, ?, 0, 'pending', ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        orderNo, openid, type,
        JSON.stringify(validatedItems),
        totalFen, totalFen,
        expireTime,
        isScheduled ? 1 : 0,
        scheduledDate || '',
        scheduledTime || '',
        deliveryAddress ? JSON.stringify(deliveryAddress) : null,
      ]
    );

    // 库存锁定记录
    for (const item of validatedItems) {
      await conn.execute(
        `INSERT INTO stock_lock_record
         (order_no, goods_id, batch_no, lock_num, lock_status, expire_time)
         VALUES (?, ?, 'default', ?, 1, ?)`,
        [orderNo, item.productId, item.quantity, expireTime]
      );
    }

    // 支付流水记录（待支付）
    // 注：此时还没有 prepay_id，prepay_id 在预下单后更新
  });

  // 5. 微信支付 V3 JSAPI 预下单
  const notifyUrl = config.notify.pay;
  const payResult = await wxpay.jsapiPrepay({
    appid: config.wx.appId,
    out_trade_no: orderNo,
    total: totalFen,
    openid,
    description: '小鲜鸡-新鲜生鲜',
    notify_url: notifyUrl,
  });

  if (!payResult.success) {
    // 预下单失败，但订单已创建保留为 pending
    logger.error(`[order] 预下单失败: ${orderNo}`, payResult.error);
    return {
      orderNo,
      payment: null,
      payError: payResult.error,
    };
  }

  // 6. 生成 wx.requestPayment 参数（二次签名）
  const payment = wxpay.buildPayParams(payResult.prepay_id, config.wx.appId);

  // 7. 更新 payment_record 的 prepay_id
  await db.execute(
    'INSERT INTO payment_record (order_no, prepay_id, pay_amount, pay_status, pay_type) VALUES (?, ?, ?, 0, 1)',
    [orderNo, payResult.prepay_id, totalFen]
  );

  // 8. 加入 Redis 延时队列（超时关单用）
  const timeoutScore = Date.now() + expireMinutes * 60 * 1000;
  await redis.zadd('order:timeout:queue', timeoutScore, orderNo);

  logger.info(`[order] 订单创建成功: ${orderNo}, 金额: ${totalFen}分`);

  return {
    orderId: orderNo,
    orderNo,
    payment,
  };
}

// ========== 查询订单 ==========

/**
 * 用户订单列表
 */
async function getUserOrders(openid, { status, pageSize = 20 } = {}) {
  let sql = 'SELECT * FROM order_info WHERE user_id = ? AND is_deleted = 0';
  const params = [openid];

  if (status) {
    const statuses = status.split(',');
    sql += ` AND status_label IN (${statuses.map(() => '?').join(',')})`;
    params.push(...statuses);
  }

  sql += ' ORDER BY create_time DESC LIMIT ?';
  params.push(parseInt(pageSize, 10));

  return db.query(sql, params);
}

/**
 * 订单详情
 */
async function getOrderByNo(orderNo) {
  const order = await db.queryOne('SELECT * FROM order_info WHERE order_no = ?', [orderNo]);
  if (!order) return null;

  // 关联查询支付流水
  const payment = await db.queryOne(
    'SELECT * FROM payment_record WHERE order_no = ? ORDER BY id DESC LIMIT 1',
    [orderNo]
  );
  order.paymentRecord = payment || null;
  return order;
}

/**
 * 查询订单支付状态（前端轮询用）
 */
async function getPayStatus(orderNo) {
  const order = await db.queryOne(
    'SELECT order_no, order_status, pay_amount, pay_time FROM order_info WHERE order_no = ?',
    [orderNo]
  );
  if (!order) throw new Error('订单不存在');
  return order;
}

// ========== 取消订单 ==========

/**
 * 取消订单（用户主动取消）
 */
async function cancelOrder(orderNo, openid) {
  const order = await db.queryOne('SELECT * FROM order_info WHERE order_no = ?', [orderNo]);
  if (!order) throw new Error('订单不存在');
  if (order.user_id !== openid) throw new Error('无权操作此订单');

  // 状态校验
  const cancelable = ['pending'];
  if (!cancelable.includes(order.status_label)) {
    throw new Error('当前订单状态不可取消');
  }

  // 未支付：直接取消 + 释放库存
  if (order.order_status === 0 && order.prepay_id) {
    // 尝试关闭微信预支付单（best effort）
    await wxpay.closeOrder(orderNo);
  }

  // 释放库存
  const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
  for (const item of items) {
    await stockService.releaseStock(item.productId, 'default', item.quantity);
  }

  // 更新订单状态
  await db.execute(
    `UPDATE order_info SET order_status = 2, status_label = 'cancelled',
     cancel_time = NOW(), cancel_reason = '用户主动取消' WHERE order_no = ?`,
    [orderNo]
  );

  // 更新库存记录
  await db.execute(
    "UPDATE stock_lock_record SET lock_status = 3 WHERE order_no = ?",
    [orderNo]
  );

  // 从延时队列移除
  await redis.zrem('order:timeout:queue', orderNo);

  logger.info(`[order] 订单已取消: ${orderNo}`);
  return { orderNo, message: '订单已取消' };
}

module.exports = {
  createOrder,
  getUserOrders,
  getOrderByNo,
  getPayStatus,
  cancelOrder,
};
