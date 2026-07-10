/**
 * 支付宝小程序 API 工具
 *
 * 功能：
 *   - authCode → userId（alipay.system.oauth.token）
 *   - 支付宝小程序支付（alipay.trade.create）
 *   - 回调签名验证（RSA 公钥验签）
 *
 * 支付宝开放平台文档：
 *   https://opendocs.alipay.com/mini/053s5k
 *   https://opendocs.alipay.com/apis/api_1/alipay.system.oauth.token
 */

const crypto = require('crypto');
const axios = require('axios');
const config = require('../config');
const logger = require('./logger');

const ALIPAY_GATEWAY = 'https://openapi.alipay.com/gateway.do';

// ========== 环境变量检查 ==========
function checkConfig() {
  if (!config.alipay.appId || !config.alipay.privateKey) {
    logger.warn('[alipay] ⚠️ 支付宝密钥未配置！请设置 ALIPAY_APPID, ALIPAY_PRIVATE_KEY');
    return false;
  }
  return true;
}

// ========== 通用签名 ==========

/**
 * 构建支付宝请求签名
 * 签名算法：RSA2（SHA256 with RSA）
 *
 * 签名步骤：
 *   1. 按 ASCII 升序排列除了 sign、sign_type 外的所有参数
 *   2. 用 & 拼接成 key=value 格式
 *   3. 用商户私钥 RSA-SHA256 签名
 */
function buildSign(params, privateKey) {
  // 过滤 sign、sign_type，只保留有值的参数
  const signKeys = Object.keys(params)
    .filter(k => k !== 'sign' && k !== 'sign_type' && params[k] !== undefined && params[k] !== '')
    .sort();

  const signStr = signKeys.map(k => `${k}=${params[k]}`).join('&');

  const sign = crypto.createSign('RSA-SHA256');
  sign.update(signStr);
  return sign.sign(privateKey, 'base64');
}

/**
 * 验证支付宝回调签名
 * @param {object} params - POST 表单参数
 * @param {string} alipayPublicKey - 支付宝公钥
 * @returns {boolean}
 */
function verifyCallbackSign(params, alipayPublicKey) {
  try {
    const receivedSign = params.sign;
    if (!receivedSign) {
      logger.error('[alipay] 回调缺少 sign 参数');
      return false;
    }

    const verifyParams = { ...params };
    delete verifyParams.sign;
    delete verifyParams.sign_type;

    const signKeys = Object.keys(verifyParams)
      .filter(k => verifyParams[k] !== undefined && verifyParams[k] !== '')
      .sort();

    const signStr = signKeys.map(k => `${k}=${verifyParams[k]}`).join('&');

    const verify = crypto.createVerify('RSA-SHA256');
    verify.update(signStr);
    return verify.verify(alipayPublicKey, receivedSign, 'base64');
  } catch (err) {
    logger.error('[alipay] 验签异常:', err.message);
    return false;
  }
}

// ========== API 调用 ==========

/**
 * 构建支付宝 API 公共参数
 * @param {string} method - API 方法名（如 alipay.system.oauth.token）
 * @param {object} bizContent - 业务参数
 * @returns {object} 完整请求参数
 */
function buildRequestParams(method, bizContent = {}) {
  const params = {
    app_id: config.alipay.appId,
    method,
    charset: 'utf-8',
    sign_type: 'RSA2',
    timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, '').replace('T', ' ').replace(/[:-]/g, '').slice(0, 14),
    version: '1.0',
  };

  if (method === 'alipay.system.oauth.token') {
    // oauth.token 的 bizContent 直接作为顶级参数传入（grant_type, code, refresh_token）
    Object.assign(params, bizContent);
  } else {
    params.biz_content = JSON.stringify(bizContent);
  }

  params.sign = buildSign(params, config.alipay.privateKey);
  return params;
}

/**
 * 发起支付宝 API 请求
 * @param {string} method - API 方法名
 * @param {object} bizContent - 业务参数
 * @returns {Promise<object>} 解析后的响应
 */
