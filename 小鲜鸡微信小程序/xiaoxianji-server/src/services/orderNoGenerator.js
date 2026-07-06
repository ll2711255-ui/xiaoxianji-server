/**
 * 订单号生成器
 *
 * 格式：A + 8位日期(MMDD) + 5位流水号
 * 示例：A070200001
 *
 * 使用数据库行锁保证并发安全
 */
const { PrismaClient } = require('@prisma/client');

async function generateOrderNo(prisma) {
  const now = new Date();
  const datePart = now.toISOString().slice(5, 10).replace(/-/g, ''); // MMDD

  // 使用 upsert 原子操作
  const key = `order_${datePart}`;
  const counter = await prisma.counter.upsert({
    where: { key },
    update: { value: { increment: 1 } },
    create: { key, value: 1 },
  });

  const seq = String(counter.value).padStart(5, '0');
  return `A${datePart}${seq}`;
}

module.exports = { generateOrderNo };
