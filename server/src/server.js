/**
 * 服务启动入口 — 含启动前连接预检（MySQL + Redis）
 * 预检失败则重试，彻底失败则退出让 PM2 重启，避免"服务已启动但所有请求 500"
 */
const http = require('http');
const config = require('./config');
const logger = require('./utils/logger');

const PORT = config.port;

// ========== 启动前连接预检 ==========

/**
 * 尝试连接 MySQL（返回 true/false，不抛异常）
 */
async function checkMySQL() {
  try {
    const { pool } = require('./config/db');
    const conn = await pool.getConnection();
    conn.release();
    return true;
  } catch (err) {
    logger.error('MySQL 连接失败:', err.message);
    return false;
  }
}

/**
 * 尝试连接 Redis（返回 true/false，不抛异常）
 */
async function checkRedis() {
  try {
    const { redis } = require('./config/db');
    await redis.ping();
    return true;
  } catch (err) {
    logger.error('Redis 连接失败:', err.message);
    return false;
  }
}

/**
 * 带重试的预检：依次检查 MySQL 和 Redis
 * @param {number} maxRetries - 最大重试次数
 * @param {number} delayMs - 每次重试间隔（毫秒）
 * @returns {Promise<boolean>} 是否全部通过
 */
async function preflightCheck(maxRetries = 5, delayMs = 3000) {
  for (let i = 0; i < maxRetries; i++) {
    const attempt = i + 1;
    logger.info(`[启动预检] 第 ${attempt}/${maxRetries} 次连接检查...`);

    const [mysqlOk, redisOk] = await Promise.all([
      checkMySQL(),
      checkRedis(),
    ]);

    if (mysqlOk && redisOk) {
      logger.info('[启动预检] ✅ MySQL + Redis 连接正常');
      return true;
    }

    const failed = [];
    if (!mysqlOk) failed.push('MySQL');
    if (!redisOk) failed.push('Redis');
    logger.warn(`[启动预检] ❌ ${failed.join('、')} 连接失败`);

    if (i < maxRetries - 1) {
      logger.info(`[启动预检] ${delayMs / 1000}s 后重试...`);
      await new Promise(r => setTimeout(r, delayMs));
    }
  }

  logger.error('[启动预检] 已达最大重试次数，放弃启动');
  return false;
}

// ========== 启动流程 ==========

(async function main() {
  logger.info('══════════════════════════════════');
  logger.info('  小鲜鸡服务端启动中...');
  logger.info(`  环境: ${config.env}`);
  logger.info(`  端口: ${PORT}`);
  logger.info(`  DB: ${config.db.host}:${config.db.port}/${config.db.database}`);
  logger.info(`  Redis: ${config.redis.host}:${config.redis.port}`);
  logger.info('══════════════════════════════════');

  // 1. 预检基础设施
  const ok = await preflightCheck(5, 3000);
  if (!ok) {
    logger.error('基础设施连接失败，进程退出（PM2 将自动重启）');
    process.exit(1);
  }

  // 2. 预检通过后才加载 app（此时 DB/Redis 已确认可用）
  const app = require('./app');
  const { startAllJobs } = require('./jobs');

  // 2.5 初始化内置管理员账号（幂等，已存在则跳过）
  try {
    const { initAdmin } = require('../scripts/init-admin');
    await initAdmin();
  } catch (err) {
    logger.error('[启动] 管理员账号初始化异常:', err.message);
  }

  // 2.6 预热 Redis 库存（从 MySQL 回填，防止 Redis 重启后库存归零）
  try {
    const { warmupStock } = require('./services/stock.service');
    const warmResult = await warmupStock();
    logger.info(`[启动] 库存预热结果: 写入${warmResult.warmed}个, 跳过${warmResult.skipped}个`);
  } catch (err) {
    logger.error('[启动] 库存预热异常:', err.message);
  }

  // 3. 创建 HTTP Server + 绑定 Socket.IO
  const { initSocket } = require('./socket');
  const httpServer = http.createServer(app);
  initSocket(httpServer);

  // 4. 启动 HTTP 服务
  httpServer.listen(PORT, async () => {
    logger.info(`✅ 小鲜鸡服务端已启动 → http://localhost:${PORT}`);

    // 检查支付配置
    const wxpay = require('./utils/wxpay');
    if (!await wxpay.checkConfig()) {
      logger.warn('⚠️ 微信支付密钥未完整配置，支付功能暂不可用');
    } else {
      logger.info('✅ 微信支付配置完整');
    }

    // 启动定时任务（仅生产环境）
    if (config.env === 'production') {
      startAllJobs();
      logger.info('✅ 定时任务已启动（超时关单 + 兜底查询）');
    }
  });
})();

// ========== 优雅退出 ==========

process.on('SIGTERM', () => {
  logger.info('收到 SIGTERM，正在关闭...');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('收到 SIGINT，正在关闭...');
  process.exit(0);
});
