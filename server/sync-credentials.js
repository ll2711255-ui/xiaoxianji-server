// 服务器端运行：从 DB 同步凭证到 .env，不输出任何密钥内容
const fs = require('fs');
const path = require('path');
const db = require('./src/config/db');

(async () => {
  try {
    const row = await db.queryOne(
      "SELECT app_id, app_secret FROM payment_methods WHERE enabled = 1 AND channel = 'wechat' LIMIT 1"
    );
    if (!row || !row.appId || !row.appSecret) {
      console.error('DB 中没有完整的微信凭证');
      process.exit(1);
    }

    const envPath = path.join(__dirname, '.env');
    let envContent = fs.readFileSync(envPath, 'utf8');

    // 更新/添加 WX_APPID
    if (/^WX_APPID=/m.test(envContent)) {
      envContent = envContent.replace(/^WX_APPID=.*/m, 'WX_APPID=' + row.appId);
    } else {
      envContent += '\nWX_APPID=' + row.appId;
    }

    // 更新/添加 WX_APPSECRET
    if (/^WX_APPSECRET=/m.test(envContent)) {
      envContent = envContent.replace(/^WX_APPSECRET=.*/m, 'WX_APPSECRET=' + row.appSecret);
    } else {
      envContent += '\nWX_APPSECRET=' + row.appSecret;
    }

    // 更新/添加 NODE_ENV
    if (/^NODE_ENV=/m.test(envContent)) {
      envContent = envContent.replace(/^NODE_ENV=.*/m, 'NODE_ENV=production');
    } else {
      envContent += '\nNODE_ENV=production';
    }

    fs.writeFileSync(envPath, envContent, 'utf8');

    // 设置 DB 默认
    await db.execute(
      "UPDATE payment_methods SET is_default = 1 WHERE channel = 'wechat' AND enabled = 1 LIMIT 1"
    );

    console.log('OK: .env updated, is_default set');
    process.exit(0);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
})();
