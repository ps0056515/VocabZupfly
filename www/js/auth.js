/**
 * VocabZupfly Authentication Module.
 * Handles login, logout, session check, token refresh, and auth UI.
 */
window.LQ = window.LQ || {};

LQ.Auth = (function () {
  var _refreshTimer = null;
  var API_BASE = '/api/auth';

  /**
   * Check if user is authenticated (on page load).
   * 1. Try /api/auth/me (uses cookie)
   * 2. If token expired, try /api/auth/refresh-token
   * 3. If all fails, show login screen
   */
  async function checkAuth() {
    LQ.Store.dispatch({ type: 'SET_LOADING', payload: true });

    try {
      // First try to restore from IndexedDB (instant UI)
      var restored = await LQ.Store.restore();

      // Then verify with server
      var resp = await fetch(API_BASE + '/me', { credentials: 'include' });

      if (resp.ok) {
        var data = await resp.json();
        if (data.ok && data.user) {
          LQ.Store.dispatch({ type: 'SET_USER', payload: data.user });
          startRefreshTimer();
          return data.user;
        }
      }

      // If 401 with TOKEN_EXPIRED, try refresh
      if (resp.status === 401) {
        var errData = {};
        try { errData = await resp.json(); } catch (e) {}

        if (errData.code === 'TOKEN_EXPIRED') {
          var refreshed = await refreshToken();
          if (refreshed) return refreshed;
        }

        // Try refresh anyway (maybe access token just expired)
        var refreshed2 = await refreshToken();
        if (refreshed2) return refreshed2;
      }

      // All failed — show login
      LQ.Store.dispatch({ type: 'CLEAR_USER' });
      return null;
    } catch (err) {
      console.warn('Auth check failed:', err);
      // If server is unreachable but we have cached data, use it
      var state = LQ.Store.getState();
      if (state.isAuthenticated && state.user) {
        LQ.Store.dispatch({ type: 'SET_LOADING', payload: false });
        return state.user;
      }
      LQ.Store.dispatch({ type: 'CLEAR_USER' });
      return null;
    }
  }

  /**
   * Login with email and password.
   */
  async function login(email, password) {
    var resp = await fetch(API_BASE + '/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email: email, password: password }),
    });

    var data = await resp.json();
    if (!resp.ok) {
      throw new Error(data.error || 'Login failed.');
    }

    LQ.Store.dispatch({ type: 'SET_USER', payload: data.user });
    startRefreshTimer();
    return data.user;
  }

  /**
   * Logout — clear cookies and local state.
   */
  async function logout(skipConfirm) {
    if (skipConfirm === true) {
      return performLogout();
    }

    return new Promise(function (resolve) {
      var modalHtml = 
        '<div id="logout-confirm-modal" style="position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(15,23,42,0.6);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;z-index:99999;">' +
          '<style>' +
            '@keyframes logoutSpin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }' +
          '</style>' +
          '<div style="background:#fff;border-radius:16px;padding:28px;width:90%;max-width:380px;box-shadow:0 20px 25px -5px rgba(0,0,0,0.1),0 10px 10px -5px rgba(0,0,0,0.04);text-align:center;box-sizing:border-box">' +
            '<div style="font-size:40px;margin-bottom:16px">🚪</div>' +
            '<h3 style="margin:0 0 8px;font-size:18px;font-weight:700;color:#0f172a">Confirm Logout</h3>' +
            '<p style="margin:0 0 24px;font-size:14px;color:#64748b;line-height:1.5">Are you sure you want to log out of your session?</p>' +
            '<div style="display:flex;gap:12px">' +
              '<button type="button" id="logout-cancel-btn" style="flex:1;padding:10px 16px;border:1px solid #cbd5e1;background:#fff;color:#334155;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;">Cancel</button>' +
              '<button type="button" id="logout-confirm-btn" style="flex:1;padding:10px 16px;border:none;background:#ef4444;color:#fff;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;">Logout</button>' +
            '</div>' +
          '</div>' +
        '</div>';
      
      var div = document.createElement('div');
      div.innerHTML = modalHtml;
      var modalEl = div.firstChild;
      document.body.appendChild(modalEl);

      modalEl.querySelector('#logout-cancel-btn').onclick = function () {
        modalEl.remove();
        resolve(false);
      };

      modalEl.querySelector('#logout-confirm-btn').onclick = function () {
        // Change to loading state
        modalEl.innerHTML = 
          '<div style="background:#fff;border-radius:16px;padding:32px 28px;width:90%;max-width:380px;box-shadow:0 20px 25px -5px rgba(0,0,0,0.1);text-align:center;box-sizing:border-box;display:flex;flex-direction:column;align-items:center;justify-content:center">' +
            '<div style="width:36px;height:36px;border:3px solid #e2e8f0;border-top:3px solid #2563eb;border-radius:50%;animation:logoutSpin 1s linear infinite;margin-bottom:16px"></div>' +
            '<h3 style="margin:0;font-size:16px;font-weight:600;color:#0f172a">Logging out safely...</h3>' +
          '</div>';
        
        setTimeout(async function () {
          modalEl.remove();
          await performLogout();
          resolve(true);
        }, 800);
      };
    });
  }

  async function performLogout() {
    stopRefreshTimer();
    try {
      await fetch(API_BASE + '/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } catch (e) {
      // Ignore network errors during logout
    }
    LQ.Store.dispatch({ type: 'CLEAR_USER' });
    if (LQ.resetAssessmentState) LQ.resetAssessmentState();
    if (LQ.IDB) await LQ.IDB.clear();
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (e) {}
    showLoginScreen();
  }

  /**
   * Refresh the access token using the refresh token cookie.
   */
  async function refreshToken() {
    try {
      var resp = await fetch(API_BASE + '/refresh-token', {
        method: 'POST',
        credentials: 'include',
      });

      if (resp.ok) {
        var data = await resp.json();
        if (data.ok && data.user) {
          LQ.Store.dispatch({ type: 'SET_USER', payload: data.user });
          startRefreshTimer();
          return data.user;
        }
      }
      return null;
    } catch (err) {
      console.warn('Token refresh failed:', err);
      return null;
    }
  }

  /**
   * Auto-refresh access token periodically in background.
   */
  function startRefreshTimer() {
    stopRefreshTimer();
    _refreshTimer = setInterval(async function () {
      var result = await refreshToken();
      if (!result) {
        stopRefreshTimer();
        LQ.Store.dispatch({ type: 'CLEAR_USER' });
        showLoginScreen();
        if (LQ.toast) LQ.toast('Session expired. Please log in again.');
      }
    }, 24 * 60 * 60 * 1000); // Check daily
  }

  function stopRefreshTimer() {
    if (_refreshTimer) {
      clearInterval(_refreshTimer);
      _refreshTimer = null;
    }
  }

  /**
   * Change password.
   */
  async function changePassword(newPassword) {
    var resp = await fetch(API_BASE + '/change-password', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ newPassword: newPassword }),
    });

    var data = await resp.json();
    if (!resp.ok) {
      throw new Error(data.error || 'Failed to change password.');
    }
    return data;
  }

  /**
   * Show login screen, hide all others.
   */
  function showLoginScreen() {
    try {
      history.replaceState({ screen: 'login' }, '', window.location.pathname + '#login');
    } catch (e) {}

    document.body.classList.add('login-mode');
    document.querySelectorAll('.screen').forEach(function (s) { s.classList.remove('active'); });
    renderLoginScreen();
    var loginScreen = document.getElementById('screen-login');
    if (loginScreen) loginScreen.classList.add('active');

    // Hide nav bars
    var bottomNav = document.getElementById('bottom-nav');
    if (bottomNav) bottomNav.style.display = 'none';
    var desktopRail = document.querySelector('.desktop-rail');
    if (desktopRail) desktopRail.style.display = 'none';
  }

  /**
   * Render login form UI.
   */
  function renderLoginScreen() {
    var screen = document.getElementById('screen-login');
    if (!screen) return;

    screen.innerHTML =
      '<div class="login-container">' +
        '<div class="login-card">' +
          '<div class="login-logo">' +
            '<span class="login-logo-icon">📚</span>' +
            '<h1 class="login-title">VocabZupfly</h1>' +
            '<p class="login-subtitle">Learn. Practice. Excel.</p>' +
          '</div>' +
          '<form id="login-form" class="login-form" onsubmit="LQ.Auth.handleLoginSubmit(event)">' +
            '<div class="login-field">' +
              '<label for="login-email">Email</label>' +
              '<input type="email" id="login-email" placeholder="Enter your email" required autocomplete="email" />' +
            '</div>' +
            '<div class="login-field">' +
              '<label for="login-password">Password</label>' +
              '<div class="login-password-wrap">' +
                '<input type="password" id="login-password" placeholder="Enter your password" required autocomplete="current-password" />' +
                '<button type="button" class="login-eye-btn" onclick="LQ.Auth.togglePasswordVisibility()" tabindex="-1">👁️</button>' +
              '</div>' +
            '</div>' +
            '<p id="login-error" class="login-error" style="display:none"></p>' +
            '<button type="submit" class="login-submit-btn" id="login-submit-btn">Sign In</button>' +
          '</form>' +
        '</div>' +
      '</div>';
  }

  /**
   * Handle login form submission.
   */
  async function handleLoginSubmit(e) {
    e.preventDefault();
    var email = document.getElementById('login-email').value.trim();
    var password = document.getElementById('login-password').value;
    var errEl = document.getElementById('login-error');
    var btn = document.getElementById('login-submit-btn');

    if (!email || !password) {
      if (errEl) { errEl.textContent = 'Please enter email and password.'; errEl.style.display = 'block'; }
      return;
    }

    if (errEl) errEl.style.display = 'none';
    if (btn) { btn.disabled = true; btn.textContent = 'Signing in...'; }

    try {
      var user = await login(email, password);
      if (user) {
        if (LQ.bootAfterAuth) LQ.bootAfterAuth(user);
      }
    } catch (err) {
      if (errEl) {
        errEl.textContent = err.message || 'Login failed. Please try again.';
        errEl.style.display = 'block';
      }
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Sign In'; }
    }
  }

  /**
   * Toggle password visibility.
   */
  function togglePasswordVisibility() {
    var inp = document.getElementById('login-password');
    if (!inp) return;
    inp.type = inp.type === 'password' ? 'text' : 'password';
  }

  return {
    checkAuth: checkAuth,
    login: login,
    logout: logout,
    refreshToken: refreshToken,
    changePassword: changePassword,
    showLoginScreen: showLoginScreen,
    renderLoginScreen: renderLoginScreen,
    handleLoginSubmit: handleLoginSubmit,
    togglePasswordVisibility: togglePasswordVisibility,
  };
})();

