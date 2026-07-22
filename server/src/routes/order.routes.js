/**
 * 订单路由 /api/orders/*
 */
const router = require('express').Router();
const orderService = require('../services/order.service');
const wxpay = require('../utils/wxpay');
const config = require('../config');
const logger = require('../utils/logger');
const { validateOrderNo } = require('../utils/validate');
const { checkText } = require('../utils/secCheck');

/**
 * POST /api/orders — 创建订单
 * Body: { items, type, deliveryAddress, isScheduled, scheduledDate, scheduledTime }
 */
router.post('/', async (req, res) => {
  try {
    const { items, type, deliveryAddress, isScheduled, scheduledDate, scheduledTime } = req.body;
    const openid = req.user.openid;

    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, code: 400, message: '商品不能为空' });
    }
    if (!type || !['delivery', 'pickup'].includes(type)) {
      return res.status(400).json({ success: false, code: 400, message: '取货方式无效' });
    }
    if (type === 'delivery' && !deliveryAddress) {
      return res.status(400).json({ success: false, code: 400, message: '配送订单缺少收货地址' });
    }

    // 内容安全检测：逐条检测商品备注
    for (const item of items) {
      if (item.remark && item.remark.trim()) {
        const textResult = await checkText(item.remark, openid);
        if (!textResult.pass) {
          return res.status(400).json({ success: false, code: 'CONTENT_RISK', message: textResult.reason || '备注内容含违规信息，请修改后重试' });
        }
      }
    }

    const result = await orderService.createOrder({
      openid,
      items,
      type,
      deliveryAddress,
      isScheduled,
      scheduledDate,
      scheduledTime,
    });

    res.json({
      success: true,
      code: 200,
      data: {
        orderNo: result.orderNo,
        payment: result.payment,
        ...(result.payError ? { payError: result.payError } : {}),
      },
    });
  } catch (err) {
    logger.error('[orders] 创建失败:', err.message);
    res.status(500).json({ success: false, code: 500, message: err.message || '创建订单失败' });
  }
});

/**
 * GET /api/orders — 用户订单列表
 */
router.get('/', async (req, res) => {
  try {
    const { status, page = 1, pageSize = 20 } = req.query;
    const orders = await orderService.getUserOrders(req.user.openid, { status, page, pageSize });
    res.json({ success: true, code: 200, data: { orders } });
  } catch (err) {
    logger.error('[orders] 列表查询失败:', err.message);
    res.status(500).json({ success: false, code: 500, message: err.message });
  }
});

/**
 * GET /api/orders/pay/status?orderNo=xxx — 查询支付状态
 * 仅允许订单所属用户或商家查询
 */
router.get('/pay/status', async (req, res) => {
  try {
    const { orderNo } = req.query;
    if (!orderNo) {
      return res.status(400).json({ success: false, code: 400, message: '缺少订单号' });
    }
    // 权限校验：先查订单归属
    const order = await orderService.getOrderByNo(orderNo);
    if (!order) {
      return res.status(404).json({ success: false, code: 404, message: '订单不存在' });
    }
    if (order.userId !== req.user.openid && req.user.role !== 'merchant') {
      return res.status(403).json({ success: false, code: 403, message: '无权查看此订单' });
    }
    const status = await orderService.getPayStatus(orderNo);
    res.json({ success: true, code: 200, data: status });
  } catch (err) {
    logger.error('[orders] 支付状态查询失败:', err.message);
    res.status(500).json({ success: false, code: 500, message: err.message });
  }
});

/**
 * GET /api/orders/:orderNo — 订单详情
 */
router.get('/:orderNo', async (req, res) => {
  try {
    const v = validateOrderNo(req.params.orderNo);
    if (!v.valid) return res.status(400).json({ success: false, code: 400, message: v.error });

    const order = await orderService.getOrderByNo(req.params.orderNo);
    if (!order) {
      return res.status(404).json({ success: false, code: 404, message: '订单不存在' });
    }
    // 仅允许查看自己的订单（除非是商家）
    if (order.userId !== req.user.openid && req.user.role !== 'merchant') {
      return res.status(403).json({ success: false, code: 403, message: '无权查看此订单' });
    }
    res.json({ success: true, code: 200, data: { order } });
  } catch (err) {
    logger.error('[orders] 详情查询失败:', err.message);
    res.status(500).json({ success: false, code: 500, message: err.message });
  }
});

/**
 * POST /api/orders/:orderNo/pay — 重试支付 / 模拟支付
 */
