const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');

// 数据文件路径
const USERS_FILE = path.join(__dirname, 'data', 'users.json');

// 重置testadmin的密码为'testadmin'
async function resetPassword() {
  try {
    // 读取用户数据
    const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    
    // 同时重置admin和test1的密码
    // 重置admin的密码为'admin'
    const adminIndex = users.findIndex(user => user.username === 'admin');
    if (adminIndex !== -1) {
      const adminHashedPassword = await bcrypt.hash('admin', 10);
      users[adminIndex].password = adminHashedPassword;
      console.log('admin密码已重置为admin');
      console.log('admin用户信息:', users[adminIndex]);
    } else {
      console.log('admin用户不存在');
    }
    
    // 重置test1的密码为'test1'
    const test1Index = users.findIndex(user => user.username === 'test1');
    if (test1Index !== -1) {
      const test1HashedPassword = await bcrypt.hash('test1', 10);
      users[test1Index].password = test1HashedPassword;
      console.log('test1密码已重置为test1');
      console.log('test1用户信息:', users[test1Index]);
    } else {
      console.log('test1用户不存在');
    }
    
    // 保存到文件
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
    console.log('密码重置完成');
  } catch (error) {
    console.error('重置密码失败:', error);
  }
}

resetPassword();