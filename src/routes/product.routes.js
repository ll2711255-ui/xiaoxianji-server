/**
 * 商品 & 分类路由 /api/products/* + /api/categories/*
 */
const router = require('express').Router();
const { verifyToken, requireMerchant } = require('../middleware/auth');
const productService = require('../services/product.service');
const logger = require('../utils/logger');
const { validateKeyword, validatePageSize } = require('../utils/validate');

// ========== 公开接口（无需登录） ==========

/** GET /api/products — 商品列表 */
router.get('/', async (req, res) => {
  try {
    const { categoryId, keyword, page = 1, pageSize, status } = req.query;

    // 输入校验
    const kwCheck = validateKeyword(keyword);
    if (!kwCheck.valid) return res.status(400).json({ success: false, code: 400, message: kwCheck.error });
    const psCheck = validatePageSize(pageSize);
    if (!psCheck.valid) return res.status(400).json({ success: false, code: 400, message: psCheck.error });

    const products = await productService.getProducts({ categoryId, keyword, page, pageSize: psCheck.value, status });
    res.json({ success: true, code: 200, data: { products } });
  } catch (err) {
    logger.error('[products] 列表查询失败:', err.message);
    res.status(500).json({ success: false, code: 500, message: err.message });
  }
});

/** GET /api/products/:productId — 商品详情 */
router.get('/:productId', async (req, res) => {
  try {
    const product = await productService.getProductById(req.params.productId);
    if (!product) {
      return res.status(404).json({ success: false, code: 404, message: '商品不存在' });
    }
    res.json({ success: true, code: 200, data: product });
  } catch (err) {
    logger.error('[products] 详情查询失败:', err.message);
    res.status(500).json({ success: false, code: 500, message: err.message });
  }
});

// ========== 商家接口（需要登录 + merchant 角色） ==========

/** POST /api/products — 添加商品 */
router.post('/', verifyToken, requireMerchant, async (req, res) => {
  try {
    const id = await productService.createProduct(req.body);
    res.json({ success: true, code: 200, message: '商品添加成功', data: { id } });
  } catch (err) {
    logger.error('[products] 添加失败:', err.message);
    res.status(500).json({ success: false, code: 500, message: err.message });
  }
});

/** PUT /api/products/:productId — 更新商品 */
router.put('/:productId', verifyToken, requireMerchant, async (req, res) => {
  try {
    await productService.updateProduct(req.params.productId, req.body);
    res.json({ success: true, code: 200, message: '商品更新成功' });
  } catch (err) {
    logger.error('[products] 更新失败:', err.message);
    res.status(500).json({ success: false, code: 500, message: err.message });
  }
});

/** PATCH /api/products/:productId/status — 上下架 */
router.patch('/:productId/status', verifyToken, requireMerchant, async (req, res) => {
  try {
    await productService.updateProductStatus(req.params.productId, req.body);
    res.json({ success: true, code: 200, message: '状态更新成功' });
  } catch (err) {
    logger.error('[products] 状态更新失败:', err.message);
    res.status(500).json({ success: false, code: 500, message: err.message });
  }
});

module.exports = router;
