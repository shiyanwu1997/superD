// MySQL数据模型实现
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const { STORAGE_CONFIG } = require('../config');
// 导入Logger工具
const Logger = require('../utils/logger');
// 导入加密解密工具
const { encrypt, decrypt } = require('../utils/crypto');

// 创建数据库连接池
const pool = mysql.createPool({
  host: STORAGE_CONFIG.MYSQL.HOST,
  port: STORAGE_CONFIG.MYSQL.PORT,
  user: STORAGE_CONFIG.MYSQL.USER,
  password: STORAGE_CONFIG.MYSQL.PASSWORD,
  database: STORAGE_CONFIG.MYSQL.DATABASE,
  waitForConnections: true,
  connectionLimit: STORAGE_CONFIG.MYSQL.CONNECTION_LIMIT,
  queueLimit: 0,
  // 添加连接池事件监听
  idleTimeout: 60000, // 空闲连接超时时间（毫秒）
  enableKeepAlive: true,
  keepAliveInitialDelay: 30000 // 保持连接的初始延迟（毫秒）
});

// 监控连接池状态
pool.on('acquire', (connection) => {
  Logger.debug('数据库连接被获取', { threadId: connection.threadId });
});

pool.on('release', (connection) => {
  Logger.debug('数据库连接被释放', { threadId: connection.threadId });
});

pool.on('connection', (connection) => {
  Logger.debug('新的数据库连接被创建', { threadId: connection.threadId });
});

pool.on('enqueue', () => {
  Logger.debug('等待可用的数据库连接');
});

// 带日志的查询包装函数，支持连接重试
const queryWithLogs = async (sql, params = [], retryCount = 3, retryDelay = 50000) => {
  const start = Date.now();
  
  Logger.debug('数据库查询', { sql, params, retryCount });
  
  try {
    // 使用原始pool.query以避免递归调用
    const [rows] = await pool.query(sql, params);
    const duration = Date.now() - start;
    
    Logger.debug('数据库查询成功', { sql, duration, resultCount: rows.length });
    
    return [rows];
  } catch (error) {
    const duration = Date.now() - start;
    
    // 如果是连接错误且还有重试次数，进行重试
    if ((error.code === 'ECONNREFUSED' || error.code === 'PROTOCOL_CONNECTION_LOST' || error.code === 'ER_ACCESS_DENIED_ERROR') && retryCount > 0) {
      Logger.warn('数据库连接失败，将重试', { sql, duration, error: error.message, retryCount: retryCount - 1 });
      
      // 等待一段时间后重试
      await new Promise(resolve => setTimeout(resolve, retryDelay));
      
      // 递归重试
      return queryWithLogs(sql, params, retryCount - 1, retryDelay * 2);
    }
    
    Logger.error('数据库查询失败', { sql, duration, error: error.message, stack: error.stack });
    
    throw error;
  }
};

// 测试MySQL连接，支持重试
const testConnection = async (retryCount = 3, retryDelay = 1000) => {
  try {
    const connection = await pool.getConnection();
    await connection.query('SELECT 1');
    connection.release();
    Logger.debug('数据库连接测试成功');
    return true;
  } catch (error) {
    if (retryCount > 0) {
      Logger.warn('数据库连接测试失败，将重试', { error: error.message, retryCount: retryCount - 1 });
      await new Promise(resolve => setTimeout(resolve, retryDelay));
      return testConnection(retryCount - 1, retryDelay * 2);
    }
    Logger.error('数据库连接测试失败', { error: error.message });
    throw error;
  }
};

// 获取所有角色
const getAllRoles = async () => {
  const [rows] = await queryWithLogs('SELECT * FROM roles');
  return rows;
};

// 获取所有用户
const getAllUsers = async () => {
  const [rows] = await queryWithLogs('SELECT * FROM users');
  return rows;
};

// 获取所有项目
const getAllProjects = async () => {
  const [rows] = await queryWithLogs('SELECT * FROM projects');
  // 将每个项目的JSON字符串解析为对象
  return rows.map(project => {
    if (project.supervisorConfig) {
      try {
        // 检查是否已经是对象
        if (typeof project.supervisorConfig === 'string') {
          project.supervisorConfig = JSON.parse(project.supervisorConfig);
        }
        // 解密密码
        if (project.supervisorConfig.password) {
          project.supervisorConfig.password = decrypt(project.supervisorConfig.password);
        }
      } catch (error) {
        Logger.error('解析supervisorConfig失败:', { projectId: project.id, error: error.message });
        project.supervisorConfig = null;
      }
    }
    return project;
  });
}



// 获取所有用户项目权限关联
const getAllUserProjectPermissions = async () => {
  const [rows] = await queryWithLogs('SELECT * FROM user_project_permissions');
  return rows;
};

