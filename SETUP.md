# Canvas Scripts: Setup and Daily Use

## What's in this folder

| File | What it's for |
|---|---|
| `CLAUDE.md` | The standards. Claude Code reads this automatically at the start of every session. |
| `.claude/settings.json` | Claude Code rules: start in Manual mode, never read your clasp login or data files, ask before `clasp push`, and run the scan after every edit. |
| `.claude/hooks/after-edit.js` | The after-edit hook. Scans each file Claude changes and reports problems back to Claude. |
| `scripts/scan.sh` | Runs all three checks. Run it yourself any time with `npm run scan`. |
| `scripts/check-standards.js` | Our own rules: Canvas tokens, dry-run guard, student data in logs, permissions. |
| `.gitleaks.toml` | Secret-scanner settings, including a rule for Canvas tokens |
| `eslint.config.cjs` | JavaScript security lint settings for Apps Script |
| `.githooks/pre-commit` | Blocks any Git commit that contains a secret |
| `.gitignore` | Keeps credentials and student data files out of Git |
| `course-manager/`, etc. | One subfolder per Apps Script project |

## One-time setup on a new computer

Start Claude Code in this folder and paste this:

> Please finish setting up this folder using SETUP.md. Explain each command before
> running it, and don't use sudo.
> 1. Check that git works (`git --version`). If it isn't installed, tell me how to install it.
> 2. Set my git name and email if they aren't set yet: ask me what to use.
> 3. Install gitleaks into ~/.local/bin (Mac) from the official GitHub release for my
>    chip. Verify the checksum from the release's checksums file.
> 4. Run `npm install --save-dev eslint eslint-plugin-security`.
> 5. Run `git init` in this folder (if it isn't a git repo yet) and
>    `git config core.hooksPath .githooks`, then `chmod +x .githooks/pre-commit scripts/scan.sh`.
> 6. Run `npm run scan` and summarize the results for me. Don't fix anything yet,
>    and don't commit yet.

If the scan finds a Canvas token, **revoke it in Canvas first**: go to Account > Settings >
Approved Integrations. Deleting it from the code isn't enough, because the old copy
still works until it's revoked.

## Daily use

- `cd ~/code/canvas-scripts && claude` starts a session with the standards loaded.
  Always start from this folder, not a project subfolder, so the settings and hooks apply.
- `npm run scan` scans everything. `bash scripts/scan.sh course-manager` scans one project.
- `/clear` between tasks.
- **Before `clasp push`:** read the diff, check that the scan passes, and commit first,
  so you can undo it.

## Adding another Apps Script project

Ask Claude: "Clone script ID `<id>` into a new subfolder called `<short-name>`." Then
run `npm run scan` on it before the first commit.

## Windows (later)

The same files work on Windows. Install Claude Code (`irm https://claude.ai/install.ps1 | iex`
in PowerShell), plus Git for Windows, Node.js LTS, and gitleaks, then copy this repo over.
GitHub (a private repository) is the easiest way to keep both computers in sync.
Ask Claude Code to walk you through it.
