window.LQ = window.LQ || {};

/* ── Word pairs (synonyms / antonyms) ── */

LQ.formatWordPairs = function (val, label) {
  if (!val || !String(val).trim()) return '';
  const items = String(val)
    .split(',')
    .map(function (s) {
      return s.trim();
    })
    .filter(Boolean);
  if (!items.length) return '';
  const cls = label === 'Antonyms' ? 'learn-ant' : 'learn-syn';
  return (
    '<p class="' +
    cls +
    '"><strong>' +
    label +
    ':</strong> ' +
    items.map(function (t) {
      return LQ.esc(t);
    }).join(', ') +
    '</p>'
  );
};

LQ.getWordGroupRole = function (wordName, listId) {
  if (!LQ.WORD_LISTS || !LQ.WORD_LISTS.lists) return null;
  var key = (wordName || '').trim().toLowerCase();
  if (!key) return null;

  if (listId && listId !== 'all') {
    var lst = LQ.WORD_LISTS.lists.find(function (l) {
      return l.id === listId;
    });
    if (lst && LQ.getListType(lst) !== 'dictionary') {
      for (var j = 0; j < (lst.groups || []).length; j++) {
        var g = lst.groups[j];
        var foundEntry = g.words.find(function (entry) {
          return entry.word && entry.word.toLowerCase() === key;
        });
        if (foundEntry && foundEntry.role) {
          return foundEntry.role;
        }
      }
    }
  } else {
    for (var i = 0; i < LQ.WORD_LISTS.lists.length; i++) {
      var lst = LQ.WORD_LISTS.lists[i];
      if (LQ.getListType(lst) === 'dictionary') continue;
      for (var j = 0; j < (lst.groups || []).length; j++) {
        var g = lst.groups[j];
        var foundEntry = g.words.find(function (entry) {
          return entry.word && entry.word.toLowerCase() === key;
        });
        if (foundEntry && foundEntry.role) {
          return foundEntry.role;
        }
      }
    }
  }
  return null;
};

LQ.getWordRelationBadgeHTML = function (wordName, listId) {
  var role = LQ.getWordGroupRole(wordName, listId);
  if (!role) return '';
  if (role === 'antonym' || role === 'contrast') {
    return '<span class="word-role-badge opposite learn-relation-badge">Opposite</span>';
  } else if (role === 'note') {
    return '<span class="word-role-badge similar learn-relation-badge">Similar</span>';
  }
  return '';
};

LQ.getGroupOppositeWords = function (wordName) {
  if (!LQ.WORD_LISTS || !LQ.WORD_LISTS.lists) return [];
  var key = (wordName || '').trim().toLowerCase();
  if (!key) return [];

  var opposites = [];
  for (var i = 0; i < LQ.WORD_LISTS.lists.length; i++) {
    var lst = LQ.WORD_LISTS.lists[i];
    if (LQ.getListType(lst) === 'dictionary') continue;
    for (var j = 0; j < (lst.groups || []).length; j++) {
      var g = lst.groups[j];
      var targetEntry = g.words.find(function (ew) {
        return ew.word && ew.word.toLowerCase() === key;
      });
      if (targetEntry) {
        var role = targetEntry.role || '';
        var isOppositeWord = (role === 'antonym' || role === 'contrast');
        
        g.words.forEach(function (ew) {
          if (!ew.word || ew.word.toLowerCase() === key) return;
          var ewRole = ew.role || '';
          if (isOppositeWord) {
            if (ewRole !== 'antonym' && ewRole !== 'contrast' && ewRole !== 'note' && ewRole !== 'variant') {
              opposites.push(ew.word);
            }
          } else {
            if (ewRole === 'antonym' || ewRole === 'contrast') {
              opposites.push(ew.word);
            }
          }
        });
      }
    }
  }
  return opposites;
};

LQ.groupHasOpposites = function (wordName) {
  var ants = LQ.getGroupOppositeWords(wordName);
  return ants && ants.length > 0;
};

/* ── List names & order ── */

LQ.ensureListPrefs = function () {
  LQ.S.listPrefs = LQ.S.listPrefs || { names: {}, order: null };
  if (!LQ.S.listPrefs.names) LQ.S.listPrefs.names = {};
  if (LQ.WORD_LISTS && LQ.WORD_LISTS.lists) {
    var allIds = LQ.WORD_LISTS.lists.map(function (l) {
      return l.id;
    });
    if (!LQ.S.listPrefs.order) {
      LQ.S.listPrefs.order = allIds.slice();
    } else {
      allIds.forEach(function (id) {
        if (LQ.S.listPrefs.order.indexOf(id) < 0) LQ.S.listPrefs.order.push(id);
      });
      LQ.S.listPrefs.order = LQ.S.listPrefs.order.filter(function (id) {
        return allIds.indexOf(id) >= 0;
      });
    }
  }
};

