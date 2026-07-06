const express = require('express')
const router = express.Router()
const Banner = require('../models/Banner')
const { success, fail } = require('../utils/response')
const { verifyToken, verifyDashboard } = require('../middleware/auth')

// GET /banners — 广告列表（公开）
router.get('/', async (req, res) => {
  try {
    const banners = await Banner.find().sort({ sort: 1 })
    res.json(success({ banners }))
  } catch (err) {
    console.error('[banners] list error:', err)
    res.status(500).json(fail('获取广告失败'))
  }
})

// PUT /banners — 批量更新（需管理后台权限）
router.put('/', verifyToken, verifyDashboard, async (req, res) => {
  try {
    const { banners } = req.body
    if (!Array.isArray(banners)) return res.json(fail('参数错误'))

    await Banner.deleteMany({})
    if (banners.length > 0) {
      await Banner.insertMany(banners.map(b => ({
        image: b.image || '',
        title: b.title || '',
        subtitle: b.subtitle || '',
        bg: b.bg || '#FFF8F5',
        sort: b.sort || 0,
        status: b.status || 'on'
      })))
    }
    const updated = await Banner.find().sort({ sort: 1 })
    res.json(success({ banners: updated }))
  } catch (err) {
    console.error('[banners] update error:', err)
    res.status(500).json(fail('保存广告失败'))
  }
})

module.exports = router
