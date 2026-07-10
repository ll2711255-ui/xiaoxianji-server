/**
 * 抖音小程序 API 工具
 *
 * 功能：
 *   - code → openid（jscode2session）
 *   - 抖音小程序支付（ec.order.add）
 *   - 回调签名验证（appid + secret MD5）
 *
 * 抖音开放平台文档：
 *   https://developer.open-douyin.com/docs/resource/zh-CN/mini-app/develop/server/log-in/code-2-session
 *   https://developer.open-douyin.com/docs/resource/zh-CN/mini-app/develop/server/ec-pay/order
 */

const crypto = require('crypto');
const axios = require('axios');
const config = require('../config');
const logger = require('./logger');

const TOUTIAO_API = 'https://developer.toutiao.com/api/apps';
const TOUTIAO_EC_API = 'https://developer.toutiao.com/api/apps/ecpay/v1';

// ========== 环境变量检查 ==========
function checkConfig() {
  if (!config.toutiao.appId || !config.toutiao.appSecret) {
    logger.warn('[toutiao] ⚠️ 抖音密钥未配置！请设置 TOUTIAO_APPID, TOUTIAO_APPSECRET');
    return false;
  }
  return true;
}

// ========== access_token 管理 ==========

let cachedAccessToken = null;
let tokenExpiresAt = 0;

/**
 * 获取抖音服务端 access_token（带缓存，有效期 2 小时）
 *
 * 文档：https://developer.open-douyin.com/docs/resource/zh-CN/mini-app/develop/server/interface-request-credential/get-access-token
 */
async function getAccessToken() {
  if (cachedAccessToken && Date.now() < tokenExpiresAt - 60000) {
    return cachedAccessToken;
  }

  const url = `${TOUTIAO_API}/v2/token`;
  const params = {
    appid: config.toutiao.appId,
    secret: config.toutiao.appSecret,
    grant_type: 'client_credential',
  };

  try {
    const res = await axios.post(url, params, { timeout: 10000 });
    const data = res.data;

    if (data.err_no !== 0) {
      logger.error('[toutiao] 获取 access_token 失败:', data);
      throw new Error(`抖音 access_token 获取失败: ${data.err_tips || data.err_msg} (${data.err_no})`);
    }

    cachedAccessToken = data.data.access_token;
    tokenExpiresAt = Date.now() + (data.data.expires_in || 7200) * 1000;

    logger.info('[toutiao] access_token 已刷新');
    return cachedAccessToken;
  } catch (err) {
    if (err.message && err.message.startsWith('抖音')) throw err;
    logger.error('[toutiao] 获取 access_token 网络错误:', err.message);
    throw new Error('抖音服务暂不可用，请稍后重试');
  }
}

// ========== 登录相关 ==========

/**
 * jscode2session — code 换取 openid
 *
 * 抖音登录流程：
 *   前端 tt.login → code
 *   服务端 code2session → openid
 *
 * @param {string} code - 前端 tt.login 返回的 code
 * @returns {Promise<{openid: string, sessionKey: string, unionid: string}>}
 */
async function code2session(code) {
  const url = `${TOUTIAO_API}/jscode2session`;
  const params = {
    appid: config.toutiao.appId,
    secret: config.toutiao.appSecret,
    js_code: code,
    grant_type: 'authorization_code',
  };

  try {
    const res = await axios.post(url, params, { timeout: 10000 });
    const data = res.data;

    if (data.err_no !== 0) {
      logger.error('[toutiao] code2session 失败:', data);
      throw new Error(`抖音登录失败: ${data.err_tips || data.err_msg || '未知错误'} (${data.err_no})`);
    }

    return {
      openid: data.data.openid,
      sessionKey: data.data.session_key || '',
      unionid: data.data.unionid || '',
    };
  } catch (err) {
    if (err.message && err.message.startsWith('抖音')) throw err;
    logger.error('[toutiao] code2session 网络错误:', err.message);
    throw new Error('抖音登录服务暂不可用，请稍后重试');
  }
}

// ========== 支付相关 ==========

/**
 * 抖音小程序统一下单（ec.order.add）
 *
 * 对应前端 tt.pay
 *
 * 文档：https://developer.open-douyin.com/docs/resource/zh-CN/mini-app/develop/server/ec-pay/order
 *
 * @param {object} params
 * @param {string} params.out_order_no - 商户订单号
 * @param {number} params.total_amount - 金额（分）
 * @param {string} params.subject - 商品描述
 * @param {string} params.openid - 用户 openid
 * @param {string} params.notify_url - 异步回调地址
 * @returns {Promise<{orderId: string, orderToken: string}>}
 */
async function createOrder({ out_order_no, total_amount, subject, openid, notify_url }) {
  const accessToken = await getAccessToken();

  const body = {
    app_id: config.toutiao.appId,
    out_order_no,
    total_amount,
    subject: subject || '小鲜鸡-新鲜生鲜',
    body: subject || '小鲜鸡-新鲜生鲜',
    valid_time: 900, // 订单有效期 15 分钟
    cp_extra: '',
    notify_url: notify_url || '',
    thirdparty_id: '',
    disable_msg: 0,
    msg_page: '',
    limit_pay_way: '', // 不限制支付方式
  };

  // 如果有 openid，附加到订单（用于支付时校验用户身份）
  if (openid) {
    body.open_id = openid;
  }

  const url = `${TOUTIAO_EC_API}/order/add`;
  const signParams = {
    _http_method: 'POST',
    'content-type': 'application/json',
    _body: ';' + JSON.stringify(body),
  };

  try {
    const res = await axios.post(url, body, {
      headers: {
        'Content-Type': 'application/json',
        'access-token': accessToken,
        'sign': buildSign(signParams),
        'appid': config.toutiao.appId,
      },
      timeout: 15000,
    });

    const data = res.data;

    if (data.err_no !== 0) {
      logger.error('[toutiao] 创建订单失败:', JSON.stringify(data));
      throw new Error(`抖音支付下单失败: ${data.err_tips || data.err_msg} (${data.err_no})`);
    }

    return {
      orderId: data.data.order_id || '',
      orderToken: data.data.order_token || '',
    };
  } catch (err) {
    if (err.message && err.message.startsWith('抖音')) throw err;
    logger.error('[toutiao] 创建订单网络错误:', err.message);
    throw new Error('抖音支付服务暂不可用，请稍后重试');
  }
}

