const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { auth } = require('../middleware/auth');
const logger = require('../utils/logger');
const prisma = new PrismaClient();

// GET /api/addresses
router.get('/', auth(), async (req, res) => {
  try {
    const list = await prisma.address.findMany({
      where: { userId: req.user.userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
    res.ok(list.map(a => ({ ...a, id: Number(a.id), userId: Number(a.userId) })));
  } catch (err) { logger.error('getAddresses:', err); res.failServerError(); }
});

// POST /api/addresses
router.post('/', auth(), async (req, res) => {
  try {
    const { name, phone, province, city, district, detail, isDefault } = req.body;
    if (!name || !phone || !detail) return res.fail('姓名、电话、详细地址为必填项');
    const count = await prisma.address.count({ where: { userId: req.user.userId } });
    const data = {
      userId: req.user.userId, name, phone,
      province: province || '', city: city || '', district: district || '',
      detail, isDefault: isDefault || count === 0,
    };
    if (data.isDefault) {
      await prisma.address.updateMany({ where: { userId: req.user.userId }, data: { isDefault: false } });
    }
    const addr = await prisma.address.create({ data });
    res.ok({ id: Number(addr.id) });
  } catch (err) { logger.error('addAddress:', err); res.failServerError(); }
});

// PUT /api/addresses/:id
router.put('/:id', auth(), async (req, res) => {
  try {
    const addr = await prisma.address.findUnique({ where: { id: BigInt(req.params.id) } });
    if (!addr || addr.userId !== BigInt(req.user.userId)) return res.failNotFound();
    const allowed = ['name', 'phone', 'province', 'city', 'district', 'detail', 'isDefault'];
    const data = {};
    for (const key of allowed) if (req.body[key] !== undefined) data[key] = req.body[key];
    if (data.isDefault) {
      await prisma.address.updateMany({ where: { userId: req.user.userId }, data: { isDefault: false } });
    }
    await prisma.address.update({ where: { id: BigInt(req.params.id) }, data });
    res.ok({ updated: true });
  } catch (err) { logger.error('updateAddress:', err); res.failServerError(); }
});

// DELETE /api/addresses/:id
router.delete('/:id', auth(), async (req, res) => {
  try {
    const addr = await prisma.address.findUnique({ where: { id: BigInt(req.params.id) } });
    if (!addr || addr.userId !== BigInt(req.user.userId)) return res.failNotFound();
    await prisma.address.delete({ where: { id: BigInt(req.params.id) } });
    res.ok({ deleted: true });
  } catch (err) { logger.error('deleteAddress:', err); res.failServerError(); }
});

module.exports = router;
