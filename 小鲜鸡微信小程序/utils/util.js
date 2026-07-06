const { getMockResponse } = require('./mock');

/**
 * 【已废弃】调用云函数（仅保留作为 api.js 兼容层的兜底）
 * 所有页面应使用 utils/api.js 的 HTTP API（api.get / api.post / api.callFunction）
 * @deprecated
 * @param {string} name - 云函数名
 * @param {object} data - 入参
 * @param {number} timeout - 客户端超时毫秒，默认 15000
 * @returns {Promise<object>} 云函数返回的 result 对象
 */
function callFunction(name, data = {}, timeout = 15000) {
  const app = getApp();
  const useMock = app && app.globalData && app.globalData.useMock;

  // Mock 模式：直接返回本地数据，跳过云调用，避免控制台报 errCode: -601034
  if (useMock) {
    const mockRes = getMockResponse(name, data);
    if (mockRes) {
      return Promise.resolve(mockRes);
    }
    // mock 模式下无对应处理器，返回空对象防止后续代码 JSON.parse(undefined)
    console.warn(`[mock] 云函数「${name}」无 mock 处理器，返回空对象`);
    return Promise.resolve({});
  }

  // 云函数未初始化时直接返回空对象，避免超时等待
  if (!wx.cloud) {
    console.error(`[${name}] 云开发未初始化，请在 app.js 中配置正确的 env ID`);
    return Promise.resolve({});
  }

  const request = wx.cloud.callFunction({ name, data }).then(res => {
    // 防止云函数返回 undefined 导致 JSON.parse 报错
    return res && res.result ? res.result : {};
  });

  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`请求超时，请检查网络后重试`)), timeout);
  });

  return Promise.race([request, timeoutPromise]).catch(err => {
    console.error(`[${name}] 调用失败:`, err.message || err);
    // 返回空对象而不是抛出异常，避免页面因单个接口失败而白屏
    return {};
  });
}

/**
 * 格式化金额（分转元）
 */
function formatMoney(fen) {
  return (fen / 100).toFixed(2);
}

/**
 * 格式化重量（克转斤/克显示）
 */
function formatWeight(grams) {
  if (grams >= 500) {
    const jin = grams / 500;
    return jin + '斤';
  }
  return grams + 'g';
}

/**
 * 订单状态文本映射
 */
const ORDER_STATUS_MAP = {
  pending: '待支付',
  accepted: '已接单',
  weighed: '已称重',
  processing: '处理中',
  delivering: '配送中',
  ready: '待取货',
  completed: '已完成',
  cancelled: '已取消',
  paid: '已支付'
};

/**
 * 获取订单状态文本
 * @param {string} status - 订单状态
 * @param {string} orderType - 订单类型（delivery/pickup），用于区分 ready 状态的文案
 */
function getStatusText(status, orderType) {
  // ready 状态按订单类型区分：配送→待配送，自取→待取货
  if (status === 'ready') {
    return orderType === 'delivery' ? '待配送' : '待取货';
  }
  return ORDER_STATUS_MAP[status] || status;
}

/**
 * 退款状态文本
 */
const REFUND_STATUS_MAP = {
  none: '无需退款',
  processing: '退款处理中',
  success: '退款已到账',
  failed: '退款异常，请联系商家',
  done: '已退款'
};

function getRefundStatusText(status) {
  return REFUND_STATUS_MAP[status] || status;
}

/**
 * 退款状态颜色类名
 */
function getRefundStatusClass(status) {
  if (status === 'success' || status === 'done') return 'tag-green';
  if (status === 'failed') return 'tag-red';
  if (status === 'processing') return 'tag-orange';
  return 'tag-gray';
}

/**
 * 格式化为相对时间（刚刚 / N分钟前 / N小时前 / N天前）
 */
function formatTimeAgo(dateStr) {
  if (!dateStr) return '';
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  if (isNaN(date)) return '';
  const diff = Math.floor((now - date) / 1000);
  if (diff < 60) return '刚刚';
  if (diff < 3600) return Math.floor(diff / 60) + '分钟前';
  if (diff < 86400) return Math.floor(diff / 3600) + '小时前';
  if (diff < 604800) return Math.floor(diff / 86400) + '天前';
  // 超过一周显示日期
  const d = new Date(dateStr);
  return (d.getMonth() + 1) + '/' + d.getDate();
}

/**
 * 生成唯一ID（本地临时使用）
 */
function generateId() {
  return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

/**
 * 使用 Haversine 公式计算两点间距离
 * @param {number} lat1 - 纬度1
 * @param {number} lng1 - 经度1
 * @param {number} lat2 - 纬度2
 * @param {number} lng2 - 经度2
 * @returns {number} 距离（公里），保留 2 位小数
 */
function calcDistance(lat1, lng1, lat2, lng2) {
  const R = 6371; // 地球半径（公里）
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 100) / 100;
}

/**
 * 获取价格单位展示文本（如 /斤、/只）
 * 兼容传入 pricing_type 字符串或完整 product 对象
 */
function getPricingUnit(pricingTypeOrProduct) {
  const type = typeof pricingTypeOrProduct === 'string'
    ? pricingTypeOrProduct
    : (pricingTypeOrProduct && pricingTypeOrProduct.pricing_type);
  switch (type) {
    case 'range_weight':
      return '/斤';
    case 'exact_weight':
      return '/斤';
    case 'per_piece':
      return '/只';
    default:
      return '/斤';
  }
}

/**
 * 获取计价方式中文标签
 * @param {object|string} product - 商品对象或 pricing_type 字符串
 */
function getPricingLabel(product) {
  if (!product) return '称重计价';
  const type = typeof product === 'string' ? product : product.pricing_type;
  switch (type) {
    case 'range_weight':
      return '按斤计价';
    case 'exact_weight':
      return '称重计价';
    case 'per_piece':
      return '按只计价';
    default:
      return '称重计价';
  }
}

function getOrderTypeLabel(type) {
  switch (type) {
    case 'delivery':
      return '外卖配送';
    case 'pickup':
      return '到店自取';
    case 'scheduled':
      return '预约配送';
    case 'offline':
      return '线下订单';
    default:
      return type || '未知';
  }
}

/**
 * 克转斤
 * @param {number} grams
 * @returns {number}
 */
function gramsToJin(grams) {
  return (grams || 0) / 500;
}

/**
 * 格式化重量展示（"X.XX斤（XXX克）"）
 * @param {number} grams
 * @returns {string}
 */
function formatWeightDisplay(grams) {
  if (!grams || grams <= 0) return '';
  const jin = gramsToJin(grams);
  return jin.toFixed(2) + '斤（' + grams + '克）';
}

module.exports = {
  callFunction,
  formatMoney,
  formatWeight,
  formatTimeAgo,
  getStatusText,
  getRefundStatusText,
  getRefundStatusClass,
  calcDistance,
  getPricingUnit,
  getPricingLabel,
  getOrderTypeLabel,
  gramsToJin,
  formatWeightDisplay,
  generateId
};