// 获取所有用户程序权限关联
const getAllUserProgramPermissions = async () => {
  const [rows] = await queryWithLogs('SELECT * FROM user_program_permissions');
  return rows;
};

// 获取用户信息
async function getUserByUsername(username) {
  const [rows] = await queryWithLogs('SELECT * FROM users WHERE username = ?', [username]);
  return rows.length > 0 ? rows[0] : null;
}



// 获取用户可访问的项目列表
async function getUserProjects(userId) {
  const [userRows] = await queryWithLogs('SELECT * FROM users WHERE id = ?', [userId]);
  if (userRows.length === 0) return [];
  
  // admin用户默认拥有所有项目权限
  if (userRows[0].username === 'admin') {
    return getAllProjects();
  }
  
  // 获取普通用户有权限的项目
  const [permRows] = await queryWithLogs('SELECT projectId FROM user_project_permissions WHERE userId = ?', [userId]);
  const projectIds = permRows.map(p => p.projectId);
  
  if (projectIds.length === 0) return [];
  
  const [projectRows] = await queryWithLogs('SELECT * FROM projects WHERE id IN (?)', [projectIds]);
  // 将每个项目的JSON字符串解析为对象
  return projectRows.map(project => {
    if (project.supervisorConfig) {
      try {
        // 检查是否已经是对象
        if (typeof project.supervisorConfig === 'string') {
          project.supervisorConfig = JSON.parse(project.supervisorConfig);
        }
        // 解密密码
        if (project.supervisorConfig.password) {
          project.supervisorConfig.password = decrypt(project.supervisorConfig.password);
        }
      } catch (error) {
        Logger.error('解析supervisorConfig失败:', { projectId: project.id, error: error.message });
        project.supervisorConfig = null;
      }
    }
    return project;
  });
}

// 检查用户是否有该项目的权限
async function checkUserProjectPermission(userId, projectId) {
  const [userRows] = await queryWithLogs('SELECT * FROM users WHERE id = ?', [userId]);
  if (userRows.length === 0) return false;
  
  // admin用户默认拥有所有项目权限
  if (userRows[0].username === 'admin') {
    return true;
  }
  
  // 获取普通用户的项目权限
  const [permRows] = await queryWithLogs('SELECT * FROM user_project_permissions WHERE userId = ? AND projectId = ?', [userId, projectId]);
  return permRows.length > 0;
}

// 检查用户是否有程序权限
async function checkUserProgramPermission(userId, programId) {
  const [userRows] = await queryWithLogs('SELECT * FROM users WHERE id = ?', [userId]);
  if (userRows.length === 0) return false;
  
  // admin用户默认拥有所有程序权限
  if (userRows[0].username === 'admin') {
    return true;
  }
  
  // 检查程序ID是否是动态生成的格式 (${projectId}-${programName})
  const idParts = programId.toString().split('-');
  if (idParts.length === 2) {
    // 动态生成的程序ID，只检查项目权限
    const projectId = parseInt(idParts[0]);
    if (isNaN(projectId)) return false;
    
    // 检查用户是否有该项目的权限
    const [permRows] = await queryWithLogs('SELECT * FROM user_project_permissions WHERE userId = ? AND projectId = ?', [userId, projectId]);
    return permRows.length > 0;
  } else {
    // 无效的程序ID格式
    return false;
  }
}



// 获取项目信息
async function getProjectById(projectId) {
  const [rows] = await queryWithLogs('SELECT * FROM projects WHERE id = ?', [projectId]);
  if (rows.length > 0) {
    const project = rows[0];
    // 将JSON字符串解析为对象
    if (project.supervisorConfig) {
      try {
        // 检查是否已经是对象
        if (typeof project.supervisorConfig === 'string') {
          project.supervisorConfig = JSON.parse(project.supervisorConfig);
        }
        // 解密密码
        if (project.supervisorConfig.password) {
          project.supervisorConfig.password = decrypt(project.supervisorConfig.password);
        }
      } catch (error) {
        Logger.error('解析supervisorConfig失败:', { projectId, error: error.message });
        project.supervisorConfig = null;
      }
    }
    return project;
  }
  return null;
}

// 创建新项目
async function createProject(name, description, host, port, username, password) {
  // 检查项目名称是否已存在
  const [existingRows] = await queryWithLogs('SELECT * FROM projects WHERE name = ?', [name]);
  if (existingRows.length > 0) {
    return null; // 项目名称已存在
  }
  
  // 生成新的项目ID
  const [maxIdRows] = await queryWithLogs('SELECT MAX(id) as maxId FROM projects');
  const newId = maxIdRows[0].maxId ? maxIdRows[0].maxId + 1 : 1;
  
  // 加密密码
  const encryptedPassword = encrypt(password);
  
  const supervisorConfigObj = {
    host,
    port,
    username,
    password: encryptedPassword
  };
  
  const newProject = {
    id: newId,
    name,
    description,
    supervisorConfig: JSON.stringify(supervisorConfigObj)
  };
  
  await queryWithLogs('INSERT INTO projects SET ?', newProject);
  
  // 返回解析后的项目数据（包含解密后的密码）
  return {
    ...newProject,
    supervisorConfig: {
      ...supervisorConfigObj,
      password: password
    }
  };
}

