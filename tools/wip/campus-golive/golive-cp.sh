#!/bin/bash
[ -n "$E4_PIN" ] || { echo "set E4_PIN (the instructor PIN, from the owner's private notes) first"; exit 1; }
# golive-cp.sh NN COMMIT: the staged tree of CP-NN, its save-point line, the PIN scan, the live worktree made exactly that, pushed
set -euo pipefail
SP=/tmp/claude-0/-home-user/c41d5321-7fd8-5327-b7c4-485ab1f2a414/scratchpad/stg; N="$1"; C="$2"; D=$SP/cp$N
SUBJ=$(git -C /home/user/e4-cpt log -1 --format=%s $C)
python3 - "$D/CLAUDE.md" "$N" <<'PY'
import sys
f, n = sys.argv[1], int(sys.argv[2]); s = open(f).read()
ids = ", ".join("CP-%02d" % k for k in range(1, n + 1))
line = "- **Level 4's tickets go live one at a time, smallest first (the owner's order):** " + ids + " live (23 and 24 November 2026), each after its own checks on a tree staged from its own commit (unit tests, its drive, its contrast states and plants). See \"Level 4, the campus\" below for each ticket.\n"
anchor = "- **Next, in the owner's order:** the rest of Level 4"
assert s.count(anchor) == 1
s = s.replace(anchor, line + anchor); open(f, "w").write(s)
PY
grep -rl "$E4_PIN" "$D" --exclude-dir=node_modules && { echo "PIN FOUND"; exit 1; } || true
bash /home/user/e4-sbt/tools/wip/golive.sh "$D" "Level 4: $SUBJ

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RJLBXRTXfG6AwMuw7eyynw" > /dev/null
cd /home/user/e4-sb01
diff -rq --exclude=.git --exclude=node_modules "$D" . && echo "live tree = staged tree"
for i in 1 2 3 4; do git push -q origin HEAD:main && git push -q origin HEAD:save/level3-sb01 && break; sleep $((i*2)); done
git fetch -q origin main; [ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" ] && echo "pushed: main at $(git rev-parse --short HEAD)"
