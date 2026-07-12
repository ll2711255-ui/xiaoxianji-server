/**
 * PM2 生产环境配置（唯一权威版本）
 *
 * 部署方式：
 *   pm2 start ecosystem.config.js
 *   pm2 save
 *   pm2 startup
 */
module.exports = {
  apps: [
    {
      name: 'xiaoxianji-api',
      script: './src/server.js',
      instances: 2,              // 双实例（4C4G 服务器）
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      max_memory_restart: '500M',
      max_restarts: 10,         // 连续崩溃超过 10 次不再重启
      min_uptime: '10s',        // 运行不满 10s 视为异常启动
      restart_delay: 5000,      // 崩溃后等 5s 再重启（避免死循环）
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      merge_logs: true,
      // 优雅重启
      kill_timeout: 5000,
      listen_timeout: 3000,
    },
  ],
};
