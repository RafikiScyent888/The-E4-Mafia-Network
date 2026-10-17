import subprocess, shutil, sys, os
os.chdir("/home/user/the-e4-mafia-network")
PLANTS = [
 ("levels always open", "js/desk/levels.js", "  if (n <= 1) return true;\n", "  return true;\n"),
 ("lock icon dropped", "js/desk/levelsui.js", '!open ? [lock(), "Locked:', '!open ? ["Locked:'),
 ("locked level drawn solid", "css/e4.css", ".levels .locked button { background: #eef0f5; border-style: dashed; }", ".levels .locked button { background: #eef0f5; }"),
 ("password box not hidden", "js/desk/window.js", 'input.type = s ? "password" : "text";', 'input.type = "text";'),
 ("password echoed", "js/desk/window.js", '(hide ? "" : v) + "\\n";', 'v + "\\n";'),
 ("empty line not sent to the switch", "js/desk/window.js", "if (v.trim() || sw) {", "if (v.trim()) {"),
 ("locked job opens anyway", "js/build/app.js", "  if (!isOpen(levelOfJob(def.id).n)) def = JOBS[0];", ""),
 ("undo skips switch lines", "js/build/engine.js", "&& !J.net[i].cli) i--;", ") i--;"),
 ("console drawn as patch cable", "js/desk/draw.js", 'r.c.kind === "console" ? "run-con" : "run"', '"run"'),
 ("? needs Enter", "js/desk/window.js", '} else if (e.key === "?" && S) {', '} else if (e.key === "?" && false) {'),
 ("level finished before it is all built", "js/desk/levels.js", "return !L.later && built(L) && c.tickets", "return !L.later && c.tickets"),
 ("no word that more is coming", "js/build/app.js", '"That\'s everything on " + Lv.the + " so far. "', '"Done. "'),
 ("late collisions never climb", "js/net/swcli.js", "const t = (l.tick || 0) + 1;", "const t = 1;"),
 ("a duplex mismatch shows no errors", "js/net/swcli.js", "const d = duplexEnds(p, l); if (!d.mismatch) return null;", "return null;"),
 ("interface range stops at the copper ports", "js/net/swcli.js", "if (a < 1 || b > COPPER + SFP || a > b) return null;", "if (a < 1 || b > COPPER || a > b) return null;"),
 ("instructor lock doesn't relock levels", "js/desk/instructor.js", 'draw(); if (api.levels) api.levels(); } }, "Lock the instructor tools")', 'draw(); } }, "Lock the instructor tools")'),
]
only = sys.argv[1:] 
for name, f, a, b in PLANTS:
    if only and not any(o in name for o in only): continue
    src = open(f).read()
    assert src.count(a) == 1, (name, src.count(a))
    shutil.copy(f, "/tmp/plant.bak")
    open(f, "w").write(src.replace(a, b))
    try:
        r = subprocess.run(["node", "tools/drive.mjs"], env=dict(os.environ, ONLY="office"), capture_output=True, text=True, timeout=900)
        out = r.stdout.strip().splitlines()
        fails = [l for l in out if l.startswith(("office", "levels"))]
        print(("CAUGHT" if r.returncode else "MISSED") + " · " + name + " · " + str(len(fails)) + " failing" + ("" if not fails else ": " + fails[0][:150]))
    finally:
        shutil.copy("/tmp/plant.bak", f)
