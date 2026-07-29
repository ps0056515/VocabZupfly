window.LQ = window.LQ || {};

(function () {
  let activeTab = "practice";
  let activeFilter = "new";
  let activeSession = null;
  let timerInterval = null;
  let testPage = 1;
  let testSearch = "";

  function formatScoreNum(num) {
    if (num === null || num === undefined || isNaN(num)) return 0;
    return Number(Number(num).toFixed(2));
  }

  LQ.initAssessmentPage = async function () {
    await LQ.loadOfficialTestCards();
    await LQ.loadPracticeAssessmentCards();

    const defaultTab = activeTab || (fetchedOfficialTests && fetchedOfficialTests.length > 0 ? "test" : "practice");
    LQ.switchAssessmentTab(defaultTab);
  };

  LQ.switchAssessmentTab = function (tab) {
    activeTab = tab || "practice";
    const btnPractice = document.getElementById("tab-btn-practice");
    const btnTest = document.getElementById("tab-btn-test");
    const viewPractice = document.getElementById("assessment-practice-view");
    const viewTest = document.getElementById("assessment-test-view");
    const btnCreatePractice = document.getElementById("btn-create-practice-asm");
    const searchWrap = document.querySelector(".asm-search-wrap");

    if (btnPractice)
      btnPractice.classList.toggle("active", activeTab === "practice");
    if (btnTest) btnTest.classList.toggle("active", activeTab === "test");
    if (viewPractice)
      viewPractice.classList.toggle("hidden", activeTab !== "practice");
    if (viewTest) viewTest.classList.toggle("hidden", activeTab !== "test");

    if (btnCreatePractice) {
      btnCreatePractice.style.display = activeTab === "practice" ? "inline-flex" : "none";
    }
    if (searchWrap) {
      searchWrap.style.display = activeTab === "test" ? "flex" : "none";
    }

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
    const pagWrap = document.getElementById("official-test-pagination");
    if (!listWrap) return;

    var params = 'page=' + testPage + '&limit=10&status=' + activeFilter;
    if (testSearch) params += '&search=' + encodeURIComponent(testSearch);

    let displayTests = [];
    let totalPages = 1;
    let currentPage = 1;

    try {
      const res = await fetch("/api/student/tests?" + params, {
        credentials: "include",
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        displayTests = data.tests || [];
        totalPages = data.pages || 1;
        currentPage = data.page || 1;
      }
    } catch (e) {
      console.warn("Could not fetch server assigned tests", e);
    }
    // Update global fetchedOfficialTests
    fetchedOfficialTests = displayTests;

    const now = Date.now();

    if (!displayTests.length) {
      listWrap.innerHTML = "";
      if (emptyState) emptyState.classList.remove("hidden");
      if (pagWrap) pagWrap.innerHTML = "";
      return;
    }
    if (emptyState) emptyState.classList.add("hidden");

    listWrap.innerHTML = displayTests
      .map((item) => {
        const startMs = item.startTime ? new Date(item.startTime).getTime() : 0;
        const endMs = item.endTime ? new Date(item.endTime).getTime() : 0;
        const isUpcoming = now < startMs;
        const isEarlyWindow = now >= (startMs - 5 * 60 * 1000) && now < startMs;
        const isExpired = now > endMs;
        const isDone = item.isCompleted;
        const isInProgress = item.isInProgress;

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
        const totalDurMins = Math.ceil((item.totalDurationSec || 0) / 60);
        const durTag = totalDurMins
          ? "<span>⏱️ " + totalDurMins + " mins</span>"
          : "";
        const qCount = item.totalQuestions || 0;

        let statusText = "⚡ Active Test";
        if (isDone) {
          statusText = "✓ Completed";
        } else if (isInProgress) {
          statusText = "⚡ In Progress";
        } else if (isUpcoming && isEarlyWindow) {
          statusText = "⏳ Opening Soon";
        } else if (isUpcoming) {
          statusText = "🔒 Upcoming Test";
        } else if (isExpired) {
          statusText = "⌛ Test Expired";
        }

        let scoreBadge = "";
        if (isDone && item.completedResult) {
          const pctNum = formatScoreNum(item.completedResult.percentage);
          const themeClass =
            pctNum > 60 ? "green" : pctNum > 30 ? "amber" : "coral";
          scoreBadge =
            '<div class="asm-score-badge ' +
            themeClass +
            '">' +
            "Score: <strong>" +
            pctNum +
            "%</strong> (" +
            (item.completedResult.correctCount || 0) +
            "/" +
            (item.completedResult.totalQuestions || qCount) +
            " Correct)" +
            "</div>";
        }

        let actionButton = "";
        if (isDone) {
          actionButton =
            '<button type="button" class="btn btn-view-results" onclick="LQ.showAssessmentResult(\'' +
            item.id +
            "')\">📊 View Results</button>";
        } else if (isInProgress) {
          actionButton =
            '<button type="button" class="btn primary" onclick="LQ.openTestInstructionModal(\'' +
            item.id +
            "')\">▶️ Attend Test (In Progress)</button>";
        } else if (isExpired) {
          actionButton =
            '<button type="button" class="btn" disabled style="opacity:0.65;cursor:not-allowed;">⌛ Test Expired</button>';
        } else if (isUpcoming && !isEarlyWindow) {
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

    // Render pagination controls
    if (pagWrap) {
      if (totalPages <= 1) {
        pagWrap.innerHTML = "";
      } else {
        var btns = "";
        for (var p = 1; p <= totalPages; p++) {
          btns += '<button type="button" class="admin-btn admin-btn-sm' + (p === currentPage ? ' admin-btn-primary' : '') + '" onclick="LQ.switchTestPage(' + p + ')">' + p + '</button>';
        }
        pagWrap.innerHTML = btns;
      }
    }
  };

  LQ.switchTestPage = function (p) {
    testPage = p;
    LQ.loadOfficialTestCards();
  };

  LQ.onAssessmentSearchInput = function () {
    const val = (document.getElementById('asm-search-input') || {}).value || '';
    if (val.trim().length > 0 && val.trim().length < 3) return;
    testSearch = val;
    testPage = 1;
    if (activeTab === 'test') {
      LQ.loadOfficialTestCards();
    } else {
      // (Optional: search practice assessments locally)
      const listWrap = document.getElementById("assessment-list-grid");
      if (listWrap) {
        LQ.AssessmentDB.getAllAssessments().then(function (items) {
          const filtered = items.filter(function (item) {
            return (item.title || '').toLowerCase().includes(val.toLowerCase());
          });
          LQ.renderAssessmentCards(filtered);
        });
      }
    }
  };

  LQ.openTestInstructionModal = async function (testId) {
    pendingOfficialTestId = testId;
    let test = null;
    try {
      const res = await fetch("/api/student/tests/" + testId, {
        credentials: "include",
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        test = data.test;
      }
    } catch (e) {
      console.warn("Could not fetch test details", e);
    }

    if (!test) {
      // Fallback to cms
      try {
        const res = await fetch("/api/cms/tests?t=" + Date.now(), { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          var cmsTests = data.tests || [];
          test = cmsTests.find((t) => String(t.id) === String(testId));
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
    } else {
      if (test._id && !test.id) test.id = test._id;
      if (test.sections && test.sections.length) {
        var flatQuestions = [];
        test.sections.forEach(function (sec) {
          (sec.questions || []).forEach(function (q) {
            flatQuestions.push({
              id: q.questionId || q._id,
              text: q.questionText,
              type: q.type,
              mcqType: q.mcqType,
              options: q.options,
              correctAnswerIndex: q.options ? q.options.indexOf(q.correctAnswer) : null,
              correctAnswerText: q.correctAnswer || "",
              groupTitle: sec.name
            });
          });
        });
        test.questions = flatQuestions;
      }
      if (test.totalDurationSec) {
        test.durationMinutes = Math.ceil(test.totalDurationSec / 60);
      }
    }
    // Cache in fetchedOfficialTests
    var idx = (fetchedOfficialTests || []).findIndex(t => String(t.id) === String(testId));
    if (idx !== -1) {
      fetchedOfficialTests[idx] = test;
    } else {
      fetchedOfficialTests.push(test);
    }

    if (LQ._instTimerId) {
      clearInterval(LQ._instTimerId);
      LQ._instTimerId = null;
    }

    const modal = document.getElementById("modal-test-instruction");
    const titleEl = document.getElementById("inst-test-title");
    const windowEl = document.getElementById("inst-test-window");
    const durEl = document.getElementById("inst-test-duration");
    const termsEl = document.getElementById("inst-test-terms");
    const countdownEl = document.getElementById("inst-test-countdown");
    const startBtn = document.getElementById("btn-proceed-registration");

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

    // Proctoring warning message
    const warnEl = document.getElementById("inst-test-proctoring-warning");
    if (warnEl) {
      const limit = test.malpracticeLimit || 3;
      warnEl.innerHTML = `<strong>⚠️ Proctored Examination Warning:</strong> Do not switch tabs, exit fullscreen, or minimize the browser window. Malpractice detection is active. You are allowed at most <strong>${limit} violation(s)</strong>. Exceeding this will trigger automatic test submission.`;
    }

    // Section structure breakdown table
    const tbody = document.getElementById("inst-test-sections-tbody");
    if (tbody) {
      if (test.sections && test.sections.length) {
        tbody.innerHTML = test.sections.map(sec => {
          let secMarks = 0;
          (sec.questions || []).forEach(q => secMarks += q.marks || 1);
          return `<tr>
            <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;color:#334155;">${LQ.esc(sec.name)}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;color:#334155;">${(sec.questions || []).length} Qs</td>
            <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;color:#334155;font-weight:600;">${secMarks}</td>
          </tr>`;
        }).join("");
      } else {
        tbody.innerHTML = `<tr><td colspan="3" style="padding:12px;text-align:center;color:#94a3b8;">No sections defined.</td></tr>`;
      }
    }

    // Countdown / Action button state
    const startMs = test.startTime ? new Date(test.startTime).getTime() : 0;
    const now = Date.now();

    function updateCountdown() {
      const curNow = Date.now();
      if (curNow < startMs) {
        const diffMs = startMs - curNow;
        const totalSec = Math.max(0, Math.floor(diffMs / 1000));
        const mins = Math.floor(totalSec / 60);
        const secs = totalSec % 60;
        if (countdownEl) {
          countdownEl.textContent = "⏱️ Starts in: " + mins + ":" + (secs < 10 ? "0" : "") + secs;
          countdownEl.style.color = "#dc2626";
        }
        if (startBtn) {
          startBtn.disabled = true;
          startBtn.style.opacity = "0.5";
          startBtn.style.cursor = "not-allowed";
        }
      } else {
        if (LQ._instTimerId) {
          clearInterval(LQ._instTimerId);
          LQ._instTimerId = null;
        }
        if (countdownEl) {
          countdownEl.textContent = "✓ Test is active.";
          countdownEl.style.color = "#16a34a";
        }
        if (startBtn) {
          startBtn.disabled = false;
          startBtn.style.opacity = "1";
          startBtn.style.cursor = "pointer";
        }
      }
    }

    if (startMs && now < startMs) {
      updateCountdown();
      LQ._instTimerId = setInterval(updateCountdown, 1000);
    } else {
      if (countdownEl) countdownEl.textContent = "";
      if (startBtn) {
        startBtn.disabled = false;
        startBtn.style.opacity = "1";
        startBtn.style.cursor = "pointer";
      }
    }

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
        "• Auto-Submission: When the timer expires, your test will submit automatically.";
    }
    if (termsEl) termsEl.textContent = formattedInstructions;

    if (modal) {
      modal.classList.remove("hidden");
      modal.style.display = "flex";
    }
  };

  LQ.closeTestInstructionModal = function () {
    if (LQ._instTimerId) {
      clearInterval(LQ._instTimerId);
      LQ._instTimerId = null;
    }
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
      (t) => String(t.id) === String(testId) || String(t._id) === String(testId),
    );
    if (!test) {
      LQ.toast("Test not found");
      return;
    }

    if (test.sections && test.sections.length) {
      var flatQuestions = [];
      test.sections.forEach(function (sec, secIdx) {
        (sec.questions || []).forEach(function (q) {
          flatQuestions.push({
            id: q.questionId || q._id,
            text: q.questionText,
            type: q.type,
            mcqType: q.mcqType,
            options: q.options,
            correctAnswerIndex: q.options ? q.options.indexOf(q.correctAnswer) : null,
            correctAnswerText: q.correctAnswer || "",
            groupTitle: sec.name,
            sectionIndex: secIdx,
            duration: q.duration !== undefined ? q.duration : 1,
            durationType: q.durationType || "minutes",
            subQuestions: q.subQuestions || []
          });
        });
      });
      test.questions = flatQuestions;
    }

    let calcSeconds = null;
    if (test.totalDurationSec) {
      calcSeconds = test.totalDurationSec;
    } else if (test.durationMinutes) {
      calcSeconds = parseInt(test.durationMinutes, 10) * 60;
    } else if (test.endTime) {
      const endMs = parseLocalDatetimeMs(test.endTime);
      if (endMs) {
        const windowSec = Math.floor((endMs - Date.now()) / 1000);
        if (windowSec > 0) calcSeconds = windowSec;
      }
    }
    if (!calcSeconds || isNaN(calcSeconds) || calcSeconds <= 0) {
      calcSeconds = 15 * 60;
    }

    // Restore attempt state from MongoDB server
    let serverAttempt = null;
    try {
      const res = await fetch("/api/student/tests/" + test.id + "/session", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        if (data.ok && data.attempt) {
          serverAttempt = data.attempt;
        }
      }
    } catch (e) {
      console.warn("Failed to fetch server attempt session", e);
    }

    let startTime = Date.now();
    let duration = calcSeconds;
    let savedAnswers = {};
    let savedIndex = 0;

    if (serverAttempt) {
      startTime = serverAttempt.startTimeMs || Date.now();
      duration = serverAttempt.durationSeconds || calcSeconds;
      savedAnswers = serverAttempt.userAnswers || {};
      
      const totalQs = (test.questions || []).length;
      let firstUnanswered = 0;
      for (let i = 0; i < totalQs; i++) {
        if (savedAnswers[i] === undefined || savedAnswers[i] === null || savedAnswers[i] === "") {
          firstUnanswered = i;
          break;
        }
      }
      savedIndex = firstUnanswered;
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
          groupTitle: q.groupTitle || test.title,
          options:
            q.options || (q.type === "true_false" ? ["True", "False"] : []),
          correctAnswerIndex:
            q.correctAnswerIndex !== undefined ? q.correctAnswerIndex : null,
          correctAnswerText: q.correctAnswerText || "",
          sectionIndex: q.sectionIndex !== undefined ? q.sectionIndex : 0,
          duration: q.duration !== undefined ? q.duration : 1,
          durationType: q.durationType || "minutes",
          subQuestions: q.subQuestions || []
        })),
        userAnswers: savedAnswers,
      },
      currentIndex: savedIndex,
      userAnswers: savedAnswers,
      startTimeMs: startTime,
      durationSeconds: duration,
    };

    try {
      sessionStorage.setItem("currentAssessmentId", test.id);
    } catch (e) {}

    (window.goTo || LQ.goTo)("assessment-session");
    LQ.renderAssessmentSessionScreen();
  };

  async function syncLiveProgress() {
    if (!activeSession) return;
    
    // 1. Sync to IndexDB local storage
    try {
      if (LQ.AssessmentDB && LQ.AssessmentDB.saveAttempt) {
        await LQ.AssessmentDB.saveAttempt({
          id: activeSession.assessment.id,
          testId: activeSession.assessment.id,
          startTimeMs: activeSession.startTimeMs,
          durationSeconds: activeSession.durationSeconds,
          userAnswers: activeSession.userAnswers,
          currentIndex: activeSession.currentIndex,
          status: 'in_progress'
        });
      }
    } catch (e) {}

    // 2. If official session, sync to MongoDB server
    if (activeSession.isOfficial) {
      try {
        await fetch("/api/assessment/save-progress", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            assessmentId: activeSession.assessment.id,
            userAnswers: activeSession.userAnswers,
            currentIndex: activeSession.currentIndex
          })
        });
      } catch (err) {
        console.warn("Failed to sync progress to server", err);
      }
    }
  }

  LQ.openCreateAssessmentModal = async function () {
    const modal = document.getElementById("modal-create-assessment");
    if (!modal) return;

    try {
      await LQ.wordListsReady;
    } catch (e) {}

    // Set unique default title by default
    const titleInp = document.getElementById("asm-title");
    if (titleInp) {
      const nowStr = new Date().toLocaleDateString() + " " + new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      const randSuffix = Math.random().toString(36).substring(2, 5).toUpperCase();
      titleInp.value = "Practice - " + nowStr + " - " + randSuffix;
    }

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
    LQ._selectedAsmListId = listId;
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
    if (!groupMenu || !LQ._selectedAsmListId) return;

    const lists = (LQ.WORD_LISTS && LQ.WORD_LISTS.lists) ? LQ.WORD_LISTS.lists : [];
    const lst = lists.find(l => l.id === LQ._selectedAsmListId);
    const groups = lst ? (lst.groups || []) : [];

    LQ._selectedAsmGroupIds = [];

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
    LQ._selectedAsmGroupIds = [];
    chks.forEach(c => {
      c.checked = isChecked;
      if (isChecked) {
        LQ._selectedAsmGroupIds.push(c.value);
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

    LQ._selectedAsmGroupIds = [];
    chks.forEach(c => {
      if (c.checked) {
        LQ._selectedAsmGroupIds.push(c.value);
      }
    });

    const allChk = document.getElementById("asm-pq-group-select-all-chk");
    if (allChk) {
      allChk.checked = (LQ._selectedAsmGroupIds.length === chks.length);
    }

    updateAsmGroupTriggerLabel();
  };

  function updateAsmGroupTriggerLabel() {
    const labelEl = document.getElementById("asm-pq-group-dropdown-label");
    if (!labelEl) return;

    if (!LQ._selectedAsmGroupIds || LQ._selectedAsmGroupIds.length === 0) {
      labelEl.textContent = "Select Group(s)";
    } else {
      const lists = (LQ.WORD_LISTS && LQ.WORD_LISTS.lists) ? LQ.WORD_LISTS.lists : [];
      const lst = lists.find(l => l.id === LQ._selectedAsmListId);
      const groups = lst ? (lst.groups || []) : [];
      
      if (LQ._selectedAsmGroupIds.length === groups.length) {
        labelEl.textContent = `All Groups Selected (${groups.length})`;
      } else {
        labelEl.textContent = `${LQ._selectedAsmGroupIds.length} Group(s) Selected`;
      }
    }
  }

  LQ.closeCreateAssessmentModal = function () {
    const modal = document.getElementById("modal-create-assessment");
    if (modal) modal.classList.add("hidden");
  };

  LQ.createPracticeAssessment = async function (e) {
    if (e) e.preventDefault();

    if (!LQ._selectedAsmListId || !LQ._selectedAsmGroupIds || !LQ._selectedAsmGroupIds.length) {
      LQ.toast("Please select a list and at least one group");
      return;
    }

    const qCountInp = document.getElementById("asm-q-count");
    const durInp = document.getElementById("asm-duration");
    const titleInp = document.getElementById("asm-title");

    const questionCount = Math.max(1, parseInt((qCountInp && qCountInp.value) || "10", 10));
    const durationMinutes = durInp && durInp.value ? parseInt(durInp.value, 10) : null;
    const title = (titleInp && titleInp.value.trim()) || "Custom Practice Assessment";

    // Fetch practice questions from DB
    let pool = [];
    try {
      const url = "/api/practice-questions/pool?listId=" + encodeURIComponent(LQ._selectedAsmListId) + "&groupIds=" + encodeURIComponent(LQ._selectedAsmGroupIds.join(","));
      const resp = await fetch(url, { credentials: "include" });
      const data = await resp.json();
      if (data.ok && data.questions) {
        pool = data.questions;
      }
    } catch (err) {
      console.error("Failed to load practice questions pool", err);
    }

    if (!pool.length) {
      LQ.toast("No practice questions found for the selected group(s).");
      return;
    }

    // Shuffle and pick questionCount
    const shuffled = pool.sort(() => 0.5 - Math.random());
    const selectedQuestions = shuffled
      .slice(0, Math.min(questionCount, shuffled.length))
      .map((q, idx) => {
        let correctAnswerIndex = null;
        let correctAnswerIndices = [];
        
        if (q.type === "mcq") {
          correctAnswerIndex = q.options.indexOf(q.correctAnswer);
          if (correctAnswerIndex === -1) correctAnswerIndex = 0;
        } else if (q.type === "mcq_multi") {
          const answers = q.correctAnswer.split(",").map(s => s.trim());
          correctAnswerIndices = answers.map(ans => q.options.indexOf(ans)).filter(i => i >= 0);
        }

        return {
          id: "q_" + idx,
          dbId: q._id,
          groupId: q.groupId,
          groupTitle: q.groupId,
          text: q.title,
          type: q.type === "fib" ? "fill_blank" : q.type === "mcq_multi" ? "mcq_multi" : "mcq",
          options: q.options && q.options.length ? q.options : null,
          correctAnswerIndex: correctAnswerIndex,
          correctAnswerIndices: correctAnswerIndices,
          correctAnswers: q.type === "fib" ? [q.correctAnswer] : null,
          correctAnswerText: q.type === "fib" ? q.correctAnswer : "",
          userAnswerIndex: null,
          userTextAnswer: "",
        };
      });

    const asmId = "asm_" + Date.now();
    const groupNames = LQ._selectedAsmGroupIds.map(id => {
      const lists = (LQ.WORD_LISTS && LQ.WORD_LISTS.lists) ? LQ.WORD_LISTS.lists : [];
      const lst = lists.find(l => l.id === LQ._selectedAsmListId);
      const groups = lst ? (lst.groups || []) : [];
      const g = groups.find(x => x.id === id);
      return g ? g.title : id;
    });

    const newAssessment = {
      id: asmId,
      type: "practice",
      title: title,
      groupIds: LQ._selectedAsmGroupIds,
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

    goTo("assessment");
    LQ.switchAssessmentTab("practice");
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
        durationSeconds: item.durationMinutes ? item.durationMinutes * 60 : 0,
        currentIndex: 0,
        userAnswers: {},
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
      currentIndex: timerRecord.currentIndex || 0,
      userAnswers: timerRecord.userAnswers || item.userAnswers || {},
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

      // Handle background 7-second synchronization tick
      activeSession._syncTick = (activeSession._syncTick || 0) + 1;
      if (activeSession._syncTick % 7 === 0) {
        syncLiveProgress();
      }

      const qTimerEl = document.getElementById("asm-question-timer");
      const sTimerEl = document.getElementById("asm-section-timer");
      const legacyTimerEl = document.getElementById("asm-session-timer");

      if (activeSession.isOfficial) {
        // Hide legacy timer wrapper
        if (legacyTimerEl) legacyTimerEl.style.display = "none";

        // 1. Question Countdown
        let qRem = activeSession.questionRemainingSeconds !== undefined ? activeSession.questionRemainingSeconds : 60;
        qRem = Math.max(0, qRem - 1);
        activeSession.questionRemainingSeconds = qRem;

        const qM = Math.floor(qRem / 60);
        const qS = qRem % 60;
        if (qTimerEl) {
          qTimerEl.textContent = `${qM}:${qS < 10 ? "0" : ""}${qS}`;
          qTimerEl.style.color = qRem <= 10 ? "#ef4444" : "#fca5a5";
        }

        // 2. Section Countdown
        let sRem = activeSession.sectionRemainingSeconds !== undefined ? activeSession.sectionRemainingSeconds : 300;
        sRem = Math.max(0, sRem - 1);
        activeSession.sectionRemainingSeconds = sRem;

        const sM = Math.floor(sRem / 60);
        const sS = sRem % 60;
        if (sTimerEl) {
          sTimerEl.textContent = `${sM}:${sS < 10 ? "0" : ""}${sS}`;
          sTimerEl.style.color = sRem <= 30 ? "#ef4444" : "#93c5fd";
        }

        // Check Expirations
        if (qRem <= 0 || sRem <= 0) {
          if (LQ._asmTimerId) {
            clearInterval(LQ._asmTimerId);
            LQ._asmTimerId = null;
          }
          LQ.toast("⏱️ Time is up for this question! Auto-submitting...", true);
          LQ.submitSessionQuestion(true); // Trigger auto-submit
        }

      } else {
        // Fallback for custom IndexDB practice tests (Total Session Timer)
        if (!activeSession.durationSeconds) {
          if (legacyTimerEl) legacyTimerEl.style.display = "none";
          return;
        }

        if (!activeSession.startTimeMs) activeSession.startTimeMs = Date.now();
        const elapsedSec = Math.floor((Date.now() - activeSession.startTimeMs) / 1000);
        const rem = Math.max(0, activeSession.durationSeconds - elapsedSec);

        if (rem <= 0) {
          if (LQ._asmTimerId) {
            clearInterval(LQ._asmTimerId);
            LQ._asmTimerId = null;
          }
          if (legacyTimerEl) {
            legacyTimerEl.innerHTML = "⏱️ 0:00";
            legacyTimerEl.style.background = "#fee2e2";
            legacyTimerEl.style.color = "#dc2626";
          }
          LQ.toast("⏱️ Time is up! Auto-submitting test...", true);
          LQ.submitAssessmentSession();
          return;
        }

        const m = Math.floor(rem / 60);
        const s = rem % 60;
        if (legacyTimerEl) {
          legacyTimerEl.style.display = "inline-flex";
          legacyTimerEl.innerHTML = "⏱️ " + m + ":" + (s < 10 ? "0" : "") + s;
        }
      }
    }

    updateDisplay();
    LQ._asmTimerId = setInterval(updateDisplay, 1000);
  };

  LQ.showLoader = function () {
    const loader = document.getElementById("asm-session-loader");
    if (loader) {
      loader.classList.remove("hidden");
      loader.style.display = "flex";
    }
  };

  LQ.hideLoader = function () {
    const loader = document.getElementById("asm-session-loader");
    if (loader) {
      loader.classList.add("hidden");
      loader.style.display = "none";
    }
  };

  let speechRecognitionObj = null;
  let isRecordingAudio = false;

  LQ.renderSessionQuestion = function () {
    if (!activeSession) return;
    const asm = activeSession.assessment;
    const idx = activeSession.currentIndex;
    const q = asm.questions[idx];

    const trackerEl = document.getElementById("asm-session-tracker");
    const bodyEl = document.getElementById("asm-session-body");
    const qTimerEl = document.getElementById("asm-question-timer");
    const sTimerEl = document.getElementById("asm-section-timer");

    // Track attempts / question progression
    const attemptedCount = Object.keys(activeSession.userAnswers || {}).length;
    if (trackerEl) {
      trackerEl.textContent = `Section ${q.sectionIndex + 1} · Q${idx + 1}/${asm.totalQuestions} · Attempted ${attemptedCount}/${asm.totalQuestions}`;
    }

    // Initialize/reset question timer
    if (activeSession.isOfficial) {
      if (activeSession.activeQuestionIndexForTimer !== idx) {
        activeSession.activeQuestionIndexForTimer = idx;
        
        let qSec = 60;
        if (q.duration !== undefined) {
          const type = q.durationType || "minutes";
          if (type === "seconds") qSec = q.duration;
          else if (type === "hours") qSec = q.duration * 3600;
          else qSec = q.duration * 60;
        }
        activeSession.questionRemainingSeconds = qSec;
        
        const activeSec = q.sectionIndex;
        if (activeSession.activeSectionIndexForTimer !== activeSec) {
          activeSession.activeSectionIndexForTimer = activeSec;
          const sectionQs = asm.questions.filter(qi => qi.sectionIndex === activeSec);
          activeSession.sectionRemainingSeconds = sectionQs.reduce((acc, qi) => {
            let qiSec = 60;
            if (qi.duration !== undefined) {
              const type = qi.durationType || "minutes";
              if (type === "seconds") qiSec = qi.duration;
              else if (type === "hours") qiSec = qi.duration * 3600;
              else qiSec = qi.duration * 60;
            }
            return acc + qiSec;
          }, 0);
        }
      }
    }

    if (!bodyEl || !q) return;

    // Split Layout Markup
    let promptHtml = "";
    let workspaceHtml = "";
    const currentAnswer = activeSession.userAnswers[idx];

    // 1. Prompt Side (Left Panel)
    const isAudioType = q.type === "listening" || q.type === "listen_repeat" || q.type === "audio";
    const isFib = q.type === "fill_blank" || q.type === "fib";
    const isPassage = q.type === "passage";

    if (isFib) {
      // Fill in the Blanks: Full screen width, replace both ${blank} and underscores with inline inputs
      let textWithInputs = q.text;
      let blankIdx = 0;
      const ansArr = Array.isArray(currentAnswer) ? currentAnswer : (typeof currentAnswer === "string" ? [currentAnswer] : []);

      textWithInputs = textWithInputs.replace(/\$\{blank\}|_{3,}/g, function() {
        const val = ansArr[blankIdx] || "";
        const inputHtml = `<input type="text" class="asm-fib-input" data-blank-idx="${blankIdx}" value="${LQ.esc(val)}" oninput="LQ.saveInlineBlankAnswer(${blankIdx}, this.value)" style="border:none;border-bottom:2px solid #2563eb;outline:none;padding:2px 6px;font-size:15px;font-weight:700;color:#1e3a8a;width:130px;text-align:center;background:#eff6ff;border-radius:4px;margin:0 4px;" />`;
        blankIdx++;
        return inputHtml;
      });

      if (blankIdx === 0) {
        const val = typeof currentAnswer === "string" ? currentAnswer : (ansArr[0] || "");
        textWithInputs += ` <input type="text" class="asm-fib-input" data-blank-idx="0" value="${LQ.esc(val)}" oninput="LQ.saveInlineBlankAnswer(0, this.value)" style="border:none;border-bottom:2px solid #2563eb;outline:none;padding:2px 6px;font-size:15px;font-weight:700;color:#1e3a8a;width:150px;text-align:center;background:#eff6ff;border-radius:4px;margin:0 4px;" />`;
      }

      bodyEl.innerHTML = `
        <div style="width:100%;height:100%;padding:32px;overflow-y:auto;background:#fff;line-height:2.4;font-size:16px;">
          <span style="font-size:11px;font-weight:700;color:#2563eb;text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:12px;">Fill in the Blanks</span>
          <h3 style="margin:0;font-size:16px;color:#0f172a;line-height:2.4;font-weight:500;">${textWithInputs}</h3>
        </div>
      `;
      return; // Skip normal split rendering
    }

    if (isAudioType) {
      // Audio Question: Hide text, show play button
      const playId = `audio_play_${q.id}`;
      let playLimit = q.maxPlays || 2;
      let playedCount = parseInt(sessionStorage.getItem(`played_${q.id}`) || "0");
      
      promptHtml = `
        <div class="asm-split-left" style="align-items:center;justify-content:center;">
          <div style="font-size:48px;margin-bottom:16px;">🎧</div>
          <h3 style="margin:0 0 8px;font-size:16px;color:#0f172a;">Listen Carefully</h3>
          <p style="color:#64748b;font-size:13px;text-align:center;margin-bottom:20px;">Click the button below to listen to the audio passage.</p>
          <button type="button" id="btn-play-audio" class="btn primary" onclick="LQ.playQuestionAudio('${q.id}', '${LQ.esc(q.correctAnswerText || q.text)}')" style="background:#2563eb;color:#fff;font-weight:600;padding:12px 24px;border-radius:8px;display:flex;align-items:center;gap:8px;">
            <span>🔊 Play Audio</span>
            <span style="font-size:11px;background:rgba(255,255,255,0.2);padding:2px 6px;border-radius:4px;">Remaining: ${Math.max(0, playLimit - playedCount)}</span>
          </button>
        </div>
      `;
    } else if (isPassage) {
      // Passage Question: Read passage text as AUDIO on the left panel
      const playId = `audio_play_${q.id}`;
      let playLimit = q.maxPlays || 2;
      let playedCount = parseInt(sessionStorage.getItem(`played_${q.id}`) || "0");

      promptHtml = `
        <div class="asm-split-left" style="align-items:center;justify-content:center;">
          <div style="font-size:48px;margin-bottom:16px;">🎧</div>
          <h3 style="margin:0 0 8px;font-size:16px;color:#0f172a;">Listen to the Passage</h3>
          <p style="color:#64748b;font-size:13px;text-align:center;margin-bottom:20px;">Click the button below to listen to the passage passage passage.</p>
          <button type="button" id="btn-play-audio" class="btn primary" onclick="LQ.playQuestionAudio('${q.id}', '${LQ.esc(q.text)}')" style="background:#2563eb;color:#fff;font-weight:600;padding:12px 24px;border-radius:8px;display:flex;align-items:center;gap:8px;">
            <span>🔊 Play Passage Audio</span>
            <span style="font-size:11px;background:rgba(255,255,255,0.2);padding:2px 6px;border-radius:4px;">Remaining: ${Math.max(0, playLimit - playedCount)}</span>
          </button>
        </div>
      `;
    } else {
      // Normal Question: Show text prompt
      promptHtml = `
        <div class="asm-split-left">
          <span style="font-size:11px;font-weight:700;color:#2563eb;text-transform:uppercase;letter-spacing:0.5px;">Question Prompt</span>
          <h3 style="margin:0;font-size:16px;color:#0f172a;line-height:1.5;">${LQ.esc(q.text)}</h3>
        </div>
      `;
    }

    // 2. Workspace Side (Right Panel)
    const isSpeakType = q.type === "speak" || q.type === "listen_repeat" || q.type === "speaking";

    if (isSpeakType) {
      // Speaking Question: Microphone recording with speech-to-text
      workspaceHtml = `
        <div class="asm-split-right" style="justify-content:center;align-items:stretch;width:100%;max-width:none;gap:12px;">
          <div style="font-size:12px;font-weight:700;color:#ef4444;text-transform:uppercase;">Record Your Response</div>
          
          <div style="display:flex;align-items:center;justify-content:center;margin:8px 0;">
            <div id="mic-animation" class="hidden" style="width:70px;height:70px;border-radius:50%;background:rgba(239,68,68,0.2);display:flex;align-items:center;justify-content:center;animation:pulse 1.5s infinite;">
              <span style="font-size:32px;">🎙️</span>
            </div>
          </div>
          
          <textarea id="asm-text-ans" class="inp" rows="4" readonly style="width:100%;background:#fff;border:1px solid #cbd5e1;padding:12px;border-radius:8px;font-size:13px;resize:none;" placeholder="Your spoken text will appear here...">${LQ.esc(typeof currentAnswer === "string" ? currentAnswer : "")}</textarea>
          
          <button type="button" id="btn-mic-toggle" class="btn" onclick="LQ.toggleSpeechRecognition()" style="background:#dc2626;color:#fff;font-weight:600;padding:10px 20px;border-radius:8px;border:none;width:100%;">🎤 Start Recording</button>
          
          <div id="speech-fallback-msg" class="hidden" style="font-size:11px;color:#64748b;text-align:center;">Speech recognition fallback: You may type directly in the box below if speech recognition is not supported.</div>
        </div>
      `;
    } else if (isPassage) {
      // Passage Question: Loop over subQuestions and render sequential input elements
      const subAnswers = currentAnswer || {};
      workspaceHtml = `
        <div class="asm-split-right" style="justify-content:flex-start;align-items:stretch;gap:16px;overflow-y:auto;max-height:100%;width:100%;max-width:none;">
          <div style="font-size:13px;font-weight:700;color:#1e3a8a;border-bottom:1px solid #e2e8f0;padding-bottom:8px;">📝 Sub-Questions (Answer all)</div>
      `;
      (q.subQuestions || []).forEach((sq, sqIdx) => {
        const sqAns = subAnswers[sqIdx];
        workspaceHtml += `
          <div class="asm-passage-subq" style="background:#f8fafc;padding:16px;border-radius:10px;border:1px solid #e2e8f0;margin-bottom:12px;display:flex;flex-direction:column;gap:8px;">
            <div style="font-weight:700;font-size:13px;color:#334155;">Q${sqIdx + 1}. ${LQ.esc(sq.questionText || sq.text)}</div>
        `;
        
        const isSqFib = sq.type === "fib" || sq.type === "fill_blank" || sq.text.includes("${blank}") || sq.text.includes("___");
        
        if (sq.options && sq.options.length) {
          workspaceHtml += `
            <div style="display:flex;flex-direction:column;gap:8px;">
              ${sq.options.map((opt, oIdx) => {
                const isSelected = sqAns === oIdx;
                return `
                  <button type="button" class="asm-opt-btn ${isSelected ? "selected" : ""}" onclick="LQ.selectPassageSubAnswer(${idx}, ${sqIdx}, ${oIdx})" style="display:flex;align-items:center;gap:12px;width:100%;padding:10px 14px;border-radius:8px;border:1px solid #cbd5e1;background:#fff;text-align:left;cursor:pointer;font-size:13px;">
                    <span class="asm-opt-radio-icon" style="width:16px;height:16px;border-radius:50%;border:2px solid ${isSelected ? '#2563eb' : '#cbd5e1'};background:${isSelected ? '#2563eb' : 'transparent'};display:inline-block;flex-shrink:0;"></span>
                    <span>${LQ.esc(opt)}</span>
                  </button>
                `;
              }).join("")}
            </div>
          `;
        } else if (isSqFib) {
          let sqText = sq.text;
          let sqBlankIdx = 0;
          const sqAnsArr = Array.isArray(sqAns) ? sqAns : (typeof sqAns === "string" ? [sqAns] : []);
          
          sqText = sqText.replace(/\$\{blank\}|_{3,}/g, function() {
            const val = sqAnsArr[sqBlankIdx] || "";
            const inputHtml = `<input type="text" class="asm-fib-input" data-sq-idx="${sqIdx}" data-blank-idx="${sqBlankIdx}" value="${LQ.esc(val)}" oninput="LQ.savePassageSubFibAnswer(${idx}, ${sqIdx}, ${sqBlankIdx}, this.value)" style="border:none;border-bottom:2px solid #2563eb;outline:none;padding:2px 6px;font-size:13px;font-weight:700;color:#1e3a8a;width:100px;text-align:center;background:#eff6ff;border-radius:4px;margin:0 4px;" />`;
            sqBlankIdx++;
            return inputHtml;
          });
          
          if (sqBlankIdx === 0) {
            const val = typeof sqAns === "string" ? sqAns : (sqAnsArr[0] || "");
            sqText += ` <input type="text" class="asm-fib-input" data-sq-idx="${sqIdx}" data-blank-idx="0" value="${LQ.esc(val)}" oninput="LQ.savePassageSubFibAnswer(${idx}, ${sqIdx}, 0, this.value)" style="border:none;border-bottom:2px solid #2563eb;outline:none;padding:2px 6px;font-size:13px;font-weight:700;color:#1e3a8a;width:120px;text-align:center;background:#eff6ff;border-radius:4px;margin:0 4px;" />`;
          }
          
          workspaceHtml += `
            <div style="font-size:13px;color:#334155;line-height:2.0;">${sqText}</div>
          `;
        } else {
          workspaceHtml += `
            <input type="text" class="inp" placeholder="Type your response..." value="${LQ.esc(sqAns || '')}" oninput="LQ.savePassageSubTextAnswer(${idx}, ${sqIdx}, this.value)" style="width:100%;padding:10px 12px;border-radius:8px;border:1px solid #cbd5e1;background:#fff;font-size:13px;" />
          `;
        }
        workspaceHtml += `</div>`;
      });
      workspaceHtml += `</div>`;
    } else if (q.type === "mcq_multi") {
      const selectedArr = Array.isArray(currentAnswer) ? currentAnswer : [];
      workspaceHtml = `
        <div class="asm-split-right" style="justify-content:flex-start;align-items:stretch;gap:12px;">
          <div style="font-size:13px;font-weight:600;color:#64748b;margin-bottom:4px;">Select all correct options that apply:</div>
          <div class="asm-options-list" style="display:flex;flex-direction:column;gap:8px;">
            ${(q.options || []).map((opt, oIdx) => {
              const isSelected = selectedArr.includes(oIdx);
              const prefix = String.fromCharCode(65 + oIdx);
              return `
                <button type="button" class="asm-opt-btn ${isSelected ? "selected" : ""}" onclick="LQ.toggleMultiSessionAnswer(${oIdx})" style="display:flex;align-items:center;gap:12px;width:100%;padding:10px 14px;border-radius:8px;border:1px solid #cbd5e1;background:#fff;text-align:left;cursor:pointer;">
                  <span class="asm-opt-checkbox-icon" style="width:16px;height:16px;border-radius:4px;border:2px solid ${isSelected ? '#2563eb' : '#cbd5e1'};background:${isSelected ? '#2563eb' : 'transparent'};display:inline-block;flex-shrink:0;position:relative;margin-right:4px;">
                    ${isSelected ? '<span style="position:absolute;top:1px;left:4px;width:4px;height:8px;border:solid #fff;border-width:0 2px 2px 0;transform:rotate(45deg);display:block;"></span>' : ''}
                  </span>
                  <span>${LQ.esc(opt)}</span>
                </button>
              `;
            }).join("")}
          </div>
        </div>
      `;
    } else if (q.options && q.options.length) {
      workspaceHtml = `
        <div class="asm-split-right" style="justify-content:flex-start;align-items:stretch;gap:12px;">
          <div class="asm-options-list" style="display:flex;flex-direction:column;gap:8px;">
            ${q.options.map((opt, oIdx) => {
              const isSelected = currentAnswer === oIdx;
              const prefix = String.fromCharCode(65 + oIdx);
              return `
                <button type="button" class="asm-opt-btn ${isSelected ? "selected" : ""}" onclick="LQ.selectSessionAnswer(${oIdx})" style="display:flex;align-items:center;gap:12px;width:100%;padding:10px 14px;border-radius:8px;border:1px solid #cbd5e1;background:#fff;text-align:left;cursor:pointer;">
                  <span class="asm-opt-radio-icon" style="width:16px;height:16px;border-radius:50%;border:2px solid ${isSelected ? '#2563eb' : '#cbd5e1'};background:${isSelected ? '#2563eb' : 'transparent'};display:inline-block;flex-shrink:0;margin-right:4px;"></span>
                  <span>${LQ.esc(opt)}</span>
                </button>
              `;
            }).join("")}
          </div>
        </div>
      `;
    } else {
      // Text response / FIB fallback
      workspaceHtml = `
        <div class="asm-split-right" style="justify-content:center;align-items:stretch;gap:12px;">
          <div style="font-size:12px;font-weight:700;color:#64748b;">Type your response:</div>
          <textarea id="asm-text-ans" class="inp" rows="4" placeholder="Type your response here..." oninput="LQ.saveSessionTextAnswer(this.value)" style="width:100%;padding:12px;border-radius:8px;border:1px solid #cbd5e1;background:#fff;font-size:13px;resize:none;">${LQ.esc(typeof currentAnswer === "string" ? currentAnswer : "")}</textarea>
        </div>
      `;
    }

    bodyEl.innerHTML = `
      <div class="asm-split-container">
        ${promptHtml}
        ${workspaceHtml}
      </div>
    `;

    // Initialize speech support elements if needed
    if (isSpeakType) {
      LQ.checkSpeechSupport();
    }
    
    LQ.renderAsmSidebarContent();
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

    // Clean up proctoring listeners/mode
    LQ.clearTestProctoring();

    const asm = activeSession.assessment;

    if (activeSession.isOfficial) {
      // Official proctored database test submit
      try {
        const resp = await fetch("/api/student/tests/" + asm.id + "/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ userAnswers: activeSession.userAnswers })
        });
        const data = await resp.json();
        
        // Remove locally stored active attempt session
        try {
          if (LQ.AssessmentDB && LQ.AssessmentDB.deleteAttempt) {
            await LQ.AssessmentDB.deleteAttempt(asm.id);
          }
        } catch(e){}

        if (LQ._asmTimerId) {
          clearInterval(LQ._asmTimerId);
          LQ._asmTimerId = null;
        }

        sessionStorage.removeItem("lastTestResult");
        sessionStorage.setItem("currentAssessmentId", asm.id);
        
        activeSession = null;
        LQ.toast("Test submitted successfully!", true);
        (window.goTo || LQ.goTo)("assessment-result");
        LQ.renderAssessmentResultScreen();
        return;
      } catch (err) {
        console.error(err);
        LQ.toast("Network error submitting test. Please try again.");
        return;
      }
    }

    // Custom Practice Assessment Submit (IndexDB)
    let correctCount = 0;
    let wrongCount = 0;
    let percentage = 0;
    let groupStats = {};
    let evaluatedQuestions = asm.questions;

    try {
      const evalResp = await fetch("/api/assessment/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questions: asm.questions,
          userAnswers: activeSession.userAnswers
        })
      });
      const evalData = await evalResp.json();
      if (evalData.ok) {
        correctCount = evalData.correctCount;
        wrongCount = evalData.wrongCount;
        percentage = evalData.percentage;
        groupStats = evalData.groupStats;
        evaluatedQuestions = evalData.questions;
      }
    } catch (e) {
      console.warn("Failed to evaluate assessment on backend. Performing fallback client evaluation.", e);
      evaluatedQuestions.forEach((q, idx) => {
        const userAns = activeSession.userAnswers[idx];
        let isCorrect = false;
        const grpId = q.groupId || "official";
        if (!groupStats[grpId]) {
          groupStats[grpId] = { groupId: grpId, groupTitle: q.groupTitle || grpId, total: 0, correct: 0, wrong: 0 };
        }
        groupStats[grpId].total++;
        
        if (q.type === "mcq_multi") {
          const expectedIndices = (q.correctAnswerIndices || []).slice().sort();
          const userIndices = Array.isArray(userAns) ? userAns.slice().sort() : [];
          isCorrect = expectedIndices.length > 0 && expectedIndices.length === userIndices.length && expectedIndices.every((v, i) => v === userIndices[i]);
        } else if (q.type === "mcq" || (q.options && q.options.length && q.correctAnswerIndex !== null)) {
          isCorrect = userAns === q.correctAnswerIndex;
        } else if (q.type === "fill_blank") {
          const expected = (q.correctAnswers ? q.correctAnswers[0] : q.correctAnswerText || "").trim().toLowerCase();
          const actual = typeof userAns === "string" ? userAns.trim().toLowerCase() : "";
          isCorrect = expected.length > 0 && expected === actual;
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
      Object.keys(groupStats).forEach((gId) => {
        const g = groupStats[gId];
        g.percentage = g.total > 0 ? formatScoreNum((g.correct / g.total) * 100) : 0;
      });
      percentage = asm.totalQuestions > 0 ? formatScoreNum((correctCount / asm.totalQuestions) * 100) : 0;
    }

    asm.status = "completed";
    asm.questions = evaluatedQuestions;
    asm.userAnswers = activeSession.userAnswers;
    asm.correctCount = correctCount;
    asm.wrongCount = wrongCount;
    asm.percentage = percentage;
    asm.groupStats = groupStats;
    asm.completedAt = Date.now();

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
    LQ.renderAssessmentResultScreen();
  };

  LQ.renderAssessmentResultScreen = async function () {
    const id = sessionStorage.getItem("currentAssessmentId");
    if (!id) return;

    const titleEl = document.getElementById("asm-res-title");
    const scorePctEl = document.getElementById("asm-res-pct");
    const scoreCountsEl = document.getElementById("asm-res-counts");
    const groupStatsEl = document.getElementById("asm-res-group-stats");
    const questionsListEl = document.getElementById("asm-res-q-list");

    // Clear previous view display states
    if (scorePctEl) scorePctEl.style.display = "flex";
    if (groupStatsEl) groupStatsEl.style.display = "block";
    if (scoreCountsEl) scoreCountsEl.style.display = "block";

    // 1. Try to fetch official database test results
    let isOfficialResult = false;
    let testResult = null;

    // Fetch official database test results directly from server to reflect latest admin configurations
    if (true) {
      try {
        const res = await fetch("/api/student/tests/" + id + "/session", { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          if (data.ok && data.attempt && data.attempt.status === 'completed') {
            const testRes = await fetch("/api/student/tests/" + id, { credentials: "include" });
            const testData = await testRes.json();
            if (testData.ok && testData.test) {
              const test = testData.test;
              
              const secNames = [];
              (test.sections || []).forEach(sec => {
                (sec.questions || []).forEach(() => {
                  secNames.push(sec.name);
                });
              });

              testResult = {
                ok: true,
                showResult: test.showResult,
                showAnswer: test.showAnswer,
                percentage: data.attempt.percentage,
                correctCount: data.attempt.correctCount,
                wrongCount: data.attempt.wrongCount,
                totalQuestions: data.attempt.totalQuestions,
                questions: (data.attempt.questions || []).map((eq, qIdx) => {
                  return {
                    ...eq,
                    groupTitle: eq.groupTitle || secNames[qIdx] || "Section"
                  };
                })
              };
              
              if (test.showResult && !test.showAnswer) {
                testResult.questions = testResult.questions.map(function(eq){
                  return {
                    questionId: eq.questionId,
                    questionText: eq.questionText,
                    type: eq.type,
                    options: eq.options,
                    userAnswer: eq.userAnswer,
                    groupTitle: eq.groupTitle
                  };
                });
              }
              isOfficialResult = true;
            }
          }
        }
      } catch (err) {
        console.warn(err);
      }
    }

    if (isOfficialResult && testResult) {
      if (titleEl) titleEl.textContent = "Test Results";
      
      if (!testResult.showResult) {
        if (scorePctEl) scorePctEl.style.display = "none";
        if (groupStatsEl) groupStatsEl.style.display = "none";
        if (scoreCountsEl) {
          scoreCountsEl.innerHTML = `
            <div style="background:#f0fdf4;border:1px solid #bbf7d0;color:#166534;border-radius:12px;padding:24px;text-align:center;font-size:15px;line-height:1.6;margin-top:20px;">
              <span style="font-size:36px;">✓</span>
              <h3 style="margin:10px 0 6px;">Test Submitted Successfully</h3>
              <p style="margin:0;color:#1e293b;">Your answers have been graded. Results will be available shortly.</p>
            </div>
          `;
        }
        if (questionsListEl) {
          questionsListEl.innerHTML = "";
        }
        return;
      }

      // Draw Result Circle
      const pctNum = formatScoreNum(testResult.percentage);
      if (scorePctEl) {
        scorePctEl.textContent = pctNum + "%";
        scorePctEl.className = "asm-res-pct-circle " + (pctNum > 60 ? "circle-green" : pctNum > 30 ? "circle-amber" : "circle-coral");
      }

      if (scoreCountsEl) {
        scoreCountsEl.innerHTML = `
          <div class="asm-res-stats-wrap">
            <div class="asm-res-stat-chips">
              <span class="asm-stat-chip chip-correct">✓ ${testResult.correctCount} Correct</span>
              <span class="asm-stat-chip chip-wrong">✕ ${testResult.wrongCount} Wrong</span>
              <span class="asm-stat-chip chip-total">❓ ${testResult.totalQuestions} Total</span>
            </div>
          </div>
        `;
      }

      // Calculate and display section details
      if (groupStatsEl) {
        groupStatsEl.style.display = "block";
        const sectionScores = {};
        (testResult.questions || []).forEach(q => {
          const secName = q.groupTitle || "Section";
          if (!sectionScores[secName]) {
            sectionScores[secName] = { name: secName, total: 0, correct: 0 };
          }
          sectionScores[secName].total++;
          if (q.isCorrect) {
            sectionScores[secName].correct++;
          }
        });
        const sections = Object.values(sectionScores);
        groupStatsEl.innerHTML =
          "<h3>📊 Performance by Section</h3>" +
          sections
            .map((s) => {
              const percentage = s.total > 0 ? formatScoreNum((s.correct / s.total) * 100) : 0;
              const color =
                percentage > 60
                  ? "#22c55e"
                  : percentage > 30
                  ? "#f59e0b"
                  : "#ef4444";
              return (
                '<div class="asm-grp-stat-item">' +
                '<div class="asm-grp-stat-head">' +
                "<strong>" +
                LQ.esc(s.name) +
                "</strong>" +
                "<span>" +
                s.correct +
                "/" +
                s.total +
                " (" +
                percentage +
                "%)</span>" +
                "</div>" +
                '<div class="asm-grp-stat-bar"><div class="asm-grp-stat-fill" style="width:' +
                percentage +
                "%;background:" +
                color +
                '"></div></div>' +
                "</div>"
              );
            })
            .join("");
      }

      if (questionsListEl && testResult.questions) {
        // Group questions by section name
        const grouped = {};
        testResult.questions.forEach((q, i) => {
          const secName = q.groupTitle || "Section";
          if (!grouped[secName]) grouped[secName] = [];
          grouped[secName].push({ question: q, originalIndex: i });
        });

        let listHtml = "<h3>📝 Detailed Question Review</h3>";
        
        Object.keys(grouped).forEach(secName => {
          const qs = grouped[secName];
          listHtml += `
            <div class="asm-res-section-group" style="margin-top:20px;margin-bottom:16px;">
              <h4 style="font-size:14px;color:#1e3a8a;border-bottom:2px solid #eff6ff;padding-bottom:6px;margin:0 0 12px 0;">📂 ${LQ.esc(secName)}</h4>
              <div style="display:flex;flex-direction:column;gap:12px;">
          `;
          
          qs.forEach(({ question, originalIndex }) => {
            let ansStr = "";
            const showAns = testResult.showAnswer;
            const q = question;
            const i = originalIndex;
            
            if (q.type === 'passage') {
              let subHtml = "";
              (q.subQuestions || []).forEach((sq, sqIdx) => {
                let sqAnsStr = "";
                if (sq.options && sq.options.length) {
                  const userOpt = (sq.userAnswer !== undefined && sq.userAnswer !== null) ? sq.options[sq.userAnswer] : "Not answered";
                  const correctOpt = sq.options[sq.correctAnswerIndex] || sq.correctAnswer || "—";
                  sqAnsStr = `
                    <p class="asm-res-ans" style="margin:4px 0 0 0;font-size:12px;"><strong>Your choice:</strong> ${LQ.esc(userOpt)}</p>
                    ${(showAns && !sq.isCorrect) ? `<p class="asm-res-ans correct" style="margin:2px 0 0 0;font-size:12px;color:#16a34a;background:none;padding:0;"><strong>Correct choice:</strong> ${LQ.esc(correctOpt)}</p>` : ""}
                  `;
                } else {
                  sqAnsStr = `
                    <p class="asm-res-ans" style="margin:4px 0 0 0;font-size:12px;"><strong>Your answer:</strong> ${LQ.esc(sq.userAnswer || "Not answered")}</p>
                    ${(showAns && !sq.isCorrect) ? `<p class="asm-res-ans correct" style="margin:2px 0 0 0;font-size:12px;color:#16a34a;background:none;padding:0;"><strong>Correct answer:</strong> ${LQ.esc(sq.correctAnswer || "—")}</p>` : ""}
                  `;
                }
                const sqBadge = showAns ? (sq.isCorrect ? "<span style='color:#16a34a;font-weight:700;'>✓ Correct</span>" : "<span style='color:#dc2626;font-weight:700;'>✕ Incorrect</span>") : "<span style='color:#4b5563;'>Graded</span>";
                
                subHtml += `
                  <div style="background:#f8fafc;padding:10px 14px;border-radius:8px;border:1px solid #e2e8f0;margin-top:8px;">
                    <div style="display:flex;justify-content:space-between;align-items:center;font-size:13px;font-weight:600;color:#475569;gap:12px;">
                      <span>Q${originalIndex + 1}.${sqIdx + 1} ${LQ.esc(sq.questionText || sq.text)}</span>
                      <span>${sqBadge}</span>
                    </div>
                    ${sqAnsStr}
                  </div>
                `;
              });
              
              ansStr = `
                <div style="margin-top:8px;display:flex;flex-direction:column;gap:4px;">
                  ${subHtml}
                </div>
              `;
            } else if (q.options && q.options.length) {
              const userOpt = (q.userAnswer !== undefined && q.userAnswer !== null) ? q.options[q.userAnswer] : "Not answered";
              const correctOpt = q.options[q.correctAnswerIndex] || q.correctAnswer || "—";
              ansStr = `
                <p class="asm-res-ans"><strong>Your choice:</strong> ${LQ.esc(userOpt)}</p>
                ${(showAns && !q.isCorrect) ? `<p class="asm-res-ans correct"><strong>Correct choice:</strong> ${LQ.esc(correctOpt)}</p>` : ""}
              `;
            } else {
              ansStr = `<p class="asm-res-ans"><strong>Your answer:</strong> ${LQ.esc(q.userAnswer || "Not answered")}</p>`;
            }

            const cardClass = showAns ? (q.isCorrect ? "ok" : "wrong") : "neutral";
            const badgeClass = showAns ? (q.isCorrect ? "ok" : "wrong") : "neutral";
            const badgeText = showAns ? (q.isCorrect ? "✓ Correct" : "✕ Incorrect") : "Graded";

            listHtml += `
              <div class="asm-res-q-item ${cardClass}" style="${!showAns ? 'border-left: 4px solid #cbd5e1;' : ''}">
                <div class="asm-res-q-head">
                  <span class="asm-res-q-num">Q${i + 1}</span>
                  <span class="asm-res-q-badge ${badgeClass}">${badgeText}</span>
                </div>
                <p class="asm-res-q-text">${LQ.esc(q.questionText || q.text)}</p>
                ${ansStr}
                ${(showAns && q.explanation) ? `<p class="asm-res-explanation" style="margin-top:8px;font-size:12px;color:#475569;background:#f1f5f9;padding:8px 12px;border-radius:6px;"><strong>Explanation:</strong> ${LQ.esc(q.explanation)}</p>` : ""}
              </div>
            `;
          });
          
          listHtml += `
              </div>
            </div>
          `;
        });

        questionsListEl.innerHTML = listHtml;
      }
      return;
    }

    // 2. Fallback to practice assessment (IndexDB)
    const asm = await LQ.AssessmentDB.getAssessment(id);
    if (!asm) {
      LQ.toast("Assessment results not found");
      return;
    }

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
              ansStr =
                '<p class="asm-res-ans"><strong>Your answer:</strong> ' +
                LQ.esc(q.userAnswer || "(Empty)") +
                "</p>";
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

  let proctoringActive = false;
  let currentViolationCount = 0;

  LQ.startTestDirect = async function () {
    const testId = pendingOfficialTestId;
    if (!testId) return;

    LQ.closeTestInstructionModal();

    // 1. Request Fullscreen Mode
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
    } catch (err) {
      console.warn("Fullscreen request denied", err);
    }

    try {
      // 2. Call Start API
      const res = await fetch("/api/student/tests/" + testId + "/start", {
        method: "POST",
        credentials: "include"
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        LQ.toast(data.error || "Failed to initialize test session.");
        if (document.exitFullscreen) document.exitFullscreen().catch(()=>{});
        return;
      }

      var test = (fetchedOfficialTests || []).find(t => String(t.id) === String(testId));
      if (!test) {
        LQ.toast("Test context not found.");
        return;
      }

      // Initialize Proctoring
      LQ.initTestProctoring(testId, test.malpracticeLimit || 3);

      // Start Official test session
      let candidate = { email: LQ.Store.getState().user.email, name: LQ.Store.getState().user.name };
      LQ.startOfficialTestSession(testId, candidate);

    } catch (err) {
      console.error(err);
      LQ.toast("Network error starting test.");
    }
  };

  LQ.initTestProctoring = function (testId, limit) {
    if (proctoringActive) return;
    proctoringActive = true;
    currentViolationCount = 0;

    // Fetch active session state to sync starting malpracticeCount
    fetch("/api/student/tests/" + testId + "/session", { credentials: "include" })
      .then(res => res.json())
      .then(data => {
        if (data.ok && data.attempt) {
          currentViolationCount = data.attempt.malpracticeCount || 0;
        }
      }).catch(()=>{});

    LQ._proctorViolationHandler = async function () {
      if (!proctoringActive) return;
      
      try {
        const res = await fetch("/api/student/tests/" + testId + "/malpractice", {
          method: "POST",
          credentials: "include"
        });
        const data = await res.json();
        if (data.ok) {
          currentViolationCount = data.malpracticeCount;
          
          if (data.limitReached) {
            LQ.toast("🚨 Malpractice threshold exceeded! Auto-submitting...", true);
            LQ.submitAssessmentSession();
            return;
          }
          
          alert("⚠️ Proctor Warning: You have exited the test screen or switched tabs. Violation logged: " + currentViolationCount + " of " + limit + ". Exceeding the limit will auto-submit your test!");
          
          if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
            document.documentElement.requestFullscreen().catch(()=>{});
          }
        }
      } catch (e) {
        console.warn("Failed to report proctoring violation", e);
      }
    };

    window.addEventListener("blur", LQ._proctorViolationHandler);
    
    LQ._visibilityHandler = function () {
      if (document.visibilityState === 'hidden') {
        LQ._proctorViolationHandler();
      }
    };
    document.addEventListener("visibilitychange", LQ._visibilityHandler);

    LQ._fullscreenExitHandler = function () {
      if (!document.fullscreenElement && proctoringActive) {
        const modal = document.getElementById("asm-fullscreen-warning-modal");
        if (modal) {
          modal.classList.remove("hidden");
          modal.style.display = "flex";
        }
      }
    };
    document.addEventListener("fullscreenchange", LQ._fullscreenExitHandler);
  };

  LQ.clearTestProctoring = function () {
    if (!proctoringActive) return;
    proctoringActive = false;
    
    const modal = document.getElementById("asm-fullscreen-warning-modal");
    if (modal) {
      modal.classList.add("hidden");
      modal.style.display = "none";
    }

    if (LQ._proctorViolationHandler) {
      window.removeEventListener("blur", LQ._proctorViolationHandler);
    }
    if (LQ._visibilityHandler) {
      document.removeEventListener("visibilitychange", LQ._visibilityHandler);
    }
    if (LQ._fullscreenExitHandler) {
      document.removeEventListener("fullscreenchange", LQ._fullscreenExitHandler);
    }
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(()=>{});
    }
  };

  LQ.reEnterFullscreen = function () {
    const docEl = document.documentElement;
    if (docEl.requestFullscreen) {
      docEl.requestFullscreen().then(() => {
        const modal = document.getElementById("asm-fullscreen-warning-modal");
        if (modal) {
          modal.classList.add("hidden");
          modal.style.display = "none";
        }
      }).catch(err => {
        console.warn("Failed to enter fullscreen", err);
      });
    }
  };

  LQ.playQuestionAudio = function (qId, text) {
    let playLimit = 2;
    let playedCount = parseInt(sessionStorage.getItem(`played_${qId}`) || "0");
    if (playedCount >= playLimit) {
      LQ.toast("⚠️ Playback limit reached for this audio.");
      return;
    }

    playedCount++;
    sessionStorage.setItem(`played_${qId}`, playedCount);
    
    // Update play button text count
    const btn = document.getElementById("btn-play-audio");
    if (btn) {
      btn.innerHTML = `<span>🔊 Playing...</span> <span style="font-size:11px;background:rgba(255,255,255,0.2);padding:2px 6px;border-radius:4px;">Remaining: ${playLimit - playedCount}</span>`;
      btn.disabled = true;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.onend = function () {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `<span>🔊 Play Audio</span> <span style="font-size:11px;background:rgba(255,255,255,0.2);padding:2px 6px;border-radius:4px;">Remaining: ${playLimit - playedCount}</span>`;
      }
    };
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  };

  LQ.checkSpeechSupport = function () {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const fallback = document.getElementById("speech-fallback-msg");
    const txtArea = document.getElementById("asm-text-ans");
    if (!SpeechRecognition) {
      if (fallback) fallback.classList.remove("hidden");
      if (txtArea) txtArea.removeAttribute("readonly");
    }
  };

  LQ.toggleSpeechRecognition = function () {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      LQ.toast("Speech recognition is not supported in this browser.");
      return;
    }

    const txtArea = document.getElementById("asm-text-ans");
    const micBtn = document.getElementById("btn-mic-toggle");
    const micAnim = document.getElementById("mic-animation");

    if (isRecordingAudio) {
      // Stop
      if (speechRecognitionObj) speechRecognitionObj.stop();
      isRecordingAudio = false;
      if (micBtn) micBtn.textContent = "🎤 Start Recording";
      if (micAnim) micAnim.classList.add("hidden");
    } else {
      // Start
      isRecordingAudio = true;
      if (micBtn) micBtn.textContent = "⏹️ Stop Recording";
      if (micAnim) micAnim.classList.remove("hidden");

      speechRecognitionObj = new SpeechRecognition();
      speechRecognitionObj.lang = 'en-US';
      speechRecognitionObj.continuous = true;
      speechRecognitionObj.interimResults = false;

      speechRecognitionObj.onresult = function (event) {
        const transcript = event.results[event.results.length - 1][0].transcript;
        if (txtArea) {
          txtArea.value = (txtArea.value + " " + transcript).trim();
          if (activeSession) {
            activeSession.userAnswers[activeSession.currentIndex] = txtArea.value;
          }
        }
      };

      speechRecognitionObj.onerror = function (e) {
        console.warn("Speech recognition error:", e);
        LQ.toast("Microphone error or speech not detected.");
        isRecordingAudio = false;
        if (micBtn) micBtn.textContent = "🎤 Start Recording";
        if (micAnim) micAnim.classList.add("hidden");
      };

      speechRecognitionObj.onend = function () {
        isRecordingAudio = false;
        if (micBtn) micBtn.textContent = "🎤 Start Recording";
        if (micAnim) micAnim.classList.add("hidden");
      };

      speechRecognitionObj.start();
    }
  };

  LQ.submitSessionQuestion = async function (isAutoSubmit = false) {
    if (!activeSession) return;
    
    // Stop recording if active
    if (isRecordingAudio && speechRecognitionObj) {
      speechRecognitionObj.stop();
      isRecordingAudio = false;
    }

    LQ.showLoader();

    // 1. Gather answer from inputs
    const idx = activeSession.currentIndex;
    const asm = activeSession.assessment;
    const q = asm.questions[idx];

    const textInp = document.getElementById("asm-text-ans");
    if (textInp && q.type !== 'fill_blank' && q.type !== 'fib' && q.type !== 'passage') {
      activeSession.userAnswers[idx] = textInp.value;
    }

    // 2. Call Save Progress to Sync current answer and index to MongoDB Server
    try {
      await fetch("/api/assessment/save-progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          assessmentId: asm.id,
          userAnswers: activeSession.userAnswers,
          currentIndex: idx
        })
      });
    } catch (err) {
      console.warn("Failed to sync progress on submit", err);
      if (!isAutoSubmit) {
        LQ.toast("Network error submitting answer. Please retry.");
        LQ.hideLoader();
        return;
      }
    }

    // 3. Move to next question or submit final
    try {
      if (idx < asm.totalQuestions - 1) {
        if (LQ._asmTimerId) {
          clearInterval(LQ._asmTimerId);
          LQ._asmTimerId = null;
        }
        activeSession.currentIndex = idx + 1;
        LQ.renderSessionQuestion();
        LQ.startSessionTimer();
      } else {
        // Last question of last section: Submit final assessment
        await LQ.submitAssessmentSession();
      }
    } catch (err) {
      console.error("Transition to next question failed:", err);
    } finally {
      LQ.hideLoader();
    }
  };

  LQ.resetAssessmentState = function () {
    activeSession = null;
    if (LQ._asmTimerId) {
      clearInterval(LQ._asmTimerId);
      LQ._asmTimerId = null;
    }
    try {
      sessionStorage.removeItem("currentAssessmentId");
      sessionStorage.removeItem("lastTestResult");
    } catch (e) {}
  };

  LQ.saveInlineBlankAnswer = function (blankIdx, value) {
    if (!activeSession) return;
    const qIdx = activeSession.currentIndex;
    let ansArr = activeSession.userAnswers[qIdx];
    if (!Array.isArray(ansArr)) {
      ansArr = [];
    }
    ansArr[blankIdx] = value;
    activeSession.userAnswers[qIdx] = ansArr;
    syncLiveProgress();
  };

  LQ.selectPassageSubAnswer = function (qIdx, sqIdx, oIdx) {
    if (!activeSession) return;
    if (!activeSession.userAnswers[qIdx]) activeSession.userAnswers[qIdx] = {};
    activeSession.userAnswers[qIdx][sqIdx] = oIdx;
    
    // Rerender question immediately to highlight selection
    LQ.renderSessionQuestion();
    syncLiveProgress();
  };

  LQ.savePassageSubTextAnswer = function (qIdx, sqIdx, value) {
    if (!activeSession) return;
    if (!activeSession.userAnswers[qIdx]) activeSession.userAnswers[qIdx] = {};
    activeSession.userAnswers[qIdx][sqIdx] = value;
    syncLiveProgress();
  };

  LQ.savePassageSubFibAnswer = function (qIdx, sqIdx, blankIdx, value) {
    if (!activeSession) return;
    if (!activeSession.userAnswers[qIdx]) activeSession.userAnswers[qIdx] = {};
    let sqAns = activeSession.userAnswers[qIdx][sqIdx];
    if (!Array.isArray(sqAns)) {
      sqAns = [];
    }
    sqAns[blankIdx] = value;
    activeSession.userAnswers[qIdx][sqIdx] = sqAns;
    syncLiveProgress();
  };

  LQ.toggleAsmSidebar = function () {
    const sidebar = document.getElementById("asm-tracker-sidebar");
    if (sidebar) {
      if (sidebar.classList.contains("hidden")) {
        sidebar.classList.remove("hidden");
        sidebar.style.display = "flex";
        LQ.renderAsmSidebarContent();
      } else {
        sidebar.classList.add("hidden");
        sidebar.style.display = "none";
      }
    }
  };

  LQ.renderAsmSidebarContent = function () {
    if (!activeSession) return;
    const asm = activeSession.assessment;
    const currentQIdx = activeSession.currentIndex;
    const currentQ = asm.questions[currentQIdx];
    const currentSecIdx = currentQ ? currentQ.sectionIndex : 0;

    const sidebar = document.getElementById("asm-tracker-sidebar");
    if (!sidebar) return;

    // Group questions by sectionIndex
    const sectionsMap = {};
    (asm.questions || []).forEach((q, qIdx) => {
      const secIdx = q.sectionIndex !== undefined ? q.sectionIndex : 0;
      const secName = q.groupTitle || `Section ${secIdx + 1}`;
      if (!sectionsMap[secIdx]) {
        sectionsMap[secIdx] = {
          name: secName,
          questions: [],
          answeredCount: 0
        };
      }
      const isAnswered = activeSession.userAnswers[qIdx] !== undefined && activeSession.userAnswers[qIdx] !== null && activeSession.userAnswers[qIdx] !== "";
      sectionsMap[secIdx].questions.push({
        index: qIdx,
        isAnswered: isAnswered,
        isActive: qIdx === currentQIdx
      });
      if (isAnswered) {
        sectionsMap[secIdx].answeredCount++;
      }
    });

    const sections = Object.keys(sectionsMap).sort((a, b) => Number(a) - Number(b));

    let html = `
      <h3 style="margin-top:0;font-size:15px;color:#1e3a8a;border-bottom:2px solid #e2e8f0;padding-bottom:8px;display:flex;justify-content:space-between;align-items:center;">
        <span>📋 Test Navigator</span>
        <button type="button" onclick="LQ.toggleAsmSidebar()" style="background:none;border:none;color:#64748b;font-size:16px;cursor:pointer;">✕</button>
      </h3>
      <div style="display:flex;flex-direction:column;gap:16px;margin-top:12px;">
    `;

    sections.forEach(secIdx => {
      const sec = sectionsMap[secIdx];
      const isActiveSection = Number(secIdx) === currentSecIdx;
      const secStyle = isActiveSection ? 'background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:10px;' : 'padding:4px;';
      
      html += `
        <div style="${secStyle}">
          <div style="font-weight:700;font-size:13px;display:flex;justify-content:space-between;color:${isActiveSection ? '#1e40af' : '#475569'};">
            <span>${LQ.esc(sec.name)}</span>
            <span style="font-size:11px;font-weight:600;background:#e2e8f0;padding:2px 6px;border-radius:4px;color:#334155;">${sec.answeredCount}/${sec.questions.length} Ans</span>
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;">
      `;

      sec.questions.forEach(qItem => {
        let bg = "#f1f5f9";
        let color = "#475569";
        let border = "1px solid #cbd5e1";

        if (qItem.isActive) {
          bg = "#2563eb";
          color = "#ffffff";
          border = "1px solid #2563eb";
        } else if (qItem.isAnswered) {
          bg = "#dcfce7";
          color = "#15803d";
          border = "1px solid #bbf7d0";
        }

        html += `
          <div style="width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;background:${bg};color:${color};border:${border};cursor:default;" title="Question ${qItem.index + 1}">
            ${qItem.index + 1}
          </div>
        `;
      });

      html += `
          </div>
        </div>
      `;
    });

    html += `</div>`;
    sidebar.innerHTML = html;
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
