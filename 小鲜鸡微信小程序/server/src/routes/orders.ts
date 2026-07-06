/**
 * 订单路由 — 核心业务模块（三端共用）
 *
 *   POST   /orders              — C 端创建订单（线上，含支付下单）
 *   POST   /orders/offline      — 收银端创建线下订单
 *   GET    /orders              — 订单列表（分页+筛选）
 *   GET    /orders/:orderNo     — 订单详情
 *   PATCH  /orders/:orderNo/status  — 状态流转
 *   PATCH  /orders/:orderNo/weigh   — 称重录入
 *   PATCH  /orders/:orderNo/ship    — 发货（录物流单号）
 *   PATCH  /orders/:orderNo/pickup  — 确认自提取货
 *   POST   /orders/:orderNo/refund  — 发起退款
 *   POST   /orders/:orderNo/rebuy   — 再来一单
 */
import { Router, Request, Response } from 'express';
import { success, fail, created } from '../utils/response';
import { query, queryOne, execute, queryPage } from '../models/db';
import { authMiddleware } from '../middleware/auth';
import { requireAdmin, requireCashier } from '../middleware/role';
import { createJsapiOrder, buildPayParams } from '../services/payment';
import { config } from '../config';
import crypto from 'crypto';

const router = Router();

// ========== 工具函数 ==========

