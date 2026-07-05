/**
 * 订单号生成器
 * 格式：字母(A-Z循环) + 5位数字，如 A00001、A99999、B00000
 * 通过 MySQL counters 表原子递增获取序号，防止并发重复
 */
const db = require('../config/db');

/**
 * 生成唯一商户订单号
 * @returns {Promise<string>} 如 "A00042"
 */
async function generateOrderNo() {
  return db.transaction(async (conn) => {
    // 原子 upsert + 递增
    const [rows] = await conn.execute(
      `INSERT INTO counters (counter_key, letter_idx, seq)
       VALUES ('order', 0, 0)
       ON DUPLICATE KEY UPDATE seq = seq + 1`
    );

    // 读取当前值
    const [counters] = await conn.execute(
      "SELECT letter_idx, seq FROM counters WHERE counter_key = 'order'"
    );

    if (!counters || counters.length === 0) {
      throw new Error('计数器初始化失败');
    }

    let { letter_idx, seq } = counters[0];

    // 序号满 99999 → 字母进位，序号归零
    if (seq > 99999) {
      letter_idx = (letter_idx + 1) % 26;
      seq = 0;
      await conn.execute(
        "UPDATE counters SET letter_idx = ?, seq = ? WHERE counter_key = 'order'",
        [letter_idx, seq]
      );
    }

    const letter = String.fromCharCode(65 + letter_idx);
    return letter + String(seq).padStart(5, '0');
  });
}

module.exports = { generateOrderNo };
