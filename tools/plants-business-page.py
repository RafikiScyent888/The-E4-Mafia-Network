import subprocess, shutil, sys, os, tempfile
# Level 3's page parts, planted one at a time in a throwaway copy of this checkout (the real one never holds a planted defect),
# each run through its work order's drive (SB-J3 unless the plant names another): every one must make it fail.
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
PLANTS = [
 ("the diagram gives the access point's address away", "js/desk/draw.js", 'if (x.kind === "bap") return "DHCP";', 'if (x.kind === "bap") return x.ifaces[0].lease ? x.ifaces[0].lease.ip : "DHCP";'),
 ("the access point's form saves nothing", "js/desk/window.js", 'const x = ctx.act({ t: "apnet", dev: P.dev, net: { ssid: t("ssid"), sec: t("sec"), psk: t("psk"), vlan: t("vlan").trim() } });', 'const x = { result: { ok: true, ssid: t("ssid") } };'),
 ("the form's error isn't shown", "js/desk/window.js", 'else { msg.className = "msg err"; msg.textContent = "Not saved: " + ((x && x.result && x.result.errs) || []).join(". ") + "."; }\n  });\n  if (ctx.flash) { msg.className = "msg ok"; msg.textContent = ctx.flash; ctx.flash = null; }\n  box.appendChild(f);', 'else { msg.className = "msg err"; msg.textContent = ""; }\n  });\n  if (ctx.flash) { msg.className = "msg ok"; msg.textContent = ctx.flash; ctx.flash = null; }\n  box.appendChild(f);'),
 ("the phone ignores the password typed", "js/desk/window.js", '{ t: "joinssid", dev: id, ssid: n.ssid, pass: pw.value }', '{ t: "joinssid", dev: id, ssid: n.ssid }'),
 ("the access point has no device button", "js/build/app.js", '"injector", "injector2", "ap", "camera",', '"injector", "injector2", "camera",'),
 ("the visitor's phone gets the house's page", "js/net/pages.js", 'if (x.kind === "phone" && key === "wifi" && sim.net.site === "business") {', 'if (x.kind === "phone" && key === "wifi" && false) {'),
 ("no web browser at the business", "js/net/pages.js", '(t[0] !== "browser" || sim.net.site === "business")', '(t[0] !== "browser" || sim.net.site === "office")'),
 ("the address bar opens nothing", "js/desk/window.js", 'browserAt[id] = String(new FormData(f).get("url") || "").trim(); rerender();', 'rerender();'),
 ("the ring's words never say broadcasting", "js/net/physical.js", ': ["on", "blue", "on, blue: on the network, broadcasting " + n', ': ["on", "blue", "blinking blue: on the network, but broadcasting nothing " + n'),
 ("SB-J4: port names and dots allowed on other cables' lines", "js/desk/draw.js", "&& !onDot(q) && !onDots(q[0], q[1], l.up) && (!strict || (!dotOnLine(q[0], q[1]) && !onLine({ x: b.x + 1, y: b.y + 1, width: b.width - 2, height: b.height - 2 }))); };", "&& !onDot(q); };", "SB-J4"),
 ("SB-J4: every port dot drawn twice, one on the other", "js/desk/draw.js", 'if (l.up) gp.appendChild(mk("circle", { cx: px, cy: py, r: 6, class: "pd pd-up", "data-cable": l.cable || "" }));', 'if (l.up) { gp.appendChild(mk("circle", { cx: px, cy: py, r: 6, class: "pd pd-up", "data-cable": l.cable || "" })); gp.appendChild(mk("circle", { cx: px + 5, cy: py, r: 6, class: "pd pd-up", "data-cable": l.cable || "" })); }', "SB-J4"),
 ("SB-J4: your laptop has no spot of its own in the back room", "js/net/business.js", ', alt: { back: { x: 270, y: 330, lab: "right" } } },', ' },', "SB-J4"),
 ("SB-J4: the back switch goes anywhere", "js/net/sim.js", "const fx = x.fixed || (this.net.fixed || FIXED_ROOM)[x.kind];", "const fx = x.id === \"bsw\" ? null : x.fixed || (this.net.fixed || FIXED_ROOM)[x.kind];", "SB-J4"),
 ("SB-J4: the console cable reaches the next room", "js/net/sim.js", "if (ca && this.net.rooms[a.dev] !== this.net.rooms[b.dev]) return", "if (false) return", "SB-J4"),
 ("SB-J4: the back switch has no device button", "js/build/app.js", '"pp", "msw", "bsw", "pc",', '"pp", "msw", "pc",', "SB-J4"),
]
only = sys.argv[1:]
caught = 0; run = 0
for plant in PLANTS:
    name, f, a, b = plant[:4]; job = plant[4] if len(plant) > 4 else "SB-J3"
    if only and not any(o in name for o in only): continue
    tmp = tempfile.mkdtemp(prefix="sb3page-")
    try:
        shutil.copytree(ROOT, tmp, dirs_exist_ok=True, ignore=shutil.ignore_patterns(".git", "node_modules", "wip-out"))
        p = os.path.join(tmp, f); src = open(p).read()
        if src.count(a) != 1: print("PLANT DID NOT APPLY · " + name + " · " + str(src.count(a))); continue
        open(p, "w").write(src.replace(a, b))
        r = subprocess.run(["node", "tools/drive.mjs"], cwd=tmp, env=dict(os.environ, ONLY="business", JOB=job), capture_output=True, text=True, timeout=1500)
        out = r.stdout.strip().splitlines()
        fails = [l for l in out if l.startswith("business") or l.startswith("PAGE ERRORS")]
        run += 1; caught += bool(r.returncode)
        print(("CAUGHT" if r.returncode else "MISSED") + " · " + name + " · " + str(len(fails)) + " failing" + ("" if not fails else ": " + fails[0][:160]))
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
print(str(caught) + " of " + str(run) + " caught")
