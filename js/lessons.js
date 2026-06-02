window.LQ = window.LQ || {};

LQ.EXAM_TIPS = [
  { title: 'GRE tip', body: 'On Text Completion, learn word tone (positive/negative/neutral) — not just definitions.' },
  { title: 'GMAT tip', body: 'Critical Reasoning rewards precise vocabulary: "mitigate" vs "eliminate" changes answer choices.' },
  { title: 'IELTS tip', body: 'Writing Band 7+ needs less common collocations — pair new words with natural phrases.' },
  { title: 'Group tip', body: 'Words in the same PDF group are often synonyms or antonyms — learn them together.' },
  { title: 'Memory tip', body: 'Link a vivid image to the root: "ephemeral" → mayfly that lives one day.' },
];

LQ.CHAPTERS = [];

LQ.lessonsForChapter = function (chapterId) {
  if (!LQ.ensurePathData()) return [];
  if (LQ.isDictionaryList(chapterId)) return [];
  var lst = LQ.WORD_LISTS.lists.find(function (l) {
    return l.id === chapterId;
  });
  if (!lst) return [];
  return (lst.groups || []).map(function (g) {
    var short = g.title.length > 28 ? g.title.slice(0, 26) + '…' : g.title;
    return {
      id: g.id,
      title: 'G' + g.groupNum + ' · ' + short,
      fullTitle: g.title,
      chapterId: chapterId,
      groupNum: g.groupNum,
      wordCount: g.words.length,
    };
  });
};

LQ.isLessonUnlocked = function (lessonId) {
  if (LQ.Config && LQ.Config.enableAllFeatures) return true;
  if (!LQ.ensurePathData()) return true;
  LQ.S.lessonProgress = LQ.S.lessonProgress || {};
  var all = [];
  LQ.CHAPTERS.forEach(function (ch) {
    LQ.lessonsForChapter(ch.id).forEach(function (l) {
      all.push(l.id);
    });
  });
  var i = all.indexOf(lessonId);
  if (i <= 0) return true;
  return !!LQ.S.lessonProgress[all[i - 1]];
};

LQ.wordsForLesson = function (lessonId) {
  var hit = LQ.findGroup(lessonId);
  if (!hit) {
    var all = LQ.getWords().filter(function (w) {
      return !w.premium || LQ.S.premium;
    });
    return LQ.shuffle(all).slice(0, 5);
  }
  return LQ.wordsForGroup(lessonId, { shuffle: true, limit: 10 });
};

LQ.wordsForGroup = function (lessonId, opts) {
  opts = opts || {};
  var hit = LQ.findGroup(lessonId);
  if (!hit) return [];
  var meta = { groupTitle: hit.group.title, listTitle: hit.list.title };
  var words = hit.group.words.map(function (entry) {
    return LQ.resolveWord(entry.word, meta);
  });
  if (opts.shuffle) words = LQ.shuffle(words);
  if (opts.limit && words.length > opts.limit) words = words.slice(0, opts.limit);
  return words;
};

LQ.renderGroupWordList = function (lessonId, wordsOverride) {
  var words = wordsOverride || LQ.wordsForGroup(lessonId);
  if (!words.length) {
    return '<p class="lists-word-empty">No words in this group.</p>';
  }
  return words
    .map(function (w) {
      var status = LQ.getWordStatus ? LQ.getWordStatus(w.word) : 'unmarked';
      return (
        '<article class="lists-word-row status-' +
        status +
        '">' +
        '<div class="lists-word-head">' +
        '<strong class="lists-word-name">' +
        LQ.esc(w.word) +
        '</strong>' +
        (w.phonetic
          ? '<span class="lists-word-phon">' + LQ.esc(w.phonetic) + '</span>'
          : w.pos
            ? '<span class="lists-word-pos">' + LQ.esc(w.pos) + '</span>'
            : '') +
        '</div>' +
        '<p class="lists-word-def">' +
        LQ.displayWordDef(w) +
        '</p>' +
        (LQ.renderExampleBlock
          ? LQ.renderExampleBlock(w, { className: 'lists-word-ex', compact: true })
          : w.example
            ? '<p class="lists-word-ex">"' + w.example + '"</p>'
            : '') +
        (w.syn
          ? '<p class="lists-word-syn"><span>Synonyms:</span> ' + LQ.esc(w.syn.replace(/,/g, ', ')) + '</p>'
          : '') +
        '</article>'
      );
    })
    .join('');
};

