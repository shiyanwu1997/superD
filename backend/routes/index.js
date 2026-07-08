const express = require('express');
const router = express.Router();

// 根路径返回API信息
router.get('/', (req, res) => {
  res.json({ message: 'Supervisor API Server is running', version: '1.0.0' });
});

// 挂载子路由模块
router.use('/', require('./auth'));
router.use('/', require('./projects'));
router.use('/', require('./programs'));
router.use('/', require('./users'));
router.use('/', require('./groups'));

// API路由前缀处理
router.use('/api', (req, res, next) => {
  if (req.path === '/api') {
    res.status(200).json({ message: 'API服务运行正常' });
  } else {
    next();
  }
});

module.exports = router;
