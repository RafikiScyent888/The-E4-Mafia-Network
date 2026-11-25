#!/bin/bash
[ -n "$E4_PIN" ] || { echo "set E4_PIN (the instructor PIN, from the owner's private notes) first"; exit 1; }
# stage.sh COMMIT DEST: the ticket's own commit, with the drive's Level 4 lines counting tickets (e68cbc9), the branch's latest notes and plants script
set -euo pipefail
C="$1"; D="$2"; R=/home/user/e4-cpt
rm -rf "$D"; mkdir -p "$D"; cd "$R"
git archive "$C" | tar -x -C "$D"
if ! grep -q "const nT4b = LEVELS\[3\].tickets.length; check(L4 === \"Level 4 · Campus0 of \" + nT4b" "$D/tools/drive.mjs"; then
  git diff 8eeeaef e68cbc9 -- tools/drive.mjs | (cd "$D" && patch -s --no-backup-if-mismatch -p1)
fi
git show 11d3546:CLAUDE.md > "$D/CLAUDE.md"
git show 0843816:tools/plants-campus-tickets.py > "$D/tools/plants-campus-tickets.py"
grep -rl "$E4_PIN" "$D" --exclude-dir=node_modules && { echo "PIN FOUND"; exit 1; } || true
echo "staged $C at $D"
