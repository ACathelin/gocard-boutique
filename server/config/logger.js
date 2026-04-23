const pino = require('pino');

const isDevelopment = process.env.NODE_ENV !== 'production';

const baseConfig = {
  level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),

  redact: {
    paths: [
      'password',
      'token',
      'authorization',
      'cookie',
      'secret',
      'apiKey',
      'api_key',
      'cardNumber',
      'card_number',
      'cvv',
      'cvc',
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers["set-cookie"]',
      '*.password',
      '*.token',
      '*.secret',
      '*.apiKey',
      '*.api_key'
    ],
    remove: true
  },

  serializers: {
    req: (req) => ({
      id: req.id,
      method: req.method,
      url: req.url,
      path: req.path,
      query: req.query,
      params: req.params,
      headers: {
        host: req.headers?.host,
        'user-agent': req.headers?.['user-agent'],
        'content-type': req.headers?.['content-type']
      },
      remoteAddress: req.ip || req.connection?.remoteAddress
    }),
    res: (res) => ({
      statusCode: res.statusCode
    }),
    err: pino.stdSerializers.err
  },

  base: {
    pid: process.pid,
    hostname: process.env.HOSTNAME || require('os').hostname(),
    environment: process.env.NODE_ENV || 'development',
    service: 'gocard-boutique'
  },

  timestamp: () => `,"time":"${new Date().toISOString()}"`
};

const developmentConfig = {
  ...baseConfig,
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss Z',
      ignore: 'pid,hostname',
      singleLine: false
    }
  }
};

const logger = isDevelopment ? pino(developmentConfig) : pino(baseConfig);
const dbLogger = logger;

function createChildLogger(bindings) {
  return logger.child(bindings);
}

function attachLogger(req, res, next) {
  req.log = logger.child({ requestId: req.id, userId: req.user?.id });
  next();
}

module.exports = { logger, dbLogger, createChildLogger, attachLogger };
