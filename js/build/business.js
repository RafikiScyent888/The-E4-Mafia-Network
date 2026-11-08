/* Client jobs for build mode, the small business (level 3). The business as
   the technician finds it: one flat network on the provider's router, the
   closet switch set up as the small office's was, and the new business router
   (BR-4200) in its box. The work is done on the router's and the switch's own
   command lines, and every line of a work order is checked against the
   devices and the network as they really are. Each line is an ordered list of
   causes, as on the other levels, so Mason's third rung can strike the ones
   the network has ruled out and leave two. None of it ever says what to type. */
import { makeBusiness, addGuestKit, addBackSwitch, addCameraKit, addCabinet, addFixedLine, addPrinterVlan } from "../net/business.js";
import { Sim } from "../net/sim.js";
import { exec } from "../net/cmd.js";
import { browse } from "../net/pages.js";
import { unsaved, pwOk, carries, errDisabled, dotMac } from "../net/swcli.js";
import { addrOf, rtStatus, poolFor, poolAddrs, aclVerdict, aceMatch, routes, netOf, lldpSends } from "../net/rtcli.js";
import { online } from "./jobs.js";
import { ip2n } from "../net/util.js";

const C = function (id, on, text, not, ev) { return { id: id, on: !!on, text: text, not: not, ev: ev }; };
const E = function (dev, port) { return { dev: dev, port: port }; };
const cli = function (line) { return { t: "cmd", dev: "tech", line: line, cli: true }; };
const RT = function (sim) { return sim.d.rtr.sw; };
const SW = function (sim) { return sim.d.msw.sw; };
const PCS = ["pc", "mgr", "bpc"];
const live = function (sim) { return sim.rtLive("rtr"); };
const view = function (sim) { return sim.rtView("rtr"); };
const printerIp = function (sim) { return sim.d.printer.ifaces[0].cfg.ip; };
const printOk = function (sim, from) { const r = sim.route(from || "pc", printerIp(sim)); return !!((r.local || r.routed) && r.owner && r.owner.indexOf("printer") >= 0); };
/* the cable between two devices, through the patch panel if it's patched; the port each end is in */
const between = function (sim, a, b) {
  for (const c0 of sim.cablesOf(a)) { const c = sim.panelEnd(c0) ? sim.viaPanel(c0) : c0; if (!c) continue; const me = c.a.dev === a ? c.a : c.b, far = c.a.dev === a ? c.b : c.a; if (far.dev === b) return { cable: c0, me: me.port, far: far.port }; }
  return null;
};
const consoleOn = function (sim, id) { return sim.cablesOf(id).find(function (c) { return c.kind === "console"; }) || null; };
const name = function (sim, id) { return sim.d[id].label.replace(/^[A-Z](?=[a-z])/, function (m) { return m.toLowerCase(); }); };   /* "the manager's PC", "the till PC" */

/* ---------------------------------------------------------------- the lines the jobs share */
const boxCause = function (sim) { return C("box", sim.d.rtr.boxed, "The new router is still in its box", "The router is out of its box, in the rack.", "The business router is still in its box."); };
function savedCauses(sim, id) {
  const sw = sim.d[id].sw, who = id === "rtr" ? "router" : "switch";
  return (id === "rtr" ? [boxCause(sim)] : []).concat([
    C("never", !sw.startup, "Nothing is saved on the " + who + " yet: a power cut would bring back the factory settings", "Its configuration has been saved.", "show startup-config on the " + who + ": startup-config is not present."),
    C("since", !!sw.startup && unsaved(sw), "There are changes on the " + who + " since it was last saved", "What's running is what's saved.", "The " + who + "'s running and startup configurations differ.")]);
}
const L_SAVED_RT = {
  id: "saved", text: "The router's setup survives a power cut",
  causes: function (sim) { return savedCauses(sim, "rtr"); },
  ok: function () { return "What's running on the router is saved."; },
  rung1: function () { return "On the router: compare show running-config with show startup-config."; },
  rung2: function () { return "Changes take effect at once in the running configuration, which lives in memory. Only what's copied to the startup configuration comes back after a reload or a power cut."; }
};

/* ---------------------------------------------------------------- SB-J1: the new router */
function rackCauses(sim) {
  const c = consoleOn(sim, "rtr");
  return [boxCause(sim),
    C("cable", !c, "Nothing joins your laptop to the router's CON port", "The console cable is in.", "Your laptop's serial terminal: nothing answers on COM3."),
    C("seat", !!c && !sim.cableUp(c), "The console cable isn't seated at one end", "The console cable is seated at both ends.", "Nothing answers on COM3; the console cable is there.")];
}
function lockCauses(sim, v) {
  const r = RT(sim), con = r.con, p = v.plan;
  return [boxCause(sim),
    C("factory", r.hostname === "Router", "It still has its factory name", "It has a name of its own.", "The prompt still says Router."),
    C("name", r.hostname !== p.rtHost, "It has a name, but not the one in the business's records", "Its name is the business's.", "The prompt says " + r.hostname + "."),
    C("nosecret", !r.enableSecret && !r.enablePassword, "Anyone at the console can type enable and change anything", "Privileged mode is protected.", "enable goes straight to privileged mode, with no password."),
    C("plain", !r.enableSecret && !!r.enablePassword, "Only an enable password is set: it sits in the configuration as plain text", "An enable secret is set, stored as a hash.", "show running-config shows the enable password in plain text."),
    C("secret", !!r.enableSecret && !pwOk(r.enableSecret, p.rtSecret), "An enable secret is set, but it isn't the one in the business's records", "The enable secret is the business's.", "The business's enable secret doesn't open privileged mode."),
    C("conpw", !con.password, "The console line has no password", "The console line has a password.", "line con 0 has no password."),
    C("conlogin", !!con.password && !con.login, "The console line has a password, but never asks for it", "The console line asks for its password.", "Log out of the console, press RETURN: it goes straight in."),
    C("conwrong", !!con.password && !pwOk(con.password, p.rtConsole), "The console asks for a password, but not the one in the business's records", "The console password is the business's.", "The business's console password isn't accepted.")];
}
function wanCauses(sim, v) {
  const R = view(sim), L = live(sim), m = between(sim, "modem", "rtr"), w = sim.rtWan("rtr", R), f = R.ifs[v.plan.wanPort], a = addrOf(R, v.plan.wanPort, L);
  const rr = sim.route("rtr", "8.8.8.8");
  return [boxCause(sim),
    C("cable", !m, "Nothing joins the provider's modem to the new router", "The modem is cabled to the router.", "The modem's ETH port goes to the " + (sim.cableAt("modem", "ETH") ? name(sim, (function () { const c = sim.cableAt("modem", "ETH"); return c.a.dev === "modem" ? c.b.dev : c.a.dev; })()) : "nothing") + "."),
    C("port", !!m && m.far !== "Gi0/0", "The modem is in a port the business's records keep for the inside", "The modem is in the provider's port.", "The modem's cable is in the router's " + (m ? m.far : "") + "."),
    C("shut", !!m && f.shutdown, "The provider's port is shut down: routers come from the box with every port shut", "The provider's port is up.", "show ip interface brief: " + v.plan.wanPort + " administratively down."),
    C("addr", !!m && !f.shutdown && !a, "The provider's port has no address", "It has the provider's address.", "show ip interface brief: " + v.plan.wanPort + " unassigned."),
    C("static", !!a && !a.dhcp && !(w && w.ok), "Its address is set by hand, and isn't the one the provider gave the business", "Its address is the provider's.", "The provider's gateway doesn't answer from " + (a ? a.ip : "") + "."),
    C("route", !!a && !rr.internet, "The router can't reach the internet from there", "The router reaches the internet.", "ping 8.8.8.8 from the router: no replies.")];
}
function lanCauses(sim, v) {
  const R = view(sim), m = between(sim, "rtr", "msw"), f = R.ifs[v.plan.lanPort], a = addrOf(R, v.plan.lanPort, live(sim)), old = sim.d.router && between(sim, "router", "msw");
  const gw = sim.owners(v.plan.lanGw, sim.domain(sim.homeNode("pc")));
  return [boxCause(sim),
    C("cable", !m, "Nothing joins the new router to the closet switch", "The router is cabled to the switch.", "No cable from the router goes to the closet switch."),
    C("port", !!m && m.me !== "Gi0/1", "The switch is in a router port the records keep for something else", "The switch is in the inside port.", "The closet switch is in the router's " + (m ? m.me : "") + "."),
    C("swport", !!m && !sim.cableUp(m.cable), "The router's cable is in a switch port that's shut down", "The switch's port is up.", "The router's link light is off at the closet switch."),
    C("shut", !!m && f.shutdown, "The inside port is shut down", "The inside port is up.", "show ip interface brief: " + v.plan.lanPort + " administratively down."),
    C("addr", !a, "The inside port has no address", "It has an address.", "show ip interface brief: " + v.plan.lanPort + " unassigned."),
    C("wrong", !!a && (a.ip !== v.plan.lanGw || a.mask !== v.plan.mask), "Its address isn't the gateway every device here already uses", "Its address is the business's gateway.", "Its inside address is " + (a ? a.ip + " " + a.mask : "") + "."),
    C("old", !!old, "The provider's router is still on the switch: two gateways on one network", "The provider's router is off the network.", "The provider's router still has a cable into the closet switch."),
    C("reach", !(gw.length === 1 && gw[0] === "rtr"), "The PCs don't reach the new router as their gateway", "The PCs reach it.", "ping " + v.plan.lanGw + " from the " + name(sim, "pc") + ": no reply from the new router.")];
}
function natCauses(sim, v) {
  const r = RT(sim), fin = r.ifs[v.plan.lanPort].nat, fout = r.ifs[v.plan.wanPort].nat, rule = r.nat.find(function (x) { return x.iface === v.plan.wanPort; });
  const covers = rule && r.acls[rule.list] && aclVerdict(r, rule.list, { proto: "ip", src: v.plan.lan.replace(/\.0$/, ".50"), dst: "8.8.8.8" }).permit;
  return [boxCause(sim),
    C("inside", fin !== "inside", "The inside port isn't marked as NAT's inside", "The inside port is NAT's inside.", "show running-config: no ip nat inside on " + v.plan.lanPort + "."),
    C("outside", fout !== "outside", "The provider's port isn't marked as NAT's outside", "The provider's port is NAT's outside.", "show running-config: no ip nat outside on " + v.plan.wanPort + "."),
    C("rule", !rule, "There's no rule translating the inside addresses onto the provider's", "There's a NAT rule onto the provider's port.", "show running-config: no ip nat inside source line for " + v.plan.wanPort + "."),
    C("list", !!rule && !covers, "The NAT rule's access list doesn't take the business's addresses", "Its access list takes the business's network.", "show access-lists: the business's addresses match nothing that permits them."),
    C("overload", !!rule && !rule.overload, "The NAT rule gives one inside address the provider's address, not everyone at once", "Everyone shares the provider's address (PAT).", "show running-config: the NAT rule has no overload.")];
}
function dhcpCauses(sim, v) {
  const r = RT(sim), P = r.pools[Object.keys(r.pools).find(function (k) { const q = r.pools[k]; return q.network === v.plan.lan && q.mask === v.plan.mask; })] || null;
  const A = P ? poolAddrs(r, Object.keys(r.pools).find(function (k) { return r.pools[k] === P; })) : [];
  const lo = ip2n(v.plan.excl[0]), hi = ip2n(v.plan.excl[1]), leak = A.some(function (ip) { return ip2n(ip) >= lo && ip2n(ip) <= hi; });
  const old = sim.d.router && sim.d.router.dhcp.on && sim.on("router") && sim.dhcpServers("pc").indexOf("router") >= 0;
  return [boxCause(sim),
    C("pool", !P, "The router has no pool of addresses for the business's network", "There's a pool for the business's network.", "show ip dhcp pool: nothing for " + v.plan.lan + "/24."),
    C("gw", !!P && P.router[0] !== v.plan.lanGw, "The pool hands out the wrong default gateway, or none", "The pool hands out the router as the gateway.", "show running-config: the pool's default-router is " + (P && P.router[0] || "not set") + "."),
    C("dns", !!P && !(P.dns.length && P.dns.every(function (d) { return v.plan.dns.indexOf(d) >= 0; })), "The pool hands out no DNS servers, or not the provider's", "The pool hands out the provider's DNS servers.", "show running-config: the pool's dns-server is " + (P && P.dns.join(" ") || "not set") + "."),
    C("excl", !!P && leak, "The addresses the records keep for gear (the router, the switch, the printer) can be handed out", "The records' fixed addresses are excluded.", "show ip dhcp pool: addresses from " + v.plan.excl[0] + " to " + v.plan.excl[1] + " are in the pool."),
    C("old", !!old, "The provider's router still hands out addresses on the same network", "Only the new router hands out addresses.", "Two DHCP servers answer on the business's network.")];
}
function onlineCauses(sim, v) {
  const down = PCS.filter(function (id) { return !online(sim, id); }), id = down[0], a = id && sim.addr(id);
  return [boxCause(sim),
    C("addr", !!id && (!a || a.kind === "apipa"), "The " + (id ? name(sim, id) : "PC") + " has no address", "Every PC has an address.", "ipconfig on the " + (id ? name(sim, id) : "") + ": " + (a ? a.ip : "no address") + "."),
    C("stale", !!id && !!a && a.kind !== "apipa" && sim.route(id, "203.0.113.80").internet && a.dns.indexOf(v.plan.lanGw) >= 0, "The " + (id ? name(sim, id) : "PC") + " still asks the old router for names: its lease came from the provider's router", "No PC still has the old router's lease.", "ipconfig /all on the " + (id ? name(sim, id) : "") + ": DNS server " + (a && a.dns.join(", ")) + "."),
    C("dns", !!id && !!a && a.kind !== "apipa" && sim.route(id, "203.0.113.80").internet, "The " + (id ? name(sim, id) : "PC") + " reaches the internet, but its DNS servers don't answer", "Every PC's DNS servers answer.", "ipconfig /all on the " + (id ? name(sim, id) : "") + ": DNS server " + (a && a.dns.length ? a.dns.join(", ") : "none") + "; ping by name fails."),
    C("net", !!id, "The " + (id ? name(sim, id) : "PC") + " can't reach the internet", "Every PC reaches the internet.", "ping from the " + (id ? name(sim, id) : "") + ": no replies from the internet."),
    C("print", !printOk(sim), "The " + name(sim, "pc") + " can't reach the printer", "Printing works.", "Test pages from the " + name(sim, "pc") + " don't print.")];
}
const SB1 = {
  id: "SB-J1", level: "business", title: "The new router: racked, locked, and running the business",
  already: [],
  start(seed) { const net = makeBusiness(seed), sim = new Sim(net); sim.boot(PCS); return { sim: sim, v: { plan: net.plan } }; },
  brief(v, sim) { return { quote: "The provider's little router has been running everything since we opened, and it can't do what we need next: separate networks for staff, guests and the cameras. We've bought a proper business router. Can you put it in, take the provider's one out, and keep everyone working?", from: sim.net.client.manager + ", " + sim.net.client.name }; },
  mason: "Build the new router fully on the console before it takes over: inside, outside, NAT and DHCP. Then swap the cables and prove it from a PC.",
  limits: function (v) { const p = v.plan; return ["The business's records: the router is " + p.rtHost + ". Enable secret: " + p.rtSecret + ". Console password: " + p.rtConsole + ".",
    "Its ports: " + p.wanPort + " to the provider's modem (the provider hands out the address); " + p.lanPort + " to the closet switch's UPLINK-ROUTER port, as the network's gateway, " + p.lanGw + " " + p.mask + ".",
    "Addresses " + p.excl[0] + " to " + p.excl[1] + " are kept for gear: the router, the switches, the printer. Everything else on " + p.lan + "/24 is handed out, with the provider's DNS servers " + p.dns.join(" and ") + ".",
    "The provider's router goes back to the provider: nothing of it stays on the network.", "Your laptop is on the closet shelf with its console cable."]; },
  reqs: [{
    id: "rack", text: "The new router is in the closet rack, with your laptop on its console port",
    causes: rackCauses,
    ok: function () { return "The router is in the rack; your laptop's serial terminal reaches its console."; },
    rung1: function () { return "Look at what's still in its box, then at your laptop's Serial terminal: does anything answer?"; },
    rung2: function () { return "A router fresh from its box has no address: its console port is the only way in."; }
  }, {
    id: "lock", text: "It has its name and its passwords from the business's records",
    causes: lockCauses,
    ok: function (sim) { return "It's " + RT(sim).hostname + ", privileged mode needs the enable secret, and the console asks for its password."; },
    rung1: function () { return "On the router: show running-config, its first lines and line con 0. Then log out and wake the console."; },
    rung2: function () { return "A name and passwords on a router are set as on a switch: the secret is stored as a hash, and a line's password only counts when the line is told to ask for it."; }
  }, {
    id: "wan", text: "It reaches the internet through the provider's modem",
    causes: wanCauses,
    ok: function (sim, v) { const a = addrOf(view(sim), v.plan.wanPort, live(sim)); return "The provider's port has " + (a ? a.ip : "an address") + " and a way to the internet."; },
    rung1: function () { return "On the router: show ip interface brief, then show ip route. Then the Cable runs table: where does the modem's cable go?"; },
    rung2: function () { return "A router's ports are shut down from the box. The provider's side needs its link up and an address on the provider's network; an address from the provider's DHCP brings a default route with it."; }
  }, {
    id: "lan", text: "It's the business's gateway: its inside port on the closet switch, with the gateway's address",
    causes: lanCauses,
    ok: function (sim, v) { return "The inside port is up at " + v.plan.lanGw + " and the PCs reach it."; },
    rung1: function () { return "On the router: show ip interface brief. On the closet switch: show interfaces status. From a PC: ping its gateway."; },
    rung2: function () { return "Every device here already sends to one gateway address. Whoever owns that address on this network is their way out: there can only be one."; }
  }, {
    id: "nat", text: "Everyone inside shares the provider's one address on the way out (PAT)",
    causes: natCauses,
    ok: function () { return "NAT inside and outside are marked, and the business's addresses are translated onto the provider's (overload)."; },
    rung1: function () { return "On the router: show running-config: the ip nat lines on each port and the rule; then show access-lists and show ip nat translations while a PC pings out."; },
    rung2: function () { return "Private addresses never cross the internet. NAT needs to know which side is inside, which is outside, which inside addresses to translate, and that they all share one outside address."; }
  }, {
    id: "dhcp", text: "The router hands out the business's addresses, keeping the gear's addresses back",
    causes: dhcpCauses,
    ok: function () { return "Its pool hands out the business's network with the router as gateway and the provider's DNS servers, the gear's addresses kept back."; },
    rung1: function () { return "On the router: show ip dhcp pool and show running-config. Then renew a PC and look at what it got: ipconfig /all."; },
    rung2: function () { return "A DHCP server hands each client an address, its network's gateway and the DNS servers it should ask. Addresses already given to devices by hand have to be kept out of the pool."; }
  }, {
    id: "online", text: "Every PC is online again, names and all, and printing still works",
    causes: onlineCauses,
    ok: function (sim) { return "The " + name(sim, "pc") + ", the manager's PC and the " + name(sim, "bpc") + " reach the internet by name, and the printer prints."; },
    rung1: function () { return "On each PC: ipconfig /all, then ping by name. What does each one use as its DNS server, and where did that come from?"; },
    rung2: function () { return "A PC keeps the lease it was given until it asks again. Anything the old router handed out with it, like the DNS servers, stays until then."; }
  }, L_SAVED_RT],
  solve(v) {
    const p = v.plan;
    return [{ t: "place", dev: "rtr", room: "closet" }, { t: "lay", a: E("tech", "USB-C"), b: E("rtr", "CONSOLE") },
      cli(""), cli("enable"), cli("configure terminal"), cli("hostname " + p.rtHost), cli("enable secret " + p.rtSecret), cli("line console 0"), cli("password " + p.rtConsole), cli("login"), cli("exit"),
      cli("interface " + p.wanPort), cli("description PROVIDER"), cli("ip address dhcp"), cli("ip nat outside"), cli("no shutdown"),
      cli("interface " + p.lanPort), cli("description CLOSET-SWITCH"), cli("ip address " + p.lanGw + " " + p.mask), cli("ip nat inside"), cli("no shutdown"), cli("exit"),
      cli("ip dhcp excluded-address " + p.excl[0] + " " + p.excl[1]), cli("ip dhcp pool " + p.pool), cli("network " + p.lan + " " + p.mask), cli("default-router " + p.lanGw), cli("dns-server " + p.dns.join(" ")), cli("exit"),
      cli("access-list 1 permit " + p.lan + " 0.0.0.255"), cli("ip nat inside source list 1 interface " + p.wanPort + " overload"), cli("end"), cli("copy running-config startup-config"), cli(""),
      { t: "pull", cable: "c-modem-router" }, { t: "pull", cable: "c-router-msw" },
      { t: "lay", a: E("modem", "ETH"), b: E("rtr", "Gi0/0") }, { t: "lay", a: E("rtr", "Gi0/1"), b: E("msw", "24") }]
      .concat(PCS.map(function (id) { return { t: "cmd", dev: id, line: "ipconfig /renew" }; }));
  },
  answer(v) {
    const p = v.plan;
    return ["Place the router in the closet; console cable from your laptop's USB-C to its CON port; Serial terminal, RETURN, enable, configure terminal.",
      "hostname " + p.rtHost + "; enable secret (the business's); line console 0, password (the business's), login.",
      "interface " + p.wanPort + ": ip address dhcp, ip nat outside, no shutdown. interface " + p.lanPort + ": ip address " + p.lanGw + " " + p.mask + ", ip nat inside, no shutdown.",
      "ip dhcp excluded-address " + p.excl[0] + " " + p.excl[1] + "; ip dhcp pool " + p.pool + ": network " + p.lan + " " + p.mask + ", default-router " + p.lanGw + ", dns-server " + p.dns.join(" ") + ".",
      "access-list 1 permit " + p.lan + " 0.0.0.255; ip nat inside source list 1 interface " + p.wanPort + " overload; end; copy running-config startup-config.",
      "Pull the provider's router's two cables; modem ETH to Gi0/0, Gi0/1 to the closet switch's port 24. Then ipconfig /renew on each PC."];
  },
  summary(v, sim) {
    return ["The new router " + RT(sim).hostname + " runs the business: the provider's modem on " + v.plan.wanPort + ", the closet switch on " + v.plan.lanPort + " at " + v.plan.lanGw + ".",
      "Everyone shares the provider's address on the way out (PAT), and the router hands out the business's addresses with the provider's DNS servers.",
      "The provider's router is out, every PC renewed, and it's all saved."];
  }
};

