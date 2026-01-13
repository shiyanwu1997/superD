/**
 * MySQL数据库实现测试
 */
const dbMysql = require('../models/db.mysql');
const Logger = require('../utils/logger');

// 模拟Logger
jest.mock('../utils/logger', () => ({
  debug: jest.fn(),
  info: jest.fn(),
  error: jest.fn()
}));

// 模拟mysql2
jest.mock('mysql2/promise', () => {
  const mockConnection = {
    query: jest.fn(),
    beginTransaction: jest.fn(),
    commit: jest.fn(),
    rollback: jest.fn(),
    release: jest.fn(),
    end: jest.fn()
  };
  
  const mockPool = {
    getConnection: jest.fn().mockResolvedValue(mockConnection),
    query: jest.fn(),
    on: jest.fn()
  };
  
  return {
    createPool: jest.fn().mockReturnValue(mockPool),
    createConnection: jest.fn().mockResolvedValue(mockConnection)
  };
});

// 模拟process.exit
jest.spyOn(process, 'exit').mockImplementation(() => {
  throw new Error('process.exit called');
});

// 模拟console
jest.spyOn(console, 'log').mockImplementation(() => {});
jest.spyOn(console, 'error').mockImplementation(() => {});

describe('MySQL数据库实现测试', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  test('getUserByUsername函数应该返回用户信息', async () => {
    // 模拟数据库查询结果
    const mockUser = { id: 1, username: 'testuser', password: 'hashedpassword', roleId: 2 };
    const { query } = require('mysql2/promise').createPool();
    query.mockResolvedValue([[mockUser]]);
    
    // 调用函数
    const user = await dbMysql.getUserByUsername('testuser');
    
    // 验证结果
    expect(user).toEqual(mockUser);
    expect(query).toHaveBeenCalledWith('SELECT * FROM users WHERE username = ?', ['testuser']);
  });
  
  test('getUserByUsername函数应该在用户不存在时返回null', async () => {
    // 模拟数据库查询结果（空数组）
    const { query } = require('mysql2/promise').createPool();
    query.mockResolvedValue([[]]);
    
    // 调用函数
    const user = await dbMysql.getUserByUsername('nonexistentuser');
    
    // 验证结果
    expect(user).toBeNull();
    expect(query).toHaveBeenCalledWith('SELECT * FROM users WHERE username = ?', ['nonexistentuser']);
  });
});
