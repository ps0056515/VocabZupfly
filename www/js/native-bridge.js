/**
 * Native Android/iOS hooks (Capacitor). No-op in browser.
 */
(function () {
  function initNative() {
    var cap = window.Capacitor;
    if (!cap || !cap.isNativePlatform || !cap.isNativePlatform()) return;

    document.body.classList.add('native-app');

    var StatusBar = cap.Plugins && cap.Plugins.StatusBar;
    if (StatusBar) {
      StatusBar.setStyle({ style: 'DARK' });
      StatusBar.setBackgroundColor({ color: '#0D0D0D' });
    }

    if (window.LQ && LQ.hideSplash) LQ.hideSplash();
    else {
      var SplashScreen = cap.Plugins && cap.Plugins.SplashScreen;
      if (SplashScreen) SplashScreen.hide();
    }
    setTimeout(function () {
      if (window.LQ && LQ.hideSplash) LQ.hideSplash();
    }, 500);

    var App = cap.Plugins && cap.Plugins.App;
    if (App) {
      App.addListener('backButton', function () {
        var active = document.querySelector('.screen.active');
        var screen = active && active.id ? active.id.replace('screen-', '') : 'home';
        if (screen !== 'home' && typeof window.goTo === 'function') {
          window.goTo('home');
        } else {
          App.exitApp();
        }
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initNative);
  } else {
    initNative();
  }
})();
