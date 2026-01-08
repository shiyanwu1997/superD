// 从JSON文件读取数据的数据库服务
const fs = require('fs');
const path = require('path');
const { STORAGE_CONFIG } = require('../config');

// 数据文件路径
const DATA_DIR = path.join(__dirname, '../data');
const ROLES_FILE = path.join(DATA_DIR, 'roles.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const PROJECTS_FILE = path.join(DATA_DIR, 'projects.json');

const USER_PROJECT_PERMISSIONS_FILE = path.join(DATA_DIR, 'userProjectPermissions.json');
const USER_PROGRAM_PERMISSIONS_FILE = path.join(DATA_DIR, 'userProgramPermissions.json');

// 读取JSON文件的辅助函数
const readJsonFile = (filePath) => {
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`读取文件 ${filePath} 失败:`, error + '\n');
    return [];
  }
};

// 写入JSON文件的辅助函数
const writeJsonFile = (filePath, data) => {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error(`写入文件 ${filePath} 失败:`, error + '\n');
    return false;
  }
};

// 获取所有角色
const getAllRoles = () => {
  return readJsonFile(ROLES_FILE);
};

// 获取所有用户
const getAllUsers = () => {
  return readJsonFile(USERS_FILE);
};

// 获取所有项目
const getAllProjects = () => {
  return readJsonFile(PROJECTS_FILE);
};

// 获取所有程序（已废弃，现在从Supervisor动态获取）
const getAllPrograms = () => {
  return [];
};

// 获取所有用户项目权限关联
const getAllUserProjectPermissions = () => {
  return readJsonFile(USER_PROJECT_PERMISSIONS_FILE);
};

// 获取所有用户程序权限关联
const getAllUserProgramPermissions = () => {
  return readJsonFile(USER_PROGRAM_PERMISSIONS_FILE);
};

// 获取用户信息
async function getUserByUsername(username) {
  const users = getAllUsers();
  return users.find(user => user.username === username);
}

// 获取用户角色
function getUserRole(userId) {
  const users = getAllUsers();
  const roles = getAllRoles();
  const user = users.find(u => u.id === userId);
  if (!user) return null;
  return roles.find(role => role.id === user.roleId);
}

// 获取用户可访问的项目列表
function getUserProjects(userId) {
  const users = getAllUsers();
  const projects = getAllProjects();
  const userProjectPermissions = getAllUserProjectPermissions();
  
  const user = users.find(u => u.id === userId);
  if (!user) return [];
  
  // admin用户默认拥有所有项目权限
  if (user.username === 'admin') {
    return projects;
  }
  
  // 获取普通用户有权限的项目
  const projectIds = userProjectPermissions
    .filter(p => p.userId === userId)
    .map(p => p.projectId);
  
  return projects.filter(project => projectIds.includes(project.id));
}

// 检查用户是否有项目权限
async function checkUserProjectPermission(userId, projectId) {
  const users = getAllUsers();
  const userProjectPermissions = getAllUserProjectPermissions();
  
  const user = users.find(u => u.id === userId);
  if (!user) return false;
  
  // admin用户默认拥有所有项目权限
  if (user.username === 'admin') {
    return true;
  }
  
  // 检查普通用户是否有该项目的权限
  return userProjectPermissions.some(p => p.userId === userId && p.projectId === projectId);
}

// 检查用户是否有程序权限
async function checkUserProgramPermission(userId, programId) {
  const users = getAllUsers();
  const userProjectPermissions = getAllUserProjectPermissions();
  
  const user = users.find(u => u.id === userId);
  if (!user) return false;
  
  // 检查程序ID是否是动态生成的格式 (${projectId}-${programName})
  const idParts = programId.toString().split('-');
  if (idParts.length === 2) {
    // 动态生成的程序ID，只检查项目权限
    const projectId = parseInt(idParts[0]);
    if (isNaN(projectId)) return false;
    
    // 检查用户是否有该项目的权限（包括管理员）
    return userProjectPermissions.some(p => p.userId === userId && p.projectId === projectId);
  } else {
    // 无效的程序ID格式
    return false;
  }
}

// 获取用户可访问的程序列表（已废弃，现在从Supervisor动态获取）
function getUserPrograms(userId, projectId = null) {
  return [];
}

// 根据项目ID获取程序列表（已废弃，现在从Supervisor动态获取）
function getProgramsByProjectId(projectId) {
  return [];
}

