/**
 * /api/boutique — public endpoints powering the GoCard boutique.
 *
 * All routes are unauthenticated (public) and pass through Turnstile + rate
 * limiting. Checkout writes `payment_logs` with `ai_type='wl_mcp'` so the rows
 * are readily filterable.
 *
 * The chat endpoint delegates to `server/services/agentBridge.js` — today a
 * thin wrapper around `boutiqueAssistantService`. When a real Worldline GoPay
 * Direct MCP ships, only `agentBridge.js` changes.
 */

'use strict';

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { body, param, validationResult } = require('express-validator');
const { logger } = require('../config/logger');

const { pool } = require('../db');
const PaymentLogsDB = require('../db/paymentLogs');
const FeatureFlagsDB = require('../db/featureFlags');
const UsersDB = require('../db/users');
const agentBridge = require('../services/agentBridge');
const { getRedis, isRedisConnected } = require('../lib/redisClient');

const { verifyTurnstile } = require('../middleware/turnstile');
const {
  browseLimiter,
  detailLimiter,
  chatLimiter,
  checkoutLimiter,
  statusLimiter,
} = require('../middleware/boutiqueRateLimit');
const { authenticateToken } = require('../middleware/auth');

const { getSDK, getMerchantId } = require('../lib/worldlineSdk');

// Seeded UUIDs from migrations/002_seed.sql.
const BOUTIQUE_BRAND_ID   = 'b0000000-0000-4000-8000-0000000000b0';
const BOUTIQUE_COMPANY_ID = 'f0000000-0000-4000-8000-0000000000b0';
const MAX_CHECKOUT_CENTS  = 30000 * 100; // €30,000 cap

const IDEMPOTENCY_TTL_SECONDS = 24 * 60 * 60; // 24h
const CHECKOUT_SESSION_TTL_SECONDS = 2 * 60 * 60; // 2h — covers full hosted-checkout lifetime

function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  next();
}

/**
 * Optional auth: if the request carries a Bearer token, populate req.user.
 * If not, continue as anonymous. /chat and /checkout work for both.
 */
function optionalAuth(req, res, next) {
  const header = req.headers.authorization || '';
  if (!header.toLowerCase().startsWith('bearer ')) return next();
  authenticateToken(req, res, (err) => {
    if (err) return next();
    next();
  });
}

/**
 * Extract a human-safe error summary from a Worldline SDK exception without
 * leaking raw response bodies (which may contain merchant / partial card data)
 * into logs or the payment_logs table.
 */
function sanitizeSdkError(err) {
  if (!err) return { message: 'Unknown error' };
  const errors = err?.response?.body?.errors;
  if (Array.isArray(errors) && errors.length) {
    const first = errors[0] || {};
    return {
      message: String(first.message || 'Worldline error').slice(0, 240),
      code: first.errorCode || null,
      category: first.category || null,
    };
  }
  const name = err.name || 'Error';
  const msg = typeof err.message === 'string' ? err.message.slice(0, 240) : 'Unknown';
  return { message: `${name}: ${msg}`, code: null, category: null };
}

/**
 * Trim the Worldline response to the fields the app actually uses — avoids
 * persisting auth codes, 3DS payloads, and other sensitive merchant data into
 * payment_logs.response_body verbatim.
 */
function trimHostedCheckoutResponse(body) {
  if (!body || typeof body !== 'object') return null;
  return {
    hostedCheckoutId: body.hostedCheckoutId || null,
    partialRedirectUrl: body.partialRedirectUrl || null,
    returnMac: typeof body.RETURNMAC === 'string' ? '[present]' : null,
    merchantReference: body?.merchantReference || null,
  };
}

