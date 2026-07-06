const router = require('express').Router()
const Order = require('../models/Order')
const { success, fail } = require('../utils/response')

// 仪表盘统计（含线上 + 线下订单）
router.get('/', async (req, res) => {
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const [pendingCount, activeCount, todayOrders, todayRevenueResult] = await Promise.all([
      Order.countDocuments({ status: 'paid' }),
      Order.countDocuments({ status: { $in: ['accepted', 'weighed', 'processing'] } }),
      Order.countDocuments({ createTime: { $gte: today, $lt: tomorrow } }),
      Order.aggregate([
        { $match: { createTime: { $gte: today, $lt: tomorrow } } },
        { $group: { _id: null, total: { $sum: { $ifNull: ['$actualAmount', '$prepayAmount'] } } } }
      ])
    ])

    const todayRevenue = todayRevenueResult.length > 0 ? (todayRevenueResult[0].total / 100).toFixed(2) : '0.00'

    res.json(success({
      pendingCount,
      activeCount,
      todayOrders,
      todayRevenue
    }))
  } catch (err) {
    res.status(500).json(fail('查询失败'))
  }
})

module.exports = router
