# Plants for Level 4's groundwork (the layer 3 switch, spanning tree, LACP, OSPF, standby) and its work orders: each defect, put into the code, must make the campus tests fail.
# Run it in a throwaway copy of the checkout, never in the real one:   python3 tools/plants-campus-node.py [name ...]
import subprocess, shutil, sys, os
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
TESTS = ["tests/campus-l3.test.js", "tests/campus-sim.test.js", "tests/campus-lag.test.js", "tests/campus-stp.test.js", "tests/campus-ospf.test.js", "tests/campus-hsrp.test.js", "tests/campus-site.test.js", "tests/campus-jobs.test.js"]
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
 ("STP: the highest bridge ID made root", "js/net/stp.js", 'const cmpId = function (a, b) { return a.prio - b.prio || (a.mac < b.mac ? -1 : a.mac > b.mac ? 1 : 0); };', 'const cmpId = function (a, b) { return b.prio - a.prio || (a.mac < b.mac ? 1 : a.mac > b.mac ? -1 : 0); };'),
 ("STP: a blocked port still forwards", "js/net/sim.js", '        const blk = this.stpBlockedOn(end.dev, swPort(end.port)) || [];', '        const blk = [];'),
 ("STP: a port-channel's members each a port", "js/net/sim.js", 'const lpOf = function (sw, view, n) { const p = sw.ports[n]; return p.chan && chanState(view, n) === "P" ? "Po" + p.chan.group : n; };', 'const lpOf = function (sw, view, n) { return n; };'),
 ("STP: root primary always 24576", "js/net/swcli.js", 'P[v] = !B || B.root === T.me || rp > 24576 ? 24576 : Math.max(0, rp - 4096);', 'P[v] = 24576;'),
 ("STP: any priority taken", "js/net/swcli.js", 'if (n % 4096) return ["% Bridge Priority must be in increments of 4096.",', 'if (false) return ["% Bridge Priority must be in increments of 4096.",'),
 ("STP: BPDU guard never shuts the port", "js/net/sim.js", '        run.err = true; run.why = "bpduguard";', '        run.why = "bpduguard";'),
 ("STP: portfast never marks an edge port", "js/net/sim.js", 'edge: !!(p.stp && p.stp.portfast), fixed:', 'edge: false, fixed:'),
 ("STP: never a loop, so nothing ever blocks", "js/net/sim.js", '      if (ends / 2 >= nodes) return true;', ''),
 ("STP: the designated port the far end's when it shouldn't be", "js/net/stp.js", "    out.roles[key] = mine ? { role: \"Desg\", sts: \"FWD\" } : { role: \"Altn\", sts: \"BLK\" };", "    out.roles[key] = !mine ? { role: \"Desg\", sts: \"FWD\" } : { role: \"Altn\", sts: \"BLK\" };"),
 ("STP: a bundle costs the same as one port", "js/net/stp.js", '  if (members && members > 1) return members >= 3 ? 2 : 3;', ''),
 ("OSPF: a different area still neighbours", "js/net/ospf.js", 'return a.id !== b.id && a.f.area === b.f.area && a.f.mask', 'return a.id !== b.id && a.f.mask'),
 ("OSPF: an MTU mismatch still goes FULL", "js/net/ospf.js", ': (m.f.mtu || 1500) !== (o.f.mtu || 1500) ? "EXSTART" : "FULL";', ': "FULL";'),
 ("OSPF: a passive interface still sends hellos", "js/net/ospf.js", '  ids.forEach(function (id) { routers[id].ifs.forEach(function (f) { if (f.passive || !f.seg) return;', '  ids.forEach(function (id) { routers[id].ifs.forEach(function (f) { if (!f.seg) return;'),
 ("OSPF: a passive network not advertised", "js/net/ospf.js", "        const key = netOf(f.ip, f.mask) + \"/\" + f.mask; if (mine.indexOf(key) >= 0) return;", "        const key = netOf(f.ip, f.mask) + \"/\" + f.mask; if (mine.indexOf(key) >= 0 || f.passive) return;"),
 ("OSPF: the same router ID still neighbours", "js/net/ospf.js", ' && routers[a.id].rid !== routers[b.id].rid; };', '; };'),
 ("OSPF: the lowest router ID made DR", "js/net/ospf.js", '|| ridCmp(routers[b.id].rid, routers[a.id].rid); });', '|| ridCmp(routers[a.id].rid, routers[b.id].rid); });'),
 ("OSPF: the far network's own cost left out", "js/net/ospf.js", '        const m = dist[x] + (f.cost || 1);', '        const m = dist[x];'),
 ("OSPF: a default originated with none to give", "js/net/sim.js", 'const def = !!O.originate && l3Table(view, []).some(', 'const def = !!O.originate || l3Table(view, []).some('),
 ("OSPF: what it learns never used", "js/net/sim.js", "  learned(id) { const x = this.d[id]; if (!x || !x.sw || !x.sw.ospf) return [];", "  learned(id) { return [];"),
 ("OSPF: the reference bandwidth ignored", "js/net/sim.js", 'cost: rec.ospfCost || ospfCost(mbps, O.refBw),', 'cost: rec.ospfCost || ospfCost(mbps, 100),'),
 ("OSPF: an external type 2's metric grows on the way", "js/net/ospf.js", 'nh: first[x].nh, iface: first[x].iface, metric: 1 };', 'nh: first[x].nh, iface: first[x].iface, metric: dist[x] + 1 };'),
 ("HSRP: the lowest priority made active (the election's rank and the state's)", [("js/net/sim.js", "    const rank = function (p, q) { return q.pri - p.pri || ip2n(q.ip) - ip2n(p.ip); };\n    keys.forEach(function (k) {", "    const rank = function (p, q) { return p.pri - q.pri || ip2n(q.ip) - ip2n(p.ip); };\n    keys.forEach(function (k) {"),
   ("js/net/sim.js", "    const rank = function (p, q) { return q.pri - p.pri || ip2n(q.ip) - ip2n(p.ip); };\n    Object.keys(G).forEach(function (k) {", "    const rank = function (p, q) { return p.pri - q.pri || ip2n(q.ip) - ip2n(p.ip); };\n    Object.keys(G).forEach(function (k) {")]),
 ("HSRP: an interface up with no address can stay active", "js/net/sim.js", "      const el = G[k].filter(function (m) { return m.up; }).sort(rank); if (!el.length) { delete A[k]; return; }", "      const el = G[k].slice().sort(rank); if (!el.length) { delete A[k]; return; }"),
 ("HSRP: a higher priority takes over without preempt", "js/net/sim.js", "else if (best.id !== cur.id && best.preempt && best.pri > cur.pri) A[k] = best.id;", "else if (best.id !== cur.id && best.pri > cur.pri) A[k] = best.id;"),
 ("HSRP: preempt never takes over", "js/net/sim.js", "else if (best.id !== cur.id && best.preempt && best.pri > cur.pri) A[k] = best.id;", ""),
 ("HSRP: every member answers for the virtual address", "js/net/sim.js", "if (q.active && q.active.id === id && q.vip) out.push({ vip: q.vip, node: q.active.node });", "q.members.forEach(function (m) { if (m.id === id && q.vip) out.push({ vip: q.vip, node: m.node }); });"),
 ("HSRP: a virtual address outside the subnet taken", "js/net/swcli.js", '    if (bad) return ["% Address " + a[2] + " in group " + g + " not within subnet on interface " + bad];', ''),
 ("HSRP: the lower address wins a tie (the election's rank and the state's)", [("js/net/sim.js", "    const rank = function (p, q) { return q.pri - p.pri || ip2n(q.ip) - ip2n(p.ip); };\n    keys.forEach(function (k) {", "    const rank = function (p, q) { return q.pri - p.pri || ip2n(p.ip) - ip2n(q.ip); };\n    keys.forEach(function (k) {"),
   ("js/net/sim.js", "    const rank = function (p, q) { return q.pri - p.pri || ip2n(q.ip) - ip2n(p.ip); };\n    Object.keys(G).forEach(function (k) {", "    const rank = function (p, q) { return q.pri - p.pri || ip2n(p.ip) - ip2n(q.ip); };\n    Object.keys(G).forEach(function (k) {")]),
 ("HSRP: the election never runs after a change", "js/net/sim.js", "this.bpduGuard(); this.hsrpTick();", "this.bpduGuard();"),
 ("LACP: a suspended member's line protocol shown up", "js/net/swcli.js", '  if (p.chan && chanState(sw, n) === "s") return ["up", "down"];   /* suspended from its port-channel */', ''),
 ("CP-J1: a port that learns but doesn't stick passes", "js/build/campus.js", ' || P.viol !== "shutdown" || !stuck(r).some(function (k) { return k.mac === mac(r); }); };', ' || P.viol !== "shutdown"; };'),
 ("CP-J1: a stranger merely counted passes", "js/build/campus.js", ' || P.max > 1 || P.viol !== "shutdown" || ', ' || P.max > 1 || '),
 ("CP-J1: two devices a port passes", "js/build/campus.js", 'errDisabled(sim.d[r.sw].sw, r.n) || P.max > 1 || ', 'errDisabled(sim.d[r.sw].sw, r.n) || '),
 ("CP-J1: portfast never looked for", "js/build/campus.js", 'const r = desks(sim, v).find(function (x) { return !(x.p.stp && x.p.stp.portfast); });', 'const r = null;'),
 ("CP-J1: BPDU guard never looked for", "js/build/campus.js", 'rows = desks(sim, v), r = rows.find(function (x) { return !(x.p.stp && x.p.stp.bpduguard); });', 'rows = desks(sim, v), r = null;'),
 ("CP-J1: the uplinks never checked", "js/build/campus.js", '  return [C("shut", !!shut, "An uplink is shut down: "', '  return []; [C("shut", !!shut, "An uplink is shut down: "'),
 ("CP-J1: the spares' VLAN never checked", "js/build/campus.js", 'park = S.find(function (r) { return r.p.access !== v.plan.vlans.parking.id; });', 'park = null;'),
 ("CP-J1: an open spare passes", "js/build/campus.js", 'open = S.find(function (r) { return !r.p.shutdown; }),', 'open = null,'),
 ("CP-J1: a floor cut off still counts as working", "js/build/campus.js", 'const off = CAMPUS_PCS.find(function (id) { return !sim.route(id, "8.8.8.8").internet; }),', 'const off = null,'),
 ("CP-J1: an unsaved switch passes", "js/build/campus.js", 'return [C("unsaved", unsaved(sim.d[id].sw),', 'return [C("unsaved", false,'),
 ("CP-J1: the walk-through saves only the first floor", "js/build/campus.js", '"spanning-tree portfast", "spanning-tree bpduguard enable", "end", "copy running-config startup-config", "", "exit"].forEach(t);', '"spanning-tree portfast", "spanning-tree bpduguard enable", "end"].concat(a[0] === "acc1" ? ["copy running-config startup-config", ""] : []).concat(["exit"]).forEach(t);'),
 ("CP-J1: a hint names the enable secret", "js/build/campus.js", 'rung1: function () { return "show port-security on each access switch, then', 'rung1: function (v) { return v.plan.secret + " show port-security on each access switch, then'),
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
