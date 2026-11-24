# Page plants for Level 5 (the enterprise) on the page: each defect, put into the page, must make the drive fail.
# Run it in a throwaway copy of the checkout, never in the real one:   python3 tools/plants-enterprise-page.py [name ...]
# Each runs `ONLY=<only> JOB=<job> node tools/drive.mjs` (ONLY=enterprise, or campus-desk for the campus's done box); set E4_PIN and CHROME.
import subprocess, shutil, sys, os
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
PLANTS = [
 ("Level 5 open before the campus is finished", "enterprise", "lock", "js/desk/levels.js", "  if (n <= 1) return true;", "  if (n <= 1 || n === 5) return true;"),
 ("the enterprise's work orders left out of build mode", "enterprise", "lock", "js/build/app.js", "const ALL = JOBS.concat(OFFICE_JOBS, BUSINESS_JOBS, CAMPUS_JOBS, ENTERPRISE_JOBS);", "const ALL = JOBS.concat(OFFICE_JOBS, BUSINESS_JOBS, CAMPUS_JOBS);"),
 ("the campus's last work order still saying the enterprise is being built", "campus-desk", "", "js/build/app.js", 'LEVELS[Lv.n].later ? LEVELS[Lv.n].name + " is still being built."', 'true ? LEVELS[Lv.n].name + " is still being built."'),
 ("EN-J1: the limits without the gear's addresses", "enterprise", "EN-J1", "js/build/enterprise.js", '"The gear, and where to reach it by SSH from a desk PC: " + GEAR.map(function (id) { return (id === "edge" ? "the edge router" : id) + " " + gearAddr(p, id); }).join("; ") + ". Locked', '"The gear, and where to reach it by SSH from a desk PC: as in the records. Locked'),
 ("EN-J1: ss -ulpn leaving out rsyslog's UDP port", "enterprise", "EN-J1", "js/net/linux.js", 'if (rs && rs.state === "active" && rs.run && rs.run.udp) { row(', 'if (false) { row('),
 ("EN-J1: chronyc sources never locked (^*)", "enterprise", "EN-J1", "js/net/linux.js", '(ok ? (i === 0 ? "^* " : i === 2 ? "^+ " : "^- ")', '(ok ? (i === 0 ? "^+ " : i === 2 ? "^+ " : "^- ")'),
 ("EN-J1: sudo chronyc clients not authorised even with sudo", "enterprise", "EN-J1", "js/net/linux.js", 'if (!root) return ["501 Not authorised"];', 'if (true) return ["501 Not authorised"];'),
]
only = sys.argv[1:]
bad = 0
for name, lev, job, f, a, b in PLANTS:
    if only and not any(o in name for o in only): continue
    src = open(f).read(); assert src.count(a) == 1, (name, f, src.count(a))
    shutil.copy(f, f + ".plant-bak"); open(f, "w").write(src.replace(a, b))
    try:
        env = dict(os.environ, ONLY=lev); env.pop("JOB", None)
        if job: env["JOB"] = job
        r = subprocess.run(["node", "tools/drive.mjs"], env=env, capture_output=True, text=True, timeout=5400)
        out = r.stdout.strip().splitlines()
        fails = [l for l in out if l.startswith("enterprise") or l.startswith("levels")] or [l for l in out if "rror" in l]
        print(("CAUGHT" if r.returncode else "MISSED") + " · " + name + " · " + str(len(fails)) + " failing" + ("" if not fails else ": " + fails[0][:170]), flush=True)
        if not r.returncode: bad = 1
    finally:
        shutil.move(f + ".plant-bak", f)
sys.exit(bad)
