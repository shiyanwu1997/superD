/**
 * 程序列表接口重试逻辑测试
 * 验证确定性错误（如项目不存在）不重试、立即失败
 */
process.env.STORAGE_TYPE = 'sqlite';
process.env.NODE_ENV = 'test';

jest.mock('../utils/logger', () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

jest.mock('../models/db', () => ({
  checkUserProjectPermission: jest.fn().mockResolvedValue(true),
  getUserProgramPermissions: jest.fn().mockResolvedValue([])
}));

jest.mock('../services/supervisorService', () => ({
  getAllProcesses: jest.fn()
}));

const db = require('../models/db');
const supervisorService = require('../services/supervisorService');

describe('GET /api/projects/:projectId/programs 重试逻辑', () => {
  let app;

  beforeAll(() => {
    jest.mock('../middleware/auth', () => ({
      verifyToken: (req, res, next) => {
        req.user = { userId: 1, username: 'test', roleId: 1 };
        req.session = { user: { id: 1 } };
        next();
      },
      requireScope: () => (req, res, next) => next(),
      checkAdmin: (req, res, next) => next()
    }), { virtual: true });

    const express = require('express');
    const router = require('../routes/programs');
    app = express();
    app.use('/', router);

    // 捕获异步错误
    app.use((err, req, res, next) => {
      res.status(err.statusCode || 500).json({
        success: false,
        message: err.message,
        data: err.data || null
      });
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    db.checkUserProjectPermission.mockResolvedValue(true);
  });

  test('项目不存在时不重试，立即失败', async () => {
    supervisorService.getAllProcesses.mockImplementation(() =>
      Promise.reject(new Error('项目不存在'))
    );

    const request = require('supertest');
    const start = Date.now();
    const response = await request(app).get('/api/projects/8/programs');
    const elapsed = Date.now() - start;

    expect(response.status).toBe(500);
    expect(supervisorService.getAllProcesses).toHaveBeenCalledTimes(1);
    expect(response.body.message).toBe('获取程序列表失败');
    expect(response.body.data).toContain('项目不存在');
    // 确定性错误应快速失败（< 1秒，而非重试等待 3 秒）
    expect(elapsed).toBeLessThan(1000);
  });

  test('Supervisor连接拒绝时重试（最多3次调用）', async () => {
    const connErr = new Error('connect ECONNREFUSED 1.2.3.4:9001');
    supervisorService.getAllProcesses.mockImplementation(() =>
      Promise.reject(connErr)
    );

    const request = require('supertest');
    const response = await request(app).get('/api/projects/8/programs');

    expect(supervisorService.getAllProcesses).toHaveBeenCalledTimes(3);
    expect(response.body.message).toBe('无法连接到Supervisor服务');
  });
});
