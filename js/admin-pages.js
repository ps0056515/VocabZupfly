/**
 * Admin management pages — Student list, add student, bulk upload, admin list, profile.
 */
window.LQ = window.LQ || {};

/* ══════════════════════════════════════════════════
   STUDENT LIST PAGE
   ══════════════════════════════════════════════════ */

LQ.renderAdminStudentsPage = async function () {
  var wrap = document.getElementById('admin-students-wrap');
  if (!wrap) return;

  var state = LQ.Store.getState();
  var user = state.user;
  if (!user) return;

  var isSuperAdmin = user.role === 'super_admin';

  wrap.innerHTML =
    '<div class="admin-page-header">' +
      '<h2 class="admin-page-title">👩‍🎓 Students</h2>' +
      '<div class="admin-header-actions">' +
        '<button type="button" class="admin-btn admin-btn-outline" onclick="LQ.renderBulkUploadForm()">📤 Bulk Upload</button>' +
        '<button type="button" class="admin-btn admin-btn-primary" onclick="LQ.renderAddStudentForm()">+ Add Student</button>' +
      '</div>' +
    '</div>' +
    '<div class="admin-search-bar" style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">' +
      '<input type="text" id="admin-student-search" class="admin-search-input" style="flex:1;min-width:200px" placeholder="Search by name, email, or register no..." oninput="LQ._debounceStudentSearch()" />' +
      (isSuperAdmin ? '<select id="admin-student-org-filter" class="admin-search-input" style="width:auto;min-width:160px" onchange="LQ._onStudentOrgFilterChange(this.value)"><option value="all">All Organizations</option></select>' : '') +
      '<select id="admin-student-status-filter" class="admin-search-input" style="width:auto;min-width:130px" onchange="LQ._onStudentStatusFilterChange(this.value)"><option value="all">Status: All</option><option value="active">Active Only</option><option value="inactive">Inactive Only</option></select>' +
    '</div>' +
    '<div id="admin-students-table-wrap" class="admin-table-wrap"><p class="admin-loading">Loading students...</p></div>' +
    '<div id="admin-students-pagination" class="admin-pagination"></div>';

  LQ._studentPage = 1;
  LQ._studentSearch = '';
  LQ._studentStatusFilter = 'all';
  if (!isSuperAdmin) {
    LQ._studentOrgFilter = 'all';
  } else if (!LQ._studentOrgFilter) {
    LQ._studentOrgFilter = 'all';
  }

  // Populate Org filter dropdown for Super Admin
  if (isSuperAdmin) {
    try {
      var resp = await fetch('/api/admin/orgs', { credentials: 'include' });
      var data = await resp.json();
      if (data.ok && data.orgs) {
        var sel = document.getElementById('admin-student-org-filter');
        if (sel) {
          var opts = '<option value="all">All Organizations</option>';
          data.orgs.forEach(function (o) {
            opts += '<option value="' + o._id + '"' + (LQ._studentOrgFilter === o._id ? ' selected' : '') + '>' + LQ.esc(o.name) + '</option>';
          });
          sel.innerHTML = opts;
        }
      }
    } catch (e) {}
  }

  LQ._loadStudents();
};

LQ._onStudentOrgFilterChange = function (val) {
  LQ._studentOrgFilter = val;
  LQ._studentPage = 1;
  LQ._loadStudents();
};

LQ._onStudentStatusFilterChange = function (val) {
  LQ._studentStatusFilter = val;
  LQ._studentPage = 1;
  LQ._loadStudents();
};

LQ.filterStudentsByOrg = function (orgId) {
  LQ._studentOrgFilter = orgId;
  LQ._studentPage = 1;
  goTo('admin-students');
};

LQ._debounceStudentSearch = (function () {
  var timer;
  return function () {
    clearTimeout(timer);
    timer = setTimeout(function () {
      LQ._studentSearch = (document.getElementById('admin-student-search') || {}).value || '';
      LQ._studentPage = 1;
      LQ._loadStudents();
    }, 300);
  };
})();

LQ._loadStudents = async function () {
  var tableWrap = document.getElementById('admin-students-table-wrap');
  var pagWrap = document.getElementById('admin-students-pagination');
  if (!tableWrap) return;

  tableWrap.innerHTML = '<p class="admin-loading">Loading students...</p>';

  try {
    var url = '/api/admin/students?page=' + LQ._studentPage + '&limit=20';
    if (LQ._studentSearch) url += '&search=' + encodeURIComponent(LQ._studentSearch);
    if (LQ._studentOrgFilter && LQ._studentOrgFilter !== 'all') url += '&orgId=' + encodeURIComponent(LQ._studentOrgFilter);
    if (LQ._studentStatusFilter && LQ._studentStatusFilter !== 'all') url += '&status=' + encodeURIComponent(LQ._studentStatusFilter);

    var resp = await fetch(url, { credentials: 'include' });
    var data = await resp.json();

    if (!resp.ok) {
      tableWrap.innerHTML = '<p class="admin-error">' + LQ.esc(data.error || 'Failed to load') + '</p>';
      return;
    }

    var students = data.students || [];
    var pag = data.pagination || {};

    if (!students.length) {
      tableWrap.innerHTML = '<p class="admin-empty">No students found matching current filters.</p>';
      if (pagWrap) pagWrap.innerHTML = '';
      return;
    }

    var html = '<div class="admin-table-responsive"><table class="admin-table">' +
      '<thead><tr>' +
        '<th>Name</th><th>Email</th><th>Phone</th><th>Gender</th><th>Reg. No</th><th>Branch</th><th>Organization</th><th>Status</th><th>Actions</th>' +
      '</tr></thead><tbody>';

    students.forEach(function (s) {
      var orgName = s.orgId && s.orgId.name ? s.orgId.name : 'Panimalar';
      var isActive = s.isActive !== false;
      var statusBadge = isActive
        ? '<span style="color:#16a34a;font-weight:700">🟢 Active</span>'
        : '<span style="color:#dc2626;font-weight:700">🔴 Inactive</span>';

      var toggleBtn = isActive
        ? '<button class="admin-btn admin-btn-danger admin-btn-sm" title="Deactivate student" onclick="LQ._toggleStudentStatus(\'' + s._id + '\', false, \'' + LQ.esc(s.name) + '\')">Deactivate</button>'
        : '<button class="admin-btn admin-btn-outline admin-btn-sm" style="border-color:#16a34a;color:#16a34a;font-weight:700" title="Activate student" onclick="LQ._toggleStudentStatus(\'' + s._id + '\', true, \'' + LQ.esc(s.name) + '\')">Activate</button>';

      html +=
        '<tr' + (!isActive ? ' style="opacity:0.65;background:#fef2f2"' : '') + '>' +
          '<td><strong>' + LQ.esc(s.name) + '</strong></td>' +
          '<td>' + LQ.esc(s.email) + '</td>' +
          '<td>' + LQ.esc(s.phone || '—') + '</td>' +
          '<td class="admin-capitalize">' + LQ.esc(s.gender || '—') + '</td>' +
          '<td>' + LQ.esc(s.registerNo || '—') + '</td>' +
          '<td>' + LQ.esc(s.branch || '—') + '</td>' +
          '<td>' + LQ.esc(orgName) + '</td>' +
          '<td>' + statusBadge + '</td>' +
          '<td class="admin-actions-cell" style="display:flex;gap:6px;align-items:center">' +
            '<button class="admin-btn admin-btn-outline admin-btn-sm" title="Reset Password to default (Test@123)" onclick="LQ._resetStudentPassword(\'' + s._id + '\',\'' + LQ.esc(s.name) + '\')">🔑 Reset PW</button>' +
            toggleBtn +
          '</td>' +
        '</tr>';
    });

    html += '</tbody></table></div>';
    tableWrap.innerHTML = html;

    // Pagination
    if (pagWrap) {
      if (pag.pages > 1 || pag.total > 0) {
        var pagHtml = '<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;justify-content:center">' +
          '<span style="font-size:13px;color:#64748b">Total: <strong>' + pag.total + '</strong> (Page ' + pag.page + ' of ' + pag.pages + ')</span>' +
          '<div style="display:flex;gap:4px">';

        if (pag.page > 1) {
          pagHtml += '<button class="admin-page-btn" onclick="LQ._studentPage=' + (pag.page - 1) + ';LQ._loadStudents()">← Prev</button>';
        }

        for (var i = 1; i <= pag.pages; i++) {
          if (i === 1 || i === pag.pages || (i >= pag.page - 2 && i <= pag.page + 2)) {
            pagHtml += '<button class="admin-page-btn' + (i === pag.page ? ' active' : '') + '" onclick="LQ._studentPage=' + i + ';LQ._loadStudents()">' + i + '</button>';
          } else if (i === pag.page - 3 || i === pag.page + 3) {
            pagHtml += '<span style="padding:4px 8px;color:#64748b">...</span>';
          }
        }

        if (pag.page < pag.pages) {
          pagHtml += '<button class="admin-page-btn" onclick="LQ._studentPage=' + (pag.page + 1) + ';LQ._loadStudents()">Next →</button>';
        }

        pagHtml += '</div></div>';
        pagWrap.innerHTML = pagHtml;
      } else {
        pagWrap.innerHTML = '';
      }
    }
  } catch (err) {
    tableWrap.innerHTML = '<p class="admin-error">Failed to load students. Please try again.</p>';
  }
};

LQ.showConfirmModal = function (opts) {
  var existing = document.getElementById('admin-confirm-modal');
  if (existing) existing.remove();

  var modal = document.createElement('div');
  modal.id = 'admin-confirm-modal';
  modal.className = 'admin-confirm-modal-overlay';
  modal.innerHTML =
    '<div class="admin-confirm-modal-card">' +
      '<div class="admin-confirm-modal-icon">' + (opts.icon || '⚠️') + '</div>' +
      '<h3 class="admin-confirm-modal-title">' + LQ.esc(opts.title || 'Confirm Action') + '</h3>' +
      '<p class="admin-confirm-modal-msg">' + LQ.esc(opts.message || 'Are you sure you want to proceed?') + '</p>' +
      '<div class="admin-confirm-modal-actions">' +
        '<button type="button" class="admin-btn admin-btn-outline" id="admin-confirm-cancel-btn">' + LQ.esc(opts.cancelText || 'Cancel') + '</button>' +
        '<button type="button" class="admin-btn ' + (opts.danger ? 'admin-btn-danger' : 'admin-btn-primary') + '" id="admin-confirm-ok-btn">' + LQ.esc(opts.okText || 'Confirm') + '</button>' +
      '</div>' +
    '</div>';

  document.body.appendChild(modal);

  document.getElementById('admin-confirm-cancel-btn').onclick = function () {
    modal.remove();
    if (opts.onCancel) opts.onCancel();
  };

  document.getElementById('admin-confirm-ok-btn').onclick = function () {
    modal.remove();
    if (opts.onConfirm) opts.onConfirm();
  };
};

LQ._toggleStudentStatus = function (id, isActive, name) {
  var actionText = isActive ? 'activate' : 'deactivate';
  LQ.showConfirmModal({
    title: (isActive ? 'Activate' : 'Deactivate') + ' Student',
    message: 'Are you sure you want to ' + actionText + ' student "' + name + '"?',
    icon: isActive ? '🟢' : '🔴',
    danger: !isActive,
    okText: isActive ? 'Activate Student' : 'Deactivate Student',
    onConfirm: async function () {
      try {
        var resp = await fetch('/api/admin/students/' + id + '/status', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ isActive: isActive }),
        });
        var data = await resp.json();
        if (resp.ok) {
          LQ.toast('Student ' + (isActive ? 'activated' : 'deactivated') + '!');
          LQ._loadStudents();
        } else {
          LQ.toast(data.error || 'Failed to update status');
        }
      } catch (e) {
        LQ.toast('Failed to update student status');
      }
    }
  });
};

LQ._resetStudentPassword = function (id, name) {
  LQ.showConfirmModal({
    title: 'Reset Student Password',
    message: 'Are you sure you want to reset password for "' + name + '" to default (Test@123)?',
    icon: '🔑',
    danger: false,
    okText: 'Reset Password',
    onConfirm: async function () {
      try {
        var resp = await fetch('/api/admin/students/' + id + '/reset-password', {
          method: 'POST',
          credentials: 'include',
        });
        var data = await resp.json();
        if (resp.ok) {
          LQ.toast('Password reset for ' + name);
        } else {
          LQ.toast(data.error || 'Failed');
        }
      } catch (e) {
        LQ.toast('Failed to reset password');
      }
    }
  });
};

LQ._removeStudent = async function (id, name) {
  if (!confirm('Remove student "' + name + '"? This action cannot be undone.')) return;
  try {
    var resp = await fetch('/api/admin/students/' + id, {
      method: 'DELETE',
      credentials: 'include',
    });
    var data = await resp.json();
    if (resp.ok) {
      LQ.toast('Student removed');
      LQ._loadStudents();
    } else {
      LQ.toast(data.error || 'Failed');
    }
  } catch (e) {
    LQ.toast('Failed to remove student');
  }
};

/* ══════════════════════════════════════════════════
   ADMIN SLIDE DRAWER HELPER (70% width from right)
   ══════════════════════════════════════════════════ */

LQ.openAdminDrawer = function (title, contentHtml) {
  LQ.closeAdminDrawer();

  var overlay = document.createElement('div');
  overlay.id = 'admin-drawer-overlay';
  overlay.className = 'admin-drawer-overlay';

  overlay.innerHTML =
    '<div class="admin-drawer-panel">' +
      '<div class="admin-drawer-header">' +
        '<h3 class="admin-drawer-title">' + LQ.esc(title) + '</h3>' +
        '<button type="button" class="admin-drawer-close-btn" onclick="LQ.closeAdminDrawer()">✕</button>' +
      '</div>' +
      '<div class="admin-drawer-body">' + contentHtml + '</div>' +
    '</div>';

  document.body.appendChild(overlay);

  requestAnimationFrame(function () {
    overlay.classList.add('open');
  });

  overlay._escHandler = function (e) {
    if (e.key === 'Escape') LQ.closeAdminDrawer();
  };
  window.addEventListener('keydown', overlay._escHandler);

  overlay.onclick = function (e) {
    if (e.target === overlay) LQ.closeAdminDrawer();
  };
};

LQ.closeAdminDrawer = function () {
  var drawer = document.getElementById('admin-drawer-overlay');
  if (!drawer) return;
  drawer.classList.remove('open');
  if (drawer._escHandler) window.removeEventListener('keydown', drawer._escHandler);
  setTimeout(function () {
    if (drawer && drawer.parentNode) drawer.parentNode.removeChild(drawer);
  }, 250);
};

/* ══════════════════════════════════════════════════
   ADD STUDENT FORM (DRAWER)
   ══════════════════════════════════════════════════ */

LQ.renderAddStudentForm = function () {
  var formHtml =
    '<form id="add-student-form" class="admin-form" onsubmit="LQ._submitAddStudent(event)">' +
      '<div class="admin-form-grid">' +
        '<div class="admin-form-field">' +
          '<label>Full Name <span class="req">*</span></label>' +
          '<input type="text" id="student-name" required placeholder="e.g., John Doe" />' +
        '</div>' +
        '<div class="admin-form-field">' +
          '<label>Email <span class="req">*</span></label>' +
          '<input type="email" id="student-email" required placeholder="e.g., john@example.com" />' +
        '</div>' +
        '<div class="admin-form-field">' +
          '<label>Phone <span class="req">*</span></label>' +
          '<input type="tel" id="student-phone" required placeholder="e.g., 9876543210" />' +
        '</div>' +
        '<div class="admin-form-field">' +
          '<label>Gender <span class="req">*</span></label>' +
          '<select id="student-gender" required>' +
            '<option value="">Select gender</option>' +
            '<option value="male">Male</option>' +
            '<option value="female">Female</option>' +
            '<option value="other">Other</option>' +
          '</select>' +
        '</div>' +
        '<div class="admin-form-field">' +
          '<label>Register No <span class="req">*</span></label>' +
          '<input type="text" id="student-regno" required placeholder="e.g., REG001" />' +
        '</div>' +
        '<div class="admin-form-field">' +
          '<label>Branch <span class="req">*</span></label>' +
          '<input type="text" id="student-branch" required placeholder="e.g., CSE" />' +
        '</div>' +
      '</div>' +
      '<p class="admin-hint">Default password: <strong>Test@123</strong> — students can change it after login.</p>' +
      '<p id="add-student-error" class="admin-error-msg" style="display:none"></p>' +
      '<div class="admin-form-actions">' +
        '<button type="button" class="admin-btn admin-btn-outline" onclick="LQ.closeAdminDrawer()">Cancel</button>' +
        '<button type="submit" class="admin-btn admin-btn-primary" id="add-student-btn">Add Student</button>' +
      '</div>' +
    '</form>';

  LQ.openAdminDrawer('Add New Student', formHtml);
};

