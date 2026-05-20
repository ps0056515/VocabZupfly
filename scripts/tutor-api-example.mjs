/**
 * Optional dev server for LexiQuest AI Tutor.
 * Run: node scripts/tutor-api-example.mjs
 * Set in js/config.js: tutorEndpoint: 'http://localhost:8787/tutor'
 *
 * Wire your OpenAI/Anthropic key in getLLMReply() for production-quality answers.
 */
import http from 'http';

const PORT = 8787;

function localReply(message, context) {
  return (
    `[${context.examFocus} tutor] You asked: "${message}". ` +
    `Known ${context.knownCount}/${context.wordCount} words. ` +
    'Connect an LLM in scripts/tutor-api-example.mjs for full Shiksha-style tutoring.'
  );
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }
  if (req.method !== 'POST' || req.url !== '/tutor') {
    res.writeHead(404);
    res.end('Not found');
    return;
  }
  let body = '';
  for await (const chunk of req) body += chunk;
  try {
    const payload = JSON.parse(body);
    const message = payload.message || 'Hello';
    const context = payload.context || {};
    let text;
    if (payload.type === 'mnemonic' && payload.word) {
      text =
        'Remember **' +
        payload.word +
        '**: ' +
        (payload.def || '').split('.')[0] +
        ' — picture one vivid scene and say it twice.';
    } else {
      text = localReply(message, context);
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ text }));
  } catch (e) {
    res.writeHead(400);
    res.end(JSON.stringify({ error: String(e) }));
  }
});

server.listen(PORT, () => console.log('Tutor API http://localhost:' + PORT + '/tutor'));
