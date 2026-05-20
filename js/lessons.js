window.LQ = window.LQ || {};

LQ.EXAM_TIPS = [
  { title: 'GRE tip', body: 'On Text Completion, learn word tone (positive/negative/neutral) — not just definitions.' },
  { title: 'GMAT tip', body: 'Critical Reasoning rewards precise vocabulary: "mitigate" vs "eliminate" changes answer choices.' },
  { title: 'IELTS tip', body: 'Writing Band 7+ needs less common collocations — pair new words with natural phrases.' },
  { title: 'Usage tip', body: 'Read the example sentence aloud; rhythm helps you recall words under time pressure.' },
  { title: 'Memory tip', body: 'Link a vivid image to the root: "ephemeral" → mayfly that lives one day.' },
];

LQ.CHAPTERS = [
  { id: 'c1', title: 'Foundations', icon: '🌱', subtitle: 'High-frequency core' },
  { id: 'c2', title: 'Verbs in Context', icon: '⚡', subtitle: 'Action & argument words' },
  { id: 'c3', title: 'Tone & Attitude', icon: '🎭', subtitle: 'Adjectives that shape meaning' },
  { id: 'c4', title: 'Academic Precision', icon: '🎓', subtitle: 'Formal register' },
  { id: 'c5', title: 'Exam Sprint', icon: '🏁', subtitle: 'Mixed review' },
];

LQ.lessonsForChapter = function (chapterId) {
  const titles = [
    ['Warm-up', 'Essentials I', 'Essentials II'],
    ['Power verbs', 'Cause & effect', 'Contrast'],
    ['Positive tone', 'Negative tone', 'Neutral tone'],
    ['Science & logic', 'Business', 'Arts'],
    ['Speed round', 'Challenge', 'Boss review'],
  ];
  const idx = LQ.CHAPTERS.findIndex((c) => c.id === chapterId);
  const names = titles[idx] || titles[0];
  return names.map((title, i) => ({
    id: chapterId + '-l' + (i + 1),
    title,
    chapterId,
  }));
};

LQ.isLessonUnlocked = function (lessonId) {
  if (LQ.Config && LQ.Config.enableAllFeatures) return true;
  LQ.S.lessonProgress = LQ.S.lessonProgress || {};
  const all = [];
  LQ.CHAPTERS.forEach((ch) => {
    LQ.lessonsForChapter(ch.id).forEach((l) => all.push(l.id));
  });
  const i = all.indexOf(lessonId);
  if (i <= 0) return true;
  return !!LQ.S.lessonProgress[all[i - 1]];
};

LQ.wordsForLesson = function (lessonId) {
  const all = LQ.getWords().filter((w) => !w.premium || LQ.S.premium);
  const hash = lessonId.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const start = hash % Math.max(1, all.length - 8);
  return LQ.shuffle(all.slice(start).concat(all.slice(0, start))).slice(0, 5);
};

