/**
 * 日志工具模块
 */

const fs = require('fs');
const path = require('path');

// 日志级别
const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  FATAL: 4
};

// 当前日志级别（环境变量是字符串，必须映射为数字再比较）
const envLevelName = (process.env.LOG_LEVEL || 'INFO').toUpperCase();
const currentLevel = LOG_LEVELS[envLevelName] !== undefined ? LOG_LEVELS[envLevelName] : LOG_LEVELS.INFO;

// 单个日志文件大小上限，超过后轮转为 .1（避免无限增长）
const MAX_LOG_SIZE = 10 * 1024 * 1024;

// 日志文件路径
const logDir = path.join(__dirname, '../logs');
const errorLogPath = path.join(logDir, 'error.log');
const accessLogPath = path.join(logDir, 'access.log');

// 确保日志目录存在
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

/**
 * 格式化日志消息
 * @param {string} level - 日志级别
 * @param {string} message - 日志消息
 * @param {Object} data - 附加数据
 * @param {Object} req - 请求对象
 * @returns {string} 格式化的日志消息
 */
const formatMessage = (level, message, data = null, req = null) => {
  const timestamp = new Date().toISOString();
  let logMsg = `[${timestamp}] [${level}] ${message}`;
  
  // 添加请求信息
  if (req) {
    logMsg += ` | Request: ${req.method} ${req.path}`;
    if (req.ip) {
      logMsg += ` | IP: ${req.ip}`;
    }
    if (req.user) {
      logMsg += ` | User: ${req.user.userId || req.user.username}`;
    }
  }
  
  // 添加附加数据
  if (data) {
    logMsg += ` | Data: ${typeof data === 'object' ? JSON.stringify(data, null, 2) : data}`;
  }
  
  return logMsg;
};

/**
 * 写入日志到文件（超过大小上限时先轮转为 .1）
 * @param {string} filePath - 文件路径
 * @param {string} message - 日志消息
 */
const writeToFile = (filePath, message) => {
  try {
    if (fs.existsSync(filePath) && fs.statSync(filePath).size >= MAX_LOG_SIZE) {
      fs.renameSync(filePath, filePath + '.1');
    }
  } catch (err) {
    console.error('日志轮转失败:', err);
  }
  fs.appendFile(filePath, message + '\n', (err) => {
    if (err) {
      console.error('写入日志文件失败:', err);
    }
  });
};

// SLB/负载均衡健康检查探针特征：HEAD 方法打根路径。每次探测写 2 行日志，
// 480 次/分钟是 access.log 无限增长的独立原因，直接跳过。
const isHealthProbe = (req) => req.method === 'HEAD' && (req.path === '/' || req.originalUrl === '/');

/**
 * 日志工具类
 */
class Logger {
  /**
   * 调试日志
   * @param {string} message - 日志消息
   * @param {Object} data - 附加数据
   * @param {Object} req - 请求对象
   */
  static debug(message, data = null, req = null) {
    if (LOG_LEVELS.DEBUG >= currentLevel) {
      const logMsg = formatMessage('DEBUG', message, data, req);
      console.log(logMsg);
      writeToFile(accessLogPath, logMsg);
    }
  }
  
  /**
   * 信息日志
   * @param {string} message - 日志消息
   * @param {Object} data - 附加数据
   * @param {Object} req - 请求对象
   */
  static info(message, data = null, req = null) {
    if (LOG_LEVELS.INFO >= currentLevel) {
      const logMsg = formatMessage('INFO', message, data, req);
      console.log(logMsg);
      writeToFile(accessLogPath, logMsg);
    }
  }
  
  /**
   * 警告日志
   * @param {string} message - 日志消息
   * @param {Object} data - 附加数据
   * @param {Object} req - 请求对象
   */
  static warn(message, data = null, req = null) {
    if (LOG_LEVELS.WARN >= currentLevel) {
      const logMsg = formatMessage('WARN', message, data, req);
      console.warn(logMsg);
      writeToFile(accessLogPath, logMsg);
      writeToFile(errorLogPath, logMsg);
    }
  }
  
  /**
   * 错误日志
   * @param {string} message - 日志消息
   * @param {Error} error - 错误对象
   * @param {Object} req - 请求对象
   */
  static error(message, error = null, req = null) {
    if (LOG_LEVELS.ERROR >= currentLevel) {
      let logMsg = formatMessage('ERROR', message, null, req);
      if (error) {
        logMsg += ` | Error: ${error.message}`;
        logMsg += ` | Stack: ${error.stack}`;
      }
      console.error(logMsg);
      writeToFile(errorLogPath, logMsg);
    }
  }
  
  /**
   * 致命错误日志
   * @param {string} message - 日志消息
   * @param {Error} error - 错误对象
   * @param {Object} req - 请求对象
   */
  static fatal(message, error = null, req = null) {
    if (LOG_LEVELS.FATAL >= currentLevel) {
      let logMsg = formatMessage('FATAL', message, null, req);
      if (error) {
        logMsg += ` | Error: ${error.message}`;
        logMsg += ` | Stack: ${error.stack}`;
      }
      console.error(logMsg);
      writeToFile(errorLogPath, logMsg);
    }
  }
  
  /**
   * 记录请求
   * @param {Object} req - 请求对象
   */
  static logRequest(req) {
    if (isHealthProbe(req)) return;
    if (LOG_LEVELS.INFO >= currentLevel) {
      const message = 'Incoming request';
      const data = {
        contentType: req.get('content-type') || null,
        contentLength: req.get('content-length') || null
      };
      const logMsg = formatMessage('INFO', message, data, req);
      console.log(logMsg);
      writeToFile(accessLogPath, logMsg);
    }
  }
  
  /**
   * 记录响应
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   * @param {number} duration - 响应时间（毫秒）
   * @param {Object} body - 响应体
   */
  static logResponse(req, res, duration, body = null) {
    if (isHealthProbe(req)) return;
    if (LOG_LEVELS.INFO >= currentLevel) {
      const message = `Response sent (${duration}ms)`;
      const data = { statusCode: res.statusCode, responseBytes: body ? Buffer.byteLength(String(body)) : 0 };
      const logMsg = formatMessage('INFO', message, data, req);
      console.log(logMsg);
      writeToFile(accessLogPath, logMsg);
    }
  }
}

module.exports = Logger;
