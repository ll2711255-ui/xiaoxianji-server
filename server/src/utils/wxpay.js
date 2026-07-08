/**
 * 微信支付 APIv3 — 核心集成模块
 *
 * 功能：
 *   - JSAPI 预下单
 *   - 订单查询 / 关闭
 *   - 退款申请 / 查询
 *   - 回调签名验证 / AES-256-GCM 解密
 *   - wx.requestPayment 二次签名
 *
 * 对标现有 cloudfunctions/createOrder/payHelper.js 实现
 */
const crypto = require('crypto');
const https = require('https');
const config = require('../config');
const logger = require('./logger');

const MCHID = config.wxpay.mchId;
const SERIAL_NO = config.wxpay.serialNo;
const APIv3_KEY = config.wxpay.apiV3Key;
const PRIVATE_KEY = config.wxpay.privateKey;

// ========== 环境变量检查 ==========
function checkConfig() {
  if (!MCHID || !PRIVATE_KEY) {
    logger.warn('[wxpay] ⚠️ 支付密钥环境变量未配置！请设置 WXPAY_MCHID, WXPAY_SERIAL_NO, WXPAY_APIv3_KEY, WXPAY_PRIVATE_KEY');
    return false;
  }
  return true;
}

// ========== APIv3 签名 ==========

/**
 * 构建 WECHATPAY2-SHA256-RSA2048 Authorization 头
 */
function buildAuth(method, urlPath, body) {
  const ts = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomBytes(16).toString('hex');
  const msg = method + '\n' + urlPath + '\n' + ts + '\n' + nonce + '\n' + (body || '') + '\n';
  const sig = crypto.createSign('RSA-SHA256').update(msg).sign(PRIVATE_KEY, 'base64');
  return (
    'WECHATPAY2-SHA256-RSA2048 mchid="' + MCHID +
    '",nonce_str="' + nonce +
    '",timestamp="' + ts +
    '",serial_no="' + SERIAL_NO +
    '",signature="' + sig + '"'
  );
}

// ========== APIv3 通用请求 ==========

/**
 * 发起 APIv3 请求
 * @param {'GET'|'POST'} method
 * @param {string} path - 接口路径（如 /v3/pay/transactions/jsapi）
 * @param {object} body - 请求体（POST 时）
 * @returns {Promise<{status: number, data: object|string}>}
 */
function v3Request(method, path, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : '';
    const options = {
      hostname: 'api.mch.weixin.qq.com',
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': buildAuth(method, path, bodyStr),
        'User-Agent': 'XiaoXianJi/1.0',
      },
    };

    const req = https.request(options, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        try {
          resolve({ status: res.statusCode, data: JSON.parse(raw) });
        } catch (_) {
          resolve({ status: res.statusCode, data: raw });
        }
      });
    });

    req.on('error', (e) => reject(e));
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

// ========== wx.requestPayment 二次签名 ==========

/**
 * 根据 prepay_id 生成 wx.requestPayment 所需的支付参数
 *
 * 签名串格式（APIv3）：
 *   appId\n
 *   timeStamp\n
 *   nonceStr\n
 *   prepay_id=xxx\n
 */
function buildPayParams(prepayId, appId) {
  const ts = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomBytes(16).toString('hex');
  const pkg = 'prepay_id=' + prepayId;
  const msg = appId + '\n' + ts + '\n' + nonce + '\n' + pkg + '\n';
  const paySign = crypto.createSign('RSA-SHA256').update(msg).sign(PRIVATE_KEY, 'base64');
  return {
    timeStamp: ts,
    nonceStr: nonce,
    package: pkg,
    signType: 'RSA',
    paySign: paySign,
  };
}

// ========== JSAPI 预下单 ==========

/**
 * JSAPI 预下单
 * @param {object} params
 * @param {string} params.appid - 小程序 AppID
 * @param {string} params.out_trade_no - 商户订单号
 * @param {number} params.total - 金额（分）
 * @param {string} params.openid - 用户 openid
 * @param {string} params.description - 商品描述
 * @param {string} params.notify_url - 回调地址
 */