LQ.getListTitle = function (listId, fallback) {
  LQ.ensureListPrefs();
  const custom = LQ.S.listPrefs.names[listId];
  if (custom && String(custom).trim()) return String(custom).trim();
  return fallback || listId;
};

LQ.getOrderedLists = function () {
  if (!LQ.ensurePathData()) return [];
  LQ.ensureListPrefs();
  const byId = {};
  LQ.WORD_LISTS.lists.forEach(function (l) {
    byId[l.id] = l;
  });
  return (LQ.S.listPrefs.order || [])
    .map(function (id) {
      return byId[id];
    })
    .filter(Boolean);
};

LQ.getOrderedChapters = function () {
  if (!LQ.ensurePathData()) return [];
  LQ.ensureListPrefs();
  const byId = {};
  LQ.CHAPTERS.forEach(function (ch) {
    byId[ch.id] = ch;
  });
  return (LQ.S.listPrefs.order || [])
    .map(function (id) {
      var ch = byId[id];
      if (!ch) return null;
      return {
        id: ch.id,
        title: LQ.getListTitle(id, ch.title),
        icon: ch.icon,
        subtitle: ch.subtitle,
        listNum: ch.listNum,
        color: ch.color,
        listType: ch.listType || 'grouped',
        wordCount: ch.wordCount,
      };
    })
    .filter(Boolean);
};

LQ.setListName = function (listId, name) {
  LQ.ensureListPrefs();
  name = (name || '').trim();
  if (name) LQ.S.listPrefs.names[listId] = name;
  else delete LQ.S.listPrefs.names[listId];
  LQ.saveState();
  if (LQ.renderVocabPage) LQ.renderVocabPage();
  if (LQ.renderLearningPath) LQ.renderLearningPath();
};

LQ.moveList = function (listId, dir) {
  LQ.ensureListPrefs();
  var order = LQ.S.listPrefs.order;
  var i = order.indexOf(listId);
  if (i < 0) return;
  var j = dir === 'up' ? i - 1 : i + 1;
  if (j < 0 || j >= order.length) return;
  var tmp = order[i];
  order[i] = order[j];
  order[j] = tmp;
  LQ.saveState();
  if (LQ.renderSettings) LQ.renderSettings();
  if (LQ.renderVocabPage) LQ.renderVocabPage();
  if (LQ.renderLearningPath) LQ.renderLearningPath();
};

LQ.resetListPrefs = function () {
  LQ.S.listPrefs = { names: {}, order: null };
  LQ.ensureListPrefs();
  LQ.saveState();
  LQ.toast('List names & order reset');
  if (LQ.renderSettings) LQ.renderSettings();
  if (LQ.renderVocabPage) LQ.renderVocabPage();
  if (LQ.renderLearningPath) LQ.renderLearningPath();
};

LQ.renderListSettings = function () {
  var wrap = document.getElementById('list-settings-wrap');
  if (!wrap) return;
  if (!LQ.ensurePathData()) {
    wrap.innerHTML = '<p class="settings-text">Word lists not loaded.</p>';
    return;
  }
  var lists = LQ.getOrderedLists();
  wrap.innerHTML =
    '<div class="settings-row-list">' +
    lists
      .map(function (lst, idx) {
        var title = LQ.getListTitle(lst.id, lst.title);
        return (
          '<div class="list-setting-row">' +
          '<span class="list-setting-num">' +
          (idx + 1) +
          '</span>' +
          '<input class="list-setting-input" id="list-name-' +
          lst.id +
          '" value="' +
          LQ.esc(title) +
          '" placeholder="' +
          LQ.esc(lst.title) +
          '">' +
          '<div class="list-setting-btns">' +
          '<button type="button" class="list-move-btn" ' +
          (idx === 0 ? 'disabled' : '') +
          ' onclick="LQ.moveList(\'' +
          lst.id +
          '\',\'up\')">↑</button>' +
          '<button type="button" class="list-move-btn" ' +
          (idx === lists.length - 1 ? 'disabled' : '') +
          ' onclick="LQ.moveList(\'' +
          lst.id +
          '\',\'down\')">↓</button>' +
          '</div></div>'
        );
      })
      .join('') +
    '</div>' +
    '<div class="settings-action-stack" style="margin-top:12px">' +
    '<button type="button" class="portal-btn show" onclick="LQ.saveListNamesFromInputs()">Save list names</button>' +
    '<button type="button" class="portal-btn portal-btn-secondary show" onclick="LQ.resetListPrefs()">Reset to defaults</button>' +
    '</div>';
};

LQ.saveListNamesFromInputs = function () {
  if (!LQ.ensurePathData()) return;
  LQ.getOrderedLists().forEach(function (lst) {
    var inp = document.getElementById('list-name-' + lst.id);
    if (inp) LQ.setListName(lst.id, inp.value);
  });
  LQ.toast('List names saved');
  LQ.renderListSettings();
};

