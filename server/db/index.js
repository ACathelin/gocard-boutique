require('dotenv').config();
const { Pool } = require('pg');
const { dbLogger: logger } = require('../config/logger');

const connectionString =
  process.env.DATABASE_URL ||
  `postgresql://${process.env.PGUSER || 'postgres'}:${process.env.PGPASSWORD || 'postgres'}@${process.env.PGHOST || 'localhost'}:${process.env.PGPORT || 5432}/${process.env.PGDATABASE || 'boutique'}`;

const isProduction = process.env.NODE_ENV === 'production';
const sslConfig = isProduction ? { rejectUnauthorized: false } : false;

const pool = new Pool({
  connectionString,
  ssl: sslConfig,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 10000,
  max: 20,
  min: 0,
  allowExitOnIdle: true,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
});

// Never use logger.error here — would trigger a feedback loop under DB outage.
pool.on('error', (err) => {
  console.error('Unexpected error on idle client:', err.message);
});

logger.info({ mode: sslConfig === false ? 'disabled' : 'permissive', NODE_ENV: process.env.NODE_ENV }, 'Database pool ready');

async function query(text, params) {
  const start = Date.now();
  const result = await pool.query(text, params);
  const elapsed = Date.now() - start;
  if (elapsed > 100) {
    logger.warn({ executionTimeMs: elapsed, query: text.substring(0, 100) }, 'Slow query detected');
  }
  return result;
}

module.exports = {
  query,
  pool,
  rawQuery: (text, params) => pool.query(text, params),
  getClient: () => pool.connect()
};
