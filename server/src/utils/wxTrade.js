/**
 * 微信小程序「发货信息管理服务」— 交易管理 API 封装
 *
 * 根据《商家自营类小程序运营规范》，特定类型的小程序必须在平台完成
 * 发货信息录入及确认收货流程后方可进行资金结算。
 *
 * 本模块封装所有 /wxa/sec/order/* 发货管理接口：
 *   - isTradeManaged — 查询小程序是否已开通发货管理服务
 *   - setMsgJumpPath — 设置发货消息/确认收货消息的服务通知跳转路径
 *   - notifyConfirmReceive — 提醒用户确认收货（加快资金结算）
 *   - getOrderShipping — 查询单个订单发货状态
 *   - getOrderList — 查询订单列表
 *
 * 所有调用异步非阻塞，失败只记日志不影响主流程。
 * API 列表：https://developers.weixin.qq.com/miniprogram/dev/platform-capabilities/business-capabilities/order-shipping/order-shipping.html
 */

const axios = require('axios');
const { getAccessToken, clearAccessTokenCache } = require('./wechat');
const logger = require('./logger');

// ========== API 地址 ==========

const WX_TRADE_BASE = 'https://api.weixin.qq.com/wxa/sec/order';

// ========== 内部工具 ==========

/**
 * 调用微信发货管理 API（带 token 过期自动重试）
 *
 * @param {string} urlPath - API 路径，如 '/is_trade_managed'
 * @param {object} body     - POST 请求体
 * @param {string} label    - 日志标识
 * @returns {Promise<object>} 微信 API 原始响应
 */
async function _callWxTradeApi(urlPath, body, label) {
  // 1. 获取 access_token
  let accessToken;
  try {
    accessToken = await getAccessToken();
  } catch (err) {
    logger.error(`[wxTrade] ${label} 获取 access_token 失败:`, err.message);
    return { errcode: -1, errmsg: 'token 获取失败' };
  }

  // 2. 调用微信 API
  const url = `${WX_TRADE_BASE}${urlPath}?access_token=${accessToken}`;

  try {
    const res = await axios.post(url, body || undefined, { timeout: 15000 });

    logger.info(`[wxTrade] ${label} 返回:`, JSON.stringify(res.data));

    if (res.data.errcode === 0) {
      logger.info(`[wxTrade] ✅ ${label} 成功`);
      return res.data;
    }

    // token 过期重试
    if (res.data.errcode === 40001 || res.data.errcode === 41001) {
      logger.warn(`[wxTrade] ${label} access_token 过期，重试...`);
      clearAccessTokenCache();
      const newToken = await getAccessToken();

      const res2 = await axios.post(
        `${WX_TRADE_BASE}${urlPath}?access_token=${newToken}`,
        body,
        { timeout: 15000 }
      );

      logger.info(`[wxTrade] ${label} 重试返回:`, JSON.stringify(res2.data));

      if (res2.data.errcode === 0) {
        logger.info(`[wxTrade] ✅ ${label} 重试成功`);
        return res2.data;
      }

      logger.warn(`[wxTrade] ${label} 重试失败: errcode=${res2.data.errcode}`);
      return res2.data;
    }

    logger.warn(`[wxTrade] ${label} 失败: errcode=${res.data.errcode} ${res.data.errmsg || ''}`);
    return res.data;

  } catch (err) {
    logger.error(`[wxTrade] ${label} 网络错误:`, err.message);
    return { errcode: -2, errmsg: err.message };
  }
}

// ========== 1. 查询是否已开通发货管理服务 ==========

/**
 * 查询小程序是否已开通发货信息管理服务
 *
 * API: POST /wxa/sec/order/is_trade_managed
 *
 * @returns {Promise<{errcode: number, is_trade_managed?: boolean, errmsg?: string}>}
 */
async function isTradeManaged() {
  const result = await _callWxTradeApi('/is_trade_managed', {}, 'isTradeManaged');

  if (result.errcode === 0) {
    logger.info(`[wxTrade] 发货管理服务状态: ${result.is_trade_managed ? '已开通' : '未开通'}`);
  }

  return result;
}

// ========== 2. 设置消息跳转路径 ==========

/**
 * 设置发货消息及确认收货消息的跳转路径
 *
 * 用户点击微信「服务通知」中的发货消息/确认收货消息时，
 * 微信会用此路径跳转到小程序对应页面。
 *
 * 注意：与 wxOrderPath.js 的 update_order_detail_path 不同——
 *       那个控制「小程序购物订单」中心的跳转，
 *       这个控制「服务通知」消息的跳转。
 *
 * API: POST /wxa/sec/order/set_msg_jump_path
 *
 * @param {string} path - 小程序页面路径，如 'pages/orders/detail/detail'
 * @returns {Promise<{errcode: number, errmsg?: string}>}
 */
