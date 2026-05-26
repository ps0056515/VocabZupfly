window.LQ = window.LQ || {};

LQ.renderStudentDashboard = function () {
  const root = document.getElementById('student-dash-body');
  if (!root) return;

  const counts = LQ.getWordCounts ? LQ.getWordCounts() : { known: 0, flagged: 0, unmarked: 0, total: 0 };
  const touched = counts.known + counts.flagged;
  const progressPct = counts.total ? Math.round((touched / counts.total) * 100) : 0;
  const knownPct = counts.total ? Math.round((counts.known / counts.total) * 100) : 0;
  const accuracy = LQ.getQuizAccuracy ? LQ.getQuizAccuracy() : 0;
  const exam = LQ.S.examFocus || 'GRE';
  const examDate = LQ.S.examDate || '';
  const daysToExam = LQ.daysUntilExam(examDate);
  const task = LQ.getActiveTask();
  const dailyPct = LQ.getDailyGoalPct();
  const listLabel =
    LQ.S.learnListId && LQ.S.learnListId !== 'all'
      ? LQ.getListTitle(LQ.S.learnListId, LQ.S.learnListId)
      : 'All lists';

  root.innerHTML =
    LQ.dashWelcomeRow(task) +
    LQ.dashLearningPath(counts) +
    '<div class="dash-widget-grid">' +
    LQ.dashWidgetProgress(progressPct, knownPct, counts) +
    LQ.dashWidgetActive(task, listLabel, dailyPct) +
    LQ.dashWidgetExam(exam, examDate, daysToExam) +
    LQ.dashWidgetStreak() +
    LQ.dashWidgetVocab(counts, accuracy) +
    LQ.dashWidgetTenses() +
    LQ.dashWidgetLists() +
    LQ.dashWidgetDaily(dailyPct) +
    '</div>';
};

LQ.dashWelcomeRow = function (task) {
  return (
    '<div class="dash-welcome-row">' +
    '<div class="dash-quick-actions">' +
    '<button type="button" class="dash-quick-btn primary" onclick="' +
    task.action +
    '">▶ ' +
    LQ.esc(task.title) +
    '</button>' +
    '<button type="button" class="dash-quick-btn" onclick="goTo(\'learn\')"><span>✏️</span> Learn</button>' +
    '<button type="button" class="dash-quick-btn" onclick="goTo(\'quiz\')"><span>📝</span> Quiz</button>' +
    '<button type="button" class="dash-quick-btn" onclick="goTo(\'tenses\')"><span>🕐</span> Tenses</button>' +
    '<button type="button" class="dash-quick-btn" onclick="goTo(\'lists\')"><span>📋</span> Lists</button>' +
    '</div></div>'
  );
};

LQ.dashLearningPath = function (counts) {
  const learned = counts.known + counts.flagged > 0;
  const revised = counts.flagged === 0 && counts.known > 0;
  return (
    '<section class="dash-learning-path">' +
    '<h3>Your study flow</h3>' +
    '<p>Follow these steps for steady progress — tap any step to jump in.</p>' +
    '<div class="dash-path-steps">' +
    '<button type="button" class="dash-path-step' +
    (learned ? ' done' : '') +
    '" onclick="goTo(\'learn\')">' +
    '<span class="dash-path-num">1</span><span><strong>Learn new words</strong><span>' +
    counts.unmarked +
    ' unmarked · mark known or flag</span></span></button>' +
    '<button type="button" class="dash-path-step' +
    (counts.flagged === 0 && learned ? ' done' : '') +
    '" onclick="goTo(\'revise\')">' +
    '<span class="dash-path-num">2</span><span><strong>Revise flagged</strong><span>' +
    counts.flagged +
    ' waiting · flip & confirm</span></span></button>' +
    '<button type="button" class="dash-path-step' +
    (revised ? ' done' : '') +
    '" onclick="goTo(\'quiz\')">' +
    '<span class="dash-path-num">3</span><span><strong>Test yourself</strong><span>Quiz & mock test when ready</span></span></button>' +
    '</div></section>'
  );
};

