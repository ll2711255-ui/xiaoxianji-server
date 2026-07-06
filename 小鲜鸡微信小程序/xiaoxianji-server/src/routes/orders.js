const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { auth } = require('../middleware/auth');
const { calculatePrice } = require('../services/pricing');
const { generateOrderNo } = require('../services/orderNoGenerator');
const { buildPayParams, v3Request } = require('../wechat/payClient');
const logger = require('../utils/logger');
const prisma = require('../db');
const TOKEN_SECRET = process.env.TOKEN_SECRET || crypto.randomBytes(32).toString('hex');
const API_DOMAIN = process.env.API_DOMAIN || 'https://api.xuaioxianji.top';
const PAY_NOTIFY_URL = API_DOMAIN + '/api/wechat/pay-callback';

// ============================================================
// POST /api/orders — 创建订单（核心）
// ============================================================
router.post('/', auth(), async (req, res) => {
  try {
    const { items, addressId, deliveryAddress: addrObj, type, pickupTime, deliveryTime, isScheduled, scheduledDate, scheduledTime } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.fail('订单商品不能为空');
    }
    if (!type || !['delivery', 'pickup'].includes(type)) {
      return res.fail('请选择履约方式');
    }

    // 获取商户配置
    const merchant = await prisma.merchant.findFirst();
    if (!merchant) return res.fail('店铺未配置');

    // 获取配送地址（兼容 addressId 和 deliveryAddress 两种传入方式）
    let deliveryAddress = null;
    if (type === 'delivery') {
      if (addrObj && addrObj.name) {
        // 客户端直接传地址对象（wx.chooseAddress 结果）
        deliveryAddress = {
          name: addrObj.name,
          phone: addrObj.phone,
          province: addrObj.province || '',
          city: addrObj.city || '',
          district: addrObj.district || '',
          detail: addrObj.detail || '',
        };
      } else if (addressId) {
        // 兼容旧方式：传入已存储的地址 ID
        const addr = await prisma.address.findUnique({ where: { id: BigInt(addressId) } });
        if (!addr || addr.userId !== BigInt(req.user.userId)) {
          return res.failNotFound('地址不存在');
        }
        deliveryAddress = {
          name: addr.name,
          phone: addr.phone,
          province: addr.province,
          city: addr.city,
          district: addr.district,
          detail: addr.detail,
        };
      } else {
        return res.fail('配送地址不能为空');
      }
    }

    // 解析预约时间（兼容 scheduledDate+scheduledTime 与 pickupTime/deliveryTime）
    let resolvedPickupTime = pickupTime;
    let resolvedDeliveryTime = deliveryTime;
    if (isScheduled && scheduledDate && scheduledTime) {
      // scheduledTime 格式如 "08:00-10:00"，取起始时间
      const startTime = scheduledTime.split('-')[0] || '00:00';
      const isoStr = scheduledDate + 'T' + startTime + ':00+08:00';
      if (type === 'pickup') {
        resolvedPickupTime = isoStr;
      } else {
        resolvedDeliveryTime = isoStr;
      }
    }

    // 服务端计价
    const appId = process.env.WX_APPID;
    const pricedItems = [];
    let totalAmount = 0;

    for (const item of items) {
      const priceResult = await calculatePrice(item, Number(merchant.id));
      if (!priceResult.valid) {
        return res.fail(`商品"${priceResult.productName}"${priceResult.error}`);
      }
      pricedItems.push(priceResult);
      totalAmount += priceResult.itemAmount;
    }

    // 校验最低金额（1分）
    if (totalAmount < 1) return res.fail('订单金额不能为0');

    // 生成订单号
    const orderNo = await generateOrderNo(prisma);

    // 写入订单
    const order = await prisma.order.create({
      data: {
        orderNo,
        userId: req.user.userId,
        merchantId: merchant.id,
        type,
        prepayAmount: totalAmount,
        status: 'pending',
        deliveryAddress: deliveryAddress || undefined,
        deliveryTime: resolvedDeliveryTime ? new Date(resolvedDeliveryTime) : undefined,
        pickupTime: resolvedPickupTime ? new Date(resolvedPickupTime) : undefined,
        // 生成取货 token
        token: crypto.createHash('sha256')
          .update(orderNo + TOKEN_SECRET)
          .digest('hex')
          .substring(0, 8),
        items: {
          create: pricedItems.map((pi) => ({
            productId: BigInt(pi.productId),
            productName: pi.productName,
            pricingType: pi.pricingType,
            spec: pi.spec,
            quantity: pi.quantity || 1,
            itemAmount: pi.itemAmount,
          })),
        },
      },
      include: { items: true },
    });

    // 调用微信支付 APIv3 JSAPI 下单
    let payment;
    try {
      const wxOrder = await v3Request('POST', '/v3/pay/transactions/jsapi', {
        appid: appId,
        mchid: process.env.WXPAY_MCHID,
        description: (pricedItems.map((p) => p.productName).join('、') || '小鲜鸡生鲜订单').substring(0, 127),
        out_trade_no: orderNo,
        notify_url: PAY_NOTIFY_URL,
        amount: { total: totalAmount, currency: 'CNY' },
        payer: { openid: req.user.openid },
      });

      if (wxOrder.status !== 200 || !wxOrder.data?.prepay_id) {
        throw new Error(wxOrder.data?.message || '获取prepay_id失败');
      }

      payment = buildPayParams(wxOrder.data.prepay_id, appId);
    } catch (payErr) {
      logger.error('微信支付下单失败:', payErr.message);
      // 订单保留为 pending，用户可重试支付
      return res.status(400).json({
        success: false,
        error: '支付下单失败，请稍后重试',
        code: 'PAY_FAILED',
        orderNo,
      });
    }

    logger.info(`订单创建: ${orderNo}, 金额: ${totalAmount}分`);
    res.ok({ orderNo, payment, totalAmount });
  } catch (err) {
    logger.error('createOrder错误:', err);
    res.failServerError('创建订单失败');
  }
});

