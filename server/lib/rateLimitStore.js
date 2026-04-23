/**
 * Redis Store Factory for express-rate-limit
 *
 * Returns a RedisStore when Redis is available, undefined otherwise
 * (express-rate-limit falls back to MemoryStore when store is undefined).
 *
 * Two failure modes are supported:
 *   - fail-open (default): during a Redis blip, requests are allowed through.
 *       Correct for read-only browse endpoints where a short outage is better
 *       than a full 5xx.
 *   - fail-closed: during a Redis blip, INCR returns a very high count so
 *       express-rate-limit triggers its 429 handler. Correct for expensive
 *       write endpoints (/chat, /checkout) where cost-runaway during a Redis
 *       outage is worse than a temporary error.
 */

const { getRedis, isRedisConnected } = require('./redisClient');
const { logger } = require('../config/logger');

const SENTINEL_BLOCK = Number.MAX_SAFE_INTEGER;

function failOpenResponse(args) {
  const cmd = (args[0] || '').toString().toUpperCase();
  if (cmd === 'INCR' || cmd === 'INCRBY') return 1;
  if (cmd === 'PTTL' || cmd === 'TTL') return -1;
  if (cmd === 'SET' || cmd === 'SETNX') return 'OK';
  if (cmd === 'EVAL' || cmd === 'EVALSHA') return [1, 15 * 60 * 1000];
  return 0;
}

function failClosedResponse(args) {
  const cmd = (args[0] || '').toString().toUpperCase();
  // Return a count well over any configured max so the limiter rejects.
  if (cmd === 'INCR' || cmd === 'INCRBY') return SENTINEL_BLOCK;
  if (cmd === 'PTTL' || cmd === 'TTL') return 60 * 1000;
  if (cmd === 'SET' || cmd === 'SETNX') return 'OK';
  if (cmd === 'EVAL' || cmd === 'EVALSHA') return [SENTINEL_BLOCK, 60 * 1000];
  return 0;
}

/**
 * @param {string} prefix - Key prefix (e.g. 'auth', 'payment')
 * @param {Object} [options]
 * @param {'open' | 'closed'} [options.onRedisDown='open'] - what to do during outage
 */
function createRedisRateLimitStore(prefix, options = {}) {
  if (!process.env.REDIS_URL) {
    return undefined;
  }

  const onRedisDown = options.onRedisDown === 'closed' ? 'closed' : 'open';
  const fallback = onRedisDown === 'closed' ? failClosedResponse : failOpenResponse;

  try {
    const { RedisStore } = require('rate-limit-redis');

    return new RedisStore({
      sendCommand: async (...args) => {
        try {
          const redis = getRedis();
          if (!redis || !isRedisConnected()) {
            logger.warn({ prefix, cmd: args[0], mode: onRedisDown }, 'Redis unavailable — rate limiter fallback');
            return fallback(args);
          }
          return await redis.call(...args);
        } catch (err) {
          logger.warn({ error: err.message, prefix, cmd: args[0], mode: onRedisDown }, 'Rate limit store error — applying fallback');
          return fallback(args);
        }
      },
      prefix: `rl:${prefix}:`,
    });
  } catch (err) {
    logger.warn({ error: err.message, prefix }, 'Failed to create Redis rate limit store, falling back to memory');
    return undefined;
  }
}

/**
 * Custom key generator for rate limiting that's harder to bypass than IP alone.
 *
 * @param {boolean} [includeUserAgent=false] - Hash UA into the key for stricter fingerprinting
 * @returns {(req: Express.Request) => string}
 */
function createRateLimitKeyGenerator(includeUserAgent = false) {
  return (req) => {
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    if (!includeUserAgent) return ip;

    const userAgent = req.get('User-Agent') || 'unknown';
    const crypto = require('crypto');
    const fingerprint = crypto.createHash('sha256')
      .update(`${ip}:${userAgent}`)
      .digest('hex')
      .substring(0, 16);
    return `${ip}:${fingerprint}`;
  };
}

module.exports = { createRedisRateLimitStore, createRateLimitKeyGenerator };
