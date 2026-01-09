#!/bin/bash

# 测试角色转换功能

echo "=== 测试角色转换功能 ==="

# 1. 登录超级管理员账号获取token
echo "
1. 登录超级管理员账号..."
ADMIN_LOGIN=$(curl -s -X POST http://localhost:3000/api/login -H "Content-Type: application/json" -d '{"username":"admin","password":"oplgmpnb91b9akbd"}')
echo "登录结果: $ADMIN_LOGIN"

# 解析token
TOKEN=$(echo $ADMIN_LOGIN | awk -F '"token":"' '{print $2}' | awk -F '"' '{print $1}')
echo "获取到的token: $TOKEN"

# 2. 创建一个普通用户
echo "
2. 创建普通用户 'testuser'..."
CREATE_USER=$(curl -s -X POST http://localhost:3000/api/users -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d '{"username":"testuser","password":"test123","roleId":3}')
echo "创建用户结果: $CREATE_USER"

# 解析新创建用户的ID
USER_ID=$(echo $CREATE_USER | awk -F '"id":' '{print $2}' | awk -F ',' '{print $1}')
echo "新创建用户ID: $USER_ID"

# 3. 将普通用户转换为普通管理员
echo "
3. 将普通用户转换为普通管理员..."
CONVERT_ROLE=$(curl -s -X PUT http://localhost:3000/api/users/$USER_ID/role -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d '{"roleId":2}')
echo "角色转换结果: $CONVERT_ROLE"

# 4. 获取用户列表验证转换结果
echo "
4. 验证角色转换结果..."
GET_USERS=$(curl -s -X GET http://localhost:3000/api/users -H "Authorization: Bearer $TOKEN")
echo "用户列表: $GET_USERS"

# 解析转换后的用户信息
echo "
5. 解析转换后的用户信息..."
# 使用更简单的方法直接从用户列表中查找用户
CONVERTED_USER=$(echo $GET_USERS | grep -A 20 '"id":'$USER_ID | head -20)
echo "转换后的用户信息: $CONVERTED_USER"

# 检查角色ID和createdBy字段
ROLE_ID=$(echo $CONVERTED_USER | awk -F '"roleId":' '{print $2}' | awk -F ',' '{print $1}')
CREATED_BY=$(echo $CONVERTED_USER | awk -F '"createdBy":' '{print $2}' | awk -F ',' '{print $1}')

echo "
6. 检查转换结果:
   - 角色ID: $ROLE_ID (预期: 2)
   - createdBy: $CREATED_BY (预期: 1)
"

# 验证结果
if [ "$ROLE_ID" == "2" ] && [ "$CREATED_BY" == "1" ]; then
    echo "✅ 角色转换成功！普通用户已转换为普通管理员，且createdBy正确设置为超级管理员ID"
else
    echo "❌ 角色转换失败！预期角色ID为2，实际为$ROLE_ID；预期createdBy为1，实际为$CREATED_BY"
fi

# 7. 将普通管理员转换回普通用户
echo "
7. 将普通管理员转换回普通用户..."
CONVERT_BACK=$(curl -s -X PUT http://localhost:3000/api/users/$USER_ID/role -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d '{"roleId":3}')
echo "角色转换回普通用户结果: $CONVERT_BACK"

# 8. 再次验证转换结果
echo "
8. 验证转换回普通用户的结果..."
GET_USERS_AGAIN=$(curl -s -X GET http://localhost:3000/api/users -H "Authorization: Bearer $TOKEN")
CONVERTED_BACK_USER=$(echo $GET_USERS_AGAIN | grep -A 20 '"id":'$USER_ID | head -20)
NEW_ROLE_ID=$(echo $CONVERTED_BACK_USER | awk -F '"roleId":' '{print $2}' | awk -F ',' '{print $1}')

echo "转换回普通用户后的角色ID: $NEW_ROLE_ID"

if [ "$NEW_ROLE_ID" == "3" ]; then
    echo "✅ 角色转换成功！普通管理员已转换回普通用户"
else
    echo "❌ 角色转换失败！预期角色ID为3，实际为$NEW_ROLE_ID"
fi

echo "
=== 测试完成 ==="
