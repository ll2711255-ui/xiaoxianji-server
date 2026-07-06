/**
 * 用户路由
 *
 *   GET    /api/v1/users/profile       — 获取个人信息
 *   PUT    /api/v1/users/profile       — 更新个人信息
 *   GET    /api/v1/users/addresses     — 收货地址列表
 *   POST   /api/v1/users/addresses     — 新增地址
 *   PUT    /api/v1/users/addresses/:id — 更新地址
 *   DELETE /api/v1/users/addresses/:id — 删除地址
 *   GET    /api/v1/users/staff         — 店员列表（管理后台）
 *   POST   /api/v1/users/staff         — 创建店员账号（管理后台）
 */
import { Router, Request, Response } from 'express';
import { success, fail, created } from '../utils/response';
import { query, queryOne, execute } from '../models/db';
import { authMiddleware } from '../middleware/auth';
import { requireAdmin } from '../middleware/role';
import { md5 } from '../utils/crypto';

const router = Router();

// ---------- 个人信息 ----------
router.get('/profile', authMiddleware, async (req: Request, res: Response) => {
  try {
    const user = await queryOne<any>(
      'SELECT id, openid, phone, nick_name, avatar_url, role FROM users WHERE id = ?',
      [req.user!.userId],
    );
    if (!user) {
      fail(res, '用户不存在', 404, 404);
      return;
    }
    success(res, user);
  } catch (err: any) {
    fail(res, '查询个人信息失败');
  }
});

router.put('/profile', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { nickName, avatarUrl, phone } = req.body;
    await execute(
      'UPDATE users SET nick_name = ?, avatar_url = ?, phone = ?, updated_at = NOW() WHERE id = ?',
      [nickName || '', avatarUrl || '', phone || '', req.user!.userId],
    );
    success(res, {});
  } catch (err: any) {
    fail(res, '更新个人信息失败');
  }
});

// ---------- 收货地址 ----------
router.get('/addresses', authMiddleware, async (req: Request, res: Response) => {
  try {
    const list = await query(
      'SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC, created_at DESC',
      [req.user!.userId],
    );
    success(res, list);
  } catch (err: any) {
    fail(res, '查询地址失败');
  }
});

router.post('/addresses', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { name, phone, province, city, district, detail, latitude, longitude, isDefault } = req.body;
    if (!name || !phone) {
      fail(res, '姓名和电话不能为空');
      return;
    }

    // 取消原默认地址
    if (isDefault) {
      await execute('UPDATE addresses SET is_default = 0 WHERE user_id = ?', [req.user!.userId]);
    }

    const result = await execute(
      `INSERT INTO addresses (user_id, name, phone, province, city, district, detail, latitude, longitude, is_default)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.user!.userId, name, phone, province || '', city || '', district || '', detail || '', latitude || null, longitude || null, isDefault ? 1 : 0],
    );

    created(res, { addressId: result.insertId });
  } catch (err: any) {
    fail(res, '新增地址失败');
  }
});

router.put('/addresses/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { name, phone, province, city, district, detail, latitude, longitude, isDefault } = req.body;

    if (isDefault) {
      await execute('UPDATE addresses SET is_default = 0 WHERE user_id = ?', [req.user!.userId]);
    }

    await execute(
      `UPDATE addresses SET name=?, phone=?, province=?, city=?, district=?, detail=?, latitude=?, longitude=?, is_default=?
       WHERE id=? AND user_id=?`,
      [name, phone, province, city, district, detail, latitude || null, longitude || null, isDefault ? 1 : 0, req.params.id, req.user!.userId],
    );

    success(res, {});
  } catch (err: any) {
    fail(res, '更新地址失败');
  }
});

router.delete('/addresses/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    await execute('DELETE FROM addresses WHERE id = ? AND user_id = ?', [req.params.id, req.user!.userId]);
    success(res, {});
  } catch (err: any) {
    fail(res, '删除地址失败');
  }
});

// ---------- 店员管理 ----------
router.get('/staff', authMiddleware, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const list = await query(
      "SELECT id, phone, nick_name, role, last_login_at, created_at FROM users WHERE role IN ('staff', 'merchant', 'admin') ORDER BY created_at DESC",
    );
    success(res, list);
  } catch (err: any) {
    fail(res, '查询店员失败');
  }
});

router.post('/staff', authMiddleware, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { phone, password, nickName, role } = req.body;
    if (!phone || !password) {
      fail(res, '手机号和密码不能为空');
      return;
    }

    const existing = await queryOne<any>('SELECT id FROM users WHERE phone = ?', [phone]);
    if (existing) {
      fail(res, '手机号已被注册');
      return;
    }

    const result = await execute(
      'INSERT INTO users (phone, password_hash, nick_name, role, merchant_id) VALUES (?, ?, ?, ?, ?)',
      [phone, md5(password), nickName || '', role || 'staff', 1],
    );

    created(res, { userId: result.insertId });
  } catch (err: any) {
    fail(res, '创建店员失败');
  }
});

export default router;
