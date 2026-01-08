// 根据配置动态选择存储方式的数据库服务
const { STORAGE_CONFIG } = require('../config');

// 根据配置选择存储实现
let dbImplementation;

if (STORAGE_CONFIG.TYPE === 'mysql') {
  console.log('使用MySQL数据库存储\n');
  dbImplementation = require('./db.mysql');
} else {
  console.log('使用JSON文件存储\n');
  dbImplementation = require('./db.json.js');
}

// 导出所选的存储实现
module.exports = dbImplementation;
