/**
 * 商家端路由 /api/merchant/*
 *
 * 所有接口统一鉴权：verifyToken + requireMerchant
 * 账号管理路由已独立到 merchant-account.routes.js
 */
const router = require('express').Router();
const db = require('../config/db');
const weighService = require('../services/weigh.service');
const wxpay = require('../utils/wxpay');
const logger = require('../utils/logger');
const { validateOrderNo } = require('../utils/validate');
const { verifyToken, requireMerchant, requireRole } = require('../middleware/auth');

// ========== 全局商家鉴权 ==========
// 所有 /api/merchant/* 接口必须通过 JWT 验证 + 来源校验
router.use(verifyToken, requireMerchant);

// ========== 订单状态流转规则 ==========
// 每个 action 的前置条件：订单必须在对应状态才能执行
const STATE_RULES = {
  accept:   { require: ['paid'],       nextLabel: 'accepted' },
  process:  { require: ['accepted', 'weighed', 'pending'], nextLabel: 'processing' },
  ready:    { require: ['processing', 'weighed'], nextLabel: 'ready' },
  deliver:  { require: ['ready'],      nextLabel: 'delivering', requireType: 'delivery' },
  complete: { require: ['delivering', 'ready'], nextLabel: 'completed', nextStatus: 3 },
  'mark-paid': { require: ['ready'],      nextLabel: 'paid',      nextStatus: 1 },
};

/**
 * GET /api/merchant/orders — 商家订单列表
 */
router.get('/orders', async (req, res) => {
  try {
    const { status, type, dateFrom, dateTo, page = 1, pageSize = 50 } = req.query;
    let sql = 'SELECT * FROM order_info WHERE is_deleted = 0';
    const params = [];

    if (status) {
      const statuses = status.split(',');
      sql += ` AND status_label IN (${statuses.map(() => '?').join(',')})`;
      params.push(...statuses);
    }
    if (type) {
      const types = type.split(',');
      sql += ` AND type IN (${types.map(() => '?').join(',')})`;
      params.push(...types);
    }
    if (dateFrom) {
      sql += ' AND create_time >= ?';
      params.push(dateFrom);
    }
    if (dateTo) {
      sql += ' AND create_time <= ?';
      params.push(dateTo + ' 23:59:59');
    }

    const offset = (parseInt(page, 10) - 1) * parseInt(pageSize, 10);
    sql += ' ORDER BY create_time DESC LIMIT ? OFFSET ?';
    params.push(parseInt(pageSize, 10), Math.max(0, offset));

    const orders = await db.query(sql, params);
    res.json({ success: true, code: 200, data: { orders } });
  } catch (err) {
    logger.error('[merchant] 订单列表失败:', err.message);
    res.status(500).json({ success: false, code: 500, message: err.message });
  }
});

/**
 * GET /api/merchant/orders/:orderNo — 商家端订单详情
 * 返回单个订单完整信息（商品明细、配送地址、支付信息等）
 */
router.get('/orders/:orderNo', async (req, res) => {
  try {
    const { orderNo } = req.params;
    const v = validateOrderNo(orderNo);
    if (!v.valid) return res.status(400).json({ success: false, code: 400, message: v.error });

    const order = await db.queryOne(
      'SELECT * FROM order_info WHERE order_no = ? AND is_deleted = 0',
      [orderNo]
    );
    if (!order) {
      return res.status(404).json({ success: false, code: 404, message: '订单不存在' });
    }

    res.json({ success: true, code: 200, data: { order } });
  } catch (err) {
    logger.error('[merchant] 订单详情失败:', err.message);
    res.status(500).json({ success: false, code: 500, message: err.message });
  }
});

/**
 * POST /api/merchant/offline-orders — 创建线下订单
 */
