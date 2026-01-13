const mysql = require('mysql2/promise');
const config = require('./config.js');

async function fixDatabase() {
  try {
    console.log('正在连接数据库...');
    const pool = mysql.createPool({
      host: config.STORAGE_CONFIG.MYSQL.HOST,
      port: config.STORAGE_CONFIG.MYSQL.PORT,
      user: config.STORAGE_CONFIG.MYSQL.USER,
      password: config.STORAGE_CONFIG.MYSQL.PASSWORD,
      database: config.STORAGE_CONFIG.MYSQL.DATABASE,
      connectionLimit: config.STORAGE_CONFIG.MYSQL.CONNECTION_LIMIT
    });

    // 测试连接
    const connection = await pool.getConnection();
    console.log('数据库连接成功！');

    // 检查并添加createdBy字段
    console.log('检查users表结构...');
    const [columns] = await connection.execute(
      'SHOW COLUMNS FROM users'
    );

    const hasCreatedBy = columns.some(col => col.Field === 'createdBy');
    if (!hasCreatedBy) {
      console.log('添加createdBy字段到users表...');
      await connection.execute(
        'ALTER TABLE users ADD COLUMN createdBy INT AFTER roleId'
      );
      console.log('createdBy字段添加成功！');
    } else {
      console.log('createdBy字段已存在！');
    }

    // 检查并添加外键约束
    console.log('检查外键约束...');
    const [constraints] = await connection.execute(
      'SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_NAME = "users" AND COLUMN_NAME = "createdBy" AND CONSTRAINT_NAME != "PRIMARY"'
    );

    if (constraints.length === 0) {
      console.log('添加外键约束...');
      await connection.execute(
        'ALTER TABLE users ADD CONSTRAINT fk_users_created_by FOREIGN KEY (createdBy) REFERENCES users(id) ON DELETE SET NULL'
      );
      console.log('外键约束添加成功！');
    } else {
      console.log('外键约束已存在！');
    }

    // 确保admin用户的createdBy为null或自己
    console.log('更新admin用户的createdBy字段...');
    await connection.execute(
      'UPDATE users SET createdBy = NULL WHERE username = "admin"'
    );
    console.log('admin用户更新成功！');

    connection.release();
    await pool.end();
    console.log('所有操作完成！');
  } catch (error) {
    console.error('操作失败:', error.message);
  }
}

fixDatabase();
