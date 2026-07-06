/**
 * 超时关单定时任务（每分钟执行）
 *
 * 流程：
 *   1. ZRANGEBYSCORE 获取过期订单
 *   2. 检查 MySQL 状态仍为待支付
 *   3. 调用微信关单 API
 *   4. Redis Lua 释放库存
 *   5. 更新订单状态 → 已取消
 *   6. 释放号码牌
 */
const db = require('../config/db');
const { redis } = require('../config/db');
const wxpay = require('../utils/wxpay');
const stockService = require('../services/stock.service');
const logger = require('../utils/logger');

async function timeoutClose() {
  try {
    const now = Date.now();

    // 1. 从 Redis 延时队列获取到期订单（score <= 当前时间戳）
    const expiredOrders = await redis.zrangebyscore('order:timeout:queue', 0, now);

    if (expiredOrders.length === 0) return;

    logger.info(`[timeoutClose] 发现 ${expiredOrders.length} 笔到期订单`);

    for (const orderNo of expiredOrders) {
      try {
        // 2. 检查 MySQL 状态
        const order = await db.queryOne(
          'SELECT * FROM order_info WHERE order_no = ? AND order_status = 0',
          [orderNo]
        );

        if (!order) {
          // 订单已处理，从队列移除
          await redis.zrem('order:timeout:queue', orderNo);
          continue;
        }

        // 3. 调用微信关单 API（best effort）
        try {
          await wxpay.closeOrder(orderNo);
        } catch (wxErr) {
          logger.warn(`[timeoutClose] 微信关单失败: ${orderNo}`, wxErr.message);
        }

        // 4. 释放 Redis 库存
        const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
        for (const item of (items || [])) {
          await stockService.releaseStock(item.productId, 'default', item.quantity);
        }

        // 5. 更新订单状态
        await db.execute(
          `UPDATE order_info SET order_status = 2, status_label = 'cancelled',
           cancel_time = NOW(), cancel_reason = '超时未支付自动取消' WHERE order_no = ?`,
          [orderNo]
        );

        // 更新库存锁定记录
        await db.execute(
          "UPDATE stock_lock_record SET lock_status = 3 WHERE order_no = ?",
          [orderNo]
        );

        // 更新支付流水
        await db.execute(
          "UPDATE payment_record SET pay_status = 3 WHERE order_no = ?",
          [orderNo]
        );

        // 6. 释放号码牌
        if (order.card_number) {
          await db.execute(
            "UPDATE pai_numbers SET status = 'idle', order_id = '' WHERE number = ?",
            [order.card_number]
          );
        }

        // 7. 从队列移除
        await redis.zrem('order:timeout:queue', orderNo);

        logger.info(`[timeoutClose] ✅ 超时关单: ${orderNo}`);
      } catch (err) {
        logger.error(`[timeoutClose] 处理异常 ${orderNo}:`, err.message);
      }
    }
  } catch (err) {
    logger.error('[timeoutClose] 任务异常:', err.message);
  }
}

module.exports = timeoutClose;
