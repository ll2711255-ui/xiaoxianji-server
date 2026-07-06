/**
 * 称重处理服务
 *
 * 对标现有 cloudfunctions/common/weighHandler.js
 * 流程：
 *   查订单 → 校验状态 → 读取定价信息 → 计算实收金额和退款 → 绑定号码牌 →
 *   写订单 → 调微信退款 → 推送通知
 */
const db = require('../config/db');
const wxpay = require('../utils/wxpay');
const logger = require('../utils/logger');

/**
 * 处理称重核心流程
 * @param {object} params
 * @param {string} params.orderNo
 * @param {number} params.actualWeight - 实际重量（克）
 * @param {string} params.weighPhoto - 称重照片URL
 * @param {string} params.cardNumber - 号码牌
 * @param {string} params.staffId - 操作员工ID
 * @param {boolean} params.isRetry - 是否为退款重试
 */
async function handleWeigh({ orderNo, actualWeight, weighPhoto, cardNumber, staffId, isRetry = false }) {
  // 1. 查询订单
  const order = await db.queryOne('SELECT * FROM order_info WHERE order_no = ?', [orderNo]);
  if (!order) {
    return { success: false, error: '订单不存在' };
  }

  // 2. 自动检测是否为退款重试
  const detectedRetry = order.status_label === 'weighed' &&
    (order.refund_status === 'failed' ||
     (order.refund_info && order.refund_info.status === 'failed'));
  const effectiveRetry = isRetry || detectedRetry;

  // 3. 状态校验
  if (!effectiveRetry) {
    if (order.status_label !== 'accepted') {
      return { success: false, error: `当前状态 [${order.status_label}] 不可称重` };
    }
  }

  if (!effectiveRetry && !cardNumber) {
    return { success: false, error: '请选择号码牌' };
  }

  // 4. 读取定价信息
  const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
  const item = (items && items[0]) || {};
  const spec = item.spec || {};
  const pricingType = item.pricingType || '';

  let pricePerJin = spec.type_price_per_jin || spec.price_per_jin || 0;
  let processingFee = spec.processing_fee || 0;

  // 兼容：从 unitPrice 反推单价
  if (!pricePerJin && item.unitPrice && pricingType === 'range_weight') {
    const weightMax = spec.weight_max || 500;
    pricePerJin = Math.round((item.unitPrice - processingFee) * 500 / weightMax);
  }

  const prepayAmount = order.pay_amount || 0;

  // 5. 计算金额
  let actualAmount, refundAmount;

  if (effectiveRetry) {
    actualAmount = order.actual_amount || 0;
    refundAmount = order.refund_amount || 0;
    if (!refundAmount && pricingType === 'range_weight') {
      actualAmount = Math.floor((actualWeight / 500) * pricePerJin + processingFee);
      refundAmount = Math.max(0, prepayAmount - actualAmount);
    }
  } else if (pricingType === 'range_weight') {
    actualAmount = Math.floor((actualWeight / 500) * pricePerJin + processingFee);
    refundAmount = Math.max(0, prepayAmount - actualAmount);
  } else {
    // exact_weight / per_piece: 实收 = 预收，退款 = 0
    actualAmount = prepayAmount;
    refundAmount = 0;
  }

  // 6. 初次称重：绑定号码牌 + 写订单
  if (!effectiveRetry) {
    // 原子绑定号码牌
    const updateRes = await db.execute(
      "UPDATE pai_numbers SET status = 'in_use', order_id = ? WHERE number = ? AND status = 'idle'",
      [orderNo, cardNumber]
    );
    if (updateRes === 0) {
      return { success: false, error: '该号码牌已被使用，请重新选择' };
    }

    // 构建 weighInfo / refundInfo
    const actualWeightJin = parseFloat((actualWeight / 500).toFixed(2));
    const weighInfo = {
      actualWeight,
      actualWeightJin,
      pricePerJin,
      processingFee,
      prepayAmount,
      actualAmount,
      refundAmount,
      weighPhoto: weighPhoto || '',
      weighTime: new Date().toISOString(),
      staffId: staffId || '',
      cardNumber,
      pricingType,
    };

    const refundNoStr = refundAmount > 0 ? ('REF' + orderNo + '_' + Date.now()) : '';
    const refundInfo = {
      refundNo: refundNoStr,
      refundAmount,
      status: refundAmount > 0 ? 'processing' : 'none',
      wxRefundId: '',
      refundTime: new Date().toISOString(),
      successTime: '',
    };

    // 更新订单
    await db.execute(
      `UPDATE order_info SET status_label = 'weighed', actual_weight = ?, actual_amount = ?,
       refund_amount = ?, weigh_info = ?, refund_info = ?, refund_status = ?,
       card_number = ?, weigh_time = NOW() WHERE order_no = ?`,
      [
        actualWeight, actualAmount, refundAmount,
        JSON.stringify(weighInfo), JSON.stringify(refundInfo),
        refundAmount > 0 ? 'processing' : 'none',
        cardNumber, orderNo,
      ]
    );
  }

  // 7. 调用微信退款 API（V3）
  let refundStatus = refundAmount > 0 ? 'processing' : 'none';

  if (refundAmount > 0) {
    const outRefundNo = orderNo + (effectiveRetry ? '_retry_' : '_refund_') + Date.now();

    try {
      const refundResult = await wxpay.createRefund({
        out_trade_no: orderNo,
        out_refund_no: outRefundNo,
        total: prepayAmount,
        refund: refundAmount,
        reason: effectiveRetry ? '称重差额退款（重试）' : '称重差额退款',
      });

      // 写入退款流水
      await db.insert(
        `INSERT INTO refund_record (refund_no, order_no, refund_amount, total_amount, refund_reason, refund_status, apply_user)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          outRefundNo, orderNo, refundAmount, prepayAmount,
          effectiveRetry ? '称重差额退款（重试）' : '称重差额退款',
          0, staffId || 0,
        ]
      );

      if (refundResult.success) {
        // 同步：退款申请成功，更新 refund_id
        await db.execute(
          `UPDATE order_info SET refund_status = 'success',
           refund_info = JSON_SET(COALESCE(refund_info, '{}'), '$.status', 'success', '$.wxRefundId', ?, '$.refundNo', ?)
           WHERE order_no = ?`,
          [refundResult.refund_id, outRefundNo, orderNo]
        );
        await db.execute(
          `UPDATE refund_record SET refund_status = 1, refund_id = ? WHERE refund_no = ?`,
          [refundResult.refund_id, outRefundNo]
        );
        refundStatus = 'success';
      } else {
        // 异步：等待退款回调
        await db.execute(
          `UPDATE order_info SET refund_status = 'failed' WHERE order_no = ?`,
          [orderNo]
        );
        refundStatus = 'failed';
      }
    } catch (err) {
      logger.error('[weigh] 退款API调用失败:', err.message);
      await db.execute(
        `UPDATE order_info SET refund_status = 'failed' WHERE order_no = ?`,
        [orderNo]
      );
      refundStatus = 'failed';

      if (effectiveRetry) {
        return { success: false, error: '退款失败: ' + err.message };
      }
    }
  }

  logger.info(`[weigh] 称重完成: ${orderNo}, 实收:${actualAmount}, 退款:${refundAmount}, 状态:${refundStatus}`);

  return {
    success: true,
    actualWeight,
    actualAmount,
    refundAmount,
    refundStatus,
    cardNumber: cardNumber || order.card_number || '',
  };
}

module.exports = { handleWeigh };
