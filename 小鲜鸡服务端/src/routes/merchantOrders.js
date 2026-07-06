const router = require('express').Router()
const Order = require('../models/Order')
const PaiNumber = require('../models/PaiNumber')
const { success, fail } = require('../utils/response')
const { generateOrderNo } = require('../utils/orderNo')

// 商家订单列表
router.get('/orders', async (req, res) => {
  try {
    const { status, type, startDate, endDate, page = 1, pageSize = 50 } = req.query
    // 仅返回当前商家订单（关键安全过滤）
    const filter = { merchantId: req.user.merchantId || '' }

    if (status) {
      filter.status = { $in: status.split(',') }
    }
    if (type) filter.type = type
    if (startDate) filter.createTime = { $gte: new Date(startDate) }
    if (endDate) {
      filter.createTime = { ...filter.createTime, $lt: new Date(endDate) }
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

// 创建线下订单
router.post('/offline-orders', async (req, res) => {
  try {
    const { amount, cardNumber, paymentType } = req.body

    if (!amount || amount <= 0) return res.json(fail('金额无效'))
    if (!cardNumber) return res.json(fail('请选择号码牌'))

    // 校验号码牌
    const pai = await PaiNumber.findOne({ number: cardNumber })
    if (!pai) return res.json(fail('号码牌不存在'))
    if (pai.status !== 'idle') return res.json(fail('该号码牌已被使用'))

    // 生成订单号（原子操作，防止并发重复）
    const orderNo = await generateOrderNo('OFF')

    const order = new Order({
      orderNo,
      type: 'offline',
      merchantId: req.user.merchantId || '',
      items: [],
      status: 'pending',
      prepayAmount: amount,
      actualAmount: amount,
      cardNumber,
      paymentType: paymentType || 'cash',
      deliveryType: 'pickup'
    })
    order.addTimeline('pending')
    await order.save()

    // 更新号码牌
    pai.status = 'in_use'
    pai.orderNo = orderNo
    await pai.save()

    res.json(success({ orderNo, cardNumber }))
  } catch (err) {
    console.error('创建线下订单失败:', err)
    res.status(500).json(fail('创建失败'))
  }
})

// 状态流转: /merchant/orders/:orderNo/:action
router.post('/orders/:orderNo/:action', async (req, res) => {
  try {
    const { orderNo, action } = req.params
    const order = await Order.findOne({ orderNo, merchantId: req.user.merchantId || '' })
    if (!order) return res.json(fail('订单不存在'))

    // 线下订单简化状态（仍需校验当前状态防止非法跳转）
    if (order.type === 'offline') {
      const OFFLINE_TRANSITIONS = {
        pending: ['processing'],
        processing: ['ready'],
        ready: ['completed'],
        completed: [],
        cancelled: []
      }
      const actionToStatus = { process: 'processing', ready: 'ready', complete: 'completed' }
      const targetStatus = actionToStatus[action]
      if (!targetStatus) return res.json(fail('未知操作: ' + action))

      const allowed = OFFLINE_TRANSITIONS[order.status] || []
      if (!allowed.includes(targetStatus)) {
        return res.json(fail(`不能从 ${order.status} 变更为 ${targetStatus}`))
      }

      order.status = targetStatus
      order.addTimeline(targetStatus)
      if (targetStatus === 'completed') {
        order.completeTime = new Date()
        if (order.cardNumber) {
          await PaiNumber.findOneAndUpdate({ number: order.cardNumber }, { status: 'used' })
        }
      }
      await order.save()
      return res.json(success({ order: order.toObject() }))
    }

    // 线上订单完整状态流
    if (action === 'mark-paid') {
      order.status = 'paid'
      order.payTime = new Date()
      order.addTimeline('paid')
      await order.save()
      return res.json(success({ order: order.toObject() }))
    }

    const TRANSITIONS = {
      accept: 'accepted',
      process: 'processing',
      ready: 'ready',
      deliver: 'delivering',
      complete: 'completed'
    }

    const targetStatus = TRANSITIONS[action]
    if (!targetStatus) return res.json(fail('未知操作: ' + action))

    if (!Order.canTransition(order.status, targetStatus)) {
      return res.json(fail(`不能从 ${order.status} 变更为 ${targetStatus}`))
    }

    order.status = targetStatus
    order.addTimeline(targetStatus)

    if (targetStatus === 'completed') {
      order.completeTime = new Date()
      if (!order.actualAmount) order.actualAmount = order.prepayAmount
      if (order.cardNumber) {
        await PaiNumber.findOneAndUpdate({ number: order.cardNumber }, { status: 'used' })
      }
    }

    await order.save()
    res.json(success({ order: order.toObject() }))
  } catch (err) {
    console.error('订单操作失败:', err)
    res.status(500).json(fail('操作失败'))
  }
})

// 称重
router.post('/orders/:orderNo/weigh', async (req, res) => {
  try {
    const { orderNo } = req.params
    const { actualWeight, weighPhoto, cardNumber, pricePerJin, processingFee } = req.body

    const order = await Order.findOne({ orderNo, merchantId: req.user.merchantId || '' })
    if (!order) return res.json(fail('订单不存在'))
    if (order.status !== 'accepted') return res.json(fail('订单状态不可称重'))

    if (!actualWeight || actualWeight <= 0) return res.json(fail('请输入实际重量'))

    const ppj = pricePerJin || 1700
    const pf = processingFee || 0
    const actualAmount = Math.floor((actualWeight / 500) * ppj) + pf
    const refundAmount = Math.max(0, order.prepayAmount - actualAmount)

    order.actualAmount = actualAmount
    order.refundAmount = refundAmount
    order.weighPhoto = weighPhoto || ''
    order.status = 'weighed'
    order.addTimeline('weighed')

    // 绑定号码牌
    if (cardNumber) {
      const existingPai = await PaiNumber.findOne({ number: order.cardNumber })
      if (existingPai) {
        existingPai.status = 'used'
        await existingPai.save()
      }
      const newPai = await PaiNumber.findOne({ number: cardNumber })
      if (newPai) {
        newPai.status = 'in_use'
        newPai.orderNo = orderNo
        await newPai.save()
      }
      order.cardNumber = cardNumber
    }

    await order.save()
    res.json(success({
      order: order.toObject(),
      cardNumber: order.cardNumber,
      refundAmount,
      actualAmount
    }))
  } catch (err) {
    console.error('称重失败:', err)
    res.status(500).json(fail('称重失败'))
  }
})

// 退款（需商家权限）
router.post('/orders/:orderNo/refund', async (req, res) => {
  try {
    const { orderNo } = req.params
    const order = await Order.findOne({ orderNo, merchantId: req.user.merchantId || '' })
    if (!order) return res.json(fail('订单不存在'))

    const refundAmount = Math.max(0, (order.prepayAmount || 0) - (order.actualAmount || 0))
    order.refundAmount = refundAmount

    // TODO: 调微信支付退款接口
    await order.save()
    res.json(success({ order: order.toObject(), refundAmount }))
  } catch (err) {
    res.status(500).json(fail('退款失败'))
  }
})

module.exports = router
