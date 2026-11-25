#!/bin/bash
[ -n "$E4_PIN" ] || { echo "set E4_PIN (the instructor PIN, from the owner's private notes) first"; exit 1; }
# golive-cp15.sh "results line": CP-15 and Level 4 complete
set -euo pipefail
SP=/tmp/claude-0/-home-user/c41d5321-7fd8-5327-b7c4-485ab1f2a414/scratchpad/stg; D=$SP/cp15
python3 - "$D/CLAUDE.md" "$1" <<'PY'
import sys
f, res = sys.argv[1], sys.argv[2]; s = open(f).read()
ids = ", ".join("CP-%02d" % k for k in range(1, 16))
line = "- **Level 4's tickets went live one at a time, smallest first (the owner's order):** " + ids + " live (23 and 24 November 2026), each after its own checks on a tree staged from its own commit (unit tests, its drive, its contrast states and plants). **Level 4 is complete: all 10 work orders and 15 tickets, live 24 November 2026, so it no longer carries `planned`.** See \"Level 4, the campus\" below for each ticket.\n"
a = "- **Next, in the owner's order:** the rest of Level 4: the campus's Ticket Desk and its 15 tickets, smallest first; then Level 5\n  (Enterprise)."
assert s.count(a) == 1
s = s.replace(a, line + "- **Next, in the owner's order:** Level 5 (Enterprise).")
a2 = "    port security records its reason; `show port-security interface` says Secure-down, not Secure-shutdown, for a port BPDU guard shut."
assert s.count(a2) == 1
s = s.replace(a2, a2 + "\n  - Level 4 complete with it: `planned` and \"more tickets on the way\" gone (`js/desk/levels.js`); the drive finishes Level 4 through the\n    page (every ticket solved, every work order but the last done, the last one finished: the done box says Level 4 is finished and the\n    enterprise level is still being built; Level 5 says built later); `tests/levels.test.js` holds Level 4 complete.\n  - **Checks, on its tree:** " + res)
open(f, "w").write(s)
PY
grep -rl "$E4_PIN" "$D" --exclude-dir=node_modules && { echo "PIN FOUND"; exit 1; } || true
find "$D" -name "*.orig" | grep . && { echo "ORIG FOUND"; exit 1; } || true
bash /home/user/e4-sbt/tools/wip/golive.sh "$D" "Level 4: CP-15, the technicians' bench off the network since this morning (BPDU guard: a customer's managed switch on the bench, or an unmanaged one looping the bench's two ports; taken away on its Physical tab, then the ports shut and opened); Level 4 complete; for every level: BPDU guard before port security, BPDUs through an unmanaged switch, show interfaces status err-disabled with its reasons

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RJLBXRTXfG6AwMuw7eyynw" > /dev/null
cd /home/user/e4-sb01
diff -rq --exclude=.git --exclude=node_modules "$D" . && echo "live tree = staged tree"
for i in 1 2 3 4; do git push -q origin HEAD:main && git push -q origin HEAD:save/level3-sb01 && break; sleep $((i*2)); done
git fetch -q origin main; [ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" ] && echo "pushed: main at $(git rev-parse --short HEAD)"
