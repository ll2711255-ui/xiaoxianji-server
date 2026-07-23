-- ============================================================
-- 008: banners 表增加 title / subtitle / bg_color 字段
-- 日期: 2026-07-23
-- 说明: 前端广告管理支持标题、副标题、背景色
-- 执行: mysql -u xiaoxianji -p xiaoxianji < 008_banner_fields.sql
-- ============================================================

USE xiaoxianji;

ALTER TABLE banners
  ADD COLUMN title    VARCHAR(200) DEFAULT ''       COMMENT '广告标题' AFTER image_url,
  ADD COLUMN subtitle VARCHAR(200) DEFAULT ''       COMMENT '副标题'   AFTER title,
  ADD COLUMN bg_color VARCHAR(20)  DEFAULT '#FFF8F5' COMMENT '背景色'   AFTER subtitle;

-- 验证
DESCRIBE banners;
