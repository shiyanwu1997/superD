#!/bin/bash

# 测试用户创建限制功能
# 验证普通管理员不能创建管理员、超级管理员创建普通用户的限制
echo "=== 开始测试用户创建限制功能 ==="

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
NEW_ADMIN=$(curl -s -X POST "$API_URL/users" -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" -d '{"username":"test_admin_restrict","password":"123456","roleId":2}')
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

# 4. 普通管理员尝试创建普通管理员（应该失败）
echo "\n4. 普通管理员尝试创建普通管理员..."
CREATE_ADMIN_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API_URL/users" -H "Authorization: Bearer $ADMIN_TOKEN_2" -H "Content-Type: application/json" -d '{"username":"test_admin_fail","password":"123456","roleId":2}')
if [ "$CREATE_ADMIN_STATUS" -eq 403 ]; then
  echo "✅ 普通管理员无法创建普通管理员（状态码: 403，符合预期）"
else
  echo "❌ 普通管理员成功创建了普通管理员（状态码: $CREATE_ADMIN_STATUS，不符合预期）"
fi

# 5. 普通管理员创建普通用户（应该成功）
echo "\n5. 普通管理员创建普通用户..."
CREATE_USER_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API_URL/users" -H "Authorization: Bearer $ADMIN_TOKEN_2" -H "Content-Type: application/json" -d '{"username":"test_user_success","password":"123456","roleId":3}')
if [ "$CREATE_USER_STATUS" -eq 200 ]; then
  echo "✅ 普通管理员成功创建普通用户（状态码: 200，符合预期）"
  # 获取创建的用户ID以便清理
  CREATED_USER=$(curl -s -X POST "$API_URL/users" -H "Authorization: Bearer $ADMIN_TOKEN_2" -H "Content-Type: application/json" -d '{"username":"test_user_cleanup","password":"123456","roleId":3}')
  CLEANUP_USER_ID=$(echo $CREATED_USER | sed -n 's/.*"id":\([0-9]*\).*/\1/p')
else
  echo "❌ 普通管理员无法创建普通用户（状态码: $CREATE_USER_STATUS，不符合预期）"
fi

# 6. 超级管理员创建普通用户时指定createdBy
echo "\n6. 超级管理员创建普通用户时指定createdBy..."
CREATE_USER_WITH_CREATEDBY=$(curl -s -X POST "$API_URL/users" -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" -d '{"username":"test_user_with_createdby","password":"123456","roleId":3,"createdBy":'$NEW_ADMIN_ID'}')
CREATED_USER_ID=$(echo $CREATE_USER_WITH_CREATEDBY | sed -n 's/.*"id":\([0-9]*\).*/\1/p')
if [ -z "$CREATED_USER_ID" ]; then
  echo "❌ 超级管理员创建普通用户失败"
else
  echo "✅ 超级管理员成功创建普通用户并指定了createdBy，ID: $CREATED_USER_ID"
  # 检查创建的用户的createdBy是否正确
  CREATED_USER=$(curl -s -X GET "$API_URL/users/$CREATED_USER_ID" -H "Authorization: Bearer $ADMIN_TOKEN")
  USER_CREATEDBY=$(echo $CREATED_USER | sed -n 's/.*"createdBy":\([0-9]*\).*/\1/p')
  if [ "$USER_CREATEDBY" -eq "$NEW_ADMIN_ID" ]; then
    echo "✅ 创建的用户的createdBy字段正确（$USER_CREATEDBY）"
  else
    echo "❌ 创建的用户的createdBy字段不正确（预期: $NEW_ADMIN_ID，实际: $USER_CREATEDBY）"
  fi
fi

# 7. 清理测试数据
echo "\n7. 清理测试数据..."
# 删除创建的用户
if [ ! -z "$CREATED_USER_ID" ]; then
  curl -s -X DELETE "$API_URL/users/$CREATED_USER_ID" -H "Authorization: Bearer $ADMIN_TOKEN" > /dev/null
fi
if [ ! -z "$CLEANUP_USER_ID" ]; then
  curl -s -X DELETE "$API_URL/users/$CLEANUP_USER_ID" -H "Authorization: Bearer $ADMIN_TOKEN" > /dev/null
fi

# 删除普通管理员
curl -s -X DELETE "$API_URL/users/$NEW_ADMIN_ID" -H "Authorization: Bearer $ADMIN_TOKEN" > /dev/null

echo "\n=== 用户创建限制功能测试完成 ==="