async function apiRequest(method, bizContent) {
  const params = buildRequestParams(method, bizContent);

  // 构建 x-www-form-urlencoded body
  const body = new URLSearchParams(params).toString();

  try {
    const res = await axios.post(ALIPAY_GATEWAY, body, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
      timeout: 15000,
    });

    const data = res.data;

    // 检查顶层错误
    if (data.error_response) {
      const err = data.error_response;
      logger.error(`[alipay] API 错误: ${method}`, JSON.stringify(err));
      throw new Error(`支付宝API错误: ${err.sub_msg || err.msg} (${err.code})`);
    }

    // 解析 response 节点
    const responseKey = method.replace(/\./g, '_') + '_response';
    const response = data[responseKey] || data;

    if (response.code && response.code !== '10000') {
      logger.error(`[alipay] 业务错误: ${method}`, JSON.stringify(response));
      throw new Error(`支付宝业务错误: ${response.sub_msg || response.msg} (${response.code})`);
    }

    return response;
  } catch (err) {
    if (err.message && err.message.startsWith('支付宝')) throw err;
    logger.error(`[alipay] 网络错误: ${method}`, err.message);
    throw new Error('支付宝服务暂不可用，请稍后重试');
  }
}

// ========== 登录相关 ==========

/**
 * authCode 换取 userId（openid）
 *
 * 支付宝登录流程：
 *   前端 my.getAuthCode({scopes:'auth_user'}) → authCode
 *   服务端 alipay.system.oauth.token → userId (= openid)
 *
 * @param {string} authCode - 前端 my.getAuthCode 返回的 authCode
 * @returns {Promise<{userId: string, accessToken: string}>}
 */
async function authCode2UserId(authCode) {
  const response = await apiRequest('alipay.system.oauth.token', {
    grant_type: 'authorization_code',
    code: authCode,
  });

  // 支付宝返回的 userId 作为 openid 使用
  return {
    userId: response.user_id || response.open_id || '',
    accessToken: response.access_token || '',
  };
}

// ========== 支付相关 ==========

/**
 * 支付宝小程序统一下单（alipay.trade.create）
 *
 * 对应前端 my.tradePay（支付宝 JSAPI 支付）
 *
 * @param {object} params
 * @param {string} params.out_trade_no - 商户订单号
 * @param {number} params.total_amount - 金额（元，支付宝用元！）
 * @param {string} params.subject - 商品标题
 * @param {string} params.buyer_id - 买家支付宝 userId（即 openid）
 * @param {string} params.notify_url - 异步回调地址
 * @returns {Promise<{tradeNo: string, orderStr: string}>}
 */
async function createOrder({ out_trade_no, total_amount, subject, buyer_id, notify_url }) {
  const response = await apiRequest('alipay.trade.create', setBizContent({
    out_trade_no,
    total_amount: (total_amount / 100).toFixed(2), // 分 → 元
    subject: subject || '小鲜鸡-新鲜生鲜',
    buyer_id,
    product_code: 'JSAPI_PAY', // 小程序支付必须用 JSAPI_PAY（非当面付的 FACE_TO_FACE_PAY）
  }, notify_url));

  return {
    tradeNo: response.trade_no || '',
    orderStr: response.order_str || '', // 前端 my.tradePay 需要的订单串
  };
}

/**
 * 支付宝订单查询
 * @param {string} out_trade_no - 商户订单号
 */
async function queryOrder(out_trade_no) {
  const response = await apiRequest('alipay.trade.query', {
    out_trade_no,
  });

  return {
    success: true,
    trade_no: response.trade_no || '',
    trade_status: response.trade_status || '',
    total_amount: response.total_amount ? parseFloat(response.total_amount) : 0,
    buyer_user_id: response.buyer_user_id || '',
  };
}

/**
 * 支付宝退款
 * @param {object} params
 * @param {string} params.out_trade_no - 原商户订单号
 * @param {string} params.out_request_no - 退款请求号
 * @param {number} params.refund_amount - 退款金额（分）
 */
async function createRefund({ out_trade_no, out_request_no, refund_amount }) {
  const response = await apiRequest('alipay.trade.refund', {
    out_trade_no,
    out_request_no,
    refund_amount: (refund_amount / 100).toFixed(2),
  });

  return {
    success: true,
    refund_id: response.refund_fee ? out_request_no : '',
    status: 'SUCCESS',
  };
}

/**
 * 构建包含 notify_url 的 bizContent
 */
function setBizContent(base, notify_url) {
  if (notify_url) {
    base.notify_url = notify_url;
  }
  return base;
}

module.exports = {
  checkConfig,
  buildSign,
  verifyCallbackSign,
  apiRequest,
  authCode2UserId,
  createOrder,
  queryOrder,
  createRefund,
};
