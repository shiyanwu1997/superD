import React, { useState } from 'react';
import { Modal, Tabs, Form, Input, Button, Space, Table, message, Select } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getProjects, createProject, updateProject, deleteProject, getGroups, createGroup, deleteGroup, setProjectGroup } from '../../utils/api';

const ProjectManageModal = ({ open, onClose, onRefresh }) => {
  const [activeTab, setActiveTab] = useState('machines');
  const [editingProject, setEditingProject] = useState(null);
  const [projectForm] = Form.useForm();
  const [groupForm] = Form.useForm();
  const queryClient = useQueryClient();

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: getProjects,
    staleTime: 0,
  });

  const { data: groups = [] } = useQuery({
    queryKey: ['groups'],
    queryFn: getGroups,
  });

  // 创建机器
  const createProjectMutation = useMutation({
    mutationFn: createProject,
    onError: (error) => {
      message.error('创建失败: ' + (error.response?.data?.message || error.message));
    },
  });

  // 更新机器
  const updateProjectMutation = useMutation({
    mutationFn: ({ id, data }) => updateProject(id, data),
    onError: (error) => {
      message.error('更新失败: ' + (error.response?.data?.message || error.message));
    },
  });

  // 删除项目
  const deleteProjectMutation = useMutation({
    mutationFn: deleteProject,
    onSuccess: () => {
      message.success('项目删除成功');
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      if (onRefresh) onRefresh();
    },
    onError: (error) => {
      const serverError = error.response?.data?.message || error.response?.data?.error || error.message;
      message.error('删除项目失败: ' + serverError);
    },
  });

  // 处理表单提交
  const handleProjectSubmit = async (values) => {
    const projectData = {
      name: values.name,
      description: values.description,
      host: values.host,
      port: values.port,
      username: values.username,
      password: values.password
    };

    if (editingProject) {
      await updateProjectMutation.mutateAsync({ id: editingProject.id, data: projectData });
      if (values.groupId !== undefined && values.groupId !== editingProject.groupId) {
        await setProjectGroup(editingProject.id, values.groupId || null);
      }
    } else {
      const result = await createProjectMutation.mutateAsync(projectData);
      if (values.groupId && result?.id) {
        await setProjectGroup(result.id, values.groupId);
      }
    }
    queryClient.invalidateQueries({ queryKey: ['projects'] });
    queryClient.invalidateQueries({ queryKey: ['groups'] });
  };

  // 处理删除机器
  const handleDeleteProject = (id) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除此机器吗？',
      onOk: () => deleteProjectMutation.mutate(id)
    });
  };

  // 处理编辑机器
  const handleEditProject = (record) => {
    setEditingProject(record);
    projectForm.setFieldsValue({
      name: record.name,
      description: record.description,
      groupId: record.groupId || undefined,
      host: record.supervisorConfig?.host,
      port: record.supervisorConfig?.port,
      username: record.supervisorConfig?.username,
      password: record.supervisorConfig?.password,
    });
    setActiveTab('config');
  };

  // 处理添加机器
  const handleAddProject = () => {
    setEditingProject(null);
    projectForm.resetFields();
    setActiveTab('config');
  };

  // 项目分组
  const createGroupMutation = useMutation({
    mutationFn: (data) => createGroup(data.name, data.description),
    onSuccess: () => { message.success('创建成功'); queryClient.invalidateQueries({ queryKey: ['groups'] }); groupForm.resetFields(); },
    onError: (e) => message.error('创建失败: ' + (e.response?.data?.error || e.message)),
  });

  const deleteGroupMutation = useMutation({
    mutationFn: deleteGroup,
    onSuccess: () => { message.success('分组已删除'); queryClient.invalidateQueries({ queryKey: ['groups'] }); queryClient.invalidateQueries({ queryKey: ['projects'] }); },
  });

  // 机器列表列配置
  const projectColumns = [
    { title: '机器名称', dataIndex: 'name', key: 'name' },
    { title: '所属项目', key: 'group', render: (_, r) => groups.find(g => g.id === r.groupId)?.name || '-' },
    { title: '主机', dataIndex: ['supervisorConfig', 'host'], key: 'host' },
    { title: '端口', dataIndex: ['supervisorConfig', 'port'], key: 'port' },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button type="link" icon={<EditOutlined />} onClick={() => handleEditProject(record)} />
          <Button 
            type="link" 
            danger 
            icon={<DeleteOutlined />} 
            onClick={() => handleDeleteProject(record.id)} 
          />
        </Space>
      )
    }
  ];

  return (
    <Modal
      title="机器 & 分组管理"
      open={open}
      onCancel={onClose}
      width={800}
      footer={null}
    >
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'machines',
            label: '机器列表',
            children: (
              <div>
                <Space style={{ marginBottom: 16 }}>
                  <Button type="primary" icon={<PlusOutlined />} onClick={handleAddProject}>添加机器</Button>
                </Space>
                <Table
                  columns={projectColumns} 
                  dataSource={projects} 
                  rowKey="id" 
                  pagination={false}
                  size="small" 
                  loading={isLoading}
                />
              </div>
            )
          },
          {
            key: 'config',
            label: editingProject ? '编辑机器' : '机器配置',
            children: (
              <Form form={projectForm} onFinish={handleProjectSubmit} layout="vertical">
                <Form.Item name="name" label="机器名称" rules={[{ required: true }]}>
                  <Input placeholder="web-server-01" />
                </Form.Item>
                <Form.Item name="groupId" label="所属项目">
                  <Select allowClear placeholder="选择项目（可选）" options={groups.map(g => ({ label: g.name, value: g.id }))} />
                </Form.Item>
                <Form.Item name="description" label="描述">
                  <Input.TextArea />
                </Form.Item>
                <Space style={{ display: 'flex', width: '100%' }} align="start">
                  <Form.Item name="host" label="主机地址" rules={[{ required: true }]} style={{ flex: 3 }}>
                    <Input placeholder="192.168.1.10" />
                  </Form.Item>
                  <Form.Item name="port" label="端口" rules={[{ required: true }]} style={{ flex: 1 }}>
                    <Input placeholder="9001" />
                  </Form.Item>
                </Space>
                <Space style={{ display: 'flex', width: '100%' }} align="start">
                  <Form.Item name="username" label="用户名" style={{ flex: 1 }}>
                    <Input placeholder="选填" />
                  </Form.Item>
                  <Form.Item name="password" label="密码" style={{ flex: 1 }}>
                    <Input.Password placeholder="选填" />
                  </Form.Item>
                </Space>
                <Form.Item>
                  <Space>
                    <Button type="primary" onClick={() => projectForm.submit()}>保存</Button>
                    <Button onClick={() => setActiveTab('machines')}>返回列表</Button>
                  </Space>
                </Form.Item>
              </Form>
            )
          },
          {
            key: 'groups',
            label: '项目分组',
            children: (
              <div>
                <Form form={groupForm} onFinish={(v) => createGroupMutation.mutate({ name: v.name, description: v.description })} layout="inline" style={{ marginBottom: 16 }}>
                  <Form.Item name="name" rules={[{ required: true, message: '请输入分组名称' }]}>
                    <Input placeholder="项目名称，如 生产环境" style={{ width: 200 }} />
                  </Form.Item>
                  <Form.Item>
                    <Button type="primary" htmlType="submit" icon={<PlusOutlined />}>创建项目</Button>
                  </Form.Item>
                </Form>
                <Table
                  dataSource={groups}
                  rowKey="id"
                  pagination={false}
                  size="small"
                  columns={[
                    { title: '名称', dataIndex: 'name' },
                    { title: '机器数', dataIndex: 'machineCount' },
                    {
                      title: '操作', render: (_, r) => (
                        <Button type="link" danger icon={<DeleteOutlined />} onClick={() => deleteGroupMutation.mutate(r.id)} />
                      )
                    }
                  ]}
                />
              </div>
            )
          }
        ]}
      />
    </Modal>
  );
};

export default ProjectManageModal;