/**
 * 分组列表端点测试：
 * 新建空分组（machineCount=0）必须返回 —— 否则用户"创建成功"却在侧边栏看不到，
 * 误以为创建失败。这是原 .filter(machineCount > 0) 造成的行为。
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
  getAllGroups: jest.fn(),
  getUserProjects: jest.fn()
}));

jest.mock('../middleware/auth', () => ({
  verifyToken: (req, res, next) => {
    req.user = { userId: 1, username: 'test', roleId: req.headers['x-test-role'] ? parseInt(req.headers['x-test-role']) : 1 };
    next();
  },
  requireScope: () => (req, res, next) => next(),
  checkAdmin: (req, res, next) => next(),
  checkSuperAdmin: (req, res, next) => next()
}));

const db = require('../models/db');
const request = require('supertest');
const express = require('express');

describe('GET /api/groups', () => {
  let app;

  beforeAll(() => {
    const router = require('../routes/groups');
    app = express();
    app.use(express.json());
    app.use('/', router);
    app.use((err, req, res, next) => {
      res.status(err.statusCode || 500).json({ success: false, message: err.message, data: err.data || null });
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('空分组也返回（machineCount: 0），创建后立即可见', async () => {
    db.getAllGroups.mockResolvedValue([
      { id: 5, name: 'gfxcc-prod', description: '' },
      { id: 1, name: '生产组', description: '' }
    ]);
    db.getUserProjects.mockResolvedValue([
      { id: 7, name: 'mxcc-1', groupId: 1 }
    ]);

    const res = await request(app).get('/api/groups');

    expect(res.status).toBe(200);
    const names = res.body.map((g) => g.name);
    expect(names).toContain('生产组');
    expect(names).toContain('gfxcc-prod'); // 空分组不能被过滤掉
    const empty = res.body.find((g) => g.name === 'gfxcc-prod');
    expect(empty.machineCount).toBe(0);
  });

  test('machineCount 按该组机器数统计', async () => {
    db.getAllGroups.mockResolvedValue([{ id: 1, name: '生产组', description: '' }]);
    db.getUserProjects.mockResolvedValue([
      { id: 7, name: 'mxcc-1', groupId: 1 },
      { id: 8, name: 'mxcc-2', groupId: 1 },
      { id: 9, name: 'dev-1', groupId: 2 }
    ]);

    const res = await request(app).get('/api/groups');

    expect(res.status).toBe(200);
    expect(res.body[0].machineCount).toBe(2);
  });

  test('非超管：空分组不可见（无权限机器的分组应隐藏）', async () => {
    db.getAllGroups.mockResolvedValue([
      { id: 1, name: '生产组', description: '' },
      { id: 5, name: 'gfxcc-prod', description: '' }
    ]);
    db.getUserProjects.mockResolvedValue([
      { id: 6, name: 'mxcc-1', groupId: 1 },
      { id: 7, name: 'mxcc-2', groupId: 1 }
    ]);

    const res = await request(app).get('/api/groups').set('x-test-role', '2'); // jess: subadmin

    expect(res.status).toBe(200);
    const names = res.body.map((g) => g.name);
    expect(names).toContain('生产组');
    expect(names).not.toContain('gfxcc-prod');
  });

  test('超管：空分组可见（便于管理，创建后立即可见）', async () => {
    db.getAllGroups.mockResolvedValue([
      { id: 1, name: '生产组', description: '' },
      { id: 5, name: 'gfxcc-prod', description: '' }
    ]);
    db.getUserProjects.mockResolvedValue([
      { id: 6, name: 'mxcc-1', groupId: 1 }
    ]);

    const res = await request(app).get('/api/groups').set('x-test-role', '1'); // admin

    expect(res.status).toBe(200);
    const names = res.body.map((g) => g.name);
    expect(names).toContain('gfxcc-prod');
    expect(res.body.find((g) => g.name === 'gfxcc-prod').machineCount).toBe(0);
  });
});
