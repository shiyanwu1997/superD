const xmlrpc = require('xmlrpc');
const fs = require('fs');
const path = require('path');

// 从数据库获取项目的Supervisor配置
const db = require('../models/db');
const { SUPERVISOR_CONFIG } = require('../config');

// 导入Logger工具
const Logger = require('../utils/logger');

/**
 * XML-RPC异常处理装饰器
 * 统一处理XML-RPC调用过程中可能发生的各种异常
 * @param {Function} func - 要包装的函数
 * @returns {Function} 包装后的函数
 */
const xmlrpcExceptions = (func) => {
  return async (...args) => {
    try {
      return await func(...args);
    } catch (error) {
      // 记录原始错误
      Logger.error('XML-RPC调用异常', error);
      
      // 分类处理不同类型的错误
      if (error.code === 'ECONNREFUSED') {
        throw new Error(`无法连接到Supervisor服务: ${error.message}`);
      } else if (error.code === 'ETIMEDOUT') {
        throw new Error(`连接Supervisor服务超时: ${error.message}`);
      } else if (error.message && error.message.includes('No such file')) {
        throw new Error(`Supervisor配置文件不存在: ${error.message}`);
      } else if (error.message && error.message.includes('Authentication failed')) {
        throw new Error(`Supervisor认证失败: ${error.message}`);
      } else if (error.message && error.message.includes('SPAWN_ERROR')) {
        throw new Error(`程序启动失败: ${error.message}`);
      } else if (error.faultCode) {
        // 处理XML-RPC Fault错误
        throw new Error(`Supervisor错误 (${error.faultCode}): ${error.faultString}`);
      } else {
        // 其他类型的错误
        throw new Error(`与Supervisor通信失败: ${error.message}`);
      }
    }
  };
};

/**
 * 创建XML-RPC客户端连接到Supervisor服务
 * @param {Object} supervisorConfig - Supervisor配置信息
 * @param {string} supervisorConfig.host - Supervisor服务主机地址
 * @param {number} supervisorConfig.port - Supervisor服务端口
 * @param {string} supervisorConfig.username - Supervisor认证用户名
 * @param {string} supervisorConfig.password - Supervisor认证密码
 * @param {boolean} [supervisorConfig.useHttps] - 是否使用HTTPS
 * @returns {Object} XML-RPC客户端实例
 */
const createClient = (supervisorConfig) => {
  // 检查是否需要使用HTTPS
  const isHttps = supervisorConfig.port === 443 || 
                 supervisorConfig.host.endsWith('https://') ||
                 supervisorConfig.useHttps;
  
  Logger.debug(`创建Supervisor客户端配置`, {
    host: supervisorConfig.host,
    port: supervisorConfig.port,
    path: SUPERVISOR_CONFIG.RPC_PATH,
    isHttps: isHttps,
    username: supervisorConfig.username,
    passwordLength: supervisorConfig.password ? supervisorConfig.password.length : 0
  });
  
  return xmlrpc.createClient({
    host: supervisorConfig.host,
    port: supervisorConfig.port,
    path: SUPERVISOR_CONFIG.RPC_PATH,
    basic_auth: {
      user: supervisorConfig.username,
      pass: supervisorConfig.password
    },
    timeout: SUPERVISOR_CONFIG.TIMEOUT, // 使用配置文件中的超时设置
    secure: isHttps // 启用HTTPS支持
  });
};

/**
 * 获取项目的Supervisor配置信息
 * @param {number} projectId - 项目ID
 * @returns {Promise<Object>} Supervisor配置信息
 * @throws {Error} 如果项目不存在或项目的Supervisor配置不存在
 */
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

/**
 * 通用XML-RPC调用函数，用于与Supervisor服务进行通信
 * @param {number} projectId - 项目ID
 * @param {string} method - RPC方法名
 * @param {Array} [params=[]] - RPC调用参数
 * @returns {Promise<any>} RPC调用结果
 * @throws {Error} 如果连接失败或RPC调用失败
 */
