const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const path = require('path');
const db = require('../models/db');
const authMiddleware = require('../middleware/auth');
const supervisorService = require('../services/supervisorService');

// 根路径返回API信息
router.get('/', (req, res) => {
  res.json({ message: 'Supervisor API Server is running', version: '1.0.0' });
});

// 处理登录请求
router.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  console.log('登录请求：', { username, password } + '\n');
  
  const user = await db.getUserByUsername(username);
  console.log('获取到的用户信息：', user + '\n');
  
  // 使用bcrypt验证密码
  if (user && password && user.password) {
    const isMatch = await bcrypt.compare(password, user.password);
    console.log('密码匹配结果：', isMatch + '\n');
    
    if (isMatch) {
      // 生成 JWT 令牌
      const token = authMiddleware.generateToken(user);
      // 将令牌存储在 session 中
      req.session.token = token;
      req.session.user = user;
      
      // 始终返回 JSON 响应，由前端处理路由导航
      // 添加缓存控制头，防止浏览器缓存登录响应
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
      res.json({ success: true, message: '登录成功', token: token });
    } else {
      // 添加缓存控制头，防止浏览器缓存错误响应
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
      res.json({ success: false, error: '用户名或密码错误' });
    }
  } else {
    console.log('登录失败原因：', { userExists: !!user, passwordProvided: !!password, userHasPassword: !!user?.password } + '\n');
    // 添加缓存控制头，防止浏览器缓存错误响应
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.json({ success: false, error: '用户名或密码错误' });
  }
});

// 退出登录
router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

// API: 获取用户信息
router.get('/api/user', authMiddleware.verifyToken, (req, res) => {
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
});

// API: 获取用户可访问的项目列表
router.get('/api/projects', authMiddleware.verifyToken, async (req, res) => {
  const userId = req.session.user?.id || req.user.userId;
  const projects = await db.getUserProjects(userId);
  
  // 为每个项目添加连接状态
  const projectsWithStatus = await Promise.all(projects.map(async (project) => {
    const connectionStatus = await supervisorService.checkConnectionStatus(project.id);
    return {
      ...project,
      connectionStatus
    };
  }));
  
  res.json(projectsWithStatus);
});

// API: 创建新项目（仅管理员）
router.post('/api/projects', authMiddleware.verifyToken, authMiddleware.checkAdmin, async (req, res) => {
  const { name, description, host, port, username, password } = req.body;
  
  // 验证必填字段
  if (!name || !host || !port) {
    return res.status(400).json({ error: '项目名称、主机和端口不能为空' });
  }
  
  // 创建新项目
  const newProject = await db.createProject(name, description || '', host, parseInt(port), username || '', password || '');
  
  if (!newProject) {
    return res.status(400).json({ error: '项目名称已存在' });
  }
  
  res.status(201).json(newProject);
});

// API: 更新项目（仅管理员）
router.put('/api/projects/:id', authMiddleware.verifyToken, authMiddleware.checkAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, description, host, port, username, password } = req.body;
  
  // 验证必填字段
  if (!name || !host || !port) {
    return res.status(400).json({ error: '项目名称、主机和端口不能为空' });
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
    return res.status(400).json({ error: '项目不存在或名称已存在' });
  }
  
  res.json(updatedProject);
});

// API: 删除项目（仅管理员）
router.delete('/api/projects/:id', authMiddleware.verifyToken, authMiddleware.checkAdmin, async (req, res) => {
  const { id } = req.params;
  
  // 删除项目
  const success = await db.deleteProject(parseInt(id));
  
  if (success) {
    res.json({ success: true, message: '项目删除成功' });
  } else {
    res.status(404).json({ error: '项目不存在' });
  }
});

// API: 获取项目下的程序列表
router.get('/api/projects/:projectId/programs', authMiddleware.verifyToken, async (req, res) => {
  const { projectId } = req.params;
  const userId = req.session.user?.id || req.user.userId;
  
  // 检查用户是否有该项目的权限
  if (!(await db.checkUserProjectPermission(userId, parseInt(projectId)))) {
    return res.status(403).json({ error: '没有权限访问此项目' });
  }
  
  try {
    // 直接从Supervisor获取程序列表
    const processes = await supervisorService.getAllProcesses(parseInt(projectId));
    
    // 为每个程序添加基本信息
    const programsWithStatus = processes.map(process => {
      return {
        id: `${projectId}-${process.name}`, // 使用项目ID和程序名作为唯一标识
        name: process.name,
        projectId: parseInt(projectId),
        status: process.statename || process.description,
        state: process.state,
        description: `Supervisor程序: ${process.name}`
      };
    });
    
    res.json(programsWithStatus);
  } catch (error) {
      console.error('获取程序列表失败:', error + '\n');
      res.status(500).json({ error: error.message });
    }
});

