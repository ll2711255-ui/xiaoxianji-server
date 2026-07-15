/**
 * 通用工具函数（uni-app 版）
 *
 * 迁移自原微信小程序的 utils/util.js
 * 主要变更：wx.* → uni.*
 */

/** 格式化金额（分转元） */
export function formatMoney(fen) {
  return (fen / 100).toFixed(2)
}

/** 格式化重量（克转斤/克显示） */
export function formatWeight(grams) {
  if (grams >= 500) return (grams / 500) + '斤'
  return grams + 'g'
}

/** 订单状态文本映射 */
const ORDER_STATUS_MAP = {
  pending: '待支付', paid: '已支付', accepted: '已接单', weighed: '已称重',
  processing: '处理中', delivering: '配送中', ready: '待取货', completed: '已完成', cancelled: '已取消'
}

/** 获取订单状态文本 */
export function getStatusText(status, orderType) {
  if (status === 'ready') return orderType === 'delivery' ? '待配送' : '待取货'
  return ORDER_STATUS_MAP[status] || status
}

/** 退款状态文本 */
const REFUND_STATUS_MAP = {
  none: '无需退款', processing: '退款处理中', success: '退款已到账', failed: '退款异常，请联系商家', done: '已退款'
}

export function getRefundStatusText(status) {
  return REFUND_STATUS_MAP[status] || status
}

/** 退款状态颜色类名 */
export function getRefundStatusClass(status) {
  if (status === 'success' || status === 'done') return 'tag-green'
  if (status === 'failed') return 'tag-red'
  if (status === 'processing') return 'tag-orange'
  return 'tag-gray'
}

/** 格式化为相对时间 */
export function formatTimeAgo(dateStr) {
  if (!dateStr) return ''
  const now = Date.now()
  const date = new Date(dateStr).getTime()
  if (isNaN(date)) return ''
  const diff = Math.floor((now - date) / 1000)
  if (diff < 60) return '刚刚'
  if (diff < 3600) return Math.floor(diff / 60) + '分钟前'
  if (diff < 86400) return Math.floor(diff / 3600) + '小时前'
  if (diff < 604800) return Math.floor(diff / 86400) + '天前'
  const d = new Date(dateStr)
  return (d.getMonth() + 1) + '/' + d.getDate()
}

/** 生成唯一 ID */
export function generateId() {
  return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
}

/** Haversine 距离计算（公里） */
export function calcDistance(lat1, lng1, lat2, lng2) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 100) / 100
}

/** 获取价格单位（/斤、/只） */
export function getPricingUnit(pricingTypeOrProduct) {
  const type = typeof pricingTypeOrProduct === 'string' ? pricingTypeOrProduct : (pricingTypeOrProduct && pricingTypeOrProduct.pricing_type)
  switch (type) {
    case 'range_weight': case 'exact_weight': return '/斤'
    case 'per_piece': return '/只'
    default: return '/斤'
  }
}

/** 计价方式中文标签 */
export function getPricingLabel(product) {
  if (!product) return '称重计价'
  const type = typeof product === 'string' ? product : product.pricing_type
  switch (type) {
    case 'range_weight': return '按斤计价'
    case 'exact_weight': return '称重计价'
    case 'per_piece': return '按只计价'
    default: return '称重计价'
  }
}

/** 订单类型标签 */
export function getOrderTypeLabel(type) {
  switch (type) {
    case 'delivery': return '外卖配送'
    case 'pickup': return '到店自取'
    case 'scheduled': return '预约配送'
    case 'offline': return '线下订单'
    default: return type || '未知'
  }
}

/** 克转斤 */
export function gramsToJin(grams) {
  return (grams || 0) / 500
}

/** 格式化重量展示 */
export function formatWeightDisplay(grams) {
  if (!grams || grams <= 0) return ''
  const jin = gramsToJin(grams)
  return jin.toFixed(2) + '斤（' + grams + '克）'
}

/**
 * 安全提取图片 URL，确保返回合法字符串
 *
 * 背景：API 返回的 images 可能是字符串数组、对象数组（{url:"..."}）、
 * 或直接是对象/布尔值。WeChat `<image>` 的 src 必须为合法 URL 字符串，
 * 否则 DevTools 会尝试加载 `/pages/xxx/[object Object]` 等垃圾路径。
 *
 * @param {any} val — 图片字段原始值
 * @returns {string} 合法的 URL 字符串，无效时返回空字符串
 */
export function safeImageUrl(val) {
  if (!val) return ''
  if (typeof val === 'string') return val
  // 对象数组：取第一个元素的 url 字段
  if (Array.isArray(val)) {
    const first = val[0]
    if (!first) return ''
    if (typeof first === 'string') return first
    if (typeof first === 'object' && first !== null) {
      return first.url || first.src || first.image_url || first.imageUrl || ''
    }
    return ''
  }
  // 单个对象
  if (typeof val === 'object' && val !== null) {
    return val.url || val.src || val.image_url || val.imageUrl || ''
  }
  return ''
}
