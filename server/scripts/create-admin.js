/**
 * 管理员账号诊断+修复脚本
 * 运行方式：node scripts/create-admin.js
 */
const bcrypt = require('bcryptjs');
const db = require('../src/config/db');

(async () => {
  try {
    const PASSWORD = 'Admin@123';
    const PHONE = '13800138000';

    // 1. 查当前状态
    const user = await db.queryOne(
      'SELECT id, phone, role, password FROM users WHERE phone = ?',
      [PHONE]
    );

    if (!user) {
      console.log('用户不存在，创建中...');
      const hash = await bcrypt.hash(PASSWORD, 10);
      console.log('  生成哈希(前20位): ' + hash.substring(0, 20) + '...');
      const id = await db.insert(
        'INSERT INTO users (openid, phone, nick_name, role, password) VALUES (?, ?, ?, ?, ?)',
        ['admin_internal', PHONE, '管理员', 'admin', hash]
      );
      console.log('  创建成功, id=' + id);
    } else {
      console.log('用户已存在:');
      console.log('  id: ' + user.id);
      console.log('  phone: ' + user.phone);
      console.log('  role: ' + user.role);
      console.log('  password 前20位: ' + (user.password || '(空)').substring(0, 20) + '...');
      console.log('  password 长度: ' + (user.password || '').length);

      // 2. 验证现有密码
      const match = await bcrypt.compare(PASSWORD, user.password || '');
      console.log('  bcrypt.compare 结果: ' + match);

      if (!match) {
        // 3. 重置密码
        console.log('密码不匹配，重置中...');
        const hash = await bcrypt.hash(PASSWORD, 10);
        console.log('  新哈希(前20位): ' + hash.substring(0, 20) + '...');
        await db.execute(
          'UPDATE users SET password = ?, role = ? WHERE phone = ?',
          [hash, 'admin', PHONE]
        );

        // 4. 二次验证
        const hash2 = await bcrypt.hash(PASSWORD, 10);
        const match2 = await bcrypt.compare(PASSWORD, hash2);
        console.log('  自验证(新哈希): ' + match2);
        console.log('  新哈希 前20位: ' + hash2.substring(0, 20) + '...');
      }
    }

    console.log('✅ 完成');
  } catch (err) {
    console.error('❌ 失败:', err.message);
    process.exit(1);
  }
  process.exit(0);
})();
