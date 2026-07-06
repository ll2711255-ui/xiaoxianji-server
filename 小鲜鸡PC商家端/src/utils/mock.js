/**
 * PC 管理后台 Mock 数据
 * 数据模型与微信小程序 utils/mock.js 保持一致
 */

// ========== 分类 ==========
const CATEGORIES = [
  { _id: 'cat_00', name: '今日推荐', sort: 0 },
  { _id: 'cat_01', name: '鸡', sort: 1 },
  { _id: 'cat_02', name: '鸭', sort: 2 },
  { _id: 'cat_03', name: '鸡胸肉', sort: 3 },
  { _id: 'cat_04', name: '鸡腿/鸡翅', sort: 4 },
  { _id: 'cat_05', name: '鸡杂/鸭杂', sort: 5 },
  { _id: 'cat_06', name: '鸡脚/鸭脚', sort: 6 }
]

// ========== 商品 ==========
const PRODUCTS = [
  {
    _id: 'prod_01', name: '清远走地鸡', categoryId: 'cat_01', pricing_type: 'range_weight',
    description: '散养180天，肉质紧实有嚼劲', selling_point: '散养180天｜肉质紧实｜白切红烧皆宜',
    images: [], sales: 1280,
    specs: [
      { type: '毛鸡称重', weight_label: '3.0-3.5斤', weight_max: 1750, price_per_jin: 1700, processing: '整只' },
      { type: '毛鸡称重', weight_label: '3.0-3.5斤', weight_max: 1750, price_per_jin: 1700, processing: '切块' },
      { type: '毛鸡称重', weight_label: '3.5-4.0斤', weight_max: 2000, price_per_jin: 1700, processing: '整只' },
      { type: '毛鸡称重', weight_label: '3.5-4.0斤', weight_max: 2000, price_per_jin: 1700, processing: '切块' },
      { type: '毛鸡称重', weight_label: '4.0-4.5斤', weight_max: 2250, price_per_jin: 1700, processing: '整只' },
      { type: '毛鸡称重', weight_label: '4.0-4.5斤', weight_max: 2250, price_per_jin: 1700, processing: '切块' },
      { type: '光鸡称重', weight_label: '2.5-3.0斤', weight_max: 1500, price_per_jin: 1800, processing: '整只' },
      { type: '光鸡称重', weight_label: '2.5-3.0斤', weight_max: 1500, price_per_jin: 1800, processing: '切块' },
      { type: '光鸡称重', weight_label: '3.0-3.5斤', weight_max: 1750, price_per_jin: 1800, processing: '整只' },
      { type: '光鸡称重', weight_label: '3.0-3.5斤', weight_max: 1750, price_per_jin: 1800, processing: '切块' },
      { type: '光鸡称重', weight_label: '3.5-4.0斤', weight_max: 2000, price_per_jin: 1800, processing: '整只' },
      { type: '光鸡称重', weight_label: '3.5-4.0斤', weight_max: 2000, price_per_jin: 1800, processing: '切块' },
      { type: '鲜肉鸡称重', weight_label: '1.0-1.2斤', weight_max: 600, price_per_jin: 1800, processing: '整只' },
      { type: '鲜肉鸡称重', weight_label: '1.0-1.2斤', weight_max: 600, price_per_jin: 1800, processing: '切块' },
      { type: '鲜肉鸡称重', weight_label: '1.2-1.4斤', weight_max: 700, price_per_jin: 1800, processing: '整只' },
      { type: '鲜肉鸡称重', weight_label: '1.2-1.4斤', weight_max: 700, price_per_jin: 1800, processing: '切块' },
      { type: '鲜肉鸡称重', weight_label: '1.4-1.6斤', weight_max: 800, price_per_jin: 1800, processing: '整只' },
      { type: '鲜肉鸡称重', weight_label: '1.4-1.6斤', weight_max: 800, price_per_jin: 1800, processing: '切块' }
    ],
    processing_options: ['整只', '切块'], delivery_modes: ['delivery', 'pickup'], minPrice: '21.60', out_of_stock: false, status: 'on'
  },
  {
    _id: 'prod_02', name: '文昌鸡', categoryId: 'cat_01', pricing_type: 'range_weight',
    description: '海南文昌鸡，皮脆肉嫩，白切首选', selling_point: '海南正宗｜皮脆肉嫩｜白切首选',
    images: [], sales: 960,
    specs: [
      { type: '毛鸡称重', weight_label: '3.0-3.5斤', weight_max: 1750, price_per_jin: 1700, processing: '整只' },
      { type: '毛鸡称重', weight_label: '3.0-3.5斤', weight_max: 1750, price_per_jin: 1700, processing: '切块' },
      { type: '毛鸡称重', weight_label: '3.5-4.0斤', weight_max: 2000, price_per_jin: 1700, processing: '整只' },
      { type: '毛鸡称重', weight_label: '3.5-4.0斤', weight_max: 2000, price_per_jin: 1700, processing: '切块' },
      { type: '毛鸡称重', weight_label: '4.0-4.5斤', weight_max: 2250, price_per_jin: 1700, processing: '整只' },
      { type: '毛鸡称重', weight_label: '4.0-4.5斤', weight_max: 2250, price_per_jin: 1700, processing: '切块' },
      { type: '光鸡称重', weight_label: '2.5-3.0斤', weight_max: 1500, price_per_jin: 1800, processing: '整只' },
      { type: '光鸡称重', weight_label: '2.5-3.0斤', weight_max: 1500, price_per_jin: 1800, processing: '切块' },
      { type: '光鸡称重', weight_label: '3.0-3.5斤', weight_max: 1750, price_per_jin: 1800, processing: '整只' },
      { type: '光鸡称重', weight_label: '3.0-3.5斤', weight_max: 1750, price_per_jin: 1800, processing: '切块' },
      { type: '光鸡称重', weight_label: '3.5-4.0斤', weight_max: 2000, price_per_jin: 1800, processing: '整只' },
      { type: '光鸡称重', weight_label: '3.5-4.0斤', weight_max: 2000, price_per_jin: 1800, processing: '切块' },
      { type: '鲜肉鸡称重', weight_label: '1.0-1.2斤', weight_max: 600, price_per_jin: 1800, processing: '整只' },
      { type: '鲜肉鸡称重', weight_label: '1.0-1.2斤', weight_max: 600, price_per_jin: 1800, processing: '切块' },
      { type: '鲜肉鸡称重', weight_label: '1.2-1.4斤', weight_max: 700, price_per_jin: 1800, processing: '整只' },
      { type: '鲜肉鸡称重', weight_label: '1.2-1.4斤', weight_max: 700, price_per_jin: 1800, processing: '切块' },
      { type: '鲜肉鸡称重', weight_label: '1.4-1.6斤', weight_max: 800, price_per_jin: 1800, processing: '整只' },
      { type: '鲜肉鸡称重', weight_label: '1.4-1.6斤', weight_max: 800, price_per_jin: 1800, processing: '切块' }
    ],
    processing_options: ['整只', '切块'], delivery_modes: ['delivery', 'pickup'], minPrice: '21.60', out_of_stock: false, status: 'on'
  },
  {
    _id: 'prod_03', name: '新鲜鸡全腿', categoryId: 'cat_04', pricing_type: 'exact_weight',
    description: '整只大鸡腿，肉质饱满多汁', selling_point: '整只大鸡腿｜肉质饱满｜酱烧鲜香',
    images: [], sales: 2100, price_per_jin: 1580, weight_options: [500, 1000, 1500],
    processing_options: ['整只', '切块'], processing_fee: 0, delivery_modes: ['delivery', 'pickup'],
    minPrice: '15.80', out_of_stock: false, status: 'on'
  },
  {
    _id: 'prod_04', name: '去骨鸡腿排', categoryId: 'cat_04', pricing_type: 'exact_weight',
    description: '已去骨，方便烹饪，适合煎烤', selling_point: '已去骨｜方便烹饪｜适合煎烤',
    images: [], sales: 850, price_per_jin: 1980, weight_options: [500, 1000],
    processing_options: ['整只', '切块'], processing_fee: 200, delivery_modes: ['delivery', 'pickup'],
    minPrice: '21.80', out_of_stock: false, status: 'on'
  },
  {
    _id: 'prod_05', name: '鸡中翅', categoryId: 'cat_04', pricing_type: 'exact_weight',
    description: '精选鸡中翅，胶原蛋白丰富', selling_point: '胶原蛋白丰富｜骨酥肉嫩｜可乐红烧',
    images: [], sales: 3200, price_per_jin: 2280, weight_options: [500, 1000, 1500],
    processing_options: ['整只', '切块'], processing_fee: 0, delivery_modes: ['delivery', 'pickup'],
    minPrice: '22.80', out_of_stock: false, status: 'on'
  },
  {
    _id: 'prod_06', name: '鸡全翅', categoryId: 'cat_04', pricing_type: 'exact_weight',
    description: '翅根翅中翅尖完整保留', selling_point: '整翅完整｜翅根翅中翅尖｜卤香四溢',
    images: [], sales: 1560, price_per_jin: 1880, weight_options: [500, 1000, 1500],
    processing_options: ['整只', '切块'], processing_fee: 0, delivery_modes: ['delivery', 'pickup'],
    minPrice: '18.80', out_of_stock: false, status: 'on'
  },
  {
    _id: 'prod_07', name: '鸡大胸', categoryId: 'cat_03', pricing_type: 'exact_weight',
    description: '低脂高蛋白，健身必备', selling_point: '低脂高蛋白｜健身必备｜鸡胸沙拉',
    images: [], sales: 2800, price_per_jin: 1480, weight_options: [500, 1000, 1500],
    processing_options: ['整只', '切块'], processing_fee: 0, delivery_modes: ['delivery', 'pickup'],
    minPrice: '14.80', out_of_stock: false, status: 'on'
  },
  {
    _id: 'prod_08', name: '鸡小胸（鸡里脊）', categoryId: 'cat_03', pricing_type: 'exact_weight',
    description: '鸡身上最嫩的部位', selling_point: '鸡身最嫩｜口感细腻｜快炒佳品',
    images: [], sales: 1200, price_per_jin: 1780, weight_options: [500, 1000],
    processing_options: ['整只', '切块'], processing_fee: 0, delivery_modes: ['delivery', 'pickup'],
    minPrice: '17.80', out_of_stock: false, status: 'on'
  },
  {
    _id: 'prod_09', name: '鸡胗', categoryId: 'cat_05', pricing_type: 'exact_weight',
    description: '新鲜鸡胗，脆嫩爽口', selling_point: '新鲜鸡胗｜脆嫩爽口｜爆炒下饭',
    images: [], sales: 980, price_per_jin: 1680, weight_options: [500, 1000],
    processing_options: ['整只', '切块'], processing_fee: 0, delivery_modes: ['delivery', 'pickup'],
    minPrice: '16.80', out_of_stock: false, status: 'on'
  },
  {
    _id: 'prod_10', name: '鸡心', categoryId: 'cat_05', pricing_type: 'exact_weight',
    description: '新鲜鸡心，营养丰富', selling_point: '新鲜鸡心｜营养丰富｜卤制入味',
    images: [], sales: 670, price_per_jin: 1280, weight_options: [500, 1000],
    processing_options: ['整只', '切块'], processing_fee: 0, delivery_modes: ['delivery', 'pickup'],
    minPrice: '12.80', out_of_stock: false, status: 'on'
  },
  {
    _id: 'prod_11', name: '乳鸽', categoryId: 'cat_01', pricing_type: 'per_piece',
    description: '25天乳鸽，肉质细嫩，煲汤红烧皆宜', selling_point: '25天乳鸽｜肉质细嫩｜煲汤红烧',
    images: [], sales: 540, unit_price: 2500, processing_options: ['整只', '切块'],
    processing_fee: 0, delivery_modes: ['delivery', 'pickup'], minPrice: '25.00', out_of_stock: false, status: 'on'
  },
  {
    _id: 'prod_12', name: '老鸽', categoryId: 'cat_01', pricing_type: 'per_piece',
    description: '1年以上老鸽，煲汤上品', selling_point: '1年以上老鸽｜滋补佳品｜煲汤上品',
    images: [], sales: 320, unit_price: 3500, processing_options: ['整只', '切块'],
    processing_fee: 0, delivery_modes: ['delivery', 'pickup'], minPrice: '35.00', out_of_stock: false, status: 'on'
  },
  {
    _id: 'prod_13', name: '半片鸭', categoryId: 'cat_02', pricing_type: 'exact_weight',
    description: '优质半片鸭，适合红烧、炖汤', selling_point: '优质半片鸭｜红烧炖汤｜酱香浓郁',
    images: [], sales: 680, price_per_jin: 1280, weight_options: [1000, 1500, 2000],
    processing_options: ['整只', '切块'], processing_fee: 0, delivery_modes: ['delivery', 'pickup'],
    minPrice: '25.60', out_of_stock: false, status: 'on'
  },
  {
    _id: 'prod_14', name: '鸭腿', categoryId: 'cat_02', pricing_type: 'exact_weight',
    description: '大只鸭腿，肉质紧实有嚼劲', selling_point: '大只鸭腿｜肉质紧实｜慢炖入味',
    images: [], sales: 520, price_per_jin: 1380, weight_options: [500, 1000, 1500],
    processing_options: ['整只', '切块'], processing_fee: 0, delivery_modes: ['delivery', 'pickup'],
    minPrice: '13.80', out_of_stock: false, status: 'on'
  },
  {
    _id: 'prod_15', name: '鸭胗', categoryId: 'cat_05', pricing_type: 'exact_weight',
    description: '新鲜鸭胗，口感脆爽', selling_point: '新鲜鸭胗｜口感脆爽｜凉拌爆炒',
    images: [], sales: 430, price_per_jin: 1580, weight_options: [500, 1000],
    processing_options: ['整只', '切块'], processing_fee: 0, delivery_modes: ['delivery', 'pickup'],
    minPrice: '15.80', out_of_stock: false, status: 'on'
  },
  {
    _id: 'prod_16', name: '鸡脚', categoryId: 'cat_06', pricing_type: 'exact_weight',
    description: '新鲜大鸡脚，胶原蛋白丰富', selling_point: '新鲜大鸡脚｜胶原蛋白丰富｜卤制Q弹',
    images: [], sales: 1560, price_per_jin: 1680, weight_options: [500, 1000],
    processing_options: ['整只', '切块'], processing_fee: 0, delivery_modes: ['delivery', 'pickup'],
    minPrice: '16.80', out_of_stock: false, status: 'on'
  },
  {
    _id: 'prod_17', name: '鸭脚', categoryId: 'cat_06', pricing_type: 'exact_weight',
    description: '新鲜鸭脚，煲汤红烧皆宜', selling_point: '新鲜鸭脚｜煲汤红烧皆宜｜酱香软糯',
    images: [], sales: 890, price_per_jin: 1480, weight_options: [500, 1000],
    processing_options: ['整只', '切块'], processing_fee: 0, delivery_modes: ['delivery', 'pickup'],
    minPrice: '14.80', out_of_stock: true, status: 'off'
  }
]

