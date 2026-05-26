window.LQ = window.LQ || {};

LQ.renderFC = function () {
  LQ.buildFcQueue();
  const w = LQ.currentFcWord();
  if (!w) return;
  const q = LQ.S.fcQueue;
  const fc = document.getElementById('fc-counter');
  const fp = document.getElementById('fc-prog');
  if (fc) fc.textContent = (LQ.S.fcIdx + 1) + ' / ' + q.length;
  if (fp) fp.style.width = ((LQ.S.fcIdx + 1) / Math.max(1, q.length)) * 100 + '%';
  const stage = document.getElementById('card-stage');
  if (!stage) return;
  const prem = w.premium ? '<span class="ctag premium">PRO</span>' : '';
  stage.innerHTML =
    '<' + LQ.H + ' class="the-card pop-in"><' + LQ.H + ' class="card-tag-row"><span class="ctag pos">' + w.pos + '</span>' +
    w.tags.map((t) => '<span class="ctag ' + t.toLowerCase() + '">' + t + '</span>').join('') + prem + '</' + LQ.H + '>' +
    '<' + LQ.H + ' class="card-word">' + w.word + '</' + LQ.H + '><' + LQ.H + ' class="card-phon">' + w.phonetic + '</' + LQ.H + '>' +
    '<' + LQ.H + ' class="card-def">' + w.def + '</' + LQ.H + '><' + LQ.H + ' class="card-example">"' + w.example + '"</' + LQ.H + '>' +
    '<' + LQ.H + ' class="syn-ant"><' + LQ.H + ' class="syn-box syn"><h4>Synonyms</h4><p>' + w.syn + '</p></' + LQ.H + '>' +
    '<' + LQ.H + ' class="syn-box ant"><h4>Antonyms</h4><p>' + w.ant + '</p></' + LQ.H + '></' + LQ.H + '></' + LQ.H + '>';
};

LQ.rate = function (r) {
  const w = LQ.currentFcWord();
  if (!w) return;
  const xpG = { miss: 3, hard: 10, good: 18, nailed: 28 }[r];
  LQ.S.mastery[w.word] = { miss: 'new', hard: 'learning', good: 'learning', nailed: 'known' }[r];
  LQ.scheduleSrs(w.word, r);
  LQ.recordActivity(w.word, r);
  LQ.gainXP(xpG);
  LQ.S.goalSeen++;
  if (r === 'nailed') LQ.S.goalNew++;
  LQ.updateGoal();
  LQ.toast({ miss: 'Keep going!', hard: 'Almost!', good: 'Solid!', nailed: '🎯 Mastered!' }[r]);
  LQ.S.fcIdx = (LQ.S.fcIdx + 1) % Math.max(1, LQ.S.fcQueue.length);
  LQ.saveState();
  LQ.renderFC();
};
window.rate = LQ.rate;
window.speakWord = function () { LQ.speakWord(); };
window.loadAIHint = function () { LQ.loadAIHint(); };

LQ.shuffle = function (a) {
  const b = a.slice();
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
};

LQ._qWords = [];
LQ._qScore = 0;

LQ.initQuiz = function () {
  LQ.S.quizLives = 3;
  LQ.S.quizAnswered = false;
  LQ._qScore = 0;
  LQ._quizMisses = [];
  LQ._quizAnswered = 0;
  const pool = LQ.S.premium ? LQ.getWords() : LQ.getWords().filter((w) => !w.premium);
  LQ._qWords = LQ.shuffle(pool).slice(0, 15);
  LQ.S.quizIdx = 0;
  LQ.renderQuizPips();
  LQ.updateLives();
  LQ.nextQuiz();
};

LQ.renderQuizPips = function () {
  const row = document.getElementById('quiz-prog-row');
  const total = Math.min(10, LQ._qWords.length);
  if (!row) return;
  row.innerHTML = Array.from({ length: total }, (_, i) => {
    const c = i < LQ.S.quizIdx ? 'done' : i === LQ.S.quizIdx ? 'current' : '';
    return '<' + LQ.H + ' class="qpip ' + c + '"></' + LQ.H + '>';
  }).join('');
};