LQ.toggleListGroup = function (lessonId) {
  LQ._expandedListGroups = LQ._expandedListGroups || {};
  LQ._expandedListGroups[lessonId] = !LQ._expandedListGroups[lessonId];
  LQ.renderWordListsPage();
};

LQ.filterDictionaryList = function (query) {
  LQ._dictFilter = query || '';
  LQ.renderWordListsPage();
};

LQ.renderDictionaryList = function (listId) {
  var words = LQ.wordsFromList(listId);
  var q = (LQ._dictFilter || '').trim().toLowerCase();
  if (q) {
    words = words.filter(function (w) {
      return (
        w.word.toLowerCase().indexOf(q) >= 0 ||
        (w.def && w.def.toLowerCase().indexOf(q) >= 0)
      );
    });
  }
  var known = 0;
  var flagged = 0;
  words.forEach(function (w) {
    var st = LQ.getWordStatus ? LQ.getWordStatus(w.word) : 'unmarked';
    if (st === 'known') known++;
    else if (st === 'flagged') flagged++;
  });
  var total = LQ.wordsFromList(listId).length;
  return (
    '<div class="lists-dict-toolbar">' +
    '<input type="search" class="lists-dict-search" placeholder="Search dictionary…" value="' +
    LQ.esc(LQ._dictFilter || '') +
    '" oninput="LQ.filterDictionaryList(this.value)">' +
    '<button type="button" class="lists-group-quiz" onclick="LQ.startListQuiz(\'' +
    listId +
    '\',null)">Quiz all</button>' +
    '<button type="button" class="lists-group-action" onclick="goTo(\'learn\');LQ.pickLearnList(\'' +
    listId +
    '\')">Learn</button></div>' +
    '<p class="lists-dict-stats">' +
    known +
    ' known · ' +
    flagged +
    ' flagged · ' +
    total +
    ' words total' +
    (q ? ' · ' + words.length + ' shown' : '') +
    '</p>' +
    '<div class="lists-group-words lists-dict-words">' +
    (words.length
      ? LQ.renderGroupWordList(null, words)
      : '<p class="lists-word-empty">No words match your search.</p>') +
    '</div>'
  );
};

