/**
 * 服务启动入口
 */
const app = require('./app');
const config = require('./config');
const logger = require('./utils/logger');
const { startAllJobs } = require('./jobs');

const PORT = config.port;

// 启动 HTTP 服务
app.listen(PORT, () => {
  logger.info(`小鲜鸡服务端已启动 → http://localhost:${PORT}`);
  logger.info(`环境: ${config.env}`);

  // 检查支付配置
  const wxpay = require('./utils/wxpay');
  if (!wxpay.checkConfig()) {
    logger.warn('⚠️ 微信支付密钥未完整配置，支付功能暂不可用');
  }

  // 启动定时任务（仅生产环境 + 主进程）
  if (config.env === 'production') {
    startAllJobs();
    logger.info('定时任务已启动');
  }
});

// 优雅退出
process.on('SIGTERM', () => {
  logger.info('收到 SIGTERM，正在关闭...');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('收到 SIGINT，正在关闭...');
  process.exit(0);
});
