/* Level 3 groundwork: the simulation with VLANs and the business router. A small test network (not the level's own,
   which comes with its work orders): the router's Gi0/1 to the provider's modem, its Gi0/0 to the managed switch's
   port 24, a staff PC on port 1 and a guest's laptop on port 2. Everything is configured through the real command
   lines, and every result is what the network itself works out. */
import test from "node:test";
import assert from "node:assert/strict";
import { Sim } from "../js/net/sim.js";
import * as C from "../js/net/swcli.js";
import * as R from "../js/net/rtcli.js";

const pc = function (id, mac, label) { return { id: id, kind: "pc", label: label, on: true, os: "windows", ifaces: [{ name: "Ethernet", type: "eth", port: "NIC", mac: mac, cfg: { mode: "dhcp", dnsMode: "auto" }, lease: null, apipa: null }] }; };
const cab = function (id, a, ap, b, bp) { return { id: id, kind: "cat6", a: { dev: a, port: ap, seated: true }, b: { dev: b, port: bp, seated: true }, cond: "good", length: 10 }; };
function net() {
  return {
    seed: 1, site: "business", isp: { up: true, outage: false, gw: "198.51.100.1", core: "203.0.113.1", dns: ["203.0.113.53"], wanIp: "198.51.100.77", mask: "255.255.255.0" },
    devices: {
      isp: { id: "isp", kind: "isp", label: "ISP" }, wall: { id: "wall", kind: "wall", label: "Wall outlet" },
      modem: { id: "modem", kind: "modem", label: "Cable modem", on: true, mgmt: "192.168.100.1", mac: "00-11-22-33-44-01" },
      rtr: { id: "rtr", kind: "brouter", label: "Business router", on: true, sw: R.newRouter({ mac: "00e0.4d01.0001" }) },
      msw: { id: "msw", kind: "mswitch", label: "Managed switch", on: true, mac: "00e0.4c01.0001", sw: C.newSwitch() },
      staff: pc("staff", "aa-00-00-00-00-01", "Staff PC"), guest: pc("guest", "aa-00-00-00-00-02", "Guest laptop"),
      printer: { id: "printer", kind: "printer", label: "Printer", on: true, ifaces: [{ name: "Wired", type: "eth", port: "NET", mac: "aa-00-00-00-00-03", cfg: { mode: "static", ip: "192.168.10.11", mask: "255.255.255.0", gw: "192.168.10.1", dns: [] }, lease: null, apipa: null }] }
    },
    cables: [
      { id: "c-coax", kind: "coax", a: { dev: "wall", port: "F", tight: true }, b: { dev: "modem", port: "CABLE IN", tight: true }, cond: "good" },
      cab("c-wan", "modem", "ETH", "rtr", "Gi0/1"), cab("c-trunk", "rtr", "Gi0/0", "msw", "24"),
      cab("c-staff", "msw", "1", "staff", "NIC"), cab("c-guest", "msw", "2", "guest", "NIC"), cab("c-printer", "msw", "3", "printer", "NET")
    ],
    neighbours: [], ports: {}, rooms: {}, extra: { build: true }
  };
}
const cli = function (sim, id, lines) { const S = C.session(sim.d[id].sw, { live: sim.d[id].kind === "brouter" ? sim.rtLive(id) : null }); const out = []; ["", "enable", "configure terminal"].concat(lines, ["end"]).forEach(function (l) { if (sim.d[id].kind === "brouter") sim.syncRouter(id); else sim.syncSwitch(id); out.push.apply(out, C.exec(S, l).out); }); return out; };
const SWITCH = ["vlan 10", "name STAFF", "vlan 40", "name GUEST", "interface gi0/1", "switchport mode access", "switchport access vlan 10", "interface gi0/2", "switchport mode access", "switchport access vlan 40", "interface gi0/3", "switchport mode access", "switchport access vlan 10", "interface gi0/24", "switchport mode trunk"];
const ROUTER = ["interface g0/0", "no shutdown", "interface g0/0.10", "encapsulation dot1Q 10", "ip address 192.168.10.1 255.255.255.0", "ip nat inside", "interface g0/0.40", "encapsulation dot1Q 40", "ip address 192.168.40.1 255.255.255.0", "ip nat inside",
  "interface g0/1", "ip address dhcp", "ip nat outside", "no shutdown", "exit", "ip dhcp excluded-address 192.168.10.1 192.168.10.10", "ip dhcp excluded-address 192.168.40.1",
  "ip dhcp pool STAFF", "network 192.168.10.0 255.255.255.0", "default-router 192.168.10.1", "dns-server 203.0.113.53", "exit", "ip dhcp pool GUEST", "network 192.168.40.0 255.255.255.0", "default-router 192.168.40.1", "dns-server 203.0.113.53", "exit",
  "access-list 1 permit 192.168.10.0 0.0.0.255", "access-list 1 permit 192.168.40.0 0.0.0.255", "ip nat inside source list 1 interface g0/1 overload"];