async function fetchBoutiqueProducts({ category, search } = {}) {
  const conditions = [`p.brand_id = $1`, `p.status = 'active'`];
  const params = [BOUTIQUE_BRAND_ID];

  if (category) {
    params.push(category);
    conditions.push(`p.category_id = $${params.length}`);
  }
  if (search) {
    params.push(`%${String(search).slice(0, 120)}%`);
    conditions.push(`(p.name ILIKE $${params.length} OR COALESCE(p.description,'') ILIKE $${params.length})`);
  }

  const { rows } = await pool.query(
    `SELECT p.id, p.name, p.description, p.brand_id, p.category_id,
            p.sku, p.price_cents, p.currency, p.style, p.status,
            p.availability, p.booking_note,
            p.created_at, p.updated_at,
            b.name AS brand_name, b.logo_url AS brand_logo,
            c.name AS category_name,
            pi.url AS primary_image,
            COALESCE(i.quantity, 0) AS stock_quantity,
            CASE WHEN COALESCE(i.quantity, 0) <= COALESCE(i.low_stock_threshold, 5)
                 THEN true ELSE false END AS low_stock
     FROM products p
     LEFT JOIN brands b ON p.brand_id = b.id
     LEFT JOIN categories c ON p.category_id = c.id
     LEFT JOIN product_images pi ON p.id = pi.product_id AND pi.is_primary = true
     LEFT JOIN inventory i ON p.id = i.product_id AND i.variant_id IS NULL
     WHERE ${conditions.join(' AND ')}
     ORDER BY p.name ASC`,
    params
  );

  return rows.map((r) => ({
    ...r,
    price_cents: Number(r.price_cents) || 0,
    stock_quantity: Number(r.stock_quantity) || 0,
  }));
}

async function fetchBoutiqueProductById(id) {
  const { rows } = await pool.query(
    `SELECT p.id, p.name, p.description, p.brand_id, p.category_id,
            p.sku, p.price_cents, p.currency, p.style, p.status,
            p.availability, p.booking_note,
            p.created_at, p.updated_at,
            b.name AS brand_name, b.logo_url AS brand_logo,
            c.name AS category_name,
            pi.url AS primary_image,
            COALESCE(i.quantity, 0) AS stock_quantity,
            CASE WHEN COALESCE(i.quantity, 0) <= COALESCE(i.low_stock_threshold, 5)
                 THEN true ELSE false END AS low_stock
     FROM products p
     LEFT JOIN brands b ON p.brand_id = b.id
     LEFT JOIN categories c ON p.category_id = c.id
     LEFT JOIN product_images pi ON p.id = pi.product_id AND pi.is_primary = true
     LEFT JOIN inventory i ON p.id = i.product_id AND i.variant_id IS NULL
     WHERE p.id = $1 AND p.brand_id = $2 AND p.status = 'active'
     LIMIT 1`,
    [id, BOUTIQUE_BRAND_ID]
  );
  const r = rows[0];
  if (!r) return null;
  return { ...r, price_cents: Number(r.price_cents) || 0, stock_quantity: Number(r.stock_quantity) || 0 };
}

/**
 * Server-authoritative cart pricing — never trust client-supplied amounts.
 */
async function priceCartFromDb(cart) {
  if (!Array.isArray(cart) || cart.length === 0) return null;
  const ids = [];
  for (const item of cart) {
    const id = String(item?.productId || item?.id || '').toLowerCase();
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id)) {
      ids.push(id);
    }
  }
  if (ids.length === 0) return null;

  let rows;
  try {
    const result = await pool.query(
      `SELECT id, price_cents, name
         FROM products
        WHERE brand_id = $1 AND status = 'active' AND id = ANY($2::uuid[])`,
      [BOUTIQUE_BRAND_ID, ids]
    );
    rows = Array.isArray(result?.rows) ? result.rows : [];
  } catch (err) {
    logger.warn({ err: err.message }, '[priceCartFromDb] pool.query failed');
    return null;
  }

  const byId = new Map(rows.map((r) => [r.id, { cents: Number(r.price_cents) || 0, name: r.name }]));

  let amountCents = 0;
  let matchedLines = 0;
  const breakdown = [];
  for (const item of cart) {
    const id = String(item?.productId || item?.id || '').toLowerCase();
    const qty = Math.max(1, Math.min(Number(item?.quantity) || 1, 99));
    const row = byId.get(id);
    if (!row) continue;
    amountCents += row.cents * qty;
    matchedLines += 1;
    breakdown.push({ productId: id, name: row.name, quantity: qty, line_cents: row.cents * qty });
  }
  if (matchedLines === 0 || amountCents <= 0) return null;
  return { amountCents, matchedLines, breakdown };
}

async function flag(name, fallback = false) {
  try {
    const row = await FeatureFlagsDB.getFlag(name);
    if (!row) return fallback;
    return Boolean(row.enabled);
  } catch (err) {
    logger.warn({ error: err.message, name }, 'Feature flag read failed');
    return fallback;
  }
}

async function requireBoutiqueEnabled(req, res, next) {
  const enabled = await flag('boutique_public_enabled', true);
  if (!enabled) {
    return res.status(403).json({ success: false, error: 'Boutique is currently unavailable.' });
  }
  next();
}

