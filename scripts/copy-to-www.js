const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const src = path.join(root, 'lexiquest.html');
const dest = path.join(root, 'www', 'index.html');

if (!fs.existsSync(src)) {
  console.error('lexiquest.html not found at project root.');
  process.exit(1);
}

function copyDir(name) {
  const from = path.join(root, name);
  const to = path.join(root, 'www', name);
  if (!fs.existsSync(from)) return;
  fs.mkdirSync(to, { recursive: true });
  fs.readdirSync(from).forEach((f) => {
    const sf = path.join(from, f);
    const df = path.join(to, f);
    if (fs.statSync(sf).isDirectory()) {
      fs.mkdirSync(df, { recursive: true });
      fs.readdirSync(sf).forEach((g) => fs.copyFileSync(path.join(sf, g), path.join(df, g)));
    } else fs.copyFileSync(sf, df);
  });
}

fs.mkdirSync(path.join(root, 'www'), { recursive: true });
fs.copyFileSync(src, dest);
copyDir('js');
copyDir('data');
copyDir('css');
console.log('Copied lexiquest.html → www/index.html + js/ + data/ + css/');
