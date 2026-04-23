const express = require('express');
const path = require('path');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const helmet = require('helmet');

const { logger, attachLogger } = require('./config/logger');
const FeatureFlagsDB = require('./db/featureFlags');

function resolveCorsOrigin() {
  const frontend = process.env.FRONTEND_URL;
  if (frontend) return frontend;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('FRONTEND_URL must be set in production — refusing to start with a permissive CORS origin.');
  }
  return ['http://localhost:3000', 'http://localhost:5173'];
}

function createApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(helmet({
    // Relaxed CSP because the bundled SPA inlines a JSON-LD <script> and
    // loads Turnstile + Google Fonts from external origins.
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        'script-src': ["'self'", "'unsafe-inline'", 'https://challenges.cloudflare.com'],
        'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        'font-src': ["'self'", 'https://fonts.gstatic.com'],
        'frame-src': ["'self'", 'https://challenges.cloudflare.com'],
        'connect-src': ["'self'", 'https://challenges.cloudflare.com'],
        'img-src': ["'self'", 'data:', 'https:'],
      },
    },
    crossOriginEmbedderPolicy: false,
    hsts: process.env.NODE_ENV === 'production'
      ? { maxAge: 63072000, includeSubDomains: true, preload: true }
      : false,
  }));

  app.use(compression());
  app.use(cors({
    origin: resolveCorsOrigin(),
    credentials: true,
  }));
  app.use(cookieParser());

  // Webhooks need the raw body for HMAC verification — mount BEFORE express.json.
  app.use('/api/worldline/webhook', require('./routes/worldlineWebhook'));

  app.use(express.json({ limit: '100kb' }));
  app.use(attachLogger);

  app.get('/health', (_req, res) => res.json({ ok: true }));

  // Public-readable flags. Deliberately excludes anything that describes
  // security posture (e.g. `boutique_turnstile_required`) — probing the public
  // endpoint shouldn't reveal whether bot protection is currently enforced.
  const ALLOWED_PUBLIC_FLAGS = new Set([
    'boutique_public_enabled',
    'boutique_chat_enabled',
    'boutique_payments_enabled',
    'boutique_vic_enabled',
    'boutique_mc_agentpay_enabled',
    'boutique_visa_trusted_agent_enabled',
    'boutique_mc_trusted_agent_enabled',
  ]);

  app.get('/api/system/public-feature-flags/:name', async (req, res) => {
    const { name } = req.params;
    if (!ALLOWED_PUBLIC_FLAGS.has(name)) {
      return res.status(403).json({ success: false, error: 'Flag not in public allowlist.' });
    }
    try {
      const flag = await FeatureFlagsDB.getFlag(name);
      if (!flag) return res.status(404).json({ success: false, error: 'Flag not found.' });
      res.set('Cache-Control', 'public, max-age=120');
      res.json({ success: true, flag: { name: flag.name, enabled: flag.enabled } });
    } catch (err) {
      logger.error({ error: err.message, name }, 'Public feature flag read failed');
      res.status(500).json({ success: false, error: 'Failed to read flag.' });
    }
  });

  app.use('/api/boutique', require('./routes/boutique'));

  if (process.env.NODE_ENV === 'production') {
    const distDir = path.resolve(__dirname, '../web/dist');
    app.use(express.static(distDir));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/')) return next();
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.use((err, _req, res, _next) => {
    logger.error({ error: err.message, stack: err.stack }, 'Unhandled error');
    res.status(500).json({ success: false, error: 'Internal server error' });
  });

  return app;
}

module.exports = { createApp };