LQ._submitAddStudent = async function (e) {
  e.preventDefault();
  var btn = document.getElementById('add-student-btn');
  var errEl = document.getElementById('add-student-error');

  var payload = {
    name: document.getElementById('student-name').value.trim(),
    email: document.getElementById('student-email').value.trim(),
    phone: document.getElementById('student-phone').value.trim(),
    gender: document.getElementById('student-gender').value,
    registerNo: document.getElementById('student-regno').value.trim(),
    branch: document.getElementById('student-branch').value.trim(),
  };

  if (errEl) errEl.style.display = 'none';
  if (btn) { btn.disabled = true; btn.textContent = 'Adding...'; }

  try {
    var resp = await fetch('/api/admin/students', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    var data = await resp.json();
    if (resp.ok) {
      LQ.toast('Student added successfully!');
      LQ.closeAdminDrawer();
      LQ._loadStudents();
    } else {
      if (errEl) { errEl.textContent = data.error || 'Failed'; errEl.style.display = 'block'; }
    }
  } catch (err) {
    if (errEl) { errEl.textContent = 'Network error. Please try again.'; errEl.style.display = 'block'; }
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Add Student'; }
  }
};

/* ══════════════════════════════════════════════════
   BULK UPLOAD
   ══════════════════════════════════════════════════ */

LQ.renderBulkUploadForm = async function () {
  var state = LQ.Store.getState();
  var user = state.user;
  var isSuperAdmin = user && user.role === 'super_admin';

  var orgs = [];
  if (isSuperAdmin) {
    try {
      var resp = await fetch('/api/admin/orgs', { credentials: 'include' });
      var data = await resp.json();
      if (data.ok) orgs = data.orgs || [];
    } catch (e) {
      console.error(e);
    }
  }

  var orgSelectHtml = '';
  if (isSuperAdmin) {
    orgSelectHtml = 
      '<div class="admin-form-field" style="margin-bottom: 16px;">' +
        '<label for="bulk-upload-org" style="display:block;margin-bottom:8px;font-weight:600">Select Organization <span class="req">*</span></label>' +
        '<select id="bulk-upload-org" class="admin-search-input" style="width:100%;box-sizing:border-box" onchange="LQ._handleBulkSelectChange()">' +
          '<option value="">-- Choose Organization --</option>';
    orgs.forEach(function (o) {
      orgSelectHtml += '<option value="' + o._id + '">' + LQ.esc(o.name) + '</option>';
    });
    orgSelectHtml += 
        '</select>' +
      '</div>';
  }

  var formHtml =
    '<div class="admin-bulk-info">' +
      '<p>Upload an Excel file (.xlsx) with the following columns:</p>' +
      '<div class="admin-columns-list"><code>name</code> <code>email</code> <code>phone</code> <code>gender</code> <code>registerNo</code> <code>branch</code></div>' +
      '<button type="button" class="admin-btn admin-btn-outline admin-btn-sm" style="margin-top:8px" onclick="LQ._downloadTemplate()">📥 Download Template</button>' +
    '</div>' +
    '<form id="bulk-upload-form" class="admin-form">' +
      orgSelectHtml +
      '<div class="admin-file-drop" id="admin-file-drop">' +
        '<input type="file" id="bulk-file-input" accept=".xlsx,.xls,.csv" onchange="LQ._handleBulkFileSelect()" style="display:none" />' +
        '<p class="admin-file-drop-text">📁 Click to select or drag & drop your Excel file</p>' +
        '<p id="bulk-file-name" class="admin-file-name"></p>' +
      '</div>' +
      '<p id="bulk-upload-error" class="admin-error-msg" style="display:none"></p>' +
      '<div class="admin-form-actions">' +
        '<button type="button" class="admin-btn admin-btn-outline" onclick="LQ.closeAdminDrawer()">Cancel</button>' +
        '<button type="button" class="admin-btn admin-btn-primary" id="bulk-upload-btn" onclick="LQ._submitBulkUpload()" disabled>Upload & Register</button>' +
      '</div>' +
    '</form>' +
    '<div id="bulk-results" style="display:none"></div>';

  LQ.openAdminDrawer('📤 Bulk Upload Students', formHtml);

  setTimeout(function () {
    var dropZone = document.getElementById('admin-file-drop');
    if (dropZone) {
      dropZone.onclick = function () { document.getElementById('bulk-file-input').click(); };
      dropZone.ondragover = function (e) { e.preventDefault(); dropZone.classList.add('dragover'); };
      dropZone.ondragleave = function () { dropZone.classList.remove('dragover'); };
      dropZone.ondrop = function (e) {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        var files = e.dataTransfer.files;
        if (files.length) {
          document.getElementById('bulk-file-input').files = files;
          LQ._handleBulkFileSelect();
        }
      };
    }
  }, 50);
};

LQ._handleBulkFileSelect = function () {
  var input = document.getElementById('bulk-file-input');
  var nameEl = document.getElementById('bulk-file-name');
  var btn = document.getElementById('bulk-upload-btn');
  var orgSelect = document.getElementById('bulk-upload-org');

  var fileSelected = input && input.files && input.files[0];
  if (fileSelected) {
    if (nameEl) nameEl.textContent = '📄 ' + input.files[0].name;
  } else {
    if (nameEl) nameEl.textContent = '';
  }

  var isSuperAdmin = !!orgSelect;
  var orgSelected = isSuperAdmin ? (orgSelect.value !== '') : true;

  if (btn) {
    btn.disabled = !(fileSelected && orgSelected);
  }
};

LQ._handleBulkSelectChange = function () {
  LQ._handleBulkFileSelect();
};

LQ._downloadTemplate = function () {
  window.open('/api/admin/students/template', '_blank');
};

LQ._submitBulkUpload = async function () {
  var input = document.getElementById('bulk-file-input');
  var btn = document.getElementById('bulk-upload-btn');
  var errEl = document.getElementById('bulk-upload-error');
  var resultsEl = document.getElementById('bulk-results');
  var orgSelect = document.getElementById('bulk-upload-org');

  if (!input || !input.files || !input.files[0]) {
    if (errEl) { errEl.textContent = 'Please select a file first.'; errEl.style.display = 'block'; }
    return;
  }

  var state = LQ.Store.getState();
  var isSuperAdmin = state.user && state.user.role === 'super_admin';
  var orgId = '';
  if (isSuperAdmin) {
    if (!orgSelect || !orgSelect.value) {
      if (errEl) { errEl.textContent = 'Please select an organization first.'; errEl.style.display = 'block'; }
      return;
    }
    orgId = orgSelect.value;
  }

  if (errEl) errEl.style.display = 'none';
  if (btn) { btn.disabled = true; btn.textContent = 'Uploading...'; }

  var formData = new FormData();
  formData.append('file', input.files[0]);
  if (isSuperAdmin) {
    formData.append('orgId', orgId);
  }

  try {
    var resp = await fetch('/api/admin/students/bulk', {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });
    var data = await resp.json();

    if (!resp.ok) {
      if (errEl) { errEl.textContent = data.error || 'Upload failed.'; errEl.style.display = 'block'; }
      return;
    }

    // Show results
    if (resultsEl) {
      var html =
        '<div class="admin-bulk-results">' +
          '<h3 class="admin-bulk-results-title">Upload Results</h3>' +
          '<div class="admin-bulk-summary">' +
            '<div class="admin-stat admin-stat-success"><span class="admin-stat-num">' + data.registeredCount + '</span><span class="admin-stat-label">Registered</span></div>' +
            '<div class="admin-stat admin-stat-fail"><span class="admin-stat-num">' + data.failedCount + '</span><span class="admin-stat-label">Failed</span></div>' +
            '<div class="admin-stat"><span class="admin-stat-num">' + data.totalRows + '</span><span class="admin-stat-label">Total</span></div>' +
          '</div>';

      if (data.failed && data.failed.length > 0) {
        html +=
          '<div class="admin-failed-section">' +
            '<div class="admin-failed-header">' +
              '<h4>⚠️ Failed Registrations</h4>' +
              '<button type="button" class="admin-btn admin-btn-outline admin-btn-sm" onclick="LQ._downloadFailedList()">📥 Download Failed List</button>' +
            '</div>' +
            '<div class="admin-table-responsive"><table class="admin-table admin-table-sm">' +
              '<thead><tr><th>Row</th><th>Name</th><th>Email</th><th>Reason</th></tr></thead><tbody>';

        data.failed.forEach(function (f) {
          html += '<tr><td>' + f.row + '</td><td>' + LQ.esc(f.name) + '</td><td>' + LQ.esc(f.email) + '</td><td class="admin-fail-reason">' + LQ.esc(f.failedComment) + '</td></tr>';
        });

        html += '</tbody></table></div></div>';

        // Store failed data for download
        LQ._bulkFailedData = data.failed;
      }

      html +=
          '<div class="admin-form-actions" style="margin-top:16px">' +
            '<button type="button" class="admin-btn admin-btn-primary" onclick="LQ.closeAdminDrawer();LQ._loadStudents()">Done</button>' +
          '</div>' +
        '</div>';

      resultsEl.innerHTML = html;
      resultsEl.style.display = 'block';

      // Hide the form
      var form = document.getElementById('bulk-upload-form');
      if (form) form.style.display = 'none';
    }

    LQ.toast(data.registeredCount + ' students registered' + (data.failedCount ? ', ' + data.failedCount + ' failed' : ''));
  } catch (err) {
    if (errEl) { errEl.textContent = 'Network error. Please try again.'; errEl.style.display = 'block'; }
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Upload & Register'; }
  }
};

/**
 * Download failed registrations as Excel with failedComment column.
 */
LQ._downloadFailedList = function () {
  if (!LQ._bulkFailedData || !LQ._bulkFailedData.length) return;

  var csv = 'name,email,phone,gender,registerNo,branch,failedComment\n';
  LQ._bulkFailedData.forEach(function (f) {
    csv +=
      '"' + (f.name || '').replace(/"/g, '""') + '",' +
      '"' + (f.email || '').replace(/"/g, '""') + '",' +
      '"' + (f.phone || '').replace(/"/g, '""') + '",' +
      '"' + (f.gender || '').replace(/"/g, '""') + '",' +
      '"' + (f.registerNo || '').replace(/"/g, '""') + '",' +
      '"' + (f.branch || '').replace(/"/g, '""') + '",' +
      '"' + (f.failedComment || '').replace(/"/g, '""') + '"\n';
  });

  var blob = new Blob([csv], { type: 'text/csv' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'failed_registrations.csv';
  a.click();
  URL.revokeObjectURL(url);
};

/* ══════════════════════════════════════════════════
   ORGANIZATION LIST PAGE (super_admin only)
   ══════════════════════════════════════════════════ */

LQ.renderAdminOrgsPage = async function () {
  var wrap = document.getElementById('admin-orgs-wrap');
  if (!wrap) return;

  wrap.innerHTML =
    '<div class="admin-page-header">' +
      '<h2 class="admin-page-title">🏢 Organizations</h2>' +
      '<button type="button" class="admin-btn admin-btn-primary" onclick="LQ.renderAddOrgForm()">+ Add Organization</button>' +
    '</div>' +
    '<div id="admin-orgs-table-wrap" class="admin-table-wrap"><p class="admin-loading">Loading organizations...</p></div>';

  try {
    var resp = await fetch('/api/admin/orgs', { credentials: 'include' });
    var data = await resp.json();
    var tableWrap = document.getElementById('admin-orgs-table-wrap');
    if (!tableWrap) return;

    if (!resp.ok) {
      tableWrap.innerHTML = '<p class="admin-error">' + LQ.esc(data.error || 'Failed to load') + '</p>';
      return;
    }

    var orgs = data.orgs || [];
    if (!orgs.length) {
      tableWrap.innerHTML = '<p class="admin-empty">No organizations found.</p>';
      return;
    }

    var html = '<div class="admin-table-responsive"><table class="admin-table">' +
      '<thead><tr><th>Name</th><th>Email</th><th>Address</th><th>Students</th><th>Status</th><th>Actions</th></tr></thead><tbody>';

    orgs.forEach(function (o) {
      var count = o.studentCount || 0;
      var countCell = count > 0
        ? '<button class="admin-btn admin-btn-outline admin-btn-sm" style="color:#2563eb;font-weight:700;border-color:#bfdbfe;background:#eff6ff" onclick="LQ.filterStudentsByOrg(\'' + o._id + '\')" title="View ' + count + ' students for ' + LQ.esc(o.name) + '">🎓 ' + count + ' Students</button>'
        : '<span style="color:#94a3b8;font-size:12px">0 Students</span>';

      html +=
        '<tr>' +
          '<td><strong>' + LQ.esc(o.name) + '</strong></td>' +
          '<td>' + LQ.esc(o.email) + '</td>' +
          '<td>' + LQ.esc(o.address) + '</td>' +
          '<td>' + countCell + '</td>' +
          '<td><span class="admin-capitalize" style="color:#16a34a;font-weight:600">Active</span></td>' +
          '<td><button class="admin-btn admin-btn-primary admin-btn-sm" style="margin-right:4px" onclick="LQ.openOrgReport(\'' + o._id + '\')">📊 Report</button><button class="admin-btn admin-btn-outline admin-btn-sm" disabled title="Editing disabled">Edit</button></td>' +
        '</tr>';
    });

    html += '</tbody></table></div>';
    tableWrap.innerHTML = html;
  } catch (err) {
    var tableWrap = document.getElementById('admin-orgs-table-wrap');
    if (tableWrap) tableWrap.innerHTML = '<p class="admin-error">Failed to load organizations.</p>';
  }
};

LQ.renderAddOrgForm = function () {
  var formHtml =
    '<form id="add-org-form" class="admin-form" onsubmit="LQ._submitAddOrg(event)">' +
      '<div class="admin-form-grid">' +
        '<div class="admin-form-field" style="grid-column:1/-1">' +
          '<label>Organization Name <span class="req">*</span></label>' +
          '<input type="text" id="org-name" required placeholder="e.g., Panimalar Engineering College" />' +
        '</div>' +
        '<div class="admin-form-field">' +
          '<label>Organization Email <span class="req">*</span></label>' +
          '<input type="email" id="org-email" required placeholder="e.g., info@panimalar.edu.in" />' +
        '</div>' +
        '<div class="admin-form-field">' +
          '<label>Address <span class="req">*</span></label>' +
          '<input type="text" id="org-address" required placeholder="e.g., Chennai, Tamil Nadu" />' +
        '</div>' +
      '</div>' +
      '<p id="add-org-error" class="admin-error-msg" style="display:none"></p>' +
      '<div class="admin-form-actions">' +
        '<button type="button" class="admin-btn admin-btn-outline" onclick="LQ.closeAdminDrawer()">Cancel</button>' +
        '<button type="submit" class="admin-btn admin-btn-primary" id="add-org-btn">Create Organization</button>' +
      '</div>' +
    '</form>';

  LQ.openAdminDrawer('Add New Organization', formHtml);
};

LQ._submitAddOrg = async function (e) {
  e.preventDefault();
  var btn = document.getElementById('add-org-btn');
  var errEl = document.getElementById('add-org-error');

  var payload = {
    name: document.getElementById('org-name').value.trim(),
    email: document.getElementById('org-email').value.trim(),
    address: document.getElementById('org-address').value.trim(),
  };

  if (errEl) errEl.style.display = 'none';
  if (btn) { btn.disabled = true; btn.textContent = 'Creating...'; }

  try {
    var resp = await fetch('/api/admin/orgs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    var data = await resp.json();
    if (resp.ok) {
      LQ.toast('Organization created successfully!');
      LQ.closeAdminDrawer();
      LQ.renderAdminOrgsPage();
    } else {
      if (errEl) { errEl.textContent = data.error || 'Failed to create organization'; errEl.style.display = 'block'; }
    }
  } catch (err) {
    if (errEl) { errEl.textContent = 'Network error. Please try again.'; errEl.style.display = 'block'; }
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Create Organization'; }
  }
};

/* ══════════════════════════════════════════════════
   ADMIN LIST PAGE (super_admin only)
   ══════════════════════════════════════════════════ */

LQ.renderAdminListPage = async function () {
  var wrap = document.getElementById('admin-admins-wrap');
  if (!wrap) return;

  wrap.innerHTML =
    '<div class="admin-page-header">' +
      '<h2 class="admin-page-title">🛡️ Admins</h2>' +
      '<button type="button" class="admin-btn admin-btn-primary" onclick="LQ.renderAddAdminForm()">+ Add Admin</button>' +
    '</div>' +
    '<div class="admin-search-bar" style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">' +
      '<input type="text" id="admin-list-search" class="admin-search-input" style="flex:1;min-width:200px" placeholder="Search by name, email, or phone..." oninput="LQ._debounceAdminSearch()" />' +
      '<select id="admin-list-org-filter" class="admin-search-input" style="width:auto;min-width:160px" onchange="LQ._onAdminOrgFilterChange(this.value)"><option value="all">All Organizations</option></select>' +
      '<select id="admin-list-status-filter" class="admin-search-input" style="width:auto;min-width:130px" onchange="LQ._onAdminStatusFilterChange(this.value)"><option value="all">Status: All</option><option value="active">Active Only</option><option value="inactive">Inactive Only</option></select>' +
    '</div>' +
    '<div id="admin-admins-table-wrap" class="admin-table-wrap"><p class="admin-loading">Loading admins...</p></div>' +
    '<div id="admin-admins-pagination" class="admin-pagination"></div>';

  LQ._adminPage = 1;
  LQ._adminSearch = '';
  LQ._adminStatusFilter = 'all';
  if (!LQ._adminOrgFilter) LQ._adminOrgFilter = 'all';

  // Populate Org filter dropdown
  try {
    var resp = await fetch('/api/admin/orgs', { credentials: 'include' });
    var data = await resp.json();
    if (data.ok && data.orgs) {
      var sel = document.getElementById('admin-list-org-filter');
      if (sel) {
        var opts = '<option value="all">All Organizations</option>';
        data.orgs.forEach(function (o) {
          opts += '<option value="' + o._id + '"' + (LQ._adminOrgFilter === o._id ? ' selected' : '') + '>' + LQ.esc(o.name) + '</option>';
        });
        sel.innerHTML = opts;
      }
    }
  } catch (e) {}

  LQ._loadAdmins();
};

LQ._onAdminOrgFilterChange = function (val) {
  LQ._adminOrgFilter = val;
  LQ._adminPage = 1;
  LQ._loadAdmins();
};

LQ._onAdminStatusFilterChange = function (val) {
  LQ._adminStatusFilter = val;
  LQ._adminPage = 1;
  LQ._loadAdmins();
};

LQ._debounceAdminSearch = (function () {
  var timer;
  return function () {
    clearTimeout(timer);
    timer = setTimeout(function () {
      LQ._adminSearch = (document.getElementById('admin-list-search') || {}).value || '';
      LQ._adminPage = 1;
      LQ._loadAdmins();
    }, 300);
  };
})();

LQ._loadAdmins = async function () {
  var tableWrap = document.getElementById('admin-admins-table-wrap');
  var pagWrap = document.getElementById('admin-admins-pagination');
  if (!tableWrap) return;

  tableWrap.innerHTML = '<p class="admin-loading">Loading admins...</p>';

  try {
    var url = '/api/admin/admins?page=' + LQ._adminPage + '&limit=20';
    if (LQ._adminSearch) url += '&search=' + encodeURIComponent(LQ._adminSearch);
    if (LQ._adminOrgFilter && LQ._adminOrgFilter !== 'all') url += '&orgId=' + encodeURIComponent(LQ._adminOrgFilter);
    if (LQ._adminStatusFilter && LQ._adminStatusFilter !== 'all') url += '&status=' + encodeURIComponent(LQ._adminStatusFilter);

    var resp = await fetch(url, { credentials: 'include' });
    var data = await resp.json();

    if (!resp.ok) {
      tableWrap.innerHTML = '<p class="admin-error">' + LQ.esc(data.error || 'Failed to load') + '</p>';
      return;
    }

    var admins = data.admins || [];
    var pag = data.pagination || {};

    if (!admins.length) {
      tableWrap.innerHTML = '<p class="admin-empty">No admins found matching current filters.</p>';
      if (pagWrap) pagWrap.innerHTML = '';
      return;
    }

    var html = '<div class="admin-table-responsive"><table class="admin-table">' +
      '<thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Organization</th><th>Status</th><th>Actions</th></tr></thead><tbody>';

    admins.forEach(function (a) {
      var orgName = a.orgId && a.orgId.name ? a.orgId.name : '—';
      var isActive = a.isActive !== false;
      var statusBadge = isActive
        ? '<span style="color:#16a34a;font-weight:700">🟢 Active</span>'
        : '<span style="color:#dc2626;font-weight:700">🔴 Inactive</span>';

      var toggleBtn = isActive
        ? '<button class="admin-btn admin-btn-danger admin-btn-sm" title="Deactivate admin" onclick="LQ._toggleAdminStatus(\'' + a._id + '\', false, \'' + LQ.esc(a.name) + '\')">Deactivate</button>'
        : '<button class="admin-btn admin-btn-outline admin-btn-sm" style="border-color:#16a34a;color:#16a34a;font-weight:700" title="Activate admin" onclick="LQ._toggleAdminStatus(\'' + a._id + '\', true, \'' + LQ.esc(a.name) + '\')">Activate</button>';

      html +=
        '<tr' + (!isActive ? ' style="opacity:0.65;background:#fef2f2"' : '') + '>' +
          '<td><strong>' + LQ.esc(a.name) + '</strong></td>' +
          '<td>' + LQ.esc(a.email) + '</td>' +
          '<td>' + LQ.esc(a.phone || '—') + '</td>' +
          '<td>' + LQ.esc(orgName) + '</td>' +
          '<td>' + statusBadge + '</td>' +
          '<td>' + toggleBtn + '</td>' +
        '</tr>';
    });

    html += '</tbody></table></div>';
    tableWrap.innerHTML = html;

    // Pagination
    if (pagWrap) {
      if (pag.pages > 1 || pag.total > 0) {
        var pagHtml = '<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;justify-content:center">' +
          '<span style="font-size:13px;color:#64748b">Total: <strong>' + pag.total + '</strong> (Page ' + pag.page + ' of ' + pag.pages + ')</span>' +
          '<div style="display:flex;gap:4px">';

        if (pag.page > 1) {
          pagHtml += '<button class="admin-page-btn" onclick="LQ._adminPage=' + (pag.page - 1) + ';LQ._loadAdmins()">← Prev</button>';
        }

        for (var i = 1; i <= pag.pages; i++) {
          if (i === 1 || i === pag.pages || (i >= pag.page - 2 && i <= pag.page + 2)) {
            pagHtml += '<button class="admin-page-btn' + (i === pag.page ? ' active' : '') + '" onclick="LQ._adminPage=' + i + ';LQ._loadAdmins()">' + i + '</button>';
          } else if (i === pag.page - 3 || i === pag.page + 3) {
            pagHtml += '<span style="padding:4px 8px;color:#64748b">...</span>';
          }
        }

        if (pag.page < pag.pages) {
          pagHtml += '<button class="admin-page-btn" onclick="LQ._adminPage=' + (pag.page + 1) + ';LQ._loadAdmins()">Next →</button>';
        }

        pagHtml += '</div></div>';
        pagWrap.innerHTML = pagHtml;
      } else {
        pagWrap.innerHTML = '';
      }
    }
  } catch (err) {
    tableWrap.innerHTML = '<p class="admin-error">Failed to load admins.</p>';
  }
};

LQ._toggleAdminStatus = function (id, isActive, name) {
  var actionText = isActive ? 'activate' : 'deactivate';
  LQ.showConfirmModal({
    title: (isActive ? 'Activate' : 'Deactivate') + ' Admin',
    message: 'Are you sure you want to ' + actionText + ' admin "' + name + '"?',
    icon: isActive ? '🟢' : '🔴',
    danger: !isActive,
    okText: isActive ? 'Activate Admin' : 'Deactivate Admin',
    onConfirm: async function () {
      try {
        var resp = await fetch('/api/admin/admins/' + id + '/status', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ isActive: isActive }),
        });
        var data = await resp.json();
        if (resp.ok) {
          LQ.toast('Admin ' + (isActive ? 'activated' : 'deactivated') + '!');
          LQ.renderAdminListPage();
        } else {
          LQ.toast(data.error || 'Failed to update status');
        }
      } catch (e) {
        LQ.toast('Failed to update admin status');
      }
    }
  });
};

LQ.renderAddAdminForm = async function () {
  var orgs = [];
  try {
    var resp = await fetch('/api/admin/orgs', { credentials: 'include' });
    var data = await resp.json();
    if (data.ok) orgs = data.orgs || [];
  } catch (e) {}

  var orgOptions = '';
  orgs.forEach(function (o) {
    orgOptions += '<option value="' + o._id + '"' + (o.name === 'Panimalar' ? ' selected' : '') + '>' + LQ.esc(o.name) + '</option>';
  });

  var formHtml =
    '<form id="add-admin-form" class="admin-form" onsubmit="LQ._submitAddAdmin(event)">' +
      '<div class="admin-form-grid">' +
        '<div class="admin-form-field">' +
          '<label>Full Name <span class="req">*</span></label>' +
          '<input type="text" id="admin-name" required placeholder="e.g., Admin User" />' +
        '</div>' +
        '<div class="admin-form-field">' +
          '<label>Email <span class="req">*</span></label>' +
          '<input type="email" id="admin-email" required placeholder="e.g., admin@panimalar.edu.in" />' +
        '</div>' +
        '<div class="admin-form-field">' +
          '<label>Phone</label>' +
          '<input type="tel" id="admin-phone" placeholder="e.g., 9876543210" />' +
        '</div>' +
        '<div class="admin-form-field">' +
          '<label>Organization <span class="req">*</span></label>' +
          '<select id="admin-org" required disabled>' + orgOptions + '</select>' +
          '<p class="admin-field-hint">Organization is fixed to Panimalar for now.</p>' +
        '</div>' +
        '<div class="admin-form-field">' +
          '<label>Password <span class="req">*</span></label>' +
          '<input type="password" id="admin-password" required placeholder="Set admin password" minlength="6" />' +
        '</div>' +
      '</div>' +
      '<p id="add-admin-error" class="admin-error-msg" style="display:none"></p>' +
      '<div class="admin-form-actions">' +
        '<button type="button" class="admin-btn admin-btn-outline" onclick="LQ.closeAdminDrawer()">Cancel</button>' +
        '<button type="submit" class="admin-btn admin-btn-primary" id="add-admin-btn">Add Admin</button>' +
      '</div>' +
    '</form>';

  LQ.openAdminDrawer('Add New Admin', formHtml);
};

LQ._submitAddAdmin = async function (e) {
  e.preventDefault();
  var btn = document.getElementById('add-admin-btn');
  var errEl = document.getElementById('add-admin-error');

  var payload = {
    name: document.getElementById('admin-name').value.trim(),
    email: document.getElementById('admin-email').value.trim(),
    phone: (document.getElementById('admin-phone').value || '').trim(),
    orgId: document.getElementById('admin-org').value,
    password: document.getElementById('admin-password').value,
  };

  if (errEl) errEl.style.display = 'none';
  if (btn) { btn.disabled = true; btn.textContent = 'Adding...'; }

  try {
    var resp = await fetch('/api/admin/admins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    var data = await resp.json();
    if (resp.ok) {
      LQ.toast('Admin created successfully!');
      LQ.closeAdminDrawer();
      LQ.renderAdminListPage();
    } else {
      if (errEl) { errEl.textContent = data.error || 'Failed'; errEl.style.display = 'block'; }
    }
  } catch (err) {
    if (errEl) { errEl.textContent = 'Network error.'; errEl.style.display = 'block'; }
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Add Admin'; }
  }
};

/* ══════════════════════════════════════════════════
   PROFILE & CHANGE PASSWORD
   ══════════════════════════════════════════════════ */

LQ.renderProfilePage = function () {
  var wrap = document.getElementById('admin-profile-wrap');
  if (!wrap) return;

  var state = LQ.Store.getState();
  var user = state.user;
  if (!user) return;

  var orgName = user.org ? user.org.name : '—';
  var roleName = user.role === 'super_admin' ? 'Super Admin' : user.role === 'admin' ? 'Admin' : 'Student';
  var avatarLetter = (user.name || 'U').charAt(0).toUpperCase();

  var migrationHtml = '';
  if (user.role === 'super_admin') {
    migrationHtml =
      '<div style="margin-top:24px;padding-top:20px;border-top:1px solid #e2e8f0">' +
        '<h3 style="font-size:14px;font-weight:600;color:#0f172a;margin-bottom:8px">System Migration Tools</h3>' +
        '<p style="font-size:12px;color:#64748b;margin:0 0 12px">Migrate vocabulary, word lists, and tenses content from CMS flat JSON files to MongoDB.</p>' +
        '<button type="button" class="admin-btn admin-btn-primary" id="system-migrate-btn" onclick="LQ._triggerSystemMigration()">Migrate CMS to MongoDB</button>' +
        '<p id="system-migrate-status" style="margin-top:8px;font-size:12px;font-weight:600;display:none"></p>' +
      '</div>';
  }

  wrap.innerHTML =
    '<div class="admin-profile-card">' +
      '<div class="admin-profile-avatar">' + avatarLetter + '</div>' +
      '<h2 class="admin-profile-name">' + LQ.esc(user.name) + '</h2>' +
      '<p class="admin-profile-role">' + roleName + '</p>' +
      '<div class="admin-profile-details">' +
        '<div class="admin-profile-row"><span class="admin-profile-label">Email</span><span>' + LQ.esc(user.email) + '</span></div>' +
        '<div class="admin-profile-row"><span class="admin-profile-label">Organization</span><span>' + LQ.esc(orgName) + '</span></div>' +
        (user.phone ? '<div class="admin-profile-row"><span class="admin-profile-label">Phone</span><span>' + LQ.esc(user.phone) + '</span></div>' : '') +
        (user.registerNo ? '<div class="admin-profile-row"><span class="admin-profile-label">Register No</span><span>' + LQ.esc(user.registerNo) + '</span></div>' : '') +
        (user.branch ? '<div class="admin-profile-row"><span class="admin-profile-label">Branch</span><span>' + LQ.esc(user.branch) + '</span></div>' : '') +
      '</div>' +
      migrationHtml +
      '<div class="admin-profile-actions" style="margin-top:20px">' +
        '<button type="button" class="admin-btn admin-btn-outline" onclick="goTo(\'change-password\')">🔑 Change Password</button>' +
        '<button type="button" class="admin-btn admin-btn-danger" onclick="LQ.Auth.logout()">🚪 Logout</button>' +
      '</div>' +
    '</div>';
};

LQ._triggerSystemMigration = async function () {
  var btn = document.getElementById('system-migrate-btn');
  var statusEl = document.getElementById('system-migrate-status');

  if (!btn || !statusEl) return;

  if (!confirm('Are you sure you want to run the database migration? This will merge/upsert words and lists, and overwrite tenses questions.')) return;

  btn.disabled = true;
  btn.textContent = 'Migrating...';
  statusEl.style.display = 'block';
  statusEl.style.color = '#64748b';
  statusEl.textContent = 'Migration in progress. Please wait...';

  try {
    var resp = await fetch('/api/admin/migrate-cms', {
      method: 'POST',
      credentials: 'include'
    });
    var data = await resp.json();

    if (resp.ok) {
      statusEl.style.color = '#16a34a';
      statusEl.innerHTML = '✓ Migration completed successfully!<br/>' +
        '• Words: ' + data.stats.words + '<br/>' +
        '• Lists: ' + data.stats.lists + '<br/>' +
        '• Tenses: ' + data.stats.tenses;
      LQ.toast('Migration completed!');
    } else {
      statusEl.style.color = '#dc2626';
      statusEl.textContent = '✗ Migration failed: ' + (data.error || 'Unknown error');
    }
  } catch (err) {
    statusEl.style.color = '#dc2626';
    statusEl.textContent = '✗ Network error occurred.';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Migrate CMS to MongoDB';
  }
};

LQ.renderChangePasswordPage = function () {
  var wrap = document.getElementById('change-password-wrap') || document.getElementById('admin-profile-wrap');
  if (!wrap) return;

  wrap.innerHTML =
    '<div class="admin-page-header">' +
      '<button type="button" class="admin-back-btn" onclick="goTo(\'admin-profile\')">← Back</button>' +
      '<h2 class="admin-page-title">🔑 Change Password</h2>' +
    '</div>' +
    '<form class="admin-form" onsubmit="LQ._submitChangePassword(event)" style="max-width:420px">' +
      '<div class="admin-form-field">' +
        '<label>Current Password <span class="req">*</span></label>' +
        '<input type="password" id="cp-old" required placeholder="Enter current password" />' +
      '</div>' +
      '<div class="admin-form-field">' +
        '<label>New Password <span class="req">*</span></label>' +
        '<input type="password" id="cp-new" required placeholder="Enter new password" minlength="6" />' +
        '<p class="admin-field-hint">Must contain uppercase, lowercase, digit, and special character.</p>' +
      '</div>' +
      '<div class="admin-form-field">' +
        '<label>Confirm New Password <span class="req">*</span></label>' +
        '<input type="password" id="cp-confirm" required placeholder="Confirm new password" />' +
      '</div>' +
      '<p id="cp-error" class="admin-error-msg" style="display:none"></p>' +
      '<p id="cp-success" class="admin-success-msg" style="display:none"></p>' +
      '<div class="admin-form-actions">' +
        '<button type="button" class="admin-btn admin-btn-outline" onclick="goTo(\'admin-profile\')">Cancel</button>' +
        '<button type="submit" class="admin-btn admin-btn-primary" id="cp-btn">Change Password</button>' +
      '</div>' +
    '</form>';
};

LQ._submitChangePassword = async function (e) {
  e.preventDefault();
  var btn = document.getElementById('cp-btn');
  var errEl = document.getElementById('cp-error');
  var successEl = document.getElementById('cp-success');

  var oldPw = document.getElementById('cp-old').value;
  var newPw = document.getElementById('cp-new').value;
  var confirmPw = document.getElementById('cp-confirm').value;

  if (errEl) errEl.style.display = 'none';
  if (successEl) successEl.style.display = 'none';

  if (newPw !== confirmPw) {
    if (errEl) { errEl.textContent = 'New passwords do not match.'; errEl.style.display = 'block'; }
    return;
  }

  if (btn) { btn.disabled = true; btn.textContent = 'Changing...'; }

  try {
    await LQ.Auth.changePassword(oldPw, newPw);
    if (successEl) { successEl.textContent = '✓ Password changed successfully!'; successEl.style.display = 'block'; }
    LQ.toast('Password changed!');
  } catch (err) {
    if (errEl) { errEl.textContent = err.message || 'Failed.'; errEl.style.display = 'block'; }
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Change Password'; }
  }
};

/* ══════════════════════════════════════════════════
   QUESTION MANAGEMENT PAGE (admin & super_admin)
   ══════════════════════════════════════════════════ */

LQ._questionsFilter = {
  type: '',
  category: '',
  tenseGroup: '',
  wordList: '',
  difficulty: ''
};

LQ.renderAdminQuestionsPage = async function () {
  var wrap = document.getElementById('admin-questions-wrap');
  if (!wrap) return;

  wrap.innerHTML =
    '<div class="admin-page-header">' +
      '<h2 class="admin-page-title">❓ Questions</h2>' +
      '<div class="admin-header-actions">' +
        '<button type="button" class="admin-btn admin-btn-outline" onclick="LQ.renderQuestionBulkUploadForm()">📤 Bulk Upload</button>' +
        '<button type="button" class="admin-btn admin-btn-primary" onclick="LQ.renderAddQuestionForm()">+ Add Question</button>' +
      '</div>' +
    '</div>' +
    '<div class="admin-search-bar" style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">' +
      '<input type="text" id="admin-question-search" class="admin-search-input" style="flex:1;min-width:200px" placeholder="Search by question text or category..." oninput="LQ._debounceQuestionSearch()" />' +
      '<select id="admin-question-status-filter" class="admin-search-input" style="width:auto;min-width:130px" onchange="LQ._onQuestionStatusFilterChange(this.value)">' +
        '<option value="all">Status: All</option>' +
        '<option value="active">Active Only</option>' +
        '<option value="inactive">Inactive Only</option>' +
      '</select>' +
      '<button type="button" class="admin-btn admin-btn-outline" id="btn-question-filter" onclick="LQ.openQuestionFilterModal()" style="display:flex;align-items:center;gap:6px">' +
        '⚙️ Filter <span id="question-filter-badge" style="display:none;background:#2563eb;color:#fff;border-radius:10px;font-size:11px;padding:2px 6px"></span>' +
      '</button>' +
      '<button type="button" class="admin-btn admin-btn-outline admin-btn-danger" id="btn-question-reset-filter" onclick="LQ.resetQuestionFilters(false)" style="display:none;border-color:#ef4444;color:#ef4444">Reset</button>' +
    '</div>' +
    '<div id="admin-questions-table-wrap" class="admin-table-wrap"><p class="admin-loading">Loading questions...</p></div>' +
    '<div id="admin-questions-pagination" class="admin-pagination"></div>';

  LQ._questionPage = 1;
  LQ._questionSearch = '';
  LQ._questionStatusFilter = 'all';
  LQ._questionsFilter = {
    type: '',
    category: '',
    tenseGroup: '',
    wordList: '',
    difficulty: ''
  };

  LQ._loadQuestions();
};

LQ.openQuestionFilterModal = async function () {
  var existing = document.getElementById('admin-filter-modal');
  if (existing) existing.remove();

  // Load tense groups
  var tenseGroups = [];
  try {
    var respG = await fetch('/api/admin/tenses', { credentials: 'include' });
    var dataG = await respG.json();
    if (dataG.ok) tenseGroups = dataG.groups || [];
  } catch (e) {}

  var tenseGroupOptions = '<option value="">All Tense Groups</option>';
  tenseGroups.forEach(function (tg) {
    var isSel = (LQ._questionsFilter.tenseGroup === tg.name) ? 'selected' : '';
    tenseGroupOptions += '<option value="' + tg.name + '" ' + isSel + '>' + LQ.esc(tg.displayName || tg.name) + '</option>';
  });

  // Load word lists
  var wordLists = [];
  try {
    var respW = await fetch('/api/admin/word-lists?limit=1000', { credentials: 'include' });
    var dataW = await respW.json();
    if (dataW.ok) wordLists = dataW.items || [];
  } catch (e) {}

  var wordListOptions = '<option value="">All Word Lists</option>';
  wordLists.forEach(function (wl) {
    var isSel = (LQ._questionsFilter.wordList === wl.id) ? 'selected' : '';
    wordListOptions += '<option value="' + wl.id + '" ' + isSel + '>' + LQ.esc(wl.name || wl.id) + '</option>';
  });

  var modal = document.createElement('div');
  modal.id = 'admin-filter-modal';
  modal.className = 'admin-confirm-modal-overlay';
  
  var typeOptions = 
    '<option value="" ' + (!LQ._questionsFilter.type ? 'selected' : '') + '>All Types</option>' +
    '<option value="mcq" ' + (LQ._questionsFilter.type === 'mcq' ? 'selected' : '') + '>MCQ</option>' +
    '<option value="fib" ' + (LQ._questionsFilter.type === 'fib' ? 'selected' : '') + '>Fill in the Blanks</option>';

  var categoryOptions = 
    '<option value="" ' + (!LQ._questionsFilter.category ? 'selected' : '') + '>All Categories</option>' +
    '<option value="General" ' + (LQ._questionsFilter.category === 'General' ? 'selected' : '') + '>General</option>' +
    '<option value="Tense" ' + (LQ._questionsFilter.category === 'Tense' ? 'selected' : '') + '>Tense</option>' +
    '<option value="Word" ' + (LQ._questionsFilter.category === 'Word' ? 'selected' : '') + '>Word</option>';

  var difficultyOptions = 
    '<option value="" ' + (!LQ._questionsFilter.difficulty ? 'selected' : '') + '>All Difficulties</option>' +
    '<option value="easy" ' + (LQ._questionsFilter.difficulty === 'easy' ? 'selected' : '') + '>Easy</option>' +
    '<option value="medium" ' + (LQ._questionsFilter.difficulty === 'medium' ? 'selected' : '') + '>Medium</option>' +
    '<option value="hard" ' + (LQ._questionsFilter.difficulty === 'hard' ? 'selected' : '') + '>Hard</option>';

  modal.innerHTML =
    '<div class="admin-confirm-modal-card" style="max-width:480px; width:90%; padding:24px; text-align:left">' +
      '<h3 style="margin:0 0 16px;font-size:18px;font-weight:700;color:#0f172a">🔍 Filter Questions</h3>' +
      
      '<div class="admin-form-grid" style="grid-template-columns:1fr; gap:12px">' +
        '<div class="admin-form-field">' +
          '<label>Question Type</label>' +
          '<select id="filter-question-type" style="width:100%">' + typeOptions + '</select>' +
        '</div>' +
        '<div class="admin-form-field">' +
          '<label>Category</label>' +
          '<select id="filter-question-category" style="width:100%" onchange="LQ._onFilterCategoryChange(this.value)">' + categoryOptions + '</select>' +
        '</div>' +
        '<div class="admin-form-field" id="filter-tense-group-field" style="display:' + (LQ._questionsFilter.category === 'Tense' ? 'block' : 'none') + '">' +
          '<label>Tenses Group</label>' +
          '<select id="filter-question-tense-group" style="width:100%">' + tenseGroupOptions + '</select>' +
        '</div>' +
        '<div class="admin-form-field" id="filter-word-list-field" style="display:' + (LQ._questionsFilter.category === 'Word' ? 'block' : 'none') + '">' +
          '<label>Word List</label>' +
          '<select id="filter-question-word-list" style="width:100%">' + wordListOptions + '</select>' +
        '</div>' +
        '<div class="admin-form-field">' +
          '<label>Difficulty</label>' +
          '<select id="filter-question-difficulty" style="width:100%">' + difficultyOptions + '</select>' +
        '</div>' +
      '</div>' +
      
      '<div class="admin-confirm-modal-actions" style="margin-top:24px; display:flex; justify-content:flex-end; gap:8px">' +
        '<button type="button" class="admin-btn admin-btn-outline" onclick="document.getElementById(\'admin-filter-modal\').remove()">Cancel</button>' +
        '<button type="button" class="admin-btn admin-btn-outline" style="border-color:#ef4444;color:#ef4444" onclick="LQ.resetQuestionFilters(true)">Reset Filters</button>' +
        '<button type="button" class="admin-btn admin-btn-primary" onclick="LQ.applyQuestionFilters()">Apply</button>' +
      '</div>' +
    '</div>';

  document.body.appendChild(modal);
};

LQ._onFilterCategoryChange = function (val) {
  var tenseField = document.getElementById('filter-tense-group-field');
  var wordField = document.getElementById('filter-word-list-field');
  if (tenseField) tenseField.style.display = (val === 'Tense') ? 'block' : 'none';
  if (wordField) wordField.style.display = (val === 'Word') ? 'block' : 'none';
};

LQ.applyQuestionFilters = function () {
  LQ._questionsFilter.type = document.getElementById('filter-question-type').value;
  LQ._questionsFilter.category = document.getElementById('filter-question-category').value;
  
  if (LQ._questionsFilter.category === 'Tense') {
    LQ._questionsFilter.tenseGroup = document.getElementById('filter-question-tense-group').value;
    LQ._questionsFilter.wordList = '';
  } else if (LQ._questionsFilter.category === 'Word') {
    LQ._questionsFilter.wordList = document.getElementById('filter-question-word-list').value;
    LQ._questionsFilter.tenseGroup = '';
  } else {
    LQ._questionsFilter.tenseGroup = '';
    LQ._questionsFilter.wordList = '';
  }
  
  LQ._questionsFilter.difficulty = document.getElementById('filter-question-difficulty').value;
  
  var modal = document.getElementById('admin-filter-modal');
  if (modal) modal.remove();
  
  LQ._questionPage = 1;
  LQ._updateFilterUIState();
  LQ._loadQuestions();
};

LQ.resetQuestionFilters = function (closeModal) {
  LQ._questionsFilter = {
    type: '',
    category: '',
    tenseGroup: '',
    wordList: '',
    difficulty: ''
  };
  
  var statusSel = document.getElementById('admin-question-status-filter');
  if (statusSel) statusSel.value = 'all';
  LQ._questionStatusFilter = 'all';
  
  var searchInp = document.getElementById('admin-question-search');
  if (searchInp) searchInp.value = '';
  LQ._questionSearch = '';
  
  if (closeModal) {
    var modal = document.getElementById('admin-filter-modal');
    if (modal) modal.remove();
  }
  
  LQ._questionPage = 1;
  LQ._updateFilterUIState();
  LQ._loadQuestions();
};

LQ._updateFilterUIState = function () {
  var isFiltered = 
    LQ._questionsFilter.type !== '' ||
    LQ._questionsFilter.category !== '' ||
    LQ._questionsFilter.tenseGroup !== '' ||
    LQ._questionsFilter.wordList !== '' ||
    LQ._questionsFilter.difficulty !== '' ||
    LQ._questionStatusFilter !== 'all' ||
    LQ._questionSearch !== '';
    
  var badge = document.getElementById('question-filter-badge');
  if (badge) {
    var activeCount = 0;
    if (LQ._questionsFilter.type) activeCount++;
    if (LQ._questionsFilter.category) activeCount++;
    if (LQ._questionsFilter.tenseGroup) activeCount++;
    if (LQ._questionsFilter.wordList) activeCount++;
    if (LQ._questionsFilter.difficulty) activeCount++;
    
    if (activeCount > 0) {
      badge.textContent = activeCount;
      badge.style.display = 'inline-block';
    } else {
      badge.style.display = 'none';
    }
  }
  
  var resetBtn = document.getElementById('btn-question-reset-filter');
  if (resetBtn) {
    resetBtn.style.display = isFiltered ? 'inline-block' : 'none';
  }
};

LQ._onQuestionStatusFilterChange = function (val) {
  LQ._questionStatusFilter = val;
  LQ._questionPage = 1;
  LQ._updateFilterUIState();
  LQ._loadQuestions();
};

LQ._debounceQuestionSearch = (function () {
  var timer;
  return function () {
    clearTimeout(timer);
    timer = setTimeout(function () {
      LQ._questionSearch = (document.getElementById('admin-question-search') || {}).value || '';
      LQ._questionPage = 1;
      LQ._updateFilterUIState();
      LQ._loadQuestions();
    }, 300);
  };
})();

LQ._loadQuestions = async function () {
  var tableWrap = document.getElementById('admin-questions-table-wrap');
  var pagWrap = document.getElementById('admin-questions-pagination');
  if (!tableWrap) return;

  tableWrap.innerHTML = '<p class="admin-loading">Loading questions...</p>';

  try {
    var url = '/api/admin/questions?page=' + LQ._questionPage + '&limit=20';
    if (LQ._questionSearch) url += '&search=' + encodeURIComponent(LQ._questionSearch);
    if (LQ._questionStatusFilter && LQ._questionStatusFilter !== 'all') url += '&status=' + encodeURIComponent(LQ._questionStatusFilter);
    if (LQ._questionsFilter.type) url += '&type=' + encodeURIComponent(LQ._questionsFilter.type);
    if (LQ._questionsFilter.category) url += '&category=' + encodeURIComponent(LQ._questionsFilter.category);
    if (LQ._questionsFilter.tenseGroup) url += '&tenseGroup=' + encodeURIComponent(LQ._questionsFilter.tenseGroup);
    if (LQ._questionsFilter.wordList) url += '&wordList=' + encodeURIComponent(LQ._questionsFilter.wordList);
    if (LQ._questionsFilter.difficulty) url += '&difficulty=' + encodeURIComponent(LQ._questionsFilter.difficulty);

    var resp = await fetch(url, { credentials: 'include' });
    var data = await resp.json();

    if (!resp.ok) {
      tableWrap.innerHTML = '<p class="admin-error">' + LQ.esc(data.error || 'Failed to load') + '</p>';
      return;
    }

    var questions = data.questions || [];
    LQ._questionsCache = questions;
    var pag = data.pagination || {};

    if (!questions.length) {
      tableWrap.innerHTML =
        '<div style="text-align:center;padding:40px 20px">' +
          '<div style="font-size:36px;margin-bottom:12px">❓</div>' +
          '<h3 style="margin:0 0 6px;color:#0f172a;font-size:16px;font-weight:600">No questions found</h3>' +
          '<p style="margin:0;color:#64748b;font-size:13px">Add a question manually or perform a bulk upload to populate the question bank.</p>' +
        '</div>';
      if (pagWrap) pagWrap.innerHTML = '';
      return;
    }

    var html = '<div class="admin-table-responsive"><table class="admin-table">' +
      '<thead><tr>' +
        '<th>#</th><th>Question</th><th>Type</th><th>Category</th><th>Tense Group / List</th><th>Difficulty</th><th>Marks</th><th>Status</th><th>Actions</th>' +
      '</tr></thead><tbody>';

    questions.forEach(function (q, idx) {
      var num = ((pag.page - 1) * pag.limit) + idx + 1;
      var isActive = q.isActive !== false;
      var statusBadge = isActive
        ? '<span style="color:#16a34a;font-weight:700">🟢 Active</span>'
        : '<span style="color:#dc2626;font-weight:700">🔴 Inactive</span>';

      var toggleBtn = isActive
        ? '<button class="admin-btn admin-btn-danger admin-btn-sm" title="Deactivate question" onclick="LQ._toggleQuestionStatus(\'' + q._id + '\', false)">Deactivate</button>'
        : '<button class="admin-btn admin-btn-outline admin-btn-sm" style="border-color:#16a34a;color:#16a34a;font-weight:700" title="Activate question" onclick="LQ._toggleQuestionStatus(\'' + q._id + '\', true)">Activate</button>';

      var actionsHtml = 
        '<div style="display:flex;gap:4px;flex-wrap:wrap">' +
          '<button type="button" class="admin-btn admin-btn-outline admin-btn-sm" style="border-color:#3b82f6;color:#3b82f6;font-weight:600" onclick="LQ.renderEditQuestionForm(\'' + q._id + '\')">Edit</button>' +
          toggleBtn +
        '</div>';

      var typeLabel = q.type || 'mcq';
      if (typeLabel === 'mcq') typeLabel = 'MCQ';
      else if (typeLabel === 'fib') typeLabel = 'FIB';
      else if (typeLabel === 'reading_listening') typeLabel = 'Reading & Listening';
      else if (typeLabel === 'listen_repeat') typeLabel = 'Listen & Repeat';
      else if (typeLabel === 'jumbled_sentence') typeLabel = 'Jumbled Sentence';
      else if (typeLabel === 'story_retelling') typeLabel = 'Story Retelling';
      else if (typeLabel === 'passage') typeLabel = 'Passage';

      var groupOrList = q.tenseGroup || q.wordList || '—';

      var displayText = q.questionText || '';
      if (displayText.length > 60) {
        displayText = displayText.substring(0, 57) + '...';
      }

      html +=
        '<tr' + (!isActive ? ' style="opacity:0.65;background:#fef2f2"' : '') + '>' +
          '<td>' + num + '</td>' +
          '<td><a href="#" onclick="LQ.viewQuestionSummary(\'' + q._id + '\'); return false;" style="color:#2563eb;text-decoration:none;font-weight:700" title="' + LQ.esc(q.questionText) + '">' + LQ.esc(displayText) + '</a></td>' +
          '<td><span style="font-size:11px;font-weight:600;background:#f1f5f9;padding:2px 6px;border-radius:4px">' + typeLabel + '</span></td>' +
          '<td>' + LQ.esc(q.category || 'General') + '</td>' +
          '<td><code>' + LQ.esc(groupOrList) + '</code></td>' +
          '<td class="admin-capitalize">' + LQ.esc(q.difficulty || 'medium') + '</td>' +
          '<td><strong>' + (q.marks || 1) + '</strong></td>' +
          '<td>' + statusBadge + '</td>' +
          '<td class="admin-actions-cell">' +
            actionsHtml +
          '</td>' +
        '</tr>';
    });

    html += '</tbody></table></div>';
    tableWrap.innerHTML = html;

    // Pagination
    if (pagWrap) {
      if (pag.pages > 1 || pag.total > 0) {
        var pagHtml = '<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;justify-content:center">' +
          '<span style="font-size:13px;color:#64748b">Total: <strong>' + pag.total + '</strong> (Page ' + pag.page + ' of ' + pag.pages + ')</span>' +
          '<div style="display:flex;gap:4px">';

        if (pag.page > 1) {
          pagHtml += '<button class="admin-page-btn" onclick="LQ._questionPage=' + (pag.page - 1) + ';LQ._loadQuestions()">← Prev</button>';
        }

        for (var i = 1; i <= pag.pages; i++) {
          if (i === 1 || i === pag.pages || (i >= pag.page - 2 && i <= pag.page + 2)) {
            pagHtml += '<button class="admin-page-btn' + (i === pag.page ? ' active' : '') + '" onclick="LQ._questionPage=' + i + ';LQ._loadQuestions()">' + i + '</button>';
          } else if (i === pag.page - 3 || i === pag.page + 3) {
            pagHtml += '<span style="padding:4px 8px;color:#64748b">...</span>';
          }
        }

        if (pag.page < pag.pages) {
          pagHtml += '<button class="admin-page-btn" onclick="LQ._questionPage=' + (pag.page + 1) + ';LQ._loadQuestions()">Next →</button>';
        }

        pagHtml += '</div></div>';
        pagWrap.innerHTML = pagHtml;
      } else {
        pagWrap.innerHTML = '';
      }
    }
  } catch (err) {
    tableWrap.innerHTML = '<p class="admin-error">Failed to load questions.</p>';
  }
};

LQ._toggleQuestionStatus = function (id, isActive) {
  var questionObj = (LQ._questionsCache || []).find(function(q) { return q._id === id; });
  var text = questionObj ? questionObj.questionText : 'this question';
  var actionText = isActive ? 'activate' : 'deactivate';
  
  LQ.showConfirmModal({
    title: (isActive ? 'Activate' : 'Deactivate') + ' Question',
    message: 'Are you sure you want to ' + actionText + ' question "' + text.substring(0, 40) + '..."?',
    icon: isActive ? '🟢' : '🔴',
    danger: !isActive,
    okText: isActive ? 'Activate' : 'Deactivate',
    onConfirm: async function () {
      try {
        var resp = await fetch('/api/admin/questions/' + id + '/status', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ isActive: isActive }),
        });
        var data = await resp.json();
        if (resp.ok) {
          LQ.toast('Question ' + (isActive ? 'activated' : 'deactivated') + '!');
          LQ._loadQuestions();
        } else {
          LQ.toast(data.error || 'Failed to update status');
        }
      } catch (e) {
        LQ.toast('Failed to update question status');
      }
    }
  });
};

// Helper states for dynamically rendering questions form
LQ._mcqOptions = ['', '', '', ''];
LQ._mcqType = 'single';
LQ._mcqCorrect = [false, false, false, false];
LQ._fibAnswers = [];

LQ._onMcqOptionTextChange = function(idx, val) {
  LQ._mcqOptions[idx] = val;
};

LQ._onMcqCorrectChange = function(idx, checked) {
  if (LQ._mcqType === 'single') {
    LQ._mcqCorrect = LQ._mcqCorrect.map(function() { return false; });
    LQ._mcqCorrect[idx] = true;
    LQ._renderMcqOptionsUI();
  } else {
    LQ._mcqCorrect[idx] = checked;
  }
};

LQ._addMcqOption = function() {
  if (LQ._mcqOptions.length < 6) {
    LQ._mcqOptions.push('');
    LQ._mcqCorrect.push(false);
    LQ._renderMcqOptionsUI();
  }
};

LQ._removeMcqOption = function(idx) {
  if (LQ._mcqOptions.length > 2) {
    LQ._mcqOptions.splice(idx, 1);
    LQ._mcqCorrect.splice(idx, 1);
    LQ._renderMcqOptionsUI();
  }
};

LQ._onMcqMultipleCheckboxChange = function(checked) {
  LQ._mcqType = checked ? 'multiple' : 'single';
  LQ._mcqCorrect = LQ._mcqCorrect.map(function() { return false; });
  LQ._renderMcqOptionsUI();
};

LQ._renderMcqOptionsUI = function() {
  var wrap = document.getElementById('mcq-options-list');
  if (!wrap) return;
  var html = '';
  var type = LQ._mcqType;
  
  LQ._mcqOptions.forEach(function(optVal, idx) {
    var label = String.fromCharCode(65 + idx);
    var isCorrect = LQ._mcqCorrect[idx];
    var inputType = (type === 'multiple') ? 'checkbox' : 'radio';
    var checkedAttr = isCorrect ? 'checked' : '';
    
    html += 
      '<div style="grid-column:1/-1; display:flex; flex-direction:row; align-items:center; gap:10px; margin-bottom:8px; width:100%">' +
        '<input type="' + inputType + '" name="mcq-correct-choice" value="' + idx + '" ' + checkedAttr + ' onchange="LQ._onMcqCorrectChange(' + idx + ', this.checked)" style="width:20px;height:20px;margin:0;cursor:pointer;flex-shrink:0" />' +
        '<input type="text" class="mcq-option-input" data-index="' + idx + '" value="' + LQ.esc(optVal) + '" oninput="LQ._onMcqOptionTextChange(' + idx + ', this.value)" placeholder="Option ' + label + '" required style="flex:1; padding: 10px 14px; border: 1.5px solid #e2e8f0; border-radius: 10px; font-size: 14px; outline: none; background: #fff; box-sizing: border-box;" />' +
        (LQ._mcqOptions.length > 2 ? '<button type="button" class="admin-btn admin-btn-danger admin-btn-sm" onclick="LQ._removeMcqOption(' + idx + ')" style="padding:10px 14px;flex-shrink:0">Remove</button>' : '') +
      '</div>';
  });
  wrap.innerHTML = html;
  
  var addBtn = document.getElementById('btn-add-mcq-option');
  if (addBtn) {
    addBtn.disabled = (LQ._mcqOptions.length >= 6);
  }
};

LQ._renderFibAnswersUI = function() {
  var wrap = document.getElementById('fib-answers-list');
  if (!wrap) return;
  var html = '';
  if (LQ._fibAnswers.length === 0) {
    html = '<p style="color:#64748b;font-size:13px;margin:10px 0">No blanks detected yet. Type <code>${blank}</code> in the question text above to add blanks.</p>';
  } else {
    LQ._fibAnswers.forEach(function(ansVal, idx) {
      html +=
        '<div class="admin-form-field" style="grid-column:1/-1; margin-bottom:8px">' +
          '<label>Answer for Blank ' + (idx + 1) + ' <span class="req">*</span></label>' +
          '<input type="text" class="fib-answer-input" data-index="' + idx + '" value="' + LQ.esc(ansVal) + '" oninput="LQ._onFibAnswerTextChange(' + idx + ', this.value)" placeholder="Enter expected answer for blank ' + (idx + 1) + '" required />' +
        '</div>';
    });
  }
  wrap.innerHTML = html;
};

LQ._onQuestionTextChange = function(text) {
  var type = document.getElementById('question-type').value;
  if (type === 'fib') {
    var count = (text.match(/\$\{blank\}/g) || []).length;
    while (LQ._fibAnswers.length < count) {
      LQ._fibAnswers.push('');
    }
    if (LQ._fibAnswers.length > count) {
      LQ._fibAnswers = LQ._fibAnswers.slice(0, count);
    }
    LQ._renderFibAnswersUI();
  }
};

LQ._onFibAnswerTextChange = function(idx, val) {
  LQ._fibAnswers[idx] = val;
};

LQ._onQuestionTypeChange = function(type) {
  var mcqSection = document.getElementById('mcq-section-wrap');
  var fibSection = document.getElementById('fib-section-wrap');
  var audioLimitField = document.getElementById('audio-limit-field');
  var passageSection = document.getElementById('passage-section-wrap');
  var mainMarksField = document.getElementById('question-marks-field');

  if (mcqSection) mcqSection.style.display = (type === 'mcq') ? 'block' : 'none';
  if (fibSection) fibSection.style.display = (type === 'fib') ? 'block' : 'none';
  
  var isAudioType = (type === 'reading_listening' || type === 'listen_repeat' || type === 'jumbled_sentence' || type === 'story_retelling' || type === 'passage');
  if (audioLimitField) {
    audioLimitField.style.display = isAudioType ? 'block' : 'none';
  }
  if (passageSection) {
    passageSection.style.display = (type === 'passage') ? 'block' : 'none';
    if (type === 'passage') {
      LQ._renderPassageSubQuestionsUI();
    }
  }
  if (mainMarksField) mainMarksField.style.display = (type === 'passage') ? 'none' : 'block';

  // Toggle required attribute for playLimit input
  var playLimitInput = document.getElementById('question-play-limit');
  if (playLimitInput) {
    if (isAudioType) {
      playLimitInput.setAttribute('required', 'required');
    } else {
      playLimitInput.removeAttribute('required');
    }
  }

  // Toggle required attribute for MCQ option inputs
  var mcqInputs = document.querySelectorAll('.mcq-option-input');
  mcqInputs.forEach(function(inp) {
    if (type === 'mcq') {
      inp.setAttribute('required', 'required');
    } else {
      inp.removeAttribute('required');
    }
  });

  if (type === 'fib') {
    var text = document.getElementById('question-text').value;
    LQ._onQuestionTextChange(text);
  }
};

LQ._onCategoryChange = function (val) {
  var tenseField = document.getElementById('tense-group-field');
  var wordField = document.getElementById('word-list-field');
  if (tenseField) tenseField.style.display = (val === 'Tense') ? 'block' : 'none';
  if (wordField) wordField.style.display = (val === 'Word') ? 'block' : 'none';
};

// Speech recognition helper
LQ.startSpeechRecognition = function (targetId) {
  var SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    LQ.toast('Speech recognition not supported in this browser. Please use Chrome, Edge or Safari.');
    return;
  }
  
  var recognition = new SpeechRecognition();
  recognition.lang = 'en-US';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  
  var targetEl = document.getElementById(targetId);
  var micBtn = document.getElementById(targetId + '-mic-btn');
  if (micBtn) {
    micBtn.textContent = 'Listening...';
    micBtn.style.color = '#ef4444';
  }
  
  recognition.start();
  
  recognition.onresult = function (event) {
    var speechResult = event.results[0][0].transcript;
    if (targetEl) {
      var currentText = targetEl.value.trim();
      targetEl.value = currentText ? currentText + ' ' + speechResult : speechResult;
      targetEl.dispatchEvent(new Event('input'));
    }
  };
  
  recognition.onspeechend = function () {
    recognition.stop();
  };
  
  recognition.onerror = function (event) {
    LQ.toast('Speech recognition error: ' + event.error);
    if (micBtn) {
      micBtn.textContent = '🎤 Speak';
      micBtn.style.color = '';
    }
  };
  
  recognition.onend = function () {
    if (micBtn) {
      micBtn.textContent = '🎤 Speak';
      micBtn.style.color = '';
    }
  };
};

// Passage sub-questions state & methods
LQ._passageSubQuestions = [];

LQ._addPassageSubQuestion = function () {
  if (LQ._passageSubQuestions.length >= 10) {
    LQ.toast('Maximum 10 sub-questions allowed.');
    return;
  }
  LQ._passageSubQuestions.push({
    type: 'mcq',
    questionText: '',
    mcqType: 'single',
    options: ['', '', '', ''],
    correctAnswers: [],
    marks: 1,
    explanation: ''
  });
  LQ._renderPassageSubQuestionsUI();
};

LQ._removePassageSubQuestion = function (subIdx) {
  LQ._passageSubQuestions.splice(subIdx, 1);
  LQ._renderPassageSubQuestionsUI();
};

LQ._onSubQuestionTextChange = function (subIdx, text) {
  LQ._passageSubQuestions[subIdx].questionText = text;
  if (LQ._passageSubQuestions[subIdx].type === 'fib') {
    LQ._updateSubQuestionFibBlanks(subIdx);
  }
};

LQ._onSubQuestionTypeChange = function (subIdx, type) {
  LQ._passageSubQuestions[subIdx].type = type;
  LQ._passageSubQuestions[subIdx].correctAnswers = [];
  LQ._renderPassageSubQuestionsUI();
};

LQ._onSubQuestionMcqMultipleChange = function (subIdx, checked) {
  LQ._passageSubQuestions[subIdx].mcqType = checked ? 'multiple' : 'single';
  LQ._passageSubQuestions[subIdx].correctAnswers = [];
  LQ._renderPassageSubQuestionsUI();
};

LQ._onSubQuestionOptionTextChange = function (subIdx, optIdx, val) {
  LQ._passageSubQuestions[subIdx].options[optIdx] = val;
};

LQ._onSubQuestionMcqCorrectChange = function (subIdx, optIdx, checked) {
  var subQ = LQ._passageSubQuestions[subIdx];
  var label = String.fromCharCode(65 + optIdx);
  
  if (subQ.mcqType === 'single') {
    subQ.correctAnswers = checked ? [label] : [];
    LQ._renderPassageSubQuestionsUI();
  } else {
    var existingIdx = subQ.correctAnswers.indexOf(label);
    if (checked && existingIdx === -1) {
      subQ.correctAnswers.push(label);
    } else if (!checked && existingIdx !== -1) {
      subQ.correctAnswers.splice(existingIdx, 1);
    }
  }
};

LQ._addSubQuestionOption = function (subIdx) {
  var subQ = LQ._passageSubQuestions[subIdx];
  if (subQ.options.length < 6) {
    subQ.options.push('');
    LQ._renderPassageSubQuestionsUI();
  }
};

LQ._removeSubQuestionOption = function (subIdx, optIdx) {
  var subQ = LQ._passageSubQuestions[subIdx];
  if (subQ.options.length > 2) {
    subQ.options.splice(optIdx, 1);
    var label = String.fromCharCode(65 + optIdx);
    var exist = subQ.correctAnswers.indexOf(label);
    if (exist !== -1) subQ.correctAnswers.splice(exist, 1);
    
    subQ.correctAnswers = subQ.correctAnswers.map(function(ans) {
      var code = ans.charCodeAt(0);
      if (code > 65 + optIdx) {
        return String.fromCharCode(code - 1);
      }
      return ans;
    });
    
    LQ._renderPassageSubQuestionsUI();
  }
};

LQ._onSubQuestionFibAnswerChange = function (subIdx, blankIdx, val) {
  var subQ = LQ._passageSubQuestions[subIdx];
  subQ.correctAnswers = subQ.correctAnswers || [];
  subQ.correctAnswers[blankIdx] = val;
};

LQ._onSubQuestionMarksChange = function (subIdx, marks) {
  LQ._passageSubQuestions[subIdx].marks = parseInt(marks, 10) || 1;
};

LQ._onSubQuestionExplanationChange = function (subIdx, exp) {
  LQ._passageSubQuestions[subIdx].explanation = exp;
};

LQ._renderPassageSubQuestionsUI = function () {
  var wrap = document.getElementById('passage-sub-questions-list');
  if (!wrap) return;

  var html = '';
  LQ._passageSubQuestions.forEach(function (subQ, subIdx) {
    var labelNum = subIdx + 1;
    var isMcq = (subQ.type === 'mcq');
    var isFib = (subQ.type === 'fib');

    var typeSelect =
      '<select onchange="LQ._onSubQuestionTypeChange(' + subIdx + ', this.value)" style="width:100%">' +
        '<option value="mcq" ' + (isMcq ? 'selected' : '') + '>MCQ</option>' +
        '<option value="fib" ' + (isFib ? 'selected' : '') + '>Fill in the Blanks</option>' +
      '</select>';

    var subQuestionDetailsHtml = '';

    if (isMcq) {
      var isMultiple = (subQ.mcqType === 'multiple');
      var checkedMultipleAttr = isMultiple ? 'checked' : '';
      
      var optionsListHtml = '';
      subQ.options.forEach(function (optVal, optIdx) {
        var optLabel = String.fromCharCode(65 + optIdx);
        var inputType = isMultiple ? 'checkbox' : 'radio';
        var isCorrect = subQ.correctAnswers.indexOf(optLabel) !== -1;
        var checkedAttr = isCorrect ? 'checked' : '';
        
        optionsListHtml +=
          '<div style="display:flex; flex-direction:row; align-items:center; gap:10px; margin-bottom:8px; width:100%">' +
            '<input type="' + inputType + '" name="mcq-correct-choice-' + subIdx + '" value="' + optIdx + '" ' + checkedAttr + ' onchange="LQ._onSubQuestionMcqCorrectChange(' + subIdx + ', ' + optIdx + ', this.checked)" style="width:18px;height:18px;margin:0;cursor:pointer;flex-shrink:0" />' +
            '<input type="text" value="' + LQ.esc(optVal) + '" oninput="LQ._onSubQuestionOptionTextChange(' + subIdx + ', ' + optIdx + ', this.value)" placeholder="Option ' + optLabel + '" required style="flex:1; padding: 8px 12px; border: 1.5px solid #e2e8f0; border-radius: 8px; font-size: 13px; outline: none; background: #fff; box-sizing: border-box;" />' +
            (subQ.options.length > 2 ? '<button type="button" class="admin-btn admin-btn-danger admin-btn-sm" onclick="LQ._removeSubQuestionOption(' + subIdx + ', ' + optIdx + ')" style="padding:8px 12px;flex-shrink:0">Remove</button>' : '') +
          '</div>';
      });

      subQuestionDetailsHtml =
        '<div style="grid-column:1/-1; margin-top:8px">' +
          '<div style="display:flex; align-items:center; gap:8px; margin-bottom:12px">' +
            '<input type="checkbox" id="mcq-multiple-' + subIdx + '" ' + checkedMultipleAttr + ' onchange="LQ._onSubQuestionMcqMultipleChange(' + subIdx + ', this.checked)" style="width:16px;height:16px;cursor:pointer" />' +
            '<label for="mcq-multiple-' + subIdx + '" style="font-size:12px;font-weight:600;color:#334155;cursor:pointer">Allow Multiple Correct Answers</label>' +
          '</div>' +
          '<div id="mcq-suboptions-list-' + subIdx + '">' + optionsListHtml + '</div>' +
          '<button type="button" class="admin-btn admin-btn-outline admin-btn-sm" onclick="LQ._addSubQuestionOption(' + subIdx + ')" style="margin-top:4px">+ Add Option</button>' +
        '</div>';
    } else if (isFib) {
      var blanksCount = (subQ.questionText.match(/\$\{blank\}/g) || []).length;
      var blanksHtml = '';
      if (blanksCount === 0) {
        blanksHtml = '<p style="color:#64748b;font-size:12px;margin:10px 0">No blanks detected. Type <code>${blank}</code> in the question text above to spawn blanks.</p>';
      } else {
        for (var b = 0; b < blanksCount; b++) {
          var ansVal = subQ.correctAnswers[b] || '';
          blanksHtml +=
            '<div style="margin-bottom:8px">' +
              '<label style="font-size:11px;font-weight:600;color:#64748b">Answer for Blank ' + (b + 1) + ' <span class="req">*</span></label>' +
              '<input type="text" value="' + LQ.esc(ansVal) + '" oninput="LQ._onSubQuestionFibAnswerChange(' + subIdx + ', ' + b + ', this.value)" placeholder="Enter expected answer..." required style="width:100%; padding: 8px 12px; border: 1.5px solid #e2e8f0; border-radius: 8px; font-size: 13px; box-sizing: border-box;" />' +
            '</div>';
        }
      }

      subQuestionDetailsHtml =
        '<div style="grid-column:1/-1; margin-top:8px">' +
          '<div style="font-size:11px;color:#64748b;margin-bottom:8px"><em>Sequential blank answers:</em></div>' +
          '<div id="subq-fib-blanks-container-' + subIdx + '">' + blanksHtml + '</div>' +
        '</div>';
    }

    html +=
      '<div class="card" style="border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 16px; background: #f8fafc; position: relative">' +
        '<button type="button" class="admin-btn admin-btn-danger admin-btn-sm" onclick="LQ._removePassageSubQuestion(' + subIdx + ')" style="position:absolute; top:12px; right:12px; padding:4px 8px">Remove Sub-Q</button>' +
        '<h5 style="margin:0 0 12px; font-weight:700; color:#0f172a">Sub-Question #' + labelNum + '</h5>' +
        
        '<div class="admin-form-grid" style="grid-template-columns:1fr 1fr; gap:10px">' +
          '<div class="admin-form-field">' +
            '<label>Sub-Question Type</label>' +
            typeSelect +
          '</div>' +
          '<div class="admin-form-field">' +
            '<label>Marks <span class="req">*</span></label>' +
            '<input type="number" min="1" value="' + subQ.marks + '" oninput="LQ._onSubQuestionMarksChange(' + subIdx + ', this.value)" required style="width:100%" />' +
          '</div>' +
          '<div class="admin-form-field" style="grid-column:1/-1">' +
            '<label style="display:flex; justify-content:space-between; align-items:center">' +
              '<span>Question Text <span class="req">*</span></span>' +
              '<button type="button" id="subq-text-input-' + subIdx + '-mic-btn" class="admin-btn admin-btn-outline admin-btn-sm" onclick="LQ.startSpeechRecognition(\'subq-text-input-' + subIdx + '\')" style="padding:2px 6px; font-size:11px">🎤 Speak</button>' +
            '</label>' +
            '<textarea id="subq-text-input-' + subIdx + '" rows="2" placeholder="Enter sub-question prompt..." oninput="LQ._onSubQuestionTextChange(' + subIdx + ', this.value)" required style="width:100%; box-sizing:border-box">' + LQ.esc(subQ.questionText) + '</textarea>' +
            (isFib ? '<div style="font-size:11px;color:#64748b;margin-top:4px">Type <code>${blank}</code> to create blanks.</div>' : '') +
          '</div>' +
        '</div>' +
        
        subQuestionDetailsHtml +
        
        '<div class="admin-form-field" style="margin-top:10px">' +
          '<label>Explanation</label>' +
          '<textarea rows="1" placeholder="Answer explanation..." oninput="LQ._onSubQuestionExplanationChange(' + subIdx + ', this.value)" style="width:100%; box-sizing:border-box">' + LQ.esc(subQ.explanation || '') + '</textarea>' +
        '</div>' +
      '</div>';
  });

  wrap.innerHTML = html;
};

LQ._updateSubQuestionFibBlanks = function (subIdx) {
  var subQ = LQ._passageSubQuestions[subIdx];
  var blanksCount = (subQ.questionText.match(/\$\{blank\}/g) || []).length;
  subQ.correctAnswers = subQ.correctAnswers || [];
  
  while (subQ.correctAnswers.length < blanksCount) {
    subQ.correctAnswers.push('');
  }
  if (subQ.correctAnswers.length > blanksCount) {
    subQ.correctAnswers = subQ.correctAnswers.slice(0, blanksCount);
  }
  
  var container = document.getElementById('subq-fib-blanks-container-' + subIdx);
  if (!container) return;
  
  var blanksHtml = '';
  if (blanksCount === 0) {
    blanksHtml = '<p style="color:#64748b;font-size:12px;margin:10px 0">No blanks detected. Type <code>${blank}</code> in the question text above to spawn blanks.</p>';
  } else {
    for (var b = 0; b < blanksCount; b++) {
      var ansVal = subQ.correctAnswers[b] || '';
      blanksHtml +=
        '<div style="margin-bottom:8px">' +
          '<label style="font-size:11px;font-weight:600;color:#64748b">Answer for Blank ' + (b + 1) + ' <span class="req">*</span></label>' +
          '<input type="text" value="' + LQ.esc(ansVal) + '" oninput="LQ._onSubQuestionFibAnswerChange(' + subIdx + ', ' + b + ', this.value)" placeholder="Enter expected answer..." required style="width:100%; padding: 8px 12px; border: 1.5px solid #e2e8f0; border-radius: 8px; font-size: 13px; box-sizing: border-box;" />' +
        '</div>';
    }
  }
  container.innerHTML = blanksHtml;
};

LQ.renderAddQuestionForm = async function () {
  // Reset fields to defaults
  LQ._mcqOptions = ['', '', '', ''];
  LQ._mcqType = 'single';
  LQ._mcqCorrect = [false, false, false, false];
  LQ._fibAnswers = [];
  LQ._passageSubQuestions = [];

  // Load tense groups
  var tenseGroups = [];
  try {
    var respG = await fetch('/api/admin/tenses', { credentials: 'include' });
    var dataG = await respG.json();
    if (dataG.ok) tenseGroups = dataG.groups || [];
  } catch (e) {}

  var tenseGroupOptions = '<option value="">-- Choose Tense Group (Optional) --</option>';
  tenseGroups.forEach(function (tg) {
    tenseGroupOptions += '<option value="' + tg.name + '">' + LQ.esc(tg.displayName || tg.name) + '</option>';
  });

  // Load word lists
  var wordLists = [];
  try {
    var respW = await fetch('/api/admin/word-lists?limit=1000', { credentials: 'include' });
    var dataW = await respW.json();
    if (dataW.ok) wordLists = dataW.items || [];
  } catch (e) {}

  var wordListOptions = '<option value="">-- Choose Word List (Optional) --</option>';
  wordLists.forEach(function (wl) {
    wordListOptions += '<option value="' + wl.id + '">' + LQ.esc(wl.name || wl.id) + '</option>';
  });

  var formHtml =
    '<form id="add-question-form" class="admin-form" onsubmit="LQ._submitAddQuestion(event)">' +
      '<div class="admin-form-grid">' +
        '<div class="admin-form-field">' +
          '<label>Question Type <span class="req">*</span></label>' +
          '<select id="question-type" onchange="LQ._onQuestionTypeChange(this.value)">' +
            '<option value="mcq">Multiple Choice Question (MCQ)</option>' +
            '<option value="fib">Fill in the Blanks (FIB)</option>' +
            '<option value="reading_listening">Reading & Listening</option>' +
            '<option value="listen_repeat">Listen & Repeat</option>' +
            '<option value="jumbled_sentence">Jumbled Sentence</option>' +
            '<option value="story_retelling">Story Retelling</option>' +
            '<option value="passage">Passage</option>' +
          '</select>' +
        '</div>' +
        '<div class="admin-form-field">' +
          '<label>Target Organization</label>' +
          '<select id="question-org" disabled>' +
            '<option value="global" selected>Global</option>' +
          '</select>' +
        '</div>' +
        '<div class="admin-form-field" style="grid-column:1/-1">' +
          '<label style="display:flex; justify-content:space-between; align-items:center">' +
            '<span>Question Text <span class="req">*</span></span>' +
            '<button type="button" id="question-text-mic-btn" class="admin-btn admin-btn-outline admin-btn-sm" onclick="LQ.startSpeechRecognition(\'question-text\')" style="padding:4px 8px; font-size:12px">🎤 Speak</button>' +
          '</label>' +
          '<textarea id="question-text" rows="3" required placeholder="Enter question prompt..." class="admin-search-input" style="width:100%" oninput="LQ._onQuestionTextChange(this.value)"></textarea>' +
          '<div style="font-size:12px;color:#64748b;margin-top:6px;line-height:1.4">' +
            '<strong>MCQ:</strong> You can use <code>_____</code> (underscores) inside the text if you wish to show a blank placeholder to the user.<br/>' +
            '<strong>FIB:</strong> Add <code>${blank}</code> where the blanks should be. For each <code>${blank}</code>, an answer field will spawn sequentially below.<br/>' +
            '<strong>Speech Types (Listen & Repeat, etc):</strong> The sentence will be played as audio on the student side.<br/>' +
            '<strong>Passage:</strong> Enter the reading passage here. It will be delivered as audio to the student.' +
          '</div>' +
        '</div>' +
        '<div class="admin-form-field">' +
          '<label>Category <span class="req">*</span></label>' +
          '<select id="question-category" onchange="LQ._onCategoryChange(this.value)">' +
            '<option value="General" selected>General</option>' +
            '<option value="Tense">Tense</option>' +
            '<option value="Word">Word</option>' +
          '</select>' +
        '</div>' +
        '<div class="admin-form-field" id="tense-group-field" style="display:none">' +
          '<label>Tenses Group</label>' +
          '<select id="question-tense-group">' +
            tenseGroupOptions +
          '</select>' +
        '</div>' +
        '<div class="admin-form-field" id="word-list-field" style="display:none">' +
          '<label>Word List</label>' +
          '<select id="question-word-list">' +
            wordListOptions +
          '</select>' +
        '</div>' +
        '<div class="admin-form-field">' +
          '<label>Difficulty <span class="req">*</span></label>' +
          '<select id="question-difficulty">' +
            '<option value="easy">Easy</option>' +
            '<option value="medium" selected>Medium</option>' +
            '<option value="hard">Hard</option>' +
          '</select>' +
        '</div>' +
        '<div class="admin-form-field" id="question-marks-field">' +
          '<label>Marks <span class="req">*</span></label>' +
          '<input type="number" id="question-marks" required min="1" value="1" />' +
        '</div>' +
        '<div class="admin-form-field">' +
          '<label>Duration <span class="req">*</span></label>' +
          '<input type="number" id="question-duration" required min="1" value="1" />' +
        '</div>' +
        '<div class="admin-form-field">' +
          '<label>Duration Type <span class="req">*</span></label>' +
          '<select id="question-duration-type">' +
            '<option value="seconds">Seconds</option>' +
            '<option value="minutes" selected>Minutes</option>' +
            '<option value="hours">Hours</option>' +
          '</select>' +
        '</div>' +
        '<div class="admin-form-field" id="audio-limit-field" style="display:none">' +
          '<label>Audio Play Limit <span class="req">*</span></label>' +
          '<input type="number" id="question-play-limit" required min="1" value="1" />' +
        '</div>' +
      '</div>' +

      '<!-- MCQ Options Section -->' +
      '<div id="mcq-section-wrap">' +
        '<h4 style="margin:20px 0 10px;font-weight:600;color:#0f172a">MCQ Options & Answers</h4>' +
        '<div style="grid-column:1/-1; display:flex; align-items:center; gap:8px; margin-bottom:12px">' +
          '<input type="checkbox" id="mcq-multiple-checkbox" onchange="LQ._onMcqMultipleCheckboxChange(this.checked)" style="width:16px;height:16px;cursor:pointer" />' +
          '<label for="mcq-multiple-checkbox" style="font-size:13px;font-weight:600;color:#334155;cursor:pointer">Allow Multiple Correct Answers</label>' +
        '</div>' +
        '<div id="mcq-options-list"></div>' +
        '<button type="button" id="btn-add-mcq-option" class="admin-btn admin-btn-outline" onclick="LQ._addMcqOption()" style="margin-top:10px">+ Add Option</button>' +
      '</div>' +

      '<!-- FIB Blanks Section -->' +
      '<div id="fib-section-wrap" style="display:none">' +
        '<h4 style="margin:20px 0 10px;font-weight:600;color:#0f172a">Blank Answers</h4>' +
        '<div style="font-size:12px;color:#64748b;margin-bottom:12px">' +
          '<em>Note: Please write the expected answers in the exact sequential order they appear in the question.</em>' +
        '</div>' +
        '<div id="fib-answers-list"></div>' +
      '</div>' +

      '<!-- Passage Sub-Questions Section -->' +
      '<div id="passage-section-wrap" style="display:none">' +
        '<h4 style="margin:20px 0 10px;font-weight:600;color:#0f172a">Passage Sub-Questions</h4>' +
        '<div style="font-size:12px;color:#64748b;margin-bottom:12px">' +
          '<em>Add sub-questions that the student needs to answer after listening to this passage. Max 10.</em>' +
        '</div>' +
        '<div id="passage-sub-questions-list"></div>' +
        '<button type="button" id="btn-add-sub-question" class="admin-btn admin-btn-outline" onclick="LQ._addPassageSubQuestion()" style="margin-top:10px">+ Add Sub-Question</button>' +
      '</div>' +

      '<div class="admin-form-field" style="grid-column:1/-1;margin-top:20px">' +
        '<label>Explanation</label>' +
        '<textarea id="question-explanation" rows="2" placeholder="Explain the correct answer choice..."></textarea>' +
      '</div>' +

      '<p id="question-error" class="admin-error-msg" style="display:none"></p>' +
      '<div class="admin-form-actions" style="margin-top:20px">' +
        '<button type="button" class="admin-btn admin-btn-outline" onclick="LQ.closeAdminDrawer()">Cancel</button>' +
        '<button type="submit" class="admin-btn admin-btn-primary" id="question-submit-btn">Save Question</button>' +
      '</div>' +
    '</form>';

  LQ.openAdminDrawer('Add New Question', formHtml);
  LQ._renderMcqOptionsUI();
  LQ._onQuestionTypeChange('mcq');
};

LQ._submitAddQuestion = async function (e) {
  e.preventDefault();
  var type = document.getElementById('question-type').value;
  var text = document.getElementById('question-text').value.trim();
  var category = document.getElementById('question-category').value;
  var tenseGroup = null;
  var wordList = null;

  if (category === 'Tense') {
    tenseGroup = document.getElementById('question-tense-group').value || null;
  } else if (category === 'Word') {
    wordList = document.getElementById('question-word-list').value || null;
  }

  var difficulty = document.getElementById('question-difficulty').value;
  var marks = parseInt(document.getElementById('question-marks').value, 10) || 1;
  var duration = parseInt(document.getElementById('question-duration').value, 10) || 1;
  var durationType = document.getElementById('question-duration-type').value || 'minutes';
  var playLimit = parseInt(document.getElementById('question-play-limit').value, 10) || 1;
  var explanation = document.getElementById('question-explanation').value.trim();
  var orgEl = document.getElementById('question-org');
  var btn = document.getElementById('question-submit-btn');
  var errEl = document.getElementById('question-error');

  if (!text) {
    if (errEl) { errEl.textContent = 'Question text is required.'; errEl.style.display = 'block'; }
    return;
  }

  var options = [];
  var correctAnswer = '';
  var correctAnswers = [];
  var mcqType = 'single';
  var subQuestions = [];

  if (type === 'mcq') {
    mcqType = LQ._mcqType;
    options = LQ._mcqOptions.map(function(opt) { return opt.trim(); });
    
    var correctIndices = [];
    LQ._mcqCorrect.forEach(function(isCor, idx) {
      if (isCor) correctIndices.push(idx);
    });

    if (correctIndices.length === 0) {
      if (errEl) { errEl.textContent = 'Please mark at least one correct option.'; errEl.style.display = 'block'; }
      return;
    }

    if (mcqType === 'single') {
      var correctLetter = String.fromCharCode(65 + correctIndices[0]);
      correctAnswer = correctLetter;
      correctAnswers = [correctLetter];
    } else {
      correctAnswers = correctIndices.map(function(idx) {
        return String.fromCharCode(65 + idx);
      });
      correctAnswer = correctAnswers.join(',');
    }
  } else if (type === 'fib') {
    var blanksCount = (text.match(/\$\{blank\}/g) || []).length;
    if (blanksCount === 0) {
      if (errEl) { errEl.textContent = 'Please add at least one ${blank} inside the question text.'; errEl.style.display = 'block'; }
      return;
    }
    
    correctAnswers = LQ._fibAnswers.map(function(ans) { return ans.trim(); });
    for (var i = 0; i < correctAnswers.length; i++) {
      if (!correctAnswers[i]) {
        if (errEl) { errEl.textContent = 'Please provide answer for blank ' + (i + 1) + '.'; errEl.style.display = 'block'; }
        return;
      }
    }
    correctAnswer = correctAnswers.join(',');
  } else if (type === 'passage') {
    if (LQ._passageSubQuestions.length === 0) {
      if (errEl) { errEl.textContent = 'Please add at least one sub-question for the passage.'; errEl.style.display = 'block'; }
      return;
    }
    
    var totalMarks = 0;
    for (var s = 0; s < LQ._passageSubQuestions.length; s++) {
      var sub = LQ._passageSubQuestions[s];
      if (!sub.questionText.trim()) {
        if (errEl) { errEl.textContent = 'Please enter question text for sub-question #' + (s + 1) + '.'; errEl.style.display = 'block'; }
        return;
      }
      
      totalMarks += sub.marks;
      
      if (sub.type === 'mcq') {
        if (sub.correctAnswers.length === 0) {
          if (errEl) { errEl.textContent = 'Please mark at least one correct option for sub-question #' + (s + 1) + '.'; errEl.style.display = 'block'; }
          return;
        }
      } else if (sub.type === 'fib') {
        var subBlanksCount = (sub.questionText.match(/\$\{blank\}/g) || []).length;
        if (subBlanksCount === 0) {
          if (errEl) { errEl.textContent = 'Please add at least one ${blank} for sub-question #' + (s + 1) + '.'; errEl.style.display = 'block'; }
          return;
        }
        for (var b = 0; b < subBlanksCount; b++) {
          if (!sub.correctAnswers[b] || !sub.correctAnswers[b].trim()) {
            if (errEl) { errEl.textContent = 'Please provide answer for blank ' + (b + 1) + ' of sub-question #' + (s + 1) + '.'; errEl.style.display = 'block'; }
            return;
          }
        }
      }
    }
    
    subQuestions = LQ._passageSubQuestions.map(function(sub) {
      var subCorrectAnswer = '';
      if (sub.type === 'mcq') {
        subCorrectAnswer = sub.correctAnswers.join(',');
      } else {
        subCorrectAnswer = sub.correctAnswers.map(function(ans) { return ans.trim(); }).join(',');
      }
      return {
        type: sub.type,
        questionText: sub.questionText.trim(),
        mcqType: sub.mcqType,
        options: sub.options.map(function(opt) { return opt.trim(); }),
        correctAnswer: subCorrectAnswer,
        correctAnswers: sub.correctAnswers.map(function(ans) { return ans.trim(); }),
        marks: sub.marks,
        explanation: sub.explanation.trim()
      };
    });
    
    marks = totalMarks;
  }

  var payload = {
    type: type,
    mcqType: mcqType,
    questionText: text,
    category: category,
    tenseGroup: tenseGroup,
    wordList: wordList,
    difficulty: difficulty,
    marks: marks,
    duration: duration,
    durationType: durationType,
    playLimit: playLimit,
    subQuestions: subQuestions,
    options: options,
    correctAnswer: correctAnswer,
    correctAnswers: correctAnswers,
    explanation: explanation,
    orgId: orgEl ? orgEl.value : 'global'
  };

  if (errEl) errEl.style.display = 'none';
  if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }

  try {
    var url = LQ._editQuestionId ? ('/api/admin/questions/' + LQ._editQuestionId) : '/api/admin/questions';
    var method = LQ._editQuestionId ? 'PUT' : 'POST';

    var resp = await fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    var data = await resp.json();

    if (resp.ok) {
      LQ.toast(LQ._editQuestionId ? 'Question updated!' : 'Question saved!');
      LQ.closeAdminDrawer();
      if (LQ._loadQuestions) LQ._loadQuestions();
    } else {
      if (errEl) { errEl.textContent = data.error || 'Failed to save question.'; errEl.style.display = 'block'; }
    }
  } catch (err) {
    if (errEl) { errEl.textContent = 'Network error. Please try again.'; errEl.style.display = 'block'; }
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = LQ._editQuestionId ? 'Update Question' : 'Save Question'; }
  }
};

// Edit question form pre-population
LQ.renderEditQuestionForm = async function (id) {
  try {
    var resp = await fetch('/api/admin/questions/' + id, { credentials: 'include' });
    var data = await resp.json();
    if (!resp.ok || !data.question) {
      LQ.toast(data.error || 'Failed to fetch question details.');
      return;
    }
    var q = data.question;
    
    // Render standard empty form layout
    await LQ.renderAddQuestionForm();
    
    // Update drawer header title
    var titleEl = document.querySelector('.admin-drawer-title');
    if (titleEl) titleEl.textContent = 'Edit Question';

    // Now set edit ID and pre-populate values
    LQ._editQuestionId = id;
    
    var typeEl = document.getElementById('question-type');
    var textEl = document.getElementById('question-text');
    var categoryEl = document.getElementById('question-category');
    var difficultyEl = document.getElementById('question-difficulty');
    var marksEl = document.getElementById('question-marks');
    var playLimitEl = document.getElementById('question-play-limit');
    var explanationEl = document.getElementById('question-explanation');

    if (typeEl) typeEl.value = q.type || 'mcq';
    if (textEl) textEl.value = q.questionText || '';
    if (categoryEl) categoryEl.value = q.category || 'General';
    if (difficultyEl) difficultyEl.value = q.difficulty || 'medium';
    if (marksEl) marksEl.value = q.marks || 1;
    var durationEl = document.getElementById('question-duration');
    var durationTypeEl = document.getElementById('question-duration-type');
    if (durationEl) durationEl.value = q.duration || 1;
    if (durationTypeEl) durationTypeEl.value = q.durationType || 'minutes';
    if (playLimitEl) playLimitEl.value = q.playLimit || 1;
    if (explanationEl) explanationEl.value = q.explanation || '';
    
    // Trigger category selection view updates
    LQ._onCategoryChange(q.category);
    if (q.category === 'Tense') {
      var tenseEl = document.getElementById('question-tense-group');
      if (tenseEl) tenseEl.value = q.tenseGroup || '';
    } else if (q.category === 'Word') {
      var wordEl = document.getElementById('question-word-list');
      if (wordEl) wordEl.value = q.wordList || '';
    }
    
    // Trigger type view updates
    LQ._onQuestionTypeChange(q.type);
    
    if (q.type === 'mcq') {
      LQ._mcqType = q.mcqType || 'single';
      LQ._mcqOptions = q.options && q.options.length ? q.options.slice() : ['', '', '', ''];
      
      LQ._mcqCorrect = LQ._mcqOptions.map(function(opt, idx) {
        var letter = String.fromCharCode(65 + idx);
        return q.correctAnswers.indexOf(letter) !== -1;
      });
      
      var checkbox = document.getElementById('mcq-multiple-checkbox');
      if (checkbox) checkbox.checked = (LQ._mcqType === 'multiple');
      
      LQ._renderMcqOptionsUI();
    } else if (q.type === 'fib') {
      LQ._fibAnswers = q.correctAnswers || [];
      // Build blanks manually since text has already changed
      var blanksCount = (q.questionText.match(/\$\{blank\}/g) || []).length;
      var fibAnswersList = document.getElementById('fib-answers-list');
      if (fibAnswersList) {
        var blanksHtml = '';
        for (var b = 0; b < blanksCount; b++) {
          var ansVal = LQ._fibAnswers[b] || '';
          blanksHtml +=
            '<div style="margin-bottom:8px">' +
              '<label style="font-size:11px;font-weight:600;color:#64748b">Answer for Blank ' + (b + 1) + ' <span class="req">*</span></label>' +
              '<input type="text" value="' + LQ.esc(ansVal) + '" oninput="LQ._onFibAnswerTextChange(' + b + ', this.value)" placeholder="Enter expected answer..." required style="width:100%; padding: 8px 12px; border: 1.5px solid #e2e8f0; border-radius: 8px; font-size: 13px; box-sizing: border-box;" />' +
            '</div>';
        }
        fibAnswersList.innerHTML = blanksHtml;
      }
    } else if (q.type === 'passage') {
      LQ._passageSubQuestions = q.subQuestions && q.subQuestions.length ? JSON.parse(JSON.stringify(q.subQuestions)) : [];
      LQ._renderPassageSubQuestionsUI();
    }
    
    // Change Save button text to Update
    var btn = document.getElementById('question-submit-btn');
    if (btn) btn.textContent = 'Update Question';
    
  } catch (err) {
    console.error('Error pre-populating edit form:', err);
    LQ.toast('Error loading question details.');
  }
};

// View detailed question summary modal
LQ.viewQuestionSummary = async function (id) {
  try {
    var resp = await fetch('/api/admin/questions/' + id, { credentials: 'include' });
    var data = await resp.json();
    if (!resp.ok || !data.question) {
      LQ.toast(data.error || 'Failed to fetch question.');
      return;
    }
    var q = data.question;

    var typeLabel = q.type || 'mcq';
    if (typeLabel === 'mcq') typeLabel = 'MCQ';
    else if (typeLabel === 'fib') typeLabel = 'FIB';
    else if (typeLabel === 'reading_listening') typeLabel = 'Reading & Listening';
    else if (typeLabel === 'listen_repeat') typeLabel = 'Listen & Repeat';
    else if (typeLabel === 'jumbled_sentence') typeLabel = 'Jumbled Sentence';
    else if (typeLabel === 'story_retelling') typeLabel = 'Story Retelling';
    else if (typeLabel === 'passage') typeLabel = 'Passage';

    var groupOrList = q.tenseGroup || q.wordList || '—';

    var detailsHtml = 
      '<div style="font-family:sans-serif; color:#334155; line-height:1.5">' +
        '<div style="margin-bottom:12px"><strong>Question Text:</strong><br/><span style="font-size:15px; color:#0f172a; white-space:pre-wrap">' + LQ.esc(q.questionText) + '</span></div>' +
        '<div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:12px">' +
          '<div><strong>Type:</strong> ' + typeLabel + '</div>' +
          '<div><strong>Category:</strong> ' + LQ.esc(q.category || 'General') + '</div>' +
          '<div><strong>Tense Group / List:</strong> ' + LQ.esc(groupOrList) + '</div>' +
          '<div><strong>Difficulty:</strong> <span class="admin-capitalize">' + q.difficulty + '</span></div>' +
          '<div><strong>Marks:</strong> ' + (q.marks || 1) + '</div>' +
          '<div><strong>Duration:</strong> ' + (q.duration || 1) + ' ' + (q.durationType || 'minutes') + '</div>' +
          (q.playLimit ? '<div><strong>Audio Play Limit:</strong> ' + q.playLimit + '</div>' : '') +
        '</div>';

    if (q.type === 'mcq') {
      detailsHtml += '<div style="margin-bottom:12px"><strong>Options:</strong><ul style="margin:5px 0; padding-left:20px">';
      q.options.forEach(function(opt, idx) {
        var letter = String.fromCharCode(65 + idx);
        var isCorrect = q.correctAnswers.indexOf(letter) !== -1;
        detailsHtml += '<li style="' + (isCorrect ? 'font-weight:700; color:#16a34a' : '') + '">' + letter + ': ' + LQ.esc(opt) + (isCorrect ? ' ✓' : '') + '</li>';
      });
      detailsHtml += '</ul></div>';
    } else if (q.type === 'fib') {
      detailsHtml += '<div style="margin-bottom:12px"><strong>Expected Blank Answers:</strong><ol style="margin:5px 0; padding-left:20px">';
      q.correctAnswers.forEach(function(ans, idx) {
        detailsHtml += '<li>Blank ' + (idx + 1) + ': <code>' + LQ.esc(ans) + '</code></li>';
      });
      detailsHtml += '</ol></div>';
    } else if (q.type === 'passage') {
      detailsHtml += '<div style="margin-bottom:12px"><strong>Sub-Questions (' + (q.subQuestions ? q.subQuestions.length : 0) + '):</strong><div style="margin-top:8px">';
      (q.subQuestions || []).forEach(function(sub, sIdx) {
        var subTypeLabel = sub.type === 'mcq' ? 'MCQ' : 'FIB';
        detailsHtml += 
          '<div style="border:1px solid #e2e8f0; border-radius:8px; padding:10px; margin-bottom:10px; background:#f8fafc">' +
            '<strong>Sub-Q #' + (sIdx + 1) + ' (' + subTypeLabel + ' - ' + sub.marks + ' Marks):</strong> ' + LQ.esc(sub.questionText) + '<br/>';
        
        if (sub.type === 'mcq') {
          detailsHtml += '<ul style="margin:5px 0; padding-left:20px; font-size:13px">';
          sub.options.forEach(function(opt, idx) {
            var letter = String.fromCharCode(65 + idx);
            var isCorrect = sub.correctAnswers.indexOf(letter) !== -1;
            detailsHtml += '<li style="' + (isCorrect ? 'font-weight:700; color:#16a34a' : '') + '">' + letter + ': ' + LQ.esc(opt) + (isCorrect ? ' ✓' : '') + '</li>';
          });
          detailsHtml += '</ul>';
        } else {
          detailsHtml += '<ol style="margin:5px 0; padding-left:20px; font-size:13px">';
          sub.correctAnswers.forEach(function(ans, idx) {
            detailsHtml += '<li>Blank ' + (idx + 1) + ': <code>' + LQ.esc(ans) + '</code></li>';
          });
          detailsHtml += '</ol>';
        }
        detailsHtml += '</div>';
      });
      detailsHtml += '</div></div>';
    }

    if (q.explanation) {
      detailsHtml += '<div style="margin-top:12px; padding-top:10px; border-top:1px solid #e2e8f0"><strong>Explanation:</strong><br/>' + LQ.esc(q.explanation) + '</div>';
    }

    detailsHtml += '</div>';

    var existing = document.getElementById('admin-summary-modal');
    if (existing) existing.remove();

    var modal = document.createElement('div');
    modal.id = 'admin-summary-modal';
    modal.className = 'admin-confirm-modal-overlay';
    modal.innerHTML =
      '<div class="admin-confirm-modal-card" style="max-width:600px; width:90%; padding:24px; text-align:left; max-height:85vh; overflow-y:auto">' +
        '<h3 style="margin:0 0 16px;font-size:18px;font-weight:700;color:#0f172a">📋 Question Summary</h3>' +
        detailsHtml +
        '<div style="margin-top:20px; display:flex; justify-content:flex-end">' +
          '<button type="button" class="admin-btn admin-btn-primary" onclick="document.getElementById(\'admin-summary-modal\').remove()">Close</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(modal);

  } catch (err) {
    LQ.toast('Error displaying question summary.');
  }
};

/* ══════════════════════════════════════════════════
   TENSES GROUPS MANAGEMENT PAGE (admin only)
   ══════════════════════════════════════════════════ */

LQ.renderAdminTensesPage = async function () {
  var wrap = document.getElementById('admin-tenses-wrap');
  if (!wrap) return;

  wrap.innerHTML =
    '<div class="admin-page-header">' +
      '<h2 class="admin-page-title">🕒 Tenses Management</h2>' +
      '<div class="admin-header-actions" id="tenses-header-actions">' +
        '<button type="button" class="admin-btn admin-btn-outline" style="margin-right:8px" onclick="LQ.renderTensesBulkUploadForm()">📤 Bulk Upload</button>' +
        '<button type="button" class="admin-btn admin-btn-primary" onclick="LQ.renderAddTenseContentForm()">+ Add Question</button>' +
      '</div>' +
    '</div>' +
    '<div style="display:flex;gap:12px;margin-bottom:16px;border-bottom:1px solid #e2e8f0;padding-bottom:1px">' +
      '<button type="button" class="admin-tab-btn active" id="tab-btn-tenses-questions" onclick="LQ._switchTensesTab(\'questions\')" style="padding:8px 16px;font-weight:600;border:none;background:none;border-bottom:2px solid #2563eb;cursor:pointer;outline:none">Questions</button>' +
      '<button type="button" class="admin-tab-btn" id="tab-btn-tenses-groups" onclick="LQ._switchTensesTab(\'groups\')" style="padding:8px 16px;font-weight:600;border:none;background:none;color:#64748b;cursor:pointer;outline:none">Groups</button>' +
    '</div>' +
    '<div id="tenses-questions-filter-bar" class="admin-search-bar" style="display:flex;gap:10px;align-items:center;margin-bottom:16px">' +
      '<label for="tenses-group-filter" style="font-weight:600;font-size:13px">Filter Group:</label>' +
      '<select id="tenses-group-filter" class="admin-search-input" style="width:auto;min-width:200px" onchange="LQ._loadTensesQuestions()">' +
        '<option value="all">All Groups</option>' +
      '</select>' +
    '</div>' +
    '<div id="admin-tenses-table-wrap" class="admin-table-wrap"><p class="admin-loading">Loading...</p></div>' +
    '<div id="admin-tenses-pagination-wrap" class="admin-pagination-row" style="display:none;background:#fff;border-top:1px solid #e2e8f0;padding:12px 20px;flex-shrink:0;justify-content:space-between;align-items:center;"></div>';

  LQ._tensesActiveTab = 'questions';

  // Load group filter dropdown
  try {
    var respG = await fetch('/api/admin/tenses', { credentials: 'include' });
    var dataG = await respG.json();
    if (dataG.ok && dataG.groups) {
      var filterSelect = document.getElementById('tenses-group-filter');
      if (filterSelect) {
        dataG.groups.forEach(function (g) {
          var opt = document.createElement('option');
          opt.value = g.name;
          opt.textContent = g.displayName || g.name;
          filterSelect.appendChild(opt);
        });
      }
    }
  } catch (e) {}

  LQ._loadTensesQuestions();
};

LQ._switchTensesTab = function (tab) {
  LQ._tensesActiveTab = tab;
  var btnQ = document.getElementById('tab-btn-tenses-questions');
  var btnG = document.getElementById('tab-btn-tenses-groups');
  var filterBar = document.getElementById('tenses-questions-filter-bar');
  var headerActions = document.getElementById('tenses-header-actions');

  if (tab === 'questions') {
    if (btnQ) { btnQ.classList.add('active'); btnQ.style.borderBottom = '2px solid #2563eb'; btnQ.style.color = ''; }
    if (btnG) { btnG.classList.remove('active'); btnG.style.borderBottom = 'none'; btnG.style.color = '#64748b'; }
    if (filterBar) filterBar.style.display = 'flex';
    if (headerActions) {
      headerActions.innerHTML =
        '<button type="button" class="admin-btn admin-btn-outline" style="margin-right:8px" onclick="LQ.renderTensesBulkUploadForm()">📤 Bulk Upload</button>' +
        '<button type="button" class="admin-btn admin-btn-primary" onclick="LQ.renderAddTenseContentForm()">+ Add Question</button>';
    }
    LQ._loadTensesQuestions();
  } else {
    if (btnG) { btnG.classList.add('active'); btnG.style.borderBottom = '2px solid #2563eb'; btnG.style.color = ''; }
    if (btnQ) { btnQ.classList.remove('active'); btnQ.style.borderBottom = 'none'; btnQ.style.color = '#64748b'; }
    if (filterBar) filterBar.style.display = 'none';
    if (headerActions) {
      headerActions.innerHTML =
        '<button type="button" class="admin-btn admin-btn-primary" onclick="LQ.renderAddTenseGroupForm()">+ Add Tense Group</button>';
    }
    LQ._loadTensesGroups();
  }
};

LQ._loadTensesQuestions = async function () {
  var tableWrap = document.getElementById('admin-tenses-table-wrap');
  if (!tableWrap) return;

  var pagWrap = document.getElementById('admin-tenses-pagination-wrap');
  if (pagWrap) pagWrap.style.display = 'none';

  tableWrap.innerHTML = '<p class="admin-loading">Loading questions...</p>';

  try {
    if (!LQ._tensesQuestionsPage) LQ._tensesQuestionsPage = 1;
    var groupFilter = document.getElementById('tenses-group-filter') ? document.getElementById('tenses-group-filter').value : 'all';
    var url = '/api/admin/tense-contents?group=' + groupFilter + '&page=' + LQ._tensesQuestionsPage + '&limit=10';
    var resp = await fetch(url, { credentials: 'include' });
    var data = await resp.json();

    if (!resp.ok) {
      tableWrap.innerHTML = '<p class="admin-error">' + LQ.esc(data.error || 'Failed to load') + '</p>';
      return;
    }

    var items = data.items || [];

    if (!items.length) {
      tableWrap.innerHTML =
        '<div style="text-align:center;padding:40px 20px">' +
          '<div style="font-size:36px;margin-bottom:12px">🕒</div>' +
          '<h3 style="margin:0 0 6px;color:#0f172a;font-size:16px;font-weight:600">No tenses questions found</h3>' +
          '<p style="margin:0;color:#64748b;font-size:13px">Add a tenses question to get started.</p>' +
        '</div>';
      return;
    }

    var html = '<div class="admin-table-responsive"><table class="admin-table">' +
      '<thead><tr>' +
        '<th>#</th><th>Group</th><th>Title / Text</th><th>Category</th><th>Actions</th>' +
      '</tr></thead><tbody>';

    items.forEach(function (item, idx) {
      var startIdx = (data.page - 1) * 10 + idx + 1;
      var titleText = item.title || item.text || item.topic || '(No text)';
      html +=
        '<tr>' +
          '<td>' + startIdx + '</td>' +
          '<td><code>' + LQ.esc(item.group) + '</code></td>' +
          '<td><strong>' + LQ.esc(titleText.substring(0, 80)) + (titleText.length > 80 ? '...' : '') + '</strong></td>' +
          '<td><span class="admin-capitalize">' + LQ.esc(item.category || 'reading') + '</span></td>' +
          '<td>' +
            '<button class="admin-btn admin-btn-outline admin-btn-sm" style="margin-right:6px" onclick="LQ.renderEditTenseContentForm(\'' + item._id + '\')">Edit</button>' +
            '<button class="admin-btn admin-btn-danger admin-btn-sm" onclick="LQ._deleteTenseContent(\'' + item._id + '\')">Delete</button>' +
          '</td>' +
        '</tr>';
    });

    html += '</tbody></table></div>';
    tableWrap.innerHTML = html;

    // Render pagination row outside tableWrap
    if (pagWrap) {
      if (data.pages > 1) {
        var pagHtml = '<span class="admin-pagination-info" style="font-size:13px;color:#64748b">Showing page ' + data.page + ' of ' + data.pages + ' (' + data.total + ' total)</span>' +
          '<div style="display:flex;gap:6px">';
        
        if (data.page > 1) {
          pagHtml += '<button class="admin-page-btn" onclick="LQ._tensesQuestionsPage=' + (data.page - 1) + ';LQ._loadTensesQuestions()">← Prev</button>';
        }
        
        for (var i = 1; i <= data.pages; i++) {
          if (i === data.page) {
            pagHtml += '<button class="admin-page-btn active" style="background:#2563eb;color:#fff;border-color:#2563eb" disabled>' + i + '</button>';
          } else {
            if (i === 1 || i === data.pages || Math.abs(i - data.page) <= 2) {
              pagHtml += '<button class="admin-page-btn" onclick="LQ._tensesQuestionsPage=' + i + ';LQ._loadTensesQuestions()">' + i + '</button>';
            } else if (i === 2 || i === data.pages - 1) {
              pagHtml += '<span style="color:#94a3b8;padding:4px">...</span>';
            }
          }
        }
        
        if (data.page < data.pages) {
          pagHtml += '<button class="admin-page-btn" onclick="LQ._tensesQuestionsPage=' + (data.page + 1) + ';LQ._loadTensesQuestions()">Next →</button>';
        }
        
        pagHtml += '</div>';
        pagWrap.innerHTML = pagHtml;
        pagWrap.style.display = 'flex';
      } else {
        pagWrap.style.display = 'none';
      }
    }
  } catch (err) {
    tableWrap.innerHTML = '<p class="admin-error">Failed to load tenses questions.</p>';
  }
};

LQ._loadTensesGroups = async function () {
  var tableWrap = document.getElementById('admin-tenses-table-wrap');
  if (!tableWrap) return;

  var pagWrap = document.getElementById('admin-tenses-pagination-wrap');
  if (pagWrap) pagWrap.style.display = 'none';

  tableWrap.innerHTML = '<p class="admin-loading">Loading groups...</p>';

  try {
    if (!LQ._tensesGroupsPage) LQ._tensesGroupsPage = 1;
    var resp = await fetch('/api/admin/tenses?page=' + LQ._tensesGroupsPage + '&limit=10', { credentials: 'include' });
    var data = await resp.json();

    if (!resp.ok) {
      tableWrap.innerHTML = '<p class="admin-error">' + LQ.esc(data.error || 'Failed to load') + '</p>';
      return;
    }

    var groups = data.groups || [];

    if (!groups.length) {
      tableWrap.innerHTML =
        '<div style="text-align:center;padding:40px 20px">' +
          '<div style="font-size:36px;margin-bottom:12px">🕒</div>' +
          '<h3 style="margin:0 0 6px;color:#0f172a;font-size:16px;font-weight:600">No tense groups found</h3>' +
          '<p style="margin:0;color:#64748b;font-size:13px">Create a tense group to get started.</p>' +
        '</div>';
      return;
    }

    var html = '<div class="admin-table-responsive"><table class="admin-table">' +
      '<thead><tr>' +
        '<th>#</th><th>Name</th><th>Display Name</th><th>Description</th>' +
      '</tr></thead><tbody>';

    groups.forEach(function (g, idx) {
      var startIdx = (data.page - 1) * 10 + idx + 1;
      html +=
        '<tr>' +
          '<td>' + startIdx + '</td>' +
          '<td><code>' + LQ.esc(g.name) + '</code></td>' +
          '<td><strong>' + LQ.esc(g.displayName) + '</strong></td>' +
          '<td>' + LQ.esc(g.description || '—') + '</td>' +
        '</tr>';
    });

    html += '</tbody></table></div>';
    tableWrap.innerHTML = html;

    // Render pagination row outside tableWrap
    if (pagWrap) {
      if (data.pages > 1) {
        var pagHtml = '<span class="admin-pagination-info" style="font-size:13px;color:#64748b">Showing page ' + data.page + ' of ' + data.pages + ' (' + data.total + ' total)</span>' +
          '<div style="display:flex;gap:6px">';
        
        if (data.page > 1) {
          pagHtml += '<button class="admin-page-btn" onclick="LQ._tensesGroupsPage=' + (data.page - 1) + ';LQ._loadTensesGroups()">← Prev</button>';
        }
        
        for (var i = 1; i <= data.pages; i++) {
          if (i === data.page) {
            pagHtml += '<button class="admin-page-btn active" style="background:#2563eb;color:#fff;border-color:#2563eb" disabled>' + i + '</button>';
          } else {
            if (i === 1 || i === data.pages || Math.abs(i - data.page) <= 2) {
              pagHtml += '<button class="admin-page-btn" onclick="LQ._tensesGroupsPage=' + i + ';LQ._loadTensesGroups()">' + i + '</button>';
            } else if (i === 2 || i === data.pages - 1) {
              pagHtml += '<span style="color:#94a3b8;padding:4px">...</span>';
            }
          }
        }
        
        if (data.page < data.pages) {
          pagHtml += '<button class="admin-page-btn" onclick="LQ._tensesGroupsPage=' + (data.page + 1) + ';LQ._loadTensesGroups()">Next →</button>';
        }
        
        pagHtml += '</div>';
        pagWrap.innerHTML = pagHtml;
        pagWrap.style.display = 'flex';
      } else {
        pagWrap.style.display = 'none';
      }
    }
  } catch (err) {
    tableWrap.innerHTML = '<p class="admin-error">Failed to load tenses groups.</p>';
  }
};


LQ.renderAddTenseGroupForm = function () {
  var formHtml =
    '<form id="add-tense-group-form" class="admin-form" onsubmit="LQ._submitAddTenseGroup(event)">' +
      '<div class="admin-form-grid">' +
        '<div class="admin-form-field" style="grid-column:1/-1">' +
          '<label>Group Name <span class="req">*</span></label>' +
          '<input type="text" id="tense-group-name" required placeholder="e.g., future-perfect-continuous" />' +
          '<p class="admin-hint" style="margin-top:4px">Use lowercase and hyphens for spaces (e.g. past-simple).</p>' +
        '</div>' +
        '<div class="admin-form-field" style="grid-column:1/-1">' +
          '<label>Display Name</label>' +
          '<input type="text" id="tense-group-display" placeholder="e.g., Future Perfect Continuous (optional)" />' +
        '</div>' +
        '<div class="admin-form-field" style="grid-column:1/-1">' +
          '<label>Description</label>' +
          '<textarea id="tense-group-desc" rows="3" placeholder="Optional group description..."></textarea>' +
        '</div>' +
      '</div>' +
      '<p id="tense-group-error" class="admin-error-msg" style="display:none"></p>' +
      '<div class="admin-form-actions">' +
        '<button type="button" class="admin-btn admin-btn-outline" onclick="LQ.closeAdminDrawer()">Cancel</button>' +
        '<button type="submit" class="admin-btn admin-btn-primary" id="tense-group-submit-btn">Save Group</button>' +
      '</div>' +
    '</form>';

  LQ.openAdminDrawer('Add New Tenses Group', formHtml);
};

LQ._submitAddTenseGroup = async function (e) {
  e.preventDefault();
  var name = document.getElementById('tense-group-name').value.trim();
  var displayName = document.getElementById('tense-group-display').value.trim();
  var description = document.getElementById('tense-group-desc').value.trim();
  var btn = document.getElementById('tense-group-submit-btn');
  var errEl = document.getElementById('tense-group-error');

  if (!name) return;

  if (errEl) errEl.style.display = 'none';
  if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }

  try {
    var resp = await fetch('/api/admin/tenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name: name, displayName: displayName, description: description })
    });
    var data = await resp.json();

    if (resp.ok) {
      LQ.toast('Tenses group created!');
      LQ.closeAdminDrawer();
      LQ._loadTensesGroups();
    } else {
      if (errEl) { errEl.textContent = data.error || 'Failed to create group.'; errEl.style.display = 'block'; }
    }
  } catch (err) {
    if (errEl) { errEl.textContent = 'Network error. Please try again.'; errEl.style.display = 'block'; }
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Save Group'; }
  }
};

LQ.renderAddTenseContentForm = async function () {
  // Load tense groups
  var tenseGroups = [];
  try {
    var respG = await fetch('/api/admin/tenses', { credentials: 'include' });
    var dataG = await respG.json();
    if (dataG.ok) tenseGroups = dataG.groups || [];
  } catch (e) {}

  var tenseGroupOptions = '<option value="">-- Choose Tense Group --</option>';
  tenseGroups.forEach(function (tg) {
    tenseGroupOptions += '<option value="' + tg.name + '">' + LQ.esc(tg.displayName || tg.name) + '</option>';
  });

  var formHtml =
    '<form id="add-tense-content-form" class="admin-form" onsubmit="LQ._submitTenseContent(event)">' +
      '<div class="admin-form-grid">' +
        '<div class="admin-form-field">' +
          '<label>Tenses Group <span class="req">*</span></label>' +
          '<select id="tense-content-group" required>' +
            tenseGroupOptions +
          '</select>' +
        '</div>' +
        '<div class="admin-form-field">' +
          '<label>Category <span class="req">*</span></label>' +
          '<select id="tense-content-category" required>' +
            '<option value="reading">Reading</option>' +
            '<option value="speaking">Speaking</option>' +
            '<option value="writing">Writing</option>' +
            '<option value="grammar">Grammar</option>' +
          '</select>' +
        '</div>' +
        '<div class="admin-form-field" style="grid-column:1/-1">' +
          '<label>Title / Topic <span class="req">*</span></label>' +
          '<input type="text" id="tense-content-title" required placeholder="e.g. A Rainy Morning, or Topic prompt" />' +
        '</div>' +
        '<div class="admin-form-field" style="grid-column:1/-1">' +
          '<label>Body Text / Passage / Story</label>' +
          '<textarea id="tense-content-story" rows="4" placeholder="Optional story, passage, or sentence text..."></textarea>' +
        '</div>' +
      '</div>' +

      '<p id="tense-content-error" class="admin-error-msg" style="display:none"></p>' +
      '<div class="admin-form-actions" style="margin-top:20px">' +
        '<button type="button" class="admin-btn admin-btn-outline" onclick="LQ.closeAdminDrawer()">Cancel</button>' +
        '<button type="submit" class="admin-btn admin-btn-primary" id="tense-content-submit-btn">Save Question</button>' +
      '</div>' +
    '</form>';

  LQ.openAdminDrawer('Add New Tenses Question', formHtml);
};

LQ.renderEditTenseContentForm = async function (id) {
  try {
    // Load tense groups
    var tenseGroups = [];
    try {
      var respG = await fetch('/api/admin/tenses', { credentials: 'include' });
      var dataG = await respG.json();
      if (dataG.ok) tenseGroups = dataG.groups || [];
    } catch (e) {}

    // Load active record
    var respRec = await fetch('/api/admin/tense-contents', { credentials: 'include' });
    var dataRec = await respRec.json();
    var record = (dataRec.items || []).find(r => r._id === id);
    if (!record) {
      LQ.toast('Record not found.');
      return;
    }

    var tenseGroupOptions = '<option value="">-- Choose Tense Group --</option>';
    tenseGroups.forEach(function (tg) {
      tenseGroupOptions += '<option value="' + tg.name + '"' + (record.group === tg.name ? ' selected' : '') + '>' + LQ.esc(tg.displayName || tg.name) + '</option>';
    });

    var formHtml =
      '<form id="edit-tense-content-form" class="admin-form" onsubmit="LQ._submitTenseContent(event, \'' + id + '\')">' +
        '<div class="admin-form-grid">' +
          '<div class="admin-form-field">' +
            '<label>Tenses Group <span class="req">*</span></label>' +
            '<select id="tense-content-group" required>' +
              tenseGroupOptions +
            '</select>' +
          '</div>' +
          '<div class="admin-form-field">' +
            '<label>Category <span class="req">*</span></label>' +
            '<select id="tense-content-category" required>' +
              '<option value="reading"' + (record.category === 'reading' ? ' selected' : '') + '>Reading</option>' +
              '<option value="speaking"' + (record.category === 'speaking' ? ' selected' : '') + '>Speaking</option>' +
              '<option value="writing"' + (record.category === 'writing' ? ' selected' : '') + '>Writing</option>' +
              '<option value="grammar"' + (record.category === 'grammar' ? ' selected' : '') + '>Grammar</option>' +
            '</select>' +
          '</div>' +
          '<div class="admin-form-field" style="grid-column:1/-1">' +
            '<label>Title / Topic <span class="req">*</span></label>' +
            '<input type="text" id="tense-content-title" required value="' + LQ.esc(record.title || record.text || record.topic) + '" placeholder="e.g. A Rainy Morning, or Topic prompt" />' +
          '</div>' +
          '<div class="admin-form-field" style="grid-column:1/-1">' +
            '<label>Body Text / Passage / Story</label>' +
            '<textarea id="tense-content-story" rows="4" placeholder="Optional story, passage, or sentence text...">' + LQ.esc(record.story || record.text) + '</textarea>' +
          '</div>' +
        '</div>' +

        '<p id="tense-content-error" class="admin-error-msg" style="display:none"></p>' +
        '<div class="admin-form-actions" style="margin-top:20px">' +
          '<button type="button" class="admin-btn admin-btn-outline" onclick="LQ.closeAdminDrawer()">Cancel</button>' +
          '<button type="submit" class="admin-btn admin-btn-primary" id="tense-content-submit-btn">Update Question</button>' +
        '</div>' +
      '</form>';

    LQ.openAdminDrawer('Edit Tenses Question', formHtml);
  } catch (err) {
    LQ.toast('Failed to load edit form');
  }
};

LQ._submitTenseContent = async function (e, id) {
  e.preventDefault();
  var group = document.getElementById('tense-content-group').value;
  var category = document.getElementById('tense-content-category').value;
  var title = document.getElementById('tense-content-title').value.trim();
  var story = document.getElementById('tense-content-story').value.trim();
  var btn = document.getElementById('tense-content-submit-btn');
  var errEl = document.getElementById('tense-content-error');

  if (!group || !title) return;

  var payload = {
    group: group,
    category: category,
    title: title,
    text: story || title,
    story: story,
    topic: title
  };

  if (errEl) errEl.style.display = 'none';
  if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }

  var url = id ? '/api/admin/tense-contents/' + id : '/api/admin/tense-contents';
  var method = id ? 'PUT' : 'POST';

  try {
    var resp = await fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload)
    });
    var data = await resp.json();

    if (resp.ok) {
      LQ.toast(id ? 'Question updated!' : 'Question created!');
      LQ.closeAdminDrawer();
      LQ._loadTensesQuestions();
    } else {
      if (errEl) { errEl.textContent = data.error || 'Failed to save question.'; errEl.style.display = 'block'; }
    }
  } catch (err) {
    if (errEl) { errEl.textContent = 'Network error. Please try again.'; errEl.style.display = 'block'; }
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = id ? 'Update Question' : 'Save Question'; }
  }
};

