import React, { useState, useEffect, useMemo } from 'react';
import { 
  Layout, Menu, Table, Button, Tag, Space, message, 
  Card, Row, Col, Statistic, Empty, Badge, 
  Typography, Input, Dropdown, Avatar, Tooltip
} from 'antd';
import { 
  AppstoreOutlined, SettingOutlined, LogoutOutlined, UserOutlined, 
  PlayCircleOutlined, PauseCircleOutlined, ReloadOutlined, 
  FileTextOutlined, ClusterOutlined, CheckCircleOutlined, 
  CloseCircleOutlined, ExclamationCircleOutlined, SearchOutlined,
  MenuFoldOutlined, MenuUnfoldOutlined
} from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  getProgramsByProject, startProgram, stopProgram, restartProgram, 
  getProjects, startAllPrograms, stopAllPrograms, restartAllPrograms
} from '../utils/api';

// 引入子组件
import UsersPage from './UsersPage';
import ProgramDetailPage from './ProgramDetailPage'; // 日志详情抽屉
import ProjectManageModal from '../components/modals/ProjectManageModal'; // 建议新建此组件，见下文
import ChangePasswordModal from '../components/modals/ChangePasswordModal'; // 建议新建此组件

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
  const [loading, setLoading] = useState(true);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [searchText, setSearchText] = useState('');
  
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
      error: programs.filter(p => ['FATAL', 'BACKOFF', 'UNKNOWN'].includes(p.status)).length
    };
  }, [programs]);

  // 搜索过滤
  const filteredPrograms = useMemo(() => {
    if (!searchText) return programs;
    return programs.filter(p => p.name.toLowerCase().includes(searchText.toLowerCase()));
  }, [programs, searchText]);

  // --- API 交互 ---

  const fetchProjects = async () => {
    try {
      setLoadingProjects(true);
      const data = await getProjects();
      setProjects(data);
    } catch {
      message.error('获取项目列表失败');
    } finally {
      setLoadingProjects(false);
    }
  };

  const fetchPrograms = async (pid) => {
    if (!pid) return;
    setLoading(true);
    try {
      const data = await getProgramsByProject(pid);
      setPrograms(data);
    } catch (err) {
      // 切换项目失败时清空列表
      setPrograms([]);
      if (!err.message?.includes('cancel')) {
        message.error(err.response?.data?.error || '获取程序列表失败');
      }
    } finally {
      setLoading(false);
    }
  };

  // 初始化
  useEffect(() => { fetchProjects(); }, []);

  // 项目切换逻辑
  useEffect(() => {
    if (projectId) {
      fetchPrograms(projectId);
    } else if (!loadingProjects && projects.length > 0) {
      navigate(`/programs/${projects[0].id}`);
    }
  }, [projectId, projects, loadingProjects, navigate]);

  // 自动轮询 (每5秒更新状态)
  useEffect(() => {
    if (!projectId) return;
    const interval = setInterval(async () => {
      // 如果正在操作或打开了日志，暂停轮询以防跳动
      if (Object.keys(actionLoading).length > 0 || showLogDrawer) return;
      try {
        const data = await getProgramsByProject(projectId);
        setPrograms(data);
      } catch { /* ignore silent refresh errors */ }
    }, 5000);
    return () => clearInterval(interval);
  }, [projectId, actionLoading, showLogDrawer]);

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
        fetchPrograms(projectId); // 立即刷新
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
        message.success('批量操作成功');
        fetchPrograms(projectId);
      } else {
        hide();
        message.error('批量操作失败');
      }
    } catch {
      hide();
      message.error('批量操作异常');
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
      render: (text, record) => (
        <div>
          <Text strong style={{ fontSize: 15 }}>{text}</Text>
          <div style={{ color: '#888', fontSize: 12 }}>{record.description || '暂无描述'}</div>
        </div>
      )
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
            <Tooltip title="重启">
              <Button 
                type="text" 
                shape="circle" 
                style={{ color: '#1890ff' }}
                icon={<ReloadOutlined />}
                loading={loadingAction === 'restart'}
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
      ...(user?.roleId === 1 || user?.roleId === 2 ? [{
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
    <Layout style={{ minHeight: '100vh' }}>
      <Sider 
        trigger={null} 
        collapsible 
        collapsed={collapsed} 
        width={260} 
        theme="light"
        style={{ boxShadow: '2px 0 8px 0 rgba(29,35,41,.05)', zIndex: 10 }}
      >
        <div style={{ height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid #f0f0f0' }}>
          <ClusterOutlined style={{ fontSize: 24, color: '#1890ff' }} />
          {!collapsed && <span style={{ marginLeft: 10, fontWeight: 'bold', fontSize: 18, color: '#001529' }}>SuperD</span>}
        </div>
        
        <div style={{ padding: '16px 16px 8px', display: collapsed ? 'none' : 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text type="secondary" style={{ fontSize: 12 }}>项目列表 ({projects.length})</Text>
          {user?.roleId === 1 && (
            <Tooltip title="管理项目">
              <Button type="text" size="small" icon={<SettingOutlined />} onClick={() => setShowProjectModal(true)} />
            </Tooltip>
          )}
        </div>

        <Menu
          mode="inline"
          selectedKeys={[projectId]}
          style={{ borderRight: 0 }}
          items={projects.map(p => ({
            key: String(p.id),
            icon: <Badge status={p.connectionStatus?.connected ? 'success' : 'error'} />,
            label: p.name,
            title: p.description,
            onClick: () => navigate(`/programs/${p.id}`)
          }))}
        />
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
              {/* 顶部统计卡片 */}
              <Row gutter={16} style={{ marginBottom: 24 }}>
                <Col span={6}>
                  <Card bordered={false} hoverable>
                    <Statistic title="总程序数" value={stats.total} prefix={<AppstoreOutlined />} />
                  </Card>
                </Col>
                <Col span={6}>
                  <Card bordered={false} hoverable>
                    <Statistic title="运行中" value={stats.running} valueStyle={{ color: '#3f8600' }} prefix={<CheckCircleOutlined />} />
                  </Card>
                </Col>
                <Col span={6}>
                  <Card bordered={false} hoverable>
                    <Statistic title="已停止" value={stats.stopped} valueStyle={{ color: '#cf1322' }} prefix={<PauseCircleOutlined />} />
                  </Card>
                </Col>
                <Col span={6}>
                  <Card bordered={false} hoverable>
                    <Statistic title="异常状态" value={stats.error} valueStyle={{ color: '#faad14' }} prefix={<ExclamationCircleOutlined />} />
                  </Card>
                </Col>
              </Row>

              {/* 主操作栏 */}
              <Card bordered={false} style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
                  <Space size="large">
                    <Title level={4} style={{ margin: 0 }}>
                      {projects.find(p => String(p.id) === projectId)?.name || '未命名项目'}
                    </Title>
                    <Input 
                      placeholder="搜索程序..." 
                      prefix={<SearchOutlined />} 
                      allowClear
                      onChange={e => setSearchText(e.target.value)} 
                      style={{ width: 200 }} 
                    />
                  </Space>
                  
                  <Space>
                    <Button onClick={() => fetchPrograms(projectId)} icon={<ReloadOutlined />}>刷新</Button>
                    <Button onClick={() => handleBatch('start', '启动')} icon={<PlayCircleOutlined />}>全部启动</Button>
                    <Button onClick={() => handleBatch('restart', '重启')} icon={<ReloadOutlined />}>全部重启</Button>
                    <Button danger onClick={() => handleBatch('stop', '停止')} icon={<PauseCircleOutlined />}>全部停止</Button>
                  </Space>
                </div>
              </Card>

              {/* 程序表格 */}
              <Card bordered={false} bodyStyle={{ padding: 0 }}>
                <Table
                  columns={columns}
                  dataSource={filteredPrograms}
                  rowKey="id"
                  loading={loading}
                  pagination={false}
                  locale={{ emptyText: <Empty description="暂无程序" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
                />
              </Card>
            </>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', flexDirection: 'column' }}>
              <Empty description="请从左侧选择一个项目进行管理" />
            </div>
          )}
        </Content>
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
          onClose={() => setShowProjectModal(false)}
          onRefresh={fetchProjects}
          projects={projects}
        />
      )}

      {showPwdModal && (
        <ChangePasswordModal
          open={showPwdModal}
          onClose={() => setShowPwdModal(false)}
        />
      )}

    </Layout>
  );
};

export default ProgramsPage;