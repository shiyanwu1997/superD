const express = require('express');
const router = express.Router();
const db = require('../models/db');
const authMiddleware = require('../middleware/auth');

const VALID_ACTIONS = ['start', 'stop', 'restart', 'reload'];

// API: 查询用户操作记录（仅超级管理员）
router.get('/api/operation-logs', authMiddleware.verifyToken, authMiddleware.requireScope('programs:read'), authMiddleware.checkSuperAdmin, async (req, res, next) => {
  try {
    const { page, pageSize, username, projectId, programName, action, from, to } = req.query;
    const filters = {
      page: Math.max(1, parseInt(page, 10) || 1),
      pageSize: Math.min(100, Math.max(1, parseInt(pageSize, 10) || 20)),
      username: (username || '').trim() || undefined,
      projectId: projectId || undefined,
      programName: (programName || '').trim() || undefined,
      action: VALID_ACTIONS.includes(action) ? action : undefined,
      from: from || undefined,
      to: to || undefined
    };
    const { logs, total } = await db.getOperationLogs(filters);
    res.json({ logs, total, page: filters.page, pageSize: filters.pageSize });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
