/**
 * LexiQuest CMS server — business team edits content via browser.
 * Run: npm run cms
 * Open: http://localhost:3457
 * Set CMS_API_KEY env for production (default: lexiquest-cms-dev)
 */
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const cms = require('./cms-lib.js');

const PORT = parseInt(process.env.CMS_PORT || '3457', 10);
const API_KEY = process.env.CMS_API_KEY || 'lexiquest-cms-dev';
const CMS_DIR = path.join(cms.ROOT, 'cms');

function readBody(req) {
  return new Promise(function (resolve, reject) {
    var chunks = [];
    req.on('data', function (c) {
      chunks.push(c);
    });
    req.on('end', function () {
      resolve(Buffer.concat(chunks).toString('utf8'));
    });
    req.on('error', reject);
  });
}

function json(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, X-CMS-Key',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  });
  res.end(JSON.stringify(data));
}

function checkAuth(req) {
  var key = req.headers['x-cms-key'] || '';
  var url = new URL(req.url, 'http://localhost');
  if (!key && url.searchParams.get('key')) key = url.searchParams.get('key');
  return key === API_KEY;
}

function serveFile(res, filePath, contentType) {
  if (!fs.existsSync(filePath)) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }
  res.writeHead(200, { 'Content-Type': contentType });
  res.end(fs.readFileSync(filePath));
}

const server = http.createServer(async function (req, res) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, X-CMS-Key',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    });
    res.end();
    return;
  }

  var url = new URL(req.url, 'http://localhost');
  var pathname = url.pathname;

  if (pathname === '/' || pathname === '/admin' || pathname === '/admin.html') {
    serveFile(res, path.join(CMS_DIR, 'admin.html'), 'text/html; charset=utf-8');
    return;
  }
  if (pathname === '/cms-admin.css') {
    serveFile(res, path.join(CMS_DIR, 'cms-admin.css'), 'text/css');
    return;
  }
  if (pathname === '/cms-admin.js') {
    serveFile(res, path.join(CMS_DIR, 'cms-admin.js'), 'application/javascript');
    return;
  }

  if (pathname.startsWith('/api/')) {
    if (!checkAuth(req)) {
      json(res, 401, { error: 'Invalid CMS API key' });
      return;
    }

    try {
      if (pathname === '/api/status' && req.method === 'GET') {
        var manifest = cms.loadManifest();
        json(res, 200, {
          ok: true,
          manifest: manifest,
          port: PORT,
        });
        return;
      }

      if (pathname === '/api/content' && req.method === 'GET') {
        json(res, 200, {
          words: cms.loadWords(),
          wordLists: cms.loadWordLists(),
          manifest: cms.loadManifest(),
        });
        return;
      }

      if (pathname === '/api/words' && req.method === 'PUT') {
        var body = JSON.parse(await readBody(req));
        if (!Array.isArray(body)) {
          json(res, 400, { error: 'Expected array of words' });
          return;
        }
        cms.saveWords(body);
        var lists = cms.loadWordLists();
        var manifest = cms.updateManifest(body, lists);
        json(res, 200, { ok: true, wordCount: body.length, manifest: manifest });
        return;
      }

      if (pathname === '/api/word' && req.method === 'POST') {
        var word = JSON.parse(await readBody(req));
        var saved = cms.upsertWord(word);
        json(res, 200, { ok: true, word: saved });
        return;
      }

      if (pathname.startsWith('/api/word/') && req.method === 'DELETE') {
        var name = decodeURIComponent(pathname.slice('/api/word/'.length));
        var removed = cms.deleteWord(name);
        json(res, 200, { ok: removed });
        return;
      }

      if (pathname === '/api/lists' && req.method === 'PUT') {
        var listsBody = JSON.parse(await readBody(req));
        cms.saveWordLists(listsBody);
        var manifest2 = cms.updateManifest(cms.loadWords(), listsBody);
        json(res, 200, { ok: true, manifest: manifest2 });
        return;
      }

      if (pathname === '/api/dictionary/add' && req.method === 'POST') {
        var d = JSON.parse(await readBody(req));
        cms.addDictionaryWord(d.listId, d.word);
        json(res, 200, { ok: true, wordLists: cms.loadWordLists() });
        return;
      }

      if (pathname === '/api/import/csv' && req.method === 'POST') {
        var files = JSON.parse(await readBody(req));
        var result = cms.importFromCsvMap(files);
        json(res, 200, { ok: true, manifest: result.manifest, wordCount: result.words.length });
        return;
      }

      if (pathname === '/api/export/csv' && req.method === 'GET') {
        var csvs = cms.buildExportCsvs(cms.loadWords(), cms.loadWordLists());
        json(res, 200, { files: csvs });
        return;
      }

      if (pathname === '/api/export/write' && req.method === 'POST') {
        var dir = path.join(cms.ROOT, 'cms', 'export');
        var written = cms.writeExportFiles(dir);
        json(res, 200, { ok: true, files: Object.keys(written) });
        return;
      }

      if (pathname === '/api/publish' && req.method === 'POST') {
        var pubBody = {};
        try {
          pubBody = JSON.parse(await readBody(req));
        } catch (e) {}
        var pub = cms.publish(!!pubBody.syncWeb);
        json(res, pub.ok ? 200 : 500, pub);
        return;
      }

      json(res, 404, { error: 'Unknown API route' });
    } catch (err) {
      console.error(err);
      json(res, 500, { error: err.message || String(err) });
    }
    return;
  }

  res.writeHead(302, { Location: '/' });
  res.end();
});

server.listen(PORT, function () {
  console.log('');
  console.log('  LexiQuest CMS');
  console.log('  Open: http://localhost:' + PORT);
  console.log('  API key: ' + API_KEY + ' (set CMS_API_KEY to change)');
  console.log('');
});
