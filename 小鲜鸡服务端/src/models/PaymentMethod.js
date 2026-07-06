const mongoose = require('mongoose')

const paymentMethodSchema = new mongoose.Schema({
  name: { type: String, required: true },
  channel: { type: String, enum: ['wechat', 'alipay'], required: true },
  merchantType: { type: String, enum: ['normal', 'service'], default: 'normal' },
  // 微信支付
  appId: { type: String, default: '' },
  appSecret: { type: String, default: '' },
  mchid: { type: String, default: '' },
  serialNo: { type: String, default: '' },
  apiKey: { type: String, default: '' },
  certPem: { type: String, default: '' },
  keyPem: { type: String, default: '' },
  // 支付宝
  alipayAppId: { type: String, default: '' },
  alipayPrivateKey: { type: String, default: '' },
  alipayPublicKey: { type: String, default: '' },
  // 状态
  enabled: { type: Boolean, default: true }
}, { timestamps: true })

module.exports = mongoose.model('PaymentMethod', paymentMethodSchema)
