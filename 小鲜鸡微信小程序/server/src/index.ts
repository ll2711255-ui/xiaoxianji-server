/**
 * 小鲜鸡 · 统一服务端入口
 *
 * Express + Socket.IO + REST API
 * 部署：PM2 cluster mode (2 实例)
 */
import express from 'express';
import cors from 'cors';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { config } from './config';
import { requestLogger } from './middleware/logger';
import { initWebSocket } from './websocket';

// 路由
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import productRoutes from './routes/products';
import orderRoutes from './routes/orders';
import callbackRoutes from './routes/callback';
import dashboardRoutes from './routes/dashboard';
import configRoutes from './routes/config';
import marketingRoutes from './routes/marketing';
import uploadRoutes from './routes/upload';

// 确保 uploads 目录存在
const uploadsDir = path.resolve(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const app = express();
const server = http.createServer(app);

// ========== 全局中间件 ==========

app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);

// 静态资源
app.use('/uploads', express.static(uploadsDir));

// ========== API 路由 ==========

const api = '/api/v1';

app.use(`${api}/auth`, authRoutes);
app.use(`${api}/users`, userRoutes);
app.use(`${api}/products`, productRoutes);
app.use(`${api}/orders`, orderRoutes);
app.use(`${api}/callback`, callbackRoutes);
app.use(`${api}/dashboard`, dashboardRoutes);
app.use(`${api}/config`, configRoutes);
app.use(`${api}/marketing`, marketingRoutes);
app.use(`${api}/upload`, uploadRoutes);

// 健康检查
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// ========== 404 ==========

app.use((_req, res) => {
  res.status(404).json({ code: 404, message: 'Not Found' });
});

// ========== 全局错误处理 ==========

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[server] 未捕获错误:', err);
  res.status(500).json({ code: 500, message: '服务器内部错误' });
});

// ========== WebSocket ==========

initWebSocket(server);

// ========== 启动 ==========

server.listen(config.port, () => {
  console.log(`[server] 小鲜鸡服务端已启动 → http://localhost:${config.port}`);
  console.log(`[server] 环境: ${config.env}`);
});

export default app;