/** 生成全网唯一订单号：字母(A-Z) + 5位数字，事务原子递增 */
async function generateOrderNo(): Promise<string> {
  const conn = await (await import('../models/db')).default.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.query('SELECT letter_idx, seq FROM counters WHERE `key` = ? FOR UPDATE', ['order']);
    let letterIdx = 0;
    let seq = 0;

    if (Array.isArray(rows) && rows.length > 0) {
      const row = rows[0] as any;
      letterIdx = row.letter_idx || 0;
      seq = (row.seq || 0) + 1;

      if (seq > 99999) {
        letterIdx = (letterIdx + 1) % 26;
        seq = 0;
      }

      await conn.query('UPDATE counters SET letter_idx = ?, seq = ? WHERE `key` = ?', [letterIdx, seq, 'order']);
    } else {
      await conn.query('INSERT INTO counters (`key`, letter_idx, seq) VALUES (?, ?, ?)', ['order', 0, 0]);
    }

    await conn.commit();

    const letter = String.fromCharCode(65 + letterIdx);
    return letter + String(seq).padStart(5, '0');
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// ========== 状态流转规则 ==========

const TRANSITIONS: Record<string, { from: string[]; to: string }> = {
  accept:  { from: ['paid'],              to: 'accepted' },
  process: { from: ['weighed', 'paid'],   to: 'processing' },
  ready:   { from: ['processing'],        to: 'ready' },
  deliver: { from: ['ready'],             to: 'delivering' },
  complete:{ from: ['delivering','ready'], to: 'completed' },
  markPaid:{ from: ['ready'],             to: 'paid' },
};

// ========== C 端创建订单 ==========

router.post('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { items, type, deliveryAddress, isScheduled, scheduledDate, scheduledTime } = req.body;
    const userId = req.user!.userId;
    const openid = req.user!.openid;

    // 参数校验
    if (!items || items.length === 0) {
      fail(res, '商品不能为空');
      return;
    }
    if (!type || !['delivery', 'pickup'].includes(type)) {
      fail(res, '取货方式无效');
      return;
    }
    if (type === 'delivery' && !deliveryAddress) {
      fail(res, '配送订单缺少收货地址');
      return;
    }

    // 服务端计价 + 商品校验
    let totalFen = 0;
    const validatedItems: any[] = [];

    for (const item of items) {
      const [product] = await query('SELECT * FROM products WHERE id = ?', [item.productId]);
      if (!product) {
        fail(res, `商品 "${item.productName || item.productId}" 不存在或已下架`);
        return;
      }

      let unitPrice = 0;

      if (item.pricingType === 'range_weight') {
        const spec = item.spec || {};
        const matched = ((product as any).specs || []).find(
          (s: any) => s.type === spec.type && s.weight_label === spec.weight,
        );
        if (!matched) {
          fail(res, `商品 "${product.name}" 规格不匹配`);
          return;
        }
        const processingFee = spec.processing === '切块' ? (matched.processing_fee || (product as any).processing_fee || 0) : 0;
        unitPrice = Math.round(((matched.price_per_jin || 0) * (matched.weight_max || 500)) / 500) + processingFee;
      } else if (item.pricingType === 'exact_weight') {
        const grams = (item.spec && item.spec.weightGrams) || 500;
        const processingFee = (item.spec && item.spec.processing === '切块') ? ((product as any).processing_fee || 0) : 0;
        unitPrice = Math.round(((product as any).price_per_jin * grams) / 500) + processingFee;
      } else {
        const processingFee = (item.spec && item.spec.processing === '切块') ? ((product as any).processing_fee || 0) : 0;
        unitPrice = ((product as any).unit_price || 0) + processingFee;
      }

      totalFen += unitPrice * item.quantity;

      validatedItems.push({
        productId: item.productId,
        productName: product.name,
        pricingType: item.pricingType,
        spec: item.spec || {},
        quantity: item.quantity,
        unitPrice,
      });
    }

    if (totalFen <= 0) {
      fail(res, '订单金额计算异常');
      return;
    }

    // 生成订单号 + 插入订单
    const orderNo = await generateOrderNo();

    const orderData: any = {
      order_no: orderNo,
      user_id: userId,
      type,
      status: 'pending',
      items: JSON.stringify(validatedItems),
      prepay_amount: totalFen,
      delivery_fee: 0,
      is_scheduled: isScheduled ? 1 : 0,
      scheduled_date: scheduledDate || '',
      scheduled_time: scheduledTime || '',
      shipping_method: type === 'delivery' ? 'express' : 'self_pickup',
    };

    if (type === 'delivery') {
      orderData.delivery_address = JSON.stringify(deliveryAddress);
    }

    await execute(
      `INSERT INTO orders (order_no, user_id, type, status, items, prepay_amount, delivery_fee,
        is_scheduled, scheduled_date, scheduled_time, shipping_method, delivery_address)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        orderNo, userId, type, 'pending', JSON.stringify(validatedItems), totalFen, 0,
        isScheduled ? 1 : 0, scheduledDate || '', scheduledTime || '',
        type === 'delivery' ? 'express' : 'self_pickup',
        type === 'delivery' ? JSON.stringify(deliveryAddress) : null,
      ],
    );

    // APIv3 JSAPI 下单
    const payResult = await createJsapiOrder({
      appId: config.wx.appId,
      openid: openid || '',
      outTradeNo: orderNo,
      totalFen,
      description: '小鲜鸡-新鲜生鲜',
    });

    if ('prepayId' in payResult) {
      const payment = buildPayParams(payResult.prepayId, config.wx.appId);
      success(res, { orderNo, payment });
    } else {
      success(res, { orderNo, payment: null, payError: payResult.error });
    }
  } catch (err: any) {
    console.error('[orders] 创建订单失败:', err.message);
    fail(res, err.message || '创建订单失败');
  }
});

// ========== 收银端创建线下订单 ==========

router.post('/offline', authMiddleware, requireCashier, async (req: Request, res: Response) => {
  try {
    const { amount, cardNumber, paymentType } = req.body;
    if (!amount || amount <= 0) {
      fail(res, '缺少金额');
      return;
    }
    if (!cardNumber) {
      fail(res, '缺少号码牌');
      return;
    }

    const orderNo = await generateOrderNo();

    // 绑定号码牌（原子操作）
    const cardUpdate = await execute(
      'UPDATE pai_numbers SET status = ?, order_id = ? WHERE number = ? AND status = ?',
      ['in_use', orderNo, cardNumber, 'idle'],
    );
    if (cardUpdate.affectedRows === 0) {
      fail(res, '该号码牌已被使用，请重新选择');
      return;
    }

    await execute(
      `INSERT INTO orders (order_no, type, status, prepay_amount, actual_amount, card_number, payment_type, items)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [orderNo, 'offline', 'paid', amount, amount, cardNumber, paymentType || 'cash', '[]'],
    );

    // 自动进入处理中
    await execute('UPDATE orders SET status = ? WHERE order_no = ?', ['processing', orderNo]);

    success(res, { orderNo, cardNumber });
  } catch (err: any) {
    console.error('[orders] 创建线下订单失败:', err.message);
    fail(res, '创建订单失败');
  }
});

// ========== 订单列表 ==========