// API: 获取程序列表
router.get('/api/programs', authMiddleware.verifyToken, async (req, res) => {
  const userId = req.session.user?.id || req.user.userId;
  const userProjects = await db.getUserProjects(userId);
  
  try {
    // 为每个项目获取程序列表
    const allPrograms = [];
    for (const project of userProjects) {
      try {
        const processes = await supervisorService.getAllProcesses(project.id);
        
        // 为每个程序添加基本信息
        const projectPrograms = processes.map(process => {
          return {
            id: `${project.id}-${process.name}`, // 使用项目ID和程序名作为唯一标识
            name: process.name,
            projectId: project.id,
            status: process.statename || process.description,
            state: process.state,
            description: `Supervisor程序: ${process.name}`,
            projectName: project.name
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
    res.status(500).json({ error: error.message });
  }
});

// API: 获取程序详情
router.get('/api/programs/:programId', authMiddleware.verifyToken, async (req, res) => {
  const { programId } = req.params;
  const userId = req.session.user?.id || req.user.userId;
  
  // 解析动态生成的程序ID (格式: ${projectId}-${programName})
  const [projectId, programName] = programId.split('-');
  
  if (!projectId || !programName) {
    return res.status(400).json({ error: '无效的程序ID格式' });
  }
  
  const projectIdInt = parseInt(projectId);
  
  // 检查用户是否有该项目的权限
  if (!(await db.checkUserProjectPermission(userId, projectIdInt))) {
    return res.status(403).json({ error: '没有权限访问此程序' });
  }
  
  try {
    // 获取程序状态
    const processes = await supervisorService.getAllProcesses(projectIdInt);
    const process = processes.find(p => p.name === programName);
    
    if (!process) {
      return res.status(404).json({ error: '程序不存在' });
    }
    
    // 构建程序信息
    const program = {
      id: programId,
      name: programName,
      projectId: projectIdInt,
      status: process.statename || process.description,
      state: process.state,
      description: `Supervisor程序: ${programName}`
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
    res.status(500).json({ error: '服务器错误: ' + error.message });
  }
});

// API: 获取程序标准输出日志
router.get('/api/programs/:programId/stdout', authMiddleware.verifyToken, async (req, res) => {
  const { programId } = req.params;
  const { offset = 0, length = 100000 } = req.query;
  const userId = req.session.user?.id || req.user.userId;
  
  // 解析动态生成的程序ID (格式: ${projectId}-${programName})
  const [projectId, programName] = programId.split('-');
  
  if (!projectId || !programName) {
    return res.status(400).json({ error: '无效的程序ID格式' });
  }
  
  const projectIdInt = parseInt(projectId);
  
  // 检查用户是否有该项目的权限
  if (!(await db.checkUserProjectPermission(userId, projectIdInt))) {
    return res.status(403).json({ error: '没有权限访问此程序' });
  }
  
  try {
    const stdout = await supervisorService.getProcessStdoutLog(projectIdInt, programName, parseInt(offset), parseInt(length));
    res.json({ stdout });
  } catch (error) {
    console.error('获取标准输出日志失败:', error + '\n');
    res.status(500).json({ error: '服务器错误: ' + error.message });
  }
});

// API: 获取程序标准错误日志
router.get('/api/programs/:programId/stderr', authMiddleware.verifyToken, async (req, res) => {
  const { programId } = req.params;
  const { offset = 0, length = 100000 } = req.query;
  const userId = req.session.user?.id || req.user.userId;
  
  // 解析动态生成的程序ID (格式: ${projectId}-${programName})
  const [projectId, programName] = programId.split('-');
  
  if (!projectId || !programName) {
    return res.status(400).json({ error: '无效的程序ID格式' });
  }
  
  const projectIdInt = parseInt(projectId);
  
  // 检查用户是否有该项目的权限
  if (!(await db.checkUserProjectPermission(userId, projectIdInt))) {
    return res.status(403).json({ error: '没有权限访问此程序' });
  }
  
  try {
    const stderr = await supervisorService.getProcessStderrLog(projectIdInt, programName, parseInt(offset), parseInt(length));
    res.json({ stderr });
  } catch (error) {
    console.error('获取标准错误日志失败:', error + '\n');
    res.status(500).json({ error: '服务器错误: ' + error.message });
  }
});

// API: 启动所有程序
router.post('/api/projects/:projectId/programs/start-all', authMiddleware.verifyToken, async (req, res) => {
  const { projectId } = req.params;
  const userId = req.session.user?.id || req.user.userId;
  
  const projectIdInt = parseInt(projectId);
  
  // 检查用户是否有该项目的权限
  if (!(await db.checkUserProjectPermission(userId, projectIdInt))) {
    return res.status(403).json({ error: '没有权限访问此项目' });
  }
  
  try {
    const result = await supervisorService.startAllProcesses(projectIdInt);
    res.json(result);
  } catch (error) {
    console.error('启动所有程序失败:', error + '\n');
    res.status(500).json({ error: '服务器错误: ' + error.message });
  }
});

// API: 停止所有程序
router.post('/api/projects/:projectId/programs/stop-all', authMiddleware.verifyToken, async (req, res) => {
  const { projectId } = req.params;
  const userId = req.session.user?.id || req.user.userId;
  
  const projectIdInt = parseInt(projectId);
  
  // 检查用户是否有该项目的权限
  if (!(await db.checkUserProjectPermission(userId, projectIdInt))) {
    return res.status(403).json({ error: '没有权限访问此项目' });
  }
  
  try {
    const result = await supervisorService.stopAllProcesses(projectIdInt);
    res.json(result);
  } catch (error) {
    console.error('停止所有程序失败:', error + '\n');
    res.status(500).json({ error: '服务器错误: ' + error.message });
  }
});

// API: 重启所有程序
router.post('/api/projects/:projectId/programs/restart-all', authMiddleware.verifyToken, async (req, res) => {
  const { projectId } = req.params;
  const userId = req.session.user?.id || req.user.userId;
  
  const projectIdInt = parseInt(projectId);
  
  // 检查用户是否有该项目的权限
  if (!(await db.checkUserProjectPermission(userId, projectIdInt))) {
    return res.status(403).json({ error: '没有权限访问此项目' });
  }
  
  try {
    const result = await supervisorService.restartAllProcesses(projectIdInt);
    res.json(result);
  } catch (error) {
    console.error('重启所有程序失败:', error + '\n');
    res.status(500).json({ error: '服务器错误: ' + error.message });
  }
});

// API: 启动程序
router.post('/api/programs/:programId/start', authMiddleware.verifyToken, async (req, res) => {
  const { programId } = req.params;
  const userId = req.session.user?.id || req.user.userId;
  
  // 解析动态生成的程序ID (格式: ${projectId}-${programName})
  const [projectId, programName] = programId.split('-');
  
  if (!projectId || !programName) {
    return res.status(400).json({ error: '无效的程序ID格式' });
  }
  
  const projectIdInt = parseInt(projectId);
  
  // 检查用户是否有该项目的权限
  if (!(await db.checkUserProjectPermission(userId, projectIdInt))) {
    return res.status(403).json({ error: '没有权限重启所有程序' });
  }
  
  try {
    await supervisorService.startProcess(projectIdInt, programName);
    res.json({ success: true, message: `程序 ${programName} 已成功启动` });
  } catch (error) {
    console.error('启动程序失败:', error + '\n');
    res.json({ success: false, message: `启动程序 ${programName} 失败: ${error.message}` });
  }
});

// API: 停止程序
router.post('/api/programs/:programId/stop', authMiddleware.verifyToken, async (req, res) => {
  const { programId } = req.params;
  const userId = req.session.user?.id || req.user.userId;
  
  // 解析动态生成的程序ID (格式: ${projectId}-${programName})
  const [projectId, programName] = programId.split('-');
  
  if (!projectId || !programName) {
    return res.status(400).json({ error: '无效的程序ID格式' });
  }
  
  const projectIdInt = parseInt(projectId);
  
  // 检查用户是否有该项目的权限
  if (!(await db.checkUserProjectPermission(userId, projectIdInt))) {
    return res.status(403).json({ error: '没有权限操作此程序' });
  }
  
  try {
    await supervisorService.stopProcess(projectIdInt, programName);
    res.json({ success: true, message: `程序 ${programName} 已成功停止` });
  } catch (error) {
    console.error('停止程序失败:', error + '\n');
    res.json({ success: false, message: `停止程序 ${programName} 失败: ${error.message}` });
  }
});

// API: 重启程序
router.post('/api/programs/:programId/restart', authMiddleware.verifyToken, async (req, res) => {
  const { programId } = req.params;
  const userId = req.session.user?.id || req.user.userId;
  
  // 解析动态生成的程序ID (格式: ${projectId}-${programName})
  const [projectId, programName] = programId.split('-');
  
  if (!projectId || !programName) {
    return res.status(400).json({ error: '无效的程序ID格式' });
  }
  
  const projectIdInt = parseInt(projectId);
  
  // 检查用户是否有该项目的权限
  if (!(await db.checkUserProjectPermission(userId, projectIdInt))) {
    return res.status(403).json({ error: '没有权限停止所有程序' });
  }
  
  try {
    await supervisorService.restartProcess(projectIdInt, programName);
    res.json({ success: true, message: `程序 ${programName} 已成功重启` });
  } catch (error) {
    console.error('重启程序失败:', error + '\n');
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
  if (currentUser.roleId !== 1) {
    // 普通用户，不能查看任何用户信息
    return res.json([]);
  } else if (currentUser.username === 'admin') {
    // admin用户，查看所有用户
    users = await db.getAllUsers();
  } else {
    // 普通管理员，只能查看自己创建的用户
    const allUsers = await db.getAllUsers();
    users = allUsers.filter(user => user.createdBy === currentUserId);
  }
  
  const roles = await db.getAllRoles();
  const userProjectPermissions = await db.getAllUserProjectPermissions();
  
  // 为每个用户添加角色信息和项目权限
  const usersWithRoles = users.map(user => {
    const role = roles.find(r => r.id === user.roleId);
    // 获取用户的项目权限
    const permissions = userProjectPermissions
      .filter(perm => perm.userId === user.id)
      .map(perm => ({ projectId: perm.projectId }));
    return {
      ...user,
      roleName: role ? role.name : '未知角色',
      projectPermissions: permissions
    };
  });
  
  res.json(usersWithRoles);
});

// API: 创建新用户（仅管理员）
router.post('/api/users', authMiddleware.verifyToken, authMiddleware.checkAdmin, async (req, res) => {
  const { username, password, roleId } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: '用户名和密码不能为空' });
  }
  
  // 获取当前管理员用户ID
  const currentUserId = req.session.user?.id || req.user.userId;
  
  // 使用bcrypt加密密码
  const hashedPassword = await bcrypt.hash(password, 10);
  
  const newUser = await db.createUser(username, hashedPassword, roleId, currentUserId);
  
  if (newUser) {
    res.json({ success: true, message: '用户创建成功', user: newUser });
  } else {
    res.status(400).json({ error: '用户名已存在' });
  }
});

// API: 删除用户（仅管理员）
router.delete('/api/users/:userId', authMiddleware.verifyToken, authMiddleware.checkAdmin, async (req, res) => {
  const { userId } = req.params;
  const userIdInt = parseInt(userId);
  
  if (isNaN(userIdInt)) {
    return res.status(400).json({ error: '无效的用户ID' });
  }
  
  if (await db.deleteUser(userIdInt)) {
    res.json({ success: true, message: '用户删除成功' });
  } else {
    res.status(404).json({ error: '用户不存在' });
  }
});

// API: 更新用户角色（仅管理员）
router.put('/api/users/:userId/role', authMiddleware.verifyToken, authMiddleware.checkAdmin, async (req, res) => {
  const { userId } = req.params;
  const { roleId } = req.body;
  const userIdInt = parseInt(userId);
  const roleIdInt = parseInt(roleId);
  
  if (isNaN(userIdInt) || isNaN(roleIdInt)) {
    return res.status(400).json({ error: '无效的用户ID或角色ID' });
  }
  
  if (await db.updateUserRole(userIdInt, roleIdInt)) {
    res.json({ success: true, message: '用户角色更新成功' });
  } else {
    res.status(404).json({ error: '用户不存在' });
  }
});

// API: 用户修改自己的密码
router.put('/api/users/self/password', authMiddleware.verifyToken, async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  const userId = req.session.user?.id || req.user.userId;
  const user = await db.getUserById(userId);
  
  if (!user || !(await bcrypt.compare(oldPassword, user.password))) {
    return res.status(400).json({ error: '原密码错误' });
  }
  
  if (!newPassword) {
    return res.status(400).json({ error: '新密码不能为空' });
  }
  
  // 使用bcrypt加密新密码
  const hashedPassword = await bcrypt.hash(newPassword, 10);
  if (await db.updateUserPassword(userId, hashedPassword)) {
    res.json({ success: true, message: '密码修改成功' });
  } else {
    res.status(500).json({ error: '密码修改失败' });
  }
});

// API: 管理员修改用户密码（仅管理员）
router.put('/api/users/:userId/password', authMiddleware.verifyToken, authMiddleware.checkAdmin, async (req, res) => {
  const { userId } = req.params;
  const { newPassword } = req.body;
  const userIdInt = parseInt(userId);
  
  if (isNaN(userIdInt) || !newPassword) {
    return res.status(400).json({ error: '无效的用户ID或密码' });
  }
  
  // 使用bcrypt加密密码
  const hashedPassword = await bcrypt.hash(newPassword, 10);
  if (await db.updateUserPassword(userIdInt, hashedPassword)) {
    res.json({ success: true, message: '密码修改成功' });
  } else {
    res.status(404).json({ error: '用户不存在' });
  }
});

// API: 获取所有角色
router.get('/api/roles', authMiddleware.verifyToken, async (req, res) => {
  const roles = await db.getAllRoles();
  res.json(roles);
});

// API: 获取用户项目权限列表
router.get('/api/users/:userId/project-permissions', authMiddleware.verifyToken, async (req, res) => {
  const { userId } = req.params;
  const userIdInt = parseInt(userId);
  
  if (isNaN(userIdInt)) {
    return res.status(400).json({ error: '无效的用户ID' });
  }
  
  // 检查当前用户是否为管理员或要查询的用户本人
  const currentUserId = req.session.user?.id || req.user.userId;
  if (currentUserId !== userIdInt && req.user.roleId !== 1) {
    return res.status(403).json({ error: '没有权限访问此资源' });
  }
  
  const userProjectPermissions = (await db.getAllUserProjectPermissions())
    .filter(perm => perm.userId === userIdInt)
    .map(perm => ({ projectId: perm.projectId }));
  
  res.json(userProjectPermissions);
});

// API: 为用户添加项目权限（仅管理员）
router.post('/api/users/:userId/project-permissions', authMiddleware.verifyToken, authMiddleware.checkAdmin, authMiddleware.checkAdminProjectPermission, async (req, res) => {
  const { userId } = req.params;
  const { projectId } = req.body;
  const userIdInt = parseInt(userId);
  const projectIdInt = parseInt(projectId);
  
  if (isNaN(userIdInt) || isNaN(projectIdInt)) {
    return res.status(400).json({ error: '无效的用户ID或项目ID' });
  }
  
  // 检查被操作的用户是否为admin
  const user = await db.getUserById(userIdInt);
  if (user && user.username === 'admin') {
    return res.status(403).json({ error: 'admin用户的项目权限不可修改' });
  }
  
  if (await db.addUserProjectPermission(userIdInt, projectIdInt)) {
    res.json({ success: true, message: '项目权限添加成功' });
  } else {
    res.status(500).json({ error: '项目权限添加失败' });
  }
});

// API: 移除用户的项目权限（仅管理员）
router.delete('/api/users/:userId/project-permissions/:projectId', authMiddleware.verifyToken, authMiddleware.checkAdmin, authMiddleware.checkAdminProjectPermission, async (req, res) => {
  const { userId, projectId } = req.params;
  const userIdInt = parseInt(userId);
  const projectIdInt = parseInt(projectId);
  
  if (isNaN(userIdInt) || isNaN(projectIdInt)) {
    return res.status(400).json({ error: '无效的用户ID或项目ID' });
  }
  
  // 检查被操作的用户是否为admin
  const user = await db.getUserById(userIdInt);
  if (user && user.username === 'admin') {
    return res.status(403).json({ error: 'admin用户的项目权限不可修改' });
  }
  
  if (await db.removeUserProjectPermission(userIdInt, projectIdInt)) {
    res.json({ success: true, message: '项目权限移除成功' });
  } else {
    res.status(500).json({ error: '项目权限移除失败' });
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
