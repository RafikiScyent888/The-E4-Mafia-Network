/* Level 3 groundwork: the managed switch's VLANs and trunks (js/net/swcli.js) and the business router's command line
   (js/net/rtcli.js): what each command does, what the show commands say, and the configuration as a file. */
import test from "node:test";
import assert from "node:assert/strict";
import * as C from "../js/net/swcli.js";
import * as R from "../js/net/rtcli.js";

function type(S, lines) { let r = null; const all = []; lines.forEach(function (l) { r = C.exec(S, l); all.push.apply(all, r.out); }); return { r: r, all: all }; }
const swOn = function (links) { const sw = C.newSwitch({ links: links || {} }); const S = C.session(sw); type(S, ["", "enable", "configure terminal"]); return { sw: sw, S: S }; };
const up = { mac: "a4bb.6d12.0a02" };

/* ---------------------------------------------------------------- the switch: VLANs */
test("VLANs: made and named in VLAN mode, a list at once, VLAN 1 can't be renamed or deleted", () => {
  const { sw, S } = swOn();
  assert.equal(type(S, ["vlan 10"]).r.prompt, "Switch(config-vlan)#");
  type(S, ["name STAFF", "vlan 20,30-31", "exit"]);
  assert.equal(sw.vlans[10].name, "STAFF"); assert.equal(sw.vlans[20].name, "VLAN0020"); assert.ok(sw.vlans[31]);
  assert.match(type(S, ["vlan 1", "name MINE"]).all.join("\n"), /Default VLAN 1 may not have its name changed/);
  assert.match(type(S, ["exit", "no vlan 1"]).all.join("\n"), /Default VLAN 1 may not be deleted/);
  assert.equal(type(S, ["vlan 4095"]).all[0], "% Invalid input detected at '^' marker.");
  assert.ok(!sw.vlans[4095]);
});

test("an access port in a VLAN that doesn't exist makes it, and says so; a deleted VLAN leaves its ports inactive", () => {
  const { sw, S } = swOn({ "GigabitEthernet0/5": up });
  const t = type(S, ["interface gi0/5", "switchport mode access", "switchport access vlan 40"]);
  assert.match(t.all.join("\n"), /% Access VLAN does not exist\. Creating vlan 40/);
  assert.equal(sw.ports["GigabitEthernet0/5"].access, 40);
  assert.deepEqual(C.carries(sw, "GigabitEthernet0/5"), { mode: "access", untagged: 40, tagged: [] });
  const vb = type(S, ["end", "show vlan brief"]).all.join("\n");
  assert.match(vb, /^40\s+VLAN0040\s+active\s+Gi0\/5$/m);
  type(S, ["configure terminal", "no vlan 40", "end"]);
  assert.equal(C.carries(sw, "GigabitEthernet0/5").untagged, null, "its VLAN gone, the port carries nothing");
  assert.match(type(S, ["show interfaces gi0/5 switchport"]).all.join("\n"), /Access Mode VLAN: 40 \(Inactive\)/);
  assert.match(type(S, ["show interfaces status"]).all.join("\n"), /Gi0\/5\s+connected\s+unassigned/);
});