async function setMsgJumpPath(path) {
  if (!path) {
    logger.error('[wxTrade] setMsgJumpPath 缺少 path 参数');
    return { errcode: -3, errmsg: '缺少 path 参数' };
  }

  const body = { path };

  const result = await _callWxTradeApi('/set_msg_jump_path', body, 'setMsgJumpPath');

  return {
    errcode: result.errcode || 0,
    errmsg: result.errmsg || '',
  };
}

// ========== 3. 提醒用户确认收货 ==========

/**
 * 提醒用户及时确认收货，以提高资金结算效率
 *
 * 每个订单仅可调用一次。通常在快递已签收后调用。
 *
 * API: POST /wxa/sec/order/notify_confirm_receive
 *
 * @param {object} params
 * @param {string} params.orderNo       商户订单号
 * @param {string} [params.transactionId] 微信支付流水号（优先用此定位）
 * @param {string} [params.receiveTime]  签收时间，ISO 8601 格式
 * @returns {Promise<{errcode: number, errmsg?: string}>}
 */
async function notifyConfirmReceive({ orderNo, transactionId, receiveTime }) {
  if (!orderNo) {
    logger.error('[wxTrade] notifyConfirmReceive 缺少 orderNo');
    return { errcode: -3, errmsg: '缺少 orderNo 参数' };
  }

  const body = {
    order_key: {
      order_number_type: 2,  // 2 = 商户订单号
      out_trade_no: orderNo,
    },
  };

  if (transactionId) {
    body.order_key.transaction_id = transactionId;
  }

  if (receiveTime) {
    body.receive_time = receiveTime;
  }

  const result = await _callWxTradeApi(
    '/notify_confirm_receive',
    body,
    `notifyConfirmReceive(${orderNo})`
  );

  if (result.errcode === 0) {
    logger.info(`[wxTrade] ✅ 确认收货提醒已发送: ${orderNo}`);
  } else if (result.errcode === 10060039) {
    // 订单已确认收货或已调用过，幂等处理
    logger.info(`[wxTrade] 订单已确认或已通知: ${orderNo} errcode=${result.errcode}`);
    return { errcode: 0 };  // 当作成功
  }

  return {
    errcode: result.errcode || 0,
    errmsg: result.errmsg || '',
  };
}

// ========== 4. 查询单个订单发货状态 ==========

/**
 * 通过交易单号或商户单号查询订单发货状态
 *
 * API: POST /wxa/sec/order/get_order
 *
 * @param {object} params
 * @param {string} [params.transactionId] 微信支付流水号
 * @param {string} [params.outTradeNo]    商户订单号
 * @returns {Promise<{errcode: number, order?: object, errmsg?: string}>}
 */
async function getOrderShipping({ transactionId, outTradeNo }) {
  if (!transactionId && !outTradeNo) {
    logger.error('[wxTrade] getOrderShipping 缺少 transactionId 或 outTradeNo');
    return { errcode: -3, errmsg: '需要提供 transactionId 或 outTradeNo' };
  }

  const body = {
    order_number_type: 2,  // 默认按商户订单号查
  };

  if (transactionId) {
    body.order_number_type = 1;  // 1 = 微信支付流水号
    body.transaction_id = transactionId;
  } else {
    body.out_trade_no = outTradeNo;
  }

  const result = await _callWxTradeApi(
    '/get_order',
    body,
    `getOrder(${transactionId || outTradeNo})`
  );

  return {
    errcode: result.errcode || 0,
    order: result.order || null,
    errmsg: result.errmsg || '',
  };
}

// ========== 5. 查询订单列表 ==========

/**
 * 查询订单列表（可按支付时间、状态筛选）
 *
 * API: POST /wxa/sec/order/get_order_list
 *
 * @param {object} params
 * @param {number} [params.payTimeRange]  支付时间范围
 * @param {string} [params.openid]        支付者 openid
 * @param {number} [params.status]        订单发货状态
 * @param {number} [params.offset]        分页偏移（默认 0）
 * @param {number} [params.limit]         分页条数（默认 30，max 100）
 * @returns {Promise<{errcode: number, orders?: object[], total_num?: number, errmsg?: string}>}
 */
async function getOrderList({
  payTimeRange,
  openid,
  status,
  offset = 0,
  limit = 30,
} = {}) {
  const body = {
    offset,
    limit: Math.min(limit, 100),
  };

  if (payTimeRange) {
    body.pay_time_range = payTimeRange;
  }
  if (openid) {
    body.openid = openid;
  }
  if (status !== undefined && status !== null) {
    body.status = status;
  }

  const result = await _callWxTradeApi(
    '/get_order_list',
    body,
    `getOrderList(offset=${offset}, limit=${limit})`
  );

  return {
    errcode: result.errcode || 0,
    orders: result.orders || [],
    total_num: result.total_num || 0,
    errmsg: result.errmsg || '',
  };
}

module.exports = {
  isTradeManaged,
  setMsgJumpPath,
  notifyConfirmReceive,
  getOrderShipping,
  getOrderList,
};
