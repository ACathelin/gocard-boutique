require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const { dbLogger: logger } = require('../config/logger');

async function run() {
  const databaseUrl = process.env.DATABASE_URL ||
    `postgresql://${process.env.PGUSER || 'postgres'}:${process.env.PGPASSWORD || 'postgres'}@${process.env.PGHOST || 'localhost'}:${process.env.PGPORT || 5432}/${process.env.PGDATABASE || 'boutique'}`;

  if (!databaseUrl || databaseUrl.includes('your_')) {
    logger.fatal('DATABASE_URL is not configured');
    process.exit(1);
  }

  logger.info({ NODE_ENV: process.env.NODE_ENV }, 'Migration starting');

  const isProduction = process.env.NODE_ENV === 'production';
  const sslConfig = isProduction ? { rejectUnauthorized: false } : false;

  const client = new Client({ connectionString: databaseUrl, ssl: sslConfig });
  await client.connect();

  await client.query(`CREATE TABLE IF NOT EXISTS _migrations (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    run_at TIMESTAMPTZ DEFAULT now()
  )`);

  const migrationsDir = path.join(__dirname, '../../migrations');
  if (!fs.existsSync(migrationsDir)) {
    logger.warn({ migrationsDir }, 'Migrations directory missing; skipping');
    await client.end();
    return;
  }

  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

  for (const file of files) {
    const { rowCount } = await client.query('SELECT 1 FROM _migrations WHERE name = $1', [file]);
    if (rowCount > 0) continue;

    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    logger.info({ migration: file }, 'Applying migration');

    await client.query('BEGIN');
    try {
      await client.query(sql);
      await client.query('INSERT INTO _migrations(name) VALUES ($1)', [file]);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      logger.fatal({ migration: file, error: err.message }, 'Migration failed');
      await client.end();
      process.exit(1);
    }
  }

  await client.end();
  logger.info('Migrations complete');
}

module.exports = { runMigrations: run };

if (require.main === module) {
  run().catch((err) => {
    console.error('Migration error:', err);
    process.exit(1);
  });
}
