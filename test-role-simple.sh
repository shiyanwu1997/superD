#!/bin/bash

# 简单测试角色转换功能

echo "=== 简单测试角色转换功能 ==="

# 1. 登录超级管理员账号
echo "
1. 登录超级管理员账号..."
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3000/api/login -H "Content-Type: application/json" -d '{"username":"admin","password":"oplgmpnb91b9akbd"}')
TOKEN=$(echo $LOGIN_RESPONSE | awk -F '"token":"' '{print $2}' | awk -F '"' '{print $1}')
echo "获取到的token: $TOKEN"

# 2. 创建测试用户
echo "
2. 创建测试用户 'testuser'（角色ID=3）..."
CREATE_RESPONSE=$(curl -s -X POST http://localhost:3000/api/users -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d '{"username":"testuser","password":"test123","roleId":3}')
echo "创建用户结果: $CREATE_RESPONSE"

# 3. 获取用户列表
echo "
3. 获取用户列表..."
USERS_RESPONSE=$(curl -s -X GET http://localhost:3000/api/users -H "Authorization: Bearer $TOKEN")
echo "用户列表: $USERS_RESPONSE"

# 4. 将用户转换为管理员
echo "
4. 将 'testuser' 转换为管理员（角色ID=2）..."
CONVERT_RESPONSE=$(curl -s -X PUT http://localhost:3000/api/users/3/role -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d '{"roleId":2}')
echo "转换结果: $CONVERT_RESPONSE"

# 5. 再次获取用户列表验证转换结果
echo "
5. 再次获取用户列表验证转换结果..."
USERS_RESPONSE_AFTER=$(curl -s -X GET http://localhost:3000/api/users -H "Authorization: Bearer $TOKEN")
echo "转换后的用户列表: $USERS_RESPONSE_AFTER"

# 6. 直接查看JSON文件验证结果
echo "
6. 直接查看JSON文件验证结果..."
cat /Users/wushiyan/PycharmProjects/supervisor-v1/backend/data/users.json
