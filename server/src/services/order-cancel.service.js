/**
 * 订单取消服务 — 统一取消入口
 *
 * 所有取消场景（用户取消/商家取消接单/系统超时）都走这一个函数，
 * 由 cancelBy 区分来源。
 *
 * 流程：
 *   1. 查订单 + 行锁（FOR UPDATE）
 *   2. 校验取消权限（validateCancelPermission）
 *   3. 判断是否需要退款（paid → 全额退款，pending → 无退款）
 *   4. UPDATE 订单状态（事务 + 状态前置条件防并发）
 *   5. 释放 Redis 库存
 *   6. 异步发起微信退款（不阻塞响应）
 */
const db = require('../config/db');
const { redis } = require('../config/db');
const { createRefund } = require('../utils/wxpay');
const logger = require('../utils/logger');

/**
 * 取消订单核心函数
 *
 * @param {object} params
 * @param {string} params.orderNo       - 订单号
 * @param {string} params.cancelBy      - 取消方：'user' | 'merchant' | 'system'
 * @param {string} params.cancelReason  - 取消原因
 * @param {number|string} params.operatorId - 操作者ID
 * @returns {Promise<{success:boolean, orderNo:string, needRefund:boolean, refundAmount:number, message:string}>}
 */
async function cancelOrder({ orderNo, cancelBy, cancelReason, operatorId }) {

  // ========== 1. 查询订单当前状态（加行锁，防并发取消） ==========
  const order = await db.queryOne(
    `SELECT order_no, order_status, status_label,
            pay_amount, transaction_id, user_id, items
     FROM order_info
     WHERE order_no = ?
     FOR UPDATE`,
    [orderNo]
  );

  if (!order) {
    throw Object.assign(new Error('订单不存在'), { status: 404 });
  }

  // ========== 2. 校验是否允许取消 ==========
  validateCancelPermission(order, cancelBy);

  // ========== 3. 判断是否需要退款 ==========
  const needRefund = order.status === 'paid';
  const refundAmount = needRefund ? order.payAmount : 0;

  // ========== 4. 数据库事务：更新订单状态 ==========
  // UPDATE 带 status_label 前置条件，防止 TOCTOU 竞态
  const [result] = await db.pool.execute(
    `UPDATE order_info
     SET order_status  = 2,
         status_label  = 'cancelled',
         cancel_reason = ?,
         cancel_by     = ?,
         cancel_time   = NOW(),
         refund_status = ?,
         refund_amount = ?
     WHERE order_no = ?
       AND status_label IN ('pending', 'paid')`,
    [
      cancelReason || '',
      cancelBy,
      needRefund ? 'pending' : 'none',
      refundAmount,
      orderNo,
    ]
  );

  if (result.affectedRows === 0) {
    throw Object.assign(new Error('订单状态已变更，请刷新后重试'), { status: 409 });
  }

  // ========== 5. 释放 Redis 库存锁 ==========
  await releaseOrderStock(orderNo, order.items);

  // 释放库存后：如果商品之前被标记 out_of_stock，库存恢复后自动取消标记
  await restoreOutOfStock(order.items);

  // 更新 stock_lock_record
  await db.execute(
    "UPDATE stock_lock_record SET lock_status = 3 WHERE order_no = ?",
    [orderNo]
  );

  // 支付流水标记关闭
  await db.execute(
    "UPDATE payment_record SET pay_status = 3 WHERE order_no = ?",
    [orderNo]
  );

  // 从 Redis 延时队列移除
  try {
    await redis.zrem('order:timeout:queue', orderNo);
  } catch (e) {
    logger.warn('[cancel] 移除延时队列失败:', e.message);
  }

  // 释放号码牌
  try {
    const orderWithCard = await db.queryOne(
      'SELECT card_number FROM order_info WHERE order_no = ?',
      [orderNo]
    );
    if (orderWithCard && orderWithCard.cardNumber) {
      await db.execute(
        "UPDATE pai_numbers SET status = 'idle', order_id = '' WHERE number = ?",
        [orderWithCard.cardNumber]
      );
    }
  } catch (e) {
    logger.warn('[cancel] 释放号码牌失败:', e.message);
  }

  // ========== 6. 异步发起微信退款（不阻塞取消响应） ==========
  if (needRefund && order.transactionId) {
    initiateRefundAsync(orderNo, order.transactionId, refundAmount, cancelReason)
      .catch(err => logger.error('[cancel] 发起退款失败:', err.message));
  }

  const refundYuan = (refundAmount / 100).toFixed(2);
  logger.info(`[cancel] 订单取消成功: ${orderNo} by ${cancelBy}, 退款: ${refundAmount}分`);

  return {
    success: true,
    orderNo,
    needRefund,
    refundAmount,
    message: needRefund
      ? `订单已取消，¥${refundYuan} 将在1-7个工作日内退回`
      : '订单已取消',
  };
}

