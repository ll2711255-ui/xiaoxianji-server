#!/bin/bash
# 小鲜鸡生产环境部署脚本
# 在服务器上运行: bash deploy.sh
set -e

cd /opt/xiaoxianji-server

echo "===== 1. 更新 .env ====="
cat > .env << 'ENVEOF'
# MongoDB
MONGODB_URI=mongodb://localhost:27017/xiaoxianji

# JWT
JWT_SECRET=xiaoxianji_jwt_secret_key_2026
JWT_ACCESS_EXPIRES=2h
JWT_REFRESH_EXPIRES=7d

# Server
PORT=3000

# WeChat Pay callback URL
NOTIFY_BASE_URL=https://www.xuaioxianji.top

# WeChat Pay APIv3（在 PC 后台「支付设置」中配置）
WECHAT_MCHID=
WECHAT_SERIAL_NO=
WECHAT_APIv3_KEY=
WECHAT_PRIVATE_KEY_PATH=
WECHAT_APPID=
WECHAT_APPSECRET=

# Upload
UPLOAD_DIR=uploads
MAX_FILE_SIZE=5242880
ENVEOF
echo "✅ .env 已更新，NOTIFY_BASE_URL=$(grep NOTIFY_BASE_URL .env)"

echo ""
echo "===== 2. 安装依赖 ====="
npm install --production
echo "✅ 依赖已安装"

echo ""
echo "===== 3. 初始化数据库种子数据 ====="
node src/seeds/index.js --force
echo "✅ 种子数据已初始化"

echo ""
echo "===== 4. 重启 PM2 ====="
pm2 restart xiaoxianji-api
pm2 save
echo "✅ PM2 已重启"

echo ""
echo "===== 5. 验证 ====="
sleep 2
curl -s http://localhost:3000/api/products | head -c 200
echo ""
echo ""
echo "===== 🎉 部署完成！ ====="
echo "API: https://www.xuaioxianji.top"
echo "PC 后台: http://localhost:5173 (本地运行 npm run dev)"
echo "支付回调: https://www.xuaioxianji.top/api/pay-callback"
