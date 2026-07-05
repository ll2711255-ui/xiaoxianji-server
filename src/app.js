/**
 * Express 应用入口 — 中间件注册 + 路由挂载
 */
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const config = require('./config');
const logger = require('./utils/logger');

const app = express();

// ========== 全局中间件 ==========

// CORS（允许小程序和 PC 管理端跨域）
app.use(cors());

// HTTP 请求日志
app.use(morgan('short', {
  stream: { write: (msg) => logger.info(msg.trim()) },
}));

// JSON 解析（微信回调需要 raw body，在回调路由中单独处理）
app.use(express.json());

// 信任代理（Nginx 反向代理后获取真实 IP）
app.set('trust proxy', 1);

// ========== 路由注册 ==========

// 健康检查（无需鉴权）
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), env: config.env });
});

// 鉴权路由（无需登录）
app.use('/api/auth', require('./routes/auth.routes'));

// 支付回调路由（微信调用，无需鉴权，需验签）
app.use('/api/pay-callback', require('./routes/pay-callback.routes'));

// 公开路由（无需登录）
app.use('/api/store', require('./routes/store.routes'));
app.use('/api/products', require('./routes/product.routes'));
app.use('/api/categories', require('./routes/category.routes'));
app.use('/api/banners', require('./routes/store.routes'));

// 需登录的路由
const auth = require('./middleware/auth');
app.use('/api/orders', auth(), require('./routes/order.routes'));
app.use('/api/addresses', auth(), require('./routes/address.routes'));
app.use('/api/pai-numbers', auth(), require('./routes/pai-number.routes'));
app.use('/api/pickup', auth(), require('./routes/pickup.routes'));
app.use('/api/merchant', auth('merchant'), require('./routes/merchant.routes'));

// 开发工具路由
app.use('/api/dev', auth(), require('./routes/dev.routes'));

// ========== 404 处理 ==========
app.use((req, res) => {
  res.status(404).json({
    success: false,
    code: 404,
    message: '接口不存在',
  });
});

// ========== 全局错误处理 ==========
app.use((err, req, res, _next) => {
  logger.error('未捕获错误:', err);
  res.status(500).json({
    success: false,
    code: 500,
    message: config.env === 'production' ? '服务器内部错误' : err.message,
  });
});

module.exports = app;
