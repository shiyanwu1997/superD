// 前端配置文件

// API配置
export const API_CONFIG = {
  BASE_URL: 'http://localhost:3000/api', // 后端API地址
  TIMEOUT: 10000, // 请求超时时间（毫秒）
};

// 默认值配置
export const DEFAULT_VALUES = {
  PROJECT_PORT: 9001, // 默认Supervisor端口
  PASSWORD_MIN_LENGTH: 6, // 密码最小长度
};

// 路由配置
export const ROUTES = {
  LOGIN: '/login',
  PROGRAMS: '/programs',
  USERS: '/users',
  PROGRAM_DETAIL: '/programs/:projectId/:programId',
};

// 消息配置
export const MESSAGES = {
  NETWORK_ERROR: '网络错误，请检查连接',
  UNAUTHORIZED: '请先登录',
  FORBIDDEN: '没有操作权限',
  SERVER_ERROR: '服务器错误',
};

// 正则表达式配置
export const REGEX = {
  PORT: /^[1-9]\d*$/, // 端口号正则
  IP: /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/, // IP地址正则
};
