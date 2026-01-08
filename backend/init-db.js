// MySQL数据库初始化脚本
// 用于首次启动时自动创建数据库和表结构
const mysql = require('mysql2/promise');
const { STORAGE_CONFIG } = require('./config');

// 数据库初始化函数
async function initDatabase() {
  // 如果不是MySQL存储类型，直接返回
  if (STORAGE_CONFIG.TYPE !== 'mysql') {
    console.log('不是MySQL存储类型，跳过数据库初始化\n');
    return;
  }

  try {
    // 连接到MySQL服务器（不指定数据库）
    const connection = await mysql.createConnection({
      host: STORAGE_CONFIG.MYSQL.HOST,
      port: STORAGE_CONFIG.MYSQL.PORT,
      user: STORAGE_CONFIG.MYSQL.USER,
      password: STORAGE_CONFIG.MYSQL.PASSWORD,
      multipleStatements: true // 允许执行多条SQL语句
    });

    console.log('成功连接到MySQL服务器\n');

    // 检查数据库是否存在，如果不存在则创建
    await connection.query(`CREATE DATABASE IF NOT EXISTS ${STORAGE_CONFIG.MYSQL.DATABASE} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    console.log(`数据库 ${STORAGE_CONFIG.MYSQL.DATABASE} 检查/创建完成\n`);

    // 选择数据库
    await connection.query(`USE ${STORAGE_CONFIG.MYSQL.DATABASE}`);

    // 创建角色表
    await connection.query(`
      CREATE TABLE IF NOT EXISTS roles (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(50) NOT NULL UNIQUE,
        description TEXT,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('角色表检查/创建完成\n');

    // 创建用户表
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT PRIMARY KEY AUTO_INCREMENT,
        username VARCHAR(50) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        roleId INT DEFAULT 2,
        createdBy INT,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (roleId) REFERENCES roles(id),
        FOREIGN KEY (createdBy) REFERENCES users(id) ON DELETE SET NULL
      )
    `);
    console.log('用户表检查/创建完成\n');

    // 创建项目表
    await connection.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(100) NOT NULL UNIQUE,
        description TEXT,
        supervisorConfig JSON NOT NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('项目表检查/创建完成\n');

    // 创建用户项目权限表
    await connection.query(`
      CREATE TABLE IF NOT EXISTS user_project_permissions (
        id INT PRIMARY KEY AUTO_INCREMENT,
        userId INT NOT NULL,
        projectId INT NOT NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE,
        UNIQUE KEY unique_user_project (userId, projectId)
      )
    `);
    console.log('用户项目权限表检查/创建完成\n');

    // 创建用户程序权限表
    await connection.query(`
      CREATE TABLE IF NOT EXISTS user_program_permissions (
        id INT PRIMARY KEY AUTO_INCREMENT,
        userId INT NOT NULL,
        programId VARCHAR(100) NOT NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE KEY unique_user_program (userId, programId)
      )
    `);
    console.log('用户程序权限表检查/创建完成\n');

    // 检查是否需要插入初始数据
    const [roleCount] = await connection.query('SELECT COUNT(*) AS count FROM roles');
    if (roleCount[0].count === 0) {
      // 插入初始角色
      await connection.query(`
        INSERT INTO roles (id, name, description) VALUES
        (1, 'admin', '管理员角色，拥有所有权限'),
        (2, 'user', '普通用户角色，拥有有限权限')
      `);
      console.log('初始角色数据插入完成\n');
    }

    // 注意：管理员用户将由app.js中的generateDefaultAdmin函数创建
    // 这里不再创建固定密码的管理员用户

    // 关闭连接
    await connection.end();
    console.log('数据库初始化完成\n');

  } catch (error) {
    console.error('数据库初始化失败:', error + '\n');
    process.exit(1);
  }
}

// 如果直接运行此脚本，则执行初始化
if (require.main === module) {
  initDatabase();
}

module.exports = { initDatabase };
