/**
 * JWT 签发与验证
 */
const jwt = require('jsonwebtoken');
const config = require('../config');

/**
 * 签发 access token
 */
function signAccessToken(payload) {
  return jwt.sign(payload, config.jwt.accessSecret, {
    expiresIn: config.jwt.accessExpires,
  });
}

/**
 * 签发 refresh token
 */
function signRefreshToken(payload) {
  return jwt.sign(payload, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpires,
  });
}

/**
 * 签发 token 对
 */
function signTokens(user) {
  const payload = {
    id: user.id,
    openid: user.openid,
    role: user.role || 'customer',
    phone: user.phone || '',
  };

  return {
    accessToken: signAccessToken(payload),
    refreshToken: signRefreshToken(payload),
  };
}

/**
 * 验证 access token
 */
function verifyAccessToken(token) {
  return jwt.verify(token, config.jwt.accessSecret);
}

/**
 * 验证 refresh token
 */
function verifyRefreshToken(token) {
  return jwt.verify(token, config.jwt.refreshSecret);
}

module.exports = {
  signAccessToken,
  signRefreshToken,
  signTokens,
  verifyAccessToken,
  verifyRefreshToken,
};
