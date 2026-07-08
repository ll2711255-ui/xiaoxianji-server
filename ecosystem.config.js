/**
 * 已废弃，请使用 server/ecosystem.config.js
 *
 * PM2 生产环境配置
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