router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { status, type, page = '1', pageSize = '20', startDate, endDate, keyword } = req.query;
    const p = parseInt(page as string, 10);
    const ps = Math.min(parseInt(pageSize as string, 10), 100);
    const { user } = req;

    let where = 'WHERE 1=1';
    const params: any[] = [];

    // C 端用户只能看自己的订单
    if (user!.role === 'customer') {
      where += ' AND user_id = ?';
      params.push(user!.userId);
    }

    if (status === 'pending') {
      where += ' AND status = ?';
      params.push('pending');
    } else if (status === 'paid') {
      where += ' AND status = ?';
      params.push('paid');
    } else if (status === 'active') {
      where += ' AND status IN (?, ?, ?, ?, ?)';
      params.push('accepted', 'weighed', 'processing', 'ready', 'paid');
    } else if (status === 'completed') {
      where += ' AND status IN (?, ?)';
      params.push('completed', 'cancelled');
    } else if (status) {
      where += ' AND status = ?';
      params.push(status);
    }

    if (type === 'online') {
      where += ' AND type != ?';
      params.push('offline');
    } else if (type === 'offline') {
      where += ' AND type = ?';
      params.push('offline');
    }

    if (startDate) {
      where += ' AND created_at >= ?';
      params.push(startDate);
    }
    if (endDate) {
      where += ' AND created_at <= ?';
      params.push(endDate);
    }
    if (keyword) {
      where += ' AND (order_no LIKE ? OR card_number LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`);
    }

    const { list, total } = await queryPage(
      `SELECT * FROM orders ${where} ORDER BY created_at DESC`,
      params, p, ps,
    );

    success(res, { list, total, page: p, pageSize: ps });
  } catch (err: any) {
    console.error('[orders] 查询列表失败:', err.message);
    fail(res, '查询订单失败');
  }
});

// ========== 订单详情 ==========

router.get('/:orderNo', authMiddleware, async (req: Request, res: Response) => {
  try {
    const order = await queryOne<any>(
      'SELECT * FROM orders WHERE order_no = ?',
      [req.params.orderNo],
    );

    if (!order) {
      fail(res, '订单不存在', 404, 404);
      return;
    }

    // C 端用户只能看自己的订单
    if (req.user!.role === 'customer' && order.user_id !== req.user!.userId) {
      fail(res, '无权查看此订单', 403, 403);
      return;
    }

    success(res, order);
  } catch (err: any) {
    fail(res, '查询订单详情失败');
  }
});

// ========== 状态流转 ==========

router.patch('/:orderNo/status', authMiddleware, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { action } = req.body;
    const { orderNo } = req.params;

    if (!action) {
      fail(res, '缺少操作类型');
      return;
    }

    const rule = TRANSITIONS[action];
    if (!rule) {
      fail(res, `不支持的操作：${action}`);
      return;
    }

    const order = await queryOne<any>('SELECT * FROM orders WHERE order_no = ?', [orderNo]);
    if (!order) {
      fail(res, '订单不存在');
      return;
    }

    if (!rule.from.includes(order.status)) {
      fail(res, `订单状态不允许此操作（当前：${order.status}）`);
      return;
    }

    const updateData: any = { status: rule.to };

    if (action === 'complete') {
      updateData.completed_at = new Date();
      // 释放号码牌
      if (order.card_number) {
        await execute(
          'UPDATE pai_numbers SET status = ?, order_id = ? WHERE number = ?',
          ['idle', '', order.card_number],
        );
      }
    }

    if (action === 'markPaid') {
      updateData.payment_type = 'cash';
    }

    const fields = Object.keys(updateData).map(k => `${k} = ?`).join(', ');
    const values = Object.values(updateData);
    values.push(orderNo);
    await execute(`UPDATE orders SET ${fields} WHERE order_no = ?`, values);

    success(res, { action, fromStatus: order.status, toStatus: rule.to });
  } catch (err: any) {
    fail(res, '操作失败：' + (err.message || '系统异常'));
  }
});

// ========== 称重录入 ==========

