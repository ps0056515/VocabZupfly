const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'lexiquest.html');
let html = fs.readFileSync(file, 'utf8');

const block =
  '<canvas id="confetti-canvas"></canvas>\n' +
  '<motion id="celebrate-overlay">\n'.replace('motion', 'div') +
  '  <div class="cel-card">\n' +
  '    <div class="cel-emoji">🎉</div>\n' +
  '    <h2 id="cel-title">Lesson complete!</h2>\n' +
  '    <p id="cel-sub">Great work — keep your streak alive.</p>\n' +
  '    <div class="cel-xp" id="cel-xp">+50 XP</div>\n' +
  '    <button class="lesson-cta" onclick="closeCelebrate()">Continue</button>\n' +
  '  </div>\n' +
  '</div>\n\n';

if (!html.includes('<div id="celebrate-overlay">')) {
  html = html.replace('<div id="toast"></div>', block + '<div id="toast"></motion>');
  html = html.replace('</motion>\n<div id="toast">', '</div>\n<div id="toast">');
  html = html.replace('<div id="toast"></motion>', '<div id="toast"></motion>');
  html = html.replace('<div id="toast"></motion>', '<div id="toast"></div>');
}

fs.writeFileSync(file, html);
console.log('inserted', html.includes('<div id="celebrate-overlay">'));
