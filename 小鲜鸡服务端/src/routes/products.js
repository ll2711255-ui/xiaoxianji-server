const router = require('express').Router()
const Product = require('../models/Product')
const { success, fail } = require('../utils/response')
const { verifyToken, verifyDashboard } = require('../middleware/auth')

// 商品列表
router.get('/', async (req, res) => {
  try {
    const { categoryId, status, keyword, page = 1, pageSize = 50 } = req.query
    const filter = {}

    if (status === 'all') { /* 不过滤 */ } else {
      filter.status = status || 'on'
    }
    if (categoryId && categoryId !== 'cat_00') {
      filter.categoryId = categoryId
    }
    if (keyword) {
      filter.$or = [
        { name: { $regex: keyword, $options: 'i' } },
        { selling_point: { $regex: keyword, $options: 'i' } }
      ]
    }

    const skip = (parseInt(page) - 1) * parseInt(pageSize)
    const [products, total] = await Promise.all([
      Product.find(filter).sort({ sales: -1 }).skip(skip).limit(parseInt(pageSize)).lean(),
      Product.countDocuments(filter)
    ])

    res.json(success({ products, total }))
  } catch (err) {
    console.error('查询商品失败:', err)
    res.status(500).json(fail('查询失败'))
  }
})

// 商品详情
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).lean()
    if (!product) return res.json(fail('商品不存在'))
    res.json(success({ product }))
  } catch (err) {
    res.status(500).json(fail('查询失败'))
  }
})

// 新增商品（需管理后台权限）
router.post('/', verifyToken, verifyDashboard, async (req, res) => {
  try {
    const data = req.body
    const product = new Product({
      name: data.name,
      categoryId: data.categoryId,
      pricing_type: data.pricingType || data.pricing_type,
      description: data.description || '',
      selling_point: data.sellingPoint || data.selling_point || '',
      images: data.images || [],
      delivery_modes: data.deliveryModes || data.delivery_modes || ['delivery', 'pickup'],
      processing_options: data.processingOptions || data.processing_options || [],
      status: 'on',
      out_of_stock: false
    })

    if (product.pricing_type === 'range_weight') {
      product.specs = data.specs || []
    } else if (product.pricing_type === 'exact_weight') {
      product.price_per_jin = data.pricePerJin || data.price_per_jin || 0
      product.weight_options = data.weightOptions || data.weight_options || [500]
      product.processing_fee = data.processingFee || data.processing_fee || 0
    } else if (product.pricing_type === 'per_piece') {
      product.unit_price = data.unitPrice || data.unit_price || 0
      product.processing_fee = data.processingFee || data.processing_fee || 0
    }

    await product.save()
    res.json(success({ product }))
  } catch (err) {
    console.error('新增商品失败:', err)
    res.status(500).json(fail(err.message || '新增失败'))
  }
})

// 编辑商品（需管理后台权限）
router.put('/:id', verifyToken, verifyDashboard, async (req, res) => {
  try {
    const data = req.body
    const update = {}

    if (data.name !== undefined) update.name = data.name
    if (data.categoryId !== undefined) update.categoryId = data.categoryId
    if (data.pricingType !== undefined) update.pricing_type = data.pricingType
    if (data.description !== undefined) update.description = data.description
    if (data.sellingPoint !== undefined) update.selling_point = data.sellingPoint
    if (data.images !== undefined) update.images = data.images
    if (data.deliveryModes !== undefined) update.delivery_modes = data.deliveryModes
    if (data.processingOptions !== undefined) update.processing_options = data.processingOptions
    if (data.pricePerJin !== undefined) update.price_per_jin = data.pricePerJin
    if (data.weightOptions !== undefined) update.weight_options = data.weightOptions
    if (data.processingFee !== undefined) update.processing_fee = data.processingFee
    if (data.unitPrice !== undefined) update.unit_price = data.unitPrice
    if (data.specs !== undefined) update.specs = data.specs
    if (data.selling_point !== undefined) update.selling_point = data.selling_point
    if (data.delivery_modes !== undefined) update.delivery_modes = data.delivery_modes
    if (data.processing_options !== undefined) update.processing_options = data.processing_options
    if (data.price_per_jin !== undefined) update.price_per_jin = data.price_per_jin
    if (data.weight_options !== undefined) update.weight_options = data.weight_options
    if (data.processing_fee !== undefined) update.processing_fee = data.processing_fee
    if (data.unit_price !== undefined) update.unit_price = data.unit_price

    const product = await Product.findByIdAndUpdate(req.params.id, update, { new: true }).lean()
    if (!product) return res.json(fail('商品不存在'))
    res.json(success({ product }))
  } catch (err) {
    console.error('编辑商品失败:', err)
    res.status(500).json(fail(err.message || '编辑失败'))
  }
})

// 更新状态（上下架/缺货，需管理后台权限）
router.patch('/:id/status', verifyToken, verifyDashboard, async (req, res) => {
  try {
    const update = {}
    if (req.body.status !== undefined) update.status = req.body.status
    if (req.body.outOfStock !== undefined) update.out_of_stock = req.body.outOfStock

    const product = await Product.findByIdAndUpdate(req.params.id, update, { new: true }).lean()
    if (!product) return res.json(fail('商品不存在'))
    res.json(success({ product }))
  } catch (err) {
    res.status(500).json(fail('更新失败'))
  }
})

module.exports = router
