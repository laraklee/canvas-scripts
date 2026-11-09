/**
 * qti-check.js: read-only checker for a Canvas Classic quiz QTI export (already unzipped).
 * Purpose: list question groups, every picture (with size and which question uses it),
 * and flag pictures or questions likely to cause trouble for students. Also writes the
 * plain text of every question to a file for the vocab cross-check.
 * Canvas endpoints: none (reads local files only). Write calls: none.
 * Properties: none. Never prints the quiz access code.
 *
 * Usage: node qti-check.js <unzipped-export-folder> [question-text-output-file]
 */
const fs = require('fs');
const path = require('path');

const root = process.argv[2];
const textOut = process.argv[3];
if (!root || !fs.existsSync(root)) {
  console.error('Usage: node qti-check.js <unzipped-export-folder> [question-text-output-file]');
  process.exit(1);
}

const BIG = 1000 * 1000;      // flag as too big (Unit 2 trouble started near 1 MB)
const LARGE = 500 * 1000;     // worth shrinking

const unescape1 = s => s
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
const plain = h => unescape1(unescape1(h))
  .replace(/<img\b[^>]*>/gi, ' [picture] ').replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
const kb = n => (n >= BIG ? (n / 1e6).toFixed(1) + ' MB' : Math.round(n / 1000) + ' KB');
const attr = (s, name) => (s.match(new RegExp(name + '="([^"]*)"')) || [])[1];

function walkFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walkFiles(p) : [p];
  });
}

const allFiles = walkFiles(root);
const allText = allFiles.filter(f => /\.(xml|qti)$/i.test(f)).map(f => fs.readFileSync(f, 'utf8')).join('\n');

// Quiz files: <id>/<id>.xml next to assessment_meta.xml
const quizFiles = allFiles.filter(f => {
  const dir = path.dirname(f);
  return path.basename(f) === path.basename(dir) + '.xml' &&
    fs.existsSync(path.join(dir, 'assessment_meta.xml'));
});
if (!quizFiles.length) {
  console.error('No Classic quiz found in this folder (expected <id>/<id>.xml with assessment_meta.xml).');
  process.exit(1);
}

const textLines = [];
const usedFiles = new Set();