LQ.renderLearningPath = function () {
  const wrap = document.getElementById('path-wrap');
  if (!wrap) return;
  LQ.S.lessonProgress = LQ.S.lessonProgress || {};
  wrap.className = 'path-wrap path-board';
  var hint = document.querySelector('.path-board-hint');
  if (!hint && wrap.parentNode) {
    hint = document.createElement('p');
    hint.className = 'path-board-hint';
    wrap.parentNode.insertBefore(hint, wrap);
  }
  if (hint) {
    hint.textContent = LQ.isWebDesktop && LQ.isWebDesktop()
      ? 'Five chapters · scroll horizontally · click a lesson card to start'
      : '';
    hint.style.display = LQ.isWebDesktop && LQ.isWebDesktop() ? 'block' : 'none';
  }
  const H = LQ.H;
  let html = '';
  LQ.CHAPTERS.forEach(function (ch) {
    const lessons = LQ.lessonsForChapter(ch.id);
    const done = lessons.filter(function (l) {
      return LQ.S.lessonProgress[l.id];
    }).length;
    const pct = lessons.length ? Math.round((done / lessons.length) * 100) : 0;
    html +=
      '<article class="kanban-col" data-chapter="' +
      ch.id +
      '">' +
      '<header class="kanban-col-head">' +
      '<span class="kanban-col-icon" aria-hidden="true">' +
      ch.icon +
      '</span>' +
      '<' +
      H +
      ' class="kanban-col-titles">' +
      '<h3 class="kanban-col-title">' +
      LQ.esc(ch.title) +
      '</h3>' +
      '<p class="kanban-col-sub">' +
      LQ.esc(ch.subtitle) +
      '</p></' +
      H +
      '>' +
      '<span class="kanban-col-count">' +
      done +
      '/' +
      lessons.length +
      '</span></header>' +
      '<' +
      H +
      ' class="kanban-col-bar" role="progressbar" aria-valuenow="' +
      pct +
      '"><' +
      H +
      ' class="kanban-col-bar-fill" style="width:' +
      pct +
      '%"></' +
      H +
      '></' +
      H +
      '>' +
      '<' +
      H +
      ' class="kanban-col-cards">';
    lessons.forEach(function (les, li) {
      const unlocked = LQ.isLessonUnlocked(les.id);
      const complete = !!LQ.S.lessonProgress[les.id];
      const cls = complete ? 'done' : unlocked ? 'active' : 'locked';
      const badge = complete ? 'Done' : unlocked ? 'Start' : 'Locked';
      html +=
        '<button type="button" class="kanban-lesson ' +
        cls +
        '" ' +
        (unlocked ? 'onclick="LQ.startLesson(\'' + les.id + '\')"' : 'disabled') +
        '>' +
        '<span class="kanban-lesson-num">' +
        (complete ? '\u2713' : String(li + 1)) +
        '</span>' +
        '<span class="kanban-lesson-name">' +
        LQ.esc(les.title) +
        '</span>' +
        '<span class="kanban-lesson-badge">' +
        badge +
        '</span></button>';
    });
    html += '</' + H + '></article>';
  });
  wrap.innerHTML = html;
  const commit = document.getElementById('commit-banner');
  if (commit && LQ.S.commitmentDays) {
    const start = LQ.S.commitmentStart ? new Date(LQ.S.commitmentStart) : new Date();
    const elapsed = Math.floor((Date.now() - start.getTime()) / 86400000) + 1;
    commit.innerHTML =
      '<span class="commit-icon">🎯</span>' +
      '<' + LQ.H + '><strong>' + LQ.S.commitmentDays + '-day goal</strong><br>Day ' + Math.min(elapsed, LQ.S.commitmentDays) + ' of ' + LQ.S.commitmentDays + '</' + LQ.H + '>';
    commit.style.display = 'flex';
  }
};

LQ.startLesson = function (lessonId) {
  if (!LQ.isLessonUnlocked(lessonId)) {
    LQ.toast('Complete the previous lesson first');
    return;
  }
  LQ._lessonId = lessonId;
  LQ._lessonWords = LQ.wordsForLesson(lessonId);
  LQ._lessonPhase = 'learn';
  LQ._learnIdx = 0;
  LQ._exIdx = 0;
  LQ._lessonXp = 0;
  LQ._lessonHearts = 3;
  LQ._exercises = LQ.buildLessonExercises(LQ._lessonWords);
  LQ.goTo('lesson');
  LQ.renderLessonScreen();
};

LQ.buildLessonExercises = function (words) {
  const ex = [];
  words.forEach((w, i) => {
    if (i % 3 === 0) ex.push({ type: 'match', words: words.slice(i, i + 3).length >= 3 ? words.slice(i, i + 3) : words });
    else if (i % 3 === 1) ex.push({ type: 'mcq', word: w, mode: 'def' });
    else ex.push({ type: 'mcq', word: w, mode: 'word' });
  });
  return ex.slice(0, Math.max(4, Math.min(6, words.length + 1)));
};

LQ.renderLessonScreen = function () {
  const wrap = document.getElementById('lesson-wrap');
  const prog = document.getElementById('lesson-prog-fill');
  const hearts = document.getElementById('lesson-hearts');
  if (!wrap) return;
  const total = LQ._lessonWords.length + LQ._exercises.length;
  let current = LQ._learnIdx;
  if (LQ._lessonPhase === 'practice') current = LQ._lessonWords.length + LQ._exIdx;
  if (LQ._lessonPhase === 'tip') current = total - 1;
  if (prog) prog.style.width = Math.round((current / total) * 100) + '%';
  if (hearts) {
    hearts.innerHTML = [0, 1, 2].map((i) => '<span class="heart ' + (i >= LQ._lessonHearts ? 'dead' : '') + '">❤️</span>').join('');
  }

  if (LQ._lessonPhase === 'learn') {
    LQ.renderLearnSlide(wrap);
    return;
  }
  if (LQ._lessonPhase === 'tip') {
    LQ.renderTipSlide(wrap);
    return;
  }
  LQ.renderExercise(wrap);
};

