/**
 * 商家登录限流中间件（两层独立限流）
 *
 * 层1：express-rate-limit（内存级，按 IP）
 *   - 窗口 60 秒，最大 10 次
 *   - 超出返回 429
 *
 * 层2：Redis 失败计数（持久级，按用户名）
 *   - key: merchant_login_fail:{username}
 *   - 连续失败 5 次 → 封禁 900 秒（15 分钟）
 *   - 登录成功 → 清除计数
 *   - 超出返回 429 并告知剩余时间
 *
 * 两层互相独立，任一触发都返回 429。
 */
const rateLimit = require('express-rate-limit')

// 惰性加载 Redis（避免启动时序问题）
let _redis = null
function getRedis() {
  if (!_redis) {
    try { _redis = require('../config/redis') } catch (_) { _redis = null }
  }
  return _redis
}

// ========== 层1：内存级频率限流 ==========
const loginLimiter = rateLimit({
  windowMs: 60 * 1000,      // 60 秒窗口
  max: 10,                   // 最多 10 次
  keyGenerator: (req) => req.ip,
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      message: '请求过于频繁，请稍后再试'
    })
  },
  standardHeaders: false,   // 不发送 RateLimit-* 头
  legacyHeaders: false,
})

// ========== 层2：Redis 失败计数检查 ==========
const checkLoginFailCount = async (req, res, next) => {
  const { username } = req.body
  if (!username) return next()

  const redis = getRedis()
  if (!redis) return next() // Redis 不可用时跳过

  try {
    const key = `merchant_login_fail:${username}`
    const fails = parseInt(await redis.get(key) || '0')

    if (fails >= 5) {
      const ttl = await redis.ttl(key)
      const minutes = Math.max(1, Math.ceil(ttl / 60))
      return res.status(429).json({
        success: false,
        message: `登录失败次数过多，请 ${minutes} 分钟后再试`
      })
    }

    // 挂到 req 上，后续登录成功/失败时使用
    req.loginFailKey = key
    next()
  } catch (_) {
    // Redis 故障不影响登录流程
    next()
  }
}

module.exports = { loginLimiter, checkLoginFailCount }