router.post('/offline-orders', async (req, res) => {
  try {
    const { items, type, cardNumber, paymentType, deliveryAddress, amount } = req.body;
    const { generateOrderNo } = require('../utils/idGenerator');
    const { calculatePrice } = require('../services/pricing.service');

    let totalFen, validatedItems;
    if (amount && (!items || items.length === 0)) {
      // 收银台手动输入金额模式（无商品明细，直接使用传入金额）
      totalFen = parseInt(amount, 10);
      validatedItems = [];
    } else {
      const result = await calculatePrice(items || []);
      totalFen = result.totalFen;
      validatedItems = result.validatedItems;
    }
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
    logger.error('[merchant] 称重失败:', err.message || err, err);
    res.status(500).json({ success: false, code: 500, message: err.message || err.sqlMessage || '称重失败' });
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
    logger.error('[merchant] 退款重试失败:', err.message || err, err);
    res.status(500).json({ success: false, code: 500, message: err.message || err.sqlMessage || '退款失败' });
  }
});

/**
 * POST /api/merchant/orders/:orderNo/cancel-accept — 商家取消接单
 *
 * 仅允许在 paid 状态下执行（用户已支付但商家尚未接单）
 * 执行后全额退款给用户
 */
router.post('/orders/:orderNo/cancel-accept', async (req, res) => {
  try {
    const { orderNo } = req.params;

    const { cancelOrder } = require('../services/order-cancel.service');
    const result = await cancelOrder({
      orderNo,
      cancelBy: 'merchant',
      cancelReason: req.body.reason || '商家取消接单',
      operatorId: req.user.id,
    });

    // 写操作日志（非关键路径）
    try {
      await db.execute(
        `INSERT INTO merchant_operation_log
         (operator_id, operator_name, action, target_id, target_name, detail)
         VALUES (?, ?, 'cancel_accept', ?, ?, ?)`,
        [
          String(req.user.id),
          req.user.displayName || '',
          orderNo,
          JSON.stringify({ reason: req.body.reason || '商家取消接单', refundAmount: result.refundAmount }),
        ]
      );
    } catch (logErr) {
      logger.warn('[merchant] 操作日志写入失败:', logErr.message);
    }

    res.json({ success: true, code: 200, ...result });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ success: false, code: err.status, message: err.message });
    }
    logger.error('[merchant] 取消接单失败:', err.message);
    res.status(500).json({ success: false, code: 500, message: '操作失败，请稍后重试' });
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
    if (!rule.require.includes(order.status)) {
      return res.status(400).json({
        success: false, code: 400,
        message: `订单状态「${order.status}」不允许执行此操作，请先完成上一步`,
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
      deliver: 'deliver_time', complete: 'complete_time', 'mark-paid': 'pay_time',
    };
    const timeField = timeFieldMap[action];
    if (timeField) {
      updates.push(`${timeField} = NOW()`);
    }

    // 状态前置条件：UPDATE 带 status_label 防 TOCTOU 竞态
    // 支持多个前置状态（如 complete 可在 delivering 或 ready 状态执行）
    params.push(orderNo);              // WHERE order_no = ?
    const whereStatusPlaceholders = rule.require.map(() => '?').join(', ');
    params.push(...rule.require);      // WHERE status_label IN (...)

    const affectedRows = await db.execute(
      `UPDATE order_info SET ${updates.join(', ')} WHERE order_no = ? AND status_label IN (${whereStatusPlaceholders})`,
      params
    );

    if (affectedRows === 0) {
      return res.status(409).json({
        success: false, code: 409,
        message: '订单状态已变更，请刷新页面后重试',
      });
    }

    logger.info(`[merchant] ${action} → ${orderNo} (${order.status} → ${rule.nextLabel})`);

    // ===== 发货/完成时上报微信「订单发货管理」=====
    // 微信 2025 年强制新规：实物电商发货后必须调此接口上报，
    // 否则资金冻结无法结算
    const shouldReportShip = (
      (action === 'deliver' && order.type === 'delivery') ||
      (action === 'complete' && order.type === 'pickup')
    );
    let fullOrder = null;
    if (shouldReportShip) {
      fullOrder = await db.queryOne(
        'SELECT transaction_id, delivery_address FROM order_info WHERE order_no = ?',
        [orderNo]
      );
      if (fullOrder && fullOrder.transactionId) {
        const deliveryType = order.type === 'delivery' ? 'delivery' : 'pickup';
        const deliveryInfo = {
          type: deliveryType,
          deliverTime: new Date().toISOString(),
          deliveredBy: req.user.openid,
        };
        const shipResult = await wxpay.uploadShippingInfo({
          outTradeNo: orderNo,
          transactionId: fullOrder.transactionId,
          deliveryType,
          deliverBy: req.user.openid,
        });
        await db.execute(
          'UPDATE order_info SET delivery_info = ?, shipping_uploaded = ?, shipping_log = ? WHERE order_no = ?',
          [
            JSON.stringify(deliveryInfo),
            shipResult.success ? 1 : 2,
            JSON.stringify(shipResult),
            orderNo,
          ]
        );
        if (shipResult.success) {
          logger.info(`[merchant] 微信发货上报成功: ${orderNo}`);
        } else {
          logger.warn(`[merchant] ⚠️ 微信发货上报失败: ${orderNo}`, shipResult.error);
        }
      } else {
        logger.warn(`[merchant] ⚠️ 订单 ${orderNo} 缺少 transaction_id，跳过发货上报`);
      }
    }

    // ===== 发货时上传配送信息到微信「购物订单」=====
    if (action === 'deliver') {
      const { updateShippingOnDeliver } = require('../utils/wxShipping');
      updateShippingOnDeliver(orderNo).catch(
        e => logger.error('[merchant] 购物订单配送上报异常:', e.message)
      );

      // ===== 通知微信触发「确认收货」提醒（加速资金结算）=====
      const txId = fullOrder ? fullOrder.transactionId : null;
      if (txId) {
        const { notifyConfirmReceive: notifyConfirm } = require('../utils/wxTrade');
        notifyConfirm({
          orderNo,
          transactionId: txId,
          receiveTime: new Date().toISOString(),
        }).catch(e => logger.error('[merchant] 确认收货通知异常:', e.message));
      }
    }

    res.json({ success: true, code: 200, message: '操作成功' });
  } catch (err) {
    logger.error(`[merchant] 操作失败: ${err.message || '(无错误信息)'}`, err);
    res.status(500).json({ success: false, code: 500, message: err.message || err.sqlMessage || '服务器内部错误' });
  }
});

