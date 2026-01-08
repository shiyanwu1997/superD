# Supervisor API 接口规范

## 1. 认证与授权

### 1.1 登录
- **URL**: `/api/login`
- **方法**: `POST`
- **请求参数**:
  ```json
  {
    "username": "admin",
    "password": "admin123"
  }
  ```
- **响应**:
  ```json
  {
    "success": true,
    "message": "登录成功",
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
  ```

### 1.2 获取当前用户信息
- **URL**: `/api/user`
- **方法**: `GET`
- **认证**: 需要JWT令牌
- **响应**:
  ```json
  {
    "id": 1,
    "username": "admin",
    "roleId": 1
  }
  ```

## 2. 项目管理

### 2.1 获取用户可访问的项目列表
- **URL**: `/api/projects`
- **方法**: `GET`
- **认证**: 需要JWT令牌
- **响应**:
  ```json
  [
    {
      "id": 1,
      "name": "项目1",
      "connectionStatus": "connected"
    },
    {
      "id": 2,
      "name": "项目2",
      "connectionStatus": "disconnected"
    }
  ]
  ```

## 3. 程序管理

### 3.1 获取所有程序列表
- **URL**: `/api/programs`
- **方法**: `GET`
- **认证**: 需要JWT令牌
- **响应**:
  ```json
  [
    {
      "id": "1-program1",
      "name": "program1",
      "projectId": 1,
      "status": "RUNNING",
      "projectName": "项目1"
    }
  ]
  ```

### 3.2 获取项目下的程序列表
- **URL**: `/api/projects/:projectId/programs`
- **方法**: `GET`
- **认证**: 需要JWT令牌
- **响应**:
  ```json
  [
    {
      "id": "1-program1",
      "name": "program1",
      "projectId": 1,
      "status": "RUNNING"
    }
  ]
  ```

### 3.3 获取程序详情
- **URL**: `/api/programs/:programId`
- **方法**: `GET`
- **认证**: 需要JWT令牌
- **响应**:
  ```json
  {
    "program": {
      "id": "1-program1",
      "name": "program1",
      "projectId": 1,
      "status": "RUNNING",
      "projectName": "项目1"
    },
    "configContent": "",
    "logs": "程序日志内容"
  }
  ```

### 3.4 启动程序
- **URL**: `/api/programs/:programId/start`
- **方法**: `POST`
- **认证**: 需要JWT令牌
- **响应**:
  ```json
  {
    "success": true,
    "message": "程序 program1 已成功启动"
  }
  ```

### 3.5 停止程序
- **URL**: `/api/programs/:programId/stop`
- **方法**: `POST`
- **认证**: 需要JWT令牌
- **响应**:
  ```json
  {
    "success": true,
    "message": "程序 program1 已成功停止"
  }
  ```

### 3.6 重启程序
- **URL**: `/api/programs/:programId/restart`
- **方法**: `POST`
- **认证**: 需要JWT令牌
- **响应**:
  ```json
  {
    "success": true,
    "message": "程序 program1 已成功重启"
  }
  ```

### 3.7 获取程序标准输出日志
- **URL**: `/api/programs/:programId/stdout`
- **方法**: `GET`
- **认证**: 需要JWT令牌
- **查询参数**:
  - `offset`: 日志偏移量（默认：0）
  - `length`: 日志长度（默认：100000）
- **响应**:
  ```json
  {
    "stdout": "程序标准输出日志内容"
  }
  ```

### 3.8 获取程序标准错误日志
- **URL**: `/api/programs/:programId/stderr`
- **方法**: `GET`
- **认证**: 需要JWT令牌
- **查询参数**:
  - `offset`: 日志偏移量（默认：0）
  - `length`: 日志长度（默认：100000）
- **响应**:
  ```json
  {
    "stderr": "程序标准错误日志内容"
  }
  ```

### 3.9 启动所有程序
- **URL**: `/api/projects/:projectId/programs/start-all`
- **方法**: `POST`
- **认证**: 需要JWT令牌
- **响应**:
  ```json
  {
    "success": true,
    "message": "所有程序已成功启动"
  }
  ```

### 3.10 停止所有程序
- **URL**: `/api/projects/:projectId/programs/stop-all`
- **方法**: `POST`
- **认证**: 需要JWT令牌
- **响应**:
  ```json
  {
    "success": true,
    "message": "所有程序已成功停止"
  }
  ```

### 3.11 重启所有程序
- **URL**: `/api/projects/:projectId/programs/restart-all`
- **方法**: `POST`
- **认证**: 需要JWT令牌
- **响应**:
  ```json
  {
    "success": true,
    "message": "所有程序已成功重启"
  }
  ```

## 4. 用户管理

### 4.1 获取所有用户列表
- **URL**: `/api/users`
- **方法**: `GET`
- **认证**: 需要JWT令牌（仅管理员）
- **响应**:
  ```json
  [
    {
      "id": 1,
      "username": "admin",
      "roleId": 1,
      "roleName": "管理员",
      "projectPermissions": [{ "projectId": 1 }, { "projectId": 2 }]
    }
  ]
  ```

### 4.2 创建新用户
- **URL**: `/api/users`
- **方法**: `POST`
- **认证**: 需要JWT令牌（仅管理员）
- **请求参数**:
  ```json
  {
    "username": "newuser",
    "password": "password123",
    "roleId": 2
  }
  ```
