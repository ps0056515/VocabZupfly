const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'js', 'lessons.js');
let code = fs.readFileSync(file, 'utf8');

const start = code.indexOf('  LQ.CHAPTERS.forEach(function (ch, ci) {');
const end = code.indexOf('  wrap.innerHTML = html;', start);
if (start < 0 || end < 0) {
  console.error('markers not found');
  process.exit(1);
}

const d = 'div';
const loop = `  LQ.CHAPTERS.forEach(function (ch, ci) {
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
      d +
      ' class="kanban-col-titles">' +
      '<h3 class="kanban-col-title">' +
      LQ.esc(ch.title) +
      '</h3>' +
      '<p class="kanban-col-sub">' +
      LQ.esc(ch.subtitle) +
      '</p></' +
      d +
      '>' +
      '<span class="kanban-col-count">' +
      done +
      '/' +
      lessons.length +
      '</span></header>' +
      '<' +
      d +
      ' class="kanban-col-bar" role="progressbar"><' +
      d +
      ' class="kanban-col-bar-fill" style="width:' +
      pct +
      '%"></' +
      d +
      '></' +
      d +
      '>' +
      '<' +
      d +
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
        (complete ? '✓' : String(li + 1)) +
        '</span>' +
        '<span class="kanban-lesson-name">' +
        LQ.esc(les.title) +
        '</span>' +
        '<span class="kanban-lesson-badge">' +
        badge +
        '</span></button>';
    });
    html += '</' + d + '></article>';
  });
`;

code = code.slice(0, start) + loop + code.slice(end);
fs.writeFileSync(file, code);
console.log('patched', code.includes('kanban-col'));