/* ---------------------------------------------------------------- SB-J2: the staff VLAN */
/* the VLANs' lines are shared: SB-J2's staff VLAN and SB-J3's guest VLAN are checked the same way (k: "staff" or "guest") */
const VL = function (v, k) { return v.plan.vlans[k || "staff"]; };
const staff = function (v) { return VL(v, "staff"); };
const subName = function (v, k) { return v.plan.lanPort + "." + VL(v, k).id; };
/* what a subinterface not set nat inside costs each VLAN, and each VLAN's name in a line's words (the cameras' VLAN, SB-J5) */
const NAT_WHY = { staff: "so staff never get out", guest: "so guests never get out", cameras: "so nothing from outside is ever sent on to the cameras" };
const W = function (k) { return k === "cameras" ? "cameras'" : k; };
function vlanCauses(sim, v, k) {
  k = k || "staff";
  const sw = SW(sim), S = VL(v, k), vl = sw.vlans[S.id];
  return [C("none", !vl, "The closet switch has no " + k + " VLAN", "The " + k + " VLAN exists.", "show vlan brief: no VLAN " + S.id + "."),
    C("name", !!vl && vl.name !== S.name, "The " + k + " VLAN isn't named as the records say", "It's named as the records say.", "show vlan brief: VLAN " + S.id + " is " + (vl ? vl.name : "") + ".")];
}
function trunkCauses(sim, v) {
  const sw = SW(sim), m = between(sim, "rtr", "msw"), port = m ? "GigabitEthernet0/" + m.far : null, p = port && sw.ports[port], c = port ? carries(sw, port, null) : null;
  return [C("cable", !m, "The router isn't cabled to the closet switch", "The router is cabled to the switch.", "No cable joins the router and the closet switch."),
    C("mode", !!c && c.mode !== "trunk", "The switch's port to the router isn't a trunk: a router never negotiates one, so it stays an access port", "The router's port is a trunk.", "show interfaces trunk on the switch: nothing for Gi0/" + (m ? m.far : "") + "."),
    C("allowed", !!c && c.mode === "trunk" && c.tagged.indexOf(staff(v).id) < 0 && c.untagged !== staff(v).id, "The trunk doesn't carry the staff VLAN", "The trunk carries the staff VLAN.", "show interfaces trunk: VLAN " + staff(v).id + " isn't allowed and active on Gi0/" + (m ? m.far : "") + "."),
    C("native", !!c && c.mode === "trunk" && c.untagged !== 1, "The trunk's native VLAN isn't the one the old network still runs on", "Untagged frames still reach the old network.", "show interfaces trunk: native VLAN " + (p ? p.native : "") + ".")];
}
/* a VLAN's subinterface: the records' name, or failing that any subinterface on the inside port tagging that VLAN (its number is only a name) */
const vlanSub = function (R, v, k) {
  const n = subName(v, k); if (R.subs[n]) return n;
  return Object.keys(R.subs).find(function (q) { return q.split(".")[0] === v.plan.lanPort && R.subs[q].vlan === VL(v, k).id; }) || null;
};
const staffSub = function (R, v) { return vlanSub(R, v, "staff"); };
function subCauses(sim, v, k) {
  k = k || "staff";
  const R = view(sim), S = VL(v, k), q = vlanSub(R, v, k), n = q || subName(v, k), f = q ? R.subs[q] : null, any = Object.keys(R.subs).find(function (z) { return R.subs[z].vlan === S.id; }), w = W(k);
  return [C("none", !f && !any, "The router has no subinterface for the " + w + " VLAN", "There's a subinterface for the " + w + " VLAN.", "show ip interface brief on the router: no " + n + "."),
    C("other", !f && !!any, "The " + w + " VLAN's subinterface is on a port the switch isn't cabled to", "It's on the inside port.", "show ip interface brief: the " + w + " VLAN is on " + any + "."),
    C("tag", !!f && f.vlan !== S.id, "The subinterface doesn't tag the " + w + " VLAN", "It tags the " + w + " VLAN.", "show running-config: " + n + (f && f.vlan ? " has encapsulation dot1Q " + f.vlan : " has no encapsulation line") + "."),
    C("addr", !!f && f.vlan === S.id && (f.ip !== S.gw || f.mask !== v.plan.vmask), "Its address isn't the " + w + " network's gateway from the records", "Its address is the " + w + " gateway.", "show ip interface brief: " + n + " is " + (f && f.ip ? f.ip : "unassigned") + "."),
    C("shut", !!f && rtStatus(R, n)[1] !== "up", "The subinterface is down", "It's up.", "show ip interface brief: " + n + " is down."),
    C("nat", !!f && f.nat !== "inside", "The subinterface isn't NAT's inside, " + NAT_WHY[k], "It's NAT's inside.", "show running-config: no ip nat inside on " + n + ".")].concat(
    /* the cameras never go out through NAT's list: only their forwards are translated, and those are static */
    k === "cameras" ? [] : [C("list", !!f && !RT(sim).nat.some(function (x) { return RT(sim).acls[x.list] && aclVerdict(RT(sim), x.list, { proto: "ip", src: S.net.replace(/\.0$/, ".50"), dst: "8.8.8.8" }).permit; }), "The NAT rule's access list doesn't take the " + k + " network", "The " + k + " network is translated too.", "show access-lists: the " + k + " addresses match no permit in NAT's list.")]);
}
/* a VLAN's pool: staff's and the guests' keep their first ten addresses back and hand out the provider's DNS servers; the
   cameras' keep their first twenty back (their fixed addresses are among them) and need no DNS, since they never go out */
function poolCauses(sim, v, k) {
  k = k || "staff";
  const r = RT(sim), S = VL(v, k), q = Object.keys(r.pools).find(function (z) { return r.pools[z].network === S.net && r.pools[z].mask === v.plan.vmask; }), P = q ? r.pools[q] : null, w = W(k);
  const keep = k === "cameras" ? v.plan.camExcl : 10, kept = keep === 20 ? "twenty" : "ten";
  const A = q ? poolAddrs(r, q) : [], gwOut = A.indexOf(S.gw) >= 0 || A.some(function (ip) { return ip2n(ip) <= ip2n(S.gw) + keep - 1; });
  return [C("pool", !P, "The router has no pool for the " + w + " network", "There's a pool for the " + w + " network.", "show ip dhcp pool: nothing for " + S.net + "/24."),
    C("gw", !!P && P.router[0] !== S.gw, "The " + w + " pool hands out the wrong gateway, or none", "It hands out the " + w + " gateway.", "The " + w + " pool's default-router is " + (P && P.router[0] || "not set") + ".")].concat(
    k === "cameras" ? [] : [C("dns", !!P && !(P.dns.length && P.dns.every(function (d) { return v.plan.dns.indexOf(d) >= 0; })), "The " + k + " pool hands out no DNS servers, or not the provider's", "It hands out the provider's DNS servers.", "The " + k + " pool's dns-server is " + (P && P.dns.join(" ") || "not set") + ".")],
    [C("excl", !!P && gwOut, k === "cameras" ? "The first twenty cameras' addresses (the gateway's and the cameras' fixed ones) aren't kept back" : "The first ten " + k + " addresses (the gateway's and the gear's) aren't kept back", "The first " + kept + " are excluded.", "show ip dhcp pool: the " + w + " pool starts " + (A.length && ip2n(A[0]) <= ip2n(S.gw) + keep - 1 ? "at " + A[0] : "at its first address") + ".")]);
}
const staffPoolCauses = function (sim, v) { return poolCauses(sim, v, "staff"); };
function movedCauses(sim, v) {
  const sw = SW(sim), S = staff(v), rows = PCS.map(function (id) { const m = between(sim, id, "msw"); return { id: id, port: m ? "GigabitEthernet0/" + m.far : null }; });
  const notIn = rows.find(function (x) { return !x.port || carries(sw, x.port, null).untagged !== S.id; });
  const a = function (id) { return sim.addr(id); }, notAddr = PCS.find(function (id) { const x = a(id); return !x || x.kind === "apipa" || !(ip2n(x.ip) >= ip2n(S.net) && ip2n(x.ip) < ip2n(S.net) + 256); });
  const notOn = PCS.find(function (id) { return !online(sim, id); });
  return [C("port", !!notIn, "The " + (notIn ? name(sim, notIn.id) : "") + "'s switch port isn't in the staff VLAN", "Every staff PC's port is in the staff VLAN.", "show vlan brief: the " + (notIn ? name(sim, notIn.id) : "") + "'s port isn't in VLAN " + S.id + "."),
    C("renew", !notIn && !!notAddr, "The " + (notAddr ? name(sim, notAddr) : "") + " still has its old address: it hasn't asked again since its port moved", "Every staff PC has a staff address.", "ipconfig on the " + (notAddr ? name(sim, notAddr) : "") + ": " + (notAddr && a(notAddr) ? a(notAddr).ip : "no address") + "."),
    C("net", !notIn && !notAddr && !!notOn, "The " + (notOn ? name(sim, notOn) : "") + " has a staff address but can't reach the internet", "Every staff PC is online.", "ping from the " + (notOn ? name(sim, notOn) : "") + ": no replies from the internet."),
    C("print", !printOk(sim), "Staff can't reach the printer, still on the old network", "Staff can print, through the router.", "Test pages from the " + name(sim, "pc") + " don't print.")];
}
function swSavedCauses(sim) { return savedCauses(sim, "msw"); }
const SB2 = {
  id: "SB-J2", level: "business", title: "The staff VLAN: a trunk to the router, a subinterface, its own addresses",
  already: ["saved", "swsaved"],
  start(seed) {
    const b = SB1.start(seed), sim = b.sim;
    for (const a of SB1.solve(b.v)) { if (a.t === "cmd") exec(sim, a.dev, a.line); else sim.apply(a); }
    /* the provider collected their router; a day later the console asks for its password again */
    delete sim.d.router; delete sim.net.rooms.router; sim.cli = {};
    return { sim: sim, v: b.v };
  },
  brief(v, sim) { return { quote: "Step one of the separate networks: staff first. Put our three PCs on their own network, as the plan says, without anyone losing the internet or the printer. The printer and the switch stay where they are for now.", from: sim.net.client.manager + ", " + sim.net.client.name }; },
  mason: "The router does the routing between VLANs, so it needs every VLAN on one cable: a trunk. Make the VLAN, the trunk and the subinterface first; move the PCs last.",
  limits: function (v) { const S = staff(v), p = v.plan; return ["The business's plan: staff are VLAN " + S.id + ", named " + S.name + ", on " + S.net + "/24 with the gateway " + S.gw + " on the router's " + subName(v) + ". The first ten addresses are kept back.",
    "The old network (" + p.lan + "/24, the printer and the switch's own address) stays untagged on the same cable: VLAN 1 on the switch, " + p.lanPort + " itself on the router.",
    "The staff PCs are on the closet switch's ports 1, 2 and 4.", "The router's and the switch's records are as before: router " + p.rtHost + " (secret " + p.rtSecret + ", console " + p.rtConsole + "); switch " + p.swHost + " (secret " + p.swSecret + ", console " + p.swConsole + ")."]; },
  reqs: [{
    id: "vlan", text: "The closet switch has the staff VLAN, named as the records say",
    causes: function (sim, v) { return vlanCauses(sim, v, "staff"); },
    ok: function (sim, v) { return "VLAN " + staff(v).id + " " + staff(v).name + " exists on the closet switch."; },
    rung1: function () { return "On the closet switch: show vlan brief."; },
    rung2: function () { return "A VLAN has to exist on a switch before the switch carries it anywhere; its name is for the people reading the configuration."; }
  }, {
    id: "trunk", text: "The router's cable carries both networks: a trunk, the old network untagged on it",
    causes: trunkCauses,
    ok: function () { return "The switch's port to the router is a trunk carrying the staff VLAN, with the old network as its native VLAN."; },
    rung1: function () { return "On the closet switch: show interfaces trunk, and show interfaces (the router's port) switchport."; },
    rung2: function () { return "One cable carries several VLANs only as a trunk: each frame tagged with its VLAN, except the native VLAN's, sent untagged. A port left to negotiate stays an access port when the far end never asks."; }
  }, {
    id: "sub", text: "The router has the staff gateway on a subinterface, NAT'd like the rest",
    causes: function (sim, v) { return subCauses(sim, v, "staff"); },
    ok: function (sim, v) { return staffSub(view(sim), v) + " tags VLAN " + staff(v).id + " at " + staff(v).gw + ", NAT's inside, in NAT's list."; },
    rung1: function () { return "On the router: show ip interface brief, then show running-config for the subinterface and the NAT lines."; },
    rung2: function () { return "Router on a stick: one subinterface per VLAN on the trunk's port, each tagged with its VLAN and holding that VLAN's gateway. Each is a network of its own to NAT."; }
  }, {
    id: "pool", text: "The router hands out staff addresses on the staff VLAN",
    causes: staffPoolCauses,
    ok: function () { return "A pool for the staff network, with its gateway and the provider's DNS servers, the first ten kept back."; },
    rung1: function () { return "On the router: show ip dhcp pool, and the pool's lines in show running-config."; },
    rung2: function () { return "A DHCP server answers on the network its interface is on: the staff subinterface needs a pool for the staff network."; }
  }, {
    id: "moved", text: "The staff PCs are on the staff VLAN, online, and printing",
    causes: movedCauses,
    ok: function () { return "The three staff PCs have staff addresses, reach the internet, and print to the printer through the router."; },
    rung1: function () { return "On the switch: show vlan brief. On each PC: ipconfig, then ping out and print."; },
    rung2: function () { return "A port's VLAN decides which network a PC is on. A PC only finds out when it asks again for an address."; }
  }, L_SAVED_RT, {
    id: "swsaved", text: "The switch's setup survives a power cut",
    causes: swSavedCauses,
    ok: function () { return "What's running on the closet switch is saved."; },
    rung1: function () { return "On the closet switch: compare show running-config with show startup-config."; },
    rung2: function () { return "Every device keeps its own startup configuration: saving the router saves nothing on the switch."; }
  }],
  solve(v) {
    const p = v.plan, S = staff(v), sw = function (l) { return { t: "cmd", dev: "tech", line: l, cli: true }; };
    return [{ t: "pull", cable: "c-console-1" }, { t: "lay", a: E("tech", "USB-C"), b: E("msw", "CONSOLE") },
      sw(""), sw(p.swConsole), sw("enable"), sw(p.swSecret), sw("configure terminal"), sw("vlan " + S.id), sw("name " + S.name), sw("exit"),
      sw("interface gi0/24"), sw("switchport mode trunk"), sw("interface range gi0/1 - 2"), sw("switchport mode access"), sw("switchport access vlan " + S.id),
      sw("interface gi0/4"), sw("switchport mode access"), sw("switchport access vlan " + S.id), sw("end"), sw("copy running-config startup-config"), sw(""),
      { t: "pull", cable: "c-console-4" }, { t: "lay", a: E("tech", "USB-C"), b: E("rtr", "CONSOLE") },   /* runs are numbered in the order they're laid: SB-J1 laid three */
      sw(""), sw(p.rtConsole), sw("enable"), sw(p.rtSecret), sw("configure terminal"), sw("interface " + subName(v)), sw("encapsulation dot1Q " + S.id), sw("ip address " + S.gw + " " + p.vmask), sw("ip nat inside"), sw("exit"),
      sw("ip dhcp excluded-address " + S.gw + " " + S.net.replace(/\.0$/, ".10")), sw("ip dhcp pool " + S.name), sw("network " + S.net + " " + p.vmask), sw("default-router " + S.gw), sw("dns-server " + p.dns.join(" ")), sw("exit"),
      sw("access-list 1 permit " + S.net + " 0.0.0.255"), sw("end"), sw("copy running-config startup-config"), sw("")]
      .concat(PCS.map(function (id) { return { t: "cmd", dev: id, line: "ipconfig /renew" }; }));
  },
  answer(v) {
    const p = v.plan, S = staff(v);
    return ["On the closet switch (console): vlan " + S.id + ", name " + S.name + "; interface gi0/24: switchport mode trunk; ports 1, 2 and 4: switchport mode access, switchport access vlan " + S.id + "; save.",
      "On the router (console): interface " + subName(v) + ": encapsulation dot1Q " + S.id + ", ip address " + S.gw + " " + p.vmask + ", ip nat inside.",
      "ip dhcp excluded-address " + S.gw + " " + S.net.replace(/\.0$/, ".10") + "; ip dhcp pool " + S.name + ": network " + S.net + " " + p.vmask + ", default-router " + S.gw + ", dns-server " + p.dns.join(" ") + ".",
      "access-list 1 permit " + S.net + " 0.0.0.255 (NAT's list); save. Then ipconfig /renew on each staff PC."];
  },
  summary(v, sim) {
    const S = staff(v);
    return ["Staff are on VLAN " + S.id + " (" + S.name + "), " + S.net + "/24, their gateway " + S.gw + " on the router's " + subName(v) + ".",
      "One cable carries both networks: the switch's port to the router is a trunk, the old network untagged on it.",
      "Staff get their addresses from the router, reach the internet through NAT, and print to the printer on the old network through the router.", "Both devices are saved."];
  }
};

/* ---------------------------------------------------------------- SB-J3: guest Wi-Fi on a ceiling access point */
/* the visitor's phone joined, with no address to show for it */
const noLease = function (sim) { const l = sim.wifiLink("guest"), a = sim.addr("guest"); return !!(l && l.connected) && (!a || a.kind === "apipa"); };
const guest = function (v) { return VL(v, "guest"); };
const roomOf = function (sim, r) { return "the " + String(sim.net.roomNames[r] || r).replace(/^[A-Z](?=[a-z])/, function (m) { return m.toLowerCase(); }); };
const apAddr = function (sim) { const a = sim.on("ap") && sim.addr("ap"); return a && a.kind !== "apipa" ? a.ip : null; };
const inNet = function (ip, net) { return !!ip && ip2n(ip) >= ip2n(net) && ip2n(ip) < ip2n(net) + 256; };
/* the access point's way back to the switch: its cable, the injector's two ends, and the switch port it lands on */
function apPath(sim) {
  const c = sim.cableAt("ap", "ETH"), far = c && (c.a.dev === "ap" ? c.b : c.a), out = { cable: c, far: far, inj: !!far && far.dev === "injector", up: null, swPort: null };
  if (out.inj) { const ci = sim.cableAt("injector", far.port === "PoE OUT" ? "DATA IN" : "PoE OUT"); out.up = ci ? (ci.a.dev === "injector" ? ci.b : ci.a) : null; }
  else out.up = far;
  if (out.up && out.up.dev === "msw" && /^\d+$/.test(out.up.port)) out.swPort = out.up.port;
  return out;
}
/* can a guest reach an address: the visitor's phone when it's on the guest network, otherwise a guest's packet put to the
   router's lists (in on the guest subinterface, out where it would leave) */
