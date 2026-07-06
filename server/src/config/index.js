/**
 * 集中配置加载（环境变量 → config object）
 * 禁止硬编码敏感信息，所有配置通过 .env 注入
 */
require('dotenv').config();

const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3000,

  // MySQL
  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    user: process.env.DB_USER || 'xiaoxianji',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'xiaoxianji',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    charset: 'utf8mb4',
  },

  // Redis
  redis: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    retryStrategy(times) {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
    maxRetriesPerRequest: 3,
  },

  // JWT
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || 'dev-access-secret-change-me',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-change-me',
    accessExpires: parseInt(process.env.JWT_ACCESS_EXPIRES, 10) || 7200,       // 2h
    refreshExpires: parseInt(process.env.JWT_REFRESH_EXPIRES, 10) || 2592000,  // 30d
  },

  // 微信小程序
  wx: {
    appId: process.env.WX_APPID || '',
    appSecret: process.env.WX_APPSECRET || '',
  },

  // 微信支付 V3
  wxpay: {
    mchId: process.env.WXPAY_MCHID || '',
    serialNo: process.env.WXPAY_SERIAL_NO || '',
    apiV3Key: process.env.WXPAY_APIv3_KEY || '',
    privateKey: (process.env.WXPAY_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
  },

  // 回调地址
  notify: {
    pay: process.env.PAY_NOTIFY_URL || 'https://www.xuaioxianji.top/api/pay-callback',
    refund: process.env.REFUND_NOTIFY_URL || 'https://www.xuaioxianji.top/api/pay-callback/refund',
  },

  // 店铺默认配置
  store: {
    defaultLat: parseFloat(process.env.STORE_LAT) || 23.1291,
    defaultLng: parseFloat(process.env.STORE_LNG) || 113.2644,
    deliveryRadius: parseFloat(process.env.DELIVERY_RADIUS) || 5,
  },

  // 业务参数
  business: {
    payTimeoutMinute: parseInt(process.env.PAY_TIMEOUT_MINUTE, 10) || 15,
    stockLockPrefix: 'stock:lock:',
  },

  // 密码盐
  passwordSalt: process.env.PASSWORD_SALT || 'xiaoxianji_salt',
};

module.exports = config;
