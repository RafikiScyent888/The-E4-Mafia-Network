/* Level 3, SB-J6's simulation: the switches' guards and the router's hardening. Each business is SB-J5 done; the guards are put on
   through the real command lines, and each test checks what a guard does, what breaks when it's put on the wrong way, and that
   checking changes nothing. */
import test from "node:test";
import assert from "node:assert/strict";
import { BUSINESS_JOBS } from "../js/build/business.js";
import * as B from "../js/build/engine.js";
import { exec } from "../js/net/cmd.js";
import * as C from "../js/net/swcli.js";

const N = Math.min(20, Number(process.env.SEEDS || 20));
const seeds = Array.from({ length: N }, (_, i) => 6100 + i * 7919);
const E = (dev, port) => ({ dev, port });
function build(seed) {
  const J = B.open(BUSINESS_JOBS[4], seed); for (const a of BUSINESS_JOBS[4].solve(J.v, J.sim)) B.act(J, a);
  const sim = J.sim, p = J.v.plan, v = p.vlans;
  const ap = (x) => { const r = sim.apply(x); assert.notEqual(r && r.ok, false, "refused: " + JSON.stringify(x) + " " + JSON.stringify(r)); return r; };
  const out = (lines) => lines.map((l) => { const r = exec(sim, "tech", l); sim.apply({ t: "cmd" }); return String(r.out); }).join("");
  const con = () => sim.cablesOf("tech").find((c) => c.kind === "console");
  const to = (dev, room) => { ap({ t: "pull", cable: con().id }); ap({ t: "place", dev: "tech", room: room }); ap({ t: "lay", a: E("tech", "USB-C"), b: E(dev, "CONSOLE") }); };
  const login = (dev) => { if (dev === "rtr") { to("rtr", "closet"); out(["", p.rtConsole, "enable", p.rtSecret, "configure terminal"]); } else { to(dev, dev === "bsw" ? "back" : "closet"); out(["", p.swConsole, "enable", p.swSecret, "configure terminal"]); } };
  const online = (id) => !!sim.route(id, "8.8.8.8").internet;
  const prints = (id) => { const r = sim.route(id, sim.d.printer.ifaces[0].cfg.ip); return !!((r.local || r.routed) && r.owner && r.owner.indexOf("printer") >= 0); };
  const camsOk = () => p.cams.every((c) => sim.fromInternet(sim.net.isp.wanIp, c.ext).ok);
  const renew = (id) => { exec(sim, id, "ipconfig /renew"); sim.apply({ t: "cmd" }); };
  const port = (id) => { const c = sim.cablesOf("msw").find((k) => k.a.dev === id || k.b.dev === id || (sim.viaPanel && false)); return c ? (c.a.dev === "msw" ? c.a.port : c.b.port) : null; };
  return { sim, p, v, ap, out, login, online, prints, camsOk, renew, port, J };
}
const snapshot = (sim) => JSON.stringify(sim.d) + JSON.stringify(sim.net.cables);

