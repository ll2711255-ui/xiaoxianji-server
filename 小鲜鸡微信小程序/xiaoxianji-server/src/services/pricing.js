/**
 * 服务端三段定价计算
 *
 * 从云函数 createOrder/index.js 的 calculatePrice 逻辑完整迁移
 *
 * 三种定价类型：
 *   exact_weight — 按称重计价：实际金额 = grams/500 * price_per_jin + processingFee
 *   range_weight  — 按规格区间计价：按预选的type+weight标签匹配对应价格
 *   per_piece     — 按个计价：实际金额 = unit_price + processingFee
 *
 * @param {object}  item    — { productId, spec: { type, weightLabel, weightGrams, processing, deliveryMode, quantity } }
 * @param {number}  merchantId
 * @returns {object} { valid, productName, pricingType, spec, itemAmount, productId, error? }
 */
const prisma = require('../db');

async function calculatePrice(item, merchantId) {
  try {
    const { productId, spec = {}, quantity = 1 } = item;

    // 读取商品
    const product = await prisma.product.findUnique({
      where: { id: BigInt(productId) },
    });
    if (!product || product.status === 'off' || product.outOfStock) {
      return { valid: false, productId, productName: product?.name || '未知商品', error: '已下架或售罄' };
    }
    if (product.merchantId !== BigInt(merchantId)) {
      return { valid: false, productId, productName: product.name, error: '不存在' };
    }

    const pricingType = product.pricingType;
    let itemAmount = 0;
    let resolvedSpec = { ...spec };

    switch (pricingType) {
      // ========== 按称重计价 ==========
      case 'exact_weight': {
        const pricePerJin = Number(product.pricePerJin || 0);
        const grams = spec.weightGrams || 500;
        const processingFee = spec.processing === '切块' ? (product.processingOptions?.find(o => o.label === '切块')?.fee || 0) : 0;

        // 金额 = grams/500 * pricePerJin + processingFee，向下取整到分
        itemAmount = Math.floor((grams / 500) * pricePerJin * 100) + (processingFee * 100 || 0);

        resolvedSpec = {
          ...resolvedSpec,
          unitPrice: pricePerJin,
          pricePerJin,
          processingFee,
          deliveryMode: spec.deliveryMode || spec.delivery || 'delivery',
        };
        break;
      }

      // ========== 按规格区间计价（整鸡） ==========
      case 'range_weight': {
        const typeLabel = spec.type;
        // 兼容客户端两种字段名：weightLabel（标准）和 weight（旧版/客户端直传）
        const weightLabel = spec.weightLabel || spec.weight;

        // 从typeConfigs中查找匹配的规格
        const typeConfigs = product.typeConfigs || [];
        const matchedType = typeConfigs.find(t => t.label === typeLabel);
        if (!matchedType) {
          return { valid: false, productId, productName: product.name, error: '规格类型不匹配' };
        }

        const weightConfig = (matchedType.weights || []).find(w => w.label === weightLabel);
        if (!weightConfig) {
          return { valid: false, productId, productName: product.name, error: '重量规格不匹配' };
        }

        const maxGrams = weightConfig.maxGrams || 2500;
        const pricePerJin = weightConfig.pricePerJin || Number(product.pricePerJin || 0);
        const processingFee = spec.processing === '切块'
          ? (product.processingOptions?.find(o => o.label === '切块')?.fee || 0) : 0;

        // 预估金额 = maxGrams/500 * pricePerJin + processingFee（称重后多退少补）
        itemAmount = Math.floor((maxGrams / 500) * pricePerJin * 100) + (processingFee * 100 || 0);

        resolvedSpec = {
          ...resolvedSpec,
          weightMax: maxGrams,
          pricePerJin,
          processingFee,
          deliveryMode: spec.deliveryMode || spec.delivery || 'delivery',
        };
        break;
      }

      // ========== 按个计价 ==========
      case 'per_piece': {
        const unitPrice = Number(product.unitPrice || 0);
        const processingFee = spec.processing === '切块'
          ? (product.processingOptions?.find(o => o.label === '切块')?.fee || 0) : 0;

        itemAmount = Math.floor(unitPrice * 100) + (processingFee * 100 || 0);

        resolvedSpec = {
          ...resolvedSpec,
          unitPrice,
          processingFee,
          deliveryMode: spec.deliveryMode || spec.delivery || 'delivery',
        };
        break;
      }

      default:
        return { valid: false, productId, productName: product.name, error: '未知计价类型' };
    }

    // 乘以数量
    itemAmount = itemAmount * Math.max(1, quantity);

    return {
      valid: true,
      productId: Number(product.id),
      productName: product.name,
      pricingType,
      spec: resolvedSpec,
      itemAmount,
      quantity,
    };
  } catch (err) {
    return { valid: false, productId: item.productId, productName: '未知', error: '计价异常: ' + err.message };
  }
}

module.exports = { calculatePrice };
