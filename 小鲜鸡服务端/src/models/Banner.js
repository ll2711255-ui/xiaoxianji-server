const mongoose = require('mongoose')

const bannerSchema = new mongoose.Schema({
  image: { type: String, default: '' },
  title: { type: String, default: '' },
  subtitle: { type: String, default: '' },
  bg: { type: String, default: '#FFF8F5' },
  sort: { type: Number, default: 0 },
  status: { type: String, enum: ['on', 'off'], default: 'on' }
}, { timestamps: true })

module.exports = mongoose.model('Banner', bannerSchema)
