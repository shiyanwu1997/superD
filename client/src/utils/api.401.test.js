/**
 * @vitest-environment jsdom
 *
 * api.js 401 拦截器测试：
 * 主实例与 checkStatusApi 实例收到 401 都必须清 token 并跳转登录页，
 * 否则 token 过期时连接检查把 401 吞成"连接失败"，用户永远无法回到登录页。
 */
import { test, expect, vi, beforeEach, describe } from 'vitest';

// jsdom 的 Location 不可修改，用 stubGlobal 整体替换
const replaceSpy = vi.fn();
vi.stubGlobal('location', {
  href: 'http://localhost/programs',
  pathname: '/programs',
  replace: replaceSpy,
});

beforeEach(() => {
  replaceSpy.mockClear();
  localStorage.clear();
});

async function loadApiWithMockedAxios() {
  // 动态 import，确保每个测试拿到新 module 实例且 mock 已生效
  vi.resetModules();
  const axios = (await import('axios')).default;
  vi.spyOn(axios, 'create').mockImplementation((config = {}) => {
    const handlers = { req: [], resSuccess: [], resError: [] };
    const instance = {
      config,
      interceptors: {
        request: { use: (s) => handlers.req.push(s) },
        response: {
          use: (s, e) => {
            if (s) handlers.resSuccess.push(s);
            if (e) handlers.resError.push(e);
          },
        },
      },
      __handlers: handlers,
      get: vi.fn(),
      post: vi.fn(),
    };
    return instance;
  });
  const apiModule = await import('./api');
  return { apiModule, axios };
}

describe('401 拦截器', () => {
  test('checkStatusApi 实例挂了 401 处理：清 token + 跳登录', async () => {
    const { axios } = await loadApiWithMockedAxios();
    const instances = axios.create.mock.results.map((r) => r.value);
    // checkStatusApi 是第二个实例（timeout 6000）
    const checkStatusApi = instances.find((i) => i.config?.timeout === 6000);
    expect(checkStatusApi, 'checkStatusApi 实例应存在').toBeDefined();

    // 找到它注册的错误拦截器（含 401 逻辑的那个）
    localStorage.setItem('token', 'expired-jwt');
    let handled = null;
    for (const fn of checkStatusApi.__handlers.resError) {
      const err = { response: { status: 401 }, config: {} };
      fn(err).catch(() => {}); // 拦截器返回 rejected promise，避免未处理拒绝噪音
      if (err._handled) {
        handled = fn;
        break;
      }
    }
    expect(handled, 'checkStatusApi 应有标记 _handled 的 401 拦截器').toBeDefined();
    expect(localStorage.getItem('token')).toBeNull();
    expect(replaceSpy).toHaveBeenCalledWith('/login');
  });

  test('主 api 实例 401 行为保持不变', async () => {
    const { axios } = await loadApiWithMockedAxios();
    const instances = axios.create.mock.results.map((r) => r.value);
    const mainApi = instances.find((i) => i.config?.timeout === 28000);
    expect(mainApi).toBeDefined();

    localStorage.setItem('token', 'expired-jwt');
    let handled = null;
    for (const fn of mainApi.__handlers.resError) {
      const err = { response: { status: 401 }, config: {} };
      fn(err).catch(() => {});
      if (err._handled) {
        handled = fn;
        break;
      }
    }
    expect(handled).toBeDefined();
    expect(localStorage.getItem('token')).toBeNull();
    expect(replaceSpy).toHaveBeenCalledWith('/login');
  });
});
