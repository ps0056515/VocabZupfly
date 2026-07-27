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

const jwt = require('jsonwebtoken');
const config = require('../server/config');

function parseCookies(req) {
  var list = {};
  var rc = req.headers.cookie;
  if (rc) {
    rc.split(';').forEach(function (cookie) {
      var parts = cookie.split('=');
      list[parts.shift().trim()] = decodeURI(parts.join('='));
    });
  }
  return list;
}

function checkAuth(req, url) {
  var key = req.headers['x-cms-key'] || '';
  if (!key && url.searchParams.get('key')) key = url.searchParams.get('key');
  if (key === API_KEY) return true;

  // Dual auth: check JWT cookie for admin or super_admin
  var cookies = parseCookies(req);
  var token = cookies.vz_access_token;
  if (token) {
    try {
      var decoded = jwt.verify(token, config.JWT_SECRET);
      if (decoded && (decoded.role === 'admin' || decoded.role === 'super_admin')) {
        return true;
      }
    } catch (e) {}
  }

  return false;
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

  var route = pathname.slice(API_PREFIX.length) || '/';
  if (route.length > 1 && route.endsWith('/')) {
    route = route.slice(0, -1);
  }

  // Public student routes that bypass CMS API key check
  var isPublicStudentRoute =
    (route === '/tests' && method === 'GET') ||
    (route === '/tests/submit' && method === 'POST') ||
    (route === '/tests/progress' && method === 'POST') ||
    (route === '/tests/results' && method === 'GET');

  if (!isPublicStudentRoute && !checkAuth(req, url)) {
    json(res, 401, { error: 'Invalid CMS API key' });
    return true;
  }

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
    if (route === '/tenses' && method === 'GET') {
      json(res, 200, { ok: true, tenses: cms.loadTensesContent() });
      return true;
    }
    if (route === '/tenses' && method === 'PUT') {
      var tensesData = JSON.parse(await readBody(req));
      cms.saveTensesContent(tensesData);
      json(res, 200, { ok: true, tenses: tensesData });
      return true;
    }
    if (route === '/tenses/question' && method === 'POST') {
      var qBody = JSON.parse(await readBody(req));
      var updated = cms.addTensesQuestion(qBody.group, qBody.title || qBody.text, qBody.category);
      json(res, 200, { ok: true, tenses: updated });
      return true;
    }
    if (route === '/tenses/question' && method === 'DELETE') {
      var qDel = JSON.parse(await readBody(req));
      var updatedDel = cms.deleteTensesQuestion(qDel.group, qDel.index);
      json(res, 200, { ok: true, tenses: updatedDel });
      return true;
    }
    if (route === '/tenses/import' && method === 'POST') {
      var importRows = JSON.parse(await readBody(req));
      var impRes = cms.importTensesQuestions(Array.isArray(importRows) ? importRows : (importRows.rows || []));
      json(res, 200, { ok: true, count: impRes.count, tenses: impRes.data });
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
    /* ══ OFFICIAL TEST ASSESSMENTS ENDPOINTS ══ */
    if (route === '/tests' && method === 'GET') {
      json(res, 200, { ok: true, tests: cms.loadOfficialTests() });
      return true;
    }
    if (route === '/tests/check-title' && method === 'GET') {
      var titleQuery = (url.searchParams.get('title') || '').trim();
      var testIdQuery = (url.searchParams.get('testId') || '').trim();
      var allTests = cms.loadOfficialTests();
      var exists = allTests.some((t) => t.title.toLowerCase() === titleQuery.toLowerCase() && t.id !== testIdQuery);
      json(res, 200, { ok: true, exists: exists });
      return true;
    }
    if (route === '/tests' && method === 'POST') {
      var newTest = JSON.parse(await readBody(req));
      var testsList = cms.loadOfficialTests();
      if (testsList.some((t) => t.title.toLowerCase() === (newTest.title || '').trim().toLowerCase())) {
        json(res, 400, { error: 'A test with this title already exists.' });
        return true;
      }
      newTest.id = newTest.id || 'test_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
      newTest.createdAt = Date.now();
      testsList.unshift(newTest);
      cms.saveOfficialTests(testsList);
      json(res, 200, { ok: true, test: newTest });
      return true;
    }
    if (route === '/tests' && method === 'PUT') {
      var updateTest = JSON.parse(await readBody(req));
      var testsList2 = cms.loadOfficialTests();
      var uIdx = testsList2.findIndex((t) => t.id === updateTest.id);
      if (uIdx === -1) {
        json(res, 404, { error: 'Test not found' });
        return true;
      }
      var existingTest = testsList2[uIdx];
      var startTimeMs = new Date(existingTest.startTime).getTime();
      if (Date.now() >= startTimeMs) {
        json(res, 400, { error: 'Cannot edit test after its start time has reached.' });
        return true;
      }
      testsList2[uIdx] = Object.assign({}, existingTest, updateTest);
      cms.saveOfficialTests(testsList2);
      json(res, 200, { ok: true, test: testsList2[uIdx] });
      return true;
    }
    if (route === '/tests' && method === 'DELETE') {
      var delBody = JSON.parse(await readBody(req));
      var testsList3 = cms.loadOfficialTests();
      var dIdx = testsList3.findIndex((t) => t.id === delBody.id);
      if (dIdx === -1) {
        json(res, 404, { error: 'Test not found' });
        return true;
      }
      var exTest = testsList3[dIdx];
      var startMs = new Date(exTest.startTime).getTime();
      if (Date.now() >= startMs) {
        json(res, 400, { error: 'Cannot delete test after its start time has reached.' });
        return true;
      }
      testsList3.splice(dIdx, 1);
      cms.saveOfficialTests(testsList3);
      json(res, 200, { ok: true });
      return true;
    }
    if (route === '/tests/progress' && method === 'POST') {
      var prog = JSON.parse(await readBody(req));
      var allResults = cms.loadOfficialTestResults();
      var progKey = prog.testId + '_' + (prog.userEmail || '').toLowerCase();
      var prIdx = allResults.findIndex((r) => r.key === progKey && r.status === 'in_progress');
      var entry = prIdx !== -1 ? allResults[prIdx] : {
        id: 'res_' + Date.now(),
        key: progKey,
        testId: prog.testId,
        testTitle: prog.testTitle,
        userName: prog.userName,
        userEmail: prog.userEmail,
        status: 'in_progress',
        startedAt: Date.now()
      };
      entry.userAnswers = prog.userAnswers || {};
      entry.currentIndex = prog.currentIndex || 0;
      entry.lastUpdated = Date.now();
      if (prIdx !== -1) {
        allResults[prIdx] = entry;
      } else {
        allResults.unshift(entry);
      }
      cms.saveOfficialTestResults(allResults);
      json(res, 200, { ok: true });
      return true;
    }
    if (route === '/tests/submit' && method === 'POST') {
      var subData = JSON.parse(await readBody(req));
      var allResList = cms.loadOfficialTestResults();
      var subKey = subData.testId + '_' + (subData.userEmail || '').toLowerCase();
      var findIdx = allResList.findIndex((r) => r.key === subKey && r.status === 'in_progress');
      var submission = {
        id: 'res_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        key: subKey,
        testId: subData.testId,
        testTitle: subData.testTitle,
        userName: subData.userName,
        userEmail: subData.userEmail,
        status: 'completed',
        totalQuestions: subData.totalQuestions,
        correctCount: subData.correctCount,
        wrongCount: subData.wrongCount,
        percentage: subData.percentage,
        questions: subData.questions,
        userAnswers: subData.userAnswers,
        completedAt: Date.now()
      };
      if (findIdx !== -1) {
        allResList[findIdx] = submission;
      } else {
        allResList.unshift(submission);
      }
      cms.saveOfficialTestResults(allResList);
      json(res, 200, { ok: true, result: submission });
      return true;
    }
    if (route === '/tests/results' && method === 'GET') {
      var resList = cms.loadOfficialTestResults();
      var filterEmail = (url.searchParams.get('email') || '').trim().toLowerCase();
      var filterName = (url.searchParams.get('name') || '').trim().toLowerCase();
      var filterTestId = (url.searchParams.get('testId') || '').trim();

      if (filterEmail) {
        resList = resList.filter((r) => (r.userEmail || '').toLowerCase() === filterEmail);
      }
      if (filterName) {
        resList = resList.filter((r) => (r.userName || '').toLowerCase().includes(filterName));
      }
      if (filterTestId) {
        resList = resList.filter((r) => r.testId === filterTestId);
      }
      json(res, 200, { ok: true, results: resList });
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
