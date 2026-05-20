window.LQ = window.LQ || {};

LQ.isNativeApp = function () {
  var cap = window.Capacitor;
  return !!(cap && cap.isNativePlatform && cap.isNativePlatform());
};

LQ.isWebDesktop = function () {
  if (LQ.isNativeApp()) return false;
  return window.matchMedia('(min-width: 900px)').matches;
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
};

LQ.initPlatformUI = function () {
  LQ.applyPlatformUI();
  var t;
  window.addEventListener('resize', function () {
    clearTimeout(t);
    t = setTimeout(LQ.applyPlatformUI, 120);
  });
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', LQ.initPlatformUI);
} else {
  LQ.initPlatformUI();
}
