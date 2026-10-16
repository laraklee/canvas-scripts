#!/usr/bin/env node
// Project-specific checks for Canvas Apps Script code. See CLAUDE.md.
// ERROR = must fix. WARN = review; explain or fix.
// Usage: node scripts/check-standards.js [--strict] [file-or-folder ...]
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const strict = args.includes('--strict');
const targets = args.filter((a) => a !== '--strict');
if (targets.length === 0) targets.push('.');

const SKIP_DIRS = new Set(['node_modules', '.git', '.claude', 'scripts']);
const findings = [];
const add = (level, file, line, msg) => findings.push({ level, file, line, msg });

function walk(p, out) {
  if (!fs.existsSync(p)) return out;
  const stat = fs.statSync(p);
  if (stat.isFile()) return out.push(p), out;
  for (const name of fs.readdirSync(p)) {
    if (SKIP_DIRS.has(name)) continue;
    walk(path.join(p, name), out);
  }
  return out;
}

const STUDENT_FIELDS = /\b(name|sortable_name|short_name|email|login_id|sis_user_id|user_id|score|grade|submission|body)\b/i;

function checkCode(file, text) {
  const lines = text.split('\n');
  lines.forEach((line, i) => {
    const n = i + 1;
    if (/\b\d{1,6}~[A-Za-z0-9]{30,}\b/.test(line))
      add('ERROR', file, n, 'Looks like a Canvas API token. Remove it, store it in Script Properties, and REVOKE it in Canvas.');
    if (/Bearer\s+[A-Za-z0-9~._-]{20,}/.test(line))
      add('ERROR', file, n, 'Hardcoded Bearer token. Read the token from PropertiesService instead.');
    if (/(Logger\.log|console\.(log|info|warn|error))\s*\(/.test(line) && STUDENT_FIELDS.test(line))
      add('WARN', file, n, 'Log line may include student data (names, emails, IDs, grades). Log counts or IDs of courses/assignments instead.');
    if (/https?:\/\/[a-z0-9.-]+\.instructure\.com/i.test(line))
      add('WARN', file, n, 'Hardcoded Canvas URL. Read the base URL from Script Properties.');
    if (/\beval\s*\(|new Function\s*\(/.test(line))
      add('ERROR', file, n, 'eval/new Function runs text as code. Not allowed.');
  });

  const writes = text.match(/method\s*:\s*['"](post|put|patch|delete)['"]/gi);
  if (writes && !/DRY_RUN/.test(text))
    add('WARN', file, 0, `Makes ${writes.length} Canvas write call(s) (POST/PUT/PATCH/DELETE) but has no DRY_RUN guard.`);
  if (!/^\s*(\/\/|\/\*)/.test(text))
    add('WARN', file, 1, 'Missing header comment (purpose, endpoints, write calls, Script Properties).');
}

function checkManifest(file, text) {
  let m;
  try { m = JSON.parse(text); } catch { return add('ERROR', file, 0, 'appsscript.json is not valid JSON.'); }
  if (!Array.isArray(m.oauthScopes))
    add('WARN', file, 0, 'No "oauthScopes" list. Google will infer permissions; list the narrowest scopes explicitly.');
  else
    for (const s of m.oauthScopes)
      if (/\/auth\/(drive|spreadsheets|documents|gmail\.modify|mail\.google\.com)$/.test(s) || /mail\.google\.com/.test(s))
        add('WARN', file, 0, `Broad scope ${s}. Use a narrower one if possible (e.g. drive.file, spreadsheets.currentonly).`);
  const access = m.webapp && m.webapp.access;
  if (access && /^ANYONE/.test(access))
    add('ERROR', file, 0, `Web app access is ${access}. Use MYSELF or DOMAIN.`);
  const adv = (m.dependencies && m.dependencies.enabledAdvancedServices) || [];
  for (const s of adv)
    if (s.serviceId === 'drive')
      add('WARN', file, 0, 'Advanced Drive service is enabled. Confirm it is needed; DriveApp with drive.file may be enough.');
}

const files = targets.flatMap((t) => walk(t, [])).filter((f) =>
  /\.(js|gs|csv|xlsx?|tsv)$/i.test(f) || path.basename(f) === 'appsscript.json');
for (const f of files) {
  const base = path.basename(f);
  if (/\.(js|gs)$/i.test(f)) checkCode(f, fs.readFileSync(f, 'utf8'));
  else if (base === 'appsscript.json') checkManifest(f, fs.readFileSync(f, 'utf8'));
  else if (/\.(csv|xlsx?|tsv)$/i.test(f)) add('ERROR', f, 0, 'Data export in project folder. Student data files must not live here.');
}

for (const x of findings) console.log(`   ${x.level}  ${x.file}${x.line ? ':' + x.line : ''}  ${x.msg}`);
const errors = findings.filter((x) => x.level === 'ERROR').length;
const warns = findings.length - errors;
console.log(`   ${files.length} file(s) checked: ${errors} error(s), ${warns} warning(s)`);
process.exit(errors > 0 || (strict && warns > 0) ? 1 : 0);
