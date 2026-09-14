/**
 * @vitest-environment jsdom
 *
 * 登录页 Logo 布局测试：
 * 顶部标识必须是黑底胶囊（白圆 S 图标 + Supervisor 白字同一行），
 * 替代原来的"图标一行 + 标题一行"堆叠布局。
 */
import React from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { test, expect, vi, describe } from 'vitest';

vi.mock('antd', async () => {
  const actual = await vi.importActual('antd');
  return { ...actual, message: { error: vi.fn(), success: vi.fn(), warning: vi.fn(), info: vi.fn() } };
});

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: null, login: vi.fn(), logout: vi.fn() }),
}));

import LoginPage from './LoginPage';

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

describe('登录页 Logo 布局', () => {
  test('黑底胶囊：S 图标与 Supervisor 同一行', () => {
    const { container } = render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    // 胶囊容器（data-testid 便于定位）
    const capsule = container.querySelector('[data-testid="logo-capsule"]');
    expect(capsule).not.toBeNull();
    // 灰底黑字（与输入框同色的浅灰胶囊）
    expect(capsule.style.background).toBe('rgb(241, 245, 249)');
    // 行内 flex：图标与文字同行
    expect(capsule.style.display).toBe('inline-flex');
    // 含 S 图标 svg 与 Supervisor 文本
    expect(capsule.querySelector('svg')).not.toBeNull();
    expect(capsule.textContent).toContain('Supervisor');
  });

  test('副标题"进程管理平台"保留在胶囊下方', () => {
    const { container } = render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );
    expect(container.textContent).toContain('进程管理平台');
  });
});