LQ.wordsFromList = function (listId) {
  if (!listId || listId === 'all') return LQ.getWords();
  if (!LQ.WORD_LISTS) return [];
  var lst = LQ.WORD_LISTS.lists.find(function (l) {
    return l.id === listId;
  });
  if (!lst) return [];
  var names = LQ.listWordNames(lst);
  var seen = {};
  var out = [];
  names.forEach(function (n) {
    var key = n.toLowerCase();
    if (seen[key]) return;
    seen[key] = true;
    out.push(LQ.resolveWordFromList ? LQ.resolveWordFromList(n, lst) : LQ.wordByName(n));
  });
  return out;
};

LQ.renderLearnListPicker = function () {
  var bar = document.getElementById('learn-list-bar');
  if (!bar || !LQ.ensurePathData()) return;
  var current = LQ.S.learnListId || 'all';
  var lists = LQ.getOrderedLists();
  var chips =
    '<button type="button" class="learn-list-chip' +
    (current === 'all' ? ' active' : '') +
    '" onclick="LQ.pickLearnList(\'all\')">All lists</button>' +
    lists
      .map(function (lst) {
        var lbl = LQ.getListTitle(lst.id, lst.title);
        return (
          '<button type="button" class="learn-list-chip' +
          (current === lst.id ? ' active' : '') +
          '" onclick="LQ.pickLearnList(\'' +
          lst.id +
          '\')">' +
          LQ.esc(lbl) +
          '</button>'
        );
      })
      .join('');
  bar.innerHTML =
    '<p class="learn-list-label">Study from</p><div class="learn-list-chips">' +
    chips +
    '</div>' +
    (LQ.difficultyFilterHtml
      ? '<p class="learn-list-label">Difficulty</p>' +
        LQ.difficultyFilterHtml(LQ.S.learnDifficultyFilter || 'all', 'LQ.pickLearnDifficulty')
      : '');
};

LQ.pickLearnList = function (listId) {
  LQ.S.learnListId = listId;
  LQ.saveState();
  LQ.initLearn();
};

LQ.renderFcListPicker = function () {
  var bar = document.getElementById('fc-list-bar');
  if (!bar || !LQ.ensurePathData()) return;
  var current = LQ.S.fcListId || 'all';
  var lists = LQ.getOrderedLists();
  var chips =
    '<button type="button" class="learn-list-chip' +
    (current === 'all' ? ' active' : '') +
    '" onclick="LQ.pickFcList(\'all\')">All lists</button>' +
    lists
      .map(function (lst) {
        var lbl = LQ.getListTitle(lst.id, lst.title);
        var badge =
          LQ.getListType(lst) === 'dictionary'
            ? ' <span class="lists-type-badge dict">Dict</span>'
            : ' <span class="lists-type-badge gre">GRE</span>';
        return (
          '<button type="button" class="learn-list-chip' +
          (current === lst.id ? ' active' : '') +
          '" onclick="LQ.pickFcList(\'' +
          lst.id +
          '\')">' +
          LQ.esc(lbl) +
          badge +
          '</button>'
        );
      })
      .join('');
  bar.innerHTML =
    '<p class="learn-list-label">Cards from</p><div class="learn-list-chips">' +
    chips +
    '</div><p class="fc-scope-hint">' +
    LQ.esc(LQ.getFcScopeLabel ? LQ.getFcScopeLabel() : current) +
    '</p>';
};

LQ.pickFcList = function (listId) {
  LQ.S.fcListId = listId || 'all';
  LQ.S.fcGroupId = null;
  LQ.S.fcIdx = 0;
  LQ._fcFlipped = false;
  LQ._fcFlippedWord = null;
  LQ.saveState();
  if (LQ.renderFcListPicker) LQ.renderFcListPicker();
  if (LQ.renderFC) LQ.renderFC();
};

LQ.startListFlashcards = function (listId, groupId) {
  LQ.S.fcListId = listId || 'all';
  LQ.S.fcGroupId = groupId || null;
  if (groupId && LQ.findGroup) {
    var hit = LQ.findGroup(groupId);
    if (hit) LQ.S.fcListId = hit.list.id;
  }
  LQ.S.fcIdx = 0;
  LQ._fcFlipped = false;
  LQ._fcFlippedWord = null;
  LQ._fcListViewActive = false;
  LQ.saveState();
  LQ.goTo('flashcard');
  setTimeout(function () {
    if (LQ.renderFcListPicker) LQ.renderFcListPicker();
    if (LQ.renderFC) LQ.renderFC();
  }, 50);
};
window.LQ.startListFlashcards = LQ.startListFlashcards;
window.LQ.pickFcList = LQ.pickFcList;