LQ.updateLives = function () {
  const el = document.getElementById('quiz-lives');
  if (!el) return;
  el.innerHTML = [0, 1, 2].map((i) => '<span class="heart ' + (i >= LQ.S.quizLives ? 'dead' : '') + '">❤️</span>').join('');
};

LQ.nextQuiz = function () {
  const total = Math.min(10, LQ._qWords.length);
  if (LQ.S.quizIdx >= total || LQ.S.quizLives <= 0) { LQ.showQuizEnd(); return; }
  LQ.S.quizAnswered = false;
  LQ.S.quizWord = LQ._qWords[LQ.S.quizIdx];
  const wrong = LQ.shuffle(LQ.getWords().filter((x) => x.word !== LQ.S.quizWord.word)).slice(0, 3);
  LQ.S.quizOpts = LQ.shuffle(wrong.concat([LQ.S.quizWord]));
  const card = document.getElementById('quiz-card');
  const body = document.getElementById('quiz-body');
  if (card) {
    card.innerHTML = '<' + LQ.H + ' class="quiz-label">What does this mean?</' + LQ.H + '><' + LQ.H + ' class="quiz-word">' + LQ.esc(LQ.S.quizWord.word) +
      '</' + LQ.H + '><' + LQ.H + ' class="quiz-hint">' + LQ.esc(LQ.S.quizWord.phonetic) + ' · ' + LQ.esc(LQ.S.quizWord.pos) + '</' + LQ.H + '>';
  }
  if (body) {
    const letters = ['A', 'B', 'C', 'D'];
    body.innerHTML = '<p class="quiz-question">Pick the definition</p>' + LQ.S.quizOpts.map((o, i) =>
      '<button type="button" class="opt" onclick="LQ.checkQ(' + i + ')"><span class="opt-letter">' + letters[i] + '</span>' + LQ.esc(o.def) + '</button>').join('') +
      '<' + LQ.H + ' class="quiz-feedback-box" id="qfb"></' + LQ.H + '><button class="quiz-next" id="qnext" onclick="LQ.advanceQuiz()">Next →</button>';
  }
  LQ.renderQuizPips();
};

LQ.checkQ = function (idx) {
  if (LQ.S.quizAnswered) return;
  LQ.S.quizAnswered = true;
  LQ._quizAnswered = (LQ._quizAnswered || 0) + 1;
  const btns = document.querySelectorAll('.opt');
  const correct = LQ.S.quizOpts[idx].word === LQ.S.quizWord.word;
  if (btns[idx]) btns[idx].classList.add(correct ? 'correct' : 'wrong');
  btns.forEach((b, i) => { b.disabled = true; if (LQ.S.quizOpts[i].word === LQ.S.quizWord.word) b.classList.add('correct'); });
  const fb = document.getElementById('qfb');
  if (fb) {
    fb.className = 'quiz-feedback-box show ' + (correct ? 'ok' : 'fail');
    fb.innerHTML = correct ? '✓ <b>' + LQ.esc(LQ.S.quizWord.word) + '</b>' : '✗ ' + LQ.esc(LQ.S.quizWord.def);
  }
  if (correct) { LQ.gainXP(20); LQ._qScore++; LQ.scheduleSrs(LQ.S.quizWord.word, 'good'); }
  else {
    LQ.S.quizLives--;
    LQ.updateLives();
    LQ.gainXP(5);
    LQ._quizMisses = LQ._quizMisses || [];
    LQ._quizMisses.push(LQ.S.quizWord);
    if (LQ.S.quizLives <= 0) setTimeout(LQ.showQuizEnd, 800);
  }
  LQ.recordActivity(LQ.S.quizWord.word, correct ? 'good' : 'miss');
  const n = document.getElementById('qnext'); if (n) n.classList.add('show');
};

LQ.advanceQuiz = function () { LQ.S.quizIdx++; LQ.nextQuiz(); };

