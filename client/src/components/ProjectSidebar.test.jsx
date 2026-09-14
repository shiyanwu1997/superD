/**
 * @vitest-environment jsdom
 *
 * ProjectSidebar 渲染与导航测试：
 * 机器树用 antd Menu 重写后，分组/机器/状态点/导航行为必须保持。
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
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

window.ResizeObserver =
  window.ResizeObserver ||
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };

const projects = [
  { id: 1, name: 'mxcc-主控', groupId: 10, connectionStatus: { connected: true } },
  { id: 2, name: 'gfxcc-新', groupId: 10, connectionStatus: { connected: false } },
  { id: 3, name: 'standalone', groupId: null, connectionStatus: { connected: null } },
];
const groups = [{ id: 10, name: '生产组', machineCount: 2 }];

// 捕获当前路由，供导航断言
function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

function SidebarRoute(props) {
  return (
    <ProjectSidebar
      collapsed={false}
      projects={projects}
      groups={groups}
      selectedProjectId={null}
      isAdmin={false}
      onManageClick={vi.fn()}
      {...props}
    />
  );
}

function renderSidebar(props = {}) {
  return render(
    <MemoryRouter initialEntries={['/programs']}>
      <LocationProbe />
      <Routes>
        {/* 两条路由都挂侧边栏，模拟真实布局：导航后侧边栏仍在，可继续点击 */}
        <Route path="/programs" element={<SidebarRoute {...props} />} />
        <Route path="/programs/:projectId" element={<SidebarRoute {...props} />} />
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

describe('ProjectSidebar 搜索', () => {
  test('输入关键字过滤机器并自动展开分组', () => {
    renderSidebar();
    fireEvent.change(screen.getByPlaceholderText('搜索机器名称或描述'), {
      target: { value: 'gfxcc' },
    });
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
    expect(container.querySelector('.ant-menu-inline-collapsed')).not.toBeNull();
    // 顶层项仍渲染（全部机器）
    expect(container.textContent).toContain('全部机器');
  });
});

describe('ProjectSidebar 异步分组', () => {
  test('分组异步到达时默认全部展开（首次拿到 groups 前 openKeys 为空）', async () => {
    // 模拟真实时序：先渲染无分组，再异步拿到分组 —— 初始 useState 捕获不到分组
    const { rerender } = render(
      <MemoryRouter initialEntries={['/programs']}>
        <Routes>
          <Route
            path="/programs"
            element={
              <ProjectSidebar
                collapsed={false}
                projects={[]}
                groups={[]}
                selectedProjectId={null}
                isAdmin={false}
                onManageClick={vi.fn()}
              />
            }
          />
        </Routes>
      </MemoryRouter>
    );
    rerender(
      <MemoryRouter initialEntries={['/programs']}>
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
              />
            }
          />
        </Routes>
      </MemoryRouter>
    );
    // 分组到达后应自动展开，机器项直接可见
    await waitFor(() => {
      expect(screen.getByText('mxcc-主控')).toBeInTheDocument();
      expect(screen.getByText('standalone')).toBeInTheDocument();
    });
  });
});
