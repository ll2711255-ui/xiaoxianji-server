#!/bin/bash
# 部署 PC 商家端静态文件到 Nginx
set -e

cd /tmp

# 解压新版本到临时目录
rm -rf /tmp/dist_new
mkdir -p /tmp/dist_new
unzip -o dist.zip -d dist_new

# 清空旧的 admin 目录
rm -rf /www/wwwroot/xiaoxianji-admin/*

# 复制新文件
cp -r dist_new/dist/* /www/wwwroot/xiaoxianji-admin/

# 清理
rm -rf dist_new dist.zip

# 重载 Nginx
nginx -s reload

echo "DEPLOY OK"
ls -la /www/wwwroot/xiaoxianji-admin/ | head -10
