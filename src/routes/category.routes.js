/**
 * 分类路由 /api/categories/*
 * 从 product.routes.js 拆出，独立挂载
 */
const router = require('express').Router();
const { verifyToken, requireMerchant } = require('../middleware/auth');
const productService = require('../services/product.service');
const logger = require('../utils/logger');

/** GET /api/categories — 分类列表（公开） */
router.get('/', async (req, res) => {
  try {
    const categories = await productService.getCategories();
    res.json({ success: true, code: 200, data: { categories } });
  } catch (err) {
    logger.error('[categories] 查询失败:', err.message);
    res.status(500).json({ success: false, code: 500, message: err.message });
  }
});

/** POST /api/categories — 添加分类（商家） */
router.post('/', verifyToken, requireMerchant, async (req, res) => {
  try {
    const id = await productService.createCategory(req.body.name);
    res.json({ success: true, code: 200, message: '分类添加成功', data: { id } });
  } catch (err) {
    logger.error('[categories] 添加失败:', err.message);
    res.status(500).json({ success: false, code: 500, message: err.message });
  }
});

/** DELETE /api/categories/:categoryId — 删除分类（商家） */
router.delete('/:categoryId', verifyToken, requireMerchant, async (req, res) => {
  try {
    await productService.deleteCategory(req.params.categoryId);
    res.json({ success: true, code: 200, message: '分类已删除' });
  } catch (err) {
    logger.error('[categories] 删除失败:', err.message);
    res.status(500).json({ success: false, code: 500, message: err.message });
  }
});

/** PUT /api/categories/sort — 分类排序（商家）
 * TODO: PC 端分类管理页尚未实现拖拽排序 UI，接口已就绪，待前端接入
 */
router.put('/sort', verifyToken, requireMerchant, async (req, res) => {
  try {
    await productService.updateCategorySort(req.body.sorts || []);
    res.json({ success: true, code: 200, message: '排序更新成功' });
  } catch (err) {
    logger.error('[categories] 排序失败:', err.message);
    res.status(500).json({ success: false, code: 500, message: err.message });
  }
});

module.exports = router;