LQ.showQuizEnd = function () {
  const total = LQ._quizAnswered || Math.min(10, LQ._qWords.length);
  LQ.S.goalQuiz = (LQ.S.goalQuiz || 0) + LQ._qScore;
  LQ.updateGoal();
  if (LQ.recordQuizResult) LQ.recordQuizResult(LQ._qScore, total, LQ._quizMisses || []);
  LQ.saveState();
  if (LQ.renderQuizReview) {
    LQ.renderQuizReview(LQ._qScore, total, LQ._quizMisses || []);
    if (LQ.renderVocabPage) LQ.renderVocabPage();
    return;
  }
  const card = document.getElementById('quiz-card');
  const body = document.getElementById('quiz-body');
  if (card) card.innerHTML = '<p class="quiz-label">Done!</p><p class="quiz-word" style="font-size:48px">🏆</p><p class="quiz-word" style="font-size:22px">' + LQ._qScore + '/' + total + '</p>';
  if (body) body.innerHTML = LQ.renderFlowComplete
    ? LQ.renderFlowComplete({ context: 'quiz', title: 'Quiz complete!', score: LQ._qScore + '/' + total, icon: '🏆' })
    : '<button class="quiz-next show" onclick="LQ.initQuiz()">Again</button><button class="quiz-next portal-btn-secondary show" style="margin-top:10px" onclick="LQ.goBack()">Back</button>';
};

LQ.initSpelling = function () {
  const pool = LQ.S.premium ? LQ.getWords() : LQ.getWords().filter((w) => !w.premium);
  LQ._spellWords = LQ.shuffle(pool);
  LQ.S.spellIdx = 0;
  LQ.renderSpell();
};

LQ.renderSpell = function () {
  const list = LQ._spellWords || [];
  const w = list[LQ.S.spellIdx % list.length];
  if (!w) return;
  LQ.S.spellGuess = []; LQ.S.spellAnswered = false;
  document.getElementById('spell-counter').textContent = (LQ.S.spellIdx + 1) + ' / ' + list.length;
  document.getElementById('spell-prog').style.width = ((LQ.S.spellIdx + 1) / list.length) * 100 + '%';
  const target = w.word.toUpperCase();
  const extras = LQ.shuffle('ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').filter((c) => !target.includes(c))).slice(0, 4);
  const pool = LQ.shuffle([...new Set(target.split(''))].concat(extras));
  const wrap = document.getElementById('spell-wrap');
  if (!wrap) return;
  wrap.innerHTML = '<p class="spell-def">' + LQ.esc(w.def) + '</p><' + LQ.H + ' class="spell-blanks" id="spell-blanks">' +
    Array(target.length).fill(0).map((_, i) => '<' + LQ.H + ' class="spell-blank" id="sb' + i + '"> </' + LQ.H + '>').join('') + '</' + LQ.H + '>' +
    '<' + LQ.H + ' class="spell-keyboard">' + pool.map((c) => '<button class="spell-key" onclick="LQ.spellTap(\'' + c + '\')">' + c + '</button>').join('') + '</' + LQ.H + '>' +
    '<' + LQ.H + ' class="spell-result" id="spell-result"></' + LQ.H + '><button class="spell-del" onclick="LQ.spellDel()">⌫</button><button class="spell-submit" onclick="LQ.spellSubmit()">Check</button>' +
    '<button class="spell-next" id="spell-next-btn" onclick="LQ.spellNext()">Next →</button>';
};

LQ.spellTap = function (c) {
  if (LQ.S.spellAnswered) return;
  const w = LQ._spellWords[LQ.S.spellIdx % LQ._spellWords.length];
  if (LQ.S.spellGuess.length >= w.word.length) return;
  LQ.S.spellGuess.push(c);
  LQ.renderBlanks();
};

LQ.spellDel = function () { if (!LQ.S.spellAnswered && LQ.S.spellGuess.length) { LQ.S.spellGuess.pop(); LQ.renderBlanks(); } };

