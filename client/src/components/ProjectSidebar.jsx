import React, { useMemo, useState } from 'react';
import { Menu, Input, Button, Tooltip } from 'antd';
import { AppstoreOutlined, FolderOutlined, SettingOutlined, SearchOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

// 与 ProgramsPage 相同的排序：前缀字母序 + 尾数字数值序
const sortKey = (name) => {
  const prefix = name.split('-')[0] || '';
  const suffix = parseInt(name.match(/(\d+)$/)?.[1] || '0');
  return [prefix, suffix];
};

const statusColor = (connected) => (connected === true ? '#52c41a' : connected === null ? '#d9d9d9' : '#ff4d4f');

const StatusDot = ({ connected }) => (
  <span
    style={{
      width: 8,
      height: 8,
      borderRadius: '50%',
      display: 'inline-block',
      flexShrink: 0,
      backgroundColor: statusColor(connected),
    }}
  />
);

const UNGROUPED_KEY = 'group-ungrouped';

const machineItem = (p) => ({
  key: String(p.id),
  label: (
    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <StatusDot connected={p.connectionStatus?.connected} />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
    </span>
  ),
});

const ProjectSidebar = ({ collapsed, projects, groups, selectedProjectId, isAdmin, onManageClick }) => {
  const navigate = useNavigate();
  const [projectSearchText, setProjectSearchText] = useState('');
  const [openKeys, setOpenKeys] = useState([]);
  // 分组是异步加载的：首次拿到分组时默认全部展开（用户手动收起后不再自动展开）
  // 渲染期间检测首帧 groups，避免 effect 里同步 setState 触发级联渲染
  const [prevGroupsEmpty, setPrevGroupsEmpty] = useState(true);
  if (prevGroupsEmpty && groups.length > 0) {
    setPrevGroupsEmpty(false);
    setOpenKeys(groups.map((g) => `group-${g.id}`).concat(UNGROUPED_KEY));
  }

  const searched = useMemo(
    () =>
      projectSearchText
        ? projects.filter(
            (p) =>
              p.name.toLowerCase().includes(projectSearchText.toLowerCase()) ||
              p.description?.toLowerCase().includes(projectSearchText.toLowerCase())
          )
        : projects,
    [projects, projectSearchText]
  );

  const menuItems = useMemo(() => {
    const sorted = [...searched].sort((a, b) => {
      const [pa, sa] = sortKey(a.name);
      const [pb, sb] = sortKey(b.name);
      return pa.localeCompare(pb) || sa - sb;
    });

    const groupItems = groups
      .map((g) => {
        const machines = sorted.filter((p) => p.groupId === g.id);
        if (projectSearchText && machines.length === 0) return null; // 搜索时空分组隐藏
        return {
          key: `group-${g.id}`,
          icon: <FolderOutlined />,
          label: `${g.name} (${machines.length})`,
          children: machines.map(machineItem),
        };
      })
      .filter(Boolean);

    const ungrouped = sorted.filter((p) => !p.groupId);
    const ungroupedItem =
      ungrouped.length > 0
        ? {
            key: UNGROUPED_KEY,
            icon: <FolderOutlined />,
            label: '未分组',
            children: ungrouped.map(machineItem),
          }
        : null;

    return [
      {
        key: 'all',
        icon: <AppstoreOutlined />,
        label: `全部机器 (${projects.length})`,
      },
      ...groupItems,
      ...(ungroupedItem ? [ungroupedItem] : []),
    ];
  }, [searched, groups, projectSearchText, projects.length]);

  // 搜索时自动展开所有分组，让匹配项直接可见
  const effectiveOpenKeys = projectSearchText ? groups.map((g) => `group-${g.id}`).concat(UNGROUPED_KEY) : openKeys;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {!collapsed && (
        <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid #e5e7eb' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 12,
            }}
          >
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: '#6b7280',
                textTransform: 'uppercase',
                letterSpacing: 1,
              }}
            >
              机器列表 ({searched.length})
            </span>
            {isAdmin && (
              <Tooltip title="管理机器">
                <Button
                  type="text"
                  size="small"
                  icon={<SettingOutlined />}
                  onClick={onManageClick}
                  style={{ color: '#6b7280', fontSize: 14, fontWeight: 500 }}
                />
              </Tooltip>
            )}
          </div>
          <Input.Search
            placeholder="搜索机器名称或描述"
            allowClear
            enterButton={<SearchOutlined />}
            size="middle"
            value={projectSearchText}
            onChange={(e) => setProjectSearchText(e.target.value)}
            style={{ width: '100%' }}
          />
        </div>
      )}
      <div style={{ flex: 1, overflow: 'auto', padding: '8px 8px' }}>
        <Menu
          mode="inline"
          inlineCollapsed={collapsed}
          selectedKeys={[selectedProjectId ?? 'all']}
          openKeys={effectiveOpenKeys}
          onOpenChange={(keys) => setOpenKeys(keys)}
          onClick={({ key }) => navigate(key === 'all' ? '/programs' : `/programs/${key}`)}
          items={menuItems}
          style={{ border: 'none', background: 'transparent' }}
          theme="light"
        />
      </div>
    </div>
  );
};

export default ProjectSidebar;
