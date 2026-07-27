/**
 * Quick sanity check — run: node scripts/smoke-test.js
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const errors = [];

function check(name, fn) {
  try {
    fn();
    console.log('✓', name);
  } catch (e) {
    errors.push(name + ': ' + e.message);
    console.log('✗', name, '-', e.message);
  }
}

check('words-merged.json', () => {
  const words = JSON.parse(fs.readFileSync(path.join(root, 'data', 'words-merged.json'), 'utf8'));
  if (!Array.isArray(words) || words.length < 100) throw new Error('expected 100+ words, got ' + words.length);
});

check('word-lists.json', () => {
  const lists = JSON.parse(fs.readFileSync(path.join(root, 'data', 'word-lists.json'), 'utf8'));
  if (!lists.lists || !lists.lists.length) throw new Error('no lists');
});

check('tenses-content.json', () => {
  JSON.parse(fs.readFileSync(path.join(root, 'data', 'tenses-content.json'), 'utf8'));
});

check('manifest.json', () => {
  if (!fs.existsSync(path.join(root, 'manifest.json'))) throw new Error('missing at project root');
});

check('fonts/', () => {
  const fonts = path.join(root, 'fonts');
  if (!fs.existsSync(fonts)) throw new Error('run npm run copy:fonts');
});

const jsFiles = [
  'config', 'words', 'state', 'core', 'lessons', 'vocab', 'practice', 'study',
  'tutor', 'tenses', 'flow', 'boot', 'dashboard', 'features',
];
check('JS files exist', () => {
  jsFiles.forEach((f) => {
    if (!fs.existsSync(path.join(root, 'js', f + '.js'))) throw new Error('missing js/' + f + '.js');
  });
});

check('LQ.initDOMListeners in core.js', () => {
  const core = fs.readFileSync(path.join(root, 'js', 'core.js'), 'utf8');
  if (!core.includes('LQ.initDOMListeners')) throw new Error('missing initDOMListeners');
});

check('tutor chips use data-chip-idx', () => {
  const tutor = fs.readFileSync(path.join(root, 'js', 'tutor.js'), 'utf8');
  if (tutor.includes('JSON.stringify(c)')) throw new Error('broken onclick chips still present');
});

if (errors.length) {
  console.log('\n' + errors.length + ' check(s) failed');
  process.exit(1);
}
console.log('\nAll smoke checks passed');
