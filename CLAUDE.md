# 小鲜鸡 Agent 宪法

> 每次新会话启动时 Claude 自动读取此文件。所有规则适用于本项目全部模块。

---

## 1. 项目概览

小鲜鸡是一个生鲜零售三端系统：

| 端 | 目录 | 技术 | 用户 |
|---|------|------|------|
| 服务端 | `server/` | Node.js + Express + MySQL + Redis | 提供 API |
| 小程序 | `小鲜鸡微信小程序/` | 微信原生框架 | C 端顾客 |
| PC 商家端 | `小鲜鸡PC商家端/` | Vue 3 + Vite + Element Plus | 店员/管理员 |

- **服务器**：腾讯云 4C4G，IP `159.75.0.194`，域名 `www.xuaioxianji.top`
- **部署**：PM2 双实例 → Nginx 反代 → HTTPS
- **对标**：朴朴超市的支付和订单体系

---

## 2. 项目结构（找代码去哪）

```
小鲜鸡/
├── server/                     # 后端（Node.js）
│   ├── src/
│   │   ├── app.js              # Express 入口 + 路由挂载
│   │   ├── server.js           # 启动入口（含 MySQL/Redis 预检）
│   │   ├── config/             # 配置（db.js 连 MySQL/Redis，index.js 读 .env）
│   │   ├── routes/             # 路由（一个文件一个模块）
│   │   ├── middleware/         # 中间件（auth.js = JWT 鉴权）
│   │   ├── utils/              # 工具（wxpay.js, logger.js）
│   │   └── models/             # 数据模型
│   ├── migrations/             # 数据库迁移 SQL（001_initial_schema.sql）
│   ├── deploy/                 # Nginx 配置 + PM2 配置
│   ├── uploads/                # 上传的图片（git ignore）
│   └── .env                    # 环境变量（git ignore，绝不提交！）
│
├── 小鲜鸡微信小程序/            # 小程序前端
│   ├── pages/                  # 页面（22个页面）
│   ├── utils/                  # 工具（config.js=API地址, orderActions.js=订单操作）
│   ├── api.js                  # HTTP 请求封装
│   └── app.js / app.json       # 小程序入口
│
└── 小鲜鸡PC商家端/              # PC 管理后台（Vue SPA）
    ├── src/
    │   ├── views/              # 页面（24个 Vue 组件）
    │   ├── router/             # Vue Router（路由配置）
    │   ├── stores/             # Pinia 状态管理（auth.js = 登录状态）
    │   └── api.js              # Axios 封装
    └── vite.config.js          # Vite 配置（base: '/admin/'）
```

---

## 3. 安全红线（绝对不能做的事）

**规则：** `.env` 和所有含密码/密钥的文件绝不提交到 Git
> 大白话：`.env` 里有数据库密码、微信支付密钥、JWT 密钥。一旦泄露到 GitHub，任何人都能控制你的服务器和微信支付。`.gitignore` 已经排除了 `.env`，提交前一定检查 `git status`。

**规则：** 命令行中绝不直接写数据库密码（如 `mysql -pXiaoXianJi@2026`）
> 大白话：密码写在命令行里，会被记录到 shell 历史、进程列表、日志文件中。服务器被黑时攻击者第一个翻的就是这些地方。用 `--defaults-extra-file` 或 `.my.cnf` 代替。

**规则：** 生产环境绝不执行 `DROP`/`TRUNCATE`/`DELETE ... WHERE` 前不做 SELECT 确认
> 大白话：删库跑路只要 0.1 秒。任何删数据操作先用 SELECT 看影响多少行，确认无误再执行。

**规则：** 不在前端代码中硬编码任何密钥、Token、API Secret
> 大白话：小程序和 PC 端代码会被反编译/浏览器 DevTools 直接看到。所有密钥放服务端 `.env`。

---

## 4. 代码规范

**规则：** 写代码前先读同目录下 2-3 个现有文件，模仿其风格
> 大白话：不要用自己的习惯覆盖项目风格。如果现有代码用分号、双引号、中文注释、4空格缩进，你也照做。

**规则：** 业务逻辑注释用中文，技术术语保留英文
> 大白话：这是中文项目，注释要让接手的人看得懂。但像 `JWT`、`pool`、`middleware` 这种技术名词不翻译，翻译了反而更绕。

**规则：** 不要引入新依赖，除非必要且用户同意
> 大白话：每多一个 npm 包就是多一个潜在的漏洞和安全风险。能用现有代码实现的功能绝不 `npm install`。

**规则：** 修改已有接口时保持向后兼容，不改已有的请求/响应格式
> 大白话：小程序和 PC 端已经在用这些接口了。你改了字段名，前端就会崩。加字段可以，改已有的不行。

**规则：** 所有金额单位用「分」（整数），前端展示时除以 100
> 大白话：浮点数计算 `0.1+0.2=0.30000000000000004`，用分就没有这个问题。微信支付也要求金额单位为分。

---

## 5. 数据库规则

**规则：** 所有表结构变更写入 `server/migrations/` 目录，文件命名 `NNN_description.sql`
> 大白话：数据库改了什么必须留痕。将来服务器部署、排查问题时能找到每次变更。当前已有一个 `001_initial_schema.sql`。

**规则：** 数据库名 `xiaoxianji`，字符集 `utf8mb4`，引擎 `InnoDB`
> 大白话：`utf8mb4` 支持 emoji（比如 🐔），`InnoDB` 支持事务和行级锁。所有新表必须设这两个。

