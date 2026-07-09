window.LQ = window.LQ || {};

LQ.TENSES_MODULES = [
  {
    id: 'sentence-repeating',
    title: 'Sentence Repeating',
    desc: 'Repeat sentences to improve speaking & memory',
    icon: '🎤',
    color: '#3b82f6',
  },
  {
    id: 'short-stories',
    title: 'Short Stories',
    desc: 'Short story format for comprehension and speaking practice',
    icon: '📖',
    color: '#8b5cf6',
  },
  {
    id: 'just-a-minute',
    title: 'Just a Minute',
    desc: 'Speak on a topic for 60 seconds',
    icon: '💬',
    color: '#ec4899',
  },
  {
    id: 'sentence-reading',
    title: 'Sentence Reading',
    desc: 'Read sentences aloud with pronunciation feedback',
    icon: '🧠',
    color: '#6366f1',
  },
  {
    id: 'passage-comprehension',
    title: 'Passage Comprehensions',
    desc: 'Read passages and answer questions',
    icon: '📄',
    color: '#14b8a6',
  },
  {
    id: 'grammar',
    title: 'Grammar',
    desc: 'Grammar questions for accuracy',
    icon: '🎓',
    color: '#22c55e',
  },
  {
    id: 'essay-writing',
    title: 'Essay Writing',
    desc: 'Write a short essay on a given topic',
    icon: '✍️',
    color: '#f59e0b',
  },
  {
    id: 'jumbled-sentences',
    title: 'Jumbled Sentences',
    desc: 'Reorder words or phrases to form correct sentences',
    icon: '🔀',
    color: '#eab308',
  },
  {
    id: 'story-retelling',
    title: 'Story Retelling',
    desc: 'Read a story and retell it in your own words',
    icon: '📚',
    color: '#ef4444',
  },
];

LQ.TENSES_CONTENT = null;

LQ.tensesReady = fetch('data/tenses-content.json')
  .then(function (r) {
    if (!r.ok) throw new Error('tenses-content.json ' + r.status);
    return r.json();
  })
  .then(function (data) {
    LQ.TENSES_CONTENT = data;
    return data;
  })
  .catch(function (err) {
    console.warn('tenses-content.json failed', err);
    LQ.TENSES_CONTENT = {};
    return {};
  });

LQ.ensureTensesProgress = function () {
  if (!LQ.S.tensesProgress) LQ.S.tensesProgress = {};
  LQ.TENSES_MODULES.forEach(function (m) {
    if (!LQ.S.tensesProgress[m.id]) {
      LQ.S.tensesProgress[m.id] = { solved: 0, correct: 0 };
    }
  });
};

LQ.getTensesModuleProgress = function (moduleId) {
  LQ.ensureTensesProgress();
  const prog = LQ.S.tensesProgress[moduleId] || { solved: 0, correct: 0 };
  const items = (LQ.TENSES_CONTENT && LQ.TENSES_CONTENT[moduleId]) || [];
  const total = Math.max(items.length, 1);
  const readiness = Math.min(100, Math.round((prog.solved / total) * 100));
  return { solved: prog.solved, correct: prog.correct, total: total, readiness: readiness };
};

LQ.recordTensesResult = function (moduleId, correct) {
  LQ.ensureTensesProgress();
  const p = LQ.S.tensesProgress[moduleId];
  p.solved++;
  if (correct) p.correct++;
  LQ.recordStudyDay();
  LQ.gainXP(correct ? 15 : 5);
  LQ.saveState();
};

