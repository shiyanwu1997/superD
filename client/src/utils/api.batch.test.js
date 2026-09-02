/**
 * @vitest-environment jsdom
 *
 * 批量重启 API 测试：
 * batchRestartPrograms 必须一次 POST 到 /programs/batch-restart，
 * 携带全部 programIds —— 替代前端逐个串行调用（30s+ → 一次请求）。
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';

vi.mock('axios', () => {
  const mkInstance = () => ({
    get: vi.fn(),
    post: vi.fn(),
    interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
  });
  const instances = [];
  return {
    default: {
      create: vi.fn(() => {
        const i = mkInstance();
        instances.push(i);
        return i;
      }),
    },
    __instances: instances,
  };
});

import { batchRestartPrograms } from './api';

describe('batchRestartPrograms', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('POST /programs/batch-restart 一次性携带全部 programIds', async () => {
    const axiosModule = await import('axios');
    // api.js 创建了两个实例（api + checkStatusApi），batchRestartPrograms 用第一个（api）
    const apiInstance = axiosModule.__instances[0];
    apiInstance.post.mockResolvedValue({ data: { success: true, summary: { total: 2, succeeded: 2, failed: 0 } } });

    const result = await batchRestartPrograms(['8-worker', '8-web']);

    expect(apiInstance.post).toHaveBeenCalledWith('/programs/batch-restart', {
      programIds: ['8-worker', '8-web'],
    });
    expect(result.summary.succeeded).toBe(2);
  });
});
