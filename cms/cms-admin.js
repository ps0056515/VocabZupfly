(function () {
  var API_BASE = '/api/cms';
  var STORAGE_KEY = 'lexiquest_cms_key';
  var state = { words: [], wordLists: { lists: [] }, manifest: {}, tenses: {} };
  var importFiles = {};
  var editingWord = null;
  var editingTenseGroup = null;
  var editingTenseIndex = -1;

  function $(id) {
    return document.getElementById(id);
  }

  function toast(msg, ok) {
    var el = $('toast');
    el.textContent = msg;
    el.className = 'toast' + (ok ? ' ok' : '');
    el.classList.remove('hidden');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () {
      el.classList.add('hidden');
    }, 3200);
  }

  function apiKey() {
    return sessionStorage.getItem(STORAGE_KEY) || '';
  }

  function api(path, opts) {
    opts = opts || {};
    var headers = {};
    var key = apiKey();
    if (key) headers['X-CMS-Key'] = key;
    if (opts.body && typeof opts.body === 'object' && !(opts.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(opts.body);
    }
    return fetch(API_BASE + path, {
      method: opts.method || 'GET',
      headers: headers,
      credentials: 'include',
      body: opts.body,
    }).then(function (r) {
      return r.text().then(function (text) {
        var data = {};
        try {
          data = text ? JSON.parse(text) : {};
        } catch (e) {
          if (!r.ok) throw new Error('Server error ' + r.status + ' — is npm run dev running?');
        }
        if (!r.ok) throw new Error(data.error || r.statusText || 'Request failed');
        return data;
      });
    });
  }

  function showApp(show) {
    $('login-screen').classList.toggle('hidden', show);
    $('app').classList.toggle('hidden', !show);
  }

  function login() {
    var key = $('cms-key-inp').value.trim();
    if (!key) {
      toast('Enter API key');
      return;
    }
    sessionStorage.setItem(STORAGE_KEY, key);
    api('/status')
      .then(function () {
        showApp(true);
        loadContent();
      })
      .catch(function (e) {
        sessionStorage.removeItem(STORAGE_KEY);
        var msg = e.message || 'Login failed';
        if (msg.indexOf('fetch') >= 0 || msg === 'Failed to fetch') {
          msg = 'Cannot reach server — run npm run dev and open http://localhost:3456/cms/';
        }
        toast(msg);
      });
  }

  function logout() {
    sessionStorage.removeItem(STORAGE_KEY);
    showApp(false);
  }

  window.cmsLogin = login;
  window.cmsLogout = logout;

  function loadContent() {
    return Promise.all([
      api('/content').then(function (data) {
        state.words = data.words || [];
        state.wordLists = data.wordLists || { lists: [] };
        state.manifest = data.manifest || {};
        renderStats();
        renderWords();
        renderLists();
        renderDictionary();
        renderImportGrid();
        renderExport();
      }),
      loadTenses(),
      loadOfficialTests(),
      loadOfficialResults()
    ]);
  }

  function loadTenses() {
    return api('/tenses').then(function (data) {
      state.tenses = data.tenses || {};
      renderTenses();
    }).catch(function (err) {
      console.warn('Failed to load tenses', err);
    });
  }

  function renderStats() {
    var m = state.manifest;
    $('cms-stats').textContent =
      (state.words.length || 0) +
      ' words · ' +
      (state.wordLists.lists || []).length +
      ' lists · version ' +
      (m.version || '—') +
      (m.updated ? ' · updated ' + new Date(m.updated).toLocaleString() : '');
  }

  function renderWords() {
    var q = ($('word-search').value || '').trim().toLowerCase();
    var rows = state.words;
    if (q) {
      rows = rows.filter(function (w) {
        return (
          w.word.toLowerCase().indexOf(q) >= 0 ||
          (w.def && w.def.toLowerCase().indexOf(q) >= 0)
        );
      });
    }
    rows = rows.slice(0, 200);
    $('words-tbody').innerHTML = rows
      .map(function (w) {
        return (
          '<tr><td><strong>' +
          esc(w.word) +
          '</strong></td><td class="def-cell">' +
          esc(w.def) +
          '</td><td class="ex-cell">' +
          esc(stripHtml(w.example)) +
          '</td><td>' +
          esc((w.tags || []).join(', ')) +
          '</td><td><button type="button" class="btn sm" data-edit="' +
          esc(w.word) +
          '">Edit</button></td></tr>'
        );
      })
      .join('');
    $('words-count').textContent =
      rows.length + (q ? ' shown' : '') + ' · ' + state.words.length + ' total in bank';
    $('words-tbody').querySelectorAll('[data-edit]').forEach(function (btn) {
      btn.onclick = function () {
        openWordModal(btn.getAttribute('data-edit'));
      };
    });
  }

  function stripHtml(s) {
    return (s || '').replace(/<[^>]+>/g, '');
  }

  function esc(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/"/g, '&quot;');
  }

  function openWordModal(wordName) {
    editingWord = null;
    var w = state.words.find(function (x) {
      return x.word === wordName;
    });
    if (w) editingWord = w.word;
    $('word-modal-title').textContent = w ? 'Edit word' : 'Add word';
    var f = $('word-form');
    f.word.value = w ? w.word : '';
    f.phonetic.value = w ? w.phonetic || '' : '';
    f.pos.value = w ? w.pos || '' : '';
    f.def.value = w ? w.def || '' : '';
    f.example.value = w ? stripHtml(w.example) : '';
    f.syn.value = w ? w.syn || '' : '';
    f.ant.value = w ? w.ant || '' : '';
    f.tags.value = w ? (w.tags || []).join('|') : 'GRE|GMAT|IELTS';
    f.premium.checked = !!(w && w.premium);
    f.word.disabled = !!w;
    $('word-modal').classList.remove('hidden');
  }

  function closeWordModal() {
    $('word-modal').classList.add('hidden');
  }

  function saveWordFromForm(e) {
    e.preventDefault();
    var f = $('word-form');
    var tags = (f.tags.value || 'GRE')
      .split('|')
      .map(function (t) {
        return t.trim();
      })
      .filter(Boolean);
    var payload = {
      word: f.word.value.trim(),
      phonetic: f.phonetic.value.trim(),
      pos: f.pos.value.trim() || 'word',
      def: f.def.value.trim(),
      example: f.example.value.trim(),
      syn: f.syn.value.trim(),
      ant: f.ant.value.trim(),
      tags: tags.length ? tags : ['GRE'],
      premium: f.premium.checked,
      stub: false,
    };
    api('/word', { method: 'POST', body: payload })
      .then(function () {
        toast('Word saved', true);
        closeWordModal();
        return loadContent();
      })
      .catch(function (err) {
        toast(err.message);
      });
  }

  function renderLists() {
    var html =
      '<div class="list-row list-row-head"><span>Title</span><span>#</span><span>Type</span><span>Icon</span><span></span></div>';
    (state.wordLists.lists || []).forEach(function (lst, idx) {
      html +=
        '<div class="list-row" data-idx="' +
        idx +
        '"><input class="inp" data-f="title" value="' +
        esc(lst.title) +
        '"><input class="inp" data-f="listNum" type="number" value="' +
        (lst.listNum || 0) +
        '"><select class="inp" data-f="listType"><option value="grouped"' +
        (lst.listType !== 'dictionary' ? ' selected' : '') +
        '>GRE (grouped)</option><option value="dictionary"' +
        (lst.listType === 'dictionary' ? ' selected' : '') +
        '>Dictionary</option></select><input class="inp" data-f="icon" value="' +
        esc(lst.icon || '📘') +
        '"><span class="muted">' +
        esc(lst.id) +
        '</span></div>';
    });
    $('lists-editor').innerHTML = html;
  }

  function saveLists() {
    var rows = $('lists-editor').querySelectorAll('.list-row[data-idx]');
    rows.forEach(function (row) {
      var idx = parseInt(row.getAttribute('data-idx'), 10);
      var lst = state.wordLists.lists[idx];
      if (!lst) return;
      lst.title = row.querySelector('[data-f=title]').value.trim() || lst.title;
      lst.listNum = parseInt(row.querySelector('[data-f=listNum]').value, 10) || lst.listNum;
      lst.listType = row.querySelector('[data-f=listType]').value;
      lst.icon = row.querySelector('[data-f=icon]').value.trim() || lst.icon;
    });
    api('/lists', { method: 'PUT', body: state.wordLists })
      .then(function () {
        toast('Lists saved', true);
        return loadContent();
      })
      .catch(function (e) {
        toast(e.message);
      });
  }

  function renderDictionary() {
    var dicts = (state.wordLists.lists || []).filter(function (l) {
      return l.listType === 'dictionary';
    });
    var sel = $('dict-list-select');
    sel.innerHTML = dicts
      .map(function (l) {
        return '<option value="' + esc(l.id) + '">' + esc(l.title) + '</option>';
      })
      .join('');
    renderDictWords();
    sel.onchange = renderDictWords;
  }

  function renderDictWords() {
    var id = $('dict-list-select').value;
    var lst = (state.wordLists.lists || []).find(function (l) {
      return l.id === id;
    });
    var ul = $('dict-word-list');
    if (!lst) {
      ul.innerHTML = '<li class="muted">No dictionary lists</li>';
      return;
    }
    ul.innerHTML = (lst.words || [])
      .map(function (e) {
        var w = typeof e === 'string' ? e : e.word;
        return '<li><span>' + esc(w) + '</span></li>';
      })
      .join('');
  }

  function addDictWord() {
    var listId = $('dict-list-select').value;
    var word = $('dict-add-word').value.trim();
    if (!word) {
      toast('Enter a word');
      return;
    }
    api('/dictionary/add', { method: 'POST', body: { listId: listId, word: word } })
      .then(function (data) {
        state.wordLists = data.wordLists;
        $('dict-add-word').value = '';
        toast('Added to dictionary', true);
        renderDictionary();
        return loadContent();
      })
      .catch(function (e) {
        toast(e.message);
      });
  }

  var CSV_NAMES = ['Words.csv', 'WordLists.csv', 'Groups.csv', 'GroupWords.csv', 'DictionaryWords.csv'];

  function renderImportGrid() {
    $('import-grid').innerHTML = CSV_NAMES.map(function (name) {
      return (
        '<div class="import-file"><label>' +
        name +
        '</label><input type="file" accept=".csv,text/csv" data-csv="' +
        name +
        '"></div>'
      );
    }).join('');
    $('import-grid').querySelectorAll('input[type=file]').forEach(function (inp) {
      inp.onchange = function () {
        var file = inp.files[0];
        var key = inp.getAttribute('data-csv');
        if (!file) {
          delete importFiles[key];
          return;
        }
        var reader = new FileReader();
        reader.onload = function () {
          importFiles[key] = reader.result;
        };
        reader.readAsText(file);
      };
    });
  }

  function runImport() {
    if (!Object.keys(importFiles).length) {
      toast('Upload at least one CSV file');
      return;
    }
    api('/import/csv', { method: 'POST', body: importFiles })
      .then(function () {
        importFiles = {};
        toast('Import complete', true);
        return loadContent();
      })
      .catch(function (e) {
        toast(e.message);
      });
  }

  function renderExport() {
    $('export-buttons').innerHTML = CSV_NAMES.map(function (name) {
      return '<button type="button" class="btn" data-dl="' + name + '">' + name + '</button>';
    }).join('');
    $('export-buttons').querySelectorAll('[data-dl]').forEach(function (btn) {
      btn.onclick = function () {
        downloadCsv(btn.getAttribute('data-dl'));
      };
    });
  }

  function downloadCsv(name) {
    api('/export/csv')
      .then(function (data) {
        var text = data.files[name];
        if (!text) {
          toast('File not found');
          return;
        }
        var blob = new Blob([text], { type: 'text/csv' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = name;
        a.click();
        URL.revokeObjectURL(a.href);
      })
      .catch(function (e) {
        toast(e.message);
      });
  }

  function publish() {
    if (!confirm('Publish content to the app? This updates data/*.json and syncs www/.')) return;
    api('/publish', { method: 'POST', body: { syncWeb: true } })
      .then(function (data) {
        toast('Published · ' + data.wordCount + ' words', true);
        return loadContent();
      })
      .catch(function (e) {
        toast(e.message);
      });
  }

  function renderTenses() {
    var selGroup = ($('tenses-group-select').value || 'all').trim();
    var tbody = $('tenses-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    var totalCount = 0;
    var groups = Object.keys(state.tenses || {});

    groups.forEach(function (grp) {
      if (selGroup !== 'all' && grp !== selGroup) return;
      var items = state.tenses[grp] || [];
      items.forEach(function (item, idx) {
        totalCount++;
        var tr = document.createElement('tr');

        var titleText = item.text || item.title || item.story || item.passage || (item.questions ? item.questions[0] && item.questions[0].q : '');
        var cat = (item.category || 'reading').toLowerCase();

        tr.innerHTML =
          '<td><span class="badge-group">' + escapeHtml(grp) + '</span></td>' +
          '<td>' + escapeHtml(titleText || '(No text)') + '</td>' +
          '<td><span class="badge-cat badge-' + escapeHtml(cat) + '">' + escapeHtml(cat) + '</span></td>' +
          '<td>' +
          '<button type="button" class="btn btn-edit-tenses" data-grp="' + escapeHtml(grp) + '" data-idx="' + idx + '">Edit</button> ' +
          '<button type="button" class="btn danger-outline btn-del-tenses" data-grp="' + escapeHtml(grp) + '" data-idx="' + idx + '">Delete</button>' +
          '</td>';
        tbody.appendChild(tr);
      });
    });

    $('tenses-count').textContent = 'Showing ' + totalCount + ' question(s)';

    tbody.querySelectorAll('.btn-edit-tenses').forEach(function (b) {
      b.onclick = function () {
        var g = b.getAttribute('data-grp');
        var i = parseInt(b.getAttribute('data-idx'), 10);
        openTensesModal(g, i);
      };
    });

    tbody.querySelectorAll('.btn-del-tenses').forEach(function (b) {
      b.onclick = function () {
        var g = b.getAttribute('data-grp');
        var i = parseInt(b.getAttribute('data-idx'), 10);
        if (confirm('Delete this question from group "' + g + '"?')) {
          deleteTensesQuestion(g, i);
        }
      };
    });
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function openTensesModal(grp, idx) {
    editingTenseGroup = grp || null;
    editingTenseIndex = (idx !== undefined && idx !== null) ? idx : -1;
    var modal = $('tenses-modal');

    if (editingTenseGroup && editingTenseIndex >= 0 && state.tenses[editingTenseGroup]) {
      var item = state.tenses[editingTenseGroup][editingTenseIndex];
      $('tenses-modal-title').textContent = 'Edit Tenses Question';
      $('tenses-form-group').value = editingTenseGroup;
      $('tenses-form-title').value = item.text || item.title || '';
      $('tenses-form-category').value = (item.category || 'reading').toLowerCase();
    } else {
      $('tenses-modal-title').textContent = 'Add Tenses Question';
      $('tenses-form-group').value = $('tenses-group-select').value === 'all' ? 'sentence-repeating' : $('tenses-group-select').value;
      $('tenses-form-title').value = '';
      $('tenses-form-category').value = 'reading';
    }

    modal.classList.remove('hidden');
  }

  function closeTensesModal() {
    $('tenses-modal').classList.add('hidden');
    editingTenseGroup = null;
    editingTenseIndex = -1;
  }

  function saveTensesFromForm(e) {
    e.preventDefault();
    var grp = $('tenses-form-group').value;
    var title = $('tenses-form-title').value.trim();
    var cat = $('tenses-form-category').value;

    if (!title) {
      toast('Please enter a question title or prompt');
      return;
    }

    if (editingTenseGroup && editingTenseIndex >= 0 && state.tenses[editingTenseGroup]) {
      state.tenses[editingTenseGroup].splice(editingTenseIndex, 1);
    }

    if (!state.tenses[grp]) state.tenses[grp] = [];
    state.tenses[grp].push({ text: title, category: cat });

    api('/tenses', { method: 'PUT', body: state.tenses })
      .then(function (data) {
        state.tenses = data.tenses;
        toast('Tenses question saved!', true);
        closeTensesModal();
        renderTenses();
      })
      .catch(function (err) {
        toast(err.message || 'Failed to save question');
      });
  }

  function deleteTensesQuestion(grp, idx) {
    api('/tenses/question', { method: 'DELETE', body: { group: grp, index: idx } })
      .then(function (data) {
        state.tenses = data.tenses;
        toast('Question deleted', true);
        renderTenses();
      })
      .catch(function (err) {
        toast(err.message || 'Failed to delete question');
      });
  }

  function downloadTensesTemplate() {
    var csvHeader = 'Group,Question Title,Category\n';
    var sampleRows = [
      'sentence-repeating,"She has been studying English for three years.",listening',
      'sentence-reading,"They will have finished the project by next Friday.",reading',
      'grammar,"Past perfect: He had forgotten his keys before he reached the door.",reading',
      'essay-writing,"Write a short essay on your daily routine.",writing',
      'short-stories,"Maya woke up to the sound of rain tapping on her window.",reading'
    ].join('\n');

    var blob = new Blob([csvHeader + sampleRows], { type: 'text/csv;charset=utf-8;' });
    var link = document.createElement('a');
    var url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'TensesQuestions_Template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast('Template downloaded!', true);
  }

  function handleTensesSheetUpload(e) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;

    var reader = new FileReader();
    reader.onload = function (evt) {
      var content = evt.target.result;
      var rows = parseCsvText(content);

      if (!rows || !rows.length) {
        toast('No rows found in uploaded sheet');
        return;
      }

      api('/tenses/import', { method: 'POST', body: rows })
        .then(function (res) {
          state.tenses = res.tenses;
          toast('Successfully imported ' + res.count + ' questions!', true);
          renderTenses();
        })
        .catch(function (err) {
          toast(err.message || 'Failed to import sheet');
        });
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  function parseCsvText(text) {
    var lines = text.split(/\r?\n/).filter(function (l) { return l.trim(); });
    if (!lines.length) return [];
    var headers = parseCsvLine(lines[0]);
    var result = [];

    for (var i = 1; i < lines.length; i++) {
      var vals = parseCsvLine(lines[i]);
      if (!vals.length) continue;
      var row = {};
      headers.forEach(function (h, idx) {
        row[h.trim()] = (vals[idx] || '').trim();
      });
      result.push(row);
    }
    return result;
  }

  function parseCsvLine(line) {
    var row = [];
    var cell = '';
    var inQuotes = false;
    for (var i = 0; i < line.length; i++) {
      var c = line[i];
      if (inQuotes) {
        if (c === '"') {
          if (line[i + 1] === '"') {
            cell += '"';
            i++;
          } else inQuotes = false;
        } else cell += c;
      } else if (c === '"') {
        inQuotes = true;
      } else if (c === ',') {
        row.push(cell);
        cell = '';
      } else cell += c;
    }
    row.push(cell);
    return row;
  }

  $('cms-login-btn').onclick = login;
  $('cms-key-inp').onkeydown = function (e) {
    if (e.key === 'Enter') login();
  };
  $('btn-logout').onclick = logout;
  $('btn-reload').onclick = loadContent;
  $('btn-publish').onclick = publish;
  $('word-search').oninput = renderWords;
  $('tenses-group-select').onchange = renderWords;
  if ($('tenses-group-select')) $('tenses-group-select').onchange = renderTenses;
  if ($('btn-add-tenses-q')) $('btn-add-tenses-q').onclick = function () { openTensesModal(null); };
  if ($('tenses-modal-cancel')) $('tenses-modal-cancel').onclick = closeTensesModal;
  if ($('tenses-form')) $('tenses-form').onsubmit = saveTensesFromForm;
  if ($('btn-download-tenses-template')) $('btn-download-tenses-template').onclick = downloadTensesTemplate;
  if ($('inp-tenses-sheet')) $('inp-tenses-sheet').onchange = handleTensesSheetUpload;

  /* ══ OFFICIAL TESTS & REPORTS LOGIC ══ */
  var builderQuestions = [];
  var isTitleUnique = true;

  function loadOfficialTests() {
    return api('/tests').then(function (data) {
      state.officialTests = data.tests || [];
      renderOfficialTests();
    }).catch(function (err) {
      console.warn('Failed to load official tests', err);
    });
  }

  function loadOfficialResults() {
    return api('/tests/results').then(function (data) {
      state.officialResults = data.results || [];
      renderOfficialResults();
      renderOfficialTests();
    }).catch(function (err) {
      console.warn('Failed to load test results', err);
    });
  }

  function renderOfficialTests() {
    var search = ($('test-search') ? $('test-search').value : '').trim().toLowerCase();
    var rows = state.officialTests || [];
    if (search) {
      rows = rows.filter(function (t) {
        return (t.title || '').toLowerCase().indexOf(search) >= 0;
      });
    }

    var tbody = $('tests-tbody');
    if (!tbody) return;

    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="8" class="muted" style="text-align:center;padding:20px;">No official tests created yet. Click "+ Create Official Test" above.</td></tr>';
      return;
    }

    var now = Date.now();

    tbody.innerHTML = rows.map(function (t) {
      var startMs = new Date(t.startTime).getTime();
      var endMs = new Date(t.endTime).getTime();
      var hasStarted = now >= startMs;

      var statusStr = 'Upcoming';
      var statusBadgeClass = 'badge-upcoming';
      if (now >= startMs && now <= endMs) {
        statusStr = 'Active';
        statusBadgeClass = 'badge-active';
      } else if (now > endMs) {
        statusStr = 'Closed';
        statusBadgeClass = 'badge-closed';
      }

      var editDisabled = hasStarted ? 'disabled title="Cannot edit test after its start time has reached"' : '';
      var deleteDisabled = hasStarted ? 'disabled title="Cannot delete test after its start time has reached"' : '';

      var startStr = t.startTime ? new Date(t.startTime).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' }) : '—';
      var endStr = t.endTime ? new Date(t.endTime).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' }) : '—';
      var durStr = t.durationMinutes ? t.durationMinutes + ' mins' : 'Untimed';
      var qCount = (t.questions || []).length;

      var attendedCount = (state.officialResults || []).filter(function (r) {
        if (!r) return false;
        if (r.testId && String(r.testId) === String(t.id)) return true;
        if (r.testTitle && t.title && String(r.testTitle).trim().toLowerCase() === String(t.title).trim().toLowerCase()) return true;
        return false;
      }).length;

      var attendedHtml = attendedCount > 0
        ? '<button type="button" class="btn btn-sm" onclick="window.filterReportsByTest(\'' + t.id + '\', \'' + esc(t.title).replace(/'/g, "\\'") + '\')" style="background:#f0fdf4;color:#166534;font-weight:700;border:1px solid #bbf7d0;cursor:pointer;">👥 ' + attendedCount + ' Attended</button>'
        : '<span class="muted" style="font-size:12px;">0 Attended</span>';

      return (
        '<tr>' +
        '<td><strong>' + esc(t.title) + '</strong></td>' +
        '<td>' + startStr + '</td>' +
        '<td>' + endStr + '</td>' +
        '<td>' + durStr + '</td>' +
        '<td>' + qCount + ' Qs</td>' +
        '<td><span class="status-badge ' + statusBadgeClass + '">' + statusStr + '</span></td>' +
        '<td>' + attendedHtml + '</td>' +
        '<td>' +
        '<div style="display:flex;gap:6px;">' +
        '<button type="button" class="btn btn-sm" ' + editDisabled + ' onclick="window.editOfficialTest(\'' + t.id + '\')">Edit</button>' +
        '<button type="button" class="btn btn-sm danger-outline" ' + deleteDisabled + ' onclick="window.deleteOfficialTest(\'' + t.id + '\')">Delete</button>' +
        '</div>' +
        '</td>' +
        '</tr>'
      );
    }).join('');
  }

  function renderOfficialResults(filterTestId, filterStudent) {
    var search = ($('cms-report-search') ? $('cms-report-search').value : '').trim().toLowerCase();
    var rows = state.officialResults || [];

    if (filterTestId) {
      var targetTest = (state.officialTests || []).find(function (t) { return String(t.id) === String(filterTestId); });
      var targetTitle = targetTest ? String(targetTest.title || '').trim().toLowerCase() : '';
      rows = rows.filter(function (r) {
        if (!r) return false;
        if (r.testId && String(r.testId) === String(filterTestId)) return true;
        if (targetTitle && r.testTitle && String(r.testTitle).trim().toLowerCase() === targetTitle) return true;
        return false;
      });
    }
    if (filterStudent || search) {
      var query = filterStudent || search;
      rows = rows.filter(function (r) {
        return (
          (r.userName || '').toLowerCase().indexOf(query) >= 0 ||
          (r.userEmail || '').toLowerCase().indexOf(query) >= 0 ||
          (r.testTitle || '').toLowerCase().indexOf(query) >= 0
        );
      });
    }

    var tbody = $('reports-tbody');
    if (!tbody) return;

    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="muted" style="text-align:center;padding:20px;">No test submissions found.</td></tr>';
      return;
    }

    var activeReportRows = rows;
    tbody.innerHTML = rows.map(function (r, idx) {
      var subDateStr = r.completedAt ? new Date(r.completedAt).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' }) : 'In Progress';
      var scoreStr = r.percentage !== undefined ? r.percentage + '%' : '—';
      var correctStr = r.correctCount !== undefined ? r.correctCount + '/' + r.totalQuestions : '—';
      var statusBadge = r.status === 'completed' ? '<span class="status-badge badge-active">✓ Completed</span>' : '<span class="status-badge badge-upcoming">⏳ In Progress</span>';
      var recId = r.id || ('rec_' + idx);

      return (
        '<tr>' +
        '<td><button type="button" class="btn-link" onclick="window.viewStudentTestReport(' + idx + ')" style="background:none;border:none;padding:0;color:#2563eb;font-weight:700;text-decoration:underline;cursor:pointer;text-align:left;">🔍 ' + esc(r.userName || 'Student') + '</button></td>' +
        '<td>' + esc(r.userEmail || '—') + '</td>' +
        '<td>' + esc(r.testTitle || 'Test') + '</td>' +
        '<td><strong>' + scoreStr + '</strong></td>' +
        '<td>' + correctStr + '</td>' +
        '<td>' + subDateStr + '</td>' +
        '<td>' + statusBadge + '</td>' +
        '</tr>'
      );
    }).join('');

    window._lastFilteredReports = rows;
  }

  window.closeStudentReportModal = function () {
    var modal = $('student-detailed-report-modal');
    if (modal) modal.classList.add('hidden');
  };

  window.viewStudentTestReport = function (idx) {
    var reports = window._lastFilteredReports || state.officialResults || [];
    var r = reports[idx];
    if (!r) {
      toast('Report details not found');
      return;
    }

    var titleEl = $('report-modal-title');
    var bodyEl = $('report-modal-body');
    if (titleEl) titleEl.textContent = 'Detailed Test Report — ' + (r.userName || 'Student');

    var subDateStr = r.completedAt ? new Date(r.completedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'In Progress';
    var pctNum = r.percentage || 0;
    var badgeColor = pctNum > 60 ? '#166534' : pctNum > 30 ? '#92400e' : '#991b1b';
    var badgeBg = pctNum > 60 ? '#dcfce7' : pctNum > 30 ? '#fef3c7' : '#fee2e2';

    var headerHtml =
      '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px;margin-bottom:16px;">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:10px;">' +
      '<div>' +
      '<h4 style="margin:0;font-size:16px;color:#0f172a;">👤 ' + esc(r.userName || 'Candidate') + ' (' + esc(r.userEmail || 'No email') + ')</h4>' +
      '<div style="font-size:13px;color:#64748b;margin-top:2px;">Test: <strong>' + esc(r.testTitle || 'Official Test') + '</strong></div>' +
      '</div>' +
      '<div style="text-align:right;">' +
      '<div style="font-size:20px;font-weight:800;background:' + badgeBg + ';color:' + badgeColor + ';padding:4px 14px;border-radius:20px;display:inline-block;">Score: ' + pctNum + '%</div>' +
      '</div>' +
      '</div>' +
      '<div style="display:flex;gap:16px;font-size:13px;color:#475569;flex-wrap:wrap;">' +
      '<span>✓ <strong>' + (r.correctCount || 0) + '</strong> Correct</span>' +
      '<span>✕ <strong>' + (r.wrongCount || 0) + '</strong> Incorrect</span>' +
      '<span>📋 <strong>' + (r.totalQuestions || (r.questions || []).length) + '</strong> Total Questions</span>' +
      '<span>🕒 Submitted: <strong>' + subDateStr + '</strong></span>' +
      '</div>' +
      '</div>';

    var questionsList = r.questions || [];
    var userAnswers = r.userAnswers || {};

    var qListHtml = '';
    if (!questionsList.length) {
      qListHtml = '<div class="muted" style="text-align:center;padding:20px;">No detailed question breakdown recorded for this submission.</div>';
    } else {
      qListHtml = questionsList.map(function (q, qIdx) {
        var userAns = q.userAnswer !== undefined ? q.userAnswer : userAnswers[qIdx];
        
        // Evaluate correctness if not pre-computed
        var isOk = q.isCorrect;
        if (isOk === undefined) {
          if (q.type === 'mcq_multi') {
            var expectedIndices = (q.correctAnswerIndices || []).slice().sort();
            var userIndices = Array.isArray(userAns) ? userAns.slice().sort() : [];
            isOk = expectedIndices.length > 0 &&
                   expectedIndices.length === userIndices.length &&
                   expectedIndices.every(function (v, i) { return v === userIndices[i]; });
          } else if (q.options && q.options.length) {
            isOk = userAns === q.correctAnswerIndex;
          } else {
            var expStr = (q.correctAnswerText || (q.correctAnswers ? q.correctAnswers[0] : '')).trim().toLowerCase();
            var actStr = typeof userAns === 'string' ? userAns.trim().toLowerCase() : '';
            isOk = expStr.length > 0 && expStr === actStr;
          }
        }

        var borderStyle = isOk ? 'border-left: 5px solid #22c55e;' : 'border-left: 5px solid #ef4444;';
        var badgeHtml = isOk
          ? '<span style="color:#16a34a;font-weight:700;font-size:12px;background:#dcfce7;padding:2px 8px;border-radius:6px;">✓ Correct</span>'
          : '<span style="color:#dc2626;font-weight:700;font-size:12px;background:#fee2e2;padding:2px 8px;border-radius:6px;">✕ Incorrect</span>';

        var userChoiceStr = 'Not answered';
        var correctChoiceStr = '—';

        if (q.type === 'mcq_multi') {
          var userArr = Array.isArray(userAns) ? userAns : [];
          userChoiceStr = userArr.length ? userArr.map(function (i) { return q.options[i] || ('Option ' + (i+1)); }).join(', ') : 'Not answered';
          var expArr = q.correctAnswerIndices || [];
          correctChoiceStr = expArr.map(function (i) { return q.options[i] || ('Option ' + (i+1)); }).join(', ');
        } else if (q.options && q.options.length) {
          userChoiceStr = userAns !== undefined && userAns !== null ? (q.options[userAns] || 'Option ' + (userAns+1)) : 'Not answered';
          correctChoiceStr = q.correctAnswerIndex !== null && q.correctAnswerIndex !== undefined ? (q.options[q.correctAnswerIndex] || '—') : '—';
        } else {
          userChoiceStr = typeof userAns === 'string' ? userAns : (Array.isArray(userAns) ? userAns.join(', ') : 'Not answered');
          correctChoiceStr = q.correctAnswerText || (q.correctAnswers ? q.correctAnswers.join(', ') : '—');
        }

        return (
          '<div style="background:#ffffff;border:1px solid #cbd5e1;' + borderStyle + 'border-radius:10px;padding:14px;margin-bottom:12px;word-break:break-word;overflow-wrap:break-word;">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;font-size:12px;">' +
          '<span style="font-weight:700;color:#64748b;">Q' + (qIdx + 1) + ' · ' + esc(q.groupTitle || 'Evaluation') + '</span>' +
          badgeHtml +
          '</div>' +
          '<div style="font-size:14px;font-weight:600;color:#0f172a;margin-bottom:10px;line-height:1.5;word-break:break-word;">' + esc(q.text || '') + '</div>' +
          '<div style="font-size:13px;color:#334155;background:#f8fafc;padding:10px;border-radius:8px;border:1px solid #e2e8f0;">' +
          '<div style="margin-bottom:4px;"><strong>Student Choice / Answer:</strong> <span style="color:' + (isOk ? '#166534' : '#991b1b') + ';font-weight:600;">' + esc(userChoiceStr) + '</span></div>' +
          (!isOk ? '<div><strong>Expected Correct Answer:</strong> <span style="color:#16a34a;font-weight:600;">' + esc(correctChoiceStr) + '</span></div>' : '') +
          '</div>' +
          '</div>'
        );
      }).join('');
    }

    if (bodyEl) {
      bodyEl.innerHTML = headerHtml + '<h3>Detailed Question Evaluation:</h3>' + qListHtml;
    }

    var modal = $('student-detailed-report-modal');
    if (modal) modal.classList.remove('hidden');
  };

  function openTestModal(test) {
    var modal = $('test-modal');
    if (!modal) return;

    $('test-form-id').value = test ? test.id : '';
    $('test-form-title').value = test ? test.title : '';
    $('test-form-start').value = test && test.startTime ? new Date(test.startTime).toISOString().slice(0, 16) : '';
    $('test-form-end').value = test && test.endTime ? new Date(test.endTime).toISOString().slice(0, 16) : '';
    $('test-form-duration').value = test && test.durationMinutes ? test.durationMinutes : '';
    $('test-form-instructions').value = test && test.instructions ? test.instructions : '';
    $('test-modal-title').textContent = test ? 'Edit Official Test' : 'Create Official Test';

    builderQuestions = test && test.questions ? JSON.parse(JSON.stringify(test.questions)) : [];
    if (!builderQuestions.length) {
      addTestQuestion();
    } else {
      renderQuestionBuilder();
    }

    $('test-title-feedback').textContent = '';
    isTitleUnique = true;
    modal.classList.remove('hidden');
  }

  function closeTestModal() {
    var modal = $('test-modal');
    if (modal) modal.classList.add('hidden');
  }

  function checkTitleUniqueness() {
    var title = ($('test-form-title').value || '').trim();
    var currentId = $('test-form-id').value;
    var feedbackEl = $('test-title-feedback');
    if (!title) {
      feedbackEl.textContent = '';
      isTitleUnique = false;
      return;
    }

    api('/tests/check-title?title=' + encodeURIComponent(title) + '&testId=' + encodeURIComponent(currentId))
      .then(function (res) {
        if (res.exists) {
          feedbackEl.style.color = '#dc2626';
          feedbackEl.textContent = '❌ A test with this title already exists. Please choose a unique title.';
          isTitleUnique = false;
        } else {
          feedbackEl.style.color = '#16a34a';
          feedbackEl.textContent = '✓ Title is available';
          isTitleUnique = true;
        }
      })
      .catch(function () {
        isTitleUnique = true;
      });
  }

  function addTestQuestion() {
    builderQuestions.push({
      id: 'q_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      type: 'mcq',
      text: '',
      groupTitle: 'General Evaluation',
      options: ['Option A', 'Option B', 'Option C', 'Option D'],
      correctAnswerIndex: 0,
      correctAnswerText: ''
    });
    renderQuestionBuilder();
  }

  function removeTestQuestion(idx) {
    builderQuestions.splice(idx, 1);
    if (!builderQuestions.length) {
      addTestQuestion();
    } else {
      renderQuestionBuilder();
    }
  }

  function renderQuestionBuilder() {
    var container = $('test-questions-builder-container');
    if (!container) return;

    container.innerHTML = builderQuestions.map(function (q, idx) {
      var optionsHtml = '';

      if (q.type === 'mcq') {
        optionsHtml =
          '<div style="margin-top:8px;">' +
          '<div style="font-size:12px;font-weight:600;margin-bottom:4px;color:#475569;">Options (Select single correct answer):</div>' +
          '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">' +
          (q.options || ['A', 'B', 'C', 'D']).map(function (opt, oIdx) {
            var isSelected = q.correctAnswerIndex === oIdx ? 'checked' : '';
            return (
              '<div style="display:flex;align-items:center;gap:6px;">' +
              '<input type="radio" name="q_correct_' + idx + '" ' + isSelected + ' onchange="window.updateQuestionCorrect(' + idx + ', ' + oIdx + ')">' +
              '<input type="text" class="inp" value="' + esc(opt) + '" placeholder="Option ' + (oIdx + 1) + '" oninput="window.updateQuestionOption(' + idx + ', ' + oIdx + ', this.value)">' +
              '</div>'
            );
          }).join('') +
          '</div></div>';
      } else if (q.type === 'mcq_multi') {
        q.correctAnswerIndices = q.correctAnswerIndices || [0];
        optionsHtml =
          '<div style="margin-top:8px;">' +
          '<div style="font-size:12px;font-weight:600;margin-bottom:4px;color:#475569;">Options (Check all correct answers):</div>' +
          '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">' +
          (q.options || ['A', 'B', 'C', 'D']).map(function (opt, oIdx) {
            var isSelected = (q.correctAnswerIndices || []).indexOf(oIdx) >= 0 ? 'checked' : '';
            return (
              '<div style="display:flex;align-items:center;gap:6px;">' +
              '<input type="checkbox" ' + isSelected + ' onchange="window.updateQuestionMultiCorrect(' + idx + ', ' + oIdx + ', this.checked)">' +
              '<input type="text" class="inp" value="' + esc(opt) + '" placeholder="Option ' + (oIdx + 1) + '" oninput="window.updateQuestionOption(' + idx + ', ' + oIdx + ', this.value)">' +
              '</div>'
            );
          }).join('') +
          '</div></div>';
      } else if (q.type === 'fill_blank') {
        q.correctAnswers = q.correctAnswers || (q.correctAnswerText ? [q.correctAnswerText] : ['']);
        optionsHtml =
          '<div style="margin-top:8px;">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">' +
          '<label style="font-size:12px;font-weight:600;color:#475569;">Correct Answer(s) for Blank(s) <span style="color:#ef4444">*</span></label>' +
          '<button type="button" class="btn btn-sm" onclick="window.addQuestionBlank(' + idx + ')">+ Add Blank</button>' +
          '</div>' +
          '<div style="display:flex;flex-direction:column;gap:6px;">' +
          q.correctAnswers.map(function (ans, bIdx) {
            return (
              '<div style="display:flex;align-items:center;gap:6px;">' +
              '<span style="font-size:12px;font-weight:600;width:60px;">Blank ' + (bIdx + 1) + ':</span>' +
              '<input type="text" class="inp" value="' + esc(ans || '') + '" placeholder="Expected answer text for blank ' + (bIdx + 1) + '..." oninput="window.updateQuestionBlankText(' + idx + ', ' + bIdx + ', this.value)">' +
              (q.correctAnswers.length > 1 ? '<button type="button" class="btn btn-sm danger-outline" onclick="window.removeQuestionBlank(' + idx + ', ' + bIdx + ')">✕</button>' : '') +
              '</div>'
            );
          }).join('') +
          '</div></div>';
      } else if (q.type === 'true_false') {
        optionsHtml =
          '<div style="display:flex;gap:16px;margin-top:8px;">' +
          '<label style="font-weight:600;"><input type="radio" name="q_correct_' + idx + '" ' + (q.correctAnswerIndex === 0 ? 'checked' : '') + ' onchange="window.updateQuestionTrueFalse(' + idx + ', 0)"> True</label>' +
          '<label style="font-weight:600;"><input type="radio" name="q_correct_' + idx + '" ' + (q.correctAnswerIndex === 1 ? 'checked' : '') + ' onchange="window.updateQuestionTrueFalse(' + idx + ', 1)"> False</label>' +
          '</div>';
      }

      return (
        '<div style="border:1px solid #cbd5e1;border-radius:12px;padding:14px;background:#ffffff;margin-bottom:8px;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">' +
        '<strong>Question ' + (idx + 1) + '</strong>' +
        '<div style="display:flex;gap:8px;align-items:center;">' +
        '<select class="inp" style="width:180px;padding:4px 8px;font-size:12px;font-weight:600;" onchange="window.updateQuestionType(' + idx + ', this.value)">' +
        '<option value="mcq" ' + (q.type === 'mcq' ? 'selected' : '') + '>MCQ (Single Answer)</option>' +
        '<option value="mcq_multi" ' + (q.type === 'mcq_multi' ? 'selected' : '') + '>MCQ (Multiple Answers)</option>' +
        '<option value="fill_blank" ' + (q.type === 'fill_blank' ? 'selected' : '') + '>Fill in Blanks (1 or Multi)</option>' +
        '<option value="true_false" ' + (q.type === 'true_false' ? 'selected' : '') + '>True / False</option>' +
        '</select>' +
        '<button type="button" class="btn btn-sm danger-outline" onclick="window.removeTestQuestion(' + idx + ')">✕ Remove</button>' +
        '</div>' +
        '</div>' +
        '<input type="text" class="inp" value="' + esc(q.text || '') + '" placeholder="Enter question prompt..." oninput="window.updateQuestionText(' + idx + ', this.value)" style="margin-bottom:6px;">' +
        optionsHtml +
        '</div>'
      );
    }).join('');
  }

  window.updateQuestionType = function (idx, type) {
    if (!builderQuestions[idx]) return;
    builderQuestions[idx].type = type;
    if (type === 'mcq') {
      builderQuestions[idx].options = builderQuestions[idx].options || ['Option A', 'Option B', 'Option C', 'Option D'];
      builderQuestions[idx].correctAnswerIndex = 0;
    } else if (type === 'mcq_multi') {
      builderQuestions[idx].options = builderQuestions[idx].options || ['Option A', 'Option B', 'Option C', 'Option D'];
      builderQuestions[idx].correctAnswerIndices = builderQuestions[idx].correctAnswerIndices || [0];
    } else if (type === 'fill_blank') {
      builderQuestions[idx].correctAnswers = builderQuestions[idx].correctAnswers || [''];
    } else if (type === 'true_false') {
      builderQuestions[idx].options = ['True', 'False'];
      builderQuestions[idx].correctAnswerIndex = 0;
    }
    renderQuestionBuilder();
  };

  window.updateQuestionText = function (idx, text) {
    if (builderQuestions[idx]) builderQuestions[idx].text = text;
  };

  window.updateQuestionOption = function (qIdx, oIdx, val) {
    if (builderQuestions[qIdx] && builderQuestions[qIdx].options) {
      builderQuestions[qIdx].options[oIdx] = val;
    }
  };

  window.updateQuestionCorrect = function (qIdx, oIdx) {
    if (builderQuestions[qIdx]) builderQuestions[qIdx].correctAnswerIndex = oIdx;
  };

  window.updateQuestionMultiCorrect = function (qIdx, oIdx, isChecked) {
    if (!builderQuestions[qIdx]) return;
    var list = builderQuestions[qIdx].correctAnswerIndices || [];
    if (isChecked) {
      if (list.indexOf(oIdx) === -1) list.push(oIdx);
    } else {
      var pos = list.indexOf(oIdx);
      if (pos >= 0) list.splice(pos, 1);
    }
    builderQuestions[qIdx].correctAnswerIndices = list;
  };

  window.addQuestionBlank = function (qIdx) {
    if (!builderQuestions[qIdx]) return;
    builderQuestions[qIdx].correctAnswers = builderQuestions[qIdx].correctAnswers || [];
    builderQuestions[qIdx].correctAnswers.push('');
    renderQuestionBuilder();
  };

  window.removeQuestionBlank = function (qIdx, bIdx) {
    if (!builderQuestions[qIdx] || !builderQuestions[qIdx].correctAnswers) return;
    builderQuestions[qIdx].correctAnswers.splice(bIdx, 1);
    renderQuestionBuilder();
  };

  window.updateQuestionBlankText = function (qIdx, bIdx, val) {
    if (builderQuestions[qIdx] && builderQuestions[qIdx].correctAnswers) {
      builderQuestions[qIdx].correctAnswers[bIdx] = val;
    }
  };

  window.updateQuestionCorrectText = function (qIdx, val) {
    if (builderQuestions[qIdx]) {
      builderQuestions[qIdx].correctAnswers = [val];
      builderQuestions[qIdx].correctAnswerText = val;
    }
  };

  window.updateQuestionTrueFalse = function (qIdx, val) {
    if (builderQuestions[qIdx]) {
      builderQuestions[qIdx].options = ['True', 'False'];
      builderQuestions[qIdx].correctAnswerIndex = val;
    }
  };

  window.removeTestQuestion = function (idx) {
    removeTestQuestion(idx);
  };

  window.editOfficialTest = function (id) {
    var t = (state.officialTests || []).find(function (x) { return x.id === id; });
    if (t) openTestModal(t);
  };

  window.deleteOfficialTest = function (id) {
    if (confirm('Are you sure you want to delete this official test?')) {
      api('/tests', { method: 'DELETE', body: { id: id } })
        .then(function () {
          toast('Official test deleted', true);
          loadOfficialTests();
        })
        .catch(function (err) {
          toast(err.message || 'Failed to delete test');
        });
    }
  };

  window.filterReportsByTest = function (testId, title) {
    var count = (state.officialResults || []).filter(function (r) {
      return String(r.testId) === String(testId);
    }).length;

    if (!count) {
      toast('No students have attended or submitted this test yet.');
      return;
    }

    if ($('cms-report-heading')) {
      $('cms-report-heading').textContent = '📊 Attended Students — "' + title + '" (' + count + ')';
    }

    renderOfficialResults(testId);
    if ($('view-tests-list')) $('view-tests-list').classList.add('hidden');
    if ($('view-test-submissions')) $('view-test-submissions').classList.remove('hidden');
  };

  window.showOfficialTestsList = function () {
    if ($('view-test-submissions')) $('view-test-submissions').classList.add('hidden');
    if ($('view-tests-list')) $('view-tests-list').classList.remove('hidden');
  };

  function parseLocalDatetime(str) {
    if (!str) return null;
    if (str instanceof Date) return str;
    if (typeof str === 'number') return new Date(str);

    var s = String(str).trim();
    var isPm = /pm/i.test(s);
    var isAm = /am/i.test(s);

    if (s.endsWith('Z') || s.includes('+')) {
      var dIso = new Date(s);
      if (!isNaN(dIso.getTime())) return dIso;
    }

    var clean = s.replace(/am|pm/gi, '').trim();
    var parts = clean.split(/[-T:\s\/]+/);

    if (parts.length >= 5) {
      var year = parseInt(parts[0], 10);
      var month = parseInt(parts[1], 10) - 1;
      var day = parseInt(parts[2], 10);
      var hour = parseInt(parts[3], 10);
      var min = parseInt(parts[4], 10);

      if (isPm && hour < 12) hour += 12;
      if (isAm && hour === 12) hour = 0;

      return new Date(year, month, day, hour, min);
    }

    var dDirect = new Date(s);
    return isNaN(dDirect.getTime()) ? null : dDirect;
  }

  function saveTestFromForm(e) {
    e.preventDefault();
    if (!isTitleUnique) {
      toast('Please choose a unique title for the official test.');
      return;
    }

    var title = ($('test-form-title').value || '').trim();
    var startTimeVal = $('test-form-start').value;
    var endTimeVal = $('test-form-end').value;
    var durationMinutes = parseInt($('test-form-duration').value || '0', 10) || null;
    var instructions = ($('test-form-instructions').value || '').trim();
    var testId = $('test-form-id').value;

    if (!title || !startTimeVal || !endTimeVal) {
      toast('Title, Start Time, and End Time are required.');
      return;
    }

    var startDate = parseLocalDatetime(startTimeVal);
    var endDate = parseLocalDatetime(endTimeVal);

    if (startDate.getTime() >= endDate.getTime()) {
      toast('End Time must be after Start Time.');
      return;
    }

    if (!builderQuestions.length) {
      toast('Please add at least 1 question to the test.');
      return;
    }

    var payload = {
      id: testId || undefined,
      title: title,
      startTime: startDate.toISOString(),
      endTime: endDate.toISOString(),
      durationMinutes: durationMinutes,
      instructions: instructions,
      questions: builderQuestions
    };

    var method = testId ? 'PUT' : 'POST';
    api('/tests', { method: method, body: payload })
      .then(function () {
        toast('Official Test saved successfully!', true);
        closeTestModal();
        loadOfficialTests();
      })
      .catch(function (err) {
        toast(err.message || 'Failed to save test');
      });
  }

  if ($('btn-create-test')) $('btn-create-test').onclick = function () { openTestModal(null); };
  if ($('test-modal-cancel')) $('test-modal-cancel').onclick = closeTestModal;
  if ($('test-form')) $('test-form').onsubmit = saveTestFromForm;
  if ($('btn-add-test-question')) $('btn-add-test-question').onclick = addTestQuestion;
  if ($('test-form-title')) $('test-form-title').onblur = checkTitleUniqueness;
  if ($('test-search')) $('test-search').oninput = renderOfficialTests;
  if ($('cms-report-search')) $('cms-report-search').oninput = function () { renderOfficialResults(); };

  /* ══ TENSES GROUP QUESTION IMPORT & PICKER ══ */
  function getQuestionText(item) {
    if (!item) return '';
    if (typeof item === 'string') return item;
    if (item.q) return item.q;
    if (item.story) return item.story + '\n\nQuestion: ' + ((item.questions && item.questions[0] && item.questions[0].q) || '');
    if (item.text) return item.text;
    if (item.title) return item.title;
    return JSON.stringify(item);
  }

  function isQuestionInBuilder(promptText) {
    if (!promptText) return false;
    var cleanText = promptText.trim().toLowerCase();
    return builderQuestions.some(function (q) {
      return (q.text || '').trim().toLowerCase() === cleanText;
    });
  }

  function convertGroupItemToQuestion(item, groupName) {
    if (!item) return null;
    var qObj = {
      id: 'q_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      groupTitle: groupName || 'Tenses Evaluation',
      type: 'mcq',
      text: getQuestionText(item),
      options: ['Option A', 'Option B', 'Option C', 'Option D'],
      correctAnswerIndex: 0,
      correctAnswerText: ''
    };

    if (item.q && item.options) {
      qObj.type = 'mcq';
      qObj.options = item.options;
      qObj.correctAnswerIndex = item.answer !== undefined ? item.answer : 0;
    } else if (item.story && item.questions && item.questions.length) {
      var firstQ = item.questions[0];
      qObj.type = 'mcq';
      qObj.options = firstQ.options || ['A', 'B', 'C', 'D'];
      qObj.correctAnswerIndex = firstQ.answer !== undefined ? firstQ.answer : 0;
    } else if (item.text) {
      qObj.type = 'fill_blank';
      qObj.correctAnswerText = item.text;
      qObj.correctAnswers = [item.text];
    } else if (item.title) {
      qObj.type = 'fill_blank';
      qObj.correctAnswerText = item.title;
      qObj.correctAnswers = [item.title];
    }
    return qObj;
  }

  function importRandomGroupQuestions() {
    var checkBoxes = document.querySelectorAll('input[name="import_group_chk"]:checked');
    var selectedGroups = [];
    checkBoxes.forEach(function (cb) { selectedGroups.push(cb.value); });

    if (!selectedGroups.length) {
      toast('Please select at least one Tenses group checkbox.');
      return;
    }

    var countInp = $('test-import-count');
    var totalCount = parseInt(countInp ? countInp.value : '5', 10) || 5;

    var pool = [];
    selectedGroups.forEach(function (grpKey) {
      var items = (state.tenses && state.tenses[grpKey]) ? state.tenses[grpKey] : [];
      var optionEl = document.querySelector('#test-import-groups-checkboxes label input[value="' + grpKey + '"]');
      var groupName = optionEl && optionEl.parentElement ? optionEl.parentElement.textContent.trim() : grpKey;

      items.forEach(function (it) {
        var txt = getQuestionText(it);
        // Filter out questions that are ALREADY in builderQuestions to prevent duplicates
        if (!isQuestionInBuilder(txt)) {
          pool.push({ item: it, groupName: groupName });
        }
      });
    });

    if (!pool.length) {
      toast('All available questions from selected groups have already been added to this test.');
      return;
    }

    var shuffled = pool.slice().sort(function () { return 0.5 - Math.random(); });
    var picked = shuffled.slice(0, totalCount);

    picked.forEach(function (entry) {
      var q = convertGroupItemToQuestion(entry.item, entry.groupName);
      if (q) builderQuestions.push(q);
    });

    toast('Added ' + picked.length + ' new non-duplicate questions across selected groups!', true);
    renderQuestionBuilder();
  }

  var pickerSelectedItemsMap = new Map();

  function openGroupQuestionPicker() {
    pickerSelectedItemsMap.clear();
    
    // Auto-mark questions that are ALREADY in builderQuestions
    Object.keys(state.tenses || {}).forEach(function (grpKey) {
      var items = state.tenses[grpKey] || [];
      var groupName = grpKey;
      var optionEl = document.querySelector('#test-import-groups-checkboxes label input[value="' + grpKey + '"]');
      if (optionEl && optionEl.parentElement) groupName = optionEl.parentElement.textContent.trim();

      items.forEach(function (it, idx) {
        var txt = getQuestionText(it);
        if (isQuestionInBuilder(txt)) {
          pickerSelectedItemsMap.set(grpKey + '_' + idx, { item: it, groupName: groupName, preExisting: true });
        }
      });
    });

    var modalGroupSelect = $('modal-picker-group-select');
    if (modalGroupSelect && modalGroupSelect.options.length) {
      modalGroupSelect.selectedIndex = 0;
    }

    if ($('group-picker-search')) $('group-picker-search').value = '';
    if ($('chk-picker-select-all')) $('chk-picker-select-all').checked = false;

    renderGroupPickerList();
    var modal = $('group-question-picker-modal');
    if (modal) modal.classList.remove('hidden');
  }

  function closeGroupQuestionPicker() {
    var modal = $('group-question-picker-modal');
    if (modal) modal.classList.add('hidden');
  }

  function renderGroupPickerList() {
    var listContainer = $('group-picker-list');
    var search = ($('group-picker-search') ? $('group-picker-search').value : '').trim().toLowerCase();
    var modalGroupSelect = $('modal-picker-group-select');
    if (!listContainer || !modalGroupSelect) return;

    var grp = modalGroupSelect.value;
    var groupName = modalGroupSelect.options[modalGroupSelect.selectedIndex].text;
    var currentGroupItems = (state.tenses && state.tenses[grp]) ? state.tenses[grp] : [];

    var itemsToDisplay = currentGroupItems;
    if (search) {
      itemsToDisplay = itemsToDisplay.filter(function (it) {
        var str = getQuestionText(it).toLowerCase();
        return str.indexOf(search) >= 0;
      });
    }

    if (!itemsToDisplay.length) {
      listContainer.innerHTML = '<div class="muted" style="text-align:center;padding:20px;">No questions match search filter in ' + esc(groupName) + '.</div>';
      return;
    }

    listContainer.innerHTML = itemsToDisplay.map(function (it) {
      var origIdx = currentGroupItems.indexOf(it);
      var itemKey = grp + '_' + origIdx;
      var qTxt = getQuestionText(it);
      var isAlreadyAdded = isQuestionInBuilder(qTxt);
      var isChecked = pickerSelectedItemsMap.has(itemKey) || isAlreadyAdded ? 'checked' : '';
      var previewText = qTxt.length > 130 ? qTxt.slice(0, 130) + '...' : qTxt;

      var addedBadge = isAlreadyAdded
        ? '<span class="status-badge badge-active" style="margin-left:8px;font-size:10px;padding:2px 8px;">✓ Added to Test</span>'
        : '';

      var cardBg = isAlreadyAdded ? '#f0fdf4' : '#f8fafc';
      var cardBorder = isAlreadyAdded ? '#bbf7d0' : '#e2e8f0';

      return (
        '<label style="display:flex;align-items:flex-start;gap:10px;padding:8px 12px;border:1px solid ' + cardBorder + ';border-radius:8px;background:' + cardBg + ';cursor:pointer;">' +
        '<input type="checkbox" style="margin-top:3px;" ' + isChecked + ' onchange="window.togglePickerItem(\'' + grp + '\', ' + origIdx + ', \'' + esc(groupName).replace(/'/g, "\\'") + '\', this.checked)">' +
        '<div style="font-size:13px;flex:1;">' +
        '<strong>[' + esc(groupName) + '] Q' + (origIdx + 1) + ':</strong> ' + esc(previewText) + addedBadge +
        '</div>' +
        '</label>'
      );
    }).join('');

    updatePickerCountDisplay();
  }

  function updatePickerCountDisplay() {
    if ($('group-picker-count')) {
      $('group-picker-count').textContent = pickerSelectedItemsMap.size + ' questions selected';
    }
  }

  window.togglePickerItem = function (grp, origIdx, groupName, isChecked) {
    var itemKey = grp + '_' + origIdx;
    if (isChecked) {
      var item = (state.tenses && state.tenses[grp]) ? state.tenses[grp][origIdx] : null;
      if (item) pickerSelectedItemsMap.set(itemKey, { item: item, groupName: groupName });
    } else {
      pickerSelectedItemsMap.delete(itemKey);
    }
    updatePickerCountDisplay();
  };

  function addSelectedPickerQuestions() {
    if (!pickerSelectedItemsMap.size) {
      toast('Please select at least 1 question.');
      return;
    }

    var addedCount = 0;
    pickerSelectedItemsMap.forEach(function (val) {
      var txt = getQuestionText(val.item);
      if (!isQuestionInBuilder(txt)) {
        var q = convertGroupItemToQuestion(val.item, val.groupName);
        if (q) {
          builderQuestions.push(q);
          addedCount++;
        }
      }
    });

    if (addedCount > 0) {
      toast('Added ' + addedCount + ' new question(s) to test!', true);
    } else {
      toast('Selected questions are already present in the test.', true);
    }

    closeGroupQuestionPicker();
    renderQuestionBuilder();
  }

  if ($('btn-import-random-questions')) $('btn-import-random-questions').onclick = importRandomGroupQuestions;
  if ($('btn-open-group-picker')) $('btn-open-group-picker').onclick = openGroupQuestionPicker;
  if ($('btn-group-picker-cancel')) $('btn-group-picker-cancel').onclick = closeGroupQuestionPicker;
  if ($('group-picker-modal-backdrop')) $('group-picker-modal-backdrop').onclick = closeGroupQuestionPicker;
  if ($('btn-group-picker-add')) $('btn-group-picker-add').onclick = addSelectedPickerQuestions;
  if ($('group-picker-search')) $('group-picker-search').oninput = renderGroupPickerList;
  if ($('modal-picker-group-select')) $('modal-picker-group-select').onchange = function () {
    if ($('chk-picker-select-all')) $('chk-picker-select-all').checked = false;
    renderGroupPickerList();
  };
  if ($('chk-picker-select-all')) $('chk-picker-select-all').onchange = function (e) {
    var checkAll = e.target.checked;
    var modalGroupSelect = $('modal-picker-group-select');
    if (!modalGroupSelect) return;
    var grp = modalGroupSelect.value;
    var groupName = modalGroupSelect.options[modalGroupSelect.selectedIndex].text;
    var currentGroupItems = (state.tenses && state.tenses[grp]) ? state.tenses[grp] : [];

    currentGroupItems.forEach(function (it, idx) {
      var itemKey = grp + '_' + idx;
      if (checkAll) {
        pickerSelectedItemsMap.set(itemKey, { item: it, groupName: groupName });
      } else {
        pickerSelectedItemsMap.delete(itemKey);
      }
    });
    renderGroupPickerList();
  };

  if ($('cms-login-btn')) $('cms-login-btn').onclick = login;
  if ($('cms-key-inp')) {
    $('cms-key-inp').onkeydown = function (e) {
      if (e.key === 'Enter') login();
    };
  }
  if ($('btn-logout')) $('btn-logout').onclick = logout;
  if ($('btn-reload')) $('btn-reload').onclick = loadContent;
  if ($('btn-publish')) $('btn-publish').onclick = publish;

  if ($('btn-add-word')) $('btn-add-word').onclick = function () { openWordModal(null); };
  if ($('word-modal-cancel')) $('word-modal-cancel').onclick = closeWordModal;
  if ($('word-form')) $('word-form').onsubmit = saveWordFromForm;
  var backdrop = document.querySelector('.modal-backdrop');
  if (backdrop) backdrop.onclick = closeWordModal;
  if ($('btn-dict-add')) $('btn-dict-add').onclick = addDictWord;
  if ($('btn-import-run')) $('btn-import-run').onclick = runImport;
  if ($('btn-export-disk')) {
    $('btn-export-disk').onclick = function () {
      api('/export/write', { method: 'POST', body: {} })
        .then(function (data) {
          toast('Wrote ' + data.files.length + ' files to cms/export/', true);
        })
        .catch(function (e) {
          toast(e.message);
        });
    };
  }

  document.querySelectorAll('.nav-btn').forEach(function (btn) {
    btn.onclick = function () {
      document.querySelectorAll('.nav-btn').forEach(function (b) {
        b.classList.remove('active');
      });
      document.querySelectorAll('.tab-panel').forEach(function (p) {
        p.classList.remove('active');
      });
      btn.classList.add('active');
      var targetTab = $('tab-' + btn.getAttribute('data-tab'));
      if (targetTab) targetTab.classList.add('active');
    };
  });

  if ($('tab-lists')) {
    var listsSaveBtn = document.createElement('button');
    listsSaveBtn.type = 'button';
    listsSaveBtn.className = 'btn primary';
    listsSaveBtn.textContent = 'Save list settings';
    listsSaveBtn.style.marginTop = '12px';
    listsSaveBtn.onclick = saveLists;
    $('tab-lists').appendChild(listsSaveBtn);
  }

  api('/status')
    .then(function () {
      showApp(true);
      loadContent();
    })
    .catch(function () {
      showApp(false);
    });
})();
