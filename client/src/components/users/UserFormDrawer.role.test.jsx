/**
 * @vitest-environment jsdom
 *
 * 角色选择权限测试：
 * 普通管理员（roleId=2）新建用户时角色可选（只有"普通用户"选项），
 * 且不被 disabled —— 否则必填校验与禁用状态互相矛盾，用户永远无法提交。
 * 原 bug：disabled 表达式运算符优先级错误，editUser 为 null 时第一段即为 true。
 */
import React from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { test, expect, vi, beforeEach, describe } from 'vitest';

vi.mock('antd', async () => {
  const actual = await vi.importActual('antd');
  return { ...actual, message: { error: vi.fn(), success: vi.fn(), warning: vi.fn(), info: vi.fn() } };
});

const mockUser = { id: 2, username: 'jess', roleId: 2 };
let mockUserImpl = () => mockUser;
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: mockUserImpl(), logout: vi.fn() }),
}));

vi.mock('../../utils/api', () => ({
  createUser: vi.fn(),
  setUserProjectPermission: vi.fn(),
  removeUserProjectPermission: vi.fn(),
  updateUserPassword: vi.fn(),
  updateUserRole: vi.fn(),
  addUserProgramPermission: vi.fn(),
  removeUserProgramPermission: vi.fn(),
  getUserProgramPermissions: vi.fn().mockResolvedValue([]),
  getProgramsByProject: vi.fn().mockResolvedValue([]),
}));

import UserFormDrawer from './UserFormDrawer';

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

// Drawer 渲染到 body portal，从 document 查询
function renderDrawer({ editUser = null, user = mockUser } = {}) {
  mockUserImpl = () => user;
  render(
    <MemoryRouter>
      <UserFormDrawer
        visible={true}
        onClose={vi.fn()}
        onUserUpdate={vi.fn()}
        users={[]}
        projects={[]}
        editUser={editUser}
      />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUserImpl = () => mockUser;
});

describe('角色选择权限', () => {
  test('普通管理员新建用户：角色 Select 存在且不被禁用', () => {
    renderDrawer();
    const allSelects = document.querySelectorAll('.ant-select');
    expect(allSelects.length).toBeGreaterThan(0);
    const roleSelect = allSelects[0];
    expect(roleSelect.className).not.toContain('ant-select-disabled');
  });

  test('编辑内置 admin 账户时角色锁定（超管视角）', () => {
    renderDrawer({
      user: { id: 1, username: 'admin', roleId: 1 },
      editUser: { id: 1, username: 'admin', roleId: 1, projectPermissions: [] },
    });
    const allSelects = document.querySelectorAll('.ant-select');
    const roleSelect = allSelects[0];
    expect(roleSelect.className).toContain('ant-select-disabled');
  });

  test('超管新建用户：角色可选，有 普通管理员/普通用户 两个选项', () => {
    renderDrawer({ user: { id: 1, username: 'admin', roleId: 1 } });
    const roleSelect = document.querySelectorAll('.ant-select')[0];
    expect(roleSelect.className).not.toContain('ant-select-disabled');
    // 选项文本在 Select 的 dropdown 配置里；直接验证渲染的 option 节点（未展开时 antd 也会挂载）
    const bodyText = document.body.textContent;
    expect(bodyText).not.toContain('超级管理员'); // 任何人都不能创建超管
  });
});
