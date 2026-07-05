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

module.exports = { code2session, getAccessToken };