for (const qf of quizFiles) {
  const xml = fs.readFileSync(qf, 'utf8');
  const meta = fs.readFileSync(path.join(path.dirname(qf), 'assessment_meta.xml'), 'utf8');
  const tag = t => (meta.match(new RegExp('<' + t + '>([^<]*)</' + t + '>')) || [])[1];

  console.log('==================================================================');
  console.log(`QUIZ: ${unescape1(tag('title') || '(no title)')}`);
  console.log(`Points: ${tag('points_possible')} | LockDown Browser: ${tag('require_lockdown_browser')} | ` +
    `time limit: ${tag('time_limit') || 'none'} | access code: ${tag('access_code') ? 'set (not shown)' : 'none'}`);
  textLines.push(`QUIZ: ${unescape1(tag('title') || '')}`);

  const flags = [];
  const pictures = [];
  const groups = [];
  const open = []; // sections we're inside: a group object, or null for the quiz's outer section
  let current = null;
  let q = 0;
  let loosePoints = 0;
  let looseCount = 0;

  // Groups END at </section>: questions after it are loose (every student gets them).
  const re = /<section\b([^>]*)>([\s\S]*?)(?=<item\b|<section\b|<\/section>)|<item\b([^>]*)>([\s\S]*?)<\/item>|(<\/section>)/g;
  let m;
  while ((m = re.exec(xml))) {
    if (m[5] !== undefined) {
      open.pop();
      current = open.length ? open[open.length - 1] : null;
      if (!current) textLines.push('\n=== (not in a group: every student gets these)');
      continue;
    }
    if (m[1] !== undefined) {
      const title = attr(m[1], 'title');
      if (!title) { // the quiz's outer section
        open.push(null);
        current = null;
        continue;
      }
      const head = m[2];
      current = {
        title: unescape1(title),
        pick: Number((head.match(/<selection_number>(\d+)/) || [])[1] || 0),
        points: (head.match(/<points_per_item>([^<]+)/) || [])[1],
        bank: (head.match(/<sourcebank_ref>([^<]*)/) || [])[1],
        items: 0,
      };
      open.push(current);
      groups.push(current);
      textLines.push(`\n=== ${current.title}`);
      continue;
    }
    q++;
    const body = m[4];
    if (current) {
      current.items++;
    } else {
      looseCount++;
      loosePoints += Number((body.match(/points_possible<\/fieldlabel>\s*<fieldentry>([^<]*)/) || [])[1] || 0);
    }
    const where = `Q${q} (${current ? current.title : 'not in a group: every student'})`;
    const type = (body.match(/question_type<\/fieldlabel>\s*<fieldentry>([^<]*)/) || [])[1];
    const texts = [...body.matchAll(/<mattext[^>]*>([\s\S]*?)<\/mattext>/g)].map(x => plain(x[1]));
    textLines.push(`Q${q} [${type}] ${texts[0] || ''}`);
    if (texts.length > 1) textLines.push(`   choices: ${texts.slice(1).join(' | ')}`);

    if (!texts[0]) flags.push(`${where}: question has no text`);
    texts.slice(1).forEach(t => {
      if (!t || /^No answer text provided\.?$/i.test(t)) flags.push(`${where}: a blank answer choice ("No answer text provided")`);
    });

    const html = unescape1(body);
    for (const img of html.match(/<img\b[^>]*>/gi) || []) {
      const src = unescape1(attr(img, 'src') || '');
      const endpoint = attr(img, 'data-api-endpoint');
      const pic = { where, src, size: null, file: null };
      if (src.startsWith('$IMS-CC-FILEBASE$/')) {
        const rel = decodeURIComponent(src.replace('$IMS-CC-FILEBASE$/', '').split('?')[0]);
        const full = path.join(root, 'web_resources', rel);
        pic.file = rel;
        if (fs.existsSync(full)) {
          pic.size = fs.statSync(full).size;
          usedFiles.add(path.resolve(full));
          if (pic.size >= BIG) flags.push(`${where}: picture "${rel}" is ${kb(pic.size)}; shrink it`);
          else if (pic.size >= LARGE) flags.push(`${where}: picture "${rel}" is ${kb(pic.size)}; worth shrinking`);
        } else {
          flags.push(`${where}: picture "${rel}" is named in the question but missing from the export`);
        }
      } else if (/\/assessment_questions\//.test(src)) {
        flags.push(`${where}: picture points at an old question-bank file (broken for students)`);
      } else if (/^https?:\/\//i.test(src) && !/instructure\.com|\/courses\/|\/files\//.test(src)) {
        flags.push(`${where}: picture comes from an outside site: ${src.split('/')[2]}`);
      } else if (/\/users\/\d+/.test(src)) {
        flags.push(`${where}: picture is in someone's personal files (students can't see it)`);
      } else if (/\/courses\/\d+/.test(src)) {
        flags.push(`${where}: picture links to course ${src.match(/\/courses\/(\d+)/)[1]} (not packed; may be another course)`);
      } else {
        flags.push(`${where}: picture was not packed into the export: ${src.slice(0, 80)}`);
      }
      if (endpoint && /\/courses\/(\d+)/.test(endpoint)) {
        pic.endpoint = endpoint.match(/\/courses\/(\d+)/)[1];
      }
      pictures.push(pic);
    }
  }

  console.log(`\nGROUPS (${groups.length}), ${q} questions in all:`);
  for (const g of groups) {
    const bankNote = g.bank
      ? ` | BANK ${g.bank} (${allText.includes(`ident="${g.bank}"`) ? 'included in export' : 'NOT in export'})`
      : '';
    console.log(`  ${g.title}: pick ${g.pick || '-'} of ${g.items}${g.points ? `, ${g.points} pts each` : ''}${bankNote}`);
    if (!g.bank && g.pick > g.items) flags.push(`Group "${g.title}" picks ${g.pick} but only has ${g.items} questions`);
    if (g.bank && !allText.includes(`ident="${g.bank}"`)) flags.push(`Group "${g.title}" pulls from a bank that isn't in the export; its pictures weren't checked`);
  }

  const groupPoints = groups.reduce((sum, g) => sum + (g.pick || 0) * Number(g.points || 0), 0);
  const quizPoints = Number(tag('points_possible') || 0);
  const found = Math.round((groupPoints + loosePoints) * 100) / 100;
  if (looseCount) console.log(`  Not in a group (every student gets these): ${looseCount} question(s), ${loosePoints} pts`);
  console.log(`  Points found: ${found} (groups ${groupPoints} + loose ${loosePoints}) | quiz settings say: ${quizPoints}`);
  if (Math.abs(found - quizPoints) > 0.001) {
    flags.push(`Questions add up to ${found} points but the quiz says ${quizPoints}` +
      (groups.some(g => g.bank) ? ' (bank groups may explain it)' : '') +
      '; confirm with Quiz report or the quiz\'s Questions tab');
  }

  console.log(`\nPICTURES (${pictures.length} uses):`);
  for (const p of pictures) {
    const size = p.size != null ? kb(p.size) : '?';
    const name = p.file || p.src;
    console.log(`  ${p.where}: ${name} [${size}]${p.endpoint ? ` (leftover tag: course ${p.endpoint})` : ''}`);
  }
  const endpoints = [...new Set(pictures.filter(p => p.endpoint).map(p => p.endpoint))];
  if (endpoints.length > 1) {
    flags.push(`Pictures carry leftover tags for more than one course (${endpoints.join(', ')}); usually harmless if the picture is packed, but worth a look`);
  }

  console.log(`\nFLAGS (${flags.length}):`);
  if (!flags.length) console.log('  none');
  for (const f of flags) console.log(`  - ${f}`);
}

const unused = allFiles.filter(f => f.includes(`${path.sep}web_resources${path.sep}`) && !usedFiles.has(path.resolve(f)));
if (unused.length) {
  console.log(`\nFiles in the export no question uses (${unused.length}): ` +
    unused.map(f => path.relative(path.join(root, 'web_resources'), f)).join(', '));
}

if (textOut) {
  fs.writeFileSync(textOut, textLines.join('\n') + '\n');
  console.log(`\nQuestion text written to ${textOut}`);
}
