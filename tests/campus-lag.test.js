/* Level 4, the campus: link aggregation (LACP). Two switches (an access switch MSW-2800G and a layer 3 MSW-3900X) joined by
   two cables, port 23 to 23 and 24 to 24, bundled into Port-channel 1 as a trunk; a PC in VLAN 10 on each. The bundle's state
   is what both ends work out: active with active or passive bundles, passive with passive never does, on bundles without
   asking, a member whose VLAN settings aren't the port-channel's is suspended and carries nothing. */
import test from "node:test";
import assert from "node:assert/strict";
import { Sim } from "../js/net/sim.js";
import * as C from "../js/net/swcli.js";

const pc = function (id, ip, mac) { return { id: id, kind: "pc", label: id, on: true, os: "windows", ifaces: [{ name: "Ethernet", type: "eth", port: "NIC", mac: mac, cfg: { mode: "static", ip: ip, mask: "255.255.255.0", gw: "10.1.10.1", dns: [] }, lease: null, apipa: null }] }; };
const cab = function (id, a, ap, b, bp) { return { id: id, kind: "cat6", a: { dev: a, port: ap, seated: true }, b: { dev: b, port: bp, seated: true }, cond: "good", length: 10 }; };
function net() {
  return { seed: 1, site: "campus", isp: { up: true, outage: false, gw: "198.51.100.1", core: "203.0.113.1", dns: [], wanIp: "198.51.100.9", mask: "255.255.255.0" },
    devices: { asw: { id: "asw", kind: "mswitch", label: "Access switch", on: true, mac: "00e0.4c04.0001", sw: C.newSwitch({ mac: "00e0.4c04.0001" }) },
      dsw: { id: "dsw", kind: "mswitch", label: "Distribution switch", on: true, mac: "00e0.4c04.0002", sw: C.newSwitch({ l3: true, mac: "00e0.4c04.0002" }) },
      other: { id: "other", kind: "mswitch", label: "Another switch", on: true, mac: "00e0.4c04.0003", sw: C.newSwitch({ mac: "00e0.4c04.0003" }) },
      pc1: pc("pc1", "10.1.10.11", "aa-00-00-00-02-01"), pc2: pc("pc2", "10.1.10.12", "aa-00-00-00-02-02") },
    cables: [cab("c-a23", "asw", "23", "dsw", "23"), cab("c-a24", "asw", "24", "dsw", "24"), cab("c-pc1", "asw", "1", "pc1", "NIC"), cab("c-pc2", "dsw", "1", "pc2", "NIC")],
    neighbours: [], ports: {}, rooms: {}, extra: { build: true } };
}
function cli(sim, id, lines) { sim.syncSwitch(id); const S = C.session(sim.d[id].sw); C.exec(S, ""); C.exec(S, "enable"); C.exec(S, "configure terminal"); const out = lines.map((l) => C.exec(S, l).out).flat(); C.exec(S, "end"); sim.syncSwitch(id); return out; }
const show = (sim, id, line) => { sim.syncSwitch(id); const S = C.session(sim.d[id].sw); C.exec(S, ""); C.exec(S, "enable"); return C.exec(S, line).out.join("\n"); };
const side = (mode) => ["vlan 10", "interface gi0/1", "switchport mode access", "switchport access vlan 10", "interface range gi0/23 - 24", "switchport mode trunk", "channel-group 1 mode " + mode, "exit"];
function built(a, d) { const sim = new Sim(net()); cli(sim, "asw", side(a)); cli(sim, "dsw", side(d)); sim.syncSwitch("asw"); sim.syncSwitch("dsw"); return sim; }
const reach = (sim) => !!sim.route("pc1", "10.1.10.12").local;

test("channel-group makes the port-channel once, on either switch; the configuration carries it", () => {
  const sim = new Sim(net());
  const out = cli(sim, "asw", side("active"));
  assert.equal(out.filter((l) => /Creating a port-channel interface Port-channel 1/.test(l)).length, 1, out.join("\n"));
  const run = show(sim, "asw", "show running-config");
  assert.match(run, /interface Port-channel1\n switchport mode trunk\n!/); assert.match(run, /interface GigabitEthernet0\/23\n switchport mode trunk\n channel-group 1 mode active\n/);
  assert.match(cli(sim, "dsw", ["interface gi0/5", "channel-group 49 mode active"]).join("\n"), /Invalid input/);
  assert.match(cli(sim, "dsw", ["interface gi0/5", "channel-group 2 mode desirable"]).join("\n"), /Invalid input/, "no proprietary modes on our switch");
});

test("active with active: both bundled, the port-channel up with twice the bandwidth, the PCs reach each other", () => {
  const sim = built("active", "active");
  const sum = show(sim, "asw", "show etherchannel summary");
  assert.match(sum, /1      Po1\(SU\)\s+LACP\s+Gi0\/23\(P\)   Gi0\/24\(P\)/, sum);
  assert.match(show(sim, "dsw", "show interfaces port-channel 1"), /BW 2000000 Kbit\/sec/);
  assert.ok(reach(sim));
});

