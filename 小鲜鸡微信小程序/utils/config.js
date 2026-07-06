/**
 * 全局配置 — 小程序端统一配置入口
 *
 * ⚠️ 生产环境部署前需将 API_BASE_URL 替换为真实域名
 * 开发阶段使用 mock 模式（app.globalData.useMock = true）
 */

/**
 * 获取 API 服务地址（惰性求值，每次读取时动态判断）
 *
 * 优先级：
 *   1. app.globalData.apiBaseUrl（手动覆盖，如 devtools 调试时用 IP）
 *   2. 自动检测：devtools → HTTP 直连 IP（开发阶段免证书）
 *              真机 → HTTPS 域名（微信要求，需 SSL + 域名白名单）
 *   3. 兜底：https://www.xuaioxianji.top
 *
 * 开发阶段：微信开发者工具勾选"不校验合法域名"即可
 * 真机/生产：域名已加入微信 request 合法域名白名单
 */

/** 请求超时（毫秒） */
const REQUEST_TIMEOUT = 15000;

/** Token 存储键名 */
const STORAGE_KEYS_API = {
  ACCESS_TOKEN: 'access_token',
  REFRESH_TOKEN: 'refresh_token',
  TOKEN_EXPIRES_AT: 'token_expires_at'
};

/** 默认店铺坐标（广州天河） */
const DEFAULT_STORE_LAT = 23.1291;
const DEFAULT_STORE_LNG = 113.2644;

/** 默认配送半径（公里） */
const DEFAULT_DELIVERY_RADIUS = 5;

/** 腾讯地图 API Key */
const QQ_MAP_KEY = '';

module.exports = {
  // 惰性求值 + 自动环境检测
  get API_BASE_URL() {
    try {
      const app = getApp();
      // 1. 手动覆盖（最高优先级）
      if (app && app.globalData && app.globalData.apiBaseUrl) {
        return app.globalData.apiBaseUrl;
      }
    } catch (_) {}

    // 2. 自动检测：devtools → HTTP IP / 真机 → HTTPS 域名
    try {
      const sys = wx.getSystemInfoSync();
      if (sys && sys.platform === 'devtools') {
        return 'http://159.75.0.194';
      }
    } catch (_) {}

    // 3. 兜底：HTTPS 生产域名
    return 'https://www.xuaioxianji.top';
  },
  REQUEST_TIMEOUT,
  STORAGE_KEYS_API,
  DEFAULT_STORE_LAT,
  DEFAULT_STORE_LNG,
  DEFAULT_DELIVERY_RADIUS,
  QQ_MAP_KEY
};
