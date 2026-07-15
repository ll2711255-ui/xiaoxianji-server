-- ============================================================
-- Migration 007: 种子数据 — 默认管理员账号
-- 创建初始 admin 账号供首次登录，登录后请立即修改密码
-- 默认用户名: admin，默认密码: 123456
-- ============================================================

INSERT IGNORE INTO merchant_accounts (username, password_hash, role, display_name)
VALUES ('admin', '$2a$10$BrI.8piwA6vKAFJpvJSY.uyOfZGhqH/3FnUpd2OOOult0jkSx7/XC', 'admin', '管理员');