/* ══════════════════════════════════════════════════
   GLOBAL FETCH INTERCEPTOR FOR BACKGROUND TOKEN REFRESH
   When any API returns 401 (TOKEN_EXPIRED), it calls
   /api/auth/refresh-token in background and retries original request.
   ══════════════════════════════════════════════════ */
(function () {
  var originalFetch = window.fetch;
  var isRefreshing = false;
  var refreshSubscribers = [];

  function subscribeTokenRefresh(cb) {
    refreshSubscribers.push(cb);
  }

  function onRefreshed() {
    refreshSubscribers.forEach(function (cb) { cb(); });
    refreshSubscribers = [];
  }

  window.fetch = async function (url, options) {
    options = options || {};
    var urlStr = typeof url === 'string' ? url : (url && url.url ? url.url : '');

    if (urlStr && urlStr.indexOf('/api/') !== -1) {
      if (!options.credentials) options.credentials = 'include';
    }

    var response = await originalFetch(url, options);

    // Intercept 401 Unauthorized for API routes (excluding login, logout, refresh-token, & CMS)
    if (
      response.status === 401 &&
      urlStr &&
      urlStr.indexOf('/api/') !== -1 &&
      urlStr.indexOf('/api/cms') === -1 &&
      urlStr.indexOf('/api/auth/login') === -1 &&
      urlStr.indexOf('/api/auth/logout') === -1 &&
      urlStr.indexOf('/api/auth/refresh-token') === -1
    ) {
      if (!isRefreshing) {
        isRefreshing = true;
        try {
          var refreshedUser = await LQ.Auth.refreshToken();
          isRefreshing = false;
          if (refreshedUser) {
            onRefreshed();
            return await originalFetch(url, options);
          } else {
            refreshSubscribers = [];
            LQ.Auth.logout(true);
          }
        } catch (err) {
          isRefreshing = false;
          refreshSubscribers = [];
          LQ.Auth.logout(true);
        }
      } else {
        return new Promise(function (resolve, reject) {
          subscribeTokenRefresh(async function () {
            try {
              var retryResp = await originalFetch(url, options);
              resolve(retryResp);
            } catch (e) {
              reject(e);
            }
          });
        });
      }
    }

    return response;
  };
})();
