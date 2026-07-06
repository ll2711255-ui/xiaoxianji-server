const router = require('express').Router()
const Order = require('../models/Order')
const { verifyCallbackSign, decryptNotify } = require('../services/wechatPay')

/**
 * 微信支付 APIv3 回调
 * POST /api/pay-callback
 *
 * 流程:
 * 1. 提取 Wechatpay-* 请求头
 * 2. RSA-SHA256 验签（平台证书公钥）
 * 3. AEAD_AES_256_GCM 解密 resource.ciphertext
 * 4. 处理订单状态更新
 *
 * 注意：app.js 必须在路由前挂载 express.raw({ type: '*/*' }) 以保留原始 body
 */
router.post('/', async (req, res) => {
  try {
    // ──────────── 1. 提取签名头 ────────────
    const headers = req.headers

    // ──────────── 2. 获取原始请求体 ────────────
    let rawBody
    if (Buffer.isBuffer(req.body)) {
      rawBody = req.body.toString('utf8')
    } else if (typeof req.body === 'string') {
      rawBody = req.body
    } else {
      rawBody = JSON.stringify(req.body)
    }

    console.log('[payCallback] 收到回调, headers keys:', Object.keys(headers).filter(k => k.startsWith('wechatpay')).join(', '))

    // ──────────── 3. APIv3 验签（RSA-SHA256 + 平台证书）────────────
    const isApiV3 = headers['wechatpay-signature'] && headers['wechatpay-timestamp']

    if (isApiV3) {
      const signOk = await verifyCallbackSign(headers, rawBody)
      if (!signOk) {
        console.error('[payCallback] ❌ 签名验证失败 — 可能为非法请求')
        return res.status(200).json({ code: 'FAIL', message: '签名验证失败' })
      }
      console.log('[payCallback] 验签通过 ✓')
    } else {
      // 无 Wechatpay-* 头 → 内部调用（如测试），跳过验签
      console.log('[payCallback] 无微信签名头，跳过验签（内部调用）')
    }

    // ──────────── 4. 解析回调数据（APIv3 格式）────────────
    let callbackData
    const parsed = JSON.parse(rawBody)

    if (parsed.resource && parsed.resource.ciphertext) {
      // APIv3 格式：解密 resource
      try {
        const decrypted = decryptNotify(
          parsed.resource.ciphertext,
          parsed.resource.nonce,
          parsed.resource.associated_data || ''
        )
        callbackData = decrypted
        console.log('[payCallback] resource 解密成功')
      } catch (decryptErr) {
        console.error('[payCallback] resource 解密失败:', decryptErr.message)
        return res.status(200).json({ code: 'FAIL', message: '解密失败' })
      }
    } else {
      // 兼容明文回调（测试/内部调用）
      callbackData = parsed
    }

    const { out_trade_no, trade_state, transaction_id } = callbackData

    console.log('[payCallback] 订单:', out_trade_no, '状态:', trade_state, '交易号:', transaction_id || '-')

    // ──────────── 5. 处理支付成功 ────────────
    if (trade_state === 'SUCCESS') {
      const order = await Order.findOne({ orderNo: out_trade_no })
      if (!order) {
        console.warn('[payCallback] 订单不存在:', out_trade_no)
        return res.status(200).json({ code: 'FAIL', message: '订单不存在' })
      }
      if (order.status === 'pending') {
        order.status = 'paid'
        order.payTime = new Date()
        order.transactionId = transaction_id || ''
        order.addTimeline('paid')
        await order.save()
        console.log('[payCallback] ✅ 支付成功:', out_trade_no, 'transactionId:', transaction_id || '-')
      } else {
        console.log('[payCallback] 订单已是', order.status, '状态，跳过:', out_trade_no)
      }
    } else {
      console.log('[payCallback] 非支付成功状态(' + trade_state + ')，忽略:', out_trade_no)
    }

    // ──────────── 6. 微信要求返回 200 ────────────
    res.status(200).json({ code: 'SUCCESS', message: 'OK' })
  } catch (err) {
    console.error('[payCallback] 处理失败:', err)
    // 即使失败也返回200，防止微信重复回调
    res.status(200).json({ code: 'FAIL', message: err.message })
  }
})

module.exports = router
