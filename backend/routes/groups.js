const express = require('express');
const router = express.Router();
const db = require('../models/db');
const authMiddleware = require('../middleware/auth');
const { ApiError } = require('../utils/errors');

// 获取所有分组
router.get('/api/groups', authMiddleware.verifyToken, async (req, res, next) => {
  try {
    const groups = await db.getAllGroups();
    const allProjects = await db.getAllProjects();
    const result = groups.map(g => ({
      ...g,
      machineCount: allProjects.filter(p => p.groupId === g.id).length
    }));
    res.json(result);
  } catch (error) {
    next(new ApiError(500, '获取分组列表失败', error.message));
  }
});

// 创建分组（管理员）
router.post('/api/groups', authMiddleware.verifyToken, authMiddleware.checkAdmin, async (req, res, next) => {
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
router.put('/api/groups/:id', authMiddleware.verifyToken, authMiddleware.checkAdmin, async (req, res, next) => {
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
router.delete('/api/groups/:id', authMiddleware.verifyToken, authMiddleware.checkAdmin, async (req, res, next) => {
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
router.get('/api/groups/:id/projects', authMiddleware.verifyToken, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) throw new ApiError(400, '无效的分组ID');
    const projects = await db.getProjectsByGroup(id);
    res.json(projects);
  } catch (error) {
    if (error instanceof ApiError) return next(error);
    next(new ApiError(500, '获取分组机器失败', error.message));
  }
});

// 设置机器的分组
router.put('/api/projects/:id/group', authMiddleware.verifyToken, authMiddleware.checkAdmin, async (req, res, next) => {
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
