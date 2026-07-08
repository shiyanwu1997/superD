import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { io } from 'socket.io-client';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { AppConfig } from '../config';
import '@xterm/xterm/css/xterm.css';

const { logTerminal: lt } = AppConfig;

const LogTerminal = ({ programId, logType }) => {
  const terminalRef = useRef(null);
  const terminalInstanceRef = useRef(null);
  const fitAddonRef = useRef(null);
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [paused, setPaused] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const pausedRef = useRef(false);
  // 切换程序时重置
  useEffect(() => { pausedRef.current = false; }, [programId, logType]);
  const maxLogLines = lt.maxLogLines || 5000;

  const terminalOptions = useMemo(() => ({
    fontSize: lt.fontSize,
    fontFamily: lt.fontFamily,
    theme: lt.theme,
    scrollback: maxLogLines,
    allowTransparency: true,
    lineHeight: 1.2,
    letterSpacing: 0,
    wrap: true,
    convertEol: true,
  }), [maxLogLines]);

  // 检测是否滚动到底部
  const checkAtBottom = useCallback(() => {
    const t = terminalInstanceRef.current;
    if (!t) return true;
    try {
      const buffer = t.buffer.active;
      return buffer.viewportY >= buffer.baseY + buffer.length - t.rows - 2;
    } catch { return true; }
  }, []);

  // 暂停/恢复
  const togglePause = useCallback(() => {
    setPaused(prev => {
      const next = !prev;
      pausedRef.current = next;
      return next;
    });
  }, []);

  // 初始化终端
  useEffect(() => {
    if (!terminalRef.current) return;

    const terminal = new Terminal(terminalOptions);
    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(terminalRef.current);
    fitAddon.fit();

    // 监听用户滚动
    terminal.onScroll(() => {
      const atBottom = checkAtBottom();
      setAutoScroll(atBottom);
    });

    terminalInstanceRef.current = terminal;
    fitAddonRef.current = fitAddon;

    const handleResize = () => fitAddon?.fit();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      terminal.dispose();
      terminalInstanceRef.current = null;
    };
  }, [terminalOptions, checkAtBottom]);

  // Socket.io 日志流
  useEffect(() => {
    const terminal = terminalInstanceRef.current;
    if (!terminal || !programId || !logType) return;

    terminal.clear();
    pausedRef.current = false;
    terminal.write('正在连接日志服务...\n');

    const socket = io(AppConfig.socket.url, AppConfig.socket.options);
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      setPaused(false);
      setAutoScroll(true);
      terminal.clear();
      socket.emit('start_log_tail', { programId, logType });
    });

    socket.on('log_chunk', (data) => {
      if (pausedRef.current) return;
      if (data.logs) {
        if (data.isInitial) {
          terminal.clear();
          terminal.write('实时日志已连接，等待新日志...\n');
        } else {
          terminal.write(data.logs.replace(/\n/g, '\r\n'));
          // 如果用户在底部，自动滚动
          if (checkAtBottom()) {
            terminal.scrollToBottom();
          }
        }
      }
    });

    socket.on('log_error', (data) => {
      terminal.write(`\r\n[ERROR] ${data.error}\r\n`);
    });

    socket.on('disconnect', () => {
      setConnected(false);
      terminal.write('\r\n[日志连接已断开]\r\n');
    });

    return () => {
      if (socket.connected) socket.emit('stop_log_tail');
      socket.disconnect();
      socketRef.current = null;
    };
  }, [programId, logType, checkAtBottom]);

  const btnStyle = {
    padding: '2px 10px', fontSize: 12, borderRadius: 4, border: 'none',
    cursor: 'pointer', color: '#fff', marginLeft: 6
  };

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', display: 'flex', flexDirection: 'column' }}>
      {/* 工具栏 */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '4px 12px', background: '#2d2d2d', borderBottom: '1px solid #444',
        fontSize: 12, color: '#ccc', flexShrink: 0
      }}>
        <span>
          {logType === 'stdout' ? '标准输出' : '标准错误'}
          {connected ? ' ●' : ' ○'}
          {paused && <span style={{ color: '#faad14', marginLeft: 8 }}>⏸ 已暂停</span>}
          {!autoScroll && !paused && <span style={{ color: '#1890ff', marginLeft: 8 }}>↑ 已上翻</span>}
        </span>
        <div>
          <button onClick={togglePause} style={{ ...btnStyle, background: paused ? '#1890ff' : '#555' }}>
            {paused ? '▶ 继续' : '⏸ 暂停'}
          </button>
        </div>
      </div>
      {/* 终端 */}
      <div ref={terminalRef} style={{ flex: 1, overflow: 'hidden' }} />
    </div>
  );
};

export default LogTerminal;