- **响应**:
  ```json
  {
    "success": true,
    "message": "用户创建成功",
    "user": {
      "id": 2,
      "username": "newuser",
      "roleId": 2
    }
  }
  ```

### 4.3 删除用户
- **URL**: `/api/users/:userId`
- **方法**: `DELETE`
- **认证**: 需要JWT令牌（仅管理员）
- **响应**:
  ```json
  {
    "success": true,
    "message": "用户删除成功"
  }
  ```

### 4.4 更新用户角色
- **URL**: `/api/users/:userId/role`
- **方法**: `PUT`
- **认证**: 需要JWT令牌（仅管理员）
- **请求参数**:
  ```json
  {
    "roleId": 2
  }
  ```
- **响应**:
  ```json
  {
    "success": true,
    "message": "用户角色更新成功"
  }
  ```

### 4.5 修改用户密码（管理员）
- **URL**: `/api/users/:userId/password`
- **方法**: `PUT`
- **认证**: 需要JWT令牌（仅管理员）
- **请求参数**:
  ```json
  {
    "newPassword": "newpassword123"
  }
  ```
- **响应**:
  ```json
  {
    "success": true,
    "message": "密码修改成功"
  }
  ```

### 4.6 修改当前用户密码
- **URL**: `/api/users/self/password`
- **方法**: `PUT`
- **认证**: 需要JWT令牌
- **请求参数**:
  ```json
  {
    "oldPassword": "oldpassword123",
    "newPassword": "newpassword123"
  }
  ```
- **响应**:
  ```json
  {
    "success": true,
    "message": "密码修改成功"
  }
  ```

## 5. 角色管理

### 5.1 获取所有角色
- **URL**: `/api/roles`
- **方法**: `GET`
- **认证**: 需要JWT令牌
- **响应**:
  ```json
  [
    {
      "id": 1,
      "name": "管理员"
    },
    {
      "id": 2,
      "name": "普通用户"
    }
  ]
  ```

## 6. 项目权限管理

### 6.1 获取用户项目权限列表
- **URL**: `/api/users/:userId/project-permissions`
- **方法**: `GET`
- **认证**: 需要JWT令牌（管理员或用户本人）
- **响应**:
  ```json
  [
    { "projectId": 1 },
    { "projectId": 2 }
  ]
  ```

### 6.2 为用户添加项目权限
- **URL**: `/api/users/:userId/project-permissions`
- **方法**: `POST`
- **认证**: 需要JWT令牌（仅管理员）
- **请求参数**:
  ```json
  {
    "projectId": 3
  }
  ```
- **响应**:
  ```json
  {
    "success": true,
    "message": "项目权限添加成功"
  }
  ```

### 6.3 移除用户的项目权限
- **URL**: `/api/users/:userId/project-permissions/:projectId`
- **方法**: `DELETE`
- **认证**: 需要JWT令牌（仅管理员）
- **响应**:
  ```json
  {
    "success": true,
    "message": "项目权限移除成功"
  }
  ```

## 7. API 状态检查

### 7.1 API 根路径
- **URL**: `/api`
- **方法**: `GET`
- **响应**:
  ```json
  {
    "message": "API服务运行正常"
  }
  ```

## 8. 错误处理

### 8.1 通用错误响应格式
```json
{
  "error": "错误信息"
}
```

### 8.2 常见HTTP状态码
- `200`: 请求成功
- `400`: 请求参数错误
- `401`: 未认证
- `403`: 禁止访问
- `404`: 资源不存在
- `500`: 服务器错误

## 9. 认证与授权机制

- **认证方式**: JWT令牌
- **令牌有效期**: 默认3600秒（1小时）
- **权限控制**:
  - 管理员（roleId=1）: 可以访问所有API
  - 普通用户（roleId=2）: 只能访问自己有权限的项目和程序

## 10. 项目结构说明

### 10.1 前端结构
- 前端代码位于 `client/` 目录
- 使用 React + Vite 构建
- API 调用通过 Axios 实现，配置文件：`client/src/utils/api.js`

### 10.2 后端结构
- 后端代码位于 `backend/` 目录
- 使用 Node.js + Express 构建
- 主要模块：
  - `app.js`: 应用入口
  - `routes/index.js`: API 路由定义
  - `models/db.js`: 数据模型
  - `middleware/auth.js`: 认证中间件
  - `services/supervisor.js`: Supervisor 服务调用

## 11. 部署说明

### 11.1 前端部署
```bash
cd client
npm install
npm run build
# 构建产物位于 client/dist 目录
```

### 11.2 后端部署
```bash
cd backend
npm install
npm run server
# 服务运行在 http://localhost:3000
```

### 11.3 环境变量
- `PORT`: 后端服务端口（默认：3000）
- `SECRET_KEY`: JWT 签名密钥（默认：随机生成）

## 12. 数据存储

### 12.1 用户数据
- 存储文件: `backend/data/users.json`
- 包含用户基本信息和密码哈希

### 12.2 角色数据
- 存储文件: `backend/data/roles.json`
- 包含角色定义

### 12.3 项目数据
- 存储文件: `backend/data/projects.json`
- 包含项目配置信息

### 12.4 用户项目权限
- 存储文件: `backend/data/userProjectPermissions.json`
- 包含用户与项目的权限映射关系