/**
 * 超时关单定时任务（每分钟执行）
 *
 * 流程：
 *   1. 从 Redis 延时队列 ZRANGEBYSCORE 获取到期订单
 *   2. MySQL 二次确认状态仍为 pending
 *   3. 调用统一 cancelOrder() 入口（cancelBy='system'）
 *
 * 注意：取消逻辑统一走 order-cancel.service.js，
 *       不再内联关单/释放库存/更新订单等操作。
 */
const db = require('../config/db');
const { redis } = require('../config/db');
const { cancelOrder } = require('../services/order-cancel.service');
const logger = require('../utils/logger');

async function timeoutClose() {
  try {
    const now = Date.now();

    // 1. 从 Redis 延时队列获取到期订单（score <= 当前时间戳）
    const expiredOrders = await redis.zrangebyscore('order:timeout:queue', 0, now);

    if (!expiredOrders || expiredOrders.length === 0) return;

    logger.info(`[timeoutClose] 发现 ${expiredOrders.length} 笔到期订单`);

    for (const orderNo of expiredOrders) {
      try {
        // 2. MySQL 二次确认：只取消 pending 状态的订单
        const order = await db.queryOne(
          'SELECT order_no, status_label FROM order_info WHERE order_no = ?',
          [orderNo]
        );

        if (!order) {
          // 订单不存在，从队列移除
          await redis.zrem('order:timeout:queue', orderNo);
          continue;
        }

        if (order.status !== 'pending') {
          // 订单已被支付/取消，从队列移除
          await redis.zrem('order:timeout:queue', orderNo);
          logger.info(`[timeoutClose] 订单已处理，跳过: ${orderNo} (${order.status})`);
          continue;
        }

        // 3. 调用统一取消入口
        await cancelOrder({
          orderNo,
          cancelBy: 'system',
          cancelReason: '超时未支付自动取消',
          operatorId: 0,
        });

        logger.info(`[timeoutClose] ✅ 超时关单: ${orderNo}`);
      } catch (err) {
        // 状态已变更（已支付/已被其他方式取消）的订单跳过
        if (err.status === 409 || err.status === 403) {
          logger.info(`[timeoutClose] 订单状态已变更，跳过: ${orderNo} (${err.message})`);
          await redis.zrem('order:timeout:queue', orderNo);
        } else if (err.status === 404) {
          // 订单不存在，从队列移除
          await redis.zrem('order:timeout:queue', orderNo);
        } else {
          logger.error(`[timeoutClose] 自动取消失败 ${orderNo}:`, err.message);
        }
      }
    }
  } catch (err) {
    logger.error('[timeoutClose] 任务异常:', err.message);
  }
}

module.exports = timeoutClose;
