import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Layout, Menu, Table, Button, Tag, Space, message,
  Card, Row, Col, Statistic, Empty, Badge, Select,
  Typography, Input, Dropdown, Avatar, Tooltip
} from 'antd';
import { 
  AppstoreOutlined, SettingOutlined, LogoutOutlined, UserOutlined, 
  PlayCircleOutlined, PauseCircleOutlined, ReloadOutlined, 
  FileTextOutlined, ClusterOutlined, CheckCircleOutlined, 
  CloseCircleOutlined, ExclamationCircleOutlined, SearchOutlined,
  MenuFoldOutlined, MenuUnfoldOutlined, ControlOutlined
} from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  getAllPrograms, getProgramsByProject, startProgram, stopProgram, restartProgram,
  getProjects, startAllPrograms, stopAllPrograms, restartAllPrograms, reloadConfig,
  checkProjectStatus, getGroups
} from '../utils/api';

// 引入子组件
import UsersPage from './UsersPage';
import ProgramDetailPage from './ProgramDetailPage';
import StatsCards from '../components/StatsCards';
import ProjectManageModal from '../components/modals/ProjectManageModal';
import ChangePasswordModal from '../components/modals/ChangePasswordModal';

const { Header, Sider, Content } = Layout;
const { Title, Text } = Typography;

