/**
 * 全局常量（客户端 & 服务端共享的魔法值统一入口）
 *
 * 服务端对应：cloudfunctions/common/utils.js 中的同名常量
 * 修改默认值时请同步更新两处。
 */

/** 默认店铺坐标（广州天河） */
const DEFAULT_STORE_LAT = 23.1291;
const DEFAULT_STORE_LNG = 113.2644;

/** 默认配送半径（公里） */
const DEFAULT_DELIVERY_RADIUS = 5;

/** 地球半径（公里），用于 Haversine 距离计算 */
const EARTH_RADIUS_KM = 6371;

/** 克转斤除数 */
const GRAMS_PER_JIN = 500;

/** 计价类型枚举 */
const PRICING_TYPE = {
  RANGE_WEIGHT: 'range_weight',
  EXACT_WEIGHT: 'exact_weight',
  PER_PIECE: 'per_piece'
};

/** 计价类型 → 展示标签 */
const PRICING_TYPE_LABELS = {
  range_weight: '按斤范围计价',
  exact_weight: '按斤计价',
  per_piece: '按只计价'
};

/** 计价类型 → 价格单位后缀 */
const PRICING_TYPE_UNITS = {
  range_weight: '/斤起',
  exact_weight: '/斤',
  per_piece: '/只'
};

/** 订单类型 → 展示标签 */
const ORDER_TYPE_LABELS = {
  delivery: '配送上门',
  pickup: '到店自取',
  offline: '线下订单'
};

/** 订单操作按钮文案 */
const ACTION_LABELS = {
  accept: '确认接单',
  process: '开始处理',
  deliver: '开始配送',
  ready: '处理完成',
  complete: '确认完成'
};

// ========== 小程序码 / 号码牌 ==========

/** 号码牌总数（01-99） */
const CARD_COUNT = 99;

/** 小程序码 scene 参数前缀 */
const SCENE_CARD_PREFIX = 'card=';

/** 小程序码宽度（px），微信 API 支持 280-1280 */
const CODE_WIDTH = 280;

/** 小程序码跳转页面路径 */
const CODE_PAGE = 'pages/pickup/pickup';

/** @deprecated 云存储路径前缀 — 已迁移到自建服务器 */
const CODE_CLOUD_PATH_PREFIX = 'codes/card_';

/** @deprecated DB 集合名称 — 已迁移到自建 MySQL */
const CARD_CODES_COLLECTION = 'card_codes';

// ========== 取货页面 ==========

/** 取货状态 */
const PICKUP_STATUS = {
  PENDING: 'pending',
  DONE: 'done',
  IDLE: 'idle',
  INVALID: 'invalid'
};

/** 轮询间隔（毫秒） */
const PICKUP_POLL_INTERVAL = 5000;

/** 最大轮询失败次数 */
const MAX_POLL_FAILS = 3;

// ========== Mock 回退 ==========

/** Mock 模式下二维码占位图 API */
const FALLBACK_QR_API = 'https://api.qrserver.com/v1/create-qr-code/';

/** 腾讯地图 API Key（用于地理编码 & 距离计算）
 *  ⚠️ 请通过云函数 getStoreConfig 动态获取，不要在此处硬编码 */
const QQ_MAP_KEY = '';

/** @deprecated 云开发环境 ID — 已迁移到自建后端，不再使用云开发 */
const CLOUD_ENV_ID = '';

/** API 服务地址（HTTPS 域名，来自 config.js 的惰性 getter） */
const _config = require('./config');

module.exports = {
  DEFAULT_STORE_LAT,
  DEFAULT_STORE_LNG,
  DEFAULT_DELIVERY_RADIUS,
  EARTH_RADIUS_KM,
  GRAMS_PER_JIN,
  PRICING_TYPE,
  PRICING_TYPE_LABELS,
  PRICING_TYPE_UNITS,
  ORDER_TYPE_LABELS,
  ACTION_LABELS,
  CARD_COUNT,
  SCENE_CARD_PREFIX,
  CODE_WIDTH,
  CODE_PAGE,
  CODE_CLOUD_PATH_PREFIX,
  CARD_CODES_COLLECTION,
  PICKUP_STATUS,
  PICKUP_POLL_INTERVAL,
  MAX_POLL_FAILS,
  FALLBACK_QR_API,
  QQ_MAP_KEY,
  CLOUD_ENV_ID,
  get API_BASE_URL() { return _config.API_BASE_URL; }
};