// 根据ID获取程序（已废弃，现在从Supervisor动态获取）
function getProgramById(programId) {
  return null;
}

// 获取项目信息
function getProjectById(projectId) {
  const projects = getAllProjects();
  return projects.find(project => project.id === projectId);
}

// 创建新项目
function createProject(name, description, host, port, username, password) {
  const projects = getAllProjects();
  
  // 检查项目名称是否已存在
  if (projects.some(project => project.name === name)) {
    return null; // 项目名称已存在
  }
  
  // 生成新的项目ID
  const newId = projects.length > 0 ? Math.max(...projects.map(project => project.id)) + 1 : 1;
  
  const newProject = {
    id: newId,
    name,
    description,
    supervisorConfig: {
      host,
      port,
      username,
      password
    }
  };
  
  projects.push(newProject);
  
  // 写入文件
  if (writeJsonFile(PROJECTS_FILE, projects)) {
    return newProject;
  }
  
  return null;
}

// 更新项目
function updateProject(projectId, updatedData) {
  const projects = getAllProjects();
  const projectIndex = projects.findIndex(project => project.id === projectId);
  
  if (projectIndex === -1) {
    return null; // 项目不存在
  }
  
  // 检查项目名称是否已存在（排除当前项目）
  if (updatedData.name && updatedData.name !== projects[projectIndex].name) {
    if (projects.some(project => project.id !== projectId && project.name === updatedData.name)) {
      return null; // 项目名称已存在
    }
  }
  
  // 更新项目信息
  const updatedProject = {
    ...projects[projectIndex]
  };
  
  // 处理supervisorConfig字段
  if (updatedData.host || updatedData.port || updatedData.username || updatedData.password) {
    // 确保supervisorConfig对象存在
    updatedProject.supervisorConfig = {
      ...updatedProject.supervisorConfig,
      host: updatedData.host || updatedProject.supervisorConfig?.host || '',
      port: updatedData.port || updatedData.port === 0 ? updatedData.port : updatedProject.supervisorConfig?.port || 0,
      username: updatedData.username || updatedProject.supervisorConfig?.username || '',
      password: updatedData.password || updatedProject.supervisorConfig?.password || ''
    };
    
    // 删除扁平字段，避免重复
    delete updatedData.host;
    delete updatedData.port;
    delete updatedData.username;
    delete updatedData.password;
  }
  
  // 更新其他字段
  Object.assign(updatedProject, updatedData);
  
  projects[projectIndex] = updatedProject;
  
  // 写入文件
  if (writeJsonFile(PROJECTS_FILE, projects)) {
    return updatedProject;
  }
  
  return null;
}

// 删除项目
function deleteProject(projectId) {
  let projects = getAllProjects();
  const projectIndex = projects.findIndex(project => project.id === projectId);
  
  if (projectIndex === -1) {
    return false; // 项目不存在
  }
  
  // 删除项目
  projects = projects.filter(project => project.id !== projectId);
  
  // 删除与该项目相关的用户权限
  let userProjectPermissions = getAllUserProjectPermissions();
  userProjectPermissions = userProjectPermissions.filter(perm => perm.projectId !== projectId);
  writeJsonFile(USER_PROJECT_PERMISSIONS_FILE, userProjectPermissions);
  
  // 删除与该项目相关的用户程序权限
  let userProgramPermissions = getAllUserProgramPermissions();
  // 由于程序ID是动态生成的格式为${projectId}-${programName}，我们需要过滤掉该项目的所有程序权限
  userProgramPermissions = userProgramPermissions.filter(perm => !perm.programId.toString().startsWith(`${projectId}-`));
  writeJsonFile(USER_PROGRAM_PERMISSIONS_FILE, userProgramPermissions);
  
  return writeJsonFile(PROJECTS_FILE, projects);
}

// 创建新用户
function createUser(username, password, roleId = 2) {
  const users = getAllUsers();
  
  // 检查用户名是否已存在
  if (users.some(user => user.username === username)) {
    return null;
  }
  
  // 生成新用户ID
  const newId = users.length > 0 ? Math.max(...users.map(user => user.id)) + 1 : 1;
  
  const newUser = {
    id: newId,
    username,
    password,
    roleId
  };
  
  users.push(newUser);
  
  if (writeJsonFile(USERS_FILE, users)) {
    return newUser;
  }
  
  return null;
}

