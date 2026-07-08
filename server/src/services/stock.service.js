/**
 * Redis 库存锁库服务
 *
 * 使用 Lua 脚本实现原子操作，防止并发超卖：
 *   stock:available:{goodsId}  — Hash: batchNo → 可售数量
 *   stock:locked:{goodsId}     — Hash: batchNo → 已锁定数量
 *
 * 对标文档：7.1 库存锁定与释放原子化实现
 */
const { redis } = require('../config/db');
const logger = require('../utils/logger');

// ========== Lua 脚本 ==========

/**
 * 锁定库存（原子操作）
 * KEYS[1] = stock:available:{goodsId}
 * KEYS[2] = stock:locked:{goodsId}
 * ARGV[1] = batchNo
 * ARGV[2] = lockQty
 *
 * 返回: {ok, remaining} 或 {err, message}
 */
const LOCK_SCRIPT = `
local available = redis.call('HGET', KEYS[1], ARGV[1])
available = tonumber(available) or 0
local qty = tonumber(ARGV[2])

if available < qty then
  return cjson.encode({err = true, message = '库存不足', available = available, needed = qty})
end

redis.call('HINCRBY', KEYS[1], ARGV[1], -qty)
redis.call('HINCRBY', KEYS[2], ARGV[1], qty)

local remaining = available - qty
return cjson.encode({ok = true, remaining = remaining})
`;

/**
 * 释放库存（取消订单/超时）
 * KEYS[1] = stock:available:{goodsId}
 * KEYS[2] = stock:locked:{goodsId}
 * ARGV[1] = batchNo
 * ARGV[2] = qty
 */
const RELEASE_SCRIPT = `
local locked = redis.call('HGET', KEYS[2], ARGV[1])
locked = tonumber(locked) or 0
local qty = math.min(tonumber(ARGV[2]), locked)

if qty > 0 then
  redis.call('HINCRBY', KEYS[1], ARGV[1], qty)
  redis.call('HINCRBY', KEYS[2], ARGV[1], -qty)
end

return cjson.encode({ok = true, released = qty})
`;

/**
 * 确认扣减库存（支付成功，永久扣减锁定库存）
 * KEYS[1] = stock:locked:{goodsId}
 * ARGV[1] = batchNo
 * ARGV[2] = qty
 */
const CONFIRM_SCRIPT = `
local locked = redis.call('HGET', KEYS[1], ARGV[1])
locked = tonumber(locked) or 0
local qty = math.min(tonumber(ARGV[2]), locked)

if qty > 0 then
  redis.call('HINCRBY', KEYS[1], ARGV[1], -qty)
end

return cjson.encode({ok = true, confirmed = qty})
`;

/**
 * 批量锁定库存（原子操作：校验+扣减合并在一个 Lua 脚本中）
 *
 * KEYS 排列（N 个商品，每个 2 个 key）：
 *   KEYS[1]  = stock:available:{goodsId_1}
 *   KEYS[2]  = stock:locked:{goodsId_1}
 *   KEYS[3]  = stock:available:{goodsId_2}
 *   KEYS[4]  = stock:locked:{goodsId_2}
 *   ...
 *
 * ARGV[1] = N（商品数量）
 * ARGV[2] = batchNo_1
 * ARGV[3] = qty_1
 * ARGV[4] = batchNo_2
 * ARGV[5] = qty_2
 * ...
 *
 * 逻辑：先遍历检查所有商品库存是否足够，
 *       全部满足再统一扣减，任一不足则全部不扣。
 */
const BATCH_LOCK_SCRIPT = `
local n = tonumber(ARGV[1])
local argIdx = 2

-- 第一遍：校验所有商品库存
for i = 1, n do
  local availableKey = KEYS[2 * i - 1]
  local batchNo = ARGV[argIdx]
  local qty = tonumber(ARGV[argIdx + 1])
  argIdx = argIdx + 2

  local available = redis.call('HGET', availableKey, batchNo)
  available = tonumber(available) or 0

  if available < qty then
    return cjson.encode({err = true, message = '库存不足', itemIndex = i, available = available, needed = qty})
  end
end

-- 第二遍：全部校验通过，统一扣减
argIdx = 2
for i = 1, n do
  local availableKey = KEYS[2 * i - 1]
  local lockedKey = KEYS[2 * i]
  local batchNo = ARGV[argIdx]
  local qty = tonumber(ARGV[argIdx + 1])
  argIdx = argIdx + 2

  redis.call('HINCRBY', availableKey, batchNo, -qty)
  redis.call('HINCRBY', lockedKey, batchNo, qty)
end

return cjson.encode({ok = true})
`;

