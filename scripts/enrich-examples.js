/**
 * Replace placeholder defs/examples in data/words-merged.json with readable content.
 * Run: node scripts/enrich-examples.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const MERGED = path.join(ROOT, 'data', 'words-merged.json');
const SEED = path.join(ROOT, 'data', 'words.json');

function isPlaceholderDef(def) {
  return !def || /^Vocabulary word from List/i.test(def);
}

function isPlaceholderExample(ex) {
  return !ex || /Study .* in context|The context made the meaning/i.test(ex);
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

function hashPick(word, items) {
  let h = 0;
  for (let i = 0; i < word.length; i++) h = (h * 31 + word.charCodeAt(i)) >>> 0;
  return items[h % items.length];
}

function em(word) {
  return '<em>' + word.toLowerCase() + '</em>';
}

function isLikelyNoun(word) {
  return /(?:tion|sion|ness|ity|ment|ance|ence|ism|ship|hood|ure|age|cy|ty|or|ee)$/i.test(word);
}

function isLikelyVerb(word) {
  if (isLikelyNoun(word)) return false;
  return /(?:ate|ify|ize|ise|en|ead|bode|tell|warn|see|run|mit|fer|cede|duce|pel|ject|sist|tain|vene)$/i.test(word);
}

function isLikelyAdj(word) {
  return /(?:ous|ful|less|ive|ant|ent|able|ible|ic|al|ary|ory|ish|like|some|y|ine|ent|ing|ed)$/i.test(word);
}

function withArticle(word, useEm) {
  const text = useEm ? em(word) : word.toLowerCase();
  return (/^[aeiou]/i.test(word) ? 'An ' : 'A ') + text;
}

function exampleFromGroup(word, groupTitle) {
  const g = (groupTitle || '').toLowerCase();
  const e = em(word);

  if (/fear|afraid|intimid|daunt|timid|terror|fright/.test(g)) {
    if (isLikelyVerb(word)) {
      return hashPick(word, [
        'The long exam seemed to ' + e + ' students who had not prepared enough.',
        'Public speaking can ' + e + ' even confident professionals at first.',
      ]);
    }
    return hashPick(word, [
      'The steep mountain path looked ' + e + ', but the guide reassured the group.',
      'Facing a room full of judges felt ' + e + ' at first, though she settled in quickly.',
      'Even experienced climbers found the final ascent ' + e + ' in stormy weather.',
    ]);
  }
  if (/warn|sign|omen|forebod|sinister|threat|doom|portent/.test(g)) {
    if (isLikelyVerb(word)) {
      return hashPick(word, [
        'The sudden shift in polls seemed to ' + e + ' a difficult election season.',
        'Rising costs may ' + e + ' deeper cuts to public services.',
        'Those early errors seemed to ' + e + ' the company\'s later collapse.',
      ]);
    }
    if (isLikelyNoun(word)) {
      return hashPick(word, [
        withArticle(word, true) + ' kept her awake the night before the results arrived.',
        withArticle(word, true) + ' spread through the office after the memo leaked.',
        'He laughed off the rumor as ' + withArticle(word, false) + ', but the warning proved accurate.',
      ]);
    }
    return hashPick(word, [
      'The ' + e + ' clouds suggested a storm was approaching fast.',
      'An ' + e + ' silence fell over the courtroom before the verdict was read.',
      'Dark headlines painted an ' + e + ' picture of what lay ahead for the economy.',
    ]);
  }
  if (/equal|fair|same|uniform|parity/.test(g)) {
    return hashPick(word, [
      'The policy aimed to keep opportunities ' + e + ' for every applicant.',
      'Judges looked for ' + e + ' treatment under the new regulations.',
      'Students demanded ' + e + ' access to the same learning resources.',
    ]);
  }
  if (/different|dispar|dissim|distinct|contrast|diverse/.test(g)) {
    return hashPick(word, [
      'The two reports reached ' + e + ' conclusions from the same survey data.',
      'Urban and rural communities often have ' + e + ' needs during a crisis.',
      'Critics noted ' + e + ' styles between the first and second novels.',
    ]);
  }
  if (/praise|laud|compl|flatter|admir|honor/.test(g)) {
    return hashPick(word, [
      'The coach took a moment to ' + e + ' the team for its hard work.',
      'Reviewers ' + e + ' the author for turning complex ideas into clear prose.',
      'Colleagues ' + e + ' her calm leadership during the merger.',
    ]);
  }
  if (/critic|blame|attack|condemn|scold|rebuke/.test(g)) {
    return hashPick(word, [
      'Editorials began to ' + e + ' the mayor for ignoring early warnings.',
      'Opponents ' + e + ' the plan as costly and poorly timed.',
      'Teachers rarely ' + e + ' students in public, preferring private feedback.',
    ]);
  }
  if (/happy|joy|cheer|delight|elat|merry|gleeful/.test(g)) {
    return hashPick(word, [
      'She felt ' + e + ' when the scholarship letter finally arrived.',
      'The ' + e + ' mood in the hall lifted after the good news.',
      'A ' + e + ' crowd gathered outside the theater on opening night.',
    ]);
  }
  if (/sad|grief|sorrow|melanch|mourn|lugub/.test(g)) {
    return hashPick(word, [
      'The poem captured a ' + e + ' mood without becoming sentimental.',
      'He spoke in a ' + e + ' tone about friends he had lost.',
      'Rain against the window added to the ' + e + ' atmosphere of the scene.',
    ]);
  }
  if (/angry|rage|fury|wrath|irat|resent|indign/.test(g)) {
    return hashPick(word, [
      'The unfair ruling left the crowd ' + e + ' and restless.',
      'Her ' + e + ' reply showed she would not accept the excuse.',
      'Letters from voters grew increasingly ' + e + ' over the delay.',
    ]);
  }
  if (/talk|speak|verb|loqu|garr|retic|tacit|silent/.test(g)) {
    return hashPick(word, [
      'He tends to ' + e + ' when nervous, filling every pause in conversation.',
      'The witness remained ' + e + ' until the lawyer asked a direct question.',
      'A good tutor knows when to ' + e + ' and when to let students think.',
    ]);
  }
  if (/greed|avar|sting|miser|selfish|generous|charit/.test(g)) {
    return hashPick(word, [
      'Critics accused the firm of ' + e + ' behavior during the shortage.',
      'Her ' + e + ' donation surprised a charity that expected far less.',
      'The tale warns against ' + e + ' when success finally arrives.',
    ]);
  }
  if (/honest|truth|sincere|candid|frank|deceit|lie|dishon/.test(g)) {
    return hashPick(word, [
      'The witness gave a ' + e + ' account of what happened that night.',
      'Investors wanted a ' + e + ' explanation, not polished marketing language.',
      'A ' + e + ' apology can repair trust faster than a clever excuse.',
    ]);
  }
  if (/smart|clever|shrewd|astute|wise|fool|stupid|naive/.test(g)) {
    return hashPick(word, [
      'It was a ' + e + ' move to negotiate before costs rose further.',
      'Only a ' + e + ' reader would miss the irony in that paragraph.',
      'The mentor offered ' + e + ' advice that changed her study habits.',
    ]);
  }
  if (/increase|grow|expand|rise|surge|prolif|abund/.test(g)) {
    return hashPick(word, [
      'Demand began to ' + e + ' after the product launch went viral.',
      'Scholars watched the debate ' + e + ' into new areas of policy.',
      'Small savings can ' + e + ' quickly when invested with discipline.',
    ]);
  }
  if (/decrease|reduce|less|diminish|decline|abate|mitig/.test(g)) {
    return hashPick(word, [
      'Cooler weather helped ' + e + ' the swelling in his ankle.',
      'Officials hoped the treaty would ' + e + ' tensions along the border.',
      'The medicine did little to ' + e + ' her anxiety before the exam.',
    ]);
  }

  const readable = formatGroupTitle(groupTitle);
  if (readable) {
    return hashPick(word, [
      'In the "' + readable + '" word cluster, ' + e + ' helps you spot synonyms on test day.',
      'She underlined ' + e + ' while reviewing the "' + readable + '" group in her notes.',
    ]);
  }
  return 'She encountered the word ' + e + ' while studying advanced vocabulary for the GRE.';
}

function exampleFromDef(word, pos, def) {
  const e = em(word);
  const p = (pos || 'word').toLowerCase();
  const d = def.replace(/\.$/, '').toLowerCase();

  if (p.includes('adj')) {
    if (/fear|intimid|apprehens|alarm|fright|daunt|timid/.test(d)) {
      return 'The certification exam looked ' + e + ', though she passed on her first attempt.';
    }
    if (/different|dissimilar|distinct|unlike|dispar|diverg/.test(d)) {
      return 'The twins chose ' + e + ' career paths despite growing up in the same town.';
    }
    if (/short|brief|transient|fleeting|temporary|ephemer|momentary/.test(d)) {
      return 'Their relief was ' + e + ', disappearing as soon as the next deadline appeared.';
    }
    if (/clear|obvious|evident|apparent|lucid|pellucid|explicit/.test(d)) {
      return 'The professor gave an ' + e + ' explanation that even beginners could follow.';
    }
    if (/confus|ambigu|vague|unclear|obscure|equivoc/.test(d)) {
      return 'The contract language was so ' + e + ' that both sides interpreted it differently.';
    }
    if (/hostile|harmful|adverse|inimic|antagon/.test(d)) {
      return 'The climate proved ' + e + ' to crops that had thrived farther south.';
    }
    if (/generous|charit|benevol|kind|affabl|amiable/.test(d)) {
      return 'Neighbors described her as ' + e + ', always ready to help newcomers settle in.';
    }
    if (/stubborn|inflex|rigid|obdur|intrans/.test(d)) {
      return 'He remained ' + e + ' even when new evidence contradicted his view.';
    }
    if (/talk|verb|loqu|garr|wordy|prolix/.test(d)) {
      return 'The ' + e + ' speaker left little time for questions from the audience.';
    }
    if (/quiet|silent|reserved|retic|tacit|laconic|terse/.test(d)) {
      return 'Her ' + e + ' reply suggested she preferred to keep her opinion private.';
    }
    return hashPick(word, [
      'Critics called the proposal ' + e + ', noting that it was ' + d + '.',
      'The situation seemed ' + e + ' to anyone who read the full report.',
      'In context, the word ' + e + ' means ' + d + '.',
    ]);
  }

  if (p.includes('verb')) {
    if (/reduce|lessen|allevi|mitig|abate|ease|reliev|diminish/.test(d)) {
      return 'The ceasefire helped ' + e + ' fighting in the border region.';
    }
    if (/increase|worsen|aggrav|exacerb|intensif|amplify/.test(d)) {
      return 'Poor communication only served to ' + e + ' the misunderstanding.';
    }
    if (/support|strengthen|bolster|reinfor|buttress|fortif/.test(d)) {
      return "New data helped " + e + " the scientist's central claim.";
    }
    if (/weaken|undermin|sap|enerv|debilit|impair/.test(d)) {
      return 'Constant interruptions began to ' + e + ' her confidence on stage.';
    }
    if (/praise|laud|extol|acclaim|compliment|vener/.test(d)) {
      return 'Historians continue to ' + e + ' her courage during the crisis.';
    }
    if (/critic|condemn|denounc|castig|rebuk|berat|scold/.test(d)) {
      return 'Editorials ' + e + ' the agency for failing to act sooner.';
    }
    if (/hide|conceal|obscur|mask|dissembl|camoufl/.test(d)) {
      return 'He tried to ' + e + ' his nervousness before the interview panel.';
    }
    if (/reveal|expose|disclos|uncover|unveil|elucid|clarif/.test(d)) {
      return 'The audit helped ' + e + ' errors that had gone unnoticed for years.';
    }
    if (/prevent|preclud|obviat|avert|forestall|deter/.test(d)) {
      return 'Early training can ' + e + ' costly mistakes later in the project.';
    }
    if (/cause|creat|produc|gener|engender|spawn|provok/.test(d)) {
      return 'The announcement threatened to ' + e + ' protests across the city.';
    }
    return hashPick(word, [
      'The team hoped the policy would ' + e + ' the problem over time.',
      'In the passage, the author uses ' + e + ' to mean ' + d + '.',
      'Leaders met to decide how best to ' + e + ' the dispute.',
    ]);
  }

  if (p.includes('noun')) {
    if (/feeling|emotion|sentiment|mood|attitude/.test(d)) {
      return 'A sense of ' + e + ' spread through the crowd after the announcement.';
    }
    if (/person|people|individual|one who|someone/.test(d)) {
      return 'The ' + e + ' in the story refused to follow the crowd without question.';
    }
    if (/speech|statement|remark|comment|word/.test(d)) {
      return 'Her closing ' + e + ' reminded the audience why the issue mattered.';
    }
    return hashPick(word, [
      'The essay turned on the ' + e + ' introduced in the opening paragraph.',
      "Understanding the " + e + " helps you grasp the author's argument.",
      'The passage defines ' + e + ' as ' + d + '.',
    ]);
  }

  return exampleFromGroup(word, '');
}

function buildExample(word, pos, def, groupTitle) {
  if (!isPlaceholderDef(def)) {
    return exampleFromDef(word, pos, def);
  }
  return exampleFromGroup(word, groupTitle);
}

function needsExampleRefresh(ex) {
  if (isPlaceholderExample(ex)) return true;
  if (/An <em>\w+<\/em> silence/i.test(ex || '')) return true;
  return false;
}

function main() {
  const merged = JSON.parse(fs.readFileSync(MERGED, 'utf8'));
  let seedMap = new Map();
  if (fs.existsSync(SEED)) {
    JSON.parse(fs.readFileSync(SEED, 'utf8')).forEach(function (w) {
      seedMap.set(w.word.toLowerCase(), w);
    });
  }

  let updatedEx = 0;
  let updatedDef = 0;

  merged.forEach(function (w) {
    const seed = seedMap.get(w.word.toLowerCase());
    if (seed) {
      if (isPlaceholderDef(w.def) && seed.def) {
        w.def = seed.def;
        updatedDef++;
      }
      if (!w.phonetic && seed.phonetic) w.phonetic = seed.phonetic;
      if (!w.syn && seed.syn) w.syn = seed.syn;
      if (!w.ant && seed.ant) w.ant = seed.ant;
      if (seed.pos && (!w.pos || w.pos === 'word')) w.pos = seed.pos;
      if (w.stub && seed.def) w.stub = false;
    }

    if (needsExampleRefresh(w.example)) {
      w.example = buildExample(w.word, w.pos, w.def, w.groupTitle || '');
      updatedEx++;
    }
  });

  fs.writeFileSync(MERGED, JSON.stringify(merged, null, 2), 'utf8');
  console.log('Updated examples:', updatedEx, '| defs from seed:', updatedDef, '| total:', merged.length);
}

main();
