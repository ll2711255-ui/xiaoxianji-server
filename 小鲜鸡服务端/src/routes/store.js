const router = require('express').Router()
const StoreConfig = require('../models/StoreConfig')
const { success, fail } = require('../utils/response')
const { verifyDashboard } = require('../middleware/auth')

// 获取配置（脱敏：不返回敏感字段）
router.get('/', async (req, res) => {
  try {
    let config = await StoreConfig.findOne({ key: 'store_config' }).select('-subMchId').lean()
    if (!config) {
      config = await new StoreConfig({ key: 'store_config' }).save()
      config = config.toObject()
      delete config.subMchId
    }
    res.json(success({ config }))
  } catch (err) {
    res.status(500).json(fail('查询失败'))
  }
})

// 更新配置（需管理后台权限）
router.put('/', verifyDashboard, async (req, res) => {
  try {
    const update = {}
    const fields = ['name', 'address', 'latitude', 'longitude', 'deliveryRadius',
      'openTime', 'closeTime', 'contactName', 'contactPhone', 'subMchId']
    fields.forEach(f => {
      if (req.body[f] !== undefined) update[f] = req.body[f]
    })

    const config = await StoreConfig.findOneAndUpdate(
      { key: 'store_config' },
      { $set: update },
      { new: true, upsert: true }
    ).lean()

    res.json(success({ config }))
  } catch (err) {
    res.status(500).json(fail('更新失败'))
  }
})

module.exports = router
