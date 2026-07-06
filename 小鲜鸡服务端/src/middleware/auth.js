const jwt = require('jsonwebtoken')
const config = require('../config')
const { fail } = require('../utils/response')

/**
 * 验证 JWT access_token
 */
function verifyToken(req, res, next) {
  // 支付回调跳过
  if (req.path === '/pay-callback') return next()

  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json(fail('未登录，请先授权'))
  }

  const token = authHeader.slice(7)
  try {
    const decoded = jwt.verify(token, config.jwt.secret)
    req.user = decoded  // { userId, merchantId, role, type }
    next()
  } catch (err) {
    return res.status(401).json(fail('Token 已过期，请重新登录'))
  }
}

/**
 * 验证管理后台访问权限（admin / manager）
 */
function verifyDashboard(req, res, next) {
  if (!req.user || !['admin', 'manager'].includes(req.user.role)) {
    return res.status(403).json(fail('无权限，仅管理员和店长可操作'))
  }
  next()
}

/**
 * 验证超级管理员权限
 */
function verifyAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json(fail('无权限，仅超级管理员可操作'))
  }
  next()
}

/**
 * 生成 access_token
 */
function signAccessToken(payload) {
  return jwt.sign(payload, config.jwt.secret, { expiresIn: config.jwt.accessExpires })
}

/**
 * 生成 refresh_token
 */
function signRefreshToken(payload) {
  return jwt.sign(payload, config.jwt.secret, { expiresIn: config.jwt.refreshExpires })
}

module.exports = { verifyToken, verifyDashboard, verifyAdmin, signAccessToken, signRefreshToken }
