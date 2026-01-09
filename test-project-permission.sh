#!/bin/bash

# 测试项目权限继承功能
# 验证普通管理员只能分配自己拥有的项目权限

echo "=== 开始测试项目权限继承功能 ==="

# 定义常量
API_URL="http://localhost:3000/api"
ADMIN_USERNAME="admin"
ADMIN_PASSWORD="oplgmpnb91b9akbd"

# 辅助函数：解析JSON字符串字段
parse_json_string() {
  local json="$1"
  local key="$2"
  echo "$json" | awk -F "$key":" '{print $2}' | awk -F '"' '{print $2}'
}

# 辅助函数：解析JSON数字字段
parse_json_number() {
  local json="$1"
  local key="$2"
  echo "$json" | awk -F "$key":" '{print $2}' | awk -F ',' '{print $1}'
}

# 1. 超级管理员登录
echo "\n1. 超级管理员登录..."
ADMIN_LOGIN=$(curl -s -X POST "$API_URL/login" -H "Content-Type: application/json" -d "{\"username\":\"$ADMIN_USERNAME\",\"password\":\"$ADMIN_PASSWORD\"}")
ADMIN_TOKEN=$(parse_json_string "$ADMIN_LOGIN" "token")
if [ -z "$ADMIN_TOKEN" ]; then
  echo "❌ 超级管理员登录失败: $ADMIN_LOGIN"
  exit 1
fi
echo "✅ 超级管理员登录成功，Token获取成功"

# 2. 超级管理员创建普通管理员
echo "\n2. 超级管理员创建普通管理员..."
NEW_ADMIN=$(curl -s -X POST "$API_URL/users" -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" -d "{\"username\":\"test_admin_$(date +%s)\",\"password\":\"123456\",\"roleId\":2}")
NEW_ADMIN_ID=$(parse_json_number "$NEW_ADMIN" "id")
NEW_ADMIN_USERNAME=$(parse_json_string "$NEW_ADMIN" "username")
if [ -z "$NEW_ADMIN_ID" ]; then
  echo "❌ 创建普通管理员失败: $NEW_ADMIN"
  exit 1
fi
echo "✅ 创建普通管理员成功，ID: $NEW_ADMIN_ID, 用户名: $NEW_ADMIN_USERNAME"

# 3. 超级管理员为普通管理员分配项目权限（项目1）
echo "\n3. 超级管理员为普通管理员分配项目权限（项目1）..."
ASSIGN_PROJECT1=$(curl -s -X POST "$API_URL/users/$NEW_ADMIN_ID/project-permissions" -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" -d "{\"projectId\":1}")
if [[ "$ASSIGN_PROJECT1" != *"success"* ]]; then
  echo "❌ 分配项目1权限失败: $ASSIGN_PROJECT1"
  exit 1
fi
echo "✅ 为普通管理员分配项目1权限成功"

# 4. 普通管理员登录
echo "\n4. 普通管理员登录..."
ADMIN_LOGIN=$(curl -s -X POST "$API_URL/login" -H "Content-Type: application/json" -d "{\"username\":\"$NEW_ADMIN_USERNAME\",\"password\":\"123456\"}")
ADMIN_TOKEN=$(parse_json_string "$ADMIN_LOGIN" "token")
if [ -z "$ADMIN_TOKEN" ]; then
  echo "❌ 普通管理员登录失败: $ADMIN_LOGIN"
  exit 1
fi
echo "✅ 普通管理员登录成功，Token获取成功"

# 5. 普通管理员创建普通用户
echo "\n5. 普通管理员创建普通用户..."
NEW_USER=$(curl -s -X POST "$API_URL/users" -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" -d "{\"username\":\"test_user_$(date +%s)\",\"password\":\"123456\",\"roleId\":3}")
NEW_USER_ID=$(parse_json_number "$NEW_USER" "id")
NEW_USER_USERNAME=$(parse_json_string "$NEW_USER" "username")
if [ -z "$NEW_USER_ID" ]; then
  echo "❌ 创建普通用户失败: $NEW_USER"
  exit 1
fi
echo "✅ 创建普通用户成功，ID: $NEW_USER_ID, 用户名: $NEW_USER_USERNAME"

# 6. 普通管理员为普通用户分配自己拥有的项目权限（项目1）
echo "\n6. 普通管理员为普通用户分配项目1权限（自己拥有的权限）..."
ASSIGN_PROJECT1=$(curl -s -X POST "$API_URL/users/$NEW_USER_ID/project-permissions" -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" -d "{\"projectId\":1}")
if [[ "$ASSIGN_PROJECT1" != *"success"* ]]; then
  echo "❌ 普通管理员为用户分配项目1权限失败: $ASSIGN_PROJECT1"
  exit 1
fi
echo "✅ 普通管理员为用户分配项目1权限成功"

# 7. 普通管理员尝试为普通用户分配自己没有的项目权限（项目2）
echo "\n7. 普通管理员尝试为普通用户分配项目2权限（自己没有的权限）..."
ASSIGN_PROJECT2=$(curl -s -X POST "$API_URL/users/$NEW_USER_ID/project-permissions" -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" -d "{\"projectId\":2}")
if [[ "$ASSIGN_PROJECT2" == *"success"* ]]; then
  echo "❌ 测试失败：普通管理员成功分配了自己没有的项目2权限"
  exit 1
fi
echo "✅ 普通管理员尝试分配自己没有的项目2权限失败（符合预期）"

# 8. 清理测试数据
echo "\n8. 清理测试数据..."
# 重新获取超级管理员Token
ADMIN_LOGIN=$(curl -s -X POST "$API_URL/login" -H "Content-Type: application/json" -d "{\"username\":\"$ADMIN_USERNAME\",\"password\":\"$ADMIN_PASSWORD\"}")
ADMIN_TOKEN=$(parse_json_string "$ADMIN_LOGIN" "token")

# 删除测试用户
DELETE_USER=$(curl -s -X DELETE "$API_URL/users/$NEW_USER_ID" -H "Authorization: Bearer $ADMIN_TOKEN")
if [[ "$DELETE_USER" != *"success"* ]]; then
  echo "⚠️ 删除测试用户失败: $DELETE_USER"
fi

# 删除测试管理员
DELETE_ADMIN=$(curl -s -X DELETE "$API_URL/users/$NEW_ADMIN_ID" -H "Authorization: Bearer $ADMIN_TOKEN")
if [[ "$DELETE_ADMIN" != *"success"* ]]; then
  echo "⚠️ 删除测试管理员失败: $DELETE_ADMIN"
fi

echo "\n=== 项目权限继承功能测试完成 ==="
echo "✅ 所有测试通过！普通管理员只能分配自己拥有的项目权限"
