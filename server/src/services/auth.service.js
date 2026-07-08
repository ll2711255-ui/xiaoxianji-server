/**
 * 鉴权服务
 * - 微信静默登录（wx.login → openid → JWT）
 * - 手机号授权
 * - 商家密码登录（bcrypt 哈希验证）
 * - Token 刷新
 * - 密码强度校验
 */
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { code2session, getPhoneNumber } = require('../utils/wechat');
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
 * 验证密码强度
 * 规则来自 config.passwordRules：最少 8 位、必须含数字、小写字母、大写字母
 * @param {string} password
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validatePasswordStrength(password) {
  const rules = config.passwordRules;
  const errors = [];

  if (!password || password.length < rules.minLength) {
    errors.push(`密码至少 ${rules.minLength} 位`);
  }
  if (rules.requireDigit && !/[0-9]/.test(password)) {
    errors.push('密码必须包含数字');
  }
  if (rules.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('密码必须包含小写字母');
  }
  if (rules.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('密码必须包含大写字母');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * 用 bcrypt 哈希密码
 * @param {string} password - 明文密码
 * @returns {Promise<string>} bcrypt 哈希值
 */
async function hashPassword(password) {
  return bcrypt.hash(password, config.bcryptRounds);
}

/**
 * 验证密码（兼容 SHA256 旧密码自动迁移）
 *
 * 迁移策略：
 *   1. 先尝试 bcrypt 比对（新格式）
 *   2. 失败则判断是否为 64 位 hex（SHA256 旧格式）
 *   3. 是旧格式 → 用原 SHA256+旧salt 验证，通过后自动升级为 bcrypt
 *   4. 都不是 → 拒绝
 *
 * @param {string} password - 用户输入的明文
 * @param {string} hash - 数据库中存储的哈希值
 * @returns {Promise<{valid: boolean, needsRehash: boolean}>}
 */
async function verifyPasswordCompat(password, hash) {
  // 1. bcrypt 验证（新格式，以 $2a$ / $2b$ 开头）
  if (hash.startsWith('$2')) {
    const match = await bcrypt.compare(password, hash);
    return { valid: match, needsRehash: false };
  }

  // 2. 旧 SHA256 hex 格式兼容（64 位十六进制字符串）
  if (/^[a-f0-9]{64}$/i.test(hash)) {
    const legacySalt = 'xiaoxianji_salt'; // 旧系统硬编码的默认 salt
    const legacyHash = crypto
      .createHash('sha256')
      .update(password + legacySalt)
      .digest('hex');

    if (legacyHash === hash) {
      return { valid: true, needsRehash: true }; // 密码正确，需升级
    }
    return { valid: false, needsRehash: false };
  }

  // 3. 未知格式
  return { valid: false, needsRehash: false };
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

  // 密码验证（兼容 SHA256 旧密码 → 自动升级为 bcrypt）
  const { valid, needsRehash } = await verifyPasswordCompat(password, user.password);
  if (!valid) {
    throw new Error('密码错误');
  }

  // 旧 SHA256 密码自动升级为 bcrypt
  if (needsRehash) {
    const newHash = await hashPassword(password);
    await db.execute('UPDATE users SET password = ? WHERE id = ?', [newHash, user.id]);
    logger.info(`[auth] 商家 ${phone} 密码已自动升级为 bcrypt`);
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

/**
 * 处理手机号授权（支持 phoneCode 解密 + phone 直传兼容）
 * @param {string} openid
 * @param {object} params — { phoneCode, phone }
 * @returns {Promise<{phone: string}>}
 */
async function handlePhoneAuth(openid, { phoneCode, phone }) {
  let phoneNumber = phone;

  // 真机模式：通过 phoneCode 调用微信 API 解密
  if (phoneCode && !phoneNumber) {
    const result = await getPhoneNumber(phoneCode);
    phoneNumber = result.phone;
  }

  if (!phoneNumber) {
    throw new Error('缺少手机号信息');
  }

  // 校验手机号格式
  if (!/^1[3-9]\d{9}$/.test(phoneNumber)) {
    throw new Error(`手机号格式不正确: ${phoneNumber}`);
  }

  return phoneAuth(openid, phoneNumber);
}

module.exports = { wxLogin, phoneAuth, merchantLogin, refreshToken, handlePhoneAuth, validatePasswordStrength, hashPassword, verifyPassword: verifyPasswordCompat };