LQ.renderWordListsPage = function () {
  var sidebar = document.getElementById('lists-sidebar');
  var groupsEl = document.getElementById('lists-groups');
  var headEl = document.getElementById('lists-main-head');
  if (!sidebar || !groupsEl) return;
  if (!LQ.ensurePathData()) {
    groupsEl.innerHTML =
      '<p style="color:var(--muted);font-size:14px;padding:12px 0">Loading word lists…</p>';
    return;
  }
  LQ.S.lessonProgress = LQ.S.lessonProgress || {};
  var chapters = LQ.getOrderedChapters ? LQ.getOrderedChapters() : LQ.CHAPTERS;
  if (!chapters.length) return;
  if (LQ._pathListFilter === undefined || LQ._pathListFilter === 'all') {
    LQ._pathListFilter = chapters[0].id;
  }
  var curId = LQ._pathListFilter;

  function renderSidebarItem(ch) {
    var lessons = LQ.lessonsForChapter(ch.id);
    var isDict = ch.listType === 'dictionary';
    var done = 0;
    var pct = 0;
    var sub = '';
    if (isDict) {
      var prog = LQ.getListProgress().find(function (p) {
        return p.id === ch.id;
      });
      done = prog ? prog.touched : 0;
      pct = prog ? prog.pct : 0;
      sub = done + '/' + (ch.wordCount || 0) + ' studied · ' + pct + '%';
    } else {
      done = lessons.filter(function (l) {
        return LQ.S.lessonProgress[l.id];
      }).length;
      pct = lessons.length ? Math.round((done / lessons.length) * 100) : 0;
      sub = done + '/' + lessons.length + ' groups · ' + pct + '%';
    }
    var active = ch.id === curId ? ' active' : '';
    var typeBadge = isDict
      ? ' <span class="lists-type-badge dict">Dict</span>'
      : ' <span class="lists-type-badge gre">GRE</span>';
    return (
      '<button type="button" class="lists-side-item' +
      active +
      '" onclick="LQ.filterPathList(\'' +
      ch.id +
      '\')">' +
      '<span class="lists-side-icon" aria-hidden="true">' +
      ch.icon +
      '</span>' +
      '<span class="lists-side-text">' +
      '<span class="lists-side-name">' +
      LQ.esc(ch.title) +
      typeBadge +
      '</span>' +
      '<span class="lists-side-sub">' +
      sub +
      '</span></span></button>'
    );
  }

  var greLists = chapters.filter(function (ch) {
    return ch.listType !== 'dictionary';
  });
  var dictLists = chapters.filter(function (ch) {
    return ch.listType === 'dictionary';
  });

  var sidebarParts = [];
  if (greLists.length) {
    sidebarParts.push(
      '<div class="lists-side-section">' +
        '<p class="lists-side-heading">GRE Word Lists</p>' +
        '<p class="lists-side-desc">Synonym groups from your PDF deck</p>' +
        greLists.map(renderSidebarItem).join('') +
        '</div>'
    );
  }
  if (dictLists.length) {
    sidebarParts.push(
      '<div class="lists-side-section">' +
        '<p class="lists-side-heading">Dictionary</p>' +
        '<p class="lists-side-desc">General vocabulary — flat word banks</p>' +
        dictLists.map(renderSidebarItem).join('') +
        '</div>'
    );
  }
  sidebar.innerHTML = sidebarParts.join('');

  var ch =
    chapters.find(function (c) {
      return c.id === curId;
    }) || chapters[0];
  var isDictList = ch.listType === 'dictionary';
  var lessons = LQ.lessonsForChapter(ch.id);
  var done = 0;
  var pct = 0;
  if (isDictList) {
    var listProg = LQ.getListProgress().find(function (p) {
      return p.id === ch.id;
    });
    done = listProg ? listProg.touched : 0;
    pct = listProg ? listProg.pct : 0;
  } else {
    done = lessons.filter(function (l) {
      return LQ.S.lessonProgress[l.id];
    }).length;
    pct = lessons.length ? Math.round((done / lessons.length) * 100) : 0;
  }

  if (headEl) {
    headEl.innerHTML =
      '<div class="lists-head-top">' +
      '<div class="lists-head-info">' +
      '<span class="lists-head-icon" aria-hidden="true">' +
      ch.icon +
      '</span>' +
      '<div><h2 class="lists-head-title">' +
      LQ.esc(ch.title) +
      (isDictList
        ? ' <span class="lists-type-badge dict">Dictionary</span>'
        : ' <span class="lists-type-badge gre">GRE</span>') +
      '</h2>' +
      '<p class="lists-head-sub">' +
      LQ.esc(ch.subtitle) +
      '</p></div></div>' +
      '<span class="lists-head-count">' +
      (isDictList ? done + '/' + (ch.wordCount || 0) : done + '/' + lessons.length) +
      '</span></div>' +
      '<div class="lists-head-bar" role="progressbar" aria-valuenow="' +
      pct +
      '"><div class="lists-head-fill" style="width:' +
      pct +
      '%"></div></div>';
  }

  if (isDictList) {
    groupsEl.innerHTML = LQ.renderDictionaryList(ch.id);
    var commit = document.getElementById('commit-banner');
    if (commit && LQ.S.commitmentDays) {
      var start = LQ.S.commitmentStart ? new Date(LQ.S.commitmentStart) : new Date();
      var elapsed = Math.floor((Date.now() - start.getTime()) / 86400000) + 1;
      commit.innerHTML =
        '<span class="commit-icon">🎯</span>' +
        '<' +
        LQ.H +
        '><strong>' +
        LQ.S.commitmentDays +
        '-day goal</strong><br>Day ' +
        Math.min(elapsed, LQ.S.commitmentDays) +
        ' of ' +
        LQ.S.commitmentDays +
        '</' +
        LQ.H +
        '>';
      commit.style.display = 'flex';
    }
    return;
  }

  groupsEl.innerHTML = lessons
    .map(function (les) {
      var unlocked = LQ.isLessonUnlocked(les.id);
      var complete = !!LQ.S.lessonProgress[les.id];
      var cls = complete ? 'done' : unlocked ? 'ready' : 'locked';
      var badge = complete ? 'Done' : unlocked ? 'Start' : 'Locked';
      var theme = (LQ.formatGroupTitle ? LQ.formatGroupTitle(les.fullTitle || les.title.replace(/^G\d+\s·\s/, '')) : les.title.replace(/^G\d+\s·\s/, ''));
      var expanded = !!(LQ._expandedListGroups && LQ._expandedListGroups[les.id]);
      return (
        '<div class="lists-group-block' +
        (expanded ? ' expanded' : '') +
        '">' +
        '<div class="lists-group-row ' +
        cls +
        '">' +
        '<button type="button" class="lists-group-toggle" aria-expanded="' +
        expanded +
        '" title="' +
        LQ.esc(les.fullTitle || les.title) +
        '" onclick="LQ.toggleListGroup(\'' +
        les.id +
        '\')">' +
        '<span class="lists-group-num">' +
        (complete ? '\u2713' : 'G' + les.groupNum) +
        '</span>' +
        '<span class="lists-group-body">' +
        '<span class="lists-group-name">' +
        LQ.esc(theme) +
        '</span>' +
        '<span class="lists-group-meta">' +
        les.wordCount +
        ' words · tap to see examples</span></span>' +
        '<span class="lists-group-chevron" aria-hidden="true">' +
        (expanded ? '\u25B2' : '\u25BC') +
        '</span></button>' +
        '<button type="button" class="lists-group-quiz" onclick="event.stopPropagation();LQ.startListQuiz(\'' +
        ch.id +
        '\',\'' +
        les.id +
        '\')">Quiz</button>' +
        '<button type="button" class="lists-group-action" ' +
        (unlocked ? 'onclick="LQ.startLesson(\'' + les.id + '\')"' : 'disabled') +
        '>' +
        badge +
        '</button></div>' +
        (expanded
          ? '<div class="lists-group-words">' + LQ.renderGroupWordList(les.id) + '</div>'
          : '') +
        '</div>'
      );
    })
    .join('');

  var commit = document.getElementById('commit-banner');
  if (commit && LQ.S.commitmentDays) {
    var start = LQ.S.commitmentStart ? new Date(LQ.S.commitmentStart) : new Date();
    var elapsed = Math.floor((Date.now() - start.getTime()) / 86400000) + 1;
    commit.innerHTML =
      '<span class="commit-icon">🎯</span>' +
      '<' +
      LQ.H +
      '><strong>' +
      LQ.S.commitmentDays +
      '-day goal</strong><br>Day ' +
      Math.min(elapsed, LQ.S.commitmentDays) +
      ' of ' +
      LQ.S.commitmentDays +
      '</' +
      LQ.H +
      '>';
    commit.style.display = 'flex';
  }
};

