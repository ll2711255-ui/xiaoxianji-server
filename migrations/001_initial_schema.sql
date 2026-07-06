-- ============================================================
-- 小鲜鸡 数据库初始化脚本 V1.0
-- ============================================================

CREATE DATABASE IF NOT EXISTS xiaoxianji
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE xiaoxianji;

-- ===== 用户表 =====
CREATE TABLE IF NOT EXISTS users (
    id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    openid      VARCHAR(64) NOT NULL UNIQUE,
    phone       VARCHAR(20) DEFAULT '',
    nick_name   VARCHAR(100) DEFAULT '',
    avatar_url  VARCHAR(500) DEFAULT '',
    role        ENUM('customer','merchant','admin') DEFAULT 'customer',
    password    VARCHAR(128) DEFAULT '' COMMENT 'SHA256 hash for merchant login',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login  DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ===== 分类表 =====
CREATE TABLE IF NOT EXISTS categories (
    id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(50) NOT NULL,
    sort        INT DEFAULT 0,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ===== 商品表 =====
CREATE TABLE IF NOT EXISTS products (
    id               BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name             VARCHAR(200) NOT NULL,
    category_id      BIGINT UNSIGNED NOT NULL,
    pricing_type     ENUM('range_weight','exact_weight','per_piece') NOT NULL,
    selling_point    VARCHAR(200) DEFAULT '',
    description      TEXT,
    images           JSON COMMENT 'Array of image URLs',
    delivery_modes   JSON COMMENT '["delivery","pickup"]',
    processing_options JSON COMMENT '["整只","切块"]',
    -- 按重称重 (exact_weight)
    price_per_jin    INT DEFAULT 0 COMMENT '每斤单价(分)',
    weight_options   JSON COMMENT '[500,1000,1500]',
    processing_fee   INT DEFAULT 0 COMMENT '切块附加费(分)',
    -- 按只计价 (per_piece)
    unit_price       INT DEFAULT 0 COMMENT '按只单价(分)',
    -- 按重范围 (range_weight) 规格
    specs            JSON COMMENT '[{type,weight_label,weight_min,weight_max,price_per_jin,processing_fee}]',
    -- 通用
    emoji            VARCHAR(10) DEFAULT '🐔',
    sales            INT DEFAULT 0,
    out_of_stock     TINYINT(1) DEFAULT 0,
    status           ENUM('on','off') DEFAULT 'on',
    sort             INT DEFAULT 0,
    create_time      DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id),
    INDEX idx_category (category_id),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ===== 订单主表（核心P0） =====
CREATE TABLE IF NOT EXISTS order_info (
    id                BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    order_no          VARCHAR(32) NOT NULL UNIQUE COMMENT '商户订单号',
    user_id           VARCHAR(64) NOT NULL COMMENT '用户OpenID',
    type              ENUM('delivery','pickup','offline') DEFAULT 'pickup',
    -- 订单状态：0待支付 1已支付 2已取消 3已完成 4退款中 5已退款
    order_status      TINYINT NOT NULL DEFAULT 0,
    status_label      VARCHAR(20) DEFAULT 'pending' COMMENT '状态标签(pending/paid/accepted/weighed/processing/ready/completed/cancelled)',
    -- 商品明细
    items             JSON NOT NULL COMMENT '[{productId,productName,pricingType,spec,quantity,unitPrice}]',
    -- 金额（单位：分）
    total_amount      INT NOT NULL DEFAULT 0 COMMENT '订单原价',
    pay_amount        INT NOT NULL DEFAULT 0 COMMENT '实付金额',
    discount_amount   INT DEFAULT 0 COMMENT '优惠金额',
    actual_amount     INT DEFAULT 0 COMMENT '称重后实际金额',
    actual_weight     INT DEFAULT 0 COMMENT '实际重量(克)',
    refund_amount     INT DEFAULT 0 COMMENT '退款金额',
    refund_status     VARCHAR(20) DEFAULT 'none',
    -- 收货地址
    delivery_address  JSON COMMENT '{name,phone,province,city,district,detail,latitude,longitude}',
    -- 预约
    is_scheduled      TINYINT(1) DEFAULT 0,
    scheduled_date    VARCHAR(20) DEFAULT '',
    scheduled_time    VARCHAR(20) DEFAULT '',
    -- 微信支付信息
    transaction_id    VARCHAR(64) DEFAULT '',
    prepay_id         VARCHAR(64) DEFAULT '',
    -- 时间戳
    pay_time          DATETIME,
    expire_time       DATETIME NOT NULL COMMENT '支付超时时间',
    accept_time       DATETIME,
    weigh_time        DATETIME,
    process_time      DATETIME,
    ready_time        DATETIME,
    deliver_time      DATETIME,
    complete_time     DATETIME,
    cancel_time       DATETIME,
    cancel_reason     VARCHAR(200) DEFAULT '',
    -- 称重信息
    weigh_info        JSON COMMENT '{actualWeight,actualWeightJin,pricePerJin,processingFee,prepayAmount,actualAmount,refundAmount,weighPhoto,weighTime,staffId,staffName,cardNumber,pricingType}',
    -- 退款信息
    refund_info       JSON COMMENT '{refundNo,refundAmount,status,wxRefundId,refundTime,successTime}',
    -- 号码牌
    card_number       VARCHAR(10) DEFAULT '',
    -- 联系方式
    contact_name      VARCHAR(50) DEFAULT '',
    contact_phone     VARCHAR(20) DEFAULT '',
    -- 线下支付类型
    payment_type      ENUM('wechat','cash','unpaid') DEFAULT 'wechat',
    is_deleted        TINYINT DEFAULT 0,
    create_time       DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time       DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user (user_id),
    INDEX idx_status (order_status),
    INDEX idx_type (type),
    INDEX idx_card (card_number),
    INDEX idx_expire (expire_time),
    INDEX idx_create (create_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ===== 支付流水表（P0） =====
CREATE TABLE IF NOT EXISTS payment_record (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    order_no        VARCHAR(32) NOT NULL,
    transaction_id  VARCHAR(64) DEFAULT '' COMMENT '微信支付交易号',
    prepay_id       VARCHAR(64) DEFAULT '' COMMENT '预支付ID',
    pay_amount      INT NOT NULL DEFAULT 0 COMMENT '支付金额(分)',
    pay_status      TINYINT DEFAULT 0 COMMENT '0待支付 1成功 2失败 3已关闭',
    pay_type        TINYINT DEFAULT 1 COMMENT '1微信JSAPI',
    callback_data   TEXT COMMENT '回调原始JSON',
    create_time     DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time     DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_order_no (order_no),
    INDEX idx_status (pay_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ===== 退款流水表（P0） =====
CREATE TABLE IF NOT EXISTS refund_record (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    refund_no       VARCHAR(64) NOT NULL UNIQUE COMMENT '商户退款单号',
    order_no        VARCHAR(32) NOT NULL,
    refund_id       VARCHAR(64) DEFAULT '' COMMENT '微信退款单号',
    refund_amount   INT NOT NULL COMMENT '退款金额(分)',
    total_amount    INT NOT NULL COMMENT '原订单金额(分)',
    refund_reason   VARCHAR(255) DEFAULT '',
    refund_status   TINYINT DEFAULT 0 COMMENT '0处理中 1成功 2失败',
    apply_user      BIGINT UNSIGNED COMMENT '申请人ID',
    callback_data   TEXT,
    create_time     DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time     DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_order_no (order_no),
    INDEX idx_status (refund_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ===== 库存锁定记录（P0） =====
CREATE TABLE IF NOT EXISTS stock_lock_record (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    order_no        VARCHAR(32) NOT NULL,
    goods_id        BIGINT UNSIGNED NOT NULL,
    batch_no        VARCHAR(32) NOT NULL DEFAULT 'default',
    lock_num        INT NOT NULL DEFAULT 1,
    lock_status     TINYINT DEFAULT 1 COMMENT '1锁定中 2已扣减 3已释放',
    expire_time     DATETIME NOT NULL,
    create_time     DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time     DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_order_no (order_no),
    INDEX idx_expire (expire_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ===== 收货地址表 =====
CREATE TABLE IF NOT EXISTS addresses (
    id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id     VARCHAR(64) NOT NULL COMMENT '用户OpenID',
    name        VARCHAR(50) NOT NULL,
    phone       VARCHAR(20) NOT NULL,
    province    VARCHAR(50) DEFAULT '',
    city        VARCHAR(50) DEFAULT '',
    district    VARCHAR(50) DEFAULT '',
    detail      VARCHAR(200) NOT NULL,
    latitude    DOUBLE,
    longitude   DOUBLE,
    is_default  TINYINT(1) DEFAULT 0,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ===== 号码牌表 =====
CREATE TABLE IF NOT EXISTS pai_numbers (
    id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    number      VARCHAR(10) NOT NULL UNIQUE COMMENT '号码 01-99',
    status      ENUM('idle','in_use') DEFAULT 'idle',
    order_id    VARCHAR(32) DEFAULT '',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ===== 轮播图表 =====
CREATE TABLE IF NOT EXISTS banners (
    id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    image_url   VARCHAR(500) NOT NULL,
    link_url    VARCHAR(500) DEFAULT '',
    sort        INT DEFAULT 0,
    status      ENUM('on','off') DEFAULT 'on',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ===== 店铺配置表 =====
CREATE TABLE IF NOT EXISTS store_config (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    config_key      VARCHAR(50) NOT NULL UNIQUE DEFAULT 'store_config',
    name            VARCHAR(100) DEFAULT '小鲜鸡',
    address         VARCHAR(300) DEFAULT '',
    latitude        DOUBLE DEFAULT 23.1291,
    longitude       DOUBLE DEFAULT 113.2644,
    delivery_radius DOUBLE DEFAULT 5 COMMENT '配送半径(公里)',
    contact_name    VARCHAR(50) DEFAULT '',
    contact_phone   VARCHAR(20) DEFAULT '',
    open_time       VARCHAR(10) DEFAULT '08:00',
    close_time      VARCHAR(10) DEFAULT '21:00',
    create_time     DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time     DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ===== Refresh Token 表 =====
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id      BIGINT UNSIGNED NOT NULL,
    token        VARCHAR(256) NOT NULL UNIQUE,
    expires_at   DATETIME NOT NULL,
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_token (token),
    INDEX idx_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ===== 订单计数器表 =====
CREATE TABLE IF NOT EXISTS counters (
    counter_key VARCHAR(50) NOT NULL PRIMARY KEY,
    letter_idx  INT DEFAULT 0 COMMENT 'A-Z index',
    seq         INT DEFAULT 0 COMMENT '0-99999',
    value       INT DEFAULT 0 COMMENT '通用计数器'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 初始数据
-- ============================================================

-- 默认分类
INSERT INTO categories (name, sort) VALUES
  ('整鸡', 1), ('鸡腿', 2), ('鸡翅', 3), ('鸡胸', 4), ('内脏', 5), ('鸽子', 6);

-- 号码牌 01-99
INSERT INTO pai_numbers (number, status) VALUES
  ('01','idle'),('02','idle'),('03','idle'),('04','idle'),('05','idle'),
  ('06','idle'),('07','idle'),('08','idle'),('09','idle'),('10','idle'),
  ('11','idle'),('12','idle'),('13','idle'),('14','idle'),('15','idle'),
  ('16','idle'),('17','idle'),('18','idle'),('19','idle'),('20','idle'),
  ('21','idle'),('22','idle'),('23','idle'),('24','idle'),('25','idle'),
  ('26','idle'),('27','idle'),('28','idle'),('29','idle'),('30','idle'),
  ('31','idle'),('32','idle'),('33','idle'),('34','idle'),('35','idle'),
  ('36','idle'),('37','idle'),('38','idle'),('39','idle'),('40','idle'),
  ('41','idle'),('42','idle'),('43','idle'),('44','idle'),('45','idle'),
  ('46','idle'),('47','idle'),('48','idle'),('49','idle'),('50','idle'),
  ('51','idle'),('52','idle'),('53','idle'),('54','idle'),('55','idle'),
  ('56','idle'),('57','idle'),('58','idle'),('59','idle'),('60','idle'),
  ('61','idle'),('62','idle'),('63','idle'),('64','idle'),('65','idle'),
  ('66','idle'),('67','idle'),('68','idle'),('69','idle'),('70','idle'),
  ('71','idle'),('72','idle'),('73','idle'),('74','idle'),('75','idle'),
  ('76','idle'),('77','idle'),('78','idle'),('79','idle'),('80','idle'),
  ('81','idle'),('82','idle'),('83','idle'),('84','idle'),('85','idle'),
  ('86','idle'),('87','idle'),('88','idle'),('89','idle'),('90','idle'),
  ('91','idle'),('92','idle'),('93','idle'),('94','idle'),('95','idle'),
  ('96','idle'),('97','idle'),('98','idle'),('99','idle');

-- 默认店铺配置
INSERT INTO store_config (config_key, name, latitude, longitude, delivery_radius, contact_name, contact_phone)
VALUES ('store_config', '小鲜鸡线下体验店', 23.1291, 113.2644, 5, '', '');

-- 订单计数器初始化
INSERT INTO counters (counter_key, letter_idx, seq) VALUES ('order', 0, 0);