const callRpc = xmlrpcExceptions(async (projectId, method, params = []) => {
  const supervisorConfig = await getSupervisorConfig(projectId);
  Logger.debug(`尝试连接Supervisor服务: ${supervisorConfig.host}:${supervisorConfig.port}${SUPERVISOR_CONFIG.RPC_PATH}`);
  const client = createClient(supervisorConfig);
  
  // 使用Promise包装client.methodCall，确保错误能被xmlrpcExceptions装饰器正确捕获
  return new Promise((resolve, reject) => {
    client.methodCall(method, params, (error, value) => {
      if (error) {
        Logger.error(`RPC调用失败 (${method})`, error);
        // 确保错误对象包含faultCode和faultString字段，以便xmlrpcExceptions装饰器正确处理
        if (error.faultCode === undefined && error.code === 20) {
          error.faultCode = 20;
          error.faultString = error.message;
        }
        reject(error);
      } else {
        Logger.debug(`RPC调用成功 (${method})`, { result: value });
        resolve(value);
      }
    });
  });
});

/**
 * 获取所有程序状态
 * @param {number} projectId - 项目ID
 * @returns {Promise<Array>} 程序状态列表
 */
const getAllProcesses = async (projectId) => {
  const processes = await callRpc(projectId, 'supervisor.getAllProcessInfo');
  
  // 增加详细日志，输出所有原始程序的完整信息
  console.log('=== 开始处理程序列表 ===');
  console.log('原始程序信息列表:', JSON.stringify(processes, null, 2));
  
  // 检查是否包含时间相关字段
  if (processes.length > 0) {
    console.log('第一个程序的所有字段:', Object.keys(processes[0]));
    console.log('时间相关字段检查:');
    console.log('  包含now字段:', 'now' in processes[0]);
    console.log('  包含start字段:', 'start' in processes[0]);
    console.log('  包含spawnerr字段:', 'spawnerr' in processes[0]);
    console.log('  包含state字段:', 'state' in processes[0]);
    console.log('  包含statename字段:', 'statename' in processes[0]);
  }
  
  // 处理程序名称，对于组程序，组合成完整的"组名:实例名"格式
  const processesWithFullName = processes.map(process => {
    // 详细调试信息
    console.log(`\n处理单个程序:`);
    console.log(`  原始group: '${process.group}'`);
    console.log(`  原始name: '${process.name}'`);
    console.log(`  group === name: ${process.group === process.name}`);
    console.log(`  name包含冒号: ${process.name.includes(':')}`);
    
    // 如果有group字段且group不等于name，并且name字段不包含冒号，则组合成完整名称
    if (process.group && process.name && process.group !== process.name && !process.name.includes(':')) {
      const newName = `${process.group}:${process.name}`;
      console.log(`  组合后名称: '${newName}'`);
      return {
        ...process,
        name: newName
      };
    }
    console.log(`  保持原名称: '${process.name}'`);
    return process;
  });
  
  // 只保留去重逻辑，移除所有过滤逻辑
  // 根据程序名称去重，确保每个程序只显示一次
  const uniqueProcesses = [...new Map(processesWithFullName.map(process => [process.name, process])).values()];
  
  // 打印获取到的原始程序列表（用于调试）
  console.log('\n=== 处理结果 ===');
  console.log('原始程序名称列表:', processes.map(p => p.name));
  console.log('处理后的程序名称列表:', processesWithFullName.map(p => p.name));
  console.log('去重后的程序名称列表:', uniqueProcesses.map(p => p.name));
  
  // 返回所有去重后的程序，不做任何过滤
  return uniqueProcesses;
};

/**
 * 启动指定程序
 * @param {number} projectId - 项目ID
 * @param {string} programName - 程序名称
 * @returns {Promise<Object>} 操作结果
 */
