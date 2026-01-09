#!/bin/bash

# 测试用户可见性功能
# 验证不同角色用户能看到的用户范围
echo "=== 开始测试用户可见性功能 ==="

# 定义常量
API_URL="http://localhost:3000/api"
ADMIN_USERNAME="admin"
ADMIN_PASSWORD="oplgmpnb91b9akbd"

# 辅助函数：获取Token
get_token() {
  local username=$1
  local password=$2
  local login_result=$(curl -s -X POST "$API_URL/login" -H "Content-Type: application/json" -d '{"username":"'$username'","password":"'$password'"}')
  echo $login_result | sed -n 's/.*"token":"\([^"]*\)".*/\1/p'
}

# 辅助函数：获取用户列表（详细）
get_users_detailed() {
  local token=$1
  curl -s -X GET "$API_URL/users" -H "Authorization: Bearer $token" -H "Content-Type: application/json"
}

# 1. 超级管理员登录
echo "\n1. 超级管理员登录..."
ADMIN_TOKEN=$(get_token "$ADMIN_USERNAME" "$ADMIN_PASSWORD")
if [ -z "$ADMIN_TOKEN" ]; then
  echo "❌ 超级管理员登录失败"
  exit 1
fi
echo "✅ 超级管理员登录成功"

# 2. 超级管理员创建普通管理员
echo "\n2. 超级管理员创建普通管理员..."
NEW_ADMIN=$(curl -s -X POST "$API_URL/users" -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" -d '{"username":"test_admin_vis","password":"123456","roleId":2}')
NEW_ADMIN_ID=$(echo $NEW_ADMIN | sed -n 's/.*"id":\([0-9]*\).*/\1/p')
NEW_ADMIN_USERNAME=$(echo $NEW_ADMIN | sed -n 's/.*"username":"\([^"]*\)".*/\1/p')
if [ -z "$NEW_ADMIN_ID" ]; then
  echo "❌ 创建普通管理员失败"
  exit 1
fi
echo "✅ 创建普通管理员成功，ID: $NEW_ADMIN_ID, 用户名: $NEW_ADMIN_USERNAME"

# 3. 普通管理员登录
echo "\n3. 普通管理员登录..."
ADMIN_TOKEN_2=$(get_token "$NEW_ADMIN_USERNAME" "123456")
if [ -z "$ADMIN_TOKEN_2" ]; then
  echo "❌ 普通管理员登录失败"
  exit 1
fi
echo "✅ 普通管理员登录成功"

# 4. 普通管理员创建普通用户
echo "\n4. 普通管理员创建普通用户..."
NEW_USER=$(curl -s -X POST "$API_URL/users" -H "Authorization: Bearer $ADMIN_TOKEN_2" -H "Content-Type: application/json" -d '{"username":"test_user_vis","password":"123456","roleId":3}')
NEW_USER_ID=$(echo $NEW_USER | sed -n 's/.*"id":\([0-9]*\).*/\1/p')
NEW_USER_USERNAME=$(echo $NEW_USER | sed -n 's/.*"username":"\([^"]*\)".*/\1/p')
if [ -z "$NEW_USER_ID" ]; then
  echo "❌ 创建普通用户失败"
  exit 1
fi
echo "✅ 创建普通用户成功，ID: $NEW_USER_ID, 用户名: $NEW_USER_USERNAME"

# 5. 超级管理员查看用户列表
echo "\n5. 超级管理员查看用户列表..."
ADMIN_USERS=$(get_users_detailed "$ADMIN_TOKEN")
echo "超级管理员看到的用户："
echo $ADMIN_USERS | jq -r '.[] | "ID: \(.id), 用户名: \(.username), 角色ID: \(.roleId), 创建者: \(.createdBy)"'

# 6. 普通管理员查看用户列表
echo "\n6. 普通管理员查看用户列表..."
ADMIN2_USERS=$(get_users_detailed "$ADMIN_TOKEN_2")
echo "普通管理员看到的用户："
echo $ADMIN2_USERS | jq -r '.[] | "ID: \(.id), 用户名: \(.username), 角色ID: \(.roleId), 创建者: \(.createdBy)"'

# 7. 检查普通管理员是否看到了超级管理员
echo "\n7. 检查普通管理员是否看到了超级管理员..."
if echo $ADMIN2_USERS | grep -q '"username":"admin"'; then
  echo "❌ 普通管理员看到了超级管理员（不符合预期）"
  # 显示普通管理员看到的完整用户列表
  echo "普通管理员看到的完整用户列表："
  echo $ADMIN2_USERS | jq .
else
  echo "✅ 普通管理员没有看到超级管理员（符合预期）"
fi

# 8. 检查普通管理员是否只能看到自己和自己创建的用户
echo "\n8. 检查普通管理员是否只能看到自己和自己创建的用户..."
ADMIN2_USER_COUNT=$(echo $ADMIN2_USERS | jq '. | length')
if [ "$ADMIN2_USER_COUNT" -eq 2 ]; then
  echo "✅ 普通管理员只看到了自己和自己创建的用户（符合预期）"
else
  echo "❌ 普通管理员看到了 $ADMIN2_USER_COUNT 个用户，而不是预期的2个"
  echo "普通管理员看到的完整用户列表："
  echo $ADMIN2_USERS | jq .
fi

# 9. 清理测试数据
echo "\n9. 清理测试数据..."
# 删除普通用户
curl -s -X DELETE "$API_URL/users/$NEW_USER_ID" -H "Authorization: Bearer $ADMIN_TOKEN" > /dev/null

# 删除普通管理员
curl -s -X DELETE "$API_URL/users/$NEW_ADMIN_ID" -H "Authorization: Bearer $ADMIN_TOKEN" > /dev/null

echo "\n=== 用户可见性功能测试完成 ==="
