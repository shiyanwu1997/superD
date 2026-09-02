const express = require('express');
const router = express.Router();
const db = require('../models/db');
const authMiddleware = require('../middleware/auth');
const { ApiError } = require('../utils/errors');

function sanitizeProject(project) {
  const { supervisorConfig, ...safeProject } = project;
  return {
    ...safeProject,
    supervisorConfig: {
      host: supervisorConfig?.host || '',
      port: supervisorConfig?.port || 0
    }
  };
}

// 获取所有分组
router.get('/api/groups', authMiddleware.verifyToken, authMiddleware.requireScope('groups:read'), async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const groups = await db.getAllGroups();
    const visibleProjects = await db.getUserProjects(userId);
    // 空分组也返回：新建分组立即可见，否则"创建成功却在侧边栏看不到"
    const result = groups.map(g => ({
      ...g,
      machineCount: visibleProjects.filter(p => p.groupId === g.id).length
    }));
    res.json(result);
  } catch (error) {
    next(new ApiError(500, '获取分组列表失败', error.message));
  }
});

// 创建分组（管理员）
router.post('/api/groups', authMiddleware.verifyToken, authMiddleware.requireScope('groups:write'), authMiddleware.checkSuperAdmin, async (req, res, next) => {
  try {
    const { name, description } = req.body;
    if (!name || !name.trim()) throw new ApiError(400, '分组名称不能为空');
    const group = await db.createGroup(name.trim(), description || '');
    if (!group) throw new ApiError(400, '分组名称已存在');
    res.status(201).json(group);
  } catch (error) {
    if (error instanceof ApiError) return next(error);
    next(new ApiError(500, '创建分组失败', error.message));
  }
});

// 更新分组
router.put('/api/groups/:id', authMiddleware.verifyToken, authMiddleware.requireScope('groups:write'), authMiddleware.checkSuperAdmin, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) throw new ApiError(400, '无效的分组ID');
    const group = await db.updateGroup(id, req.body);
    if (!group) throw new ApiError(404, '分组不存在');
    res.json(group);
  } catch (error) {
    if (error instanceof ApiError) return next(error);
    next(new ApiError(500, '更新分组失败', error.message));
  }
});

// 删除分组
router.delete('/api/groups/:id', authMiddleware.verifyToken, authMiddleware.requireScope('groups:write'), authMiddleware.checkSuperAdmin, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) throw new ApiError(400, '无效的分组ID');
    await db.deleteGroup(id);
    res.json({ success: true });
  } catch (error) {
    if (error instanceof ApiError) return next(error);
    next(new ApiError(500, '删除分组失败', error.message));
  }
});

// 获取分组下的机器
router.get('/api/groups/:id/projects', authMiddleware.verifyToken, authMiddleware.requireScope('groups:read'), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) throw new ApiError(400, '无效的分组ID');
    const visibleProjects = await db.getUserProjects(req.user.userId);
    const projects = visibleProjects
      .filter(project => project.groupId === id)
      .map(sanitizeProject);
    res.json(projects);
  } catch (error) {
    if (error instanceof ApiError) return next(error);
    next(new ApiError(500, '获取分组机器失败', error.message));
  }
});

// 设置机器的分组
router.put('/api/projects/:id/group', authMiddleware.verifyToken, authMiddleware.requireScope('groups:write'), authMiddleware.checkSuperAdmin, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) throw new ApiError(400, '无效的机器ID');
    await db.setProjectGroup(id, req.body.groupId || null);
    res.json({ success: true });
  } catch (error) {
    if (error instanceof ApiError) return next(error);
    next(new ApiError(500, '设置分组失败', error.message));
  }
});

module.exports = router;