function built(extraSw, extraRt) { const s = new Sim(net()); cli(s, "msw", SWITCH.concat(extraSw || [])); cli(s, "rtr", ROUTER.concat(extraRt || [])); s.dhcp("staff", "t"); s.dhcp("guest", "t"); return s; }
const lease = function (s, id) { const f = s.d[id].ifaces[0]; return f.lease ? f.lease.ip : f.apipa ? "apipa" : null; };

test("from the box: the router's ports are shut and the switch is all VLAN 1; nobody gets an address", () => {
  const s = new Sim(net()); s.dhcp("staff", "t");
  assert.equal(lease(s, "staff"), "apipa");
  assert.equal(s.cableUp(s.cable("c-trunk")), false, "a router port shut down: no link");
});

test("router on a stick: each VLAN gets its own address from its own pool, and routes to the other through the router", () => {
  const s = built();
  assert.equal(lease(s, "staff"), "192.168.10.12", "the staff pool's first address after the excluded ones, and the printer's address (in use, not excluded) skipped");
  assert.equal(s.d.staff.ifaces[0].lease.gw, "192.168.10.1");
  assert.equal(lease(s, "guest"), "192.168.40.2");
  const r = s.route("staff", "192.168.40.2");
  assert.ok(r.routed && !r.fail, JSON.stringify(r)); assert.deepEqual(r.hops, ["192.168.10.1", "192.168.40.2"]);
  assert.ok(s.route("staff", "192.168.10.11").local, "the printer: on its own VLAN, straight there");
  assert.ok(s.route("guest", "192.168.10.1").local, "the router's other interface answers too");
});

test("the provider: PAT gets both VLANs out; a VLAN left out of NAT's list never gets a reply", () => {
  const s = built();
  const r = s.route("staff", "8.8.8.8"); assert.ok(r.internet, JSON.stringify(r)); assert.deepEqual(r.nat, { inside: lease(s, "staff"), global: "198.51.100.77" });
  assert.match(R.routes(s.rtView("rtr"), s.rtLive("rtr")).map((t) => t.code + " " + t.net).join(","), /S\* 0\.0\.0\.0/, "the default route came with the provider's address");
  const t = built([], ["no access-list 1", "access-list 1 permit 192.168.10.0 0.0.0.255"]);
  assert.ok(t.route("staff", "8.8.8.8").internet);
  assert.equal(t.route("guest", "8.8.8.8").fail, "no-nat");
  assert.ok(t.route("guest", "192.168.10.12").routed, "inside, the guest still routes: only the internet is lost");
  const u = built([], ["interface g0/1", "no ip nat outside"]);
  assert.equal(u.route("staff", "8.8.8.8").fail, "no-nat");
});

