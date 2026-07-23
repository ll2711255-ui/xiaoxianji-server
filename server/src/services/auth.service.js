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
const { authCode2UserId } = require('../utils/alipay');
const toutiaoUtil = require('../utils/toutiao');
const { signTokens, verifyRefreshToken } = require('../utils/jwt');
const config = require('../config');
const logger = require('../utils/logger');

// ========== 新用户默认值 ==========
const DEFAULT_NICKNAME_PREFIX = '鲜鸡食客_';
const DEFAULT_AVATAR = ''; // 空字符串，前端展示本地品牌默认头像

/**
 * 生成唯一随机昵称：鲜鸡食客_XXXX（4位数字，查重避免重复）
 * @returns {Promise<string>}
 */
async function generateUniqueNickname() {
  const maxRetries = 20;
  for (let i = 0; i < maxRetries; i++) {
    const suffix = String(Math.floor(1000 + Math.random() * 9000)); // 1000-9999
    const nickName = DEFAULT_NICKNAME_PREFIX + suffix;
    const row = await db.queryOne('SELECT COUNT(*) AS cnt FROM users WHERE nick_name = ?', [nickName]);
    if (row && row.cnt === 0) {
      return nickName;
    }
  }
  // 极端情况：20次都重名 → 加时间戳兜底
  const fallback = DEFAULT_NICKNAME_PREFIX + String(Date.now()).slice(-6);
  logger.warn('[auth] 随机昵称生成重试耗尽，使用兜底:', fallback);
  return fallback;
}

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
    // 老用户：更新登录时间，有新资料时一并更新
    const sets = ['last_login = NOW()'];
    const params = [];
    if (profile.nickName) {
      sets.push('nick_name = ?');
      params.push(profile.nickName);
    }
    if (profile.avatarUrl) {
      sets.push('avatar_url = ?');
      params.push(profile.avatarUrl);
    }
    params.push(openid);
    await db.execute(`UPDATE users SET ${sets.join(', ')} WHERE openid = ?`, params);
  } else {
    // 新用户：无微信资料时自动生成品牌默认头像 + 随机生鲜风格昵称
    const nickName = profile.nickName || await generateUniqueNickname();
    const avatarUrl = profile.avatarUrl || DEFAULT_AVATAR;

    const insertResult = await db.insert(
      `INSERT INTO users (openid, nick_name, avatar_url, last_login)
       VALUES (?, ?, ?, NOW())`,
      [openid, nickName, avatarUrl]
    );
    user = { id: insertResult, openid, role: 'customer', phone: '', nickName, avatarUrl };

    logger.info(`[auth] 新用户注册: ${openid}, 昵称: ${nickName}`);
  }

  // 3. 签发 JWT（7天有效期）
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
    nickName: user.nickName || user.nick_name || '',
    avatarUrl: user.avatarUrl || user.avatar_url || '',
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
 * 商家登录（用户名 + 密码 → merchant_accounts 表）
 *
 * 与顾客 users 表完全隔离，使用独立的 merchant_accounts 表。
 * 支持角色：admin / manager / staff
 *
 * @param {string} username - 登录用户名
 * @param {string} password - 明文密码
 */
