const { Server } = require('socket.io');
const { getProcessStdoutLog, getProcessStderrLog, callRpc } = require('./supervisorService');

class SocketServer {
  constructor(server) {
    this.io = new Server(server, {
      path: '/socket.io',
      cors: {
        origin: function(origin, callback) {
          // 允许本地开发环境的所有请求
          if (!origin || origin.startsWith('http://localhost:')) {
            callback(null, true);
          } else {
            callback(new Error('Not allowed by CORS'));
          }
        },
        credentials: true,
        methods: ['GET', 'POST']
      },
      transports: ['polling', 'websocket'],
      allowEIO3: true
    });
    
    this.connections = new Map();
    this.timers = new Map();
    
    this.initialize();
  }
  
  initialize() {
    this.io.on('connection', (socket) => {
      console.log(`Socket connected: ${socket.id}`);
      this.connections.set(socket.id, {
        socket: socket,
        programId: null,
        logType: null,
        offset: null, // 初始化为null，确保获取当前日志文件大小作为初始偏移量
        isInitialFetch: false, // 是否处于初始获取状态
        emptyLogCount: 0, // 连续获取空日志的次数
        isReducedInterval: false // 是否处于减少轮询间隔的状态
      });
      
      socket.on('start_log_tail', (data) => {
        this.startLogTail(socket.id, data.programId, data.logType);
      });
      
      socket.on('stop_log_tail', () => {
        this.stopLogTail(socket.id);
      });
      
      socket.on('disconnect', () => {
        console.log(`Socket disconnected: ${socket.id}`);
        this.stopLogTail(socket.id);
        this.connections.delete(socket.id);
      });
    });
  }
  
  async startLogTail(socketId, programId, logType) {
    const connection = this.connections.get(socketId);
    if (!connection) return;
    
    // 更新连接信息
    connection.programId = programId;
    connection.logType = logType;
    connection.offset = null; // 重置偏移量为null，这是关键
    connection.isInitialFetch = true; // 标记为初始获取
    connection.emptyLogCount = 0; // 重置空日志计数
    connection.isReducedInterval = false; // 重置轮询间隔状态
    
    // 清除之前的定时器
    this.stopLogTail(socketId);
    
    // 设置定时器定期获取日志
    // 立即执行一次，不要等待第一个间隔
    this.fetchAndPushLogs(socketId);
    
    const timerId = setInterval(() => {
      this.fetchAndPushLogs(socketId);
    }, 1000); // 每秒获取一次日志
    
    this.timers.set(socketId, timerId);
  }
  
  stopLogTail(socketId) {
    if (this.timers.has(socketId)) {
      clearInterval(this.timers.get(socketId));
      this.timers.delete(socketId);
    }
  }
  
  async fetchAndPushLogs(socketId) {
    const connection = this.connections.get(socketId);
    if (!connection || !connection.programId || !connection.logType) return;
    
    try {
      let logResult;
      // programId格式为：projectId-programName
      const firstDashIndex = connection.programId.indexOf('-');
      if (firstDashIndex === -1) {
        throw new Error('无效的程序ID格式');
      }
      const projectId = connection.programId.substring(0, firstDashIndex);
      const programName = connection.programId.substring(firstDashIndex + 1);
      
      // 只获取增量日志，不获取历史日志
      const readLength = 10000;
      
      // [修复] 使用严格等于 null 来判断是否初始化，避免 offset 为 0 时被误判
      if (connection.offset === null) {
        // 获取程序信息，包括日志文件大小
        try {
          const processInfo = await callRpc(projectId, 'supervisor.getProcessInfo', [programName]);
          const logFileSize = connection.logType === 'stdout' ? 
            processInfo.stdout_logfile_size || 0 : 
            processInfo.stderr_logfile_size || 0;
          connection.offset = logFileSize;
        } catch (error) {
          console.error(`获取进程信息失败 (${programName}):`, error);
          // 如果获取失败，使用0作为初始偏移量
          connection.offset = 0;
        }
        
        // 发送初始日志块（空内容），让前端清空终端并显示提示信息
        connection.socket.emit('log_chunk', {
          programId: connection.programId,
          logType: connection.logType,
          logs: '',
          isInitial: true
        });
        
        // 标记初始获取完成
        connection.isInitialFetch = false;
        return; // 初始获取完成后，直接返回，不继续获取日志
      }
      
      if (connection.logType === 'stdout') {
        logResult = await getProcessStdoutLog(projectId, programName, connection.offset, readLength);
      } else {
        logResult = await getProcessStderrLog(projectId, programName, connection.offset, readLength);
      }
      
      if (logResult.logs && logResult.logs.length > 0) {
          // 发送日志数据，这是新的实时日志，不需要isInitial标记
          connection.socket.emit('log_chunk', {
            programId: connection.programId,
            logType: connection.logType,
            logs: logResult.logs
            // 不再发送isInitial标记，所有后续日志都是新的实时日志
          });
        
        // 更新偏移量
        connection.offset = logResult.offset;
        
        // 重置空日志计数
        connection.emptyLogCount = 0;
        
        // 如果当前处于减少轮询间隔的状态，恢复正常轮询间隔
        if (connection.isReducedInterval) {
          this.stopLogTail(socketId);
          const timerId = setInterval(() => {
            this.fetchAndPushLogs(socketId);
          }, 1000); // 恢复正常轮询间隔：每秒获取一次日志
          this.timers.set(socketId, timerId);
          connection.isReducedInterval = false;
        }
      } else {
        // 没有获取到日志内容
        connection.emptyLogCount++;
        
        // 如果连续5次获取到空日志，减少轮询间隔
        if (connection.emptyLogCount >= 5 && !connection.isReducedInterval) {
          this.stopLogTail(socketId);
          const timerId = setInterval(() => {
            this.fetchAndPushLogs(socketId);
          }, 10000); // 减少轮询间隔：每10秒获取一次日志
          this.timers.set(socketId, timerId);
          connection.isReducedInterval = true;
          // console.log(`已减少日志轮询频率: ${connection.programId} (${connection.logType})`);
        } else if (connection.emptyLogCount < 5) {
          // 仍然发送空日志块，让前端知道没有日志内容
          connection.socket.emit('log_chunk', {
            programId: connection.programId,
            logType: connection.logType,
            logs: ''
          });
        }
      }
      
    } catch (error) {
      console.error(`Error fetching logs for ${connection.programId} (${connection.logType}):`, error.message);
      // 如果是NO_FILE错误，不发送错误信息，因为这是正常情况
      if (!error.message.includes('NO_FILE')) {
        connection.socket.emit('log_error', {
          programId: connection.programId,
          logType: connection.logType,
          error: error.message
        });
      } else {
        // NO_FILE错误，视为空日志处理
        connection.emptyLogCount++;
        
        // 发送空日志块
        if (connection.emptyLogCount < 5) {
          connection.socket.emit('log_chunk', {
            programId: connection.programId,
            logType: connection.logType,
            logs: ''
          });
        }
        
        // 如果连续5次获取到NO_FILE错误，减少轮询间隔
        if (connection.emptyLogCount >= 5 && !connection.isReducedInterval) {
          this.stopLogTail(socketId);
          const timerId = setInterval(() => {
            this.fetchAndPushLogs(socketId);
          }, 10000); // 减少轮询间隔：每10秒获取一次日志
          this.timers.set(socketId, timerId);
          connection.isReducedInterval = true;
        }
      }
    }
  }
}

module.exports = SocketServer;