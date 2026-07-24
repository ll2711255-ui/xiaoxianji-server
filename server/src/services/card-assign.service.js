/**
 * 号码牌挂牌服务（非称重商品专用）
 *
 * exact_weight / per_piece 商品不需要称重，但需要在接单后绑定号码牌。
 * 流程：
 *   1. 查订单 + 行锁（FOR UPDATE）
 *   2. 校验订单状态 = accepted 且商品类型非 range_weight
 *   3. 号码牌可用性检查（status='idle'）
 *   4. 事务：绑定号码牌 + 更新订单状态 → card_assigned
 */
const db = require('../config/db');
const logger = require('../utils/logger');

/**
 * 挂牌（绑定号码牌到订单）
 *
 * @param {object} params
 * @param {string} params.orderNo    - 订单号
 * @param {string} params.cardNumber - 号码牌编号（如 "05"）
 * @param {string} params.staffId    - 操作店员ID
 * @returns {Promise<{success:boolean, cardNumber:string, message:string}>}
 */
async function assignCard({ orderNo, cardNumber, staffId }) {

  // ========== 1. 查询订单 + 行锁 ==========
  const order = await db.queryOne(
    `SELECT order_no, status_label, items, type
     FROM order_info
     WHERE order_no = ?
     FOR UPDATE`,
    [orderNo]
  );

  if (!order) {
    throw Object.assign(new Error('订单不存在'), { status: 404 });
  }

  // ========== 2. 状态校验：仅在 accepted 状态可挂牌 ==========
  if (order.status !== 'accepted') {
    throw Object.assign(
      new Error(`当前订单状态（${order.status}）不可挂牌，请先接单`),
      { status: 400 }
    );
  }

  // ========== 3. 商品类型校验：仅非称重商品走挂牌 ==========
  const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
  const firstItem = (items && items[0]) || {};
  const pricingType = firstItem.pricingType || '';

  if (pricingType === 'range_weight') {
    throw Object.assign(
      new Error('整鸡商品需走称重挂牌流程，请使用称重功能'),
      { status: 400 }
    );
  }

  // ========== 4. 号码牌可用性校验 ==========
  const card = await db.queryOne(
    "SELECT number, status FROM pai_numbers WHERE number = ?",
    [cardNumber]
  );

  if (!card) {
    throw Object.assign(new Error('号码牌不存在'), { status: 400 });
  }

  if (card.status !== 'idle') {
    throw Object.assign(
      new Error(`号码牌 ${cardNumber} 已被使用，请选择其他号码`),
      { status: 400, code: 'PLATE_TAKEN' }
    );
  }

  // ========== 5. 事务：绑定号码牌 + 更新订单状态 ==========
  try {
    await db.transaction(async (conn) => {
      // 绑定号码牌（WHERE status='idle' 防并发）
      const [plateResult] = await conn.execute(
        "UPDATE pai_numbers SET status = 'in_use', order_id = ? WHERE number = ? AND status = 'idle'",
        [orderNo, cardNumber]
      );
      if (plateResult.affectedRows === 0) {
        throw Object.assign(
          new Error(`号码牌 ${cardNumber} 已被使用，请重新选择`),
          { status: 400, code: 'PLATE_TAKEN' }
        );
      }

      // 更新订单状态 → card_assigned
      // weigh_time 在此处表示"称重/挂牌"环节完成时间（挂牌和称重共用同一字段）
      const [orderResult] = await conn.execute(
        `UPDATE order_info
         SET status_label = 'card_assigned',
             card_number = ?,
             weigh_time = NOW()
         WHERE order_no = ?
           AND status_label = 'accepted'`,
        [cardNumber, orderNo]
      );
      if (orderResult.affectedRows === 0) {
        throw Object.assign(
          new Error('订单已被处理，请刷新页面'),
          { status: 409, code: 'ORDER_PROCESSED' }
        );
      }
    });
  } catch (err) {
    if (err.code === 'PLATE_TAKEN' || err.code === 'ORDER_PROCESSED') {
      throw err;
    }
    logger.error('[assignCard] 挂牌事务失败:', err.message);
    throw err;
  }

  logger.info(`[assignCard] 挂牌成功: ${orderNo} → 号码牌 ${cardNumber} (staff: ${staffId || '-'})`);

  return {
    success: true,
    cardNumber,
    message: `已绑定号码牌 ${cardNumber}`,
  };
}

module.exports = { assignCard };
