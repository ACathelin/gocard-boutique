const db = require('./index');
const cacheService = require('../lib/cacheService');
const { dbLogger: logger } = require('../config/logger');

const CACHE_TTL = 120;

class FeatureFlagsDB {
  static async getFlag(name) {
    const cacheKey = `feature_flags:${name}`;

    try {
      const cached = await cacheService.get(cacheKey);
      if (cached !== undefined) return cached;
    } catch (err) {
      logger.warn({ err, name }, 'Feature flag cache read failed; falling back to DB');
    }

    const { rows } = await db.query(
      'SELECT * FROM feature_flags WHERE name = $1 LIMIT 1',
      [name]
    );
    const flag = rows[0] || null;

    try { await cacheService.set(cacheKey, flag, CACHE_TTL); } catch (err) { /* ignore */ }

    return flag;
  }

  static async isEnabled(name) {
    const flag = await this.getFlag(name);
    return flag ? flag.enabled : false;
  }
}

module.exports = FeatureFlagsDB;
