/**
 * 服务端实时计价服务
 *
 * 三种计价类型：
 *   range_weight — 整鸡：按规格匹配 price_per_jin × weight_max / 500 + 处理附加费
 *   exact_weight — 鸡腿/鸡翅等：price_per_jin × 重量(g) / 500 + 处理费（仅切块）
 *   per_piece    — 鸽子：unit_price + 处理费（仅切块）
 *
 * 强制约束：前端禁止传入价格，所有金额从数据库商品信息计算
 */
const db = require('../config/db');
const logger = require('../utils/logger');

/**
 * 服务端计价 + 商品校验
 * @param {Array} items - [{ productId, productName, pricingType, spec, quantity }]
 * @returns {Promise<{totalFen: number, validatedItems: Array}>}
 */
async function calculatePrice(items) {
  let totalFen = 0;
  const validatedItems = [];

  for (const item of items) {
    // 读取商品信息
    const product = await db.queryOne('SELECT * FROM products WHERE id = ?', [item.productId]);
    if (!product) {
      throw new Error(`商品 "${item.productName || item.productId}" 不存在`);
    }

    // 校验商品状态
    if (product.status !== 'on') {
      throw new Error(`商品 "${product.name}" 已下架`);
    }
    if (product.out_of_stock) {
      throw new Error(`商品 "${product.name}" 已售罄`);
    }

    const spec = item.spec || {};
    let unitPrice = 0; // 单价（分）

    if (item.pricingType === 'range_weight') {
      // 整鸡：按规格匹配
      const specs = product.specs || [];
      // 兼容字段名
      const matched = specs.find(
        s => s.type === spec.type && s.weight_label === spec.weight
      );
      if (!matched) {
        throw new Error(`商品 "${product.name}" 规格不匹配（${spec.type || ''} ${spec.weight || ''}）`);
      }
      const pricePerJin = matched.price_per_jin || 0;
      const weightMax = matched.weight_max || 500;
      const processingFee = (spec.processing === '切块') ? (matched.processing_fee || product.processing_fee || 0) : 0;
      unitPrice = Math.round((pricePerJin * weightMax) / 500) + processingFee;

      // 锁定定价信息到 spec（用于称重退款计算）
      spec.type_price_per_jin = matched.price_per_jin || product.price_per_jin || 0;
      spec.processing_fee = (spec.processing === '切块') ? (matched.processing_fee || product.processing_fee || 0) : 0;
      spec.weight_max = matched.weight_max || 500;
    } else if (item.pricingType === 'exact_weight') {
      // 按重称重
      const pricePerJin = product.price_per_jin || 0;
      const grams = spec.weightGrams || 500;
      const processingFee = (spec.processing === '切块') ? (product.processing_fee || 0) : 0;
      unitPrice = Math.round((pricePerJin * grams) / 500) + processingFee;

      spec.price_per_jin = product.price_per_jin || 0;
      spec.processing_fee = (spec.processing === '切块') ? (product.processing_fee || 0) : 0;
      spec.weightGrams = grams;
    } else if (item.pricingType === 'per_piece') {
      // 按只计价
      const pricePerPiece = product.unit_price || 0;
      const processingFee = (spec.processing === '切块') ? (product.processing_fee || 0) : 0;
      unitPrice = pricePerPiece + processingFee;

      spec.unit_price = product.unit_price || 0;
      spec.processing_fee = (spec.processing === '切块') ? (product.processing_fee || 0) : 0;
    } else {
      throw new Error(`商品 "${product.name}" 未知计价类型 ${item.pricingType}`);
    }

    totalFen += unitPrice * item.quantity;

    validatedItems.push({
      productId: item.productId,
      productName: product.name,
      pricingType: item.pricingType,
      spec,
      quantity: item.quantity,
      unitPrice,
    });
  }

  logger.info('[pricing] 计价完成:', { items: items.length, totalFen });
  return { totalFen, validatedItems };
}

module.exports = { calculatePrice };
