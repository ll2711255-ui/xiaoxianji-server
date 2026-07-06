const router = require('express').Router()
const Order = require('../models/Order')
const StoreConfig = require('../models/StoreConfig')
const PaiNumber = require('../models/PaiNumber')
const { generateOrderNo } = require('../utils/orderNo')
const { calculatePrice } = require('../services/pricing')
const { success, fail } = require('../utils/response')
const { v3Request, buildPayParams } = require('../services/wechatPay')
const { getEffectiveWechatConfig } = require('../services/paymentConfig')
const config = require('../config')

// 用户订单列表
router.get('/', async (req, res) => {
  try {
    const { status, page = 1, pageSize = 10 } = req.query
    const filter = { userId: req.user.userId || req.user.openid || '__no_user__' }

    if (status) {
      filter.status = { $in: status.split(',') }
    }

    const skip = (parseInt(page) - 1) * parseInt(pageSize)
    const [orders, total] = await Promise.all([
      Order.find(filter).sort({ createTime: -1 }).skip(skip).limit(parseInt(pageSize)).lean(),
      Order.countDocuments(filter)
    ])

    res.json(success({ orders, total }))
  } catch (err) {
    res.status(500).json(fail('查询失败'))
  }
})

// 订单详情
router.get('/:orderNo', async (req, res) => {
  try {
    const order = await Order.findOne({ orderNo: req.params.orderNo, userId: req.user.userId || req.user.openid }).lean()
    if (!order) return res.json(fail('订单不存在'))
    res.json(success({ order }))
  } catch (err) {
    res.status(500).json(fail('查询失败'))
  }
})

// 创建订单 + 服务端计价 + 微信支付
router.post('/', async (req, res) => {
  try {
    const { items, type, deliveryAddress, isScheduled, scheduledDate, scheduledTime } = req.body
    const userId = req.user.userId || req.user.openid || 'mock_user'

    if (!items || items.length === 0) return res.json(fail('商品不能为空'))
    if (!type || !['delivery', 'pickup'].includes(type)) return res.json(fail('取货方式无效'))
    if (type === 'delivery' && !deliveryAddress) return res.json(fail('配送订单缺少收货地址'))

    // 配送距离校验
    if (type === 'delivery') {
      const storeCfg = await StoreConfig.findOne({ key: 'store_config' }).lean()
      const radius = (storeCfg && storeCfg.deliveryRadius) || 5
      const storeLat = (storeCfg && storeCfg.latitude) || 23.1291
      const storeLng = (storeCfg && storeCfg.longitude) || 113.2644

      if (deliveryAddress.latitude && deliveryAddress.longitude) {
        const R = 6371
        const dLat = (deliveryAddress.latitude - storeLat) * Math.PI / 180
        const dLng = (deliveryAddress.longitude - storeLng) * Math.PI / 180
        const a = Math.sin(dLat / 2) ** 2 + Math.cos(storeLat * Math.PI / 180) * Math.cos(deliveryAddress.latitude * Math.PI / 180) * Math.sin(dLng / 2) ** 2
        const distance = Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 100) / 100
        if (distance > radius) {
          return res.json({ ...fail(`超出配送范围（${radius}公里）`), outOfRange: true, distance, deliveryRadius: radius })
        }
      }
    }

    // 服务端计价
    let totalFen, validatedItems
    try {
      const result = await calculatePrice(items)
      totalFen = result.totalFen
      validatedItems = result.validatedItems
    } catch (err) {
      return res.json(fail(err.message))
    }

    // 生成订单号
    const orderNo = await generateOrderNo()

    const order = new Order({
      orderNo, type: 'online', userId, items: validatedItems,
      prepayAmount: totalFen, status: 'pending',
      deliveryType: type, deliveryAddress: deliveryAddress || {},
      isScheduled: !!isScheduled, scheduledDate: scheduledDate || '', scheduledTime: scheduledTime || ''
    })
    order.addTimeline('pending')
    await order.save()

    // 微信支付（优先 .env，否则从 DB 支付设置读取）
    const wechatCfg = await getEffectiveWechatConfig()
    if (wechatCfg && wechatCfg.mchid && !req.body.mockPay) {
      try {
        const payResult = await v3Request('POST', '/v3/pay/transactions/jsapi', {
          appid: wechatCfg.appId,
          mchid: wechatCfg.mchid,
          description: (validatedItems.map(i => i.productName).join('、') || '小鲜鸡生鲜订单').substring(0, 127),
          out_trade_no: orderNo,
          notify_url: `${config.notifyBaseUrl}/api/pay-callback`,
          amount: { total: totalFen, currency: 'CNY' },
          payer: { openid: req.user.openid || userId }
        }, wechatCfg)
        if (payResult.status === 200 && payResult.data && payResult.data.prepay_id) {
          const payment = buildPayParams(payResult.data.prepay_id, wechatCfg.appId, wechatCfg)
          return res.json(success({ orderNo, payment }))
        } else {
          return res.json({ ...success({ orderNo }), payment: null, payError: '统一下单失败' })
        }
      } catch (payErr) {
        console.error('微信支付失败:', payErr)
        return res.json({ ...success({ orderNo }), payment: null, payError: payErr.message })
      }
    }

    // Mock 模式：直接返回
    res.json(success({ orderNo, payment: null }))
  } catch (err) {
    console.error('创建订单失败:', err)
    res.status(500).json(fail(err.message || '创建失败'))
  }
})