test("trunks: allowed list replaced by a bare list, changed by add, remove and except; native VLAN; nonegotiate", () => {
  const { sw, S } = swOn({ "GigabitEthernet0/24": up });
  type(S, ["vlan 10,20,30,99", "exit", "interface gi0/24", "switchport mode trunk", "switchport trunk allowed vlan 10,20"]);
  const p = sw.ports["GigabitEthernet0/24"];
  assert.deepEqual(p.allowed, [10, 20]);
  type(S, ["switchport trunk allowed vlan 30"]); assert.deepEqual(p.allowed, [30], "a bare list replaces the whole list: the classic mistake");
  type(S, ["switchport trunk allowed vlan add 10,20"]); assert.deepEqual(p.allowed, [10, 20, 30]);
  type(S, ["switchport trunk allowed vlan remove 20"]); assert.deepEqual(p.allowed, [10, 30]);
  type(S, ["switchport trunk allowed vlan except 1"]); assert.equal(p.allowed.length, 4093);
  type(S, ["switchport trunk allowed vlan all"]); assert.equal(p.allowed, "all");
  type(S, ["switchport trunk native vlan 99", "switchport nonegotiate"]);
  assert.deepEqual(C.carries(sw, "GigabitEthernet0/24", null), { mode: "trunk", untagged: 99, tagged: [1, 10, 20, 30] });
  const tr = type(S, ["end", "show interfaces trunk"]).all.join("\n");
  assert.match(tr, /Gi0\/24\s+on \(no DTP\)\s+802\.1q\s+trunking\s+99/);
  assert.match(tr, /Vlans allowed on trunk\nGi0\/24\s+1-4094/);
  assert.match(type(S, ["configure terminal", "interface gi0/24", "switchport mode dynamic auto"]).all.join("\n"), /Conflict between 'nonegotiate' and 'dynamic'/);
  assert.match(type(S, ["switchport trunk allowed vlan ?"]).all.join("\n"), /add\s+add VLANs to the current list/);
});

test("trunking negotiated with the far end (DTP): who trunks with whom", () => {
  const M = function (m, nn) { return { mode: m, nonegotiate: !!nn }; };
  const op = function (me, far) { return C.operMode({ mode: me }, far); };
  assert.equal(op("dynamic auto", M("dynamic auto")), "access", "two auto ports never trunk");
  assert.equal(op("dynamic auto", M("dynamic desirable")), "trunk");
  assert.equal(op("dynamic auto", M("trunk")), "trunk");
  assert.equal(op("dynamic desirable", M("dynamic auto")), "trunk");
  assert.equal(op("dynamic auto", M("trunk", true)), "access", "a trunk that doesn't negotiate never asks an auto port");
  assert.equal(op("dynamic desirable", null), "access", "a router or a computer never negotiates");
  assert.equal(op("trunk", null), "trunk");
  assert.equal(op("access", M("trunk")), "access");
});

test("the switch's own interface on another VLAN: up only while the VLAN exists and a port that's up carries it", () => {
  const { sw, S } = swOn({ "GigabitEthernet0/3": up });
  type(S, ["interface vlan 99", "ip address 10.0.99.2 255.255.255.0", "end"]);
  assert.match(type(S, ["show ip interface brief"]).all.join("\n"), /Vlan99\s+10\.0\.99\.2\s+YES manual up\s+down/);
  assert.deepEqual(C.ownAddrs(sw), [], "no VLAN 99 yet: no address that answers");
  type(S, ["configure terminal", "vlan 99", "interface gi0/3", "switchport access vlan 99", "end"]);
  assert.match(type(S, ["show ip interface brief"]).all.join("\n"), /Vlan99\s+10\.0\.99\.2\s+YES manual up\s+up/);
  assert.deepEqual(C.ownAddrs(sw), [{ vlan: 99, ip: "10.0.99.2", mask: "255.255.255.0" }]);
  assert.match(type(S, ["configure terminal", "interface vlan 99", "switchport mode trunk"]).all.join("\n"), /not its own interface on a VLAN/);
});

test("VLANs and switchport settings travel in the configuration file, and back in from it", () => {
  const { sw, S } = swOn();
  type(S, ["hostname SB-SW1", "vlan 10", "name STAFF", "vlan 40", "name GUEST", "interface gi0/5", "switchport mode access", "switchport access vlan 10", "interface gi0/24", "switchport trunk native vlan 999", "switchport trunk allowed vlan 10,40", "switchport mode trunk", "switchport nonegotiate", "end"]);
  const text = C.configText(sw);
  assert.match(text, /vlan 10\n name STAFF\n!\nvlan 40\n name GUEST/);
  assert.match(text, /interface GigabitEthernet0\/5\n switchport access vlan 10\n switchport mode access/);
  assert.match(text, /interface GigabitEthernet0\/24\n switchport trunk native vlan 999\n switchport trunk allowed vlan 10,40\n switchport mode trunk\n switchport nonegotiate/);
  const fresh = C.newSwitch(), S2 = C.session(fresh, { tftpGet: function () { return { text: text }; } });
  type(S2, ["", "enable", "copy tftp: running-config", "10.0.0.5", "sb-sw1-confg", ""]);
  assert.equal(fresh.hostname, "SB-SW1"); assert.equal(fresh.vlans[40].name, "GUEST");
  assert.deepEqual(fresh.ports["GigabitEthernet0/24"].allowed, [10, 40]); assert.equal(fresh.ports["GigabitEthernet0/24"].native, 999);
  assert.equal(fresh.ports["GigabitEthernet0/5"].mode, "access");
});