// 更新项目
async function updateProject(projectId, updatedData) {
  // 检查项目是否存在
  const [existingRows] = await queryWithLogs('SELECT * FROM projects WHERE id = ?', [projectId]);
  if (existingRows.length === 0) {
    return null; // 项目不存在
  }
  
  // 检查项目名称是否已存在（排除当前项目）
  if (updatedData.name && updatedData.name !== existingRows[0].name) {
    const [nameRows] = await queryWithLogs('SELECT * FROM projects WHERE id != ? AND name = ?', [projectId, updatedData.name]);
    if (nameRows.length > 0) {
      return null; // 项目名称已存在
    }
  }
  
  // 处理supervisorConfig字段
  if (updatedData.host || updatedData.port || updatedData.username || updatedData.password) {
    // 确保supervisorConfig对象存在
    let currentConfig;
    try {
      // 检查supervisorConfig是否已经是一个对象
      if (typeof existingRows[0].supervisorConfig === 'object') {
        currentConfig = existingRows[0].supervisorConfig;
      } else {
        currentConfig = JSON.parse(existingRows[0].supervisorConfig || '{}');
      }
    } catch (e) {
      // 如果解析失败，使用空对象
      currentConfig = {};
    }
    // 处理密码加密
    let password = updatedData.password || currentConfig.password || '';
    
    // 如果提供了新密码，或者当前密码未加密，则加密密码
    if (updatedData.password || !currentConfig.password) {
      password = encrypt(password);
    }
    
    const newConfig = {
      host: updatedData.host || currentConfig.host || '',
      port: updatedData.port || updatedData.port === 0 ? updatedData.port : currentConfig.port || 0,
      username: updatedData.username || currentConfig.username || '',
      password: password
    };
    
    updatedData.supervisorConfig = JSON.stringify(newConfig);
    
    // 删除扁平字段，避免重复
    delete updatedData.host;
    delete updatedData.port;
    delete updatedData.username;
    delete updatedData.password;
  }
  
  // 更新项目信息
  await queryWithLogs('UPDATE projects SET ? WHERE id = ?', [updatedData, projectId]);
  
  // 返回更新后的项目
  const [updatedRows] = await queryWithLogs('SELECT * FROM projects WHERE id = ?', [projectId]);
  return updatedRows[0];
}

// 删除项目
async function deleteProject(projectId) {
  // 检查项目是否存在
  const [existingRows] = await queryWithLogs('SELECT * FROM projects WHERE id = ?', [projectId]);
  if (existingRows.length === 0) {
    return false; // 项目不存在
  }
  
  // 开始事务
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    
    // 删除与该项目相关的用户程序权限
    await connection.query('DELETE FROM user_program_permissions WHERE programId LIKE ?', [`${projectId}-%`]);
    
    // 删除与该项目相关的用户项目权限
    await connection.query('DELETE FROM user_project_permissions WHERE projectId = ?', [projectId]);
    
    // 删除项目
    await connection.query('DELETE FROM projects WHERE id = ?', [projectId]);
    
    await connection.commit();
    return true;
  } catch (error) {
    await connection.rollback();
    Logger.error('删除项目失败:', { projectId, error: error.message });
    return false;
  } finally {
    connection.release();
  }
}

// 创建新用户
async function createUser(username, password, roleId = 2, createdBy = null) {
  // 检查用户名是否已存在
  const [existingRows] = await queryWithLogs('SELECT * FROM users WHERE username = ?', [username]);
  if (existingRows.length > 0) {
    return null;
  }
  
  // 生成新用户ID
  const [maxIdRows] = await queryWithLogs('SELECT MAX(id) as maxId FROM users');
  const newId = maxIdRows[0].maxId ? maxIdRows[0].maxId + 1 : 1;
  
  const newUser = {
    id: newId,
    username,
    password,
    roleId
  };
  
  // 只有当createdBy不为null时才添加到新用户对象中
  if (createdBy !== null) {
    newUser.createdBy = createdBy;
  }
  
  await queryWithLogs('INSERT INTO users SET ?', newUser);
  return newUser;
}

