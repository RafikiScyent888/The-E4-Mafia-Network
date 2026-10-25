import subprocess, shutil, sys, os, tempfile
# Plants for the Level 3 cases in tools/models.mjs, each put into a throwaway copy of this checkout (the real one never holds a
# planted defect) and run through `ONLY=business node tools/models.mjs`: every one must make it fail.
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
PLANTS = [
 ("SB-J4: the lower row's lights read only from above", "js/desk/model3d.js", ', ["Lower row lights", { focus: "panel:Front", view: [0.3, 0.03, 1], light: [0.3, 1.2, 1.0] }]', ""),
 ("SB-J4: the lower row's view looks down like the close-up", "js/desk/model3d.js", '["Lower row lights", { focus: "panel:Front", view: [0.3, 0.03, 1],', '["Lower row lights", { focus: "panel:Front", view: [0.06, 0.12, 1],'),
 ("a port's light lit whatever the far end", "js/net/physical.js", "p.link = sim.cableUp(c); p.speed = sim.speed(c);", "p.link = true; p.speed = sim.speed(c);"),
 ("the back switch drawn as the closet switch", "js/net/physical.js", "  const x = sim.d[id]; if (!x) return null;", "  if (id === \"bsw\") id = \"msw\"; const x = sim.d[id]; if (!x) return null;"),
]
only = sys.argv[1:]
caught = 0; run = 0
for name, f, a, b in PLANTS:
    if only and not any(o in name for o in only): continue
    tmp = tempfile.mkdtemp(prefix="l3models-")
    try:
        shutil.copytree(ROOT, tmp, dirs_exist_ok=True, ignore=shutil.ignore_patterns(".git", "node_modules", "wip-out"))
        p = os.path.join(tmp, f); src = open(p).read()
        if src.count(a) != 1: print("PLANT DID NOT APPLY · " + name + " · " + str(src.count(a))); continue
        open(p, "w").write(src.replace(a, b))
        r = subprocess.run(["node", "tools/models.mjs"], cwd=tmp, env=dict(os.environ, ONLY="business"), capture_output=True, text=True, timeout=1500)
        lines = r.stdout.strip().splitlines(); fail = [l for l in lines if l.startswith(("SB-J", "crashed", "page errors"))]
        run += 1; caught += bool(r.returncode)
        print(("CAUGHT" if r.returncode else "MISSED") + " · " + name + ("" if not fail else " · " + fail[0][:160]), flush=True)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
print(str(caught) + " of " + str(run) + " caught")
