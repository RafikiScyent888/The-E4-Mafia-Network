import subprocess, shutil, sys, os, tempfile
# Level 3's page parts, planted one at a time in a throwaway copy of this checkout (the real one never holds a planted defect),
# each run through its work order's drive (SB-J3 unless the plant names another): every one must make it fail.
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
PLANTS = [
 ("the diagram gives the access point's address away", "js/desk/draw.js", 'if (x.kind === "bap") return "DHCP";', 'if (x.kind === "bap") return x.ifaces[0].lease ? x.ifaces[0].lease.ip : "DHCP";'),
 ("the access point's form saves nothing", "js/desk/window.js", 'const x = ctx.act({ t: "apnet", dev: P.dev, net: { ssid: t("ssid"), sec: t("sec"), psk: t("psk"), vlan: t("vlan").trim() } });', 'const x = { result: { ok: true, ssid: t("ssid") } };'),
 ("the form's error isn't shown", "js/desk/window.js", '(t("vlan").trim() ? ", tagged VLAN " + t("vlan").trim() : ", untagged") + "."; rerender(); }\n    else { msg.className = "msg err"; msg.textContent = "Not saved: " + ((x && x.result && x.result.errs) || []).join(". ") + "."; }\n  });\n  if (ctx.flash) { msg.className = "msg ok"; msg.textContent = ctx.flash; ctx.flash = null; }\n  box.appendChild(f);', '(t("vlan").trim() ? ", tagged VLAN " + t("vlan").trim() : ", untagged") + "."; rerender(); }\n    else { msg.className = "msg err"; msg.textContent = ""; }\n  });\n  if (ctx.flash) { msg.className = "msg ok"; msg.textContent = ctx.flash; ctx.flash = null; }\n  box.appendChild(f);'),
 ("the phone ignores the password typed", "js/desk/window.js", '{ t: "joinssid", dev: id, ssid: n.ssid, pass: pw.value }', '{ t: "joinssid", dev: id, ssid: n.ssid }'),
 ("the access point has no device button", "js/build/app.js", '"injector", "injector2", "ap", "camera",', '"injector", "injector2", "camera",'),
 ("the visitor's phone gets the house's page", "js/net/pages.js", 'if (x.kind === "phone" && key === "wifi" && sim.net.site === "business") {', 'if (x.kind === "phone" && key === "wifi" && false) {'),
 ("no web browser at the business", "js/net/pages.js", '(t[0] !== "browser" || sim.net.site === "business")', '(t[0] !== "browser" || sim.net.site === "office")'),
 ("the address bar opens nothing", "js/desk/window.js", 'browserAt[id] = String(new FormData(f).get("url") || "").trim(); rerender();', 'rerender();'),
 ("the ring's words never say broadcasting", "js/net/physical.js", ': ["on", "blue", "on, blue: on the network, broadcasting " + n', ': ["on", "blue", "blinking blue: on the network, but broadcasting nothing " + n'),
 ("SB-J4: port names and dots allowed on other cables' lines", "js/desk/draw.js", "&& !onDot(q) && !onDots(q[0], q[1], l.up) && (!strict || (!dotOnLine(q[0], q[1]) && !onLine({ x: b.x + 1, y: b.y + 1, width: b.width - 2, height: b.height - 2 }))); };", "&& !onDot(q); };", "SB-J4"),
 ("SB-J4: every port dot drawn twice, one on the other", "js/desk/draw.js", 'if (l.up) gp.appendChild(mk("circle", { cx: px, cy: py, r: 6, class: "pd pd-up", "data-cable": l.cable || "" }));', 'if (l.up) { gp.appendChild(mk("circle", { cx: px, cy: py, r: 6, class: "pd pd-up", "data-cable": l.cable || "" })); gp.appendChild(mk("circle", { cx: px + 5, cy: py, r: 6, class: "pd pd-up", "data-cable": l.cable || "" })); }', "SB-J4"),
 ("SB-J4: your laptop has no spot of its own in the back room", "js/net/business.js", ', alt: { back: { x: 270, y: 330, lab: "right", px: 925, py: 435 } } },', ' },', "SB-J4"),
 ("SB-J4: the back switch goes anywhere", "js/net/sim.js", "const fx = x.fixed || (this.net.fixed || FIXED_ROOM)[x.kind];", "const fx = x.id === \"bsw\" ? null : x.fixed || (this.net.fixed || FIXED_ROOM)[x.kind];", "SB-J4"),
 ("SB-J4: the console cable reaches the next room", "js/net/sim.js", "if (ca && this.net.rooms[a.dev] !== this.net.rooms[b.dev]) return", "if (false) return", "SB-J4"),
 ("SB-J4: the back switch has no device button", "js/build/app.js", '"pp", "msw", "bsw", "cab",', '"pp", "msw", "cab",', "SB-J4"),
 ("SB-J5: the camera's page saves nothing", "js/desk/window.js", 'const x = ctx.act({ t: "client", dev: P.dev, values: values });', 'const x = { result: { ok: true } };', "SB-J5"),
 ("SB-J5: the phone's Wi-Fi switch does nothing", "js/desk/window.js", 'const r = ctx.act({ t: "radio", dev: id, on: !P.radio.on });', 'const r = { result: { ok: true, on: !P.radio.on } };', "SB-J5"),
 ("SB-J5: the phone's browser never on mobile data", "js/net/pages.js", "if (sim.d[id].cell && !(sim.wifiLink(id) && sim.wifiLink(id).connected)) {", "if (false) {", "SB-J5"),
 ("SB-J5: a camera's settings changeable from outside", "js/desk/window.js", "  if (P.remote) {\n    box.appendChild(el(\"h3\"", "  if (false) {\n    box.appendChild(el(\"h3\"", "SB-J5"),
 ("SB-J5: the ceiling camera has no device button", "js/build/app.js", '"cinj1", "cam1", "cinj2",', '"cinj1", "cinj2",', "SB-J5"),
 ("SB-J5: the diagram not drawn taller for the cameras", "js/desk/draw.js", '(sim.net.site === "business" && sim.d.cam1 ? CAM_H : 546)', '(546)', "SB-J5"),
 ("SB-J5: the visitor's phone left where the camera's injector goes", "js/net/business.js", ', cams: { x: 735, y: 600 } },', ' },', "SB-J5"),
 ("SB-J5: plain http to a camera's secure page answered as if secure", "js/net/pages.js", '    if (+r.lport === 443 && scheme === "http") return fail("badreq"', '    if (false) return fail("badreq"', "SB-J5"),
 ("SB-J5: a powered camera off the network said to be on it", "js/net/physical.js", ': !net ? ["blinking", "blinking blue: it has power, but isn\'t on the network yet"', ': !net ? ["on", "on, blue: on the network"', "SB-J5"),
 ('SB-J6: the closet cabinet has no device button', 'js/build/app.js', '"msw", "bsw", "cab", ', '"msw", "bsw", ', 'SB-J6'),
 ('SB-J6: Lock it turns nothing', 'js/desk/window.js', 'b(K.locked ? "Unlock it" : "Lock it", { locked: !K.locked }', 'b(K.locked ? "Unlock it" : "Lock it", { locked: K.locked }', 'SB-J6'),
 ("SB-J6: the plan doesn't say the cabinet's state in words", 'js/desk/draw.js', 't.textContent = "CABINET: " + st;', 't.textContent = "CABINET";', 'SB-J6'),
 ("SB-J6: the router doesn't say it's in the cabinet", 'js/net/physical.js', '  if (cab) says.push("It\'s in the closet cabinet:', '  if (false) says.push("It\'s in the closet cabinet:', 'SB-J6'),
 ('SB-J6: a refused pull said as pulled', 'js/build/app.js', 'ctx.said = x && x.ok === false ? { k: "u", ok: false', 'ctx.said = false ? { k: "u", ok: false', 'SB-J6'),
 ("SB-J6: the cabinet's model drawn open whatever its door", 'js/net/physical.js', 'x.kind === "cabinet" ? (x.open ? "cabinetOpen" : "cabinet") :', 'x.kind === "cabinet" ? "cabinetOpen" :', 'SB-J6'),
 ('SB-J7: the diagram labels the router by its public address', 'js/desk/draw.js', '.filter(function (k) { return !(x.sw.links[k] && x.sw.links[k].far === "modem"); })', '', 'SB-J7'),
 ("SB-J7: the provider's letter spells the mask out", 'js/build/business.js', 'from today the line has the fixed address " + F.ip + "/" + F.len + ".', 'from today the line has the fixed address " + F.ip + "/" + F.len + " (" + F.mask + ").', 'SB-J7'),
 ("SB-J7: the provider's letter leaves out the gateway", 'js/build/business.js', ' The provider\'s gateway for it is " + F.gw + ".",', '",', 'SB-J7'),
 ("SB-J8: the printer's control panel saves no gateway", 'js/desk/window.js', 'mask: String(d.get("mask")).trim(), gw: String(d.get("gw")).trim() };\n    const x = ctx.act({ t: "client", dev: "printer", values: values });', 'mask: String(d.get("mask")).trim(), gw: "" };\n    const x = ctx.act({ t: "client", dev: "printer", values: values });', 'SB-J8'),
 ("SB-J8: the Printers tab's port form saves nothing", 'js/desk/window.js', 'const r = ctx.act({ t: "pcprinter", ip: new FormData(f).get("port") });', 'const r = { result: { ok: true } };', 'SB-J8'),
 ('SB-J8: show access-lists numbers the lines by position', 'js/net/rtcli.js', 'L.push("    " + q[i] + " " + aceText(A.type, e)', 'L.push("    " + (10 * (i + 1)) + " " + aceText(A.type, e)', 'SB-J8'),
 ('SB-J8: the diagram labels the printer with its old address', 'js/desk/draw.js', 'if (id === "printer") return x.ifaces[0].cfg.mode === "static" ? x.ifaces[0].cfg.ip : "DHCP";', 'if (id === "printer") return x.sub;', 'SB-J8'),
 ("SB-J8: the limits leave out the printer's new address", 'js/build/business.js', 'Its fixed address on the printers\' network is " + p.printerIp + " (mask', "Its fixed address on the printers' network is in the records (mask", 'SB-J8'),
 ("SB-J9: your laptop's Network settings form saves nothing", 'js/desk/window.js', 'const x = ctx.act({ t: "client", dev: id, values: values });\n    if (x && x.result && x.result.ok) { ctx.flash = "Saved. Windows applied the new IP settings."; rerender(); }', 'const x = { result: { ok: true } };\n    if (x && x.result && x.result.ok) { ctx.flash = "Saved. Windows applied the new IP settings."; rerender(); }', 'SB-J9'),
 ('SB-J9: the TFTP server tab lists no files', 'js/net/pages.js', 'files: s.files.map(function (f) { return { name: f.name, bytes: f.bytes, from: f.from, text: f.text }; }), log: s.log.slice(-8),', 'files: [], log: s.log.slice(-8),', 'SB-J9'),
 ("SB-J9: the limits leave out the backup's name", 'js/build/business.js', '"Your backup of the router is on your laptop\'s TFTP server: " + p.backup.name + ", taken', '"Your backup of the router is on your laptop\'s TFTP server, taken', 'SB-J9'),
 ("SB-J10: the new room never drawn on the floor plan", 'js/desk/draw.js', '(sim && sim.net.roomNames.dept ? r("dept") + \'<path class="door" d="M900 520h40"/>\' : "");', '"";', 'SB-J10'),
 ("SB-J10: the department's PCs left off the diagram", 'js/desk/draw.js', '"cinj1", "cam1", "cinj2", "cam2", "dpc1", "dpc2"].filter(', '"cinj1", "cam1", "cinj2", "cam2"].filter(', 'SB-J10'),
 ("SB-J10: the department's PCs have no device buttons", 'js/build/app.js', '"bpc", "dpc1", "dpc2", "hire",', '"bpc", "hire",', 'SB-J10'),
 ("SB-J10: the limits give the block's mask away", 'js/build/business.js', 'on the block " + D.net + "/" + D.len + ". Its gateway', 'on the block " + D.net + "/" + D.len + " (mask " + D.mask + "). Its gateway', 'SB-J10'),
 ("SB-J10: the department's first PC straight above the second again", 'js/net/business.js', 'dpc1: { x: -90, y: 105, px: 910, py: 580, room: "dept" },', 'dpc1: { x: -90, y: 105, px: 860, py: 610, room: "dept" },', 'SB-J10'),
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
