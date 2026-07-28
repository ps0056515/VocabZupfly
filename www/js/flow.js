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
  assessment: { title: 'Assessment', parent: 'home', nav: 'assessment', hint: 'Custom practice evaluations and tests.' },
  'assessment-session': { title: 'Assessment Practice', parent: 'assessment', nav: 'assessment', hint: '' },
  'assessment-result': { title: 'Assessment Results', parent: 'assessment', nav: 'assessment', hint: '' },
  progress: { title: 'Progress', parent: 'home', nav: 'home', hint: '' },
  onboarding: { title: 'Welcome', parent: null, nav: 'home', hint: '' },
  'admin-profile': { title: 'My Profile', parent: 'home', nav: 'admin-profile', hint: 'Manage your account details.' },
  'change-password': { title: 'Change Password', parent: 'admin-profile', nav: 'admin-profile', hint: 'Update your account password.' },
  'admin-students': { title: 'Students', parent: 'home', nav: 'admin-students', hint: 'Manage registered candidates.' },
  'admin-admins': { title: 'Admins', parent: 'home', nav: 'admin-admins', hint: 'Manage organization administrators.' },
  'admin-orgs': { title: 'Organizations', parent: 'home', nav: 'admin-orgs', hint: 'View organization details.' },
  'admin-questions': { title: 'Questions', parent: 'home', nav: 'admin-questions', hint: 'Manage question bank, categories & evaluations.' },
  'admin-practice-questions': { title: 'Practice Questions', parent: 'home', nav: 'admin-practice-questions', hint: 'Manage practice questions.' },
  'admin-tenses': { title: 'Tenses', parent: 'home', nav: 'admin-tenses', hint: 'Manage tenses groups.' },
  'admin-words': { title: 'Words', parent: 'home', nav: 'admin-words', hint: 'Manage vocabulary words database.' },
  'admin-word-lists': { title: 'Word Lists', parent: 'home', nav: 'admin-word-lists', hint: 'Manage vocabulary lists.' },
  'admin-dictionary': { title: 'Dictionary', parent: 'home', nav: 'admin-dictionary', hint: 'Manage dictionary word lists.' },
  'admin-bulk': { title: 'Bulk Upload', parent: 'home', nav: 'admin-bulk', hint: 'Bulk upload content and students.' },
  cms: { title: 'Content CMS', parent: 'home', nav: 'cms', hint: 'Manage vocabulary words, lists, and content.' },
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
  if (LQ._currentScreen === 'revise' && LQ._reviseIdx > 0) return true;
  return false;
};