LQ.renderLearnSlide = function (wrap) {
  const w = LQ._lessonWords[LQ._learnIdx];
  if (!w) {
    LQ._lessonPhase = 'practice';
    LQ._exIdx = 0;
    LQ.renderLessonScreen();
    return;
  }
  wrap.innerHTML =
    '<p class="lesson-phase-label">Learn</p>' +
    '<' + LQ.H + ' class="learn-card">' +
    '<span class="learn-badge">New word</span>' +
    '<h2 class="learn-word">' + w.word + '</h2>' +
    '<p class="learn-phon">' + w.phonetic + ' · ' + w.pos + '</p>' +
    '<p class="learn-def">' + w.def + '</p>' +
    '<p class="learn-ex">"' + w.example + '"</p>' +
    '<' + LQ.H + ' class="learn-syn"><strong>Synonyms:</strong> ' + w.syn + '</' + LQ.H + '>' +
    '</' + LQ.H + '>' +
    '<button class="lesson-cta" onclick="LQ.advanceLearn()">Got it →</button>';
};

LQ.advanceLearn = function () {
  LQ._learnIdx++;
  if (LQ._learnIdx >= LQ._lessonWords.length) {
    LQ._lessonPhase = 'practice';
    LQ._exIdx = 0;
  }
  LQ.renderLessonScreen();
};

LQ.renderTipSlide = function (wrap) {
  const tip = LQ.EXAM_TIPS[Math.floor(Math.random() * LQ.EXAM_TIPS.length)];
  wrap.innerHTML =
    '<p class="lesson-phase-label">Exam insight</p>' +
    '<' + LQ.H + ' class="tip-card">' +
    '<span class="tip-illus">💡</span>' +
    '<h3>' + tip.title + '</h3>' +
    '<p>' + tip.body + '</p>' +
    '</' + LQ.H + '>' +
    '<button class="lesson-cta" onclick="LQ.finishLesson()">Finish lesson</button>';
};

LQ.renderExercise = function (wrap) {
  const ex = LQ._exercises[LQ._exIdx];
  if (!ex) {
    LQ._lessonPhase = 'tip';
    LQ.renderLessonScreen();
    return;
  }
  if (ex.type === 'match') {
    LQ.renderMatchExercise(wrap, ex);
    return;
  }
  LQ.renderMcqExercise(wrap, ex);
};

LQ.renderMcqExercise = function (wrap, ex) {
  const w = ex.word;
  const pool = LQ.shuffle(LQ.getWords().filter((x) => x.word !== w.word)).slice(0, 3);
  const opts = LQ.shuffle(pool.concat([w]));
  const question = ex.mode === 'def' ? 'What does <strong>' + LQ.esc(w.word) + '</strong> mean?' : 'Which word matches this definition?';
  const prompt = ex.mode === 'def' ? '' : '<p class="lesson-prompt-def">' + LQ.esc(w.def) + '</p>';
  wrap.innerHTML =
    '<p class="lesson-phase-label">Practice</p>' +
    '<p class="lesson-question">' + question + '</p>' + prompt +
    opts.map((o, i) => {
      const label = ex.mode === 'def' ? o.def : o.word;
      return '<button type="button" class="lesson-opt" onclick="LQ.answerLessonMcq(' + i + ')">' + LQ.esc(label) + '</button>';
    }).join('') +
    '<' + LQ.H + ' class="lesson-feedback" id="lesson-fb"></' + LQ.H + '>';
  LQ._currentOpts = opts;
  LQ._currentWord = w;
  LQ._currentMode = ex.mode;
};

