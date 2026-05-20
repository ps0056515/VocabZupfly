const fs = require('fs');
const path = require('path');
const D = 'div';
const file = path.join(__dirname, '..', 'lexiquest.html');
let html = fs.readFileSync(file, 'utf8');

const titleOld =
  '                <' +
  D +
  ' style="font-family:var(--head);font-size:18px;font-weight:700;color:var(--ink);letter-spacing:-0.3px;margin-top:2px;">Your learning path</' +
  D +
  '>';
const titleNew =
  '                <' +
  D +
  ' class="home-title">Your learning path</' +
  D +
  '>\n                <' +
  D +
  ' class="home-title-mobile" style="font-family:var(--head);font-size:18px;font-weight:700;color:var(--ink);letter-spacing:-0.3px;margin-top:2px;">Your learning path</' +
  D +
  '>';

if (html.includes(titleOld)) {
  html = html.replace(titleOld, titleNew);
}

if (!html.includes('home-stats-row')) {
  html = html.replace(
    '            </' + D + '>\n\n            <' + D + ' class="streak-banner">',
    '            </' + D + '>\n\n            <' + D + ' class="home-stats-row">\n            <' + D + ' class="streak-banner">'
  );
  const xpClose =
    '              <' +
    D +
    ' class="xp-bar"><' +
    D +
    ' class="xp-bar-fill" id="xp-fill" style="width:68%"></' +
    D +
    '></' +
    D +
    '>\n            </' +
    D +
    '>\n\n          </' +
    D +
    '>\n\n          <' +
    D +
    ' class="home-body air-body">';
  const xpCloseNew =
    '              <' +
    D +
    ' class="xp-bar"><' +
    D +
    ' class="xp-bar-fill" id="xp-fill" style="width:68%"></' +
    D +
    '></' +
    D +
    '>\n            </' +
    D +
    '>\n            </' +
    D +
    '>\n\n          </' +
    D +
    '>\n\n          <' +
    D +
    ' class="home-body air-body">';
  if (html.includes(xpClose)) html = html.replace(xpClose, xpCloseNew);
}

fs.writeFileSync(file, html);
console.log('home-title', html.includes('class="home-title"'));
console.log('home-stats-row', html.includes('home-stats-row'));
