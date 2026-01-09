import React, { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { io } from 'socket.io-client';
import '@xterm/xterm/css/xterm.css';

const LogTerminal = ({ programId, logType }) => {
  const terminalRef = useRef(null);
  const terminalInstanceRef = useRef(null);
  const fitAddonRef = useRef(null);
  const socketRef = useRef(null);
  
  useEffect(() => {
    if (!terminalRef.current) return;
    
    // 初始化终端
    const terminal = new Terminal({
      fontSize: 12,
      fontFamily: 'Fira Code, Menlo, monospace',
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
        cursor: '#ffffff',
        cursorAccent: '#000000'
      },
      scrollback: 10000, // 设置滚动缓冲区大小
      allowTransparency: true
    });
    
    // 初始化fit插件
    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    
    // 打开终端
    terminal.open(terminalRef.current);
    fitAddon.fit();
    
    // 保存实例引用
    terminalInstanceRef.current = terminal;
    fitAddonRef.current = fitAddon;
    
    // 初始化Socket连接
    const socket = io('http://localhost:3000');
    socketRef.current = socket;
    
    // 处理日志块
    socket.on('log_chunk', (data) => {
      if (data.programId === programId && data.logType === logType) {
        terminal.write(data.logs);
      }
    });
    
    // 处理错误
    socket.on('log_error', (data) => {
      if (data.programId === programId && data.logType === logType) {
        terminal.write(`\n[ERROR] ${data.error}\n`);
      }
    });
    
    // 开始日志监听
    socket.emit('start_log_tail', { programId, logType });
    
    // 窗口大小变化时调整终端大小
    const handleResize = () => {
      fitAddon.fit();
    };
    window.addEventListener('resize', handleResize);
    
    // 清理函数
    return () => {
      window.removeEventListener('resize', handleResize);
      socket.emit('stop_log_tail');
      socket.disconnect();
      terminal.dispose();
    };
  }, [programId, logType]);
  
  // 当programId或logType变化时，重启日志监听
  useEffect(() => {
    if (!socketRef.current) return;
    
    // 停止之前的监听
    socketRef.current.emit('stop_log_tail');
    
    // 清空终端
    if (terminalInstanceRef.current) {
      terminalInstanceRef.current.clear();
    }
    
    // 开始新的监听
    socketRef.current.emit('start_log_tail', { programId, logType });
  }, [programId, logType]);
  
  return (
    <div 
      ref={terminalRef} 
      style={{ 
        width: '100%', 
        height: 'calc(100vh - 300px)',
        overflow: 'hidden'
      }} 
    />
  );
};

export default LogTerminal;
