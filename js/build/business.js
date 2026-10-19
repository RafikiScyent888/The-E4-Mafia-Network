/* Client jobs for build mode, the small business (level 3). The business as
   the technician finds it: one flat network on the provider's router, the
   closet switch set up as the small office's was, and the new business router
   (BR-4200) in its box. The work is done on the router's and the switch's own
   command lines, and every line of a work order is checked against the
   devices and the network as they really are. Each line is an ordered list of
   causes, as on the other levels, so Mason's third rung can strike the ones
   the network has ruled out and leave two. None of it ever says what to type. */
import { makeBusiness } from "../net/business.js";
import { Sim } from "../net/sim.js";
import { exec } from "../net/cmd.js";
import { unsaved, pwOk, carries } from "../net/swcli.js";
import { addrOf, rtStatus, poolFor, poolAddrs, aclVerdict, routes } from "../net/rtcli.js";
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
const staff = function (v) { return v.plan.vlans.staff; };
const subName = function (v) { return v.plan.lanPort + "." + staff(v).id; };
function vlanCauses(sim, v) {
  const sw = SW(sim), S = staff(v), vl = sw.vlans[S.id];
  return [C("none", !vl, "The closet switch has no staff VLAN", "The staff VLAN exists.", "show vlan brief: no VLAN " + S.id + "."),
    C("name", !!vl && vl.name !== S.name, "The staff VLAN isn't named as the records say", "It's named as the records say.", "show vlan brief: VLAN " + S.id + " is " + (vl ? vl.name : "") + ".")];
}
function trunkCauses(sim, v) {
  const sw = SW(sim), m = between(sim, "rtr", "msw"), port = m ? "GigabitEthernet0/" + m.far : null, p = port && sw.ports[port], c = port ? carries(sw, port, null) : null;
  return [C("cable", !m, "The router isn't cabled to the closet switch", "The router is cabled to the switch.", "No cable joins the router and the closet switch."),
    C("mode", !!c && c.mode !== "trunk", "The switch's port to the router isn't a trunk: a router never negotiates one, so it stays an access port", "The router's port is a trunk.", "show interfaces trunk on the switch: nothing for Gi0/" + (m ? m.far : "") + "."),
    C("allowed", !!c && c.mode === "trunk" && c.tagged.indexOf(staff(v).id) < 0 && c.untagged !== staff(v).id, "The trunk doesn't carry the staff VLAN", "The trunk carries the staff VLAN.", "show interfaces trunk: VLAN " + staff(v).id + " isn't allowed and active on Gi0/" + (m ? m.far : "") + "."),
    C("native", !!c && c.mode === "trunk" && c.untagged !== 1, "The trunk's native VLAN isn't the one the old network still runs on", "Untagged frames still reach the old network.", "show interfaces trunk: native VLAN " + (p ? p.native : "") + ".")];
}
/* the staff VLAN's subinterface: the records' name, or failing that any subinterface on the inside port tagging the staff VLAN (its number is only a name) */
const staffSub = function (R, v) {
  const n = subName(v); if (R.subs[n]) return n;
  return Object.keys(R.subs).find(function (k) { return k.split(".")[0] === v.plan.lanPort && R.subs[k].vlan === staff(v).id; }) || null;
};
function subCauses(sim, v) {
  const R = view(sim), S = staff(v), k = staffSub(R, v), n = k || subName(v), f = k ? R.subs[k] : null, any = Object.keys(R.subs).find(function (q) { return R.subs[q].vlan === S.id; });
  return [C("none", !f && !any, "The router has no subinterface for the staff VLAN", "There's a subinterface for the staff VLAN.", "show ip interface brief on the router: no " + n + "."),
    C("other", !f && !!any, "The staff VLAN's subinterface is on a port the switch isn't cabled to", "It's on the inside port.", "show ip interface brief: the staff VLAN is on " + any + "."),
    C("tag", !!f && f.vlan !== S.id, "The subinterface doesn't tag the staff VLAN", "It tags the staff VLAN.", "show running-config: " + n + (f && f.vlan ? " has encapsulation dot1Q " + f.vlan : " has no encapsulation line") + "."),
    C("addr", !!f && f.vlan === S.id && (f.ip !== S.gw || f.mask !== v.plan.vmask), "Its address isn't the staff network's gateway from the records", "Its address is the staff gateway.", "show ip interface brief: " + n + " is " + (f && f.ip ? f.ip : "unassigned") + "."),
    C("shut", !!f && rtStatus(R, n)[1] !== "up", "The subinterface is down", "It's up.", "show ip interface brief: " + n + " is down."),
    C("nat", !!f && f.nat !== "inside", "The subinterface isn't NAT's inside, so staff never get out", "It's NAT's inside.", "show running-config: no ip nat inside on " + n + "."),
    C("list", !!f && !RT(sim).nat.some(function (x) { return RT(sim).acls[x.list] && aclVerdict(RT(sim), x.list, { proto: "ip", src: S.net.replace(/\.0$/, ".50"), dst: "8.8.8.8" }).permit; }), "The NAT rule's access list doesn't take the staff network", "The staff network is translated too.", "show access-lists: the staff addresses match no permit in NAT's list.")];
}
function staffPoolCauses(sim, v) {
  const r = RT(sim), S = staff(v), k = Object.keys(r.pools).find(function (q) { return r.pools[q].network === S.net && r.pools[q].mask === v.plan.vmask; }), P = k ? r.pools[k] : null;
  const A = k ? poolAddrs(r, k) : [], gwOut = A.indexOf(S.gw) >= 0 || A.some(function (ip) { return ip2n(ip) <= ip2n(S.gw) + 9; });
  return [C("pool", !P, "The router has no pool for the staff network", "There's a pool for the staff network.", "show ip dhcp pool: nothing for " + S.net + "/24."),
    C("gw", !!P && P.router[0] !== S.gw, "The staff pool hands out the wrong gateway, or none", "It hands out the staff gateway.", "The staff pool's default-router is " + (P && P.router[0] || "not set") + "."),
    C("dns", !!P && !(P.dns.length && P.dns.every(function (d) { return v.plan.dns.indexOf(d) >= 0; })), "The staff pool hands out no DNS servers, or not the provider's", "It hands out the provider's DNS servers.", "The staff pool's dns-server is " + (P && P.dns.join(" ") || "not set") + "."),
    C("excl", !!P && gwOut, "The first ten staff addresses (the gateway's and the gear's) aren't kept back", "The first ten are excluded.", "show ip dhcp pool: the staff pool starts at its first address.")];
}
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
    causes: vlanCauses,
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
    causes: subCauses,
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

export const BUSINESS_JOBS = [SB1, SB2];
