const xmlrpc = require('xmlrpc');
const fs = require('fs');
const path = require('path');

// 从数据库获取项目的Supervisor配置
const db = require('../models/db');
const { SUPERVISOR_CONFIG } = require('../config');

// 创建 XML-RPC 客户端
const createClient = (supervisorConfig) => {
  return xmlrpc.createClient({
    host: supervisorConfig.host,
    port: supervisorConfig.port,
    path: SUPERVISOR_CONFIG.RPC_PATH,
    basic_auth: {
      user: supervisorConfig.username,
      pass: supervisorConfig.password
    },
    timeout: SUPERVISOR_CONFIG.TIMEOUT // 使用配置文件中的超时设置
  });
};

// 获取项目的Supervisor配置
const getSupervisorConfig = async (projectId) => {
  const project = await db.getProjectById(projectId);
  if (!project) {
    throw new Error('项目不存在');
  }
  if (!project.supervisorConfig) {
    throw new Error('项目的Supervisor配置不存在');
  }
  return project.supervisorConfig;
};

// 通用 XML-RPC 调用函数
const callRpc = async (projectId, method, params = []) => {
  return new Promise(async (resolve, reject) => {
    try {
      const supervisorConfig = await getSupervisorConfig(projectId);
      const client = createClient(supervisorConfig);
      
      client.methodCall(method, params, (error, value) => {
        if (error) {
          console.error(`RPC调用失败 (${method}):`, error + '\n');
          // 对不同类型的错误提供更具体的错误信息
          if (error.code === 'ECONNREFUSED') {
            reject(new Error(`无法连接到Supervisor服务 (${supervisorConfig.host}:${supervisorConfig.port}): ${error.message}`));
          } else if (error.code === 'ETIMEDOUT') {
            reject(new Error(`连接Supervisor服务超时 (${supervisorConfig.host}:${supervisorConfig.port}): ${error.message}`));
          } else {
            reject(new Error(`RPC调用失败: ${error.message}`));
          }
        } else {
          resolve(value);
        }
      });
    } catch (error) {
      console.error(`创建Supervisor客户端失败:`, error + '\n');
      reject(error);
    }
  });
};

// 获取所有程序状态
const getAllProcesses = async (projectId) => {
  return await callRpc(projectId, 'supervisor.getAllProcessInfo');
};

// 启动程序
const startProcess = async (projectId, programName) => {
  try {
    await callRpc(projectId, 'supervisor.startProcess', [programName]);
    return { success: true, message: `${programName} 已启动` };
  } catch (error) {
    console.error(`启动程序失败 (${programName}):`, error + '\n');
    return { success: false, message: `启动失败: ${error.message}` };
  }
};

// 停止程序
const stopProcess = async (projectId, programName) => {
  try {
    await callRpc(projectId, 'supervisor.stopProcess', [programName]);
    return { success: true, message: `${programName} 已停止` };
  } catch (error) {
    console.error(`停止程序失败 (${programName}):`, error + '\n');
    return { success: false, message: `停止失败: ${error.message}` };
  }
};

// 重启程序
const restartProcess = async (projectId, programName) => {
  try {
    // Supervisor没有直接的restartProcess方法，需要先停止再启动
    await callRpc(projectId, 'supervisor.stopProcess', [programName]);
    await callRpc(projectId, 'supervisor.startProcess', [programName]);
    return { success: true, message: `${programName} 已重启` };
  } catch (error) {
    console.error(`重启程序失败 (${programName}):`, error + '\n');
    return { success: false, message: `重启失败: ${error.message}` };
  }
};

// 获取程序日志（旧方法，兼容用）
const getProcessLogs = async (projectId, programName, offset = 0, length = 10000) => {
  try {
    return await callRpc(projectId, 'supervisor.readProcessLog', [programName, offset, length]);
  } catch (error) {
    console.error(`获取日志失败 (${programName}):`, error + '\n');
    throw error;
  }
};

