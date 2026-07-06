/**
 * 服务端实时计价
 * 禁止信任前端传来的价格，所有金额从数据库商品信息计算
 * 从 cloud function calculatePrice 移植
 */
const Product = require('../models/Product')

async function calculatePrice(items) {
  let totalFen = 0
  const validatedItems = []

  for (const item of items) {
    const product = await Product.findById(item.productId)
    if (!product) {
      throw new Error(`商品 "${item.productName || item.productId}" 不存在`)
    }
    if (product.status !== 'on') {
      throw new Error(`商品 "${product.name}" 已下架`)
    }
    if (product.out_of_stock) {
      throw new Error(`商品 "${product.name}" 已售罄`)
    }

    const spec = item.spec || {}
    let unitPrice = 0

    if (item.pricingType === 'range_weight') {
      const specs = product.specs || []
      const matched = specs.find(
        s => s.type === spec.type && s.weight_label === spec.weight
      )
      if (!matched) {
        throw new Error(`商品 "${product.name}" 规格不匹配`)
      }
      const pricePerJin = matched.price_per_jin || 0
      const weightMax = matched.weight_max || 500
      const processingFee = (spec.processing === '切块') ? (matched.processing_fee || product.processing_fee || 0) : 0
      unitPrice = Math.round((pricePerJin * weightMax) / 500) + processingFee

      // 锁定定价信息
      spec.type_price_per_jin = pricePerJin
      spec.processing_fee = processingFee
      spec.weight_max = weightMax
    } else if (item.pricingType === 'exact_weight') {
      const pricePerJin = product.price_per_jin || 0
      const grams = spec.weightGrams || 500
      const processingFee = (spec.processing === '切块') ? (product.processing_fee || 0) : 0
      unitPrice = Math.round((pricePerJin * grams) / 500) + processingFee

      spec.price_per_jin = pricePerJin
      spec.processing_fee = processingFee
      spec.weightGrams = grams
    } else if (item.pricingType === 'per_piece') {
      const pricePerPiece = product.unit_price || 0
      const processingFee = (spec.processing === '切块') ? (product.processing_fee || 0) : 0
      unitPrice = pricePerPiece + processingFee

      spec.unit_price = pricePerPiece
      spec.processing_fee = processingFee
    } else {
      throw new Error(`商品 "${product.name}" 未知计价类型`)
    }

    totalFen += unitPrice * (item.quantity || 1)

    validatedItems.push({
      productId: item.productId,
      productName: product.name,
      pricingType: item.pricingType,
      spec,
      quantity: item.quantity || 1,
      unitPrice
    })
  }

  return { totalFen, validatedItems }
}

module.exports = { calculatePrice }
