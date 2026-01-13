const db = require('./models/db.mysql');

async function checkRoles() {
  try {
    console.log('正在查询所有角色数据...');
    const roles = await db.getAllRoles();
    
    console.log('\n角色列表：');
    console.log('ID | 角色名称 | 描述');
    console.log('--------------------------------');
    
    roles.forEach(role => {
      console.log(`${role.id} | ${role.name} | ${role.description}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('查询角色数据失败:', error);
    process.exit(1);
  }
}

checkRoles();
