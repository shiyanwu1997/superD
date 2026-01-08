import axios from 'axios';
import { API_CONFIG } from '../config';

// 创建axios实例
const api = axios.create({
  baseURL: API_CONFIG.BASE_URL,
  timeout: API_CONFIG.TIMEOUT,
  withCredentials: true, // 允许携带cookie
  headers: {
    'Content-Type': 'application/json'
  }
});

// 登录请求
export const login = async (username, password) => {
  console.log('api.login called with:', username);
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
  console.log('api.login response:', response);
  return response.data;
};

// 获取用户信息
export const getUserInfo = async () => {
  try {
    const response = await api.get('/user');
    return response.data;
  } catch (error) {
    console.error('getUserInfo error:', error);
    // 认证失败时抛出错误，让调用者处理
    throw new Error('获取用户信息失败，认证可能已过期');
  }
};

// 获取用户可访问的项目列表
export const getProjects = async () => {
  const response = await api.get('/projects');
  return response.data;
};

// 获取项目下的程序列表
export const getProgramsByProject = async (projectId, options = {}) => {
  const response = await api.get(`/projects/${projectId}/programs`, options);
  return response.data;
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

// 获取程序标准输出日志
export const getProgramStdout = async (programId, offset = 0, length = 100000) => {
  const response = await api.get(`/programs/${programId}/stdout`, {
    params: { offset, length }
  });
  return response.data;
};

// 获取程序标准错误日志
export const getProgramStderr = async (programId, offset = 0, length = 100000) => {
  const response = await api.get(`/programs/${programId}/stderr`, {
    params: { offset, length }
  });
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
export const createUser = async (username, password, roleId) => {
  const response = await api.post('/users', { username, password, roleId });
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