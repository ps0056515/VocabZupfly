/**
 * Auth routes — login, logout, me, refresh-token, change-password.
 */
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const config = require('../config');
const User = require('../models/User');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

/** Cookie options for access token (15 days) */
function accessCookieOpts() {
  return {
    httpOnly: true,
    secure: config.COOKIE_SECURE,
    sameSite: config.COOKIE_SAME_SITE,
    domain: config.COOKIE_DOMAIN,
    maxAge: 15 * 24 * 60 * 60 * 1000, // 15 days
    path: '/',
  };
}

/** Cookie options for refresh token (16 days) */
function refreshCookieOpts() {
  return {
    httpOnly: true,
    secure: config.COOKIE_SECURE,
    sameSite: config.COOKIE_SAME_SITE,
    domain: config.COOKIE_DOMAIN,
    maxAge: 16 * 24 * 60 * 60 * 1000, // 16 days
    path: '/',
  };
}

/** Generate access token (short-lived) */
function generateAccessToken(user) {
  return jwt.sign(
    { id: user._id, email: user.email, role: user.role, orgId: user.orgId },
    config.JWT_SECRET,
    { expiresIn: config.ACCESS_TOKEN_EXPIRY }
  );
}

/** Generate refresh token (long-lived) */
function generateRefreshToken(user) {
  return jwt.sign(
    { id: user._id, email: user.email, role: user.role, orgId: user.orgId },
    config.JWT_REFRESH_SECRET,
    { expiresIn: config.REFRESH_TOKEN_EXPIRY }
  );
}

/**
 * POST /api/auth/login
 * Body: { email, password }
 */
