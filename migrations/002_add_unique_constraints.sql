-- ============================================================
-- 小鲜鸡 数据库迁移 002：添加唯一约束
-- ============================================================
-- 目的：
--   1. payment_record 防同一订单写入多条支付流水
--   2. stock_lock_record 防同一订单+商品+批次写入多条锁定记录
--
-- 执行前检查（如有重复数据需先清理）：
--   SELECT order_no, COUNT(*) c FROM payment_record GROUP BY order_no HAVING c > 1;
--   SELECT order_no, goods_id, batch_no, COUNT(*) c FROM stock_lock_record GROUP BY order_no, goods_id, batch_no HAVING c > 1;
-- ============================================================

USE xiaoxianji;

-- payment_record：一个订单只应有一条支付流水
-- 先删除旧的普通索引，再建唯一索引
ALTER TABLE payment_record
  DROP INDEX idx_order_no,
  ADD UNIQUE INDEX idx_order_no_unique (order_no);

-- stock_lock_record：一个订单的同一商品+批次只应有一条锁定记录
ALTER TABLE stock_lock_record
  ADD UNIQUE INDEX idx_lock_unique (order_no, goods_id, batch_no);
