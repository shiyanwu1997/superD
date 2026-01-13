const { io } = require('socket.io-client');

// 配置
const PROGRAM_ID = '1-fake_web_server';
const LOG_TYPE = 'stdout';
const SOCKET_URL = 'http://localhost:3000';
const MAX_LOGS_TO_DISPLAY = 100;

// 状态
let socket = null;
let rawLogs = '';
let logChunks = [];
let totalBytes = 0;

// 分析日志
function analyzeLogs() {
  console.log('\n\n=== 📊 日志分析结果 ===');
  console.log(`总接收字节数: ${totalBytes}`);
  console.log(`总日志块数: ${logChunks.length}`);
  console.log(`原始日志长度: ${rawLogs.length}`);
  
  // 检查是否有控制字符
  const hasControlChars = /[\x00-\x09\x0B-\x1F\x7F-\x9F]/.test(rawLogs);
  console.log(`包含控制字符: ${hasControlChars}`);
  
  // 检查是否有ANSI转义序列
  const hasAnsiSequences = /\u001B\[[^m]*m/.test(rawLogs);
  console.log(`包含ANSI转义序列: ${hasAnsiSequences}`);
  
  // 检查行首空白字符
  const lines = rawLogs.split('\n').filter(line => line.trim() !== '');
  console.log(`总日志行数: ${lines.length}`);
  
  const linesWithLeadingSpaces = lines.filter(line => /^\s+/.test(line));
  console.log(`行首有空白字符的行数: ${linesWithLeadingSpaces.length}`);
  
  if (linesWithLeadingSpaces.length > 0) {
    console.log('\n示例 (行首有空白字符):');
    linesWithLeadingSpaces.slice(0, 5).forEach((line, i) => {
      console.log(`  [${i+1}] "${line}"`);
      console.log(`     行首字符:`, [...line].map(c => c.charCodeAt(0)).slice(0, 10));
    });
  }
  
  // 检查重复日志
  const uniqueLines = [...new Set(lines)];
  console.log(`唯一日志行数: ${uniqueLines.length}`);
  if (lines.length > uniqueLines.length) {
    console.log(`重复行数: ${lines.length - uniqueLines.length}`);
  }
}

// 连接到Socket.io服务器
function connectSocket() {
  console.log(`正在连接到 ${SOCKET_URL}...`);
  
  socket = io(SOCKET_URL, {
    transports: ['polling', 'websocket'],
    timeout: 5000,
    reconnectionAttempts: 3
  });
  
  socket.on('connect', () => {
    console.log('✅ Socket.io连接成功');
    
    // 发送日志请求
    socket.emit('start_log_tail', {
      programId: PROGRAM_ID,
      logType: LOG_TYPE,
      offset: -1 // 从文件末尾开始读取
    });
    
    console.log(`📝 已发送日志请求: ${PROGRAM_ID} (${LOG_TYPE})`);
  });
  
  socket.on('connect_error', (error) => {
    console.error('❌ Socket.io连接错误:', error);
    process.exit(1);
  });
  
  socket.on('log_chunk', (data) => {
    if (data.programId === PROGRAM_ID && data.logType === LOG_TYPE) {
      if (data.logs && data.logs.trim() !== '') {
        console.log(`\n\n=== 📦 收到日志块 (${logChunks.length + 1}) ===`);
        console.log(`块大小: ${data.logs.length} 字节`);
        
        // 保存原始日志
        rawLogs += data.logs;
        logChunks.push(data.logs);
        totalBytes += data.logs.length;
        
        // 显示部分原始日志
        console.log('\n原始日志内容预览 (前5行):');
        const chunkLines = data.logs.split('\n').filter(line => line.trim() !== '');
        chunkLines.slice(0, Math.min(5, chunkLines.length)).forEach((line, i) => {
          console.log(`  [${i+1}] "${line}"`);
        });
        
        if (chunkLines.length > 5) {
          console.log('  ...');
          console.log(`  共 ${chunkLines.length} 行`);
        }
        
        // 分析前几个日志块
        if (logChunks.length >= 3) {
          analyzeLogs();
          disconnectSocket();
        }
      }
    }
  });
  
  socket.on('log_error', (data) => {
    console.error('❌ 日志错误:', data);
    process.exit(1);
  });
  
  socket.on('disconnect', () => {
    console.log('\n🔌 Socket.io连接断开');
  });
}

// 断开连接
function disconnectSocket() {
  if (socket) {
    socket.emit('stop_log_tail');
    socket.disconnect();
    socket = null;
    console.log('\n\n=== 🎯 调试结束 ===');
    process.exit(0);
  }
}

// 超时处理
setTimeout(() => {
  console.log('\n\n⏱️  超时，自动结束调试');
  analyzeLogs();
  disconnectSocket();
}, 10000);

// 开始调试
console.log('=== 🔍 日志调试工具 ===');
console.log(`程序ID: ${PROGRAM_ID}`);
console.log(`日志类型: ${LOG_TYPE}`);
console.log(`Socket URL: ${SOCKET_URL}`);
connectSocket();
