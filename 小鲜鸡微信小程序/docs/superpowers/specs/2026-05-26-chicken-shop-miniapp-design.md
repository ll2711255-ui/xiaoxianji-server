# 生鲜鸡肉店微信小程序 —— 顾客端设计文档

> 日期：2026-05-26
> 状态：待审核

---

## 1. 项目概述

为单一生鲜鸡肉店铺开发的微信小程序，第一期先完成**顾客端**。

- 技术方案：微信原生小程序 + 云开发（云函数 + 云数据库 + 云存储）
- 计价模式：按斤计价、重量范围预收、称重后差额原路退款

**本期范围（顾客端）**：商品浏览、购物车、下单支付、订单查看、扫码取货状态页、个人中心。商家端操作（接单、称重上传、号码牌管理、小票打印等）属于下一期。

---

## 2. 顾客端结构

四个底部 Tab + 全局扫码能力：

```
┌──────────┬──────────┬──────────┬──────────┐
│  商品页   │  购物车  │   订单   │   我的   │
│  goods   │   cart   │  orders  │   mine   │
└──────────┴──────────┴──────────┴──────────┘
```

### 2.1 商品页（goods）

**分类导航**：整鸡、鸡腿、鸡翅、鸡胸、内脏、鸽子等

**商品列表**：缩略图 + 名称 + 起售价 + 销量标签

**商品详情**——规格选择根据计价类型动态展示：

#### 重量范围计价（整鸡）——四级规格

| 规格 | 选项示例 | 影响 |
|------|---------|------|
| 规格一：鸡肉类型 | 毛鸡 / 光鸡 / 鲜肉鸡 | 每斤单价不同 |
| 规格二：重量范围 | 1500g(±100g) / 2000g(±100g) / 2500g(±100g) | 按上限计价 |
| 规格三：处理方式 | 整鸡 / 切块 | 切块有附加费 |
| 规格四：取货方式 | 即时配送 / 即时自取 / 预约时间 | 决定订单类型 |

**计价公式**：`预收金额 = 所选类型每斤单价 × 重量上限(斤) + 处理附加费`

#### 精确重量计价（鸡腿、鸡翅、鸡胸、内脏等）——三级规格

| 规格 | 选项示例 | 影响 |
|------|---------|------|
| 规格二：重量 | 500g / 1000g / 1500g | 按所选精确重量计价 |
| 规格三：处理方式 | 整只 / 切块 | 切块有附加费 |
| 规格四：取货方式 | 即时配送 / 即时自取 / 预约时间 | 决定订单类型 |

**计价公式**：`金额 = 每斤单价 × 所选重量(斤) + 处理附加费`

#### 按只计价（鸽子）——三级规格

| 规格 | 选项示例 | 影响 |
|------|---------|------|
| 规格二：按只计价 | 25元/只 | 固定单价 |
| 规格三：处理方式 | 整只 / 切块 | 切块有附加费 |
| 规格四：取货方式 | 即时配送 / 即时自取 / 预约时间 | 决定订单类型 |

> 无规格一。`金额 = 25元 × 数量 + 处理附加费`

### 2.2 购物车（cart）

- 购物车商品列表（显示已选规格，根据具体商品而定）
- 修改数量 / 删除
- 合计预估价
- 去结算按钮

### 2.3 下单确认（checkout）

从购物车点击"去结算"后进入：

- **配送订单**：选择/新增收货地址 + 选择配送时间（即时/预约） + 确认商品+金额 → 提交支付
- **自取订单**：选择自取时间（即时/预约） + 确认商品+金额 → 提交支付
- 支付：调用微信支付，支付成功后跳转订单详情

### 2.4 订单（orders）

**订单列表**：Tab 切换（全部 / 进行中 / 已完成）

**订单状态流转**：

```
配送订单：待支付 ─→ 接单 ─→ 称重 ─→ 处理 ─→ 配送中 ─→ 完成
              │         │        │
              │         │        ├── 已取消（鸡腿鸡翅等 exact_weight）
              │         │
              ├── 已取消（整鸡/鸽子）
              │
自提订单：待支付 ─→ 接单 ─→ 称重 ─→ 处理 ─→ 待取货 ─→ 完成
              │         │        │
              │         │        ├── 已取消（鸡腿鸡翅等 exact_weight）
              │         │
              ├── 已取消（整鸡/鸽子）
```

