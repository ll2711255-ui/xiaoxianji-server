/**
 * 鉴权服务
 * - 微信静默登录（wx.login → openid → JWT）
 * - 手机号授权
 * - 商家密码登录
 * - Token 刷新
 */
const crypto = require('crypto');
const db = require('../config/db');
const { code2session } = require('../utils/wechat');
const { signTokens, verifyRefreshToken } = require('../utils/jwt');
const config = require('../config');
const logger = require('../utils/logger');

/**
 * 微信静默登录
 * @param {string} code - wx.login 返回的 code
 * @param {object} profile - 可选用户信息 { nickName, avatarUrl }
 */
async function wxLogin(code, profile = {}) {
  // 1. code2session 获取 openid
  const { openid } = await code2session(code);

  // 2. 查找或创建用户
  let user = await db.queryOne('SELECT * FROM users WHERE openid = ?', [openid]);

  if (user) {
    // 更新登录信息和资料
    const updates = { last_login: new Date() };
    const params = [];
    if (profile.nickName) {
      updates.nick_name = '?';
      params.push(profile.nickName);
    }
    if (profile.avatarUrl) {
      updates.avatar_url = '?';
      params.push(profile.avatarUrl);
    }

    const setClauses = [];
    const updateParams = [];
    for (const [key, val] of Object.entries(updates)) {
      if (val === '?') {
        setClauses.push(`${key} = ?`);
        updateParams.push(params.shift());
      } else {
        setClauses.push(`${key} = ?`);
        updateParams.push(val);
      }
    }
    updateParams.push(openid);
    await db.execute(`UPDATE users SET ${setClauses.join(', ')} WHERE openid = ?`, updateParams);
  } else {
    const insertResult = await db.insert(
      `INSERT INTO users (openid, nick_name, avatar_url, last_login)
       VALUES (?, ?, ?, NOW())`,
      [openid, profile.nickName || '', profile.avatarUrl || '']
    );
    user = { id: insertResult, openid, role: 'customer', phone: '' };
  }

  // 3. 签发 JWT
  const tokens = signTokens(user);

  // 4. 存储 refresh token
  await db.insert(
    `INSERT INTO refresh_tokens (user_id, token, expires_at)
     VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 30 DAY))`,
    [user.id, tokens.refreshToken]
  );

  logger.info(`[auth] 用户登录: ${openid}, role: ${user.role}`);

  return {
    openid: user.openid,
    phone: user.phone || '',
    nickName: user.nick_name || '',
    avatarUrl: user.avatar_url || '',
    role: user.role,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
  };
}

/**
 * 手机号授权（更新用户手机号）
 * @param {string} openid
 * @param {string} phone - 已解密的手机号
 */
async function phoneAuth(openid, phone) {
  await db.execute('UPDATE users SET phone = ? WHERE openid = ?', [phone, openid]);
  logger.info(`[auth] 手机号授权: ${openid} → ${phone}`);
  return { phone };
}

/**
 * 商家登录（手机号 + 密码）
 * @param {string} phone
 * @param {string} password
 */
async function merchantLogin(phone, password) {
  const user = await db.queryOne(
    "SELECT * FROM users WHERE phone = ? AND role IN ('merchant', 'admin')",
    [phone]
  );

  if (!user) {
    throw new Error('账号不存在或非商家账号');
  }

  // 密码验证（SHA256 + salt）
  const hash = crypto
    .createHash('sha256')
    .update(password + config.passwordSalt)
    .digest('hex');

  if (user.password !== hash) {
    throw new Error('密码错误');
  }

  // 更新登录时间
  await db.execute('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);

  const tokens = signTokens(user);

  // 存储 refresh token
  await db.insert(
    `INSERT INTO refresh_tokens (user_id, token, expires_at)
     VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 30 DAY))`,
    [user.id, tokens.refreshToken]
  );

  logger.info(`[auth] 商家登录: ${phone}`);

  return {
    openid: user.openid,
    phone: user.phone,
    nickName: user.nick_name || '',
    role: user.role,
    merchantId: String(user.id),
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
  };
}

/**
 * 刷新 token
 * @param {string} refreshToken
 */
async function refreshToken(refreshToken) {
  // 1. 验证 refresh token
  let decoded;
  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch (err) {
    throw new Error('refresh_token 无效或已过期');
  }

  // 2. 检查数据库中是否存在且未过期
  const tokenRecord = await db.queryOne(
    'SELECT * FROM refresh_tokens WHERE token = ? AND expires_at > NOW()',
    [refreshToken]
  );

  if (!tokenRecord) {
    throw new Error('refresh_token 已失效');
  }

  // 3. 获取用户最新信息
  const user = await db.queryOne('SELECT * FROM users WHERE id = ?', [decoded.id]);
  if (!user) {
    throw new Error('用户不存在');
  }

  // 4. 签发新 token 对
  const tokens = signTokens(user);

  // 5. 旧 token 标记失效 + 存储新 token
  await db.execute('DELETE FROM refresh_tokens WHERE token = ?', [refreshToken]);
  await db.insert(
    `INSERT INTO refresh_tokens (user_id, token, expires_at)
     VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 30 DAY))`,
    [user.id, tokens.refreshToken]
  );

  return {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
  };
}

module.exports = { wxLogin, phoneAuth, merchantLogin, refreshToken };
