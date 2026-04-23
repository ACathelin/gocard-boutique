const { pool } = require('./index');
const cacheService = require('../lib/cacheService');

class CompaniesDB {
  static async getCompanyById(id) {
    if (!id) return null;
    const cacheKey = `company:${id}`;
    const cached = await cacheService.get(cacheKey);
    if (cached) return cached;

    const { rows } = await pool.query('SELECT * FROM companies WHERE id = $1 LIMIT 1', [id]);
    const company = rows[0] || null;
    if (company) await cacheService.set(cacheKey, company, 600);
    return company;
  }
}

module.exports = CompaniesDB;
