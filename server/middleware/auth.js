const jwt = require('jsonwebtoken');
const { logger } = require('../config/logger');

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = (authHeader && authHeader.split(' ')[1]) || req.cookies?.jwt;

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    return res.status(401).json({ error: 'Auth disabled — JWT_SECRET not configured' });
  }

  jwt.verify(token, jwtSecret, { algorithms: ['HS256'] }, (err, decoded) => {
    if (err) {
      logger.debug({ error: err.message }, 'Token verification failed');
      return res.status(401).json({ error: 'Invalid token' });
    }
    req.user = decoded;
    next();
  });
};

module.exports = { authenticateToken };
