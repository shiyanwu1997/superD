import React, { useEffect, useState } from 'react';
import { Drawer, Form, Input, Select, Transfer, Button, message, Tag } from 'antd';
import { createUser, setUserProjectPermission, removeUserProjectPermission, updateUserPassword, updateUserRole, addUserProgramPermission, removeUserProgramPermission, getUserProgramPermissions, getProgramsByProject } from '../../utils/api';
import { useAuth } from '../../contexts/AuthContext';

const UserFormDrawer = ({
  visible,
  onClose,
  onUserUpdate,
  users,
  projects,
  editUser = null,
  selectedAdminId = null
}) => {
  const [form] = Form.useForm();
  const { user } = useAuth();
  const [selectedRoleId, setSelectedRoleId] = useState(3);
  const [selectedProjectKeys, setSelectedProjectKeys] = useState([]);
  // 程序权限
  const [programPerms, setProgramPerms] = useState([]);
  const [progMachine, setProgMachine] = useState(null);
  const [progList, setProgList] = useState([]);
  const [progSelected, setProgSelected] = useState([]);
  const [loadingProgs, setLoadingProgs] = useState(false);
  // 新建用户时暂存程序权限（用户还不存在，不能调 API）
  const [pendingProgramPerms, setPendingProgramPerms] = useState([]);

  // 当编辑用户变化时，更新表单
  useEffect(() => {
    if (editUser) {
      const assignedProjectIds = editUser.projectPermissions?.map(p => p.projectId) || [];
      form.setFieldsValue({
        username: editUser.username,
        roleId: editUser.roleId,
        createdBy: editUser.createdBy,
        projectIds: assignedProjectIds
      });
    } else {
      form.setFieldsValue({ roleId: null, createdBy: null, projectIds: [] });
    }
  }, [editUser, selectedAdminId, form, user?.id]);

  // 程序权限：当抽屉打开或用户变化时加载
  const handleDrawerOpen = (open) => {
    if (open && editUser) {
      getUserProgramPermissions(editUser.id).then(p => setProgramPerms(p || [])).catch(() => {});
    }
    if (!open) setProgramPerms([]);
  };

  // 选择机器后加载程序列表
  const handleProgMachineChange = async (pid) => {
    setProgMachine(pid);
    setProgSelected([]);
    if (!pid) { setProgList([]); return; }
    setLoadingProgs(true);
    try {
      const list = await getProgramsByProject(pid);
      setProgList(list || []);
    } catch { setProgList([]); }
    setLoadingProgs(false);
  };

  // 添加程序权限
  const handleAddProgramPerms = async () => {
    if (!progMachine || progSelected.length === 0) return;
    if (editUser) {
      // 编辑已有用户 → 直接调 API
      for (const name of progSelected) {
        await addUserProgramPermission(editUser.id, `${progMachine}-${name}`).catch(() => {});
      }
      const perms = await getUserProgramPermissions(editUser.id);
      setProgramPerms(perms || []);
    } else {
      // 新建用户 → 暂存到本地
      const newPerms = progSelected.map(name => `${progMachine}-${name}`);
      setPendingProgramPerms(prev => [...prev, ...newPerms]);
    }
    setProgSelected([]);
    setProgMachine(null);
    setProgList([]);
    message.success('已添加');
  };

  // 移除程序权限
  const handleRemoveProgramPerm = async (programId) => {
    if (editUser) {
      await removeUserProgramPermission(editUser.id, programId);
      const perms = await getUserProgramPermissions(editUser.id);
      setProgramPerms(perms || []);
    } else {
      setPendingProgramPerms(prev => prev.filter(p => p !== programId));
    }
  };
  


  // 处理角色变化
  const handleRoleChange = (roleId) => {
    setSelectedRoleId(roleId);
  };

  // 处理提交
  const handleSubmit = async (values) => {
    try {
      if (editUser) {
        // 编辑用户逻辑
        if (values.password) {
          await updateUserPassword(editUser.id, values.password);
        }
        if (values.roleId !== editUser.roleId) {
          await updateUserRole(editUser.id, values.roleId);
        }
        // 更新项目权限
        // 1. 先获取用户当前的项目权限
        const currentPermissions = editUser.projectPermissions?.map(p => p.projectId) || [];
        // 2. 计算需要添加和删除的项目
        const newPermissions = values.projectIds || [];
        const toAdd = newPermissions.filter(id => !currentPermissions.includes(id));
        const toRemove = currentPermissions.filter(id => !newPermissions.includes(id));
        // 3. 并行执行添加和删除操作，提高性能
        const addPromises = toAdd.map(pid => setUserProjectPermission(editUser.id, pid));
        const removePromises = toRemove.map(pid => removeUserProjectPermission(editUser.id, pid));
        await Promise.all([...addPromises, ...removePromises]);
        message.success('用户更新成功');
      } else {
        // 新增用户
        const createdBy = Number(values.roleId) === 2 ? null : values.createdBy;
        const res = await createUser(values.username, values.password, values.roleId, createdBy);
        if (res.success) {
          if (values.projectIds && values.projectIds.length > 0) {
            await Promise.all(values.projectIds.map(pid => setUserProjectPermission(res.user.id, pid)));
          }
          // 保存暂存的程序权限
          if (pendingProgramPerms.length > 0) {
            await Promise.all(pendingProgramPerms.map(pid => addUserProgramPermission(res.user.id, pid)));
            setPendingProgramPerms([]);
          }
          message.success('用户创建成功');
        } else {
          message.error(res.error || '创建失败');
          return;
        }
      }
      onUserUpdate();
      onClose();
      form.resetFields();
    } catch (error) {
      console.error('User form error:', error);
      // 处理特定的错误信息
      let errorMessage = '操作失败';
      if (error.response) {
        // 从响应数据中获取错误信息
        const serverError = error.response.data?.message || error.response.data?.error;
        if (serverError && serverError.includes('用户名已存在')) {
          errorMessage = '用户名已存在';
        } else {
          errorMessage = serverError || '服务器错误';
        }
      } else if (error.request) {
        errorMessage = '网络请求失败，请检查网络连接';
      } else {
        errorMessage = error.message || '未知错误';
      }
      message.error(errorMessage);
    }
  };

  // 准备穿梭框的数据
  const transferDataSource = projects.map(p => ({
    key: p.id,
    title: p.name,
    description: p.id
  }));

  // 获取已选择的项目ID
  const getSelectedProjectKeys = () => {
    const values = form.getFieldsValue();
    return values.projectIds || [];
  };

  return (
    <Drawer
      title={editUser ? '编辑用户' : '新增用户'}
      placement="right"
      onClose={onClose}
      open={visible}
        afterOpenChange={handleDrawerOpen}
      width={500}
      footer={(
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '16px' }}>
          <Button onClick={onClose}>取消</Button>
          <Button type="primary" onClick={() => form.submit()}>
            {editUser ? '更新' : '创建'}
          </Button>
        </div>
      )}
    >
      <Form form={form} layout="vertical" onFinish={handleSubmit}>
        <Form.Item 
          name="username" 
          label="用户名" 
          rules={[{ required: true, message: '请输入用户名' }]}
        >
          <Input placeholder="请输入用户名" disabled={!!editUser} />
        </Form.Item>
        
        <Form.Item 
          name="password" 
          label={editUser ? "新密码（可选）" : "密码"} 
          rules={[{ required: !editUser, message: '请输入密码' }]}
        >
          <Input.Password placeholder={editUser ? "留空则不修改密码" : "请输入密码"} />
        </Form.Item>
        
        <Form.Item 
          name="roleId" 
          label="角色" 
          rules={[{ required: true, message: '请选择角色' }]}
        >
          <Select 
              disabled={Number(user?.roleId) !== 1 && editUser?.username !== 'admin' || (editUser?.username === 'admin' && Number(editUser?.roleId) !== 1)}
              onChange={handleRoleChange}
              placeholder="请选择角色"
            >
              {Number(user?.roleId) === 1 && (
                <>
                  <Select.Option value={2}>普通管理员</Select.Option>
                  {/* 只有当存在普通管理员时，才能创建普通用户 */}
                  {users.some(u => Number(u.roleId) === 2) && (
                    <Select.Option value={3}>普通用户</Select.Option>
                  )}
                </>
              )}
              {Number(user?.roleId) === 2 && (
                <Select.Option value={3}>普通用户</Select.Option>
              )}
            </Select>
        </Form.Item>
        
        {/* 仅超级管理员可以为普通用户指定上级管理员 */}
        {Number(user?.roleId) === 1 && (
          <Form.Item 
            name="createdBy" 
            label="上级管理员" 
            hidden={selectedRoleId !== 3}
            rules={[{
              required: selectedRoleId === 3, 
              message: '普通用户必须指定上级管理员'
            }]}
          >
            <Select placeholder="请选择上级管理员">
              {users
                .filter(u => Number(u.roleId) === 2)
                .map(u => <Select.Option key={u.id} value={u.id}>{u.username}</Select.Option>)}
            </Select>
          </Form.Item>
        )}
        
        {/* 普通管理员创建的用户，默认将自己设为上级管理员 */}
        {Number(user?.roleId) === 2 && (
          <Form.Item name="createdBy" hidden initialValue={user?.id}>
            <Input />
          </Form.Item>
        )}
        
        <Form.Item name="projectIds" label="项目权限">
          <Transfer
            dataSource={transferDataSource}
            titles={['未分配', '已分配']}
            selectedKeys={selectedProjectKeys}
            targetKeys={getSelectedProjectKeys()}
            onChange={(targetKeys) => {
              form.setFieldValue('projectIds', targetKeys);
            }}
            onSelectChange={(sourceSelectedKeys, targetSelectedKeys) => {
              setSelectedProjectKeys([...sourceSelectedKeys, ...targetSelectedKeys]);
            }}
            onScroll={() => {
              setSelectedProjectKeys([]);
            }}
            showSearch
            filterOption={(inputValue, item) =>
              item.title.includes(inputValue)
            }
            render={item => item.title}
            listStyle={{ height: 300 }}
          />
        </Form.Item>

        {/* 程序权限（新建和编辑均可用） */}
        <div style={{ marginTop: 8, padding: '12px 0', borderTop: '1px solid #f0f0f0' }}>
          <div style={{ fontWeight: 500, marginBottom: 8, fontSize: 14 }}>程序权限（可选，不选则可操作全部程序）</div>
          {/* 已有程序权限 */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 12 }}>
            {editUser && programPerms.length === 0 && pendingProgramPerms.length === 0 && <span style={{ color: '#9ca3af', fontSize: 12 }}>未限制</span>}
            {!editUser && pendingProgramPerms.length === 0 && <span style={{ color: '#9ca3af', fontSize: 12 }}>未限制</span>}
            {/* 编辑模式：API 加载的程序权限 */}
            {editUser && programPerms.map(p => (
              <Tag key={p.programId} color="blue" closable onClose={() => handleRemoveProgramPerm(p.programId)}>
                {p.programId}
              </Tag>
            ))}
            {/* 新建模式：本地暂存的程序权限 */}
            {!editUser && pendingProgramPerms.map(p => (
              <Tag key={p} color="blue" closable onClose={() => handleRemoveProgramPerm(p)}>
                {p}
              </Tag>
            ))}
          </div>
          {/* 添加程序权限 */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Select style={{ width: 180 }} placeholder="选择机器" value={progMachine} onChange={handleProgMachineChange} allowClear
              options={projects.map(p => ({ label: p.name, value: p.id }))} />
            <Select style={{ minWidth: 220 }} mode="multiple" placeholder="选择程序（可多选）"
              value={progSelected} onChange={setProgSelected} loading={loadingProgs} disabled={!progMachine}
              options={progList.filter(p => {
                const key = `${progMachine}-${p.name}`;
                const existing = editUser ? programPerms.map(x => x.programId || x) : pendingProgramPerms;
                return !existing.includes(key);
              }).map(p => ({ label: p.name, value: p.name }))}
              showSearch filterOption={(input, option) => (option?.label || '').toLowerCase().includes(input.toLowerCase())}
              notFoundContent={progMachine ? '无程序' : '请先选机器'} />
            <Button type="primary" disabled={!progMachine || progSelected.length === 0} onClick={handleAddProgramPerms}>添加</Button>
          </div>
        </div>
      </Form>
    </Drawer>
  );
};

export default UserFormDrawer;
