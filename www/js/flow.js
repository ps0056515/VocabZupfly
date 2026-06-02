window.LQ = window.LQ || {};

/** Screen hierarchy for breadcrumbs & smart back navigation */
LQ.SCREEN_META = {
  home: { title: 'Dashboard', parent: null, nav: 'home', hint: 'Your home base — see progress and pick what to do next.' },
  vocab: { title: 'Vocabulary', parent: 'home', nav: 'vocab', hint: 'Learn new words, revise flagged ones, then test yourself.' },
  lists: { title: 'Word Lists', parent: 'home', nav: 'lists', hint: 'GRE synonym groups and dictionary word banks — pick a list, then study by group or A–Z.' },
  tenses: { title: 'Tenses', parent: 'home', nav: 'tenses', hint: 'Speaking, grammar, and writing practice modules.' },
  'tenses-practice': { title: 'Practice', parent: 'tenses', nav: 'tenses', hint: '' },
  learn: { title: 'Learn', parent: 'vocab', nav: 'vocab', hint: 'Mark words you know or flag them to revise later.' },
  revise: { title: 'Revise', parent: 'vocab', nav: 'vocab', hint: 'Review flagged words until they stick.' },
  lesson: { title: 'Lesson', parent: 'lists', nav: 'lists', hint: '' },
  quiz: { title: 'Quiz', parent: 'vocab', nav: 'vocab', hint: 'Pick a word list or synonym group, then test yourself.' },
  flashcard: { title: 'Flashcards', parent: 'vocab', nav: 'vocab', hint: 'Tap to flip, then rate how well you remembered each word.' },
  spelling: { title: 'Spelling', parent: 'vocab', nav: 'vocab', hint: 'Hear the definition, spell the word.' },
  wordbank: { title: 'Word Bank', parent: 'vocab', nav: 'vocab', hint: 'Search and browse every word in the deck.' },
  drill: { title: 'Weak Drill', parent: 'vocab', nav: 'vocab', hint: 'Extra practice on words you miss most often.' },
  mock: { title: 'Mock Test', parent: 'home', nav: 'more', hint: 'Timed exam-style practice.' },
  tutor: { title: 'AI Tutor', parent: 'home', nav: 'more', hint: 'Ask questions about words and grammar.' },
  leagues: { title: 'Rookie League', parent: 'home', nav: 'more', hint: 'See how you rank this week.' },
  speak: { title: 'Speak', parent: 'vocab', nav: 'vocab', hint: 'Say the word aloud for pronunciation practice.' },
  settings: { title: 'Settings', parent: 'home', nav: 'more', hint: 'Exam focus, daily goals, and preferences.' },
  progress: { title: 'Progress', parent: 'home', nav: 'home', hint: '' },
  onboarding: { title: 'Welcome', parent: null, nav: 'home', hint: '' },
};

LQ._navStack = [];
LQ._currentScreen = 'home';

LQ.getScreenMeta = function (screen) {
  return LQ.SCREEN_META[screen] || { title: screen, parent: 'home', nav: 'home', hint: '' };
};

LQ.getScreenParent = function (screen) {
  const m = LQ.getScreenMeta(screen);
  return m.parent || 'home';
};

LQ.getGreeting = function () {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};

LQ.getEncouragement = function () {
  const streak = LQ.S.streakCount || 0;
  const pct = LQ.getDailyGoalPct ? LQ.getDailyGoalPct() : 0;
  if (pct >= 100) return "You hit today's goal — amazing work!";
  if (streak >= 7) return streak + '-day streak! Keep the momentum going.';
  if (streak >= 3) return 'Nice streak — a short session keeps it alive.';
  const counts = LQ.getWordCounts ? LQ.getWordCounts() : null;
  if (counts && counts.unmarked > 0) return counts.unmarked + ' words waiting — start with a quick Learn session.';
  return 'Pick a module below — small steps add up fast.';
};

