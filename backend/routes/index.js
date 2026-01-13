const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const path = require('path');
const db = require('../models/db');
const authMiddleware = require('../middleware/auth');
const supervisorService = require('../services/supervisorService');
// 引入自定义错误处理
const { ApiError } = require('../utils/errors');
// 引入Logger工具
const Logger = require('../utils/logger');

// 全局运行时长格式化函数
function formatUptime(seconds) {
  if (!seconds || seconds < 0) return '-';
  
  // 定义时间单位（秒）
  const minute = 60;
  const hour = 60 * minute;
  const day = 24 * hour;
  
  // 计算各时间单位（只保留天、时、分）
  const days = Math.floor(seconds / day);
  seconds %= day;
  const hours = Math.floor(seconds / hour);
  seconds %= hour;
  const minutes = Math.floor(seconds / minute);
  
  // 构建结果数组，使用指定格式
  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0 || parts.length === 0) parts.push(`${minutes}min`);
  
  return parts.join(' ');
}

// 根路径返回API信息
router.get('/', (req, res) => {
  res.json({ message: 'Supervisor API Server is running', version: '1.0.0' });
});

// 处理登录请求
router.post('/api/login', async (req, res, next) => {
  console.log('=== 收到登录请求 ===\n');
  console.log('请求方法：', req.method);
  console.log('请求路径：', req.url);
  console.log('请求头：', JSON.stringify(req.headers, null, 2));
  
  try {
    const { username, password } = req.body;
    console.log('登录请求参数：', { username, password } + '\n');
    
    // 验证请求参数
    if (!username || !password) {
      throw new ApiError(400, '用户名和密码不能为空');
    }
    
    const user = await db.getUserByUsername(username);
    console.log('从数据库获取到的用户信息：', JSON.stringify(user, null, 2) + '\n');
    
    // 检查用户是否存在
    if (!user) {
      throw new ApiError(401, '用户名或密码错误');
    }
    
    // 使用bcrypt验证密码
    console.log('开始验证密码...');
    console.log('用户密码哈希：', user.password);
    console.log('待验证密码：', password);
    
    const isMatch = await bcrypt.compare(password, user.password);
    console.log('密码匹配结果：', isMatch + '\n');
    
    if (!isMatch) {
      throw new ApiError(401, '用户名或密码错误');
    }
    
    console.log('密码验证成功，生成JWT令牌...');
    // 生成 JWT 令牌
    const token = authMiddleware.generateToken(user);
    console.log('生成的JWT令牌：', token);
    
    // 将令牌存储在 session 中
    req.session.token = token;
    req.session.user = user;
    
    // 始终返回 JSON 响应，由前端处理路由导航
    // 添加缓存控制头，防止浏览器缓存登录响应
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    
    console.log('登录成功，返回响应：{ success: true }\n');
    res.json({ success: true, message: '登录成功', token: token });
  } catch (error) {
    console.error('登录处理异常：', error + '\n');
    console.error('异常堆栈：', error.stack + '\n');
    
    // 如果是我们自定义的ApiError，直接传递给错误处理中间件
    if (error instanceof ApiError) {
      next(error);
    } else {
      // 否则包装成ApiError
      next(new ApiError(500, '服务器内部错误', error.message));
    }
  } finally {
    console.log('=== 登录请求处理完成 ===\n');
  }
});

// 退出登录
router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

// API: 获取用户信息
router.get('/api/user', authMiddleware.verifyToken, async (req, res, next) => {
  try {
    let userId, username, roleId;
    
    if (req.session.user) {
      // 从会话获取用户信息
      userId = req.session.user.id;
      username = req.session.user.username;
      roleId = req.session.user.roleId;
    } else if (req.user) {
      // 从JWT令牌获取用户信息
      userId = req.user.userId;
      username = req.user.username;
      roleId = req.user.roleId;
    }
    
    res.json({
      id: userId,
      username: username,
      roleId: roleId
    });
  } catch (error) {
    console.error('获取用户信息失败:', error + '\n');
    console.error('异常堆栈:', error.stack + '\n');
    if (error instanceof ApiError) {
      next(error);
    } else {
      next(new ApiError(500, '服务器内部错误', error.message));
    }
  }
});