// ============================================================
// GET /api/orders — 订单列表（分页）
// ============================================================
router.get('/', auth(), async (req, res) => {
  try {
    const { page = 1, page_size = 10, type: orderType } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const pageSize = Math.min(50, Math.max(1, parseInt(page_size, 10) || 10));

    const where = { userId: req.user.userId };
    if (orderType === 'active') {
      where.status = { in: ['pending', 'paid', 'accepted', 'weighed', 'processing', 'ready', 'delivering'] };
    } else if (orderType === 'completed') {
      where.status = 'completed';
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: { items: true },
        orderBy: { createdAt: 'desc' },
        skip: (pageNum - 1) * pageSize,
        take: pageSize,
      }),
      prisma.order.count({ where }),
    ]);

    const list = orders.map(formatOrder);

    res.okPaginated(list, { page: pageNum, pageSize, total });
  } catch (err) {
    logger.error('getOrders错误:', err);
    res.failServerError('获取订单列表失败');
  }
});

// ============================================================
// GET /api/orders/:orderNo — 订单详情
// ============================================================
router.get('/:orderNo', auth(), async (req, res) => {
  try {
    const order = await prisma.order.findUnique({
      where: { orderNo: req.params.orderNo },
      include: { items: true },
    });
    if (!order) return res.failNotFound('订单不存在');

    // 权限：顾客看自己的，商家看同商户的
    if (req.user.role === 'customer' && order.userId !== BigInt(req.user.userId)) {
      return res.failForbidden('无权查看该订单');
    }
    if (['merchant', 'admin'].includes(req.user.role) && order.merchantId !== BigInt(req.user.merchantId)) {
      return res.failForbidden('无权查看该订单');
    }

    res.ok(formatOrder(order));
  } catch (err) {
    logger.error('getOrderDetail错误:', err);
    res.failServerError('获取订单详情失败');
  }
});

