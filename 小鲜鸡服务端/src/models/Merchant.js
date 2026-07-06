const mongoose = require('mongoose')

const merchantSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'manager', 'employee'], default: 'manager' },
  name: { type: String, default: '' },
  phone: { type: String, default: '' },
  parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Merchant', default: null }
}, { timestamps: true })

module.exports = mongoose.model('Merchant', merchantSchema)
