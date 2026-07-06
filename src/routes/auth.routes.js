/**
 * 鉴权路由 /api/auth/*
 */
const router = require('express').Router();
const authService = require('../services/auth.service');
const auth = require('../middleware/auth');
const rateLimiter = require('../middleware/rateLimiter');
const logger = require('../utils/logger');

// 登录接口限流：每分钟最多 10 次
const loginLimiter = rateLimiter({ windowMs: 60000, max: 10 });

/**
 * POST /api/auth/wx-login
 * 微信静默登录（wx.login code → JWT）
 * Body: { code, nickName?, avatarUrl? }
 */
router.post('/wx-login', loginLimiter, async (req, res) => {
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
 * Body: { phoneCode } — wx.getPhoneNumber 返回的 code
 * 或 Body: { phone } — 已解密手机号直接存储
 */
router.post('/wx-phone', auth(), async (req, res) => {
  try {
    const { phoneCode, phone } = req.body;

    let phoneNumber = phone;
    if (phoneCode && !phoneNumber) {
      // 生产环境：使用微信 API 解密 phoneCode
      // 开发环境：允许客户端直接传 phone（微信开发者工具限制）
      // 这里暂兼容两种方式
      logger.warn('[auth] phoneCode 解密暂未实现，请传送 phone 字段');
      return res.status(400).json({ success: false, code: 400, message: '请提供手机号' });
    }

    if (!phoneNumber) {
      return res.status(400).json({ success: false, code: 400, message: '缺少手机号' });
    }

    await authService.phoneAuth(req.user.openid, phoneNumber);
    res.json({ success: true, code: 200, message: '手机号绑定成功', data: { phone: phoneNumber } });
  } catch (err) {
    logger.error('[auth] wx-phone 失败:', err.message);
    res.status(500).json({ success: false, code: 500, message: err.message || '授权失败' });
  }
});

/**
 * POST /api/auth/merchant-login
 * 商家登录（手机号 + 密码）
 * Body: { phone, password }
 */
router.post('/merchant-login', loginLimiter, async (req, res) => {
  try {
    const { phone, password } = req.body;
    if (!phone || !password) {
      return res.status(400).json({ success: false, code: 400, message: '请输入手机号和密码' });
    }

    const result = await authService.merchantLogin(phone, password);
    res.json({ success: true, code: 200, message: '登录成功', data: result });
  } catch (err) {
    logger.error('[auth] merchant-login 失败:', err.message);
    res.status(401).json({ success: false, code: 401, message: err.message || '登录失败' });
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
