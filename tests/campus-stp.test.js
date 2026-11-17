/* Level 4, the campus: spanning tree (rapid, per VLAN). Three switches in a triangle, every link a trunk carrying VLAN 10:
   two layer 3 distribution switches (dsw1 gi0/24 to dsw2 gi0/24) and an access switch with the lowest address (asw gi0/23 to
   dsw1 gi0/23, asw gi0/24 to dsw2 gi0/23); a PC in VLAN 10 on the access switch and one on dsw2. Left at its defaults the
   access switch is root, as on the real thing; the priority moves it. Every result is what the network itself works out. */
import test from "node:test";
import assert from "node:assert/strict";
import { Sim } from "../js/net/sim.js";
import * as C from "../js/net/swcli.js";

const pc = function (id, ip, mac) { return { id: id, kind: "pc", label: id, on: true, os: "windows", ifaces: [{ name: "Ethernet", type: "eth", port: "NIC", mac: mac, cfg: { mode: "static", ip: ip, mask: "255.255.255.0", gw: "10.1.10.1", dns: [] }, lease: null, apipa: null }] }; };
const cab = function (id, a, ap, b, bp) { return { id: id, kind: "cat6", a: { dev: a, port: ap, seated: true }, b: { dev: b, port: bp, seated: true }, cond: "good", length: 10 }; };
const swd = (id, label, mac, l3) => ({ id: id, kind: "mswitch", label: label, on: true, mac: mac, sw: C.newSwitch({ l3: l3, mac: mac }) });
function net(extra) {
  return { seed: 1, site: "campus", isp: { up: true, outage: false, gw: "198.51.100.1", core: "203.0.113.1", dns: [], wanIp: "198.51.100.9", mask: "255.255.255.0" },
    devices: { asw: swd("asw", "Access switch", "00e0.4c05.0001", false), dsw1: swd("dsw1", "Distribution switch 1", "00e0.4c05.0002", true), dsw2: swd("dsw2", "Distribution switch 2", "00e0.4c05.0003", true),
      pc1: pc("pc1", "10.1.10.11", "aa-00-00-00-03-01"), pc2: pc("pc2", "10.1.10.12", "aa-00-00-00-03-02") },
    cables: [cab("c-d1d2", "dsw1", "24", "dsw2", "24"), cab("c-ad1", "asw", "23", "dsw1", "23"), cab("c-ad2", "asw", "24", "dsw2", "23"), cab("c-pc1", "asw", "1", "pc1", "NIC"), cab("c-pc2", "dsw2", "1", "pc2", "NIC")].concat(extra || []),
    neighbours: [], ports: {}, rooms: {}, extra: { build: true } };
}
const live = (sim, id) => ({ live: sim.swLive(id) });
function cli(sim, id, lines) { sim.syncSwitch(id); const S = C.session(sim.d[id].sw, live(sim, id)); C.exec(S, ""); C.exec(S, "enable"); C.exec(S, "configure terminal"); const out = lines.map((l) => C.exec(S, l).out).flat(); C.exec(S, "end"); return out; }
const show = (sim, id, line) => { sim.syncSwitch(id); const S = C.session(sim.d[id].sw, live(sim, id)); C.exec(S, ""); C.exec(S, "enable"); return C.exec(S, line).out.join("\n"); };
const TRUNKS = { asw: ["gi0/23", "gi0/24"], dsw1: ["gi0/23", "gi0/24"], dsw2: ["gi0/23", "gi0/24"] };
function built(extra) {
  const sim = new Sim(net(extra));
  Object.keys(TRUNKS).forEach((id) => cli(sim, id, ["vlan 10"].concat(TRUNKS[id].flatMap((n) => ["interface " + n, "switchport mode trunk"])).concat(id === "asw" ? ["interface gi0/1", "switchport mode access", "switchport access vlan 10"] : id === "dsw2" ? ["interface gi0/1", "switchport mode access", "switchport access vlan 10"] : [])));
  return sim;
}
const pathVia = (sim) => sim.l2Path(sim.homeNode("pc2"), sim.homeNode("pc1")).map((h) => h.dev);

test("left at its defaults, the switch with the lowest address is root; one port between the others blocks", () => {
  const sim = built();
  const a = show(sim, "asw", "show spanning-tree vlan 10");
  assert.match(a, /VLAN0010\n  Spanning tree enabled protocol rstp\n  Root ID    Priority    32778\n             Address     00e0\.4c05\.0001\n             This bridge is the root/, a);
  const d2 = show(sim, "dsw2", "show spanning-tree vlan 10");
  assert.match(d2, /Gi0\/24\s+Altn BLK 4\s+128\.24/, "dsw2's link to dsw1 blocks: dsw1 has the lower bridge ID\n" + d2);
  assert.match(d2, /Gi0\/23\s+Root FWD 4\s+128\.23/); assert.match(d2, /Gi0\/1\s+Desg FWD 4\s+128\.1\s+P2p/);
  assert.match(d2, /Bridge ID  Priority    32778  \(priority 32768 sys-id-ext 10\)/);
  assert.match(show(sim, "dsw1", "show spanning-tree vlan 10"), /Gi0\/24\s+Desg FWD/);
});

