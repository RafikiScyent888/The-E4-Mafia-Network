# Page plants for Level 4 (the campus) on the page: each defect, put into the page, must make the campus drive fail.
# Run it in a throwaway copy of the checkout, never in the real one:   python3 tools/plants-campus-page.py [name ...]
# Each runs `ONLY=campus JOB=<job> node tools/drive.mjs` (CP-J1 by default; the Physical tabs are checked under CP-J2).
import subprocess, shutil, sys, os
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
PLANTS = [
 ("Level 4 open before the small business is finished", "lock", "js/desk/levels.js", "  if (n <= 1) return true;", "  if (n <= 1 || n === 4) return true;"),
 ("the campus's devices without buttons", "CP-J1", "js/build/app.js", '"mphone", "edge", "core1", "core2", "dist1", "dist2", "acc1", "acc2", "acc3", "acc4", "sd1", "hd1", "pr1", "bn1", "bn2", "fin", "pr3", "tr1", "tr2", "anxc", "anxa", "cl1", "cl2", "fsrv", "bksrv", "tech"];', '"mphone", "tech"];'),
 ("the 1F access switch back across the data room (its runs under other devices)", "CP-J1", "js/net/campus.js", 'acc1: { x: 100, y: 410, lab: "right", px: 460, py: 280, room: "data" },', 'acc1: { x: 100, y: 410, lab: "right", px: 120, py: 280, room: "data" },'),
 ("the provider beside the modem again (CABLE IN on a tile)", "CP-J1", "js/net/campus.js", "isp: { x: 10, y: 40 },", "isp: { x: 90, y: 40 },"),
 ("the logical diagram's foot cut short", "CP-J1", "js/desk/draw.js", '(annexOn(sim) ? 1210 : 820)', '(annexOn(sim) ? 1210 : 700)'),
 ("the campus's work orders left out of build mode", "CP-J1", "js/build/app.js", "const ALL = JOBS.concat(OFFICE_JOBS, BUSINESS_JOBS, CAMPUS_JOBS);", "const ALL = JOBS.concat(OFFICE_JOBS, BUSINESS_JOBS);"),
 ("the MSW-3900X's borrowed model passed off as its own", "CP-J2", "js/net/physical.js", '  if (model === "msw" && x.sw && x.sw.os === "l3switch") says.unshift(', '  if (false) says.unshift('),
 ("a campus desk PC without its Physical tab", "CP-J2", "js/net/physical.js", 'bpc: "pc", sd1: "pc", hd1: "pc",', 'bpc: "pc", hd1: "pc",'),
 ("the training PCs without buttons (CP-J7)", "CP-J7", "js/build/app.js", '"pr3", "tr1", "tr2", "anxc"', '"pr3", "anxc"'),
 ("the 4F switch on the 4F closet's name on the floor plan (run with PLANJOB=CP-J7)", "plans", "js/net/campus.js", 'acc4: { x: 860, y: 470, lab: "right", px: 115, py: 855, room: "c4" }', 'acc4: { x: 860, y: 470, lab: "right", px: 115, py: 790, room: "c4" }'),
 ("the 4F switch on the 3F switch's spot on the logical diagram (run with PLANJOB=CP-J7)", "plans", "js/net/campus.js", 'acc4: { x: 860, y: 470, lab: "right", px: 115, py: 855, room: "c4" }', 'acc4: { x: 640, y: 420, lab: "right", px: 115, py: 855, room: "c4" }'),
 ("the Annex's block left off the logical diagram, the fibre one line across the campus (CP-J8)", 'CP-J8', 'js/desk/draw.js', '  if (annexOn(sim)) {\n    const inAnx', '  if (false) {\n    const inAnx'),
 ('the classroom PCs without buttons (CP-J8)', 'CP-J8', 'js/build/app.js', '"anxc", "anxa", "cl1", "cl2", "fsrv", "bksrv", "tech"];', '"anxc", "anxa", "fsrv", "bksrv", "tech"];'),
 ("the Annex's band left off the floor plan (CP-J8)", 'CP-J8', 'js/desk/draw.js', '.concat(annexOn(sim) ? ["acomms", "class"] : [])', '.concat([])'),
 ("the duct's fibre routed across the floors (CP-J8)", 'CP-J8', 'js/desk/draw.js', '    if (!paths && campus(sim) && c.kind === "fibre" && (sim.net.rooms[c.a.dev] === "acomms")', '    if (false && !paths && campus(sim) && c.kind === "fibre" && (sim.net.rooms[c.a.dev] === "acomms")'),
 ("the Annex switches' addresses left off the diagram (CP-J8)", 'CP-J8', 'js/desk/draw.js', ' || (A && /^anx/.test(id) && x.sw.svis[A.mgmt.id])', ''),
 ("the duct's fibre laid along the data room's wall (CP-J8: the floor plan's wall rule)", "CP-J8", "js/desk/draw.js", " L 375 250 L 375 330 L 215 330 L 215 975 ", " L 375 250 L 375 343 L 215 343 L 215 975 "),
 ("the servers without buttons (CP-J9)", "CP-J9", "js/build/app.js", '"cl1", "cl2", "fsrv", "bksrv", "tech"];', '"cl1", "cl2", "tech"];'),
 ("a rack server without its Console tab (CP-J9)", "CP-J9", "js/net/pages.js", '    server: [["cmd", "Console"]]', '    server: []'),
 ("the servers left off the logical diagram (CP-J9)", "CP-J9", "js/desk/draw.js", '"cl1", "cl2", "fsrv", "bksrv"] : [])', '"cl1", "cl2"] : [])'),
 ("the rack server's Physical tab silent about its model waiting for photographs (CP-J9)", "CP-J9", "js/desk/window.js", '  else if (P.noModel) wrap.appendChild(el("p", { class: "note" }, P.noModel));', ''),
 ("the 2F closet not drawn wider for the backup server (run with PLANJOB=CP-J9)", "plans", "js/desk/draw.js", ', c2: [30, 365, 490, 545], bench: [490, 365, 980, 545] }); return B; };', ' }); return B; };'),
 ("the data room not drawn wider for the file server (run with PLANJOB=CP-J9)", "plans", "js/desk/draw.js", '{ data: [30, 30, 660, 345], svc: [660, 30, 980, 345], c2:', '{ c2:'),
 ("the desks not stepping aside for the servers (run with PLANJOB=CP-J9)", "plans", "js/desk/draw.js", '  if (campus(sim) && L.srv && srvIn(sim, "fsrv")) Object.assign(L, L.srv);', ''),
 ("the bars' height measured only at load (a long title wrapped, the columns under it run off the screen)", "CP-J4", "js/build/app.js", 'if (window.ResizeObserver) new ResizeObserver(chromeH).observe(document.querySelector(".chrome"));', ''),
]
only = sys.argv[1:]
bad = 0
for name, job, f, a, b in PLANTS:
    if only and not any(o in name for o in only): continue
    src = open(f).read(); assert src.count(a) == 1, (name, f, src.count(a))
    shutil.copy(f, f + ".plant-bak"); open(f, "w").write(src.replace(a, b))
    try:
        r = subprocess.run(["node", "tools/drive.mjs"], env=dict(os.environ, ONLY="campus", JOB=job), capture_output=True, text=True, timeout=3000)
        out = r.stdout.strip().splitlines()
        fails = [l for l in out if l.startswith("campus")] or [l for l in out if "rror" in l]
        print(("CAUGHT" if r.returncode else "MISSED") + " · " + name + " · " + str(len(fails)) + " failing" + ("" if not fails else ": " + fails[0][:170]), flush=True)
        if not r.returncode: bad = 1
    finally:
        shutil.move(f + ".plant-bak", f)
sys.exit(bad)
