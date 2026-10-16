#!/usr/bin/env node
// Runs after Claude edits or writes a file. Scans that one file with
// scripts/scan.sh. If anything is found, exit code 2 sends the report back
// to Claude so it can fix the problem and tell Lara.
const { spawnSync } = require('child_process');
const path = require('path');

let input = '';
process.stdin.on('data', (chunk) => (input += chunk));
process.stdin.on('end', () => {
  let filePath = '';
  try {
    filePath = JSON.parse(input).tool_input?.file_path || '';
  } catch {
    process.exit(0); // Unreadable hook input: don't block work.
  }
  if (!/\.(js|gs|html|json)$/i.test(filePath)) process.exit(0);
  if (/node_modules|[\\/]\.claude[\\/]|package(-lock)?\.json$/.test(filePath)) process.exit(0);

  const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const scan = spawnSync('bash', [path.join(projectDir, 'scripts', 'scan.sh'), '--strict', filePath], {
    cwd: projectDir,
    encoding: 'utf8',
  });
  if (scan.status !== 0) {
    process.stderr.write(
      `Security/standards scan found issues in ${path.basename(filePath)}:\n` +
        (scan.stdout || '') + (scan.stderr || '') +
        '\nFix these (or explain to Lara why they are acceptable) before continuing.\n'
    );
    process.exit(2);
  }
  process.exit(0);
});