// API: 获取用户可访问的项目列表
router.get('/api/projects', authMiddleware.verifyToken, async (req, res, next) => {
  try {
    const userId = req.session.user?.id || req.user.userId;
    
    // 检查用户是否存在
    const user = await db.getUserById(userId);
    if (!user) {
      throw new ApiError(404, '用户不存在');
    }
    
    // 直接返回项目基本信息，不进行连接状态检查
    // 连接状态由前端在获取到项目列表后逐个检查
    const projects = await db.getUserProjects(userId);
    
    // 为每个项目添加初始连接状态并过滤敏感信息
    const projectsWithInitialStatus = projects.map(project => {
      // 过滤supervisorConfig中的敏感信息
      const { supervisorConfig, ...projectWithoutConfig } = project;
      const safeSupervisorConfig = {
        host: supervisorConfig?.host || '',
        port: supervisorConfig?.port || 0
        // 不包含username和password等敏感信息
      };
      
      return {
        ...projectWithoutConfig,
        supervisorConfig: safeSupervisorConfig,
        connectionStatus: { connected: null, error: null } // 初始状态为null，等待前端检查
      };
    });
    
    res.json(projectsWithInitialStatus);
  } catch (error) {
    console.error('获取项目列表失败:', error + '\n');
    console.error('异常堆栈:', error.stack + '\n');
    
    // 根据错误类型提供更明确的错误信息
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
router.get('/api/projects/:projectId/status', authMiddleware.verifyToken, async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const userId = req.session.user?.id || req.user.userId;
    
    // 检查用户是否有该项目的权限
    if (!(await db.checkUserProjectPermission(userId, parseInt(projectId)))) {
      throw new ApiError(403, '没有权限访问此项目');
    }
    
    // 检查项目是否存在
    const project = await db.getProjectById(parseInt(projectId));
    if (!project) {
      throw new ApiError(404, '项目不存在');
    }
    
    // 添加与获取程序列表相同的重试机制，最多尝试2次
    let connectionStatus;
    const maxRetries = 2;
    let retryCount = 0;
    
    while (retryCount <= maxRetries) {
      try {
        // 检查连接状态
        connectionStatus = await supervisorService.checkConnectionStatus(parseInt(projectId));
        break; // 成功获取，跳出循环
      } catch (err) {
        retryCount++;
        if (retryCount > maxRetries) {
          // 所有重试都失败，返回连接失败的状态
          connectionStatus = { connected: false, error: err.message };
          break;
        }
        // 等待一段时间后重试
        await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
        console.log(`重试检查项目${projectId}的连接状态 (${retryCount}/${maxRetries})`);
      }
    }
    
    res.json({ connectionStatus });
  } catch (error) {
    console.error(`检查项目${projectId}连接状态失败:`, error + '\n');
    console.error('异常堆栈:', error.stack + '\n');
    
    if (!(error instanceof ApiError)) {
      error = new ApiError(500, '检查项目连接状态失败', error.message);
    }
    
    next(error);
  }
});

// API: 创建新项目（仅管理员）
router.post('/api/projects', authMiddleware.verifyToken, authMiddleware.checkAdmin, async (req, res, next) => {
  try {
    const { name, description, host, port, username, password } = req.body;
    
    // 验证必填字段
    if (!name || !host || !port) {
      throw new ApiError(400, '项目名称、主机和端口不能为空');
    }
    
    // 创建新项目
    const newProject = await db.createProject(name, description || '', host, parseInt(port), username || '', password || '');
    
    if (!newProject) {
      throw new ApiError(400, '项目名称已存在');
    }
    
    // 过滤返回数据中的敏感信息
    const { supervisorConfig, ...safeNewProject } = newProject;
    let safeSupervisorConfig = {};
    
    try {
      // 解析supervisorConfig（如果是字符串）
      const parsedConfig = typeof supervisorConfig === 'string' ? JSON.parse(supervisorConfig) : supervisorConfig;
      safeSupervisorConfig = {
        host: parsedConfig?.host || '',
        port: parsedConfig?.port || 0
        // 不包含username和password等敏感信息
      };
    } catch (error) {
      console.error('解析supervisorConfig失败:', error);
    }
    
    res.status(201).json({
      ...safeNewProject,
      supervisorConfig: safeSupervisorConfig
    });
  } catch (error) {
    console.error('创建新项目失败:', error + '\n');
    console.error('异常堆栈:', error.stack + '\n');
    
    if (!(error instanceof ApiError)) {
      error = new ApiError(500, '创建新项目失败', error.message);
    }
    
    next(error);
  }
});

// API: 更新项目（仅管理员）
router.put('/api/projects/:id', authMiddleware.verifyToken, authMiddleware.checkAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description, host, port, username, password } = req.body;
    
    // 验证必填字段
    if (!name || !host || !port) {
      throw new ApiError(400, '项目名称、主机和端口不能为空');
    }
    
    // 更新项目信息
    const updatedProject = await db.updateProject(parseInt(id), {
      name,
      description,
      host,
      port: parseInt(port),
      username,
      password
    });
    
    if (!updatedProject) {
      throw new ApiError(400, '项目不存在或名称已存在');
    }
    
    // 过滤返回数据中的敏感信息
    const { supervisorConfig, ...safeUpdatedProject } = updatedProject;
    let safeSupervisorConfig = {};
    
    try {
      // 解析supervisorConfig（如果是字符串）
      const parsedConfig = typeof supervisorConfig === 'string' ? JSON.parse(supervisorConfig) : supervisorConfig;
      safeSupervisorConfig = {
        host: parsedConfig?.host || '',
        port: parsedConfig?.port || 0
        // 不包含username和password等敏感信息
      };
    } catch (error) {
      console.error('解析supervisorConfig失败:', error);
    }
    
    res.json({
      ...safeUpdatedProject,
      supervisorConfig: safeSupervisorConfig
    });
  } catch (error) {
    console.error(`更新项目${id}失败:`, error + '\n');
    console.error('异常堆栈:', error.stack + '\n');
    
    if (!(error instanceof ApiError)) {
      error = new ApiError(500, '更新项目失败', error.message);
    }
    
    next(error);
  }
});

// API: 删除项目（仅管理员）
router.delete('/api/projects/:id', authMiddleware.verifyToken, authMiddleware.checkAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // 删除项目
    const success = await db.deleteProject(parseInt(id));
    
    if (success) {
      res.json({ success: true, message: '项目删除成功' });
    } else {
      throw new ApiError(404, '项目不存在');
    }
  } catch (error) {
    console.error(`删除项目${id}失败:`, error + '\n');
    console.error('异常堆栈:', error.stack + '\n');
    
    if (!(error instanceof ApiError)) {
      error = new ApiError(500, '删除项目失败', error.message);
    }
    
    next(error);
  }
});

