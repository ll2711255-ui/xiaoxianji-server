/**
 * 系统配置路由
 *
 *   GET  /api/v1/config/store     — 获取店铺配置（公开）
 *   PUT  /api/v1/config/store     — 更新店铺配置（管理后台）
 *   GET  /api/v1/config/banners   — 获取轮播图（公开）
 *   PUT  /api/v1/config/banners   — 更新轮播图（管理后台）
 */
import { Router, Request, Response } from 'express';
import { success, fail } from '../utils/response';
import { queryOne, execute, query } from '../models/db';
import { authMiddleware } from '../middleware/auth';
import { requireAdmin } from '../middleware/role';

const router = Router();

// ---------- 获取店铺配置 ----------
router.get('/store', async (_req: Request, res: Response) => {
  try {
    const row = await queryOne<any>(
      'SELECT value FROM configs WHERE `key` = ?',
      ['store_config'],
    );

    const config = row?.value
      ? (typeof row.value === 'string' ? JSON.parse(row.value) : row.value)
      : { name: '小鲜鸡', address: '', deliveryRadius: 5, latitude: 23.1291, longitude: 113.2644, contactName: '', contactPhone: '', icpNumber: '' };

    success(res, config);
  } catch (err: any) {
    fail(res, '查询配置失败');
  }
});

// ---------- 更新店铺配置 ----------
router.put('/store', authMiddleware, requireAdmin, async (req: Request, res: Response) => {
  try {
    const existing = await queryOne<any>(
      'SELECT id, value FROM configs WHERE `key` = ?',
      ['store_config'],
    );

    const newValue = JSON.stringify(req.body);

    if (existing) {
      await execute(
        'UPDATE configs SET value = ?, updated_at = NOW() WHERE `key` = ?',
        [newValue, 'store_config'],
      );
    } else {
      await execute(
        'INSERT INTO configs (`key`, value) VALUES (?, ?)',
        ['store_config', newValue],
      );
    }

    success(res, {});
  } catch (err: any) {
    fail(res, '更新配置失败');
  }
});

// ---------- 获取轮播图 ----------
router.get('/banners', async (_req: Request, res: Response) => {
  try {
    const list = await query(
      'SELECT * FROM banners WHERE status = ? ORDER BY sort_order ASC',
      ['on'],
    );
    success(res, list);
  } catch (err: any) {
    fail(res, '查询轮播图失败');
  }
});

// ---------- 更新轮播图 ----------
router.put('/banners', authMiddleware, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { banners } = req.body; // [{id?, imageUrl, linkUrl, sortOrder}]
    if (!Array.isArray(banners)) {
      fail(res, '参数无效');
      return;
    }

    // 简单方案：全量替换
    await execute('DELETE FROM banners');

    for (const b of banners) {
      await execute(
        'INSERT INTO banners (image_url, link_url, sort_order) VALUES (?, ?, ?)',
        [b.imageUrl, b.linkUrl || '', b.sortOrder || 0],
      );
    }

    success(res, {});
  } catch (err: any) {
    fail(res, '更新轮播图失败');
  }
});

export default router;
