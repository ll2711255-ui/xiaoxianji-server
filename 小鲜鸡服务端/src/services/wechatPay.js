/**
 * 微信支付 APIv3 — JSAPI 下单 + 回调验签
 * 支持两种凭证来源：
 *   1. 环境变量 (.env) — WECHAT_MCHID 等，私钥为文件路径
 *   2. 数据库 (PaymentMethod) — PC 后台"支付设置"保存，私钥为 PEM 内容
 *
 * 回调验签使用 RSA-SHA256 + 平台证书（非 HMAC！）
 * 回调通知体使用 AEAD_AES_256_GCM 解密
 */
const crypto = require('crypto')
const https = require('https')
const fs = require('fs')
const config = require('../config')

// ========== 平台证书缓存 ==========
let platformCerts = {}
let certsLastFetch = 0
const CERTS_CACHE_TTL = 12 * 3600 * 1000 // 12小时

/**
 * 规范化 PEM 格式（修复前端粘贴时换行丢失问题）
 * 将挤在一行的 PEM 重新按 64 字符分行
 */
function normalizePem(pem) {
  if (!pem) return pem
  // 已有换行 → 直接返回
  if (pem.includes('\n')) return pem

  const headerMatch = pem.match(/-----BEGIN [A-Z ]+-----/)
  const footerMatch = pem.match(/-----END [A-Z ]+-----/)
  if (!headerMatch || !footerMatch) return pem

  const header = headerMatch[0]
  const footer = footerMatch[0]
  const bodyStart = pem.indexOf(header) + header.length
  const bodyEnd = pem.indexOf(footer)
  let body = pem.substring(bodyStart, bodyEnd).replace(/\s+/g, '')

  const lines = []
  for (let i = 0; i < body.length; i += 64) {
    lines.push(body.substring(i, i + 64))
  }
  return header + '\n' + lines.join('\n') + '\n' + footer + '\n'
}

/**
 * 获取私钥内容
 * 优先从 env 文件路径读，否则使用传入的 keyContent
 */
function getPrivateKey(keyContent) {
  let pem = keyContent
  if (!pem) {
    if (!config.wechat.privateKeyPath) {
      throw new Error('微信支付私钥未配置（缺少 WECHAT_PRIVATE_KEY_PATH 或 DB 凭证）')
    }
    if (!fs.existsSync(config.wechat.privateKeyPath)) {
      throw new Error('微信支付私钥文件不存在: ' + config.wechat.privateKeyPath)
    }
    pem = fs.readFileSync(config.wechat.privateKeyPath, 'utf8')
  }

  // 修复前端粘贴时换行丢失的 PEM
  pem = normalizePem(pem)

  // OpenSSL 3.x 兼容：PKCS#1 → PKCS#8
  if (pem && pem.includes('BEGIN RSA PRIVATE KEY')) {
    try {
      const keyObj = crypto.createPrivateKey({ key: pem, format: 'pem' })
      return keyObj.export({ type: 'pkcs8', format: 'pem' })
    } catch (e) {
      console.error('[wechatPay] 私钥格式转换失败:', e.message)
      throw new Error('私钥格式不兼容，请使用 PKCS#8 格式（BEGIN PRIVATE KEY）')
    }
  }

  return pem
}

/**
 * 获取有效的微信支付配置（合并 env 和传入的覆盖值）
 * @param {object} overrides - 来自 DB 的凭证覆盖
 * @returns {{ mchid, serialNo, apiV3Key, appId, keyPem }}
 */
function getEffectiveConfig(overrides) {
  const cfg = {
    mchid:     overrides?.mchid     || config.wechat.mchid,
    serialNo:  overrides?.serialNo  || config.wechat.serialNo,
    apiV3Key:  overrides?.apiKey    || overrides?.apiV3Key || config.wechat.apiV3Key,
    appId:     overrides?.appId     || config.wechat.appId,
    keyPem:    overrides?.keyPem    || null
  }
  if (!cfg.mchid) throw new Error('微信支付商户号未配置')
  if (!cfg.serialNo) throw new Error('微信支付证书序列号未配置')
  if (!cfg.apiV3Key) throw new Error('微信支付 APIv3 密钥未配置')
  if (!cfg.appId) throw new Error('微信支付 AppID 未配置')
  return cfg
}