/* ── Word status (Jamboree-style: known / flagged / unmarked) ── */

LQ.getWordStatus = function (wordName) {
  const s = LQ.S.mastery[wordName];
  if (s === 'known') return 'known';
  if (s === 'flagged') return 'flagged';
  return 'unmarked';
};

LQ.setWordKnown = function (wordName) {
  LQ.S.mastery[wordName] = 'known';
  LQ.scheduleSrs(wordName, 'nailed');
  LQ.recordActivity(wordName, 'known');
  LQ.S.goalNew++;
  LQ.updateGoal();
};

LQ.setWordFlagged = function (wordName) {
  LQ.S.mastery[wordName] = 'flagged';
  LQ.scheduleSrs(wordName, 'hard');
  LQ.recordActivity(wordName, 'flagged');
  LQ.S.goalSeen++;
  LQ.updateGoal();
};

LQ.getWordCounts = function () {
  const words = LQ.getWords();
  let known = 0;
  let flagged = 0;
  let unmarked = 0;
  words.forEach(function (w) {
    const st = LQ.getWordStatus(w.word);
    if (st === 'known') known++;
    else if (st === 'flagged') flagged++;
    else unmarked++;
  });
  return { known: known, flagged: flagged, unmarked: unmarked, total: words.length };
};

LQ.listWordNames = function (list) {
  if (LQ.getListType(list) === 'dictionary') {
    return (list.words || []).map(function (entry) {
      return typeof entry === 'string' ? entry : entry.word;
    });
  }
  const names = [];
  (list.groups || []).forEach(function (g) {
    g.words.forEach(function (entry) {
      if (entry.role !== 'variant') names.push(entry.word);
    });
  });
  return names;
};

LQ.getListProgress = function () {
  if (!LQ.ensurePathData()) return [];
  return LQ.getOrderedLists().map(function (lst) {
    const names = LQ.listWordNames(lst);
    const seen = {};
    let known = 0;
    let touched = 0;
    names.forEach(function (name) {
      const key = name.toLowerCase();
      if (seen[key]) return;
      seen[key] = true;
      const w = LQ.resolveWordFromList ? LQ.resolveWordFromList(name, lst) : LQ.wordByName(name);
      if (!w) return;
      const st = LQ.getWordStatus(w.word);
      if (st === 'known') {
        known++;
        touched++;
      } else if (st === 'flagged') touched++;
    });
    const total = Object.keys(seen).length;
    return {
      id: lst.id,
      listNum: lst.listNum,
      title: LQ.getListTitle(lst.id, lst.title),
      total: total,
      known: known,
      touched: touched,
      pct: total ? Math.round((touched / total) * 100) : 0,
      knownPct: total ? Math.round((known / total) * 100) : 0,
    };
  });
};

LQ.getQuizAccuracy = function () {
  const qs = LQ.S.quizStats || { correct: 0, total: 0 };
  if (!qs.total) return 0;
  return Math.round((qs.correct / qs.total) * 100);
};

LQ.recordQuizResult = function (correct, total, misses) {
  LQ.S.quizStats = LQ.S.quizStats || { correct: 0, total: 0 };
  LQ.S.quizStats.correct += correct;
  LQ.S.quizStats.total += total;
  LQ.S.lastQuizMisses = misses || [];
  LQ.saveState();
};

/* ── Home dashboard ── */

LQ.renderVocabPage = function () {
  const counts = LQ.getWordCounts();
  const accuracy = LQ.getQuizAccuracy();

  const elKnown = document.getElementById('dash-known');
  const elFlagged = document.getElementById('dash-flagged');
  const elUnmarked = document.getElementById('dash-unmarked');
  if (elKnown) elKnown.textContent = counts.known;
  if (elFlagged) elFlagged.textContent = counts.flagged;
  if (elUnmarked) elUnmarked.textContent = counts.unmarked;

  const accEl = document.getElementById('dash-quiz-acc');
  const ringEl = document.getElementById('dash-quiz-ring');
  if (accEl) accEl.textContent = accuracy + '%';
  if (ringEl) {
    const deg = Math.round((accuracy / 100) * 360);
    const brand = document.body.classList.contains('portal-theme') ? '#c0392b' : 'var(--lime)';
    const track = document.body.classList.contains('portal-theme') ? 'rgba(192,57,43,.12)' : 'rgba(245,166,35,.15)';
    ringEl.style.background =
      'conic-gradient(' + brand + ' 0deg ' + deg + 'deg, ' + track + ' ' + deg + 'deg 360deg)';
  }

  const reviseCount = document.getElementById('hero-revise-count');
  if (reviseCount) {
    reviseCount.textContent = counts.flagged ? counts.flagged + ' flagged' : 'Nothing flagged yet';
  }

  const learnCount = document.getElementById('hero-learn-count');
  if (learnCount) {
    learnCount.textContent = counts.unmarked ? counts.unmarked + ' unmarked' : 'All marked';
  }

  const bars = document.getElementById('dash-list-bars');
  if (bars) {
    const lists = LQ.getListProgress();
    bars.innerHTML = lists
      .map(function (lp) {
        return (
          '<div class="dash-list-row">' +
          '<span class="dash-list-label">' +
          LQ.esc(lp.title) +
          '</span>' +
          '<div class="dash-list-bar" role="progressbar" aria-valuenow="' +
          lp.pct +
          '">' +
          '<div class="dash-list-bar-known" style="width:' +
          lp.knownPct +
          '%"></div>' +
          '<div class="dash-list-bar-touched" style="width:' +
          lp.pct +
          '%"></div>' +
          '</div></div>'
        );
      })
      .join('');
  }
};

