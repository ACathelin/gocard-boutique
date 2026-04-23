/**
 * agentBridge — single seam between the public /boutique chat endpoint and a
 * future Worldline GoPay Direct MCP server.
 *
 * Today: records the inbound message in ai_conversation_logs, delegates to
 * `boutiqueAssistantService.runTurn()`, returns a normalised response shape.
 *
 * Tomorrow: when a real MCP server ships, this is the ONLY file that changes.
 * The signature below is stable — routes, frontend, and admin tooling already
 * depend on this shape.
 *
 *   sendTurn({ sessionId, message, turnstileToken, ipAddress, companyId })
 *     -> { reply, sessionId, toolCalls: [], cartDelta?, paymentRedirectUrl?, mcpConnected: false }
 */

const { pool } = require('../db');
const { logger } = require('../config/logger');
const boutiqueAssistantService = require('./boutiqueAssistantService');

const MCP_SERVER_ID = 'wl-gopay-direct';
const BOUTIQUE_COMPANY_ID = 'f0000000-0000-4000-8000-0000000000b0';
const PLACEHOLDER_REPLY =
  "The concierge is taking a short break. You can still browse the shop — I'll be back in a moment.";

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

async function recordMessage({ sessionId, role, content, companyId, userId = null }) {
  try {
    await pool.query(
      `INSERT INTO ai_conversation_logs (
        session_id, ai_type, user_id, company_id, role, content, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [sessionId, 'wl_mcp', userId, companyId, role, content]
    );
  } catch (err) {
    logger.warn({ error: err.message, sessionId }, '[agentBridge] failed to record conversation message');
  }
}

async function sendTurn({
  sessionId,
  message,
  turnstileToken: _turnstileToken,
  ipAddress = null,
  companyId = BOUTIQUE_COMPANY_ID,
  userId = null,
}) {
  if (!sessionId || !isUuid(sessionId)) {
    throw new Error('sendTurn requires a valid UUID sessionId');
  }
  if (!message || typeof message !== 'string') {
    throw new Error('sendTurn requires a non-empty message');
  }

  await recordMessage({
    sessionId,
    role: 'user',
    content: message.slice(0, 4000),
    companyId,
    userId,
  });

  let reply = PLACEHOLDER_REPLY;
  let recommendedProductIds = [];
  try {
    const turn = await boutiqueAssistantService.runTurn({ sessionId, message, ipAddress });
    reply = turn.reply || PLACEHOLDER_REPLY;
    recommendedProductIds = turn.recommendedProductIds || [];
  } catch (err) {
    logger.warn({ error: err.message, sessionId }, '[agentBridge] assistant turn failed');
  }

  await recordMessage({
    sessionId,
    role: 'assistant',
    content: reply,
    companyId,
    userId,
  });

  return {
    reply,
    sessionId,
    toolCalls: [],
    cartDelta: null,
    paymentRedirectUrl: null,
    recommendedProductIds,
    mcpConnected: false,
  };
}

function getStatus() {
  return {
    mcpServer: MCP_SERVER_ID,
    mcpConnected: false,
    placeholderReply: PLACEHOLDER_REPLY,
  };
}

module.exports = {
  sendTurn,
  getStatus,
  __internals: { recordMessage, MCP_SERVER_ID, BOUTIQUE_COMPANY_ID, PLACEHOLDER_REPLY },
};
