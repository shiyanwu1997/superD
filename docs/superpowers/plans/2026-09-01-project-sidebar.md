# 侧边栏机器树重构 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用 antd Menu（inline 模式）重写 ProgramsPage 侧边栏机器树，抽出 `ProjectSidebar` 组件，解决"收窄后内容消失 / 样式粗糙 / 无动画"三个问题。

**Architecture:** 新建纯展示组件 `client/src/components/ProjectSidebar.jsx` 持有 Menu + 搜索框，ProgramsPage 传入数据替换现有手写 div 树（约 120 行 JSX）。Menu 的 `inlineCollapsed` 提供 VSCode 式收窄弹出子菜单，无需手写。

**Tech Stack:** React 18, antd v5 (`Menu`, `Sider`, `Input.Search`, `Tooltip`), react-router-dom v6 (`useNavigate`), Vitest + @testing-library/react + jsdom。

**Spec:** `docs/superpowers/specs/2026-09-01-project-sidebar-design.md`

## Global Constraints

- antd v5 Menu 必须用 `items` 数组 prop（不是废弃的 `Menu.Item` children）
- 状态圆点颜色逻辑保持不变：`#52c41a` 绿=已连接 / `#d9d9d9` 灰=检测中(null) / `#ff4d4f` 红=断开
- 选中风格保持灰白：`itemSelectedBg: '#f4f4f5'`，选中文字 `#111`
- 默认全部分组展开（现状 `expandedGroups[g.id] !== false` 语义）
- 排序用现有 `sortKey`（前缀字母序 + 尾数字数值序），原样复制
- 现有 2 个 ProgramsPage 测试（`ProgramsPage.polling.test.jsx`、`ProgramsPage.race.test.jsx`）不得回归
- 每个 Task 遵循 TDD：先写失败测试 → 看它失败 → 最小实现 → 看它通过 → commit
- 工作目录 `client/`，测试命令 `npx vitest run <file>`，lint 命令 `npm run lint`

---

### Task 1: ProjectSidebar 渲染 + 导航

**Files:**
- Create: `client/src/components/ProjectSidebar.jsx`
- Test: `client/src/components/ProjectSidebar.test.jsx`

**Interfaces:**
- Consumes: 无（首个任务）
- Produces: `ProjectSidebar` 组件，props 签名（后续任务和 ProgramsPage 集成依赖）：

```jsx
<ProjectSidebar
  collapsed={boolean}          // Sider 收窄态
  projects={Array}             // { id, name, description, groupId, connectionStatus: { connected } }
  groups={Array}               // { id, name, machineCount }
  selectedProjectId={string|null}  // 当前 URL 里的 projectId，null = 全部机器
  isAdmin={boolean}
  onManageClick={Function}
/>
```

- 内部状态：`projectSearchText`（搜索框）、`openKeys`（SubMenu 展开，key 格式 `group-${id}` / `group-ungrouped`）
- Menu item key 约定：全部机器 = `'all'`，机器 = `String(p.id)`

- [ ] **Step 1: 写失败测试（渲染 + 导航）**

