/**
 * 项目连接状态端点测试：
 * checkConnectionStatus 永不抛错，端点不应有死代码重试循环；
 * 即使 RPC 失败也应快速返回 { connected: false }。
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
  getUserProgramPermissions: jest.fn().mockResolvedValue([]),
  getProjectById: jest.fn().mockResolvedValue({ id: 9, name: 'proj', supervisorConfig: {} })
}));

jest.mock('../services/supervisorService', () => ({
  checkConnectionStatus: jest.fn(),
  clearProcessCache: jest.fn()
}));

const db = require('../models/db');
const supervisorService = require('../services/supervisorService');
const request = require('supertest');
const express = require('express');

describe('GET /api/projects/:projectId/status', () => {
  let app;

  beforeAll(() => {
    jest.mock('../middleware/auth', () => ({
      verifyToken: (req, res, next) => {
        req.user = { userId: 1, username: 'test', roleId: 1 };
        req.session = { user: { id: 1 } };
        next();
      },
      requireScope: () => (req, res, next) => next(),
      checkAdmin: (req, res, next) => next(),
      checkSuperAdmin: (req, res, next) => next()
    }), { virtual: true });

    const router = require('../routes/projects');
    app = express();
    app.use('/', router);
    app.use((err, req, res, next) => {
      res.status(err.statusCode || 500).json({ success: false, message: err.message, data: err.data || null });
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    db.checkUserProjectPermission.mockResolvedValue(true);
    db.getProjectById.mockResolvedValue({ id: 9, name: 'proj', supervisorConfig: {} });
  });

  test('RPC失败时快速返回 connected:false（无重试退避）', async () => {
    supervisorService.checkConnectionStatus.mockResolvedValue({ connected: false, error: 'connect ECONNREFUSED' });

    const start = Date.now();
    const res = await request(app).get('/api/projects/9/status');
    const elapsed = Date.now() - start;

    expect(res.status).toBe(200);
    expect(res.body.connectionStatus).toEqual({ connected: false, error: 'connect ECONNREFUSED' });
    expect(supervisorService.checkConnectionStatus).toHaveBeenCalledTimes(1);
    expect(elapsed).toBeLessThan(1000);
  });

  test('checkConnectionStatus 意外抛错时不重试，单次调用后返回 connected:false', async () => {
    supervisorService.checkConnectionStatus.mockRejectedValue(new Error('unexpected'));

    const start = Date.now();
    const res = await request(app).get('/api/projects/9/status');
    const elapsed = Date.now() - start;

    expect(res.status).toBe(200);
    expect(res.body.connectionStatus.connected).toBe(false);
    expect(supervisorService.checkConnectionStatus).toHaveBeenCalledTimes(1);
    expect(elapsed).toBeLessThan(1000);
  });

  test('项目不存在返回404', async () => {
    db.getProjectById.mockResolvedValue(null);
    supervisorService.checkConnectionStatus.mockResolvedValue({ connected: true });

    const res = await request(app).get('/api/projects/8/status');

    expect(res.status).toBe(404);
    expect(supervisorService.checkConnectionStatus).not.toHaveBeenCalled();
  });
});
