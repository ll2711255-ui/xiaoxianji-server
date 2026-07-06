/**
 * 本地 Mock 数据（开发阶段云环境不可用时使用）
 *
 * 数据结构对应云函数返回格式：
 * - getProducts(action='categories') → { categories: [...] }
 * - getProducts(action='list')       → { products: [...] }
 */

const CATEGORIES = [
  { _id: 'cat_00', name: '今日推荐', sort: 0 },
  { _id: 'cat_01', name: '鸡', sort: 1 },
  { _id: 'cat_02', name: '鸭', sort: 2 },
  { _id: 'cat_03', name: '鸡胸肉', sort: 3 },
  { _id: 'cat_04', name: '鸡腿/鸡翅', sort: 4 },
  { _id: 'cat_05', name: '鸡杂/鸭杂', sort: 5 },
  { _id: 'cat_06', name: '鸡脚/鸭脚', sort: 6 }
];

const PRODUCTS = [
  // ========== 整鸡（range_weight）==========
  {
    _id: 'prod_01',
    name: '清远走地鸡',
    categoryId: 'cat_01',
    pricing_type: 'range_weight',
    description: '散养180天，肉质紧实有嚼劲',
    selling_point: '散养180天｜肉质紧实｜白切红烧皆宜',
    images: [],
    sales: 1280,
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
    processing_options: ['整只', '切块'],
    delivery_modes: ['delivery', 'pickup'],
    minPrice: '21.60',
    out_of_stock: false,
    status: 'on'
  },
  {
    _id: 'prod_02',
    name: '文昌鸡',
    categoryId: 'cat_01',
    pricing_type: 'range_weight',
    description: '海南文昌鸡，皮脆肉嫩，白切首选',
    selling_point: '海南正宗｜皮脆肉嫩｜白切首选',
    images: [],
    sales: 960,
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
    processing_options: ['整只', '切块'],
    delivery_modes: ['delivery', 'pickup'],
    minPrice: '21.60',
    out_of_stock: false,
    status: 'on'
  },

  // ========== 鸡腿（exact_weight）==========
  {
    _id: 'prod_03',
    name: '新鲜鸡全腿',
    categoryId: 'cat_04',
    pricing_type: 'exact_weight',
    description: '整只大鸡腿，肉质饱满多汁',
    selling_point: '整只大鸡腿｜肉质饱满｜酱烧鲜香',
    images: [],
    sales: 2100,
    price_per_jin: 1580,
    weight_options: [500, 1000, 1500],
    processing_options: ['整只', '切块'],
    processing_fee: 0,
    delivery_modes: ['delivery', 'pickup'],
    minPrice: '15.80',
    out_of_stock: false,
    status: 'on'
  },
  {
    _id: 'prod_04',
    name: '去骨鸡腿排',
    categoryId: 'cat_04',
    pricing_type: 'exact_weight',
    description: '已去骨，方便烹饪，适合煎烤',
    selling_point: '已去骨｜方便烹饪｜适合煎烤',
    images: [],
    sales: 850,
    price_per_jin: 1980,
    weight_options: [500, 1000],
    processing_options: ['整只', '切块'],
    processing_fee: 200,
    delivery_modes: ['delivery', 'pickup'],
    minPrice: '21.80',
    out_of_stock: false,
    status: 'on'
  },

  // ========== 鸡翅（exact_weight）==========
  {
    _id: 'prod_05',
    name: '鸡中翅',
    categoryId: 'cat_04',
    pricing_type: 'exact_weight',
    description: '精选鸡中翅，胶原蛋白丰富',
    selling_point: '胶原蛋白丰富｜骨酥肉嫩｜可乐红烧',
    images: [],
    sales: 3200,
    price_per_jin: 2280,
    weight_options: [500, 1000, 1500],
    processing_options: ['整只', '切块'],
    processing_fee: 0,
    delivery_modes: ['delivery', 'pickup'],
    minPrice: '22.80',
    out_of_stock: false,
    status: 'on'
  },
  {
    _id: 'prod_06',
    name: '鸡全翅',
    categoryId: 'cat_04',
    pricing_type: 'exact_weight',
    description: '翅根翅中翅尖完整保留',
    selling_point: '整翅完整｜翅根翅中翅尖｜卤香四溢',
    images: [],
    sales: 1560,
    price_per_jin: 1880,
    weight_options: [500, 1000, 1500],
    processing_options: ['整只', '切块'],
    processing_fee: 0,
    delivery_modes: ['delivery', 'pickup'],
    minPrice: '18.80',
    out_of_stock: false,
    status: 'on'
  },

  // ========== 鸡胸（exact_weight）==========
  {
    _id: 'prod_07',
    name: '鸡大胸',
    categoryId: 'cat_03',
    pricing_type: 'exact_weight',
    description: '低脂高蛋白，健身必备',
    selling_point: '低脂高蛋白｜健身必备｜鸡胸沙拉',
    images: [],
    sales: 2800,
    price_per_jin: 1480,
    weight_options: [500, 1000, 1500],
    processing_options: ['整只', '切块'],
    processing_fee: 0,
    delivery_modes: ['delivery', 'pickup'],
    minPrice: '14.80',
    out_of_stock: false,
    status: 'on'
  },
  {
    _id: 'prod_08',
    name: '鸡小胸（鸡里脊）',
    categoryId: 'cat_03',
    pricing_type: 'exact_weight',
    description: '鸡身上最嫩的部位',
    selling_point: '鸡身最嫩｜口感细腻｜快炒佳品',
    images: [],
    sales: 1200,
    price_per_jin: 1780,
    weight_options: [500, 1000],
    processing_options: ['整只', '切块'],
    processing_fee: 0,
    delivery_modes: ['delivery', 'pickup'],
    minPrice: '17.80',
    out_of_stock: false,
    status: 'on'
  },

  // ========== 内脏（exact_weight）==========
  {
    _id: 'prod_09',
    name: '鸡胗',
    categoryId: 'cat_05',
    pricing_type: 'exact_weight',
    description: '新鲜鸡胗，脆嫩爽口',
    selling_point: '新鲜鸡胗｜脆嫩爽口｜爆炒下饭',
    images: [],
    sales: 980,
    price_per_jin: 1680,
    weight_options: [500, 1000],
    processing_options: ['整只', '切块'],
    processing_fee: 0,
    delivery_modes: ['delivery', 'pickup'],
    minPrice: '16.80',
    out_of_stock: false,
    status: 'on'
  },
  {
    _id: 'prod_10',
    name: '鸡心',
    categoryId: 'cat_05',
    pricing_type: 'exact_weight',
    description: '新鲜鸡心，营养丰富',
    selling_point: '新鲜鸡心｜营养丰富｜卤制入味',
    images: [],
    sales: 670,
    price_per_jin: 1280,
    weight_options: [500, 1000],
    processing_options: ['整只', '切块'],
    processing_fee: 0,
    delivery_modes: ['delivery', 'pickup'],
    minPrice: '12.80',
    out_of_stock: false,
    status: 'on'
  },

  // ========== 鸽子（per_piece）==========
  {
    _id: 'prod_11',
    name: '乳鸽',
    categoryId: 'cat_01',
    pricing_type: 'per_piece',
    description: '25天乳鸽，肉质细嫩，煲汤红烧皆宜',
    selling_point: '25天乳鸽｜肉质细嫩｜煲汤红烧',
    images: [],
    sales: 540,
    unit_price: 2500,
    processing_options: ['整只', '切块'],
    processing_fee: 0,
    delivery_modes: ['delivery', 'pickup'],
    minPrice: '25.00',
    out_of_stock: false,
    status: 'on'
  },
  {
    _id: 'prod_12',
    name: '老鸽',
    categoryId: 'cat_01',
    pricing_type: 'per_piece',
    description: '1年以上老鸽，煲汤上品',
    selling_point: '1年以上老鸽｜滋补佳品｜煲汤上品',
    images: [],
    sales: 320,
    unit_price: 3500,
    processing_options: ['整只', '切块'],
    processing_fee: 0,
    delivery_modes: ['delivery', 'pickup'],
    minPrice: '35.00',
    out_of_stock: false,
    status: 'on'
  },

  // ========== 鸭（cat_02）==========
  {
    _id: 'prod_13',
    name: '半片鸭',
    categoryId: 'cat_02',
    pricing_type: 'exact_weight',
    description: '优质半片鸭，适合红烧、炖汤',
    selling_point: '优质半片鸭｜红烧炖汤｜酱香浓郁',
    images: [],
    sales: 680,
    price_per_jin: 1280,
    weight_options: [1000, 1500, 2000],
    processing_options: ['整只', '切块'],
    processing_fee: 0,
    delivery_modes: ['delivery', 'pickup'],
    minPrice: '25.60',
    out_of_stock: false,
    status: 'on'
  },
  {
    _id: 'prod_14',
    name: '鸭腿',
    categoryId: 'cat_02',
    pricing_type: 'exact_weight',
    description: '大只鸭腿，肉质紧实有嚼劲',
    selling_point: '大只鸭腿｜肉质紧实｜慢炖入味',
    images: [],
    sales: 520,
    price_per_jin: 1380,
    weight_options: [500, 1000, 1500],
    processing_options: ['整只', '切块'],
    processing_fee: 0,
    delivery_modes: ['delivery', 'pickup'],
    minPrice: '13.80',
    out_of_stock: false,
    status: 'on'
  },

  // ========== 鸡杂/鸭杂（cat_05）==========
  {
    _id: 'prod_15',
    name: '鸭胗',
    categoryId: 'cat_05',
    pricing_type: 'exact_weight',
    description: '新鲜鸭胗，口感脆爽',
    selling_point: '新鲜鸭胗｜口感脆爽｜凉拌爆炒',
    images: [],
    sales: 430,
    price_per_jin: 1580,
    weight_options: [500, 1000],
    processing_options: ['整只', '切块'],
    processing_fee: 0,
    delivery_modes: ['delivery', 'pickup'],
    minPrice: '15.80',
    out_of_stock: false,
    status: 'on'
  },

  // ========== 鸡脚/鸭脚（cat_06）==========
  {
    _id: 'prod_16',
    name: '鸡脚',
    categoryId: 'cat_06',
    pricing_type: 'exact_weight',
    description: '新鲜大鸡脚，胶原蛋白丰富',
    selling_point: '新鲜大鸡脚｜胶原蛋白丰富｜卤制Q弹',
    images: [],
    sales: 1560,
    price_per_jin: 1680,
    weight_options: [500, 1000],
    processing_options: ['整只', '切块'],
    processing_fee: 0,
    delivery_modes: ['delivery', 'pickup'],
    minPrice: '16.80',
    out_of_stock: false,
    status: 'on'
  },
  {
    _id: 'prod_17',
    name: '鸭脚',
    categoryId: 'cat_06',
    pricing_type: 'exact_weight',
    description: '新鲜鸭脚，煲汤红烧皆宜',
    selling_point: '新鲜鸭脚｜煲汤红烧皆宜｜酱香软糯',
    images: [],
    sales: 890,
    price_per_jin: 1480,
    weight_options: [500, 1000],
    processing_options: ['整只', '切块'],
    processing_fee: 0,
    delivery_modes: ['delivery', 'pickup'],
    minPrice: '14.80',
    status: 'on'
  }
];

