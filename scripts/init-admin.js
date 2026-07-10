/**
 * 初始化内置管理员账号
 * 用法：npm run init:admin 或 node server/scripts/init-admin.js
 *
 * 仅在 merchant_accounts 表不存在 admin 角色时创建。
 * 默认密码 Admin@2024，首次登录后请立即修改。
 *
 * 此函数在 server.js 启动时自动调用（幂等，已存在则跳过）。
 */
const bcrypt = require('bcryptjs')
const db = require('../src/config/db')
const logger = require('../src/utils/logger')

async function initAdmin() {
  const exists = await db.queryOne(
    'SELECT id FROM merchant_accounts WHERE role = ?',
    ['admin']
  )
  if (exists) {
    logger.info('[init-admin] 管理员账号已存在，跳过初始化')
    return
  }
  const hash = await bcrypt.hash('Admin@2024', 12)
  await db.execute(
    `INSERT INTO merchant_accounts
     (username, password_hash, role, display_name, created_by)
     VALUES (?, ?, 'admin', '管理员', NULL)`,
    ['admin', hash]
  )
  logger.info('[init-admin] 管理员账号创建成功，用户名 admin，默认密码 Admin@2024，请立即修改')
}

// 导出函数，供 server.js 启动时调用
module.exports = { initAdmin }

// 直接运行时（node scripts/init-admin.js）执行并退出
if (require.main === module) {
  initAdmin()
    .then(() => process.exit(0))
    .catch(err => { logger.error('[init-admin] 失败:', err.message); process.exit(1) })
}
