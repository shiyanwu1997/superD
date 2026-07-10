import axios from 'axios';

/**
 * 创建axios实例的基础配置
 */
const baseAxiosConfig = {
  baseURL: import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
};

const isDev = import.meta.env.DEV;

const createRequestLogger = () => {
  return config => {
    if (isDev) console.log(`[API] ${config.method.toUpperCase()} ${config.url}`);
    return config;
  };
};

const createResponseLogger = () => {
  return response => {
    if (isDev) console.log(`[API] ${response.status} ${response.config.url}`);
    return response;
  };
};

const createErrorLogger = () => {
  return error => {
    console.error(`[API] ${error.config?.method?.toUpperCase()} ${error.config?.url} - ${error.response?.status || error.message}`);
    return Promise.reject(error);
  };
};

/**
 * 认证令牌拦截器
 * @param {Object} config - axios配置对象
 * @returns {Object} 配置对象
 */
const authInterceptor = config => {
  // 从localStorage获取令牌（如果存在）
  const token = localStorage.getItem('token');
  
  // 如果令牌存在，添加到请求头
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  
  return config;
};

// 创建主API实例
const api = axios.create({
  ...baseAxiosConfig,
  timeout: 28000 // 延长超时时间到28秒，以匹配后端优化后的启动检查时间
});

// 创建连接状态检查专用API实例
const checkStatusApi = axios.create({
  ...baseAxiosConfig,
  timeout: 6000 // 适度延长连接状态检查超时时间
});

// 为api实例添加拦截器
api.interceptors.request.use(createRequestLogger('API'));
api.interceptors.request.use(authInterceptor);
api.interceptors.response.use(createResponseLogger('API'));
api.interceptors.response.use(null, createErrorLogger('API'));

// 为checkStatusApi实例添加拦截器
checkStatusApi.interceptors.request.use(createRequestLogger('状态检查'));
checkStatusApi.interceptors.request.use(authInterceptor);
checkStatusApi.interceptors.response.use(createResponseLogger('状态检查'));
checkStatusApi.interceptors.response.use(null, createErrorLogger('状态检查'));

// 获取项目列表
export const getProjects = async () => {
  const response = await api.get('/projects');
  return response.data;
};

// 登录请求
export const login = async (username, password) => {
  const response = await api.post('/login', {
    username,
    password,
  }, {
    headers: {
      'Content-Type': 'application/json'
    },
    withCredentials: true,
    validateStatus: function (status) {
      return status >= 200 && status < 300; // 只接受2xx状态码
    }
  });
  return response.data;
};

// 获取用户信息
export const getUserInfo = async () => {
  try {
    const response = await api.get('/user');
    return response.data;
  } catch {
    throw new Error('获取用户信息失败，认证可能已过期');
  }
};

// 原getProjects函数已移至文件顶部

// 获取项目下的程序列表
export const getProgramsByProject = async (projectId, options = {}) => {
  const response = await api.get(`/projects/${projectId}/programs`, options);
  return response.data;
};

// 检查单个项目的连接状态
export const checkProjectStatus = async (projectId) => {
  try {
    // 使用专门的checkStatusApi实例进行连接状态检查，使用更短的超时时间
    const response = await checkStatusApi.get(`/projects/${projectId}/status`);
    return response.data.connectionStatus;
  } catch (error) {
    if (error.response?.data?.connectionStatus?.error) {
      // 如果后端返回错误信息，使用后端的错误信息
      return { connected: false, error: error.response.data.connectionStatus.error };
    }
    // 如果是超时错误或网络错误，返回统一的错误信息
    return { connected: false, error: '连接失败' };
  }
};

// 获取所有程序列表
export const getAllPrograms = async () => {
  const response = await api.get('/programs');
  return response.data;
};

// 获取程序详情
export const getProgramDetail = async (programId) => {
  const response = await api.get(`/programs/${programId}`);
  return response.data;
};

// 启动程序
export const startProgram = async (programId) => {
  const response = await api.post(`/programs/${programId}/start`);
  return response.data;
};

