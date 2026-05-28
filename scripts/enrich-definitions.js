/**
 * Fill stub definitions in data/words-merged.json using seed defs + group context.
 * Run: node scripts/enrich-definitions.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const MERGED = path.join(ROOT, 'data', 'words-merged.json');
const SEED = path.join(ROOT, 'data', 'words.json');

function isPlaceholderDef(def) {
  return !def || /^Vocabulary word from List/i.test(def);
}

function formatGroupTitle(title) {
  if (!title) return '';
  let t = String(title).trim();
  let pole = '';
  if (/\(\+\)$/.test(t)) {
    pole = '+';
    t = t.replace(/\(\+\)$/, '').trim();
  } else if (/\(-\)$/.test(t)) {
    pole = '−';
    t = t.replace(/\(-\)$/, '').trim();
  }
  t = t.replace(/\(([^)]+)\)/g, ' · $1').replace(/\//g, ' / ');
  t = t.replace(/^\s*·\s*/, '').replace(/\s+/g, ' ').trim();
  t = t
    .split(' · ')
    .map(function (part) {
      part = part.trim();
      if (!part) return '';
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .filter(Boolean)
    .join(' · ');
  if (pole) t = t + ' (' + pole + ')';
  return t;
}

function inferPos(word) {
  if (/(?:tion|sion|ness|ity|ment|ance|ence|ism|ship|hood|ure|age|cy|ty|or|ee)$/i.test(word)) return 'noun';
  if (/(?:ous|ful|less|ive|ant|ent|able|ible|ic|al|ary|ory|ish|like|some|y|ine)$/i.test(word)) return 'adjective';
  if (/(?:ate|ify|ize|ise|en|ead|bode|tell|warn|mit|fer|cede|duce|pel|ject|sist|tain|vene)$/i.test(word)) return 'verb';
  return 'word';
}

function defFromGroup(word, groupTitle, role) {
  const g = formatGroupTitle(groupTitle);
  const lower = g.toLowerCase();
  const pos = inferPos(word);

  if (/embarrass|shame|humili|awkward/.test(lower)) {
    return pos === 'verb' ? 'Make someone feel embarrassed or ashamed.' : 'Feeling embarrassed or self-conscious.';
  }
  if (/fear|afraid|intimid|daunt|timid|terror|fright/.test(lower)) {
    return pos === 'verb' ? 'Cause fear or intimidation.' : 'Marked by fear, dread, or intimidation.';
  }
  if (/lessen|decreas|diminish|abate|reduce|wane/.test(lower)) {
    return pos === 'verb' ? 'Become less intense, amount, or severe.' : 'Reduced in intensity or amount.';
  }
  if (/increas|grow|expand|intensif|surge|escalat/.test(lower)) {
    return pos === 'verb' ? 'Become greater in size, amount, or intensity.' : 'Greater in size, amount, or intensity.';
  }
  if (/praise|commend|laud|extol|acclaim/.test(lower)) {
    return pos === 'verb' ? 'Express strong approval or admiration.' : 'Expressing praise or admiration.';
  }
  if (/critic|blame|condemn|denounc|disparag|scorn/.test(lower)) {
    return pos === 'verb' ? 'Express strong disapproval or criticism.' : 'Expressing criticism or strong disapproval.';
  }
  if (/happy|joy|delight|cheer|elat|jubil/.test(lower)) {
    return 'Full of happiness, joy, or delight.';
  }
  if (/sad|sorrow|grief|melanchol|mourn/.test(lower)) {
    return 'Marked by sadness, sorrow, or grief.';
  }
  if (/angry|rage|wrath|fury|irrit|annoy/.test(lower)) {
    return pos === 'verb' ? 'Make someone angry or irritated.' : 'Full of anger, rage, or irritation.';
  }
  if (/honest|truth|sincer|candid|frank/.test(lower)) {
    return 'Honest, truthful, and straightforward.';
  }
  if (/deceit|dishonest|fraud|misleading|decept/.test(lower)) {
    return 'Intended to mislead or deceive.';
  }
  if (/stubborn|obstinat|inflex|unyield/.test(lower)) {
    return 'Unwilling to change one\'s mind or course of action.';
  }
  if (/flexib|adapt|adjust|accommod/.test(lower)) {
    return 'Willing or able to change or adapt easily.';
  }
  if (/give up|abandon|forsake|relinquish|surrender/.test(lower)) {
    return pos === 'verb' ? 'Give up, abandon, or stop pursuing something.' : 'Given up or abandoned.';
  }
  if (/begin|start|commenc|initiat|inaugur/.test(lower)) {
    return pos === 'verb' ? 'Begin or start something.' : 'At the beginning; initial.';
  }
  if (/end|finish|conclud|termin|cease/.test(lower)) {
    return pos === 'verb' ? 'Bring to an end; stop or conclude.' : 'At the final stage; concluding.';
  }
  if (/interval|pause|break|intermiss|hiatus/.test(lower)) {
    return 'A temporary pause, break, or gap in continuity.';
  }
  if (/similar|alike|resembl|analog/.test(lower)) {
    return 'Similar in nature, quality, or appearance.';
  }
  if (/different|dissimilar|dispar|distinct|unlike/.test(lower)) {
    return 'Not alike; clearly different in nature or quality.';
  }
  if (/sign|warn|signal|indic|omen|portent/.test(lower)) {
    return pos === 'verb' ? 'Indicate or warn of something to come.' : 'A sign or warning of future events.';
  }
  if (/confus|puzzle|perplex|bewilder|baffle/.test(lower)) {
    return pos === 'verb' ? 'Cause confusion or bewilderment.' : 'Confused or bewildered.';
  }
  if (/clar|explain|illumin|elucid/.test(lower)) {
    return pos === 'verb' ? 'Make clear or easy to understand.' : 'Clear and easy to understand.';
  }
  if (/brief|concise|succinct|terse|laconic/.test(lower)) {
    return 'Using few words; brief and to the point.';
  }
  if (/wordy|verbose|prolix|loquac|garrul/.test(lower)) {
    return 'Using more words than needed; overly talkative.';
  }
  if (/brave|courage|bold|valiant|intrepid/.test(lower)) {
    return 'Showing courage or bravery in the face of difficulty.';
  }
  if (/coward|timid|faintheart/.test(lower)) {
    return 'Lacking courage; timid or fearful.';
  }
  if (/generous|charit|benevol|magnanim|liberal/.test(lower)) {
    return 'Willing to give or share freely; kind and generous.';
  }
  if (/selfish|stingy|miser|parsimon|niggard/.test(lower)) {
    return 'Unwilling to give or share; excessively frugal or selfish.';
  }
  if (/old|ancient|archaic|antiqu|obsolete/.test(lower)) {
    return 'Belonging to an earlier time; old or outdated.';
  }
  if (/new|novel|recent|modern|contempor/.test(lower)) {
    return 'Recently created, discovered, or modern.';
  }
  if (/strong|power|potent|robust|vigor/.test(lower)) {
    return 'Having great strength, power, or force.';
  }
  if (/weak|feeble|frail|fragil|infirm/.test(lower)) {
    return 'Lacking strength, power, or effectiveness.';
  }

  if (role === 'positive') return 'A word expressing a positive quality related to: ' + g + '.';
  if (role === 'negative') return 'A word expressing a negative quality related to: ' + g + '.';

  if (pos === 'verb') return 'To act in a way related to the idea of: ' + g + '.';
  if (pos === 'adjective') return 'Describing something related to: ' + g + '.';
  if (pos === 'noun') return 'A person, thing, or quality related to: ' + g + '.';
  return 'A vocabulary term from the group: ' + g + '.';
}

function main() {
  const merged = JSON.parse(fs.readFileSync(MERGED, 'utf8'));
  const seedMap = new Map();
  if (fs.existsSync(SEED)) {
    JSON.parse(fs.readFileSync(SEED, 'utf8')).forEach(function (w) {
      seedMap.set(w.word.toLowerCase(), w);
    });
  }

  let fromSeed = 0;
  let generated = 0;

  merged.forEach(function (w) {
    const seed = seedMap.get(w.word.toLowerCase());
    if (seed && isPlaceholderDef(w.def) && seed.def && !isPlaceholderDef(seed.def)) {
      w.def = seed.def;
      if (w.stub) w.stub = false;
      fromSeed++;
      return;
    }
    if (!isPlaceholderDef(w.def)) return;
    w.def = defFromGroup(w.word, w.groupTitle || '', w.groupRole || 'normal');
    if (!w.pos || w.pos === 'word') w.pos = inferPos(w.word);
    w.stub = false;
    generated++;
  });

  fs.writeFileSync(MERGED, JSON.stringify(merged, null, 2), 'utf8');
  console.log('Definitions — from seed:', fromSeed, '| generated:', generated, '| total:', merged.length);
}

main();
