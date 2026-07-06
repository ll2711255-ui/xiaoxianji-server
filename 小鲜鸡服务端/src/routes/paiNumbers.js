const express = require('express')
const router = express.Router()
const PaiNumber = require('../models/PaiNumber')
const { success, fail } = require('../utils/response')
const { verifyToken } = require('../middleware/auth')

// GET /pai-numbers — 号码牌列表（需登录）
router.get('/', verifyToken, async (req, res) => {
  try {
    const numbers = await PaiNumber.find().sort({ number: 1 })
    res.json(success({ numbers }))
  } catch (err) {
    console.error('[pai-numbers] list error:', err)
    res.status(500).json(fail('获取号码牌失败'))
  }
})

// GET /pai-numbers/:number/code — 获取小程序码（需登录）
router.get('/:number/code', verifyToken, async (req, res) => {
  try {
    // 开发阶段：返回占位信息
    res.json(success({ codeImageFileID: `cloud://mock/pai_${req.params.number}.png` }))
  } catch (err) {
    res.status(500).json(fail('获取二维码失败'))
  }
})

// POST /pai-numbers/:number/release — 释放号码牌（需登录）
router.post('/:number/release', verifyToken, async (req, res) => {
  try {
    const pai = await PaiNumber.findOne({ number: req.params.number })
    if (!pai) return res.json(fail('号码牌不存在'))
    pai.status = 'idle'
    pai.orderNo = ''
    await pai.save()
    res.json(success({ released: true }))
  } catch (err) {
    console.error('[pai-numbers] release error:', err)
    res.status(500).json(fail('释放失败'))
  }
})

module.exports = router
