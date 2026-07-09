window.LQ = window.LQ || {};

LQ.isNativeApp = function () {
  var cap = window.Capacitor;
  return !!(cap && cap.isNativePlatform && cap.isNativePlatform());
};

/** Browser-only: 'auto' | 'phone' | 'web' */
LQ.getBrowserLayoutPref = function () {
  if (LQ.S && LQ.S.browserLayout) return LQ.S.browserLayout;
  return 'auto';
};

LQ.isWebDesktop = function () {
  if (LQ.isNativeApp()) return false;
  var pref = LQ.getBrowserLayoutPref();
  if (pref === 'web') return true;
  if (pref === 'phone') return false;
  return window.matchMedia('(min-width: 900px)').matches;
};

LQ.setBrowserLayout = function (mode) {
  if (LQ.isNativeApp()) return;
  if (mode !== 'auto' && mode !== 'phone' && mode !== 'web') return;
  if (!LQ.S) LQ.S = LQ.loadState();
  LQ.S.browserLayout = mode;
  LQ.saveState();
  LQ.applyPlatformUI();
  if (LQ.syncHomeUI) LQ.syncHomeUI();
  if (LQ.toast) {
    var msg =
      mode === 'auto'
        ? 'Layout: auto (follows screen width)'
        : mode === 'phone'
          ? 'Layout: phone'
          : 'Layout: web dashboard';
    LQ.toast(msg);
  }
};

LQ.applyPlatformUI = function () {
  var body = document.body;
  if (!body) return;

  var native = LQ.isNativeApp();
  var desktop = !native && LQ.isWebDesktop();

  body.classList.remove('native-app', 'web-desktop', 'web-mobile');
  if (native) body.classList.add('native-app');
  else if (desktop) body.classList.add('web-desktop');
  else body.classList.add('web-mobile');

  body.classList.add('portal-theme');

  LQ.platform = native ? 'native' : desktop ? 'web-desktop' : 'web-mobile';

  var meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', '#0f172a');

  if (LQ.renderLayoutSwitcher) LQ.renderLayoutSwitcher();
  if (LQ.renderWordListsPage) LQ.renderWordListsPage();
};

LQ.renderLayoutSwitcher = function () {
  if (LQ.isNativeApp()) return;

  var pref = LQ.getBrowserLayoutPref();
  var modes = [
    { id: 'auto', label: 'Auto', title: 'Match screen size' },
    { id: 'phone', label: 'Phone', title: 'Phone mockup & bottom nav' },
    { id: 'web', label: 'Web', title: 'Full-width dashboard' },
  ];
  var buttons = modes
    .map(function (m) {
      return (
        '<button type="button" class="layout-btn' +
        (pref === m.id ? ' active' : '') +
        '" title="' +
        m.title +
        '" onclick="LQ.setBrowserLayout(\'' +
        m.id +
        '\')">' +
        m.label +
        '</button>'
      );
    })
    .join('');

  var isMobileLayout = !LQ.isWebDesktop();
  var floatHost = document.getElementById('layout-switcher-float');
  if (!floatHost) {
    floatHost = document.createElement('div');
    floatHost.id = 'layout-switcher-float';
    floatHost.className = 'layout-switcher-float';
    document.body.appendChild(floatHost);
  }

  if (isMobileLayout) {
    floatHost.innerHTML =
      '<div class="layout-switcher layout-switcher-persistent" role="group" aria-label="Browser layout">' +
      buttons +
      '</div>';
    floatHost.hidden = false;
  } else {
    floatHost.innerHTML = '';
    floatHost.hidden = true;
  }

  var host =
    document.querySelector('#screen-home .portal-header-actions') ||
    document.querySelector('#screen-vocab .portal-header-actions');
  if (!host) return;

  var el = document.getElementById('layout-switcher');
  if (!el) {
    el = document.createElement('div');
    el.id = 'layout-switcher';
    el.className = 'layout-switcher';
    el.setAttribute('role', 'group');
    el.setAttribute('aria-label', 'Browser layout');
    host.insertBefore(el, host.firstChild);
  }
  el.innerHTML = isMobileLayout ? '' : buttons;
  el.style.display = isMobileLayout ? 'none' : '';
};

LQ.initPlatformUI = function () {
  LQ.applyPlatformUI();
  var t;
  window.addEventListener('resize', function () {
    if (LQ.getBrowserLayoutPref() !== 'auto') return;
    clearTimeout(t);
    t = setTimeout(LQ.applyPlatformUI, 120);
  });
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', LQ.initPlatformUI);
} else {
  LQ.initPlatformUI();
}

window.LQ.setBrowserLayout = LQ.setBrowserLayout;

/* ── Mobile Hamburger Drawer ── */

LQ.openDrawer = function () {
  if (LQ.isWebDesktop()) return;
  var sheet = document.getElementById('mobile-drawer');
  if (!sheet) return;
  sheet.classList.add('open');
  document.body.classList.add('mobile-drawer-open');
  sheet.setAttribute('aria-hidden', 'false');
  LQ.updateDrawerActiveState();
};

LQ.closeDrawer = function () {
  var sheet = document.getElementById('mobile-drawer');
  if (sheet) {
    sheet.classList.remove('open');
    sheet.setAttribute('aria-hidden', 'true');
  }
  document.body.classList.remove('mobile-drawer-open');
};

LQ.toggleDrawer = function () {
  var sheet = document.getElementById('mobile-drawer');
  if (!sheet) return;
  if (sheet.classList.contains('open')) {
    LQ.closeDrawer();
  } else {
    LQ.openDrawer();
  }
};

/** Highlights the drawer item matching the current screen */
LQ.updateDrawerActiveState = function () {
  var current = LQ._currentScreen || 'home';
  document.querySelectorAll('.mobile-drawer-item').forEach(function (btn) {
    btn.classList.remove('active');
  });
  var meta = LQ.SCREEN_META ? LQ.SCREEN_META[current] : null;
  var navId = meta ? (meta.nav || current) : current;
  var activeBtn = document.querySelector('.mobile-drawer-item[data-screen="' + current + '"]') ||
                  document.querySelector('.mobile-drawer-item[data-nav="' + navId + '"]');
  if (activeBtn) activeBtn.classList.add('active');
};

window.LQ.openDrawer  = LQ.openDrawer;
window.LQ.closeDrawer = LQ.closeDrawer;
window.LQ.toggleDrawer = LQ.toggleDrawer;
