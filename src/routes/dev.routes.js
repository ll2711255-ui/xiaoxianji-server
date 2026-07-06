/**
 * 开发工具路由 /api/dev/*
 * 仅开发环境可用
 */
const router = require('express').Router();
const db = require('../config/db');
const config = require('../config');
const logger = require('../utils/logger');

/**
 * POST /api/dev/clear-test-data — 清测试数据
 */
router.post('/clear-test-data', async (req, res) => {
  if (config.env === 'production') {
    return res.status(403).json({ success: false, code: 403, message: '生产环境禁用' });
  }

  try {
    await db.execute("DELETE FROM order_info WHERE user_id = 'offline' OR status_label = 'pending'");
    await db.execute("DELETE FROM payment_record WHERE order_no NOT IN (SELECT order_no FROM order_info)");
    await db.execute("DELETE FROM refund_record WHERE order_no NOT IN (SELECT order_no FROM order_info)");
    await db.execute("UPDATE pai_numbers SET status = 'idle', order_id = ''");

    res.json({ success: true, code: 200, message: '测试数据已清除' });
  } catch (err) {
    logger.error('[dev] 清数据失败:', err.message);
    res.status(500).json({ success: false, code: 500, message: err.message });
  }
});

/**
 * POST /api/dev/clear-mock-orders — 清模拟订单
 */
router.post('/clear-mock-orders', async (req, res) => {
  if (config.env === 'production') {
    return res.status(403).json({ success: false, code: 403, message: '生产环境禁用' });
  }

  try {
    await db.execute("DELETE FROM order_info WHERE transaction_id LIKE 'mock_%'");
    await db.execute("DELETE FROM payment_record WHERE transaction_id LIKE 'mock_%'");
    res.json({ success: true, code: 200, message: '模拟订单已清除' });
  } catch (err) {
    logger.error('[dev] 清模拟订单失败:', err.message);
    res.status(500).json({ success: false, code: 500, message: err.message });
  }
});

module.exports = router;