// ========== Mock 首页广告 ==========
const MOCK_BANNERS = [];

// ========== Mock 订单数据 ==========
const MOCK_ORDERS = [];

// ============================================================
// 店铺配置（商家后台可配）
// ============================================================
const STORE_CONFIG = {
  merchant_01: {
    name: '小鲜鸡店铺（旗舰店）',
    deliveryRadius: 5,        // 配送半径（公里）
    latitude: 23.1291,        // 店铺纬度（广州天河）
    longitude: 113.2644,      // 店铺经度
    address: '广州市天河区体育西路123号',
    contactName: '张老板',     // 配送联系人（商家姓名）
    contactPhone: '13800000000', // 配送联系电话
    openTime: '08:00',         // 营业开始时间
    closeTime: '21:00',        // 营业结束时间
    subMchId: '1747616717'    // 微信支付子商户号
  },
  merchant_02: {
    name: '小鲜鸡店铺（分店）',
    deliveryRadius: 3,        // 配送半径（公里）
    latitude: 22.5431,        // 店铺纬度（深圳南山）
    longitude: 113.9493,      // 店铺经度
    address: '深圳市南山区科技园路56号',
    contactName: '王店长',     // 配送联系人
    contactPhone: '13800000002', // 配送联系电话
    subMchId: '1747616717'    // 微信支付子商户号
  }
};

// Mock 地址数据（含坐标用于距离计算）
let mockAddresses = [
  {
    _id: 'addr_01',
    userId: 'mock_user',
    name: '张三',
    phone: '13800138000',
    province: '广东省',
    city: '广州市',
    district: '天河区',
    detail: '体育西路123号',
    isDefault: true,
    latitude: 23.1320,
    longitude: 113.2700
  }
];

let mockAddrSeq = 1;
let mockOrderSeq = 0;
let mockOfflineSeq = 0;
let mockBannerSeq = 0;

// ============================================================
// 种子数据快照（用于重置模拟数据）
// 必须在 MOCK_ORDERS / mockAddresses / 序号初始化之后执行
// ============================================================
const SEED_ORDERS = JSON.parse(JSON.stringify(MOCK_ORDERS));
const SEED_ADDRESSES = JSON.parse(JSON.stringify(mockAddresses));
const SEED_BANNERS = JSON.parse(JSON.stringify(MOCK_BANNERS));
const SEED_ORDER_SEQ = 0;
const SEED_ADDR_SEQ = 1;
const SEED_OFFLINE_SEQ = 0;
const SEED_BANNER_SEQ = 0;

/**
 * 根据云函数请求返回对应的 mock 数据
 * @param {string} name - 云函数名
 * @param {object} data - 入参
 * @returns {object|null} 对应的 mock 数据，无匹配时返回 null
 */
