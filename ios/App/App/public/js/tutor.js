window.LQ = window.LQ || {};

LQ.TUTOR_CHIPS = [
  'What should I study today?',
  'Explain my weakest word',
  'Mnemonic for a hard word',
  'Word root breakdown',
  'Use in a sentence',
  'Tips for my exam',
];

LQ.tutorContext = function () {
  const S = LQ.S || {};
  const words = LQ.getWords();
  const known = words.filter(function (w) {
    return S.mastery[w.word] === 'known';
  }).length;
  const weak = LQ.getWeakWords ? LQ.getWeakWords().slice(0, 5).map(function (w) {
    return w.word;
  }) : [];
  const due = LQ.getDueWords ? LQ.getDueWords().slice(0, 5).map(function (w) {
    return w.word;
  }) : [];
  const focusWord = LQ._tutorFocusWord || null;
  return {
    examFocus: S.examFocus || 'GRE',
    placementLevel: S.placementLevel || 'intermediate',
    level: S.level || 1,
    knownCount: known,
    wordCount: words.length,
    weakWords: weak,
    dueWords: due,
    focusWord: focusWord,
    streak: S.streakCount || 0,
  };
};

LQ.setTutorFocusWord = function (word) {
  LQ._tutorFocusWord = word || null;
};

LQ.findWordInMessage = function (msg) {
  const lower = msg.toLowerCase();
  const words = LQ.getWords();
  let best = null;
  let bestLen = 0;
  words.forEach(function (w) {
    const name = w.word.toLowerCase();
    const re = new RegExp('\\b' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i');
    if (re.test(lower) && name.length > bestLen) {
      best = w;
      bestLen = name.length;
    }
  });
  return best;
};

LQ.cleanTutorQuery = function (msg) {
  return String(msg || '')
    .trim()
    .replace(/^(explain|define|what is|what's|tell me about|meaning of|describe)\s+/i, '')
    .trim();
};

LQ.lookupTutorWord = function (msg) {
  const cleaned = LQ.cleanTutorQuery(msg);
  const token = cleaned.split(/\s+/).filter(Boolean)[0];
  if (token) {
    const exact = LQ.wordByName(token);
    if (exact) return exact;
  }
  return LQ.findWordInMessage(msg);
};

LQ.formatWordReply = function (word) {
  if (!word) return '';
  const hint =
    (LQ.MNEMONICS && LQ.MNEMONICS[word.word]) ||
    (LQ.generateMnemonic ? LQ.generateMnemonic(word) : '');
  const root = LQ.guessWordRoot ? LQ.guessWordRoot(word.word) : null;
  const ex = (word.example || '').replace(/<[^>]+>/g, '');
  let out =
    '**' +
    word.word +
    '** · ' +
    (word.phonetic || '') +
    ' · _' +
    (word.pos || 'word') +
    '_\n\n' +
    (LQ.displayWordDef ? LQ.displayWordDef(word) : word.def || '');
  if (root) out += '\n\n**Root:** **' + root.root + '-** = "' + root.meaning + '"';
  if (ex) out += '\n\n**Example:** "' + ex + '"';
  if (word.syn && String(word.syn).trim()) out += '\n\n**Synonyms:** ' + word.syn;
  if (word.ant && String(word.ant).trim()) out += '\n\n**Antonyms:** ' + word.ant;
  if (hint) out += '\n\n**Memory trick:** ' + hint.replace(/\*\*/g, '');
  else out += '\n\n**Tip:** Picture one vivid scene that fits the definition and say it aloud twice.';
  return out;
};

LQ.localTutorReply = function (msg) {
  const text = (msg || '').trim();
  const lower = text.toLowerCase();
  const ctx = LQ.tutorContext();

  if (!text) return 'Ask me anything about your vocabulary — words, tenses, study plan, or exam strategy.';

  if (/^(hi|hello|hey)\b/.test(lower)) {
    return (
      'Hi! I\'m your LexiQuest tutor. You\'re on **' +
      ctx.examFocus +
      '** at level **' +
      ctx.placementLevel +
      '** with **' +
      ctx.knownCount +
      '/' +
      ctx.wordCount +
      '** words marked known. Ask about any word, or try **Tenses** for grammar practice.'
    );
  }

  if (/^(past|present|future)(\s+tense)?s?$/i.test(lower) || /\bpast tense\b|\bpresent tense\b|\bfuture tense\b/.test(lower)) {
    const tense = /present/.test(lower)
      ? 'present'
      : /future/.test(lower)
        ? 'future'
        : 'past';
    const guides = {
      past: '**Past tense** describes completed actions.\n\n• **Past simple:** _I studied_ yesterday.\n• **Past continuous:** _I was studying_ when you called.\n• **Past perfect:** _I had finished_ before the exam started.\n\nOpen **Tenses → Grammar** or **Passage Comprehensions** for practice.',
      present:
        '**Present tense** describes now or habits.\n\n• **Present simple:** _I study_ every day.\n• **Present continuous:** _I am studying_ right now.\n• **Present perfect:** _I have studied_ 50 words this week.\n\nTry **Tenses** modules for speaking and grammar drills.',
      future:
        '**Future tense** describes what comes next.\n\n• **Will:** _I will study_ tonight.\n• **Going to:** _I am going to take_ a mock test.\n• **Future continuous:** _This time tomorrow, I will be revising_ flagged words.\n\nPractice in **Tenses → Just a Minute** and **Essay Writing**.',
    };
    return guides[tense];
  }

  if (/tense|grammar|jumbled|essay writing|sentence/.test(lower) && !LQ.lookupTutorWord(text)) {
    return 'For grammar and tense practice, open **Tenses** from the sidebar — try **Grammar**, **Jumbled Sentences**, **Sentence Repeating**, or **Essay Writing**. I can also explain any vocab word if you type it here.';
  }

  if (/study today|what should i|plan|focus/.test(lower)) {
    const parts = [];
    if (ctx.dueWords.length) parts.push('Review due words: **' + ctx.dueWords.join(', ') + '**.');
    if (ctx.weakWords.length) parts.push('Drill weak words: **' + ctx.weakWords.join(', ') + '**.');
    parts.push('Try **Learn** for new words, **Tenses** for grammar, or a **Mock Test** for exam pacing.');
    if (!ctx.dueWords.length && !ctx.weakWords.length) {
      parts.unshift('Start with **Learn** or **Flashcards** to build your queue.');
    }
    return parts.join(' ');
  }

  if (/mock|timed test/.test(lower)) {
    return 'Open **Mock Test** from the sidebar — 20 questions, 10 minutes. It tracks score and adds XP. Great for ' + ctx.examFocus + ' pacing practice.';
  }

  if (/quiz me|quiz\b/.test(lower)) {
    const w = LQ.shuffle(LQ.getWords())[0];
    if (!w) return 'Load the word bank first, then try **Quiz** from the menu.';
    return '**Quick quiz:** What does **' + w.word + '** mean?\n\n' + w.def + '\n\n_(Open **Quiz** for full multiple-choice practice.)_';
  }

  if (/tip|strategy|exam prep/.test(lower)) {
    const tips = {
      GRE: 'GRE favors precise definitions and secondary meanings. Link each word to a one-image story; don\'t memorize long lists without context.',
      GMAT: 'GMAT verbal rewards logic and tone. Note whether a word is positive, negative, or neutral — that helps on critical reasoning.',
      IELTS: 'IELTS writing needs collocations. Practice using new words in a full sentence aloud, not only definitions.',
      ALL: 'Rotate GRE, GMAT, and IELTS tags so you don\'t over-fit to one exam\'s style.',
    };
    return tips[ctx.examFocus] || tips.ALL;
  }

  if (/weakest|weak word|struggle|hard word|words i miss/.test(lower)) {
    if (!ctx.weakWords.length) {
      return 'No weak words flagged yet — miss a few in **Quiz**, then ask again or open **Weak Drill**.';
    }
    const w = LQ.wordByName(ctx.weakWords[0]);
    if (!w) {
      return 'Your weak list includes: **' + ctx.weakWords.join(', ') + '**. Open **Weak Drill** to fix them.';
    }
    return 'Your weakest flagged word right now:\n\n' + LQ.formatWordReply(w);
  }

  const wEarly =
    (ctx.focusWord && LQ.wordByName(ctx.focusWord)) ||
    LQ.lookupTutorWord(text);

  if (/mnemonic|memory trick|remember this word|how to remember/.test(lower)) {
    const w = wEarly || LQ.WORDS[LQ.S.dailyWordIdx % Math.max(1, LQ.WORDS.length)];
    if (!w) return 'Pick a word from your deck first — type _Explain ephemeral_ or any vocab word.';
    const m = LQ.generateMnemonic ? LQ.generateMnemonic(w) : '';
    return '**Mnemonic for ' + w.word + ':**\n\n' + m.replace(/\*\*/g, '') + '\n\n' + (w.def || '');
  }

  if (/\broot\b|etymolog|prefix|suffix|where does .* come from/.test(lower)) {
    const w = wEarly;
    if (!w) return 'Name a word from your deck and I\'ll look for a Latin/Greek root — e.g. _root of ephemeral_.';
    const root = LQ.guessWordRoot ? LQ.guessWordRoot(w.word) : null;
    if (root) {
      return (
        '**' +
        w.word +
        '** — root **' +
        root.root +
        '-** means "' +
        root.meaning +
        '".\n\n' +
        (LQ.displayWordDef ? LQ.displayWordDef(w) : w.def)
      );
    }
    return 'No obvious prefix/root for **' + w.word + '** — use the example sentence as your anchor instead.';
  }

  if (/use in a sentence|sentence for|write a sentence|example sentence/.test(lower)) {
    const w = wEarly || LQ.WORDS[LQ.S.dailyWordIdx % Math.max(1, LQ.WORDS.length)];
    if (!w) return 'Type any word from your deck and ask _Use ephemeral in a sentence_.';
    const reply = LQ.tutorSentence ? LQ.tutorSentence(w) : LQ.formatWordReply(w);
    LQ._pendingTutorExample = {
      word: w.word,
      text: LQ.extractSentenceFromTutorReply ? LQ.extractSentenceFromTutorReply(reply) : '',
    };
    return reply;
  }

  const w =
    wEarly ||
    (/(explain|meaning|define|what is|mnemonic|remember)/.test(lower)
      ? LQ.WORDS[LQ.S.dailyWordIdx % Math.max(1, LQ.WORDS.length)]
      : null);

  if (w) {
    return LQ.formatWordReply(w);
  }

  if (/^[a-zA-Z-]{2,30}$/.test(text)) {
    return (
      'I couldn\'t find **' +
      text +
      '** in your vocab deck. It might be a grammar topic — try asking _"past tense"_ or open **Word Bank** to search. For tense drills, go to **Tenses** in the sidebar.'
    );
  }

  return (
    'I can help with:\n\n• **Words** — type _Explain ephemeral_ or any word from your deck\n• **Mnemonics & roots** — _Mnemonic for abate_ or _root of ephemeral_\n• **Sentences** — _Use abate in a sentence_\n• **Study plan** — _What should I study today?_\n• **Weak words** — _Explain my weakest word_\n\nOr tap a suggestion chip below.'
  );
};

LQ.formatTutorText = function (raw) {
  let s = LQ.esc(raw || '');
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/_(.+?)_/g, '<em>$1</em>');
  s = s.replace(/\n/g, '<br>');
  return s;
};

LQ.askTutor = async function (userMsg) {
  const endpoint = LQ.Config.tutorEndpoint || LQ.Config.aiEndpoint;

  if (endpoint) {
    try {
      const res = await LQ.fetchWithTimeout(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'tutor',
          message: userMsg,
          history: (LQ.S.tutorHistory || []).slice(-12).map(function (m) {
            return { role: m.role, content: m.text };
          }),
          context: LQ.tutorContext(),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const txt = data.text || data.reply || data.message;
        if (txt) return txt;
      }
    } catch (e) {
      console.warn('Tutor API failed — using built-in tutor', e);
    }
  }

  return LQ.localTutorReply(userMsg);
};

LQ.pushTutorMessage = function (role, text, meta) {
  LQ.S.tutorHistory = LQ.S.tutorHistory || [];
  var entry = { role: role, text: text, at: Date.now() };
  if (meta) {
    if (meta.saveExampleWord) entry.saveExampleWord = meta.saveExampleWord;
    if (meta.saveExampleText) entry.saveExampleText = meta.saveExampleText;
  }
  LQ.S.tutorHistory.push(entry);
  if (LQ.S.tutorHistory.length > 50) LQ.S.tutorHistory = LQ.S.tutorHistory.slice(-50);
  LQ.saveState();
};

LQ.renderTutor = function () {
  const box = document.getElementById('tutor-messages');
  const chips = document.getElementById('tutor-chips');
  if (!box) return;

  const hist = LQ.S.tutorHistory || [];
  if (!hist.length) {
    const ctx = LQ.tutorContext();
    box.innerHTML =
      '<div class="tutor-msg bot">' +
      '<div class="tutor-avatar">✦</div>' +
      '<div class="tutor-bubble">' +
      LQ.formatTutorText(
        'I\'m your LexiQuest study tutor for **' +
          ctx.examFocus +
          '** vocabulary. Ask about any word, request a mnemonic or example sentence, or ask what to study today.'
      ) +
      '</div></div>';
  } else {
    box.innerHTML = hist
      .map(function (m) {
        const cls = m.role === 'user' ? 'user' : 'bot';
        const av = m.role === 'user' ? '👤' : '✦';
        var saveBtn = '';
        if (m.saveExampleWord && m.saveExampleText && m.role !== 'user') {
          saveBtn =
            '<button type="button" class="tutor-save-ex" onclick="LQ.saveExampleText(' +
            JSON.stringify(m.saveExampleWord) +
            ',' +
            JSON.stringify(m.saveExampleText) +
            ')">Save as my example</button>';
        }
        return (
          '<div class="tutor-msg ' +
          cls +
          '"><div class="tutor-avatar">' +
          av +
          '</div><div class="tutor-bubble">' +
          LQ.formatTutorText(m.text) +
          saveBtn +
          '</div></div>'
        );
      })
      .join('');
  }

  if (chips) {
    chips.innerHTML = LQ.TUTOR_CHIPS.map(function (c, i) {
      return (
        '<button type="button" class="tutor-chip" data-chip-idx="' +
        i +
        '">' +
        LQ.esc(c) +
        '</button>'
      );
    }).join('');
  }

  box.scrollTop = box.scrollHeight;
};

LQ.bindTutorChips = function () {
  var chips = document.getElementById('tutor-chips');
  if (!chips || chips._tutorBound) return;
  chips._tutorBound = true;
  chips.addEventListener('click', function (e) {
    var btn = e.target.closest('.tutor-chip');
    if (!btn) return;
    e.preventDefault();
    var idx = parseInt(btn.getAttribute('data-chip-idx'), 10);
    if (!isNaN(idx) && LQ.TUTOR_CHIPS[idx]) LQ.tutorChip(LQ.TUTOR_CHIPS[idx]);
  });
};

LQ.tutorChip = function (text) {
  const inp = document.getElementById('tutor-input');
  if (inp) inp.value = text;
  LQ.sendTutorMessage();
};

LQ.sendTutorMessage = async function () {
  const inp = document.getElementById('tutor-input');
  const sendBtn = document.getElementById('tutor-send');
  if (!inp) return;
  const msg = inp.value.trim();
  if (!msg) return;
  inp.value = '';
  if (sendBtn) sendBtn.disabled = true;

  try {
    LQ.pushTutorMessage('user', msg);
    LQ.renderTutor();

    const box = document.getElementById('tutor-messages');
    if (box) {
      box.insertAdjacentHTML(
        'beforeend',
        '<div class="tutor-msg bot"><div class="tutor-avatar">✦</div><div class="tutor-bubble tutor-typing"><span class="dot"></span><span class="dot"></span><span class="dot"></span></div></div>'
      );
      box.scrollTop = box.scrollHeight;
    }

    const reply = await LQ.askTutor(msg);
    var meta = null;
    if (/use in a sentence|sentence for|write a sentence|example sentence/i.test(msg)) {
      var wSave = LQ.findWordInMessage(msg);
      var exText = LQ.extractSentenceFromTutorReply ? LQ.extractSentenceFromTutorReply(reply) : '';
      if (wSave && exText) {
        meta = { saveExampleWord: wSave.word, saveExampleText: exText };
      }
    }
    LQ.pushTutorMessage('assistant', reply, meta);
    LQ._pendingTutorExample = null;
    LQ.renderTutor();
  } catch (err) {
    console.error('Tutor send failed', err);
    LQ.toast('Could not get a reply — try again');
    LQ.renderTutor();
  } finally {
    if (sendBtn) sendBtn.disabled = false;
    if (inp) inp.focus();
  }
};

LQ.initTutor = function () {
  if (!LQ.S) LQ.S = LQ.loadState();
  LQ.bindTutorChips();
  LQ.renderTutor();
  const inp = document.getElementById('tutor-input');
  if (inp) {
    inp.onkeydown = function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        LQ.sendTutorMessage();
      }
    };
  }
};

LQ.openTutorForWord = function (word) {
  LQ.setTutorFocusWord(word);
  goTo('tutor');
  setTimeout(function () {
    const inp = document.getElementById('tutor-input');
    if (inp) inp.value = 'Explain ' + word;
    LQ.sendTutorMessage();
  }, 200);
};

LQ.openTutorFromCard = function () {
  const w = LQ.currentFcWord && LQ.currentFcWord();
  if (w) LQ.openTutorForWord(w.word);
  else goTo('tutor');
};

window.LQ.sendTutorMessage = LQ.sendTutorMessage;
window.LQ.tutorChip = LQ.tutorChip;
window.openTutorFromCard = LQ.openTutorFromCard;
