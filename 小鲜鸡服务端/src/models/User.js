const mongoose = require('mongoose')

const userSchema = new mongoose.Schema({
  openid: { type: String, required: true, unique: true },
  unionid: { type: String, default: '' },
  nickname: { type: String, default: '微信用户' },
  avatarUrl: { type: String, default: '' },
  phone: { type: String, default: '' }
}, { timestamps: true })

module.exports = mongoose.model('User', userSchema)
