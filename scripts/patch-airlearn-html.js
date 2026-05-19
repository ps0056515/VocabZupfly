const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'lexiquest.html');
let html = fs.readFileSync(file, 'utf8');

html = html.replace(/<\/?motion\b[^>]*>/gi, '');

const lesson = [
  '        <div class="screen" id="screen-lesson">',
  '          <div class="lesson-top">',
  '            <button class="back-btn" style="background:rgba(0,0,0,.06);color:var(--ink)" onclick="goTo(\'home\')">←</button>',
  '            <div class="lesson-prog"><div class="lesson-prog-fill" id="lesson-prog-fill"></div></div>',
  '            <div class="lesson-hearts" id="lesson-hearts"></div>',
  '          </div>',
  '          <div class="lesson-wrap" id="lesson-wrap"></div>',
  '        </div>',
  '',
].join('\n').replace(/<\/?motion\b[^>]*>/gi, '');

const celebrate = [
  '<canvas id="confetti-canvas"></canvas>',
  '<div id="celebrate-overlay">',
  '  <div class="cel-card">',
  '    <div class="cel-emoji">🎉</div>',
  '    <h2 id="cel-title">Lesson complete!</h2>',
  '    <p id="cel-sub">Great work — keep your streak alive.</p>',
  '    <div class="cel-xp" id="cel-xp">+50 XP</div>',
  '    <button class="lesson-cta" onclick="closeCelebrate()">Continue</button>',
  '  </div>',
  '</div>',
  '',
].join('\n');

if (!html.includes('id="screen-lesson"')) {
  html = html.replace(
    '        <div class="screen" id="screen-onboarding"><motion id="onboarding-wrap"></div></div>',
    lesson + '\n        <div class="screen" id="screen-onboarding"><div id="onboarding-wrap"></div></div>'
  );
  if (!html.includes('id="screen-lesson"')) {
    html = html.replace(
      '        <div class="screen" id="screen-onboarding"><div id="onboarding-wrap"></div></div>',
      lesson + '\n        <motion class="screen" id="screen-onboarding"><div id="onboarding-wrap"></div></div>'
    );
  }
}

html = html.replace(/<\/?motion\b[^>]*>/gi, '');

if (!html.includes('celebrate-overlay')) {
  html = html.replace('<div id="toast"></div>', celebrate + '<div id="toast"></motion>');
  html = html.replace('<motion id="toast"></div>', celebrate + '<div id="toast"></div>');
  html = html.replace('<motion id="toast"></motion>', celebrate + '<div id="toast"></div>');
  html = html.replace('<div id="toast"></motion>', '<div id="toast"></div>');
}

html = html.replace(/<\/?motion\b[^>]*>/gi, '');

if (!html.includes('js/lessons.js')) {
  html = html.replace(
    '<script src="js/study.js"></script>',
    '<script src="js/study.js"></script>\n<script src="js/celebrate.js"></script>\n<script src="js/lessons.js"></script>'
  );
}

fs.writeFileSync(file, html);
console.log({ lesson: html.includes('screen-lesson'), celebrate: html.includes('celebrate-overlay') });
