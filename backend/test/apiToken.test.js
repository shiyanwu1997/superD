const {
  API_TOKEN_PREFIX,
  createApiTokenSecret,
  hashApiToken,
  normalizeScopes
} = require('../utils/apiToken');

describe('服务 API 令牌工具', () => {
  test('生成带固定前缀且可散列的高熵令牌', () => {
    const token = createApiTokenSecret();
    expect(token.startsWith(API_TOKEN_PREFIX)).toBe(true);
    expect(token.length).toBeGreaterThan(40);
    expect(hashApiToken(token)).toMatch(/^[a-f0-9]{64}$/);
  });

  test('范围会去重并拒绝未知范围', () => {
    expect(normalizeScopes(['projects:read', 'projects:read'])).toEqual(['projects:read']);
    expect(() => normalizeScopes([])).toThrow('至少需要一个令牌范围');
    expect(() => normalizeScopes(['unknown:scope'])).toThrow('包含不支持的令牌范围');
  });
});
