/**
 * LexiQuest dev server — app + CMS on one port (default 3456).
 * Run: npm run dev
 * App: http://localhost:3456/lexiquest.html
 * CMS:  http://localhost:3456/cms/
 */
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const cmsApi = require('./cms-api.js');

const ROOT = path.join(__dirname, '..');
const PORT = parseInt(process.env.PORT || process.env.DEV_PORT || '3456', 10);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.webmanifest': 'application/manifest+json',
};

const ROOT_RESOLVED = path.resolve(ROOT);
const WWW_INDEX = path.join(ROOT, 'www', 'index.html');

function safePath(urlPath) {
  var decoded = decodeURIComponent(urlPath.split('?')[0]);
  var rel = decoded.replace(/^\/+/, '') || 'lexiquest.html';
  var file = path.resolve(ROOT, rel);
  var relCheck = path.relative(ROOT_RESOLVED, file);
  if (relCheck.startsWith('..') || path.isAbsolute(relCheck)) return null;
  return file;
}

function resolveAppHtml() {
  var rootHtml = path.join(ROOT, 'lexiquest.html');
  if (fs.existsSync(rootHtml)) return rootHtml;
  if (fs.existsSync(WWW_INDEX)) return WWW_INDEX;
  return null;
}

function serveStatic(filePath, res) {
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found: ' + path.basename(filePath));
    return;
  }
  var ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
  });
  res.end(fs.readFileSync(filePath));
}

const server = http.createServer(async function (req, res) {
  var url = new URL(req.url, 'http://localhost');
  var pathname = url.pathname;

  if (cmsApi.handleCmsStatic(pathname, res)) return;
  if (await cmsApi.handleCmsApi(req, res, pathname, req.method, url)) return;

  if (pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, app: !!resolveAppHtml() }));
    return;
  }

  if (pathname === '/' || pathname === '/lexiquest.html' || pathname === '/index.html') {
    var appHtml = resolveAppHtml();
    if (appHtml) {
      serveStatic(appHtml, res);
      return;
    }
  }

  var file = safePath(pathname);
  if (!file) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  serveStatic(file, res);
});

server.on('error', function (err) {
  if (err.code === 'EADDRINUSE') {
    console.error('');
    console.error('  Port ' + PORT + ' is already in use.');
    console.error('  Stop the other server (e.g. npx serve) and run: npm run dev');
    console.error('  Or use another port: set PORT=3458 && npm run dev');
    console.error('');
    process.exit(1);
  }
  throw err;
});

server.listen(PORT, function () {
  console.log('');
  console.log('  LexiQuest dev server (app + CMS)');
  console.log('  App:  http://localhost:' + PORT + '/');
  console.log('        http://localhost:' + PORT + '/lexiquest.html');
  console.log('  CMS:  http://localhost:' + PORT + '/cms/');
  console.log('  CMS key: ' + cmsApi.API_KEY);
  console.log('');
  console.log('  Do not use "npx serve www" on this port — use npm run dev only.');
  console.log('');
});
