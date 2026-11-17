/* Level 4, the campus: first-hop redundancy with standby. An access switch (a PC in VLAN 10, a printer in VLAN 20) trunked to two
   layer 3 distribution switches, which are trunked to each other too; each has VLAN interfaces 10 and 20 (.2 and .3), and the
   hosts' gateway is the virtual address .1, standby groups 10 and 20. Every result is what the network itself works out. */
import test from "node:test";
import assert from "node:assert/strict";
import { Sim } from "../js/net/sim.js";
import * as C from "../js/net/swcli.js";

const host = (id, kind, ip, gw, mac) => ({ id: id, kind: kind, label: id, on: true, os: kind === "pc" ? "windows" : undefined, ifaces: [{ name: "Ethernet", type: "eth", port: kind === "pc" ? "NIC" : "NET", mac: mac, cfg: { mode: "static", ip: ip, mask: "255.255.255.0", gw: gw, dns: [] }, lease: null, apipa: null }] });
const cab = (id, a, ap, b, bp) => ({ id: id, kind: "cat6", a: { dev: a, port: ap, seated: true }, b: { dev: b, port: bp, seated: true }, cond: "good", length: 10 });
const swd = (id, mac, l3) => ({ id: id, kind: "mswitch", label: id, on: true, mac: mac, sw: C.newSwitch({ l3: l3, mac: mac }) });
function net() {
  return { seed: 1, site: "campus", isp: { up: true, outage: false, gw: "198.51.100.1", core: "203.0.113.1", dns: [], wanIp: "198.51.100.9", mask: "255.255.255.0" },
    devices: { asw: swd("asw", "00e0.4c07.0003", false), dsw1: swd("dsw1", "00e0.4c07.0001", true), dsw2: swd("dsw2", "00e0.4c07.0002", true),
      pc1: host("pc1", "pc", "10.1.10.11", "10.1.10.1", "aa-00-00-00-05-01"), printer: host("printer", "printer", "10.1.20.20", "10.1.20.1", "aa-00-00-00-05-02") },
    cables: [cab("c1", "asw", "23", "dsw1", "23"), cab("c2", "asw", "24", "dsw2", "23"), cab("c3", "dsw1", "24", "dsw2", "24"), cab("c4", "asw", "1", "pc1", "NIC"), cab("c5", "asw", "2", "printer", "NET")],
    neighbours: [], ports: {}, rooms: {}, extra: { build: true } };
}
const live = (sim, id) => ({ live: sim.swLive(id) });
function cli(sim, id, lines) { sim.syncSwitch(id); const S = C.session(sim.d[id].sw, live(sim, id)); C.exec(S, ""); C.exec(S, "enable"); C.exec(S, "configure terminal"); const out = lines.map((l) => C.exec(S, l).out).flat(); C.exec(S, "end"); sim.relink({}); return out; }
const show = (sim, id, line) => { sim.syncSwitch(id); const S = C.session(sim.d[id].sw, live(sim, id)); C.exec(S, ""); C.exec(S, "enable"); return C.exec(S, line).out.join("\n"); };
const dist = (host, extra) => ["ip routing", "vlan 10", "vlan 20", "interface range gi0/23 - 24", "switchport mode trunk",
  "interface vlan 10", "ip address 10.1.10." + host + " 255.255.255.0", "no shutdown", "standby 10 ip 10.1.10.1",
  "interface vlan 20", "ip address 10.1.20." + host + " 255.255.255.0", "no shutdown", "standby 20 ip 10.1.20.1", "exit"].concat(extra || []);
function built(e1, e2) {
  const sim = new Sim(net());
  cli(sim, "asw", ["vlan 10", "vlan 20", "interface range gi0/23 - 24", "switchport mode trunk", "interface gi0/1", "switchport mode access", "switchport access vlan 10", "interface gi0/2", "switchport mode access", "switchport access vlan 20", "exit"]);
  cli(sim, "dsw1", dist(2, e1)); cli(sim, "dsw2", dist(3, e2)); return sim;
}
const power = (sim, id, on) => { sim.d[id].on = on; sim.relink({}); };

test("the higher priority is active, the other standby; the hosts' gateway answers from the active one, and routing goes through it", () => {
  const sim = built(["interface vlan 10", "standby 10 priority 110", "standby 10 preempt", "interface vlan 20", "standby 20 priority 110", "exit"]);
  const b = show(sim, "dsw1", "show standby brief");
  assert.match(b, /Vl10\s+10\s+110 P Active  local\s+10\.1\.10\.3\s+10\.1\.10\.1/, b);
  assert.match(show(sim, "dsw2", "show standby brief"), /Vl10\s+10\s+100\s+Standby 10\.1\.10\.2\s+local\s+10\.1\.10\.1/);
  const g = sim.route("pc1", "10.1.10.1"); assert.equal(g.local, true); assert.deepEqual(g.owner, ["dsw1"]);
  const r = sim.route("pc1", "10.1.20.20"); assert.equal(r.routed, true, JSON.stringify(r)); assert.equal(r.via, "dsw1");
});

