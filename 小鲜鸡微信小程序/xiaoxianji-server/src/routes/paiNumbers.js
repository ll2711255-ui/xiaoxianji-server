const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { auth } = require('../middleware/auth');
const logger = require('../utils/logger');
const prisma = new PrismaClient();

// GET /api/pai-numbers
router.get('/', async (req, res) => {
  try {
    const merchant = await prisma.merchant.findFirst();
    if (!merchant) return res.ok([]);
    const list = await prisma.paiNumber.findMany({
      where: { merchantId: merchant.id },
      orderBy: { number: 'asc' },
    });
    res.ok(list.map(p => ({ ...p, id: Number(p.id), merchantId: Number(p.merchantId), orderId: p.orderId ? Number(p.orderId) : null })));
  } catch (err) { logger.error('getPaiNumbers:', err); res.failServerError(); }
});

// POST /api/pai-numbers/:number/bind — 绑定号码牌
router.post('/:number/bind', auth({ requiredRole: ['merchant', 'admin'] }), async (req, res) => {
  try {
    const { orderNo } = req.body;
    const card = await prisma.paiNumber.findFirst({
      where: { merchantId: req.user.merchantId, number: req.params.number },
    });
    if (!card) return res.failNotFound('号码牌不存在');
    if (card.status !== 'idle') return res.fail('该号码牌已被占用');
    // 原子更新
    await prisma.paiNumber.updateMany({
      where: { id: card.id, status: 'idle' },
      data: { status: 'in_use', orderId: null },
    });
    if (orderNo) {
      await prisma.order.update({
        where: { orderNo },
        data: { cardNumber: req.params.number },
      });
    }
    res.ok({ bound: true });
  } catch (err) { logger.error('bindTag:', err); res.failServerError(); }
});

// POST /api/pai-numbers/:number/release — 释放号码牌
router.post('/:number/release', auth({ requiredRole: ['merchant', 'admin'] }), async (req, res) => {
  try {
    await prisma.paiNumber.updateMany({
      where: { merchantId: req.user.merchantId, number: req.params.number },
      data: { status: 'idle', orderId: null },
    });
    res.ok({ released: true });
  } catch (err) { logger.error('releaseTag:', err); res.failServerError(); }
});

module.exports = router;
