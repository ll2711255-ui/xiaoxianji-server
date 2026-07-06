const jwt = require('jsonwebtoken');
const { config } = require('../config');
const logger = require('../utils/logger');
const prisma = require('../db');

/**
 * JWT 认证中间件
 *
 * 从 Authorization: Bearer <token> 中提取 JWT，
 * 验证后将 { userId, openid, role, merchantId } 注入 req.user
 *
 * 支持可选的商家角色校验：auth({ requiredRole: 'merchant' })
 */
function auth(options = {}) {
  const { requiredRole } = options;

  return async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.failUnauthorized('请先登录');
    }

    const token = authHeader.slice(7);

    try {
      const decoded = jwt.verify(token, config.jwtSecret);

      // 如果token中有userId，验证用户是否仍存在
      if (decoded.userId) {
        const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
        if (!user) {
          return res.failUnauthorized('用户不存在');
        }
        decoded.openid = user.openid;
        decoded.role = user.role;
        decoded.merchantId = user.merchantId ? Number(user.merchantId) : null;
      }

      // 角色校验
      if (requiredRole) {
        const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
        if (!roles.includes(decoded.role)) {
          return res.failForbidden('需要 ' + roles.join('/') + ' 权限');
        }
      }

      // 注入到请求对象
      req.user = {
        userId: decoded.userId,
        openid: decoded.openid,
        role: decoded.role || 'customer',
        merchantId: decoded.merchantId || null,
      };

      next();
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          error: '登录已过期',
          code: 'TOKEN_EXPIRED',
          needRefresh: true,
        });
      }
      logger.warn('JWT验证失败:', err.message);
      return res.failUnauthorized('无效的登录凭证');
    }
  };
}

/**
 * 可选认证：有 token 就解析，没有不报错
 */
async function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }

  try {
    const decoded = jwt.verify(authHeader.slice(7), config.jwtSecret);
    req.user = {
      userId: decoded.userId,
      openid: decoded.openid,
      role: decoded.role || 'customer',
      merchantId: decoded.merchantId || null,
    };
  } catch (_) {
    req.user = null;
  }
  next();
}

module.exports = { auth, optionalAuth };
