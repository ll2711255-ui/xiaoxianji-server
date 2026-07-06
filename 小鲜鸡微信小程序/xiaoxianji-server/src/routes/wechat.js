const express = require('express');
const router = express.Router();
const { verifyCallbackSign, decryptNotify } = require('../wechat/payClient');
const { callbackLimiter } = require('../middleware/rateLimiter');
const logger = require('../utils/logger');
const prisma = require('../db');

// ========== 微信 access_token 缓存（有效期2小时，提前5分钟刷新） ==========
let cachedAccessToken = null;
let accessTokenExpiresAt = 0;

async function getWxAccessToken() {
  const now = Date.now();
  if (cachedAccessToken && now < accessTokenExpiresAt) {
    return cachedAccessToken;
  }
  const axios = require('axios');
  const tokenRes = await axios.get(
    `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${process.env.WX_APPID}&secret=${process.env.WX_APP_SECRET}`
  );
  if (tokenRes.data.access_token) {
    cachedAccessToken = tokenRes.data.access_token;
    accessTokenExpiresAt = now + (tokenRes.data.expires_in - 300) * 1000; // 提前5分钟刷新
    logger.info('[wechat] access_token 已刷新');
    return cachedAccessToken;
  }
  throw new Error('获取 access_token 失败: ' + JSON.stringify(tokenRes.data));
}

// ========== 原始请求体由全局 express.json({ verify }) 保存在 req.rawBody ==========

// ============================================================
// POST /api/wechat/pay-callback — 微信支付回调通知
// ============================================================
router.post('/pay-callback', callbackLimiter, async (req, res) => {
  const rawBody = req.rawBody || JSON.stringify(req.body);
  const headers = req.headers;
  const orderNo = req.body?.out_trade_no || '';

  try {
    // 1. 验证回调签名
    const signOk = await verifyCallbackSign(headers, rawBody);
    if (!signOk) {
      logger.error(`[payCallback] 签名验证失败: ${orderNo}`);
      await logPayment(orderNo, 'pay_callback', rawBody, 'SIGN_FAILED', '签名验证失败');
      return res.status(200).json({ code: 'FAIL', message: '签名验证失败' });
    }

    // 2. 解密通知内容
    const resource = req.body?.resource;
    let plaintext;
    try {
      if (resource) {
        // APIv3 格式
        const decrypted = decryptNotify(
          resource.ciphertext,
          resource.nonce,
          resource.associated_data || ''
        );
        plaintext = JSON.parse(decrypted);
      } else {
        // 兼容旧格式
        plaintext = req.body;
      }
    } catch (e) {
      logger.error(`[payCallback] 解密失败: ${orderNo}`, e.message);
      await logPayment(orderNo, 'pay_callback', rawBody, 'DECRYPT_FAILED', e.message);
      return res.status(200).json({ code: 'FAIL', message: '解密失败' });
    }

    // 3. 业务处理
    const { out_trade_no, transaction_id } = plaintext;

    // 查找订单
    const order = await prisma.order.findUnique({ where: { orderNo: out_trade_no } });
    if (!order) {
      logger.error(`[payCallback] 订单不存在: ${out_trade_no}`);
      await logPayment(out_trade_no, 'pay_callback', rawBody, 'ORDER_NOT_FOUND');
      return res.status(200).json({ code: 'FAIL', message: '订单不存在' });
    }

    // 只有 pending 状态的订单才处理支付通知
    if (order.status !== 'pending') {
      logger.info(`[payCallback] 订单${out_trade_no}已处理, 当前状态: ${order.status}`);
      return res.status(200).json({ code: 'SUCCESS' });
    }

    // 更新订单为已支付
    await prisma.order.update({
      where: { orderNo: out_trade_no },
      data: {
        status: 'paid',
        transactionId: transaction_id,
        payTime: new Date(),
      },
    });

    // 更新销量
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

    await logPayment(out_trade_no, 'pay_callback', rawBody, 'SUCCESS');

    // 异步：上报发货信息 + 推送订阅消息
    setImmediate(async () => {
      try {
        await uploadShippingInfo(out_trade_no);
      } catch (_) { /* 不影响主流程 */ }
      try {
        await sendPickupNotify(out_trade_no);
      } catch (_) { /* 不影响主流程 */ }
    });

    logger.info(`[payCallback] ✅ 支付成功: ${out_trade_no}, transactionId=${transaction_id}`);
    return res.status(200).json({ code: 'SUCCESS' });
  } catch (err) {
    logger.error(`[payCallback] 异常: ${orderNo}`, err);
    await logPayment(orderNo, 'pay_callback', rawBody, 'ERROR', err.message);
    return res.status(500).json({ code: 'FAIL', message: '服务器错误' });
  }
});

