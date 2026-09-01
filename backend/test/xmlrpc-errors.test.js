/**
 * xmlrpcExceptions 错误包装测试：
 * 重抛的错误必须保留原始 code/faultCode，供上层结构化判断（而非字符串匹配）。
 */
process.env.STORAGE_TYPE = 'sqlite';
process.env.NODE_ENV = 'test';

jest.mock('../utils/logger', () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

// getAllProcessInfo 走 db.getProjectById；直接 stub 掉 db
jest.mock('../models/db', () => ({
  getProjectById: jest.fn().mockResolvedValue({
    id: 9,
    supervisorConfig: { host: '127.0.0.1', port: 9001, username: 'u', password: 'p' }
  })
}));

// xmlrpc 客户端工厂：可注入任意底层错误
jest.mock('xmlrpc', () => ({
  createClient: jest.fn(() => ({
    methodCall: (method, params, cb) => {
      const err = global.__rpcError;
      if (err) return cb(err, null);
      cb(null, []);
    }
  }))
}));

const { getProjectById } = require('../models/db');
const supervisorService = require('../services/supervisorService');

describe('xmlrpcExceptions 错误包装', () => {
  beforeEach(() => {
    global.__rpcError = null;
    jest.clearAllMocks();
    getProjectById.mockResolvedValue({
      id: 9,
      supervisorConfig: { host: '127.0.0.1', port: 9001, username: 'u', password: 'p' }
    });
  });

  test('ECONNREFUSED 错误保留 error.code', async () => {
    global.__rpcError = Object.assign(new Error('connect ECONNREFUSED 10.0.0.1:9001'), { code: 'ECONNREFUSED' });

    await expect(supervisorService.getAllProcesses(9)).rejects.toMatchObject({
      code: 'ECONNREFUSED',
      message: expect.stringContaining('无法连接到Supervisor服务')
    });
  });

  test('XML-RPC fault 错误保留 faultCode/faultString', async () => {
    global.__rpcError = Object.assign(new Error('FAULT'), { faultCode: 10, faultString: 'BAD_NAME' });

    await expect(supervisorService.getAllProcesses(9)).rejects.toMatchObject({
      faultCode: 10,
      faultString: 'BAD_NAME',
      message: expect.stringContaining('Supervisor错误 (10)')
    });
  });

  test('普通错误保留 cause 指向原始错误', async () => {
    const original = new Error('boom');
    global.__rpcError = original;

    await expect(supervisorService.getAllProcesses(9)).rejects.toMatchObject({
      cause: original,
      message: expect.stringContaining('与Supervisor通信失败')
    });
  });
});