// 获取程序标准输出日志
const getProcessStdoutLog = async (projectId, programName, offset = 0, length = 100000) => {
  try {
    const logs = await callRpc(projectId, 'supervisor.readProcessStdoutLog', [programName, offset, length]);
    // 确保日志数据具有正确的换行符格式
    if (typeof logs === 'string') {
      // 统一换行符格式，确保每行日志都以换行符结束
      return logs.replace(/\r\n/g, '\n').replace(/([^\n])$/g, '$1\n');
    }
    return logs;
  } catch (error) {
    console.error(`获取标准输出日志失败 (${programName}):`, error + '\n');
    throw error;
  }
};

// 获取程序标准错误日志
const getProcessStderrLog = async (projectId, programName, offset = 0, length = 100000) => {
  try {
    const logs = await callRpc(projectId, 'supervisor.readProcessStderrLog', [programName, offset, length]);
    // 确保日志数据具有正确的换行符格式
    if (typeof logs === 'string') {
      // 统一换行符格式，确保每行日志都以换行符结束
      return logs.replace(/\r\n/g, '\n').replace(/([^\n])$/g, '$1\n');
    }
    return logs;
  } catch (error) {
    console.error(`获取标准错误日志失败 (${programName}):`, error + '\n');
    throw error;
  }
};

// 启动所有程序
const startAllProcesses = async (projectId) => {
  try {
    await callRpc(projectId, 'supervisor.startAllProcesses', []);
    return { success: true, message: '所有程序已启动' };
  } catch (error) {
    console.error('启动所有程序失败:', error + '\n');
    return { success: false, message: `启动失败: ${error.message}` };
  }
};

// 停止所有程序
const stopAllProcesses = async (projectId) => {
  try {
    await callRpc(projectId, 'supervisor.stopAllProcesses', []);
    return { success: true, message: '所有程序已停止' };
  } catch (error) {
    console.error('停止所有程序失败:', error + '\n');
    return { success: false, message: `停止失败: ${error.message}` };
  }
};

// 重启所有程序
const restartAllProcesses = async (projectId) => {
  try {
    await callRpc(projectId, 'supervisor.stopAllProcesses', []);
    await callRpc(projectId, 'supervisor.startAllProcesses', []);
    return { success: true, message: '所有程序已重启' };
  } catch (error) {
    console.error('重启所有程序失败:', error + '\n');
    return { success: false, message: `重启失败: ${error.message}` };
  }
};

// 获取配置文件内容
const getConfigFile = (configPath) => {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(configPath)) {
      // 如果文件不存在，返回模拟配置内容
      const mockConfig = `[program:${path.basename(configPath, '.conf')}]
command=/usr/bin/node /path/to/app.js
autostart=true
autorestart=true
user=www-data
directory=/path/to/app
environment=NODE_ENV=production
stdout_logfile=/var/log/supervisor/${path.basename(configPath, '.conf')}_stdout.log
stderr_logfile=/var/log/supervisor/${path.basename(configPath, '.conf')}_stderr.log
`;
      resolve(mockConfig);
    } else {
      fs.readFile(configPath, 'utf8', (err, data) => {
        if (err) {
          reject(err);
        } else {
          resolve(data);
        }
      });
    }
  });
};

// 检查Supervisor连接状态
const checkConnectionStatus = async (projectId) => {
  return new Promise(async (resolve) => {
    try {
      const supervisorConfig = await getSupervisorConfig(projectId);
      const client = createClient(supervisorConfig);
      
      // 调用一个简单的方法来检查连接
      client.methodCall('supervisor.getState', [], (error) => {
        if (error) {
          resolve({ connected: false, error: error.message });
        } else {
          resolve({ connected: true });
        }
      });
    } catch (error) {
      resolve({ connected: false, error: error.message });
    }
  });
};

module.exports = {
  getAllProcesses,
  startProcess,
  stopProcess,
  restartProcess,
  getProcessLogs,
  getProcessStdoutLog,
  getProcessStderrLog,
  startAllProcesses,
  stopAllProcesses,
  restartAllProcesses,
  getConfigFile,
  checkConnectionStatus
};
