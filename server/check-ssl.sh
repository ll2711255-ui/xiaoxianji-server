#!/bin/bash
echo "=== /etc/nginx/ssl/ ==="
ls -la /etc/nginx/ssl/ 2>/dev/null || echo "不存在"
echo ""
echo "=== /etc/letsencrypt/live/ ==="
ls -la /etc/letsencrypt/live/ 2>/dev/null || echo "不存在"
echo ""
echo "=== certbot ==="
certbot certificates 2>/dev/null || echo "certbot未安装"
echo ""
echo "=== 宝塔证书 ==="
ls /www/server/panel/vhost/cert/ 2>/dev/null || echo "不存在"
echo ""
echo "=== Nginx配置 ==="
ls -la /etc/nginx/conf.d/xiaoxianji.conf 2>/dev/null
echo ""
echo "=== 域名对应目录 ==="
find /www -maxdepth 1 -type d 2>/dev/null | head -20
