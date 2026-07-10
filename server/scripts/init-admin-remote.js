/**
 * 远程直连创建商家端管理员账号（merchant_accounts 表）
 * 运行：node server/scripts/init-admin-remote.js
 */
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

(async () => {
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
    const conn = await pool.getConnection();
    console.log('✅ 数据库连接成功');
    conn.release();

    // 迁移表不存在则先创建
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS merchant_accounts (
        id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        username      VARCHAR(50)  NOT NULL UNIQUE,
        password_hash VARCHAR(128) NOT NULL COMMENT 'bcrypt hash',
        role          ENUM('admin','manager','staff') NOT NULL,
        display_name  VARCHAR(50)  NOT NULL,
        created_by    INT UNSIGNED NULL,
        is_active     TINYINT(1)   NOT NULL DEFAULT 1,
        last_login_at DATETIME     NULL,
        created_at    DATETIME     DEFAULT CURRENT_TIMESTAMP,
        updated_at    DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_role (role),
        INDEX idx_created_by (created_by),
        CONSTRAINT fk_created_by
          FOREIGN KEY (created_by) REFERENCES merchant_accounts(id)
          ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    console.log('✅ merchant_accounts 表已就绪');

    // 建操作日志表
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS merchant_operation_log (
        id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        operator_id INT UNSIGNED NOT NULL,
        operator_name VARCHAR(50) NOT NULL,
        action      VARCHAR(50)  NOT NULL,
        target_id   INT UNSIGNED NULL,
        target_name VARCHAR(50)  NULL,
        detail      JSON         NULL,
        ip          VARCHAR(45)  NULL,
        created_at  DATETIME     DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_operator (operator_id),
        INDEX idx_action (action),
        INDEX idx_created (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    console.log('✅ merchant_operation_log 表已就绪');

    // 检查 admin 是否已存在
    const [rows] = await pool.execute(
      "SELECT id, username, role FROM merchant_accounts WHERE role = 'admin'"
    );
    if (rows.length > 0) {
      console.log(`⚠️ 管理员账号已存在: ${rows[0].username} (id=${rows[0].id})，跳过创建`);
      process.exit(0);
    }

    // 创建 admin
    const hash = await bcrypt.hash('Admin@2024', 12);
    await pool.execute(
      `INSERT INTO merchant_accounts (username, password_hash, role, display_name, created_by)
       VALUES (?, ?, 'admin', '管理员', NULL)`,
      ['admin', hash]
    );

    console.log('✅ 管理员账号创建成功！');
    console.log('   用户名: admin');
    console.log('   密码:   Admin@2024');
    console.log('   角色:   admin（内置管理员）');
    console.log('   ⚠️ 请首次登录后立即修改密码！');
  } catch (err) {
    console.error('❌ 失败:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
    process.exit(0);
  }
})();
