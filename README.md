# Supervisor

## 项目介绍

这是一个基于 Supervisor 的进程管理平台，提供了友好的 Web 界面，方便运维和开发人员管理和监控通过 Supervisor 运行的程序。该平台支持多项目管理、程序状态监控、日志查看、批量操作等功能。

## 技术栈

### 前端
- React 19
- Vite
- React Router 7
- CSS3

### 后端
- Node.js
- Express 5
- Supervisor XML-RPC API
- JWT 认证
- bcrypt 密码加密

### 数据库
- JSON 文件存储（开发环境）
- MySQL 数据库（生产环境）

## 功能特点

### 1. 用户认证与权限管理
- 基于 JWT 的用户认证系统
- 多层次权限管理：
  - **超级管理员**（admin）：拥有所有项目的权限，可以管理所有用户和权限
  - **普通管理员**：只能管理自己拥有权限的项目，可以创建普通用户并为其分配自己拥有的项目权限
- 动态权限更新：管理员权限变更后，立即可以访问新的项目并为用户分配新的权限
- 密码加密存储（bcrypt）

### 2. 项目管理
- 查看用户可访问的项目列表（基于权限过滤）
- 项目连接状态实时显示（红绿灯标识）

### 3. 程序管理
- 查看项目下的程序列表
- 程序状态实时监控（运行中、已停止等）
- 单个程序操作：启动、停止、重启
- 批量操作：启动所有、停止所有、重启所有程序

### 4. 日志管理
- 支持查看标准输出日志（stdout）
- 支持查看标准错误日志（stderr）
- 日志实时刷新
- 日志按时间倒序显示（最新日志在前）
- 支持滚动查看大量日志
- 日志内容完整性保障（自动修复截断日志行）

### 5. 界面优化
- 响应式设计，适配不同屏幕尺寸
- 清晰的布局结构
- 直观的操作按钮
- 实时的操作反馈
- 用户管理页面布局优化（创建用户按钮不再孤立占用大量空间）

## 安装和使用

### 环境要求
- Node.js 16+
- npm 或 yarn
- Supervisor 已安装并运行

### 安装步骤

1. 克隆项目
```bash
git clone <项目地址>
cd supervisor-v1
```

2. 安装后端依赖
```bash
npm install
```

3. 安装前端依赖
```bash
cd client
npm install
```

4. 构建前端项目
```bash
npm run build
```

5. 返回项目根目录
```bash
cd ..
```

6. 启动服务器

**方式1：一键启动前后端（推荐生产环境）**
```bash
npm start
```

**方式2：仅启动后端（生产环境）**
```bash
npm run server
```

**方式3：仅启动前端开发服务器（开发环境）**
```bash
npm run client
```

**方式4：使用pm2启动（推荐生产环境）**

### 使用pm2启动

1. **安装pm2**（如果尚未安装）
```bash
npm install -g pm2
```

2. **构建前端项目**
```bash
cd client
npm install
npm run build
cd ..
```

3. **使用pm2启动后端服务**
```bash
cd backend
npm install
# 使用pm2启动
npm start
```
4. **使用pm2配置文件启动（推荐）**

在项目根目录创建`ecosystem.config.js`文件：
```javascript
module.exports = {
  apps: [
    {
      name: 'supervisor-backend',
      script: './backend/app.js',
      cwd: '.',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000 ,
        STORAGE_TYPE=mysql 
        MYSQL_HOST=127.0.0.1 
        MYSQL_PORT=3306 
        MYSQL_USER=root 
        MYSQL_PASSWORD=yang1340984855 
        MYSQL_DATABASE=supervisor 
      }
    },
    {
      name: 'supervisor-frontend',
      script: 'npx serve',
      args: ['-s', 'dist', '-l', '6001'],
      cwd: './client',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
```

然后使用pm2启动所有服务：
```bash
# 确保前端已构建
cd client
npm install
npm run build
cd ..

# 安装serve依赖
npm install -g serve

# 使用pm2配置文件启动
npm install -g serve
cd client
npm install
npm run build
cd ..
pm2 start ecosystem.config.js
```

5. **pm2常用命令**
```bash
# 查看所有pm2进程
pm2 list

# 查看指定进程日志
pm2 logs <app_name>

# 重启指定进程
pm2 restart <app_name>

# 停止指定进程
pm2 stop <app_name>

# 删除指定进程
pm2 delete <app_name>
```

### 环境变量配置

#### 后端端口配置
后端默认使用3000端口，可以通过环境变量 `PORT` 自定义端口：
```bash
# 设置后端端口为3000（默认值）
PORT=3000  STORAGE_TYPE=mysql npm run server
```

#### 前端端口配置
前端开发服务器已在配置文件中固定为6001端口，无需手动指定：
```bash
# 直接启动前端开发服务器（自动使用6001端口）
cd client
npm run dev
```

#### 存储方式配置
后端支持JSON文件存储和MySQL数据库存储，可以通过环境变量 `STORAGE_TYPE` 进行切换：

**使用JSON文件存储（默认）**：
```bash
STORAGE_TYPE=json npm run server
```

