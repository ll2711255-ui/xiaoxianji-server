/**
 * 支付方式管理路由 /api/payment-methods/*
 *
 * 商家后台支付设置 — CRUD 微信/支付宝支付配置
 * 所有接口统一鉴权：verifyToken + requireMerchant
 */
const router = require('express').Router()
const db = require('../config/db')
const { verifyToken, requireMerchant } = require('../middleware/auth')
const wxpay = require('../utils/wxpay')
const logger = require('../utils/logger')

// ========== 全局商家鉴权 ==========
router.use(verifyToken, requireMerchant)

// ========== 敏感字段列表 ==========
const SECRET_FIELDS = ['apiKey', 'appSecret', 'certPem', 'keyPem', 'alipayPrivateKey']

// ========== 辅助函数 ==========

/**
 * 抹除敏感字段（列表/普通详情不返回密钥）
 */
function stripSecrets(row) {
  if (!row) return row
  const safe = { ...row, _id: row.id }
  for (const field of SECRET_FIELDS) {
    if (safe[field] !== undefined) {
      safe[field] = safe[field] ? '***' : ''
    }
  }
  return safe
}

/**
 * 附加 _id（前端统一用 _id 引用记录）
 */
function attachId(row) {
  if (!row) return row
  return { ...row, _id: row.id }
}

function attachIds(rows) {
  return rows.map(attachId)
}

// ========== 路由 ==========

/**
 * GET /api/payment-methods — 支付方式列表（不含密钥）
 */
router.get('/', async (req, res) => {
  try {
    const rows = await db.query(
      `SELECT * FROM payment_methods ORDER BY created_at DESC`
    )
    res.json({
      success: true,
      data: { paymentMethods: rows.map(stripSecrets) }
    })
  } catch (err) {
    logger.error('[payment-methods] 列表查询失败:', err)
    res.status(500).json({ success: false, message: '查询支付方式失败' })
  }
})

/**
 * GET /api/payment-methods/:id/full — 完整详情（含密钥，编辑时使用）
 * 注意：此路由必须在 /:id 之前注册，否则 Express 会把 "full" 当成 :id
 */
router.get('/:id/full', async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    if (isNaN(id)) {
      return res.status(400).json({ success: false, message: '无效的 ID' })
    }

    const row = await db.queryOne(
      'SELECT * FROM payment_methods WHERE id = ?',
      [id]
    )

    if (!row) {
      return res.status(404).json({ success: false, message: '支付方式不存在' })
    }

    res.json({
      success: true,
      data: { paymentMethod: attachId(row) }
    })
  } catch (err) {
    logger.error('[payment-methods] 详情查询失败:', err)
    res.status(500).json({ success: false, message: '查询支付方式详情失败' })
  }
})

/**
 * POST /api/payment-methods — 新建支付方式
 */
router.post('/', async (req, res) => {
  try {
    const {
      name, channel, merchantType,
      appId, appSecret, mchid, serialNo, apiKey, certPem, keyPem,
      alipayAppId, alipayPrivateKey, alipayPublicKey,
      enabled
    } = req.body

    // 参数校验
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: '支付名称不能为空' })
    }
    if (!['wechat', 'alipay'].includes(channel)) {
      return res.status(400).json({ success: false, message: '支付方式必须为 wechat 或 alipay' })
    }
    if (name.length > 30) {
      return res.status(400).json({ success: false, message: '支付名称不超过30个字符' })
    }

    // 微信渠道校验商户号格式
    if (channel === 'wechat' && mchid && !/^\d{10}$/.test(mchid)) {
      return res.status(400).json({ success: false, message: '商户号必须是10位数字' })
    }

    const insertId = await db.insert(
      `INSERT INTO payment_methods
       (name, channel, merchant_type, app_id, app_secret, mchid, serial_no,
        api_key, cert_pem, key_pem,
        alipay_app_id, alipay_private_key, alipay_public_key,
        enabled, is_default, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
      [
        name.trim(), channel, merchantType || 'normal',
        appId || null, appSecret || null, mchid || null, serialNo || null,
        apiKey || null, certPem || null, keyPem || null,
        alipayAppId || null, alipayPrivateKey || null, alipayPublicKey || null,
        enabled === false ? 0 : 1,
        req.user ? req.user.id : null
      ]
    )

    logger.info(`[payment-methods] ${req.user.displayName || req.user.id} 创建了支付方式 #${insertId}: ${name.trim()}`)

    // 清除 wxpay 配置缓存，下次支付请求将使用新配置
    wxpay.clearPayConfigCache()

    // 返回新创建的记录
    const created = await db.queryOne(
      'SELECT * FROM payment_methods WHERE id = ?', [insertId]
    )

    res.status(201).json({
      success: true,
      message: '支付方式已创建',
      data: { paymentMethod: stripSecrets(created) }
    })
  } catch (err) {
    logger.error('[payment-methods] 创建失败:', err)
    res.status(500).json({ success: false, message: '创建支付方式失败' })
  }
})

