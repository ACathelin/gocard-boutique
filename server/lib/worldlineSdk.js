/**
 * Worldline GoPay Direct SDK wrapper.
 *
 * Lazily initialises a singleton SDK instance using the onlinepayments-sdk-nodejs
 * library (the "Direct" API). Global Collect / Connect SDK support lived in the
 * source repo; it's intentionally omitted here — GoCard only ships GoPay.
 */

const onlinePaymentsSdk = require('onlinepayments-sdk-nodejs');
const { logger } = require('../config/logger');

const PLATFORMS = { GOPAY: 'gopay' };

const GOPAY_DEFAULT_HOST = 'payment.preprod.direct.worldline-solutions.com';

const GOPAY_CONFIG = {
  merchantId: process.env.WORLDLINE_MERCHANT_ID,
  apiKey: process.env.WORLDLINE_API_KEY,
  secretApiKey: process.env.WORLDLINE_SECRET_KEY,
  host: process.env.WORLDLINE_HOST || GOPAY_DEFAULT_HOST,
  environment: process.env.WORLDLINE_ENVIRONMENT || 'test'
};

let sdkInstance = null;

function isConfigured() {
  return Boolean(GOPAY_CONFIG.merchantId && GOPAY_CONFIG.apiKey && GOPAY_CONFIG.secretApiKey);
}

function getSDK() {
  if (!isConfigured()) {
    logger.error('Worldline SDK not configured - missing WORLDLINE_MERCHANT_ID / WORLDLINE_API_KEY / WORLDLINE_SECRET_KEY');
    throw new Error('Worldline SDK not configured');
  }
  if (!sdkInstance) {
    sdkInstance = onlinePaymentsSdk.init({
      integrator: 'gocard-boutique',
      host: GOPAY_CONFIG.host,
      scheme: 'https',
      port: 443,
      enableLogging: false,
      apiKeyId: GOPAY_CONFIG.apiKey,
      secretApiKey: GOPAY_CONFIG.secretApiKey
    });
    logger.info({ host: GOPAY_CONFIG.host }, 'Worldline GoPay Direct SDK initialised');
  }
  return sdkInstance;
}

function getMerchantId() {
  return GOPAY_CONFIG.merchantId;
}

function getConfig() {
  return {
    merchantId: GOPAY_CONFIG.merchantId,
    apiKey: GOPAY_CONFIG.apiKey,
    host: GOPAY_CONFIG.host,
    environment: GOPAY_CONFIG.environment,
    isConfigured: isConfigured(),
    platform: PLATFORMS.GOPAY
  };
}

module.exports = {
  getSDK,
  getMerchantId,
  getConfig,
  isConfigured,
  PLATFORMS,
  WORLDLINE_CONFIG: GOPAY_CONFIG
};
