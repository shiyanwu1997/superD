# SuperD — Supervisor 进程管理平台

基于 Web 的 Supervisor 进程管理面板，替代命令行 `supervisorctl`，通过浏览器管理多台服务器上的进程。

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 18, Vite 7, Ant Design 5, React Router 7, xterm.js 6, Socket.io-client, TanStack Query |
| 后端 | Node.js, Express 5, Socket.io 4, JWT + Session 认证, bcrypt, xmlrpc, helmet |
| 存储 | **SQLite**（默认，零配置）/ MySQL（可选，生产环境推荐） |
| 部署 | PM2 + ecosystem.config.js |

## 功能特性

### 进程管理
- 实时监控程序状态（RUNNING / STOPPED / FATAL / BACKOFF）
- 单个操作：启动、停止、重启
- 批量操作：启动全部、停止全部、重启全部
- 项目筛选器：查看所有项目 / 指定项目的机器

### 日志管理
- **WebSocket 实时推送**（非轮询），即时显示 stdout / stderr
- xterm.js 终端模拟，支持彩色输出、自动滚动
- 自适应降频：无新日志时自动降低推送频率

### 权限系统 (RBAC)
- **三级角色**：超级管理员 → 普通管理员 → 普通用户
- **细粒度授权**：
  - 项目级：用户可操作该服务器上**全部机器**
  - 程序级：用户仅能操作**指定机器**（程序级优先，项目级兜底）

### 安全
- JWT + Session 双重认证
- bcrypt 密码哈希，AES-256 加密 Supervisor 密码
- helmet 安全头，CORS 白名单
- 登录接口速率限制（5次/分钟/IP）
- 所有密钥通过环境变量注入，无硬编码

### 双存储引擎
- **默认 SQLite**：开箱即用，无需安装数据库
- **可选 MySQL**：设置 `STORAGE_TYPE=mysql` 切换，适合生产环境

## 快速开始

### 1. 安装依赖

```bash
cd backend && npm install
cd ../client && npm install
```

### 2. 配置密钥

```bash
cd backend
cp .env.example .env
vim .env    # 修改三个必填密钥
```

`.env` 文件内容：

```ini
SESSION_SECRET=请生成一个随机字符串
JWT_SECRET=请生成另一个随机字符串
ENCRYPTION_KEY=请生成一个32字节长度的密钥
```

> 应用启动时通过 `dotenv` 自动加载 `backend/.env`，无需手动 export。SQLite 模式下以上三个即可启动。

### 3. 启动

```bash
# 开发模式
cd backend && npm run dev    # 后端 → http://localhost:3000
cd client && npm run dev     # 前端 → http://localhost:5173

# 生产模式
cd client && npm run build   # 构建前端
pm2 start ecosystem.config.js   # PM2 启动双服务
```

### 4. 首次登录

首次启动会自动创建数据库表和内置角色，并生成随机密码的管理员账号：

```
=== 默认管理员用户已创建 ===
用户名: admin
密码: <随机生成>
```

> 查看密码: `pm2 logs supervisor-backend | grep "密码"`

## 项目结构

```
superD/
├── backend/
│   ├── app.js                     # Express 入口 + 中间件链
│   ├── config.js                  # 全局配置
│   ├── init-db.js                 # 建表脚本 (SQLite + MySQL)
│   ├── routes/
│   │   ├── index.js               # 路由挂载
│   │   ├── auth.js                # 登录 / 登出 / 用户信息
│   │   ├── projects.js            # 项目 CRUD + 连接状态
│   │   ├── programs.js            # 进程列表 / 操作 / 日志
│   │   └── users.js               # 用户管理 / 权限分配
│   ├── middleware/
│   │   └── auth.js                # JWT 验证 + 角色检查
│   ├── models/
│   │   ├── db.js                  # 存储选择器 (sqlite | mysql)
│   │   ├── db.sqlite.js           # SQLite 实现 (25 方法)
│   │   └── db.mysql.js            # MySQL 实现 (25 方法)
│   ├── services/
│   │   ├── supervisorService.js   # XML-RPC 与 Supervisor 通信
│   │   └── socketServer.js        # WebSocket 实时日志推送
│   └── utils/
│       ├── crypto.js              # AES-256 加解密
│       ├── errors.js              # 统一错误处理 (ApiError + 404)
│       ├── logger.js              # 分级日志工具 (DEBUG/INFO/WARN/ERROR)
│       └── programId.js           # programId 解析工具
│
├── client/
│   └── src/
│       ├── App.jsx                # 根组件 + 路由定义
│       ├── main.jsx               # 入口 + QueryClient + BrowserRouter
│       ├── config.js              # 前端配置 (终端/WebSocket)
│       ├── pages/
│       │   ├── LoginPage.jsx      # 登录页
│       │   ├── ProgramsPage.jsx   # 主面板 (项目侧栏 + 进程表格 + 操作)
│       │   ├── ProgramDetailPage.jsx  # 进程详情 + 日志抽屉
│       │   └── UsersPage.jsx      # 用户管理弹窗
│       ├── components/
│       │   ├── LogTerminal.jsx    # xterm 终端 (Socket.io 实时日志)
│       │   ├── StatsCards.jsx     # 统计卡片 (总数/运行/停止/异常)
│       │   ├── ErrorBoundary.jsx  # React 错误边界
│       │   ├── modals/            # 项目管理 / 修改密码弹窗
│       │   └── users/             # 用户管理子组件
│       ├── contexts/
│       │   └── AuthContext.jsx    # 认证上下文
│       └── utils/
│           └── api.js             # 28 个 API 封装函数
│
├── ecosystem.config.js            # PM2 部署配置 (含日志轮转)
└── package.json                   # monorepo 脚本
```

