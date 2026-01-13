import React, { useState, useMemo } from 'react';
import { Modal, Button, Select, Tag, Space, message, Popconfirm, Divider, Input, Card, Row, Col, Typography, ConfigProvider } from 'antd';
import { UserAddOutlined, DeleteOutlined, KeyOutlined, FilterOutlined, DownOutlined, UpOutlined, SearchOutlined, UserOutlined, TeamOutlined, LoadingOutlined, ClusterOutlined } from '@ant-design/icons';
import { getAllUsers, deleteUser, getProjects, updateUserPassword, updateUserRole } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import UserTable from '../components/users/UserTable';
import UserFormDrawer from '../components/users/UserFormDrawer';

// 主题配置
const themeConfig = {
  token: {
    colorPrimary: '#1677ff',
    borderRadius: 12,
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.1)',
    colorBgContainer: '#ffffff',
    colorBorder: '#e8e8e8',
  },
};

// 颜色常量 - 现代配色方案
const COLORS = {
  primary: '#1677ff',
  primaryLight: '#4096ff',
  primaryDark: '#0958d9',
  success: '#52c41a',
  successLight: '#73d13d',
  warning: '#faad14',
  warningLight: '#ffc53d',
  danger: '#ff4d4f',
  dangerLight: '#ff7875',
  info: '#1677ff',
  superAdmin: '#1677ff',
  admin: '#52c41a',
  user: '#faad14',
  background: '#f5f7fa',
  backgroundSecondary: '#f0f5ff',
  border: '#e6f7ff',
  borderSecondary: '#f0f0f0',
  textPrimary: '#262626',
  textSecondary: '#8c8c8c',
  textTertiary: '#bfbfbf',
  cardBg: '#ffffff',
  shadowColor: 'rgba(0, 0, 0, 0.1)',
};

// 阴影常量 - 多层次阴影系统
const SHADOWS = {
  light: '0 2px 8px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.08)',
  medium: '0 4px 16px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(0, 0, 0, 0.12)',
  heavy: '0 12px 48px rgba(0, 0, 0, 0.1), 0 6px 16px rgba(0, 0, 0, 0.12)',
  hover: '0 16px 64px rgba(0, 0, 0, 0.15), 0 8px 24px rgba(0, 0, 0, 0.18)',
  inset: 'inset 0 2px 8px rgba(0, 0, 0, 0.06)',
};

// 动画常量 - 流畅的过渡效果
const ANIMATIONS = {
  fadeIn: 'fadeIn 0.5s cubic-bezier(0.23, 1, 0.32, 1)',
  slideUp: 'slideUp 0.5s cubic-bezier(0.23, 1, 0.32, 1)',
  slideDown: 'slideDown 0.5s cubic-bezier(0.23, 1, 0.32, 1)',
  hoverScale: 'scale(1.03)',
  cardHover: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
  buttonHover: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  tableRowHover: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
};

// 添加CSS动画 - 高级过渡效果
const style = document.createElement('style');
style.innerHTML = `
  /* 基础动画 */
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  
  @keyframes slideUp {
    from { transform: translateY(30px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }
  
  @keyframes slideDown {
    from { transform: translateY(-30px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }
  
  @keyframes pulse {
    0% { transform: scale(1); }
    50% { transform: scale(1.05); }
    100% { transform: scale(1); }
  }
  
  /* 高级动画 */
  @keyframes float {
    0%, 100% { transform: translateY(0px); }
    50% { transform: translateY(-10px); }
  }
  
  @keyframes shimmer {
    0% { background-position: -468px 0; }
    100% { background-position: 468px 0; }
  }
  
  /* 卡片悬停效果 */
  .card-hover-effect {
    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  }
  
  .card-hover-effect:hover {
    transform: translateY(-8px);
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.12);
  }
  
  /* 按钮渐变效果 */
  .btn-gradient {
    background: linear-gradient(135deg, #1677ff 0%, #4096ff 100%);
    border: none;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
  
  .btn-gradient:hover {
    background: linear-gradient(135deg, #0958d9 0%, #1677ff 100%);
    box-shadow: 0 8px 24px rgba(22, 119, 255, 0.3);
    transform: translateY(-2px);
  }
  
  /* 阴影过渡 */
  .shadow-transition {
    transition: box-shadow 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
  
  /* 平滑滚动 */
  .smooth-scroll {
    scroll-behavior: smooth;
  }
`;
document.head.appendChild(style);

