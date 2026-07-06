/**
 * 订单路由 /api/orders/*
 */
const router = require('express').Router();
const orderService = require('../services/order.service');
const wxpay = require('../utils/wxpay');
const config = require('../config');
const logger = require('../utils/logger');

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
    const { status, pageSize } = req.query;
    const orders = await orderService.getUserOrders(req.user.openid, { status, pageSize });
    res.json({ success: true, code: 200, data: { orders } });
  } catch (err) {
    logger.error('[orders] 列表查询失败:', err.message);
    res.status(500).json({ success: false, code: 500, message: err.message });
  }
});

/**
 * GET /api/orders/pay/status?orderNo=xxx — 查询支付状态
 */
router.get('/pay/status', async (req, res) => {
  try {
    const { orderNo } = req.query;
    if (!orderNo) {
      return res.status(400).json({ success: false, code: 400, message: '缺少订单号' });
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
    const order = await orderService.getOrderByNo(req.params.orderNo);
    if (!order) {
      return res.status(404).json({ success: false, code: 404, message: '订单不存在' });
    }
    // 仅允许查看自己的订单（除非是商家）
    if (order.user_id !== req.user.openid && req.user.role !== 'merchant') {
      return res.status(403).json({ success: false, code: 403, message: '无权查看此订单' });
    }
    res.json({ success: true, code: 200, data: order });
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
    const { mockPay, mockPaySuccess } = req.body;

    // ========== 模拟支付（开发环境） ==========
    if (mockPay && config.env !== 'production') {
      const order = await orderService.getOrderByNo(orderNo);
      if (!order) {
        return res.status(404).json({ success: false, code: 404, message: '订单不存在' });
      }
      if (order.status_label !== 'pending') {
        return res.status(400).json({ success: false, code: 400, message: `订单状态「${order.status_label}」不可模拟支付` });
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

    // ========== 真实重试支付：重新获取 prepay_id ==========
    const order = await orderService.getOrderByNo(orderNo);
    if (!order) {
      return res.status(404).json({ success: false, code: 404, message: '订单不存在' });
    }
    if (order.order_status !== 0) {
      return res.status(400).json({ success: false, code: 400, message: '订单已处理，不可重试支付' });
    }

    // 关闭旧的 prepay（如有）
    if (order.prepay_id) {
      await wxpay.closeOrder(orderNo).catch(() => {});
    }

    const result = await wxpay.jsapiPrepay({
      appid: config.wx.appId,
      out_trade_no: orderNo,
      total: order.pay_amount,
      openid: order.user_id,
      description: '小鲜鸡-新鲜生鲜',
      notify_url: config.notify.pay,
    });

    if (!result.success) {
      return res.status(500).json({ success: false, code: 500, message: result.error });
    }

    const payment = wxpay.buildPayParams(result.prepay_id, config.wx.appId);

    await require('../config/db').execute(
      'UPDATE order_info SET prepay_id = ? WHERE order_no = ?',
      [result.prepay_id, orderNo]
    );
    await require('../config/db').execute(
      'UPDATE payment_record SET prepay_id = ? WHERE order_no = ?',
      [result.prepay_id, orderNo]
    );

    res.json({ success: true, code: 200, data: { orderNo, payment } });
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
    const result = await orderService.cancelOrder(req.params.orderNo, req.user.openid);
    res.json({ success: true, code: 200, data: result });
  } catch (err) {
    logger.error('[orders] 取消失败:', err.message);
    res.status(500).json({ success: false, code: 500, message: err.message || '取消订单失败' });
  }
});

module.exports = router;
