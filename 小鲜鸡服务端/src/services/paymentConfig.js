/**
 * 微信支付配置加载器
 * 优先级：环境变量 (.env) > 数据库 (PaymentMethod)
 *
 * 当 .env 中 WECHAT_MCHID 为空时，自动从 MongoDB paymentmethods 集合
 * 读取 PC 后台"支付设置"中保存的已启用微信支付方式
 */
const PaymentMethod = require('../models/PaymentMethod')
const config = require('../config')

let _cachedConfig = null
let _cacheTime = 0
const CACHE_TTL = 60 * 1000 // 1 分钟缓存

/**
 * 获取有效的微信支付配置
 * @returns {Promise<object|null>} { mchid, serialNo, apiKey, appId, appSecret, keyPem, certPem }
 */
async function getEffectiveWechatConfig() {
  // 1. env 已配置 → 直接返回
  if (config.wechat.mchid) {
    return {
      mchid: config.wechat.mchid,
      serialNo: config.wechat.serialNo,
      apiKey: config.wechat.apiV3Key,
      appId: config.wechat.appId,
      appSecret: config.wechat.appSecret,
      keyPem: null, // env 模式从文件读取
      certPem: null
    }
  }

  // 2. env 未配置 → 从 DB 读取（带缓存）
  const now = Date.now()
  if (_cachedConfig && (now - _cacheTime) < CACHE_TTL) {
    return _cachedConfig
  }

  try {
    const method = await PaymentMethod.findOne({
      channel: 'wechat',
      enabled: true
    }).sort({ createdAt: -1 }).lean()

    if (!method || !method.mchid) {
      _cachedConfig = null
      return null
    }

    _cachedConfig = {
      mchid: method.mchid,
      serialNo: method.serialNo || '',
      apiKey: method.apiKey || '',
      appId: method.appId || '',
      appSecret: method.appSecret || '',
      keyPem: method.keyPem || '',   // DB 模式：直接使用 PEM 内容
      certPem: method.certPem || ''
    }
    _cacheTime = now
    console.log('[支付配置] 已从 DB 加载微信支付凭证 (mchid:', method.mchid.slice(0, 4) + '****)')
    return _cachedConfig
  } catch (err) {
    console.error('[支付配置] DB 查询失败:', err.message)
    return _cachedConfig // 返回过期缓存
  }
}

/**
 * 清除缓存（支付设置保存后调用）
 */
function clearPaymentConfigCache() {
  _cachedConfig = null
  _cacheTime = 0
}

module.exports = { getEffectiveWechatConfig, clearPaymentConfigCache }
