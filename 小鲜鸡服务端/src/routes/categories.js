const router = require('express').Router()
const Category = require('../models/Category')
const { success, fail } = require('../utils/response')
const { verifyToken, verifyDashboard } = require('../middleware/auth')

// 列表（公开）
router.get('/', async (req, res) => {
  try {
    const categories = await Category.find().sort({ sort: 1 }).lean()
    res.json(success({ categories }))
  } catch (err) {
    res.status(500).json(fail('查询失败'))
  }
})

// 新增（需管理后台权限）
router.post('/', verifyToken, verifyDashboard, async (req, res) => {
  try {
    const { name } = req.body
    if (!name || !name.trim()) {
      return res.json(fail('分类名称不能为空'))
    }
    const max = await Category.findOne().sort({ sort: -1 }).lean()
    const category = new Category({ name: name.trim(), sort: (max ? max.sort : 0) + 1 })
    await category.save()
    res.json(success(category))
  } catch (err) {
    res.status(500).json(fail('新增失败'))
  }
})

// 删除（需管理后台权限）
router.delete('/:id', verifyToken, verifyDashboard, async (req, res) => {
  try {
    const category = await Category.findByIdAndDelete(req.params.id)
    if (!category) return res.json(fail('分类不存在'))
    res.json(success({ deleted: true }))
  } catch (err) {
    res.status(500).json(fail('删除失败'))
  }
})

// 排序（需管理后台权限）
router.put('/sort', verifyToken, verifyDashboard, async (req, res) => {
  try {
    const { sorts } = req.body
    if (!sorts || !Array.isArray(sorts)) {
      return res.json(fail('参数错误'))
    }
    const ops = sorts.map(s => ({
      updateOne: { filter: { _id: s._id }, update: { $set: { sort: s.sort } } }
    }))
    await Category.bulkWrite(ops)
    res.json(success({ sorted: true }))
  } catch (err) {
    res.status(500).json(fail('排序失败'))
  }
})

module.exports = router
