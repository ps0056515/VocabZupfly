window.LQ = window.LQ || {};
const D = 'div';

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
    '<' + D + ' class="the-card pop-in"><' + D + ' class="card-tag-row"><span class="ctag pos">' + w.pos + '</span>' +
    w.tags.map((t) => '<span class="ctag ' + t.toLowerCase() + '">' + t + '</span>').join('') + prem + '</' + D + '>' +
    '<' + D + ' class="card-word">' + w.word + '</' + D + '><' + D + ' class="card-phon">' + w.phonetic + '</' + D + '>' +
    '<' + D + ' class="card-def">' + w.def + '</' + D + '><' + D + ' class="card-example">"' + w.example + '"</' + D + '>' +
    '<' + D + ' class="syn-ant"><' + D + ' class="syn-box syn"><h4>Synonyms</h4><p>' + w.syn + '</p></' + D + '>' +
    '<' + D + ' class="syn-box ant"><h4>Antonyms</h4><p>' + w.ant + '</p></' + D + '></' + D + '></' + D + '>';
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
    return '<' + D + ' class="qpip ' + c + '"></' + D + '>';
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
    card.innerHTML = '<' + D + ' class="quiz-label">What does this mean?</' + D + '><' + D + ' class="quiz-word">' + LQ.S.quizWord.word +
      '</' + D + '><' + D + ' class="quiz-hint">' + LQ.S.quizWord.phonetic + ' · ' + LQ.S.quizWord.pos + '</' + D + '>';
  }
  if (body) {
    const letters = ['A', 'B', 'C', 'D'];
    body.innerHTML = '<p class="quiz-question">Pick the definition</p>' + LQ.S.quizOpts.map((o, i) =>
      '<button class="opt" onclick="LQ.checkQ(' + i + ')"><span class="opt-letter">' + letters[i] + '</span>' + o.def + '</button>').join('') +
      '<' + D + ' class="quiz-feedback-box" id="qfb"></' + D + '><button class="quiz-next" id="qnext" onclick="LQ.advanceQuiz()">Next →</button>';
  }
  LQ.renderQuizPips();
};

LQ.checkQ = function (idx) {
  if (LQ.S.quizAnswered) return;
  LQ.S.quizAnswered = true;
  const btns = document.querySelectorAll('.opt');
  const correct = LQ.S.quizOpts[idx].word === LQ.S.quizWord.word;
  if (btns[idx]) btns[idx].classList.add(correct ? 'correct' : 'wrong');
  btns.forEach((b, i) => { b.disabled = true; if (LQ.S.quizOpts[i].word === LQ.S.quizWord.word) b.classList.add('correct'); });
  const fb = document.getElementById('qfb');
  if (fb) {
    fb.className = 'quiz-feedback-box show ' + (correct ? 'ok' : 'fail');
    fb.innerHTML = correct ? '✓ <b>' + LQ.S.quizWord.word + '</b>' : '✗ ' + LQ.S.quizWord.def;
  }
  if (correct) { LQ.gainXP(20); LQ._qScore++; LQ.scheduleSrs(LQ.S.quizWord.word, 'good'); }
  else { LQ.S.quizLives--; LQ.updateLives(); LQ.gainXP(5); if (LQ.S.quizLives <= 0) setTimeout(LQ.showQuizEnd, 800); }
  LQ.recordActivity(LQ.S.quizWord.word, correct ? 'good' : 'miss');
  const n = document.getElementById('qnext'); if (n) n.classList.add('show');
};

LQ.advanceQuiz = function () { LQ.S.quizIdx++; LQ.nextQuiz(); };

LQ.showQuizEnd = function () {
  const total = Math.min(10, LQ._qWords.length);
  const card = document.getElementById('quiz-card');
  const body = document.getElementById('quiz-body');
  if (card) card.innerHTML = '<p class="quiz-label">Done!</p><p class="quiz-word" style="font-size:48px">🏆</p><p style="color:#fff;font-size:22px;font-weight:700">' + LQ._qScore + '/' + total + '</p>';
  if (body) body.innerHTML = '<button class="quiz-next show" onclick="LQ.initQuiz()">Again</button><button class="quiz-next show" style="margin-top:10px;background:rgba(255,255,255,.08);color:#fff" onclick="goTo(\'home\')">Home</button>';
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
  wrap.innerHTML = '<p class="spell-def">' + w.def + '</p><' + D + ' class="spell-blanks" id="spell-blanks">' +
    Array(target.length).fill(0).map((_, i) => '<' + D + ' class="spell-blank" id="sb' + i + '"> </' + D + '>').join('') + '</' + D + '>' +
    '<' + D + ' class="spell-keyboard">' + pool.map((c) => '<button class="spell-key" onclick="LQ.spellTap(\'' + c + '\')">' + c + '</button>').join('') + '</' + D + '>' +
    '<' + D + ' class="spell-result" id="spell-result"></' + D + '><button class="spell-del" onclick="LQ.spellDel()">⌫</button><button class="spell-submit" onclick="LQ.spellSubmit()">Check</button>' +
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
  if (res) { res.className = 'spell-result show ' + (correct ? 'ok' : 'fail'); res.innerHTML = correct ? '✓' : '✗ <b>' + w.word + '</b>'; }
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
  const em = { new: '📍', learning: '📝', known: '⭐' };
  const filtered = LQ.getWords().filter((w) => {
    if (LQ.wbTag === 'Premium' && (!w.premium || !LQ.S.premium)) return false;
    const mq = !LQ.wbQ || w.word.toLowerCase().includes(LQ.wbQ.toLowerCase()) || w.def.toLowerCase().includes(LQ.wbQ.toLowerCase());
    const mt = LQ.wbTag === 'All' || (LQ.wbTag === 'Known' && LQ.S.mastery[w.word] === 'known') || (LQ.wbTag === 'Learning' && LQ.S.mastery[w.word] === 'learning') || w.tags.includes(LQ.wbTag);
    return mq && mt;
  });
  const el = document.getElementById('wb-list');
  const badge = document.getElementById('wb-count');
  if (badge) badge.textContent = String(filtered.length);
  if (!el) return;
  el.innerHTML = filtered.slice(0, 100).map((w) =>
    '<' + D + ' class="wb-item" onclick="LQ.speakText(\'' + w.word.replace(/'/g, '') + '\')"><' + D + ' class="mastery-ring ' + (LQ.S.mastery[w.word] || 'new') + '">' + em[LQ.S.mastery[w.word] || 'new'] + '</' + D + '><' + D + ' style="flex:1"><' + D + ' class="wb-item-word">' + w.word + '</' + D + '><' + D + ' class="wb-item-def">' + w.def + '</' + D + '></' + D + '></' + D + '>').join('');
};
LQ.filterWB = function (q) { LQ.wbQ = q; LQ.renderWB(); };
LQ.filterTag = function (btn, tag) { document.querySelectorAll('.fchip').forEach((b) => b.classList.remove('active')); btn.classList.add('active'); LQ.wbTag = tag; LQ.renderWB(); };
window.filterWB = LQ.filterWB; window.filterTag = LQ.filterTag;
