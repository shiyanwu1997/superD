const { io } = require('socket.io-client');

// 连接到Socket.io服务器
const socket = io('http://localhost:3000', {
  transports: ['polling', 'websocket'],
  timeout: 5000,
  reconnectionAttempts: 3
});

// 初始化日志计数
let logLines = [];
let startTime = null;

// 监听连接事件
socket.on('connect', () => {
  console.log('✅ Socket.io连接成功');
  startTime = Date.now();
  
  // 发送日志请求
  socket.emit('start_log_tail', {
    programId: '1-fake_web_server',
    logType: 'stdout',
    offset: -1 // 从文件末尾开始读取
  });
  
  console.log('📝 已发送日志请求，开始接收日志...');
});

// 监听连接错误
socket.on('connect_error', (error) => {
  console.error('❌ Socket.io连接错误:', error);
});

// 处理日志块
socket.on('log_chunk', (data) => {
  if (data.programId === '1-fake_web_server' && data.logType === 'stdout') {
    if (data.logs && data.logs.trim() !== '') {
      console.log('\n📦 收到日志块:');
      console.log('   - 日志长度:', data.logs.length);
      
      // 1. 移除所有可能影响终端显示的控制字符和转义序列
      // eslint-disable-next-line no-control-regex
      let logs = data.logs.replace(/[\x00-\x09\x0B-\x1F\x7F-\x9F]/g, ''); // 移除所有控制字符，除了换行符\n (0x0A)
      // eslint-disable-next-line no-control-regex
      logs = logs.replace(/\u001B\[[^m]*m/g, ''); // 移除ANSI转义序列
      
      // 2. 统一换行符格式
      logs = logs.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      
      // 3. 移除每行日志行首的空白字符（包括空格和制表符）
      logs = logs.replace(/^\s+/gm, ''); // 使用正则表达式移除每行的前导空白字符
      
      // 4. 确保日志以换行符结束
      if (!logs.endsWith('\n')) {
        logs += '\n';
      }
      
      // 5. 累积日志内容并限制为500行
      const maxLogLines = 500;
      let allLogs = logs;
      
      // 按换行符分割日志
      const newLines = logs.split('\n').filter(line => line.trim() !== '');
      logLines = [...logLines, ...newLines];
      
      // 如果超过最大行数，只保留最新的maxLogLines行
      if (logLines.length > maxLogLines) {
        logLines = logLines.slice(logLines.length - maxLogLines);
      }
      
      console.log('   - 处理后日志长度:', logs.length);
      console.log('   - 新增日志行数:', newLines.length);
      console.log('   - 累计日志行数:', logLines.length);
      console.log('   - 当前日志行数限制:', maxLogLines);
      
      // 显示部分日志内容（前5行和后5行）
      console.log('\n📋 日志内容预览:');
      const previewLines = Math.min(5, newLines.length);
      if (previewLines > 0) {
        console.log('   前', previewLines, '行:');
        for (let i = 0; i < previewLines; i++) {
          console.log('     [' + (i + 1) + ']', newLines[i]);
        }
      }
      
      if (newLines.length > previewLines) {
        console.log('   ...');
        console.log('   后', previewLines, '行:');
        for (let i = newLines.length - previewLines; i < newLines.length; i++) {
          console.log('     [' + (i + 1) + ']', newLines[i]);
        }
      }
      
      // 检查日志格式
      console.log('\n🔍 日志格式检查:');
      const hasLeadingSpaces = newLines.some(line => /^\s+/.test(line));
      const hasDuplicateLines = newLines.length !== new Set(newLines).size;
      
      if (hasLeadingSpaces) {
        console.log('   ⚠️  存在行首有空白字符的日志行');
      } else {
        console.log('   ✅ 所有日志行首没有空白字符');
      }
      
      if (hasDuplicateLines) {
        console.log('   ⚠️  存在重复的日志行');
      } else {
        console.log('   ✅ 没有发现重复的日志行');
      }
    }
  }
});

// 处理错误
socket.on('log_error', (data) => {
  if (data.programId === '1-fake_web_server' && data.logType === 'stdout') {
    console.error('❌ 日志错误:', data.error);
  }
});

// 监听断开连接
socket.on('disconnect', () => {
  console.log('\n🔌 Socket.io连接断开');
});

// 5秒后停止测试
setTimeout(() => {
  console.log('\n⏱️  测试时间结束');
  console.log('📊 测试结果:');
  console.log('   - 测试时长:', (Date.now() - startTime) / 1000, '秒');
  console.log('   - 最终日志行数:', logLines.length);
  console.log('   - 日志是否超过500行:', logLines.length > 500 ? '是' : '否');
  
  // 停止日志监听并断开连接
  socket.emit('stop_log_tail');
  socket.disconnect();
  
  console.log('\n✅ 测试完成');
}, 5000);
