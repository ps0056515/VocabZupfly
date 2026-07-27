/**
 * VocabZupfly Server Configuration
 * Reads from environment variables with sensible dev defaults.
 */
const crypto = require('crypto');

module.exports = {
  PORT: parseInt(process.env.PORT || process.env.DEV_PORT || '3456', 10),

  /** MongoDB connection string */
  MONGO_URI: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/vocabzupfly',

  /** JWT secrets — MUST override in production */
  JWT_SECRET: process.env.JWT_SECRET || 'vz-dev-jwt-secret-' + crypto.randomBytes(8).toString('hex'),
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'vz-dev-refresh-secret-' + crypto.randomBytes(8).toString('hex'),

  /** Token expiration */
  ACCESS_TOKEN_EXPIRY: '15d',
  REFRESH_TOKEN_EXPIRY: '16d',

  /** Cookie settings */
  COOKIE_SECURE: process.env.NODE_ENV === 'production',
  COOKIE_SAME_SITE: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
  COOKIE_DOMAIN: process.env.COOKIE_DOMAIN || undefined,

  /** Default super admin (used by seed script) */
  SUPER_ADMIN_EMAIL: process.env.SUPER_ADMIN_EMAIL || '1999rkgupta@gmail.com',
  SUPER_ADMIN_PASSWORD: process.env.SUPER_ADMIN_PASSWORD || 'Password@123',
  SUPER_ADMIN_NAME: 'Super Admin',

  /** Default org */
  DEFAULT_ORG_NAME: 'Panimalar',
  DEFAULT_ORG_EMAIL: 'admin@panimalar.edu.in',
  DEFAULT_ORG_ADDRESS: 'Panimalar, Chennai',

  /** Default student password */
  DEFAULT_STUDENT_PASSWORD: 'Test@123',
};
