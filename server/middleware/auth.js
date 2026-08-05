/**
 * Authentication middleware — JWT access token + refresh token.
 * Reads the access token from httpOnly cookie 'vz_access_token'.
 */
const jwt = require('jsonwebtoken');
const config = require('../config');
const User = require('../models/User');

/**
 * Verify access token from cookie.
 * Attaches req.user = { id, email, role, orgId } on success.
 */
function authenticate(req, res, next) {
  var token = req.cookies && req.cookies.vz_access_token;
  if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }
  if (!token) {
    return res.status(401).json({ error: 'Authentication required. Please log in.' });
  }

  try {
    var decoded = jwt.verify(token, config.JWT_SECRET);
    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
      orgId: decoded.orgId,
    };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Session expired. Please refresh your token.', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ error: 'Invalid token. Please log in again.' });
  }
}

/**
 * Role-based access control middleware factory.
 * Usage: requireRole('admin', 'super_admin')
 */
function requireRole(/* ...roles */) {
  var roles = Array.prototype.slice.call(arguments);
  return function (req, res, next) {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    if (roles.indexOf(req.user.role) === -1) {
      return res.status(403).json({ error: 'Access denied. Insufficient permissions.' });
    }
    next();
  };
}

/**
 * Optional auth — doesn't fail if no token, but attaches user if valid.
 * Used for routes that work for both authenticated and unauthenticated users.
 */
function optionalAuth(req, res, next) {
  var token = req.cookies && req.cookies.vz_access_token;
  if (!token) return next();

  try {
    var decoded = jwt.verify(token, config.JWT_SECRET);
    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
      orgId: decoded.orgId,
    };
  } catch (err) {
    // Token invalid — treat as unauthenticated, don't fail
  }
  next();
}

module.exports = { authenticate, requireRole, optionalAuth };
