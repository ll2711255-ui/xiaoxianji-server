/**
 * 微信小程序 API 工具
 * - code2session (wx.login → openid)
 * - getPhoneNumber (手机号授权)
 *
 * 凭证获取优先级：.env → DB payment_methods 表（getPayConfig）
 */
const axios = require('axios');
const config = require('../config');
const logger = require('./logger');
const { getPayConfig } = require('./wxpay');

/**
 * 获取微信小程序 appId/appSecret
 * 优先读 .env，为空时从 DB getPayConfig() 获取（含 5 分钟缓存）
 * @returns {Promise<{appId: string, appSecret: string}>}
 */
async function getWxConfig() {
  // .env 有值直接返回
  if (config.wx.appId && config.wx.appSecret) {
    return { appId: config.wx.appId, appSecret: config.wx.appSecret };
  }
  // fallback 到 DB
  try {
    const payConfig = await getPayConfig();
    if (payConfig.appId && payConfig.appSecret) {
      logger.info('[wechat] 凭证来源: DB payment_methods 表');
      return { appId: payConfig.appId, appSecret: payConfig.appSecret };
    }
  } catch (e) {
    logger.error('[wechat] 从 DB 获取微信配置失败:', e.message);
  }
  return { appId: config.wx.appId || '', appSecret: config.wx.appSecret || '' };
}

/**
 * wx.login code 换取 openid 和 session_key
 */
async function code2session(code) {
  const wxConfig = await getWxConfig();
  const url = 'https://api.weixin.qq.com/sns/jscode2session';
  const params = {
    appid: wxConfig.appId,
    secret: wxConfig.appSecret,
    js_code: code,
    grant_type: 'authorization_code',
  };

  const res = await axios.get(url, { params, timeout: 10000 });
  const data = res.data;

  if (data.errcode) {
    logger.error('code2session 失败:', data);
    throw new Error(`微信登录失败: ${data.errmsg || '未知错误'} (${data.errcode})`);
  }

  return {
    openid: data.openid,
    sessionKey: data.session_key,
    unionid: data.unionid || '',
  };
}

// ========== access_token 缓存（内存级，全局共享）==========

let cachedAccessToken = null;
let accessTokenExpireAt = 0;

/**
 * 获取微信 access_token（带缓存，提前 5 分钟刷新）
 *
 * PM2 cluster 模式下每个实例各自维护缓存，不影响功能。
 * 微信限制每日调用上限 2000 次，缓存必须开启。
 *
 * @returns {Promise<string>}
 */
async function getAccessToken() {
  // 缓存命中
  if (cachedAccessToken && Date.now() < accessTokenExpireAt) {
    return cachedAccessToken;
  }

  const wxConfig = await getWxConfig();
  const url = 'https://api.weixin.qq.com/cgi-bin/token';
  const params = {
    appid: wxConfig.appId,
    secret: wxConfig.appSecret,
    grant_type: 'client_credential',
  };

  try {
    const res = await axios.get(url, { params, timeout: 10000 });
    if (res.data.access_token) {
      cachedAccessToken = res.data.access_token;
      // 提前 5 分钟过期，避免边界情况
      const ttl = (res.data.expires_in || 7200) - 300;
      accessTokenExpireAt = Date.now() + ttl * 1000;
      logger.info(`[wechat] access_token 已刷新，${ttl}秒后过期`);
      return cachedAccessToken;
    }
    logger.error('[wechat] 获取 access_token 失败:', res.data);
    throw new Error('获取微信 access_token 失败');
  } catch (err) {
    logger.error('[wechat] 获取 access_token 网络错误:', err.message);
    throw err;
  }
}

/**
 * 清除 access_token 缓存（token 失效时调用）
 */
function clearAccessTokenCache() {
  cachedAccessToken = null;
  accessTokenExpireAt = 0;
  logger.info('[wechat] access_token 缓存已清除');
}

/**
 * 解密手机号（wx.getPhoneNumber 返回的 code）
 * @param {string} code — 前端 wx.getPhoneNumber 获取的动态令牌
 * @returns {Promise<{phone: string, countryCode: string, purePhoneNumber: string}>}
 */
async function getPhoneNumber(code) {
  const accessToken = await getAccessToken();
  const url = `https://api.weixin.qq.com/wxa/business/getuserphonenumber?access_token=${accessToken}`;

  try {
    const res = await axios.post(url, { code }, { timeout: 10000 });

    if (res.data.errcode === 40029) {
      throw new Error('phoneCode 无效或已过期，请重新授权');
    }
    if (res.data.errcode) {
      logger.error('[wechat] 获取手机号失败:', res.data);
      throw new Error(`获取手机号失败: ${res.data.errmsg || '未知错误'} (${res.data.errcode})`);
    }

    const phoneInfo = res.data.phone_info || {};
    return {
      phone: phoneInfo.purePhoneNumber || phoneInfo.phoneNumber || '',
      countryCode: phoneInfo.countryCode || '86',
      purePhoneNumber: phoneInfo.purePhoneNumber || '',
    };
  } catch (err) {
    if (err.message && !err.message.includes('获取手机号失败')) {
      throw err;
    }
    logger.error('[wechat] 获取手机号网络错误:', err.message);
    throw new Error('手机号授权网络异常，请重试');
  }
}

module.exports = { code2session, getAccessToken, clearAccessTokenCache, getPhoneNumber };
