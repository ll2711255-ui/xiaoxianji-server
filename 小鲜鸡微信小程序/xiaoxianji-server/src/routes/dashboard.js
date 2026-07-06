const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { auth } = require('../middleware/auth');
const logger = require('../utils/logger');
const prisma = new PrismaClient();

// GET /api/dashboard/stats
router.get('/stats', auth({ requiredRole: ['merchant', 'admin'] }), async (req, res) => {
  try {
    const mid = req.user.merchantId;
    const [pending, active, completed, todayOrders] = await Promise.all([
      prisma.order.count({ where: { merchantId: mid, status: 'paid' } }),
      prisma.order.count({ where: { merchantId: mid, status: { in: ['accepted', 'weighed', 'processing', 'ready', 'delivering'] } } }),
      prisma.order.count({ where: { merchantId: mid, status: 'completed' } }),
      prisma.order.aggregate({
        where: { merchantId: mid, createdAt: { gte: new Date(new Date().toDateString()) } },
        _sum: { prepayAmount: true },
        _count: true,
      }),
    ]);
    res.ok({ pending, active, completed, todayRevenue: todayOrders._sum.prepayAmount || 0, todayCount: todayOrders._count });
  } catch (err) { logger.error('dashboardStats:', err); res.failServerError(); }
});

module.exports = router;
