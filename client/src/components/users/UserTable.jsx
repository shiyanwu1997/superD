import React, { useState } from 'react';
import { Table, Tag, Space, Button, Popconfirm, Select, Tooltip, Avatar, message } from 'antd';
import { KeyOutlined, DeleteOutlined, PlusOutlined, MinusOutlined } from '@ant-design/icons';
import { useAuth } from '../../contexts/AuthContext';
import { updateUserPassword, updateUserCreatedBy, deleteUser, setUserProjectPermission, removeUserProjectPermission } from '../../utils/api';

const UserTable = ({ users, projects, loading, onRoleChange, onUserUpdate, allUsers = [] }) => {
  const { user } = useAuth();
  // 存储每个用户-项目组合的加载状态，格式：{ 'userId-projectId': true/false }
  const [loadingPermissions, setLoadingPermissions] = useState({});

  // 生成头像颜色
  const getAvatarColor = (username) => {
    const colors = ['#f56a00', '#7265e6', '#ffbf00', '#00a2ae', '#8543e0'];
    const hash = username.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  // 处理项目权限的添加/移除
  const handlePermissionToggle = async (userId, projectId, projectName, isAdd) => {
    // 设置加载状态
    const key = `${userId}-${projectId}`;
    setLoadingPermissions(prev => ({ ...prev, [key]: true }));
    
    try {
      if (isAdd) {
        await setUserProjectPermission(userId, projectId);
        message.success(`已添加项目：${projectName}`);
      } else {
        await removeUserProjectPermission(userId, projectId);
        message.success(`已移除项目：${projectName}`);
      }
      onUserUpdate(); // 刷新数据
    } catch (error) {
      console.error('权限更新失败:', error);
      message.error('权限更新失败');
    } finally {
      // 清除加载状态
      setLoadingPermissions(prev => ({ ...prev, [key]: false }));
    }
  };

  const columns = [
    { 
      title: 'ID', 
      dataIndex: 'id', 
      key: 'id',
      width: 60,
      render: (id) => <span style={{ color: '#999' }}>{id}</span>
    },
    { 
      title: '用户名', 
      dataIndex: 'username', 
      key: 'username',
      render: (username) => (
        <Space size="middle">
          <Avatar style={{ backgroundColor: getAvatarColor(username) }} size="small">
            {username.charAt(0).toUpperCase()}
          </Avatar>
          <span style={{ fontWeight: 'bold' }}>{username}</span>
        </Space>
      )
    },
    { 
      title: '角色', 
      dataIndex: 'roleId', 
      key: 'roleId',
      render: (roleId, record) => {
        // 只有超级管理员可以修改角色，且不能修改admin用户的角色
        const canEditRole = Number(user?.roleId) === 1 && record.username !== 'admin';
        
        if (canEditRole) {
          return (
            <Select
                value={roleId}
                onChange={(newRoleId) => onRoleChange(record.id, newRoleId)}
                style={{ width: 120 }}
                size="small"
              >
              <Select.Option value={2}>普通管理员</Select.Option>
              <Select.Option value={3}>普通用户</Select.Option>
            </Select>
          );
        }
        
        // 静态角色标签显示
        return (
          <Tag color={Number(roleId) === 1 ? 'blue' : Number(roleId) === 2 ? 'green' : 'default'}>
            {Number(roleId) === 1 ? '超级管理员' : Number(roleId) === 2 ? '普通管理员' : '普通用户'}
          </Tag>
        );
      }
    },
    { 
      title: '上级管理员', 
      dataIndex: 'createdBy', 
      key: 'createdBy',
      render: (createdBy, record) => {
        // 超级管理员不显示上级管理员
        if (Number(record.roleId) === 1) {
          return '-';
        }
        
        // 普通管理员默认上级是admin
        if (Number(record.roleId) === 2) {
          return 'admin';
        }
        
        // 只有普通用户(roleId=3)显示上级管理员
        if (Number(record.roleId) === 3) {
          // 只有超级管理员可以修改上级管理员
          if (Number(user?.roleId) === 1) {
            return (
              <Select
                value={createdBy}
                onChange={(newCreatedBy) => {
                  updateUserCreatedBy(record.id, newCreatedBy)
                    .then(() => {
                      onUserUpdate();
                    })
                }}
                style={{ width: 150 }}
                size="small"
                placeholder="选择上级管理员"
              >
                {(allUsers.length ? allUsers : users)
                  .filter(u => Number(u.roleId) === 2)
                  .map(u => <Select.Option key={u.id} value={u.id}>{u.username}</Select.Option>)}
              </Select>
            );
          }
          
          // 其他角色只能查看，优先使用后端提供的createdByUsername
          if (record.createdByUsername) {
            return record.createdByUsername;
          }
          
          // 如果createdByUsername不存在，尝试从完整用户列表中查找
          const adminUser = (allUsers.length ? allUsers : users).find(u => u.id === createdBy);
          if (adminUser) {
            return adminUser.username;
          }
          
          return '无';
        }
        return '-';

      }
    },
    { 
      title: '项目权限',
      key: 'permissions',
      render: (_, record) => {
        const userProjects = record.projectPermissions?.map(p => p.projectId) || [];
        const projectCount = userProjects.length;
        const hasAllPermissions = Number(record.roleId) === 1;
        const isAdmin = Number(user?.roleId) === 1 || Number(user?.roleId) === 2;
        
        if (hasAllPermissions) {
          return <Tag color="blue">所有项目</Tag>;
        }
        
        const assignedProjects = projects.filter(p => userProjects.includes(p.id));
        const unassignedProjects = projects.filter(p => !userProjects.includes(p.id));
        
        // 已分配项目标签，可点击移除
        const projectTags = assignedProjects.slice(0, 3).map(p => {
          const key = `${record.id}-${p.id}`;
          const isLoading = loadingPermissions[key];
          return (
            <Tag
              key={p.id}
              color="green"
              style={{ margin: '2px' }}
              closable={isAdmin && !isLoading}
              onClose={() => handlePermissionToggle(record.id, p.id, p.name, false)}
            >
              {isLoading ? <span style={{ opacity: 0.7 }}>{p.name}...</span> : p.name}
            </Tag>
          );
        });
        
        if (projectCount > 3) {
          projectTags.push(
            <Tag key="more" color="default" style={{ margin: '2px' }}>
              +{projectCount - 3}
            </Tag>
          );
        }
        
        // 显示添加项目权限的下拉菜单（仅管理员可见）
        const addPermissionMenu = isAdmin && (
          <div style={{ marginTop: 8 }}>
            <Select
              placeholder="添加项目权限"
              style={{ width: '100%' }}
              onChange={(value) => {
                if (value) {
                  const project = projects.find(p => p.id === value);
                  if (project) {
                    handlePermissionToggle(record.id, value, project.name, true);
                  }
                }
              }}
              showArrow
              allowClear
            >
              {unassignedProjects.map(p => {
                const key = `${record.id}-${p.id}`;
                const isLoading = loadingPermissions[key];
                return (
                  <Select.Option key={p.id} value={p.id} disabled={isLoading}>
                    {isLoading ? <span style={{ opacity: 0.7 }}>{p.name}...</span> : p.name}
                  </Select.Option>
                );
              })}
            </Select>
          </div>
        );
        
        return (
          <Tooltip title={assignedProjects.map(p => p.name).join(', ') || '无项目权限'}>
            <div>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center' }}>
                {projectTags.length > 0 ? projectTags : <Tag color="default">无</Tag>}
                <span style={{ color: '#999', fontSize: '12px', marginLeft: '4px' }}>
                  ({projectCount}个项目)
                </span>
              </div>
              {addPermissionMenu}
            </div>
          </Tooltip>
        );
      }
    },
    { 
      title: '创建时间', 
      dataIndex: 'createdAt', 
      key: 'createdAt',
      render: (createdAt) => {
        if (!createdAt) return '-';
        const date = new Date(createdAt);
        return date.toLocaleString();
      }
    },
    { 
      title: '操作', 
      key: 'action',
      width: 150,
      render: (_, record) => (
        <Space size="small">
          <Button 
            size="small" 
            icon={<KeyOutlined />} 
            onClick={() => {
                const newPwd = prompt(`请输入用户 ${record.username} 的新密码:`);
                if(newPwd) updateUserPassword(record.id, newPwd).then(() => {
                  onUserUpdate();
                });
            }}
          >
            改密
          </Button>
          {record.username !== 'admin' && (
            <Popconfirm title="确认删除?" onConfirm={async () => {
                await deleteUser(record.id);
                onUserUpdate();
            }}>
              <Button danger size="small" icon={<DeleteOutlined />}>删除</Button>
            </Popconfirm>
          )}
        </Space>
      )
    }
  ];

  return (
    <Table 
      columns={columns} 
      dataSource={users} 
      rowKey="id" 
      loading={loading}
      pagination={{ pageSize: 10 }}
      bordered
      size="middle"
      scroll={{ x: 1000 }}
    />
  );
};

export default UserTable;
