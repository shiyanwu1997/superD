import { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { AppConfig } from '../config';
import { getProgramStdout, getProgramStderr } from '../utils/api';
import '@xterm/xterm/css/xterm.css';

const LogTerminal = ({ programId, logType }) => {
  const terminalRef = useRef(null);
  const terminalInstanceRef = useRef(null);
  const fitAddonRef = useRef(null);
  const logLinesRef = useRef([]); // 维护日志行数组，方便限制行数
  const [isAutoScrolling, setIsAutoScrolling] = useState(true)
  const maxLogLines = AppConfig.logTerminal.maxLogLines || 5000
  
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
      } catch {
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
      scrollback: maxLogLines, // 与maxLogLines保持一致，避免保留过多历史记录
      allowTransparency: true,
      lineHeight: 1.2,
      letterSpacing: 0,
      wrap: true,
      termName: 'xterm-color',
      convertEol: true, // [修复] 启用EOL转换，将 \n 转换为 \r\n，解决阶梯状显示问题
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
  }, [handleScroll, maxLogLines]);
  

  

  
  // 使用HTTP请求获取日志
  const fetchLogs = useCallback(async () => {
    try {
      // 根据logType选择对应的API函数
      const apiFunction = logType === 'stdout' ? getProgramStdout : getProgramStderr;
      // 调用API获取日志
      const response = await apiFunction(programId, 0, 50000);
      
      // 处理返回的日志
      // API返回的是stdout或stderr字段，取决于请求的是标准输出还是标准错误日志
      const logs = logType === 'stdout' ? response.stdout : response.stderr;
      if (logs !== undefined && logs !== null) {
        // 清空终端并写入新日志
        const terminal = terminalInstanceRef.current;
        if (terminal) {
          terminal.clear();
          terminal.write(logs + '\n');
        }
      }
    } catch (error) {
      console.error('获取日志失败:', error);
      const errorMessage = `[ERROR] 获取日志失败: ${error.message || '未知错误'}\n`;
      const terminal = terminalInstanceRef.current;
      if (terminal) {
        terminal.write(errorMessage);
      }
    }
  }, [programId, logType]);
  
  // 主 useEffect
  useEffect(() => {
    // 初始化终端
    initTerminal();
    
    // 初始获取日志
    fetchLogs();
    
    // 设置定时器定期获取日志更新
    const logInterval = setInterval(() => {
      fetchLogs();
    }, 2000); // 每秒获取一次日志
    
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
      clearInterval(logInterval);
      
      // 销毁终端实例
      if (terminalInstanceRef.current) {
        terminalInstanceRef.current.dispose();
        terminalInstanceRef.current = null;
      }
    };
  }, [programId, logType, initTerminal, fetchLogs, isAutoScrolling]);
  
  // 当programId或logType变化时，重新获取日志
  useEffect(() => {
    // 清空日志内容和终端
    logLinesRef.current = [];
    const terminal = terminalInstanceRef.current;
    if (terminal) {
      terminal.clear();
      terminal.write('正在获取日志...\n');
    }
    
    // 重新获取日志
    fetchLogs();
  }, [programId, logType, fetchLogs]);
  
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