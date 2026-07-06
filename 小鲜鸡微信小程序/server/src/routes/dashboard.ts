/**
 * 数据看板路由
 *
 *   GET /api/v1/dashboard/overview      — 今日概览（单量/金额/状态分布）
 *   GET /api/v1/dashboard/trends        — 近 N 天趋势
 *   GET /api/v1/dashboard/hot-products  — 热销商品 Top N
 *   GET /api/v1/dashboard/export        — 导出 CSV
 */
import { Router, Request, Response } from 'express';
import { success, fail } from '../utils/response';
import { query, queryOne } from '../models/db';
import { authMiddleware } from '../middleware/auth';
import { requireAdmin } from '../middleware/role';

const router = Router();

// ---------- 今日概览 ----------
router.get('/overview', authMiddleware, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().slice(0, 10);

    const [todayOrders, todayAmount, statusDist, totalOrders] = await Promise.all([
      queryOne<any>(
        'SELECT COUNT(*) as cnt FROM orders WHERE created_at >= ?',
        [todayStr],
      ),
      queryOne<any>(
        'SELECT COALESCE(SUM(IFNULL(actual_amount, 0) + IFNULL(refund_amount, 0)), 0) as total FROM orders WHERE created_at >= ? AND status != ?',
        [todayStr, 'cancelled'],
      ),
      query(
        'SELECT status, COUNT(*) as cnt FROM orders WHERE created_at >= ? GROUP BY status',
        [todayStr],
      ),
      queryOne<any>('SELECT COUNT(*) as cnt FROM orders'),
    ]);

    success(res, {
      todayOrderCount: todayOrders?.cnt || 0,
      todayAmount: todayAmount?.total || 0,
      statusDistribution: statusDist,
      totalOrderCount: totalOrders?.cnt || 0,
    });
  } catch (err: any) {
    fail(res, '查询看板失败');
  }
});

// ---------- 近 N 天趋势 ----------
router.get('/trends', authMiddleware, requireAdmin, async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string, 10) || 7;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const rows = await query(
      `SELECT DATE(created_at) as date,
              COUNT(*) as order_count,
              COALESCE(SUM(IFNULL(actual_amount, 0) + IFNULL(refund_amount, 0)), 0) as amount
       FROM orders
       WHERE created_at >= ? AND status != 'cancelled'
       GROUP BY DATE(created_at)
       ORDER BY date ASC`,
      [startDate.toISOString().slice(0, 10)],
    );

    success(res, rows);
  } catch (err: any) {
    fail(res, '查询趋势失败');
  }
});

// ---------- 热销商品 ----------
router.get('/hot-products', authMiddleware, requireAdmin, async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string, 10) || 10;

    // 从订单 items JSON 中聚合统计（简单版：取 items 中的 productId）
    const rows = await query(
      `SELECT product_name, COUNT(*) as order_count
       FROM (
         SELECT JSON_UNQUOTE(JSON_EXTRACT(items, '$[0].productName')) as product_name
         FROM orders
         WHERE status != 'cancelled' AND items IS NOT NULL
       ) t
       WHERE product_name IS NOT NULL AND product_name != ''
       GROUP BY product_name
       ORDER BY order_count DESC
       LIMIT ${limit}`,
    );

    success(res, rows);
  } catch (err: any) {
    // 降级：从 products 表读取 sales 字段
    try {
      const rows = await query(
        'SELECT name, sales FROM products WHERE status = ? ORDER BY sales DESC LIMIT ?',
        ['on', parseInt(req.query.limit as string, 10) || 10],
      );
      success(res, rows);
    } catch {
      fail(res, '查询热销商品失败');
    }
  }
});

// ---------- 导出 CSV ----------
router.get('/export', authMiddleware, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, status } = req.query;

    let where = 'WHERE 1=1';
    const params: any[] = [];

    if (startDate) { where += ' AND created_at >= ?'; params.push(startDate); }
    if (endDate)   { where += ' AND created_at <= ?'; params.push(endDate); }
    if (status && status !== 'all') { where += ' AND status = ?'; params.push(status); }

    const rows = await query(`SELECT * FROM orders ${where} ORDER BY created_at DESC`, params);

    // 构建 CSV
    const headers = ['订单号','类型','状态','预付金额','实付金额','退款金额','交易单号','支付方式','物流单号','下单时间'];
    const csvRows = [headers.join(',')];

    for (const o of rows as any[]) {
      csvRows.push([
        o.order_no,
        o.type,
        o.status,
        (o.prepay_amount / 100).toFixed(2),
        ((o.actual_amount || 0) / 100).toFixed(2),
        ((o.refund_amount || 0) / 100).toFixed(2),
        o.transaction_id || '',
        o.payment_type,
        o.tracking_no || '',
        o.created_at,
      ].join(','));
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=orders_export.csv');
    // 添加 BOM 使 Excel 正确识别 UTF-8
    res.send('﻿' + csvRows.join('\n'));
  } catch (err: any) {
    fail(res, '导出失败');
  }
});

export default router;
