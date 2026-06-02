/**
 * Export LexiQuest content to CSV files for Google Sheets CMS editing.
 * Run: node scripts/cms-export-csv.js
 * Output: cms/export/*.csv
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'cms', 'export');

function escCsv(val) {
  var s = val == null ? '' : String(val);
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function writeCsv(file, headers, rows) {
  var lines = [headers.map(escCsv).join(',')];
  rows.forEach(function (row) {
    lines.push(headers.map(function (h) {
      return escCsv(row[h]);
    }).join(','));
  });
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, lines.join('\n'), 'utf8');
  console.log('Wrote', file, '(' + rows.length + ' rows)');
}

var words = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'words-merged.json'), 'utf8'));
var lists = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'word-lists.json'), 'utf8'));

writeCsv(
  path.join(OUT, 'Words.csv'),
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

writeCsv(
  path.join(OUT, 'WordLists.csv'),
  ['id', 'listNum', 'title', 'listType', 'icon', 'color'],
  lists.lists.map(function (l) {
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
lists.lists.forEach(function (l) {
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
writeCsv(path.join(OUT, 'Groups.csv'), ['listId', 'groupId', 'groupNum', 'title'], groupRows);

var dictRows = [];
lists.lists.forEach(function (l) {
  if (l.listType !== 'dictionary') return;
  (l.words || []).forEach(function (entry) {
    dictRows.push({
      listId: l.id,
      word: typeof entry === 'string' ? entry : entry.word,
      index: typeof entry === 'string' ? '' : entry.index,
    });
  });
});
writeCsv(path.join(OUT, 'DictionaryWords.csv'), ['listId', 'word', 'index'], dictRows);

var memberRows = [];
lists.lists.forEach(function (l) {
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
writeCsv(path.join(OUT, 'GroupWords.csv'), ['listId', 'groupId', 'word', 'index', 'role'], memberRows);

console.log('\nUpload cms/export/*.csv to Google Sheets (one tab per file).');
console.log('After editing, download as CSV into cms/import/ and run: npm run cms:import');
