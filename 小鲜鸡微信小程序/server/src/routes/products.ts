/**
 * 商品路由
 *   GET    /api/v1/products         — 商品列表（按分类/状态筛选，公开）
 *   GET    /api/v1/products/:id     — 商品详情（公开）
 *   POST   /api/v1/products         — 新增商品（管理后台）
 *   PUT    /api/v1/products/:id     — 编辑商品（管理后台）
 *   PATCH  /api/v1/products/:id/status — 上下架（管理后台）
 *   PATCH  /api/v1/products/:id/stock  — 更新库存（管理后台/收银）
 *   GET    /api/v1/categories       — 分类列表（公开）
 *   POST   /api/v1/categories       — 新增分类（管理后台）
 *   DELETE /api/v1/categories/:id   — 删除分类（管理后台）
 *   PUT    /api/v1/categories/sort  — 排序（管理后台）
 */
import { Router, Request, Response } from 'express';
import { success, fail, created } from '../utils/response';
import { query, queryOne, execute } from '../models/db';
import { authMiddleware } from '../middleware/auth';
import { requireAdmin } from '../middleware/role';

const router = Router();

// ========== 商品列表 ==========
router.get('/', async (req: Request, res: Response) => {
  try {
    const { categoryId, status, keyword, page = '1', pageSize = '20' } = req.query;
    const p = parseInt(page as string, 10);
    const ps = Math.min(parseInt(pageSize as string, 10), 100);

    let where = 'WHERE 1=1';
    const params: any[] = [];

    if (categoryId) {
      where += ' AND p.category_id = ?';
      params.push(categoryId);
    }
    if (status && status !== 'all') {
      where += ' AND p.status = ?';
      params.push(status);
    }
    if (keyword) {
      where += ' AND p.name LIKE ?';
      params.push(`%${keyword}%`);
    }

    // 公开接口，只展示上架商品
    if (!status) {
      where += ' AND p.status = ?';
      params.push('on');
    }

    const countSql = `SELECT COUNT(*) as total FROM products p ${where}`;
    const dataSql = `
      SELECT p.*, c.name as category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      ${where}
      ORDER BY p.created_at DESC
      LIMIT ${ps} OFFSET ${(p - 1) * ps}
    `;

    const [countResult, list] = await Promise.all([
      queryOne<{ total: number }>(countSql, params),
      query(dataSql, params),
    ]);

    success(res, { list, total: countResult?.total || 0, page: p, pageSize: ps });
  } catch (err: any) {
    console.error('[products] 查询失败:', err.message);
    fail(res, '查询商品失败');
  }
});

// ========== 商品详情 ==========
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const product = await queryOne<any>(
      `SELECT p.*, c.name as category_name
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.id = ?`,
      [req.params.id],
    );

    if (!product) {
      fail(res, '商品不存在', 404, 404);
      return;
    }

    success(res, product);
  } catch (err: any) {
    console.error('[products] 详情查询失败:', err.message);
    fail(res, '查询商品详情失败');
  }
});

