const crypto = require('crypto');

const API_TOKEN_PREFIX = 'sd_';
const VALID_API_SCOPES = Object.freeze([
  '*',
  'projects:read',
  'projects:write',
  'groups:read',
  'groups:write',
  'programs:read',
  'programs:write',
  'logs:read',
  'users:read',
  'users:write',
  'tokens:manage'
]);

function createApiTokenSecret() {
  return `${API_TOKEN_PREFIX}${crypto.randomBytes(32).toString('base64url')}`;
}

function hashApiToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function normalizeScopes(scopes) {
  if (!Array.isArray(scopes) || scopes.length === 0) {
    throw new Error('至少需要一个令牌范围');
  }

  const normalized = [...new Set(scopes.map(scope => String(scope).trim()))];
  if (normalized.some(scope => !VALID_API_SCOPES.includes(scope))) {
    throw new Error('包含不支持的令牌范围');
  }
  return normalized;
}

module.exports = { API_TOKEN_PREFIX, VALID_API_SCOPES, createApiTokenSecret, hashApiToken, normalizeScopes };