// ====== 微信购物订单路径配置（管理员专用）======

/**
 * POST /api/merchant/wx-order-path/setup — 配置订单详情跳转路径
 */
router.post('/wx-order-path/setup', async (req, res) => {
  try {
    const { getAccessToken } = require('../utils/wechat');
    const { updateOrderDetailPath } = require('../utils/wxOrderPath');
    const token = await getAccessToken();
    const result = await updateOrderDetailPath(token);
    res.json({ success: true, code: 200, data: result });
  } catch (err) {
    logger.error('[merchant] 配置订单路径失败:', err.message);
    res.status(500).json({ success: false, code: 500, message: err.message });
  }
});

/**
 * GET /api/merchant/wx-order-path — 查询当前订单详情跳转路径
 */
router.get('/wx-order-path', async (req, res) => {
  try {
    const { getAccessToken } = require('../utils/wechat');
    const { getOrderDetailPath } = require('../utils/wxOrderPath');
    const token = await getAccessToken();
    const result = await getOrderDetailPath(token);
    res.json({ success: true, code: 200, data: result });
  } catch (err) {
    logger.error('[merchant] 查询订单路径失败:', err.message);
    res.status(500).json({ success: false, code: 500, message: err.message });
  }
});

// ====== 微信发货管理接口（管理员专用）======

/**
 * POST /api/merchant/wx-trade/check — 查询小程序是否已开通发货管理服务
 */
