// 后端配置文件

// 服务器配置
const SERVER_CONFIG = {
  PORT: process.env.PORT || 3000, // 服务器端口
  HOST: process.env.HOST || 'localhost', // 服务器主机
  SESSION_SECRET: process.env.SESSION_SECRET, // Session密钥（必须通过环境变量设置）
  JWT_SECRET: process.env.JWT_SECRET, // JWT密钥（必须通过环境变量设置）
};

// 存储配置 - 默认使用SQLite，可选MySQL
const STORAGE_CONFIG = {
  TYPE: process.env.STORAGE_TYPE || 'sqlite', // 存储类型: sqlite (默认) 或 mysql

  // SQLite存储配置
  SQLITE: {
    PATH: process.env.SQLITE_PATH || null, // SQLite文件路径，默认使用 data/supervisor.db
  },

  // MySQL存储配置（仅在 STORAGE_TYPE=mysql 时生效）
  MYSQL: {
    HOST: process.env.MYSQL_HOST || 'localhost',
    PORT: process.env.MYSQL_PORT || 3306,
    USER: process.env.MYSQL_USER || 'root',
    PASSWORD: process.env.MYSQL_PASSWORD,
    DATABASE: process.env.MYSQL_DATABASE || 'supervisor',
    CONNECTION_LIMIT: process.env.MYSQL_CONNECTION_LIMIT || 10,
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
  ENCRYPTION_KEY: process.env.ENCRYPTION_KEY, // AES加密密钥（必须通过环境变量设置）
};

module.exports = {
  SERVER_CONFIG,
  STORAGE_CONFIG,
  SUPERVISOR_CONFIG,
  CORS_CONFIG,
  LOG_CONFIG,
  SECURITY_CONFIG
};