// ========== 新增商品（管理后台） ==========
router.post('/', authMiddleware, requireAdmin, async (req: Request, res: Response) => {
  try {
    const {
      categoryId, name, pricingType, sellingPoint, description,
      deliveryModes, images, processingOptions,
      pricePerJin, weightOptions, processingFee, unitPrice, specs,
      stockQuantity, stockAlertThreshold, origin,
    } = req.body;

    if (!name || !categoryId) {
      fail(res, '商品名称和分类不能为空');
      return;
    }

    const result = await execute(
      `INSERT INTO products (
        category_id, name, pricing_type, selling_point, description,
        delivery_modes, images, processing_options,
        price_per_jin, weight_options, processing_fee, unit_price, specs,
        stock_quantity, stock_alert_threshold, origin,
        merchant_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        categoryId, name.trim(), pricingType || 'exact_weight', sellingPoint || '', description || '',
        JSON.stringify(deliveryModes || ['delivery', 'pickup']),
        JSON.stringify(images || []),
        JSON.stringify(processingOptions || ['整只', '切块']),
        pricePerJin || 0,
        JSON.stringify(weightOptions || [500]),
        processingFee || 0,
        unitPrice || 0,
        JSON.stringify(specs || []),
        stockQuantity || 0,
        stockAlertThreshold || 5,
        origin || '',
        1,
      ],
    );

    created(res, { productId: result.insertId });
  } catch (err: any) {
    console.error('[products] 创建失败:', err.message);
    fail(res, '创建商品失败');
  }
});

// ========== 编辑商品（管理后台） ==========
router.put('/:id', authMiddleware, requireAdmin, async (req: Request, res: Response) => {
  try {
    const {
      categoryId, name, pricingType, sellingPoint, description,
      deliveryModes, images, processingOptions,
      pricePerJin, weightOptions, processingFee, unitPrice, specs,
      stockQuantity, stockAlertThreshold, origin,
    } = req.body;

    await execute(
      `UPDATE products SET
        category_id = ?, name = ?, pricing_type = ?, selling_point = ?, description = ?,
        delivery_modes = ?, images = ?, processing_options = ?,
        price_per_jin = ?, weight_options = ?, processing_fee = ?, unit_price = ?, specs = ?,
        stock_quantity = ?, stock_alert_threshold = ?, origin = ?,
        updated_at = NOW()
      WHERE id = ?`,
      [
        categoryId, name?.trim(), pricingType || 'exact_weight', sellingPoint || '', description || '',
        JSON.stringify(deliveryModes || ['delivery', 'pickup']),
        JSON.stringify(images || []),
        JSON.stringify(processingOptions || ['整只', '切块']),
        pricePerJin || 0,
        JSON.stringify(weightOptions || [500]),
        processingFee || 0,
        unitPrice || 0,
        JSON.stringify(specs || []),
        stockQuantity || 0,
        stockAlertThreshold || 5,
        origin || '',
        req.params.id,
      ],
    );

    success(res, {});
  } catch (err: any) {
    console.error('[products] 更新失败:', err.message);
    fail(res, '更新商品失败');
  }
});

// ========== 上下架 ==========
router.patch('/:id/status', authMiddleware, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    if (!status || !['on', 'off'].includes(status)) {
      fail(res, '状态值无效');
      return;
    }
    await execute('UPDATE products SET status = ?, updated_at = NOW() WHERE id = ?', [status, req.params.id]);
    success(res, {});
  } catch (err: any) {
    fail(res, '更新商品状态失败');
  }
});

// ========== 更新库存 ==========
router.patch('/:id/stock', authMiddleware, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { stockQuantity, outOfStock } = req.body;
    const updates: string[] = ['updated_at = NOW()'];
    const params: any[] = [];

    if (stockQuantity !== undefined) {
      updates.push('stock_quantity = ?');
      params.push(stockQuantity);
    }
    if (outOfStock !== undefined) {
      updates.push('out_of_stock = ?');
      params.push(outOfStock ? 1 : 0);
    }

    params.push(req.params.id);
    await execute(`UPDATE products SET ${updates.join(', ')} WHERE id = ?`, params);

    success(res, {});
  } catch (err: any) {
    fail(res, '更新库存失败');
  }
});

// ========== 分类列表 ==========
router.get('/categories/list', async (_req: Request, res: Response) => {
  try {
    const list = await query('SELECT * FROM categories WHERE status = ? ORDER BY sort_order ASC', ['on']);
    success(res, list);
  } catch (err: any) {
    fail(res, '查询分类失败');
  }
});

// ========== 新增分类 ==========
router.post('/categories', authMiddleware, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { name, icon, sortOrder } = req.body;
    if (!name) {
      fail(res, '分类名称不能为空');
      return;
    }
    const result = await execute(
      'INSERT INTO categories (name, icon, sort_order, merchant_id) VALUES (?, ?, ?, ?)',
      [name.trim(), icon || '', sortOrder || 0, 1],
    );
    created(res, { categoryId: result.insertId });
  } catch (err: any) {
    fail(res, '创建分类失败');
  }
});

// ========== 删除分类 ==========
router.delete('/categories/:id', authMiddleware, requireAdmin, async (req: Request, res: Response) => {
  try {
    // 检查分类下是否有商品
    const count = await queryOne<{ cnt: number }>(
      'SELECT COUNT(*) as cnt FROM products WHERE category_id = ?',
      [req.params.id],
    );
    if (count && count.cnt > 0) {
      fail(res, '该分类下还有商品，无法删除');
      return;
    }
    await execute('DELETE FROM categories WHERE id = ?', [req.params.id]);
    success(res, {});
  } catch (err: any) {
    fail(res, '删除分类失败');
  }
});

// ========== 分类排序 ==========
router.put('/categories/sort', authMiddleware, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { items } = req.body; // [{id, sortOrder}, ...]
    if (!items || !Array.isArray(items)) {
      fail(res, '参数无效');
      return;
    }
    for (const item of items) {
      await execute('UPDATE categories SET sort_order = ? WHERE id = ?', [item.sortOrder, item.id]);
    }
    success(res, {});
  } catch (err: any) {
    fail(res, '更新排序失败');
  }
});

export default router;