function guestReaches(sim, v, ip) {
  if (!ip) return false;
  const g = sim.addr("guest");
  if (g && g.kind !== "apipa" && inNet(g.ip, guest(v).net)) { const r = sim.route("guest", ip); return !!((r.local || r.routed) && !r.fail); }
  const R = RT(sim), q = vlanSub(view(sim), v, "guest"); if (!q) return false;
  const pk = { proto: "ip", src: guest(v).net.replace(/\.0$/, ".50"), dst: ip }, f = R.subs[q];
  if (f.aclIn && !aclVerdict(R, f.aclIn, pk).permit) return false;
  const outIf = Object.keys(R.subs).concat(Object.keys(R.ifs)).find(function (n) { const x = R.subs[n] || R.ifs[n]; return x.ip && x.mask && netOf(x.ip, x.mask) === netOf(ip, x.mask); });
  const o = outIf && (R.subs[outIf] || R.ifs[outIf]);
  return !(o && o.aclOut && !aclVerdict(R, o.aclOut, pk).permit);
}
function mountCauses(sim, v) {
  const x = sim.d.ap, P = apPath(sim), inj = sim.d.injector, room = sim.net.rooms.ap;
  const fromSwitch = !!P.cable && !P.inj, fromDataIn = P.inj && P.far.port === "DATA IN", noAdapter = P.inj && P.far.port === "PoE OUT" && !inj.power;
  return [C("box", x.boxed, "The access point is still in its box", "It's out of its box.", "The ceiling access point is still in its box."),
    C("room", !x.boxed && room !== "guest", "It isn't on the ceiling plate the records give it, over the guests", "It's on its plate in " + roomOf(sim, "guest") + ".", "The access point is in " + roomOf(sim, room) + "."),
    C("cable", !x.boxed && !P.cable, "Nothing is plugged into the access point", "It's cabled.", "The access point's ETH port is empty."),
    C("switch", fromSwitch, "Its cable comes straight from a port that gives no power: the closet switch has no PoE", "Its power comes from the injector.", "The access point is dark; its cable goes straight to the " + (P.far ? name(sim, P.far.dev) : "") + "."),
    C("datain", fromDataIn, "Its cable is in the injector's DATA IN: the power comes out of the other port", "It's on the injector's power side.", "The access point is dark; its cable is in the injector's DATA IN."),
    C("adapter", noAdapter, "The injector's own power adapter isn't plugged in", "The injector has power.", "The injector's POWER light is off."),
    C("power", !!P.cable && !x.boxed && !sim.on("ap") && !fromSwitch && !fromDataIn && !noAdapter, "The access point gets no power down its cable", "It's powered over its cable.", "The access point's ring is dark.")];
}
function uplinkCauses(sim, v) {
  const P = apPath(sim), sw = SW(sim), port = P.swPort ? "GigabitEthernet0/" + P.swPort : null, sp = port && sw.ports[port], want = v.plan.apPort;
  return [C("power", !sim.on("ap"), "The access point isn't powered yet", "It's powered.", "The access point is dark."),
    C("datain", sim.on("ap") && P.inj && !P.up, "Nothing is plugged into the injector's DATA IN: the access point has power but no network", "The injector's data side is cabled.", "The injector's DATA IN is empty."),
    C("where", sim.on("ap") && !!P.up && P.up.dev !== "msw", "The injector's data side goes to the " + (P.up ? name(sim, P.up.dev) : "") + ", not the closet switch", "It goes back to the closet switch.", "The injector's DATA IN goes to the " + (P.up ? name(sim, P.up.dev) : "") + "."),
    C("port", !!P.swPort && P.swPort !== want, "It's on a switch port the records keep for something else", "It's on the port the records give it.", "The access point's run is in the closet switch's port " + P.swPort + "."),
    C("shut", !!sp && sp.shutdown, "The switch's port for it is shut down, as every spare is", "Its port is open.", "show interfaces status: Gi0/" + P.swPort + " disabled."),
    C("desc", !!sp && !sp.shutdown && String(sp.desc || "").toUpperCase() !== v.plan.apDesc, "Its port isn't described as the records say", "Its port is described as the records say.", "show interfaces status: Gi0/" + P.swPort + "'s name is " + (sp && sp.desc ? sp.desc : "blank") + ".")];
}
function apTrunkCauses(sim, v) {
  const P = apPath(sim), sw = SW(sim), port = P.swPort ? "GigabitEthernet0/" + P.swPort : null, c = port ? carries(sw, port, null) : null, G = guest(v);
  const up = between(sim, "rtr", "msw"), uc = up ? carries(sw, "GigabitEthernet0/" + up.far, null) : null;
  return [C("path", !port, "The access point isn't on a switch port yet", "It's on a switch port.", "The access point's run doesn't reach the closet switch."),
    C("mode", !!c && c.mode !== "trunk", "Its port isn't a trunk: an access point never negotiates one, so the port stays an access port", "Its port is a trunk.", "show interfaces trunk: nothing for Gi0/" + P.swPort + "."),
    C("allowed", !!c && c.mode === "trunk" && c.tagged.indexOf(G.id) < 0 && c.untagged !== G.id, "The trunk to it doesn't carry the guest VLAN", "It carries the guest VLAN.", "show interfaces trunk: VLAN " + G.id + " isn't allowed and active on Gi0/" + P.swPort + "."),
    C("native", !!c && c.mode === "trunk" && c.untagged !== 1, "Its native VLAN isn't the old network's: the access point's own address has nowhere to come from", "Its untagged frames reach the old network.", "show interfaces trunk: Gi0/" + P.swPort + "'s native VLAN is " + (c ? c.untagged : "") + "."),
    C("uplink", !!uc && uc.mode === "trunk" && uc.tagged.indexOf(G.id) < 0, "The trunk to the router doesn't carry the guest VLAN", "The trunk to the router carries it.", "show interfaces trunk: VLAN " + G.id + " isn't allowed and active on Gi0/" + (up ? up.far : "") + ".")];
}
function ssidCauses(sim, v) {
  const x = sim.d.ap, p = v.plan, G = guest(v), w = (x.ssids || []).find(function (n) { return n.ssid === p.guestSsid; }), other = (x.ssids || []).find(function (n) { return n.ssid !== p.guestSsid; });
  return [C("noaddr", !w && !apAddr(sim), "The access point has no address, so its web page can't be opened", "It has an address.", "show ip dhcp binding on the router: no lease for the access point."),
    C("none", !w, "It broadcasts no network named as the records say", "Its network is named as the records say.", "The access point's page lists " + ((x.ssids || []).length ? (x.ssids || []).map(function (n) { return n.ssid; }).join(", ") : "no networks") + "."),
    C("open", !!w && w.sec === "Open", "The guest network is open: anyone in range joins it, with no password", "It's secured.", "The access point's page: " + p.guestSsid + ", Open."),
    C("wpa3", !!w && w.sec === "WPA3-Personal", "WPA3 only: the older phones the records mention can't join it", "WPA2 is allowed.", "The access point's page: " + p.guestSsid + ", WPA3-Personal only."),
    C("pw", !!w && w.sec !== "Open" && w.psk !== p.guestPw, "Its password isn't the one in the records (the card in the waiting area)", "Its password is the records'.", "The visitors' card's password isn't accepted."),
    C("untagged", !!w && !w.vlan, "It puts guests on the access point's own network, untagged: straight onto the business's old network", "It tags the guests' traffic.", "The access point's page: " + p.guestSsid + ", no VLAN."),
    C("vlan", !!w && !!w.vlan && w.vlan !== G.id, "It tags the guest network with a different VLAN from the records'", "It tags the guest VLAN.", "The access point's page: " + p.guestSsid + ", VLAN " + (w ? w.vlan : "") + "."),
    C("extra", !!w && !!other, "It also broadcasts a network the records don't have", "It broadcasts only the guest network.", "The access point's page also lists " + (other ? other.ssid : "") + ".")];
}
function visitorCauses(sim, v) {
  const p = v.plan, G = guest(v), f = sim.d.guest.ifaces[0], l = sim.wifiLink("guest"), a = sim.addr("guest");
  const joined = f.saved.ssid === p.guestSsid, ok = !!a && a.kind !== "apipa", on = joined && !!l && l.connected;
  return [C("unjoined", !joined, "The visitor's phone hasn't joined the guest network", "It's joined to the guest network.", "The visitor's phone: " + (f.saved.ssid ? "joined to " + f.saved.ssid : "not connected") + "."),
    C("unseen", joined && !!l && !l.connected && l.reason === "no-network", "The visitor's phone can't see the guest network", "The phone sees it.", "The visitor's phone: " + p.guestSsid + " isn't in its list of networks."),
    C("auth", joined && !!l && !l.connected && l.reason === "auth", "The phone was given a password the guest network doesn't take", "The password was right.", "The visitor's phone: the password was rejected."),
    C("security", joined && !!l && !l.connected && l.reason === "security", "The phone can't use the guest network's security", "The phone can use its security.", "The visitor's phone: can't connect to this network."),
    C("addr", on && !ok, "The phone joined but got no address", "It has an address.", "The visitor's phone: " + (a ? a.ip : "no address") + "."),
    C("lan", on && ok && !inNet(a.ip, G.net), "The phone has an address from the business's own network, not the guests'", "It's on the guest network.", "The visitor's phone: " + (a ? a.ip : "") + "."),
    C("net", on && ok && inNet(a.ip, G.net) && !sim.route("guest", "203.0.113.80").internet, "The phone has a guest address but can't reach the internet", "It reaches the internet.", "The visitor's phone: no internet."),
    C("dns", on && ok && sim.route("guest", "203.0.113.80").internet && !online(sim, "guest"), "The phone reaches the internet but names don't look up", "Names look up.", "The visitor's phone: no website opens by name."),
    C("off", joined && !online(sim, "guest"), "The visitor's phone isn't online", "It's online.", "The visitor's phone: no internet.")];   /* the last word: never met while the phone is offline, whatever the reason */
}
function apartCauses(sim, v) {
  const pcIp = sim.addr("pc") && sim.addr("pc").ip, prIp = printerIp(sim), ip = apAddr(sim);
  const q = vlanSub(view(sim), v, "guest"), routed = !!q && !!RT(sim).subs[q].ip;
  return [C("none", !routed, "There's no guest network yet to keep apart", "The guest network is routed.", "Nothing on the router routes the guest VLAN yet."),
    C("staff", guestReaches(sim, v, pcIp), "Guests reach the staff PCs: nothing between the two networks stops them", "Guests can't reach the staff PCs.", "From the guest network, the " + name(sim, "pc") + "'s address answers."),
    C("printer", guestReaches(sim, v, prIp), "Guests reach the printer", "Guests can't reach the printer.", "From the guest network, the printer's address answers."),
    C("switch", guestReaches(sim, v, v.plan.swIp), "Guests reach the closet switch's management address", "Guests can't reach the switch.", "From the guest network, the closet switch's address answers."),
    C("ap", !!ip && guestReaches(sim, v, ip), "Guests reach the access point's own page", "Guests can't reach the access point's page.", "From the guest network, the access point's own address answers.")];
}
function staffStillCauses(sim, v) {
  const down = PCS.find(function (id) { return !online(sim, id); }), ip = apAddr(sim), r = ip ? sim.route("mgr", ip) : null;
  return [C("net", !!down, "The " + (down ? name(sim, down) : "") + " is offline", "Every staff PC is online.", "ping from the " + (down ? name(sim, down) : "") + ": no replies from the internet."),
    C("print", !printOk(sim), "Staff can't print", "Staff print.", "Test pages from the " + name(sim, "pc") + " don't print."),
    C("ap", !!r && !((r.local || r.routed) && !r.fail), "The manager's PC can't reach the access point's page", "The access point's page opens from the manager's PC.", "From the manager's PC the access point's address doesn't answer.")];
}
const SB3 = {
  id: "SB-J3", level: "business", title: "Guest Wi-Fi: a ceiling access point, its own VLAN, kept away from the business",
  already: ["staff", "saved", "swsaved"],
  start(seed) {
    const b = SB2.start(seed), sim = b.sim;
    for (const a of SB2.solve(b.v)) { if (a.t === "cmd") exec(sim, a.dev, a.line); else sim.apply(a); }
    addGuestKit(sim); sim.cli = {};   /* the access point and the injector arrived in their boxes; a visitor is waiting */
    return { sim: sim, v: b.v };
  },
  brief(v, sim) { return { quote: "People waiting keep asking for the Wi-Fi password, and we won't give them ours. We've bought a ceiling access point; the plate is already up in " + roomOf(sim, "guest") + ". Give our visitors their own Wi-Fi, and make sure nobody on it can ever get near our computers, the printer or anything else of ours. There's someone waiting now who'd like to try it.", from: sim.net.client.manager + ", " + sim.net.client.name }; },
  mason: "The access point puts the guests on their own VLAN, so its switch port is a trunk, and it takes its own address untagged on the old network. The router routes the guests out; an access list on their way in is what keeps them away from everything that's the business's.",
  limits: function (v) { const G = guest(v), S = staff(v), p = v.plan;
    return ["The business's plan: guests are VLAN " + G.id + ", named " + G.name + ", on " + G.net + "/24 with the gateway " + G.gw + " on the router's " + subName(v, "guest") + ". The first ten addresses are kept back. Their access list, in on that subinterface, is named " + p.guestAcl + ".",
      "The guest Wi-Fi (on the card in the waiting area): " + p.guestSsid + ", password " + p.guestPw + ", WPA2 (WPA2/WPA3 transition is fine: older phones need WPA2).",
      "The access point's run is on the closet switch's port " + p.apPort + ", described " + p.apDesc + ". The switch gives no power: a PoE injector from the van goes in the closet.",
      "The access point takes its own address by DHCP, untagged, on the old network (" + p.lan + "/24). Its web page is at that address: open it from the manager's PC.",
      "Staff are VLAN " + S.id + " on " + S.net + "/24. The router and switch records are as before: router " + p.rtHost + " (secret " + p.rtSecret + ", console " + p.rtConsole + "); switch " + p.swHost + " (secret " + p.swSecret + ", console " + p.swConsole + ")."]; },
  reqs: [{
    id: "mount", text: "The access point is on its ceiling plate over the guests, powered over its cable",
    causes: mountCauses,
    ok: function (sim) { return "It's on its plate in " + roomOf(sim, "guest") + ", powered by the injector."; },
    rung1: function () { return "Look at the access point's Physical tab and its ring; then the Cable runs table: where does its cable come from?"; },
    rung2: function () { return "A ceiling access point is powered down its network cable (PoE). A switch with no PoE needs an injector in between: data in on one side, data and power out on the other."; }
  }, {
    id: "uplink", text: "Its cable runs back to the closet switch, on the port the records give it, open and described",
    causes: uplinkCauses,
    ok: function (sim, v) { return "Its run reaches the closet switch's port " + v.plan.apPort + ", open and described."; },
    rung1: function () { return "Follow the cable from the access point through the injector to the switch; then show interfaces status on the switch."; },
    rung2: function () { return "Every spare port on this switch was shut down on purpose. Opening one for a new device, and naming it, is part of putting the device in."; }
  }, {
    id: "vlan", text: "The closet switch has the guest VLAN, named as the records say",
    causes: function (sim, v) { return vlanCauses(sim, v, "guest"); },
    ok: function (sim, v) { return "VLAN " + guest(v).id + " " + guest(v).name + " exists on the closet switch."; },
    rung1: function () { return "On the closet switch: show vlan brief."; },
    rung2: function () { return "A VLAN has to exist on a switch before the switch carries it anywhere; its name is for the people reading the configuration."; }
  }, {
    id: "trunk", text: "The access point's port is a trunk: the guest network tagged, the access point itself untagged on the old network",
    causes: apTrunkCauses,
    ok: function () { return "The access point's port is a trunk carrying the guest VLAN, native on the old network, and the trunk to the router carries the guest VLAN too."; },
    rung1: function () { return "On the closet switch: show interfaces trunk, then show interfaces (the access point's port) switchport."; },
    rung2: function () { return "An access point with several networks tags each one with its VLAN and sends its own traffic untagged. Its switch port has to carry all of them: a trunk, its native VLAN the one the access point's own address belongs to."; }
  }, {
    id: "sub", text: "The router has the guest gateway on a subinterface, NAT'd like the rest",
    causes: function (sim, v) { return subCauses(sim, v, "guest"); },
    ok: function (sim, v) { return vlanSub(view(sim), v, "guest") + " tags VLAN " + guest(v).id + " at " + guest(v).gw + ", NAT's inside, in NAT's list."; },
    rung1: function () { return "On the router: show ip interface brief, then show running-config for the subinterfaces and the NAT lines."; },
    rung2: function () { return "Each VLAN on the trunk gets its own subinterface on the router, tagged with its VLAN and holding that VLAN's gateway, and each is a network of its own to NAT."; }
  }, {
    id: "pool", text: "The router hands out guest addresses on the guest VLAN",
    causes: function (sim, v) { return poolCauses(sim, v, "guest"); },
    ok: function () { return "A pool for the guest network, with its gateway and the provider's DNS servers, the first ten kept back."; },
    rung1: function () { return "On the router: show ip dhcp pool, and the pool's lines in show running-config."; },
    rung2: function () { return "A DHCP server answers on the network its interface is on: the guest subinterface needs a pool for the guest network."; }
  }, {
    id: "ssid", text: "The access point broadcasts the guest network from the records, secured, on the guest VLAN",
    causes: ssidCauses,
    ok: function (sim, v) { return v.plan.guestSsid + " is on the air, WPA2, tagged VLAN " + guest(v).id + "."; },
    rung1: function () { return "Find the access point's address (the router's DHCP bindings, or the switch's neighbours), then open its web page from the manager's PC."; },
    rung2: function () { return "Each network an access point broadcasts has a name, a security setting with its password, and the VLAN its traffic is tagged with. Untagged, it lands on the access point's own network."; }
  }, {
    id: "visitor", text: "The visitor's phone joins the guest network and gets online",
    causes: visitorCauses,
    ok: function () { return "The visitor's phone is on the guest network, online, names and all."; },
    /* joined but no address (the DHCP trap the owner kept, 25 October 2026): the hints point at what the guests' first message meets */
    rung1: function (v, sim) { return noLease(sim) ? "The phone's first message goes in at the router's guest subinterface: look at what's applied there, and what it has counted (show ip interface, show access-lists)." : "Open the visitor's phone: its Wi-Fi tab lists the networks it can hear."; },
    rung2: function (v, sim) { return noLease(sim) ? "A phone with no address asks for one with a broadcast from 0.0.0.0 to UDP port 67. Anything checking what comes in from the guests sees that request before any other traffic, and an access list ends with a deny you never see." : "A phone joins a secured network with its password, then asks for an address on whatever network that puts it on."; }
  }, {
    id: "apart", text: "Guests can't reach the staff PCs, the printer, the switch or the access point's page",
    causes: apartCauses,
    ok: function () { return "From the guest network, nothing of the business's answers."; },
    rung1: function () { return "On the router: show access-lists, and which interface each list is applied to, in which direction (show running-config)."; },
    rung2: function () { return "A router routes between every network it's on unless something stops it. An access list in on the guests' interface is checked against every packet they send, first match wins, and anything not permitted is dropped."; }
  }, {
    id: "staff", text: "Staff still reach the internet, the printer and the access point's page",
    causes: staffStillCauses,
    ok: function () { return "Staff are online, print, and reach the access point's page."; },
    rung1: function () { return "From a staff PC: ping out, print a test page, and ping the access point."; },
    rung2: function () { return "An access list applied in the wrong place or direction can stop the wrong people. Each list should only see the traffic it's meant for."; }
  }, L_SAVED_RT, {
    id: "swsaved", text: "The switch's setup survives a power cut",
    causes: swSavedCauses,
    ok: function () { return "What's running on the closet switch is saved."; },
    rung1: function () { return "On the closet switch: compare show running-config with show startup-config."; },
    rung2: function () { return "Every device keeps its own startup configuration: saving the router saves nothing on the switch."; }
  }],
  solve(v) {
    const p = v.plan, G = guest(v), S = staff(v), t = function (l) { return { t: "cmd", dev: "tech", line: l, cli: true }; }, w = "0.0.0.255";
    return [{ t: "place", dev: "injector", room: "closet" }, { t: "place", dev: "ap", room: "guest" },
      { t: "lay", a: E("msw", p.apPort), b: E("injector", "DATA IN") }, { t: "lay", a: E("injector", "PoE OUT"), b: E("ap", "ETH") },
      { t: "pull", cable: "c-console-5" }, { t: "lay", a: E("tech", "USB-C"), b: E("msw", "CONSOLE") },   /* runs are numbered in the order they're laid: SB-J1 laid three, SB-J2 two */
      t(""), t(p.swConsole), t("enable"), t(p.swSecret), t("configure terminal"), t("vlan " + G.id), t("name " + G.name), t("exit"),
      t("interface gi0/" + p.apPort), t("description " + p.apDesc), t("switchport mode trunk"), t("switchport trunk allowed vlan 1," + G.id), t("no shutdown"), t("end"), t("copy running-config startup-config"), t(""),
      { t: "pull", cable: "c-console-8" }, { t: "lay", a: E("tech", "USB-C"), b: E("rtr", "CONSOLE") },
      t(""), t(p.rtConsole), t("enable"), t(p.rtSecret), t("configure terminal"),
      t("interface " + subName(v, "guest")), t("encapsulation dot1Q " + G.id), t("ip address " + G.gw + " " + p.vmask), t("ip nat inside"), t("ip access-group " + p.guestAcl + " in"), t("exit"),
      t("ip access-list extended " + p.guestAcl), t("permit udp any any eq bootps"), t("deny ip " + G.net + " " + w + " " + S.net + " " + w), t("deny ip " + G.net + " " + w + " " + p.lan + " " + w), t("permit ip " + G.net + " " + w + " any"), t("exit"),
      t("ip dhcp excluded-address " + G.gw + " " + G.net.replace(/\.0$/, ".10")), t("ip dhcp pool " + G.name), t("network " + G.net + " " + p.vmask), t("default-router " + G.gw), t("dns-server " + p.dns.join(" ")), t("exit"),
      t("access-list 1 permit " + G.net + " " + w), t("end"), t("copy running-config startup-config"), t(""),
      { t: "apnet", dev: "ap", net: { ssid: p.guestSsid, sec: "WPA2-Personal", psk: p.guestPw, vlan: G.id } },
      { t: "joinssid", dev: "guest", ssid: p.guestSsid, pass: p.guestPw }];
  },
  answer(v) {
    const p = v.plan, G = guest(v), S = staff(v);
    return ["Place the injector in the closet and the access point on its plate in the guest area; switch port " + p.apPort + " to the injector's DATA IN, its PoE OUT to the access point.",
      "On the closet switch (console): vlan " + G.id + ", name " + G.name + "; interface gi0/" + p.apPort + ": description " + p.apDesc + ", switchport mode trunk, switchport trunk allowed vlan 1," + G.id + ", no shutdown; save.",
      "On the router (console): interface " + subName(v, "guest") + ": encapsulation dot1Q " + G.id + ", ip address " + G.gw + " " + p.vmask + ", ip nat inside, ip access-group " + p.guestAcl + " in.",
      "ip access-list extended " + p.guestAcl + ": permit udp any any eq bootps; deny ip " + G.net + " 0.0.0.255 " + S.net + " 0.0.0.255; deny ip " + G.net + " 0.0.0.255 " + p.lan + " 0.0.0.255; permit ip " + G.net + " 0.0.0.255 any.",
      "The guest pool (first ten excluded, gateway, the provider's DNS) and access-list 1 permit " + G.net + " 0.0.0.255 for NAT; save.",
      "The access point's address: show ip dhcp binding (or show lldp neighbors on the switch). Its page, from the manager's PC: the network " + p.guestSsid + ", WPA2-Personal, the records' password, VLAN " + G.id + ". Then join it from the visitor's phone."];
  },
  summary(v, sim) {
    const G = guest(v);
    return ["The access point is on its plate in " + roomOf(sim, "guest") + ", powered by the injector, on the closet switch's port " + v.plan.apPort + ": a trunk with the guest VLAN tagged and the access point itself on the old network.",
      v.plan.guestSsid + " puts guests on VLAN " + G.id + ", " + G.net + "/24, routed by the router's " + subName(v, "guest") + " and NAT'd to the internet.",
      "The guests' access list keeps them away from the staff network, the printer, the switch and the access point's page; staff still reach everything.", "Both devices are saved."];
  }
};

/* ---------------------------------------------------------------- SB-J4: the back of house on its own switch, over a trunk */
const BSW = function (sim) { return sim.d.bsw.sw; };
const port = function (n) { return "GigabitEthernet0/" + n; };
/* the trunk between the two switches: the cable, the port at each end, and what each end carries */
function trunkLink(sim) {
  const m = sim.d.bsw && between(sim, "msw", "bsw");
  if (!m) return null;
  const cp = SW(sim).ports[port(m.me)], bp = BSW(sim).ports[port(m.far)], dtp = function (x) { return { mode: x.mode, nonegotiate: x.nonegotiate }; };   /* each end runs as it negotiates with the other */
  return { cable: m.cable, closet: m.me, back: m.far, cc: carries(SW(sim), port(m.me), dtp(bp)), bc: carries(BSW(sim), port(m.far), dtp(cp)), cp: cp, bp: bp };
}
/* the back switch has one place, its shelf in the back room (the Place form takes it nowhere else), so its box is the
   first cause of every line that needs it, as with the office's back office switch */
