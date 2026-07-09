/**
 * 兜底查单定时任务（每5分钟执行）
 *
 * 扫描创建超 10 分钟仍待支付的订单，主动调用微信查单 API 同步状态：
 *   1. 微信侧已支付 → 执行支付成功逻辑
 *   2. 微信侧已关闭 → 执行关单逻辑
 *   3. 微信侧仍待支付 → 不做处理
 */
const db = require('../config/db');
const { redis } = require('../config/db');
const wxpay = require('../utils/wxpay');
const stockService = require('../services/stock.service');
const logger = require('../utils/logger');

async function fallbackQuery() {
  try {
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000);
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);

    // 查询：创建超过10分钟但仍待支付的订单
    const orders = await db.query(
      `SELECT * FROM order_info
       WHERE order_status = 0
         AND create_time < ?
         AND create_time > ?
       ORDER BY create_time ASC
       LIMIT 50`,
      [tenMinAgo, thirtyMinAgo]
    );

    if (orders.length === 0) return;

    logger.info(`[fallbackQuery] 发现 ${orders.length} 笔待查订单`);

    for (const order of orders) {
      try {
        const result = await wxpay.queryOrder(order.orderNo);

        if (!result.success) {
          logger.warn(`[fallbackQuery] 查单失败: ${order.orderNo}`, result.error);
          continue;
        }

        if (result.trade_state === 'SUCCESS') {
          // ========== 微信侧已支付，执行支付成功逻辑 ==========
          await db.execute(
            `UPDATE order_info SET order_status = 1, status_label = 'paid',
             pay_time = ?, transaction_id = ? WHERE order_no = ?`,
            [result.success_time || new Date(), result.transaction_id, order.orderNo]
          );

          await db.execute(
            `UPDATE payment_record SET pay_status = 1, transaction_id = ?
             WHERE order_no = ?`,
            [result.transaction_id, order.orderNo]
          );

          // 确认库存
          const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
          for (const item of (items || [])) {
            await stockService.confirmStock(item.productId, 'default', item.quantity);
          }

          await db.execute(
            "UPDATE stock_lock_record SET lock_status = 2 WHERE order_no = ?",
            [order.orderNo]
          );

          await redis.zrem('order:timeout:queue', order.orderNo);

          logger.info(`[fallbackQuery] ✅ 兜底查单-支付成功: ${order.orderNo}`);
        } else if (['CLOSED', 'REVOKED', 'PAYERROR'].includes(result.trade_state)) {
          // ========== 微信侧已关闭，执行关单 ==========
          const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
          for (const item of (items || [])) {
            await stockService.releaseStock(item.productId, 'default', item.quantity);
          }

          await db.execute(
            `UPDATE order_info SET order_status = 2, status_label = 'cancelled',
             cancel_time = NOW(), cancel_reason = '兜底查单-微信侧已关闭' WHERE order_no = ?`,
            [order.orderNo]
          );

          await db.execute(
            "UPDATE stock_lock_record SET lock_status = 3 WHERE order_no = ?",
            [order.orderNo]
          );

          await redis.zrem('order:timeout:queue', order.orderNo);

          if (order.cardNumber) {
            await db.execute(
              "UPDATE pai_numbers SET status = 'idle', order_id = '' WHERE number = ?",
              [order.cardNumber]
            );
          }

          logger.info(`[fallbackQuery] ✅ 兜底查单-关单: ${order.orderNo}`);
        }
      } catch (err) {
        logger.error(`[fallbackQuery] 异常 ${order.orderNo}:`, err.message);
      }
    }
  } catch (err) {
    logger.error('[fallbackQuery] 任务异常:', err.message);
  }
}

module.exports = fallbackQuery;
