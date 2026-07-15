window.LQ = window.LQ || {};
LQ._speaking = false;

LQ.speakText = async function (text, onEnd) {
  if (!text) {
    if (onEnd) onEnd();
    return;
  }

  const cap = window.Capacitor;
  const isNative = cap && cap.isNativePlatform && cap.isNativePlatform();
  const TTS = cap && cap.Plugins && cap.Plugins.TextToSpeech;

  if (isNative && TTS) {
    try {
      LQ._speaking = true;
      await TTS.stop();
      await TTS.speak({
        text: String(text),
        lang: 'en-US',
        rate: 0.92,
        pitch: 1.0,
        volume: 1.0,
        category: 'ambient',
      });
      LQ._speaking = false;
      if (onEnd) onEnd();
      return;
    } catch (e) {
      console.warn('Native TTS failed', e);
      LQ._speaking = false;
    }
  }

  if (!window.speechSynthesis) {
    LQ.toast('Speech not available — rebuild app with TTS plugin');
    if (onEnd) onEnd();
    return;
  }

  try {
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.rate = 0.85;
    utt.pitch = 1.05;
    utt.lang = 'en-US';
    const pickVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      return (
        voices.find(function (v) {
          return v.name.includes('Google US English') || v.name.includes('Google US');
        }) ||
        voices.find(function (v) {
          return v.lang === 'en-US' || v.lang === 'en_US';
        }) ||
        voices.find(function (v) {
          return v.lang && v.lang.indexOf('en') === 0;
        })
      );
    };
    const speakNow = function () {
      const voice = pickVoice();
      if (voice) utt.voice = voice;
      window.speechSynthesis.speak(utt);
    };
    utt.onstart = function () {
      LQ._speaking = true;
    };
    utt.onend = function () {
      LQ._speaking = false;
      if (onEnd) onEnd();
    };
    utt.onerror = function () {
      LQ._speaking = false;
      LQ.toast('Could not play audio — check volume and browser permissions');
      if (onEnd) onEnd();
    };
    if (window.speechSynthesis.getVoices().length) {
      speakNow();
    } else {
      var spoke = false;
      window.speechSynthesis.onvoiceschanged = function () {
        if (spoke) return;
        spoke = true;
        window.speechSynthesis.onvoiceschanged = null;
        speakNow();
      };
      setTimeout(function () {
        if (spoke) return;
        spoke = true;
        speakNow();
      }, 300);
    }
  } catch (e) {
    LQ.toast('Speech error');
    if (onEnd) onEnd();
  }
};

LQ.speakWord = function () {
  const w = LQ.currentFcWord();
  if (!w) return;
  const btn = document.getElementById('speak-btn');
  const wave = document.getElementById('speak-wave');
  const icon = document.getElementById('speak-icon');
  const lbl = document.getElementById('speak-label');
  if (btn) btn.classList.add('speaking');
  if (wave) wave.style.display = 'flex';
  if (icon) icon.style.display = 'none';
  if (lbl) lbl.textContent = 'Speaking...';
  LQ.speakText(w.word, () => {
    if (btn) btn.classList.remove('speaking');
    if (wave) wave.style.display = 'none';
    if (icon) icon.style.display = '';
    if (lbl) lbl.textContent = 'Pronounce';
  });
};

LQ.speakSpellWord = function () {
  const list = LQ._spellWords || LQ.getWords();
  const w = list[LQ.S.spellIdx % list.length];
  if (!w) return;
  const btn = document.getElementById('spell-speak-btn');
  if (btn) btn.style.opacity = '0.5';
  LQ.speakText(w.word, () => {
    if (btn) btn.style.opacity = '1';
  });
};

LQ.initSpeak = function () {
  const wrap = document.getElementById('speak-wrap');
  if (!wrap) return;
  const w = LQ.getDueWords()[0] || LQ.getWords()[0];
  wrap.innerHTML =
    '<p class="speak-prompt">Say the word for:</p><p class="speak-def">' +
    (w ? w.def : '') +
    '</p><button class="quiz-next show" id="speak-start">🎤 Tap to speak</button><p id="speak-result" class="speak-result"></p>';
  document.getElementById('speak-start').onclick = LQ.runSpeakCheck;
};

LQ.runSpeakCheck = function () {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const res = document.getElementById('speak-result');
  if (!SR) {
    if (res) res.textContent = 'Speech recognition needs Chrome or a newer Android WebView.';
    return;
  }
  const w = LQ.getDueWords()[0] || LQ.getWords()[0];
  if (!w) return;
  const rec = new SR();
  rec.lang = 'en-US';
  rec.interimResults = false;
  if (res) res.textContent = 'Listening...';
  rec.onresult = function (e) {
    const said = (e.results[0][0].transcript || '').trim().toLowerCase();
    const ok = said.includes(w.word.toLowerCase());
    if (res) {
      res.className = 'speak-result show ' + (ok ? 'ok' : 'fail');
      res.textContent = ok ? '✓ Great!' : 'Heard: ' + said + ' — target: ' + w.word;
    }
    if (ok) {
      LQ.gainXP(25);
      LQ.scheduleSrs(w.word, 'good');
      LQ.S.mastery[w.word] = 'learning';
      LQ.recordActivity(w.word, 'good');
    }
    LQ.saveState();
  };
  rec.onerror = () => {
    if (res) res.textContent = 'Could not hear you — try again.';
  };
  rec.start();
};
