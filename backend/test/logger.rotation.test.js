/**
 * Logger 日志轮转测试：
 * 1. 文件超过大小上限时轮转（rename 为 .1），新日志写入新文件
 * 2. 健康检查探针（HEAD /）不写 access.log —— SLB 每分钟 480 次探测是日志爆炸的独立原因
 * 3. LOG_LEVEL=warn 等字符串环境变量应正确解析（原实现字符串与数字比较恒为 false，设了 LOG_LEVEL 就全站静默）
 */
process.env.NODE_ENV = 'test';

const fs = require('fs');
const os = require('os');
const path = require('path');

// 每个测试用独立日志目录，避免污染真实 logs/
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'logger-test-'));

// mock fs 的部分方法之前先记录真实实现
const realFs = {
  existsSync: fs.existsSync,
  mkdirSync: fs.mkdirSync,
  appendFile: fs.appendFile,
  renameSync: fs.renameSync,
  statSync: fs.statSync
};

let appendCalls = [];
let renamedFiles = [];
let fileSizes = {}; // filePath -> 模拟的当前大小

jest.spyOn(fs, 'existsSync').mockImplementation((p) => realFs.existsSync(p));
jest.spyOn(fs, 'mkdirSync').mockImplementation((...args) => realFs.mkdirSync(...args));
jest.spyOn(fs, 'appendFile').mockImplementation((filePath, data, cb) => {
  appendCalls.push({ filePath, data });
  // 模拟文件增长
  fileSizes[filePath] = (fileSizes[filePath] || 0) + Buffer.byteLength(String(data));
  if (cb) cb(null);
});
jest.spyOn(fs, 'renameSync').mockImplementation((from, to) => {
  renamedFiles.push({ from, to });
  fileSizes[from] = 0;
});
// 保留 uid/gid/mode：write-file-atomic（jest 转换缓存）依赖 statSync 的这些字段
jest.spyOn(fs, 'statSync').mockImplementation((p) => ({
  size: fileSizes[p] || 0,
  uid: process.getuid ? process.getuid() : 0,
  gid: process.getgid ? process.getgid() : 0,
  mode: 0o644,
  isFile: () => true,
  isDirectory: () => false
}));

const Logger = require('../utils/logger');

describe('Logger 日志轮转', () => {
  beforeEach(() => {
    appendCalls = [];
    renamedFiles = [];
    fileSizes = {};
  });

  test('文件超过上限时轮转到 .1，之后继续写原路径', () => {
    // 预置 logger 实际使用的 access.log 已达上限（fs 已全部 mock，不落盘）
    const accessPath = path.join(__dirname, '../logs/access.log');
    fileSizes[accessPath] = 10 * 1024 * 1024; // 10MB

    Logger.info('trigger rotation');

    // 应触发轮转：access.log -> access.log.1
    expect(renamedFiles.some((r) => r.from.endsWith('access.log') && r.to.endsWith('access.log.1'))).toBe(true);
    // 轮转后新日志仍写入原路径
    const writes = appendCalls.filter((c) => c.filePath.endsWith('access.log'));
    expect(writes.length).toBeGreaterThan(0);
  });

  test('文件未超上限时不轮转', () => {
    Logger.info('no rotation needed');
    expect(renamedFiles).toHaveLength(0);
    expect(appendCalls.filter((c) => c.filePath.endsWith('access.log')).length).toBeGreaterThan(0);
  });

  test('健康检查探针（HEAD /）不写 access.log', () => {
    const req = {
      method: 'HEAD',
      path: '/',
      originalUrl: '/',
      ip: '100.122.17.1',
      get: () => null
    };
    Logger.logRequest(req);

    const probeWrites = appendCalls.filter(
      (c) => c.filePath.endsWith('access.log') && c.data.includes('Incoming request')
    );
    expect(probeWrites).toHaveLength(0);
  });

  test('正常 GET 请求仍记录', () => {
    const req = {
      method: 'GET',
      path: '/api/projects',
      originalUrl: '/api/projects',
      ip: '192.168.1.10',
      get: () => null
    };
    Logger.logRequest(req);

    const writes = appendCalls.filter(
      (c) => c.filePath.endsWith('access.log') && c.data.includes('Incoming request')
    );
    expect(writes.length).toBeGreaterThan(0);
  });

  test('logResponse 对 HEAD / 探针同样跳过', () => {
    const req = {
      method: 'HEAD',
      path: '/',
      originalUrl: '/',
      ip: '100.122.17.1',
      get: () => null
    };
    const res = { statusCode: 200 };
    Logger.logResponse(req, res, 5);

    const probeWrites = appendCalls.filter(
      (c) => c.filePath.endsWith('access.log') && c.data.includes('Response sent')
    );
    expect(probeWrites).toHaveLength(0);
  });
});

describe('LOG_LEVEL 字符串解析', () => {
  test('LOG_LEVEL=warn 时 info 不记录但 warn 记录', () => {
    jest.resetModules();
    process.env.LOG_LEVEL = 'warn';
    const WarnLogger = require('../utils/logger');
    appendCalls = [];

    WarnLogger.info('should be filtered');
    WarnLogger.warn('should pass');

    const messages = appendCalls.map((c) => c.data).join('\n');
    expect(messages).not.toContain('should be filtered');
    expect(messages).toContain('should pass');

    delete process.env.LOG_LEVEL;
  });
});
