const express = require('express');
const router = express.Router();
const db = require('../models/db');
const authMiddleware = require('../middleware/auth');
const { ApiError } = require('../utils/errors');
const { createApiTokenSecret, hashApiToken, normalizeScopes } = require('../utils/apiToken');

const DEFAULT_TTL_DAYS = 90;
const MAX_TTL_DAYS = 365;

function serializeToken(token) {
  const { tokenHash, ...safeToken } = token;
  return safeToken;
}

function resolveExpiry(expiresAt) {
  const now = Date.now();
  const defaultExpiry = new Date(now + DEFAULT_TTL_DAYS * 24 * 60 * 60 * 1000);
  if (!expiresAt) return defaultExpiry;

  const requested = new Date(expiresAt);
  if (Number.isNaN(requested.getTime()) || requested.getTime() <= now) {
    throw new ApiError(400, 'expiresAt 必须是未来的有效时间');
  }
  if (requested.getTime() > now + MAX_TTL_DAYS * 24 * 60 * 60 * 1000) {
    throw new ApiError(400, `expiresAt 最多只能设置为 ${MAX_TTL_DAYS} 天后`);
  }
  return requested;
}

const managementGuards = [
  authMiddleware.verifyToken,
  authMiddleware.requireScope('tokens:manage'),
  authMiddleware.checkSuperAdmin
];

router.get('/api/api-tokens', ...managementGuards, async (req, res, next) => {
  try {
    res.json((await db.getApiTokens()).map(serializeToken));
  } catch (error) {
    next(error);
  }
});

router.post('/api/api-tokens', ...managementGuards, async (req, res, next) => {
  try {
    const userId = Number.parseInt(req.body.userId, 10);
    const name = String(req.body.name || '').trim();
    if (!Number.isInteger(userId) || userId < 1 || !name || name.length > 100) {
      throw new ApiError(400, 'userId 和 1-100 字符的 name 为必填项');
    }

    const user = await db.getUserById(userId);
    if (!user) throw new ApiError(404, '绑定用户不存在');

    let scopes;
    try {
      scopes = normalizeScopes(req.body.scopes);
    } catch (error) {
      throw new ApiError(400, error.message);
    }

    const expiresAt = resolveExpiry(req.body.expiresAt);
    const token = createApiTokenSecret();
    const apiToken = await db.createApiToken(userId, name, hashApiToken(token), scopes, expiresAt.toISOString());

    res.status(201).json({
      token,
      apiToken: serializeToken(apiToken),
      warning: '令牌只会在本次响应中返回，请立即安全保存。'
    });
  } catch (error) {
    next(error);
  }
});

router.delete('/api/api-tokens/:id', ...managementGuards, async (req, res, next) => {
  try {
    const tokenId = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(tokenId) || tokenId < 1) throw new ApiError(400, '无效的令牌 ID');
    if (!(await db.revokeApiToken(tokenId))) throw new ApiError(404, '令牌不存在或已撤销');
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

router.get('/api/api-audit-events', ...managementGuards, async (req, res, next) => {
  try {
    const requested = Number.parseInt(req.query.limit, 10);
    const limit = Number.isInteger(requested) ? Math.min(Math.max(requested, 1), 500) : 100;
    res.json(await db.getApiAuditEvents(limit));
  } catch (error) {
    next(error);
  }
});

module.exports = router;
