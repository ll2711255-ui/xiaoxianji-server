/**
 * JWT 鉴权中间件
 *
 * 三个导出中间件，按层次使用：
 *
 *   verifyToken      — 解析 JWT，附加 req.user（第一层）
 *   requireMerchant  — 校验 JWT 来源为 merchant_accounts 表（第二层）
 *   requireRole      — 校验角色在允许列表中（第三层）
 *
 * 使用示例：
 *   router.use(verifyToken, requireMerchant)
 *   router.get('/accounts', requireRole('admin', 'manager'), handler)
 */
const jwt = require('jsonwebtoken')
const config = require('../config')
const { isTokenBlacklisted } = require('../utils/tokenBlacklist')
const logger = require('../utils/logger')

// ========== 第一层：Token 解析 ==========

/**
 * 验证 JWT 并附加用户信息到 req.user
 */
async function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: '未登录或登录已失效'
    })
  }

  const token = authHeader.substring(7)

  try {
    const decoded = jwt.verify(token, config.jwt.accessSecret)

    // Token 黑名单检查（Redis 故障时放行）
    if (decoded.jti) {
      try {
        const blacklisted = await isTokenBlacklisted(decoded.jti)
        if (blacklisted) {
          return res.status(401).json({
            success: false,
            message: '登录已失效，请重新登录'
          })
        }
      } catch (_) { /* Redis 故障放行 */ }
    }

    req.user = {
      id: decoded.id,
      openid: decoded.openid,
      role: decoded.role || 'customer',
      phone: decoded.phone || '',
      username: decoded.username || '',
      displayName: decoded.displayName || '',
      source: decoded.source || 'customer' // 'merchant' | 'customer'
    }

    next()
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: '登录已过期，请重新登录'
      })
    }
    logger.error('[auth] JWT 验证失败:', err.message)
    return res.status(401).json({
      success: false,
      message: '无效的登录凭证'
    })
  }
}

// ========== 第二层：商家端来源校验 ==========

/**
 * 校验 JWT 来源为 merchant_accounts 表签发
 * 防止顾客 JWT 被标记为 merchant 角色后越权
 */
function requireMerchant(req, res, next) {
  if (!req.user || req.user.source !== 'merchant') {
    return res.status(403).json({
      success: false,
      message: '仅商家端账号可访问'
    })
  }
  next()
}

// ========== 第三层：角色校验 ==========

/**
 * 校验当前用户角色在允许列表中
 * @param  {...string} roles - 允许的角色列表
 *
 * 使用示例：
 *   requireRole('admin')              // 仅管理员
 *   requireRole('admin', 'manager')   // 管理员或店长
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `需要 ${roles.join(' 或 ')} 权限`
      })
    }
    next()
  }
}

module.exports = { verifyToken, requireMerchant, requireRole }
