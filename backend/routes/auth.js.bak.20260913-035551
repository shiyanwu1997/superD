const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const rateLimit = require('express-rate-limit');
const db = require('../models/db');
const authMiddleware = require('../middleware/auth');
const { ApiError } = require('../utils/errors');

// 登录接口速率限制: 同一IP每分钟最多5次尝试
const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { success: false, message: '登录尝试过于频繁，请稍后再试' },
  standardHeaders: true,
  legacyHeaders: false,
});

// 处理登录请求
router.post('/api/login', loginLimiter, async (req, res, next) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      throw new ApiError(400, '用户名和密码不能为空');
    }

    const user = await db.getUserByUsername(username);

    if (!user) {
      throw new ApiError(401, '用户名或密码错误');
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      throw new ApiError(401, '用户名或密码错误');
    }

    const token = authMiddleware.generateToken(user);

    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');

    res.json({ success: true, message: '登录成功', token: token });
  } catch (error) {
    if (error instanceof ApiError) {
      next(error);
    } else {
      next(new ApiError(500, '服务器内部错误', error.message));
    }
  }
});

// 退出登录
router.get('/logout', (req, res) => {
  req.session?.destroy(() => {});
  res.redirect('/login');
});

// API: 获取用户信息
router.get('/api/user', authMiddleware.verifyToken, async (req, res, next) => {
  try {
    res.json({
      id: req.user.userId,
      username: req.user.username,
      roleId: req.user.roleId
    });
  } catch (error) {
    if (error instanceof ApiError) {
      next(error);
    } else {
      next(new ApiError(500, '服务器内部错误', error.message));
    }
  }
});

module.exports = router;
