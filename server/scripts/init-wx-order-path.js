/**
 * 一次性初始化脚本 — 配置微信小程序「购物订单」跳转路径
 *
 * 执行：node server/scripts/init-wx-order-path.js
 *
 * 用一次就可以，配置永久生效。
 * 如果返回 10060034（未签署授权协议），需先在微信公众平台开通订单中心：
 *   微信公众平台 → 功能 → 订单中心 → 开通并签署协议
 */

const { getAccessToken } = require('../src/utils/wechat');
const { updateOrderDetailPath, getOrderDetailPath } = require('../src/utils/wxOrderPath');
const logger = require('../src/utils/logger');

async function main() {
  logger.info('[init] 开始配置微信小程序购物订单跳转路径\n');

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

  // 2. 查询当前配置
  logger.info('[init] 查询当前路径配置...');
  try {
    const current = await getOrderDetailPath(token);
    logger.info('[init] 当前配置:', current.path || '（未配置）');
  } catch (err) {
    logger.warn('[init] 查询当前配置失败（可能是首次配置）:', err.message);
  }

  // 3. 配置新路径
  logger.info('[init] 配置新路径...');
  try {
    const result = await updateOrderDetailPath(token);
    logger.info('[init] ✅ 配置成功，路径:', result.path);
  } catch (err) {
    logger.error('[init] ❌ 配置失败:', err.message);
    if (err.message.includes('10060034')) {
      logger.error('[init]');
      logger.error('[init] 错误码 10060034：未签署订单中心授权协议');
      logger.error('[init] 请在微信公众平台完成：功能 → 订单中心 → 开通并签署协议');
    }
    process.exit(1);
  }

  // 4. 验证
  logger.info('[init] 验证配置...');
  try {
    const verify = await getOrderDetailPath(token);
    if (verify.path.includes('${商品订单号}')) {
      logger.info('[init] ✅ 路径包含占位符，配置正确');
    } else {
      logger.error('[init] ❌ 路径中未找到 ${商品订单号} 占位符，请检查');
    }
    logger.info('[init] 最终路径:', verify.path);
  } catch (err) {
    logger.warn('[init] 验证失败:', err.message);
  }

  logger.info('[init] 初始化完成');
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    logger.error('[init] 未预期错误:', err.message);
    process.exit(1);
  });
