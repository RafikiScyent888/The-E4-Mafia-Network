/* Level 4, the campus: OSPF on the edge router (BR-4200). After CP-J4 (the gateways on distribution switch 1, static routes
   both ways), the static routes are replaced by OSPF: the edge router in area 0 on its link, originating the default it has from
   the provider; distribution switch 1 advertising every VLAN in use. What each learns, the show commands on the router, its
   running configuration and a reload, and what breaks when a piece is missing. */
import test from "node:test";
import assert from "node:assert/strict";
import { CAMPUS_JOBS } from "../js/build/campus.js";
import * as B from "../js/build/engine.js";
import * as C from "../js/net/swcli.js";
import * as RT from "../js/net/rtcli.js";

const seeds = [6001, 6002, 6003, 6004];
const PCS = ["sd1", "hd1", "bn1", "bn2", "mgr", "fin"];
function cut(seed) { const def = CAMPUS_JOBS.find((d) => d.id === "CP-J4"), J = B.open(def, seed); for (const a of def.solve(J.v, J.sim)) B.act(J, a); return J; }
function conf(sim, id, lines) {
  const before = sim.links(); if (sim.d[id].kind === "mswitch") sim.syncSwitch(id);
  const S = C.session(sim.d[id].sw, sim.d[id].kind === "mswitch" ? { live: sim.swLive(id) } : { live: sim.rtLive(id) }); S.mode = "priv"; S.fresh = false; S.pending = null;
  const out = ["configure terminal"].concat(lines, ["end"]).map((l) => C.exec(S, l).out).flat();
  if (sim.d[id].kind === "mswitch") sim.syncSwitch(id); sim.relink(before); return out;
}
const show = (sim, id, line) => { const S = C.session(sim.d[id].sw, sim.d[id].kind === "mswitch" ? { live: sim.swLive(id) } : { live: sim.rtLive(id) }); S.mode = "priv"; S.fresh = false; S.pending = null; return C.exec(S, line).out.join("\n"); };
const T = (p) => { const b = p.vlans.svc.net.split(".")[1]; return { b, net: "10." + b + ".255.0", edge: "10." + b + ".255.1", dist: "10." + b + ".255.2" }; };
function ospf(seed, o = {}) {
  const J = cut(seed), sim = J.sim, p = J.v.plan, t = T(p);
  conf(sim, "edge", ["no ip route 10." + t.b + ".0.0 255.255.0.0 " + t.dist, "router ospf 1", "network " + t.net + " 0.0.0.3 area " + (o.edgeArea ?? 0)].concat(o.noOriginate ? [] : ["default-information originate"]));
  conf(sim, "dist1", ["no ip route 0.0.0.0 0.0.0.0 " + t.edge, "router ospf 1", "network 10." + t.b + ".0.0 0.0.255.255 area 0"]);
  return { J, sim, p, t };
}

test("the edge router and distribution switch 1 neighbour in area 0: the default goes one way, every VLAN the other, every PC online", () => {
  for (const s of seeds) {
    const { sim, p, t } = ospf(s);
    const nb = show(sim, "edge", "show ip ospf neighbor"); assert.match(nb, /FULL/, s + "\n" + nb);
    const er = show(sim, "edge", "show ip route");
    for (const k of ["svc", "bench", "office", "servers", "printers", "mgmt"]) assert.match(er, new RegExp("^O\\s+" + p.vlans[k].net.replace(/\./g, "\\.") + "/24 \\[110/2\\] via " + t.dist.replace(/\./g, "\\."), "m"), s + " the edge router learns " + k + "\n" + er);
    assert.match(er, /^S\*\s+0\.0\.0\.0\/0 \[254\/0\]/m, s + " its own default, from the provider by DHCP");
    const dr = show(sim, "dist1", "show ip route"); assert.match(dr, /^O\*E2\s+0\.0\.0\.0\/0 \[110\/1\] via /m, s + " distribution switch 1 learns the default\n" + dr);
    for (const id of PCS) assert.equal(sim.route(id, "8.8.8.8").internet, true, s + " " + id + " " + JSON.stringify(sim.route(id, "8.8.8.8")));
    assert.ok(sim.route("edge", sim.addr("mgr").ip).routed, s + " the edge router reaches a PC by what it learned");
    assert.match(show(sim, "edge", "show ip protocols"), /Routing Protocol is "ospf 1"/);
    assert.match(show(sim, "edge", "show ip ospf interface brief"), /Gi0\/1|GigabitEthernet0\/1/);
  }
});

