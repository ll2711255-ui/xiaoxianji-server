-- ============================================================
-- 002: 订单发货追踪（微信「订单发货管理」强制接入）
-- ============================================================
-- 微信 2025 年新规：实物电商小程序必须接入订单与卡包管理，
-- 发货后需上报物流/自提信息，否则支付被拦截（errno: 102）
-- 且未上报发货会导致资金冻结、无法结算。
-- ============================================================

USE xiaoxianji;

-- 发货信息 JSON（同城配送/自提/物流 公用同一列）
-- delivery: { type, carrier?, trackingNo?, deliverTime, deliverBy? }
-- pickup:   { type, pickupTime, pickedUpAt?, pickedUpBy? }
-- 微信上报状态：0=未上报 1=上报成功 2=上报失败
ALTER TABLE order_info
  ADD COLUMN delivery_info     JSON COMMENT '发货信息（同城/自提/物流）' AFTER weigh_info,
  ADD COLUMN shipping_uploaded TINYINT(1) DEFAULT 0 COMMENT '微信发货上报状态：0未上报 1成功 2失败' AFTER delivery_info,
  ADD COLUMN shipping_log      JSON COMMENT '微信发货上报响应日志' AFTER shipping_uploaded;
