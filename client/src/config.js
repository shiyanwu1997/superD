/**
 * 应用配置文件
 * 包含所有可配置的参数，方便统一管理和修改
 */

export const AppConfig = {
  /**
   * 日志终端配置
   */
  logTerminal: {
    // 日志显示的最大行数，设置为500表示只显示最新的500行日志
    maxLogLines: 500,
    
    // 终端字体大小
    fontSize: 12,
    
    // 终端字体族
    fontFamily: 'Fira Code, Menlo, monospace',
    
    // 终端主题配置
    theme: {
      background: '#1e1e1e',
      foreground: '#d4d4d4',
      cursor: '#ffffff',
      cursorAccent: '#000000'
    }
  },
  
  /**
   * Socket.IO 配置
   */
  socket: {
    url: 'http://localhost:3000',
    options: {
      transports: ['polling', 'websocket'],
      timeout: 5000,
      reconnectionAttempts: 3
    }
  }
};

export default AppConfig;
