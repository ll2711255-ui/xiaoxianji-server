/**
 * 商家账号管理路由 /api/merchant/accounts/*
 *
 * 薄路由层 — 只做参数解析 + 调 service + 统一 catch
 * 权限校验在 service 层细粒度执行
 *
 * 鉴权层级：
 *   verifyToken      — 解析 JWT
 *   requireMerchant  — 校验来源为 merchant_accounts 表
 *   requireRole      — 校验角色权限
 */
const router = require('express').Router()
const db = require('../config/db')
const { verifyToken, requireMerchant, requireRole } = require('../middleware/auth')
const svc = require('../services/merchant-account.service')
const logger = require('../utils/logger')

// ========== 全局鉴权 ==========
router.use(verifyToken, requireMerchant)

// ========== 统一错误处理 ==========
function handleError(err, res) {
  if (err.status) {
    return res.status(err.status).json({ success: false, message: err.message })
  }
  logger.error('[merchant-account] 未预期错误:', err)
  res.status(500).json({ success: false, message: '服务器内部错误' })
}

// ========== 路由 ==========

/**
 * GET /api/merchant/accounts — 账号列表
 * admin/manager 可访问，staff 在 service 层被拒
 */
router.get('/', requireRole('admin', 'manager'), async (req, res) => {
  try {
    const data = await svc.listAccounts(req.user)
    res.json({ success: true, data })
  } catch (err) { handleError(err, res) }
})

/**
 * POST /api/merchant/accounts — 创建账号
 */
router.post('/', requireRole('admin', 'manager'), async (req, res) => {
  try {
    const data = await svc.createAccount(req.user, req.body)
    res.status(201).json({ success: true, data })
  } catch (err) { handleError(err, res) }
})

/**
 * PATCH /api/merchant/accounts/me/password — 修改自己密码
 * 所有商家角色可访问
 */
router.patch('/me/password', async (req, res) => {
  try {
    await svc.changeOwnPassword(req.user, req.body)
    res.json({ success: true, message: '密码修改成功' })
  } catch (err) { handleError(err, res) }
})

/**
 * PATCH /api/merchant/accounts/:id — 更新账号
 */
router.patch('/:id', requireRole('admin', 'manager'), async (req, res) => {
  try {
    await svc.updateAccount(req.user, parseInt(req.params.id), req.body)
    res.json({ success: true, message: '更新成功' })
  } catch (err) { handleError(err, res) }
})

/**
 * DELETE /api/merchant/accounts/:id — 删除账号
 */
router.delete('/:id', requireRole('admin', 'manager'), async (req, res) => {
  try {
    await svc.deleteAccount(req.user, parseInt(req.params.id))
    res.json({ success: true, message: '删除成功' })
  } catch (err) { handleError(err, res) }
})

/**
 * GET /api/merchant/accounts/logs — 操作日志（仅 admin）
 */
router.get('/logs', requireRole('admin'), async (req, res) => {
  try {
    const { page = 1, pageSize = 20 } = req.query
    const offset = (parseInt(page) - 1) * parseInt(pageSize)

    const [rows, totalRow] = await Promise.all([
      db.query(
        `SELECT * FROM merchant_operation_log
         ORDER BY created_at DESC LIMIT ? OFFSET ?`,
        [parseInt(pageSize), Math.max(0, offset)]
      ),
      db.queryOne('SELECT COUNT(*) AS total FROM merchant_operation_log')
    ])

    res.json({ success: true, data: { list: rows, total: totalRow ? totalRow.total : 0 } })
  } catch (err) { handleError(err, res) }
})

module.exports = router