/**
 * 构建 WECHATPAY2-SHA256-RSA2048 Authorization 头
 */
function buildAuth(method, urlPath, body, wechatCfg) {
  const ts = Math.floor(Date.now() / 1000).toString()
  const nonce = crypto.randomBytes(16).toString('hex')
  const msg = method + '\n' + urlPath + '\n' + ts + '\n' + nonce + '\n' + (body || '') + '\n'
  const privateKey = getPrivateKey(wechatCfg.keyPem || null)
  const sig = crypto.createSign('RSA-SHA256').update(msg).sign(privateKey, 'base64')
  return `WECHATPAY2-SHA256-RSA2048 mchid="${wechatCfg.mchid}",nonce_str="${nonce}",timestamp="${ts}",serial_no="${wechatCfg.serialNo}",signature="${sig}"`
}

/**
 * 发起 APIv3 请求
 * @param {string} method   - HTTP method
 * @param {string} path     - API path (e.g. /v3/pay/transactions/jsapi)
 * @param {object} body     - 请求体
 * @param {object} wechatCfg - 可选，覆盖 config.wechat 的凭证
 */
function v3Request(method, path, body, wechatCfg) {
  const cfg = getEffectiveConfig(wechatCfg || {})
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : ''
    const req = https.request({
      hostname: 'api.mch.weixin.qq.com',
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': buildAuth(method, path, bodyStr, cfg),
        'User-Agent': 'XiaoXianJi/1.0'
      }
    }, (res) => {
      let chunks = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8')
        // 非200响应记录日志便于排查
        if (res.statusCode !== 200 && res.statusCode !== 204) {
          console.error('[wechatPay] APIv3 请求失败:', JSON.stringify({
            method, path, status: res.statusCode,
            response: raw.substring(0, 500)
          }))
        }
        try { resolve({ status: res.statusCode, data: JSON.parse(raw) }) }
        catch (_) { resolve({ status: res.statusCode, data: raw }) }
      })
    })
    req.on('error', reject)
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('请求超时')) })
    if (bodyStr) req.write(bodyStr)
    req.end()
  })
}

/**
 * 生成 wx.requestPayment 参数
 * @param {string} prepayId  - 预支付 ID
 * @param {string} appId     - 小程序 AppID
 * @param {object} wechatCfg - 可选，覆盖 config.wechat 的凭证
 */
function buildPayParams(prepayId, appId, wechatCfg) {
  const cfg = getEffectiveConfig(wechatCfg || {})
  const nonceStr = crypto.randomBytes(16).toString('hex')
  const timeStamp = Math.floor(Date.now() / 1000).toString()
  const pkg = 'prepay_id=' + prepayId
  const msg = (appId || cfg.appId) + '\n' + timeStamp + '\n' + nonceStr + '\n' + pkg + '\n'
  const privateKey = getPrivateKey(cfg.keyPem || null)
  const paySign = crypto.createSign('RSA-SHA256').update(msg).sign(privateKey, 'base64')
  return { timeStamp, nonceStr, package: pkg, signType: 'RSA', paySign }
}

// ========== APIv3 回调验签（RSA-SHA256 + 平台证书） ==========

/**
 * AEAD_AES_256_GCM 解密（用于解密平台证书 & 回调通知）
 */
function aesGcmDecrypt(ciphertext, nonce, associatedData, key) {
  const ciphertextBuf = Buffer.from(ciphertext, 'base64')
  const authTag = ciphertextBuf.slice(ciphertextBuf.length - 16)
  const data = ciphertextBuf.slice(0, ciphertextBuf.length - 16)

  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    Buffer.from(key),
    Buffer.from(nonce, 'utf8')
  )
  decipher.setAuthTag(authTag)
  decipher.setAAD(Buffer.from(associatedData || '', 'utf8'))
  return decipher.update(data, undefined, 'utf8') + decipher.final('utf8')
}

/**
 * 下载微信支付平台证书（用于验证回调签名）
 * GET /v3/certificates
 */
