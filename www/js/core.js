window.LQ = window.LQ || {};
let _tt;

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

LQ.syncHomeUI = function () {
  const xd = document.getElementById('xp-display');
  const xf = document.getElementById('xp-fill');
  if (xd) xd.textContent = LQ.S.xp + ' XP';
  if (xf) xf.style.width = Math.min(100, Math.round((LQ.S.xp / LQ.S.xpMax) * 100)) + '%';
  LQ.updateGoal();
  LQ.renderStreakUI();
  const prem = document.getElementById('premium-badge');
  if (prem) prem.style.display = LQ.S.premium ? 'inline-flex' : 'none';
};

LQ.recordActivity = function (word, rating) {
  LQ.recordStudyDay();
  LQ.S.history.unshift({ word, rating, time: 'just now' });
  if (LQ.S.history.length > 20) LQ.S.history.pop();
};

LQ.goTo = function (screen) {
  if (screen === 'flashcard' && !LQ.S.premium) {
    const w = LQ.currentFcWord();
    if (w && w.premium) {
      LQ.toast('Premium deck — unlock in Settings');
      screen = 'settings';
    }
  }
  document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach((n) => n.classList.remove('active'));
  const sc = document.getElementById('screen-' + screen);
  if (sc) sc.classList.add('active');
  const nav = document.getElementById('nav-' + screen);
  if (nav) nav.classList.add('active');
  const inner = document.getElementById('app-inner');
  if (inner) inner.scrollTop = 0;

  const handlers = {
    home: () => LQ.syncHomeUI(),
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
  };
  if (handlers[screen]) handlers[screen]();
};
window.goTo = LQ.goTo;
