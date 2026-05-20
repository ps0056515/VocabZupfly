const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'js', 'lessons.js');
let code = fs.readFileSync(file, 'utf8');

const start = code.indexOf('  let html = \'\';');
const end = code.indexOf('  wrap.innerHTML = html;', start);
if (start < 0 || end < 0) {
  console.error('range not found');
  process.exit(1);
}

const block = `  const H = LQ.H;
  let html = '';
  LQ.CHAPTERS.forEach(function (ch) {
    const lessons = LQ.lessonsForChapter(ch.id);
    const done = lessons.filter(function (l) {
      return LQ.S.lessonProgress[l.id];
    }).length;
    const pct = lessons.length ? Math.round((done / lessons.length) * 100) : 0;
    html +=
      '<article class="kanban-col" data-chapter="' +
      ch.id +
      '">' +
      '<header class="kanban-col-head">' +
      '<span class="kanban-col-icon" aria-hidden="true">' +
      ch.icon +
      '</span>' +
      '<' +
      H +
      ' class="kanban-col-titles">' +
      '<h3 class="kanban-col-title">' +
      LQ.esc(ch.title) +
      '</h3>' +
      '<p class="kanban-col-sub">' +
      LQ.esc(ch.subtitle) +
      '</p></' +
      H +
      '>' +
      '<span class="kanban-col-count">' +
      done +
      '/' +
      lessons.length +
      '</span></header>' +
      '<' +
      H +
      ' class="kanban-col-bar" role="progressbar" aria-valuenow="' +
      pct +
      '"><' +
      H +
      ' class="kanban-col-bar-fill" style="width:' +
      pct +
      '%"></' +
      H +
      '></' +
      H +
      '>' +
      '<' +
      H +
      ' class="kanban-col-cards">';
    lessons.forEach(function (les, li) {
      const unlocked = LQ.isLessonUnlocked(les.id);
      const complete = !!LQ.S.lessonProgress[les.id];
      const cls = complete ? 'done' : unlocked ? 'active' : 'locked';
      const badge = complete ? 'Done' : unlocked ? 'Start' : 'Locked';
      html +=
        '<button type="button" class="kanban-lesson ' +
        cls +
        '" ' +
        (unlocked ? 'onclick="LQ.startLesson(\\'' + les.id + '\\')"' : 'disabled') +
        '>' +
        '<span class="kanban-lesson-num">' +
        (complete ? '\\u2713' : String(li + 1)) +
        '</span>' +
        '<span class="kanban-lesson-name">' +
        LQ.esc(les.title) +
        '</span>' +
        '<span class="kanban-lesson-badge">' +
        badge +
        '</span></button>';
    });
    html += '</' + H + '></article>';
  });
`;

code = code.slice(0, start) + block + code.slice(end);
if (/motion/i.test(code.slice(start, start + block.length + 50))) {
  console.error('motion leaked');
  process.exit(1);
}
fs.writeFileSync(file, code);
console.log('ok', code.includes('const H = LQ.H'));