LQ.renderBlanks = function () {
  const w = LQ._spellWords[LQ.S.spellIdx % LQ._spellWords.length];
  for (let i = 0; i < w.word.length; i++) {
    const el = document.getElementById('sb' + i);
    if (!el) continue;
    el.textContent = LQ.S.spellGuess[i] || ' ';
    el.classList.toggle('filled', !!LQ.S.spellGuess[i]);
  }
};

LQ.spellSubmit = function () {
  const w = LQ._spellWords[LQ.S.spellIdx % LQ._spellWords.length];
  if (LQ.S.spellGuess.length < w.word.length) { LQ.toast('Fill all letters'); return; }
  LQ.S.spellAnswered = true;
  const target = w.word.toUpperCase();
  const guess = LQ.S.spellGuess.join('');
  const correct = guess === target;
  const res = document.getElementById('spell-result');
  if (res) { res.className = 'spell-result show ' + (correct ? 'ok' : 'fail'); res.innerHTML = correct ? '✓' : '✗ <b>' + LQ.esc(w.word) + '</b>'; }
  if (correct) { LQ.gainXP(30); LQ.S.mastery[w.word] = 'known'; LQ.scheduleSrs(w.word, 'nailed'); }
  else { LQ.gainXP(5); LQ.scheduleSrs(w.word, 'miss'); }
  LQ.recordActivity(w.word, correct ? 'nailed' : 'miss');
  LQ.saveState();
  document.getElementById('spell-next-btn').classList.add('show');
};

LQ.spellNext = function () { LQ.S.spellIdx++; LQ.saveState(); LQ.renderSpell(); };
window.spellTap = LQ.spellTap; window.spellDel = LQ.spellDel; window.spellSubmit = LQ.spellSubmit; window.spellNext = LQ.spellNext;
window.speakSpellWord = function () { LQ.speakSpellWord(); };

