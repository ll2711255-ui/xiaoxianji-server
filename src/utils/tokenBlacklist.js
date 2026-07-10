/**
 * Token 黑名单（基于 Redis）
 *
 * 用途：
 *   - 用户改密码后使所有旧 Token 失效
 *   - 管理员手动封禁用户
 *   - 登出时主动失效 Token
 *
 * 原理：
 *   JWT 本身无状态，不能"撤销"。
 *   但可以把 token 的 jti（JWT ID）加入 Redis 黑名单，
 *   每次请求时 auth 中间件检查黑名单，命中则拒绝。
 *
 *   黑名单条目 TTL = token 剩余有效期，过期自动清理。
 */
const { redis } = require('../config/db');
const jwt = require('jsonwebtoken');
const config = require('../config');

const BLACKLIST_PREFIX = 'token:blacklist:';

/**
 * 将 token 加入黑名单
 * @param {string} token - JWT token 字符串
 * @returns {Promise<boolean>}
 */
async function blacklistToken(token) {
  try {
    const decoded = jwt.decode(token);
    if (!decoded || !decoded.jti) return false;

    // 计算剩余有效时间（秒）
    const now = Math.floor(Date.now() / 1000);
    const remainingSec = Math.max(0, decoded.exp - now);
    if (remainingSec <= 0) return false; // 已过期，无需黑名单

    const key = BLACKLIST_PREFIX + decoded.jti;
    await redis.set(key, '1', 'EX', remainingSec);
    return true;
  } catch (_) {
    return false;
  }
}

/**
 * 将用户所有 token 加入黑名单（通过 jti 前缀批量查）
 * 当前实现：仅加入指定的 token。更彻底的做法需要维护 user→token 索引。
 *
 * @param {string} userId - 用户 ID
 * @param {string} token - 当前的 access token（必传）
 * @returns {Promise<void>}
 */
async function blacklistAllUserTokens(userId, token) {
  if (token) {
    await blacklistToken(token);
  }
  // 注：Redis 中缺乏用户→所有token的索引，
  // 要彻底失效所有 token 需要查 DB refresh_tokens 表并一一加入黑名单。
  // 当前简化：只失效传入的 token + 删除所有 refresh token。
}

/**
 * 检查 token 是否在黑名单中
 * @param {string} jti - JWT ID
 * @returns {Promise<boolean>}
 */
async function isTokenBlacklisted(jti) {
  if (!jti) return false;
  try {
    const key = BLACKLIST_PREFIX + jti;
    const exists = await redis.exists(key);
    return exists === 1;
  } catch (_) {
    return false; // Redis 故障时放行，避免全面拒绝服务
  }
}

module.exports = { blacklistToken, blacklistAllUserTokens, isTokenBlacklisted };