function getMockResponse(name, data = {}) {
  if (name === 'getProducts') {
    if (data.action === 'categories') {
      return { categories: CATEGORIES };
    }
    if (data.action === 'list') {
      const { categoryId, page = 1, pageSize = 10, status: statusFilter } = data;
      // 商家管理端传 status='all' 可查看全部商品（含已下架）
      // 默认为客户视角：仅返回上架商品
      let filtered;
      if (statusFilter === 'all') {
        filtered = [...PRODUCTS];
      } else {
        filtered = PRODUCTS.filter(p => p.status === 'on');
      }
      if (categoryId && categoryId !== 'cat_00') {
        filtered = filtered.filter(p => p.categoryId === categoryId);
      }
      const start = (page - 1) * pageSize;
      const paged = filtered.slice(start, start + pageSize);
      // 计算最低价格用于列表展示
      const products = paged.map(p => {
        let minPrice = null;
        if (p.pricing_type === 'range_weight') {
          const prices = (p.specs || []).map(s => s.price_per_jin).filter(v => v > 0);
          if (prices.length > 0) minPrice = Math.min(...prices);
        } else if (p.pricing_type === 'exact_weight') {
          const minWeight = Math.min(...(p.weight_options && p.weight_options.length ? p.weight_options : [500]));
          minPrice = p.price_per_jin * (minWeight / 500);
        } else if (p.pricing_type === 'per_piece') {
          minPrice = p.unit_price;
        }
        return {
          ...p,
          minPrice: minPrice ? (minPrice / 100).toFixed(2) : null
        };
      });
      return { products };
    }
  }

  if (name === 'getProductDetail') {
    const product = PRODUCTS.find(p => p._id === data.productId);
    return { product: product || null };
  }

  if (name === 'getOrders') {
    const { filter, page = 1, pageSize = 10 } = data;
    let filtered = MOCK_ORDERS;
    if (filter === 'active') {
      filtered = MOCK_ORDERS.filter(o => ['pending', 'paid', 'accepted', 'weighed', 'processing', 'delivering', 'ready'].includes(o.status));
    } else if (filter === 'completed') {
      filtered = MOCK_ORDERS.filter(o => ['completed', 'cancelled'].includes(o.status));
    }
    const start = (page - 1) * pageSize;
    return { orders: filtered.slice(start, start + pageSize) };
  }

  if (name === 'getOrderDetail') {
    const order = MOCK_ORDERS.find(o => o.orderNo === data.orderNo);
    return { order: order || null };
  }

  if (name === 'getAddresses') {
    return { addresses: mockAddresses };
  }

  if (name === 'addAddress') {
    mockAddrSeq++;
    const isDefault = data.isDefault === true || mockAddresses.length === 0;
    if (isDefault) {
      mockAddresses.forEach(a => a.isDefault = false);
    }
    const addr = {
      _id: 'addr_' + String(mockAddrSeq).padStart(2, '0'),
      userId: 'mock_user',
      name: data.name,
      phone: data.phone,
      province: data.province,
      city: data.city,
      district: data.district,
      detail: data.detail,
      isDefault
    };
    mockAddresses.push(addr);
    return { success: true, addressId: addr._id };
  }

  if (name === 'updateAddress') {
    const idx = mockAddresses.findIndex(a => a._id === data.addressId);
    if (idx >= 0) {
      if (data.isDefault) {
        mockAddresses.forEach(a => a.isDefault = false);
      }
      const { addressId, ...fields } = data;
      Object.assign(mockAddresses[idx], fields);
    }
    return { success: true };
  }

  if (name === 'deleteAddress') {
    mockAddresses = mockAddresses.filter(a => a._id !== data.addressId);
    return { success: true };
  }

  if (name === 'createOrder') {
    const rawItems = data.items || [];
    if (rawItems.length === 0) return { error: '商品不能为空' };
    if (!data.type || !['delivery', 'pickup'].includes(data.type)) return { error: '取货方式无效' };
    if (data.type === 'delivery' && !data.deliveryAddress) return { error: '配送订单缺少收货地址' };

    // 配送订单：查询店铺联系方式
    let contactName = '';
    let contactPhone = '';
    if (data.type === 'delivery') {
      const storeConfig = STORE_CONFIG['merchant_01'] || {};
      contactName = storeConfig.contactName || '';
      contactPhone = storeConfig.contactPhone || '';
    }

    // 服务端计价：逐商品校验 + 计算（同 createOrder 云函数逻辑）
    const orderNos = [];
    const payBatchNo = 'A' + String(mockOrderSeq + 1).padStart(3, '0');

    for (let idx = 0; idx < rawItems.length; idx++) {
      const i = rawItems[idx];
      const spec = { ...(i.spec || {}) };
      const product = PRODUCTS.find(p => p._id === i.productId);

      // 商品校验
      if (!product) return { error: `商品 "${i.productName || i.productId}" 不存在` };
      if (product.status !== 'on') return { error: `商品 "${product.name}" 已下架` };
      if (product.out_of_stock) return { error: `商品 "${product.name}" 已售罄` };

      let unitPrice = 0; // 单价（分）
      const processingFee = (spec.processing === '切块') ? (product.processing_fee || 0) : 0;

      if (i.pricingType === 'range_weight') {
        const specs = product.specs || [];
        const matched = specs.find(s => s.type === spec.type && s.weight_label === spec.weight);
        if (!matched) return { error: `商品 "${product.name}" 规格不匹配（${spec.type || ''} ${spec.weight || ''}）` };
        const pricePerJin = matched.price_per_jin || 0;
        const weightMax = matched.weight_max || 500;
        spec.type_price_per_jin = pricePerJin;
        spec.processing_fee = processingFee;
        spec.weight_max = weightMax;
        unitPrice = Math.round((pricePerJin * weightMax) / 500) + processingFee;
      } else if (i.pricingType === 'exact_weight') {
        const pricePerJin = product.price_per_jin || 0;
        const grams = spec.weightGrams || 500;
        spec.price_per_jin = pricePerJin;
        spec.processing_fee = processingFee;
        unitPrice = Math.round((pricePerJin * grams) / 500) + processingFee;
      } else if (i.pricingType === 'per_piece') {
        const pricePerPiece = product.unit_price || 0;
        spec.unit_price = pricePerPiece;
        spec.processing_fee = processingFee;
        unitPrice = pricePerPiece + processingFee;
      } else {
        return { error: `商品 "${product.name}" 未知计价类型 ${i.pricingType}` };
      }

      // 逐商品生成独立订单号
      mockOrderSeq++;
      const orderNo = 'A' + String(mockOrderSeq).padStart(3, '0');
      orderNos.push(orderNo);

      const newOrder = {
        _id: 'order_' + String(mockOrderSeq).padStart(2, '0'),
        orderNo,
        userId: 'mock_user_001',
        type: data.type || 'pickup',
        items: [{
          productId: i.productId,
          productName: product.name,
          pricingType: i.pricingType,
          spec,
          quantity: i.quantity || 1,
          unitPrice
        }],
        prepayAmount: unitPrice * (i.quantity || 1),
        actualAmount: 0,
        actualWeight: 0,
        refundAmount: 0,
        refundStatus: 'none',
        status: 'pending',
        payBatchNo,
        deliveryAddress: data.deliveryAddress || null,
        contactName,
        contactPhone,
        isScheduled: !!data.isScheduled,
        scheduledDate: data.scheduledDate || '',
        scheduledTime: data.scheduledTime || '',
        createTime: new Date().toISOString().replace('T', ' ').slice(0, 19)
      };
      MOCK_ORDERS.unshift(newOrder);
    }

    // 返回与云函数一致的格式（orderNo 单数 + payment），同时保留 orderNos 数组供其他场景
    return {
      orderId: 'order_' + String(mockOrderSeq).padStart(2, '0'),
      orderNo: orderNos[0], // 与云函数一致：首个订单号
      orderNos,
      payBatchNo,
      payment: {
        timeStamp: String(Date.now()),
        nonceStr: 'mock_nonce_' + Date.now(),
        package: 'prepay_id=mock_' + Date.now(),
        signType: 'MD5',
        paySign: 'mock_sign_' + Date.now()
      }
    };
  }

  if (name === 'payCallback') {
    // 解析 attach 获取批次订单号列表
    let orderNos = [];
    try {
      const attach = typeof data.attach === 'string' ? JSON.parse(data.attach) : (data.attach || {});
      orderNos = attach.orderNos || [data.outTradeNo];
    } catch (_) {
      orderNos = [data.outTradeNo];
    }
    // 批量更新订单状态
    let updated = 0;
    orderNos.forEach(orderNo => {
      const order = MOCK_ORDERS.find(o => o.orderNo === orderNo);
      if (order && order.status === 'pending') {
        order.status = 'paid';
        order.payTime = new Date().toISOString().replace('T', ' ').slice(0, 19);
        updated++;
      }
    });
    if (updated === 0 && orderNos.length > 0) {
      const first = MOCK_ORDERS.find(o => o.orderNo === orderNos[0]);
      if (!first) return { message: 'FAIL', reason: '订单不存在' };
      return { message: 'SUCCESS', reason: '已处理' };
    }
    return { message: 'SUCCESS', updated };
  }

  if (name === 'mockPay') {
    // 开发模式一键支付：批量更新订单状态
    const orderNos = data.orderNos || (data.orderNo ? [data.orderNo] : []);
    if (orderNos.length === 0) return { error: 'orderNos 不能为空' };
    let updated = 0;
    orderNos.forEach(orderNo => {
      const order = MOCK_ORDERS.find(o => o.orderNo === orderNo);
      if (order && order.status === 'pending') {
        order.status = 'paid';
        order.payTime = new Date().toISOString().replace('T', ' ').slice(0, 19);
        order.wxTransactionId = 'mock_' + Date.now();
        updated++;
      }
    });
    return { success: true, orderNos, updated, status: 'paid' };
  }

  if (name === 'cancelOrder') {
    const order = MOCK_ORDERS.find(o => o.orderNo === data.orderNo);
    if (order) {
      order.status = 'cancelled';
      order.refundAmount = order.prepayAmount;
      order.refundStatus = 'done';
      // 释放号码牌
      if (order.cardNumber) {
        const pai = MOCK_PAI_NUMBERS.find(p => p.number === order.cardNumber);
        if (pai) { pai.status = 'idle'; pai.orderId = ''; }
      }
    }
    return { success: true };
  }

  if (name === 'getPickupStatus') {
    // Token 验证（mock 模式跳过加密，仅检查 token 非空）
    if (!data.token) return { code: -1, status: 'invalid', msg: '参数缺失' };
    const order = MOCK_ORDERS.find(o => o.orderNo === data.orderNo);
    if (!order) return { code: -1, status: 'notfound', msg: '订单不存在' };
    // 状态映射：completed → done，其他 → pending
    const mappedStatus = order.status === 'completed' ? 'done' : 'pending';
    return {
      code: 0,
      status: mappedStatus,
      orderNo: order.orderNo,
      badgeNo: order.cardNumber || '',
      _dbStatus: order.status
    };
  }

  if (name === 'getOrderByCard') {
    const { card } = data;
    if (!card) return { code: -1, status: 'invalid', msg: '参数缺失：card 必填' };
    // 按号码牌查当前活跃订单（排除已完成/已取消）
    const order = MOCK_ORDERS.find(o =>
      o.cardNumber === card && !['completed', 'cancelled'].includes(o.status)
    );
    if (!order) return { code: 0, status: 'idle', badgeNo: card, msg: '暂无进行中的订单' };
    const mappedStatus = order.status === 'completed' ? 'done' : 'pending';
    return {
      code: 0,
      status: mappedStatus,
      orderNo: order.orderNo,
      badgeNo: order.cardNumber || card,
      _dbStatus: order.status
    };
  }

  if (name === 'getCardCode') {
    const { cardNumber } = data;
    if (!cardNumber) return { code: -1, msg: '参数缺失' };
    const codeInfo = MOCK_CARD_CODES.find(c => c.cardNumber === cardNumber);
    if (codeInfo) {
      return { code: 0, codeImageFileID: codeInfo.codeImageFileID, scene: codeInfo.scene };
    }
    // 无预生成码时返回空，触发 fallback
    return { code: 0, codeImageFileID: '', scene: 'card=' + cardNumber };
  }

  if (name === 'confirmPickup') {
    const order = MOCK_ORDERS.find(o => o.orderNo === data.orderNo);
    if (!order) return { code: -1, msg: '订单不存在' };
    order.status = 'completed';
    // 释放号码牌
    if (order.cardNumber) {
      const tag = MOCK_PAI_NUMBERS.find(t => t.number === order.cardNumber);
      if (tag) { tag.status = 'idle'; tag.orderId = null; }
    }
    return { code: 0, msg: '确认取货成功' };
  }

  // ========== wxLogin 云函数（头像/昵称登录） ==========
  if (name === 'wxLogin') {
    const nickName = data.nickName || '';
    const avatarUrl = data.avatarUrl || '';
    return {
      code: 0,
      openid: 'mock_user_001',
      nickName,
      avatarUrl,
      phone: ''
    };
  }

  // ========== login 云函数（静默登录 + 按需手机号授权） ==========
  if (name === 'login') {
    // 手机号授权模式
    const phoneCode = data.phoneCode || (data.action === 'getPhone' ? data.code : null);
    if (phoneCode) {
      return { code: 0, openid: 'mock_user_001', phone: '13800008888' };
    }
    // 静默登录模式
    return { code: 0, openid: 'mock_user_001', phone: '' };
  }

  if (name === 'merchantLogin') {
    const { phone, password } = data;
    // 测试账号列表
    const testAccounts = {
      '13800000000': { password: '123456', role: 'manager',  merchantId: 'merchant_01', nickName: '张老板', merchant: { _id: 'merchant_01', name: '小鲜鸡店铺（旗舰店）', status: 'open', phone: '13800000000', address: '广州市天河区体育西路123号' } },
      '13900000001': { password: '123456', role: 'admin',   merchantId: 'merchant_01', nickName: '李管理员', merchant: { _id: 'merchant_01', name: '小鲜鸡店铺（旗舰店）', status: 'open', phone: '13900000001', address: '广州市天河区体育西路123号' } },
      '13800000002': { password: '123456', role: 'manager',  merchantId: 'merchant_02', nickName: '王店长', merchant: { _id: 'merchant_02', name: '小鲜鸡店铺（分店）', status: 'open', phone: '13800000002', address: '深圳市南山区科技园路56号' } }
    };
    const account = testAccounts[phone];
    if (account && password === account.password) {
      return {
        success: true,
        role: account.role,
        merchantId: account.merchantId,
        userInfo: { nickName: account.nickName, avatarUrl: '', phone },
        merchant: account.merchant
      };
    }
    return { success: false, error: '账号或密码错误' };
  }

  if (name === 'checkRole') {
    return { role: 'customer', merchantId: '' };
  }

  if (name === 'getStoreConfig') {
    // 根据 merchantId 查询店铺配置，不传则取第一个
    const merchantId = data.merchantId || 'merchant_01';
    const config = STORE_CONFIG[merchantId] || STORE_CONFIG['merchant_01'];
    return { success: true, config: { ...config, merchantId } };
  }

  if (name === 'updateStoreConfig') {
    // 仅商家/管理员可修改（权限由调用方传入 role 校验）
    const merchantId = data.merchantId || 'merchant_01';
    if (!STORE_CONFIG[merchantId]) {
      STORE_CONFIG[merchantId] = {
        name: '', deliveryRadius: 5, latitude: 23.1291, longitude: 113.2644, address: ''
      };
    }
    if (data.name !== undefined) {
      STORE_CONFIG[merchantId].name = data.name;
    }
    if (data.address !== undefined) {
      STORE_CONFIG[merchantId].address = data.address;
    }
    if (data.latitude !== undefined) {
      STORE_CONFIG[merchantId].latitude = Number(data.latitude);
    }
    if (data.longitude !== undefined) {
      STORE_CONFIG[merchantId].longitude = Number(data.longitude);
    }
    if (data.deliveryRadius !== undefined) {
      STORE_CONFIG[merchantId].deliveryRadius = Number(data.deliveryRadius);
    }
    if (data.contactName !== undefined) {
      STORE_CONFIG[merchantId].contactName = data.contactName;
    }
    if (data.contactPhone !== undefined) {
      STORE_CONFIG[merchantId].contactPhone = data.contactPhone;
    }
    if (data.openTime !== undefined) {
      STORE_CONFIG[merchantId].openTime = data.openTime;
    }
    if (data.closeTime !== undefined) {
      STORE_CONFIG[merchantId].closeTime = data.closeTime;
    }
    return { success: true, config: { ...STORE_CONFIG[merchantId], merchantId } };
  }

  if (name === 'getMerchantOrders') {
    const { status, type, page = 1, pageSize = 20, startDate, endDate } = data;
    let filtered = MOCK_ORDERS;

    // 按订单类型筛选（线上/线下）
    if (type === 'online') {
      filtered = filtered.filter(o => o.type !== 'offline');
    } else if (type === 'offline') {
      filtered = filtered.filter(o => o.type === 'offline');
    }

    // 按状态筛选（支持任意状态值）
    if (status) {
      if (status === 'refundFailed') {
        // 退款异常：refundStatus 为 'failed'
        filtered = filtered.filter(o =>
          o.refundStatus === 'failed' ||
          (o.refundInfo && o.refundInfo.status === 'failed')
        );
      } else {
        filtered = filtered.filter(o => o.status === status);
      }
    }

    // 日期范围筛选
    if (startDate || endDate) {
      filtered = filtered.filter(o => {
        const created = new Date(o.createTime).getTime();
        if (startDate && created < new Date(startDate).getTime()) return false;
        if (endDate && created > new Date(endDate).getTime()) return false;
        return true;
      });
    }

    const start = (page - 1) * pageSize;
    return { orders: filtered.slice(start, start + pageSize) };
  }

  if (name === 'updateOrderStatus') {
    const { orderNo, action, cardNumber } = data;
    const order = MOCK_ORDERS.find(o => o.orderNo === orderNo);
    if (!order) return { error: 'Order not found' };

    const transitions = {
      accept:  { from: ['paid'],               to: 'accepted' },
      process: { from: ['weighed', 'paid', 'accepted'], to: 'processing' },
      deliver: { from: ['processing', 'ready'], to: 'delivering' },
      ready:   { from: 'processing',           to: 'ready' },
      complete:{ from: ['delivering', 'ready', 'paid', 'processing'], to: 'completed' },
      cancel:  { from: ['pending', 'paid', 'accepted', 'weighed', 'processing', 'ready'], to: 'cancelled' }
    };

    // markPaid：标记未支付订单为已支付（不改变订单状态）
    if (action === 'markPaid') {
      if (order.paymentType !== 'unpaid') {
        return { error: 'Order is already paid' };
      }
      order.paymentType = 'cash';
      return { success: true, paymentType: 'cash' };
    }

    const t = transitions[action];
    if (!t) return { error: 'Invalid action' };

    const validFrom = Array.isArray(t.from) ? t.from : [t.from];
    if (!validFrom.includes(order.status)) {
      return { error: `Cannot ${action} from ${order.status}` };
    }

    // process 从 accepted 只能用于非整鸡订单（整鸡必须先称重）
    if (action === 'process' && order.status === 'accepted') {
      const item = (order.items && order.items[0]) || {};
      if (item.pricingType === 'range_weight') {
        return { error: '整鸡订单需先完成称重后才能进入处理' };
      }
    }

    order.status = t.to;
    if (action === 'ready' && cardNumber) {
      order.cardNumber = cardNumber;
    }
    // 订单完成/取消时释放号码牌
    if ((action === 'complete' || action === 'cancel') && order.cardNumber) {
      const pai = MOCK_PAI_NUMBERS.find(p => p.number === order.cardNumber);
      if (pai) { pai.status = 'idle'; pai.orderId = ''; }
    }
    return { success: true, status: t.to };
  }

  if (name === 'getPaiNumbers') {
    return { numbers: MOCK_PAI_NUMBERS };
  }

  if (name === 'bindTag') {
    const { number, orderNo } = data;
    const pai = MOCK_PAI_NUMBERS.find(p => p.number === number);
    if (pai) {
      pai.status = 'in_use';
      pai.orderId = orderNo;
    }
    const order = MOCK_ORDERS.find(o => o.orderNo === orderNo);
    if (order) {
      order.cardNumber = number;
    }
    return { success: true };
  }

  if (name === 'createOfflineOrder') {
    mockOfflineSeq++;
    const orderNo = 'B' + String(mockOfflineSeq).padStart(3, '0');
    const newOrder = {
      _id: 'offline_' + mockOfflineSeq,
      orderNo,
      userId: '',
      type: 'offline',
      items: [],
      prepayAmount: data.amount,
      actualAmount: data.amount,
      actualWeight: 0,
      weighPhoto: '',
      refundAmount: 0,
      refundStatus: 'none',
      status: 'paid',
      cardNumber: data.cardNumber,
      paymentType: data.paymentType || 'cash',
      createTime: new Date().toISOString().replace('T', ' ').slice(0, 19)
    };
    MOCK_ORDERS.unshift(newOrder);
    const pai = MOCK_PAI_NUMBERS.find(p => p.number === data.cardNumber);
    if (pai) { pai.status = 'in_use'; pai.orderId = orderNo; }
    return {
      success: true,
      orderNo,
      cardNumber: data.cardNumber,
      scene: 'card=' + data.cardNumber,
      token: 'mock_token_' + orderNo
    };
  }

  if (name === 'updateProductStatus') {
    const product = PRODUCTS.find(p => p._id === data.productId);
    if (product) {
      if (data.status !== undefined) product.status = data.status;
      if (data.outOfStock !== undefined) product.out_of_stock = data.outOfStock;
    }
    return { success: true };
  }

  if (name === 'addCategory') {
    const maxSort = CATEGORIES.reduce((max, c) => Math.max(max, c.sort || 0), 0);
    const newCat = {
      _id: 'cat_' + String(CATEGORIES.length + 1).padStart(2, '0'),
      name: data.name,
      sort: maxSort + 1
    };
    CATEGORIES.push(newCat);
    return { success: true, category: newCat };
  }

  if (name === 'addProduct') {
    const newId = 'prod_' + String(PRODUCTS.length + 1).padStart(2, '0');
    const product = {
      _id: newId,
      name: data.name || '新商品',
      categoryId: data.categoryId || 'cat_01',
      pricing_type: data.pricingType || 'exact_weight',
      description: data.description || '',
      selling_point: data.sellingPoint || '',
      images: data.images || [],
      sales: 0,
      out_of_stock: false,
      status: 'on',
      processing_options: data.processingOptions || ['整只', '切块'],
      delivery_modes: data.deliveryModes || ['delivery', 'pickup'],
      minPrice: '0.00'
    };
    if (data.pricingType === 'exact_weight') {
      product.price_per_jin = data.pricePerJin || 0;
      product.weight_options = data.weightOptions || [500];
      product.processing_fee = data.processingFee || 0;
    } else if (data.pricingType === 'per_piece') {
      product.unit_price = data.unitPrice || 0;
      product.processing_fee = data.processingFee || 0;
    } else if (data.pricingType === 'range_weight') {
      product.specs = data.specs || [];
    }
    PRODUCTS.push(product);
    return { success: true, productId: newId };
  }

  if (name === 'updateProduct') {
    const idx = PRODUCTS.findIndex(p => p._id === data.productId);
    if (idx >= 0) {
      const p = PRODUCTS[idx];
      if (data.name !== undefined) p.name = data.name;
      if (data.categoryId !== undefined) p.categoryId = data.categoryId;
      if (data.pricingType !== undefined) p.pricing_type = data.pricingType;
      if (data.description !== undefined) p.description = data.description;
      if (data.sellingPoint !== undefined) p.selling_point = data.sellingPoint;
      if (data.images !== undefined) p.images = data.images;
      if (data.deliveryModes !== undefined) p.delivery_modes = data.deliveryModes;
      if (data.processingOptions !== undefined) p.processing_options = data.processingOptions;
      if (data.pricePerJin !== undefined) p.price_per_jin = data.pricePerJin;
      if (data.weightOptions !== undefined) p.weight_options = data.weightOptions;
      if (data.processingFee !== undefined) p.processing_fee = data.processingFee;
      if (data.unitPrice !== undefined) p.unit_price = data.unitPrice;
      if (data.specs !== undefined) p.specs = data.specs;
    }
    return { success: true };
  }

  if (name === 'refundOrder') {
    // 兼容旧接口，转发到 submitWeigh
    return handleSubmitWeigh(data);
  }

  if (name === 'submitWeigh') {
    return handleSubmitWeigh(data);
  }

  if (name === 'refundCallback') {
    const order = MOCK_ORDERS.find(o => o.orderNo === data.orderNo);
    if (!order) return { error: 'Order not found' };

    if (data.resultCode === 'SUCCESS') {
      order.refundInfo = order.refundInfo || {};
      order.refundInfo.status = 'success';
      order.refundInfo.successTime = new Date().toISOString();
      return { success: true };
    } else {
      order.refundInfo = order.refundInfo || {};
      order.refundInfo.status = 'failed';
      return { success: false, error: data.errCodeDes || '退款失败' };
    }
  }

  if (name === 'getOperationsData') {
    const completedOrders = MOCK_ORDERS.filter(o => o.status === 'completed');
    const totalRevenue = completedOrders.reduce((s, o) => s + (o.actualAmount || o.prepayAmount || 0), 0);
    return {
      todayRevenue: (totalRevenue / 100).toFixed(2),
      todayOrders: completedOrders.length,
      avgOrderValue: completedOrders.length > 0 ? (totalRevenue / completedOrders.length / 100).toFixed(2) : '0.00',
      salesRank: [],
      categoryStats: [],
      recentOrders: completedOrders.slice(0, 10)
    };
  }

  if (name === 'clearMockOrders') {
    // 重置订单
    MOCK_ORDERS.length = 0;
    const restored = JSON.parse(JSON.stringify(SEED_ORDERS));
    restored.forEach(o => MOCK_ORDERS.push(o));
    mockOrderSeq = SEED_ORDER_SEQ;
    // 重置地址
    mockAddresses.length = 0;
    const restoredAddrs = JSON.parse(JSON.stringify(SEED_ADDRESSES));
    restoredAddrs.forEach(a => mockAddresses.push(a));
    mockAddrSeq = SEED_ADDR_SEQ;
    // 重置线下序号
    mockOfflineSeq = SEED_OFFLINE_SEQ;
    return { success: true, message: '模拟数据已重置', orderCount: MOCK_ORDERS.length };
  }

  if (name === 'clearTestData') {
    const orderCount = MOCK_ORDERS.length;
    // 清空所有订单（含线上 + 线下）
    MOCK_ORDERS.length = 0;
    // 重置序号
    mockOrderSeq = 0;
    mockOfflineSeq = 0;
    // 重置全部号码牌为 idle
    MOCK_PAI_NUMBERS.forEach(p => {
      p.status = 'idle';
      p.orderId = '';
    });
    return {
      success: true,
      message: `已清除 ${orderCount} 笔订单，重置 ${MOCK_PAI_NUMBERS.length} 个号码牌`,
      details: { orders: orderCount, offlineOrders: 0, tags: MOCK_PAI_NUMBERS.length }
    };
  }

  if (name === 'getBanners') {
    // 返回排序后的广告列表
    const sorted = [...MOCK_BANNERS].sort((a, b) => (a.sort || 0) - (b.sort || 0));
    return { banners: sorted };
  }

  if (name === 'updateCategorySort') {
    const { categories } = data;
    if (!Array.isArray(categories)) {
      return { success: false, error: 'categories array required' };
    }
    // 更新 CATEGORIES 中对应分类的 sort 字段
    for (const { _id, sort } of categories) {
      const cat = CATEGORIES.find(c => c._id === _id);
      if (cat) {
        cat.sort = sort;
      }
    }
    // 按 sort 重新排序 CATEGORIES（保持与云函数 orderBy('sort','asc') 一致）
    CATEGORIES.sort((a, b) => a.sort - b.sort);
    return { success: true };
  }

  if (name === 'saveBanners') {
    const { banners } = data;
    if (!Array.isArray(banners)) {
      return { success: false, error: 'banners must be an array' };
    }
    // 全量替换
    MOCK_BANNERS.length = 0;
    banners.forEach(b => MOCK_BANNERS.push({ ...b }));
    mockBannerSeq = banners.length;
    return { success: true, count: banners.length };
  }

  return null;
}

