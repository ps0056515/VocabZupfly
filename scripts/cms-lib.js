/**
 * LexiQuest CMS engine — shared import/export and JSON persistence.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'data');
const WORDS_FILE = path.join(DATA, 'words-merged.json');
const LISTS_FILE = path.join(DATA, 'word-lists.json');
const MANIFEST_FILE = path.join(DATA, 'content-manifest.json');
const TENSES_FILE = path.join(DATA, 'tenses-content.json');

const CSV_NAMES = ['Words.csv', 'WordLists.csv', 'Groups.csv', 'GroupWords.csv', 'DictionaryWords.csv', 'TensesQuestions.csv'];

function parseCsv(text) {
  var rows = [];
  var row = [];
  var cell = '';
  var inQuotes = false;
  for (var i = 0; i < text.length; i++) {
    var c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else inQuotes = false;
      } else cell += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(cell);
      cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      if (row.length > 1 || row[0]) rows.push(row);
      row = [];
      cell = '';
    } else cell += c;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  if (!rows.length) return [];
  var headers = rows[0].map(function (h) {
    return h.trim();
  });
  return rows.slice(1).map(function (r) {
    var obj = {};
    headers.forEach(function (h, idx) {
      obj[h] = (r[idx] || '').trim();
    });
    return obj;
  });
}

function escCsv(val) {
  var s = val == null ? '' : String(val);
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function stringifyCsv(headers, rowObjects) {
  var lines = [headers.map(escCsv).join(',')];
  rowObjects.forEach(function (row) {
    lines.push(
      headers
        .map(function (h) {
          return escCsv(row[h]);
        })
        .join(',')
    );
  });
  return lines.join('\n');
}

function loadWords() {
  if (!fs.existsSync(WORDS_FILE)) return [];
  return JSON.parse(fs.readFileSync(WORDS_FILE, 'utf8'));
}

function loadWordLists() {
  if (!fs.existsSync(LISTS_FILE)) return { lists: [] };
  return JSON.parse(fs.readFileSync(LISTS_FILE, 'utf8'));
}

function loadManifest() {
  if (!fs.existsSync(MANIFEST_FILE)) {
    return { version: 1, updated: null, wordCount: 0, listCount: 0 };
  }
  return JSON.parse(fs.readFileSync(MANIFEST_FILE, 'utf8'));
}

function saveWords(words) {
  fs.writeFileSync(WORDS_FILE, JSON.stringify(words, null, 2), 'utf8');
  return words.length;
}

function saveWordLists(listsData) {
  listsData.version = (Date.now() / 1000) | 0;
  listsData.source = listsData.source || 'LexiQuest CMS';
  listsData.listCount = (listsData.lists || []).length;
  listsData.groupCount = (listsData.lists || []).reduce(function (n, l) {
    return n + (l.groups || []).length;
  }, 0);
  listsData.dictionaryListCount = (listsData.lists || []).filter(function (l) {
    return l.listType === 'dictionary';
  }).length;
  fs.writeFileSync(LISTS_FILE, JSON.stringify(listsData, null, 2), 'utf8');
  return listsData;
}

function updateManifest(words, listsData) {
  var m = {
    version: (Date.now() / 1000) | 0,
    updated: new Date().toISOString(),
    wordCount: words.length,
    listCount: (listsData.lists || []).length,
    dictionaryListCount: listsData.dictionaryListCount || 0,
    groupCount: listsData.groupCount || 0,
  };
  fs.writeFileSync(MANIFEST_FILE, JSON.stringify(m, null, 2), 'utf8');
  return m;
}

function wordRowsToJson(rows) {
  return rows
    .filter(function (r) {
      return r.word;
    })
    .map(function (r) {
      return {
        word: r.word,
        phonetic: r.phonetic || '',
        pos: r.pos || 'word',
        def: r.def || '',
        example: r.example || '',
        syn: r.syn || '',
        ant: r.ant || '',
        tags: r.tags ? r.tags.split('|').filter(Boolean) : ['GRE', 'GMAT', 'IELTS'],
        premium: r.premium === 'true',
        stub: r.stub === 'true',
      };
    });
}

function buildListsFromCsv(listRows, groupRows, groupWordRows, dictRows) {
  var byId = {};
  (listRows || []).forEach(function (r) {
    byId[r.id] = {
      id: r.id,
      listNum: parseInt(r.listNum, 10) || 0,
      title: r.title,
      listType: r.listType || 'grouped',
      icon: r.icon || '📘',
      color: r.color || 'lavender',
      groups: [],
      words: [],
    };
  });
  (groupRows || []).forEach(function (r) {
    if (!byId[r.listId]) return;
    byId[r.listId].groups.push({
      id: r.groupId,
      groupNum: parseInt(r.groupNum, 10) || 0,
      title: r.title,
      words: [],
    });
  });
  (groupWordRows || []).forEach(function (r) {
    var lst = byId[r.listId];
    if (!lst) return;
    var g = lst.groups.find(function (x) {
      return x.id === r.groupId;
    });
    if (!g) return;
    g.words.push({
      word: r.word,
      index: parseInt(r.index, 10) || 0,
      role: r.role || 'normal',
    });
  });
  (dictRows || []).forEach(function (r) {
    var lst = byId[r.listId];
    if (!lst) return;
    lst.words.push({
      word: r.word,
      index: parseInt(r.index, 10) || lst.words.length + 1,
    });
  });
  return {
    source: 'CMS import',
    lists: (listRows || []).map(function (r) {
      return byId[r.id];
    }),
  };
}

function importFromCsvMap(filesMap) {
  var words = loadWords();
  var lists = loadWordLists();
  if (filesMap['Words.csv']) {
    words = wordRowsToJson(parseCsv(filesMap['Words.csv']));
    saveWords(words);
  }
  if (filesMap['WordLists.csv']) {
    var listRows = parseCsv(filesMap['WordLists.csv']);
    lists = buildListsFromCsv(
      listRows,
      filesMap['Groups.csv'] ? parseCsv(filesMap['Groups.csv']) : null,
      filesMap['GroupWords.csv'] ? parseCsv(filesMap['GroupWords.csv']) : null,
      filesMap['DictionaryWords.csv'] ? parseCsv(filesMap['DictionaryWords.csv']) : null
    );
    saveWordLists(lists);
  } else if (filesMap['Groups.csv'] || filesMap['GroupWords.csv'] || filesMap['DictionaryWords.csv']) {
    var existingLists = loadWordLists().lists || [];
    var listRows = existingLists.map(function (l) {
      return {
        id: l.id,
        listNum: l.listNum,
        title: l.title,
        listType: l.listType || 'grouped',
        icon: l.icon || '',
        color: l.color || '',
      };
    });
    lists = buildListsFromCsv(
      listRows,
      filesMap['Groups.csv'] ? parseCsv(filesMap['Groups.csv']) : null,
      filesMap['GroupWords.csv'] ? parseCsv(filesMap['GroupWords.csv']) : null,
      filesMap['DictionaryWords.csv'] ? parseCsv(filesMap['DictionaryWords.csv']) : null
    );
    saveWordLists(lists);
  }
  words = loadWords();
  lists = loadWordLists();
  var manifest = updateManifest(words, lists);
  return { words: words, wordLists: lists, manifest: manifest };
}

function buildExportCsvs(words, lists) {
  var out = {};
  out['Words.csv'] = stringifyCsv(
    ['word', 'phonetic', 'pos', 'def', 'example', 'syn', 'ant', 'tags', 'premium', 'stub'],
    words.map(function (w) {
      return {
        word: w.word,
        phonetic: w.phonetic || '',
        pos: w.pos || '',
        def: w.def || '',
        example: (w.example || '').replace(/<[^>]+>/g, ''),
        syn: w.syn || '',
        ant: w.ant || '',
        tags: (w.tags || []).join('|'),
        premium: w.premium ? 'true' : 'false',
        stub: w.stub ? 'true' : 'false',
      };
    })
  );
  out['WordLists.csv'] = stringifyCsv(
    ['id', 'listNum', 'title', 'listType', 'icon', 'color'],
    (lists.lists || []).map(function (l) {
      return {
        id: l.id,
        listNum: l.listNum,
        title: l.title,
        listType: l.listType || 'grouped',
        icon: l.icon || '',
        color: l.color || '',
      };
    })
  );
  var groupRows = [];
  (lists.lists || []).forEach(function (l) {
    if (l.listType === 'dictionary') return;
    (l.groups || []).forEach(function (g) {
      groupRows.push({
        listId: l.id,
        groupId: g.id,
        groupNum: g.groupNum,
        title: g.title,
      });
    });
  });
  out['Groups.csv'] = stringifyCsv(['listId', 'groupId', 'groupNum', 'title'], groupRows);
  var dictRows = [];
  (lists.lists || []).forEach(function (l) {
    if (l.listType !== 'dictionary') return;
    (l.words || []).forEach(function (entry) {
      dictRows.push({
        listId: l.id,
        word: typeof entry === 'string' ? entry : entry.word,
        index: typeof entry === 'string' ? '' : entry.index,
      });
    });
  });
  out['DictionaryWords.csv'] = stringifyCsv(['listId', 'word', 'index'], dictRows);
  var memberRows = [];
  (lists.lists || []).forEach(function (l) {
    if (l.listType === 'dictionary') return;
    (l.groups || []).forEach(function (g) {
      (g.words || []).forEach(function (entry) {
        memberRows.push({
          listId: l.id,
          groupId: g.id,
          word: entry.word,
          index: entry.index,
          role: entry.role || 'normal',
        });
      });
    });
  });
  out['GroupWords.csv'] = stringifyCsv(['listId', 'groupId', 'word', 'index', 'role'], memberRows);
  return out;
}

function writeExportFiles(dir) {
  var words = loadWords();
  var lists = loadWordLists();
  var csvs = buildExportCsvs(words, lists);
  fs.mkdirSync(dir, { recursive: true });
  Object.keys(csvs).forEach(function (name) {
    fs.writeFileSync(path.join(dir, name), csvs[name], 'utf8');
  });
  return csvs;
}

function publish(syncWeb) {
  var words = loadWords();
  var lists = loadWordLists();
  var manifest = updateManifest(words, lists);
  if (syncWeb) {
    try {
      execSync('npm run prepare:web', { cwd: ROOT, stdio: 'inherit' });
    } catch (e) {
      return { ok: false, error: 'prepare:web failed', manifest: manifest };
    }
  }
  return { ok: true, manifest: manifest, wordCount: words.length, listCount: lists.listCount };
}

function upsertWord(wordObj) {
  var words = loadWords();
  var key = wordObj.word.trim();
  if (!key) throw new Error('word is required');
  var idx = words.findIndex(function (w) {
    return w.word.toLowerCase() === key.toLowerCase();
  });
  var entry = Object.assign(
    {
      phonetic: '',
      pos: 'word',
      def: '',
      example: '',
      syn: '',
      ant: '',
      tags: ['GRE', 'GMAT', 'IELTS'],
      premium: false,
      stub: false,
    },
    idx >= 0 ? words[idx] : {},
    wordObj,
    { word: key }
  );
  if (idx >= 0) words[idx] = entry;
  else words.push(entry);
  words.sort(function (a, b) {
    return a.word.localeCompare(b.word);
  });
  saveWords(words);
  updateManifest(words, loadWordLists());
  return entry;
}

function deleteWord(wordName) {
  var words = loadWords();
  var key = wordName.toLowerCase();
  var next = words.filter(function (w) {
    return w.word.toLowerCase() !== key;
  });
  if (next.length === words.length) return false;
  saveWords(next);
  updateManifest(next, loadWordLists());
  return true;
}

function addDictionaryWord(listId, wordName) {
  var lists = loadWordLists();
  var lst = (lists.lists || []).find(function (l) {
    return l.id === listId;
  });
  if (!lst || lst.listType !== 'dictionary') throw new Error('Not a dictionary list');
  lst.words = lst.words || [];
  if (
    lst.words.some(function (e) {
      return (typeof e === 'string' ? e : e.word).toLowerCase() === wordName.toLowerCase();
    })
  ) {
    return lst;
  }
  lst.words.push({ word: wordName, index: lst.words.length + 1 });
  saveWordLists(lists);
  upsertWord({ word: wordName });
  return lst;
}

function loadTensesContent() {
  if (!fs.existsSync(TENSES_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(TENSES_FILE, 'utf8'));
  } catch (e) {
    return {};
  }
}

function saveTensesContent(content) {
  fs.writeFileSync(TENSES_FILE, JSON.stringify(content, null, 2), 'utf8');
  const wwwTenses = path.join(ROOT, 'www', 'data', 'tenses-content.json');
  if (fs.existsSync(path.dirname(wwwTenses))) {
    try {
      fs.writeFileSync(wwwTenses, JSON.stringify(content, null, 2), 'utf8');
    } catch (e) {}
  }
  return content;
}

function addTensesQuestion(group, title, category) {
  const data = loadTensesContent();
  const grp = (group || 'sentence-repeating').trim();
  if (!data[grp]) data[grp] = [];
  const qTitle = (title || '').trim();
  const qCat = (category || 'reading').trim().toLowerCase();
  
  if (!qTitle) throw new Error('Question title is required');

  const newObj = { text: qTitle, category: qCat };
  data[grp].push(newObj);
  saveTensesContent(data);
  return data;
}

function deleteTensesQuestion(group, index) {
  const data = loadTensesContent();
  if (data[group] && data[group][index] !== undefined) {
    data[group].splice(index, 1);
    saveTensesContent(data);
  }
  return data;
}

function importTensesQuestions(rows) {
  const data = loadTensesContent();
  let count = 0;
  (rows || []).forEach(function (row) {
    const grp = (row.Group || row.group || row['Group Name'] || 'sentence-repeating').trim();
    const title = (row['Question Title'] || row.title || row.text || row.Question || row.Title || '').trim();
    const cat = (row.Category || row.category || 'reading').trim().toLowerCase();

    if (title) {
      if (!data[grp]) data[grp] = [];
      data[grp].push({ text: title, category: cat });
      count++;
    }
  });
  saveTensesContent(data);
  return { count: count, data: data };
}

const OFFICIAL_TESTS_FILE = path.join(DATA, 'official-tests.json');
const OFFICIAL_RESULTS_FILE = path.join(DATA, 'official-test-results.json');

function loadOfficialTests() {
  if (!fs.existsSync(OFFICIAL_TESTS_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(OFFICIAL_TESTS_FILE, 'utf8')) || [];
  } catch (e) {
    return [];
  }
}

function saveOfficialTests(tests) {
  fs.writeFileSync(OFFICIAL_TESTS_FILE, JSON.stringify(tests, null, 2), 'utf8');
  return tests.length;
}

function loadOfficialTestResults() {
  if (!fs.existsSync(OFFICIAL_RESULTS_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(OFFICIAL_RESULTS_FILE, 'utf8')) || [];
  } catch (e) {
    return [];
  }
}

function saveOfficialTestResults(results) {
  fs.writeFileSync(OFFICIAL_RESULTS_FILE, JSON.stringify(results, null, 2), 'utf8');
  return results.length;
}

module.exports = {
  ROOT,
  CSV_NAMES,
  parseCsv,
  stringifyCsv,
  loadWords,
  loadWordLists,
  loadManifest,
  saveWords,
  saveWordLists,
  updateManifest,
  wordRowsToJson,
  buildListsFromCsv,
  importFromCsvMap,
  buildExportCsvs,
  writeExportFiles,
  publish,
  upsertWord,
  deleteWord,
  addDictionaryWord,
  loadTensesContent,
  saveTensesContent,
  addTensesQuestion,
  deleteTensesQuestion,
  importTensesQuestions,
  loadOfficialTests,
  saveOfficialTests,
  loadOfficialTestResults,
  saveOfficialTestResults,
};
