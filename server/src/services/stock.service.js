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

// ========== 预加载脚本 SHA ==========
let lockSha, releaseSha, confirmSha;

async function loadScripts() {
  lockSha = await redis.script('LOAD', LOCK_SCRIPT);
  releaseSha = await redis.script('LOAD', RELEASE_SCRIPT);
  confirmSha = await redis.script('LOAD', CONFIRM_SCRIPT);
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
 * 批量锁定库存
 * @param {Array<{goodsId: string, batchNo?: string, qty: number}>} items
 * @returns {Promise<{success: boolean, message?: string}>}
 */
async function lockStockBatch(items) {
  // 先全部校验，任一失败则不锁
  for (const item of items) {
    const availableKey = `stock:available:${item.goodsId}`;
    const available = await redis.hget(availableKey, item.batchNo || 'default');
    if ((parseInt(available) || 0) < item.qty) {
      return { success: false, message: `商品 ${item.goodsId} 库存不足` };
    }
  }

  // 全部校验通过，批量锁定
  for (const item of items) {
    const result = await lockStock(item.goodsId, item.batchNo || 'default', item.qty);
    if (!result.success) return result;
  }

  return { success: true };
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

module.exports = {
  lockStock,
  lockStockBatch,
  releaseStock,
  confirmStock,
  setStock,
};