test("access lists: guests kept off staff, both ways, because an access list remembers nothing; the internet still works", () => {
  const s = built([], ["ip access-list extended GUEST-IN", "deny ip 192.168.40.0 0.0.0.255 192.168.10.0 0.0.0.255", "permit ip any any", "exit", "interface g0/0.40", "ip access-group GUEST-IN in"]);
  const g = s.route("guest", "192.168.10.12"); assert.equal(g.fail, "blocked"); assert.deepEqual(g.acls, [["GUEST-IN", 0]]);
  assert.equal(s.route("staff", "192.168.40.2").fail, "no-reply", "the guest's reply is denied coming in");
  const i = s.route("guest", "8.8.8.8"); assert.ok(i.internet); assert.deepEqual(i.acls, [["GUEST-IN", 1]]);
  const d = built([], ["access-list 140 deny ip 192.168.40.0 0.0.0.255 192.168.10.0 0.0.0.255", "interface g0/0.40", "ip access-group 140 in"]);
  const di = d.route("guest", "8.8.8.8"); assert.equal(di.fail, "blocked"); assert.deepEqual(di.acls, [["140", -1]], "no permit line: the implicit deny takes everything else");
  const o = built([], ["ip access-list extended GUEST-IN", "deny ip 192.168.40.0 0.0.0.255 192.168.10.0 0.0.0.255", "permit ip any any", "exit", "interface g0/0.40", "ip access-group GUEST-IN out"]);
  assert.ok(o.route("guest", "192.168.10.12").routed, "applied out, it only sees what goes towards the guests: the guests still reach staff");
});

test("trunks and tags: a VLAN left off the trunk, the wrong tag, or a trunk that never formed, each cut one VLAN or all off", () => {
  const a = built(["interface gi0/24", "switchport trunk allowed vlan 10"]);
  assert.equal(lease(a, "staff"), "192.168.10.12"); assert.equal(lease(a, "guest"), "apipa", "VLAN 40 isn't allowed on the trunk");
  const b = built([], ["interface g0/0.40", "encapsulation dot1Q 41", "ip address 192.168.40.1 255.255.255.0"]);
  assert.equal(lease(b, "guest"), "apipa", "the router tags VLAN 41; the guests are on 40");
  const c = new Sim(net()); cli(c, "msw", SWITCH.filter((l) => l !== "switchport mode trunk")); cli(c, "rtr", ROUTER); c.dhcp("staff", "t"); c.dhcp("guest", "t");
  assert.equal(lease(c, "staff"), "apipa", "port 24 left on dynamic auto: a router never negotiates, so it's an access port in VLAN 1");
  const d = built(["no vlan 40"]); assert.equal(lease(d, "guest"), "apipa", "the VLAN deleted: its port carries nothing");
});

test("DHCP and gateways: a pool's wrong default router, and a pool that's run out", () => {
  const a = built([], ["ip dhcp pool STAFF", "default-router 192.168.10.254"]);
  assert.equal(a.d.staff.ifaces[0].lease.gw, "192.168.10.254", "the client takes what the pool says");
  assert.equal(a.route("staff", "8.8.8.8").fail, "gateway-unreachable");
  assert.ok(a.route("staff", "192.168.10.11").local, "on its own VLAN it still works");
  const b = built([], ["ip dhcp excluded-address 192.168.40.2 192.168.40.254"]);
  assert.equal(lease(b, "guest"), "apipa", "every address excluded: nothing left to hand out");
});

test("routing: no way to the provider, and a static route whose next hop isn't reachable", () => {
  const a = built([], ["interface g0/1", "no ip address dhcp", "ip address 198.51.100.77 255.255.255.0"]);
  assert.equal(a.route("staff", "8.8.8.8").fail, "net-unreachable", "a fixed address and no default route");
  const b = built([], ["interface g0/1", "no ip address dhcp", "ip address 198.51.100.77 255.255.255.0", "exit", "ip route 0.0.0.0 0.0.0.0 198.51.100.1"]);
  assert.ok(b.route("staff", "8.8.8.8").internet);
  const c = built([], ["interface g0/1", "no ip address dhcp", "ip address 198.51.100.78 255.255.255.0", "exit", "ip route 0.0.0.0 0.0.0.0 198.51.100.1"]);
  assert.equal(c.route("staff", "8.8.8.8").fail, "net-unreachable", "an address the provider never gave the business");
});

test("the printer's address, in use but not excluded, goes on the router's conflict list instead of to a client", () => {
  const s = built();
  assert.deepEqual(s.d.rtr.conflicts, [{ ip: "192.168.10.11", how: "Ping" }]);
  const off = new Sim(net()); off.d.printer.on = false; cli(off, "msw", SWITCH); cli(off, "rtr", ROUTER); off.dhcp("staff", "t");
  assert.equal(lease(off, "staff"), "192.168.10.11", "with the printer off, nothing answers: the client is given the printer's address");
});

