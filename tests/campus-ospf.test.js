/* Level 4, the campus: OSPF in one area. A core switch with routed links to two distribution switches (core gi0/1
   10.0.1.1/30 to dsw1 gi0/24 .2; core gi0/2 10.0.2.1/30 to dsw2 gi0/24 .2), a PC in VLAN 10 behind dsw1 (10.1.10.0/24), a
   printer in VLAN 20 behind dsw2 (10.1.20.0/24), and the core's routed port to the provider (192.0.2.0/30). Every switch
   runs "router ospf 1" with network statements; every result is what the network itself works out. */
import test from "node:test";
import assert from "node:assert/strict";
import { Sim } from "../js/net/sim.js";
import * as C from "../js/net/swcli.js";
import { exec } from "../js/net/cmd.js";

const host = (id, kind, ip, gw, mac) => ({ id: id, kind: kind, label: id, on: true, os: kind === "pc" ? "windows" : undefined, ifaces: [{ name: "Ethernet", type: "eth", port: kind === "pc" ? "NIC" : "NET", mac: mac, cfg: { mode: "static", ip: ip, mask: ip.startsWith("192.0.2") ? "255.255.255.252" : "255.255.255.0", gw: gw, dns: [] }, lease: null, apipa: null }] });
const cab = (id, a, ap, b, bp) => ({ id: id, kind: "cat6", a: { dev: a, port: ap, seated: true }, b: { dev: b, port: bp, seated: true }, cond: "good", length: 10 });
const swd = (id, mac) => ({ id: id, kind: "mswitch", label: id, on: true, mac: mac, sw: C.newSwitch({ l3: true, mac: mac }) });
function net() {
  return { seed: 1, site: "campus", isp: { up: true, outage: false, gw: "198.51.100.1", core: "203.0.113.1", dns: [], wanIp: "198.51.100.9", mask: "255.255.255.0" },
    devices: { core: swd("core", "00e0.4c06.0001"), dsw1: swd("dsw1", "00e0.4c06.0002"), dsw2: swd("dsw2", "00e0.4c06.0003"),
      pc1: host("pc1", "pc", "10.1.10.11", "10.1.10.1", "aa-00-00-00-04-01"), printer: host("printer", "printer", "10.1.20.20", "10.1.20.1", "aa-00-00-00-04-02"), isp: host("isp", "printer", "192.0.2.2", "192.0.2.1", "aa-00-00-00-04-03") },
    cables: [cab("c1", "core", "1", "dsw1", "24"), cab("c2", "core", "2", "dsw2", "24"), cab("c3", "core", "3", "isp", "NET"), cab("c4", "dsw1", "1", "pc1", "NIC"), cab("c5", "dsw2", "1", "printer", "NET")],
    neighbours: [], ports: {}, rooms: {}, extra: { build: true } };
}
const live = (sim, id) => ({ live: sim.swLive(id), reach: (ip) => { const r = sim.route(id, ip); return !r.fail && !!(r.local || r.routed); } });
function cli(sim, id, lines) { sim.syncSwitch(id); const S = C.session(sim.d[id].sw, live(sim, id)); C.exec(S, ""); C.exec(S, "enable"); C.exec(S, "configure terminal"); const out = lines.map((l) => C.exec(S, l).out).flat(); C.exec(S, "end"); return out; }
const show = (sim, id, line) => { sim.syncSwitch(id); const S = C.session(sim.d[id].sw, live(sim, id)); C.exec(S, ""); C.exec(S, "enable"); return C.exec(S, line).out.join("\n"); };
const OSPF = ["router ospf 1", "network 10.0.0.0 0.0.255.255 area 0", "network 10.1.0.0 0.0.255.255 area 0", "exit"];
function built(extra) {
  const sim = new Sim(net());
  cli(sim, "core", ["ip routing", "interface gi0/1", "no switchport", "ip address 10.0.1.1 255.255.255.252", "interface gi0/2", "no switchport", "ip address 10.0.2.1 255.255.255.252", "interface gi0/3", "no switchport", "ip address 192.0.2.1 255.255.255.252", "exit"].concat(OSPF, (extra && extra.core) || []));
  cli(sim, "dsw1", ["ip routing", "vlan 10", "interface gi0/1", "switchport mode access", "switchport access vlan 10", "interface vlan 10", "ip address 10.1.10.1 255.255.255.0", "no shutdown", "interface gi0/24", "no switchport", "ip address 10.0.1.2 255.255.255.252", "exit"].concat(OSPF, (extra && extra.dsw1) || []));
  cli(sim, "dsw2", ["ip routing", "vlan 20", "interface gi0/1", "switchport mode access", "switchport access vlan 20", "interface vlan 20", "ip address 10.1.20.1 255.255.255.0", "no shutdown", "interface gi0/24", "no switchport", "ip address 10.0.2.2 255.255.255.252", "exit"].concat(OSPF, (extra && extra.dsw2) || []));
  return sim;
}

