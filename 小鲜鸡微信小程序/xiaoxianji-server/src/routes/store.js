const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { auth } = require('../middleware/auth');
const logger = require('../utils/logger');
const prisma = new PrismaClient();

// GET /api/store/config
router.get('/config', async (req, res) => {
  try {
    const merchant = await prisma.merchant.findFirst({
      select: { id: true, name: true, address: true, lat: true, lng: true, deliveryRadius: true, contactName: true, contactPhone: true, openTime: true, closeTime: true },
    });
    if (!merchant) return res.ok({});
    res.ok({ ...merchant, id: Number(merchant.id) });
  } catch (err) { logger.error('getStoreConfig:', err); res.failServerError(); }
});

// PUT /api/store/config（商家）
router.put('/config', auth({ requiredRole: ['merchant', 'admin'] }), async (req, res) => {
  try {
    const allowed = ['name', 'address', 'lat', 'lng', 'deliveryRadius', 'contactName', 'contactPhone', 'openTime', 'closeTime'];
    const data = {};
    for (const key of allowed) if (req.body[key] !== undefined) data[key] = req.body[key];
    await prisma.merchant.update({ where: { id: req.user.merchantId }, data });
    res.ok({ updated: true });
  } catch (err) { logger.error('updateStoreConfig:', err); res.failServerError(); }
});

module.exports = router;
