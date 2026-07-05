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

// ========== 查询辅助函数 ==========

/**
 * 执行参数化 SQL 查询
 * @param {string} sql - SQL 语句（使用 ? 占位符）
 * @param {Array} params - 参数数组
 * @returns {Promise<Array>} 查询结果行数组
 */
async function query(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

/**
 * 执行单条查询（返回第一行或 null）
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
