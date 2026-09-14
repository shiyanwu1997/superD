import React, { useState } from 'react';
import { Modal, Table, Select, Input, DatePicker, Space, Tag, Badge, Tooltip, Button } from 'antd';
import { ReloadOutlined, ClearOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { getProjects, getAllUsers, getOperationLogs } from '../../utils/api';

const { RangePicker } = DatePicker;

const ACTION_META = {
  start: { label: '启动', color: 'green' },
  stop: { label: '停止', color: 'red' },
  restart: { label: '重启', color: 'blue' },
  reload: { label: '重载', color: 'purple' },
};

const OperationLogsModal = ({ open, onClose }) => {
  const [filters, setFilters] = useState({ username: undefined, projectId: undefined, programName: undefined, action: undefined, range: null });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: getProjects, enabled: open });
  const { data: users = [] } = useQuery({ queryKey: ['users'], queryFn: getAllUsers, enabled: open });

  const updateFilter = (patch) => {
    setFilters(prev => ({ ...prev, ...patch }));
    setPage(1);
  };

  const queryParams = {
    page,
    pageSize,
    username: filters.username || undefined,
    projectId: filters.projectId || undefined,
    programName: filters.programName || undefined,
    action: filters.action || undefined,
    from: filters.range?.[0] ? filters.range[0].format('YYYY-MM-DD HH:mm:ss') : undefined,
    to: filters.range?.[1] ? filters.range[1].format('YYYY-MM-DD HH:mm:ss') : undefined,
  };

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['operation-logs', queryParams],
    queryFn: () => getOperationLogs(queryParams),
    enabled: open,
    placeholderData: (prev) => prev,
  });

  const columns = [
    { title: '时间(UTC)', dataIndex: 'createdAt', key: 'createdAt', width: 165 },
    { title: '用户', dataIndex: 'username', key: 'username', width: 100 },
    { title: '机器', dataIndex: 'projectName', key: 'projectName', width: 125, render: (v) => v || '-' },
    {
      title: '服务名', dataIndex: 'programName', key: 'programName', width: 175, ellipsis: true,
      render: (v) => v === '(机器全部)' ? <Tag>机器全部</Tag> : (v || '-')
    },
    {
      title: '操作', dataIndex: 'action', key: 'action', width: 80,
      render: (v) => { const m = ACTION_META[v]; return m ? <Tag color={m.color}>{m.label}</Tag> : v; }
    },
    {
      title: '结果', dataIndex: 'result', key: 'result', width: 85,
      render: (v) => v === 'error'
        ? <Badge status="error" text="失败" />
        : <Badge status="success" text="成功" />
    },
    {
      title: '备注', dataIndex: 'detail', key: 'detail', ellipsis: true,
      render: (v) => v ? <Tooltip title={v}><span>{v}</span></Tooltip> : '-'
    },
  ];

  return (
    <Modal
      title="操作记录"
      open={open}
      onCancel={onClose}
      footer={null}
      width={1100}
      bodyStyle={{ maxHeight: '72vh', overflowY: 'auto' }}
    >
      <Space wrap style={{ marginBottom: 16 }}>
        <Select
          style={{ width: 150 }}
          placeholder="机器（全部）"
          allowClear
          value={filters.projectId}
          onChange={(val) => updateFilter({ projectId: val || undefined })}
          options={projects.map(p => ({ label: p.name, value: p.id }))}
          showSearch
          filterOption={(input, option) => (option?.label || '').toLowerCase().includes(input.toLowerCase())}
        />
        <Select
          style={{ width: 130 }}
          placeholder="用户（全部）"
          allowClear
          value={filters.username}
          onChange={(val) => updateFilter({ username: val || undefined })}
          options={users.map(u => ({ label: u.username, value: u.username }))}
        />
        <Input.Search
          style={{ width: 170 }}
          placeholder="服务名（模糊）"
          allowClear
          onSearch={(val) => updateFilter({ programName: val || undefined })}
        />
        <Select
          style={{ width: 110 }}
          placeholder="操作（全部）"
          allowClear
          value={filters.action}
          onChange={(val) => updateFilter({ action: val || undefined })}
          options={Object.entries(ACTION_META).map(([value, m]) => ({ label: m.label, value }))}
        />
        <RangePicker
          showTime
          value={filters.range}
          onChange={(dates) => updateFilter({ range: dates || null })}
        />
        <Button icon={<ClearOutlined />} onClick={() => updateFilter({ username: undefined, projectId: undefined, programName: undefined, action: undefined, range: null })}>
          重置
        </Button>
        <Button icon={<ReloadOutlined />} loading={isFetching} onClick={() => refetch()}>
          刷新
        </Button>
      </Space>

      <Table
        dataSource={data?.logs || []}
        columns={columns}
        rowKey="id"
        loading={isLoading}
        size="small"
        scroll={{ x: 900 }}
        pagination={{
          current: page,
          pageSize,
          total: data?.total || 0,
          showSizeChanger: true,
          showTotal: (t) => `共 ${t} 条`,
          onChange: (p, ps) => { setPage(p); setPageSize(ps); },
        }}
      />
      <div style={{ marginTop: 8, fontSize: 12, color: '#999' }}>
        记录 启动/停止/重启/重载 操作（含机器级与批量）；被权限拦截的请求不记录；时间为服务器 UTC。
      </div>
    </Modal>
  );
};

export default OperationLogsModal;