LQ.homeSearch = function (q) {
  q = (q || '').trim().toLowerCase();
  if (!q) return;
  LQ._wbSearchPrefill = q;
  LQ.goTo('wordbank');
};

/* ── Learn mode (unmarked words) ── */

LQ.initLearn = function () {
  LQ.renderLearnListPicker();
  var listId = LQ.S.learnListId || 'all';
  var pool = LQ.wordsFromList(listId).filter(function (w) {
    return LQ.getWordStatus(w.word) === 'unmarked';
  });
  if (LQ.filterByDifficulty) pool = LQ.filterByDifficulty(pool, LQ.S.learnDifficultyFilter || 'all');
  LQ._learnQueue = LQ.shuffle(pool);
  LQ._learnIdx = 0;
  LQ._learnReveal = false;
  LQ.renderLearnScreen();
  if (LQ.refreshFlowBackBtn) LQ.refreshFlowBackBtn();
};

LQ.renderLearnScreen = function () {
  const wrap = document.getElementById('learn-wrap');
  const counter = document.getElementById('learn-counter');
  if (!wrap) return;

  const listLabel =
    LQ.S.learnListId && LQ.S.learnListId !== 'all'
      ? LQ.getListTitle(LQ.S.learnListId, LQ.S.learnListId)
      : 'All lists';

  if (!LQ._learnQueue || !LQ._learnQueue.length) {
    wrap.innerHTML =
      '<div class="learn-empty">' +
      '<p class="learn-empty-icon">🎉</p>' +
      '<h3>All words marked!</h3>' +
      '<p>No unmarked words in <strong>' +
      LQ.esc(listLabel) +
      '</strong>. Pick another list or try Revise.</p>' +
      '<button class="lesson-cta" onclick="goTo(\'vocab\')">Back to Vocab</button></div>';
    if (counter) counter.textContent = '0 / 0';
    return;
  }

  const w = LQ._learnQueue[LQ._learnIdx % LQ._learnQueue.length];
  if (counter) counter.textContent = LQ._learnIdx + 1 + ' / ' + LQ._learnQueue.length;
  if (!w) return;

  var dictSyns = String(w.syn || '')
    .split(',')
    .map(function (s) { return s.trim(); })
    .filter(Boolean);
  var groupSyns = [];
  if (LQ.WORD_LISTS && LQ.WORD_LISTS.lists) {
    var key = w.word.toLowerCase();
    for (var i = 0; i < LQ.WORD_LISTS.lists.length; i++) {
      var lst = LQ.WORD_LISTS.lists[i];
      if (LQ.getListType(lst) === 'dictionary') continue;
      for (var j = 0; j < (lst.groups || []).length; j++) {
        var g = lst.groups[j];
        var targetEntry = g.words.find(function (ew) {
          return ew.word && ew.word.toLowerCase() === key;
        });
        if (targetEntry) {
          var role = targetEntry.role || '';
          var isOppositeWord = (role === 'antonym' || role === 'contrast');
          g.words.forEach(function (ew) {
            if (!ew.word || ew.word.toLowerCase() === key) return;
            var ewRole = ew.role || '';
            if (isOppositeWord) {
              if (ewRole === 'antonym' || ewRole === 'contrast') {
                groupSyns.push(ew.word);
              }
            } else {
              if (ewRole !== 'antonym' && ewRole !== 'contrast' && ewRole !== 'variant') {
                groupSyns.push(ew.word);
              }
            }
          });
        }
      }
    }
  }
  var allSyns = [];
  var seenSyn = {};
  dictSyns.concat(groupSyns).forEach(function (synWord) {
    var lower = synWord.toLowerCase();
    if (!seenSyn[lower]) {
      seenSyn[lower] = true;
      allSyns.push(synWord);
    }
  });
  const synString = allSyns.join(', ');

  var dictAnts = String(w.ant || '')
    .split(',')
    .map(function (s) { return s.trim(); })
    .filter(Boolean);
  var groupAnts = LQ.getGroupOppositeWords ? LQ.getGroupOppositeWords(w.word) : [];
  var allAnts = [];
  var seenAnt = {};
  dictAnts.concat(groupAnts).forEach(function (antWord) {
    var lower = antWord.toLowerCase();
    if (!seenAnt[lower]) {
      seenAnt[lower] = true;
      allAnts.push(antWord);
    }
  });
  const antString = allAnts.join(', ');

  const synAnt =
    LQ.formatWordPairs(synString, 'Synonyms') + LQ.formatWordPairs(antString, 'Antonyms');

  const hasPrev = LQ._learnIdx > 0;
  const prevBtn = '<button class="learn-act prev" onclick="LQ.learnPrev()"' + (hasPrev ? '' : ' disabled') + '>← Prev</button>';

  const actions =
    '<div class="learn-actions">' +
    '<button class="learn-act known" onclick="LQ.learnMark(\'known\')">✓ Known</button>' +
    '<button class="learn-act flag" onclick="LQ.learnMark(\'flagged\')">🚩 Flag</button>' +
    prevBtn +
    '<button class="learn-act skip" onclick="LQ.learnSkip()">Next →</button>' +
    '</div>' +
    '<p class="learn-next-hint">Next moves on without marking · Known and Flag save your progress</p>';

  const listId = LQ.S.learnListId || 'all';
  const relationBadge = LQ.getWordRelationBadgeHTML ? LQ.getWordRelationBadgeHTML(w.word, listId) : '';

  const hasOpposites = (w.ant && w.ant.trim()) || (LQ.groupHasOpposites && LQ.groupHasOpposites(w.word));
  const revealBtnText = hasOpposites ? 'Show meaning & opposites' : 'Show meaning';

  if (!LQ._learnReveal) {
    wrap.innerHTML =
      '<p class="lesson-phase-label">' +
      LQ.esc(listLabel) +
      ' · Do you know this word?</p>' +
      '<div class="learn-card learn-card-prompt">' +
      relationBadge +
      '<h2 class="learn-word">' +
      LQ.esc(w.word) +
      '</h2>' +
      (w.phonetic ? '<p class="learn-phon">' + LQ.esc(w.phonetic) + '</p>' : '') +
      '<p class="learn-hint">Mark <strong>Known</strong> if you know the meaning, or <strong>Flag</strong> to revise later.</p>' +
      '</div>' +
      '<button class="lesson-cta lesson-cta-secondary" onclick="LQ.revealLearn()">' + revealBtnText + '</button>' +
      (LQ.wordDifficultyHtml ? LQ.wordDifficultyHtml(w.word) : '') +
      actions;
    return;
  }

  wrap.innerHTML =
    '<p class="lesson-phase-label">' +
    LQ.esc(w.word) +
    '</p>' +
    '<div class="learn-card">' +
    relationBadge +
    '<p class="learn-def">' +
    w.def +
    '</p>' +
    (LQ.renderExampleBlock ? LQ.renderExampleBlock(w) : '<p class="learn-ex">"' + w.example + '"</p>') +
    synAnt +
    '</div>' +
    (LQ.wordDifficultyHtml ? LQ.wordDifficultyHtml(w.word) : '') +
    '<div class="learn-actions">' +
    '<button class="learn-act known" onclick="LQ.learnMark(\'known\')">✓ Known</button>' +
    '<button class="learn-act flag" onclick="LQ.learnMark(\'flagged\')">🚩 Flag to revise</button>' +
    prevBtn +
    '<button class="learn-act skip" onclick="LQ.learnSkip()">Next →</button>' +
    '</div>' +
    '<p class="learn-next-hint">Next moves on without marking · Known and Flag save your progress</p>';
};