LQ.renderLearningPath = LQ.renderWordListsPage;

LQ.filterPathList = function (listId) {
  LQ._pathListFilter = listId;
  LQ.renderWordListsPage();
};

LQ.startLesson = function (lessonId) {
  if (!LQ.isLessonUnlocked(lessonId)) {
    LQ.toast('Complete the previous lesson first');
    return;
  }
  LQ._lessonId = lessonId;
  LQ._lessonWords = LQ.wordsForLesson(lessonId);
  if (!LQ._lessonWords.length) {
    LQ.toast('No words in this group');
    return;
  }
  var hit = LQ.findGroup(lessonId);
  LQ._lessonTitle = hit ? hit.group.title : 'Lesson';
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
  var ex = [];
  words.forEach(function (w, i) {
    if (i % 3 === 0)
      ex.push({
        type: 'match',
        words: words.slice(i, i + 3).length >= 3 ? words.slice(i, i + 3) : words,
      });
    else if (i % 3 === 1) ex.push({ type: 'mcq', word: w, mode: 'def' });
    else ex.push({ type: 'mcq', word: w, mode: 'word' });
  });
  return ex.slice(0, Math.max(4, Math.min(8, words.length + 1)));
};

LQ.renderLessonScreen = function () {
  var wrap = document.getElementById('lesson-wrap');
  var prog = document.getElementById('lesson-prog-fill');
  var hearts = document.getElementById('lesson-hearts');
  if (!wrap) return;
  var label = document.getElementById('lesson-group-label');
  if (label) label.textContent = LQ._lessonTitle || '';
  var total = LQ._lessonWords.length + LQ._exercises.length;
  var current = LQ._learnIdx;
  if (LQ._lessonPhase === 'practice') current = LQ._lessonWords.length + LQ._exIdx;
  if (LQ._lessonPhase === 'tip') current = total - 1;
  if (prog) prog.style.width = Math.round((current / total) * 100) + '%';
  if (hearts) {
    hearts.innerHTML = [0, 1, 2]
      .map(function (i) {
        return '<span class="heart ' + (i >= LQ._lessonHearts ? 'dead' : '') + '">❤️</span>';
      })
      .join('');
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
  var w = LQ._lessonWords[LQ._learnIdx];
  if (!w) {
    LQ._lessonPhase = 'practice';
    LQ._exIdx = 0;
    LQ.renderLessonScreen();
    return;
  }
  wrap.innerHTML =
    '<p class="lesson-phase-label">Learn · ' + LQ.esc(LQ._lessonTitle || '') + '</p>' +
    '<' +
    LQ.H +
    ' class="learn-card">' +
    '<span class="learn-badge">New word</span>' +
    '<h2 class="learn-word">' +
    LQ.esc(w.word) +
    '</h2>' +
    (w.phonetic ? '<p class="learn-phon">' + LQ.esc(w.phonetic) + ' · ' + LQ.esc(w.pos) + '</p>' : '') +
    '<p class="learn-def">' +
    w.def +
    '</p>' +
    (LQ.renderExampleBlock ? LQ.renderExampleBlock(w) : '<p class="learn-ex">"' + w.example + '"</p>') +
    (w.syn
      ? '<' + LQ.H + ' class="learn-syn"><strong>Synonyms:</strong> ' + LQ.esc(w.syn) + '</' + LQ.H + '>'
      : '') +
    (w.ant
      ? '<' + LQ.H + ' class="learn-ant"><strong>Antonyms:</strong> ' + LQ.esc(w.ant) + '</' + LQ.H + '>'
      : '') +
    '</' +
    LQ.H +
    '>' +
    '<div class="learn-actions">' +
    '<button class="learn-act known" onclick="LQ.lessonMark(\'known\')">✓ Known</button>' +
    '<button class="learn-act flag" onclick="LQ.lessonMark(\'flagged\')">🚩 Flag</button>' +
    '<button class="lesson-cta" onclick="LQ.advanceLearn()">Next →</button>' +
    '</div>';
};

LQ.lessonMark = function (status) {
  var w = LQ._lessonWords[LQ._learnIdx];
  if (!w) return;
  if (status === 'known') LQ.setWordKnown(w.word);
  else LQ.setWordFlagged(w.word);
  LQ.gainXP(status === 'known' ? 12 : 8);
  LQ.saveState();
  LQ.advanceLearn();
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
  var tip = LQ.EXAM_TIPS[Math.floor(Math.random() * LQ.EXAM_TIPS.length)];
  wrap.innerHTML =
    '<p class="lesson-phase-label">Exam insight</p>' +
    '<' +
    LQ.H +
    ' class="tip-card">' +
    '<span class="tip-illus">💡</span>' +
    '<h3>' +
    tip.title +
    '</h3>' +
    '<p>' +
    tip.body +
    '</p></' +
    LQ.H +
    '>' +
    '<button class="lesson-cta" onclick="LQ.finishLesson()">Finish lesson</button>';
};

LQ.renderExercise = function (wrap) {
  var ex = LQ._exercises[LQ._exIdx];
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
  var w = ex.word;
  var pool = LQ.shuffle(
    LQ.getWords()
      .filter(function (x) {
        return x.word !== w.word && x.def;
      })
      .slice(0, 40)
  ).slice(0, 3);
  while (pool.length < 3) {
    pool.push({
      word: '—',
      def: 'No distractor',
    });
  }
  var opts = LQ.shuffle(pool.concat([w]));
  var question =
    ex.mode === 'def'
      ? 'What does <strong>' + LQ.esc(w.word) + '</strong> mean?'
      : 'Which word matches this definition?';
  var prompt = ex.mode === 'def' ? '' : '<p class="lesson-prompt-def">' + w.def + '</p>';
  wrap.innerHTML =
    '<p class="lesson-phase-label">Practice</p>' +
    '<p class="lesson-question">' +
    question +
    '</p>' +
    prompt +
    opts
      .map(function (o, i) {
        var label = ex.mode === 'def' ? o.def : o.word;
        return (
          '<button type="button" class="lesson-opt" onclick="LQ.answerLessonMcq(' +
          i +
          ')">' +
          LQ.esc(label) +
          '</button>'
        );
      })
      .join('') +
    '<' +
    LQ.H +
    ' class="lesson-feedback" id="lesson-fb"></' +
    LQ.H +
    '>';
  LQ._currentOpts = opts;
  LQ._currentWord = w;
  LQ._currentMode = ex.mode;
};

LQ.answerLessonMcq = function (idx) {
  var fb = document.getElementById('lesson-fb');
  var correct = LQ._currentOpts[idx].word === LQ._currentWord.word;
  if (fb) {
    fb.className = 'lesson-feedback show ' + (correct ? 'ok' : 'fail');
    fb.textContent = correct ? 'Correct!' : 'Answer: ' + LQ._currentWord.word;
  }
  document.querySelectorAll('.lesson-opt').forEach(function (b) {
    b.disabled = true;
  });
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
  setTimeout(
    function () {
      LQ._exIdx++;
      LQ.renderLessonScreen();
    },
    correct ? 600 : 1000
  );
};

LQ.renderMatchExercise = function (wrap, ex) {
  var words = ex.words.slice(0, 4);
  LQ._matchWords = words;
  LQ._matchSelected = null;
  LQ._matchPairs = 0;
  var defs = LQ.shuffle(
    words.map(function (w) {
      return { id: w.word, text: w.def };
    })
  );
  wrap.innerHTML =
    '<p class="lesson-phase-label">Match pairs</p>' +
    '<p class="lesson-question">Tap a word, then its definition</p>' +
    '<' +
    LQ.H +
    ' class="match-grid">' +
    '<' +
    LQ.H +
    ' class="match-col" id="match-words">' +
    words
      .map(function (w) {
        return (
          '<button type="button" class="match-tile" data-side="word" data-id="' +
          LQ.esc(w.word) +
          '">' +
          LQ.esc(w.word) +
          '</button>'
        );
      })
      .join('') +
    '</' +
    LQ.H +
    '>' +
    '<' +
    LQ.H +
    ' class="match-col" id="match-defs">' +
    defs
      .map(function (d) {
        return (
          '<button type="button" class="match-tile" data-side="def" data-id="' +
          LQ.esc(d.id) +
          '">' +
          LQ.esc(d.text) +
          '</button>'
        );
      })
      .join('') +
    '</' +
    LQ.H +
    '></' +
    LQ.H +
    '>';
  wrap.querySelectorAll('.match-tile').forEach(function (btn) {
    btn.onclick = function () {
      LQ.onMatchTap(btn);
    };
  });
};

LQ.onMatchTap = function (btn) {
  if (btn.classList.contains('matched')) return;
  var side = btn.dataset.side;
  var id = btn.dataset.id;
  if (!LQ._matchSelected) {
    LQ._matchSelected = { side: side, id: id, el: btn };
    btn.classList.add('selected');
    return;
  }
  if (LQ._matchSelected.side === side) {
    LQ._matchSelected.el.classList.remove('selected');
    LQ._matchSelected = { side: side, id: id, el: btn };
    btn.classList.add('selected');
    return;
  }
  var match = LQ._matchSelected.id === id && LQ._matchSelected.side !== side;
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
  var bonus = 40 + LQ._lessonXp;
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
    title: 'Group complete!',
    sub: LQ._lessonTitle ? 'Finished: ' + LQ._lessonTitle : 'Next group unlocked.',
  });
};