LQ.dashWidgetTenses = function () {
  var prog = { solved: 0, readiness: 0 };
  if (LQ.getTensesModuleProgress && LQ.TENSES_MODULES) {
    LQ.TENSES_MODULES.forEach(function (m) {
      var p = LQ.getTensesModuleProgress(m.id);
      prog.solved += p.solved;
    });
    var total = LQ.TENSES_MODULES.length * 8;
    prog.readiness = Math.min(100, Math.round((prog.solved / Math.max(total, 1)) * 100));
  }
  return (
    '<article class="dash-widget dash-widget-link" onclick="goTo(\'tenses\')">' +
    '<h3 class="dash-widget-title">Tenses Practice</h3>' +
    '<p class="dash-vocab-blurb">Grammar, speaking, reading & writing — 9 practice modules.</p>' +
    '<div class="dash-vocab-stats">' +
    '<span><strong>' +
    prog.readiness +
    '%</strong> readiness</span>' +
    '<span><strong>' +
    prog.solved +
    '</strong> exercises done</span></div>' +
    '<span class="dash-widget-cta">Open Tenses ›</span></article>'
  );
};

LQ.dashWidgetProgress = function (progressPct, knownPct, counts) {
  const deg = Math.round((progressPct / 100) * 360);
  return (
    '<article class="dash-widget">' +
    '<h3 class="dash-widget-title">Course Progress</h3>' +
    '<div class="dash-ring-wrap">' +
    '<div class="dash-ring" style="background:conic-gradient(#f5a623 0deg ' +
    deg +
    'deg, #fef3c7 ' +
    deg +
    'deg 360deg)">' +
    '<div class="dash-ring-inner"><span class="dash-ring-pct">' +
    progressPct +
    '%</span><span class="dash-ring-lbl">Completed</span></div></div></div>' +
    '<p class="dash-widget-foot">' +
    counts.known +
    ' known · ' +
    counts.flagged +
    ' flagged · ' +
    counts.unmarked +
    ' left</p></article>'
  );
};

LQ.dashWidgetActive = function (task, listLabel, dailyPct) {
  return (
    '<article class="dash-widget dash-widget-wide">' +
    '<h3 class="dash-widget-title">Current Active Task</h3>' +
    '<div class="dash-active-card">' +
    '<div class="dash-active-top">' +
    '<span class="dash-active-icon">' +
    task.icon +
    '</span>' +
    '<div><h4 class="dash-active-name">' +
    LQ.esc(task.title) +
    '</h4>' +
    '<p class="dash-active-sub">' +
    LQ.esc(task.sub) +
    '</p></div></div>' +
    '<div class="dash-active-bar"><div class="dash-active-fill" style="width:' +
    dailyPct +
    '%"></div></div>' +
    '<button type="button" class="dash-continue-btn" onclick="' +
    task.action +
    '">Continue learning</button></div>' +
    '<ul class="dash-task-list">' +
    task.queue
      .map(function (t) {
        return (
          '<li><span class="dash-task-tag">' +
          LQ.esc(t.tag) +
          '</span> ' +
          LQ.esc(t.label) +
          '</li>'
        );
      })
      .join('') +
    '</ul></article>'
  );
};

