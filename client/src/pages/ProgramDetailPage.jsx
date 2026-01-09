import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Drawer, Button, Tabs, Spin, Tag, message, Descriptions } from 'antd';
import { PlayCircleOutlined, PauseCircleOutlined, ReloadOutlined } from '@ant-design/icons';
import { getProgramDetail, startProgram, stopProgram, restartProgram } from '../utils/api';
import LogTerminal from '../components/LogTerminal';

const ProgramDetailPage = ({ isOpen, onClose, programId }) => {
  const [program, setProgram] = useState(null);
  const [loading, setLoading] = useState(false);
  
  // 获取程序详情
  const fetchProgramDetail = useCallback(async () => {
    if (!programId) return;
    
    setLoading(true);
    try {
      const result = await getProgramDetail(programId);
      setProgram(result.program);
    } catch (error) {
      console.error('获取详情失败:', error);
      message.error('获取详情失败');
    } finally {
      setLoading(false);
    }
  }, [programId]);

  // 组件打开/关闭时的逻辑
  useEffect(() => {
    if (isOpen && programId) {
      fetchProgramDetail();
    } else {
      // 关闭时清理状态
      setProgram(null);
    }
  }, [isOpen, programId, fetchProgramDetail]);

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
      fetchProgramDetail(); // 操作成功后刷新程序详情
    } catch (error) {
      console.error(`${actionMap[action]}失败:`, error);
      message.error({ content: `${actionMap[action]}失败`, key: msgKey, duration: 3 });
    }
  };

  return (
    <Drawer
      title={program?.name || '程序详情'}
      placement="right"
      width={800}
      onClose={onClose}
      open={isOpen}
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
                { 
                  label: '标准输出 (Stdout)', 
                  key: 'stdout', 
                  children: <LogTerminal programId={programId} logType="stdout" /> 
                },
                { 
                  label: '错误输出 (Stderr)', 
                  key: 'stderr', 
                  children: <LogTerminal programId={programId} logType="stderr" /> 
                }
              ]}
            />
          </>
        )}
      </Spin>
    </Drawer>
  );
};

export default ProgramDetailPage;