LQ.canSessionBack = function () {
  if (LQ._currentScreen === 'learn' && LQ._learnIdx > 0) return true;
  if (LQ._currentScreen === 'revise' && LQ._reviseIdx > 0) return true;
  return false;
};

LQ.sessionBack = function () {
  if (LQ._currentScreen === 'learn' && LQ.learnPrev && LQ.learnPrev()) return true;
  if (LQ._currentScreen === 'revise' && LQ.revisePrev && LQ.revisePrev()) return true;
  return false;
};

LQ.refreshFlowBackBtn = function () {
  const btn = document.querySelector('#screen-' + LQ._currentScreen + ' .flow-back-btn');
  if (!btn) return;
  btn.textContent = LQ.canSessionBack() ? '← Previous word' : '← Back';
};

LQ.goBack = function () {
  if (LQ.sessionBack && LQ.sessionBack()) return;

  if (LQ._navStack.length) {
    const prev = LQ._navStack.pop();
    LQ.goTo(prev, { noPush: true });
    return;
  }
  LQ.goTo(LQ.getScreenParent(LQ._currentScreen), { noPush: true });
};
window.LQ.goBack = LQ.goBack;

/** Primary nav — always open a fresh dashboard (not session back / nav stack) */
LQ.goHome = function () {
  LQ.goTo('home', { resetStack: true });
};
window.goHome = LQ.goHome;

LQ.updateFlowChrome = function (screen) {
  const meta = LQ.getScreenMeta(screen);
  const trail = LQ.buildBreadcrumbTrail(screen);

  document.querySelectorAll('.portal-breadcrumb').forEach(function (el) {
    el.innerHTML = trail;
  });

  const tagline = document.getElementById('dash-tagline');
  if (tagline && screen === 'home') tagline.textContent = LQ.getEncouragement();

  const greeting = document.getElementById('dash-greeting');
  if (greeting && screen === 'home') {
    greeting.textContent = LQ.getGreeting() + (LQ.S.displayName && LQ.S.displayName !== 'You' ? ', ' + LQ.S.displayName : '') + ' 👋';
  }

  LQ.renderFlowSubnav(screen, meta);
};

LQ.buildBreadcrumbTrail = function (screen) {
  const parts = [];
  let cur = screen;
  const chain = [];
  while (cur) {
    chain.unshift(cur);
    cur = LQ.getScreenMeta(cur).parent;
  }
  chain.forEach(function (id, i) {
    const m = LQ.getScreenMeta(id);
    if (i === 0 && id === 'home') {
      parts.push('<a href="#" onclick="event.preventDefault();LQ.goHome()">Dashboard</a>');
    } else if (i < chain.length - 1) {
      parts.push('<a href="#" onclick="event.preventDefault();goTo(\'' + id + '\')">' + LQ.esc(m.title) + '</a>');
    } else {
      parts.push('<strong>' + LQ.esc(m.title) + '</strong>');
    }
    if (i < chain.length - 1) parts.push(' › ');
  });
  return parts.join('');
};

LQ.renderFlowSubnav = function (screen, meta) {
  document.querySelectorAll('.flow-subnav').forEach(function (el) {
    el.remove();
  });
  if (!meta.parent) return;
  /* Quiz & mock have their own header — avoid duplicate back bar */
  if (screen === 'quiz' || screen === 'mock') return;

  const sc = document.getElementById('screen-' + screen);
  if (!sc) return;

  /* Pages with portal headers already show breadcrumbs in the header */
  if (sc.querySelector('.portal-breadcrumb')) return;

  const backLabel = LQ.canSessionBack && LQ.canSessionBack() ? '← Previous word' : '← Back';
  const bar = document.createElement('div');
  bar.className = 'flow-subnav';
  bar.innerHTML =
    '<button type="button" class="flow-back-btn" onclick="LQ.goBack()">' + backLabel + '</button>' +
    '<nav class="flow-subnav-crumb" aria-label="Breadcrumb">' +
    LQ.buildBreadcrumbTrail(screen) +
    '</nav>' +
    (meta.hint ? '<p class="flow-subnav-hint">' + LQ.esc(meta.hint) + '</p>' : '');

  const header = sc.querySelector('.fc-header, .quiz-topbar, .portal-header, .lesson-top');
  if (header) {
    header.after(bar);
  } else {
    sc.insertBefore(bar, sc.firstChild);
  }
};

