-- ============================================================
-- 小鲜鸡 数据库迁移 003：退款告警表
-- ============================================================
-- 用途：退款失败时写入记录，PC 商家端首页展示"待处理退款"角标
-- 店员可据此知道哪些订单退款失败需要手动介入
-- ============================================================

USE xiaoxianji;

CREATE TABLE IF NOT EXISTS refund_alert (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    order_no        VARCHAR(32) NOT NULL COMMENT '关联订单号',
    refund_no       VARCHAR(64) NOT NULL COMMENT '退款单号',
    refund_amount   INT NOT NULL DEFAULT 0 COMMENT '退款金额(分)',
    alert_type      VARCHAR(32) NOT NULL DEFAULT 'weigh_refund_failed' COMMENT '告警类型',
    error_message   VARCHAR(500) DEFAULT '' COMMENT '失败原因',
    status          TINYINT NOT NULL DEFAULT 0 COMMENT '0未处理 1已处理 2已忽略',
    resolved_by     BIGINT UNSIGNED COMMENT '处理人ID',
    resolved_at     DATETIME COMMENT '处理时间',
    create_time     DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time     DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_order_no (order_no),
    INDEX idx_status (status),
    INDEX idx_create (create_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
