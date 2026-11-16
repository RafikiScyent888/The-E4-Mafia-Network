# Plants for Level 4's groundwork (the layer 3 switch): each defect, put into the code, must make the campus tests fail.
# Run it in a throwaway copy of the checkout, never in the real one:   python3 tools/plants-campus-node.py [name ...]
import subprocess, shutil, sys, os
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
TESTS = ["tests/campus-l3.test.js", "tests/campus-sim.test.js", "tests/campus-lag.test.js"]
PLANTS = [
 ("a routed port still carries its VLANs", "js/net/swcli.js", '  if (sw.ports[n].routed) return { mode: "routed", untagged: null, tagged: [] };', ''),
 ("switchport settings accepted on a routed port", "js/net/swcli.js", 'S.ifs.some(function (n) { return !isSvi(n) && S.sw.ports[n].routed; })) return ["% Invalid input', 'false) return ["% Invalid input'),
 ("a static route counts whatever its next hop", "js/net/l3.js", '    const f = conn(s.nh); if (f) cand.push(', '    const f = conn(s.nh) || up[0]; if (f) cand.push('),
 ("the longest match not the longest", "js/net/l3.js", '(!best || bits(t.mask) > bits(best.mask))', '(!best || bits(t.mask) < bits(best.mask))'),
 ("a switch that isn't layer 3 given the layer 3 commands", "js/net/swcli.js", 'registerOS("switch", { bootUp: function (sw, n) { if (isSvi(n)) sviOf(sw, n).shutdown = false; else sw.ports[n].shutdown = false; }, tree: TREE,', 'registerOS("switch", { bootUp: function (sw, n) { if (isSvi(n)) sviOf(sw, n).shutdown = false; else sw.ports[n].shutdown = false; }, get tree() { return L3_TREE; },'),
 ("a switch routes with ip routing off (both guards: the simulation's and the table's)", [("js/net/sim.js", 'x.sw.os === "l3switch" && !!x.sw.routing && this.on(id); }', 'x.sw.os === "l3switch" && this.on(id); }'),
   ("js/net/swcli.js", 'export function l3Route(sw, dst, learned) { return sw.routing ? longest(', 'export function l3Route(sw, dst, learned) { return true ? longest(')]),
 ("a routed port bridged into the switch", "js/net/sim.js", '        if (x.sw.ports[swPort(end.port)] && x.sw.ports[swPort(end.port)].routed) return { u: this.l3Node(end.dev, swPort(end.port)), t: {} };', '        if (x.sw.ports[swPort(end.port)] && x.sw.ports[swPort(end.port)].routed) return { u: end.dev, t: {} };'),
 ("the way back never checked", "js/net/sim.js", '      if (!oneWay) { const r = this.route(back[0], a.ip, proto, true); if (r.fail || !(r.local || r.routed)) return Object.assign({ fail: "no-reply", hops: hops.slice(), why: "no way back", owner: owners, routers: routers }, base); }', ''),
 ("a routing switch can't take a reply", "js/net/sim.js", '    if (this.routes3(id)) return !!l3Route(this.l3View(id), to, this.learned(id));   /* a switch that routes replies by its own table */', ''),
 ("the TTL one less however many switches", "js/net/cmd.js", '(sim.ttlOf(who) - (rt.routers || 1))', '(sim.ttlOf(who) - 1)'),
 ("LACP: passive with passive bundles", "js/net/swcli.js", ' || (p.chan.mode === "passive" && far.mode === "passive")) return "I";', ') return "I";'),
 ("LACP: on bundles only with on", "js/net/swcli.js", '  if (p.chan.mode === "on") return "P";', '  if (p.chan.mode === "on") return l.chan && l.chan.mode === "on" ? "P" : "I";'),
 ("LACP: a suspended member still carries frames", "js/net/sim.js", '        if (x.sw.ports[swPort(end.port)] && x.sw.ports[swPort(end.port)].chan && chanState(Object.assign({}, x.sw, { links: this.switchLinks(end.dev) }), swPort(end.port)) === "s") return { u: null, t: {} };', ''),
 ("LACP: a member's VLAN settings never compared", "js/net/swcli.js", '  if (pc.shutdown || L2KEYS.some(function (k) { return v(p, k) !== v(pc, k); })) return "s";', '  if (pc.shutdown) return "s";'),
 ("LACP: a member to another switch bundles", "js/net/swcli.js", '  if (first && first !== n && sw.links[first].farDev && l.farDev !== sw.links[first].farDev) return "s";', ''),
 ("LACP: the bandwidth counts every member, bundled or not", "js/net/swcli.js", 'const M = membersOf(sw, g), B = M.filter(function (n) { return chanState(sw, n) === "P"; }), up = B.length > 0;', 'const M = membersOf(sw, g), B = M, up = M.some(function (n) { return chanState(sw, n) === "P"; });'),
 ("LACP: interface port-channel reaches no member", "js/net/swcli.js", 'S.mode = "if"; S.po = f.po; S.ifs = membersOf(S.sw, f.po); return []; }', 'S.mode = "if"; S.po = f.po; S.ifs = []; return []; }'),
 ("LACP: a suspended member's line protocol shown up", "js/net/swcli.js", '  if (p.chan && chanState(sw, n) === "s") return ["up", "down"];   /* suspended from its port-channel */', ''),
]
only = sys.argv[1:]
bad = 0
for P in PLANTS:
    name, edits = P[0], (P[1] if isinstance(P[1], list) else [P[1:]])   # a plant may change more than one place: every guard it must get past
    if only and not any(o in name for o in only): continue
    for f, a, b in edits: assert open(f).read().count(a) == 1, (name, f, open(f).read().count(a))
    files = sorted(set(e[0] for e in edits))
    for f in files: shutil.copy(f, f + ".plant-bak")
    for f, a, b in edits: src = open(f).read(); open(f, "w").write(src.replace(a, b))
    try:
        r = subprocess.run(["node", "--test"] + TESTS, capture_output=True, text=True, timeout=600)
        fails = [l for l in r.stdout.splitlines() if l.startswith("not ok")]
        print(("CAUGHT" if r.returncode else "MISSED") + " · " + name + " · " + str(len(fails)) + " failing" + ("" if not fails else ": " + fails[0][:150]), flush=True)
        if not r.returncode: bad = 1
    finally:
        for f in files: shutil.move(f + ".plant-bak", f)
sys.exit(bad)