/**
 * 抖音支付回调签名验证
 *
 * 抖音回调签名规则：
 *   1. 用 appsecret 的 MD5 作为 key
 *   2. 对回调 POST body 的 JSON 字符串计算 HMAC-SHA256
 *   3. 与回调头 x-toutiao-signature 比对
 *
 * @param {string} rawBody - 原始 JSON 请求体字符串
 * @param {string} signature - 回调头 Toutiao-Signature
 * @returns {boolean}
 */
function verifyCallbackSign(rawBody, signature) {
  try {
    if (!signature) {
      logger.error('[toutiao] 回调缺少签名头');
      return false;
    }

    // 签名的 key 是 appsecret 的 MD5
    const key = crypto.createHash('md5').update(config.toutiao.appSecret).digest();

    // HMAC-SHA256
    const hmac = crypto.createHmac('sha256', key);
    hmac.update(rawBody);
    const expectedSign = hmac.digest('hex');

    const isValid = expectedSign === signature;
    if (!isValid) {
      logger.error('[toutiao] 回调签名验证失败');
    }
    return isValid;
  } catch (err) {
    logger.error('[toutiao] 验签异常:', err.message);
    return false;
  }
}

/**
 * 抖音签名算法（用于 API 调用，非回调验签）
 *
 * 对于 POST + JSON：
 *   sign = HMAC-SHA256(app_secret, "POST\ncontent-type:application/json\n;{json_body}")
 */
function buildSign(params) {
  const appSecret = config.toutiao.appSecret;
  let signStr = '';

  if (params._http_method) {
    signStr = `${params._http_method}\n`;
    delete params._http_method;
  }
  if (params['content-type']) {
    signStr += `content-type:${params['content-type']}\n`;
    delete params['content-type'];
  }
  // 剩余参数是 JSON body 的字符串（以 ; 前缀）
  const remaining = Object.values(params).join('');
  signStr += remaining;

  const hmac = crypto.createHmac('sha256', appSecret);
  hmac.update(signStr);
  return hmac.digest('hex');
}

/**
 * 抖音订单查询
 * @param {string} out_order_no - 商户订单号
 */
async function queryOrder(out_order_no) {
  const accessToken = await getAccessToken();

  const body = {
    app_id: config.toutiao.appId,
    out_order_no,
  };

  const signParams = {
    _http_method: 'POST',
    'content-type': 'application/json',
    _body: ';' + JSON.stringify(body),
  };

  try {
    const url = `${TOUTIAO_EC_API}/order/query`;
    const res = await axios.post(url, body, {
      headers: {
        'Content-Type': 'application/json',
        'access-token': accessToken,
        'sign': buildSign(signParams),
        'appid': config.toutiao.appId,
      },
      timeout: 10000,
    });

    const data = res.data;
    if (data.err_no !== 0) {
      logger.error('[toutiao] 查询订单失败:', JSON.stringify(data));
      return { success: false, error: data.err_tips || data.err_msg };
    }

    return {
      success: true,
      order_id: data.data.order_id || '',
      pay_status: data.data.pay_status || '',
      total_amount: data.data.total_amount || 0,
    };
  } catch (err) {
    logger.error('[toutiao] 查询订单网络错误:', err.message);
    return { success: false, error: '查询失败' };
  }
}

/**
 * 抖音退款
 * @param {object} params
 * @param {string} params.out_order_no - 原商户订单号
 * @param {string} params.out_refund_no - 退款单号
 * @param {number} params.refund_amount - 退款金额（分）
 * @param {string} params.reason - 退款原因
 */
async function createRefund({ out_order_no, out_refund_no, refund_amount, reason }) {
  const accessToken = await getAccessToken();

  const body = {
    app_id: config.toutiao.appId,
    out_order_no,
    out_refund_no,
    refund_amount,
    reason: reason || '订单退款',
  };

  const signParams = {
    _http_method: 'POST',
    'content-type': 'application/json',
    _body: ';' + JSON.stringify(body),
  };

  try {
    const url = `${TOUTIAO_EC_API}/order/refund`;
    const res = await axios.post(url, body, {
      headers: {
        'Content-Type': 'application/json',
        'access-token': accessToken,
        'sign': buildSign(signParams),
        'appid': config.toutiao.appId,
      },
      timeout: 15000,
    });

    const data = res.data;
    if (data.err_no !== 0) {
      logger.error('[toutiao] 退款失败:', JSON.stringify(data));
      return { success: false, error: data.err_tips || data.err_msg };
    }

    return { success: true, refund_id: data.data.refund_id || '' };
  } catch (err) {
    logger.error('[toutiao] 退款网络错误:', err.message);
    return { success: false, error: '退款失败' };
  }
}

module.exports = {
  checkConfig,
  getAccessToken,
  code2session,
  createOrder,
  queryOrder,
  createRefund,
  verifyCallbackSign,
  buildSign,
};