LQ.suggestNextSteps = function (context) {
  const counts = LQ.getWordCounts ? LQ.getWordCounts() : { flagged: 0, unmarked: 0 };
  const steps = [];

  if (context === 'quiz') {
    steps.push({ icon: '🔁', label: 'Another quiz', sub: 'Same list, new words', action: 'LQ.startQuizSession()' });
    if (counts.flagged > 0) {
      steps.push({ icon: '🔄', label: 'Revise flagged', sub: counts.flagged + ' words', action: "goTo('revise')" });
    }
    steps.push({ icon: '🕐', label: 'Tenses practice', sub: 'Grammar & speaking', action: "goTo('tenses')" });
  }
  if (context === 'learn') {
    if (counts.flagged > 0) {
      steps.push({ icon: '🔄', label: 'Revise flagged', sub: counts.flagged + ' words', action: "goTo('revise')" });
    }
    steps.push({ icon: '📝', label: 'Take a quiz', sub: 'Test recall', action: "goTo('quiz')" });
  }
  if (context === 'tenses') {
    steps.push({ icon: '📚', label: 'Back to Vocab', sub: 'Continue word study', action: "goTo('vocab')" });
    steps.push({ icon: '📝', label: 'Quick quiz', sub: 'Check vocabulary', action: "goTo('quiz')" });
  }
  if (context === 'drill' || context === 'spelling') {
    steps.push({ icon: '🃏', label: 'Flashcards', sub: 'Review with cards', action: "goTo('flashcard')" });
    steps.push({ icon: '🏠', label: 'Dashboard', sub: 'See your progress', action: "goTo('home')" });
  }

  if (!steps.length) {
    steps.push({ icon: '🏠', label: 'Dashboard', sub: 'See what\'s next', action: "goTo('home')" });
    steps.push({ icon: '📚', label: 'Vocabulary', sub: 'Learn & revise', action: "goTo('vocab')" });
  }

  return steps.slice(0, 3);
};

LQ.renderFlowComplete = function (opts) {
  opts = opts || {};
  const steps = opts.steps || LQ.suggestNextSteps(opts.context || 'home');
  return (
    '<div class="flow-complete">' +
    '<p class="flow-complete-icon">' +
    (opts.icon || '🎉') +
    '</p>' +
    '<h3 class="flow-complete-title">' +
    LQ.esc(opts.title || 'Session complete!') +
    '</h3>' +
    (opts.score ? '<p class="flow-complete-score">' + LQ.esc(opts.score) + '</p>' : '') +
    (opts.message ? '<p class="flow-complete-msg">' + LQ.esc(opts.message) + '</p>' : '') +
    '<p class="flow-complete-next-lbl">What would you like to do next?</p>' +
    '<div class="flow-next-steps">' +
    steps
      .map(function (s) {
        return (
          '<button type="button" class="flow-next-step" onclick="' +
          s.action +
          '"><span class="flow-next-icon">' +
          s.icon +
          '</span><span class="flow-next-text"><strong>' +
          LQ.esc(s.label) +
          '</strong><span>' +
          LQ.esc(s.sub) +
          '</span></span></button>'
        );
      })
      .join('') +
    '</div></div>'
  );
};

LQ.toggleMoreMenu = function () {
  const sheet = document.getElementById('flow-more-sheet');
  if (!sheet) return;
  sheet.classList.toggle('open');
  document.body.classList.toggle('flow-more-open', sheet.classList.contains('open'));
};

LQ.closeMoreMenu = function () {
  const sheet = document.getElementById('flow-more-sheet');
  if (sheet) sheet.classList.remove('open');
  document.body.classList.remove('flow-more-open');
};