## API 端点 (34个)

### 认证
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/login` | 用户登录（速率限制 5次/分） |
| GET | `/logout` | 退出登录 |
| GET | `/api/user` | 获取当前用户信息 |

### 项目管理
| 方法 | 路径 | 权限 |
|------|------|------|
| GET | `/api/projects` | 用户可访问的项目列表 |
| POST | `/api/projects` | 管理员 |
| PUT | `/api/projects/:id` | 管理员 |
| DELETE | `/api/projects/:id` | 管理员 |
| GET | `/api/projects/:id/status` | 检查 Supervisor 连接状态 |

### 进程管理
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/projects/:id/programs` | 项目下进程列表 |
| GET | `/api/programs` | 所有项目进程汇总 |
| GET | `/api/programs/:id` | 进程详情 + 日志 |
| GET | `/api/programs/:id/stdout` | 标准输出日志 |
| GET | `/api/programs/:id/stderr` | 标准错误日志 |
| POST | `/api/programs/:id/start` | 启动进程 |
| POST | `/api/programs/:id/stop` | 停止进程 |
| POST | `/api/programs/:id/restart` | 重启进程 |

### 批量操作
| 方法 | 路径 |
|------|------|
| POST | `/api/projects/:id/programs/start-all` |
| POST | `/api/projects/:id/programs/stop-all` |
| POST | `/api/projects/:id/programs/restart-all` |

### 用户管理
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/users` | 用户列表 |
| POST | `/api/users` | 创建用户 |
| DELETE | `/api/users/:id` | 删除用户 |
| PUT | `/api/users/:id/role` | 修改角色 |
| PUT | `/api/users/:id/password` | 修改密码 |
| PUT | `/api/users/self/password` | 修改自己的密码 |
| PUT | `/api/users/:id/createdBy` | 修改上级管理员 |
| GET | `/api/roles` | 角色列表 |

### 权限管理
| 方法 | 路径 | 粒度 |
|------|------|------|
| GET | `/api/users/:id/project-permissions` | 项目级 |
| POST | `/api/users/:id/project-permissions` | 项目级 |
| DELETE | `/api/users/:id/project-permissions/:pid` | 项目级 |
| GET | `/api/users/:id/program-permissions` | 程序级 |
| POST | `/api/users/:id/program-permissions` | 程序级 |
| DELETE | `/api/users/:id/program-permissions/:pid` | 程序级 |

## 环境变量

| 变量 | 必填 | 说明 |
|------|------|------|
| `SESSION_SECRET` | 是 | Session 加密密钥 |
| `JWT_SECRET` | 是 | JWT 签名密钥 |
| `ENCRYPTION_KEY` | 是 | AES-256 加密密钥（Supervisor 密码加密） |
| `STORAGE_TYPE` | 否 | `sqlite`（默认）或 `mysql` |
| `PORT` | 否 | 后端端口，默认 3000 |
| `MYSQL_HOST` | MySQL 必填 | MySQL 主机 |
| `MYSQL_PORT` | 否 | MySQL 端口，默认 3306 |
| `MYSQL_USER` | 否 | MySQL 用户名，默认 root |
| `MYSQL_PASSWORD` | MySQL 必填 | MySQL 密码 |
| `MYSQL_DATABASE` | 否 | 数据库名，默认 supervisor |

## 与 Supervisor 的通信

```
浏览器 ←→ Express API ←→ XML-RPC ←→ Supervisor (:9001)
                                   ├─ supervisor.getAllProcessInfo
                                   ├─ supervisor.startProcess
                                   ├─ supervisor.stopProcess
                                   ├─ supervisor.tailProcessStdoutLog
                                   └─ supervisor.tailProcessStderrLog
```

每个项目在数据库存储对应的 Supervisor 连接信息（host/port/user/password），后端通过 XML-RPC 协议与目标 Supervisor 实例通信。

## 注意事项

1. **首次启动**自动创建数据库表 + 管理员账号
2. **SQLite 数据库文件**位于 `backend/data/supervisor.db`
3. **Supervisor 需开启 XML-RPC**，配置 `[inet_http_server]` 段
4. **生产部署**建议使用 MySQL + PM2 + HTTPS 反向代理
5. 前端代理配置在 `vite.config.js`，生产环境需 Nginx 反向代理 `/api` 和 `/socket.io`
