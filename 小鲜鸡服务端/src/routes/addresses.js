const router = require('express').Router()
const Address = require('../models/Address')
const { success, fail } = require('../utils/response')

// 列表
router.get('/', async (req, res) => {
  try {
    const addresses = await Address.find({ userId: req.user.userId || req.user.openid }).sort({ isDefault: -1, createdAt: -1 }).lean()
    res.json(success({ addresses }))
  } catch (err) {
    res.status(500).json(fail('查询失败'))
  }
})

// 新增
router.post('/', async (req, res) => {
  try {
    const { name, phone, province, city, district, detail, latitude, longitude } = req.body
    if (!name || !phone || !detail) return res.json(fail('请填写完整地址信息'))

    const address = new Address({
      userId: req.user.userId || req.user.openid,
      name, phone,
      province: province || '', city: city || '', district: district || '',
      detail, latitude: latitude || 0, longitude: longitude || 0,
      isDefault: false
    })
    await address.save()
    res.json(success({ address }))
  } catch (err) {
    res.status(500).json(fail('新增失败'))
  }
})

// 编辑（仅地址所有者可编辑）
router.put('/:id', async (req, res) => {
  try {
    const userId = req.user.userId || req.user.openid
    const update = {}
    const fields = ['name', 'phone', 'province', 'city', 'district', 'detail', 'latitude', 'longitude', 'isDefault']
    fields.forEach(f => { if (req.body[f] !== undefined) update[f] = req.body[f] })

    if (req.body.isDefault) {
      await Address.updateMany({ userId }, { isDefault: false })
    }

    const address = await Address.findOneAndUpdate(
      { _id: req.params.id, userId },
      update,
      { new: true }
    ).lean()
    if (!address) return res.json(fail('地址不存在'))
    res.json(success({ address }))
  } catch (err) {
    res.status(500).json(fail('编辑失败'))
  }
})

// 删除（仅地址所有者可删除）
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.user.userId || req.user.openid
    const address = await Address.findOneAndDelete({ _id: req.params.id, userId })
    if (!address) return res.json(fail('地址不存在'))
    res.json(success({ deleted: true }))
  } catch (err) {
    res.status(500).json(fail('删除失败'))
  }
})

module.exports = router