async function jsapiPrepay({ appid, out_trade_no, total, openid, description, notify_url }) {
  const apiBody = {
    appid,
    mchid: MCHID,
    description: description || '小鲜鸡-新鲜生鲜',
    out_trade_no,
    notify_url,
    amount: { total, currency: 'CNY' },
    payer: { openid },
  };

  logger.info('[wxpay] JSAPI 预下单:', JSON.stringify({
    appid, mchid: MCHID, out_trade_no, total, openid,
  }));

  const result = await v3Request('POST', '/v3/pay/transactions/jsapi', apiBody);

  if (result.status === 200 && result.data && result.data.prepay_id) {
    logger.info('[wxpay] 预下单成功 prepay_id:', result.data.prepay_id);
    return { success: true, prepay_id: result.data.prepay_id };
  } else {
    const errMsg = (result.data && (result.data.message || JSON.stringify(result.data))) || '统一下单失败';
    logger.error('[wxpay] 预下单失败:', JSON.stringify(result));
    return { success: false, error: errMsg };
  }
}

// ========== 订单查询 ==========

/**
 * 查询订单支付状态
 * @param {string} outTradeNo - 商户订单号
 */
async function queryOrder(outTradeNo) {
  const path = '/v3/pay/transactions/out-trade-no/' + outTradeNo + '?mchid=' + MCHID;
  logger.info('[wxpay] 查询订单:', outTradeNo);

  const result = await v3Request('GET', path);

  if (result.status === 200 && result.data) {
    return {
      success: true,
      trade_state: result.data.trade_state,
      transaction_id: result.data.transaction_id || '',
      amount: result.data.amount ? result.data.amount.total : 0,
      payer_openid: result.data.payer ? result.data.payer.openid : '',
      success_time: result.data.success_time || '',
    };
  }
  return { success: false, error: (result.data && result.data.message) || '查询失败' };
}

// ========== 关闭订单 ==========

/**
 * 关闭未支付订单
 * @param {string} outTradeNo - 商户订单号
 */
async function closeOrder(outTradeNo) {
  const path = '/v3/pay/transactions/out-trade-no/' + outTradeNo + '/close';
  logger.info('[wxpay] 关闭订单:', outTradeNo);

  const result = await v3Request('POST', path, { mchid: MCHID });

  // 204 No Content 表示成功
  if (result.status === 204 || result.status === 200) {
    return { success: true };
  }
  // 订单已关闭/已支付 — 也算成功
  if (result.data && (result.data.code === 'ORDER_CLOSED' || result.data.code === 'ORDER_PAID')) {
    return { success: true, already: true };
  }
  return { success: false, error: (result.data && result.data.message) || '关闭订单失败' };
}

// ========== 申请退款（V3） ==========

/**
 * 发起退款（APIv3，替代已弃用的 cloud.cloudPay.refund）
 * @param {object} params
 * @param {string} params.out_trade_no - 原商户订单号
 * @param {string} params.out_refund_no - 商户退款单号
 * @param {number} params.total - 原订单金额（分）
 * @param {number} params.refund - 退款金额（分）
 * @param {string} params.reason - 退款原因
 */
async function createRefund({ out_trade_no, out_refund_no, total, refund, reason }) {
  const apiBody = {
    out_trade_no,
    out_refund_no,
    amount: {
      total,
      refund,
      currency: 'CNY',
    },
    reason: reason || '订单退款',
  };

  // 如果配置了退款回调地址
  if (config.notify.refund) {
    apiBody.notify_url = config.notify.refund;
  }

  logger.info('[wxpay] 发起退款:', JSON.stringify({
    out_trade_no, out_refund_no, total, refund, reason,
  }));

  const result = await v3Request('POST', '/v3/refund/domestic/refunds', apiBody);

  if (result.status === 200 && result.data) {
    logger.info('[wxpay] 退款申请成功:', result.data.refund_id || '');
    return {
      success: true,
      refund_id: result.data.refund_id || '',
      status: result.data.status || 'PROCESSING',
    };
  }
  logger.error('[wxpay] 退款失败:', JSON.stringify(result));
  return {
    success: false,
    error: (result.data && result.data.message) || '退款申请失败',
  };
}

// ========== 查询退款 ==========

/**
 * 查询退款状态
 * @param {string} outRefundNo - 商户退款单号
 */
async function queryRefund(outRefundNo) {
  const path = '/v3/refund/domestic/refunds/' + outRefundNo;
  logger.info('[wxpay] 查询退款:', outRefundNo);

  const result = await v3Request('GET', path);

  if (result.status === 200 && result.data) {
    return {
      success: true,
      refund_id: result.data.refund_id || '',
      status: result.data.status || '',
      amount: result.data.amount ? result.data.amount.refund : 0,
    };
  }
  return { success: false, error: (result.data && result.data.message) || '查询退款失败' };
}

// ========== 回调验签与解密 ==========

// 微信平台证书缓存：serialNo → { publicKey, expiresAt }
const certCache = new Map();

/**
 * 从微信支付获取平台证书列表并缓存
 * 文档：https://pay.weixin.qq.com/doc/v3/merchant/4012791856
 */
