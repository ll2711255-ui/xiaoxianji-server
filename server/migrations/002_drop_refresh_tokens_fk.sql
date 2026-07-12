-- ============================================================
-- 002: 移除 refresh_tokens 对 users 的外键约束
-- ============================================================
-- 原因：商家登录(marchant_accounts)也往 refresh_tokens 写数据，
-- 若 merchant_accounts.id 在 users 表中无对应记录则 INSERT 失败
-- ============================================================

USE xiaoxianji;

-- 先查约束名再删（MySQL 自动生成的约束名各不相同）
-- 如果外键存在则删除，不存在则忽略
SET @fk_name = (
  SELECT CONSTRAINT_NAME
  FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = 'xiaoxianji'
    AND TABLE_NAME = 'refresh_tokens'
    AND COLUMN_NAME = 'user_id'
    AND REFERENCED_TABLE_NAME IS NOT NULL
  LIMIT 1
);

SET @sql = IF(@fk_name IS NOT NULL,
  CONCAT('ALTER TABLE refresh_tokens DROP FOREIGN KEY ', @fk_name),
  'SELECT "FK not found, skip" AS msg'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