// ============================================================
// POST /api/orders/:orderNo/cancel — 取消订单
// ============================================================
router.post('/:orderNo/cancel', auth(), async (req, res) => {
  try {
    const order = await prisma.order.findUnique({ where: { orderNo: req.params.orderNo } });
    if (!order) return res.failNotFound('订单不存在');
    if (order.userId !== BigInt(req.user.userId)) return res.failForbidden('无权操作');

    // 确定允许取消的状态
    const allowedStatuses = order.type === 'offline'
      ? ['processing', 'ready']
      : ['pending', 'paid'];  // 线上订单（简化为可取消状态）

    if (!allowedStatuses.includes(order.status)) {
      return res.fail(`当前状态(${order.status})不允许取消`);
    }

    // 如果已支付，调用微信 APIv3 退款接口
    let refundStatus = 'none';
    if (order.status === 'paid' && order.transactionId) {
      try {
        const outRefundNo = order.orderNo + '_cancel_' + Date.now();
        const refundResult = await v3Request('POST', '/v3/refund/domestic/refunds', {
          transaction_id: order.transactionId,
          out_refund_no: outRefundNo,
          amount: {
            refund: order.prepayAmount,
            total: order.prepayAmount,
            currency: 'CNY',
          },
          reason: '订单取消退款',
        });

        if (refundResult.status === 200 && refundResult.data?.status === 'SUCCESS') {
          refundStatus = 'success';
          logger.info(`订单${order.orderNo}退款成功: ${outRefundNo}`);
        } else {
          refundStatus = 'processing'; // 退款处理中，由 refund-callback 确认
          logger.info(`订单${order.orderNo}退款处理中: ${outRefundNo}, status=${refundResult.data?.status}`);
        }
      } catch (refundErr) {
        logger.error(`订单${order.orderNo}退款失败:`, refundErr.message);
        refundStatus = 'failed';
      }
    }

    await prisma.order.update({
      where: { orderNo: req.params.orderNo },
      data: {
        status: 'cancelled',
        cancelTime: new Date(),
        refundStatus,
      },
    });

    // 释放号码牌
    if (order.cardNumber) {
      await prisma.paiNumber.updateMany({
        where: { number: order.cardNumber, merchantId: order.merchantId },
        data: { status: 'idle', orderId: null },
      });
    }

    res.ok({ cancelled: true });
  } catch (err) {
    logger.error('cancelOrder错误:', err);
    res.failServerError('取消订单失败');
  }
});

// ============================================================
// POST /api/orders/:orderNo/pay — 重新发起支付（或模拟支付）
// ============================================================
router.post('/:orderNo/pay', auth(), async (req, res) => {
  try {
    const order = await prisma.order.findUnique({ where: { orderNo: req.params.orderNo } });
    if (!order) return res.failNotFound('订单不存在');
    if (order.status !== 'pending') return res.fail('订单状态不允许支付');
    if (order.userId !== BigInt(req.user.userId)) return res.failForbidden('无权操作');

    // ========== Mock 支付（开发/模拟器模式） ==========
    if (req.body.mockPay) {
      const mockTransactionId = 'mock_' + Date.now();
      await prisma.order.update({
        where: { orderNo: req.params.orderNo },
        data: {
          status: 'paid',
          transactionId: mockTransactionId,
          payTime: new Date(),
        },
      });

      // 模拟支付也更新销量
      const orderItems = await prisma.orderItem.findMany({
        where: { orderId: order.id },
      });
      for (const item of orderItems) {
        if (item.productId) {
          await prisma.product.update({
            where: { id: item.productId },
            data: { sales: { increment: 1 } },
          }).catch(() => {});
        }
      }

      logger.info(`[mockPay] 模拟支付成功: ${req.params.orderNo}`);
      return res.ok({ orderNo: req.params.orderNo, status: 'paid', mockPay: true });
    }

    // ========== 真实微信支付 ==========
    const appId = process.env.WX_APPID;
    const wxOrder = await v3Request('POST', '/v3/pay/transactions/jsapi', {
      appid: appId,
      mchid: process.env.WXPAY_MCHID,
      description: '小鲜鸡订单',
      out_trade_no: order.orderNo,
      notify_url: PAY_NOTIFY_URL,
      amount: { total: order.prepayAmount, currency: 'CNY' },
      payer: { openid: req.user.openid },
    });

    if (wxOrder.status !== 200 || !wxOrder.data?.prepay_id) {
      return res.fail('获取支付参数失败，请稍后重试', 'PAY_FAILED');
    }

    const payment = buildPayParams(wxOrder.data.prepay_id, appId);
    res.ok({ payment });
  } catch (err) {
    logger.error('retryPayment错误:', err);
    res.failServerError('发起支付失败');
  }
});

// ========== 辅助函数 ==========
function formatOrder(order) {
  return {
    ...order,
    id: Number(order.id),
    userId: order.userId ? Number(order.userId) : null,
    merchantId: Number(order.merchantId),
    items: (order.items || []).map((i) => ({
      ...i,
      id: Number(i.id),
      orderId: Number(i.orderId),
      productId: i.productId ? Number(i.productId) : null,
    })),
  };
}

module.exports = router;