// Mock 号码牌数据
const MOCK_PAI_NUMBERS = Array.from({ length: 99 }, (_, i) => {
  const number = String(i + 1).padStart(2, '0');
  const inUse = MOCK_ORDERS.find(o => o.cardNumber === number && !['completed', 'cancelled'].includes(o.status));
  return {
    _id: 'pai_' + number,
    number,
    status: inUse ? 'in_use' : 'idle',
    orderId: inUse ? inUse.orderNo : ''
  };
});

/** 预生成的小程序码映射（Mock 模式用占位数据） */
const MOCK_CARD_CODES = Array.from({ length: 99 }, (_, i) => {
  const number = String(i + 1).padStart(2, '0');
  return {
    _id: 'card_' + number,
    cardNumber: number,
    codeImageFileID: '',  // Mock 模式无真实云存储，触发 fallback QR API
    scene: 'card=' + number,
    width: 280,
    createdAt: '2026-06-08 00:00:00',
    updatedAt: '2026-06-08 00:00:00'
  };
});

/**
 * 处理称重提交（submitWeigh / refundOrder）
 * 统一计价逻辑：实际金额 = floor(实际重量(g)/500 × 每斤单价 + 处理费)
 */
function handleSubmitWeigh(data) {
  const order = MOCK_ORDERS.find(o => o.orderNo === data.orderNo);
  if (!order) return { error: 'Order not found' };
  if (order.status !== 'accepted') return { error: `当前状态 ${order.status} 不可执行称重退款` };

  // 仅 range_weight（整鸡）订单可称重退款
  const item = (order.items && order.items[0]) || {};
  if (item.pricingType !== 'range_weight') {
    return { error: '仅整鸡（按重量范围计价）订单可称重退款' };
  }

  const actualWeight = data.actualWeight || 0; // 克
  const weighPhoto = data.weighPhoto || data.weighPhotoFileId || '';

  // 从订单商品中读取锁定的单价和处理费
  const spec = item.spec || {};
  let pricePerJin = data.pricePerJin || spec.type_price_per_jin || 0;
  let processingFee = data.processingFee || spec.processing_fee || 0;

  // 兼容旧数据：若无锁定单价，从 unitPrice 反推
  if (!pricePerJin && item.unitPrice && item.pricingType === 'range_weight') {
    const weightMax = spec.weight_max || 500;
    pricePerJin = Math.round((item.unitPrice - processingFee) * 500 / weightMax);
  }
  if (!pricePerJin && item.pricingType === 'exact_weight') {
    pricePerJin = spec.price_per_jin || 0;
  }

  const prepayAmount = order.prepayAmount || 0;

  // 实际金额 = floor(actualWeight/500 × pricePerJin + processingFee)，向下取整对用户有利
  const actualAmountFloat = (actualWeight / 500) * pricePerJin + processingFee;
  const actualAmount = Math.floor(actualAmountFloat);
  const refundAmount = Math.max(0, prepayAmount - actualAmount);

  // 计算实际重量斤数
  const actualWeightJin = parseFloat((actualWeight / 500).toFixed(2));

  const now = new Date().toISOString();

  // 构建 weighInfo
  order.weighInfo = {
    actualWeight,
    actualWeightJin,
    pricePerJin,
    processingFee,
    prepayAmount,
    actualAmount,
    refundAmount,
    weighPhoto,
    weighTime: now,
    staffId: 'staff_01',
    staffName: '小王'
  };

  // 构建 refundInfo
  if (refundAmount > 0) {
    order.refundInfo = {
      refundNo: 'REF' + order.orderNo + '_' + Date.now(),
      refundAmount,
      status: 'processing',
      wxRefundId: '',
      refundTime: now,
      successTime: ''
    };
    // 模拟退款异步成功（1.5秒后自动成功，模拟微信退款回调）
    setTimeout(() => {
      order.refundInfo.status = 'success';
      order.refundInfo.successTime = new Date().toISOString();
    }, 1500);
  } else {
    order.refundInfo = {
      refundNo: '',
      refundAmount: 0,
      status: 'none',
      wxRefundId: '',
      refundTime: '',
      successTime: ''
    };
  }

  // 更新订单状态和兼容字段
  order.status = 'weighed';
  order.actualWeight = actualWeight;
  order.actualAmount = actualAmount;
  order.refundAmount = refundAmount;
  order.weighPhoto = weighPhoto;
  order.refundStatus = refundAmount > 0 ? 'processing' : 'none';

  // 绑定号码牌
  if (data.cardNumber) {
    // 释放旧牌号
    if (order.cardNumber && order.cardNumber !== data.cardNumber) {
      const oldPai = MOCK_PAI_NUMBERS.find(p => p.number === order.cardNumber);
      if (oldPai) {
        oldPai.status = 'idle';
        oldPai.orderId = '';
      }
    }
    order.cardNumber = data.cardNumber;
    const pai = MOCK_PAI_NUMBERS.find(p => p.number === data.cardNumber);
    if (pai) {
      pai.status = 'in_use';
      pai.orderId = order.orderNo;
    }
  }

  return {
    success: true,
    actualWeight,
    actualAmount,
    refundAmount,
    refundStatus: refundAmount > 0 ? 'processing' : 'none',
    cardNumber: order.cardNumber || ''
  };
}

