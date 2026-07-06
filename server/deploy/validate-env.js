/**
 * 部署前环境校验脚本
 * 用途：在 npm install 之后、pm2 start 之前运行
 *       防止占位密码导致"服务启动但全部 500"的问题
 *
 * 用法：node deploy/validate-env.js
 *       退出码 0 = 通过，1 = 未通过（阻断启动）
 */
require('dotenv').config();
const path = require('path');
const fs = require('fs');

const ENV_PATH = path.resolve(__dirname, '..', '.env');
let errors = [];
let warnings = [];

// ====== 1. 检查 .env 文件是否存在 ======
if (!fs.existsSync(ENV_PATH)) {
  console.error('❌ .env 文件不存在！');
  console.error('   请复制 .env.example 或 .env.production 并填入真实密钥');
  process.exit(1);
}

console.log('✅ .env 文件存在:', ENV_PATH);

// ====== 2. 检查占位密码 ======
const PLACEHOLDER_PATTERNS = [
  /请修改/i,
  /your_/i,
  /change.me/i,
  /请填写/i,
  /placeholder/i,
];

const requiredVars = [
  { key: 'DB_PASSWORD', label: 'MySQL 密码', secret: true },
  { key: 'REDIS_PASSWORD', label: 'Redis 密码', secret: true },
  { key: 'JWT_ACCESS_SECRET', label: 'JWT Access Secret (≥64字符)', secret: true, minLen: 32 },
  { key: 'JWT_REFRESH_SECRET', label: 'JWT Refresh Secret (≥64字符)', secret: true, minLen: 32 },
  { key: 'WX_APPID', label: '微信小程序 AppID' },
  { key: 'WX_APPSECRET', label: '微信小程序 AppSecret', secret: true },
  { key: 'WXPAY_MCHID', label: '微信支付商户号', optional: true },
  { key: 'WXPAY_APIv3_KEY', label: '微信支付 APIv3 密钥', optional: true, secret: true },
  { key: 'PASSWORD_SALT', label: '密码盐', secret: true },
];

for (const v of requiredVars) {
  const value = process.env[v.key];

  if (!value || value.trim() === '') {
    if (v.optional) {
      warnings.push(`⚠️  ${v.label} (${v.key}) 未配置，相关功能不可用`);
      continue;
    }
    errors.push(`❌ ${v.label} (${v.key}) 未配置`);
    continue;
  }

  // 检查占位模式
  for (const p of PLACEHOLDER_PATTERNS) {
    if (p.test(value)) {
      if (v.optional) {
        warnings.push(`⚠️  ${v.label} (${v.key}) 疑似占位值: "${value.substring(0, 20)}..."`);
        break;
      }
      errors.push(`❌ ${v.label} (${v.key}) 疑似占位值: "${value.substring(0, 20)}..."`);
      break;
    }
  }

  // 检查最小长度
  if (v.minLen && value.length < v.minLen) {
    errors.push(`❌ ${v.label} (${v.key}) 长度不足 (${value.length} < ${v.minLen})`);
  }
}

// ====== 3. 输出结果 ======
console.log('');

if (errors.length > 0) {
  console.error('═══════════════════════════════════');
  console.error('  部署阻断：以下配置存在问题');
  console.error('═══════════════════════════════════');
  errors.forEach(e => console.error('  ' + e));
  console.error('');
  console.error('  修复方式：编辑 .env 文件填入真实密钥');
  console.error('    vim', ENV_PATH);
  console.error('═══════════════════════════════════');
  process.exit(1);
}

if (warnings.length > 0) {
  console.warn('⚠️ 警告（不阻断部署）：');
  warnings.forEach(w => console.warn('  ' + w));
  console.warn('');
}

console.log('✅ 环境变量校验通过');

// ====== 4. 测试 MySQL 连接 ======
console.log('');
console.log('正在测试 MySQL 连接...');

const mysql = require('mysql2/promise');

async function testMySQL() {
  try {
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST || '127.0.0.1',
      port: parseInt(process.env.DB_PORT, 10) || 3306,
      user: process.env.DB_USER || 'xiaoxianji',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'xiaoxianji',
      connectTimeout: 5000,
    });
    await conn.ping();
    await conn.end();
    console.log('✅ MySQL 连接测试通过');
    return true;
  } catch (err) {
    console.error('❌ MySQL 连接失败:', err.message);
    console.error('');
    console.error('  常见原因：');
    console.error('  1. MySQL 密码不正确 → 检查 .env 的 DB_PASSWORD');
    console.error('  2. MySQL 未启动 → systemctl status mysql');
    console.error('  3. 用户不存在 → 运行 mysql 创建用户');
    return false;
  }
}

testMySQL().then((ok) => {
  if (!ok) process.exit(1);
  console.log('');
  console.log('═══════════════════════════════════');
  console.log('  ✅ 所有校验通过，可以启动服务');
  console.log('  pm2 start ecosystem.config.js');
  console.log('═══════════════════════════════════');
});
