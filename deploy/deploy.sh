#!/bin/bash
# ================================================================
# 小鲜鸡 代码部署/更新脚本
# 用法: bash deploy.sh
# ================================================================

set -e
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }

APP_DIR="/www/wwwroot/xiaoxianji-server"

cd ${APP_DIR}

# 备份 .env
if [ -f .env ]; then
    cp .env .env.backup.$(date +%Y%m%d%H%M%S)
    log ".env 已备份"
fi

# 拉取/上传代码
log "安装依赖..."
npm install --production

# 检查语法
log "检查代码语法..."
find src -name "*.js" -exec node --check {} \; 2>&1 || warn "部分文件语法检查失败，请检查"

# 恢复 .env（如果被覆盖）
if [ -f .env.production ] && [ ! -f .env ]; then
    cp .env.production .env
    warn "请编辑 .env 填入真实密钥"
fi

# 重启服务
log "重启服务..."
if pm2 list | grep -q "xiaoxianji-api"; then
    pm2 reload xiaoxianji-api
else
    pm2 start ecosystem.config.js
fi

pm2 save
log "部署完成！pm2 status:"
pm2 status
