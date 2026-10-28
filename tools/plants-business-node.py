import subprocess, shutil, os, sys
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))   # this checkout, wherever it is
# Level 3's Node defects: each planted in turn, the business tests run on 20 businesses, and each must fail.
# python3 tools/plants-business-node.py [part of a name ...]
PLANTS = [
 ("SB-J4: a native VLAN that differs at the two ends, accepted", "js/build/business.js", 'C("split", split,', 'C("split", false,'),
 ("SB-J4: a trunk end left to negotiate read as not trunking at all", "js/build/business.js", "cc: carries(SW(sim), port(m.me), dtp(bp)), bc: carries(BSW(sim), port(m.far), dtp(cp)),", "cc: carries(SW(sim), port(m.me), null), bc: carries(BSW(sim), port(m.far), null),"),
 ("SB-J4: VLANs the back of house doesn't use carried, accepted", "js/build/business.js", 'C("extra", !!extra,', 'C("extra", false,'),
 ("SB-J4: the trunk on ports the records don't give it, accepted", "js/build/business.js", 'C("ports", !!L && (L.closet !== T.closet || L.back !== T.back),', 'C("ports", false,'),
 ("SB-J4: the back PC left on its long run, accepted", "js/build/business.js", 'C("old", !!old, "The " + name(sim, "bpc") + " is still on the closet switch\'s long run",', 'C("old", false, "The " + name(sim, "bpc") + " is still on the closet switch\'s long run",'),
 ("SB-J4: the closet's old port left open, accepted", "js/build/business.js", 'C("old", !inUse && !o.shutdown,', 'C("old", false,'),
 ("SB-J4: the closet's old port still described, accepted", "js/build/business.js", 'C("olddesc", !inUse && String(o.desc || "").toUpperCase() === p.desc["4"],', 'C("olddesc", false,'),
 ("SB-J4: the back switch's save read from the closet switch", "js/build/business.js", 'concat(savedCauses(sim, "bsw"))', 'concat(savedCauses(sim, "msw"))'),
 ("SB-J4: the back switch's name given away in a hint", "js/build/business.js", 'rung1: function (v, sim) { return sim.d.bsw.boxed ? "The box tray, then the Place form." :', 'rung1: function (v, sim) { return sim.d.bsw.boxed ? "The box tray, then the Place form: " + v.plan.bswHost :'),
 ("SB-J4: the walk-through pulls a console cable that isn't there", "js/build/business.js", '{ t: "pull", cable: "c-console-" + (runs + 3) }', '{ t: "pull", cable: "c-console-" + (runs + 2) }'),
 ("SB-J5: a camera on the other camera's injector, accepted", "js/build/business.js", 'C("label", onOut && P.inj !== mine,', 'C("label", false,'),
 ("SB-J5: an injector in the wrong room, accepted", "js/build/business.js", 'C("injroom", onOut && sim.net.rooms[P.inj] !== INJ_ROOM[k],', 'C("injroom", false,'),
 ("SB-J5: a camera's port left to negotiate, accepted", "js/build/business.js", 'C("mode", r.sp.mode !== "access",', 'C("mode", false,'),
 ("SB-J5: the trunk's allowed list replaced, accepted", "js/build/business.js", 'C("staff", !!lost,', 'C("staff", false,'),
 ("SB-J5: a forward to the camera's plain page, accepted", "js/build/business.js", 'C("http", !!r.r.who && r.r.who === r.c.id', 'C("http", false && r.r.who === r.c.id'),
 ("SB-J5: a camera free to open HTTPS to the staff PCs", "js/build/business.js", "[445, 443].some(", "[445].some("),
 ("SB-J5: a camera with no lease read as merely on DHCP", "js/build/business.js", 'C("lease", noCamLease(sim, r.c),', 'C("lease", false,'),
 ("SB-J5: the cameras' pool keeping only ten addresses back", "js/build/business.js", 'const keep = k === "cameras" ? v.plan.camExcl : 10,', 'const keep = 10,'),
 ("SB-J5: a camera's address given away in a hint", "js/build/business.js", '"Find each camera\'s address (show ip dhcp binding on the router)', '"Find each camera\'s address (" + camIp(v, v.plan.cams[0]) + ", show ip dhcp binding on the router)'),
 ("SB-J5: the walk-through pulls a console cable that isn't there", "js/build/business.js", '{ t: "pull", cable: "c-console-" + (runs + 5) }', '{ t: "pull", cable: "c-console-" + (runs + 4) }'),
 ("SB-J5: a camera's reply from outside never checked", "js/net/sim.js", 'if (!pass(outIf, "in", rep) || !pass(w.iface, "out"', 'if (false && !pass(outIf, "in", rep) || false && !pass(w.iface, "out"'),
 ("SB-J5: a camera's gateway never checked from outside", "js/net/sim.js", "if (!a || !gw || a.gw !== gw.ip)", "if (!a || !gw)"),
 ("SB-J5: a camera catches the pool half typed", "js/net/sim.js", "&& !poolOpen && ", "&& "),
 ("SB-J6: snooping never drops an answer from an untrusted port", "js/net/sim.js", 'if (S && S.on && S.vlans.indexOf(h.vlan) >= 0 && h.port && !(sw.ports[h.port] && sw.ports[h.port].dtrust)) return h; }', 'if (false) return h; }'),
 ("SB-J6: snooping never learns a binding", "js/net/sim.js", 'sw.snoopBind = (sw.snoopBind || []).filter(function (b) { return b.mac !== mac; }); sw.snoopBind.push(', 'sw.snoopBind = (sw.snoopBind || []).filter(function (b) { return b.mac !== mac; }); [].push('),
 ("SB-J6: ARP inspection ignores a trusted port", "js/net/sim.js", 'if (!sw.dai || sw.dai.vlans.indexOf(h.vlan) < 0 || !h.port || (sw.ports[h.port] && sw.ports[h.port].atrust)) continue;', 'if (!sw.dai || sw.dai.vlans.indexOf(h.vlan) < 0 || !h.port) continue;'),
 ("SB-J6: ARP inspection never drops anything", "js/net/sim.js", '  anyDai() { for (const id in this.d)', '  anyDai() { return false; for (const id in this.d)'),
 ("SB-J6: a port security violation never shuts the port", "js/net/sim.js", 'if (P.viol === "shutdown") { run.err = true; break; }', 'if (P.viol === "shutdown") { break; }'),
 ("SB-J6: shut and opened, an err-disabled port stays down", "js/net/swcli.js", 'S.sw.ports[n].shutdown = true; if (S.sw.psRun && S.sw.psRun[n]) S.sw.psRun[n].err = false; }', 'S.sw.ports[n].shutdown = true; }'),
 ("SB-J6: the remote lines' access list never checked", "js/net/cmd.js", "const name = x.sw.vty.acl, a = sim.addr(id); if (!name", "const name = null, a = sim.addr(id); if (!name"),
 ("SB-J6: no lldp transmit on a port does nothing", "js/net/rtcli.js", "return r.lldp !== false && !(f && f.lldpTx === false); }", "return r.lldp !== false; }"),
 ("SB-J6: a reload keeps what the switch learned", "js/net/swcli.js", "  sw.psRun = {}; sw.snoopBind = [];   /* what it learned", "  /* what it learned"),
 ("SB-J6: an older save reads as changed (keys compared in their saved order)", "js/net/swcli.js", "keys.forEach(function (k) { o[k] = st[k]; }); return now !== JSON.stringify(o); }", "return now !== JSON.stringify(st); }"),
 ("an access port's missing VLAN never made", "js/net/swcli.js", 'if (!S.sw.vlans[v]) { S.sw.vlans[v] = { name: "VLAN" + String(v).padStart(4, "0") }; out.push("% Access VLAN does not exist. Creating vlan " + v); }', 'if (!S.sw.vlans[v]) { out.push("% Access VLAN does not exist. Creating vlan " + v); }'),
 ("interface range takes no list", "js/net/swcli.js", '.replace(/\\s+/g, " ").split(","), out = [];', '.replace(/\\s+/g, " ").split(/(?!)/), out = [];'),
 ("a cable refused names devices in capitals mid-sentence", "js/net/sim.js", 'const theDev = function (x) { return /^your /i.test(x.label) ? x.label.toLowerCase() : "the " + x.label.replace(', 'const theDev = function (x) { return "the " + x.label; return "the " + x.label.replace('),
]
only = sys.argv[1:]
caught = 0
for name, f, a, b in PLANTS:
    if only and not any(o in name for o in only): continue
    src = open(f).read()
    assert src.count(a) == 1, (name, src.count(a))
    shutil.copy(f, "/tmp/bplant.bak")
    open(f, "w").write(src.replace(a, b))
    try:
        r = subprocess.run(["node", "--test", "tests/business-jobs.test.js", "tests/business-sim.test.js", "tests/business-cli.test.js", "tests/business-cams.test.js", "tests/business-harden.test.js", "tests/office.test.js"], env=dict(os.environ, SEEDS="20"), capture_output=True, text=True, timeout=1200)
        fails = [l.strip() for l in r.stdout.splitlines() if l.startswith("not ok")]
        caught += 1 if r.returncode else 0
        print(("CAUGHT" if r.returncode else "MISSED") + " · " + name + " · " + (", ".join(fails)[:200]), flush=True)
    finally:
        shutil.copy("/tmp/bplant.bak", f)
print(str(caught) + " caught")
