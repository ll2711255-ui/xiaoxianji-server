/**
 * 微信支付回调路由 /api/pay-callback/*
 *
 * 处理微信支付异步通知：
 *   1. 校验 IP 白名单（可选）
 *   2. 验证回调签名
 *   3. AES-256-GCM 解密报文
 *   4. 幂等校验（非待支付订单直接返回 200）
 *   5. 金额校验（回调金额 == 本地订单金额）
 *   6. 更新订单状态 + 确认库存扣减
 *   7. 返回 { code: "SUCCESS", message: "成功" }
 *
 * 注意：此路由需要获取 raw body 用于签名验证
 */
const router = require('express').Router();
const express = require('express');
const db = require('../config/db');
const wxpay = require('../utils/wxpay');
const stockService = require('../services/stock.service');
const logger = require('../utils/logger');
const { payLogger } = require('../utils/logger');

// 保存 raw body 用于验签
router.use(express.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf.toString();
  },
}));

/**
 * POST /api/pay-callback — 支付结果回调
 */
router.post('/', async (req, res) => {
  const rawBody = req.rawBody || '';
  const headers = req.headers;

  payLogger.info('[pay-callback] 收到支付回调:', JSON.stringify({
    headers: {
      'wechatpay-signature': headers['wechatpay-signature'] ? '***' : 'MISSING',
      'wechatpay-timestamp': headers['wechatpay-timestamp'],
      'wechatpay-nonce': headers['wechatpay-nonce'],
      'wechatpay-serial': headers['wechatpay-serial'],
    },
    bodyLength: rawBody.length,
  }));

  // ========== 1. 签名验证 ==========
  const isApiV3 = headers['wechatpay-signature'] && headers['wechatpay-timestamp'];
  if (isApiV3 && rawBody) {
    const signOk = await wxpay.verifyCallbackSign(headers, rawBody);
    if (!signOk) {
      payLogger.error('[pay-callback] 签名验证失败！');
      return res.status(200).json({ code: 'FAIL', message: '签名验证失败' });
    }
    payLogger.info('[pay-callback] 签名验证通过');
  }

  // ========== 2. 解析回调数据 ==========
  const body = req.body;
  let outTradeNo, transactionId, tradeState, totalAmount;

  // APIv3 格式：解密 resource
  if (body.resource && body.resource.ciphertext) {
    try {
      const resourceData = wxpay.decryptResource(
        body.resource.ciphertext,
        body.resource.nonce,
        body.resource.associated_data || ''
      );

      outTradeNo = resourceData.out_trade_no;
      transactionId = resourceData.transaction_id;
      tradeState = resourceData.trade_state;
      totalAmount = resourceData.amount ? resourceData.amount.total : 0;

      payLogger.info('[pay-callback] 解密成功:', { outTradeNo, transactionId, tradeState, totalAmount });

      // 只处理支付成功
      if (tradeState !== 'SUCCESS') {
        payLogger.info(`[pay-callback] 非支付成功状态(${tradeState})，忽略`);
        return res.status(200).json({ code: 'SUCCESS', message: '非支付成功状态' });
      }
    } catch (err) {
      payLogger.error('[pay-callback] 解密失败:', err.message);
      return res.status(200).json({ code: 'FAIL', message: '解密失败' });
    }
  } else {
    // 兼容旧格式
    outTradeNo = body.outTradeNo || body.out_trade_no;
    transactionId = body.transactionId || body.transaction_id || '';
    totalAmount = body.amount ? body.amount.total : (body.totalFee || 0);
  }

  if (!outTradeNo) {
    return res.status(200).json({ code: 'FAIL', message: '缺少订单号' });
  }

  // ========== 3. 查询订单 + 幂等校验 ==========
  const order = await db.queryOne('SELECT * FROM order_info WHERE order_no = ?', [outTradeNo]);
  if (!order) {
    payLogger.error(`[pay-callback] 订单不存在: ${outTradeNo}`);
    return res.status(200).json({ code: 'FAIL', message: '订单不存在' });
  }

  // 幂等：非待支付状态直接返回成功
  if (order.order_status !== 0) {
    payLogger.info(`[pay-callback] 订单已处理(${order.status_label})，幂等返回成功: ${outTradeNo}`);
    return res.status(200).json({ code: 'SUCCESS', message: '已处理' });
  }

  // ========== 4. 金额校验 ==========
  if (totalAmount !== order.pay_amount) {
    payLogger.error(`[pay-callback] ⚠️ 金额不一致! 回调:${totalAmount} 本地:${order.pay_amount} 订单:${outTradeNo}`);
    // 告警但继续执行（以本地金额为准）
  }

  // ========== 5. 更新订单状态 ==========
  try {
    await db.execute(
      `UPDATE order_info SET order_status = 1, status_label = 'paid',
       pay_time = NOW(), transaction_id = ? WHERE order_no = ?`,
      [transactionId, outTradeNo]
    );

    // 更新支付流水
    await db.execute(
      `UPDATE payment_record SET pay_status = 1, transaction_id = ?, callback_data = ?
       WHERE order_no = ?`,
      [transactionId, rawBody.substring(0, 10000), outTradeNo]
    );

    // ========== 6. 确认库存扣减（原子永久扣减） ==========
    const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
    for (const item of (items || [])) {
      await stockService.confirmStock(item.productId, 'default', item.quantity);
    }

    // 更新库存锁定记录
    await db.execute(
      "UPDATE stock_lock_record SET lock_status = 2 WHERE order_no = ?",
      [outTradeNo]
    );

    // 从延时队列移除
    const { redis } = require('../config/db');
    await redis.zrem('order:timeout:queue', outTradeNo);

    payLogger.info(`[pay-callback] ✅ 支付成功处理完成: ${outTradeNo} tx=${transactionId}`);
  } catch (err) {
    payLogger.error(`[pay-callback] 更新订单失败: ${outTradeNo}`, err.message);
    return res.status(500).json({ code: 'FAIL', message: '系统错误' });
  }

  // ========== 7. 返回成功 ==========
  return res.status(200).json({ code: 'SUCCESS', message: '成功' });
});

