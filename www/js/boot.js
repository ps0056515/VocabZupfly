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

    if (!LQ.S.onboardingComplete && !(LQ.Config && LQ.Config.enableAllFeatures)) {
      document.querySelectorAll('.screen').forEach(function (s) {
        s.classList.remove('active');
      });
      var ob = document.getElementById('screen-onboarding');
      if (ob) ob.classList.add('active');
      LQ.renderOnboarding();
    } else {
      var lastScreen = 'home';
      try {
        lastScreen = sessionStorage.getItem('currentScreen') || 'home';
      } catch (e) {}
      if (lastScreen === 'onboarding') lastScreen = 'home';
      LQ.goTo(lastScreen, { resetStack: true });
      if (LQ.renderStudentDashboard && lastScreen === 'home') LQ.renderStudentDashboard();
      LQ.updateGreeting();
    }
  } catch (err) {
    console.error('LexiQuest boot failed', err);
    try {
      LQ.S = LQ.S || LQ.loadState();
      var lastScreen = 'home';
      try {
        lastScreen = sessionStorage.getItem('currentScreen') || 'home';
      } catch (e) {}
      if (lastScreen === 'onboarding') lastScreen = 'home';
      LQ.goTo(lastScreen, { resetStack: true });
    } catch (e2) {}
    LQ.toast('Something failed to load — try a hard refresh (Ctrl+Shift+R)');
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