LQ.revealLearn = function () {
  LQ._learnReveal = true;
  LQ.renderLearnScreen();
};

LQ.learnMark = function (status) {
  const w = LQ._learnQueue[LQ._learnIdx % LQ._learnQueue.length];
  if (!w) return;
  if (status === 'known') {
    LQ.setWordKnown(w.word);
    LQ.gainXP(15);
    LQ.toast('✓ Marked known');
  } else {
    LQ.setWordFlagged(w.word);
    LQ.gainXP(8);
    LQ.toast('🚩 Flagged for revision');
  }
  LQ._learnIdx++;
  LQ._learnReveal = false;
  LQ.saveState();
  LQ.renderLearnScreen();
  if (LQ.refreshFlowBackBtn) LQ.refreshFlowBackBtn();
};

LQ.learnSkip = function () {
  LQ._learnIdx++;
  LQ._learnReveal = false;
  LQ.renderLearnScreen();
  if (LQ.refreshFlowBackBtn) LQ.refreshFlowBackBtn();
};

LQ.learnPrev = function () {
  if (!LQ._learnQueue || !LQ._learnQueue.length || LQ._learnIdx <= 0) return false;
  LQ._learnIdx--;
  LQ._learnReveal = false;
  LQ.renderLearnScreen();
  if (LQ.refreshFlowBackBtn) LQ.refreshFlowBackBtn();
  return true;
};

