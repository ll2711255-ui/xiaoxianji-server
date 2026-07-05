/**
 * 店铺配置 & 轮播图路由 /api/store/* + /api/banners/*
 */
const router = require('express').Router();
const db = require('../config/db');
const auth = require('../middleware/auth');
const logger = require('../utils/logger');

// ========== 店铺配置（公开） ==========

/** GET /api/store */
router.get('/', async (req, res) => {
  try {
    const config = await db.queryOne("SELECT * FROM store_config WHERE config_key = 'store_config'");
    if (!config) {
      return res.json({ success: true, code: 200, data: {} });
    }
    res.json({ success: true, code: 200, data: { config } });
  } catch (err) {
    logger.error('[store] 查询失败:', err.message);
    res.status(500).json({ success: false, code: 500, message: err.message });
  }
});

/** PUT /api/store — 更新店铺配置（商家） */
router.put('/', auth('merchant'), async (req, res) => {
  try {
    const data = req.body;
    const fields = [];
    const params = [];

    const map = {
      name: 'name', address: 'address', latitude: 'latitude', longitude: 'longitude',
      deliveryRadius: 'delivery_radius', contactName: 'contact_name', contactPhone: 'contact_phone',
      openTime: 'open_time', closeTime: 'close_time',
    };

    for (const [key, col] of Object.entries(map)) {
      if (data[key] !== undefined) { fields.push(`${col} = ?`); params.push(data[key]); }
    }

    if (fields.length > 0) {
      params.push('store_config');
      await db.execute(
        `UPDATE store_config SET ${fields.join(', ')} WHERE config_key = ?`,
        params
      );
    }

    res.json({ success: true, code: 200, message: '配置更新成功' });
  } catch (err) {
    logger.error('[store] 更新失败:', err.message);
    res.status(500).json({ success: false, code: 500, message: err.message });
  }
});

// ========== 轮播图 ==========

/** GET /api/banners */
router.get('/banners', async (req, res) => {
  try {
    const banners = await db.query("SELECT * FROM banners WHERE status = 'on' ORDER BY sort ASC");
    res.json({ success: true, code: 200, data: { banners } });
  } catch (err) {
    logger.error('[banners] 查询失败:', err.message);
    res.status(500).json({ success: false, code: 500, message: err.message });
  }
});

/** PUT /api/banners — 更新轮播图（商家） */
router.put('/banners', auth('merchant'), async (req, res) => {
  try {
    const { banners } = req.body;
    if (!banners || !Array.isArray(banners)) {
      return res.status(400).json({ success: false, code: 400, message: 'banners 需为数组' });
    }

    // 全量替换
    await db.execute("DELETE FROM banners WHERE status = 'on' OR status = 'off'");
    for (const b of banners) {
      await db.insert(
        'INSERT INTO banners (image_url, link_url, sort, status) VALUES (?, ?, ?, ?)',
        [b.imageUrl || b.image_url, b.linkUrl || b.link_url || '', b.sort || 0, 'on']
      );
    }

    res.json({ success: true, code: 200, message: '轮播图更新成功' });
  } catch (err) {
    logger.error('[banners] 更新失败:', err.message);
    res.status(500).json({ success: false, code: 500, message: err.message });
  }
});

module.exports = router;