const startProcess = xmlrpcExceptions(async (projectId, programName) => {
  try {
    // 首先获取程序启动前的状态
    let programInfo;
    try {
      programInfo = await callRpc(projectId, 'supervisor.getProcessInfo', [programName]);
      Logger.info(`程序 ${programName} 启动前状态: ${programInfo.statename}`);
      console.log(`程序 ${programName} 启动前状态: ${programInfo.statename}`);
      
      // 如果程序已经处于RUNNING状态，直接返回成功
      if (programInfo.statename === 'RUNNING') {
        Logger.info(`程序 ${programName} 已经处于运行状态，无需重复启动`);
        console.log(`程序 ${programName} 已经处于运行状态，无需重复启动`);
        return { success: true, message: `${programName} 已经在运行` };
      }
    } catch (err) {
      Logger.warn(`获取程序 ${programName} 启动前状态失败: ${err.message}`);
      console.warn(`获取程序 ${programName} 启动前状态失败: ${err.message}`);
    }
    
    // 调用supervisor.startProcess
    Logger.info(`尝试启动程序: ${programName}`);
    console.log(`尝试启动程序: ${programName}`);
    
    // 注意：这里不直接检查supervisor.startProcess的返回值
    // 因为即使返回true，程序也可能启动失败（如BACKOFF/FATAL状态）
    await callRpc(projectId, 'supervisor.startProcess', [programName]);
    
    // 实现严格的双重RUNNING状态检查机制
    // 无论初始状态如何，都至少检查两次，确保程序稳定运行
    const maxAttempts = 30;
    let successfulChecks = 0;
    let lastKnownState = 'UNKNOWN';
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      // 动态调整检查间隔：前5次尝试间隔500ms，之后间隔1000ms
      // 这样可以更快地检测到程序状态变化，同时保持总检查时间在合理范围内
      const delay = attempt <= 5 ? 500 : 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // 直接获取单个程序的信息
      try {
        programInfo = await callRpc(projectId, 'supervisor.getProcessInfo', [programName]);
        const currentState = programInfo.statename;
        console.log(`\n=== 检查程序状态 (尝试 ${attempt}/${maxAttempts}) ===`);
        console.log(`程序 ${programName} 当前状态: ${currentState}`);
        console.log(`完整程序信息: ${JSON.stringify(programInfo, null, 2)}`);
        
        // 更新最后已知状态
        lastKnownState = currentState;
        
        // 如果状态是BACKOFF或FATAL，说明程序启动失败
        if (currentState === 'BACKOFF' || currentState === 'FATAL') {
          Logger.error(`程序 ${programName} 启动失败，当前状态: ${currentState}`);
          console.error(`程序 ${programName} 启动失败，当前状态: ${currentState}`);
          return { success: false, message: `程序 ${programName} 启动失败，当前状态: ${currentState}` };
        }
        
        // 如果状态是STOPPED，说明程序启动失败
        if (currentState === 'STOPPED') {
          Logger.error(`程序 ${programName} 启动失败，当前状态: ${currentState}`);
          console.error(`程序 ${programName} 启动失败，当前状态: ${currentState}`);
          return { success: false, message: `程序 ${programName} 启动失败，当前状态: ${currentState}` };
        }
        
        // 如果状态是RUNNING，增加成功检查计数
        if (currentState === 'RUNNING') {
          successfulChecks++;
          Logger.debug(`程序 ${programName} 运行状态检查通过 (${successfulChecks}/2)`);
          console.log(`程序 ${programName} 运行状态检查通过 (${successfulChecks}/2)`);
          
          // 如果连续两次检查都处于RUNNING状态，说明程序稳定运行
          if (successfulChecks === 2) {
            Logger.info(`程序 ${programName} 启动成功并稳定运行，当前状态: RUNNING`);
            console.log(`程序 ${programName} 启动成功并稳定运行，当前状态: RUNNING`);
            return { success: true, message: `${programName} 已启动` };
          }
        } else {
          // 其他状态（如STARTING）重置成功检查计数
          successfulChecks = 0;
          Logger.debug(`程序 ${programName} 处于中间状态: ${currentState}，重置成功检查计数`);
          console.log(`程序 ${programName} 处于中间状态: ${currentState}，重置成功检查计数`);
        }
      } catch (err) {
        console.error(`ERROR: 获取程序状态失败: ${err.message}`);
        // 重置成功检查计数，确保必须连续两次成功检查
        successfulChecks = 0;
        continue; // 继续尝试下一次检查
      }
    }
    
    // 所有尝试后仍然没有稳定在RUNNING状态
    Logger.error(`程序 ${programName} 启动超时，最后已知状态: ${lastKnownState}`);
    console.error(`程序 ${programName} 启动超时，最后已知状态: ${lastKnownState}`);
    return { success: false, message: `程序 ${programName} 启动超时，最后已知状态: ${lastKnownState}` };
  } catch (error) {
    Logger.error(`启动程序失败 (${programName}):`, error);
    console.error(`启动程序失败 (${programName}):`, error);
    return { success: false, message: `启动失败: ${error.message}` };
  }
});

