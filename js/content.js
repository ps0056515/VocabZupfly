window.LQ = window.LQ || {};

/** User-local overrides for word content (examples, etc.) */
LQ.getWordExample = function (w) {
  if (!w) return '';
  var ov = LQ.S && LQ.S.wordOverrides && LQ.S.wordOverrides[w.word];
  if (ov && ov.example) return ov.example;
  return w.example || '';
};

LQ.getWordExamplePlain = function (w) {
  return String(LQ.getWordExample(w)).replace(/<[^>]+>/g, '');
};

LQ.hasUserExample = function (wordName) {
  var ov = LQ.S && LQ.S.wordOverrides && LQ.S.wordOverrides[wordName];
  return !!(ov && ov.example);
};

LQ.setWordExample = function (wordName, example) {
  LQ.S.wordOverrides = LQ.S.wordOverrides || {};
  var text = (example || '').trim();
  if (!text) {
    if (LQ.S.wordOverrides[wordName]) {
      delete LQ.S.wordOverrides[wordName].example;
      if (!Object.keys(LQ.S.wordOverrides[wordName]).length) delete LQ.S.wordOverrides[wordName];
    }
  } else {
    LQ.S.wordOverrides[wordName] = LQ.S.wordOverrides[wordName] || {};
    LQ.S.wordOverrides[wordName].example = text;
  }
  LQ.saveState();
};

LQ.beginExampleEdit = function (wordName) {
  LQ._exampleEditing = wordName;
  if (LQ.renderFC) LQ.renderFC();
  if (LQ.renderLearnScreen) LQ.renderLearnScreen();
  if (LQ.renderReviseScreen) LQ.renderReviseScreen();
  if (LQ.renderWordListsPage) LQ.renderWordListsPage();
};

LQ.cancelExampleEdit = function () {
  LQ._exampleEditing = null;
  if (LQ.renderFC) LQ.renderFC();
  if (LQ.renderLearnScreen) LQ.renderLearnScreen();
  if (LQ.renderReviseScreen) LQ.renderReviseScreen();
  if (LQ.renderWordListsPage) LQ.renderWordListsPage();
};

LQ.saveExampleEdit = function (wordName) {
  var inp = document.getElementById('ex-edit-input');
  var val = inp ? inp.value : '';
  LQ.setWordExample(wordName, val);
  LQ._exampleEditing = null;
  LQ.toast(val ? 'Example saved' : 'Example cleared');
  if (LQ.renderFC) LQ.renderFC();
  if (LQ.renderLearnScreen) LQ.renderLearnScreen();
  if (LQ.renderReviseScreen) LQ.renderReviseScreen();
  if (LQ.renderWordListsPage) LQ.renderWordListsPage();
};

LQ.saveExampleText = function (wordName, text) {
  LQ.setWordExample(wordName, text);
  LQ.toast('Saved as your example');
  if (LQ.renderFC) LQ.renderFC();
  if (LQ.renderTutor) LQ.renderTutor();
};

LQ.extractSentenceFromTutorReply = function (text) {
  if (!text) return '';
  var m = text.match(/["“]([^"”]+)["”]/);
  if (m) return m[1].trim();
  m = text.match(/\*\*Sample sentence:\*\*\s*["“]?([^"\n]+)/i);
  if (m) return m[1].replace(/["”]+$/, '').trim();
  m = text.match(/\*\*Example:\*\*\s*["“]?([^"\n]+)/i);
  if (m) return m[1].replace(/["”]+$/, '').trim();
  return '';
};

LQ.exampleUserBadge = function (wordName) {
  if (!LQ.hasUserExample(wordName)) return '';
  return '<span class="ex-user-badge">Your example</span>';
};

LQ.renderExampleEditBtn = function (wordName, compact) {
  var cls = compact ? 'ex-edit-btn ex-edit-btn-sm' : 'ex-edit-btn';
  return (
    '<button type="button" class="' +
    cls +
    '" onclick="event.stopPropagation();LQ.beginExampleEdit(' +
    JSON.stringify(wordName) +
    ')">Edit example</button>'
  );
};

LQ.renderExampleBlock = function (w, opts) {
  opts = opts || {};
  if (!w) return '';
  var wordName = w.word;
  var ex = LQ.getWordExample(w);
  var cls = opts.className || 'learn-ex';
  var compact = !!opts.compact;
  var dark = !!opts.dark;

  if (LQ._exampleEditing === wordName) {
    var plain = LQ.getWordExamplePlain(w);
    return (
      '<div class="ex-edit-wrap' +
      (dark ? ' ex-edit-wrap-dark' : '') +
      '" onclick="event.stopPropagation()">' +
      '<label class="ex-edit-label">Your example sentence</label>' +
      '<textarea id="ex-edit-input" class="ex-edit-input" rows="3">' +
      LQ.esc(plain) +
      '</textarea>' +
      '<div class="ex-edit-actions">' +
      '<button type="button" class="ex-edit-save" onclick="LQ.saveExampleEdit(' +
      JSON.stringify(wordName) +
      ')">Save</button>' +
      '<button type="button" class="ex-edit-cancel" onclick="LQ.cancelExampleEdit()">Cancel</button>' +
      '</div></div>'
    );
  }

  var html =
    '<p class="' +
    cls +
    '">"' +
    ex +
    '"</p>' +
    LQ.exampleUserBadge(wordName) +
    LQ.renderExampleEditBtn(wordName, compact);
  return html;
};
