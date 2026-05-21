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

  LQ.platform = native ? 'native' : desktop ? 'web-desktop' : 'web-mobile';

  var meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', desktop ? '#F5F3EE' : '#0D0D0D');

  if (LQ.renderLayoutSwitcher) LQ.renderLayoutSwitcher();
  if (LQ.renderLearningPath) LQ.renderLearningPath();
};

LQ.renderLayoutSwitcher = function () {
  if (LQ.isNativeApp()) return;
  var host = document.querySelector('#screen-home .home-topbar');
  if (!host) return;

  var actions = document.getElementById('home-topbar-actions');
  if (!actions) {
    actions = document.createElement('div');
    actions.id = 'home-topbar-actions';
    actions.className = 'home-topbar-actions';
    var avatar = host.querySelector('.avatar');
    if (avatar) {
      host.appendChild(actions);
      actions.appendChild(avatar);
    } else host.appendChild(actions);
  }

  var el = document.getElementById('layout-switcher');
  if (!el) {
    el = document.createElement('div');
    el.id = 'layout-switcher';
    el.className = 'layout-switcher';
    el.setAttribute('role', 'group');
    el.setAttribute('aria-label', 'Browser layout');
    actions.insertBefore(el, actions.firstChild);
  }

  var pref = LQ.getBrowserLayoutPref();
  var modes = [
    { id: 'auto', label: 'Auto', title: 'Match screen size' },
    { id: 'phone', label: 'Phone', title: 'Phone mockup & bottom nav' },
    { id: 'web', label: 'Web', title: 'Full-width dashboard' },
  ];
  el.innerHTML = modes
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
