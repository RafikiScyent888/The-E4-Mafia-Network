import subprocess, shutil, sys, os, tempfile
# SB-J3's page parts, planted one at a time in a throwaway copy of this checkout (the real one never holds a planted defect),
# each run through the SB-J3 drive: every one must make it fail.
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
]
only = sys.argv[1:]
caught = 0; run = 0
for name, f, a, b in PLANTS:
    if only and not any(o in name for o in only): continue
    tmp = tempfile.mkdtemp(prefix="sb3page-")
    try:
        shutil.copytree(ROOT, tmp, dirs_exist_ok=True, ignore=shutil.ignore_patterns(".git", "node_modules", "wip-out"))
        p = os.path.join(tmp, f); src = open(p).read()
        if src.count(a) != 1: print("PLANT DID NOT APPLY · " + name + " · " + str(src.count(a))); continue
        open(p, "w").write(src.replace(a, b))
        r = subprocess.run(["node", "tools/drive.mjs"], cwd=tmp, env=dict(os.environ, ONLY="business", JOB="SB-J3"), capture_output=True, text=True, timeout=1500)
        out = r.stdout.strip().splitlines()
        fails = [l for l in out if l.startswith("business") or l.startswith("PAGE ERRORS")]
        run += 1; caught += bool(r.returncode)
        print(("CAUGHT" if r.returncode else "MISSED") + " · " + name + " · " + str(len(fails)) + " failing" + ("" if not fails else ": " + fails[0][:160]))
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
print(str(caught) + " of " + str(run) + " caught")