// 停止程序
const stopProcess = xmlrpcExceptions(async (projectId, programName) => {
  try {
    await callRpc(projectId, 'supervisor.stopProcess', [programName]);
    
    // 停止后验证程序是否真的处于停止状态
    // 实现双重STOPPED状态检查机制
    const maxAttempts = 10;
    const delay = 1000; // 每次检查间隔1秒
    let successfulChecks = 0;
    let lastKnownState = 'UNKNOWN';
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // 获取程序状态
      const processes = await getAllProcesses(projectId);
      
      // 查找程序，考虑组程序名称格式
      const program = processes.find(p => 
        p.name === programName || 
        (p.name.includes(':') && p.name.split(':')[1] === programName)
      );
      
      if (!program) {
        throw new Error('停止后未找到程序: ' + programName);
      }
      
      // 检查程序状态
      Logger.debug('程序停止状态检查 (' + attempt + '/' + maxAttempts + '): ' + programName + ' - ' + program.statename);
      
      lastKnownState = program.statename;
      
      // 检查程序状态是否为停止 (STOPPED)
      if (program.statename === 'STOPPED') {
        successfulChecks++;
        Logger.debug('程序 ' + programName + ' 停止状态检查通过 (' + successfulChecks + '/2)');
        
        // 如果连续两次检查都处于STOPPED状态，说明程序稳定停止
        if (successfulChecks === 2) {
          Logger.info('程序 ' + programName + ' 停止成功并稳定在停止状态，当前状态: STOPPED');
          return { success: true, message: programName + ' 已停止' };
        }
      } else {
        // 其他状态重置成功检查计数
        successfulChecks = 0;
      }
    }
    
    // 所有尝试后仍然没有稳定在STOPPED状态
    const finalProcesses = await getAllProcesses(projectId);
    const finalProgram = finalProcesses.find(p => 
      p.name === programName || 
      (p.name.includes(':') && p.name.split(':')[1] === programName)
    );
    const finalState = finalProgram ? finalProgram.statename : 'UNKNOWN';
    
    throw new Error('程序 ' + programName + ' 停止超时，最后已知状态: ' + finalState);
  } catch (error) {
    Logger.error('停止程序失败 (' + programName + '):', error);
    return { success: false, message: '停止失败: ' + error.message };
  }
});