**使用MySQL数据库存储**：
```bash
# 基本配置
STORAGE_TYPE=mysql \
MYSQL_HOST=127.0.0.1 \
MYSQL_PORT=3306 \
MYSQL_USER=root \
MYSQL_PASSWORD=yang1340984855 \
MYSQL_DATABASE=supervisor \
npm run server
```

**MySQL环境变量说明**：
- `STORAGE_TYPE`：存储类型，可选值为 `json` 或 `mysql`
- `MYSQL_HOST`：MySQL服务器地址，默认值为 `localhost`
- `MYSQL_PORT`：MySQL服务器端口，默认值为 `3306`
- `MYSQL_USER`：MySQL用户名，默认值为 `root`
- `MYSQL_PASSWORD`：MySQL密码，默认值为空字符串
- `MYSQL_DATABASE`：MySQL数据库名，默认值为 `supervisor`
- `MYSQL_CONNECTION_LIMIT`：MySQL连接池大小，默认值为 `10`

### 访问平台

1. 打开浏览器，访问前端服务地址：
   - 开发环境：`http://localhost:6001`（使用自定义端口6001）
   - 生产环境：`http://localhost:3000`
2. 使用默认管理员账号登录（首次启动时会自动生成，查看控制台输出）
   - 或者使用以下测试账号：
     - **超级管理员**：admin / admin
     - **普通管理员**：test1 / test1
     - **普通用户**：test / test

## 项目结构

```
supervisor-v1/
├── backend/               # 后端代码
│   ├── data/              # 数据文件
│   │   ├── projects.json         # 项目数据
│   │   ├── users.json            # 用户数据
│   │   ├── roles.json            # 角色数据
│   │   ├── userProgramPermissions.json # 用户程序权限
│   │   └── userProjectPermissions.json # 用户项目权限
│   ├── middleware/        # 中间件
│   │   └── auth.js               # 认证中间件
│   ├── models/            # 数据模型
│   │   └── db.js                 # 数据库操作封装
│   ├── routes/            # 后端路由
│   │   └── index.js              # 路由配置
│   ├── services/          # 业务逻辑
│   │   └── supervisorService.js  # Supervisor 服务封装
│   ├── app.js             # 后端入口
│   ├── config.js          # 配置文件
│   ├── reset_password.js  # 密码重置脚本
│   └── package.json       # 后端依赖配置
├── client/                # 前端代码
│   ├── public/           # 公共资源
│   ├── src/              # 源代码
│   │   ├── assets/       # 静态资源
│   │   ├── contexts/     # React 上下文
│   │   │   └── AuthContext.jsx   # 认证上下文
│   │   ├── pages/        # 页面组件
│   │   │   ├── LoginPage.jsx     # 登录页面
│   │   │   ├── ProgramsPage.jsx  # 程序列表页面
│   │   │   ├── ProgramDetailPage.jsx # 程序详情页面
│   │   │   └── UsersPage.jsx     # 用户管理页面
│   │   ├── utils/        # 工具函数
│   │   │   └── api.js            # API 调用封装
│   │   ├── App.jsx       # 应用入口
│   │   ├── App.css       # 全局样式
│   │   ├── config.js     # 前端配置
│   │   └── main.jsx      # 主入口文件
│   ├── .gitignore        # Git 忽略文件
│   ├── eslint.config.js  # ESLint 配置
│   ├── index.html        # HTML 模板
│   ├── package.json      # 前端依赖配置
│   └── vite.config.js    # Vite 配置
├── API_SPEC.md           # API接口文档
└── README.md             # 项目说明文档
```

## API 接口

### 认证相关
- `POST /login` - 用户登录
- `GET /api/user` - 获取当前用户信息

### 项目相关
- `GET /api/projects` - 获取项目列表
- `GET /api/projects/:projectId/programs` - 获取项目下的程序列表

### 程序相关
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

### 用户管理
- `GET /api/users` - 获取用户列表
- `POST /api/users` - 创建新用户
- `PUT /api/users/:userId/role` - 更新用户角色
- `PUT /api/users/:userId/password` - 更新用户密码
- `GET /api/users/:userId/permissions` - 获取用户权限
- `POST /api/users/:userId/permissions` - 设置用户权限
- `DELETE /api/users/:userId/permissions` - 移除用户权限

## 注意事项

1. 本项目支持两种存储方式：
   - JSON 文件存储：默认方式，适用于开发和测试环境
   - MySQL 数据库：生产环境推荐使用，提供更好的性能和可靠性
2. 使用MySQL存储时，首次启动会自动创建数据库和表结构，无需手动初始化
3. 使用MySQL存储时，会自动创建初始管理员用户（用户名：admin，密码：admin123）
4. Supervisor 服务需要在后台运行，并且配置了允许远程访问。
5. 密码使用 bcrypt 加密存储，保障安全性。
6. 登录后默认记住用户信息，关闭浏览器后需要重新登录。

## 开发说明

### 前端开发
```bash
cd client
npm run dev
```

### 后端开发
```bash
cd backend
node app.js
```

### 代码检查
```bash
cd client
npm run lint
```

## License

MIT
