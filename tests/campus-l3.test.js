/* Level 4, the campus: the layer 3 switch (MSW-3900X). Its command line: "ip routing", VLAN interfaces as gateways, routed
   ports ("no switchport" and an address), static routes by next hop or interface with a distance, show ip route, the lines in
   the running configuration and back in from a file; and a switch that isn't layer 3 has none of it (the small office's and
   the business's switches unchanged). */
import test from "node:test";
import assert from "node:assert/strict";
import * as C from "../js/net/swcli.js";

const LINKS = () => { const L = {}; ["GigabitEthernet0/1", "GigabitEthernet0/2", "GigabitEthernet0/24"].forEach((n) => { L[n] = { speed: "auto" }; }); return L; };
const login = (sw) => { const S = C.session(sw); C.exec(S, ""); C.exec(S, "enable"); return S; };
const type = (S, lines) => lines.map((l) => C.exec(S, l).out).flat();
const BASE = ["configure terminal", "vlan 10", "vlan 20", "exit", "interface gi0/1", "switchport mode access", "switchport access vlan 10", "interface gi0/2", "switchport mode access", "switchport access vlan 20",
  "interface vlan 10", "ip address 10.1.10.1 255.255.255.0", "no shutdown", "interface vlan 20", "ip address 10.1.20.1 255.255.255.0", "no shutdown", "end"];

test("a layer 3 switch: its model, and routing off from the box (show ip route says it's a host)", () => {
  const sw = C.newSwitch({ l3: true, links: LINKS() }), S = login(sw);
  assert.equal(sw.model, "MSW-3900X"); assert.equal(sw.routing, false);
  assert.match(type(S, ["show version"]).join("\n"), /MSW-3900X .*layer 3/);
  const o = type(S, ["show ip route"]);
  assert.equal(o[0], "Default gateway is not set"); assert.ok(o.some((l) => /ICMP redirect cache is empty/.test(l)));
});

test("ip routing turns its VLAN interfaces into connected networks; a VLAN interface that's down gives none", () => {
  const sw = C.newSwitch({ l3: true, links: LINKS() }), S = login(sw); type(S, BASE);
  assert.equal(C.l3Table(sw).length, 4, "routing off still has a table to work from");
  assert.equal(C.l3Route(sw, "10.1.20.5"), null, "routing off: nothing is routed");
  type(S, ["configure terminal", "ip routing", "end"]);
  const o = type(S, ["show ip route"]).join("\n");
  assert.match(o, /C        10\.1\.10\.0\/24 is directly connected, Vlan10/); assert.match(o, /L        10\.1\.20\.1\/32 is directly connected, Vlan20/);
  assert.equal(C.l3Route(sw, "10.1.20.5").iface, "Vlan20");
  delete sw.links["GigabitEthernet0/2"];   /* the only port carrying VLAN 20 goes down: its VLAN interface goes down with it */
  assert.equal(C.l3Route(sw, "10.1.20.5"), null); assert.doesNotMatch(type(S, ["show ip route"]).join("\n"), /Vlan20/);
});

test("a routed port: no switchport, then its address; switchport settings refused on it; switchport makes it a switch port again", () => {
  const sw = C.newSwitch({ l3: true, links: LINKS() }), S = login(sw);
  let o = type(S, ["configure terminal", "interface gi0/24", "ip address 10.0.0.2 255.255.255.252"]);
  assert.match(o.join("\n"), /no switchport/, "a switch port can't take an address, and says what makes it routed");
  type(S, ["no switchport", "ip address 10.0.0.2 255.255.255.252"]);
  assert.equal(sw.ports["GigabitEthernet0/24"].routed, true); assert.equal(sw.ports["GigabitEthernet0/24"].ip, "10.0.0.2");
  assert.match(type(S, ["switchport access vlan 10"]).join("\n"), /routed port/);
  assert.deepEqual(C.carries(sw, "GigabitEthernet0/24"), { mode: "routed", untagged: null, tagged: [] }, "a routed port is on no VLAN");
  assert.match(type(S, ["do show ip interface brief"]).join("\n"), /GigabitEthernet0\/24\s+10\.0\.0\.2\s+YES manual up\s+up/);
  type(S, ["switchport"]);
  assert.equal(sw.ports["GigabitEthernet0/24"].routed, false); assert.equal(sw.ports["GigabitEthernet0/24"].ip, undefined);
});