function turnstileForAction(action) {
  return async function optionalTurnstile(req, res, next) {
    const required = await flag('boutique_turnstile_required', true);
    if (!required) return next();
    return verifyTurnstile({ action })(req, res, next);
  };
}

function ensureSessionId(req, res) {
  const existing = req.cookies?.boutique_sid;
  if (existing && /^[0-9a-f-]{36}$/i.test(existing)) return existing;
  const fresh = crypto.randomUUID();
  res.cookie('boutique_sid', fresh, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });
  return fresh;
}

// ---------------------------------------------------------------------------
// Redis helpers: idempotency + hosted-checkout ↔ session binding.
// Silently no-op when Redis is unavailable — callers treat the absence of a
// cached record as "not yet seen".
// ---------------------------------------------------------------------------

function idempotencyKeyIsValid(key) {
  return typeof key === 'string' && /^[A-Za-z0-9_.\-]{8,128}$/.test(key);
}

function idempotencyCacheKey(sessionId, key) {
  return `boutique:idem:${sessionId}:${key}`;
}

async function readIdempotentResponse(sessionId, key) {
  if (!isRedisConnected()) return null;
  try {
    const redis = getRedis();
    const raw = await redis.get(idempotencyCacheKey(sessionId, key));
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    logger.warn({ err: err.message }, '[boutique] idempotency read failed');
    return null;
  }
}

async function writeIdempotentResponse(sessionId, key, payload) {
  if (!isRedisConnected()) return;
  try {
    const redis = getRedis();
    await redis.set(
      idempotencyCacheKey(sessionId, key),
      JSON.stringify(payload),
      'EX',
      IDEMPOTENCY_TTL_SECONDS
    );
  } catch (err) {
    logger.warn({ err: err.message }, '[boutique] idempotency write failed');
  }
}

function checkoutSessionKey(hostedCheckoutId) {
  return `boutique:hc:${hostedCheckoutId}`;
}

async function bindCheckoutToSession(hostedCheckoutId, sessionId) {
  if (!isRedisConnected() || !hostedCheckoutId || !sessionId) return;
  try {
    const redis = getRedis();
    await redis.set(checkoutSessionKey(hostedCheckoutId), sessionId, 'EX', CHECKOUT_SESSION_TTL_SECONDS);
  } catch (err) {
    logger.warn({ err: err.message }, '[boutique] checkout session bind failed');
  }
}

async function lookupCheckoutSession(hostedCheckoutId) {
  if (!isRedisConnected() || !hostedCheckoutId) return null;
  try {
    const redis = getRedis();
    return await redis.get(checkoutSessionKey(hostedCheckoutId));
  } catch (err) {
    logger.warn({ err: err.message }, '[boutique] checkout session lookup failed');
    return null;
  }
}

// ============================================================================
// GET /capabilities
// ============================================================================
router.get('/capabilities', browseLimiter, requireBoutiqueEnabled, async (req, res) => {
  try {
    const [
      chatEnabled,
      paymentsEnabled,
      vicEnabled,
      mcAgentPayEnabled,
      turnstileRequired,
    ] = await Promise.all([
      flag('boutique_chat_enabled', true),
      flag('boutique_payments_enabled', true),
      flag('boutique_vic_enabled', true),
      flag('boutique_mc_agentpay_enabled', true),
      flag('boutique_turnstile_required', true),
    ]);

    res.set('Cache-Control', 'public, max-age=60');
    res.json({
      success: true,
      capabilities: {
        chatEnabled,
        paymentsEnabled,
        turnstileRequired,
        networks: {
          visa_intelligent_commerce: vicEnabled,
          mastercard_agentpay: mcAgentPayEnabled,
        },
      },
      agentBridge: agentBridge.getStatus(),
    });
  } catch (error) {
    logger.error({ error: error.message }, 'boutique capabilities error');
    res.status(500).json({ success: false, error: 'Failed to load capabilities.' });
  }
});

// ============================================================================
// GET /products
// ============================================================================
router.get('/products', browseLimiter, requireBoutiqueEnabled, async (req, res) => {
  try {
    const products = await fetchBoutiqueProducts({
      category: req.query.category,
      search: req.query.search,
    });
    res.set('Cache-Control', 'public, max-age=60');
    res.json({ success: true, products });
  } catch (error) {
    logger.error({ error: error.message }, 'boutique products error');
    res.status(500).json({ success: false, error: 'Failed to load products.' });
  }
});

