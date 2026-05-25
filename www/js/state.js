window.LQ = window.LQ || {};

LQ.defaultState = function () {
  const mastery = {};
  const srs = {};
  return {
    xp: 0,
    xpMax: 500,
    level: 1,
    mastery,
    srs,
    history: [],
    fcIdx: 0,
    fcQueue: [],
    quizIdx: 0,
    quizAnswered: false,
    quizWord: null,
    quizOpts: [],
    quizLives: 3,
    goalSeen: 0,
    goalQuiz: 0,
    goalNew: 0,
    goalTarget: LQ.Config.dailyGoalDefault,
    notifOn: true,
    notifHour: 9,
    spellIdx: 0,
    spellGuess: [],
    spellAnswered: false,
    dailyWordIdx: 0,
    onboardingComplete: false,
    examFocus: 'GRE',
    dailyMinutes: 15,
    placementLevel: 'intermediate',
    premium: false,
    streakCount: 0,
    lastStudyDate: null,
    streakWeek: [],
    leagueWeek: null,
    leagueXp: 0,
    displayName: 'You',
    mockHistory: [],
    achievements: [],
    uid: null,
    lessonProgress: {},
    commitmentDays: 14,
    commitmentStart: null,
    tutorHistory: [],
    /** Browser only: auto | phone | web */
    browserLayout: 'auto',
    quizStats: { correct: 0, total: 0 },
    lastQuizMisses: [],
    /** Custom list names + display order (list ids) */
    listPrefs: { names: {}, order: null },
    /** Learn filter: 'all' or list id e.g. list-1 */
    learnListId: 'all',
    examDate: '',
  };
};

LQ.loadState = function () {
  try {
    const key = LQ.Config.stateKey;
    let raw = localStorage.getItem(key);
    if (!raw) {
      const old = localStorage.getItem('lexiquest_v1');
      if (old) {
        raw = old;
        const migrated = JSON.parse(old);
        const S = LQ.defaultState();
        Object.assign(S, migrated);
        S.onboardingComplete = true;
        LQ.saveState(S);
        return S;
      }
    }
    if (!raw) return LQ.defaultState();
    const saved = JSON.parse(raw);
    const S = LQ.defaultState();
    Object.assign(S, saved);
    LQ.WORDS.forEach((w) => {
      if (!S.mastery[w.word]) S.mastery[w.word] = 'new';
      if (!S.srs[w.word]) S.srs[w.word] = LQ.initSrsEntry();
    });
    return S;
  } catch (e) {
    return LQ.defaultState();
  }
};

LQ.saveState = function (S) {
  try {
    const s = S || LQ.S;
    localStorage.setItem(
      LQ.Config.stateKey,
      JSON.stringify({
        xp: s.xp,
        xpMax: s.xpMax,
        level: s.level,
        mastery: s.mastery,
        srs: s.srs,
        history: s.history,
        fcIdx: s.fcIdx,
        goalSeen: s.goalSeen,
        goalQuiz: s.goalQuiz,
        goalNew: s.goalNew,
        goalTarget: s.goalTarget,
        notifOn: s.notifOn,
        notifHour: s.notifHour,
        spellIdx: s.spellIdx,
        dailyWordIdx: s.dailyWordIdx,
        onboardingComplete: s.onboardingComplete,
        examFocus: s.examFocus,
        dailyMinutes: s.dailyMinutes,
        placementLevel: s.placementLevel,
        premium: s.premium,
        streakCount: s.streakCount,
        lastStudyDate: s.lastStudyDate,
        streakWeek: s.streakWeek,
        leagueWeek: s.leagueWeek,
        leagueXp: s.leagueXp,
        displayName: s.displayName,
        mockHistory: s.mockHistory,
        achievements: s.achievements,
        uid: s.uid,
        srs: s.srs,
        onboardingComplete: s.onboardingComplete,
        examFocus: s.examFocus,
        goalTarget: s.goalTarget,
        dailyMinutes: s.dailyMinutes,
        placementLevel: s.placementLevel,
        streakCount: s.streakCount,
        lastStudyDate: s.lastStudyDate,
        streakWeek: s.streakWeek,
        leagueWeek: s.leagueWeek,
        leagueXp: s.leagueXp,
        leagueBoard: s.leagueBoard,
        displayName: s.displayName,
        mockHistory: s.mockHistory,
        activityByDay: s.activityByDay,
        lessonProgress: s.lessonProgress,
        commitmentDays: s.commitmentDays,
        commitmentStart: s.commitmentStart,
        tutorHistory: s.tutorHistory || [],
        browserLayout: s.browserLayout || 'auto',
        quizStats: s.quizStats || { correct: 0, total: 0 },
        lastQuizMisses: s.lastQuizMisses || [],
        listPrefs: s.listPrefs || { names: {}, order: null },
        learnListId: s.learnListId || 'all',
        examDate: s.examDate || '',
      })
    );
    if (LQ.Firebase && LQ.Firebase.sync) LQ.Firebase.sync();
  } catch (e) {}
};
