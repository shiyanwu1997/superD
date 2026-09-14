const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const rateLimit = require('express-rate-limit');
const db = require('../models/db');
const authMiddleware = require('../middleware/auth');
const { ApiError } = require('../utils/errors');
const { SERVER_CONFIG, SECURITY_CONFIG } = require('../config');

// 登录接口速率限制: 同一IP每分钟最多5次尝试
const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { success: false, message: '登录尝试过于频繁，请稍后再试' },
  standardHeaders: true,
  legacyHeaders: false,
});

// 注册接口速率限制: 同一IP每分钟最多3次
const registerLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 3,
  message: { success: false, message: '注册尝试过于频繁，请稍后再试' },
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

    if (user.status === 'pending') {
      throw new ApiError(403, '账号待审核，请联系管理员');
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

// API: 查询注册功能是否开放（无鉴权，供登录页决定是否显示注册入口）
router.get('/api/registration/status', (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.json({ success: true, enabled: SERVER_CONFIG.REGISTRATION_ENABLED === true });
});

// API: 用户注册（创建待审核账号，需超级管理员审核通过后才能登录）
router.post('/api/register', registerLimiter, async (req, res, next) => {
  try {
    if (SERVER_CONFIG.REGISTRATION_ENABLED !== true) {
      throw new ApiError(403, '注册功能未开放');
    }

    const { username, password } = req.body;

    if (!username || !password) {
      throw new ApiError(400, '用户名和密码不能为空');
    }

    if (!/^[a-zA-Z0-9_\-]{3,50}$/.test(username)) {
      throw new ApiError(400, '用户名需为3-50位字母、数字、下划线或连字符');
    }

    if (password.length < SECURITY_CONFIG.PASSWORD_MIN_LENGTH || password.length > 72) {
      throw new ApiError(400, `密码长度需在 ${SECURITY_CONFIG.PASSWORD_MIN_LENGTH}-72 位之间`);
    }

    const existing = await db.getUserByUsername(username);
    if (existing) {
      throw new ApiError(409, '用户名已被使用');
    }

    const hashedPassword = await bcrypt.hash(password, SECURITY_CONFIG.BCRYPT_ROUNDS);
    const newUser = await db.createUser(username, hashedPassword, 3, null, 'pending');
    if (!newUser) {
      throw new ApiError(409, '用户名已被使用');
    }

    res.status(201).json({ success: true, message: '注册申请已提交，请等待管理员审核' });
  } catch (error) {
    if (error instanceof ApiError) {
      next(error);
    } else {
      next(new ApiError(500, '服务器内部错误', error.message));
    }
  }
});

module.exports = router;
