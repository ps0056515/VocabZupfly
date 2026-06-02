/**
 * Add a flat dictionary list to word-lists.json (no synonym groups).
 * Run: node scripts/seed-dictionary-list.js
 */
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'data', 'word-lists.json');
const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));

const SAMPLE_WORDS = [
  'Abate',
  'Ephemeral',
  'Loquacious',
  'Mitigate',
  'Pragmatic',
  'Ubiquitous',
  'Benevolent',
  'Candid',
  'Diligent',
  'Frugal',
  'Gregarious',
  'Impartial',
  'Jubilant',
  'Meticulous',
  'Nocturnal',
  'Obsolete',
  'Prudent',
  'Resilient',
  'Tenacious',
  'Verbose',
];

const existing = data.lists.find(function (l) {
  return l.id === 'dict-common';
});
if (existing) {
  console.log('dict-common already exists — skipped');
  process.exit(0);
}

data.lists.push({
  id: 'dict-common',
  listNum: data.lists.length + 1,
  title: 'Common Dictionary',
  listType: 'dictionary',
  icon: '📖',
  color: 'sky',
  groups: [],
  words: SAMPLE_WORDS.map(function (word, i) {
    return { word: word, index: i + 1 };
  }),
});

data.listCount = data.lists.length;
data.dictionaryListCount = data.lists.filter(function (l) {
  return l.listType === 'dictionary';
}).length;

fs.writeFileSync(FILE, JSON.stringify(data, null, 2), 'utf8');
console.log('Added dict-common with', SAMPLE_WORDS.length, 'words');