test("each piece missing breaks what it should: no default originated, the edge router in another area, a passive link", () => {
  for (const s of seeds.slice(0, 2)) {
    let { sim } = ospf(s, { noOriginate: true });
    assert.ok(!/O\*E2/.test(show(sim, "dist1", "show ip route")), s + " no default originated: none learned"); assert.equal(sim.route("sd1", "8.8.8.8").fail, "net-unreachable");
    ({ sim } = ospf(s, { edgeArea: 1 }));
    assert.ok(!/FULL/.test(show(sim, "edge", "show ip ospf neighbor")), s + " another area: no neighbour"); assert.equal(sim.route("sd1", "8.8.8.8").internet, undefined);
    const o = ospf(s); conf(o.sim, "edge", ["router ospf 1", "passive-interface " + o.p.edge.lan]);
    assert.ok(!/FULL/.test(show(o.sim, "edge", "show ip ospf neighbor")), s + " the link passive: no neighbour"); assert.ok(!o.sim.route("bn1", "8.8.8.8").internet);
  }
});

test("a static route still beats OSPF (distance 1 against 110); OSPF never replaces a connected network", () => {
  const { sim, p, t } = ospf(seeds[0]);
  conf(sim, "edge", ["ip route " + p.vlans.svc.net + " 255.255.255.0 " + t.dist]);
  const er = show(sim, "edge", "show ip route");
  assert.match(er, new RegExp("^S\\s+" + p.vlans.svc.net.replace(/\./g, "\\.") + "/24 \\[1/0\\]", "m"), er); assert.ok(!new RegExp("^O\\s+" + p.vlans.svc.net.replace(/\./g, "\\."), "m").test(er));
  assert.match(er, new RegExp("^C\\s+" + t.net.replace(/\./g, "\\.") + "/30", "m"));
});

test("the router's OSPF in its running configuration, saved, and the same after a reload; one process only; interface settings", () => {
  const { sim, p } = ospf(seeds[1]);
  conf(sim, "edge", ["interface " + p.edge.lan, "ip ospf cost 10", "ip ospf priority 0", "exit", "router ospf 1", "router-id 1.1.1.1"]);
  const run = RT.newRouter ? C.configText(sim.d.edge.sw) : "";
  for (const l of ["router ospf 1", " router-id 1.1.1.1", " default-information originate", " ip ospf cost 10", " ip ospf priority 0"]) assert.ok(run.indexOf(l) >= 0, l + "\n" + run);
  assert.match(conf(sim, "edge", ["router ospf 2"]).join("\n"), /OSPF process 1 is already running/);
  assert.equal(C.unsaved(sim.d.edge.sw), true); conf(sim, "edge", ["do copy running-config startup-config", ""]); assert.equal(C.unsaved(sim.d.edge.sw), false, "saved");
  assert.match(show(sim, "edge", "show ip ospf neighbor"), /1\.1\.1\.1|FULL/);
  conf(sim, "edge", ["no router ospf 1"]); assert.ok(C.configText(sim.d.edge.sw).indexOf("router ospf") < 0, "no router ospf takes it all away");
});

test("a router that never ran OSPF saves and reads exactly as before (nothing made until used)", () => {
  const J = cut(seeds[2]); assert.equal(J.sim.d.edge.sw.ospf, undefined); assert.equal(C.unsaved(J.sim.d.edge.sw), false);
  assert.ok(C.configText(J.sim.d.edge.sw).indexOf("router ospf") < 0);
});
