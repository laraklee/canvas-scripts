#!/usr/bin/env bash
# Personal-info check. This repo is public, so personal details must not be committed.
#
#   bash scripts/check-personal.sh            check every file Git tracks
#   bash scripts/check-personal.sh FILE...    check just these files (the pre-commit hook does this)
#
# Built-in checks (safe to publish):
#   - email addresses, except placeholders (example.*) and known service addresses
#   - phone numbers
#   - Windows user folders other than C:\Users\lalee
# Private words (the school's name, people's names, and so on) come from
# blocked-words.txt in the private notes repo (canvas-scripts/private/), which is never
# published. One word or phrase per line; lines starting with # are ignored.
# Exit code 1 if anything is found.

cd "$(dirname "$0")/.." || exit 1

FILES=()
if [ $# -gt 0 ]; then
  FILES=("$@")
else
  while IFS= read -r f; do FILES+=("$f"); done < <(git ls-files)
fi

# Skip files that can't hold personal notes, and this script (it contains the patterns).
CHECK=()
for f in "${FILES[@]}"; do
  [ -f "$f" ] || continue
  case "$f" in
    package-lock.json|*/package-lock.json|node_modules/*|private/*|scripts/check-personal.sh) continue ;;
  esac
  CHECK+=("$f")
done
[ ${#CHECK[@]} -eq 0 ] && exit 0

found=0
report() { # $1 = problem, then grep output on stdin
  while IFS= read -r line; do
    echo "   PERSONAL  ${line%%:*}:$(echo "$line" | cut -d: -f2)  $1"
    found=1
  done
}

EMAIL='[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}'
EMAIL_OK='@example\.|noreply@anthropic\.com|@users\.noreply\.github\.com|@(import|group)\.calendar\.google\.com'
report "Email address. Use a placeholder such as name@example.test." < <(
  grep -nHIoE "$EMAIL" "${CHECK[@]}" 2>/dev/null | grep -vE "$EMAIL_OK")

report "Phone number." < <(
  grep -nHIE '(^|[^0-9])\(?[0-9]{3}\)?[-. ][0-9]{3}[-. ][0-9]{4}([^0-9]|$)' "${CHECK[@]}" 2>/dev/null)

report "Windows user folder. Use C:\\Users\\lalee\\... or a placeholder." < <(
  grep -nHIiE '[A-Z]:\\+Users\\+' "${CHECK[@]}" 2>/dev/null | grep -viE '[A-Z]:\\+Users\\+(lalee|<[^>]*>)\\')

WORDS=""
for w in private/blocked-words.txt ../canvas-scripts/private/blocked-words.txt; do
  if [ -f "$w" ]; then WORDS="$w"; break; fi
done
if [ -n "$WORDS" ]; then
  LIST=$(mktemp)
  grep -vE '^[[:space:]]*(#|$)' "$WORDS" > "$LIST"
  if [ -s "$LIST" ]; then
    report "Word from the private blocked-words list." < <(
      grep -nHIiwF -f "$LIST" "${CHECK[@]}" 2>/dev/null)
  fi
  rm -f "$LIST"
else
  echo "   note: private blocked-words list not found, so only the built-in checks ran."
fi

if [ $found -eq 1 ]; then
  echo "   This repo is public. Move personal details to the private notes repo (canvas-scripts/private/)."
  exit 1
fi
exit 0