LQ._deleteTenseContent = function (id) {
  LQ.showConfirmModal({
    title: 'Delete Question',
    message: 'Are you sure you want to delete this question? This action cannot be undone.',
    icon: '🗑️',
    danger: true,
    okText: 'Delete',
    onConfirm: async function () {
      try {
        var resp = await fetch('/api/admin/tense-contents/' + id, {
          method: 'DELETE',
          credentials: 'include'
        });
        var data = await resp.json();
        if (resp.ok) {
          LQ.toast('Question deleted.');
          LQ._loadTensesQuestions();
        } else {
          LQ.toast(data.error || 'Failed to delete');
        }
      } catch (e) {
        LQ.toast('Failed to delete question');
      }
    }
  });
};

LQ.renderQuestionBulkUploadForm = function () {
  var formHtml =
    '<div class="admin-bulk-info" style="margin-bottom:16px">' +
      '<p style="margin:0 0 10px; font-size:13px; color:#64748b">Select the type of questions you want to upload, download the correct template, prepare your spreadsheet, and upload it.</p>' +
      '<div class="admin-form-field" style="margin-bottom:12px">' +
        '<label>Question Template Type</label>' +
        '<select id="bulk-question-template-type" onchange="LQ._onBulkTemplateTypeChange(this.value)" style="width:100%">' +
          '<option value="mcq">Multiple Choice Question (MCQ)</option>' +
          '<option value="fib">Fill in the Blanks (FIB)</option>' +
          '<option value="speech">Speech-based (Listen/Repeat/Jumbled/Story)</option>' +
        '</select>' +
      '</div>' +
      '<div style="background:#f1f5f9; padding:12px; border-radius:8px; margin-bottom:12px">' +
        '<a id="bulk-template-download-link" href="/api/admin/questions/bulk/template?type=mcq" download style="color:#2563eb; text-decoration:none; font-weight:700; font-size:13px; display:inline-flex; align-items:center; gap:6px">📥 Download MCQ Template (.csv)</a>' +
        '<div id="bulk-template-columns-desc" style="font-size:11px; color:#64748b; margin-top:8px; line-height:1.4">' +
          '<strong>Expected Columns:</strong> questionText, category, tenseGroup, wordList, difficulty, marks, mcqType, optionA, optionB, optionC, optionD, optionE, optionF, correctAnswer, explanation' +
        '</div>' +
      '</div>' +
    '</div>' +
    '<form id="bulk-question-form" class="admin-form" onsubmit="LQ._submitQuestionsBulkUpload(event)">' +
      '<div class="admin-file-drop" id="question-file-drop" onclick="document.getElementById(\'question-file-input\').click()">' +
        '<input type="file" id="question-file-input" accept=".xlsx,.xls,.csv" style="display:none" onchange="LQ._onBulkFileSelected(this)" />' +
        '<p class="admin-file-drop-text" id="question-file-text">📁 Click to select or drag & drop your Excel/CSV file</p>' +
      '</div>' +
      '<p id="bulk-upload-error" class="admin-error-msg" style="display:none"></p>' +
      '<div class="admin-form-actions" style="margin-top:20px">' +
        '<button type="button" class="admin-btn admin-btn-outline" onclick="LQ.closeAdminDrawer()">Cancel</button>' +
        '<button type="submit" class="admin-btn admin-btn-primary" id="btn-submit-bulk-questions">Upload Questions</button>' +
      '</div>' +
      '<div id="bulk-upload-results-wrap" style="margin-top:20px"></div>' +
    '</form>';

  LQ.openAdminDrawer('📤 Bulk Upload Questions', formHtml);
  
  setTimeout(function() {
    var dropZone = document.getElementById('question-file-drop');
    var fileInput = document.getElementById('question-file-input');
    if (!dropZone || !fileInput) return;
    
    dropZone.addEventListener('dragover', function(e) {
      e.preventDefault();
      dropZone.style.borderColor = '#2563eb';
      dropZone.style.background = '#eff6ff';
    });
    
    dropZone.addEventListener('dragleave', function(e) {
      e.preventDefault();
      dropZone.style.borderColor = '#cbd5e1';
      dropZone.style.background = '';
    });
    
    dropZone.addEventListener('drop', function(e) {
      e.preventDefault();
      dropZone.style.borderColor = '#cbd5e1';
      dropZone.style.background = '';
      if (e.dataTransfer.files && e.dataTransfer.files.length) {
        fileInput.files = e.dataTransfer.files;
        LQ._onBulkFileSelected(fileInput);
      }
    });
  }, 100);
};