// 重启程序
const restartProcess = xmlrpcExceptions(async (projectId, programName) => {
  try {
    // 更可靠的重启逻辑：无论程序当前状态如何，先尝试停止，然后再启动
    // 1. 先尝试停止程序（如果程序在运行，会停止；如果已停止，会返回错误，但我们忽略）
    try {
      Logger.info('尝试停止程序 ' + programName);
      await callRpc(projectId, 'supervisor.stopProcess', [programName]);
      // 给程序一些停止时间
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (stopError) {
      // 忽略停止错误，因为程序可能已经停止
      Logger.info('停止程序 ' + programName + ' 失败（可能已停止）: ' + stopError.message);
    }
    
    // 2. 然后启动程序
    Logger.info('尝试启动程序 ' + programName);
    const result = await callRpc(projectId, 'supervisor.startProcess', [programName]);
    if (result !== true) {
      throw new Error('调用supervisor.startProcess失败: ' + result);
    }
    
    // 验证程序是否真的处于运行状态
    // 实现双重RUNNING状态检查机制
    const maxAttempts = 10;
    const delay = 1000; // 每次检查间隔1秒
    let successfulChecks = 0;
    let lastKnownState = 'UNKNOWN';
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // 获取程序状态
      const processesAfter = await getAllProcesses(projectId);
      
      // 查找程序，考虑组程序名称格式
      const programAfter = processesAfter.find(p => 
        p.name === programName || 
        (p.name.includes(':') && p.name.split(':')[1] === programName)
      );
      
      if (!programAfter) {
        throw new Error('重启后未找到程序: ' + programName);
      }
      
      // 检查程序状态
      Logger.debug('重启后程序状态检查 (' + attempt + '/' + maxAttempts + '): ' + programName + ' - ' + programAfter.statename);
      
      lastKnownState = programAfter.statename;
      
      if (programAfter.statename === 'RUNNING') {
        successfulChecks++;
        Logger.debug('程序 ' + programName + ' 运行状态检查通过 (' + successfulChecks + '/2)');
        
        // 如果连续两次检查都处于RUNNING状态，说明程序稳定运行
        if (successfulChecks === 2) {
          Logger.info('程序 ' + programName + ' 重启成功并稳定运行，当前状态: RUNNING');
          return { success: true, message: programName + ' 已重启' };
        }
      } else if (programAfter.statename === 'BACKOFF' || programAfter.statename === 'FATAL') {
        // 如果状态是BACKOFF或FATAL，说明程序重启失败，直接返回错误
        Logger.error('程序 ' + programName + ' 重启失败，当前状态: ' + programAfter.statename);
        throw new Error('程序 ' + programName + ' 重启失败，当前状态: ' + programAfter.statename);
      } else {
        // 其他状态（如STARTING）重置成功检查计数
        successfulChecks = 0;
      }
    }
    
    // 所有尝试后仍然没有稳定在RUNNING状态
    const finalProcesses = await getAllProcesses(projectId);
    const finalProgram = finalProcesses.find(p => 
      p.name === programName || 
      (p.name.includes(':') && p.name.split(':')[1] === programName)
    );
    const finalState = finalProgram ? finalProgram.statename : 'UNKNOWN';
    
    Logger.error('程序 ' + programName + ' 重启超时，最后已知状态: ' + finalState);
    throw new Error('程序 ' + programName + ' 重启超时，最后已知状态: ' + finalState);
  } catch (error) {
    Logger.error('重启程序失败 (' + programName + '):', error);
    return { success: false, message: '重启失败: ' + error.message };
  }
});

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
    // 安全检查：即使收到offset=-1，也只获取当前偏移量的日志，不返回历史日志
    if (offset === -1) {
      // 获取当前日志文件大小，直接返回空日志和当前文件大小作为偏移量
      let fileSize = 0;
      try {
        const info = await callRpc(projectId, 'supervisor.getProcessInfo', [programName]);
        fileSize = info.stdout_logfile_size || 0;
      } catch (error) {
        console.error(`获取进程信息失败 (${programName}):`, error);
      }
      return { logs: '', offset: fileSize };
    }
    
    // 使用readProcessStdoutLog获取从指定偏移量开始的日志
    let logs = await callRpc(projectId, 'supervisor.readProcessStdoutLog', [programName, offset, length]);
    
    // 确保日志数据具有正确的换行符格式
    if (typeof logs === 'string') {
      // 统一换行符格式，确保每行日志都以换行符结束
      logs = logs.replace(/\r\n/g, '\n');
    } else {
      logs = logs || '';
    }
    
    // 计算新的偏移量
    const newOffset = offset + logs.length;
    
    // 直接返回正常顺序的日志，不进行反转
    return { logs, offset: newOffset };
  } catch (error) {
    // 如果是NO_FILE错误，返回空日志而不是抛出错误，并且减少日志输出
    if (error.message?.includes('NO_FILE')) {
      console.debug(`获取标准输出日志失败 (${programName}): 日志文件不存在，返回空日志`);
      return { logs: '', offset: offset };
    }
    // 其他错误仍然记录为错误日志
    console.error(`获取标准输出日志失败 (${programName}):`, error + '\n');
    throw error;
  }
};

