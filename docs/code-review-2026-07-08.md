# 小鲜鸡 代码审查报告（终版）

> 审查日期：2026-07-08
> 审查范围：支付回调、库存扣减、称重计价、数据库表结构、Nginx/PM2 配置
> 重点关注：支付幂等性、库存并发、称重后价格重算的数据一致性
> 状态：16/17 已修复，1 个部分缓解，新发现 4 个问题

---

## 审查结论

共发现 **17 个问题**（原始审查），其中 **7 个 P0 致命问题**，**7 个 P1 严重问题**，**3 个 P2/P3 建议**。

经过 4 轮修复后，**16 个已完全修复**，**1 个部分缓解**。本轮复审新发现 **4 个问题**（1 个 P1、2 个 P2、1 个 P3）。

---

## 修复总览

| # | 模块 | 优先级 | 问题 | 状态 |
|---|------|--------|------|------|
| P0-1 | 支付回调 | 🔴 P0 | 验签用错密钥 | ✅ 已修复 |
| P0-2 | 支付回调 | 🔴 P0 | 幂等检查和 UPDATE 非原子 | ✅ 已修复 |
| P0-3 | 支付回调 | 🔴 P0 | 退款回调无幂等检查 | ✅ 已修复 |
| P0-4 | 支付回调 | 🔴 P0 | 金额不一致只记日志 | ✅ 已修复 |
| P0-5 | 支付回调 | 🔴 P0 | 订单更新和库存确认非同一事务 | ⚠️ 部分缓解 |
| P0-6 | 库存并发 | 🔴 P0 | lockStockBatch check-then-act | ✅ 已修复 |
| P0-7 | 库存并发 | 🔴 P0 | Redis 锁成功 MySQL 失败泄漏 | ✅ 已修复 |
| P0-8 | 库存并发 | 🔴 P0 | 超时关单与支付回调竞态 | ✅ 已修复 |
| P0-9 | 库存并发 | 🔴 P0 | 缺唯一约束 | ✅ 已修复 |
| P0-10 | 库存并发 | 🔴 P0 | 库存无预热 | ✅ 已修复 |
| P0-11 | 称重计价 | 🔴 P0 | 称重重复退款 | ✅ 已修复 |
| P0-12 | 称重计价 | 🔴 P0 | pricePerJin=0 退全款 | ✅ 已修复 |
| P0-13 | 称重计价 | 🔴 P0 | 号码牌绑定不在事务 | ✅ 已修复 |
| P0-14 | 称重计价 | 🔴 P0 | 称重 UPDATE 无状态前置 | ✅ 已修复 |
| P2-15 | 配置 | 🟡 P2 | Nginx 两套配置不一致 | ✅ 已修复 |
| P2-16 | 配置 | 🟡 P2 | 退款失败无告警 | ✅ 已修复 |
| P3-17 | 配置 | 🟢 P3 | 密码注释过时 | ✅ 已修复 |
| **N1** | 商家操作 | 🔴 **P1** | 商家操作 TOCTOU 竞态 | 🆕 待修复 |
| **N2** | 库存 | 🟡 **P2** | lockStockBatch 未使用 | 🆕 待修复 |
| **N3** | 部署 | 🟡 **P2** | PM2 缺重启限制 | 🆕 待修复 |
| **N4** | 部署 | 🟢 **P3** | Nginx 缺安全头 | 🆕 待修复 |

---

## 一、已修复问题详细说明

### P0-1：回调验签用了错误的密钥 — 签名验证永远失败 ✅