async function merchantLogin(username, password) {
  // 委托给商家账号服务（与顾客 users 表完全隔离）
  const merchantAccount = require('./merchant-account.service');
  const result = await merchantAccount.login(username, password);

  // 存储 refresh token（复用到 refresh_tokens 表）
  await db.insert(
    `INSERT INTO refresh_tokens (user_id, token, expires_at)
     VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 30 DAY))`,
    [result.id, result.refreshToken]
  );

  return {
    id: result.id,
    username: result.username,
    displayName: result.displayName,
    role: result.role,
    merchantId: String(result.id),
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
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
/**
 * 统一手机号授权入口（当前对接微信，预留支付宝/抖音扩展）
 *
 * 多平台策略：
 *   - 微信：phoneCode → getPhoneNumber(code) → 解密手机号
 *   - 支付宝：phoneCode → getAlipayPhone(code) → TODO: 实现 my.getPhoneNumber 解密
 *   - 抖音：phoneCode → getToutiaoPhone(code) → TODO: 实现 tt.getPhoneNumber 解密
 *   - 三端通用 fallback：直接传 phone（开发环境/降级模式）
 *
 * 后续支付宝/抖音上线时，只需添加平台特定的解密函数，本函数无需修改。
 *
 * @param {string} openid
 * @param {object} params
 * @param {string} params.phoneCode - 平台返回的加密 code
 * @param {string} params.phone - 已解密手机号（fallback）
 */
async function handlePhoneAuth(openid, { phoneCode, phone }) {
  let phoneNumber = phone;

  // 真机模式：通过 phoneCode 调用平台 API 解密
  if (phoneCode && !phoneNumber) {
    // 当前仅微信实现了解密，支付宝/抖音走 phone 直传 fallback
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

// ========== 支付宝登录 ==========

/**
 * 支付宝小程序登录（authCode → userId → JWT）
 *
 * 流程：
 *   前端 my.getAuthCode({ scopes: 'auth_user' }) → authCode
 *   服务端 authCode → alipay.system.oauth.token → userId
 *   以 userId 作为 openid 查找/创建用户 → 签发 JWT
 *
 * @param {string} authCode - 前端获取的 authCode
 * @param {object} profile - 用户资料 { nickName, avatarUrl }
 */
async function alipayLogin(authCode, profile = {}) {
  // 1. authCode → userId
  const { userId } = await authCode2UserId(authCode);

  // 2. 查找或创建用户（支付宝 userId 作为 openid）
  let user = await db.queryOne('SELECT * FROM users WHERE openid = ?', [userId]);

  if (user) {
    const sets = ['last_login = NOW()'];
    const params = [];
    if (profile.nickName) {
      sets.push('nick_name = ?');
      params.push(profile.nickName);
    }
    if (profile.avatarUrl) {
      sets.push('avatar_url = ?');
      params.push(profile.avatarUrl);
    }
    params.push(userId);
    await db.execute(`UPDATE users SET ${sets.join(', ')} WHERE openid = ?`, params);
  } else {
    const nickName = profile.nickName || await generateUniqueNickname();
    const avatarUrl = profile.avatarUrl || DEFAULT_AVATAR;

    const insertResult = await db.insert(
      `INSERT INTO users (openid, nick_name, avatar_url, last_login)
       VALUES (?, ?, ?, NOW())`,
      [userId, nickName, avatarUrl]
    );
    user = { id: insertResult, openid: userId, role: 'customer', phone: '', nickName, avatarUrl };

    logger.info(`[auth] 新支付宝用户注册: ${userId}, 昵称: ${nickName}`);
  }

  // 3. 签发 JWT
  const tokens = signTokens(user);

  // 4. 存储 refresh token
  await db.insert(
    `INSERT INTO refresh_tokens (user_id, token, expires_at)
     VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 30 DAY))`,
    [user.id, tokens.refreshToken]
  );

  logger.info(`[auth] 支付宝用户登录: ${userId}, role: ${user.role}`);

  return {
    openid: user.openid,
    phone: user.phone || '',
    nickName: user.nickName || user.nick_name || '',
    avatarUrl: user.avatarUrl || user.avatar_url || '',
    role: user.role,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
  };
}

// ========== 抖音登录 ==========

/**
 * 抖音小程序登录（code → openid → JWT）
 *
 * 流程与微信类似：
 *   前端 tt.login → code
 *   服务端 code → code2session → openid
 *   以 openid 查找/创建用户 → 签发 JWT
 *
 * @param {string} code - tt.login 返回的 code
 * @param {object} profile - 用户资料 { nickName, avatarUrl }
 */
async function ttLogin(code, profile = {}) {
  // 1. code2session → openid
  const { openid } = await toutiaoUtil.code2session(code);

  // 2. 查找或创建用户
  let user = await db.queryOne('SELECT * FROM users WHERE openid = ?', [openid]);

  if (user) {
    const sets = ['last_login = NOW()'];
    const params = [];
    if (profile.nickName) {
      sets.push('nick_name = ?');
      params.push(profile.nickName);
    }
    if (profile.avatarUrl) {
      sets.push('avatar_url = ?');
      params.push(profile.avatarUrl);
    }
    params.push(openid);
    await db.execute(`UPDATE users SET ${sets.join(', ')} WHERE openid = ?`, params);
  } else {
    const nickName = profile.nickName || await generateUniqueNickname();
    const avatarUrl = profile.avatarUrl || DEFAULT_AVATAR;

    const insertResult = await db.insert(
      `INSERT INTO users (openid, nick_name, avatar_url, last_login)
       VALUES (?, ?, ?, NOW())`,
      [openid, nickName, avatarUrl]
    );
    user = { id: insertResult, openid, role: 'customer', phone: '', nickName, avatarUrl };

    logger.info(`[auth] 新抖音用户注册: ${openid}, 昵称: ${nickName}`);
  }

  // 3. 签发 JWT
  const tokens = signTokens(user);

  // 4. 存储 refresh token
  await db.insert(
    `INSERT INTO refresh_tokens (user_id, token, expires_at)
     VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 30 DAY))`,
    [user.id, tokens.refreshToken]
  );

  logger.info(`[auth] 抖音用户登录: ${openid}, role: ${user.role}`);

  return {
    openid: user.openid,
    phone: user.phone || '',
    nickName: user.nickName || user.nick_name || '',
    avatarUrl: user.avatarUrl || user.avatar_url || '',
    role: user.role,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
  };
}

/**
 * 获取用户资料（头像、昵称、手机号）
 * @param {string} openid
 * @returns {Promise<{nickName: string, avatarUrl: string, phone: string}>}
 */
async function getProfile(openid) {
  const user = await db.queryOne(
    'SELECT nick_name, avatar_url, phone FROM users WHERE openid = ?',
    [openid]
  );
  if (!user) {
    throw new Error('用户不存在');
  }
  return {
    nickName: user.nick_name || '',
    avatarUrl: user.avatar_url || '',
    phone: user.phone || ''
  };
}

/**
 * 更新用户资料（头像、昵称）
 * @param {string} openid
 * @param {object} profile — { nickName? }（头像请走 POST /api/user/avatar）
 * @returns {Promise<{nickName: string, avatarUrl: string}>}
 */
async function updateProfile(openid, profile = {}) {
  const sets = [];
  const params = [];

  if (profile.nickName !== undefined) {
    sets.push('nick_name = ?');
    params.push(profile.nickName);
  }
  // 头像更新必须走 POST /api/user/avatar → media_check_async 审核流程
  // 审核通过后由微信回调切换 avatar_url，此接口不直接写入 avatar_url

  if (sets.length === 0) {
    throw new Error('没有需要更新的字段');
  }

  params.push(openid);
  await db.execute(`UPDATE users SET ${sets.join(', ')} WHERE openid = ?`, params);

  // 读取更新后的完整资料返回
  const user = await db.queryOne(
    'SELECT nick_name, avatar_url FROM users WHERE openid = ?',
    [openid]
  );

  logger.info(`[auth] 用户资料更新: ${openid}`);

  return {
    nickName: (user && user.nick_name) || '',
    avatarUrl: (user && user.avatar_url) || ''
  };
}

module.exports = { wxLogin, alipayLogin, ttLogin, phoneAuth, merchantLogin, refreshToken, handlePhoneAuth, validatePasswordStrength, hashPassword, verifyPassword: verifyPasswordCompat, getProfile, updateProfile };