// 获取程序标准错误日志
const getProcessStderrLog = async (projectId, programName, offset = 0, length = 100000) => {
  try {
    // 安全检查：即使收到offset=-1，也只获取当前偏移量的日志，不返回历史日志
    if (offset === -1) {
      // 获取当前日志文件大小，直接返回空日志和当前文件大小作为偏移量
      let fileSize = 0;
      try {
        const info = await callRpc(projectId, 'supervisor.getProcessInfo', [programName]);
        fileSize = info.stderr_logfile_size || 0;
      } catch (error) {
        console.error(`获取进程信息失败 (${programName}):`, error);
      }
      return { logs: '', offset: fileSize };
    }
    
    // 使用readProcessStderrLog获取从指定偏移量开始的日志
    let logs = await callRpc(projectId, 'supervisor.readProcessStderrLog', [programName, offset, length]);
    
    // 确保日志数据具有正确的换行符格式
    if (typeof logs === 'string') {
      // 统一换行符格式，确保每行日志都以换行符结束
      logs = logs.replace(/\r\n/g, '\n');
    } else {
      logs = logs || '';
    }
    
    // 计算新的偏移量
    const newOffset = offset + logs.length;
    
    // 直接返回正常顺序的日志，不进行反转
    return { logs, offset: newOffset };
  } catch (error) {
    // 如果是NO_FILE错误，返回空日志而不是抛出错误，并且减少日志输出
    if (error.message?.includes('NO_FILE')) {
      console.debug(`获取标准错误日志失败 (${programName}): 日志文件不存在，返回空日志`);
      return { logs: '', offset: offset };
    }
    // 其他错误仍然记录为错误日志
    console.error(`获取标准错误日志失败 (${programName}):`, error + '\n');
    throw error;
  }
};

// 启动所有程序
const startAllProcesses = xmlrpcExceptions(async (projectId) => {
  try {
    // 调用supervisor.startAllProcesses
    Logger.info('尝试启动所有程序');
    console.log('尝试启动所有程序');
    await callRpc(projectId, 'supervisor.startAllProcesses', []);
    
    // 实现双重RUNNING状态检查机制
    // 无论初始状态如何，都至少检查两次，确保所有程序稳定运行
    const maxAttempts = 15;
    const delay = 1000; // 每次检查间隔1秒
    let successfulChecks = 0;
    let lastFailedProcesses = [];
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // 获取所有程序的信息
      const allProcesses = await getAllProcesses(projectId);
      
      console.log(`\n=== 检查所有程序状态 (尝试 ${attempt}/${maxAttempts}) ===`);
      console.log(`总程序数: ${allProcesses.length}`);
      
      // 检查所有程序的状态
      // 只将 BACKOFF 和 FATAL 视为真正的启动失败
      // STOPPED 状态可能是程序本来就处于停止状态，不是启动失败
      const failedProcesses = allProcesses.filter(process => {
        const isFailed = ['BACKOFF', 'FATAL'].includes(process.statename);
        if (isFailed) {
          console.log(`程序 ${process.name} 启动失败，当前状态: ${process.statename}`);
        } else {
          console.log(`程序 ${process.name} 当前状态: ${process.statename}`);
        }
        return isFailed;
      });
      
      // 统计停止状态的程序
      const stoppedProcesses = allProcesses.filter(process => process.statename === 'STOPPED');
      if (stoppedProcesses.length > 0) {
        console.log(`发现 ${stoppedProcesses.length} 个程序处于 STOPPED 状态，这些可能是本来就未启动的程序`);
      }
      
      lastFailedProcesses = failedProcesses;
      
      // 如果所有程序都处于正常状态（不是BACKOFF、FATAL）
      // STOPPED状态不再被视为失败，因为有些程序可能本来就处于停止状态
      if (failedProcesses.length === 0) {
        successfulChecks++;
        console.log(`所有程序状态检查通过 (${successfulChecks}/2)`);
        
        // 如果连续两次检查都处于正常状态，说明所有程序稳定运行
        if (successfulChecks === 2) {
          // 构建更准确的结果信息
          const runningProcesses = allProcesses.filter(p => p.statename === 'RUNNING');
          const totalProcesses = allProcesses.length;
          const successMessage = runningProcesses.length === totalProcesses 
            ? '所有程序已启动' 
            : `已成功启动 ${runningProcesses.length}/${totalProcesses} 个程序`;
            
          Logger.info('所有程序启动成功并稳定运行');
          console.log('所有程序启动成功并稳定运行');
          return { success: true, message: successMessage };
        }
      } else {
        // 有程序失败，重置成功检查计数
        successfulChecks = 0;
        console.log(`发现 ${failedProcesses.length} 个程序启动失败，重置成功检查计数`);
      }
    }
    
    // 所有尝试后仍然有程序未稳定运行
    Logger.error(`部分程序启动失败，最后一次检查发现 ${lastFailedProcesses.length} 个程序异常`);
    console.error(`部分程序启动失败，最后一次检查发现 ${lastFailedProcesses.length} 个程序异常`);
    
    // 构建详细的错误信息
    const errorProcesses = lastFailedProcesses.map(p => `${p.name} (${p.statename})`).join(', ');
    return { 
      success: false, 
      message: `部分程序启动失败: ${errorProcesses}` 
    };
  } catch (error) {
    Logger.error('启动所有程序失败:', error);
    console.error('启动所有程序失败:', error + '\n');
    return { success: false, message: `启动失败: ${error.message}` };
  }
});