test("a switch saved before VLANs came is read as from the box: nothing to save, VLAN 1 everywhere", () => {
  const sw = C.newSwitch(); const S = C.session(sw); type(S, ["", "enable", "write memory"]);
  delete sw.vlans; delete sw.svis; delete sw.startup.vlans; delete sw.startup.svis;
  Object.values(sw.ports).concat(Object.values(sw.startup.ports)).forEach(function (p) { delete p.mode; delete p.access; delete p.native; delete p.allowed; delete p.nonegotiate; });
  assert.equal(C.unsaved(sw), false);
  assert.match(type(S, ["show vlan brief"]).all.join("\n"), /^1\s+default\s+active\s+Gi0\/1, Gi0\/2/m);
});

/* ---------------------------------------------------------------- the router */
const rtOn = function (links, live) { const r = R.newRouter({ links: links || {} }); const S = C.session(r, { live: live }); type(S, ["", "enable", "configure terminal"]); return { r: r, S: S }; };
const L2 = { "GigabitEthernet0/0": { up: true }, "GigabitEthernet0/1": { up: true } };
const wanLive = function (k) { return k === "wan" ? { ip: "203.0.113.45", mask: "255.255.255.0", gw: "203.0.113.1" } : null; };

test("a router fresh from its box: its own name and prompts, every port shut down until no shutdown", () => {
  const { r, S } = rtOn(L2);
  assert.equal(C.promptOf(S), "Router(config)#");
  assert.match(type(S, ["end", "show ip interface brief"]).all.join("\n"), /GigabitEthernet0\/0\s+unassigned\s+YES unset\s+administratively down\s+down/);
  assert.equal(type(S, ["configure terminal", "interface g0/0"]).r.prompt, "Router(config-if)#");
  assert.match(type(S, ["no shutdown"]).all[0], /Interface GigabitEthernet0\/0, changed state to up/);
  assert.equal(R.rtStatus(r, "GigabitEthernet0/0")[1], "up");
  assert.equal(R.rtStatus(r, "GigabitEthernet0/2")[0], "administratively down");
  assert.match(type(S, ["end", "show version"]).all.join("\n"), /BR-4200/);
});

test("router on a stick: a subinterface needs its 802.1Q tag before its address, one tag per port", () => {
  const { r, S } = rtOn(L2);
  type(S, ["interface g0/0", "no shutdown", "interface g0/0.10"]);
  assert.match(type(S, ["ip address 192.168.10.1 255.255.255.0"]).all.join("\n"), /only allowed if that\nsubinterface is already configured as part of an IEEE 802\.1Q vLAN/);
  type(S, ["encapsulation dot1Q 10", "ip address 192.168.10.1 255.255.255.0", "interface g0/0.20"]);
  assert.match(type(S, ["encapsulation dot1Q 10"]).all[0], /VLAN ID 10 is already used by GigabitEthernet0\/0\.10/);
  assert.match(type(S, ["interface g0/0", "encapsulation dot1Q 10"]).all.join("\n"), /go on a subinterface/);
  assert.match(type(S, ["interface g0/0.20", "encapsulation dot1Q 20", "ip address 192.168.10.9 255.255.255.0"]).all[0], /overlaps with GigabitEthernet0\/0\.10/);
  assert.equal(r.subs["GigabitEthernet0/0.10"].vlan, 10);
  assert.equal(R.rtStatus(r, "GigabitEthernet0/0.10")[1], "up");
  type(S, ["interface g0/0", "shutdown"]);
  assert.equal(R.rtStatus(r, "GigabitEthernet0/0.10")[1], "down", "its port shut, every subinterface on it goes down");
});