> **cancelled 可从以下状态发起：**
> - 整鸡 / 鸽子：仅 `pending`
> - 鸡腿鸡翅等（exact_weight）：`pending` / `accepted` / `weighed`
>
> 处理中（`processing`）及之后所有状态均不可取消。

**取消规则（按商品计价类型）：**

| 商品类型 | 可取消状态 | cancelOrder 校验 |
|---------|-----------|-----------------|
| 整鸡（range_weight） | `pending` | `status === 'pending'` |
| 鸡腿/鸡翅/鸡胸/内脏（exact_weight） | `pending` / `accepted` / `weighed` | `status in ['pending','accepted','weighed']` |
| 鸽子（per_piece） | `pending` | `status === 'pending'` |

| 状态 | 顾客端展示 |
|------|-----------|
| 接单 | 订单已确认，商家准备中 |
| 称重 | 展示称重照片、实际重量、实收金额、退款金额 |
| 处理 | 商品处理中（切块/打包） |
| 配送中 | 骑手配送中（配送订单） |
| 待取货 | 商品已准备好，显示号码牌编号，请到店取货（自提订单） |
| 完成 | 已送达 / 已取货 |

**订单详情**包含：
- 商品清单（含已选规格）
- 预收金额
- 称重照片 + 实际重量 + 实收金额
- 退款金额 + 退款状态
- 取货方式 + 时间
- **自提订单**：显示电子凭证 + 号码牌编号

### 2.5 我的（mine）

- 微信头像/昵称、手机号绑定
- 收货地址管理
- 扫码取货（扫线下小票二维码 → 跳转 `pages/pickup/pickup` 取货状态页）
- 关于

#### 取货状态页（pages/pickup/pickup）

- 从微信扫一扫进入，`onLoad` 解析 `orderNo` 和 `token` 参数
- 任一参数缺失 → 显示「无效的取货码」
- 每次请求携带 `token` 做验证
- 处理中：等待动画
- 已完成：全屏绿色「可以取货了」+ 订单号 + 号码牌编号

#### app.json 完整页面注册

```json
{
  "pages": [
    "pages/goods/goods",
    "pages/goods/detail/detail",
    "pages/cart/cart",
    "pages/checkout/checkout",
    "pages/orders/orders",
    "pages/orders/detail/detail",
    "pages/mine/mine",
    "pages/mine/address/address",
    "pages/pickup/pickup"
  ],
  "window": {
    "navigationBarTitleText": "小鲜鸡"
  }
}
```

---

## 3. 业务流程

### 3.1 线上下单配送 / 线上下单到店自取

```
顾客选商品 + 选择对应规格 → 加购物车 → 结算
  → 选择配送地址 / 选择自取时间（即时自取或预约）
  → 微信支付（预收金额）
  → 商家：接单 → 称重拍照上传 →（重量范围计价如有差额）退款 → 处理
  → 配送：配送员配送 / 顾客到店自取（凭号码牌编号）
  → 完成
```

### 3.2 线下选货 + 线下取货（纸制小票）

线下流程无预收/退款环节——顾客先选货称重，按实际重量定价后再付款。

```
完整流程（商家端部分下期实现）：

  顾客到店挑选商品 → 现场称重 → 确定实际价格
    → 商家在商家端输入金额
    → 顾客出示微信付款码 → 放收款盒子扫码支付
    → 微信支付回调 → 系统生成订单号
    → 屏幕显示收款成功
    → 屏幕弹出号码牌选择面板（绿色=空闲可选，灰色=使用中）
    → 商家随手拿空闲牌 → 点击对应编号完成绑定
    → 自动打印纸制小票（含二维码）
    → 号码牌挂在商品上
    → 商家处理商品
    → 商家输入号码牌编号（如 07）→ 系统显示对应订单信息
    → 确认处理完成 → 订单完成 → 07号牌自动释放变空闲
    → 推送微信通知给顾客

本期顾客端实现：
    → 顾客扫小票二维码 → 跳转取货状态页
       - 处理中：等待动画
       - 已完成：全屏绿色「可以取货了」+ 订单号 + 号码牌编号
    → 顾客凭号码牌到前台取货 → 商家确认 → 号码牌回收
```

**纸质小票格式：**

