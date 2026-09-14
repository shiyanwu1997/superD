# SuperD — Supervisor 进程管理平台

基于 Web 的 Supervisor 进程管理面板，替代命令行 `supervisorctl`，通过浏览器管理多台服务器上的进程。

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 18, Vite 7, Ant Design 5, React Router 7, xterm.js 6, Socket.io-client, TanStack Query |
| 后端 | Node.js, Express 5, Socket.io 4, JWT + 服务 API 令牌认证, bcrypt, xmlrpc, helmet |
| 存储 | **SQLite**（默认，零配置）/ MySQL（可选） |
| 部署 | PM2 + ecosystem.config.js |

## 功能特性

### 进程管理
- 实时监控 + **10 秒静默自动刷新**（仅更新状态，不影响操作）
- 单程序：启动、停止、重启
- 批量操作：全部启动 / 停止 / 重启 + 重载 Supervisor 配置
- 左侧栏分组树：项目分组 → 机器（自然排序）→ 进程

### 日志管理
- **Socket.io 实时推送**，即时显示 stdout / stderr
- xterm.js 终端模拟，暂停/继续、选中即复制
- 自适应降频：无新日志自动降至 10 秒轮询

### UI/UX
- 黑/白极简设计，Inter 字体
- 左侧栏分组树 + 机器状态指示
- 所有弹窗带 overflow 约束，不会无限扩张
- 机器列表按前缀 + 尾数自然排序

### 权限系统 (RBAC)

```
超级管理员 (admin) ── 管理所有人
  │
  ├── 管理员 (subadmin) ── 管理自己的组员
  │     └── 普通用户 (user)
  │
  └── 普通用户 (user)
```

- **机器权限**：用户可操作该机器的**全部程序**
- **程序权限**：用户仅能操作**指定程序**（程序级优先，项目级兜底）
- 权限在用户管理弹窗中可视化配置

### 性能优化
- XML-RPC 进程列表 **5 秒缓存**，减少 Supervisor 负载
- 操作后**自动清除缓存**，确保数据一致
- 连接状态检查失败仅重试 1 次

### 安全
- JWT 登录与可撤销的服务 API 令牌认证
- bcrypt 密码哈希，AES-256 加密 Supervisor 密码
- helmet 安全头，登录速率限制（5 次/分钟/IP）
- 所有密钥通过 `.env` 文件注入，无硬编码

## 快速开始

### 1. 安装

```bash
git clone git@github.com:shiyanwu1997/superD.git
cd superD
cd backend && npm install
cd ../client && npm install
```

### 2. 配置

```bash
cd backend
cp .env.example .env
vim .env
```

```ini
SESSION_SECRET=生成一个随机字符串
JWT_SECRET=生成另一个随机字符串
ENCRYPTION_KEY=生成一个32字节密钥
```

> SQLite 模式下这三项即可启动。`.env` 由 `dotenv` 自动加载——无需手动 export。

### 3. 启动

```bash
# 开发模式
cd backend && npm run dev    # → http://localhost:3000
cd client && npm run dev     # → http://localhost:5173

# 生产模式
cd client && npm run build   # 构建前端
pm2 start ecosystem.config.js   # 单端口 6002，前后端一体
```

### 4. 首次登录

首次启动自动创建数据库、内置角色，并生成随机密码的管理员：

```
=== 默认管理员用户已创建 ===
用户名: admin
密码: <随机生成>
```

> `pm2 logs | grep "密码"` 查看

## 权限模型

| 角色 | 管理用户 | 创建用户 | 设置权限 |
|------|:--:|:--:|:--:|
| 超级管理员 (admin) | 所有人 | 管理员 + 普通用户 | ✅ |
| 管理员 (subadmin) | 自己的组员 | 普通用户 | 自己的组员 |
| 普通用户 (user) | ❌ | ❌ | ❌ |

权限判定：**程序权限优先 → 机器权限兜底 → 403**

## 项目结构

