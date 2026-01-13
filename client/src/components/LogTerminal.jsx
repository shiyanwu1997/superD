import { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { io } from 'socket.io-client';
import { AppConfig } from '../config';
import '@xterm/xterm/css/xterm.css';

const LogTerminal = ({ programId, logType }) => {
  const terminalRef = useRef(null);
  const terminalInstanceRef = useRef(null);
  const fitAddonRef = useRef(null);
  const socketRef = useRef(null);
  const logLinesRef = useRef([]); // 维护日志行数组，方便限制行数
  const [isAutoScrolling, setIsAutoScrolling] = useState(true); // 是否自动滚动到底部
  const maxLogLines = AppConfig.logTerminal.maxLogLines || 500; // 默认为500行
  
  // 检测是否在底部
  const checkIsAtBottom = useCallback(() => {
    const terminal = terminalInstanceRef.current;
    if (!terminal) return true;
    
    // 安全检查：确保bufferManager和active属性存在
    if (!terminal._core?.bufferManager?.active) {
      return true;
    }
    
    const buffer = terminal.buffer.active;
    if (!buffer) return true;
    
    try {
      const viewportY = terminal._core.bufferManager.active.viewportY;
      const viewportHeight = terminal.rows;
      const totalLines = buffer.lines.length;
      
      // 当视口底部接近缓冲区底部时，视为在底部
      return viewportY + viewportHeight >= totalLines - 2;
    } catch (error) {
      // 如果访问内部API失败，默认返回true
      return true;
    }
  }, []);
  
  // 滚动事件处理函数
  const handleScroll = useCallback(() => {
    setIsAutoScrolling(checkIsAtBottom());
  }, [checkIsAtBottom]);
  
  // 初始化终端
  const initTerminal = useCallback(() => {
    if (!terminalRef.current) return;
    
    // 创建终端实例
    const terminal = new Terminal({
      fontSize: AppConfig.logTerminal.fontSize,
      fontFamily: AppConfig.logTerminal.fontFamily,
      theme: AppConfig.logTerminal.theme,
      scrollback: 10000, // 保持一定的滚动历史
      allowTransparency: true,
      lineHeight: 1.2,
      letterSpacing: 0,
      wrap: true,
      termName: 'xterm-color'
    });
    
    // 监听滚动事件
    terminal.onScroll(handleScroll);
    
    // 初始化fit插件
    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    
    // 打开终端
    terminal.open(terminalRef.current);
    fitAddon.fit();
    
    // 保存实例引用
    terminalInstanceRef.current = terminal;
    fitAddonRef.current = fitAddon;
  }, [handleScroll]);
  
  // 处理日志内容
  const processLogs = useCallback((logs) => {
    // 确保logs是字符串
    let processedLogs = String(logs || '');
    
    // 移除控制字符和转义序列
    processedLogs = processedLogs.replace(/[\x00-\x09\x0B-\x1F\x7F-\x9F]/g, '');
    processedLogs = processedLogs.replace(/\u001B\[[^m]*m/g, '');
    
    // 统一换行符
    processedLogs = processedLogs.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    
    // 移除行首空白
    processedLogs = processedLogs.replace(/^\s+/gm, '');
    
    // 确保以换行符结束
    if (!processedLogs.endsWith('\n')) {
      processedLogs += '\n';
    }
    
    return processedLogs;
  }, []);
  
  // 处理初始日志 - 只显示提示信息，不显示历史日志
  const handleInitialLogs = useCallback((logs) => {
    const terminal = terminalInstanceRef.current;
    if (!terminal) return;
    
    // 清空终端并显示提示信息
    terminal.clear();
    terminal.write('等待新日志...\n');
    
    // 重置日志行引用
    logLinesRef.current = [];
  }, []);
  
  // 处理新的日志块
  const handleNewLogChunk = useCallback((logs) => {
    const terminal = terminalInstanceRef.current;
    if (!terminal) return;
    
    // 处理日志内容
    const processedLogs = processLogs(logs);
    
    // 分割为行
    const newLines = processedLogs.split('\n').filter(line => line.trim() !== '');
    if (newLines.length === 0) return;
    
    // 更新日志行数组，保持在maxLogLines限制内
    logLinesRef.current = [...logLinesRef.current, ...newLines].slice(-maxLogLines);
    
    // 直接追加新日志到终端
    terminal.write(newLines.join('\n') + '\n');
    
    // 如果用户在底部，自动滚动
    if (isAutoScrolling) {
      terminal.scrollToBottom();
    }
  }, [processLogs, maxLogLines, isAutoScrolling]);
  
  // 初始化Socket连接
  const initSocket = useCallback(() => {
    const socket = io('http://localhost:3000', {
      transports: ['polling', 'websocket'],
      timeout: 5000,
      reconnectionAttempts: 3
    });
    socketRef.current = socket;
    
    // 监听连接事件
    socket.on('connect', () => {
      console.log('Socket.io connected');
      // 发送初始日志请求（只获取实时增量日志）
      socket.emit('start_log_tail', {
        programId,
        logType
        // 不发送offset，由后端自动处理初始偏移量
      });
    });
    
    // 监听连接错误事件
    socket.on('connect_error', (error) => {
      console.error('Socket.io connection error:', error);
      const errorMessage = `[ERROR] Socket.io connection error: ${error.message}\n`;
      const terminal = terminalInstanceRef.current;
      if (terminal) {
        terminal.write(errorMessage);
      }
    });
    
    // 处理日志块
    socket.on('log_chunk', (data) => {
      if (data.programId === programId && data.logType === logType) {
        // 检查是否是初始日志
        if (data.isInitial) {
          handleInitialLogs(data.logs);
        } else {
          handleNewLogChunk(data.logs);
        }
      }
    });
    
    // 处理错误
    socket.on('log_error', (data) => {
      if (data.programId === programId && data.logType === logType) {
        const errorMessage = `[ERROR] ${data.error}\n`;
        const terminal = terminalInstanceRef.current;
        if (terminal) {
          terminal.write(errorMessage);
        }
      }
    });
    
    return socket;
  }, [programId, logType, handleInitialLogs, handleNewLogChunk]);
  
  // 主 useEffect
  useEffect(() => {
    // 初始化终端
    initTerminal();
    
    // 初始化Socket
    const socket = initSocket();
    
    // 窗口大小变化时调整终端大小
    const handleResize = () => {
      const fitAddon = fitAddonRef.current;
      const terminal = terminalInstanceRef.current;
      if (fitAddon && terminal) {
        fitAddon.fit();
        // 如果之前是自动滚动，调整大小后继续保持在底部
        if (isAutoScrolling) {
          terminal.scrollToBottom();
        }
      }
    };
    window.addEventListener('resize', handleResize);
    
    // 清理函数
    return () => {
      window.removeEventListener('resize', handleResize);
      socket.emit('stop_log_tail');
      socket.disconnect();
      
      // 销毁终端实例
      if (terminalInstanceRef.current) {
        terminalInstanceRef.current.dispose();
        terminalInstanceRef.current = null;
      }
    };
  }, [programId, logType, initTerminal, initSocket, isAutoScrolling]);
  
  // 当programId或logType变化时，重启日志监听
  useEffect(() => {
    if (!socketRef.current) return;
    
    // 停止之前的监听
    socketRef.current.emit('stop_log_tail');
    
    // 清空日志内容和终端
    logLinesRef.current = [];
    const terminal = terminalInstanceRef.current;
    if (terminal) {
      terminal.clear();
      terminal.write('正在获取日志...\n');
    }
    
    // 开始新的监听，只获取实时增量日志
    socketRef.current.emit('start_log_tail', {
      programId,
      logType
      // 不发送offset，由后端自动处理初始偏移量
    });
  }, [programId, logType]);
  
  return (
    <div style={{ width: '100%', height: 'calc(100vh - 300px)', position: 'relative' }}>
      {/* 终端容器 */}
      <div 
        ref={terminalRef} 
        style={{ 
          width: '100%', 
          height: '100%',
          overflow: 'auto'
        }} 
      />
    </div>
  );
};

export default LogTerminal;