/**
 * Haversine 距离计算
 *
 * 从云函数 common/utils.js 直接迁移
 * 用于配送范围校验
 *
 * @param {number} lat1 - 纬度1
 * @param {number} lng1 - 经度1
 * @param {number} lat2 - 纬度2
 * @param {number} lng2 - 经度2
 * @returns {number} 距离（公里）
 */
function calcDistance(lat1, lng1, lat2, lng2) {
  const R = 6371; // 地球半径（公里）
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

/**
 * 检查目标位置是否在配送范围内
 * @returns {{ inRange: boolean, distance: number }}
 */
async function checkDeliveryRange(lat, lng, { PrismaClient }) {
  const prisma = new PrismaClient();
  const merchant = await prisma.merchant.findFirst();
  if (!merchant || !merchant.lat || !merchant.lng) {
    return { inRange: false, distance: 0, reason: '门店位置未配置' };
  }

  const distance = calcDistance(
    parseFloat(merchant.lat),
    parseFloat(merchant.lng),
    parseFloat(lat),
    parseFloat(lng)
  );

  const radius = merchant.deliveryRadius || 5;
  return {
    inRange: distance <= radius,
    distance: Math.round(distance * 100) / 100,
    radius,
  };
}

module.exports = { calcDistance, checkDeliveryRange };
