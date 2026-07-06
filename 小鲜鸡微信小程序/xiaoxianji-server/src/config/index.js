const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const config = {
  // 服务
  port: parseInt(process.env.PORT, 10) || 3000,
  env: process.env.NODE_ENV || 'development',

  // 数据库
  databaseUrl: process.env.DATABASE_URL,

  // Redis
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',

  // JWT
  jwtSecret: process.env.JWT_SECRET,
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
  jwtExpiresIn: '2h',
  jwtRefreshExpiresIn: '7d',

  // 微信小程序
  wxAppId: process.env.WX_APPID,
  wxAppSecret: process.env.WX_APP_SECRET,

  // 微信支付 APIv3
  wxpay: {
    mchid: process.env.WXPAY_MCHID,
    serialNo: process.env.WXPAY_SERIAL_NO,
    apiV3Key: process.env.WXPAY_APIv3_KEY,
    privateKey: process.env.WXPAY_PRIVATE_KEY,
    platformCertPath: process.env.WXPAY_PLATFORM_CERT_PATH || path.join(__dirname, '..', 'certs', 'platform_certs.json'),
  },

  // 阿里云 OSS
  oss: {
    region: process.env.OSS_REGION || 'oss-cn-guangzhou',
    accessKey: process.env.OSS_ACCESS_KEY,
    secretKey: process.env.OSS_SECRET_KEY,
    bucket: process.env.OSS_BUCKET || 'xiaoxianji',
  },

  // 腾讯地图
  qqMapKey: process.env.QQ_MAP_KEY || '',

  // 日志
  logLevel: process.env.LOG_LEVEL || 'info',
};

/**
 * 启动时检查必要的环境变量
 */
function validateConfig() {
  const required = [
    ['JWT_SECRET', config.jwtSecret],
    ['WX_APPID', config.wxAppId],
    ['WX_APP_SECRET', config.wxAppSecret],
    ['WXPAY_MCHID', config.wxpay.mchid],
    ['WXPAY_SERIAL_NO', config.wxpay.serialNo],
    ['WXPAY_APIv3_KEY', config.wxpay.apiV3Key],
    ['WXPAY_PRIVATE_KEY', config.wxpay.privateKey],
  ];

  const missing = required.filter(([, val]) => !val);
  if (missing.length > 0) {
    console.error('[Config] ⚠️  以下环境变量未配置:');
    missing.forEach(([key]) => console.error(`  - ${key}`));
    console.error('[Config] 请复制 .env.example 为 .env 并填写完整');
    if (config.env === 'production') {
      throw new Error('生产环境缺少必要的环境变量，拒绝启动');
    }
  }

  // 数据库URL检查
  if (!config.databaseUrl) {
    console.error('[Config] ⚠️  DATABASE_URL 未配置');
    if (config.env === 'production') {
      throw new Error('生产环境缺少 DATABASE_URL');
    }
  }
}

module.exports = { config, validateConfig };