LQ._onBulkTemplateTypeChange = function (val) {
  var link = document.getElementById('bulk-template-download-link');
  var desc = document.getElementById('bulk-template-columns-desc');
  if (!link || !desc) return;

  link.href = '/api/admin/questions/bulk/template?type=' + val;
  if (val === 'mcq') {
    link.textContent = '📥 Download MCQ Template (.csv)';
    desc.innerHTML = '<strong>Expected Columns:</strong> questionText, category, tenseGroup, wordList, difficulty, marks, mcqType, optionA, optionB, optionC, optionD, optionE, optionF, correctAnswer, explanation';
  } else if (val === 'fib') {
    link.textContent = '📥 Download FIB Template (.csv)';
    desc.innerHTML = '<strong>Expected Columns:</strong> questionText, category, tenseGroup, wordList, difficulty, marks, correctAnswers, explanation';
  } else if (val === 'speech') {
    link.textContent = '📥 Download Speech Template (.csv)';
    desc.innerHTML = '<strong>Expected Columns:</strong> type (reading_listening, listen_repeat, jumbled_sentence, story_retelling), questionText, category, tenseGroup, wordList, difficulty, marks, playLimit, explanation';
  }
};

LQ._onBulkFileSelected = function (input) {
  var textEl = document.getElementById('question-file-text');
  if (!textEl) return;
  if (input.files && input.files[0]) {
    textEl.innerHTML = '📄 <strong>Selected file:</strong> ' + LQ.esc(input.files[0].name);
  } else {
    textEl.innerHTML = '📁 Click to select or drag & drop your Excel/CSV file';
  }
};

LQ._submitQuestionsBulkUpload = async function (e) {
  e.preventDefault();
  var fileInput = document.getElementById('question-file-input');
  var templateType = document.getElementById('bulk-question-template-type').value;
  var errEl = document.getElementById('bulk-upload-error');
  var resultsWrap = document.getElementById('bulk-upload-results-wrap');
  var btn = document.getElementById('btn-submit-bulk-questions');

  if (errEl) errEl.style.display = 'none';
  if (resultsWrap) resultsWrap.innerHTML = '';

  if (!fileInput || !fileInput.files || !fileInput.files[0]) {
    if (errEl) { errEl.textContent = 'Please select a file to upload.'; errEl.style.display = 'block'; }
    return;
  }

  var formData = new FormData();
  formData.append('file', fileInput.files[0]);
  formData.append('type', templateType);

  if (btn) { btn.disabled = true; btn.textContent = 'Uploading...'; }

  try {
    var resp = await fetch('/api/admin/questions/bulk', {
      method: 'POST',
      credentials: 'include',
      body: formData
    });
    var data = await resp.json();

    if (!resp.ok) {
      if (errEl) { errEl.textContent = data.error || 'Failed to upload questions.'; errEl.style.display = 'block'; }
      return;
    }

    var resultsHtml = 
      '<div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:8px; padding:12px; margin-bottom:12px; color:#166534; font-size:13px">' +
        '✅ <strong>Upload Summary:</strong> Successfully saved <strong>' + data.savedCount + '</strong> questions.' +
      '</div>';

    if (data.failedCount > 0) {
      resultsHtml += 
        '<div style="background:#fef2f2; border:1px solid #fecaca; border-radius:8px; padding:12px; margin-bottom:12px; color:#991b1b; font-size:13px">' +
          '⚠️ <strong>Warning:</strong> <strong>' + data.failedCount + '</strong> rows failed to upload. Review the errors below, fix your template, and upload again.' +
        '</div>';

      var failedRowsHtml = 
        '<div class="admin-table-responsive" style="max-height:250px; overflow-y:auto; border:1px solid #e2e8f0; border-radius:8px">' +
          '<table class="admin-table" style="font-size:12px">' +
            '<thead><tr><th>Row #</th><th>Question Text</th><th>Reason/Comment</th></tr></thead>' +
            '<tbody>';
      
      data.failed.forEach(function(row, idx) {
        var rowNum = idx + 1;
        var textTrunc = (row.questionText || '').toString();
        if (textTrunc.length > 30) textTrunc = textTrunc.substring(0, 27) + '...';
        failedRowsHtml += 
          '<tr>' +
            '<td>' + rowNum + '</td>' +
            '<td>' + LQ.esc(textTrunc) + '</td>' +
            '<td style="color:#dc2626; font-weight:600">' + LQ.esc(row.failedComment || 'Unknown validation error') + '</td>' +
          '</tr>';
      });

      failedRowsHtml += '</tbody></table></div>';
      resultsHtml += failedRowsHtml;
    }

    if (resultsWrap) resultsWrap.innerHTML = resultsHtml;
    LQ.toast('Bulk upload processed!');
    if (LQ._loadQuestions) LQ._loadQuestions();

  } catch (err) {
    if (errEl) { errEl.textContent = 'Network error. Please try again.'; errEl.style.display = 'block'; }
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Upload Questions'; }
  }
};

/* ══════════════════════════════════════════════════
   WORDS MANAGEMENT PAGE (admin only)
   ══════════════════════════════════════════════════ */

LQ.renderAdminWordsPage = async function () {
  var wrap = document.getElementById('admin-words-wrap');
  if (!wrap) return;

  wrap.innerHTML =
    '<div class="admin-page-header">' +
      '<h2 class="admin-page-title">📝 Words Database</h2>' +
      '<div class="admin-header-actions">' +
        '<button type="button" class="admin-btn admin-btn-outline" style="margin-right:8px" onclick="LQ.renderWordsBulkUploadForm()">📤 Bulk Upload</button>' +
        '<button type="button" class="admin-btn admin-btn-primary" onclick="LQ.renderAddWordForm()">+ Add Word</button>' +
      '</div>' +
    '</div>' +
    '<div class="admin-search-bar" style="margin-bottom:16px">' +
      '<input type="text" id="admin-words-search-input" class="admin-search-input" placeholder="Search words, definitions, tags..." oninput="LQ._triggerWordsSearch(this.value)" />' +
    '</div>' +
    '<div id="admin-words-table-wrap" class="admin-table-wrap"><p class="admin-loading">Loading words...</p></div>' +
    '<div id="admin-words-pagination-wrap" class="admin-pagination-row" style="display:none;background:#fff;border-top:1px solid #e2e8f0;padding:12px 20px;flex-shrink:0;justify-content:space-between;align-items:center;"></div>';

  LQ._wordsSearchQuery = '';
  LQ._wordsPage = 1;
  LQ._loadAdminWords();
};

LQ._triggerWordsSearch = function (val) {
  LQ._wordsSearchQuery = val.trim();
  LQ._wordsPage = 1;
  if (LQ._wordsSearchTimeout) clearTimeout(LQ._wordsSearchTimeout);
  LQ._wordsSearchTimeout = setTimeout(function () {
    LQ._loadAdminWords();
  }, 300);
};

LQ._loadAdminWords = async function () {
  var tableWrap = document.getElementById('admin-words-table-wrap');
  if (!tableWrap) return;

  var pagWrap = document.getElementById('admin-words-pagination-wrap');
  if (pagWrap) pagWrap.style.display = 'none';

  try {
    if (!LQ._wordsPage) LQ._wordsPage = 1;
    var url = '/api/admin/words?page=' + LQ._wordsPage + '&limit=25&q=' + encodeURIComponent(LQ._wordsSearchQuery || '');
    var resp = await fetch(url, { credentials: 'include' });
    var data = await resp.json();

    if (!resp.ok) {
      tableWrap.innerHTML = '<p class="admin-error">' + LQ.esc(data.error || 'Failed to load') + '</p>';
      return;
    }

    var items = data.items || [];

    if (!items.length) {
      tableWrap.innerHTML =
        '<div style="text-align:center;padding:40px 20px">' +
          '<div style="font-size:36px;margin-bottom:12px">📝</div>' +
          '<h3 style="margin:0 0 6px;color:#0f172a;font-size:16px;font-weight:600">No words found</h3>' +
          '<p style="margin:0;color:#64748b;font-size:13px">Add a word or clear search query to view database.</p>' +
        '</div>';
      return;
    }

    var html = '<div class="admin-table-responsive"><table class="admin-table">' +
      '<thead><tr>' +
        '<th>#</th><th>Word</th><th>POS</th><th>Definition</th><th>Premium</th><th>Actions</th>' +
      '</tr></thead><tbody>';

    items.forEach(function (item, idx) {
      var startIdx = (data.page - 1) * 25 + idx + 1;
      html +=
        '<tr>' +
          '<td>' + startIdx + '</td>' +
          '<td><strong>' + LQ.esc(item.word) + '</strong>' + (item.phonetic ? ' <small style="color:#64748b">' + LQ.esc(item.phonetic) + '</small>' : '') + '</td>' +
          '<td><code>' + LQ.esc(item.pos || 'noun') + '</code></td>' +
          '<td>' + LQ.esc(item.def || '—') + '</td>' +
          '<td>' + (item.premium ? '⭐ Premium' : 'Free') + '</td>' +
          '<td>' +
            '<button class="admin-btn admin-btn-outline admin-btn-sm" style="margin-right:6px" onclick="LQ.renderEditWordForm(\'' + item._id + '\')">Edit</button>' +
            '<button class="admin-btn admin-btn-danger admin-btn-sm" onclick="LQ._deleteAdminWord(\'' + item._id + '\')">Delete</button>' +
          '</td>' +
        '</tr>';
    });

    html += '</tbody></table></div>';
    tableWrap.innerHTML = html;

    if (pagWrap) {
      if (data.pages > 1) {
        var pagHtml = '<span class="admin-pagination-info" style="font-size:13px;color:#64748b">Showing page ' + data.page + ' of ' + data.pages + ' (' + data.total + ' total)</span>' +
          '<div style="display:flex;gap:6px">';
        
        if (data.page > 1) {
          pagHtml += '<button class="admin-page-btn" onclick="LQ._wordsPage=' + (data.page - 1) + ';LQ._loadAdminWords()">← Prev</button>';
        }
        
        for (var i = 1; i <= data.pages; i++) {
          if (i === data.page) {
            pagHtml += '<button class="admin-page-btn active" style="background:#2563eb;color:#fff;border-color:#2563eb" disabled>' + i + '</button>';
          } else {
            if (i === 1 || i === data.pages || Math.abs(i - data.page) <= 2) {
              pagHtml += '<button class="admin-page-btn" onclick="LQ._wordsPage=' + i + ';LQ._loadAdminWords()">' + i + '</button>';
            } else if (i === 2 || i === data.pages - 1) {
              pagHtml += '<span style="color:#94a3b8;padding:4px">...</span>';
            }
          }
        }
        
        if (data.page < data.pages) {
          pagHtml += '<button class="admin-page-btn" onclick="LQ._wordsPage=' + (data.page + 1) + ';LQ._loadAdminWords()">Next →</button>';
        }
        
        pagHtml += '</div>';
        pagWrap.innerHTML = pagHtml;
        pagWrap.style.display = 'flex';
      } else {
        pagWrap.style.display = 'none';
      }
    }
  } catch (err) {
    tableWrap.innerHTML = '<p class="admin-error">Failed to load words database.</p>';
  }
};

