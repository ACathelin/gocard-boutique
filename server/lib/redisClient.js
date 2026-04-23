/**
 * Redis Client Singleton
 *
 * Provides a single Redis connection for caching and job queues.
 * Falls back gracefully when Redis is not available.
 */

const { logger } = require('../config/logger');

let redis = null;
let isConnected = false;
let connectionError = null;

/**
 * Initialize Redis connection
 * @returns {Object|null} Redis client or null if not available
 */
async function initRedis() {
  // Skip if no Redis URL configured
  if (!process.env.REDIS_URL) {
    logger.info('Redis not configured - REDIS_URL not set');
    return null;
  }

  try {
    // Dynamic import to avoid issues when Redis is not installed
    const Redis = require('ioredis');

    redis = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      lazyConnect: true,
    });

    // Handle connection events
    redis.on('connect', () => {
      isConnected = true;
      connectionError = null;
      logger.info('Redis connected');
    });

    redis.on('error', (err) => {
      connectionError = err;
      logger.error({ error: err }, 'Redis connection error');
    });

    redis.on('close', () => {
      isConnected = false;
      logger.info('Redis connection closed');
    });

    // Attempt to connect
    await redis.connect();

    return redis;
  } catch (err) {
    connectionError = err;
    logger.warn({ error: err.message }, 'Redis not available - running without cache');
    return null;
  }
}

/**
 * Get the Redis client
 * @returns {Object|null} Redis client or null
 */
function getRedis() {
  return redis;
}

/**
 * Check if Redis is connected
 * @returns {boolean}
 */
function isRedisConnected() {
  return isConnected && redis !== null;
}

/**
 * Get Redis connection status
 * @returns {Object}
 */
function getStatus() {
  return {
    configured: Boolean(process.env.REDIS_URL),
    connected: isConnected,
    error: connectionError?.message || null,
  };
}

/**
 * Gracefully close Redis connection
 */
async function closeRedis() {
  if (redis) {
    await redis.quit();
    redis = null;
    isConnected = false;
    logger.info('Redis connection closed gracefully');
  }
}

module.exports = {
  initRedis,
  getRedis,
  isRedisConnected,
  getStatus,
  closeRedis,
};
