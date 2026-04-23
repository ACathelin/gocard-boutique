/**
 * Worldline webhook receiver.
 *
 * Verifies the `X-GCS-Signature` HMAC-SHA256 using the SDK's signature
 * validator, then updates `payment_logs` with the authoritative payment
 * state. This is the only push channel for payment results — the client-side
 * poll at `/api/boutique/payment-status/:id` is a fallback.
 *
 * Configuration (env):
 *   - WORLDLINE_WEBHOOK_SECRET   — HMAC secret issued by Worldline
 *   - WORLDLINE_WEBHOOK_KEY_ID   — Key ID issued alongside the secret
 *
 * Mounted before `express.json()` so the body is a raw Buffer (required for
 * signature verification).
 */

'use strict';

const express = require('express');
const onlinePaymentsSdk = require('onlinepayments-sdk-nodejs');
const { logger } = require('../config/logger');
const PaymentLogsDB = require('../db/paymentLogs');

const router = express.Router();

let webhookHelper = null;

function getWebhookHelper() {
  if (webhookHelper) return webhookHelper;
  const keyId = process.env.WORLDLINE_WEBHOOK_KEY_ID;
  const secret = process.env.WORLDLINE_WEBHOOK_SECRET;
  if (!keyId || !secret) return null;
  webhookHelper = onlinePaymentsSdk.webhooks.init({
    getSecretKey: async (incomingKeyId) => {
      if (incomingKeyId !== keyId) {
        throw new Error(`Unknown webhook key id: ${String(incomingKeyId).slice(0, 40)}`);
      }
      return secret;
    },
  });
  return webhookHelper;
}

router.post('/', express.raw({ type: '*/*', limit: '100kb' }), async (req, res) => {
  const helper = getWebhookHelper();
  if (!helper) {
    logger.warn('Worldline webhook received but WORLDLINE_WEBHOOK_SECRET/KEY_ID not set');
    return res.status(503).json({ success: false, error: 'Webhook not configured.' });
  }

  let event;
  try {
    event = await helper.unmarshal(req.body, req.headers);
  } catch (err) {
    logger.warn({ error: err.message, ip: req.ip }, 'Worldline webhook signature verification failed');
    return res.status(400).json({ success: false, error: 'Invalid signature.' });
  }

  try {
    const payment = event?.payment;
    if (payment) {
      const output = payment.paymentOutput || {};
      const hostedCheckoutId =
        output.references?.hostedCheckoutId ||
        payment.hostedCheckoutSpecificOutput?.hostedCheckoutId ||
        null;

      if (hostedCheckoutId) {
        await PaymentLogsDB.updatePaymentStatus({
          hostedCheckoutId,
          worldlinePaymentId: payment.id,
          paymentStatus: payment.status,
          paymentStatusCode: payment.statusOutput?.statusCode,
          paymentStatusCategory: payment.statusOutput?.statusCategory,
          authorizationCode: output.cardPaymentMethodSpecificOutput?.authorisationCode,
          cardNumberMasked: output.cardPaymentMethodSpecificOutput?.card?.cardNumber,
          cardBrand: output.cardPaymentMethodSpecificOutput?.paymentProductId
            ? String(output.cardPaymentMethodSpecificOutput.paymentProductId)
            : null,
          amountCents: output.amountOfMoney?.amount,
          currency: output.amountOfMoney?.currencyCode,
        });
        logger.info(
          { eventId: event.id, type: event.type, hostedCheckoutId, status: payment.status },
          'Worldline webhook applied'
        );
      } else {
        logger.info({ eventId: event.id, type: event.type }, 'Worldline webhook: no hostedCheckoutId on payment');
      }
    } else {
      // Refunds, payouts, tokens — logged but not yet handled.
      logger.info({ eventId: event.id, type: event.type }, 'Worldline webhook: non-payment event ignored');
    }
  } catch (err) {
    logger.error({ error: err.message, eventId: event?.id }, 'Worldline webhook handler error');
    // Return 500 so Worldline retries. Never leak internal details.
    return res.status(500).json({ success: false, error: 'Internal error.' });
  }

  // Worldline expects a 200 on successful receipt; any other response triggers retry.
  res.status(200).json({ success: true });
});

module.exports = router;
