/**
 * Import CMS CSV edits from cms/import/ back into data/*.json
 * Run: npm run cms:import
 */
const path = require('path');
const fs = require('fs');
const cms = require('./cms-lib');

const IN = path.join(cms.ROOT, 'cms', 'import');

if (!fs.existsSync(IN)) {
  console.error('Create cms/import/ and place edited CSV files there.');
  process.exit(1);
}

var filesMap = {};
cms.CSV_NAMES.forEach(function (name) {
  var file = path.join(IN, name);
  if (fs.existsSync(file)) {
    filesMap[name] = fs.readFileSync(file, 'utf8');
    console.log('Read', name);
  }
});

if (!Object.keys(filesMap).length) {
  console.error('No CSV files in cms/import/');
  process.exit(1);
}

var result = cms.importFromCsvMap(filesMap);
console.log('Import done:', result.words.length, 'words,', result.wordLists.listCount, 'lists');
console.log('Manifest version:', result.manifest.version);
console.log('\nRun npm run prepare:web to sync www/');