LQ.renderTensesPage = async function () {
  await LQ.tensesReady;
  LQ.ensureTensesProgress();
  const root = document.getElementById('tenses-grid');
  if (!root) return;

  root.innerHTML = LQ.TENSES_MODULES.map(function (m) {
    const prog = LQ.getTensesModuleProgress(m.id);
    return (
      '<article class="tenses-module-card">' +
      '<div class="tenses-module-head">' +
      '<span class="tenses-module-icon" style="background:' +
      m.color +
      '">' +
      m.icon +
      '</span>' +
      '<div><h3 class="tenses-module-title">' +
      LQ.esc(m.title) +
      '</h3>' +
      '<p class="tenses-module-desc">' +
      LQ.esc(m.desc) +
      '</p></div></div>' +
      '<div class="tenses-module-score-row">' +
      '<span>Readiness Score</span><strong>' +
      prog.readiness +
      '%</strong></div>' +
      '<div class="tenses-module-bar"><div class="tenses-module-fill" style="width:' +
      prog.readiness +
      '%;background:' +
      m.color +
      '"></div></div>' +
      '<p class="tenses-module-solved">Questions Solved: <strong>' +
      prog.solved +
      '</strong></p>' +
      '<button type="button" class="tenses-practice-btn" style="background:' +
      m.color +
      '" onclick="LQ.startTensesPractice(\'' +
      m.id +
      '\')">Practice</button></article>'
    );
  }).join('');
};

LQ.startTensesPractice = async function (moduleId) {
  await LQ.tensesReady;
  const items = (LQ.TENSES_CONTENT && LQ.TENSES_CONTENT[moduleId]) || [];
  if (!items.length) {
    LQ.toast('No content for this module yet');
    return;
  }
  const mod = LQ.TENSES_MODULES.find(function (m) {
    return m.id === moduleId;
  });
  LQ._tensesModule = moduleId;
  LQ._tensesItems = items.slice();
  LQ._tensesIdx = LQ.S.tensesProgress[moduleId].solved % items.length;
  LQ._tensesModMeta = mod;
  goTo('tenses-practice');
};

LQ.initTensesPractice = function () {
  const wrap = document.getElementById('tenses-practice-wrap');
  const title = document.getElementById('tenses-practice-title');
  if (!wrap || !LQ._tensesModule) return;
  const mod = LQ._tensesModMeta || { title: 'Practice', color: '#c0392b' };
  if (title) title.textContent = mod.title;
  const item = LQ._tensesItems[LQ._tensesIdx % LQ._tensesItems.length];
  const renderers = {
    'sentence-repeating': LQ.renderTensesSentenceRepeat,
    'short-stories': LQ.renderTensesShortStory,
    'just-a-minute': LQ.renderTensesJustAMinute,
    'sentence-reading': LQ.renderTensesSentenceReading,
    'passage-comprehension': LQ.renderTensesPassage,
    grammar: LQ.renderTensesGrammar,
    'essay-writing': LQ.renderTensesEssay,
    'jumbled-sentences': LQ.renderTensesJumbled,
    'story-retelling': LQ.renderTensesRetelling,
  };
  const fn = renderers[LQ._tensesModule];
  if (fn) fn.call(LQ, wrap, item, mod);
};

/* ── Practice renderers ── */

LQ.tensesSpeakCurrent = function () {
  var text = LQ._tensesSpeakText || (LQ._tensesCurrent && LQ._tensesCurrent.text);
  if (!text) {
    LQ.toast('Nothing to read aloud');
    return;
  }
  if (LQ.speakText) LQ.speakText(text);
};

LQ.renderTensesSentenceRepeat = function (wrap, item) {
  LQ._tensesCurrent = item;
  LQ._tensesSpeakText = item.text;
  wrap.innerHTML =
    '<p class="tenses-practice-label">Listen, then repeat this sentence aloud:</p>' +
    '<p class="tenses-practice-text">' +
    LQ.esc(item.text) +
    '</p>' +
    '<div class="tenses-practice-actions">' +
    '<button type="button" class="tenses-action-btn" onclick="LQ.tensesSpeakCurrent()">🔊 Hear sentence</button>' +
    '<button type="button" class="tenses-action-btn tenses-action-primary" onclick="LQ.tensesCheckRepeat()">🎤 I repeated it</button>' +
    '</div>' +
    '<p class="tenses-hint" id="tenses-feedback"></p>';
};

