import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Drawer, Button, Tabs, Spin, Tag, Empty, message, Descriptions } from 'antd';
import { ReloadOutlined, PlayCircleOutlined, PauseCircleOutlined, CodeOutlined } from '@ant-design/icons';
import { getProgramDetail, startProgram, stopProgram, restartProgram, getProgramStdout, getProgramStderr } from '../utils/api';

const ProgramDetailPage = ({ isOpen, onClose, programId }) => {
  const [program, setProgram] = useState(null);
  const [logs, setLogs] = useState({ stdout: '', stderr: '' });
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  
  const timerRef = useRef(null);

  // 获取数据
  const fetchData = useCallback(async (isRefresh = false) => {
    if (!programId) return;
    if (!isRefresh) setLoading(true);

    try {
      const [detailRes, stdoutRes, stderrRes] = await Promise.all([
        getProgramDetail(programId),
        getProgramStdout(programId, 0, 100000), // 读取更多日志内容
        getProgramStderr(programId, 0, 100000)
      ]);

      setProgram(detailRes.program);
      setLogs({
        stdout: (stdoutRes.stdout || '').split('\n').reverse().join('\n'), // 反转以便看最新
        stderr: (stderrRes.stderr || '').split('\n').reverse().join('\n')
      });
    } catch (error) {
      console.error('获取详情失败:', error);
      message.error('获取详情失败');
    } finally {
      setLoading(false);
    }
  }, [programId]);

  useEffect(() => {
    if (isOpen && programId) {
      fetchData();
    } else {
      // 关闭时清理状态
      setProgram(null);
      setLogs({ stdout: '', stderr: '' });
      setAutoRefresh(false);
    }
  }, [isOpen, programId, fetchData]);

  // 自动刷新逻辑
  useEffect(() => {
    if (autoRefresh && isOpen && programId) {
      timerRef.current = setInterval(() => fetchData(true), 2000);
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [autoRefresh, isOpen, programId, fetchData]);

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