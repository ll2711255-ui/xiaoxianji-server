const mongoose = require('mongoose')

const categorySchema = new mongoose.Schema({
  name: { type: String, required: true },
  sort: { type: Number, default: 0 }
}, { timestamps: true })

module.exports = mongoose.model('Category', categorySchema)