// API: 获取项目下的程序列表
router.get('/api/projects/:projectId/programs', authMiddleware.verifyToken, async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const userId = req.session.user?.id || req.user.userId;
    
    // 检查用户是否有该项目的权限
    if (!(await db.checkUserProjectPermission(userId, parseInt(projectId)))) {
      throw new ApiError(403, '没有权限访问此项目');
    }
    
    // 添加重试机制，最多尝试2次
    let processes;
    const maxRetries = 2;
    let retryCount = 0;
    
    while (retryCount <= maxRetries) {
      try {
        // 直接从Supervisor获取程序列表
        processes = await supervisorService.getAllProcesses(parseInt(projectId));
        break; // 成功获取，跳出循环
      } catch (err) {
        retryCount++;
        if (retryCount > maxRetries) {
          // 所有重试都失败，抛出最后一次错误
          throw err;
        }
        // 等待一段时间后重试
        await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
        console.log(`重试获取项目${projectId}的程序列表 (${retryCount}/${maxRetries})`);
      }
    }
    
    // 为每个程序添加基本信息
    console.log('原始程序信息:', JSON.stringify(processes, null, 2));
    const programsWithStatus = processes.map(process => {
      console.log('单个程序信息:', process);
      // 计算运行时长
      let uptime = null;
      if (process.statename === 'RUNNING' && process.now && process.start) {
        const durationSeconds = process.now - process.start;
        console.log(`计算运行时长: ${process.name} - start: ${process.start}, now: ${process.now}, 时长: ${durationSeconds}秒`);
        uptime = formatUptime(durationSeconds);
        console.log(`格式化后时长: ${uptime}`);
      } else {
        console.log(`不计算运行时长: ${process.name} - status: ${process.statename}, now: ${process.now}, start: ${process.start}`);
      }
      
      return {
        id: `${projectId}-${process.name}`, // 使用项目ID和程序名作为唯一标识
        name: process.name,
        projectId: parseInt(projectId),
        status: process.statename || process.description,
        state: process.state,
        description: `Supervisor程序: ${process.name}`,
        uptime: uptime
      };
    });
    
    console.log('返回的程序列表:', JSON.stringify(programsWithStatus, null, 2));
    

    
    res.json(programsWithStatus);
  } catch (error) {
    console.error(`获取项目${projectId}的程序列表失败:`, error + '\n');
    console.error('异常堆栈:', error.stack + '\n');
    
    // 提供更具体的错误信息
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

// API: 获取程序列表
router.get('/api/programs', authMiddleware.verifyToken, async (req, res, next) => {
  try {
    const userId = req.session.user?.id || req.user.userId;
    const userProjects = await db.getUserProjects(userId);
    
    // 为每个项目获取程序列表
    const allPrograms = [];
    for (const project of userProjects) {
      try {
        const processes = await supervisorService.getAllProcesses(project.id);
        
        // 为每个程序添加基本信息
        const projectPrograms = processes.map(process => {
          // 计算运行时长
          let uptime = null;
          if (process.statename === 'RUNNING' && process.now && process.start) {
            const durationSeconds = process.now - process.start;
            uptime = formatUptime(durationSeconds);
          }
          
          return {
            id: `${project.id}-${process.name}`, // 使用项目ID和程序名作为唯一标识
            name: process.name,
            projectId: project.id,
            status: process.statename || process.description,
            state: process.state,
            description: `Supervisor程序: ${process.name}`,
            projectName: project.name,
            uptime: uptime
          };
        });
        

        
        allPrograms.push(...projectPrograms);
      } catch (error) {
        console.error(`获取项目 ${project.name} 的程序列表失败:`, error + '\n');
        // 跳过获取失败的项目，继续获取其他项目
      }
    }
    
    res.json(allPrograms);
  } catch (error) {
    console.error('获取所有程序列表失败:', error + '\n');
    console.error('异常堆栈:', error.stack + '\n');
    
    if (!(error instanceof ApiError)) {
      error = new ApiError(500, '获取所有程序列表失败', error.message);
    }
    
    next(error);
  }
});

// API: 获取程序详情
router.get('/api/programs/:programId', authMiddleware.verifyToken, async (req, res, next) => {
  try {
    const { programId } = req.params;
    const userId = req.session.user?.id || req.user.userId;
    
    // 解析动态生成的程序ID (格式: ${projectId}-${programName})
    // projectId是一个数字，所以我们只需要找到第一个'-'
    const firstDashIndex = programId.indexOf('-');
    if (firstDashIndex === -1) {
      throw new ApiError(400, '无效的程序ID格式');
    }
    const projectId = programId.substring(0, firstDashIndex);
    const programName = programId.substring(firstDashIndex + 1);
    
    if (!projectId || !programName) {
      throw new ApiError(400, '无效的程序ID格式');
    }
    
    const projectIdInt = parseInt(projectId);
    
    // 检查用户是否有该项目的权限
    if (!(await db.checkUserProjectPermission(userId, projectIdInt))) {
      throw new ApiError(403, '没有权限访问此程序');
    }
    
    // 获取程序状态
    const processes = await supervisorService.getAllProcesses(projectIdInt);
    const process = processes.find(p => p.name === programName);
    
    if (!process) {
      throw new ApiError(404, '程序不存在');
    }
    
    // 构建程序信息
    // 计算运行时长
    let uptime = null;
    if (process.statename === 'RUNNING' && process.now && process.start) {
      const durationSeconds = process.now - process.start;
      uptime = formatUptime(durationSeconds);
    }
    
    const program = {
      id: programId,
      name: programName,
      projectId: projectIdInt,
      status: process.statename || process.description,
      state: process.state,
      description: `Supervisor程序: ${programName}`,
      uptime: uptime
    };
    

    
    // 获取项目名称
    const project = await db.getProjectById(projectIdInt);
    if (project) {
      program.projectName = project.name;
    }
    
    // 获取日志 - 增加长度限制以获取完整日志
    const logs = await supervisorService.getProcessLogs(projectIdInt, programName, 0, 10000);
    
    res.json({
      program: program,
      configContent: '', // 动态获取的程序没有本地配置文件路径
      logs: logs
    });
  } catch (error) {
    console.error('获取程序详情失败:', error + '\n');
    console.error('异常堆栈:', error.stack + '\n');
    
    if (!(error instanceof ApiError)) {
      error = new ApiError(500, '获取程序详情失败', error.message);
    }
    
    next(error);
  }
});

// API: 获取程序标准输出日志
router.get('/api/programs/:programId/stdout', authMiddleware.verifyToken, async (req, res, next) => {
  try {
    const { programId } = req.params;
    const { offset = 0, length = 10000 } = req.query;
    const userId = req.session.user?.id || req.user.userId;
    
    // 解析动态生成的程序ID (格式: ${projectId}-${programName})
    // projectId是一个数字，所以我们只需要找到第一个'-'
    const firstDashIndex = programId.indexOf('-');
    if (firstDashIndex === -1) {
      throw new ApiError(400, '无效的程序ID格式');
    }
    const projectId = programId.substring(0, firstDashIndex);
    const programName = programId.substring(firstDashIndex + 1);
    
    if (!projectId || !programName) {
      throw new ApiError(400, '无效的程序ID格式');
    }
    
    const projectIdInt = parseInt(projectId);
    
    // 检查用户是否有该项目的权限
    if (!(await db.checkUserProjectPermission(userId, projectIdInt))) {
      throw new ApiError(403, '没有权限访问此程序');
    }
    
    const result = await supervisorService.getProcessStdoutLog(projectIdInt, programName, parseInt(offset), parseInt(length));
    res.json({ stdout: result.logs, offset: result.offset });
  } catch (error) {
    console.error('获取标准输出日志失败:', error + '\n');
    console.error('异常堆栈:', error.stack + '\n');
    
    if (!(error instanceof ApiError)) {
      error = new ApiError(500, '获取标准输出日志失败', error.message);
    }
    
    next(error);
  }
});

// API: 获取程序标准错误日志
router.get('/api/programs/:programId/stderr', authMiddleware.verifyToken, async (req, res, next) => {
  try {
    const { programId } = req.params;
    const { offset = 0, length = 10000 } = req.query;
    const userId = req.session.user?.id || req.user.userId;
    
    // 解析动态生成的程序ID (格式: ${projectId}-${programName})
    // 由于programName可能包含'-'，我们需要特殊处理
    const firstDashIndex = programId.indexOf('-');
    if (firstDashIndex === -1) {
      throw new ApiError(400, '无效的程序ID格式');
    }
    const projectId = programId.substring(0, firstDashIndex);
    const programName = programId.substring(firstDashIndex + 1);
    
    if (!projectId || !programName) {
      throw new ApiError(400, '无效的程序ID格式');
    }
    
    const projectIdInt = parseInt(projectId);
    
    // 检查用户是否有该项目的权限
    if (!(await db.checkUserProjectPermission(userId, projectIdInt))) {
      throw new ApiError(403, '没有权限访问此程序');
    }
    
    const result = await supervisorService.getProcessStderrLog(projectIdInt, programName, parseInt(offset), parseInt(length));
    res.json({ stderr: result.logs, offset: result.offset });
  } catch (error) {
    console.error('获取标准错误日志失败:', error + '\n');
    console.error('异常堆栈:', error.stack + '\n');
    
    if (!(error instanceof ApiError)) {
      error = new ApiError(500, '获取标准错误日志失败', error.message);
    }
    
    next(error);
  }
});

// API: 启动所有程序
router.post('/api/projects/:projectId/programs/start-all', authMiddleware.verifyToken, async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const userId = req.session.user?.id || req.user.userId;
    
    const projectIdInt = parseInt(projectId);
    
    // 检查用户是否有该项目的权限
    if (!(await db.checkUserProjectPermission(userId, projectIdInt))) {
      throw new ApiError(403, '没有权限访问此项目');
    }
    
    const result = await supervisorService.startAllProcesses(projectIdInt);
    res.json(result);
  } catch (error) {
    console.error('启动所有程序失败:', error + '\n');
    console.error('异常堆栈:', error.stack + '\n');
    
    if (!(error instanceof ApiError)) {
      error = new ApiError(500, '启动所有程序失败', error.message);
    }
    
    next(error);
  }
});

