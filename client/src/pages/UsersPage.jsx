import React, { useState } from 'react';
import { Modal, Button, Select, Tag, Space, message, Popconfirm, Divider, Input } from 'antd';
import { UserAddOutlined, DeleteOutlined, KeyOutlined, FilterOutlined, DownOutlined, UpOutlined, SearchOutlined } from '@ant-design/icons';
import { getAllUsers, deleteUser, getProjects, updateUserPassword, updateUserRole, updateUserCreatedBy } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import UserTable from '../components/users/UserTable';
import UserFormDrawer from '../components/users/UserFormDrawer';
const UsersPage = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
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
    enabled: isOpen
  });

  const { data: projects = [], isLoading: projectsLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: getProjects,
    enabled: isOpen
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
    return u.roleId === roleFilter;
  });

  // 搜索过滤
  const searchFilteredUsers = filteredUsers.filter(u => {
    if (!searchText) return true;
    const searchLower = searchText.toLowerCase();
    // 搜索用户名或上级管理员用户名
    return u.username.toLowerCase().includes(searchLower) || 
           (u.createdByUsername && u.createdByUsername.toLowerCase().includes(searchLower));
  });

  // 按管理员分组用户（仅超级管理员可见）
  const getUsersByAdmin = () => {
    const adminUsersMap = new Map();
    
    // 分离管理员和普通用户
    const admins = users.filter(u => u.roleId === 2);
    const normalUsers = users.filter(u => u.roleId === 3);
    
    // 为每个管理员添加其下的用户
    admins.forEach(admin => {
      const adminUsers = normalUsers.filter(user => user.createdBy === admin.id);
      adminUsersMap.set(admin, adminUsers);
    });
    
    // 处理没有分配管理员的用户（应该只有超级管理员创建的用户）
    const unassignedUsers = normalUsers.filter(user => !user.createdBy);
    if (unassignedUsers.length > 0) {
      adminUsersMap.set({ id: 'unassigned', username: '未分配管理员', roleId: 0 }, unassignedUsers);
    }
    
    return adminUsersMap;
  };

  // 渲染管理员及其用户的分组视图
  const renderAdminUserGroups = () => {
    if (user?.roleId !== 1) return null; // 仅超级管理员可见
    
    const adminUsersMap = getUsersByAdmin();
    
    return Array.from(adminUsersMap.entries()).map(([admin, adminUsers]) => (
      <div key={admin.id} style={{ marginBottom: 16 }}>
        <div 
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            padding: '8px 16px',
            backgroundColor: '#f5f5f5',
            borderRadius: 4,
            cursor: 'pointer'
          }}
          onClick={() => toggleAdminExpand(admin.id)}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {expandedAdmins.has(admin.id) ? <UpOutlined /> : <DownOutlined />}
            <Tag color={admin.roleId === 1 ? 'blue' : admin.roleId === 2 ? 'green' : 'default'}>
              {admin.roleId === 1 ? '超级管理员' : admin.roleId === 2 ? '普通管理员' : '未分配'}
            </Tag>
            <span style={{ fontWeight: 'bold' }}>{admin.username}</span>
            <span style={{ color: '#666' }}>({adminUsers.length}个用户)</span>
          </div>
          <Button 
            size="small" 
            icon={<UserAddOutlined />} 
            onClick={(e) => {
              e.stopPropagation();
              setSelectedAdminId(admin.id);
              setEditUser(null);
              setIsDrawerOpen(true);
            }}
          >
            新增用户
          </Button>
        </div>
        
        {expandedAdmins.has(admin.id) && adminUsers.length > 0 && (
          <div style={{ marginLeft: 24, marginTop: 8 }}>
            {adminUsers.map(user => (
              <div key={user.id} style={{ display: 'flex', alignItems: 'center', padding: '4px 0', gap: 16 }}>
                <Tag.CheckableTag checked={roleFilter === 3} onChange={() => setRoleFilter(3)} style={{ margin: 0 }}>
                  普通用户
                </Tag.CheckableTag>
                <span>{user.username}</span>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                  <Button 
                    size="small" 
                    icon={<KeyOutlined />} 
                    onClick={() => {
                      const newPwd = prompt(`请输入用户 ${user.username} 的新密码:`);
                      if(newPwd) updateUserPassword(user.id, newPwd).then(() => {
                        refetchUsers();
                      });
                    }}
                  >
                    改密
                  </Button>
                  <Popconfirm title="确认删除?" onConfirm={async () => {
                      await deleteUser(user.id);
                      refetchUsers();
                  }}>
                    <Button danger size="small" icon={<DeleteOutlined />}>删除</Button>
                  </Popconfirm>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    ));
  };

  // 处理用户角色变化
  const handleRoleChange = async (userId, newRoleId, record) => {
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

  return (
    <Modal
      title="用户管理"
      open={isOpen}
      onCancel={onClose}
      width={1200}
      footer={null}
      style={{ minHeight: '80vh' }}
    >
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 600 }}>用户管理</h2>
          <span style={{ color: '#666', fontSize: 14 }}>共 {users.length} 个用户</span>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Input
            placeholder="搜索用户名"
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 200 }}
          />
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FilterOutlined />
            <span>角色过滤:</span>
            <Space>
              <Tag.CheckableTag
                checked={roleFilter === null}
                onChange={() => setRoleFilter(null)}
              >
                全部
              </Tag.CheckableTag>
              <Tag.CheckableTag
                checked={roleFilter === 1}
                onChange={() => setRoleFilter(1)}
              >
                超级管理员
              </Tag.CheckableTag>
              <Tag.CheckableTag
                checked={roleFilter === 2}
                onChange={() => setRoleFilter(2)}
              >
                普通管理员
              </Tag.CheckableTag>
              <Tag.CheckableTag
                checked={roleFilter === 3}
                onChange={() => setRoleFilter(3)}
              >
                普通用户
              </Tag.CheckableTag>
            </Space>
          </div>
          
          <Button type="primary" icon={<UserAddOutlined />} onClick={() => {
            setEditUser(null);
            setSelectedAdminId(null);
            setIsDrawerOpen(true);
          }}>
            新增用户
          </Button>
        </div>
      </div>
      
      {/* 主内容区域 */}
      <div style={{ backgroundColor: '#fff', borderRadius: 8, padding: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.09)', minHeight: '60vh' }}>
        {/* 超级管理员显示分组视图 */}
        {user?.roleId === 1 && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>管理员-用户分组</h3>
            </div>
            <Divider style={{ margin: '0 0 16px 0' }} />
            {renderAdminUserGroups()}
          </div>
        )}
        
        {/* 表格视图，应用角色过滤 */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>用户列表</h3>
          </div>
          <Divider style={{ margin: '0 0 16px 0' }} />
        </div>
        <UserTable 
          users={searchFilteredUsers} 
          projects={projects} 
          loading={usersLoading}
          onRoleChange={handleRoleChange}
          onUserUpdate={handleUserUpdate}
        />
      </div>

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
    </Modal>
  );
};

export default UsersPage;