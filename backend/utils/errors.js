/**
 * 自定义API错误类
 */
class ApiError extends Error {
  /**
   * 创建一个新的API错误实例
   * @param {number} statusCode - HTTP状态码
   * @param {string} message - 错误消息
   * @param {Object} data - 可选的附加数据
   */
  constructor(statusCode, message, data = null) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.data = data;
    this.timestamp = new Date();
    
    // 捕获堆栈跟踪
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApiError);
    }
  }
}

/**
 * 错误处理中间件
 * @param {Error} err - 错误对象
 * @param {Request} req - 请求对象
 * @param {Response} res - 响应对象
 * @param {Function} next - 下一个中间件函数
 */
const errorHandler = (err, req, res, next) => {
  // 导入Logger工具
  const Logger = require('./logger');
  
  // 如果是我们自定义的ApiError
  if (err instanceof ApiError) {
    // 记录错误日志
    Logger.error('API错误', err, req);
    
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      data: err.data,
      timestamp: err.timestamp
    });
  }

  // 处理其他类型的错误
  Logger.error('未处理的错误', err, req);
  
  // 根据环境返回不同的错误信息
  if (process.env.NODE_ENV === 'production') {
    return res.status(500).json({
      success: false,
      message: '服务器内部错误',
      timestamp: new Date()
    });
  } else {
    return res.status(500).json({
      success: false,
      message: err.message || '服务器内部错误',
      stack: err.stack,
      timestamp: new Date()
    });
  }
};

/**
 * 404错误处理中间件
 * @param {Request} req - 请求对象
 * @param {Response} res - 响应对象
 * @param {Function} next - 下一个中间件函数
 */
const notFoundHandler = (req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return next(new ApiError(404, 'API接口不存在'));
  }
  next();
};

module.exports = {
  ApiError,
  errorHandler,
  notFoundHandler
};
