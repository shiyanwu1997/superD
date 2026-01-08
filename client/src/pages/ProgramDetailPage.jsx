import React, { useState, useEffect, useRef } from 'react';
import { getProgramDetail, startProgram, stopProgram, restartProgram, getProgramStdout, getProgramStderr } from '../utils/api';

const ProgramDetailPage = ({ isOpen, onClose, programId: propProgramId }) => {
  const programId = propProgramId;
  const [program, setProgram] = useState(null);
  const [configContent, setConfigContent] = useState('');
  const [stdoutLogs, setStdoutLogs] = useState('');
  const [stderrLogs, setStderrLogs] = useState('');
  const [activeLogTab, setActiveLogTab] = useState('stdout');

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const [autoRefresh, setAutoRefresh] = useState(false);
  const refreshIntervalRef = useRef(null);
  const stdoutContainerRef = useRef(null);
  const stderrContainerRef = useRef(null);

  // 获取程序详情
  const fetchProgramDetail = async () => {
    if (!programId) {
      console.error('programId is undefined or null');
      setMessage('程序ID无效');
      setProgram(null);
      setConfigContent('');
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      setMessage('');
      // 切换程序时先重置程序详情
      setProgram(null);
      setConfigContent('');
      console.log('Fetching program detail for programId:', programId);
      const data = await getProgramDetail(programId);
      console.log('Program detail response:', data);
      setProgram(data.program);
      setConfigContent(data.configContent);
    } catch (err) {
      console.error('Error fetching program detail:', err);
      console.error('Error response:', err.response);
      setMessage('获取程序详情失败');
      // 出错时确保程序详情为空
      setProgram(null);
      setConfigContent('');
    } finally {
      setLoading(false);
    }
  };

  // 获取stdout日志
  const fetchStdoutLogs = async () => {
    if (!programId) {
      setStdoutLogs('');
      return;
    }
    
    try {
      // 切换程序时先重置stdout日志
      setStdoutLogs('');
      // 使用tail功能获取最新日志，增加日志长度以避免截断
      const stdoutData = await getProgramStdout(programId, 0, 200000);
      
      // 直接使用原始日志数据，不做任何处理
      let logs = stdoutData.stdout || '';
      
      // 确保日志数据是字符串类型
      if (typeof logs !== 'string') {
        logs = String(logs);
      }
      
      // 反转日志顺序，让新日志显示在上面
      if (logs) {
        logs = logs.split('\n').reverse().join('\n');
      }
      
      // 调试日志数据
      console.log('Raw stdout logs:', logs);
      console.log('Logs contain newlines:', logs.includes('\n'));
      
      setStdoutLogs(logs);
    } catch (err) {
      console.error('获取stdout日志失败:', err);
      // 出错时确保stdout日志为空
      setStdoutLogs('');
    }
  };

  // 获取stderr日志
  const fetchStderrLogs = async () => {
    if (!programId) {
      setStderrLogs('');
      return;
    }
    
    try {
      // 切换程序时先重置stderr日志
      setStderrLogs('');
      // 使用tail功能获取最新日志，增加日志长度以避免截断
      const stderrData = await getProgramStderr(programId, 0, 200000);
      
      // 直接使用原始日志数据，不做任何处理
      let logs = stderrData.stderr || '';
      
      // 确保日志数据是字符串类型
      if (typeof logs !== 'string') {
        logs = String(logs);
      }
      
      // 反转日志顺序，让新日志显示在上面
      if (logs) {
        logs = logs.split('\n').reverse().join('\n');
      }
      
      setStderrLogs(logs);
    } catch (err) {
      console.error('获取stderr日志失败:', err);
      // 出错时确保stderr日志为空
      setStderrLogs('');
    }
  };

  // 获取所有日志
  const fetchAllLogs = async () => {
    if (!programId) return;
    await Promise.all([fetchStdoutLogs(), fetchStderrLogs()]);
  };

  // 当初始加载或programId变化时获取数据
  useEffect(() => {
    if (isOpen && programId) {
      fetchProgramDetail();
      fetchAllLogs();
    }
  }, [programId, isOpen]);

  // 自动刷新日志
  useEffect(() => {
    // 清除之前的定时器
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
      refreshIntervalRef.current = null;
    }

    if (autoRefresh && programId && isOpen) {
      // 立即获取一次日志
      fetchAllLogs();
      // 设置定时器，每2秒刷新一次
      refreshIntervalRef.current = setInterval(() => {
        fetchAllLogs();
      }, 2000);
    }

    // 组件卸载时清除定时器
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    };
  }, [autoRefresh, programId, isOpen]);

  // 日志更新时自动滚动到顶部
  useEffect(() => {
    if (activeLogTab === 'stdout' && stdoutContainerRef.current) {
      stdoutContainerRef.current.scrollTop = 0;
    } else if (activeLogTab === 'stderr' && stderrContainerRef.current) {
      stderrContainerRef.current.scrollTop = 0;
    }
  }, [stdoutLogs, stderrLogs, activeLogTab]);

  // 处理程序操作
  const handleProgramAction = async (action) => {
    try {
      let response;
      switch (action) {
        case 'start':
          response = await startProgram(programId);
          break;
        case 'stop':
          response = await stopProgram(programId);
          break;
        case 'restart':
          response = await restartProgram(programId);
          break;
        default:
          return;
      }

      if (response.success) {
        setMessage(response.message);
        // 刷新程序详情以获取最新状态
        await fetchProgramDetail();
        // 刷新日志
        await fetchAllLogs();
      } else {
        setMessage(response.message || '操作失败');
      }
    } catch (err) {
      console.error(err);
      setMessage('操作失败');
    }

    // 3秒后清除消息
    setTimeout(() => setMessage(''), 3000);
  };

  return isOpen ? (
      <div className="modal-overlay">
        <div className="modal-content program-detail-modal-content">
          <div className="modal-header">
            <h2>程序详情</h2>
            <button 
              className="modal-close" 
              onClick={onClose}
            >
              ×
            </button>
          </div>
          <div className="modal-body">
            {loading ? (
              <div className="loading">加载中...</div>
            ) : !program ? (
              <div className="error-message">程序不存在</div>
            ) : (
              <>
                <div className="message-container">
                  {message && (
                    <div className={`message ${message.includes('失败') ? 'error-message' : 'success-message'}`}>
                      {message}
                    </div>
                  )}
                </div>
                
                <div className="program-detail-container">
                  {/* 程序基本信息 */}
                  <section className="program-info-section">
                    <h3>程序信息</h3>
                    <div className="info-card">
                      <div className="info-item">
                        <label>名称:</label>
                        <span>{program.name}</span>
                      </div>
                      <div className="info-item">
                        <label>描述:</label>
                        <span>{program.description || '无描述'}</span>
                      </div>
                      <div className="info-item">
                        <label>状态:</label>
                        <span className={`status-badge ${program.status.toLowerCase()}`}>
                          {program.status}
                        </span>
                      </div>
                    </div>
                    <div className="action-buttons">
                      <button 
                        className="control-button start"
                        onClick={() => handleProgramAction('start')}
                      >
                        启动
                      </button>
                      <button 
                        className="control-button stop"
                        onClick={() => handleProgramAction('stop')}
                      >
                        停止
                      </button>
                      <button 
                        className="control-button restart"
                        onClick={() => handleProgramAction('restart')}
                      >
                        重启
                      </button>
                    </div>
                  </section>

                  {/* 配置文件内容 - 只有当有内容时才显示 */}
                  {configContent && configContent !== '暂无配置文件内容' && (
                    <section className="config-section">
                      <h3>配置文件</h3>
                      <div className="code-container expanded-log-container">
                        <pre><code>{configContent}</code></pre>
                      </div>
                    </section>
                  )}

                  {/* 日志内容 */}
                  <section className="logs-section">
                    <div className="section-header">
                      <h3>日志信息</h3>
                      <div className="log-controls">
                        <div className="log-tabs">
                          <button 
                            className={`tab-button ${activeLogTab === 'stdout' ? 'active' : ''}`}
                            onClick={() => setActiveLogTab('stdout')}
                          >
                            Tail -f Stdout
                          </button>
                          <button 
                            className={`tab-button ${activeLogTab === 'stderr' ? 'active' : ''}`}
                            onClick={() => setActiveLogTab('stderr')}
                          >
                            Tail -f Stderr
                          </button>
                        </div>
                        <div className="auto-refresh-control">
                          <label className="auto-refresh-label">
                            <input 
                              type="checkbox" 
                              checked={autoRefresh} 
                              onChange={(e) => setAutoRefresh(e.target.checked)}
                            />
                            自动刷新
                          </label>
                          <button 
                            className="refresh-button"
                            onClick={fetchAllLogs}
                          >
                            刷新
                          </button>
                        </div>
                      </div>
                    </div>
                    
                    {/* stdout日志容器 */}
                    {activeLogTab === 'stdout' && (
                      <div className="expanded-log-container" ref={stdoutContainerRef}>
                        <pre><code>{stdoutLogs ? stdoutLogs : '暂无stdout日志内容'}</code></pre>
                      </div>
                    )}
                    
                    {/* stderr日志容器 */}
                    {activeLogTab === 'stderr' && (
                      <div className="expanded-log-container" ref={stderrContainerRef}>
                        <pre><code>{stderrLogs ? stderrLogs : '暂无stderr日志内容'}</code></pre>
                      </div>
                    )}
                  </section>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    ) : null;
};

export default ProgramDetailPage;