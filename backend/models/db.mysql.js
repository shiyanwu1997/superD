// MySQL数据模型实现
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const { STORAGE_CONFIG } = require('../config');

// 创建数据库连接池
const pool = mysql.createPool({
  host: STORAGE_CONFIG.MYSQL.HOST,
  port: STORAGE_CONFIG.MYSQL.PORT,
  user: STORAGE_CONFIG.MYSQL.USER,
  password: STORAGE_CONFIG.MYSQL.PASSWORD,
  database: STORAGE_CONFIG.MYSQL.DATABASE,
  waitForConnections: true,
  connectionLimit: STORAGE_CONFIG.MYSQL.CONNECTION_LIMIT,
  queueLimit: 0
});

// 测试MySQL连接
const testConnection = async () => {
  const connection = await pool.getConnection();
  await connection.query('SELECT 1');
  connection.release();
};

// 获取所有角色
const getAllRoles = async () => {
  const [rows] = await pool.query('SELECT * FROM roles');
  return rows;
};

// 获取所有用户
const getAllUsers = async () => {
  const [rows] = await pool.query('SELECT * FROM users');
  return rows;
};

// 获取所有项目
const getAllProjects = async () => {
  const [rows] = await pool.query('SELECT * FROM projects');
  // 将每个项目的JSON字符串解析为对象
  return rows.map(project => {
    if (project.supervisorConfig) {
      try {
        // 检查是否已经是对象
        if (typeof project.supervisorConfig === 'string') {
          project.supervisorConfig = JSON.parse(project.supervisorConfig);
        }
      } catch (error) {
        console.error('解析supervisorConfig失败:', error + '\n');
        project.supervisorConfig = null;
      }
    }
    return project;
  });
};

// 获取所有程序（已废弃，现在从Supervisor动态获取）
const getAllPrograms = async () => {
  return [];
};

// 获取所有用户项目权限关联
const getAllUserProjectPermissions = async () => {
  const [rows] = await pool.query('SELECT * FROM user_project_permissions');
  return rows;
};

// 获取所有用户程序权限关联
const getAllUserProgramPermissions = async () => {
  const [rows] = await pool.query('SELECT * FROM user_program_permissions');
  return rows;
};

// 获取用户信息
async function getUserByUsername(username) {
  const [rows] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
  return rows.length > 0 ? rows[0] : null;
}

// 获取用户角色
async function getUserRole(userId) {
  const [userRows] = await pool.query('SELECT roleId FROM users WHERE id = ?', [userId]);
  if (userRows.length === 0) return null;
  
  const [roleRows] = await pool.query('SELECT * FROM roles WHERE id = ?', [userRows[0].roleId]);
  return roleRows.length > 0 ? roleRows[0] : null;
}

// 获取用户可访问的项目列表
async function getUserProjects(userId) {
  const [userRows] = await pool.query('SELECT * FROM users WHERE id = ?', [userId]);
  if (userRows.length === 0) return [];
  
  // admin用户默认拥有所有项目权限
  if (userRows[0].username === 'admin') {
    return getAllProjects();
  }
  
  // 获取普通用户有权限的项目
  const [permRows] = await pool.query('SELECT projectId FROM user_project_permissions WHERE userId = ?', [userId]);
  const projectIds = permRows.map(p => p.projectId);
  
  if (projectIds.length === 0) return [];
  
  const [projectRows] = await pool.query('SELECT * FROM projects WHERE id IN (?)', [projectIds]);
  // 将每个项目的JSON字符串解析为对象
  return projectRows.map(project => {
    if (project.supervisorConfig) {
      try {
        // 检查是否已经是对象
        if (typeof project.supervisorConfig === 'string') {
          project.supervisorConfig = JSON.parse(project.supervisorConfig);
        }
      } catch (error) {
        console.error('解析supervisorConfig失败:', error + '\n');
        project.supervisorConfig = null;
      }
    }
    return project;
  });
}

// 检查用户是否有项目权限
async function checkUserProjectPermission(userId, projectId) {
  const [userRows] = await pool.query('SELECT * FROM users WHERE id = ?', [userId]);
  if (userRows.length === 0) return false;
  
  // admin用户默认拥有所有项目权限
  if (userRows[0].username === 'admin') {
    return true;
  }
  
  // 检查普通用户是否有该项目的权限
  const [permRows] = await pool.query('SELECT * FROM user_project_permissions WHERE userId = ? AND projectId = ?', [userId, projectId]);
  return permRows.length > 0;
}

// 检查用户是否有程序权限
async function checkUserProgramPermission(userId, programId) {
  const [userRows] = await pool.query('SELECT * FROM users WHERE id = ?', [userId]);
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
    const [permRows] = await pool.query('SELECT * FROM user_project_permissions WHERE userId = ? AND projectId = ?', [userId, projectId]);
    return permRows.length > 0;
  } else {
    // 无效的程序ID格式
    return false;
  }
}

