const router = require('express').Router()
const PaymentMethod = require('../models/PaymentMethod')
const { success, fail } = require('../utils/response')
const { verifyToken, verifyDashboard, verifyAdmin } = require('../middleware/auth')
const { clearPaymentConfigCache } = require('../services/paymentConfig')

// 全部接口需要登录
router.use(verifyToken)

// 列表（脱敏：不返回密钥内容）
router.get('/', async (req, res) => {
  try {
    const methods = await PaymentMethod.find().sort({ createdAt: -1 }).select('-apiKey -certPem -keyPem -appSecret -alipayPrivateKey -alipayPublicKey').lean()
    res.json(success({ paymentMethods: methods }))
  } catch (err) {
    console.error('查询支付方式失败:', err)
    res.status(500).json(fail('查询失败'))
  }
})

// 完整详情（含密钥，仅管理员可调用 — 用于编辑弹窗回填）
router.get('/:id/full', verifyAdmin, async (req, res) => {
  try {
    const method = await PaymentMethod.findById(req.params.id).lean()
    if (!method) return res.json(fail('支付方式不存在'))
    res.json(success({ paymentMethod: method }))
  } catch (err) {
    res.status(500).json(fail('查询失败'))
  }
})

// 详情（脱敏：不返回密钥内容）
router.get('/:id', async (req, res) => {
  try {
    const method = await PaymentMethod.findById(req.params.id).select('-apiKey -certPem -keyPem -appSecret -alipayPrivateKey -alipayPublicKey').lean()
    if (!method) return res.json(fail('支付方式不存在'))
    res.json(success({ paymentMethod: method }))
  } catch (err) {
    res.status(500).json(fail('查询失败'))
  }
})

// 新增（仅管理员）
router.post('/', verifyAdmin, async (req, res) => {
  try {
    const { name, channel, merchantType, appId, appSecret, mchid, serialNo, apiKey, certPem, keyPem,
            alipayAppId, alipayPrivateKey, alipayPublicKey, enabled } = req.body

    if (!name || !name.trim()) {
      return res.json(fail('支付名称不能为空'))
    }
    if (!channel) {
      return res.json(fail('请选择支付方式'))
    }

    const method = new PaymentMethod({
      name: name.trim(),
      channel,
      merchantType: merchantType || 'normal',
      appId: appId || '',
      appSecret: appSecret || '',
      mchid: mchid || '',
      serialNo: serialNo || '',
      apiKey: apiKey || '',
      certPem: certPem || '',
      keyPem: keyPem || '',
      alipayAppId: alipayAppId || '',
      alipayPrivateKey: alipayPrivateKey || '',
      alipayPublicKey: alipayPublicKey || '',
      enabled: enabled !== undefined ? enabled : true
    })

    await method.save()
    clearPaymentConfigCache()
    res.json(success({ paymentMethod: method }))
  } catch (err) {
    console.error('新增支付方式失败:', err)
    res.status(500).json(fail(err.message || '新增失败'))
  }
})

// 编辑（仅管理员）
router.put('/:id', verifyAdmin, async (req, res) => {
  try {
    const body = req.body
    const update = {}

    const fields = ['name', 'channel', 'merchantType', 'appId', 'mchid', 'serialNo', 'enabled']
    fields.forEach(f => {
      if (body[f] !== undefined) update[f] = body[f]
    })

    // 密钥字段：只在非空时更新（防止编辑时回填空字符串导致数据丢失）
    const secretFields = ['appSecret', 'apiKey', 'certPem', 'keyPem', 'alipayAppId', 'alipayPrivateKey', 'alipayPublicKey']
    secretFields.forEach(f => {
      if (body[f] !== undefined && body[f] !== '') update[f] = body[f]
    })

    const method = await PaymentMethod.findByIdAndUpdate(req.params.id, update, { new: true }).lean()
    if (!method) return res.json(fail('支付方式不存在'))
    clearPaymentConfigCache()
    res.json(success({ paymentMethod: method }))
  } catch (err) {
    console.error('编辑支付方式失败:', err)
    res.status(500).json(fail(err.message || '编辑失败'))
  }
})

// 删除（仅管理员）
router.delete('/:id', verifyAdmin, async (req, res) => {
  try {
    const method = await PaymentMethod.findByIdAndDelete(req.params.id)
    if (!method) return res.json(fail('支付方式不存在'))
    res.json(success({ deleted: true }))
  } catch (err) {
    res.status(500).json(fail('删除失败'))
  }
})

module.exports = router
