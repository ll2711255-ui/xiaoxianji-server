const Counter = require('../models/Counter')

/**
 * 生成唯一订单号（原子递增 — 无需副本集/事务）
 * 格式：字母 A-Z 循环 + 5位数字，如 A00001 → A99999 → B00000
 * 通过 MongoDB findOneAndUpdate($inc) 保证并发安全
 */
async function generateOrderNo(prefix = 'ORD') {
  // 原子递增 seq（若文档不存在则 upsert 创建）
  const result = await Counter.findOneAndUpdate(
    { _id: 'order' },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  )

  let { letterIdx = 0, seq = 1 } = result

  // 当 seq 超过 99999 时进位
  if (seq > 99999) {
    const newLI = (letterIdx + 1) % 26
    await Counter.updateOne({ _id: 'order' }, { $set: { letterIdx: newLI, seq: 1 } })
    letterIdx = newLI
    seq = 1
  }

  const letter = String.fromCharCode(65 + letterIdx)
  return prefix + letter + String(seq).padStart(5, '0')
}

module.exports = { generateOrderNo }
