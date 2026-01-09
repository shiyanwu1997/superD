#!/bin/bash

# 测试用户创建功能
# 验证超级管理员创建管理员、管理员创建用户的场景
echo "=== 开始测试用户创建功能 ==="

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

# 辅助函数：获取用户列表
get_users() {
  local token=$1
  curl -s -X GET "$API_URL/users" -H "Authorization: Bearer $token" -H "Content-Type: application/json"
}

# 辅助函数：获取用户数量
get_user_count() {
  local token=$1
  local users=$(get_users "$token")
  echo $users | grep -o "{" | wc -l
}

# 1. 超级管理员登录
echo "\n1. 超级管理员登录..."
ADMIN_TOKEN=$(get_token "$ADMIN_USERNAME" "$ADMIN_PASSWORD")
if [ -z "$ADMIN_TOKEN" ]; then
  echo "❌ 超级管理员登录失败"
  exit 1
fi
echo "✅ 超级管理员登录成功"

# 2. 记录初始用户数量
echo "\n2. 获取初始用户数量..."
INITIAL_COUNT=$(get_user_count "$ADMIN_TOKEN")
echo "初始用户数量: $INITIAL_COUNT"

# 3. 超级管理员创建普通管理员
echo "\n3. 超级管理员创建普通管理员..."
NEW_ADMIN=$(curl -s -X POST "$API_URL/users" -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" -d '{"username":"test_admin_create","password":"123456","roleId":2}')
NEW_ADMIN_ID=$(echo $NEW_ADMIN | sed -n 's/.*"id":\([0-9]*\).*/\1/p')
NEW_ADMIN_USERNAME=$(echo $NEW_ADMIN | sed -n 's/.*"username":"\([^"]*\)".*/\1/p')
if [ -z "$NEW_ADMIN_ID" ]; then
  echo "❌ 创建普通管理员失败"
  exit 1
fi
echo "✅ 创建普通管理员成功，ID: $NEW_ADMIN_ID, 用户名: $NEW_ADMIN_USERNAME"

# 4. 验证超级管理员可以看到新创建的管理员
echo "\n4. 验证超级管理员可以看到新创建的管理员..."
ADMIN_USER_LIST=$(get_users "$ADMIN_TOKEN")
if [[ "$ADMIN_USER_LIST" == *"$NEW_ADMIN_USERNAME"* ]]; then
  echo "✅ 超级管理员可以看到新创建的管理员"
else
  echo "❌ 超级管理员无法看到新创建的管理员"
  exit 1
fi

# 5. 普通管理员登录
echo "\n5. 普通管理员登录..."
ADMIN_TOKEN_2=$(get_token "$NEW_ADMIN_USERNAME" "123456")
if [ -z "$ADMIN_TOKEN_2" ]; then
  echo "❌ 普通管理员登录失败"
  exit 1
fi
echo "✅ 普通管理员登录成功"

# 6. 普通管理员创建普通用户
echo "\n6. 普通管理员创建普通用户..."
NEW_USER=$(curl -s -X POST "$API_URL/users" -H "Authorization: Bearer $ADMIN_TOKEN_2" -H "Content-Type: application/json" -d '{"username":"test_user_create","password":"123456","roleId":3}')
NEW_USER_ID=$(echo $NEW_USER | sed -n 's/.*"id":\([0-9]*\).*/\1/p')
NEW_USER_USERNAME=$(echo $NEW_USER | sed -n 's/.*"username":"\([^"]*\)".*/\1/p')
if [ -z "$NEW_USER_ID" ]; then
  echo "❌ 创建普通用户失败"
  exit 1
fi
echo "✅ 创建普通用户成功，ID: $NEW_USER_ID, 用户名: $NEW_USER_USERNAME"

# 7. 验证普通管理员可以看到自己创建的用户
echo "\n7. 验证普通管理员可以看到自己创建的用户..."
ADMIN2_USER_LIST=$(get_users "$ADMIN_TOKEN_2")
if [[ "$ADMIN2_USER_LIST" == *"$NEW_USER_USERNAME"* ]] && [[ "$ADMIN2_USER_LIST" == *"$NEW_ADMIN_USERNAME"* ]]; then
  echo "✅ 普通管理员可以看到自己和自己创建的用户"
else
  echo "❌ 普通管理员无法看到预期的用户列表"
  echo "普通管理员看到的用户列表: $ADMIN2_USER_LIST"
  exit 1
fi

# 8. 验证普通管理员看不到其他管理员（除了自己）
echo "\n8. 验证普通管理员看不到其他管理员..."
if [[ "$ADMIN2_USER_LIST" != *"$ADMIN_USERNAME"* ]]; then
  echo "✅ 普通管理员看不到超级管理员（符合预期）"
else
  echo "❌ 普通管理员可以看到超级管理员（不符合预期）"
  exit 1
fi

# 9. 普通用户登录
echo "\n9. 普通用户登录..."
USER_TOKEN=$(get_token "$NEW_USER_USERNAME" "123456")
if [ -z "$USER_TOKEN" ]; then
  echo "❌ 普通用户登录失败"
  exit 1
fi
echo "✅ 普通用户登录成功"

# 10. 验证普通用户只能看到自己
echo "\n10. 验证普通用户只能看到自己..."
USER_USER_LIST=$(get_users "$USER_TOKEN")
if [[ "$USER_USER_LIST" == *"$NEW_USER_USERNAME"* ]] && [[ $(echo $USER_USER_LIST | grep -o "{" | wc -l) -eq 1 ]]; then
  echo "✅ 普通用户只能看到自己（符合预期）"
else
  echo "❌ 普通用户看到了不应看到的用户"
  echo "普通用户看到的用户列表: $USER_USER_LIST"
  exit 1
fi

# 11. 清理测试数据
echo "\n11. 清理测试数据..."
# 删除普通用户
curl -s -X DELETE "$API_URL/users/$NEW_USER_ID" -H "Authorization: Bearer $ADMIN_TOKEN" > /dev/null

# 删除普通管理员
curl -s -X DELETE "$API_URL/users/$NEW_ADMIN_ID" -H "Authorization: Bearer $ADMIN_TOKEN" > /dev/null

echo "\n=== 用户创建功能测试完成 ==="
echo "✅ 所有测试通过！用户创建功能符合预期要求"