test("DHCP snooping: answers come only through trusted ports; bindings come with leases, go with releases and with snooping", () => {
  for (const seed of seeds) {
    const t = build(seed), { sim, v } = t;
    t.login("msw"); t.out(["ip dhcp snooping vlan " + v.staff.id + "," + v.guest.id, "ip dhcp snooping"]);
    t.renew("pc");
    assert.equal(t.online("pc"), false, seed + ": the router's port untrusted, the front PC's renewal gets no answer");
    assert.ok(sim.snoopDrops("pc").some((d) => d.dev === "msw" && /0\/24$/.test(d.port)), seed + ": where its answers are dropped: the closet switch's router port");
    t.out(["interface gi0/24", "ip dhcp snooping trust", "exit"]); t.renew("pc"); t.renew("bpc");
    assert.ok(t.online("pc") && t.online("bpc"), seed + ": trusted, both renew");
    const B1 = sim.d.msw.sw.snoopBind;
    assert.ok(B1.some((b) => b.port === "GigabitEthernet0/1" && b.vlan === v.staff.id && b.ip === sim.addr("pc").ip), seed + ": the front PC bound to its port");
    assert.ok(B1.some((b) => b.port === "GigabitEthernet0/23" && b.ip === sim.addr("bpc").ip), seed + ": the back PC bound to the trunk it comes in by");
    assert.match(t.out(["do show ip dhcp snooping binding"]), new RegExp(sim.addr("pc").ip.replace(/\./g, "\\.") + "\\s+86400\\s+dhcp-snooping\\s+" + v.staff.id));
    const before = snapshot(sim); sim.route("pc", "8.8.8.8"); sim.dhcpServers("pc"); sim.snoopDrops("bpc"); assert.equal(snapshot(sim), before, seed + ": checking changes nothing");
    exec(sim, "pc", "ipconfig /release"); sim.apply({ t: "cmd" });
    assert.ok(!sim.d.msw.sw.snoopBind.some((b) => b.port === "GigabitEthernet0/1"), seed + ": released: its binding goes");
    t.out(["no ip dhcp snooping"]);
    assert.equal(sim.d.msw.sw.snoopBind.length, 0, seed + ": snooping off: the bindings go");
  }
});

test("ARP inspection: checked against the bindings at each switch; old leases, fixed addresses and an untrusted router port are dropped", () => {
  for (const seed of seeds) {
    const t = build(seed), { sim, v } = t;
    t.login("msw"); t.out(["ip dhcp snooping vlan " + v.staff.id + "," + v.guest.id, "ip dhcp snooping", "interface gi0/24", "ip dhcp snooping trust", "exit", "ip arp inspection vlan " + v.staff.id + "," + v.guest.id]);
    const r = sim.route("pc", "8.8.8.8");
    assert.ok(!r.internet && r.dai && r.dai.dev === "msw", seed + ": the front PC's lease is from before snooping: its ARP is dropped at the closet switch");
    t.renew("pc"); t.renew("mgr"); t.renew("bpc");
    assert.equal(t.online("pc") && t.online("mgr"), false, seed + ": renewed, but the router's port untrusted for ARP: the router's answers are dropped");
    t.out(["interface gi0/24", "ip arp inspection trust", "exit"]);
    assert.ok(t.online("pc") && t.online("mgr") && t.online("bpc"), seed + ": the router's port trusted: staff online");
    assert.ok(t.prints("pc") && t.camsOk(), seed + ": the printer and the cameras (other VLANs) untouched");
    assert.equal(t.online("guest"), false, seed + ": the visitor's phone, its lease from before: dropped");
    t.ap({ t: "radio", dev: "guest", on: false }); t.ap({ t: "radio", dev: "guest", on: true }); t.ap({ t: "joinssid", dev: "guest", ssid: t.p.guestSsid, pass: t.p.guestPw });
    assert.ok(t.online("guest"), seed + ": it joins again: bound, online");
    t.out(["ip arp inspection vlan " + v.cameras.id]);
    assert.ok(t.p.cams.every((c) => sim.fromInternet(sim.net.isp.wanIp, c.ext).why === "arp"), seed + ": inspected on the cameras' VLAN: fixed addresses have no bindings, the forwards fail at ARP");
    t.out(["no ip arp inspection vlan " + v.cameras.id, "ip arp inspection vlan 1"]);
    assert.equal(t.prints("pc"), false, seed + ": inspected on the old network: the printer's fixed address is dropped");
    const before = snapshot(sim); sim.route("bpc", "8.8.8.8"); sim.route("pc", sim.d.printer.ifaces[0].cfg.ip); p0(sim); assert.equal(snapshot(sim), before, seed + ": checking changes nothing");
  }
});
const p0 = (sim) => sim.fromInternet(sim.net.isp.wanIp, 8443);

