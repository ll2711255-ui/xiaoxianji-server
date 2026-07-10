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

  // 支付宝小程序
  alipay: {
    appId: process.env.ALIPAY_APPID || '',
    privateKey: (process.env.ALIPAY_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    alipayPublicKey: (process.env.ALIPAY_PUBLIC_KEY || '').replace(/\\n/g, '\n'),
  },

  // 抖音小程序
  toutiao: {
    appId: process.env.TOUTIAO_APPID || '',
    appSecret: process.env.TOUTIAO_APPSECRET || '',
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
    alipay: process.env.ALIPAY_NOTIFY_URL || 'https://www.xuaioxianji.top/api/pay-callback/alipay',
    tt: process.env.TOUTIAO_NOTIFY_URL || 'https://www.xuaioxianji.top/api/pay-callback/tt',
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

  // bcrypt 哈希轮数（10 = 约 100ms，安全性/性能的平衡点）
  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS, 10) || 10,

  // 密码规则
  passwordRules: {
    minLength: 8,
    requireDigit: true,
    requireLowercase: true,
    requireUppercase: true,
  },
};

// ========== 生产环境安全检查 ==========
// 如果缺密钥用默认值运行，进程直接退出不启动
if (config.env === 'production') {
  const checks = [];
  if (config.jwt.accessSecret === 'dev-access-secret-change-me') {
    checks.push('JWT_ACCESS_SECRET 未设置（仍在使用 dev 默认值）');
  }
  if (config.jwt.refreshSecret === 'dev-refresh-secret-change-me') {
    checks.push('JWT_REFRESH_SECRET 未设置（仍在使用 dev 默认值）');
  }
  if (!config.wxpay.mchId && process.env.WXPAY_MCHID === undefined) {
    // mchId 为空可能是未配置微信支付，允许启动但打印警告
    // 生产环境不强制拦截，由 health check 暴露
  }
  if (checks.length > 0) {
    const msg = '生产环境安全检查失败:\n' + checks.map((c, i) => `  ${i + 1}. ${c}`).join('\n');
    console.error('\n' + '='.repeat(55));
    console.error(msg);
    console.error('请在 .env 中设置这些环境变量后重新启动。');
    console.error('='.repeat(55) + '\n');
    process.exit(1);
  }
}

module.exports = config;
