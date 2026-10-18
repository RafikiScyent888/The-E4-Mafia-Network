import subprocess, shutil, os, sys
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))   # this checkout, wherever it is
PLANTS = [
 ("changes after saving not seen", "js/build/office.js", 'C("since", !!sw.startup && unsaved(sw),', 'C("since", false,'),
 ("enable password taken for a secret", "js/build/office.js", 'C("plain", !sw.enableSecret && !!sw.enablePassword,', 'C("plain", false,'),
 ("console password never asked for, accepted", "js/build/office.js", 'C("nologin", !!con.password && !con.login,', 'C("nologin", false,'),
 ("Telnet left on, accepted", "js/build/office.js", 'C("telnet", /^(telnet|all)$/.test(vty.transport),', 'C("telnet", false,'),
 ("router left on the old switch, accepted", "js/build/office.js", 'C("router", !onMsw(sim, "router"),', 'C("router", false,'),
 ("no gateway, accepted", "js/build/office.js", 'C("none", !sw.gateway,', 'C("none", false,'),
 ("console works with the switch off", "js/net/sim.js", 'return c.a.seated && c.b.seated && this.on(c.a.dev) && this.on(c.b.dev);', 'return c.a.seated && c.b.seated;'),
 ("SSH without keys", "js/net/cmd.js", 'if (!x.sw.rsa || !/^(ssh|all)$/.test(v.transport))', 'if (!/^(ssh|all)$/.test(v.transport))'),
 ("the console cable on the network", "js/net/sim.js", 'if (c.kind === "coax" || c.kind === "console" || !this.cableUp(c)) continue;', 'if (c.kind === "coax" || !this.cableUp(c)) continue;'),
 ("undo skips switch lines", "js/build/engine.js", "&& !J.net[i].cli) i--;", ") i--;"),
 ("a port left on auto facing the printer, accepted", "js/build/office.js", 'C("auto", up && d.mismatch && p.duplex === "auto",', 'C("auto", false,'),
 ("the fibre slots left live, accepted", "js/build/office.js", "const sfp = PORT_NAMES.find(function (n) { return !used[n] && sw.ports[n].sfp && !sw.ports[n].shutdown; });", "const sfp = null;"),
 ("a block bigger than it needs, accepted", "js/build/office.js", 'C("big", !!big,', 'C("big", false,'),
 ("overlapping blocks, accepted", "js/build/office.js", 'C("overlap", !!lap,', 'C("overlap", false,'),
 ("a gateway that isn't the first usable, accepted", "js/build/office.js", 'C("first", !!notFirst,', 'C("first", false,'),
 ("the TFTP server takes files when stopped", "js/net/cmd.js", "if (!srv || !srv.on) return { err: \"Timed out\" };", "if (!srv) return { err: \"Timed out\" };"),
 ("a banner cut short, accepted", "js/build/office.js", 'C("part", !!have && have !== want && want.indexOf(have) >= 0,', 'C("part", false,'),
 ("the backup under any name, accepted", "js/build/office.js", "return files(sim).find(function (f) { return f.name.toLowerCase() === n; }) || null; };", "return files(sim)[0] || null; };"),
 ("a copy of the running configuration with changes not saved, accepted", "js/build/office.js", "const off = !!f && f.text !== st,", "const off = false,"),
 ("the laptop left plugged in, accepted", "js/build/office.js", 'C("plugged", !!lap,', 'C("plugged", false,'),
 ("the server or the network blamed after files landed", "js/build/office.js", 'C("net", !f && !any && !lapOnNet(sim),', 'C("net", !f && !lapOnNet(sim),'),
 ("the laptop's two terminals share one login", "js/net/cmd.js", 'const keyOf = function (id, win) { return win ? id + "/win" : id; };', 'const keyOf = function (id, win) { return id; };'),
 ("no banner after an SSH login", "js/net/cmd.js", 'const m = st.via === "ssh" ? SW.motd(sw.sw) : [];', 'const m = [];'),
 ("SO-01: a fix that isn't saved counts as fixed", "js/tickets/office.js", "return !sim.mismatched(\"printer\") && !!l && !!sp && !sp.shutdown && !SW.duplexEnds(sp, l).mismatch && printOk(sim);", "return !sim.mismatched(\"printer\") && printOk(sim);"),
 ("SO-02: the spare ports opened again, accepted", "js/tickets/office.js", "&& spareLive(sw).length === 0 && spareLive(Object.assign({}, sw, { ports: sw.startup.ports })).length === 0;", ";"),
 ("SO-05: Telnet left on, accepted", "js/tickets/office.js", 'c.vty.transport === "ssh" &&', '/^(ssh|all)$/.test(c.vty.transport) &&'),
 ("a duplex mismatch loses nothing", "js/net/sim.js", "return this.mismatched(id) ? { loss: 0.3, base: 1 } : { loss: 0, base: 0 };", "return { loss: 0, base: 0 };"),
 ("show version never says it came back from a power cut", "js/net/swcli.js", '"System returned to ROM by " + (sw.restart || "power-on"), "",', ''),
 ("SO-02: any ping from the PC proves it, even to itself", "js/tickets/office.js", 'proves(f) { return f.cmd === "ping" && f.dev === "pc" && f.beyond; },', 'proves(f) { return f.cmd === "ping" && f.dev === "pc" && f.ok; },'),
 ("TX facing TX links anyway", "js/net/sim.js", "    if (auto(c.a) || auto(c.b)) return true;\n    const mdix", "    return true;\n    const mdix"),
 ("a crossover cable crosses nothing", "js/net/sim.js", 'return (mdix(c.a) !== mdix(c.b)) === (c.wiring !== "crossover");', "return mdix(c.a) !== mdix(c.b);"),
 ("no mdix auto never shown in the running configuration", "js/net/swcli.js", ' if (p.mdix === false) L.push(" no mdix auto");', ""),
 ("SO-04: auto-MDIX on but not saved counts as fixed", "js/tickets/office.js", '(c.wiring === "crossover" || (!!sp && sp.mdix !== false && !sp.shutdown))', "true"),
 ("SO-06: any mask accepted, the records' or not", "js/tickets/office.js", "ok = function (c) { return c.vlan1.ip === p.ip && c.vlan1.mask === p.mask && !c.vlan1.shutdown; };", "ok = function (c) { return c.vlan1.ip === p.ip && !c.vlan1.shutdown; };"),
 ("SO-06: the address put back but not saved counts as fixed", "js/tickets/office.js", 'const sw = SW_(sim), st = sw.startup, p = v.plan, r = sim.route("pc", p.ip), ok = function (c) { return c.vlan1', 'const sw = SW_(sim), st = sw, p = v.plan, r = sim.route("pc", p.ip), ok = function (c) { return c.vlan1'),
 ("a device whose mask leaves the sender off its network still replies", "js/net/sim.js", "    if (sameSubnet(b.ip, to, b.mask)) return true;\n    return !!(b.gw", "    return true;\n    return !!(b.gw"),
 ("a speed forced above what the far end can run still links", "js/net/sim.js", 'if (p.speed !== "auto" && +p.speed > top) return false;', ""),
 ("the switch calls a port forced above the far end's speed connected", "js/net/swcli.js", 'if (p.speed !== "auto" && l.max && +p.speed > l.max) return true; ', ""),
 ("SO-07: speed and duplex both fixed (a mismatch) accepted", "js/tickets/office.js", 'return online(sim, "pc") && !sim.mismatched("pc") && !!sp && !!l && !sp.shutdown && (sp.speed === "auto" || +sp.speed <= 100) && !SW.duplexEnds(sp, l).mismatch;', 'return online(sim, "pc") && !!sp && !!l && !sp.shutdown && (sp.speed === "auto" || +sp.speed <= 100);'),
 ("SO-07: the port's speed fixed but not saved counts as fixed", "js/tickets/office.js", '(sp.speed === "auto" || +sp.speed <= 100)', "true"),
 ("the PC's settings never say its adapter is 10/100", "js/net/pages.js", ' + (x.maxMbps ? " (a 10/" + x.maxMbps + " Mbps adapter)" : "")', ""),
 ("SO-09: the sheet left overlapping, accepted", "js/tickets/office.js", "    if (!sheetOk(sim)) return false;\n    const rows = sheetRows", "    const rows = sheetRows"),
 ("SO-09: the switch outside its group's block, accepted", "js/tickets/office.js", "const ok = function (c) { return usableIn(c.vlan1.ip, rows[v.G]) && ", "const ok = function (c) { return "),
 ("SO-09: the switch's new address not saved, accepted", "js/tickets/office.js", " || !st || !ok(st) || st.vlan1.ip !== sw.vlan1.ip) return false;", ") return false;"),
 ("SO-09: the PC still printing to the old address, accepted", "js/tickets/office.js", ' && sim.d.pc.printer.port === pr.ip;', ";"),
 ("the switch never logs a duplicate address", "js/net/cmd.js", "  const a = sim.addr(sw); if (!a) return null;\n  const o = sim.owners", "  const a = null; if (!a) return null;\n  const o = sim.owners"),
 ("two devices on one address: the first always answers", "js/net/sim.js", "    if (owners.length < 2) return owners[0];\n    const t = this.turns", "    return owners[0];\n    const t = this.turns"),
 ("checking the IPAM sheet finds nothing", "js/tickets/engine.js", "sheet: checkSheet(T.sim.net.plan.ipam.block, sheetRows(T.sim.net))", "sheet: []"),
 ("reload keeps unsaved changes", "js/net/swcli.js", "  const base = sw.startup ? clone(sw.startup) : snapshot(newSwitch());\n  CONFIG_KEYS.forEach(function (k) { sw[k] = base[k]; });", "  const base = sw.startup ? clone(sw.startup) : snapshot(newSwitch());"),
]
only = sys.argv[1:]
for name, f, a, b in PLANTS:
    if only and not any(o in name for o in only): continue
    src = open(f).read()
    assert src.count(a) == 1, (name, src.count(a))
    shutil.copy(f, "/tmp/nplant.bak")
    open(f, "w").write(src.replace(a, b))
    try:
        r = subprocess.run(["node", "--test", "tests/office-jobs.test.js", "tests/office.test.js", "tests/office-tickets.test.js"], env=dict(os.environ, SEEDS="20"), capture_output=True, text=True, timeout=900)
        fails = [l.strip() for l in r.stdout.splitlines() if l.startswith("not ok")]
        print(("CAUGHT" if r.returncode else "MISSED") + " · " + name + " · " + (", ".join(fails)[:200]))
    finally:
        shutil.copy("/tmp/nplant.bak", f)
