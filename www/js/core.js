window.LQ = window.LQ || {};
LQ.H = 'div';
let _tt;

LQ.esc = function (s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

LQ.toast = function (msg) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(_tt);
  _tt = setTimeout(() => el.classList.remove('show'), 2600);
};

LQ.gainXP = function (amt) {
  LQ.S.xp += amt;
  LQ.S.leagueXp = (LQ.S.leagueXp || 0) + amt;
  if (LQ.S.xp >= LQ.S.xpMax) {
    LQ.S.xp -= LQ.S.xpMax;
    LQ.S.level++;
    LQ.S.xpMax = Math.floor(LQ.S.xpMax * 1.4);
    LQ.toast('🏆 Level ' + LQ.S.level + '!');
  }
  LQ.syncHomeUI();
  LQ.burstXP('+' + amt + ' XP');
  LQ.saveState();
};

LQ.burstXP = function (label) {
  const el = document.getElementById('xp-burst');
  if (!el) return;
  el.textContent = label;
  el.className = 'xp-burst pop';
  setTimeout(() => (el.className = 'xp-burst fade'), 600);
  setTimeout(() => (el.className = 'xp-burst'), 900);
};

LQ.updateGoal = function () {
  const total = LQ.S.goalSeen + LQ.S.goalQuiz + LQ.S.goalNew;
  const target = LQ.S.goalTarget || 15;
  const pct = Math.min(100, Math.round((total / target) * 100));
  const p = document.getElementById('goal-pct');
  const f = document.getElementById('goal-fill');
  const gs = document.getElementById('g-seen');
  const gq = document.getElementById('g-quiz');
  const gn = document.getElementById('g-new');
  if (p) p.textContent = pct + '%';
  if (f) f.style.width = pct + '%';
  if (gs) gs.textContent = LQ.S.goalSeen;
  if (gq) gq.textContent = LQ.S.goalQuiz;
  if (gn) gn.textContent = LQ.S.goalNew;
};

LQ.updateGreeting = function () {
  const el = document.querySelector('.greeting');
  if (!el) return;
  const h = new Date().getHours();
  const t = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  el.textContent = t + ' 👋';
};

LQ.syncHomeUI = function () {
  const xd = document.getElementById('xp-display');
  const xf = document.getElementById('xp-fill');
  if (xd) xd.textContent = LQ.S.xp + ' XP';
  if (xf) xf.style.width = Math.min(100, Math.round((LQ.S.xp / LQ.S.xpMax) * 100)) + '%';
  LQ.updateGoal();
  LQ.updateGreeting();
  LQ.renderStreakUI();
  const dash = document.getElementById('screen-home');
  const vocab = document.getElementById('screen-vocab');
  if (dash && dash.classList.contains('active') && LQ.renderStudentDashboard) LQ.renderStudentDashboard();
  const lists = document.getElementById('screen-lists');
  if (lists && lists.classList.contains('active') && LQ.renderWordListsPage) LQ.renderWordListsPage();
  if (vocab && vocab.classList.contains('active') && LQ.renderVocabPage) LQ.renderVocabPage();
  const act = document.getElementById('portal-activity');
  if (act) {
    act.innerHTML =
      '<span class="portal-activity-item">🔥 <strong>' +
      (LQ.S.streakCount || 0) +
      '</strong> day streak</span>' +
      '<span class="portal-activity-item">Level <strong>' +
      (LQ.S.level || 1) +
      '</strong></span>' +
      '<span class="portal-activity-item"><strong>' +
      (LQ.S.xp || 0) +
      '</strong> XP</span>';
  }
  const prem = document.getElementById('premium-badge');
  if (prem) prem.style.display = LQ.S.premium ? 'inline-flex' : 'none';
};

LQ.recordActivity = function (word, rating) {
  LQ.recordStudyDay();
  LQ.S.history.unshift({ word, rating, time: 'just now' });
  if (LQ.S.history.length > 20) LQ.S.history.pop();
};

LQ.goTo = function (screen, opts) {
  opts = opts || {};
  if (screen === 'flashcard' && !LQ.S.premium && !(LQ.Config && LQ.Config.enableAllFeatures)) {
    const w = LQ.currentFcWord();
    if (w && w.premium) {
      LQ.toast('Premium deck — unlock in Settings');
      screen = 'settings';
    }
  }
  if (!opts.noPush && LQ._currentScreen && LQ._currentScreen !== screen) {
    LQ._navStack = LQ._navStack || [];
    LQ._navStack.push(LQ._currentScreen);
    if (LQ._navStack.length > 15) LQ._navStack.shift();
  }
  if (opts.resetStack) LQ._navStack = [];
  LQ._currentScreen = screen;
  if (LQ.closeMoreMenu) LQ.closeMoreMenu();

  document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach((n) => n.classList.remove('active'));
  document.querySelectorAll('.desktop-rail-item').forEach((n) => n.classList.remove('active'));
  const sc = document.getElementById('screen-' + screen);
  if (sc) sc.classList.add('active');
  const meta = LQ.getScreenMeta ? LQ.getScreenMeta(screen) : { nav: screen };
  const navId = meta.nav || screen;
  const nav = document.getElementById('nav-' + navId);
  if (nav) nav.classList.add('active');
  const rail = document.getElementById('desktop-nav-' + navId);
  if (rail) rail.classList.add('active');
  const inner = document.getElementById('app-inner');
  if (inner) inner.scrollTop = 0;
  if (LQ.updateFlowChrome) LQ.updateFlowChrome(screen);

  const handlers = {
    home: () => {
      LQ.syncHomeUI();
      if (LQ.renderStudentDashboard) LQ.renderStudentDashboard();
    },
    vocab: () => {
      LQ.syncHomeUI();
      if (LQ.renderVocabPage) LQ.renderVocabPage();
    },
    lists: () => {
      if (LQ.renderWordListsPage) LQ.renderWordListsPage();
    },
    learn: () => LQ.initLearn && LQ.initLearn(),
    revise: () => LQ.initRevise && LQ.initRevise(),
    lesson: () => LQ.renderLessonScreen && LQ.renderLessonScreen(),
    flashcard: () => LQ.renderFC(),
    quiz: () => LQ.initQuiz(),
    wordbank: () => LQ.renderWB(),
    progress: () => LQ.renderProgress(),
    spelling: () => LQ.initSpelling(),
    mock: () => LQ.initMock(),
    drill: () => LQ.initDrill(),
    leagues: () => LQ.renderLeagues(),
    speak: () => LQ.initSpeak(),
    settings: () => LQ.renderSettings(),
    onboarding: () => LQ.renderOnboarding(),
    tutor: () => LQ.initTutor && LQ.initTutor(),
    tenses: () => LQ.renderTensesPage && LQ.renderTensesPage(),
    'tenses-practice': () => LQ.initTensesPractice && LQ.initTensesPractice(),
  };
  if (handlers[screen]) handlers[screen]();
};
window.goTo = LQ.goTo;