LQ.tensesCheckRepeat = function () {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const fb = document.getElementById('tenses-feedback');
  if (!SR) {
    LQ.recordTensesResult(LQ._tensesModule, true);
    if (fb) fb.textContent = '✓ Marked complete — speech check needs Chrome or Android WebView.';
    setTimeout(LQ.tensesNextItem, 1200);
    return;
  }
  const rec = new SR();
  rec.lang = 'en-US';
  rec.interimResults = false;
  if (fb) fb.textContent = 'Listening…';
  rec.onresult = function (e) {
    const said = (e.results[0][0].transcript || '').trim().toLowerCase();
    const target = LQ._tensesCurrent.text.toLowerCase().replace(/[^\w\s]/g, '');
    const words = target.split(/\s+/).filter(Boolean);
    const matched = words.filter(function (w) {
      return said.includes(w);
    }).length;
    const ok = matched >= Math.ceil(words.length * 0.6);
    if (fb) {
      fb.className = 'tenses-hint ' + (ok ? 'ok' : 'fail');
      fb.textContent = ok ? '✓ Good repetition!' : 'Heard: "' + said + '" — try again or tap Skip.';
    }
    if (ok) {
      LQ.recordTensesResult(LQ._tensesModule, true);
      setTimeout(LQ.tensesNextItem, 1400);
    }
  };
  rec.onerror = function () {
    if (fb) fb.textContent = 'Could not hear you — tap Skip if you practiced aloud.';
  };
  rec.start();
};

LQ.renderTensesShortStory = function (wrap, item) {
  LQ._tensesStoryQ = 0;
  LQ._tensesStoryCorrect = 0;
  wrap.innerHTML =
    '<h3 class="tenses-story-title">' +
    LQ.esc(item.title) +
    '</h3>' +
    '<p class="tenses-passage">' +
    LQ.esc(item.story) +
    '</p>' +
    '<button type="button" class="tenses-action-btn tenses-action-primary" onclick="LQ.tensesShowStoryQ()">Answer questions →</button>';
  LQ._tensesCurrent = item;
};

LQ.tensesShowStoryQ = function () {
  const wrap = document.getElementById('tenses-practice-wrap');
  const item = LQ._tensesCurrent;
  const qi = LQ._tensesStoryQ || 0;
  const q = item.questions[qi];
  if (!q || !wrap) return;
  wrap.innerHTML =
    '<p class="tenses-practice-label">Question ' +
    (qi + 1) +
    ' of ' +
    item.questions.length +
    '</p>' +
    '<p class="tenses-practice-text">' +
    LQ.esc(q.q) +
    '</p>' +
    '<div class="tenses-options">' +
    q.options
      .map(function (opt, i) {
        return (
          '<button type="button" class="tenses-opt" onclick="LQ.tensesAnswerStory(' +
          i +
          ')">' +
          LQ.esc(opt) +
          '</button>'
        );
      })
      .join('') +
    '</div>' +
    '<p class="tenses-hint" id="tenses-feedback"></p>';
};

LQ.tensesAnswerStory = function (idx) {
  const item = LQ._tensesCurrent;
  const qi = LQ._tensesStoryQ || 0;
  const q = item.questions[qi];
  const ok = idx === q.answer;
  if (ok) LQ._tensesStoryCorrect++;
  const fb = document.getElementById('tenses-feedback');
  if (fb) {
    fb.className = 'tenses-hint ' + (ok ? 'ok' : 'fail');
    fb.textContent = ok ? '✓ Correct!' : '✗ Correct: ' + q.options[q.answer];
  }
  LQ._tensesStoryQ = qi + 1;
  if (LQ._tensesStoryQ >= item.questions.length) {
    const allOk = LQ._tensesStoryCorrect === item.questions.length;
    LQ.recordTensesResult(LQ._tensesModule, allOk);
    setTimeout(LQ.tensesNextItem, 1400);
  } else {
    setTimeout(LQ.tensesShowStoryQ, 900);
  }
};

