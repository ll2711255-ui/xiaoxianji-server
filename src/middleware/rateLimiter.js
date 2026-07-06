/**
 * 接口限流中间件
 * 基于 IP + Redis 实现（生产环境），开发环境使用内存
 */
const logger = require('../utils/logger');

// 内存限流存储（开发环境用，无需 Redis）
const memStore = new Map();

/**
 * 创建限流器
 * @param {object} options
 * @param {number} options.windowMs - 时间窗口（毫秒），默认 60000
 * @param {number} options.max - 最大请求数，默认 60
 * @param {string} options.keyPrefix - Redis key 前缀
 */
function rateLimiter(options = {}) {
  const { windowMs = 60000, max = 60 } = options;

  return (req, res, next) => {
    const ip = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'unknown';
    const now = Date.now();
    const key = ip;

    if (!memStore.has(key)) {
      memStore.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    const entry = memStore.get(key);

    // 检查是否已过期
    if (now > entry.resetAt) {
      memStore.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    entry.count++;

    if (entry.count > max) {
      logger.warn(`[限流] ${ip} 超出频率限制 (${entry.count}/${max})`);
      return res.status(429).json({
        success: false,
        code: 429,
        message: '请求过于频繁，请稍后重试',
      });
    }

    next();
  };
}

// 定期清理过期条目（每5分钟）
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of memStore) {
    if (now > val.resetAt) memStore.delete(key);
  }
}, 5 * 60 * 1000);

module.exports = rateLimiter;