// 删除用户
function deleteUser(userId) {
  let users = getAllUsers();
  
  // 检查用户是否存在
  const userIndex = users.findIndex(user => user.id === userId);
  if (userIndex === -1) {
    return false; // 用户不存在
  }
  
  // 不能删除admin用户
  if (users[userIndex].username === 'admin') {
    return false;
  }
  
  // 删除用户
  users = users.filter(user => user.id !== userId);
  
  // 删除用户的项目权限
  let userProjectPermissions = getAllUserProjectPermissions();
  userProjectPermissions = userProjectPermissions.filter(perm => perm.userId !== userId);
  writeJsonFile(USER_PROJECT_PERMISSIONS_FILE, userProjectPermissions);
  
  // 删除用户的程序权限
  let userProgramPermissions = getAllUserProgramPermissions();
  userProgramPermissions = userProgramPermissions.filter(perm => perm.userId !== userId);
  writeJsonFile(USER_PROGRAM_PERMISSIONS_FILE, userProgramPermissions);
  
  return writeJsonFile(USERS_FILE, users);
}

// 更新用户角色
function updateUserRole(userId, roleId) {
  const users = getAllUsers();
  const userIndex = users.findIndex(user => user.id === userId);
  
  if (userIndex === -1) {
    return false;
  }
  
  // 不能修改admin用户的角色
  if (users[userIndex].username === 'admin') {
    return false;
  }
  
  users[userIndex].roleId = roleId;
  return writeJsonFile(USERS_FILE, users);
}

// 为用户添加项目权限
function addUserProjectPermission(userId, projectId) {
  // 检查用户是否为admin
  const user = getAllUsers().find(u => u.id === userId);
  if (user && user.username === 'admin') {
    return true; // admin用户默认拥有所有权限，无需添加
  }
  
  const userProjectPermissions = getAllUserProjectPermissions();
  
  // 检查权限是否已存在
  if (userProjectPermissions.some(perm => perm.userId === userId && perm.projectId === projectId)) {
    return true; // 权限已存在，视为成功
  }
  
  userProjectPermissions.push({
    userId,
    projectId
  });
  
  return writeJsonFile(USER_PROJECT_PERMISSIONS_FILE, userProjectPermissions);
}

// 移除用户的项目权限
function removeUserProjectPermission(userId, projectId) {
  // 检查用户是否为admin
  const user = getAllUsers().find(u => u.id === userId);
  if (user && user.username === 'admin') {
    return true; // admin用户默认拥有所有权限，不可移除
  }
  
  let userProjectPermissions = getAllUserProjectPermissions();
  
  const initialLength = userProjectPermissions.length;
  userProjectPermissions = userProjectPermissions.filter(perm => !(perm.userId === userId && perm.projectId === projectId));
  
  // 如果没有变化，返回true
  if (userProjectPermissions.length === initialLength) {
    return true;
  }
  
  return writeJsonFile(USER_PROJECT_PERMISSIONS_FILE, userProjectPermissions);
}

// 为用户添加程序权限
function addUserProgramPermission(userId, programId) {
  const userProgramPermissions = getAllUserProgramPermissions();
  
  // 检查权限是否已存在
  if (userProgramPermissions.some(perm => perm.userId === userId && perm.programId === programId)) {
    return true; // 权限已存在，视为成功
  }
  
  userProgramPermissions.push({
    userId,
    programId
  });
  
  return writeJsonFile(USER_PROGRAM_PERMISSIONS_FILE, userProgramPermissions);
}

// 移除用户的程序权限
function removeUserProgramPermission(userId, programId) {
  let userProgramPermissions = getAllUserProgramPermissions();
  
  const initialLength = userProgramPermissions.length;
  userProgramPermissions = userProgramPermissions.filter(perm => !(perm.userId === userId && perm.programId === programId));
  
  // 如果没有变化，返回true
  if (userProgramPermissions.length === initialLength) {
    return true;
  }
  
  return writeJsonFile(USER_PROGRAM_PERMISSIONS_FILE, userProgramPermissions);
}

// 根据ID获取用户
function getUserById(userId) {
  const users = getAllUsers();
  return users.find(user => user.id === userId);
}

// 修改用户密码
function updateUserPassword(userId, newPassword) {
  const users = getAllUsers();
  const userIndex = users.findIndex(user => user.id === userId);
  
  if (userIndex === -1) {
    return false;
  }
  
  users[userIndex].password = newPassword; // 假设newPassword已通过bcrypt加密
  return writeJsonFile(USERS_FILE, users);
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
  deleteUser,
  updateUserRole,
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