LQ.wbTag = 'All'; LQ.wbQ = '';
LQ.renderWB = function () {
  const em = { new: '📍', learning: '📝', known: '⭐', flagged: '🚩' };
  if (LQ._wbSearchPrefill) {
    LQ.wbQ = LQ._wbSearchPrefill;
    LQ._wbSearchPrefill = '';
    const inp = document.getElementById('wb-search');
    if (inp) inp.value = LQ.wbQ;
  }
  const filtered = LQ.getWords().filter((w) => {
    if (LQ.wbTag === 'Premium' && (!w.premium || !LQ.S.premium)) return false;
    const mq = !LQ.wbQ || w.word.toLowerCase().includes(LQ.wbQ.toLowerCase()) || w.def.toLowerCase().includes(LQ.wbQ.toLowerCase());
    const m = LQ.S.mastery[w.word] || 'new';
    const mt =
      LQ.wbTag === 'All' ||
      (LQ.wbTag === 'Known' && m === 'known') ||
      (LQ.wbTag === 'Flagged' && m === 'flagged') ||
      (LQ.wbTag === 'Learning' && m === 'learning') ||
      w.tags.includes(LQ.wbTag);
    return mq && mt;
  });
  const el = document.getElementById('wb-list');
  const badge = document.getElementById('wb-count');
  if (badge) badge.textContent = String(filtered.length);
  if (!el) return;
  el.innerHTML = filtered.slice(0, 100).map((w) =>
    '<' + LQ.H + ' class="wb-item" onclick="LQ.speakText(\'' + w.word.replace(/'/g, '') + '\')"><' + LQ.H + ' class="mastery-ring ' + (LQ.S.mastery[w.word] || 'new') + '">' + em[LQ.S.mastery[w.word] || 'new'] + '</' + LQ.H + '><' + LQ.H + ' style="flex:1"><' + LQ.H + ' class="wb-item-word">' + w.word + '</' + LQ.H + '><' + LQ.H + ' class="wb-item-def">' + w.def + '</' + LQ.H + '></' + LQ.H + '></' + LQ.H + '>').join('');
};
LQ.filterWB = function (q) { LQ.wbQ = q; LQ.renderWB(); };
LQ.filterTag = function (btn, tag) { document.querySelectorAll('.fchip').forEach((b) => b.classList.remove('active')); btn.classList.add('active'); LQ.wbTag = tag; LQ.renderWB(); };
window.filterWB = LQ.filterWB; window.filterTag = LQ.filterTag;

/* ── MOCK TEST (same pattern as quiz) ── */
LQ._mockTimer = null;
LQ._mockWords = [];
LQ._mockPool = [];
LQ._mockIdx = 0;
LQ._mockScore = 0;
LQ._mockLeft = 0;
LQ._mockOpts = [];
LQ._mockAnswered = false;

LQ.mockWordPool = function () {
  const S = LQ.S || {};
  return LQ.getWords().filter(function (w) {
    return !w.premium || S.premium;
  });
};

LQ.initMock = function () {
  clearInterval(LQ._mockTimer);
  const legacy = document.getElementById('mock-wrap');
  if (legacy) legacy.remove();

  const run = function () {
    const pool = LQ.shuffle(LQ.mockWordPool());
    const total = Math.min(LQ.Config.mockQuestionCount || 20, pool.length);
    const card = document.getElementById('mock-card');
    const body = document.getElementById('mock-body');
    if (!card && !body) {
      LQ.toast('Mock screen outdated — hard refresh the app');
      return;
    }
    if (total < 4) {
      if (card) {
        card.innerHTML = '<p class="quiz-label">Not enough words</p><p class="quiz-word" style="font-size:22px">Need 4+ words</p>';
      }
      if (body) {
        body.innerHTML =
          '<p class="quiz-question">Add more words or switch exam focus to ALL in Settings.</p>' +
          '<button class="quiz-next show" onclick="goTo(\'home\')">Home</button>';
      }
      return;
    }
    LQ._mockPool = pool;
    LQ._mockWords = pool.slice(0, total);
    LQ._mockIdx = 0;
    LQ._mockScore = 0;
    LQ._mockLeft = (LQ.Config.mockMinutes || 10) * 60;
    LQ._mockAnswered = false;
    LQ.renderMockPips();
    LQ.updateMockTimer();
    LQ.nextMock();
    clearInterval(LQ._mockTimer);
    LQ._mockTimer = setInterval(function () {
      LQ._mockLeft--;
      LQ.updateMockTimer();
      if (LQ._mockLeft <= 0) LQ.endMock();
    }, 1000);
  };

  const waitForWords = function () {
    if (body) {
      body.innerHTML = '<p class="quiz-question" style="color:rgba(255,255,255,.5)">Preparing questions…</p>';
    }
    return Promise.race([
      LQ.wordsReady,
      new Promise(function (resolve) {
        setTimeout(resolve, 8000);
      }),
    ]).then(run);
  };

  const body = document.getElementById('mock-body');
  if (LQ.WORDS.length) run();
  else waitForWords();
};

LQ.initMockStudy = LQ.initMock;

LQ.updateMockTimer = function () {
  const t = document.getElementById('mock-timer');
  if (!t) return;
  const m = Math.floor(LQ._mockLeft / 60);
  const s = LQ._mockLeft % 60;
  t.textContent = m + ':' + (s < 10 ? '0' : '') + s;
};

LQ.renderMockPips = function () {
  const row = document.getElementById('mock-prog-row');
  if (!row || !LQ._mockWords.length) return;
  row.innerHTML = LQ._mockWords.map(function (_, i) {
    const c = i < LQ._mockIdx ? 'done' : i === LQ._mockIdx ? 'current' : '';
    return '<' + LQ.H + ' class="qpip ' + c + '"></' + LQ.H + '>';
  }).join('');
};

LQ.nextMock = function () {
  if (!LQ._mockWords.length || LQ._mockIdx >= LQ._mockWords.length) {
    LQ.endMock();
    return;
  }
  LQ._mockAnswered = false;
  const w = LQ._mockWords[LQ._mockIdx];
  const others = LQ._mockPool.filter(function (x) {
    return x.word !== w.word;
  });
  const wrong = LQ.shuffle(others).slice(0, 3);
  LQ._mockOpts = LQ.shuffle(wrong.concat([w]));
  const card = document.getElementById('mock-card');
  const body = document.getElementById('mock-body');
  if (card) {
    card.innerHTML =
      '<p class="quiz-label">Question ' + (LQ._mockIdx + 1) + ' of ' + LQ._mockWords.length + '</p>' +
      '<p class="quiz-word">' + LQ.esc(w.word) + '</p>' +
      '<p class="quiz-hint">' + LQ.esc(w.phonetic) + ' · ' + LQ.esc(w.pos) + '</p>';
  }
  if (body) {
    const letters = ['A', 'B', 'C', 'D'];
    body.innerHTML =
      '<p class="quiz-question">Pick the definition</p>' +
      LQ._mockOpts.map(function (o, i) {
        return (
          '<button type="button" class="opt" onclick="LQ.checkMock(' + i + ')">' +
          '<span class="opt-letter">' + letters[i] + '</span>' + LQ.esc(o.def) + '</button>'
        );
      }).join('') +
      '<' + LQ.H + ' class="quiz-feedback-box" id="mock-fb"></' + LQ.H + '>' +
      '<button class="quiz-next" id="mock-next" onclick="LQ.advanceMock()">Next →</button>';
  }
  LQ.renderMockPips();
};

LQ.checkMock = function (idx) {
  if (LQ._mockAnswered) return;
  LQ._mockAnswered = true;
  const w = LQ._mockWords[LQ._mockIdx];
  const correct = LQ._mockOpts[idx].word === w.word;
  const btns = document.querySelectorAll('#mock-body .opt');
  if (btns[idx]) btns[idx].classList.add(correct ? 'correct' : 'wrong');
  btns.forEach(function (b, i) {
    b.disabled = true;
    if (LQ._mockOpts[i].word === w.word) b.classList.add('correct');
  });
  const fb = document.getElementById('mock-fb');
  if (fb) {
    fb.className = 'quiz-feedback-box show ' + (correct ? 'ok' : 'fail');
    fb.innerHTML = correct ? '✓ <b>' + LQ.esc(w.word) + '</b>' : '✗ ' + LQ.esc(w.def);
  }
  if (correct) {
    LQ._mockScore++;
    LQ.gainXP(15);
    LQ.scheduleSrs(w.word, 'good');
  } else {
    LQ.gainXP(5);
  }
  LQ.recordActivity(w.word, correct ? 'good' : 'miss');
  const n = document.getElementById('mock-next');
  if (n) n.classList.add('show');
};

LQ.advanceMock = function () {
  LQ._mockIdx++;
  LQ.nextMock();
};

LQ.endMock = function () {
  clearInterval(LQ._mockTimer);
  const total = LQ._mockWords.length || 0;
  const pct = total ? Math.round((LQ._mockScore / total) * 100) : 0;
  if (total && LQ.S) {
    LQ.S.mockHistory = LQ.S.mockHistory || [];
    LQ.S.mockHistory.unshift({ score: LQ._mockScore, total: total, pct: pct, at: Date.now() });
    LQ.gainXP(50);
    LQ.S.goalQuiz = (LQ.S.goalQuiz || 0) + LQ._mockScore;
    LQ.updateGoal();
    LQ.saveState();
  }
  const card = document.getElementById('mock-card');
  const body = document.getElementById('mock-body');
  if (card) {
    card.innerHTML =
      '<p class="quiz-label">Mock complete</p><p class="quiz-word" style="font-size:48px">🏆</p>' +
      '<p class="quiz-word" style="font-size:22px">' + LQ._mockScore + '/' + total + ' · ' + pct + '%</p>';
  }
  if (body) {
    body.innerHTML =
      '<button class="quiz-next show" onclick="LQ.initMock()">Try again</button>' +
      '<button class="quiz-next portal-btn-secondary show" style="margin-top:10px" onclick="goTo(\'home\')">Home</button>';
  }
};
