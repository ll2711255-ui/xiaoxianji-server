const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const axios = require('axios');
const { config } = require('../config');
const { loginLimiter } = require('../middleware/rateLimiter');
const { auth } = require('../middleware/auth');
const logger = require('../utils/logger');
const prisma = require('../db');

// ========== 微信 code2Session ==========
async function code2Session(code) {
  const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${config.wxAppId}&secret=${config.wxAppSecret}&js_code=${code}&grant_type=authorization_code`;
  const res = await axios.get(url);
  const data = res.data;
  if (data.errcode) {
    logger.error('code2Session失败:', data);
    throw new Error(`微信登录失败: ${data.errmsg || '未知错误'} (${data.errcode})`);
  }
  return data;
}

/**
 * 生成 JWT Token
 */
function generateTokens(user) {
  const payload = {
    userId: Number(user.id),
    openid: user.openid,
    role: user.role,
    merchantId: user.merchantId ? Number(user.merchantId) : null,
  };

  const accessToken = jwt.sign(payload, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  });

  const refreshToken = jwt.sign(
    { userId: Number(user.id), type: 'refresh' },
    config.jwtRefreshSecret,
    { expiresIn: config.jwtRefreshExpiresIn }
  );

  return { accessToken, refreshToken };
}

// ============================================================
// POST /api/auth/wx-login — 小程序静默登录
// ============================================================
router.post('/wx-login', async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.fail('缺少 code 参数');

    const wxData = await code2Session(code);
    if (!wxData.openid) {
      return res.fail('获取微信身份失败', 'WX_LOGIN_FAILED');
    }

    // 查找或创建用户
    let user = await prisma.user.findUnique({ where: { openid: wxData.openid } });
    if (!user) {
      user = await prisma.user.create({
        data: { openid: wxData.openid, unionid: wxData.unionid || null },
      });
      logger.info(`新用户注册: openid=${wxData.openid}`);
    }

    const tokens = generateTokens(user);
    res.ok({
      openid: wxData.openid,
      phone: user.phone || null,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: Number(user.id),
        openid: user.openid,
        phone: user.phone,
        nickName: user.nickName,
        avatarUrl: user.avatarUrl,
        role: user.role,
        merchantId: user.merchantId ? Number(user.merchantId) : null,
      },
    });
  } catch (err) {
    logger.error('wx-login错误:', err);
    res.failServerError(err.message);
  }
});

// ============================================================
// POST /api/auth/wx-phone — 手机号授权
// ============================================================
router.post('/wx-phone', auth(), async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.fail('缺少手机号授权 code');

    // 获取 access_token
    const tokenRes = await axios.get(
      `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${config.wxAppId}&secret=${config.wxAppSecret}`
    );
    const accessToken = tokenRes.data.access_token;

    // 解密手机号
    const phoneRes = await axios.post(
      `https://api.weixin.qq.com/wxa/business/getuserphonenumber?access_token=${accessToken}`,
      { code }
    );

    const phoneInfo = phoneRes.data;
    if (phoneInfo.errcode !== 0) {
      return res.fail(`获取手机号失败: ${phoneInfo.errmsg}`, 'PHONE_FAILED');
    }

    const phone = phoneInfo.phone_info.phoneNumber;

    // 更新用户手机号
    await prisma.user.update({
      where: { id: req.user.userId },
      data: { phone },
    });

    res.ok({ phone });
  } catch (err) {
    logger.error('wx-phone错误:', err);
    res.failServerError(err.message);
  }
});

// ============================================================
// POST /api/auth/merchant-login — 商家账号密码登录
// ============================================================
router.post('/merchant-login', loginLimiter, async (req, res) => {
  try {
    const { phone, password } = req.body;
    if (!phone || !password) return res.fail('请输入手机号和密码');

    // 查找商家账号
    const account = await prisma.merchantAccount.findUnique({ where: { phone } });
    if (!account) {
      await logAttempt(phone, false, req.ip);
      return res.fail('账号或密码错误', 'LOGIN_FAILED');
    }

    // 验证密码（bcrypt）
    const valid = await bcrypt.compare(password, account.passwordHash);
    if (!valid) {
      await logAttempt(phone, false, req.ip);

      // 检查最近失败次数（5次失败锁定15分钟）
      const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000);
      const recentFails = await prisma.loginAttempt.count({
        where: { phone, success: false, createdAt: { gte: fifteenMinAgo } },
      });
      if (recentFails >= 5) {
        return res.status(429).json({
          success: false,
          error: '登录失败次数过多，请15分钟后再试',
          code: 'LOGIN_LOCKED',
        });
      }

      return res.fail('账号或密码错误', 'LOGIN_FAILED');
    }

    // 登录成功
    await logAttempt(phone, true, req.ip);

    // 更新最后登录时间
    await prisma.merchantAccount.update({
      where: { id: account.id },
      data: { lastLoginAt: new Date() },
    });

    // 获取用户记录
    let user = await prisma.user.findFirst({
      where: { merchantId: account.merchantId, role: { in: ['merchant', 'admin'] } },
    });

    if (!user) {
      // 如果用户表里还没有对应记录，创建一个
      user = await prisma.user.create({
        data: {
          openid: `merchant_${account.id}`,
          phone,
          role: 'merchant',
          merchantId: account.merchantId,
        },
      });
    }

    const tokens = generateTokens(user);
    res.ok({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: Number(user.id),
        phone,
        role: user.role,
        merchantId: Number(account.merchantId),
      },
    });
  } catch (err) {
    logger.error('merchant-login错误:', err);
    res.failServerError(err.message);
  }
});

// ============================================================
// POST /api/auth/refresh-token — 刷新Token
// ============================================================
router.post('/refresh-token', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.fail('缺少 refreshToken', 'MISSING_TOKEN');

    const decoded = jwt.verify(refreshToken, config.jwtRefreshSecret);
    if (decoded.type !== 'refresh') {
      return res.failUnauthorized('无效的刷新令牌');
    }

    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user) return res.failUnauthorized('用户不存在');

    const tokens = generateTokens(user);
    res.ok(tokens);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, error: '刷新令牌已过期，请重新登录', code: 'REFRESH_EXPIRED' });
    }
    return res.failUnauthorized('无效的刷新令牌');
  }
});

// ============================================================
// GET /api/auth/check-role — 校验当前用户角色
// ============================================================
router.get('/check-role', auth(), async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.userId } });
    if (!user) return res.failUnauthorized('用户不存在');

    res.ok({
      role: user.role,
      merchantId: user.merchantId ? Number(user.merchantId) : null,
      phone: user.phone,
    });
  } catch (err) {
    logger.error('check-role错误:', err);
    res.failServerError('查询失败');
  }
});

// ========== 辅助函数 ==========
async function logAttempt(phone, success, ip) {
  try {
    await prisma.loginAttempt.create({
      data: { phone, success, ip: ip || null },
    });
  } catch (_) {
    // 日志写入失败不影响主流程
  }
}

module.exports = router;
