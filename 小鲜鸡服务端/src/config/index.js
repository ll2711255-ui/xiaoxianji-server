require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') })

module.exports = {
  port: parseInt(process.env.PORT) || 3000,
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/xiaoxianji',
  jwt: {
    secret: process.env.JWT_SECRET || (() => { throw new Error('FATAL: JWT_SECRET 未设置，服务拒绝启动'); })(),
    accessExpires: process.env.JWT_ACCESS_EXPIRES || '2h',
    refreshExpires: process.env.JWT_REFRESH_EXPIRES || '7d'
  },
  wechat: {
    mchid: process.env.WECHAT_MCHID || '',
    serialNo: process.env.WECHAT_SERIAL_NO || '',
    apiV3Key: process.env.WECHAT_APIv3_KEY || '',
    privateKeyPath: process.env.WECHAT_PRIVATE_KEY_PATH || '',
    appId: process.env.WECHAT_APPID || '',
    appSecret: process.env.WECHAT_APPSECRET || ''
  },
  notifyBaseUrl: process.env.NOTIFY_BASE_URL || (() => {
    const fallback = `http://localhost:${process.env.PORT || 3000}`;
    if (!process.env.NOTIFY_BASE_URL) {
      console.warn('[Config] ⚠️  NOTIFY_BASE_URL 未设置！微信支付回调将使用 ' + fallback + '，生产环境请设置为 HTTPS 域名');
    }
    return fallback;
  })(),
  upload: {
    dir: process.env.UPLOAD_DIR || 'uploads',
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024
  }
}
