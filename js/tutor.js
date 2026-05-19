window.LQ = window.LQ || {};

LQ.TUTOR_CHIPS = [
  'What should I study today?',
  'Explain my weakest word',
  'Quiz me on one word',
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
  words.forEach(function (w) {
    if (lower.indexOf(w.word.toLowerCase()) >= 0) best = w;
  });
  return best;
};

LQ.localTutorReply = function (msg) {
  const text = (msg || '').trim();
  const lower = text.toLowerCase();
  const ctx = LQ.tutorContext();
  const S = LQ.S || {};

  if (!text) return 'Ask me anything about your vocabulary — words, study plan, or exam strategy.';

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
      '** words marked known. What would you like to work on?'
    );
  }

  if (/study today|what should i|plan|focus/.test(lower)) {
    const parts = [];
    if (ctx.dueWords.length) parts.push('Review due words: **' + ctx.dueWords.join(', ') + '**.');
    if (ctx.weakWords.length) parts.push('Drill weak words: **' + ctx.weakWords.join(', ') + '**.');
    parts.push('Try a **lesson** on your path or a **10-minute mock test** to simulate exam pressure.');
    if (!ctx.dueWords.length && !ctx.weakWords.length) {
      parts.unshift('Start with **flashcards** or **Quiz Me** to build your SRS queue.');
    }
    return parts.join(' ');
  }

  if (/mock|timed|test/.test(lower)) {
    return 'Open **Mock Test** from Home — 20 questions, 10 minutes. It tracks score and adds XP. Great for ' + ctx.examFocus + ' pacing practice.';
  }

  if (/quiz/.test(lower)) {
    const w = LQ.shuffle(LQ.getWords())[0];
    if (!w) return 'Load the word bank first, then try Quiz Me from Home.';
    return (
      '**Quick quiz:** What does **' +
      w.word +
      '** mean?\n\n' +
      LQ.esc(w.def) +
      '\n\n_(Tap Quiz Me for full multiple-choice practice.)_'
    );
  }

  if (/tip|strategy|exam/.test(lower)) {
    const tips = {
      GRE: 'GRE favors precise definitions and secondary meanings. Link each word to a one-image story; don\'t memorize long lists without context.',
      GMAT: 'GMAT verbal rewards logic and tone. Note whether a word is positive, negative, or neutral — that helps on critical reasoning.',
      IELTS: 'IELTS writing needs collocations. Practice using new words in a full sentence aloud, not only definitions.',
      ALL: 'Rotate GRE, GMAT, and IELTS tags so you don\'t over-fit to one exam\'s style.',
    };
    return tips[ctx.examFocus] || tips.ALL;
  }

  if (/weak|struggle|hard|miss/.test(lower)) {
    if (!ctx.weakWords.length) return 'No weak words flagged yet — keep quizzing and I\'ll steer you to **Weak Drill** when misses pile up.';
    const w = LQ.wordByName(ctx.weakWords[0]);
    if (!w) return 'Your weak list includes: **' + ctx.weakWords.join(', ') + '**. Open **Weak Drill** to fix them.';
    return (
      '**' +
      w.word +
      '** (' +
      w.pos +
      '): ' +
      w.def +
      '\n\nExample: "' +
      w.example.replace(/<[^>]+>/g, '') +
      '"\n\nSynonyms: ' +
      w.syn
    );
  }

  const w =
    (ctx.focusWord && LQ.wordByName(ctx.focusWord)) ||
    LQ.findWordInMessage(text) ||
    (/(explain|meaning|define|what is|tell me about)/.test(lower) ? LQ.WORDS[LQ.S.dailyWordIdx % Math.max(1, LQ.WORDS.length)] : null);

  if (w || /explain|meaning|define|what is|mnemonic|remember/.test(lower)) {
    const word = w || LQ.shuffle(LQ.getWords())[0];
    if (!word) return 'I couldn\'t find that word in your deck. Try the Word Bank or spell the word exactly.';
    const hint = LQ.MNEMONICS && LQ.MNEMONICS[word.word];
    return (
      '**' +
      word.word +
      '** · ' +
      word.phonetic +
      ' · _' +
      word.pos +
      '_\n\n' +
      word.def +
      '\n\n**Example:** "' +
      word.example.replace(/<[^>]+>/g, '') +
      '"\n\n**Synonyms:** ' +
      word.syn +
      (hint ? '\n\n**Memory trick:** ' + hint : '\n\n**Tip:** Picture one vivid scene that fits the definition and say it aloud twice.')
    );
  }

  return (
    'I\'m your **' +
    ctx.examFocus +
    '** vocab tutor. I can explain words, suggest a study plan, or share exam tips. Try: _"Explain ephemeral"_ or _"What should I study today?"_\n\n' +
    'For richer answers, add **tutorEndpoint** in Settings (see config).'
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
  const history = (LQ.S.tutorHistory || []).slice(-12).map(function (m) {
    return { role: m.role, content: m.text };
  });

  if (endpoint) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'tutor',
          message: userMsg,
          history: history,
          context: LQ.tutorContext(),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const txt = data.text || data.reply || data.message;
        if (txt) return txt;
      }
    } catch (e) {
      console.warn('Tutor API failed', e);
    }
  }

  await new Promise(function (r) {
    setTimeout(r, 350 + Math.random() * 400);
  });
  return LQ.localTutorReply(userMsg);
};

LQ.pushTutorMessage = function (role, text) {
  LQ.S.tutorHistory = LQ.S.tutorHistory || [];
  LQ.S.tutorHistory.push({ role: role, text: text, at: Date.now() });
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
      '<div class="tutor-avatar">✦</div></div>' +
      '<div class="tutor-bubble">' +
      LQ.formatTutorText(
        'I\'m your AI study tutor — like Shiksha AI, but built for **' +
          ctx.examFocus +
          '** vocabulary. Ask about any word, your weak list, or what to study today.'
      ) +
      '</div></div>';
  } else {
    box.innerHTML = hist
      .map(function (m) {
        const cls = m.role === 'user' ? 'user' : 'bot';
        const av = m.role === 'user' ? '👤' : '✦';
        return (
          '<div class="tutor-msg ' +
          cls +
          '"><div class="tutor-avatar">' +
          av +
          '</div><div class="tutor-bubble">' +
          LQ.formatTutorText(m.text) +
          '</div></div>'
        );
      })
      .join('');
  }

  if (chips) {
    chips.innerHTML = LQ.TUTOR_CHIPS.map(function (c) {
      return '<button type="button" class="tutor-chip" onclick="LQ.tutorChip(' + JSON.stringify(c) + ')">' + LQ.esc(c) + '</button>';
    }).join('');
  }

  box.scrollTop = box.scrollHeight;
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
  LQ.pushTutorMessage('assistant', reply);
  LQ.renderTutor();
  if (sendBtn) sendBtn.disabled = false;
  inp.focus();
};

LQ.initTutor = function () {
  if (!LQ.S) LQ.S = LQ.loadState();
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

window.LQ.tutorChip = LQ.tutorChip;
window.openTutorFromCard = LQ.openTutorFromCard;
