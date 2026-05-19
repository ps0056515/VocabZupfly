const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '..', 'lexiquest.html');
let html = fs.readFileSync(htmlPath, 'utf8');

const extraCss = `
.mode-grid-scroll{display:flex;flex-wrap:nowrap;overflow-x:auto;gap:10px;padding-bottom:8px;-webkit-overflow-scrolling:touch}
.mode-grid-scroll .mode-card{min-width:140px;flex:0 0 auto}
.mode-card.mock{background:#E5F8FF;color:var(--ink)}
.mode-card.drill{background:#FFE5E5;color:var(--ink)}
.mode-card.league{background:#F0EEFF;color:var(--ink)}
.mode-card.speak{background:#EFFFEF;color:var(--ink)}
.mode-card.settings{background:#2a2a2a;color:#fff}
.ctag.premium{background:rgba(255,209,102,.2);color:var(--gold)}
.screen-panel{padding:18px 20px;flex:1;overflow-y:auto}
.ob-chip{padding:10px 16px;margin:4px;border-radius:99px;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.06);color:#fff;font-weight:600;cursor:pointer}
.ob-chip.active{background:var(--lime);color:var(--ink);border-color:var(--lime)}
#screen-onboarding{position:absolute;inset:0;z-index:50;background:#0D0D0D;padding:24px}
.mock-timer{font-family:var(--head);font-size:28px;color:var(--lime);text-align:center;margin-bottom:16px}
.league-row{display:flex;align-items:center;gap:10px;padding:12px;background:rgba(255,255,255,.05);border-radius:12px;margin-bottom:8px;font-size:14px;color:#fff}
.league-row.you{border:1px solid var(--lime)}
.speak-prompt{color:rgba(255,255,255,.5);font-size:13px}
.speak-def{color:#fff;font-size:18px;line-height:1.5;margin:12px 0 20px}
#premium-badge{display:none;align-items:center;gap:6px;background:rgba(255,209,102,.15);color:var(--gold);font-size:10px;font-weight:700;padding:4px 10px;border-radius:99px}
`;

if (!html.includes('mode-grid-scroll')) {
  html = html.replace('</style>', extraCss + '\n</style>');
}

const newModes = `
              <button class="mode-card mock" onclick="goTo('mock')"><span class="mode-card-icon">⏱️</span><span class="mode-card-title">Mock Test</span><span class="mode-card-sub">Timed</span></button>
              <button class="mode-card drill" onclick="goTo('drill')"><span class="mode-card-icon">🎯</span><span class="mode-card-title">Weak Drill</span><span class="mode-card-sub">SRS review</span></button>
              <button class="mode-card league" onclick="goTo('leagues')"><span class="mode-card-icon">🏆</span><span class="mode-card-title">League</span><span class="mode-card-sub">Weekly XP</span></button>
              <button class="mode-card speak" onclick="goTo('speak')"><span class="mode-card-icon">🎤</span><span class="mode-card-title">Speak</span><span class="mode-card-sub">Say it</span></button>
              <button class="mode-card settings" onclick="goTo('settings')"><span class="mode-card-icon">⚙️</span><span class="mode-card-title">Settings</span><span class="mode-card-sub">Sync & Pro</span></button>`;

if (!html.includes("goTo('mock')")) {
  html = html.replace(
    '<div class="mode-grid">',
    '<motion div class="mode-grid mode-grid-scroll">'.replace('motion ', '')
  );
  html = html.replace(
    '<span class="mode-card-sub">Type it out</span>\n              </button>\n            </div>',
    '<span class="mode-card-sub">Type it out</span></button>' + newModes + '\n            </div>'
  );
}

const screens = `
        <div class="screen" id="screen-onboarding"><motion id="onboarding-wrap"></motion></motion>
        <motion class="screen" id="screen-mock" style="background:#0D0D0D"><motion class="fc-header"><button class="back-btn" onclick="goTo('home')">←</button><h2>Mock Test</h2></motion><motion class="screen-panel" id="mock-wrap"></motion></motion>
        <motion class="screen" id="screen-drill" style="background:#0D0D0D"><motion class="fc-header"><button class="back-btn" onclick="goTo('home')">←</button><h2>Weak Drill</h2></motion><motion class="screen-panel" id="drill-wrap"></motion></motion>
        <motion class="screen" id="screen-leagues" style="background:#0D0D0D"><motion class="fc-header"><button class="back-btn" onclick="goTo('home')">←</button><h2>League</h2></motion><motion class="screen-panel" id="league-wrap"></motion></motion>
        <motion class="screen" id="screen-speak" style="background:#0D0D0D"><motion class="fc-header"><button class="back-btn" onclick="goTo('home')">←</button><h2>Speak</h2></motion><motion class="screen-panel" id="speak-wrap"></motion></motion>
        <motion class="screen" id="screen-settings" style="background:#0D0D0D"><motion class="fc-header"><button class="back-btn" onclick="goTo('home')">←</button><h2>Settings</h2></motion><motion class="screen-panel" id="settings-wrap"></motion></motion>`;

let screensClean = screens.replace(/motion /g, '');
if (!html.includes('screen-mock')) {
  html = html.replace('<!-- ══ SPELLING ══ -->', screensClean + '\n\n        <!-- ══ SPELLING ══ -->');
}

const scripts = `
<script src="js/config.js"></script>
<script src="js/words.js"></script>
<script src="js/srs.js"></script>
<script src="js/streak.js"></script>
<script src="js/state.js"></script>
<script src="js/core.js"></script>
<script src="js/ai.js"></script>
<script src="js/speech.js"></script>
<script src="js/firebase-sync.js"></script>
<script src="js/notifications.js"></script>
<script src="js/study.js"></script>
<script src="js/features.js"></script>
<script src="js/app.js"></script>
<script src="js/native-bridge.js"></script>`;

const scriptMatch = html.match(/<script>[\s\S]*<\/script>\s*<script src="js\/native-bridge/);
if (scriptMatch) {
  html = html.replace(/<script>[\s\S]*<\/script>\s*(?=<script src="js\/native-bridge)/, scripts + '\n');
} else if (html.includes('<script>\nconst WORDS')) {
  html = html.replace(/<script>[\s\S]*<\/script>/, scripts);
}

if (!html.includes('premium-badge')) {
  html = html.replace(
    '<div style="font-family:var(--head)',
    '<span id="premium-badge">PRO</span></motion><motion style="font-family:var(--head)'.replace(/motion /g, '')
  );
}

fs.writeFileSync(htmlPath, html);
console.log('Patched lexiquest.html');
