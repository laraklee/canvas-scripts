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
> 6. Clone my private notes repo into a `private` folder here:
>    `git clone https://github.com/laraklee/canvas-scripts-private.git private`.
>    (This repo is public; the personal-info check reads `private/blocked-words.txt`.)
> 7. Run `npm run scan` and summarize the results for me. Don't fix anything yet,
>    and don't commit yet.

If the scan finds a Canvas token, **revoke it in Canvas first**: go to Account > Settings >
Approved Integrations. Deleting it from the code isn't enough, because the old copy
still works until it's revoked.

## Daily use

The copy on your Mac is the main version. Google (the live script) and GitHub (the
backup) are copies of it.

### The everyday loop

1. **Start.** Run `cd ~/code/canvas-scripts && claude`. Always start from this folder,
   not a project subfolder, so the settings and hooks apply.
2. **Sync first, if needed.** If you edited the script in Google's browser editor since
   last time, ask Claude to run `clasp pull` in that project's folder and commit
   ("Sync from Google").
3. **Make the change in Claude Code.** Describe what you want, read the diff, and let
   the automatic scan run.
4. **Commit, then test it in Google.** "Commit this" first, so you can undo it. Then
   approve `clasp push` and run it from the Sheet. Test anything that writes to Canvas
   in a sandbox course first.
5. **Keep it or undo it.**
   - Works: you're done. At the end of the session: "Push to GitHub."
   - Doesn't work: fix it and commit again, or "Revert that commit." Git goes back to
     the last good version. Then `clasp push` again so Google matches.

### The one rule

**Don't edit in two places between syncs.** If you fix something in the browser editor
and then `clasp push` from the Mac without pulling first, the browser edit is
overwritten. Quick browser fixes are fine: just `clasp pull` and commit next time.

### Where each tool fits

| Tool | Use it for |
|---|---|
| Claude Code | Writing and changing code, reviews, scans, commits |
| Google's script editor | Running and testing, logs, Script Properties, emergency fixes |
| GitHub (public repo; personal notes in the private notes repo) | Backup, browsable history, getting the code onto another computer |
| Claude (Cowork) | Planning, questions, privacy and design decisions |

### Handy commands

- `npm run scan` scans everything. `bash scripts/scan.sh course-manager` scans one project.
- `/clear` in Claude Code between tasks.
- Use one Claude Code session at a time in this folder.

## Adding another Apps Script project

Ask Claude: "Clone script ID `<id>` into a new subfolder called `<short-name>`." Then
run `npm run scan` on it before the first commit.

## Windows (later)

The same files work on Windows. Install Claude Code (`irm https://claude.ai/install.ps1 | iex`
in PowerShell), plus Git for Windows, Node.js LTS, and gitleaks, then copy this repo over.
GitHub is the easiest way to keep both computers in sync. Clone both this public repo
and the private notes repo (step 6 above).
Ask Claude Code to walk you through it.
