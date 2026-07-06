/**
 * 微信支付 APIv3 — JSAPI 直连模式
 *
 * 从云函数 payHelper.js 迁移至独立服务器
 * 私钥从文件系统读取（/etc/wechatpay/apiclient_key.pem），不硬编码
 */
import fs from 'fs';
import crypto from 'crypto';
import https from 'https';
import { config } from '../config';

// 缓存商户私钥
let cachedPrivateKey = '';

function getPrivateKey(): string {
  if (cachedPrivateKey) return cachedPrivateKey;
  try {
    cachedPrivateKey = fs.readFileSync(config.wxpay.privateKeyPath, 'utf8');
  } catch {
    // 开发阶段兜底：从环境变量读取（base64 编码）
    const envKey = process.env.WXPAY_PRIVATE_KEY || '';
    cachedPrivateKey = envKey ? Buffer.from(envKey, 'base64').toString('utf8') : '';
  }
  return cachedPrivateKey;
}

// ========== APIv3 签名 ==========

function buildAuth(method: string, urlPath: string, body: string): string {
  const ts = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomBytes(16).toString('hex');
  const msg = `${method}\n${urlPath}\n${ts}\n${nonce}\n${body || ''}\n`;
  const sig = crypto.createSign('RSA-SHA256').update(msg).sign(getPrivateKey(), 'base64');
  return `WECHATPAY2-SHA256-RSA2048 mchid="${config.wxpay.mchId}",nonce_str="${nonce}",timestamp="${ts}",serial_no="${config.wxpay.serialNo}",signature="${sig}"`;
}

// ========== APIv3 请求 ==========

interface V3Result {
  status: number;
  data: any;
}

export function v3Request(method: string, path: string, body?: object): Promise<V3Result> {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : '';
    const req = https.request(
      {
        hostname: 'api.mch.weixin.qq.com',
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: buildAuth(method, path, bodyStr),
          'User-Agent': 'XiaoXianJi/2.0',
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          try {
            resolve({ status: res.statusCode || 0, data: JSON.parse(raw) });
          } catch {
            resolve({ status: res.statusCode || 0, data: raw });
          }
        });
      },
    );
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

// ========== 平台证书管理（回调验签用） ==========

interface CertInfo {
  serial_no: string;
  publicKey: string;
  expiresAt: number;
}

let certCache: CertInfo[] = [];

async function fetchPlatformCerts(): Promise<CertInfo[]> {
  if (certCache.length > 0 && certCache[0].expiresAt > Date.now()) {
    return certCache;
  }

  const result = await v3Request('GET', '/v3/certificates');

  if (result.status === 200 && result.data?.data) {
    certCache = result.data.data.map((item: any) => ({
      serial_no: item.serial_no,
      publicKey: decryptCert(item.encrypt_certificate),
      expiresAt: Date.now() + 12 * 3600 * 1000, // 12h 缓存
    }));
  }

  return certCache;
}

function decryptCert(encCert: {
  algorithm: string;
  nonce: string;
  associated_data: string;
  ciphertext: string;
}): string {
  const ciphertextBuf = Buffer.from(encCert.ciphertext, 'base64');
  const authTag = ciphertextBuf.slice(ciphertextBuf.length - 16);
  const data = ciphertextBuf.slice(0, ciphertextBuf.length - 16);

  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    Buffer.from(config.wxpay.apiV3Key),
    Buffer.from(encCert.nonce, 'utf8'),
  );
  decipher.setAuthTag(authTag);
  decipher.setAAD(Buffer.from(encCert.associated_data, 'utf8'));

  return decipher.update(data, undefined, 'utf8') + decipher.final('utf8');
}

// ========== 回调签名验证 ==========

