/**
 * 订单展示数据构建
 *
 * 用户端和商家端订单详情页共享的 weighInfo / refundInfo 展示数据构建逻辑。
 * 统一处理新旧数据格式兼容，消除两端重复代码。
 */

const {
  formatMoney,
  formatWeightDisplay,
  gramsToJin,
  getRefundStatusText,
  getRefundStatusClass,
  getOrderTypeLabel
} = require('./util');

/**
 * 构建称重信息展示对象
 * @param {object} order - 订单原始数据
 * @returns {object|null}
 */
function buildWeighInfoDisplay(order) {
  // 优先使用新格式 weighInfo
  if (order.weighInfo) {
    return {
      ...order.weighInfo,
      actualWeightJin: order.weighInfo.actualWeightJin || 0,
      actualWeightDisplay: formatWeightDisplay(order.weighInfo.actualWeight || 0),
      pricePerJinDisplay: formatMoney(order.weighInfo.pricePerJin || 0),
      processingFeeDisplay: formatMoney(order.weighInfo.processingFee || 0),
      actualAmountDisplay: formatMoney(order.weighInfo.actualAmount || 0),
      refundAmountDisplay: formatMoney(order.weighInfo.refundAmount || 0),
      weighTimeDisplay: order.weighInfo.weighTime || ''
    };
  }

  // 兼容旧数据（无 weighInfo 但有旧字段）
  if (order.status === 'weighed' || order.actualWeight) {
    const actualWeight = order.actualWeight || 0;
    return {
      actualWeight,
      actualWeightJin: gramsToJin(actualWeight).toFixed(2),
      actualWeightDisplay: formatWeightDisplay(actualWeight),
      pricePerJin: 0,
      pricePerJinDisplay: '--',
      processingFee: 0,
      processingFeeDisplay: '--',
      actualAmount: order.actualAmount || 0,
      actualAmountDisplay: formatMoney(order.actualAmount || 0),
      refundAmount: order.refundAmount || 0,
      refundAmountDisplay: formatMoney(order.refundAmount || 0),
      weighPhoto: order.weighPhoto || '',
      weighTimeDisplay: ''
    };
  }

  return null;
}

/**
 * 构建退款信息展示对象
 * @param {object} order - 订单原始数据
 * @returns {object|null}
 */
function buildRefundInfoDisplay(order) {
  // 优先使用新格式 refundInfo
  if (order.refundInfo) {
    return {
      ...order.refundInfo,
      refundAmountDisplay: formatMoney(order.refundInfo.refundAmount || 0),
      statusText: getRefundStatusText(order.refundInfo.status || 'none'),
      statusClass: getRefundStatusClass(order.refundInfo.status || 'none')
    };
  }

  // 兼容旧数据
  if (order.refundStatus) {
    return {
      refundNo: '',
      refundAmount: order.refundAmount || 0,
      refundAmountDisplay: formatMoney(order.refundAmount || 0),
      status: order.refundStatus,
      statusText: getRefundStatusText(order.refundStatus),
      statusClass: getRefundStatusClass(order.refundStatus),
      wxRefundId: '',
      refundTime: '',
      successTime: ''
    };
  }

  return null;
}

/**
 * 构建订单基本信息展示
 * @param {object} order
 * @returns {object}
 */
function buildOrderBaseDisplay(order) {
  return {
    prepayDisplay: formatMoney(order.prepayAmount || 0),
    actualDisplay: formatMoney(order.actualAmount || 0),
    refundDisplay: formatMoney(order.refundAmount || 0),
    actualWeightDisplay: (order.actualWeight && !isNaN(order.actualWeight))
      ? formatWeightDisplay(order.actualWeight)
      : '',
    statusText: (order.status === 'paid' && order.type === 'offline')
      ? '已收款'
      : order.status,
    typeLabel: getOrderTypeLabel(order.type)
  };
}

module.exports = {
  buildWeighInfoDisplay,
  buildRefundInfoDisplay,
  buildOrderBaseDisplay
};
