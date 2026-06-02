/**
 * Import CMS CSV edits from cms/import/ back into data/*.json
 * Run: node scripts/cms-import-csv.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const IN = path.join(ROOT, 'cms', 'import');

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

function readCsv(name) {
  var file = path.join(IN, name);
  if (!fs.existsSync(file)) {
    console.warn('Skip missing', name);
    return null;
  }
  return parseCsv(fs.readFileSync(file, 'utf8'));
}

if (!fs.existsSync(IN)) {
  console.error('Create cms/import/ and place edited CSV files there.');
  process.exit(1);
}

var wordRows = readCsv('Words.csv');
if (wordRows && wordRows.length) {
  var words = wordRows.map(function (r) {
    return {
      word: r.word,
      phonetic: r.phonetic,
      pos: r.pos,
      def: r.def,
      example: r.example,
      syn: r.syn,
      ant: r.ant,
      tags: r.tags ? r.tags.split('|').filter(Boolean) : ['GRE'],
      premium: r.premium === 'true',
      stub: r.stub === 'true',
    };
  });
  fs.writeFileSync(path.join(ROOT, 'data', 'words-merged.json'), JSON.stringify(words, null, 2), 'utf8');
  console.log('Updated words-merged.json (' + words.length + ' words)');
}

var listRows = readCsv('WordLists.csv');
var groupRows = readCsv('Groups.csv');
var groupWordRows = readCsv('GroupWords.csv');
var dictRows = readCsv('DictionaryWords.csv');

if (listRows && listRows.length) {
  var byId = {};
  listRows.forEach(function (r) {
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

  if (groupRows) {
    groupRows.forEach(function (r) {
      if (!byId[r.listId]) return;
      byId[r.listId].groups.push({
        id: r.groupId,
        groupNum: parseInt(r.groupNum, 10) || 0,
        title: r.title,
        words: [],
      });
    });
  }

  if (groupWordRows) {
    groupWordRows.forEach(function (r) {
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
  }

  if (dictRows) {
    dictRows.forEach(function (r) {
      var lst = byId[r.listId];
      if (!lst) return;
      lst.words.push({
        word: r.word,
        index: parseInt(r.index, 10) || lst.words.length + 1,
      });
    });
  }

  var lists = {
    source: 'CMS import',
    version: (Date.now() / 1000) | 0,
    listCount: listRows.length,
    lists: listRows.map(function (r) {
      return byId[r.id];
    }),
  };
  lists.groupCount = lists.lists.reduce(function (n, l) {
    return n + (l.groups || []).length;
  }, 0);
  lists.dictionaryListCount = lists.lists.filter(function (l) {
    return l.listType === 'dictionary';
  }).length;
  fs.writeFileSync(path.join(ROOT, 'data', 'word-lists.json'), JSON.stringify(lists, null, 2), 'utf8');
  console.log('Updated word-lists.json (' + lists.listCount + ' lists)');
}

console.log('\nRun npm run prepare:web to sync www/');