export async function verifyCallbackSign(headers: Record<string, string>, rawBody: string): Promise<boolean> {
  const timestamp = headers['wechatpay-timestamp'] || '';
  const nonce = headers['wechatpay-nonce'] || '';
  const signature = headers['wechatpay-signature'] || '';
  const serialNo = headers['wechatpay-serial'] || '';

  if (!timestamp || !nonce || !signature) {
    console.warn('[payment] 回调缺少签名头');
    return false;
  }

  const msg = `${timestamp}\n${nonce}\n${rawBody}\n`;

  // 获取匹配序列号的平台证书
  const certs = await fetchPlatformCerts();
  const cert = certs.find((c) => c.serial_no === serialNo);

  if (!cert) {
    console.warn(`[payment] 未找到序列号 ${serialNo} 的平台证书`);
    return false;
  }

  return crypto.createVerify('RSA-SHA256').update(msg).verify(cert.publicKey, signature, 'base64');
}

// ========== JSAPI 下单 ==========

export async function createJsapiOrder(params: {
  appId: string;
  openid: string;
  outTradeNo: string;
  totalFen: number;
  description: string;
}): Promise<{ prepayId: string } | { error: string }> {
  const { appId, openid, outTradeNo, totalFen, description } = params;

  const body = {
    appid: appId,
    mchid: config.wxpay.mchId,
    description,
    out_trade_no: outTradeNo,
    notify_url: config.wxpay.notifyUrl,
    amount: { total: totalFen, currency: 'CNY' },
    payer: { openid },
  };

  console.log('[payment] JSAPI 下单:', JSON.stringify({ appId, mchid: config.wxpay.mchId, outTradeNo, total: totalFen }));

  const result = await v3Request('POST', '/v3/pay/transactions/jsapi', body);

  if (result.status === 200 && result.data?.prepay_id) {
    return { prepayId: result.data.prepay_id };
  }

  console.error('[payment] JSAPI 下单失败:', JSON.stringify(result));
  return { error: result.data?.message || '统一下单失败' };
}

// ========== 查询订单 ==========

export async function queryOrder(outTradeNo: string): Promise<any> {
  const path = `/v3/pay/transactions/out-trade-no/${outTradeNo}?mchid=${config.wxpay.mchId}`;
  const result = await v3Request('GET', path);
  return result.data;
}

// ========== 生成 wx.requestPayment 参数 ==========

export function buildPayParams(prepayId: string, appId: string) {
  const ts = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomBytes(16).toString('hex');
  const pkg = `prepay_id=${prepayId}`;
  const msg = `${appId}\n${ts}\n${nonce}\n${pkg}\n`;
  const paySign = crypto.createSign('RSA-SHA256').update(msg).sign(getPrivateKey(), 'base64');

  return {
    timeStamp: ts,
    nonceStr: nonce,
    package: pkg,
    signType: 'RSA',
    paySign,
  };
}

// ========== 申请退款 ==========

export async function createRefund(params: {
  outTradeNo: string;
  outRefundNo: string;
  totalFen: number;
  refundFen: number;
  reason?: string;
}): Promise<{ success: boolean; refundId?: string; error?: string }> {
  const body = {
    out_trade_no: params.outTradeNo,
    out_refund_no: params.outRefundNo,
    amount: {
      refund: params.refundFen,
      total: params.totalFen,
      currency: 'CNY',
    },
    reason: params.reason || '称重差额退款',
    notify_url: config.wxpay.refundNotifyUrl,
  };

  const result = await v3Request('POST', '/v3/refund/domestic/refunds', body);

  if (result.status === 200 && result.data?.status === 'SUCCESS') {
    return { success: true, refundId: result.data.refund_id };
  }

  return { success: false, error: result.data?.message || '退款申请失败' };
}

// ========== 解密回调 resource ==========

export function decryptCallbackResource(resource: {
  algorithm: string;
  ciphertext: string;
  nonce: string;
  associated_data?: string;
}): any {
  const ciphertextBuf = Buffer.from(resource.ciphertext, 'base64');
  const authTag = ciphertextBuf.slice(ciphertextBuf.length - 16);
  const data = ciphertextBuf.slice(0, ciphertextBuf.length - 16);

  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    Buffer.from(config.wxpay.apiV3Key),
    Buffer.from(resource.nonce, 'utf8'),
  );
  decipher.setAuthTag(authTag);
  decipher.setAAD(Buffer.from(resource.associated_data || '', 'utf8'));

  const decrypted = decipher.update(data, undefined, 'utf8') + decipher.final('utf8');
  return JSON.parse(decrypted);
}