LQ.dashWidgetExam = function (exam, examDate, daysToExam) {
  const dateLbl = examDate
    ? new Date(examDate + 'T12:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
    : '—';
  const countdown =
    daysToExam == null
      ? 'Set your exam date in Settings'
      : daysToExam > 0
        ? daysToExam + ' days to go…'
        : daysToExam === 0
          ? 'Exam is today — good luck!'
          : Math.abs(daysToExam) + ' days since exam';
  return (
    '<article class="dash-widget dash-widget-exam">' +
    '<div class="dash-widget-exam-head"><h3 class="dash-widget-title">Exam Date</h3>' +
    '<button type="button" class="dash-link-btn" onclick="goTo(\'settings\')">Edit</button></div>' +
    '<div class="dash-exam-body">' +
    '<div class="dash-exam-cal"><span class="dash-exam-day">' +
    (examDate ? dateLbl.split(' ')[0] : '—') +
    '</span><span class="dash-exam-mon">' +
    (examDate ? dateLbl.split(' ').slice(1).join(' ') : exam) +
    '</span></div>' +
    '<p class="dash-exam-countdown">' +
    countdown +
    '</p></div></article>'
  );
};

LQ.dashWidgetStreak = function () {
  const n = LQ.S.streakCount || 0;
  const week = LQ.S.streakWeek || [];
  return (
    '<article class="dash-widget">' +
    '<h3 class="dash-widget-title">Study Streak</h3>' +
    '<div class="dash-streak-num">' +
    n +
    '<span>days</span></div>' +
    '<div class="dash-streak-week">' +
    ['M', 'T', 'W', 'T', 'F', 'S', 'S']
      .map(function (d, i) {
        return '<span class="dash-streak-day' + (week[i] ? ' done' : '') + '">' + d + '</span>';
      })
      .join('') +
    '</div>' +
    '<p class="dash-widget-foot">Keep learning daily to build your streak</p></article>'
  );
};

LQ.dashWidgetVocab = function (counts, accuracy) {
  return (
    '<article class="dash-widget dash-widget-link" onclick="goTo(\'vocab\')">' +
    '<h3 class="dash-widget-title">Vocabulary</h3>' +
    '<p class="dash-vocab-blurb">Cram LESS, Learn MORE! — Learn, revise, and test your word lists.</p>' +
    '<div class="dash-vocab-stats">' +
    '<span><strong>' +
    counts.unmarked +
    '</strong> to learn</span>' +
    '<span><strong>' +
    counts.flagged +
    '</strong> to revise</span>' +
    '<span><strong>' +
    accuracy +
    '%</strong> quiz acc.</span></div>' +
    '<span class="dash-widget-cta">Open Vocabulary ›</span></article>'
  );
};

LQ.dashWidgetLists = function () {
  var n = LQ.WORD_LISTS && LQ.WORD_LISTS.lists ? LQ.WORD_LISTS.lists.length : 13;
  return (
    '<article class="dash-widget dash-widget-link" onclick="goTo(\'lists\')">' +
    '<h3 class="dash-widget-title">Word Lists &amp; Groups</h3>' +
    '<p class="dash-vocab-blurb">Study synonym clusters group by group across ' +
    n +
    ' lists.</p>' +
    '<span class="dash-widget-cta">Browse lists ›</span></article>'
  );
};

LQ.dashWidgetDaily = function (pct) {
  return (
    '<article class="dash-widget">' +
    '<h3 class="dash-widget-title">Today\'s Goal</h3>' +
    '<div class="dash-daily-pct">' +
    pct +
    '%</div>' +
    '<div class="dash-active-bar"><div class="dash-active-fill" style="width:' +
    pct +
    '%"></div></div>' +
    '<p class="dash-widget-foot">Target: ' +
    (LQ.S.goalTarget || 15) +
    ' words · ' +
    (LQ.S.goalSeen || 0) +
    ' seen · ' +
    (LQ.S.goalQuiz || 0) +
    ' quizzed</p></article>'
  );
};

LQ.getDailyGoalPct = function () {
  const total = (LQ.S.goalSeen || 0) + (LQ.S.goalQuiz || 0) + (LQ.S.goalNew || 0);
  const target = LQ.S.goalTarget || 15;
  return Math.min(100, Math.round((total / target) * 100));
};

LQ.daysUntilExam = function (dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr + 'T12:00:00');
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  now.setHours(12, 0, 0, 0);
  return Math.ceil((d - now) / 86400000);
};

LQ.getActiveTask = function () {
  const counts = LQ.getWordCounts();
  const queue = [];
  if (counts.flagged > 0) {
    queue.push({ tag: 'Revise', label: counts.flagged + ' flagged words waiting' });
  }
  if (counts.unmarked > 0) {
    queue.push({ tag: 'Learn', label: counts.unmarked + ' unmarked words in queue' });
  }
  if (LQ.getQuizAccuracy() < 70 && LQ.S.quizStats && LQ.S.quizStats.total > 0) {
    queue.push({ tag: 'Test', label: 'Quiz accuracy needs improvement' });
  }
  while (queue.length < 2) {
    queue.push({ tag: 'Groups', label: 'Start a synonym group in Word Lists' });
  }

  if (counts.flagged >= 5) {
    return {
      icon: '🔄',
      title: 'Revision session',
      sub: counts.flagged + ' flagged words · flip cards to confirm',
      action: "goTo('revise')",
      queue: queue.slice(0, 2),
    };
  }
  const words = LQ.wordsFromList ? LQ.wordsFromList(LQ.S.learnListId || 'all') : LQ.getWords();
  const next = words.find(function (w) {
    return LQ.getWordStatus(w.word) === 'unmarked';
  });
  return {
    icon: '✏️',
    title: next ? next.word : 'Vocabulary learning',
    sub: next ? 'Mark known or flag to revise · ' + (LQ.S.learnListId === 'all' ? 'All lists' : LQ.getListTitle(LQ.S.learnListId, 'List')) : 'Start marking words',
    action: "goTo('learn')",
    queue: queue.slice(0, 2),
  };
};
