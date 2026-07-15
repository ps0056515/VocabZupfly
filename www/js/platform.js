window.LQ = window.LQ || {};

LQ.isNativeApp = function () {
  var cap = window.Capacitor;
  return !!(cap && cap.isNativePlatform && cap.isNativePlatform());
};

LQ.getBrowserLayoutPref = function () {
  return 'auto'; // Always auto-detect layout based on browser width
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
  return; // Disabled layout switcher option as requested
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
  if (LQ.initDraggableHamburger) {
    LQ.initDraggableHamburger();
  }
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

/* ── Draggable Hamburger Menu & Snapping/Persistence ── */

LQ.initDraggableHamburger = function () {
  var btn = document.getElementById('mobile-hamburger-btn');
  var drawer = document.getElementById('mobile-drawer');
  if (!btn) return;

  var margin = 16;
  var buttonSize = 44; // width and height in px
  
  // Load saved position or default to bottom-left with margin
  var saved = localStorage.getItem('lq-hamburger-pos');
  var pos = { side: 'left', top: window.innerHeight - buttonSize - margin - 20 };
  if (saved) {
    try {
      pos = JSON.parse(saved);
    } catch (e) {}
  }

  function applyPos() {
    var screenW = window.innerWidth;
    var screenH = window.innerHeight;
    
    // Boundaries
    var safeAreaTop = 14;
    var minTop = Math.max(margin, safeAreaTop);
    var maxTop = screenH - buttonSize - margin;
    if (pos.top < minTop) pos.top = minTop;
    if (pos.top > maxTop) pos.top = maxTop;

    btn.style.top = pos.top + 'px';
    btn.style.bottom = 'auto'; // override stylesheet default bottom positioning

    if (pos.side === 'right') {
      btn.style.right = margin + 'px';
      btn.style.left = 'auto';
      if (drawer) {
        drawer.classList.remove('drawer-left');
        drawer.classList.add('drawer-right');
      }
    } else {
      btn.style.left = margin + 'px';
      btn.style.right = 'auto';
      if (drawer) {
        drawer.classList.remove('drawer-right');
        drawer.classList.add('drawer-left');
      }
    }
  }

  // Initial call
  applyPos();

  window.addEventListener('resize', applyPos);

  var isPointerDown = false;
  var startX, startY;
  var initialTop, initialLeft;
  var hasMoved = false;

  function onStart(clientX, clientY) {
    isPointerDown = true;
    startX = clientX;
    startY = clientY;
    
    var rect = btn.getBoundingClientRect();
    initialTop = rect.top;
    initialLeft = rect.left;
    hasMoved = false;
    
    btn.style.transition = 'none';
  }

  function onMove(clientX, clientY) {
    if (!isPointerDown) return;
    var dx = clientX - startX;
    var dy = clientY - startY;

    if (!hasMoved && Math.sqrt(dx * dx + dy * dy) > 6) {
      hasMoved = true;
    }

    if (hasMoved) {
      var screenW = window.innerWidth;
      var screenH = window.innerHeight;

      var newTop = initialTop + dy;
      var newLeft = initialLeft + dx;

      // Bound top/left
      var safeAreaTop = 14;
      var minTop = Math.max(margin, safeAreaTop);
      var maxTop = screenH - buttonSize - margin;
      if (newTop < minTop) newTop = minTop;
      if (newTop > maxTop) newTop = maxTop;

      if (newLeft < 0) newLeft = 0;
      if (newLeft > screenW - buttonSize) newLeft = screenW - buttonSize;

      btn.style.top = newTop + 'px';
      btn.style.left = newLeft + 'px';
      btn.style.right = 'auto';
    }
  }

  function onEnd() {
    if (!isPointerDown) return;
    isPointerDown = false;
    btn.style.transition = '';

    if (hasMoved) {
      var screenW = window.innerWidth;
      var rect = btn.getBoundingClientRect();
      var center = rect.left + buttonSize / 2;

      if (center < screenW / 2) {
        pos.side = 'left';
      } else {
        pos.side = 'right';
      }
      pos.top = rect.top;

      try {
        localStorage.setItem('lq-hamburger-pos', JSON.stringify(pos));
      } catch (e) {}

      applyPos();
    }
  }

  // Mouse handlers
  btn.addEventListener('mousedown', function (e) {
    if (e.button !== 0) return;
    onStart(e.clientX, e.clientY);
    
    function onMouseMove(e) {
      onMove(e.clientX, e.clientY);
    }
    function onMouseUp() {
      onEnd();
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    }
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  });

  // Touch handlers
  btn.addEventListener('touchstart', function (e) {
    if (e.touches.length > 0) {
      var touch = e.touches[0];
      onStart(touch.clientX, touch.clientY);
    }
  }, { passive: true });

  btn.addEventListener('touchmove', function (e) {
    if (e.touches.length > 0) {
      var touch = e.touches[0];
      onMove(touch.clientX, touch.clientY);
    }
  }, { passive: true });

  btn.addEventListener('touchend', function (e) {
    onEnd();
  });

  // Capture click events if dragged
  btn.addEventListener('click', function (e) {
    if (hasMoved) {
      e.preventDefault();
      e.stopPropagation();
      hasMoved = false;
    }
  }, true);
};