/* ── Revise mode (flip cards, flagged only) ── */

LQ.initRevise = function () {
  if (LQ.renderReviseFilterBar) LQ.renderReviseFilterBar();
  var pool = LQ.getWords().filter(function (w) {
    return LQ.getWordStatus(w.word) === 'flagged';
  });
  if (LQ.filterByDifficulty) pool = LQ.filterByDifficulty(pool, LQ.S.reviseDifficultyFilter || 'all');
  LQ._reviseQueue = LQ.shuffle(pool);
  LQ._reviseIdx = 0;
  LQ._reviseFlipped = false;
  LQ.renderReviseScreen();
};

LQ.renderReviseScreen = function () {
  const wrap = document.getElementById('revise-wrap');
  const counter = document.getElementById('revise-counter');
  if (!wrap) return;

  if (!LQ._reviseQueue || !LQ._reviseQueue.length) {
    wrap.innerHTML =
      '<div class="learn-empty">' +
      '<p class="learn-empty-icon">📚</p>' +
      '<h3>No flagged words</h3>' +
      '<p>Flag words during Learn to build your revision deck.</p>' +
      '<button class="lesson-cta" onclick="LQ.initLearn();goTo(\'learn\')">Begin Learning</button>' +
      '<button class="lesson-cta lesson-cta-secondary" style="margin-top:10px" onclick="goTo(\'home\')">Dashboard</button></div>';
    if (counter) counter.textContent = '0 / 0';
    return;
  }

  const w = LQ._reviseQueue[LQ._reviseIdx % LQ._reviseQueue.length];
  const group = LQ.wordGroupLabel(w.word);
  if (counter) counter.textContent = LQ._reviseIdx + 1 + ' / ' + LQ._reviseQueue.length;

  const flipped = LQ._reviseFlipped ? ' flipped' : '';
  wrap.innerHTML =
    '<div class="revise-flip' +
    flipped +
    '" onclick="LQ.toggleReviseFlip()">' +
    '<div class="revise-card revise-front">' +
    '<span class="revise-tag">Tap to flip</span>' +
    '<h2 class="revise-word">' +
    LQ.esc(w.word) +
    '</h2>' +
    (group ? '<p class="revise-group">' + LQ.esc(group) + '</p>' : '') +
    '</div>' +
    '<div class="revise-card revise-back">' +
    '<p class="revise-def">' +
    w.def +
    '</p>' +
    (LQ.renderExampleBlock
      ? LQ.renderExampleBlock(w, { className: 'revise-ex', dark: true, compact: true })
      : '') +
    (group ? '<p class="revise-group-back">Group: ' + LQ.esc(group) + '</p>' : '') +
    LQ.formatWordPairs(w.syn, 'Synonyms') +
    LQ.formatWordPairs(w.ant, 'Antonyms') +
    '</div></div>' +
    '<div class="revise-actions">' +
    '<button class="learn-act known" onclick="LQ.reviseConfirm(true)">✓ Got it</button>' +
    '<button class="learn-act flag" onclick="LQ.reviseConfirm(false)">Keep flagged</button>' +
    '</div>';
};

LQ.wordGroupLabel = function (wordName) {
  if (!LQ.WORD_LISTS || !LQ.WORD_LISTS.lists) return '';
  const key = wordName.toLowerCase();
  for (var i = 0; i < LQ.WORD_LISTS.lists.length; i++) {
    var lst = LQ.WORD_LISTS.lists[i];
    if (LQ.getListType(lst) === 'dictionary') {
      for (var d = 0; d < (lst.words || []).length; d++) {
        var ent = lst.words[d];
        var wn = typeof ent === 'string' ? ent : ent.word;
        if (wn && wn.toLowerCase() === key) {
          return LQ.getListTitle(lst.id, lst.title);
        }
      }
      continue;
    }
    for (var j = 0; j < (lst.groups || []).length; j++) {
      var g = lst.groups[j];
      for (var k = 0; k < g.words.length; k++) {
        if (g.words[k].word.toLowerCase() === key) {
          return LQ.formatGroupTitle ? LQ.formatGroupTitle(g.title) : g.title;
        }
      }
    }
  }
  return '';
};

