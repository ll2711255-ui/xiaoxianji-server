/**
 * 商家端路由 /api/merchant/*
 */
const router = require('express').Router();
const db = require('../config/db');
const weighService = require('../services/weigh.service');
const wxpay = require('../utils/wxpay');
const logger = require('../utils/logger');

/**
 * GET /api/merchant/orders — 商家订单列表
 */
router.get('/orders', async (req, res) => {
  try {
    const { status, type, dateFrom, dateTo, pageSize = 50 } = req.query;
    let sql = 'SELECT * FROM order_info WHERE is_deleted = 0';
    const params = [];

    if (status) {
      const statuses = status.split(',');
      sql += ` AND status_label IN (${statuses.map(() => '?').join(',')})`;
      params.push(...statuses);
    }
    if (type) {
      sql += ' AND type = ?';
      params.push(type);
    }
    if (dateFrom) {
      sql += ' AND create_time >= ?';
      params.push(dateFrom);
    }
    if (dateTo) {
      sql += ' AND create_time <= ?';
      params.push(dateTo + ' 23:59:59');
    }

    sql += ' ORDER BY create_time DESC LIMIT ?';
    params.push(parseInt(pageSize, 10));

    const orders = await db.query(sql, params);
    res.json({ success: true, code: 200, data: { orders } });
  } catch (err) {
    logger.error('[merchant] 订单列表失败:', err.message);
    res.status(500).json({ success: false, code: 500, message: err.message });
  }
});

/**
 * POST /api/merchant/offline-orders — 创建线下订单
 */
router.post('/offline-orders', async (req, res) => {
  try {
    const { items, type, cardNumber, paymentType, deliveryAddress } = req.body;
    const { generateOrderNo } = require('../utils/idGenerator');
    const { calculatePrice } = require('../services/pricing.service');

    const { totalFen, validatedItems } = await calculatePrice(items || []);
    const orderNo = await generateOrderNo();

    await db.insert(
      `INSERT INTO order_info
       (order_no, user_id, type, order_status, status_label, items, total_amount, pay_amount,
        card_number, payment_type, delivery_address, expire_time)
       VALUES (?, 'offline', 'offline', 3, 'processing', ?, ?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 1 DAY))`,
      [
        orderNo,
        JSON.stringify(validatedItems),
        totalFen, totalFen,
        cardNumber || '',
        paymentType || 'wechat',
        deliveryAddress ? JSON.stringify(deliveryAddress) : null,
      ]
    );

    res.json({ success: true, code: 200, data: { orderNo } });
  } catch (err) {
    logger.error('[merchant] 线下订单创建失败:', err.message);
    res.status(500).json({ success: false, code: 500, message: err.message });
  }
});

/**
 * POST /api/merchant/orders/:orderNo/:action — 商家操作
 * action: accept | process | ready | deliver | complete | markPaid
 */
router.post('/orders/:orderNo/:action', async (req, res) => {
  try {
    const { orderNo, action } = req.params;

    const actionMap = {
      accept: { status_label: 'accepted', timeField: 'accept_time' },
      process: { status_label: 'processing', timeField: 'process_time' },
      ready: { status_label: 'ready', timeField: 'ready_time' },
      deliver: { status_label: 'delivering', timeField: 'deliver_time' },
      complete: { status_label: 'completed', timeField: 'complete_time', order_status: 3 },
      markPaid: { order_status: 1, status_label: 'paid', timeField: 'pay_time' },
    };

    const mapping = actionMap[action];
    if (!mapping) {
      return res.status(400).json({ success: false, code: 400, message: '未知操作' });
    }

    const updates = [];
    const params = [];

    if (mapping.status_label) {
      updates.push("status_label = ?");
      params.push(mapping.status_label);
    }
    if (mapping.order_status !== undefined) {
      updates.push("order_status = ?");
      params.push(mapping.order_status);
    }
    if (mapping.timeField) {
      updates.push(`${mapping.timeField} = NOW()`);
    }

    params.push(orderNo);
    await db.execute(
      `UPDATE order_info SET ${updates.join(', ')} WHERE order_no = ?`,
      params
    );

    res.json({ success: true, code: 200, message: '操作成功' });
  } catch (err) {
    logger.error(`[merchant] 操作失败:`, err.message);
    res.status(500).json({ success: false, code: 500, message: err.message });
  }
});

/**
 * POST /api/merchant/orders/:orderNo/weigh — 称重提交
 */
router.post('/orders/:orderNo/weigh', async (req, res) => {
  try {
    const { orderNo } = req.params;
    const { actualWeight, weighPhoto, cardNumber } = req.body;

    if (!actualWeight || actualWeight <= 0) {
      return res.status(400).json({ success: false, code: 400, message: '缺少实际重量' });
    }

    const result = await weighService.handleWeigh({
      orderNo,
      actualWeight,
      weighPhoto,
      cardNumber,
      staffId: req.user.openid,
    });

    if (result.success) {
      res.json({ success: true, code: 200, data: result });
    } else {
      res.status(400).json({ success: false, code: 400, message: result.error });
    }
  } catch (err) {
    logger.error('[merchant] 称重失败:', err.message);
    res.status(500).json({ success: false, code: 500, message: err.message || '称重失败' });
  }
});

/**
 * POST /api/merchant/orders/:orderNo/refund — 商家退款（重试失败退款）
 */
router.post('/orders/:orderNo/refund', async (req, res) => {
  try {
    const { orderNo } = req.params;
    const { actualWeight } = req.body;

    const result = await weighService.handleWeigh({
      orderNo,
      actualWeight,
      staffId: req.user.openid,
      isRetry: true,
    });

    if (result.success) {
      res.json({ success: true, code: 200, data: result });
    } else {
      res.status(400).json({ success: false, code: 400, message: result.error });
    }
  } catch (err) {
    logger.error('[merchant] 退款重试失败:', err.message);
    res.status(500).json({ success: false, code: 500, message: err.message || '退款失败' });
  }
});

module.exports = router;
