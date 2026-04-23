/**
 * boutiqueAssistantService — the small Claude-powered concierge behind the
 * /boutique chat panel. Fetches the GoCard collection, asks Claude for a
 * warm editorial recommendation, returns reply + product ids the member
 * might like.
 *
 * This is the code called by `server/services/agentBridge.js` TODAY. When the
 * Worldline GoPay Direct MCP ships, `agentBridge` swaps this for the MCP
 * client; this service can stay around as a local-only fallback if desired.
 *
 * Public-page safeguards (real cost risk otherwise):
 *   - per-session cap: 20 turns / hour / sessionId (Redis-tracked)
 *   - per-IP     cap: 50 turns / hour / ip       (Redis-tracked)
 *   - hard token caps via SDK: max_tokens = 400
 *   - graceful fallback: missing ANTHROPIC_API_KEY or any SDK error returns a
 *     friendly placeholder rather than propagating the failure
 */

const Anthropic = require('@anthropic-ai/sdk');
const { logger } = require('../config/logger');
const { getRedis, isRedisConnected } = require('../lib/redisClient');
const CatalogDB = require('../db/catalog');

const OCTOBRE_BRAND_ID = 'b0000000-0000-4000-8000-0000000000b0';
const MODEL = 'claude-3-5-haiku-latest';
const MAX_OUTPUT_TOKENS = 400;
const CATALOG_CACHE_TTL_MS = 60 * 1000;
const SESSION_TURN_CAP = 20;
const IP_TURN_CAP = 50;
const TURN_WINDOW_SECONDS = 60 * 60; // 1 hour

const FALLBACK_REPLY =
  "The concierge is taking a short break. You can still browse the collection — I'll be back in a moment.";

const JAILBREAK_PATTERNS = [
  /ignore (?:all )?previous instructions/i,
  /disregard the system prompt/i,
  /reveal your (?:system )?prompt/i,
  /you are now/i,
  /jailbreak/i,
];

// Lazy-init so tests can mock `@anthropic-ai/sdk` before first use.
let anthropicClient = null;
function getAnthropic() {
  if (anthropicClient) return anthropicClient;
  if (!process.env.ANTHROPIC_API_KEY) return null;
  anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return anthropicClient;
}

// In-process memo for the catalog so a bunch of quick turns don't pound Postgres.
let catalogCache = { data: null, fetchedAt: 0 };

async function getBoutiqueCatalog() {
  const now = Date.now();
  if (catalogCache.data && now - catalogCache.fetchedAt < CATALOG_CACHE_TTL_MS) {
    return catalogCache.data;
  }
  try {
    const products = await CatalogDB.searchProducts({ brand_id: OCTOBRE_BRAND_ID });
    catalogCache = { data: products || [], fetchedAt: now };
    return catalogCache.data;
  } catch (err) {
    logger.warn({ error: err.message }, '[boutiqueAssistant] catalog fetch failed');
    return catalogCache.data || [];
  }
}

function formatProductForPrompt(p) {
  const price =
    typeof p.price_cents === 'number' ? `€${(p.price_cents / 100).toFixed(0)}` : '—';
  const desc = (p.description || '').replace(/\s+/g, ' ').trim();
  const stockNote = p.stock_quantity === 0 ? ' [out of stock]' : '';
  return `- id=${p.id} · ${p.name} · ${price} · ${p.category_name || ''}${stockNote}\n  ${desc}`;
}

function buildSystemPrompt(products) {
  const catalogBlock = products.map(formatProductForPrompt).join('\n');
  return `You are the personal concierge for GoCard, a private lifestyle membership. Members pay an annual fee and, in return, you help them arrange exclusive experiences, private dining, travel, and one-off events from the collection below.

Voice: warm, direct, editorial. Short sentences. No marketing clichés. Prices in euros. Discreet by default — attention to detail matters, so do names, dates, small logistics.

The annual membership is €500 and unlocks the right to book every other item in the collection for twelve months. Individual experiences are priced separately and have finite seats. Members can hold a seat by adding it to their order and completing checkout; the concierge follows up by email with travel arrangements, dress code, and meeting points when relevant.

If the member asks about anything outside the current collection (bespoke trips, a chef not listed, a race we don't yet cover), say we can often arrange it on request, then pivot to the closest listed privilege.

Never invent items. Only recommend from the catalog below, and only by the exact id shown.

When you recommend specific items, END YOUR REPLY with a single line of the form:
RECOMMEND: ["<id1>", "<id2>", ...]
Use between 0 and 3 ids. If you are not recommending anything yet (e.g. you asked a clarifying question), omit the line entirely.

Collection (${products.length} items):
${catalogBlock}`;
}