test("working things out changes nothing: route() and the DHCP server list leave the network as they found it", () => {
  const s = built(); const before = JSON.stringify(s.net);
  s.route("guest", "8.8.8.8"); s.route("staff", "192.168.40.2"); s.dhcpServers("staff"); s.rtView("rtr"); s.owners("192.168.10.1", s.domain(s.homeNode("staff")));
  assert.equal(JSON.stringify(s.net), before);
});

/* ---------------------------------------------------------------- the router's own terminal */
import * as CMD from "../js/net/cmd.js";
function withTech() {
  const n = net();
  n.devices.tech = { id: "tech", kind: "techlaptop", label: "Your laptop", on: true, os: "windows", user: "tech", ifaces: [{ name: "Ethernet", type: "eth", port: "ETH", mac: "aa-00-00-00-00-09", cfg: { mode: "dhcp", dnsMode: "auto" }, lease: null, apipa: null }], tftp: { on: true, root: "C:\\TFTP-Root", files: [], log: [] } };
  n.cables.push({ id: "c-con", kind: "console", a: { dev: "tech", port: "USB-C", seated: true }, b: { dev: "rtr", port: "CONSOLE", seated: true }, length: 1.8 }, cab("c-tech", "msw", "4", "tech", "ETH"));
  return new Sim(n);
}
const ser = function (s, line) { return CMD.exec(s, "tech", line).out; };

test("your laptop's console reaches the router: its prompts, its ping, its TFTP copy out over a VLAN", () => {
  const s = withTech(); cli(s, "msw", SWITCH.concat(["interface gi0/4", "switchport mode access", "switchport access vlan 10"])); cli(s, "rtr", ROUTER); s.dhcp("staff", "t"); s.dhcp("tech", "t");
  ser(s, ""); assert.equal(CMD.prompt(s, "tech"), "Router>");
  ser(s, "enable"); assert.equal(CMD.prompt(s, "tech"), "Router#");
  assert.match(ser(s, "ping 192.168.10.11"), /!!!!!\nSuccess rate is 100 percent/, "the printer answers the router's ping");
  assert.match(ser(s, "ping 192.168.10.12"), /\.\.\.\.\.\nSuccess rate is 0 percent/, "a Windows PC's firewall drops it, as always");
  assert.match(ser(s, "ping 8.8.8.8"), /Success rate is 100 percent/, "out to the provider from its own address");
  const lap = s.d.tech.ifaces[0].lease.ip;
  ser(s, "copy running-config tftp:"); ser(s, lap); const out = ser(s, "");
  assert.match(out, /bytes copied/, out);
  assert.equal(s.d.tech.tftp.files[0].name, "router-confg");
  assert.match(s.d.tech.tftp.log[0], /^Write request from 192\.168\.10\.1 for router-confg/, "it came from the router's address on the VLAN your laptop is on");
  assert.match(ser(s, "show ip dhcp binding"), new RegExp(lap.replace(/\./g, "\\.")), "your laptop's lease is in the router's bindings");
});

test("SSH from a staff PC to the router, once it has a name, a domain, keys and a local login", () => {
  const s = withTech(); cli(s, "msw", SWITCH); cli(s, "rtr", ROUTER.concat(["hostname SB-RTR", "ip domain-name clinic.lan", "crypto key generate rsa modulus 2048", "username admin secret Adm1n!", "line vty 0 4", "login local", "transport input ssh"])); s.dhcp("staff", "t");
  const a = CMD.exec(s, "staff", "ssh admin@192.168.10.1"); assert.match(a.out, /Permanently added '192\.168\.10\.1'|^$/);
  assert.equal(CMD.prompt(s, "staff"), "admin@192.168.10.1's password: ");
  CMD.exec(s, "staff", "Adm1n!"); assert.equal(CMD.prompt(s, "staff"), "SB-RTR>");
  assert.match(CMD.exec(s, "staff", "show ip interface brief").out, /GigabitEthernet0\/0\.10\s+192\.168\.10\.1/);
  CMD.exec(s, "staff", "exit"); assert.match(CMD.prompt(s, "staff"), /^C:\\Users\\/);
  const g = built(); g.d.rtr.sw.vty.transport = "ssh";
  assert.match(CMD.exec(g, "guest", "ssh admin@192.168.40.1").out, /Connection refused/, "no keys yet: refused");
});
