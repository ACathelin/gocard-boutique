/**
 * Redis Store Factory for express-rate-limit
 *
 * Returns a RedisStore when Redis is available, undefined otherwise
 * (express-rate-limit falls back to MemoryStore when store is undefined).
 */

const { getRedis, isRedisConnected } = require('./redisClient');
const { logger } = require('../config/logger');

/**
 * Fail-open sentinel returned when Redis is unavailable. Shaped by command so
 * rate-limit-redis@4 can parse it without crashing:
 *   - INCR  / INCRBY  → 1 (treat as "first request in window")
 *   - PTTL  / TTL     → -1 (no expiry info — library ignores it)
 *   - SET   / SETNX   → 'OK'
 *   - EVAL  / EVALSHA → [1, 900000] (hits=1, window=15min)
 *   - default         → 0
 *
 * Returning these instead of throwing lets requests through during a Redis
 * blip (deploy race, transient outage) instead of producing an unhandled
 * promise rejection that Sentry catches as a production error.
 */
function failOpenResponse(args) {
  const cmd = (args[0] || '').toString().toUpperCase();
  if (cmd === 'INCR' || cmd === 'INCRBY') return 1;
  if (cmd === 'PTTL' || cmd === 'TTL') return -1;
  if (cmd === 'SET' || cmd === 'SETNX') return 'OK';
  if (cmd === 'EVAL' || cmd === 'EVALSHA') return [1, 15 * 60 * 1000];
  return 0;
}

/**
 * Create a Redis-backed store for express-rate-limit
 * @param {string} prefix - Key prefix to namespace this limiter (e.g. 'auth', 'payment')
 * @returns {Object|undefined} RedisStore instance or undefined for MemoryStore fallback
 */
function createRedisRateLimitStore(prefix) {
  if (!process.env.REDIS_URL) {
    return undefined;
  }

  try {
    const { RedisStore } = require('rate-limit-redis');

    return new RedisStore({
      // rate-limit-redis v4 uses sendCommand to interact with Redis.
      // We must never throw / reject here — an unhandled rejection during a
      // Redis blip becomes a production error, and express-rate-limit does
      // not always surface it as a 5xx. Fail open and log instead.
      sendCommand: async (...args) => {
        try {
          const redis = getRedis();
          if (!redis || !isRedisConnected()) {
            logger.warn({ prefix, cmd: args[0] }, 'Redis unavailable — rate limiter failing open');
            return failOpenResponse(args);
          }
          return await redis.call(...args);
        } catch (err) {
          logger.warn({ error: err.message, prefix, cmd: args[0] }, 'Rate limit store error — failing open');
          return failOpenResponse(args);
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
 * Mirrors the fingerprinting used in worldline-server.js so sensitive endpoints
 * in any router can share one implementation.
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
