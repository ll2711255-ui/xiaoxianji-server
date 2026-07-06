const mongoose = require('mongoose')

const orderItemSchema = new mongoose.Schema({
  productId: { type: String, required: true },
  productName: { type: String, default: '' },
  pricingType: { type: String, default: '' },
  spec: { type: mongoose.Schema.Types.Mixed, default: {} },
  quantity: { type: Number, default: 1 },
  unitPrice: { type: Number, default: 0 }
}, { _id: false })

const timelineEntrySchema = new mongoose.Schema({
  status: { type: String, required: true },
  time: { type: Date, default: Date.now }
}, { _id: false })

const orderSchema = new mongoose.Schema({
  orderNo: { type: String, required: true, unique: true, index: true },
  type: { type: String, enum: ['online', 'offline'], required: true },

  // 用户信息
  userId: { type: String, default: '' },
  merchantId: { type: String, default: '' },

  // 商品
  items: [orderItemSchema],

  // 状态
  status: {
    type: String,
    enum: ['pending', 'paid', 'accepted', 'weighed', 'processing', 'ready', 'delivering', 'completed', 'cancelled', 'refundFailed'],
    default: 'pending'
  },

  // 金额（单位：分）
  prepayAmount: { type: Number, default: 0 },
  actualAmount: { type: Number, default: 0 },
  refundAmount: { type: Number, default: 0 },

  // 号码牌
  cardNumber: { type: String, default: '' },

  // 配送
  deliveryType: { type: String, enum: ['pickup', 'delivery'], default: 'pickup' },
  deliveryAddress: {
    name: { type: String, default: '' },
    phone: { type: String, default: '' },
    province: { type: String, default: '' },
    city: { type: String, default: '' },
    district: { type: String, default: '' },
    detail: { type: String, default: '' },
    latitude: { type: Number, default: 0 },
    longitude: { type: Number, default: 0 }
  },

  // 称重
  weighPhoto: { type: String, default: '' },

  // 支付方式（线下订单用）
  paymentType: { type: String, default: '' },

  // 定时配送
  isScheduled: { type: Boolean, default: false },
  scheduledDate: { type: String, default: '' },
  scheduledTime: { type: String, default: '' },

  // 时间线
  timeline: [timelineEntrySchema],

  // 时间戳
  createTime: { type: Date, default: Date.now },
  payTime: { type: Date },
  completeTime: { type: Date }
}, { timestamps: false })

// 索引
orderSchema.index({ userId: 1, createTime: -1 })
orderSchema.index({ status: 1, type: 1 })
orderSchema.index({ createTime: -1 })
orderSchema.index({ cardNumber: 1 })

// 添加时间线
orderSchema.methods.addTimeline = function (status) {
  this.timeline = this.timeline || []
  this.timeline.push({ status, time: new Date() })
}

// 状态机验证
const VALID_TRANSITIONS = {
  pending: ['paid', 'cancelled'],
  paid: ['accepted', 'cancelled'],
  accepted: ['weighed', 'cancelled'],
  weighed: ['processing', 'cancelled'],
  processing: ['ready', 'cancelled'],
  ready: ['delivering', 'completed', 'cancelled'],
  delivering: ['completed'],
  completed: [],
  cancelled: [],
  refundFailed: []
}

orderSchema.statics.canTransition = function (from, to) {
  const allowed = VALID_TRANSITIONS[from] || []
  return allowed.includes(to)
}

module.exports = mongoose.model('Order', orderSchema)
