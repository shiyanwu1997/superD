const express = require('express');
const router = express.Router();
const db = require('../models/db');
const authMiddleware = require('../middleware/auth');
const supervisorService = require('../services/supervisorService');
const { ApiError } = require('../utils/errors');
const { parseProgramId } = require('../utils/programId');
const Logger = require('../utils/logger');

// 格式化运行时长
function formatUptime(seconds) {
  if (!seconds || seconds < 0) return '-';

  const minute = 60;
  const hour = 60 * minute;
  const day = 24 * hour;

  const days = Math.floor(seconds / day);
  seconds %= day;
  const hours = Math.floor(seconds / hour);
  seconds %= hour;
  const minutes = Math.floor(seconds / minute);

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0 || parts.length === 0) parts.push(`${minutes}min`);

  return parts.join(' ');
}

// 构建程序信息对象
function buildProgramInfo(process, projectId) {
  let uptime = null;
  if (process.statename === 'RUNNING' && process.now && process.start) {
    uptime = formatUptime(process.now - process.start);
  }

  return {
    id: `${projectId}-${process.name}`,
    name: process.name,
    projectId: parseInt(projectId),
    status: process.statename || process.description,
    state: process.state,
    description: `Supervisor程序: ${process.name}`,
    uptime: uptime
  };
}

// API: 获取项目下的程序列表
router.get('/api/projects/:projectId/programs', authMiddleware.verifyToken, authMiddleware.requireScope('programs:read'), async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const userId = req.session.user?.id || req.user.userId;
    const projectIdInt = parseInt(projectId);

    const hasProjectPerm = await db.checkUserProjectPermission(userId, projectIdInt);
    let allowedPrograms = null;

    if (!hasProjectPerm) {
      // 检查程序级权限
      const programPerms = await db.getUserProgramPermissions(userId);
      allowedPrograms = programPerms
        .filter(p => p.programId.startsWith(projectId + '-'))
        .map(p => p.programId.substring(projectId.length + 1));
      if (allowedPrograms.length === 0) {
        throw new ApiError(403, '没有权限访问此项目');
      }
    }

    let processes;
    const maxRetries = 2;
    let retryCount = 0;

    while (retryCount <= maxRetries) {
      try {
        processes = await supervisorService.getAllProcesses(projectIdInt);
        break;
      } catch (err) {
        retryCount++;
        if (retryCount > maxRetries) throw err;
        await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
      }
    }

    let programsWithStatus = processes.map(process => buildProgramInfo(process, projectId));

    // 仅有程序权限时，过滤只显示授权的程序
    if (allowedPrograms) {
      programsWithStatus = programsWithStatus.filter(p => allowedPrograms.includes(p.name));
    }

    res.json(programsWithStatus);
  } catch (error) {
    if (!(error instanceof ApiError)) {
      let errorMessage = '获取程序列表失败';
      if (error.message.includes('ECONNREFUSED')) {
        errorMessage = '无法连接到Supervisor服务';
      } else if (error.message.includes('ETIMEDOUT')) {
        errorMessage = '连接Supervisor服务超时';
      } else if (error.message.includes('认证')) {
        errorMessage = 'Supervisor认证失败';
      }
      error = new ApiError(500, errorMessage, error.message);
    }
    next(error);
  }
});

// API: 获取所有程序列表
router.get('/api/programs', authMiddleware.verifyToken, authMiddleware.requireScope('programs:read'), async (req, res, next) => {
  try {
    const userId = req.session.user?.id || req.user.userId;
    const userProjects = await db.getUserProjects(userId);
    const programPerms = await db.getUserProgramPermissions(userId);

    const allPrograms = [];
    for (const project of userProjects) {
      try {
        const hasProjectPerm = await db.checkUserProjectPermission(userId, project.id);
        const processes = await supervisorService.getAllProcesses(project.id);

        let projectPrograms;
        if (hasProjectPerm) {
          projectPrograms = processes.map(process => ({
            ...buildProgramInfo(process, project.id),
            projectName: project.name
          }));
        } else {
          const allowed = programPerms
            .filter(p => p.programId.startsWith(project.id + '-'))
            .map(p => p.programId.substring(String(project.id).length + 1));
          projectPrograms = processes
            .filter(p => allowed.includes(p.name))
            .map(process => ({
              ...buildProgramInfo(process, project.id),
              projectName: project.name
            }));
        }
        allPrograms.push(...projectPrograms);
      } catch (error) {
        Logger.error(`获取项目 ${project.name} 的程序列表失败:`, error);
      }
    }

    res.json(allPrograms);
  } catch (error) {
    if (!(error instanceof ApiError)) {
      error = new ApiError(500, '获取所有程序列表失败', error.message);
    }
    next(error);
  }
});

