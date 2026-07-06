/**
 * 收货地址路由 /api/addresses/*
 */
const router = require('express').Router();
const db = require('../config/db');
const logger = require('../utils/logger');

/** GET /api/addresses */
router.get('/', async (req, res) => {
  try {
    const addresses = await db.query(
      'SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC, create_time DESC',
      [req.user.openid]
    );
    res.json({ success: true, code: 200, data: { addresses } });
  } catch (err) {
    logger.error('[addresses] 查询失败:', err.message);
    res.status(500).json({ success: false, code: 500, message: err.message });
  }
});

/** POST /api/addresses */
router.post('/', async (req, res) => {
  try {
    const { name, phone, province, city, district, detail, latitude, longitude, isDefault } = req.body;
    if (!name || !phone || !detail) {
      return res.status(400).json({ success: false, code: 400, message: '姓名、电话、详细地址为必填' });
    }

    // 如果设置为默认，先取消其他默认
    if (isDefault) {
      await db.execute('UPDATE addresses SET is_default = 0 WHERE user_id = ?', [req.user.openid]);
    }

    const id = await db.insert(
      `INSERT INTO addresses (user_id, name, phone, province, city, district, detail, latitude, longitude, is_default)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.user.openid, name, phone, province || '', city || '', district || '', detail, latitude || null, longitude || null, isDefault ? 1 : 0]
    );

    res.json({ success: true, code: 200, data: { id } });
  } catch (err) {
    logger.error('[addresses] 添加失败:', err.message);
    res.status(500).json({ success: false, code: 500, message: err.message });
  }
});

/** PUT /api/addresses/:addressId */
router.put('/:addressId', async (req, res) => {
  try {
    const { name, phone, province, city, district, detail, latitude, longitude, isDefault } = req.body;

    if (isDefault) {
      await db.execute('UPDATE addresses SET is_default = 0 WHERE user_id = ?', [req.user.openid]);
    }

    const fields = [];
    const params = [];
    const map = { name, phone, province, city, district, detail, latitude, longitude };
    for (const [key, val] of Object.entries(map)) {
      if (val !== undefined) { fields.push(`${key} = ?`); params.push(val); }
    }
    if (isDefault !== undefined) { fields.push('is_default = ?'); params.push(isDefault ? 1 : 0); }

    if (fields.length > 0) {
      params.push(req.params.addressId, req.user.openid);
      await db.execute(
        `UPDATE addresses SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`,
        params
      );
    }

    res.json({ success: true, code: 200, message: '地址更新成功' });
  } catch (err) {
    logger.error('[addresses] 更新失败:', err.message);
    res.status(500).json({ success: false, code: 500, message: err.message });
  }
});

/** DELETE /api/addresses/:addressId */
router.delete('/:addressId', async (req, res) => {
  try {
    await db.execute('DELETE FROM addresses WHERE id = ? AND user_id = ?', [req.params.addressId, req.user.openid]);
    res.json({ success: true, code: 200, message: '地址已删除' });
  } catch (err) {
    logger.error('[addresses] 删除失败:', err.message);
    res.status(500).json({ success: false, code: 500, message: err.message });
  }
});

module.exports = router;
