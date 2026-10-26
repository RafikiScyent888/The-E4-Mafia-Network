/* Client jobs for build mode, the small business (level 3). The business as
   the technician finds it: one flat network on the provider's router, the
   closet switch set up as the small office's was, and the new business router
   (BR-4200) in its box. The work is done on the router's and the switch's own
   command lines, and every line of a work order is checked against the
   devices and the network as they really are. Each line is an ordered list of
   causes, as on the other levels, so Mason's third rung can strike the ones
   the network has ruled out and leave two. None of it ever says what to type. */
import { makeBusiness, addGuestKit, addBackSwitch, addCameraKit } from "../net/business.js";
import { Sim } from "../net/sim.js";
import { exec } from "../net/cmd.js";
import { browse } from "../net/pages.js";
import { unsaved, pwOk, carries } from "../net/swcli.js";
import { addrOf, rtStatus, poolFor, poolAddrs, aclVerdict, routes, netOf } from "../net/rtcli.js";
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
    ok: function () { return "The reception, manager's and back-of-house PCs reach the internet by name, and the printer prints."; },
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

export const BUSINESS_JOBS = [SB1, SB2, SB3, SB4, SB5];
