# Stage Level 3's tickets for going live one at a time: a copy of this checkout with the tickets after SB-<N> cut out.
#   python3 tools/wip/stage.py N DEST      (DEST must not exist; it is filled from `git archive HEAD`)
# What is cut, for each ticket after N:
#   js/tickets/business.js   its section (from its "---- SB-0K" line to the next), and its name in BUSINESS_TICKETS
#   tools/drive.mjs          its PLAN entry
#   tools/aaa-states.json    its contrast states
#   tools/wip/sb0Krun.mjs    its scratch runner
# Shared code goes live with the first ticket that needs it, so before then the live version (LIVE) is kept:
#   N < 5: js/net/sim.js and tests/business-sim.test.js (the provider's gateway answering), the provider's row on the card
#   N < 8: js/net/cmd.js (the console's native VLAN mismatch log)
# The plants file stays whole: it skips a plant whose ticket isn't on the desk.
import json, os, re, subprocess, sys
N, DEST = int(sys.argv[1]), sys.argv[2]
LIVE = os.environ.get("LIVE", "origin/main")
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..")
assert not os.path.exists(DEST), DEST + " exists"
os.makedirs(DEST)
subprocess.run("git archive HEAD | tar -x -C " + DEST, shell=True, check=True, cwd=ROOT)
def rd(f): return open(os.path.join(DEST, f)).read()
def wr(f, s): open(os.path.join(DEST, f), "w").write(s)
def live(f): wr(f, subprocess.run(["git", "show", LIVE + ":" + f], cwd=ROOT, capture_output=True, text=True, check=True).stdout)

# the tickets
s = rd("js/tickets/business.js")
m = re.search(r"export const BUSINESS_TICKETS = \[([^\]]*)\];", s)
ids = [x.strip() for x in m.group(1).split(",")]
keep = [x for x in ids if int(x[2:]) <= N]
assert keep == ["SB%02d" % k for k in range(1, N + 1)], keep
if N < len(ids):
    a = s.index("/* " + "-" * 64 + " SB-%02d */" % (N + 1))
    b = s.index("export const BUSINESS_TICKETS")
    cut = s[a:b]
    s = s[:a] + s[b:]
    # nothing kept may use a name the cut sections define
    names = set(re.findall(r"^(?:const|function) (\w+)", cut, re.M))
    used = [n for n in names if re.search(r"\b" + n + r"\b", s)]
    assert not used, "kept code uses cut names: " + ", ".join(used)
s = s.replace(m.group(0), "export const BUSINESS_TICKETS = [" + ", ".join(keep) + "];")
if N < 5:
    a = '].concat(p.fixed ? [["The provider", "fixed address " + p.fixed.ip + "/" + p.fixed.len + " on the router\'s provider port · their gateway " + p.fixed.gw + " · their DNS servers " + p.dns.join(" and ")]] : [], plan);'
    assert s.count(a) == 1; s = s.replace(a, "].concat(plan);")
    live("js/net/sim.js"); live("tests/business-sim.test.js")
if N < 8: live("js/net/cmd.js")
wr("js/tickets/business.js", s)

# the drive's plans
d = rd("tools/drive.mjs")
for k in range(N + 1, len(ids) + 1):
    a = d.index('  "SB-%02d": ' % k)
    nxt = d.find('  "SB-%02d": ' % (k + 1), a)
    b = nxt if nxt >= 0 else d.index("\n});\n", a) + 1
    d = d[:a] + d[b:]
assert not re.search(r'^  "SB-(\d\d)": ', d, re.M) or max(int(x) for x in re.findall(r'^  "SB-(\d\d)": ', d, re.M)) == N
wr("tools/drive.mjs", d)

# the contrast states
st = json.loads(rd("tools/aaa-states.json"))
st = [x for x in st if not (str(x.get("ticket", "")).startswith("SB-") and int(x["ticket"][3:]) > N)]
wr("tools/aaa-states.json", json.dumps(st, indent=1, ensure_ascii=False) + "\n")

for k in range(N + 1, 10):
    f = os.path.join(DEST, "tools/wip/sb%02drun.mjs" % k)
    if os.path.exists(f): os.remove(f)
print("staged SB-01..SB-%02d in %s" % (N, DEST))