```jsx
/**
 * @vitest-environment jsdom
 *
 * ProjectSidebar 渲染与导航测试：
 * 机器树用 antd Menu 重写后，分组/机器/状态点/导航行为必须保持。
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { test, expect, vi, beforeEach, describe } from 'vitest';

vi.mock('antd', async () => {
  const actual = await vi.importActual('antd');
  return { ...actual, message: { error: vi.fn(), success: vi.fn(), warning: vi.fn(), info: vi.fn() } };
});

import ProjectSidebar from './ProjectSidebar';

window.matchMedia =
  window.matchMedia ||
  ((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));

const projects = [
  { id: 1, name: 'mxcc-主控', groupId: 10, connectionStatus: { connected: true } },
  { id: 2, name: 'gfxcc-新', groupId: 10, connectionStatus: { connected: false } },
  { id: 3, name: 'standalone', groupId: null, connectionStatus: { connected: null } },
];
const groups = [
  { id: 10, name: '生产组', machineCount: 2 },
];

// 捕获当前路由，供导航断言
function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

function renderSidebar(props = {}) {
  return render(
    <MemoryRouter initialEntries={['/programs']}>
      <LocationProbe />
      <Routes>
        <Route
          path="/programs"
          element={
            <ProjectSidebar
              collapsed={false}
              projects={projects}
              groups={groups}
              selectedProjectId={null}
              isAdmin={false}
              onManageClick={vi.fn()}
              {...props}
            />
          }
        />
        <Route path="/programs/:projectId" element={<div>program page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ProjectSidebar 渲染', () => {
  test('渲染 全部机器、分组、机器名称', () => {
    renderSidebar();
    expect(screen.getByText('全部机器 (3)')).toBeInTheDocument();
    expect(screen.getByText('生产组 (2)')).toBeInTheDocument();
    expect(screen.getByText('未分组')).toBeInTheDocument();
    // 分组默认展开，机器项可见
    expect(screen.getByText('mxcc-主控')).toBeInTheDocument();
    expect(screen.getByText('gfxcc-新')).toBeInTheDocument();
    expect(screen.getByText('standalone')).toBeInTheDocument();
  });

  test('选中项目高亮：selectedProjectId 传入 String(p.id)', () => {
    const { container } = renderSidebar({ selectedProjectId: '1' });
    const selected = container.querySelector('.ant-menu-item-selected');
    expect(selected).not.toBeNull();
    expect(selected.textContent).toContain('mxcc-主控');
  });
});

describe('ProjectSidebar 导航', () => {
  test('点击机器 → /programs/:id；点击全部机器 → /programs', () => {
    renderSidebar();
    fireEvent.click(screen.getByText('mxcc-主控'));
    expect(screen.getByTestId('location')).toHaveTextContent('/programs/1');
    fireEvent.click(screen.getByText('全部机器 (3)'));
    expect(screen.getByTestId('location')).toHaveTextContent('/programs');
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `cd client && npx vitest run src/components/ProjectSidebar.test.jsx`
Expected: FAIL — `Cannot find default export ... ProjectSidebar`（模块不存在）或等价的 resolve 错误。

- [ ] **Step 3: 最小实现 ProjectSidebar.jsx**

```jsx
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

const statusColor = (connected) =>
  connected === true ? '#52c41a' : connected === null ? '#d9d9d9' : '#ff4d4f';

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

const ProjectSidebar = ({ collapsed, projects, groups, selectedProjectId, isAdmin, onManageClick }) => {
  const navigate = useNavigate();
  const [projectSearchText, setProjectSearchText] = useState('');
  const [openKeys, setOpenKeys] = useState(() =>
    groups.map((g) => `group-${g.id}`).concat(UNGROUPED_KEY)
  );

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
          children: machines.map((p) => ({
            key: String(p.id),
            label: (
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <StatusDot connected={p.connectionStatus?.connected} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.name}
                </span>
              </span>
            ),
          })),
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
            children: ungrouped.map((p) => ({
              key: String(p.id),
              label: (
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <StatusDot connected={p.connectionStatus?.connected} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.name}
                  </span>
                </span>
              ),
            })),
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
  const effectiveOpenKeys = projectSearchText
    ? groups.map((g) => `group-${g.id}`).concat(UNGROUPED_KEY)
    : openKeys;

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
```

注意：搜索框区块 `!collapsed` 才渲染 —— 本任务不做收窄态断言（Task 2 做），这里只保证展开态正确。

- [ ] **Step 4: 运行确认通过**

Run: `cd client && npx vitest run src/components/ProjectSidebar.test.jsx`
Expected: PASS 3 tests。若 jsdom 报 ResizeObserver 相关错误，在测试文件顶部加：

```js
global.ResizeObserver =
  global.ResizeObserver ||
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
```

- [ ] **Step 5: Commit**

```bash
git add client/src/components/ProjectSidebar.jsx client/src/components/ProjectSidebar.test.jsx
git commit -m "feat: ProjectSidebar component — antd Menu machine tree with search"
```

---

### Task 2: 搜索过滤 + 收窄态

**Files:**
- Modify: `client/src/components/ProjectSidebar.test.jsx`（追加用例）
- Modify: `client/src/components/ProjectSidebar.jsx`（仅当测试暴露缺陷时）

**Interfaces:**
- Consumes: Task 1 的 `ProjectSidebar` props 签名
- Produces: 无新接口；验证 Task 1 已实现的搜索/收窄行为

- [ ] **Step 1: 追加失败测试**

在 `ProjectSidebar.test.jsx` 末尾追加（复用文件顶部已有的 `projects`/`groups`/`renderSidebar`）：

```jsx
import { fireEvent } from '@testing-library/react'; // 若顶部已导入则跳过