LQ.renderTensesJustAMinute = function (wrap, item) {
  LQ._tensesTimer = null;
  LQ._tensesSeconds = 60;
  wrap.innerHTML =
    '<p class="tenses-practice-label">Speak for 60 seconds on this topic:</p>' +
    '<p class="tenses-practice-text tenses-topic">' +
    LQ.esc(item.topic) +
    '</p>' +
    '<div class="tenses-timer" id="tenses-timer">1:00</div>' +
    '<div class="tenses-practice-actions">' +
    '<button type="button" class="tenses-action-btn tenses-action-primary" id="tenses-jam-start" onclick="LQ.tensesStartJam()">▶ Start timer</button>' +
    '<button type="button" class="tenses-action-btn" id="tenses-jam-done" style="display:none" onclick="LQ.tensesFinishJam()">✓ Done speaking</button>' +
    '</div>' +
    '<p class="tenses-hint">Use present, past, and future tenses where they fit naturally.</p>';
};

LQ.tensesStartJam = function () {
  const btn = document.getElementById('tenses-jam-start');
  const done = document.getElementById('tenses-jam-done');
  if (btn) btn.style.display = 'none';
  if (done) done.style.display = '';
  LQ._tensesSeconds = 60;
  clearInterval(LQ._tensesTimer);
  LQ._tensesTimer = setInterval(function () {
    LQ._tensesSeconds--;
    const el = document.getElementById('tenses-timer');
    const m = Math.floor(LQ._tensesSeconds / 60);
    const s = LQ._tensesSeconds % 60;
    if (el) el.textContent = m + ':' + String(s).padStart(2, '0');
    if (LQ._tensesSeconds <= 0) {
      clearInterval(LQ._tensesTimer);
      LQ.tensesFinishJam();
    }
  }, 1000);
};

LQ.tensesFinishJam = function () {
  clearInterval(LQ._tensesTimer);
  LQ.recordTensesResult(LQ._tensesModule, true);
  LQ.toast('✓ One minute complete!');
  setTimeout(LQ.tensesNextItem, 800);
};

LQ.renderTensesSentenceReading = function (wrap, item) {
  LQ._tensesSpeakText = item.text;
  wrap.innerHTML =
    '<p class="tenses-practice-label">Read this sentence aloud:</p>' +
    '<p class="tenses-practice-text">' +
    LQ.esc(item.text) +
    '</p>' +
    '<div class="tenses-practice-actions">' +
    '<button type="button" class="tenses-action-btn" onclick="LQ.tensesSpeakCurrent()">🔊 Model pronunciation</button>' +
    '<button type="button" class="tenses-action-btn tenses-action-primary" onclick="LQ.tensesMarkReading()">✓ I read it aloud</button>' +
    '</div>';
};

LQ.tensesMarkReading = function () {
  LQ.recordTensesResult(LQ._tensesModule, true);
  LQ.toast('✓ Nice reading!');
  setTimeout(LQ.tensesNextItem, 700);
};

LQ.renderTensesPassage = function (wrap, item) {
  LQ._tensesStoryQ = 0;
  LQ._tensesStoryCorrect = 0;
  LQ._tensesCurrent = item;
  wrap.innerHTML =
    '<p class="tenses-practice-label">Read the passage, then answer:</p>' +
    '<p class="tenses-passage">' +
    LQ.esc(item.passage) +
    '</p>' +
    '<button type="button" class="tenses-action-btn tenses-action-primary" onclick="LQ.tensesShowPassageQ()">Start questions →</button>';
};

LQ.tensesShowPassageQ = function () {
  LQ.tensesShowStoryQ();
};

LQ.renderTensesGrammar = function (wrap, item) {
  wrap.innerHTML =
    '<p class="tenses-practice-label">Choose the correct answer:</p>' +
    '<p class="tenses-practice-text">' +
    LQ.esc(item.q) +
    '</p>' +
    '<div class="tenses-options">' +
    item.options
      .map(function (opt, i) {
        return (
          '<button type="button" class="tenses-opt" onclick="LQ.tensesAnswerGrammar(' +
          i +
          ')">' +
          LQ.esc(opt) +
          '</button>'
        );
      })
      .join('') +
    '</div>' +
    '<p class="tenses-hint" id="tenses-feedback"></p>';
  LQ._tensesCurrent = item;
};

