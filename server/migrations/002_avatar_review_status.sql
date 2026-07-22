-- ============================================================
-- 内容安全头像审核状态字段
-- ============================================================
-- 配合 media_check_async 异步检测 + 回调处置流程
-- 审核状态机：none → pending → approved / rejected
-- ============================================================

USE xiaoxianji;

ALTER TABLE users
  ADD COLUMN avatar_review_status ENUM('none','pending','approved','rejected') DEFAULT 'none' COMMENT '头像审核状态' AFTER avatar_url,
  ADD COLUMN avatar_trace_id     VARCHAR(128) DEFAULT '' COMMENT 'media_check_async trace_id，回调匹配' AFTER avatar_review_status,
  ADD COLUMN avatar_pending_url  VARCHAR(500) DEFAULT '' COMMENT '审核中临时展示的 URL' AFTER avatar_trace_id;
