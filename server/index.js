require('dotenv').config();

const { logger } = require('./config/logger');
const { runMigrations } = require('./db/migrate');
const { initRedis } = require('./lib/redisClient');
const { createApp } = require('./app');

(async () => {
  await runMigrations();
  await initRedis();

  const app = createApp();
  const port = Number(process.env.PORT) || 3000;
  app.listen(port, () => logger.info({ port }, 'gocard-boutique up'));
})().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
