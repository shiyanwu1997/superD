/**
 * 批量重启端点测试：
 * POST /api/programs/batch-restart 必须并行执行（Promise.allSettled），
 * 替代前端逐个串行调用导致的 30s+ 等待。
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
  checkUserSpecificProgramPermission: jest.fn()
}));

jest.mock('../services/supervisorService', () => ({
  restartProcess: jest.fn()
}));

jest.mock('../middleware/auth', () => ({
  verifyToken: (req, res, next) => {
    req.user = { userId: 1, username: 'test', roleId: 1 };
    next();
  },
  requireScope: () => (req, res, next) => next(),
  checkAdmin: (req, res, next) => next()
}));

const db = require('../models/db');
const supervisorService = require('../services/supervisorService');
const request = require('supertest');
const express = require('express');

describe('POST /api/programs/batch-restart', () => {
  let app;

  beforeAll(() => {
    const router = require('../routes/programs');
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

  test('并行执行：3 个程序总耗时 ≈ 单个耗时，而非 3 倍串行', async () => {
    db.checkUserSpecificProgramPermission.mockResolvedValue(true);
    // 每个 restartProcess 模拟 300ms（stop→1s→start 的简化）
    supervisorService.restartProcess.mockImplementation(async () => {
      await new Promise(r => setTimeout(r, 300));
      return { success: true, message: 'ok' };
    });

    const start = Date.now();
    const res = await request(app)
      .post('/api/programs/batch-restart')
      .send({ programIds: ['8-worker', '8-web', '8-cron'] });
    const elapsed = Date.now() - start;

    expect(res.status).toBe(200);
    expect(res.body.summary).toEqual({ total: 3, succeeded: 3, failed: 0 });
    // 串行至少 900ms；并行应 < 800ms（留缓冲）
    expect(elapsed).toBeLessThan(800);
  });

  test('无权限的程序跳过，其余照常执行', async () => {
    db.checkUserSpecificProgramPermission.mockImplementation(async (userId, programId) =>
      programId !== '8-secret'
    );
    supervisorService.restartProcess.mockResolvedValue({ success: true, message: 'ok' });

    const res = await request(app)
      .post('/api/programs/batch-restart')
      .send({ programIds: ['8-worker', '8-secret'] });

    expect(res.status).toBe(200);
    expect(supervisorService.restartProcess).toHaveBeenCalledTimes(1);
    expect(supervisorService.restartProcess).toHaveBeenCalledWith(8, 'worker');
    const secret = res.body.results.find(r => r.programId === '8-secret');
    expect(secret.success).toBe(false);
    expect(res.body.summary).toEqual({ total: 2, succeeded: 1, failed: 1 });
  });

  test('部分程序重启失败：summary 计数正确，其余不受影响', async () => {
    db.checkUserSpecificProgramPermission.mockResolvedValue(true);
    supervisorService.restartProcess.mockImplementation(async (_pid, name) =>
      name === 'bad' ? { success: false, message: '连接超时' } : { success: true, message: 'ok' }
    );

    const res = await request(app)
      .post('/api/programs/batch-restart')
      .send({ programIds: ['8-good', '8-bad'] });

    expect(res.status).toBe(200);
    expect(res.body.summary).toEqual({ total: 2, succeeded: 1, failed: 1 });
    const bad = res.body.results.find(r => r.programId === '8-bad');
    expect(bad.success).toBe(false);
    expect(bad.message).toContain('连接超时');
  });

  test('restartProcess 抛异常：记为失败而非 500', async () => {
    db.checkUserSpecificProgramPermission.mockResolvedValue(true);
    supervisorService.restartProcess.mockRejectedValue(new Error('XML-RPC fault'));

    const res = await request(app)
      .post('/api/programs/batch-restart')
      .send({ programIds: ['8-a'] });

    expect(res.status).toBe(200);
    expect(res.body.summary).toEqual({ total: 1, succeeded: 0, failed: 1 });
  });

  test('空数组 → 400', async () => {
    const res = await request(app)
      .post('/api/programs/batch-restart')
      .send({ programIds: [] });

    expect(res.status).toBe(400);
  });

  test('无效程序ID格式 → 该项记失败，不影响其他项', async () => {
    db.checkUserSpecificProgramPermission.mockResolvedValue(true);
    supervisorService.restartProcess.mockResolvedValue({ success: true, message: 'ok' });

    const res = await request(app)
      .post('/api/programs/batch-restart')
      .send({ programIds: ['8-worker', 'invalid'] });

    expect(res.status).toBe(200);
    expect(res.body.summary).toEqual({ total: 2, succeeded: 1, failed: 1 });
    const invalid = res.body.results.find(r => r.programId === 'invalid');
    expect(invalid.success).toBe(false);
  });
});