describe('ProjectSidebar 搜索', () => {
  test('输入关键字过滤机器并自动展开分组', () => {
    renderSidebar();
    const input = screen.getByPlaceholderText('搜索机器名称或描述');
    fireEvent.change(input, { target: { value: 'gfxcc' } });
    expect(screen.getByText('gfxcc-新')).toBeInTheDocument();
    expect(screen.queryByText('mxcc-主控')).not.toBeInTheDocument();
    expect(screen.queryByText('standalone')).not.toBeInTheDocument();
  });

  test('搜索命中无分组的机器时未分组区可见', () => {
    renderSidebar();
    fireEvent.change(screen.getByPlaceholderText('搜索机器名称或描述'), {
      target: { value: 'standalone' },
    });
    expect(screen.getByText('standalone')).toBeInTheDocument();
  });
});

describe('ProjectSidebar 收窄态', () => {
  test('collapsed=true 时搜索框隐藏，Menu 进入 inlineCollapsed', () => {
    const { container } = renderSidebar({ collapsed: true });
    expect(screen.queryByPlaceholderText('搜索机器名称或描述')).not.toBeInTheDocument();
    // antd 收窄态会给 menu 加 ant-menu-inline-collapsed class
    expect(container.querySelector('.ant-menu-inline-collapsed')).not.toBeNull();
    // 顶层项仍渲染（全部机器），文字隐藏但 DOM 存在
    expect(container.textContent).toContain('全部机器');
  });
});
```

- [ ] **Step 2: 运行确认失败（或确认既有实现已覆盖）**

Run: `cd client && npx vitest run src/components/ProjectSidebar.test.jsx`

预期新用例 FAIL。可能的情况：
- 收窄 class 断言失败：antd 的 `inlineCollapsed` 需要同时满足非 `openKeys` 受控。若 `.ant-menu-inline-collapsed` 不出现，把 Menu 的 `openKeys`/`onOpenChange` 改为仅在 `!collapsed` 时传入：`{...(!collapsed ? { openKeys: effectiveOpenKeys, onOpenChange: (keys) => setOpenKeys(keys) } : {})}`

- [ ] **Step 3: 最小修正直到通过**

按 Step 2 诊断修正 `ProjectSidebar.jsx`。antd Menu 已内置：收窄后 SubMenu 变悬停弹出、顶层项带 Tooltip —— 无需额外代码。

- [ ] **Step 4: 运行确认全部通过**

Run: `cd client && npx vitest run src/components/ProjectSidebar.test.jsx`
Expected: PASS 全部（Task 1 的 3 个 + 本任务 3 个）

- [ ] **Step 5: Commit**

```bash
git add client/src/components/ProjectSidebar.jsx client/src/components/ProjectSidebar.test.jsx
git commit -m "feat: ProjectSidebar search filter + collapsed mode via antd inlineCollapsed"
```

---

### Task 3: 集成进 ProgramsPage，删除旧手写树

**Files:**
- Modify: `client/src/pages/ProgramsPage.jsx` — 删除侧边栏内手写树（约 626-770 行的机器树 div 区块），替换为 `<ProjectSidebar />`；删除随之失效的 state（`projectSearchText`、`setProjectSearchText`、`expandedGroups`、`setExpandedGroups`）和 `filteredProjects` memo（若仅侧边栏使用）
- Test: 现有 `client/src/pages/ProgramsPage.race.test.jsx`、`client/src/pages/ProgramsPage.polling.test.jsx` 作为回归

**Interfaces:**
- Consumes: Task 1/2 的 `ProjectSidebar` 完整行为
- Produces: ProgramsPage 侧边栏新结构，后续部署依赖

- [ ] **Step 1: 先跑现有回归测试确认基线绿**

Run: `cd client && npx vitest run src/pages/`
Expected: PASS（race + polling 全部）

- [ ] **Step 2: 修改 ProgramsPage.jsx**

a. 顶部加 import：`import ProjectSidebar from '../components/ProjectSidebar';`

b. 删除 state（76-84 行区域）：`projectSearchText`/`setProjectSearchText`、`expandedGroups`/`setExpandedGroups`

c. 删除 `filteredProjects` memo（127-141 行）—— 确认无其他引用后删；若 Header 等处引用则保留

d. 用 grep 确认没有遗漏引用：

```bash
grep -n "projectSearchText\|expandedGroups\|filteredProjects" client/src/pages/ProgramsPage.jsx
```
Expected: 无输出（全部清除）

e. 替换 Sider 内容（554-771 行区域）：保留 `<Sider>` 外壳与 Logo 区块（566-577 行），把其后的"机器列表"标题+搜索框+机器树（579-770 行）整体替换为：

```jsx
<ProjectSidebar
  collapsed={collapsed}
  projects={projects}
  groups={groups}
  selectedProjectId={projectId ?? null}
  isAdmin={user?.roleId === 1}
  onManageClick={() => setShowProjectModal(true)}
