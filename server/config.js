/**
 * VocabZupfly Server Configuration
 * Reads from environment variables with sensible dev defaults.
 */
const crypto = require('crypto');

function sanitizeMongoUri(raw) {
  if (!raw || typeof raw !== 'string') {
    return 'mongodb://127.0.0.1:27017/vocabzupfly';
  }
  var clean = raw.trim().replace(/^["']+|["']+$/g, '').trim();
  if (!clean) {
    return 'mongodb://127.0.0.1:27017/vocabzupfly';
  }
  if (!clean.startsWith('mongodb://') && !clean.startsWith('mongodb+srv://')) {
    clean = 'mongodb://' + clean;
  }
  return clean;
}

module.exports = {
  PORT: parseInt(process.env.PORT || process.env.DEV_PORT || '3456', 10),

  /** MongoDB connection string */
  MONGO_URI: sanitizeMongoUri(process.env.MONGO_URI),

  /** JWT secrets — static fallback to preserve sessions across restarts */
  JWT_SECRET: process.env.JWT_SECRET || 'vz-auth-secret-key-vocabzupfly-2026',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'vz-refresh-secret-key-vocabzupfly-2026',

  /** Token expiration */
  ACCESS_TOKEN_EXPIRY: '7d',
  REFRESH_TOKEN_EXPIRY: '16d',

  /** Cookie settings (COOKIE_SECURE only if explicitly enabled or on HTTPS) */
  COOKIE_SECURE: process.env.COOKIE_SECURE === 'true',
  COOKIE_SAME_SITE: process.env.COOKIE_SAME_SITE || 'lax',
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
