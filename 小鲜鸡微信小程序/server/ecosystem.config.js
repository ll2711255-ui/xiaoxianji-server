/**
 * PM2 生产环境配置
 *
 * 使用：
 *   pm2 start ecosystem.config.js
 *   pm2 logs xiaoxianji-server
 *   pm2 restart xiaoxianji-server
 */
module.exports = {
  apps: [
    {
      name: 'xiaoxianji-server',
      script: 'dist/index.js',
      instances: 2,           // 2 核 2 实例
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      max_memory_restart: '500M',
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
    },
  ],
};
