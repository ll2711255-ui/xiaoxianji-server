/**
 * 微信小程序 API 工具
 * - code2session (wx.login → openid)
 * - getPhoneNumber (手机号授权)
 */
const axios = require('axios');
const config = require('../config');
const logger = require('./logger');

/**
 * wx.login code 换取 openid 和 session_key
 */
async function code2session(code) {
  const url = 'https://api.weixin.qq.com/sns/jscode2session';
  const params = {
    appid: config.wx.appId,
    secret: config.wx.appSecret,
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

/**
 * 获取微信 access_token（用于服务端 API 调用）
 * 生产环境应缓存到 Redis（7200秒有效期）
 */
async function getAccessToken() {
  const url = 'https://api.weixin.qq.com/cgi-bin/token';
  const params = {
    appid: config.wx.appId,
    secret: config.wx.appSecret,
    grant_type: 'client_credential',
  };

  try {
    const res = await axios.get(url, { params, timeout: 10000 });
    if (res.data.access_token) {
      return res.data.access_token;
    }
    logger.error('获取 access_token 失败:', res.data);
    throw new Error('获取微信 access_token 失败');
  } catch (err) {
    logger.error('获取 access_token 网络错误:', err.message);
    throw err;
  }
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

module.exports = { code2session, getAccessToken, getPhoneNumber };