test("the routing table: connected networks, static routes by next hop, the default route; longest match wins", () => {
  const { r, S } = rtOn(L2, wanLive);
  type(S, ["interface g0/0", "no shutdown", "interface g0/0.10", "encapsulation dot1Q 10", "ip address 192.168.10.1 255.255.255.0", "interface g0/1", "ip address dhcp", "no shutdown", "exit", "ip route 10.9.0.0 255.255.0.0 192.168.10.254", "ip route 10.9.8.0 255.255.255.0 192.168.10.253", "ip route 172.16.0.0 255.255.0.0 10.1.1.1", "end"]);
  const t = type(S, ["show ip route"]).all.join("\n");
  assert.match(t, /Gateway of last resort is 203\.0\.113\.1 to network 0\.0\.0\.0/);
  assert.match(t, /^C\s+192\.168\.10\.0\/24 is directly connected, GigabitEthernet0\/0\.10$/m);
  assert.match(t, /^S\s+10\.9\.0\.0\/16 \[1\/0\] via 192\.168\.10\.254/m);
  assert.doesNotMatch(t, /172\.16/, "a next hop on no connected network: the route isn't used");
  assert.equal(R.lookup(r, "10.9.8.7", wanLive).nh, "192.168.10.253", "the /24 beats the /16");
  assert.equal(R.lookup(r, "10.9.1.1", wanLive).nh, "192.168.10.254");
  assert.equal(R.lookup(r, "8.8.8.8", wanLive).nh, "203.0.113.1");
  assert.equal(R.lookup(r, "8.8.8.8", function () { return null; }), null, "no address from the provider: no default route, nowhere to send it");
  assert.match(type(S, ["configure terminal", "ip route 10.9.0.1 255.255.0.0 192.168.10.254"]).all.join("\n"), /Inconsistent address and mask/);
});

test("access lists: standard and extended lines, first match wins, the implicit deny at the end, hit counts shown", () => {
  const { r, S } = rtOn(L2, function (k) { return k === "hits" ? { "110": { 0: 3 } } : null; });
  type(S, ["access-list 10 permit 192.168.10.0 0.0.0.255", "access-list 110 deny ip 192.168.40.0 0.0.0.255 192.168.10.0 0.0.0.255", "access-list 110 permit tcp any host 192.168.10.20 eq www", "access-list 110 permit udp any any eq domain"]);
  const pk = function (proto, src, dst, port) { return { proto: proto, src: src, dst: dst, port: port }; };
  assert.deepEqual(R.aclVerdict(r, "110", pk("icmp", "192.168.40.5", "192.168.10.7")), { permit: false, line: 0 });
  assert.deepEqual(R.aclVerdict(r, "110", pk("tcp", "192.168.40.5", "192.168.10.20", 80)), { permit: false, line: 0 }, "first match wins: the deny comes first");
  assert.deepEqual(R.aclVerdict(r, "110", pk("tcp", "192.168.50.5", "192.168.10.20", 80)), { permit: true, line: 1 });
  assert.deepEqual(R.aclVerdict(r, "110", pk("tcp", "192.168.50.5", "192.168.10.20", 443)), { permit: false, line: -1 }, "nothing matched: the implicit deny");
  assert.deepEqual(R.aclVerdict(r, "110", pk("udp", "192.168.50.5", "1.1.1.1", 53)), { permit: true, line: 2 });
  assert.equal(R.aclVerdict(r, "10", pk("icmp", "192.168.11.1", "8.8.8.8")).permit, false);
  assert.equal(R.aclVerdict(r, "99", pk("icmp", "1.2.3.4", "5.6.7.8")).permit, true, "a list that doesn't exist permits everything");
  const t = type(S, ["end", "show access-lists"]).all.join("\n");
  assert.match(t, /Extended IP access list 110\n    10 deny ip 192\.168\.40\.0 0\.0\.0\.255 192\.168\.10\.0 0\.0\.0\.255 \(3 matches\)\n    20 permit tcp any host 192\.168\.10\.20 eq www\n    30 permit udp any any eq domain/);
  assert.match(type(S, ["configure terminal", "access-list 110 permit tcp any any eq"]).all.join("\n"), /Invalid input/);
  assert.match(type(S, ["access-list 200 permit ip any any"]).all[0], /Invalid input/);
});