// API: 停止所有程序
router.post('/api/projects/:projectId/programs/stop-all', authMiddleware.verifyToken, async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const userId = req.session.user?.id || req.user.userId;
    
    const projectIdInt = parseInt(projectId);
    
    // 检查用户是否有该项目的权限
    if (!(await db.checkUserProjectPermission(userId, projectIdInt))) {
      throw new ApiError(403, '没有权限访问此项目');
    }
    
    const result = await supervisorService.stopAllProcesses(projectIdInt);
    res.json(result);
  } catch (error) {
    console.error('停止所有程序失败:', error + '\n');
    console.error('异常堆栈:', error.stack + '\n');
    
    if (!(error instanceof ApiError)) {
      error = new ApiError(500, '停止所有程序失败', error.message);
    }
    
    next(error);
  }
});

// API: 重启所有程序
router.post('/api/projects/:projectId/programs/restart-all', authMiddleware.verifyToken, async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const userId = req.session.user?.id || req.user.userId;
    
    const projectIdInt = parseInt(projectId);
    
    // 检查用户是否有该项目的权限
    if (!(await db.checkUserProjectPermission(userId, projectIdInt))) {
      throw new ApiError(403, '没有权限访问此项目');
    }
    
    const result = await supervisorService.restartAllProcesses(projectIdInt);
    res.json(result);
  } catch (error) {
    console.error('重启所有程序失败:', error + '\n');
    console.error('异常堆栈:', error.stack + '\n');
    
    if (!(error instanceof ApiError)) {
      error = new ApiError(500, '重启所有程序失败', error.message);
    }
    
    next(error);
  }
});

