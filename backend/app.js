const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const cors = require('cors');
const bcrypt = require('bcrypt');
const routes = require('./routes');
const db = require('./models/db');
const { SERVER_CONFIG, CORS_CONFIG, STORAGE_CONFIG } = require('./config');
const { initDatabase } = require('./init-db'); // 引入数据库初始化函数

const app = express();

// 中间件配置
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cors({
  origin: function(origin, callback) {
    // 允许本地开发环境的所有请求
    if (!origin || origin.startsWith('http://localhost:')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));


// 记录请求和响应
// 导入Logger工具
const Logger = require('./utils/logger');

app.use((req, res, next) => {
  const start = Date.now();
  
  // 记录请求
  Logger.logRequest(req);
  
  // 记录响应信息
  const originalSend = res.send;
  res.send = function(body) {
    const duration = Date.now() - start;
    Logger.logResponse(req, res, duration, body);
    return originalSend.call(this, body);
  };
  
  next();
});

// Session 配置
app.use(session({
  secret: SERVER_CONFIG.SESSION_SECRET,  // 使用配置文件中的密钥
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }  // HTTPS 环境下设置为 true
}));



// 路由
app.use('/', routes);

// 引入自定义错误处理
const { errorHandler, notFoundHandler } = require('./utils/errors');

// API 404处理
app.use(notFoundHandler);

// 错误处理
app.use(errorHandler);

/**
 * 生成默认管理员用户
 * 如果系统中不存在管理员用户，将自动创建一个随机密码的管理员账户
 * 如果系统中已存在管理员用户，将打印提示信息
 * @returns {Promise<void>}
 */
async function generateDefaultAdmin() {
  try {
    // 获取所有用户（异步操作）
    const users = await db.getAllUsers();
    const adminExists = users.some(user => user.roleId === 1);
    
    if (!adminExists) {
      // 生成随机密码
      const randomPassword = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
      
      // 使用bcrypt加密密码
      const hashedPassword = await bcrypt.hash(randomPassword, 10);
      
      // 创建管理员用户（异步操作）
      const adminUser = await db.createUser('admin', hashedPassword, 1);
      
      if (adminUser) {
        Logger.info('\n=== 默认管理员用户已创建 ===');
        Logger.info('用户名: admin');
        Logger.info('密码: ' + randomPassword);
        Logger.info('请在首次登录后修改密码！');
        Logger.info('=============================\n');
      }
    } else {
      // 如果admin用户已存在，打印提示信息
      Logger.info('\n=== 管理员用户信息 ===');
      Logger.info('用户名: admin');
      Logger.info('提示: 管理员用户已存在，如需重置密码请使用密码重置功能');
      Logger.info('=============================\n');
    }
  } catch (error) {
    Logger.error('生成默认管理员用户失败:', error);
    // 继续执行，不中断启动流程
  }
}

// 启动服务器
const PORT = SERVER_CONFIG.PORT;

/**
 * 启动服务器流程
 * 1. 初始化数据库
 * 2. 生成默认管理员用户
 * 3. 启动Express服务器
 * 4. 初始化Socket.io服务器
 * @returns {Promise<void>}
 */
async function startServer() {
  try {
    // 初始化数据库（仅在MySQL存储类型下执行）
    await initDatabase();
    
    // 生成默认管理员用户
    await generateDefaultAdmin();
    
    // 启动服务器
    const server = app.listen(PORT, () => {
      Logger.info(`服务器运行在 http://localhost:${PORT}`);
      Logger.info(`当前存储类型: ${STORAGE_CONFIG.TYPE}`);
    });
    
    // 初始化Socket.io服务器
    const SocketServer = require('./services/socketServer');
    new SocketServer(server);
    Logger.info('Socket.io 服务器已启动');
    
  } catch (error) {
    Logger.error('服务器启动失败:', error);
    process.exit(1);
  }
}

// 执行启动流程
startServer();