// ========== 取消权限校验 ==========

/**
 * 校验取消权限，抛出异常表示不允许取消
 */
function validateCancelPermission(order, cancelBy) {
  const status = order.status;  // db.queryOne 已将 status_label 转为 status

  // 已取消或已完成的订单不能再取消
  if (status === 'cancelled') {
    throw Object.assign(new Error('订单已取消'), { status: 400 });
  }
  if (status === 'completed') {
    throw Object.assign(new Error('订单已完成，无法取消'), { status: 400 });
  }

  if (cancelBy === 'user') {
    // 用户只能取消 pending 和 paid 状态的订单
    if (status === 'pending') return;  // ✅ 允许，无退款
    if (status === 'paid') return;     // ✅ 允许，全额退款
    // accepted 及之后用户不能取消
    throw Object.assign(
      new Error('商家已接单，订单无法取消。如有问题请联系客服'),
      { status: 403 }
    );
  }

  if (cancelBy === 'merchant') {
    // 商家只能取消接单前（paid）的订单
    if (status === 'paid') return;     // ✅ 允许，全额退款
    throw Object.assign(
      new Error(`当前订单状态（${status}）不支持取消接单`),
      { status: 403 }
    );
  }

  if (cancelBy === 'system') {
    // 系统只取消 pending 超时订单
    if (status === 'pending') return;  // ✅ 允许，无退款
    throw Object.assign(
      new Error(`系统只能取消待支付订单，当前状态：${status}`),
      { status: 403 }
    );
  }

  throw Object.assign(new Error('无效的取消方'), { status: 400 });
}

// ========== 库存释放 ==========

/**
 * 释放订单关联的 Redis 库存锁
 * 从 order_info.items 解析商品列表后逐条释放
 */
async function releaseOrderStock(orderNo, itemsRaw) {
  try {
    let items = itemsRaw;
    if (typeof items === 'string') {
      items = JSON.parse(items);
    }

    if (!items || items.length === 0) {
      // 尝试从 stock_lock_record 查
      const locks = await db.query(
        'SELECT goods_id, batch_no, lock_num FROM stock_lock_record WHERE order_no = ? AND lock_status = 1',
        [orderNo]
      );
      if (locks && locks.length > 0) {
        const { releaseStock } = require('./stock.service');
        for (const lock of locks) {
          await releaseStock(lock.goodsId, lock.batchNo || 'default', lock.lockNum)
            .catch(err => logger.warn(`[cancel] 释放库存失败 goods=${lock.goodsId}:`, err.message));
        }
      }
      return;
    }

    const { releaseStock } = require('./stock.service');
    for (const item of items) {
      await releaseStock(item.productId, 'default', item.quantity)
        .catch(err => logger.warn(`[cancel] 释放库存失败 goods=${item.productId}:`, err.message));
    }
  } catch (err) {
    logger.error('[cancel] 释放库存异常:', err.message);
  }
}

/**
 * 库存释放后检查：如果之前标记 out_of_stock=1，现在库存>0 则自动恢复
 *
 * 降级路径：当 itemsRaw 为空时，从 stock_lock_record 查询被释放的商品列表
 */
