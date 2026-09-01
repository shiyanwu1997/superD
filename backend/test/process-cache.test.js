/**
 * 进程缓存失效测试：
 * start/stop/restart 无论成功还是失败，操作后缓存必须清除，
 * 否则 10 秒轮询读到旧状态会误判操作结果。
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
  getProjectById: jest.fn().mockResolvedValue({
    id: 9,
    supervisorConfig: { host: '127.0.0.1', port: 9001, username: 'u', password: 'p' }
  })
}));

const mockRpcCalls = [];
let mockRpcHandler = null;
jest.mock('xmlrpc', () => ({
  createClient: jest.fn(() => ({
    methodCall: (method, params, cb) => {
      mockRpcCalls.push(method);
      if (mockRpcHandler) return mockRpcHandler(method, params, cb);
      cb(null, true);
    }
  }))
}));

const supervisorService = require('../services/supervisorService');

const STOPPED = { name: 'app', group: 'app', statename: 'STOPPED', state: 0, now: Date.now() / 1000, start: 1, description: '' };

// restart 内部轮询循环最多 10 次 × 1s
jest.setTimeout(30000);

describe('进程缓存失效', () => {
  beforeEach(() => {
    mockRpcCalls.length = 0;
    mockRpcHandler = null;
    jest.clearAllMocks();
  });

  test('restart 失败后缓存被清除（紧随的 getAllProcesses 重新走 RPC）', async () => {
    // 预热缓存：先正常拉一次进程列表
    mockRpcHandler = (method, params, cb) => {
      if (method === 'supervisor.getAllProcessInfo') return cb(null, [STOPPED]);
      cb(null, true);
    };
    await supervisorService.getAllProcesses(9);

    // 重启：状态始终 STOPPED → 双重 RUNNING 检查失败 → 超时
    const result = await supervisorService.restartProcess(9, 'app');
    expect(result.success).toBe(false);

    // 缓存应已被清除：这次调用必须重新发起 RPC
    const before = mockRpcCalls.filter(m => m === 'supervisor.getAllProcessInfo').length;
    await supervisorService.getAllProcesses(9);
    const after = mockRpcCalls.filter(m => m === 'supervisor.getAllProcessInfo').length;
    expect(after).toBeGreaterThan(before);
  });

  test('缓存有效期内不重复发起 RPC（确认缓存机制本身正常）', async () => {
    mockRpcHandler = (method, params, cb) => {
      if (method === 'supervisor.getAllProcessInfo') return cb(null, [STOPPED]);
      cb(null, true);
    };
    await supervisorService.getAllProcesses(9);
    const before = mockRpcCalls.filter(m => m === 'supervisor.getAllProcessInfo').length;
    await supervisorService.getAllProcesses(9);
    const after = mockRpcCalls.filter(m => m === 'supervisor.getAllProcessInfo').length;
    expect(after).toBe(before);
  });
});
