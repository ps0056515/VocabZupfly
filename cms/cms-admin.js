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
    var headers = { 'X-CMS-Key': apiKey() };
    if (opts.body && typeof opts.body === 'object' && !(opts.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(opts.body);
    }
    return fetch(API_BASE + path, {
      method: opts.method || 'GET',
      headers: headers,
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
      loadTenses()
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

  $('btn-add-word').onclick = function () {
    openWordModal(null);
  };
  $('word-modal-cancel').onclick = closeWordModal;
  $('word-form').onsubmit = saveWordFromForm;
  document.querySelector('.modal-backdrop').onclick = closeWordModal;
  $('btn-dict-add').onclick = addDictWord;
  $('btn-import-run').onclick = runImport;
  $('btn-export-disk').onclick = function () {
    api('/export/write', { method: 'POST', body: {} })
      .then(function (data) {
        toast('Wrote ' + data.files.length + ' files to cms/export/', true);
      })
      .catch(function (e) {
        toast(e.message);
      });
  };

  document.querySelectorAll('.nav-btn').forEach(function (btn) {
    btn.onclick = function () {
      document.querySelectorAll('.nav-btn').forEach(function (b) {
        b.classList.remove('active');
      });
      document.querySelectorAll('.tab-panel').forEach(function (p) {
        p.classList.remove('active');
      });
      btn.classList.add('active');
      $('tab-' + btn.getAttribute('data-tab')).classList.add('active');
      if (btn.getAttribute('data-tab') === 'lists') {
        /* auto-save on leaving could be added; manual save via publish */
      }
    };
  });

  var listsSaveBtn = document.createElement('button');
  listsSaveBtn.type = 'button';
  listsSaveBtn.className = 'btn primary';
  listsSaveBtn.textContent = 'Save list settings';
  listsSaveBtn.style.marginTop = '12px';
  listsSaveBtn.onclick = saveLists;
  $('tab-lists').appendChild(listsSaveBtn);

  if (sessionStorage.getItem(STORAGE_KEY)) {
    api('/status')
      .then(function () {
        showApp(true);
        loadContent();
      })
      .catch(function () {
        showApp(false);
      });
  }
})();
