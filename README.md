# Supervisor 进程管理平台

## 项目简介

Supervisor 是一个功能强大的进程管理平台，基于 Supervisor 的进程管理功能，提供了友好的 Web 界面，方便运维和开发人员管理和监控通过 Supervisor 运行的程序。该平台支持多项目管理、程序状态监控、日志查看、批量操作等功能，并实现了完善的角色权限管理系统。

## 技术栈

### 前端
- React 18
- Vite 7
- React Router 7
- Ant Design 5
- Socket.io-client 4.8.3
- @tanstack/react-query
- @xterm/xterm 6.0.0

### 后端
- Node.js
- Express 5.2.1
- Socket.io 4.8.3
- JWT 认证
- bcrypt 密码加密
- MySQL2 3.16.0
- xmlrpc 1.3.2

### 数据库
- MySQL 数据库（生产环境推荐）

## 功能特性

### 1. 角色权限管理系统 (RBAC)
- 基于角色的访问控制，分为三个层级：
  - **超级管理员**：仅admin用户可拥有此角色，拥有所有项目和用户的管理权限
  - **普通管理员**：可以创建普通用户，管理自己创建的用户和授权的项目
  - **普通用户**：无用户管理权限，只能访问被授权的项目和程序
- 权限动态检查，确保用户只能访问授权资源
- 用户密码使用 bcrypt 加密存储

### 2. 项目管理
- 项目列表展示，基于用户权限过滤
- 项目连接状态实时显示（在线/离线/检查中）
- 支持多项目管理，可切换查看不同项目的程序
- Supervisor 密码使用 AES-256 加密存储

### 3. 程序管理
- 实时监控程序运行状态（运行中、已停止、启动中、异常等）
- 单个程序操作：启动、停止、重启
- 批量操作：启动所有、停止所有、重启所有程序
- 程序搜索功能，快速定位目标程序

### 4. 日志管理
- 支持查看标准输出日志（stdout）和标准错误日志（stderr）
- 实时日志更新，支持自动滚动查看
- 日志终端化展示，提供更好的阅读体验
- 支持大量日志的高效加载和显示

### 5. 用户管理
- 用户列表展示，支持按角色过滤
- 支持创建、删除、修改用户信息
- 支持修改用户密码
- 支持查看用户创建的历史记录

## 安装与使用

### 环境要求
- Node.js 16+
- npm 或 yarn
- MySQL 数据库（生产环境推荐）
- Supervisor 已安装并运行

### 安装步骤

1. 克隆项目
```bash
git clone <项目地址>
cd supervisor-v1
```

2. 安装依赖
```bash
# 安装所有依赖
npm run install-all
```

3. 配置环境变量

#### 后端配置
在 `backend` 目录下创建 `.env` 文件，配置以下环境变量：
```env
PORT=3000
STORAGE_TYPE=mysql
SESSION_SECRET=your_session_secret
JWT_SECRET=your_jwt_secret

# MySQL 数据库配置
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=your_password
MYSQL_DATABASE=supervisor

# AES 加密密钥（用于加密Supervisor密码）
ENCRYPTION_KEY=your_encryption_key
```

#### 前端配置
在 `client` 目录下创建 `.env` 文件，配置以下环境变量：
```env
VITE_API_URL=http://localhost:3000
```

**说明**：
- `VITE_API_URL` 是前端访问后端API的基础URL
- 默认值 `http://localhost:3000` 是后端服务的默认地址和端口
- 前端会自动在这个URL后面添加 `/api` 路径作为API的基础路径
- 如果后端服务运行在不同的地址或端口，需要相应修改此配置

### 启动方式

#### 开发环境
```bash
# 启动后端开发服务器
npm run dev

# 启动前端开发服务器
npm run dev
```

#### 生产环境
```bash
# 构建前端
npm run build

# 使用 PM2 启动（推荐）
pm2 start ecosystem.config.js
```

## 项目结构