// 删除用户
async function deleteUser(userId) {
  // 检查用户是否存在
  const [existingRows] = await queryWithLogs('SELECT * FROM users WHERE id = ?', [userId]);
  if (existingRows.length === 0) {
    return false; // 用户不存在
  }
  
  // 不能删除admin用户
  if (existingRows[0].username === 'admin') {
    return false;
  }
  
  // 开始事务
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    
    // 删除用户的程序权限
    await connection.query('DELETE FROM user_program_permissions WHERE userId = ?', [userId]);
    
    // 删除用户的项目权限
    await connection.query('DELETE FROM user_project_permissions WHERE userId = ?', [userId]);
    
    // 删除用户
    await connection.query('DELETE FROM users WHERE id = ?', [userId]);
    
    await connection.commit();
    return true;
  } catch (error) {
    await connection.rollback();
    Logger.error('删除用户失败:', { userId, error: error.message });
    return false;
  } finally {
    connection.release();
  }
}

// 更新用户角色
async function updateUserRole(userId, roleId) {
  // 检查用户是否存在
  const [existingRows] = await queryWithLogs('SELECT * FROM users WHERE id = ?', [userId]);
  if (existingRows.length === 0) {
    return false;
  }
  
  // 不能修改admin用户的角色
  if (existingRows[0].username === 'admin') {
    return false;
  }
  
  // 获取admin用户的信息
  const [adminRows] = await queryWithLogs('SELECT * FROM users WHERE username = ?', ['admin']);
  const adminId = adminRows.length > 0 ? adminRows[0].id : 1; // 默认admin ID为1
  
  // 如果用户从普通用户转换为管理员(roleId=2或roleId=1)，将createdBy设置为admin的ID
  const currentRole = existingRows[0].roleId;
  const isPromotingToAdmin = (currentRole === 3 && (roleId === 2 || roleId === 1));
  
  if (isPromotingToAdmin) {
    await queryWithLogs('UPDATE users SET roleId = ?, createdBy = ? WHERE id = ?', [roleId, adminId, userId]);
  } else {
    await queryWithLogs('UPDATE users SET roleId = ? WHERE id = ?', [roleId, userId]);
  }
  
  return true;
}

// 更新用户的上级管理员
async function updateUserCreatedBy(userId, createdBy) {
  // 检查用户是否存在
  const [existingRows] = await queryWithLogs('SELECT * FROM users WHERE id = ?', [userId]);
  if (existingRows.length === 0) {
    return false;
  }
  
  // 不能修改admin用户的信息
  if (existingRows[0].username === 'admin') {
    return false;
  }
  
  await queryWithLogs('UPDATE users SET createdBy = ? WHERE id = ?', [createdBy, userId]);
  return true;
}

// 为用户添加项目权限
async function addUserProjectPermission(userId, projectId) {
  // 检查用户是否为admin
  const [userRows] = await queryWithLogs('SELECT * FROM users WHERE id = ?', [userId]);
  if (userRows.length > 0 && userRows[0].username === 'admin') {
    return true; // admin用户默认拥有所有权限，无需添加
  }
  
  // 检查权限是否已存在
  const [existingRows] = await queryWithLogs('SELECT * FROM user_project_permissions WHERE userId = ? AND projectId = ?', [userId, projectId]);
  if (existingRows.length > 0) {
    return true; // 权限已存在，视为成功
  }
  
  await queryWithLogs('INSERT INTO user_project_permissions (userId, projectId) VALUES (?, ?)', [userId, projectId]);
  return true;
}

// 移除用户的项目权限
async function removeUserProjectPermission(userId, projectId) {
  // 检查用户是否为admin
  const [userRows] = await queryWithLogs('SELECT * FROM users WHERE id = ?', [userId]);
  if (userRows.length > 0 && userRows[0].username === 'admin') {
    return true; // admin用户默认拥有所有权限，不可移除
  }
  
  await queryWithLogs('DELETE FROM user_project_permissions WHERE userId = ? AND projectId = ?', [userId, projectId]);
  return true;
}



// 根据ID获取用户
async function getUserById(userId) {
  const [rows] = await queryWithLogs('SELECT * FROM users WHERE id = ?', [userId]);
  return rows.length > 0 ? rows[0] : null;
}

// 修改用户密码
async function updateUserPassword(userId, newPassword) {
  // 检查用户是否存在
  const [existingRows] = await queryWithLogs('SELECT * FROM users WHERE id = ?', [userId]);
  if (existingRows.length === 0) {
    return false;
  }
  
  await queryWithLogs('UPDATE users SET password = ? WHERE id = ?', [newPassword, userId]);
  return true;
}

module.exports = {
  getUserByUsername,
  getUserById,
  checkUserProgramPermission,
  checkUserProjectPermission,
  getUserProjects,
  getAllProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject,
  createUser,
  testConnection,
  deleteUser,
  updateUserRole,
  updateUserCreatedBy,
  addUserProjectPermission,
  removeUserProjectPermission,
  updateUserPassword,
  getAllUsers,
  getAllRoles,
  getAllUserProjectPermissions
};