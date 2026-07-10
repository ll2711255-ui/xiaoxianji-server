/**
 * 支付路由 /api/payment/*
 *
 * 多平台支付统一下单接口：
 *   - POST /alipay-create  — 支付宝小程序统一下单（返回 orderStr → 前端 my.tradePay）
 *   - POST /tt-create      — 抖音小程序统一下单（返回 orderId + orderToken → 前端 tt.pay）
 *
 * 不同于 /api/pay-callback/*（异步通知回调），这里是前端主动调用的下单接口
 */
const router = require('express').Router();
const { verifyToken } = require('../middleware/auth');
const rateLimiter = require('../middleware/rateLimiter');
const db = require('../config/db');
const config = require('../config');
const alipay = require('../utils/alipay');
const toutiao = require('../utils/toutiao');
const logger = require('../utils/logger');

// 支付接口限流：每分钟最多 5 次
const payLimiter = rateLimiter({ windowMs: 60000, max: 5 });

// ========== 支付宝统一下单 ==========

/**
 * POST /api/payment/alipay-create
 *
 * 支付宝小程序支付流程：
 *   前端 my.tradePay({ orderStr: '...' })
 *   需要先通过此接口获取 orderStr
 *
 * Body: { orderNo }
 * 需登录
 */
router.post('/alipay-create', verifyToken, payLimiter, async (req, res) => {
  try {
    const { orderNo } = req.body;
    if (!orderNo) {
      return res.status(400).json({ success: false, code: 400, message: '缺少订单号' });
    }

    // 查询订单
    const order = await db.queryOne(
      'SELECT * FROM order_info WHERE order_no = ? AND user_id = ?',
      [orderNo, req.user.openid]
    );
    if (!order) {
      return res.status(404).json({ success: false, code: 404, message: '订单不存在' });
    }
    if (order.orderStatus !== 0) {
      return res.status(400).json({ success: false, code: 400, message: '订单状态不允许支付' });
    }

    // 构建商品描述
    const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
    const subject = items && items.length > 0
      ? `小鲜鸡-${items[0].name || '新鲜生鲜'}等${items.length}件`
      : '小鲜鸡-新鲜生鲜';

    // 支付宝统一下单
    const result = await alipay.createOrder({
      out_trade_no: orderNo,
      total_amount: order.payAmount, // 分
      subject,
      buyer_id: req.user.openid,
      notify_url: config.notify.alipay,
    });

    // 更新支付流水记录
    await db.execute(
      `UPDATE payment_record SET prepay_id = ? WHERE order_no = ?`,
      [result.tradeNo, orderNo]
    );

    logger.info(`[payment] 支付宝下单成功: ${orderNo} tradeNo=${result.tradeNo}`);

    res.json({
      success: true,
      code: 200,
      message: '支付宝下单成功',
      data: {
        tradeNo: result.tradeNo,
        orderStr: result.orderStr, // 传给前端 my.tradePay
        orderNo,
        amount: order.payAmount,
      },
    });
  } catch (err) {
    logger.error('[payment] alipay-create 失败:', err.message);
    res.status(500).json({ success: false, code: 500, message: err.message || '支付宝下单失败' });
  }
});

// ========== 抖音统一下单 ==========

/**
 * POST /api/payment/tt-create
 *
 * 抖音小程序支付流程：
 *   前端 tt.pay({ orderId, orderToken, ... })
 *   需要先通过此接口获取 orderId + orderToken
 *
 * Body: { orderNo }
 * 需登录
 */
router.post('/tt-create', verifyToken, payLimiter, async (req, res) => {
  try {
    const { orderNo } = req.body;
    if (!orderNo) {
      return res.status(400).json({ success: false, code: 400, message: '缺少订单号' });
    }

    // 查询订单
    const order = await db.queryOne(
      'SELECT * FROM order_info WHERE order_no = ? AND user_id = ?',
      [orderNo, req.user.openid]
    );
    if (!order) {
      return res.status(404).json({ success: false, code: 404, message: '订单不存在' });
    }
    if (order.orderStatus !== 0) {
      return res.status(400).json({ success: false, code: 400, message: '订单状态不允许支付' });
    }

    // 构建商品描述
    const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
    const subject = items && items.length > 0
      ? `小鲜鸡-${items[0].name || '新鲜生鲜'}等${items.length}件`
      : '小鲜鸡-新鲜生鲜';

    // 抖音统一下单
    const result = await toutiao.createOrder({
      out_order_no: orderNo,
      total_amount: order.payAmount, // 分（抖音也是分）
      subject,
      openid: req.user.openid,
      notify_url: config.notify.tt,
    });

    // 更新支付流水记录
    await db.execute(
      `UPDATE payment_record SET prepay_id = ? WHERE order_no = ?`,
      [result.orderId, orderNo]
    );

    logger.info(`[payment] 抖音下单成功: ${orderNo} orderId=${result.orderId}`);

    res.json({
      success: true,
      code: 200,
      message: '抖音下单成功',
      data: {
        orderId: result.orderId,
        orderToken: result.orderToken, // 传给前端 tt.pay
        orderNo,
        amount: order.payAmount,
      },
    });
  } catch (err) {
    logger.error('[payment] tt-create 失败:', err.message);
    res.status(500).json({ success: false, code: 500, message: err.message || '抖音下单失败' });
  }
});

module.exports = router;
