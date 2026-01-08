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
  origin: CORS_CONFIG.ORIGINS,  // 允许前端开发服务器访问
  credentials: true
}));

// 记录请求
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}\n`);
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

// API 404处理
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    res.status(404).json({ error: 'API接口不存在' });
  } else {
    next();
  }
});

// 错误处理
app.use((err, req, res, next) => {
  console.error(err.stack + '\n');
  res.status(500).send('服务器错误');
});

// 生成默认管理员用户
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
        console.log('\n=== 默认管理员用户已创建 ===');
        console.log('用户名: admin');
        console.log('密码: ' + randomPassword);
        console.log('请在首次登录后修改密码！');
        console.log('=============================\n');
      }
    }
  } catch (error) {
    console.error('生成默认管理员用户失败:', error + '\n');
    // 继续执行，不中断启动流程
  }
}

// 启动服务器
const PORT = SERVER_CONFIG.PORT;

// 先初始化数据库，然后生成默认管理员，最后启动服务器
async function startServer() {
  try {
    // 初始化数据库（仅在MySQL存储类型下执行）
    await initDatabase();
    
    // 生成默认管理员用户
    await generateDefaultAdmin();
    
    // 启动服务器
    app.listen(PORT, () => {
      console.log(`服务器运行在 http://localhost:${PORT}\n`);
      console.log(`当前存储类型: ${STORAGE_CONFIG.TYPE}\n`);
    });
  } catch (error) {
    console.error('服务器启动失败:', error + '\n');
    process.exit(1);
  }
}

// 执行启动流程
startServer();
