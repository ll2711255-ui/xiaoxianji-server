/**
 * 本地创建管理员（直连远程 MySQL，绕过 SSH）
 * 运行：node scripts/create-admin-local.js
 */
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

(async () => {
  // 直连远程 DB
  const pool = mysql.createPool({
    host: '159.75.0.194',
    port: 3306,
    user: 'xiaoxianji',
    password: 'XiaoXianJi@2026',
    database: 'xiaoxianji',
    charset: 'utf8mb4',
  });

  try {
    // 检查连接
    await pool.getConnection();
    console.log('数据库连接成功');

    // 检查是否已存在
    const [rows] = await pool.execute(
      'SELECT id FROM users WHERE phone = ? OR openid = ?',
      ['13800138000', 'admin_internal']
    );
    if (rows.length > 0) {
      console.log('管理员账号已存在，跳过创建');
      process.exit(0);
    }

    // 创建
    const hash = await bcrypt.hash('Admin@123', 10);
    await pool.execute(
      'INSERT INTO users (openid, phone, nick_name, role, password) VALUES (?, ?, ?, ?, ?)',
      ['admin_internal', '13800138000', '管理员', 'admin', hash]
    );

    console.log('✅ 管理员账号创建成功');
    console.log('   手机号: 13800138000');
    console.log('   密码:   Admin@123');
  } catch (err) {
    console.error('❌ 失败:', err.message);
  } finally {
    await pool.end();
    process.exit(0);
  }
})();
