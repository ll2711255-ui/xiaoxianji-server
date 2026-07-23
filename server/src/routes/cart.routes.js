/**
 * 购物车路由 /api/cart/*
 *
 * 策略：全量同步 — 前端每次更新购物车后 PUT 完整数组，服务端替換该用户全部记录
 * 优势：无增量同步冲突，实现最简单可靠
 */
const router = require('express').Router();
const db = require('../config/db');
const logger = require('../utils/logger');

/**
 * GET /api/cart
 * 获取当前用户购物车（所有商品）
 */
router.get('/', async (req, res) => {
  try {
    const openid = req.user.openid;
    const items = await db.query(
      'SELECT * FROM cart_items WHERE user_id = ? ORDER BY created_at ASC',
      [openid]
    );

    // 映射为前端 cart 格式
    const cart = items.map(row => ({
      cartKey: `${row.product_id}_${(row.spec && row.spec.type) || ''}_${(row.spec && row.spec.weight) || ''}_${(row.spec && row.spec.processing) || ''}_${(row.spec && row.spec.delivery) || ''}`,
      productId: row.product_id,
      productName: row.product_name,
      image: row.image,
      pricingType: row.pricing_type,
      spec: row.spec ? (typeof row.spec === 'string' ? JSON.parse(row.spec) : row.spec) : {},
      price: row.price,
      quantity: row.quantity,
      checked: true,
      remark: row.remark || '',
      emoji: ''
    }));

    res.json({ success: true, code: 200, data: { cart } });
  } catch (err) {
    logger.error('[cart] 获取购物车失败:', err.message);
    res.status(500).json({ success: false, code: 500, message: '获取购物车失败' });
  }
});

/**
 * PUT /api/cart
 * 全量替换购物车（先删后插）
 * Body: { items: [...] }
 */
router.put('/', async (req, res) => {
  try {
    const openid = req.user.openid;
    const { items } = req.body;

    if (!Array.isArray(items)) {
      return res.status(400).json({ success: false, code: 400, message: 'items 必须是数组' });
    }

    // 数量上限保护
    if (items.length > 50) {
      return res.status(400).json({ success: false, code: 400, message: '购物车商品不能超过50件' });
    }

    // 开启事务：先删后插
    const conn = await db.pool.getConnection();
    try {
      await conn.beginTransaction();

      // 删除旧数据
      await conn.execute('DELETE FROM cart_items WHERE user_id = ?', [openid]);

      // 批量插入新数据
      if (items.length > 0) {
        const placeholders = items.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
        const params = [];
        for (const item of items) {
          params.push(
            openid,
            item.productId || '',
            item.productName || '',
            item.image || '',
            item.pricingType || '',
            JSON.stringify(item.spec || {}),
            item.price || 0,
            item.quantity || 1,
            item.remark || ''
          );
        }
        await conn.execute(
          `INSERT INTO cart_items (user_id, product_id, product_name, image, pricing_type, spec, price, quantity, remark)
           VALUES ${placeholders}`,
          params
        );
      }

      await conn.commit();
      logger.info(`[cart] 购物车同步: ${openid}, ${items.length} 件`);
      res.json({ success: true, code: 200, message: '购物车已同步' });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  } catch (err) {
    logger.error('[cart] 同步购物车失败:', err.message);
    res.status(500).json({ success: false, code: 500, message: '同步购物车失败' });
  }
});

module.exports = router;
