-- ============================================================
-- Migration 004: 商家端独立账号权限系统
-- 与顾客 users 表完全隔离，两张表无任何关联
-- ============================================================

CREATE TABLE IF NOT EXISTS merchant_accounts (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  username      VARCHAR(50)  NOT NULL UNIQUE,
  password_hash VARCHAR(128) NOT NULL COMMENT 'bcrypt hash',
  role          ENUM('admin','manager','staff') NOT NULL,
  display_name  VARCHAR(50)  NOT NULL,
  created_by    INT UNSIGNED NULL COMMENT '创建者id，admin为NULL',
  is_active     TINYINT(1)   NOT NULL DEFAULT 1,
  last_login_at DATETIME     NULL,
  created_at    DATETIME     DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_role (role),
  INDEX idx_created_by (created_by),
  CONSTRAINT fk_created_by
    FOREIGN KEY (created_by) REFERENCES merchant_accounts(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS merchant_operation_log (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  operator_id INT UNSIGNED NOT NULL,
  operator_name VARCHAR(50) NOT NULL,
  action      VARCHAR(50)  NOT NULL COMMENT 'create_account|delete_account|reset_password|toggle_active',
  target_id   INT UNSIGNED NULL,
  target_name VARCHAR(50)  NULL,
  detail      JSON         NULL,
  ip          VARCHAR(45)  NULL,
  created_at  DATETIME     DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_operator (operator_id),
  INDEX idx_action (action),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