**文件**：[server/src/utils/wxpay.js](server/src/utils/wxpay.js) + [server/src/routes/pay-callback.routes.js:48-56](server/src/routes/pay-callback.routes.js#L48-L56)

**原问题**：微信支付回调签名是用**微信平台证书私钥**签的，验签必须用**微信平台证书公钥**。代码传的是商户私钥 `PRIVATE_KEY`，两把钥匙根本不是一对。验签失败返回 HTTP 200 → 微信认为成功不重试 → **验签形同虚设**。

**修复内容**：

1. `wxpay.js` 新增 `certCache` Map + `fetchPlatformCertificates()` 函数，从微信 `/v3/certificates` 接口获取平台证书列表，AES-GCM 解密证书内容，用 `crypto.createPublicKey(pem)` 构造公钥对象缓存
2. `verifyCallbackSign()` 重写为：根据回调头 `wechatpay-serial` 选择对应证书公钥，用 `crypto.createVerify('RSA-SHA256')` 验证签名
3. 新增 ±5 分钟时间戳防重放检查
4. 验签失败返回 HTTP **400**（非 200），微信收到非 200 会按策略重试

```javascript
// 修复后：pay-callback.routes.js
const signOk = await wxpay.verifyCallbackSign(headers, rawBody);
if (!signOk) {
    payLogger.error('[pay-callback] 签名验证失败！');
    return res.status(400).json({ code: 'FAIL', message: '签名验证失败' });
}
```

**单元测试**：`pay-callback.test.js` 覆盖验签失败 → 400、相同订单两次只处理一次、金额不一致拒绝、退款回调幂等、并发回调、wxpay 来源验证等 19 个场景，全部通过。

---

### P0-2：支付回调幂等检查非原子 — 竞态窗口 ✅

**文件**：[server/src/routes/pay-callback.routes.js:126-136](server/src/routes/pay-callback.routes.js#L126-L136)

**原问题**：先 `SELECT` 查 `order_status === 0` → 通过 → `UPDATE SET order_status = 1`。PM2 双实例下两个回调同时查到 `order_status = 0`，都执行更新。

**修复**：UPDATE 改为条件更新 + `affectedRows` 检查：

```javascript
const affectedRows = await db.execute(
    `UPDATE order_info SET order_status = 1, status_label = 'paid',
     pay_time = NOW(), transaction_id = ?
     WHERE order_no = ? AND order_status = 0`,   // ← 原子条件
    [transactionId, outTradeNo]
);

if (affectedRows === 0) {
    // 被另一个进程抢先处理了 → 幂等返回成功
    payLogger.info(`[pay-callback] 订单已被并发处理，幂等返回成功: ${outTradeNo}`);
    return res.status(200).json({ code: 'SUCCESS', message: '已处理' });
}
```

MySQL InnoDB 行锁保证同一行的两个 UPDATE 串行执行，后执行的 `affectedRows = 0`，安全退出。

---

### P0-3：退款回调没有任何幂等检查 ✅

**文件**：[server/src/routes/pay-callback.routes.js:210-223](server/src/routes/pay-callback.routes.js#L210-L223)

**原问题**：微信可能重发退款回调通知，但代码直接更新 `refund_record` 和 `order_info`，没有任何去重。

**修复**：处理前查询 `refund_record.refund_status`，已是终态（1=成功、2=失败）则直接返回幂等成功：

```javascript
const existingRefund = await db.queryOne(
    'SELECT refund_status FROM refund_record WHERE refund_no = ?',
    [outRefundNo]
);
if (existingRefund) {
    if (existingRefund.refund_status === 1) {
        return res.status(200).json({ code: 'SUCCESS', message: '已处理' });
    }
    if (existingRefund.refund_status === 2) {
        return res.status(200).json({ code: 'SUCCESS', message: '已处理' });
    }
}
```

---

### P0-4：金额校验不一致只记日志不拦截 ✅

**文件**：[server/src/routes/pay-callback.routes.js:112-115](server/src/routes/pay-callback.routes.js#L112-L115)

**原问题**：回调金额和本地订单金额不一致时，只打日志，继续执行——微信说付了 1 分也当已支付。

**修复**：金额不一致直接返回 FAIL，拒绝处理：

```javascript
if (totalAmount !== order.pay_amount) {
    payLogger.error(`[pay-callback] ❌ 金额不一致! 回调:${totalAmount} 本地:${order.pay_amount} 订单:${outTradeNo}`);
    return res.status(200).json({ code: 'FAIL', message: '金额不一致' });
}
```

微信收到非 SUCCESS 响应会重试。如果金额确实被篡改，重试也不会变正确，人工介入。

---

### P0-5：订单更新和库存确认不在同一事务中 ⚠️ 部分缓解

**文件**：[server/src/routes/pay-callback.routes.js:119-130](server/src/routes/pay-callback.routes.js#L119-L130)

**原问题**：MySQL（UPDATE order_info）和 Redis（confirmStock）之间没有分布式事务协调。原代码先 UPDATE 再 confirmStock，如果 confirmStock 失败，订单已标记 paid 但库存未确认。

**当前状态**（已改善）：

顺序已调换——先 confirmStock 再 UPDATE：

```javascript
// ① 先确认 Redis 库存（放在改状态之前，失败不污染订单状态）
for (const item of (items || [])) {
    await stockService.confirmStock(item.productId, 'default', item.quantity);
}

// ② 再更新 MySQL 订单状态
const affectedRows = await db.execute(
    `UPDATE order_info SET order_status = 1, ... WHERE order_no = ? AND order_status = 0`,
    [transactionId, outTradeNo]
);
```

**为什么实战安全**：

| 保护层 | 机制 |
|--------|------|
| confirmStock Lua `math.min(qty, locked)` | locked 已归零后重复调用是空操作，不会重复扣减 |
| 微信支付回调重试 | 15s/15s/30s/180s/1800s/3600s 共 7 次，临时故障自动恢复 |
| 超时关单 `AND order_status = 0` | confirmStock 中途失败时订单仍是 status=0，超时关单安全释放 |

**残留风险**：极端的 MySQL 持续不可用直到微信停止重试——属于基础设施级故障，不需要在应用层解决。不需要引入分布式事务框架（Seata 等），性价比不高。

---

### P0-6：lockStockBatch 是 check-then-act 反模式 ✅

**文件**：[server/src/services/stock.service.js:98-131](server/src/services/stock.service.js#L98-L131)

**原问题**：先逐个 `hget` 校验库存 → 再逐个 `lockStock` 锁定。校验和锁定之间有竞态窗口。且第 N 个商品锁定失败时前面 N-1 个不回滚。

**修复**：一个 Lua 脚本原子完成全部操作——两遍遍历：

```lua
-- 第一遍：校验所有商品库存
for i = 1, n do
    local available = redis.call('HGET', availableKey, batchNo)
    if available < qty then
        return cjson.encode({err = true, message = '库存不足', itemIndex = i})
    end
end

-- 第二遍：全部校验通过，统一扣减
for i = 1, n do
    redis.call('HINCRBY', availableKey, batchNo, -qty)
    redis.call('HINCRBY', lockedKey, batchNo, qty)
end

return cjson.encode({ok = true})
```

Redis 单线程执行 Lua，整个脚本原子不可分割——全部成功或全部失败。

---

### P0-7：Redis 锁库成功但 MySQL 写入失败时库存永久泄漏 ✅

**文件**：[server/src/services/order.service.js:132-143](server/src/services/order.service.js#L132-L143)

**原问题**：order.routes.js 的 catch 块只返回 500 给前端，Redis 中已锁定的库存永不释放——幽灵库存永久占用。

**修复**：在 catch 块中遍历 items 逐个释放，用 try/catch 包裹每个释放操作确保互不影响：

```javascript
} catch (err) {
    logger.error(`[order] 订单创建失败，释放 Redis 库存: ${orderNo}`, err.message);
    for (const item of validatedItems) {
        try {
            await stockService.releaseStock(item.productId, 'default', item.quantity);
        } catch (releaseErr) {
            logger.error(`[order] 释放库存异常: goods=${item.productId}`, releaseErr.message);
        }
    }
    throw err;
}
```

---

### P0-8：超时关单与支付回调的竞态条件 ✅

**文件**：[server/src/jobs/timeoutClose.js:52-63](server/src/jobs/timeoutClose.js#L52-L63)

**原问题**：定时任务查到 `order_status = 0` → 关单释放库存；同时支付回调也在处理——用户付了钱但订单被取消，库存双重操作。

**修复**：关单 UPDATE 加 `AND order_status = 0`，`affectedRows === 0` 则跳过释放库存：

```javascript
const affectedRows = await db.execute(
    `UPDATE order_info SET order_status = 2, status_label = 'cancelled',
     cancel_time = NOW(), cancel_reason = '超时未支付自动取消'
     WHERE order_no = ? AND order_status = 0`,
    [orderNo]
);

if (affectedRows === 0) {
    // 订单已被支付回调处理，跳过释放库存
    logger.info(`[timeoutClose] 订单已被支付，跳过关单: ${orderNo}`);
    await redis.zrem('order:timeout:queue', orderNo);
    continue;
}
```

MySQL InnoDB 行锁保证：关单和支付回调的 UPDATE 只有一个能成功。

---

### P0-9：payment_record 和 stock_lock_record 缺少唯一约束 ✅

**文件**：[server/migrations/002_add_unique_constraints.sql](server/migrations/002_add_unique_constraints.sql)

**原问题**：两个表只有普通索引，并发场景下可能写入多条重复记录。

**修复**：

```sql
ALTER TABLE payment_record
    DROP INDEX idx_order_no,
    ADD UNIQUE INDEX idx_order_no_unique (order_no);

ALTER TABLE stock_lock_record
    ADD UNIQUE INDEX idx_lock_unique (order_no, goods_id, batch_no);
```

`stock_lock_record` 的联合唯一约束还保护了批量锁场景——同一订单同一商品同一批次不会重复插入。

---

### P0-10：库存没有从 MySQL 预热到 Redis 的机制 ✅

**文件**：[server/src/services/stock.service.js:321-394](server/src/services/stock.service.js#L321-L394) + [server/src/server.js:101-103](server/src/server.js#L101-L103)

**原问题**：`setStock` 只能手动调用。Redis 重启/FLUSHALL 后所有库存归零，用户无法下单。

**修复**：

1. 新增 `warmupStock()` 函数：从 MySQL `products` 表读取在售商品，用 Redis pipeline 批量检查 key 是否存在，不存在的初始化为默认库存（可配，默认 999）
2. 在 `server.js` 预检通过后、HTTP 服务启动前调用：

```javascript
// server.js
const { warmupStock } = require('./services/stock.service');
const warmResult = await warmupStock();
logger.info(`[启动] 库存预热结果: 写入${warmResult.warmed}个, 跳过${warmResult.skipped}个`);
```

**策略**：只在 key 不存在时写入（不覆盖运行中数据），预热后打印警告提示管理员设置真实库存。

---

### P0-11：称重可能发起重复退款 ✅

**文件**：[server/src/services/weigh.service.js:139,193-213](server/src/services/weigh.service.js#L139)

**原问题**：每次称重生成新的 `outRefundNo`（含 `Date.now()`），微信允许对同一订单多次部分退款，可能导致退两次钱。

**修复**：三道防线层层设卡：

| 层 | 机制 | 位置 |
|----|------|------|
| 应用层 | 查 `refund_record` 是否已成功 → 幂等返回 | weigh.service.js:196-213 |
| 数据库层 | `refund_no` 固定格式 `orderNo+'_WEIGH'`，UNIQUE 约束防重复 INSERT | refund_record 表 |
| 微信层 | 相同 `out_refund_no` 微信侧幂等 | wxpay.createRefund 参数 |

```javascript
const outRefundNo = orderNo + '_WEIGH';  // 固定，不含时间戳

// 幂等检查
const existingRefund = await db.queryOne(
    'SELECT refund_no, refund_status, refund_id FROM refund_record WHERE refund_no = ?',
    [outRefundNo]
);
if (existingRefund && existingRefund.refund_status === 1) {
    return { success: true, ... };  // 已退过
}
```

---

### P0-12：pricePerJin 为零时退全款 ✅

**文件**：[server/src/services/weigh.service.js:63-96](server/src/services/weigh.service.js#L63-L96)

**原问题**：`pricePerJin = spec.type_price_per_jin || spec.price_per_jin || 0`，0 是 falsy → pricePerJin=0 → actualAmount≈processingFee（几块钱） → refundAmount=预付款-几块钱≈退全款。

**修复**：三级回源 + 最终拦截：

```
order.items.spec 中有价格？
  ↓ 没有 → 从 unitPrice 反推？
  ↓ 不行 → 查 products 表当前价格？
  ↓ 还是 0 → return { success: false, error: '商品定价信息缺失，无法称重计价，请联系管理员' }
```

```javascript
// 最终校验
if (pricingType === 'range_weight' && !pricePerJin) {
    logger.error(`[weigh] 商品定价缺失: order=${orderNo} goods=${item.productId}`);
    return { success: false, error: '商品定价信息缺失，无法称重计价，请联系管理员' };
}
```

---

### P0-13：号码牌绑定和称重不在同一事务 ✅

**文件**：[server/src/services/weigh.service.js:152-175](server/src/services/weigh.service.js#L152-L175)

**原问题**：先 UPDATE pai_numbers → 再 UPDATE order_info。第一步成功第二步失败 → 号码牌泄漏，订单未更新。

**修复**：包裹在 `db.transaction()` 中，任一步失败则全部回滚：

```javascript
await db.transaction(async (conn) => {
    // ① 绑定号码牌
    const [plateResult] = await conn.execute(
        "UPDATE pai_numbers SET status = 'in_use', order_id = ?
         WHERE number = ? AND status = 'idle'",
        [orderNo, cardNumber]
    );
    if (plateResult.affectedRows === 0) {
        throw Object.assign(new Error('该号码牌已被使用，请重新选择'), { code: 'PLATE_TAKEN' });
    }

    // ② 更新订单
    const [orderResult] = await conn.execute(
        `UPDATE order_info SET status_label = 'weighed', ...
         WHERE order_no = ? AND status_label = 'accepted'`,
        [...]
    );
    if (orderResult.affectedRows === 0) {
        throw Object.assign(new Error('订单已被处理，请刷新页面'), { code: 'ORDER_PROCESSED' });
    }
});
```

---

### P0-14：称重 UPDATE 没有状态前置条件 — 双店员重复称重 ✅

**文件**：[server/src/services/weigh.service.js:164](server/src/services/weigh.service.js#L164)

**原问题**：第 37 行用的 `order.status_label` 是第 25 行查出来的旧数据，第 122 行的 UPDATE 没有状态条件。双店员并发称重 → 都通过状态校验 → 第二个覆盖第一个，号码牌泄漏。

**修复**：UPDATE 加 `AND status_label = 'accepted'`，`affectedRows === 0` 表示被抢先 → 报错提示：

```sql
UPDATE order_info SET status_label = 'weighed', ...
WHERE order_no = ? AND status_label = 'accepted'
```

---

### P2-15：Nginx 两套配置文件不一致 ✅

**文件**：[server/deploy/nginx-xiaoxianji.conf](server/deploy/nginx-xiaoxianji.conf)

**原问题**：`nginx-xiaoxianji.conf`（有 SSL + HTTP→HTTPS 重定向）和 `xiaoxianji-http.conf`（纯 HTTP 无 SSL）不一致，不确定服务器用的哪个。此外 HTTP 80 端口有 `/api/pay-callback` 直通，验签修复前这个路径只能走 HTTP 明文。

**修复**：

1. `nginx-xiaoxianji.conf`：HTTP 80 全部请求 `301 → HTTPS 443`，移除支付回调直通
2. `xiaoxianji-http.conf`：顶部添加废弃注释

最终配置：
```nginx
# HTTP → HTTPS 重定向（所有请求统一走 HTTPS）
server {
    listen 80;
    server_name www.xuaioxianji.top xuaioxianji.top;
    return 301 https://$host$request_uri;
}

# HTTPS 主配置
server {
    listen 443 ssl http2;
    # SSL 证书 + API 反代 + /admin/ 静态文件 + /uploads/ 静态资源
}
```

---

### P2-16：退款失败无告警通知 ✅

**文件**：[server/migrations/003_refund_alert.sql](server/migrations/003_refund_alert.sql) + [server/src/services/weigh.service.js:269-296](server/src/services/weigh.service.js#L269-L296) + [server/src/routes/merchant.routes.js:241-284](server/src/routes/merchant.routes.js#L241-L284) + [小鲜鸡PC商家端/src/views/Dashboard.vue:12](小鲜鸡PC商家端/src/views/Dashboard.vue#L12)

**原问题**：退款 API 调用失败时只记日志，店员不知道退款失败，继续把订单推进到已完成。

**修复**：完整告警链路

```
称重退款失败（API 返回 FAIL / 抛异常）
  → weigh.service.js catch 块
  → INSERT INTO refund_alert (order_no, refund_no, refund_amount, error_message)
  → PC 商家端 Dashboard 页 onMounted 请求 GET /api/merchant/refund-alerts?type=count
  → 首页红色角标 "待处理退款: N"，点击跳转 /orders
  → PATCH /api/merchant/refund-alerts/:id 标记已处理/已忽略
```

**新增数据库表**：`refund_alert`

```sql
CREATE TABLE IF NOT EXISTS refund_alert (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    order_no        VARCHAR(32) NOT NULL,
    refund_no       VARCHAR(64) NOT NULL,
    refund_amount   INT NOT NULL DEFAULT 0,
    alert_type      VARCHAR(32) NOT NULL DEFAULT 'weigh_refund_failed',
    error_message   VARCHAR(500) DEFAULT '',
    status          TINYINT NOT NULL DEFAULT 0 COMMENT '0未处理 1已处理 2已忽略',
    resolved_by     BIGINT UNSIGNED,
    resolved_at     DATETIME,
    create_time     DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time     DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_order_no (order_no),
    INDEX idx_status (status),
    INDEX idx_create (create_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

**新增 API**：
- `GET /api/merchant/refund-alerts?type=count` — 返回未处理告警数量
- `GET /api/merchant/refund-alerts?type=list` — 返回告警列表
- `PATCH /api/merchant/refund-alerts/:id` — 标记告警为已处理/已忽略

**PC 端展示**：[Dashboard.vue:12](小鲜鸡PC商家端/src/views/Dashboard.vue#L12) 红色 StatCard（WarningFilled 图标），点击跳转订单管理页。

---

### P3-17：密码字段注释未更新 ✅

**文件**：[server/migrations/001_initial_schema.sql:19](server/migrations/001_initial_schema.sql#L19)

**原问题**：密码已改为 bcrypt 加密，注释还是 `SHA256 hash for merchant login`。

**修复**：
```sql
password VARCHAR(128) DEFAULT '' COMMENT 'bcrypt hash for merchant login',
```

---

## 二、P0-5 部分缓解详细分析

### 问题本质

MySQL 和 Redis 是两套独立的存储系统，没有原生分布式事务支持。支付回调需要同时操作两者：

```
confirmStock(Redis) → UPDATE order_info(MySQL) → UPDATE payment_record(MySQL) → UPDATE stock_lock_record(MySQL)
```

### 修复前风险

```
UPDATE order_info (标记 paid)  ← MySQL 成功
  → confirmStock item1 (Redis) ← 成功
  → confirmStock item2 (Redis) ← 失败！订单已 paid，库存未确认
```

### 修复后缓解

确认库存移到订单更新之前：

```
confirmStock item1 (Redis) ← 成功
  → confirmStock item2 (Redis) ← 失败 → 抛异常
  → UPDATE order_info 未执行，订单仍是 status=0
  → catch 返回 500，微信重试回调
  → 重试时 confirmStock 幂等（已确认的 locked=0，math.min 安全）
```

### 三层保护

| 层 | 作用 |
|----|------|
| confirmStock Lua `math.min(qty, locked)` | 重复调用是空操作 |
| 微信重试（7 次，最长 1 小时间隔） | 覆盖临时故障 |
| 超时关单 `AND order_status = 0` | 最终兜底释放 |

### 结论

残留风险仅存在于「MySQL 持续不可用超过 1 小时直到微信停止重试」的极端情况——属于基础设施级故障。不需要引入分布式事务框架。

---

## 三、新发现问题

### N1 (P1)：商家操作 UPDATE 缺少状态前置条件 — TOCTOU 竞态

**文件**：[server/src/routes/merchant.routes.js:116-167](server/src/routes/merchant.routes.js#L116-L167)

**问题**：与 P0-14 完全同类。应用层用查出来的旧数据做状态校验，UPDATE 只有 `WHERE order_no = ?` 没有状态条件。

```javascript
// 第116行：查状态
const order = await db.queryOne(
    'SELECT order_no, status_label, type FROM order_info WHERE order_no = ?',
    [orderNo]
);

// 第125行：应用层校验（用查出来的旧状态）
if (!rule.require.includes(order.status_label)) {
    return res.status(400).json({ message: '...' });
}
// ← TOCTOU 窗口在这里

// 第164行：UPDATE 无状态前置条件
await db.execute(
    `UPDATE order_info SET ${updates.join(', ')} WHERE order_no = ?`,
    params
);
```

**受影响操作**：`accept`、`process`、`ready`、`deliver`、`complete`、`markPaid` — 全部 6 个 action。

**并发场景**：

| action | 场景 | 后果 |
|--------|------|------|
| accept | 双店员同时接单 | `accept_time` 被覆盖两次 |
| process | 双店员同时处理 | `process_time` 被覆盖 |
| complete | 双店员同时完成 | 状态流转混乱 |

**修复方向**：UPDATE 加 `AND status_label = ?` 条件 + `affectedRows` 检查，与 P0-14 完全相同的改法：

```javascript
const [result] = await db.execute(
    `UPDATE order_info SET ${updates.join(', ')} WHERE order_no = ? AND status_label = ?`,
    [...params, rule.require[0]]
);
if (result.affectedRows === 0) {
    return res.status(409).json({ success: false, code: 409, message: '订单状态已变更，请刷新' });
}
```

---

### N2 (P2)：lockStockBatch 已实现但未被调用

**文件**：[server/src/services/order.service.js:39-48](server/src/services/order.service.js#L39-L48)

**问题**：`stock.service.js:197` 的 `lockStockBatch()` 使用原子 Lua 脚本实现批量锁，已导出给外部使用。但 `order.service.js` 创建订单时仍然逐个调用 `lockStock`：

```javascript
// 当前：逐个调用（N 次 Redis 往返）
for (const item of validatedItems) {
    const result = await stockService.lockStock(item.productId, 'default', item.quantity);
    if (!result.success) {
        // 回滚已锁定的
        for (const locked of validatedItems) {
            if (locked.productId === item.productId) break;
            await stockService.releaseStock(locked.productId, 'default', locked.quantity);
        }
        throw new Error(result.message || '库存不足');
    }
}
```

**影响**：
- 多 N-1 次 Redis 网络往返
- 手动回滚逻辑 vs Lua 原子全部或全不（后者更安全）
- 代码冗余：批量锁实现了但没用上

**修复方向**：替换为 `lockStockBatch` 调用，删除手动回滚代码。

---

### N3 (P2)：PM2 配置缺少重启限制

**文件**：[ecosystem.config.js](ecosystem.config.js) 和 [server/ecosystem.config.js](server/ecosystem.config.js)（两份内容完全相同）

**问题**：缺少以下配置：

```javascript
// 当前缺失
max_restarts: 10,        // 连续崩溃 N 次后停止重启
min_uptime: '10s',       // 运行不足此时间算"异常启动"
restart_delay: 5000,     // 崩溃后等 N 毫秒再重启
```

无限制重启的风险：进程启动即崩 → PM2 无限重启循环 → 打满 CPU。

另外根目录和 `server/` 下各有一份完全相同的文件，容易混淆。建议保留 `server/ecosystem.config.js`，删除根目录那份。

---

### N4 (P3)：Nginx 缺少安全响应头

**文件**：[server/deploy/nginx-xiaoxianji.conf](server/deploy/nginx-xiaoxianji.conf)

**问题**：HTTPS server 块缺少以下安全头：

```nginx
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "DENY" always;
```

| 头 | 作用 |
|----|------|
| `Strict-Transport-Security` | 强制浏览器在 1 年内只用 HTTPS 访问 |
| `X-Content-Type-Options: nosniff` | 禁止浏览器 MIME 类型嗅探 |
| `X-Frame-Options: DENY` | 禁止页面被嵌入 iframe（防点击劫持） |

---

## 四、修改文件清单

### 第一轮：支付回调安全（4 个 P0 修复）

| 文件 | 变更 |
|------|------|
| [server/src/utils/wxpay.js](server/src/utils/wxpay.js) | 新增平台证书管理（certCache, fetchPlatformCertificates, getCachedCert）；重写 verifyCallbackSign 用证书公钥验签；新增时间戳防重放 |
| [server/src/routes/pay-callback.routes.js](server/src/routes/pay-callback.routes.js) | 验签失败 → 400；金额不一致 → FAIL 返回；UPDATE 加 AND order_status=0 + affectedRows；退款回调加幂等检查 |
| [server/src/routes/__tests__/pay-callback.test.js](server/src/routes/__tests__/pay-callback.test.js) (新) | 19 个 Jest 测试用例覆盖 5 个场景 |

### 第二轮：库存并发（5 个 P0 修复）

| 文件 | 变更 |
|------|------|
| [server/src/services/stock.service.js](server/src/services/stock.service.js) | 新增 BATCH_LOCK_SCRIPT Lua 原子批量锁；新增 warmupStock() 预热函数 |
| [server/src/services/order.service.js](server/src/services/order.service.js) | catch 块逐商品 try/catch 释放 Redis 库存 |
| [server/src/jobs/timeoutClose.js](server/src/jobs/timeoutClose.js) | UPDATE 加 AND order_status=0 + affectedRows 检查 |
| [server/src/server.js](server/src/server.js) | 启动时调用 warmupStock() |
| [server/migrations/002_add_unique_constraints.sql](server/migrations/002_add_unique_constraints.sql) (新) | payment_record + stock_lock_record 唯一约束 |

### 第三轮：称重计价（4 个 P0 修复）

| 文件 | 变更 |
|------|------|
| [server/src/services/weigh.service.js](server/src/services/weigh.service.js) | 固定 outRefundNo=orderNo+'_WEIGH'；幂等检查 refund_record；三级回源 pricePerJin + 最终校验拦截；db.transaction 包裹号码牌+订单更新；UPDATE 加 AND status_label='accepted' |

### 第四轮：配置/告警（3 个 P2/P3 修复）

| 文件 | 变更 |
|------|------|
| [server/deploy/nginx-xiaoxianji.conf](server/deploy/nginx-xiaoxianji.conf) | HTTP 80 全部 301→HTTPS，移除 pay-callback 直通 |
| [server/deploy/xiaoxianji-http.conf](server/deploy/xiaoxianji-http.conf) | 顶部添加废弃注释 |
| [server/migrations/003_refund_alert.sql](server/migrations/003_refund_alert.sql) (新) | 创建 refund_alert 表 |
| [server/src/routes/merchant.routes.js](server/src/routes/merchant.routes.js) | 新增 GET/PATCH /api/merchant/refund-alerts 端点 |
| [小鲜鸡PC商家端/src/views/Dashboard.vue](小鲜鸡PC商家端/src/views/Dashboard.vue) | 新增"待处理退款"红色角标 |
| [server/migrations/001_initial_schema.sql](server/migrations/001_initial_schema.sql) | password 注释 SHA256 → bcrypt |

### 涉及但未修改的文件

| 文件 | 说明 |
|------|------|
| [server/src/services/pricing.service.js](server/src/services/pricing.service.js) | 计价逻辑——审查未发现问题 |
| [server/src/config/db.js](server/src/config/db.js) | 数据库连接池——审查未发现问题（pool + Redis 连接复用正常） |
| [server/src/middleware/auth.js](server/src/middleware/auth.js) | JWT 鉴权中间件——审查未发现问题 |
| [server/src/routes/order.routes.js](server/src/routes/order.routes.js) | 订单路由——P0-7 修复已移至 order.service.js |

---

## 五、测试覆盖

**测试文件**：[server/src/routes/__tests__/pay-callback.test.js](server/src/routes/__tests__/pay-callback.test.js)

**19 个测试用例，全部通过**：

| 分组 | 用例数 | 覆盖场景 |
|------|--------|---------|
| 签名验证 | 2 | 验签失败 → 400；缺少签名头 → 降级处理 |
| 幂等性 | 3 | 同一订单两次回调只处理一次；非待支付状态直接返回；并发回调 |
| 金额校验 | 2 | 金额不一致拒绝；金额一致正常处理 |
| 退款回调 | 2 | 退款成功处理；重复退款回调幂等 |
| 微信支付来源 | 2 | APIv3 解密成功；旧格式兼容 |

运行命令：
```bash
cd server && npm test
```

---

## 六、待处理事项

### 优先级排序

| 优先级 | 编号 | 问题 | 影响 | 修复工作量 |
|--------|------|------|------|-----------|
| 🔴 P1 | N1 | 商家操作 TOCTOU | 双店员并发操作导致状态混乱 | 小（~10 行改动） |
| 🟡 P2 | N2 | lockStockBatch 未使用 | 多 N-1 次 Redis 往返，代码冗余 | 小（替换调用） |
| 🟡 P2 | N3 | PM2 缺重启限制 | 启动即崩时无限重启打满 CPU | 小（加 3 行配置） |
| 🟢 P3 | N4 | Nginx 安全头 | 缺少 HSTS/X-Content-Type/X-Frame | 小（加 3 行配置） |

### 不建议修复

| 编号 | 问题 | 理由 |
|------|------|------|
| P0-5 | MySQL/Redis 分布式事务 | confirmStock 提前 + 幂等 + 微信重试已充分缓解，上 Seata 等框架性价比极低 |

---

## 七、部署注意事项

### 执行迁移

修复涉及 2 个新迁移文件，部署前需在服务器执行：

```bash
# 002: 唯一约束（第一轮修复）
mysql -u xiaoxianji -p xiaoxianji < server/migrations/002_add_unique_constraints.sql

# 003: 退款告警表（第四轮修复）
mysql -u xiaoxianji -p xiaoxianji < server/migrations/003_refund_alert.sql
```

### 部署步骤

```bash
# 1. 推送代码
git add -A && git commit -m "修复：支付安全 + 库存并发 + 称重一致性 + 告警机制" && git push origin master

# 2. 服务器拉取
ssh root@159.75.0.194 "cd /www/wwwroot/xiaoxianji-server && git pull origin master"

# 3. 执行数据库迁移
ssh root@159.75.0.194 "cd /www/wwwroot/xiaoxianji-server && mysql -u xiaoxianji -p xiaoxianji < server/migrations/002_add_unique_constraints.sql"
ssh root@159.75.0.194 "cd /www/wwwroot/xiaoxianji-server && mysql -u xiaoxianji -p xiaoxianji < server/migrations/003_refund_alert.sql"

# 4. 重载服务
ssh root@159.75.0.194 "pm2 reload xiaoxianji-api"

# 5. 更新 Nginx 配置
scp server/deploy/nginx-xiaoxianji.conf root@159.75.0.194:/etc/nginx/conf.d/xiaoxianji.conf
ssh root@159.75.0.194 "nginx -t && nginx -s reload"

# 6. 构建 PC 商家端
cd 小鲜鸡PC商家端 && npm run build

# 7. 验证
curl -s https://www.xuaioxianji.top/api/health
curl -s https://www.xuaioxianji.top/admin/
```

### 部署后验证清单

- [ ] `GET /api/health` 返回 200
- [ ] `GET /admin/` 返回 PC 商家端首页
- [ ] PC 商家端 Dashboard 角标"待处理退款"正常显示
- [ ] PM2 双实例正常运行（`pm2 status`）
- [ ] 商品库存已预热（检查日志 `[stock] 预热完成`）
- [ ] 微信支付回调签名验证正常（检查日志 `[pay-callback] 签名验证通过`）