LQ.wordContextLabel = function (wordName, scopeListId) {
  scopeListId = scopeListId || (LQ.S && LQ.S.fcListId) || 'all';
  var key = (wordName || '').toLowerCase();
  if (!key || !LQ.WORD_LISTS || !LQ.WORD_LISTS.lists) return '';
  if (scopeListId !== 'all') {
    var scoped = LQ.WORD_LISTS.lists.find(function (l) {
      return l.id === scopeListId;
    });
    if (scoped) {
      var names = LQ.listWordNames(scoped);
      if (
        names.some(function (n) {
          return n.toLowerCase() === key;
        })
      ) {
        if (LQ.getListType(scoped) === 'dictionary') {
          return LQ.getListTitle(scoped.id, scoped.title);
        }
        for (var j = 0; j < (scoped.groups || []).length; j++) {
          var g = scoped.groups[j];
          for (var k = 0; k < g.words.length; k++) {
            if (g.words[k].word.toLowerCase() === key) {
              return LQ.formatGroupTitle ? LQ.formatGroupTitle(g.title) : g.title;
            }
          }
        }
        return LQ.getListTitle(scoped.id, scoped.title);
      }
    }
  }
  return LQ.wordGroupLabel(wordName);
};

LQ.toggleReviseFlip = function () {
  if (LQ._exampleEditing) return;
  LQ._reviseFlipped = !LQ._reviseFlipped;
  const el = document.querySelector('.revise-flip');
  if (el) el.classList.toggle('flipped', LQ._reviseFlipped);
};

LQ.reviseConfirm = function (gotIt) {
  const w = LQ._reviseQueue[LQ._reviseIdx % LQ._reviseQueue.length];
  if (!w) return;
  if (gotIt) {
    LQ.setWordKnown(w.word);
    LQ.gainXP(20);
    LQ.toast('✓ Moved to known');
    LQ._reviseQueue.splice(LQ._reviseIdx % LQ._reviseQueue.length, 1);
    if (LQ._reviseIdx >= LQ._reviseQueue.length) LQ._reviseIdx = 0;
  } else {
    LQ.toast('Still flagged');
    LQ._reviseIdx++;
  }
  LQ._reviseFlipped = false;
  LQ.saveState();
  LQ.renderReviseScreen();
  if (LQ.refreshFlowBackBtn) LQ.refreshFlowBackBtn();
};

LQ.revisePrev = function () {
  if (!LQ._reviseQueue || !LQ._reviseQueue.length || LQ._reviseIdx <= 0) return false;
  LQ._reviseIdx--;
  LQ._reviseFlipped = false;
  LQ.renderReviseScreen();
  if (LQ.refreshFlowBackBtn) LQ.refreshFlowBackBtn();
  return true;
};

/* ── Quiz review ── */

LQ.renderQuizReview = function (score, total, misses) {
  const card = document.getElementById('quiz-card');
  const body = document.getElementById('quiz-body');
  const pct = total ? Math.round((score / total) * 100) : 0;

  if (card) {
    card.innerHTML =
      '<p class="quiz-label">Quiz complete</p>' +
      '<p class="quiz-word" style="font-size:42px">' +
      pct +
      '%</p>' +
      '<p class="quiz-hint">' +
      score +
      ' / ' +
      total +
      ' correct</p>';
  }

  let missHtml = '';
  if (misses && misses.length) {
    const byGroup = {};
    misses.forEach(function (w) {
      const g = LQ.wordGroupLabel(w.word) || 'Other';
      if (!byGroup[g]) byGroup[g] = [];
      byGroup[g].push(w);
    });
    missHtml =
      '<div class="quiz-review">' +
      '<h3>Troublesome words</h3>' +
      Object.keys(byGroup)
        .map(function (g) {
          return (
            '<div class="quiz-review-group"><h4>' +
            LQ.esc(g) +
            '</h4>' +
            byGroup[g]
              .map(function (w) {
                return (
                  '<button type="button" class="quiz-review-word" data-word="' +
                  LQ.esc(w.word) +
                  '" onclick="LQ.flagFromReview(this.dataset.word)">' +
                  LQ.esc(w.word) +
                  ' <span>Flag →</span></button>'
                );
              })
              .join('') +
            '</div>'
          );
        })
        .join('') +
      '</div>';
  } else {
    missHtml = '<p class="quiz-review-empty">Perfect score — no misses!</p>';
  }

  if (body) {
    body.innerHTML =
      missHtml +
      LQ.renderFlowComplete({
        context: 'quiz',
        title: pct >= 80 ? 'Great score!' : 'Quiz complete',
        score: score + ' / ' + total + ' correct',
        message: pct >= 80 ? 'Keep it up — try Revise or Tenses next.' : 'Flag misses above, then revise those words.',
        icon: pct >= 80 ? '🏆' : '📝',
      });
  }
};

LQ.flagFromReview = function (wordName) {
  LQ.setWordFlagged(wordName);
  LQ.gainXP(5);
  LQ.saveState();
  LQ.toast('🚩 ' + wordName + ' flagged');
};