test("named access lists have their own mode and prompt; applied in or out on an interface", () => {
  const { r, S } = rtOn(L2);
  assert.equal(type(S, ["ip access-list extended GUEST-IN"]).r.prompt, "Router(config-ext-nacl)#");
  type(S, ["deny ip any 192.168.0.0 0.0.255.255", "permit ip any any", "exit"]);
  assert.equal(type(S, ["ip access-list standard MGMT"]).r.prompt, "Router(config-std-nacl)#");
  type(S, ["permit host 192.168.99.10", "exit", "interface g0/0.40", "encapsulation dot1Q 40", "ip address 192.168.40.1 255.255.255.0", "ip access-group GUEST-IN in", "end"]);
  assert.equal(r.subs["GigabitEthernet0/0.40"].aclIn, "GUEST-IN");
  assert.equal(R.aclVerdict(r, "GUEST-IN", { proto: "icmp", src: "192.168.40.9", dst: "192.168.10.3" }).permit, false);
  assert.equal(R.aclVerdict(r, "GUEST-IN", { proto: "icmp", src: "192.168.40.9", dst: "8.8.8.8" }).permit, true);
  const t = C.configText(r);
  assert.match(t, /ip access-list extended GUEST-IN\n deny ip any 192\.168\.0\.0 0\.0\.255\.255\n permit ip any any/);
  assert.match(t, /interface GigabitEthernet0\/0\.40\n encapsulation dot1Q 40\n ip address 192\.168\.40\.1 255\.255\.255\.0\n ip access-group GUEST-IN in/);
});

test("DHCP: a pool per network, its addresses less the excluded ones; the pool's mode and settings", () => {
  const { r, S } = rtOn(L2);
  type(S, ["ip dhcp excluded-address 192.168.10.1 192.168.10.10", "ip dhcp excluded-address 192.168.10.50"]);
  assert.equal(type(S, ["ip dhcp pool STAFF"]).r.prompt, "Router(dhcp-config)#");
  type(S, ["network 192.168.10.0 /24", "default-router 192.168.10.1", "dns-server 1.1.1.1 8.8.8.8", "lease 0 8", "exit"]);
  assert.deepEqual(r.pools.STAFF.router, ["192.168.10.1"]); assert.equal(r.pools.STAFF.mask, "255.255.255.0");
  const A = R.poolAddrs(r, "STAFF");
  assert.equal(A[0], "192.168.10.11"); assert.equal(A.indexOf("192.168.10.50"), -1); assert.equal(A.length, 254 - 11);
  assert.equal(R.poolFor(r, "192.168.10.1", "255.255.255.0").name, "STAFF");
  assert.match(type(S, ["ip dhcp pool X", "network 192.168.10.5 255.255.255.0"]).all[0], /is not a network address/);
  assert.match(C.configText(r), /ip dhcp excluded-address 192\.168\.10\.1 192\.168\.10\.10\nip dhcp excluded-address 192\.168\.10\.50\n!\nip dhcp pool STAFF\n network 192\.168\.10\.0 255\.255\.255\.0\n default-router 192\.168\.10\.1\n dns-server 1\.1\.1\.1 8\.8\.8\.8\n lease 0 8/);
});

