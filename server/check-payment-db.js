// 查询 payment_methods 表（在服务器上运行）
const db = require('./src/config/db');

(async () => {
  try {
    const rows = await db.query(
      'SELECT id, name, channel, mchid, serial_no, enabled, is_default, created_at FROM payment_methods'
    );
    console.log(JSON.stringify(rows, null, 2));
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