async function fetchPlatformCerts() {
  if (Object.keys(platformCerts).length > 0 && Date.now() - certsLastFetch < CERTS_CACHE_TTL) {
    return platformCerts
  }

  console.log('[wechatPay] 下载微信支付平台证书...')
  const cfg = getEffectiveConfig({})
  const apiV3Key = cfg.apiV3Key
  const result = await v3Request('GET', '/v3/certificates')

  if (result.status !== 200 || !result.data?.data) {
    console.error('[wechatPay] 下载平台证书失败:', JSON.stringify(result.data).substring(0, 500))
    if (Object.keys(platformCerts).length > 0) {
      console.warn('[wechatPay] 使用过期缓存')
      return platformCerts
    }
    return {}
  }

  const newCerts = {}
  for (const cert of result.data.data) {
    try {
      const enc = cert.encrypt_certificate
      const pem = aesGcmDecrypt(enc.ciphertext, enc.nonce, enc.associated_data || '', apiV3Key)
      newCerts[cert.serial_no] = pem
    } catch (e) {
      console.error('[wechatPay] 解密证书失败 serial=' + cert.serial_no, e.message)
    }
  }

  if (Object.keys(newCerts).length > 0) {
    platformCerts = newCerts
    certsLastFetch = Date.now()
    console.log('[wechatPay] 平台证书已更新，共 ' + Object.keys(newCerts).length + ' 个')
  }

  return platformCerts
}

/**
 * 验证微信支付 APIv3 回调签名（RSA-SHA256 + 平台证书）
 *
 * 签名串格式：timestamp\nnonce\nbody\n
 * 从 HTTP 头提取 Wechatpay-Signature 并用对应序列号的平台证书验证
 *
 * @param {object} headers - HTTP 请求头（key 为小写）
 * @param {string} body    - 原始请求体字符串
 * @returns {Promise<boolean>}
 */
async function verifyCallbackSign(headers, body) {
  if (!headers || !body) return false

  const timestamp = headers['wechatpay-timestamp']
  const nonce = headers['wechatpay-nonce']
  const signature = headers['wechatpay-signature']
  const serial = headers['wechatpay-serial']

  if (!timestamp || !nonce || !signature || !serial) {
    console.warn('[wechatPay] 回调缺少签名头:', Object.keys(headers || {}))
    return false
  }

  const certs = await fetchPlatformCerts()
  const certPem = certs[serial]
  if (!certPem) {
    console.error('[wechatPay] 未找到序列号为 ' + serial + ' 的平台证书，可用序列号:',
      Object.keys(certs).join(', '))
    return false
  }

  const msg = timestamp + '\n' + nonce + '\n' + body + '\n'
  try {
    const verify = crypto.createVerify('RSA-SHA256')
    verify.update(msg)
    return verify.verify(certPem, signature, 'base64')
  } catch (e) {
    console.error('[wechatPay] 验签异常:', e.message)
    return false
  }
}

/**
 * 解密微信支付 APIv3 回调通知的 resource 字段
 * @param {string} ciphertext      - Base64 编码的密文
 * @param {string} nonce           - 随机串
 * @param {string} associatedData  - 附加数据
 * @returns {object} 解密后的 JSON 对象
 */
function decryptNotify(ciphertext, nonce, associatedData) {
  const cfg = getEffectiveConfig({})
  const plaintext = aesGcmDecrypt(ciphertext, nonce, associatedData, cfg.apiV3Key)
  return JSON.parse(plaintext)
}

// ========== 兼容旧接口 ==========
// verifySignature 保留用于向后兼容，内部改为记录废弃警告
function verifySignature({ signature, timestamp, nonce, body, apiV3Key }) {
  console.warn('[wechatPay] ⚠️ verifySignature 已废弃！APIv3 回调请使用 verifyCallbackSign(headers, body)')
  // 返回 false 强制调用方升级
  return false
}

module.exports = {
  v3Request,
  buildPayParams,
  verifySignature,       // 已废弃，保留兼容
  verifyCallbackSign,    // 新：RSA-SHA256 + 平台证书验签
  decryptNotify,         // 新：解密回调通知
  fetchPlatformCerts,    // 新：下载平台证书
  getEffectiveConfig
}
