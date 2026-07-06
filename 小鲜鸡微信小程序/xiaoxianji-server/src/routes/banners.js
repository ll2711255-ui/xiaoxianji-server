const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { auth } = require('../middleware/auth');
const logger = require('../utils/logger');
const prisma = new PrismaClient();

// GET /api/banners — 轮播图列表
router.get('/', async (req, res) => {
  try {
    const merchant = await prisma.merchant.findFirst();
    if (!merchant) return res.ok([]);
    const where = { merchantId: merchant.id };
    if (req.query.active === '1') where.status = 'on';
    const banners = await prisma.banner.findMany({ where, orderBy: { sort: 'asc' } });
    res.ok(banners.map(b => ({ ...b, id: Number(b.id), merchantId: Number(b.merchantId) })));
  } catch (err) { logger.error('getBanners:', err); res.failServerError(); }
});

// PUT /api/banners — 全量替换（商家）
router.put('/', auth({ requiredRole: ['merchant', 'admin'] }), async (req, res) => {
  try {
    const { banners } = req.body;
    if (!Array.isArray(banners)) return res.fail('banners 必须为数组');
    const merchantId = req.user.merchantId;
    // 事务：删旧增新
    await prisma.$transaction(async (tx) => {
      await tx.banner.deleteMany({ where: { merchantId } });
      if (banners.length > 0) {
        await tx.banner.createMany({
          data: banners.map((b, i) => ({
            merchantId,
            image: b.image || '',
            link: b.link || '',
            sort: b.sort ?? i,
            status: b.status || 'on',
          })),
        });
      }
    });
    res.ok({ updated: true, count: banners.length });
  } catch (err) { logger.error('saveBanners:', err); res.failServerError(); }
});

module.exports = router;
