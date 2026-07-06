/**
 * 定时任务调度器
 */
const cron = require('node-cron');
const logger = require('../utils/logger');

let jobsStarted = false;

function startAllJobs() {
  if (jobsStarted) return;
  jobsStarted = true;

  // P0: 超时关单 — 每分钟
  cron.schedule('* * * * *', async () => {
    try {
      const timeoutClose = require('./timeoutClose');
      await timeoutClose();
    } catch (err) {
      logger.error('[cron] timeoutClose 异常:', err.message);
    }
  });
  logger.info('定时任务 [超时关单] 已注册（每1分钟）');

  // P0: 兜底查单 — 每5分钟
  cron.schedule('*/5 * * * *', async () => {
    try {
      const fallbackQuery = require('./fallbackQuery');
      await fallbackQuery();
    } catch (err) {
      logger.error('[cron] fallbackQuery 异常:', err.message);
    }
  });
  logger.info('定时任务 [兜底查单] 已注册（每5分钟）');
}

module.exports = { startAllJobs };
