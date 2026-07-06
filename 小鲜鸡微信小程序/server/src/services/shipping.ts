/**
 * 微信小程序发货信息上报
 *
 * 合规强制：每一笔支付订单 MUST 调用 uploadShippingInfo
 * 参考：https://developers.weixin.qq.com/miniprogram/dev/platform-capabilities/business-capabilities/order-shipping-mini/order-shipping.html
 */
import { config } from '../config';
import { v3Request } from './payment';

/**
 * 上报发货信息到微信小程序发货管理
 *
 * @param params.transactionId - 微信支付交易单号
 * @param params.outTradeNo     - 商户订单号
 * @param params.shippingMethod - express（快递配送）| self_pickup（门店自提）
 * @param params.trackingNo     - 物流单号（express 时必填）
 * @param params.deliveryAddress - 收件地址 JSON
 */
export async function uploadShippingInfo(params: {
  transactionId: string;
  outTradeNo: string;
  shippingMethod: 'express' | 'self_pickup';
  trackingNo?: string;
  deliveryAddress?: any;
}): Promise<{ success: boolean; error?: string }> {
  const { transactionId, outTradeNo, shippingMethod, trackingNo, deliveryAddress } = params;

  // 构建 upload_time：UTC+8 时间字符串（微信文档要求 RFC3339）
  const now = new Date(Date.now() + 8 * 3600 * 1000);
  const uploadTime = now.toISOString().replace(/\.\d{3}Z$/, '+08:00');

  const body: any = {
    order_key: {
      order_number_type: 1, // 1=商户订单号
      transaction_id: transactionId,
      mchid: config.wxpay.mchId,
      out_trade_no: outTradeNo,
    },
    logistics_type: shippingMethod === 'express' ? 1 : 4, // 1=物流 4=其他（自提）
    delivery_mode: shippingMethod === 'express' ? 1 : 2,  // 1=快递 2=自提/同城
    upload_time: uploadTime,
    payer: {
      openid: '',
    },
  };

  // 快递配送：上传物流信息
  if (shippingMethod === 'express') {
    body.shipping_list = [
      {
        tracking_no: trackingNo || '',
        express_company: '', // 可后续对接快递100
        item_desc: '生鲜商品',
        contact: deliveryAddress
          ? {
              receiver_contact: deliveryAddress.phone || '',
              contact_type: 1, // 1=手机号
            }
          : {},
      },
    ];
  }

  // 自提：不上传物流信息

  console.log('[shipping] 上报发货:', JSON.stringify({ outTradeNo, transactionId, shippingMethod }));

  const result = await v3Request('POST', '/v3/platsolution/marketing/shipping-info/upload', body);

  if (result.status === 200) {
    console.log('[shipping] 上报成功:', outTradeNo);
    return { success: true };
  }

  console.error('[shipping] 上报失败:', JSON.stringify(result));
  return { success: false, error: result.data?.message || '发货上报失败' };
}
