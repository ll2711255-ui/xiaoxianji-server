#!/bin/bash
# Run on server: bash /opt/xiaoxianji-server/deploy-remote.sh
set -e
cd /opt/xiaoxianji-server

echo "=== 1. Update .env ==="
sed -i 's|http://159.75.0.194|https://www.xuaioxianji.top|' .env
grep NOTIFY .env

echo ""
echo "=== 2. Install deps ==="
npm install --production

echo ""
echo "=== 3. Seed database ==="
node src/seeds/index.js --force

echo ""
echo "=== 4. Restart PM2 ==="
pm2 restart xiaoxianji-api
pm2 save

echo ""
echo "=== 5. Verify ==="
sleep 2
curl -s http://localhost:3000/api/products | head -c 100

echo ""
echo "=== Done! ==="
