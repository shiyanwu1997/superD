/**
 * @vitest-environment jsdom
 *
 * ProgramsPage 切换项目竞态测试：
 * 快速从项目 A 切到项目 B 时，A 的慢响应不得覆盖 B 的数据。
 * 注意：不 mock useNavigate（需要真实导航）。
 */
import React from 'react';
import { render, waitFor, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { test, expect, vi, beforeEach } from 'vitest';

vi.mock('antd', async () => {
  const actual = await vi.importActual('antd');
  return {
    ...actual,
    message: { error: vi.fn(), success: vi.fn(), warning: vi.fn(), info: vi.fn() },
  };
});

const mockLogout = vi.fn();
const mockUser = { id: 1, username: 'test', roleId: 1 };
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: mockUser, logout: mockLogout }),
}));

const mockGetProgramsByProject = vi.fn((...args) => mockGetProgramsByProjectImpl(...args));
let mockGetProgramsByProjectImpl = () => Promise.resolve([]);

vi.mock('../utils/api', () => ({
  getAllPrograms: vi.fn().mockResolvedValue([]),
  getProgramsByProject: (...args) => mockGetProgramsByProject(...args),
  startProgram: vi.fn(),
  stopProgram: vi.fn(),
  restartProgram: vi.fn(),
  getProjects: vi.fn().mockResolvedValue([
    { id: 1, name: 'project-A', connectionStatus: { connected: true } },
    { id: 2, name: 'project-B', connectionStatus: { connected: true } },
  ]),
  startAllPrograms: vi.fn(),
  stopAllPrograms: vi.fn(),
  restartAllPrograms: vi.fn(),
  reloadConfig: vi.fn(),
  checkProjectStatus: vi.fn(() => Promise.resolve({ connected: true })),
  getGroups: vi.fn().mockResolvedValue([]),
  getAllUsers: vi.fn().mockResolvedValue([]),
  getAllRoles: vi.fn().mockResolvedValue([]),
  getUserProjectPermissions: vi.fn().mockResolvedValue([]),
  getUserProgramPermissions: vi.fn().mockResolvedValue([]),
}));

import ProgramsPage from './ProgramsPage';

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

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

// 桥组件：把 router 的真实 navigate 暴露给测试（用 ref 而非重赋值，规避 react-hooks/globals）
const bridgeRef = { current: null };
function NavigateBridge() {
  const navigate = useNavigate();
  React.useEffect(() => {
    bridgeRef.current = navigate;
  }, [navigate]);
  return null;
}

function renderApp(initialPath) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <NavigateBridge />
        <Routes>
          <Route path="/programs/:projectId" element={<ProgramsPage />} />
          <Route path="/programs" element={<ProgramsPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetProgramsByProjectImpl = () => Promise.resolve([]);
});

test('快速切换项目时，旧项目的慢响应不覆盖新项目数据', async () => {
  // 项目1（慢，300ms）、项目2（快，10ms）
  mockGetProgramsByProjectImpl = (pid) => {
    if (String(pid) === '1')
      return delay(300).then(() => [{ id: '1-slow-app', name: 'slow-app', projectId: 1, status: 'RUNNING' }]);
    return delay(10).then(() => [{ id: '2-fast-app', name: 'fast-app', projectId: 2, status: 'RUNNING' }]);
  };

  renderApp('/programs/1');

  // 等 project 1 的请求 in-flight
  await waitFor(() => expect(mockGetProgramsByProject).toHaveBeenCalledWith('1'));

  // 同一 Router 实例内导航到项目2（同组件仅参数变化，不重新挂载）
  await act(async () => {
    bridgeRef.current('/programs/2');
  });
  await waitFor(() => expect(mockGetProgramsByProject).toHaveBeenCalledWith('2'));

  // 等慢响应（项目1）和快响应（项目2）都返回
  await delay(500);

  // 表格应显示项目2的数据，而不是被项目1的慢响应覆盖
  const bodyText = document.body.textContent;
  expect(bodyText).toContain('fast-app');
  expect(bodyText).not.toContain('slow-app');
}, 15000);
