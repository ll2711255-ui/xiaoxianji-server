const mongoose = require('mongoose')

const addressSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  name: { type: String, required: true },
  phone: { type: String, required: true },
  province: { type: String, default: '' },
  city: { type: String, default: '' },
  district: { type: String, default: '' },
  detail: { type: String, required: true },
  latitude: { type: Number, default: 0 },
  longitude: { type: Number, default: 0 },
  isDefault: { type: Boolean, default: false }
}, { timestamps: true })

module.exports = mongoose.model('Address', addressSchema)
