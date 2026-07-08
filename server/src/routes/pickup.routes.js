/**
 * 取货状态路由 /api/pickup/*
 */
const router = require('express').Router();
const db = require('../config/db');
const logger = require('../utils/logger');
const { validateOrderNo } = require('../utils/validate');

/** GET /api/pickup/status/:orderNo — 查询取货状态（需登录，只允许本人或商家） */
router.get('/status/:orderNo', async (req, res) => {
  try {
    const v = validateOrderNo(req.params.orderNo);
    if (!v.valid) return res.status(400).json({ success: false, code: 400, message: v.error });

    const order = await db.queryOne(
      'SELECT order_no, user_id, status_label, card_number, type, weigh_info FROM order_info WHERE order_no = ?',
      [req.params.orderNo]
    );
    if (!order) {
      return res.status(404).json({ success: false, code: 404, message: '订单不存在' });
    }
    // 仅允许订单所属用户或商家查看
    if (order.user_id !== req.user.openid && req.user.role !== 'merchant') {
      return res.status(403).json({ success: false, code: 403, message: '无权查看此订单' });
    }
    res.json({ success: true, code: 200, data: order });
  } catch (err) {
    logger.error('[pickup] 查询失败:', err.message);
    res.status(500).json({ success: false, code: 500, message: err.message });
  }
});

module.exports = router;
