window.LQ = window.LQ || {};

LQ.SRS_QUALITY = { miss: 1, hard: 3, good: 4, nailed: 5 };

LQ.initSrsEntry = function () {
  return { ef: 2.5, interval: 0, reps: 0, due: Date.now() };
};

LQ.ensureSrs = function (word) {
  if (!LQ.S.srs[word]) LQ.S.srs[word] = LQ.initSrsEntry();
  return LQ.S.srs[word];
};

LQ.scheduleSrs = function (word, rating) {
  const q = LQ.SRS_QUALITY[rating] || 3;
  const card = LQ.ensureSrs(word);
  if (q < 3) {
    card.reps = 0;
    card.interval = 1;
  } else {
    card.reps += 1;
    if (card.reps === 1) card.interval = 1;
    else if (card.reps === 2) card.interval = 6;
    else card.interval = Math.round(card.interval * card.ef);
    card.ef = Math.max(1.3, card.ef + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
  }
  card.due = Date.now() + card.interval * 86400000;
  card.lastRating = rating;
  card.lastAt = Date.now();
};

LQ.getDueWords = function () {
  const now = Date.now();
  return LQ.getWords()
    .filter((w) => {
      const s = LQ.S.srs[w.word];
      return s && s.due <= now;
    })
    .sort((a, b) => (LQ.S.srs[a.word].due || 0) - (LQ.S.srs[b.word].due || 0));
};

LQ.getWeakWords = function () {
  return LQ.getWords().filter((w) => {
    const m = LQ.S.mastery[w.word];
    const s = LQ.S.srs[w.word];
    return m === 'new' || m === 'learning' || (s && (s.lastRating === 'miss' || s.lastRating === 'hard'));
  });
};

LQ.getFcScopeLabel = function () {
  if (LQ.S.fcGroupId && LQ.findGroup) {
    var hit = LQ.findGroup(LQ.S.fcGroupId);
    if (hit) {
      var listPart = LQ.getListTitle(hit.list.id, hit.list.title);
      var groupPart = LQ.formatGroupTitle ? LQ.formatGroupTitle(hit.group.title) : hit.group.title;
      return listPart + ' · ' + groupPart;
    }
  }
  var listId = LQ.S.fcListId || 'all';
  if (listId === 'all') return 'All lists';
  return LQ.getListTitle ? LQ.getListTitle(listId, listId) : listId;
};

/** Words available for the current flashcard list scope */
LQ.fcWordPool = function () {
  var pool;
  if (LQ.S.fcGroupId && LQ.wordsForGroup) {
    pool = LQ.wordsForGroup(LQ.S.fcGroupId);
  } else {
    pool = LQ.wordsFromList ? LQ.wordsFromList(LQ.S.fcListId || 'all') : LQ.getWords();
  }
  if (!LQ.S.premium && !(LQ.Config && LQ.Config.enableAllFeatures)) {
    pool = pool.filter(function (w) {
      return !w.premium;
    });
  }
  return pool.filter(function (w) {
    return w && w.word;
  });
};

LQ.buildFcQueue = function () {
  var pool = LQ.fcWordPool();
  if (!pool.length) {
    LQ.S.fcQueue = [];
    return;
  }
  var now = Date.now();
  var due = pool
    .filter(function (w) {
      var s = LQ.S.srs[w.word];
      return s && s.due <= now;
    })
    .sort(function (a, b) {
      return (LQ.S.srs[a.word].due || 0) - (LQ.S.srs[b.word].due || 0);
    })
    .map(function (w) {
      return w.word;
    });
  var weak = pool
    .filter(function (w) {
      var m = LQ.S.mastery[w.word];
      var s = LQ.S.srs[w.word];
      return (
        m === 'new' ||
        m === 'learning' ||
        (s && (s.lastRating === 'miss' || s.lastRating === 'hard'))
      );
    })
    .map(function (w) {
      return w.word;
    })
    .filter(function (w) {
      return due.indexOf(w) < 0;
    });
  var rest = pool
    .map(function (w) {
      return w.word;
    })
    .filter(function (w) {
      return due.indexOf(w) < 0 && weak.indexOf(w) < 0;
    });
  var prem = [];
  if (LQ.S.premium) {
    prem = pool
      .filter(function (w) {
        return w.premium;
      })
      .map(function (w) {
        return w.word;
      })
      .filter(function (w) {
        return due.indexOf(w) < 0;
      });
  }
  LQ.S.fcQueue = due.concat(weak, rest, prem);
  if (!LQ.S.fcQueue.length) LQ.S.fcQueue = pool.map(function (w) {
    return w.word;
  });
  if (LQ.S.fcIdx >= LQ.S.fcQueue.length) LQ.S.fcIdx = 0;
};

LQ.currentFcWord = function () {
  LQ.buildFcQueue();
  const name = LQ.S.fcQueue[LQ.S.fcIdx % Math.max(1, LQ.S.fcQueue.length)];
  if (!name) return null;
  var pool = LQ.fcWordPool();
  var hit = pool.find(function (w) {
    return w.word === name;
  });
  if (hit) return hit;
  return LQ.wordByName(name) || (LQ.resolveWord ? LQ.resolveWord(name) : null);
};
