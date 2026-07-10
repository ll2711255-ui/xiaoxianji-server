-- ============================================================
-- Migration 005: 支付方式配置表
-- 支持商家后台管理微信支付和支付宝支付配置
-- ============================================================

CREATE TABLE IF NOT EXISTS payment_methods (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name            VARCHAR(30)   NOT NULL COMMENT '支付名称（如 微信支付主商户）',
  channel         ENUM('wechat','alipay') NOT NULL COMMENT '支付渠道',
  merchant_type   ENUM('normal','service') NOT NULL DEFAULT 'normal' COMMENT '商户类型（普通商户/服务商）',

  -- 微信专属字段（channel=wechat 时使用）
  app_id          VARCHAR(32)   NULL COMMENT '微信 AppID',
  app_secret      VARCHAR(64)   NULL COMMENT '微信 AppSecret',
  mchid           VARCHAR(10)   NULL COMMENT '微信支付商户号',
  serial_no       VARCHAR(40)   NULL COMMENT 'APIv3 证书序列号',
  api_key         VARCHAR(64)   NULL COMMENT 'APIv3 密钥（32位）',
  cert_pem        TEXT          NULL COMMENT 'apiclient_cert.pem 证书内容',
  key_pem         TEXT          NULL COMMENT 'apiclient_key.pem 私钥内容',

  -- 支付宝专属字段（channel=alipay 时使用）
  alipay_app_id        VARCHAR(32)   NULL COMMENT '支付宝 AppID',
  alipay_private_key   TEXT          NULL COMMENT '支付宝应用私钥',
  alipay_public_key    TEXT          NULL COMMENT '支付宝公钥',

  -- 控制字段
  enabled         TINYINT(1)    NOT NULL DEFAULT 1 COMMENT '是否启用',
  is_default      TINYINT(1)    NOT NULL DEFAULT 0 COMMENT '是否默认支付方式',
  created_by      INT UNSIGNED  NULL COMMENT '创建者 merchant_accounts.id',
  created_at      DATETIME      DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_channel (channel),
  INDEX idx_enabled (enabled),
  INDEX idx_created_by (created_by)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