// 发起支付 / 重试支付（仅订单所属用户可操作）
router.post('/:orderNo/pay', async (req, res) => {
  try {
    const { mockPay } = req.body
    const userId = req.user.userId || req.user.openid
    const order = await Order.findOne({ orderNo: req.params.orderNo, userId })
    if (!order) return res.json(fail('订单不存在'))

    if (mockPay) {
      order.status = 'paid'
      order.payTime = new Date()
      order.addTimeline('paid')
      await order.save()
      return res.json(success({ paid: true }))
    }

    // 真实支付：从 DB 支付设置加载凭证 → 调用微信统一下单
    const wechatCfg = await getEffectiveWechatConfig()
    if (wechatCfg && wechatCfg.mchid) {
      try {
        const payResult = await v3Request('POST', '/v3/pay/transactions/jsapi', {
          appid: wechatCfg.appId,
          mchid: wechatCfg.mchid,
          description: ((order.items || []).map(i => i.productName).join('、') || '小鲜鸡生鲜订单').substring(0, 127),
          out_trade_no: order.orderNo,
          notify_url: `${config.notifyBaseUrl}/api/pay-callback`,
          amount: { total: order.prepayAmount, currency: 'CNY' },
          payer: { openid: req.user.openid || userId }
        }, wechatCfg)
        if (payResult.status === 200 && payResult.data && payResult.data.prepay_id) {
          const payment = buildPayParams(payResult.data.prepay_id, wechatCfg.appId, wechatCfg)
          return res.json(success({ payment }))
        } else {
          return res.json(fail('统一下单失败'))
        }
      } catch (payErr) {
        console.error('微信支付失败:', payErr)
        return res.json(fail(payErr.message || '支付下单失败'))
      }
    }

    res.json(fail('支付暂未实现'))
  } catch (err) {
    res.status(500).json(fail('支付失败'))
  }
})

// 取消订单
router.post('/:orderNo/cancel', async (req, res) => {
  try {
    // 仅订单所属用户可取消
    const userId = req.user.userId || req.user.openid
    const order = await Order.findOne({ orderNo: req.params.orderNo, userId })
    if (!order) return res.json(fail('订单不存在'))
    if (!Order.canTransition(order.status, 'cancelled')) {
      return res.json(fail('当前状态不可取消'))
    }

    order.status = 'cancelled'
    order.addTimeline('cancelled')
    await order.save()

    // 释放号码牌
    if (order.cardNumber) {
      await PaiNumber.findOneAndUpdate({ number: order.cardNumber }, { status: 'idle', orderNo: '' })
    }

    res.json(success({ cancelled: true }))
  } catch (err) {
    res.status(500).json(fail('取消失败'))
  }
})

module.exports = router