test("active with passive bundles; passive with passive never does (each port stand-alone, the port-channel down)", () => {
  assert.match(show(built("active", "passive"), "dsw", "show etherchannel summary"), /Po1\(SU\).*Gi0\/23\(P\)   Gi0\/24\(P\)/);
  const sim = built("passive", "passive"), sum = show(sim, "asw", "show etherchannel summary");
  assert.match(sum, /Po1\(SD\).*Gi0\/23\(I\)   Gi0\/24\(I\)/, sum);
  assert.match(show(sim, "asw", "show interfaces port-channel 1"), /Port-channel1 is down/);
});

test("on with active: the on end bundles without asking, the active end hears nobody and stands alone", () => {
  const sim = built("on", "active");
  assert.match(show(sim, "asw", "show etherchannel summary"), /Po1\(SU\)\s+-\s+Gi0\/23\(P\)   Gi0\/24\(P\)/);
  assert.match(show(sim, "dsw", "show etherchannel summary"), /Po1\(SD\)\s+LACP\s+Gi0\/23\(I\)   Gi0\/24\(I\)/);
});

test("a member whose VLAN settings aren't the port-channel's is suspended: line protocol down, it carries nothing, half the bandwidth", () => {
  const sim = built("active", "active");
  cli(sim, "asw", ["interface gi0/24", "switchport trunk allowed vlan 10,20"]);   /* typed on the member, not the port-channel: still a trunk carrying VLAN 10, its list not the port-channel's */
  assert.match(show(sim, "asw", "show etherchannel summary"), /Gi0\/23\(P\)   Gi0\/24\(s\)/);
  assert.match(show(sim, "asw", "show interfaces gi0/24"), /line protocol is down/);
  assert.match(show(sim, "asw", "show interfaces port-channel 1"), /BW 1000000 Kbit\/sec/);
  assert.ok(reach(sim), "still through the other member");
  cli(sim, "asw", ["interface gi0/23", "shutdown"]);
  assert.ok(!reach(sim), "the suspended member carries nothing: with the other shut, no way through");
  cli(sim, "asw", ["interface gi0/23", "no shutdown", "interface port-channel 1", "switchport trunk allowed vlan all"]);   /* typed on the port-channel: every member matches again */
  assert.match(show(sim, "asw", "show etherchannel summary"), /Gi0\/23\(P\)   Gi0\/24\(P\)/);
});

test("a member cabled to a different switch from the bundle's is suspended", () => {
  const n = net(); n.cables = n.cables.map((c) => c.id === "c-a24" ? cab("c-a24", "asw", "24", "other", "24") : c);
  const sim = new Sim(n); cli(sim, "asw", side("active")); cli(sim, "dsw", side("active")); cli(sim, "other", ["interface gi0/24", "switchport mode trunk", "channel-group 1 mode active"]);
  assert.match(show(sim, "asw", "show etherchannel summary"), /Gi0\/23\(P\)   Gi0\/24\(s\)/);
});

test("no channel-group takes a port out; a switch with no port-channel is exactly as before", () => {
  const sim = built("active", "active"); cli(sim, "asw", ["interface gi0/24", "no channel-group"]);
  assert.doesNotMatch(show(sim, "asw", "show etherchannel summary"), /Gi0\/24/);
  const fresh = C.newSwitch(); assert.ok(!("pcs" in JSON.parse(JSON.stringify(fresh))), "no port-channel record until one is made, so a saved switch reads as before");
  assert.doesNotMatch(show(new Sim(net()), "other", "show running-config"), /Port-channel|channel-group/);
});

test("settings typed on the port-channel reach its members and its own record: the allowed list added to or taken from keeps the bundle", () => {
  const sim = built("active", "active");
  for (const id of ["asw", "dsw"]) cli(sim, id, ["vlan 20", "interface port-channel 1", "switchport trunk allowed vlan 10", "switchport trunk allowed vlan add 20"]);
  for (const id of ["asw", "dsw"]) for (const n of ["GigabitEthernet0/23", "GigabitEthernet0/24"]) { sim.syncSwitch(id); assert.equal(C.chanState(sim.d[id].sw, n), "P", id + " " + n + " bundled after add"); assert.deepEqual(sim.d[id].sw.ports[n].allowed, [10, 20]); }
  assert.deepEqual(sim.d.asw.sw.pcs[1].allowed, [10, 20], "the port-channel's own record has the VLAN added");
  for (const id of ["asw", "dsw"]) cli(sim, id, ["interface port-channel 1", "switchport trunk allowed vlan remove 20"]);
  for (const id of ["asw", "dsw"]) for (const n of ["GigabitEthernet0/23", "GigabitEthernet0/24"]) { sim.syncSwitch(id); assert.equal(C.chanState(sim.d[id].sw, n), "P", id + " " + n + " bundled after remove"); }
  assert.deepEqual(sim.d.dsw.sw.pcs[1].allowed, [10]); assert.ok(reach(sim), "VLAN 10 still across");
  cli(sim, "asw", ["interface gi0/24", "switchport trunk allowed vlan add 20"]); sim.syncSwitch("asw");
  assert.equal(C.chanState(sim.d.asw.sw, "GigabitEthernet0/24"), "s", "typed on one member alone: that member no longer matches, suspended");
});