router.post('/:orderNo/pay', async (req, res) => {
  try {
    const { orderNo } = req.params;

    const v = validateOrderNo(orderNo);
    if (!v.valid) return res.status(400).json({ success: false, code: 400, message: v.error });

    const { mockPay, mockPaySuccess } = req.body;

    // ========== 模拟支付（开发环境） ==========
    if (mockPay && config.env !== 'production') {
      const order = await orderService.getOrderByNo(orderNo);
      if (!order) {
        return res.status(404).json({ success: false, code: 404, message: '订单不存在' });
      }
      if (order.status !== 'pending') {
        return res.status(400).json({ success: false, code: 400, message: `订单状态「${order.status}」不可模拟支付` });
      }

      // 模拟支付成功处理
      if (mockPaySuccess !== false) {
        const mockTransactionId = 'mock_' + Date.now();

        await require('../config/db').execute(
          `UPDATE order_info SET order_status = 1, status_label = 'paid',
           pay_time = NOW(), transaction_id = ? WHERE order_no = ?`,
          [mockTransactionId, orderNo]
        );

        await require('../config/db').execute(
          `UPDATE payment_record SET pay_status = 1, transaction_id = ? WHERE order_no = ?`,
          [mockTransactionId, orderNo]
        );

        // 确认库存扣减
        const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
        const stockService = require('../services/stock.service');
        for (const item of items) {
          await stockService.confirmStock(item.productId, 'default', item.quantity);
        }
      }

      return res.json({ success: true, code: 200, data: { orderNo, status: 'paid' } });
    }

    // ========== 真实支付：优先复用缓存的 prepay_id，无缓存才调微信统一下单 ==========
    const order = await orderService.getOrderByNo(orderNo);
    if (!order) {
      return res.status(404).json({ success: false, code: 404, message: '订单不存在' });
    }
    if (order.orderStatus !== 0) {
      return res.status(400).json({ success: false, code: 400, message: '订单已处理，不可重试支付' });
    }

    // 获取有效 appId（.env 优先，DB 兜底）
    let effectiveAppId = config.wx.appId;
    if (!effectiveAppId) {
      try {
        const payConfig = await wxpay.getPayConfig();
        effectiveAppId = payConfig.appId || '';
      } catch (e) {
        logger.error('[orders] 重试支付获取 appId 失败:', e.message);
      }
    }

    // ===== 优先复用缓存的 prepay_id（不调微信统一下单！）=====
    const cachedPrepayId = order.paymentRecord?.prepayId || order.prepayId;
    if (cachedPrepayId) {
      logger.info(`[orders] ===== 二次重入：缓存复用 prepay_id，不调用微信API =====`);
      logger.info(`[orders] 缓存 prepay_id: ${cachedPrepayId}, 订单: ${orderNo}, 金额: ${order.payAmount}分`);
      const payment = await wxpay.buildPayParams(cachedPrepayId, effectiveAppId);
      logger.info(`[orders] 本地签名完成 paySign: ${payment.paySign.substring(0, 20)}...`);
      return res.json({ success: true, code: 200, data: { orderNo, payment, cached: true } });
    }

    // ===== 无缓存 → 无法安全支付 =====
    // 说明：旧订单（修复前创建的）没有 payment_record.prepay_id。
    //       微信支付 V3 要求：关闭订单后必须「生成新单号」，不能用同一个
    //       out_trade_no 重新调 jsapiPrepay（会触发「请求重入」错误）。
    //       所以无缓存时唯一安全做法是提示用户取消旧订单、重新下单。
    logger.info(`[orders] ===== 无缓存 prepay_id，无法安全支付: ${orderNo} =====`);

    // 尝试关闭微信侧旧预支付单（best effort，避免资源泄漏）
    const payConfigured = await wxpay.checkConfig();
    if (payConfigured) {
      const closeResult = await wxpay.closeOrder(orderNo);
      logger.info(`[orders] 关闭旧预支付单结果: ${orderNo}`, JSON.stringify(closeResult));
    }

    return res.status(400).json({
      success: false, code: 400,
      message: '该订单支付信息已过期，请取消后重新下单。给您带来不便敬请谅解。',
    });
  } catch (err) {
    logger.error('[orders] 重试支付失败:', err.message);
    res.status(500).json({ success: false, code: 500, message: err.message || '支付失败' });
  }
});

/**
 * POST /api/orders/:orderNo/cancel — 取消订单
 */
router.post('/:orderNo/cancel', async (req, res) => {
  try {
    const v = validateOrderNo(req.params.orderNo);
    if (!v.valid) return res.status(400).json({ success: false, code: 400, message: v.error });

    const result = await orderService.cancelOrder(req.params.orderNo, req.user.openid);
    res.json({ success: true, code: 200, data: result });
  } catch (err) {
    logger.error('[orders] 取消失败:', err.message);
    res.status(500).json({ success: false, code: 500, message: err.message || '取消订单失败' });
  }
});

module.exports = router;