```
┌────────────────────┐
│      小鲜鸡        │
│                    │
│  订单号：A023      │
│  号码牌：07        │
│  ¥120.40           │
│                    │
│     [二维码]       │
│   扫码查看取货进度  │
│                    │
│  2026-05-26 14:35  │
└────────────────────┘
```

> 线下订单仅记录总金额，无商品明细。二维码指向小程序取货状态页。

**二维码跳转逻辑：**

1. **Token 生成**（商家端 bind 接口成功后）：
   - `token = md5(orderNo + TOKEN_SECRET)` 取前 8 位
   - 存入 `offline_orders.token` 字段
   - 环境变量新增 `TOKEN_SECRET`

2. **小程序码生成**（商家端 bind 接口成功后）：
   - 调用微信 `getwxacodeunlimit` 接口生成小程序码
   - `scene` 参数：`orderNo=A023&token=a8f3k2p9`
   - `page` 参数：`pages/pickup/pickup`
   - 生成的图片 buffer 直接传给打印机打印

3. **查询接口验证**（云函数 `getPickupStatus`）：
   - 入参：`orderNo` + `token`
   - 调用 `verifyToken` 验证，不通过返回「取货码无效」

4. **用户取货页面**（`pages/pickup/pickup`）：
   - `onLoad` 从 `options` 取 `orderNo` 和 `token`
   - 两个参数缺一显示「无效的取货码」
   - 每次请求都携带 `token` 做验证

5. **页面注册**（`app.json`）：
   - `pages` 中注册 `pages/pickup/pickup`
   - `navigationBarTitleText` 设为「取货进度」

---

## 4. 数据模型

### 4.1 categories（商品分类）

| 字段 | 类型 | 说明 |
|------|------|------|
| _id | string | |
| name | string | 分类名 |
| sort | number | 排序 |

### 4.2 products（商品）

三种计价类型，规格结构不同：

**range_weight（整鸡）——完整四级规格：**

| 字段 | 类型 | 说明 |
|------|------|------|
| pricing_type | string | `range_weight` |
| price_per_jin | number | 基础每斤单价（规格一可选不同类型覆盖） |
| specs | object[] | 穷举所有类型×重量×处理方式组合，预计算价格 |
| specs[].type | string | 规格一：毛鸡/光鸡/鲜肉鸡 |
| specs[].type_price_per_jin | number | 该类型的每斤单价 |
| specs[].weight_label | string | 规格二：显示名如"1500g(±100g)" |
| specs[].weight_max | number | 规格二：计价上限克数 |
| specs[].processing | string | 规格三：整鸡/切块 |
| specs[].processing_fee | number | 规格三附加费 |
| specs[].prepay_price | number | 该组合预估金额 |

**exact_weight（鸡腿/鸡翅/鸡胸/内脏）——三级规格：**

| 字段 | 类型 | 说明 |
|------|------|------|
| pricing_type | string | `exact_weight` |
| price_per_jin | number | 每斤单价 |
| weight_options | number[] | 重量选项：`[500, 1000, 1500]`（克） |
| processing_options | string[] | 处理方式：`['整只', '切块']` |
| processing_fee | number | 切块附加费 |

**per_piece（鸽子）——三级规格：**

| 字段 | 类型 | 说明 |
|------|------|------|
| pricing_type | string | `per_piece` |
| unit_price | number | 每只单价（25元） |
| processing_options | string[] | 处理方式：`['整只', '切块']` |
| processing_fee | number | 切块附加费 |

**三种类型共有字段：**

| 字段 | 类型 | 说明 |
|------|------|------|
| _id | string | |
| name | string | 商品名 |
| categoryId | string | 所属分类 |
| images | string[] | 商品图片 |
| delivery_modes | string[] | 可选取货方式 |
| status | string | `on` / `off` |
| sales | number | 销量 |
| createTime | date | |

### 4.3 orders（订单）

