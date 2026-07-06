-- ==========================================================================
-- 小鲜鸡 · 三端一体化 · 数据库初始化脚本
-- MySQL 8.0+
-- ==========================================================================

CREATE DATABASE IF NOT EXISTS xiaoxianji
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE xiaoxianji;

-- ==========================================================================
-- 商家表
-- ==========================================================================
CREATE TABLE merchants (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(100)  NOT NULL DEFAULT '小鲜鸡',
  address       VARCHAR(500)  DEFAULT '',
  latitude      DOUBLE        DEFAULT 23.1291,
  longitude     DOUBLE        DEFAULT 113.2644,
  delivery_radius DOUBLE      DEFAULT 5,
  contact_name  VARCHAR(50)   DEFAULT '',
  contact_phone VARCHAR(20)   DEFAULT '',
  icp_number    VARCHAR(50)   DEFAULT '' COMMENT 'ICP备案号',
  status        ENUM('active','inactive') DEFAULT 'active',
  created_at    DATETIME      DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 默认店铺
INSERT INTO merchants (name) VALUES ('小鲜鸡');

-- ==========================================================================
-- 用户表（多角色店员体系）
-- ==========================================================================
CREATE TABLE users (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  openid          VARCHAR(64)   DEFAULT '' UNIQUE COMMENT '微信openid',
  unionid         VARCHAR(64)   DEFAULT '' COMMENT '微信unionid',
  phone           VARCHAR(20)   DEFAULT '' COMMENT '手机号',
  password_hash   VARCHAR(128)  DEFAULT '' COMMENT 'MD5密码hash',
  nick_name       VARCHAR(64)   DEFAULT '',
  avatar_url      VARCHAR(500)  DEFAULT '',
  role            ENUM('customer','staff','merchant','admin') DEFAULT 'customer',
  merchant_id     INT           DEFAULT 1,
  last_login_at   DATETIME      NULL,
  created_at      DATETIME      DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_openid (openid),
  INDEX idx_phone (phone),
  INDEX idx_role (role)
) ENGINE=InnoDB;

-- ==========================================================================
-- 商品分类表
-- ==========================================================================
CREATE TABLE categories (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  merchant_id INT           DEFAULT 1,
  name        VARCHAR(50)   NOT NULL,
  sort_order  INT           DEFAULT 0,
  icon        VARCHAR(100)  DEFAULT '',
  status      ENUM('on','off') DEFAULT 'on',
  created_at  DATETIME      DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_merchant (merchant_id)
) ENGINE=InnoDB;

-- ==========================================================================
-- 商品表
-- ==========================================================================
CREATE TABLE products (
  id                    INT AUTO_INCREMENT PRIMARY KEY,
  merchant_id           INT           DEFAULT 1,
  category_id           INT           NOT NULL,
  name                  VARCHAR(100)  NOT NULL,
  selling_point         VARCHAR(200)  DEFAULT '',
  description           TEXT,
  pricing_type          ENUM('exact_weight','range_weight','per_piece') DEFAULT 'exact_weight',
  price_per_jin         INT           DEFAULT 0 COMMENT '每斤价格（分）',
  unit_price            INT           DEFAULT 0 COMMENT '每只价格（分）',
  processing_fee        INT           DEFAULT 0 COMMENT '加工费（分）',
  weight_options        JSON          NULL COMMENT '[500,750,1000] 称重可选重量(g)',
  images                JSON          NULL COMMENT '["url1","url2"]',
  processing_options    JSON          NULL COMMENT '["整只","切块"]',
  delivery_modes        JSON          NULL COMMENT '["delivery","pickup"]',
  specs                 JSON          NULL COMMENT '[{type,weight_label,weight_min,weight_max,price_per_jin,processing_fee}]',
  sales                 INT           DEFAULT 0,
  out_of_stock          TINYINT(1)    DEFAULT 0,
  status                ENUM('on','off') DEFAULT 'on',
  stock_quantity        INT           DEFAULT 0 COMMENT '库存数量',
  stock_alert_threshold INT           DEFAULT 5 COMMENT '库存告警阈值',
  origin                VARCHAR(100)  DEFAULT '' COMMENT '产地',
  created_at            DATETIME      DEFAULT CURRENT_TIMESTAMP,
  updated_at            DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_category (category_id),
  INDEX idx_status (status),
  INDEX idx_merchant (merchant_id)
) ENGINE=InnoDB;

-- ==========================================================================
-- 订单表（核心，合并线上线下）
-- ==========================================================================
CREATE TABLE orders (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  order_no          VARCHAR(20)   NOT NULL UNIQUE COMMENT '商户订单号',
  user_id           INT           NULL COMMENT 'FK→users，线下订单可为NULL',
  type              ENUM('delivery','pickup','offline') DEFAULT 'delivery',
  status            ENUM('pending','paid','accepted','weighed','processing','ready','delivering','completed','cancelled') DEFAULT 'pending',

  -- 商品快照（JSON，下单时锁定价格）
  items             JSON          NOT NULL COMMENT '[{productId,productName,pricingType,spec,quantity,unitPrice}]',

  -- 金额（单位：分）
  prepay_amount     INT           NOT NULL DEFAULT 0,
  actual_amount     INT           DEFAULT 0,
  delivery_fee      INT           DEFAULT 0,
  refund_amount     INT           DEFAULT 0,
  refund_status     ENUM('none','processing','success','failed') DEFAULT 'none',

  -- 支付信息
  transaction_id    VARCHAR(64)   DEFAULT '' COMMENT '微信支付交易单号',
  payment_type      ENUM('wechat','cash') DEFAULT 'wechat',
  pay_time          DATETIME      NULL,

  -- 配送信息
  delivery_address  JSON          NULL COMMENT '{name,phone,province,city,district,detail,latitude,longitude}',
  tracking_no       VARCHAR(50)   DEFAULT '' COMMENT '物流单号',
  shipping_method   ENUM('express','self_pickup') DEFAULT 'express',

  -- 自提信息
  pickup_store      JSON          NULL COMMENT '{name,address}',
  pickup_time       DATETIME      NULL,
  pickup_code       VARCHAR(20)   DEFAULT '' COMMENT '自提核销码',

  -- 称重信息
  actual_weight     INT           DEFAULT 0 COMMENT '实际重量（克）',
  weigh_info        JSON          NULL,
  refund_info       JSON          NULL,

  -- 预约信息
  is_scheduled      TINYINT(1)    DEFAULT 0,
  scheduled_date    VARCHAR(20)   DEFAULT '',
  scheduled_time    VARCHAR(20)   DEFAULT '',

  -- 号码牌（线下订单）
  card_number       VARCHAR(20)   DEFAULT '',

  -- 售后信息
  after_sale_status ENUM('none','applied','approved','rejected','refunding','refunded') DEFAULT 'none',
  after_sale_info   JSON          NULL,

  -- 联系信息
  contact_name      VARCHAR(50)   DEFAULT '',
  contact_phone     VARCHAR(20)   DEFAULT '',

  -- 骑手信息（新增字段）
  rider_name        VARCHAR(50)   DEFAULT '' COMMENT '骑手姓名',
  rider_phone       VARCHAR(20)   DEFAULT '' COMMENT '骑手电话',
  rider_latitude    DOUBLE        NULL COMMENT '骑手实时纬度',
  rider_longitude   DOUBLE        NULL COMMENT '骑手实时经度',

  -- 时间戳
  created_at        DATETIME      DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  completed_at      DATETIME      NULL,

  INDEX idx_user (user_id),
  INDEX idx_status (status),
  INDEX idx_type (type),
  INDEX idx_created (created_at),
  INDEX idx_order_no (order_no),
  INDEX idx_transaction (transaction_id)
) ENGINE=InnoDB;

-- ==========================================================================
-- 用户收货地址表
-- ==========================================================================
CREATE TABLE addresses (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT           NOT NULL,
  name        VARCHAR(50)   DEFAULT '',
  phone       VARCHAR(20)   DEFAULT '',
  province    VARCHAR(30)   DEFAULT '',
  city        VARCHAR(30)   DEFAULT '',
  district    VARCHAR(30)   DEFAULT '',
  detail      VARCHAR(200)  DEFAULT '',
  latitude    DOUBLE        NULL,
  longitude   DOUBLE        NULL,
  is_default  TINYINT(1)    DEFAULT 0,
  created_at  DATETIME      DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user (user_id)
) ENGINE=InnoDB;

-- ==========================================================================
-- 号码牌表
-- ==========================================================================
CREATE TABLE pai_numbers (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  number      VARCHAR(10)   NOT NULL UNIQUE,
  status      ENUM('idle','in_use') DEFAULT 'idle',
  order_id    VARCHAR(20)   DEFAULT '',
  created_at  DATETIME      DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ==========================================================================
-- 排队叫号表
-- ==========================================================================
CREATE TABLE queue_numbers (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  order_no    VARCHAR(20)   NOT NULL,
  number      INT           NOT NULL,
  status      ENUM('waiting','called','completed') DEFAULT 'waiting',
  called_at   DATETIME      NULL,
  created_at  DATETIME      DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_order_no (order_no)
) ENGINE=InnoDB;

-- ==========================================================================
-- 优惠券表
-- ==========================================================================
CREATE TABLE coupons (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  merchant_id INT           DEFAULT 1,
  name        VARCHAR(100)  NOT NULL,
  type        ENUM('fixed','percent') DEFAULT 'fixed',
  value       INT           NOT NULL COMMENT '面值（分）或百分比',
  min_amount  INT           DEFAULT 0 COMMENT '最低消费金额（分）',
  total_count INT           DEFAULT 0,
  used_count  INT           DEFAULT 0,
  start_at    DATETIME      NULL,
  end_at      DATETIME      NULL,
  status      ENUM('on','off') DEFAULT 'on',
  created_at  DATETIME      DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ==========================================================================
-- 用户优惠券表
-- ==========================================================================
CREATE TABLE user_coupons (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT           NOT NULL,
  coupon_id   INT           NOT NULL,
  status      ENUM('unused','used','expired') DEFAULT 'unused',
  used_at     DATETIME      NULL,
  order_no    VARCHAR(20)   DEFAULT '',
  created_at  DATETIME      DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user (user_id),
  INDEX idx_coupon (coupon_id)
) ENGINE=InnoDB;

-- ==========================================================================
-- 售后记录表
-- ==========================================================================
CREATE TABLE after_sales (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  order_no    VARCHAR(20)   NOT NULL,
  user_id     INT           NOT NULL,
  type        ENUM('refund','return') DEFAULT 'refund',
  reason      TEXT,
  images      JSON          NULL,
  amount      INT           DEFAULT 0,
  status      ENUM('applied','approved','rejected','completed') DEFAULT 'applied',
  handle_note TEXT,
  handler_id  INT           NULL,
  created_at  DATETIME      DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_order_no (order_no),
  INDEX idx_user (user_id)
) ENGINE=InnoDB;

-- ==========================================================================
-- 店铺配置表（KV 键值对）
-- ==========================================================================
CREATE TABLE configs (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  `key`       VARCHAR(50)   NOT NULL UNIQUE,
  value       JSON          NULL,
  updated_at  DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 默认配置
INSERT INTO configs (`key`, value) VALUES
('store_config', '{"name":"小鲜鸡","address":"广州市天河区","deliveryRadius":5,"latitude":23.1291,"longitude":113.2644,"contactName":"","contactPhone":"","icpNumber":""}'),
('banners', '[]');

-- ==========================================================================
-- 轮播图表
-- ==========================================================================
CREATE TABLE banners (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  image_url   VARCHAR(500)  NOT NULL,
  link_url    VARCHAR(500)  DEFAULT '',
  sort_order  INT           DEFAULT 0,
  status      ENUM('on','off') DEFAULT 'on',
  created_at  DATETIME      DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ==========================================================================
-- 计数器表
-- ==========================================================================
CREATE TABLE counters (
  `key`       VARCHAR(50)   PRIMARY KEY,
  letter_idx  INT           DEFAULT 0,
  seq         INT           DEFAULT 0
) ENGINE=InnoDB;

INSERT INTO counters (`key`, letter_idx, seq) VALUES ('order', 0, 0);
