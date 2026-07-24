-- ============================================================
-- 小鲜鸡 数据库迁移 003：库存 MySQL 持久化
-- ============================================================
-- 新增字段：products.stock（Redis 库存的 MySQL 镜像）
-- 目的：Redis 重启后 warmupStock 从 MySQL 恢复真实库存，
--       而非统一填充 999 默认值
-- ============================================================
-- 幂等策略：INFORMATION_SCHEMA 检查 + PREPARE/EXECUTE 动态 SQL
-- 运行方式：mysql -u xiaoxianji -p xiaoxianji < 003_stock_mysql_persistence.sql
-- ============================================================

USE xiaoxianji;

-- products.stock：库存数量（与 Redis stock:available:{id}.default 双向同步）
SET @col_stock = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = 'xiaoxianji' AND TABLE_NAME = 'products' AND COLUMN_NAME = 'stock');
SET @stmt1 = IF(@col_stock = 0,
  'ALTER TABLE products ADD COLUMN stock INT DEFAULT 0 COMMENT ''可售库存（Redis 镜像，管理员设置后同步写入）''',
  'SELECT ''stock already exists'' AS msg');
PREPARE s1 FROM @stmt1; EXECUTE s1; DEALLOCATE PREPARE s1;