LQ.renderAddWordForm = function () {
  var formHtml =
    '<form id="add-word-form" class="admin-form" onsubmit="LQ._submitWord(event)">' +
      '<div class="admin-form-grid">' +
        '<div class="admin-form-field">' +
          '<label>Word <span class="req">*</span></label>' +
          '<input type="text" id="word-text" required placeholder="e.g. Ephemeral" />' +
        '</div>' +
        '<div class="admin-form-field">' +
          '<label>Phonetic</label>' +
          '<input type="text" id="word-phonetic" placeholder="e.g. /ɪˈfem.ər.əl/" />' +
        '</div>' +
        '<div class="admin-form-field">' +
          '<label>Part of Speech (POS)</label>' +
          '<select id="word-pos">' +
            '<option value="noun">Noun</option>' +
            '<option value="verb">Verb</option>' +
            '<option value="adjective">Adjective</option>' +
            '<option value="adverb">Adverb</option>' +
          '</select>' +
        '</div>' +
        '<div class="admin-form-field">' +
          '<label>Tags (Comma separated)</label>' +
          '<input type="text" id="word-tags" placeholder="e.g. GRE, IELTS, Advanced" />' +
        '</div>' +
        '<div class="admin-form-field" style="grid-column:1/-1">' +
          '<label>Definition / Meaning <span class="req">*</span></label>' +
          '<textarea id="word-def" rows="3" required placeholder="Enter word meaning..."></textarea>' +
        '</div>' +
        '<div class="admin-form-field" style="grid-column:1/-1">' +
          '<label>Example Sentence</label>' +
          '<textarea id="word-example" rows="2" placeholder="e.g. The morning dew is ephemeral..."></textarea>' +
        '</div>' +
        '<div class="admin-form-field">' +
          '<label>Synonyms</label>' +
          '<input type="text" id="word-syn" placeholder="e.g. Fleeting, transient" />' +
        '</div>' +
        '<div class="admin-form-field">' +
          '<label>Antonyms</label>' +
          '<input type="text" id="word-ant" placeholder="e.g. Eternal, permanent" />' +
        '</div>' +
        '<div class="admin-form-field" style="flex-direction:row;align-items:center;gap:10px">' +
          '<input type="checkbox" id="word-premium" style="width:auto;margin:0" />' +
          '<label for="word-premium" style="margin:0">Premium Content</label>' +
        '</div>' +
      '</div>' +
      '<p id="word-form-error" class="admin-error-msg" style="display:none"></p>' +
      '<div class="admin-form-actions" style="margin-top:20px">' +
        '<button type="button" class="admin-btn admin-btn-outline" onclick="LQ.closeAdminDrawer()">Cancel</button>' +
        '<button type="submit" class="admin-btn admin-btn-primary" id="word-submit-btn">Save Word</button>' +
      '</div>' +
    '</form>';

  LQ.openAdminDrawer('Add New Word', formHtml);
};

LQ.renderEditWordForm = async function (id) {
  try {
    var resp = await fetch('/api/admin/words?page=' + LQ._wordsPage + '&limit=10&q=' + encodeURIComponent(LQ._wordsSearchQuery || ''), { credentials: 'include' });
    var data = await resp.json();
    var record = (data.items || []).find(w => w._id === id);
    if (!record) {
      LQ.toast('Loading word details failed.');
      return;
    }

    var formHtml =
      '<form id="edit-word-form" class="admin-form" onsubmit="LQ._submitWord(event, \'' + id + '\')">' +
        '<div class="admin-form-grid">' +
          '<div class="admin-form-field">' +
            '<label>Word <span class="req">*</span></label>' +
            '<input type="text" id="word-text" required value="' + LQ.esc(record.word) + '" />' +
          '</div>' +
          '<div class="admin-form-field">' +
            '<label>Phonetic</label>' +
            '<input type="text" id="word-phonetic" value="' + LQ.esc(record.phonetic || '') + '" />' +
          '</div>' +
          '<div class="admin-form-field">' +
            '<label>Part of Speech (POS)</label>' +
            '<select id="word-pos">' +
              '<option value="noun"' + (record.pos === 'noun' ? ' selected' : '') + '>Noun</option>' +
              '<option value="verb"' + (record.pos === 'verb' ? ' selected' : '') + '>Verb</option>' +
              '<option value="adjective"' + (record.pos === 'adjective' ? ' selected' : '') + '>Adjective</option>' +
              '<option value="adverb"' + (record.pos === 'adverb' ? ' selected' : '') + '>Adverb</option>' +
            '</select>' +
          '</div>' +
          '<div class="admin-form-field">' +
            '<label>Tags (Comma separated)</label>' +
            '<input type="text" id="word-tags" value="' + LQ.esc((record.tags || []).join(', ')) + '" />' +
          '</div>' +
          '<div class="admin-form-field" style="grid-column:1/-1">' +
            '<label>Definition / Meaning <span class="req">*</span></label>' +
            '<textarea id="word-def" rows="3" required>' + LQ.esc(record.def || '') + '</textarea>' +
          '</div>' +
          '<div class="admin-form-field" style="grid-column:1/-1">' +
            '<label>Example Sentence</label>' +
            '<textarea id="word-example" rows="2">' + LQ.esc(record.example || '') + '</textarea>' +
          '</div>' +
          '<div class="admin-form-field">' +
            '<label>Synonyms</label>' +
            '<input type="text" id="word-syn" value="' + LQ.esc(record.syn || '') + '" />' +
          '</div>' +
          '<div class="admin-form-field">' +
            '<label>Antonyms</label>' +
            '<input type="text" id="word-ant" value="' + LQ.esc(record.ant || '') + '" />' +
          '</div>' +
          '<div class="admin-form-field" style="flex-direction:row;align-items:center;gap:10px">' +
            '<input type="checkbox" id="word-premium" style="width:auto;margin:0"' + (record.premium ? ' checked' : '') + ' />' +
            '<label for="word-premium" style="margin:0">Premium Content</label>' +
          '</div>' +
        '</div>' +
        '<p id="word-form-error" class="admin-error-msg" style="display:none"></p>' +
        '<div class="admin-form-actions" style="margin-top:20px">' +
          '<button type="button" class="admin-btn admin-btn-outline" onclick="LQ.closeAdminDrawer()">Cancel</button>' +
          '<button type="submit" class="admin-btn admin-btn-primary" id="word-submit-btn">Update Word</button>' +
        '</div>' +
      '</form>';

    LQ.openAdminDrawer('Edit Word', formHtml);
  } catch (err) {
    LQ.toast('Failed to load edit form');
  }
};

LQ._submitWord = async function (e, id) {
  e.preventDefault();
  var word = document.getElementById('word-text').value.trim();
  var phonetic = document.getElementById('word-phonetic').value.trim();
  var pos = document.getElementById('word-pos').value;
  var tagsVal = document.getElementById('word-tags').value;
  var def = document.getElementById('word-def').value.trim();
  var example = document.getElementById('word-example').value.trim();
  var syn = document.getElementById('word-syn').value.trim();
  var ant = document.getElementById('word-ant').value.trim();
  var premium = document.getElementById('word-premium').checked;
  var btn = document.getElementById('word-submit-btn');
  var errEl = document.getElementById('word-form-error');

  var tags = tagsVal.split(',').map(s => s.trim()).filter(Boolean);

  var payload = {
    word: word,
    phonetic: phonetic,
    pos: pos,
    tags: tags,
    def: def,
    example: example,
    syn: syn,
    ant: ant,
    premium: premium
  };

  if (errEl) errEl.style.display = 'none';
  if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }

  var url = id ? '/api/admin/words/' + id : '/api/admin/words';
  var method = id ? 'PUT' : 'POST';

  try {
    var resp = await fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload)
    });
    var data = await resp.json();

    if (resp.ok) {
      LQ.toast(id ? 'Word updated!' : 'Word created!');
      LQ.closeAdminDrawer();
      LQ._loadAdminWords();
    } else {
      if (errEl) { errEl.textContent = data.error || 'Failed to save word.'; errEl.style.display = 'block'; }
    }
  } catch (err) {
    if (errEl) { errEl.textContent = 'Network error. Please try again.'; errEl.style.display = 'block'; }
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = id ? 'Update Word' : 'Save Word'; }
  }
};

LQ._deleteAdminWord = function (id) {
  LQ.showConfirmModal({
    title: 'Delete Word',
    message: 'Are you sure you want to delete this word from database? This action cannot be undone.',
    icon: '🗑️',
    danger: true,
    okText: 'Delete',
    onConfirm: async function () {
      try {
        var resp = await fetch('/api/admin/words/' + id, {
          method: 'DELETE',
          credentials: 'include'
        });
        var data = await resp.json();
        if (resp.ok) {
          LQ.toast('Word deleted.');
          LQ._loadAdminWords();
        } else {
          LQ.toast(data.error || 'Failed to delete');
        }
      } catch (e) {
        LQ.toast('Failed to delete word');
      }
    }
  });
};

/* ══════════════════════════════════════════════════
   WORD LISTS MANAGEMENT PAGE (admin only)
   ══════════════════════════════════════════════════ */

LQ.renderAdminWordListsPage = async function () {
  var wrap = document.getElementById('admin-word-lists-wrap');
  if (!wrap) return;

  wrap.innerHTML =
    '<div class="admin-page-header">' +
      '<h2 class="admin-page-title">📋 Word Lists</h2>' +
      '<div class="admin-header-actions">' +
        '<button type="button" class="admin-btn admin-btn-outline" style="margin-right:8px" onclick="LQ.renderListsSingleBulkUploadForm()">📤 Bulk Upload</button>' +
        '<button type="button" class="admin-btn admin-btn-primary" onclick="LQ.renderAddWordListForm()">+ Add List</button>' +
      '</div>' +
    '</div>' +
    '<div id="admin-word-lists-table-wrap" class="admin-table-wrap"><p class="admin-loading">Loading lists...</p></div>' +
    '<div id="admin-word-lists-pagination-wrap" class="admin-pagination-row" style="display:none;background:#fff;border-top:1px solid #e2e8f0;padding:12px 20px;flex-shrink:0;justify-content:space-between;align-items:center;"></div>';

  LQ._wordListsPage = 1;
  LQ._loadAdminWordLists();
};

LQ._loadAdminWordLists = async function () {
  var tableWrap = document.getElementById('admin-word-lists-table-wrap');
  if (!tableWrap) return;

  var pagWrap = document.getElementById('admin-word-lists-pagination-wrap');
  if (pagWrap) pagWrap.style.display = 'none';

  try {
    if (!LQ._wordListsPage) LQ._wordListsPage = 1;
    var resp = await fetch('/api/admin/word-lists?page=' + LQ._wordListsPage + '&limit=10', { credentials: 'include' });
    var data = await resp.json();

    if (!resp.ok) {
      tableWrap.innerHTML = '<p class="admin-error">' + LQ.esc(data.error || 'Failed to load') + '</p>';
      return;
    }

    var items = data.items || [];

    if (!items.length) {
      tableWrap.innerHTML =
        '<div style="text-align:center;padding:40px 20px">' +
          '<div style="font-size:36px;margin-bottom:12px">📋</div>' +
          '<h3 style="margin:0 0 6px;color:#0f172a;font-size:16px;font-weight:600">No word lists found</h3>' +
          '<p style="margin:0;color:#64748b;font-size:13px">Create a word list to get started.</p>' +
        '</div>';
      return;
    }

    var html = '<div class="admin-table-responsive"><table class="admin-table">' +
      '<thead><tr>' +
        '<th>#</th><th>List ID</th><th>Title</th><th>Icon</th><th>Color</th><th>Type</th><th>Actions</th>' +
      '</tr></thead><tbody>';

    items.forEach(function (item, idx) {
      var startIdx = (data.page - 1) * 10 + idx + 1;
      html +=
        '<tr>' +
          '<td>' + startIdx + '</td>' +
          '<td><code>' + LQ.esc(item.id) + '</code></td>' +
          '<td><strong>' + LQ.esc(item.title) + '</strong></td>' +
          '<td>' + LQ.esc(item.icon || '—') + '</td>' +
          '<td><span class="admin-capitalize">' + LQ.esc(item.color || '—') + '</span></td>' +
          '<td><span class="admin-capitalize">' + LQ.esc(item.listType || 'grouped') + '</span></td>' +
          '<td>' +
            (item.listType === 'grouped' ? '<button class="admin-btn admin-btn-outline admin-btn-sm" style="margin-right:6px" onclick="LQ.renderManageWordListGroups(\'' + LQ.esc(item.id) + '\')">🗂️ Groups</button>' : '') +
            '<button class="admin-btn admin-btn-outline admin-btn-sm" style="margin-right:6px" onclick="LQ.renderEditWordListForm(\'' + item._id + '\')">Edit</button>' +
            '<button class="admin-btn admin-btn-danger admin-btn-sm" onclick="LQ._deleteAdminWordList(\'' + item._id + '\')">Delete</button>' +
          '</td>' +
        '</tr>';
    });

    html += '</tbody></table></div>';
    tableWrap.innerHTML = html;

    if (pagWrap) {
      if (data.pages > 1) {
        var pagHtml = '<span class="admin-pagination-info" style="font-size:13px;color:#64748b">Showing page ' + data.page + ' of ' + data.pages + ' (' + data.total + ' total)</span>' +
          '<div style="display:flex;gap:6px">';
        
        if (data.page > 1) {
          pagHtml += '<button class="admin-page-btn" onclick="LQ._wordListsPage=' + (data.page - 1) + ';LQ._loadAdminWordLists()">← Prev</button>';
        }
        
        for (var i = 1; i <= data.pages; i++) {
          if (i === data.page) {
            pagHtml += '<button class="admin-page-btn active" style="background:#2563eb;color:#fff;border-color:#2563eb" disabled>' + i + '</button>';
          } else {
            if (i === 1 || i === data.pages || Math.abs(i - data.page) <= 2) {
              pagHtml += '<button class="admin-page-btn" onclick="LQ._wordListsPage=' + i + ';LQ._loadAdminWordLists()">' + i + '</button>';
            } else if (i === 2 || i === data.pages - 1) {
              pagHtml += '<span style="color:#94a3b8;padding:4px">...</span>';
            }
          }
        }
        
        if (data.page < data.pages) {
          pagHtml += '<button class="admin-page-btn" onclick="LQ._wordListsPage=' + (data.page + 1) + ';LQ._loadAdminWordLists()">Next →</button>';
        }
        
        pagHtml += '</div>';
        pagWrap.innerHTML = pagHtml;
        pagWrap.style.display = 'flex';
      } else {
        pagWrap.style.display = 'none';
      }
    }
  } catch (err) {
    tableWrap.innerHTML = '<p class="admin-error">Failed to load word lists.</p>';
  }
};

LQ.renderAddWordListForm = function () {
  var formHtml =
    '<form id="add-word-list-form" class="admin-form" onsubmit="LQ._submitWordList(event)">' +
      '<div class="admin-form-grid">' +
        '<div class="admin-form-field">' +
          '<label>List ID <span class="req">*</span></label>' +
          '<input type="text" id="list-id" required placeholder="e.g. list-1" />' +
        '</div>' +
        '<div class="admin-form-field">' +
          '<label>Title <span class="req">*</span></label>' +
          '<input type="text" id="list-title" required placeholder="e.g. List 1" />' +
        '</div>' +
        '<div class="admin-form-field">' +
          '<label>List Number (Sorting)</label>' +
          '<input type="number" id="list-num" value="0" />' +
        '</div>' +
        '<div class="admin-form-field">' +
          '<label>Icon</label>' +
          '<input type="text" id="list-icon" placeholder="e.g. 📘" value="📘" />' +
        '</div>' +
        '<div class="admin-form-field">' +
          '<label>Color Theme</label>' +
          '<input type="text" id="list-color" placeholder="e.g. lavender" value="lavender" />' +
        '</div>' +
        '<div class="admin-form-field">' +
          '<label>List Type</label>' +
          '<select id="list-type">' +
            '<option value="grouped">Grouped (Synonyms)</option>' +
            '<option value="dictionary">Dictionary (A-Z)</option>' +
          '</select>' +
        '</div>' +
      '</div>' +
      '<p id="list-form-error" class="admin-error-msg" style="display:none"></p>' +
      '<div class="admin-form-actions" style="margin-top:20px">' +
        '<button type="button" class="admin-btn admin-btn-outline" onclick="LQ.closeAdminDrawer()">Cancel</button>' +
        '<button type="submit" class="admin-btn admin-btn-primary" id="list-submit-btn">Save List</button>' +
      '</div>' +
    '</form>';

  LQ.openAdminDrawer('Add New Word List', formHtml);
};

LQ.renderEditWordListForm = async function (id) {
  try {
    var resp = await fetch('/api/admin/word-lists?page=' + LQ._wordListsPage + '&limit=10', { credentials: 'include' });
    var data = await resp.json();
    var record = (data.items || []).find(l => l._id === id);
    if (!record) {
      LQ.toast('Word list details not found.');
      return;
    }

    var formHtml =
      '<form id="edit-word-list-form" class="admin-form" onsubmit="LQ._submitWordList(event, \'' + id + '\')">' +
        '<div class="admin-form-grid">' +
          '<div class="admin-form-field">' +
            '<label>List ID <span class="req">*</span></label>' +
            '<input type="text" id="list-id" required value="' + LQ.esc(record.id) + '" disabled />' +
          '</div>' +
          '<div class="admin-form-field">' +
            '<label>Title <span class="req">*</span></label>' +
            '<input type="text" id="list-title" required value="' + LQ.esc(record.title) + '" />' +
          '</div>' +
          '<div class="admin-form-field">' +
            '<label>List Number (Sorting)</label>' +
            '<input type="number" id="list-num" value="' + (record.listNum || 0) + '" />' +
          '</div>' +
          '<div class="admin-form-field">' +
            '<label>Icon</label>' +
            '<input type="text" id="list-icon" value="' + LQ.esc(record.icon || '📘') + '" />' +
          '</div>' +
          '<div class="admin-form-field">' +
            '<label>Color Theme</label>' +
            '<input type="text" id="list-color" value="' + LQ.esc(record.color || 'lavender') + '" />' +
          '</div>' +
          '<div class="admin-form-field">' +
            '<label>List Type</label>' +
            '<select id="list-type">' +
              '<option value="grouped"' + (record.listType === 'grouped' ? ' selected' : '') + '>Grouped (Synonyms)</option>' +
              '<option value="dictionary"' + (record.listType === 'dictionary' ? ' selected' : '') + '>Dictionary (A-Z)</option>' +
            '</select>' +
          '</div>' +
        '</div>' +
        '<p id="list-form-error" class="admin-error-msg" style="display:none"></p>' +
        '<div class="admin-form-actions" style="margin-top:20px">' +
          '<button type="button" class="admin-btn admin-btn-outline" onclick="LQ.closeAdminDrawer()">Cancel</button>' +
          '<button type="submit" class="admin-btn admin-btn-primary" id="list-submit-btn">Update List</button>' +
        '</div>' +
      '</form>';

    LQ.openAdminDrawer('Edit Word List', formHtml);
  } catch (err) {
    LQ.toast('Failed to load edit form');
  }
};

LQ._submitWordList = async function (e, id) {
  e.preventDefault();
  var listId = document.getElementById('list-id').value.trim();
  var title = document.getElementById('list-title').value.trim();
  var listNum = parseInt(document.getElementById('list-num').value || '0', 10);
  var icon = document.getElementById('list-icon').value.trim();
  var color = document.getElementById('list-color').value.trim();
  var listType = document.getElementById('list-type').value;
  var btn = document.getElementById('list-submit-btn');
  var errEl = document.getElementById('list-form-error');

  var payload = {
    id: listId,
    title: title,
    listNum: listNum,
    icon: icon,
    color: color,
    listType: listType
  };

  if (errEl) errEl.style.display = 'none';
  if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }

  var url = id ? '/api/admin/word-lists/' + id : '/api/admin/word-lists';
  var method = id ? 'PUT' : 'POST';

  try {
    var resp = await fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload)
    });
    var data = await resp.json();

    if (resp.ok) {
      LQ.toast(id ? 'List updated!' : 'List created!');
      LQ.closeAdminDrawer();
      LQ._loadAdminWordLists();
    } else {
      if (errEl) { errEl.textContent = data.error || 'Failed to save list.'; errEl.style.display = 'block'; }
    }
  } catch (err) {
    if (errEl) { errEl.textContent = 'Network error. Please try again.'; errEl.style.display = 'block'; }
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = id ? 'Update List' : 'Save List'; }
  }
};

LQ._deleteAdminWordList = function (id) {
  LQ.showConfirmModal({
    title: 'Delete Word List',
    message: 'Are you sure you want to delete this word list? This action cannot be undone.',
    icon: '🗑️',
    danger: true,
    okText: 'Delete',
    onConfirm: async function () {
      try {
        var resp = await fetch('/api/admin/word-lists/' + id, {
          method: 'DELETE',
          credentials: 'include'
        });
        var data = await resp.json();
        if (resp.ok) {
          LQ.toast('Word list deleted.');
          LQ._loadAdminWordLists();
        } else {
          LQ.toast(data.error || 'Failed to delete');
        }
      } catch (e) {
        LQ.toast('Failed to delete word list');
      }
    }
  });
};

LQ.renderWordsBulkUploadForm = function () {
  var formHtml =
    '<div class="admin-bulk-info">' +
      '<p>Upload a CSV file (<code>Words.csv</code>) containing word database records.</p>' +
      '<p style="font-size:12px;color:#64748b;margin-top:6px">Columns: <code>word, phonetic, pos, def, example, syn, ant, tags, premium, stub</code></p>' +
      '<a href="/api/admin/templates/words" class="admin-btn admin-btn-outline admin-btn-sm" style="margin-top:10px;display:inline-block;text-decoration:none">📥 Download Template</a>' +
    '</div>' +
    '<form id="bulk-words-form" class="admin-form" onsubmit="LQ._submitWordsBulkUpload(event)">' +
      '<div class="admin-file-drop" id="words-file-drop" onclick="document.getElementById(\'words-file-input\').click()">' +
        '<input type="file" id="words-file-input" accept=".csv,text/csv" style="display:none" onchange="LQ._handleWordsFileSelect(event)" />' +
        '<p class="admin-file-drop-text" id="words-file-name-display">📁 Click to select Words.csv file</p>' +
      '</div>' +
      '<p id="words-bulk-error" class="admin-error-msg" style="display:none"></p>' +
      '<div class="admin-form-actions" style="margin-top:20px">' +
        '<button type="button" class="admin-btn admin-btn-outline" onclick="LQ.closeAdminDrawer()">Cancel</button>' +
        '<button type="submit" class="admin-btn admin-btn-primary" id="words-bulk-submit-btn">Upload & Save</button>' +
      '</div>' +
    '</form>';

  LQ._selectedWordsFileText = '';
  LQ.openAdminDrawer('📤 Bulk Upload Words', formHtml);
};

LQ._handleWordsFileSelect = function (e) {
  var file = e.target.files && e.target.files[0];
  if (!file) return;

  var display = document.getElementById('words-file-name-display');
  if (display) display.textContent = 'Selected: ' + file.name + ' (' + (file.size / 1024).toFixed(1) + ' KB)';

  var reader = new FileReader();
  reader.onload = function (evt) {
    LQ._selectedWordsFileText = evt.target.result;
  };
  reader.readAsText(file);
};

LQ._submitWordsBulkUpload = async function (e) {
  e.preventDefault();
  var btn = document.getElementById('words-bulk-submit-btn');
  var errEl = document.getElementById('words-bulk-error');

  if (!LQ._selectedWordsFileText) {
    if (errEl) { errEl.textContent = 'Please select a Words.csv file first.'; errEl.style.display = 'block'; }
    return;
  }

  if (errEl) errEl.style.display = 'none';
  if (btn) { btn.disabled = true; btn.textContent = 'Uploading...'; }

  var payload = {
    'Words.csv': LQ._selectedWordsFileText
  };

  try {
    var resp = await fetch('/api/admin/import/csv', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload)
    });
    var data = await resp.json();

    if (resp.ok) {
      LQ.toast('Import successful! Imported ' + data.wordCount + ' words.');
      LQ.closeAdminDrawer();
      LQ._loadAdminWords();
    } else {
      if (errEl) { errEl.textContent = data.error || 'Failed to import words.'; errEl.style.display = 'block'; }
    }
  } catch (err) {
    if (errEl) { errEl.textContent = 'Network error. Please try again.'; errEl.style.display = 'block'; }
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Upload & Save'; }
  }
};

LQ.renderListsBulkUploadForm = function () {
  var formHtml =
    '<div class="admin-bulk-info">' +
      '<p>Upload CSV configuration files to import word lists, synonym groups, and list members.</p>' +
      '<p style="font-size:12px;color:#64748b;margin-top:6px">Ensure the file names match exactly: <code>WordLists.csv</code>, <code>Groups.csv</code>, <code>GroupWords.csv</code>, or <code>DictionaryWords.csv</code>.</p>' +
      '<div style="margin-top:10px;display:flex;flex-wrap:wrap;gap:6px">' +
        '<a href="/api/admin/templates/word-lists" class="admin-btn admin-btn-outline admin-btn-sm" style="text-decoration:none">📥 WordLists Template</a>' +
        '<a href="/api/admin/templates/groups" class="admin-btn admin-btn-outline admin-btn-sm" style="text-decoration:none">📥 Groups Template</a>' +
        '<a href="/api/admin/templates/group-words" class="admin-btn admin-btn-outline admin-btn-sm" style="text-decoration:none">📥 GroupWords Template</a>' +
        '<a href="/api/admin/templates/dictionary-words" class="admin-btn admin-btn-outline admin-btn-sm" style="text-decoration:none">📥 DictionaryWords Template</a>' +
      '</div>' +
    '</div>' +
    '<form id="bulk-lists-form" class="admin-form" onsubmit="LQ._submitListsBulkUpload(event)">' +
      '<div style="display:flex;flex-direction:column;gap:12px;margin-bottom:16px">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px;border:1px dashed #cbd5e1;border-radius:8px">' +
          '<span style="font-size:13px;font-weight:600">WordLists.csv:</span>' +
          '<input type="file" accept=".csv,text/csv" onchange="LQ._handleListFileSelect(event, \'WordLists.csv\')" />' +
        '</div>' +
        '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px;border:1px dashed #cbd5e1;border-radius:8px">' +
          '<span style="font-size:13px;font-weight:600">Groups.csv:</span>' +
          '<input type="file" accept=".csv,text/csv" onchange="LQ._handleListFileSelect(event, \'Groups.csv\')" />' +
        '</div>' +
        '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px;border:1px dashed #cbd5e1;border-radius:8px">' +
          '<span style="font-size:13px;font-weight:600">GroupWords.csv:</span>' +
          '<input type="file" accept=".csv,text/csv" onchange="LQ._handleListFileSelect(event, \'GroupWords.csv\')" />' +
        '</div>' +
        '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px;border:1px dashed #cbd5e1;border-radius:8px">' +
          '<span style="font-size:13px;font-weight:600">DictionaryWords.csv:</span>' +
          '<input type="file" accept=".csv,text/csv" onchange="LQ._handleListFileSelect(event, \'DictionaryWords.csv\')" />' +
        '</div>' +
      '</div>' +
      '<p id="lists-bulk-error" class="admin-error-msg" style="display:none"></p>' +
      '<div class="admin-form-actions" style="margin-top:20px">' +
        '<button type="button" class="admin-btn admin-btn-outline" onclick="LQ.closeAdminDrawer()">Cancel</button>' +
        '<button type="submit" class="admin-btn admin-btn-primary" id="lists-bulk-submit-btn">Upload & Save</button>' +
      '</div>' +
    '</form>';

  LQ._selectedListFiles = {};
  LQ.openAdminDrawer('📤 Bulk Upload Word Lists', formHtml);
};

LQ._handleListFileSelect = function (e, key) {
  var file = e.target.files && e.target.files[0];
  if (!file) {
    delete LQ._selectedListFiles[key];
    return;
  }

  var reader = new FileReader();
  reader.onload = function (evt) {
    LQ._selectedListFiles[key] = evt.target.result;
  };
  reader.readAsText(file);
};

LQ._submitListsBulkUpload = async function (e) {
  e.preventDefault();
  var btn = document.getElementById('lists-bulk-submit-btn');
  var errEl = document.getElementById('lists-bulk-error');

  if (!Object.keys(LQ._selectedListFiles).length) {
    if (errEl) { errEl.textContent = 'Please select at least one CSV file to upload.'; errEl.style.display = 'block'; }
    return;
  }

  if (errEl) errEl.style.display = 'none';
  if (btn) { btn.disabled = true; btn.textContent = 'Uploading...'; }

  try {
    var resp = await fetch('/api/admin/import/csv', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(LQ._selectedListFiles)
    });
    var data = await resp.json();

    if (resp.ok) {
      LQ.toast('Import successful! Imported ' + data.listCount + ' lists.');
      LQ.closeAdminDrawer();
      LQ._loadAdminWordLists();
    } else {
      if (errEl) { errEl.textContent = data.error || 'Failed to import word lists.'; errEl.style.display = 'block'; }
    }
  } catch (err) {
    if (errEl) { errEl.textContent = 'Network error. Please try again.'; errEl.style.display = 'block'; }
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Upload & Save'; }
  }
};

/* ══════════════════════════════════════════════════
   DICTIONARY MANAGEMENT PAGE (admin only)
   ══════════════════════════════════════════════════ */

LQ.renderAdminDictionaryPage = async function () {
  var wrap = document.getElementById('admin-dictionary-wrap');
  if (!wrap) return;

  wrap.innerHTML =
    '<div class="admin-page-header">' +
      '<h2 class="admin-page-title">📖 Dictionary</h2>' +
      '<div class="admin-header-actions">' +
        '<button type="button" class="admin-btn admin-btn-outline" style="margin-right:8px" onclick="LQ.renderDictBulkUploadForm()">📤 Bulk Upload</button>' +
      '</div>' +
    '</div>' +
    '<div id="admin-dict-controls" style="display:flex;gap:12px;align-items:center;margin-bottom:16px;flex-wrap:wrap">' +
      '<select id="admin-dict-list-select" class="admin-search-input" style="max-width:260px" onchange="LQ._dictPage=1;LQ._loadDictWords()">' +
        '<option value="">Loading lists...</option>' +
      '</select>' +
      '<input type="text" id="admin-dict-search-input" class="admin-search-input" placeholder="Search words..." oninput="LQ._triggerDictSearch(this.value)" style="flex:1;min-width:160px" />' +
      '<button type="button" class="admin-btn admin-btn-primary admin-btn-sm" onclick="LQ._showDictAddWordPrompt()">+ Add Word</button>' +
    '</div>' +
    '<div id="admin-dict-table-wrap" class="admin-table-wrap"><p class="admin-loading">Loading dictionary...</p></div>' +
    '<div id="admin-dict-pagination-wrap" class="admin-pagination-row" style="display:none;background:#fff;border-top:1px solid #e2e8f0;padding:12px 20px;flex-shrink:0;justify-content:space-between;align-items:center;"></div>';

  LQ._dictPage = 1;
  LQ._dictSearchQuery = '';
  LQ._dictAllLists = [];

  try {
    var resp = await fetch('/api/admin/dictionary', { credentials: 'include' });
    var data = await resp.json();
    if (data.ok && data.lists && data.lists.length) {
      LQ._dictAllLists = data.lists;
      var sel = document.getElementById('admin-dict-list-select');
      if (sel) {
        sel.innerHTML = data.lists.map(function (l) {
          return '<option value="' + LQ.esc(l.id) + '">' + LQ.esc(l.title) + ' (' + (l.words || []).length + ' words)</option>';
        }).join('');
      }
      LQ._loadDictWords();
    } else {
      var tw = document.getElementById('admin-dict-table-wrap');
      if (tw) tw.innerHTML = '<div style="text-align:center;padding:40px"><h3 style="margin:0 0 6px;color:#0f172a">No dictionary lists found</h3><p style="color:#64748b;font-size:13px;margin:0">Create dictionary-type word lists first (via Word Lists page or Bulk Upload).</p></div>';
    }
  } catch (err) {
    var tw = document.getElementById('admin-dict-table-wrap');
    if (tw) tw.innerHTML = '<p class="admin-error">Failed to load dictionary lists.</p>';
  }
};

LQ._triggerDictSearch = function (val) {
  LQ._dictSearchQuery = val.trim().toLowerCase();
  LQ._dictPage = 1;
  if (LQ._dictSearchTimeout) clearTimeout(LQ._dictSearchTimeout);
  LQ._dictSearchTimeout = setTimeout(function () {
    LQ._loadDictWords();
  }, 300);
};

LQ._loadDictWords = function () {
  var tableWrap = document.getElementById('admin-dict-table-wrap');
  var pagWrap = document.getElementById('admin-dict-pagination-wrap');
  if (!tableWrap) return;

  var sel = document.getElementById('admin-dict-list-select');
  var listId = sel ? sel.value : '';
  var lst = LQ._dictAllLists.find(function (l) { return l.id === listId; });
  if (!lst) {
    tableWrap.innerHTML = '<div style="text-align:center;padding:40px;color:#64748b">Select a dictionary list to view words.</div>';
    if (pagWrap) pagWrap.style.display = 'none';
    return;
  }

  var words = (lst.words || []).map(function (w) {
    return typeof w === 'string' ? { word: w } : w;
  });

  // Filter by search
  if (LQ._dictSearchQuery) {
    words = words.filter(function (w) {
      return w.word && w.word.toLowerCase().indexOf(LQ._dictSearchQuery) !== -1;
    });
  }

  // Sort alphabetically
  words.sort(function (a, b) { return (a.word || '').localeCompare(b.word || ''); });

  var limit = 25;
  var totalWords = words.length;
  var pages = Math.ceil(totalWords / limit) || 1;
  if (!LQ._dictPage) LQ._dictPage = 1;
  if (LQ._dictPage > pages) LQ._dictPage = pages;
  var start = (LQ._dictPage - 1) * limit;
  var pageWords = words.slice(start, start + limit);

  if (!totalWords) {
    tableWrap.innerHTML = '<div style="text-align:center;padding:40px"><h3 style="margin:0 0 6px;color:#0f172a">No words found</h3><p style="color:#64748b;font-size:13px;margin:0">' + (LQ._dictSearchQuery ? 'No words match your search.' : 'This dictionary list is empty. Add words to get started.') + '</p></div>';
    if (pagWrap) pagWrap.style.display = 'none';
    return;
  }

  var html = '<div class="admin-table-responsive"><table class="admin-table"><thead><tr>' +
    '<th style="width:60px">#</th><th>Word</th><th style="width:100px">Actions</th>' +
    '</tr></thead><tbody>';

  pageWords.forEach(function (w, idx) {
    html +=
      '<tr>' +
        '<td>' + (start + idx + 1) + '</td>' +
        '<td><strong>' + LQ.esc(w.word) + '</strong></td>' +
        '<td>' +
          '<button class="admin-btn admin-btn-danger admin-btn-sm" onclick="LQ._removeDictWord(\'' + LQ.esc(listId) + '\', \'' + LQ.esc(w.word).replace(/'/g, "\\'") + '\')">Remove</button>' +
        '</td>' +
      '</tr>';
  });

  html += '</tbody></table></div>';
  tableWrap.innerHTML = html;

  // Pagination
  if (pagWrap) {
    if (pages > 1) {
      var pagHtml = '<span class="admin-pagination-info" style="font-size:13px;color:#64748b">Showing page ' + LQ._dictPage + ' of ' + pages + ' (' + totalWords + ' words)</span>' +
        '<div style="display:flex;gap:6px">';
      if (LQ._dictPage > 1) {
        pagHtml += '<button class="admin-page-btn" onclick="LQ._dictPage=' + (LQ._dictPage - 1) + ';LQ._loadDictWords()">← Prev</button>';
      }
      for (var i = 1; i <= pages; i++) {
        if (i === LQ._dictPage) {
          pagHtml += '<button class="admin-page-btn active" style="background:#2563eb;color:#fff;border-color:#2563eb" disabled>' + i + '</button>';
        } else if (i === 1 || i === pages || Math.abs(i - LQ._dictPage) <= 2) {
          pagHtml += '<button class="admin-page-btn" onclick="LQ._dictPage=' + i + ';LQ._loadDictWords()">' + i + '</button>';
        } else if (i === 2 || i === pages - 1) {
          pagHtml += '<span style="padding:0 4px;color:#94a3b8">…</span>';
        }
      }
      if (LQ._dictPage < pages) {
        pagHtml += '<button class="admin-page-btn" onclick="LQ._dictPage=' + (LQ._dictPage + 1) + ';LQ._loadDictWords()">Next →</button>';
      }
      pagHtml += '</div>';
      pagWrap.innerHTML = pagHtml;
      pagWrap.style.display = 'flex';
    } else {
      pagWrap.innerHTML = '<span class="admin-pagination-info" style="font-size:13px;color:#64748b">' + totalWords + ' word' + (totalWords !== 1 ? 's' : '') + ' total</span>';
      pagWrap.style.display = 'flex';
    }
  }
};

LQ._showDictAddWordPrompt = function () {
  var listId = '';
  var sel = document.getElementById('admin-dict-list-select');
  if (sel) listId = sel.value;
  if (!listId) {
    LQ.toast('Please select a dictionary list first.');
    return;
  }

  var formHtml =
    '<form id="dict-add-word-form" class="admin-form" onsubmit="LQ._submitDictAddWord(event)">' +
      '<div class="admin-form-field">' +
        '<label for="dict-new-word">Word <span class="req">*</span></label>' +
        '<input type="text" id="dict-new-word" class="admin-search-input" style="width:100%;box-sizing:border-box" placeholder="Enter word" required />' +
      '</div>' +
      '<input type="hidden" id="dict-add-list-id" value="' + LQ.esc(listId) + '" />' +
      '<p id="dict-add-error" class="admin-error-msg" style="display:none"></p>' +
      '<div class="admin-form-actions" style="margin-top:20px">' +
        '<button type="button" class="admin-btn admin-btn-outline" onclick="LQ.closeAdminDrawer()">Cancel</button>' +
        '<button type="submit" class="admin-btn admin-btn-primary">Add Word</button>' +
      '</div>' +
    '</form>';

  LQ.openAdminDrawer('➕ Add Dictionary Word', formHtml);
};

LQ._submitDictAddWord = async function (e) {
  e.preventDefault();
  var wordInput = document.getElementById('dict-new-word');
  var listIdInput = document.getElementById('dict-add-list-id');
  var errEl = document.getElementById('dict-add-error');
  var word = wordInput ? wordInput.value.trim() : '';
  var listId = listIdInput ? listIdInput.value : '';

  if (!word) {
    if (errEl) { errEl.textContent = 'Please enter a word.'; errEl.style.display = 'block'; }
    return;
  }

  try {
    var resp = await fetch('/api/admin/dictionary/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ listId: listId, word: word })
    });
    var data = await resp.json();

    if (resp.ok) {
      LQ.toast('Word "' + word + '" added successfully!');
      LQ.closeAdminDrawer();
      // Refresh the list data
      LQ._refreshDictData();
    } else {
      if (errEl) { errEl.textContent = data.error || 'Failed to add word.'; errEl.style.display = 'block'; }
    }
  } catch (err) {
    if (errEl) { errEl.textContent = 'Network error. Please try again.'; errEl.style.display = 'block'; }
  }
};

