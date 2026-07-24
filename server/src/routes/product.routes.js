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
    res.json({ success: true, code: 200, data: { product } });
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

/** PATCH /api/products/:productId/status — 上下架/缺货 */
router.patch('/:productId/status', verifyToken, requireMerchant, async (req, res) => {
  try {
    await productService.updateProductStatus(req.params.productId, req.body);
    res.json({ success: true, code: 200, message: '状态更新成功' });
  } catch (err) {
    logger.error('[products] 状态更新失败:', err.message);
    res.status(500).json({ success: false, code: 500, message: err.message });
  }
});

/** DELETE /api/products/:productId — 删除商品 */
router.delete('/:productId', verifyToken, requireMerchant, async (req, res) => {
  try {
    const { productId } = req.params;
    // 先检查商品是否存在
    const product = await productService.getProductById(productId);
    if (!product) {
      return res.status(404).json({ success: false, code: 404, message: '商品不存在' });
    }
    await productService.deleteProduct(productId);
    logger.info(`[products] 商品已删除: ${productId} (${product.name})`);
    res.json({ success: true, code: 200, message: '商品已删除' });
  } catch (err) {
    logger.error('[products] 删除失败:', err.message);
    res.status(500).json({ success: false, code: 500, message: err.message });
  }
});

// ========== 库存管理接口 ==========
const stockService = require('../services/stock.service');
const { redis } = require('../config/db');

/**
 * GET /api/products/stock/batch?ids=1,2,3 — 批量查询库存
 * 注意：此路由必须定义在 /:productId/stock 之前，
 *       否则 Express 会把 "batch" 当作 productId 参数
 */
router.get('/stock/batch', verifyToken, requireMerchant, async (req, res) => {
  try {
    const idsParam = req.query.ids || '';
    if (!idsParam) {
      return res.json({ success: true, code: 200, data: { stocks: {} } });
    }
    const ids = idsParam.split(',').map(s => s.trim()).filter(Boolean);
    if (ids.length === 0) {
      return res.json({ success: true, code: 200, data: { stocks: {} } });
    }
    if (ids.length > 200) {
      return res.status(400).json({ success: false, code: 400, message: '一次最多查询200个商品' });
    }

    // Redis pipeline 批量查询，同时查可用库存和锁定库存
    // 每个商品发两条 HGETALL（available + locked），减少 RTT
    const pipeline = redis.pipeline();
    for (const id of ids) {
      pipeline.hgetall(`stock:available:${id}`);
      pipeline.hgetall(`stock:locked:${id}`);
    }
    const results = await pipeline.exec();

    const stocks = {};
    for (let i = 0; i < ids.length; i++) {
      const availableData = (results && results[i * 2] && results[i * 2][1]) || {};
      const lockedData = (results && results[i * 2 + 1] && results[i * 2 + 1][1]) || {};
      const available = (availableData && availableData.default) ? parseInt(availableData.default) : 0;
      const locked = (lockedData && lockedData.default) ? parseInt(lockedData.default) : 0;
      stocks[ids[i]] = { available, locked };
    }

    res.json({ success: true, code: 200, data: { stocks } });
  } catch (err) {
    logger.error('[products] 批量库存查询失败:', err.message);
    res.status(500).json({ success: false, code: 500, message: err.message });
  }
});

/** GET /api/products/:productId/stock — 查询单个商品库存 */
router.get('/:productId/stock', verifyToken, requireMerchant, async (req, res) => {
  try {
    // 同时查可用库存和锁定库存
    const [availableData, lockedData] = await Promise.all([
      redis.hgetall(`stock:available:${req.params.productId}`),
      redis.hgetall(`stock:locked:${req.params.productId}`),
    ]);
    const available = (availableData && availableData.default) ? parseInt(availableData.default) : 0;
    const locked = (lockedData && lockedData.default) ? parseInt(lockedData.default) : 0;
    res.json({ success: true, code: 200, data: { available, locked, detail: availableData || {} } });
  } catch (err) {
    logger.error('[products] 库存查询失败:', err.message);
    res.status(500).json({ success: false, code: 500, message: err.message });
  }
});

/** PUT /api/products/:productId/stock — 设置库存 */
router.put('/:productId/stock', verifyToken, requireMerchant, async (req, res) => {
  try {
    const { qty, batchNo } = req.body;
    const stockQty = parseInt(qty);
    if (isNaN(stockQty) || stockQty < 0) {
      return res.status(400).json({ success: false, code: 400, message: '库存数量需为非负整数' });
    }

    const goodsId = req.params.productId;
    const batch = batchNo || 'default';

    // 安全检查：查询当前已锁定的库存量
    const lockedData = await redis.hgetall(`stock:locked:${goodsId}`);
    const lockedQty = (lockedData && lockedData[batch]) ? parseInt(lockedData[batch]) : 0;

    if (lockedQty > 0 && stockQty < lockedQty) {
      logger.warn(
        `[products] 库存设置警告: goods=${goodsId} 新可用库存(${stockQty}) < 已锁定(${lockedQty})，` +
        `可能存在未完成订单，建议等订单完成后调整`
      );
      // 不阻止设置，但返回警告信息
    }

    await stockService.setStock(goodsId, batch, stockQty);
    logger.info(`[products] 库存更新: goods=${goodsId} qty=${stockQty} locked=${lockedQty}`);

    // 如果库存设置为 0，自动标记 MySQL out_of_stock = 1
    if (stockQty === 0) {
      try {
        await require('../config/db').execute(
          'UPDATE products SET out_of_stock = 1 WHERE id = ?',
          [goodsId]
        );
        logger.info(`[products] 库存归零，自动标记缺货: goods=${goodsId}`);
      } catch (mysqlErr) {
        logger.error(`[products] 自动标记缺货失败: goods=${goodsId}`, mysqlErr.message);
      }
    } else {
      // 库存 > 0 时自动清除缺货标记（管理员补货后无需手动操作）
      try {
        await require('../config/db').execute(
          'UPDATE products SET out_of_stock = 0 WHERE id = ? AND out_of_stock = 1',
          [goodsId]
        );
        logger.info(`[products] 库存恢复，自动清除缺货: goods=${goodsId}`);
      } catch (mysqlErr) {
        logger.error(`[products] 自动清除缺货失败: goods=${goodsId}`, mysqlErr.message);
      }
    }

    res.json({
      success: true,
      code: 200,
      message: '库存更新成功',
      data: { lockedQty, warning: lockedQty > 0 && stockQty < lockedQty ? '当前有未完成订单锁定中，建议保留足够库存' : null },
    });
  } catch (err) {
    logger.error('[products] 库存更新失败:', err.message);
    res.status(500).json({ success: false, code: 500, message: err.message });
  }
});

module.exports = router;