**规则：** 查询时优先用已有连接池 `require('../config/db').pool`，不要新建连接
> 大白话：连接池复用一个连接，省资源。每次新建连接就像每次都打电话而不是发微信，又慢又贵。

**规则：** 生产环境不直接执行 SQL 文件，先在本机/测试环境验证
> 大白话：SQL 写错可能导致锁表、误删数据。先在服务器上 `mysql -u xiaoxianji -p xiaoxianji < migration.sql` 之前，确认 SQL 是对的。

---

## 6. API 开发规范

**规则：** 路由文件放 `server/src/routes/`，命名 `xxx.routes.js`，在 `app.js` 中挂载
> 大白话：统一入口，加新模块三步走：建路由文件 → 写逻辑 → 在 `app.js` 里 `app.use('/api/xxx', require(...))`。

**规则：** 需要登录的接口用 `auth()` 中间件，商家接口用 `auth('merchant')`
> 大白话：`auth()` 只验证 JWT Token（用户身份），`auth('merchant')` 还验证用户角色是商家/管理员。不要自己写 Token 校验逻辑。

**规则：** 响应格式统一：`{ success: true/false, code: 200, data: {...}, message: '...' }`
> 大白话：前端（小程序和 PC 端）都按这个格式解析响应。如果某个接口返回不一样的格式，前端就会报错。

**规则：** 接口路径用小写+连字符，如 `/api/pai-numbers`，不用驼峰命名
> 大白话：URL 规范。`/api/paiNumbers` 在部分服务器上会有大小写问题。

**规则：** 所有写操作（POST/PUT/DELETE）必须做参数校验，读操作（GET）做分页保护
> 大白话：防止恶意请求。比如 `pageSize` 不能超过 100，`phone` 必须是合法手机号，`amount` 不能是负数。

---

## 7. 部署规则

**规则：** 代码同步走 GitHub：本地 commit → push → 服务器 pull → PM2 reload
> 大白话：不要直接 scp 代码到服务器。Git 有版本记录，出问题了能回滚。

**规则：** 改完服务端代码后，在服务器执行：
```bash
cd /www/wwwroot/xiaoxianji-server && git pull origin master && pm2 reload xiaoxianji-api
```
> 大白话：`git pull` 拉最新代码，`pm2 reload` 零停机重启（先起新进程再关旧进程）。

**规则：** 改完 PC 商家端代码后：
```bash
cd 小鲜鸡PC商家端 && npm run build
# 然后上传 dist.tar.gz 到服务器，解压到 /www/wwwroot/xiaoxianji-admin/
```
> 大白话：Vue 代码浏览器不直接认识，必须用 Vite 编译成 HTML/JS/CSS 才能部署。

**规则：** 部署后验证：
```bash
curl -s https://www.xuaioxianji.top/api/health    # 后端健康
curl -s https://www.xuaioxianji.top/admin/         # PC 端首页
```
> 大白话：部署完了不能说"好了"就完事。用 curl 确认真能访问到。

**规则：** 小程序代码修改后，用微信开发者工具点击"上传"，填写版本号，去 MP 后台提交审核
> 大白话：小程序代码不在我们服务器上跑，是微信托管。改完必须在微信开发者工具里手动上传。

---

## 8. 技术栈速查

| 项 | 值 |
|----|-----|
| 运行时 | Node.js 18.x |
| 框架 | Express 4.x |
| 数据库 | MySQL 8.0（库名 `xiaoxianji`） |
| 缓存 | Redis 6.x |
| 进程管理 | PM2（cluster 模式，2 实例） |
| 反向代理 | Nginx（`/etc/nginx/conf.d/xiaoxianji.conf`） |
| 小程序框架 | 微信原生 + `wx.` API |
| PC 框架 | Vue 3 + Vite + Pinia + Element Plus |
| 支付 | 微信支付 V3 JSAPI |
| 代码托管 | GitHub `ll2711255-ui/xiaoxianji-server` |
| SSL | Let's Encrypt 证书 |

**常用命令速查：**

```bash
# 查看 PM2 状态
pm2 status

# 重载（零停机）
pm2 reload xiaoxianji-api

# 查看日志
pm2 logs xiaoxianji-api --lines 50

# 检查 Nginx 配置
nginx -t

# 重载 Nginx
nginx -s reload

# 本地开发启动
cd server && npm run dev        # 后端（nodemon）
cd 小鲜鸡PC商家端 && npm run dev  # PC 端（Vite）
```

**关键文件路径（服务器上）：**

| 文件 | 路径 |
|------|------|
| 项目代码 | `/www/wwwroot/xiaoxianji-server/` |
| PC 端静态文件 | `/www/wwwroot/xiaoxianji-admin/` |
| 上传图片 | `/www/wwwroot/xiaoxianji-server/uploads/` |
| Nginx 配置 | `/etc/nginx/conf.d/xiaoxianji.conf` |
| 日志 | `server/logs/` |

---

## 9. 资源引用

详细的服务器和支付信息见持久记忆文件：
- `[[server-infra]]` — 服务器 IP、域名、SSH 密钥
- `[[wechat-pay-technical-spec]]` — 微信支付完整设计文档（对标朴朴）

> 大白话：这些是跨会话保存的记忆文件，里面有更详细的信息。上面 `[[]]` 是记忆文件之间的引用写法。
