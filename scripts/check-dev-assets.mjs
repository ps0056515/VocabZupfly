/**
 * Verify dev server serves lexiquest.html and all linked assets.
 * Usage: node scripts/check-dev-assets.mjs [baseUrl]
 */
import http from 'http';

const base = process.argv[2] || 'http://127.0.0.1:3456';
const htmlUrl = base.replace(/\/$/, '') + '/lexiquest.html';

function get(url) {
  return new Promise((resolve, reject) => {
    http
      .get(url, (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => resolve({ status: res.statusCode, body }));
      })
      .on('error', reject);
  });
}

const { status, body } = await get(htmlUrl);
if (status !== 200) {
  console.error('FAIL', htmlUrl, 'status', status);
  process.exit(1);
}

const assets = new Set();
for (const m of body.matchAll(/(?:href|src)="([^"]+)"/g)) {
  const u = m[1];
  if (u.startsWith('http') || u.startsWith('#') || u.startsWith('data:') || u.startsWith('mailto:'))
    continue;
  assets.add(u.split('?')[0]);
}

let failed = 0;
for (const rel of [...assets].sort()) {
  const url = base.replace(/\/$/, '') + '/' + rel;
  try {
    const r = await get(url);
    if (r.status !== 200) {
      console.log('FAIL', rel, r.status);
      failed++;
    }
  } catch (e) {
    console.log('FAIL', rel, e.message);
    failed++;
  }
}

if (failed) {
  console.error('\n' + failed + ' asset(s) failed');
  process.exit(1);
}
console.log('OK', htmlUrl, '+', assets.size, 'assets');
