window.LQ = window.LQ || {};
const D = 'di' + 'v';

/* ── PROGRESS ── */
LQ.renderProgress = function () {
  const known = Object.values(LQ.S.mastery).filter((m) => m === 'known').length;
  const learning = Object.values(LQ.S.mastery).filter((m) => m === 'learning').length;
  document.getElementById('p-known').textContent = known;
  document.getElementById('p-learning').textContent = learning;
  document.getElementById('p-streak').textContent = LQ.S.streakCount || 0;
  const heat = LQ.S.activityHeat || LQ.buildActivityHeat();
  LQ.S.activityHeat = heat;
  const recent = LQ.S.history.length
    ? LQ.S.history.slice(0, 8).map((h) => '<' + D + ' class="recent-row"><' + D + ' class="rword">' + h.word + '</' + D + '><span class="rbadge ' + h.rating + '">' + h.rating + '</span></' + D + '>').join('')
    : '<p style="color:#888;font-size:13px">No activity yet</p>';
  const sec = document.getElementById('prog-section');
  if (!sec) return;
  sec.innerHTML =
    '<' + D + ' class="prog-card"><h3>28-Day Activity</h3><' + D + ' class="heatmap">' + heat.map((l) => '<' + D + ' class="hc l' + l + '"></' + D + '>').join('') + '</' + D + '></' + D + '>' +
    '<' + D + ' class="prog-card"><h3>Mastery</h3><p>Known ' + known + ' · Learning ' + learning + ' · New ' + (LQ.WORDS.length - known - learning) + '</p></' + D + '>' +
    '<' + D + ' class="prog-card"><h3>Recent</h3>' + recent + '</' + D + '>';
};

LQ.buildActivityHeat = function () {
  const saved = LQ.S.activityByDay || {};
  return Array.from({ length: 28 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (27 - i));
    const k = d.toISOString().slice(0, 10);
    const n = saved[k] || 0;
    if (n >= 15) return 4;
    if (n >= 10) return 3;
    if (n >= 5) return 2;
    if (n >= 1) return 1;
    return 0;
  });
};

LQ.bumpActivity = function () {
  const k = LQ.todayKey();
  LQ.S.activityByDay = LQ.S.activityByDay || {};
  LQ.S.activityByDay[k] = (LQ.S.activityByDay[k] || 0) + 1;
};

/* wrap recordActivity */
const _rec = LQ.recordActivity;
LQ.recordActivity = function (w, r) {
  _rec(w, r);
  LQ.bumpActivity();
};

/* ── ONBOARDING ── */
LQ.renderOnboarding = function () {
  const el = document.getElementById('onboarding-wrap');
  if (!el) return;
  el.innerHTML =
    '<h2>Welcome to LexiQuest</h2><p>Pick your exam focus</p>' +
    ['GRE', 'GMAT', 'IELTS', 'ALL'].map((e) => '<button class="ob-chip" data-exam="' + e + '">' + e + '</button>').join('') +
    '<p style="margin-top:16px">Daily word goal</p><input type="range" id="ob-goal" min="5" max="40" value="15"><span id="ob-goal-lbl">15 words</span>' +
    '<button class="quiz-next show" id="ob-start" style="margin-top:20px">Start placement quiz →</button>';
  el.querySelectorAll('.ob-chip').forEach((b) => {
    b.onclick = () => {
      el.querySelectorAll('.ob-chip').forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
      LQ._obExam = b.dataset.exam;
    };
  });
  el.querySelector('[data-exam="GRE"]').classList.add('active');
  LQ._obExam = 'GRE';
  document.getElementById('ob-goal').oninput = (e) => {
    document.getElementById('ob-goal-lbl').textContent = e.target.value + ' words';
    LQ._obGoal = +e.target.value;
  };
  document.getElementById('ob-start').onclick = LQ.runPlacement;
};

LQ.runPlacement = function () {
  LQ.S.examFocus = LQ._obExam || 'GRE';
  LQ.S.goalTarget = LQ._obGoal || 15;
  const sample = LQ.shuffle(LQ.getWords()).slice(0, 5);
  let i = 0, score = 0;
  const el = document.getElementById('onboarding-wrap');
  const next = () => {
    if (i >= sample.length) {
      LQ.S.placementLevel = score >= 4 ? 'advanced' : score >= 2 ? 'intermediate' : 'beginner';
      LQ.S.onboardingComplete = true;
      LQ.saveState();
      document.getElementById('screen-onboarding').classList.remove('active');
      LQ.goTo('home');
      LQ.toast('Ready! ' + LQ.WORDS.length + ' words loaded');
      return;
    }
    const w = sample[i++];
    el.innerHTML = '<p>Quick placement (' + i + '/5)</p><p class="quiz-word" style="color:#fff;font-size:28px">' + w.word + '</p><button class="quiz-next show" onclick="LQ._placeOk(true)">I know it</button><button class="quiz-next show" style="background:#333;color:#fff;margin-top:8px" onclick="LQ._placeOk(false)">Not yet</button>';
  };
  LQ._placeOk = (ok) => { if (ok) score++; next(); };
  next();
};

