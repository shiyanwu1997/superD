const Database = require('better-sqlite3');
const path = require('path');
const { STORAGE_CONFIG } = require('../config');
const { encrypt, decrypt } = require('../utils/crypto');
const Logger = require('../utils/logger');

const dbPath = STORAGE_CONFIG.SQLITE.PATH || path.join(__dirname, '../data/supervisor.db');

// 确保父目录存在
const fs = require('fs');
const dir = path.dirname(dbPath);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ==================== 角色操作 ====================

const getAllRoles = async () => {
  return db.prepare('SELECT * FROM roles').all();
};

// ==================== 用户操作 ====================

const getAllUsers = async () => {
  return db.prepare('SELECT * FROM users').all();
};

const getUserByUsername = async (username) => {
  return db.prepare('SELECT * FROM users WHERE username = ?').get(username) || null;
};

const getUserById = async (userId) => {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(userId) || null;
};

const createUser = async (username, password, roleId = 2, createdBy = null) => {
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) return null;

  const stmt = db.prepare('INSERT INTO users (username, password, roleId, createdBy) VALUES (?, ?, ?, ?)');
  const result = stmt.run(username, password, roleId, createdBy || null);
  return { id: result.lastInsertRowid, username, password, roleId, createdBy };
};

const deleteUser = async (userId) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user || user.username === 'admin') return false;

  const deletePerms = db.prepare('DELETE FROM user_project_permissions WHERE userId = ?');
  const deleteUserStmt = db.prepare('DELETE FROM users WHERE id = ?');

  const transaction = db.transaction(() => {
    deletePerms.run(userId);
    deleteUserStmt.run(userId);
  });
  transaction();
  return true;
};

const updateUserRole = async (userId, roleId) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user || user.username === 'admin') return false;
  db.prepare('UPDATE users SET roleId = ? WHERE id = ?').run(roleId, userId);
  return true;
};

const updateUserCreatedBy = async (userId, createdBy) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user || user.username === 'admin') return false;
  db.prepare('UPDATE users SET createdBy = ? WHERE id = ?').run(createdBy, userId);
  return true;
};

const updateUserPassword = async (userId, newPassword) => {
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
  if (!user) return false;
  db.prepare('UPDATE users SET password = ? WHERE id = ?').run(newPassword, userId);
  return true;
};

// ==================== 项目操作 ====================

const getAllProjects = async () => {
  const rows = db.prepare('SELECT * FROM projects').all();
  return rows.map(parseProjectConfig);
};

const getProjectById = async (projectId) => {
  const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
  return row ? parseProjectConfig(row) : null;
};

const getUserProjects = async (userId) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) return [];
  if (user.username === 'admin') return getAllProjects();

  const projectPerms = db.prepare('SELECT projectId FROM user_project_permissions WHERE userId = ?').all(userId);
  const projectIds = new Set(projectPerms.map(p => p.projectId));

  // 程序权限也隐含项目可见性
  const progPerms = db.prepare('SELECT programId FROM user_program_permissions WHERE userId = ?').all(userId);
  for (const p of progPerms) {
    const pid = parseInt(p.programId.split('-')[0]);
    if (!isNaN(pid)) projectIds.add(pid);
  }

  if (projectIds.size === 0) return [];

  const ids = [...projectIds];
  const placeholders = ids.map(() => '?').join(',');
  const rows = db.prepare(`SELECT * FROM projects WHERE id IN (${placeholders})`).all(...ids);
  return rows.map(parseProjectConfig);
};

function parseProjectConfig(project) {
  if (project.supervisorConfig) {
    try {
      const config = typeof project.supervisorConfig === 'string'
        ? JSON.parse(project.supervisorConfig)
        : project.supervisorConfig;
      if (config.password) {
        config.password = decrypt(config.password);
      }
      project.supervisorConfig = config;
    } catch (error) {
      Logger.error('解析supervisorConfig失败:', { projectId: project.id, error: error.message });
      project.supervisorConfig = null;
    }
  }
  return project;
}