// ========== 广告 ==========
const MOCK_BANNERS = []

// ========== 订单 ==========
const MOCK_ORDERS = []

// ========== 店铺配置 ==========
const STORE_CONFIG = {
  merchant_01: {
    name: '小鲜鸡店铺（旗舰店）', deliveryRadius: 5, latitude: 23.1291, longitude: 113.2644,
    address: '广州市天河区体育西路123号', contactName: '张老板', contactPhone: '13800000000',
    openTime: '08:00', closeTime: '21:00', subMchId: '1747616717'
  }
}

// ========== 号码牌 ==========
const PAI_NUMBERS = []
for (let i = 1; i <= 30; i++) {
  const num = String(i).padStart(2, '0')
  PAI_NUMBERS.push({
    _id: 'pai_' + num, number: num,
    status: i <= 20 ? 'idle' : (i <= 25 ? 'in_use' : 'used'),
    orderNo: i > 20 && i <= 25 ? 'ORD2024061500' + i : ''
  })
}

let mockOrderSeq = 0
let mockOfflineSeq = 0
let mockBannerSeq = 0

// ========== 辅助函数 ==========

function formatMoney(fen) {
  return (fen / 100).toFixed(2)
}

function getStatusText(status, type) {
  if (type === 'offline') {
    const map = { pending: '待处理', processing: '处理中', ready: '待取货', completed: '已完成', cancelled: '已取消' }
    return map[status] || status
  }
  const map = {
    pending: '待支付', paid: '已支付', accepted: '已接单', weighed: '已称重',
    processing: '处理中', ready: '待取货', delivering: '配送中', completed: '已完成',
    cancelled: '已取消', refundFailed: '退款异常'
  }
  return map[status] || status
}

