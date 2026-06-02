const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const outDirs = [path.join(root, 'www', 'fonts'), path.join(root, 'fonts')];
const copies = [
  ['node_modules/@fontsource/plus-jakarta-sans/files/plus-jakarta-sans-latin-400-normal.woff2', 'plus-jakarta-400.woff2'],
  ['node_modules/@fontsource/plus-jakarta-sans/files/plus-jakarta-sans-latin-500-normal.woff2', 'plus-jakarta-500.woff2'],
  ['node_modules/@fontsource/plus-jakarta-sans/files/plus-jakarta-sans-latin-600-normal.woff2', 'plus-jakarta-600.woff2'],
  ['node_modules/@fontsource/plus-jakarta-sans/files/plus-jakarta-sans-latin-400-italic.woff2', 'plus-jakarta-400-italic.woff2'],
  ['node_modules/@fontsource/syne/files/syne-latin-600-normal.woff2', 'syne-600.woff2'],
  ['node_modules/@fontsource/syne/files/syne-latin-700-normal.woff2', 'syne-700.woff2'],
];

fs.mkdirSync(outDirs[0], { recursive: true });
fs.mkdirSync(outDirs[1], { recursive: true });
for (const [src, name] of copies) {
  const from = path.join(root, src);
  if (!fs.existsSync(from)) {
    console.error('Missing font file:', from);
    process.exit(1);
  }
  outDirs.forEach(function (out) {
    fs.copyFileSync(from, path.join(out, name));
  });
}
console.log('Copied', copies.length, 'font files to www/fonts/ and fonts/');
