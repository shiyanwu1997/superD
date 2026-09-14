const jwt = require('jsonwebtoken');
const db = require('../models/db');
const { SERVER_CONFIG } = require('../config');
const Logger = require('../utils/logger');
const { API_TOKEN_PREFIX } = require('../utils/apiToken');
const { hashApiToken } = require('../utils/apiToken');

// 生成JWT令牌
function generateToken(user) {
  return jwt.sign(
    { userId: user.id, username: user.username, roleId: user.roleId },
    SERVER_CONFIG.JWT_SECRET, // 使用配置文件中的密钥
    { expiresIn: '1h' }
  );
}

async function authenticateBearerToken(token) {
  if (token.startsWith(API_TOKEN_PREFIX)) {
    const apiToken = await db.getActiveApiTokenByHash(hashApiToken(token));
    if (!apiToken) throw new Error('Invalid API token');

    const user = await db.getUserById(apiToken.userId);
    if (!user) throw new Error('Invalid API token user');

    // 更新使用时间不应阻塞正常的 API 调用。
    db.touchApiToken(apiToken.id).catch(error => Logger.error('更新 API 令牌使用时间失败', error));
    return {
      user: { userId: user.id, username: user.username, roleId: user.roleId },
      authType: 'api_token',
      apiToken: { id: apiToken.id, name: apiToken.name, scopes: apiToken.scopes }
    };
  }

  const decoded = jwt.verify(token, SERVER_CONFIG.JWT_SECRET);
  const user = await db.getUserById(decoded.userId);
  if (!user) throw new Error('Invalid JWT user');
  return {
    user: { userId: user.id, username: user.username, roleId: user.roleId },
    authType: 'jwt',
    apiToken: null
  };
}

// 验证 JWT 或服务 API 令牌。
async function verifyToken(req, res, next) {
  const authorization = req.headers.authorization;
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return res.status(401).json({ message: '未授权访问' });

  try {
    const authenticated = await authenticateBearerToken(token);
    req.user = authenticated.user;
    req.authType = authenticated.authType;
    req.apiToken = authenticated.apiToken;
    next();
  } catch (error) {
    return res.status(401).json({ message: '无效的令牌' });
  }
}

function requireScope(scope) {
  return (req, res, next) => {
    if (req.authType !== 'api_token') return next();
    if (req.apiToken.scopes.includes('*') || req.apiToken.scopes.includes(scope)) return next();
    return res.status(403).json({ message: `API 令牌缺少范围: ${scope}` });
  };
}

// 检查是否为管理员（包括超级管理员和普通管理员）
function checkAdmin(req, res, next) {
  const user = req.user;
  if (user.roleId !== 1 && user.roleId !== 2) {
    return res.status(403).json({ message: '只有管理员才能访问此功能' });
  }
  next();
}

// 只有超级管理员可以修改全局机器与分组配置。
function checkSuperAdmin(req, res, next) {
  if (req.user.roleId !== 1) {
    return res.status(403).json({ message: '只有超级管理员才能访问此功能' });
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
  
  try {
    // 获取项目名称
    const project = await db.getProjectById(projectId);
    const projectName = project ? project.name : '未知项目';
    
    Logger.debug(`检查管理员权限`, { adminUser: adminUser.username, projectId, projectName });
    const hasPermission = await db.checkUserProjectPermission(user.userId, projectId);
    if (!hasPermission) {
      Logger.warn(`管理员没有项目权限`, { adminUser: adminUser.username, projectId, projectName });
      return res.status(403).json({ message: '没有权限操作此项目' });
    }
    next();
  } catch (error) {
    Logger.error('检查项目权限时发生错误:', error);
    return res.status(500).json({ message: '内部服务器错误' });
  }
}

module.exports = {
  generateToken,
  authenticateBearerToken,
  verifyToken,
  requireScope,
  checkAdmin,
  checkSuperAdmin,
  checkAdminProjectPermission
};
