const mysql = require('mysql2/promise');
const config = require('./config');

async function fixRoles() {
  try {
    // 连接到MySQL服务器
    const connection = await mysql.createConnection({
      host: config.STORAGE_CONFIG.MYSQL.HOST,
      port: config.STORAGE_CONFIG.MYSQL.PORT,
      user: config.STORAGE_CONFIG.MYSQL.USER,
      password: config.STORAGE_CONFIG.MYSQL.PASSWORD,
      database: config.STORAGE_CONFIG.MYSQL.DATABASE
    });

    console.log('成功连接到MySQL服务器');

    // 1. 重命名现有的user角色为user_admin（普通管理员）
    await connection.query(
      'UPDATE roles SET name = ? WHERE id = ?',
      ['user_admin', 2]
    );
    console.log('已将角色2重命名为user_admin');

    // 2. 添加普通用户角色（roleId=3）
    await connection.query(
      'INSERT INTO roles (id, name, description) VALUES (?, ?, ?)',
      [3, 'user', '普通用户角色，拥有有限权限']
    );
    console.log('已添加普通用户角色（roleId=3）');

    // 3. 更新现有用户的角色：
    // - 将admin用户保持为roleId=1
    // - 将test用户（roleId=2）修改为roleId=3（普通用户）
    // - 将qqq用户（roleId=1）修改为roleId=2（普通管理员）
    await connection.query('UPDATE users SET roleId = ? WHERE id = ?', [3, 2]); // test → 普通用户
    await connection.query('UPDATE users SET roleId = ? WHERE id = ?', [2, 4]); // qqq → 普通管理员
    console.log('已更新现有用户的角色');

    // 4. 显示更新后的角色表
    const [roles] = await connection.query('SELECT * FROM roles');
    console.log('\n更新后的角色表：');
    console.log('ID | 角色名称 | 描述');
    console.log('--------------------------------');
    roles.forEach(role => {
      console.log(`${role.id} | ${role.name} | ${role.description}`);
    });

    // 5. 显示更新后的用户表
    const [users] = await connection.query('SELECT id, username, roleId, createdBy FROM users');
    console.log('\n更新后的用户表：');
    console.log('ID | 用户名 | 角色ID | CreatedBy');
    console.log('--------------------------------');
    users.forEach(user => {
      console.log(`${user.id} | ${user.username} | ${user.roleId} | ${user.createdBy}`);
    });

    // 关闭连接
    await connection.end();
    console.log('\n角色修复完成！');

  } catch (error) {
    console.error('角色修复失败:', error);
    process.exit(1);
  }
}

fixRoles();