// API: 获取程序详情
router.get('/api/programs/:programId', authMiddleware.verifyToken, authMiddleware.requireScope('programs:read'), authMiddleware.requireScope('logs:read'), async (req, res, next) => {
  try {
    const { programId } = req.params;
    const userId = req.session.user?.id || req.user.userId;

    const { projectId, programName } = parseProgramId(programId);

    if (!(await db.checkUserSpecificProgramPermission(userId, programId))) {
      throw new ApiError(403, '没有权限访问此程序');
    }

    const processes = await supervisorService.getAllProcesses(projectId);
    const process = processes.find(p => p.name === programName);

    if (!process) {
      throw new ApiError(404, '程序不存在');
    }

    const program = buildProgramInfo(process, projectId);

    const project = await db.getProjectById(projectId);
    if (project) {
      program.projectName = project.name;
    }

    const logs = await supervisorService.getProcessLogs(projectId, programName, 0, 10000);

    res.json({
      program: program,
      configContent: '',
      logs: logs
    });
  } catch (error) {
    if (!(error instanceof ApiError)) {
      error = new ApiError(500, '获取程序详情失败', error.message);
    }
    next(error);
  }
});

// API: 获取程序标准输出日志
router.get('/api/programs/:programId/stdout', authMiddleware.verifyToken, authMiddleware.requireScope('logs:read'), async (req, res, next) => {
  try {
    const { programId } = req.params;
    const { offset = 0, length = 10000 } = req.query;
    const userId = req.session.user?.id || req.user.userId;

    const { projectId, programName } = parseProgramId(programId);

    if (!(await db.checkUserSpecificProgramPermission(userId, programId))) {
      throw new ApiError(403, '没有权限访问此程序');
    }

    const result = await supervisorService.getProcessStdoutLog(projectId, programName, parseInt(offset), parseInt(length));
    res.json({ stdout: result.logs, offset: result.offset });
  } catch (error) {
    if (!(error instanceof ApiError)) {
      error = new ApiError(500, '获取标准输出日志失败', error.message);
    }
    next(error);
  }
});

// API: 获取程序标准错误日志
router.get('/api/programs/:programId/stderr', authMiddleware.verifyToken, authMiddleware.requireScope('logs:read'), async (req, res, next) => {
  try {
    const { programId } = req.params;
    const { offset = 0, length = 10000 } = req.query;
    const userId = req.session.user?.id || req.user.userId;

    const { projectId, programName } = parseProgramId(programId);

    if (!(await db.checkUserSpecificProgramPermission(userId, programId))) {
      throw new ApiError(403, '没有权限访问此程序');
    }

    const result = await supervisorService.getProcessStderrLog(projectId, programName, parseInt(offset), parseInt(length));
    res.json({ stderr: result.logs, offset: result.offset });
  } catch (error) {
    if (!(error instanceof ApiError)) {
      error = new ApiError(500, '获取标准错误日志失败', error.message);
    }
    next(error);
  }
});

// API: 启动所有程序
router.post('/api/projects/:projectId/programs/start-all', authMiddleware.verifyToken, authMiddleware.requireScope('programs:write'), async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const userId = req.session.user?.id || req.user.userId;
    const projectIdInt = parseInt(projectId);

    if (!(await db.checkUserProjectPermission(userId, projectIdInt))) {
      throw new ApiError(403, '没有权限访问此项目');
    }

    const result = await supervisorService.startAllProcesses(projectIdInt);
    res.json(result);
  } catch (error) {
    if (!(error instanceof ApiError)) {
      error = new ApiError(500, '启动所有程序失败', error.message);
    }
    next(error);
  }
});