LQ._removeDictWord = async function (listId, word) {
  if (!confirm('Remove "' + word + '" from this dictionary?')) return;

  try {
    var resp = await fetch('/api/admin/dictionary/remove', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ listId: listId, word: word })
    });
    var data = await resp.json();

    if (resp.ok) {
      LQ.toast('Word removed.');
      LQ._refreshDictData();
    } else {
      LQ.toast(data.error || 'Failed to remove word.');
    }
  } catch (err) {
    LQ.toast('Network error. Please try again.');
  }
};

LQ._refreshDictData = async function () {
  try {
    var resp = await fetch('/api/admin/dictionary', { credentials: 'include' });
    var data = await resp.json();
    if (data.ok && data.lists) {
      LQ._dictAllLists = data.lists;
      // Update dropdown counts
      var sel = document.getElementById('admin-dict-list-select');
      var currentVal = sel ? sel.value : '';
      if (sel) {
        sel.innerHTML = data.lists.map(function (l) {
          return '<option value="' + LQ.esc(l.id) + '"' + (l.id === currentVal ? ' selected' : '') + '>' + LQ.esc(l.title) + ' (' + (l.words || []).length + ' words)</option>';
        }).join('');
      }
      LQ._loadDictWords();
    }
  } catch (err) {
    console.error('[Dict] Refresh error:', err);
  }
};

// Dictionary bulk upload form
LQ.renderDictBulkUploadForm = function () {
  var formHtml =
    '<div class="admin-bulk-info">' +
      '<p>Upload a <code>DictionaryWords.csv</code> file to import words into dictionary lists.</p>' +
      '<p style="font-size:12px;color:#64748b;margin-top:6px">Columns: <code>listId, word, index</code></p>' +
      '<a href="/api/admin/templates/dictionary-words" class="admin-btn admin-btn-outline admin-btn-sm" style="margin-top:10px;display:inline-block;text-decoration:none">📥 Download Template</a>' +
    '</div>' +
    '<form id="dict-bulk-form" class="admin-form" onsubmit="LQ._submitDictBulkUpload(event)">' +
      '<div class="admin-file-drop" id="dict-file-drop" onclick="document.getElementById(\'dict-file-input\').click()">' +
        '<input type="file" id="dict-file-input" accept=".csv,text/csv" style="display:none" onchange="LQ._handleDictFileSelect(event)" />' +
        '<p class="admin-file-drop-text" id="dict-file-name-display">📁 Click to select DictionaryWords.csv file</p>' +
      '</div>' +
      '<p id="dict-bulk-error" class="admin-error-msg" style="display:none"></p>' +
      '<div class="admin-form-actions" style="margin-top:20px">' +
        '<button type="button" class="admin-btn admin-btn-outline" onclick="LQ.closeAdminDrawer()">Cancel</button>' +
        '<button type="submit" class="admin-btn admin-btn-primary" id="dict-bulk-submit-btn">Upload & Save</button>' +
      '</div>' +
    '</form>';

  LQ._selectedDictFileText = '';
  LQ.openAdminDrawer('📤 Bulk Upload Dictionary Words', formHtml);
};

LQ._handleDictFileSelect = function (e) {
  var file = e.target.files && e.target.files[0];
  if (!file) return;

  var display = document.getElementById('dict-file-name-display');
  if (display) display.textContent = 'Selected: ' + file.name + ' (' + (file.size / 1024).toFixed(1) + ' KB)';

  var reader = new FileReader();
  reader.onload = function (evt) {
    LQ._selectedDictFileText = evt.target.result;
  };
  reader.readAsText(file);
};

LQ._submitDictBulkUpload = async function (e) {
  e.preventDefault();
  var btn = document.getElementById('dict-bulk-submit-btn');
  var errEl = document.getElementById('dict-bulk-error');

  if (!LQ._selectedDictFileText) {
    if (errEl) { errEl.textContent = 'Please select a CSV file to upload.'; errEl.style.display = 'block'; }
    return;
  }

  if (errEl) errEl.style.display = 'none';
  if (btn) { btn.disabled = true; btn.textContent = 'Uploading...'; }

  try {
    var resp = await fetch('/api/admin/import/csv', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ 'DictionaryWords.csv': LQ._selectedDictFileText })
    });
    var data = await resp.json();

    if (resp.ok) {
      LQ.toast('Dictionary import successful!');
      LQ.closeAdminDrawer();
      LQ._refreshDictData();
    } else {
      if (errEl) { errEl.textContent = data.error || 'Failed to import dictionary words.'; errEl.style.display = 'block'; }
    }
  } catch (err) {
    if (errEl) { errEl.textContent = 'Network error. Please try again.'; errEl.style.display = 'block'; }
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Upload & Save'; }
  }
};

/* ══════════════════════════════════════════════════
   SINGLE FILE WORD LIST UPLOAD (WordLists.csv only)
   ══════════════════════════════════════════════════ */

LQ.renderListsSingleBulkUploadForm = function () {
  var formHtml =
    '<div class="admin-bulk-info">' +
      '<p>Upload a CSV file (<code>WordLists.csv</code>) containing word list metadata.</p>' +
      '<p style="font-size:12px;color:#64748b;margin-top:6px">Columns: <code>id, listNum, title, listType, icon, color</code></p>' +
      '<a href="/api/admin/templates/word-lists" class="admin-btn admin-btn-outline admin-btn-sm" style="margin-top:10px;display:inline-block;text-decoration:none">📥 Download Template</a>' +
    '</div>' +
    '<form id="bulk-lists-single-form" class="admin-form" onsubmit="LQ._submitListsSingleBulkUpload(event)">' +
      '<div class="admin-file-drop" id="lists-single-file-drop" onclick="document.getElementById(\'lists-single-file-input\').click()">' +
        '<input type="file" id="lists-single-file-input" accept=".csv,text/csv" style="display:none" onchange="LQ._handleListsSingleFileSelect(event)" />' +
        '<p class="admin-file-drop-text" id="lists-single-file-name-display">📁 Click to select WordLists.csv file</p>' +
      '</div>' +
      '<p id="lists-single-bulk-error" class="admin-error-msg" style="display:none"></p>' +
      '<div class="admin-form-actions" style="margin-top:20px">' +
        '<button type="button" class="admin-btn admin-btn-outline" onclick="LQ.closeAdminDrawer()">Cancel</button>' +
        '<button type="submit" class="admin-btn admin-btn-primary" id="lists-single-bulk-submit-btn">Upload & Save</button>' +
      '</div>' +
    '</form>';

  LQ._selectedListsSingleFileText = '';
  LQ.openAdminDrawer('📤 Bulk Upload Word Lists', formHtml);
};

LQ._handleListsSingleFileSelect = function (e) {
  var file = e.target.files && e.target.files[0];
  if (!file) return;

  var display = document.getElementById('lists-single-file-name-display');
  if (display) display.textContent = 'Selected: ' + file.name + ' (' + (file.size / 1024).toFixed(1) + ' KB)';

  var reader = new FileReader();
  reader.onload = function (evt) {
    LQ._selectedListsSingleFileText = evt.target.result;
  };
  reader.readAsText(file);
};

LQ._submitListsSingleBulkUpload = async function (e) {
  e.preventDefault();
  var btn = document.getElementById('lists-single-bulk-submit-btn');
  var errEl = document.getElementById('lists-single-bulk-error');

  if (!LQ._selectedListsSingleFileText) {
    if (errEl) { errEl.textContent = 'Please select a CSV file to upload.'; errEl.style.display = 'block'; }
    return;
  }

  if (errEl) errEl.style.display = 'none';
  if (btn) { btn.disabled = true; btn.textContent = 'Uploading...'; }

  try {
    var resp = await fetch('/api/admin/import/csv', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ 'WordLists.csv': LQ._selectedListsSingleFileText })
    });
    var data = await resp.json();

    if (resp.ok) {
      LQ.toast('Word Lists import successful!');
      LQ.closeAdminDrawer();
      if (typeof LQ._loadAdminWordLists === 'function') LQ._loadAdminWordLists();
    } else {
      if (errEl) { errEl.textContent = data.error || 'Failed to import word lists.'; errEl.style.display = 'block'; }
    }
  } catch (err) {
    if (errEl) { errEl.textContent = 'Network error. Please try again.'; errEl.style.display = 'block'; }
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Upload & Save'; }
  }
};

/* ══════════════════════════════════════════════════
   TENSES BULK UPLOAD HANDLERS
   ══════════════════════════════════════════════════ */

LQ.renderTensesBulkUploadForm = function () {
  var formHtml =
    '<div class="admin-bulk-info">' +
      '<p>Upload a CSV file (<code>TensesQuestions.csv</code>) containing tense questions.</p>' +
      '<p style="font-size:12px;color:#64748b;margin-top:6px">Columns: <code>group,category,title,text,story,topic,q,options,answer</code></p>' +
      '<a href="/api/admin/templates/tenses" class="admin-btn admin-btn-outline admin-btn-sm" style="margin-top:10px;display:inline-block;text-decoration:none">📥 Download Template</a>' +
    '</div>' +
    '<form id="bulk-tenses-form" class="admin-form" onsubmit="LQ._submitTensesBulkUpload(event)">' +
      '<div class="admin-file-drop" id="tenses-file-drop" onclick="document.getElementById(\'tenses-file-input\').click()">' +
        '<input type="file" id="tenses-file-input" accept=".csv,text/csv" style="display:none" onchange="LQ._handleTensesFileSelect(event)" />' +
        '<p class="admin-file-drop-text" id="tenses-file-name-display">📁 Click to select TensesQuestions.csv file</p>' +
      '</div>' +
      '<p id="tenses-bulk-error" class="admin-error-msg" style="display:none"></p>' +
      '<div class="admin-form-actions" style="margin-top:20px">' +
        '<button type="button" class="admin-btn admin-btn-outline" onclick="LQ.closeAdminDrawer()">Cancel</button>' +
        '<button type="submit" class="admin-btn admin-btn-primary" id="tenses-bulk-submit-btn">Upload & Save</button>' +
      '</div>' +
    '</form>';

  LQ._selectedTensesFileText = '';
  LQ.openAdminDrawer('📤 Bulk Upload Tenses', formHtml);
};

LQ._handleTensesFileSelect = function (e) {
  var file = e.target.files && e.target.files[0];
  if (!file) return;

  var display = document.getElementById('tenses-file-name-display');
  if (display) display.textContent = 'Selected: ' + file.name + ' (' + (file.size / 1024).toFixed(1) + ' KB)';

  var reader = new FileReader();
  reader.onload = function (evt) {
    LQ._selectedTensesFileText = evt.target.result;
  };
  reader.readAsText(file);
};

LQ._submitTensesBulkUpload = async function (e) {
  e.preventDefault();
  var btn = document.getElementById('tenses-bulk-submit-btn');
  var errEl = document.getElementById('tenses-bulk-error');

  if (!LQ._selectedTensesFileText) {
    if (errEl) { errEl.textContent = 'Please select a CSV file to upload.'; errEl.style.display = 'block'; }
    return;
  }

  if (errEl) errEl.style.display = 'none';
  if (btn) { btn.disabled = true; btn.textContent = 'Uploading...'; }

  try {
    var resp = await fetch('/api/admin/import/csv', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ 'TensesQuestions.csv': LQ._selectedTensesFileText })
    });
    var data = await resp.json();

    if (resp.ok) {
      LQ.toast('Tenses import successful!');
      LQ.closeAdminDrawer();
      if (typeof LQ._loadTensesQuestions === 'function') LQ._loadTensesQuestions();
    } else {
      if (errEl) { errEl.textContent = data.error || 'Failed to import tenses questions.'; errEl.style.display = 'block'; }
    }
  } catch (err) {
    if (errEl) { errEl.textContent = 'Network error. Please try again.'; errEl.style.display = 'block'; }
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Upload & Save'; }
  }
};

/* ══════════════════════════════════════════════════
   SYSTEM WIDE BULK UPLOAD PAGE (admin only)
   ══════════════════════════════════════════════════ */

LQ.renderAdminBulkPage = function () {
  var wrap = document.getElementById('admin-bulk-wrap');
  if (!wrap) return;

  var gridStyle = 'display:grid;grid-template-columns:repeat(auto-fit, minmax(280px, 1fr));gap:20px;padding:20px;box-sizing:border-box;';
  var cardStyle = 'background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:24px;box-shadow:0 1px 3px rgba(0,0,0,0.05);display:flex;flex-direction:column;justify-content:between;transition:box-shadow 0.2s;';
  var titleStyle = 'font-size:16px;font-weight:700;color:#0f172a;margin:0 0 8px;display:flex;align-items:center;gap:8px';
  var descStyle = 'font-size:13px;color:#64748b;line-height:1.5;margin:0 0 20px;flex:1';
  var btnWrapStyle = 'display:flex;gap:10px;margin-top:auto';

  wrap.innerHTML =
    '<div class="admin-page-header">' +
      '<h2 class="admin-page-title">📤 System Bulk Uploads</h2>' +
    '</div>' +
    '<div style="overflow-y:auto;height:calc(100vh - 120px);background:#f8fafc;width:100%">' +
      '<div style="' + gridStyle + '">' +
        // 1. Students card
        '<div style="' + cardStyle + '">' +
          '<h3 style="' + titleStyle + '">👩‍🎓 Students</h3>' +
          '<p style="' + descStyle + '">Import student rosters for organizations using Excel spreadsheets.</p>' +
          '<div style="' + btnWrapStyle + '">' +
            '<button class="admin-btn admin-btn-outline admin-btn-sm" style="flex:1" onclick="LQ._downloadStudentsTemplate()">Templates</button>' +
            '<button class="admin-btn admin-btn-primary admin-btn-sm" style="flex:1" onclick="LQ.renderBulkUploadForm()">Upload</button>' +
          '</div>' +
        '</div>' +
        // 2. Words Database card
        '<div style="' + cardStyle + '">' +
          '<h3 style="' + titleStyle + '">📝 Words Database</h3>' +
          '<p style="' + descStyle + '">Import the general vocabulary words database with definitions, phonetic spellings, synonyms, and parts of speech.</p>' +
          '<div style="' + btnWrapStyle + '">' +
            '<a href="/api/admin/templates/words" class="admin-btn admin-btn-outline admin-btn-sm" style="text-decoration:none;display:inline-flex;align-items:center;justify-content:center;flex:1">Templates</a>' +
            '<button class="admin-btn admin-btn-primary admin-btn-sm" style="flex:1" onclick="LQ.renderWordsBulkUploadForm()">Upload</button>' +
          '</div>' +
        '</div>' +
        // 3. Word Lists (Full) card
        '<div style="' + cardStyle + '">' +
          '<h3 style="' + titleStyle + '">📋 Word Lists (Full)</h3>' +
          '<p style="' + descStyle + '">Import complex GRE synonym lists, groups, group member word associations, and A-Z dictionary configs.</p>' +
          '<div style="' + btnWrapStyle + '">' +
            '<button class="admin-btn admin-btn-outline admin-btn-sm" style="flex:1" onclick="LQ.renderListsBulkUploadForm()">Templates</button>' +
            '<button class="admin-btn admin-btn-primary admin-btn-sm" style="flex:1" onclick="LQ.renderListsBulkUploadForm()">Upload</button>' +
          '</div>' +
        '</div>' +
        // 4. Dictionary Words card
        '<div style="' + cardStyle + '">' +
          '<h3 style="' + titleStyle + '">📖 Dictionary Words</h3>' +
          '<p style="' + descStyle + '">Import words directly into A-Z dictionary lists.</p>' +
          '<div style="' + btnWrapStyle + '">' +
            '<a href="/api/admin/templates/dictionary-words" class="admin-btn admin-btn-outline admin-btn-sm" style="text-decoration:none;display:inline-flex;align-items:center;justify-content:center;flex:1">Templates</a>' +
            '<button class="admin-btn admin-btn-primary admin-btn-sm" style="flex:1" onclick="LQ.renderDictBulkUploadForm()">Upload</button>' +
          '</div>' +
        '</div>' +
        // 5. Tenses Questions card
        '<div style="' + cardStyle + '">' +
          '<h3 style="' + titleStyle + '">🕒 Tenses Content</h3>' +
          '<p style="' + descStyle + '">Import reading comprehension passages, quiz questions, multiple choice answers, and explanations.</p>' +
          '<div style="' + btnWrapStyle + '">' +
            '<a href="/api/admin/templates/tenses" class="admin-btn admin-btn-outline admin-btn-sm" style="text-decoration:none;display:inline-flex;align-items:center;justify-content:center;flex:1">Templates</a>' +
            '<button class="admin-btn admin-btn-primary admin-btn-sm" style="flex:1" onclick="LQ.renderTensesBulkUploadForm()">Upload</button>' +
          '</div>' +
        '</div>' +
        // 6. Practice Questions card
        '<div style="' + cardStyle + '">' +
          '<h3 style="' + titleStyle + '">📝 Practice Questions</h3>' +
          '<p style="' + descStyle + '">Import synonym group practice questions with choices, categories, and correct answers.</p>' +
          '<div style="' + btnWrapStyle + '">' +
            '<a href="/api/admin/templates/practice-questions" class="admin-btn admin-btn-outline admin-btn-sm" style="text-decoration:none;display:inline-flex;align-items:center;justify-content:center;flex:1">Templates</a>' +
            '<button class="admin-btn admin-btn-primary admin-btn-sm" style="flex:1" onclick="LQ.renderPracticeQuestionsBulkUploadForm()">Upload</button>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>';
};

LQ._downloadStudentsTemplate = function () {
  window.location.href = '/api/admin/students/template';
};

/* ══════════════════════════════════════════════════
   WORD LIST GROUPS MANAGEMENT (admin only)
   ══════════════════════════════════════════════════ */

LQ.renderManageWordListGroups = async function (listId) {
  var wrap = document.getElementById('admin-word-lists-wrap');
  if (!wrap) return;

  try {
    var resp = await fetch('/api/admin/word-lists/detail/' + encodeURIComponent(listId), { credentials: 'include' });
    var data = await resp.json();
    if (!resp.ok || !data.list) {
      LQ.toast(data.error || 'Failed to load list details.');
      return;
    }

    var list = data.list;
    var groups = list.groups || [];
    groups.sort((a, b) => (a.groupNum || 0) - (b.groupNum || 0));

    var html =
      '<div class="admin-page-header">' +
        '<div style="display:flex;align-items:center;gap:12px">' +
          '<button class="admin-btn admin-btn-outline admin-btn-sm" onclick="LQ.renderAdminWordListsPage()">← Back</button>' +
          '<h2 class="admin-page-title">' + LQ.esc(list.title) + ' — Groups</h2>' +
        '</div>' +
        '<button class="admin-btn admin-btn-primary" onclick="LQ._showAddListGroupForm(\'' + LQ.esc(listId) + '\')">+ Add Group</button>' +
      '</div>' +
      '<div style="overflow-y:auto;height:calc(100vh - 120px);padding:20px;box-sizing:border-box;background:#f8fafc">';

    if (!groups.length) {
      html +=
        '<div style="text-align:center;padding:40px;background:#fff;border-radius:12px;border:1px solid #e2e8f0">' +
          '<h3 style="margin:0 0- 6px;color:#0f172a">No groups in this list</h3>' +
          '<p style="color:#64748b;font-size:13px;margin:0 0 16px">Create a synonym/antonym group to start adding words.</p>' +
          '<button class="admin-btn admin-btn-primary admin-btn-sm" onclick="LQ._showAddListGroupForm(\'' + LQ.esc(listId) + '\')">Create Group</button>' +
        '</div>';
    } else {
      html += '<div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(320px, 1fr));gap:20px">';
      groups.forEach(function (g) {
        var words = g.words || [];
        words.sort((a, b) => (a.index || 0) - (b.index || 0));

        html +=
          '<div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,0.05);display:flex;flex-direction:column;height:380px">' +
            '<div style="padding:16px 20px;border-bottom:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;background:#fafafa;border-top-left-radius:12px;border-top-right-radius:12px">' +
              '<div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-right:8px">' +
                '<h4 style="margin:0;font-size:14px;font-weight:700;color:#0f172a">' + LQ.esc(g.title) + '</h4>' +
                '<code style="font-size:11px;color:#64748b">' + LQ.esc(g.id) + '</code>' +
              '</div>' +
              '<button class="admin-btn admin-btn-danger admin-btn-sm" style="padding:4px 8px;font-size:11px" onclick="LQ._deleteListGroup(\'' + LQ.esc(listId) + '\', \'' + LQ.esc(g.id) + '\')">Delete</button>' +
            '</div>' +
            '<div style="flex:1;overflow-y:auto;padding:12px 20px;display:flex;flex-direction:column;gap:8px" class="admin-table-responsive">' +
              '<table class="admin-table" style="margin:0;box-shadow:none;border:none">' +
                '<thead><tr style="background:none"><th style="padding:4px;font-size:11px">Word</th><th style="padding:4px;font-size:11px;width:70px">Role</th><th style="padding:4px;font-size:11px;width:40px;text-align:right">Del</th></tr></thead>' +
                '<tbody>';

        if (!words.length) {
          html += '<tr><td colspan="3" style="text-align:center;font-size:12px;color:#94a3b8;padding:20px 0">No words in group</td></tr>';
        } else {
          words.forEach(function (w) {
            html +=
              '<tr style="border-bottom:1px solid #f1f5f9">' +
                '<td style="padding:6px 4px;font-size:13px;font-weight:600">' + LQ.esc(w.word) + '</td>' +
                '<td style="padding:6px 4px;font-size:11px"><span style="padding:2px 6px;border-radius:4px;background:#f1f5f9;color:#475569">' + LQ.esc(w.role || 'normal') + '</span></td>' +
                '<td style="padding:6px 4px;text-align:right"><button style="background:none;border:none;color:#ef4444;font-weight:bold;cursor:pointer;font-size:14px" onclick="LQ._removeGroupWord(\'' + LQ.esc(listId) + '\', \'' + LQ.esc(g.id) + '\', \'' + LQ.esc(w.word).replace(/'/g, "\\'") + '\')">×</button></td>' +
              '</tr>';
          });
        }

        html +=
                '</tbody>' +
              '</table>' +
            '</div>' +
            '<div style="padding:12px 20px;border-top:1px solid #e2e8f0;background:#fafafa;border-bottom-left-radius:12px;border-bottom-right-radius:12px">' +
              '<form style="display:flex;gap:6px" onsubmit="LQ._addGroupWord(event, \'' + LQ.esc(listId) + '\', \'' + LQ.esc(g.id) + '\')">' +
                '<input type="text" placeholder="Add word" required style="flex:1;padding:6px 10px;border:1px solid #cbd5e1;border-radius:6px;font-size:12px" />' +
                '<select style="padding:6px;border:1px solid #cbd5e1;border-radius:6px;font-size:12px;background:#fff">' +
                  '<option value="normal">Normal</option>' +
                  '<option value="synonym">Synonym</option>' +
                  '<option value="antonym">Antonym</option>' +
                '</select>' +
                '<button type="submit" class="admin-btn admin-btn-primary admin-btn-sm" style="padding:6px 12px;font-size:12px">+</button>' +
              '</form>' +
            '</div>' +
          '</div>';
      });
      html += '</div>';
    }

    html += '</div>';
    wrap.innerHTML = html;
  } catch (err) {
    LQ.toast('Network error loading groups.');
  }
};

LQ._showAddListGroupForm = function (listId) {
  var formHtml =
    '<form id="add-list-group-form" class="admin-form" onsubmit="LQ._submitAddListGroup(event, \'' + LQ.esc(listId) + '\')">' +
      '<div class="admin-form-field">' +
        '<label for="grp-id">Group ID <span class="req">*</span></label>' +
        '<input type="text" id="grp-id" class="admin-search-input" style="width:100%;box-sizing:border-box" placeholder="e.g. grp-1" required />' +
      '</div>' +
      '<div class="admin-form-field">' +
        '<label for="grp-title">Title <span class="req">*</span></label>' +
        '<input type="text" id="grp-title" class="admin-search-input" style="width:100%;box-sizing:border-box" placeholder="e.g. Agree / Harmony" required />' +
      '</div>' +
      '<div class="admin-form-field">' +
        '<label for="grp-num">Group Order Number (Sorting)</label>' +
        '<input type="number" id="grp-num" class="admin-search-input" style="width:100%;box-sizing:border-box" placeholder="e.g. 1" />' +
      '</div>' +
      '<p id="grp-add-error" class="admin-error-msg" style="display:none"></p>' +
      '<div class="admin-form-actions" style="margin-top:20px">' +
        '<button type="button" class="admin-btn admin-btn-outline" onclick="LQ.closeAdminDrawer()">Cancel</button>' +
        '<button type="submit" class="admin-btn admin-btn-primary">Create Group</button>' +
      '</div>' +
    '</form>';

  LQ.openAdminDrawer('➕ Add Synonym Group', formHtml);
};

LQ._submitAddListGroup = async function (e, listId) {
  e.preventDefault();
  var idEl = document.getElementById('grp-id');
  var titleEl = document.getElementById('grp-title');
  var numEl = document.getElementById('grp-num');
  var errEl = document.getElementById('grp-add-error');

  var id = idEl ? idEl.value.trim() : '';
  var title = titleEl ? titleEl.value.trim() : '';
  var groupNum = numEl ? parseInt(numEl.value || '0', 10) : 0;

  if (!id || !title) return;

  try {
    var resp = await fetch('/api/admin/word-lists/' + encodeURIComponent(listId) + '/groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ id: id, title: title, groupNum: groupNum })
    });
    var data = await resp.json();

    if (resp.ok) {
      LQ.toast('Group created successfully!');
      LQ.closeAdminDrawer();
      LQ.renderManageWordListGroups(listId);
    } else {
      if (errEl) { errEl.textContent = data.error || 'Failed to add group.'; errEl.style.display = 'block'; }
    }
  } catch (err) {
    if (errEl) { errEl.textContent = 'Network error.'; errEl.style.display = 'block'; }
  }
};

LQ._deleteListGroup = async function (listId, groupId) {
  if (!confirm('Are you sure you want to delete this group? All words inside will be removed from this list group.')) return;

  try {
    var resp = await fetch('/api/admin/word-lists/' + encodeURIComponent(listId) + '/groups/' + encodeURIComponent(groupId) + '/delete', {
      method: 'POST',
      credentials: 'include'
    });
    var data = await resp.json();

    if (resp.ok) {
      LQ.toast('Group deleted.');
      LQ.renderManageWordListGroups(listId);
    } else {
      LQ.toast(data.error || 'Failed to delete group.');
    }
  } catch (err) {
    LQ.toast('Network error.');
  }
};

LQ._addGroupWord = async function (e, listId, groupId) {
  e.preventDefault();
  var form = e.target;
  var txtInput = form.querySelector('input[type="text"]');
  var select = form.querySelector('select');
  var word = txtInput ? txtInput.value.trim() : '';
  var role = select ? select.value : 'normal';

  if (!word) return;

  try {
    var resp = await fetch('/api/admin/word-lists/' + encodeURIComponent(listId) + '/groups/' + encodeURIComponent(groupId) + '/words', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ word: word, role: role })
    });
    var data = await resp.json();

    if (resp.ok) {
      LQ.toast('Word added to group.');
      LQ.renderManageWordListGroups(listId);
    } else {
      LQ.toast(data.error || 'Failed to add word.');
    }
  } catch (err) {
    LQ.toast('Network error.');
  }
};

LQ._removeGroupWord = async function (listId, groupId, word) {
  if (!confirm('Remove "' + word + '" from this group?')) return;

  try {
    var resp = await fetch('/api/admin/word-lists/' + encodeURIComponent(listId) + '/groups/' + encodeURIComponent(groupId) + '/words/remove', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ word: word })
    });
    var data = await resp.json();

    if (resp.ok) {
      LQ.toast('Word removed.');
      LQ.renderManageWordListGroups(listId);
    } else {
      LQ.toast(data.error || 'Failed to remove word.');
    }
  } catch (err) {
    LQ.toast('Network error.');
  }
};

/* ══════════════════════════════════════════════════
   PRACTICE QUESTIONS MANAGEMENT PAGE (admin only)
   ══════════════════════════════════════════════════ */

LQ.renderAdminPracticeQuestionsPage = async function () {
  var wrap = document.getElementById('admin-practice-questions-wrap');
  if (!wrap) return;

  wrap.innerHTML =
    '<div class="admin-page-header">' +
      '<h2 class="admin-page-title">📝 Practice Questions</h2>' +
      '<div class="admin-header-actions">' +
        '<button type="button" class="admin-btn admin-btn-outline" style="margin-right:8px" onclick="LQ.renderPracticeQuestionsBulkUploadForm()">📤 Bulk Upload</button>' +
        '<button type="button" class="admin-btn admin-btn-primary" onclick="LQ.renderAddPracticeQuestionForm()">+ Add Question</button>' +
      '</div>' +
    '</div>' +
    '<div class="admin-search-bar" style="display:flex;gap:12px;align-items:center;margin-bottom:16px;flex-wrap:wrap">' +
      '<input type="text" id="pq-search-input" class="admin-search-input" placeholder="Search question title..." oninput="LQ._triggerPqSearch(this.value)" style="flex:1;min-width:160px" />' +
      '<select id="pq-filter-list" class="admin-search-input" style="max-width:200px" onchange="LQ._populatePqFilterGroups();LQ._pqPage=1;LQ._loadAdminPracticeQuestions()">' +
        '<option value="all">All Lists</option>' +
      '</select>' +
      '<select id="pq-filter-group" class="admin-search-input" style="max-width:200px" onchange="LQ._pqPage=1;LQ._loadAdminPracticeQuestions()">' +
        '<option value="all">All Groups</option>' +
      '</select>' +
    '</div>' +
    '<div id="admin-pq-table-wrap" class="admin-table-wrap"><p class="admin-loading">Loading questions...</p></div>' +
    '<div id="admin-pq-pagination-wrap" class="admin-pagination-row" style="display:none;background:#fff;border-top:1px solid #e2e8f0;padding:12px 20px;flex-shrink:0;justify-content:space-between;align-items:center;"></div>';

  LQ._pqPage = 1;
  LQ._pqSearchQuery = '';
  LQ._pqLists = [];

  try {
    var respL = await fetch('/api/admin/word-lists?limit=100', { credentials: 'include' });
    var dataL = await respL.json();
    if (dataL.ok && dataL.items) {
      LQ._pqLists = dataL.items;
      var listSelect = document.getElementById('pq-filter-list');
      if (listSelect) {
        listSelect.innerHTML = '<option value="all">All Lists</option>' + dataL.items.map(function (l) {
          return '<option value="' + LQ.esc(l.id) + '">' + LQ.esc(l.title) + '</option>';
        }).join('');
      }
    }
  } catch (e) {
    console.error('[PQ] Load lists filter error:', e);
  }

  LQ._loadAdminPracticeQuestions();
};

LQ._triggerPqSearch = function (val) {
  LQ._pqSearchQuery = val.trim();
  LQ._pqPage = 1;
  if (LQ._pqSearchTimeout) clearTimeout(LQ._pqSearchTimeout);
  LQ._pqSearchTimeout = setTimeout(function () {
    LQ._loadAdminPracticeQuestions();
  }, 300);
};

// Helper: resolve correct option index (handles A/B/C/D, text, or index)
function getCorrectOptionIndex(correctAns, options) {
  if (!options || !options.length) return -1;
  var str = (correctAns !== undefined && correctAns !== null) ? String(correctAns).trim() : '';
  if (!str) return -1;
  var directIdx = options.indexOf(str);
  if (directIdx >= 0) return directIdx;
  var upper = str.toUpperCase();
  if (upper.length === 1 && upper >= 'A' && upper <= 'Z') {
    var letterIdx = upper.charCodeAt(0) - 65;
    if (letterIdx >= 0 && letterIdx < options.length) return letterIdx;
  }
  var numIdx = parseInt(str, 10);
  if (!isNaN(numIdx) && numIdx >= 0 && numIdx < options.length) return numIdx;
  return -1;
}

LQ.previewPracticeQuestion = function(qJsonStringEncoded) {
  var q = JSON.parse(decodeURIComponent(qJsonStringEncoded));
  var listObj = LQ._pqLists.find(l => l.id === q.listId);
  var groupObj = listObj ? (listObj.groups || []).find(g => g.id === q.groupId) : null;
  var listName = listObj ? listObj.title : q.listId;
  var groupName = groupObj ? groupObj.title : q.groupId;

  var actualAnswer = q.correctAnswer;
  if (q.options && q.options.length && q.correctAnswer) {
    var answers = q.correctAnswer.split(",").map(s => s.trim());
    var resolved = answers.map(ans => {
      var idx = getCorrectOptionIndex(ans, q.options);
      return (idx >= 0 && idx < q.options.length) ? q.options[idx] : ans;
    });
    actualAnswer = resolved.join(', ');
  }

  var optionsHtml = '';
  if (q.options && q.options.length) {
    optionsHtml = '<div style="margin-top:12px"><strong>Options:</strong><ul style="margin:6px 0 0 16px;padding:0;list-style:disc">';
    q.options.forEach(function(opt, idx) {
      optionsHtml += '<li style="margin-bottom:4px">Option ' + String.fromCharCode(65 + idx) + ': ' + LQ.esc(opt) + '</li>';
    });
    optionsHtml += '</ul></div>';
  }

  var html = 
    '<div class="admin-form" style="padding:10px">' +
      '<div style="margin-bottom:12px"><strong>Question Prompt:</strong><div style="background:#f8fafc;padding:12px;border:1px solid #e2e8f0;border-radius:8px;margin-top:6px;font-weight:600;color:#0f172a">' + LQ.esc(q.title) + '</div></div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px">' +
        '<div><strong>Word List:</strong><div>' + LQ.esc(listName) + '</div></div>' +
        '<div><strong>Synonym Group:</strong><div>' + LQ.esc(groupName) + '</div></div>' +
        '<div><strong>Question Type:</strong><div><code>' + LQ.esc(q.type) + '</code></div></div>' +
        '<div><strong>Category:</strong><div>' + LQ.esc(q.category || 'normal') + '</div></div>' +
      '</div>' +
      optionsHtml +
      '<div style="margin-top:16px;background:#f0fdf4;border:1.5px solid #bbf7d0;border-radius:8px;padding:12px">' +
        '<span style="color:#166534;font-weight:700">✓ Correct Answer:</span> ' +
        '<span style="font-weight:800;color:#14532d">' + LQ.esc(actualAnswer) + '</span>' +
      '</div>' +
      '<div style="margin-top:24px;text-align:right">' +
        '<button type="button" class="admin-btn admin-btn-primary" onclick="LQ.closeAdminDrawer()">Close</button>' +
      '</div>' +
    '</div>';

  LQ.openAdminDrawer('🔍 Practice Question Preview', html);
};

LQ._loadAdminPracticeQuestions = async function () {
  var tableWrap = document.getElementById('admin-pq-table-wrap');
  var pagWrap = document.getElementById('admin-pq-pagination-wrap');
  if (!tableWrap) return;

  var listId = document.getElementById('pq-filter-list') ? document.getElementById('pq-filter-list').value : 'all';
  var groupId = document.getElementById('pq-filter-group') ? document.getElementById('pq-filter-group').value : 'all';

  var url = '/api/admin/practice-questions?page=' + LQ._pqPage + '&limit=15';
  if (LQ._pqSearchQuery) url += '&search=' + encodeURIComponent(LQ._pqSearchQuery);
  if (listId !== 'all') url += '&listId=' + encodeURIComponent(listId);
  if (groupId !== 'all') url += '&groupId=' + encodeURIComponent(groupId);

  try {
    var resp = await fetch(url, { credentials: 'include' });
    var data = await resp.json();

    if (!resp.ok) {
      tableWrap.innerHTML = '<p class="admin-error">' + LQ.esc(data.error || 'Failed to load') + '</p>';
      return;
    }

    var questions = data.questions || [];
    if (!questions.length) {
      tableWrap.innerHTML =
        '<div style="text-align:center;padding:40px">' +
          '<h3 style="margin:0 0 6px;color:#0f172a">No practice questions found</h3>' +
          '<p style="color:#64748b;font-size:13px;margin:0">Create a practice question to start building the practice pool.</p>' +
        '</div>';
      if (pagWrap) pagWrap.style.display = 'none';
      return;
    }

    var html =
      '<div class="admin-table-responsive"><table class="admin-table"><thead><tr>' +
        '<th style="width:50px">#</th><th>List</th><th>Group</th><th>Type</th><th>Question Prompt</th><th>Options</th><th>Correct Answer</th><th style="width:120px">Actions</th>' +
      '</tr></thead><tbody>';

    questions.forEach(function (q, idx) {
      var startIdx = (data.pagination.page - 1) * data.pagination.limit + idx + 1;
      var listObj = LQ._pqLists.find(l => l.id === q.listId);
      var groupObj = listObj ? (listObj.groups || []).find(g => g.id === q.groupId) : null;
      var listName = listObj ? listObj.title : q.listId;
      var groupName = groupObj ? groupObj.title : q.groupId;
      var optionsStr = (q.options && q.options.length) ? q.options.filter(Boolean).join(' | ') : '—';

      var actualAnswerStr = q.correctAnswer || '—';
      if (q.options && q.options.length && q.correctAnswer) {
        var answers = q.correctAnswer.split(",").map(s => s.trim());
        var resolvedTexts = answers.map(ans => {
          var idxOpt = getCorrectOptionIndex(ans, q.options);
          return (idxOpt >= 0 && idxOpt < q.options.length) ? q.options[idxOpt] : ans;
        });
        actualAnswerStr = resolvedTexts.join(', ');
      }

      var qEncoded = encodeURIComponent(JSON.stringify(q));

      html +=
        '<tr>' +
          '<td>' + startIdx + '</td>' +
          '<td>' + LQ.esc(listName) + '</td>' +
          '<td>' + LQ.esc(groupName) + '</td>' +
          '<td><code>' + LQ.esc(q.type) + '</code></td>' +
          '<td style="max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="Click to Preview: ' + LQ.esc(q.title) + '">' +
            '<a href="javascript:void(0)" onclick="LQ.previewPracticeQuestion(\'' + qEncoded + '\')" style="color:#2563eb;text-decoration:none;font-weight:700;cursor:pointer">' + LQ.esc(q.title) + '</a>' +
          '</td>' +
          '<td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + LQ.esc(optionsStr) + '</td>' +
          '<td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"><code>' + LQ.esc(actualAnswerStr) + '</code></td>' +
          '<td>' +
            '<button class="admin-btn admin-btn-outline admin-btn-sm" style="margin-right:6px" onclick="LQ.renderEditPracticeQuestionForm(\'' + q._id + '\')">Edit</button>' +
            '<button class="admin-btn admin-btn-danger admin-btn-sm" onclick="LQ._deletePracticeQuestion(\'' + q._id + '\')">Delete</button>' +
          '</td>' +
        '</tr>';
    });

    html += '</tbody></table></div>';
    tableWrap.innerHTML = html;

    if (pagWrap) {
      if (data.pagination.pages > 1) {
        var pagHtml = '<span class="admin-pagination-info" style="font-size:13px;color:#64748b">Showing page ' + data.pagination.page + ' of ' + data.pagination.pages + ' (' + data.pagination.total + ' total)</span>' +
          '<div style="display:flex;gap:6px">';
        if (data.pagination.page > 1) {
          pagHtml += '<button class="admin-page-btn" onclick="LQ._pqPage=' + (data.pagination.page - 1) + ';LQ._loadAdminPracticeQuestions()">← Prev</button>';
        }
        for (var i = 1; i <= data.pagination.pages; i++) {
          if (i === data.pagination.page) {
            pagHtml += '<button class="admin-page-btn active" style="background:#2563eb;color:#fff;border-color:#2563eb" disabled>' + i + '</button>';
          } else if (i === 1 || i === data.pagination.pages || Math.abs(i - data.pagination.page) <= 2) {
            pagHtml += '<button class="admin-page-btn" onclick="LQ._pqPage=' + i + ';LQ._loadAdminPracticeQuestions()">' + i + '</button>';
          } else if (i === 2 || i === data.pagination.pages - 1) {
            pagHtml += '<span style="padding:0 4px;color:#94a3b8">…</span>';
          }
        }
        if (data.pagination.page < data.pagination.pages) {
          pagHtml += '<button class="admin-page-btn" onclick="LQ._pqPage=' + (data.pagination.page + 1) + ';LQ._loadAdminPracticeQuestions()">Next →</button>';
        }
        pagHtml += '</div>';
        pagWrap.innerHTML = pagHtml;
        pagWrap.style.display = 'flex';
      } else {
        pagWrap.innerHTML = '<span class="admin-pagination-info" style="font-size:13px;color:#64748b">' + data.pagination.total + ' question(s) total</span>';
        pagWrap.style.display = 'flex';
      }
    }
  } catch (err) {
    tableWrap.innerHTML = '<p class="admin-error">Failed to load practice questions.</p>';
  }
};

