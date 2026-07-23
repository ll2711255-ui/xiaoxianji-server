/**
 * 微信「发货信息管理」— 消息推送事件处理
 *
 * 微信会将以下事件推送到小程序配置的消息推送 URL：
 *   - trade_manage_remind_access_api    — 提醒接入发货管理 API
 *   - trade_manage_remind_shipping      — 订单超 48h 未发货（含 transaction_id）
 *   - trade_manage_order_settlement     — 订单结算通知
 *   - wxa_trade_controlled             — 小程序需接入订单发货管理
 *
 * 当前策略：记录所有事件日志，为将来自动处理保留入口。
 * 所有事件必须返回 'success' 字符串，否则微信会重试。
 */

const logger = require('../utils/logger');

/**
 * 处理微信发货管理推送事件
 *
 * @param {object} body - 微信推送的完整 JSON body
 * @returns {string} 始终返回 'success'
 */
async function handleTradePushEvent(body) {
  const event = body.Event || '';
  const msgType = body.MsgType || '';

  logger.info(`[trade-callback] 收到事件: Event=${event}, MsgType=${msgType}`);

  switch (event) {

    // ===== 提醒接入发货管理 API =====
    case 'trade_manage_remind_access_api':
      logger.warn(
        '[trade-callback] ⚠️ 微信提醒接入发货管理 API:',
        JSON.stringify({
          msg: body.msg || '',
          createTime: body.CreateTime,
        })
      );
      break;

    // ===== 提醒需要上传发货信息（超 48h 未发货） =====
    case 'trade_manage_remind_shipping':
      logger.warn(
        '[trade-callback] ⚠️ 微信提醒发货:',
        JSON.stringify({
          transactionId: body.transaction_id,
          merchantId: body.merchant_id,
          merchantTradeNo: body.merchant_trade_no,
          payTime: body.pay_time,
          msg: body.msg || '',
        })
      );
      // TODO: 未来可在此自动触发配送信息补发
      break;

    // ===== 订单结算通知 =====
    case 'trade_manage_order_settlement':
      logger.info(
        '[trade-callback] 订单结算通知:',
        JSON.stringify({
          transactionId: body.transaction_id,
          merchantTradeNo: body.merchant_trade_no,
          payTime: body.pay_time,
          shippedTime: body.shipped_time,
          settlementTime: body.settlement_time,
          confirmMethod: body.confirm_receive_method,
          confirmTime: body.confirm_receive_time,
          estimatedSettlement: body.estimated_settlement_time,
        })
      );
      break;

    // ===== 小程序需接入订单发货管理 =====
    case 'wxa_trade_controlled':
      logger.warn(
        '[trade-callback] ⚠️ 小程序需接入订单发货管理:',
        JSON.stringify({
          msg: body.msg || '',
          createTime: body.CreateTime,
        })
      );
      break;

    default:
      logger.info(`[trade-callback] 未识别的事件类型: ${event}，原样记录`);
      break;
  }

  // 始终返回 success 阻止微信重试
  return 'success';
}

module.exports = { handleTradePushEvent };
