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
          '<td><button class="admin-btn admin-btn-outline admin-btn-sm" disabled title="Editing disabled">Edit</button></td>' +
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
      '<select id="admin-question-status-filter" class="admin-search-input" style="width:auto;min-width:130px" onchange="LQ._onQuestionStatusFilterChange(this.value)"><option value="all">Status: All</option><option value="active">Active Only</option><option value="inactive">Inactive Only</option></select>' +
    '</div>' +
    '<div id="admin-questions-table-wrap" class="admin-table-wrap"><p class="admin-loading">Loading questions...</p></div>' +
    '<div id="admin-questions-pagination" class="admin-pagination"></div>';

  LQ._questionPage = 1;
  LQ._questionSearch = '';
  LQ._questionStatusFilter = 'all';

  LQ._loadQuestions();
};

LQ._onQuestionStatusFilterChange = function (val) {
  LQ._questionStatusFilter = val;
  LQ._questionPage = 1;
  LQ._loadQuestions();
};

LQ._debounceQuestionSearch = (function () {
  var timer;
  return function () {
    clearTimeout(timer);
    timer = setTimeout(function () {
      LQ._questionSearch = (document.getElementById('admin-question-search') || {}).value || '';
      LQ._questionPage = 1;
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

    var resp = await fetch(url, { credentials: 'include' });
    var data = await resp.json();

    if (!resp.ok) {
      tableWrap.innerHTML = '<p class="admin-error">' + LQ.esc(data.error || 'Failed to load') + '</p>';
      return;
    }

    var questions = data.questions || [];
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
        '<th>#</th><th>Question</th><th>Category</th><th>Tense Group</th><th>Difficulty</th><th>Status</th><th>Actions</th>' +
      '</tr></thead><tbody>';

    questions.forEach(function (q, idx) {
      var num = ((pag.page - 1) * pag.limit) + idx + 1;
      var isActive = q.isActive !== false;
      var statusBadge = isActive
        ? '<span style="color:#16a34a;font-weight:700">🟢 Active</span>'
        : '<span style="color:#dc2626;font-weight:700">🔴 Inactive</span>';

      var toggleBtn = isActive
        ? '<button class="admin-btn admin-btn-danger admin-btn-sm" title="Deactivate question" onclick="LQ._toggleQuestionStatus(\'' + q._id + '\', false, \'' + LQ.esc(q.questionText) + '\')">Deactivate</button>'
        : '<button class="admin-btn admin-btn-outline admin-btn-sm" style="border-color:#16a34a;color:#16a34a;font-weight:700" title="Activate question" onclick="LQ._toggleQuestionStatus(\'' + q._id + '\', true, \'' + LQ.esc(q.questionText) + '\')">Activate</button>';

      html +=
        '<tr' + (!isActive ? ' style="opacity:0.65;background:#fef2f2"' : '') + '>' +
          '<td>' + num + '</td>' +
          '<td><strong>' + LQ.esc(q.questionText) + '</strong></td>' +
          '<td>' + LQ.esc(q.category || 'General') + '</td>' +
          '<td><code>' + LQ.esc(q.tenseGroup || '—') + '</code></td>' +
          '<td class="admin-capitalize">' + LQ.esc(q.difficulty || 'medium') + '</td>' +
          '<td>' + statusBadge + '</td>' +
          '<td class="admin-actions-cell">' +
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

LQ._toggleQuestionStatus = function (id, isActive, text) {
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

LQ.renderAddQuestionForm = async function () {
  var state = LQ.Store.getState();
  var user = state.user;
  var isSuperAdmin = user && user.role === 'super_admin';

  // Load organizations if super admin
  var orgs = [];
  if (isSuperAdmin) {
    try {
      var resp = await fetch('/api/admin/orgs', { credentials: 'include' });
      var data = await resp.json();
      if (data.ok) orgs = data.orgs || [];
    } catch (e) {}
  }

  // Load tense groups
  var tenseGroups = [];
  try {
    var respG = await fetch('/api/admin/tenses', { credentials: 'include' });
    var dataG = await respG.json();
    if (dataG.ok) tenseGroups = dataG.groups || [];
  } catch (e) {}

  var orgSelectHtml = '';
  if (isSuperAdmin) {
    orgSelectHtml =
      '<div class="admin-form-field" style="grid-column:1/-1">' +
        '<label>Target Organization <span class="req">*</span></label>' +
        '<select id="question-org" required>' +
          '<option value="">-- Select Organization --</option>';
    orgs.forEach(function (o) {
      orgSelectHtml += '<option value="' + o._id + '">' + LQ.esc(o.name) + '</option>';
    });
    orgSelectHtml +=
        '</select>' +
      '</div>';
  }

  var tenseGroupOptions = '<option value="">-- Choose Tense Group (Optional) --</option>';
  tenseGroups.forEach(function (tg) {
    tenseGroupOptions += '<option value="' + tg.name + '">' + LQ.esc(tg.displayName || tg.name) + '</option>';
  });

  var formHtml =
    '<form id="add-question-form" class="admin-form" onsubmit="LQ._submitAddQuestion(event)">' +
      '<div class="admin-form-grid">' +
        orgSelectHtml +
        '<div class="admin-form-field" style="grid-column:1/-1">' +
          '<label>Question Text <span class="req">*</span></label>' +
          '<textarea id="question-text" rows="3" required placeholder="Enter question prompt..." class="admin-search-input" style="width:100%"></textarea>' +
        '</div>' +
        '<div class="admin-form-field">' +
          '<label>Category / Module <span class="req">*</span></label>' +
          '<input type="text" id="question-category" required placeholder="e.g., Vocabulary, Tenses" value="Tenses" />' +
        '</div>' +
        '<div class="admin-form-field">' +
          '<label>Tenses Group</label>' +
          '<select id="question-tense-group">' +
            tenseGroupOptions +
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
      '</div>' +

      '<h4 style="margin:20px 0 10px;font-weight:600;color:#0f172a">Options & Answer</h4>' +
      '<div class="admin-form-grid" style="gap:10px">' +
        '<div class="admin-form-field" style="grid-column:1/-1">' +
          '<label>Option A <span class="req">*</span></label>' +
          '<input type="text" id="question-opt-a" required placeholder="Enter first option" />' +
        '</div>' +
        '<div class="admin-form-field" style="grid-column:1/-1">' +
          '<label>Option B <span class="req">*</span></label>' +
          '<input type="text" id="question-opt-b" required placeholder="Enter second option" />' +
        '</div>' +
        '<div class="admin-form-field" style="grid-column:1/-1">' +
          '<label>Option C</label>' +
          '<input type="text" id="question-opt-c" placeholder="Enter third option (optional)" />' +
        '</div>' +
        '<div class="admin-form-field" style="grid-column:1/-1">' +
          '<label>Option D</label>' +
          '<input type="text" id="question-opt-d" placeholder="Enter fourth option (optional)" />' +
        '</div>' +
        '<div class="admin-form-field">' +
          '<label>Correct Answer <span class="req">*</span></label>' +
          '<select id="question-correct-answer" required>' +
            '<option value="A">Option A</option>' +
            '<option value="B">Option B</option>' +
            '<option value="C">Option C</option>' +
            '<option value="D">Option D</option>' +
          '</select>' +
        '</div>' +
        '<div class="admin-form-field" style="grid-column:1/-1">' +
          '<label>Explanation</label>' +
          '<textarea id="question-explanation" rows="2" placeholder="Explain the correct answer choice..."></textarea>' +
        '</div>' +
      '</div>' +

      '<p id="question-error" class="admin-error-msg" style="display:none"></p>' +
      '<div class="admin-form-actions" style="margin-top:20px">' +
        '<button type="button" class="admin-btn admin-btn-outline" onclick="LQ.closeAdminDrawer()">Cancel</button>' +
        '<button type="submit" class="admin-btn admin-btn-primary" id="question-submit-btn">Save Question</button>' +
      '</div>' +
    '</form>';

  LQ.openAdminDrawer('Add New Question', formHtml);
};

LQ._submitAddQuestion = async function (e) {
  e.preventDefault();
  var text = document.getElementById('question-text').value.trim();
  var category = document.getElementById('question-category').value.trim();
  var tenseGroup = document.getElementById('question-tense-group').value;
  var difficulty = document.getElementById('question-difficulty').value;
  var optA = document.getElementById('question-opt-a').value.trim();
  var optB = document.getElementById('question-opt-b').value.trim();
  var optC = document.getElementById('question-opt-c').value.trim();
  var optD = document.getElementById('question-opt-d').value.trim();
  var correctAnswer = document.getElementById('question-correct-answer').value;
  var explanation = document.getElementById('question-explanation').value.trim();
  var orgEl = document.getElementById('question-org');
  var btn = document.getElementById('question-submit-btn');
  var errEl = document.getElementById('question-error');

  var options = [optA, optB];
  if (optC) options.push(optC);
  if (optD) options.push(optD);

  var payload = {
    questionText: text,
    category: category,
    tenseGroup: tenseGroup || null,
    difficulty: difficulty,
    options: options,
    correctAnswer: correctAnswer,
    explanation: explanation,
  };

  if (orgEl) {
    payload.orgId = orgEl.value;
  }

  if (errEl) errEl.style.display = 'none';
  if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }

  try {
    var resp = await fetch('/api/admin/questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    var data = await resp.json();

    if (resp.ok) {
      LQ.toast('Question saved!');
      LQ.closeAdminDrawer();
      if (LQ._loadQuestions) LQ._loadQuestions();
    } else {
      if (errEl) { errEl.textContent = data.error || 'Failed to save question.'; errEl.style.display = 'block'; }
    }
  } catch (err) {
    if (errEl) { errEl.textContent = 'Network error. Please try again.'; errEl.style.display = 'block'; }
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Save Question'; }
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
    '<div class="admin-bulk-info">' +
      '<p>Upload an Excel file (.xlsx) containing question records.</p>' +
    '</div>' +
    '<form id="bulk-question-form" class="admin-form">' +
      '<div class="admin-file-drop" id="question-file-drop" onclick="document.getElementById(\'question-file-input\').click()">' +
        '<input type="file" id="question-file-input" accept=".xlsx,.xls,.csv" style="display:none" />' +
        '<p class="admin-file-drop-text">📁 Click to select or drag & drop your Excel file</p>' +
      '</div>' +
      '<div class="admin-form-actions" style="margin-top:20px">' +
        '<button type="button" class="admin-btn admin-btn-outline" onclick="LQ.closeAdminDrawer()">Cancel</button>' +
        '<button type="button" class="admin-btn admin-btn-primary" onclick="LQ.toast(\'Bulk upload format ready!\')">Upload Questions</button>' +
      '</div>' +
    '</form>';

  LQ.openAdminDrawer('📤 Bulk Upload Questions', formHtml);
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

      html +=
        '<tr>' +
          '<td>' + startIdx + '</td>' +
          '<td>' + LQ.esc(listName) + '</td>' +
          '<td>' + LQ.esc(groupName) + '</td>' +
          '<td><code>' + LQ.esc(q.type) + '</code></td>' +
          '<td style="max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + LQ.esc(q.title) + '"><strong>' + LQ.esc(q.title) + '</strong></td>' +
          '<td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + LQ.esc(optionsStr) + '</td>' +
          '<td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"><code>' + LQ.esc(q.correctAnswer) + '</code></td>' +
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
      '<div class="admin-form-field">' +
        '<label for="pq-form-type">Question Type <span class="req">*</span></label>' +
        '<select id="pq-form-type" class="admin-search-input" style="width:100%;box-sizing:border-box" onchange="window.togglePqFormTypeView()" required>' +
          '<option value="mcq">MCQ (Single Correct)</option>' +
          '<option value="mcq_multi">MCQ (Multiple Correct)</option>' +
          '<option value="fib">Fill in the Blanks</option>' +
        '</select>' +
      '</div>' +
      '<div class="admin-form-field">' +
        '<label for="pq-form-title">Question Prompt (Text) <span class="req">*</span></label>' +
        '<textarea id="pq-form-title" class="admin-search-input" style="width:100%;box-sizing:border-box;height:80px;font-family:inherit" placeholder="e.g. Choose the correct synonym of Concord." required></textarea>' +
      '</div>' +
      
      '<div id="pq-options-section" style="margin-top:16px">' +
        '<label style="font-weight:600;margin-bottom:8px;display:block">MCQ Options (Provide at least 4 options)</label>' +
        '<div id="pq-options-container"></div>' +
        '<button type="button" id="btn-add-pq-option" class="admin-btn admin-btn-outline admin-btn-sm" style="margin-top:8px" onclick="window.addPqFormOption()">+ Add Option</button>' +
      '</div>' +

      '<div class="admin-form-field" style="margin-top:16px">' +
        '<label id="pq-correct-answer-label">Correct Option</label>' +
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
    window.togglePqFormTypeView();
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
        '<div class="admin-form-field">' +
          '<label for="pq-form-type">Question Type <span class="req">*</span></label>' +
          '<select id="pq-form-type" class="admin-search-input" style="width:100%;box-sizing:border-box" onchange="window.togglePqFormTypeView()" required>' +
            '<option value="mcq"' + (q.type === 'mcq' ? ' selected' : '') + '>MCQ (Single Correct)</option>' +
            '<option value="mcq_multi"' + (q.type === 'mcq_multi' ? ' selected' : '') + '>MCQ (Multiple Correct)</option>' +
            '<option value="fib"' + (q.type === 'fib' ? ' selected' : '') + '>Fill in the Blanks</option>' +
          '</select>' +
        '</div>' +
        '<div class="admin-form-field">' +
          '<label for="pq-form-title">Question Prompt (Text) <span class="req">*</span></label>' +
          '<textarea id="pq-form-title" class="admin-search-input" style="width:100%;box-sizing:border-box;height:80px;font-family:inherit" required>' + LQ.esc(q.title) + '</textarea>' +
        '</div>' +
        
        '<div id="pq-options-section" style="margin-top:16px">' +
          '<label style="font-weight:600;margin-bottom:8px;display:block">MCQ Options (Provide at least 4 options)</label>' +
          '<div id="pq-options-container"></div>' +
          '<button type="button" id="btn-add-pq-option" class="admin-btn admin-btn-outline admin-btn-sm" style="margin-top:8px" onclick="window.addPqFormOption()">+ Add Option</button>' +
        '</div>' +

        '<div class="admin-form-field" style="margin-top:16px">' +
          '<label id="pq-correct-answer-label">Correct Option</label>' +
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

      window.togglePqFormTypeView();
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
    var selectEl = document.getElementById('pq-form-correct-answer-select');
    correctAnswer = selectEl ? selectEl.value : '';
    if (!correctAnswer) {
      if (errEl) { errEl.textContent = 'Please configure options and select a correct answer.'; errEl.style.display = 'block'; }
      return;
    }
  } else if (type === 'mcq_multi') {
    var chks = document.querySelectorAll('.pq-form-correct-chk:checked');
    var correctList = Array.from(chks).map(c => c.value);
    if (!correctList.length) {
      if (errEl) { errEl.textContent = 'Please select at least one correct choice.'; errEl.style.display = 'block'; }
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
  window.renderPqFormCorrectAnswerSelector();
};

window.renderPqFormOptions = function () {
  var container = document.getElementById('pq-options-container');
  if (!container) return;
  container.innerHTML = LQ._pqFormOptions.map(function (val, idx) {
    var removeBtn = LQ._pqFormOptions.length > 4 
      ? '<button type="button" class="admin-btn admin-btn-danger admin-btn-sm" style="padding:4px 8px;margin-left:8px" onclick="window.removePqFormOption(' + idx + ')">✕</button>'
      : '';
    return '<div style="display:flex;gap:8px;align-items:center;margin-bottom:8px">' +
      '<span style="font-weight:600;width:20px;font-size:12px">' + String.fromCharCode(65 + idx) + '</span>' +
      '<input type="text" class="admin-search-input" style="flex:1" value="' + LQ.esc(val) + '" placeholder="Option ' + (idx + 1) + '" required oninput="window.updatePqFormOptionText(' + idx + ', this.value)">' +
      removeBtn +
      '</div>';
  }).join('');
  
  var addBtn = document.getElementById('btn-add-pq-option');
  if (addBtn) {
    addBtn.style.display = LQ._pqFormOptions.length < 6 ? 'block' : 'none';
  }
  window.renderPqFormCorrectAnswerSelector();
};

window.renderPqFormCorrectAnswerSelector = function () {
  var container = document.getElementById('pq-correct-answer-container');
  if (!container) return;
  var type = document.getElementById('pq-form-type').value;
  var prevVal = LQ._pqFormPrevCorrect || '';

  if (type === 'mcq_multi') {
    var correctList = prevVal.split(',').map(s => s.trim());
    var html = '<div style="display:flex;flex-direction:column;gap:6px;margin-top:6px">';
    LQ._pqFormOptions.forEach(function (optText, idx) {
      var val = optText.trim();
      if (!val) return;
      var checkedAttr = correctList.includes(val) ? ' checked' : '';
      html += '<label style="display:flex;align-items:center;gap:8px;font-weight:normal;cursor:pointer;font-size:13px">' +
        '<input type="checkbox" class="pq-form-correct-chk" value="' + LQ.esc(val) + '"' + checkedAttr + ' onchange="LQ._pqFormPrevCorrect=Array.from(document.querySelectorAll(\'.pq-form-correct-chk:checked\')).map(c=>c.value).join(\', \')" style="cursor:pointer">' +
        '<span>Option ' + String.fromCharCode(65 + idx) + ': ' + LQ.esc(val) + '</span>' +
        '</label>';
    });
    html += '</div>';
    container.innerHTML = html;
  } else {
    var html = '<select id="pq-form-correct-answer-select" required class="admin-search-input" style="width:100%;box-sizing:border-box" onchange="LQ._pqFormPrevCorrect=this.value">';
    LQ._pqFormOptions.forEach(function (optText, idx) {
      var val = optText.trim();
      var displayLabel = val ? val : 'Option ' + String.fromCharCode(65 + idx);
      var selectedAttr = val && val === prevVal ? ' selected' : '';
      html += '<option value="' + LQ.esc(val) + '"' + selectedAttr + '>' + LQ.esc(displayLabel) + '</option>';
    });
    html += '</select>';
    container.innerHTML = html;
    
    // Set the saved value to select if it has option
    var selectEl = document.getElementById('pq-form-correct-answer-select');
    if (selectEl && prevVal) {
      selectEl.value = prevVal;
    }
  }
};

window.togglePqFormTypeView = function () {
  var type = document.getElementById('pq-form-type').value;
  var optSection = document.getElementById('pq-options-section');
  var correctAnsLabel = document.getElementById('pq-correct-answer-label');
  var correctAnsContainer = document.getElementById('pq-correct-answer-container');
  
  if (type === 'mcq' || type === 'mcq_multi') {
    optSection.style.display = 'block';
    if (correctAnsLabel) correctAnsLabel.textContent = type === 'mcq_multi' ? 'Correct Option(s) (Select multiple)' : 'Correct Option';
    window.renderPqFormOptions();
  } else {
    optSection.style.display = 'none';
    if (correctAnsLabel) correctAnsLabel.textContent = 'Correct Answer Text';
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


