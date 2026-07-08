/**
 * 接口限流中间件
 *
 * 双模式：
 *   - Redis 可用 → Redis 滑动窗口计数（多进程共享，生产推荐）
 *   - Redis 不可用 → 内存计数（单进程，开发模式，PM2 集群下各算各的）
 *
 * 限流粒度：
 *   - 默认按 IP 限流（登录接口：按 IP + 按账号双限）
 */
const logger = require('../utils/logger');

// 内存限流存储（降级用）
const memStore = new Map();

/** Redis 是否可用（惰性检测，失败后切换内存模式） */
let redisAvailable = null;

/**
 * 尝试获取 Redis 客户端（不强制依赖）
 */
function tryGetRedis() {
  if (redisAvailable !== null) return redisAvailable ? require('../config/db').redis : null;
  try {
    const { redis } = require('../config/db');
    redisAvailable = true;
    return redis;
  } catch (_) {
    redisAvailable = false;
    return null;
  }
}

/**
 * Redis 滑动窗口限流
 * key: rate:<prefix>:<identifier>
 * 使用 sorted set，score = timestamp，每次清理过期 + 计数
 */
async function redisRateCheck(redis, key, windowMs, max) {
  const now = Date.now();
  const cutoff = now - windowMs;

  try {
    // pipeline: 清理过期 + 添加当前 + 计数
    const pipe = redis.pipeline();
    pipe.zremrangebyscore(key, 0, cutoff);   // 删除窗口外的
    pipe.zadd(key, now, `${now}_${Math.random().toString(36).slice(2, 8)}`); // 添加当前
    pipe.zcard(key);                           // 计数
    pipe.expire(key, Math.ceil(windowMs / 1000) + 10); // TTL
    const results = await pipe.exec();

    // results = [[err, res], [err, res], [err, res]]
    const count = results && results[2] && results[2][1] ? results[2][1] : 0;
    return { allowed: count <= max, count };
  } catch (_) {
    // Redis 故障 → 降级到内存
    return null;
  }
}

/**
 * 内存限流（降级方案）
 */
function memoryRateCheck(key, windowMs, max) {
  const now = Date.now();

  if (!memStore.has(key)) {
    memStore.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, count: 1 };
  }

  const entry = memStore.get(key);
  if (now > entry.resetAt) {
    memStore.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, count: 1 };
  }

  entry.count++;
  return { allowed: entry.count <= max, count: entry.count };
}

/**
 * 创建限流器
 * @param {object} options
 * @param {number} options.windowMs - 时间窗口（毫秒），默认 60000
 * @param {number} options.max - 最大请求数，默认 60
 * @param {string} options.keyPrefix - Redis key 前缀
 * @param {boolean} options.byAccount - 是否同时按账号限流（需 req.user）
 */
function rateLimiter(options = {}) {
  const { windowMs = 60000, max = 60, keyPrefix = 'rate', byAccount = false } = options;

  return async (req, res, next) => {
    const ip = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'unknown';
    const ipKey = `rate:${keyPrefix}:ip:${ip}`;

    // 尝试 Redis
    const redis = tryGetRedis();
    let result;
    if (redis) {
      result = await redisRateCheck(redis, ipKey, windowMs, max);
    }
    if (!result) {
      result = memoryRateCheck(ipKey, windowMs, max);
    }

    if (!result.allowed) {
      logger.warn(`[限流] ${ip} ${keyPrefix} 超频 (${result.count}/${max})`);
      return res.status(429).json({
        success: false,
        code: 429,
        message: '请求过于频繁，请稍后重试',
      });
    }

    // 按账号限流（登录接口用，需在 auth 之后调用）
    if (byAccount && req.user && req.user.openid) {
      const accountKey = `rate:${keyPrefix}:uid:${req.user.openid}`;
      let accountResult;
      if (redis) {
        accountResult = await redisRateCheck(redis, accountKey, windowMs, max);
      }
      if (!accountResult) {
        accountResult = memoryRateCheck(accountKey, windowMs, max);
      }
      if (!accountResult.allowed) {
        logger.warn(`[限流] uid:${req.user.openid} ${keyPrefix} 超频`);
        return res.status(429).json({
          success: false,
          code: 429,
          message: '请求过于频繁，请稍后重试',
        });
      }
    }

    next();
  };
}

// 定期清理过期内存条目（每5分钟）
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of memStore) {
    if (now > val.resetAt) memStore.delete(key);
  }
}, 5 * 60 * 1000);

module.exports = rateLimiter;