| 字段 | 类型 | 说明 |
|------|------|------|
| _id | string | |
| orderNo | string | 订单编号 |
| userId | string | 顾客 openid |
| type | string | `delivery` / `pickup` / `offline` |
| items | object[] | 商品列表（线下订单无此字段） |
| items[].productId | string | |
| items[].productName | string | |
| items[].spec | object | 已选规格 |
| items[].quantity | number | |
| items[].unitPrice | number | |
| prepayAmount | number | 预收金额（分，线下订单无此字段） |
| actualWeight | number | 实际称重克数 |
| actualAmount | number | 实收金额（分）；线下订单为此金额直接支付 |
| weighPhoto | string | 称重照片云存储 fileID |
| refundAmount | number | 退款金额（分，线下订单无此字段） |
| refundStatus | string | `none` / `processing` / `done` |
| status | string | 线上：`pending` → `accepted` → `weighed` → `processing` → `delivering`（配送）/ `ready`（待取货） → `completed` / `cancelled`；线下：`paid` → `processing` → `completed` |
| pickupTime | date | 自取时间 |
| deliveryAddress | object | 配送地址 |
| deliveryTime | date | 配送时间 |
| cardNumber | string | 号码牌编号 |
| token | string | 取货验证 token（线下订单，MD5 前 8 位） |
| createTime | date | |

### 4.4 addresses（收货地址）

| 字段 | 类型 | 说明 |
|------|------|------|
| _id | string | |
| userId | string | |
| name | string | 收货人 |
| phone | string | 手机号 |
| province | string | |
| city | string | |
| district | string | |
| detail | string | 详细地址 |
| isDefault | boolean | |

### 4.5 pai_numbers（号码牌——商家端用）

| 字段 | 类型 | 说明 |
|------|------|------|
| _id | string | |
| number | string | 牌号如"07" |
| status | string | `idle` / `in_use` |
| orderId | string | 绑定的订单ID |

---

## 5. 云函数

| 云函数 | 说明 |
|--------|------|
| `getProducts` | 获取商品列表（按分类、分页） |
| `getProductDetail` | 获取商品详情+规格 |
| `createOrder` | 创建订单 |
| `payCallback` | 微信支付回调处理 |
| `getOrders` | 获取用户订单列表 |
| `getOrderDetail` | 获取订单详情（含称重照片、退款信息） |
| `getPickupStatus` | 扫码后获取取货状态（含 token 验证） |
| `verifyToken` | 验证线下订单 token |
| `addAddress` | 新增收货地址 |
| `updateAddress` | 编辑收货地址 |
| `deleteAddress` | 删除收货地址 |
| `getAddresses` | 获取地址列表 |
| `login` | 微信登录、获取 openid |
| `refundOrder` | 商家称重后计算差额并发起微信退款 |
| `cancelOrder` | 用户取消订单并触发全额退款 |
| `bindTag` | 号码牌绑定（事务+原子锁防并发） |
| `releaseTag` | 号码牌释放 |
| `sendSubscribeMessage` | 推送订阅消息 |
| `initDB` | 数据库初始化（分类+号码牌+计数器） |

---

## 6. 数据库索引

| 集合 | 索引字段 | 说明 |
|------|---------|------|
| orders | userId | 用户查询自己订单 |
| orders | status | 状态筛选 |
| orders | token | 取货验证查询 |
| orders | cardNumber | 号码牌查询 |
| orders | createTime | 时间排序 |

---

## 7. 环境变量

| 变量 | 说明 |
|------|------|
| `TOKEN_SECRET` | 线下订单取货 token 签名密钥 |

---

## 8. 待定 / 待商家端设计时细化

- 配送范围与费用规则
- 营业时间与预约时段配置
- 号码牌数量（默认 20 块）
- 小票打印格式与内容
- 微信服务通知模板

---

## 9. 实现规约

### 9.1 技术方案

全部使用微信云开发，不使用独立服务器：

| 能力 | 方案 |
|------|------|
| 数据库 | 云数据库（文档型，非 MySQL） |
| 接口 | 云函数，`wx.cloud.callFunction` 调用 |
| 存储 | 云存储（称重照片等） |
| 调用方式 | `wx.cloud.callFunction({ name, data })` |

### 9.2 退款逻辑

**整鸡订单称重完成后（refundOrder 云函数）：**

```
actualAmount = Math.round((actualWeight / 500) × unitPricePerJin) + processingFee
refundAmount = prepayAmount - actualAmount
```

- 退款金额精确到分，四舍五入
- `refundAmount > 0` 时才调用 `cloud.cloudPay.refund` 原路退回
- `refundAmount === 0` 时跳过退款接口，直接更新 `refundStatus: 'none'`
- 退款成功 → `refundStatus: 'done'`
- 退款失败 → `refundStatus: 'processing'`（需人工处理）

### 9.3 取消订单退款

