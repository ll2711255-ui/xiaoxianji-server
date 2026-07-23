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
      return res.status(400).json({ code: 'FAIL', message: '签名验证失败' });
    }
    payLogger.info('[pay-callback] 签名验证通过');
  }

  // ========== 2. 解析回调数据 ==========
  const body = req.body;
  let outTradeNo, transactionId, tradeState, totalAmount;

  // APIv3 格式：解密 resource
  if (body.resource && body.resource.ciphertext) {
    try {
      const resourceData = await wxpay.decryptResource(
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
  if (order.orderStatus !== 0) {
    payLogger.info(`[pay-callback] 订单已处理(${order.status})，幂等返回成功: ${outTradeNo}`);
    return res.status(200).json({ code: 'SUCCESS', message: '已处理' });
  }

  // ========== 4. 金额校验 ==========
  if (totalAmount !== order.payAmount) {
    payLogger.error(`[pay-callback] ❌ 金额不一致! 回调:${totalAmount} 本地:${order.payAmount} 订单:${outTradeNo}`);
    return res.status(200).json({ code: 'FAIL', message: '金额不一致' });
  }

  // ========== 5. 更新订单状态（原子幂等：WHERE order_status = 0） ==========
  try {
    // 先确认库存扣减（放在改状态之前，失败不污染订单）
    const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
    for (const item of (items || [])) {
      await stockService.confirmStock(item.productId, 'default', item.quantity);
    }

    // 原子更新：只有 order_status = 0 时才执行，防并发重复处理
    const affectedRows = await db.execute(
      `UPDATE order_info SET order_status = 1, status_label = 'paid',
       pay_time = NOW(), transaction_id = ? WHERE order_no = ? AND order_status = 0`,
      [transactionId, outTradeNo]
    );

    if (affectedRows === 0) {
      // 被另一个进程抢先处理了 → 幂等返回成功
      payLogger.info(`[pay-callback] 订单已被并发处理，幂等返回成功: ${outTradeNo}`);
      return res.status(200).json({ code: 'SUCCESS', message: '已处理' });
    }

    // 更新支付流水
    await db.execute(
      `UPDATE payment_record SET pay_status = 1, transaction_id = ?, callback_data = ?
       WHERE order_no = ?`,
      [transactionId, rawBody.substring(0, 10000), outTradeNo]
    );

    // 更新库存锁定记录
    await db.execute(
      "UPDATE stock_lock_record SET lock_status = 2 WHERE order_no = ?",
      [outTradeNo]
    );

    // 从延时队列移除
    const { redis } = require('../config/db');
    await redis.zrem('order:timeout:queue', outTradeNo);

    // 推送新订单到商家端（微信支付）
    const { emitNewPaidOrder } = require('../socket');
    emitNewPaidOrder(outTradeNo);

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
      return res.status(400).json({ code: 'FAIL', message: '签名验证失败' });
    }
  }

  // 解密
  const body = req.body;
  let refundData = body;

  if (body.resource && body.resource.ciphertext) {
    try {
      refundData = await wxpay.decryptResource(
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

  // ========== 幂等检查：已处理的退款记录直接返回 ==========
  const existingRefund = await db.queryOne(
    'SELECT refund_status FROM refund_record WHERE refund_no = ?',
    [outRefundNo]
  );
  if (existingRefund) {
    // refund_status: 0=处理中, 1=成功, 2=失败
    if (existingRefund.refund_status === 1) {
      payLogger.info(`[refund-callback] 退款已成功处理，幂等返回: ${outRefundNo}`);
      return res.status(200).json({ code: 'SUCCESS', message: '已处理' });
    }
    if (existingRefund.refund_status === 2) {
      payLogger.info(`[refund-callback] 退款已标记失败，幂等返回: ${outRefundNo}`);
      return res.status(200).json({ code: 'SUCCESS', message: '已处理' });
    }
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
      const isFullRefund = refundRecord && refundRecord.refundAmount >= order.payAmount;
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

// ================================================================
// 支付宝支付回调（必须放在 urlencoded 解析器之前注册）
// ================================================================

// 支付宝回调用表单 POST（application/x-www-form-urlencoded），不是 JSON！
// 需要单独解析，并保存 raw body 字符串用于验签
const alipayCallbackRouter = require('express').Router();

// urlencoded 解析 + 保存 raw body（支付宝回调验签需要原始表单字符串）
// verify 回调在 body 被解析前执行，此时 buf 是原始 buffer
alipayCallbackRouter.use(express.urlencoded({
  extended: false,
  verify: (req, _res, buf) => {
    req.rawBody = buf.toString();
  },
}));

/**
 * POST /api/pay-callback/alipay — 支付宝异步通知
 *
 * 支付宝回调特点：
 *   - Content-Type: application/x-www-form-urlencoded
 *   - 签名算法：RSA2（SHA256 with RSA）
 *   - 验签密钥：支付宝公钥（非商户私钥！）
 *   - 验签通过后必须返回纯文本 "success"（非 JSON！）
 *   - 支付宝会重试直到收到 "success"
 */
alipayCallbackRouter.post('/', async (req, res) => {
  const body = req.body;
  payLogger.info('[alipay-callback] 收到支付宝回调:', JSON.stringify({
    out_trade_no: body.out_trade_no,
    trade_no: body.trade_no,
    trade_status: body.trade_status,
    total_amount: body.total_amount,
  }));

  // ========== 1. 验签 ==========
  const alipayUtil = require('../utils/alipay');
  const config = require('../config');
  const signOk = alipayUtil.verifyCallbackSign(body, config.alipay.alipayPublicKey);
  if (!signOk) {
    payLogger.error('[alipay-callback] ❌ 签名验证失败！');
    return res.send('fail');
  }

  const tradeStatus = body.trade_status || '';
  const outTradeNo = body.out_trade_no || '';
  const tradeNo = body.trade_no || '';
  const totalAmount = body.total_amount ? Math.round(parseFloat(body.total_amount) * 100) : 0; // 元→分

  // 只处理支付成功（TRADE_SUCCESS）
  if (tradeStatus !== 'TRADE_SUCCESS') {
    payLogger.info(`[alipay-callback] 非支付成功状态(${tradeStatus})，返回 success`);
    return res.send('success');
  }

  if (!outTradeNo) {
    payLogger.error('[alipay-callback] 缺少订单号');
    return res.send('fail');
  }

  // ========== 2. 幂等校验 ==========
  const order = await db.queryOne('SELECT * FROM order_info WHERE order_no = ?', [outTradeNo]);
  if (!order) {
    payLogger.error(`[alipay-callback] 订单不存在: ${outTradeNo}`);
    return res.send('success'); // 订单不存在也返回 success，避免支付宝无限重试
  }

  if (order.orderStatus !== 0) {
    payLogger.info(`[alipay-callback] 订单已处理(${order.status})，幂等返回: ${outTradeNo}`);
    return res.send('success');
  }

  // ========== 3. 金额校验 ==========
  if (totalAmount > 0 && totalAmount !== order.payAmount) {
    payLogger.error(`[alipay-callback] ❌ 金额不一致! 回调:${totalAmount} 本地:${order.payAmount}`);
    return res.send('success');
  }

  // ========== 4. 更新订单状态 ==========
  try {
    const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
    for (const item of (items || [])) {
      await stockService.confirmStock(item.productId, 'default', item.quantity);
    }

    const affectedRows = await db.execute(
      `UPDATE order_info SET order_status = 1, status_label = 'paid',
       pay_time = NOW(), transaction_id = ? WHERE order_no = ? AND order_status = 0`,
      [tradeNo, outTradeNo]
    );

    if (affectedRows === 0) {
      payLogger.info(`[alipay-callback] 订单已被并发处理，幂等返回: ${outTradeNo}`);
      return res.send('success');
    }

    await db.execute(
      `UPDATE payment_record SET pay_status = 1, transaction_id = ?,
       callback_data = ? WHERE order_no = ?`,
      [tradeNo, JSON.stringify(body), outTradeNo]
    );

    await db.execute(
      "UPDATE stock_lock_record SET lock_status = 2 WHERE order_no = ?",
      [outTradeNo]
    );

    const { redis } = require('../config/db');
    await redis.zrem('order:timeout:queue', outTradeNo);

    // 推送新订单到商家端（支付宝支付）
    const { emitNewPaidOrder } = require('../socket');
    emitNewPaidOrder(outTradeNo);

    payLogger.info(`[alipay-callback] ✅ 支付成功处理完成: ${outTradeNo} tradeNo=${tradeNo}`);
  } catch (err) {
    payLogger.error(`[alipay-callback] 更新订单失败: ${outTradeNo}`, err.message);
    return res.send('fail');
  }

  // ⚠️ 支付宝必须返回纯文本 "success"（小写，无引号）
  return res.send('success');
});

// 挂载到主路由
router.use('/alipay', alipayCallbackRouter);

// ================================================================
// 抖音支付回调
// ================================================================

/**
 * POST /api/pay-callback/tt — 抖音异步通知
 *
 * 抖音回调特点：
 *   - Content-Type: application/json
 *   - 签名算法：HMAC-SHA256（key = MD5(appSecret)）
 *   - 签名放在 HTTP 头 Toutiao-Signature
 *   - 验签通过后必须返回 JSON { err_no: 0, err_tips: "success" }
 *
 * 回调 JSON 体示例：
 *   {
 *     "appid": "tt...",
 *     "cp_orderno": "A00001",
 *     "cp_extra": "",
 *     "way": "1",
 *     "payment_order_no": "PAY...",
 *     "total_amount": 12800,
 *     "status": "SUCCESS",
 *     "seller_uid": "...",
 *     "extra": "",
 *     "item_id": ""
 *   }
 */
router.post('/tt', async (req, res) => {
  const rawBody = req.rawBody || JSON.stringify(req.body);
  const signature = req.headers['toutiao-signature'] || req.headers['x-toutiao-signature'] || '';

  payLogger.info('[tt-callback] 收到抖音回调:', JSON.stringify({
    body: req.body,
    signature: signature ? '***' : 'MISSING',
  }));

  // ========== 1. 验签（HMAC-SHA256） ==========
  const toutiaoUtil = require('../utils/toutiao');
  const signOk = toutiaoUtil.verifyCallbackSign(rawBody, signature);
  if (!signOk) {
    payLogger.error('[tt-callback] ❌ 签名验证失败！');
    return res.json({ err_no: -1, err_tips: '签名验证失败' });
  }

  const body = req.body;
  const outTradeNo = body.cp_orderno || body.out_order_no || '';
  const paymentOrderNo = body.payment_order_no || body.order_id || '';
  const payStatus = body.status || '';
  const totalAmount = body.total_amount || 0; // 抖音金额单位已是分

  // 只处理支付成功
  if (payStatus !== 'SUCCESS') {
    payLogger.info(`[tt-callback] 非支付成功状态(${payStatus})`);
    return res.json({ err_no: 0, err_tips: 'success' });
  }

  if (!outTradeNo) {
    payLogger.error('[tt-callback] 缺少订单号');
    return res.json({ err_no: -1, err_tips: '缺少订单号' });
  }

  // ========== 2. 幂等校验 ==========
  const order = await db.queryOne('SELECT * FROM order_info WHERE order_no = ?', [outTradeNo]);
  if (!order) {
    payLogger.error(`[tt-callback] 订单不存在: ${outTradeNo}`);
    return res.json({ err_no: 0, err_tips: 'success' });
  }

  if (order.orderStatus !== 0) {
    payLogger.info(`[tt-callback] 订单已处理(${order.status})，幂等返回: ${outTradeNo}`);
    return res.json({ err_no: 0, err_tips: 'success' });
  }

  // ========== 3. 金额校验 ==========
  if (totalAmount > 0 && totalAmount !== order.payAmount) {
    payLogger.error(`[tt-callback] ❌ 金额不一致! 回调:${totalAmount} 本地:${order.payAmount}`);
    return res.json({ err_no: 0, err_tips: 'success' });
  }

  // ========== 4. 更新订单状态 ==========
  try {
    const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
    for (const item of (items || [])) {
      await stockService.confirmStock(item.productId, 'default', item.quantity);
    }

    const affectedRows = await db.execute(
      `UPDATE order_info SET order_status = 1, status_label = 'paid',
       pay_time = NOW(), transaction_id = ? WHERE order_no = ? AND order_status = 0`,
      [paymentOrderNo, outTradeNo]
    );

    if (affectedRows === 0) {
      payLogger.info(`[tt-callback] 订单已被并发处理，幂等返回: ${outTradeNo}`);
      return res.json({ err_no: 0, err_tips: 'success' });
    }

    await db.execute(
      `UPDATE payment_record SET pay_status = 1, transaction_id = ?,
       callback_data = ? WHERE order_no = ?`,
      [paymentOrderNo, rawBody.substring(0, 10000), outTradeNo]
    );

    await db.execute(
      "UPDATE stock_lock_record SET lock_status = 2 WHERE order_no = ?",
      [outTradeNo]
    );

    const { redis } = require('../config/db');
    await redis.zrem('order:timeout:queue', outTradeNo);

    // 推送新订单到商家端（抖音支付）
    const { emitNewPaidOrder } = require('../socket');
    emitNewPaidOrder(outTradeNo);

    payLogger.info(`[tt-callback] ✅ 支付成功处理完成: ${outTradeNo} paymentOrderNo=${paymentOrderNo}`);
  } catch (err) {
    payLogger.error(`[tt-callback] 更新订单失败: ${outTradeNo}`, err.message);
    return res.json({ err_no: -1, err_tips: '系统错误' });
  }

  return res.json({ err_no: 0, err_tips: 'success' });
});

module.exports = router;
