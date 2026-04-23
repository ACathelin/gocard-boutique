/**
 * Rate limiters for the public /api/boutique/* surface.
 * Redis-backed via createRedisRateLimitStore (falls back to in-memory store).
 *
 * Browse endpoints fail OPEN on Redis outage — a short outage is better than a
 * site-wide 5xx. Write endpoints (/chat, /checkout) fail CLOSED — cost runaway
 * during a Redis blip is worse than a temporary 429.
 */

const rateLimit = require('express-rate-limit');
const { createRedisRateLimitStore, createRateLimitKeyGenerator } = require('../lib/rateLimitStore');

const keyGenerator = createRateLimitKeyGenerator(true); // include UA hash

function tooMany(message) {
  return (req, res /* , next, options */) =>
    res.status(429).json({ success: false, error: message });
}

const browseLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  store: createRedisRateLimitStore('boutique-browse', { onRedisDown: 'open' }),
  handler: tooMany('Too many requests. Please slow down.'),
});

const detailLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 180,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  store: createRedisRateLimitStore('boutique-browse-detail', { onRedisDown: 'open' }),
  handler: tooMany('Too many requests. Please slow down.'),
});

const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  store: createRedisRateLimitStore('boutique-chat', { onRedisDown: 'closed' }),
  handler: tooMany('Chat is rate-limited. Please wait a moment.'),
});

const checkoutLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  store: createRedisRateLimitStore('boutique-checkout', { onRedisDown: 'closed' }),
  handler: tooMany('Too many checkout attempts. Please wait a minute.'),
});

const statusLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  store: createRedisRateLimitStore('boutique-status', { onRedisDown: 'open' }),
  handler: tooMany('Too many status checks. Please slow down.'),
});

module.exports = {
  browseLimiter,
  detailLimiter,
  chatLimiter,
  checkoutLimiter,
  statusLimiter,
};
