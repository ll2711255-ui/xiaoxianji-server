import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),

  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'xiaoxianji',
    waitForConnections: true,
    connectionLimit: 20,
    queueLimit: 0,
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '12h',
  },

  wx: {
    appId: process.env.WX_APPID || 'wx178d0ae59d576ce1',
    secret: process.env.WX_SECRET || '',
  },

  wxpay: {
    mchId: process.env.WXPAY_MCHID || '1747616717',
    serialNo: process.env.WXPAY_SERIAL_NO || '',
    apiV3Key: process.env.WXPAY_APIv3_KEY || '',
    privateKeyPath: process.env.WXPAY_PRIVATE_KEY_PATH || '/etc/wechatpay/apiclient_key.pem',
    notifyUrl: process.env.WXPAY_NOTIFY_URL || '',
    refundNotifyUrl: process.env.WXPAY_REFUND_NOTIFY_URL || '',
  },

  cos: {
    secretId: process.env.COS_SECRET_ID || '',
    secretKey: process.env.COS_SECRET_KEY || '',
    bucket: process.env.COS_BUCKET || '',
    region: process.env.COS_REGION || 'ap-guangzhou',
  },

  subscribeTemplateId: process.env.SUBSCRIBE_TEMPLATE_ID || '',
};
