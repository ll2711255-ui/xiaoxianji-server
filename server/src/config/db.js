/**
 * MySQL + Redis 连接管理
 */
const mysql = require('mysql2/promise');
const Redis = require('ioredis');
const config = require('./index');
const logger = require('../utils/logger');

// ========== MySQL 连接池 ==========
const pool = mysql.createPool(config.db);

// 测试连接
pool.getConnection()
  .then((conn) => {
    logger.info('MySQL 连接成功');
    conn.release();
  })
  .catch((err) => {
    logger.error('MySQL 连接失败:', err.message);
  });

// ========== Redis 客户端 ==========
const redis = new Redis(config.redis);

redis.on('connect', () => {
  logger.info('Redis 连接成功');
});

redis.on('error', (err) => {
  logger.error('Redis 连接错误:', err.message);
});

// ========== 字段名转换 ==========

/**
 * 分页约定
 *
 * 所有列表接口统一约定：
 *   - 参数名：page（页码，从 1 开始）、pageSize（每页条数，默认 20，最大 200）
 *   - OFFSET = (page - 1) * pageSize
 *   - 返回值不再包 total/count（前端滚动加载无需总数）
 *
 * 已接入接口：
 *   GET /api/orders             page + pageSize
 *   GET /api/merchant/orders    page + pageSize
 *   GET /api/products           page + pageSize（P2-1 修复）
 *   GET /api/merchant/products  page + pageSize
 */

/**
 * 蛇形命名 → 驼峰命名（递归）
 *
 * 特殊映射（前端兼容）：
 *   status_label → status（而非 statusLabel，全端用 .status 取值）
 *   prepay_id    → prepayId（保持驼峰）
 *
 * 注意：不递归处理 JSON 字符串字段（如 items、delivery_address），
 *       它们已在数据库中以 TEXT/JSON 格式存储。
 */
function toCamelCase(row) {
  if (!row || typeof row !== 'object') return row;
  if (Array.isArray(row)) return row.map(toCamelCase);

  // 特殊字段映射（覆盖默认驼峰规则）
  const SPECIAL_MAP = {
    status_label: 'status',
  };

  const out = {};
  for (const [key, val] of Object.entries(row)) {
    if (SPECIAL_MAP.hasOwnProperty(key)) {
      out[SPECIAL_MAP[key]] = val;
    } else {
      const camelKey = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
      out[camelKey] = val;
    }
  }
  // 统一添加 _id 别名（前端统一用 _id 引用记录，如 row._id, cat._id）
  if (out.id !== undefined) {
    out._id = out.id;
  }
  return out;
}

// ========== 查询辅助函数 ==========

/**
 * 执行参数化 SQL 查询
 * 返回结果自动将蛇形列名转为驼峰（status_label → status，pay_amount → payAmount）
 * @param {string} sql - SQL 语句（使用 ? 占位符）
 * @param {Array} params - 参数数组
 * @returns {Promise<Array>} 查询结果行数组（字段名已转为驼峰）
 */
async function query(sql, params = []) {
  const [rows] = await pool.query(sql, params);
  return rows.map(toCamelCase);
}

/**
 * 执行单条查询（返回第一行或 null）
 * 返回结果自动将蛇形列名转为驼峰
 */
async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

/**
 * 执行插入并返回 insertId
 */
async function insert(sql, params = []) {
  const [result] = await pool.execute(sql, params);
  return result.insertId;
}

/**
 * 执行更新/删除，返回受影响行数
 */
async function execute(sql, params = []) {
  const [result] = await pool.execute(sql, params);
  return result.affectedRows;
}

/**
 * 在事务中执行操作
 * @param {Function} callback - 接收 connection 参数
 */
async function transaction(callback) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await callback(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = {
  pool,
  redis,
  query,
  queryOne,
  insert,
  execute,
  transaction,
};