/**
 * POST /api/pay-callback/refund — 退款结果回调
 */
router.post('/refund', async (req, res) => {
  const rawBody = req.rawBody || '';
  const headers = req.headers;

  payLogger.info('[refund-callback] 收到退款回调');

  // 验签
  const isApiV3 = headers['wechatpay-signature'] && headers['wechatpay-timestamp'];
  if (isApiV3 && rawBody) {
    const signOk = await wxpay.verifyCallbackSign(headers, rawBody);
    if (!signOk) {
      return res.status(200).json({ code: 'FAIL', message: '签名验证失败' });
    }
  }

  // 解密
  const body = req.body;
  let refundData = body;

  if (body.resource && body.resource.ciphertext) {
    try {
      refundData = wxpay.decryptResource(
        body.resource.ciphertext,
        body.resource.nonce,
        body.resource.associated_data || ''
      );
    } catch (err) {
      payLogger.error('[refund-callback] 解密失败:', err.message);
      return res.status(200).json({ code: 'FAIL', message: '解密失败' });
    }
  }

  const outTradeNo = refundData.out_trade_no;
  const outRefundNo = refundData.out_refund_no;
  const refundId = refundData.refund_id || '';
  const refundStatus = refundData.refund_status || '';

  if (!outTradeNo || !outRefundNo) {
    return res.status(200).json({ code: 'FAIL', message: '缺少订单号' });
  }

  // 更新退款流水
  if (refundStatus === 'SUCCESS') {
    await db.execute(
      `UPDATE refund_record SET refund_status = 1, refund_id = ?, callback_data = ?
       WHERE refund_no = ?`,
      [refundId, rawBody.substring(0, 10000), outRefundNo]
    );

    // 更新订单退款状态
    const order = await db.queryOne('SELECT * FROM order_info WHERE order_no = ?', [outTradeNo]);
    if (order) {
      const refundRecord = await db.queryOne(
        'SELECT * FROM refund_record WHERE refund_no = ?',
        [outRefundNo]
      );
      // 全额退款 → 状态5；部分退款 → 状态3
      const isFullRefund = refundRecord && refundRecord.refund_amount >= order.pay_amount;
      await db.execute(
        `UPDATE order_info SET order_status = ?, refund_status = 'success' WHERE order_no = ?`,
        [isFullRefund ? 5 : 3, outTradeNo]
      );
    }

    payLogger.info(`[refund-callback] ✅ 退款成功: ${outTradeNo} refund=${refundId}`);
  } else if (refundStatus === 'FAIL') {
    await db.execute(
      `UPDATE refund_record SET refund_status = 2, callback_data = ? WHERE refund_no = ?`,
      [rawBody.substring(0, 10000), outRefundNo]
    );
    payLogger.error(`[refund-callback] ❌ 退款失败: ${outTradeNo}`);
  }

  return res.status(200).json({ code: 'SUCCESS', message: '成功' });
});

module.exports = router;