async function fetchPlatformCertificates() {
  const result = await v3Request('GET', '/v3/certificates');

  if (result.status !== 200 || !result.data || !result.data.data) {
    logger.error('[wxpay] 获取平台证书失败:', JSON.stringify(result));
    throw new Error('获取微信平台证书失败');
  }

  for (const cert of result.data.data) {
    const ec = cert.encrypt_certificate;
    const pem = decryptResource(ec.ciphertext, ec.nonce, ec.associated_data || '');

    certCache.set(cert.serial_no, {
      publicKey: crypto.createPublicKey(pem),
      expiresAt: new Date(cert.expire_time).getTime(),
    });
  }

  logger.info(`[wxpay] 平台证书已更新，共 ${certCache.size} 个`);
}

/**
 * 按序列号查找缓存的平台证书
 * @param {string} serialNo - 回调头 wechatpay-serial
 * @returns {{ publicKey: crypto.KeyObject, expiresAt: number } | null}
 */
function getCachedCert(serialNo) {
  const cert = certCache.get(serialNo);
  if (!cert) return null;
  if (Date.now() > cert.expiresAt) {
    certCache.delete(serialNo);
    return null;
  }
  return cert;
}

/**
 * 验证微信支付回调签名
 *
 * 正确流程（APIv3）：
 *   1. 根据回调头 wechatpay-serial 查缓存平台证书
 *   2. 缓存未命中 → 调用 /v3/certificates 获取最新证书列表
 *   3. 用证书公钥验签（不是商户私钥！）
 *
 * @param {object} headers - 请求头
 * @param {string} rawBody - 原始请求体字符串
 * @returns {Promise<boolean>}
 */
async function verifyCallbackSign(headers, rawBody) {
  try {
    const signature = headers['wechatpay-signature'];
    const timestamp = headers['wechatpay-timestamp'];
    const nonce = headers['wechatpay-nonce'];
    const serialNo = headers['wechatpay-serial'];

    if (!signature || !timestamp || !nonce || !serialNo) {
      logger.error('[wxpay] 回调缺少签名头:', Object.keys(headers));
      return false;
    }

    // 防重放：时间戳偏差超过 5 分钟则拒绝
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - parseInt(timestamp, 10)) > 300) {
      logger.error('[wxpay] 回调时间戳偏差过大:', { timestamp, now });
      return false;
    }

    // 构建签名串: timestamp\nnonce\nbody\n
    const msg = timestamp + '\n' + nonce + '\n' + rawBody + '\n';

    // 查找对应序列号的平台证书
    let cert = getCachedCert(serialNo);
    if (!cert) {
      logger.info('[wxpay] 证书缓存未命中，重新获取平台证书...');
      await fetchPlatformCertificates();
      cert = getCachedCert(serialNo);
      if (!cert) {
        logger.error('[wxpay] 未找到序列号对应的平台证书:', serialNo);
        return false;
      }
    }

    // 用平台证书公钥验签
    const verify = crypto.createVerify('RSA-SHA256');
    verify.update(msg);
    const isValid = verify.verify(cert.publicKey, signature, 'base64');

    if (!isValid) {
      logger.error('[wxpay] 回调签名验证失败');
    }
    return isValid;
  } catch (err) {
    logger.error('[wxpay] 验签异常:', err.message);
    return false;
  }
}

/**
 * AES-256-GCM 解密回调 resource.ciphertext
 * @param {string} ciphertext - Base64 密文
 * @param {string} nonce - 随机串
 * @param {string} associatedData - 附加数据（通常为空）
 * @returns {object} 解密后的 JSON 对象
 */
function decryptResource(ciphertext, nonce, associatedData = '') {
  const ciphertextBuf = Buffer.from(ciphertext, 'base64');
  const authTag = ciphertextBuf.slice(ciphertextBuf.length - 16);
  const data = ciphertextBuf.slice(0, ciphertextBuf.length - 16);

  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    Buffer.from(APIv3_KEY),
    Buffer.from(nonce, 'utf8')
  );
  decipher.setAuthTag(authTag);
  decipher.setAAD(Buffer.from(associatedData, 'utf8'));

  const decrypted = decipher.update(data, undefined, 'utf8') + decipher.final('utf8');
  return JSON.parse(decrypted);
}

module.exports = {
  MCHID,
  checkConfig,
  v3Request,
  buildPayParams,
  jsapiPrepay,
  queryOrder,
  closeOrder,
  createRefund,
  queryRefund,
  verifyCallbackSign,
  decryptResource,
  fetchPlatformCertificates,
};