router.patch('/:orderNo/weigh', authMiddleware, requireCashier, async (req: Request, res: Response) => {
  try {
    const { orderNo } = req.params;
    const { actualWeight, weighPhotoFileId, cardNumber } = req.body;

    if (!actualWeight) {
      fail(res, '缺少实际重量');
      return;
    }

    const order = await queryOne<any>('SELECT * FROM orders WHERE order_no = ?', [orderNo]);
    if (!order) {
      fail(res, '订单不存在');
      return;
    }

    if (order.status !== 'accepted' && order.status !== 'weighed') {
      fail(res, `当前状态 [${order.status}] 不可称重`);
      return;
    }

    const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
    const item = items[0] || {};
    const spec = item.spec || {};
    const pricingType = item.pricingType || '';

    let pricePerJin = spec.type_price_per_jin || spec.price_per_jin || 0;
    let processingFee = spec.processing_fee || 0;

    // 从 unitPrice 反推单价
    if (!pricePerJin && item.unitPrice && pricingType === 'range_weight') {
      const weightMax = spec.weight_max || 500;
      pricePerJin = Math.round(((item.unitPrice - processingFee) * 500) / weightMax);
    }

    const prepayAmount = order.prepay_amount || 0;
    let actualAmount: number;
    let refundAmount: number;

    if (order.status === 'weighed') {
      // 重试称重
      actualAmount = order.actual_amount || 0;
      refundAmount = order.refund_amount || 0;
      if (!refundAmount && pricingType === 'range_weight') {
        actualAmount = Math.floor((actualWeight / 500) * pricePerJin + processingFee);
        refundAmount = Math.max(0, prepayAmount - actualAmount);
      }
    } else if (pricingType === 'range_weight') {
      actualAmount = Math.floor((actualWeight / 500) * pricePerJin + processingFee);
      refundAmount = Math.max(0, prepayAmount - actualAmount);
    } else {
      actualAmount = prepayAmount;
      refundAmount = 0;
    }

    // 初次称重：绑定号码牌
    if (order.status !== 'weighed' && cardNumber) {
      const cardUpdate = await execute(
        'UPDATE pai_numbers SET status = ?, order_id = ? WHERE number = ? AND status = ?',
        ['in_use', orderNo, cardNumber, 'idle'],
      );
      if (cardUpdate.affectedRows === 0) {
        fail(res, '该号码牌已被使用，请重新选择');
        return;
      }
    }

    const actualWeightJin = parseFloat((actualWeight / 500).toFixed(2));
    const now = new Date();

    const weighInfo = {
      actualWeight,
      actualWeightJin,
      pricePerJin,
      processingFee,
      prepayAmount,
      actualAmount,
      refundAmount,
      weighPhoto: weighPhotoFileId || '',
      weighTime: now,
      staffId: req.user!.userId,
      cardNumber: cardNumber || '',
      pricingType,
    };

    const refundNo = refundAmount > 0 ? `REF${orderNo}_${Date.now()}` : '';
    const refundInfo = {
      refundNo,
      refundAmount,
      status: refundAmount > 0 ? 'processing' : 'none',
      wxRefundId: '',
      refundTime: now,
      successTime: '',
    };

    await execute(
      `UPDATE orders SET
        status = ?, actual_weight = ?, actual_amount = ?, refund_amount = ?,
        weigh_info = ?, refund_info = ?, refund_status = ?, card_number = ?
       WHERE order_no = ?`,
      [
        'weighed', actualWeight, actualAmount, refundAmount,
        JSON.stringify(weighInfo), JSON.stringify(refundInfo),
        refundAmount > 0 ? 'processing' : 'none',
        cardNumber || order.card_number || '',
        orderNo,
      ],
    );

    // 退款
    if (refundAmount > 0) {
      try {
        const { createRefund } = await import('../services/payment');
        const refundResult = await createRefund({
          outTradeNo: orderNo,
          outRefundNo: refundNo,
          totalFen: prepayAmount,
          refundFen: refundAmount,
          reason: '称重差额退款',
        });

        const refundStatus = refundResult.success ? 'success' : 'failed';
        await execute(
          `UPDATE orders SET refund_status = ?, refund_info = ? WHERE order_no = ?`,
          [refundStatus, JSON.stringify({ ...refundInfo, status: refundStatus, wxRefundId: refundResult.refundId || '' }), orderNo],
        );
      } catch (refundErr: any) {
        console.error('[orders] 退款失败:', refundErr.message);
        await execute(
          `UPDATE orders SET refund_status = ? WHERE order_no = ?`,
          ['failed', orderNo],
        );
      }
    }

    success(res, {
      actualWeight,
      actualAmount,
      refundAmount,
      refundStatus: refundAmount > 0 ? 'processing' : 'none',
      cardNumber: cardNumber || order.card_number || '',
    });
  } catch (err: any) {
    console.error('[orders] 称重失败:', err.message);
    fail(res, '称重失败：' + (err.message || '系统异常'));
  }
});

// ========== 发货（录物流单号） ==========

