window.LQ = window.LQ || {};

/* ── Per-word difficulty (Easy / Medium / Hard) ── */

LQ.getWordDifficulty = function (wordName) {
  LQ.S.wordDifficulty = LQ.S.wordDifficulty || {};
  return LQ.S.wordDifficulty[wordName] || 'medium';
};

LQ.setWordDifficulty = function (wordName, level) {
  if (!wordName || !level) return;
  LQ.S.wordDifficulty = LQ.S.wordDifficulty || {};
  LQ.S.wordDifficulty[wordName] = level;
  LQ.saveState();
};

LQ.rateWordDifficulty = function (wordName, level) {
  LQ.setWordDifficulty(wordName, level);
  LQ.toast({ easy: '😊 Easy', medium: '😐 Medium', hard: '😓 Hard' }[level] || level);
};

LQ.filterByDifficulty = function (words, filter) {
  filter = filter || LQ.S.quizDifficultyFilter || 'all';
  if (filter === 'all') return words;
  return words.filter(function (w) {
    return LQ.getWordDifficulty(w.word) === filter;
  });
};

LQ.difficultyFilterHtml = function (current, onclickPrefix) {
  var opts = [
    { id: 'all', label: 'All levels' },
    { id: 'hard', label: '😓 Hard' },
    { id: 'medium', label: '😐 Medium' },
    { id: 'easy', label: '😊 Easy' },
  ];
  return (
    '<div class="quiz-list-chips">' +
    opts
      .map(function (o) {
        return (
          '<button type="button" class="quiz-list-chip' +
          (current === o.id ? ' active' : '') +
          '" onclick="' +
          onclickPrefix +
          '(\'' +
          o.id +
          '\')">' +
          o.label +
          '</button>'
        );
      })
      .join('') +
    '</div>'
  );
};

LQ.pickQuizDifficulty = function (level) {
  LQ.S.quizDifficultyFilter = level;
  LQ.saveState();
  LQ.initQuizSetup();
};

LQ.pickLearnDifficulty = function (level) {
  LQ.S.learnDifficultyFilter = level;
  LQ.saveState();
  LQ.initLearn();
};

LQ.pickReviseDifficulty = function (level) {
  LQ.S.reviseDifficultyFilter = level;
  LQ.saveState();
  LQ.initRevise();
};

LQ.renderReviseFilterBar = function () {
  var bar = document.getElementById('revise-list-bar');
  if (!bar || !LQ.difficultyFilterHtml) return;
  bar.innerHTML =
    '<p class="learn-list-label">Show difficulty</p>' +
    LQ.difficultyFilterHtml(LQ.S.reviseDifficultyFilter || 'all', 'LQ.pickReviseDifficulty');
};