/>
```

同时把 Sider 内层树容器的 `height: 'calc(100% - 128px)'` 样式去掉（ProjectSidebar 自己管理布局），Logo 区块下改用一个 `flex: 1, overflow: hidden` 的容器包 ProjectSidebar：

```jsx
<Sider
  trigger={null}
  collapsible
  collapsed={collapsed}
  width={280}
  collapsedWidth={72}
  style={{ boxShadow: '1px 0 0 0 var(--border)', zIndex: 10, backgroundColor: '#fff' }}
>
  <div
    style={{
      height: 56,
      display: 'flex',
      alignItems: 'center',
      padding: collapsed ? '0 12px' : '0 20px',
      justifyContent: collapsed ? 'center' : 'flex-start',
      borderBottom: '1px solid var(--border)',
    }}
  >
    <Logo size={32} collapsed={collapsed} />
  </div>
  <div style={{ height: 'calc(100% - 56px)', overflow: 'hidden' }}>
    <ProjectSidebar
      collapsed={collapsed}
      projects={projects}
      groups={groups}
      selectedProjectId={projectId ?? null}
      isAdmin={user?.roleId === 1}
      onManageClick={() => setShowProjectModal(true)}
    />
  </div>
</Sider>
```

- [ ] **Step 3: 跑全部前端测试确认无回归**

Run: `cd client && npx vitest run && npm run lint`
Expected: 全部 PASS（含 race、polling、ProjectSidebar 6 个）；lint 无 error（原有 2 个 useEffect 警告可接受，不得新增）

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/ProgramsPage.jsx
git commit -m "refactor: replace hand-written sidebar tree with ProjectSidebar (antd Menu)"
```

---

### Task 4: 浏览器金路径验证

**Files:**
- 无代码修改（验证任务；发现问题则回到对应组件修正并补测试）

**Interfaces:**
- Consumes: Task 3 完成后的完整应用
- Produces: 验证结论

- [ ] **Step 1: 启动 dev server**

Run: `cd client && npm run dev`（后台运行）
浏览器打开 http://localhost:5173，登录（需后端则另开 `cd backend && npm run dev`）

- [ ] **Step 2: 逐项验证金路径**

检查清单（每项必须实际操作）：
1. 展开态：分组/机器显示、状态圆点颜色（绿/灰/红）
2. 点击机器 → 表格切换；点击"全部机器" → 回全部
3. 搜索关键字 → 过滤 + 分组自动展开；清空恢复
4. 分组头点击 → 收起/展开（有动画）
5. 顶栏折叠按钮 → 侧栏收窄到 72px（有宽度过渡动画）；悬停分组图标 → 弹出机器子菜单，可点击导航
6. 再点展开 → 恢复
7. 管理机器齿轮（admin 账号）→ modal 打开

发现问题 → 回 Task 1/2/3 对应组件修正 + 补失败测试 + 重跑。

- [ ] **Step 3: 最终全量验证**

Run: `cd client && npx vitest run && npm run lint`
Expected: 全绿

- [ ] **Step 4: Commit（若有修正）**

```bash
git add -A client/src
git commit -m "fix: polish from browser verification pass"
```
