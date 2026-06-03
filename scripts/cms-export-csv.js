/**
 * Export LexiQuest content to CSV for Google Sheets.
 * Run: npm run cms:export
 */
const path = require('path');
const cms = require('./cms-lib');

var OUT = path.join(cms.ROOT, 'cms', 'export');
var words = cms.loadWords();
var lists = cms.loadWordLists();
var csvs = cms.buildExportCsvs(words, lists);

Object.keys(csvs).forEach(function (name) {
  var file = path.join(OUT, name);
  require('fs').mkdirSync(OUT, { recursive: true });
  require('fs').writeFileSync(file, csvs[name], 'utf8');
  console.log('Wrote', file);
});

console.log('\nUpload cms/export/*.csv to Google Sheets, or use npm run cms for the web editor.');
