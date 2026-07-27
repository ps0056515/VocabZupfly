window.LQ = window.LQ || {};

(function () {
  let questions = [];
  let currentSessionQuestions = [];
  let currentIdx = 0;
  let score = 0;
  let hasAnswered = false;
  let sessionAnswers = [];

  let selectedListId = null;
  let selectedGroupIds = [];

  LQ.initPracticeQuestions = async function () {
    try {
      const v = LQ.Config && LQ.Config.contentVersion ? `?v=${encodeURIComponent(LQ.Config.contentVersion)}` : '';
      const r = await fetch('data/practice-questions.json' + v);
      if (r.ok) {
        questions = await r.json();
      } else {
        questions = [];
      }
    } catch (e) {
      console.warn('Failed to fetch practice-questions.json, using empty fallback', e);
      questions = [];
    }

    const listTrigger = document.getElementById('pq-list-dropdown-trigger');
    const listMenu = document.getElementById('pq-list-dropdown-menu');
    if (listTrigger && listMenu) {
      listTrigger.onclick = function (e) {
        e.stopPropagation();
        const isShown = listMenu.style.display === 'block';
        closeAllDropdowns();
        if (!isShown) listMenu.style.display = 'block';
      };
    }

    const groupTrigger = document.getElementById('pq-group-dropdown-trigger');
    const groupMenu = document.getElementById('pq-group-dropdown-menu');
    if (groupTrigger && groupMenu) {
      groupTrigger.onclick = function (e) {
        e.stopPropagation();
        const isShown = groupMenu.style.display === 'block';
        closeAllDropdowns();
        if (!isShown) groupMenu.style.display = 'block';
      };
    }

    document.addEventListener('click', closeAllDropdowns);

    const lists = (LQ.WORD_LISTS && LQ.WORD_LISTS.lists) ? LQ.WORD_LISTS.lists : [];
    if (listMenu && lists.length > 0) {
      listMenu.innerHTML = lists.map(l => `
        <div class="pq-dropdown-item" onclick="LQ.selectPracticeListOption('${l.id}', '${l.title.replace(/'/g, "\\'")}')" style="padding: 10px 12px; font-size: 13px; cursor: pointer; border-radius: 4px; color: var(--ink); font-weight: 500; transition: background 0.1s;">
          ${l.title}
        </div>
      `).join('');
      
      LQ.selectPracticeListOption(lists[0].id, lists[0].title);
    }

    LQ.resetPracticeQuestionsView();
    LQ.loadPracticeHistory();
  };

  function closeAllDropdowns() {
    const listMenu = document.getElementById('pq-list-dropdown-menu');
    const groupMenu = document.getElementById('pq-group-dropdown-menu');
    if (listMenu) listMenu.style.display = 'none';
    if (groupMenu) groupMenu.style.display = 'none';
  }

  LQ.selectPracticeListOption = function (listId, listTitle) {
    selectedListId = listId;
    const labelEl = document.getElementById('pq-list-dropdown-label');
    if (labelEl) labelEl.textContent = listTitle;
    
    const listMenu = document.getElementById('pq-list-dropdown-menu');
    if (listMenu) {
      listMenu.querySelectorAll('.pq-dropdown-item').forEach(item => {
        const text = item.textContent.trim();
        item.style.backgroundColor = (text === listTitle) ? 'rgba(245,166,35,0.08)' : 'transparent';
      });
    }
    
    populateUserGroups();
  };

  function populateUserGroups() {
    const groupMenu = document.getElementById('pq-group-dropdown-menu');
    if (!groupMenu || !selectedListId) return;

    const lists = (LQ.WORD_LISTS && LQ.WORD_LISTS.lists) ? LQ.WORD_LISTS.lists : [];
    const lst = lists.find(l => l.id === selectedListId);
    const groups = lst ? (lst.groups || []) : [];

    selectedGroupIds = [];

    if (!groups.length) {
      groupMenu.innerHTML = '<div style="padding: 12px; font-size: 13px; color: #64748b; text-align: center;">No groups in this list</div>';
      updateGroupTriggerLabel();
      return;
    }

    const selectAllHtml = `
      <div class="pq-dropdown-item" onclick="LQ.togglePracticeGroupSelectAll(event)" style="padding: 10px 12px; font-size: 13px; cursor: pointer; border-radius: 4px; color: var(--ink); font-weight: 700; transition: background 0.1s; display: flex; align-items: center; gap: 8px;">
        <input type="checkbox" id="pq-group-select-all-chk" style="cursor: pointer;" onclick="event.stopPropagation(); LQ.togglePracticeGroupSelectAll(event)">
        <span>Select All</span>
      </div>
    `;

    const groupsHtml = groups.map(g => `
      <div class="pq-dropdown-item" onclick="LQ.togglePracticeGroupOption(event, '${g.id}')" style="padding: 10px 12px; font-size: 13px; cursor: pointer; border-radius: 4px; color: var(--ink); font-weight: 500; transition: background 0.1s; display: flex; align-items: center; gap: 8px;">
        <input type="checkbox" class="pq-group-chk" data-id="${g.id}" style="cursor: pointer;" onclick="event.stopPropagation(); LQ.togglePracticeGroupOption(event, '${g.id}')">
        <span>${g.title}</span>
      </div>
    `).join('');

    groupMenu.innerHTML = selectAllHtml + groupsHtml;
    
    // Default to select all groups initially
    LQ.togglePracticeGroupSelectAll(null, true);
  }

  LQ.togglePracticeGroupOption = function (event, groupId) {
    if (event) event.stopPropagation();
    
    const idx = selectedGroupIds.indexOf(groupId);
    if (idx >= 0) {
      selectedGroupIds.splice(idx, 1);
    } else {
      selectedGroupIds.push(groupId);
    }

    const chk = document.querySelector(`.pq-group-chk[data-id="${groupId}"]`);
    if (chk) chk.checked = (idx < 0);

    updateGroupSelectAllState();
    updateGroupTriggerLabel();
  };

  LQ.togglePracticeGroupSelectAll = function (event, forceAll) {
    if (event) event.stopPropagation();

    const lists = (LQ.WORD_LISTS && LQ.WORD_LISTS.lists) ? LQ.WORD_LISTS.lists : [];
    const lst = lists.find(l => l.id === selectedListId);
    const groups = lst ? (lst.groups || []) : [];

    const allChk = document.getElementById('pq-group-select-all-chk');
    const checked = forceAll || (allChk && allChk.checked);

    selectedGroupIds = [];
    if (checked) {
      groups.forEach(g => selectedGroupIds.push(g.id));
    }

    if (allChk) allChk.checked = checked;
    document.querySelectorAll('.pq-group-chk').forEach(chk => {
      chk.checked = checked;
    });

    updateGroupTriggerLabel();
  };

  function updateGroupSelectAllState() {
    const lists = (LQ.WORD_LISTS && LQ.WORD_LISTS.lists) ? LQ.WORD_LISTS.lists : [];
    const lst = lists.find(l => l.id === selectedListId);
    const groups = lst ? (lst.groups || []) : [];

    const allChk = document.getElementById('pq-group-select-all-chk');
    if (allChk) {
      allChk.checked = (groups.length > 0 && selectedGroupIds.length === groups.length);
    }
  }

  function updateGroupTriggerLabel() {
    const labelEl = document.getElementById('pq-group-dropdown-label');
    if (!labelEl) return;

    const lists = (LQ.WORD_LISTS && LQ.WORD_LISTS.lists) ? LQ.WORD_LISTS.lists : [];
    const lst = lists.find(l => l.id === selectedListId);
    const groups = lst ? (lst.groups || []) : [];

    if (selectedGroupIds.length === 0) {
      labelEl.textContent = 'Select Groups';
    } else if (selectedGroupIds.length === groups.length) {
      labelEl.textContent = 'All Groups';
    } else {
      labelEl.textContent = `${selectedGroupIds.length} Group(s) Selected`;
    }
  }

  LQ.startPracticeQuestionsSession = function () {
    const listId = selectedListId;

    if (!listId || selectedGroupIds.length === 0) {
      LQ.toast ? LQ.toast('Please select a list and at least one group.') : alert('Please select a list and at least one group.');
      return;
    }

    const qCountInput = document.getElementById('pq-question-count-input');
    const maxQs = parseInt(qCountInput ? qCountInput.value : '10', 10) || 10;

    // Filter questions belonging to selected list and any of the selected groups
    const matchingQuestions = questions.filter(q => q.listId === listId && selectedGroupIds.includes(q.groupId));

    if (!matchingQuestions.length) {
      LQ.toast ? LQ.toast('No practice questions found for the selected group(s).') : alert('No practice questions found for the selected group(s).');
      return;
    }

    // Shuffle and pick random questions up to the limit requested
    const shuffled = matchingQuestions.slice().sort(() => Math.random() - 0.5);
    currentSessionQuestions = shuffled.slice(0, Math.min(maxQs, shuffled.length));

    currentIdx = 0;
    score = 0;
    hasAnswered = false;
    sessionAnswers = [];

    document.getElementById('pq-setup-view').classList.add('hidden');
    document.getElementById('pq-results-view').classList.add('hidden');
    document.getElementById('pq-session-view').classList.remove('hidden');

    const listObj = (LQ.WORD_LISTS && LQ.WORD_LISTS.lists) ? LQ.WORD_LISTS.lists.find(l => l.id === listId) : null;
    document.getElementById('pq-session-group-title').textContent = listObj ? listObj.title : 'PRACTICE';

    renderCurrentQuestion();
  };

  function renderCurrentQuestion() {
    hasAnswered = false;
    const q = currentSessionQuestions[currentIdx];
    if (!q) return;

    // Update linear progress bar
    const fillEl = document.getElementById('pq-session-progress-fill');
    if (fillEl) {
      const pct = currentSessionQuestions.length > 0 ? (currentIdx / currentSessionQuestions.length) * 100 : 0;
      fillEl.style.width = `${pct}%`;
    }

    document.getElementById('pq-session-question-title').textContent = q.title;

    const fb = document.getElementById('pq-session-feedback');
    if (fb) {
      fb.style.display = 'none';
      fb.className = 'quiz-feedback-box';
      fb.style.backgroundColor = 'transparent';
      fb.style.borderColor = 'transparent';
    }

    const nextBtn = document.getElementById('pq-session-next-btn');
    if (nextBtn) nextBtn.classList.remove('show');

    const body = document.getElementById('pq-session-question-body');
    if (!body) return;

    if (q.type === "mcq" || q.type === "mcq_multi") {
      const opts = q.options || [];
      const isMulti = q.type === "mcq_multi";
      
      let noteHtml = isMulti 
        ? `<div style="font-size: 13px; font-weight: 600; color: #e11d48; margin-bottom: 12px;">⚠️ Note: This is a multi-select question (select all correct options).</div>`
        : "";

      let optionsHtml = opts.map((opt, i) => {
        const letter = String.fromCharCode(65 + i);
        if (isMulti) {
          return `
            <button type="button" class="opt pq-session-opt" data-selected="false" onclick="LQ.togglePracticeMcqMultiOption(this)" style="width: 100%; text-align: left; background: #fff; border: 1px solid #cbd5e1; color: var(--ink); padding: 14px 16px; border-radius: var(--r-md); font-family: var(--body); font-size: 14px; cursor: pointer; display: flex; align-items: center; gap: 12px; margin-bottom: 10px; transition: all 0.15s; outline: none; box-sizing: border-box;">
              <span class="opt-letter" style="background: #f1f5f9; padding: 4px 8px; border-radius: 4px; font-weight: 700; font-size: 12px; color: #475569;">${letter}</span>
              <span>${opt}</span>
            </button>
          `;
        } else {
          return `
            <button type="button" class="opt pq-session-opt" onclick="LQ.answerPracticeMcq(this, '${opt.replace(/'/g, "\\'")}')" style="width: 100%; text-align: left; background: #fff; border: 1px solid #cbd5e1; color: var(--ink); padding: 14px 16px; border-radius: var(--r-md); font-family: var(--body); font-size: 14px; cursor: pointer; display: flex; align-items: center; gap: 12px; margin-bottom: 10px; transition: all 0.15s; outline: none; box-sizing: border-box;">
              <span class="opt-letter" style="background: #f1f5f9; padding: 4px 8px; border-radius: 4px; font-weight: 700; font-size: 12px; color: #475569;">${letter}</span>
              <span>${opt}</span>
            </button>
          `;
        }
      }).join('');

      let submitHtml = isMulti
        ? `<button type="button" class="btn primary" onclick="LQ.submitPracticeMcqMulti()" style="width: 100%; margin-top: 12px; background: var(--lime); color: var(--ink); border: none; padding: 14px; font-weight: 700; font-size: 16px; border-radius: var(--r-md); cursor: pointer;">Submit Answer</button>`
        : "";

      body.innerHTML = noteHtml + optionsHtml + submitHtml;
    } else {
      body.innerHTML = `
        <div style="margin-top: 10px;">
          <input type="text" id="pq-session-fib-input" class="inp" style="width: 100%; padding: 14px; border-radius: var(--r-md); background: #fff; border: 1px solid #cbd5e1; color: var(--ink); font-family: var(--body); font-size: 14px; outline: none; box-sizing: border-box;" placeholder="Type your answer here..." onkeydown="if(event.key==='Enter'){LQ.submitPracticeFib()}">
          <button type="button" class="btn primary" onclick="LQ.submitPracticeFib()" style="width: 100%; margin-top: 12px; background: var(--lime); color: var(--ink); border: none; padding: 12px; font-weight: 700; border-radius: var(--r-md); cursor: pointer;">Submit Answer</button>
        </div>
      `;
    }
  }

  LQ.answerPracticeMcq = function (btnEl, selectedText) {
    if (hasAnswered) return;
    hasAnswered = true;

    const q = currentSessionQuestions[currentIdx];
    const isCorrect = (selectedText.trim().toLowerCase() === q.correctAnswer.trim().toLowerCase());

    const btns = document.querySelectorAll('.pq-session-opt');
    btns.forEach(btn => {
      btn.disabled = true;
      const optText = btn.querySelector('span:nth-child(2)').textContent;
      if (optText.trim().toLowerCase() === q.correctAnswer.trim().toLowerCase()) {
        btn.style.backgroundColor = '#d1fae5';
        btn.style.borderColor = 'var(--success)';
        btn.style.color = '#065f46';
      }
    });

    if (isCorrect) {
      score++;
      showFeedback(true, '✨ Correct! Outstanding job.');
    } else {
      btnEl.style.backgroundColor = '#fee2e2';
      btnEl.style.borderColor = 'var(--coral)';
      btnEl.style.color = '#991b1b';
      showFeedback(false, `❌ Incorrect. Correct answer: <strong>${q.correctAnswer}</strong>`);
    }

    sessionAnswers.push({
      title: q.title,
      type: q.type,
      options: q.options,
      correctAnswer: q.correctAnswer,
      userAnswer: selectedText,
      isCorrect: isCorrect
    });

    const nextBtn = document.getElementById('pq-session-next-btn');
    if (nextBtn) nextBtn.classList.add('show');
  };

  LQ.submitPracticeFib = function () {
    if (hasAnswered) return;
    const inpEl = document.getElementById('pq-session-fib-input');
    if (!inpEl) return;

    const text = inpEl.value.trim();
    if (!text) {
      LQ.toast ? LQ.toast('Please type an answer first.') : alert('Please type an answer first.');
      return;
    }

    hasAnswered = true;
    inpEl.disabled = true;

    const q = currentSessionQuestions[currentIdx];
    const isCorrect = (text.toLowerCase() === q.correctAnswer.trim().toLowerCase());

    if (isCorrect) {
      score++;
      inpEl.style.borderColor = 'var(--success)';
      inpEl.style.backgroundColor = '#d1fae5';
      inpEl.style.color = '#065f46';
      showFeedback(true, '✨ Correct! Excellent spelling.');
    } else {
      inpEl.style.borderColor = 'var(--coral)';
      inpEl.style.backgroundColor = '#fee2e2';
      inpEl.style.color = '#991b1b';
      showFeedback(false, `❌ Incorrect. Correct answer: <strong>${q.correctAnswer}</strong>`);
    }

    sessionAnswers.push({
      title: q.title,
      type: q.type,
      options: null,
      correctAnswer: q.correctAnswer,
      userAnswer: text,
      isCorrect: isCorrect
    });

    const submitBtn = document.querySelector('#pq-session-question-body button');
    if (submitBtn) submitBtn.style.display = 'none';

    const nextBtn = document.getElementById('pq-session-next-btn');
    if (nextBtn) nextBtn.classList.add('show');
  };

  function showFeedback(isCorrect, message) {
    const fb = document.getElementById('pq-session-feedback');
    if (!fb) return;
    fb.innerHTML = message;
    fb.style.display = 'block';
    fb.style.padding = '14px 18px';
    fb.style.borderRadius = '12px';
    fb.style.fontSize = '14px';
    fb.style.border = '1px solid';
    
    if (isCorrect) {
      fb.style.backgroundColor = '#d1fae5';
      fb.style.borderColor = '#34d399';
      fb.style.color = '#065f46';
    } else {
      fb.style.backgroundColor = '#fee2e2';
      fb.style.borderColor = '#fca5a5';
      fb.style.color = '#991b1b';
    }
  }

  LQ.nextPracticeQuestion = function () {
    currentIdx++;
    if (currentIdx < currentSessionQuestions.length) {
      renderCurrentQuestion();
    } else {
      showResults();
    }
  };

  async function showResults() {
    document.getElementById('pq-session-view').classList.add('hidden');
    document.getElementById('pq-results-view').classList.remove('hidden');

    const total = currentSessionQuestions.length;
    const pct = total > 0 ? Math.round((score / total) * 100) : 0;

    document.getElementById('pq-results-score').textContent = `${score} / ${total}`;
    document.getElementById('pq-results-pct').textContent = `${pct}%`;

    // Save to IndexedDB
    const attempt = {
      id: 'prac_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
      listId: selectedListId,
      listTitle: (LQ.WORD_LISTS && LQ.WORD_LISTS.lists) ? (LQ.WORD_LISTS.lists.find(l => l.id === selectedListId)?.title || 'Practice List') : 'Practice List',
      groupIds: selectedGroupIds,
      createdAt: Date.now(),
      score: score,
      totalQuestions: total,
      accuracy: pct,
      answers: sessionAnswers
    };

    if (LQ.AssessmentDB && LQ.AssessmentDB.savePracticeAttempt) {
      try {
        await LQ.AssessmentDB.savePracticeAttempt(attempt);
      } catch (e) {
        console.error('Failed to save practice attempt to IndexedDB', e);
      }
    }
  }

  LQ.resetPracticeQuestionsView = function (shouldRedirect) {
    const sessionView = document.getElementById('pq-session-view');
    const resultsView = document.getElementById('pq-results-view');
    const setupView = document.getElementById('pq-setup-view');

    if (sessionView) sessionView.classList.add('hidden');
    if (resultsView) resultsView.classList.add('hidden');
    if (setupView) setupView.classList.add('hidden');

    if (shouldRedirect && window.goTo) {
      goTo('assessment');
      if (LQ.switchAssessmentTab) LQ.switchAssessmentTab('practice');
    }
  };

  LQ.loadPracticeHistory = async function () {
    const historyList = document.getElementById('pq-history-list');
    if (!historyList) return;

    if (!LQ.AssessmentDB || !LQ.AssessmentDB.getAllPracticeAttempts) {
      historyList.innerHTML = '<div style="padding: 12px; font-size: 13px; color: #64748b; text-align: center;">Database not available</div>';
      return;
    }

    const attempts = await LQ.AssessmentDB.getAllPracticeAttempts();
    if (attempts.length === 0) {
      historyList.innerHTML = '<div style="padding: 16px; font-size: 13px; color: #64748b; text-align: center; background: #fff; border: 1px solid #e2e8f0; border-radius: var(--r-md);">No attended practices yet. Complete a session to see your progress history!</div>';
      return;
    }

    historyList.innerHTML = attempts.map(attempt => {
      const dateStr = new Date(attempt.createdAt).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short'
      });
      const color = attempt.accuracy >= 60 ? 'var(--success)' : (attempt.accuracy >= 30 ? '#f59e0b' : 'var(--coral)');
      return `
        <div class="card" onclick="LQ.showPracticeResult('${attempt.id}')" style="background: #fff; padding: 16px; border-radius: var(--r-md); border: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; cursor: pointer; transition: all 0.15s; margin-bottom: 2px; box-sizing: border-box; color: var(--ink);">
          <div>
            <div style="font-weight: 700; font-size: 14px; color: var(--ink);">${attempt.listTitle}</div>
            <div style="font-size: 11px; color: #64748b; margin-top: 4px;">${dateStr}</div>
          </div>
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="text-align: right;">
              <div style="font-weight: 700; font-size: 15px; color: ${color};">${attempt.accuracy}%</div>
              <div style="font-size: 11px; color: #64748b;">${attempt.score} / ${attempt.totalQuestions} Qs</div>
            </div>
            <span style="font-size: 12px; color: #cbd5e1;">▶</span>
          </div>
        </div>
      `;
    }).join('');
  };

  LQ.showPracticeResult = async function (attemptId) {
    if (!LQ.AssessmentDB || !LQ.AssessmentDB.getPracticeAttempt) return;

    const attempt = await LQ.AssessmentDB.getPracticeAttempt(attemptId);
    if (!attempt) {
      LQ.toast ? LQ.toast('Practice attempt results not found') : alert('Practice attempt results not found');
      return;
    }

    const titleEl = document.getElementById('pq-res-title');
    const circleEl = document.getElementById('pq-res-pct-circle');
    const summaryEl = document.getElementById('pq-res-summary-text');
    const qListEl = document.getElementById('pq-res-q-list');

    if (titleEl) titleEl.textContent = `${attempt.listTitle} — Details`;
    
    if (circleEl) {
      circleEl.textContent = `${attempt.accuracy}%`;
      const pctColor = attempt.accuracy >= 60 ? 'var(--success)' : (attempt.accuracy >= 30 ? '#f59e0b' : 'var(--coral)');
      circleEl.style.backgroundColor = pctColor;
    }

    if (summaryEl) {
      const dateStr = new Date(attempt.createdAt).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short'
      });
      summaryEl.innerHTML = `
        <div>Completed on: <strong>${dateStr}</strong></div>
        <div style="margin-top: 4px;">Score: <strong>${attempt.score} / ${attempt.totalQuestions} correct</strong></div>
      `;
    }

    if (qListEl) {
      const answers = attempt.answers || [];
      qListEl.innerHTML = answers.map((a, idx) => {
        const borderCol = a.isCorrect ? 'var(--success)' : 'var(--coral)';
        const userAnsCol = a.isCorrect ? 'var(--success)' : 'var(--coral)';
        return `
          <div class="card" style="background: #fff; padding: 16px; border-radius: var(--r-md); border: 1px solid #e2e8f0; border-left: 4px solid ${borderCol}; box-sizing: border-box; color: var(--ink);">
            <div style="font-weight: 700; font-size: 14px; color: var(--ink); margin-bottom: 8px;">Q${idx + 1}: ${a.title}</div>
            
            <div style="font-size: 13px; margin-bottom: 4px; display: flex; gap: 6px;">
               <span style="color: #64748b;">Your Answer:</span>
               <span style="font-weight: 700; color: ${userAnsCol};">${a.userAnswer}</span>
            </div>
            
            ${!a.isCorrect ? `
            <div style="font-size: 13px; display: flex; gap: 6px;">
               <span style="color: #64748b;">Correct Answer:</span>
               <span style="font-weight: 700; color: var(--success);">${a.correctAnswer}</span>
            </div>
            ` : ''}
          </div>
        `;
      }).join('');
    }

    if (window.goTo) {
      goTo('practice-result');
    }
  };

  LQ.togglePracticeMcqMultiOption = function (btnEl) {
    if (hasAnswered) return;
    const isSelected = btnEl.getAttribute('data-selected') === 'true';
    if (isSelected) {
      btnEl.setAttribute('data-selected', 'false');
      btnEl.style.borderColor = '#cbd5e1';
      btnEl.style.backgroundColor = '#fff';
    } else {
      btnEl.setAttribute('data-selected', 'true');
      btnEl.style.borderColor = '#3b82f6';
      btnEl.style.backgroundColor = '#eff6ff';
    }
  };

  LQ.submitPracticeMcqMulti = function () {
    if (hasAnswered) return;

    const q = currentSessionQuestions[currentIdx];
    const btns = document.querySelectorAll('.pq-session-opt');
    const selectedTexts = [];
    
    btns.forEach(btn => {
      if (btn.getAttribute('data-selected') === 'true') {
        const text = btn.querySelector('span:nth-child(2)').textContent.trim();
        selectedTexts.push(text);
      }
    });

    if (!selectedTexts.length) {
      LQ.toast ? LQ.toast('Please select at least one option.') : alert('Please select at least one option.');
      return;
    }

    hasAnswered = true;

    // Parse correct answers from comma-separated string
    const correctList = q.correctAnswer.split(',').map(s => s.trim().toLowerCase());
    
    let isCorrect = true;
    const userList = selectedTexts.map(s => s.toLowerCase());
    
    if (userList.length !== correctList.length) {
      isCorrect = false;
    } else {
      correctList.forEach(c => {
        if (!userList.includes(c)) {
          isCorrect = false;
        }
      });
    }

    btns.forEach(btn => {
      btn.disabled = true;
      const text = btn.querySelector('span:nth-child(2)').textContent.trim().toLowerCase();
      
      const shouldBeSelected = correctList.includes(text);
      const isSelected = userList.includes(text);

      if (shouldBeSelected) {
        btn.style.backgroundColor = '#d1fae5';
        btn.style.borderColor = 'var(--success)';
        btn.style.color = '#065f46';
      } else if (isSelected) {
        btn.style.backgroundColor = '#fee2e2';
        btn.style.borderColor = 'var(--coral)';
        btn.style.color = '#991b1b';
      } else {
        btn.style.backgroundColor = '#fff';
        btn.style.borderColor = '#cbd5e1';
      }
    });

    if (isCorrect) {
      score++;
      showFeedback(true, '✨ Correct! Outstanding job.');
    } else {
      showFeedback(false, `❌ Incorrect. Correct answers: <strong>${q.correctAnswer}</strong>`);
    }

    sessionAnswers.push({
      title: q.title,
      type: q.type,
      options: q.options,
      correctAnswer: q.correctAnswer,
      userAnswer: selectedTexts.join(', '),
      isCorrect: isCorrect
    });

    const submitBtn = document.querySelector('#pq-session-question-body button');
    if (submitBtn) submitBtn.style.display = 'none';

    const nextBtn = document.getElementById('pq-session-next-btn');
    if (nextBtn) nextBtn.classList.add('show');
  };

  LQ.switchPracticeSetupTab = function (tab) {
    const createTabBtn = document.getElementById('pq-tab-create');
    const historyTabBtn = document.getElementById('pq-tab-history');
    const createContent = document.getElementById('pq-setup-tab-content-create');
    const historyContent = document.getElementById('pq-setup-tab-content-history');

    if (!createTabBtn || !historyTabBtn || !createContent || !historyContent) return;

    if (tab === 'create') {
      createTabBtn.classList.add('active');
      historyTabBtn.classList.remove('active');
      createContent.classList.remove('hidden');
      historyContent.classList.add('hidden');
    } else {
      createTabBtn.classList.remove('active');
      historyTabBtn.classList.add('active');
      createContent.classList.add('hidden');
      historyContent.classList.remove('hidden');
      LQ.loadPracticeHistory();
    }
  };
})();