router.post('/login', async function (req, res) {
  try {
    var email = (req.body.email || '').trim().toLowerCase();
    var password = req.body.password || '';

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    var user = await User.findOne({ email: email }).select('+password');
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    var isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    if (!user.isActive) {
      return res.status(403).json({ error: 'Your account is inactive. Please contact your administrator.' });
    }

    // Generate tokens
    var accessToken = generateAccessToken(user);
    var refreshToken = generateRefreshToken(user);

    // Store hashed refresh token in DB
    var hashedRefresh = await bcrypt.hash(refreshToken, 10);
    await User.findByIdAndUpdate(user._id, {
      refreshToken: hashedRefresh,
      lastLogin: new Date(),
    });

    // Set cookies
    res.cookie('vz_access_token', accessToken, accessCookieOpts());
    res.cookie('vz_refresh_token', refreshToken, refreshCookieOpts());

    // Populate org info
    var userObj = user.toSafeObject();
    if (user.orgId) {
      var Organization = require('../models/Organization');
      var org = await Organization.findById(user.orgId);
      if (org) userObj.org = { _id: org._id, name: org.name };
    }

    res.json({
      ok: true,
      user: userObj,
    });
  } catch (err) {
    console.error('[Auth] Login error:', err);
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

/**
 * POST /api/auth/logout
 */
router.post('/logout', async function (req, res) {
  try {
    const token = req.cookies && req.cookies.vz_access_token;
    if (token) {
      try {
        const decoded = jwt.verify(token, config.jwtSecret);
        if (decoded && decoded.id) {
          await User.findByIdAndUpdate(decoded.id, { refreshToken: null });
        }
      } catch (e) {}
    }

    res.clearCookie('vz_access_token', { path: '/' });
    res.clearCookie('vz_refresh_token', { path: '/' });

    res.json({ ok: true });
  } catch (err) {
    console.error('[Auth] Logout error:', err);
    res.clearCookie('vz_access_token', { path: '/' });
    res.clearCookie('vz_refresh_token', { path: '/' });
    res.json({ ok: true });
  }
});

/**
 * GET /api/auth/me
 * Returns current user from access token.
 */
router.get('/me', authenticate, async function (req, res) {
  try {
    var user = await User.findById(req.user.id);
    if (!user || !user.isActive) {
      res.clearCookie('vz_access_token', { path: '/' });
      res.clearCookie('vz_refresh_token', { path: '/' });
      return res.status(401).json({ error: 'User not found or deactivated.' });
    }

    var userObj = user.toSafeObject();
    if (user.orgId) {
      var Organization = require('../models/Organization');
      var org = await Organization.findById(user.orgId);
      if (org) userObj.org = { _id: org._id, name: org.name };
    }

    res.json({ ok: true, user: userObj });
  } catch (err) {
    console.error('[Auth] Me error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

/**
 * POST /api/auth/refresh-token
 * Uses refresh token cookie to issue a new access token.
 */
router.post('/refresh-token', async function (req, res) {
  try {
    var refreshToken = req.cookies && req.cookies.vz_refresh_token;
    if (!refreshToken) {
      return res.status(401).json({ error: 'No refresh token. Please log in.', code: 'NO_REFRESH_TOKEN' });
    }

    var decoded;
    try {
      decoded = jwt.verify(refreshToken, config.JWT_REFRESH_SECRET);
    } catch (err) {
      res.clearCookie('vz_access_token', { path: '/' });
      res.clearCookie('vz_refresh_token', { path: '/' });
      return res.status(401).json({ error: 'Refresh token expired. Please log in again.', code: 'REFRESH_EXPIRED' });
    }

    // Verify user exists and refresh token matches
    var user = await User.findById(decoded.id).select('+refreshToken');
    if (!user || !user.isActive) {
      res.clearCookie('vz_access_token', { path: '/' });
      res.clearCookie('vz_refresh_token', { path: '/' });
      return res.status(401).json({ error: 'User not found or deactivated.' });
    }

    if (!user.refreshToken) {
      return res.status(401).json({ error: 'Session invalidated. Please log in.', code: 'SESSION_INVALIDATED' });
    }

    var isValidRefresh = await bcrypt.compare(refreshToken, user.refreshToken);
    if (!isValidRefresh) {
      // Possible token theft — invalidate all sessions
      await User.findByIdAndUpdate(user._id, { refreshToken: null });
      res.clearCookie('vz_access_token', { path: '/' });
      res.clearCookie('vz_refresh_token', { path: '/' });
      return res.status(401).json({ error: 'Invalid refresh token. Please log in again.' });
    }

    // Issue new access token
    var newAccessToken = generateAccessToken(user);
    res.cookie('vz_access_token', newAccessToken, accessCookieOpts());

    // Optionally rotate refresh token for extra security
    var newRefreshToken = generateRefreshToken(user);
    var hashedRefresh = await bcrypt.hash(newRefreshToken, 10);
    await User.findByIdAndUpdate(user._id, { refreshToken: hashedRefresh });
    res.cookie('vz_refresh_token', newRefreshToken, refreshCookieOpts());

    var userObj = user.toSafeObject();
    if (user.orgId) {
      var Organization = require('../models/Organization');
      var org = await Organization.findById(user.orgId);
      if (org) userObj.org = { _id: org._id, name: org.name };
    }

    res.json({ ok: true, user: userObj });
  } catch (err) {
    console.error('[Auth] Refresh error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

/**
 * PUT /api/auth/change-password
 * Body: { oldPassword, newPassword }
 */
router.put('/change-password', authenticate, async function (req, res) {
  try {
    var oldPassword = req.body.oldPassword || '';
    var newPassword = req.body.newPassword || '';

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ error: 'Old password and new password are required.' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters.' });
    }

    // Validate password strength
    var hasUpper = /[A-Z]/.test(newPassword);
    var hasLower = /[a-z]/.test(newPassword);
    var hasDigit = /[0-9]/.test(newPassword);
    var hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword);
    if (!hasUpper || !hasLower || !hasDigit || !hasSpecial) {
      return res.status(400).json({
        error: 'Password must contain at least one uppercase letter, one lowercase letter, one digit, and one special character.',
      });
    }

    var user = await User.findById(req.user.id).select('+password');
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    var isMatch = await user.comparePassword(oldPassword);
    if (!isMatch) {
      return res.status(400).json({ error: 'Current password is incorrect.' });
    }

    user.password = newPassword;
    await user.save();

    res.json({ ok: true, message: 'Password changed successfully.' });
  } catch (err) {
    console.error('[Auth] Change password error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
