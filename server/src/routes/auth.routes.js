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
 * Body: { phoneCode } — wx.getPhoneNumber 返回的 code（真机）
 * 或 Body: { phone } — 已解密手机号直接存储（开发工具兼容）
 */
router.post('/wx-phone', auth(), async (req, res) => {
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
router.post('/alipay-phone', auth(), async (req, res) => {
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
router.post('/toutiao-phone', auth(), async (req, res) => {
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
router.post('/alipay-login', loginLimiter, async (req, res) => {
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
router.post('/tt-login', loginLimiter, async (req, res) => {
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