// ============================================================
// POST /api/wechat/refund-callback — 退款回调通知
// ============================================================
router.post('/refund-callback', callbackLimiter, async (req, res) => {
  const rawBody = req.rawBody || JSON.stringify(req.body);
  const headers = req.headers;

  try {
    const signOk = await verifyCallbackSign(headers, rawBody);
    if (!signOk) {
      return res.status(200).json({ code: 'FAIL', message: '签名验证失败' });
    }

    const resource = req.body?.resource;
    let plaintext;
    try {
      if (resource) {
        const decrypted = decryptNotify(resource.ciphertext, resource.nonce, resource.associated_data || '');
        plaintext = JSON.parse(decrypted);
      }
    } catch (e) {
      return res.status(200).json({ code: 'FAIL', message: '解密失败' });
    }

    if (!plaintext?.out_trade_no) {
      return res.status(200).json({ code: 'FAIL' });
    }

    const status = plaintext.refund_status;
    const refundStatus = status === 'SUCCESS' ? 'success' : status === 'PROCESSING' ? 'processing' : 'failed';

    await prisma.order.updateMany({
      where: {
        orderNo: plaintext.out_trade_no,
        refundStatus: { in: ['processing', 'none'] },
      },
      data: {
        refundStatus,
        refundInfo: {
          refundId: plaintext.refund_id,
          successTime: plaintext.success_time || null,
          refundAmount: plaintext.amount?.refund || 0,
        },
      },
    });

    logger.info(`[refundCallback] 退款${refundStatus}: ${plaintext.out_trade_no}`);
    return res.status(200).json({ code: 'SUCCESS' });
  } catch (err) {
    logger.error(`[refundCallback] 异常:`, err);
    return res.status(500).json({ code: 'FAIL' });
  }
});

// ============================================================
// POST /api/wechat/shipping-upload — 发货信息上报
// ============================================================
router.post('/shipping-upload', async (req, res) => {
  try {
    const result = await uploadShippingInfo(req.body.orderNo);
    res.json({ success: true, ...result });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// ========== 辅助函数 ==========

/**
 * 发货信息上报（微信物流）
 */
async function uploadShippingInfo(orderNo) {
  const order = await prisma.order.findUnique({
    where: { orderNo },
    include: { items: true },
  });

  if (!order || order.type === 'pickup' || order.shippingUploaded) return { skipped: true };

  // 获取用户手机号（取后4位）
  const user = await prisma.user.findUnique({ where: { id: order.userId || 0 } }).catch(() => null);
  const phone = user?.phone ? user.phone.slice(-4) : '';

  // 调用微信发货信息上传 API
  const { v3Request } = require('../wechat/payClient');
  const result = await v3Request('POST', `/v3/merchant/fund/withdraw/bill`, {
    out_trade_no: orderNo,
    logistics_type: 4, // 同城配送
    delivery_mode: 1,
    shipping_time: new Date().toISOString(),
    recevier: {
      phone: phone || undefined,
    },
  });

  if (result.status === 200 || result.status === 204) {
    await prisma.order.update({
      where: { orderNo },
      data: { shippingUploaded: true },
    });
    return { uploaded: true };
  }
  throw new Error(`上传失败: ${result.status}`);
}

/**
 * 推送订阅消息（取货通知）
 */
async function sendPickupNotify(orderNo) {
  const order = await prisma.order.findUnique({ where: { orderNo } });
  if (!order?.userId || order.type === 'offline') return;

  const user = await prisma.user.findUnique({ where: { id: order.userId } });
  if (!user?.openid || user.openid.startsWith('merchant_')) return;

  // 获取 access_token（带缓存，避免耗尽每日调用配额）
  let accessToken;
  try {
    accessToken = await getWxAccessToken();
  } catch (err) {
    logger.warn('获取 access_token 失败，跳过推送:', err.message);
    return;
  }

  // 发送订阅消息
  const statusText = {
    pending: '待支付', paid: '已支付', accepted: '商家已接单',
    weighed: '已称重', processing: '制作中', ready: '待取货',
    delivering: '配送中', completed: '已完成', cancelled: '已取消',
  };

  await axios.post(
    `https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token=${accessToken}`,
    {
      touser: user.openid,
      template_id: '', // TODO: 配置实际模板ID
      page: `/pages/orders/detail/detail?orderNo=${orderNo}`,
      data: {
        character_string1: { value: orderNo },
        phrase2: { value: statusText[order.status] || order.status },
        thing3: { value: order.cardNumber || '无' },
      },
    }
  ).catch(err => logger.warn(`订阅消息发送失败: ${err.message}`));
}

async function logPayment(orderNo, eventType, rawBody, status, errorMsg) {
  try {
    // 脱敏：仅保存元数据，不保存加密的 ciphertext 原文
    let safeBody = '';
    try {
      const parsed = typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody;
      if (parsed?.resource) {
        safeBody = JSON.stringify({
          ...parsed,
          resource: {
            algorithm: parsed.resource.algorithm,
            original_type: parsed.resource.original_type,
            ciphertext: '[REDACTED_' + (parsed.resource.ciphertext?.length || 0) + 'bytes]',
            associated_data: parsed.resource.associated_data,
            nonce: parsed.resource.nonce,
          },
        });
      } else {
        safeBody = rawBody?.substring?.(0, 4096) || '';
      }
    } catch (_) {
      safeBody = rawBody?.substring?.(0, 4096) || '';
    }
    await prisma.paymentLog.create({
      data: {
        orderNo,
        eventType,
        rawBody: safeBody,
        status,
        errorMsg: errorMsg || null,
      },
    });
  } catch (_) { /* 日志记录失败不影响主流程 */ }
}

module.exports = router;
