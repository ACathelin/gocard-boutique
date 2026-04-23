const { pool } = require('./index');
const { dbLogger: logger } = require('../config/logger');

class PaymentLogsDB {
  static async createLog(logData) {
    const {
      endpoint,
      requestMethod,
      requestBody,
      requestHeaders,
      responseStatus,
      responseBody,
      responseHeaders,
      errorMessage,
      processingTimeMs,
      userId,
      merchantCustomerId,
      hostedCheckoutId,
      companyId,
      aiSessionId,
      aiType,
      platform,
      requestedPlatform,
      channel,
      network,
      agentProtocol
    } = logData;

    let finalCompanyId = companyId;
    if (!finalCompanyId && userId) {
      const userRes = await pool.query('SELECT company_id FROM users WHERE id = $1', [userId]);
      if (userRes.rows.length > 0) finalCompanyId = userRes.rows[0].company_id;
    }

    const { rows } = await pool.query(
      `INSERT INTO payment_logs (
        endpoint, request_method, request_body, request_headers,
        response_status, response_body, response_headers, error_message,
        processing_time_ms, user_id, merchant_customer_id, hosted_checkout_id, company_id,
        ai_session_id, ai_type, platform, requested_platform, channel,
        network, agent_protocol
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
      RETURNING id, created_at, platform, requested_platform, channel`,
      [
        endpoint, requestMethod, requestBody, requestHeaders,
        responseStatus, responseBody, responseHeaders, errorMessage,
        processingTimeMs, userId, merchantCustomerId, hostedCheckoutId, finalCompanyId,
        aiSessionId || null, aiType || null, platform || null, requestedPlatform || null,
        channel || 'web',
        network || null, agentProtocol || null
      ]
    );

    return rows[0];
  }

  static async updatePaymentStatus(options) {
    const {
      id,
      hostedCheckoutId,
      worldlinePaymentId,
      paymentStatus,
      paymentStatusCode,
      paymentStatusCategory,
      authorizationCode,
      cardNumberMasked,
      cardExpiryDate,
      cardBrand,
      amountCents,
      currency,
      aiSessionId,
      aiType
    } = options;

    if (!id && !hostedCheckoutId) {
      throw new Error('Either id or hostedCheckoutId is required to update payment status');
    }

    const whereClause = id ? 'id = $1' : 'hosted_checkout_id = $1';
    const identifier = id || hostedCheckoutId;

    const { rows } = await pool.query(
      `UPDATE payment_logs SET
        worldline_payment_id    = COALESCE($2,  worldline_payment_id),
        payment_status          = COALESCE($3,  payment_status),
        payment_status_code     = COALESCE($4,  payment_status_code),
        payment_status_category = COALESCE($5,  payment_status_category),
        authorization_code      = COALESCE($6,  authorization_code),
        card_number_masked      = COALESCE($7,  card_number_masked),
        card_expiry_date        = COALESCE($8,  card_expiry_date),
        card_brand              = COALESCE($9,  card_brand),
        amount_cents            = COALESCE($10, amount_cents),
        currency                = COALESCE($11, currency),
        ai_session_id           = COALESCE($12, ai_session_id),
        ai_type                 = COALESCE($13, ai_type),
        status_updated_at       = NOW(),
        updated_at              = NOW()
      WHERE ${whereClause}
      RETURNING id, payment_status, status_updated_at`,
      [
        identifier,
        worldlinePaymentId,
        paymentStatus,
        paymentStatusCode,
        paymentStatusCategory,
        authorizationCode,
        cardNumberMasked,
        cardExpiryDate,
        cardBrand,
        amountCents,
        currency,
        aiSessionId,
        aiType
      ]
    );
    return rows;
  }

  static async getByHostedCheckoutId(hostedCheckoutId) {
    const { rows } = await pool.query(
      `SELECT pl.*, c.name AS company_name, c.display_name AS company_display_name
       FROM payment_logs pl
       LEFT JOIN companies c ON pl.company_id = c.id
       WHERE pl.hosted_checkout_id = $1
       ORDER BY pl.created_at DESC
       LIMIT 1`,
      [hostedCheckoutId]
    );
    return rows[0] || null;
  }
}

module.exports = PaymentLogsDB;
