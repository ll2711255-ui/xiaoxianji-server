const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { auth } = require('../middleware/auth');
const logger = require('../utils/logger');
const prisma = new PrismaClient();

// GET /api/categories — 分类列表
router.get('/', async (req, res) => {
  try {
    const merchant = await prisma.merchant.findFirst();
    if (!merchant) return res.ok([]);
    const categories = await prisma.category.findMany({
      where: { merchantId: merchant.id },
      orderBy: { sort: 'asc' },
    });
    res.ok(categories.map(c => ({ ...c, id: Number(c.id), merchantId: Number(c.merchantId) })));
  } catch (err) { logger.error('getCategories:', err); res.failServerError(); }
});

// POST /api/categories — 新增分类（商家）
router.post('/', auth({ requiredRole: ['merchant', 'admin'] }), async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.fail('分类名称不能为空');
    const max = await prisma.category.findFirst({
      where: { merchantId: req.user.merchantId },
      orderBy: { sort: 'desc' },
    });
    const category = await prisma.category.create({
      data: { merchantId: req.user.merchantId, name, sort: (max?.sort || 0) + 1 },
    });
    res.ok({ id: Number(category.id) });
  } catch (err) { logger.error('addCategory:', err); res.failServerError(); }
});

// DELETE /api/categories/:id — 删除分类（商家）
router.delete('/:id', auth({ requiredRole: ['merchant', 'admin'] }), async (req, res) => {
  try {
    const category = await prisma.category.findUnique({ where: { id: BigInt(req.params.id) } });
    if (!category || category.merchantId !== BigInt(req.user.merchantId)) return res.failNotFound();
    const count = await prisma.product.count({ where: { categoryId: BigInt(req.params.id) } });
    if (count > 0) return res.fail(`该分类下有 ${count} 个商品，无法删除`);
    await prisma.category.delete({ where: { id: BigInt(req.params.id) } });
    res.ok({ deleted: true });
  } catch (err) { logger.error('deleteCategory:', err); res.failServerError(); }
});

// PUT /api/categories/sort — 批量更新排序（商家）
router.put('/sort', auth({ requiredRole: ['merchant', 'admin'] }), async (req, res) => {
  try {
    const { categories } = req.body;
    if (!Array.isArray(categories)) return res.fail('categories 必须为数组');
    await Promise.all(categories.map(({ _id, sort }) =>
      prisma.category.update({ where: { id: BigInt(_id) }, data: { sort } })
    ));
    res.ok({ updated: true });
  } catch (err) { logger.error('updateCategorySort:', err); res.failServerError(); }
});

module.exports = router;
