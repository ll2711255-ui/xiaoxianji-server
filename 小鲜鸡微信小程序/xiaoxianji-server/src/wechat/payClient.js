/**
 * 微信支付 APIv3 — HTTP 客户端
 *
 * 替代已弃用的 cloud.cloudPay.unifiedOrder()
 * 从云函数 payHelper.js 完整迁移
 *
 * 功能：
 *  - buildAuth: 构建 WECHATPAY2-SHA256-RSA2048 Authorization 头
 *  - v3Request: 发起 APIv3 HTTPS 请求
 *  - buildPayParams: 根据 prepay_id 生成 wx.requestPayment 参数
 *  - fetchPlatformCerts: 下载微信支付平台证书（用于回调验签）
 *  - verifyCallbackSign: 验证微信支付回调签名
 */
const crypto = require('crypto');
const https = require('https');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');

// ========== 商户配置 ==========
const MCHID = process.env.WXPAY_MCHID || '';
const SERIAL_NO = process.env.WXPAY_SERIAL_NO || '';
const APIv3_KEY = process.env.WXPAY_APIv3_KEY || '';
const PRIVATE_KEY = (process.env.WXPAY_PRIVATE_KEY || '').replace(/\\n/g, '\n');
const PLATFORM_CERT_PATH = process.env.WXPAY_PLATFORM_CERT_PATH || path.join(__dirname, '..', 'certs', 'platform_certs.json');

// ========== 环境变量检查 ==========
if (!MCHID || !APIv3_KEY || !PRIVATE_KEY) {
  console.error('[payClient] ⚠️ 支付密钥环境变量未配置！');
}

// ========== 平台证书缓存 ==========
let platformCerts = {};
let certsLastFetch = 0;
const CERTS_CACHE_TTL = 12 * 3600 * 1000; // 12小时

// 启动时从文件恢复缓存
try {
  if (fs.existsSync(PLATFORM_CERT_PATH)) {
    const cached = JSON.parse(fs.readFileSync(PLATFORM_CERT_PATH, 'utf8'));
    platformCerts = cached.certs || {};
    certsLastFetch = cached.fetchedAt || 0;
    logger.info(`[payClient] 从文件加载平台证书缓存 (${Object.keys(platformCerts).length}个)`);
  }
} catch (_) { /* 忽略 */ }

/**
 * 构建 APIv3 Authorization 头
 */
function buildAuth(method, urlPath, body) {
  const ts = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomBytes(16).toString('hex');
  const msg = method + '\n' + urlPath + '\n' + ts + '\n' + nonce + '\n' + (body || '') + '\n';
  const sig = crypto.createSign('RSA-SHA256').update(msg).sign(PRIVATE_KEY, 'base64');
  return 'WECHATPAY2-SHA256-RSA2048 mchid="' + MCHID + '",nonce_str="' + nonce + '",timestamp="' + ts + '",serial_no="' + SERIAL_NO + '",signature="' + sig + '"';
}

/**
 * 发起 APIv3 请求
 */
function v3Request(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : '';
    const url = new URL(urlPath, 'https://api.mch.weixin.qq.com');
    const req = https.request({
      hostname: url.hostname,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': buildAuth(method, urlPath, bodyStr),
        'User-Agent': 'XiaoXianJi/2.0',
      },
    }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        try {
          resolve({ status: res.statusCode, data: JSON.parse(raw), headers: res.headers });
        } catch (_) {
          resolve({ status: res.statusCode, data: raw, headers: res.headers });
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('请求超时')); });
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

/**
 * 根据 prepay_id 生成 wx.requestPayment 所需参数
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
    paySign,
  };
}

// ========== 平台证书管理 ==========

function decryptCert(ciphertext, nonce, associatedData) {
  const ciphertextBuf = Buffer.from(ciphertext, 'base64');
  const authTag = ciphertextBuf.slice(ciphertextBuf.length - 16);
  const data = ciphertextBuf.slice(0, ciphertextBuf.length - 16);

  const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(APIv3_KEY), Buffer.from(nonce, 'utf8'));
  decipher.setAuthTag(authTag);
  decipher.setAAD(Buffer.from(associatedData || '', 'utf8'));
  return decipher.update(data, undefined, 'utf8') + decipher.final('utf8');
}

async function fetchPlatformCerts() {
  if (Object.keys(platformCerts).length > 0 && Date.now() - certsLastFetch < CERTS_CACHE_TTL) {
    return platformCerts;
  }

  logger.info('[payClient] 下载微信支付平台证书...');
  const result = await v3Request('GET', '/v3/certificates');

  if (result.status !== 200 || !result.data?.data) {
    logger.error('[payClient] 下载失败:', JSON.stringify(result.data).substring(0, 500));
    if (Object.keys(platformCerts).length > 0) {
      logger.warn('[payClient] 使用过期缓存');
      return platformCerts;
    }
    return {};
  }

  const newCerts = {};
  for (const cert of result.data.data) {
    try {
      const enc = cert.encrypt_certificate;
      const pem = decryptCert(enc.ciphertext, enc.nonce, enc.associated_data || '');
      newCerts[cert.serial_no] = pem;
    } catch (e) {
      logger.error('[payClient] 解密失败 serial=' + cert.serial_no, e.message);
    }
  }

  if (Object.keys(newCerts).length > 0) {
    platformCerts = newCerts;
    certsLastFetch = Date.now();

    // 持久化到文件
    try {
      const dir = path.dirname(PLATFORM_CERT_PATH);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(PLATFORM_CERT_PATH, JSON.stringify({ certs: newCerts, fetchedAt: Date.now() }));
    } catch (_) { /* 忽略 */ }

    logger.info(`[payClient] 平台证书已更新 (${Object.keys(newCerts).length}个)`);
  }

  return platformCerts;
}

/**
 * 验证微信支付回调签名
 */
async function verifyCallbackSign(headers, body) {
  if (!headers || !body) return false;

  const timestamp = headers['wechatpay-timestamp'];
  const nonce = headers['wechatpay-nonce'];
  const signature = headers['wechatpay-signature'];
  const serial = headers['wechatpay-serial'];

  if (!timestamp || !nonce || !signature || !serial) {
    logger.warn('[payClient] 回调缺少签名头');
    return false;
  }

  const certs = await fetchPlatformCerts();
  const certPem = certs[serial];
  if (!certPem) {
    logger.error('[payClient] 未找到序列号 ' + serial + ' 的平台证书');
    return false;
  }

  const msg = timestamp + '\n' + nonce + '\n' + body + '\n';
  try {
    const verify = crypto.createVerify('RSA-SHA256');
    verify.update(msg);
    return verify.verify(certPem, signature, 'base64');
  } catch (e) {
    logger.error('[payClient] 验签异常:', e.message);
    return false;
  }
}

/**
 * 解密微信支付回调通知内容
 */
function decryptNotify(ciphertext, nonce, associatedData) {
  return decryptCert(ciphertext, nonce, associatedData);
}

module.exports = {
  MCHID,
  APIv3_KEY,
  buildAuth,
  v3Request,
  buildPayParams,
  fetchPlatformCerts,
  verifyCallbackSign,
  decryptNotify,
};
