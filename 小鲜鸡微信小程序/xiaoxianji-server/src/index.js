const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const prisma = require('./db');
const { config, validateConfig } = require('./config');
const { responseMiddleware } = require('./utils/response');
const { apiLimiter } = require('./middleware/rateLimiter');
const logger = require('./utils/logger');

// ========== 启动前校验 ==========
validateConfig();

const app = express();

// ========== 安全中间件 ==========
app.use(helmet());

// CORS
app.use(cors({
  origin: config.env === 'production'
    ? (process.env.ALLOWED_ORIGINS || 'https://www.xuaioxianji.top').split(',').map(s => s.trim())
    : '*',
  credentials: true,
}));

// ========== 请求解析 ==========
// JSON body（微信支付回调需要原始body做验签，通过 verify 回调保存 rawBody）
app.use(express.json({
  limit: '1mb',
  verify: (req, _res, buf) => { req.rawBody = buf.toString('utf8'); }
}));
app.use(express.urlencoded({ extended: false }));

// ========== 日志 ==========
if (config.env !== 'test') {
  app.use(morgan('short', {
    stream: { write: (msg) => logger.info(msg.trim()) },
    // 跳过健康检查日志
    skip: (req) => req.url === '/api/health',
  }));
}

// ========== 统一响应 ==========
app.use(responseMiddleware);

// ========== 频率限制 ==========
app.use('/api/', apiLimiter);

// ========== 健康检查 ==========
app.get('/api/health', (req, res) => {
  res.ok({
    version: '1.0.0',
    uptime: process.uptime(),
    env: config.env,
    timestamp: new Date().toISOString(),
  });
});

// ========== API 路由 ==========
app.use('/api/auth', require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/banners', require('./routes/banners'));
app.use('/api/addresses', require('./routes/addresses'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/merchant/orders', require('./routes/merchantOrders'));
app.use('/api/pai-numbers', require('./routes/paiNumbers'));
app.use('/api/pickup', require('./routes/pickup'));
app.use('/api/wechat', require('./routes/wechat'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/store', require('./routes/store'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/upload', require('./routes/upload'));

// ========== 定时任务（内部调用） ==========
app.use('/api/cron', require('./routes/cron'));

// ========== 404 ==========
app.use('/api/*', (req, res) => {
  res.failNotFound(`接口不存在: ${req.method} ${req.originalUrl}`);
});

// ========== 全局错误处理 ==========
app.use((err, req, res, _next) => {
  logger.error('未捕获的错误:', err);
  res.failServerError(config.env === 'production' ? '服务器内部错误' : err.message);
});

// ========== 优雅关闭 ==========
async function gracefulShutdown(signal) {
  logger.info(`${signal} 信号收到，开始优雅关闭...`);
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// ========== 启动 ==========
app.listen(config.port, () => {
  logger.info('═══════════════════════════════════════');
  logger.info('  小鲜鸡后端服务已启动');
  logger.info(`  端口: ${config.port}`);
  logger.info(`  环境: ${config.env}`);
  logger.info(`  地址: http://localhost:${config.port}`);
  logger.info('═══════════════════════════════════════');
});

module.exports = { app, prisma };