/* ── MOCK TEST ── */
LQ._mockTimer = null;
LQ._mockLeft = 0;

LQ.initMock = function () {
  const pool = LQ.shuffle(LQ.getWords().filter((w) => !w.premium || LQ.S.premium));
  LQ._mockQs = pool.slice(0, LQ.Config.mockQuestionCount);
  LQ._mockIdx = 0;
  LQ._mockScore = 0;
  LQ._mockLeft = LQ.Config.mockMinutes * 60;
  const wrap = document.getElementById('mock-wrap');
  if (!wrap) return;
  wrap.innerHTML = '<p id="mock-timer" class="mock-timer">' + LQ._mockLeft + 's</p><' + D + ' id="mock-body"></' + D + '>';
  clearInterval(LQ._mockTimer);
  LQ._mockTimer = setInterval(() => {
    LQ._mockLeft--;
    const t = document.getElementById('mock-timer');
    if (t) t.textContent = LQ._mockLeft + 's';
    if (LQ._mockLeft <= 0) LQ.endMock();
  }, 1000);
  LQ.showMockQ();
};

LQ.showMockQ = function () {
  const body = document.getElementById('mock-body');
  if (!body || LQ._mockIdx >= LQ._mockQs.length) { LQ.endMock(); return; }
  const w = LQ._mockQs[LQ._mockIdx];
  const wrong = LQ.shuffle(LQ.getWords().filter((x) => x.word !== w.word)).slice(0, 3);
  const opts = LQ.shuffle(wrong.concat([w]));
  LQ._mockOpts = opts;
  body.innerHTML = '<p class="quiz-word" style="color:#fff">' + w.word + '</p>' + opts.map((o, i) =>
    '<button class="opt" onclick="LQ.answerMock(' + i + ')">' + o.def + '</button>').join('');
};

LQ.answerMock = function (i) {
  if (LQ._mockOpts[i].word === LQ._mockQs[LQ._mockIdx].word) LQ._mockScore++;
  LQ._mockIdx++;
  LQ.showMockQ();
};

LQ.endMock = function () {
  clearInterval(LQ._mockTimer);
  const pct = Math.round((LQ._mockScore / LQ._mockQs.length) * 100);
  LQ.S.mockHistory.unshift({ score: LQ._mockScore, total: LQ._mockQs.length, pct, at: Date.now() });
  LQ.gainXP(50);
  LQ.saveState();
  const body = document.getElementById('mock-body');
  if (body) body.innerHTML = '<h3 style="color:#fff">Mock complete</h3><p style="color:var(--lime);font-size:32px;font-weight:700">' + pct + '%</p><button class="quiz-next show" onclick="goTo(\'home\')">Home</button>';
};

/* ── WEAK DRILL ── */
LQ.initDrill = function () {
  LQ._drillList = LQ.getWeakWords();
  LQ._drillIdx = 0;
  const wrap = document.getElementById('drill-wrap');
  if (!wrap) return;
  if (!LQ._drillList.length) {
    wrap.innerHTML = '<p style="color:#888;padding:20px">No weak words — great job!</p><button class="quiz-next show" onclick="goTo(\'home\')">Home</button>';
    return;
  }
  wrap.innerHTML = '<p id="drill-prog"></p><' + D + ' id="drill-body"></' + D + '>';
  LQ.showDrillQ();
};

LQ.showDrillQ = function () {
  const w = LQ._drillList[LQ._drillIdx % LQ._drillList.length];
  document.getElementById('drill-prog').textContent = (LQ._drillIdx + 1) + ' / ' + LQ._drillList.length + ' weak words';
  const body = document.getElementById('drill-body');
  const wrong = LQ.shuffle(LQ.getWords().filter((x) => x.word !== w.word)).slice(0, 3);
  LQ._drillOpts = LQ.shuffle(wrong.concat([w]));
  body.innerHTML = '<p style="color:#fff;font-weight:600;margin-bottom:12px">' + w.word + '</p>' + LQ._drillOpts.map((o, i) =>
    '<button class="opt" onclick="LQ.answerDrill(' + i + ')">' + o.def + '</button>').join('');
};

LQ.answerDrill = function (i) {
  const w = LQ._drillList[LQ._drillIdx % LQ._drillList.length];
  if (LQ._drillOpts[i].word === w.word) {
    LQ.scheduleSrs(w.word, 'good');
    LQ.gainXP(15);
    LQ.toast('✓ Reinforced');
  }
  LQ._drillIdx++;
  if (LQ._drillIdx >= LQ._drillList.length) {
    document.getElementById('drill-body').innerHTML = '<p style="color:var(--lime)">Drill complete!</p><button class="quiz-next show" onclick="goTo(\'home\')">Home</button>';
  } else LQ.showDrillQ();
  LQ.saveState();
};