LQ.renderAddPracticeQuestionForm = function () {
  if (!LQ._pqLists || !LQ._pqLists.length) {
    LQ.toast('Create a Grouped Word List first before adding practice questions.');
    return;
  }

  LQ._pqFormOptions = ['', '', '', ''];
  LQ._pqFormPrevCorrect = '';

  var formHtml =
    '<form id="practice-question-form" class="admin-form" onsubmit="LQ._submitPracticeQuestion(event)">' +
      '<div class="admin-form-field">' +
        '<label for="pq-form-listId">Word List <span class="req">*</span></label>' +
        '<select id="pq-form-listId" class="admin-search-input" style="width:100%;box-sizing:border-box" onchange="window.populatePqFormGroups()" required>' +
          LQ._pqLists.map(l => '<option value="' + LQ.esc(l.id) + '">' + LQ.esc(l.title) + '</option>').join('') +
        '</select>' +
      '</div>' +
      '<div class="admin-form-field">' +
        '<label for="pq-form-groupId">Synonym Group <span class="req">*</span></label>' +
        '<select id="pq-form-groupId" class="admin-search-input" style="width:100%;box-sizing:border-box" required>' +
        '</select>' +
      '</div>' +
      '<div class="admin-form-field">' +
        '<label for="pq-form-category">Category</label>' +
        '<select id="pq-form-category" class="admin-search-input" style="width:100%;box-sizing:border-box" required>' +
          '<option value="normal">Normal</option>' +
          '<option value="reading">Reading</option>' +
          '<option value="writing">Writing</option>' +
          '<option value="speaking">Speaking</option>' +
          '<option value="listening">Listening</option>' +
        '</select>' +
      '</div>' +
      '<div class="admin-form-field" style="margin-bottom:20px">' +
        '<label>Question Type <span class="req">*</span></label>' +
        '<div class="pq-type-toggle-group" style="display:flex;gap:4px;margin-top:6px;width:100%;box-sizing:border-box;background:#f1f5f9;padding:4px;border-radius:10px;border:none">' +
          '<button type="button" class="pq-type-btn" data-value="mcq" onclick="window.setPqFormType(\'mcq\')" style="flex:1;text-align:center;padding:8px 4px;font-size:12px;font-weight:600;transition:all 0.2s;border:none;border-radius:8px;background:transparent;color:#64748b;cursor:pointer">Single Select MCQ</button>' +
          '<button type="button" class="pq-type-btn" data-value="mcq_multi" onclick="window.setPqFormType(\'mcq_multi\')" style="flex:1;text-align:center;padding:8px 4px;font-size:12px;font-weight:600;transition:all 0.2s;border:none;border-radius:8px;background:transparent;color:#64748b;cursor:pointer">Multi Select MCQ</button>' +
          '<button type="button" class="pq-type-btn" data-value="fib" onclick="window.setPqFormType(\'fib\')" style="flex:1;text-align:center;padding:8px 4px;font-size:12px;font-weight:600;transition:all 0.2s;border:none;border-radius:8px;background:transparent;color:#64748b;cursor:pointer">Fill in Blank</button>' +
        '</div>' +
        '<input type="hidden" id="pq-form-type" value="mcq">' +
      '</div>' +
      '<div class="admin-form-field">' +
        '<label for="pq-form-title">Question Prompt (Text) <span class="req">*</span></label>' +
        '<textarea id="pq-form-title" class="admin-search-input" style="width:100%;box-sizing:border-box;height:80px;font-family:inherit" placeholder="e.g. Choose the correct synonym of Concord." required></textarea>' +
      '</div>' +
      
      '<div id="pq-options-section" style="margin-top:16px">' +
        '<label style="font-weight:600;margin-bottom:8px;display:block">MCQ Options (Select the correct radio/checkbox on the left)</label>' +
        '<div id="pq-options-container"></div>' +
        '<button type="button" id="btn-add-pq-option" class="admin-btn admin-btn-outline admin-btn-sm" style="margin-top:8px" onclick="window.addPqFormOption()">+ Add Option</button>' +
      '</div>' +

      '<div id="pq-correct-answer-section" class="admin-form-field" style="margin-top:16px">' +
        '<label id="pq-correct-answer-label" style="font-weight:600;margin-bottom:8px;display:block">Correct Answer Text</label>' +
        '<div id="pq-correct-answer-container"></div>' +
      '</div>' +

      '<p id="pq-form-error" class="admin-error-msg" style="display:none"></p>' +
      '<div class="admin-form-actions" style="margin-top:24px">' +
        '<button type="button" class="admin-btn admin-btn-outline" onclick="LQ.closeAdminDrawer()">Cancel</button>' +
        '<button type="submit" class="admin-btn admin-btn-primary">Save Question</button>' +
      '</div>' +
    '</form>';

  LQ.openAdminDrawer('➕ Add Practice Question', formHtml);

  setTimeout(function () {
    window.populatePqFormGroups();
    window.setPqFormType('mcq');
  }, 100);
};

LQ.renderEditPracticeQuestionForm = async function (id) {
  try {
    var resp = await fetch('/api/admin/practice-questions?limit=100', { credentials: 'include' });
    var data = await resp.json();
    var q = (data.questions || []).find(x => x._id === id);
    if (!q) {
      LQ.toast('Practice question not found.');
      return;
    }

    LQ._pqFormOptions = q.options && q.options.length ? q.options.slice() : ['', '', '', ''];
    LQ._pqFormPrevCorrect = q.correctAnswer || '';

    var formHtml =
      '<form id="practice-question-form" class="admin-form" onsubmit="LQ._submitPracticeQuestion(event, \'' + id + '\')">' +
        '<div class="admin-form-field">' +
          '<label for="pq-form-listId">Word List <span class="req">*</span></label>' +
          '<select id="pq-form-listId" class="admin-search-input" style="width:100%;box-sizing:border-box" onchange="window.populatePqFormGroups()" required>' +
            LQ._pqLists.map(l => '<option value="' + LQ.esc(l.id) + '"' + (l.id === q.listId ? ' selected' : '') + '>' + LQ.esc(l.title) + '</option>').join('') +
          '</select>' +
        '</div>' +
        '<div class="admin-form-field">' +
          '<label for="pq-form-groupId">Synonym Group <span class="req">*</span></label>' +
          '<select id="pq-form-groupId" class="admin-search-input" style="width:100%;box-sizing:border-box" data-selected="' + LQ.esc(q.groupId) + '" required>' +
          '</select>' +
        '</div>' +
        '<div class="admin-form-field">' +
          '<label for="pq-form-category">Category</label>' +
          '<select id="pq-form-category" class="admin-search-input" style="width:100%;box-sizing:border-box" required>' +
            '<option value="normal"' + (q.category === 'normal' ? ' selected' : '') + '>Normal</option>' +
            '<option value="reading"' + (q.category === 'reading' ? ' selected' : '') + '>Reading</option>' +
            '<option value="writing"' + (q.category === 'writing' ? ' selected' : '') + '>Writing</option>' +
            '<option value="speaking"' + (q.category === 'speaking' ? ' selected' : '') + '>Speaking</option>' +
            '<option value="listening"' + (q.category === 'listening' ? ' selected' : '') + '>Listening</option>' +
          '</select>' +
        '</div>' +
        '<div class="admin-form-field" style="margin-bottom:20px">' +
          '<label>Question Type <span class="req">*</span></label>' +
          '<div class="pq-type-toggle-group" style="display:flex;gap:4px;margin-top:6px;width:100%;box-sizing:border-box;background:#f1f5f9;padding:4px;border-radius:10px;border:none">' +
            '<button type="button" class="pq-type-btn" data-value="mcq" onclick="window.setPqFormType(\'mcq\')" style="flex:1;text-align:center;padding:8px 4px;font-size:12px;font-weight:600;transition:all 0.2s;border:none;border-radius:8px;background:transparent;color:#64748b;cursor:pointer">Single Select MCQ</button>' +
            '<button type="button" class="pq-type-btn" data-value="mcq_multi" onclick="window.setPqFormType(\'mcq_multi\')" style="flex:1;text-align:center;padding:8px 4px;font-size:12px;font-weight:600;transition:all 0.2s;border:none;border-radius:8px;background:transparent;color:#64748b;cursor:pointer">Multi Select MCQ</button>' +
            '<button type="button" class="pq-type-btn" data-value="fib" onclick="window.setPqFormType(\'fib\')" style="flex:1;text-align:center;padding:8px 4px;font-size:12px;font-weight:600;transition:all 0.2s;border:none;border-radius:8px;background:transparent;color:#64748b;cursor:pointer">Fill in Blank</button>' +
          '</div>' +
          '<input type="hidden" id="pq-form-type" value="' + q.type + '">' +
        '</div>' +
        '<div class="admin-form-field">' +
          '<label for="pq-form-title">Question Prompt (Text) <span class="req">*</span></label>' +
          '<textarea id="pq-form-title" class="admin-search-input" style="width:100%;box-sizing:border-box;height:80px;font-family:inherit" required>' + LQ.esc(q.title) + '</textarea>' +
        '</div>' +
        
        '<div id="pq-options-section" style="margin-top:16px">' +
          '<label style="font-weight:600;margin-bottom:8px;display:block">MCQ Options (Select the correct radio/checkbox on the left)</label>' +
          '<div id="pq-options-container"></div>' +
          '<button type="button" id="btn-add-pq-option" class="admin-btn admin-btn-outline admin-btn-sm" style="margin-top:8px" onclick="window.addPqFormOption()">+ Add Option</button>' +
        '</div>' +

        '<div id="pq-correct-answer-section" class="admin-form-field" style="margin-top:16px">' +
          '<label id="pq-correct-answer-label" style="font-weight:600;margin-bottom:8px;display:block">Correct Answer Text</label>' +
          '<div id="pq-correct-answer-container"></div>' +
        '</div>' +

        '<p id="pq-form-error" class="admin-error-msg" style="display:none"></p>' +
        '<div class="admin-form-actions" style="margin-top:24px">' +
          '<button type="button" class="admin-btn admin-btn-outline" onclick="LQ.closeAdminDrawer()">Cancel</button>' +
          '<button type="submit" class="admin-btn admin-btn-primary">Update Question</button>' +
        '</div>' +
      '</form>';

    LQ.openAdminDrawer('📝 Edit Practice Question', formHtml);

    setTimeout(function () {
      window.populatePqFormGroups();
      var groupSelect = document.getElementById('pq-form-groupId');
      var selectedVal = groupSelect ? groupSelect.getAttribute('data-selected') : '';
      if (groupSelect && selectedVal) groupSelect.value = selectedVal;

      window.setPqFormType(q.type);
    }, 100);
  } catch (err) {
    LQ.toast('Failed to load edit form');
  }
};

LQ._submitPracticeQuestion = async function (e, id) {
  e.preventDefault();
  var errEl = document.getElementById('pq-form-error');
  var listId = document.getElementById('pq-form-listId').value;
  var groupId = document.getElementById('pq-form-groupId').value;
  var category = document.getElementById('pq-form-category').value.trim();
  var type = document.getElementById('pq-form-type').value;
  var title = document.getElementById('pq-form-title').value.trim();
  var correctAnswer = '';

  if (type === 'mcq') {
    var radioEl = document.querySelector('.pq-form-correct-choice:checked');
    correctAnswer = radioEl ? radioEl.value : '';
    if (!correctAnswer) {
      if (errEl) { errEl.textContent = 'Please select a correct option on the left.'; errEl.style.display = 'block'; }
      return;
    }
  } else if (type === 'mcq_multi') {
    var chks = document.querySelectorAll('.pq-form-correct-choice:checked');
    var correctList = Array.from(chks).map(c => c.value);
    if (!correctList.length) {
      if (errEl) { errEl.textContent = 'Please select at least one correct option on the left.'; errEl.style.display = 'block'; }
      return;
    }
    correctAnswer = correctList.join(', ');
  } else {
    var textEl = document.getElementById('pq-form-correct-answer-text');
    correctAnswer = textEl ? textEl.value.trim() : '';
    if (!correctAnswer) {
      if (errEl) { errEl.textContent = 'Please enter correct answer text.'; errEl.style.display = 'block'; }
      return;
    }
  }

  var payload = {
    id: id || null,
    listId: listId,
    groupId: groupId,
    category: category,
    type: type,
    title: title,
    options: (type === 'mcq' || type === 'mcq_multi') ? LQ._pqFormOptions : [],
    correctAnswer: correctAnswer
  };

  try {
    var resp = await fetch('/api/admin/practice-questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload)
    });
    var data = await resp.json();

    if (resp.ok) {
      LQ.toast(id ? 'Question updated.' : 'Question created.');
      LQ.closeAdminDrawer();
      LQ._loadAdminPracticeQuestions();
    } else {
      if (errEl) { errEl.textContent = data.error || 'Failed to save question.'; errEl.style.display = 'block'; }
    }
  } catch (err) {
    if (errEl) { errEl.textContent = 'Network error.'; errEl.style.display = 'block'; }
  }
};

LQ._deletePracticeQuestion = async function (id) {
  if (!confirm('Are you sure you want to delete this practice question?')) return;

  try {
    var resp = await fetch('/api/admin/practice-questions/' + encodeURIComponent(id), {
      method: 'DELETE',
      credentials: 'include'
    });
    var data = await resp.json();

    if (resp.ok) {
      LQ.toast('Question deleted.');
      LQ._loadAdminPracticeQuestions();
    } else {
      LQ.toast(data.error || 'Failed to delete question.');
    }
  } catch (err) {
    LQ.toast('Network error.');
  }
};

window.populatePqFormGroups = function () {
  var listSelect = document.getElementById('pq-form-listId');
  var groupSelect = document.getElementById('pq-form-groupId');
  if (!listSelect || !groupSelect) return;
  var listId = listSelect.value;
  var lst = LQ._pqLists.find(l => l.id === listId);
  var groups = lst ? (lst.groups || []) : [];
  groupSelect.innerHTML = groups.map(function (g) {
    return '<option value="' + LQ.esc(g.id) + '">' + LQ.esc(g.title) + '</option>';
  }).join('');
};

LQ._populatePqFilterGroups = function () {
  var listSelect = document.getElementById('pq-filter-list');
  var groupSelect = document.getElementById('pq-filter-group');
  if (!listSelect || !groupSelect) return;
  var listId = listSelect.value;
  if (!listId || listId === 'all') {
    groupSelect.innerHTML = '<option value="all">All Groups</option>';
    return;
  }
  var lst = LQ._pqLists.find(l => l.id === listId);
  var groups = lst ? (lst.groups || []) : [];
  groupSelect.innerHTML = '<option value="all">All Groups</option>' + groups.map(function (g) {
    return '<option value="' + LQ.esc(g.id) + '">' + LQ.esc(g.title) + '</option>';
  }).join('');
};

window.setPqFormType = function (val) {
  var hiddenInput = document.getElementById('pq-form-type');
  if (hiddenInput) hiddenInput.value = val;
  document.querySelectorAll('.pq-type-btn').forEach(function (btn) {
    if (btn.getAttribute('data-value') === val) {
      btn.style.background = '#2563eb';
      btn.style.color = '#ffffff';
      btn.style.boxShadow = '0 2px 6px rgba(37,99,235,0.25)';
      btn.style.borderColor = '#2563eb';
    } else {
      btn.style.background = 'transparent';
      btn.style.color = '#64748b';
      btn.style.boxShadow = 'none';
      btn.style.borderColor = 'transparent';
    }
  });
  window.togglePqFormTypeView();
};

window.addPqFormOption = function () {
  if (LQ._pqFormOptions.length >= 6) return;
  LQ._pqFormOptions.push('');
  window.renderPqFormOptions();
};

window.removePqFormOption = function (idx) {
  if (LQ._pqFormOptions.length <= 4) return;
  LQ._pqFormOptions.splice(idx, 1);
  window.renderPqFormOptions();
};

window.updatePqFormOptionText = function (idx, val) {
  LQ._pqFormOptions[idx] = val;
};

window.updatePqFormCorrectChoiceState = function () {
  var type = document.getElementById('pq-form-type').value;
  if (type === 'mcq_multi') {
    var chks = document.querySelectorAll('.pq-form-correct-choice:checked');
    LQ._pqFormPrevCorrect = Array.from(chks).map(c => c.value).join(', ');
  } else {
    var radio = document.querySelector('.pq-form-correct-choice:checked');
    LQ._pqFormPrevCorrect = radio ? radio.value : '';
  }
  window.renderPqFormOptions();
};

window.renderPqFormOptions = function () {
  var container = document.getElementById('pq-options-container');
  if (!container) return;
  var type = document.getElementById('pq-form-type').value;
  var prevVal = LQ._pqFormPrevCorrect || '';
  var correctList = prevVal.split(',').map(s => s.trim());

  container.innerHTML = LQ._pqFormOptions.map(function (val, idx) {
    var letter = String.fromCharCode(65 + idx); // A, B, C, D, E, F
    var isChecked = false;
    if (type === 'mcq_multi') {
      isChecked = correctList.includes(letter);
    } else {
      isChecked = (letter === prevVal);
    }
    var checkedAttr = isChecked ? ' checked' : '';

    var inputType = type === 'mcq_multi' ? 'checkbox' : 'radio';
    var inputName = type === 'mcq_multi' ? 'pq-correct-chk' : 'pq-correct-radio';

    var removeBtn = LQ._pqFormOptions.length > 4 
      ? '<button type="button" class="admin-btn admin-btn-danger admin-btn-sm" style="padding:6px 10px;margin-left:8px;border-radius:8px;font-weight:700" onclick="window.removePqFormOption(' + idx + ')">✕</button>'
      : '';

    var activeBgStyle = isChecked ? 'background:#f0fdf4;border-color:#bbf7d0;' : 'background:#ffffff;border-color:#e2e8f0;';
    var inputHtml = '<input type="' + inputType + '" name="' + inputName + '" class="pq-form-correct-choice" value="' + letter + '"' + checkedAttr + ' onchange="window.updatePqFormCorrectChoiceState()" style="cursor:pointer;width:20px;height:20px;accent-color:#22c55e;margin:0">';

    return '<div class="pq-option-row" style="display:flex;gap:12px;align-items:center;margin-bottom:10px;padding:8px 12px;border:1px solid #e2e8f0;border-radius:10px;transition:all 0.2s;' + activeBgStyle + '">' +
      inputHtml +
      '<span style="display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:8px;background:' + (isChecked ? '#dcfce7' : '#f1f5f9') + ';color:' + (isChecked ? '#166534' : '#475569') + ';font-weight:800;font-size:13px;transition:all 0.2s">' + letter + '</span>' +
      '<input type="text" class="admin-search-input" style="flex:1;border:1px solid #cbd5e1;background:#ffffff;border-radius:8px;padding:8px 12px;font-size:14px" value="' + LQ.esc(val) + '" placeholder="Option ' + (idx + 1) + '" required oninput="window.updatePqFormOptionText(' + idx + ', this.value)">' +
      removeBtn +
      '</div>';
  }).join('');
  
  var addBtn = document.getElementById('btn-add-pq-option');
  if (addBtn) {
    addBtn.style.display = LQ._pqFormOptions.length < 6 ? 'block' : 'none';
  }
};

window.togglePqFormTypeView = function () {
  var type = document.getElementById('pq-form-type').value;
  var optSection = document.getElementById('pq-options-section');
  var correctAnsSection = document.getElementById('pq-correct-answer-section');
  var correctAnsContainer = document.getElementById('pq-correct-answer-container');
  
  if (type === 'mcq' || type === 'mcq_multi') {
    if (optSection) optSection.style.display = 'block';
    if (correctAnsSection) correctAnsSection.style.display = 'none';
    window.renderPqFormOptions();
  } else {
    if (optSection) optSection.style.display = 'none';
    if (correctAnsSection) correctAnsSection.style.display = 'block';
    var textVal = LQ._pqFormPrevCorrect || '';
    correctAnsContainer.innerHTML = '<input type="text" id="pq-form-correct-answer-text" required class="admin-search-input" style="width:100%;box-sizing:border-box" placeholder="Enter correct answer text" value="' + LQ.esc(textVal) + '">';
  }
};

LQ.renderPracticeQuestionsBulkUploadForm = function () {
  var formHtml =
    '<div class="admin-bulk-info">' +
      '<p>Upload a <code>PracticeQuestions.csv</code> or <code>.xlsx</code> file to import questions into synonym groups.</p>' +
      '<p style="font-size:12px;color:#64748b;margin-top:6px">Columns: <code>List, Group, Question, Option A, Option B, Option C, Option D, Answer Key, Category</code></p>' +
      '<a href="/api/admin/templates/practice-questions" class="admin-btn admin-btn-outline admin-btn-sm" style="margin-top:10px;display:inline-block;text-decoration:none">📥 Download Template</a>' +
    '</div>' +
    '<form id="pq-bulk-form" class="admin-form" onsubmit="LQ._submitPracticeQuestionsBulkUpload(event)">' +
      '<div class="admin-file-drop" id="pq-file-drop" onclick="document.getElementById(\'pq-file-input\').click()">' +
        '<input type="file" id="pq-file-input" accept=".csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" style="display:none" onchange="LQ._handlePracticeQuestionsFileSelect(event)" />' +
        '<p class="admin-file-drop-text" id="pq-file-name-display">📁 Click to select PracticeQuestions CSV/XLSX file</p>' +
      '</div>' +
      '<p id="pq-bulk-error" class="admin-error-msg" style="display:none"></p>' +
      '<div class="admin-form-actions" style="margin-top:20px">' +
        '<button type="button" class="admin-btn admin-btn-outline" onclick="LQ.closeAdminDrawer()">Cancel</button>' +
        '<button type="submit" class="admin-btn admin-btn-primary" id="pq-bulk-submit-btn">Upload & Save</button>' +
      '</div>' +
    '</form>';

  LQ._selectedPqFile = null;
  LQ.openAdminDrawer('📤 Bulk Upload Practice Questions', formHtml);
};

LQ._handlePracticeQuestionsFileSelect = function (e) {
  var file = e.target.files && e.target.files[0];
  if (!file) return;

  var display = document.getElementById('pq-file-name-display');
  if (display) display.textContent = 'Selected: ' + file.name + ' (' + (file.size / 1024).toFixed(1) + ' KB)';
  LQ._selectedPqFile = file;
};

