/**
 * 营销路由
 *
 *   GET    /api/v1/marketing/coupons         — 优惠券列表（管理端）
 *   POST   /api/v1/marketing/coupons         — 创建优惠券
 *   PUT    /api/v1/marketing/coupons/:id     — 编辑优惠券
 *   PATCH  /api/v1/marketing/coupons/:id/status — 启用/停用
 *
 *   GET    /api/v1/marketing/coupons/my      — 我的优惠券（C 端）
 *   POST   /api/v1/marketing/coupons/receive — 领取优惠券
 *   POST   /api/v1/marketing/coupons/verify  — 核销优惠券
 */
import { Router, Request, Response } from 'express';
import { success, fail, created } from '../utils/response';
import { query, queryOne, execute } from '../models/db';
import { authMiddleware } from '../middleware/auth';
import { requireAdmin } from '../middleware/role';

const router = Router();

// ========== 管理端 ==========

router.get('/coupons', authMiddleware, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { status, page = '1', pageSize = '20' } = req.query;
    let where = 'WHERE 1=1';
    const params: any[] = [];

    if (status && status !== 'all') {
      where += ' AND status = ?';
      params.push(status);
    }

    const list = await query(
      `SELECT * FROM coupons ${where} ORDER BY created_at DESC`,
      params,
    );

    success(res, { list });
  } catch (err: any) {
    fail(res, '查询优惠券失败');
  }
});

router.post('/coupons', authMiddleware, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { name, type, value, minAmount, totalCount, startAt, endAt } = req.body;
    if (!name || !type || !value) {
      fail(res, '参数不全');
      return;
    }

    const result = await execute(
      `INSERT INTO coupons (name, type, value, min_amount, total_count, start_at, end_at, merchant_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, type, value, minAmount || 0, totalCount || 0, startAt || null, endAt || null, 1],
    );

    created(res, { couponId: result.insertId });
  } catch (err: any) {
    fail(res, '创建优惠券失败');
  }
});

router.patch('/coupons/:id/status', authMiddleware, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    await execute('UPDATE coupons SET status = ? WHERE id = ?', [status, req.params.id]);
    success(res, {});
  } catch (err: any) {
    fail(res, '更新优惠券状态失败');
  }
});

// ========== C 端 ==========

router.get('/coupons/my', authMiddleware, async (req: Request, res: Response) => {
  try {
    const list = await query(
      `SELECT uc.*, c.name, c.type, c.value, c.min_amount, c.end_at
       FROM user_coupons uc
       JOIN coupons c ON uc.coupon_id = c.id
       WHERE uc.user_id = ?
       ORDER BY uc.created_at DESC`,
      [req.user!.userId],
    );
    success(res, list);
  } catch (err: any) {
    fail(res, '查询我的优惠券失败');
  }
});

router.post('/coupons/receive', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { couponId } = req.body;

    // 校验优惠券
    const coupon = await queryOne<any>('SELECT * FROM coupons WHERE id = ? AND status = ?', [couponId, 'on']);
    if (!coupon) {
      fail(res, '优惠券不存在或已下架');
      return;
    }
    if (coupon.end_at && new Date(coupon.end_at) < new Date()) {
      fail(res, '优惠券已过期');
      return;
    }
    if (coupon.used_count >= coupon.total_count) {
      fail(res, '优惠券已领完');
      return;
    }

    // 检查是否已领过
    const existing = await queryOne<any>(
      'SELECT id FROM user_coupons WHERE user_id = ? AND coupon_id = ?',
      [req.user!.userId, couponId],
    );
    if (existing) {
      fail(res, '已领取过该优惠券');
      return;
    }

    await execute(
      'INSERT INTO user_coupons (user_id, coupon_id) VALUES (?, ?)',
      [req.user!.userId, couponId],
    );
    await execute('UPDATE coupons SET used_count = used_count + 1 WHERE id = ?', [couponId]);

    success(res, {});
  } catch (err: any) {
    fail(res, '领取失败');
  }
});

router.post('/coupons/verify', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { userCouponId, orderNo, amount } = req.body;

    const uc = await queryOne<any>(
      'SELECT * FROM user_coupons WHERE id = ? AND user_id = ? AND status = ?',
      [userCouponId, req.user!.userId, 'unused'],
    );
    if (!uc) {
      fail(res, '优惠券不可用');
      return;
    }

    const coupon = await queryOne<any>('SELECT * FROM coupons WHERE id = ?', [uc.coupon_id]);
    if (!coupon) {
      fail(res, '优惠券不存在');
      return;
    }

    if (coupon.min_amount > 0 && amount < coupon.min_amount) {
      fail(res, `未满最低消费 ¥${(coupon.min_amount / 100).toFixed(2)}`);
      return;
    }

    // 核销
    await execute(
      'UPDATE user_coupons SET status = ?, used_at = NOW(), order_no = ? WHERE id = ?',
      ['used', orderNo, userCouponId],
    );

    // 计算优惠金额
    let discountAmount = coupon.value;
    if (coupon.type === 'percent') {
      discountAmount = Math.floor(amount * coupon.value / 100);
    }

    success(res, { discountAmount, couponName: coupon.name });
  } catch (err: any) {
    fail(res, '核销失败');
  }
});

export default router;
