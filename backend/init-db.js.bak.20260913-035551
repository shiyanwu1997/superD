const { STORAGE_CONFIG } = require('./config');

// SQLite 数据库初始化
async function initSQLiteDatabase() {
  const Database = require('better-sqlite3');
  const path = require('path');
  const fs = require('fs');

  const dbPath = STORAGE_CONFIG.SQLITE.PATH || path.join(__dirname, 'data/supervisor.db');
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      createdAt TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      roleId INTEGER DEFAULT 2,
      createdBy INTEGER,
      createdAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (roleId) REFERENCES roles(id),
      FOREIGN KEY (createdBy) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS project_groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT DEFAULT '',
      createdAt TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      groupId INTEGER DEFAULT NULL,
      supervisorConfig TEXT NOT NULL,
      createdAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (groupId) REFERENCES project_groups(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS user_project_permissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      projectId INTEGER NOT NULL,
      createdAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE,
      UNIQUE(userId, projectId)
    );

    CREATE TABLE IF NOT EXISTS user_program_permissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      programId TEXT NOT NULL,
      createdAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(userId, programId)
    );

    CREATE TABLE IF NOT EXISTS api_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      name TEXT NOT NULL,
      tokenHash TEXT NOT NULL UNIQUE,
      scopes TEXT NOT NULL,
      expiresAt TEXT NOT NULL,
      lastUsedAt TEXT,
      revokedAt TEXT,
      createdAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_api_tokens_token_hash ON api_tokens(tokenHash);

    CREATE TABLE IF NOT EXISTS api_audit_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      apiTokenId INTEGER,
      userId INTEGER,
      method TEXT NOT NULL,
      path TEXT NOT NULL,
      statusCode INTEGER NOT NULL,
      durationMs INTEGER NOT NULL,
      ip TEXT,
      createdAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (apiTokenId) REFERENCES api_tokens(id) ON DELETE SET NULL,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE SET NULL
    );
    CREATE INDEX IF NOT EXISTS idx_api_audit_events_created_at ON api_audit_events(createdAt);
  `);

  // 插入初始角色
  const roleCount = db.prepare('SELECT COUNT(*) as count FROM roles').get();
  if (roleCount.count === 0) {
    const insertRole = db.prepare('INSERT INTO roles (id, name, description) VALUES (?, ?, ?)');
    const transaction = db.transaction(() => {
      insertRole.run(1, 'admin', '超级管理员角色，拥有所有权限');
      insertRole.run(2, 'subadmin', '普通管理员角色，可以创建普通用户');
      insertRole.run(3, 'user', '普通用户角色，拥有有限权限');
    });
    transaction();
  }

  db.close();
}

// MySQL 数据库初始化
async function initMySQLDatabase() {
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

  await connection.query(`
    CREATE TABLE IF NOT EXISTS roles (
      id INT PRIMARY KEY AUTO_INCREMENT,
      name VARCHAR(50) NOT NULL UNIQUE,
      description TEXT,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

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

  await connection.query(`
    CREATE TABLE IF NOT EXISTS project_groups (
      id INT PRIMARY KEY AUTO_INCREMENT,
      name VARCHAR(100) NOT NULL UNIQUE,
      description TEXT,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS projects (
      id INT PRIMARY KEY AUTO_INCREMENT,
      name VARCHAR(100) NOT NULL UNIQUE,
      description TEXT,
      groupId INT DEFAULT NULL,
      supervisorConfig JSON NOT NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (groupId) REFERENCES project_groups(id) ON DELETE SET NULL
    )
  `);

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

  await connection.query(`
    CREATE TABLE IF NOT EXISTS api_tokens (
      id INT PRIMARY KEY AUTO_INCREMENT,
      userId INT NOT NULL,
      name VARCHAR(100) NOT NULL,
      tokenHash VARCHAR(64) NOT NULL UNIQUE,
      scopes TEXT NOT NULL,
      expiresAt DATETIME NOT NULL,
      lastUsedAt DATETIME NULL,
      revokedAt DATETIME NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_api_tokens_token_hash (tokenHash)
    )
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS api_audit_events (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      apiTokenId INT NULL,
      userId INT NULL,
      method VARCHAR(10) NOT NULL,
      path VARCHAR(255) NOT NULL,
      statusCode SMALLINT NOT NULL,
      durationMs INT NOT NULL,
      ip VARCHAR(64) NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (apiTokenId) REFERENCES api_tokens(id) ON DELETE SET NULL,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE SET NULL,
      INDEX idx_api_audit_events_created_at (createdAt)
    )
  `);

  const [roleCount] = await connection.query('SELECT COUNT(*) AS count FROM roles');
  if (roleCount[0].count === 0) {
    await connection.query(`
      INSERT INTO roles (id, name, description) VALUES
      (1, 'admin', '超级管理员角色，拥有所有权限，只能有一个admin用户'),
      (2, 'subadmin', '普通管理员角色，可以创建普通用户'),
      (3, 'user', '普通用户角色，拥有有限权限')
    `);
  }

  await connection.end();
  console.log('MySQL数据库表初始化完成');
}

// 通用初始化入口
async function initDatabase() {
  if (STORAGE_CONFIG.TYPE === 'mysql') {
    await initMySQLDatabase();
  } else {
    await initSQLiteDatabase();
  }
}

if (require.main === module) {
  initDatabase().then(() => {
    console.log('数据库初始化完成');
    process.exit(0);
  }).catch(err => {
    console.error('数据库初始化失败:', err);
    process.exit(1);
  });
}

module.exports = { initDatabase, initSQLiteDatabase, initMySQLDatabase };