test("the active switch fails: the standby takes over the virtual address, and the hosts never notice", () => {
  const sim = built(["interface vlan 10", "standby 10 priority 110", "standby 10 preempt", "exit"]);
  power(sim, "dsw1", false);
  assert.match(show(sim, "dsw2", "show standby brief"), /Vl10\s+10\s+100\s+Active  local/);
  assert.deepEqual(sim.route("pc1", "10.1.10.1").owner, ["dsw2"]); assert.equal(sim.route("pc1", "10.1.20.20").via, "dsw2");
  const s2 = built(["interface vlan 10", "standby 10 priority 110", "standby 10 preempt", "exit"]);
  cli(s2, "dsw1", ["interface vlan 10", "shutdown"]);   /* the switch stays up; only its interface on the VLAN goes down */
  assert.deepEqual(s2.route("pc1", "10.1.10.1").owner, ["dsw2"], "the standby takes over when the active one's interface goes down");
  assert.match(show(s2, "dsw1", "show standby brief"), /Vl10\s+10\s+110 P Init/);
  const s3 = built(["interface vlan 10", "standby 10 priority 110", "standby 10 preempt", "exit"]);
  cli(s3, "dsw1", ["interface vlan 10", "no ip address"]);   /* the interface stays up, its standby settings stay, its address gone */
  assert.deepEqual(s3.route("pc1", "10.1.10.1").owner, ["dsw2"], "an interface with no address can't be the active router");
});

test("preempt: back with the higher priority it takes over again only with preempt set; without it the other stays active", () => {
  let sim = built(["interface vlan 10", "standby 10 priority 110", "standby 10 preempt", "exit"]);
  power(sim, "dsw1", false); power(sim, "dsw1", true);
  assert.deepEqual(sim.route("pc1", "10.1.10.1").owner, ["dsw1"], "preempt: it takes the address back");
  sim = built(["interface vlan 10", "standby 10 priority 110", "exit"]);
  power(sim, "dsw1", false); power(sim, "dsw1", true);
  assert.deepEqual(sim.route("pc1", "10.1.10.1").owner, ["dsw2"], "no preempt: the other stays active");
  assert.match(show(sim, "dsw1", "show standby brief"), /Vl10\s+10\s+110\s+Standby 10\.1\.10\.3\s+local/);
});

test("equal priorities: the first up stays active; both up together, the higher interface address wins; a virtual address outside the subnet is refused", () => {
  const sim = built();
  assert.deepEqual(sim.route("pc1", "10.1.10.1").owner, ["dsw1"], "configured first, it went active alone, and with no preempt it stays");
  sim.d.dsw1.on = false; sim.d.dsw2.on = false; sim.relink({}); sim.d.dsw1.on = true; sim.d.dsw2.on = true; sim.relink({});   /* a power cut: both come back together */
  assert.deepEqual(sim.route("pc1", "10.1.10.1").owner, ["dsw2"], ".3 beats .2");
  assert.match(cli(sim, "dsw1", ["interface vlan 10", "standby 11 ip 10.9.9.1"]).join("\n"), /not within subnet/);
});

test("the configuration carries it; a switch that isn't layer 3 has no standby; with no gateway configured the hosts reach nothing", () => {
  const sim = built(["interface vlan 10", "standby 10 priority 110", "standby 10 preempt", "exit"]);
  assert.match(show(sim, "dsw1", "show running-config"), /interface Vlan10\n ip address 10\.1\.10\.2 255\.255\.255\.0\n standby 10 ip 10\.1\.10\.1\n standby 10 priority 110\n standby 10 preempt\n!/);
  const l2 = C.session(C.newSwitch()); C.exec(l2, ""); C.exec(l2, "enable"); C.exec(l2, "configure terminal"); C.exec(l2, "interface vlan 10");
  assert.match(C.exec(l2, "standby 10 ip 10.1.10.1").out.join("\n"), /Invalid input/);
  const s2 = built(); cli(s2, "dsw1", ["interface vlan 10", "no standby 10"]); cli(s2, "dsw2", ["interface vlan 10", "no standby 10"]);
  assert.ok(s2.route("pc1", "10.1.20.20").fail, "no virtual address anywhere: the PC's gateway answers nobody");
});

test("a check never changes the network", () => {
  const sim = built(["interface vlan 10", "standby 10 priority 110", "exit"]);
  ["asw", "dsw1", "dsw2"].forEach((id) => sim.syncSwitch(id));   /* the consoles' stored link details fresh first (opening a console does it) */
  const before = JSON.parse(JSON.stringify(sim.net));
  show(sim, "dsw1", "show standby brief"); sim.route("pc1", "10.1.20.20"); sim.hsrpState(); sim.hsrpVips("dsw1");
  const after = JSON.parse(JSON.stringify(sim.net)), diff = [];
  const walk = (a, b, path) => { if (JSON.stringify(a) === JSON.stringify(b)) return; if (a && b && typeof a === "object" && typeof b === "object") { new Set(Object.keys(a).concat(Object.keys(b))).forEach((k) => walk(a[k], b[k], path + "." + k)); return; } diff.push(path + ": " + JSON.stringify(a) + " -> " + JSON.stringify(b)); };
  walk(before, after, "net"); assert.deepEqual(diff, []);
});
