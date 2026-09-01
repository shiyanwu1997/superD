const express = require('express');
const router = express.Router();
const db = require('../models/db');
const authMiddleware = require('../middleware/auth');
const supervisorService = require('../services/supervisorService');
const { ApiError } = require('../utils/errors');
const Logger = require('../utils/logger');

// API: 获取用户可访问的项目列表
router.get('/api/projects', authMiddleware.verifyToken, authMiddleware.requireScope('projects:read'), async (req, res, next) => {
  try {
    const userId = req.session.user?.id || req.user.userId;

    const user = await db.getUserById(userId);
    if (!user) {
      throw new ApiError(404, '用户不存在');
    }

    const projects = await db.getUserProjects(userId);

    const projectsWithInitialStatus = projects.map(project => {
      const { supervisorConfig, ...projectWithoutConfig } = project;
      const safeSupervisorConfig = {
        host: supervisorConfig?.host || '',
        port: supervisorConfig?.port || 0
      };

      return {
        ...projectWithoutConfig,
        supervisorConfig: safeSupervisorConfig,
        connectionStatus: { connected: null, error: null }
      };
    });

    res.json(projectsWithInitialStatus);
  } catch (error) {
    if (!(error instanceof ApiError)) {
      let errorMessage = '获取项目列表失败';
      if (error.message.includes('权限')) {
        errorMessage = '没有权限访问项目列表';
      } else if (error.message.includes('数据库')) {
        errorMessage = '数据库查询失败';
      }
      error = new ApiError(500, errorMessage, error.message);
    }
    next(error);
  }
});

// API: 检查单个项目的连接状态
router.get('/api/projects/:projectId/status', authMiddleware.verifyToken, authMiddleware.requireScope('projects:read'), async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const userId = req.session.user?.id || req.user.userId;

    const hasProjectPerm = await db.checkUserProjectPermission(userId, parseInt(projectId));
    if (!hasProjectPerm) {
      // 检查程序级权限
      const programPerms = await db.getUserProgramPermissions(userId);
      const hasProgramPerm = programPerms.some(p => p.programId.startsWith(projectId + '-'));
      if (!hasProgramPerm) {
        throw new ApiError(403, '没有权限访问此项目');
      }
    }

    const project = await db.getProjectById(parseInt(projectId));
    if (!project) {
      throw new ApiError(404, '项目不存在');
    }

    let connectionStatus;
    const maxRetries = 2;
    let retryCount = 0;

    while (retryCount <= maxRetries) {
      try {
        connectionStatus = await supervisorService.checkConnectionStatus(parseInt(projectId));
        break;
      } catch (err) {
        retryCount++;
        if (retryCount > maxRetries) {
          connectionStatus = { connected: false, error: err.message };
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
      }
    }

    res.json({ connectionStatus });
  } catch (error) {
    if (!(error instanceof ApiError)) {
      error = new ApiError(500, '检查项目连接状态失败', error.message);
    }
    next(error);
  }
});

// 过滤项目返回数据中的敏感信息
function sanitizeProject(project) {
  const { supervisorConfig, ...safe } = project;
  let safeSupervisorConfig = {};

  try {
    const parsedConfig = typeof supervisorConfig === 'string' ? JSON.parse(supervisorConfig) : supervisorConfig;
    safeSupervisorConfig = {
      host: parsedConfig?.host || '',
      port: parsedConfig?.port || 0
    };
  } catch (error) {
    Logger.error('解析supervisorConfig失败:', error);
  }

  return { ...safe, supervisorConfig: safeSupervisorConfig };
}

// API: 创建新项目（仅管理员）
router.post('/api/projects', authMiddleware.verifyToken, authMiddleware.requireScope('projects:write'), authMiddleware.checkSuperAdmin, async (req, res, next) => {
  try {
    const { name, description, host, port, username, password } = req.body;

    if (!name || !host || !port) {
      throw new ApiError(400, '机器名称、主机和端口不能为空');
    }
    if (isNaN(parseInt(port)) || parseInt(port) < 1 || parseInt(port) > 65535) {
      throw new ApiError(400, '端口必须是 1-65535 之间的数字');
    }

    const newProject = await db.createProject(name, description || '', host, parseInt(port), username || '', password || '');

    if (!newProject) {
      throw new ApiError(400, '项目名称已存在');
    }

    res.status(201).json(sanitizeProject(newProject));
  } catch (error) {
    if (!(error instanceof ApiError)) {
      error = new ApiError(500, '创建新项目失败', error.message);
    }
    next(error);
  }
});

// API: 更新项目（仅管理员）
router.put('/api/projects/:id', authMiddleware.verifyToken, authMiddleware.requireScope('projects:write'), authMiddleware.checkSuperAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description, host, port, username, password } = req.body;

    if (!name || !host || !port) {
      throw new ApiError(400, '机器名称、主机和端口不能为空');
    }
    if (isNaN(parseInt(port)) || parseInt(port) < 1 || parseInt(port) > 65535) {
      throw new ApiError(400, '端口必须是 1-65535 之间的数字');
    }

    const updatedProject = await db.updateProject(parseInt(id), {
      name, description, host, port: parseInt(port), username, password
    });

    if (!updatedProject) {
      throw new ApiError(400, '项目不存在或名称已存在');
    }

    res.json(sanitizeProject(updatedProject));
  } catch (error) {
    if (!(error instanceof ApiError)) {
      error = new ApiError(500, '更新项目失败', error.message);
    }
    next(error);
  }
});

// API: 删除项目（仅管理员）
router.delete('/api/projects/:id', authMiddleware.verifyToken, authMiddleware.requireScope('projects:write'), authMiddleware.checkSuperAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;

    const success = await db.deleteProject(parseInt(id));

    if (success) {
      res.json({ success: true, message: '项目删除成功' });
    } else {
      throw new ApiError(404, '项目不存在');
    }
  } catch (error) {
    if (!(error instanceof ApiError)) {
      error = new ApiError(500, '删除项目失败', error.message);
    }
    next(error);
  }
});

module.exports = router;
