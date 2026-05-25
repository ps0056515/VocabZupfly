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
      LQ.goTo('home');
      if (LQ.renderLearningPath) LQ.renderLearningPath();
      if (LQ.renderStudentDashboard) LQ.renderStudentDashboard();
      LQ.updateGreeting();
      if (LQ.WORDS.length) {
        LQ.toast(LQ.WORDS.length + ' words ready');
      }
    }
  } catch (err) {
    console.error('LexiQuest boot failed', err);
    LQ.goTo('home');
    LQ.toast('Started with limited data — tap Settings if issues persist');
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
