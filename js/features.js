window.LQ = window.LQ || {};

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
    ? LQ.S.history.slice(0, 8).map((h) => '<' + LQ.H + ' class="recent-row"><' + LQ.H + ' class="rword">' + h.word + '</' + LQ.H + '><span class="rbadge ' + h.rating + '">' + h.rating + '</span></' + LQ.H + '>').join('')
    : '<p style="color:#888;font-size:13px">No activity yet</p>';
  const sec = document.getElementById('prog-section');
  if (!sec) return;
  const lessonsDone = Object.keys(LQ.S.lessonProgress || {}).filter((k) => LQ.S.lessonProgress[k]).length;
  sec.innerHTML =
    '<' + LQ.H + ' class="prog-card"><h3>28-Day Activity</h3><' + LQ.H + ' class="heatmap">' + heat.map((l) => '<' + LQ.H + ' class="hc l' + l + '"></' + LQ.H + '>').join('') + '</' + LQ.H + '></' + LQ.H + '>' +
    '<' + LQ.H + ' class="prog-card"><h3>Mastery</h3><p>Known ' + known + ' · Learning ' + learning + ' · Lessons ' + lessonsDone + '</p></' + LQ.H + '>' +
    '<' + LQ.H + ' class="prog-card"><h3>Recent</h3>' + recent + '</' + LQ.H + '>';
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

const _rec = LQ.recordActivity;
LQ.recordActivity = function (w, r) {
  _rec(w, r);
  LQ.bumpActivity();
};

/* ── ONBOARDING (Airlearn-style multi-step) ── */
LQ._obStep = 0;

LQ.renderOnboarding = function () {
  LQ._obStep = 0;
  LQ.showObStep();
};

LQ.showObStep = function () {
  const el = document.getElementById('onboarding-wrap');
  if (!el) return;
  const steps = [
    function () {
      return (
        '<' + LQ.H + ' class="ob-mascot">🦊</' + LQ.H + '>' +
        '<h2 class="ob-title">Welcome to LexiQuest</h2>' +
        '<p class="ob-sub">Learn exam vocabulary the smart way — bite-sized lessons, then practice.</p>' +
        '<button class="lesson-cta" id="ob-next">Continue</button>'
      );
    },
    function () {
      return (
        '<h2 class="ob-title">Pick your exam</h2>' +
        '<p class="ob-sub">We\'ll tailor your learning path</p>' +
        '<' + LQ.H + ' class="ob-chips">' +
        ['GRE', 'GMAT', 'IELTS', 'ALL'].map((e) => '<button type="button" class="ob-chip" data-exam="' + e + '">' + e + '</button>').join('') +
        '</' + LQ.H + '><button class="lesson-cta" id="ob-next">Continue</button>'
      );
    },
    function () {
      return (
        '<h2 class="ob-title">Set a learning goal</h2>' +
        '<p class="ob-sub">How many days do you want to commit?</p>' +
        '<' + LQ.H + ' class="ob-goal-picks">' +
        [{ d: 7, l: '7 days', s: 'Quick start' }, { d: 14, l: '14 days', s: 'Steady habit' }, { d: 30, l: '30 days', s: 'Deep mastery' }]
          .map((g) => '<button type="button" class="ob-goal-card" data-days="' + g.d + '"><strong>' + g.l + '</strong><span>' + g.s + '</span></button>')
          .join('') +
        '</' + LQ.H + '><button class="lesson-cta" id="ob-next">Continue</button>'
      );
    },
    function () {
      return (
        '<h2 class="ob-title">Daily word target</h2>' +
        '<p class="ob-sub">Words per day (you can change this later)</p>' +
        '<input type="range" id="ob-goal" min="5" max="40" value="15" class="ob-range">' +
        '<p class="ob-goal-lbl" id="ob-goal-lbl">15 words / day</p>' +
        '<button class="lesson-cta" id="ob-next">Start placement →</button>'
      );
    },
  ];
  if (LQ._obStep >= steps.length) {
    LQ.runPlacement();
    return;
  }
  el.innerHTML = steps[LQ._obStep]();
  el.querySelectorAll('.ob-chip').forEach((b) => {
    b.onclick = () => {
      el.querySelectorAll('.ob-chip').forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
      LQ._obExam = b.dataset.exam;
    };
  });
  const gre = el.querySelector('[data-exam="GRE"]');
  if (gre && LQ._obStep === 1) {
    gre.classList.add('active');
    LQ._obExam = 'GRE';
  }
  el.querySelectorAll('.ob-goal-card').forEach((b) => {
    b.onclick = () => {
      el.querySelectorAll('.ob-goal-card').forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
      LQ._obCommit = +b.dataset.days;
    };
  });
  const g14 = el.querySelector('[data-days="14"]');
  if (g14 && LQ._obStep === 2) {
    g14.classList.add('active');
    LQ._obCommit = 14;
  }
  const range = document.getElementById('ob-goal');
  if (range) {
    range.oninput = (e) => {
      document.getElementById('ob-goal-lbl').textContent = e.target.value + ' words / day';
      LQ._obGoal = +e.target.value;
    };
    LQ._obGoal = +range.value;
  }
  const next = document.getElementById('ob-next');
  if (next) {
    next.onclick = () => {
      LQ._obStep++;
      LQ.showObStep();
    };
  }
};

