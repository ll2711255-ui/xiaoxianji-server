/**
 * 微信小程序「购物订单」— 配送/物流信息上报
 *
 * 微信支付成功后调用 /wxa/sec/order/upload_shipping_info，
 * 才能在「小程序购物订单」中展示物流信息。
 *
 * 注意：这是小程序端的配送上报（使用 access_token），
 * 与 wxpay.js 中的 V3 发货上报（使用商户证书）是两套不同的 API。
 *
 * 调用方式：异步非阻塞，失败只记日志不影响主流程。
 */

const axios = require('axios');
const db = require('../config/db');
const { getAccessToken, clearAccessTokenCache } = require('./wechat');
const logger = require('./logger');

const WX_SHIPPING_URL = 'https://api.weixin.qq.com/wxa/sec/order/upload_shipping_info';

/**
 * 上传小程序配送信息（同城配送场景）
 *
 * @param {object} params
 * @param {string} params.orderNo        商户订单号
 * @param {string} params.transactionId  微信支付流水号（可选，优先用此定位订单）
 * @param {number} params.shippingStatus 物流状态 0=待发货 1=已发货 2=已收货
 * @param {object} [params.address]      收货地址信息
 * @returns {Promise<{errcode: number, errmsg?: string}>}
 */
async function uploadShoppingOrderShipping({
  orderNo,
  transactionId,
  shippingStatus = 0,
  address = {},
}) {
  // 1. 获取 access_token
  let accessToken;
  try {
    accessToken = await getAccessToken();
  } catch (err) {
    logger.error('[wxShipping] 获取 access_token 失败:', err.message);
    return { errcode: -1, errmsg: 'token 获取失败' };
  }

  // 2. 构建请求体
  const body = {
    order_key: {
      order_number_type: 2,         // 2 = 商户订单号
      out_trade_no: orderNo,
    },
    logistics_type: 2,              // 2 = 同城配送（小鲜鸡业务类型）
    delivery_mode: 1,               // 1 = 统一发货
    shipping_list: [
      {
        tracking_no: orderNo,       // 同城配送用订单号作为追踪号
        express_company: '小鲜鸡自配送',
        item_desc: '生鲜商品',
        contact: {
          consignee_contact: (address && address.phone) || '',
        },
      },
    ],
    upload_time: new Date().toISOString(),
  };

  // 如果有微信交易号，用于精确定位订单
  if (transactionId) {
    body.order_key.transaction_id = transactionId;
  }

  // 3. 调用微信 API
  try {
    const res = await axios.post(
      `${WX_SHIPPING_URL}?access_token=${accessToken}`,
      body,
      { timeout: 15000 }
    );

    logger.info('[wxShipping] 上传配送信息返回:', JSON.stringify(res.data));

    if (res.data.errcode === 0) {
      logger.info(`[wxShipping] ✅ 配送上传成功: ${orderNo}`);
      return { errcode: 0 };
    }

    // token 过期重试
    if (res.data.errcode === 40001 || res.data.errcode === 41001) {
      logger.warn('[wxShipping] access_token 过期，重试...');
      clearAccessTokenCache();
      const newToken = await getAccessToken();

      const res2 = await axios.post(
        `${WX_SHIPPING_URL}?access_token=${newToken}`,
        body,
        { timeout: 15000 }
      );

      if (res2.data.errcode === 0) {
        logger.info(`[wxShipping] ✅ 重试成功: ${orderNo}`);
        return { errcode: 0 };
      }

      logger.warn(`[wxShipping] 重试失败: ${orderNo}`, res2.data.errcode);
      return { errcode: res2.data.errcode, errmsg: res2.data.errmsg || '' };
    }

    logger.warn(`[wxShipping] 上传失败: ${orderNo} errcode=${res.data.errcode}`);
    return { errcode: res.data.errcode, errmsg: res.data.errmsg || '' };

  } catch (err) {
    logger.error(`[wxShipping] 网络错误: ${orderNo}`, err.message);
    return { errcode: -2, errmsg: err.message };
  }
}

/**
 * 异步：支付成功后上传配送信息（从 DB 查订单补充信息后调用 uploadShoppingOrderShipping）
 *
 * 设计为 fire-and-forget：调用方不 await，失败仅记日志。
 *
 * @param {string} orderNo
 * @param {string} transactionId
 */
async function uploadShippingOnPaySuccess(orderNo, transactionId) {
  try {
    const order = await db.queryOne(
      `SELECT o.delivery_address
       FROM order_info o
       WHERE o.order_no = ?`,
      [orderNo]
    );

    if (!order) {
      logger.warn(`[wxShipping] 订单不存在: ${orderNo}`);
      return;
    }

    let address = {};
    if (order.deliveryAddress) {
      try {
        address = typeof order.deliveryAddress === 'string'
          ? JSON.parse(order.deliveryAddress)
          : order.deliveryAddress;
      } catch (_) { /* ignore */ }
    }

    await uploadShoppingOrderShipping({
      orderNo,
      transactionId,
      shippingStatus: 0,   // 待发货
      address,
    });
  } catch (err) {
    logger.error(`[wxShipping] 支付后上传异常: ${orderNo}`, err.message);
  }
}

/**
 * 异步：发货后更新配送状态
 * @param {string} orderNo
 */
async function updateShippingOnDeliver(orderNo) {
  try {
    await uploadShoppingOrderShipping({
      orderNo,
      shippingStatus: 1,   // 已发货
    });
  } catch (err) {
    logger.error(`[wxShipping] 发货更新异常: ${orderNo}`, err.message);
  }
}

module.exports = {
  uploadShoppingOrderShipping,
  uploadShippingOnPaySuccess,
  updateShippingOnDeliver,
};
