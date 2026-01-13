// 后端配置文件

// 服务器配置
const SERVER_CONFIG = {
  PORT: process.env.PORT || 3000, // 服务器端口
  HOST: process.env.HOST || 'localhost', // 服务器主机
  SESSION_SECRET: process.env.SESSION_SECRET || 'your-secret-key', // Session密钥
  JWT_SECRET: process.env.JWT_SECRET || 'your-jwt-secret', // JWT密钥
};

// 存储配置 - 仅使用MySQL存储
const STORAGE_CONFIG = {
  TYPE: process.env.STORAGE_TYPE || 'mysql', // 存储类型: 仅支持mysql
  
  // MySQL存储配置
  MYSQL: {
    HOST: process.env.MYSQL_HOST || 'localhost', // MySQL主机
    PORT: process.env.MYSQL_PORT || 3306, // MySQL端口
    USER: process.env.MYSQL_USER || 'root', // MySQL用户名
    PASSWORD: process.env.MYSQL_PASSWORD || 'yang1340984855', // MySQL密码
    DATABASE: process.env.MYSQL_DATABASE || 'supervisor', // MySQL数据库名
    CONNECTION_LIMIT: process.env.MYSQL_CONNECTION_LIMIT || 10, // 连接池大小
  }
};

// Supervisor配置
const SUPERVISOR_CONFIG = {
  DEFAULT_PORT: 9001, // 默认Supervisor端口
  TIMEOUT: 8000, // 连接超时时间（毫秒），适度延长
  RPC_PATH: '/RPC2', // XML-RPC路径
  // 日志配置
  LOG: {
    DEFAULT_LENGTH: 500, // 默认日志读取长度
    MAX_READ_LENGTH: 100, // 最大日志读取长度
    DEFAULT_OFFSET: -1, // 默认日志偏移量（-1表示从文件末尾读取）
    MAX_LINES: 500, // 前端显示的最大日志行数（与前端保持一致）
    BATCH_SIZE: 500, // 日志批处理大小
  }
};

// CORS配置
const CORS_CONFIG = {
  ORIGINS: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:6001'], // 允许的前端域名
};

// 日志配置
const LOG_CONFIG = {
  ENABLED: true, // 是否启用日志
  LEVEL: 'debug', // 日志级别
};

// 安全配置
const SECURITY_CONFIG = {
  PASSWORD_MIN_LENGTH: 6, // 密码最小长度
  BCRYPT_ROUNDS: 10, // bcrypt加密轮数
  ENCRYPTION_KEY: process.env.ENCRYPTION_KEY || 'your-encryption-key', // AES加密密钥
};

module.exports = {
  SERVER_CONFIG,
  STORAGE_CONFIG,
  SUPERVISOR_CONFIG,
  CORS_CONFIG,
  LOG_CONFIG,
  SECURITY_CONFIG
};