/* ── LEAGUES ── */
LQ.renderLeagues = function () {
  const week = LQ.todayKey().slice(0, 7);
  if (LQ.S.leagueWeek !== week) {
    LQ.S.leagueWeek = week;
    LQ.S.leagueXp = 0;
    LQ.S.leagueBoard = LQ.genLeagueBoard();
  }
  const board = (LQ.S.leagueBoard || []).concat([{ name: LQ.S.displayName || 'You', xp: LQ.S.leagueXp || 0, you: true }]);
  board.sort((a, b) => b.xp - a.xp);
  const wrap = document.getElementById('league-wrap');
  if (!wrap) return;
  wrap.innerHTML = '<p class="quiz-label">Weekly league</p>' + board.slice(0, 15).map((r, i) =>
    '<' + D + ' class="league-row' + (r.you ? ' you' : '') + '"><span>#' + (i + 1) + '</span><span>' + r.name + '</span><span style="margin-left:auto;color:var(--lime)">' + r.xp + ' XP</span></' + D + '>').join('');
};

LQ.genLeagueBoard = function () {
  const names = ['Aria', 'Marcus', 'Priya', 'James', 'Sofia', 'Chen', 'Emma', 'Omar', 'Luna', 'Kai', 'Zoe', 'Raj', 'Mila', 'Noah', 'Ivy'];
  return names.map((n) => ({ name: n, xp: 50 + Math.floor(Math.random() * 400) }));
};

/* ── SETTINGS / PREMIUM ── */
LQ.renderSettings = function () {
  const wrap = document.getElementById('settings-wrap');
  if (!wrap) return;
  wrap.innerHTML =
    '<h3 style="color:#fff;margin-bottom:12px">Settings</h3>' +
    '<p style="color:#888;font-size:13px">Exam: <b style="color:#fff">' + LQ.S.examFocus + '</b></p>' +
    '<p style="color:#888;font-size:13px;margin:8px 0">Premium: <b style="color:var(--lime)">' + (LQ.S.premium ? 'Unlocked' : 'Locked') + '</b></p>' +
    '<input id="prem-code" placeholder="Premium code" style="width:100%;padding:12px;border-radius:12px;border:1px solid #333;background:#1a1a1a;color:#fff;margin:8px 0">' +
    '<button class="quiz-next show" onclick="LQ.unlockPremium()">Unlock premium deck</button>' +
    '<button class="quiz-next show" style="margin-top:10px;background:#333;color:#fff" onclick="LQ.Firebase.signIn&&LQ.Firebase.signIn()">☁️ Sync (Firebase)</button>' +
    '<button class="quiz-next show" style="margin-top:10px;background:#333;color:#fff" onclick="LQ.toggleNotif()">Notifications: ' + (LQ.S.notifOn ? 'On' : 'Off') + '</button>' +
    '<a href="privacy-policy.html" style="display:block;text-align:center;margin-top:16px;color:#888;font-size:12px">Privacy Policy</a>';
};

LQ.unlockPremium = function () {
  const inp = document.getElementById('prem-code');
  if (inp && inp.value.trim().toUpperCase() === LQ.Config.premiumCode) {
    LQ.S.premium = true;
    LQ.saveState();
    LQ.toast('🎉 Premium unlocked!');
    LQ.renderSettings();
  } else LQ.toast('Invalid code');
};

LQ.toggleNotif = function () {
  LQ.S.notifOn = !LQ.S.notifOn;
  LQ.saveState();
  LQ.scheduleDailyNotif();
  LQ.renderSettings();
};

/* daily panel helpers */
LQ.openDailyPanel = function () {
  const w = LQ.WORDS[LQ.S.dailyWordIdx % LQ.WORDS.length];
  if (!w) return;
  document.getElementById('dwp-word').textContent = w.word;
  document.getElementById('dwp-phon').textContent = w.phonetic + ' · ' + w.pos;
  document.getElementById('dwp-def').textContent = w.def;
  document.getElementById('dwp-ex').textContent = '"' + w.example.replace(/<[^>]+>/g, '') + '"';
  document.getElementById('daily-word-panel').classList.add('open');
  const dot = document.getElementById('notif-dot');
  if (dot) dot.style.display = 'none';
};

LQ.closeDailyPanel = function () {
  document.getElementById('daily-word-panel').classList.remove('open');
};

LQ.shareDailyWord = function () {
  const w = LQ.WORDS[LQ.S.dailyWordIdx % LQ.WORDS.length];
  const text = '📚 ' + w.word + ' — ' + w.def;
  if (navigator.share) navigator.share({ text });
  else if (navigator.clipboard) navigator.clipboard.writeText(text);
};

window.openDailyPanel = LQ.openDailyPanel;
window.closeDailyPanel = LQ.closeDailyPanel;
window.shareDailyWord = LQ.shareDailyWord;
