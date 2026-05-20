window.LQ = window.LQ || {};

LQ.MNEMONICS = {
  Ephemeral: "Think e-FEM-eral — vanishes at dawn. Short-lived = ephemeral.",
  Loquacious: "LOQUI = talk. Loquacious = won't stop talking.",
  Equivocal: "EQUI + vocal = two voices, ambiguous meaning.",
};

LQ.loadAIHint = async function () {
  const w = LQ.currentFcWord() || LQ.WORDS[LQ.S.fcIdx % LQ.WORDS.length];
  if (!w) return;
  const box = document.getElementById('ai-hint-box');
  const btnLbl = document.getElementById('hint-btn-label');
  if (!box) return;
  box.className = 'ai-hint-box show';
  const d = 'div';
  box.innerHTML =
    '<' + d + ' class="ai-loader-inline"><' + d + ' class="dot"></' + d + '><' + d + ' class="dot"></' + d + '><' + d + ' class="dot"></' + d + '><span style="margin-left:4px">Thinking...</span></' + d + '>';
  if (btnLbl) btnLbl.textContent = 'Loading...';

  let txt = LQ.MNEMONICS[w.word];
  const endpoint = LQ.Config.aiEndpoint;
  if (!txt && endpoint) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'mnemonic',
          word: w.word,
          def: w.def,
          message: 'Give a short mnemonic for ' + w.word,
          context: LQ.tutorContext ? LQ.tutorContext() : {},
        }),
      });
      const data = await res.json();
      txt = data.text || data.hint;
    } catch (e) {}
  }
  if (!txt && LQ.askTutor) {
    txt = await LQ.askTutor('Give a one-sentence mnemonic for ' + w.word);
  }
  if (!txt) {
    await new Promise((r) => setTimeout(r, 400));
    txt =
      LQ.MNEMONICS[w.word] ||
      'Link "' +
        w.word +
        '" to: ' +
        w.def.split('.')[0] +
        '. Picture one vivid scene and say it aloud.';
  }
  box.innerHTML = '<p>✦ ' + txt + '</p>';
  if (btnLbl) btnLbl.textContent = 'Ask AI for a mnemonic trick';
};