function parseRecommendations(raw) {
  if (!raw || typeof raw !== 'string') return { text: raw || '', ids: [] };
  const match = raw.match(/RECOMMEND:\s*(\[[^\]]*\])\s*$/m);
  if (!match) return { text: raw.trim(), ids: [] };

  let ids = [];
  try {
    const parsed = JSON.parse(match[1]);
    if (Array.isArray(parsed)) {
      ids = parsed.filter((v) => typeof v === 'string').slice(0, 3);
    }
  } catch (err) {
    logger.warn({ error: err.message, fragment: match[1] }, '[boutiqueAssistant] RECOMMEND parse failed');
  }
  const text = raw.slice(0, match.index).trim();
  return { text, ids };
}

function containsJailbreak(message) {
  return JAILBREAK_PATTERNS.some((re) => re.test(message));
}

async function consumeTurnQuota(sessionId, ipAddress) {
  const redis = isRedisConnected() ? getRedis() : null;
  if (!redis) return { allowed: true, reason: null };

  const sessionKey = `boutique:assistant:session:${sessionId}`;
  const ipKey = ipAddress ? `boutique:assistant:ip:${ipAddress}` : null;

  try {
    const sessionCount = await redis.incr(sessionKey);
    if (sessionCount === 1) await redis.expire(sessionKey, TURN_WINDOW_SECONDS);
    if (sessionCount > SESSION_TURN_CAP) {
      return { allowed: false, reason: 'session_cap' };
    }

    if (ipKey) {
      const ipCount = await redis.incr(ipKey);
      if (ipCount === 1) await redis.expire(ipKey, TURN_WINDOW_SECONDS);
      if (ipCount > IP_TURN_CAP) {
        return { allowed: false, reason: 'ip_cap' };
      }
    }
  } catch (err) {
    logger.warn({ error: err.message }, '[boutiqueAssistant] quota check failed — allowing request');
    return { allowed: true, reason: null };
  }
  return { allowed: true, reason: null };
}

/**
 * Run a single assistant turn.
 * @param {Object} opts
 * @param {string} opts.sessionId  — stable UUID for this visitor's session
 * @param {string} opts.message    — user message (already validated at the route)
 * @param {string} [opts.ipAddress]
 * @returns {Promise<{reply: string, recommendedProductIds: string[], usage: Object|null}>}
 */
async function runTurn({ sessionId, message, ipAddress }) {
  if (!message || !message.trim()) {
    return { reply: 'Tell me what you are looking for and I can help.', recommendedProductIds: [], usage: null };
  }

  if (containsJailbreak(message)) {
    return {
      reply:
        "Let's keep it about the GoCard collection — membership, experiences, dining, travel. How can I help?",
      recommendedProductIds: [],
      usage: null,
    };
  }

  const quota = await consumeTurnQuota(sessionId, ipAddress);
  if (!quota.allowed) {
    return {
      reply:
        "We've spoken at length — let's pause for a moment. Please come back in an hour, or continue browsing the collection in the meantime.",
      recommendedProductIds: [],
      usage: null,
    };
  }

  const anthropic = getAnthropic();
  if (!anthropic) {
    return { reply: FALLBACK_REPLY, recommendedProductIds: [], usage: null };
  }

  const products = await getBoutiqueCatalog();
  const systemPrompt = buildSystemPrompt(products);

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_OUTPUT_TOKENS,
      // Mark the system prompt as cacheable — the catalog block rarely changes
      // within a 5-minute window, so Anthropic's prompt caching cuts token
      // cost and latency for back-to-back turns.
      system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: message.slice(0, 2000) }],
    });

    const rawText = (response?.content || [])
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('\n')
      .trim();

    const { text, ids } = parseRecommendations(rawText);

    // Filter recommendations to catalog items only — never leak invented ids.
    const validIds = new Set(products.map((p) => p.id));
    const recommendedProductIds = ids.filter((id) => validIds.has(id));

    return {
      reply: text || FALLBACK_REPLY,
      recommendedProductIds,
      usage: response?.usage || null,
    };
  } catch (err) {
    logger.warn({ error: err.message }, '[boutiqueAssistant] Anthropic call failed');
    return { reply: FALLBACK_REPLY, recommendedProductIds: [], usage: null };
  }
}

module.exports = {
  runTurn,
  // Exported for tests only.
  __internals: {
    parseRecommendations,
    containsJailbreak,
    formatProductForPrompt,
    buildSystemPrompt,
    FALLBACK_REPLY,
    SESSION_TURN_CAP,
    IP_TURN_CAP,
    OCTOBRE_BRAND_ID,
  },
};
