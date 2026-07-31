window.LQ = window.LQ || {};

(function () {
  let activeTab = "practice";
  let activeFilter = "new";
  let activeSession = null;
  let timerInterval = null;
  let testPage = 1;
  let testSearch = "";
  let micPermissionGranted = false;
  let permissionPromptActive = false;

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

    // Show permission section if test has audio/mic question types
    const permSection = document.getElementById("inst-permission-section");
    if (permSection && test.questions) {
      const audioTypes = ['listening', 'listen_repeat', 'audio', 'passage', 'jumbled_sentence', 'story_retelling', 'reading_listening'];
      const hasAudioQ = test.questions.some(q => audioTypes.includes(q.type));
      permSection.style.display = hasAudioQ ? 'block' : 'none';
      const statusEl = document.getElementById("inst-permission-status");
      if (statusEl) statusEl.innerHTML = micPermissionGranted ? '✅ Permissions granted' : '⚠️ Not yet granted';
      if (statusEl) statusEl.style.color = micPermissionGranted ? '#16a34a' : '#92400e';
    }

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

    const actualTestId = test.id || test._id;

    if (test.sections && test.sections.length) {
      var flatQuestions = [];
      test.sections.forEach(function (sec, secIdx) {
        (sec.questions || []).forEach(function (q) {
          const subQs = (q.subQuestions || []).map(sq => {
            return {
              ...sq,
              correctAnswerIndex: sq.options ? getCorrectOptionIndex(sq.correctAnswer, sq.options) : null
            };
          });

          flatQuestions.push({
            id: q.questionId || q._id,
            text: q.questionText,
            type: q.type,
            mcqType: q.mcqType,
            options: q.options,
            correctAnswerIndex: q.options ? getCorrectOptionIndex(q.correctAnswer, q.options) : null,
            correctAnswerText: q.correctAnswer || "",
            groupTitle: sec.name,
            sectionIndex: secIdx,
            duration: q.duration !== undefined ? q.duration : 1,
            durationType: q.durationType || "minutes",
            subQuestions: subQs,
            playLimit: q.playLimit || 1,
            marks: q.marks || 1
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
      const res = await fetch("/api/student/tests/" + actualTestId + "/session", { credentials: "include" });
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
          mcqType: q.mcqType || "single",
          groupTitle: q.groupTitle || test.title,
          options:
            q.options || (q.type === "true_false" ? ["True", "False"] : []),
          correctAnswerIndex:
            q.correctAnswerIndex !== undefined ? q.correctAnswerIndex : null,
          correctAnswerText: q.correctAnswerText || "",
          sectionIndex: q.sectionIndex !== undefined ? q.sectionIndex : 0,
          duration: q.duration !== undefined ? q.duration : 1,
          durationType: q.durationType || "minutes",
          subQuestions: q.subQuestions || [],
          playLimit: q.playLimit || 1,
          marks: q.marks || 1
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

  let _syncProgressTimer = null;
  function debouncedSyncLiveProgress(delayMs) {
    if (_syncProgressTimer) clearTimeout(_syncProgressTimer);
    _syncProgressTimer = setTimeout(() => {
      _syncProgressTimer = null;
      syncLiveProgress();
    }, delayMs || 600);
  }

  async function syncLiveProgress() {
    if (_syncProgressTimer) {
      clearTimeout(_syncProgressTimer);
      _syncProgressTimer = null;
    }
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
          correctAnswerIndex = getCorrectOptionIndex(q.correctAnswer, q.options);
          if (correctAnswerIndex === -1) correctAnswerIndex = 0;
        } else if (q.type === "mcq_multi") {
          const answers = q.correctAnswer.split(",").map(s => s.trim());
          correctAnswerIndices = answers.map(ans => getCorrectOptionIndex(ans, q.options)).filter(i => i >= 0);
        }

        return {
          ...q,
          id: "q_" + idx,
          dbId: q._id,
          groupId: q.groupId,
          groupTitle: q.groupId,
          text: q.title,
          type: q.type === "fib" ? "fill_blank" : q.type === "mcq_multi" ? "mcq_multi" : "mcq",
          options: q.options && q.options.length ? q.options : null,
          correctAnswerIndex: correctAnswerIndex,
          correctAnswerIndices: correctAnswerIndices,
          correctAnswers: q.type === "fib" ? (q.correctAnswers || [q.correctAnswer]) : null,
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

    LQ.clearTestProctoring(); // Make sure any previous proctoring state is cleared

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
      const qTimerWrap = document.getElementById("asm-question-timer-wrap");
      const sTimerWrap = document.getElementById("asm-section-timer-wrap");
      const practiceTimerWrap = document.getElementById("asm-practice-timer-wrap");
      const practiceTimerEl = document.getElementById("asm-practice-timer");

      if (activeSession.isOfficial) {
        // Show official timers, hide practice timer
        if (qTimerWrap) qTimerWrap.style.display = "inline-flex";
        if (sTimerWrap) sTimerWrap.style.display = "inline-flex";
        if (practiceTimerWrap) practiceTimerWrap.style.display = "none";
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
        // Practice Mode
        // Hide official timers
        if (qTimerWrap) qTimerWrap.style.display = "none";
        if (sTimerWrap) sTimerWrap.style.display = "none";
        if (legacyTimerEl) legacyTimerEl.style.display = "none";

        if (!activeSession.durationSeconds && activeSession.assessment && activeSession.assessment.durationMinutes) {
          activeSession.durationSeconds = activeSession.assessment.durationMinutes * 60;
        }

        if (!activeSession.durationSeconds) {
          if (practiceTimerWrap) practiceTimerWrap.style.display = "none";
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
          if (practiceTimerEl) {
            practiceTimerEl.textContent = "0:00";
            practiceTimerEl.style.color = "#ef4444";
          }
          LQ.toast("⏱️ Time is up! Auto-submitting practice...", true);
          LQ.submitAssessmentSession();
          return;
        }

        const m = Math.floor(rem / 60);
        const s = rem % 60;
        if (practiceTimerWrap) {
          practiceTimerWrap.style.display = "inline-flex";
        }
        if (practiceTimerEl) {
          practiceTimerEl.textContent = `${m}:${s < 10 ? "0" : ""}${s}`;
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

  let isRecordingAudio = false;
  let speechRecognitionObj = null;
  let timerSecondsElapsed = 0;

  // Helper: resolve correct option index (handles A/B/C/D, text, or index)
  function getCorrectOptionIndex(correctAns, options) {
    if (!options || !options.length) return -1;
    var str = (correctAns !== undefined && correctAns !== null) ? String(correctAns).trim() : '';
    if (!str) return -1;
    var directIdx = options.indexOf(str);
    if (directIdx >= 0) return directIdx;
    
    var cleanStr = str;
    var match = str.match(/^([A-Za-z0-9]+)/);
    if (match) {
      cleanStr = match[1];
    }

    var upper = cleanStr.toUpperCase();
    if (upper.length === 1 && upper >= 'A' && upper <= 'Z') {
      var letterIdx = upper.charCodeAt(0) - 65;
      if (letterIdx >= 0 && letterIdx < options.length) return letterIdx;
    }
    var numIdx = parseInt(cleanStr, 10);
    if (!isNaN(numIdx) && numIdx >= 0 && numIdx < options.length) return numIdx;
    return -1;
  }

  // Helper: get question type display label & color
  function getQTypeBadge(qType) {
    const map = {
      'mcq': { label: 'MCQ', color: '#2563eb', bg: '#eff6ff' },
      'mcq_multi': { label: 'MCQ Multi', color: '#7c3aed', bg: '#f5f3ff' },
      'fib': { label: 'Fill in Blanks', color: '#d97706', bg: '#fffbeb' },
      'fill_blank': { label: 'Fill in Blanks', color: '#d97706', bg: '#fffbeb' },
      'passage': { label: 'Passage', color: '#059669', bg: '#ecfdf5' },
      'jumbled_sentence': { label: 'Jumbled Sentence', color: '#dc2626', bg: '#fef2f2' },
      'listen_repeat': { label: 'Listen & Repeat', color: '#0891b2', bg: '#ecfeff' },
      'reading_listening': { label: 'Read Aloud', color: '#4f46e5', bg: '#eef2ff' },
      'story_retelling': { label: 'Story Retelling', color: '#be185d', bg: '#fdf2f8' },
      'listening': { label: 'Listening', color: '#0891b2', bg: '#ecfeff' },
      'speaking': { label: 'Speaking', color: '#dc2626', bg: '#fef2f2' },
      'speak': { label: 'Speaking', color: '#dc2626', bg: '#fef2f2' }
    };
    return map[qType] || { label: qType || 'Question', color: '#475569', bg: '#f1f5f9' };
  }

  // Helper: shuffle words for jumbled sentence
  function shuffleWords(text) {
    const words = (text || '').split(/\s+/).filter(Boolean);
    for (let i = words.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = words[i]; words[i] = words[j]; words[j] = tmp;
    }
    return words.join(' ');
  }

  // Helper: get unique user + test prefix for storage isolation
  function getUserTestPrefix(testId) {
    const email = (activeSession && activeSession.candidate && activeSession.candidate.email)
      ? activeSession.candidate.email
      : (sessionStorage.getItem("userEmail") || localStorage.getItem("userEmail") || "user");
    const tId = testId || (activeSession && activeSession.assessment ? activeSession.assessment.id : "test");
    return (email + "_" + tId).toLowerCase();
  }

  // Helper: check if mic was already used for this question (scoped per user + test + question index)
  function isMicUsed(qId) {
    if (!activeSession) return false;
    const prefix = getUserTestPrefix(activeSession.assessment.id);
    const key = prefix + "_mic_used_" + activeSession.currentIndex;
    try { return sessionStorage.getItem(key) === '1'; } catch(e) { return false; }
  }
  function markMicUsed(qId) {
    if (!activeSession) return;
    const prefix = getUserTestPrefix(activeSession.assessment.id);
    const key = prefix + "_mic_used_" + activeSession.currentIndex;
    if (LQ.AssessmentDB && LQ.AssessmentDB.saveTempMedia) {
      LQ.AssessmentDB.saveTempMedia(key, prefix, true);
    }
    try { sessionStorage.setItem(key, '1'); } catch(e) {}
  }

  // Helper: get stored jumbled text for a question (scoped per user + test + question index)
  function getJumbledText(qKey, originalText) {
    const prefix = getUserTestPrefix();
    const key = prefix + "_jumbled_" + qKey;
    try {
      const stored = sessionStorage.getItem(key);
      if (stored) return stored;
      const jumbled = shuffleWords(originalText);
      if (LQ.AssessmentDB && LQ.AssessmentDB.saveTempMedia) {
        LQ.AssessmentDB.saveTempMedia(key, prefix, jumbled);
      }
      sessionStorage.setItem(key, jumbled);
      return jumbled;
    } catch(e) { return shuffleWords(originalText); }
  }

  // Helper: purge temporary media session data for user + test from IndexedDB & sessionStorage
  async function cleanupTempMediaSession(testId) {
    const email = sessionStorage.getItem("userEmail") || localStorage.getItem("userEmail") || "user";
    const tId = testId || (activeSession && activeSession.assessment ? activeSession.assessment.id : "");
    if (!tId) return;
    const prefix = (email + "_" + tId).toLowerCase();

    // 1. Purge from IndexedDB temp_media store
    if (LQ.AssessmentDB && LQ.AssessmentDB.deleteTempMediaForUserTest) {
      await LQ.AssessmentDB.deleteTempMediaForUserTest(prefix);
    }

    // 2. Purge matching keys from sessionStorage & localStorage
    try {
      [sessionStorage, localStorage].forEach(storage => {
        const keysToRemove = [];
        for (let i = 0; i < storage.length; i++) {
          const k = storage.key(i);
          if (k && k.toLowerCase().includes(prefix)) {
            keysToRemove.push(k);
          }
        }
        keysToRemove.forEach(k => storage.removeItem(k));
      });
    } catch(e) {}
  }

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
      if (activeSession.isOfficial) {
        trackerEl.textContent = `Section ${(q.sectionIndex || 0) + 1} · Q${idx + 1}/${asm.totalQuestions} · Attempted ${attemptedCount}/${asm.totalQuestions}`;
      } else {
        trackerEl.textContent = `Q${idx + 1}/${asm.totalQuestions} · Attempted ${attemptedCount}/${asm.totalQuestions}`;
      }
    }

    // Configure Navigation Buttons (Prev / Next / Finish)
    const prevBtn = document.getElementById("asm-btn-prev-question");
    const submitBtn = document.getElementById("asm-btn-submit-question");

    if (activeSession.isOfficial) {
      if (prevBtn) prevBtn.style.display = "none";
      if (submitBtn) {
        submitBtn.onclick = function() { LQ.submitSessionQuestion(); };
        if (idx === asm.totalQuestions - 1) {
          submitBtn.textContent = "Finish Test →";
        } else {
          submitBtn.textContent = "Submit Answer →";
        }
      }
    } else {
      if (prevBtn) {
        if (idx > 0) {
          prevBtn.style.display = "inline-block";
        } else {
          prevBtn.style.display = "none";
        }
      }
      if (submitBtn) {
        if (idx === asm.totalQuestions - 1) {
          submitBtn.textContent = "Finish Practice";
          submitBtn.onclick = function() { LQ.navSessionQuestion(1); };
        } else {
          submitBtn.textContent = "Next →";
          submitBtn.onclick = function() { LQ.navSessionQuestion(1); };
        }
      }
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
        
        const activeSec = q.sectionIndex || 0;
        if (activeSession.activeSectionIndexForTimer !== activeSec) {
          activeSession.activeSectionIndexForTimer = activeSec;
          const sectionQs = asm.questions.filter(qi => (qi.sectionIndex || 0) === activeSec);
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

    const currentAnswer = activeSession.userAnswers[idx];
    const qType = q.type || 'mcq';
    const badge = getQTypeBadge(qType);
    const marksLabel = q.marks ? `${q.marks} mark${q.marks > 1 ? 's' : ''}` : '';

    // Common header for question type badge + marks + question number
    const headerHtml = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;flex-wrap:wrap;">
        <span style="background:${badge.bg};color:${badge.color};font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;text-transform:uppercase;letter-spacing:0.5px;border:1px solid ${badge.color}20;">${badge.label}</span>
        <span style="font-size:12px;font-weight:700;color:#0f172a;background:#f1f5f9;padding:3px 10px;border-radius:20px;">Q${idx + 1} of ${asm.totalQuestions}</span>
        ${marksLabel ? `<span style="font-size:11px;font-weight:600;color:#64748b;margin-left:auto;">📊 ${marksLabel}</span>` : ''}
      </div>
    `;

    // Determine question type categories
    const isFib = qType === 'fill_blank' || qType === 'fib';
    const isPassage = qType === 'passage';
    const isJumbled = qType === 'jumbled_sentence';
    const isListenRepeat = qType === 'listen_repeat';
    const isReadAloud = qType === 'reading_listening';
    const isStoryRetelling = qType === 'story_retelling';
    const isAudioType = qType === 'listening' || qType === 'audio';
    const isSpeakType = qType === 'speak' || qType === 'speaking';
    const needsMic = isJumbled || isListenRepeat || isReadAloud || isStoryRetelling || isSpeakType;
    const needsAudio = isAudioType || isListenRepeat || isPassage || isStoryRetelling;

    let promptHtml = '';
    let workspaceHtml = '';

    // ═══════════════════════════════════════════
    // FIB — Full-width layout
    // ═══════════════════════════════════════════
    if (isFib) {
      let textWithInputs = q.text;
      let blankIdx = 0;
      const ansArr = Array.isArray(currentAnswer) ? currentAnswer : (typeof currentAnswer === 'string' ? [currentAnswer] : []);

      textWithInputs = textWithInputs.replace(/\$\{blank\}|_{3,}/g, function() {
        const val = ansArr[blankIdx] || '';
        const html = `<input type="text" class="asm-fib-input" data-blank-idx="${blankIdx}" value="${LQ.esc(val)}" oninput="LQ.saveInlineBlankAnswer(${blankIdx}, this.value)" style="border:none;border-bottom:2px solid #2563eb;outline:none;padding:4px 8px;font-size:15px;font-weight:700;color:#1e3a8a;width:140px;text-align:center;background:#eff6ff;border-radius:6px;margin:0 4px;transition:border-color 0.2s;" onfocus="this.style.borderColor='#1d4ed8'" onblur="this.style.borderColor='#2563eb'" />`;
        blankIdx++;
        return html;
      });

      if (blankIdx === 0) {
        const val = typeof currentAnswer === 'string' ? currentAnswer : (ansArr[0] || '');
        textWithInputs += ` <input type="text" class="asm-fib-input" data-blank-idx="0" value="${LQ.esc(val)}" oninput="LQ.saveInlineBlankAnswer(0, this.value)" style="border:none;border-bottom:2px solid #2563eb;outline:none;padding:4px 8px;font-size:15px;font-weight:700;color:#1e3a8a;width:160px;text-align:center;background:#eff6ff;border-radius:6px;margin:0 4px;" />`;
      }

      bodyEl.innerHTML = `
        <div style="width:100%;height:100%;padding:28px 32px;overflow-y:auto;background:linear-gradient(135deg,#fff 0%,#f8fafc 100%);line-height:2.4;font-size:16px;">
          ${headerHtml}
          <h3 style="margin:0;font-size:16px;color:#0f172a;line-height:2.4;font-weight:500;">${textWithInputs}</h3>
        </div>
      `;
      LQ.renderAsmSidebarContent();
      return;
    }

    // ═══════════════════════════════════════════
    // LEFT PANEL — Build prompt based on type
    // ═══════════════════════════════════════════
    const playLimit = q.playLimit || q.maxPlays || 1;
    const prefix = getUserTestPrefix(activeSession.assessment.id);
    const qKey = prefix + '_q_' + idx;
    const playKey = prefix + '_played_' + idx;

    let playedCount = 0;
    try {
      playedCount = parseInt(sessionStorage.getItem(playKey) || '0', 10);
    } catch(e) { playedCount = 0; }
    
    const playRemaining = Math.max(0, playLimit - playedCount);
    const playDisabled = playRemaining <= 0;

    if (isPassage) {
      // Passage: Audio playback for passage text
      promptHtml = `
        <div class="asm-split-left" style="align-items:flex-start;justify-content:flex-start;text-align:left;">
          ${headerHtml}
          <div style="font-size:48px;margin-bottom:12px;text-align:center;width:100%;">📖</div>
          <h3 style="margin:0 0 8px;font-size:17px;color:#0f172a;font-weight:700;width:100%;text-align:center;">Listen to the Passage</h3>
          <p style="color:#64748b;font-size:13px;margin-bottom:20px;text-align:center;width:100%;">Click play to listen to the passage audio. Answer the sub-questions on the right.</p>
          <div style="display:flex;justify-content:center;width:100%;">
            <button type="button" id="btn-play-audio" class="btn primary" onclick="LQ.playQuestionAudio('${qKey}', '${LQ.esc(q.text)}')" ${playDisabled ? 'disabled' : ''} style="background:${playDisabled ? '#94a3b8' : '#2563eb'};color:#fff;font-weight:600;padding:12px 28px;border-radius:10px;display:flex;align-items:center;gap:8px;border:none;cursor:${playDisabled ? 'not-allowed' : 'pointer'};font-size:14px;box-shadow:0 2px 8px rgba(37,99,235,0.25);transition:all 0.2s;">
              <span>🔊 Play Passage</span>
              <span style="font-size:11px;background:rgba(255,255,255,0.2);padding:2px 8px;border-radius:6px;">Plays left: ${playRemaining}</span>
            </button>
          </div>
        </div>
      `;
    } else if (isJumbled) {
      // Jumbled: Show scrambled words only, NOT the original text
      const jumbledText = getJumbledText(qKey, q.correctAnswerText || q.text);
      promptHtml = `
        <div class="asm-split-left" style="justify-content:flex-start;align-items:stretch;">
          ${headerHtml}
          <div style="font-size:40px;margin-bottom:12px;text-align:center;">🔀</div>
          <h3 style="margin:0 0 8px;font-size:15px;color:#0f172a;font-weight:700;text-align:center;">Rearrange & Speak</h3>
          <p style="color:#64748b;font-size:12px;text-align:center;margin-bottom:16px;">Rearrange the jumbled words below into the correct sentence, then record your answer.</p>
          <div style="background:#fffbeb;border:2px dashed #f59e0b;border-radius:12px;padding:20px;text-align:center;">
            <div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center;">
              ${jumbledText.split(/\s+/).map(w => `<span style="background:#fef3c7;color:#92400e;padding:6px 14px;border-radius:8px;font-weight:600;font-size:15px;border:1px solid #fde68a;">${LQ.esc(w)}</span>`).join('')}
            </div>
          </div>
        </div>
      `;
    } else if (isListenRepeat || isStoryRetelling) {
      // Listen & Repeat / Story Retelling: Audio on the left
      const audioText = q.correctAnswerText || q.text;
      promptHtml = `
        <div class="asm-split-left" style="align-items:flex-start;justify-content:flex-start;text-align:left;">
          ${headerHtml}
          <div style="font-size:48px;margin-bottom:12px;text-align:center;width:100%;">🎧</div>
          <h3 style="margin:0 0 8px;font-size:17px;color:#0f172a;font-weight:700;width:100%;text-align:center;">${isStoryRetelling ? 'Listen to the Story' : 'Listen Carefully'}</h3>
          <p style="color:#64748b;font-size:13px;margin-bottom:20px;text-align:center;width:100%;">${isStoryRetelling ? 'Listen to the story, then retell it in your own words.' : 'Listen to the audio, then repeat exactly what you heard.'}</p>
          <div style="display:flex;justify-content:center;width:100%;">
            <button type="button" id="btn-play-audio" class="btn primary" onclick="LQ.playQuestionAudio('${qKey}', '${LQ.esc(audioText)}')" ${playDisabled ? 'disabled' : ''} style="background:${playDisabled ? '#94a3b8' : '#0891b2'};color:#fff;font-weight:600;padding:12px 28px;border-radius:10px;display:flex;align-items:center;gap:8px;border:none;cursor:${playDisabled ? 'not-allowed' : 'pointer'};font-size:14px;box-shadow:0 2px 8px rgba(8,145,178,0.25);">
              <span>🔊 Play Audio</span>
              <span style="font-size:11px;background:rgba(255,255,255,0.2);padding:2px 8px;border-radius:6px;">Plays left: ${playRemaining}</span>
            </button>
          </div>
        </div>
      `;
    } else if (isReadAloud) {
      // Reading: Show text on left for student to read aloud
      promptHtml = `
        <div class="asm-split-left" style="justify-content:flex-start;align-items:stretch;">
          ${headerHtml}
          <div style="font-size:40px;margin-bottom:8px;text-align:center;">📖</div>
          <h3 style="margin:0 0 8px;font-size:15px;color:#0f172a;font-weight:700;text-align:center;">Read Aloud</h3>
          <p style="color:#64748b;font-size:12px;text-align:center;margin-bottom:16px;">Read the following text aloud and record your voice.</p>
          <div style="background:#eef2ff;border:1px solid #c7d2fe;border-radius:12px;padding:20px;font-size:16px;color:#1e293b;line-height:1.8;font-weight:500;">
            ${LQ.esc(q.text)}
          </div>
        </div>
      `;
    } else if (isAudioType) {
      // Generic Audio: Listen then answer
      promptHtml = `
        <div class="asm-split-left" style="align-items:flex-start;justify-content:flex-start;text-align:left;">
          ${headerHtml}
          <div style="font-size:48px;margin-bottom:12px;text-align:center;width:100%;">🎧</div>
          <h3 style="margin:0 0 8px;font-size:17px;color:#0f172a;font-weight:700;width:100%;text-align:center;">Listen Carefully</h3>
          <p style="color:#64748b;font-size:13px;margin-bottom:20px;text-align:center;width:100%;">Click play to listen to the audio passage.</p>
          <div style="display:flex;justify-content:center;width:100%;">
            <button type="button" id="btn-play-audio" class="btn primary" onclick="LQ.playQuestionAudio('${qKey}', '${LQ.esc(q.correctAnswerText || q.text)}')" ${playDisabled ? 'disabled' : ''} style="background:${playDisabled ? '#94a3b8' : '#2563eb'};color:#fff;font-weight:600;padding:12px 28px;border-radius:10px;display:flex;align-items:center;gap:8px;border:none;cursor:${playDisabled ? 'not-allowed' : 'pointer'};font-size:14px;box-shadow:0 2px 8px rgba(37,99,235,0.25);">
              <span>🔊 Play Audio</span>
              <span style="font-size:11px;background:rgba(255,255,255,0.2);padding:2px 8px;border-radius:6px;">Plays left: ${playRemaining}</span>
            </button>
          </div>
        </div>
      `;
    } else {
      // MCQ / Text: Show question text
      promptHtml = `
        <div class="asm-split-left" style="justify-content:flex-start;align-items:stretch;">
          ${headerHtml}
          <h3 style="margin:0;font-size:17px;color:#0f172a;line-height:1.6;font-weight:600;">${LQ.esc(q.text)}</h3>
        </div>
      `;
    }

    // ═══════════════════════════════════════════
    // RIGHT PANEL — Build workspace based on type
    // ═══════════════════════════════════════════
    const micAlreadyUsed = isMicUsed(q.id);

    if (needsMic) {
      // Mic-based question types: single attempt enforcement
      const micDisabled = micAlreadyUsed && !isRecordingAudio;
      const micBtnLabel = micAlreadyUsed ? '✅ Recording Complete' : (isRecordingAudio ? '⏹️ Stop Recording' : '🎤 Start Recording');
      const micBtnBg = micAlreadyUsed ? '#16a34a' : (isRecordingAudio ? '#dc2626' : '#2563eb');

      workspaceHtml = `
        <div class="asm-split-right" style="justify-content:center;align-items:stretch;width:100%;max-width:none;gap:14px;">
          <div style="font-size:12px;font-weight:700;color:${isRecordingAudio ? '#dc2626' : '#475569'};text-transform:uppercase;letter-spacing:0.5px;text-align:center;">
            ${isRecordingAudio ? '🔴 Recording in Progress...' : (micAlreadyUsed ? '✅ Recording Submitted' : '🎤 Record Your Response')}
          </div>
          
          <div style="display:flex;align-items:center;justify-content:center;margin:4px 0;">
            <div id="mic-animation" class="${isRecordingAudio ? '' : 'hidden'}" style="width:80px;height:80px;border-radius:50%;background:rgba(239,68,68,0.15);display:flex;align-items:center;justify-content:center;animation:pulse 1.5s infinite;">
              <span style="font-size:36px;">🎙️</span>
            </div>
          </div>
          
          <textarea id="asm-text-ans" class="inp" rows="4" readonly style="width:100%;background:#fff;border:1px solid ${micAlreadyUsed ? '#bbf7d0' : '#cbd5e1'};padding:14px;border-radius:10px;font-size:14px;resize:none;color:#1e293b;${micAlreadyUsed ? 'background:#f0fdf4;' : ''}" placeholder="Your spoken text will appear here...">${LQ.esc(typeof currentAnswer === 'string' ? currentAnswer : '')}</textarea>
          
          <button type="button" id="btn-mic-toggle" class="btn" onclick="LQ.toggleSpeechRecognition()" ${micDisabled ? 'disabled' : ''} style="background:${micBtnBg};color:#fff;font-weight:600;padding:12px 20px;border-radius:10px;border:none;width:100%;font-size:14px;cursor:${micDisabled ? 'not-allowed' : 'pointer'};opacity:${micDisabled ? '0.7' : '1'};transition:all 0.2s;">${micBtnLabel}</button>
          
          ${micAlreadyUsed ? '<div style="font-size:11px;color:#16a34a;text-align:center;font-weight:600;">✅ Recording submitted. Only one attempt is allowed per question.</div>' : '<div style="font-size:11px;color:#94a3b8;text-align:center;">⚠️ You have only one recording attempt per question.</div>'}
          
          <div id="speech-fallback-msg" class="hidden" style="font-size:11px;color:#64748b;text-align:center;">Speech recognition not supported. You may type directly above.</div>
        </div>
      `;
    } else if (isPassage) {
      // Passage: subquestions on right
      const subAnswers = currentAnswer || {};
      workspaceHtml = `
        <div class="asm-split-right" style="justify-content:flex-start;align-items:stretch;gap:14px;overflow-y:auto;max-height:100%;width:100%;max-width:none;">
          <div style="font-size:13px;font-weight:700;color:#1e3a8a;border-bottom:2px solid #eff6ff;padding-bottom:8px;">📝 Sub-Questions (Answer all)</div>
      `;
      (q.subQuestions || []).forEach((sq, sqIdx) => {
        const sqAns = subAnswers[sqIdx];
        const sqText = sq.questionText || sq.text || '';
        const sqType = (sq.type || sq.questionType || '').toLowerCase();
        const isExplicitMcq = sqType === 'mcq' || sqType === 'mcq_single' || sqType === 'mcq_multi' || sqType === 'single' || sqType === 'multiple';
        const isExplicitFib = sqType === 'fib' || sqType === 'fill_blank' || sqType === 'fill_in_blank' || sqType === 'fill_in_the_blank';
        const hasRealOptions = sq.options && sq.options.length > 0 && sq.options.some(opt => typeof opt === 'string' && opt.trim().length > 0);

        const isSubqMcq = isExplicitMcq || (hasRealOptions && !isExplicitFib);
        const isSubqFib = !isSubqMcq && (isExplicitFib || sqText.includes('${blank}') || sqText.includes('___') || sqText.includes('[blank]'));

        workspaceHtml += `
          <div class="asm-passage-subq" style="background:#fff;padding:16px;border-radius:12px;border:1px solid #e2e8f0;margin-bottom:8px;display:flex;flex-direction:column;gap:8px;box-shadow:0 1px 3px rgba(0,0,0,0.04);">
        `;

        if (isSubqMcq) {
          workspaceHtml += `
            <div style="font-weight:700;font-size:13px;color:#334155;margin-bottom:4px;">Q${sqIdx + 1}. ${LQ.esc(sqText)}</div>
            <div style="display:flex;flex-direction:column;gap:6px;">
          `;
          sq.options.forEach((opt, oIdx) => {
            const isSelected = sqAns === oIdx;
            workspaceHtml += `
              <button type="button" class="asm-opt-btn ${isSelected ? 'selected' : ''}" onclick="LQ.selectPassageSubAnswer(${idx}, ${sqIdx}, ${oIdx})" style="display:flex;align-items:center;gap:10px;width:100%;padding:10px 14px;border-radius:8px;border:1px solid ${isSelected ? '#2563eb' : '#e2e8f0'};background:${isSelected ? '#eff6ff' : '#fff'};text-align:left;cursor:pointer;font-size:13px;transition:all 0.15s;">
                <span style="width:18px;height:18px;border-radius:50%;border:2px solid ${isSelected ? '#2563eb' : '#cbd5e1'};background:${isSelected ? '#2563eb' : 'transparent'};display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;">${isSelected ? '<span style="width:6px;height:6px;border-radius:50%;background:#fff;display:block;"></span>' : ''}</span>
                <span style="color:${isSelected ? '#1e40af' : '#334155'};">${LQ.esc(opt)}</span>
              </button>
            `;
          });
          workspaceHtml += `</div>`;
        } else if (isSubqFib) {
          let sqInputText = sqText;
          let sqBlankIdx = 0;
          const sqAnsArr = Array.isArray(sqAns) ? sqAns : (typeof sqAns === 'string' && sqAns !== '' ? [sqAns] : []);
          sqInputText = sqInputText.replace(/\$\{blank\}|_{3,}|\[blank\]/gi, function() {
            const val = sqAnsArr[sqBlankIdx] || '';
            const inp = `<input type="text" class="asm-fib-input" value="${LQ.esc(val)}" oninput="LQ.savePassageSubFibAnswer(${idx}, ${sqIdx}, ${sqBlankIdx}, this.value)" style="border:none;border-bottom:2px solid #2563eb;outline:none;padding:3px 6px;font-size:14px;font-weight:700;color:#1e3a8a;width:120px;text-align:center;background:#eff6ff;border-radius:6px;margin:0 4px;" />`;
            sqBlankIdx++;
            return inp;
          });
          if (sqBlankIdx === 0) {
            const val = typeof sqAns === 'string' ? sqAns : (sqAnsArr[0] || '');
            sqInputText += ` <input type="text" class="asm-fib-input" value="${LQ.esc(val)}" oninput="LQ.savePassageSubFibAnswer(${idx}, ${sqIdx}, 0, this.value)" style="border:none;border-bottom:2px solid #2563eb;outline:none;padding:3px 6px;font-size:14px;font-weight:700;color:#1e3a8a;width:130px;text-align:center;background:#eff6ff;border-radius:6px;margin:0 4px;" />`;
          }
          workspaceHtml += `<div style="font-size:14px;color:#334155;line-height:2.4;font-weight:500;"><strong>Q${sqIdx + 1}.</strong> ${sqInputText}</div>`;
        } else {
          workspaceHtml += `
            <div style="font-weight:700;font-size:13px;color:#334155;margin-bottom:4px;">Q${sqIdx + 1}. ${LQ.esc(sqText)}</div>
            <input type="text" class="inp" placeholder="Type your answer..." value="${LQ.esc(typeof sqAns === 'string' ? sqAns : (Array.isArray(sqAns) ? sqAns.join(' ') : ''))}" oninput="LQ.savePassageSubTextAnswer(${idx}, ${sqIdx}, this.value)" style="width:100%;padding:10px 12px;border-radius:8px;border:1px solid #e2e8f0;background:#fff;font-size:13px;" />
          `;
        }
        workspaceHtml += `</div>`;
      });
      workspaceHtml += `</div>`;
    } else if (qType === 'mcq_multi' || (qType === 'mcq' && q.mcqType === 'multiple')) {
      const selectedArr = Array.isArray(currentAnswer) ? currentAnswer : [];
      workspaceHtml = `
        <div class="asm-split-right" style="justify-content:flex-start;align-items:stretch;gap:10px;">
          <div style="font-size:12px;font-weight:600;color:#64748b;margin-bottom:2px;">Select all correct options:</div>
          <div class="asm-options-list" style="display:flex;flex-direction:column;gap:8px;">
            ${(q.options || []).map((opt, oIdx) => {
              const isSelected = selectedArr.includes(oIdx);
              const prefix = String.fromCharCode(65 + oIdx);
              return `
                <button type="button" class="asm-opt-btn ${isSelected ? 'selected' : ''}" onclick="LQ.toggleMultiSessionAnswer(${oIdx})" style="display:flex;align-items:center;gap:12px;width:100%;padding:12px 16px;border-radius:10px;border:1.5px solid ${isSelected ? '#2563eb' : '#e2e8f0'};background:${isSelected ? '#eff6ff' : '#fff'};text-align:left;cursor:pointer;transition:all 0.15s;font-size:14px;">
                  <span style="width:18px;height:18px;border-radius:4px;border:2px solid ${isSelected ? '#2563eb' : '#cbd5e1'};background:${isSelected ? '#2563eb' : 'transparent'};display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;">
                    ${isSelected ? '<span style="color:#fff;font-size:11px;font-weight:900;">✓</span>' : ''}
                  </span>
                  <span style="font-weight:600;color:#64748b;min-width:18px;">${prefix}.</span>
                  <span style="color:${isSelected ? '#1e40af' : '#1e293b'};">${LQ.esc(opt)}</span>
                </button>
              `;
            }).join('')}
          </div>
        </div>
      `;
    } else if (q.options && q.options.length) {
      // MCQ Single
      workspaceHtml = `
        <div class="asm-split-right" style="justify-content:flex-start;align-items:stretch;gap:10px;">
          <div style="font-size:12px;font-weight:600;color:#64748b;margin-bottom:2px;">Choose one answer:</div>
          <div class="asm-options-list" style="display:flex;flex-direction:column;gap:8px;">
            ${q.options.map((opt, oIdx) => {
              const isSelected = currentAnswer === oIdx;
              const prefix = String.fromCharCode(65 + oIdx);
              return `
                <button type="button" class="asm-opt-btn ${isSelected ? 'selected' : ''}" onclick="LQ.selectSessionAnswer(${oIdx})" style="display:flex;align-items:center;gap:12px;width:100%;padding:12px 16px;border-radius:10px;border:1.5px solid ${isSelected ? '#2563eb' : '#e2e8f0'};background:${isSelected ? '#eff6ff' : '#fff'};text-align:left;cursor:pointer;transition:all 0.15s;font-size:14px;">
                  <span style="width:18px;height:18px;border-radius:50%;border:2px solid ${isSelected ? '#2563eb' : '#cbd5e1'};background:${isSelected ? '#2563eb' : 'transparent'};display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;">${isSelected ? '<span style="width:6px;height:6px;border-radius:50%;background:#fff;display:block;"></span>' : ''}</span>
                  <span style="font-weight:600;color:#64748b;min-width:18px;">${prefix}.</span>
                  <span style="color:${isSelected ? '#1e40af' : '#1e293b'};">${LQ.esc(opt)}</span>
                </button>
              `;
            }).join('')}
          </div>
        </div>
      `;
    } else {
      // Text response fallback
      workspaceHtml = `
        <div class="asm-split-right" style="justify-content:center;align-items:stretch;gap:14px;">
          <div style="font-size:12px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:0.5px;">Type your response:</div>
          <textarea id="asm-text-ans" class="inp" rows="5" placeholder="Type your response here..." oninput="LQ.saveSessionTextAnswer(this.value)" style="width:100%;padding:14px;border-radius:10px;border:1px solid #e2e8f0;background:#fff;font-size:14px;resize:none;line-height:1.6;">${LQ.esc(typeof currentAnswer === 'string' ? currentAnswer : '')}</textarea>
        </div>
      `;
    }

    bodyEl.innerHTML = `
      <div class="asm-split-container">
        ${promptHtml}
        ${workspaceHtml}
      </div>
    `;

    if (needsMic || isSpeakType) {
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
  };

  LQ.saveSessionTextAnswer = function (val) {
    if (!activeSession) return;
    activeSession.userAnswers[activeSession.currentIndex] = val;
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
      const evalResp = await fetch("/api/assessment/evaluate-practice", {
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
    const asmId = asm.id;
    await cleanupTempMediaSession(asmId);
    LQ.toast("Assessment submitted & evaluated!", true);

    LQ._lastSubmittedResult = {
      id: asmId,
      showResult: (activeSession && activeSession.assessment && activeSession.assessment.showResult !== undefined) ? activeSession.assessment.showResult : true,
      showAnswer: (activeSession && activeSession.assessment && activeSession.assessment.showAnswer !== undefined) ? activeSession.assessment.showAnswer : (!activeSession.isOfficial),
      asm: asm
    };

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

  function getCorrectOptionIndex(correctAns, options) {
    if (!options || !options.length) return -1;
    var str = (correctAns !== undefined && correctAns !== null) ? String(correctAns).trim() : '';
    if (!str) return -1;
    var directIdx = options.indexOf(str);
    if (directIdx >= 0) return directIdx;
    
    var cleanStr = str;
    var match = str.match(/^([A-Za-z0-9]+)/);
    if (match) {
      cleanStr = match[1];
    }

    var upper = cleanStr.toUpperCase();
    if (upper.length === 1 && upper >= 'A' && upper <= 'Z') {
      var letterIdx = upper.charCodeAt(0) - 65;
      if (letterIdx >= 0 && letterIdx < options.length) return letterIdx;
    }
    var numIdx = parseInt(cleanStr, 10);
    if (!isNaN(numIdx) && numIdx >= 0 && numIdx < options.length) return numIdx;
    return -1;
  }

  function renderPassageSubQuestionsResultHtml(q, originalIndex, showAns) {
    let subHtml = "";
    const userAnsMap = (typeof q.userAnswer === 'object' && q.userAnswer !== null) ? q.userAnswer : {};
    const subQuestions = q.subQuestions || [];

    subQuestions.forEach((sq, sqIdx) => {
      const sqUserAns = sq.userAnswer !== undefined ? sq.userAnswer : userAnsMap[sqIdx];
      const sqText = sq.questionText || sq.text || '';
      const sqType = (sq.type || sq.questionType || '').toLowerCase();
      const isExplicitMcq = sqType === 'mcq' || sqType === 'mcq_single' || sqType === 'mcq_multi' || sqType === 'single' || sqType === 'multiple';
      const isExplicitFib = sqType === 'fib' || sqType === 'fill_blank' || sqType === 'fill_in_blank' || sqType === 'fill_in_the_blank';
      const hasRealOptions = sq.options && sq.options.length > 0 && sq.options.some(opt => typeof opt === 'string' && opt.trim().length > 0);

      const isSubqMcq = isExplicitMcq || (hasRealOptions && !isExplicitFib);

      let isSqCorrect = sq.isCorrect;
      if (isSqCorrect === undefined) {
        if (isSubqMcq && sq.options && sq.options.length) {
          const expectedIdx = getCorrectOptionIndex(sq.correctAnswer, sq.options);
          const userIdx = typeof sqUserAns === 'number' ? sqUserAns : getCorrectOptionIndex(sqUserAns, sq.options);
          isSqCorrect = expectedIdx >= 0 && userIdx === expectedIdx;
        } else if (Array.isArray(sq.correctAnswers) && sq.correctAnswers.length > 1) {
          const expectedArr = sq.correctAnswers.map(s => (s || '').trim().toLowerCase());
          const userArr = Array.isArray(sqUserAns) ? sqUserAns.map(s => (s || '').trim().toLowerCase()) : [];
          isSqCorrect = expectedArr.length > 0 && expectedArr.length === userArr.length && expectedArr.every((v, k) => v === userArr[k]);
        } else {
          const expected = (sq.correctAnswer || (sq.correctAnswers ? sq.correctAnswers[0] : '') || '').trim().toLowerCase();
          const actual = typeof sqUserAns === 'string' ? sqUserAns.trim().toLowerCase() : (Array.isArray(sqUserAns) ? sqUserAns.join(' ').trim().toLowerCase() : '');
          isSqCorrect = expected.length > 0 && expected === actual;
        }
      }

      let sqAnsStr = "";
      const sqMarks = sq.marks ? ` <span style='font-size:11px;color:#6b7280;'>(${formatScoreNum(sq.marks)} marks)</span>` : '';

      if (showAns) {
        if (isSubqMcq && sq.options && sq.options.length) {
          const userOpt = (sqUserAns !== undefined && sqUserAns !== null && sqUserAns !== '') 
            ? (typeof sqUserAns === 'number' ? (sq.options[sqUserAns] || sqUserAns) : sqUserAns) 
            : "Not answered";
          const correctIdx = getCorrectOptionIndex(sq.correctAnswer, sq.options);
          const correctOpt = correctIdx >= 0 ? sq.options[correctIdx] : (sq.correctAnswer || "—");

          sqAnsStr = `
            <p class="asm-res-ans" style="margin:4px 0 0 0;font-size:12px;"><strong>Your choice:</strong> ${LQ.esc(userOpt)}</p>
            ${(!isSqCorrect) ? `<p class="asm-res-ans correct" style="margin:2px 0 0 0;font-size:12px;color:#16a34a;background:none;padding:0;"><strong>Correct choice:</strong> ${LQ.esc(correctOpt)}</p>` : ""}
          `;
        } else if (Array.isArray(sq.correctAnswers) && sq.correctAnswers.length > 1) {
          const userBlanks = Array.isArray(sqUserAns) ? sqUserAns : (typeof sqUserAns === 'string' ? [sqUserAns] : []);
          const correctBlanks = sq.correctAnswers || [];
          let blanksHtml = userBlanks.map((ub, bi) => {
            const isBlankCorrect = (ub || '').trim().toLowerCase() === (correctBlanks[bi] || '').trim().toLowerCase();
            return `<span style="display:inline-block;padding:2px 8px;margin:2px 4px;border-radius:4px;font-size:12px;background:${isBlankCorrect ? '#dcfce7' : '#fee2e2'};color:${isBlankCorrect ? '#166534' : '#991b1b'};">${LQ.esc(ub || '—')}</span>`;
          }).join('');
          sqAnsStr = `
            <p class="asm-res-ans" style="margin:4px 0 0 0;font-size:12px;"><strong>Your blanks:</strong> ${blanksHtml || 'Not answered'}</p>
            <p class="asm-res-ans correct" style="margin:2px 0 0 0;font-size:12px;color:#16a34a;background:none;padding:0;"><strong>Correct blanks:</strong> ${correctBlanks.map(c => LQ.esc(c)).join(', ')}</p>
          `;
        } else {
          const sqUserStr = Array.isArray(sqUserAns) ? sqUserAns.join(', ') : (sqUserAns !== undefined && sqUserAns !== null && sqUserAns !== '' ? String(sqUserAns) : "Not answered");
          const sqCorrectStr = Array.isArray(sq.correctAnswers) ? sq.correctAnswers.join(', ') : (sq.correctAnswer || "—");
          sqAnsStr = `
            <p class="asm-res-ans" style="margin:4px 0 0 0;font-size:12px;"><strong>Your answer:</strong> ${LQ.esc(sqUserStr)}</p>
            <p class="asm-res-ans correct" style="margin:2px 0 0 0;font-size:12px;color:#16a34a;background:none;padding:0;"><strong>Correct answer:</strong> ${LQ.esc(sqCorrectStr)}</p>
          `;
        }
      }
      const sqBadge = showAns ? (isSqCorrect ? "<span style='color:#16a34a;font-weight:700;'>✓ Correct</span>" : "<span style='color:#dc2626;font-weight:700;'>✕ Incorrect</span>") : "<span style='color:#4b5563;'>Graded</span>";
      const sqBorderColor = showAns ? (isSqCorrect ? '#22c55e' : '#ef4444') : '#e2e8f0';

      subHtml += `
        <div style="background:#f8fafc;padding:12px 14px;border-radius:8px;border:1px solid #e2e8f0;border-left:5px solid ${sqBorderColor};margin-top:8px;">
          <div style="display:flex;justify-content:space-between;align-items:center;font-size:13px;font-weight:600;color:#475569;gap:12px;">
            <span>Q${originalIndex + 1}.${sqIdx + 1} ${LQ.esc(sq.questionText || sq.text || '')}${sqMarks}</span>
            <span>${sqBadge}</span>
          </div>
          ${sqAnsStr}
        </div>
      `;
    });

    return `<div style="margin-top:8px;display:flex;flex-direction:column;gap:4px;">${subHtml}</div>`;
  }

  LQ.renderAssessmentResultScreen = async function () {
    const id = sessionStorage.getItem("currentAssessmentId");
    if (!id) return;

    // Purge temporary active-test media session data from IndexedDB & sessionStorage
    await cleanupTempMediaSession(id);

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

    // ── ENTRY POINT 1: Direct from active test submission (0 API calls needed) ──
    if (LQ._lastSubmittedResult && String(LQ._lastSubmittedResult.id) === String(id)) {
      const last = LQ._lastSubmittedResult;
      isOfficialResult = true;
      const showResult = last.showResult !== undefined ? last.showResult : true;
      const showAnswer = last.showAnswer !== undefined ? last.showAnswer : false;

      if (!showResult) {
        testResult = { ok: true, showResult: false, showAnswer: false, title: last.asm.title || last.asm.name };
      } else {
        testResult = {
          ok: true,
          showResult: showResult,
          showAnswer: showAnswer,
          title: last.asm.title || last.asm.name,
          percentage: last.asm.percentage,
          correctCount: last.asm.correctCount,
          wrongCount: last.asm.wrongCount,
          totalQuestions: last.asm.totalQuestions,
          totalMarks: last.asm.totalMarks,
          earnedMarks: last.asm.earnedMarks,
          questions: last.asm.questions || []
        };
      }
    } 
    // ── ENTRY POINT 2: From landing page card button ──
    else {
      let testCard = (fetchedOfficialTests || []).find(t => String(t.id || t._id) === String(id));
      const cardShowResult = testCard ? testCard.showResult : true;

      // 2A: showResult is FALSE -> 0 API calls needed
      if (testCard && cardShowResult === false) {
        isOfficialResult = true;
        testResult = { ok: true, showResult: false, showAnswer: false, title: testCard.title || testCard.name };
      } 
      // 2B & 2C: showResult is TRUE -> Fetch complete test data API & student session API
      else {
        try {
          const testRes = await fetch("/api/student/tests/" + id, { credentials: "include" });
          const testData = await testRes.json();
          if (testData.ok && testData.test) {
            const testDef = testData.test;

            const sessionRes = await fetch("/api/student/tests/" + id + "/session", { credentials: "include" });
            const sessionData = await sessionRes.json();

            if (sessionData.ok && sessionData.attempt && sessionData.attempt.status === 'completed') {
              const flatTestQs = [];
              const secNames = [];
              (testDef.sections || []).forEach(sec => {
                (sec.questions || []).forEach(q => {
                  flatTestQs.push(q);
                  secNames.push(sec.name);
                });
              });

              testResult = {
                ok: true,
                showResult: testDef.showResult,
                showAnswer: testDef.showAnswer,
                title: testDef.title || testDef.name || (testCard ? (testCard.title || testCard.name) : ""),
                passPercentage: testDef.passPercentage !== undefined ? testDef.passPercentage : (testCard ? testCard.passPercentage : 30),
                percentage: sessionData.attempt.percentage,
                correctCount: sessionData.attempt.correctCount,
                wrongCount: sessionData.attempt.wrongCount,
                totalQuestions: sessionData.attempt.totalQuestions,
                totalMarks: sessionData.attempt.totalMarks,
                earnedMarks: sessionData.attempt.earnedMarks,
                questions: (sessionData.attempt.questions || []).map((eq, qIdx) => {
                  const origQ = flatTestQs.find(tq => String(tq.questionId || tq.id || tq._id) === String(eq.questionId || eq.id || eq._id)) || flatTestQs[qIdx] || {};
                  return {
                    ...eq,
                    subQuestions: (eq.subQuestions && eq.subQuestions.length > 0) ? eq.subQuestions : (origQ.subQuestions || []),
                    groupTitle: eq.groupTitle || secNames[qIdx] || "Section"
                  };
                })
              };
              isOfficialResult = true;
            }
          }
        } catch (err) {
          console.warn(err);
        }
      }
    }

    if (isOfficialResult && testResult) {
      if (titleEl) titleEl.textContent = (testResult.title || "Test") + " — Results";
      
      const summaryCardEl = document.querySelector(".asm-res-summary-card");

      if (!testResult.showResult) {
        if (scorePctEl) scorePctEl.style.display = "none";
        if (groupStatsEl) groupStatsEl.style.display = "none";
        if (questionsListEl) {
          questionsListEl.style.display = "none";
          questionsListEl.innerHTML = "";
        }
        if (summaryCardEl) {
          summaryCardEl.style.gridColumn = "1 / -1";
          summaryCardEl.style.maxWidth = "540px";
          summaryCardEl.style.margin = "40px auto";
          summaryCardEl.style.padding = "40px 32px";
          summaryCardEl.style.borderRadius = "20px";
          summaryCardEl.style.background = "#fff";
          summaryCardEl.style.boxShadow = "0 10px 25px -5px rgba(0,0,0,0.05)";
          summaryCardEl.style.border = "1px solid #e2e8f0";
          summaryCardEl.style.textAlign = "center";
        }
        if (scoreCountsEl) {
          scoreCountsEl.innerHTML = `
            <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;padding:10px 0;">
              <div style="width:72px;height:72px;border-radius:50%;background:#dcfce7;color:#166534;display:flex;align-items:center;justify-content:center;font-size:36px;box-shadow:0 4px 12px rgba(22,101,52,0.15);">
                ✓
              </div>
              <h3 style="margin:0;font-size:22px;font-weight:700;color:#0f172a;">Test Submitted Successfully</h3>
              <p style="margin:0;color:#64748b;font-size:14px;line-height:1.6;max-width:380px;">
                Your test answers have been recorded securely. Scores and evaluation details will be published by your administrator.
              </p>
            </div>
          `;
        }
        return;
      }

      // Reset layout styling when showResult is true
      if (questionsListEl) questionsListEl.style.display = "block";
      if (summaryCardEl) {
        summaryCardEl.style.gridColumn = "";
        summaryCardEl.style.maxWidth = "";
        summaryCardEl.style.margin = "";
        summaryCardEl.style.padding = "";
        summaryCardEl.style.borderRadius = "";
        summaryCardEl.style.background = "";
        summaryCardEl.style.boxShadow = "";
        summaryCardEl.style.border = "";
        summaryCardEl.style.textAlign = "";
      }

      // Draw Result Circle
      const pctNum = formatScoreNum(testResult.percentage);
      const reqPassPct = testResult.passPercentage !== undefined ? testResult.passPercentage : 30;
      const isPassed = pctNum >= reqPassPct;
      const isExcellent = pctNum >= 90 && reqPassPct < 90;

      let passBadgeHtml = "";
      if (isExcellent) {
        passBadgeHtml = `<span class="asm-stat-chip" style="background:#fef3c7;color:#b45309;border:1px solid #fde68a;font-weight:700;padding:4px 14px;border-radius:20px;">🌟 EXCELLENT</span>`;
      } else if (isPassed) {
        passBadgeHtml = `<span class="asm-stat-chip" style="background:#dcfce7;color:#15803d;border:1px solid #86efac;font-weight:700;padding:4px 14px;border-radius:20px;">🎉 PASSED</span>`;
      } else {
        passBadgeHtml = `<span class="asm-stat-chip" style="background:#fee2e2;color:#991b1b;border:1px solid #fca5a5;font-weight:700;padding:4px 14px;border-radius:20px;">🔴 FAILED</span>`;
      }

      if (scorePctEl) {
        scorePctEl.textContent = pctNum + "%";
        scorePctEl.className = "asm-res-pct-circle " + (isPassed ? "circle-green" : "circle-coral");
      }

      if (scoreCountsEl) {
        let marksHtml = '';
        if (testResult.totalMarks && testResult.earnedMarks !== undefined) {
          marksHtml = `<span class="asm-stat-chip" style="background:#eff6ff;color:#1e40af;border:1.5px solid #bfdbfe;font-weight:800;font-size:14px;padding:6px 16px;">📊 Score: ${formatScoreNum(testResult.earnedMarks)} / ${formatScoreNum(testResult.totalMarks)} Marks</span>`;
        }
        scoreCountsEl.innerHTML = `
          <div class="asm-res-stats-wrap">
            <div class="asm-res-stat-chips" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:12px;">
              ${passBadgeHtml}
              ${marksHtml}
              <span class="asm-stat-chip chip-correct">✓ ${testResult.correctCount} Fully Correct</span>
              <span class="asm-stat-chip chip-wrong">✕ ${testResult.wrongCount} Incorrect</span>
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
            sectionScores[secName] = { name: secName, total: 0, correct: 0, totalMarks: 0, earnedMarks: 0 };
          }
          sectionScores[secName].total++;
          const maxM = q.marks || 1;
          const earnedM = q.earnedMarks !== undefined ? q.earnedMarks : (q.isCorrect ? maxM : 0);
          sectionScores[secName].totalMarks += maxM;
          sectionScores[secName].earnedMarks += earnedM;
          if (earnedM >= maxM && maxM > 0) {
            sectionScores[secName].correct++;
          }
        });
        const sections = Object.values(sectionScores);
        groupStatsEl.innerHTML =
          "<h3>📊 Performance by Section</h3>" +
          sections
            .map((s) => {
              const percentage = s.totalMarks > 0 ? formatScoreNum((s.earnedMarks / s.totalMarks) * 100) : 0;
              const color =
                percentage >= 60
                  ? "#22c55e"
                  : percentage >= 30
                  ? "#f59e0b"
                  : "#ef4444";
              return (
                '<div class="asm-grp-stat-item" style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:12px 16px;margin-bottom:8px;box-shadow:0 1px 2px rgba(0,0,0,0.03);">' +
                '<div class="asm-grp-stat-head" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;font-size:13px;">' +
                '<strong>📂 ' + LQ.esc(s.name) + '</strong>' +
                '<span style="font-weight:700;color:' + color + ';">' +
                formatScoreNum(s.earnedMarks) + ' / ' + formatScoreNum(s.totalMarks) + ' Marks (' + percentage + '%)' +
                '</span>' +
                '</div>' +
                '<div class="asm-grp-stat-bar" style="width:100%;height:8px;background:#e2e8f0;border-radius:4px;overflow:hidden;"><div class="asm-grp-stat-fill" style="height:100%;width:' +
                percentage +
                '%;background:' +
                color +
                ';transition:width 0.4s;"></div></div>' +
                '</div>'
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
            const qTypeLower = (q.type || '').toLowerCase();
            
            if (showAns) {
              if (qTypeLower === 'passage' || (q.subQuestions && q.subQuestions.length > 0)) {
                ansStr = renderPassageSubQuestionsResultHtml(q, originalIndex, true);
              } else if (q.options && q.options.length) {
                const userOpt = (q.userAnswer !== undefined && q.userAnswer !== null && q.userAnswer !== '') 
                  ? (typeof q.userAnswer === 'number' ? (q.options[q.userAnswer] || q.userAnswer) : q.userAnswer) 
                  : "Not answered";
                const correctIdx = getCorrectOptionIndex(q.correctAnswer, q.options);
                const correctOpt = correctIdx >= 0 ? q.options[correctIdx] : (q.options[q.correctAnswerIndex] || q.correctAnswer || "—");
                ansStr = `
                  <p class="asm-res-ans"><strong>Your choice:</strong> ${LQ.esc(userOpt)}</p>
                  <p class="asm-res-ans correct" style="color:#16a34a;margin-top:4px;"><strong>Correct choice:</strong> ${LQ.esc(correctOpt)}</p>
                `;
              } else if (['jumbled_sentence', 'listen_repeat', 'reading_listening', 'story_retelling', 'listening', 'speaking', 'speak'].includes(qTypeLower)) {
                const userStr = Array.isArray(q.userAnswer) ? q.userAnswer.join(', ') : (q.userAnswer !== undefined && q.userAnswer !== null && q.userAnswer !== '' ? String(q.userAnswer) : "Not answered");
                ansStr = `
                  <p class="asm-res-ans"><strong>Your answer:</strong> ${LQ.esc(userStr)}</p>
                `;
              } else {
                const userStr = Array.isArray(q.userAnswer) ? q.userAnswer.join(', ') : (q.userAnswer !== undefined && q.userAnswer !== null && q.userAnswer !== '' ? String(q.userAnswer) : "Not answered");
                const correctStr = (Array.isArray(q.correctAnswers) && q.correctAnswers.length > 0) 
                  ? q.correctAnswers.join(', ') 
                  : (q.correctAnswer || "—");

                ansStr = `
                  <p class="asm-res-ans"><strong>Your answer:</strong> ${LQ.esc(userStr)}</p>
                  <p class="asm-res-ans correct" style="color:#16a34a;margin-top:4px;"><strong>Correct answer:</strong> ${LQ.esc(correctStr)}</p>
                `;
              }
            } else if (qTypeLower === 'passage' || (q.subQuestions && q.subQuestions.length > 0)) {
              ansStr = renderPassageSubQuestionsResultHtml(q, originalIndex, false);
            }

            const maxM = q.marks || 1;
            const earnedM = q.earnedMarks !== undefined ? q.earnedMarks : (q.isCorrect ? maxM : 0);
            
            let cardClass = "neutral";
            let badgeText = "Graded";
            let cardBorderColor = "#cbd5e1";
            let badgeBg = "#f1f5f9";
            let badgeColor = "#475569";

            if (testResult.showResult) {
              if (earnedM >= maxM && maxM > 0) {
                cardClass = "ok";
                badgeText = `✓ Passed (${formatScoreNum(earnedM)} / ${formatScoreNum(maxM)} Marks)`;
                cardBorderColor = "#22c55e"; // GREEN
                badgeBg = "#dcfce7";
                badgeColor = "#15803d";
              } else if (earnedM > 0) {
                cardClass = "partial";
                badgeText = `⚠️ Partial (${formatScoreNum(earnedM)} / ${formatScoreNum(maxM)} Marks)`;
                cardBorderColor = "#f97316"; // ORANGE
                badgeBg = "#ffedd5";
                badgeColor = "#c2410c";
              } else {
                cardClass = "wrong";
                badgeText = `✕ Failed (0 / ${formatScoreNum(maxM)} Marks)`;
                cardBorderColor = "#ef4444"; // RED
                badgeBg = "#fee2e2";
                badgeColor = "#b91c1c";
              }
            }

            listHtml += `
              <div class="asm-res-q-item ${cardClass}" style="border-left: 6px solid ${cardBorderColor};background:#fff;border-radius:12px;padding:18px;margin-bottom:12px;border-top:1px solid #e2e8f0;border-right:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;box-shadow:0 1px 3px rgba(0,0,0,0.04);">
                <div class="asm-res-q-head" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
                  <span class="asm-res-q-num" style="font-weight:700;font-size:14px;color:#1e293b;">Q${i + 1} <span style="font-size:12px;color:#64748b;font-weight:600;margin-left:6px;">(${formatScoreNum(maxM)} Marks)</span></span>
                  <span class="asm-res-q-badge" style="background:${badgeBg};color:${badgeColor};font-weight:700;padding:4px 12px;border-radius:12px;font-size:12px;">${badgeText}</span>
                </div>
                <p class="asm-res-q-text" style="font-size:14px;font-weight:600;color:#334155;margin-bottom:10px;">${LQ.esc(q.questionText || q.text)}</p>
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
    const isPassed = pctNum >= 40;
    const passBadgeHtml = isPassed 
      ? `<span class="asm-stat-chip" style="background:#dcfce7;color:#15803d;border:1px solid #86efac;font-weight:700;padding:4px 14px;border-radius:20px;">🎉 PASSED</span>`
      : `<span class="asm-stat-chip" style="background:#fee2e2;color:#991b1b;border:1px solid #fca5a5;font-weight:700;padding:4px 14px;border-radius:20px;">🔴 FAILED</span>`;

    if (titleEl) titleEl.textContent = asm.title + " — Results";
    if (scorePctEl) {
      scorePctEl.textContent = pctNum + "%";
      scorePctEl.className =
        "asm-res-pct-circle " + (isPassed ? "circle-green" : "circle-coral");
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
        '<div class="asm-res-stat-chips" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:12px;">' +
        passBadgeHtml +
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
            const qTypeLower = (q.type || '').toLowerCase();
            if (qTypeLower === 'passage' || (q.subQuestions && q.subQuestions.length > 0)) {
              ansStr = renderPassageSubQuestionsResultHtml(q, i, true);
            } else if (q.options && q.options.length) {
              let userOpt = "Not answered";
              if (q.userAnswer !== undefined && q.userAnswer !== null) {
                const userAnswersArray = Array.isArray(q.userAnswer)
                  ? q.userAnswer
                  : String(q.userAnswer).split(',').map(s => s.trim()).filter(Boolean);
                const resolvedUserOpts = userAnswersArray.map(ans => {
                  let idx = typeof ans === 'number' ? ans : getCorrectOptionIndex(ans, q.options);
                  return (idx >= 0 && idx < q.options.length) ? q.options[idx] : ans;
                });
                if (resolvedUserOpts.length > 0) {
                  userOpt = resolvedUserOpts.join(', ');
                }
              }

              let correctOpt = "—";
              const correctAnswersArray = Array.isArray(q.correctAnswerIndices) && q.correctAnswerIndices.length > 0
                ? q.correctAnswerIndices
                : (q.correctAnswer ? String(q.correctAnswer).split(',').map(s => s.trim()).filter(Boolean) : []);
              const resolvedCorrectOpts = correctAnswersArray.map(ans => {
                let idx = typeof ans === 'number' ? ans : getCorrectOptionIndex(ans, q.options);
                return (idx >= 0 && idx < q.options.length) ? q.options[idx] : ans;
              });
              if (resolvedCorrectOpts.length > 0) {
                correctOpt = resolvedCorrectOpts.join(', ');
              } else if (q.correctAnswerIndex !== null && q.correctAnswerIndex !== undefined && q.options[q.correctAnswerIndex]) {
                correctOpt = q.options[q.correctAnswerIndex];
              }
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

            const maxM = q.marks || 1;
            const earnedM = q.earnedMarks !== undefined ? q.earnedMarks : (q.isCorrect ? maxM : 0);
            let borderColor = "#ef4444"; // RED
            let badgeBg = "#fee2e2";
            let badgeColor = "#b91c1c";
            let badgeLabel = `✕ Failed (0 / ${formatScoreNum(maxM)} Marks)`;

            if (earnedM >= maxM && maxM > 0) {
              borderColor = "#22c55e"; // GREEN
              badgeBg = "#dcfce7";
              badgeColor = "#15803d";
              badgeLabel = `✓ Passed (${formatScoreNum(earnedM)} / ${formatScoreNum(maxM)} Marks)`;
            } else if (earnedM > 0) {
              borderColor = "#f97316"; // ORANGE
              badgeBg = "#ffedd5";
              badgeColor = "#c2410c";
              badgeLabel = `⚠️ Partial (${formatScoreNum(earnedM)} / ${formatScoreNum(maxM)} Marks)`;
            }

            return (
              '<div class="asm-res-q-item" style="border-left: 6px solid ' + borderColor + ';background:#fff;border-radius:12px;padding:18px;margin-bottom:12px;border-top:1px solid #e2e8f0;border-right:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;box-shadow:0 1px 3px rgba(0,0,0,0.04);">' +
              '<div class="asm-res-q-head" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">' +
              '<span class="asm-res-q-num" style="font-weight:700;font-size:14px;color:#1e293b;">Q' +
              (i + 1) +
              " · " +
              LQ.esc(q.groupTitle) +
              "</span>" +
              '<span class="asm-res-q-badge" style="background:' + badgeBg + ';color:' + badgeColor + ';font-weight:700;padding:4px 12px;border-radius:12px;font-size:12px;">' +
              badgeLabel +
              "</span>" +
              "</div>" +
              '<p class="asm-res-q-text" style="font-size:14px;font-weight:600;color:#334155;margin-bottom:10px;">' +
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
      // Suppress violation during mic/speaker permission prompts
      if (permissionPromptActive) return;
      
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

  LQ.playQuestionAudio = function (qKeyParam, text) {
    let playLimit = 1;
    let idx = 0;
    let tId = "asm";
    if (activeSession && activeSession.assessment) {
      idx = activeSession.currentIndex;
      tId = activeSession.assessment.id;
      const q = activeSession.assessment.questions[idx];
      if (q) playLimit = q.playLimit || q.maxPlays || 1;
    }
    const prefix = getUserTestPrefix(tId);
    const playKey = prefix + "_played_" + idx;

    let playedCount = 0;
    try {
      playedCount = parseInt(sessionStorage.getItem(playKey) || '0', 10);
    } catch(e) { playedCount = 0; }

    if (playedCount >= playLimit) {
      LQ.toast('⚠️ Playback limit reached for this audio.');
      return;
    }

    playedCount++;
    try {
      sessionStorage.setItem(playKey, String(playedCount));
      if (LQ.AssessmentDB && LQ.AssessmentDB.saveTempMedia) {
        LQ.AssessmentDB.saveTempMedia(playKey, prefix, playedCount);
      }
    } catch(e) {}

    const remaining = Math.max(0, playLimit - playedCount);
    
    const btn = document.getElementById('btn-play-audio');
    if (btn) {
      btn.innerHTML = '<span>🔊 Playing...</span> <span style="font-size:11px;background:rgba(255,255,255,0.2);padding:2px 8px;border-radius:6px;">Plays left: ' + remaining + '</span>';
      btn.disabled = true;
      btn.style.background = '#94a3b8';
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.onend = function () {
      if (btn) {
        if (remaining > 0) {
          btn.disabled = false;
          btn.style.background = '#2563eb';
          btn.innerHTML = '<span>🔊 Play Audio</span> <span style="font-size:11px;background:rgba(255,255,255,0.2);padding:2px 8px;border-radius:6px;">Plays left: ' + remaining + '</span>';
        } else {
          btn.innerHTML = '<span>🔊 Playback Complete</span>';
          btn.style.background = '#94a3b8';
          btn.style.cursor = 'not-allowed';
        }
      }
    };
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  };

  // ═══════════════════════════════════════════
  // Media Permission Pre-Request
  // ═══════════════════════════════════════════
  LQ.requestMediaPermissions = async function () {
    const statusEl = document.getElementById('inst-permission-status');
    const btn = document.getElementById('btn-grant-permissions');
    
    permissionPromptActive = true;
    try {
      // Request mic permission
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(t => t.stop()); // Release immediately
      
      // Test speech synthesis
      const silentUtterance = new SpeechSynthesisUtterance('');
      silentUtterance.volume = 0;
      window.speechSynthesis.speak(silentUtterance);
      
      micPermissionGranted = true;
      if (statusEl) {
        statusEl.innerHTML = '✅ Permissions granted successfully!';
        statusEl.style.color = '#16a34a';
      }
      if (btn) {
        btn.innerHTML = '✅ Access Granted';
        btn.style.background = '#16a34a';
        btn.disabled = true;
      }
      LQ.toast('Mic & speaker access granted!', true);
    } catch (err) {
      console.warn('Permission request error:', err);
      if (statusEl) {
        statusEl.innerHTML = '❌ Permission denied. Please allow mic access in browser settings.';
        statusEl.style.color = '#dc2626';
      }
      LQ.toast('Mic access denied. Some questions may not work correctly.');
    } finally {
      permissionPromptActive = false;
    }
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
      LQ.toast('Speech recognition is not supported in this browser.');
      return;
    }

    if (!activeSession) return;
    const q = activeSession.assessment.questions[activeSession.currentIndex];
    if (!q) return;

    // Single-attempt enforcement: block if already used
    if (isMicUsed(q.id) && !isRecordingAudio) {
      LQ.toast('Recording already completed for this question.');
      return;
    }

    const txtArea = document.getElementById('asm-text-ans');
    const micBtn = document.getElementById('btn-mic-toggle');
    const micAnim = document.getElementById('mic-animation');

    if (isRecordingAudio) {
      // Stop recording
      if (speechRecognitionObj) speechRecognitionObj.stop();
      isRecordingAudio = false;
      
      // Mark as used (single attempt)
      markMicUsed(q.id);
      
      if (micBtn) {
        micBtn.textContent = '✅ Recording Complete';
        micBtn.style.background = '#16a34a';
        micBtn.disabled = true;
        micBtn.style.opacity = '0.7';
        micBtn.style.cursor = 'not-allowed';
      }
      if (micAnim) micAnim.classList.add('hidden');
    } else {
      // Start recording
      permissionPromptActive = true; // Suppress malpractice during mic init
      isRecordingAudio = true;
      if (micBtn) {
        micBtn.textContent = '⏹️ Stop Recording';
        micBtn.style.background = '#dc2626';
      }
      if (micAnim) micAnim.classList.remove('hidden');

      speechRecognitionObj = new SpeechRecognition();
      speechRecognitionObj.lang = 'en-US';
      speechRecognitionObj.continuous = true;
      speechRecognitionObj.interimResults = true;

      speechRecognitionObj.onresult = function (event) {
        let fullTranscript = '';
        for (let i = 0; i < event.results.length; i++) {
          fullTranscript += event.results[i][0].transcript;
        }
        if (txtArea) {
          txtArea.value = fullTranscript.trim();
          if (activeSession) {
            activeSession.userAnswers[activeSession.currentIndex] = txtArea.value;
          }
        }
      };

      speechRecognitionObj.onerror = function (e) {
        console.warn('Speech recognition error:', e);
        if (e.error !== 'aborted') {
          LQ.toast('Microphone error: ' + (e.error || 'unknown'));
        }
        isRecordingAudio = false;
        permissionPromptActive = false;
        if (micBtn) {
          micBtn.textContent = '🎤 Start Recording';
          micBtn.style.background = '#2563eb';
        }
        if (micAnim) micAnim.classList.add('hidden');
      };

      speechRecognitionObj.onend = function () {
        isRecordingAudio = false;
        permissionPromptActive = false;
        if (isMicUsed(q.id)) {
          if (micBtn) {
            micBtn.textContent = '✅ Recording Complete';
            micBtn.style.background = '#16a34a';
            micBtn.disabled = true;
            micBtn.style.opacity = '0.7';
            micBtn.style.cursor = 'not-allowed';
          }
        } else {
          if (micBtn) {
            micBtn.textContent = '🎤 Start Recording';
            micBtn.style.background = '#2563eb';
          }
        }
        if (micAnim) micAnim.classList.add('hidden');
      };

      speechRecognitionObj.start();
      // Release permission flag after short delay to let browser settle
      setTimeout(function() { permissionPromptActive = false; }, 1500);
    }
  };

  LQ.submitSessionQuestion = async function (isAutoSubmit = false) {
    if (!activeSession) return;
    
    // Guard against duplicate submit clicks while request is in flight
    if (LQ._submittingQuestion) return;
    LQ._submittingQuestion = true;

    // Stop recording if active
    if (isRecordingAudio && speechRecognitionObj) {
      try { speechRecognitionObj.stop(); } catch(e) {}
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

    let saveSuccess = true;

    // 2. Save progress to server/IndexedDB
    try {
      if (activeSession.isOfficial) {
        const resp = await fetch("/api/assessment/save-progress", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            assessmentId: asm.id,
            userAnswers: activeSession.userAnswers,
            currentIndex: idx
          })
        });
        if (!resp.ok) {
          saveSuccess = false;
        }
      }
      if (LQ.AssessmentDB && LQ.AssessmentDB.saveAttempt) {
        await LQ.AssessmentDB.saveAttempt({
          id: asm.id,
          testId: asm.id,
          startTimeMs: activeSession.startTimeMs,
          durationSeconds: activeSession.durationSeconds,
          userAnswers: activeSession.userAnswers,
          currentIndex: idx,
          status: 'in_progress'
        });
      }
    } catch (err) {
      console.warn("Failed to sync progress on submit", err);
      saveSuccess = false;
    }

    if (!saveSuccess && !isAutoSubmit) {
      LQ.hideLoader();
      LQ._submittingQuestion = false;
      LQ.toast("Failed to submit answer. Please try again.", false);
      return;
    }

    // 3. On success: move to next question or submit final
    try {
      if (idx < asm.totalQuestions - 1) {
        if (LQ._asmTimerId) {
          clearInterval(LQ._asmTimerId);
          LQ._asmTimerId = null;
        }
        activeSession.currentIndex = idx + 1;
        LQ.renderSessionQuestion();
        LQ.startSessionTimer();
        LQ.toast("Answer submitted!", true);
      } else {
        // Last question of last section: Submit final assessment
        await LQ.submitAssessmentSession();
      }
    } catch (err) {
      console.error("Transition to next question failed:", err);
      LQ.toast("Error advancing question. Please retry.", false);
    } finally {
      LQ.hideLoader();
      LQ._submittingQuestion = false;
    }
  };

  LQ.navSessionQuestion = async function (direction) {
    if (!activeSession) return;
    if (LQ._submittingQuestion) return;
    LQ._submittingQuestion = true;

    // Stop recording if active
    if (isRecordingAudio && speechRecognitionObj) {
      try { speechRecognitionObj.stop(); } catch(e) {}
      isRecordingAudio = false;
    }

    LQ.showLoader();
    const idx = activeSession.currentIndex;
    const asm = activeSession.assessment;
    const q = asm.questions[idx];

    // 1. Gather answer from inputs
    const textInp = document.getElementById("asm-text-ans");
    if (textInp && q.type !== 'fill_blank' && q.type !== 'fib' && q.type !== 'passage') {
      activeSession.userAnswers[idx] = textInp.value;
    }

    // 2. Save progress to IndexedDB
    try {
      if (LQ.AssessmentDB && LQ.AssessmentDB.saveAttempt) {
        await LQ.AssessmentDB.saveAttempt({
          id: asm.id,
          testId: asm.id,
          startTimeMs: activeSession.startTimeMs,
          durationSeconds: activeSession.durationSeconds,
          userAnswers: activeSession.userAnswers,
          currentIndex: idx,
          status: 'in_progress'
        });
      }
    } catch (err) {
      console.warn("Failed to sync progress on navigation", err);
    }

    // 3. Move index
    const targetIdx = idx + direction;
    try {
      if (targetIdx >= 0 && targetIdx < asm.totalQuestions) {
        if (LQ._asmTimerId) {
          clearInterval(LQ._asmTimerId);
          LQ._asmTimerId = null;
        }
        activeSession.currentIndex = targetIdx;
        LQ.renderSessionQuestion();
        LQ.startSessionTimer();
      } else if (targetIdx === asm.totalQuestions) {
        // Last question finish submit
        await LQ.submitAssessmentSession();
      }
    } catch (err) {
      console.error("Navigation failed:", err);
    } finally {
      LQ.hideLoader();
      LQ._submittingQuestion = false;
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
  };

  LQ.selectPassageSubAnswer = function (qIdx, sqIdx, oIdx) {
    if (!activeSession) return;
    if (!activeSession.userAnswers[qIdx]) activeSession.userAnswers[qIdx] = {};
    activeSession.userAnswers[qIdx][sqIdx] = oIdx;
    
    // Rerender question immediately to highlight selection
    LQ.renderSessionQuestion();
  };

  LQ.savePassageSubTextAnswer = function (qIdx, sqIdx, value) {
    if (!activeSession) return;
    if (!activeSession.userAnswers[qIdx]) activeSession.userAnswers[qIdx] = {};
    activeSession.userAnswers[qIdx][sqIdx] = value;
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

    const sidebar = document.getElementById("asm-tracker-sidebar");
    if (!sidebar) return;

    let html = `
      <h3 style="margin-top:0;font-size:15px;color:#1e3a8a;border-bottom:2px solid #e2e8f0;padding-bottom:8px;display:flex;justify-content:space-between;align-items:center;">
        <span>📋 ${activeSession.isOfficial ? "Test Navigator" : (asm.title || "Practice Navigator")}</span>
        <button type="button" onclick="LQ.toggleAsmSidebar()" style="background:none;border:none;color:#64748b;font-size:16px;cursor:pointer;">✕</button>
      </h3>
      <div style="display:flex;flex-direction:column;gap:16px;margin-top:12px;">
    `;

    if (activeSession.isOfficial) {
      const currentSecIdx = currentQ ? currentQ.sectionIndex : 0;
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
    } else {
      // Practice Mode: flat question display (no sections)
      let answeredCount = 0;
      const questionsList = (asm.questions || []).map((q, qIdx) => {
        const isAnswered = activeSession.userAnswers[qIdx] !== undefined && activeSession.userAnswers[qIdx] !== null && activeSession.userAnswers[qIdx] !== "";
        if (isAnswered) answeredCount++;
        return {
          index: qIdx,
          isAnswered: isAnswered,
          isActive: qIdx === currentQIdx
        };
      });

      html += `
        <div style="padding:4px;">
          <div style="font-weight:700;font-size:13px;display:flex;justify-content:space-between;color:#1e40af;">
            <span>Questions</span>
            <span style="font-size:11px;font-weight:600;background:#e2e8f0;padding:2px 6px;border-radius:4px;color:#334155;">${answeredCount}/${questionsList.length} Ans</span>
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;">
      `;

      questionsList.forEach(qItem => {
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
    }

    html += `</div>`;
    sidebar.innerHTML = html;
  };

  LQ.selectPassageSubAnswer = function (qIdx, sqIdx, optIdx) {
    if (!activeSession) return;
    const current = activeSession.userAnswers[qIdx] || {};
    current[sqIdx] = optIdx;
    activeSession.userAnswers[qIdx] = current;
    LQ.renderSessionQuestion();
    syncLiveProgress();
  };

  LQ.savePassageSubTextAnswer = function (qIdx, sqIdx, value) {
    if (!activeSession) return;
    const current = activeSession.userAnswers[qIdx] || {};
    current[sqIdx] = value;
    activeSession.userAnswers[qIdx] = current;
    syncLiveProgress();
  };

  LQ.savePassageSubFibAnswer = function (qIdx, sqIdx, blankIdx, value) {
    if (!activeSession) return;
    const current = activeSession.userAnswers[qIdx] || {};
    let subAns = current[sqIdx];
    if (!Array.isArray(subAns)) {
      subAns = typeof subAns === 'string' && subAns !== '' ? [subAns] : [];
    }
    subAns[blankIdx] = value;
    current[sqIdx] = subAns;
    activeSession.userAnswers[qIdx] = current;
  };

  LQ.saveInlineBlankAnswer = function (blankIdx, value) {
    if (!activeSession) return;
    const qIdx = activeSession.currentIndex;
    let current = activeSession.userAnswers[qIdx];
    if (!Array.isArray(current)) {
      current = typeof current === 'string' && current !== '' ? [current] : [];
    }
    current[blankIdx] = value;
    activeSession.userAnswers[qIdx] = current;
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