router.post('/wx-trade/check', requireRole('admin'), async (req, res) => {
  try {
    const { isTradeManaged } = require('../utils/wxTrade');
    const result = await isTradeManaged();
    res.json({
      success: true,
      code: 200,
      data: {
        isManaged: result.is_trade_managed || false,
        raw: result,
      },
    });
  } catch (err) {
    logger.error('[merchant] 查询发货管理状态失败:', err.message);
    res.status(500).json({ success: false, code: 500, message: err.message });
  }
});

/**
 * POST /api/merchant/wx-trade/set-msg-path — 配置消息跳转路径
 *
 * Body: { path } — 可选，默认值 'pages/orders/detail/detail'
 */
router.post('/wx-trade/set-msg-path', requireRole('admin'), async (req, res) => {
  try {
    const { path = 'pages/orders/detail/detail' } = req.body;
    const { setMsgJumpPath } = require('../utils/wxTrade');
    const result = await setMsgJumpPath(path);
    if (result.errcode === 0) {
      res.json({ success: true, code: 200, message: '消息跳转路径配置成功', data: { path } });
    } else {
      res.json({ success: false, code: 500, message: `配置失败: errcode=${result.errcode} ${result.errmsg || ''}` });
    }
  } catch (err) {
    logger.error('[merchant] 配置消息跳转路径失败:', err.message);
    res.status(500).json({ success: false, code: 500, message: err.message });
  }
});

/**
 * POST /api/merchant/wx-trade/notify-confirm — 提醒用户确认收货
 *
 * Body: { orderNo }
 */
router.post('/wx-trade/notify-confirm', async (req, res) => {
  try {
    const { orderNo } = req.body;
    if (!orderNo) {
      return res.status(400).json({ success: false, code: 400, message: '缺少 orderNo 参数' });
    }

    // 查询订单获取 transaction_id
    const order = await db.queryOne(
      'SELECT transaction_id, type, status FROM order_info WHERE order_no = ?',
      [orderNo]
    );
    if (!order) {
      return res.status(404).json({ success: false, code: 404, message: '订单不存在' });
    }
    if (!order.transactionId) {
      return res.status(400).json({ success: false, code: 400, message: '该订单无微信支付流水号' });
    }

    const { notifyConfirmReceive } = require('../utils/wxTrade');
    const result = await notifyConfirmReceive({
      orderNo,
      transactionId: order.transactionId,
      receiveTime: new Date().toISOString(),
    });

    if (result.errcode === 0) {
      logger.info(`[merchant] 确认收货提醒已发送: ${orderNo}`);
      res.json({ success: true, code: 200, message: '确认收货提醒已发送' });
    } else {
      res.json({ success: false, code: 500, message: `提醒失败: errcode=${result.errcode} ${result.errmsg || ''}` });
    }
  } catch (err) {
    logger.error('[merchant] 确认收货提醒失败:', err.message);
    res.status(500).json({ success: false, code: 500, message: err.message });
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

/**
 * GET /api/merchant/products — 商家端商品列表（支持关键词搜索）
 * 挂载在 /api/merchant 下，自带 verifyToken + requireMerchant 鉴权
 */
router.get('/products', async (req, res) => {
  try {
    const { keyword, page = 1, pageSize = 50 } = req.query;
    let sql = 'SELECT * FROM products WHERE 1=1';
    const params = [];

    if (keyword) {
      sql += ' AND (name LIKE ? OR selling_point LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`);
    }

    const offset = (parseInt(page, 10) - 1) * parseInt(pageSize, 10);
    sql += ' ORDER BY sales DESC LIMIT ? OFFSET ?';
    params.push(parseInt(pageSize, 10), Math.max(0, offset));

    const products = await db.query(sql, params);
    res.json({ success: true, code: 200, data: { products } });
  } catch (err) {
    logger.error('[merchant] 商品列表失败:', err.message);
    res.status(500).json({ success: false, code: 500, message: err.message });
  }
});

module.exports = router;