function now() { return new Date().toISOString() }

function genOrderNo(prefix = 'ORD') {
  const d = new Date()
  return prefix + d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0') + String(++mockOrderSeq).padStart(3, '0')
}

// ========== 创建一些种子订单 ==========
function seedOrders() {
  if (MOCK_ORDERS.length > 0) return
  const statuses = ['paid', 'paid', 'accepted', 'weighed', 'processing', 'processing', 'ready', 'delivering', 'completed', 'completed']
  const types = ['delivery', 'delivery', 'pickup', 'delivery', 'pickup', 'delivery', 'pickup', 'delivery', 'delivery', 'pickup']
  for (let i = 0; i < 10; i++) {
    const orderNo = genOrderNo('ORD')
    const type = types[i]
    const cardNum = String(i + 1).padStart(2, '0')
    const item = PRODUCTS[i % PRODUCTS.length]
    const prepayAmount = item.pricing_type === 'per_piece' ? item.unit_price : (item.pricing_type === 'exact_weight' ? item.price_per_jin * 2 : 1700 * 2)
    MOCK_ORDERS.push({
      _id: 'ord_' + orderNo, orderNo, type: 'online',
      items: [{ productId: item._id, productName: item.name, quantity: 1, unitPrice: prepayAmount, categoryName: CATEGORIES.find(c => c._id === item.categoryId)?.name || '' }],
      status: statuses[i], createTime: new Date(Date.now() - (10 - i) * 3600000).toISOString(),
      prepayAmount, actualAmount: statuses[i] === 'completed' ? prepayAmount - 200 : null,
      cardNumber: cardNum, deliveryType: type,
      deliveryAddress: { name: '张三', phone: '13800138000', province: '广东省', city: '广州市', district: '天河区', detail: '体育西路' + (i + 1) + '号' },
      weighPhoto: statuses[i] === 'weighed' ? 'https://via.placeholder.com/200' : '',
      refundAmount: statuses[i] === 'completed' && i === 3 ? 200 : 0
    })
  }
  // 再加几个线下订单
  for (let i = 0; i < 5; i++) {
    const orderNo = 'OFF' + new Date().getFullYear() + String(new Date().getMonth() + 1).padStart(2, '0') + String(new Date().getDate()).padStart(2, '0') + String(++mockOfflineSeq).padStart(3, '0')
    MOCK_ORDERS.push({
      _id: 'off_' + orderNo, orderNo, type: 'offline',
      items: [], status: ['processing', 'processing', 'ready', 'completed', 'completed'][i],
      createTime: new Date(Date.now() - (5 - i) * 7200000).toISOString(),
      prepayAmount: (15 + i * 5) * 100, actualAmount: (15 + i * 5) * 100,
      cardNumber: String(21 + i).padStart(2, '0'), deliveryType: 'pickup',
      deliveryAddress: {}
    })
  }
}
seedOrders()

