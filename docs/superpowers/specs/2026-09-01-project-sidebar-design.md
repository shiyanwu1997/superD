# 侧边栏机器树重构设计

日期：2026-09-01
状态：已批准

## 背景与问题

ProgramsPage 左侧边栏的机器树目前是手写 div 列表，存在三个问题：

1. **侧栏收窄后内容消失**：折叠按钮收窄侧栏后，机器列表/搜索框全部 `display: none`，只剩 Logo 和空白，机器无法访问
2. **分组树样式粗糙**：分组折叠用 `▼`/`▶` 文字符号 + `📁` emoji，与 antd 图标风格不统一
3. **缺过渡动画**：分组展开/收起瞬间跳变，Sider 宽度变化也无过渡

## 方案

用 antd v5 `Menu`（inline 模式）重写机器树，替代手写 div 树。这是 VSCode / Grafana / JetBrains 等成熟项目的侧栏模式：antd 内置收窄弹出子菜单、Tooltip、展开动画、选中态，无需手写。

否决的替代方案：保留手写树做渐进修补（换图标 + 手写动画 + 手写弹出层）。视觉效果接近，但弹出子菜单的定位/遮挡/关闭逻辑和动画全部要自己维护，长期成本高。

## 组件结构

新建 `client/src/components/ProjectSidebar.jsx`，从 `ProgramsPage.jsx` 抽出（该文件过大，侧边栏是自包含的一块）。

```
<ProjectSidebar
  collapsed              // 是否收窄
  projects               // 项目数组（含 connectionStatus）
  groups                 // 分组数组
  selectedProjectId      // 当前选中项目 id（string），null = 全部机器
  isAdmin                // roleId === 1，控制管理入口
  onManageClick          // 打开管理机器 modal
/>
```

- 纯展示组件，内部自持搜索文本（`projectSearchText`）和 `openKeys` 状态
- 导航直接用 `useNavigate`（测试用 MemoryRouter 包裹，天然可测）
- 现有排序逻辑（`sortKey`）、未分组分区逻辑保持不变

## Menu 配置

- `<Menu mode="inline" inlineCollapsed={collapsed} selectedKeys openKeys onOpenChange>`
- items 结构：
  - `全部机器 (N)`：顶层项，key=`all`，AppstoreOutlined 图标
  - 各分组 = SubMenu（key=`group-${g.id}`，FolderOutlined 图标，label 含机器数）
  - `未分组` = SubMenu（key=`group-ungrouped`），层级与普通分组一致
  - 机器 = 菜单项（key=String(p.id)），label = 状态圆点 + 名称
- 选中态：`selectedKeys = [selectedProjectId ?? 'all']`
- Menu token 定制保持现有灰白风格：`itemSelectedBg: '#f4f4f5'`，替换手写 borderLeft 高亮
- 状态圆点颜色逻辑不变：`#52c41a` 绿=已连接 / `#d9d9d9` 灰=检测中(null) / `#ff4d4f` 红=断开

## 交互行为

- **展开/收窄动画**：antd 内置（Sider 宽度过渡 + SubMenu 高度动画）
- **收窄态（Sider collapsedWidth 72）**：antd 自动把 SubMenu 变悬停弹出层，顶层项带 Tooltip 显示全名。机器在分组弹出层中可见可点
- **默认全部分组展开**（保持现状 `expandedGroups[g.id] !== false`），点击分组头收起
- **搜索时**：过滤机器 + 自动展开所有含匹配项的分组，无匹配的分组隐藏；清空搜索恢复正常
- **收窄时**：隐藏搜索框和"管理机器"齿轮（空间不够）；Logo 保持现有 collapsed 处理

## 测试（TDD）

新组件测试 `client/src/components/ProjectSidebar.test.jsx`：

1. 渲染：分组/机器出现在 Menu 中，状态点颜色正确
2. 点击机器项 → 导航到 `/programs/:id`；点击"全部机器" → `/programs`
3. 搜索过滤 + 自动展开匹配分组
4. 收窄态：`inlineCollapsed` 生效，悬停弹出子菜单出现

回归：现有 ProgramsPage 2 个测试（deleted-project 重定向、切换竞态）必须继续通过。

实现后在浏览器过金路径：展开/收窄/搜索/导航/状态点。

## 不做的事（YAGNI）

- 不加拖拽排序、右键菜单、分组重命名
- 不做侧栏宽度拖拽调节
- 不做收窄状态持久化到 localStorage
