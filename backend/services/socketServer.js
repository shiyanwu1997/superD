const { Server } = require('socket.io');
const { getProcessStdoutLog, getProcessStderrLog } = require('./supervisorService');

class SocketServer {
  constructor(server) {
    this.io = new Server(server, {
      cors: {
        origin: function(origin, callback) {
          // 允许本地开发环境的所有请求
          if (!origin || origin.startsWith('http://localhost:')) {
            callback(null, true);
          } else {
            callback(new Error('Not allowed by CORS'));
          }
        },
        credentials: true
      }
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
        offset: 0
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
    connection.offset = 0;
    
    // 清除之前的定时器
    this.stopLogTail(socketId);
    
    // 初始获取最新日志
    await this.fetchAndPushLogs(socketId);
    
    // 设置定时器定期获取日志
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
      
      if (connection.logType === 'stdout') {
        logResult = await getProcessStdoutLog(connection.programId, connection.offset, 10000);
      } else {
        logResult = await getProcessStderrLog(connection.programId, connection.offset, 10000);
      }
      
      if (logResult.logs && logResult.logs.length > 0) {
        // 发送日志数据
        connection.socket.emit('log_chunk', {
          programId: connection.programId,
          logType: connection.logType,
          logs: logResult.logs
        });
        
        // 更新偏移量
        connection.offset = logResult.offset;
      }
      
    } catch (error) {
      console.error(`Error fetching logs for ${connection.programId} (${connection.logType}):`, error);
      connection.socket.emit('log_error', {
        programId: connection.programId,
        logType: connection.logType,
        error: error.message
      });
    }
  }
}

module.exports = SocketServer;
