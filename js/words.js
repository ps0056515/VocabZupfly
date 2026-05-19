window.LQ = window.LQ || {};
LQ.WORDS = [];
LQ.wordsReady = fetch('data/words.json')
  .then(function (r) {
    if (!r.ok) throw new Error('words.json ' + r.status);
    return r.json();
  })
  .then(function (data) {
    LQ.WORDS = Array.isArray(data) ? data : [];
    return LQ.WORDS;
  })
  .catch(function (err) {
    console.warn('words.json failed', err);
    LQ.WORDS = [];
    return [];
  });

LQ.getWords = function (filter) {
  let list = LQ.WORDS.slice();
  const exam = LQ.S && LQ.S.examFocus;
  if (exam && exam !== 'ALL') list = list.filter((w) => w.tags.includes(exam));
  if (filter === 'free') list = list.filter((w) => !w.premium);
  if (filter === 'premium') list = list.filter((w) => w.premium && LQ.S && LQ.S.premium);
  if (filter === 'due') list = LQ.getDueWords();
  if (filter === 'weak') list = LQ.getWeakWords();
  return list;
};

LQ.wordByName = function (name) {
  return LQ.WORDS.find((w) => w.word === name);
};