/**
 * PUT /api/payment-methods/:id — 更新支付方式
 */
router.put('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    if (isNaN(id)) {
      return res.status(400).json({ success: false, message: '无效的 ID' })
    }

    // 确认记录存在
    const existing = await db.queryOne(
      'SELECT id FROM payment_methods WHERE id = ?', [id]
    )
    if (!existing) {
      return res.status(404).json({ success: false, message: '支付方式不存在' })
    }

    const {
      name, channel, merchantType,
      appId, appSecret, mchid, serialNo, apiKey, certPem, keyPem,
      alipayAppId, alipayPrivateKey, alipayPublicKey,
      enabled, isDefault
    } = req.body

    // 参数校验
    if (name !== undefined) {
      if (!name.trim()) {
        return res.status(400).json({ success: false, message: '支付名称不能为空' })
      }
      if (name.length > 30) {
        return res.status(400).json({ success: false, message: '支付名称不超过30个字符' })
      }
    }
    if (channel && !['wechat', 'alipay'].includes(channel)) {
      return res.status(400).json({ success: false, message: '支付方式必须为 wechat 或 alipay' })
    }
    if (mchid && !/^\d{10}$/.test(mchid)) {
      return res.status(400).json({ success: false, message: '商户号必须是10位数字' })
    }

    // 构建动态 UPDATE
    const fields = []
    const params = []

    if (name !== undefined)       { fields.push('name = ?');        params.push(name.trim()) }
    if (channel !== undefined)    { fields.push('channel = ?');     params.push(channel) }
    if (merchantType !== undefined) { fields.push('merchant_type = ?'); params.push(merchantType) }
    if (appId !== undefined)      { fields.push('app_id = ?');      params.push(appId || null) }
    if (appSecret !== undefined)  { fields.push('app_secret = ?');  params.push(appSecret || null) }
    if (mchid !== undefined)      { fields.push('mchid = ?');       params.push(mchid || null) }
    if (serialNo !== undefined)   { fields.push('serial_no = ?');   params.push(serialNo || null) }
    if (apiKey !== undefined)     { fields.push('api_key = ?');     params.push(apiKey || null) }
    if (certPem !== undefined)    { fields.push('cert_pem = ?');    params.push(certPem || null) }
    if (keyPem !== undefined)     { fields.push('key_pem = ?');     params.push(keyPem || null) }
    if (alipayAppId !== undefined)     { fields.push('alipay_app_id = ?');      params.push(alipayAppId || null) }
    if (alipayPrivateKey !== undefined) { fields.push('alipay_private_key = ?'); params.push(alipayPrivateKey || null) }
    if (alipayPublicKey !== undefined)  { fields.push('alipay_public_key = ?');  params.push(alipayPublicKey || null) }
    if (enabled !== undefined) {
      fields.push('enabled = ?')
      params.push(enabled ? 1 : 0)
    }
    if (isDefault !== undefined) {
      // 如果设为默认，先取消其他默认
      if (isDefault) {
        await db.execute('UPDATE payment_methods SET is_default = 0 WHERE is_default = 1')
      }
      fields.push('is_default = ?')
      params.push(isDefault ? 1 : 0)
    }

    if (fields.length === 0) {
      return res.status(400).json({ success: false, message: '没有需要更新的字段' })
    }

    params.push(id)
    await db.execute(
      `UPDATE payment_methods SET ${fields.join(', ')} WHERE id = ?`,
      params
    )

    logger.info(`[payment-methods] ${req.user.displayName || req.user.id} 更新了支付方式 #${id}`)

    // 清除 wxpay 配置缓存，下次支付请求将使用新配置
    wxpay.clearPayConfigCache()

    const updated = await db.queryOne(
      'SELECT * FROM payment_methods WHERE id = ?', [id]
    )

    res.json({
      success: true,
      message: '支付方式已更新',
      data: { paymentMethod: stripSecrets(updated) }
    })
  } catch (err) {
    logger.error('[payment-methods] 更新失败:', err)
    res.status(500).json({ success: false, message: '更新支付方式失败' })
  }
})

/**
 * DELETE /api/payment-methods/:id — 删除支付方式
 */
router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    if (isNaN(id)) {
      return res.status(400).json({ success: false, message: '无效的 ID' })
    }

    const existing = await db.queryOne(
      'SELECT id, name FROM payment_methods WHERE id = ?', [id]
    )
    if (!existing) {
      return res.status(404).json({ success: false, message: '支付方式不存在' })
    }

    await db.execute('DELETE FROM payment_methods WHERE id = ?', [id])

    logger.info(`[payment-methods] ${req.user.displayName || req.user.id} 删除了支付方式 #${id} (${existing.name})`)

    // 清除 wxpay 配置缓存，下次支付请求将回退到 .env 或下一个可用配置
    wxpay.clearPayConfigCache()

    res.json({ success: true, message: '已删除' })
  } catch (err) {
    logger.error('[payment-methods] 删除失败:', err)
    res.status(500).json({ success: false, message: '删除支付方式失败' })
  }
})

module.exports = router