LQ.wordDifficultyHtml = function (wordName) {
  var d = LQ.getWordDifficulty(wordName);
  var safe = String(wordName).replace(/'/g, "\\'");
  var labels = { easy: '😊 Easy', medium: '😐 Medium', hard: '😓 Hard' };
  return (
    '<div class="word-difficulty">' +
    ['easy', 'medium', 'hard']
      .map(function (level) {
        return (
          '<button type="button" class="diff-chip' +
          (d === level ? ' active' : '') +
          '" onclick="LQ.rateWordDifficulty(\'' +
          safe +
          "','" +
          level +
          '\');LQ.renderLearnScreen()">' +
          labels[level] +
          '</button>'
        );
      })
      .join('') +
    '</div>'
  );
};

/* ── Quiz builder settings ── */

LQ.pickQuizMode = function (mode) {
  LQ.S.quizMode = mode;
  LQ.saveState();
  LQ.initQuizSetup();
};

LQ.pickQuizCount = function (n) {
  LQ.S.quizQuestionCount = n;
  LQ.saveState();
  LQ.initQuizSetup();
};

LQ.pickQuizTime = function (sec) {
  LQ.S.quizTimeLimitSec = sec;
  LQ.saveState();
  LQ.initQuizSetup();
};

LQ.getQuizQuestionCount = function () {
  var n = LQ.S.quizQuestionCount || 10;
  return Math.max(4, Math.min(25, n));
};

LQ.renderQuizBuilderHtml = function () {
  var mode = LQ.S.quizMode || 'mcq';
  var count = LQ.getQuizQuestionCount();
  var timeSec = LQ.S.quizTimeLimitSec || 0;
  var diff = LQ.S.quizDifficultyFilter || 'all';
  var modes = [
    { id: 'mcq', label: 'Multiple choice' },
    { id: 'blank', label: 'Fill in blank' },
    { id: 'tc', label: 'Text completion' },
    { id: 'se', label: 'Sentence equiv.' },
  ];
  var counts = [5, 10, 15, 20];
  var times = [
    { sec: 0, label: 'No limit' },
    { sec: 300, label: '5 min' },
    { sec: 600, label: '10 min' },
    { sec: 900, label: '15 min' },
  ];
  return (
    '<div class="quiz-builder">' +
    '<p class="quiz-list-label">Quiz type</p><div class="quiz-list-chips">' +
    modes
      .map(function (m) {
        return (
          '<button type="button" class="quiz-list-chip' +
          (mode === m.id ? ' active' : '') +
          '" onclick="LQ.pickQuizMode(\'' +
          m.id +
          '\')">' +
          m.label +
          '</button>'
        );
      })
      .join('') +
    '</div>' +
    '<p class="quiz-list-label">Difficulty filter</p>' +
    LQ.difficultyFilterHtml(diff, 'LQ.pickQuizDifficulty') +
    '<p class="quiz-list-label">Questions</p><div class="quiz-list-chips">' +
    counts
      .map(function (c) {
        return (
          '<button type="button" class="quiz-list-chip' +
          (count === c ? ' active' : '') +
          '" onclick="LQ.pickQuizCount(' +
          c +
          ')">' +
          c +
          '</button>'
        );
      })
      .join('') +
    '</div>' +
    '<p class="quiz-list-label">Time limit</p><div class="quiz-list-chips">' +
    times
      .map(function (t) {
        return (
          '<button type="button" class="quiz-list-chip' +
          (timeSec === t.sec ? ' active' : '') +
          '" onclick="LQ.pickQuizTime(' +
          t.sec +
          ')">' +
          t.label +
          '</button>'
        );
      })
      .join('') +
    '</div>' +
    '<button type="button" class="quiz-start-btn" onclick="LQ.startQuizSession()">Start quiz ▶</button></div>'
  );
};

LQ.setQuizPhase = function (phase) {
  LQ._quizPhase = phase || 'setup';
  var sc = document.getElementById('screen-quiz');
  if (!sc) return;
  sc.classList.remove('quiz-phase-setup', 'quiz-phase-active', 'quiz-phase-done');
  sc.classList.add('quiz-phase-' + LQ._quizPhase);
  var scope = document.getElementById('quiz-scope-label');
  if (scope && phase === 'setup') scope.textContent = LQ.getQuizScopeLabel();
  var edit = document.getElementById('quiz-edit-link');
  if (edit) edit.style.display = phase === 'active' ? '' : 'none';
};

LQ.updateQuizProgressChrome = function () {
  var scope = document.getElementById('quiz-scope-label');
  if (!scope || LQ._quizPhase !== 'active') return;
  var total = LQ.quizQuestionTotal ? LQ.quizQuestionTotal() : (LQ._qWords || []).length;
  scope.textContent =
    LQ.getQuizScopeLabel() + ' · Question ' + (LQ.S.quizIdx + 1) + ' of ' + total;
};

LQ.initQuizSetup = function () {
  LQ.setQuizPhase('setup');
  if (LQ.renderQuizListPicker) LQ.renderQuizListPicker();
  LQ.stopQuizTimer();
  var card = document.getElementById('quiz-card');
  var body = document.getElementById('quiz-body');
  var row = document.getElementById('quiz-prog-row');
  if (row) row.innerHTML = '';
  if (card) {
    card.innerHTML =
      '<p class="quiz-label">Custom quiz</p>' +
      '<p class="quiz-word" style="font-size:22px">Ready when you are</p>' +
      '<p class="quiz-hint">Pick list, type, and options — then tap Start</p>';
  }
  if (body) body.innerHTML = '';
  var timerEl = document.getElementById('quiz-timer');
  if (timerEl) timerEl.textContent = '';
};

LQ.startQuizSession = function () {
  LQ.setQuizPhase('active');
  if (LQ.initQuiz) LQ.initQuiz();
};

LQ.applyQuizPoolFilters = function (pool) {
  pool = LQ.filterByDifficulty(pool, LQ.S.quizDifficultyFilter || 'all');
  return pool;
};

/* ── Quiz timer ── */

LQ._quizTimerId = null;

LQ.stopQuizTimer = function () {
  if (LQ._quizTimerId) {
    clearInterval(LQ._quizTimerId);
    LQ._quizTimerId = null;
  }
};

LQ.startQuizTimerIfNeeded = function () {
  LQ.stopQuizTimer();
  var sec = LQ.S.quizTimeLimitSec || 0;
  if (!sec) return;
  LQ._quizTimeLeft = sec;
  LQ.updateQuizTimerDisplay();
  LQ._quizTimerId = setInterval(function () {
    LQ._quizTimeLeft--;
    LQ.updateQuizTimerDisplay();
    if (LQ._quizTimeLeft <= 0) {
      LQ.stopQuizTimer();
      LQ.toast('Time is up!');
      if (LQ.showQuizEnd) LQ.showQuizEnd();
    }
  }, 1000);
};

LQ.updateQuizTimerDisplay = function () {
  var el = document.getElementById('quiz-timer');
  if (!el) return;
  if (!LQ.S.quizTimeLimitSec) {
    el.textContent = '';
    return;
  }
  var s = Math.max(0, LQ._quizTimeLeft || 0);
  var m = Math.floor(s / 60);
  var r = s % 60;
  el.textContent = m + ':' + (r < 10 ? '0' : '') + r;
};

/* ── Quiz modes ── */

LQ.quizQuestionTotal = function () {
  return Math.min(LQ.getQuizQuestionCount(), (LQ._qWords || []).length);
};

LQ.blankSentence = function (w) {
  var ex = (w.example || '').replace(/<[^>]+>/g, '');
  if (ex && ex.toLowerCase().indexOf(w.word.toLowerCase()) >= 0) {
    return ex.replace(new RegExp(w.word, 'i'), '______');
  }
  return 'The meaning fits best when you fill in ______ here.';
};

LQ.afterQuizQuestionRender = function () {
  if (LQ.renderQuizPips) LQ.renderQuizPips();
  if (LQ.updateQuizProgressChrome) LQ.updateQuizProgressChrome();
};

LQ.dispatchQuizQuestion = function () {
  var mode = LQ.S.quizMode || 'mcq';
  if (mode === 'blank') return LQ.renderQuizBlank();
  if (mode === 'tc') return LQ.renderQuizTextCompletion();
  if (mode === 'se') return LQ.renderQuizSentenceEquiv();
  return LQ.renderQuizMcq();
};

LQ.renderQuizMcq = function () {
  var total = LQ.quizQuestionTotal();
  if (LQ.S.quizIdx >= total || LQ.S.quizLives <= 0) {
    LQ.showQuizEnd();
    return;
  }
  LQ.S.quizAnswered = false;
  LQ.S.quizWord = LQ._qWords[LQ.S.quizIdx];
  var distractorPool = LQ._quizPool && LQ._quizPool.length >= 4 ? LQ._quizPool : LQ.getWords();
  var wrong = LQ.shuffle(
    distractorPool.filter(function (x) {
      return x.word !== LQ.S.quizWord.word && x.def;
    })
  ).slice(0, 3);
  if (wrong.length < 3) {
    wrong = wrong.concat(
      LQ.shuffle(
        LQ.getWords().filter(function (x) {
          return x.word !== LQ.S.quizWord.word && x.def && !wrong.some(function (w) {
            return w.word === x.word;
          });
        })
      ).slice(0, 3 - wrong.length)
    );
  }
  LQ.S.quizOpts = LQ.shuffle(wrong.concat([LQ.S.quizWord]));
  var card = document.getElementById('quiz-card');
  var body = document.getElementById('quiz-body');
  if (card) {
    card.innerHTML =
      '<p class="quiz-label">' +
      LQ.esc(LQ.getQuizScopeLabel()) +
      ' · MCQ</p><p class="quiz-word">' +
      LQ.esc(LQ.S.quizWord.word) +
      '</p><p class="quiz-hint">' +
      LQ.esc(LQ.S.quizWord.phonetic) +
      ' · ' +
      LQ.esc(LQ.S.quizWord.pos) +
      '</p>';
  }
  if (body) {
    var letters = ['A', 'B', 'C', 'D'];
    body.innerHTML =
      '<p class="quiz-question">Pick the definition</p>' +
      LQ.S.quizOpts
        .map(function (o, i) {
          return (
            '<button type="button" class="opt" onclick="LQ.checkQ(' +
            i +
            ')"><span class="opt-letter">' +
            letters[i] +
            '</span>' +
            LQ.esc(LQ.displayWordDef ? LQ.displayWordDef(o) : o.def) +
            '</button>'
          );
        })
        .join('') +
      '<div class="quiz-feedback-box" id="qfb"></div><button class="quiz-next" id="qnext" onclick="LQ.advanceQuiz()">Next →</button>';
  }
  if (LQ.afterQuizQuestionRender) LQ.afterQuizQuestionRender();
};

LQ.renderQuizBlank = function () {
  var total = LQ.quizQuestionTotal();
  if (LQ.S.quizIdx >= total || LQ.S.quizLives <= 0) {
    LQ.showQuizEnd();
    return;
  }
  LQ.S.quizAnswered = false;
  LQ.S.quizWord = LQ._qWords[LQ.S.quizIdx];
  var card = document.getElementById('quiz-card');
  var body = document.getElementById('quiz-body');
  if (card) {
    card.innerHTML =
      '<p class="quiz-label">' +
      LQ.esc(LQ.getQuizScopeLabel()) +
      ' · Fill in the blank</p><p class="quiz-hint">' +
      LQ.esc(LQ.displayWordDef ? LQ.displayWordDef(LQ.S.quizWord) : LQ.S.quizWord.def) +
      '</p>';
  }
  if (body) {
    body.innerHTML =
      '<p class="quiz-question">Type the missing word</p>' +
      '<p class="quiz-blank-sent">"' +
      LQ.blankSentence(LQ.S.quizWord) +
      '"</p>' +
      '<input type="text" class="quiz-blank-input" id="quiz-blank-input" placeholder="Your answer…" autocomplete="off" onkeydown="if(event.key===\'Enter\')LQ.checkQuizBlank()">' +
      '<button type="button" class="quiz-next show" onclick="LQ.checkQuizBlank()">Check</button>' +
      '<div class="quiz-feedback-box" id="qfb"></div><button class="quiz-next" id="qnext" onclick="LQ.advanceQuiz()">Next →</button>';
    setTimeout(function () {
      var inp = document.getElementById('quiz-blank-input');
      if (inp) inp.focus();
    }, 50);
  }
  if (LQ.afterQuizQuestionRender) LQ.afterQuizQuestionRender();
};

LQ.checkQuizBlank = function () {
  if (LQ.S.quizAnswered) return;
  var inp = document.getElementById('quiz-blank-input');
  var guess = (inp && inp.value ? inp.value : '').trim();
  if (!guess) {
    LQ.toast('Type your answer');
    return;
  }
  LQ.S.quizAnswered = true;
  LQ._quizAnswered = (LQ._quizAnswered || 0) + 1;
  var correct = guess.toLowerCase() === LQ.S.quizWord.word.toLowerCase();
  LQ.finishQuizAnswer(correct);
};

LQ.renderQuizTextCompletion = function () {
  var total = LQ.quizQuestionTotal();
  if (LQ.S.quizIdx >= total || LQ.S.quizLives <= 0) {
    LQ.showQuizEnd();
    return;
  }
  LQ.S.quizAnswered = false;
  LQ.S.quizWord = LQ._qWords[LQ.S.quizIdx];
  var pool = LQ._quizPool || LQ.getWords();
  var wrong = LQ.shuffle(
    pool.filter(function (x) {
      return x.word !== LQ.S.quizWord.word;
    })
  ).slice(0, 4);
  LQ.S.quizOpts = LQ.shuffle(wrong.concat([LQ.S.quizWord])).slice(0, 5);
  var sent = LQ.blankSentence(LQ.S.quizWord);
  var card = document.getElementById('quiz-card');
  var body = document.getElementById('quiz-body');
  if (card) {
    card.innerHTML = '<p class="quiz-label">Text completion · GRE style</p><p class="quiz-word" style="font-size:20px;line-height:1.5">"' + sent + '"</p>';
  }
  if (body) {
    body.innerHTML =
      '<p class="quiz-question">Choose the word that best fits the blank</p>' +
      LQ.S.quizOpts
        .map(function (o, i) {
          return (
            '<button type="button" class="opt" onclick="LQ.checkQuizTc(' +
            i +
            ')"><span class="opt-letter">' +
            String.fromCharCode(65 + i) +
            '</span>' +
            LQ.esc(o.word) +
            '</button>'
          );
        })
        .join('') +
      '<div class="quiz-feedback-box" id="qfb"></div><button class="quiz-next" id="qnext" onclick="LQ.advanceQuiz()">Next →</button>';
  }
  if (LQ.afterQuizQuestionRender) LQ.afterQuizQuestionRender();
};

LQ.checkQuizTc = function (idx) {
  if (LQ.S.quizAnswered) return;
  LQ.S.quizAnswered = true;
  LQ._quizAnswered = (LQ._quizAnswered || 0) + 1;
  var correct = LQ.S.quizOpts[idx].word === LQ.S.quizWord.word;
  document.querySelectorAll('.opt').forEach(function (b, i) {
    b.disabled = true;
    if (LQ.S.quizOpts[i].word === LQ.S.quizWord.word) b.classList.add('correct');
    if (i === idx && !correct) b.classList.add('wrong');
  });
  LQ.finishQuizAnswer(correct);
};

LQ.renderQuizSentenceEquiv = function () {
  var total = LQ.quizQuestionTotal();
  if (LQ.S.quizIdx >= total || LQ.S.quizLives <= 0) {
    LQ.showQuizEnd();
    return;
  }
  LQ.S.quizAnswered = false;
  LQ.S.quizWord = LQ._qWords[LQ.S.quizIdx];
  var pool = LQ._quizPool || [];
  var syns = (LQ.S.quizWord.syn || '')
    .split(/[,;]/)
    .map(function (s) {
      return s.trim();
    })
    .filter(Boolean);
  var partner = null;
  for (var i = 0; i < syns.length; i++) {
    partner = LQ.wordByName(syns[i]);
    if (partner) break;
  }
  if (!partner) {
    partner = LQ.shuffle(
      pool.filter(function (x) {
        return x.word !== LQ.S.quizWord.word;
      })
    )[0];
  }
  LQ._sePartner = partner;
  var choices = LQ.shuffle(
    pool
      .filter(function (x) {
        return x.word !== LQ.S.quizWord.word && (!partner || x.word !== partner.word);
      })
      .slice(0, 4)
      .concat([LQ.S.quizWord, partner].filter(Boolean))
  ).slice(0, 6);
  LQ.S.quizOpts = choices;
  var card = document.getElementById('quiz-card');
  var body = document.getElementById('quiz-body');
  if (card) {
    card.innerHTML =
      '<p class="quiz-label">Sentence equivalence · pick TWO synonyms</p>' +
      '<p class="quiz-hint">Target sense: ' +
      LQ.esc(LQ.displayWordDef ? LQ.displayWordDef(LQ.S.quizWord) : LQ.S.quizWord.def) +
      '</p>';
  }
  LQ._seSelected = [];
  if (body) {
    body.innerHTML =
      '<p class="quiz-question">Select exactly two words with similar meaning</p>' +
      choices
        .map(function (o, i) {
          return (
            '<button type="button" class="opt se-opt" data-i="' +
            i +
            '" onclick="LQ.toggleSeChoice(' +
            i +
            ')"><span class="opt-letter">' +
            String.fromCharCode(65 + i) +
            '</span>' +
            LQ.esc(o.word) +
            '</button>'
          );
        })
        .join('') +
      '<button type="button" class="quiz-next show" onclick="LQ.checkQuizSe()">Submit pair</button>' +
      '<div class="quiz-feedback-box" id="qfb"></div><button class="quiz-next" id="qnext" onclick="LQ.advanceQuiz()">Next →</button>';
  }
  if (LQ.afterQuizQuestionRender) LQ.afterQuizQuestionRender();
};

LQ.toggleSeChoice = function (idx) {
  if (LQ.S.quizAnswered) return;
  var sel = LQ._seSelected || [];
  var pos = sel.indexOf(idx);
  if (pos >= 0) sel.splice(pos, 1);
  else if (sel.length < 2) sel.push(idx);
  LQ._seSelected = sel;
  document.querySelectorAll('.se-opt').forEach(function (btn, i) {
    btn.classList.toggle('selected', sel.indexOf(i) >= 0);
  });
};

LQ.checkQuizSe = function () {
  if (LQ.S.quizAnswered) return;
  if ((LQ._seSelected || []).length !== 2) {
    LQ.toast('Pick exactly two words');
    return;
  }
  LQ.S.quizAnswered = true;
  LQ._quizAnswered = (LQ._quizAnswered || 0) + 1;
  var w1 = LQ.S.quizOpts[LQ._seSelected[0]];
  var w2 = LQ.S.quizOpts[LQ._seSelected[1]];
  var target = LQ.S.quizWord.word;
  var partner = LQ._sePartner && LQ._sePartner.word;
  var words = [w1.word, w2.word].sort().join('|');
  var expected = [target, partner || ''].sort().join('|');
  var correct = words === expected || (w1.word === target && w2.word === target);
  if (!correct && partner) {
    correct =
      (w1.word === target && w2.word === partner) || (w2.word === target && w1.word === partner);
  }
  document.querySelectorAll('.se-opt').forEach(function (b) {
    b.disabled = true;
  });
  LQ.finishQuizAnswer(correct);
};

LQ.finishQuizAnswer = function (correct) {
  var wordObj = LQ.S.quizWord || {};
  var wordName = wordObj.word || '';

  var fb = document.getElementById('qfb');
  if (fb) {
    fb.className = 'quiz-feedback-box show ' + (correct ? 'ok' : 'fail');
    fb.innerHTML = correct
      ? '✓ <b>' + LQ.esc(wordName) + '</b>'
      : '✗ Answer: <b>' + LQ.esc(wordName) + '</b>';
  }

  try {
    if (correct) {
      if (LQ.gainXP) LQ.gainXP(20);
      LQ._qScore = (LQ._qScore || 0) + 1;
      if (wordName && LQ.scheduleSrs) LQ.scheduleSrs(wordName, 'good');
    } else {
      LQ.S.quizLives = (LQ.S.quizLives !== undefined ? LQ.S.quizLives : 3) - 1;
      if (LQ.updateLives) LQ.updateLives();
      if (LQ.gainXP) LQ.gainXP(5);
      LQ._quizMisses = LQ._quizMisses || [];
      if (wordObj && wordObj.word) LQ._quizMisses.push(wordObj);
      if (LQ.S.quizLives <= 0) {
        setTimeout(function () {
          if (LQ.showQuizEnd) LQ.showQuizEnd();
        }, 800);
      }
    }
    if (wordName && LQ.recordActivity) {
      LQ.recordActivity(wordName, correct ? 'good' : 'miss');
    }
  } catch (err) {
    console.warn('[Quiz] Error in finishQuizAnswer stat updates:', err);
  }

  var nextBtn = document.getElementById('qnext');
  if (nextBtn) nextBtn.classList.add('show');
  if (LQ._quizAdvanceTimer) clearTimeout(LQ._quizAdvanceTimer);
  if (!correct && LQ.S.quizLives <= 0) return;
  var delay = correct ? 850 : 1200;
  LQ._quizAdvanceTimer = setTimeout(function () {
    LQ._quizAdvanceTimer = null;
    if (LQ.S.quizLives <= 0) return;
    if (LQ.advanceQuiz) LQ.advanceQuiz();
  }, delay);
};

/* ── Session analytics ── */

LQ.recordQuizSession = function (correct, total) {
  LQ.S.quizSessions = LQ.S.quizSessions || [];
  var d = new Date();
  var week = d.getFullYear() + '-W' + LQ.isoWeek(d);
  LQ.S.quizSessions.unshift({
    at: Date.now(),
    week: week,
    listId: LQ.S.quizListId || 'all',
    groupId: LQ.S.quizGroupId || null,
    mode: LQ.S.quizMode || 'mcq',
    correct: correct,
    total: total,
  });
  if (LQ.S.quizSessions.length > 80) LQ.S.quizSessions.length = 80;
  LQ.saveState();
};

LQ.isoWeek = function (d) {
  var t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  var y = t.getUTCFullYear();
  var start = new Date(Date.UTC(y, 0, 1));
  return Math.ceil(((t - start) / 86400000 + 1) / 7);
};

LQ.computeAnalytics = function () {
  var sessions = LQ.S.quizSessions || [];
  var byList = {};
  var byGroup = {};
  var byWeek = {};
  sessions.forEach(function (s) {
    var lid = s.listId || 'all';
    if (!byList[lid]) byList[lid] = { correct: 0, total: 0 };
    byList[lid].correct += s.correct;
    byList[lid].total += s.total;
    if (s.groupId) {
      if (!byGroup[s.groupId]) byGroup[s.groupId] = { correct: 0, total: 0, id: s.groupId };
      byGroup[s.groupId].correct += s.correct;
      byGroup[s.groupId].total += s.total;
    }
    if (!byWeek[s.week]) byWeek[s.week] = { correct: 0, total: 0 };
    byWeek[s.week].correct += s.correct;
    byWeek[s.week].total += s.total;
  });
  var weakest = [];
  Object.keys(byGroup).forEach(function (gid) {
    var g = byGroup[gid];
    var hit = LQ.findGroup(gid);
    var acc = g.total ? Math.round((g.correct / g.total) * 100) : 0;
    weakest.push({
      id: gid,
      title: hit ? LQ.formatGroupTitle(hit.group.title) : gid,
      listTitle: hit ? LQ.getListTitle(hit.list.id, hit.list.title) : '',
      accuracy: acc,
      total: g.total,
    });
  });
  weakest.sort(function (a, b) {
    return a.accuracy - b.accuracy || b.total - a.total;
  });
  return { byList: byList, byGroup: byGroup, byWeek: byWeek, weakestGroups: weakest.slice(0, 10) };
};

LQ.renderAnalyticsHtml = function () {
  var a = LQ.computeAnalytics();
  var listRows = Object.keys(a.byList)
    .map(function (lid) {
      var row = a.byList[lid];
      var acc = row.total ? Math.round((row.correct / row.total) * 100) : 0;
      var title = lid === 'all' ? 'All lists' : LQ.getListTitle(lid, lid);
      return (
        '<div class="analytics-row"><span>' +
        LQ.esc(title) +
        '</span><span>' +
        acc +
        '% · ' +
        row.total +
        ' Q</span></div>'
      );
    })
    .join('');
  var weekRows = Object.keys(a.byWeek)
    .slice(0, 6)
    .map(function (w) {
      var row = a.byWeek[w];
      var acc = row.total ? Math.round((row.correct / row.total) * 100) : 0;
      return (
        '<div class="analytics-row"><span>' +
        LQ.esc(w) +
        '</span><span>' +
        acc +
        '% · ' +
        row.total +
        ' Q</span></div>'
      );
    })
    .join('');
  var weakRows = a.weakestGroups.length
    ? a.weakestGroups
        .map(function (g) {
          return (
            '<button type="button" class="analytics-weak" onclick="LQ.startListQuiz(\'' +
            (LQ.findGroup(g.id) ? LQ.findGroup(g.id).list.id : 'all') +
            '\',\'' +
            g.id +
            '\')">' +
            LQ.esc(g.listTitle + ' · ' + g.title) +
            ' <span>' +
            g.accuracy +
            '%</span></button>'
          );
        })
        .join('')
    : '<p class="analytics-empty">Take a few group quizzes to see weak areas here.</p>';
  return (
    '<section class="analytics-panel">' +
    '<h3>Quiz analytics</h3>' +
    '<div class="analytics-grid">' +
    '<div class="analytics-card"><h4>By list</h4>' +
    (listRows || '<p class="analytics-empty">No quiz data yet</p>') +
    '</div>' +
    '<div class="analytics-card"><h4>By week</h4>' +
    (weekRows || '<p class="analytics-empty">No quiz data yet</p>') +
    '</div></div>' +
    '<div class="analytics-card"><h4>Weakest groups</h4>' +
    weakRows +
    '</div></section>'
  );
};

/* ── Exam study plan ── */

LQ.buildStudyPlan = function () {
  var counts = LQ.getWordCounts ? LQ.getWordCounts() : { unmarked: 0, flagged: 0, known: 0 };
  var days = LQ.daysUntilExam(LQ.S.examDate || '');
  var left = counts.unmarked + counts.flagged;
  var d = days == null ? 30 : Math.max(1, days);
  var wordsPerDay = Math.ceil(left / d);
  var quizzesPerWeek = Math.min(7, Math.max(2, Math.ceil(d / 7)));
  var minutes = LQ.S.dailyMinutes || 15;
  return {
    daysLeft: days,
    wordsLeft: left,
    wordsPerDay: wordsPerDay,
    quizzesPerWeek: quizzesPerWeek,
    dailyMinutes: minutes,
    focus:
      counts.flagged > 0
        ? 'Revise ' + Math.min(counts.flagged, wordsPerDay) + ' flagged words first'
        : 'Learn ' + wordsPerDay + ' new words',
  };
};

LQ.renderStudyPlanHtml = function () {
  var plan = LQ.buildStudyPlan();
  if (plan.daysLeft == null) {
    return (
      '<p class="dash-study-plan-note">Set your exam date in <button type="button" class="dash-link-btn" onclick="goTo(\'settings\')">Settings</button> for a personalised plan.</p>'
    );
  }
  return (
    '<ul class="dash-study-plan">' +
    '<li><strong>' +
    plan.wordsPerDay +
    ' words/day</strong> to finish ' +
    plan.wordsLeft +
    ' remaining</li>' +
    '<li><strong>' +
    plan.quizzesPerWeek +
    ' quizzes/week</strong> to keep recall sharp</li>' +
    '<li><strong>' +
    plan.dailyMinutes +
    ' min/day</strong> suggested study time</li>' +
    '<li>Today: ' +
    LQ.esc(plan.focus) +
    '</li></ul>'
  );
};

/* ── Tutor helpers: roots & mnemonics ── */

LQ.WORD_ROOTS = {
  ab: 'away, off',
  ad: 'to, toward',
  anti: 'against',
  bene: 'good, well',
  chron: 'time',
  dict: 'say, speak',
  dis: 'apart, not',
  equ: 'equal',
  ex: 'out',
  fore: 'before',
  inter: 'between',
  mal: 'bad',
  mis: 'wrong',
  omni: 'all',
  post: 'after',
  pre: 'before',
  re: 'again, back',
  sub: 'under',
  trans: 'across',
  un: 'not',
};

LQ.guessWordRoot = function (word) {
  var w = (word || '').toLowerCase();
  var keys = Object.keys(LQ.WORD_ROOTS).sort(function (a, b) {
    return b.length - a.length;
  });
  for (var i = 0; i < keys.length; i++) {
    if (w.indexOf(keys[i]) === 0) {
      return { root: keys[i], meaning: LQ.WORD_ROOTS[keys[i]] };
    }
  }
  return null;
};

LQ.generateMnemonic = function (word) {
  var w = word.word;
  var def = (word.def || '').toLowerCase();
  var root = LQ.guessWordRoot(w);
  if (root) {
    return 'Think **' + root.root + '-** = "' + root.meaning + '" → **' + w + '** fits: ' + (word.def || '').replace(/^Vocabulary word.*/, 'related meaning');
  }
  if (/fear|afraid|timid|daunt|intimid/.test(def)) {
    return 'Picture something **daunting** — your stomach drops. Link that feeling to **' + w + '**.';
  }
  if (/different|dissimilar|dispar/.test(def)) {
    return '**Dis-** = apart. **' + w + '** = things far apart in kind.';
  }
  return 'Say **' + w + '** aloud three times while picturing one vivid scene from the example sentence.';
};

LQ.tutorSentence = function (word) {
  var ex = LQ.getWordExamplePlain ? LQ.getWordExamplePlain(word) : (word.example || '').replace(/<[^>]+>/g, '');
  if (ex && ex.indexOf('Study ') !== 0 && ex.indexOf('In the "') !== 0) {
    return '**Example:** "' + ex + '"\n\nTry writing your own sentence using **' + word.word + '**.';
  }
  var w = word.word.toLowerCase();
  return (
    '**Sample sentence:** "The reviewer called the proposal **' +
    w +
    '**, which helped clarify the author\'s main point."\n\nWrite one sentence using **' +
    word.word +
    '** about your own study routine.'
  );
};