test("root primary on dsw1: 24576, it's root, and the blocked port moves to the access switch's far side; frames go the forwarding way", () => {
  const sim = built();
  assert.deepEqual(pathVia(sim), ["dsw2", "asw"], "before: straight across");
  cli(sim, "dsw1", ["spanning-tree vlan 10 root primary"]);
  assert.match(show(sim, "dsw1", "show running-config"), /\nspanning-tree vlan 10 priority 24576\n/);
  assert.match(show(sim, "dsw1", "show spanning-tree vlan 10"), /Priority    24586\n             Address     00e0\.4c05\.0002\n             This bridge is the root/);
  assert.match(show(sim, "dsw2", "show spanning-tree vlan 10"), /Gi0\/23\s+Altn BLK/, "dsw2 to the access switch now blocks (the access switch has the lower ID)");
  assert.deepEqual(pathVia(sim), ["dsw2", "dsw1", "asw"], "the blocked link carries nothing: VLAN 10 goes round by the root");
  assert.ok(sim.route("pc2", "10.1.10.11").local, "and still gets there");
});

test("root primary goes under a root that's already lower; priorities only in 4096s; secondary is 28672; no takes it away", () => {
  const sim = built();
  cli(sim, "asw", ["spanning-tree vlan 10 priority 8192"]);
  cli(sim, "dsw1", ["spanning-tree vlan 10 root primary"]);
  assert.match(show(sim, "dsw1", "show running-config"), /spanning-tree vlan 10 priority 4096\n/);
  assert.match(cli(sim, "dsw2", ["spanning-tree vlan 10 priority 1000"]).join("\n"), /increments of 4096/);
  cli(sim, "dsw2", ["spanning-tree vlan 10 root secondary"]); assert.match(show(sim, "dsw2", "show running-config"), /spanning-tree vlan 10 priority 28672/);
  cli(sim, "dsw2", ["no spanning-tree vlan 10"]); assert.doesNotMatch(show(sim, "dsw2", "show running-config"), /spanning-tree vlan 10/);
});

test("a port-channel is one port: two cables bundled between the distribution switches never block each other", () => {
  const sim = built([cab("c-d1d2b", "dsw1", "22", "dsw2", "22")]);
  ["dsw1", "dsw2"].forEach((id) => cli(sim, id, ["interface range gi0/22 , gi0/24", "switchport mode trunk", "channel-group 1 mode active"]));
  const d2 = show(sim, "dsw2", "show spanning-tree vlan 10");
  assert.match(d2, /Po1\s+Altn BLK 3\s+128\.101/, "one port, its cost the bundle's\n" + d2);
  assert.doesNotMatch(d2, /Gi0\/22|Gi0\/24 /, "its members aren't ports of their own");
});

test("portfast marks an edge port; BPDU guard err-disables a port that hears a switch, until it's shut and opened with the guard off", () => {
  const sim = built();
  assert.match(cli(sim, "asw", ["interface gi0/1", "spanning-tree portfast"]).join("\n"), /portfast should only be enabled on ports connected to a single/);
  assert.match(show(sim, "asw", "show spanning-tree vlan 10"), /Gi0\/1\s+Desg FWD 4\s+128\.1\s+P2p Edge/);
  cli(sim, "asw", ["interface gi0/1", "spanning-tree bpduguard enable"]); sim.bpduGuard();
  assert.doesNotMatch(show(sim, "asw", "show interfaces status"), /err-disabled/, "a PC sends no BPDUs");
  cli(sim, "asw", ["interface gi0/24", "spanning-tree bpduguard enable"]); sim.bpduGuard();
  assert.match(show(sim, "asw", "show interfaces status | include Gi0/24"), /err-disabled/);
  assert.match(show(sim, "asw", "show running-config"), /interface GigabitEthernet0\/24\n switchport mode trunk\n spanning-tree bpduguard enable\n/);
  cli(sim, "asw", ["interface gi0/24", "no spanning-tree bpduguard", "shutdown", "no shutdown"]); sim.bpduGuard();
  assert.doesNotMatch(show(sim, "asw", "show interfaces status | include Gi0/24"), /err-disabled/);
});

test("with no loop possible nothing is worked out for blocking (the office's and the business's networks as they always were); pvst mode says ieee", () => {
  const n = net(); n.cables = n.cables.filter((c) => c.id !== "c-ad2"); const sim = new Sim(n);
  assert.equal(sim.stpLoops(), false); sim.edges(); assert.equal(sim._stpNow, null);
  assert.equal(built().stpLoops(), true);
  const s2 = built(); cli(s2, "asw", ["spanning-tree mode pvst"]); assert.match(show(s2, "asw", "show spanning-tree vlan 10"), /protocol ieee/);
  assert.match(show(s2, "asw", "show running-config"), /\nspanning-tree mode pvst\n/);
});

test("a check never changes the network", () => {
  const sim = built(); cli(sim, "dsw1", ["spanning-tree vlan 10 root primary"]);
  const before = JSON.stringify(sim.net);
  show(sim, "dsw2", "show spanning-tree"); sim.route("pc2", "10.1.10.11"); sim.stpAll(); pathVia(sim);
  assert.equal(JSON.stringify(sim.net), before);
});
