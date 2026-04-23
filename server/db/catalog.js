const db = require('./index');
const { dbLogger: logger } = require('../config/logger');
const cacheService = require('../lib/cacheService');

class CatalogDB {
  static async getCategories() {
    const cacheKey = 'catalog:categories';
    const cached = await cacheService.get(cacheKey);
    if (cached) return cached;

    const result = await db.query(`
      SELECT c.*,
             p.name AS parent_name,
             (SELECT COUNT(*) FROM products WHERE category_id = c.id AND status = 'active') AS product_count
      FROM categories c
      LEFT JOIN categories p ON c.parent_id = p.id
      ORDER BY c.name
    `);

    await cacheService.set(cacheKey, result.rows, 600);
    return result.rows;
  }

  static async getBrands() {
    const cacheKey = 'catalog:brands';
    const cached = await cacheService.get(cacheKey);
    if (cached) return cached;

    const result = await db.query(`
      SELECT b.*,
             (SELECT COUNT(*) FROM products WHERE brand_id = b.id AND status = 'active') AS product_count
      FROM brands b
      ORDER BY b.name
    `);

    await cacheService.set(cacheKey, result.rows, 600);
    return result.rows;
  }

  static async searchProducts(filters = {}) {
    const crypto = require('crypto');
    const sorted = Object.keys(filters || {}).sort().reduce((acc, k) => { acc[k] = filters[k]; return acc; }, {});
    const cacheKey = `catalog:products:search:${crypto.createHash('md5').update(JSON.stringify(sorted)).digest('hex')}`;

    const cached = await cacheService.get(cacheKey);
    if (cached) return cached;

    let query = `
      SELECT
        p.*,
        b.name AS brand_name,
        b.logo_url AS brand_logo,
        c.name AS category_name,
        pi.url AS primary_image,
        COALESCE(i.quantity, 0) AS stock_quantity,
        CASE WHEN COALESCE(i.quantity, 0) <= COALESCE(i.low_stock_threshold, 5) THEN TRUE ELSE FALSE END AS low_stock
      FROM products p
      LEFT JOIN brands b ON p.brand_id = b.id
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN product_images pi ON p.id = pi.product_id AND pi.is_primary = TRUE
      LEFT JOIN inventory i ON p.id = i.product_id AND i.variant_id IS NULL
    `;

    const conditions = [];
    const params = [];
    let n = 0;

    if (filters.search) {
      n++;
      conditions.push(`(
        to_tsvector('english', p.name || ' ' || COALESCE(p.description, '')) @@ plainto_tsquery('english', $${n}) OR
        to_tsvector('english', b.name) @@ plainto_tsquery('english', $${n}) OR
        to_tsvector('english', c.name) @@ plainto_tsquery('english', $${n})
      )`);
      params.push(filters.search);
    }

    if (filters.category_id) {
      n++; conditions.push(`p.category_id = $${n}`); params.push(filters.category_id);
    }
    if (filters.brand_id) {
      n++; conditions.push(`p.brand_id = $${n}`); params.push(filters.brand_id);
    }
    if (filters.min_price) {
      n++; conditions.push(`p.price_cents >= $${n}`); params.push(filters.min_price * 100);
    }
    if (filters.max_price) {
      n++; conditions.push(`p.price_cents <= $${n}`); params.push(filters.max_price * 100);
    }
    if (filters.style) {
      n++; conditions.push(`p.style ILIKE $${n}`); params.push(`%${filters.style}%`);
    }
    if (filters.in_stock) {
      conditions.push(`COALESCE(i.quantity, 0) > 0`);
    }

    conditions.push(`p.status = 'active'`);
    query += ' WHERE ' + conditions.join(' AND ');

    switch (filters.sort_by) {
      case 'price_asc':  query += ' ORDER BY p.price_cents ASC'; break;
      case 'price_desc': query += ' ORDER BY p.price_cents DESC'; break;
      case 'name_desc':  query += ' ORDER BY p.name DESC'; break;
      case 'newest':     query += ' ORDER BY p.created_at DESC'; break;
      default:           query += ' ORDER BY p.name ASC';
    }

    if (filters.limit) { n++; query += ` LIMIT $${n}`; params.push(filters.limit); }
    if (filters.offset) { n++; query += ` OFFSET $${n}`; params.push(filters.offset); }

    const result = await db.query(query, params);
    await cacheService.set(cacheKey, result.rows, 900);
    return result.rows;
  }

  static async getProductById(id) {
    const cacheKey = `catalog:product:${id}`;
    const cached = await cacheService.get(cacheKey);
    if (cached) return cached;

    const result = await db.query(`
      SELECT
        p.*,
        b.name AS brand_name,
        b.logo_url AS brand_logo,
        b.description AS brand_description,
        b.website_url AS brand_website,
        c.name AS category_name,
        c.description AS category_description,
        COALESCE(i.quantity, 0) AS stock_quantity,
        COALESCE(i.reserved_quantity, 0) AS reserved_quantity,
        COALESCE(i.low_stock_threshold, 5) AS low_stock_threshold,
        CASE WHEN COALESCE(i.quantity, 0) <= COALESCE(i.low_stock_threshold, 5) THEN TRUE ELSE FALSE END AS low_stock
      FROM products p
      LEFT JOIN brands b ON p.brand_id = b.id
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN inventory i ON p.id = i.product_id AND i.variant_id IS NULL
      WHERE p.id = $1 AND p.status = 'active'
    `, [id]);

    if (result.rows.length === 0) return null;

    const images = await db.query(
      `SELECT * FROM product_images WHERE product_id = $1 ORDER BY is_primary DESC, sort_order ASC`,
      [id]
    );

    const product = {
      ...result.rows[0],
      images: images.rows,
      variants: []
    };

    await cacheService.set(cacheKey, product, 900);
    return product;
  }
}

module.exports = CatalogDB;