// ========== 预加载脚本 SHA ==========
let lockSha, releaseSha, confirmSha, batchLockSha;

async function loadScripts() {
  lockSha = await redis.script('LOAD', LOCK_SCRIPT);
  releaseSha = await redis.script('LOAD', RELEASE_SCRIPT);
  confirmSha = await redis.script('LOAD', CONFIRM_SCRIPT);
  batchLockSha = await redis.script('LOAD', BATCH_LOCK_SCRIPT);
  logger.info('[stock] Lua 脚本加载完成');
}

// 首次加载
loadScripts().catch(err => logger.error('[stock] Lua 脚本加载失败:', err.message));

// ========== 公开接口 ==========

/**
 * 锁定商品库存
 * @param {string} goodsId - 商品ID
 * @param {string} batchNo - 批次号（默认 'default'）
 * @param {number} qty - 锁定数量
 * @returns {Promise<{success: boolean, message?: string, remaining?: number}>}
 */
async function lockStock(goodsId, batchNo = 'default', qty) {
  try {
    const availableKey = `stock:available:${goodsId}`;
    const lockedKey = `stock:locked:${goodsId}`;

    let result;
    try {
      result = await redis.evalsha(lockSha, 2, availableKey, lockedKey, batchNo, qty);
    } catch (e) {
      // 脚本未加载，重新加载后重试
      if (e.message && e.message.includes('NOSCRIPT')) {
        await loadScripts();
        result = await redis.evalsha(lockSha, 2, availableKey, lockedKey, batchNo, qty);
      } else {
        throw e;
      }
    }

    const parsed = JSON.parse(result);
    if (parsed.err) {
      logger.warn(`[stock] 锁定失败: goods=${goodsId} batch=${batchNo} ${parsed.message}`);
      return { success: false, message: parsed.message, available: parsed.available };
    }
    return { success: true, remaining: parsed.remaining };
  } catch (err) {
    logger.error(`[stock] 锁定异常: goods=${goodsId}`, err.message);
    return { success: false, message: '库存服务异常' };
  }
}

/**
 * 批量锁定库存（原子操作：校验+扣减合并在一个 Lua 脚本中）
 *
 * 与旧版 check-then-act 的区别：
 *   - 旧版：先逐个 hget 校验 → 再逐个 lockStock → 中间有竞态窗口
 *   - 新版：所有校验+扣减在一个 Lua 脚本中原子完成，全部成功或全部失败
 *   - 失败时不回滚（Lua 脚本保证了原子性——任一不足则全部不扣）
 *
 * @param {Array<{goodsId: string, batchNo?: string, qty: number}>} items
 * @returns {Promise<{success: boolean, message?: string}>}
 */
async function lockStockBatch(items) {
  if (!items || items.length === 0) {
    return { success: false, message: '商品列表为空' };
  }

  try {
    // 构建 KEYS：每个商品 2 个 key（available + locked）
    const keys = [];
    for (const item of items) {
      keys.push(`stock:available:${item.goodsId}`);
      keys.push(`stock:locked:${item.goodsId}`);
    }

    // 构建 ARGV：[N, batchNo1, qty1, batchNo2, qty2, ...]
    const argv = [items.length];
    for (const item of items) {
      argv.push(item.batchNo || 'default');
      argv.push(item.qty);
    }

    let result;
    try {
      result = await redis.evalsha(batchLockSha, keys.length, ...keys, ...argv);
    } catch (e) {
      if (e.message && e.message.includes('NOSCRIPT')) {
        await loadScripts();
        result = await redis.evalsha(batchLockSha, keys.length, ...keys, ...argv);
      } else {
        throw e;
      }
    }

    const parsed = JSON.parse(result);
    if (parsed.err) {
      logger.warn(`[stock] 批量锁定失败: 第${parsed.itemIndex}个商品 ${parsed.message} (可用:${parsed.available} 需要:${parsed.needed})`);
      return { success: false, message: parsed.message };
    }

    return { success: true };
  } catch (err) {
    logger.error('[stock] 批量锁定异常:', err.message);
    return { success: false, message: '库存服务异常' };
  }
}

/**
 * 释放库存
 * @param {string} goodsId
 * @param {string} batchNo
 * @param {number} qty
 */
