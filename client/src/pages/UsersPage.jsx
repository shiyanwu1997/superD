import React, { useState, useEffect } from 'react';
import { Modal, Table, Button, Form, Input, Select, Tag, Space, message, Popconfirm, Radio, Divider } from 'antd';
import { UserAddOutlined, DeleteOutlined, KeyOutlined, FilterOutlined, DownOutlined, UpOutlined } from '@ant-design/icons';
import { getAllUsers, createUser, deleteUser, setUserProjectPermission, removeUserProjectPermission, getProjects, updateUserPassword, updateUserRole, updateUserCreatedBy } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
const UsersPage = ({ isOpen, onClose }) => {
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const [selectedRoleId, setSelectedRoleId] = useState(3);
  const [editingCreatedBy, setEditingCreatedBy] = useState(null);
  const [roleFilter, setRoleFilter] = useState(null); // null表示显示所有角色
  const [expandedAdmins, setExpandedAdmins] = useState(new Set()); // 用于跟踪展开的管理员
  
  // 创建用户表单
  const [form] = Form.useForm();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [uData, pData] = await Promise.all([getAllUsers(), getProjects()]);
      setUsers(uData);
      setProjects(pData);
    } catch (error) {
      console.error('加载用户数据失败:', error);
      message.error('加载用户数据失败');
    } finally {
      setLoading(false);
    }
  };

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
              setSelectedRoleId(3);
              form.setFieldsValue({ roleId: 3, createdBy: admin.id });
              setIsCreateModalOpen(true);
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
                      if(newPwd) updateUserPassword(user.id, newPwd).then(() => message.success('密码已修改'));
                    }}
                  >
                    改密
                  </Button>
                  <Popconfirm title="确认删除?" onConfirm={async () => {
                      await deleteUser(user.id);
                      fetchData();
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

  useEffect(() => {
    if (isOpen) fetchData();
  }, [isOpen]);

  const handleCreate = async (values) => {
    try {
      console.log('handleCreate called with values:', values);
      // 对于普通用户，超级管理员可以指定上级管理员
      const res = await createUser(values.username, values.password, values.roleId, values.createdBy);
      console.log('createUser response:', res);
      if (res.success) {
        // 分配权限
        if (values.projectIds && values.projectIds.length > 0) {
          for (const pid of values.projectIds) {
            await setUserProjectPermission(res.user.id, pid);
          }
        }
        message.success('用户创建成功');
        setIsCreateModalOpen(false);
        form.resetFields();
        fetchData();
      } else {
        message.error(res.error || '创建失败');
      }
    } catch (error) {
      console.error('createUser error:', error);
      message.error('创建失败: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleTogglePermission = async (targetUserId, projectId, hasPermission) => {
    try {
      if (hasPermission) {
        await removeUserProjectPermission(targetUserId, projectId);
      } else {
        await setUserProjectPermission(targetUserId, projectId);
      }
      message.success('权限更新成功');
      fetchData(); // 重新加载以更新状态
    } catch {
      message.error('权限操作失败');
    }
  };

  const handleRoleChange = async (userId, newRoleId, record) => {
    try {
      await updateUserRole(userId, newRoleId);
      message.success('角色更新成功');
      fetchData(); // 重新加载数据
    } catch (error) {
      console.error('Role update error:', error);
      message.error('角色更新失败: ' + (error.response?.data?.error || error.message));
    }
  };

  const columns = [
    { title: '用户名', dataIndex: 'username', key: 'username' },
    { 
    title: '上级管理员', 
    dataIndex: 'createdBy', 
    render: (createdBy, record) => {
      // 只有普通用户显示上级管理员
      if (record.roleId === 3) {
        
        // 只有超级管理员可以修改上级管理员
        if (user?.roleId === 1) {
          return (
            <Select
              value={createdBy}
              onChange={(newCreatedBy) => {
                updateUserCreatedBy(record.id, newCreatedBy)
                  .then(() => {
                    message.success('上级管理员更新成功');
                    fetchData(); // 重新加载数据
                  })
                  .catch(error => {
                    console.error('Update createdBy error:', error);
                    message.error('上级管理员更新失败');
                  });
              }}
              style={{ width: 150 }}
              size="small"
            >
              {users
                .filter(u => Number(u.roleId) === 2)
                .map(u => <Select.Option key={u.id} value={u.id}>{u.username}</Select.Option>)}
            </Select>
          );
        }
        
        // 其他角色只能查看，直接使用后端提供的createdByUsername
        return record.createdByUsername || '无';
      }
      return '-';
    }
  },
    { 
      title: '角色', 
      dataIndex: 'roleId', 
      render: (roleId, record) => {
        // 只有超级管理员可以修改角色，且不能修改admin用户的角色
        const canEditRole = user?.roleId === 1 && record.username !== 'admin';
        
        if (canEditRole) {
          return (
            <Select
              value={roleId}
              onChange={(newRoleId) => handleRoleChange(record.id, newRoleId, record)}
              style={{ width: 100 }}
              size="small"
            >
              <Select.Option value={2}>普通管理员</Select.Option>
              <Select.Option value={3}>普通用户</Select.Option>
            </Select>
          );
        }
        
        // 静态角色标签显示
        return (
          <Tag color={roleId === 1 ? 'blue' : roleId === 2 ? 'green' : 'default'}>
            {roleId === 1 ? '超级管理员' : roleId === 2 ? '普通管理员' : '普通用户'}
          </Tag>
        );
      }
    },
    {
      title: '项目权限',
      key: 'permissions',
      render: (_, record) => (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {projects.map(proj => {
            const hasPerm = record.projectPermissions?.some(p => p.projectId === proj.id);
            // 管理员不可修改管理员的权限
            const disabled = record.roleId === 1 && record.username === 'admin'; 
            return (
              <Tag.CheckableTag
                key={proj.id}
                checked={hasPerm || record.roleId === 1} // 管理员默认拥有所有
                onChange={() => !disabled && handleTogglePermission(record.id, proj.id, hasPerm)}
                style={{ border: '1px solid #d9d9d9' }}
              >
                {proj.name}
              </Tag.CheckableTag>
            );
          })}
        </div>
      )
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button 
            size="small" 
            icon={<KeyOutlined />} 
            onClick={() => {
                const newPwd = prompt(`请输入用户 ${record.username} 的新密码:`);
                if(newPwd) updateUserPassword(record.id, newPwd).then(() => message.success('密码已修改'));
            }}
          >
            改密
          </Button>
          {record.username !== 'admin' && (
            <Popconfirm title="确认删除?" onConfirm={async () => {
                await deleteUser(record.id);
                fetchData();
            }}>
              <Button danger size="small" icon={<DeleteOutlined />}>删除</Button>
            </Popconfirm>
          )}
        </Space>
      )
    }
  ];

  return (
    <Modal
      title="用户管理"
      open={isOpen}
      onCancel={onClose}
      width={900}
      footer={null}
    >
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Button type="primary" icon={<UserAddOutlined />} onClick={() => setIsCreateModalOpen(true)}>新增用户</Button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FilterOutlined /> 角色过滤:
          </span>
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
      </div>
      
      {/* 主内容区域 */}
      <div style={{ backgroundColor: '#fff', borderRadius: 8, padding: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.09)' }}>
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
        <Table 
          columns={columns} 
          dataSource={filteredUsers} 
          rowKey="id" 
          loading={loading}
          pagination={{ pageSize: 10 }}
          bordered
          size="middle"
        />
      </div>

      <Modal
        title="新增用户"
        open={isCreateModalOpen}
        onCancel={() => setIsCreateModalOpen(false)}
        onOk={() => form.submit()}
        width={500}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate} initialValues={{ roleId: 3 }}>
          <Form.Item name="username" label="用户名" rules={[{ required: true, message: '请输入用户名' }]}>
            <Input placeholder="请输入用户名" />
          </Form.Item>
          <Form.Item name="password" label="密码" rules={[{ required: true, message: '请输入密码' }]}>
            <Input.Password placeholder="请输入密码" />
          </Form.Item>
          <Form.Item name="roleId" label="角色" rules={[{ required: true, message: '请选择角色' }]}>
            <Select 
              disabled={user?.roleId === 2} 
              initialValue={3} 
              onChange={setSelectedRoleId}
              placeholder="请选择角色"
            >
              {user?.roleId === 1 && (
                <>
                  <Select.Option value={1}>超级管理员</Select.Option>
                  <Select.Option value={2}>普通管理员</Select.Option>
                  <Select.Option value={3}>普通用户</Select.Option>
                </>
              )}
              {user?.roleId === 2 && (
                <Select.Option value={3}>普通用户</Select.Option>
              )}
            </Select>
          </Form.Item>
          {/* 仅超级管理员可以为普通用户指定上级管理员 */}
          {user?.roleId === 1 && (
            <Form.Item 
              name="createdBy" 
              label="上级管理员" 
              hidden={selectedRoleId !== 3}
              rules={[
                { 
                  required: selectedRoleId === 3, 
                  message: '普通用户必须指定上级管理员' 
                }
              ]}
            >
              <Select placeholder="请选择上级管理员">
                {users
                  .filter(u => Number(u.roleId) === 2)
                  .map(u => <Select.Option key={u.id} value={u.id}>{u.username}</Select.Option>)}
              </Select>
            </Form.Item>
          )}
          {/* 普通管理员创建的用户，默认将自己设为上级管理员 */}
          {user?.roleId === 2 && (
            <Form.Item name="createdBy" hidden initialValue={user?.id}>
              <Input />
            </Form.Item>
          )}
          <Form.Item name="projectIds" label="初始项目权限">
            <Select mode="multiple" placeholder="请选择项目">
              {projects.map(p => <Select.Option key={p.id} value={p.id}>{p.name}</Select.Option>)}
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </Modal>
  );
};

export default UsersPage;