// API: 启动程序
router.post('/api/programs/:programId/start', authMiddleware.verifyToken, async (req, res, next) => {
  try {
    const { programId } = req.params;
    const userId = req.session.user?.id || req.user.userId;
    
    // 解析动态生成的程序ID (格式: ${projectId}-${programName})
    // 由于programName可能包含'-'，我们需要特殊处理
    const firstDashIndex = programId.indexOf('-');
    if (firstDashIndex === -1) {
      throw new ApiError(400, '无效的程序ID格式');
    }
    const projectId = programId.substring(0, firstDashIndex);
    const programName = programId.substring(firstDashIndex + 1);
    
    if (!projectId || !programName) {
      throw new ApiError(400, '无效的程序ID格式');
    }
    
    const projectIdInt = parseInt(projectId);
    
    // 检查用户是否有该项目的权限
    if (!(await db.checkUserProjectPermission(userId, projectIdInt))) {
      throw new ApiError(403, '没有权限重启所有程序');
    }
    
    console.log(`\n=== API路由: 启动程序 ${programName} ===`);
    console.log(`解析出的programId: ${programId}`);
    console.log(`解析出的projectId: ${projectIdInt}`);
    console.log(`解析出的programName: ${programName}`);
    
    const result = await supervisorService.startProcess(projectIdInt, programName);
    
    console.log(`\n=== API路由: 启动程序结果 ===`);
    console.log(`启动结果: ${JSON.stringify(result, null, 2)}`);
    
    if (result.success) {
      res.json({ success: true, message: `程序 ${programName} 已成功启动` });
    } else {
      res.json({ success: false, message: `启动程序 ${programName} 失败: ${result.message}` });
    }
  } catch (error) {
    console.error('启动程序失败:', error + '\n');
    console.error('异常堆栈:', error.stack + '\n');
    
    if (!(error instanceof ApiError)) {
      error = new ApiError(500, `启动程序 ${programName} 失败`, error.message);
    }
    
    next(error);
  }
});

// API: 停止程序
router.post('/api/programs/:programId/stop', authMiddleware.verifyToken, async (req, res, next) => {
  try {
    const { programId } = req.params;
    const userId = req.session.user?.id || req.user.userId;
    
    // 解析动态生成的程序ID (格式: ${projectId}-${programName})
    // 由于programName可能包含'-'，我们需要特殊处理
    const firstDashIndex = programId.indexOf('-');
    if (firstDashIndex === -1) {
      throw new ApiError(400, '无效的程序ID格式');
    }
    const projectId = programId.substring(0, firstDashIndex);
    const programName = programId.substring(firstDashIndex + 1);
    
    if (!projectId || !programName) {
      throw new ApiError(400, '无效的程序ID格式');
    }
    
    const projectIdInt = parseInt(projectId);
    
    // 检查用户是否有该项目的权限
    if (!(await db.checkUserProjectPermission(userId, projectIdInt))) {
      throw new ApiError(403, '没有权限操作此程序');
    }
    
    const result = await supervisorService.stopProcess(projectIdInt, programName);
    if (result.success) {
      res.json({ success: true, message: `程序 ${programName} 已成功停止` });
    } else {
      res.json({ success: false, message: `停止程序 ${programName} 失败: ${result.message}` });
    }
  } catch (error) {
    console.error('停止程序失败:', error + '\n');
    console.error('异常堆栈:', error.stack + '\n');
    
    if (!(error instanceof ApiError)) {
      error = new ApiError(500, `停止程序 ${programName} 失败`, error.message);
    }
    
    next(error);
  }
});

// API: 重启程序
router.post('/api/programs/:programId/restart', authMiddleware.verifyToken, async (req, res) => {
  const { programId } = req.params;
  const userId = req.session.user?.id || req.user.userId;
  
  // 解析动态生成的程序ID (格式: ${projectId}-${programName})
  // projectId是一个数字，所以我们只需要找到第一个'-'
  const firstDashIndex = programId.indexOf('-');
  if (firstDashIndex === -1) {
    Logger.warn('无效的程序ID格式', { programId }, req);
    return res.status(400).json({ error: '无效的程序ID格式' });
  }
  const projectId = programId.substring(0, firstDashIndex);
  const programName = programId.substring(firstDashIndex + 1);
  
  if (!projectId || !programName) {
    Logger.warn('无效的程序ID格式', { projectId, programName }, req);
    return res.status(400).json({ error: '无效的程序ID格式' });
  }
  
  const projectIdInt = parseInt(projectId);
  
  // 检查用户是否有该项目的权限
  if (!(await db.checkUserProjectPermission(userId, projectIdInt))) {
    Logger.warn('用户没有权限重启程序', { userId, projectIdInt, programName }, req);
    return res.status(403).json({ error: '没有权限重启程序' });
  }
  
  try {
    Logger.info(`用户请求重启程序`, { userId, projectId: projectIdInt, programName }, req);
    const result = await supervisorService.restartProcess(projectIdInt, programName);
    
    if (result.success) {
      Logger.info(`程序重启成功`, { projectId: projectIdInt, programName }, req);
      res.json({ success: true, message: `程序 ${programName} 已成功重启` });
    } else {
      Logger.error(`程序重启失败`, { projectId: projectIdInt, programName, error: result.message }, req);
      res.json({ success: false, message: `重启程序 ${programName} 失败: ${result.message}` });
    }
  } catch (error) {
    Logger.error('重启程序异常', error, req);
    res.json({ success: false, message: `重启程序 ${programName} 失败: ${error.message}` });
  }
});

