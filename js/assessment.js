window.LQ = window.LQ || {};

(function () {
  let activeTab = "practice";
  let activeFilter = "new";
  let activeSession = null;
  let timerInterval = null;

  function formatScoreNum(num) {
    if (num === null || num === undefined || isNaN(num)) return 0;
    return Number(Number(num).toFixed(2));
  }

  LQ.initAssessmentPage = async function () {
    await LQ.loadOfficialTestCards();
    await LQ.loadPracticeAssessmentCards();

    const defaultTab =
      fetchedOfficialTests && fetchedOfficialTests.length > 0
        ? "test"
        : activeTab || "test";
    LQ.switchAssessmentTab(defaultTab);
  };

  LQ.switchAssessmentTab = function (tab) {
    activeTab = tab || "practice";
    const btnPractice = document.getElementById("tab-btn-practice");
    const btnTest = document.getElementById("tab-btn-test");
    const viewPractice = document.getElementById("assessment-practice-view");
    const viewTest = document.getElementById("assessment-test-view");

    if (btnPractice)
      btnPractice.classList.toggle("active", activeTab === "practice");
    if (btnTest) btnTest.classList.toggle("active", activeTab === "test");
    if (viewPractice)
      viewPractice.classList.toggle("hidden", activeTab !== "practice");
    if (viewTest) viewTest.classList.toggle("hidden", activeTab !== "test");

    if (activeTab === "practice") {
      LQ.loadPracticeAssessmentCards();
    } else if (activeTab === "test") {
      LQ.loadOfficialTestCards();
    }
  };

  LQ.loadPracticeAssessmentCards = async function () {
    const listWrap = document.getElementById("assessment-list-grid");
    if (!listWrap) return;

    const items = await LQ.AssessmentDB.getAllAssessments();
    LQ.renderAssessmentCards(items);
  };

  LQ.setAssessmentFilter = function (val) {
    activeFilter = val || "new";
    const sel = document.getElementById("asm-status-filter");
    if (sel) sel.value = activeFilter;

    const btnNew = document.getElementById("filter-btn-new");
    const btnCompleted = document.getElementById("filter-btn-completed");
    const btnAll = document.getElementById("filter-btn-all");

    if (btnNew) btnNew.classList.toggle("active", activeFilter === "new");
    if (btnCompleted)
      btnCompleted.classList.toggle("active", activeFilter === "completed");
    if (btnAll) btnAll.classList.toggle("active", activeFilter === "all");

    if (activeTab === "practice") {
      LQ.loadPracticeAssessmentCards();
    } else if (activeTab === "test") {
      LQ.loadOfficialTestCards();
    }
  };

  LQ.renderAssessmentCards = function (list) {
    const wrap = document.getElementById("assessment-list-grid");
    const emptyState = document.getElementById("assessment-empty-state");
    if (!wrap) return;

    let practiceItems = (list || []).filter((a) => a.type !== "test");

    if (activeFilter === "new") {
      practiceItems = practiceItems.filter((a) => a.status !== "completed");
    } else if (activeFilter === "completed") {
      practiceItems = practiceItems.filter((a) => a.status === "completed");
    }

    if (!practiceItems.length) {
      wrap.innerHTML = "";
      if (emptyState) emptyState.classList.remove("hidden");
      return;
    }

    if (emptyState) emptyState.classList.add("hidden");

    wrap.innerHTML = practiceItems
      .map((item) => {
        const isDone = item.status === "completed";
        const dateStr = item.createdAt
          ? new Date(item.createdAt).toLocaleDateString()
          : "";
        const durTag = item.durationMinutes
          ? "<span>⏱️ " + item.durationMinutes + " mins</span>"
          : "";
        const pctNum = formatScoreNum(item.percentage);
        const themeClass =
          pctNum > 60 ? "green" : pctNum > 30 ? "amber" : "coral";
        const scoreBadge = isDone
          ? '<div class="asm-score-badge ' +
            themeClass +
            '">' +
            "Score: <strong>" +
            pctNum +
            "%</strong> (" +
            item.correctCount +
            "/" +
            item.totalQuestions +
            " Correct)" +
            "</div>"
          : "";

        const groupBadges = (item.groupNames || [])
          .slice(0, 3)
          .map((g) => '<span class="asm-group-tag">' + LQ.esc(g) + "</span>")
          .join("");

        const moreGroups =
          (item.groupNames || []).length > 3
            ? '<span class="asm-group-tag">+' +
              (item.groupNames.length - 3) +
              " more</span>"
            : "";

        return (
          '<article class="asm-card ' +
          (isDone ? "done" : "") +
          '">' +
          '<div class="asm-card-head">' +
          '<span class="asm-type-badge">' +
          (isDone ? "✓ Completed" : "⚡ Practice") +
          "</span>" +
          '<span class="asm-date">' +
          dateStr +
          "</span>" +
          "</div>" +
          '<h3 class="asm-card-title">' +
          LQ.esc(item.title) +
          "</h3>" +
          '<div class="asm-card-meta">' +
          "<span>📋 " +
          item.totalQuestions +
          " Questions</span>" +
          durTag +
          "</div>" +
          '<div class="asm-groups-row">' +
          groupBadges +
          moreGroups +
          "</div>" +
          scoreBadge +
          '<div class="asm-card-actions">' +
          (isDone
            ? '<button type="button" class="btn btn-view-results" onclick="LQ.showAssessmentResult(\'' +
              item.id +
              "')\">📊 View Results</button>"
            : '<button type="button" class="btn primary" onclick="LQ.startAssessmentSession(\'' +
              item.id +
              "')\">▶️ Attend Practice</button>") +
          "</div>" +
          "</article>"
        );
      })
      .join("");
  };

  /* ══ OFFICIAL TEST MANAGEMENT ══ */
  let fetchedOfficialTests = [];
  let pendingOfficialTestId = null;

  function parseLocalDatetimeMs(str) {
    if (!str) return 0;
    if (typeof str === "number") return str;

    const s = String(str).trim();
    const isPm = /pm/i.test(s);
    const isAm = /am/i.test(s);

    if (s.endsWith("Z") || s.includes("+")) {
      const dIso = new Date(s);
      if (!isNaN(dIso.getTime())) return dIso.getTime();
    }

    const clean = s.replace(/am|pm/gi, "").trim();
    const parts = clean.split(/[-T:\s\/]+/);

    if (parts.length >= 5) {
      let year = parseInt(parts[0], 10);
      let month = parseInt(parts[1], 10) - 1;
      let day = parseInt(parts[2], 10);
      let hour = parseInt(parts[3], 10);
      let min = parseInt(parts[4], 10);

      if (isPm && hour < 12) hour += 12;
      if (isAm && hour === 12) hour = 0;

      return new Date(year, month, day, hour, min).getTime();
    }

    const dDirect = new Date(s);
    return isNaN(dDirect.getTime()) ? 0 : dDirect.getTime();
  }

  LQ.loadOfficialTestCards = async function () {
    const listWrap = document.getElementById("official-test-list-grid");
    const emptyState = document.getElementById("official-test-empty-state");
    if (!listWrap) return;

    let officialTests = [];
    try {
      const res = await fetch("/api/cms/tests?t=" + Date.now(), {
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        officialTests = data.tests || [];
      }
    } catch (e) {
      console.warn("Could not fetch server official tests", e);
    }
    fetchedOfficialTests = officialTests;

    let profile = null;
    try {
      profile = JSON.parse(localStorage.getItem("lq_user_profile") || "null");
    } catch (e) {}

    let userResults = [];
    if (profile && profile.email) {
      try {
        const resRes = await fetch(
          "/api/cms/tests/results?email=" +
            encodeURIComponent(profile.email) +
            "&t=" +
            Date.now(),
          { cache: "no-store" },
        );
        if (resRes.ok) {
          const rData = await resRes.json();
          userResults = rData.results || [];
        }
      } catch (e) {}
    }

    const localCompleted = await LQ.AssessmentDB.getAllAssessments();
    const now = Date.now();

    let displayTests = officialTests.filter((item) => {
      const startMs = parseLocalDatetimeMs(item.startTime);
      const endMs = parseLocalDatetimeMs(item.endTime);
      const isDone =
        userResults.some(
          (r) =>
            String(r.testId) === String(item.id) && r.status === "completed",
        ) ||
        localCompleted.some(
          (c) => String(c.id) === String(item.id) && c.status === "completed",
        );

      if (activeFilter === "new") {
        // Show all non-completed official tests
        return !isDone;
      } else if (activeFilter === "completed") {
        // Show all completed official tests
        return isDone;
      }
      return true;
    });

    if (!displayTests.length) {
      listWrap.innerHTML = "";
      if (emptyState) emptyState.classList.remove("hidden");
      return;
    }
    if (emptyState) emptyState.classList.add("hidden");

    listWrap.innerHTML = displayTests
      .map((item) => {
        const startMs = parseLocalDatetimeMs(item.startTime);
        const endMs = parseLocalDatetimeMs(item.endTime);
        const isUpcoming = now < startMs;
        const isExpired = now > endMs;

        const isDone =
          userResults.some(
            (r) => r.testId === item.id && r.status === "completed",
          ) ||
          localCompleted.some(
            (c) => c.id === item.id && c.status === "completed",
          );

        const completedResult =
          userResults.find(
            (r) => r.testId === item.id && r.status === "completed",
          ) ||
          localCompleted.find(
            (c) => c.id === item.id && c.status === "completed",
          );

        const startStr = item.startTime
          ? new Date(item.startTime).toLocaleString(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            })
          : "—";
        const endStr = item.endTime
          ? new Date(item.endTime).toLocaleString(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            })
          : "—";
        const durTag = item.durationMinutes
          ? "<span>⏱️ " + item.durationMinutes + " mins</span>"
          : "";
        const qCount = (item.questions || []).length;

        let statusText = "⚡ Active Test";
        if (isDone) {
          statusText = "✓ Completed";
        } else if (isUpcoming) {
          statusText = "🔒 Upcoming Test";
        } else if (isExpired) {
          statusText = "⌛ Test Expired";
        }

        let scoreBadge = "";
        if (isDone && completedResult) {
          const pctNum = formatScoreNum(completedResult.percentage);
          const themeClass =
            pctNum > 60 ? "green" : pctNum > 30 ? "amber" : "coral";
          scoreBadge =
            '<div class="asm-score-badge ' +
            themeClass +
            '">' +
            "Score: <strong>" +
            pctNum +
            "%</strong> (" +
            (completedResult.correctCount || 0) +
            "/" +
            (completedResult.totalQuestions || qCount) +
            " Correct)" +
            "</div>";
        }

        let actionButton = "";
        if (isDone) {
          actionButton =
            '<button type="button" class="btn btn-view-results" onclick="LQ.showAssessmentResult(\'' +
            item.id +
            "')\">📊 View Results</button>";
        } else if (isExpired) {
          actionButton =
            '<button type="button" class="btn" disabled style="opacity:0.65;cursor:not-allowed;">⌛ Test Expired</button>';
        } else if (isUpcoming) {
          actionButton =
            '<button type="button" class="btn" disabled style="opacity:0.65;cursor:not-allowed;">🔒 Starts at ' +
            startStr +
            "</button>";
        } else {
          actionButton =
            '<button type="button" class="btn primary" onclick="LQ.openTestInstructionModal(\'' +
            item.id +
            "')\">▶️ Attend Test</button>";
        }

        return (
          '<article class="asm-card ' +
          (isDone ? "done" : "") +
          '">' +
          '<div class="asm-card-head">' +
          '<span class="asm-type-badge">' +
          statusText +
          "</span>" +
          "</div>" +
          '<h3 class="asm-card-title" style="margin-top:6px;">' +
          LQ.esc(item.title) +
          "</h3>" +
          '<div class="asm-dates-box" style="display:flex;flex-direction:column;gap:3px;font-size:12px;color:var(--text-muted, #64748b);margin:8px 0;background:#f8fafc;padding:8px 10px;border-radius:8px;border:1px solid #e2e8f0;">' +
          "<div>📅 <strong>Start Date:</strong> " +
          startStr +
          "</div>" +
          "<div>🏁 <strong>End Date:</strong> " +
          endStr +
          "</div>" +
          "</div>" +
          '<div class="asm-card-meta">' +
          "<span>📋 " +
          qCount +
          " Questions</span>" +
          durTag +
          "</div>" +
          scoreBadge +
          '<div class="asm-card-actions">' +
          actionButton +
          "</div>" +
          "</article>"
        );
      })
      .join("");
  };

  LQ.openTestInstructionModal = async function (testId) {
    pendingOfficialTestId = testId;
    let test = (fetchedOfficialTests || []).find(
      (t) => String(t.id) === String(testId),
    );
    if (!test) {
      try {
        const res = await fetch("/api/cms/tests?t=" + Date.now(), {
          cache: "no-store",
        });
        if (res.ok) {
          const data = await res.json();
          fetchedOfficialTests = data.tests || [];
          test = fetchedOfficialTests.find(
            (t) => String(t.id) === String(testId),
          );
        }
      } catch (e) {}
    }

    if (!test) {
      test = {
        id: testId,
        title: "Official Test Evaluation",
        instructions: "",
        durationMinutes: 20,
        questions: [],
      };
    }

    const modal = document.getElementById("modal-test-instruction");
    const titleEl = document.getElementById("inst-test-title");
    const windowEl = document.getElementById("inst-test-window");
    const durEl = document.getElementById("inst-test-duration");
    const termsEl = document.getElementById("inst-test-terms");

    const startStr = test.startTime
      ? new Date(test.startTime).toLocaleString(undefined, {
          dateStyle: "medium",
          timeStyle: "short",
        })
      : "Immediate";
    const endStr = test.endTime
      ? new Date(test.endTime).toLocaleString(undefined, {
          dateStyle: "medium",
          timeStyle: "short",
        })
      : "No Expiry";

    if (titleEl) titleEl.textContent = test.title;
    if (windowEl)
      windowEl.textContent =
        "📅 Availability Window: " + startStr + " to " + endStr;
    if (durEl)
      durEl.textContent = test.durationMinutes
        ? "⏱️ Duration: " + test.durationMinutes + " minutes"
        : "⏱️ Duration: Untimed";

    let formattedInstructions = (test.instructions || "").trim();
    if (!formattedInstructions) {
      const totalQs = (test.questions || []).length;
      const durationStr = test.durationMinutes
        ? test.durationMinutes + " minutes"
        : "Untimed (No time limit)";
      formattedInstructions =
        "📌 Official Test Guidelines & Examination Rules:\n\n" +
        "• Total Questions: " +
        totalQs +
        " Questions\n" +
        "• Duration: " +
        durationStr +
        "\n" +
        "• Stable Internet: Ensure a steady internet connection before starting.\n" +
        "• Continuous Timer: Once started, the timer runs continuously. Do not close or refresh the tab.\n" +
        "• Real-Time Syncing: Your answers sync automatically as you move between questions.\n" +
        "• Auto-Submission: When the timer expires, your test will submit automatically.\n" +
        "• Mandatory Credentials: Your Name & Email will be permanently attached to this attempt record.";
    }
    if (termsEl) termsEl.textContent = formattedInstructions;

    if (modal) {
      modal.classList.remove("hidden");
      modal.style.display = "flex";
    }
  };

  LQ.closeTestInstructionModal = function () {
    const modal = document.getElementById("modal-test-instruction");
    if (modal) {
      modal.classList.add("hidden");
      modal.style.display = "none";
    }
  };

  LQ.openStudentRegistrationModal = function () {
    LQ.closeTestInstructionModal();
    const modal = document.getElementById("modal-student-registration");
    const nameInp = document.getElementById("reg-student-name");
    const emailInp = document.getElementById("reg-student-email");

    let profile = null;
    try {
      profile = JSON.parse(localStorage.getItem("lq_user_profile") || "null");
    } catch (e) {}

    if (profile) {
      if (nameInp && profile.name) nameInp.value = profile.name;
      if (emailInp && profile.email) emailInp.value = profile.email;
    }

    if (modal) {
      modal.classList.remove("hidden");
      modal.style.display = "flex";
    }
  };

  LQ.closeStudentRegistrationModal = function () {
    const modal = document.getElementById("modal-student-registration");
    if (modal) {
      modal.classList.add("hidden");
      modal.style.display = "none";
    }
  };

  LQ.submitStudentRegistration = function (e) {
    if (e) e.preventDefault();
    const nameInp = document.getElementById("reg-student-name");
    const emailInp = document.getElementById("reg-student-email");

    const name = nameInp ? nameInp.value.trim() : "";
    const email = emailInp ? emailInp.value.trim() : "";

    if (!name || !email) {
      LQ.toast("Name and Email are required.");
      return;
    }

    const profile = { name: name, email: email };
    try {
      localStorage.setItem("lq_user_profile", JSON.stringify(profile));
    } catch (err) {}

    LQ.closeStudentRegistrationModal();

    if (pendingOfficialTestId) {
      LQ.startOfficialTestSession(pendingOfficialTestId, profile);
    }
  };

  LQ.startOfficialTestSession = async function (testId, candidate) {
    const test = (fetchedOfficialTests || []).find(
      (t) => String(t.id) === String(testId),
    );
    if (!test) {
      LQ.toast("Test not found");
      return;
    }

    let calcSeconds = null;
    if (test.durationMinutes) {
      calcSeconds = parseInt(test.durationMinutes, 10) * 60;
    } else if (test.endTime) {
      const endMs = parseLocalDatetimeMs(test.endTime);
      if (endMs) {
        const windowSec = Math.floor((endMs - Date.now()) / 1000);
        if (windowSec > 0) calcSeconds = windowSec;
      }
    }
    if (!calcSeconds || isNaN(calcSeconds) || calcSeconds <= 0) {
      calcSeconds = 15 * 60; // 15-minute default timer if un-timed
    }

    let timerRecord = null;
    try {
      if (LQ.AssessmentDB && LQ.AssessmentDB.getAttempt) {
        timerRecord = await LQ.AssessmentDB.getAttempt(test.id);
      }
    } catch (e) {}

    if (!timerRecord || timerRecord.status !== 'in_progress') {
      timerRecord = {
        id: test.id,
        testId: test.id,
        startTimeMs: Date.now(),
        durationSeconds: calcSeconds,
        status: 'in_progress'
      };
      try {
        if (LQ.AssessmentDB && LQ.AssessmentDB.saveAttempt) {
          await LQ.AssessmentDB.saveAttempt(timerRecord);
        }
      } catch (e) {}
    }

    activeSession = {
      isOfficial: true,
      candidate: candidate,
      assessment: {
        id: test.id,
        title: test.title,
        type: "test",
        totalQuestions: (test.questions || []).length,
        durationMinutes: test.durationMinutes || 15,
        questions: (test.questions || []).map((q) => ({
          id: q.id,
          text: q.text,
          type: q.type || "mcq",
          groupTitle: test.title,
          options:
            q.options || (q.type === "true_false" ? ["True", "False"] : []),
          correctAnswerIndex:
            q.correctAnswerIndex !== undefined ? q.correctAnswerIndex : null,
          correctAnswerText: q.correctAnswerText || "",
        })),
        userAnswers: {},
      },
      currentIndex: 0,
      userAnswers: {},
      startTimeMs: timerRecord.startTimeMs,
      durationSeconds: timerRecord.durationSeconds,
    };

    try {
      sessionStorage.setItem("currentAssessmentId", test.id);
    } catch (e) {}

    (window.goTo || LQ.goTo)("assessment-session");
    LQ.renderAssessmentSessionScreen();
  };

  function syncLiveProgress() {
    if (!activeSession || !activeSession.isOfficial) return;
    try {
      fetch("/api/cms/tests/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          testId: activeSession.assessment.id,
          testTitle: activeSession.assessment.title,
          userName: activeSession.candidate.name,
          userEmail: activeSession.candidate.email,
          userAnswers: activeSession.userAnswers,
          currentIndex: activeSession.currentIndex,
        }),
      });
    } catch (e) {}
  }

  let selectedAsmListId = "";
  let selectedAsmGroupIds = [];

  LQ.openCreateAssessmentModal = async function () {
    const modal = document.getElementById("modal-create-assessment");
    if (!modal) return;

    // Reset fields
    const titleInp = document.getElementById("asm-title");
    if (titleInp) {
      const dateStr = new Date().toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      });
      const randHex = Math.random().toString(36).substring(2, 5).toUpperCase();
      titleInp.value = `Practice Assessment — ${dateStr} #${randHex}`;
    }
    const qCountInp = document.getElementById("asm-q-count");
    if (qCountInp) qCountInp.value = "10";
    const durInp = document.getElementById("asm-duration");
    if (durInp) durInp.value = "";

    // Pre-fetch practice questions if not yet loaded
    if (!LQ.practiceQuestionsData || !Array.isArray(LQ.practiceQuestionsData)) {
      try {
        const v = "?v=" + (LQ.version || Date.now());
        const r = await fetch("data/practice-questions.json" + v);
        const data = await r.json();
        LQ.practiceQuestionsData = Array.isArray(data) ? data : [];
      } catch (e) {
        console.warn("Failed to pre-fetch practice-questions.json in assessment modal", e);
      }
    }

    // Set up dropdown events
    const listTrigger = document.getElementById("asm-pq-list-dropdown-trigger");
    const listMenu = document.getElementById("asm-pq-list-dropdown-menu");
    const groupTrigger = document.getElementById("asm-pq-group-dropdown-trigger");
    const groupMenu = document.getElementById("asm-pq-group-dropdown-menu");

    if (listTrigger && listMenu) {
      listTrigger.onclick = function (e) {
        e.stopPropagation();
        const isShown = listMenu.style.display === "block";
        closeAllAsmDropdowns();
        if (!isShown) listMenu.style.display = "block";
      };
    }

    if (groupTrigger && groupMenu) {
      groupTrigger.onclick = function (e) {
        e.stopPropagation();
        const isShown = groupMenu.style.display === "block";
        closeAllAsmDropdowns();
        if (!isShown) groupMenu.style.display = "block";
      };
    }

    document.addEventListener("click", closeAllAsmDropdowns);

    const lists = (LQ.WORD_LISTS && LQ.WORD_LISTS.lists) ? LQ.WORD_LISTS.lists : [];
    if (listMenu && lists.length > 0) {
      listMenu.innerHTML = lists.map(l => `
        <div class="pq-dropdown-item asm-pq-list-item" onclick="LQ.selectAsmListOption('${l.id}', '${l.title.replace(/'/g, "\\'")}')" style="padding: 10px 12px; font-size: 13px; cursor: pointer; border-radius: 4px; color: var(--ink); font-weight: 500; transition: background 0.1s;">
          ${l.title}
        </div>
      `).join("");
      
      LQ.selectAsmListOption(lists[0].id, lists[0].title);
    }

    modal.classList.remove("hidden");
  };

  function closeAllAsmDropdowns() {
    const listMenu = document.getElementById("asm-pq-list-dropdown-menu");
    const groupMenu = document.getElementById("asm-pq-group-dropdown-menu");
    if (listMenu) listMenu.style.display = "none";
    if (groupMenu) groupMenu.style.display = "none";
  }

  LQ.selectAsmListOption = function (listId, listTitle) {
    selectedAsmListId = listId;
    const labelEl = document.getElementById("asm-pq-list-dropdown-label");
    if (labelEl) labelEl.textContent = listTitle;
    
    const listMenu = document.getElementById("asm-pq-list-dropdown-menu");
    if (listMenu) {
      listMenu.querySelectorAll(".asm-pq-list-item").forEach(item => {
        const text = item.textContent.trim();
        item.style.backgroundColor = (text === listTitle) ? "rgba(245,166,35,0.08)" : "transparent";
      });
    }
    
    populateAsmUserGroups();
  };

  function populateAsmUserGroups() {
    const groupMenu = document.getElementById("asm-pq-group-dropdown-menu");
    if (!groupMenu || !selectedAsmListId) return;

    const lists = (LQ.WORD_LISTS && LQ.WORD_LISTS.lists) ? LQ.WORD_LISTS.lists : [];
    const lst = lists.find(l => l.id === selectedAsmListId);
    const groups = lst ? (lst.groups || []) : [];

    selectedAsmGroupIds = [];

    if (!groups.length) {
      groupMenu.innerHTML = '<div style="padding: 12px; font-size: 13px; color: #64748b; text-align: center;">No groups in this list</div>';
      updateAsmGroupTriggerLabel();
      return;
    }

    const selectAllHtml = `
      <div class="pq-dropdown-item" onclick="LQ.toggleAsmGroupSelectAll(event)" style="padding: 10px 12px; font-size: 13px; cursor: pointer; border-radius: 4px; color: var(--ink); font-weight: 700; transition: background 0.1s; display: flex; align-items: center; gap: 8px;">
        <input type="checkbox" id="asm-pq-group-select-all-chk" style="cursor: pointer;" onclick="event.stopPropagation(); LQ.toggleAsmGroupSelectAll(event)">
        <span>Select All</span>
      </div>
    `;

    const itemsHtml = groups.map(g => `
      <div class="pq-dropdown-item asm-pq-group-item" data-group-id="${g.id}" onclick="LQ.toggleAsmGroupOption(event, '${g.id}')" style="padding: 10px 12px; font-size: 13px; cursor: pointer; border-radius: 4px; color: var(--ink); font-weight: 500; transition: background 0.1s; display: flex; align-items: center; gap: 8px;">
        <input type="checkbox" class="asm-pq-group-chk" value="${g.id}" style="cursor: pointer;" onclick="event.stopPropagation(); LQ.toggleAsmGroupOption(event, '${g.id}')">
        <span>${g.title}</span>
      </div>
    `).join("");

    groupMenu.innerHTML = selectAllHtml + itemsHtml;
    
    // Default to Select All
    LQ.toggleAsmGroupSelectAll({ stopPropagation: () => {} });
  }

  LQ.toggleAsmGroupSelectAll = function (e) {
    if (e && e.stopPropagation) e.stopPropagation();
    const chk = document.getElementById("asm-pq-group-select-all-chk");
    if (!chk) return;
    
    const isChecked = !chk.checked;
    chk.checked = isChecked;

    const chks = document.querySelectorAll(".asm-pq-group-chk");
    selectedAsmGroupIds = [];
    chks.forEach(c => {
      c.checked = isChecked;
      if (isChecked) {
        selectedAsmGroupIds.push(c.value);
      }
    });

    updateAsmGroupTriggerLabel();
  };

  LQ.toggleAsmGroupOption = function (e, groupId) {
    if (e && e.stopPropagation) e.stopPropagation();
    
    const chks = document.querySelectorAll(".asm-pq-group-chk");
    const targetChk = Array.from(chks).find(c => c.value === groupId);
    if (!targetChk) return;
    
    if (e.target !== targetChk) {
      targetChk.checked = !targetChk.checked;
    }

    selectedAsmGroupIds = [];
    chks.forEach(c => {
      if (c.checked) {
        selectedAsmGroupIds.push(c.value);
      }
    });

    const allChk = document.getElementById("asm-pq-group-select-all-chk");
    if (allChk) {
      allChk.checked = (selectedAsmGroupIds.length === chks.length);
    }

    updateAsmGroupTriggerLabel();
  };

  function updateAsmGroupTriggerLabel() {
    const labelEl = document.getElementById("asm-pq-group-dropdown-label");
    if (!labelEl) return;

    if (selectedAsmGroupIds.length === 0) {
      labelEl.textContent = "Select Group(s)";
    } else {
      const lists = (LQ.WORD_LISTS && LQ.WORD_LISTS.lists) ? LQ.WORD_LISTS.lists : [];
      const lst = lists.find(l => l.id === selectedAsmListId);
      const groups = lst ? (lst.groups || []) : [];
      
      if (selectedAsmGroupIds.length === groups.length) {
        labelEl.textContent = `All Groups Selected (${groups.length})`;
      } else {
        labelEl.textContent = `${selectedAsmGroupIds.length} Group(s) Selected`;
      }
    }
  }

  LQ.closeCreateAssessmentModal = function () {
    const modal = document.getElementById("modal-create-assessment");
    if (modal) modal.classList.add("hidden");
  };

  LQ.createPracticeAssessment = async function (e) {
    if (e) e.preventDefault();

    if (!selectedAsmListId || !selectedAsmGroupIds.length) {
      LQ.toast("Please select a list and at least one group");
      return;
    }

    const qCountInp = document.getElementById("asm-q-count");
    const durInp = document.getElementById("asm-duration");
    const titleInp = document.getElementById("asm-title");

    const questionCount = Math.max(1, parseInt((qCountInp && qCountInp.value) || "10", 10));
    const durationMinutes = durInp && durInp.value ? parseInt(durInp.value, 10) : null;
    const title = (titleInp && titleInp.value.trim()) || "Custom Practice Assessment";

    // Gather questions from the new practice-questions file/data
    const practiceQuestions = Array.isArray(LQ.practiceQuestionsData) ? LQ.practiceQuestionsData : [];
    const pool = practiceQuestions.filter(q => q.listId === selectedAsmListId && selectedAsmGroupIds.includes(q.groupId));

    if (!pool.length) {
      LQ.toast("No questions available in the selected groups");
      return;
    }

    // Shuffle and pick questionCount questions
    const shuffled = pool.sort(() => 0.5 - Math.random());
    const selectedQuestions = shuffled.slice(0, Math.min(questionCount, shuffled.length)).map((q, idx) => {
      let type = q.type || "mcq";
      if (type === "fib") type = "fill_blank";

      const options = q.options || null;
      let correctAnswerIndex = null;
      let correctAnswerText = "";

      if (options && options.length) {
        correctAnswerIndex = options.indexOf(q.correctAnswer);
        if (correctAnswerIndex === -1) correctAnswerIndex = 0;
      } else {
        correctAnswerText = q.correctAnswer;
      }

      const lists = (LQ.WORD_LISTS && LQ.WORD_LISTS.lists) ? LQ.WORD_LISTS.lists : [];
      const lst = lists.find(l => l.id === selectedAsmListId);
      const groupObj = lst ? lst.groups.find(g => g.id === q.groupId) : null;
      const groupTitle = groupObj ? groupObj.title : q.groupId;

      return {
        id: "q_" + idx,
        groupId: q.groupId,
        groupTitle: groupTitle,
        type: type,
        text: q.title,
        options: options,
        correctAnswerIndex: correctAnswerIndex,
        correctAnswerText: correctAnswerText,
        correctAnswers: [correctAnswerText],
        userAnswerIndex: null,
        userTextAnswer: "",
      };
    });

    const asmId = "asm_" + Date.now();
    const lists = (LQ.WORD_LISTS && LQ.WORD_LISTS.lists) ? LQ.WORD_LISTS.lists : [];
    const lst = lists.find(l => l.id === selectedAsmListId);
    const groupNames = selectedAsmGroupIds.map((id) => {
      const g = lst ? lst.groups.find(x => x.id === id) : null;
      return g ? g.title : id;
    });

    const newAssessment = {
      id: asmId,
      type: "practice",
      title: title,
      groupIds: selectedAsmGroupIds,
      groupNames: groupNames,
      totalQuestions: selectedQuestions.length,
      durationMinutes: durationMinutes,
      createdAt: Date.now(),
      status: "not_started",
      questions: selectedQuestions,
      userAnswers: {},
    };

    await LQ.AssessmentDB.saveAssessment(newAssessment);
    LQ.closeCreateAssessmentModal();
    LQ.toast("Practice Assessment created!", true);

    // Refresh cards
    if (LQ.initAssessmentPage) {
      LQ.initAssessmentPage();
    }
  };

  LQ.deleteAssessmentCard = async function (id) {
    if (confirm("Delete this practice assessment?")) {
      await LQ.AssessmentDB.deleteAssessment(id);
      LQ.toast("Assessment deleted");
      LQ.initAssessmentPage();
    }
  };

  LQ.startAssessmentSession = async function (id) {
    try {
      sessionStorage.setItem("currentAssessmentId", id);
    } catch (e) {}
    LQ.restoreAssessmentSession(id);
  };

  LQ.restoreAssessmentSession = async function (id) {
    if (!id) {
      (window.goTo || LQ.goTo)("assessment");
      return;
    }
    try {
      sessionStorage.setItem("currentAssessmentId", id);
    } catch (e) {}

    if (
      activeSession &&
      activeSession.assessment &&
      activeSession.assessment.id === id
    ) {
      (window.goTo || LQ.goTo)("assessment-session");
      LQ.renderAssessmentSessionScreen();
      return;
    }

    let item = await LQ.AssessmentDB.getAssessment(id);
    if (!item) {
      if (!fetchedOfficialTests || !fetchedOfficialTests.length) {
        try {
          const res = await fetch("/api/cms/tests?t=" + Date.now(), { cache: "no-store" });
          if (res.ok) {
            const data = await res.json();
            fetchedOfficialTests = data.tests || [];
          }
        } catch (e) {}
      }
      const offTest = (fetchedOfficialTests || []).find((t) => String(t.id) === String(id));
      if (offTest) {
        let profile = null;
        try { profile = JSON.parse(localStorage.getItem("lq_user_profile") || "null"); } catch (e) {}
        LQ.startOfficialTestSession(id, profile);
        return;
      }
      (window.goTo || LQ.goTo)("assessment");
      return;
    }

    if (item.status === "completed") {
      LQ.showAssessmentResult(id);
      return;
    }

    let timerRecord = null;
    try {
      if (LQ.AssessmentDB && LQ.AssessmentDB.getAttempt) {
        timerRecord = await LQ.AssessmentDB.getAttempt(id);
      }
    } catch (e) {}

    if (!timerRecord || timerRecord.status !== 'in_progress') {
      timerRecord = {
        id: id,
        testId: id,
        startTimeMs: Date.now(),
        durationSeconds: item.durationMinutes ? item.durationMinutes * 60 : 15 * 60,
        status: 'in_progress'
      };
      try {
        if (LQ.AssessmentDB && LQ.AssessmentDB.saveAttempt) {
          await LQ.AssessmentDB.saveAttempt(timerRecord);
        }
      } catch (e) {}
    }

    activeSession = {
      assessment: item,
      currentIndex: 0,
      userAnswers: item.userAnswers || {},
      startTimeMs: timerRecord.startTimeMs,
      durationSeconds: timerRecord.durationSeconds,
    };

    (window.goTo || LQ.goTo)("assessment-session");
    LQ.renderAssessmentSessionScreen();
  };

  LQ.renderAssessmentSessionScreen = function () {
    const id = sessionStorage.getItem("currentAssessmentId");
    if (activeSession && activeSession.assessment) {
      LQ.renderSessionQuestion();
      LQ.startSessionTimer();
    } else if (id) {
      LQ.restoreAssessmentSession(id);
    }
  };

  LQ.startSessionTimer = function () {
    if (LQ._asmTimerId) {
      clearInterval(LQ._asmTimerId);
      LQ._asmTimerId = null;
    }

    function updateDisplay() {
      if (!activeSession) return;

      const timerEl = document.getElementById("asm-session-timer");
      if (!timerEl) return;

      if (!activeSession.startTimeMs) activeSession.startTimeMs = Date.now();
      if (!activeSession.durationSeconds) activeSession.durationSeconds = 15 * 60;

      const elapsedSec = Math.floor((Date.now() - activeSession.startTimeMs) / 1000);
      const rem = Math.max(0, activeSession.durationSeconds - elapsedSec);

      if (rem <= 0) {
        if (LQ._asmTimerId) {
          clearInterval(LQ._asmTimerId);
          LQ._asmTimerId = null;
        }
        timerEl.style.display = "inline-flex";
        timerEl.style.background = "#fee2e2";
        timerEl.style.color = "#dc2626";
        timerEl.style.borderColor = "#fecdd3";
        timerEl.innerHTML = "⏱️ 0:00";
        LQ.toast("⏱️ Time is up! Auto-submitting test...", true);
        LQ.submitAssessmentSession();
        return;
      }

      const m = Math.floor(rem / 60);
      const s = rem % 60;
      const isUrgent = rem <= 60;

      timerEl.style.display = "inline-flex";
      timerEl.style.background = isUrgent ? "#fee2e2" : "#fef3c7";
      timerEl.style.color = isUrgent ? "#dc2626" : "#b45309";
      timerEl.style.borderColor = isUrgent ? "#fecdd3" : "#fde68a";
      timerEl.innerHTML = "⏱️ " + m + ":" + (s < 10 ? "0" : "") + s;
    }

    updateDisplay();
    LQ._asmTimerId = setInterval(updateDisplay, 1000);
  };

  LQ.renderSessionQuestion = function () {
    if (!activeSession) return;
    const asm = activeSession.assessment;
    const idx = activeSession.currentIndex;
    const q = asm.questions[idx];

    const titleEl = document.getElementById("asm-session-title");
    const counterEl = document.getElementById("asm-session-counter");
    const bodyEl = document.getElementById("asm-session-body");
    const btnPrev = document.getElementById("asm-btn-prev");
    const btnNext = document.getElementById("asm-btn-next");
    const btnSubmit = document.getElementById("asm-btn-submit");
    const timerEl = document.getElementById("asm-session-timer");

    if (titleEl) titleEl.textContent = asm.title;
    if (counterEl)
      counterEl.textContent =
        "Question " + (idx + 1) + " of " + asm.totalQuestions;

    if (timerEl) {
      if (!activeSession.startTimeMs) activeSession.startTimeMs = Date.now();
      if (!activeSession.durationSeconds) activeSession.durationSeconds = 15 * 60;
      const elapsedSec = Math.floor((Date.now() - activeSession.startTimeMs) / 1000);
      const rem = Math.max(0, activeSession.durationSeconds - elapsedSec);
      const m = Math.floor(rem / 60);
      const s = rem % 60;
      const isUrgent = rem <= 60;
      timerEl.style.display = "inline-flex";
      timerEl.style.background = isUrgent ? "#fee2e2" : "#fef3c7";
      timerEl.style.color = isUrgent ? "#dc2626" : "#b45309";
      timerEl.style.borderColor = isUrgent ? "#fecdd3" : "#fde68a";
      timerEl.innerHTML = "⏱️ " + m + ":" + (s < 10 ? "0" : "") + s;
    }

    if (btnPrev) btnPrev.style.display = idx === 0 ? "none" : "inline-flex";
    if (btnNext)
      btnNext.classList.toggle("hidden", idx === asm.totalQuestions - 1);
    if (btnSubmit)
      btnSubmit.classList.toggle("hidden", idx !== asm.totalQuestions - 1);

    if (!bodyEl || !q) return;

    let optionsHtml = "";
    const currentAnswer = activeSession.userAnswers[idx];

    if (q.type === "mcq_multi") {
      const selectedArr = Array.isArray(currentAnswer) ? currentAnswer : [];
      optionsHtml =
        '<div style="font-size:13px;font-weight:600;margin-bottom:8px;color:var(--text-muted, #64748b);">Select all correct options that apply:</div>' +
        '<div class="asm-options-list">' +
        (q.options || [])
          .map((opt, oIdx) => {
            const isSelected = selectedArr.includes(oIdx);
            const prefix = String.fromCharCode(65 + oIdx);
            return (
              '<button type="button" class="asm-opt-btn ' +
              (isSelected ? "selected" : "") +
              '" onclick="LQ.toggleMultiSessionAnswer(' +
              oIdx +
              ')">' +
              '<span class="asm-opt-prefix">' +
              prefix +
              "</span>" +
              "<span>" +
              LQ.esc(opt) +
              "</span>" +
              "</button>"
            );
          })
          .join("") +
        "</div>";
    } else if (q.options && q.options.length) {
      optionsHtml =
        '<div class="asm-options-list">' +
        q.options
          .map((opt, oIdx) => {
            const isSelected = currentAnswer === oIdx;
            const prefix = String.fromCharCode(65 + oIdx);
            return (
              '<button type="button" class="asm-opt-btn ' +
              (isSelected ? "selected" : "") +
              '" onclick="LQ.selectSessionAnswer(' +
              oIdx +
              ')">' +
              '<span class="asm-opt-prefix">' +
              prefix +
              "</span>" +
              "<span>" +
              LQ.esc(opt) +
              "</span>" +
              "</button>"
            );
          })
          .join("") +
        "</div>";
    } else if (
      q.type === "fill_blank" &&
      q.correctAnswers &&
      q.correctAnswers.length > 1
    ) {
      const ansArr = Array.isArray(currentAnswer) ? currentAnswer : [];
      optionsHtml =
        '<div class="asm-text-wrap" style="display:flex;flex-direction:column;gap:12px;">' +
        '<div style="font-size:13px;font-weight:600;color:var(--text-muted, #64748b);">✏️ Fill in the missing answers for each blank:</div>' +
        q.correctAnswers
          .map((_, bIdx) => {
            const val = ansArr[bIdx] || "";
            return (
              '<div style="display:flex;align-items:center;gap:10px;">' +
              '<label style="font-size:13px;font-weight:700;min-width:65px;">Blank ' +
              (bIdx + 1) +
              ":</label>" +
              '<input type="text" class="inp" value="' +
              LQ.esc(val) +
              '" placeholder="Type answer for blank ' +
              (bIdx + 1) +
              '..." oninput="LQ.saveMultiBlankAnswer(' +
              bIdx +
              ', this.value)" style="flex:1;">' +
              "</div>"
            );
          })
          .join("") +
        "</div>";
    } else {
      optionsHtml =
        '<div class="asm-text-wrap">' +
        '<textarea id="asm-text-ans" class="inp" rows="3" placeholder="Type your response here..." oninput="LQ.saveSessionTextAnswer(this.value)">' +
        LQ.esc(typeof currentAnswer === "string" ? currentAnswer : "") +
        "</textarea>" +
        "</div>";
    }

    bodyEl.innerHTML =
      '<div class="asm-q-card">' +
      '<div class="asm-q-head">' +
      '<span class="asm-q-group-badge">' +
      LQ.esc(q.groupTitle) +
      "</span>" +
      "</div>" +
      '<p class="asm-q-text">' +
      LQ.esc(q.text) +
      "</p>" +
      optionsHtml +
      "</div>";
  };

  LQ.selectSessionAnswer = function (optIdx) {
    if (!activeSession) return;
    activeSession.userAnswers[activeSession.currentIndex] = optIdx;
    LQ.renderSessionQuestion();
    syncLiveProgress();
  };

  LQ.toggleMultiSessionAnswer = function (optIdx) {
    if (!activeSession) return;
    const qIdx = activeSession.currentIndex;
    let list = Array.isArray(activeSession.userAnswers[qIdx])
      ? activeSession.userAnswers[qIdx]
      : [];
    if (list.includes(optIdx)) {
      list = list.filter((x) => x !== optIdx);
    } else {
      list.push(optIdx);
    }
    activeSession.userAnswers[qIdx] = list;
    LQ.renderSessionQuestion();
    syncLiveProgress();
  };

  LQ.saveMultiBlankAnswer = function (blankIdx, val) {
    if (!activeSession) return;
    const qIdx = activeSession.currentIndex;
    let list = Array.isArray(activeSession.userAnswers[qIdx])
      ? activeSession.userAnswers[qIdx]
      : [];
    list[blankIdx] = val;
    activeSession.userAnswers[qIdx] = list;
    syncLiveProgress();
  };

  LQ.saveSessionTextAnswer = function (val) {
    if (!activeSession) return;
    activeSession.userAnswers[activeSession.currentIndex] = val;
    syncLiveProgress();
  };

  LQ.prevSessionQuestion = function () {
    if (activeSession && activeSession.currentIndex > 0) {
      activeSession.currentIndex--;
      LQ.renderSessionQuestion();
      syncLiveProgress();
    }
  };

  LQ.nextSessionQuestion = function () {
    if (
      activeSession &&
      activeSession.currentIndex < activeSession.assessment.totalQuestions - 1
    ) {
      activeSession.currentIndex++;
      LQ.renderSessionQuestion();
      syncLiveProgress();
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

      const grpId = q.groupId || "official";
      const grpTitle = q.groupTitle || asm.title;

      if (!groupStats[grpId]) {
        groupStats[grpId] = {
          groupId: grpId,
          groupTitle: grpTitle,
          total: 0,
          correct: 0,
          wrong: 0,
        };
      }

      groupStats[grpId].total++;

      if (q.type === "mcq_multi") {
        const expectedIndices = (q.correctAnswerIndices || []).slice().sort();
        const userIndices = Array.isArray(userAns)
          ? userAns.slice().sort()
          : [];
        isCorrect =
          expectedIndices.length > 0 &&
          expectedIndices.length === userIndices.length &&
          expectedIndices.every((v, i) => v === userIndices[i]);
      } else if (
        q.type === "mcq" ||
        q.type === "true_false" ||
        (q.options && q.options.length && q.correctAnswerIndex !== null)
      ) {
        isCorrect = userAns === q.correctAnswerIndex;
      } else if (q.type === "fill_blank") {
        if (q.correctAnswers && q.correctAnswers.length > 1) {
          const userBlankArr = Array.isArray(userAns) ? userAns : [];
          isCorrect = q.correctAnswers.every((expected, bIdx) => {
            const expStr = (expected || "").trim().toLowerCase();
            const actStr = (userBlankArr[bIdx] || "").trim().toLowerCase();
            return expStr.length > 0 && expStr === actStr;
          });
        } else {
          const expected = (
            q.correctAnswers ? q.correctAnswers[0] : q.correctAnswerText || ""
          )
            .trim()
            .toLowerCase();
          const actual =
            typeof userAns === "string" ? userAns.trim().toLowerCase() : "";
          isCorrect = expected.length > 0 && expected === actual;
        }
      } else {
        isCorrect = typeof userAns === "string" && userAns.trim().length >= 3;
      }

      q.userAnswer = userAns;
      q.isCorrect = isCorrect;

      if (isCorrect) {
        correctCount++;
        groupStats[grpId].correct++;
      } else {
        wrongCount++;
        groupStats[grpId].wrong++;
      }
    });

    // Compute accuracy percentages for groups
    Object.keys(groupStats).forEach((gId) => {
      const g = groupStats[gId];
      g.percentage =
        g.total > 0 ? formatScoreNum((g.correct / g.total) * 100) : 0;
    });

    const percentage =
      asm.totalQuestions > 0
        ? formatScoreNum((correctCount / asm.totalQuestions) * 100)
        : 0;

    asm.status = "completed";
    asm.userAnswers = activeSession.userAnswers;
    asm.correctCount = correctCount;
    asm.wrongCount = wrongCount;
    asm.percentage = percentage;
    asm.groupStats = groupStats;
    asm.completedAt = Date.now();

    if (activeSession.isOfficial && activeSession.candidate) {
      try {
        await fetch("/api/cms/tests/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            testId: asm.id,
            testTitle: asm.title,
            userName: activeSession.candidate.name,
            userEmail: activeSession.candidate.email,
            totalQuestions: asm.totalQuestions,
            correctCount: correctCount,
            wrongCount: wrongCount,
            percentage: percentage,
            questions: asm.questions,
            userAnswers: activeSession.userAnswers,
          }),
        });
      } catch (e) {}
    }

    if (activeSession && activeSession.assessment) {
      try {
        if (LQ.AssessmentDB && LQ.AssessmentDB.saveAttempt) {
          await LQ.AssessmentDB.saveAttempt({
            id: activeSession.assessment.id,
            testId: activeSession.assessment.id,
            status: "completed",
            completedAt: Date.now(),
          });
        }
      } catch (e) {}
    }

    await LQ.AssessmentDB.saveAssessment(asm);
    LQ.toast("Assessment submitted & evaluated!", true);

    const asmId = asm.id;
    if (LQ._asmTimerId) {
      clearInterval(LQ._asmTimerId);
      LQ._asmTimerId = null;
    }
    activeSession = null;
    LQ.showAssessmentResult(asmId);
  };

  LQ.showAssessmentResult = function (id) {
    if (!id) return;
    try {
      sessionStorage.setItem("currentAssessmentId", id);
    } catch (e) {}
    (window.goTo || LQ.goTo)("assessment-result");
  };



  LQ.renderAssessmentResultScreen = async function () {
    const id = sessionStorage.getItem("currentAssessmentId");
    if (!id) return;

    const asm = await LQ.AssessmentDB.getAssessment(id);
    if (!asm) {
      LQ.toast("Assessment results not found");
      return;
    }

    const titleEl = document.getElementById("asm-res-title");
    const scorePctEl = document.getElementById("asm-res-pct");
    const scoreCountsEl = document.getElementById("asm-res-counts");
    const groupStatsEl = document.getElementById("asm-res-group-stats");
    const questionsListEl = document.getElementById("asm-res-q-list");

    const pctNum = formatScoreNum(asm.percentage);
    if (titleEl) titleEl.textContent = asm.title + " — Results";
    if (scorePctEl) {
      scorePctEl.textContent = pctNum + "%";
      scorePctEl.className =
        "asm-res-pct-circle " +
        (pctNum > 60
          ? "circle-green"
          : pctNum > 30
          ? "circle-amber"
          : "circle-coral");
    }
    if (scoreCountsEl) {
      const createdTs = asm.createdAt || asm.completedAt;
      const createdDateStr = createdTs
        ? new Date(createdTs).toLocaleString(undefined, {
            dateStyle: "medium",
            timeStyle: "short",
          })
        : "";
      const submittedDateStr = asm.completedAt
        ? new Date(asm.completedAt).toLocaleString(undefined, {
            dateStyle: "medium",
            timeStyle: "short",
          })
        : "Completed";
      scoreCountsEl.innerHTML =
        '<div class="asm-res-stats-wrap">' +
        '<div class="asm-res-stat-chips">' +
        '<span class="asm-stat-chip chip-correct">✓ ' +
        asm.correctCount +
        " Correct</span>" +
        '<span class="asm-stat-chip chip-wrong">✕ ' +
        asm.wrongCount +
        " Wrong</span>" +
        '<span class="asm-stat-chip chip-total">❓ ' +
        asm.totalQuestions +
        " Total</span>" +
        "</div>" +
        '<div class="asm-res-timestamps">' +
        (createdDateStr
          ? "<span>📅 Created: " + createdDateStr + "</span>"
          : "") +
        (asm.completedAt
          ? "<span>🕒 Submitted: " + submittedDateStr + "</span>"
          : "") +
        "</div>" +
        "</div>";
    }

    // Render Group Performance Breakdown
    if (groupStatsEl && asm.groupStats) {
      const groups = Object.values(asm.groupStats);
      groupStatsEl.innerHTML =
        "<h3>📊 Performance by Tenses Group</h3>" +
        groups
          .map((g) => {
            const color =
              g.percentage > 60
                ? "#22c55e"
                : g.percentage > 30
                ? "#f59e0b"
                : "#ef4444";
            return (
              '<div class="asm-grp-stat-item">' +
              '<div class="asm-grp-stat-head">' +
              "<strong>" +
              LQ.esc(g.groupTitle) +
              "</strong>" +
              "<span>" +
              g.correct +
              "/" +
              g.total +
              " (" +
              g.percentage +
              "%)</span>" +
              "</div>" +
              '<div class="asm-grp-stat-bar"><div class="asm-grp-stat-fill" style="width:' +
              g.percentage +
              "%;background:" +
              color +
              '"></div></div>' +
              "</div>"
            );
          })
          .join("");
    }

    // Render Question-by-Question Review
    if (questionsListEl && asm.questions) {
      questionsListEl.innerHTML =
        "<h3>📝 Detailed Question Evaluation</h3>" +
        asm.questions
          .map((q, i) => {
            const isOk = q.isCorrect;
            let ansStr = "";
            if (q.options && q.options.length) {
              const userOpt =
                q.userAnswer !== undefined && q.userAnswer !== null
                  ? q.options[q.userAnswer]
                  : "Not answered";
              const correctOpt =
                q.correctAnswerIndex !== null
                  ? q.options[q.correctAnswerIndex]
                  : "—";
              ansStr =
                '<p class="asm-res-ans"><strong>Your choice:</strong> ' +
                LQ.esc(userOpt) +
                "</p>" +
                (!isOk
                  ? '<p class="asm-res-ans correct"><strong>Correct choice:</strong> ' +
                    LQ.esc(correctOpt) +
                    "</p>"
                  : "");
            } else {
              const expected = q.correctAnswerText || (q.correctAnswers ? q.correctAnswers[0] : "");
              ansStr =
                '<p class="asm-res-ans"><strong>Your answer:</strong> ' +
                LQ.esc(q.userAnswer || "(Empty)") +
                "</p>" +
                (!isOk
                  ? '<p class="asm-res-ans correct"><strong>Correct answer:</strong> ' +
                    LQ.esc(expected) +
                    "</p>"
                  : "");
            }

            return (
              '<div class="asm-res-q-item ' +
              (isOk ? "ok" : "wrong") +
              '">' +
              '<div class="asm-res-q-head">' +
              '<span class="asm-res-q-num">Q' +
              (i + 1) +
              " · " +
              LQ.esc(q.groupTitle) +
              "</span>" +
              '<span class="asm-res-q-badge ' +
              (isOk ? "ok" : "wrong") +
              '">' +
              (isOk ? "✓ Correct" : "✕ Incorrect") +
              "</span>" +
              "</div>" +
              '<p class="asm-res-q-text">' +
              LQ.esc(q.text) +
              "</p>" +
              ansStr +
              "</div>"
            );
          })
          .join("");
    }
  };

  document.addEventListener("DOMContentLoaded", function () {
    setTimeout(function () {
      const currentScreen = sessionStorage.getItem("currentScreen");
      const currentId = sessionStorage.getItem("currentAssessmentId");

      if (currentScreen === "assessment-session" && currentId) {
        LQ.restoreAssessmentSession(currentId);
      } else if (currentScreen === "assessment-result" && currentId) {
        LQ.showAssessmentResult(currentId);
      } else {
        const sc = document.getElementById("screen-assessment");
        if (sc && sc.classList.contains("active")) {
          LQ.switchAssessmentTab("practice");
        }
      }
    }, 150);
  });
})();