// ============================================================================
// GET /products/:id
// ============================================================================
router.get(
  '/products/:id',
  detailLimiter,
  requireBoutiqueEnabled,
  [param('id').isUUID().withMessage('Invalid product id')],
  handleValidationErrors,
  async (req, res) => {
    try {
      const product = await fetchBoutiqueProductById(req.params.id);
      if (!product) {
        return res.status(404).json({ success: false, error: 'Product not found.' });
      }
      res.set('Cache-Control', 'public, max-age=60');
      res.json({ success: true, product });
    } catch (error) {
      logger.error({ error: error.message }, 'boutique product detail error');
      res.status(500).json({ success: false, error: 'Failed to load product.' });
    }
  }
);

// ============================================================================
// GET /categories
// ============================================================================
router.get('/categories', browseLimiter, requireBoutiqueEnabled, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT DISTINCT c.id, c.name, c.description
         FROM categories c
         JOIN products p ON p.category_id = c.id
        WHERE p.brand_id = $1 AND p.status = 'active'
        ORDER BY c.name`,
      [BOUTIQUE_BRAND_ID]
    );
    res.set('Cache-Control', 'public, max-age=300');
    res.json({ success: true, categories: rows });
  } catch (error) {
    logger.error({ error: error.message }, 'boutique categories error');
    res.status(500).json({ success: false, error: 'Failed to load categories.' });
  }
});

// ============================================================================
// POST /chat
// ============================================================================
router.post(
  '/chat',
  chatLimiter,
  optionalAuth,
  requireBoutiqueEnabled,
  turnstileForAction('boutique'),
  [
    body('message').isString().trim().isLength({ min: 1, max: 2000 }).withMessage('Message must be 1–2000 characters'),
    body('sessionId').optional().isUUID().withMessage('Invalid session id'),
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const chatEnabled = await flag('boutique_chat_enabled', true);
      if (!chatEnabled) {
        return res.json({
          success: true,
          reply: 'The GoCard concierge is briefly away. Please browse the collection in the meantime.',
          sessionId: ensureSessionId(req, res),
          toolCalls: [],
          mcpConnected: false,
        });
      }

      const sessionId = req.body.sessionId || ensureSessionId(req, res);
      const result = await agentBridge.sendTurn({
        sessionId,
        message: req.body.message,
        turnstileToken: req.get('cf-turnstile-response') || req.body.turnstileToken,
        ipAddress: req.ip || null,
        companyId: BOUTIQUE_COMPANY_ID,
        userId: req.user?.id || null,
      });

      res.json({ success: true, ...result });
    } catch (error) {
      logger.error({ error: error.message }, 'boutique chat error');
      res.status(500).json({ success: false, error: 'Failed to process chat turn.' });
    }
  }
);

// ============================================================================
// POST /checkout
// ============================================================================
router.post(
  '/checkout',
  checkoutLimiter,
  optionalAuth,
  requireBoutiqueEnabled,
  turnstileForAction('boutique'),
  [
    body('amount').optional().isInt({ min: 100, max: MAX_CHECKOUT_CENTS }).withMessage(`Amount must be between 100 and ${MAX_CHECKOUT_CENTS} cents`),
    body('currency').optional().isString().isLength({ min: 3, max: 3 }),
    body('email').optional().isEmail().normalizeEmail(),
    body('sessionId').optional().isUUID(),
    body('network').optional().isIn(['visa', 'mastercard']),
    body('agentProtocol').optional().isIn(['vic', 'mc_agentpay']),
    body('cart').optional().isArray({ max: 50 }),
  ],
  handleValidationErrors,
  async (req, res) => {
    const startTime = Date.now();
    const sessionId = req.body.sessionId || ensureSessionId(req, res);

    // Idempotency: if the client supplied a valid `Idempotency-Key` header and
    // we have a cached response for (sessionId, key), return it verbatim.
    const idempotencyKey = req.get('idempotency-key');
    if (idempotencyKey && !idempotencyKeyIsValid(idempotencyKey)) {
      return res.status(400).json({
        success: false,
        error: 'Idempotency-Key must be 8–128 chars of [A-Za-z0-9_.-].',
      });
    }
    if (idempotencyKey) {
      const cached = await readIdempotentResponse(sessionId, idempotencyKey);
      if (cached) {
        return res.status(cached.statusCode || 200).json(cached.body);
      }
    }

    let resolvedEmail = req.body.email || null;
    if (!resolvedEmail && req.user?.id) {
      try {
        const u = await UsersDB.findUserById(req.user.id);
        if (u?.email) resolvedEmail = String(u.email).trim().toLowerCase();
      } catch (err) {
        logger.warn({ error: err.message }, 'boutique: user email lookup failed');
      }
    }

    let {
      amount,
      currency = 'EUR',
      network = null,
      agentProtocol = null,
      cart = [],
    } = req.body;
    const email = resolvedEmail;

    let pricedBreakdown = null;
    if (Array.isArray(cart) && cart.length > 0) {
      const priced = await priceCartFromDb(cart);
      if (!priced) {
        return res.status(400).json({
          success: false,
          error: 'Could not price cart — unknown or inactive product ids.',
        });
      }
      amount = priced.amountCents;
      pricedBreakdown = priced.breakdown;
    }

    if (!Number.isInteger(amount) || amount < 100 || amount > MAX_CHECKOUT_CENTS) {
      return res.status(400).json({
        success: false,
        error: 'Provide either `amount` (integer cents, 100–30000000) or a non-empty `cart` of active boutique products.',
      });
    }

    const logData = {
      endpoint: '/api/boutique/checkout',
      requestMethod: 'POST',
      requestBody: JSON.stringify({
        amount, currency,
        email: email ? '<redacted>' : null,
        cart, network, agentProtocol,
        authenticated: !!req.user?.id,
      }),
      requestHeaders: JSON.stringify({ 'user-agent': req.get('user-agent') || '' }),
      userId: req.user?.id || null,
      companyId: BOUTIQUE_COMPANY_ID,
      aiSessionId: sessionId,
      aiType: 'wl_mcp',
      channel: 'web',
      network,
      agentProtocol,
      processingTimeMs: 0,
      errorMessage: null,
      responseStatus: null,
      responseBody: null,
    };

    try {
      const paymentsEnabled = await flag('boutique_payments_enabled', true);
      if (!paymentsEnabled) {
        logData.responseStatus = 403;
        logData.errorMessage = 'Payments disabled by feature flag';
        logData.processingTimeMs = Date.now() - startTime;
        await PaymentLogsDB.createLog(logData);
        return res.status(403).json({ success: false, error: 'Payments are currently disabled.' });
      }

      const platform = 'gopay';
      const sdk = getSDK();
      const merchantId = getMerchantId();
      logData.platform = platform;
      logData.requestedPlatform = platform;

      const merchantCustomerId = `boutique_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

      // Worldline payment-product IDs: 1 = Visa, 3 = Mastercard.
      const restrictedProducts = [];
      const wantsVisa = network === 'visa' || agentProtocol === 'vic';
      const wantsMastercard = network === 'mastercard' || agentProtocol === 'mc_agentpay';
      if (wantsVisa) restrictedProducts.push(1);
      if (wantsMastercard) restrictedProducts.push(3);

      const wantsTokenize = agentProtocol === 'vic';

      const descriptor = agentProtocol ? `boutique_${agentProtocol}`.slice(0, 25) : 'boutique';
      // Globally unique — doesn't leak any part of sessionId and can never
      // collide with another checkout even within the same millisecond.
      const merchantReference = `boutique_${crypto.randomUUID()}`;

      const hostedCheckoutRequest = {
        order: {
          amountOfMoney: { currencyCode: currency, amount },
          references: { merchantReference, descriptor },
          customer: {
            merchantCustomerId,
            locale: 'en_GB',
            ...(email && { contactDetails: { emailAddress: email } }),
          },
        },
        cardPaymentMethodSpecificInput: {
          authorizationMode: 'FINAL_AUTHORIZATION',
          ...(wantsTokenize && { tokenize: true }),
        },
        hostedCheckoutSpecificInput: {
          returnUrl: `${frontendUrl}/boutique/return`,
          locale: 'en_GB',
          cardPaymentMethodSpecificInput: { clickToPay: true },
          ...(restrictedProducts.length > 0 && {
            paymentProductFilters: { restrictTo: { groups: [], products: restrictedProducts } },
          }),
        },
      };

      const response = await sdk.hostedCheckout.createHostedCheckout(merchantId, hostedCheckoutRequest, {});

      if (response?.isSuccess && response.body?.hostedCheckoutId) {
        logData.responseStatus = 200;
        logData.responseBody = JSON.stringify(trimHostedCheckoutResponse(response.body));
        logData.hostedCheckoutId = response.body.hostedCheckoutId;
        logData.merchantCustomerId = merchantCustomerId;
        logData.processingTimeMs = Date.now() - startTime;
        await PaymentLogsDB.createLog(logData);

        await bindCheckoutToSession(response.body.hostedCheckoutId, sessionId);

        logger.info(
          { hostedCheckoutId: response.body.hostedCheckoutId, sessionId, network, agentProtocol },
          'boutique checkout created'
        );

        const responseBody = {
          success: true,
          hostedCheckoutId: response.body.hostedCheckoutId,
          hostedCheckoutUrl: response.body.redirectUrl,
          partialRedirectUrl: response.body.partialRedirectUrl,
          returnMac: response.body.RETURNMAC,
          sessionId,
          amount,
          currency,
          ...(pricedBreakdown && { pricedBreakdown }),
          ...(agentProtocol && { agentProtocol }),
          ...(network && { network }),
        };

        if (idempotencyKey) {
          await writeIdempotentResponse(sessionId, idempotencyKey, { statusCode: 200, body: responseBody });
        }

        return res.json(responseBody);
      }

      logData.responseStatus = 400;
      logData.errorMessage = 'Invalid response from Worldline';
      logData.responseBody = null;
      logData.processingTimeMs = Date.now() - startTime;
      await PaymentLogsDB.createLog(logData);
      res.status(400).json({ success: false, error: 'Unable to start checkout.' });
    } catch (error) {
      const safe = sanitizeSdkError(error);
      logger.error({ error: safe }, 'boutique checkout error');
      logData.responseStatus = 500;
      logData.errorMessage = safe.message;
      logData.processingTimeMs = Date.now() - startTime;
      try {
        await PaymentLogsDB.createLog(logData);
      } catch (logErr) {
        console.error('[boutique] failed to log checkout failure:', sanitizeSdkError(logErr).message);
      }
      res.status(500).json({ success: false, error: 'Checkout failed.' });
    }
  }
);