```
supervisor-v1/
├── backend/               # 后端代码
│   ├── logs/              # 日志文件
│   ├── middleware/        # 中间件
│   │   └── auth.js        # 认证中间件
│   ├── models/            # 数据模型
│   │   ├── db.js          # 数据库操作封装
│   │   └── db.mysql.js    # MySQL 数据库实现
│   ├── routes/            # 后端路由
│   │   └── index.js       # 路由配置
│   ├── services/          # 业务逻辑
│   │   ├── socketServer.js# Socket.IO 实时通信服务
│   │   └── supervisorService.js # Supervisor 服务封装
│   ├── utils/             # 工具函数
│   │   ├── crypto.js      # AES 加密工具
│   │   ├── errors.js      # 错误处理
│   │   └── logger.js      # 日志工具
│   ├── app.js             # 后端入口
│   ├── config.js          # 配置文件
│   └── init-db.js         # 数据库初始化脚本
├── client/                # 前端代码
│   ├── dist/              # 构建输出
│   ├── public/            # 公共资源
│   ├── src/               # 源代码
│   │   ├── components/    # 组件
│   │   ├── contexts/      # React 上下文
│   │   ├── pages/         # 页面组件
│   │   ├── utils/         # 工具函数
│   │   ├── App.jsx        # 应用入口
│   │   └── main.jsx       # 主入口文件
│   ├── index.html         # HTML 模板
│   └── vite.config.js     # Vite 配置
├── ecosystem.config.js    # PM2 配置文件
└── README.md              # 项目说明文档
```

## API 接口

### 认证相关
- `POST /api/login` - 用户登录，返回JWT令牌
- `GET /api/user` - 获取当前用户信息

### 项目相关
- `GET /api/projects` - 获取项目列表（基于当前用户权限）
- `GET /api/projects/:projectId/status` - 检查项目连接状态
- `POST /api/projects` - 创建新项目（需要管理员权限）
- `PUT /api/projects/:id` - 更新项目信息（需要管理员权限）
- `DELETE /api/projects/:id` - 删除项目（需要管理员权限）

### 程序相关
- `GET /api/projects/:projectId/programs` - 获取项目下的程序列表
- `GET /api/programs/:programId` - 获取程序详情
- `POST /api/programs/:programId/start` - 启动程序
- `POST /api/programs/:programId/stop` - 停止程序
- `POST /api/programs/:programId/restart` - 重启程序

### 批量操作
- `POST /api/projects/:projectId/programs/start-all` - 启动所有程序
- `POST /api/projects/:projectId/programs/stop-all` - 停止所有程序
- `POST /api/projects/:projectId/programs/restart-all` - 重启所有程序

### 日志相关
- `GET /api/programs/:programId/stdout` - 获取标准输出日志
- `GET /api/programs/:programId/stderr` - 获取标准错误日志
- **Socket.IO** - 实时日志推送

### 用户管理
- `GET /api/users` - 获取用户列表（基于当前用户权限）
- `POST /api/users` - 创建新用户（需要管理员权限）
- `DELETE /api/users/:userId` - 删除用户（需要管理员权限）
- `PUT /api/users/:userId/role` - 更新用户角色（需要管理员权限）
- `PUT /api/users/self/password` - 修改当前用户密码
- `PUT /api/users/:userId/password` - 修改指定用户密码（需要管理员权限）
- `GET /api/roles` - 获取所有角色

## 安全特性

1. **用户认证与授权**
   - JWT 令牌认证
   - 基于角色的访问控制 (RBAC)
   - 密码使用 bcrypt 加密存储

2. **数据加密**
   - Supervisor 密码使用 AES-256 加密存储
   - 加密密钥通过环境变量配置

3. **通信安全**
   - CORS 配置限制允许的前端域名
   - 所有 API 请求均需认证

4. **输入验证**
   - 所有用户输入均经过验证
   - SQL 注入防护

## 注意事项

1. **首次启动**
   - 首次启动会自动创建数据库和表结构
   - 首次启动会自动生成超级管理员账号，账号信息将在日志中显示

2. **Supervisor 配置**
   - 确保 Supervisor 服务已在后台运行
   - 确保 Supervisor 配置允许远程访问
   - 配置文件通常位于 `/etc/supervisor/supervisord.conf`

3. **生产环境**
   - 确保使用 HTTPS
   - 定期更新依赖包
   - 配置合适的日志级别

## 开发说明

### 代码风格
- 前端使用 ESLint 检查代码风格
- 后端使用标准的 Node.js 代码风格

### 测试
- 后端提供了数据库测试文件
- 建议为新功能编写测试用例

## 许可证

ISC
