window.LQ = window.LQ || {};

(function () {
  let activeTab = 'practice';
  let activeFilter = 'new';
  let activeSession = null;
  let timerInterval = null;

  function formatScoreNum(num) {
    if (num === null || num === undefined || isNaN(num)) return 0;
    return Number(Number(num).toFixed(2));
  }

  LQ.initAssessmentPage = async function () {
    LQ.switchAssessmentTab('practice');
  };

  LQ.switchAssessmentTab = function (tab) {
    activeTab = tab || 'practice';
    const btnPractice = document.getElementById('tab-btn-practice');
    const btnTest = document.getElementById('tab-btn-test');
    const viewPractice = document.getElementById('assessment-practice-view');
    const viewTest = document.getElementById('assessment-test-view');

    if (btnPractice) btnPractice.classList.toggle('active', activeTab === 'practice');
    if (btnTest) btnTest.classList.toggle('active', activeTab === 'test');
    if (viewPractice) viewPractice.classList.toggle('hidden', activeTab !== 'practice');
    if (viewTest) viewTest.classList.toggle('hidden', activeTab !== 'test');

    if (activeTab === 'practice') {
      LQ.loadPracticeAssessmentCards();
    }
  };

  LQ.loadPracticeAssessmentCards = async function () {
    const listWrap = document.getElementById('assessment-list-grid');
    if (!listWrap) return;

    const items = await LQ.AssessmentDB.getAllAssessments();
    LQ.renderAssessmentCards(items);
  };

  LQ.setAssessmentFilter = function (val) {
    activeFilter = val || 'new';
    const sel = document.getElementById('asm-status-filter');
    if (sel) sel.value = activeFilter;

    const btnNew = document.getElementById('filter-btn-new');
    const btnCompleted = document.getElementById('filter-btn-completed');
    const btnAll = document.getElementById('filter-btn-all');

    if (btnNew) btnNew.classList.toggle('active', activeFilter === 'new');
    if (btnCompleted) btnCompleted.classList.toggle('active', activeFilter === 'completed');
    if (btnAll) btnAll.classList.toggle('active', activeFilter === 'all');

    LQ.loadPracticeAssessmentCards();
  };

  LQ.renderAssessmentCards = function (list) {
    const wrap = document.getElementById('assessment-list-grid');
    const emptyState = document.getElementById('assessment-empty-state');
    if (!wrap) return;

    let practiceItems = (list || []).filter((a) => a.type !== 'test');

    if (activeFilter === 'new') {
      practiceItems = practiceItems.filter((a) => a.status !== 'completed');
    } else if (activeFilter === 'completed') {
      practiceItems = practiceItems.filter((a) => a.status === 'completed');
    }

    if (!practiceItems.length) {
      wrap.innerHTML = '';
      if (emptyState) emptyState.classList.remove('hidden');
      return;
    }

    if (emptyState) emptyState.classList.add('hidden');

    wrap.innerHTML = practiceItems
      .map((item) => {
        const isDone = item.status === 'completed';
        const dateStr = item.createdAt ? new Date(item.createdAt).toLocaleDateString() : '';
        const durTag = item.durationMinutes ? '<span>⏱️ ' + item.durationMinutes + ' mins</span>' : '';
        const pctNum = formatScoreNum(item.percentage);
        const themeClass = pctNum > 60 ? 'green' : pctNum > 30 ? 'amber' : 'coral';
        const scoreBadge = isDone
          ? '<div class="asm-score-badge ' + themeClass + '">' +
            'Score: <strong>' + pctNum + '%</strong> (' + item.correctCount + '/' + item.totalQuestions + ' Correct)' +
            '</div>'
          : '';

        const groupBadges = (item.groupNames || [])
          .slice(0, 3)
          .map((g) => '<span class="asm-group-tag">' + LQ.esc(g) + '</span>')
          .join('');

        const moreGroups = (item.groupNames || []).length > 3 ? '<span class="asm-group-tag">+' + (item.groupNames.length - 3) + ' more</span>' : '';

        return (
          '<article class="asm-card ' + (isDone ? 'done' : '') + '">' +
          '<div class="asm-card-head">' +
          '<span class="asm-type-badge">' + (isDone ? '✓ Completed' : '⚡ Practice') + '</span>' +
          '<span class="asm-date">' + dateStr + '</span>' +
          '</div>' +
          '<h3 class="asm-card-title">' + LQ.esc(item.title) + '</h3>' +
          '<div class="asm-card-meta">' +
          '<span>📋 ' + item.totalQuestions + ' Questions</span>' +
          durTag +
          '</div>' +
          '<div class="asm-groups-row">' + groupBadges + moreGroups + '</div>' +
          scoreBadge +
          '<div class="asm-card-actions">' +
          (isDone
            ? '<button type="button" class="btn btn-view-results" onclick="LQ.showAssessmentResult(\'' + item.id + '\')">📊 View Results</button>'
            : '<button type="button" class="btn primary" onclick="LQ.startAssessmentSession(\'' + item.id + '\')">▶️ Attend Practice</button>') +
          '</div>' +
          '</article>'
        );
      })
      .join('');
  };

  LQ.openCreateAssessmentModal = async function () {
    await LQ.tensesReady;
    const modal = document.getElementById('modal-create-assessment');
    const container = document.getElementById('asm-modal-groups-list');
    if (!modal || !container) return;

    const modules = LQ.TENSES_MODULES || [
      { id: 'sentence-repeating', title: 'Sentence Repeating' },
      { id: 'short-stories', title: 'Short Stories' },
      { id: 'grammar', title: 'Grammar' },
      { id: 'sentence-reading', title: 'Sentence Reading' },
      { id: 'passage-comprehension', title: 'Passage Comprehension' },
      { id: 'essay-writing', title: 'Essay Writing' },
      { id: 'jumbled-sentences', title: 'Jumbled Sentences' },
      { id: 'story-retelling', title: 'Story Retelling' },
      { id: 'just-a-minute', title: 'Just a Minute' }
    ];

    container.innerHTML = modules
      .map(
        (m) =>
          '<label class="asm-chk-item">' +
          '<input type="checkbox" name="asm_groups" value="' + m.id + '" checked>' +
          '<span>' + LQ.esc(m.title) + '</span>' +
          '</label>'
      )
      .join('');

    modal.classList.remove('hidden');
  };

  LQ.closeCreateAssessmentModal = function () {
    const modal = document.getElementById('modal-create-assessment');
    if (modal) modal.classList.add('hidden');
  };

  LQ.createPracticeAssessment = async function (e) {
    if (e) e.preventDefault();
    await LQ.tensesReady;

    const checkedInputs = document.querySelectorAll('input[name="asm_groups"]:checked');
    const selectedGroupIds = Array.from(checkedInputs).map((el) => el.value);

    if (!selectedGroupIds.length) {
      LQ.toast('Please select at least one question group');
      return;
    }

    const qCountInp = document.getElementById('asm-q-count');
    const durInp = document.getElementById('asm-duration');
    const titleInp = document.getElementById('asm-title');

    const questionCount = Math.max(1, parseInt((qCountInp && qCountInp.value) || '10', 10));
    const durationMinutes = durInp && durInp.value ? parseInt(durInp.value, 10) : null;
    const title = (titleInp && titleInp.value.trim()) || 'Custom Practice Assessment';

    // Gather questions from selected groups
    const pool = [];
    selectedGroupIds.forEach((grpId) => {
      const items = (LQ.TENSES_CONTENT && LQ.TENSES_CONTENT[grpId]) || [];
      const mod = (LQ.TENSES_MODULES || []).find((m) => m.id === grpId);
      const groupTitle = mod ? mod.title : grpId;

      items.forEach((item) => {
        pool.push({
          groupId: grpId,
          groupTitle: groupTitle,
          rawItem: item
        });
      });
    });

    if (!pool.length) {
      LQ.toast('No questions available in the selected groups');
      return;
    }

    // Shuffle and pick questionCount questions
    const shuffled = pool.sort(() => 0.5 - Math.random());
    const selectedQuestions = shuffled.slice(0, Math.min(questionCount, shuffled.length)).map((q, idx) => {
      const raw = q.rawItem;
      let text = raw.text || raw.title || raw.story || raw.passage || '';
      let options = raw.options || null;
      let answerIndex = raw.answer !== undefined ? raw.answer : null;

      // Handle nested questions in story/passage if available
      if (raw.questions && raw.questions.length) {
        const nestedQ = raw.questions[0];
        text = (raw.title ? raw.title + ': ' : '') + (nestedQ.q || text);
        options = nestedQ.options || options;
        answerIndex = nestedQ.answer !== undefined ? nestedQ.answer : answerIndex;
      }

      return {
        id: 'q_' + idx,
        groupId: q.groupId,
        groupTitle: q.groupTitle,
        text: text,
        options: options,
        correctAnswerIndex: answerIndex,
        userAnswerIndex: null,
        userTextAnswer: ''
      };
    });

    const asmId = 'asm_' + Date.now();
    const groupNames = selectedGroupIds.map((id) => {
      const m = (LQ.TENSES_MODULES || []).find((x) => x.id === id);
      return m ? m.title : id;
    });

    const newAssessment = {
      id: asmId,
      type: 'practice',
      title: title,
      groupIds: selectedGroupIds,
      groupNames: groupNames,
      totalQuestions: selectedQuestions.length,
      durationMinutes: durationMinutes,
      createdAt: Date.now(),
      status: 'not_started',
      questions: selectedQuestions,
      userAnswers: {}
    };

    await LQ.AssessmentDB.saveAssessment(newAssessment);
    LQ.closeCreateAssessmentModal();
    LQ.toast('Practice Assessment created!', true);

    // Land on main assessment page
    goTo('assessment');
    LQ.switchAssessmentTab('practice');
  };

  LQ.deleteAssessmentCard = async function (id) {
    if (confirm('Delete this practice assessment?')) {
      await LQ.AssessmentDB.deleteAssessment(id);
      LQ.toast('Assessment deleted');
      LQ.initAssessmentPage();
    }
  };

  LQ.startAssessmentSession = async function (id) {
    try {
      sessionStorage.setItem('currentAssessmentId', id);
    } catch (e) {}
    LQ.restoreAssessmentSession(id);
  };

  LQ.restoreAssessmentSession = async function (id) {
    if (!id) {
      goTo('assessment');
      return;
    }
    try {
      sessionStorage.setItem('currentAssessmentId', id);
    } catch (e) {}

    if (activeSession && activeSession.assessment && activeSession.assessment.id === id) {
      goTo('assessment-session');
      return;
    }

    const item = await LQ.AssessmentDB.getAssessment(id);
    if (!item) {
      goTo('assessment');
      return;
    }

    if (item.status === 'completed') {
      LQ.showAssessmentResult(id);
      return;
    }

    activeSession = {
      assessment: item,
      currentIndex: 0,
      userAnswers: item.userAnswers || {},
      secondsRemaining: item.durationMinutes ? item.durationMinutes * 60 : null
    };

    goTo('assessment-session');
  };

  LQ.renderAssessmentSessionScreen = function () {
    const id = sessionStorage.getItem('currentAssessmentId');
    if (activeSession && activeSession.assessment) {
      LQ.renderSessionQuestion();
      const timerEl = document.getElementById('asm-session-timer');
      if (activeSession.secondsRemaining !== null) {
        if (timerEl) timerEl.style.display = '';
        startSessionTimer();
      } else {
        if (timerEl) timerEl.style.display = 'none';
        clearInterval(timerInterval);
      }
    } else if (id) {
      LQ.restoreAssessmentSession(id);
    }
  };

  function startSessionTimer() {
    clearInterval(timerInterval);
    const timerEl = document.getElementById('asm-session-timer');

    function updateDisplay() {
      if (!activeSession || activeSession.secondsRemaining === null) return;
      if (activeSession.secondsRemaining <= 0) {
        clearInterval(timerInterval);
        LQ.toast('Time is up! Submitting assessment...', true);
        LQ.submitAssessmentSession();
        return;
      }
      const m = Math.floor(activeSession.secondsRemaining / 60);
      const s = activeSession.secondsRemaining % 60;
      if (timerEl) {
        timerEl.textContent = '⏱️ ' + m + ':' + (s < 10 ? '0' : '') + s;
      }
      activeSession.secondsRemaining--;
    }

    updateDisplay();
    timerInterval = setInterval(updateDisplay, 1000);
  }

  LQ.renderSessionQuestion = function () {
    if (!activeSession) return;
    const asm = activeSession.assessment;
    const idx = activeSession.currentIndex;
    const q = asm.questions[idx];

    const titleEl = document.getElementById('asm-session-title');
    const counterEl = document.getElementById('asm-session-counter');
    const bodyEl = document.getElementById('asm-session-body');
    const btnPrev = document.getElementById('asm-btn-prev');
    const btnNext = document.getElementById('asm-btn-next');
    const btnSubmit = document.getElementById('asm-btn-submit');

    if (titleEl) titleEl.textContent = asm.title;
    if (counterEl) counterEl.textContent = 'Question ' + (idx + 1) + ' of ' + asm.totalQuestions;

    if (btnPrev) btnPrev.style.display = idx === 0 ? 'none' : 'inline-flex';
    if (btnNext) btnNext.classList.toggle('hidden', idx === asm.totalQuestions - 1);
    if (btnSubmit) btnSubmit.classList.toggle('hidden', idx !== asm.totalQuestions - 1);

    if (!bodyEl || !q) return;

    let optionsHtml = '';
    const currentAnswer = activeSession.userAnswers[idx];

    if (q.options && q.options.length) {
      optionsHtml =
        '<div class="asm-options-list">' +
        q.options
          .map((opt, oIdx) => {
            const isSelected = currentAnswer === oIdx;
            const prefix = String.fromCharCode(65 + oIdx);
            return (
              '<button type="button" class="asm-opt-btn ' +
              (isSelected ? 'selected' : '') +
              '" onclick="LQ.selectSessionAnswer(' +
              oIdx +
              ')">' +
              '<span class="asm-opt-prefix">' +
              prefix +
              '</span>' +
              '<span>' +
              LQ.esc(opt) +
              '</span>' +
              '</button>'
            );
          })
          .join('') +
        '</div>';
    } else {
      optionsHtml =
        '<div class="asm-text-wrap">' +
        '<textarea id="asm-text-ans" class="inp" rows="3" placeholder="Type your answer or response here..." oninput="LQ.saveSessionTextAnswer(this.value)">' +
        LQ.esc(currentAnswer || '') +
        '</textarea>' +
        '<p class="muted" style="margin-top:8px;font-size:12px;">Speak or type your practice answer above to evaluate.</p>' +
        '</div>';
    }

    bodyEl.innerHTML =
      '<div class="asm-q-card">' +
      '<div class="asm-q-head">' +
      '<span class="asm-q-group-badge">' + LQ.esc(q.groupTitle) + '</span>' +
      '</div>' +
      '<p class="asm-q-text">' + LQ.esc(q.text) + '</p>' +
      optionsHtml +
      '</div>';
  };

  LQ.selectSessionAnswer = function (optIdx) {
    if (!activeSession) return;
    activeSession.userAnswers[activeSession.currentIndex] = optIdx;
    LQ.renderSessionQuestion();
  };

  LQ.saveSessionTextAnswer = function (val) {
    if (!activeSession) return;
    activeSession.userAnswers[activeSession.currentIndex] = val;
  };

  LQ.prevSessionQuestion = function () {
    if (activeSession && activeSession.currentIndex > 0) {
      activeSession.currentIndex--;
      LQ.renderSessionQuestion();
    }
  };

  LQ.nextSessionQuestion = function () {
    if (activeSession && activeSession.currentIndex < activeSession.assessment.totalQuestions - 1) {
      activeSession.currentIndex++;
      LQ.renderSessionQuestion();
    }
  };

  LQ.submitAssessmentSession = async function () {
    if (!activeSession) return;
    clearInterval(timerInterval);

    const asm = activeSession.assessment;
    let correctCount = 0;
    let wrongCount = 0;
    const groupStats = {};

    asm.questions.forEach((q, idx) => {
      const userAns = activeSession.userAnswers[idx];
      let isCorrect = false;

      if (!groupStats[q.groupId]) {
        groupStats[q.groupId] = {
          groupId: q.groupId,
          groupTitle: q.groupTitle,
          total: 0,
          correct: 0,
          wrong: 0
        };
      }

      groupStats[q.groupId].total++;

      if (q.options && q.options.length && q.correctAnswerIndex !== null) {
        isCorrect = userAns === q.correctAnswerIndex;
      } else {
        // Text answer is correct if non-empty
        isCorrect = typeof userAns === 'string' && userAns.trim().length >= 3;
      }

      q.userAnswer = userAns;
      q.isCorrect = isCorrect;

      if (isCorrect) {
        correctCount++;
        groupStats[q.groupId].correct++;
      } else {
        wrongCount++;
        groupStats[q.groupId].wrong++;
      }
    });

    // Compute accuracy percentages for groups
    Object.keys(groupStats).forEach((gId) => {
      const g = groupStats[gId];
      g.percentage = g.total > 0 ? formatScoreNum((g.correct / g.total) * 100) : 0;
    });

    const percentage = asm.totalQuestions > 0 ? formatScoreNum((correctCount / asm.totalQuestions) * 100) : 0;

    asm.status = 'completed';
    asm.userAnswers = activeSession.userAnswers;
    asm.correctCount = correctCount;
    asm.wrongCount = wrongCount;
    asm.percentage = percentage;
    asm.groupStats = groupStats;
    asm.completedAt = Date.now();

    await LQ.AssessmentDB.saveAssessment(asm);
    LQ.toast('Assessment submitted & evaluated!', true);

    const asmId = asm.id;
    activeSession = null;
    LQ.showAssessmentResult(asmId);
  };

  LQ.showAssessmentResult = function (id) {
    if (!id) return;
    try {
      sessionStorage.setItem('currentAssessmentId', id);
    } catch (e) {}
    goTo('assessment-result');
  };

  LQ.renderAssessmentResultScreen = async function () {
    const id = sessionStorage.getItem('currentAssessmentId');
    if (!id) return;

    const asm = await LQ.AssessmentDB.getAssessment(id);
    if (!asm) {
      LQ.toast('Assessment results not found');
      return;
    }

    const titleEl = document.getElementById('asm-res-title');
    const scorePctEl = document.getElementById('asm-res-pct');
    const scoreCountsEl = document.getElementById('asm-res-counts');
    const groupStatsEl = document.getElementById('asm-res-group-stats');
    const questionsListEl = document.getElementById('asm-res-q-list');

    const pctNum = formatScoreNum(asm.percentage);
    if (titleEl) titleEl.textContent = asm.title + ' — Results';
    if (scorePctEl) {
      scorePctEl.textContent = pctNum + '%';
      scorePctEl.className = 'asm-res-pct-circle ' + (pctNum > 60 ? 'circle-green' : pctNum > 30 ? 'circle-amber' : 'circle-coral');
    }
    if (scoreCountsEl) {
      const createdDateStr = asm.createdAt ? new Date(asm.createdAt).toLocaleDateString() : '';
      const submittedDateStr = asm.completedAt ? new Date(asm.completedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'Completed';
      scoreCountsEl.innerHTML =
        '<div class="asm-res-stats-wrap">' +
        '<div class="asm-res-stat-chips">' +
        '<span class="asm-stat-chip chip-correct">✓ ' + asm.correctCount + ' Correct</span>' +
        '<span class="asm-stat-chip chip-wrong">✕ ' + asm.wrongCount + ' Wrong</span>' +
        '<span class="asm-stat-chip chip-total">❓ ' + asm.totalQuestions + ' Total</span>' +
        '</div>' +
        '<div class="asm-res-timestamps">' +
        '<span>📅 Created: ' + createdDateStr + '</span>' +
        (asm.completedAt ? '<span>🕒 Submitted: ' + submittedDateStr + '</span>' : '') +
        '</div>' +
        '</div>';
    }

    // Render Group Performance Breakdown
    if (groupStatsEl && asm.groupStats) {
      const groups = Object.values(asm.groupStats);
      groupStatsEl.innerHTML =
        '<h3>📊 Performance by Tenses Group</h3>' +
        groups
          .map((g) => {
            const color = g.percentage > 60 ? '#22c55e' : g.percentage > 30 ? '#f59e0b' : '#ef4444';
            return (
              '<div class="asm-grp-stat-item">' +
              '<div class="asm-grp-stat-head">' +
              '<strong>' + LQ.esc(g.groupTitle) + '</strong>' +
              '<span>' + g.correct + '/' + g.total + ' (' + g.percentage + '%)</span>' +
              '</div>' +
              '<div class="asm-grp-stat-bar"><div class="asm-grp-stat-fill" style="width:' + g.percentage + '%;background:' + color + '"></div></div>' +
              '</div>'
            );
          })
          .join('');
    }

    // Render Question-by-Question Review
    if (questionsListEl && asm.questions) {
      questionsListEl.innerHTML =
        '<h3>📝 Detailed Question Evaluation</h3>' +
        asm.questions
          .map((q, i) => {
            const isOk = q.isCorrect;
            let ansStr = '';
            if (q.options && q.options.length) {
              const userOpt = q.userAnswer !== undefined && q.userAnswer !== null ? q.options[q.userAnswer] : 'Not answered';
              const correctOpt = q.correctAnswerIndex !== null ? q.options[q.correctAnswerIndex] : '—';
              ansStr =
                '<p class="asm-res-ans"><strong>Your choice:</strong> ' + LQ.esc(userOpt) + '</p>' +
                (!isOk ? '<p class="asm-res-ans correct"><strong>Correct choice:</strong> ' + LQ.esc(correctOpt) + '</p>' : '');
            } else {
              ansStr = '<p class="asm-res-ans"><strong>Your answer:</strong> ' + LQ.esc(q.userAnswer || '(Empty)') + '</p>';
            }

            return (
              '<div class="asm-res-q-item ' + (isOk ? 'ok' : 'wrong') + '">' +
              '<div class="asm-res-q-head">' +
              '<span class="asm-res-q-num">Q' + (i + 1) + ' · ' + LQ.esc(q.groupTitle) + '</span>' +
              '<span class="asm-res-q-badge ' + (isOk ? 'ok' : 'wrong') + '">' + (isOk ? '✓ Correct' : '✕ Incorrect') + '</span>' +
              '</div>' +
              '<p class="asm-res-q-text">' + LQ.esc(q.text) + '</p>' +
              ansStr +
              '</div>'
            );
          })
          .join('');
    }
  };

  document.addEventListener('DOMContentLoaded', function () {
    setTimeout(function () {
      const currentScreen = sessionStorage.getItem('currentScreen');
      const currentId = sessionStorage.getItem('currentAssessmentId');

      if (currentScreen === 'assessment-session' && currentId) {
        LQ.restoreAssessmentSession(currentId);
      } else if (currentScreen === 'assessment-result' && currentId) {
        LQ.showAssessmentResult(currentId);
      } else {
        const sc = document.getElementById('screen-assessment');
        if (sc && sc.classList.contains('active')) {
          LQ.switchAssessmentTab('practice');
        }
      }
    }, 150);
  });
})();
