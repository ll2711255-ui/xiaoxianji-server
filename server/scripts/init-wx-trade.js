/**
 * 一次性初始化脚本 — 配置微信「发货信息管理」消息跳转路径
 *
 * 执行：node server/scripts/init-wx-trade.js
 *
 * 前提条件：
 *   1. 小程序已在微信公众平台开通发货信息管理服务
 *      （微信公众平台 → 功能 → 订单中心 → 开通并签署协议）
 *   2. 已完成交易结算管理确认
 *      （小程序关联的所有商户号完成订单管理授权或解绑）
 *
 * 用一次就可以，配置永久生效。
 */

const { getAccessToken } = require('../src/utils/wechat');
const { isTradeManaged, setMsgJumpPath } = require('../src/utils/wxTrade');
const logger = require('../src/utils/logger');

// 小程序订单详情页路径（微信收到发货通知/确认收货消息后点击跳转的目标页）
const ORDER_MSG_PATH = 'pages/orders/detail/detail';

async function main() {
  logger.info('[init] 开始配置微信发货管理消息跳转路径\n');

  // 1. 获取 access_token
  logger.info('[init] 获取 access_token...');
  let token;
  try {
    token = await getAccessToken();
    logger.info('[init] access_token 获取成功');
  } catch (err) {
    logger.error('[init] ❌ 获取 access_token 失败:', err.message);
    logger.error('[init] 请检查 .env 中的 WX_APPID / WX_APPSECRET 是否正确');
    process.exit(1);
  }

  // 2. 检查是否已开通发货管理服务
  logger.info('[init] 检查发货管理服务开通状态...');
  const tradeCheck = await isTradeManaged();
  if (!tradeCheck.is_trade_managed) {
    logger.error('[init] ❌ 小程序尚未开通发货信息管理服务');
    logger.error('[init]');
    logger.error('[init] 请在微信公众平台完成以下操作：');
    logger.error('[init]   ① 功能 → 订单中心 → 开通并签署协议');
    logger.error('[init]   ② 完成交易结算管理确认（所有关联商户号授权）');
    logger.error('[init]');
    logger.error('[init] 开通后重新执行本脚本。');
    if (tradeCheck.errcode !== 0) {
      logger.error(`[init] 接口返回 errcode=${tradeCheck.errcode} errmsg=${tradeCheck.errmsg || ''}`);
    }
    process.exit(1);
  }
  logger.info('[init] ✅ 发货管理服务已开通');

  // 3. 配置消息跳转路径
  logger.info(`[init] 配置消息跳转路径: ${ORDER_MSG_PATH}`);
  try {
    const result = await setMsgJumpPath(ORDER_MSG_PATH);
    if (result.errcode === 0) {
      logger.info('[init] ✅ 消息跳转路径配置成功');
    } else {
      logger.error(`[init] ❌ 配置失败: errcode=${result.errcode} ${result.errmsg || ''}`);
      process.exit(1);
    }
  } catch (err) {
    logger.error('[init] ❌ 配置消息跳转路径异常:', err.message);
    process.exit(1);
  }

  logger.info('[init]');
  logger.info('[init] 初始化完成');
  logger.info('[init]');
  logger.info('[init] 效果说明：');
  logger.info('[init]   发货后，微信会向用户推送「服务通知」消息');
  logger.info('[init]   用户点击消息 → 跳到小程序: ' + ORDER_MSG_PATH);
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    logger.error('[init] 未预期错误:', err.message);
    process.exit(1);
  });
