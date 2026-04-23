require('dotenv').config();
const { Pool } = require('pg');
const { dbLogger: logger } = require('../config/logger');

const connectionString =
  process.env.DATABASE_URL ||
  `postgresql://${process.env.PGUSER || 'postgres'}:${process.env.PGPASSWORD || 'postgres'}@${process.env.PGHOST || 'localhost'}:${process.env.PGPORT || 5432}/${process.env.PGDATABASE || 'boutique'}`;

const isProduction = process.env.NODE_ENV === 'production';

function resolveSslConfig() {
  if (!isProduction) return false;

  // In production, verify certificates by default. An operator who genuinely
  // needs a self-signed chain (ngrok, some managed Postgres dev tiers) can
  // opt into permissive mode via PGSSL_INSECURE=1 — but must do so deliberately.
  if (process.env.PGSSL_INSECURE === '1') {
    logger.warn('PGSSL_INSECURE=1 — DB connection will accept any certificate (MITM possible)');
    return { rejectUnauthorized: false };
  }

  const caPath = process.env.PGSSLROOTCERT;
  if (caPath) {
    const fs = require('fs');
    try {
      return { rejectUnauthorized: true, ca: fs.readFileSync(caPath, 'utf8') };
    } catch (err) {
      throw new Error(`Failed to read PGSSLROOTCERT at ${caPath}: ${err.message}`);
    }
  }

  return { rejectUnauthorized: true };
}

const sslConfig = resolveSslConfig();

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

logger.info(
  { mode: sslConfig === false ? 'disabled' : sslConfig.rejectUnauthorized ? 'verify' : 'insecure', NODE_ENV: process.env.NODE_ENV },
  'Database pool ready'
);

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
