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
 * @param {object} [opts]       可选参数
 * @param {string} [opts.mimeType]  文件 MIME 类型（如 'image/png'），默认 'image/jpeg'
 * @param {string} [opts.filename]  原始文件名，默认 'check.jpg'
 * @returns {{ pass: boolean, reason: string }}
 */
async function checkImage(imageBuffer, openid, opts = {}) {
  const mimeType = opts.mimeType || 'image/jpeg';
  const filename = opts.filename || 'check.jpg';
  const sizeKB = (imageBuffer.length / 1024).toFixed(1);

  // 微信 imgSecCheck 限制 1MB，超过则记录警告（仍尝试送检）
  if (imageBuffer.length > 1024 * 1024) {
    logger.warn('[secCheck] 图片过大 (' + sizeKB + 'KB)，可能被微信拒绝');
  }

  try {
    const token = await getAccessToken();

    const form = new FormData();
    form.append('media', imageBuffer, {
      filename,
      contentType: mimeType,
    });
    form.append('openid', openid || '');
    form.append('scene', '1'); // 1=资料，2=评论，3=论坛，4=社交日志

    const res = await axios.post(
      'https://api.weixin.qq.com/wxa/img_sec_check?access_token=' + token,
      form,
      {
        headers: form.getHeaders(),
        timeout: 10000,
      }
    );

    logger.info('[secCheck] imgSecCheck 返回 (' + sizeKB + 'KB, ' + mimeType + '):', JSON.stringify(res.data));

    if (res.data.errcode === 0) {
      return { pass: true, reason: '' };
    }

    // 87014 = 内容违规
    if (res.data.errcode === 87014) {
      return { pass: false, reason: '您上传的内容含违规信息，请重新选择头像' };
    }

    // access_token 过期/无效 → 清除缓存重试一次
    if (res.data.errcode === 40001 || res.data.errcode === 41001 || res.data.errcode === 42001) {
      logger.warn('[secCheck] access_token 过期，清除缓存重试...');
      cachedToken = null;
      tokenExpireAt = 0;
      const newToken = await getAccessToken();

      const form2 = new FormData();
      form2.append('media', imageBuffer, { filename, contentType: mimeType });
      form2.append('openid', openid || '');
      form2.append('scene', '1');

      const res2 = await axios.post(
        'https://api.weixin.qq.com/wxa/img_sec_check?access_token=' + newToken,
        form2,
        { headers: form2.getHeaders(), timeout: 10000 }
      );

      logger.info('[secCheck] imgSecCheck 重试结果:', JSON.stringify(res2.data));

      if (res2.data.errcode === 0) return { pass: true, reason: '' };
      if (res2.data.errcode === 87014) return { pass: false, reason: '您上传的内容含违规信息，请重新选择头像' };

      // 重试后仍异常 → 拦截
      logger.warn('[secCheck] imgSecCheck 重试后仍异常:', res2.data.errcode, res2.data.errmsg);
      return { pass: false, reason: '内容安全检测服务异常，请稍后重试' };
    }

    // 其他异常码 → 拦截（宁可误拦也不放过）
    logger.warn('[secCheck] imgSecCheck 异常码:', res.data.errcode, res.data.errmsg);
    return { pass: false, reason: '内容安全检测服务异常，请稍后重试' };

  } catch (err) {
    // 网络错误/超时 → 拦截（微信不通就不能上传）
    logger.error('[secCheck] imgSecCheck 调用失败:', err.message);
    return { pass: false, reason: '内容安全检测服务异常，请稍后重试' };
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

    // 其他异常码也拦截（宁可误拦也不放过）
    logger.warn('[secCheck] msgSecCheck 异常码:', res.data.errcode, res.data.errmsg);
    return { pass: false, reason: '内容安全检测服务异常，请稍后重试' };

  } catch (err) {
    // 网络错误/超时也拦截（微信不通就不能改昵称）
    logger.error('[secCheck] msgSecCheck 调用失败:', err.message);
    return { pass: false, reason: '内容安全检测服务异常，请稍后重试' };
  }
}

// ========== 异步图片内容安全检测（media_check_async v2） ==========

/**
 * 提交异步图片内容安全检测（media_check_async v2）
 *
 * 行业标准做法（对标朴朴/叮咚）：
 *   先上传图片到云存储获取 HTTPS URL → 提交此接口 → 等待微信回调通知结果
 *
 * 优势：
 *   - 无文件大小限制（同步版 img_sec_check 限制 1MB）
 *   - 通过回调异步通知结果，避免阻塞上传流程
 *   - 审核结果可追溯（trace_id）
 *
 * API 文档：https://developers.weixin.qq.com/miniprogram/dev/OpenApiDoc/sec-center/sec-check/mediaCheckAsync.html
 *
 * @param {string} imageUrl  图片公网 HTTPS 地址
 * @param {string} openid    用户 openid
 * @returns {{ success: boolean, traceId?: string, reason?: string }}
 */
async function submitImageCheck(imageUrl, openid) {
  try {
    const token = await getAccessToken();

    const res = await axios.post(
      'https://api.weixin.qq.com/wxa/media_check_async?access_token=' + token,
      {
        media_url: imageUrl,
        media_type: 1,  // 1=图片，2=音频
        version: 2,     // v2 版本
        scene: 2,       // 1=资料，2=评论，3=论坛，4=社交日志
        openid: openid || '',
      },
      { timeout: 10000 }
    );

    logger.info('[secCheck] media_check_async 提交结果:', JSON.stringify(res.data));

    if (res.data.errcode === 0 && res.data.trace_id) {
      return { success: true, traceId: res.data.trace_id };
    }

    // 提交失败（非违规，是 API 调用失败）
    logger.warn('[secCheck] media_check_async 提交失败:', res.data.errcode, res.data.errmsg);
    return { success: false, reason: '内容安全检测服务暂时不可用，请稍后重试' };

  } catch (err) {
    // 网络错误/超时 → 按拦截处理（异步检测场景下，失败不应放行）
    logger.error('[secCheck] media_check_async 调用失败:', err.message);
    return { success: false, reason: '内容安全检测服务暂时不可用，请稍后重试' };
  }
}

module.exports = { checkImage, checkText, submitImageCheck };
