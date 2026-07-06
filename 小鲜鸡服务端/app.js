require('dotenv').config()

const express = require('express')
const cors = require('cors')
const morgan = require('morgan')
const mongoose = require('mongoose')
const path = require('path')
const config = require('./src/config')
const { verifyToken } = require('./src/middleware/auth')
const { fail } = require('./src/utils/response')

// ========== Express 初始化 ==========
const app = express()

// 中间件
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}))
app.use(morgan('dev'))

// payCallback 路由需要原始 body 做签名验证，必须在 express.json() 之前捕获
app.use('/api/pay-callback', express.raw({ type: '*/*' }))

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// 静态文件（上传图片）
app.use('/uploads', express.static(path.join(__dirname, config.upload.dir)))

// ========== 简单登录限流（内存实现，无需外部依赖） ==========
const authAttempts = new Map()  // IP → { count, resetTime }
function authLimiter(req, res, next) {
  const ip = req.ip || req.socket.remoteAddress || 'unknown'
  const now = Date.now()
  const entry = authAttempts.get(ip)
  if (entry && now < entry.resetTime) {
    if (entry.count >= 20) {
      return res.status(429).json(fail('请求过于频繁，请15分钟后再试'))
    }
    entry.count++
  } else {
    authAttempts.set(ip, { count: 1, resetTime: now + 15 * 60 * 1000 })
  }
  // 定期清理过期条目
  if (authAttempts.size > 10000) {
    for (const [k, v] of authAttempts) { if (now > v.resetTime) authAttempts.delete(k) }
  }
  next()
}

// ========== 路由挂载 ==========
app.use('/api/auth', authLimiter, require('./src/routes/auth'))
app.use('/api/products', require('./src/routes/products'))
app.use('/api/categories', require('./src/routes/categories'))
app.use('/api/banners', require('./src/routes/banners'))
app.use('/api/orders', verifyToken, require('./src/routes/orders'))
app.use('/api/merchant', verifyToken, require('./src/routes/merchantOrders'))
app.use('/api/pai-numbers', verifyToken, require('./src/routes/paiNumbers'))
app.use('/api/store', verifyToken, require('./src/routes/store'))
app.use('/api/payment-methods', require('./src/routes/paymentMethods'))
app.use('/api/accounts', verifyToken, require('./src/routes/accounts'))
app.use('/api/addresses', verifyToken, require('./src/routes/addresses'))
app.use('/api/upload', verifyToken, require('./src/routes/upload'))
app.use('/api/dashboard', verifyToken, require('./src/middleware/auth').verifyDashboard, require('./src/routes/dashboard'))
app.use('/api/pickup', require('./src/routes/pickup'))
app.use('/api/pay-callback', require('./src/routes/payCallback'))

// 404
app.use((req, res) => {
  res.status(404).json(fail('接口不存在: ' + req.method + ' ' + req.path))
})

// 全局错误处理
app.use((err, req, res, next) => {
  console.error('[Error]', err)
  if (err.name === 'ValidationError') {
    return res.status(400).json(fail(Object.values(err.errors).map(e => e.message).join(', ')))
  }
  if (err.name === 'CastError') {
    return res.status(400).json(fail('参数格式错误'))
  }
  if (err.code === 11000) {
    return res.status(409).json(fail('数据已存在'))
  }
  res.status(err.status || 500).json(fail(err.message || '服务器内部错误'))
})

// ========== 启动 ==========
async function start() {
  try {
    await mongoose.connect(config.mongodbUri)
    console.log('[MongoDB] 已连接成功')
    app.listen(config.port, () => {
      console.log(`[Server] 小鲜鸡服务端已启动 → http://localhost:${config.port}`)
    })
  } catch (err) {
    console.error('[MongoDB] 连接失败:', err.message)
    process.exit(1)
  }
}

start()

module.exports = app