| 场景 | 退款 | 说明 |
|------|------|------|
| 待支付取消 | 不退款 | 未实际支付 |
| 整鸡/鸽子取消（pending） | 全额退款 | `refundFee = prepayAmount` |
| exact_weight 取消（pending/accepted/weighed） | 全额退款 | `refundFee = prepayAmount` |

- 均调用 `cloud.cloudPay.refund` 原路退回
- 退款到账：1-7 个工作日
- 前端取消确认弹窗需提示「退款将原路退回，1-7 个工作日到账」

### 9.4 数据库索引

orders 集合需在云开发控制台手动创建以下索引：

| 集合 | 索引字段 | 说明 |
|------|---------|------|
| orders | userId | 用户查询自己订单 |
| orders | status | 状态筛选 |
| orders | token | 取货验证查询 |
| orders | cardNumber | 号码牌查询 |
| orders | createTime | 时间排序 |

### 9.5 号码牌并发处理

`bindTag` 云函数使用数据库事务防并发：

```
db.runTransaction(async (transaction) => {
  // 1. 查询该牌状态
  const res = await transaction.collection('pai_numbers').where({ number }).get()
  if (res.data[0].status !== 'idle') {
    return { error: '该号码牌已被使用，请重新选择' }
  }
  // 2. 原子条件更新 — 仅 status=idle 时生效
  const updateRes = await transaction.collection('pai_numbers')
    .where({ number, status: 'idle' })
    .update({ data: { status: 'in_use', orderId } })
  // 3. 检查更新行数，0 行 = 被抢占
  if (updateRes.stats.updated === 0) {
    return { error: '该号码牌已被使用，请重新选择' }
  }
  return { success: true }
})
```

前端收到错误后刷新号码牌面板，重新渲染空闲/占用状态。

### 9.6 线下订单 openid 获取

微信付款码支付回调中包含付款者 openid：

- `payCallback` 云函数从支付回调中提取 `openid`
- 存入 `orders.userId` 字段
- 后续处理完成时用此 `openid` 推送订阅消息
- 若 `openid` 为空则跳过推送，不报错

### 9.7 取货状态页离线处理

`pages/pickup/pickup` 页面：

```javascript
// 首次加载成功时缓存
wx.setStorageSync('pickup_' + orderNo, data)

// 网络请求失败时读取缓存
const cached = wx.getStorageSync('pickup_' + orderNo)
if (cached) {
  // 显示缓存数据 + 「网络不稳定，显示最后更新状态」提示
}
```

- 轮询间隔 5 秒
- 连续失败 3 次后停止自动轮询
- 显示「手动刷新」按钮供用户重试

### 9.8 订单号长度限制

- 格式：字母 + 3 位数字（如 `A023`），最大 10 字符
- scene 参数总长度：`orderNo(≤10) + '&token='(7) + token(8) = ≤25 字符`
- 微信 `getwxacodeunlimit` scene 参数上限 32 字符，满足要求

### 9.9 云函数清单

| 云函数 | 说明 |
|--------|------|
| `getProducts` | 获取商品列表（按分类、分页） |
| `getProductDetail` | 获取商品详情 + 规格 |
| `createOrder` | 创建订单 + 微信支付下单 |
| `payCallback` | 微信支付回调处理（含线下订单 openid 提取） |
| `getOrders` | 获取用户订单列表 |
| `getOrderDetail` | 获取订单详情（含称重照片、退款信息） |
| `getPickupStatus` | 扫码后获取取货状态（含 token 验证） |
| `verifyToken` | 验证线下订单 token |
| `addAddress` | 新增收货地址 |
| `updateAddress` | 编辑收货地址 |
| `deleteAddress` | 删除收货地址 |
| `getAddresses` | 获取地址列表 |
| `login` | 微信登录、获取 openid |
| `refundOrder` | 称重后计算差额并发起微信退款 |
| `cancelOrder` | 取消订单 + 触发全额退款 |
| `bindTag` | 号码牌绑定（事务 + 原子锁防并发） |
| `releaseTag` | 释放号码牌 |
| `sendSubscribeMessage` | 推送订阅消息 |
| `initDB` | 数据库初始化（分类 + 号码牌 + 计数器） |

### 9.10 本期不实现（下期范围）

以下功能预留接口和数据字段，本期不实现交互逻辑：

- 商家端所有功能（接单、称重上传、号码牌管理、小票打印）
- 号码牌管理后台
- 小票打印
- 配送范围校验
- 营业时间限制下单
