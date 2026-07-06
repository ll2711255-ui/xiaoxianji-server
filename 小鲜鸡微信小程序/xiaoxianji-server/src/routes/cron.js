const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');
const prisma = new PrismaClient();

// GET /api/cron/clean-expired-orders（定时任务：清理过期订单）
router.get('/clean-expired-orders', async (req, res) => {
  try {
    const threshold = new Date(Date.now() - 30 * 60 * 1000); // 30分钟
    const expired = await prisma.order.findMany({
      where: { status: 'pending', createdAt: { lt: threshold } },
      select: { orderNo: true, cardNumber: true, merchantId: true },
    });
    for (const order of expired) {
      await prisma.order.update({ where: { orderNo: order.orderNo }, data: { status: 'cancelled', cancelTime: new Date() } });
      if (order.cardNumber) {
        await prisma.paiNumber.updateMany({ where: { merchantId: order.merchantId, number: order.cardNumber }, data: { status: 'idle', orderId: null } });
      }
    }
    res.ok({ cleaned: expired.length, orderNos: expired.map(o => o.orderNo) });
  } catch (err) { logger.error('cleanExpiredOrders:', err); res.failServerError(); }
});

module.exports = router;