// API: 停止所有程序
router.post('/api/projects/:projectId/programs/stop-all', authMiddleware.verifyToken, authMiddleware.requireScope('programs:write'), async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const userId = req.session.user?.id || req.user.userId;
    const projectIdInt = parseInt(projectId);

    if (!(await db.checkUserProjectPermission(userId, projectIdInt))) {
      throw new ApiError(403, '没有权限访问此项目');
    }

    const result = await supervisorService.stopAllProcesses(projectIdInt);
    res.json(result);
  } catch (error) {
    if (!(error instanceof ApiError)) {
      error = new ApiError(500, '停止所有程序失败', error.message);
    }
    next(error);
  }
});

// API: 重启所有程序
router.post('/api/projects/:projectId/programs/restart-all', authMiddleware.verifyToken, authMiddleware.requireScope('programs:write'), async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const userId = req.session.user?.id || req.user.userId;
    const projectIdInt = parseInt(projectId);

    if (!(await db.checkUserProjectPermission(userId, projectIdInt))) {
      throw new ApiError(403, '没有权限访问此项目');
    }

    const result = await supervisorService.restartAllProcesses(projectIdInt);
    res.json(result);
  } catch (error) {
    if (!(error instanceof ApiError)) {
      error = new ApiError(500, '重启所有程序失败', error.message);
    }
    next(error);
  }
});

// API: 重载配置
router.post('/api/projects/:projectId/reload', authMiddleware.verifyToken, authMiddleware.requireScope('programs:write'), async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const userId = req.session.user?.id || req.user.userId;
    if (!(await db.checkUserProjectPermission(userId, parseInt(projectId)))) {
      throw new ApiError(403, '没有权限');
    }
    const result = await supervisorService.reloadConfig(parseInt(projectId));
    res.json(result);
  } catch (error) {
    if (!(error instanceof ApiError)) error = new ApiError(500, '重载失败', error.message);
    next(error);
  }
});

// API: 启动程序
router.post('/api/programs/:programId/start', authMiddleware.verifyToken, authMiddleware.requireScope('programs:write'), async (req, res, next) => {
  try {
    const { programId } = req.params;
    const userId = req.session.user?.id || req.user.userId;

    const { projectId, programName } = parseProgramId(programId);

    if (!(await db.checkUserSpecificProgramPermission(userId, programId))) {
      throw new ApiError(403, '没有权限操作此程序');
    }

    const result = await supervisorService.startProcess(projectId, programName);

    if (result.success) {
      res.json({ success: true, message: `程序 ${programName} 已成功启动` });
    } else {
      res.json({ success: false, message: `启动程序 ${programName} 失败: ${result.message}` });
    }
  } catch (error) {
    if (!(error instanceof ApiError)) {
      error = new ApiError(500, '启动程序失败', error.message);
    }
    next(error);
  }
});

// API: 停止程序
router.post('/api/programs/:programId/stop', authMiddleware.verifyToken, authMiddleware.requireScope('programs:write'), async (req, res, next) => {
  try {
    const { programId } = req.params;
    const userId = req.session.user?.id || req.user.userId;

    const { projectId, programName } = parseProgramId(programId);

    if (!(await db.checkUserSpecificProgramPermission(userId, programId))) {
      throw new ApiError(403, '没有权限操作此程序');
    }

    const result = await supervisorService.stopProcess(projectId, programName);
    if (result.success) {
      res.json({ success: true, message: `程序 ${programName} 已成功停止` });
    } else {
      res.json({ success: false, message: `停止程序 ${programName} 失败: ${result.message}` });
    }
  } catch (error) {
    if (!(error instanceof ApiError)) {
      error = new ApiError(500, '停止程序失败', error.message);
    }
    next(error);
  }
});

// API: 重启程序
router.post('/api/programs/:programId/restart', authMiddleware.verifyToken, authMiddleware.requireScope('programs:write'), async (req, res, next) => {
  const { programId } = req.params;
  const userId = req.session.user?.id || req.user.userId;

  try {
    const { projectId, programName } = parseProgramId(programId);

    if (!(await db.checkUserSpecificProgramPermission(userId, programId))) {
      throw new ApiError(403, '没有权限重启程序');
    }

    const result = await supervisorService.restartProcess(projectId, programName);
    if (result.success) {
      res.json({ success: true, message: `程序 ${programName} 已成功重启` });
    } else {
      res.json({ success: false, message: `重启程序 ${programName} 失败: ${result.message}` });
    }
  } catch (error) {
    if (error instanceof ApiError) return next(error);
    next(new ApiError(500, '重启程序失败', error.message));
  }
});

module.exports = router;
