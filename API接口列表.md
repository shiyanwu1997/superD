# Supervisor V1 API接口列表

## 1. 认证相关接口

| 接口名称 | 请求方法 | 路径 | 参数 | 权限要求 | 描述 |
|---------|---------|------|------|---------|------|
| 登录 | POST | /api/login | body: {username, password} | 无 | 用户登录，返回JWT令牌 |
| 退出登录 | GET | /logout | 无 | 无 | 清除会话，重定向到登录页 |
| 获取用户信息 | GET | /api/user | 无 | 需要认证 | 获取当前登录用户信息 |

## 2. 项目管理接口

| 接口名称 | 请求方法 | 路径 | 参数 | 权限要求 | 描述 |
|---------|---------|------|------|---------|------|
| 获取用户可访问的项目列表 | GET | /api/projects | 无 | 需要认证 | 获取当前用户可访问的所有项目 |
| 创建新项目 | POST | /api/projects | body: {name, description, host, port, username, password} | 需要认证，仅管理员 | 创建新的Supervisor项目 |
| 更新项目 | PUT | /api/projects/:id | path: id<br>body: {name, description, host, port, username, password} | 需要认证，仅管理员 | 更新项目信息 |
| 删除项目 | DELETE | /api/projects/:id | path: id | 需要认证，仅管理员 | 删除指定项目 |

## 3. 程序管理接口

| 接口名称 | 请求方法 | 路径 | 参数 | 权限要求 | 描述 |
|---------|---------|------|------|---------|------|
| 获取项目下的程序列表 | GET | /api/projects/:projectId/programs | path: projectId | 需要认证，项目权限 | 获取指定项目下的所有程序 |
| 获取所有程序列表 | GET | /api/programs | 无 | 需要认证 | 获取当前用户可访问的所有程序 |
| 获取程序详情 | GET | /api/programs/:programId | path: programId | 需要认证，项目权限 | 获取指定程序的详细信息 |
| 获取程序标准输出日志 | GET | /api/programs/:programId/stdout | path: programId<br>query: {offset=0, length=100000} | 需要认证，项目权限 | 获取程序的标准输出日志 |
| 获取程序标准错误日志 | GET | /api/programs/:programId/stderr | path: programId<br>query: {offset=0, length=100000} | 需要认证，项目权限 | 获取程序的标准错误日志 |
| 启动所有程序 | POST | /api/projects/:projectId/programs/start-all | path: projectId | 需要认证，项目权限 | 启动指定项目下的所有程序 |
| 停止所有程序 | POST | /api/projects/:projectId/programs/stop-all | path: projectId | 需要认证，项目权限 | 停止指定项目下的所有程序 |
| 重启所有程序 | POST | /api/projects/:projectId/programs/restart-all | path: projectId | 需要认证，项目权限 | 重启指定项目下的所有程序 |
| 启动程序 | POST | /api/programs/:programId/start | path: programId | 需要认证，项目权限 | 启动指定程序 |
| 停止程序 | POST | /api/programs/:programId/stop | path: programId | 需要认证，项目权限 | 停止指定程序 |
| 重启程序 | POST | /api/programs/:programId/restart | path: programId | 需要认证，项目权限 | 重启指定程序 |

## 4. 用户管理接口

| 接口名称 | 请求方法 | 路径 | 参数 | 权限要求 | 描述 |
|---------|---------|------|------|---------|------|
| 获取所有用户列表 | GET | /api/users | 无 | 需要认证，仅管理员 | 获取所有用户信息 |
| 创建新用户 | POST | /api/users | body: {username, password, roleId} | 需要认证，仅管理员 | 创建新用户 |
| 删除用户 | DELETE | /api/users/:userId | path: userId | 需要认证，仅管理员 | 删除指定用户 |
| 更新用户角色 | PUT | /api/users/:userId/role | path: userId<br>body: {roleId} | 需要认证，仅管理员 | 更新用户角色 |
| 用户修改自己的密码 | PUT | /api/users/self/password | body: {oldPassword, newPassword} | 需要认证 | 当前用户修改自己的密码 |
| 管理员修改用户密码 | PUT | /api/users/:userId/password | path: userId<br>body: {newPassword} | 需要认证，仅管理员 | 管理员修改指定用户的密码 |

## 5. 角色与权限管理接口

| 接口名称 | 请求方法 | 路径 | 参数 | 权限要求 | 描述 |
|---------|---------|------|------|---------|------|
| 获取所有角色 | GET | /api/roles | 无 | 需要认证 | 获取所有角色信息 |
| 获取用户项目权限列表 | GET | /api/users/:userId/project-permissions | path: userId | 需要认证，管理员或本人 | 获取指定用户的项目权限 |
| 为用户添加项目权限 | POST | /api/users/:userId/project-permissions | path: userId<br>body: {projectId} | 需要认证，仅管理员 | 为指定用户添加项目权限 |
| 移除用户的项目权限 | DELETE | /api/users/:userId/project-permissions/:projectId | path: userId, projectId | 需要认证，仅管理员 | 移除指定用户的项目权限 |

## 6. 其他接口

| 接口名称 | 请求方法 | 路径 | 参数 | 权限要求 | 描述 |
|---------|---------|------|------|---------|------|
| 根路径 | GET | / | 无 | 无 | 返回API服务器状态信息 |
| API根路径 | GET | /api | 无 | 无 | 返回API服务状态信息 |

## 权限说明

- **需要认证**：请求需要在Authorization头中包含有效的JWT令牌，或在session中包含用户信息
- **仅管理员**：当前登录用户必须是管理员角色（roleId=1）
- **项目权限**：当前登录用户必须具有访问该项目的权限
- **管理员或本人**：当前登录用户必须是管理员或要操作的用户本人