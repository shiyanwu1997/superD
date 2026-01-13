// 仅使用MySQL存储的数据库服务
const { STORAGE_CONFIG } = require('../config');

// 导出MySQL数据库实现
let dbImplementation;

// 立即连接并设置数据库实现
async function initializeDatabase() {
  try {
    console.log('正在初始化MySQL数据库存储...\n');
    
    // 连接到MySQL服务器（不指定数据库）
    const mysql = require('mysql2/promise');
    const connection = await mysql.createConnection({
      host: STORAGE_CONFIG.MYSQL.HOST,
      port: STORAGE_CONFIG.MYSQL.PORT,
      user: STORAGE_CONFIG.MYSQL.USER,
      password: STORAGE_CONFIG.MYSQL.PASSWORD,
      multipleStatements: true
    });
    
    // 检查数据库是否存在，如果不存在则创建
    await connection.query(`CREATE DATABASE IF NOT EXISTS ${STORAGE_CONFIG.MYSQL.DATABASE} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    console.log(`数据库 ${STORAGE_CONFIG.MYSQL.DATABASE} 检查/创建完成\n`);
    
    // 选择数据库
    await connection.query(`USE ${STORAGE_CONFIG.MYSQL.DATABASE}`);
    
    // 测试连接
    await connection.query('SELECT 1');
    await connection.end();
    
    console.log('MySQL数据库连接成功\n');
    
    // 设置数据库实现为MySQL
    dbImplementation = require('./db.mysql');
    
  } catch (error) {
    console.error('MySQL数据库初始化失败:', error.message + '\n');
    console.error('错误详情:', error.stack + '\n');
    process.exit(1); // 无法连接MySQL时退出程序
  }
}

// 立即执行初始化
initializeDatabase();

// 确保所有方法都支持异步调用
module.exports = new Proxy({}, {
  get: function(target, prop) {
    if (!dbImplementation) {
      throw new Error('数据库实现尚未初始化完成');
    }
    return dbImplementation[prop];
  }
});