```
superD/
├── backend/
│   ├── app.js                      # Express 入口 + 中间件链
│   ├── config.js                   # 全局配置
│   ├── init-db.js                  # 建表 (SQLite + MySQL)
│   ├── .env.example                # 环境变量模板
│   ├── routes/
│   │   ├── index.js                # 路由挂载
│   │   ├── auth.js                 # 登录 / 登出
│   │   ├── projects.js             # 机器 CRUD + 连接状态
│   │   ├── programs.js             # 进程列表 / 操作 / 日志
│   │   ├── users.js                # 用户管理 / 权限分配
│   │   └── groups.js               # 项目分组管理
│   ├── middleware/
│   │   └── auth.js                 # JWT 验证 + 角色检查
│   ├── models/
│   │   ├── db.js                   # 存储选择器
│   │   ├── db.sqlite.js            # SQLite 实现 (32 方法)
│   │   └── db.mysql.js             # MySQL 实现 (32 方法)
│   ├── services/
│   │   ├── supervisorService.js    # XML-RPC 通信 + 进程缓存
│   │   └── socketServer.js         # WebSocket 实时日志
│   └── utils/
│       ├── crypto.js               # AES-256 加解密
│       ├── errors.js               # 统一错误处理
│       ├── logger.js               # 分级日志
│       └── programId.js            # ID 解析工具
│
├── client/
│   └── src/
│       ├── App.jsx                 # 根组件 + 路由
│       ├── main.jsx                # 入口
│       ├── pages/
│       │   ├── LoginPage.jsx       # 登录
│       │   ├── ProgramsPage.jsx    # 主面板 (树形侧栏 + 进程表格)
│       │   ├── ProgramDetailPage.jsx # 进程详情 + 日志抽屉
│       │   └── UsersPage.jsx       # 用户管理弹窗
│       ├── components/
│       │   ├── LogTerminal.jsx     # 实时日志终端 (暂停/滚动)
│       │   ├── StatsCards.jsx      # 统计卡片
│       │   ├── ErrorBoundary.jsx   # 错误边界
│       │   ├── modals/             # 机器 & 分组管理
│       │   └── users/              # 权限配置组件
│       ├── contexts/
│       │   └── AuthContext.jsx     # 认证上下文
│       └── utils/
│           └── api.js              # 37 个 API 封装函数
│
├── ecosystem.config.js             # PM2 配置 (日志轮转)
└── .gitignore
```

## 面向服务调用的 API

接口可独立于网页长期使用。服务端调用应使用 `Authorization: Bearer <API_TOKEN>`，令牌以 `sd_` 开头；不要使用网页登录返回的短期 JWT。

1. 超级管理员先创建一个用于集成的用户，并按该用户需要的机器/程序配置权限。
2. 使用管理员 JWT 调用 `POST /api/api-tokens` 创建服务令牌。明文令牌只在创建响应中返回一次，数据库只保存 SHA-256 摘要。
3. 调用方把令牌存入其密钥管理系统，以 `Authorization: Bearer ...` 访问 `/api/*`。权限必须同时满足令牌 scope 和绑定用户的项目/程序权限。
4. 轮换时先创建新令牌，完成调用方切换后再撤销旧令牌。所有服务令牌 HTTP 调用都会写入审计记录。

创建令牌示例（管理员 JWT 仅用于管理令牌，不应交给业务服务）：

```bash
curl -X POST http://localhost:6002/api/api-tokens \
  -H 'Authorization: Bearer <ADMIN_JWT>' \
  -H 'Content-Type: application/json' \
  -d '{"userId": 3, "name": "alerting-service", "scopes": ["projects:read", "programs:read", "programs:write", "logs:read"]}'
```

服务调用示例：

```bash
curl http://localhost:6002/api/projects \
  -H 'Authorization: Bearer sd_<SERVICE_TOKEN>'
```

令牌管理接口仅限超级管理员（服务令牌还必须包含 `tokens:manage`）：

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/api-tokens` | 查看令牌元数据，不返回令牌摘要或明文 |
| POST | `/api/api-tokens` | 创建令牌；`userId`、`name`、`scopes` 必填，默认 90 天、最长 365 天 |
| DELETE | `/api/api-tokens/:id` | 立即撤销令牌 |
| GET | `/api/api-audit-events?limit=100` | 查看最近服务 API 调用审计，`limit` 最大 500 |

支持的 scope：`projects:read`、`projects:write`、`groups:read`、`groups:write`、`programs:read`、`programs:write`、`logs:read`、`users:read`、`users:write`、`tokens:manage`。`*` 为全部范围，仅应在受控的管理员服务中使用。JWT 调用继续按现有角色和项目权限工作，不受 scope 限制。

API 契约以 `/api` 为稳定 v1 基线，可通过 `GET /api/version` 查询当前版本。新增字段和新增接口可直接使用；已有字段和接口如需不兼容调整将保留兼容期并在发布说明中标记。调用方应基于 HTTP 状态码和 `message` 处理失败，不能依赖未文档化字段。

## API 端点

### 认证
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/login` | 登录（速率限制 5次/分） |
| GET | `/logout` | 退出 |
| GET | `/api/user` | 当前用户信息 |