// ============================================================================
// GET /payment-status/:hostedCheckoutId
// ============================================================================
router.get(
  '/payment-status/:hostedCheckoutId',
  statusLimiter,
  requireBoutiqueEnabled,
  [param('hostedCheckoutId').isString().isLength({ min: 8, max: 128 })],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { hostedCheckoutId } = req.params;
      const callerSessionId = req.cookies?.boutique_sid || null;

      // Session binding: a hosted checkout may only be polled by the session
      // that created it. If Redis has no record we fall back to allowing the
      // poll (outage / old checkout) rather than breaking genuine returns.
      const ownerSessionId = await lookupCheckoutSession(hostedCheckoutId);
      if (ownerSessionId && callerSessionId && ownerSessionId !== callerSessionId) {
        logger.info(
          { hostedCheckoutId, ip: req.ip },
          'boutique payment-status: session mismatch rejected'
        );
        return res.status(403).json({ success: false, error: 'Not authorised to view this payment.' });
      }

      const sdk = getSDK();
      const merchantId = getMerchantId();

      const response = await sdk.hostedCheckout.getHostedCheckout(merchantId, hostedCheckoutId, {});
      const body = response?.body || {};

      try {
        const createdPaymentOutput = body.createdPaymentOutput;
        if (createdPaymentOutput?.payment) {
          const p = createdPaymentOutput.payment;
          const output = p.paymentOutput || {};
          await PaymentLogsDB.updatePaymentStatus({
            hostedCheckoutId,
            worldlinePaymentId: p.id,
            paymentStatus: p.status,
            paymentStatusCode: p.statusOutput?.statusCode,
            paymentStatusCategory: p.statusOutput?.statusCategory,
            authorizationCode: output.cardPaymentMethodSpecificOutput?.authorisationCode,
            cardNumberMasked: output.cardPaymentMethodSpecificOutput?.card?.cardNumber,
            cardBrand: output.cardPaymentMethodSpecificOutput?.paymentProductId
              ? String(output.cardPaymentMethodSpecificOutput.paymentProductId)
              : null,
            amountCents: output.amountOfMoney?.amount,
            currency: output.amountOfMoney?.currencyCode,
          });
        }
      } catch (syncErr) {
        logger.warn({ error: sanitizeSdkError(syncErr).message, hostedCheckoutId }, 'boutique payment status sync failed');
      }

      res.json({ success: true, status: body.status || 'UNKNOWN', payload: body });
    } catch (error) {
      logger.error({ error: sanitizeSdkError(error).message }, 'boutique payment-status error');
      res.status(500).json({ success: false, error: 'Failed to fetch payment status.' });
    }
  }
);

module.exports = router;