LQ.answerLessonMcq = function (idx) {
  const fb = document.getElementById('lesson-fb');
  const correct = LQ._currentOpts[idx].word === LQ._currentWord.word;
  if (fb) {
    fb.className = 'lesson-feedback show ' + (correct ? 'ok' : 'fail');
    fb.textContent = correct ? 'Correct!' : 'Answer: ' + LQ._currentWord.word;
  }
  document.querySelectorAll('.lesson-opt').forEach((b) => (b.disabled = true));
  if (correct) {
    LQ._lessonXp += 15;
    LQ.scheduleSrs(LQ._currentWord.word, 'good');
  } else {
    LQ._lessonHearts--;
    if (LQ._lessonHearts <= 0) {
      setTimeout(function () {
        LQ.toast('Out of hearts — review and try again');
        LQ.goTo('home');
      }, 900);
      return;
    }
  }
  setTimeout(function () {
    LQ._exIdx++;
    LQ.renderLessonScreen();
  }, correct ? 600 : 1000);
};

LQ.renderMatchExercise = function (wrap, ex) {
  const words = ex.words.slice(0, 4);
  LQ._matchWords = words;
  LQ._matchSelected = null;
  LQ._matchPairs = 0;
  const defs = LQ.shuffle(words.map((w) => ({ id: w.word, text: w.def })));
  wrap.innerHTML =
    '<p class="lesson-phase-label">Match pairs</p>' +
    '<p class="lesson-question">Tap a word, then its definition</p>' +
    '<' + LQ.H + ' class="match-grid">' +
    '<' + LQ.H + ' class="match-col" id="match-words">' +
    words.map((w) => '<button type="button" class="match-tile" data-side="word" data-id="' + LQ.esc(w.word) + '">' + LQ.esc(w.word) + '</button>').join('') +
    '</' + LQ.H + '>' +
    '<' + LQ.H + ' class="match-col" id="match-defs">' +
    defs.map((d) => '<button type="button" class="match-tile" data-side="def" data-id="' + LQ.esc(d.id) + '">' + LQ.esc(d.text) + '</button>').join('') +
    '</' + LQ.H + '></' + LQ.H + '>';
  wrap.querySelectorAll('.match-tile').forEach((btn) => {
    btn.onclick = function () {
      LQ.onMatchTap(btn);
    };
  });
};

LQ.onMatchTap = function (btn) {
  if (btn.classList.contains('matched')) return;
  const side = btn.dataset.side;
  const id = btn.dataset.id;
  if (!LQ._matchSelected) {
    LQ._matchSelected = { side, id, el: btn };
    btn.classList.add('selected');
    return;
  }
  if (LQ._matchSelected.side === side) {
    LQ._matchSelected.el.classList.remove('selected');
    LQ._matchSelected = { side, id, el: btn };
    btn.classList.add('selected');
    return;
  }
  const match = LQ._matchSelected.id === id && LQ._matchSelected.side !== side;
  if (match) {
    btn.classList.add('matched');
    LQ._matchSelected.el.classList.add('matched');
    LQ._matchSelected.el.classList.remove('selected');
    LQ._matchPairs++;
    LQ._matchSelected = null;
    LQ._lessonXp += 12;
    if (LQ._matchPairs >= LQ._matchWords.length) {
      setTimeout(function () {
        LQ._exIdx++;
        LQ.renderLessonScreen();
      }, 500);
    }
  } else {
    LQ._matchSelected.el.classList.remove('selected');
    LQ._matchSelected = null;
    LQ._lessonHearts--;
    if (LQ._lessonHearts <= 0) {
      LQ.toast('Out of hearts');
      LQ.goTo('home');
    }
  }
};

LQ.finishLesson = function () {
  LQ.S.lessonProgress = LQ.S.lessonProgress || {};
  LQ.S.lessonProgress[LQ._lessonId] = true;
  const bonus = 40 + LQ._lessonXp;
  LQ.S.xp += bonus;
  LQ.S.leagueXp = (LQ.S.leagueXp || 0) + bonus;
  if (LQ.S.xp >= LQ.S.xpMax) {
    LQ.S.xp -= LQ.S.xpMax;
    LQ.S.level++;
    LQ.S.xpMax = Math.floor(LQ.S.xpMax * 1.4);
    LQ.toast('🏆 Level ' + LQ.S.level + '!');
  }
  LQ.syncHomeUI();
  LQ.S.goalQuiz = (LQ.S.goalQuiz || 0) + LQ._exercises.length;
  LQ.recordStudyDay();
  LQ.bumpActivity();
  LQ.saveState();
  LQ._celebrateDone = function () {
    LQ.goTo('home');
    LQ.renderLearningPath();
  };
  LQ.showLessonComplete(bonus, {
    title: 'Lesson complete!',
    sub: 'You unlocked the next step on your path.',
  });
};