### 机器管理
| 方法 | 路径 | 权限 |
|------|------|------|
| GET | `/api/projects` | 用户可见的机器 |
| POST | `/api/projects` | 管理员 |
| PUT | `/api/projects/:id` | 管理员 |
| DELETE | `/api/projects/:id` | 管理员 |
| GET | `/api/projects/:id/status` | 连接状态 |
| PUT | `/api/projects/:id/group` | 设置分组 |

### 项目分组
| 方法 | 路径 | 权限 |
|------|------|------|
| GET | `/api/groups` | 分组列表 |
| POST | `/api/groups` | 管理员 |
| PUT | `/api/groups/:id` | 管理员 |
| DELETE | `/api/groups/:id` | 管理员 |
| GET | `/api/groups/:id/projects` | 分组下机器 |

### 进程管理
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/projects/:id/programs` | 进程列表 |
| GET | `/api/programs` | 全部进程 |
| GET | `/api/programs/:id` | 进程详情 |
| GET | `/api/programs/:id/stdout` | stdout |
| GET | `/api/programs/:id/stderr` | stderr |
| POST | `/api/programs/:id/start` | 启动 |
| POST | `/api/programs/:id/stop` | 停止 |
| POST | `/api/programs/:id/restart` | 重启 |
| POST | `/api/projects/:id/programs/start-all` | 全部启动 |
| POST | `/api/projects/:id/programs/stop-all` | 全部停止 |
| POST | `/api/projects/:id/programs/restart-all` | 全部重启 |
| POST | `/api/projects/:id/reload` | 重载配置 |

### 用户管理
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/users` | 用户列表 |
| POST | `/api/users` | 创建用户 |
| DELETE | `/api/users/:id` | 删除用户 |
| PUT | `/api/users/:id/role` | 修改角色 |
| PUT | `/api/users/:id/password` | 修改密码 |
| PUT | `/api/users/self/password` | 修改自己的密码 |
| PUT | `/api/users/:id/createdBy` | 修改上级 |
| GET | `/api/roles` | 角色列表 |

### 权限
| 方法 | 路径 | 粒度 |
|------|------|------|
| GET / POST / DELETE | `/api/users/:id/project-permissions` | 机器级 |
| GET / POST / DELETE | `/api/users/:id/program-permissions` | 程序级 |

## 与 Supervisor 通信

```
浏览器 ──→ Express API ──→ XML-RPC ──→ Supervisor (:9001)
              │                           ├─ getAllProcessInfo
              │ (5秒缓存)                  ├─ startProcess / stopProcess
              │                           ├─ tailProcessStdoutLog
              └── Socket.io (实时日志) ──→ └─ reloadConfig
```

## 环境变量

| 变量 | 必填 | 默认值 |
|------|:--:|------|
| `SESSION_SECRET` | 是 | - |
| `JWT_SECRET` | 是 | - |
| `ENCRYPTION_KEY` | 是 | - |
| `STORAGE_TYPE` | 否 | `sqlite` |
| `PORT` | 否 | `3000` |
| `MYSQL_PASSWORD` | MySQL 必填 | - |

> 全部通过 `backend/.env` 配置，启动时自动加载。

## 注意事项

- **首次启动**自动建表 + 创建 admin 用户
- **SQLite** 文件位于 `backend/data/supervisor.db`
- **Supervisor** 需开启 XML-RPC：配置 `[inet_http_server]` 段
- **生产环境**推荐 MySQL + PM2 + HTTPS 反向代理
- **开发模式**前后端分端口（3000 / 5173），**生产模式**单端口（6002）前后端一体
