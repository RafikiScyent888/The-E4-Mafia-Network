/* Level 4, the campus: the simulation routing through layer 3 switches. A small test network (not the campus's own, which
   comes with its work orders): two MSW-3900X switches joined by a routed link on their port 24 (10.0.0.0/30); on the first,
   a PC in VLAN 10 and one in VLAN 20; on the second, a printer in VLAN 30. Everything is configured through the real command
   line, and every result is what the network itself works out. */
import test from "node:test";
import assert from "node:assert/strict";
import { Sim } from "../js/net/sim.js";
import * as C from "../js/net/swcli.js";
import { exec } from "../js/net/cmd.js";

const host = function (id, kind, ip, gw, mac) { return { id: id, kind: kind, label: id, on: true, os: kind === "pc" ? "windows" : undefined, ifaces: [{ name: "Ethernet", type: "eth", port: kind === "pc" ? "NIC" : "NET", mac: mac, cfg: { mode: "static", ip: ip, mask: "255.255.255.0", gw: gw, dns: [] }, lease: null, apipa: null }] }; };
const cab = function (id, a, ap, b, bp) { return { id: id, kind: "cat6", a: { dev: a, port: ap, seated: true }, b: { dev: b, port: bp, seated: true }, cond: "good", length: 10 }; };
function net() {
  return {
    seed: 1, site: "campus", isp: { up: true, outage: false, gw: "198.51.100.1", core: "203.0.113.1", dns: [], wanIp: "198.51.100.9", mask: "255.255.255.0" },
    devices: {
      dsw1: { id: "dsw1", kind: "mswitch", label: "Distribution switch 1", on: true, mac: "00e0.4c03.0001", sw: C.newSwitch({ l3: true, mac: "00e0.4c03.0001" }) },
      dsw2: { id: "dsw2", kind: "mswitch", label: "Distribution switch 2", on: true, mac: "00e0.4c03.0002", sw: C.newSwitch({ l3: true, mac: "00e0.4c03.0002" }) },
      pc1: host("pc1", "pc", "10.1.10.11", "10.1.10.1", "aa-00-00-00-01-01"), pc2: host("pc2", "pc", "10.1.20.11", "10.1.20.1", "aa-00-00-00-01-02"),
      printer: host("printer", "printer", "10.1.30.20", "10.1.30.1", "aa-00-00-00-01-03")
    },
    cables: [cab("c-pc1", "dsw1", "1", "pc1", "NIC"), cab("c-pc2", "dsw1", "2", "pc2", "NIC"), cab("c-pr", "dsw2", "1", "printer", "NET"), cab("c-link", "dsw1", "24", "dsw2", "24")],
    neighbours: [], ports: {}, rooms: {}, extra: { build: true }
  };
}
/* configure a switch through its own console, its links fresh first (as the simulation keeps them) */
function cli(sim, id, lines) { sim.syncSwitch(id); const S = C.session(sim.d[id].sw); C.exec(S, ""); C.exec(S, "enable"); C.exec(S, "configure terminal"); const out = lines.map((l) => C.exec(S, l).out).flat(); C.exec(S, "end"); return out; }
const D1 = ["vlan 10", "vlan 20", "interface gi0/1", "switchport mode access", "switchport access vlan 10", "interface gi0/2", "switchport mode access", "switchport access vlan 20",
  "interface vlan 10", "ip address 10.1.10.1 255.255.255.0", "no shutdown", "interface vlan 20", "ip address 10.1.20.1 255.255.255.0", "no shutdown",
  "interface gi0/24", "no switchport", "ip address 10.0.0.1 255.255.255.252", "exit"];
const D2 = ["vlan 30", "interface gi0/1", "switchport mode access", "switchport access vlan 30", "interface vlan 30", "ip address 10.1.30.1 255.255.255.0", "no shutdown",
  "interface gi0/24", "no switchport", "ip address 10.0.0.2 255.255.255.252", "exit"];
function built() { const sim = new Sim(net()); cli(sim, "dsw1", D1); cli(sim, "dsw2", D2); return sim; }

test("between two VLANs on one switch: nothing until ip routing; then routed, one hop, the reply back through the same switch", () => {
  const sim = built();
  let r = sim.route("pc1", "10.1.20.11"); assert.ok(r.fail, "routing off: the switch's VLAN interface answers ARP but routes nothing (" + JSON.stringify(r) + ")");
  cli(sim, "dsw1", ["ip routing"]);
  r = sim.route("pc1", "10.1.20.11");
  assert.equal(r.routed, true, JSON.stringify(r)); assert.deepEqual(r.owner, ["pc2"]); assert.deepEqual(r.hops, ["10.1.10.1", "10.1.20.11"]); assert.equal(r.routers, 1); assert.equal(r.via, "dsw1");
  assert.equal(sim.route("pc1", "10.1.10.1").local, true, "the gateway itself answers");
  const o = sim.route("pc1", "10.1.20.1"); assert.equal(o.local, true, "the switch's other VLAN interface: the gateway itself answers, nothing routed"); assert.deepEqual(o.owner, ["dsw1"]);
});

