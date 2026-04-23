const jwt = require('jsonwebtoken');
const { logger } = require('../config/logger');

// Generic message used for every 401 from this middleware — never reveal
// whether the secret is configured vs the token is malformed vs expired.
const GENERIC_401 = { error: 'Invalid or missing token' };

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = (authHeader && authHeader.split(' ')[1]) || req.cookies?.jwt;

  if (!token) {
    return res.status(401).json(GENERIC_401);
  }

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    logger.warn('JWT_SECRET not configured — rejecting bearer auth');
    return res.status(401).json(GENERIC_401);
  }

  jwt.verify(token, jwtSecret, { algorithms: ['HS256'] }, (err, decoded) => {
    if (err) {
      logger.debug({ error: err.message }, 'Token verification failed');
      return res.status(401).json(GENERIC_401);
    }
    req.user = decoded;
    next();
  });
};

module.exports = { authenticateToken };