// API: 获取用户列表（根据角色权限返回不同的用户列表）
router.get('/api/users', authMiddleware.verifyToken, async (req, res) => {
  const currentUserId = req.session.user?.id || req.user.userId;
  const currentUser = await db.getUserById(currentUserId);
  
  if (!currentUser) {
    return res.status(404).json({ error: '用户不存在' });
  }
  
  let users = [];
  
  // 根据用户角色决定返回的用户列表
  if (currentUser.roleId === 1) {
    // admin角色（超级管理员），查看所有用户
    users = await db.getAllUsers();
  } else if (currentUser.roleId === 2) {
    // 普通管理员角色，只能查看自己和自己创建的用户
    const allUsers = await db.getAllUsers();
    users = allUsers.filter(user => {
      // 只能看到自己或自己创建的用户
      return user.id === currentUserId || 
             (user.createdBy !== null && user.createdBy === currentUserId);
    });
  } else {
    // 普通用户/开发者角色，不能查看任何用户信息
    return res.status(403).json({ error: '没有权限访问用户列表' });
  }
  
  const roles = await db.getAllRoles();
  const userProjectPermissions = await db.getAllUserProjectPermissions();
  
  // 获取所有用户，用于查找上级管理员用户名
  const allUsers = await db.getAllUsers();

  // 为每个用户添加角色信息、项目权限和上级管理员用户名
  const usersWithRoles = users.map(user => {
    const role = roles.find(r => r.id === user.roleId);
    // 获取用户的项目权限
    const permissions = userProjectPermissions
      .filter(perm => perm.userId === user.id)
      .map(perm => ({ projectId: perm.projectId }));
    // 获取上级管理员用户名
    let createdByUsername = null;
    if (user.createdBy) {
      const admin = allUsers.find(u => u.id === user.createdBy);
      if (admin) {
        createdByUsername = admin.username;
      }
    }
    return {
      ...user,
      roleName: role ? role.name : '未知角色',
      projectPermissions: permissions,
      createdByUsername: createdByUsername
    };
  });
  
  res.json(usersWithRoles);
});

// API: 创建新用户（仅管理员）
router.post('/api/users', authMiddleware.verifyToken, authMiddleware.checkAdmin, async (req, res, next) => {
  try {
    const { username, password, roleId } = req.body;
    // 转换roleId为数字类型
    const parsedRoleId = parseInt(roleId);
    
    if (!username || !password) {
      throw new ApiError(400, '用户名和密码不能为空');
    }
    
    // 获取当前管理员用户ID和角色
    const currentUserId = req.session.user?.id || req.user.userId;
    const currentUser = await db.getUserById(currentUserId);
    
    // 限制普通管理员只能创建普通用户（roleId=3）
    if (currentUser.roleId === 2) {
      if (parsedRoleId !== 3) {
        throw new ApiError(403, '普通管理员只能创建普通用户');
      }
    }
    
    // 使用bcrypt加密密码
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // 对于超级管理员，可以指定createdBy；对于普通管理员，只能使用自己作为createdBy
    let createdBy = currentUserId;
    if (currentUser.roleId === 1 && req.body.createdBy) {
      createdBy = parseInt(req.body.createdBy);
      // 验证指定的createdBy是否为有效的普通管理员
      const parentAdmin = await db.getUserById(createdBy);
      if (!parentAdmin || parentAdmin.roleId !== 2) {
        throw new ApiError(400, '指定的上级管理员无效');
      }
    }
    
    const newUser = await db.createUser(username, hashedPassword, parsedRoleId, createdBy);
    
    if (newUser) {
      res.json({ success: true, message: '用户创建成功', user: newUser });
    } else {
      throw new ApiError(400, '用户名已存在');
    }
  } catch (error) {
    console.error('创建新用户失败:', error + '\n');
    console.error('异常堆栈:', error.stack + '\n');
    
    if (!(error instanceof ApiError)) {
      error = new ApiError(500, '创建新用户失败', error.message);
    }
    
    next(error);
  }
});

// API: 删除用户（仅管理员）
router.delete('/api/users/:userId', authMiddleware.verifyToken, authMiddleware.checkAdmin, async (req, res, next) => {
  try {
    const { userId } = req.params;
    const userIdInt = parseInt(userId);
    
    if (isNaN(userIdInt)) {
      throw new ApiError(400, '无效的用户ID');
    }
    
    // 获取当前管理员用户ID和角色
    const currentUserId = req.session.user?.id || req.user.userId;
    const currentUser = await db.getUserById(currentUserId);
    
    // 获取被删除用户的信息
    const targetUser = await db.getUserById(userIdInt);
    
    // 检查权限：admin可以删除任何用户，普通管理员只能删除自己或自己创建的用户
    if (currentUser.roleId !== 1 && 
        (targetUser.id !== currentUserId && targetUser.createdBy !== currentUserId)) {
      throw new ApiError(403, '没有权限删除该用户');
    }
    
    if (await db.deleteUser(userIdInt)) {
      res.json({ success: true, message: '用户删除成功' });
    } else {
      throw new ApiError(404, '用户不存在');
    }
  } catch (error) {
    console.error(`删除用户${userId}失败:`, error + '\n');
    console.error('异常堆栈:', error.stack + '\n');
    
    if (!(error instanceof ApiError)) {
      error = new ApiError(500, '删除用户失败', error.message);
    }
    
    next(error);
  }
});

// API: 更新用户角色（仅管理员）
router.put('/api/users/:userId/role', authMiddleware.verifyToken, authMiddleware.checkAdmin, async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { roleId } = req.body;
    const userIdInt = parseInt(userId);
    const roleIdInt = parseInt(roleId);
    
    if (isNaN(userIdInt) || isNaN(roleIdInt)) {
      throw new ApiError(400, '无效的用户ID或角色ID');
    }
    
    // 获取当前管理员用户ID和角色
    const currentUserId = req.session.user?.id || req.user.userId;
    const currentUser = await db.getUserById(currentUserId);
    
    // 获取被操作用户的信息
    const targetUser = await db.getUserById(userIdInt);
    
    // 检查权限：admin可以操作任何用户，普通管理员只能操作自己或自己创建的用户
    if (currentUser.roleId !== 1 && 
        (targetUser.id !== currentUserId && targetUser.createdBy !== currentUserId)) {
      throw new ApiError(403, '没有权限修改该用户的角色');
    }
    
    // 限制普通管理员只能将用户角色在开发者（3）和普通管理员（2）之间转换
    if (currentUser.roleId === 2) {
      if (roleIdInt === 1) {
        throw new ApiError(403, '普通管理员不能创建超级管理员');
      }
    }
    
    // 当超级管理员将普通用户转换为普通管理员时，设置createdBy为超级管理员ID
    if (currentUser.roleId === 1 && targetUser.roleId === 3 && roleIdInt === 2) {
      // 执行角色更新，并同时更新createdBy
      const users = await db.getAllUsers();
      const userIndex = users.findIndex(user => user.id === userIdInt);
      if (userIndex !== -1) {
        // 先更新角色
        await db.updateUserRole(userIdInt, roleIdInt);
        // 再更新createdBy
        await db.updateUserCreatedBy(userIdInt, currentUserId);
        res.json({ success: true, message: '用户角色更新成功' });
        return;
      }
    }
    
    // 执行普通角色更新
    if (await db.updateUserRole(userIdInt, roleIdInt)) {
      res.json({ success: true, message: '用户角色更新成功' });
    } else {
      throw new ApiError(404, '用户不存在');
    }
  } catch (error) {
    console.error(`更新用户${userId}角色失败:`, error + '\n');
    console.error('异常堆栈:', error.stack + '\n');
    
    if (!(error instanceof ApiError)) {
      error = new ApiError(500, '更新用户角色失败', error.message);
    }
    
    next(error);
  }
});

