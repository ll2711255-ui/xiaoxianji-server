/**
 * 商家端路由 /api/merchant/*
 */
const router = require('express').Router();
const db = require('../config/db');
const weighService = require('../services/weigh.service');
const wxpay = require('../utils/wxpay');
const logger = require('../utils/logger');
const { validateOrderNo } = require('../utils/validate');

// ========== 订单状态流转规则 ==========
// 每个 action 的前置条件：订单必须在对应状态才能执行
const STATE_RULES = {
  accept:   { require: ['paid'],       nextLabel: 'accepted' },
  process:  { require: ['weighed'],    nextLabel: 'processing' },
  ready:    { require: ['processing'], nextLabel: 'ready' },
  deliver:  { require: ['ready'],      nextLabel: 'delivering', requireType: 'delivery' },
  complete: { require: ['delivering', 'ready'], nextLabel: 'completed', nextStatus: 3 },
  markPaid: { require: ['ready'],      nextLabel: 'paid',      nextStatus: 1 },
};

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
 *
 * 每次操作都会校验：
 *   1. 订单是否存在
 *   2. 当前状态 → 目标状态是否合法（防跳过流程）
 *   3. 配送操作需匹配订单类型
 */
router.post('/orders/:orderNo/:action', async (req, res) => {
  try {
    const { orderNo, action } = req.params;
    const rule = STATE_RULES[action];

    if (!rule) {
      return res.status(400).json({ success: false, code: 400, message: '未知操作' });
    }

    const v = validateOrderNo(orderNo);
    if (!v.valid) return res.status(400).json({ success: false, code: 400, message: v.error });

    // 查订单当前状态
    const order = await db.queryOne(
      'SELECT order_no, status_label, type FROM order_info WHERE order_no = ?',
      [orderNo]
    );
    if (!order) {
      return res.status(404).json({ success: false, code: 404, message: '订单不存在' });
    }

    // 状态校验：当前状态必须在允许列表中
    if (!rule.require.includes(order.status_label)) {
      return res.status(400).json({
        success: false, code: 400,
        message: `订单状态「${order.status_label}」不允许执行此操作，请先完成上一步`,
      });
    }

    // 订单类型校验
    if (rule.requireType && order.type !== rule.requireType) {
      return res.status(400).json({
        success: false, code: 400,
        message: `此操作仅适用于「${rule.requireType === 'delivery' ? '配送' : '自取'}」订单`,
      });
    }

    // 通过校验 → 执行状态更新（原子条件：加 status_label 防止 TOCTOU 竞态）
    const updates = [];
    const params = [];

    if (rule.nextLabel) {
      updates.push('status_label = ?');
      params.push(rule.nextLabel);
    }
    if (rule.nextStatus !== undefined) {
      updates.push('order_status = ?');
      params.push(rule.nextStatus);
    }

    // 时间戳字段（标记操作时间）
    const timeFieldMap = {
      accept: 'accept_time', process: 'process_time', ready: 'ready_time',
      deliver: 'deliver_time', complete: 'complete_time', markPaid: 'pay_time',
    };
    const timeField = timeFieldMap[action];
    if (timeField) {
      updates.push(`${timeField} = NOW()`);
    }

    // 构建状态前置条件：单状态用 =，多状态用 IN（如 complete 可从 delivering/ready 执行）
    const requireStates = rule.require;
    let statusCondition;
    if (requireStates.length === 1) {
      statusCondition = 'status_label = ?';
    } else {
      statusCondition = `status_label IN (${requireStates.map(() => '?').join(', ')})`;
    }
    params.push(...requireStates);  // 状态条件参数
    params.push(orderNo);           // WHERE 最后一个参数

    const [updateResult] = await db.execute(
      `UPDATE order_info SET ${updates.join(', ')} WHERE order_no = ? AND ${statusCondition}`,
      params
    );

    if (updateResult.affectedRows === 0) {
      return res.status(409).json({
        success: false, code: 409,
        message: '订单状态已变更，请刷新页面',
      });
    }

    logger.info(`[merchant] ${action} → ${orderNo} (${order.status_label} → ${rule.nextLabel})`);

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

/**
 * GET /api/merchant/refund-alerts — 退款告警列表/计数
 *
 * 供 PC 商家端首页「待处理退款」角标使用
 * ?type=count → 只返回未处理数量；?type=list → 返回详细列表
 */
router.get('/refund-alerts', async (req, res) => {
  try {
    const { type = 'count' } = req.query;

    if (type === 'count') {
      const row = await db.queryOne(
        "SELECT COUNT(*) AS count FROM refund_alert WHERE status = 0"
      );
      res.json({ success: true, code: 200, data: { count: row ? row.count : 0 } });
    } else {
      const alerts = await db.query(
        "SELECT * FROM refund_alert WHERE status = 0 ORDER BY create_time DESC LIMIT 50"
      );
      res.json({ success: true, code: 200, data: { alerts } });
    }
  } catch (err) {
    logger.error('[merchant] 退款告警查询失败:', err.message);
    res.status(500).json({ success: false, code: 500, message: err.message });
  }
});

/**
 * PATCH /api/merchant/refund-alerts/:id — 标记告警为已处理/已忽略
 */
router.patch('/refund-alerts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status = 1 } = req.body; // 1=已处理, 2=已忽略

    if (![1, 2].includes(status)) {
      return res.status(400).json({ success: false, code: 400, message: '无效状态' });
    }

    await db.execute(
      'UPDATE refund_alert SET status = ?, resolved_by = ?, resolved_at = NOW() WHERE id = ?',
      [status, req.user.openid, id]
    );

    res.json({ success: true, code: 200, message: '已更新' });
  } catch (err) {
    logger.error('[merchant] 退款告警更新失败:', err.message);
    res.status(500).json({ success: false, code: 500, message: err.message });
  }
});

module.exports = router;
