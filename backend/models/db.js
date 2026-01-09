// 根据配置动态选择存储方式的数据库服务
const { STORAGE_CONFIG } = require('../config');

// 根据配置选择存储实现，支持MySQL故障自动回退到JSON
async function getDatabaseImplementation() {
  if (STORAGE_CONFIG.TYPE === 'mysql') {
    try {
      console.log('尝试连接MySQL数据库存储...\n');
      // 直接测试MySQL连接，不依赖db.mysql的testConnection函数
      const mysql = require('mysql2/promise');
      const connection = await mysql.createConnection({
        host: STORAGE_CONFIG.MYSQL.HOST,
        port: STORAGE_CONFIG.MYSQL.PORT,
        user: STORAGE_CONFIG.MYSQL.USER,
        password: STORAGE_CONFIG.MYSQL.PASSWORD,
        database: STORAGE_CONFIG.MYSQL.DATABASE
      });
      await connection.query('SELECT 1');
      await connection.end();
      console.log('MySQL数据库连接成功\n');
      return require('./db.mysql');
    } catch (error) {
      console.error('MySQL数据库连接失败，将回退到JSON文件存储:', error.message + '\n');
      // 回退到JSON存储
      return require('./db.json.js');
    }
  } else {
    console.log('使用JSON文件存储\n');
    return require('./db.json.js');
  }
}

// 导出数据库实现
let dbImplementation;

// 立即执行并设置数据库实现
getDatabaseImplementation().then((db) => {
  dbImplementation = db;
}).catch((error) => {
  console.error('获取数据库实现失败:', error + '\n');
  // 出错时默认使用JSON存储
  dbImplementation = require('./db.json.js');
});

// 确保所有方法都支持异步调用
module.exports = new Proxy({}, {
  get: function(target, prop) {
    if (!dbImplementation) {
      throw new Error('数据库实现尚未初始化完成');
    }
    return dbImplementation[prop];
  }
});
