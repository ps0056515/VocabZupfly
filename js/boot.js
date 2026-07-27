window.LQ = window.LQ || {};

/* study.js must win over any stale cached features.js that redefines initMock */
if (LQ.initMockStudy) LQ.initMock = LQ.initMockStudy;

LQ.hideSplash = function () {
  try {
    var cap = window.Capacitor;
    var SS = cap && cap.Plugins && cap.Plugins.SplashScreen;
    if (SS) SS.hide();
  } catch (e) {}
};

LQ.bootAfterAuth = function (user) {
  LQ.currentUser = user;
  document.body.classList.remove('login-mode');

  // Show nav bars again
  var bottomNav = document.getElementById('bottom-nav');
  if (bottomNav) bottomNav.style.display = '';
  var desktopRail = document.querySelector('.desktop-rail');
  if (desktopRail) desktopRail.style.display = '';

  // Setup navigation / sidebar for user role
  if (LQ.setupRoleNavigation) LQ.setupRoleNavigation(user);

  // Check if URL hash specifies a screen (e.g., #admin-questions)
  var hashScreen = window.location.hash ? window.location.hash.substring(1) : null;
  if (hashScreen === 'login') {
    hashScreen = null;
  }

  if (hashScreen) {
    LQ.goTo(hashScreen, { resetStack: true });
  } else if (user.role === 'admin') {
    LQ.goTo('admin-students', { resetStack: true });
  } else if (user.role === 'super_admin') {
    LQ.goTo('admin-orgs', { resetStack: true });
  } else {
    // Student
    var lastScreen = 'home';
    try {
      lastScreen = sessionStorage.getItem('currentScreen') || 'home';
    } catch (e) {}
    if (lastScreen === 'onboarding' || lastScreen === 'login' || lastScreen.startsWith('admin-')) lastScreen = 'home';
    LQ.goTo(lastScreen, { resetStack: true });
    if (LQ.renderStudentDashboard && lastScreen === 'home') LQ.renderStudentDashboard();
    LQ.updateGreeting();
  }
};

LQ.boot = async function () {
  try {
    await Promise.race([
      LQ.wordsReady,
      new Promise(function (resolve) {
        setTimeout(resolve, 8000);
      }),
    ]);

    if (!LQ.WORDS.length) {
      console.warn('No words loaded — check data/words-merged.json');
    }

    if (LQ.ensurePathData) LQ.ensurePathData();

    LQ.S = LQ.loadState();
    if (LQ.applyPlatformUI) LQ.applyPlatformUI();
    if (LQ.applyAllFeatures) LQ.applyAllFeatures();
    if (LQ.ensureListPrefs) LQ.ensureListPrefs();
    LQ.WORDS.forEach(function (w) {
      if (!LQ.S.mastery[w.word]) LQ.S.mastery[w.word] = 'new';
      if (!LQ.S.srs[w.word]) LQ.S.srs[w.word] = LQ.initSrsEntry();
    });
    LQ.S.dailyWordIdx =
      LQ.S.dailyWordIdx || (LQ.WORDS.length ? new Date().getDate() % LQ.WORDS.length : 0);

    LQ.initFirebase();
    LQ.initDOMListeners();
    LQ.initNotifications();
    LQ.renderStreakUI();

    if (window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = function () {};
    }

    // ══ AUTH CHECK ══
    var user = null;
    if (LQ.Auth) {
      user = await LQ.Auth.checkAuth();
    }

    if (!user) {
      LQ.goTo('login', { resetStack: true });
    } else {
      LQ.bootAfterAuth(user);
    }
  } catch (err) {
    console.error('LexiQuest boot failed', err);
    try {
      LQ.goTo('login', { resetStack: true });
    } catch (e2) {}
  } finally {
    LQ.hideSplash();
    setTimeout(LQ.hideSplash, 300);
    setTimeout(LQ.hideSplash, 1500);
  }
};

document.addEventListener('DOMContentLoaded', function () {
  LQ.hideSplash();
  LQ.boot();
});
