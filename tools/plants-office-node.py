import subprocess, shutil, os
os.chdir("/home/user/the-e4-mafia-network")
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
 ("reload keeps unsaved changes", "js/net/swcli.js", "  const base = sw.startup ? clone(sw.startup) : snapshot(newSwitch());\n  CONFIG_KEYS.forEach(function (k) { sw[k] = base[k]; });", "  const base = sw.startup ? clone(sw.startup) : snapshot(newSwitch());"),
]
for name, f, a, b in PLANTS:
    src = open(f).read()
    assert src.count(a) == 1, (name, src.count(a))
    shutil.copy(f, "/tmp/nplant.bak")
    open(f, "w").write(src.replace(a, b))
    try:
        r = subprocess.run(["node", "--test", "tests/office-jobs.test.js", "tests/office.test.js"], env=dict(os.environ, SEEDS="20"), capture_output=True, text=True, timeout=900)
        fails = [l.strip() for l in r.stdout.splitlines() if l.startswith("not ok")]
        print(("CAUGHT" if r.returncode else "MISSED") + " · " + name + " · " + (", ".join(fails)[:200]))
    finally:
        shutil.copy("/tmp/nplant.bak", f)
