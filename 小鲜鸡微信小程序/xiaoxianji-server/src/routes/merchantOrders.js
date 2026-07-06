const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const logger = require('../utils/logger');
const prisma = require('../db');

/**
 * 订单状态机——允许的状态转换
 */
const STATE_TRANSITIONS = {
  paid: ['accepted', 'cancelled'],
  accepted: ['weighed', 'processing', 'cancelled'],
  weighed: ['processing', 'cancelled'],
  processing: ['ready', 'cancelled'],
  ready: ['delivering', 'completed'],
  delivering: ['completed'],
};

/**
 * 获取订单（含权限校验）
 */
async function getMerchantOrder(orderNo, merchantId) {
  const order = await prisma.order.findUnique({
    where: { orderNo },
    include: { items: true },
  });
  if (!order) return null;
  if (order.merchantId !== BigInt(merchantId)) return null;
  return order;
}

// ============================================================
// GET /api/merchant/orders — 商家订单列表
// ============================================================
router.get('/', auth({ requiredRole: ['merchant', 'admin'] }), async (req, res) => {
  try {
    const { status, type, page = 1, page_size = 20, start_date, end_date } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(page_size, 10) || 20));

    const where = { merchantId: req.user.merchantId };

    // 状态筛选（支持逗号分隔多状态）
    if (status) {
      const statuses = status.split(',').filter(Boolean);
      if (statuses.length > 0) where.status = { in: statuses };
    }
    if (type) where.type = type;

    // 日期筛选
    if (start_date || end_date) {
      where.createdAt = {};
      if (start_date) where.createdAt.gte = new Date(start_date);
      if (end_date) where.createdAt.lte = new Date(end_date + 'T23:59:59.999Z');
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: { items: true },
        orderBy: { createdAt: 'desc' },
        skip: (pageNum - 1) * pageSize,
        take: pageSize,
      }),
      prisma.order.count({ where }),
    ]);

    const list = orders.map((o) => ({
      ...o,
      id: Number(o.id),
      userId: o.userId ? Number(o.userId) : null,
      merchantId: Number(o.merchantId),
      items: (o.items || []).map((i) => ({ ...i, id: Number(i.id), orderId: Number(i.orderId) })),
    }));

    res.okPaginated(list, { page: pageNum, pageSize, total });
  } catch (err) {
    logger.error('getMerchantOrders错误:', err);
    res.failServerError('获取订单列表失败');
  }
});

// ============================================================
// POST /api/merchant/orders/:orderNo/:action — 状态流转
// ============================================================
router.post('/:orderNo/:action', auth({ requiredRole: ['merchant', 'admin'] }), async (req, res) => {
  try {
    const { orderNo, action } = req.params;
    const order = await getMerchantOrder(orderNo, req.user.merchantId);
    if (!order) return res.failNotFound('订单不存在');

    // 特殊 action 处理
    if (action === 'complete') {
      return handleComplete(order, res, req);
    }
    if (action === 'mark-paid') {
      return handleMarkPaid(order, res);
    }

    // 状态机校验
    const allowedNext = STATE_TRANSITIONS[order.status] || [];
    if (!allowedNext.includes(action)) {
      return res.fail(`不允许从 ${order.status} 变更为 ${action}`);
    }

    // 执行状态变更
    const updateData = { status: action };
    if (action === 'accepted') updateData.acceptTime = new Date();
    if (action === 'cancelled') updateData.cancelTime = new Date();

    const updated = await prisma.order.update({
      where: { orderNo },
      data: updateData,
    });

    logger.info(`订单${orderNo}: ${order.status} → ${action}`);
    res.ok({ status: updated.status });
  } catch (err) {
    logger.error(`订单状态变更错误(${req.params.orderNo}/${req.params.action}):`, err);
    res.failServerError('操作失败');
  }
});

// ============================================================
// POST /api/merchant/orders/:orderNo/complete — 完成订单
// ============================================================
async function handleComplete(order, res, req) {
  if (!['delivering', 'ready'].includes(order.status)) {
    return res.fail(`当前状态(${order.status})不允许完成`);
  }

  const updates = {
    status: 'completed',
    completeTime: new Date(),
  };

  await prisma.order.update({ where: { orderNo: order.orderNo }, data: updates });

  // 释放号码牌
  if (order.cardNumber) {
    await prisma.paiNumber.updateMany({
      where: { number: order.cardNumber, merchantId: order.merchantId },
      data: { status: 'idle', orderId: null },
    }).catch(() => {});
  }

  res.ok({ status: 'completed' });
}

// ============================================================
// POST /api/merchant/orders/:orderNo/mark-paid — 标记线下已付款
// ============================================================
async function handleMarkPaid(order, res) {
  // 仅线下未付款订单
  if (order.type !== 'offline') return res.fail('仅线下订单支持此操作');
  if (order.paymentMethod !== 'unpaid') return res.fail('该订单已标记付款');

  await prisma.order.update({
    where: { orderNo: order.orderNo },
    data: { paymentMethod: 'wechat', payTime: new Date() },
  });
  res.ok({ marked: true });
}

// ============================================================
// POST /api/merchant/offline-orders — 创建线下订单
// ============================================================
router.post('/offline-orders', auth({ requiredRole: ['merchant', 'admin'] }), async (req, res) => {
  try {
    const { amount, paymentMethod = 'cash', cardNumber } = req.body;
    if (!amount || amount <= 0) return res.fail('请输入金额');

    const merchantId = req.user.merchantId;

    // 生成线下订单号: B + YYMMDD + 3位流水
    const now = new Date();
    const datePart = now.toISOString().slice(2, 10).replace(/-/g, '').slice(2);
    const key = `offline_${datePart}`;
    const counter = await prisma.counter.upsert({
      where: { key },
      update: { value: { increment: 1 } },
      create: { key, value: 1 },
    });
    const orderNo = `B${datePart}${String(counter.value).padStart(3, '0')}`;

    // 绑定号码牌（如果提供）
    if (cardNumber) {
      const card = await prisma.paiNumber.findFirst({
        where: { merchantId, number: cardNumber, status: 'idle' },
      });
      if (!card) return res.fail('该号码牌不可用');
      await prisma.paiNumber.update({
        where: { id: card.id },
        data: { status: 'in_use', orderId: null },  // orderId会在order创建后更新
      });
    }

    const order = await prisma.order.create({
      data: {
        orderNo,
        merchantId,
        type: 'offline',
        status: 'paid',
        prepayAmount: amount,
        paymentMethod,
        cardNumber: cardNumber || null,
        payTime: paymentMethod !== 'unpaid' ? new Date() : null,
      },
    });

    logger.info(`线下订单: ${orderNo}, 金额: ${amount}分, 支付: ${paymentMethod}`);
    res.ok({ orderNo, cardNumber: cardNumber || null });
  } catch (err) {
    logger.error('createOfflineOrder错误:', err);
    res.failServerError('创建线下订单失败');
  }
});

module.exports = router;