// 停止所有程序
const stopAllProcesses = xmlrpcExceptions(async (projectId) => {
  try {
    // 调用supervisor.stopAllProcesses
    Logger.info('尝试停止所有程序');
    console.log('尝试停止所有程序');
    await callRpc(projectId, 'supervisor.stopAllProcesses', []);
    
    // 实现双重STOPPED状态检查机制
    // 无论初始状态如何，都至少检查两次，确保所有程序稳定停止
    const maxAttempts = 15;
    const delay = 1000; // 每次检查间隔1秒
    let successfulChecks = 0;
    let lastFailedProcesses = [];
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // 获取所有程序的信息
      const allProcesses = await getAllProcesses(projectId);
      
      console.log(`\n=== 检查所有程序停止状态 (尝试 ${attempt}/${maxAttempts}) ===`);
      console.log(`总程序数: ${allProcesses.length}`);
      
      // 检查所有程序的状态
      const failedProcesses = allProcesses.filter(process => {
        const isRunning = process.statename === 'RUNNING';
        if (isRunning) {
          console.log(`程序 ${process.name} 未成功停止，当前状态: ${process.statename}`);
        } else {
          console.log(`程序 ${process.name} 当前状态: ${process.statename}`);
        }
        return isRunning;
      });
      
      lastFailedProcesses = failedProcesses;
      
      // 如果所有程序都处于停止或非运行状态
      if (failedProcesses.length === 0) {
        successfulChecks++;
        console.log(`所有程序停止状态检查通过 (${successfulChecks}/2)`);
        
        // 如果连续两次检查都处于停止状态，说明所有程序稳定停止
        if (successfulChecks === 2) {
          Logger.info('所有程序停止成功并稳定在停止状态');
          console.log('所有程序停止成功并稳定在停止状态');
          return { success: true, message: '所有程序已停止' };
        }
      } else {
        // 有程序未停止，重置成功检查计数
        successfulChecks = 0;
        console.log(`发现 ${failedProcesses.length} 个程序未成功停止，重置成功检查计数`);
      }
    }
    
    // 所有尝试后仍然有程序未停止
    Logger.error(`部分程序停止失败，最后一次检查发现 ${lastFailedProcesses.length} 个程序仍在运行`);
    console.error(`部分程序停止失败，最后一次检查发现 ${lastFailedProcesses.length} 个程序仍在运行`);
    
    // 构建详细的错误信息
    const errorProcesses = lastFailedProcesses.map(p => `${p.name} (${p.statename})`).join(', ');
    return { 
      success: false, 
      message: `部分程序停止失败: ${errorProcesses}` 
    };
  } catch (error) {
    Logger.error('停止所有程序失败:', error);
    console.error('停止所有程序失败:', error + '\n');
    return { success: false, message: `停止失败: ${error.message}` };
  }
});