test("port security: sticky keeps the PC; a stranger shuts the port until it's shut and opened; learned without sticky, it's forgotten", () => {
  for (const seed of seeds) {
    const t = build(seed), { sim } = t;
    t.login("msw");
    assert.match(t.out(["interface gi0/1", "switchport port-security"]), /Command rejected: GigabitEthernet0\/1 is a dynamic port|^$/);
    t.out(["switchport mode access", "switchport port-security", "switchport port-security mac-address sticky", "exit"]);
    const mac = C.dotMac(sim.macOf("pc"));
    assert.ok(sim.d.msw.sw.ports["GigabitEthernet0/1"].ps.macs.some((m) => m.mac === mac && m.sticky), seed + ": the front PC's address kept as sticky");
    assert.match(t.out(["do show running-config"]), new RegExp("switchport port-security mac-address sticky " + mac.replace(/\./g, "\\.")));
    const pcc = sim.cablesOf("pc").find((c) => c.kind === "cat6");
    t.ap({ t: "pull", cable: pcc.id }); t.ap({ t: "lay", a: E("tech", "ETH"), b: E("msw", "1") });
    assert.equal(C.errDisabled(sim.d.msw.sw, "GigabitEthernet0/1"), true, seed + ": a stranger's laptop: err-disabled");
    assert.match(t.out(["do show interfaces status"]), /Gi0\/1\s+\S*\s*err-disabled/);
    assert.match(t.out(["do show port-security interface gi0/1"]), /Port Status\s+: Secure-shutdown[\s\S]*Security Violation Count\s+: 1/);
    t.ap({ t: "pull", cable: sim.cablesOf("tech").find((c) => c.kind === "cat6").id }); t.ap({ t: "lay", a: E("pc", "NIC"), b: E("msw", "1") });
    assert.equal(t.online("pc"), false, seed + ": the PC back in: the port stays shut");
    t.out(["interface gi0/1", "shutdown", "no shutdown", "exit"]); t.renew("pc");
    assert.ok(t.online("pc"), seed + ": shut and opened again: the PC is back online");
    /* not sticky: the manager's PC learned, then forgotten when its link drops, so another device takes its place without a violation */
    t.out(["interface gi0/2", "switchport mode access", "switchport port-security", "exit"]);
    const mg = sim.cablesOf("mgr").find((c) => c.kind === "cat6"); t.ap({ t: "pull", cable: mg.id }); t.ap({ t: "lay", a: E("tech", "ETH"), b: E("msw", "2") });
    assert.equal(C.errDisabled(sim.d.msw.sw, "GigabitEthernet0/2"), false, seed + ": learned without sticky: forgotten when the link dropped, so no violation");
    t.ap({ t: "pull", cable: sim.cablesOf("tech").find((c) => c.kind === "cat6").id }); t.ap({ t: "lay", a: E("mgr", "NIC"), b: E("msw", "2") });
    assert.equal(C.errDisabled(sim.d.msw.sw, "GigabitEthernet0/2"), false, seed + ": and the manager's PC back is learned again: without sticky, a swap is never caught (why the records ask for sticky)");
    /* restrict: the stranger is counted and the port stays up */
    t.out(["interface gi0/1", "switchport port-security violation restrict", "exit"]);
    t.ap({ t: "pull", cable: sim.cablesOf("pc").find((c) => c.kind === "cat6").id }); t.ap({ t: "lay", a: E("tech", "ETH"), b: E("msw", "1") });
    assert.equal(C.errDisabled(sim.d.msw.sw, "GigabitEthernet0/1"), false, seed + ": restrict: the port stays up");
    assert.match(t.out(["do show port-security interface gi0/1"]), /Violation Mode\s+: Restrict[\s\S]*Security Violation Count\s+: [1-9]/, seed + ": restrict: the stranger counted");
  }
});

