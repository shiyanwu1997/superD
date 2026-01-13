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

// 当前日志级别
const currentLevel = process.env.LOG_LEVEL || LOG_LEVELS.INFO;

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
    logMsg += ` | Request: ${req.method} ${req.url}`;
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
 * 写入日志到文件
 * @param {string} filePath - 文件路径
 * @param {string} message - 日志消息
 */
const writeToFile = (filePath, message) => {
  fs.appendFile(filePath, message + '\n', (err) => {
    if (err) {
      console.error('写入日志文件失败:', err);
    }
  });
};

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
    if (LOG_LEVELS.INFO >= currentLevel) {
      const message = 'Incoming request';
      const data = {
        headers: req.headers,
        query: req.query,
        body: req.body
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
    if (LOG_LEVELS.INFO >= currentLevel) {
      const message = `Response sent (${duration}ms)`;
      const data = body ? { body } : null;
      const logMsg = formatMessage('INFO', message, data, req);
      console.log(logMsg);
      writeToFile(accessLogPath, logMsg);
    }
  }
}

module.exports = Logger;