// 停止程序
export const stopProgram = async (programId) => {
  const response = await api.post(`/programs/${programId}/stop`);
  return response.data;
};

// 重启程序
export const restartProgram = async (programId) => {
  const response = await api.post(`/programs/${programId}/restart`);
  return response.data;
};

// 启动所有程序
export const startAllPrograms = async (projectId) => {
  const response = await api.post(`/projects/${projectId}/programs/start-all`);
  return response.data;
};

// 停止所有程序
export const stopAllPrograms = async (projectId) => {
  const response = await api.post(`/projects/${projectId}/programs/stop-all`);
  return response.data;
};

// 重启所有程序
export const restartAllPrograms = async (projectId) => {
  const response = await api.post(`/projects/${projectId}/programs/restart-all`);
  return response.data;
};

// 用户管理 API

// 获取所有用户列表
export const getAllUsers = async () => {
  const response = await api.get('/users');
  return response.data;
};

// 创建新用户
export const createUser = async (username, password, roleId, createdBy) => {
  const response = await api.post('/users', { username, password, roleId, createdBy });
  return response.data;
};

// 删除用户
export const deleteUser = async (userId) => {
  const response = await api.delete(`/users/${userId}`);
  return response.data;
};

// 更新用户角色
export const updateUserRole = async (userId, roleId) => {
  const response = await api.put(`/users/${userId}/role`, { roleId });
  return response.data;
};

// 更新用户的上级管理员
export const updateUserCreatedBy = async (userId, createdBy) => {
  const response = await api.put(`/users/${userId}/createdBy`, { createdBy });
  return response.data;
};

// 更新用户密码（管理员功能）
export const updateUserPassword = async (userId, newPassword) => {
  const response = await api.put(`/users/${userId}/password`, { newPassword });
  return response.data;
};

// 修改当前用户的密码（普通用户功能）
export const changeOwnPassword = async (oldPassword, newPassword) => {
  const response = await api.put('/users/self/password', { oldPassword, newPassword });
  return response.data;
};

// 获取用户项目权限
export const getUserProjectPermissions = async (userId) => {
  const response = await api.get(`/users/${userId}/project-permissions`);
  return response.data;
};

// 设置用户项目权限
export const setUserProjectPermission = async (userId, projectId) => {
  const response = await api.post(`/users/${userId}/project-permissions`, { projectId });
  return response.data;
};

// 移除用户项目权限
export const removeUserProjectPermission = async (userId, projectId) => {
  const response = await api.delete(`/users/${userId}/project-permissions/${projectId}`);
  return response.data;
};

// 创建新项目
export const createProject = async (projectData) => {
  const response = await api.post('/projects', projectData);
  return response.data;
};

// 更新项目
export const updateProject = async (id, projectData) => {
  const response = await api.put(`/projects/${id}`, projectData);
  return response.data;
};

// 删除项目
export const deleteProject = async (id) => {
  const response = await api.delete(`/projects/${id}`);
  return response.data;
};

// ==================== 分组管理 ====================

export const getGroups = async () => {
  const response = await api.get('/groups');
  return response.data;
};

export const createGroup = async (name, description) => {
  const response = await api.post('/groups', { name, description });
  return response.data;
};

export const deleteGroup = async (id) => {
  const response = await api.delete(`/groups/${id}`);
  return response.data;
};

export const setProjectGroup = async (projectId, groupId) => {
  const response = await api.put(`/projects/${projectId}/group`, { groupId });
  return response.data;
};

export const reloadConfig = async (projectId) => {
  const response = await api.post(`/projects/${projectId}/reload`);
  return response.data;
};

// ==================== 程序级权限 ====================

export const getUserProgramPermissions = async (userId) => {
  const response = await api.get(`/users/${userId}/program-permissions`);
  return response.data;
};

export const addUserProgramPermission = async (userId, programId) => {
  const response = await api.post(`/users/${userId}/program-permissions`, { programId });
  return response.data;
};

export const removeUserProgramPermission = async (userId, programId) => {
  const response = await api.delete(`/users/${userId}/program-permissions/${programId}`);
  return response.data;
};