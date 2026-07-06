/**
 * 取货状态路由 /api/pickup/*
 */
const router = require('express').Router();
const db = require('../config/db');
const logger = require('../utils/logger');

/** GET /api/pickup/status/:orderNo */
router.get('/status/:orderNo', async (req, res) => {
  try {
    const order = await db.queryOne(
      'SELECT order_no, status_label, card_number, type, weigh_info FROM order_info WHERE order_no = ?',
      [req.params.orderNo]
    );
    if (!order) {
      return res.status(404).json({ success: false, code: 404, message: '订单不存在' });
    }
    res.json({ success: true, code: 200, data: order });
  } catch (err) {
    logger.error('[pickup] 查询失败:', err.message);
    res.status(500).json({ success: false, code: 500, message: err.message });
  }
});

module.exports = router;