const { Title, Text } = Typography;
const UsersPage = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  
  // State management
  const [roleFilter, setRoleFilter] = useState(null); // null表示显示所有角色
  const [expandedAdmins, setExpandedAdmins] = useState(new Set()); // 用于跟踪展开的管理员
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [selectedAdminId, setSelectedAdminId] = useState(null);
  const [searchText, setSearchText] = useState('');

  // React Query for data fetching
  const { data: users = [], isLoading: usersLoading, refetch: refetchUsers } = useQuery({
    queryKey: ['users'],
    queryFn: getAllUsers,
    enabled: isOpen !== undefined ? isOpen : true
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: getProjects,
    enabled: isOpen !== undefined ? isOpen : true
  });

  // 切换管理员的展开/收起状态
  const toggleAdminExpand = (adminId) => {
    const newExpanded = new Set(expandedAdmins);
    if (newExpanded.has(adminId)) {
      newExpanded.delete(adminId);
    } else {
      newExpanded.add(adminId);
    }
    setExpandedAdmins(newExpanded);
  };

  // 按角色过滤用户
  const filteredUsers = users.filter(u => {
    if (!roleFilter) return true;
    return Number(u.roleId) === Number(roleFilter);
  });

  // 搜索过滤
  const searchFilteredUsers = filteredUsers.filter(u => {
    if (!searchText) return true;
    const searchLower = searchText.toLowerCase();
    // 搜索用户名或上级管理员用户名
    return u.username.toLowerCase().includes(searchLower) || 
           (u.createdByUsername && u.createdByUsername.toLowerCase().includes(searchLower));
  });

  // 将adminUsersMap提升到组件作用域，以便在第798行使用
  const adminUsersMap = useMemo(() => {
    // 按管理员分组用户（仅超级管理员可见）
    const adminUsersMap = new Map();
    
    // 分离普通用户（roleId=3）
    const normalUsers = users.filter(u => Number(u.roleId) === 3);
    
    // 为每个普通管理员（roleId=2）添加其下的用户
    const subAdmins = users.filter(u => Number(u.roleId) === 2);
    
    subAdmins.forEach(admin => {
      const adminUsers = normalUsers.filter(user => user.createdBy === admin.id);
      adminUsersMap.set(admin, adminUsers);
    });
    
    // 处理没有分配管理员的用户或由超级管理员创建的用户
    const unassignedUsers = normalUsers.filter(user => !user.createdBy);
    if (unassignedUsers.length > 0) {
      adminUsersMap.set({ id: 'unassigned', username: '未分配管理员', roleId: 0 }, unassignedUsers);
    }
    
    return adminUsersMap;
  }, [users]);

  // 渲染管理员及其用户的分组视图
  const renderAdminUserGroups = () => {
    if (user?.roleId !== 1) return null; // 仅超级管理员可见
    

    
    return Array.from(adminUsersMap.entries()).map(([admin, adminUsers]) => (
      <div key={admin.id} style={{ marginBottom: 16 }}>
        <Card 
          variant="outlined" 
          style={{ 
            boxShadow: SHADOWS.medium, 
            borderRadius: 12,
            transition: 'all 0.3s ease'
          }}
          styles={{ body: { padding: 20 } }}
          hoverable
        >
          <div 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              cursor: 'pointer',
              borderRadius: 8,
              padding: '8px',
              transition: 'background-color 0.3s'
            }}
            onClick={() => toggleAdminExpand(admin.id)}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f0f7ff'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ 
                width: 50, 
                height: 50, 
                borderRadius: '50%', 
                backgroundColor: '#e6f7ff', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(24, 144, 255, 0.2)'
              }}>
                {expandedAdmins.has(admin.id) ? 
                  <UpOutlined style={{ color: '#1890ff', fontSize: 20 }} /> : 
                  <DownOutlined style={{ color: '#1890ff', fontSize: 20 }} />
                }
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Tag 
                    color={Number(admin.roleId) === 1 ? 'blue' : Number(admin.roleId) === 2 ? 'green' : 'default'} 
                    style={{ 
                      borderRadius: 8, 
                      fontWeight: 600, 
                      padding: '4px 12px',
                      fontSize: 13
                    }}
                  >
                    {Number(admin.roleId) === 1 ? '超级管理员' : Number(admin.roleId) === 2 ? '普通管理员' : '未分配'}
                  </Tag>
                  <span style={{ fontWeight: 600, fontSize: 16 }}>{admin.username}</span>
                </div>
                <Text type="secondary" style={{ fontSize: 14 }}>{adminUsers.length} 个用户</Text>
              </div>
            </div>
            <Button 
                    type="primary" 
                    size="middle" 
                    icon={<UserAddOutlined />} 
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedAdminId(admin.id);
                      setEditUser(null);
                      setIsDrawerOpen(true);
                    }}
                    style={{ 
                      borderRadius: 8, 
                      padding: '6px 20px',
                      boxShadow: '0 2px 6px rgba(24, 144, 255, 0.2)',
                      transition: 'all 0.3s ease'
                    }}
                  >
                    新增用户
                  </Button>
          </div>
          
          {adminUsers.length > 0 && (
            <div 
              style={{ 
                marginLeft: 66, 
                marginTop: 20, 
                paddingTop: 20, 
                borderTop: `2px solid ${COLORS.border}`,
                maxHeight: expandedAdmins.has(admin.id) ? '1000px' : '0',
                overflow: 'hidden',
                opacity: expandedAdmins.has(admin.id) ? 1 : 0,
                transform: expandedAdmins.has(admin.id) ? 'translateY(0)' : 'translateY(-10px)',
                transition: 'max-height 0.4s ease, opacity 0.3s ease, transform 0.3s ease'
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {adminUsers.map(user => (
                  <Card 
                    key={user.id} 
                    variant="outlined" 
                    style={{ 
                      boxShadow: SHADOWS.light, 
                      borderRadius: 8,
                      transition: 'all 0.3s ease'
                    }}
                    styles={{ body: { 
                      padding: 16, 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between'
                    } }}
                    hoverable
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <Tag.CheckableTag 
                        checked={roleFilter === 2} 
                        onChange={() => setRoleFilter(2)} 
                        color="orange"
                        style={{ 
                          margin: 0, 
                          borderRadius: 6,
                          fontWeight: 500
                        }}
                      >
                        普通用户
                      </Tag.CheckableTag>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ 
                          width: 36, 
                          height: 36, 
                          borderRadius: '50%', 
                          backgroundColor: '#fff2e8', 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center'
                        }}>
                          <UserOutlined style={{ fontSize: 16, color: '#fa8c16' }} />
                        </div>
                        <span style={{ fontWeight: 500, fontSize: 15 }}>{user.username}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <Button 
                        size="small" 
                        type="primary"
                        ghost
                        icon={<KeyOutlined />} 
                        onClick={() => {
                          const newPwd = prompt(`请输入用户 ${user.username} 的新密码:`);
                          if(newPwd) updateUserPassword(user.id, newPwd).then(() => {
                            refetchUsers();
                          });
                        }}
                        style={{ borderRadius: 6 }}
                      >
                        改密
                      </Button>
                      <Popconfirm 
                        title="确认删除?" 
                        onConfirm={async () => {
                          await deleteUser(user.id);
                          refetchUsers();
                        }}
                        placement="top"
                      >
                        <Button 
                          danger 
                          size="small" 
                          icon={<DeleteOutlined />} 
                          style={{ 
                            borderRadius: 6,
                            boxShadow: '0 1px 3px rgba(255, 77, 79, 0.3)'
                          }}
                        >
                          删除
                        </Button>
                      </Popconfirm>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>
    ));
  };

  // 处理用户角色变化
  const handleRoleChange = async (userId, newRoleId) => {
    try {
      await updateUserRole(userId, newRoleId);
      message.success('角色更新成功');
      refetchUsers(); // 重新加载数据
    } catch (error) {
      console.error('Role update error:', error);
      message.error('角色更新失败: ' + (error.response?.data?.error || error.message));
    }
  };

  // 处理用户更新
  const handleUserUpdate = () => {
    refetchUsers();
  };

  // 计算用户统计信息
  const userStats = {
    total: users.length,
    superAdmin: users.filter(u => Number(u.roleId) === 1).length,
    admin: users.filter(u => Number(u.roleId) === 2).length,
    normalUser: users.filter(u => Number(u.roleId) === 3).length
  };

  // 主内容
  const mainContent = (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* 顶部统计卡片 - 现代化设计 */}
      <Row gutter={24}>
        <Col xs={24} sm={12} md={6}>
          <Card 
          variant="outlined" 
          hoverable 
          className="card-hover-effect"
          style={{ 
            boxShadow: SHADOWS.medium, 
            borderRadius: 16, 
            background: 'linear-gradient(135deg, #ffffff 0%, #f8f9ff 100%)',
            animation: `${ANIMATIONS.fadeIn} 0.3s ease`
          }}
        >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0' }}>
              <div>
                <Text type="secondary" style={{ fontSize: 14, fontWeight: 500, letterSpacing: 0.5 }}>总用户数</Text>
                <Title level={3} style={{ 
                  margin: '8px 0 0 0', 
                  fontWeight: 700, 
                  fontSize: 28, 
                  background: 'linear-gradient(135deg, #1677ff 0%, #4096ff 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text'
                }}>{userStats.total}</Title>
              </div>
              <div style={{ 
                width: 60, 
                height: 60, 
                borderRadius: '50%', 
                background: 'linear-gradient(135deg, #1677ff 0%, #4096ff 100%)',
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                boxShadow: '0 8px 24px rgba(22, 119, 255, 0.2)',
                animation: 'float 3s ease-in-out infinite'
              }}>
                <UserOutlined style={{ fontSize: 32, color: '#ffffff' }} />
              </div>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card 
          variant="outlined" 
          hoverable 
          className="card-hover-effect"
          style={{ 
            boxShadow: SHADOWS.medium, 
            borderRadius: 16, 
            background: 'linear-gradient(135deg, #ffffff 0%, #f6fff8 100%)',
            animation: `${ANIMATIONS.fadeIn} 0.4s ease`
          }}
        >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0' }}>
              <div>
                <Text type="secondary" style={{ fontSize: 14, fontWeight: 500, letterSpacing: 0.5 }}>超级管理员</Text>
                <Title level={3} style={{ 
                  margin: '8px 0 0 0', 
                  fontWeight: 700, 
                  fontSize: 28, 
                  background: 'linear-gradient(135deg, #1677ff 0%, #0958d9 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text'
                }}>{userStats.superAdmin}</Title>
              </div>
              <div style={{ 
                width: 60, 
                height: 60, 
                borderRadius: '50%', 
                background: 'linear-gradient(135deg, #1677ff 0%, #0958d9 100%)',
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                boxShadow: '0 8px 24px rgba(22, 119, 255, 0.2)',
                animation: 'float 3s ease-in-out infinite 0.2s'
              }}>
                <UserOutlined style={{ fontSize: 32, color: '#ffffff' }} />
              </div>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card 
          variant="outlined" 
          hoverable 
          className="card-hover-effect"
          style={{ 
            boxShadow: SHADOWS.medium, 
            borderRadius: 16, 
            background: 'linear-gradient(135deg, #ffffff 0%, #f0fff4 100%)',
            animation: `${ANIMATIONS.fadeIn} 0.5s ease`
          }}
        >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0' }}>
              <div>
                <Text type="secondary" style={{ fontSize: 14, fontWeight: 500, letterSpacing: 0.5 }}>普通管理员</Text>
                <Title level={3} style={{ 
                  margin: '8px 0 0 0', 
                  fontWeight: 700, 
                  fontSize: 28, 
                  background: 'linear-gradient(135deg, #52c41a 0%, #73d13d 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text'
                }}>{userStats.admin}</Title>
              </div>
              <div style={{ 
                width: 60, 
                height: 60, 
                borderRadius: '50%', 
                background: 'linear-gradient(135deg, #52c41a 0%, #73d13d 100%)',
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                boxShadow: '0 8px 24px rgba(82, 196, 26, 0.2)',
                animation: 'float 3s ease-in-out infinite 0.4s'
              }}>
                <TeamOutlined style={{ fontSize: 32, color: '#ffffff' }} />
              </div>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card 
          variant="outlined" 
          hoverable 
          className="card-hover-effect"
          style={{ 
            boxShadow: SHADOWS.medium, 
            borderRadius: 16, 
            background: 'linear-gradient(135deg, #ffffff 0%, #fff7e6 100%)',
            animation: `${ANIMATIONS.fadeIn} 0.6s ease`
          }}
        >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0' }}>
              <div>
                <Text type="secondary" style={{ fontSize: 14, fontWeight: 500, letterSpacing: 0.5 }}>普通用户</Text>
                <Title level={3} style={{ 
                  margin: '8px 0 0 0', 
                  fontWeight: 700, 
                  fontSize: 28, 
                  background: 'linear-gradient(135deg, #faad14 0%, #ffc53d 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text'
                }}>{userStats.normalUser}</Title>
              </div>
              <div style={{ 
                width: 60, 
                height: 60, 
                borderRadius: '50%', 
                background: 'linear-gradient(135deg, #faad14 0%, #ffc53d 100%)',
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                boxShadow: '0 8px 24px rgba(250, 173, 20, 0.2)',
                animation: 'float 3s ease-in-out infinite 0.6s'
              }}>
                <UserOutlined style={{ fontSize: 32, color: '#ffffff' }} />
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      {/* 顶部操作区 - 现代化设计 */}
      <Card 
        variant="outlined" 
        className="shadow-transition"
        style={{ 
          boxShadow: SHADOWS.medium, 
          borderRadius: 16, 
          background: 'linear-gradient(135deg, #ffffff 0%, #fafafa 100%)',
          padding: 24,
          animation: `${ANIMATIONS.fadeIn} 0.5s ease`,
          border: '1px solid rgba(22, 119, 255, 0.05)'
        }}
      >
        <Row gutter={24} align="middle" justify="space-between" style={{ width: '100%', flexWrap: 'wrap' }}>
          <Col xs={24} sm={24} md={12} style={{ marginBottom: { xs: 16, sm: 16, md: 0 } }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ 
                width: 64, 
                height: 64, 
                borderRadius: 16, 
                background: 'linear-gradient(135deg, #1677ff 0%, #4096ff 100%)',
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                boxShadow: '0 8px 24px rgba(22, 119, 255, 0.25)'
              }}>
                <TeamOutlined style={{ fontSize: 32, color: '#ffffff' }} />
              </div>
              <div>
                <Title level={3} style={{ 
                  margin: 0, 
                  fontWeight: 700, 
                  fontSize: 24,
                  background: 'linear-gradient(135deg, #262626 0%, #595959 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text'
                }}>用户管理</Title>
                <Text type="secondary" style={{ fontSize: 14, fontWeight: 500, letterSpacing: 0.5 }}>
                  精细化管理系统用户与权限
                </Text>
              </div>
            </div>
          </Col>
          
          <Col xs={24} sm={24} md={12}>
            <Row gutter={16} align="middle" justify="end" wrap>
              <Col>
                <Input
                  placeholder="搜索用户名"
                  prefix={<SearchOutlined style={{ color: '#1677ff', fontSize: 16 }} />}
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  style={{ 
                    width: { xs: '100%', sm: 220 }, 
                    borderRadius: 12, 
                    boxShadow: SHADOWS.light,
                    border: '1px solid #e6f7ff',
                    padding: '8px 16px',
                    transition: ANIMATIONS.buttonHover
                  }}
                  allowClear
                />
              </Col>
              
              <Col>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 12, 
                  padding: '12px 20px', 
                  backgroundColor: COLORS.backgroundSecondary,
                  borderRadius: 12,
                  border: '2px solid #e6f7ff'
                }}>
                  <FilterOutlined style={{ color: COLORS.primary, fontSize: 18, fontWeight: 600 }} />
                  <Space wrap>
                    <Tag.CheckableTag
                      checked={roleFilter === null}
                      onChange={() => setRoleFilter(null)}
                      style={{ 
                        borderRadius: 10, 
                        fontWeight: roleFilter === null ? 700 : 500, 
                        transition: ANIMATIONS.buttonHover,
                        padding: '4px 12px',
                        fontSize: 13
                      }}
                    >
                      全部
                    </Tag.CheckableTag>
                    <Tag.CheckableTag
                      checked={roleFilter === 1}
                      onChange={() => setRoleFilter(1)}
                      color="blue"
                      style={{ 
                        borderRadius: 10, 
                        fontWeight: roleFilter === 1 ? 700 : 500, 
                        transition: ANIMATIONS.buttonHover,
                        padding: '4px 12px',
                        fontSize: 13
                      }}
                    >
                      超级管理员
                    </Tag.CheckableTag>
                    <Tag.CheckableTag
                      checked={roleFilter === 2}
                      onChange={() => setRoleFilter(2)}
                      color="green"
                      style={{ 
                        borderRadius: 10, 
                        fontWeight: roleFilter === 2 ? 700 : 500, 
                        transition: ANIMATIONS.buttonHover,
                        padding: '4px 12px',
                        fontSize: 13
                      }}
                    >
                      普通管理员
                    </Tag.CheckableTag>
                    <Tag.CheckableTag
                      checked={roleFilter === 3}
                      onChange={() => setRoleFilter(3)}
                      color="orange"
                      style={{ 
                        borderRadius: 10, 
                        fontWeight: roleFilter === 3 ? 700 : 500, 
                        transition: ANIMATIONS.buttonHover,
                        padding: '4px 12px',
                        fontSize: 13
                      }}
                    >
                      普通用户
                    </Tag.CheckableTag>
                  </Space>
                </div>
              </Col>
              
              <Col>
                <Button 
                  type="primary" 
                  icon={<UserAddOutlined />} 
                  onClick={() => {
                    setEditUser(null);
                    setSelectedAdminId(null);
                    setIsDrawerOpen(true);
                  }}
                  size="large"
                  className="btn-gradient"
                  style={{ 
                    borderRadius: 12, 
                    padding: '12px 32px', 
                    boxShadow: '0 8px 24px rgba(22, 119, 255, 0.3)',
                    fontSize: 16,
                    fontWeight: 600,
                    letterSpacing: 0.5
                  }}
                >
                  新增用户
                </Button>
              </Col>
            </Row>
          </Col>
        </Row>
      </Card>
      
      <Card 
        variant="outlined" 
        style={{ 
          boxShadow: SHADOWS.heavy, 
          flex: 1, 
          borderRadius: 16,
          overflow: 'hidden',
          transition: 'all 0.3s ease',
          border: '1px solid rgba(22, 119, 255, 0.05)',
          background: 'linear-gradient(135deg, #ffffff 0%, #fafafa 100%)'
        }}
        styles={{ body: { height: '100%', display: 'flex', flexDirection: 'column', gap: 28, padding: 24 }}}
      >
        {/* 超级管理员显示分组视图 - 仅在未选择角色筛选时显示 */}
        {Number(user?.roleId) === 1 && roleFilter === null && (
          <div style={{ transition: 'all 0.3s ease', animation: `${ANIMATIONS.fadeIn} 0.5s ease` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ 
                  width: 40, 
                  height: 40, 
                  borderRadius: 8, 
                  backgroundColor: '#e6f7ff', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center'
                }}>
                  <ClusterOutlined style={{ fontSize: 20, color: '#1890ff' }} />
                </div>
                <Title level={4} style={{ margin: 0, fontWeight: 600 }}>管理员-用户分组</Title>
              </div>
              <Text type="secondary" style={{ fontSize: 14 }}>
                共 {adminUsersMap ? adminUsersMap.size : 0} 个管理员组
              </Text>
            </div>
            <Divider style={{ margin: '0 0 24px 0', borderColor: '#f0f5ff', borderWidth: 2 }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {renderAdminUserGroups()}
            </div>
          </div>
        )}
        
        {/* 表格视图，应用角色过滤 */}
        <div style={{ flex: 1, minHeight: 300, animation: `${ANIMATIONS.fadeIn} 0.6s ease`, transition: 'all 0.3s ease' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ 
                width: 40, 
                height: 40, 
                borderRadius: 8, 
                backgroundColor: '#e6f7ff', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center'
              }}>
                <UserOutlined style={{ fontSize: 20, color: '#1890ff' }} />
              </div>
              <Title level={4} style={{ margin: 0, fontWeight: 600 }}>用户列表</Title>
            </div>
            <Text type="secondary" style={{ fontSize: 14 }}>
              显示 {searchFilteredUsers.length} 个用户
            </Text>
          </div>
          <Divider style={{ margin: '0 0 24px 0', borderColor: '#f0f5ff', borderWidth: 2 }} />
          <Card 
            variant="outlined" 
            style={{ 
              height: '100%', 
              borderRadius: 8, 
              backgroundColor: '#fff',
              boxShadow: SHADOWS.light,
              transition: 'all 0.3s ease'
            }}
            styles={{ body: { height: '100%', padding: 16 }}}
          >
            <UserTable 
              users={searchFilteredUsers} 
              allUsers={users} 
              projects={projects} 
              loading={usersLoading}
              onRoleChange={handleRoleChange}
              onUserUpdate={handleUserUpdate}
            />
          </Card>
        </div>
      </Card>

      {/* 用户表单抽屉 */}
      <UserFormDrawer
        visible={isDrawerOpen}
        onClose={() => {
          setIsDrawerOpen(false);
          setEditUser(null);
          setSelectedAdminId(null);
        }}
        onUserUpdate={handleUserUpdate}
        users={users}
        projects={projects}
        editUser={editUser}
        selectedAdminId={selectedAdminId}
      />
    </div>
  );

  // 条件渲染：如果提供了isOpen和onClose，则作为Modal组件，否则作为独立页面
  const content = isOpen !== undefined && onClose ? (
    <Modal
        open={isOpen}
        onCancel={onClose}
        width={1300}
        footer={null}
        destroyOnClose
        maskClosable
        getContainer={document.body}
        zIndex={1000}
        style={{ 
          maxHeight: '85vh',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'center',
          top: '5vh'
        }}
        bodyStyle={{ 
          padding: 0, 
          maxHeight: '80vh',
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column'
        }}
        header={null} // 不使用默认标题，使用自定义的
      >
      {mainContent}
    </Modal>
  ) : (
    <div style={{ padding: 24, backgroundColor: '#f5f5f5', minHeight: '100vh' }}>
      {mainContent}
    </div>
  );

  // 应用主题配置
  return (
    <ConfigProvider theme={themeConfig}>
      {content}
    </ConfigProvider>
  );
};

export default UsersPage;