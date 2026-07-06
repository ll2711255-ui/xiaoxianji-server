/**
 * 微信支付回调路由（公网接收微信推送）
 *
 *   POST /api/v1/callback/pay    — 支付成功回调
 *   POST /api/v1/callback/refund — 退款成功回调
 *
 * 注意：此路由不需要 JWT 鉴权，由微信服务器直接调用
 *       签名验证在路由内部完成
 */
import { Router, Request, Response } from 'express';
import { verifyCallbackSign, decryptCallbackResource } from '../services/payment';
import { uploadShippingInfo } from '../services/shipping';
import { queryOne, execute } from '../models/db';

const router = Router();

// ---------- 支付回调 ----------
router.post('/pay', async (req: Request, res: Response) => {
  try {
    const rawBody = JSON.stringify(req.body);
    const headers = req.headers as Record<string, string>;

    // APIv3 签名验证
    const isApiV3 = headers['wechatpay-signature'] && headers['wechatpay-timestamp'];
    if (isApiV3) {
      const signOk = await verifyCallbackSign(headers, rawBody);
      if (!signOk) {
        console.error('[callback] 签名验证失败！');
        res.json({ code: 'FAIL', message: '签名验证失败' });
        return;
      }
      console.log('[callback] 签名验证通过');
    }

    // 解析回调数据
    let outTradeNo: string;
    let transactionId: string;

    if (req.body.resource?.ciphertext) {
      const resourceData = decryptCallbackResource(req.body.resource);
      outTradeNo = resourceData.out_trade_no;
      transactionId = resourceData.transaction_id;

      if (resourceData.trade_state !== 'SUCCESS') {
        res.json({ code: 'SUCCESS', message: '非支付成功状态' });
        return;
      }
    } else {
      outTradeNo = req.body.outTradeNo || req.body.OutTradeNo;
      transactionId = req.body.transactionId || req.body.TransactionId || '';
    }

    if (!outTradeNo) {
      res.json({ code: 'FAIL', message: '缺少订单号' });
      return;
    }

    // 更新订单
    const order = await queryOne<any>('SELECT * FROM orders WHERE order_no = ?', [outTradeNo]);
    if (!order) {
      res.json({ code: 'FAIL', message: '订单不存在' });
      return;
    }

    if (order.status !== 'pending') {
      res.json({ code: 'SUCCESS', message: '已处理（幂等）' });
      return;
    }

    await execute(
      'UPDATE orders SET status = ?, pay_time = NOW(), transaction_id = ? WHERE order_no = ?',
      ['paid', transactionId, outTradeNo],
    );

    console.log(`[callback] 支付成功: ${outTradeNo} → ${transactionId}`);

    // 自动上报发货信息（合规强制）
    try {
      await uploadShippingInfo({
        transactionId,
        outTradeNo,
        shippingMethod: order.shipping_method || 'express',
        deliveryAddress: typeof order.delivery_address === 'string'
          ? JSON.parse(order.delivery_address)
          : order.delivery_address,
      });
    } catch (e: any) {
      console.warn('[callback] 发货上报失败:', e.message);
    }

    res.json({ code: 'SUCCESS', message: 'OK' });
  } catch (err: any) {
    console.error('[callback] 处理失败:', err.message);
    res.json({ code: 'FAIL', message: err.message });
  }
});

// ---------- 退款回调 ----------
router.post('/refund', async (req: Request, res: Response) => {
  try {
    const rawBody = JSON.stringify(req.body);
    const headers = req.headers as Record<string, string>;

    // 验签
    const isApiV3 = headers['wechatpay-signature'] && headers['wechatpay-timestamp'];
    if (isApiV3) {
      const signOk = await verifyCallbackSign(headers, rawBody);
      if (!signOk) {
        res.json({ code: 'FAIL', message: '签名验证失败' });
        return;
      }
    }

    let outTradeNo: string;
    let refundStatus: string;

    if (req.body.resource?.ciphertext) {
      const data = decryptCallbackResource(req.body.resource);
      outTradeNo = data.out_trade_no;
      refundStatus = data.refund_status;
    } else {
      outTradeNo = req.body.outTradeNo || req.body.out_trade_no || '';
      refundStatus = req.body.refundStatus || '';
    }

    if (!outTradeNo) {
      res.json({ code: 'FAIL', message: '缺少订单号' });
      return;
    }

    if (refundStatus === 'SUCCESS') {
      const order = await queryOne<any>('SELECT * FROM orders WHERE order_no = ?', [outTradeNo]);
      if (order) {
        const refundInfo = typeof order.refund_info === 'string'
          ? JSON.parse(order.refund_info)
          : (order.refund_info || {});

        refundInfo.status = 'success';
        refundInfo.successTime = new Date();

        await execute(
          'UPDATE orders SET refund_status = ?, refund_info = ? WHERE order_no = ?',
          ['success', JSON.stringify(refundInfo), outTradeNo],
        );

        // 全额退款 → 订单取消
        if (order.refund_amount >= order.prepay_amount) {
          await execute('UPDATE orders SET status = ? WHERE order_no = ?', ['cancelled', outTradeNo]);
        }
      }
    }

    res.json({ code: 'SUCCESS', message: 'OK' });
  } catch (err: any) {
    console.error('[callback] 退款回调失败:', err.message);
    res.json({ code: 'FAIL', message: err.message });
  }
});

export default router;
