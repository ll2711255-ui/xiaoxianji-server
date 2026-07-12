-- ============================================================
-- 002: 修复 refresh_tokens.token 列长度
-- 原因: JWT refresh token 实际约 430-480 字符，旧 VARCHAR(256) 不够
-- ============================================================

ALTER TABLE refresh_tokens
  MODIFY COLUMN token VARCHAR(512) NOT NULL;