// 获取用户可访问的程序列表（已废弃，现在从Supervisor动态获取）
async function getUserPrograms(userId, projectId = null) {
  return [];
}

// 根据项目ID获取程序列表（已废弃，现在从Supervisor动态获取）
async function getProgramsByProjectId(projectId) {
  return [];
}

// 根据ID获取程序（已废弃，现在从Supervisor动态获取）
async function getProgramById(programId) {
  return null;
}

// 获取项目信息
async function getProjectById(projectId) {
  const [rows] = await pool.query('SELECT * FROM projects WHERE id = ?', [projectId]);
  if (rows.length > 0) {
    const project = rows[0];
    // 将JSON字符串解析为对象
    if (project.supervisorConfig) {
      try {
        // 检查是否已经是对象
        if (typeof project.supervisorConfig === 'string') {
          project.supervisorConfig = JSON.parse(project.supervisorConfig);
        }
      } catch (error) {
        console.error('解析supervisorConfig失败:', error + '\n');
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
  const [existingRows] = await pool.query('SELECT * FROM projects WHERE name = ?', [name]);
  if (existingRows.length > 0) {
    return null; // 项目名称已存在
  }
  
  // 生成新的项目ID
  const [maxIdRows] = await pool.query('SELECT MAX(id) as maxId FROM projects');
  const newId = maxIdRows[0].maxId ? maxIdRows[0].maxId + 1 : 1;
  
  // 加密密码
  const hashedPassword = await bcrypt.hash(password, 10);
  
  const supervisorConfigObj = {
    host,
    port,
    username,
    password: hashedPassword
  };
  
  const newProject = {
    id: newId,
    name,
    description,
    supervisorConfig: JSON.stringify(supervisorConfigObj)
  };
  
  await pool.query('INSERT INTO projects SET ?', newProject);
  
  // 返回解析后的项目数据
  return {
    ...newProject,
    supervisorConfig: supervisorConfigObj
  };
}

// 更新项目
async function updateProject(projectId, updatedData) {
  // 检查项目是否存在
  const [existingRows] = await pool.query('SELECT * FROM projects WHERE id = ?', [projectId]);
  if (existingRows.length === 0) {
    return null; // 项目不存在
  }
  
  // 检查项目名称是否已存在（排除当前项目）
  if (updatedData.name && updatedData.name !== existingRows[0].name) {
    const [nameRows] = await pool.query('SELECT * FROM projects WHERE id != ? AND name = ?', [projectId, updatedData.name]);
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
    const newConfig = {
      host: updatedData.host || currentConfig.host || '',
      port: updatedData.port || updatedData.port === 0 ? updatedData.port : currentConfig.port || 0,
      username: updatedData.username || currentConfig.username || '',
      password: updatedData.password || currentConfig.password || ''
    };
    
    // 如果更新了密码，需要加密
    if (updatedData.password) {
      newConfig.password = await bcrypt.hash(updatedData.password, 10);
    }
    
    updatedData.supervisorConfig = JSON.stringify(newConfig);
    
    // 删除扁平字段，避免重复
    delete updatedData.host;
    delete updatedData.port;
    delete updatedData.username;
    delete updatedData.password;
  }
  
  // 更新项目信息
  await pool.query('UPDATE projects SET ? WHERE id = ?', [updatedData, projectId]);
  
  // 返回更新后的项目
  const [updatedRows] = await pool.query('SELECT * FROM projects WHERE id = ?', [projectId]);
  return updatedRows[0];
}

// 删除项目
async function deleteProject(projectId) {
  // 检查项目是否存在
  const [existingRows] = await pool.query('SELECT * FROM projects WHERE id = ?', [projectId]);
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
    console.error('删除项目失败:', error + '\n');
    return false;
  } finally {
    connection.release();
  }
}

// 创建新用户
async function createUser(username, password, roleId = 2, createdBy = null) {
  // 检查用户名是否已存在
  const [existingRows] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
  if (existingRows.length > 0) {
    return null;
  }
  
  // 生成新用户ID
  const [maxIdRows] = await pool.query('SELECT MAX(id) as maxId FROM users');
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
  
  await pool.query('INSERT INTO users SET ?', newUser);
  return newUser;
}

// 删除用户
async function deleteUser(userId) {
  // 检查用户是否存在
  const [existingRows] = await pool.query('SELECT * FROM users WHERE id = ?', [userId]);
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
    console.error('删除用户失败:', error + '\n');
    return false;
  } finally {
    connection.release();
  }
}

// 更新用户角色
async function updateUserRole(userId, roleId) {
  // 检查用户是否存在
  const [existingRows] = await pool.query('SELECT * FROM users WHERE id = ?', [userId]);
  if (existingRows.length === 0) {
    return false;
  }
  
  // 不能修改admin用户的角色
  if (existingRows[0].username === 'admin') {
    return false;
  }
  
  // 获取admin用户的信息
  const [adminRows] = await pool.query('SELECT * FROM users WHERE username = ?', ['admin']);
  const adminId = adminRows.length > 0 ? adminRows[0].id : 1; // 默认admin ID为1
  
  // 如果用户从普通用户转换为管理员(roleId=2或roleId=1)，将createdBy设置为admin的ID
  const currentRole = existingRows[0].roleId;
  const isPromotingToAdmin = (currentRole === 3 && (roleId === 2 || roleId === 1));
  
  if (isPromotingToAdmin) {
    await pool.query('UPDATE users SET roleId = ?, createdBy = ? WHERE id = ?', [roleId, adminId, userId]);
  } else {
    await pool.query('UPDATE users SET roleId = ? WHERE id = ?', [roleId, userId]);
  }
  
  return true;
}

// 更新用户的上级管理员
async function updateUserCreatedBy(userId, createdBy) {
  // 检查用户是否存在
  const [existingRows] = await pool.query('SELECT * FROM users WHERE id = ?', [userId]);
  if (existingRows.length === 0) {
    return false;
  }
  
  // 不能修改admin用户的信息
  if (existingRows[0].username === 'admin') {
    return false;
  }
  
  await pool.query('UPDATE users SET createdBy = ? WHERE id = ?', [createdBy, userId]);
  return true;
}

// 为用户添加项目权限
async function addUserProjectPermission(userId, projectId) {
  // 检查用户是否为admin
  const [userRows] = await pool.query('SELECT * FROM users WHERE id = ?', [userId]);
  if (userRows.length > 0 && userRows[0].username === 'admin') {
    return true; // admin用户默认拥有所有权限，无需添加
  }
  
  // 检查权限是否已存在
  const [existingRows] = await pool.query('SELECT * FROM user_project_permissions WHERE userId = ? AND projectId = ?', [userId, projectId]);
  if (existingRows.length > 0) {
    return true; // 权限已存在，视为成功
  }
  
  await pool.query('INSERT INTO user_project_permissions (userId, projectId) VALUES (?, ?)', [userId, projectId]);
  return true;
}

// 移除用户的项目权限
async function removeUserProjectPermission(userId, projectId) {
  // 检查用户是否为admin
  const [userRows] = await pool.query('SELECT * FROM users WHERE id = ?', [userId]);
  if (userRows.length > 0 && userRows[0].username === 'admin') {
    return true; // admin用户默认拥有所有权限，不可移除
  }
  
  await pool.query('DELETE FROM user_project_permissions WHERE userId = ? AND projectId = ?', [userId, projectId]);
  return true;
}

// 为用户添加程序权限
async function addUserProgramPermission(userId, programId) {
  // 检查用户是否为admin
  const [userRows] = await pool.query('SELECT * FROM users WHERE id = ?', [userId]);
  if (userRows.length > 0 && userRows[0].username === 'admin') {
    return true; // admin用户默认拥有所有权限，无需添加
  }
  
  // 检查权限是否已存在
  const [existingRows] = await pool.query('SELECT * FROM user_program_permissions WHERE userId = ? AND programId = ?', [userId, programId]);
  if (existingRows.length > 0) {
    return true; // 权限已存在，视为成功
  }
  
  await pool.query('INSERT INTO user_program_permissions (userId, programId) VALUES (?, ?)', [userId, programId]);
  return true;
}

// 移除用户的程序权限
async function removeUserProgramPermission(userId, programId) {
  // 检查用户是否为admin
  const [userRows] = await pool.query('SELECT * FROM users WHERE id = ?', [userId]);
  if (userRows.length > 0 && userRows[0].username === 'admin') {
    return true; // admin用户默认拥有所有权限，不可移除
  }
  
  await pool.query('DELETE FROM user_program_permissions WHERE userId = ? AND programId = ?', [userId, programId]);
  return true;
}

// 根据ID获取用户
async function getUserById(userId) {
  const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [userId]);
  return rows.length > 0 ? rows[0] : null;
}

// 修改用户密码
async function updateUserPassword(userId, newPassword) {
  // 检查用户是否存在
  const [existingRows] = await pool.query('SELECT * FROM users WHERE id = ?', [userId]);
  if (existingRows.length === 0) {
    return false;
  }
  
  await pool.query('UPDATE users SET password = ? WHERE id = ?', [newPassword, userId]);
  return true;
}

module.exports = {
  getUserByUsername,
  getUserById,
  getUserRole,
  checkUserProgramPermission,
  checkUserProjectPermission,
  getUserPrograms,
  getUserProjects,
  getAllProjects,
  getAllPrograms,
  getProgramById,
  getProgramsByProjectId,
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
  addUserProgramPermission,
  removeUserProgramPermission,
  updateUserPassword,
  getAllUsers,
  getAllRoles,
  getAllUserProjectPermissions,
  getAllUserProgramPermissions
};