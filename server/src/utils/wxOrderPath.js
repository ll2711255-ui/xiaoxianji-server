/**
 * 微信小程序「购物订单」— 订单详情跳转路径配置
 *
 * 只需调用一次 updateOrderDetailPath，配置后永久生效。
 * 用户从微信「我 → 小店与卡包 → 小程序购物订单」点击订单时，
 * 微信会用此路径 + 实际订单号替换占位符跳转到小程序。
 *
 * 路径中 ${商品订单号} 是微信规定的固定占位符，原样传给微信。
 */

const axios = require('axios');
const logger = require('./logger');

const WX_UPDATE_PATH_URL = 'https://api.weixin.qq.com/wxa/sec/order/update_order_detail_path';
const WX_GET_PATH_URL = 'https://api.weixin.qq.com/wxa/sec/order/get_order_detail_path';

// 小程序实际订单详情页路径（与 pages.json 保持一致）
// 与微信公众平台已配置的路径保持一致（不加多余参数）
const ORDER_DETAIL_PATH = 'pages/orders/detail/detail?orderNo=${商品订单号}';

/**
 * 配置「小程序购物订单」跳转到小程序的订单详情路径
 * @param {string} accessToken
 * @returns {Promise<{success: boolean, path: string}>}
 */
async function updateOrderDetailPath(accessToken) {
  const res = await axios.post(
    `${WX_UPDATE_PATH_URL}?access_token=${accessToken}`,
    { path: ORDER_DETAIL_PATH },
    { timeout: 10000 }
  );

  logger.info('[wxOrderPath] 配置路径返回:', JSON.stringify(res.data));

  if (res.data.errcode !== 0) {
    throw new Error(`配置失败: errcode=${res.data.errcode} ${res.data.errmsg || ''}`);
  }

  return { success: true, path: ORDER_DETAIL_PATH };
}

/**
 * 查询当前配置的订单详情路径
 * @param {string} accessToken
 * @returns {Promise<{errcode: number, path: string}>}
 */
async function getOrderDetailPath(accessToken) {
  const res = await axios.post(
    `${WX_GET_PATH_URL}?access_token=${accessToken}`,
    {},
    { timeout: 10000 }
  );

  logger.info('[wxOrderPath] 查询路径返回:', JSON.stringify(res.data));

  return {
    errcode: res.data.errcode || 0,
    path: res.data.path || '',
  };
}

module.exports = { updateOrderDetailPath, getOrderDetailPath, ORDER_DETAIL_PATH };
