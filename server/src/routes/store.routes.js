/**
 * 店铺配置 & 轮播图路由 /api/store/* + /api/banners/*
 */
const router = require('express').Router();
const db = require('../config/db');
const { verifyToken, requireMerchant } = require('../middleware/auth');
const logger = require('../utils/logger');

// ========== 店铺配置（公开） ==========

// 字段筛选（db.query 已自动转为驼峰，此处仅做字段白名单过滤）
function filterConfigFields(row) {
  if (!row) return {};
  return {
    name: row.name,
    address: row.address,
    latitude: row.latitude,
    longitude: row.longitude,
    deliveryRadius: row.deliveryRadius,
    contactName: row.contactName,
    contactPhone: row.contactPhone,
    openTime: row.openTime,
    closeTime: row.closeTime,
  };
}

/** GET /api/store — 公开接口，返回店铺配置（当前单店铺模式，config_key='store_config'） */
// TODO: 多店铺时按 merchant_id 隔离，或按 req.query.merchantId 筛选
router.get('/', async (req, res) => {
  try {
    const config = await db.queryOne("SELECT * FROM store_config WHERE config_key = 'store_config'");
    if (!config) {
      return res.json({ success: true, code: 200, data: { config: {} } });
    }
    res.json({ success: true, code: 200, data: { config: filterConfigFields(config) } });
  } catch (err) {
    logger.error('[store] 查询失败:', err.message);
    res.status(500).json({ success: false, code: 500, message: err.message });
  }
});

/** PUT /api/store — 更新店铺配置（商家） */
router.put('/', verifyToken, requireMerchant, async (req, res) => {
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
router.put('/banners', verifyToken, requireMerchant, async (req, res) => {
  try {
    const { banners } = req.body;
    if (!banners || !Array.isArray(banners)) {
      return res.status(400).json({ success: false, code: 400, message: 'banners 需为数组' });
    }

    // 全量替换
    await db.execute("DELETE FROM banners");
    for (const b of banners) {
      // 前端字段名为 image（上传返回）, 兼顾 imageUrl / image_url（旧数据兼容）
      const imageUrl = b.image || b.imageUrl || b.image_url || '';
      const title = b.title || '';
      const subtitle = b.subtitle || '';
      const bg = b.bg || '#FFF8F5';
      const sort = b.sort || 0;
      const status = b.status || (b.statusOn ? 'on' : 'off');

      await db.insert(
        'INSERT INTO banners (image_url, title, subtitle, bg_color, sort, status) VALUES (?, ?, ?, ?, ?, ?)',
        [imageUrl, title, subtitle, bg, sort, status]
      );
    }

    res.json({ success: true, code: 200, message: '轮播图更新成功' });
  } catch (err) {
    logger.error('[banners] 更新失败:', err.message);
    res.status(500).json({ success: false, code: 500, message: err.message });
  }
});

module.exports = router;
