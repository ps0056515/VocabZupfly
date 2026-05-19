const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'lexiquest.html');
let html = fs.readFileSync(file, 'utf8');

const neu = `        <div class="screen" id="screen-mock" style="background:#0D0D0D">
          <div class="quiz-bg">
            <motion class="quiz-topbar">
              <button class="back-btn" onclick="goTo('home')">←</button>
              <span style="font-family:var(--head);font-size:18px;font-weight:600;color:#fff;flex:1;margin-left:4px;letter-spacing:-0.3px;">Mock Test</span>
              <span id="mock-timer" class="mock-timer" style="font-size:15px;margin:0;min-width:48px;text-align:right">10:00</span>
            </div>
            <div class="quiz-prog-row" id="mock-prog-row"></div>
            <div class="quiz-card" id="mock-card"></div>
          </div>
          <div class="quiz-body" id="mock-body"></div>
        </motion>`;

const block = neu
  .replace(/<\/?motion\b[^>]*>/gi, '')
  .replace('quiz-topbar">', 'quiz-topbar">')
  .replace(
    '        <div class="screen" id="screen-mock"',
    '        <div class="screen" id="screen-mock"'
  );

const fixed = `        <div class="screen" id="screen-mock" style="background:#0D0D0D">
          <div class="quiz-bg">
            <div class="quiz-topbar">
              <button class="back-btn" onclick="goTo('home')">←</button>
              <span style="font-family:var(--head);font-size:18px;font-weight:600;color:#fff;flex:1;margin-left:4px;letter-spacing:-0.3px;">Mock Test</span>
              <span id="mock-timer" class="mock-timer" style="font-size:15px;margin:0;min-width:48px;text-align:right">10:00</span>
            </div>
            <div class="quiz-prog-row" id="mock-prog-row"></div>
            <div class="quiz-card" id="mock-card"></div>
          </div>
          <div class="quiz-body" id="mock-body"></div>
        </div>`;

html = html.replace(
  /        <div class="screen" id="screen-mock" style="background:#0D0D0D">[\s\S]*?<\/div>\s*(?=\s*<div class="screen" id="screen-drill")/,
  fixed
);

html = html.replace(
  /#screen-mock\{display:none;flex-direction:column;min-height:100%\}\n#screen-mock\.active\{display:flex\}\n#screen-mock \.screen-panel\{flex:1;display:flex;flex-direction:column;min-height:0\}\n#screen-mock #mock-body\{flex:1\}\n/g,
  ''
);

fs.writeFileSync(file, html);
console.log('mock-card', html.includes('id="mock-card"'));
