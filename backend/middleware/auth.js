const jwt = require('jsonwebtoken');
const db = require('../models/db');
const { SERVER_CONFIG } = require('../config');

// 生成JWT令牌
function generateToken(user) {
  return jwt.sign(
    { userId: user.id, username: user.username, roleId: user.roleId },
    SERVER_CONFIG.JWT_SECRET, // 使用配置文件中的密钥
    { expiresIn: '1h' }
  );
}

// 验证JWT令牌
function verifyToken(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1] || req.session.token;
  
  if (!token) {
    return res.status(401).json({ message: '未授权访问' });
  }
  
  try {
    const decoded = jwt.verify(token, SERVER_CONFIG.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: '无效的令牌' });
  }
}

// 检查用户是否有程序操作权限
function checkProgramPermission(req, res, next) {
  const { programId } = req.params;
  const userId = req.user.userId;
  
  if (!db.checkUserProgramPermission(userId, parseInt(programId))) {
    return res.status(403).json({ message: '没有权限操作此程序' });
  }
  
  next();
}

// 检查是否为管理员
function checkAdmin(req, res, next) {
  const user = req.user;
  if (user.roleId !== 1) {
    return res.status(403).json({ message: '只有管理员才能访问此功能' });
  }
  next();
}

// 检查管理员是否有指定项目的权限
async function checkAdminProjectPermission(req, res, next) {
  const user = req.user;
  
  // 获取项目ID
  let projectId;
  if (req.body && req.body.projectId) {
    projectId = parseInt(req.body.projectId);
  } else if (req.params && req.params.projectId) {
    projectId = parseInt(req.params.projectId);
  }
  
  if (!projectId || isNaN(projectId)) {
    return res.status(400).json({ message: '无效的项目ID' });
  }
  
  // 检查当前管理员是否有该项目的权限
  // 如果是admin用户（username为admin），则拥有所有权限
  // 否则，检查该管理员是否有该项目的显式权限
  const adminUser = await db.getUserById(user.userId);
  if (!adminUser) {
    return res.status(404).json({ message: '用户不存在' });
  }
  
  if (adminUser.username === 'admin') {
    // admin用户拥有所有权限
    return next();
  }
  
  console.log(`检查管理员 ${adminUser.username}（ID: ${adminUser.id}）是否有项目 ${projectId} 的权限`);
  
  try {
    // 获取用户的项目权限
    const userProjectPermissions = await db.getAllUserProjectPermissions();
    const userPermissions = userProjectPermissions.filter(perm => perm.userId === adminUser.id);
    console.log(`用户项目权限: ${JSON.stringify(userPermissions)}`);
    
    if (!(await db.checkUserProjectPermission(user.userId, projectId))) {
      console.log(`管理员 ${adminUser.username} 没有项目 ${projectId} 的权限`);
      return res.status(403).json({ message: '没有权限操作此项目' });
    }
    
    console.log(`管理员 ${adminUser.username} 有项目 ${projectId} 的权限`);
    next();
  } catch (error) {
    console.error('检查项目权限时发生错误:', error);
    return res.status(500).json({ message: '内部服务器错误' });
  }
}

module.exports = {
  generateToken,
  verifyToken,
  checkProgramPermission,
  checkAdmin,
  checkAdminProjectPermission
};