LQ.tensesAnswerGrammar = function (idx) {
  const item = LQ._tensesCurrent;
  const ok = idx === item.answer;
  const fb = document.getElementById('tenses-feedback');
  if (fb) {
    fb.className = 'tenses-hint ' + (ok ? 'ok' : 'fail');
    fb.textContent = ok ? '✓ ' + (item.explain || 'Correct!') : '✗ ' + (item.explain || item.options[item.answer]);
  }
  document.querySelectorAll('.tenses-opt').forEach(function (b) {
    b.disabled = true;
  });
  LQ.recordTensesResult(LQ._tensesModule, ok);
  setTimeout(LQ.tensesNextItem, 1600);
};

LQ.renderTensesEssay = function (wrap, item) {
  wrap.innerHTML =
    '<p class="tenses-practice-label">Write your response:</p>' +
    '<p class="tenses-practice-text">' +
    LQ.esc(item.prompt) +
    '</p>' +
    '<textarea class="tenses-essay-input" id="tenses-essay" rows="8" placeholder="Type your essay here…"></textarea>' +
    '<p class="tenses-word-count" id="tenses-word-count">0 words (min ' +
    (item.minWords || 40) +
    ')</p>' +
    '<button type="button" class="tenses-action-btn tenses-action-primary" onclick="LQ.tensesSubmitEssay()">Submit essay</button>';
  LQ._tensesCurrent = item;
  const ta = document.getElementById('tenses-essay');
  if (ta) {
    ta.oninput = function () {
      const n = ta.value.trim().split(/\s+/).filter(Boolean).length;
      const wc = document.getElementById('tenses-word-count');
      if (wc) wc.textContent = n + ' words (min ' + (item.minWords || 40) + ')';
    };
  }
};

LQ.tensesSubmitEssay = function () {
  const ta = document.getElementById('tenses-essay');
  const item = LQ._tensesCurrent;
  const words = (ta && ta.value.trim().split(/\s+/).filter(Boolean)) || [];
  const min = item.minWords || 40;
  if (words.length < min) {
    LQ.toast('Write at least ' + min + ' words');
    return;
  }
  LQ.recordTensesResult(LQ._tensesModule, true);
  LQ.toast('✓ Essay submitted!');
  setTimeout(LQ.tensesNextItem, 800);
};

LQ.renderTensesJumbled = function (wrap, item) {
  LQ._tensesJumbledPicked = [];
  LQ._tensesJumbledPool = LQ.shuffle(item.words.slice());
  LQ._tensesCurrent = item;
  LQ.tensesRenderJumbledUI(wrap);
};

LQ.tensesRenderJumbledUI = function (wrap) {
  const picked = LQ._tensesJumbledPicked;
  const pool = LQ._tensesJumbledPool;
  wrap.innerHTML =
    '<p class="tenses-practice-label">Tap words in the correct order:</p>' +
    '<div class="tenses-jumbled-answer" id="tenses-jumbled-answer">' +
    (picked.length ? picked.map(LQ.esc).join(' ') : '—') +
    '</div>' +
    '<div class="tenses-jumbled-pool">' +
    pool
      .map(function (w, i) {
        return (
          '<button type="button" class="tenses-chip" onclick="LQ.tensesPickJumbled(' +
          i +
          ')">' +
          LQ.esc(w) +
          '</button>'
        );
      })
      .join('') +
    '</div>' +
    '<div class="tenses-practice-actions">' +
    '<button type="button" class="tenses-action-btn" onclick="LQ.tensesResetJumbled()">↺ Reset</button>' +
    '<button type="button" class="tenses-action-btn tenses-action-primary" onclick="LQ.tensesCheckJumbled()">Check</button>' +
    '</div>' +
    '<p class="tenses-hint" id="tenses-feedback"></p>';
};

LQ.tensesPickJumbled = function (idx) {
  const w = LQ._tensesJumbledPool.splice(idx, 1)[0];
  LQ._tensesJumbledPicked.push(w);
  LQ.tensesRenderJumbledUI(document.getElementById('tenses-practice-wrap'));
};

LQ.tensesResetJumbled = function () {
  const item = LQ._tensesCurrent;
  LQ._tensesJumbledPicked = [];
  LQ._tensesJumbledPool = LQ.shuffle(item.words.slice());
  LQ.tensesRenderJumbledUI(document.getElementById('tenses-practice-wrap'));
};

