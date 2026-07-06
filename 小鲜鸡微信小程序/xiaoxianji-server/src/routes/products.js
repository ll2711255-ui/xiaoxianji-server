const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const logger = require('../utils/logger');
const prisma = require('../db');

// ============================================================
// GET /api/products?category_id=&page=&page_size=&keyword=
// ============================================================
router.get('/', async (req, res) => {
  try {
    const { category_id, page = 1, page_size = 20, keyword } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(page_size, 10) || 20));

    // 获取门店配置来确定 merchantId（默认取第一个商户）
    const merchant = await prisma.merchant.findFirst();
    const merchantId = merchant?.id;
    if (!merchantId) return res.ok({ categories: [], products: [] });

    // 构建查询条件
    const where = {
      merchantId,
      status: 'on',
      outOfStock: false,
    };
    if (category_id) {
      where.categoryId = BigInt(category_id);
    }
    if (keyword) {
      where.OR = [
        { name: { contains: keyword } },
        { sellingPoint: { contains: keyword } },
        { description: { contains: keyword } },
      ];
    }

    // 查分类
    const categories = await prisma.category.findMany({
      where: { merchantId },
      orderBy: { sort: 'asc' },
    });

    // 查商品（分页）
    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy: [{ sort: 'asc' }, { createdAt: 'desc' }],
        skip: (pageNum - 1) * pageSize,
        take: pageSize,
      }),
      prisma.product.count({ where }),
    ]);

    // 格式化输出
    const list = products.map((p) => ({
      ...p,
      id: Number(p.id),
      categoryId: p.categoryId ? Number(p.categoryId) : null,
      merchantId: Number(p.merchantId),
      // BigInt → Number 转换
      ...(p.pricePerJin && { pricePerJin: Number(p.pricePerJin) }),
      ...(p.unitPrice && { unitPrice: Number(p.unitPrice) }),
    }));

    res.okPaginated(list, { page: pageNum, pageSize, total });
  } catch (err) {
    logger.error('getProducts错误:', err);
    res.failServerError('获取商品列表失败');
  }
});

// ============================================================
// GET /api/products/:id
// ============================================================
router.get('/:id', async (req, res) => {
  try {
    const product = await prisma.product.findUnique({
      where: { id: BigInt(req.params.id) },
    });
    if (!product || product.status === 'off') {
      return res.failNotFound('商品不存在或已下架');
    }

    res.ok({
      ...product,
      id: Number(product.id),
      categoryId: product.categoryId ? Number(product.categoryId) : null,
      merchantId: Number(product.merchantId),
      pricePerJin: product.pricePerJin ? Number(product.pricePerJin) : null,
      unitPrice: product.unitPrice ? Number(product.unitPrice) : null,
    });
  } catch (err) {
    logger.error('getProductDetail错误:', err);
    res.failServerError('获取商品详情失败');
  }
});

// ============================================================
// POST /api/products — 新增商品（商家）
// ============================================================
router.post('/', auth({ requiredRole: ['merchant', 'admin'] }), async (req, res) => {
  try {
    const {
      name, categoryId, pricingType, pricePerJin, unitPrice,
      weightOptions, typeConfigs, processingOptions, deliveryModes,
      images, description, sellingPoint, sort,
    } = req.body;

    if (!name || !pricingType) return res.fail('商品名称和定价类型为必填项');

    const product = await prisma.product.create({
      data: {
        merchantId: req.user.merchantId,
        categoryId: categoryId ? BigInt(categoryId) : null,
        name, pricingType,
        pricePerJin: pricePerJin || null,
        unitPrice: unitPrice || null,
        weightOptions: weightOptions || null,
        typeConfigs: typeConfigs || null,
        processingOptions: processingOptions || null,
        deliveryModes: deliveryModes || null,
        images: images || [],
        description: description || null,
        sellingPoint: sellingPoint || null,
        sort: sort || 0,
      },
    });

    logger.info(`商品创建: id=${product.id}, name=${name}`);
    res.ok({ id: Number(product.id) });
  } catch (err) {
    logger.error('addProduct错误:', err);
    res.failServerError('创建商品失败');
  }
});

// ============================================================
// PUT /api/products/:id — 编辑商品（商家）
// ============================================================
router.put('/:id', auth({ requiredRole: ['merchant', 'admin'] }), async (req, res) => {
  try {
    const product = await prisma.product.findUnique({ where: { id: BigInt(req.params.id) } });
    if (!product || product.merchantId !== BigInt(req.user.merchantId)) {
      return res.failNotFound('商品不存在');
    }

    const allowed = [
      'name', 'categoryId', 'pricingType', 'pricePerJin', 'unitPrice',
      'weightOptions', 'typeConfigs', 'processingOptions', 'deliveryModes',
      'images', 'description', 'sellingPoint', 'sort',
    ];

    const data = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        data[key] = req.body[key];
      }
    }
    if (data.categoryId) data.categoryId = BigInt(data.categoryId);

    await prisma.product.update({ where: { id: BigInt(req.params.id) }, data });
    res.ok({ updated: true });
  } catch (err) {
    logger.error('updateProduct错误:', err);
    res.failServerError('更新商品失败');
  }
});

// ============================================================
// PATCH /api/products/:id/status — 上下架/售罄（商家）
// ============================================================
router.patch('/:id/status', auth({ requiredRole: ['merchant', 'admin'] }), async (req, res) => {
  try {
    const product = await prisma.product.findUnique({ where: { id: BigInt(req.params.id) } });
    if (!product || product.merchantId !== BigInt(req.user.merchantId)) {
      return res.failNotFound('商品不存在');
    }

    const data = {};
    if (req.body.status !== undefined) data.status = req.body.status;
    if (req.body.outOfStock !== undefined) data.outOfStock = req.body.outOfStock;

    await prisma.product.update({ where: { id: BigInt(req.params.id) }, data });
    res.ok({ updated: true });
  } catch (err) {
    logger.error('updateProductStatus错误:', err);
    res.failServerError('更新状态失败');
  }
});

module.exports = router;
