/**
 * scripts/check-offline.js
 * Purpose: runs every offline check in scripts/checks/ (files named *.check.js) and
 *   reports which passed. Checks use made-up data only, never real course or student
 *   data, and never contact Canvas or Google. Exits with an error if any check fails.
 *   Usage: npm run check-offline
 *   Repo helper only: not part of any Apps Script project; never clasp-pushed.
 * Canvas endpoints called: none. Canvas write operations: none.
 * Required User/Script Properties: none.
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const CHECKS = path.join(__dirname, 'checks');
const files = fs.readdirSync(CHECKS).filter((file) => file.endsWith('.check.js')).sort();
let failed = 0;

files.forEach((checkFile) => {
  const run = spawnSync(process.execPath, [path.join(CHECKS, checkFile)], { encoding: 'utf8' });
  const output = `${run.stdout || ''}${run.stderr || ''}`;
  const passes = (output.match(/^PASS /gm) || []).length;
  const fails = (output.match(/^FAIL /gm) || []).length;
  const ok = run.status === 0;
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${checkFile}: ${passes} passed, ${fails} failed`);
  if (!ok) console.log(output.split('\n').filter((line) => !line.startsWith('PASS ')).join('\n'));
});

console.log(failed ? `\n${failed} of ${files.length} check file(s) failed.` :
  `\nAll ${files.length} check file(s) passed.`);
process.exitCode = failed ? 1 : 0;
