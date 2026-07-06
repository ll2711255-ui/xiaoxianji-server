#!/bin/bash
# ================================================================
# 小鲜鸡 服务器一键部署脚本
# 适用: Ubuntu 20.04 / 22.04
# 用法: chmod +x setup-server.sh && sudo bash setup-server.sh
# ================================================================

set -e
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; exit 1; }

APP_DIR="/www/wwwroot/xiaoxianji-server"
NODE_VERSION="18"
MYSQL_ROOT_PASS=""
REDIS_PASS=""
DB_USER="xiaoxianji"
DB_PASS=""
DB_NAME="xiaoxianji"

echo "============================================="
echo "  小鲜鸡 服务器部署脚本"
echo "  目标: $(uname -n)"
echo "============================================="
echo ""

# ====== 0. 交互式输入密码 ======
read -p "请输入 MySQL root 密码（新设）: " MYSQL_ROOT_PASS
read -p "请输入 MySQL 应用用户密码: " DB_PASS
read -p "请输入 Redis 密码: " REDIS_PASS
echo ""

# ====== 1. 系统更新 + 基础工具 ======
log "更新系统包..."
apt-get update -qq && apt-get upgrade -y -qq
apt-get install -y -qq curl wget git build-essential gnupg2 lsb-release ca-certificates

# ====== 2. 安装 Node.js 18.x ======
log "安装 Node.js ${NODE_VERSION}.x..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
    apt-get install -y -qq nodejs
fi
log "Node.js $(node -v) / npm $(npm -v)"

# ====== 3. 安装 MySQL 8.0 ======
log "安装 MySQL 8.0..."
if ! command -v mysql &> /dev/null; then
    apt-get install -y -qq mysql-server
fi

# 启动 MySQL
systemctl start mysql
systemctl enable mysql

# 配置 MySQL root 密码和认证方式
mysql --user=root <<EOF
ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY '${MYSQL_ROOT_PASS}';
FLUSH PRIVILEGES;
EOF

# 创建应用数据库和用户
log "创建数据库和用户..."
mysql --user=root --password="${MYSQL_ROOT_PASS}" <<EOF
CREATE DATABASE IF NOT EXISTS ${DB_NAME} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';
CREATE USER IF NOT EXISTS '${DB_USER}'@'127.0.0.1' IDENTIFIED BY '${DB_PASS}';
GRANT ALL PRIVILEGES ON ${DB_NAME}.* TO '${DB_USER}'@'localhost';
GRANT ALL PRIVILEGES ON ${DB_NAME}.* TO '${DB_USER}'@'127.0.0.1';
FLUSH PRIVILEGES;
EOF
log "数据库 ${DB_NAME} 创建完成"

# ====== 4. 安装 Redis 6.x ======
log "安装 Redis..."
if ! command -v redis-server &> /dev/null; then
    apt-get install -y -qq redis-server
fi

# 配置 Redis 密码和持久化
if [ -n "${REDIS_PASS}" ]; then
    sed -i "s/^# requirepass .*/requirepass ${REDIS_PASS}/" /etc/redis/redis.conf
fi
# 启用 AOF 持久化
sed -i 's/^appendonly no/appendonly yes/' /etc/redis/redis.conf
# 绑定本地
sed -i 's/^bind .*/bind 127.0.0.1/' /etc/redis/redis.conf

systemctl restart redis
systemctl enable redis
log "Redis 配置完成（密码保护 + AOF持久化）"

# ====== 5. 安装 Nginx ======
log "安装 Nginx..."
if ! command -v nginx &> /dev/null; then
    apt-get install -y -qq nginx
fi
systemctl enable nginx

# ====== 6. 安装 PM2 ======
log "安装 PM2..."
npm install -g pm2
log "PM2 $(pm2 -v)"

# ====== 7. 创建项目目录 ======
log "创建项目目录..."
mkdir -p ${APP_DIR}
mkdir -p ${APP_DIR}/logs
mkdir -p ${APP_DIR}/uploads
mkdir -p /var/log/nginx

# ====== 8. 配置防火墙 ======
log "配置防火墙..."
if command -v ufw &> /dev/null; then
    ufw allow 22/tcp
    ufw allow 80/tcp
    ufw allow 443/tcp
    ufw --force enable
    log "防火墙已配置（SSH + HTTP + HTTPS）"
else
    warn "ufw 未安装，请手动配置防火墙"
fi

# ====== 9. 执行数据库迁移 ======
log "执行数据库迁移..."
if [ -f "${APP_DIR}/migrations/001_initial_schema.sql" ]; then
    mysql --user=root --password="${MYSQL_ROOT_PASS}" ${DB_NAME} < ${APP_DIR}/migrations/001_initial_schema.sql
    log "数据库表创建完成"
else
    warn "迁移文件不存在，请先上传代码"
fi

# ====== 10. 配置 Nginx ======
log "配置 Nginx..."
if [ -f "${APP_DIR}/deploy/nginx-xiaoxianji.conf" ]; then
    cp ${APP_DIR}/deploy/nginx-xiaoxianji.conf /etc/nginx/sites-available/xiaoxianji
    ln -sf /etc/nginx/sites-available/xiaoxianji /etc/nginx/sites-enabled/xiaoxianji

    # 移除默认站点
    rm -f /etc/nginx/sites-enabled/default

    # 测试配置
    nginx -t && systemctl reload nginx
    log "Nginx 配置完成"
else
    warn "Nginx 配置文件不存在，请手动配置"
fi

# ====== 11. 配置 PM2 自启 ======
pm2 startup systemd -u root --hp /root
log "PM2 开机自启已配置"

echo ""
echo "============================================="
echo "  ✅ 服务器环境部署完成！"
echo "============================================="
echo ""
echo "  下一步："
echo "  1. 上传代码到 ${APP_DIR}"
echo "  2. cd ${APP_DIR} && npm install --production"
echo "  3. 编辑 .env 文件，填入真实密钥"
echo "  4. pm2 start ecosystem.config.js"
echo "  5. pm2 save"
echo ""
echo "  数据库信息："
echo "    MySQL: ${DB_USER} / ${DB_PASS} / ${DB_NAME}"
echo "    Redis: 密码 ${REDIS_PASS}"
echo ""
echo "  验证命令："
echo "    curl https://www.xuaioxianji.top/api/health"
echo ""