test("neighbours come up FULL, the DR the higher router ID (the core's is its provider port's 192.0.2.1); each learns the others' networks with the costs added up", () => {
  const sim = built();
  const n = show(sim, "core", "show ip ospf neighbor");
  assert.match(n, /10\.1\.10\.1\s+1\s+FULL\/BDR\s+\S+\s+10\.0\.1\.2\s+GigabitEthernet0\/1/, n); assert.match(show(sim, "dsw1", "show ip ospf neighbor"), /192\.0\.2\.1\s+1\s+FULL\/DR/);
  assert.match(n, /10\.1\.20\.1\s+1\s+FULL\/BDR\s+\S+\s+10\.0\.2\.2\s+GigabitEthernet0\/2/);
  const r = show(sim, "dsw1", "show ip route");
  assert.match(r, /O        10\.1\.20\.0\/24 \[110\/3\] via 10\.0\.1\.1, GigabitEthernet0\/24/, r);
  assert.match(r, /O        10\.0\.2\.0\/30 \[110\/2\] via 10\.0\.1\.1/);
  assert.doesNotMatch(show(sim, "dsw1", "show ip route ospf"), /^C /m, "show ip route ospf: only what OSPF learned");
  assert.match(exec(sim, "pc1", "ping 10.1.20.20").out, /TTL=61/, "three switches crossed");
});

test("no neighbour: a different area, a passive interface; the routes go with it (a passive network is still advertised)", () => {
  let sim = built({ dsw2: ["router ospf 1", "no network 10.0.0.0 0.0.255.255", "network 10.0.0.0 0.0.255.255 area 1", "exit"] });
  assert.doesNotMatch(show(sim, "core", "show ip ospf neighbor"), /10\.1\.20\.1/); assert.ok(sim.route("pc1", "10.1.20.20").fail);
  sim = built({ core: ["router ospf 1", "passive-interface gi0/2", "exit"] });
  assert.doesNotMatch(show(sim, "core", "show ip ospf neighbor"), /10\.1\.20\.1/);
  sim = built({ dsw1: ["router ospf 1", "passive-interface vlan 10", "exit"] });
  assert.match(show(sim, "dsw2", "show ip route"), /O        10\.1\.10\.0\/24/, "VLAN 10 passive: no hellos there, still advertised");
  assert.match(show(sim, "dsw1", "show ip ospf interface brief"), /Vl10\s+1\s+0\s+10\.1\.10\.1\/24\s+1\s+DOWN/);
});

test("an MTU mismatch: stuck in EXSTART, and nothing learned across it", () => {
  const sim = built({ dsw2: ["interface gi0/24", "ip mtu 9000", "exit"] });
  assert.match(show(sim, "core", "show ip ospf neighbor"), /10\.1\.20\.1\s+1\s+EXSTART\/BDR/);
  assert.doesNotMatch(show(sim, "dsw1", "show ip route"), /10\.1\.20\.0/);
  assert.match(show(sim, "dsw2", "show running-config"), /interface GigabitEthernet0\/24\n no switchport\n ip address 10\.0\.2\.2 255\.255\.255\.252\n ip mtu 9000\n/);
});

test("router IDs: set by hand they show to the neighbour; the same on two switches makes no adjacency", () => {
  let sim = built({ core: ["router ospf 1", "router-id 1.1.1.1", "exit"] });
  assert.match(show(sim, "dsw1", "show ip ospf neighbor"), /1\.1\.1\.1\s+1\s+FULL\/BDR/);
  assert.match(show(sim, "core", "show ip protocols"), /Router ID 1\.1\.1\.1/);
  sim = built({ core: ["router ospf 1", "router-id 1.1.1.1", "exit"], dsw2: ["router ospf 1", "router-id 1.1.1.1", "exit"] });
  assert.doesNotMatch(show(sim, "core", "show ip ospf neighbor"), /10\.0\.2\.2/);
});

test("a default route originated: the others learn O*E2 0.0.0.0/0, metric 1, and reach the provider", () => {
  const sim = built({ core: ["ip route 0.0.0.0 0.0.0.0 192.0.2.2", "router ospf 1", "default-information originate", "exit"] });
  const r = show(sim, "dsw2", "show ip route");
  assert.match(r, /Gateway of last resort is 10\.0\.2\.1 to network 0\.0\.0\.0/, r); assert.match(r, /O\*E2     0\.0\.0\.0\/0 \[110\/1\] via 10\.0\.2\.1/);
  assert.equal(sim.route("printer", "192.0.2.2").routed, true);
  const s2 = built({ core: ["router ospf 1", "default-information originate", "exit"] });
  assert.doesNotMatch(show(s2, "dsw2", "show ip route"), /0\.0\.0\.0\/0/, "no default route of its own: nothing to originate");
});

test("costs: the reference bandwidth raised makes a gigabit cost more; ip ospf cost wins; the lower total path wins", () => {
  let sim = built({ dsw1: ["router ospf 1", "auto-cost reference-bandwidth 10000", "exit"] });
  assert.match(show(sim, "dsw1", "show ip ospf interface brief"), /Gi0\/24\s+1\s+0\s+10\.0\.1\.2\/30\s+10\s/);
  sim = built({ dsw1: ["interface gi0/24", "ip ospf cost 50", "exit"] });
  assert.match(show(sim, "dsw1", "show ip route"), /O        10\.1\.20\.0\/24 \[110\/52\]/);
});