test("the router: the remote lines' access list, idle timeouts and LLDP per port, in its running configuration and on the wire", () => {
  for (const seed of seeds.slice(0, 8)) {
    const t = build(seed), { sim, p, v } = t;
    t.login("rtr");
    t.out(["ip domain-name " + p.domain, "crypto key generate rsa modulus 2048", "username " + p.user + " secret " + p.userPw, "ip access-list standard VTY-ONLY", "permit host 10.255.255.254", "exit",
      "line vty 0 4", "login local", "transport input ssh", "access-class VTY-ONLY in", "exec-timeout 5 0", "exit", "line con 0", "exec-timeout 5 0", "exit"]);
    const gw = v.staff.gw, s1 = String(exec(sim, "mgr", "ssh " + p.user + "@" + gw).out);
    assert.match(s1, /Connection refused/, seed + ": the manager's PC isn't in the list: refused");
    t.out(["ip access-list standard VTY-ONLY", "permit " + v.staff.net + " 0.0.0.255", "exit"]);
    const s2 = String(exec(sim, "mgr", "ssh " + p.user + "@" + gw).out);
    assert.doesNotMatch(s2, /refused/, seed + ": the staff VLAN in the list: the password is asked");
    exec(sim, "mgr", "\u0003"); sim.cli = sim.cli || {}; delete sim.cli.mgr;
    assert.match(String(exec(sim, "mgr", "telnet " + gw).out), /Could not open connection/, seed + ": Telnet: refused (SSH only)");
    const run = t.out(["do show running-config"]);
    assert.match(run, /line con 0\n exec-timeout 5 0/); assert.match(run, /line vty 0 4\n access-class VTY-ONLY in\n exec-timeout 5 0/);
    assert.ok(sim.d.msw.sw && sim.syncSwitch("msw").links["GigabitEthernet0/24"].lldp, seed + ": the closet switch hears the router over LLDP");
    t.out(["interface " + p.lanPort, "no lldp transmit", "exit"]);
    assert.equal(sim.syncSwitch("msw").links["GigabitEthernet0/24"].lldp, null, seed + ": no lldp transmit on its inside port: the switch no longer hears it there");
    assert.match(t.out(["do show running-config"]), new RegExp("interface " + p.lanPort.replace(/\//g, "\\/") + "[\\s\\S]*? no lldp transmit"));
    t.out(["interface " + p.lanPort, "lldp transmit", "exit", "no lldp run"]);
    assert.match(t.out(["do show lldp neighbors"]), /LLDP is not enabled/);
  }
});

test("a reload forgets what the switch learned (err-disabled, bindings) and keeps what was saved; an older save reads as saved", () => {
  for (const seed of seeds.slice(0, 6)) {
    const t = build(seed), { sim, v } = t;
    t.login("msw"); t.out(["ip dhcp snooping vlan " + v.staff.id, "ip dhcp snooping", "interface gi0/24", "ip dhcp snooping trust", "exit", "interface gi0/1", "switchport mode access", "switchport port-security", "switchport port-security mac-address sticky", "end", "copy running-config startup-config", ""]);
    t.renew("pc"); assert.ok(sim.d.msw.sw.snoopBind.length > 0);
    const pcc = sim.cablesOf("pc").find((c) => c.kind === "cat6"); t.ap({ t: "pull", cable: pcc.id }); t.ap({ t: "lay", a: E("tech", "ETH"), b: E("msw", "1") });
    assert.equal(C.errDisabled(sim.d.msw.sw, "GigabitEthernet0/1"), true);
    t.ap({ t: "pull", cable: sim.cablesOf("tech").find((c) => c.kind === "cat6").id }); t.ap({ t: "lay", a: E("pc", "NIC"), b: E("msw", "1") });
    t.ap({ t: "power", dev: "msw" });
    assert.equal(C.errDisabled(sim.d.msw.sw, "GigabitEthernet0/1"), false, seed + ": a power cut clears err-disabled");
    assert.ok(sim.d.msw.sw.snoop.on && sim.d.msw.sw.ports["GigabitEthernet0/1"].ps.on, seed + ": what was saved comes back");
    assert.ok(!sim.d.msw.sw.snoopBind.some((b) => b.ip !== sim.addr("pc").ip), seed + ": the bindings from before the cut are gone (only a lease since)");
    const sw = C.newSwitch(), S = C.session(sw); ["", "enable", "write memory"].forEach((l) => C.exec(S, l));
    delete sw.snoop; delete sw.dai; delete sw.startup.snoop; delete sw.startup.dai;
    assert.equal(C.unsaved(sw), false, "a switch saved before snooping existed reads as saved");
  }
});