LQ.runPlacement = function () {
  LQ.S.examFocus = LQ._obExam || 'GRE';
  LQ.S.goalTarget = LQ._obGoal || 15;
  LQ.S.commitmentDays = LQ._obCommit || 14;
  LQ.S.commitmentStart = LQ.todayKey();
  const sample = LQ.shuffle(LQ.getWords()).slice(0, 5);
  let i = 0,
    score = 0;
  const el = document.getElementById('onboarding-wrap');
  const next = () => {
    if (i >= sample.length) {
      LQ.S.placementLevel = score >= 4 ? 'advanced' : score >= 2 ? 'intermediate' : 'beginner';
      LQ.S.onboardingComplete = true;
      LQ.saveState();
      document.getElementById('screen-onboarding').classList.remove('active');
      LQ.goTo('home');
      LQ.toast('Your path is ready — start lesson 1!');
      return;
    }
    const w = sample[i++];
    el.innerHTML =
      '<p class="ob-sub">Quick placement (' + i + '/5)</p>' +
      '<p class="quiz-word" style="color:#fff;font-size:28px;margin:20px 0">' + w.word + '</p>' +
      '<button class="lesson-cta" onclick="LQ._placeOk(true)">I know it</button>' +
      '<button class="lesson-cta ob-secondary" onclick="LQ._placeOk(false)">Not yet</button>';
  };
  LQ._placeOk = (ok) => {
    if (ok) score++;
    next();
  };
  next();
};

/* ── WEAK DRILL ── */
LQ.initDrill = function () {
  LQ._drillList = LQ.getWeakWords();
  LQ._drillIdx = 0;
  const wrap = document.getElementById('drill-wrap');
  if (!wrap) return;
  if (!LQ._drillList.length) {
    wrap.innerHTML =
      '<p style="color:#888;padding:20px">No weak words — great job!</p><button class="quiz-next show" onclick="goTo(\'home\')">Home</button>';
    return;
  }
  wrap.innerHTML = '<p id="drill-prog"></p><' + LQ.H + ' id="drill-body"></' + LQ.H + '>';
  LQ.showDrillQ();
};

LQ.showDrillQ = function () {
  const w = LQ._drillList[LQ._drillIdx % LQ._drillList.length];
  document.getElementById('drill-prog').textContent = LQ._drillIdx + 1 + ' / ' + LQ._drillList.length + ' weak words';
  const body = document.getElementById('drill-body');
  const wrong = LQ.shuffle(LQ.getWords().filter((x) => x.word !== w.word)).slice(0, 3);
  LQ._drillOpts = LQ.shuffle(wrong.concat([w]));
  body.innerHTML =
    '<p style="color:#fff;font-weight:600;margin-bottom:12px">' +
    LQ.esc(w.word) +
    '</p>' +
    LQ._drillOpts
      .map(function (o, i) {
        return '<button type="button" class="opt" onclick="LQ.answerDrill(' + i + ')">' + LQ.esc(o.def) + '</button>';
      })
      .join('');
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
    document.getElementById('drill-body').innerHTML =
      '<p style="color:var(--lime)">Drill complete!</p><button class="quiz-next show" onclick="goTo(\'home\')">Home</button>';
  } else LQ.showDrillQ();
  LQ.saveState();
};

/* ── LEAGUES (Rookie League — Airlearn style) ── */
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
  wrap.innerHTML =
    '<' + LQ.H + ' class="league-header-card"><span class="league-trophy">🏆</span><h3>Rookie League</h3><p>Top learners this week earn bragging rights</p></' + LQ.H + '>' +
    board
      .slice(0, 15)
      .map(
        (r, i) =>
          '<' +
          LQ.H +
          ' class="league-row' +
          (r.you ? ' you' : '') +
          '"><span class="league-rank">#' +
          (i + 1) +
          '</span><span>' +
          r.name +
          '</span><span class="league-xp">' +
          r.xp +
          ' XP</span></' +
          LQ.H +
          '>'
      )
      .join('');
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
    '<p style="color:#888;font-size:13px">Exam: <b style="color:#fff">' +
    LQ.S.examFocus +
    '</b></p>' +
    '<p style="color:#888;font-size:13px;margin:8px 0">Goal: <b style="color:#fff">' +
    (LQ.S.commitmentDays || 14) +
    ' days</b></p>' +
    '<p style="color:#888;font-size:13px;margin:8px 0">Premium: <b style="color:var(--lime)">' +
    (LQ.S.premium ? 'Unlocked' : 'Locked') +
    '</b></p>' +
    '<p style="color:#888;font-size:13px;margin:8px 0">AI Tutor: <b style="color:var(--lime)">' +
    (LQ.Config.tutorEndpoint || LQ.Config.aiEndpoint ? 'API connected' : 'Built-in (offline)') +
    '</b></p>' +
    '<input id="prem-code" placeholder="Premium code" style="width:100%;padding:12px;border-radius:12px;border:1px solid #333;background:#1a1a1a;color:#fff;margin:8px 0">' +
    '<button class="quiz-next show" onclick="LQ.unlockPremium()">Unlock premium deck</button>' +
    '<button class="quiz-next show" style="margin-top:10px;background:#333;color:#fff" onclick="LQ.Firebase.signIn&&LQ.Firebase.signIn()">☁️ Sync (Firebase)</button>' +
    '<button class="quiz-next show" style="margin-top:10px;background:#333;color:#fff" onclick="LQ.toggleNotif()">Notifications: ' +
    (LQ.S.notifOn ? 'On' : 'Off') +
    '</button>' +
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
  const pill = document.getElementById('notif-pill');
  const lbl = document.getElementById('notif-label');
  if (pill) pill.classList.toggle('off', !LQ.S.notifOn);
  if (lbl) lbl.textContent = 'Daily reminders: ' + (LQ.S.notifOn ? 'On' : 'Off');
};

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