test("NAT: inside and outside interfaces, PAT onto the outside address, a static forward; all in the file", () => {
  const { r, S } = rtOn(L2);
  type(S, ["interface g0/0.10", "encapsulation dot1Q 10", "ip address 192.168.10.1 255.255.255.0", "ip nat inside", "interface g0/1", "ip address dhcp", "ip nat outside", "exit", "access-list 1 permit 192.168.10.0 0.0.0.255", "ip nat inside source list 1 interface g0/1 overload", "ip nat inside source static tcp 192.168.10.20 443 interface g0/1 8443"]);
  assert.deepEqual(r.nat, [{ list: "1", iface: "GigabitEthernet0/1", overload: true }]);
  assert.deepEqual(r.statics, [{ proto: "tcp", local: "192.168.10.20", lport: 443, global: null, iface: "GigabitEthernet0/1", gport: 8443 }]);
  const t = C.configText(r);
  assert.match(t, /ip nat inside source list 1 interface GigabitEthernet0\/1 overload\nip nat inside source static tcp 192\.168\.10\.20 443 interface GigabitEthernet0\/1 8443/);
  type(S, ["no ip nat inside source list 1 interface g0/1 overload"]); assert.deepEqual(r.nat, []);
});

test("the router's configuration as a file builds the same router, through TFTP and a reload", () => {
  const { r, S } = rtOn(L2);
  type(S, ["hostname SB-RTR", "enable secret Cl1nic!", "interface g0/0", "no shutdown", "interface g0/0.10", "description STAFF", "encapsulation dot1Q 10", "ip address 192.168.10.1 255.255.255.0", "ip nat inside", "interface g0/1", "ip address dhcp", "ip nat outside", "no shutdown", "exit", "ip dhcp pool STAFF", "network 192.168.10.0 255.255.255.0", "default-router 192.168.10.1", "exit", "access-list 1 permit 192.168.10.0 0.0.0.255", "ip nat inside source list 1 interface g0/1 overload", "ip route 0.0.0.0 0.0.0.0 203.0.113.1", "end", "copy running-config startup-config", ""]);
  const text = C.configText(r, "startup");
  const fresh = R.newRouter(), S2 = C.session(fresh, { tftpGet: function () { return { text: text }; } });
  type(S2, ["", "enable", "copy tftp: startup-config", "10.0.0.5", "sb-rtr-confg", "", "reload", "no", ""]);   /* no: saving now would put the factory settings over the file */
  assert.equal(fresh.hostname, "SB-RTR");
  assert.ok(C.pwOk(fresh.enableSecret, "Cl1nic!"), "the secret's hash travels, and still matches");
  assert.equal(fresh.ifs["GigabitEthernet0/0"].shutdown, false, "an interface the file names comes up, unless the file shuts it");
  assert.equal(fresh.ifs["GigabitEthernet0/2"].shutdown, true);
  assert.equal(fresh.subs["GigabitEthernet0/0.10"].vlan, 10); assert.equal(fresh.subs["GigabitEthernet0/0.10"].nat, "inside");
  assert.deepEqual(fresh.routes, [{ net: "0.0.0.0", mask: "0.0.0.0", nh: "203.0.113.1", iface: null }]);
  assert.equal(C.configText(fresh), C.configText(r), "the same configuration, line for line");
});

test("no brand names on the router either: not in any output, prompt or help line", () => {
  const { S } = rtOn(L2), seen = [];
  const walk = function (prefix) { seen.push.apply(seen, C.exec(S, prefix + "?").out); };
  ["", "ip ", "ip dhcp ", "ip access-list ", "access-list ", "no ", "no ip "].forEach(walk);
  type(S, ["interface g0/0.10"]); ["", "ip ", "encapsulation ", "no "].forEach(walk);
  type(S, ["ip dhcp pool P"]); ["", "no "].forEach(walk);
  type(S, ["end"]); ["", "show ", "show ip ", "clear ", "clear ip "].forEach(walk);
  ["show version", "show running-config", "show ip route", "show ip interface brief", "show interfaces", "show ip dhcp pool", "show access-lists", "show ip nat translations"].forEach((l) => seen.push.apply(seen, C.exec(S, l).out));
  assert.doesNotMatch(seen.join("\n"), /cisco|catalyst|\bios\b|juniper|aruba|netgear|tp-link|isr\b/i);
});