// API: 更新用户的上级管理员（仅超级管理员）
router.put('/api/users/:userId/createdBy', authMiddleware.verifyToken, authMiddleware.checkAdmin, async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { createdBy } = req.body;
    const userIdInt = parseInt(userId);
    const createdByInt = parseInt(createdBy);
    
    if (isNaN(userIdInt) || isNaN(createdByInt)) {
      throw new ApiError(400, '无效的用户ID或上级管理员ID');
    }
    
    // 获取当前管理员用户ID和角色
    const currentUserId = req.session.user?.id || req.user.userId;
    const currentUser = await db.getUserById(currentUserId);
    
    // 只有超级管理员可以修改用户的上级管理员
    if (currentUser.roleId !== 1) {
      throw new ApiError(403, '只有超级管理员可以修改用户的上级管理员');
    }
    
    // 检查被操作用户是否存在
    const targetUser = await db.getUserById(userIdInt);
    if (!targetUser) {
      throw new ApiError(404, '用户不存在');
    }
    
    // 检查被操作用户是否为普通用户
    if (targetUser.roleId !== 3) {
      throw new ApiError(400, '只有普通用户可以设置上级管理员');
    }
    
    // 检查指定的上级管理员是否存在且为普通管理员
    const parentAdmin = await db.getUserById(createdByInt);
    if (!parentAdmin || parentAdmin.roleId !== 2) {
      throw new ApiError(400, '指定的上级管理员无效');
    }
    
    // 执行更新
    if (await db.updateUserCreatedBy(userIdInt, createdByInt)) {
      res.json({ success: true, message: '用户上级管理员更新成功' });
    } else {
      throw new ApiError(500, '用户上级管理员更新失败');
    }
  } catch (error) {
    console.error(`更新用户${userId}上级管理员失败:`, error + '\n');
    console.error('异常堆栈:', error.stack + '\n');
    
    if (!(error instanceof ApiError)) {
      error = new ApiError(500, '更新用户上级管理员失败', error.message);
    }
    
    next(error);
  }
});

// API: 用户修改自己的密码
router.put('/api/users/self/password', authMiddleware.verifyToken, async (req, res, next) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const userId = req.session.user?.id || req.user.userId;
    const user = await db.getUserById(userId);
    
    if (!user || !(await bcrypt.compare(oldPassword, user.password))) {
      throw new ApiError(400, '原密码错误');
    }
    
    if (!newPassword) {
      throw new ApiError(400, '新密码不能为空');
    }
    
    // 使用bcrypt加密新密码
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    if (await db.updateUserPassword(userId, hashedPassword)) {
      res.json({ success: true, message: '密码修改成功' });
    } else {
      throw new ApiError(500, '密码修改失败');
    }
  } catch (error) {
    console.error('修改密码失败:', error + '\n');
    console.error('异常堆栈:', error.stack + '\n');
    
    if (!(error instanceof ApiError)) {
      error = new ApiError(500, '修改密码失败', error.message);
    }
    
    next(error);
  }
});

// API: 管理员修改用户密码（仅管理员）
router.put('/api/users/:userId/password', authMiddleware.verifyToken, authMiddleware.checkAdmin, async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { newPassword } = req.body;
    const userIdInt = parseInt(userId);
    
    if (isNaN(userIdInt) || !newPassword) {
      throw new ApiError(400, '无效的用户ID或密码');
    }
    
    // 获取当前管理员用户ID和角色
    const currentUserId = req.session.user?.id || req.user.userId;
    const currentUser = await db.getUserById(currentUserId);
    
    // 获取被操作用户的信息
    const targetUser = await db.getUserById(userIdInt);
    
    // 检查权限：admin可以操作任何用户，普通管理员只能操作自己或自己创建的用户
    if (currentUser.roleId !== 1 && 
        (targetUser.id !== currentUserId && targetUser.createdBy !== currentUserId)) {
      throw new ApiError(403, '没有权限修改该用户的密码');
    }
    
    // 使用bcrypt加密密码
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    if (await db.updateUserPassword(userIdInt, hashedPassword)) {
      res.json({ success: true, message: '密码修改成功' });
    } else {
      throw new ApiError(404, '用户不存在');
    }
  } catch (error) {
    console.error(`管理员修改用户${userId}密码失败:`, error + '\n');
    console.error('异常堆栈:', error.stack + '\n');
    
    if (!(error instanceof ApiError)) {
      error = new ApiError(500, '修改密码失败', error.message);
    }
    
    next(error);
  }
});

// API: 获取所有角色
router.get('/api/roles', authMiddleware.verifyToken, async (req, res, next) => {
  try {
    const roles = await db.getAllRoles();
    res.json(roles);
  } catch (error) {
    console.error('获取所有角色失败:', error + '\n');
    console.error('异常堆栈:', error.stack + '\n');
    
    if (!(error instanceof ApiError)) {
      error = new ApiError(500, '获取所有角色失败', error.message);
    }
    
    next(error);
  }
});

