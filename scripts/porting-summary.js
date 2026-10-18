/**
 * scripts/porting-summary.js
 * Purpose: builds course-manager-jupiter/docs/porting-summary.md from the Decision column
 *   of course-manager-jupiter/docs/legacy-function-map.md, so the summary never drifts
 *   from the map. The map is the source of truth; never edit the summary by hand.
 *   Decision values: "ported → newName (File.js)", "later: <why>", "leave behind:
 *   <reason>"; blank = not yet reviewed. Anything else stops the script and names the row.
 *   Usage: npm run porting-summary   (or: node scripts/porting-summary.js)
 *   Repo helper only: not part of any Apps Script project; never clasp-pushed.
 * Canvas endpoints called: none. Canvas write operations: none.
 * Required User/Script Properties: none. Reads and writes only those two docs files.
 */
const fs = require('fs');
const path = require('path');

const DOCS = path.join(__dirname, '..', 'course-manager-jupiter', 'docs');
const MAP = path.join(DOCS, 'legacy-function-map.md');
const SUMMARY = path.join(DOCS, 'porting-summary.md');

/** Reads every function row: { fn, file, purpose, decision }. */
function readMap(text) {
  const rows = [];
  let file = '';
  for (const line of text.split(/\r?\n/)) {
    const heading = line.match(/^## (\S+?):/);
    if (heading) file = heading[1];
    if (!line.startsWith('| `')) continue;
    const cells = line.split('|').slice(1, -1).map((cell) => cell.trim());
    rows.push({ fn: cells[0], file, purpose: cells[1], decision: cells[cells.length - 1] });
  }
  return rows;
}

/** Sorts a row into ported / later / leave / unreviewed, with the text after the label. */
function classify(row) {
  const d = row.decision;
  if (d === '') return { group: 'unreviewed' };
  const ported = d.match(/^ported\s*(?:→|->)\s*(.+)$/);
  if (ported) return { group: 'ported', detail: ported[1] };
  const later = d.match(/^later\s*:?\s*(.*)$/);
  if (later) return { group: 'later', detail: later[1] };
  const leave = d.match(/^leave behind\s*:?\s*(.*)$/);
  if (leave) return { group: 'leave', detail: leave[1] };
  throw new Error(`Decision for ${row.fn} (${row.file}) isn't ported →, later:, ` +
    `leave behind:, or blank: "${d}"`);
}

function table(headers, lines) {
  if (!lines.length) return '_None._\n';
  return [`| ${headers.join(' | ')} |`, `|${headers.map(() => '---').join('|')}|`]
    .concat(lines.map((cells) => `| ${cells.join(' | ')} |`)).join('\n') + '\n';
}

const rows = readMap(fs.readFileSync(MAP, 'utf8'));
const groups = { ported: [], later: [], leave: [], unreviewed: [] };
rows.forEach((row) => {
  const { group, detail } = classify(row);
  groups[group].push(Object.assign({ detail }, row));
});

const total = rows.length;
const out = [
  '# Porting summary: legacy `course-manager` → `course-manager-jupiter`',
  '',
  '> **Generated** from the Decision column of `legacy-function-map.md` by',
  '> `npm run porting-summary`. Don\'t edit this file by hand: change the map, then rerun.',
  '',
  `**${total} legacy functions:** ${groups.ported.length} ported · ` +
    `${groups.later.length} planned for later · ${groups.leave.length} left behind on ` +
    `purpose · ${groups.unreviewed.length} not yet reviewed.`,
  '',
  `## Ported (${groups.ported.length})`,
  '',
  table(['Legacy function', 'Legacy file', 'Now'],
    groups.ported.map((r) => [r.fn, r.file, r.detail])),
  `## Planned for later (${groups.later.length})`,
  '',
  table(['Legacy function', 'Legacy file', 'When / why'],
    groups.later.map((r) => [r.fn, r.file, r.detail])),
  `## Left behind on purpose (${groups.leave.length})`,
  '',
  table(['Legacy function', 'Legacy file', 'Reason'],
    groups.leave.map((r) => [r.fn, r.file, r.detail])),
  `## Not yet reviewed (${groups.unreviewed.length})`,
  '',
  table(['Legacy function', 'Legacy file', 'What it does'],
    groups.unreviewed.map((r) => [r.fn, r.file, r.purpose])),
].join('\n');

fs.writeFileSync(SUMMARY, out);
console.log(`porting-summary.md written: ${groups.ported.length} ported, ` +
  `${groups.later.length} later, ${groups.leave.length} left behind, ` +
  `${groups.unreviewed.length} not yet reviewed (${total} total).`);
