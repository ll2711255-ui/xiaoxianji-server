/**
 * WebSocket 服务 — Socket.IO
 *
 * 事件：
 *   order:new        — 新订单通知 (server → 管理后台/收银)
 *   order:paid       — 支付成功通知
 *   rider:location   — 骑手位置推送 (server → 小程序)
 *   queue:call       — 叫号推送
 *   stock:alert      — 库存告警
 *
 * 频道：
 *   admin:  管理后台
 *   cashier:收银端
 *   order:{orderNo}: 小程序端（按订单号订阅骑手位置）
 */
import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';

let io: Server;

export function initWebSocket(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  io.on('connection', (socket: Socket) => {
    console.log(`[ws] 客户端连接: ${socket.id}`);

    // 加入房间
    socket.on('join', (room: string) => {
      socket.join(room);
      console.log(`[ws] ${socket.id} 加入房间: ${room}`);
    });

    socket.on('leave', (room: string) => {
      socket.leave(room);
    });

    // 骑手位置上报
    socket.on('rider:location', (data: { orderNo: string; latitude: number; longitude: number }) => {
      io.to(`order:${data.orderNo}`).emit('rider:location', {
        latitude: data.latitude,
        longitude: data.longitude,
        timestamp: Date.now(),
      });
    });

    socket.on('disconnect', () => {
      console.log(`[ws] 客户端断开: ${socket.id}`);
    });
  });

  console.log('[ws] WebSocket 服务已启动');
  return io;
}

/** 获取 io 实例（在其他模块中发送事件） */
export function getIO(): Server {
  if (!io) {
    throw new Error('WebSocket 未初始化');
  }
  return io;
}

// ---------- 事件发送工具函数 ----------

/** 新订单通知 */
export function notifyNewOrder(orderNo: string, type: string, amount: number): void {
  if (!io) return;
  io.to('admin').to('cashier').emit('order:new', {
    orderNo,
    type,
    amount,
    timestamp: Date.now(),
  });
}

/** 支付成功通知 */
export function notifyOrderPaid(orderNo: string): void {
  if (!io) return;
  io.to('admin').emit('order:paid', { orderNo, timestamp: Date.now() });
}

/** 库存告警 */
export function notifyStockAlert(productName: string, stock: number): void {
  if (!io) return;
  io.to('admin').emit('stock:alert', { productName, stock, timestamp: Date.now() });
}

/** 叫号 */
export function notifyQueueCall(orderNo: string, number: number): void {
  if (!io) return;
  io.to('cashier').emit('queue:call', { orderNo, number, timestamp: Date.now() });
}