// 重启所有程序
const restartAllProcesses = xmlrpcExceptions(async (projectId) => {
  try {
    // 调用supervisor.stopAllProcesses和supervisor.startAllProcesses
    Logger.info('尝试重启所有程序');
    console.log('尝试重启所有程序');
    await callRpc(projectId, 'supervisor.stopAllProcesses', []);
    await callRpc(projectId, 'supervisor.startAllProcesses', []);
    
    // 实现双重RUNNING状态检查机制
    // 无论初始状态如何，都至少检查两次，确保所有程序稳定运行
    const maxAttempts = 15;
    const delay = 1000; // 每次检查间隔1秒
    let successfulChecks = 0;
    let lastFailedProcesses = [];
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // 获取所有程序的信息
      const allProcesses = await getAllProcesses(projectId);
      
      console.log(`\n=== 检查所有程序重启状态 (尝试 ${attempt}/${maxAttempts}) ===`);
      console.log(`总程序数: ${allProcesses.length}`);
      
      // 检查所有程序的状态
      // 只将 BACKOFF 和 FATAL 视为真正的重启失败
      // STOPPED 状态可能是程序本来就处于停止状态，不是重启失败
      const failedProcesses = allProcesses.filter(process => {
        const isFailed = ['BACKOFF', 'FATAL'].includes(process.statename);
        if (isFailed) {
          console.log(`程序 ${process.name} 重启失败，当前状态: ${process.statename}`);
        } else {
          console.log(`程序 ${process.name} 当前状态: ${process.statename}`);
        }
        return isFailed;
      });
      
      // 统计停止状态的程序
      const stoppedProcesses = allProcesses.filter(process => process.statename === 'STOPPED');
      if (stoppedProcesses.length > 0) {
        console.log(`发现 ${stoppedProcesses.length} 个程序处于 STOPPED 状态，这些可能是本来就未启动的程序`);
      }
      
      lastFailedProcesses = failedProcesses;
      
      // 如果所有程序都处于正常状态（不是BACKOFF、FATAL）
      // STOPPED状态不再被视为失败，因为有些程序可能本来就处于停止状态
      if (failedProcesses.length === 0) {
        successfulChecks++;
        console.log(`所有程序状态检查通过 (${successfulChecks}/2)`);
        
        // 如果连续两次检查都处于正常状态，说明所有程序稳定运行
        if (successfulChecks === 2) {
          // 构建更准确的结果信息
          const runningProcesses = allProcesses.filter(p => p.statename === 'RUNNING');
          const totalProcesses = allProcesses.length;
          const successMessage = runningProcesses.length === totalProcesses 
            ? '所有程序已重启' 
            : `已成功重启 ${runningProcesses.length}/${totalProcesses} 个程序`;
            
          Logger.info('所有程序重启成功并稳定运行');
          console.log('所有程序重启成功并稳定运行');
          return { success: true, message: successMessage };
        }
      } else {
        // 有程序失败，重置成功检查计数
        successfulChecks = 0;
        console.log(`发现 ${failedProcesses.length} 个程序重启失败，重置成功检查计数`);
      }
    }
    
    // 所有尝试后仍然有程序未稳定运行
    Logger.error(`部分程序重启失败，最后一次检查发现 ${lastFailedProcesses.length} 个程序异常`);
    console.error(`部分程序重启失败，最后一次检查发现 ${lastFailedProcesses.length} 个程序异常`);
    
    // 构建详细的错误信息
    const errorProcesses = lastFailedProcesses.map(p => `${p.name} (${p.statename})`).join(', ');
    return { 
      success: false, 
      message: `部分程序重启失败: ${errorProcesses}` 
    };
  } catch (error) {
    Logger.error('重启所有程序失败:', error);
    console.error('重启所有程序失败:', error + '\n');
    return { success: false, message: `重启失败: ${error.message}` };
  }
});

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
  try {
    console.log(`=== 开始检查项目${projectId}的连接状态 ===`);
    
    // 使用与getAllProcesses相同的callRpc函数检查连接状态，确保行为一致
    await callRpc(projectId, 'supervisor.getAllProcessInfo');
    
    console.log(`项目${projectId}连接状态检查成功`);
    return { connected: true };
  } catch (error) {
    // 详细记录错误信息以便调试
    console.error(`检查项目${projectId}连接状态失败:`, error);
    console.error(`错误详情:`, error.stack);
    
    // 返回具体错误信息而不是统一的"连接失败"
    const errorMessage = error.message || JSON.stringify(error);
    return { connected: false, error: errorMessage };
  }
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
  checkConnectionStatus,
  callRpc
};