const ProgramsPage = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  
  // --- 状态管理 ---
  const [collapsed, setCollapsed] = useState(false);
  const [programs, setPrograms] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [projectSearchText, setProjectSearchText] = useState('');
  const [groups, setGroups] = useState([]);
  const [expandedGroups, setExpandedGroups] = useState({});

  // 页面加载时间状态，用于控制离线状态显示的延迟
  const pageLoadTimeRef = useRef(null);
  
  // 操作Loading状态
  const [actionLoading, setActionLoading] = useState({}); 

  // 模态框控制
  const [showUsersModal, setShowUsersModal] = useState(false);
  const [showLogDrawer, setShowLogDrawer] = useState(false);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showPwdModal, setShowPwdModal] = useState(false);
  const [selectedProgramId, setSelectedProgramId] = useState(null);

  // --- 数据统计 (Computed) ---
  const stats = useMemo(() => {
    return {
      total: programs.length,
      running: programs.filter(p => p.status === 'RUNNING').length,
      stopped: programs.filter(p => p.status === 'STOPPED').length,
      error: programs.filter(p => ['FATAL', 'BACKOFF', 'UNKNOWN', 'EXITED'].includes(p.status)).length
    };
  }, [programs]);

  // 搜索过滤
  const filteredPrograms = useMemo(() => {
    if (!searchText) return programs;
    return programs.filter(p => p.name.toLowerCase().includes(searchText.toLowerCase()));
  }, [programs, searchText]);

  // 项目搜索 + 分组过滤
  const filteredProjects = useMemo(() => {
    let list = projects;
    if (projectSearchText) {
      list = list.filter(p =>
        p.name.toLowerCase().includes(projectSearchText.toLowerCase()) ||
        p.description?.toLowerCase().includes(projectSearchText.toLowerCase())
      );
    }
    return list;
  }, [projects, projectSearchText]);

  // --- API 交互 ---

  const getDelayedConnectionStatus = useCallback((connectionStatus) => {
    const loadTime = pageLoadTimeRef.current;
    if (!loadTime || connectionStatus.connected) return connectionStatus;
    if (new Date().getTime() - loadTime < 5000) return { connected: null, error: null };
    return connectionStatus;
  }, []);

  const fetchGroups = useCallback(async () => {
    try {
      const data = await getGroups();
      setGroups(data || []);
    } catch (e) {
      console.error('获取分组失败:', e);
    }
  }, []);

  const fetchProjects = useCallback(async () => {
    try {
      setLoadingProjects(true);
      await fetchGroups();

      if (!pageLoadTimeRef.current) {
        pageLoadTimeRef.current = new Date().getTime();
      }
      const data = await getProjects();
      // 准备包含初始连接状态的项目列表
      const projectsWithInitialStatus = data.map(project => ({
        ...project,
        connectionStatus: { connected: null, error: null } // 初始状态为检查中
      }));
      
      // 一次性更新项目列表，让用户能看到所有有权限的项目
      setProjects(projectsWithInitialStatus);

      // 并行检查所有项目连接状态，提高效率
      const connectionStatusPromises = data.map(async (project) => {
        try {
          // 增加连接状态检查的重试机制
          let connectionStatus;
          let retryCount = 0;
          const maxRetries = 1;
          
          while (retryCount <= maxRetries) {
            try {
              connectionStatus = await checkProjectStatus(project.id);
              break;
            } catch (retryError) {
              retryCount++;
              if (retryCount > maxRetries) {
                throw retryError;
              }
              // 等待一段时间后重试，增加重试间隔时间
              await new Promise(resolve => setTimeout(resolve, 2000 * retryCount));
            }
          }
          
          // 应用连接状态延迟显示逻辑
          const delayedStatus = getDelayedConnectionStatus(connectionStatus);
          return { projectId: project.id, connectionStatus: delayedStatus };
        } catch (error) {
          console.error(`检查项目${project.id}连接状态失败:`, error);
          
          // 应用连接状态延迟显示逻辑
          const errorStatus = { connected: false, error: '连接检查失败: ' + error.message };
          const delayedStatus = getDelayedConnectionStatus(errorStatus);
          
          return { 
            projectId: project.id, 
            connectionStatus: delayedStatus
          };
        }
      });
      
      // 等待所有连接状态检查完成
      const connectionStatusResults = await Promise.all(connectionStatusPromises);
      
      // 批量更新连接状态
      setProjects(prevProjects => {
        return prevProjects.map(project => {
          const statusResult = connectionStatusResults.find(result => result.projectId === project.id);
          if (statusResult) {
            return {
              ...project,
              connectionStatus: statusResult.connectionStatus
            };
          }
          return project;
        });
      });
      
    } catch (error) {
      console.error('获取项目列表失败:', error);
      message.error('获取项目列表失败');
    } finally {
      setLoadingProjects(false);
    }
  }, [getDelayedConnectionStatus, fetchGroups]);

  const fetchAllProgramsData = async () => {
    setLoading(true);
    try {
      const data = await getAllPrograms();
      const uniquePrograms = [...new Map(data.map(program => [program.id, program])).values()];
      setPrograms(uniquePrograms);
    } catch (error) {
      console.error('获取所有程序列表失败:', error);
      message.error('获取程序列表失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchPrograms = async (pid) => {
    if (!pid) return;
    // 统一转换为字符串类型，确保类型安全
    const projectIdStr = String(pid);
    const projectIdNum = Number(pid);
    setLoading(true);
    try {
      const data = await getProgramsByProject(projectIdStr);
      
      // 只保留去重逻辑，移除所有过滤逻辑
      const uniquePrograms = [...new Map(data.map(program => [program.id, program])).values()];
      
      // 返回所有去重后的程序，不做任何过滤
      setPrograms(uniquePrograms);
      
      // 更新项目连接状态为在线
      setProjects(prevProjects => prevProjects.map(p => 
        p.id === projectIdNum ? { ...p, connectionStatus: { connected: true, error: null } } : p
      ));
      
    } catch (err) {
      setPrograms([]);
      // 更新项目连接状态为离线
      setProjects(prevProjects => prevProjects.map(p => 
        p.id === projectIdNum ? { ...p, connectionStatus: { connected: false, error: err.message } } : p
      ));
      
      if (!err.message?.includes('cancel')) {
        message.error(err.response?.data?.error || '获取程序列表失败');
      }
    } finally {
      setLoading(false);
    }
  };

  // 初始化 - 只有在认证完成后才获取项目列表
  useEffect(() => {
    // 确保用户已登录
    if (user) {
      fetchProjects();
    }
  }, [user, fetchProjects]); // 仅在user或fetchProjects变化时执行

  // 已移除5秒后重新检查所有项目连接状态的定时逻辑
  // 仅在页面首次加载时检查一次连接状态

  // 添加数据加载逻辑，根据URL中的projectId加载数据
  useEffect(() => {
    if (!user || loadingProjects) return;
    if (projectId) {
      fetchPrograms(projectId);
    } else {
      fetchAllProgramsData();
    }
  }, [projectId, user, loadingProjects]);

  // --- 动作处理 ---

  const handleAction = async (id, action, name) => {
    setActionLoading(prev => ({ ...prev, [id]: action }));
    try {
      let res;
      if (action === 'start') res = await startProgram(id);
      if (action === 'stop') res = await stopProgram(id);
      if (action === 'restart') res = await restartProgram(id);

      if (res.success) {
        message.success(`${name} 指令已发送`);
        
        // 对于重启和启动操作，增加延迟以确保程序有足够时间启动
        if (action === 'restart' || action === 'start') {
          // 给程序一些启动时间
          setTimeout(() => {
            fetchPrograms(projectId);
          }, 1000);
        } else {
          // 停止操作可以立即刷新
          fetchPrograms(projectId);
        }
      } else {
        message.error(res.message || '操作失败');
      }
    } catch {
      message.error('请求异常');
    } finally {
      setActionLoading(prev => ({ ...prev, [id]: null }));
    }
  };

  const handleBatch = async (action, name) => {
    const hide = message.loading(`正在${name}所有程序...`, 0);
    try {
      let res;
      if (action === 'start') res = await startAllPrograms(projectId);
      if (action === 'stop') res = await stopAllPrograms(projectId);
      if (action === 'restart') res = await restartAllPrograms(projectId);
      
      
      if (res?.success) {
        hide();
        message.success(res.message || '批量操作成功');
        
        // 对于批量重启和启动操作，增加延迟以确保程序有足够时间启动
        if (action === 'restart' || action === 'start') {
          setTimeout(() => {
            fetchPrograms(projectId);
          }, 1500); // 批量操作需要更多时间
        } else {
          fetchPrograms(projectId);
        }
      } else {
        hide();
        message.error(res?.message || '批量操作失败');
      }
    } catch (error) {
      hide();
      console.error(`${name}所有程序异常:`, error);
      // 显示更具体的错误信息
      const errorMessage = error.response?.data?.message || error.message || '批量操作异常';
      message.error(errorMessage);
    }
  };

  // --- UI配置 ---

  const columns = [
    {
        title: '状态',
        dataIndex: 'status',
        width: 120,
        render: (status) => {
          let color = 'default';
          let icon = null;
          if (status === 'RUNNING') { color = 'success'; icon = <CheckCircleOutlined />; }
          else if (status === 'STOPPED') { color = 'error'; icon = <PauseCircleOutlined />; }
          else if (status === 'STARTING') { color = 'processing'; icon = <ReloadOutlined spin />; }
          else { color = 'warning'; icon = <ExclamationCircleOutlined />; }
          return <Tag icon={icon} color={color}>{status}</Tag>;
        }
      },
    {
      title: '程序名称',
      dataIndex: 'name',
      width: 300,
      render: (text) => (
        <div>
          <Text strong style={{ fontSize: 14 }}>{text}</Text>
        </div>
      )
    },
    {
      title: '运行时长',
      dataIndex: 'uptime',
      width: 180,
      render: (uptime, record) => {
        // 确保只有运行中的程序显示时长，其他状态显示'-'
        if (record.status !== 'RUNNING' || !uptime) return '-';
        return <Text style={{ color: '#666', fontSize: 14 }}>{uptime}</Text>;
      }
    },
    {
      title: '操作',
      key: 'action',
      width: 280,
      render: (_, record) => {
        const loadingAction = actionLoading[record.id];
        return (
          <Space>
            <Tooltip title="启动">
              <Button 
                type="text" 
                shape="circle" 
                icon={<PlayCircleOutlined />} 
                style={{ color: record.status === 'RUNNING' ? '#d9d9d9' : '#52c41a' }}
                disabled={record.status === 'RUNNING' || loadingAction}
                loading={loadingAction === 'start'}
                onClick={() => handleAction(record.id, 'start', '启动')}
              />
            </Tooltip>
            <Tooltip title="停止">
              <Button 
                type="text" 
                shape="circle" 
                danger
                icon={<PauseCircleOutlined />}
                disabled={record.status === 'STOPPED' || loadingAction}
                loading={loadingAction === 'stop'}
                onClick={() => handleAction(record.id, 'stop', '停止')}
              />
            </Tooltip>
            <Tooltip title={record.status === 'STOPPED' ? '未运行的服务不支持重启' : '重启'}>
              <Button 
                type="text" 
                shape="circle" 
                style={{ color: record.status === 'STOPPED' ? '#d9d9d9' : '#1890ff' }}
                icon={<ReloadOutlined />}
                loading={loadingAction === 'restart'}
                disabled={record.status === 'STOPPED' || loadingAction}
                onClick={() => handleAction(record.id, 'restart', '重启')}
              />
            </Tooltip>
            <Button 
              size="small" 
              icon={<FileTextOutlined />} 
              onClick={() => {
                setSelectedProgramId(record.id);
                setShowLogDrawer(true);
              }}
            >
              详情/日志
            </Button>
          </Space>
        );
      }
    }
  ];

  const userMenu = {
    items: [
      ...((user?.roleId === 1 || user?.roleId === 2) ? [{
        key: 'users',
        label: '用户管理',
        icon: <UserOutlined />,
        onClick: () => setShowUsersModal(true)
      }] : []),
      { key: 'pwd', label: '修改密码', icon: <SettingOutlined />, onClick: () => setShowPwdModal(true) },
      { type: 'divider' },
      { key: 'logout', label: '退出登录', icon: <LogoutOutlined />, danger: true, onClick: logout }
    ]
  };

  return (
    <div>
      <Layout style={{ minHeight: '100vh' }}>
        <Sider 
          trigger={null} 
          collapsible 
          collapsed={collapsed} 
          width={280} 
          theme="light"
          style={{ 
            boxShadow: '2px 0 12px 0 rgba(29,35,41,.06)', 
            zIndex: 10,
            backgroundColor: '#ffffff',
            borderRight: '1px solid #f5f5f5'
          }}
        >
          {/* Logo区域优化 */}
          <div style={{ 
            height: 72, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            borderBottom: '1px solid #e8e8e8',
            background: '#ffffff',
            color: '#2d3748',
            boxShadow: '0 1px 4px rgba(0,0,0,0.05)'
          }}>
            <ClusterOutlined style={{ fontSize: 32, color: '#2d3748', marginRight: 16 }} />
            {!collapsed && <span style={{ 
              fontWeight: '700', 
              fontSize: 22, 
              color: '#2d3748',
              letterSpacing: '0.5px',
              fontFamily: 'Segoe UI, Roboto, sans-serif',
              textShadow: '0 1px 2px rgba(0,0,0,0.05)'
            }}>Supervisor</span>}
          </div>
          
          {/* 搜索和项目列表标题区域 */}
          <div style={{ 
            padding: '20px 20px 16px', 
            display: collapsed ? 'none' : 'flex', 
            flexDirection: 'column', 
            gap: '16px',
            backgroundColor: '#ffffff',
            borderBottom: '1px solid #f0f0f0'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ 
                fontSize: 14, 
                fontWeight: '600',
                textTransform: 'uppercase',
                letterSpacing: '1px',
                color: '#4a5568',
                fontFamily: 'Segoe UI, Roboto, sans-serif'
              }}>机器列表 ({filteredProjects.length})</Text>
              {user?.roleId === 1 && (
                <Tooltip title="管理机器">
                  <Button 
                    type="text" 
                    size="small" 
                    icon={<SettingOutlined />} 
                    onClick={() => setShowProjectModal(true)}
                    style={{ 
                      color: '#667eea',
                      fontSize: '14px',
                      fontWeight: '500'
                    }}
                  />
                </Tooltip>
              )}
            </div>
            
            {/* 搜索框优化 */}
            <Input.Search
              placeholder="搜索机器名称或描述"
              allowClear
              enterButton={<SearchOutlined />}
              size="middle"
              value={projectSearchText}
              onChange={(e) => setProjectSearchText(e.target.value)}
              style={{ 
                width: '100%',
                borderRadius: '12px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                borderColor: '#e2e8f0',
                transition: 'all 0.3s ease',
                '&:hover': {
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                }
              }}
            />
          </div>

          {/* 机器树：分组 + 机器 */}
          <div style={{ height: 'calc(100% - 128px)', overflow: 'auto', padding: '0 8px' }}>
            <div
              onClick={() => { navigate('/programs'); }}
              style={{
                padding: '10px 12px', cursor: 'pointer', borderRadius: 6, marginBottom: 4,
                background: !projectId ? '#e6f7ff' : 'transparent',
                fontWeight: !projectId ? 600 : 400, fontSize: 14,
                display: 'flex', alignItems: 'center', gap: 8
              }}>
              <AppstoreOutlined /> 全部机器 ({projects.length})
            </div>

            {groups.map(g => {
              const groupProjects = projects.filter(p => p.groupId === g.id);
              const isExpanded = expandedGroups[g.id] !== false;
              return (
                <div key={g.id} style={{ marginBottom: 4 }}>
                  <div
                    onClick={() => setExpandedGroups(prev => ({ ...prev, [g.id]: !isExpanded }))}
                    style={{
                      padding: '8px 12px', cursor: 'pointer', borderRadius: 6,
                      fontWeight: 500, fontSize: 13, color: '#4a5568',
                      display: 'flex', alignItems: 'center', gap: 6, userSelect: 'none',
                      background: '#f7fafc'
                    }}>
                    <span style={{ fontSize: 10 }}>{isExpanded ? '▼' : '▶'}</span>
                    📁 {g.name}
                    <span style={{ fontSize: 11, color: '#999', marginLeft: 'auto' }}>{g.machineCount}台</span>
                  </div>
                  {isExpanded && groupProjects
                    .filter(p => !projectSearchText || p.name.includes(projectSearchText))
                    .map(p => (
                      <div key={p.id}
                        onClick={() => navigate(`/programs/${p.id}`)}
                        style={{
                          padding: '8px 12px 8px 32px', cursor: 'pointer', borderRadius: 4, margin: '1px 0',
                          background: projectId === String(p.id) ? '#e6f7ff' : 'transparent',
                          borderLeft: projectId === String(p.id) ? '3px solid #1890ff' : '3px solid transparent',
                          fontSize: 13, display: 'flex', alignItems: 'center', gap: 8
                        }}>
                        <span style={{
                          width: 8, height: 8, borderRadius: '50%', display: 'inline-block', flexShrink: 0,
                          backgroundColor: p.connectionStatus?.connected === true ? '#52c41a' :
                            p.connectionStatus?.connected === null ? '#d9d9d9' : '#ff4d4f'
                        }} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                      </div>
                    ))}
                </div>
              );
            })}

            {filteredProjects.filter(p => !p.groupId).length > 0 && (
              <div style={{ marginTop: 8 }}>
                <div style={{ padding: '8px 12px', fontSize: 12, color: '#999', fontWeight: 500 }}>未分组</div>
                {filteredProjects.filter(p => !p.groupId).map(p => (
                  <div key={p.id}
                    onClick={() => navigate(`/programs/${p.id}`)}
                    style={{
                      padding: '8px 12px', cursor: 'pointer', borderRadius: 4, margin: '1px 0',
                      background: projectId === String(p.id) ? '#e6f7ff' : 'transparent',
                      borderLeft: projectId === String(p.id) ? '3px solid #1890ff' : '3px solid transparent',
                      fontSize: 13, display: 'flex', alignItems: 'center', gap: 8
                    }}>
                    <span style={{
                      width: 8, height: 8, borderRadius: '50%', display: 'inline-block', flexShrink: 0,
                      backgroundColor: p.connectionStatus?.connected === true ? '#52c41a' :
                        p.connectionStatus?.connected === null ? '#d9d9d9' : '#ff4d4f'
                    }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Sider>

        <Layout>
          <Header style={{ padding: '0 24px', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 1px 4px rgba(0,21,41,.08)', zIndex: 9 }}>
            {React.createElement(collapsed ? MenuUnfoldOutlined : MenuFoldOutlined, {
              className: 'trigger',
              onClick: () => setCollapsed(!collapsed),
              style: { fontSize: 18, cursor: 'pointer' }
            })}
            
            <Dropdown menu={userMenu}>
              <Space style={{ cursor: 'pointer' }}>
                <Avatar style={{ backgroundColor: '#1890ff' }} icon={<UserOutlined />} />
                <Text>{user?.username}</Text>
              </Space>
            </Dropdown>
          </Header>

          <Content style={{ margin: '24px', minHeight: 280 }}>
            {projectId ? (
              <>
                <StatsCards stats={stats} />

                {/* 主操作栏 */}
                <Card 
                  bordered={false} 
                  style={{ 
                    marginBottom: 24, 
                    borderRadius: '16px',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
                    border: '1px solid #f0f0f0'
                  }}
                >
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    flexWrap: 'wrap', 
                    gap: 24 
                  }}>
                    <Space size="large" align="center">
                      <Title level={4} style={{ 
                        margin: 0, 
                        color: '#2d3748', 
                        fontSize: '20px',
                        fontWeight: '700',
                        fontFamily: 'Segoe UI, Roboto, sans-serif'
                      }}>
                        {projects.find(p => String(p.id) === projectId)?.name || '未命名项目'}
                      </Title>
                      <Input 
                        placeholder="搜索程序..." 
                        prefix={<SearchOutlined style={{ color: '#a0aec0' }} />} 
                        allowClear
                        onChange={e => setSearchText(e.target.value)} 
                        style={{ 
                          width: 240, 
                          borderRadius: '12px',
                          borderColor: '#e2e8f0',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
                        }} 
                      />
                    </Space>
                    
                    <Space size="middle">
                      <Button 
                        onClick={async () => {
                          // 先检查项目连接状态
                          try {
                            const connectionStatus = await checkProjectStatus(projectId);
                            
                            // 更新项目连接状态
                            setProjects(prevProjects => {
                              return prevProjects.map(p => {
                                if (p.id === Number(projectId)) {
                                  return {
                                    ...p,
                                    connectionStatus
                                  };
                                }
                                return p;
                              });
                            });
                            
                            // 然后刷新程序列表
                            await fetchPrograms(projectId);
                          } catch (error) {
                            console.error(`刷新失败:`, error);
                            // 如果是请求被取消的错误，不显示错误信息
                            if (!error.message?.includes('cancel') && !error.message?.includes('NS_BINDING_ABORTED')) {
                              message.error('刷新失败');
                            }
                          }
                        }} 
                        icon={<ReloadOutlined />}
                        style={{
                          borderRadius: '10px',
                          borderColor: '#e2e8f0',
                          color: '#4a5568',
                          fontWeight: '500'
                        }}
                      >
                        刷新
                      </Button>
                      <Button 
                        onClick={() => handleBatch('start', '启动')} 
                        icon={<PlayCircleOutlined />}
                        style={{
                          borderRadius: '10px',
                          backgroundColor: '#38a169',
                          borderColor: '#38a169',
                          color: '#ffffff',
                          fontWeight: '500'
                        }}
                      >
                        全部启动
                      </Button>
                      <Button 
                        onClick={() => handleBatch('restart', '重启')} 
                        icon={<ReloadOutlined />}
                        style={{
                          borderRadius: '10px',
                          backgroundColor: '#fa8c16',
                          borderColor: '#fa8c16',
                          color: '#ffffff',
                          fontWeight: '500'
                        }}
                        disabled={filteredPrograms.length === 0 || filteredPrograms.every(p => p.status === 'STOPPED')}
                      >
                        全部重启
                      </Button>
                      <Button 
                        danger 
                        onClick={() => handleBatch('stop', '停止')} 
                        icon={<PauseCircleOutlined />}
                        style={{
                          borderRadius: '10px',
                          backgroundColor: '#e53e3e',
                          borderColor: '#e53e3e',
                          color: '#ffffff',
                          fontWeight: '500'
                        }}
                      >
                        全部停止
                      </Button>
                      <Button
                        onClick={async () => {
                          try {
                            const res = await reloadConfig(projectId);
                            message.success(res.message || '配置已重载');
                            setTimeout(() => fetchPrograms(projectId), 500);
                          } catch { message.error('重载失败'); }
                        }}
                        icon={<ReloadOutlined />}
                        style={{ borderRadius: '10px', backgroundColor: '#718096', borderColor: '#718096', color: '#fff', fontWeight: '500' }}
                      >
                        重载配置
                      </Button>
                    </Space>
                  </div>
                </Card>

                {/* 程序表格 */}
                <Card 
                  bordered={false} 
                  bodyStyle={{ padding: 0 }}
                  style={{
                    borderRadius: '16px',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
                    border: '1px solid #f0f0f0'
                  }}
                >
                  <Table
                    columns={columns}
                    dataSource={filteredPrograms}
                    rowKey="id"
                    loading={loading}
                    pagination={false}
                    locale={{ 
                      emptyText: <Empty 
                        description={<Text style={{ color: '#a0aec0' }}>暂无程序</Text>} 
                        image={Empty.PRESENTED_IMAGE_SIMPLE} 
                        imageStyle={{ height: 60 }}
                      /> 
                    }}
                    rowClassName={() => {
                      return 'table-row-hover';
                    }}
                    style={{
                      borderRadius: '16px',
                      overflow: 'hidden'
                    }}
                    tableLayout="fixed"
                    components={{
                      Header: (props) => (
                        <thead {...props} style={{
                          backgroundColor: '#f7fafc',
                          borderBottom: '2px solid #e2e8f0'
                        }} />
                      ),
                      Body: (props) => (
                        <tbody {...props} style={{
                          backgroundColor: '#ffffff'
                        }} />
                      )
                    }}
                  />
                </Card>
              </>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', flexDirection: 'column' }}>
                <Empty description="请从左侧选择一台机器进行管理" />
              </div>
            )}
          </Content>
        </Layout>
      </Layout>
      
      {/* 弹窗组件挂载区 */}
      <UsersPage isOpen={showUsersModal} onClose={() => setShowUsersModal(false)} />
      
      <ProgramDetailPage 
        isOpen={showLogDrawer} 
        onClose={() => setShowLogDrawer(false)} 
        programId={selectedProgramId} 
      />
      
      {/* 这里你需要自己创建一个 ProjectManageModal 和 ChangePasswordModal 的 Antd 版本 
         或者直接在这里使用 Antd Modal 重写逻辑。
         为了保持代码整洁，建议将原 ProgramsPage 中的 密码/项目管理 逻辑抽离。
      */}
      {showProjectModal && (
        <ProjectManageModal
          open={showProjectModal}
          onClose={() => { setShowProjectModal(false); fetchProjects(); }}
          onRefresh={() => { fetchProjects(); }}
          projects={projects}
        />
      )}

      {showPwdModal && (
        <ChangePasswordModal
          open={showPwdModal}
          onClose={() => setShowPwdModal(false)}
        />
      )}
    </div>
  );
};

export default ProgramsPage;
