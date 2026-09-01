/**
 * @vitest-environment jsdom
 *
 * ProgramsPage 轮询逻辑测试：
 * 当项目已被删除（API 返回「项目不存在」）时，
 * 应停止轮询并跳回 /programs，而不是无限报错。
 */
import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { test, expect, vi, beforeEach } from 'vitest';

// mock antd message
vi.mock('antd', async () => {
  const actual = await vi.importActual('antd');
  return {
    ...actual,
    message: { error: vi.fn(), success: vi.fn(), warning: vi.fn(), info: vi.fn() },
  };
});

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// mock AuthContext（user 必须是稳定引用，否则 effect 依赖变化会造成渲染循环）
const mockLogout = vi.fn();
const mockUser = { id: 1, username: 'test', roleId: 1 };
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: mockUser, logout: mockLogout }),
}));

// mock API：默认项目不存在错误
const mockGetProgramsByProject = vi.fn(() =>
  Promise.reject({
    response: { status: 500, data: { message: '获取程序列表失败', data: '与Supervisor通信失败: 项目不存在' } },
  })
);
vi.mock('../utils/api', () => ({
  getAllPrograms: vi.fn().mockResolvedValue([]),
  getProgramsByProject: (...args) => mockGetProgramsByProject(...args),
  startProgram: vi.fn(),
  stopProgram: vi.fn(),
  restartProgram: vi.fn(),
  getProjects: vi
    .fn()
    .mockResolvedValue([{ id: 9, name: 'ts-dgfxb1-alijp-0002', connectionStatus: { connected: true } }]),
  startAllPrograms: vi.fn(),
  stopAllPrograms: vi.fn(),
  restartAllPrograms: vi.fn(),
  reloadConfig: vi.fn(),
  checkProjectStatus: vi.fn(),
  getGroups: vi.fn().mockResolvedValue([]),
  getAllUsers: vi.fn().mockResolvedValue([]),
  getAllRoles: vi.fn().mockResolvedValue([]),
  getUserProjectPermissions: vi.fn().mockResolvedValue([]),
  getUserProgramPermissions: vi.fn().mockResolvedValue([]),
}));

import ProgramsPage from './ProgramsPage';

// jsdom 没有 matchMedia，antd 响应式组件需要
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

const renderAtProject = (pid) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/programs/${pid}`]}>
        <Routes>
          <Route path="/programs/:projectId" element={<ProgramsPage />} />
          <Route path="/programs" element={<div>programs home</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
};

beforeEach(() => {
  vi.clearAllMocks();
  mockNavigate.mockReset();
});

test('项目不存在时应导航回 /programs 并停止轮询', async () => {
  renderAtProject(8);

  await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/programs', { replace: true }), { timeout: 3000 });

  // 导航后不应继续轮询报错
  const callsAfterNav = mockGetProgramsByProject.mock.calls.length;
  await new Promise((r) => setTimeout(r, 11000));
  expect(mockGetProgramsByProject.mock.calls.length).toBeLessThanOrEqual(callsAfterNav + 1);
}, 20000);
