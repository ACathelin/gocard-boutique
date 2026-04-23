/**
 * Cloudflare Turnstile verification.
 *
 * Verifies a `cf-turnstile-response` header (or body field) against Cloudflare's
 * siteverify API. Used on `/api/boutique/*` write endpoints to block headless
 * abuse of the concierge and checkout.
 *
 * If `TURNSTILE_SECRET_KEY` is unset, the middleware logs a one-time warning
 * and allows the request through — keeps local dev usable.
 */

const crypto = require('crypto');
const { logger } = require('../config/logger');
const { getRedis, isRedisConnected } = require('../lib/redisClient');

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const CACHE_TTL_SECONDS = 60;
const CACHE_PREFIX = 'turnstile:verified:';

let missingSecretWarned = false;

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex').slice(0, 32);
}

async function readCache(tokenHash) {
  try {
    const redis = getRedis();
    if (!redis || !isRedisConnected()) return null;
    const cached = await redis.get(`${CACHE_PREFIX}${tokenHash}`);
    return cached === '1';
  } catch (err) {
    logger.warn({ error: err.message }, 'Turnstile cache read failed');
    return null;
  }
}

async function writeCache(tokenHash) {
  try {
    const redis = getRedis();
    if (!redis || !isRedisConnected()) return;
    await redis.set(`${CACHE_PREFIX}${tokenHash}`, '1', 'EX', CACHE_TTL_SECONDS);
  } catch (err) {
    logger.warn({ error: err.message }, 'Turnstile cache write failed');
  }
}

function verifyTurnstile(options = {}) {
  const { allowEmptyInDev = true } = options;

  return async function turnstileMiddleware(req, res, next) {
    const secret = process.env.TURNSTILE_SECRET_KEY;

    if (!secret) {
      if (allowEmptyInDev) {
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
    if ((await readCache(tokenHash)) === true) return next();

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
        logger.info({ errorCodes: result?.['error-codes'], ip: req.ip, path: req.path }, 'Turnstile verification failed');
        return res.status(403).json({ success: false, code: 'TURNSTILE_FAILED', error: 'Turnstile verification failed.' });
      }

      await writeCache(tokenHash);
      return next();
    } catch (err) {
      logger.error({ error: err.message, path: req.path }, 'Turnstile siteverify request failed');
      return res.status(503).json({ success: false, code: 'TURNSTILE_UPSTREAM_ERROR', error: 'Turnstile verification temporarily unavailable.' });
    }
  };
}

module.exports = { verifyTurnstile };
