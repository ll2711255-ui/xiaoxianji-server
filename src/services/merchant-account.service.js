/**
 * 商家账号服务 — 独立于顾客 users 表
 *
 * 权限矩阵（核心）：
 *   CAN_CREATE  — 谁能创建什么角色
 *   CAN_MANAGE  — 谁能管理什么角色
 *
 * 所有写操作均通过 getTargetOrThrow() 校验权限后执行。
 * 所有写操作均写入 merchant_operation_log 操作日志。
 */
const bcrypt = require('bcryptjs')
const db = require('../config/db')
const logger = require('../utils/logger')

// ========== 权限矩阵 ==========

const CAN_CREATE = {
  admin:   ['manager', 'staff'],
  manager: ['staff'],
  staff:   []
}

const CAN_MANAGE = {
  admin:   ['manager', 'staff'],
  manager: ['staff'],
  staff:   []
}

// ========== 角色中文名 ==========

function getRoleName(role) {
  return { admin: '管理员', manager: '店长', staff: '员工' }[role] || role
}

// ========== 操作日志 ==========

async function writeLog(operator, action, targetId, targetName, detail) {
  try {
    await db.execute(
      `INSERT INTO merchant_operation_log
       (operator_id, operator_name, action, target_id, target_name, detail)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        operator.id,
        operator.displayName || operator.username || '',
        action,
        targetId || null,
        targetName || null,
        JSON.stringify(detail || {})
      ]
    )
  } catch (err) {
    // 日志写入失败不应阻断主流程
    logger.error('[merchant-account] 写操作日志失败:', err.message)
  }
}

// ========== 目标账号获取 + 权限校验（私有） ==========

async function getTargetOrThrow(operator, targetId) {
  const target = await db.queryOne(
    `SELECT id, role, created_by, display_name,
            username, last_login_at
     FROM merchant_accounts WHERE id = ?`,
    [targetId]
  )
  if (!target) {
    throw { status: 404, message: '账号不存在' }
  }
  if (target.role === 'admin') {
    throw { status: 403, message: '不能操作管理员账号' }
  }
  if (!CAN_MANAGE[operator.role] || !CAN_MANAGE[operator.role].includes(target.role)) {
    throw { status: 403, message: `${getRoleName(operator.role)}不能管理${getRoleName(target.role)}账号` }
  }
  if (operator.role === 'manager' && target.createdBy !== operator.id) {
    throw { status: 403, message: '只能管理自己创建的员工' }
  }
  return target
}

// ========== 公开方法 ==========

/**
 * 查询账号列表
 * @param {object} operator — { id, role }
 */
async function listAccounts(operator) {
  if (operator.role === 'staff') {
    throw { status: 403, message: '无权限查看账号列表' }
  }

  if (operator.role === 'admin') {
    return db.query(
      `SELECT a.id, a.username, a.role, a.display_name,
              a.is_active, a.last_login_at, a.created_at,
              c.display_name AS creator_name
       FROM merchant_accounts a
       LEFT JOIN merchant_accounts c ON c.id = a.created_by
       WHERE a.role != 'admin'
       ORDER BY FIELD(a.role, 'manager', 'staff'), a.created_at DESC`
    )
  }

  // manager：只看自己创建的 staff
  return db.query(
    `SELECT id, username, role, display_name,
            is_active, last_login_at, created_at
     FROM merchant_accounts
     WHERE created_by = ? AND role = 'staff'
     ORDER BY created_at DESC`,
    [operator.id]
  )
}

/**
 * 创建账号
 * @param {object} operator
 * @param {object} params — { username, password, role, displayName }
 */
async function createAccount(operator, { username, password, role, displayName }) {
  // 1. 创建权限校验
  if (!CAN_CREATE[operator.role] || !CAN_CREATE[operator.role].includes(role)) {
    throw { status: 403, message: `${getRoleName(operator.role)}不能创建${getRoleName(role)}账号` }
  }

  // 2. 参数校验
  if (!username || !password || !role || !displayName) {
    throw { status: 400, message: '参数不完整' }
  }
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
    throw { status: 400, message: '用户名只能包含字母、数字、下划线，长度3-20位' }
  }
  if (password.length < 6) {
    throw { status: 400, message: '密码至少6位' }
  }

  // 3. 用户名唯一性
  const exists = await db.queryOne(
    'SELECT id FROM merchant_accounts WHERE username = ?',
    [username]
  )
  if (exists) {
    throw { status: 409, message: '用户名已存在' }
  }

  // 4. 创建
  const hash = await bcrypt.hash(password, 12)
  const result = await db.execute(
    `INSERT INTO merchant_accounts
     (username, password_hash, role, display_name, created_by)
     VALUES (?, ?, ?, ?, ?)`,
    [username, hash, role, displayName, operator.id]
  )

  // 5. 操作日志
  await writeLog(operator, 'create_account', result.insertId, displayName, { username, role })

  logger.info(`[merchant-account] ${operator.id} 创建了账号: ${username} (${role})`)
  return { id: result.insertId, username, role, displayName }
}

/**
 * 更新账号信息
 * @param {object} operator
 * @param {number} targetId
 * @param {object} params — { password?, displayName?, isActive? }
 */
async function updateAccount(operator, targetId, { password, displayName, isActive }) {
  // 1. 查目标 + 权限校验
  const target = await getTargetOrThrow(operator, targetId)

  // 2. 构建更新
  const updates = []
  const params = []

  if (password !== undefined) {
    if (password.length < 6) {
      throw { status: 400, message: '密码至少6位' }
    }
    updates.push('password_hash = ?')
    params.push(await bcrypt.hash(password, 12))
  }
  if (displayName !== undefined) {
    if (!displayName.trim()) {
      throw { status: 400, message: '显示名不能为空' }
    }
    updates.push('display_name = ?')
    params.push(displayName.trim())
  }
  if (typeof isActive === 'boolean') {
    updates.push('is_active = ?')
    params.push(isActive ? 1 : 0)
  }

  if (updates.length === 0) {
    throw { status: 400, message: '没有可更新的字段' }
  }

  params.push(targetId)
  await db.execute(
    `UPDATE merchant_accounts SET ${updates.join(', ')} WHERE id = ?`,
    params
  )

  // 3. 操作日志
  const action = password !== undefined ? 'reset_password'
    : isActive !== undefined ? 'toggle_active'
    : 'update_account'

  await writeLog(operator, action, targetId, target.displayName, {
    isActive, hasNewPassword: password !== undefined
  })

  logger.info(`[merchant-account] ${operator.id} ${action} → 账号 ${targetId}`)
}

/**
 * 删除账号
 * @param {object} operator
 * @param {number} targetId
 */
async function deleteAccount(operator, targetId) {
  const target = await getTargetOrThrow(operator, targetId)

  // 1小时内登录过的账号不允许直接删除
  const recentLogin = target.lastLoginAt &&
    (Date.now() - new Date(target.lastLoginAt).getTime()) < 3600000
  if (recentLogin) {
    throw {
      status: 409,
      message: '该账号1小时内有登录记录，请先禁用再删除'
    }
  }

  await db.execute('DELETE FROM merchant_accounts WHERE id = ?', [targetId])

  await writeLog(operator, 'delete_account', targetId, target.displayName, {
    username: target.username, role: target.role
  })

  logger.info(`[merchant-account] ${operator.id} 删除了账号 ${targetId} (${target.username})`)
}

/**
 * 修改自己的密码
 * @param {object} operator — { id, displayName, username }
 * @param {object} params — { oldPassword, newPassword }
 */
async function changeOwnPassword(operator, { oldPassword, newPassword }) {
  if (!oldPassword || !newPassword) {
    throw { status: 400, message: '请提供原密码和新密码' }
  }
  if (newPassword.length < 6) {
    throw { status: 400, message: '新密码至少6位' }
  }

  const account = await db.queryOne(
    'SELECT password_hash FROM merchant_accounts WHERE id = ?',
    [operator.id]
  )
  if (!account) {
    throw { status: 404, message: '账号不存在' }
  }

  const match = await bcrypt.compare(oldPassword, account.passwordHash)
  if (!match) {
    throw { status: 401, message: '原密码错误' }
  }

  const hash = await bcrypt.hash(newPassword, 12)
  await db.execute(
    'UPDATE merchant_accounts SET password_hash = ? WHERE id = ?',
    [hash, operator.id]
  )

  await writeLog(operator, 'change_own_password', operator.id, operator.displayName, {})

  logger.info(`[merchant-account] ${operator.id} 修改了自己的密码`)
}

module.exports = {
  listAccounts,
  createAccount,
  updateAccount,
  deleteAccount,
  changeOwnPassword
}