const createProject = async (name, description, host, port, username, password) => {
  const existing = db.prepare('SELECT id FROM projects WHERE name = ?').get(name);
  if (existing) return null;

  const encryptedPassword = encrypt(password || '');
  const supervisorConfigObj = { host, port, username, password: encryptedPassword };

  const stmt = db.prepare('INSERT INTO projects (name, description, supervisorConfig) VALUES (?, ?, ?)');
  const result = stmt.run(name, description || '', JSON.stringify(supervisorConfigObj));

  return {
    id: result.lastInsertRowid,
    name,
    description,
    supervisorConfig: { ...supervisorConfigObj, password: password || '' }
  };
};

const updateProject = async (projectId, updatedData) => {
  const existing = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
  if (!existing) return null;

  if (updatedData.name && updatedData.name !== existing.name) {
    const dup = db.prepare('SELECT id FROM projects WHERE id != ? AND name = ?').get(projectId, updatedData.name);
    if (dup) return null;
  }

  if (updatedData.host || updatedData.port !== undefined || updatedData.username || updatedData.password) {
    let currentConfig;
    try {
      currentConfig = typeof existing.supervisorConfig === 'object'
        ? existing.supervisorConfig
        : JSON.parse(existing.supervisorConfig || '{}');
    } catch (e) {
      currentConfig = {};
    }

    let password = updatedData.password || currentConfig.password || '';
    if (updatedData.password || !currentConfig.password) {
      password = encrypt(password);
    }

    const newConfig = {
      host: updatedData.host || currentConfig.host || '',
      port: updatedData.port !== undefined ? updatedData.port : currentConfig.port || 0,
      username: updatedData.username !== undefined ? updatedData.username : currentConfig.username || '',
      password: password
    };

    db.prepare('UPDATE projects SET name = ?, description = ?, supervisorConfig = ? WHERE id = ?')
      .run(updatedData.name || existing.name, updatedData.description !== undefined ? updatedData.description : existing.description, JSON.stringify(newConfig), projectId);
  } else {
    db.prepare('UPDATE projects SET name = ?, description = ? WHERE id = ?')
      .run(updatedData.name || existing.name, updatedData.description !== undefined ? updatedData.description : existing.description, projectId);
  }

  return db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
};

const deleteProject = async (projectId) => {
  const existing = db.prepare('SELECT id FROM projects WHERE id = ?').get(projectId);
  if (!existing) return false;

  const transaction = db.transaction(() => {
    db.prepare('DELETE FROM user_project_permissions WHERE projectId = ?').run(projectId);
    db.prepare('DELETE FROM projects WHERE id = ?').run(projectId);
  });
  transaction();
  return true;
};

// ==================== 权限操作 ====================

const getAllUserProjectPermissions = async () => {
  return db.prepare('SELECT * FROM user_project_permissions').all();
};

const checkUserProjectPermission = async (userId, projectId) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) return false;
  if (user.username === 'admin') return true;

  const perm = db.prepare('SELECT * FROM user_project_permissions WHERE userId = ? AND projectId = ?').get(userId, projectId);
  return !!perm;
};

const checkUserProgramPermission = async (userId, programId) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) return false;
  if (user.username === 'admin') return true;

  const idParts = programId.toString().split('-');
  if (idParts.length >= 2) {
    const projectId = parseInt(idParts[0]);
    if (isNaN(projectId)) return false;
    return checkUserProjectPermission(userId, projectId);
  }
  return false;
};

const addUserProjectPermission = async (userId, projectId) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (user && user.username === 'admin') return true;

  const existing = db.prepare('SELECT * FROM user_project_permissions WHERE userId = ? AND projectId = ?').get(userId, projectId);
  if (existing) return true;

  db.prepare('INSERT INTO user_project_permissions (userId, projectId) VALUES (?, ?)').run(userId, projectId);
  return true;
};

