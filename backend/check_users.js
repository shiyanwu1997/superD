const db = require('./models/db.mysql');

async function checkUsers() {
  try {
    console.log('正在查询所有用户数据...');
    const users = await db.getAllUsers();
    
    console.log('\n用户列表：');
    console.log('ID | 用户名 | 角色ID | CreatedBy');
    console.log('--------------------------------');
    
    users.forEach(user => {
      console.log(`${user.id} | ${user.username} | ${user.roleId} | ${user.createdBy}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('查询用户数据失败:', error);
    process.exit(1);
  }
}

checkUsers();