LQ.sessionBack = function () {
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
  if (screen === 'quiz' || screen === 'mock' || screen === 'learn' || screen === 'revise' || screen === 'flashcard' || screen === 'assessment-session' || screen === 'assessment-result' || screen === 'cms' || screen.startsWith('admin-') || screen === 'change-password') return;
  if (LQ.currentUser && (LQ.currentUser.role === 'admin' || LQ.currentUser.role === 'super_admin')) return;

  const sc = document.getElementById('screen-' + screen);
  if (!sc) return;

  /* Pages with portal headers already show breadcrumbs in the header */
  if (sc.querySelector('.portal-breadcrumb')) return;

  const backLabel = LQ.canSessionBack && LQ.canSessionBack() ? '← Previous word' : '← Back';
  const showBackBtn = (screen !== 'tenses-practice');
  const bar = document.createElement('div');
  bar.className = 'flow-subnav';
  bar.innerHTML =
    (showBackBtn ? '<button type="button" class="flow-back-btn" onclick="LQ.goBack()">' + backLabel + '</button>' : '') +
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

/**
 * Setup navigation rail & headers based on user role.
 */
LQ.setupRoleNavigation = function (user) {
  if (!user) return;

  var rail = document.querySelector('.desktop-rail');
  if (!rail) return;

  // Cache initial student sidebar HTML when loaded
  if (!LQ._initialStudentRailHtml && document.getElementById('desktop-nav-home')) {
    LQ._initialStudentRailHtml = rail.innerHTML;
  }

  if (user.role === 'super_admin') {
    rail.classList.add('admin-sidebar');
    // Dedicated Super Admin Sidebar (No student learning items or Settings)
    rail.innerHTML =
      '<div class="desktop-rail-brand" style="flex-shrink:0;padding-bottom:16px">VocabZupfly <span>Super Admin</span></div>' +
      '<div class="desktop-rail-menu-wrap" style="flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:2px;padding-right:4px;min-height:0">' +
        '<p class="desktop-rail-label" style="margin-top:0">Management</p>' +
        '<button type="button" class="desktop-rail-item" id="desktop-nav-admin-orgs" onclick="goTo(\'admin-orgs\')"><span class="rail-icon">🏢</span> Organizations</button>' +
        '<button type="button" class="desktop-rail-item" id="desktop-nav-admin-admins" onclick="goTo(\'admin-admins\')"><span class="rail-icon">🛡️</span> Admins</button>' +
        '<button type="button" class="desktop-rail-item" id="desktop-nav-admin-students" onclick="goTo(\'admin-students\')"><span class="rail-icon">👩‍🎓</span> Students</button>' +
        '<button type="button" class="desktop-rail-item" id="desktop-nav-admin-questions" onclick="goTo(\'admin-questions\')"><span class="rail-icon">❓</span> Questions</button>' +
        '<button type="button" class="desktop-rail-item" id="desktop-nav-cms" onclick="goTo(\'cms\')"><span class="rail-icon">⚙️</span> Content CMS</button>' +
      '</div>' +
      '<div class="desktop-rail-footer" style="flex-shrink:0;margin-top:auto;border-top:1px solid rgba(255,255,255,0.06);padding-top:8px;padding-bottom:4px">' +
        '<button type="button" class="desktop-rail-item" id="desktop-nav-admin-profile" onclick="goTo(\'admin-profile\')" style="margin-bottom:2px;padding:8px 12px;font-size:13px"><span class="rail-icon">👤</span> My Profile</button>' +
        '<button type="button" class="desktop-rail-item" onclick="LQ.Auth.logout()" style="padding:8px 12px;font-size:13px"><span class="rail-icon">🚪</span> Logout</button>' +
      '</div>';
    return;
  }

  if (user.role === 'admin') {
    rail.classList.add('admin-sidebar');
    // Dedicated Admin Sidebar
    rail.innerHTML =
      '<div class="desktop-rail-brand" style="flex-shrink:0;padding-bottom:16px">VocabZupfly <span>Admin</span></div>' +
      '<div class="desktop-rail-menu-wrap" style="flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:2px;padding-right:4px;min-height:0">' +
        '<p class="desktop-rail-label" style="margin-top:0">Management</p>' +
        '<button type="button" class="desktop-rail-item" id="desktop-nav-admin-students" onclick="goTo(\'admin-students\')"><span class="rail-icon">👩‍🎓</span> Students</button>' +
        '<button type="button" class="desktop-rail-item" id="desktop-nav-admin-questions" onclick="goTo(\'admin-questions\')"><span class="rail-icon">❓</span> Questions</button>' +
        '<button type="button" class="desktop-rail-item" id="desktop-nav-admin-practice-questions" onclick="goTo(\'admin-practice-questions\')"><span class="rail-icon">📝</span> Practice Qs</button>' +
        '<button type="button" class="desktop-rail-item" id="desktop-nav-admin-tenses" onclick="goTo(\'admin-tenses\')"><span class="rail-icon">🕒</span> Tenses</button>' +
        '<button type="button" class="desktop-rail-item" id="desktop-nav-admin-words" onclick="goTo(\'admin-words\')"><span class="rail-icon">📝</span> Words</button>' +
        '<button type="button" class="desktop-rail-item" id="desktop-nav-admin-word-lists" onclick="goTo(\'admin-word-lists\')"><span class="rail-icon">📋</span> Word Lists</button>' +
        '<button type="button" class="desktop-rail-item" id="desktop-nav-admin-dictionary" onclick="goTo(\'admin-dictionary\')"><span class="rail-icon">📖</span> Dictionary</button>' +
        '<button type="button" class="desktop-rail-item" id="desktop-nav-admin-bulk" onclick="goTo(\'admin-bulk\')"><span class="rail-icon">📤</span> Bulk Upload</button>' +
        '<button type="button" class="desktop-rail-item" id="desktop-nav-cms" onclick="goTo(\'cms\')"><span class="rail-icon">⚙️</span> Content CMS</button>' +
      '</div>' +
      '<div class="desktop-rail-footer" style="flex-shrink:0;margin-top:auto;border-top:1px solid rgba(255,255,255,0.06);padding-top:8px;padding-bottom:4px">' +
        '<button type="button" class="desktop-rail-item" id="desktop-nav-admin-profile" onclick="goTo(\'admin-profile\')" style="margin-bottom:2px;padding:8px 12px;font-size:13px"><span class="rail-icon">👤</span> My Profile</button>' +
        '<button type="button" class="desktop-rail-item" onclick="LQ.Auth.logout()" style="padding:8px 12px;font-size:13px"><span class="rail-icon">🚪</span> Logout</button>' +
      '</div>';
    return;
  }

  // Student role: build structured layout
  rail.classList.add('admin-sidebar');
  
  var nameHtml = '';
  if (user && user.name) {
    nameHtml = '<div style="font-size:11px;color:#94a3b8;padding:0 14px 12px;margin-top:-10px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">👤 ' + LQ.esc(user.name) + '</div>';
  }

  rail.innerHTML =
    '<div class="desktop-rail-brand" style="flex-shrink:0;padding-bottom:12px">Lexi<span>Quest</span></div>' +
    nameHtml +
    '<div class="desktop-rail-menu-wrap" style="flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:2px;padding-right:4px;min-height:0">' +
      '<p class="desktop-rail-label" style="margin-top:0">Overview</p>' +
      '<button type="button" class="desktop-rail-item" id="desktop-nav-home" onclick="LQ.goHome()"><span class="rail-icon">🏠</span> Dashboard</button>' +
      '<p class="desktop-rail-label">Study</p>' +
      '<button type="button" class="desktop-rail-item" id="desktop-nav-vocab" onclick="goTo(\'vocab\')"><span class="rail-icon">📚</span> Vocabulary</button>' +
      '<button type="button" class="desktop-rail-item" id="desktop-nav-tenses" onclick="goTo(\'tenses\')"><span class="rail-icon">🕐</span> Tenses</button>' +
      '<button type="button" class="desktop-rail-item" id="desktop-nav-assessment" onclick="goTo(\'assessment\')"><span class="rail-icon">🎯</span> Assessment</button>' +
      '<button type="button" class="desktop-rail-item" id="desktop-nav-lists" onclick="LQ.goToWordListsCategory(\'gre\')"><span class="rail-icon">📋</span> Word Lists (GRE)</button>' +
      '<button type="button" class="desktop-rail-item" id="desktop-nav-dictionary" onclick="LQ.goToWordListsCategory(\'dict\')"><span class="rail-icon">📖</span> Dictionary</button>' +
      '<p class="desktop-rail-label">Practice</p>' +
      '<button type="button" class="desktop-rail-item" id="desktop-nav-learn" onclick="goTo(\'learn\')"><span class="rail-icon">✏️</span> Learn</button>' +
      '<button type="button" class="desktop-rail-item" id="desktop-nav-revise" onclick="goTo(\'revise\')"><span class="rail-icon">🔄</span> Revise</button>' +
      '<button type="button" class="desktop-rail-item" id="desktop-nav-quiz" onclick="goTo(\'quiz\')"><span class="rail-icon">📝</span> Quiz</button>' +
      '<button type="button" class="desktop-rail-item" id="desktop-nav-wordbank" onclick="goTo(\'wordbank\')"><span class="rail-icon">📖</span> Word Bank</button>' +
      '<button type="button" class="desktop-rail-item" id="desktop-nav-flashcard" onclick="goTo(\'flashcard\')"><span class="rail-icon">🃏</span> Flashcards</button>' +
      '<button type="button" class="desktop-rail-item" id="desktop-nav-spelling" onclick="goTo(\'spelling\')"><span class="rail-icon">✍️</span> Spelling</button>' +
      '<button type="button" class="desktop-rail-item" id="desktop-nav-drill" onclick="goTo(\'drill\')"><span class="rail-icon">🎯</span> Weak Drill</button>' +
      '<button type="button" class="desktop-rail-item" id="desktop-nav-leagues" onclick="goTo(\'leagues\')"><span class="rail-icon">🏆</span> Rookie League</button>' +
      '<p class="desktop-rail-label">More</p>' +
      '<button type="button" class="desktop-rail-item" id="desktop-nav-tutor" onclick="goTo(\'tutor\')"><span class="rail-icon">✦</span> AI Tutor</button>' +
      '<button type="button" class="desktop-rail-item" id="desktop-nav-mock" onclick="goTo(\'mock\')"><span class="rail-icon">⏱️</span> Mock Test</button>' +
      '<button type="button" class="desktop-rail-item" id="desktop-nav-settings" onclick="goTo(\'settings\')"><span class="rail-icon">⚙️</span> Settings</button>' +
    '</div>' +
    '<div class="desktop-rail-footer" style="flex-shrink:0;margin-top:auto;border-top:1px solid rgba(255,255,255,0.06);padding-top:8px;padding-bottom:4px">' +
      '<button type="button" class="desktop-rail-item" id="desktop-nav-admin-profile" onclick="goTo(\'admin-profile\')" style="margin-bottom:2px;padding:8px 12px;font-size:13px"><span class="rail-icon">👤</span> My Profile</button>' +
      '<button type="button" class="desktop-rail-item" id="desktop-nav-logout" onclick="LQ.Auth.logout()" style="padding:8px 12px;font-size:13px"><span class="rail-icon">🚪</span> Logout</button>' +
    '</div>';

  LQ.setupProfileMenu(user);
};

/**
 * Setup profile menu trigger in headers.
 */
LQ.setupProfileMenu = function (user) {
  var avatars = document.querySelectorAll('.avatar, .portal-avatar, .user-profile-icon-btn, [title="Profile"]');
  avatars.forEach(function (av) {
    av.style.cursor = 'pointer';
    av.title = user ? user.name + ' (' + user.role + ')' : 'Account & Profile';
    av.onclick = function (e) {
      e.stopPropagation();
      LQ.toggleProfileDropdown(av);
    };
  });
};

/**
 * Toggle profile dropdown menu.
 */
LQ.toggleProfileDropdown = function (anchorEl) {
  var dropdown = document.getElementById('global-profile-dropdown');
  if (!dropdown) {
    dropdown = document.createElement('div');
    dropdown.id = 'global-profile-dropdown';
    dropdown.className = 'profile-menu-dropdown';
    document.body.appendChild(dropdown);

    // Close on click outside
    document.addEventListener('click', function () {
      dropdown.classList.remove('open');
    });
  }

  var state = LQ.Store.getState();
  var user = state.user || {};
  var roleName = user.role === 'super_admin' ? 'Super Admin' : user.role === 'admin' ? 'Admin' : 'Student';

  dropdown.innerHTML =
    '<div style="padding:12px 16px;border-bottom:1px solid #e2e8f0">' +
      '<div style="font-weight:700;font-size:14px;color:#0f172a">' + LQ.esc(user.name) + '</div>' +
      '<div style="font-size:11px;color:#64748b">' + LQ.esc(user.email) + ' • <strong>' + roleName + '</strong></div>' +
    '</div>' +
    '<button type="button" class="profile-menu-item" onclick="goTo(\'admin-profile\')">👤 My Profile</button>' +
    '<button type="button" class="profile-menu-item" onclick="goTo(\'change-password\')">🔑 Change Password</button>' +
    (user.role !== 'student' ? '<button type="button" class="profile-menu-item" onclick="goTo(\'admin-students\')">👩‍🎓 Student Management</button>' : '') +
    '<div class="profile-menu-divider"></div>' +
    '<button type="button" class="profile-menu-item danger" onclick="LQ.Auth.logout()">🚪 Sign Out</button>';

  // Position dropdown near anchor element
  var rect = anchorEl.getBoundingClientRect();
  dropdown.style.position = 'fixed';
  dropdown.style.top = (rect.bottom + 8) + 'px';
  dropdown.style.left = Math.max(10, Math.min(rect.left, window.innerWidth - 220)) + 'px';
  dropdown.classList.toggle('open');
};

