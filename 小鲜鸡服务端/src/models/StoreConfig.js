const mongoose = require('mongoose')

const storeConfigSchema = new mongoose.Schema({
  key: { type: String, default: 'store_config', unique: true },
  name: { type: String, default: '小鲜鸡' },
  address: { type: String, default: '' },
  latitude: { type: Number, default: 23.1291 },
  longitude: { type: Number, default: 113.2644 },
  deliveryRadius: { type: Number, default: 5 },
  openTime: { type: String, default: '08:00' },
  closeTime: { type: String, default: '21:00' },
  contactName: { type: String, default: '' },
  contactPhone: { type: String, default: '' },
  subMchId: { type: String, default: '' }
}, { timestamps: true })

module.exports = mongoose.model('StoreConfig', storeConfigSchema)
