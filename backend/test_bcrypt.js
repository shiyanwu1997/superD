const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');

// 数据文件路径
const USERS_FILE = path.join(__dirname, 'data', 'users.json');

async function testBcrypt() {
  try {
    // 读取用户数据
    const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    const admin = users.find(user => user.username === 'admin');
    
    if (!admin) {
      console.log('Admin用户不存在\n');
      return;
    }
    
    console.log('Admin用户信息:', admin + '\n');
    
    // 测试密码比较
    const password = 'admin';
    const isMatch = await bcrypt.compare(password, admin.password);
    
    console.log(`密码 '${password}' 与存储的哈希值匹配:`, isMatch + '\n');
    
    // 生成一个新的哈希值并测试
    const newHash = await bcrypt.hash(password, 10);
    console.log('新生成的哈希值:', newHash + '\n');
    const newIsMatch = await bcrypt.compare(password, newHash);
    console.log(`密码 '${password}' 与新生成的哈希值匹配:`, newIsMatch + '\n');
    
  } catch (error) {
    console.error('测试失败:', error + '\n');
  }
}

testBcrypt();