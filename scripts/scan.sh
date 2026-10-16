#!/usr/bin/env bash
# Security and standards scan for Canvas Apps Script projects.
#
#   npm run scan                 scan every project folder
#   bash scripts/scan.sh FILE    scan one file or folder
#   --strict                     also fail on warnings (used by the Claude hook)
#
# Three checks:
#   1. gitleaks            secrets such as Canvas tokens and API keys
#   2. eslint + security   risky JavaScript patterns
#   3. check-standards.js  our own rules (dry run, logging student data, scopes)

cd "$(dirname "$0")/.." || exit 1
STRICT=""
if [ "$1" = "--strict" ]; then STRICT="--strict"; shift; fi
TARGETS=("$@")
[ ${#TARGETS[@]} -eq 0 ] && TARGETS=(".")

status=0

echo "== 1. Secret scan (gitleaks)"
if command -v gitleaks >/dev/null 2>&1; then
  for t in "${TARGETS[@]}"; do
    gitleaks dir "$t" --config .gitleaks.toml --redact --no-banner --log-level error -v || status=1
  done
else
  echo "   gitleaks is not installed, so secrets were NOT checked. See SETUP.md."
  status=1
fi

echo "== 2. JavaScript security lint (eslint)"
if [ -x node_modules/.bin/eslint ]; then
  JS=()
  for t in "${TARGETS[@]}"; do
    if [ -d "$t" ]; then JS+=("$t"); elif [[ "$t" == *.js || "$t" == *.gs ]]; then JS+=("$t"); fi
  done
  if [ ${#JS[@]} -gt 0 ]; then
    node_modules/.bin/eslint --no-warn-ignored "${JS[@]}" || status=1
  fi
else
  echo "   eslint is not installed (run: npm install). Skipped."
  status=1
fi

echo "== 3. Project standards (check-standards.js)"
node scripts/check-standards.js $STRICT "${TARGETS[@]}" || status=1

if [ $status -eq 0 ]; then echo "== PASS"; else echo "== ISSUES FOUND (see above)"; fi
exit $status
