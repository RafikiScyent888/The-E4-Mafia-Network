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
        r = subprocess.run(["node", "--test", "tests/business-jobs.test.js", "tests/business-sim.test.js", "tests/business-cli.test.js", "tests/office.test.js"], env=dict(os.environ, SEEDS="20"), capture_output=True, text=True, timeout=1200)
        fails = [l.strip() for l in r.stdout.splitlines() if l.startswith("not ok")]
        caught += 1 if r.returncode else 0
        print(("CAUGHT" if r.returncode else "MISSED") + " · " + name + " · " + (", ".join(fails)[:200]), flush=True)
    finally:
        shutil.copy("/tmp/bplant.bak", f)
print(str(caught) + " caught")