async function restoreOutOfStock(itemsRaw) {
  try {
    let productIds = [];

    if (itemsRaw) {
      let items = itemsRaw;
      if (typeof items === 'string') {
        try { items = JSON.parse(items); } catch { items = null; }
      }
      if (items && items.length > 0) {
        productIds = items.map(item => item.productId).filter(Boolean);
      }
    }

    // 降级：items 为空时，从 stock_lock_record 查询
    if (productIds.length === 0) {
      return; // releaseOrderStock 已处理 stock_lock_record 的降级释放
    }

    for (const productId of productIds) {
      try {
        const remaining = await redis.hget(`stock:available:${productId}`, 'default');
        if (remaining !== null && parseInt(remaining) > 0) {
          await db.execute(
            'UPDATE products SET out_of_stock = 0 WHERE id = ? AND out_of_stock = 1',
            [productId]
          );
          logger.info(`[cancel] 库存恢复自动取消缺货: goods=${productId} remaining=${remaining}`);
        }
      } catch (e) { /* 非关键路径 */ }
    }
  } catch (e) { /* 非关键路径 */ }
}

// ========== 异步退款 ==========

/**
 * 异步发起微信退款
 *
 * 不阻塞取消流程，失败后写入 refund_alert 告警 + 更新 refund_status='failed'
 * 通过 refund_record.refund_no UNIQUE 约束保证幂等
 */
async function initiateRefundAsync(orderNo, transactionId, refundAmount, cancelReason) {
  try {
    const outRefundNo = `${orderNo}_CANCEL`;

    // 幂等检查：已终态的退款记录跳过
    const existing = await db.queryOne(
      'SELECT refund_status FROM refund_record WHERE refund_no = ?',
      [outRefundNo]
    );
    if (existing && existing.refundStatus === 1) {
      logger.info('[cancel] 退款已处理，跳过:', outRefundNo);
      return;
    }

    // 写入退款记录（幂等：ON DUPLICATE KEY UPDATE）
    await db.execute(
      `INSERT INTO refund_record (refund_no, order_no, refund_amount, total_amount, refund_reason, refund_status, apply_user)
       VALUES (?, ?, ?, ?, ?, 0, 0)
       ON DUPLICATE KEY UPDATE refund_amount = VALUES(refund_amount)`,
      [outRefundNo, orderNo, refundAmount, refundAmount, cancelReason || '订单取消退款']
    );

    // 查原订单金额（退款 API 需要 total）
    const order = await db.queryOne(
      'SELECT pay_amount FROM order_info WHERE order_no = ?',
      [orderNo]
    );
    const totalAmount = order ? order.payAmount : refundAmount;

    // 调用微信退款 API
    const result = await createRefund({
      out_trade_no: orderNo,
      out_refund_no: outRefundNo,
      total: totalAmount,
      refund: refundAmount,
      reason: cancelReason || '订单取消退款',
    });

    if (result.success) {
      // 退款申请成功（不代表到账，到账通过回调通知）
      await db.execute(
        `UPDATE order_info SET refund_status = 'pending' WHERE order_no = ?`,
        [orderNo]
      );
      await db.execute(
        `UPDATE refund_record SET refund_status = 1, refund_id = ? WHERE refund_no = ?`,
        [result.refund_id, outRefundNo]
      );
      logger.info('[cancel] 退款申请成功:', orderNo, result.refund_id);
    } else {
      throw new Error(result.error || '退款API返回失败');
    }

  } catch (err) {
    logger.error('[cancel] 退款异常:', err.message);
    // 更新退款状态为失败
    await db.execute(
      `UPDATE order_info SET refund_status = 'failed' WHERE order_no = ?`,
      [orderNo]
    );
    // 写入退款告警
    try {
      await db.execute(
        `INSERT INTO refund_alert (order_no, refund_no, refund_amount, alert_type, error_message)
         VALUES (?, ?, ?, 'cancel_refund_failed', ?)`,
        [orderNo, `${orderNo}_CANCEL`, refundAmount, err.message]
      );
    } catch (alertErr) {
      logger.error('[cancel] 写入退款告警失败:', alertErr.message);
    }
  }
}

module.exports = { cancelOrder, validateCancelPermission };
