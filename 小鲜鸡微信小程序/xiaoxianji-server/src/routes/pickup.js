const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');

const prisma = new PrismaClient();
const TOKEN_SECRET = process.env.TOKEN_SECRET || crypto.randomBytes(32).toString('hex');

/**
 * 验证取货 token
 */
function verifyToken(orderNo, token) {
  const expected = crypto.createHash('sha256')
    .update(orderNo + TOKEN_SECRET)
    .digest('hex')
    .substring(0, 8);
  return expected === token;
}

// ============================================================
// GET /api/pickup/status/:orderNo?token=xxx
// ============================================================
router.get('/status/:orderNo', async (req, res) => {
  try {
    const { orderNo } = req.params;
    const { token } = req.query;

    if (!token || !verifyToken(orderNo, token)) {
      return res.json({ success: false, error: '无效的取货码', status: 'invalid' });
    }

    const order = await prisma.order.findUnique({ where: { orderNo } });
    if (!order) {
      return res.json({ success: false, error: '订单不存在', status: 'invalid' });
    }

    // 简化状态映射
    let status = 'pending';
    if (order.status === 'completed') {
      status = 'completed';
    } else if (['ready', 'delivering'].includes(order.status)) {
      status = 'ready';
    } else {
      status = 'processing';
    }

    res.ok({
      status,
      orderStatus: order.status,
      cardNumber: order.cardNumber,
      orderNo: order.orderNo,
    });
  } catch (err) {
    logger.error('getPickupStatus错误:', err);
    res.failServerError('查询失败');
  }
});

// ============================================================
// POST /api/pickup/confirm — 确认取货
// ============================================================
router.post('/confirm', async (req, res) => {
  try {
    const { orderNo, token } = req.body;
    if (!orderNo || !token) return res.fail('缺少参数');

    if (!verifyToken(orderNo, token)) {
      return res.fail('取货码无效', 'INVALID_TOKEN');
    }

    const order = await prisma.order.findUnique({ where: { orderNo } });
    if (!order) return res.failNotFound('订单不存在');

    if (order.status !== 'ready' && order.status !== 'delivering') {
      return res.fail(`当前状态(${order.status})不允许取货`);
    }

    // 完成订单
    await prisma.order.update({
      where: { orderNo },
      data: { status: 'completed', completeTime: new Date() },
    });

    // 释放号码牌
    if (order.cardNumber) {
      await prisma.paiNumber.updateMany({
        where: { number: order.cardNumber, merchantId: order.merchantId },
        data: { status: 'idle', orderId: null },
      });
    }

    logger.info(`取货确认: ${orderNo}`);
    res.ok({ confirmed: true });
  } catch (err) {
    logger.error('confirmPickup错误:', err);
    res.failServerError('确认取货失败');
  }
});

module.exports = router;
