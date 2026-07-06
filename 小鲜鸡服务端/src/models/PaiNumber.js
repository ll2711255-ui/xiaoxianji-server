const mongoose = require('mongoose')

const paiNumberSchema = new mongoose.Schema({
  number: { type: String, required: true, unique: true },
  status: { type: String, enum: ['idle', 'in_use', 'used'], default: 'idle' },
  orderNo: { type: String, default: '' }
}, { timestamps: true })

module.exports = mongoose.model('PaiNumber', paiNumberSchema)