// API: 获取用户项目权限列表
router.get('/api/users/:userId/project-permissions', authMiddleware.verifyToken, async (req, res, next) => {
  try {
    const { userId } = req.params;
    const userIdInt = parseInt(userId);
    
    if (isNaN(userIdInt)) {
      throw new ApiError(400, '无效的用户ID');
    }
    
    // 获取当前用户和被查询用户的信息
    const currentUserId = req.session.user?.id || req.user.userId;
    const currentUser = await db.getUserById(currentUserId);
    const targetUser = await db.getUserById(userIdInt);
    
    // 检查权限：
    // 1. 用户本人可以查看自己的权限
    // 2. admin可以查看任何用户的权限
    // 3. 普通管理员只能查看自己或自己创建的用户的权限
    if (currentUserId !== userIdInt && currentUser.roleId !== 1) {
      if (currentUser.roleId === 2 && 
          (targetUser.id !== currentUserId && targetUser.createdBy !== currentUserId)) {
        throw new ApiError(403, '没有权限访问此资源');
      }
      throw new ApiError(403, '没有权限访问此资源');
    }
    
    const userProjectPermissions = (await db.getAllUserProjectPermissions())
      .filter(perm => perm.userId === userIdInt)
      .map(perm => ({ projectId: perm.projectId }));
    
    res.json(userProjectPermissions);
  } catch (error) {
    console.error(`获取用户${userId}项目权限列表失败:`, error + '\n');
    console.error('异常堆栈:', error.stack + '\n');
    
    if (!(error instanceof ApiError)) {
      error = new ApiError(500, '获取用户项目权限列表失败', error.message);
    }
    
    next(error);
  }
});

// API: 为用户添加项目权限（仅管理员）
router.post('/api/users/:userId/project-permissions', authMiddleware.verifyToken, authMiddleware.checkAdmin, authMiddleware.checkAdminProjectPermission, async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { projectId } = req.body;
    const userIdInt = parseInt(userId);
    const projectIdInt = parseInt(projectId);
    
    if (isNaN(userIdInt) || isNaN(projectIdInt)) {
      throw new ApiError(400, '无效的用户ID或项目ID');
    }
    
    // 获取当前管理员用户ID和角色
    const currentUserId = req.session.user?.id || req.user.userId;
    const currentUser = await db.getUserById(currentUserId);
    
    // 检查被操作的用户是否为admin
    const targetUser = await db.getUserById(userIdInt);
    if (targetUser && targetUser.username === 'admin') {
      throw new ApiError(403, 'admin用户的项目权限不可修改');
    }
    
    // 检查权限：admin可以操作任何用户，普通管理员只能操作自己或自己创建的用户
    if (currentUser.roleId !== 1 && 
        (targetUser.id !== currentUserId && targetUser.createdBy !== currentUserId)) {
      throw new ApiError(403, '没有权限为该用户添加项目权限');
    }
    
    if (await db.addUserProjectPermission(userIdInt, projectIdInt)) {
      res.json({ success: true, message: '项目权限添加成功' });
    } else {
      throw new ApiError(500, '项目权限添加失败');
    }
  } catch (error) {
    console.error(`为用户${userId}添加项目权限失败:`, error + '\n');
    console.error('异常堆栈:', error.stack + '\n');
    
    if (!(error instanceof ApiError)) {
      error = new ApiError(500, '为用户添加项目权限失败', error.message);
    }
    
    next(error);
  }
});

// API: 移除用户的项目权限（仅管理员）
router.delete('/api/users/:userId/project-permissions/:projectId', authMiddleware.verifyToken, authMiddleware.checkAdmin, authMiddleware.checkAdminProjectPermission, async (req, res, next) => {
  try {
    const { userId, projectId } = req.params;
    const userIdInt = parseInt(userId);
    const projectIdInt = parseInt(projectId);
    
    if (isNaN(userIdInt) || isNaN(projectIdInt)) {
      throw new ApiError(400, '无效的用户ID或项目ID');
    }
    
    // 获取当前管理员用户ID和角色
    const currentUserId = req.session.user?.id || req.user.userId;
    const currentUser = await db.getUserById(currentUserId);
    
    // 检查被操作的用户是否为admin
    const targetUser = await db.getUserById(userIdInt);
    if (targetUser && targetUser.username === 'admin') {
      throw new ApiError(403, 'admin用户的项目权限不可修改');
    }
    
    // 检查权限：admin可以操作任何用户，普通管理员只能操作自己或自己创建的用户
    if (currentUser.roleId !== 1 && 
        (targetUser.id !== currentUserId && targetUser.createdBy !== currentUserId)) {
      throw new ApiError(403, '没有权限移除该用户的项目权限');
    }
    
    if (await db.removeUserProjectPermission(userIdInt, projectIdInt)) {
      res.json({ success: true, message: '项目权限移除成功' });
    } else {
      throw new ApiError(500, '项目权限移除失败');
    }
  } catch (error) {
    console.error(`移除用户${userId}的项目权限失败:`, error + '\n');
    console.error('异常堆栈:', error.stack + '\n');
    
    if (!(error instanceof ApiError)) {
      error = new ApiError(500, '移除用户项目权限失败', error.message);
    }
    
    next(error);
  }
});

// API路由前缀处理
// 确保所有以/api开头的路由都返回JSON响应，不会被前端路由处理
// API路由404处理
router.use('/api', (req, res, next) => {
  if (req.path === '/api') {
    // 处理/api根路径
    res.status(200).json({ message: 'API服务运行正常' });
  } else {
    // 对于其他/api/*路径，继续处理
    next();
  }
});

// API路由404处理应该在app.js中配置，这里只处理/api相关路由
// 注意：API 404处理已移至app.js中

module.exports = router;