router.patch('/:orderNo/ship', authMiddleware, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { orderNo } = req.params;
    const { trackingNo } = req.body;

    if (!trackingNo) {
      fail(res, '请输入物流单号');
      return;
    }

    // 将订单状态改为 delivering
    if (orderNo === orderNo) {
      const order = await queryOne<any>('SELECT status, transaction_id, delivery_address, shipping_method FROM orders WHERE order_no = ?', [orderNo]);
      if (!order) {
        fail(res, '订单不存在');
        return;
      }
      if (!['ready', 'processing'].includes(order.status)) {
        fail(res, '当前状态不可发货');
        return;
      }

      await execute(
        'UPDATE orders SET status = ?, tracking_no = ? WHERE order_no = ?',
        ['delivering', trackingNo, orderNo],
      );

      // 上报微信发货管理
      if (order.transaction_id) {
        const { uploadShippingInfo } = await import('../services/shipping');
        await uploadShippingInfo({
          transactionId: order.transaction_id,
          outTradeNo: orderNo,
          shippingMethod: order.shipping_method || 'express',
          trackingNo,
          deliveryAddress: order.delivery_address,
        }).catch((e: any) => console.warn('[orders] 发货上报失败:', e.message));
      }
    }

    success(res, { trackingNo });
  } catch (err: any) {
    fail(res, '发货失败');
  }
});

// ========== 确认自提 ==========

router.patch('/:orderNo/pickup', authMiddleware, requireCashier, async (req: Request, res: Response) => {
  try {
    const { orderNo } = req.params;
    const order = await queryOne<any>('SELECT * FROM orders WHERE order_no = ?', [orderNo]);
    if (!order) {
      fail(res, '订单不存在');
      return;
    }

    if (order.type !== 'pickup') {
      fail(res, '该订单非自提订单');
      return;
    }

    await execute(
      'UPDATE orders SET status = ?, pickup_time = NOW() WHERE order_no = ?',
      ['completed', orderNo],
    );

    // 释放号码牌
    if (order.card_number) {
      await execute('UPDATE pai_numbers SET status = ?, order_id = ? WHERE number = ?', ['idle', '', order.card_number]);
    }

    success(res, {});
  } catch (err: any) {
    fail(res, '确认取货失败');
  }
});

// ========== 发起退款 ==========

router.post('/:orderNo/refund', authMiddleware, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { orderNo } = req.params;
    const { reason, amount } = req.body;

    const order = await queryOne<any>('SELECT * FROM orders WHERE order_no = ?', [orderNo]);
    if (!order) {
      fail(res, '订单不存在');
      return;
    }

    if (!['paid', 'accepted', 'weighed'].includes(order.status)) {
      fail(res, '当前状态不可退款');
      return;
    }

    const refundFen = amount || order.prepay_amount;
    const outRefundNo = `REF_${orderNo}_${Date.now()}`;

    const { createRefund } = await import('../services/payment');
    const result = await createRefund({
      outTradeNo: orderNo,
      outRefundNo,
      totalFen: order.prepay_amount,
      refundFen,
      reason: reason || '商家主动退款',
    });

    if (result.success) {
      await execute(
        'UPDATE orders SET refund_status = ?, refund_amount = ? WHERE order_no = ?',
        ['success', refundFen, orderNo],
      );
      success(res, { refundId: result.refundId });
    } else {
      fail(res, result.error || '退款失败');
    }
  } catch (err: any) {
    fail(res, '退款失败：' + (err.message || '系统异常'));
  }
});

// ========== 再来一单 ==========

router.post('/:orderNo/rebuy', authMiddleware, async (req: Request, res: Response) => {
  try {
    const order = await queryOne<any>('SELECT items FROM orders WHERE order_no = ? AND user_id = ?', [
      req.params.orderNo,
      req.user!.userId,
    ]);

    if (!order) {
      fail(res, '订单不存在');
      return;
    }

    const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;

    // 查询当前商品状态
    const productIds = items.map((i: any) => i.productId);
    const products = await query(
      `SELECT id, name, status, out_of_stock FROM products WHERE id IN (${productIds.map(() => '?').join(',')})`,
      productIds,
    );

    const rebuyItems = items.map((item: any) => {
      const product = (products as any[]).find((p: any) => p.id === item.productId);
      return {
        productId: item.productId,
        productName: item.productName,
        pricingType: item.pricingType,
        spec: item.spec,
        quantity: item.quantity,
        available: product && product.status === 'on' && !product.out_of_stock,
      };
    });

    success(res, { items: rebuyItems });
  } catch (err: any) {
    fail(res, '获取失败');
  }
});

export default router;