LQ.tensesCheckJumbled = function () {
  const item = LQ._tensesCurrent;
  const built = LQ._tensesJumbledPicked.join(' ').replace(/\s+\./g, '.').trim();
  const ok = built.toLowerCase() === item.answer.toLowerCase();
  const fb = document.getElementById('tenses-feedback');
  if (fb) {
    fb.className = 'tenses-hint ' + (ok ? 'ok' : 'fail');
    fb.textContent = ok ? '✓ Perfect sentence!' : '✗ Answer: ' + item.answer;
  }
  if (ok) {
    LQ.recordTensesResult(LQ._tensesModule, true);
    setTimeout(LQ.tensesNextItem, 1400);
  }
};

LQ.renderTensesRetelling = function (wrap, item) {
  wrap.innerHTML =
    '<h3 class="tenses-story-title">' +
    LQ.esc(item.title) +
    '</h3>' +
    '<p class="tenses-passage">' +
    LQ.esc(item.story) +
    '</p>' +
    '<p class="tenses-practice-label">Retell the story in your own words:</p>' +
    '<textarea class="tenses-essay-input" id="tenses-retell" rows="6" placeholder="Write or speak your summary…"></textarea>' +
    '<div class="tenses-practice-actions">' +
    '<button type="button" class="tenses-action-btn" onclick="LQ.tensesRetellSpeak()">🎤 Speak retelling</button>' +
    '<button type="button" class="tenses-action-btn tenses-action-primary" onclick="LQ.tensesSubmitRetell()">Submit</button>' +
    '</div>' +
    '<p class="tenses-hint" id="tenses-feedback"></p>';
  LQ._tensesCurrent = item;
};

LQ.tensesRetellSpeak = function () {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const ta = document.getElementById('tenses-retell');
  const fb = document.getElementById('tenses-feedback');
  if (!SR) {
    if (fb) fb.textContent = 'Speech input needs Chrome or Android WebView.';
    return;
  }
  const rec = new SR();
  rec.lang = 'en-US';
  rec.continuous = true;
  rec.interimResults = true;
  if (fb) fb.textContent = 'Listening… tap Submit when done.';
  rec.onresult = function (e) {
    let txt = '';
    for (let i = 0; i < e.results.length; i++) txt += e.results[i][0].transcript + ' ';
    if (ta) ta.value = txt.trim();
  };
  rec.onerror = function () {
    if (fb) fb.textContent = 'Could not hear you — type your retelling instead.';
  };
  rec.start();
  LQ._tensesRetellRec = rec;
};

LQ.tensesSubmitRetell = function () {
  if (LQ._tensesRetellRec) {
    try {
      LQ._tensesRetellRec.stop();
    } catch (e) {}
  }
  const ta = document.getElementById('tenses-retell');
  const words = (ta && ta.value.trim().split(/\s+/).filter(Boolean)) || [];
  if (words.length < 15) {
    LQ.toast('Write at least 15 words for your retelling');
    return;
  }
  LQ.recordTensesResult(LQ._tensesModule, true);
  LQ.toast('✓ Retelling saved!');
  setTimeout(LQ.tensesNextItem, 800);
};

LQ.tensesNextItem = function () {
  LQ._tensesIdx = (LQ._tensesIdx + 1) % LQ._tensesItems.length;
  if (LQ._tensesIdx === 0) {
    const wrap = document.getElementById('tenses-practice-wrap');
    if (wrap) {
      wrap.innerHTML = LQ.renderFlowComplete
        ? LQ.renderFlowComplete({
            context: 'tenses',
            title: 'Session complete!',
            message: 'Great work — keep practicing to raise your readiness score.',
            icon: '🎉',
          })
        : wrap.innerHTML;
    }
    if (LQ.renderTensesPage) LQ.renderTensesPage();
    return;
  }
  LQ.initTensesPractice();
};

LQ.tensesSkip = function () {
  LQ.recordTensesResult(LQ._tensesModule, false);
  LQ.tensesNextItem();
};
