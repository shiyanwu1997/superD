import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Layout,
  Menu,
  Table,
  Button,
  Tag,
  Space,
  message,
  Card,
  Row,
  Col,
  Statistic,
  Empty,
  Badge,
  Select,
  Skeleton,
  Typography,
  Input,
  Dropdown,
  Avatar,
  Tooltip,
} from 'antd';
import {
  AppstoreOutlined,
  SettingOutlined,
  LogoutOutlined,
  UserOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  ReloadOutlined,
  FileTextOutlined,
  ClusterOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  SearchOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  ControlOutlined,
} from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  getAllPrograms,
  getProgramsByProject,
  startProgram,
  stopProgram,
  restartProgram,
  getProjects,
  startAllPrograms,
  stopAllPrograms,
  restartAllPrograms,
  batchRestartPrograms,
  reloadConfig,
  checkProjectStatus,
  getGroups,
} from '../utils/api';

// 引入子组件
import UsersPage from './UsersPage';
import ProgramDetailPage from './ProgramDetailPage';
import StatsCards from '../components/StatsCards';
import Logo from '../components/Logo';
import ProjectSidebar from '../components/ProjectSidebar';
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
  const [groups, setGroups] = useState([]);

  // 页面加载时间状态，用于控制离线状态显示的延迟
  const pageLoadTimeRef = useRef(null);
  const prevProjectRef = useRef(null);
  // 已确认删除的项目，避免重复提示/循环刷新
  const deletedProjectRef = useRef(null);
  // 递增的请求序号：响应返回时若已有更新的请求发出，丢弃本次结果（防止快速切换项目时旧响应覆盖新数据）
  const fetchSeqRef = useRef(0);

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
      running: programs.filter((p) => p.status === 'RUNNING').length,
      stopped: programs.filter((p) => p.status === 'STOPPED').length,
      error: programs.filter((p) => ['FATAL', 'BACKOFF', 'UNKNOWN', 'EXITED'].includes(p.status)).length,
    };
  }, [programs]);

  // 搜索过滤
  const filteredPrograms = useMemo(() => {
    if (!searchText) return programs;
    return programs.filter((p) => p.name.toLowerCase().includes(searchText.toLowerCase()));
  }, [programs, searchText]);

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
      const projectsWithInitialStatus = data.map((project) => ({
        ...project,
        connectionStatus: { connected: null, error: null }, // 初始状态为检查中
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
              await new Promise((resolve) => setTimeout(resolve, 2000 * retryCount));
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
            connectionStatus: delayedStatus,
          };
        }
      });

      // 等待所有连接状态检查完成
      const connectionStatusResults = await Promise.all(connectionStatusPromises);

      // 批量更新连接状态
      setProjects((prevProjects) => {
        return prevProjects.map((project) => {
          const statusResult = connectionStatusResults.find((result) => result.projectId === project.id);
          if (statusResult) {
            return {
              ...project,
              connectionStatus: statusResult.connectionStatus,
            };
          }
          return project;
        });
      });
    } catch (error) {
      if (!error._handled) {
        console.error('获取项目列表失败:', error);
        message.error('获取项目列表失败');
      }
    } finally {
      setLoadingProjects(false);
    }
  }, [getDelayedConnectionStatus, fetchGroups]);

  // showLoading 参数保留以对齐 fetchPrograms 签名，当前实现无需 loading 状态
  // eslint-disable-next-line no-unused-vars
  const fetchAllProgramsData = async (showLoading = true) => {
    try {
      const data = await getAllPrograms();
      const uniquePrograms = [...new Map(data.map((program) => [program.id, program])).values()];
      setPrograms((prev) =>
        prev.length === 0
          ? uniquePrograms
          : prev.map((p) => {
              const u = uniquePrograms.find((x) => x.id === p.id);
              return u ? { ...p, status: u.status, state: u.state, uptime: u.uptime } : p;
            })
      );
    } catch {
      /* silent refresh */
    }
  };

  const fetchPrograms = async (pid, showLoading = true) => {
    if (!pid) return;
    const projectIdStr = String(pid);
    const projectIdNum = Number(pid);
    const seq = ++fetchSeqRef.current;
    const isStale = () => seq !== fetchSeqRef.current;
    try {
      const isNewProject = prevProjectRef.current !== projectIdNum;
      prevProjectRef.current = projectIdNum;

      if (showLoading) setLoading(true);
      const data = await getProgramsByProject(projectIdStr);
      if (isStale()) return; // 已有更新的请求，丢弃旧响应
      const uniquePrograms = [...new Map(data.map((program) => [program.id, program])).values()];

      // 静默刷新：仅更新状态字段，不触发loading闪光
      setPrograms((prev) => {
        if (isNewProject || prev.length === 0) return uniquePrograms;
        // 如果程序数量变了，全量更新
        if (prev.length !== uniquePrograms.length) return uniquePrograms;
        // 否则只更新 status 和 uptime
        return prev.map((p) => {
          const updated = uniquePrograms.find((u) => u.id === p.id);
          return updated ? { ...p, status: updated.status, state: updated.state, uptime: updated.uptime } : p;
        });
      });

      // 更新项目连接状态为在线
      setProjects((prevProjects) =>
        prevProjects.map((p) =>
          p.id === projectIdNum ? { ...p, connectionStatus: { connected: true, error: null } } : p
        )
      );
    } catch (err) {
      // 旧请求的报错不影响当前项目
      if (isStale()) return;
      // 项目已被删除：跳回列表页并刷新项目树，避免轮询无限报错
      const errText = `${err.response?.data?.data || ''} ${err.message || ''}`;
      if (errText.includes('项目不存在')) {
        if (deletedProjectRef.current !== projectIdNum) {
          deletedProjectRef.current = projectIdNum;
          message.warning('该项目已被删除');
          navigate('/programs', { replace: true });
          fetchProjects();
        }
        return;
      }
      if (showLoading) {
        setPrograms([]);
        if (!err._handled && !err.message?.includes('cancel')) {
          message.error(err.response?.data?.error || '获取程序列表失败');
        }
      }
      // 更新项目连接状态为离线
      setProjects((prevProjects) =>
        prevProjects.map((p) =>
          p.id === projectIdNum ? { ...p, connectionStatus: { connected: false, error: err.message } } : p
        )
      );
    } finally {
      if (showLoading && !isStale()) setLoading(false);
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

  // 自动刷新：每10秒更新进程状态（利用5秒缓存，对Supervisor负载很小）
  useEffect(() => {
    const fn = projectId ? () => fetchPrograms(projectId, false) : () => fetchAllProgramsData(false);
    const timer = setInterval(fn, 10000);
    return () => clearInterval(timer);
  }, [projectId]);

  // --- 动作处理 ---

  const handleAction = async (id, action, name) => {
    setActionLoading((prev) => ({ ...prev, [id]: action }));
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
      setActionLoading((prev) => ({ ...prev, [id]: null }));
    }
  };

  const handleBatch = async (action, name) => {
    const targets = searchText ? filteredPrograms : programs;
    if (targets.length === 0) {
      message.warning('没有可操作的程序');
      return;
    }

    const label = searchText ? `筛选的 ${targets.length} 个程序` : '所有程序';
    const hide = message.loading(`正在${name}${label}...`, 0);

    try {
      if (searchText) {
        // 筛选出的程序：批量端点并行执行
        if (action === 'restart') {
          const res = await batchRestartPrograms(targets.map((p) => p.id));
          const { succeeded, failed } = res.summary || {};
          if (failed > 0) {
            console.error(
              '批量重启失败明细:',
              res.results?.filter((r) => !r.success)
            );
            message.warning(`重启完成：成功 ${succeeded} / 失败 ${failed}`);
          }
        } else {
          // 启动/停止：逐个操作（后端暂无批量端点）
          for (const p of targets) {
            if (action === 'start') await startProgram(p.id);
            if (action === 'stop') await stopProgram(p.id);
          }
        }
      } else {
        // 无筛选 → 批量 XML-RPC 调用
        if (action === 'start') await startAllPrograms(projectId);
        if (action === 'stop') await stopAllPrograms(projectId);
        if (action === 'restart') await restartAllPrograms(projectId);
      }
      hide();
      message.success(`${name}完成: ${label}`);
      setTimeout(() => fetchPrograms(projectId), action === 'stop' ? 500 : 1500);
    } catch (error) {
      hide();
      if (!error._handled) message.error('操作失败: ' + (error.response?.data?.message || error.message));
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
        if (status === 'RUNNING') {
          color = 'success';
          icon = <CheckCircleOutlined />;
        } else if (status === 'STOPPED') {
          color = 'error';
          icon = <PauseCircleOutlined />;
        } else if (status === 'STARTING') {
          color = 'processing';
          icon = <ReloadOutlined spin />;
        } else {
          color = 'warning';
          icon = <ExclamationCircleOutlined />;
        }
        return (
          <Tag icon={icon} color={color}>
            {status}
          </Tag>
        );
      },
    },
    {
      title: '程序名称',
      dataIndex: 'name',
      width: 260,
      ellipsis: { showTitle: false },
      render: (text) => {
        // 简化显示：api-kafka-subscribe:api-kafka-subscribe_00 → api-kafka-subscribe_00
        const short = text.includes(':') ? text.split(':').pop() : text;
        return (
          <Tooltip title={text} placement="topLeft">
            <span style={{ fontSize: 14, fontWeight: 500 }}>{short}</span>
          </Tooltip>
        );
      },
    },
    {
      title: '运行时长',
      dataIndex: 'uptime',
      width: 180,
      render: (uptime, record) => {
        // 确保只有运行中的程序显示时长，其他状态显示'-'
        if (record.status !== 'RUNNING' || !uptime) return '-';
        return <Text style={{ color: '#666', fontSize: 14 }}>{uptime}</Text>;
      },
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
                style={{ color: record.status === 'STOPPED' ? '#d9d9d9' : '#111' }}
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
      },
    },
  ];

  const userMenu = {
    items: [
      ...(user?.roleId === 1 || user?.roleId === 2
        ? [
            {
              key: 'users',
              label: '用户管理',
              icon: <UserOutlined />,
              onClick: () => setShowUsersModal(true),
            },
          ]
        : []),
      { key: 'pwd', label: '修改密码', icon: <SettingOutlined />, onClick: () => setShowPwdModal(true) },
      { type: 'divider' },
      { key: 'logout', label: '退出登录', icon: <LogoutOutlined />, danger: true, onClick: logout },
    ],
  };

  return (
    <div>
      <Layout style={{ minHeight: '100vh' }}>
        <Sider
          trigger={null}
          collapsible
          collapsed={collapsed}
          width={280}
          collapsedWidth={72}
          style={{
            boxShadow: '1px 0 0 0 var(--border)',
            zIndex: 10,
            backgroundColor: '#fff',
            borderRight: 'none',
          }}
        >
          <div
            style={{
              height: 56,
              display: 'flex',
              alignItems: 'center',
              padding: collapsed ? '0 12px' : '0 20px',
              justifyContent: collapsed ? 'center' : 'flex-start',
              borderBottom: '1px solid var(--border)',
            }}
          >
            <Logo size={32} collapsed={collapsed} />
          </div>

          <div style={{ height: 'calc(100% - 56px)', overflow: 'hidden' }}>
            <ProjectSidebar
              collapsed={collapsed}
              projects={projects}
              groups={groups}
              selectedProjectId={projectId ?? null}
              isAdmin={user?.roleId === 1}
              onManageClick={() => setShowProjectModal(true)}
            />
          </div>
        </Sider>

        <Layout>
          <Header
            style={{
              padding: '0 24px',
              background: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid #e2e8f0',
              zIndex: 9,
              height: 56,
            }}
          >
            {React.createElement(collapsed ? MenuUnfoldOutlined : MenuFoldOutlined, {
              className: 'trigger',
              onClick: () => setCollapsed(!collapsed),
              style: { fontSize: 18, cursor: 'pointer' },
            })}

            <Dropdown menu={userMenu}>
              <Space style={{ cursor: 'pointer' }}>
                <Avatar style={{ backgroundColor: '#111' }} icon={<UserOutlined />} />
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
                    border: '1px solid #f0f0f0',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: 24,
                    }}
                  >
                    <Space size="large" align="center">
                      <Title
                        level={4}
                        style={{
                          margin: 0,
                          color: '#2d3748',
                          fontSize: '20px',
                          fontWeight: '700',
                          fontFamily: 'Segoe UI, Roboto, sans-serif',
                        }}
                      >
                        {projects.find((p) => String(p.id) === projectId)?.name || '未命名项目'}
                      </Title>
                      <Input
                        placeholder="搜索程序..."
                        prefix={<SearchOutlined style={{ color: '#a0aec0' }} />}
                        allowClear
                        onChange={(e) => setSearchText(e.target.value)}
                        style={{
                          width: 240,
                          borderRadius: '12px',
                          borderColor: '#e2e8f0',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
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
                            setProjects((prevProjects) => {
                              return prevProjects.map((p) => {
                                if (p.id === Number(projectId)) {
                                  return {
                                    ...p,
                                    connectionStatus,
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
                            if (
                              !error._handled &&
                              !error.message?.includes('cancel') &&
                              !error.message?.includes('NS_BINDING_ABORTED')
                            ) {
                              message.error('刷新失败');
                            }
                          }
                        }}
                        icon={<ReloadOutlined />}
                        style={{
                          borderRadius: '10px',
                          borderColor: '#e2e8f0',
                          color: '#4a5568',
                          fontWeight: '500',
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
                          fontWeight: '500',
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
                          fontWeight: '500',
                        }}
                        disabled={
                          filteredPrograms.length === 0 || filteredPrograms.every((p) => p.status === 'STOPPED')
                        }
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
                          fontWeight: '500',
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
                          } catch (e) {
                            if (!e._handled) message.error('重载失败');
                          }
                        }}
                        icon={<ReloadOutlined />}
                        style={{
                          borderRadius: '10px',
                          backgroundColor: '#718096',
                          borderColor: '#718096',
                          color: '#fff',
                          fontWeight: '500',
                        }}
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
                    border: '1px solid #f0f0f0',
                  }}
                >
                  <Table
                    columns={columns}
                    dataSource={filteredPrograms}
                    rowKey="id"
                    loading={loading}
                    pagination={false}
                    locale={{
                      emptyText: (
                        <Empty
                          description={<Text style={{ color: '#a0aec0' }}>暂无程序</Text>}
                          image={Empty.PRESENTED_IMAGE_SIMPLE}
                          imageStyle={{ height: 60 }}
                        />
                      ),
                    }}
                    rowClassName={() => {
                      return 'table-row-hover';
                    }}
                    style={{
                      borderRadius: '16px',
                      overflow: 'hidden',
                    }}
                    tableLayout="fixed"
                    components={{
                      Header: (props) => (
                        <thead
                          {...props}
                          style={{
                            backgroundColor: '#f7fafc',
                            borderBottom: '2px solid #e2e8f0',
                          }}
                        />
                      ),
                      Body: (props) => (
                        <tbody
                          {...props}
                          style={{
                            backgroundColor: '#ffffff',
                          }}
                        />
                      ),
                    }}
                  />
                </Card>
              </>
            ) : (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  height: '100%',
                  flexDirection: 'column',
                }}
              >
                <Empty description="请从左侧选择一台机器进行管理" />
              </div>
            )}
          </Content>
        </Layout>
      </Layout>

      {/* 弹窗组件挂载区 */}
      <UsersPage isOpen={showUsersModal} onClose={() => setShowUsersModal(false)} />

      <ProgramDetailPage isOpen={showLogDrawer} onClose={() => setShowLogDrawer(false)} programId={selectedProgramId} />

      {/* 这里你需要自己创建一个 ProjectManageModal 和 ChangePasswordModal 的 Antd 版本 
         或者直接在这里使用 Antd Modal 重写逻辑。
         为了保持代码整洁，建议将原 ProgramsPage 中的 密码/项目管理 逻辑抽离。
      */}
      {showProjectModal && (
        <ProjectManageModal
          open={showProjectModal}
          onClose={() => {
            setShowProjectModal(false);
            fetchProjects();
          }}
          onRefresh={() => {
            fetchProjects();
          }}
          projects={projects}
        />
      )}

      {showPwdModal && <ChangePasswordModal open={showPwdModal} onClose={() => setShowPwdModal(false)} />}
    </div>
  );
};

export default ProgramsPage;