LQ._submitPracticeQuestionsBulkUpload = async function (e) {
  e.preventDefault();
  var btn = document.getElementById('pq-bulk-submit-btn');
  var errEl = document.getElementById('pq-bulk-error');

  if (!LQ._selectedPqFile) {
    if (errEl) { errEl.textContent = 'Please select a CSV or XLSX file to upload.'; errEl.style.display = 'block'; }
    return;
  }

  if (errEl) errEl.style.display = 'none';
  if (btn) { btn.disabled = true; btn.textContent = 'Uploading...'; }

  var formData = new FormData();
  formData.append('file', LQ._selectedPqFile);

  try {
    var resp = await fetch('/api/admin/practice-questions/import', {
      method: 'POST',
      credentials: 'include',
      body: formData
    });
    var data = await resp.json();

    if (resp.ok) {
      if (data.practiceFailedRows && data.practiceFailedRows.length > 0) {
        LQ.toast('Imported ' + data.practiceSuccessCount + ' questions. ' + data.practiceFailedRows.length + ' failed. Downloading failed rows...');
        var csvHeaders = 'List,Group,Question,Option A,Option B,Option C,Option D,Answer Key,Category,Reason\n';
        var csvRows = data.practiceFailedRows.map(function (row) {
          return [
            '"' + (row.List || '').toString().replace(/"/g, '""') + '"',
            '"' + (row.Group || '').toString().replace(/"/g, '""') + '"',
            '"' + (row.Question || '').toString().replace(/"/g, '""') + '"',
            '"' + (row['Option A'] || '').toString().replace(/"/g, '""') + '"',
            '"' + (row['Option B'] || '').toString().replace(/"/g, '""') + '"',
            '"' + (row['Option C'] || '').toString().replace(/"/g, '""') + '"',
            '"' + (row['Option D'] || '').toString().replace(/"/g, '""') + '"',
            '"' + (row['Answer Key'] || '').toString().replace(/"/g, '""') + '"',
            '"' + (row.Category || '').toString().replace(/"/g, '""') + '"',
            '"' + (row.Reason || '').toString().replace(/"/g, '""') + '"'
          ].join(',');
        }).join('\n');
        
        var blob = new Blob([csvHeaders + csvRows], { type: 'text/csv;charset=utf-8;' });
        var link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.setAttribute('download', 'Failed_PracticeQuestions.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        LQ.toast('Practice questions import successful!');
      }
      LQ.closeAdminDrawer();
      if (typeof LQ._loadAdminPracticeQuestions === 'function') LQ._loadAdminPracticeQuestions();
    } else {
      if (errEl) { errEl.textContent = data.error || 'Failed to import practice questions.'; errEl.style.display = 'block'; }
    }
  } catch (err) {
    if (errEl) { errEl.textContent = 'Network error. Please try again.'; errEl.style.display = 'block'; }
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Upload & Save'; }
  }
};


/* ══════════════════════════════════════════════════
   TEST MANAGEMENT PAGE
   ══════════════════════════════════════════════════ */

LQ._testPage = 1;
LQ._testSearch = '';
LQ._testStatusFilter = '';
LQ._testOrgFilter = 'all';
LQ._testSections = [];        // sections array for create/edit
LQ._editTestId = null;
LQ._allAddedQuestionIds = {}; // track questionIds across all sections

LQ.renderAdminTestsPage = async function () {
  var wrap = document.getElementById('admin-tests-wrap');
  if (!wrap) return;

  var state = LQ.Store.getState();
  var user = state.user;
  if (!user) return;
  var isSuperAdmin = user.role === 'super_admin';

  if (!document.getElementById('admin-dropdown-menu-styles')) {
    var style = document.createElement('style');
    style.id = 'admin-dropdown-menu-styles';
    style.innerHTML =
      '.admin-actions-dropdown-content button:hover { background-color: #f1f5f9 !important; }' +
      '.admin-actions-dropdown-content button.admin-btn-delete:hover { background-color: #fee2e2 !important; }';
    document.head.appendChild(style);
  }

  if (!window._testActionsMenuListenerAdded) {
    window._testActionsMenuListenerAdded = true;
    document.addEventListener('click', function () {
      var allMenus = document.querySelectorAll('.admin-actions-dropdown-content');
      allMenus.forEach(function (m) { m.style.display = 'none'; });
    });
  }

  wrap.innerHTML =
    '<div class="admin-page-header">' +
      '<h2 class="admin-page-title">📝 Tests</h2>' +
      '<div class="admin-header-actions">' +
        '<button type="button" class="admin-btn admin-btn-primary" onclick="LQ.openCreateTestDrawer()">+ Create Test</button>' +
      '</div>' +
    '</div>' +
    '<div class="admin-search-bar" style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">' +
      '<input type="text" id="admin-test-search" class="admin-search-input" style="flex:1;min-width:200px" placeholder="Search by test title..." oninput="LQ._debounceTestSearch()" />' +
      (isSuperAdmin ? '<select id="admin-test-org-filter" class="admin-search-input" style="width:auto;min-width:160px" onchange="LQ._testOrgFilter=this.value;LQ._testPage=1;LQ._loadTests()"><option value="all">All Organizations</option></select>' : '') +
      '<select id="admin-test-status-filter" class="admin-search-input" style="width:auto;min-width:130px" onchange="LQ._testStatusFilter=this.value;LQ._testPage=1;LQ._loadTests()">' +
        '<option value="">Status: All</option>' +
        '<option value="draft">Draft</option>' +
        '<option value="assigned">Assigned</option>' +
        '<option value="active">Active</option>' +
        '<option value="expired">Expired</option>' +
        '<option value="disabled">Disabled</option>' +
      '</select>' +
    '</div>' +
    '<div id="admin-tests-table-wrap" class="admin-table-wrap"><p class="admin-loading">Loading tests...</p></div>' +
    '<div id="admin-tests-pagination" class="admin-pagination"></div>';

  LQ._testPage = 1;
  LQ._testSearch = '';
  LQ._testStatusFilter = '';

  if (isSuperAdmin) {
    try {
      var resp = await fetch('/api/admin/orgs', { credentials: 'include' });
      var data = await resp.json();
      if (data.ok && data.orgs) {
        var sel = document.getElementById('admin-test-org-filter');
        if (sel) {
          var opts = '<option value="all">All Organizations</option>';
          data.orgs.forEach(function (o) {
            opts += '<option value="' + o._id + '">' + LQ.esc(o.name) + '</option>';
          });
          sel.innerHTML = opts;
        }
      }
    } catch (e) {}
  }

  LQ._loadTests();
};

LQ._debounceTestSearch = (function () {
  var timer;
  return function () {
    clearTimeout(timer);
    timer = setTimeout(function () {
      LQ._testSearch = (document.getElementById('admin-test-search') || {}).value || '';
      LQ._testPage = 1;
      LQ._loadTests();
    }, 300);
  };
})();

LQ._loadTests = async function () {
  var tableWrap = document.getElementById('admin-tests-table-wrap');
  var pagWrap = document.getElementById('admin-tests-pagination');
  if (!tableWrap) return;

  var params = 'page=' + LQ._testPage + '&limit=20';
  if (LQ._testSearch) params += '&search=' + encodeURIComponent(LQ._testSearch);
  if (LQ._testStatusFilter) params += '&status=' + encodeURIComponent(LQ._testStatusFilter);
  if (LQ._testOrgFilter && LQ._testOrgFilter !== 'all') params += '&orgId=' + encodeURIComponent(LQ._testOrgFilter);

  try {
    var resp = await fetch('/api/admin/tests?' + params, { credentials: 'include' });
    var data = await resp.json();
    if (!resp.ok) { tableWrap.innerHTML = '<p class="admin-loading">' + (data.error || 'Error loading tests.') + '</p>'; return; }

    var tests = data.tests || [];
    var now = Date.now();

    if (!tests.length) {
      tableWrap.innerHTML = '<p class="admin-loading" style="color:#64748b">No tests found.</p>';
      if (pagWrap) pagWrap.innerHTML = '';
      return;
    }

    var rows = tests.map(function (t) {
      var sectionCount = (t.sections || []).length;
      var startMs = t.startTime ? new Date(t.startTime).getTime() : 0;
      var endMs = t.endTime ? new Date(t.endTime).getTime() : 0;

      var statusStr = 'Draft';
      var statusClass = 'admin-badge-draft';
      if (t.isDisabled) {
        statusStr = 'Disabled';
        statusClass = 'admin-badge-inactive';
      } else if (t.isAssigned && startMs && endMs) {
        if (now < startMs) { statusStr = 'Assigned'; statusClass = 'admin-badge-assigned'; }
        else if (now >= startMs && now <= endMs) { statusStr = 'Active'; statusClass = 'admin-badge-active'; }
        else { statusStr = 'Expired'; statusClass = 'admin-badge-expired'; }
      }

      var startStr = t.startTime ? new Date(t.startTime).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' }) : '—';
      var endStr = t.endTime ? new Date(t.endTime).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' }) : '—';
      var totalDurMins = Math.ceil((t.totalDurationSec || 0) / 60);
      var titleTrunc = (t.title || '').length > 40 ? LQ.esc(t.title.substring(0, 40)) + '...' : LQ.esc(t.title);

      var canEdit = !t.isAssigned || !t.startTime || now < startMs;
      var canDisable = !t.isAssigned || !t.startTime || now < startMs;

      return (
        '<tr>' +
          '<td><a href="#" onclick="event.preventDefault();LQ.openTestSummaryDrawer(\'' + t._id + '\')" style="color:#2563eb;font-weight:600;text-decoration:none" title="' + LQ.esc(t.title) + '">' + titleTrunc + '</a></td>' +
          '<td>' + sectionCount + '</td>' +
          '<td>' + (t.totalQuestions || 0) + '</td>' +
          '<td>' + (t.totalMarks || 0) + '</td>' +
          '<td>' + totalDurMins + ' min</td>' +
          '<td>' + startStr + '</td>' +
          '<td>' + endStr + '</td>' +
          '<td><span class="admin-status-badge ' + statusClass + '">' + statusStr + '</span></td>' +
          '<td style="position:relative">' +
            '<div class="admin-dropdown-menu-wrapper" style="position:relative;display:inline-block">' +
              '<button type="button" class="admin-btn admin-btn-sm" style="font-size:16px;padding:2px 8px;font-weight:bold" onclick="event.stopPropagation();LQ.toggleTestActionsMenu(this,\'' + t._id + '\')">⋮</button>' +
              '<div id="actions-menu-' + t._id + '" class="admin-actions-dropdown-content" style="display:none;position:absolute;right:0;top:30px;background:#fff;box-shadow:0 10px 25px -5px rgba(0,0,0,0.1),0 8px 10px -6px rgba(0,0,0,0.1);border:1px solid #e2e8f0;border-radius:8px;z-index:9999;min-width:140px;padding:6px 0;text-align:left">' +
                (canEdit ? '<button type="button" style="display:block;width:100%;padding:8px 12px;background:none;border:none;text-align:left;font-size:13px;cursor:pointer;color:#334155" onclick="LQ.openEditTestDrawer(\'' + t._id + '\')">📝 Edit</button>' : '') +
                '<button type="button" style="display:block;width:100%;padding:8px 12px;background:none;border:none;text-align:left;font-size:13px;cursor:pointer;color:#334155" onclick="LQ.openTestAssignDrawer(\'' + t._id + '\')">📅 Assign</button>' +
                '<button type="button" style="display:block;width:100%;padding:8px 12px;background:none;border:none;text-align:left;font-size:13px;cursor:pointer;color:#334155" onclick="LQ.openTestCloneModal(\'' + t._id + '\')">👥 Clone</button>' +
                '<button type="button" style="display:block;width:100%;padding:8px 12px;background:none;border:none;text-align:left;font-size:13px;cursor:pointer;color:#334155" onclick="LQ.openTestConfigDrawer(\'' + t._id + '\')">⚙️ Config</button>' +
                '<button type="button" style="display:block;width:100%;padding:8px 12px;background:none;border:none;text-align:left;font-size:13px;cursor:pointer;color:#334155" onclick="LQ.toggleTestDisable(\'' + t._id + '\',' + (t.isDisabled ? 'false' : 'true') + ')">' + (t.isDisabled ? '🟢 Enable' : '🔴 Disable') + '</button>' +
                (canEdit ? '<button type="button" class="admin-btn-delete" style="display:block;width:100%;padding:8px 12px;background:none;border:none;text-align:left;font-size:13px;cursor:pointer;color:#dc2626" onclick="LQ.deleteTest(\'' + t._id + '\')">🗑️ Delete</button>' : '') +
              '</div>' +
            '</div>' +
          '</td>' +
        '</tr>'
      );
    }).join('');

    tableWrap.innerHTML =
      '<table class="admin-table"><thead><tr>' +
        '<th>Title</th><th>Sections</th><th>Qs</th><th>Marks</th><th>Duration</th><th>Start</th><th>End</th><th>Status</th><th>Actions</th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table>';

    // Pagination
    if (pagWrap) {
      var totalPages = data.pages || 1;
      if (totalPages <= 1) { pagWrap.innerHTML = ''; return; }
      var btns = '';
      for (var p = 1; p <= totalPages; p++) {
        btns += '<button type="button" class="admin-btn admin-btn-sm' + (p === data.page ? ' admin-btn-primary' : '') + '" onclick="LQ._testPage=' + p + ';LQ._loadTests()">' + p + '</button>';
      }
      pagWrap.innerHTML = btns;
    }
  } catch (err) {
    tableWrap.innerHTML = '<p class="admin-loading">Network error loading tests.</p>';
  }
};

/* ── CREATE / EDIT TEST DRAWER ── */

LQ.openCreateTestDrawer = function () {
  LQ._editTestId = null;
  LQ._testSections = [{ name: 'Section 1', questions: [] }];
  LQ._allAddedQuestionIds = {};
  LQ._renderTestFormDrawer('Create Test');
};

LQ.openEditTestDrawer = async function (id) {
  try {
    var resp = await fetch('/api/admin/tests/' + id, { credentials: 'include' });
    var data = await resp.json();
    if (!resp.ok || !data.test) { LQ.toast(data.error || 'Failed to load test.'); return; }

    LQ._editTestId = id;
    LQ._testSections = JSON.parse(JSON.stringify(data.test.sections || []));
    LQ._allAddedQuestionIds = {};
    LQ._testSections.forEach(function (sec) {
      (sec.questions || []).forEach(function (q) {
        if (q.questionId) LQ._allAddedQuestionIds[q.questionId] = true;
      });
    });

    LQ._renderTestFormDrawer('Edit Test');

    // Pre-populate fields
    setTimeout(function () {
      var t = data.test;
      var el = document.getElementById('test-title');
      if (el) el.value = t.title || '';
      var desc = document.getElementById('test-description');
      if (desc) desc.value = t.description || '';
      var sr = document.getElementById('test-show-result');
      if (sr) sr.checked = t.showResult !== false;
      var sa = document.getElementById('test-show-answer');
      if (sa) sa.checked = t.showAnswer !== false;
      var ml = document.getElementById('test-malpractice-limit');
      if (ml) ml.value = t.malpracticeLimit || 3;
      var pp = document.getElementById('test-pass-percentage');
      if (pp) pp.value = t.passPercentage !== undefined ? t.passPercentage : 30;
      var orgSel = document.getElementById('test-org-select');
      if (orgSel) orgSel.value = t.orgId || '6a6336008e7335277d4b6ab0';
      LQ._renderTestSectionsUI();
    }, 100);
  } catch (err) {
    LQ.toast('Error loading test.');
  }
};

LQ._renderTestFormDrawer = function (title) {
  var state = LQ.Store.getState();
  var user = state.user || {};
  var isSuperAdmin = user.role === 'super_admin';

  var orgField = '';
  if (isSuperAdmin) {
    orgField =
      '<div class="admin-form-field" style="grid-column:1/-1">' +
        '<label>Organization</label>' +
        '<select id="test-org-select" disabled style="background:#f1f5f9;cursor:not-allowed;color:#64748b;border-color:#e2e8f0;width:100%;padding:8px;border-radius:6px">' +
          '<option value="6a6336008e7335277d4b6ab0" selected>Panimalar</option>' +
        '</select>' +
      '</div>';
  }

  var html =
    '<form id="test-form" onsubmit="LQ._submitTestForm(event)">' +
      '<div class="admin-form-grid" style="grid-template-columns:1fr 1fr;gap:14px">' +
        '<div class="admin-form-field" style="grid-column:1/-1">' +
          '<label>Test Title <span class="req">*</span></label>' +
          '<input type="text" id="test-title" required maxlength="200" placeholder="Enter unique test title" onblur="LQ._checkTestTitleUnique()" />' +
          '<div id="test-title-status" style="font-size:12px;margin-top:4px;display:none"></div>' +
        '</div>' +
        '<div class="admin-form-field" style="grid-column:1/-1">' +
          '<label>Description</label>' +
          '<textarea id="test-description" rows="2" placeholder="Optional description"></textarea>' +
        '</div>' +
        orgField +
        '<div class="admin-form-field">' +
          '<label style="display:flex;align-items:center;gap:8px"><input type="checkbox" id="test-show-result" checked /> Show Result to Student</label>' +
        '</div>' +
        '<div class="admin-form-field">' +
          '<label style="display:flex;align-items:center;gap:8px"><input type="checkbox" id="test-show-answer" checked /> Show Answers to Student</label>' +
        '</div>' +
        '<div class="admin-form-field">' +
          '<label>Malpractice Limit <span class="req">*</span></label>' +
          '<input type="number" id="test-malpractice-limit" required min="0" value="3" />' +
        '</div>' +
        '<div class="admin-form-field">' +
          '<label>Pass Percentage (%) <span class="req">*</span></label>' +
          '<input type="number" id="test-pass-percentage" required min="0" max="100" value="30" />' +
        '</div>' +
      '</div>' +

      '<div style="margin-top:24px">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">' +
          '<h3 style="margin:0;font-size:16px;font-weight:700;color:#0f172a">📋 Sections</h3>' +
          '<button type="button" class="admin-btn admin-btn-outline" onclick="LQ._addTestSection()">+ Add Section</button>' +
        '</div>' +
        '<div id="test-sections-container"></div>' +
      '</div>' +

      '<div id="test-form-error" style="display:none;color:#dc2626;margin-top:12px;font-size:13px;font-weight:600"></div>' +

      '<div class="admin-form-actions" style="margin-top:20px">' +
        '<button type="submit" id="test-submit-btn" class="admin-btn admin-btn-primary">' + (LQ._editTestId ? 'Update Test' : 'Save Test') + '</button>' +
        '<button type="button" class="admin-btn admin-btn-outline" onclick="LQ.closeAdminDrawer()">Cancel</button>' +
      '</div>' +
    '</form>';

  LQ.openAdminDrawer(title, html);
  setTimeout(function () { LQ._renderTestSectionsUI(); }, 50);
};

LQ._checkTestTitleUnique = async function () {
  var el = document.getElementById('test-title');
  var statusEl = document.getElementById('test-title-status');
  if (!el || !statusEl) return;
  var title = el.value.trim();
  if (!title) { statusEl.style.display = 'none'; return; }

  try {
    var url = '/api/admin/tests/check-title?title=' + encodeURIComponent(title);
    if (LQ._editTestId) url += '&excludeId=' + LQ._editTestId;
    var resp = await fetch(url, { credentials: 'include' });
    var data = await resp.json();
    if (data.exists) {
      statusEl.textContent = '⚠️ This title is already taken.';
      statusEl.style.color = '#dc2626';
      statusEl.style.display = 'block';
    } else {
      statusEl.textContent = '✓ Title is available.';
      statusEl.style.color = '#16a34a';
      statusEl.style.display = 'block';
    }
  } catch (e) {
    statusEl.style.display = 'none';
  }
};

LQ._addTestSection = function () {
  LQ._testSections.push({ name: 'Section ' + (LQ._testSections.length + 1), questions: [] });
  LQ._renderTestSectionsUI();
};

LQ._removeTestSection = function (idx) {
  var sec = LQ._testSections[idx];
  if (sec && sec.questions) {
    sec.questions.forEach(function (q) { delete LQ._allAddedQuestionIds[q.questionId]; });
  }
  LQ._testSections.splice(idx, 1);
  LQ._renderTestSectionsUI();
};

LQ._moveTestSection = function (idx, dir) {
  var newIdx = idx + dir;
  if (newIdx < 0 || newIdx >= LQ._testSections.length) return;
  var tmp = LQ._testSections[idx];
  LQ._testSections[idx] = LQ._testSections[newIdx];
  LQ._testSections[newIdx] = tmp;
  LQ._renderTestSectionsUI();
};

LQ._renderTestSectionsUI = function () {
  var container = document.getElementById('test-sections-container');
  if (!container) return;

  if (!LQ._testSections.length) {
    container.innerHTML = '<p style="color:#94a3b8;font-size:13px;text-align:center;padding:20px">No sections added. Click "+ Add Section" to begin.</p>';
    return;
  }

  container.innerHTML = LQ._testSections.map(function (sec, sIdx) {
    var qCount = (sec.questions || []).length;
    var secMarks = 0;
    var secDurSec = 0;
    (sec.questions || []).forEach(function (q) {
      secMarks += q.marks || 0;
      var d = q.duration || 0;
      var dt = q.durationType || 'minutes';
      if (dt === 'hours') secDurSec += d * 3600;
      else if (dt === 'minutes') secDurSec += d * 60;
      else secDurSec += d;
    });
    var secDurMins = Math.ceil(secDurSec / 60);

    var qRows = (sec.questions || []).map(function (q, qIdx) {
      var typeLabel = q.type === 'mcq' ? 'MCQ' : q.type === 'fib' ? 'FIB' : q.type === 'passage' ? 'Passage' : q.type;
      var textSnip = (q.questionText || '').length > 60 ? LQ.esc(q.questionText.substring(0, 60)) + '...' : LQ.esc(q.questionText);
      return (
        '<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:6px">' +
          '<span style="font-size:12px;background:#e0e7ff;color:#3730a3;padding:2px 6px;border-radius:4px;font-weight:600">' + typeLabel + '</span>' +
          '<span style="flex:1;font-size:13px;color:#334155;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + textSnip + '</span>' +
          '<input type="number" min="1" value="' + (q.marks || 1) + '" style="width:50px;text-align:center;font-size:12px;padding:3px;border:1px solid #cbd5e1;border-radius:4px" title="Marks" onchange="LQ._updateTestQField(' + sIdx + ',' + qIdx + ',\'marks\',this.value)" />' +
          '<input type="number" min="1" value="' + (q.duration || 1) + '" style="width:50px;text-align:center;font-size:12px;padding:3px;border:1px solid #cbd5e1;border-radius:4px" title="Duration" onchange="LQ._updateTestQField(' + sIdx + ',' + qIdx + ',\'duration\',this.value)" />' +
          '<select style="font-size:11px;padding:3px;border:1px solid #cbd5e1;border-radius:4px" title="Duration Type" onchange="LQ._updateTestQField(' + sIdx + ',' + qIdx + ',\'durationType\',this.value)">' +
            '<option value="seconds"' + (q.durationType === 'seconds' ? ' selected' : '') + '>sec</option>' +
            '<option value="minutes"' + (q.durationType === 'minutes' ? ' selected' : '') + '>min</option>' +
            '<option value="hours"' + (q.durationType === 'hours' ? ' selected' : '') + '>hr</option>' +
          '</select>' +
          '<button type="button" class="admin-btn admin-btn-sm admin-btn-danger-outline" onclick="LQ._removeTestQuestion(' + sIdx + ',' + qIdx + ')" title="Remove">✕</button>' +
        '</div>'
      );
    }).join('');

    return (
      '<div style="border:1px solid #e2e8f0;border-radius:12px;padding:16px;margin-bottom:16px;background:#fff">' +
        '<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">' +
          '<input type="text" value="' + LQ.esc(sec.name) + '" placeholder="Section name" style="flex:1;font-size:14px;font-weight:600;padding:6px 10px;border:1px solid #cbd5e1;border-radius:6px" onchange="LQ._testSections[' + sIdx + '].name=this.value" />' +
          '<span style="font-size:12px;color:#64748b">' + qCount + ' Qs · ' + secMarks + ' marks · ' + secDurMins + ' min</span>' +
          '<button type="button" class="admin-btn admin-btn-sm" onclick="LQ._moveTestSection(' + sIdx + ',-1)" title="Move up">↑</button>' +
          '<button type="button" class="admin-btn admin-btn-sm" onclick="LQ._moveTestSection(' + sIdx + ',1)" title="Move down">↓</button>' +
          '<button type="button" class="admin-btn admin-btn-sm admin-btn-danger-outline" onclick="LQ._removeTestSection(' + sIdx + ')" title="Remove section">🗑️</button>' +
        '</div>' +
        '<div>' + (qRows || '<p style="color:#94a3b8;font-size:12px;text-align:center">No questions added yet.</p>') + '</div>' +
        '<div style="display:flex;gap:8px;margin-top:10px">' +
          '<button type="button" class="admin-btn admin-btn-outline" style="font-size:12px" onclick="LQ._openTestQuestionPicker(' + sIdx + ',\'manual\')">+ Add Manual</button>' +
          '<button type="button" class="admin-btn admin-btn-outline" style="font-size:12px" onclick="LQ._openTestQuestionPicker(' + sIdx + ',\'auto\')">⚡ Add Auto</button>' +
        '</div>' +
      '</div>'
    );
  }).join('');
};

LQ._updateTestQField = function (sIdx, qIdx, field, val) {
  if (!LQ._testSections[sIdx] || !LQ._testSections[sIdx].questions[qIdx]) return;
  if (field === 'marks' || field === 'duration') {
    LQ._testSections[sIdx].questions[qIdx][field] = parseInt(val, 10) || 1;
  } else {
    LQ._testSections[sIdx].questions[qIdx][field] = val;
  }
};

LQ._removeTestQuestion = function (sIdx, qIdx) {
  var q = LQ._testSections[sIdx].questions[qIdx];
  if (q && q.questionId) delete LQ._allAddedQuestionIds[q.questionId];
  LQ._testSections[sIdx].questions.splice(qIdx, 1);
  LQ._renderTestSectionsUI();
};

/* ── QUESTION PICKER MODAL ── */

LQ._pickerSectionIdx = 0;
LQ._pickerMode = 'manual';
LQ._pickerPage = 1;
LQ._pickerFilters = {};
LQ._pickerSelected = {};

LQ._openTestQuestionPicker = function (sIdx, mode) {
  LQ._pickerSectionIdx = sIdx;
  LQ._pickerMode = mode || 'manual';
  LQ._pickerPage = 1;
  LQ._pickerFilters = {};
  LQ._pickerSelected = {};

  var modalHtml =
    '<div id="test-qpicker-modal" style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:999999;display:flex;align-items:center;justify-content:center">' +
      '<div style="background:#fff;border-radius:16px;width:90%;max-width:800px;max-height:85vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,0.3)">' +
        '<div style="padding:16px 20px;border-bottom:1px solid #e2e8f0;display:flex;align-items:center;justify-content:space-between">' +
          '<h3 style="margin:0;font-size:16px;font-weight:700">' + (mode === 'auto' ? '⚡ Auto-Add Questions' : '📋 Pick Questions') + '</h3>' +
          '<button type="button" onclick="LQ._closeTestQPicker()" style="background:none;border:none;font-size:20px;cursor:pointer;color:#64748b">✕</button>' +
        '</div>' +
        '<div style="padding:12px 20px;border-bottom:1px solid #e2e8f0;display:flex;gap:8px;flex-wrap:wrap;align-items:center">' +
          '<select id="qpicker-type" class="admin-search-input" style="width:auto;min-width:100px"><option value="">Type: All</option><option value="mcq">MCQ</option><option value="fib">FIB</option><option value="passage">Passage</option><option value="reading_listening">Reading</option><option value="listen_repeat">Listen</option><option value="jumbled_sentence">Jumbled</option><option value="story_retelling">Story</option></select>' +
          '<select id="qpicker-difficulty" class="admin-search-input" style="width:auto;min-width:100px"><option value="">Difficulty: All</option><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select>' +
          '<input type="text" id="qpicker-search" class="admin-search-input" placeholder="Search..." style="flex:1;min-width:120px" />' +
          (mode === 'auto' ? '<input type="number" id="qpicker-auto-count" min="1" max="100" value="10" style="width:60px;padding:6px;border:1px solid #cbd5e1;border-radius:6px;text-align:center" title="Count" />' : '') +
          '<button type="button" class="admin-btn admin-btn-primary" style="font-size:12px" onclick="LQ._pickerPage=1;LQ._loadPickerQuestions()">' + (mode === 'auto' ? '⚡ Auto Select' : '🔍 Search') + '</button>' +
        '</div>' +
        '<div id="qpicker-results" style="flex:1;overflow-y:auto;max-height:480px;padding:12px 20px"></div>' +
        '<div style="padding:12px 20px;border-top:1px solid #e2e8f0;display:flex;align-items:center;justify-content:space-between">' +
          '<div id="qpicker-pagination" style="display:flex;gap:4px"></div>' +
          (mode === 'manual' ? '<button type="button" class="admin-btn admin-btn-primary" onclick="LQ._addPickerSelectedQuestions()">Add Selected</button>' : '<span></span>') +
        '</div>' +
      '</div>' +
    '</div>';

  var existing = document.getElementById('test-qpicker-modal');
  if (existing) existing.remove();
  document.body.insertAdjacentHTML('beforeend', modalHtml);
  LQ._loadPickerQuestions();
};

LQ._closeTestQPicker = function () {
  var modal = document.getElementById('test-qpicker-modal');
  if (modal) modal.remove();
};

LQ._loadPickerQuestions = async function () {
  var resultsEl = document.getElementById('qpicker-results');
  var pagEl = document.getElementById('qpicker-pagination');
  if (!resultsEl) return;

  var type = (document.getElementById('qpicker-type') || {}).value || '';
  var diff = (document.getElementById('qpicker-difficulty') || {}).value || '';
  var search = (document.getElementById('qpicker-search') || {}).value || '';

  var params = 'page=' + LQ._pickerPage + '&limit=20&status=active';
  if (type) params += '&type=' + type;
  if (diff) params += '&difficulty=' + diff;
  if (search) params += '&search=' + encodeURIComponent(search);

  resultsEl.innerHTML = '<p style="text-align:center;color:#94a3b8;padding:20px">Loading...</p>';

  try {
    var resp = await fetch('/api/admin/questions?' + params, { credentials: 'include' });
    var data = await resp.json();
    if (!resp.ok) { resultsEl.innerHTML = '<p style="color:#dc2626">' + (data.error || 'Error') + '</p>'; return; }

    var questions = data.questions || [];

    if (LQ._pickerMode === 'auto') {
      var autoCount = parseInt((document.getElementById('qpicker-auto-count') || {}).value, 10) || 10;
      var available = questions.filter(function (q) { return !LQ._allAddedQuestionIds[q._id]; });
      // Shuffle and take autoCount
      for (var i = available.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var tmp = available[i]; available[i] = available[j]; available[j] = tmp;
      }
      var picked = available.slice(0, autoCount);
      if (!picked.length) {
        resultsEl.innerHTML = '<p style="text-align:center;color:#94a3b8;padding:20px">No new questions available matching these filters.</p>';
        return;
      }

      picked.forEach(function (q) {
        LQ._testSections[LQ._pickerSectionIdx].questions.push({
          questionId: q._id,
          questionText: q.questionText,
          type: q.type,
          mcqType: q.mcqType,
          options: q.options || [],
          correctAnswer: q.correctAnswer || '',
          correctAnswers: q.correctAnswers || [],
          subQuestions: q.subQuestions || [],
          playLimit: q.playLimit || 1,
          marks: q.marks || 1,
          duration: q.duration || 1,
          durationType: q.durationType || 'minutes',
          explanation: q.explanation || '',
          difficulty: q.difficulty || 'medium',
          category: q.category || 'General',
        });
        LQ._allAddedQuestionIds[q._id] = true;
      });

      LQ._closeTestQPicker();
      LQ._renderTestSectionsUI();
      LQ.toast('Added ' + picked.length + ' questions automatically!');
      return;
    }

    // Manual mode — render selectable list
    if (!questions.length) {
      resultsEl.innerHTML = '<p style="text-align:center;color:#94a3b8;padding:20px">No questions found.</p>';
      if (pagEl) pagEl.innerHTML = '';
      return;
    }

    resultsEl.innerHTML = questions.map(function (q) {
      var isAdded = !!LQ._allAddedQuestionIds[q._id];
      var isSelected = !!LQ._pickerSelected[q._id];
      var textSnip = (q.questionText || '').length > 80 ? LQ.esc(q.questionText.substring(0, 80)) + '...' : LQ.esc(q.questionText);
      var typeLabel = q.type === 'mcq' ? 'MCQ' : q.type === 'fib' ? 'FIB' : q.type === 'passage' ? 'Passage' : q.type;
      var bg = isAdded ? '#f1f5f9' : (isSelected ? '#eff6ff' : '#fff');
      var border = isSelected ? '2px solid #3b82f6' : '1px solid #e2e8f0';

      return (
        '<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:' + bg + ';border:' + border + ';border-radius:8px;margin-bottom:6px;cursor:' + (isAdded ? 'not-allowed' : 'pointer') + ';opacity:' + (isAdded ? '0.5' : '1') + '" onclick="' + (isAdded ? '' : 'LQ._togglePickerSelect(\'' + q._id + '\')') + '">' +
          '<input type="checkbox" ' + (isSelected ? 'checked' : '') + ' ' + (isAdded ? 'disabled' : '') + ' style="pointer-events:none" />' +
          '<span style="font-size:11px;background:#e0e7ff;color:#3730a3;padding:2px 6px;border-radius:4px;font-weight:600">' + typeLabel + '</span>' +
          '<span style="flex:1;font-size:13px;color:#334155">' + textSnip + '</span>' +
          '<span style="font-size:11px;color:#64748b">' + (q.marks || 1) + ' marks</span>' +
          '<span style="font-size:11px;color:#64748b">' + (q.duration || 1) + ' ' + (q.durationType || 'min') + '</span>' +
          (isAdded ? '<span style="font-size:10px;color:#dc2626;font-weight:600">Already added</span>' : '') +
        '</div>'
      );
    }).join('');

    // Pagination
    if (pagEl) {
      var totalPages = data.pages || 1;
      if (totalPages <= 1) { pagEl.innerHTML = ''; }
      else {
        var btns = '';
        for (var p = 1; p <= totalPages; p++) {
          btns += '<button type="button" class="admin-btn admin-btn-sm' + (p === data.page ? ' admin-btn-primary' : '') + '" onclick="LQ._pickerPage=' + p + ';LQ._loadPickerQuestions()">' + p + '</button>';
        }
        pagEl.innerHTML = btns;
      }
    }
  } catch (err) {
    resultsEl.innerHTML = '<p style="color:#dc2626">Network error.</p>';
  }
};

LQ._togglePickerSelect = function (qId) {
  if (LQ._pickerSelected[qId]) delete LQ._pickerSelected[qId];
  else LQ._pickerSelected[qId] = true;
  LQ._loadPickerQuestions();
};

LQ._addPickerSelectedQuestions = async function () {
  var ids = Object.keys(LQ._pickerSelected);
  if (!ids.length) { LQ.toast('Select at least one question.'); return; }

  // Fetch full question data for selected IDs
  var added = 0;
  for (var i = 0; i < ids.length; i++) {
    var qId = ids[i];
    if (LQ._allAddedQuestionIds[qId]) continue;
    try {
      var resp = await fetch('/api/admin/questions/' + qId, { credentials: 'include' });
      var data = await resp.json();
      if (resp.ok && data.question) {
        var q = data.question;
        LQ._testSections[LQ._pickerSectionIdx].questions.push({
          questionId: q._id,
          questionText: q.questionText,
          type: q.type,
          mcqType: q.mcqType,
          options: q.options || [],
          correctAnswer: q.correctAnswer || '',
          correctAnswers: q.correctAnswers || [],
          subQuestions: q.subQuestions || [],
          playLimit: q.playLimit || 1,
          marks: q.marks || 1,
          duration: q.duration || 1,
          durationType: q.durationType || 'minutes',
          explanation: q.explanation || '',
          difficulty: q.difficulty || 'medium',
          category: q.category || 'General',
        });
        LQ._allAddedQuestionIds[qId] = true;
        added++;
      }
    } catch (e) {}
  }

  LQ._closeTestQPicker();
  LQ._renderTestSectionsUI();
  LQ.toast('Added ' + added + ' question(s).');
};

/* ── SUBMIT CREATE / EDIT TEST ── */

LQ._submitTestForm = async function (e) {
  e.preventDefault();
  var errEl = document.getElementById('test-form-error');
  var btn = document.getElementById('test-submit-btn');

  var title = (document.getElementById('test-title') || {}).value || '';
  var description = (document.getElementById('test-description') || {}).value || '';
  var showResult = !!(document.getElementById('test-show-result') || {}).checked;
  var showAnswer = !!(document.getElementById('test-show-answer') || {}).checked;
  var malpracticeLimit = parseInt((document.getElementById('test-malpractice-limit') || {}).value, 10);
  if (isNaN(malpracticeLimit) || malpracticeLimit < 0) malpracticeLimit = 3;
  var passPercentage = parseFloat((document.getElementById('test-pass-percentage') || {}).value);
  if (isNaN(passPercentage) || passPercentage < 0) passPercentage = 30;

  if (!title.trim()) {
    if (errEl) { errEl.textContent = 'Test title is required.'; errEl.style.display = 'block'; }
    return;
  }

  // Read section names from DOM inputs
  var sectionNameInputs = document.querySelectorAll('#test-sections-container input[type="text"]');
  sectionNameInputs.forEach(function (inp, idx) {
    if (LQ._testSections[idx]) LQ._testSections[idx].name = inp.value || ('Section ' + (idx + 1));
  });

  if (!LQ._testSections.length) {
    if (errEl) { errEl.textContent = 'At least one section is required.'; errEl.style.display = 'block'; }
    return;
  }

  for (var i = 0; i < LQ._testSections.length; i++) {
    if (!LQ._testSections[i].questions || !LQ._testSections[i].questions.length) {
      if (errEl) { errEl.textContent = 'Section "' + LQ._testSections[i].name + '" must have at least one question.'; errEl.style.display = 'block'; }
      return;
    }
  }

  var payload = {
    title: title.trim(),
    description: description.trim(),
    showResult: showResult,
    showAnswer: showAnswer,
    malpracticeLimit: malpracticeLimit,
    passPercentage: passPercentage,
    sections: LQ._testSections,
  };
  var orgIdSelect = document.getElementById('test-org-select');
  if (orgIdSelect) {
    payload.orgId = orgIdSelect.value;
  } else if (LQ._testOrgFilter && LQ._testOrgFilter !== 'all') {
    payload.orgId = LQ._testOrgFilter;
  }

  if (errEl) errEl.style.display = 'none';
  if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }

  try {
    var url = LQ._editTestId ? ('/api/admin/tests/' + LQ._editTestId) : '/api/admin/tests';
    var method = LQ._editTestId ? 'PUT' : 'POST';

    var resp = await fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    var data = await resp.json();

    if (resp.ok && data.ok) {
      LQ.toast(LQ._editTestId ? 'Test updated!' : 'Test created!');
      LQ.closeAdminDrawer();
      LQ._loadTests();
    } else {
      if (errEl) { errEl.textContent = data.error || 'Failed to save test.'; errEl.style.display = 'block'; }
    }
  } catch (err) {
    if (errEl) { errEl.textContent = 'Network error. Please try again.'; errEl.style.display = 'block'; }
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = LQ._editTestId ? 'Update Test' : 'Save Test'; }
  }
};

/* ── TEST SUMMARY DRAWER ── */

LQ.openTestSummaryDrawer = async function (id) {
  try {
    var resp = await fetch('/api/admin/tests/' + id, { credentials: 'include' });
    var data = await resp.json();
    if (!resp.ok || !data.test) { LQ.toast(data.error || 'Failed to load test.'); return; }
    var t = data.test;

    var totalDurMins = Math.ceil((t.totalDurationSec || 0) / 60);
    var startStr = t.startTime ? new Date(t.startTime).toLocaleString() : '—';
    var endStr = t.endTime ? new Date(t.endTime).toLocaleString() : '—';

    var sectionsHtml = (t.sections || []).map(function (sec, sIdx) {
      var qList = (sec.questions || []).map(function (q, qIdx) {
        var typeLabel = q.type === 'mcq' ? 'MCQ' : q.type === 'fib' ? 'FIB' : q.type;
        return '<div style="padding:6px 10px;border:1px solid #e2e8f0;border-radius:6px;margin-bottom:4px;font-size:13px;display:flex;gap:8px;align-items:center">' +
          '<span style="font-size:11px;background:#e0e7ff;color:#3730a3;padding:1px 5px;border-radius:3px;font-weight:600">' + typeLabel + '</span>' +
          '<span style="flex:1;color:#334155;white-space:pre-wrap">' + LQ.esc(q.questionText || '') + '</span>' +
          '<span style="font-size:11px;color:#64748b">' + (q.marks || 1) + 'm</span>' +
          '<span style="font-size:11px;color:#64748b">' + (q.duration || 1) + ' ' + (q.durationType || 'min') + '</span>' +
        '</div>';
      }).join('');

      return '<div style="margin-bottom:16px"><h4 style="margin:0 0 8px;font-size:14px;font-weight:600;color:#0f172a">📂 ' + LQ.esc(sec.name) + ' (' + (sec.questions || []).length + ' Qs)</h4>' + qList + '</div>';
    }).join('');

    var html =
      '<div style="font-family:sans-serif;color:#334155;line-height:1.6">' +
        '<div style="margin-bottom:16px"><h2 style="margin:0;font-size:18px;color:#0f172a">' + LQ.esc(t.title) + '</h2>' +
        (t.description ? '<p style="margin:4px 0 0;color:#64748b;font-size:13px">' + LQ.esc(t.description) + '</p>' : '') + '</div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px;font-size:13px">' +
          '<div><strong>Total Questions:</strong> ' + (t.totalQuestions || 0) + '</div>' +
          '<div><strong>Total Marks:</strong> ' + (t.totalMarks || 0) + '</div>' +
          '<div><strong>Total Duration:</strong> ' + totalDurMins + ' mins</div>' +
          '<div><strong>Sections:</strong> ' + (t.sections || []).length + '</div>' +
          '<div><strong>Show Result:</strong> ' + (t.showResult ? 'Yes' : 'No') + '</div>' +
          '<div><strong>Show Answers:</strong> ' + (t.showAnswer ? 'Yes' : 'No') + '</div>' +
          '<div><strong>Malpractice Limit:</strong> ' + (t.malpracticeLimit || 0) + '</div>' +
          '<div><strong>Start Time:</strong> ' + startStr + '</div>' +
          '<div><strong>End Time:</strong> ' + endStr + '</div>' +
        '</div>' +
        '<h3 style="font-size:15px;font-weight:700;margin:0 0 12px;color:#0f172a">📋 Sections & Questions</h3>' +
        sectionsHtml +
      '</div>';

    LQ.openAdminDrawer('Test Summary', html);
  } catch (err) {
    LQ.toast('Error loading test summary.');
  }
};

/* ── ASSIGN DRAWER ── */

LQ.openTestAssignDrawer = async function (id) {
  try {
    var resp = await fetch('/api/admin/tests/' + id, { credentials: 'include' });
    var data = await resp.json();
    if (!resp.ok || !data.test) { LQ.toast(data.error || 'Failed to load test.'); return; }
    var t = data.test;

    var totalDurMins = Math.ceil((t.totalDurationSec || 0) / 60);
    var startVal = t.startTime ? new Date(t.startTime).toISOString().slice(0, 16) : '';
    var endVal = t.endTime ? new Date(t.endTime).toISOString().slice(0, 16) : '';

    var html =
      '<div style="font-family:sans-serif;color:#334155">' +
        '<h3 style="margin:0 0 12px;font-size:16px;color:#0f172a">' + LQ.esc(t.title) + '</h3>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px;font-size:13px;background:#f8fafc;padding:12px;border-radius:10px;border:1px solid #e2e8f0">' +
          '<div><strong>Questions:</strong> ' + (t.totalQuestions || 0) + '</div>' +
          '<div><strong>Total Marks:</strong> ' + (t.totalMarks || 0) + '</div>' +
          '<div><strong>Duration:</strong> ' + totalDurMins + ' mins</div>' +
          '<div><strong>Sections:</strong> ' + (t.sections || []).length + '</div>' +
        '</div>' +
        '<div class="admin-form-grid" style="grid-template-columns:1fr 1fr;gap:14px">' +
          '<div class="admin-form-field">' +
            '<label>Start Date & Time <span class="req">*</span></label>' +
            '<input type="datetime-local" id="test-assign-start" value="' + startVal + '" required />' +
          '</div>' +
          '<div class="admin-form-field">' +
            '<label>End Date & Time <span class="req">*</span></label>' +
            '<input type="datetime-local" id="test-assign-end" value="' + endVal + '" required />' +
          '</div>' +
        '</div>' +
        '<div id="test-assign-error" style="display:none;color:#dc2626;margin-top:8px;font-size:13px;font-weight:600"></div>' +
        '<div class="admin-form-actions" style="margin-top:16px">' +
          '<button type="button" id="test-assign-btn" class="admin-btn admin-btn-primary" onclick="LQ._submitTestAssign(\'' + id + '\',' + t.totalDurationSec + ')">Assign Test</button>' +
          '<button type="button" class="admin-btn admin-btn-outline" onclick="LQ.closeAdminDrawer()">Cancel</button>' +
        '</div>' +
      '</div>';

    LQ.openAdminDrawer('Assign Test', html);
  } catch (err) {
    LQ.toast('Error loading test.');
  }
};

LQ._submitTestAssign = async function (id, totalDurSec) {
  var errEl = document.getElementById('test-assign-error');
  var btn = document.getElementById('test-assign-btn');
  var startVal = (document.getElementById('test-assign-start') || {}).value;
  var endVal = (document.getElementById('test-assign-end') || {}).value;

  if (!startVal || !endVal) {
    if (errEl) { errEl.textContent = 'Both start and end times are required.'; errEl.style.display = 'block'; }
    return;
  }

  var startMs = new Date(startVal).getTime();
  var endMs = new Date(endVal).getTime();
  if (endMs <= startMs) {
    if (errEl) { errEl.textContent = 'End time must be after start time.'; errEl.style.display = 'block'; }
    return;
  }

  var gapSec = Math.floor((endMs - startMs) / 1000);
  if (totalDurSec > 0 && gapSec < totalDurSec) {
    if (errEl) { errEl.textContent = 'Time window (' + Math.floor(gapSec / 60) + ' mins) must be ≥ total duration (' + Math.ceil(totalDurSec / 60) + ' mins).'; errEl.style.display = 'block'; }
    return;
  }

  if (errEl) errEl.style.display = 'none';
  if (btn) { btn.disabled = true; btn.textContent = 'Assigning...'; }

  try {
    var resp = await fetch('/api/admin/tests/' + id + '/assign', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ startTime: startVal, endTime: endVal }),
    });
    var data = await resp.json();
    if (resp.ok && data.ok) {
      LQ.toast('Test assigned successfully!');
      LQ.closeAdminDrawer();
      LQ._loadTests();
    } else {
      if (errEl) { errEl.textContent = data.error || 'Failed to assign.'; errEl.style.display = 'block'; }
    }
  } catch (err) {
    if (errEl) { errEl.textContent = 'Network error.'; errEl.style.display = 'block'; }
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Assign Test'; }
  }
};

/* ── CLONE MODAL ── */

LQ.openTestCloneModal = function (id) {
  var modalHtml =
    '<div id="test-clone-modal" style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:999999;display:flex;align-items:center;justify-content:center">' +
      '<div style="background:#fff;border-radius:16px;padding:28px;width:90%;max-width:440px;box-shadow:0 20px 60px rgba(0,0,0,0.3)">' +
        '<h3 style="margin:0 0 16px;font-size:16px;font-weight:700">Clone Test</h3>' +
        '<div class="admin-form-field">' +
          '<label>New Test Title <span class="req">*</span></label>' +
          '<input type="text" id="clone-test-title" placeholder="Enter new title" maxlength="200" />' +
        '</div>' +
        '<div id="clone-test-error" style="display:none;color:#dc2626;font-size:13px;margin-top:8px;font-weight:600"></div>' +
        '<div style="display:flex;gap:10px;margin-top:16px">' +
          '<button type="button" id="clone-test-btn" class="admin-btn admin-btn-primary" onclick="LQ._submitTestClone(\'' + id + '\')">Clone</button>' +
          '<button type="button" class="admin-btn admin-btn-outline" onclick="document.getElementById(\'test-clone-modal\').remove()">Cancel</button>' +
        '</div>' +
      '</div>' +
    '</div>';

  var existing = document.getElementById('test-clone-modal');
  if (existing) existing.remove();
  document.body.insertAdjacentHTML('beforeend', modalHtml);
};

LQ._submitTestClone = async function (id) {
  var errEl = document.getElementById('clone-test-error');
  var btn = document.getElementById('clone-test-btn');
  var title = (document.getElementById('clone-test-title') || {}).value || '';

  if (!title.trim()) {
    if (errEl) { errEl.textContent = 'Title is required.'; errEl.style.display = 'block'; }
    return;
  }

  if (errEl) errEl.style.display = 'none';
  if (btn) { btn.disabled = true; btn.textContent = 'Cloning...'; }

  try {
    var resp = await fetch('/api/admin/tests/' + id + '/clone', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ title: title.trim() }),
    });
    var data = await resp.json();
    if (resp.ok && data.ok) {
      LQ.toast('Test cloned successfully!');
      document.getElementById('test-clone-modal').remove();
      LQ._loadTests();
    } else {
      if (errEl) { errEl.textContent = data.error || 'Failed to clone.'; errEl.style.display = 'block'; }
    }
  } catch (err) {
    if (errEl) { errEl.textContent = 'Network error.'; errEl.style.display = 'block'; }
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Clone'; }
  }
};

/* ── CONFIG DRAWER ── */

LQ.openTestConfigDrawer = async function (id) {
  try {
    var resp = await fetch('/api/admin/tests/' + id, { credentials: 'include' });
    var data = await resp.json();
    if (!resp.ok || !data.test) { LQ.toast(data.error || 'Failed to load test.'); return; }
    var t = data.test;

    var html =
      '<div style="font-family:sans-serif;color:#334155">' +
        '<h3 style="margin:0 0 16px;font-size:16px;color:#0f172a">⚙️ Configuration — ' + LQ.esc(t.title) + '</h3>' +
        '<div class="admin-form-grid" style="gap:14px">' +
          '<div class="admin-form-field">' +
            '<label style="display:flex;align-items:center;gap:8px"><input type="checkbox" id="cfg-show-result" ' + (t.showResult ? 'checked' : '') + ' /> Show Result to Student</label>' +
          '</div>' +
          '<div class="admin-form-field">' +
            '<label style="display:flex;align-items:center;gap:8px"><input type="checkbox" id="cfg-show-answer" ' + (t.showAnswer ? 'checked' : '') + ' /> Show Answers to Student</label>' +
          '</div>' +
        '</div>' +
        '<div id="cfg-error" style="display:none;color:#dc2626;margin-top:8px;font-size:13px;font-weight:600"></div>' +
        '<div class="admin-form-actions" style="margin-top:16px">' +
          '<button type="button" id="cfg-btn" class="admin-btn admin-btn-primary" onclick="LQ._submitTestConfig(\'' + id + '\')">Save Config</button>' +
          '<button type="button" class="admin-btn admin-btn-outline" onclick="LQ.closeAdminDrawer()">Cancel</button>' +
        '</div>' +
      '</div>';

    LQ.openAdminDrawer('Test Config', html);
  } catch (err) {
    LQ.toast('Error loading test.');
  }
};

LQ._submitTestConfig = async function (id) {
  var errEl = document.getElementById('cfg-error');
  var btn = document.getElementById('cfg-btn');
  var showResult = !!(document.getElementById('cfg-show-result') || {}).checked;
  var showAnswer = !!(document.getElementById('cfg-show-answer') || {}).checked;

  if (errEl) errEl.style.display = 'none';
  if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }

  try {
    var resp = await fetch('/api/admin/tests/' + id + '/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ showResult: showResult, showAnswer: showAnswer }),
    });
    var data = await resp.json();
    if (resp.ok && data.ok) {
      LQ.toast('Config updated!');
      LQ.closeAdminDrawer();
      LQ._loadTests();
    } else {
      if (errEl) { errEl.textContent = data.error || 'Failed to save config.'; errEl.style.display = 'block'; }
    }
  } catch (err) {
    if (errEl) { errEl.textContent = 'Network error.'; errEl.style.display = 'block'; }
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Save Config'; }
  }
};

/* ── DISABLE / ENABLE ── */

LQ.toggleTestDisable = async function (id, disable) {
  var action = disable ? 'disable' : 'enable';
  if (!confirm('Are you sure you want to ' + action + ' this test?')) return;

  try {
    var resp = await fetch('/api/admin/tests/' + id + '/disable', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ isDisabled: disable }),
    });
    var data = await resp.json();
    if (resp.ok && data.ok) {
      LQ.toast(data.message || ('Test ' + action + 'd.'));
      LQ._loadTests();
    } else {
      LQ.toast(data.error || 'Failed to ' + action + ' test.');
    }
  } catch (err) {
    LQ.toast('Network error.');
  }
};

/* ── DELETE TEST ── */

LQ.deleteTest = async function (id) {
  if (!confirm('Are you sure you want to permanently delete this test?')) return;

  try {
    var resp = await fetch('/api/admin/tests/' + id, {
      method: 'DELETE',
      credentials: 'include',
    });
    var data = await resp.json();
    if (resp.ok && data.ok) {
      LQ.toast('Test deleted.');
      LQ._loadTests();
    } else {
      LQ.toast(data.error || 'Failed to delete test.');
    }
  } catch (err) {
    LQ.toast('Network error.');
  }
};

LQ.toggleTestActionsMenu = function (btn, id) {
  var menu = document.getElementById('actions-menu-' + id);
  if (!menu) return;
  var isVisible = menu.style.display === 'block';

  // Hide all other menus first
  var allMenus = document.querySelectorAll('.admin-actions-dropdown-content');
  allMenus.forEach(function (m) { m.style.display = 'none'; });

  if (!isVisible) {
    menu.style.display = 'block';
  }
};