async function releaseStock(goodsId, batchNo = 'default', qty) {
  try {
    const availableKey = `stock:available:${goodsId}`;
    const lockedKey = `stock:locked:${goodsId}`;

    let result;
    try {
      result = await redis.evalsha(releaseSha, 2, availableKey, lockedKey, batchNo, qty);
    } catch (e) {
      if (e.message && e.message.includes('NOSCRIPT')) {
        await loadScripts();
        result = await redis.evalsha(releaseSha, 2, availableKey, lockedKey, batchNo, qty);
      } else {
        throw e;
      }
    }

    const parsed = JSON.parse(result);
    logger.info(`[stock] 释放库存: goods=${goodsId} qty=${parsed.released}`);
    return { success: true, released: parsed.released };
  } catch (err) {
    logger.error(`[stock] 释放异常: goods=${goodsId}`, err.message);
    return { success: false, message: '库存服务异常' };
  }
}

/**
 * 确认扣减库存（支付成功后调用）
 */
async function confirmStock(goodsId, batchNo = 'default', qty) {
  try {
    const lockedKey = `stock:locked:${goodsId}`;

    let result;
    try {
      result = await redis.evalsha(confirmSha, 1, lockedKey, batchNo, qty);
    } catch (e) {
      if (e.message && e.message.includes('NOSCRIPT')) {
        await loadScripts();
        result = await redis.evalsha(confirmSha, 1, lockedKey, batchNo, qty);
      } else {
        throw e;
      }
    }

    const parsed = JSON.parse(result);
    return { success: true, confirmed: parsed.confirmed };
  } catch (err) {
    logger.error(`[stock] 确认扣减异常: goods=${goodsId}`, err.message);
    return { success: false, message: '库存服务异常' };
  }
}

/**
 * 设置商品库存（管理后台用）
 */
async function setStock(goodsId, batchNo = 'default', qty) {
  await redis.hset(`stock:available:${goodsId}`, batchNo, qty);
}

/**
 * Redis 重启后从 MySQL 预热库存
 *
 * 场景：Redis 重启/FLUSHALL 后所有库存归零，用户无法下单。
 * 此函数从 products 表读取在售商品，批量回填 Redis 可用库存。
 *
 * 策略：
 *   1. 只在 Redis key 不存在时才写入（不覆盖运行中数据）
 *   2. 默认初始库存从 config.business.defaultStock 读取，未配置则 999
 *   3. 用 Redis pipeline 减少 RTT
 *
 * @returns {Promise<{warmed: number, skipped: number}>}
 */
async function warmupStock() {
  const { pool } = require('../config/db');
  const config = require('../config');
  const DEFAULT_INIT_STOCK = (config.business && config.business.defaultStock) || 999;

  let warmed = 0;
  let skipped = 0;

  try {
    // 从 MySQL 读取所有在售商品
    const [products] = await pool.execute(
      'SELECT id, name, out_of_stock FROM products WHERE status = ?',
      ['on']
    );

    if (!products || products.length === 0) {
      logger.info('[stock] 预热完成: 无在售商品');
      return { warmed: 0, skipped: 0 };
    }

    // 用 pipeline 批量检查+写入
    const pipeline = redis.pipeline();
    const stockChecks = [];

    for (const p of products) {
      const key = `stock:available:${p.id}`;
      stockChecks.push({ id: p.id, name: p.name, key, outOfStock: p.out_of_stock });
      pipeline.exists(key);
    }

    const results = await pipeline.exec();
    if (!results) {
      logger.warn('[stock] 预热 pipeline 返回空');
      return { warmed: 0, skipped: 0 };
    }

    // results[i][0] = error, results[i][1] = value
    const writePipeline = redis.pipeline();
    for (let i = 0; i < stockChecks.length; i++) {
      const item = stockChecks[i];
      const exists = results[i] && results[i][1] === 1;

      if (!exists) {
        // 已下架的商品跳过
        if (item.outOfStock) {
          skipped++;
          continue;
        }

        // Redis key 不存在 → 初始化为默认库存
        writePipeline.hset(item.key, 'default', DEFAULT_INIT_STOCK);
        warmed++;
        logger.info(`[stock] 预热: goods=${item.id} ${item.name} → ${DEFAULT_INIT_STOCK}`);
      } else {
        skipped++;
      }
    }

    if (warmed > 0) {
      await writePipeline.exec();
    }

    logger.info(`[stock] 预热完成: 写入 ${warmed} 个, 跳过 ${skipped} 个 (共 ${products.length} 个在售商品)`);

    if (warmed > 0) {
      logger.warn(`[stock] ⚠️ 已预热 ${warmed} 个商品的默认库存(${DEFAULT_INIT_STOCK})，请尽快通过管理后台设置真实库存！`);
    }

    return { warmed, skipped };
  } catch (err) {
    logger.error('[stock] 预热库存失败:', err.message);
    return { warmed, skipped };
  }
}

module.exports = {
  lockStock,
  lockStockBatch,
  releaseStock,
  confirmStock,
  setStock,
  warmupStock,
};
