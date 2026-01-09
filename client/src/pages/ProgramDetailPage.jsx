import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Drawer, Button, Tabs, Spin, Tag, Empty, message, Descriptions } from 'antd';
import { ReloadOutlined, PlayCircleOutlined, PauseCircleOutlined, CodeOutlined } from '@ant-design/icons';
import { getProgramDetail, startProgram, stopProgram, restartProgram, getProgramStdout, getProgramStderr } from '../utils/api';

const ProgramDetailPage = ({ isOpen, onClose, programId }) => {
  const [program, setProgram] = useState(null);
  const [logs, setLogs] = useState({ stdout: '', stderr: '' });
  const [logOffsets, setLogOffsets] = useState({ stdout: 0, stderr: 0 });
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  
  const timerRef = useRef(null);
  const logOffsetsRef = useRef(logOffsets);
  const logBufferSize = useRef(1000); // 保留最近1000行日志
  const isLoadingRef = useRef(false);

  // 同步logOffsets到ref
  useEffect(() => {
    logOffsetsRef.current = logOffsets;
  }, [logOffsets]);

  // 获取数据
  const fetchData = useCallback(async (isRefresh = false) => {
    if (!programId || isLoadingRef.current) return;
    
    isLoadingRef.current = true;
    if (!isRefresh) setLoading(true);

    try {
      // 初始加载时获取详情和日志，刷新时只获取日志
      const promises = [];
      
      if (!isRefresh) {
        promises.push(getProgramDetail(programId));
      }
      
      // 使用ref中的偏移量避免依赖问题
      const currentOffsets = logOffsetsRef.current;
      
      // 只获取新的日志数据
      promises.push(
        getProgramStdout(programId, currentOffsets.stdout, 10000),
        getProgramStderr(programId, currentOffsets.stderr, 10000)
      );

      const results = await Promise.all(promises);
      
      // 更新程序详情
      if (!isRefresh && results[0]) {
        setProgram(results[0].program);
      }
      
      // 获取日志结果（根据是否包含详情请求调整索引）
      const stdoutRes = results[isRefresh ? 0 : 1];
      const stderrRes = results[isRefresh ? 1 : 2];
      
      // 更新日志和偏移量
      setLogs(prev => {
        const updateLogs = (type, newLogs, newOffset) => {
          if (newLogs) {
            // 追加新日志
            const updatedLogs = prev[type] + newLogs;
            // 限制日志行数，防止内存溢出
            const logLines = updatedLogs.split('\n').filter(line => line.trim() !== '');
            if (logLines.length > logBufferSize.current) {
              logLines.splice(0, logLines.length - logBufferSize.current);
            }
            return logLines.join('\n');
          }
          return prev[type];
        };
        
        return {
          stdout: updateLogs('stdout', stdoutRes.stdout, stdoutRes.offset),
          stderr: updateLogs('stderr', stderrRes.stderr, stderrRes.offset)
        };
      });
      
      setLogOffsets(prev => ({
        stdout: stdoutRes.offset || prev.stdout,
        stderr: stderrRes.offset || prev.stderr
      }));
    } catch (error) {
      console.error('获取详情失败:', error);
      message.error('获取详情失败');
    } finally {
      setLoading(false);
      isLoadingRef.current = false;
    }
  }, [programId]);

  // 组件打开/关闭时的逻辑
  useEffect(() => {
    if (isOpen && programId) {
      // 初始加载时重置日志偏移量和内容
      setLogOffsets({ stdout: 0, stderr: 0 });
      setLogs({ stdout: '', stderr: '' });
      fetchData();
    } else {
      // 关闭时清理状态
      setProgram(null);
      setLogs({ stdout: '', stderr: '' });
      setAutoRefresh(false);
    }
  }, [isOpen, programId]);

  // 自动刷新逻辑
  useEffect(() => {
    let intervalId = null;
    
    if (autoRefresh && isOpen && programId) {
      // 增加刷新间隔到5秒，减少请求频率
      intervalId = setInterval(() => fetchData(true), 5000);
    }
    
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [autoRefresh, isOpen, programId]);

  const handleAction = async (action) => {
    const msgKey = 'action';
    const actionMap = {
      start: '启动',
      stop: '停止',
      restart: '重启'
    };
    
    message.loading({ content: `${actionMap[action]}中...`, key: msgKey });
    try {
      if (action === 'start') await startProgram(programId);
      if (action === 'stop') await stopProgram(programId);
      if (action === 'restart') await restartProgram(programId);
      message.success({ content: `${actionMap[action]}成功`, key: msgKey, duration: 3 });
      fetchData(true);
    } catch (error) {
      console.error(`${actionMap[action]}失败:`, error);
      message.error({ content: `${actionMap[action]}失败`, key: msgKey, duration: 3 });
    }
  };

  const renderLogView = (content) => (
    <div style={{
      backgroundColor: '#1e1e1e',
      color: '#d4d4d4',
      padding: '12px',
      borderRadius: '6px',
      fontFamily: "'Fira Code', 'Menlo', monospace",
      fontSize: '12px',
      height: 'calc(100vh - 300px)',
      overflowY: 'auto',
      whiteSpace: 'pre-wrap'
    }}>
      {content || <div style={{ color: '#666', textAlign: 'center', marginTop: 40 }}>暂无日志</div>}
    </div>
  );

  return (
    <Drawer
      title={program?.name || '程序详情'}
      placement="right"
      width={800}
      onClose={onClose}
      open={isOpen}
      extra={
        <Button 
          type={autoRefresh ? 'primary' : 'default'} 
          size="small"
          onClick={() => setAutoRefresh(!autoRefresh)}
        >
          {autoRefresh ? '自动刷新中' : '自动刷新'}
        </Button>
      }
    >
      <Spin spinning={loading}>
        {program && (
          <>
            <Descriptions title="基本信息" bordered size="small" column={2}>
              <Descriptions.Item label="状态">
                <Tag color={program.status === 'RUNNING' ? 'success' : 'error'}>{program.status}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="描述">{program.description}</Descriptions.Item>
            </Descriptions>

            <div style={{ margin: '16px 0' }}>
              <Button type="primary" onClick={() => handleAction('start')} disabled={program.status === 'RUNNING'} icon={<PlayCircleOutlined />}>启动</Button>
              <Button danger onClick={() => handleAction('stop')} disabled={program.status === 'STOPPED'} style={{ marginLeft: 8 }} icon={<PauseCircleOutlined />}>停止</Button>
              <Button onClick={() => handleAction('restart')} style={{ marginLeft: 8 }} icon={<ReloadOutlined />}>重启</Button>
            </div>

            <Tabs
              defaultActiveKey="stdout"
              items={[
                { label: '标准输出 (Stdout)', key: 'stdout', children: renderLogView(logs.stdout) },
                { label: '错误输出 (Stderr)', key: 'stderr', children: renderLogView(logs.stderr) }
              ]}
            />
          </>
        )}
      </Spin>
    </Drawer>
  );
};

export default ProgramDetailPage;