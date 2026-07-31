/**
 * Reports module — Student-wise, Test-wise, and Overall Organization Reports.
 */
window.LQ = window.LQ || {};

(function () {
  'use strict';

  var currentOrgId = null;
  var currentReportType = null; // 'cards', 'students', 'student-detail', 'tests', 'test-detail', 'overall'
  var currentPage = 1;
  var currentSearch = '';
  var currentFilter = 'all';
  var currentSortBy = '';
  var currentOrder = 'desc';
  var activeDetailId = null; // studentId or testId

  LQ.openOrgReport = function (orgId) {
    currentOrgId = orgId;
    currentReportType = 'cards';
    (window.goTo || LQ.goTo)('admin-reports');
  };

  LQ.renderAdminReportsPage = function (orgId) {
    var wrap = document.getElementById('admin-reports-wrap');
    if (!wrap) return;

    var state = LQ.Store.getState();
    var user = state.user;
    if (!user) return;

    // If orgId is passed explicitly or not set yet
    if (orgId) currentOrgId = orgId;
    if (!currentOrgId && user.orgId) currentOrgId = String(user.orgId);

    if (!currentReportType || currentReportType === 'cards') {
      renderCardsView(wrap);
    } else {
      renderActiveReportView(wrap);
    }
  };

  /* ══════════════════════════════════════════════════
     CARDS VIEW (Selector for the 3 Report Types)
     ══════════════════════════════════════════════════ */
  function renderCardsView(wrap) {
    currentReportType = 'cards';
    wrap.innerHTML =
      '<div class="admin-page-header">' +
        '<h2 class="admin-page-title">📊 Organization Reports</h2>' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(280px, 1fr));gap:20px;margin-top:16px;padding:0 20px;box-sizing:border-box;">' +
        // Card 1: Student-wise
        '<div class="report-card" onclick="LQ.selectReportType(\'students\')" style="background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:24px;cursor:pointer;transition:all 0.2s;box-shadow:0 4px 6px -1px rgba(0,0,0,0.05);" onmouseover="this.style.borderColor=\'#2563eb\';this.style.transform=\'translateY(-2px)\'" onmouseout="this.style.borderColor=\'#e2e8f0\';this.style.transform=\'none\'">' +
          '<div style="font-size:36px;margin-bottom:12px">👩‍🎓</div>' +
          '<h3 style="margin:0 0 6px;font-size:18px;font-weight:700;color:#0f172a">Student-Wise Report</h3>' +
          '<p style="margin:0;font-size:13px;color:#64748b;line-height:1.5">View individual student performance, total tests attended, overall scores, and test breakdown.</p>' +
        '</div>' +

        // Card 2: Test-wise
        '<div class="report-card" onclick="LQ.selectReportType(\'tests\')" style="background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:24px;cursor:pointer;transition:all 0.2s;box-shadow:0 4px 6px -1px rgba(0,0,0,0.05);" onmouseover="this.style.borderColor=\'#2563eb\';this.style.transform=\'translateY(-2px)\'" onmouseout="this.style.borderColor=\'#e2e8f0\';this.style.transform=\'none\'">' +
          '<div style="font-size:36px;margin-bottom:12px">📝</div>' +
          '<h3 style="margin:0 0 6px;font-size:18px;font-weight:700;color:#0f172a">Test-Wise Report</h3>' +
          '<p style="margin:0;font-size:13px;color:#64748b;line-height:1.5">Detailed breakdown per test, including student attempt counts, pass/fail ratios, and student rankings.</p>' +
        '</div>' +

        // Card 3: Overall
        '<div class="report-card" onclick="LQ.selectReportType(\'overall\')" style="background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:24px;cursor:pointer;transition:all 0.2s;box-shadow:0 4px 6px -1px rgba(0,0,0,0.05);" onmouseover="this.style.borderColor=\'#2563eb\';this.style.transform=\'translateY(-2px)\'" onmouseout="this.style.borderColor=\'#e2e8f0\';this.style.transform=\'none\'">' +
          '<div style="font-size:36px;margin-bottom:12px">📈</div>' +
          '<h3 style="margin:0 0 6px;font-size:18px;font-weight:700;color:#0f172a">Overall Org Report</h3>' +
          '<p style="margin:0;font-size:13px;color:#64748b;line-height:1.5">High-level summary of all assigned tests, total attempts, overall pass rates, and average performance.</p>' +
        '</div>' +
      '</div>';
  }

  LQ.selectReportType = function (type) {
    currentReportType = type;
    currentPage = 1;
    currentSearch = '';
    currentFilter = 'all';
    activeDetailId = null;
    var wrap = document.getElementById('admin-reports-wrap');
    if (wrap) renderActiveReportView(wrap);
  };

  function renderActiveReportView(wrap) {
    if (currentReportType === 'students') renderStudentsReport(wrap);
    else if (currentReportType === 'student-detail') renderStudentDetailReport(wrap);
    else if (currentReportType === 'tests') renderTestsReport(wrap);
    else if (currentReportType === 'test-detail') renderTestDetailReport(wrap);
    else if (currentReportType === 'overall') renderOverallReport(wrap);
    else renderCardsView(wrap);
  }

  /* ══════════════════════════════════════════════════
     1. STUDENT-WISE REPORT VIEW
     ══════════════════════════════════════════════════ */
  async function renderStudentsReport(wrap) {
    wrap.innerHTML =
      '<div class="admin-page-header">' +
        '<div style="display:flex;align-items:center;gap:10px">' +
          '<button type="button" class="admin-btn admin-btn-outline" onclick="LQ.selectReportType(\'cards\')">← Back</button>' +
          '<h2 class="admin-page-title" style="margin:0">👩‍🎓 Student-Wise Report</h2>' +
        '</div>' +
        '<button type="button" class="admin-btn admin-btn-primary" onclick="LQ.downloadReport(\'students\')">📥 Download Excel</button>' +
      '</div>' +
      '<div class="admin-search-bar" style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">' +
        '<input type="text" id="rpt-student-search" class="admin-search-input" style="flex:1;min-width:200px" placeholder="Search by student name or email..." value="' + LQ.esc(currentSearch) + '" oninput="LQ._onReportSearch(this.value)" />' +
      '</div>' +
      '<div id="rpt-table-wrap" class="admin-table-wrap"><p class="admin-loading">Loading student report...</p></div>' +
      '<div id="rpt-pagination" class="admin-pagination"></div>';

    try {
      var url = '/api/reports/students?orgId=' + currentOrgId + '&page=' + currentPage + '&search=' + encodeURIComponent(currentSearch);
      var resp = await fetch(url, { credentials: 'include' });
      var data = await resp.json();
      var tableWrap = document.getElementById('rpt-table-wrap');
      if (!tableWrap) return;

      if (!resp.ok || !data.ok) {
        tableWrap.innerHTML = '<p class="admin-error">' + LQ.esc(data.error || 'Failed to load report') + '</p>';
        return;
      }

      var list = data.students || [];
      if (!list.length) {
        tableWrap.innerHTML = '<p class="admin-empty">No student records found.</p>';
        return;
      }

      var html = '<div class="admin-table-responsive"><table class="admin-table">' +
        '<thead><tr><th>Name</th><th>Email</th><th>Register No</th><th>Branch</th><th>Tests Attended</th><th>Score</th><th>Avg %</th><th>Actions</th></tr></thead><tbody>';

      list.forEach(function (s) {
        html +=
          '<tr>' +
            '<td><strong>' + LQ.esc(s.name) + '</strong></td>' +
            '<td>' + LQ.esc(s.email) + '</td>' +
            '<td>' + LQ.esc(s.registerNo || '-') + '</td>' +
            '<td>' + LQ.esc(s.branch || '-') + '</td>' +
            '<td><span class="admin-chip">' + s.testsAttended + ' tests</span></td>' +
            '<td>' + s.earnedMarks + ' / ' + s.totalMarks + '</td>' +
            '<td><strong style="color:' + (s.avgPercentage >= 30 ? '#16a34a' : '#dc2626') + '">' + s.avgPercentage + '%</strong></td>' +
            '<td><button class="admin-btn admin-btn-outline admin-btn-sm" onclick="LQ.viewStudentDetail(\'' + s.id + '\')">👁️ View</button></td>' +
          '</tr>';
      });

      html += '</tbody></table></div>';
      tableWrap.innerHTML = html;

      renderReportPagination(data.pagination, 'rpt-pagination');
    } catch (err) {
      var tableWrap = document.getElementById('rpt-table-wrap');
      if (tableWrap) tableWrap.innerHTML = '<p class="admin-error">Failed to load student report.</p>';
    }
  }

  LQ.viewStudentDetail = function (studentId) {
    activeDetailId = studentId;
    currentReportType = 'student-detail';
    var wrap = document.getElementById('admin-reports-wrap');
    if (wrap) renderStudentDetailReport(wrap);
  };

  async function renderStudentDetailReport(wrap) {
    wrap.innerHTML = '<p class="admin-loading">Loading student detail...</p>';

    try {
      var url = '/api/reports/students/' + activeDetailId + '?orgId=' + currentOrgId;
      var resp = await fetch(url, { credentials: 'include' });
      var data = await resp.json();

      if (!resp.ok || !data.ok) {
        wrap.innerHTML = '<div class="admin-page-header"><button type="button" class="admin-btn admin-btn-outline" onclick="LQ.selectReportType(\'students\')">← Back</button></div><p class="admin-error">' + LQ.esc(data.error || 'Failed to load') + '</p>';
        return;
      }

      var st = data.student || {};
      var sum = data.summary || {};
      var tests = data.tests || [];

      var html =
        '<div class="admin-page-header">' +
          '<div style="display:flex;align-items:center;gap:10px">' +
            '<button type="button" class="admin-btn admin-btn-outline" onclick="LQ.selectReportType(\'students\')">← Back to Students</button>' +
            '<h2 class="admin-page-title" style="margin:0">👤 ' + LQ.esc(st.name) + ' — Report</h2>' +
          '</div>' +
          '<button type="button" class="admin-btn admin-btn-primary" onclick="LQ.downloadReport(\'student-detail\', \'' + activeDetailId + '\')">📥 Download Excel</button>' +
        '</div>' +

        // Summary cards
        '<div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(180px, 1fr));gap:14px;margin-bottom:20px;">' +
          '<div style="background:#fff;border:1px solid #e2e8f0;padding:16px;border-radius:12px;text-align:center"><div style="font-size:12px;color:#64748b">Total Tests Attended</div><div style="font-size:24px;font-weight:800;color:#0f172a">' + sum.totalTests + '</div></div>' +
          '<div style="background:#fff;border:1px solid #e2e8f0;padding:16px;border-radius:12px;text-align:center"><div style="font-size:12px;color:#64748b">Passed Tests</div><div style="font-size:24px;font-weight:800;color:#16a34a">' + sum.passed + '</div></div>' +
          '<div style="background:#fff;border:1px solid #e2e8f0;padding:16px;border-radius:12px;text-align:center"><div style="font-size:12px;color:#64748b">Failed Tests</div><div style="font-size:24px;font-weight:800;color:#dc2626">' + sum.failed + '</div></div>' +
          '<div style="background:#fff;border:1px solid #e2e8f0;padding:16px;border-radius:12px;text-align:center"><div style="font-size:12px;color:#64748b">Overall Score Avg</div><div style="font-size:24px;font-weight:800;color:#2563eb">' + sum.avgPercentage + '%</div></div>' +
        '</div>' +

        '<div class="admin-table-wrap">';

      if (!tests.length) {
        html += '<p class="admin-empty">This student has not completed any tests yet.</p>';
      } else {
        html += '<div class="admin-table-responsive"><table class="admin-table">' +
          '<thead><tr><th>Test Title</th><th>Score Marks</th><th>Correct / Total Qs</th><th>Percentage (%)</th><th>Status</th><th>Date</th></tr></thead><tbody>';

        tests.forEach(function (t) {
          var isPassed = t.status === 'Passed';
          html +=
            '<tr>' +
              '<td><strong>' + LQ.esc(t.testTitle) + '</strong></td>' +
              '<td>' + t.earnedMarks + ' / ' + t.totalMarks + '</td>' +
              '<td>' + t.correctCount + ' / ' + t.totalQuestions + '</td>' +
              '<td><strong style="color:' + (isPassed ? '#16a34a' : '#dc2626') + '">' + t.percentage + '%</strong></td>' +
              '<td><span style="background:' + (isPassed ? '#dcfce7' : '#fee2e2') + ';color:' + (isPassed ? '#15803d' : '#991b1b') + ';font-size:12px;font-weight:700;padding:3px 10px;border-radius:20px;">' + (isPassed ? '🎉 PASSED' : '🔴 FAILED') + '</span></td>' +
              '<td>' + (t.completedAt ? new Date(t.completedAt).toLocaleDateString() : '-') + '</td>' +
            '</tr>';
        });

        html += '</tbody></table></div>';
      }

      html += '</div>';
      wrap.innerHTML = html;
    } catch (err) {
      wrap.innerHTML = '<p class="admin-error">Failed to load student detail report.</p>';
    }
  }

  /* ══════════════════════════════════════════════════
     2. TEST-WISE REPORT VIEW
     ══════════════════════════════════════════════════ */
  async function renderTestsReport(wrap) {
    wrap.innerHTML =
      '<div class="admin-page-header">' +
        '<div style="display:flex;align-items:center;gap:10px">' +
          '<button type="button" class="admin-btn admin-btn-outline" onclick="LQ.selectReportType(\'cards\')">← Back</button>' +
          '<h2 class="admin-page-title" style="margin:0">📝 Test-Wise Report</h2>' +
        '</div>' +
        '<button type="button" class="admin-btn admin-btn-primary" onclick="LQ.downloadReport(\'tests\')">📥 Download Excel</button>' +
      '</div>' +
      '<div class="admin-search-bar" style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">' +
        '<input type="text" id="rpt-test-search" class="admin-search-input" style="flex:1;min-width:200px" placeholder="Search by test title..." value="' + LQ.esc(currentSearch) + '" oninput="LQ._onReportSearch(this.value)" />' +
      '</div>' +
      '<div id="rpt-table-wrap" class="admin-table-wrap"><p class="admin-loading">Loading test report...</p></div>' +
      '<div id="rpt-pagination" class="admin-pagination"></div>';

    try {
      var url = '/api/reports/tests?orgId=' + currentOrgId + '&page=' + currentPage + '&search=' + encodeURIComponent(currentSearch);
      var resp = await fetch(url, { credentials: 'include' });
      var data = await resp.json();
      var tableWrap = document.getElementById('rpt-table-wrap');
      if (!tableWrap) return;

      if (!resp.ok || !data.ok) {
        tableWrap.innerHTML = '<p class="admin-error">' + LQ.esc(data.error || 'Failed to load report') + '</p>';
        return;
      }

      var list = data.tests || [];
      if (!list.length) {
        tableWrap.innerHTML = '<p class="admin-empty">No test records found.</p>';
        return;
      }

      var html = '<div class="admin-table-responsive"><table class="admin-table">' +
        '<thead><tr><th>Test Title</th><th>Total Qs</th><th>Total Marks</th><th>Attempted</th><th>Passed</th><th>Failed</th><th>Avg %</th><th>Top Scorer</th><th>Actions</th></tr></thead><tbody>';

      list.forEach(function (t) {
        html +=
          '<tr>' +
            '<td><strong>' + LQ.esc(t.title) + '</strong></td>' +
            '<td>' + t.totalQuestions + '</td>' +
            '<td>' + t.totalMarks + '</td>' +
            '<td><span class="admin-chip">' + t.totalStudents + ' students</span></td>' +
            '<td><span style="color:#16a34a;font-weight:700">' + t.passed + '</span></td>' +
            '<td><span style="color:#dc2626;font-weight:700">' + t.failed + '</span></td>' +
            '<td><strong>' + t.avgPercentage + '%</strong></td>' +
            '<td>' + LQ.esc(t.topScorer) + (t.topScore ? ' (' + t.topScore + '%)' : '') + '</td>' +
            '<td><button class="admin-btn admin-btn-outline admin-btn-sm" onclick="LQ.viewTestDetail(\'' + t.id + '\')">👁️ View Details</button></td>' +
          '</tr>';
      });

      html += '</tbody></table></div>';
      tableWrap.innerHTML = html;

      renderReportPagination(data.pagination, 'rpt-pagination');
    } catch (err) {
      var tableWrap = document.getElementById('rpt-table-wrap');
      if (tableWrap) tableWrap.innerHTML = '<p class="admin-error">Failed to load test report.</p>';
    }
  }

  LQ.viewTestDetail = function (testId) {
    activeDetailId = testId;
    currentReportType = 'test-detail';
    currentPage = 1;
    currentSearch = '';
    currentFilter = 'all';
    currentSortBy = 'percentage';
    currentOrder = 'desc';
    var wrap = document.getElementById('admin-reports-wrap');
    if (wrap) renderTestDetailReport(wrap);
  };

  async function renderTestDetailReport(wrap) {
    wrap.innerHTML = '<p class="admin-loading">Loading test performance details...</p>';

    try {
      var url = '/api/reports/tests/' + activeDetailId + '?orgId=' + currentOrgId + '&page=' + currentPage + '&search=' + encodeURIComponent(currentSearch) + '&sortBy=' + currentSortBy + '&order=' + currentOrder;
      var resp = await fetch(url, { credentials: 'include' });
      var data = await resp.json();

      if (!resp.ok || !data.ok) {
        wrap.innerHTML = '<div class="admin-page-header"><button type="button" class="admin-btn admin-btn-outline" onclick="LQ.selectReportType(\'tests\')">← Back</button></div><p class="admin-error">' + LQ.esc(data.error || 'Failed to load') + '</p>';
        return;
      }

      var test = data.test || {};
      var sum = data.summary || {};
      var students = data.students || [];

      var html =
        '<div class="admin-page-header">' +
          '<div style="display:flex;align-items:center;gap:10px">' +
            '<button type="button" class="admin-btn admin-btn-outline" onclick="LQ.selectReportType(\'tests\')">← Back to Tests</button>' +
            '<h2 class="admin-page-title" style="margin:0">📝 ' + LQ.esc(test.title) + ' — Performance</h2>' +
          '</div>' +
          '<button type="button" class="admin-btn admin-btn-primary" onclick="LQ.promptTestDetailDownload(\'' + activeDetailId + '\')">📥 Download Excel</button>' +
        '</div>' +

        // Summary cards
        '<div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(180px, 1fr));gap:14px;margin-bottom:20px;">' +
          '<div style="background:#fff;border:1px solid #e2e8f0;padding:16px;border-radius:12px;text-align:center"><div style="font-size:12px;color:#64748b">Total Attempted</div><div style="font-size:24px;font-weight:800;color:#0f172a">' + sum.totalStudents + '</div></div>' +
          '<div style="background:#fff;border:1px solid #e2e8f0;padding:16px;border-radius:12px;text-align:center"><div style="font-size:12px;color:#64748b">Passed</div><div style="font-size:24px;font-weight:800;color:#16a34a">' + sum.passed + '</div></div>' +
          '<div style="background:#fff;border:1px solid #e2e8f0;padding:16px;border-radius:12px;text-align:center"><div style="font-size:12px;color:#64748b">Failed</div><div style="font-size:24px;font-weight:800;color:#dc2626">' + sum.failed + '</div></div>' +
          '<div style="background:#fff;border:1px solid #e2e8f0;padding:16px;border-radius:12px;text-align:center"><div style="font-size:12px;color:#64748b">Average Score</div><div style="font-size:24px;font-weight:800;color:#2563eb">' + sum.avgPercentage + '%</div></div>' +
        '</div>' +

        '<div class="admin-search-bar" style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">' +
          '<input type="text" id="rpt-test-detail-search" class="admin-search-input" style="flex:1;min-width:200px" placeholder="Search student by name or email..." value="' + LQ.esc(currentSearch) + '" oninput="LQ._onReportSearch(this.value)" />' +
          '<select class="admin-search-input" style="width:auto;min-width:160px" onchange="LQ._onTestDetailSort(this.value)">' +
            '<option value="desc"' + (currentOrder === 'desc' ? ' selected' : '') + '>Sort: Top to Bottom (High→Low)</option>' +
            '<option value="asc"' + (currentOrder === 'asc' ? ' selected' : '') + '>Sort: Bottom to Top (Low→High)</option>' +
          '</select>' +
        '</div>' +

        '<div id="rpt-table-wrap" class="admin-table-wrap">';

      if (!students.length) {
        html += '<p class="admin-empty">No student attempts recorded for this test.</p>';
      } else {
        html += '<div class="admin-table-responsive"><table class="admin-table">' +
          '<thead><tr><th>Rank</th><th>Student Name</th><th>Email</th><th>Correct / Total Qs</th><th>Marks</th><th>Percentage (%)</th><th>Status</th><th>Actions</th></tr></thead><tbody>';

        students.forEach(function (s) {
          var statusHtml = '';
          var actionHtml = '<span style="color:#94a3b8;font-size:12px">-</span>';
          
          if (s.status === 'In Progress') {
            statusHtml = '<span style="background:#fef3c7;color:#d97706;font-size:12px;font-weight:700;padding:3px 10px;border-radius:20px;">⏳ IN PROGRESS</span>';
            actionHtml = '<button type="button" class="admin-btn admin-btn-primary admin-btn-sm" style="padding:2px 8px;font-size:11px" onclick="LQ.forceSubmitTestAttempt(\'' + s.attemptId + '\', this)">⚡ Submit</button>';
          } else {
            var isPassed = s.status === 'Passed';
            statusHtml = '<span style="background:' + (isPassed ? '#dcfce7' : '#fee2e2') + ';color:' + (isPassed ? '#15803d' : '#991b1b') + ';font-size:12px;font-weight:700;padding:3px 10px;border-radius:20px;">' + (isPassed ? '🎉 PASSED' : '🔴 FAILED') + '</span>';
          }

          html +=
            '<tr>' +
              '<td><strong>#' + s.rank + '</strong></td>' +
              '<td><strong>' + LQ.esc(s.name) + '</strong></td>' +
              '<td>' + LQ.esc(s.email) + '</td>' +
              '<td>' + (s.status === 'In Progress' ? '-' : s.correctCount + ' / ' + s.totalQuestions) + '</td>' +
              '<td>' + (s.status === 'In Progress' ? '-' : s.earnedMarks + ' / ' + s.totalMarks) + '</td>' +
              '<td>' + (s.status === 'In Progress' ? '-' : '<strong style="color:' + (s.status === 'Passed' ? '#16a34a' : '#dc2626') + '">' + s.percentage + '%</strong>') + '</td>' +
              '<td>' + statusHtml + '</td>' +
              '<td>' + actionHtml + '</td>' +
            '</tr>';
        });

        html += '</tbody></table></div>';
      }

      html += '</div><div id="rpt-pagination" class="admin-pagination"></div>';
      wrap.innerHTML = html;

      renderReportPagination(data.pagination, 'rpt-pagination');
    } catch (err) {
      wrap.innerHTML = '<p class="admin-error">Failed to load test detail report.</p>';
    }
  }

  LQ._onTestDetailSort = function (orderVal) {
    currentOrder = orderVal;
    currentPage = 1;
    var wrap = document.getElementById('admin-reports-wrap');
    if (wrap) renderTestDetailReport(wrap);
  };

  LQ.promptTestDetailDownload = function (testId) {
    var modalHtml =
      '<div id="excel-sort-modal" style="position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(15,23,42,0.6);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;z-index:99999;">' +
        '<div style="background:#fff;border-radius:16px;padding:28px;width:90%;max-width:400px;box-shadow:0 20px 25px -5px rgba(0,0,0,0.1);box-sizing:border-box">' +
          '<h3 style="margin:0 0 12px;font-size:18px;font-weight:700;color:#0f172a">📊 Download Excel Report</h3>' +
          '<p style="margin:0 0 16px;font-size:14px;color:#64748b">Select how you want the student scores sorted in the Excel sheet:</p>' +
          '<div style="display:flex;flex-direction:column;gap:10px;margin-bottom:20px;">' +
            '<label style="display:flex;align-items:center;gap:10px;font-size:14px;cursor:pointer;"><input type="radio" name="xl-sort" value="desc" checked /> Top to Bottom (High Score → Low Score)</label>' +
            '<label style="display:flex;align-items:center;gap:10px;font-size:14px;cursor:pointer;"><input type="radio" name="xl-sort" value="asc" /> Bottom to Top (Low Score → High Score)</label>' +
          '</div>' +
          '<div style="display:flex;gap:12px">' +
            '<button type="button" id="xl-cancel-btn" style="flex:1;padding:10px;border:1px solid #cbd5e1;background:#fff;color:#334155;border-radius:8px;font-weight:600;cursor:pointer;">Cancel</button>' +
            '<button type="button" id="xl-confirm-btn" style="flex:1;padding:10px;border:none;background:#2563eb;color:#fff;border-radius:8px;font-weight:600;cursor:pointer;">Download Excel</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    var div = document.createElement('div');
    div.innerHTML = modalHtml;
    var modalEl = div.firstChild;
    document.body.appendChild(modalEl);

    modalEl.querySelector('#xl-cancel-btn').onclick = function () { modalEl.remove(); };
    modalEl.querySelector('#xl-confirm-btn').onclick = function () {
      var selectedOrder = modalEl.querySelector('input[name="xl-sort"]:checked').value;
      modalEl.remove();
      LQ.downloadReport('test-detail', testId, selectedOrder);
    };
  };

  /* ══════════════════════════════════════════════════
     3. OVERALL ORG REPORT VIEW
     ══════════════════════════════════════════════════ */
  async function renderOverallReport(wrap) {
    wrap.innerHTML =
      '<div class="admin-page-header">' +
        '<div style="display:flex;align-items:center;gap:10px">' +
          '<button type="button" class="admin-btn admin-btn-outline" onclick="LQ.selectReportType(\'cards\')">← Back</button>' +
          '<h2 class="admin-page-title" style="margin:0">📈 Overall Organization Report</h2>' +
        '</div>' +
        '<button type="button" class="admin-btn admin-btn-primary" onclick="LQ.downloadReport(\'overall\')">📥 Download Excel</button>' +
      '</div>' +
      '<div class="admin-search-bar" style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">' +
        '<input type="text" id="rpt-overall-search" class="admin-search-input" style="flex:1;min-width:200px" placeholder="Search by test title..." value="' + LQ.esc(currentSearch) + '" oninput="LQ._onReportSearch(this.value)" />' +
      '</div>' +
      '<div id="rpt-table-wrap" class="admin-table-wrap"><p class="admin-loading">Loading overall report...</p></div>' +
      '<div id="rpt-pagination" class="admin-pagination"></div>';

    try {
      var url = '/api/reports/overall?orgId=' + currentOrgId + '&page=' + currentPage + '&search=' + encodeURIComponent(currentSearch);
      var resp = await fetch(url, { credentials: 'include' });
      var data = await resp.json();
      var tableWrap = document.getElementById('rpt-table-wrap');
      if (!tableWrap) return;

      if (!resp.ok || !data.ok) {
        tableWrap.innerHTML = '<p class="admin-error">' + LQ.esc(data.error || 'Failed to load report') + '</p>';
        return;
      }

      var list = data.tests || [];
      var sum = data.orgSummary || {};

      if (!list.length) {
        tableWrap.innerHTML = '<p class="admin-empty">No assigned test records found.</p>';
        return;
      }

      var html =
        '<div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(180px, 1fr));gap:14px;margin-bottom:20px;">' +
          '<div style="background:#fff;border:1px solid #e2e8f0;padding:16px;border-radius:12px;text-align:center"><div style="font-size:12px;color:#64748b">Total Tests</div><div style="font-size:24px;font-weight:800;color:#0f172a">' + sum.totalTests + '</div></div>' +
          '<div style="background:#fff;border:1px solid #e2e8f0;padding:16px;border-radius:12px;text-align:center"><div style="font-size:12px;color:#64748b">Total Test Attempts</div><div style="font-size:24px;font-weight:800;color:#2563eb">' + sum.totalAttempts + '</div></div>' +
          '<div style="background:#fff;border:1px solid #e2e8f0;padding:16px;border-radius:12px;text-align:center"><div style="font-size:12px;color:#64748b">Org Average Score</div><div style="font-size:24px;font-weight:800;color:#16a34a">' + sum.avgPercentage + '%</div></div>' +
        '</div>' +

        '<div class="admin-table-responsive"><table class="admin-table">' +
          '<thead><tr><th>Test Title</th><th>Assigned Status</th><th>Total Qs</th><th>Total Marks</th><th>Attempts</th><th>Passed</th><th>Failed</th><th>Avg %</th><th>Pass Rate %</th></tr></thead><tbody>';

      list.forEach(function (t) {
        var attemptsHtml = t.totalAttempted > 0
          ? '<button class="admin-btn admin-btn-outline admin-btn-sm" style="color:#2563eb;font-weight:700;border-color:#bfdbfe;background:#eff6ff;cursor:pointer" onclick="LQ.viewTestDetail(\'' + t.id + '\')" title="View ' + t.totalAttempted + ' student attempts">' + t.totalAttempted + ' Attended</button>'
          : '<span style="color:#94a3b8;font-size:12px">0 Attended</span>';

        html +=
          '<tr>' +
            '<td><strong>' + LQ.esc(t.title) + '</strong></td>' +
            '<td>' + (t.isAssigned ? '<span style="color:#16a34a;font-weight:600">Assigned</span>' : '<span style="color:#94a3b8">Draft</span>') + '</td>' +
            '<td>' + t.totalQuestions + '</td>' +
            '<td>' + t.totalMarks + '</td>' +
            '<td>' + attemptsHtml + '</td>' +
            '<td><span style="color:#16a34a;font-weight:700">' + t.passed + '</span></td>' +
            '<td><span style="color:#dc2626;font-weight:700">' + t.failed + '</span></td>' +
            '<td><strong>' + t.avgPercentage + '%</strong></td>' +
            '<td><span style="background:#eff6ff;color:#1d4ed8;font-weight:700;padding:3px 10px;border-radius:20px;">' + t.passRate + '%</span></td>' +
          '</tr>';
      });

      html += '</tbody></table></div>';
      tableWrap.innerHTML = html;

      renderReportPagination(data.pagination, 'rpt-pagination');
    } catch (err) {
      var tableWrap = document.getElementById('rpt-table-wrap');
      if (tableWrap) tableWrap.innerHTML = '<p class="admin-error">Failed to load overall report.</p>';
    }
  }

  /* ══════════════════════════════════════════════════
     HELPER: SEARCH & PAGINATION & EXCEL DOWNLOAD
     ══════════════════════════════════════════════════ */

  var searchTimer = null;
  LQ._onReportSearch = function (val) {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(function () {
      currentSearch = val;
      currentPage = 1;
      var wrap = document.getElementById('admin-reports-wrap');
      if (wrap) renderActiveReportView(wrap);
    }, 400);
  };

  LQ.changeReportPage = function (newPage) {
    currentPage = newPage;
    var wrap = document.getElementById('admin-reports-wrap');
    if (wrap) renderActiveReportView(wrap);
  };

  function renderReportPagination(pag, elId) {
    var pEl = document.getElementById(elId);
    if (!pEl || !pag || pag.totalPages <= 1) {
      if (pEl) pEl.innerHTML = '';
      return;
    }

    var p = pag.page;
    var tp = pag.totalPages;
    
    var pagHtml = '<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;justify-content:center;margin-top:16px">' +
      '<span style="font-size:13px;color:#64748b">Total: <strong>' + pag.total + '</strong> (Page ' + p + ' of ' + tp + ')</span>' +
      '<div style="display:flex;gap:4px">';

    if (p > 1) {
      pagHtml += '<button class="admin-page-btn" onclick="LQ.changeReportPage(' + (p - 1) + ')">← Prev</button>';
    }

    for (var i = 1; i <= tp; i++) {
      if (i === 1 || i === tp || (i >= p - 2 && i <= p + 2)) {
        pagHtml += '<button class="admin-page-btn' + (i === p ? ' active' : '') + '" onclick="LQ.changeReportPage(' + i + ')">' + i + '</button>';
      } else if (i === p - 3 || i === p + 3) {
        pagHtml += '<span style="padding:4px 8px;color:#64748b">...</span>';
      }
    }

    if (p < tp) {
      pagHtml += '<button class="admin-page-btn" onclick="LQ.changeReportPage(' + (p + 1) + ')">Next →</button>';
    }

    pagHtml += '</div></div>';
    pEl.innerHTML = pagHtml;
  }

  LQ.downloadReport = function (type, detailId, orderOverride) {
    var url = '/api/reports/download/' + type + '?orgId=' + currentOrgId;
    if (type === 'student-detail' && detailId) url += '&studentId=' + detailId;
    if (type === 'test-detail' && detailId) url += '&testId=' + detailId;
    if (orderOverride) url += '&order=' + orderOverride;
    else if (currentOrder) url += '&order=' + currentOrder;

    window.open(url, '_blank');
  };

  LQ.forceSubmitTestAttempt = function (attemptId, btn) {
    var modalHtml =
      '<div id="force-submit-modal" style="position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(15,23,42,0.6);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;z-index:99999;">' +
        '<div style="background:#fff;border-radius:16px;padding:28px;width:90%;max-width:400px;box-shadow:0 20px 25px -5px rgba(0,0,0,0.1);box-sizing:border-box">' +
          '<h3 style="margin:0 0 12px;font-size:18px;font-weight:700;color:#0f172a">⚡ Force Submit Test</h3>' +
          '<p style="margin:0 0 20px;font-size:14px;color:#64748b;line-height:1.5">Are you sure you want to force submit this student\'s test attempt? This will end their session, grade their answers, and finalize their score.</p>' +
          '<div style="display:flex;gap:12px">' +
            '<button type="button" id="fs-cancel-btn" style="flex:1;padding:10px;border:1px solid #cbd5e1;background:#fff;color:#334155;border-radius:8px;font-weight:600;cursor:pointer;">Cancel</button>' +
            '<button type="button" id="fs-confirm-btn" style="flex:1;padding:10px;border:none;background:#c0392b;color:#fff;border-radius:8px;font-weight:600;cursor:pointer;">Yes, Submit</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    var div = document.createElement('div');
    div.innerHTML = modalHtml;
    var modalEl = div.firstChild;
    document.body.appendChild(modalEl);

    modalEl.querySelector('#fs-cancel-btn').onclick = function () { modalEl.remove(); };
    modalEl.querySelector('#fs-confirm-btn').onclick = async function () {
      modalEl.remove();
      if (btn) { btn.disabled = true; btn.textContent = 'Submitting...'; }
      try {
        var resp = await fetch('/api/admin/attempts/' + attemptId + '/force-submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include'
        });
        var data = await resp.json();
        if (resp.ok && data.ok) {
          LQ.toast('Attempt force-submitted successfully!');
          var wrap = document.getElementById('admin-reports-wrap');
          if (wrap) renderActiveReportView(wrap);
        } else {
          LQ.toast(data.error || 'Failed to submit attempt.');
          if (btn) { btn.disabled = false; btn.textContent = '⚡ Submit'; }
        }
      } catch (e) {
        LQ.toast('Network error. Please try again.');
        if (btn) { btn.disabled = false; btn.textContent = '⚡ Submit'; }
      }
    };
  };

})();
