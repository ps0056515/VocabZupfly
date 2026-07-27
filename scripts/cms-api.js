/**
 * CMS API handlers — mounted at /api/cms on the main dev server.
 */
const fs = require('fs');
const path = require('path');
const cms = require('./cms-lib.js');

const API_KEY = process.env.CMS_API_KEY || 'lexiquest-cms-dev';
const CMS_DIR = path.join(cms.ROOT, 'cms');
const API_PREFIX = '/api/cms';

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

function checkAuth(req, url) {
  var key = req.headers['x-cms-key'] || '';
  if (!key && url.searchParams.get('key')) key = url.searchParams.get('key');
  return key === API_KEY;
}

function serveCmsFile(res, filePath, contentType) {
  if (!fs.existsSync(filePath)) {
    res.writeHead(404);
    res.end('Not found');
    return true;
  }
  res.writeHead(200, { 'Content-Type': contentType });
  res.end(fs.readFileSync(filePath));
  return true;
}

/** Serve CMS admin UI under /cms */
function handleCmsStatic(pathname, res) {
  if (pathname === '/cms' || pathname === '/cms/') {
    res.writeHead(302, { Location: '/cms/admin.html' });
    res.end();
    return true;
  }
  if (pathname === '/cms/admin.html') {
    return serveCmsFile(res, path.join(CMS_DIR, 'admin.html'), 'text/html; charset=utf-8');
  }
  if (pathname === '/cms/cms-admin.css') {
    return serveCmsFile(res, path.join(CMS_DIR, 'cms-admin.css'), 'text/css');
  }
  if (pathname === '/cms/cms-admin.js') {
    return serveCmsFile(res, path.join(CMS_DIR, 'cms-admin.js'), 'application/javascript');
  }
  return false;
}

async function handleCmsApi(req, res, pathname, method, url) {
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, X-CMS-Key',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    });
    res.end();
    return true;
  }

  if (!pathname.startsWith(API_PREFIX)) return false;

  if (!checkAuth(req, url)) {
    json(res, 401, { error: 'Invalid CMS API key' });
    return true;
  }

  var route = pathname.slice(API_PREFIX.length) || '/';

  try {
    if (route === '/status' && method === 'GET') {
      json(res, 200, { ok: true, manifest: cms.loadManifest() });
      return true;
    }
    if (route === '/content' && method === 'GET') {
      json(res, 200, {
        words: cms.loadWords(),
        wordLists: cms.loadWordLists(),
        manifest: cms.loadManifest(),
      });
      return true;
    }
    if (route === '/words' && method === 'PUT') {
      var body = JSON.parse(await readBody(req));
      if (!Array.isArray(body)) {
        json(res, 400, { error: 'Expected array of words' });
        return true;
      }
      cms.saveWords(body);
      var manifest = cms.updateManifest(body, cms.loadWordLists());
      json(res, 200, { ok: true, wordCount: body.length, manifest: manifest });
      return true;
    }
    if (route === '/word' && method === 'POST') {
      var word = JSON.parse(await readBody(req));
      var saved = cms.upsertWord(word);
      json(res, 200, { ok: true, word: saved });
      return true;
    }
    if (route.startsWith('/word/') && method === 'DELETE') {
      var name = decodeURIComponent(route.slice('/word/'.length));
      json(res, 200, { ok: cms.deleteWord(name) });
      return true;
    }
    if (route === '/lists' && method === 'PUT') {
      var listsBody = JSON.parse(await readBody(req));
      cms.saveWordLists(listsBody);
      var manifest2 = cms.updateManifest(cms.loadWords(), listsBody);
      json(res, 200, { ok: true, manifest: manifest2 });
      return true;
    }
    if (route === '/dictionary/add' && method === 'POST') {
      var d = JSON.parse(await readBody(req));
      cms.addDictionaryWord(d.listId, d.word);
      json(res, 200, { ok: true, wordLists: cms.loadWordLists() });
      return true;
    }
    if (route === '/import/csv' && method === 'POST') {
      var files = JSON.parse(await readBody(req));
      var result = cms.importFromCsvMap(files);
      json(res, 200, { ok: true, manifest: result.manifest, wordCount: result.words.length });
      return true;
    }
    if (route === '/export/csv' && method === 'GET') {
      json(res, 200, { files: cms.buildExportCsvs(cms.loadWords(), cms.loadWordLists()) });
      return true;
    }
    if (route === '/export/write' && method === 'POST') {
      var written = cms.writeExportFiles(path.join(cms.ROOT, 'cms', 'export'));
      json(res, 200, { ok: true, files: Object.keys(written) });
      return true;
    }
    if (route === '/publish' && method === 'POST') {
      var pubBody = {};
      try {
        pubBody = JSON.parse(await readBody(req));
      } catch (e) {}
      var pub = cms.publish(!!pubBody.syncWeb);
      json(res, pub.ok ? 200 : 500, pub);
      return true;
    }
    json(res, 404, { error: 'Unknown CMS API route' });
    return true;
  } catch (err) {
    console.error('[CMS]', err);
    json(res, 500, { error: err.message || String(err) });
    return true;
  }
}

module.exports = {
  API_KEY,
  CMS_DIR,
  handleCmsStatic,
  handleCmsApi,
};
