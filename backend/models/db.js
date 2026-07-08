const { STORAGE_CONFIG } = require('../config');

let dbImplementation = null;

async function initializeDatabase() {
  const storageType = STORAGE_CONFIG.TYPE;

  if (storageType === 'mysql') {
    return initializeMySQL();
  }

  // 默认使用 SQLite
  return initializeSQLite();
}

async function initializeSQLite() {
  try {
    const { initSQLiteDatabase } = require('../init-db');
    await initSQLiteDatabase();
    dbImplementation = require('./db.sqlite');
    console.log('SQLite 数据库初始化完成');
  } catch (error) {
    console.error('SQLite数据库初始化失败:', error.message);
    process.exit(1);
  }
}

async function initializeMySQL() {
  try {
    console.log('正在初始化MySQL数据库存储...');

    const mysql = require('mysql2/promise');
    const connection = await mysql.createConnection({
      host: STORAGE_CONFIG.MYSQL.HOST,
      port: STORAGE_CONFIG.MYSQL.PORT,
      user: STORAGE_CONFIG.MYSQL.USER,
      password: STORAGE_CONFIG.MYSQL.PASSWORD,
      multipleStatements: true
    });

    await connection.query(`CREATE DATABASE IF NOT EXISTS ${STORAGE_CONFIG.MYSQL.DATABASE} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await connection.query(`USE ${STORAGE_CONFIG.MYSQL.DATABASE}`);
    await connection.query('SELECT 1');
    await connection.end();

    console.log('MySQL数据库连接成功');

    dbImplementation = require('./db.mysql');
  } catch (error) {
    console.error('MySQL数据库初始化失败:', error.message);
    process.exit(1);
  }
}

// 启动初始化并保存 promise
const initPromise = initializeDatabase();

// Proxy 确保所有 DB 调用等待初始化完成
module.exports = new Proxy({}, {
  get: function(target, prop) {
    if (!dbImplementation) {
      return async function(...args) {
        await initPromise;
        if (!dbImplementation) {
          throw new Error('数据库实现尚未初始化完成');
        }
        const impl = dbImplementation[prop];
        if (typeof impl === 'function') {
          return impl.apply(dbImplementation, args);
        }
        return impl;
      };
    }
    return dbImplementation[prop];
  }
});
