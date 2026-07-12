/**
 * 鉴权路由 /api/auth/*
 */
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const redis = require('../config/redis');
const config = require('../config');
const authService = require('../services/auth.service');
const { verifyToken } = require('../middleware/auth');
const { loginLimiter, checkLoginFailCount } = require('../middleware/loginLimiter');
const rateLimiter = require('../middleware/rateLimiter');
const logger = require('../utils/logger');

// 小程序登录接口限流：每分钟最多 10 次
const wxLoginLimiter = rateLimiter({ windowMs: 60000, max: 10 });

/**
 * POST /api/auth/wx-login
 * 微信静默登录（wx.login code → JWT）
 * Body: { code, nickName?, avatarUrl? }
 */
router.post('/wx-login', wxLoginLimiter, async (req, res) => {
  try {
    const { code, nickName, avatarUrl } = req.body;
    if (!code) {
      return res.status(400).json({ success: false, code: 400, message: '缺少登录凭证 code' });
    }

    const result = await authService.wxLogin(code, { nickName, avatarUrl });
    res.json({ success: true, code: 200, message: '登录成功', data: result });
  } catch (err) {
    logger.error('[auth] wx-login 失败:', err.message);
    res.status(500).json({ success: false, code: 500, message: err.message || '登录失败' });
  }
});

/**
 * POST /api/auth/wx-phone
 * 手机号授权
 * Body: { phoneCode } — wx.getPhoneNumber 返回的 code（真机）
 * 或 Body: { phone } — 已解密手机号直接存储（开发工具兼容）
 */
router.post('/wx-phone', verifyToken, async (req, res) => {
  try {
    const { phoneCode, phone } = req.body;

    const result = await authService.handlePhoneAuth(req.user.openid, { phoneCode, phone });
    res.json({ success: true, code: 200, message: '手机号绑定成功', data: { phone: result.phone } });
  } catch (err) {
    logger.error('[auth] wx-phone 失败:', err.message);
    const status = err.message.includes('无效或已过期') ? 400 : 500;
    res.status(status).json({ success: false, code: status, message: err.message || '授权失败' });
  }
});

/**
 * POST /api/auth/alipay-phone
 * 支付宝手机号授权（预留，待支付宝小程序上线后实现 phoneCode 解密）
 * Body: { phoneCode, phone }
 * 当前复用 handlePhoneAuth 的 phone 直传 fallback
 */
router.post('/alipay-phone', verifyToken, async (req, res) => {
  try {
    const { phoneCode, phone } = req.body;
    // TODO: 支付宝上线后接入 my.getPhoneNumber 解密
    const result = await authService.handlePhoneAuth(req.user.openid, { phoneCode, phone });
    res.json({ success: true, code: 200, message: '手机号绑定成功', data: { phone: result.phone } });
  } catch (err) {
    logger.error('[auth] alipay-phone 失败:', err.message);
    const status = err.message.includes('无效或已过期') ? 400 : 500;
    res.status(status).json({ success: false, code: status, message: err.message || '授权失败' });
  }
});

/**
 * POST /api/auth/toutiao-phone
 * 抖音手机号授权（预留，待抖音小程序上线后实现 phoneCode 解密）
 * Body: { phoneCode, phone }
 * 当前复用 handlePhoneAuth 的 phone 直传 fallback
 */
router.post('/toutiao-phone', verifyToken, async (req, res) => {
  try {
    const { phoneCode, phone } = req.body;
    // TODO: 抖音上线后接入 tt.getPhoneNumber 解密
    const result = await authService.handlePhoneAuth(req.user.openid, { phoneCode, phone });
    res.json({ success: true, code: 200, message: '手机号绑定成功', data: { phone: result.phone } });
  } catch (err) {
    logger.error('[auth] toutiao-phone 失败:', err.message);
    const status = err.message.includes('无效或已过期') ? 400 : 500;
    res.status(status).json({ success: false, code: status, message: err.message || '授权失败' });
  }
});

/**
 * POST /api/auth/alipay-login
 * 支付宝小程序登录（my.getAuthCode → userId → JWT）
 * Body: { code, nickName?, avatarUrl? }
 * 注意：支付宝的 code 即 my.getAuthCode 返回的 authCode
 */
router.post('/alipay-login', wxLoginLimiter, async (req, res) => {
  try {
    const { code, nickName, avatarUrl } = req.body;
    if (!code) {
      return res.status(400).json({ success: false, code: 400, message: '缺少登录凭证 authCode' });
    }

    const result = await authService.alipayLogin(code, { nickName, avatarUrl });
    res.json({ success: true, code: 200, message: '登录成功', data: result });
  } catch (err) {
    logger.error('[auth] alipay-login 失败:', err.message);
    res.status(500).json({ success: false, code: 500, message: err.message || '登录失败' });
  }
});

/**
 * POST /api/auth/tt-login
 * 抖音小程序登录（tt.login code → openid → JWT）
 * Body: { code, nickName?, avatarUrl? }
 */
router.post('/tt-login', wxLoginLimiter, async (req, res) => {
  try {
    const { code, nickName, avatarUrl } = req.body;
    if (!code) {
      return res.status(400).json({ success: false, code: 400, message: '缺少登录凭证 code' });
    }

    const result = await authService.ttLogin(code, { nickName, avatarUrl });
    res.json({ success: true, code: 200, message: '登录成功', data: result });
  } catch (err) {
    logger.error('[auth] tt-login 失败:', err.message);
    res.status(500).json({ success: false, code: 500, message: err.message || '登录失败' });
  }
});