function lockCausesB(sim, v) {
  const sw = BSW(sim), con = sw.con, p = v.plan, box = sim.d.bsw.boxed;
  return [C("box", box, "The back switch is still in its box", "It's out of its box.", "The back switch is still in its box."),
    C("factory", sw.hostname === "Switch", "It still has its factory name", "It has a name of its own.", "Its prompt still says Switch."),
    C("name", sw.hostname !== p.bswHost, "It has a name, but not the one in the business's records", "Its name is the records'.", "Its prompt says " + sw.hostname + "."),
    C("nosecret", !sw.enableSecret && !sw.enablePassword, "Anyone at its console can type enable and change anything", "Privileged mode is protected.", "enable goes straight to privileged mode, with no password."),
    C("plain", !sw.enableSecret && !!sw.enablePassword, "Only an enable password is set: it sits in the configuration as plain text", "An enable secret is set, stored as a hash.", "show running-config shows the enable password in plain text."),
    C("secret", !!sw.enableSecret && !pwOk(sw.enableSecret, p.swSecret), "An enable secret is set, but not the business's", "The enable secret is the business's.", "The business's enable secret doesn't open privileged mode."),
    C("conpw", !con.password, "Its console line has no password", "The console line has a password.", "line con 0 has no password."),
    C("conlogin", !!con.password && !con.login, "Its console line has a password, but never asks for it", "The console line asks for its password.", "Log out of its console, press RETURN: it goes straight in."),
    C("conwrong", !!con.password && !pwOk(con.password, p.swConsole), "Its console asks for a password, but not the business's", "The console password is the business's.", "The business's console password isn't accepted.")];
}
function vlanCausesB(sim, v) {
  const S = staff(v), vl = BSW(sim).vlans[S.id];
  return [C("box", sim.d.bsw.boxed, "The back switch is still in its box", "It's out of its box.", "The back switch is still in its box."),
    C("none", !vl, "The back switch has no staff VLAN", "The staff VLAN exists on it.", "show vlan brief on the back switch: no VLAN " + S.id + "."),
    C("name", !!vl && vl.name !== S.name, "Its staff VLAN isn't named as the records say", "It's named as the records say.", "show vlan brief on the back switch: VLAN " + S.id + " is " + (vl ? vl.name : "") + ".")];
}
function trunkCausesB(sim, v) {
  const p = v.plan, T = p.trunk, S = staff(v), N = p.vlans.native, L = trunkLink(sim);
  const ends = L ? [["closet switch's", L.closet, L.cc, L.cp, T.closetDesc], ["back switch's", L.back, L.bc, L.bp, T.backDesc]] : [];
  const notTrunk = ends.find(function (e) { return e[2].mode !== "trunk"; }), dtp = !notTrunk && ends.find(function (e) { return e[3].mode !== "trunk"; });
  const noStaff = ends.find(function (e) { return e[2].mode === "trunk" && e[2].tagged.indexOf(S.id) < 0 && e[2].untagged !== S.id; });
  const extra = ends.find(function (e) { return e[2].mode === "trunk" && e[2].tagged.some(function (x) { return x !== S.id; }); });
  const nat = ends.find(function (e) { return e[2].mode === "trunk" && e[3].native !== N.id; }), split = !!L && L.cp.native !== L.bp.native;
  const desc = ends.find(function (e) { return String(e[3].desc || "").toUpperCase() !== e[4]; });
  return [C("box", sim.d.bsw.boxed, "The back switch is still in its box", "It's out of its box.", "The back switch is still in its box."),
    C("cable", !L, "No cable joins the closet switch to the back switch", "The two switches are cabled.", "Nothing from the closet switch reaches the back switch."),
    C("ports", !!L && (L.closet !== T.closet || L.back !== T.back), "The run between them isn't on the ports the records give it", "It's on the records' ports.", "The run is in the closet switch's port " + (L ? L.closet : "") + " and the back switch's port " + (L ? L.back : "") + "."),
    C("shut", !!L && (L.cp.shutdown || L.bp.shutdown), "One end of the run is in a port that's shut down", "Both ends are open.", "show interfaces status: Gi0/" + (L ? (L.cp.shutdown ? L.closet + " on the closet switch" : L.back + " on the back switch") : "") + " disabled."),
    C("mode", !!notTrunk, "The " + (notTrunk ? notTrunk[0] : "") + " end isn't a trunk, so only one VLAN crosses", "Both ends trunk.", "show interfaces trunk on the " + (notTrunk ? notTrunk[0].replace(/'s$/, "") : "") + ": nothing for Gi0/" + (notTrunk ? notTrunk[1] : "") + "."),
    C("dtp", !!dtp, "The " + (dtp ? dtp[0] : "") + " end is left to negotiate: it trunks only while the two ends agree to, and the records set both ends as trunks", "Both ends are set as trunks.", "show interfaces Gi0/" + (dtp ? dtp[1] : "") + " switchport on the " + (dtp ? dtp[0].replace(/'s$/, "") : "") + ": administrative mode dynamic."),
    C("allowed", !!noStaff, "The " + (noStaff ? noStaff[0] : "") + " end doesn't carry the staff VLAN", "Both ends carry the staff VLAN.", "show interfaces trunk on the " + (noStaff ? noStaff[0].replace(/'s$/, "") : "") + ": VLAN " + S.id + " isn't allowed and active on Gi0/" + (noStaff ? noStaff[1] : "") + "."),
    C("extra", !!extra, "The " + (extra ? extra[0] : "") + " end carries VLANs the back of house doesn't use", "Both ends carry only the staff VLAN.", "show interfaces trunk on the " + (extra ? extra[0].replace(/'s$/, "") : "") + ": Gi0/" + (extra ? extra[1] + " allows " + extra[2].tagged.join(",") : "") + "."),
    C("split", split, "The two ends' native VLANs differ: untagged frames from one land in the other's VLAN", "Both ends have the same native VLAN.", "show interfaces trunk: native VLAN " + (L ? L.cp.native : "") + " at the closet switch, " + (L ? L.bp.native : "") + " at the back switch."),
    C("native", !split && !!nat, "The trunk's native VLAN is the default, not the unused one the records give trunks", "Its native VLAN is the records' unused one.", "show interfaces trunk: native VLAN " + (L ? L.cp.native : "") + "."),
    C("desc", !!desc, "The " + (desc ? desc[0] : "") + " end isn't described as the records say", "Both ends are described as the records say.", "show interfaces status on the " + (desc ? desc[0].replace(/'s$/, "") : "") + ": Gi0/" + (desc ? desc[1] + "'s name is " + (desc[3].desc || "blank") : "") + ".")];
}
function backCauses(sim, v) {
  const p = v.plan, S = staff(v), m = sim.d.bsw && between(sim, "bpc", "bsw"), old = between(sim, "bpc", "msw"), sp = m && BSW(sim).ports[port(m.far)], c = m ? carries(BSW(sim), port(m.far), null) : null, a = sim.addr("bpc");
  const staffAddr = !!a && a.kind !== "apipa" && inNet(a.ip, S.net);
  return [C("old", !!old, "The " + name(sim, "bpc") + " is still on the closet switch's long run", "It's off the closet switch.", "The " + name(sim, "bpc") + "'s cable still goes back to the closet switch."),
    C("cable", !m, "The " + name(sim, "bpc") + " isn't cabled to the back switch", "It's on the back switch.", "Nothing joins the " + name(sim, "bpc") + " to the back switch."),
    C("port", !!m && m.far !== p.backPort, "It's on a back switch port the records keep for something else", "It's on the records' port.", "The " + name(sim, "bpc") + " is in the back switch's port " + (m ? m.far : "") + "."),
    C("shut", !!sp && sp.shutdown, "Its port on the back switch is shut down", "Its port is open.", "show interfaces status on the back switch: Gi0/" + (m ? m.far : "") + " disabled."),
    C("vlan", !!c && c.untagged !== S.id, "Its port isn't in the staff VLAN", "Its port is in the staff VLAN.", "show vlan brief on the back switch: Gi0/" + (m ? m.far : "") + " isn't in VLAN " + S.id + "."),
    C("desc", !!sp && String(sp.desc || "").toUpperCase() !== p.desc["4"], "Its port isn't described as the records say", "Its port is described as the records say.", "show interfaces status on the back switch: Gi0/" + (m ? m.far : "") + "'s name is " + (sp && sp.desc ? sp.desc : "blank") + "."),
    C("renew", !!m && !staffAddr, "It has no staff address: it hasn't asked again since it moved, or its way to the router is broken", "It has a staff address.", "ipconfig on the " + name(sim, "bpc") + ": " + (a ? a.ip : "no address") + "."),
    C("net", staffAddr && !online(sim, "bpc"), "It has a staff address but isn't online", "It's online.", "ping from the " + name(sim, "bpc") + ": no replies from the internet."),
    C("print", !printOk(sim, "bpc"), "It can't reach the printer", "It prints.", "Test pages from the " + name(sim, "bpc") + " don't print.")];
}
function sparesCausesB(sim, v) {
  const p = v.plan, sw = BSW(sim), used = [p.backPort, p.trunk.back], live = Object.keys(sw.ports).filter(function (n) { const k = n.replace("GigabitEthernet0/", ""); return used.indexOf(k) < 0 && !sw.ports[n].shutdown; });
  const o = SW(sim).ports[port("4")], inUse = !!sim.cableAt("msw", "4");
  return [C("box", sim.d.bsw.boxed, "The back switch is still in its box", "It's out of its box.", "The back switch is still in its box."),
    C("back", live.length > 0, "Ports on the back switch with nothing in them are live: anyone can plug in there", "Its spare ports are shut.", "show interfaces status on the back switch: " + live.slice(0, 3).map(function (n) { return n.replace("GigabitEthernet", "Gi"); }).join(", ") + (live.length > 3 ? " and more" : "") + " not disabled."),
    C("old", !inUse && !o.shutdown, "The closet switch's old port for the " + name(sim, "bpc") + " is empty but still open", "The old port is shut.", "show interfaces status on the closet switch: Gi0/4 is notconnect, not disabled."),
    C("olddesc", !inUse && String(o.desc || "").toUpperCase() === p.desc["4"], "The closet switch's old port is still described as the " + name(sim, "bpc") + "'s", "The old port's description is gone.", "show interfaces status on the closet switch: Gi0/4 is still named " + o.desc + ".")];
}
function stillCausesB(sim, v) {
  const down = ["pc", "mgr"].find(function (id) { return !online(sim, id); }), ip = apAddr(sim), r = ip ? sim.route("mgr", ip) : null;
  return [C("net", !!down, "The " + (down ? name(sim, down) : "") + " is offline", "The other staff PCs are online.", "ping from the " + (down ? name(sim, down) : "") + ": no replies from the internet."),
    C("print", !printOk(sim), "The " + name(sim, "pc") + " can't print", "It prints.", "Test pages from the " + name(sim, "pc") + " don't print."),
    C("guest", !online(sim, "guest"), "The visitor's phone is offline: the guest network stopped working", "Guests are online.", "The visitor's phone: no internet."),
    C("ap", !!r && !((r.local || r.routed) && !r.fail), "The manager's PC can't reach the access point's page", "The access point's page opens from the manager's PC.", "From the manager's PC the access point's address doesn't answer.")];
}
const SB4 = {
  id: "SB-J4", level: "business", title: "The back of house on its own switch: a trunk between two switches",
  already: ["still", "swsaved"],
  start(seed) {
    const b = SB3.start(seed), sim = b.sim;
    for (const a of SB3.solve(b.v, sim)) { if (a.t === "cmd") exec(sim, a.dev, a.line); else sim.apply(a); }
    addBackSwitch(sim); sim.cli = {};   /* the second switch came in its box; the back PC is still on its long run to the closet */
    return { sim: sim, v: b.v };
  },
  brief(v, sim) { return { quote: "We're putting more computers in the " + String(sim.net.roomNames.back).toLowerCase() + ". The installer says one cable back to the closet and a switch in there is the way, not a long run for every machine. The switch came this week, the same as the one in the closet. Move our " + name(sim, "bpc") + " onto it, on the staff network like the rest.", from: sim.net.client.manager + ", " + sim.net.client.name }; },
  mason: "Between two switches the trunk is only as good as its two ends agreeing: the same mode, the same VLANs allowed, the same native VLAN. Set up the new switch at its own console first, then the closet end, then move the PC.",
  limits: function (v, sim) { const p = v.plan, S = staff(v), N = p.vlans.native, T = p.trunk; return ["The business's records: the back switch is " + p.bswHost + ", with the closet switch's enable secret (" + p.swSecret + ") and console password (" + p.swConsole + ").",
    "The trunk: the closet switch's port " + T.closet + " (described " + T.closetDesc + ") to the back switch's port " + T.back + " (described " + T.backDesc + "). It carries only the staff VLAN (" + S.id + ", " + S.name + "). Trunks here use VLAN " + N.id + " (" + N.name + ") as their native VLAN, never VLAN 1.",
    "The " + name(sim, "bpc") + " goes on the back switch's port " + p.backPort + ", described " + p.desc["4"] + ", in the staff VLAN. The closet switch's port 4 is free once it moves.",
    "Spare ports are shut, on the new switch too. Your laptop's console cable is 1.8 m: it reaches a switch in the same room."]; },
  reqs: [{
    id: "lock", text: "The back switch is on its shelf, with the business's name and passwords",
    causes: lockCausesB,
    ok: function () { return "The back switch is named as the records say, its enable secret and console password the business's."; },
    rung1: function (v, sim) { return sim.d.bsw.boxed ? "The box tray, then the Place form." : "At the back switch's own console: the prompt, then show running-config."; },
    rung2: function (v, sim) { return sim.d.bsw.boxed ? "A device goes on its mount before anything is cabled to it; a switch in the room it serves keeps every run there short." : "A switch from its box has no name and no passwords: anyone who reaches its console owns it until you set them."; }
  }, {
    id: "vlan", text: "The back switch has the staff VLAN, named as the records say",
    causes: vlanCausesB,
    ok: function () { return "The staff VLAN exists on the back switch, named as the records say."; },
    rung1: function () { return "On the back switch: show vlan brief."; },
    rung2: function () { return "Each switch keeps its own list of VLANs: a VLAN made on the closet switch doesn't exist on the new one until it's made there too."; }
  }, {
    id: "trunk", text: "A trunk joins the two switches, both ends set as the records say",
    causes: trunkCausesB,
    ok: function () { return "The run is a trunk at both ends, carrying only the staff VLAN, the records' unused VLAN native at both ends, each end described."; },
    rung1: function () { return "show interfaces trunk at both switches, side by side; show interfaces (the trunk's port) switchport for how each end was set."; },
    rung2: function () { return "A trunk carries the VLANs both ends allow. Its native VLAN is sent untagged, so both ends must agree on it, and one that carries nothing keeps strays out. An end left to negotiate trunks only while the other end asks."; }
  }, {
    id: "back", text: "The back PC is on the back switch, on the staff VLAN, online and printing",
    causes: backCauses,
    ok: function (sim) { return "The " + name(sim, "bpc") + " is on the back switch's records port, in the staff VLAN, with a staff address, online and printing."; },
    rung1: function () { return "On the back switch: show vlan brief and show interfaces status. On the PC: ipconfig, then ping out and print."; },
    rung2: function () { return "A PC moved to another switch is on whatever VLAN its new port is in, and only finds out when it asks again for an address."; }
  }, {
    id: "spares", text: "Nothing is left open: the new switch's spare ports and the closet's old port are shut",
    causes: sparesCausesB,
    ok: function () { return "The back switch's spare ports are shut, and the closet switch's old port is shut with its old description gone."; },
    rung1: function () { return "show interfaces status on both switches: look for ports that are notconnect rather than disabled."; },
    rung2: function () { return "An empty port that's open is a way in for whoever plugs into it. A port a device has left is a spare again."; }
  }, {
    id: "still", text: "Everything that worked still works",
    causes: stillCausesB,
    ok: function () { return "The other staff PCs, the printer, the guest network and the access point's page all still work."; },
    rung1: function () { return "Ping out from the other PCs and the visitor's phone; open the access point's page from the manager's PC."; },
    rung2: function () { return "Changing the closet switch can break what was already on it: the trunk to the router carries the staff and guest VLANs, and nothing about it needs to change."; }
  }, {
    id: "bswsaved", text: "The back switch's setup survives a power cut",
    causes: function (sim) { return [C("box", sim.d.bsw.boxed, "The back switch is still in its box", "It's out of its box.", "The back switch is still in its box.")].concat(savedCauses(sim, "bsw")); },
    ok: function () { return "What's running on the back switch is saved."; },
    rung1: function () { return "On the back switch: compare show running-config with show startup-config."; },
    rung2: function () { return "Each switch keeps its own startup configuration: saving one saves nothing on the other."; }
  }, {
    id: "swsaved", text: "The closet switch's setup survives a power cut",
    causes: swSavedCauses,
    ok: function () { return "What's running on the closet switch is saved."; },
    rung1: function () { return "On the closet switch: compare show running-config with show startup-config."; },
    rung2: function () { return "Each switch keeps its own startup configuration: saving one saves nothing on the other."; }
  }],
  solve(v, sim) {
    const p = v.plan, S = staff(v), N = p.vlans.native, T = p.trunk, t = function (l) { return { t: "cmd", dev: "tech", line: l, cli: true }; };
    const runs = sim ? sim.net.extra.runs || 0 : 9;   /* runs are numbered in the order they're laid: SB-J1 to SB-J3 laid nine, the last the console to the router */
    return [{ t: "place", dev: "bsw", room: "back" }, { t: "pull", cable: "c-msw-bpc" },
      { t: "lay", a: E("msw", T.closet), b: E("bsw", T.back) }, { t: "lay", a: E("bpc", "NIC"), b: E("bsw", p.backPort) },
      { t: "pull", cable: "c-console-" + runs }, { t: "place", dev: "tech", room: "back" }, { t: "lay", a: E("tech", "USB-C"), b: E("bsw", "CONSOLE") },
      t(""), t("enable"), t("configure terminal"), t("hostname " + p.bswHost), t("enable secret " + p.swSecret), t("line console 0"), t("password " + p.swConsole), t("login"), t("exit"),
      t("vlan " + S.id), t("name " + S.name), t("exit"),
      t("interface gi0/" + p.backPort), t("description " + p.desc["4"]), t("switchport mode access"), t("switchport access vlan " + S.id),
      t("interface gi0/" + T.back), t("description " + T.backDesc), t("switchport mode trunk"), t("switchport trunk allowed vlan " + S.id), t("switchport trunk native vlan " + N.id),
      t("interface range gi0/2 - 23"), t("shutdown"), t("interface range gi0/25 - 28"), t("shutdown"), t("end"), t("copy running-config startup-config"), t(""),
      { t: "pull", cable: "c-console-" + (runs + 3) }, { t: "place", dev: "tech", room: "closet" }, { t: "lay", a: E("tech", "USB-C"), b: E("msw", "CONSOLE") },   /* the trunk, the PC's run, then the console */
      t(""), t(p.swConsole), t("enable"), t(p.swSecret), t("configure terminal"),
      t("interface gi0/" + T.closet), t("description " + T.closetDesc), t("switchport mode trunk"), t("switchport trunk allowed vlan " + S.id), t("switchport trunk native vlan " + N.id), t("no shutdown"),
      t("interface gi0/4"), t("no description"), t("shutdown"), t("end"), t("copy running-config startup-config"), t(""),
      { t: "cmd", dev: "bpc", line: "ipconfig /renew" }];
  },
  answer(v) {
    const p = v.plan, S = staff(v), N = p.vlans.native, T = p.trunk;
    return ["Place the back switch on its shelf in the back room. Pull the back PC's long run; lay the closet switch's port " + T.closet + " to the back switch's port " + T.back + ", and the back PC to the back switch's port " + p.backPort + ".",
      "Take your laptop to the back room, console cable to the back switch: hostname " + p.bswHost + ", enable secret and console password (the business's), vlan " + S.id + " name " + S.name + ".",
      "Its port " + p.backPort + ": description " + p.desc["4"] + ", switchport mode access, switchport access vlan " + S.id + ". Its port " + T.back + ": description " + T.backDesc + ", switchport mode trunk, switchport trunk allowed vlan " + S.id + ", switchport trunk native vlan " + N.id + ". Shut ports 2 to 23 and 25 to 28; save.",
      "Back in the closet, on the closet switch: interface gi0/" + T.closet + ": description " + T.closetDesc + ", switchport mode trunk, switchport trunk allowed vlan " + S.id + ", switchport trunk native vlan " + N.id + ", no shutdown. interface gi0/4: no description, shutdown. Save.",
      "On the back PC: ipconfig /renew."];
  },
  summary(v, sim) {
    const p = v.plan, S = staff(v), N = p.vlans.native;
    return ["The back switch " + BSW(sim).hostname + " is on its shelf in " + roomOf(sim, "back") + ", locked with the business's passwords, its spare ports shut.",
      "One trunk joins it to the closet switch, carrying only the staff VLAN (" + S.id + "), with VLAN " + N.id + " native at both ends.",
      "The " + name(sim, "bpc") + " is on it, in the staff VLAN, online and printing; the closet switch's old port is shut. Both switches are saved."];
  }
};

/* ---------------------------------------------------------------- SB-J5: the cameras on their own VLAN, seen from outside */
/* the owner's decisions (26 October 2026): the ceiling dome over the guests, the wall dome by the back door, a PoE injector each
   (the ceiling camera's in the closet, the back door camera's in the back room), each camera's fixed address set on its own page,
   and the test from outside on the manager's own phone, on mobile data */
const cams = function (v) { return VL(v, "cameras"); };
const camIp = function (v, c) { return cams(v).net.replace(/\.0$/, "." + c.host); };
const CAM_ROOM = ["guest", "back"], INJ_ROOM = ["closet", "back"];
const cap = function (s) { return s.charAt(0).toUpperCase() + s.slice(1); };
const the = function (sim, id) { const x = sim.d[id]; return x.kind === "injector" ? "the injector labelled " + x.label.replace(/^.*, /, "") : "the " + name(sim, id); };   /* "the ceiling camera", "the back switch", "the injector labelled CAM-02" */
const dark = function (sim, id) { return cap(the(sim, id)) + (sim.d[id].boxed ? " is still in its box." : "'s status light is dark."); };
const spot = function (sim, k) { return k === 0 ? "on the ceiling in " + roomOf(sim, "guest") : "on the wall by the back door, in " + roomOf(sim, "back"); };
/* a camera's run: its cable, the injector it comes from, and the switch and port that injector's data side lands on */
function camPath(sim, c) {
  const k = sim.cableAt(c.id, "LAN"), far = k && (k.a.dev === c.id ? k.b : k.a), inj = !!far && sim.d[far.dev].kind === "injector";
  const out = { cable: k, far: far, inj: inj ? far.dev : null, up: null, sw: null, swPort: null };
  if (inj) { const ci = sim.cableAt(far.dev, far.port === "PoE OUT" ? "DATA IN" : "PoE OUT"); out.up = ci ? (ci.a.dev === far.dev ? ci.b : ci.a) : null; }
  else out.up = far;
  if (out.up && sim.d[out.up.dev].kind === "mswitch" && /^\d+$/.test(out.up.port)) { out.sw = out.up.dev; out.swPort = out.up.port; }
  return out;
}
function camCauses(sim, v, k) {
  const c = v.plan.cams[k], x = sim.d[c.id], P = camPath(sim, c), mine = "cinj" + (k + 1), who = the(sim, c.id), room = sim.net.rooms[c.id];
  const onOut = !!P.inj && P.far.port === "PoE OUT", fromSwitch = !!P.cable && !P.inj, fromDataIn = !!P.inj && P.far.port === "DATA IN", noAdapter = onOut && !sim.d[P.inj].power;
  const tag = function (id) { return sim.d[id].label.replace(/^.*, /, ""); };   /* what's printed on an injector's label: CAM-01, CAM-02 */
  return [C("box", x.boxed, cap(who) + " is still in its box", "It's out of its box.", cap(who) + " is still in its box."),
    C("room", !x.boxed && room !== CAM_ROOM[k], "It isn't where the records put it, " + spot(sim, k), "It's " + spot(sim, k) + ".", cap(who) + " is in " + roomOf(sim, room) + "."),
    C("cable", !x.boxed && !P.cable, "Nothing is plugged into it", "It's cabled.", "Nothing is plugged into " + who + "'s network lead."),
    C("switch", fromSwitch, "Its cable comes straight from a port that gives no power: neither switch has PoE", "Its power comes from an injector.", cap(who) + "'s status light is dark; its cable goes straight to " + the(sim, P.far ? P.far.dev : c.sw) + "."),
    C("datain", fromDataIn, "Its cable is in the injector's DATA IN: the power comes out of the other port", "It's on the injector's power side.", cap(who) + "'s status light is dark; its cable is in the injector's DATA IN."),
    C("label", onOut && P.inj !== mine, "It's on the injector labelled for the other camera", "It's on its own injector.", cap(who) + "'s cable comes from the injector labelled " + (P.inj ? tag(P.inj) : "") + "."),
    C("injroom", onOut && sim.net.rooms[P.inj] !== INJ_ROOM[k], "Its injector isn't where the records put it, in " + roomOf(sim, INJ_ROOM[k]), "Its injector is in " + roomOf(sim, INJ_ROOM[k]) + ".", "The injector labelled " + (P.inj ? tag(P.inj) : "") + " is in " + roomOf(sim, P.inj ? sim.net.rooms[P.inj] : INJ_ROOM[k]) + "."),
    C("adapter", noAdapter, "Its injector's own power adapter isn't plugged in", "The injector has power.", "The injector's POWER light is off."),
    C("power", !x.boxed && !!P.cable && !sim.on(c.id) && !fromSwitch && !fromDataIn && !noAdapter, "It gets no power down its cable", "It's powered over its cable.", cap(who) + "'s status light is dark."),
    C("datain2", sim.on(c.id) && !!P.inj && !P.up, "Nothing is plugged into its injector's DATA IN: it has power but no network", "Its injector's data side is cabled.", cap(who) + "'s status light blinks; its injector's DATA IN is empty."),
    C("where", sim.on(c.id) && !!P.up && P.up.dev !== c.sw, "Its injector's data side goes to " + the(sim, P.up ? P.up.dev : c.sw) + ", not " + the(sim, c.sw) + " the records give it", "It goes to " + the(sim, c.sw) + ".", "The injector's DATA IN goes to " + the(sim, P.up ? P.up.dev : c.sw) + "."),
    C("port", !!P.swPort && P.sw === c.sw && P.swPort !== c.port, "It's on a port of " + the(sim, c.sw) + " the records keep for something else", "It's on the port the records give it.", cap(who) + "'s run is in " + the(sim, c.sw) + "'s port " + P.swPort + ".")];
}
function camVlanCauses(sim, v) {
  const cv = cams(v), a = SW(sim).vlans[cv.id], b = BSW(sim).vlans[cv.id];
  return [C("closet", !a, "The closet switch has no cameras' VLAN", "The closet switch has it.", "show vlan brief on the closet switch: no VLAN " + cv.id + "."),
    C("cname", !!a && a.name !== cv.name, "The closet switch's cameras' VLAN isn't named as the records say", "It's named as the records say.", "show vlan brief on the closet switch: VLAN " + cv.id + " is " + (a ? a.name : "") + "."),
    C("back", !b, "The back switch has no cameras' VLAN", "The back switch has it.", "show vlan brief on the back switch: no VLAN " + cv.id + "."),
    C("bname", !!b && b.name !== cv.name, "The back switch's cameras' VLAN isn't named as the records say", "It's named as the records say.", "show vlan brief on the back switch: VLAN " + cv.id + " is " + (b ? b.name : "") + ".")];
}
/* each camera's port on its switch, as the records set it: the first camera whose port isn't, and what's wrong with it */
function camPortCauses(sim, v) {
  const cv = cams(v), rows = v.plan.cams.map(function (c) { const sw = sim.d[c.sw].sw, P = camPath(sim, c); return { c: c, sp: sw.ports[port(c.port)], cc: carries(sw, port(c.port), null), on: P.sw === c.sw && P.swPort === c.port }; });
  const bad = function (r) { return !r.on || r.sp.shutdown || r.cc.untagged !== cv.id || r.sp.mode !== "access" || String(r.sp.desc || "").toUpperCase() !== r.c.desc; };
  const r = rows.find(bad) || rows[0], at = the(sim, r.c.sw), who = the(sim, r.c.id), w = who + "'s port on " + at, dyn = /^dynamic/.test(r.sp.mode);   /* the port by whose it is: its number is the records' to give */
  return [C("path", !r.on, cap(who) + "'s run isn't on its port yet", "Each camera's run is on its port.", cap(who) + "'s run doesn't reach " + at + "'s port " + r.c.port + "."),
    C("shut", r.sp.shutdown, cap(w) + " is shut down, as every spare is", "Its port is open.", "show interfaces status on " + at + ": Gi0/" + r.c.port + " disabled."),
    C("vlan", r.cc.untagged !== cv.id, cap(w) + " doesn't put it in the cameras' VLAN", "Its port is in the cameras' VLAN.", "show vlan brief on " + at + ": Gi0/" + r.c.port + " isn't in VLAN " + cv.id + "."),
    C("mode", r.sp.mode !== "access", dyn ? cap(w) + " is left to negotiate: whoever unplugs the camera can plug in and ask it for a trunk" : cap(w) + " is set as a trunk, not an access port", "It's set as an access port.", "show interfaces Gi0/" + r.c.port + " switchport on " + at + ": administrative mode " + (dyn ? r.sp.mode : "trunk") + "."),
    C("desc", String(r.sp.desc || "").toUpperCase() !== r.c.desc, cap(w) + " isn't described as the records say", "It's described as the records say.", "show interfaces status on " + at + ": Gi0/" + r.c.port + "'s name is " + (r.sp.desc || "blank") + ".")];
}
function camTrunkCauses(sim, v) {
  const cv = cams(v), S = staff(v), L = trunkLink(sim), up = between(sim, "rtr", "msw"), uc = up ? carries(SW(sim), port(up.far), null) : null;
  const has = function (c, id) { return !!c && c.mode === "trunk" && (c.tagged.indexOf(id) >= 0 || c.untagged === id); };
  const lost = !!L && (!has(L.cc, S.id) ? ["closet switch", L.closet] : !has(L.bc, S.id) ? ["back switch", L.back] : null);
  return [C("cable", !L, "No cable joins the closet switch to the back switch", "The two switches are cabled.", "Nothing from the closet switch reaches the back switch."),
    C("closet", !!L && !has(L.cc, cv.id), "The closet switch's end of the trunk to the back switch doesn't carry the cameras' VLAN", "The closet end carries it.", "show interfaces trunk on the closet switch: VLAN " + cv.id + " isn't allowed and active on Gi0/" + (L ? L.closet : "") + "."),
    C("back", !!L && !has(L.bc, cv.id), "The back switch's end of the trunk doesn't carry the cameras' VLAN", "The back end carries it.", "show interfaces trunk on the back switch: VLAN " + cv.id + " isn't allowed and active on Gi0/" + (L ? L.back : "") + "."),
    C("staff", !!lost, "The trunk between the switches no longer carries the staff VLAN: its allowed list was replaced, not added to", "It still carries the staff VLAN.", "show interfaces trunk on the " + (lost ? lost[0] : "") + ": VLAN " + S.id + " isn't allowed and active on Gi0/" + (lost ? lost[1] : "") + "."),
    C("uplink", !has(uc, cv.id), "The trunk to the router doesn't carry the cameras' VLAN", "The trunk to the router carries it.", "show interfaces trunk on the closet switch: VLAN " + cv.id + " isn't allowed and active on Gi0/" + (up ? up.far : "") + ".")];
}
/* each camera's fixed address, set on its own page: the first camera without the records' */
const noCamLease = function (sim, c) { const f = sim.d[c.id].ifaces[0].cfg, a = sim.addr(c.id); return f.mode !== "static" && sim.on(c.id) && (!a || a.kind === "apipa"); };
function camFixedCauses(sim, v) {
  const cv = cams(v), rows = v.plan.cams.map(function (c) { return { c: c, f: sim.d[c.id].ifaces[0].cfg, a: sim.on(c.id) ? sim.addr(c.id) : null }; });
  const bad = function (r) { return r.f.mode !== "static" || r.f.ip !== camIp(v, r.c) || r.f.mask !== v.plan.vmask || r.f.gw !== cv.gw; };
  const r = rows.find(bad) || rows[0], who = the(sim, r.c.id), dyn = r.f.mode !== "static", page = cap(who) + "'s page: ";
  return [C("off", dyn && !sim.on(r.c.id), cap(who) + " isn't powered, so its page can't be opened to set its address", "It's powered.", dark(sim, r.c.id)),
    C("lease", noCamLease(sim, r.c), cap(who) + " has no address to find it by: its request for one gets no answer", "It had an address to find it by.", "show ip dhcp binding on the router: no lease for " + who + " (it gave itself " + (r.a ? r.a.ip : "nothing") + ")."),
    C("dhcp", dyn, cap(who) + " is still on DHCP: the address the records and the forward point at can change", "It has a fixed address.", "show ip dhcp binding on the router: " + who + " has a lease" + (r.a ? ", " + r.a.ip : "") + "."),
    C("ip", !dyn && r.f.ip !== camIp(v, r.c), "Its fixed address isn't the one in the records", "Its address is the records'.", page + "IP address " + r.f.ip + "."),
    C("mask", !dyn && r.f.mask !== v.plan.vmask, "Its subnet mask isn't the cameras' network's", "Its mask is the network's.", page + "subnet mask " + r.f.mask + "."),
    C("gw", !dyn && r.f.gw !== cv.gw, "Its gateway isn't the cameras' gateway on the router", "Its gateway is the router.", page + "gateway " + (r.f.gw || "blank") + ".")];
}
/* does what a camera starts get to an address: from a camera with an address on the cameras' network, really (arriving is
   enough: a reply dropped on its way back doesn't stop the camera reaching it); otherwise a camera's packet put to the router's
   lists (in on the cameras' subinterface, out where it would leave, NAT for the internet) */
function camReaches(sim, v, ip, dport) {
  if (!ip) return false;
  const cv = cams(v), pk = { proto: "tcp", port: dport, sport: 50000 };
  const id = v.plan.cams.map(function (c) { return c.id; }).find(function (x) { const a = sim.on(x) && sim.addr(x); return !!a && a.kind !== "apipa" && inNet(a.ip, cv.net); });
  if (id) { const r = sim.route(id, ip, pk); return !r.fail ? !!(r.local || r.routed || r.internet) : r.fail === "no-reply" && r.why !== "arp"; }
  const R = RT(sim), q = vlanSub(view(sim), v, "cameras"); if (!q || !R.subs[q].ip) return false;
  const p = Object.assign({ src: cv.net.replace(/\.0$/, ".50"), dst: ip }, pk), f = R.subs[q];
  if (f.aclIn && !aclVerdict(R, f.aclIn, p).permit) return false;
  const outIf = Object.keys(R.subs).concat(Object.keys(R.ifs)).find(function (n) { const x = R.subs[n] || R.ifs[n]; return x.ip && x.mask && netOf(x.ip, x.mask) === netOf(ip, x.mask); });
  if (!outIf) return f.nat === "inside" && R.nat.some(function (x) { return R.acls[x.list] && aclVerdict(R, x.list, { proto: "ip", src: p.src, dst: ip }).permit; });
  const o = R.subs[outIf] || R.ifs[outIf];
  return !(o.aclOut && !aclVerdict(R, o.aclOut, p).permit);
}
function camApartCauses(sim, v) {
  const q = vlanSub(view(sim), v, "cameras"), routed = !!q && !!RT(sim).subs[q].ip, m = sim.addr("mgr");
  return [C("none", !routed, "There's no cameras' network routed yet to keep apart", "The cameras' network is routed.", "Nothing on the router routes the cameras' VLAN yet."),
    C("staff", routed && [445, 443].some(function (n) { return camReaches(sim, v, m && m.ip, n); }), "What a camera starts reaches the staff PCs: nothing stops it on its way in", "Nothing a camera starts reaches the staff PCs.", "From the cameras' network, a connection to the manager's PC gets there."),
    C("lan", routed && camReaches(sim, v, printerIp(sim), 9100), "What a camera starts reaches the old network: the printer, the switch", "Nothing a camera starts reaches the old network.", "From the cameras' network, a connection to the printer gets there."),
    C("internet", routed && camReaches(sim, v, "203.0.113.80", 443), "What a camera starts reaches the internet", "Nothing a camera starts reaches the internet.", "From the cameras' network, a connection out to the internet gets there.")];
}
/* the manager's PC opens each camera's page at its fixed address: the first that doesn't, and why its request or reply stops */
function camViewCauses(sim, v) {
  const rows = v.plan.cams.map(function (c) { const ip = camIp(v, c); return { c: c, ip: ip, r: sim.route("mgr", ip, { proto: "tcp", port: 443, sport: 50123 }), pg: browse(sim, "mgr", "https://" + ip) }; });
  const bad = function (x) { return x.pg.status !== "cam" || x.pg.dev !== x.c.id; }, r = rows.find(bad) || rows[0], who = the(sim, r.c.id), f = r.r.fail, y = r.r.why, no = bad(r);
  const tried = "From the manager's PC, https://" + r.ip;
  return [C("off", no && !sim.on(r.c.id), cap(who) + " is off", "Both cameras are on.", dark(sim, r.c.id)),
    C("route", no && (f === "net-unreachable" || f === "gateway-unreachable"), "The router has no way to the cameras' network yet", "The router routes to the cameras.", tracert(r.ip)),
    C("nobody", no && y === "arp", "Nothing answers at " + who + "'s fixed address", "Something answers there.", tried + " times out; show ip arp on the router: " + r.ip + " Incomplete."),
    C("blocked", no && f === "blocked", "The manager's request is dropped on its way to " + who + ": a list stops it", "The request gets there.", tried + " times out; show access-lists: a deny line's count goes up each try."),
    C("gateway", no && y === "their gateway", cap(who) + " gets the request, but sends its reply to a gateway that isn't the router", "Its reply goes to the router.", tried + " times out; " + who + "'s page shows its settings."),
    C("reply", no && y === "reply blocked", cap(who) + "'s replies are dropped on their way back: the cameras' list doesn't let them out", "Its replies get back.", tried + " times out; show access-lists: the cameras' list counts no matches for the replies."),
    C("swap", no && r.pg.status === "cam" && r.pg.dev !== r.c.id, "The other camera answers at " + who + "'s fixed address", "Each camera answers at its own address.", tried + " opens " + (r.pg.dev ? the(sim, r.pg.dev) : "") + "'s page."),
    C("other", no, cap(who) + "'s page doesn't open from the manager's PC", "Both pages open.", tried + ": " + (r.pg.head || "no page") + ".")];
  function tracert(ip) { return "tracert " + ip + " from the manager's PC: the router says Destination net unreachable."; }
}
/* from outside, on the manager's phone (mobile data): each camera's port from the records, through the router's forwards */
function camRemoteCauses(sim, v) {
  const wan = sim.net.isp.wanIp, rows = v.plan.cams.map(function (c) { return { c: c, r: sim.fromInternet(wan, c.ext, "tcp") }; });
  const r = rows.find(function (x) { return !x.r.ok || x.r.who !== x.c.id || +x.r.lport !== 443; }) || rows[0], who = the(sim, r.c.id), y = r.r.why, ok = !!r.r.ok;
  const tried = "On the manager's phone, on mobile data, https://" + wan + ":" + r.c.ext, out = tried + " times out.", no = tried + " is refused.";
  return [C("wan", y === "wan" || y === "provider" || y === "nobody", "The router isn't reachable from the internet at the business's address", "The router is up on the provider's side.", out),
    C("aclin", y === "acl-in", "An access list in on the provider's port drops it", "Nothing on the provider's side drops it.", out + " show access-lists: a deny line's count goes up each try."),
    C("forward", y === "no-forward", "The router has no forward for " + who + "'s outside port", "The router forwards its port.", no + " show ip nat translations: nothing for port " + r.c.ext + "."),
    C("outside", y === "outside", "The provider's port isn't NAT's outside, so nothing arriving there is translated", "The provider's port is NAT's outside.", no + " show running-config: no ip nat outside on " + v.plan.wanPort + "."),
    C("route", y === "no-route", "The forward points at an address the router has no network for", "The forward's address is on one of the router's networks.", out + " show ip nat translations: " + (r.r.local || "") + "."),
    C("inside", y === "inside", "The forward's address is on a network that isn't NAT's inside", "The cameras' subinterface is NAT's inside.", out + " show running-config: no ip nat inside on " + (r.r.outIf || "the cameras' subinterface") + "."),
    C("aclout", y === "acl-out", "An access list out towards the cameras drops it", "Nothing on the way to the cameras drops it.", out + " show access-lists: a deny line's count goes up each try."),
    C("nobody", y === "arp", "Nothing answers at the address the forward sends it to", "The camera answers at the forward's address.", out + " show ip arp on the router: " + (r.r.local || "") + " Incomplete."),
    C("swap", !!r.r.who && r.r.who !== r.c.id, cap(who) + "'s outside port goes to the other camera", "Each port reaches its own camera.", ok ? tried + " opens " + the(sim, r.r.who) + "'s page." : "show ip nat translations: port " + r.c.ext + " goes to " + (r.r.local || "") + "."),
    C("port", y === "port", "The forward sends it to a port " + who + " doesn't answer on", "The camera answers on the forwarded port.", no + " show ip nat translations: " + (r.r.local || "") + ":" + (r.r.lport || "") + "."),
    /* its plain page: the camera answers there, but the manager's password would cross the internet unencrypted (and the cameras'
       list, letting out only replies from the secure page, drops what it sends back) */
    C("http", !!r.r.who && r.r.who === r.c.id && y !== "port" && r.r.lport != null && +r.r.lport !== 443, "The forward goes to " + who + "'s unencrypted page: the manager's password would cross the internet in plain text", "It goes to the camera's secure page.", (ok ? tried + ": the phone says the site can't provide a secure connection." : out) + " show ip nat translations: " + (r.r.local || "") + ":" + r.r.lport + "."),
    C("gateway", y === "gateway", cap(who) + "'s reply never comes back: its gateway isn't the router", "Its reply goes to the router.", out),
    C("reply", y === "reply", "The cameras' list drops " + who + "'s replies on their way back out", "Its replies get out.", out + " show access-lists: the cameras' list counts no matches for the replies.")];
}
function camStillCauses(sim) {
  const down = PCS.find(function (id) { return !online(sim, id); }), noPrint = ["pc", "bpc"].find(function (id) { return !printOk(sim, id); }), ip = apAddr(sim), r = ip ? sim.route("mgr", ip) : null;
  return [C("net", !!down, "The " + (down ? name(sim, down) : "") + " is offline", "Every staff PC is online.", "ping from the " + (down ? name(sim, down) : "") + ": no replies from the internet."),
    C("print", !!noPrint, "The " + (noPrint ? name(sim, noPrint) : "") + " can't print", "Staff print.", "Test pages from the " + (noPrint ? name(sim, noPrint) : "") + " don't print."),
    C("guest", !online(sim, "guest"), "The visitor's phone is offline: the guest network stopped working", "Guests are online.", "The visitor's phone: no internet."),
    C("ap", !!r && !((r.local || r.routed) && !r.fail), "The manager's PC can't reach the access point's page", "The access point's page opens from the manager's PC.", "From the manager's PC the access point's address doesn't answer.")];
}
const SB5 = {
  id: "SB-J5", level: "business", title: "Two cameras on their own VLAN, kept apart, and seen from outside through port forwards",
  already: ["still", "saved", "swsaved", "bswsaved"],
  start(seed) {
    const b = SB4.start(seed), sim = b.sim;
    for (const a of SB4.solve(b.v, sim)) { if (a.t === "cmd") exec(sim, a.dev, a.line); else sim.apply(a); }
    addCameraKit(sim); sim.cli = {};   /* the two cameras and their injectors came in their boxes; the manager has their phone with them */
    return { sim: sim, v: b.v };
  },
  brief(v, sim) { return { quote: "Someone tried our back door last month, and the insurer wants cameras. Two came this week: a dome for the ceiling in " + roomOf(sim, "guest") + " and one for the wall by the back door. I want to watch them from my office, and on my phone when I'm not here. The installer said cameras like these are the first thing hackers go for, so keep them well away from everything else of ours.", from: sim.net.client.manager + ", " + sim.net.client.name }; },
  mason: "A camera is the least trusted thing on the network: its own VLAN, an address that never changes, and an access list that lets it answer but never start anything. The way in from outside is the router's: one outside port for each camera, sent on to that camera's secure page.",
  limits: function (v, sim) {
    const p = v.plan, cv = cams(v), a = p.cams[0], b = p.cams[1], S = staff(v);
    return ["The business's plan: the cameras are VLAN " + cv.id + ", named " + cv.name + ", on " + cv.net + "/24 with the gateway " + cv.gw + " on the router's " + subName(v, "cameras") + ". Their pool keeps the first " + p.camExcl + " addresses back. Their access list, in on that subinterface, is named " + p.camAcl + ": the cameras answer on their secure page (HTTPS, 443) and start nothing.",
      a.tag + ", the ceiling dome, goes " + spot(sim, 0) + ". Its injector (labelled " + a.tag + ") goes in the closet, on the closet switch's port " + a.port + ", described " + a.desc + ". Its fixed address: " + camIp(v, a) + ".",
      b.tag + ", the wall dome, goes " + spot(sim, 1) + ". Its injector (labelled " + b.tag + ") goes in the back room, on the back switch's port " + b.port + ", described " + b.desc + ". Its fixed address: " + camIp(v, b) + ".",
      "Camera ports are access ports, set as access (never left to negotiate), opened and described. The trunk between the two switches carries the cameras' VLAN as well as staff's (" + S.id + "). The cameras start on DHCP: each one's fixed address, mask and gateway are set on its own page, opened from the manager's PC.",
      "From outside, the manager opens https://(the business's address on the provider's side):" + a.ext + " for " + a.tag + " and :" + b.ext + " for " + b.tag + ", each sent on to its camera's port 443. Test it as the manager will use it: on their phone, Wi-Fi off.",
      "The records are as before: router " + p.rtHost + " (secret " + p.rtSecret + ", console " + p.rtConsole + "); switches " + p.swHost + " and " + p.bswHost + " (secret " + p.swSecret + ", console " + p.swConsole + ")."];
  },
  reqs: [{
    id: "cam1", text: "The ceiling camera is up over the guests, powered by its own injector, its run on the closet switch's port the records give it",
    causes: function (sim, v) { return camCauses(sim, v, 0); },
    ok: function (sim, v) { return "It's " + spot(sim, 0) + ", powered by its injector in the closet, its run on the closet switch's port " + v.plan.cams[0].port + "."; },
    rung1: function () { return "Look at the camera's Physical tab and its status light; then the Cable runs table: where does its cable come from, and where does that injector's other side go?"; },
    rung2: function () { return "A dome camera is powered down its network cable (PoE). Neither switch gives power, so each camera's run goes through its own injector: data in on one side, data and power out to the camera on the other."; }
  }, {
    id: "cam2", text: "The back door camera is up by the back door, powered by its own injector, its run on the back switch's port the records give it",
    causes: function (sim, v) { return camCauses(sim, v, 1); },
    ok: function (sim, v) { return "It's " + spot(sim, 1) + ", powered by its injector in the back room, its run on the back switch's port " + v.plan.cams[1].port + "."; },
    rung1: function () { return "Look at the camera's Physical tab and its status light; then the Cable runs table: where does its cable come from, and where does that injector's other side go?"; },
    rung2: function () { return "A camera's run goes to the switch in the room it's in: the back of house has its own switch now. Its injector sits beside that switch, data in from the switch, data and power out to the camera."; }
  }, {
    id: "vlan", text: "Both switches have the cameras' VLAN, named as the records say",
    causes: camVlanCauses,
    ok: function (sim, v) { return "VLAN " + cams(v).id + " " + cams(v).name + " exists on both switches."; },
    rung1: function () { return "show vlan brief on each switch."; },
    rung2: function () { return "Each switch keeps its own list of VLANs: a VLAN made on one switch doesn't exist on the other until it's made there too."; }
  }, {
    id: "ports", text: "Each camera's port is open, described, and set as an access port in the cameras' VLAN",
    causes: camPortCauses,
    ok: function () { return "Both cameras' ports are access ports in the cameras' VLAN, open and described as the records say."; },
    rung1: function () { return "show interfaces status and show vlan brief on each switch; show interfaces (the camera's port) switchport for how it was set."; },
    rung2: function () { return "A camera knows nothing of VLANs: its switch port decides which network it's on. A port set as an access port stays in its one VLAN whatever is plugged into it, and a camera by an outside door is the easiest thing in the building to unplug."; }
  }, {
    id: "trunks", text: "The trunks carry the cameras' VLAN: to the router, and between the two switches",
    causes: camTrunkCauses,
    ok: function () { return "The trunk between the switches carries the cameras' VLAN and staff's at both ends; the trunk to the router carries it too."; },
    rung1: function () { return "show interfaces trunk on both switches: which VLANs each trunk allows and has active."; },
    rung2: function () { return "A VLAN crosses a trunk only if both ends allow it. Giving a trunk its allowed list again replaces the old list; adding a VLAN to it keeps the ones already there."; }
  }, {
    id: "sub", text: "The router has the cameras' gateway on a subinterface, NAT's inside",
    causes: function (sim, v) { return subCauses(sim, v, "cameras"); },
    ok: function (sim, v) { return vlanSub(view(sim), v, "cameras") + " tags VLAN " + cams(v).id + " at " + cams(v).gw + ", NAT's inside."; },
    rung1: function () { return "On the router: show ip interface brief, then show running-config for the subinterfaces."; },
    rung2: function () { return "Each VLAN on the trunk gets its own subinterface, tagged with its VLAN and holding its gateway. A forward from outside is NAT too: it only translates between an interface set as outside and one set as inside."; }
  }, {
    id: "pool", text: "The router hands out the cameras' addresses, keeping the first twenty back",
    causes: function (sim, v) { return poolCauses(sim, v, "cameras"); },
    ok: function () { return "A pool for the cameras' network, with its gateway, the first twenty kept back."; },
    rung1: function () { return "On the router: show ip dhcp pool, and the pool's lines in show running-config."; },
    rung2: function () { return "A camera from its box asks for an address by DHCP. Its network needs a pool that hands out the gateway, and the addresses given to devices by hand have to be kept out of it."; }
  }, {
    id: "fixed", text: "Each camera has its fixed address from the records, set on its own page",
    causes: camFixedCauses,
    ok: function (sim, v) { return v.plan.cams.map(function (c) { return c.tag + " is at " + camIp(v, c); }).join(", ") + ", fixed, with the cameras' gateway."; },
    /* no lease (the guests' trap again, if the list goes on first): the hints point at what the camera's first message meets */
    rung1: function (v, sim) { return v.plan.cams.some(function (c) { return noCamLease(sim, c); }) ? "A camera's first message goes in at the router's cameras' subinterface: look at the pool, and at what's applied there (show ip dhcp pool, show ip interface, show access-lists)." : "Find each camera's address (show ip dhcp binding on the router), then open its page from the manager's PC and look at its network settings."; },
    rung2: function (v, sim) { return v.plan.cams.some(function (c) { return noCamLease(sim, c); }) ? "A camera with no address asks for one with a broadcast, sent from no address at all to UDP port 67. Anything checking what comes in from the cameras sees that request before any other traffic, and an access list ends with a deny you never see." : "A device that others point at, by a forward or in the records, needs an address that never changes: set on the device itself, outside the pool, with its network's mask and gateway."; }
  }, {
    id: "apart", text: "The cameras can't start anything: not with the staff PCs, the old network, or the internet",
    causes: camApartCauses,
    ok: function () { return "Nothing a camera starts gets anywhere."; },
    rung1: function () { return "On the router: show access-lists, and which interface each list is applied to, in which direction (show running-config)."; },
    rung2: function () { return "A camera only ever needs to answer: someone opens its page, and it replies. Its replies come from the port its page is on. A list in on the cameras' interface sees everything they send, and every list ends with a deny you never see."; }
  }, {
    id: "view", text: "The manager's PC opens both cameras' pages at their fixed addresses",
    causes: camViewCauses,
    ok: function () { return "Both cameras' pages open from the manager's PC."; },
    rung1: function () { return "From the manager's PC, open each camera's fixed address in the browser; on the router, show access-lists while you do."; },
    rung2: function () { return "A page opens only if the request gets there and the reply gets back. Access lists remember nothing: the reply is checked on its own, against the list on the interface it comes in on, by its own source and destination ports."; }
  }, {
    id: "remote", text: "From the manager's phone on mobile data, each camera's page opens on its port from the records",
    causes: camRemoteCauses,
    ok: function (sim, v) { return "From outside, port " + v.plan.cams[0].ext + " opens " + v.plan.cams[0].tag + " and port " + v.plan.cams[1].ext + " opens " + v.plan.cams[1].tag + ", each on its secure page."; },
    rung1: function () { return "On the router: show ip interface brief (the business's address on the provider's side), show ip nat translations, and the ip nat lines in show running-config. Then try it on the manager's phone, Wi-Fi off."; },
    rung2: function () { return "A port forward is static NAT: one port on the router's outside address sent on to one inside address and port. It translates only between an interface set as outside and one set as inside, and the camera's reply has to get back the same way."; }
  }, {
    id: "still", text: "Everything that worked still works",
    causes: camStillCauses,
    ok: function () { return "Staff are online and print, guests are online, and the access point's page opens from the manager's PC."; },
    rung1: function () { return "Ping out from each staff PC and the visitor's phone; print a test page; open the access point's page from the manager's PC."; },
    rung2: function () { return "The trunk between the switches carries staff as well as the cameras now: changing what one end allows can cut off what was already crossing it."; }
  }, L_SAVED_RT, {
    id: "swsaved", text: "The closet switch's setup survives a power cut",
    causes: swSavedCauses,
    ok: function () { return "What's running on the closet switch is saved."; },
    rung1: function () { return "On the closet switch: compare show running-config with show startup-config."; },
    rung2: function () { return "Each device keeps its own startup configuration: saving one saves nothing on the others."; }
  }, {
    id: "bswsaved", text: "The back switch's setup survives a power cut",
    causes: function (sim) { return savedCauses(sim, "bsw"); },
    ok: function () { return "What's running on the back switch is saved."; },
    rung1: function () { return "On the back switch: compare show running-config with show startup-config."; },
    rung2: function () { return "Each device keeps its own startup configuration: saving one saves nothing on the others."; }
  }],
  solve(v, sim) {
    const p = v.plan, cv = cams(v), T = p.trunk, a = p.cams[0], b = p.cams[1], t = function (l) { return { t: "cmd", dev: "tech", line: l, cli: true }; }, w = "0.0.0.255";
    const runs = sim ? sim.net.extra.runs || 0 : 13;   /* runs are numbered in the order they're laid: SB-J1 to SB-J4 laid thirteen, the last the console to the closet switch */
    const sw = function (c, trunkPort) { return [t(""), t(p.swConsole), t("enable"), t(p.swSecret), t("configure terminal"), t("vlan " + cv.id), t("name " + cv.name), t("exit"),
      t("interface gi0/" + c.port), t("description " + c.desc), t("switchport mode access"), t("switchport access vlan " + cv.id), t("no shutdown"),
      t("interface gi0/" + trunkPort), t("switchport trunk allowed vlan add " + cv.id), t("end"), t("copy running-config startup-config"), t("")]; };
    const sub = subName(v, "cameras");
    return [{ t: "place", dev: "cinj1", room: "closet" }, { t: "place", dev: "cam1", room: "guest" },
      { t: "lay", a: E("msw", a.port), b: E("cinj1", "DATA IN") }, { t: "lay", a: E("cinj1", "PoE OUT"), b: E("cam1", "LAN") },
      { t: "place", dev: "cinj2", room: "back" }, { t: "place", dev: "cam2", room: "back" },
      { t: "lay", a: E("bsw", b.port), b: E("cinj2", "DATA IN") }, { t: "lay", a: E("cinj2", "PoE OUT"), b: E("cam2", "LAN") }]
      .concat(sw(a, T.closet),
        [{ t: "pull", cable: "c-console-" + runs }, { t: "place", dev: "tech", room: "back" }, { t: "lay", a: E("tech", "USB-C"), b: E("bsw", "CONSOLE") }],   /* the four camera runs, then this console */
        sw(b, T.back),
        [{ t: "pull", cable: "c-console-" + (runs + 5) }, { t: "place", dev: "tech", room: "closet" }, { t: "lay", a: E("tech", "USB-C"), b: E("rtr", "CONSOLE") },
          t(""), t(p.rtConsole), t("enable"), t(p.rtSecret), t("configure terminal"),
          t("interface " + sub), t("encapsulation dot1Q " + cv.id), t("ip address " + cv.gw + " " + p.vmask), t("ip nat inside"), t("exit"),
          t("ip dhcp excluded-address " + cv.gw + " " + cv.net.replace(/\.0$/, "." + p.camExcl)), t("ip dhcp pool " + cv.name), t("network " + cv.net + " " + p.vmask), t("default-router " + cv.gw), t("exit"), t("end"),
          { t: "client", dev: "cam1", values: { mode: "static", ip: camIp(v, a), mask: p.vmask, gw: cv.gw } },
          { t: "client", dev: "cam2", values: { mode: "static", ip: camIp(v, b), mask: p.vmask, gw: cv.gw } },
          t("configure terminal"), t("interface " + sub), t("ip access-group " + p.camAcl + " in"), t("exit"),
          t("ip access-list extended " + p.camAcl), t("permit tcp " + cv.net + " " + w + " eq 443 any"), t("exit"),
          t("ip nat inside source static tcp " + camIp(v, a) + " 443 interface " + p.wanPort + " " + a.ext),
          t("ip nat inside source static tcp " + camIp(v, b) + " 443 interface " + p.wanPort + " " + b.ext),
          t("end"), t("copy running-config startup-config"), t("")]);
  },
  answer(v) {
    const p = v.plan, cv = cams(v), T = p.trunk, a = p.cams[0], b = p.cams[1], sub = subName(v, "cameras");
    return ["Place injector " + a.tag + " in the closet and the ceiling camera in the guest area; the closet switch's port " + a.port + " to the injector's DATA IN, its PoE OUT to the camera. The same in the back room: injector " + b.tag + ", the back door camera, the back switch's port " + b.port + ".",
      "On the closet switch (console): vlan " + cv.id + ", name " + cv.name + "; interface gi0/" + a.port + ": description " + a.desc + ", switchport mode access, switchport access vlan " + cv.id + ", no shutdown; interface gi0/" + T.closet + ": switchport trunk allowed vlan add " + cv.id + "; save.",
      "Take your laptop to the back room, console to the back switch: the same VLAN; interface gi0/" + b.port + ": description " + b.desc + ", access, VLAN " + cv.id + ", no shutdown; interface gi0/" + T.back + ": switchport trunk allowed vlan add " + cv.id + "; save.",
      "On the router (console): interface " + sub + ": encapsulation dot1Q " + cv.id + ", ip address " + cv.gw + " " + p.vmask + ", ip nat inside. ip dhcp excluded-address " + cv.gw + " " + cv.net.replace(/\.0$/, "." + p.camExcl) + "; ip dhcp pool " + cv.name + ": network " + cv.net + " " + p.vmask + ", default-router " + cv.gw + ".",
      "show ip dhcp binding: open each camera's leased address from the manager's PC, and set its fixed address on its page: " + camIp(v, a) + " and " + camIp(v, b) + ", mask " + p.vmask + ", gateway " + cv.gw + ".",
      "On the router: interface " + sub + ": ip access-group " + p.camAcl + " in; ip access-list extended " + p.camAcl + ": permit tcp " + cv.net + " 0.0.0.255 eq 443 any.",
      "ip nat inside source static tcp " + camIp(v, a) + " 443 interface " + p.wanPort + " " + a.ext + "; the same for " + camIp(v, b) + " on " + b.ext + "; save. Then the manager's phone, Wi-Fi off: https://(the router's provider address):" + a.ext + " and :" + b.ext + "."];
  },
  summary(v, sim) {
    const p = v.plan, cv = cams(v);
    return ["The ceiling camera is " + spot(sim, 0) + " and the back door camera " + spot(sim, 1) + ", each powered by its own injector, on access ports in the cameras' VLAN " + cv.id + " (" + cv.name + ").",
      "The trunk between the switches carries the cameras as well as staff; the router's " + subName(v, "cameras") + " is their gateway, " + cv.gw + ", and hands out their addresses until each is fixed: " + camIp(v, p.cams[0]) + " and " + camIp(v, p.cams[1]) + ".",
      "The cameras' list lets them answer on their secure page and start nothing; the manager reaches them from the office, and from outside on ports " + p.cams[0].ext + " and " + p.cams[1].ext + ".", "All three devices are saved."];
  }
};

/* ---------------------------------------------------------------- SB-J6: hardening after the card processor's PCI DSS check */
/* the owner's decisions (28 October 2026): the reason, a card payment check; the router managed by SSH only, and only the staff
   VLAN reaching its remote lines; no password readable on any of the three; idle sessions logged out; one device on each staff PC's
   port, a stranger shutting it; spare ports shut and parked; device ports never trunks; the router silent to the provider (LLDP off
   on its outside port; "its web server off" dropped on 31 October, as it never had one); DHCP snooping with ARP inspection; the
   closet cabinet locked and its key taken away (the cabinet approved on 31 October); everything still working; every device saved */
const THREE = [["rtr", "router"], ["msw", "closet switch"], ["bsw", "back switch"]];
const SWS = [["msw", "closet switch"], ["bsw", "back switch"]];
const parking = function (v) { return VL(v, "parking"); };
const gi = function (n) { return String(n || "").replace("GigabitEthernet", "Gi"); };
const PS_NONE = { on: false, max: 1, viol: "shutdown", sticky: false, macs: [] };
const psRead = function (p) { return (p && p.ps) || PS_NONE; };   /* read only: a port never secured has no settings, and checking adds none */
const STAFF_PCS = [["pc", "msw"], ["mgr", "msw"], ["bpc", "bsw"]];
const NEVER = function (t) { return !!t && t[0] === 0 && t[1] === 0; };
const idleSecs = function (t) { return t ? t[0] * 60 + t[1] : 600; };   /* no exec-timeout: the default, ten minutes */
/* the ports with something at the far end, and what's really there: through an injector to the camera or the access point it powers.
   kind: "device" (a PC, the printer, a camera, a laptop), "ap", or "link" (the other switch, the router) */
function farEnds(sim, id) {
  const out = []; if (!sim.d[id]) return out;
  for (let k = 1; k <= 24; k++) {
    const c = sim.cableAt(id, String(k)); if (!c) continue;
    let far = c.a.dev === id ? c.b : c.a, x = sim.d[far.dev];
    if (x && x.kind === "injector") { const o = sim.cableAt(far.dev, far.port === "PoE OUT" ? "DATA IN" : "PoE OUT"); far = o ? (o.a.dev === far.dev ? o.b : o.a) : null; x = far ? sim.d[far.dev] : null; }
    const kind = !x ? null : x.kind === "bap" ? "ap" : /^(mswitch|brouter|router|modem)$/.test(x.kind) ? "link" : "device";
    if (kind) out.push({ n: port(k), p: sim.d[id].sw.ports[port(k)], dev: far.dev, kind: kind });
  }
  return out;
}
const spareOf = function (sim, id) { const out = []; for (let k = 1; k <= 24; k++) if (!sim.cableAt(id, String(k))) out.push(port(k)); return out; };
/* each switch's way to the router: the closet switch's port the router is in, the back switch's end of the trunk to the closet */
function towardRouter(sim, id) {
  if (id === "msw") { const u = between(sim, "rtr", "msw"); return u ? port(u.far) : null; }
  const L = trunkLink(sim); return L ? port(L.back) : null;
}
/* the staff and guest VLANs a switch carries: snooping and inspection go on each of them */
const vlanWords = function (l) { return l.length > 1 ? "VLANs " + l.join(",") + " aren't" : "VLAN " + l[0] + " isn't"; };
const guarded = function (sim, v, id) { const sw = sim.d[id].sw; return [staff(v).id, guest(v).id].filter(function (x) { return !!sw.vlans[x]; }); };

function sshCauses(sim, v) {
  const R = RT(sim), p = v.plan, u = R.users[p.user], t = R.vty.transport;
  return [C("domain", !R.domain, "The router has no domain name: SSH's keys are named from its hostname and a domain", "It has a domain name.", "show running-config on the router: no ip domain-name."),
    C("keys", !R.rsa, "The router has no RSA keys, so it can't speak SSH", "It has its keys.", "show crypto key mypubkey rsa on the router: no RSA keys."),
    C("small", !!R.rsa && R.rsa < 768, "Its keys are too short: under 768 bits it offers only SSH version 1, which nothing should use", "Its keys are long enough for SSH version 2.", "show crypto key mypubkey rsa on the router: RSA KEYS " + R.rsa + " bits."),
    C("user", !u, "The router has no local user from the business's records", "The records' user is on it.", "show running-config on the router: no username " + p.user + "."),
    C("userpw", !!u && !pwOk(u, p.userPw), "The records' user is on it, but not with the records' password", "The user's password is the records'.", "The business's password for " + p.user + " isn't accepted."),
    C("login", R.vty.login !== "local", "The remote lines don't ask for a user from the router's own list", "The remote lines log in with the router's users.", "show running-config on the router: line vty 0 4 has " + (R.vty.login ? "login (a line password only)" : "no login") + "."),
    C("telnet", /^(telnet|all)$/.test(t), "Telnet is still taken on the remote lines: logins cross the network in plain text", "Only SSH is taken.", "show running-config on the router: line vty 0 4, transport input " + t + "."),
    C("none", !/^(ssh|telnet|all)$/.test(t), "The remote lines take no connections at all", "The remote lines take SSH.", "show running-config on the router: line vty 0 4, transport input " + t + ".")];
}
function vtyCauses(sim, v) {
  const R = RT(sim), p = v.plan, S = staff(v), a = R.vty.acl, L = !!a && !!R.acls[a];
  const lets = function (src) { return L && aclVerdict(R, a, { proto: "tcp", src: src, dst: S.gw, sport: 50000, port: 22 }).permit; };
  const m = sim.addr("mgr"), mine = m && m.kind !== "apipa" && inNet(m.ip, S.net) ? m.ip : S.net.replace(/\.0$/, ".50"), h = function (net) { return net.replace(/\.0$/, ".50"); };
  const wide = [["the guest network", h(guest(v).net)], ["the cameras' network", h(cams(v).net)], ["the old network", h(p.lan)], ["the internet", "203.0.113.80"]].find(function (o) { return lets(o[1]); });
  return [C("none", !a && !R.vty.aclOut, "Nothing limits who can reach the router's remote lines", "A list guards the remote lines.", "show running-config on the router: line vty 0 4 has no access-class."),
    C("out", !a && !!R.vty.aclOut, "A list is on the remote lines, but outbound: it limits where the lines connect to, not who logs in", "The list is applied in.", "show running-config on the router: line vty 0 4, access-class " + R.vty.aclOut + " out."),
    C("missing", !!a && !L, "The list on the remote lines doesn't exist: a missing list lets everyone in", "The list exists.", "show access-lists on the router: no list " + a + "."),
    C("staff", L && !lets(mine), "The list shuts out the staff VLAN too", "Staff get through it.", "ssh from the manager's PC to the router: Connection refused."),
    C("wide", L && !!wide, "The list lets in more than the staff VLAN", "Only staff get through.", "show access-lists on the router: " + a + " lets in " + (wide ? wide[0] : "") + "."),
    C("name", !!a && a !== p.vtyAcl, "The list isn't the one named in the business's records", "It's the records' list.", "show running-config on the router: line vty 0 4, access-class " + a + " in.")];
}
function pwCauses(sim) {
  return [].concat.apply([], THREE.map(function (d) {
    const sw = sim.d[d[0]].sw, ep = sw.enablePassword, seven = !!ep && (sw.encrypt || /^\$7\$/.test(ep));
    return [C(d[0] + "-enable", !!ep, "The " + d[1] + " has an enable password beside its secret" + (seven ? ": encrypted, it's type 7, which anyone can reverse" : ", in plain text"), "The " + d[1] + " has only its secret.", "show running-config on the " + d[1] + ": enable password " + (seven ? "7 (scrambled, reversible)" : "in plain text") + "."),
      C(d[0] + "-service", !sw.encrypt, "The " + d[1] + "'s line passwords show in plain text in its configuration", "The " + d[1] + "'s passwords are encrypted.", "show running-config on the " + d[1] + ": no service password-encryption; line con 0's password reads as typed.")];
  }));
}
function idleCauses(sim, v) {
  const lim = v.plan.idle * 60;
  return [].concat.apply([], THREE.map(function (d) {
    const sw = sim.d[d[0]].sw, rows = [["con", "line con 0"], ["vty", d[0] === "rtr" ? "line vty 0 4" : "line vty 0 15"]].map(function (l) { return { l: l[1], t: sw[l[0]].timeout || null }; });
    const never = rows.find(function (r) { return NEVER(r.t); }), long = rows.find(function (r) { return !NEVER(r.t) && idleSecs(r.t) > lim; });
    return [C(d[0] + "-never", !!never, "The " + d[1] + "'s console or remote lines never log out: a timeout of zero turns the timer off", "None of the " + d[1] + "'s lines is set to never log out.", "show running-config on the " + d[1] + ": " + (never ? never.l : "a line") + ", exec-timeout 0 0."),
      C(d[0] + "-long", !!long, "The " + d[1] + "'s console or remote lines keep an idle session longer than the records allow", "The " + d[1] + "'s lines log out in time.", "show running-config on the " + d[1] + ": " + (long ? long.l + (long.t ? ", exec-timeout " + long.t.join(" ") : " has no exec-timeout (the default: ten minutes)") : "") + ".")];
  }));
}
/* each staff PC's port, as the records set it: the first PC whose port isn't, and what's wrong with it */
function psecCauses(sim, v) {
  const rows = STAFF_PCS.map(function (x) { const m = between(sim, x[0], x[1]), sw = sim.d[x[1]].sw, n = m ? port(m.far) : null; return { id: x[0], at: x[1] === "msw" ? "closet switch" : "back switch", m: m, n: n, sw: sw, P: psRead(n && sw.ports[n]), mac: dotMac(sim.macOf(x[0])) }; });
  const stuck = function (r) { return r.P.macs.filter(function (k) { return k.sticky; }); };
  const bad = function (r) { return !r.m || !r.P.on || errDisabled(r.sw, r.n) || r.P.max > 1 || r.P.viol !== "shutdown" || !stuck(r).some(function (k) { return k.mac === r.mac; }); };
  const r = rows.find(bad) || rows[0], P = r.P, who = name(sim, r.id), g = gi(r.n), st = stuck(r), other = st.find(function (k) { return k.mac !== r.mac; });
  const M = SW(sim), ap = farEnds(sim, "msw").find(function (e) { return e.kind === "ap"; }), apOn = !!ap && psRead(ap.p).on;
  const ups = SWS.map(function (d) { return farEnds(sim, d[0]).filter(function (e) { return e.kind === "link" && psRead(e.p).on; }).map(function (e) { return gi(e.n) + " on the " + d[1]; }); }).reduce(function (a, b) { return a.concat(b); }, []);
  return [C("cable", !r.m, "The " + who + " isn't on its switch", "Each staff PC is on its switch.", "The " + who + "'s cable doesn't reach the " + r.at + "."),
    C("off", !!r.m && !P.on, "The " + who + "'s port has no port security: any device plugged in there gets on the network", "Its port has port security.", "show port-security interface " + g + " on the " + r.at + ": Port Security : Disabled."),
    C("err", !!r.m && P.on && errDisabled(r.sw, r.n), "The " + who + "'s port has been shut by a violation: the PC is cut off until the port is reset", "Its port is up.", "show interfaces status on the " + r.at + ": " + g + " err-disabled."),
    C("max", P.on && P.max > 1, "Its port takes more than one device", "It takes one device.", "show port-security interface " + g + " on the " + r.at + ": Maximum MAC Addresses : " + P.max + "."),
    C("viol", P.on && P.viol !== "shutdown", "A stranger on its port is " + (P.viol === "protect" ? "dropped" : "counted") + ", but the port stays up", "A stranger shuts the port.", "show port-security interface " + g + " on the " + r.at + ": Violation Mode : " + cap(P.viol) + "."),
    C("sticky", P.on && !st.length, "Its port learns the PC's address but doesn't keep it: unplugged, another device takes its place", "The PC's address is stuck in the configuration.", "show running-config on the " + r.at + ": " + g + " has no sticky address."),
    C("wrong", P.on && st.length > 0 && !st.some(function (k) { return k.mac === r.mac; }), "Its port has stuck another device's address, not the PC's", "It holds the PC's address.", "show port-security address on the " + r.at + ": " + g + " holds " + (other ? other.mac : "") + "."),
    C("ap", apOn, "Port security is on the access point's port: every visitor's phone counts as another device", "The access point's port has none.", "show port-security on the closet switch: " + (ap ? gi(ap.n) : "the access point's port") + " is secured."),
    C("uplink", ups.length > 0, "Port security is on a trunk to the router or the other switch: everything behind it counts as another device", "The trunks have none.", "show port-security: " + ups.join(", ") + " is secured.")];
}
function parkCauses(sim, v) {
  const P = parking(v), rows = SWS.map(function (d) { return spareOf(sim, d[0]).map(function (n) { return { d: d, n: n, p: sim.d[d[0]].sw.ports[n] }; }); }).reduce(function (a, b) { return a.concat(b); }, []);
  const open = rows.find(function (r) { return !r.p.shutdown; }), neg = rows.find(function (r) { return r.p.mode !== "access"; }), off = rows.find(function (r) { return r.p.access !== P.id; });
  const vl = function (id) { return sim.d[id].sw.vlans[P.id]; }, at = function (r) { return r ? gi(r.n) + " on the " + r.d[1] : ""; };
  return [C("cvlan", !vl("msw"), "The closet switch has no parking VLAN", "The closet switch has it.", "show vlan brief on the closet switch: no VLAN " + P.id + "."),
    C("cname", !!vl("msw") && vl("msw").name !== P.name, "The closet switch's parking VLAN isn't named as the records say", "It's named as the records say.", "show vlan brief on the closet switch: VLAN " + P.id + " is " + (vl("msw") ? vl("msw").name : "") + "."),
    C("bvlan", !vl("bsw"), "The back switch has no parking VLAN", "The back switch has it.", "show vlan brief on the back switch: no VLAN " + P.id + "."),
    C("bname", !!vl("bsw") && vl("bsw").name !== P.name, "The back switch's parking VLAN isn't named as the records say", "It's named as the records say.", "show vlan brief on the back switch: VLAN " + P.id + " is " + (vl("bsw") ? vl("bsw").name : "") + "."),
    C("open", !!open, "A spare port is open: anyone can plug in there", "Every spare port is shut.", "show interfaces status: " + at(open) + " is notconnect, not disabled."),
    C("mode", !!neg, neg && neg.p.mode === "trunk" ? "A spare port is set as a trunk" : "A spare port is left to negotiate: plugged into, it could become a trunk", "Every spare port is set as an access port.", "show interfaces " + (neg ? gi(neg.n) : "") + " switchport on the " + (neg ? neg.d[1] : "") + ": administrative mode " + (neg ? neg.p.mode : "") + "."),
    C("vlan", !!off, "A spare port still sits in a VLAN that's in use: opened by mistake, it would land on that network", "Every spare port is in the parking VLAN.", "show vlan brief: " + at(off) + " is in VLAN " + (off ? off.p.access : "") + ".")];
}
function accessCauses(sim) {
  const rows = SWS.map(function (d) { return farEnds(sim, d[0]).filter(function (e) { return e.kind === "device"; }).map(function (e) { return Object.assign({ d: d }, e); }); }).reduce(function (a, b) { return a.concat(b); }, []);
  const dyn = rows.find(function (r) { return /^dynamic/.test(r.p.mode); }), tr = rows.find(function (r) { return r.p.mode === "trunk"; });
  const ev = function (r) { return r ? "show interfaces " + gi(r.n) + " switchport on the " + r.d[1] + " (" + name(sim, r.dev) + "): administrative mode " + r.p.mode + "." : ""; };
  return [C("dyn", !!dyn, "A port with a device on it is still left to negotiate: whatever is plugged in there could ask it for a trunk", "No device's port negotiates.", ev(dyn)),
    C("trunk", !!tr, "A port with a device on it is set as a trunk: whoever is plugged in there reaches every VLAN on it", "Every device's port is an access port.", ev(tr))];
}
function lldpCauses(sim, v) {
  const R = RT(sim), w = v.plan.wanPort, sends = lldpSends(R, w), f = R.ifs[w], lan = R.ifs[v.plan.lanPort];
  return [C("inside", sends && !!lan && lan.lldpTx === false, "LLDP is off on the router's inside port, not on the provider's side", "The inside port isn't where it was turned off.", "show running-config on the router: no lldp transmit on " + v.plan.lanPort + ", not on " + w + "."),
    C("rx", sends && f.lldpRx === false, "The router stops listening for LLDP on the provider's side, but still sends its own", "It sends nothing there.", "show running-config on the router: " + w + " has no lldp receive, and still transmits."),
    C("wan", sends, "The router announces itself on the provider's side: its name, model and software to whoever listens there", "It sends nothing there.", "show running-config on the router: LLDP runs, and " + w + " still transmits.")];
}
function snoopCauses(sim, v) {
  return [].concat.apply([], SWS.map(function (d) {
    const sw = sim.d[d[0]].sw, S = sw.snoop, miss = guarded(sim, v, d[0]).filter(function (x) { return S.vlans.indexOf(x) < 0; }), up = towardRouter(sim, d[0]);
    const dev = farEnds(sim, d[0]).find(function (e) { return e.kind !== "link" && e.p.dtrust; }), w = d[1];
    return [C(d[0] + "-vlans", miss.length > 0, "The " + w + " doesn't snoop on every staff and guest VLAN it carries", "The " + w + " snoops on them.", "show ip dhcp snooping on the " + w + ": " + vlanWords(miss) + " snooped."),
      C(d[0] + "-on", !miss.length && !S.on, "The " + w + " has snooping set for its VLANs but never turned on", "Snooping is on at the " + w + ".", "show ip dhcp snooping on the " + w + ": Switch DHCP snooping is disabled."),
      C(d[0] + "-trust", !!up && !sw.ports[up].dtrust, "The " + w + " doesn't trust the way to the router: the router's own answers are dropped", "It trusts the way to the router.", "show ip dhcp snooping on the " + w + ": " + gi(up) + " isn't trusted."),
      C(d[0] + "-device", !!dev, "The " + w + " trusts a port " + (dev && dev.kind === "ap" ? "the access point" : "a device") + " is on: a rogue DHCP server there would be believed", "It trusts no device's port.", "show ip dhcp snooping on the " + w + ": " + (dev ? gi(dev.n) : "") + " is trusted.")];
  }));
}
function daiCauses(sim, v) {
  const fixed = [cams(v).id, 1];
  return [].concat.apply([], SWS.map(function (d) {
    const sw = sim.d[d[0]].sw, A = sw.dai.vlans, S = sw.snoop, need = guarded(sim, v, d[0]), miss = need.filter(function (x) { return A.indexOf(x) < 0; }), up = towardRouter(sim, d[0]);
    const blind = A.filter(function (x) { return need.indexOf(x) >= 0 && !(S.on && S.vlans.indexOf(x) >= 0); }), fx = A.filter(function (x) { return fixed.indexOf(x) >= 0; });
    const dev = farEnds(sim, d[0]).find(function (e) { return e.kind !== "link" && e.p.atrust; }), w = d[1];
    return [C(d[0] + "-vlans", miss.length > 0, "The " + w + " doesn't inspect ARP on every staff and guest VLAN it carries", "The " + w + " inspects them.", "show ip arp inspection on the " + w + ": " + vlanWords(miss) + " inspected."),
      C(d[0] + "-blind", blind.length > 0, "The " + w + " inspects ARP where it doesn't snoop: with no bindings to check against, everything there is dropped", "It snoops wherever it inspects.", "show ip dhcp snooping on the " + w + ": " + (blind.length > 1 ? "VLANs " + blind.join(",") + " are" : "VLAN " + blind[0] + " is") + " inspected but not snooped."),
      C(d[0] + "-fixed", fx.length > 0, "The " + w + " inspects ARP on a VLAN of fixed addresses: they never had leases, so they're all dropped", "It inspects no VLAN of fixed addresses.", "show ip arp inspection on the " + w + ": " + (fx.length > 1 ? "VLANs " + fx.join(",") + " are" : "VLAN " + fx[0] + " is") + " inspected."),
      C(d[0] + "-trust", !!up && !sw.ports[up].atrust, "The " + w + " doesn't trust ARP from the way to the router: the router's own replies are dropped", "It trusts the way to the router.", "show ip arp inspection interfaces on the " + w + ": " + gi(up) + " is Untrusted."),
      C(d[0] + "-device", !!dev, "The " + w + " trusts ARP from a port " + (dev && dev.kind === "ap" ? "the access point" : "a device") + " is on: a spoofed reply there would be believed", "It trusts no device's port.", "show ip arp inspection interfaces on the " + w + ": " + (dev ? gi(dev.n) : "") + " is Trusted.")];
  }));
}
function cabinetCauses(sim) {
  const K = sim.d.cab || { open: true, locked: false, key: true };
  return [C("open", K.open, "The closet cabinet's door is standing open", "Its door is shut.", "The closet cabinet's door is standing open."),
    C("unlocked", !K.open && !K.locked, "Its door is shut, but not locked: anyone in the closet can open it", "It's locked.", "The cabinet's door is shut; its handle lifts and it opens."),
    C("key", K.locked && K.key, "It's locked, but the key is still in the lock", "Its key has been taken away.", "The cabinet is locked, with its key still in the lock.")];
}
/* everything still works: the first staff PC that's offline and why (its port shut, no address, its old lease dropped by inspection) */
function hardStillCauses(sim, v) {
  const down = PCS.find(function (id) { return !online(sim, id); }), who = down ? name(sim, down) : "", a = down ? sim.addr(down) : null, rr = down ? sim.route(down, "8.8.8.8") : null;
  const sp = down && (function () { const x = STAFF_PCS.find(function (q) { return q[0] === down; }), m = between(sim, down, x[1]); return m ? { sw: sim.d[x[1]].sw, n: port(m.far), at: x[1] === "msw" ? "closet switch" : "back switch" } : null; })();
  const err = !!sp && errDisabled(sp.sw, sp.n), noAddr = !!down && !err && (!a || a.kind === "apipa"), dai = !!down && !err && !noAddr && !!(rr && rr.dai);
  const bound = function (id) { const m = dotMac(sim.macOf(id)); return SWS.some(function (d) { return (sim.d[d[0]].sw.snoopBind || []).some(function (b) { return b.mac === m; }); }); };
  const noPrint = ["pc", "bpc"].find(function (id) { return !printOk(sim, id); }), g = sim.route("guest", "8.8.8.8");
  const camBad = v.plan.cams.find(function (c) { const r = sim.fromInternet(sim.net.isp.wanIp, c.ext, "tcp"); return !(r.ok && r.who === c.id); }), ip = apAddr(sim), r = ip ? sim.route("mgr", ip) : null;
  return [C("err", err, "The " + who + "'s port has been shut by port security", "No staff PC's port is shut.", "show interfaces status on the " + (sp ? sp.at : "") + ": " + (sp ? gi(sp.n) : "") + " err-disabled."),
    C("lease", noAddr, "The " + who + " can't get an address: its DHCP answers are dropped on the way", "Every staff PC has an address.", "ipconfig on the " + who + ": " + (a ? a.ip : "no address") + "."),
    C("stale", dai && !bound(down), "The " + who + "'s lease is from before snooping: ARP inspection drops it until it asks again", "Snooping knows every staff PC's lease.", "ping from the " + who + ": no replies; show ip dhcp snooping binding: nothing for its address."),
    C("arp", dai && bound(down), "The " + who + "'s traffic is dropped by ARP inspection on its way", "ARP inspection lets staff through.", "ping from the " + who + ": no replies; show ip arp inspection: its drops count up."),
    C("net", !!down && !err && !noAddr && !dai, "The " + who + " is offline", "Every staff PC is online.", "ping from the " + who + ": no replies from the internet."),
    C("print", !!noPrint, "The " + (noPrint ? name(sim, noPrint) : "") + " can't print", "Staff print.", "Test pages from the " + (noPrint ? name(sim, noPrint) : "") + " don't print."),
    C("guest", !online(sim, "guest"), "The visitor's phone is offline" + (g.dai ? ": ARP inspection drops it" : ""), "Guests are online.", "The visitor's phone: no internet."),
    C("cams", !!camBad, "A camera can't be seen from outside any more", "Both cameras open from outside.", "On the manager's phone, on mobile data: " + (camBad ? camBad.tag : "a camera") + "'s page doesn't open."),
    C("ap", !!r && !((r.local || r.routed) && !r.fail), "The manager's PC can't reach the access point's page", "The access point's page opens from the manager's PC.", "From the manager's PC the access point's address doesn't answer.")];
}
/* the spare copper ports from the records' cabling, as an interface range: "gi0/4 , gi0/7 - 22" */
function spareRange(used) {
  const u = used.map(Number), n = []; for (let k = 1; k <= 24; k++) if (u.indexOf(k) < 0) n.push(k);
  const out = []; for (let i = 0; i < n.length;) { let j = i; while (j + 1 < n.length && n[j + 1] === n[j] + 1) j++; out.push("gi0/" + n[i] + (j > i ? " - " + n[j] : "")); i = j + 1; }
  return out.join(" , ");
}
const closetUsed = function (p) { return ["1", "2", "3", p.apPort, p.cams[0].port, p.trunk.closet, "24"]; };
const backUsed = function (p) { return [p.backPort, p.cams[1].port, p.trunk.back]; };
const SB6 = {
  id: "SB-J6", level: "business", title: "After a card payment check: SSH only, no readable passwords, guarded ports, the cabinet locked",
  already: ["still", "saved", "swsaved", "bswsaved"],
  start(seed) {
    const b = SB5.start(seed), sim = b.sim;
    for (const a of SB5.solve(b.v, sim)) { if (a.t === "cmd") exec(sim, a.dev, a.line); else sim.apply(a); }
    addCabinet(sim); sim.cli = {};   /* the closet cabinet as the processor's check found it: door open, unlocked, its key in the lock */
    return { sim: sim, v: b.v };
  },
  brief(v, sim) { return { quote: "The company that handles our card payments ran its PCI DSS check on our network, and we failed. Their findings are in our records now: how the router is managed, passwords anyone with a copy of the settings could read, ports anyone could plug into, and the closet cabinet left standing open. We have thirty days to put it right, and nothing can stop working while you do.", from: sim.net.client.manager + ", " + sim.net.client.name }; },
  mason: "A check like this asks for the same few things on every device it covers, so work through them one device at a time, at each one's own console, and save it before you move on. Anything that guards DHCP only knows the leases given out after it's on. The cabinet is the last thing you touch.",
  limits: function (v, sim) {
    const p = v.plan, S = staff(v), G = guest(v), P = parking(v);
    return ["The processor's findings, from the records. The router is managed by SSH only: the business's domain (" + p.domain + "), RSA keys of 2048 bits, and the business's user (" + p.user + ", password " + p.userPw + ") from its own list. Telnet off.",
      "Only the staff VLAN (" + S.id + ", " + S.net + "/24) may reach the router's remote lines: a standard access list named " + p.vtyAcl + ", in on the lines.",
      "No password readable in any configuration, on the router and both switches: no enable password beside the secret, and every line password encrypted.",
      "Idle sessions log out after " + p.idle + " minutes, on the console and the remote lines of all three.",
      "Each staff PC's port (the closet switch's 1 and 2, the back switch's " + p.backPort + ") takes one device, the PC there now, stuck in the configuration; a stranger shuts the port. None on the access point's port or the trunks.",
      "Every spare copper port on both switches is shut, set as an access port, in VLAN " + P.id + " (" + P.name + "), which goes nowhere. Every port with a device on it is set as an access port.",
      "The router tells the provider nothing about itself: no LLDP sent on " + p.wanPort + ".",
      "DHCP snooping and ARP inspection on the staff (" + S.id + ") and guest (" + G.id + ") VLANs, on both switches; only the way to the router is trusted. The cameras' fixed addresses and the old network stay as they are.",
      "The closet cabinet locked, and its key given to " + sim.net.client.manager + ", not left in the lock. Everything that works now still works.",
      "The records are as before: router " + p.rtHost + " (secret " + p.rtSecret + ", console " + p.rtConsole + "); switches " + p.swHost + " and " + p.bswHost + " (secret " + p.swSecret + ", console " + p.swConsole + ")."];
  },
  reqs: [{
    id: "ssh", text: "The router is managed by SSH only, logging in as the business's user",
    causes: sshCauses,
    ok: function () { return "The router has its domain and keys, the records' user, and its remote lines take SSH only, logging in from its own list."; },
    rung1: function () { return "On the router: show running-config (its domain, its users, line vty), then show crypto key mypubkey rsa."; },
    rung2: function () { return "SSH needs keys, and the keys are named from the router's hostname and a domain. Logging in as a user from the router's own list needs the lines told to use that list, and the lines take only the protocols they're told to take."; }
  }, {
    id: "vtyacl", text: "Only the staff VLAN can reach the router's remote lines",
    causes: vtyCauses,
    ok: function () { return "The records' list is in on the remote lines, and only the staff VLAN gets through it."; },
    rung1: function () { return "On the router: show access-lists, and line vty in show running-config. Then try SSH from a staff PC, and from somewhere that isn't staff."; },
    rung2: function () { return "An access class on the lines checks where a login comes from before anything else. A standard list judges by the source alone, and ends with a deny you never see; a list that doesn't exist lets everyone through."; }
  }, {
    id: "pwenc", text: "No password can be read in any configuration: the router and both switches",
    causes: pwCauses,
    ok: function () { return "The router and both switches have only their secrets for privileged mode, and every line password is encrypted."; },
    rung1: function () { return "show running-config on each device: read its enable lines and each line's password as anyone holding a copy of the file would."; },
    rung2: function () { return "A secret is kept as a hash. A password is kept as typed unless the device is told to scramble its passwords, and that scrambling (type 7) can be undone by anyone: it hides a password from a glance, not from an attacker."; }
  }, {
    id: "idle", text: "Idle sessions log out in time: console and remote lines, on all three",
    causes: idleCauses,
    ok: function () { return "The console and remote lines of all three log an idle session out within the records' minutes."; },
    rung1: function () { return "On each device: line con 0 and line vty in show running-config."; },
    rung2: function () { return "A line logs an idle session out after ten minutes unless it's told otherwise. A timeout of zero minutes and zero seconds turns the timer off for good."; }
  }, {
    id: "psec", text: "Each staff PC's port takes that PC only: one device, its address stuck, a stranger shutting the port",
    causes: psecCauses,
    ok: function () { return "The three staff PCs' ports each hold their PC's address, stuck, one device at most, and shut on a stranger; the access point's port and the trunks are left alone."; },
    rung1: function () { return "show port-security on both switches, then show port-security interface for each staff PC's port, and the sticky lines in show running-config."; },
    rung2: function () { return "Port security learns the addresses on a port up to its maximum. Sticky writes them into the configuration, so the port still knows its PC after a power cut or an unplugged cable. What a stranger meets depends on the violation mode, and only one mode shuts the port."; }
  }, {
    id: "park", text: "Every spare port on both switches is shut, set as an access port, and parked in a VLAN that goes nowhere",
    causes: parkCauses,
    ok: function () { return "Both switches' spare copper ports are shut, set as access ports, in the parking VLAN, named as the records say."; },
    rung1: function () { return "show interfaces status and show vlan brief on both switches: which ports have nothing in them, and where they sit."; },
    rung2: function () { return "A spare port that's shut can still be opened by mistake. Kept as an access port in a VLAN that carries nothing, it lands nowhere if it ever is."; }
  }, {
    id: "access", text: "Every port with a device on it is set as an access port: none can be talked into a trunk",
    causes: accessCauses,
    ok: function () { return "Every port with a PC, the printer or a camera on it is set as an access port."; },
    rung1: function () { return "show interfaces switchport for each port with a device on it, on both switches: look at the administrative mode."; },
    rung2: function () { return "A port left to negotiate becomes a trunk if whatever is plugged in asks it to, and a trunk carries every VLAN: that's VLAN hopping. A port set as an access port never negotiates."; }
  }, {
    id: "lldp", text: "The router tells the provider nothing about itself",
    causes: lldpCauses,
    ok: function (sim, v) { return "The router sends no LLDP on " + v.plan.wanPort + "."; },
    rung1: function () { return "On the router: the lldp lines under each port in show running-config, and show lldp neighbors."; },
    rung2: function () { return "LLDP announces a device's name, model and software to whatever is on the other end of each port. It can be stopped on one port, sending and listening separately, or everywhere at once."; }
  }, {
    id: "snoop", text: "DHCP snooping guards the staff and guest VLANs on both switches, trusting only the way to the router",
    causes: snoopCauses,
    ok: function () { return "Both switches snoop on the staff and guest VLANs they carry, trusting only their way to the router."; },
    rung1: function () { return "show ip dhcp snooping on both switches: which VLANs, whether it's on, and which ports are trusted."; },
    rung2: function () { return "Snooping drops DHCP answers coming in by any port that isn't trusted, so a rogue server can't hand out addresses. The real server's answers come from the router's side; every other port stays untrusted. It does nothing until it's turned on as well as set for its VLANs."; }
  }, {
    id: "dai", text: "ARP inspection guards the staff and guest VLANs on both switches, trusting only the way to the router",
    causes: daiCauses,
    ok: function () { return "Both switches inspect ARP on the staff and guest VLANs they carry, against snooping's bindings, trusting only their way to the router."; },
    rung1: function () { return "show ip arp inspection and show ip arp inspection interfaces on both switches, beside show ip dhcp snooping binding."; },
    rung2: function () { return "ARP inspection checks each ARP coming in by an untrusted port against the bindings snooping learned. A device with a fixed address never had a lease, so it has no binding; the router's side is trusted, as for snooping."; }
  }, {
    id: "rack", text: "The closet cabinet is locked, and its key taken away",
    causes: cabinetCauses,
    ok: function (sim) { return "The cabinet's door is shut and locked, and its key is with " + sim.net.client.manager + "."; },
    rung1: function () { return "Look at the closet cabinet: its door, its lock, and where its key is."; },
    rung2: function () { return "A lock is only as good as its key. A key left in the lock opens the door for whoever walks into the closet."; }
  }, {
    id: "still", text: "Everything still works: staff online and printing, guests online, the cameras seen from outside",
    causes: hardStillCauses,
    ok: function () { return "Every staff PC is online and prints, guests are online, both cameras open from outside, and the access point's page opens from the manager's PC."; },
    rung1: function () { return "Ping out from each staff PC and the visitor's phone; print a test page; try each camera from the manager's phone; ipconfig on anything offline."; },
    rung2: function () { return "Snooping and ARP inspection only know the leases given out after they were turned on: a client still using an older lease is dropped until it asks again."; }
  }, L_SAVED_RT, {
    id: "swsaved", text: "The closet switch's setup survives a power cut",
    causes: swSavedCauses,
    ok: function () { return "What's running on the closet switch is saved."; },
    rung1: function () { return "On the closet switch: compare show running-config with show startup-config."; },
    rung2: function () { return "Each device keeps its own startup configuration: saving one saves nothing on the others."; }
  }, {
    id: "bswsaved", text: "The back switch's setup survives a power cut",
    causes: function (sim) { return savedCauses(sim, "bsw"); },
    ok: function () { return "What's running on the back switch is saved."; },
    rung1: function () { return "On the back switch: compare show running-config with show startup-config."; },
    rung2: function () { return "Each device keeps its own startup configuration: saving one saves nothing on the others."; }
  }],
  solve(v, sim) {
    const p = v.plan, S = staff(v), G = guest(v), P = parking(v), T = p.trunk, t = function (l) { return { t: "cmd", dev: "tech", line: l, cli: true }; };
    const runs = sim ? sim.net.extra.runs || 0 : 19;   /* runs are numbered in the order they're laid: SB-J1 to SB-J5 laid nineteen, the last the console to the router */
    const idle = "exec-timeout " + p.idle + " 0", both = S.id + "," + G.id;
    const sw = function (spare, secured, up, vlans) { return [t(""), t(p.swConsole), t("enable"), t(p.swSecret), t("configure terminal"), t("service password-encryption"),
      t("line console 0"), t(idle), t("line vty 0 15"), t(idle), t("exit"),
      t("interface range " + secured), t("switchport port-security"), t("switchport port-security mac-address sticky"), t("exit"),
      t("vlan " + P.id), t("name " + P.name), t("exit"),
      t("interface range " + spare), t("switchport mode access"), t("switchport access vlan " + P.id), t("shutdown"), t("exit"),
      t("ip dhcp snooping vlan " + vlans), t("ip dhcp snooping"), t("ip arp inspection vlan " + vlans),
      t("interface gi0/" + up), t("ip dhcp snooping trust"), t("ip arp inspection trust"), t("end"), t("copy running-config startup-config"), t("")]; };
    const closet = sw(spareRange(closetUsed(p)), "gi0/1 - 2", "24", both);
    closet.splice(closet.findIndex(function (a) { return a.line === "vlan " + P.id; }), 0, t("interface gi0/3"), t("switchport mode access"), t("exit"));   /* the printer's port, left to negotiate since the start */
    return [t(""), t(p.rtConsole), t("enable"), t(p.rtSecret), t("configure terminal"),
      t("ip domain-name " + p.domain), t("crypto key generate rsa modulus 2048"), t("username " + p.user + " secret " + p.userPw),
      t("ip access-list standard " + p.vtyAcl), t("permit " + S.net + " 0.0.0.255"), t("exit"),
      t("line vty 0 4"), t("login local"), t("transport input ssh"), t("access-class " + p.vtyAcl + " in"), t(idle), t("line console 0"), t(idle), t("exit"),
      t("service password-encryption"), t("interface " + p.wanPort), t("no lldp transmit"), t("end"), t("copy running-config startup-config"), t(""),
      { t: "pull", cable: "c-console-" + runs }, { t: "lay", a: E("tech", "USB-C"), b: E("msw", "CONSOLE") }]
      .concat(closet,
        [{ t: "pull", cable: "c-console-" + (runs + 1) }, { t: "place", dev: "tech", room: "back" }, { t: "lay", a: E("tech", "USB-C"), b: E("bsw", "CONSOLE") }],
        sw(spareRange(backUsed(p)), "gi0/" + p.backPort, T.back, String(S.id)),
        PCS.map(function (id) { return { t: "cmd", dev: id, line: "ipconfig /renew" }; }),
        [{ t: "radio", dev: "guest", on: false }, { t: "radio", dev: "guest", on: true }, { t: "cabinet", values: { open: false } }, { t: "cabinet", values: { locked: true } }, { t: "cabinet", values: { key: false } }]);
  },
  answer(v, sim) {
    const p = v.plan, S = staff(v), G = guest(v), P = parking(v), T = p.trunk, idle = "exec-timeout " + p.idle + " 0", both = S.id + "," + G.id;
    return ["On the router (console): ip domain-name " + p.domain + "; crypto key generate rsa modulus 2048; username " + p.user + " secret (the records'); ip access-list standard " + p.vtyAcl + ": permit " + S.net + " 0.0.0.255.",
      "line vty 0 4: login local, transport input ssh, access-class " + p.vtyAcl + " in, " + idle + ". line console 0: " + idle + ". service password-encryption. interface " + p.wanPort + ": no lldp transmit. Save.",
      "Console to the closet switch: service password-encryption; " + idle + " on line console 0 and line vty 0 15; interface range gi0/1 - 2: switchport port-security, switchport port-security mac-address sticky; interface gi0/3: switchport mode access.",
      "vlan " + P.id + ", name " + P.name + "; interface range " + spareRange(closetUsed(p)) + ": switchport mode access, switchport access vlan " + P.id + ", shutdown. ip dhcp snooping vlan " + both + "; ip dhcp snooping; ip arp inspection vlan " + both + "; interface gi0/24: ip dhcp snooping trust, ip arp inspection trust. Save.",
      "Your laptop to the back room, console to the back switch: the same passwords and timeouts; gi0/" + p.backPort + ": port security, sticky; vlan " + P.id + " " + P.name + "; interface range " + spareRange(backUsed(p)) + ": access, VLAN " + P.id + ", shutdown; snooping and inspection on VLAN " + S.id + ", trusting gi0/" + T.back + ". Save.",
      "ipconfig /renew on each staff PC; turn the visitor's phone's Wi-Fi off and on. Shut the cabinet's door, lock it, and take the key out for " + (sim ? sim.net.client.manager : "the manager") + "."];
  },
  summary(v, sim) {
    const p = v.plan;
    return ["The router is managed by SSH only, as " + p.user + ", and only the staff VLAN reaches its remote lines; no password reads in any configuration, and idle sessions log out after " + p.idle + " minutes.",
      "Each staff PC's port takes that PC alone; spare ports are shut and parked in VLAN " + parking(v).id + "; no device's port can become a trunk; the router says nothing to the provider.",
      "DHCP snooping and ARP inspection guard the staff and guest VLANs; the cabinet is locked and its key is with " + sim.net.client.manager + ". Everything still works, and all three devices are saved."];
  }
};

/* ---------------------------------------------------------------- SB-J7: the provider's fixed address */
/* the owner's answers (1 November 2026): switch-over day, the old changing address still working until the router moves ("Still
   online"); the provider's letter gives the block in CIDR only, so the mask is worked out by hand ("CIDR only, e.g. /29").
   Built in size order (the owner: "Keep building everything in order of increasing in size"), so numbered as it goes live */
const fixedOf = function (v) { return v.plan.fixed; };
const defaultsOf = function (R) { return R.routes.filter(function (s) { return s.net === "0.0.0.0" && s.mask === "0.0.0.0"; }); };
const inBlock = function (F, ip) { return !!ip && netOf(ip, F.mask) === F.net; };
function fixedWanCauses(sim, v) {
  const R = view(sim), p = v.plan, F = fixedOf(v), f = R.ifs[p.wanPort], hand = !f.dhcp && !!f.ip;
  return [C("shut", f.shutdown, "The provider's port is shut down", "The provider's port is up.", "show ip interface brief on the router: " + p.wanPort + " administratively down."),
    C("dhcp", f.dhcp, "It still takes its address from the provider's DHCP: an address that can change", "Its address is set by hand.", "show ip interface brief on the router: " + p.wanPort + " " + sim.net.isp.wanIp + ", method DHCP."),
    C("none", !f.dhcp && !f.ip, "It has no address at all", "It has an address.", "show ip interface brief on the router: " + p.wanPort + " unassigned."),
    C("gwaddr", hand && f.ip === F.gw, "Its address is the one the letter gives the provider's gateway, not the business's own", "It isn't the provider's gateway's address.", "show ip interface brief on the router: " + p.wanPort + " " + f.ip + "."),
    C("edge", hand && (f.ip === F.net || f.ip === F.bcast), "Its address is the block's network or broadcast address, which no device can have", "It's a usable address.", "show ip interface brief on the router: " + p.wanPort + " " + f.ip + "."),
    C("ip", hand && f.ip !== F.ip, "Its address isn't the one in the provider's letter", "Its address is the letter's.", "show ip interface brief on the router: " + p.wanPort + " " + f.ip + "."),
    C("mask", hand && f.mask !== F.mask, "Its mask doesn't match the size of the block in the letter", "Its mask fits the block.", "show running-config on the router: ip address " + f.ip + " " + f.mask + " on " + p.wanPort + ".")];
}
function fixedRouteCauses(sim, v) {
  const R = view(sim), L = live(sim), p = v.plan, F = fixedOf(v), d = defaultsOf(R), isp = sim.net.isp;
  const mine = d.find(function (s) { return s.nh === F.gw; }), table = routes(R, L).some(function (t) { return t.code === "S*" && !t.dhcp && t.nh === F.gw; });
  const old = d.find(function (s) { return s.nh === isp.gw; }), iface = d.find(function (s) { return !s.nh && s.iface; });
  const hop = d.find(function (s) { return s.nh && s.nh !== F.gw && inBlock(F, s.nh); }), gone = d.find(function (s) { return s.nh && s.nh !== F.gw && s.nh !== isp.gw && !inBlock(F, s.nh); });
  const rr = table ? sim.route("rtr", "8.8.8.8") : null;
  return [C("none", !d.length, "There's no default route set by hand: an address from DHCP brings one with it, an address set by hand doesn't", "A default route is set.", "show ip route on the router: " + (R.ifs[p.wanPort].dhcp ? "the only default route is the one DHCP brought (S* via " + isp.gw + ")" : "Gateway of last resort is not set") + "."),
    C("old", !mine && !!old, "The default route points at the old gateway: it isn't on the new block, so the route never goes into the table", "It doesn't point at the old gateway.", "show running-config on the router: ip route 0.0.0.0 0.0.0.0 " + isp.gw + "; show ip route: no S* from it."),
    C("gone", !mine && !old && !!gone, "The default route points at an address the router has no network for, so it never goes into the table", "Its next hop is on the block.", "show running-config on the router: ip route 0.0.0.0 0.0.0.0 " + (gone ? gone.nh : "") + "."),
    C("iface", !mine && !!iface, "The default route names the port, not the provider's gateway: the router would ask by ARP for every address on the internet, and the provider doesn't answer for them", "It names the gateway.", "show running-config on the router: ip route 0.0.0.0 0.0.0.0 " + (iface ? iface.iface : "") + "; ping 8.8.8.8 from the router: no replies."),
    C("hop", !mine && !!hop, "The default route points at an address in the block that isn't the provider's gateway", "It points at the provider's gateway.", "show running-config on the router: ip route 0.0.0.0 0.0.0.0 " + (hop ? hop.nh : "") + "; ping 8.8.8.8 from the router: no replies."),
    C("pending", !!mine && !table, "The default route is set, but it isn't in the routing table: its gateway isn't on any network the router has yet", "It's in the routing table.", "show ip route on the router: no S* via " + F.gw + "."),
    C("reach", !!mine && table && !(rr && rr.internet), "The default route is in the table, but the router still can't reach the internet", "The router reaches the internet.", "ping 8.8.8.8 from the router: no replies.")];
}
/* the manager's phone on mobile data: each camera's page at the fixed address, on its port from the records */
function fixedRemoteCauses(sim, v) {
  const F = fixedOf(v), rows = v.plan.cams.map(function (c) { return { c: c, r: sim.fromInternet(F.ip, c.ext, "tcp") }; });
  const r = rows.find(function (x) { return !x.r.ok || x.r.who !== x.c.id || +x.r.lport !== 443; }) || rows[0], y = r.r.why, bad = !r.r.ok || r.r.who !== r.c.id;
  const tried = "On the manager's phone, on mobile data, https://" + F.ip + ":" + r.c.ext;
  return [C("notyet", y === "notyet", "The fixed address doesn't reach the router yet: the router isn't using it", "The fixed address reaches the router.", tried + " times out."),
    C("wan", y === "wan" || y === "provider", "The router's provider side is down", "The provider's side is up.", tried + " times out; show ip interface brief on the router: " + v.plan.wanPort + " down."),
    C("back", y === "back", "The cameras' answers have no way back out: the router has no route to the internet that goes to the provider's gateway", "Answers find their way out.", tried + " times out; show ip route on the router: no default route via the provider's gateway."),
    C("forward", y === "no-forward" || y === "outside", "The router doesn't send it on to the camera any more", "The forwards still send it on.", tried + " is refused; show ip nat translations on the router."),
    C("other", bad, "A camera's page doesn't open from outside at the fixed address", "Both cameras' pages open from outside.", tried + ": " + (y || "the wrong page") + ".")];
}
function fixedStillCauses(sim) {
  const down = PCS.find(function (id) { return !online(sim, id); }), noPrint = ["pc", "bpc"].find(function (id) { return !printOk(sim, id); }), K = sim.d.cab, ip = apAddr(sim), r = ip ? sim.route("mgr", ip) : null;
  return [C("net", !!down, "The " + (down ? name(sim, down) : "") + " is offline", "Every staff PC is online.", "ping from the " + (down ? name(sim, down) : "") + ": no replies from the internet."),
    C("print", !!noPrint, "The " + (noPrint ? name(sim, noPrint) : "") + " can't print", "Staff print.", "Test pages from the " + (noPrint ? name(sim, noPrint) : "") + " don't print."),
    C("guest", !online(sim, "guest"), "The visitor's phone is offline", "Guests are online.", "The visitor's phone: no internet."),
    C("ap", !!r && !((r.local || r.routed) && !r.fail), "The manager's PC can't reach the access point's page", "The access point's page opens from the manager's PC.", "From the manager's PC the access point's address doesn't answer."),
    C("rack", !!K && (!K.locked || K.key), "The closet cabinet was left " + (K && K.locked ? "with its key in the lock" : "unlocked"), "The cabinet is locked again, its key taken away.", "The closet cabinet: " + (K && K.open ? "its door standing open" : K && !K.locked ? "shut, not locked" : "locked, its key in the lock") + ".")];
}
const SB7 = {
  id: "SB-J7", level: "business", title: "The provider's fixed address: set by hand, with a way out of its own",
  already: ["still", "saved"],
  start(seed) {
    const b = SB6.start(seed), sim = b.sim;
    for (const a of SB6.solve(b.v, sim)) { if (a.t === "cmd") exec(sim, a.dev, a.line); else sim.apply(a); }
    addFixedLine(sim); sim.cli = {};   /* the provider's letter has come: the fixed block, the old address still working until the router moves */
    return { sim: sim, v: b.v };
  },
  brief(v, sim) { return { quote: "Twice this month I couldn't see the cameras from home, and the provider says it's because our address changed. We pay for a fixed one now, and their letter came this morning. It's in our records. Can you move us over today, without anything being down for long?", from: sim.net.client.manager + ", " + sim.net.client.name }; },
  mason: "An address set by hand comes with nothing: the mask is worked out from the size of the block, and the way out is a route you add yourself, to the provider's gateway on that block. Then test it from outside, as the manager will.",
  limits: function (v, sim) {
    const p = v.plan, F = fixedOf(v), isp = sim.net.isp;
    return ["The provider's letter, in the records: from today the line has the fixed address " + F.ip + "/" + F.len + ". The provider's gateway for it is " + F.gw + ".",
      "Until the router moves over, the old address (" + isp.wanIp + ") keeps working; once it has, the old one stops. The provider's DNS servers stay " + isp.dns.join(" and ") + ".",
      "The manager reaches the cameras from outside at the fixed address, on the same ports as before (" + p.cams.map(function (c) { return c.ext; }).join(" and ") + "). Test it as they will: on their phone, Wi-Fi off.",
      "The router is managed by SSH from a staff PC as " + p.user + " (password " + p.userPw + "), or at its console in the closet cabinet, whose key is with " + sim.net.client.manager + ". A cabinet opened is locked again, its key taken away.",
      "The records are as before: router " + p.rtHost + " (secret " + p.rtSecret + ", console " + p.rtConsole + "); switches " + p.swHost + " and " + p.bswHost + " (secret " + p.swSecret + ", console " + p.swConsole + ")."];
  },
  reqs: [{
    id: "wan", text: "The router's provider port has the fixed address from the provider's letter",
    causes: fixedWanCauses,
    ok: function (sim, v) { return v.plan.wanPort + " has " + fixedOf(v).ip + ", set by hand, with the block's mask."; },
    rung1: function () { return "On the router: show ip interface brief, and the provider's port in show running-config. Then the provider's letter in the records."; },
    rung2: function () { return "A block written with a slash says how many bits are the network; the rest are the hosts. A block of a few addresses keeps its first for the network and its last for broadcast, and the provider's gateway takes one of the rest."; }
  }, {
    id: "route", text: "The router's way out is a default route to the provider's gateway",
    causes: fixedRouteCauses,
    ok: function () { return "A default route to the provider's gateway is in the routing table, and the router reaches the internet."; },
    rung1: function () { return "On the router: show ip route (is there a gateway of last resort, and where from?), then ping out from the router itself."; },
    rung2: function () { return "DHCP hands out a gateway with the address, and the router makes a default route from it. Set the address by hand and that route goes with the lease. A static route only goes into the table if its next hop is on a network the router is on."; }
  }, {
    id: "remote", text: "From the manager's phone on mobile data, both cameras open at the fixed address",
    causes: fixedRemoteCauses,
    ok: function (sim, v) { return "From outside, the fixed address opens each camera's page on its port."; },
    rung1: function () { return "Try it as the manager will: their phone, Wi-Fi off, the fixed address and each camera's port. Then show ip route and show ip nat translations on the router."; },
    rung2: function () { return "A forward that names the router's port follows whatever address that port has. The camera's answer goes back out by the router's own routes, so it needs the way out too."; }
  }, {
    id: "still", text: "Everything still works: staff online and printing, guests online, the cabinet locked",
    causes: fixedStillCauses,
    ok: function () { return "Every staff PC is online and prints, guests are online, the access point's page opens, and the cabinet is locked with its key away."; },
    rung1: function () { return "Ping out from each staff PC and the visitor's phone; print a test page; look at the closet cabinet."; },
    rung2: function () { return "Between the address changing and the new way out going in, nobody gets out: the order of the two lines decides how long that is."; }
  }, L_SAVED_RT],
  solve(v) {
    const p = v.plan, F = fixedOf(v), m = function (l) { return { t: "cmd", dev: "mgr", line: l }; };
    /* from the manager's PC, over SSH (SB-J6 let the staff VLAN in): the address and the way out, saved */
    return [m("ssh " + p.user + "@" + staff(v).gw), m(p.userPw), m("enable"), m(p.rtSecret), m("configure terminal"),
      m("interface " + p.wanPort), m("ip address " + F.ip + " " + F.mask), m("exit"), m("ip route 0.0.0.0 0.0.0.0 " + F.gw), m("end"),
      m("copy running-config startup-config"), m(""), m("exit")];
  },
  answer(v, sim) {
    const p = v.plan, F = fixedOf(v);
    return ["From the manager's PC: ssh " + p.user + "@" + staff(v).gw + " (the records' password), enable, configure terminal. (Or the console, in the closet cabinet: unlock it, then lock it again after.)",
      "interface " + p.wanPort + ": ip address " + F.ip + " " + F.mask + " (/" + F.len + "). Then ip route 0.0.0.0 0.0.0.0 " + F.gw + ".",
      "end, copy running-config startup-config. Then the manager's phone, Wi-Fi off: https://" + F.ip + ":" + p.cams[0].ext + " and :" + p.cams[1].ext + "."];
  },
  summary(v, sim) {
    const p = v.plan, F = fixedOf(v);
    return ["The router's provider port has the business's fixed address, " + F.ip + "/" + F.len + ", and a default route to the provider's gateway, " + F.gw + ".",
      "Everyone gets out on the fixed address, and the manager opens both cameras from outside at it.", "The router is saved."];
  }
};

/* ---------------------------------------------------------------- SB-J8: the printers' VLAN */
/* the printer off the old network the switches and the access point are managed on, onto a VLAN of its own: the closet switch's
   VLAN and port, the router's subinterface, the printer's own control panel, every PC that names its old address, and the guests'
   list, which kept guests off the old network and knows nothing of the new one */
const prn = function (v) { return VL(v, "printers"); };
const printsAt = function (sim, from, ip) { const r = sim.route(from, ip); return !!((r.local || r.routed) && !r.fail && r.owner && r.owner.indexOf("printer") >= 0); };
function prVlanCauses(sim, v) {
  const P = prn(v), vl = SW(sim).vlans[P.id];
  return [C("none", !vl, "The closet switch has no printers' VLAN", "The printers' VLAN exists.", "show vlan brief on the closet switch: no VLAN " + P.id + "."),
    C("name", !!vl && vl.name !== P.name, "The printers' VLAN isn't named as the records say", "It's named as the records say.", "show vlan brief on the closet switch: VLAN " + P.id + " is " + (vl ? vl.name : "") + ".")];
}
function prPortCauses(sim, v) {
  const P = prn(v), sw = SW(sim), m = between(sim, "printer", "msw"), n = m ? port(m.far) : null, sp = n && sw.ports[n], c = n ? carries(sw, n, null) : null;
  return [C("cable", !m, "The printer isn't on the closet switch", "The printer is on the closet switch.", "The printer's cable doesn't reach the closet switch."),
    C("shut", !!sp && sp.shutdown, "The printer's port is shut down", "Its port is open.", "show interfaces status on the closet switch: " + gi(n) + " disabled."),
    C("mode", !!sp && sp.mode !== "access", sp && sp.mode === "trunk" ? "The printer's port is set as a trunk" : "The printer's port is left to negotiate", "It's set as an access port.", "show interfaces " + gi(n) + " switchport on the closet switch: administrative mode " + (sp ? sp.mode : "") + "."),
    C("vlan", !!c && c.untagged !== P.id, c && c.untagged === 1 ? "The printer's port is still in the old network's VLAN" : "The printer's port is in a VLAN that isn't the printers'", "Its port is in the printers' VLAN.", "show vlan brief on the closet switch: " + gi(n) + " is in VLAN " + (c ? c.untagged : "") + "."),
    C("desc", !!sp && String(sp.desc || "").toUpperCase() !== v.plan.desc["3"], "The printer's port isn't described as the records say", "Its port is described as the records say.", "show interfaces status on the closet switch: " + gi(n) + "'s name is " + (sp && sp.desc ? sp.desc : "blank") + ".")];
}
function prSubCauses(sim, v) {
  const R = view(sim), P = prn(v), q = vlanSub(R, v, "printers"), n = q || subName(v, "printers"), f = q ? R.subs[q] : null, any = Object.keys(R.subs).find(function (z) { return R.subs[z].vlan === P.id; });
  const sw = SW(sim), up = between(sim, "rtr", "msw"), uc = up ? carries(sw, port(up.far), null) : null;
  return [C("none", !f && !any, "The router has no subinterface for the printers' VLAN", "There's a subinterface for the printers' VLAN.", "show ip interface brief on the router: no " + n + "."),
    C("other", !f && !!any, "The printers' VLAN's subinterface is on a port the switch isn't cabled to", "It's on the inside port.", "show ip interface brief on the router: the printers' VLAN is on " + any + "."),
    C("tag", !!f && f.vlan !== P.id, "The subinterface doesn't tag the printers' VLAN", "It tags the printers' VLAN.", "show running-config on the router: " + n + (f && f.vlan ? " has encapsulation dot1Q " + f.vlan : " has no encapsulation line") + "."),
    C("addr", !!f && f.vlan === P.id && (f.ip !== P.gw || f.mask !== v.plan.vmask), "Its address isn't the printers' gateway from the records", "Its address is the printers' gateway.", "show ip interface brief on the router: " + n + " is " + (f && f.ip ? f.ip : "unassigned") + "."),
    C("shut", !!f && rtStatus(R, n)[1] !== "up", "The subinterface is down", "It's up.", "show ip interface brief on the router: " + n + " is down."),
    C("uplink", !!sw.vlans[P.id] && !!uc && uc.mode === "trunk" && uc.tagged.indexOf(P.id) < 0 && uc.untagged !== P.id, "The trunk to the router doesn't carry the printers' VLAN", "The trunk to the router carries it.", "show interfaces trunk on the closet switch: VLAN " + P.id + " isn't allowed and active on Gi0/" + (up ? up.far : "") + ".")];
}
function prFixedCauses(sim, v) {
  const P = prn(v), f = sim.d.printer.ifaces[0].cfg, fix = f.mode === "static", lan = v.plan.lan;
  return [C("dhcp", !fix, "The printer asks for its address by DHCP: the records give it a fixed one", "It has a fixed address.", "The printer's control panel: TCP/IP set to DHCP."),
    C("old", fix && inNet(f.ip, lan), "The printer still has its old address, on the old network", "Its address is on the printers' network.", "The printer's control panel: " + f.ip + "."),
    C("ip", fix && !inNet(f.ip, lan) && f.ip !== v.plan.printerIp, "Its address isn't the one in the records", "Its address is the records'.", "The printer's control panel: " + f.ip + "."),
    C("mask", fix && f.mask !== v.plan.vmask, "Its subnet mask isn't the printers' network's", "Its mask is the printers' network's.", "The printer's control panel: subnet mask " + f.mask + "."),
    C("gw", fix && f.gw !== P.gw, !f.gw ? "It has no gateway: it answers only its own network, and staff print from other networks" : inNet(f.gw, lan) ? "Its gateway is still the old network's" : "Its gateway isn't the printers' network's", "Its gateway is the printers' gateway.", "The printer's control panel: gateway " + (f.gw || "blank") + ".")];
}
/* staff print to it at its new address: the front PC's printer port (the reception, till or counter PC), the back's and the manager's PCs reaching it */
function prPrintCauses(sim, v) {
  const want = v.plan.printerIp, at = printerIp(sim) === want, r = sim.route("pc", want), reach = at && printsAt(sim, "pc", want), dai = at && !reach && !!r.dai, port = sim.d.pc.printer.port;
  return [C("moved", !at, "The printer isn't at its new address yet", "The printer has its new address.", "The printer's control panel: " + printerIp(sim) + "."),
    C("dai", dai, "ARP inspection on the printers' VLAN drops the printer: it has a fixed address, so snooping has no lease to check it against", "Nothing drops the printer's ARP.", "show ip arp inspection on the closet switch: VLAN " + prn(v).id + " is inspected; its drops count up."),
    C("reach", at && !reach && !dai, "The " + name(sim, "pc") + " can't reach the printer at its new address", "It reaches the printer.", "ping " + want + " from the " + name(sim, "pc") + ": no replies."),
    C("port", reach && port !== want, "The " + name(sim, "pc") + "'s printer port still names " + (inNet(port, v.plan.lan) ? "the printer's old address" : "an address the printer doesn't have"), "It prints to the printer's address.", "The " + name(sim, "pc") + "'s Printers tab: its port is " + port + "; test pages don't print."),
    C("back", reach && !printsAt(sim, "bpc", want), "The " + name(sim, "bpc") + " can't reach the printer", "The " + name(sim, "bpc") + " reaches it.", "ping " + want + " from the " + name(sim, "bpc") + ": no replies."),
    C("mgr", reach && !printsAt(sim, "mgr", want), "The manager's PC can't reach the printer", "The manager's PC reaches it.", "ping " + want + " from the manager's PC: no replies.")];
}
/* guests kept off the printers: judged on the list in on the guests' subinterface, for the ways a phone reaches a printer (raw
   printing, IPP, its web page, a ping), to the printer and to the printers' network beyond it */
const PRINT_WAYS = [["tcp", 9100, "printing (9100)"], ["tcp", 631, "IPP (631)"], ["tcp", 443, "its web page (443)"], ["tcp", 80, "its web page (80)"], ["icmp", null, "ping"]];
function prGuestCauses(sim, v) {
  const R = RT(sim), G = guest(v), P = prn(v), q = vlanSub(view(sim), v, "guest"), f = q ? R.subs[q] : null, a = f && f.aclIn, L = a ? R.acls[a] : null;
  const src = G.net.replace(/\.0$/, ".50"), pr = v.plan.printerIp, next = P.net.replace(/\.0$/, ".200");
  const pk = function (dst, w) { return { proto: w[0], src: src, dst: dst, sport: 50000, port: w[1] }; };
  const open = L ? PRINT_WAYS.filter(function (w) { return aclVerdict(R, a, pk(pr, w)).permit; }) : [], all = !!L && open.length === PRINT_WAYS.length;
  const late = all && L.lines.some(function (e) { return !e.remark && e.action === "deny" && aceMatch(e, pk(pr, PRINT_WAYS[0])); });
  const host = !!L && !open.length && PRINT_WAYS.some(function (w) { return aclVerdict(R, a, pk(next, w)).permit; });
  return [C("applied", !!f && !a, "The guests' subinterface has no list in on it any more", "The guests' list is applied in.", "show ip interface " + q + " on the router: Inbound access list is not set."),
    C("missing", !!a && !L, "The list on the guests' subinterface doesn't exist: a missing list lets everything through", "The list exists.", "show access-lists on the router: no list " + a + "."),
    C("late", late, "A line in the guests' list stops them reaching the printers, but a line above it has already let them through: the first line that matches decides", "Nothing above it lets them through.", "show access-lists " + a + " on the router: the printers' line counts no matches."),
    C("open", all && !late, "Nothing in the guests' list stops them reaching the printers' network", "The guests' list keeps them off it.", "show access-lists " + a + " on the router: no line for " + P.net + "."),
    C("some", !!L && open.length > 0 && !all, "The guests' list stops some of their traffic to the printer, not all of it", "It stops all of it.", "From the guest network the printer still answers to " + open.map(function (w) { return w[2]; }).join(", ") + "."),
    C("host", host, "The guests' list keeps them off this printer, not the printers' network: the next printer on it would be open to them", "It keeps them off the whole network.", "show access-lists " + a + " on the router: the line names the printer's address, not its network.")];
}
function prStillCauses(sim, v) {
  const F = fixedOf(v), cam = v.plan.cams.find(function (c) { const r = sim.fromInternet(F.ip, c.ext, "tcp"); return !(r.ok && r.who === c.id); });
  const S = fixedStillCauses(sim).filter(function (c) { return c.id !== "print"; });
  return S.slice(0, -1).concat([C("cams", !!cam, "A camera can't be seen from outside any more", "Both cameras open from outside.", "On the manager's phone, on mobile data: " + (cam ? cam.tag : "a camera") + "'s page doesn't open at " + F.ip + ".")], S.slice(-1));
}
const SB8 = {
  id: "SB-J8", level: "business", title: "The printers' VLAN: the printer moved off the old network, onto a network of its own",
  already: ["still", "saved", "swsaved"],
  start(seed) {
    const b = SB7.start(seed), sim = b.sim;
    for (const a of SB7.solve(b.v, sim)) { if (a.t === "cmd") exec(sim, a.dev, a.line); else sim.apply(a); }
    addPrinterVlan(sim); sim.cli = {};   /* the records' printers' VLAN, and the printer's address on it */
    return { sim: sim, v: b.v };
  },
  brief(v, sim) { return { quote: "The card company's follow-up letter asks why our printer is still on the same network as the switches and the wireless access point. Our records have always said printers get a network of their own, so can you move it today? The " + name(sim, "pc") + " prints all day, and the " + name(sim, "bpc") + " prints labels, so it has to keep working.", from: sim.net.client.manager + ", " + sim.net.client.name }; },
  mason: "Moving a device to a network of its own takes three changes that have to agree: its switch port, its gateway on the router, and its own settings. Then everything that pointed at its old address. Last of all, ask who can reach it now that couldn't before.",
  limits: function (v, sim) {
    const p = v.plan, P = prn(v), G = guest(v);
    return ["The records: printers get a VLAN of their own, VLAN " + P.id + ", named " + P.name + ", on " + P.net + "/24, its gateway " + P.gw + " on the router's inside port. Nothing on it is handed out by DHCP, and nothing there needs the internet.",
      "The printer stays on the closet switch's port 3, described " + p.desc["3"] + ". Its fixed address on the printers' network is " + p.printerIp + " (mask " + p.vmask + "), set on its own control panel.",
      "The " + name(sim, "pc") + " prints to the printer by its address; the " + name(sim, "bpc") + " and the manager's PC reach it too.",
      "Guests (VLAN " + G.id + ") reach none of the business's own networks, the printers' included: their list is " + p.guestAcl + ".",
      "The router and the closet switch are managed by SSH from a staff PC as " + p.user + " (password " + p.userPw + "): the router at " + staff(v).gw + ", the closet switch at " + p.swIp + ". Or at their consoles, in the closet cabinet, whose key is with " + sim.net.client.manager + ". A cabinet opened is locked again, its key taken away.",
      "The records are as before: router " + p.rtHost + " (secret " + p.rtSecret + ", console " + p.rtConsole + "); switches " + p.swHost + " and " + p.bswHost + " (secret " + p.swSecret + ", console " + p.swConsole + ")."];
  },
  reqs: [{
    id: "pvlan", text: "The printers' VLAN is on the closet switch, named as the records say",
    causes: prVlanCauses,
    ok: function (sim, v) { return "VLAN " + prn(v).id + " is on the closet switch, named " + prn(v).name + "."; },
    rung1: function () { return "On the closet switch: show vlan brief."; },
    rung2: function () { return "A VLAN is on a switch once it's made there. A VLAN made by putting a port in it is named after its number, not as anyone's records say."; }
  }, {
    id: "pport", text: "The printer's port is in the printers' VLAN",
    causes: prPortCauses,
    ok: function () { return "The printer's port is an access port in the printers' VLAN, open, described as the records say."; },
    rung1: function () { return "On the closet switch: show interfaces status, then show vlan brief: find the printer's port, and the VLAN it's in."; },
    rung2: function () { return "An access port carries one VLAN, untagged: the device on it never sees the number, only the network its own address is on."; }
  }, {
    id: "psub", text: "The router is the printers' gateway, on a subinterface of its own",
    causes: prSubCauses,
    ok: function () { return "The router has a subinterface tagging the printers' VLAN, with the printers' gateway address, up, and the trunk to it carries the VLAN."; },
    rung1: function () { return "On the router: show ip interface brief. On the closet switch: show interfaces trunk."; },
    rung2: function () { return "Each VLAN the router serves needs a subinterface that tags it, its address the gateway that VLAN's devices use. The trunk between the switch and the router has to carry the VLAN too."; }
  }, {
    id: "pfixed", text: "The printer has its fixed address on the printers' network, set on its control panel",
    causes: prFixedCauses,
    ok: function (sim, v) { return "The printer's control panel: " + v.plan.printerIp + ", the printers' mask and gateway."; },
    rung1: function () { return "The printer's control panel: its TCP/IP settings. Then the records."; },
    rung2: function () { return "A device's address, mask and gateway all belong to the network its port is in. An address from the old network on a port in the new VLAN reaches nothing, and without a gateway a device answers nothing beyond its own network."; }
  }, {
    id: "pprint", text: "Staff print to the printer at its new address",
    causes: prPrintCauses,
    ok: function (sim) { return "The " + name(sim, "pc") + " prints to the printer's new address, and the " + name(sim, "bpc") + " and the manager's PC reach it."; },
    rung1: function (v, sim) { return "From each staff PC, ping the printer's new address; on the " + name(sim, "pc") + ", the Printers tab: where it sends its pages. On the closet switch: show ip arp inspection."; },
    rung2: function () { return "A PC prints to an address, not to a printer: when the printer's address changes, every PC that names the old one has to be told. ARP inspection checks each device against a lease it saw handed out, and a device with a fixed address never had one."; }
  }, {
    id: "pguest", text: "Guests can't reach the printers",
    causes: prGuestCauses,
    ok: function () { return "The guests' list stops every way a guest could reach the printers' network."; },
    rung1: function () { return "On the router: show access-lists, and show ip interface for the guests' subinterface."; },
    rung2: function () { return "A list is read from the top, and the first line that matches decides. A line typed into a list goes in at the end, unless it's given a sequence number that puts it ahead of the line it has to beat."; }
  }, {
    id: "still", text: "Everything still works: staff and guests online, the cameras seen from outside, the cabinet locked",
    causes: prStillCauses,
    ok: function () { return "Every staff PC is online, guests are online, the access point's page opens, both cameras open from outside, and the cabinet is locked with its key away."; },
    rung1: function () { return "Ping out from each staff PC and the visitor's phone; try each camera from the manager's phone; look at the closet cabinet."; },
    rung2: function () { return "Every guest's packet is read against the guests' list the moment a line goes in: a line that matches more than it should stops guests getting out."; }
  }, L_SAVED_RT, {
    id: "swsaved", text: "The closet switch's setup survives a power cut",
    causes: swSavedCauses,
    ok: function () { return "What's running on the closet switch is saved."; },
    rung1: function () { return "On the closet switch: compare show running-config with show startup-config."; },
    rung2: function () { return "Each device keeps its own startup configuration: saving one saves nothing on the others."; }
  }],
  solve(v) {
    const p = v.plan, P = prn(v), G = guest(v), w = "0.0.0.255", m = function (l) { return { t: "cmd", dev: "mgr", line: l }; };
    /* from the manager's PC, over SSH: the closet switch, then the router; then the printer's own panel and the front PC */
    return [m("ssh " + p.user + "@" + p.swIp), m(p.userPw), m("enable"), m(p.swSecret), m("configure terminal"),
      m("vlan " + P.id), m("name " + P.name), m("exit"), m("interface gi0/3"), m("switchport access vlan " + P.id), m("end"),
      m("copy running-config startup-config"), m(""), m("exit"),
      m("ssh " + p.user + "@" + staff(v).gw), m(p.userPw), m("enable"), m(p.rtSecret), m("configure terminal"),
      m("interface " + subName(v, "printers")), m("encapsulation dot1Q " + P.id), m("ip address " + P.gw + " " + p.vmask), m("exit"),
      m("ip access-list extended " + p.guestAcl), m("35 deny ip " + G.net + " " + w + " " + P.net + " " + w), m("end"),
      m("copy running-config startup-config"), m(""), m("exit"),
      { t: "client", dev: "printer", values: { mode: "static", ip: p.printerIp, mask: p.vmask, gw: P.gw } }, { t: "pcprinter", ip: p.printerIp }];
  },
  answer(v, sim) {
    const p = v.plan, P = prn(v), G = guest(v);
    return ["From the manager's PC: ssh " + p.user + "@" + p.swIp + " (the closet switch). vlan " + P.id + ", name " + P.name + "; interface gi0/3: switchport access vlan " + P.id + ". Save.",
      "ssh " + p.user + "@" + staff(v).gw + " (the router). interface " + subName(v, "printers") + ": encapsulation dot1Q " + P.id + ", ip address " + P.gw + " " + p.vmask + ".",
      "ip access-list extended " + p.guestAcl + ": 35 deny ip " + G.net + " 0.0.0.255 " + P.net + " 0.0.0.255 (show access-lists first: it goes in ahead of the line that lets guests out). Save.",
      "The printer's control panel: fixed, " + p.printerIp + ", " + p.vmask + ", gateway " + P.gw + ". The " + name(sim, "pc") + "'s Printers tab: its port to " + p.printerIp + ". Then a test page."];
  },
  summary(v, sim) {
    const p = v.plan, P = prn(v);
    return ["The printer is on VLAN " + P.id + " (" + P.name + "), at " + p.printerIp + ", off the network the switches and the access point are managed on; the router's " + subName(v, "printers") + " is its gateway.",
      "Staff print to it at its new address, and the guests' list keeps guests off the printers' network.", "The router and the closet switch are saved."];
  }
};

export const BUSINESS_JOBS = [SB1, SB2, SB3, SB4, SB5, SB6, SB7, SB8];