test("the configuration carries it; a switch that isn't layer 3 has no router ospf; a check never changes the network", () => {
  const sim = built({ core: ["router ospf 1", "router-id 1.1.1.1", "passive-interface gi0/3", "exit"] });
  const run = show(sim, "core", "show running-config");
  assert.match(run, /\nrouter ospf 1\n router-id 1\.1\.1\.1\n passive-interface GigabitEthernet0\/3\n network 10\.0\.0\.0 0\.0\.255\.255 area 0\n network 10\.1\.0\.0 0\.0\.255\.255 area 0\n!/, run);
  const l2 = C.session(C.newSwitch()); C.exec(l2, ""); C.exec(l2, "enable"); C.exec(l2, "configure terminal");
  assert.match(C.exec(l2, "router ospf 1").out.join("\n"), /Invalid input/);
  const before = JSON.stringify(sim.net); sim.route("pc1", "10.1.20.20"); show(sim, "dsw1", "show ip ospf neighbor"); sim.ospfAll(); sim.learned("dsw2");
  assert.equal(JSON.stringify(sim.net), before);
});

test("equal-cost paths: both kept, lowest next hop first, each its own line in show ip route; a cheaper one replaces them", async () => {
  const { solve } = await import("../js/net/ospf.js"); const { routeTable, routeLines } = await import("../js/net/l3.js");
  const f = (name, ip, seg, cost) => ({ name, ip, mask: "255.255.255.252", area: 0, seg, cost: cost || 1 });
  /* a square: edge on top, two cores, a distribution switch below; the distribution switch has a /24 of its own */
  const R = (c) => ({
    edge: { rid: "1.1.1.1", originate: true, ifs: [f("Gi0/2", "10.9.255.5", "s1"), f("Gi0/3", "10.9.255.9", "s2")] },
    core1: { rid: "2.2.2.2", ifs: [f("Gi0/24", "10.9.255.6", "s1"), f("Gi0/1", "10.9.255.17", "s3", c)] },
    core2: { rid: "3.3.3.3", ifs: [f("Gi0/24", "10.9.255.10", "s2"), f("Gi0/1", "10.9.255.21", "s4")] },
    dist1: { rid: "4.4.4.4", ifs: [f("Gi0/19", "10.9.255.18", "s3", c), f("Gi0/20", "10.9.255.22", "s4"), { name: "Vlan10", ip: "10.9.10.1", mask: "255.255.255.0", area: 0, passive: true, cost: 1 }] } });
  let out = solve(R(1));
  const d = out.routes.dist1.find((r) => r.net === "0.0.0.0"), v = out.routes.edge.find((r) => r.net === "10.9.10.0");
  assert.deepEqual(d.paths.map((h) => h.nh), ["10.9.255.17", "10.9.255.21"], "the default by both cores"); assert.equal(d.nh, "10.9.255.17");
  assert.deepEqual(v.paths.map((h) => h.nh + " " + h.iface), ["10.9.255.6 Gi0/2", "10.9.255.10 Gi0/3"], "the VLAN by both cores"); assert.equal(v.metric, 3);
  const T = routeTable([{ name: "Gi0/19", ip: "10.9.255.18", mask: "255.255.255.252", up: true }, { name: "Gi0/20", ip: "10.9.255.22", mask: "255.255.255.252", up: true }], [], out.routes.dist1.map((r) => Object.assign({ ad: 110 }, r)));
  const L = routeLines(T, true).join("\n");
  assert.match(L, /^O\*E2     0\.0\.0\.0\/0 \[110\/1\] via 10\.9\.255\.17, Gi0\/19\n {19}\[110\/1\] via 10\.9\.255\.21, Gi0\/20$/m, L);
  /* a network two routers have at the same cost (a VLAN on both distribution switches): both kept, one path from each */
  const R2 = R(1); R2.dist2 = { rid: "5.5.5.5", ifs: [f("Gi0/19", "10.9.255.26", "s5"), { name: "Vlan10", ip: "10.9.10.3", mask: "255.255.255.0", area: 0, passive: true, cost: 1 }] }; R2.core1.ifs.push(f("Gi0/2", "10.9.255.25", "s5"));
  const c1 = solve(R2).routes.core1.find((r) => r.net === "10.9.10.0");
  assert.deepEqual(c1.paths.map((h) => h.nh), ["10.9.255.18", "10.9.255.26"], "core 1 reaches the VLAN by both distribution switches"); assert.equal(c1.metric, 2);
  out = solve(R(10));   /* core 1's link to the distribution switch made dearer: only core 2's way is left for it */
  assert.deepEqual(out.routes.dist1.find((r) => r.net === "0.0.0.0").paths.map((h) => h.nh), ["10.9.255.21"]);
  assert.deepEqual(out.routes.edge.find((r) => r.net === "10.9.10.0").paths.map((h) => h.nh), ["10.9.255.10"]);
});
