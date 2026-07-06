/**
 * 号码牌路由 /api/pai-numbers/*
 */
const router = require('express').Router();
const db = require('../config/db');
const logger = require('../utils/logger');

/** GET /api/pai-numbers */
router.get('/', async (req, res) => {
  try {
    const numbers = await db.query("SELECT * FROM pai_numbers ORDER BY CAST(number AS UNSIGNED) ASC");
    res.json({ success: true, code: 200, data: { numbers } });
  } catch (err) {
    logger.error('[pai-numbers] 查询失败:', err.message);
    res.status(500).json({ success: false, code: 500, message: err.message });
  }
});

/** GET /api/pai-numbers/:cardNumber/code — 获取取货码 */
router.get('/:cardNumber/code', async (req, res) => {
  try {
    const { cardNumber } = req.params;
    const number = await db.queryOne('SELECT * FROM pai_numbers WHERE number = ?', [cardNumber]);
    if (!number) {
      return res.status(404).json({ success: false, code: 404, message: '号码牌不存在' });
    }
    res.json({ success: true, code: 200, data: { cardNumber, code: cardNumber } });
  } catch (err) {
    logger.error('[pai-numbers] code查询失败:', err.message);
    res.status(500).json({ success: false, code: 500, message: err.message });
  }
});

/** POST /api/pai-numbers/:number/release — 释放号码牌 */
router.post('/:number/release', async (req, res) => {
  try {
    const { number } = req.params;
    await db.execute(
      "UPDATE pai_numbers SET status = 'idle', order_id = '' WHERE number = ?",
      [number]
    );
    res.json({ success: true, code: 200, message: '号码牌已释放' });
  } catch (err) {
    logger.error('[pai-numbers] 释放失败:', err.message);
    res.status(500).json({ success: false, code: 500, message: err.message });
  }
});

module.exports = router;