/**
 * HTTP API Mock 处理器（自建后端 REST API 格式）
 *
 * 响应格式：{ success: true, data: {...} } 或 { success: false, message: '...' }
 * 与 Express 后端的统一响应格式对齐
 *
 * @param {string} method - GET / POST / PUT / DELETE / PATCH
 * @param {string} path  - API 路径（如 /products、/auth/wx-login）
 * @param {object} data  - 请求参数
 * @returns {object|null} mock 响应，null 表示未覆盖
 */
function getHttpMockResponse(method, path, data = {}) {
  // ==================== Auth ====================

  if (path === '/auth/wx-login' && method === 'POST') {
    return {
      success: true,
      data: {
        openid: 'mock_user_001',
        accessToken: 'mock_access_token_' + Date.now(),
        refreshToken: 'mock_refresh_token_' + Date.now(),
        expiresIn: 7200,
        nickName: 'Mock用户',
        avatarUrl: '',
        phone: '',
        role: 'customer'
      }
    };
  }

  if (path === '/auth/wx-phone' && method === 'POST') {
    return {
      success: true,
      data: { phone: '13800008888' }
    };
  }

  if (path === '/auth/merchant-login' && method === 'POST') {
    const testAccounts = {
      '13800000000': { password: '123456', role: 'manager',  merchantId: 'merchant_01', nickName: '张老板' },
      '13900000001': { password: '123456', role: 'admin',   merchantId: 'merchant_01', nickName: '李管理员' },
      '13800000002': { password: '123456', role: 'manager',  merchantId: 'merchant_02', nickName: '王店长' }
    };
    const account = testAccounts[data.phone];
    if (account && data.password === account.password) {
      return {
        success: true,
        data: {
          accessToken: 'mock_merchant_token_' + Date.now(),
          refreshToken: 'mock_merchant_refresh_' + Date.now(),
          expiresIn: 7200,
          role: account.role,
          merchantId: account.merchantId,
          userInfo: { nickName: account.nickName, avatarUrl: '', phone: data.phone },
          merchant: {
            id: account.merchantId,
            name: account.merchantId === 'merchant_01' ? '小鲜鸡店铺（旗舰店）' : '小鲜鸡店铺（分店）'
          }
        }
      };
    }
    return { success: false, message: '账号或密码错误' };
  }

  if (path === '/auth/refresh-token' && method === 'POST') {
    return {
      success: true,
      data: {
        accessToken: 'mock_access_token_refreshed_' + Date.now(),
        refreshToken: 'mock_refresh_token_refreshed_' + Date.now(),
        expiresIn: 7200
      }
    };
  }

  if (path === '/auth/check-role' && method === 'GET') {
    return {
      success: true,
      data: { role: 'customer', merchantId: '' }
    };
  }

  // ==================== Categories ====================

  if (path === '/categories' && method === 'GET') {
    return {
      success: true,
      data: { categories: CATEGORIES }
    };
  }

  if (path === '/categories' && method === 'POST') {
    // addCategory
    return { success: true, data: { id: 'cat_new_' + Date.now(), name: data.name } };
  }

  if (path.match(/^\/categories\/cat_\w+$/) && method === 'DELETE') {
    return { success: true, data: { deleted: true } };
  }

  if (path === '/categories/sort' && method === 'PUT') {
    return { success: true, data: { updated: true } };
  }

  // ==================== Products ====================

  if (path === '/products' && method === 'GET') {
    const { categoryId, pageSize, status: statusFilter, keyword } = data;
    let filtered;
    if (statusFilter === 'all') {
      filtered = [...PRODUCTS];
    } else {
      filtered = PRODUCTS.filter(p => p.status === 'on');
    }
    if (categoryId && categoryId !== 'cat_00') {
      filtered = filtered.filter(p => p.categoryId === categoryId);
    }
    if (keyword) {
      const lower = keyword.toLowerCase();
      filtered = filtered.filter(p =>
        (p.name && p.name.toLowerCase().includes(lower)) ||
        (p.selling_point && p.selling_point.toLowerCase().includes(lower))
      );
    }
    const limit = pageSize || 50;
    const paged = filtered.slice(0, limit);
    const products = paged.map(p => {
      let minPrice = null;
      if (p.pricing_type === 'range_weight') {
        const prices = (p.specs || []).map(s => s.price_per_jin).filter(v => v > 0);
        if (prices.length > 0) minPrice = Math.min(...prices);
      } else if (p.pricing_type === 'exact_weight') {
        const minWeight = Math.min(...(p.weight_options && p.weight_options.length ? p.weight_options : [500]));
        minPrice = p.price_per_jin * (minWeight / 500);
      } else if (p.pricing_type === 'per_piece') {
        minPrice = p.unit_price;
      }
      return { ...p, minPrice: minPrice ? (minPrice / 100).toFixed(2) : null };
    });
    return {
      success: true,
      data: { products, total: filtered.length }
    };
  }

  if (path.match(/^\/products\/\w+$/) && method === 'GET') {
    const id = path.split('/').pop();
    const product = PRODUCTS.find(p => p._id === id);
    return { success: true, data: { product: product || null } };
  }

  if (path === '/products' && method === 'POST') {
    return { success: true, data: { id: 'prod_new_' + Date.now() } };
  }

  if (path.match(/^\/products\/\w+$/) && method === 'PUT') {
    return { success: true, data: { updated: true } };
  }

  if (path.match(/^\/products\/\w+\/status$/) && method === 'PATCH') {
    return { success: true, data: { updated: true } };
  }

  // ==================== Banners ====================

  if (path === '/banners' && method === 'GET') {
    return {
      success: true,
      data: {
        banners: [
          { _id: 'banner_default_1', image: '', bg: 'linear-gradient(135deg, #FFF9ED, #FFE082)', title: '新鲜活鸡 每日直达', subtitle: '现宰现发 · 冷链配送', sort: 1, status: 'on' },
          { _id: 'banner_default_2', image: '', bg: 'linear-gradient(135deg, #FFFBEB, #FFD166)', title: '新用户首单立减', subtitle: '满¥39减¥5', sort: 2, status: 'on' },
          { _id: 'banner_default_3', image: '', bg: 'linear-gradient(135deg, #FEF4F0, #FDE0D5)', title: '鸭肉季 清爽上线', subtitle: '半片鸭低至¥12.8/斤', sort: 3, status: 'on' }
        ]
      }
    };
  }

  if (path === '/banners' && method === 'PUT') {
    return { success: true, data: { updated: true } };
  }

  // ==================== Store ====================

  if (path === '/store' && method === 'GET') {
    const config = STORE_CONFIG['merchant_01'] || {};
    return { success: true, data: { config: { ...config, merchantId: 'merchant_01' } } };
  }

  if (path === '/store' && method === 'PUT') {
    const mockRes = getMockResponse('updateStoreConfig', data);
    if (mockRes && mockRes.success) {
      return { success: true, data: { config: mockRes.config } };
    }
    return { success: false, message: '保存失败' };
  }

  // ==================== Pai Numbers ====================

  if (path === '/pai-numbers' && method === 'GET') {
    return { success: true, data: { numbers: MOCK_PAI_NUMBERS } };
  }

  // GET /pai-numbers/:cardNumber/code — 获取号码牌小程序码
  const cardCodeMatch = path.match(/^\/pai-numbers\/(\w+)\/code$/);
  if (cardCodeMatch && method === 'GET') {
    const cardNumber = cardCodeMatch[1];
    const codeInfo = MOCK_CARD_CODES.find(c => c.cardNumber === cardNumber);
    if (codeInfo) {
      return { success: true, data: { codeImageFileID: codeInfo.codeImageFileID, scene: codeInfo.scene } };
    }
    return { success: true, data: { codeImageFileID: '', scene: 'card=' + cardNumber } };
  }

  // POST /pai-numbers/:number/release — 释放号码牌
  const releaseMatch = path.match(/^\/pai-numbers\/(\w+)\/release$/);
  if (releaseMatch && method === 'POST') {
    const number = releaseMatch[1];
    const pai = MOCK_PAI_NUMBERS.find(p => p.number === number);
    if (pai) { pai.status = 'idle'; pai.orderId = ''; }
    return { success: true, data: { released: true, number } };
  }

  // ==================== Dev Tools ====================

  if (path === '/dev/clear-mock-orders' && method === 'POST') {
    const mockRes = getMockResponse('clearMockOrders', {});
    return { success: true, data: mockRes };
  }

  if (path === '/dev/clear-test-data' && method === 'POST') {
    const mockRes = getMockResponse('clearTestData', {});
    return { success: true, data: mockRes };
  }

  // ==================== Dashboard ====================

  if (path === '/dashboard' && method === 'GET') {
    const pending = MOCK_ORDERS.filter(o => o.status === 'pending').length;
    const active = MOCK_ORDERS.filter(o => ['paid', 'accepted', 'weighed', 'processing', 'ready', 'delivering'].includes(o.status)).length;
    const completed = MOCK_ORDERS.filter(o => o.status === 'completed').length;
    return {
      success: true,
      data: { pending, active, completed, todayRevenue: '1,280.00' }
    };
  }

  // ==================== Addresses ====================

  if (path === '/addresses' && method === 'GET') {
    return { success: true, data: { addresses: mockAddresses } };
  }

  if (path === '/addresses' && method === 'POST') {
    const mockRes = getMockResponse('addAddress', data);
    if (mockRes && mockRes.addressId) {
      return { success: true, data: { id: mockRes.addressId } };
    }
    return { success: false, message: '添加失败' };
  }

  // PUT /addresses/:id
  const addressPutMatch = path.match(/^\/addresses\/(\w+)$/);
  if (addressPutMatch && method === 'PUT') {
    const mockRes = getMockResponse('updateAddress', { ...data, addressId: addressPutMatch[1] });
    if (mockRes && mockRes.success) {
      return { success: true, data: { updated: true } };
    }
    return { success: false, message: '更新失败' };
  }

  // DELETE /addresses/:id
  if (addressPutMatch && method === 'DELETE') {
    const mockRes = getMockResponse('deleteAddress', { addressId: addressPutMatch[1] });
    if (mockRes && mockRes.success) {
      return { success: true, data: { deleted: true } };
    }
    return { success: false, message: '删除失败' };
  }

  // ==================== Orders ====================

  if (path === '/orders' && method === 'GET') {
    const { status, pageSize } = data;
    let filtered = MOCK_ORDERS;
    if (status) {
      const statuses = status.split(',');
      filtered = filtered.filter(o => statuses.includes(o.status));
    }
    return { success: true, data: { orders: filtered.slice(0, pageSize || 20), total: filtered.length } };
  }

  if (path.match(/^\/orders\/\w+$/) && method === 'GET') {
    const orderNo = path.split('/').pop();
    const order = MOCK_ORDERS.find(o => o.orderNo === orderNo);
    return { success: true, data: { order: order || null } };
  }

  if (path === '/orders' && method === 'POST') {
    // createOrder — 完整创建 mock 订单（含计价校验）
    const rawItems = data.items || [];
    if (rawItems.length === 0) return { success: false, message: '商品不能为空' };
    if (!data.type || !['delivery', 'pickup'].includes(data.type)) return { success: false, message: '取货方式无效' };
    if (data.type === 'delivery' && !data.deliveryAddress) return { success: false, message: '配送订单缺少收货地址' };

    // 配送订单：查询店铺联系方式
    let contactName = '';
    let contactPhone = '';
    if (data.type === 'delivery') {
      const storeConfig = STORE_CONFIG['merchant_01'] || {};
      contactName = storeConfig.contactName || '';
      contactPhone = storeConfig.contactPhone || '';
    }

    const orderNos = [];
    const payBatchNo = 'A' + String(mockOrderSeq + 1).padStart(3, '0');

    for (let idx = 0; idx < rawItems.length; idx++) {
      const i = rawItems[idx];
      const spec = { ...(i.spec || {}) };
      const product = PRODUCTS.find(p => p._id === i.productId);

      if (!product) return { success: false, message: `商品 "${i.productName || i.productId}" 不存在` };
      if (product.status !== 'on') return { success: false, message: `商品 "${product.name}" 已下架` };
      if (product.out_of_stock) return { success: false, message: `商品 "${product.name}" 已售罄` };

      let unitPrice = 0;
      const processingFee = (spec.processing === '切块') ? (product.processing_fee || 0) : 0;

      if (i.pricingType === 'range_weight') {
        const specs = product.specs || [];
        const matched = specs.find(s => s.type === spec.type && s.weight_label === spec.weight);
        if (!matched) return { success: false, message: `商品 "${product.name}" 规格不匹配` };
        const pricePerJin = matched.price_per_jin || 0;
        const weightMax = matched.weight_max || 500;
        spec.type_price_per_jin = pricePerJin;
        spec.processing_fee = processingFee;
        spec.weight_max = weightMax;
        unitPrice = Math.round((pricePerJin * weightMax) / 500) + processingFee;
      } else if (i.pricingType === 'exact_weight') {
        const pricePerJin = product.price_per_jin || 0;
        const grams = spec.weightGrams || 500;
        spec.price_per_jin = pricePerJin;
        spec.processing_fee = processingFee;
        unitPrice = Math.round((pricePerJin * grams) / 500) + processingFee;
      } else if (i.pricingType === 'per_piece') {
        const pricePerPiece = product.unit_price || 0;
        spec.unit_price = pricePerPiece;
        spec.processing_fee = processingFee;
        unitPrice = pricePerPiece + processingFee;
      } else {
        return { success: false, message: `商品 "${product.name}" 未知计价类型 ${i.pricingType}` };
      }

      mockOrderSeq++;
      const orderNo = 'A' + String(mockOrderSeq).padStart(3, '0');
      orderNos.push(orderNo);

      const newOrder = {
        _id: 'order_' + String(mockOrderSeq).padStart(2, '0'),
        orderNo,
        userId: 'mock_user_001',
        type: data.type || 'pickup',
        items: [{
          productId: i.productId,
          productName: product.name,
          pricingType: i.pricingType,
          spec,
          quantity: i.quantity || 1,
          unitPrice
        }],
        prepayAmount: unitPrice * (i.quantity || 1),
        actualAmount: 0,
        actualWeight: 0,
        refundAmount: 0,
        refundStatus: 'none',
        status: 'pending',
        payBatchNo,
        deliveryAddress: data.deliveryAddress || null,
        contactName,
        contactPhone,
        isScheduled: !!data.isScheduled,
        scheduledDate: data.scheduledDate || '',
        scheduledTime: data.scheduledTime || '',
        createTime: new Date().toISOString().replace('T', ' ').slice(0, 19)
      };
      MOCK_ORDERS.unshift(newOrder);
    }

    return {
      success: true,
      data: {
        orderNo: orderNos[0],
        orderNos,
        payBatchNo,
        payment: {
          timeStamp: String(Date.now()),
          nonceStr: 'mock_nonce_' + Date.now(),
          package: 'prepay_id=mock_' + Date.now(),
          signType: 'MD5',
          paySign: 'mock_sign_' + Date.now()
        }
      }
    };
  }

  // POST /orders/:orderNo/pay — 重试支付 / mock 支付
  if (method === 'POST') {
    const payMatch = path.match(/^\/orders\/(\w+)\/pay$/);
    if (payMatch) {
      const orderNo = payMatch[1];
      const order = MOCK_ORDERS.find(o => o.orderNo === orderNo);
      // mock 支付模式
      if (data.mockPay) {
        if (order && order.status === 'pending') {
          order.status = 'paid';
          order.payTime = new Date().toISOString().replace('T', ' ').slice(0, 19);
          order.wxTransactionId = 'mock_txn_' + Date.now();
        }
        return { success: true, data: { paid: true, status: 'paid' } };
      }
      // 正常获取支付参数
      if (!order) return { success: false, message: '订单不存在' };
      return {
        success: true,
        data: {
          payment: {
            timeStamp: String(Date.now()),
            nonceStr: 'mock_nonce_' + Date.now(),
            package: 'prepay_id=mock_retry_' + Date.now(),
            signType: 'MD5',
            paySign: 'mock_sign_' + Date.now()
          }
        }
      };
    }
  }

  if (path.match(/^\/orders\/\w+\/cancel$/) && method === 'POST') {
    const orderNo = path.split('/')[2];
    const order = MOCK_ORDERS.find(o => o.orderNo === orderNo);
    if (order) {
      order.status = 'cancelled';
      order.refundAmount = order.prepayAmount;
      order.refundStatus = 'done';
      if (order.cardNumber) {
        const pai = MOCK_PAI_NUMBERS.find(p => p.number === order.cardNumber);
        if (pai) { pai.status = 'idle'; pai.orderId = ''; }
      }
    }
    return { success: true, data: { cancelled: true } };
  }

  // ==================== Pickup ====================

  if (path.match(/^\/pickup\/status\/\w+$/) && method === 'GET') {
    const orderNo = path.split('/').pop();
    const order = MOCK_ORDERS.find(o => o.orderNo === orderNo);
    if (!order) return { success: true, data: { status: 'invalid', orderNo } };
    const mappedStatus = order.status === 'completed' ? 'done' : 'pending';
    return { success: true, data: { status: mappedStatus, orderNo, badgeNo: order.cardNumber || '' } };
  }

  if (path === '/pickup/confirm' && method === 'POST') {
    return { success: true, data: { confirmed: true } };
  }

  // ==================== Upload ====================

  if (path === '/upload/image' && method === 'POST') {
    return { success: true, data: { url: '/uploads/mock_image_' + Date.now() + '.jpg', filename: 'mock_image.jpg' } };
  }

  // ==================== Notifications ====================

  if (path === '/notifications/subscribe' && method === 'POST') {
    return { success: true, data: { sent: true } };
  }

  // 未覆盖的 API
  return null;
}

module.exports = {
  CATEGORIES,
  PRODUCTS,
  getMockResponse,
  getHttpMockResponse
};
