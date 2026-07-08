import React, { useState } from 'react';
import { Table, Tag, Space, Button, Popconfirm, Select, Tooltip, Avatar, message, Modal, Spin } from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { useAuth } from '../../contexts/AuthContext';
import { setUserProjectPermission, removeUserProjectPermission, addUserProgramPermission, removeUserProgramPermission, getUserProgramPermissions, getProgramsByProject, deleteUser, updateUserCreatedBy } from '../../utils/api';

const UserTable = ({ users, projects, loading, onRoleChange, onUserUpdate, allUsers = [] }) => {
  const { user } = useAuth();

  // 程序权限弹窗
  const [programModalUser, setProgramModalUser] = useState(null);
  const [programModalPerms, setProgramModalPerms] = useState([]);
  const [programModalLoading, setProgramModalLoading] = useState(false);
  const [selectedMachine, setSelectedMachine] = useState(null);
  const [selectedPrograms, setSelectedPrograms] = useState([]);
  const [machinePrograms, setMachinePrograms] = useState([]);
  const [loadingPrograms, setLoadingPrograms] = useState(false);

  const getAvatarColor = (username) => {
    const colors = ['#f56a00', '#7265e6', '#ffbf00', '#00a2ae', '#8543e0'];
    const hash = username.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  // 打开程序权限弹窗
  const openProgramModal = async (record) => {
    setProgramModalUser(record);
    setSelectedMachine(null);
    setSelectedPrograms([]);
    setMachinePrograms([]);
    setProgramModalLoading(true);
    try {
      const perms = await getUserProgramPermissions(record.id);
      setProgramModalPerms(perms || []);
    } catch { setProgramModalPerms([]); }
    setProgramModalLoading(false);
  };

  // 选择机器后加载程序列表
  const handleMachineChange = async (pid) => {
    setSelectedMachine(pid);
    setSelectedPrograms([]);
    if (!pid) { setMachinePrograms([]); return; }
    setLoadingPrograms(true);
    try {
      const progs = await getProgramsByProject(pid);
      setMachinePrograms(progs || []);
    } catch { setMachinePrograms([]); }
    setLoadingPrograms(false);
  };

  // 添加程序权限
  const handleAddPrograms = async () => {
    if (!selectedMachine || selectedPrograms.length === 0) return;
    for (const name of selectedPrograms) {
      try {
        await addUserProgramPermission(programModalUser.id, `${selectedMachine}-${name}`);
      } catch { /* continue */ }
    }
    const perms = await getUserProgramPermissions(programModalUser.id);
    setProgramModalPerms(perms || []);
    setSelectedPrograms([]);
    message.success('已添加');
  };

  // 删除程序权限
  const handleRemoveProgram = async (programId) => {
    await removeUserProgramPermission(programModalUser.id, programId);
    const perms = await getUserProgramPermissions(programModalUser.id);
    setProgramModalPerms(perms || []);
    message.success('已移除');
  };

  const handlePermissionToggle = async (userId, projectId, isAdd) => {
    try {
      if (isAdd) {
        await setUserProjectPermission(userId, projectId);
        message.success('机器权限已添加');
      } else {
        await removeUserProjectPermission(userId, projectId);
        message.success('机器权限已移除');
      }
      if (onUserUpdate) onUserUpdate();
    } catch {
      message.error('操作失败');
    }
  };

  const columns = [
    {
      title: '用户', key: 'user', width: 200,
      render: (_, record) => (
        <Space>
          <Avatar style={{ backgroundColor: getAvatarColor(record.username) }} size="small">
            {record.username?.[0]?.toUpperCase()}
          </Avatar>
          <span>{record.username}</span>
          {Number(record.roleId) === 1 && <Tag color="red">admin</Tag>}
        </Space>
      )
    },
    {
      title: '角色', dataIndex: 'roleId', key: 'role', width: 120,
      render: (roleId, record) => {
        const isAdmin = Number(user?.roleId) === 1;
        const isSelf = Number(user?.id) === Number(record.id);
        const labels = { 1: '超级管理员', 2: '普通管理员', 3: '普通用户' };
        if (!isAdmin || isSelf || record.username === 'admin') return <Tag>{labels[roleId] || roleId}</Tag>;
        return (
          <Select size="small" value={Number(roleId)} style={{ width: 110 }}
            onChange={(val) => onRoleChange(record.id, val)}
            options={[
              { label: '普通管理员', value: 2 },
              { label: '普通用户', value: 3 },
            ]}
          />
        );
      }
    },
    {
      title: '机器权限', key: 'machines', width: 320,
      render: (_, record) => {
        const userProjects = record.projectPermissions?.map(p => p.projectId) || [];
        const hasAll = Number(record.roleId) === 1;
        const isAdmin = Number(user?.roleId) === 1 || Number(user?.roleId) === 2;
        if (hasAll) return <Tag color="default">全部机器</Tag>;

        const assigned = projects.filter(p => userProjects.includes(p.id));
        const unassigned = projects.filter(p => !userProjects.includes(p.id));

        return (
          <div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, marginBottom: 4 }}>
              {assigned.length === 0 && <Tag color="default">无</Tag>}
              {assigned.map(p => (
                <Tag key={p.id} color="green" closable={isAdmin}
                  onClose={() => handlePermissionToggle(record.id, p.id, false)}
                >{p.name}</Tag>
              ))}
              {assigned.length > 0 && <span style={{ fontSize: 11, color: '#999' }}>({assigned.length}台)</span>}
            </div>
            {isAdmin && unassigned.length > 0 && (
              <Select size="small" placeholder="+ 添加机器" style={{ width: '100%' }}
                value={undefined}
                onChange={(val) => { if (val) handlePermissionToggle(record.id, val, true); }}
                options={unassigned.map(p => ({ label: p.name, value: p.id }))}
              />
            )}
            {isAdmin && !hasAll && (
              <div style={{ marginTop: 6 }}>
                <Button size="small" style={{ borderRadius: 6, fontSize: 12 }}
                  onClick={() => openProgramModal(record)}
                >🔒 程序权限</Button>
              </div>
            )}
          </div>
        );
      }
    },
    {
      title: '上级', key: 'creator', width: 130,
      render: (_, record) => {
        if (Number(record.roleId) === 1) return <Tag color="red">-</Tag>;
        const isSuperAdmin = Number(user?.roleId) === 1;
        const parentAdmins = allUsers.filter(u => Number(u.roleId) === 1 || Number(u.roleId) === 2);
        if (isSuperAdmin) {
          return (
            <Select size="small" style={{ width: 110 }}
              value={record.createdBy || undefined}
              placeholder="选择上级"
              allowClear
              onChange={async (val) => {
                try {
                  await updateUserCreatedBy(record.id, val || null);
                  message.success('已更新');
                  if (onUserUpdate) onUserUpdate();
                } catch { message.error('更新失败'); }
              }}
              options={parentAdmins.map(u => ({ label: u.username, value: u.id }))}
            />
          );
        }
        return <span>{record.createdByUsername || '-'}</span>;
      }
    },
    {
      title: '操作', key: 'action', width: 100,
      render: (_, record) => {
        if (record.username === 'admin') return null;
        return (
          <Popconfirm title="确定删除此用户？" onConfirm={async () => {
            await deleteUser(record.id);
            message.success('已删除');
            if (onUserUpdate) onUserUpdate();
          }}>
            <Button type="link" danger icon={<DeleteOutlined />} size="small" />
          </Popconfirm>
        );
      }
    }
  ];

  return (
    <>
      <Table dataSource={users} columns={columns} rowKey="id" loading={loading}
        pagination={false} size="small" scroll={{ x: 1000 }} />

      {/* 程序权限弹窗 */}
      <Modal
        title={`程序权限 - ${programModalUser?.username || ''}`}
        open={!!programModalUser}
        onCancel={() => setProgramModalUser(null)}
        footer={null}
        width={600}
      >
        {programModalLoading ? <Spin /> : (
          <>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 500, marginBottom: 8, color: '#374151' }}>已授权 {programModalPerms.length} 个程序</div>
              {programModalPerms.length === 0 ? <div style={{ color: '#9ca3af', fontSize: 13 }}>暂无授权</div> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {/* 按机器分组 */}
                  {(() => {
                    const grouped = {};
                    programModalPerms.forEach(p => {
                      const idx = p.programId.indexOf('-');
                      const mid = p.programId.substring(0, idx);
                      const pname = p.programId.substring(idx + 1);
                      if (!grouped[mid]) grouped[mid] = [];
                      grouped[mid].push(pname);
                    });
                    return Object.entries(grouped).map(([mid, names]) => {
                      const machine = projects.find(p => String(p.id) === mid);
                      return (
                        <div key={mid}>
                          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4, fontWeight: 500 }}>
                            {machine?.name || `机器 ${mid}`}
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {names.map(name => (
                              <Tag key={mid + '-' + name} color="default" closable
                                onClose={() => handleRemoveProgram(mid + '-' + name)}
                              >{name}</Tag>
                            ))}
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              )}
            </div>

            <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 16 }}>
              <div style={{ fontWeight: 500, marginBottom: 8 }}>新增程序权限：</div>
              <Space>
                <Select style={{ width: 180 }} placeholder="1. 选择机器"
                  value={selectedMachine}
                  onChange={handleMachineChange}
                  allowClear
                  options={projects.map(p => ({ label: p.name, value: p.id }))}
                />
                <Select style={{ width: 220 }} placeholder="2. 选择程序（可多选）"
                  mode="multiple"
                  value={selectedPrograms}
                  onChange={setSelectedPrograms}
                  loading={loadingPrograms}
                  disabled={!selectedMachine}
                  options={machinePrograms
                    .filter(p => !programModalPerms.some(perm => perm.programId === `${selectedMachine}-${p.name}`))
                    .map(p => ({ label: p.name, value: p.name }))}
                  showSearch
                  filterOption={(input, option) => (option?.label || '').toLowerCase().includes(input.toLowerCase())}
                  notFoundContent={selectedMachine ? '无程序' : '请先选机器'}
                />
                <Button type="primary" icon={<PlusOutlined />}
                  disabled={!selectedMachine || selectedPrograms.length === 0}
                  onClick={handleAddPrograms}
                >添加</Button>
              </Space>
            </div>
          </>
        )}
      </Modal>
    </>
  );
};

export default UserTable;