test("static routes: by next hop (only while it's on a connected network) or interface, a distance, the default route; no ip route takes one away", () => {
  const sw = C.newSwitch({ l3: true, links: LINKS() }), S = login(sw); type(S, BASE);
  type(S, ["configure terminal", "ip routing", "interface gi0/24", "no switchport", "ip address 10.0.0.2 255.255.255.252", "exit",
    "ip route 0.0.0.0 0.0.0.0 10.0.0.1", "ip route 172.16.0.0 255.255.0.0 10.0.0.1 200", "ip route 192.168.5.0 255.255.255.0 Vlan10", "ip route 10.50.0.0 255.255.0.0 10.77.0.1", "end"]);
  assert.match(type(S, ["configure terminal", "ip route 10.9.0.1 255.255.0.0 10.0.0.1", "end"]).join("\n"), /Inconsistent address and mask/);
  const o = type(S, ["show ip route"]).join("\n");
  assert.match(o, /Gateway of last resort is 10\.0\.0\.1 to network 0\.0\.0\.0/);
  assert.match(o, /S\*       0\.0\.0\.0\/0 \[1\/0\] via 10\.0\.0\.1, GigabitEthernet0\/24/);
  assert.match(o, /S        172\.16\.0\.0\/16 \[200\/0\] via 10\.0\.0\.1/);
  assert.match(o, /S        192\.168\.5\.0\/24 \[1\/0\] via Vlan10/);
  assert.doesNotMatch(o, /10\.50\.0\.0/, "a next hop on no connected network: not in the table");
  assert.equal(C.l3Route(sw, "172.16.4.4").nh, "10.0.0.1"); assert.equal(C.l3Route(sw, "8.8.8.8").code, "S");
  assert.equal(C.l3Route(sw, "10.1.10.9").iface, "Vlan10", "connected beats the default route: the longest match");
  type(S, ["configure terminal", "no ip route 172.16.0.0 255.255.0.0 10.0.0.1", "end"]);
  assert.doesNotMatch(type(S, ["show ip route"]).join("\n"), /172\.16\.0\.0/);
  type(S, ["configure terminal", "interface gi0/24", "shutdown", "end"]);
  assert.doesNotMatch(type(S, ["show ip route"]).join("\n"), /0\.0\.0\.0\/0/, "the way out shut: the default route leaves the table");
});

test("the running configuration carries it all, it's saved, and a file copied back in builds the same switch", () => {
  const sw = C.newSwitch({ l3: true, links: LINKS() }), S = login(sw); type(S, BASE);
  type(S, ["configure terminal", "ip routing", "interface gi0/24", "no switchport", "ip address 10.0.0.2 255.255.255.252", "exit", "ip route 0.0.0.0 0.0.0.0 10.0.0.1", "end"]);
  const run = type(S, ["show running-config"]).join("\n");
  assert.match(run, /\nip routing\n/); assert.match(run, /interface GigabitEthernet0\/24\n no switchport\n ip address 10\.0\.0\.2 255\.255\.255\.252\n/);
  assert.match(run, /\nip route 0\.0\.0\.0 0\.0\.0\.0 10\.0\.0\.1\n/);
  assert.ok(C.unsaved(sw), "changed and not saved"); type(S, ["copy running-config startup-config", ""]);
  assert.ok(!C.unsaved(sw)); C.reload(sw); assert.equal(sw.routing, true); assert.equal(sw.routes.length, 1); assert.equal(sw.ports["GigabitEthernet0/24"].ip, "10.0.0.2");
  const text = C.configText(sw, "running"), sw2 = C.newSwitch({ l3: true, links: LINKS() });
  const S2 = login(sw2); type(S2, ["configure terminal"].concat(text.split("\n").filter((l) => l && !/^(!|end|Building|Current|version)/.test(l))).concat(["end"]));
  assert.equal(sw2.routing, true); assert.deepEqual(sw2.routes, sw.routes); assert.equal(sw2.ports["GigabitEthernet0/24"].routed, true);
});

test("a switch that isn't layer 3 has none of it: no ip routing, no routed ports, no show ip route, its configuration unchanged", () => {
  const sw = C.newSwitch({ links: LINKS() }), S = login(sw);
  assert.match(type(S, ["show ip route"]).join("\n"), /Invalid input/);
  assert.match(type(S, ["configure terminal", "ip routing"]).join("\n"), /Invalid input/);
  assert.match(type(S, ["interface gi0/24", "no switchport"]).join("\n"), /Incomplete|Invalid/);
  type(S, ["end"]); assert.equal(sw.routing, undefined); assert.equal(sw.ports["GigabitEthernet0/24"].routed, undefined);
  const help = C.exec(S, "configure terminal").out && C.exec(S, "ip ?").out.join("\n"); assert.match(help, /default-gateway/, "the help was read"); assert.doesNotMatch(help, /^\s*(routing|route)\s/m, "no routing commands offered");
  assert.doesNotMatch(type(S, ["end", "show running-config"]).join("\n"), /ip routing|no switchport/);
});
