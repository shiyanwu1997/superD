const mysql = require('mysql2/promise');
const { STORAGE_CONFIG } = require('./config');

async function checkUsersTable() {
  try {
    const connection = await mysql.createConnection({
      host: STORAGE_CONFIG.MYSQL.HOST,
      port: STORAGE_CONFIG.MYSQL.PORT,
      user: STORAGE_CONFIG.MYSQL.USER,
      password: STORAGE_CONFIG.MYSQL.PASSWORD,
      database: STORAGE_CONFIG.MYSQL.DATABASE
    });

    console.log('连接MySQL数据库成功');
    
    // 查看users表结构
    const [columns] = await connection.query('DESCRIBE users');
    console.log('Users表结构:');
    console.table(columns);
    
    // 查看当前用户数据
    const [users] = await connection.query('SELECT * FROM users');
    console.log('\n当前用户数据:');
    console.table(users);
    
    await connection.end();
  } catch (error) {
    console.error('检查MySQL表结构失败:', error);
  }
}

checkUsersTable();