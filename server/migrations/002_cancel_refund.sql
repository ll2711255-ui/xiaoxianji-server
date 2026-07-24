-- ============================================================
-- 小鲜鸡 数据库迁移 002：订单取消 & 退款字段补全
-- ============================================================
-- 新增字段：cancel_by（取消方）、refund_time（退款完成时间）
-- 新增表：refund_alert（退款告警）、merchant_operation_log（商家操作日志）
-- ============================================================

USE xiaoxianji;

-- 1. order_info 补全取消相关字段
ALTER TABLE order_info
  ADD COLUMN IF NOT EXISTS cancel_by VARCHAR(20) DEFAULT '' COMMENT '取消方：user/merchant/system';

ALTER TABLE order_info
  ADD COLUMN IF NOT EXISTS refund_time DATETIME NULL COMMENT '退款完成时间';

-- 2. 退款告警表（称重退款失败 / 取消退款失败 共用）
CREATE TABLE IF NOT EXISTS refund_alert (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    order_no        VARCHAR(32) NOT NULL,
    refund_no       VARCHAR(64) DEFAULT '',
    refund_amount   INT DEFAULT 0 COMMENT '退款金额（分）',
    alert_type      VARCHAR(32) DEFAULT 'cancel_refund_failed' COMMENT '告警类型：weigh_refund_failed / cancel_refund_failed',
    error_message   TEXT COMMENT '失败原因',
    status          TINYINT DEFAULT 0 COMMENT '0未处理 1已处理 2已忽略',
    resolved_by     VARCHAR(64) DEFAULT '' COMMENT '处理人',
    resolved_at     DATETIME COMMENT '处理时间',
    create_time     DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_status (status),
    INDEX idx_order_no (order_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. 商家操作日志表（审计追溯）
CREATE TABLE IF NOT EXISTS merchant_operation_log (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    operator_id     VARCHAR(64) NOT NULL COMMENT '操作人ID',
    operator_name   VARCHAR(100) DEFAULT '' COMMENT '操作人姓名',
    action          VARCHAR(32) NOT NULL COMMENT '操作类型：cancel_accept / accept / weigh / etc.',
    target_id       VARCHAR(64) DEFAULT '' COMMENT '操作对象ID',
    target_name     VARCHAR(200) DEFAULT '' COMMENT '操作对象名称',
    detail          TEXT COMMENT '操作详情 JSON',
    create_time     DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_operator (operator_id),
    INDEX idx_action (action),
    INDEX idx_create (create_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
