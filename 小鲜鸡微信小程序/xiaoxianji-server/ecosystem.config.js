/**
 * PM2 进程管理配置
 *
 * 使用方法：
 *   pm2 start ecosystem.config.js
 *   pm2 restart xiaoxianji-server
 *   pm2 logs xiaoxianji-server
 *   pm2 monit
 */
module.exports = {
  apps: [
    {
      name: 'xiaoxianji-server',
      script: 'src/index.js',
      instances: 2, // 双实例（根据CPU核数调整，建议 max=4）
      exec_mode: 'cluster',
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      // 日志
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      merge_logs: true,
      // 优雅关闭
      kill_timeout: 10000,
      listen_timeout: 5000,
      // 自动重启
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 5000,
    },
  ],
};
