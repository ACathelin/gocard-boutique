const { pool } = require('./index');
const cacheService = require('../lib/cacheService');

class UsersDB {
  static async findUserById(id) {
    if (!id) return null;
    const cacheKey = `user:${id}`;
    const cached = await cacheService.get(cacheKey);
    if (cached) return cached;

    const { rows } = await pool.query(
      'SELECT id, username, email, role, company_id, is_active FROM users WHERE id = $1 LIMIT 1',
      [id]
    );
    const user = rows[0] || null;
    if (user) await cacheService.set(cacheKey, user, 3600);
    return user;
  }
}

module.exports = UsersDB;