test("across a routed link: no route says so; a route there but none back gets no reply; routes both ways work, two switches crossed", () => {
  const sim = built(); cli(sim, "dsw1", ["ip routing"]); cli(sim, "dsw2", ["ip routing"]);
  let r = sim.route("pc1", "10.1.30.20");
  assert.equal(r.fail, "net-unreachable", JSON.stringify(r)); assert.equal(r.hops[0], "10.1.10.1", "the first switch reports it has no route");
  cli(sim, "dsw1", ["ip route 10.1.30.0 255.255.255.0 10.0.0.2"]);
  r = sim.route("pc1", "10.1.30.20"); assert.equal(r.fail, "no-reply", JSON.stringify(r)); assert.equal(r.why, "no way back", "the far switch has no route back to VLAN 10");
  cli(sim, "dsw2", ["ip route 10.1.10.0 255.255.255.0 10.0.0.1"]);
  r = sim.route("pc1", "10.1.30.20");
  assert.equal(r.routed, true, JSON.stringify(r)); assert.deepEqual(r.owner, ["printer"]); assert.deepEqual(r.hops, ["10.1.10.1", "10.0.0.2", "10.1.30.20"]); assert.equal(r.routers, 2);
  assert.ok(sim.route("pc2", "10.1.30.20").fail, "VLAN 20 has no route back from the far switch");
  cli(sim, "dsw2", ["no ip route 10.1.10.0 255.255.255.0 10.0.0.1", "ip route 0.0.0.0 0.0.0.0 10.0.0.1"]);
  assert.equal(sim.route("pc2", "10.1.30.20").routed, true, "a default route back serves both VLANs");
});

test("ping through them: the printer replies with its TTL two less; tracert lists each switch; the switch's own ping crosses too", () => {
  const sim = built(); cli(sim, "dsw1", ["ip routing", "ip route 10.1.30.0 255.255.255.0 10.0.0.2"]); cli(sim, "dsw2", ["ip routing", "ip route 0.0.0.0 0.0.0.0 10.0.0.1"]);
  const p = exec(sim, "pc1", "ping 10.1.30.20");
  assert.match(p.out, /Reply from 10\.1\.30\.20: bytes=32 time[=<]\d*ms TTL=62/, p.out);
  const t = exec(sim, "pc1", "tracert 10.1.30.20").out;
  assert.match(t, /10\.1\.10\.1/); assert.match(t, /10\.0\.0\.2/); assert.match(t, /10\.1\.30\.20/);
  const own = sim.route("dsw1", "10.1.30.20"); assert.equal(own.routed, true, "the switch's own packet, by its own table: " + JSON.stringify(own)); assert.deepEqual(own.owner, ["printer"]);
  sim.syncSwitch("dsw1"); const S = C.session(sim.d.dsw1.sw, { reach: (ip) => { const r = sim.route("dsw1", ip); return !r.fail && !!(r.local || r.routed); } });   /* the reach a console session is given (cmd.js) */
  C.exec(S, ""); C.exec(S, "enable"); assert.match(C.exec(S, "ping 10.1.30.20").out.join("\n"), /!!!!!/);
  cli(sim, "dsw2", ["no ip route 0.0.0.0 0.0.0.0 10.0.0.1"]);
  assert.match(exec(sim, "pc1", "ping 10.1.30.20").out, /Request timed out/);
});

test("a routed port carries no VLAN: VLAN 10 doesn't reach the far switch, and the link shut stops the routes through it", () => {
  const sim = built(); cli(sim, "dsw1", ["ip routing", "ip route 10.1.30.0 255.255.255.0 10.0.0.2"]); cli(sim, "dsw2", ["ip routing", "ip route 0.0.0.0 0.0.0.0 10.0.0.1"]);
  const dom = sim.domain(sim.homeNode("pc1"));
  assert.ok(![...dom].some((n) => /^dsw2/.test(n)), "nothing of the far switch in VLAN 10's broadcast domain: " + [...dom].join(", "));
  assert.ok(dom.has("dsw1:v10"));
  cli(sim, "dsw2", ["interface gi0/24", "shutdown"]);
  const r = sim.route("pc1", "10.1.30.20"); assert.ok(r.fail, JSON.stringify(r));
});

test("a routing loop: two switches pointing a network at each other: no reply, for the loop", () => {
  const sim = built();
  cli(sim, "dsw1", ["ip routing", "ip route 10.9.0.0 255.255.0.0 10.0.0.2"]); cli(sim, "dsw2", ["ip routing", "ip route 10.9.0.0 255.255.0.0 10.0.0.1"]);
  const r = sim.route("pc1", "10.9.1.1"); assert.equal(r.fail, "no-reply", JSON.stringify(r)); assert.equal(r.why, "loop");
});

test("a check never changes the network", () => {
  const sim = built(); cli(sim, "dsw1", ["ip routing", "ip route 10.1.30.0 255.255.255.0 10.0.0.2"]); cli(sim, "dsw2", ["ip routing", "ip route 0.0.0.0 0.0.0.0 10.0.0.1"]);
  const before = JSON.stringify(sim.net) + JSON.stringify(sim.arp || {});
  ["10.1.30.20", "10.1.20.11", "10.9.9.9", "10.0.0.2"].forEach((ip) => { sim.route("pc1", ip); sim.route("dsw1", ip); });
  assert.equal(JSON.stringify(sim.net) + JSON.stringify(sim.arp || {}), before);
});