/**
 * POST /api/auth/merchant-login
 * 商家登录（用户名 + 密码 → merchant_accounts 表）
 * Body: { username, password }
 *
 * 两层限流保护：
 *   层1: express-rate-limit（IP级别，60秒10次）
 *   层2: Redis 失败计数（用户名级别，5次封15分钟）
 *
 * 与顾客端 users 表完全隔离，使用独立的 merchant_accounts 表。
 */
router.post(
  '/merchant-login',
  loginLimiter,
  checkLoginFailCount,
  async (req, res) => {
    const { username, password } = req.body

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: '用户名和密码不能为空'
      })
    }

    const account = await db.queryOne(
      `SELECT id, username, password_hash, role,
              display_name, is_active
       FROM merchant_accounts WHERE username = ?`,
      [username]
    )

    if (!account) {
      // 用户不存在 → 递增失败计数
      if (req.loginFailKey) {
        try {
          await redis.incr(req.loginFailKey)
          await redis.expire(req.loginFailKey, 900)
        } catch (_) { /* Redis 不可用忽略 */ }
      }
      return res.status(401).json({
        success: false,
        message: '用户名或密码错误'
      })
    }

    if (!account.isActive) {
      return res.status(403).json({
        success: false,
        message: '账号已被禁用，请联系管理员'
      })
    }

    const match = await bcrypt.compare(password, account.passwordHash)

    if (!match) {
      // 密码错误 → 递增失败计数 + 告知剩余次数
      if (req.loginFailKey) {
        try {
          const count = await redis.incr(req.loginFailKey)
          await redis.expire(req.loginFailKey, 900)
          const remaining = 5 - count
          return res.status(401).json({
            success: false,
            message: remaining > 0
              ? `用户名或密码错误，还可尝试 ${remaining} 次`
              : '登录失败次数过多，账号已被锁定15分钟'
          })
        } catch (_) { /* Redis 不可用忽略 */ }
      }
      return res.status(401).json({
        success: false,
        message: '用户名或密码错误'
      })
    }

    // 登录成功 → 清除失败计数
    if (req.loginFailKey) {
      try { await redis.del(req.loginFailKey) } catch (_) { }
    }

    // 更新最后登录时间
    await db.execute(
      'UPDATE merchant_accounts SET last_login_at = NOW() WHERE id = ?',
      [account.id]
    )

    // 签发 JWT（source='merchant' 区分来源）
    const token = jwt.sign(
      {
        id: account.id,
        role: account.role,
        displayName: account.displayName,
        source: 'merchant'
      },
      config.jwt.accessSecret,
      { expiresIn: '8h' }
    )

    // 生成 refresh token
    const refreshToken = jwt.sign(
      {
        id: account.id,
        role: account.role,
        source: 'merchant',
        type: 'refresh'
      },
      config.jwt.refreshSecret,
      { expiresIn: '30d' }
    )

    // 存储 refresh token
    try {
      await db.insert(
        `INSERT INTO refresh_tokens (user_id, token, expires_at)
         VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 30 DAY))`,
        [account.id, refreshToken]
      )
    } catch (_) { /* 非关键 */ }

    logger.info(`[auth] 商家登录: ${username} (${account.role})`)

    res.json({
      success: true,
      data: {
        token,
        refreshToken,
        userInfo: {
          id: account.id,
          username: account.username,
          role: account.role,
          displayName: account.displayName
        }
      }
    })
  }
)

/**
 * GET /api/auth/profile
 * 获取用户资料（头像、昵称、手机号）
 * 需登录（verifyToken）
 */
router.get('/profile', verifyToken, async (req, res) => {
  try {
    const result = await authService.getProfile(req.user.openid);
    res.json({ success: true, code: 200, data: result });
  } catch (err) {
    logger.error('[auth] profile 获取失败:', err.message);
    res.status(500).json({ success: false, code: 500, message: err.message || '获取失败' });
  }
});

/**
 * PUT /api/auth/profile
 * 更新用户资料（头像、昵称）
 * Body: { nickName?, avatarUrl? }
 * 需登录（verifyToken）
 */
router.put('/profile', verifyToken, async (req, res) => {
  try {
    const { nickName, avatarUrl } = req.body;

    // 参数校验
    if (nickName !== undefined && (typeof nickName !== 'string' || nickName.length > 100)) {
      return res.status(400).json({ success: false, code: 400, message: '昵称长度不能超过100个字符' });
    }
    if (avatarUrl !== undefined && typeof avatarUrl !== 'string') {
      return res.status(400).json({ success: false, code: 400, message: '头像地址格式不正确' });
    }

    const result = await authService.updateProfile(req.user.openid, { nickName, avatarUrl });
    res.json({ success: true, code: 200, message: '资料已更新', data: result });
  } catch (err) {
    logger.error('[auth] profile 更新失败:', err.message);
    res.status(500).json({ success: false, code: 500, message: err.message || '更新失败' });
  }
});

/**
 * POST /api/auth/refresh-token
 * 刷新 access token
 * Body: { refreshToken }
 */
router.post('/refresh-token', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ success: false, code: 400, message: '缺少 refreshToken' });
    }

    const result = await authService.refreshToken(refreshToken);
    res.json({ success: true, code: 200, message: 'Token 已刷新', data: result });
  } catch (err) {
    logger.error('[auth] refresh-token 失败:', err.message);
    res.status(401).json({ success: false, code: 401, message: err.message || '刷新失败' });
  }
});

module.exports = router;
