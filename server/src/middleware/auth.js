/**
 * JWT 鉴权中间件
 *
 * 使用方式：
 *   router.use(auth());             // 必须登录
 *   router.use(auth('merchant'));   // 必须是商家
 *
 * 每次请求额外检查 Token 黑名单（Redis），支持主动失效。
 */
const { verifyAccessToken } = require('../utils/jwt');
const { isTokenBlacklisted } = require('../utils/tokenBlacklist');
const logger = require('../utils/logger');

/**
 * @param {string} requiredRole - 可选，要求角色（'customer' | 'merchant' | 'admin'）
 */
function auth(requiredRole) {
  return async (req, res, next) => {
    // 从 Authorization 头提取 token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        code: 401,
        message: '未登录或登录已失效',
      });
    }

    const token = authHeader.substring(7);

    try {
      const decoded = verifyAccessToken(token);

      // Token 黑名单检查（Redis 故障时放行，避免全面拒绝服务）
      if (decoded.jti) {
        try {
          const blacklisted = await isTokenBlacklisted(decoded.jti);
          if (blacklisted) {
            return res.status(401).json({
              success: false,
              code: 401,
              message: '登录已失效，请重新登录',
            });
          }
        } catch (_) { /* Redis 故障放行 */ }
      }

      // 角色校验
      if (requiredRole && decoded.role !== requiredRole && decoded.role !== 'admin') {
        return res.status(403).json({
          success: false,
          code: 403,
          message: '无权限操作',
        });
      }

      // 附加到 request
      req.user = {
        id: decoded.id,
        openid: decoded.openid,
        role: decoded.role || 'customer',
        phone: decoded.phone || '',
      };

      next();
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          code: 401,
          message: '登录已过期，请重新登录',
        });
      }
      logger.error('JWT 验证失败:', err.message);
      return res.status(401).json({
        success: false,
        code: 401,
        message: '无效的登录凭证',
      });
    }
  };
}

module.exports = auth;
