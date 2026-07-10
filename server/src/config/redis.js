/**
 * Redis 客户端（从 db.js 连接池中获取）
 */
const { redis } = require('./db')
module.exports = redis
