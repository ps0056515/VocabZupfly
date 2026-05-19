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

LQ.buildFcQueue = function () {
  const due = LQ.getDueWords().map((w) => w.word);
  const weak = LQ.getWeakWords()
    .map((w) => w.word)
    .filter((w) => !due.includes(w));
  const rest = LQ.getWords('free')
    .map((w) => w.word)
    .filter((w) => !due.includes(w) && !weak.includes(w));
  const prem = LQ.S.premium
    ? LQ.getWords('premium').map((w) => w.word).filter((w) => !due.includes(w))
    : [];
  LQ.S.fcQueue = [...due, ...weak, ...rest, ...prem];
  if (!LQ.S.fcQueue.length) LQ.S.fcQueue = LQ.getWords().map((w) => w.word);
  if (LQ.S.fcIdx >= LQ.S.fcQueue.length) LQ.S.fcIdx = 0;
};

LQ.currentFcWord = function () {
  LQ.buildFcQueue();
  const name = LQ.S.fcQueue[LQ.S.fcIdx % LQ.S.fcQueue.length];
  return LQ.wordByName(name);
};
