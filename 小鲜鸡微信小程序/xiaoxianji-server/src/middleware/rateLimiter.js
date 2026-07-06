const rateLimit = require('express-rate-limit');
const { config } = require('../config');

/**
 * 通用 API 频率限制
 * 每 IP 每分钟 120 次
 */
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: '请求过于频繁，请稍后再试', code: 'RATE_LIMITED' },
});

/**
 * 登录接口频率限制
 * 每 IP 每分钟 10 次
 */
const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: '登录尝试过于频繁，请1分钟后再试', code: 'LOGIN_RATE_LIMITED' },
});

/**
 * 支付回调频率限制（宽松）
 * 每 IP 每分钟 300 次
 */
const callbackLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { code: 'FAIL', message: '请求过频' },
});

module.exports = { apiLimiter, loginLimiter, callbackLimiter };