const removeUserProjectPermission = async (userId, projectId) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (user && user.username === 'admin') return true;

  db.prepare('DELETE FROM user_project_permissions WHERE userId = ? AND projectId = ?').run(userId, projectId);
  return true;
};

const testConnection = async () => {
  db.prepare('SELECT 1').get();
  return true;
};

// ==================== 程序级权限（细粒度控制） ====================

const getUserProgramPermissions = async (userId) => {
  return db.prepare('SELECT * FROM user_program_permissions WHERE userId = ?').all(userId);
};

const addUserProgramPermission = async (userId, programId) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (user && user.username === 'admin') return true;

  const existing = db.prepare('SELECT * FROM user_program_permissions WHERE userId = ? AND programId = ?').get(userId, programId);
  if (existing) return true;

  db.prepare('INSERT INTO user_program_permissions (userId, programId) VALUES (?, ?)').run(userId, programId);
  return true;
};

const removeUserProgramPermission = async (userId, programId) => {
  db.prepare('DELETE FROM user_program_permissions WHERE userId = ? AND programId = ?').run(userId, programId);
  return true;
};

// 检查用户是否有程序操作权限（程序级优先，项目级兜底）
const checkUserSpecificProgramPermission = async (userId, programId) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) return false;
  if (user.username === 'admin') return true;

  // 先检查是否有该程序的显式权限
  const programPerm = db.prepare('SELECT * FROM user_program_permissions WHERE userId = ? AND programId = ?').get(userId, programId);
  if (programPerm) return true;

  // 再检查是否有该程序所属项目的权限
  const idParts = programId.toString().split('-');
  if (idParts.length >= 2) {
    const projectId = parseInt(idParts[0]);
    if (!isNaN(projectId)) {
      return checkUserProjectPermission(userId, projectId);
    }
  }

  return false;
};

// ==================== 项目分组 ====================

const getAllGroups = async () => {
  return db.prepare('SELECT * FROM project_groups ORDER BY id').all();
};

const createGroup = async (name, description = '') => {
  const existing = db.prepare('SELECT id FROM project_groups WHERE name = ?').get(name);
  if (existing) return null;
  const result = db.prepare('INSERT INTO project_groups (name, description) VALUES (?, ?)').run(name, description);
  return { id: result.lastInsertRowid, name, description };
};

const updateGroup = async (groupId, data) => {
  db.prepare('UPDATE project_groups SET name = COALESCE(?, name), description = COALESCE(?, description) WHERE id = ?').run(data.name || null, data.description !== undefined ? data.description : null, groupId);
  return db.prepare('SELECT * FROM project_groups WHERE id = ?').get(groupId);
};

const deleteGroup = async (groupId) => {
  db.prepare('UPDATE projects SET groupId = NULL WHERE groupId = ?').run(groupId);
  db.prepare('DELETE FROM project_groups WHERE id = ?').run(groupId);
  return true;
};

const getProjectsByGroup = async (groupId) => {
  const rows = db.prepare('SELECT * FROM projects WHERE groupId = ?').all(groupId);
  return rows.map(parseProjectConfig);
};

const setProjectGroup = async (projectId, groupId) => {
  if (groupId === null || groupId === undefined) {
    db.prepare('UPDATE projects SET groupId = NULL WHERE id = ?').run(projectId);
  } else {
    db.prepare('UPDATE projects SET groupId = ? WHERE id = ?').run(groupId, projectId);
  }
  return true;
};

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
  getAllUserProjectPermissions,
  getUserProgramPermissions,
  addUserProgramPermission,
  removeUserProgramPermission,
  checkUserSpecificProgramPermission,
  getAllGroups,
  createGroup,
  updateGroup,
  deleteGroup,
  getProjectsByGroup,
  setProjectGroup
};
