/**
 * Cache Service
 *
 * Provides a unified caching interface that uses Redis when available,
 * falling back to node-cache for local caching.
 */

const { getRedis, isRedisConnected } = require('./redisClient');
const NodeCache = require('node-cache');
const { logger } = require('../config/logger');

// Local fallback cache (5 minute default TTL)
const localCache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

/**
 * Set a value in cache
 * @param {string} key - Cache key
 * @param {*} value - Value to cache (will be JSON stringified for Redis)
 * @param {number} ttlSeconds - Time to live in seconds (default: 300)
 * @returns {Promise<boolean>} Success status
 */
async function set(key, value, ttlSeconds = 300) {
  try {
    const redis = getRedis();

    if (isRedisConnected() && redis) {
      // Use Redis
      const stringValue = JSON.stringify(value);
      await redis.setex(key, ttlSeconds, stringValue);
      return true;
    }

    // Fallback to local cache
    return localCache.set(key, value, ttlSeconds);
  } catch (err) {
    logger.error({ error: err, key }, 'Cache set error');
    // Try local cache as fallback
    return localCache.set(key, value, ttlSeconds);
  }
}

/**
 * Get a value from cache
 * @param {string} key - Cache key
 * @returns {Promise<*>} Cached value or undefined
 */
async function get(key) {
  try {
    const redis = getRedis();

    if (isRedisConnected() && redis) {
      // Use Redis
      const stringValue = await redis.get(key);
      if (stringValue === null) {
        return undefined;
      }
      return JSON.parse(stringValue);
    }

    // Fallback to local cache
    return localCache.get(key);
  } catch (err) {
    logger.error({ error: err, key }, 'Cache get error');
    // Try local cache as fallback
    return localCache.get(key);
  }
}

/**
 * Delete a value from cache
 * @param {string} key - Cache key
 * @returns {Promise<boolean>} Success status
 */
async function del(key) {
  try {
    const redis = getRedis();

    if (isRedisConnected() && redis) {
      // Use Redis
      await redis.del(key);
    }

    // Always clear from local cache too
    localCache.del(key);
    return true;
  } catch (err) {
    logger.error({ error: err, key }, 'Cache delete error');
    localCache.del(key);
    return false;
  }
}

/**
 * Delete all keys matching a pattern
 * @param {string} pattern - Pattern to match (e.g., "catalog:*")
 * @returns {Promise<number>} Number of keys deleted
 */
async function invalidatePattern(pattern) {
  try {
    const redis = getRedis();
    let count = 0;

    if (isRedisConnected() && redis) {
      // Use Redis SCAN for pattern matching
      let cursor = '0';
      do {
        const [newCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = newCursor;
        if (keys.length > 0) {
          await redis.del(...keys);
          count += keys.length;
        }
      } while (cursor !== '0');
    }

    // For local cache, we need to manually check keys
    const localKeys = localCache.keys();
    const regex = new RegExp('^' + pattern.replace('*', '.*') + '$');
    for (const key of localKeys) {
      if (regex.test(key)) {
        localCache.del(key);
        count++;
      }
    }

    return count;
  } catch (err) {
    logger.error({ error: err, pattern }, 'Cache invalidate pattern error');
    return 0;
  }
}

/**
 * Get cache statistics
 * @returns {Object} Cache stats
 */
function getStats() {
  const localStats = localCache.getStats();
  return {
    usingRedis: isRedisConnected(),
    local: {
      keys: localCache.keys().length,
      hits: localStats.hits,
      misses: localStats.misses,
    },
  };
}

/**
 * Clear all cache
 * @returns {Promise<void>}
 */
async function flushAll() {
  try {
    const redis = getRedis();

    if (isRedisConnected() && redis) {
      await redis.flushdb();
    }

    localCache.flushAll();
    logger.info('Cache flushed');
  } catch (err) {
    logger.error({ error: err }, 'Cache flush error');
    localCache.flushAll();
  }
}

module.exports = {
  set,
  get,
  del,
  invalidatePattern,
  getStats,
  flushAll,
};