// ========== HTTP Mock 路由 ==========

/**
 * 简单路径匹配（支持 :param 动态参数）
 */
function matchRoute(pattern, actual) {
  const patternParts = pattern.split('/')
  const actualParts = actual.split('/')
  if (patternParts.length !== actualParts.length) return null
  const params = {}
  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i].startsWith(':')) {
      params[patternParts[i].slice(1)] = actualParts[i]
    } else if (patternParts[i] !== actualParts[i]) {
      return null
    }
  }
  return params
}

export function getMockResponse(method, path, data = {}) {
  const success = (d) => ({ success: true, data: d })
  const fail = (msg) => ({ success: false, message: msg })

  // ========== Auth ==========
  if (method === 'POST' && path === '/auth/merchant-login') {
    return success({
      accessToken: 'mock_admin_at_' + Date.now(),
      refreshToken: 'mock_admin_rt_' + Date.now(),
      merchantId: 'merchant_01',
      role: 'admin'
    })
  }
  if (method === 'POST' && path === '/auth/refresh-token') {
    return success({ accessToken: 'mock_refreshed_at_' + Date.now(), refreshToken: data.refreshToken })
  }

  // ========== Categories ==========
  if (method === 'GET' && path === '/categories') {
    return success({ categories: [...CATEGORIES] })
  }
  if (method === 'POST' && path === '/categories') {
    const cat = { _id: 'cat_' + Date.now(), name: data.name, sort: CATEGORIES.length + 1 }
    CATEGORIES.push(cat)
    return success(cat)
  }
  if (method === 'PUT' && path === '/categories/sort') {
    (data.sorts || []).forEach(s => {
      const cat = CATEGORIES.find(c => c._id === s._id)
      if (cat) cat.sort = s.sort
    })
    return success({ sorted: true })
  }
  const catDelMatch = matchRoute('/categories/:id', path)
  if (method === 'DELETE' && catDelMatch) {
    const idx = CATEGORIES.findIndex(c => c._id === catDelMatch.id)
    if (idx >= 0) { CATEGORIES.splice(idx, 1); return success({ deleted: true }) }
    return fail('分类不存在')
  }

  // ========== Products ==========
  if (method === 'GET' && path === '/products') {
    let filtered = [...PRODUCTS]
    if (data.status === 'all') { /* 不过滤 */ } else {
      filtered = filtered.filter(p => p.status === 'on')
    }
    if (data.categoryId && data.categoryId !== 'cat_00') {
      filtered = filtered.filter(p => p.categoryId === data.categoryId)
    }
    if (data.keyword) {
      const kw = data.keyword.toLowerCase()
      filtered = filtered.filter(p => (p.name || '').toLowerCase().includes(kw) || (p.selling_point || '').toLowerCase().includes(kw))
    }
    const page = data.page || 1
    const pageSize = data.pageSize || 50
    const start = (page - 1) * pageSize
    return success({ products: filtered.slice(start, start + pageSize), total: filtered.length })
  }
  const prodMatch = matchRoute('/products/:id', path)
  if (method === 'GET' && prodMatch) {
    const product = PRODUCTS.find(p => p._id === prodMatch.id)
    return product ? success({ product }) : fail('商品不存在')
  }
  if (method === 'POST' && path === '/products') {
    const product = {
      _id: 'prod_' + Date.now(), name: data.name, categoryId: data.categoryId, pricing_type: data.pricingType,
      selling_point: data.sellingPoint || '', description: data.description || '',
      images: data.images || [], sales: 0, delivery_modes: data.deliveryModes || ['delivery', 'pickup'],
      processing_options: data.processingOptions || [], status: 'on', out_of_stock: false, minPrice: '0.00'
    }
    if (data.pricingType === 'exact_weight') {
      product.price_per_jin = data.pricePerJin || 0
      product.weight_options = data.weightOptions || [500]
      product.processing_fee = data.processingFee || 0
    } else if (data.pricingType === 'per_piece') {
      product.unit_price = data.unitPrice || 0
      product.processing_fee = data.processingFee || 0
    } else if (data.pricingType === 'range_weight') {
      product.specs = data.specs || []
    }
    PRODUCTS.push(product)
    return success({ product })
  }
  if (method === 'PUT' && prodMatch) {
    const idx = PRODUCTS.findIndex(p => p._id === prodMatch.id)
    if (idx < 0) return fail('商品不存在')
    const p = PRODUCTS[idx]
    if (data.name !== undefined) p.name = data.name
    if (data.categoryId !== undefined) p.categoryId = data.categoryId
    if (data.pricingType !== undefined) p.pricing_type = data.pricingType
    if (data.sellingPoint !== undefined) p.selling_point = data.sellingPoint
    if (data.description !== undefined) p.description = data.description
    if (data.images !== undefined) p.images = data.images
    if (data.deliveryModes !== undefined) p.delivery_modes = data.deliveryModes
    if (data.pricePerJin !== undefined) p.price_per_jin = data.pricePerJin
    if (data.weightOptions !== undefined) p.weight_options = data.weightOptions
    if (data.processingFee !== undefined) p.processing_fee = data.processingFee
    if (data.processingOptions !== undefined) p.processing_options = data.processingOptions
    if (data.unitPrice !== undefined) p.unit_price = data.unitPrice
    if (data.specs !== undefined) p.specs = data.specs
    PRODUCTS[idx] = p
    return success({ product: p })
  }
  const statusMatch = matchRoute('/products/:id/status', path)
  if (method === 'PATCH' && statusMatch) {
    const p = PRODUCTS.find(pr => pr._id === statusMatch.id)
    if (!p) return fail('商品不存在')
    if (data.status) p.status = data.status
    if (data.outOfStock !== undefined) p.out_of_stock = data.outOfStock
    return success({ product: p })
  }

  // ========== Banners ==========
  if (method === 'GET' && path === '/banners') {
    return success({ banners: [...MOCK_BANNERS] })
  }
  if (method === 'PUT' && path === '/banners') {
    MOCK_BANNERS.splice(0, MOCK_BANNERS.length, ...(data.banners || []))
    return success({ banners: [...MOCK_BANNERS] })
  }

  // ========== Orders (Customer) ==========
  if (method === 'GET' && path === '/orders') {
    let filtered = [...MOCK_ORDERS].filter(o => o.type === 'online')
    if (data.status) {
      const statuses = data.status.split(',')
      filtered = filtered.filter(o => statuses.includes(o.status))
    }
    const page = data.page || 1
    const pageSize = data.pageSize || 10
    const start = (page - 1) * pageSize
    return success({ orders: filtered.slice(start, start + pageSize), total: filtered.length })
  }
  const orderMatch = matchRoute('/orders/:orderNo', path)
  if (method === 'GET' && orderMatch) {
    const order = MOCK_ORDERS.find(o => o.orderNo === orderMatch.orderNo)
    return order ? success({ order }) : fail('订单不存在')
  }
  if (method === 'POST' && path === '/orders') {
    // 创建订单（模拟）
    const orderNo = genOrderNo('ORD')
    const items = (data.items || []).map(item => {
      const product = PRODUCTS.find(p => p._id === item.productId)
      return { ...item, productName: product ? product.name : item.productName }
    })
    const totalAmount = items.reduce((s, i) => s + (i.unitPrice || 0) * (i.quantity || 1), 0)
    const order = {
      _id: 'ord_' + orderNo, orderNo, type: 'online', items, status: 'pending',
      createTime: now(), prepayAmount: totalAmount, actualAmount: null,
      cardNumber: '', deliveryType: data.type || 'delivery', deliveryAddress: data.deliveryAddress || {},
      weighPhoto: '', refundAmount: 0
    }
    MOCK_ORDERS.unshift(order)
    return success({ orderNo, payment: { timeStamp: '', nonceStr: '', package: '', signType: 'MD5', paySign: '' } })
  }
  if (method === 'POST' && orderMatch && path.endsWith('/pay')) {
    const order = MOCK_ORDERS.find(o => o.orderNo === orderMatch.orderNo)
    if (!order) return fail('订单不存在')
    if (data.mockPay) { order.status = 'paid'; return success({ paid: true }) }
    return success({ payment: { timeStamp: '', nonceStr: '', package: '', signType: 'MD5', paySign: '' } })
  }
  if (method === 'POST' && orderMatch && path.endsWith('/cancel')) {
    const order = MOCK_ORDERS.find(o => o.orderNo === orderMatch.orderNo)
    if (!order) return fail('订单不存在')
    order.status = 'cancelled'
    return success({ cancelled: true })
  }

  // ========== Merchant Orders ==========
  if (method === 'GET' && path === '/merchant/orders') {
    let filtered = [...MOCK_ORDERS]
    if (data.status) {
      const statuses = data.status.split(',')
      filtered = filtered.filter(o => statuses.includes(o.status))
    }
    if (data.type) filtered = filtered.filter(o => o.type === data.type)
    if (data.startDate) filtered = filtered.filter(o => o.createTime >= data.startDate)
    if (data.endDate) filtered = filtered.filter(o => o.createTime < data.endDate)
    filtered.sort((a, b) => new Date(b.createTime) - new Date(a.createTime))
    const pageSize = data.pageSize || 50
    return success({ orders: filtered.slice(0, pageSize), total: filtered.length })
  }
  if (method === 'POST' && path === '/merchant/offline-orders') {
    const orderNo = 'OFF' + new Date().getFullYear() + String(new Date().getMonth() + 1).padStart(2, '0') + String(new Date().getDate()).padStart(2, '0') + String(++mockOfflineSeq).padStart(3, '0')
    const order = {
      _id: 'off_' + orderNo, orderNo, type: 'offline', items: [], status: 'pending',
      createTime: now(), prepayAmount: data.amount, actualAmount: data.amount,
      cardNumber: data.cardNumber || '', deliveryType: 'pickup', deliveryAddress: {},
      weighPhoto: '', refundAmount: 0
    }
    MOCK_ORDERS.unshift(order)
    return success({ orderNo })
  }
  // Merchant order actions: /merchant/orders/:orderNo/:action
  const merchActionMatch = (() => {
    const parts = path.split('/')
    if (parts.length === 5 && parts[1] === 'merchant' && parts[2] === 'orders') {
      return { orderNo: parts[3], action: parts[4] }
    }
    return null
  })()
  if (method === 'POST' && merchActionMatch) {
    const order = MOCK_ORDERS.find(o => o.orderNo === merchActionMatch.orderNo)
    if (!order) return fail('订单不存在')
    const { action } = merchActionMatch
    if (action === 'accept') order.status = 'accepted'
    else if (action === 'process') order.status = 'processing'
    else if (action === 'ready') order.status = 'ready'
    else if (action === 'deliver') order.status = 'delivering'
    else if (action === 'complete') { order.status = 'completed'; if (!order.actualAmount) order.actualAmount = order.prepayAmount }
    else if (action === 'mark-paid') order.status = 'paid'
    else if (action === 'weigh') {
      order.status = 'weighed'
      order.actualAmount = data.actualWeight ? Math.floor((data.actualWeight / 500) * (data.pricePerJin || 1700)) + (data.processingFee || 0) : order.prepayAmount
      order.weighPhoto = data.weighPhoto || ''
    } else if (action === 'refund') {
      order.refundAmount = (order.prepayAmount || 0) - (order.actualAmount || 0)
      if (order.refundAmount < 0) order.refundAmount = 0
    } else { return fail('未知操作: ' + action) }
    return success({ order })
  }

  // ========== Pai Numbers ==========
  if (method === 'GET' && path === '/pai-numbers') {
    return success({ numbers: [...PAI_NUMBERS] })
  }
  const paiCodeMatch = matchRoute('/pai-numbers/:number/code', path)
  if (method === 'GET' && paiCodeMatch) {
    return success({ codeImageFileID: 'cloud://mock/pai_' + paiCodeMatch.number + '.png' })
  }
  const paiReleaseMatch = matchRoute('/pai-numbers/:number/release', path)
  if (method === 'POST' && paiReleaseMatch) {
    const pai = PAI_NUMBERS.find(p => p.number === paiReleaseMatch.number)
    if (pai) { pai.status = 'idle'; pai.orderNo = '' }
    return success({ released: true })
  }

  // ========== Store ==========
  if (method === 'GET' && path === '/store') {
    const mid = data.merchantId || 'merchant_01'
    const config = STORE_CONFIG[mid] || STORE_CONFIG.merchant_01
    return success({ config: { ...config } })
  }
  if (method === 'PUT' && path === '/store') {
    const mid = data.merchantId || 'merchant_01'
    if (!STORE_CONFIG[mid]) STORE_CONFIG[mid] = { ...STORE_CONFIG.merchant_01 }
    const cfg = STORE_CONFIG[mid]
    if (data.name !== undefined) cfg.name = data.name
    if (data.address !== undefined) cfg.address = data.address
    if (data.latitude !== undefined) cfg.latitude = data.latitude
    if (data.longitude !== undefined) cfg.longitude = data.longitude
    if (data.deliveryRadius !== undefined) cfg.deliveryRadius = data.deliveryRadius
    if (data.openTime !== undefined) cfg.openTime = data.openTime
    if (data.closeTime !== undefined) cfg.closeTime = data.closeTime
    if (data.contactName !== undefined) cfg.contactName = data.contactName
    if (data.contactPhone !== undefined) cfg.contactPhone = data.contactPhone
    return success({ config: { ...cfg } })
  }

  // ========== Dashboard ==========
  if (method === 'GET' && path === '/dashboard') {
    const paid = MOCK_ORDERS.filter(o => o.status === 'paid' && o.type === 'online').length
    const active = MOCK_ORDERS.filter(o => ['accepted', 'weighed', 'processing'].includes(o.status) && o.type === 'online').length
    const today = new Date().toISOString().slice(0, 10)
    const todayOrders = MOCK_ORDERS.filter(o => o.createTime.startsWith(today))
    const todayRevenue = todayOrders.reduce((s, o) => s + (o.actualAmount || o.prepayAmount || 0), 0)
    return success({ pendingCount: paid, activeCount: active, todayOrders: todayOrders.length, todayRevenue: formatMoney(todayRevenue) })
  }

  // ========== Upload ==========
  if (method === 'POST' && path === '/upload/image') {
    return success({ url: 'https://via.placeholder.com/400x300?text=Uploaded' })
  }

  // ========== Dev ==========
  if (method === 'POST' && path === '/dev/clear-mock-orders') {
    MOCK_ORDERS.splice(0, MOCK_ORDERS.length)
    mockOrderSeq = 0
    mockOfflineSeq = 0
    seedOrders()
    return success({ cleared: true })
  }
  if (method === 'POST' && path === '/dev/clear-test-data') {
    MOCK_ORDERS.splice(0, MOCK_ORDERS.length)
    MOCK_BANNERS.splice(0, MOCK_BANNERS.length)
    mockOrderSeq = 0; mockOfflineSeq = 0; mockBannerSeq = 0
    seedOrders()
    return success({ cleared: true })
  }

  return null
}
