const router = require('express').Router()
const bcrypt = require('bcryptjs')
const Merchant = require('../models/Merchant')
const { verifyDashboard, verifyAdmin } = require('../middleware/auth')
const { success, fail } = require('../utils/response')

/**
 * GET /api/accounts
 * 列出账号：admin 看全量，manager 只看自己创建的员工
 */
router.get('/', verifyDashboard, async (req, res) => {
  try {
    const { role: myRole, merchantId } = req.user
    let filter = {}

    if (myRole === 'admin') {
      // admin 看所有账号（不包括自己？不，包括自己，方便管理）
      filter = {}
    } else if (myRole === 'manager') {
      // manager 只能看自己创建的账号 + 自己
      filter = {
        $or: [
          { parentId: merchantId },
          { _id: merchantId }
        ]
      }
    }

    const accounts = await Merchant.find(filter, { password: 0 }).sort({ createdAt: -1 })
    res.json(success({ accounts }))
  } catch (err) {
    console.error('[Accounts] 查询失败:', err)
    res.status(500).json(fail('查询账号列表失败'))
  }
})

/**
 * POST /api/accounts
 * 创建账号
 */
router.post('/', verifyDashboard, async (req, res) => {
  try {
    const { role: myRole, merchantId } = req.user
    const { username, password, name, phone, role } = req.body

    // 参数校验
    if (!username || !password) {
      return res.json(fail('用户名和密码不能为空'))
    }
    if (!['manager', 'employee'].includes(role)) {
      return res.json(fail('只能创建店长或员工账号'))
    }

    // 权限校验
    if (myRole === 'manager' && role === 'manager') {
      return res.status(403).json(fail('店长只能创建员工账号'))
    }

    // 检查用户名是否已存在
    const existing = await Merchant.findOne({ username })
    if (existing) {
      return res.json(fail('该用户名已存在'))
    }

    const hashedPassword = await bcrypt.hash(password, 10)
    const account = new Merchant({
      username,
      password: hashedPassword,
      role,
      name: name || username,
      phone: phone || '',
      parentId: merchantId
    })
    await account.save()

    const result = account.toObject()
    delete result.password

    res.json(success({ account: result }))
  } catch (err) {
    console.error('[Accounts] 创建失败:', err)
    res.status(500).json(fail('创建账号失败'))
  }
})

/**
 * PUT /api/accounts/:id
 * 编辑账号信息
 */
router.put('/:id', verifyDashboard, async (req, res) => {
  try {
    const { role: myRole, merchantId } = req.user
    const targetId = req.params.id

    // 不能编辑自己
    if (targetId === merchantId) {
      return res.json(fail('不能编辑自己的账号'))
    }

    // 获取目标账号
    const target = await Merchant.findById(targetId)
    if (!target) {
      return res.json(fail('账号不存在'))
    }

    // 权限检查：admin 能编辑所有人，manager 只能编辑自己创建的人
    if (myRole === 'manager') {
      if (String(target.parentId) !== merchantId) {
        return res.status(403).json(fail('无权编辑该账号'))
      }
    }

    const { name, phone, role } = req.body
    if (name !== undefined) target.name = name
    if (phone !== undefined) target.phone = phone
    // 角色变更：不允许 manager 把 employee 升为 manager
    if (role !== undefined) {
      if (myRole === 'manager' && role === 'manager') {
        return res.status(403).json(fail('店长不能将员工提升为店长'))
      }
      if (!['admin', 'manager', 'employee'].includes(role)) {
        return res.json(fail('无效的角色类型'))
      }
      target.role = role
    }

    await target.save()
    const result = target.toObject()
    delete result.password

    res.json(success({ account: result }))
  } catch (err) {
    console.error('[Accounts] 编辑失败:', err)
    res.status(500).json(fail('编辑账号失败'))
  }
})

/**
 * DELETE /api/accounts/:id
 * 删除账号
 */
router.delete('/:id', verifyDashboard, async (req, res) => {
  try {
    const { role: myRole, merchantId } = req.user
    const targetId = req.params.id

    // 不能删除自己
    if (targetId === merchantId) {
      return res.json(fail('不能删除自己的账号'))
    }

    const target = await Merchant.findById(targetId)
    if (!target) {
      return res.json(fail('账号不存在'))
    }

    // 权限检查
    if (myRole === 'manager') {
      if (String(target.parentId) !== merchantId) {
        return res.status(403).json(fail('无权删除该账号'))
      }
    }

    await Merchant.findByIdAndDelete(targetId)
    res.json(success({ message: '账号已删除' }))
  } catch (err) {
    console.error('[Accounts] 删除失败:', err)
    res.status(500).json(fail('删除账号失败'))
  }
})

/**
 * PUT /api/accounts/:id/reset-password
 * 重置密码
 */
router.put('/:id/reset-password', verifyDashboard, async (req, res) => {
  try {
    const { role: myRole, merchantId } = req.user
    const targetId = req.params.id
    const { newPassword } = req.body

    if (!newPassword || newPassword.length < 6) {
      return res.json(fail('新密码长度不能少于6位'))
    }

    const target = await Merchant.findById(targetId)
    if (!target) {
      return res.json(fail('账号不存在'))
    }

    // 权限检查
    if (myRole === 'manager') {
      if (String(target.parentId) !== merchantId && targetId !== merchantId) {
        return res.status(403).json(fail('无权重置该账号密码'))
      }
    }

    target.password = await bcrypt.hash(newPassword, 10)
    await target.save()

    res.json(success({ message: '密码已重置' }))
  } catch (err) {
    console.error('[Accounts] 重置密码失败:', err)
    res.status(500).json(fail('重置密码失败'))
  }
})

module.exports = router
