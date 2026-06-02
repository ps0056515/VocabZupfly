window.LQ = window.LQ || {};
LQ.WORDS = [];
LQ.WORD_LISTS = null;

LQ.wordListsReady = fetch('data/word-lists.json')
  .then(function (r) {
    if (!r.ok) throw new Error('word-lists.json ' + r.status);
    return r.json();
  })
  .then(function (data) {
    LQ.WORD_LISTS = data;
    LQ._pathDataReady = false;
    return data;
  })
  .catch(function (err) {
    console.warn('word-lists.json failed', err);
    LQ.WORD_LISTS = null;
    return null;
  });

LQ.wordsReady = Promise.all([
  fetch('data/words-merged.json')
    .then(function (r) {
      if (r.ok) return r.json();
      return fetch('data/words.json').then(function (r2) {
        if (!r2.ok) throw new Error('words json ' + r2.status);
        return r2.json();
      });
    }),
  LQ.wordListsReady,
])
  .then(function (pair) {
    LQ.WORDS = Array.isArray(pair[0]) ? pair[0] : [];
    return LQ.WORDS;
  })
  .catch(function (err) {
    console.warn('words load failed', err);
    LQ.WORDS = [];
    return [];
  });

LQ.getWords = function (filter) {
  let list = LQ.WORDS.slice();
  const exam = LQ.S && LQ.S.examFocus;
  if (exam && exam !== 'ALL') list = list.filter((w) => !w.tags || w.tags.includes(exam));
  if (filter === 'free') list = list.filter((w) => !w.premium);
  if (filter === 'premium') list = list.filter((w) => w.premium && LQ.S && LQ.S.premium);
  if (filter === 'due') list = LQ.getDueWords();
  if (filter === 'weak') list = LQ.getWeakWords();
  return list;
};

LQ.wordByName = function (name) {
  if (!name) return null;
  const key = String(name).toLowerCase();
  return LQ.WORDS.find((w) => w.word.toLowerCase() === key) || null;
};

LQ.resolveWord = function (name, meta) {
  const found = LQ.wordByName(name);
  if (found) return found;
  const label = meta && meta.groupTitle ? meta.groupTitle : 'vocabulary';
  return {
    word: name,
    phonetic: '',
    pos: 'word',
    def: 'Word from group: ' + (LQ.formatGroupTitle ? LQ.formatGroupTitle(label) : label) + '.',
    example: 'The passage used <em>' + name.toLowerCase() + '</em> in a way that clarified its meaning.',
    syn: '',
    ant: '',
    tags: ['GRE', 'GMAT', 'IELTS'],
    premium: false,
    stub: true,
  };
};

/** Turn raw PDF group codes like SIGN(WARNING)(-) into readable labels */
LQ.formatGroupTitle = function (title) {
  if (!title) return '';
  var t = String(title).trim();
  var pole = '';
  if (/\(\+\)$/.test(t)) {
    pole = '+';
    t = t.replace(/\(\+\)$/, '').trim();
  } else if (/\(-\)$/.test(t)) {
    pole = '−';
    t = t.replace(/\(-\)$/, '').trim();
  }
  t = t.replace(/\(([^)]+)\)/g, ' · $1').replace(/\//g, ' / ');
  t = t.replace(/^\s*·\s*/, '').replace(/\s+/g, ' ').trim();
  t = t
    .split(' · ')
    .map(function (part) {
      part = part.trim();
      if (!part) return '';
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .filter(Boolean)
    .join(' · ');
  if (pole) t = t + ' (' + pole + ')';
  return t;
};

/** User-facing definition — hides raw PDF stub text when possible */
LQ.displayWordDef = function (w) {
  if (!w || !w.def) return '';
  if (!/^Vocabulary word from List/i.test(w.def)) return w.def;
  if (w.groupTitle && LQ.formatGroupTitle) {
    return 'A vocabulary word from the "' + LQ.formatGroupTitle(w.groupTitle) + '" synonym group.';
  }
  return w.def;
};

LQ.findGroup = function (lessonId) {
  if (!LQ.WORD_LISTS || !LQ.WORD_LISTS.lists) return null;
  for (var i = 0; i < LQ.WORD_LISTS.lists.length; i++) {
    var lst = LQ.WORD_LISTS.lists[i];
    if (LQ.getListType(lst) === 'dictionary') continue;
    for (var j = 0; j < (lst.groups || []).length; j++) {
      if (lst.groups[j].id === lessonId) {
        return { list: lst, group: lst.groups[j] };
      }
    }
  }
  return null;
};

LQ.getListType = function (listOrId) {
  var lst =
    typeof listOrId === 'string'
      ? (LQ.WORD_LISTS && LQ.WORD_LISTS.lists
          ? LQ.WORD_LISTS.lists.find(function (l) {
              return l.id === listOrId;
            })
          : null)
      : listOrId;
  if (!lst) return 'grouped';
  return lst.listType === 'dictionary' ? 'dictionary' : 'grouped';
};

LQ.isDictionaryList = function (listId) {
  return LQ.getListType(listId) === 'dictionary';
};

LQ.ensurePathData = function () {
  if (!LQ.WORD_LISTS || !LQ.WORD_LISTS.lists || !LQ.WORD_LISTS.lists.length) return false;
  if (LQ._pathDataReady) return true;
  LQ.CHAPTERS = LQ.WORD_LISTS.lists.map(function (lst) {
    var listType = LQ.getListType(lst);
    var wordCount = 0;
    if (listType === 'dictionary') {
      wordCount = (lst.words || []).length;
      return {
        id: lst.id,
        title: lst.title,
        icon: lst.icon || '📖',
        subtitle: wordCount + ' words · general vocabulary',
        listNum: lst.listNum,
        color: lst.color || 'sky',
        listType: 'dictionary',
        wordCount: wordCount,
      };
    }
    (lst.groups || []).forEach(function (g) {
      wordCount += g.words.length;
    });
    return {
      id: lst.id,
      title: lst.title,
      icon: lst.icon || '📘',
      subtitle: (lst.groups || []).length + ' GRE groups · ' + wordCount + ' words',
      listNum: lst.listNum,
      color: lst.color || 'lavender',
      listType: 'grouped',
      wordCount: wordCount,
    };
  });
  LQ._pathDataReady = true;
  return true;
};
