/**
 * Cloudflare Turnstile verification.
 *
 * Verifies a `cf-turnstile-response` header (or body field) against Cloudflare's
 * siteverify API. Used on `/api/boutique/*` write endpoints to block headless
 * abuse of the concierge and checkout.
 *
 * Validates the full Cloudflare siteverify response — not just `success`:
 *   - `hostname` matches the site we expect (FRONTEND_URL or a configured allowlist)
 *   - `action`   matches the action passed by the caller
 *   - `challenge_ts` is within MAX_TOKEN_AGE_MS of now (rejects replay of old tokens)
 *
 * Verified tokens are cached in Redis for a short window to keep latency low for
 * legitimate retries within a single user action. The cache key is scoped to
 * `{tokenHash, action, ip}` so a harvested token can only be replayed by the same
 * caller, for the same action, within the window.
 *
 * If `TURNSTILE_SECRET_KEY` is unset, the middleware logs a one-time warning
 * and allows the request through — keeps local dev usable.
 */

const crypto = require('crypto');
const { logger } = require('../config/logger');
const { getRedis, isRedisConnected } = require('../lib/redisClient');

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const CACHE_TTL_SECONDS = 10;
const CACHE_PREFIX = 'turnstile:verified:';
const MAX_TOKEN_AGE_MS = 5 * 60 * 1000;

let missingSecretWarned = false;

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex').slice(0, 32);
}

function cacheKey({ tokenHash, action, ip }) {
  return `${CACHE_PREFIX}${tokenHash}:${action || '-'}:${ip || '-'}`;
}

async function readCache(key) {
  try {
    const redis = getRedis();
    if (!redis || !isRedisConnected()) return null;
    const cached = await redis.get(key);
    return cached === '1';
  } catch (err) {
    logger.warn({ error: err.message }, 'Turnstile cache read failed');
    return null;
  }
}

async function writeCache(key) {
  try {
    const redis = getRedis();
    if (!redis || !isRedisConnected()) return;
    await redis.set(key, '1', 'EX', CACHE_TTL_SECONDS);
  } catch (err) {
    logger.warn({ error: err.message }, 'Turnstile cache write failed');
  }
}

function allowedHostnames() {
  const frontend = process.env.FRONTEND_URL;
  const hosts = new Set();
  if (frontend) {
    try { hosts.add(new URL(frontend).hostname); } catch { /* ignore bad URL */ }
  }
  if (process.env.NODE_ENV !== 'production') {
    hosts.add('localhost');
    hosts.add('127.0.0.1');
  }
  const extra = process.env.TURNSTILE_ALLOWED_HOSTNAMES;
  if (extra) for (const h of extra.split(',').map((s) => s.trim()).filter(Boolean)) hosts.add(h);
  return hosts;
}

function verifyTurnstile(options = {}) {
  const { allowEmptyInDev = true, action = 'boutique' } = options;

  return async function turnstileMiddleware(req, res, next) {
    const secret = process.env.TURNSTILE_SECRET_KEY;

    if (!secret) {
      if (allowEmptyInDev && process.env.NODE_ENV !== 'production') {
        if (!missingSecretWarned) {
          logger.warn('TURNSTILE_SECRET_KEY not set — Turnstile verification disabled (dev mode)');
          missingSecretWarned = true;
        }
        return next();
      }
      return res.status(503).json({
        success: false,
        code: 'TURNSTILE_NOT_CONFIGURED',
        error: 'Turnstile is not configured on this server.'
      });
    }

    const token = req.get('cf-turnstile-response') || req.body?.turnstileToken;
    if (!token || typeof token !== 'string') {
      return res.status(403).json({
        success: false,
        code: 'TURNSTILE_MISSING',
        error: 'Missing Turnstile token.'
      });
    }

    const tokenHash = hashToken(token);
    const key = cacheKey({ tokenHash, action, ip: req.ip });
    if ((await readCache(key)) === true) return next();

    try {
      const form = new URLSearchParams();
      form.append('secret', secret);
      form.append('response', token);
      if (req.ip) form.append('remoteip', req.ip);

      const response = await fetch(SITEVERIFY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form.toString()
      });

      const result = await response.json();

      if (!result?.success) {
        logger.info(
          { errorCodes: result?.['error-codes'], ip: req.ip, path: req.path },
          'Turnstile verification failed'
        );
        return res.status(403).json({
          success: false,
          code: 'TURNSTILE_FAILED',
          error: 'Turnstile verification failed.'
        });
      }

      const hosts = allowedHostnames();
      if (hosts.size > 0 && result.hostname && !hosts.has(result.hostname)) {
        logger.warn(
          { hostname: result.hostname, allowed: [...hosts], ip: req.ip, path: req.path },
          'Turnstile hostname mismatch'
        );
        return res.status(403).json({
          success: false,
          code: 'TURNSTILE_HOSTNAME_MISMATCH',
          error: 'Turnstile verification failed.'
        });
      }

      if (result.action && result.action !== action) {
        logger.warn(
          { got: result.action, want: action, ip: req.ip, path: req.path },
          'Turnstile action mismatch'
        );
        return res.status(403).json({
          success: false,
          code: 'TURNSTILE_ACTION_MISMATCH',
          error: 'Turnstile verification failed.'
        });
      }

      if (result.challenge_ts) {
        const issued = Date.parse(result.challenge_ts);
        if (!Number.isNaN(issued) && Date.now() - issued > MAX_TOKEN_AGE_MS) {
          logger.info(
            { issued: result.challenge_ts, ip: req.ip, path: req.path },
            'Turnstile token too old'
          );
          return res.status(403).json({
            success: false,
            code: 'TURNSTILE_STALE',
            error: 'Turnstile token expired — please retry.'
          });
        }
      }

      await writeCache(key);
      return next();
    } catch (err) {
      logger.error({ error: err.message, path: req.path }, 'Turnstile siteverify request failed');
      return res.status(503).json({
        success: false,
        code: 'TURNSTILE_UPSTREAM_ERROR',
        error: 'Turnstile verification temporarily unavailable.'
      });
    }
  };
}

module.exports = { verifyTurnstile };
