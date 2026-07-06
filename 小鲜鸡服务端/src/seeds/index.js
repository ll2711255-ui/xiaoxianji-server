/**
 * 种子数据脚本
 * 运行: node src/seeds/index.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') })
const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')
const config = require('../config')

// Models
const Category = require('../models/Category')
const Product = require('../models/Product')
const PaiNumber = require('../models/PaiNumber')
const Merchant = require('../models/Merchant')
const StoreConfig = require('../models/StoreConfig')
const Banner = require('../models/Banner')

// ========== 数据 ==========

const CATEGORIES = [
  { name: '今日推荐', sort: 0 },
  { name: '鸡', sort: 1 },
  { name: '鸭', sort: 2 },
  { name: '鸡胸肉', sort: 3 },
  { name: '鸡腿/鸡翅', sort: 4 },
  { name: '鸡杂/鸭杂', sort: 5 },
  { name: '鸡脚/鸭脚', sort: 6 }
]

const PRODUCTS = [
  {
    name: '清远走地鸡', categoryId: '', pricing_type: 'range_weight',
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
    processing_options: ['整只', '切块'], delivery_modes: ['delivery', 'pickup'], minPrice: '21.60'
  },
  {
    name: '文昌鸡', categoryId: '', pricing_type: 'range_weight',
    description: '海南文昌鸡，皮脆肉嫩，白切首选', selling_point: '海南正宗｜皮脆肉嫩｜白切首选',
    images: [], sales: 960,
    specs: [
      { type: '毛鸡称重', weight_label: '3.0-3.5斤', weight_max: 1750, price_per_jin: 1700, processing: '整只' },
      { type: '毛鸡称重', weight_label: '3.0-3.5斤', weight_max: 1750, price_per_jin: 1700, processing: '切块' },
      { type: '毛鸡称重', weight_label: '3.5-4.0斤', weight_max: 2000, price_per_jin: 1700, processing: '整只' },
      { type: '毛鸡称重', weight_label: '3.5-4.0斤', weight_max: 2000, price_per_jin: 1700, processing: '切块' },
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
    processing_options: ['整只', '切块'], delivery_modes: ['delivery', 'pickup'], minPrice: '21.60'
  },
  {
    name: '新鲜鸡全腿', categoryId: '', pricing_type: 'exact_weight',
    description: '整只大鸡腿，肉质饱满多汁', selling_point: '整只大鸡腿｜肉质饱满｜酱烧鲜香',
    images: [], sales: 2100, price_per_jin: 1580, weight_options: [500, 1000, 1500],
    processing_options: ['整只', '切块'], processing_fee: 0, delivery_modes: ['delivery', 'pickup'], minPrice: '15.80'
  },
  {
    name: '鸡中翅', categoryId: '', pricing_type: 'exact_weight',
    description: '精选鸡中翅，胶原蛋白丰富', selling_point: '胶原蛋白丰富｜骨酥肉嫩｜可乐红烧',
    images: [], sales: 3200, price_per_jin: 2280, weight_options: [500, 1000, 1500],
    processing_options: ['整只', '切块'], processing_fee: 0, delivery_modes: ['delivery', 'pickup'], minPrice: '22.80'
  },
  {
    name: '鸡大胸', categoryId: '', pricing_type: 'exact_weight',
    description: '低脂高蛋白，健身必备', selling_point: '低脂高蛋白｜健身必备｜鸡胸沙拉',
    images: [], sales: 2800, price_per_jin: 1480, weight_options: [500, 1000, 1500],
    processing_options: ['整只', '切块'], processing_fee: 0, delivery_modes: ['delivery', 'pickup'], minPrice: '14.80'
  },
  {
    name: '鸡全翅', categoryId: '', pricing_type: 'exact_weight',
    description: '翅根翅中翅尖完整保留', selling_point: '整翅完整｜翅根翅中翅尖｜卤香四溢',
    images: [], sales: 1560, price_per_jin: 1880, weight_options: [500, 1000],
    processing_options: ['整只', '切块'], processing_fee: 0, delivery_modes: ['delivery', 'pickup'], minPrice: '18.80'
  },
  {
    name: '鸡胗', categoryId: '', pricing_type: 'exact_weight',
    description: '新鲜鸡胗，脆嫩爽口', selling_point: '新鲜鸡胗｜脆嫩爽口｜爆炒下饭',
    images: [], sales: 980, price_per_jin: 1680, weight_options: [500, 1000],
    processing_options: ['整只', '切块'], processing_fee: 0, delivery_modes: ['delivery', 'pickup'], minPrice: '16.80'
  },
  {
    name: '鸡心', categoryId: '', pricing_type: 'exact_weight',
    description: '新鲜鸡心，营养丰富', selling_point: '新鲜鸡心｜营养丰富｜卤制入味',
    images: [], sales: 670, price_per_jin: 1280, weight_options: [500, 1000],
    processing_options: ['整只', '切块'], processing_fee: 0, delivery_modes: ['delivery', 'pickup'], minPrice: '12.80'
  },
  {
    name: '乳鸽', categoryId: '', pricing_type: 'per_piece',
    description: '25天乳鸽，肉质细嫩', selling_point: '25天乳鸽｜肉质细嫩｜煲汤红烧',
    images: [], sales: 540, unit_price: 2500, processing_options: ['整只', '切块'],
    processing_fee: 0, delivery_modes: ['delivery', 'pickup'], minPrice: '25.00'
  },
  {
    name: '老鸽', categoryId: '', pricing_type: 'per_piece',
    description: '1年以上老鸽，煲汤上品', selling_point: '1年以上老鸽｜滋补佳品｜煲汤上品',
    images: [], sales: 320, unit_price: 3500, processing_options: ['整只', '切块'],
    processing_fee: 0, delivery_modes: ['delivery', 'pickup'], minPrice: '35.00'
  }
]

// ========== 种子函数 ==========

async function seed() {
  try {
    // 生产环境拒绝执行（防止误操作清空线上数据）
    if (process.env.NODE_ENV === 'production' && !process.argv.includes('--force')) {
      console.error('[Seed] ❌ 生产环境禁止执行种子脚本！如需强制执行请添加 --force 参数')
      process.exit(1)
    }

    await mongoose.connect(config.mongodbUri)
    console.log('[Seed] 已连接 MongoDB')

    // 清空旧数据
    await Promise.all([
      Category.deleteMany({}),
      Product.deleteMany({}),
      PaiNumber.deleteMany({}),
      Merchant.deleteMany({}),
      StoreConfig.deleteMany({}),
      Banner.deleteMany({})
    ])
    console.log('[Seed] 已清空旧数据')

    // 1. 分类
    const cats = await Category.insertMany(CATEGORIES)
    const catMap = {}
    cats.forEach(c => { catMap[c.name] = c._id.toString() })
    console.log('[Seed] 已创建 ' + cats.length + ' 个分类')

    // 2. 商品（关联分类）
    const catProductMap = {
      '清远走地鸡': '鸡', '文昌鸡': '鸡',
      '新鲜鸡全腿': '鸡腿/鸡翅', '鸡中翅': '鸡腿/鸡翅', '鸡全翅': '鸡腿/鸡翅',
      '鸡大胸': '鸡胸肉',
      '鸡胗': '鸡杂/鸭杂', '鸡心': '鸡杂/鸭杂',
      '乳鸽': '鸡', '老鸽': '鸡'
    }
    const productDocs = PRODUCTS.map(p => ({
      ...p,
      categoryId: catMap[catProductMap[p.name]] || catMap['鸡']
    }))
    await Product.insertMany(productDocs)
    console.log('[Seed] 已创建 ' + productDocs.length + ' 个商品')

    // 3. 号码牌（01-30）
    const paiDocs = Array.from({ length: 30 }, (_, i) => ({
      number: String(i + 1).padStart(2, '0'),
      status: i < 20 ? 'idle' : (i < 25 ? 'in_use' : 'used'),
      orderNo: ''
    }))
    await PaiNumber.insertMany(paiDocs)
    console.log('[Seed] 已创建 30 个号码牌')

    // 4. 商家账号
    const hashedPassword = await bcrypt.hash('123456', 10)

    // 管理员账号
    const admin = await Merchant.create({
      username: 'admin',
      password: hashedPassword,
      role: 'admin',
      name: '张老板',
      phone: '13800000000'
    })

    // 店长账号
    const manager = await Merchant.create({
      username: 'manager01',
      password: hashedPassword,
      role: 'manager',
      name: '李店长',
      phone: '13800000001',
      parentId: admin._id
    })

    // 员工账号
    await Merchant.create({
      username: 'staff01',
      password: hashedPassword,
      role: 'employee',
      name: '王员工',
      phone: '13800000002',
      parentId: manager._id
    })

    console.log('[Seed] 已创建商家账号:')
    console.log('  - admin / 123456 (管理员)')
    console.log('  - manager01 / 123456 (店长)')
    console.log('  - staff01 / 123456 (员工)')

    // 5. 店铺配置
    await StoreConfig.create({
      key: 'store_config',
      name: '小鲜鸡',
      address: '广州市天河区体育西路123号',
      latitude: 23.1291,
      longitude: 113.2644,
      deliveryRadius: 5,
      openTime: '08:00',
      closeTime: '21:00',
      contactName: '张老板',
      contactPhone: '13800000000'
    })
    console.log('[Seed] 已创建店铺配置')

    console.log('\n[Seed] ✅ 种子数据初始化完成！')
    console.log('  - 7 个分类')
    console.log('  - ' + productDocs.length + ' 个商品')
    console.log('  - 30 个号码牌')
    console.log('  - 1 个商家账号 (admin/123456)')
    console.log('  - 1 份店铺配置')

    process.exit(0)
  } catch (err) {
    console.error('[Seed] ❌ 失败:', err)
    process.exit(1)
  }
}

seed()
