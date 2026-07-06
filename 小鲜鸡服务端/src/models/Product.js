const mongoose = require('mongoose')

const specSchema = new mongoose.Schema({
  type: { type: String, default: '' },
  weight_label: { type: String, default: '' },
  weight_max: { type: Number, default: 0 },
  price_per_jin: { type: Number, default: 0 },
  processing: { type: String, default: '' }
}, { _id: false })

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  categoryId: { type: String, required: true },
  pricing_type: {
    type: String,
    enum: ['range_weight', 'exact_weight', 'per_piece'],
    required: true
  },
  description: { type: String, default: '' },
  selling_point: { type: String, default: '' },
  images: [{ type: String }],
  sales: { type: Number, default: 0 },

  // range_weight: 整鸡规格
  specs: [specSchema],

  // exact_weight: 按斤计价
  price_per_jin: { type: Number, default: 0 },
  weight_options: [{ type: Number }],
  processing_options: [{ type: String }],
  processing_fee: { type: Number, default: 0 },

  // per_piece: 按只计价
  unit_price: { type: Number, default: 0 },

  delivery_modes: [{ type: String, enum: ['delivery', 'pickup'] }],
  minPrice: { type: String, default: '0.00' },
  out_of_stock: { type: Boolean, default: false },
  status: { type: String, enum: ['on', 'off'], default: 'on' }
}, { timestamps: true })

productSchema.index({ categoryId: 1, status: 1 })
productSchema.index({ name: 'text', selling_point: 'text' })

module.exports = mongoose.model('Product', productSchema)
