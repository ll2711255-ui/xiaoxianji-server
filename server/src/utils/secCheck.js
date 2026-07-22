/**
 * 微信内容安全检测工具
 *
 * 用途：小程序头像/昵称上传时调用微信内容安全 API 检测违规内容
 * API 文档：
 *   imgSecCheck → https://developers.weixin.qq.com/miniprogram/dev/OpenApiDoc/sec-center/sec-check/imgSecCheck.html
 *   msgSecCheck → https://developers.weixin.qq.com/miniprogram/dev/OpenApiDoc/sec-center/sec-check/msgSecCheck.html
 *
 * 设计原则：
 *   - 检测接口调用失败（网络超时等）时默认放行（pass: true），避免微信接口抖动影响正常用户
 *   - errcode 87014 是明确违规，其他异常码默认放行
 *   - access_token 缓存在内存，PM2 cluster 模式下每个实例各自缓存（不影响功能）
 */

const axios = require('axios');
const FormData = require('form-data');
const config = require('../config');
const logger = require('./logger');

// ========== access_token 缓存 ==========

let cachedToken = null;
let tokenExpireAt = 0;

/**
 * 获取微信 access_token（带缓存，提前 5 分钟刷新）
 * @returns {Promise<string>}
 */
async function getAccessToken() {
  if (cachedToken && Date.now() < tokenExpireAt) {
    return cachedToken;
  }

  const appId = config.wx.appId;
  const appSecret = config.wx.appSecret;

  if (!appId || !appSecret) {
    throw new Error('微信小程序 AppID/AppSecret 未配置，无法获取 access_token');
  }

  const res = await axios.get('https://api.weixin.qq.com/cgi-bin/token', {
    params: {
      grant_type: 'client_credential',
      appid: appId,
      secret: appSecret,
    },
    timeout: 8000,
  });

  if (!res.data.access_token) {
    throw new Error('获取 access_token 失败: ' + JSON.stringify(res.data));
  }

  cachedToken = res.data.access_token;
  // 提前 5 分钟过期，避免边界情况
  tokenExpireAt = Date.now() + (res.data.expires_in - 300) * 1000;

  logger.info('[secCheck] access_token 已刷新，过期时间:', new Date(tokenExpireAt).toISOString());
  return cachedToken;
}

// ========== 图片内容安全检测 ==========

/**
 * 图片内容安全检测（imgSecCheck）
 * 适用场景：头像上传、用户发图等
 *
 * @param {Buffer} imageBuffer  图片二进制数据
 * @param {string} openid       用户 openid（用于微信追踪违规用户）
 * @returns {{ pass: boolean, reason: string }}
 */
async function checkImage(imageBuffer, openid) {
  try {
    const token = await getAccessToken();

    const form = new FormData();
    form.append('media', imageBuffer, {
      filename: 'check.jpg',
      contentType: 'image/jpeg',
    });
    form.append('openid', openid || '');
    form.append('scene', '1'); // 1=资料，2=评论，3=论坛，4=社交日志

    const res = await axios.post(
      `https://api.weixin.qq.com/wxa/img_sec_check?access_token=${token}`,
      form,
      {
        headers: form.getHeaders(),
        timeout: 10000,
      }
    );

    logger.info('[secCheck] imgSecCheck 返回:', JSON.stringify(res.data));

    if (res.data.errcode === 0) {
      return { pass: true, reason: '' };
    }

    // 87014 = 内容违规
    if (res.data.errcode === 87014) {
      return { pass: false, reason: '您上传的内容含违规信息，请重新选择头像' };
    }

    // 其他异常码（如限频等）默认放行
    logger.warn('[secCheck] imgSecCheck 异常码:', res.data.errcode, res.data.errmsg);
    return { pass: true, reason: '' };

  } catch (err) {
    // 网络错误/超时 → 默认放行，避免影响正常用户
    logger.error('[secCheck] imgSecCheck 调用失败:', err.message);
    return { pass: true, reason: '' };
  }
}

// ========== 文本内容安全检测 ==========

/**
 * 文本内容安全检测（msgSecCheck v2）
 * 适用场景：昵称修改、用户发帖、评论等
 *
 * @param {string} content  待检测文本
 * @param {string} openid   用户 openid
 * @returns {{ pass: boolean, reason: string }}
 */
async function checkText(content, openid) {
  if (!content || !content.trim()) {
    return { pass: true, reason: '' };
  }

  try {
    const token = await getAccessToken();

    const res = await axios.post(
      `https://api.weixin.qq.com/wxa/msg_sec_check?access_token=${token}`,
      {
        content: content.trim(),
        openid: openid || '',
        scene: 1,    // 1=资料
        version: 2,  // v2 版本
      },
      { timeout: 8000 }
    );

    logger.info('[secCheck] msgSecCheck 返回:', JSON.stringify(res.data));

    if (res.data.errcode === 0) {
      const suggest = res.data.result?.suggest;
      if (suggest === 'risky') {
        return { pass: false, reason: '您提交的内容含违规信息，请修改后重试' };
      }
      return { pass: true, reason: '' };
    }

    if (res.data.errcode === 87014) {
      return { pass: false, reason: '您提交的内容含违规信息，请修改后重试' };
    }

    // 其他异常码默认放行
    logger.warn('[secCheck] msgSecCheck 异常码:', res.data.errcode, res.data.errmsg);
    return { pass: true, reason: '' };

  } catch (err) {
    logger.error('[secCheck] msgSecCheck 调用失败:', err.message);
    return { pass: true, reason: '' };
  }
}

module.exports = { checkImage, checkText };
