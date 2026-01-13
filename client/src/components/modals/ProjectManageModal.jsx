import React, { useState } from 'react';
import { Modal, Tabs, Form, Input, Button, Space, Table, message } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getProjects, createProject, updateProject, deleteProject } from '../../utils/api';

const ProjectManageModal = ({ open, onClose, onRefresh }) => {
  const [projectModalTab, setProjectModalTab] = useState('list');
  const [editingProject, setEditingProject] = useState(null);
  const [projectForm] = Form.useForm();
  const queryClient = useQueryClient();

  // 获取项目列表
  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: getProjects,
    staleTime: 0, // 设置为0，确保数据能立即更新
  });

  // 创建项目
  const createProjectMutation = useMutation({
    mutationFn: createProject,
    onSuccess: () => {
      message.success('项目创建成功');
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setProjectModalTab('list');
      projectForm.resetFields();
      if (onRefresh) onRefresh();
    },
    onError: (error) => {
      const serverError = error.response?.data?.message || error.response?.data?.error || error.message;
      message.error('创建项目失败: ' + serverError);
    },
  });

  // 更新项目
  const updateProjectMutation = useMutation({
    mutationFn: ({ id, data }) => updateProject(id, data),
    onSuccess: () => {
      message.success('项目更新成功');
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setProjectModalTab('list');
      setEditingProject(null);
      projectForm.resetFields();
      if (onRefresh) onRefresh();
    },
    onError: (error) => {
      const serverError = error.response?.data?.message || error.response?.data?.error || error.message;
      message.error('更新项目失败: ' + serverError);
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
  const handleProjectSubmit = (values) => {
    // 注意：后端期望的是扁平化的字段结构，而不是嵌套在supervisorConfig中
    const projectData = {
      name: values.name,
      description: values.description,
      host: values.host,
      port: values.port,
      username: values.username,
      password: values.password
    };

    if (editingProject) {
      updateProjectMutation.mutate({ id: editingProject.id, data: projectData });
    } else {
      createProjectMutation.mutate(projectData);
    }
  };

  // 处理删除项目
  const handleDeleteProject = (id) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除此项目吗？',
      onOk: () => deleteProjectMutation.mutate(id)
    });
  };

  // 处理编辑项目
  const handleEditProject = (record) => {
    setEditingProject(record);
    projectForm.setFieldsValue({
      name: record.name,
      description: record.description,
      host: record.supervisorConfig?.host,
      port: record.supervisorConfig?.port,
      username: record.supervisorConfig?.username,
      password: record.supervisorConfig?.password,
    });
    setProjectModalTab('config');
  };

  // 处理添加新项目
  const handleAddProject = () => {
    setEditingProject(null);
    projectForm.resetFields();
    setProjectModalTab('config');
  };

  // 项目列配置
  const projectColumns = [
    { title: '项目名称', dataIndex: 'name', key: 'name' },
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
      title="项目管理"
      open={open}
      onCancel={onClose}
      width={800}
      footer={null}
    >
      <Tabs
        activeKey={projectModalTab}
        onChange={setProjectModalTab}
        items={[
          {
            key: 'list',
            label: '项目列表',
            children: (
              <div>
                <Button 
                  type="primary" 
                  icon={<PlusOutlined />} 
                  onClick={handleAddProject}
                  style={{ marginBottom: 16 }}
                >
                  添加项目
                </Button>
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
            label: editingProject ? '编辑项目' : '项目配置',
            children: (
              <Form form={projectForm} onFinish={handleProjectSubmit} layout="vertical">
                <Form.Item name="name" label="项目名称" rules={[{ required: true }]}>
                  <Input placeholder="生产环境-API节点" />
                </Form.Item>
                <Form.Item name="description" label="描述">
                  <Input.TextArea />
                </Form.Item>
                <Space style={{ display: 'flex', width: '100%' }} align="start">
                  <Form.Item name="host" label="主机地址" rules={[{ required: true }]} style={{ flex: 3 }}>
                    <Input placeholder="127.0.0.1" />
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
                    <Button onClick={() => setProjectModalTab('list')}>返回列表</Button>
                  </Space>
                </Form.Item>
              </Form>
            )
          }
        ]}
      />
    </Modal>
  );
};

export default ProjectManageModal;