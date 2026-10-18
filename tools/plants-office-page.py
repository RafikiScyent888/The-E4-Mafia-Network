import subprocess, shutil, sys, os
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))   # this checkout, wherever it is
PLANTS = [
 ("levels always open", "js/desk/levels.js", "  if (n <= 1) return true;\n", "  return true;\n"),
 ("lock icon dropped", "js/desk/levelsui.js", '!open ? [lock(), "Locked:', '!open ? ["Locked:'),
 ("locked level drawn solid", "css/e4.css", ".levels .locked button { background: #eef0f5; border-style: dashed; }", ".levels .locked button { background: #eef0f5; }"),
 ("password box not hidden", "js/desk/window.js", 'input.type = s ? "password" : "text";', 'input.type = "text";'),
 ("password echoed", "js/desk/window.js", '(hide ? "" : v) + "\\n";', 'v + "\\n";'),
 ("empty line not sent to the switch", "js/desk/window.js", "if (v.trim() || sw) {", "if (v.trim()) {"),
 ("locked job opens anyway", "js/build/app.js", "  if (!isOpen(levelOfJob(def.id).n)) def = JOBS[0];", ""),
 ("undo skips switch lines", "js/build/engine.js", "&& !J.net[i].cli) i--;", ") i--;"),
 ("console drawn as patch cable", "js/desk/draw.js", 'r.c.kind === "console" ? "run-con" : r.c.kind === "fibre" ? "run-fib" : "run"', 'r.c.kind === "fibre" ? "run-fib" : "run"'),
 ("? needs Enter", "js/desk/window.js", '} else if (e.key === "?" && S) {', '} else if (e.key === "?" && false) {'),
 ("the level never said finished", "js/build/app.js", 'el("b", null, "Level " + Lv.n + " finished. ")', 'el("b", null, "Done. ")'),
 ("late collisions never climb", "js/net/swcli.js", "const t = (l.tick || 0) + 1;", "const t = 1;"),
 ("a duplex mismatch shows no errors", "js/net/swcli.js", "const d = duplexEnds(p, l); if (!d.mismatch) return null;", "return null;"),
 ("interface range stops at the copper ports", "js/net/swcli.js", "if (a < 1 || b > COPPER + SFP || a > b) return null;", "if (a < 1 || b > COPPER || a > b) return null;"),
 ("IPAM row never marked bad", "js/desk/ipamui.js", 'r.ok ? " goodrow" : " badrow";', 'r.ok ? " goodrow" : "";'),
 ("saving the sheet can't be undone", "js/build/engine.js", "pull: 1, ipam: 1, tftp: 1,", "pull: 1, tftp: 1,"),
 ("the sheet gives the right mask", "js/net/ipam.js", 'if (usable < (+r.hosts || 0)) bad("mask", "Mask: a /" + x.p + " has " + usable + " usable addresses; " + (r.name || "this block") + " needs " + r.hosts + ".");', 'if (usable < (+r.hosts || 0)) { let q = x.p; while (Math.pow(2, 32 - q) - 2 < (+r.hosts || 0)) q--; bad("mask", "Mask: use /" + q + "."); }'),
 ("no banner as the console wakes", "js/net/swcli.js", 'function wake(S) { return motd(S.sw).concat(', 'function wake(S) { return [].concat('),
 ("the switch offers no name of its own for the backup", "js/net/swcli.js", 'file: u && u[2] ? u[2] : S.sw.hostname.toLowerCase() + "-confg" };', 'file: u && u[2] ? u[2] : "switch-confg" };'),
 ("an opened port brings no address", "js/net/cmd.js", "  sim.relink(before);   /* a switch port", "  /* a switch port"),
 ("the laptop's Command Prompt goes to its serial terminal", "js/desk/window.js", 'W = win ? { win: true } : {};', 'W = {};'),
 ("the file reader shows nothing", "js/desk/window.js", "const pre = el(\"pre\"); pre.textContent = f.text;", "const pre = el(\"pre\"); pre.textContent = \"\";"),
 ("the TFTP tab doesn't say the laptop's address", "js/desk/window.js", ': P.addr ? P.addr + ", UDP port 69 (Ethernet)"', ': P.addr ? "Ethernet"'),
 ("a copy of the running configuration accepted", "js/build/office.js", "const off = !!f && f.text !== st,", "const off = false,"),
 ("the laptop's Physical tab never empties", "js/net/physical.js", 'if (model === "techlaptop") { if (ports[0].plug === "none") says.push("ETHERNET: empty.");', 'if (model === "techlaptop") {'),
 ("instructor lock doesn't relock levels", "js/desk/instructor.js", 'draw(); if (api.levels) api.levels(); } }, "Lock the instructor tools")', 'draw(); } }, "Lock the instructor tools")'),
 ("SO-J6: the replacement never shows in the box tray", "js/build/app.js", "  const boxed = devices(sim).filter(function (id) { return sim.d[id].boxed; });", "  const boxed = [];"),
 ("SO-J6: copy tftp: isn't on the switch", "js/net/swcli.js", '    ["tftp:", "Copy from tftp: file system", [["running-config"', '    ["tftpx:", "Copy from tftp: file system", [["running-config"'),
 ("SO-J6: ssh-keygen isn't on the PC", "js/net/cmd.js", '    case "ssh-keygen": return sshKeygen(sim, id, args);', ""),
 ("SO-J6: the warning's fingerprint isn't the switch's own", "js/net/cmd.js", '"The fingerprint for the RSA key sent by the remote host is", fp + ".",', '"The fingerprint for the RSA key sent by the remote host is", "SHA256:" + "Q".repeat(43) + ".",'),
 ("SO-J7: the new hire's PC has no device button", "js/build/app.js", '"pc", "hire", "printer",', '"pc", "printer",'),
 ("SO-J7: an opened port brings the new desk no address", "js/net/cmd.js", "  sim.relink(before);   /* a switch port", "  /* a switch port"),
 ("SO-J8: the wall jack has no device button", "js/build/app.js", '"mpc", "ojack", "mjack",', '"mpc", "mjack",'),
 ("SO-J8: the runs table says nothing of the link", "js/build/app.js", ': up ? "Link, " + (sp === 1000 ? "1 Gb/s" : sp + " Mb/s") : "No link";', ': "Link";'),
 ("SO-J9: the runs table says which back port each run is on", "js/build/app.js", 'if (sim.d[e.dev] && sim.d[e.dev].kind === "patchpanel" && /R$/.test(e.port)) return sim.d[e.dev].label + ", a run punched down at the back";', ''),
 ("SO-J9: no cable map on the build page", "js/build/app.js", "  if (J.def.cablemap) mapForm(host, J, sim);", ""),
 ("SO-J9: the probe can't be used in build mode", "js/build/engine.js", "tone: 1, probe: 1, repatch: 1, polarity: 1 };", "tone: 1, repatch: 1, polarity: 1 };"),
 ("SO-J10: an empty slot offers no module", "js/net/pages.js", "return x.sfp[k] || sim.net.extra.build; })", "return x.sfp[k]; })"),
 ("SO-J10: the back office switch has no device button", "js/build/app.js", '"msw", "bsw", "pc",', '"msw", "pc",'),
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
