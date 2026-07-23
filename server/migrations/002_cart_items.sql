-- =============================================
-- 002: 购物车表 — 服务端持久化
-- 日期: 2026-07-23
-- 说明: 用户购物车同步到服务端，换设备不丢失
-- =============================================

CREATE TABLE IF NOT EXISTS cart_items (
  id          INT           AUTO_INCREMENT PRIMARY KEY,
  user_id     VARCHAR(64)   NOT NULL COMMENT '用户 openid',
  product_id  VARCHAR(64)   NOT NULL COMMENT '商品ID',
  product_name VARCHAR(255) NOT NULL DEFAULT '' COMMENT '商品名称（冗余，方便列表展示）',
  image       VARCHAR(512)  NOT NULL DEFAULT '' COMMENT '商品缩略图',
  pricing_type VARCHAR(32)  NOT NULL DEFAULT '' COMMENT '计价类型',
  spec        JSON          COMMENT '规格信息 {type,weight,processing,delivery}',
  price       INT           NOT NULL DEFAULT 0 COMMENT '单价（分）',
  quantity    INT           NOT NULL DEFAULT 1 COMMENT '数量',
  remark      VARCHAR(255)  NOT NULL DEFAULT '' COMMENT '备注',
  created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户购物车';
