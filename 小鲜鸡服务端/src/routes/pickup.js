const router = require('express').Router()
const Order = require('../models/Order')
const { success, fail } = require('../utils/response')

// 取货状态查询（C端扫码后查询）
router.get('/status/:orderNo', async (req, res) => {
  try {
    const order = await Order.findOne({ orderNo: req.params.orderNo }).lean()
    if (!order) return res.json(fail('订单不存在'))

    res.json(success({
      orderNo: order.orderNo,
      status: order.status,
      cardNumber: order.cardNumber,
      type: order.type
    }))
  } catch (err) {
    res.status(500).json(fail('查询失败'))
  }
})

module.exports = router
