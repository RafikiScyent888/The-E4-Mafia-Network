/* Tier 3 tickets: the small business (level 3). Each one starts from the
   business as the work orders left it (SB-J1 to SB-J10: the business router
   with NAT and a pool per VLAN, the staff, guests', cameras' and printers'
   VLANs, the back of house on a trunk, the cameras' forwards, the hardening,
   the router rebuilt from its backup, the new department), on a day like any
   other: nobody logged in, your laptop on the back switch's console where
   SB-J10 left it. Then the fault is planted the way it really got there, by
   whoever caused it, typed in and saved. As on the office tickets: exhibits
   proves the fault shows; six options, one right and five near misses, each
   wrong one with its reason; the fix must be at the source and saved (a fix
   that lives only in the running configuration works today and Mason says
   so); the proof is something a student runs. The business's records are on
   every ticket card: what a technician is given to log in. */
import { BUSINESS_JOBS } from "../build/business.js";
import { online } from "../build/jobs.js";
import { exec } from "../net/cmd.js";
import * as SW from "../net/swcli.js";
import { rng, hash, ip2n } from "../net/util.js";

const J10 = BUSINESS_JOBS.find(function (d) { return d.id === "SB-J10"; });
/* the business as SB-J10 left it, on a day like any other: nobody logged in, the TFTP server closed, the moment frozen */
function settled(seed) {
  const b = J10.start(seed), sim = b.sim;
  for (const a of J10.solve(b.v, sim)) { if (a.t === "cmd") exec(sim, a.dev, a.line, a.win); else sim.apply(a); }
  freeze(sim);
  return { sim: sim, plan: b.v.plan };
}
function freeze(sim) { sim.cli = {}; sim.lastTrace = null; if (sim.d.tech.tftp) sim.d.tech.tftp.on = false; sim.net.extra.build = false; }   /* a ticket keeps its moment frozen */
/* lines typed on a switch by whoever caused the fault (privileged, no password asked) */
function onSwitch(sim, id, lines) {
  const S = SW.session(sim.d[id].sw, { via: "console" }); S.mode = "priv"; S.pending = null; S.fresh = false;
  lines.forEach(function (l) { SW.exec(S, l); });
}
const SAVE = ["copy running-config startup-config", ""];
const G1 = "GigabitEthernet0/1";
/* what a switch or the router printed, whichever terminal typed it (your laptop's console, or SSH from a staff PC) */
const devOut = function (f) { return (f.cmd === "serial" || f.cmd === "ssh" || f.cmd === "telnet") && typeof f.out === "string" ? f.out : ""; };
const cap = function (s) { return s.charAt(0).toUpperCase() + s.slice(1); };
/* a device's name mid-sentence: "the counter PC", "the manager's PC" */
const name = function (sim, id) { return String(sim.d[id].label).replace(/^[A-Z](?=[a-z])/, function (m) { return m.toLowerCase(); }); };
const inNet = function (ip, net, len) { if (!ip) return false; const m = len >= 32 ? 0xffffffff : (0xffffffff << (32 - len)) >>> 0; return ((ip2n(ip) & m) >>> 0) === ((ip2n(net) & m) >>> 0); };
const staffOf = function (v) { return v.plan.vlans.staff; };
const reachesPrinter = function (sim, id, ip) { const r = sim.route(id, ip); return !r.fail && (!!r.local || !!r.routed) && !!r.owner && r.owner.indexOf("printer") >= 0; };   /* on its own network, or across the router (the printers have their own VLAN since SB-J8) */

/* the business's records, as the business keeps them: what a technician is given to log in to its gear, and its VLAN plan */
export function businessRecords(v, sim) {
  const p = v.plan, V = p.vlans, S = V.staff, mgr = sim.net.client.manager, back = String(sim.net.roomNames.back).toLowerCase();
  /* the VLAN plan, a row each, so it reads down the card rather than across it */
  const vl = function (k, label) { const x = V[k]; return x ? [label, x.id + " · named " + x.name + " · " + x.net + "/" + (x.len || 24) + " · gateway " + x.gw] : null; };   /* its name too: a VLAN made again goes by the records' name */
  const plan = [vl("staff", "Staff VLAN"), vl("guest", "Guests' VLAN"), vl("cameras", "Cameras' VLAN"), vl("printers", "Printers' VLAN"), V.dept ? vl("dept", cap(V.dept.name.toLowerCase()) + " VLAN") : null,
    ["Native VLAN", V.native.id + " · named " + V.native.name + " · unused, on the trunks only"], ["Parking VLAN", V.parking.id + " · named " + V.parking.name + " · the spare ports, shut"], ["VLAN 1", "the gear's own addresses · " + p.lan + "/24"]].filter(Boolean);
  return [
    ["The router", p.rtHost + " · by SSH from a staff PC at " + S.gw + " · its console is in the closet cabinet, locked; the key is with " + mgr],
    ["The closet switch", p.swHost + " · by SSH from a staff PC at " + p.swIp + " · its console is in the cabinet too"],
    ["The back switch", p.bswHost + " · at its console, in the " + back + ": your laptop is on its console cable"],
    ["Enable secrets", "the router " + p.rtSecret + " · both switches " + p.swSecret],
    ["Console passwords", "the router " + p.rtConsole + " · both switches " + p.swConsole],
    ["Remote logins (SSH)", "user " + p.user + " · password " + p.userPw],
    ["The printer", p.printerIp + ", on the printers' VLAN"]
  ].concat(p.fixed ? [["The provider", "fixed address " + p.fixed.ip + "/" + p.fixed.len + " on the router's provider port · their gateway " + p.fixed.gw + " · their DNS servers " + p.dns.join(" and ")]] : [], plan);
}

/* ---------------------------------------------------------------- SB-01 */
/* The counter PC's switch port put in another VLAN by whoever was last in the closet: the card-machine company setting up
   on the guests' network, the manager parking spare ports from a list, or the camera company. The PC takes whatever its
   port's VLAN gives it: a guest's address (online, but no printer and no staff), or 169.254 (no pool behind it). */
const SB01_STORY = {
  guest: function (pc) { return "Since this morning the " + pc + " can't print, and it can't open anything on my PC either. The internet works on it, which is the odd part. The card-machine company had someone in the closet yesterday afternoon, setting up the new card terminal on the guests' network."; },
  parking: function (pc) { return "Nothing works on the " + pc + " since this morning: no internet, no printer. On Saturday I went through the card processor's checklist on the closet switch, putting the spare ports in the parking VLAN the way your notes showed me, typing the ports in from the list."; },
  cameras: function (pc, room) { return "The " + pc + " has had no network at all since Tuesday. That was the day the camera company came to look at the camera in the " + room + ", and they were in the closet a good while."; }
};
const SB01 = {
  id: "SB-01", n: "01", level: 3, tier: "common", title: "One staff PC can't print or reach the others", priority: 2, due: "2 h",
  build(seed) {
    const B = settled(seed), sim = B.sim, p = B.plan, r = rng(hash("SB-01:" + seed)), kind = r.pick(["guest", "parking", "cameras"]);
    const V = kind === "guest" ? p.vlans.guest.id : kind === "parking" ? p.vlans.parking.id : p.vlans.cameras.id;
    const lines = kind === "parking" ? ["configure terminal", "interface range gi0/1 , gi0/4 , gi0/7 - 22", "switchport access vlan " + V, "end"]   /* the list typed in with port 1 in it */
      : ["configure terminal", "interface gi0/1", "switchport access vlan " + V, "end"];
    onSwitch(sim, "msw", lines.concat(SAVE));
    exec(sim, "pc", "ipconfig /renew");   /* the PC asked again since (a restart, a lease running out): it has what its port's VLAN gives */
    freeze(sim);
    return { sim: sim, v: { kind: kind, plan: p, vlan: V, printer: p.printerIp, pc: name(sim, "pc"), room: String(sim.net.roomNames.guest).toLowerCase() } };
  },
  brief(v) { return { quote: SB01_STORY[v.kind](v.pc, v.room) }; },
  mason: "A PC is only as connected as the port it's plugged into. Find out what the switch has done with this one.",
  affected: "pc",
  options(v) {
    const pc = v.pc, g = v.kind === "guest";
    return [
      { id: "right", right: true, text: "The " + pc + "'s switch port has been put in the wrong VLAN" },
      { id: "static", text: "The " + pc + " has been given a fixed address on the wrong network", why: g ? "ipconfig /all says DHCP Enabled: Yes, and names the router as the DHCP server that leased it this address. Nobody typed it in." : "A fixed address is never a 169.254 one: Windows gives itself that when no DHCP server answers. ipconfig /all says DHCP Enabled: Yes." },
      { id: "pool", text: "The staff VLAN's pool of addresses has run out", why: g ? "The PC has a lease, and a pool run out leaves a PC on 169.254. Its lease isn't from the staff pool at all: the router's bindings say which pool it's from." : "The router's staff pool still has addresses free (show ip dhcp pool), and the manager's PC, on the same switch, renews at once." },
      { id: "trunk", text: "The trunk to the router no longer carries the staff VLAN", why: "The manager's PC, in the staff VLAN on the same closet switch, prints and gets online. show interfaces trunk lists the staff VLAN on the router's port." },
      { id: "portsec", text: "Port security has shut the " + pc + "'s port", why: "show interfaces status says the port is connected, not err-disabled, and the sticky address it learned is the PC's own." },
      v.kind === "guest" ? { id: "acl", text: "The guests' access list is blocking the " + pc, why: "The list does what it was written for: it keeps guests off the staff and the printer. That's the symptom. A staff PC has no business holding a guest's address in the first place." }
        : { id: "cable", text: "The " + pc + "'s patch cable is faulty", why: "The port is connected at 1000 Mb/s, full duplex, with no errors counted. A faulty cable shows as notconnect, or a slow link with errors climbing." }
    ];
  },
  rung1(v) { return "On the " + v.pc + ": ipconfig /all, and hold its address up against the staff VLAN's in the records. Then on the closet switch, from the manager's PC: show interfaces status, and find the PC's port by its description."; },
  rung2() { return "An access port puts everything plugged into it in one VLAN, and each VLAN is a network of its own. A PC gets its address, its gateway and everything it can reach from the VLAN of the port it's on, whatever the PC itself asks for."; },
  fixHints(v) { return ["The records say which VLAN every staff PC belongs in; the closet switch says which one this PC's port is in. SSH to it from the manager's PC.", "Put that one port back in the VLAN the records give the staff, and leave every other port as it is" + (v.kind === "parking" ? ": the spare ports were parked on purpose." : "."), "Save it, then have the " + v.pc + " ask for an address again: it keeps the one it has until it asks."]; },
  exhibits(sim, v) {
    const sw = sim.d.msw.sw, a = sim.addr("pc");
    return sw.ports[G1].access === v.vlan && !!a && !inNet(a.ip, staffOf(v).net, 24) && !reachesPrinter(sim, "pc", v.printer) && online(sim, "mgr");
  },
  fixed(sim, v) {
    const sw = sim.d.msw.sw, S = staffOf(v), run = sw.ports[G1], st = sw.startup && sw.startup.ports[G1], a = sim.addr("pc");
    const port = function (x) { return !!x && x.access === S.id && x.mode === "access" && !x.shutdown; };
    return port(run) && port(st) && !!a && a.kind === "dhcp" && inNet(a.ip, S.net, 24) && online(sim, "pc") && reachesPrinter(sim, "pc", v.printer) && online(sim, "mgr") && SB01.sparesParked(sim, v);
  },
  /* the spare ports stay parked and shut: a fix that unparks them undoes the card processor's checklist */
  sparesParked(sim, v) {
    const sw = sim.d.msw.sw, P = v.plan.vlans.parking.id;
    return ["GigabitEthernet0/4"].concat(Array.from({ length: 16 }, function (x, i) { return "GigabitEthernet0/" + (i + 7); })).every(function (n) { const x = sw.ports[n]; return x.shutdown && x.access === P; });
  },
  partial(v, sim) {
    const sw = sim.d.msw.sw, S = staffOf(v), st = sw.startup && sw.startup.ports[G1];
    if (!SB01.sparesParked(sim, v)) return "The " + v.pc + " is back, but spare ports aren't parked and shut any more: the card processor's checklist has them that way, and anyone could plug into one.";
    if (!(st && st.access === S.id)) return "It works right now, but the switch hasn't saved it: the next power cut or reload puts the " + v.pc + "'s port back in VLAN " + v.vlan + ".";
    return "It works, but not the way the records have it: the " + v.pc + " belongs on an address the router hands out, on a port set as an access port in the staff VLAN.";
  },
  proves(f, sim, v) { return (f.cmd === "ping" && f.dev === "pc" && f.replies > 0 && (f.who || []).indexOf("printer") >= 0) || (f.print === "ok" && f.port === v.printer); },
  proofText: "a ping from the PC to the printer that gets replies, or a test page that prints",
  evidence: [
    { id: "ipc", test: function (f, v) { return f.cmd === "ipconfig" && f.dev === "pc" && !!f.ip && !inNet(f.ip, staffOf(v).net, 24); }, text: function (f, v) { return "ipconfig on the " + v.pc + ": " + f.ip + (f.apipa ? " (169.254: it gave itself that) and no default gateway" : ", gateway " + f.gw + ": not the staff network, " + staffOf(v).net + "/24"); } },
    { id: "dhcpyes", test: function (f) { return f.cmd === "ipconfig" && f.sub === "/all" && f.dev === "pc"; }, text: function () { return "ipconfig /all on the PC: DHCP Enabled: Yes"; } },
    { id: "status", test: function (f, v) { return new RegExp("^Gi0/1\\s.*\\bconnected\\s+" + v.vlan + "\\b", "m").test(devOut(f)); }, text: function (f, v) { return "show interfaces status on the closet switch: Gi0/1, the PC's port, connected, in VLAN " + v.vlan; } },
    { id: "swport", test: function (f, v) { return /^Name: Gi0\/1$/m.test(devOut(f)) && new RegExp("Access Mode VLAN: " + v.vlan + "\\b").test(devOut(f)); }, text: function (f, v) { const m = devOut(f).match(/Access Mode VLAN: (\d+ \([^)]*\))/); return "show interfaces gi0/1 switchport: Access Mode VLAN " + (m ? m[1] : v.vlan); } },
    { id: "vlans", test: function (f, v) { return new RegExp("^" + v.vlan + "\\s+\\S+\\s+active\\s.*\\bGi0/1\\b", "m").test(devOut(f)) && /VLAN Name\s+Status\s+Ports/.test(devOut(f)); }, text: function (f, v) { return "show vlan brief: Gi0/1 is listed under VLAN " + v.vlan + ", not the staff VLAN"; } },
    { id: "run", test: function (f, v) { return new RegExp("interface GigabitEthernet0/1\\n(?: [^\\n]*\\n)*? switchport access vlan " + v.vlan + "\\n").test(devOut(f)); }, text: function (f, v) { return "show running-config on the closet switch: interface GigabitEthernet0/1, switchport access vlan " + v.vlan; } },
    { id: "binding", test: function (f, v) { return v.kind === "guest" && /Bindings from all pools|IP address\s+Client-ID/i.test(devOut(f)) && devOut(f).indexOf(v.plan.vlans.guest.net.replace(/\.0$/, ".")) >= 0; }, text: function (f, v) { return "show ip dhcp binding on the router: the PC's hardware address holds a lease from the guests' pool (" + v.plan.vlans.guest.net + "/24)"; } },
    { id: "noprint", test: function (f, v) { return (f.cmd === "ping" && f.dev === "pc" && f.ip === v.printer && !f.replies) || f.print === "fail"; }, text: function (f) { return f.print ? "Test page from the PC: nothing came out" : "Ping from the PC to the printer: no reply"; } },
    { id: "web", test: function (f, v) { return v.kind === "guest" && f.cmd === "ping" && f.dev === "pc" && f.internet && f.replies > 0; }, text: function () { return "Ping from the PC to the internet: replies. It gets out, as a guest would."; } }
  ],
  summary(v) {
    const how = { guest: "The card-machine company had put the PC's port in the guests' VLAN while setting up their terminal, and saved it.", parking: "The spare ports were typed in from the checklist with port 1, the PC's, among them, so it was parked with them and saved.", cameras: "The camera company had moved the PC's port into the cameras' VLAN, and saved it." }[v.kind];
    const then = v.kind === "guest" ? " The PC took a guest's address: online, but kept off the printer and the staff, as every guest is." : " With no pool for that VLAN to answer it, the PC gave itself a 169.254 address and reached nothing.";
    return { cause: how + then, fix: "Put the PC's port back in the staff VLAN (" + v.plan.vlans.staff.id + "), as the records have it, left every other port as it was, saved, and had the PC ask for its address again." };
  }
};

/* ---------------------------------------------------------------- SB-02 */
/* A VLAN deleted from a switch by someone tidying it ("what wasn't being used"): the staff VLAN from the back switch (the back
   PC goes dark, the department beside it doesn't), the printers' VLAN from the closet switch (nobody prints), or the guests'
   VLAN from the closet switch (visitors join and get no address). Its ports stay assigned to it and go inactive, and the trunk
   stops carrying it, as on the real thing. The fix: the VLAN made again with the records' name, saved; whoever lost it asks
   again. Put back with the switch's own name for it (VLAN0020), it works, and isn't the records' way. */
const SB02_KIND = {
  staff: { sw: "bsw", key: "staff", dev: "bpc", port: "1" },
  printers: { sw: "msw", key: "printers", dev: "printer", port: "3" },
  guest: { sw: "msw", key: "guest", dev: "guest", port: "5" }
};
const SB02_STORY = {
  staff: function (v) { return "The " + v.devName + " in the " + v.back + " has had no network since Monday morning. Everything out front is fine, and so are the " + v.deptName + "'s PCs right next to it. On Saturday a work-experience student tidied the back switch for us: he said he'd taken out whatever wasn't being used."; },
  printers: function (v) { return "Nobody can print since this morning: not the " + v.pc + ", not my PC, not the " + v.deptName + ". Last night the student who helps us out tidied the closet switch's settings, taking out what he called leftovers."; },
  guest: function () { return "Customers say the guest Wi-Fi takes the password and then never connects. Our own computers are all fine. The card processor's checklist says to remove anything unused from the switches, so I did some of that on Saturday, on the closet switch."; }
};
const vlansOn = function (sim, id, saved) { const sw = sim.d[id].sw, V = saved ? sw.startup && sw.startup.vlans : sw.vlans; return V || {}; };
const SB02 = {
  id: "SB-02", n: "02", level: 3, tier: "common", title: "Part of the business went dark after the weekend", priority: 2, due: "2 h",
  build(seed) {
    const B = settled(seed), sim = B.sim, p = B.plan, r = rng(hash("SB-02:" + seed)), kind = r.pick(["staff", "printers", "guest"]), K = SB02_KIND[kind], V = p.vlans[K.key];
    const had = { msw: Object.keys(vlansOn(sim, "msw")).map(Number), bsw: Object.keys(vlansOn(sim, "bsw")).map(Number) };   /* every VLAN each switch had: a fix mustn't lose another */
    onSwitch(sim, K.sw, ["configure terminal", "no vlan " + V.id, "end"].concat(SAVE));
    if (kind === "staff") exec(sim, "bpc", "ipconfig /renew");   /* restarted on Monday morning: it asked again */
    if (kind === "guest") { sim.apply({ t: "radio", dev: "guest", on: false }); sim.apply({ t: "radio", dev: "guest", on: true }); }   /* a visitor's phone joining since */
    freeze(sim);
    return { sim: sim, v: { kind: kind, plan: p, sw: K.sw, vlan: V.id, vname: V.name, had: had, printer: p.printerIp, pc: name(sim, "pc"), devName: name(sim, K.dev === "guest" ? "guest" : K.dev), back: String(sim.net.roomNames.back).toLowerCase(), deptName: String(sim.net.roomNames.dept).toLowerCase(), swName: name(sim, K.sw) } };
  },
  brief(v) { return { quote: SB02_STORY[v.kind](v) }; },
  mason: "When a whole group of devices stops at once, look for what they have in common before you look at any one of them.",
  affected(v) { return v.kind === "staff" ? "bpc" : v.kind === "guest" ? "guest" : "pc"; },
  options(v) {
    const what = { staff: "staff", printers: "printers'", guest: "guests'" }[v.kind], dev = { staff: "the " + v.devName, printers: "the printer", guest: "the access point" }[v.kind], sw = v.swName;
    return [
      { id: "right", right: true, text: "The " + what + " VLAN has been deleted from the " + sw },
      { id: "port", text: cap(dev) + "'s switch port has been moved to another VLAN", why: "show interfaces gi0/" + SB02_KIND[v.kind].port + " switchport on the " + sw + " still gives the port the VLAN the records have for it. Nobody moved the port." },
      { id: "trunk", text: v.kind === "staff" ? "The trunk between the two switches no longer allows the staff VLAN" : "The trunk to the router no longer allows the " + what + " VLAN", why: "show interfaces trunk still lists it among the VLANs allowed on the trunk. What's allowed hasn't changed." },
      { id: "shut", text: cap(dev) + "'s switch port has been shut down", why: "show interfaces status says the port is connected, not disabled, and its light is on." },
      { id: "subif", text: "The router's subinterface for the " + what + " VLAN has been shut down", why: v.kind === "staff" ? "The " + v.pc + " and the manager's PC, in the staff VLAN on the closet switch, get online through that subinterface, and show ip interface brief on the router has it up and up." : "show ip interface brief on the router has that subinterface up and up, and the router's other VLANs work through the same port." },
      v.kind === "staff" ? { id: "pool", text: "The staff VLAN's pool of addresses has run out", why: "The " + v.pc + " and the manager's PC renew at once from that pool, and show ip dhcp pool has addresses free." }
        : v.kind === "printers" ? { id: "addr", text: "The printer's fixed address has been changed", why: "The printer's own panel gives the address the records have for it, and every PC prints to that address." }
          : { id: "pw", text: "The guest Wi-Fi's password has been changed", why: "The phone is let on to the guest network and asks for an address: a wrong password is refused before that, and the phone says so." }
    ];
  },
  rung1(v) { return v.kind === "staff" ? "On the " + v.devName + ": ipconfig. Then on the back switch, from your laptop's console: show vlan brief and show interfaces status, and hold them up against the records." : "On the closet switch, from the manager's PC: show vlan brief and show interfaces status, and hold them up against the records' VLAN plan. Then show interfaces trunk."; },
  rung2() { return "A port can only carry a VLAN its switch knows. Take a VLAN out of a switch and every port assigned to it goes inactive, and every trunk stops carrying it, whatever the ports and the trunk are still set to."; },
  fixHints(v) { return ["The records' VLAN plan says what each switch should have. Compare it with the " + v.swName + "'s own list.", "Put back what's missing on that switch, named as the records name it. The ports and the trunk are set up for it already.", "Save it, then have whatever lost its network ask again" + (v.kind === "guest" ? ": the visitor's phone joins again." : v.kind === "staff" ? ": the PC keeps its 169.254 address until it asks." : ".")]; },
  exhibits(sim, v) {
    if (vlansOn(sim, v.sw)[v.vlan]) return false;
    if (v.kind === "staff") { const a = sim.addr("bpc"); return !!a && a.kind === "apipa" && online(sim, "pc") && online(sim, "dpc1"); }
    if (v.kind === "printers") return !reachesPrinter(sim, "pc", v.printer) && online(sim, "pc") && online(sim, "mgr");
    const g = sim.addr("guest"); return !!g && g.kind === "apipa" && online(sim, "pc");
  },
  /* the VLAN on its switch, running and saved, as the records name it; every VLAN each switch had still there; whoever lost it back */
  works(sim, v) {
    const S = v.plan.vlans.staff;
    if (v.kind === "staff") { const a = sim.addr("bpc"); return !!a && a.kind === "dhcp" && inNet(a.ip, S.net, 24) && online(sim, "bpc"); }
    if (v.kind === "printers") return ["pc", "mgr", "bpc"].every(function (id) { return reachesPrinter(sim, id, v.printer); });
    const g = sim.addr("guest"), G = v.plan.vlans.guest; return !!g && g.kind === "dhcp" && inNet(g.ip, G.net, 24) && online(sim, "guest");
  },
  kept(sim, v, saved) { return ["msw", "bsw"].every(function (id) { const V = vlansOn(sim, id, saved); return v.had[id].every(function (n) { return !!V[n]; }); }); },
  fixed(sim, v) {
    const run = vlansOn(sim, v.sw)[v.vlan], st = vlansOn(sim, v.sw, true)[v.vlan];
    return !!run && !!st && run.name === v.vname && st.name === v.vname && SB02.kept(sim, v) && SB02.kept(sim, v, true) && SB02.works(sim, v) && online(sim, "pc") && online(sim, "mgr");
  },
  partial(v, sim) {
    const run = vlansOn(sim, v.sw)[v.vlan], st = vlansOn(sim, v.sw, true)[v.vlan];
    if (run && run.name !== v.vname) return "It works, but the VLAN came back with the switch's own name for it, " + run.name + ". The records call it " + v.vname + ", and the next technician goes by the records.";
    if (!st) return "It works right now, but the switch hasn't saved it: the next power cut or reload deletes the VLAN again.";
    if (st.name !== v.vname) return "It works right now, but the switch hasn't saved the VLAN's name: the next power cut or reload brings it back as " + st.name + ".";
    if (!SB02.kept(sim, v) || !SB02.kept(sim, v, true)) return "That's back, but another VLAN has gone from a switch on the way: the records have it there.";
    return "It works right now, but not everything is back the way the records have it.";
  },
  proves(f, sim, v) {
    if (v.kind === "staff") return f.cmd === "ping" && f.dev === "bpc" && f.replies > 0 && (f.who || []).some(function (w) { return w !== "bpc"; });
    if (v.kind === "printers") return (f.print === "ok" && f.port === v.printer) || (f.cmd === "ping" && f.replies > 0 && (f.who || []).indexOf("printer") >= 0);
    return ((f.join || f.radio) && f.dev === "guest" && !!f.internet) || (f.page === "guest-wifi" && !!f.internet);   /* the phone's own Wi-Fi page saying Internet: OK counts, as a look at a page always has */
  },
  proofText: "the device that lost its network reaching past itself: a ping from the back PC, a test page or a ping to the printer, or the visitor's phone online",
  evidence: [
    { id: "apipa", test: function (f, v) { return v.kind === "staff" && f.cmd === "ipconfig" && f.dev === "bpc" && f.apipa; }, text: function (f, v) { return "ipconfig on the " + v.devName + ": " + f.ip + " (169.254: no DHCP server answered)"; } },
    { id: "phone", test: function (f, v) { return v.kind === "guest" && (((f.join || f.radio) && f.dev === "guest") || (f.page === "guest-wifi" && f.connected)) && f.apipa; }, text: function () { return "The visitor's phone joins the guest Wi-Fi but gets no address: 169.254, no internet"; } },
    { id: "noprint", test: function (f, v) { return v.kind === "printers" && (f.print === "fail" || (f.cmd === "ping" && f.ip === v.printer && !f.replies)); }, text: function (f) { return f.print ? "Test page from the PC: nothing came out" : "Ping to the printer: no reply"; } },
    { id: "vlans", test: function (f, v) { const o = devOut(f); return f.on === v.sw && /VLAN Name\s+Status\s+Ports/.test(o) && !new RegExp("^" + v.vlan + "\\s", "m").test(o); }, text: function (f, v) { return "show vlan brief on the " + v.swName + ": no VLAN " + v.vlan + " in its list"; } },
    { id: "inactive", test: function (f, v) { return f.on === v.sw && new RegExp("Access Mode VLAN: " + v.vlan + " \\(Inactive\\)").test(devOut(f)); }, text: function (f, v) { return "show interfaces switchport on the " + v.swName + ": the port's VLAN " + v.vlan + " is Inactive"; } },
    { id: "unassigned", test: function (f, v) { return f.on === v.sw && /^Gi0\/\d+\s.*\bconnected\s+unassigned\b/m.test(devOut(f)); }, text: function (f, v) { const m = devOut(f).match(/^(Gi0\/\d+)\s.*\bconnected\s+unassigned\b/m); return "show interfaces status on the " + v.swName + ": " + (m ? m[1] : "a port") + " connected, its VLAN unassigned"; } },
    { id: "trunk", test: function (f, v) { const o = devOut(f); return /Vlans allowed and active in management domain/.test(o) && f.on === v.sw; }, text: function (f, v) { return "show interfaces trunk on the " + v.swName + ": VLAN " + v.vlan + " allowed, but not among the VLANs active on it"; } },
    { id: "run", test: function (f, v) { const o = devOut(f); return f.on === v.sw && /Current configuration/.test(o) && o.indexOf("\nvlan " + v.vlan + "\n") < 0 && new RegExp("switchport access vlan " + v.vlan + "\\n|allowed vlan [0-9,]*\\b" + v.vlan + "\\b").test(o); }, text: function (f, v) { return "show running-config on the " + v.swName + ": ports still set for VLAN " + v.vlan + ", but no vlan " + v.vlan + " in it"; } }
  ],
  summary(v) {
    const who = { staff: "The work-experience student had deleted the staff VLAN from the back switch, taking it for unused (only one port there is in it), and saved.", printers: "The closet switch's printers' VLAN had been deleted as a leftover, and saved.", guest: "The guests' VLAN had been deleted from the closet switch as unused (no port there is an access port in it: it rides the trunk to the access point), and saved." }[v.kind];
    return { cause: who + " Its ports stayed assigned to it and went inactive, and the trunks stopped carrying it, so everything in it lost the network.", fix: "Made VLAN " + v.vlan + " again on the " + v.swName + ", named " + v.vname + " as the records have it, saved, and had " + (v.kind === "staff" ? "the PC ask for its address again" : v.kind === "guest" ? "the visitor's phone join again" : "a test page sent") + "." };
  }
};

/* ---------------------------------------------------------------- SB-03 */
/* A VLAN left off a trunk on the closet switch: the back room's trunk told to carry only the department's VLAN by someone who
   meant to add it (`allowed vlan` without `add` replaces the list: the back PC and the back door camera go dark, the department
   beside them doesn't); the access point's trunk tidied down to VLAN 1 (visitors join and get no address); or the router's
   trunk given a list of its own from a hardening checklist with the printers' VLAN left out (nobody prints). Every VLAN is
   still on both switches: it's the trunk that won't carry it. The fix: the VLAN added back on that trunk, saved, carrying what
   it did and no more (`allowed vlan all` on the back's or the access point's trunk works, and carries VLANs the far end has no
   use for). */
const SB03_KIND = {
  back: { port: "GigabitEthernet0/23", short: "gi0/23", far: "bsw", lost: ["staff", "cameras"], dev: "bpc" },
  ap: { port: "GigabitEthernet0/5", short: "gi0/5", far: "ap", lost: ["guest"], dev: "guest" },
  router: { port: "GigabitEthernet0/24", short: "gi0/24", far: "rtr", lost: ["printers"], dev: "pc" }
};
const SB03_STORY = {
  back: function (v) { return "Since Thursday the " + v.devName + " has had no network, and the camera app says the back door camera is offline. The " + v.deptName + "'s PCs, in the room right next to them, are fine. On Wednesday the company that set up the " + v.deptName + " came back to check their work on the switches."; },
  ap: function () { return "Customers say the guest Wi-Fi takes the password and then never connects. Our own PCs are all fine, and the access point's light is blue. On Saturday I tidied the closet switch from the card processor's checklist, the part about ports carrying only what they need."; },
  router: function (v) { return "Nobody can print since Monday: not the " + v.pc + ", not my PC, not the " + v.deptName + ". Everything else works, internet and all. Over the weekend our nephew went through a hardening checklist on the closet switch for us."; }
};
const allowedOf = function (sim, id, n, saved) { const sw = sim.d[id].sw, P = saved ? sw.startup && sw.startup.ports && sw.startup.ports[n] : sw.ports[n]; return !P ? [] : P.allowed === "all" ? "all" : P.allowed.slice(); };
const carriesAll = function (al, ids) { return ids.every(function (x) { return al === "all" || al.indexOf(x) >= 0; }); };
const SB03 = {
  id: "SB-03", n: "03", level: 3, tier: "common", title: "Some things stopped working, others right next to them didn't", priority: 2, due: "2 h",
  build(seed) {
    const B = settled(seed), sim = B.sim, p = B.plan, r = rng(hash("SB-03:" + seed)), kind = r.pick(["back", "ap", "router"]), K = SB03_KIND[kind], V = p.vlans;
    const before = allowedOf(sim, "msw", K.port), lost = K.lost.map(function (k) { return V[k].id; });
    const line = kind === "back" ? "switchport trunk allowed vlan " + V.dept.id : kind === "ap" ? "switchport trunk allowed vlan 1"
      : "switchport trunk allowed vlan " + [1, V.staff.id, V.dept.id, V.guest.id, V.cameras.id].sort(function (a, b) { return a - b; }).join(",");   /* everything in use but the printers' */
    onSwitch(sim, "msw", ["configure terminal", "interface " + K.short, line, "end"].concat(SAVE));
    if (kind === "back") exec(sim, "bpc", "ipconfig /renew");
    if (kind === "ap") { sim.apply({ t: "radio", dev: "guest", on: false }); sim.apply({ t: "radio", dev: "guest", on: true }); }
    freeze(sim);
    return { sim: sim, v: { kind: kind, plan: p, port: K.port, short: K.short, before: before, lost: lost, line: line, printer: p.printerIp, pc: name(sim, "pc"), devName: name(sim, K.dev === "guest" ? "guest" : K.dev), deptName: String(sim.net.roomNames.dept).toLowerCase(), farName: name(sim, K.far), cam: kind === "back" ? p.vlans.cameras.net.replace(/0$/, String(p.cams[1].host)) : null } };
  },
  brief(v) { return { quote: SB03_STORY[v.kind](v) }; },
  mason: "When some things on a path still work and others don't, find what the ones that stopped have in common, and where their path and the working ones' part.",
  affected(v) { return v.kind === "back" ? "bpc" : v.kind === "ap" ? "guest" : "pc"; },
  options(v) {
    const far = v.farName, which = { back: "the VLANs the " + v.devName + " and the back door camera use", ap: "the guests' VLAN", router: "the printers' VLAN" }[v.kind];
    return [
      { id: "right", right: true, text: "The closet switch's trunk to the " + far + " no longer carries " + which },
      { id: "deleted", text: v.kind === "back" ? "The staff and cameras' VLANs have been deleted from the closet switch" : "The " + (v.kind === "ap" ? "guests'" : "printers'") + " VLAN has been deleted from the closet switch", why: "show vlan brief on the closet switch still lists it, active." + (v.kind === "back" ? " The counter PC and the shop's camera, on the same switch, are still in theirs." : "") },
      { id: "native", text: "The two ends of the trunk to the " + far + " disagree on the native VLAN", why: v.kind === "back" ? "show interfaces trunk gives the same native VLAN at both ends, and neither switch logs a native VLAN mismatch." : "A native mismatch leaks the untagged VLAN; it doesn't stop a tagged one. show interfaces trunk shows the port trunking, with the native VLAN the records give it." },
      { id: "dtp", text: "The trunk to the " + far + " has stopped trunking", why: "show interfaces trunk lists the port as trunking, mode on, and the " + (v.kind === "back" ? deptOf(v) + "'s PCs" : v.kind === "ap" ? "access point's own address" : "staff VLAN") + " still crosses it." },
      { id: "port", text: v.kind === "back" ? "The " + v.devName + "'s port on the back switch has been moved to another VLAN" : v.kind === "ap" ? "The access point's guest network has been moved to another VLAN tag" : "The printer's switch port has been moved to another VLAN", why: v.kind === "ap" ? "The access point's own page tags the guest network with the VLAN the records give it." : "show interfaces switchport gives the port the VLAN the records have for it, and not inactive." },
      v.kind === "back" ? { id: "bsw", text: "The back switch has failed", why: "The " + v.deptName + "'s PCs are on the back switch too, and they're online through it, over the same trunk." }
        : v.kind === "ap" ? { id: "pw", text: "The guest Wi-Fi's password has been changed", why: "The phone is let on to the guest network and asks for an address: a wrong password is refused before that, and the phone says so." }
          : { id: "addr", text: "The printer's fixed address has been changed", why: "The printer's own panel gives the address the records have for it, and every PC prints to that address." }
    ];
  },
  rung1() { return "On the closet switch, from the manager's PC: show interfaces trunk. Read each trunk's VLANs allowed, then the VLANs allowed and active, and hold them up against the records' VLAN plan and show vlan brief."; },
  rung2() { return "A trunk carries only the VLANs on its allowed list. The command that sets the list replaces it, unless it's told to add to it or take from it, so one line typed for one VLAN can take every other VLAN off the trunk."; },
  fixHints(v) { return ["show interfaces trunk on the closet switch says what each trunk carries. Compare the one on the path that stopped with what the records say goes over it.", "Add back only what's missing, to what that trunk carries now: the VLANs that still work over it stay.", "Save it, then have whatever lost its network ask again" + (v.kind === "ap" ? ": the visitor's phone joins again." : v.kind === "back" ? ": the PC keeps its 169.254 address until it asks." : ".")]; },
  exhibits(sim, v) {
    const al = allowedOf(sim, "msw", v.port); if (carriesAll(al, v.lost)) return false;
    if (v.kind === "back") { const a = sim.addr("bpc"); return !!a && a.kind === "apipa" && online(sim, "dpc1") && online(sim, "pc"); }
    if (v.kind === "ap") { const g = sim.addr("guest"); return !!g && g.kind === "apipa" && online(sim, "pc"); }
    return !reachesPrinter(sim, "pc", v.printer) && online(sim, "pc") && online(sim, "mgr");
  },
  /* the trunk carries what it lost again, and no VLAN it didn't carry before (the router's trunk carried them all) */
  rightList(al, v) { return carriesAll(al, v.lost) && (v.before === "all" || (al !== "all" && al.every(function (x) { return v.before.indexOf(x) >= 0; }))) && (v.before === "all" ? carriesAll(al, [v.plan.vlans.staff.id, v.plan.vlans.dept.id, v.plan.vlans.guest.id, v.plan.vlans.cameras.id, v.plan.vlans.printers.id]) : carriesAll(al, v.before)); },
  works(sim, v) {
    if (v.kind === "back") { const a = sim.addr("bpc"), S = v.plan.vlans.staff; return !!a && a.kind === "dhcp" && inNet(a.ip, S.net, 24) && online(sim, "bpc") && online(sim, "dpc1"); }
    if (v.kind === "ap") { const g = sim.addr("guest"); return !!g && g.kind === "dhcp" && inNet(g.ip, v.plan.vlans.guest.net, 24) && online(sim, "guest"); }
    return ["pc", "mgr", "bpc"].every(function (id) { return reachesPrinter(sim, id, v.printer); });
  },
  fixed(sim, v) { return SB03.rightList(allowedOf(sim, "msw", v.port), v) && SB03.rightList(allowedOf(sim, "msw", v.port, true), v) && SB03.works(sim, v) && online(sim, "pc") && online(sim, "mgr"); },
  partial(v, sim) {
    const al = allowedOf(sim, "msw", v.port), st = allowedOf(sim, "msw", v.port, true);
    if (!SB03.rightList(al, v) && carriesAll(al, v.lost)) return "It works, but the trunk now carries VLANs the " + v.farName + " has no use for" + (al === "all" ? " (every VLAN, the guests' included)" : "") + ". The records have it carrying only what's on the far side.";
    if (!SB03.rightList(st, v)) return "It works right now, but the switch hasn't saved it: the next power cut or reload takes the VLAN off the trunk again.";
    return "It works right now, but not everything is back the way the records have it.";
  },
  proves(f, sim, v) {
    if (v.kind === "back") return f.cmd === "ping" && f.dev === "bpc" && f.replies > 0 && (f.who || []).some(function (w) { return w !== "bpc"; });
    if (v.kind === "router") return (f.print === "ok" && f.port === v.printer) || (f.cmd === "ping" && f.replies > 0 && (f.who || []).indexOf("printer") >= 0);
    return ((f.join || f.radio) && f.dev === "guest" && !!f.internet) || (f.page === "guest-wifi" && !!f.internet);
  },
  proofText: "the device that lost its network reaching past itself: a ping from the back PC, the visitor's phone online, or a test page or a ping to the printer",
  evidence: [
    { id: "apipa", test: function (f, v) { return v.kind === "back" && f.cmd === "ipconfig" && f.dev === "bpc" && f.apipa; }, text: function (f, v) { return "ipconfig on the " + v.devName + ": " + f.ip + " (169.254: no DHCP server answered)"; } },
    { id: "dept", test: function (f, v) { return v.kind === "back" && f.cmd === "ping" && (f.dev === "dpc1" || f.dev === "dpc2") && f.replies > 0; }, text: function (f, v) { return "Ping from a " + v.deptName + " PC, on the same back switch: replies"; } },
    { id: "phone", test: function (f, v) { return v.kind === "ap" && (((f.join || f.radio) && f.dev === "guest") || (f.page === "guest-wifi" && f.connected)) && f.apipa; }, text: function () { return "The visitor's phone joins the guest Wi-Fi but gets no address: 169.254, no internet"; } },
    { id: "noprint", test: function (f, v) { return v.kind === "router" && (f.print === "fail" || (f.cmd === "ping" && f.ip === v.printer && !f.replies)); }, text: function (f) { return f.print ? "Test page from the PC: nothing came out" : "Ping to the printer: no reply"; } },
    { id: "trunk", test: function (f, v) { const o = devOut(f); return f.on === "msw" && new RegExp("Vlans allowed on trunk[^]*\\n" + v.short.replace("gi", "Gi") + "\\s+\\S").test(o); }, text: function (f, v) { const m = devOut(f).match(new RegExp("Vlans allowed on trunk\\n(?:\\S+\\s+\\S+\\n)*?" + v.short.replace("gi", "Gi") + "\\s+(\\S+)")); return "show interfaces trunk on the closet switch: " + v.short.replace("gi", "Gi") + ", the trunk to the " + v.farName + ", allows " + (m ? m[1] : "fewer VLANs") + " only"; } },
    { id: "vlans", test: function (f, v) { const o = devOut(f); return f.on === "msw" && /VLAN Name\s+Status\s+Ports/.test(o) && v.lost.every(function (id) { return new RegExp("^" + id + "\\s+\\S+\\s+active", "m").test(o); }); }, text: function (f, v) { return "show vlan brief on the closet switch: VLAN " + v.lost.join(" and ") + " still there, active"; } },
    { id: "run", test: function (f, v) { const o = devOut(f); return f.on === "msw" && /Current configuration/.test(o) && o.indexOf("interface " + v.port + "\n") >= 0 && /switchport trunk allowed vlan/.test(o.split("interface " + v.port + "\n")[1].split("!")[0]); }, text: function (f, v) { const blk = devOut(f).split("interface " + v.port + "\n")[1].split("!")[0], m = blk.match(/switchport trunk allowed vlan (\S+)/); return "show running-config on the closet switch: interface " + v.port + ", switchport trunk allowed vlan " + (m ? m[1] : "?"); } }
  ],
  summary(v) {
    const who = { back: "The company that set up the department had typed its VLAN onto the closet switch's trunk to the back switch without add: `" + v.line + "` replaced the trunk's list, so it carried the department's VLAN alone, and saved it. The staff and cameras' VLANs stopped at the closet switch.", ap: "The access point's trunk had been tidied down to VLAN 1 and saved, so the guests' VLAN no longer crossed it: the guest Wi-Fi still took visitors' passwords, and their requests for an address went nowhere.", router: "The router's trunk had been given a list of its own from a hardening checklist, with the printers' VLAN left out, and saved: the printer could no longer be reached through the router from any other VLAN." }[v.kind];
    return { cause: who + " Every VLAN was still on both switches: the trunk just wouldn't carry it.", fix: "Added " + (v.lost.length > 1 ? "VLANs " + v.lost.join(" and ") : "VLAN " + v.lost[0]) + " back to the trunk on " + v.port + " with add, keeping what it already carried, saved, and " + (v.kind === "back" ? "had the back PC ask for its address again" : v.kind === "ap" ? "had the visitor's phone join again" : "sent a test page") + "." };
  }
};
const deptOf = function (v) { return "the " + v.deptName; };

/* ---------------------------------------------------------------- SB-04 */
/* A DHCP pool on the router handing out the wrong default router: the staff pool given the old flat network's gateway (copied
   from the LAN pool above it) or the last address of the network; the department's pool given the first address of the whole
   /24 instead of its own block's; the guests' pool given the network's last address. Devices that asked for an address since
   take the wrong gateway: they reach their own VLAN (the router's own address on it answers), and nothing past it. Devices
   that didn't ask again are fine, which is the clue in the brief. The fix: the pool's default router back to the router's own
   address on that VLAN, saved, and the devices ask again. */
function onRouter(sim, lines) {
  const S = SW.session(sim.d.rtr.sw, { via: "console" }); S.mode = "priv"; S.pending = null; S.fresh = false;
  lines.forEach(function (l) { SW.exec(S, l); });
}
const SB04_KIND = { staff: { key: "staff", devs: ["pc", "bpc"] }, dept: { key: "dept", devs: ["dpc1", "dpc2"] }, guest: { key: "guest", devs: ["guest"] } };
const SB04_STORY = {
  staff: function (v) { return "Monday morning, the " + v.names[0] + " and the " + v.names[1] + " can't get online or print. Both were off over the weekend. My PC, which I never turn off, is fine. Our nephew was in the router on Saturday, \"tidying the address settings\"."; },
  dept: function (v) { return "The " + v.deptName + "'s two PCs lost the internet and the printer this morning, after their weekly restart. Everyone else is fine. On Friday the company that set the " + v.deptName + " up logged in to the router to check their work."; },
  guest: function () { return "Since yesterday, customers say their phones join the guest Wi-Fi and get connected, then say there's no internet. Our own computers are all fine. A friend of my brother's looked at the router's guest settings on Sunday."; }
};
const poolOf = function (sim, name, saved) { const r = sim.d.rtr.sw, P = saved ? r.startup && r.startup.pools : r.pools; return P && P[name]; };
const SB04 = {
  id: "SB-04", n: "04", level: 3, tier: "common", title: "Devices restarted this morning can't get past their own network", priority: 2, due: "2 h",
  build(seed) {
    const B = settled(seed), sim = B.sim, p = B.plan, r = rng(hash("SB-04:" + seed)), kind = r.pick(["staff", "dept", "guest"]), K = SB04_KIND[kind], V = p.vlans[K.key];
    const net = V.net.split(".").map(Number), last = net.slice(0, 3).concat([kind === "dept" ? net[3] + (1 << (32 - V.len)) - 2 : 254]).join(".");
    const wrong = kind === "staff" ? r.pick([p.lanGw, last]) : kind === "dept" ? net.slice(0, 3).concat([1]).join(".") : last;   /* the old LAN's gateway or the network's last address; the /24's first; the last */
    const pools = {}; Object.keys(sim.d.rtr.sw.pools).forEach(function (n) { const q = sim.d.rtr.sw.pools[n]; if (q.router && q.router.length) pools[n] = q.router.slice(); });   /* a host binding's pool has none of its own */
    onRouter(sim, ["configure terminal", "ip dhcp pool " + V.name, "default-router " + wrong, "end"].concat(SAVE));
    K.devs.forEach(function (id) { if (id === "guest") { sim.apply({ t: "radio", dev: "guest", on: false }); sim.apply({ t: "radio", dev: "guest", on: true }); } else exec(sim, id, "ipconfig /renew"); });   /* restarted since: they asked again */
    freeze(sim);
    return { sim: sim, v: { kind: kind, plan: p, pool: V.name, gw: V.gw, net: V.net, len: V.len || 24, wrong: wrong, pools: pools, devs: K.devs, printer: p.printerIp, pc: name(sim, "pc"), names: K.devs.map(function (id) { return name(sim, id); }), deptName: String(sim.net.roomNames.dept).toLowerCase() } };
  },
  brief(v) { return { quote: SB04_STORY[v.kind](v) }; },
  mason: "Two PCs that restarted are broken and one that didn't is fine. What did the restart give them that the other one still has from before?",
  affected(v) { return v.devs[0]; },
  options(v) {
    const what = { staff: "staff", dept: v.deptName + "'s", guest: "guests'" }[v.kind], whose = v.kind === "guest" ? "the visitors' phones" : "the PCs that restarted";
    return [
      { id: "right", right: true, text: "The router's " + what + " DHCP pool hands out the wrong default gateway" },
      { id: "subif", text: "The router's address on the " + what + " VLAN has been changed", why: "show ip interface brief on the router gives that subinterface the address the records have, up and up, and " + whose + " get an answer from it." },
      { id: "trunk", text: "The trunk no longer carries the " + what + " VLAN", why: cap(whose) + " got their addresses from the router's pool for that VLAN: DHCP crossed the trunk to get them." },
      { id: "nat", text: "NAT no longer translates the " + what + " VLAN", why: v.kind === "guest" ? "NAT only matters on the way out to the internet: show ip nat translations still lists the guests' addresses going out before yesterday, and the router's NAT lines are as the records have them." : "NAT is only on the way out to the internet; the printer is inside the business and they can't reach it either." },
      { id: "dns", text: "The pool hands out the wrong DNS servers", why: "Pings by address fail too, not only names: past their own network, nothing answers at all." },
      { id: "pool", text: "The " + what + " pool has run out of addresses", why: cap(whose) + " have addresses from the pool: a pool run out leaves a device on 169.254." }
    ];
  },
  rung1(v) { return "On " + (v.kind === "guest" ? "the visitor's phone: its Wi-Fi page" : "the " + v.names[0] + ": ipconfig /all") + ", and compare every line with the records' VLAN plan. Then on the router, from the manager's PC: show running-config, its DHCP pools."; },
  rung2() { return "A device takes everything it's told from DHCP: its address, its mask, its gateway, its DNS. A gateway outside what the router really answers on sends everything bound past the device's own network to nowhere, while its own network still works."; },
  fixHints(v) { return ["Find what's wrong in what the devices were handed, then find where they were handed it: the router's pool for that VLAN.", "Give that pool the gateway the records give the VLAN, the router's own address on it.", "Save it, then have the devices ask again" + (v.kind === "guest" ? ": the visitor's phone joins again." : ": each keeps what it was given until it asks.")]; },
  exhibits(sim, v) {
    const q = poolOf(sim, v.pool); if (!q || !q.router || q.router[0] !== v.wrong) return false;
    return v.devs.every(function (id) { const a = sim.addr(id); return !!a && a.kind === "dhcp" && a.gw === v.wrong && !online(sim, id); }) && online(sim, "mgr");
  },
  poolsRight(sim, v, saved) { return Object.keys(v.pools).every(function (n) { const q = poolOf(sim, n, saved); return !!q && !!q.router && q.router.join(" ") === v.pools[n].join(" "); }); },
  fixed(sim, v) { return SB04.poolsRight(sim, v) && SB04.poolsRight(sim, v, true) && v.devs.every(function (id) { const a = sim.addr(id); return !!a && a.kind === "dhcp" && a.gw === v.gw && online(sim, id); }) && online(sim, "mgr"); },
  partial(v, sim) {
    if (!v.devs.every(function (id) { const a = sim.addr(id); return a && a.gw === v.gw; })) return "It works for some, but " + (v.kind === "guest" ? "the visitor's phone still has" : "a PC that restarted still has") + " the wrong gateway: it keeps what it was handed until it asks again.";
    if (SB04.poolsRight(sim, v) && !SB04.poolsRight(sim, v, true)) return "It works right now, but the router hasn't saved it: the next power cut or reload hands out the wrong gateway again.";
    if (v.devs.some(function (id) { const a = sim.addr(id); return a && a.kind !== "dhcp"; })) return "It works, but with a gateway typed in on the device: the pool still hands out the wrong one to everything else that asks.";
    return "It works right now, but the router's pools aren't the way the records have them.";
  },
  proves(f, sim, v) {
    if (v.kind === "guest") return ((f.join || f.radio) && f.dev === "guest" && !!f.internet) || (f.page === "guest-wifi" && !!f.internet);
    return f.cmd === "ping" && v.devs.indexOf(f.dev) >= 0 && f.replies > 0 && (f.internet || (f.who || []).indexOf("printer") >= 0);
  },
  proofText: "a device that restarted reaching past its own network: a ping to the printer or the internet, or the visitor's phone online",
  evidence: [
    { id: "ipc", test: function (f, v) { return f.cmd === "ipconfig" && v.devs.indexOf(f.dev) >= 0 && f.gw === v.wrong; }, text: function (f, v, sim) { return "ipconfig on the " + name(sim, f.dev) + ": default gateway " + f.gw + ", from DHCP; the router's address on its VLAN is " + v.gw; } },
    { id: "phone", test: function (f, v) { return v.kind === "guest" && f.page === "guest-wifi" && f.connected && !f.internet; }, text: function () { return "The visitor's phone's Wi-Fi page: connected, an address from the guests' pool, no internet"; } },
    { id: "local", test: function (f, v) { return f.cmd === "ping" && v.devs.indexOf(f.dev) >= 0 && f.ip === v.gw && f.replies > 0; }, text: function (f, v) { return "Ping from a PC that restarted to the router's address on its VLAN, " + v.gw + ": replies"; } },
    { id: "beyond", test: function (f, v) { return f.cmd === "ping" && v.devs.indexOf(f.dev) >= 0 && f.ip !== v.gw && !f.replies; }, text: function (f) { return "Ping from a PC that restarted to " + f.ip + ": no reply, past its own network"; } },
    { id: "pool", test: function (f, v) { const o = devOut(f); return f.on === "rtr" && new RegExp("ip dhcp pool " + v.pool + "\\n[^!]*default-router " + v.wrong.replace(/\./g, "\\.")).test(o); }, text: function (f, v) { return "show running-config on the router: ip dhcp pool " + v.pool + ", default-router " + v.wrong; } }
  ],
  summary(v) {
    const how = { staff: v.wrong === v.plan.lanGw ? "The staff pool's default router had been typed as the old flat network's gateway, copied from the LAN pool above it," : "The staff pool's default router had been set to the network's last address, on the guess that a gateway sits at the end,", dept: "The department's pool had been given the first address of the whole /24 as its default router, not its own block's first usable address,", guest: "The guests' pool had been given the network's last address as its default router," }[v.kind];
    return { cause: how + " and saved. Devices that asked for an address since took that gateway: their own VLAN worked, the router's own address on it answered, and nothing past it did. Devices that hadn't asked again kept the gateway they had.", fix: "Set the " + v.pool + " pool's default router back to " + v.gw + ", the router's own address on that VLAN, saved, and had the devices ask again." };
  }
};

/* ---------------------------------------------------------------- SB-05 */
/* The router's default route wrong: its next hop a digit off on the provider's block (typed in from an engineer on the phone),
   pointed inside at the old network's last address (a nephew's idea of "the way out"), or taken out altogether by someone who
   didn't recognise the line. Everything inside works, VLAN to VLAN, the printer too; nothing gets out, and the cameras can't
   be seen from outside. The fix: the one default route, to the provider's gateway from the records (SB-J7's letter), saved,
   and the wrong one gone. */
const SB05_STORY = {
  slip: function () { return "Nothing gets on the internet since lunchtime: not the PCs, not the card machine, and I can't see the cameras from my phone. The printer and our shared files work fine. This morning the provider's engineer talked me through \"refreshing\" something in the router over the phone, reading me the numbers to type."; },
  inside: function () { return "Since Saturday nothing here gets on the internet, and the camera app can't reach the cameras. Printing and moving files between the PCs work. Our nephew was in the router on Saturday: he said the way out should point at our own network, so he \"corrected\" it."; },
  removed: function () { return "No internet anywhere since Monday morning, for us or the guests, and the cameras are unreachable from my phone. Everything inside works. On Sunday I went through the router's settings with the card processor's checklist and took out a line I didn't recognise."; }
};
const routesOf = function (sim, saved) { const r = sim.d.rtr.sw, R = saved ? r.startup && r.startup.routes : r.routes; return R || []; };
const defaults = function (sim, saved) { return routesOf(sim, saved).filter(function (x) { return x.net === "0.0.0.0" && x.mask === "0.0.0.0"; }); };
const SB05 = {
  id: "SB-05", n: "05", level: 3, tier: "common", title: "Nothing gets out to the internet; everything inside still works", priority: 1, due: "1 h",
  build(seed) {
    const B = settled(seed), sim = B.sim, p = B.plan, F = p.fixed, r = rng(hash("SB-05:" + seed)), kind = r.pick(["slip", "inside", "removed"]);
    const host = function (ip) { return +ip.split(".")[3]; }, pre = F.ip.split(".").slice(0, 3).join("."), first = host(F.net) + 1, last = host(F.bcast) - 1;
    const near = [first, first + 1, last - 1, last].filter(function (h) { return h !== host(F.gw) && h !== host(F.ip) && h >= first && h <= last; });   /* another usable address on the block: a digit misheard */
    const wrong = kind === "slip" ? pre + "." + (near[0] || first) : kind === "inside" ? p.lanGw.replace(/\.\d+$/, ".254") : null;
    onRouter(sim, ["configure terminal", "no ip route 0.0.0.0 0.0.0.0 " + F.gw].concat(wrong ? ["ip route 0.0.0.0 0.0.0.0 " + wrong] : [], ["end"], SAVE));
    freeze(sim);
    return { sim: sim, v: { kind: kind, plan: p, gw: F.gw, wrong: wrong, printer: p.printerIp, pc: name(sim, "pc") } };
  },
  brief(v) { return { quote: SB05_STORY[v.kind](v) }; },
  mason: "Inside works and outside doesn't: follow a packet bound for the internet, hop by hop, and see where it stops.",
  affected: "pc",
  options(v) {
    return [
      { id: "right", right: true, text: v.kind === "removed" ? "The router has no default route: nothing tells it where to send traffic for the internet" : "The router's default route points at the wrong next hop" },
      { id: "nat", text: "NAT has stopped translating the business's addresses", why: "show ip nat translations is empty because nothing leaves: tracert stops at the router, and show ip route says where the router sends internet traffic. NAT's lines are as the records have them." },
      { id: "wan", text: "The router's provider port has lost its fixed address", why: "show ip interface brief gives GigabitEthernet0/0 the fixed address from the provider's letter, up and up." },
      { id: "isp", text: "The provider's line is down", why: "The router's provider port is up, and the router reaches the provider's gateway from the records: ping it from the router and it answers." },
      { id: "dns", text: "The business's DNS servers are unreachable, so names don't look up", why: "Pings by address fail too: tracert to 8.8.8.8 stops at the router, names or no names." },
      { id: "acl", text: "An access list on the router is dropping traffic bound for the internet", why: "show access-lists counts no new matches on any deny line, and the same lists let the VLANs reach each other and the printer through the router." }
    ];
  },
  rung1() { return "On the PC: tracert to an internet address, and see where it stops. Then on the router, from the manager's PC: show ip route, and hold the gateway of last resort up against the provider's letter in the records."; },
  rung2() { return "A router sends a packet by the most specific route that matches. Inside networks are directly connected; everything else needs a default route, and a default route works only through a next hop that's really there, on a network the router is on."; },
  fixHints(v) { return ["The records hold the provider's letter: the gateway the business's way out goes through.", v.kind === "removed" ? "The router needs its one way out back, to that gateway." : "The router's way out needs to go to that gateway, and the wrong one taken away, not left beside it.", "Save it, then test it from a PC: the internet, and the cameras from outside."]; },
  exhibits(sim, v) { const D = defaults(sim); return (v.wrong ? D.length === 1 && D[0].nh === v.wrong : D.length === 0) && !online(sim, "pc") && reachesPrinter(sim, "pc", v.printer); },
  rightRoutes(sim, v, saved) { const D = defaults(sim, saved); return D.length === 1 && D[0].nh === v.gw; },
  fixed(sim, v) { return SB05.rightRoutes(sim, v) && SB05.rightRoutes(sim, v, true) && online(sim, "pc") && online(sim, "mgr") && reachesPrinter(sim, "pc", v.printer); },
  partial(v, sim) {
    const D = defaults(sim);
    if (D.length > 1) return "It works, but the wrong default route is still there beside the right one: the router may send some of the internet's traffic to nowhere, and the next technician won't know which is meant.";
    if (D.length === 1 && D[0].nh !== v.gw) return "It works right now, but not through the provider's gateway in the records.";
    if (!SB05.rightRoutes(sim, v, true)) return "It works right now, but the router hasn't saved it: the next power cut or reload loses the way out again.";
    return "It works right now, but the router's routes aren't the way the records have them.";
  },
  proves(f) { return /^(pc|mgr|bpc)$/.test(f.dev) && ((f.cmd === "ping" && !!f.internet && f.replies > 0) || (f.cmd === "tracert" && f.ok === true && !/^(10|127)\.|^192\.168\./.test(String(f.target)))); },
  proofText: "a ping or a tracert from a staff PC reaching the internet",
  evidence: [
    { id: "noweb", test: function (f) { return f.cmd === "ping" && /^(pc|mgr|bpc)$/.test(f.dev) && f.ip && !/^10\.|^192\.168\./.test(f.ip) && !f.replies; }, text: function (f) { return "Ping from a staff PC to " + f.ip + ", on the internet: no reply"; } },
    { id: "inside", test: function (f, v) { return f.cmd === "ping" && /^(pc|mgr|bpc)$/.test(f.dev) && (f.ip === v.printer || (f.who || []).indexOf("printer") >= 0) && f.replies > 0; }, text: function () { return "Ping from a staff PC to the printer, on another VLAN through the router: replies"; } },
    { id: "tracert", test: function (f) { return f.cmd === "tracert" && /^(pc|mgr|bpc)$/.test(f.dev) && f.ok === false && !f.usage && !/^(10|127)\.|^192\.168\./.test(String(f.target)); }, text: function (f) { return "tracert from a staff PC to the internet: it stops after the router"; } },
    { id: "route", test: function (f) { return f.on === "rtr" && /Gateway of last resort is/.test(devOut(f)); }, text: function (f) { const m = devOut(f).match(/Gateway of last resort is ([^\n]+)/); return "show ip route on the router: Gateway of last resort is " + (m ? m[1] : "?"); } },
    { id: "run", test: function (f) { const o = devOut(f); return f.on === "rtr" && /Current configuration/.test(o) && /ip nat inside source list/.test(o); }, text: function (f) { const m = devOut(f).match(/ip route 0\.0\.0\.0 0\.0\.0\.0 (\S+)/); return "show running-config on the router: " + (m ? "ip route 0.0.0.0 0.0.0.0 " + m[1] : "no default route in it"); } }
  ],
  summary(v) {
    const how = { slip: "The router's default route had been typed with another address on the provider's block as its next hop (" + v.wrong + "), misheard over the phone, and saved. The router sent the internet's traffic to an address nobody answers at.", inside: "The router's default route had been pointed inside, at " + v.wrong + " on the old network, and saved: traffic for the internet was sent back into the business.", removed: "The router's default route had been taken out and saved: with no gateway of last resort, the router answered every packet for the internet with Destination net unreachable." }[v.kind];
    return { cause: how + " Everything inside still worked, because the router is directly connected to every VLAN.", fix: (v.wrong ? "Took the wrong default route out and added the one from the provider's letter, " : "Added the default route from the provider's letter, ") + "ip route 0.0.0.0 0.0.0.0 " + v.gw + ", saved, and tested from a PC." };
  }
};

/* ---------------------------------------------------------------- SB-06 */
/* NAT's inside and outside the wrong way round on the router's interfaces: swapped everywhere (from a forum post that called the
   provider's side "inside, where the internet comes in"), the provider port marked inside as well (the line copied onto it), or
   the staff VLAN's subinterface marked outside (the wrong line copied when it was edited). Nothing that needs translating gets
   out: the whole business, or only the staff, while everything inside still works and the router itself still reaches the
   internet (its own traffic needs no translating). The fix: every interface's role back as the records have it, saved. */
const natRoles = function (sim, saved) { const R = sim.d.rtr.sw, src = saved ? R.startup : R, out = {}; if (!src) return out; ["ifs", "subs"].forEach(function (k) { Object.keys(src[k] || {}).forEach(function (n) { if (src[k][n] && src[k][n].nat) out[n] = src[k][n].nat; }); }); return out; };
const SB06_STORY = {
  swapped: function () { return "No internet for anyone since Saturday: not us, not the guests, and the cameras can't be seen from my phone. Printing and everything inside works. My brother-in-law read on a forum that our router had NAT \"the wrong way round\" and fixed it for us on Saturday."; },
  wan: function (v) { return "Nothing here gets on the internet since this morning, staff or guests, and the camera app can't connect. Everything inside works. Last night the company that set up the " + v.deptName + " came back to change something on the router."; },
  sub: function (v) { return "The " + v.pc + " and my PC can't get on the internet since Friday, but they print fine. The " + v.deptName + "'s PCs and the guest Wi-Fi are online as normal. On Friday our nephew edited the router to rename something for the staff network."; }
};
const SB06 = {
  id: "SB-06", n: "06", level: 3, tier: "common", title: "The internet is down, but the router itself can still reach it", priority: 1, due: "1 h",
  build(seed) {
    const B = settled(seed), sim = B.sim, p = B.plan, r = rng(hash("SB-06:" + seed)), kind = r.pick(["swapped", "wan", "sub"]);
    const roles = natRoles(sim), ins = Object.keys(roles).filter(function (n) { return roles[n] === "inside"; }), sid = "GigabitEthernet0/1." + p.vlans.staff.id;
    const lines = kind === "swapped" ? ["interface GigabitEthernet0/0", "ip nat inside"].concat.apply(["interface GigabitEthernet0/0", "ip nat inside"], ins.map(function (n) { return ["interface " + n, "ip nat outside"]; }))
      : kind === "wan" ? ["interface GigabitEthernet0/0", "ip nat inside"] : ["interface " + sid, "ip nat outside"];
    onRouter(sim, ["configure terminal"].concat(lines, ["end"], SAVE));
    freeze(sim);
    return { sim: sim, v: { kind: kind, plan: p, roles: roles, sub: sid, printer: p.printerIp, pc: name(sim, "pc"), deptName: String(sim.net.roomNames.dept).toLowerCase() } };
  },
  brief(v) { return { quote: SB06_STORY[v.kind](v) }; },
  mason: "The router reaches the internet and the PCs don't. What does the router do to their traffic on the way out that it doesn't need to do to its own?",
  affected: "pc",
  options(v) {
    const sub = v.kind === "sub";
    return [
      { id: "right", right: true, text: sub ? "The staff VLAN's subinterface is marked as NAT's outside, so staff traffic is never translated" : v.kind === "wan" ? "The router's provider port is marked as NAT's inside, so nothing is translated on its way out" : "NAT's inside and outside are set the wrong way round on the router's interfaces" },
      { id: "route", text: "The router's default route is wrong", why: "show ip route has the gateway of last resort through the provider's gateway from the records, and the router itself reaches the internet: ping 8.8.8.8 from the router answers." },
      { id: "list", text: sub ? "NAT's access list no longer matches the staff network" : "NAT's access list no longer matches the business's networks", why: "show access-lists gives the NAT list a line for every inside network, as the records have it. The list says what to translate; it's never asked." },
      { id: "isp", text: "The provider's line is down", why: "The router reaches the internet itself, and the provider's gateway answers it." },
      { id: "dns", text: "DNS has stopped answering, so names don't look up", why: "Pings by address fail too: 8.8.8.8 gets no reply from a PC, while the router reaches it." },
      { id: "acl", text: sub ? "An access list on the staff subinterface is dropping traffic for the internet" : "An access list on the provider port is dropping traffic for the internet", why: "show ip interface on that interface has no access list applied" + (sub ? "" : " inbound or outbound beyond the records'") + ", and show access-lists counts no new denies." }
    ];
  },
  rung1() { return "From a PC: ping an internet address. Then on the router, from the manager's PC: ping the same address, show ip nat translations, and show running-config, each interface's lines."; },
  rung2() { return "Translation happens only on the way from an interface marked inside to one marked outside. The router's own traffic leaves from its public address and needs none, so it gets out whatever the markings say."; },
  fixHints(v) { return ["Compare each of the router's interfaces with what NAT needs: which side faces the business, which faces the provider.", v.kind === "sub" ? "Mark the interface that's on the wrong side the way the others on its side are marked." : "Mark each interface for the side it's really on: the business's interfaces one way, the provider's port the other.", "Save it, then test from a PC: the internet, and the cameras from outside."]; },
  exhibits(sim, v) { const R = natRoles(sim); return JSON.stringify(R) !== JSON.stringify(v.roles) && !online(sim, "pc") && reachesPrinter(sim, "pc", v.printer) && !!sim.route("rtr", "8.8.8.8").internet; },
  rolesRight(sim, v, saved) { const R = natRoles(sim, saved); return Object.keys(v.roles).every(function (n) { return R[n] === v.roles[n]; }) && Object.keys(R).every(function (n) { return v.roles[n] === R[n]; }); },
  fixed(sim, v) { return SB06.rolesRight(sim, v) && SB06.rolesRight(sim, v, true) && ["pc", "mgr", "dpc1"].every(function (id) { return online(sim, id); }); },
  partial(v, sim) {
    if (!SB06.rolesRight(sim, v)) return "It works for the PC you tested, but not every interface is marked as the records have it: some traffic still won't be translated.";
    if (!SB06.rolesRight(sim, v, true)) return "It works right now, but the router hasn't saved it: the next power cut or reload marks them the wrong way again.";
    return "It works right now, but not everything is back the way the records have it.";
  },
  proves(f, sim, v) { const who = v.kind === "sub" ? /^(pc|mgr|bpc)$/ : /^(pc|mgr|bpc|dpc1|dpc2)$/; return who.test(f.dev) && ((f.cmd === "ping" && !!f.internet && f.replies > 0) || (f.cmd === "tracert" && f.ok === true && !/^(10|127)\.|^192\.168\./.test(String(f.target)))); },
  proofText: "a ping or a tracert to the internet from a PC that couldn't get out",
  evidence: [
    { id: "noweb", test: function (f) { return f.cmd === "ping" && /^(pc|mgr|bpc)$/.test(f.dev) && f.ip && !/^10\.|^192\.168\./.test(f.ip) && !f.replies; }, text: function (f) { return "Ping from a staff PC to " + f.ip + ", on the internet: no reply"; } },
    { id: "inside", test: function (f, v) { return f.cmd === "ping" && /^(pc|mgr|bpc)$/.test(f.dev) && (f.who || []).indexOf("printer") >= 0 && f.replies > 0; }, text: function () { return "Ping from a staff PC to the printer, through the router: replies"; } },
    { id: "deptok", test: function (f, v) { return v.kind === "sub" && f.cmd === "ping" && /^dpc[12]$/.test(f.dev) && !!f.internet && f.replies > 0; }, text: function () { return "Ping from a department PC to the internet: replies"; } },
    { id: "rtrok", test: function (f) { return f.on === "rtr" && /Success rate is [1-9]\d* percent/.test(devOut(f)) && /ICMP Echos to (?!10\.|192\.168\.)/.test(devOut(f)); }, text: function () { return "Ping from the router itself to the internet: it answers"; } },
    { id: "xlate", test: function (f) { return f.on === "rtr" && /Pro\s+Inside global/.test(devOut(f)); }, text: function (f, v) { const L = devOut(f).split("\n").filter(function (l) { return /^(icmp|tcp|udp)\s/.test(l); }), pre = v.plan.vlans.staff.net.replace(/\.0$/, "."), staff = L.some(function (l) { return l.indexOf(" " + pre) >= 0; }); return "show ip nat translations: " + (staff ? "staff addresses translated" : "no translation for any staff address") + (L.length ? " (" + L.length + " other entr" + (L.length === 1 ? "y" : "ies") + ")" : ", nothing at all"); } },
    { id: "run", test: function (f) { const o = devOut(f); return f.on === "rtr" && /Current configuration/.test(o) && /ip nat (inside|outside)/.test(o); }, text: function (f, v) { const o = devOut(f), blk = function (n) { return ((o.split("interface " + n + "\n")[1] || "").split("!")[0]); }, role = function (n) { const m = blk(n).match(/ip nat (inside|outside)/); return m ? "ip nat " + m[1] : "no NAT role"; }; return "show running-config on the router: the provider port GigabitEthernet0/0 has " + role("GigabitEthernet0/0") + "; the staff subinterface " + v.sub + " has " + role(v.sub); } }
  ],
  summary(v) {
    const how = { swapped: "NAT's roles had been swapped on every interface and saved: the provider port marked inside, the business's interfaces outside.", wan: "The provider port had been marked ip nat inside as well and saved, leaving no outside: nothing was translated on its way out.", sub: "The staff VLAN's subinterface had been marked ip nat outside and saved: staff traffic was never translated, while the department and the guests were." }[v.kind];
    return { cause: how + " A private address the provider won't route went out untranslated, and nothing came back. The router's own traffic, from its public address, still got out.", fix: "Marked every interface as the records have it, the business's interfaces ip nat inside and the provider port ip nat outside, saved, and tested from a PC." };
  }
};

/* ---------------------------------------------------------------- SB-07 */
/* A VLAN left out of NAT: the router's NAT list (access list 1, the networks to translate) rebuilt from an older copy of the
   records, without the department's block; the guests' line "tightened" to the network's own address alone (wildcard 0.0.0.0);
   or the staff line retyped with a digit dropped. That VLAN's devices get addresses and work inside, and never reach the
   internet; the other VLANs are fine. The fix: the list matching every network it did, and nothing it didn't, saved. */
const aclKey = function (e) { return e.action + " " + (e.src ? e.src.ip + " " + e.src.wild : "any"); };
const natList = function (sim, saved) { const r = sim.d.rtr.sw, A = saved ? r.startup && r.startup.acls : r.acls, L = A && A["1"]; return L ? L.lines.filter(function (e) { return !e.remark; }).map(aclKey) : []; };
const SB07_KIND = { dept: { key: "dept", dev: "dpc1" }, guest: { key: "guest", dev: "guest" }, staff: { key: "staff", dev: "pc" } };
const SB07_STORY = {
  dept: function (v) { return "The " + v.deptName + "'s PCs can't get on the internet since Monday, though they print and the manager reaches them. Everyone else is online. Over the weekend our nephew put the router's settings back in order from the notes in our records folder."; },
  guest: function () { return "Customers say the guest Wi-Fi connects but nothing loads. Our own PCs are all fine. On Saturday I tightened the guests' settings on the router from the card processor's checklist."; },
  staff: function (v) { return "The " + v.pc + ", my PC and the " + v.backPc + " can't get on the internet since Friday; they print and see each other fine. The guests and the " + v.deptName + " are online. On Friday the router's NAT list was retyped after a mistake, from the records."; }
};
const SB07 = {
  id: "SB-07", n: "07", level: 3, tier: "common", title: "One group of devices can't reach the internet; the others can", priority: 2, due: "2 h",
  build(seed) {
    const B = settled(seed), sim = B.sim, p = B.plan, r = rng(hash("SB-07:" + seed)), kind = r.pick(["dept", "guest", "staff"]), V = p.vlans[SB07_KIND[kind].key];
    const lines = sim.d.rtr.sw.acls["1"].lines.map(function (e) { return { ip: e.src.ip, wild: e.src.wild }; }), before = natList(sim);
    const wild = V.len ? ["0.0.0.127", "0.0.0.63", "0.0.0.31", "0.0.0.15", "0.0.0.7"][V.len - 25] : "0.0.0.255";
    const typo = function (net) { const o = net.split("."); o[2] = o[2].length > 1 ? o[2].slice(0, -1) : o[2] + o[2]; return o.join("."); };   /* a digit dropped: 20 becomes 2 */
    const now = lines.filter(function (e) { return e.ip !== V.net; }).concat(kind === "dept" ? [] : [{ ip: kind === "guest" ? V.net : typo(V.net), wild: kind === "guest" ? "0.0.0.0" : wild }]);
    onRouter(sim, ["configure terminal", "no access-list 1"].concat(now.map(function (e) { return "access-list 1 permit " + e.ip + " " + e.wild; }), ["end"], SAVE));
    if (kind === "guest") { sim.apply({ t: "radio", dev: "guest", on: false }); sim.apply({ t: "radio", dev: "guest", on: true }); }
    freeze(sim);
    return { sim: sim, v: { kind: kind, plan: p, net: V.net, wild: wild, before: before, dev: SB07_KIND[kind].dev, printer: p.printerIp, pc: name(sim, "pc"), backPc: name(sim, "bpc"), deptName: String(sim.net.roomNames.dept).toLowerCase() } };
  },
  brief(v) { return { quote: SB07_STORY[v.kind](v) }; },
  mason: "The same router, the same way out, and one group can't use it. What does the router decide about each group's traffic on the way out?",
  affected(v) { return v.dev; },
  options(v) {
    const what = { dept: v.deptName + "'s", guest: "guests'", staff: "staff" }[v.kind];
    return [
      { id: "right", right: true, text: "NAT's access list no longer matches the " + what + " network, so that VLAN's traffic is never translated" },
      { id: "role", text: "The " + what + " subinterface is marked as NAT's outside", why: "show running-config marks that subinterface ip nat inside, as the business's other subinterfaces are." },
      { id: "route", text: "The router's default route is wrong", why: "The other VLANs reach the internet through the same router and the same default route." },
      { id: "gw", text: "The " + what + " pool hands out the wrong default gateway", why: (v.kind === "guest" ? "The visitor's phone" : "Their PCs") + " reach the printer through the router, so the gateway they were given works." },
      { id: "acl", text: "An access list on the " + what + " subinterface drops traffic for the internet", why: "show access-lists counts no new denies for that VLAN, and the printer is reached through the same subinterface." },
      { id: "dns", text: "The " + what + " devices can't look names up", why: "Pings by address fail too: 8.8.8.8 gets no reply from that VLAN, and gets one from the others." }
    ];
  },
  rung1() { return "From a device that can't get out and one that can, ping the internet. Then on the router, from the manager's PC: show access-lists, the list NAT uses, and hold each line up against the records' VLAN plan."; },
  rung2() { return "NAT translates only what its access list permits. A network the list doesn't match leaves untranslated with its private address, which the provider won't route, so nothing comes back. A wildcard says which bits must match: 0 bits match, 1 bits don't care."; },
  fixHints(v) { return ["Find the line in the list NAT uses that should match that VLAN's network, or find that there isn't one.", "Make the list match that network as the records give it, network and wildcard, and take out a line that matches nothing of the business's.", "Save it, then test from a device in that VLAN" + (v.kind === "guest" ? ": the visitor's phone joins again." : ".")]; },
  exhibits(sim, v) { const ok = function (id) { return id === "guest" ? online(sim, "guest") : online(sim, id); }; return natList(sim).join("|") !== v.before.join("|") && !ok(v.dev) && ["pc", "dpc1", "guest"].filter(function (id) { return id !== v.dev; }).every(ok) && (v.kind === "guest" || reachesPrinter(sim, v.dev, v.printer)); },
  listRight(sim, v, saved) { const L = natList(sim, saved).slice().sort().join("|"); return L === v.before.slice().sort().join("|"); },
  fixed(sim, v) { return SB07.listRight(sim, v) && SB07.listRight(sim, v, true) && ["pc", "mgr", "dpc1", "guest"].every(function (id) { return online(sim, id); }); },
  partial(v, sim) {
    const L = natList(sim);
    if (v.before.every(function (k) { return L.indexOf(k) >= 0; }) && L.length > v.before.length) return "It works, but the list still has a line that matches nothing of the business's. The records have it matching each network once; the next technician will wonder what it's for.";
    if (!SB07.listRight(sim, v, true)) return "It works right now, but the router hasn't saved it: the next power cut or reload leaves that VLAN out again.";
    return "It works right now, but NAT's list isn't the way the records have it.";
  },
  proves(f, sim, v) {
    if (v.kind === "guest") return ((f.join || f.radio) && f.dev === "guest" && !!f.internet) || (f.page === "guest-wifi" && !!f.internet);
    const who = v.kind === "dept" ? /^dpc[12]$/ : /^(pc|mgr|bpc)$/;
    return who.test(f.dev) && ((f.cmd === "ping" && !!f.internet && f.replies > 0) || (f.cmd === "tracert" && f.ok === true && !/^(10|127)\.|^192\.168\./.test(String(f.target))));
  },
  proofText: "a device in the VLAN that couldn't get out reaching the internet",
  evidence: [
    { id: "noweb", test: function (f, v) { const who = v.kind === "dept" ? /^dpc[12]$/ : /^(pc|mgr|bpc)$/; return v.kind !== "guest" && f.cmd === "ping" && who.test(f.dev) && f.ip && !/^10\.|^192\.168\./.test(f.ip) && !f.replies; }, text: function (f) { return "Ping from a PC in that VLAN to " + f.ip + ", on the internet: no reply"; } },
    { id: "phone", test: function (f, v) { return v.kind === "guest" && f.page === "guest-wifi" && f.connected && !f.internet; }, text: function () { return "The visitor's phone: connected, an address from the guests' pool, no internet"; } },
    { id: "others", test: function (f, v) { const who = v.kind === "dept" ? /^(pc|mgr|bpc)$/ : /^dpc[12]$/; return f.cmd === "ping" && who.test(f.dev) && !!f.internet && f.replies > 0; }, text: function () { return "Ping from a PC in another VLAN to the internet: replies"; } },
    { id: "inside", test: function (f, v) { return v.kind !== "guest" && f.cmd === "ping" && (f.who || []).indexOf("printer") >= 0 && f.replies > 0 && f.dev === v.dev; }, text: function () { return "Ping from a PC in that VLAN to the printer, through the router: replies"; } },
    { id: "list", test: function (f) { return f.on === "rtr" && /Standard IP access list 1\n/.test(devOut(f)); }, text: function (f) { const b = devOut(f).split("Standard IP access list 1\n")[1].split(/\n(?=\S)/)[0].split("\n").map(function (l) { return l.trim().replace(/^\d+\s+/, ""); }).filter(Boolean); return "show access-lists on the router: list 1, the one NAT uses: " + b.join("; "); } }
  ],
  summary(v) {
    const how = { dept: "NAT's list had been rebuilt from an older copy of the records, from before the department, without its block, and saved.", guest: "The guests' line in NAT's list had been tightened to the network's own address alone (wildcard 0.0.0.0, one address), and saved: no guest's address matched it.", staff: "The staff line in NAT's list had been retyped with a digit dropped, matching a network the business doesn't have, and saved." }[v.kind];
    return { cause: how + " That VLAN's traffic left untranslated, with private addresses the provider won't route, and nothing came back. Inside, everything still worked.", fix: "Made access list 1 match " + v.net + " " + v.wild + " as the records give it" + (v.kind === "dept" ? "" : ", took the wrong line out") + ", saved, and tested from a device in that VLAN." };
  }
};

/* ---------------------------------------------------------------- SB-08 */
/* A native VLAN mismatch on the trunk between the closet switch (gi0/23) and the back switch (gi0/24): one end's native VLAN
   changed from the records' unused one to a VLAN in use. That end sends that VLAN untagged; the far end puts untagged frames in
   its own native VLAN, so the VLAN goes dark in the back room: the back switch's end set to the staff VLAN ("so the back PC's
   network is the main one"), the closet's end set to the staff VLAN, or the closet's end set to the department's. The other
   VLANs on the trunk, still tagged, carry on. Both switches log the mismatch on their consoles; the back switch's is the one your
   laptop is on. The fix: the changed end's native VLAN back to the records', saved. Matching the other end to it instead works,
   and carries a VLAN in use untagged, which the records forbid. */
const nativeOf = function (sim, id, port, saved) { const sw = sim.d[id].sw, P = saved ? sw.startup && sw.startup.ports && sw.startup.ports[port] : sw.ports[port]; return P ? P.native : null; };
const SB08_KIND = { "staff-back": { end: "bsw", key: "staff", devs: ["bpc"] }, "staff-closet": { end: "msw", key: "staff", devs: ["bpc"] }, "dept-closet": { end: "msw", key: "dept", devs: ["dpc1", "dpc2"] } };
const TRUNK = { msw: "GigabitEthernet0/23", bsw: "GigabitEthernet0/24" };
const SB08_STORY = {
  "staff-back": function (v) { return "The " + v.names[0] + " has had no network since Tuesday. The " + v.deptName + "'s PCs right beside it are fine. On Tuesday the PC supplier's technician was here and set the back switch up, he said, \"so the back PC's network is the main one on the link\"."; },
  "staff-closet": function (v) { return "The " + v.names[0] + " lost the network this morning; everything out front and the " + v.deptName + " are fine. Last night our nephew worked on the closet switch's link to the back room, \"making the staff network the default on it\"."; },
  "dept-closet": function (v) { return "The " + v.deptName + "'s two PCs have no network since yesterday afternoon. Everyone else, the back room's PC included, is fine. Yesterday the company that set up the " + v.deptName + " changed something on the closet switch's link to the back room, \"to make their network the default\"."; }
};
const SB08 = {
  id: "SB-08", n: "08", level: 3, tier: "harder", title: "The back room's link carries everything but one network", priority: 2, due: "2 h",
  build(seed) {
    const B = settled(seed), sim = B.sim, p = B.plan, r = rng(hash("SB-08:" + seed)), kind = r.pick(["staff-back", "staff-closet", "dept-closet"]), K = SB08_KIND[kind], V = p.vlans[K.key];
    onSwitch(sim, K.end, ["configure terminal", "interface " + TRUNK[K.end].replace("GigabitEthernet", "gi"), "switchport trunk native vlan " + V.id, "end"].concat(SAVE));
    K.devs.forEach(function (id) { exec(sim, id, "ipconfig /renew"); });
    freeze(sim);
    return { sim: sim, v: { kind: kind, plan: p, end: K.end, far: K.end === "msw" ? "bsw" : "msw", native: p.vlans.native.id, vlan: V.id, devs: K.devs, printer: p.printerIp, names: K.devs.map(function (id) { return name(sim, id); }), deptName: String(sim.net.roomNames.dept).toLowerCase(), endName: name(sim, K.end) } };
  },
  brief(v) { return { quote: SB08_STORY[v.kind](v) }; },
  mason: "A trunk has two ends, and each end has its own idea of what an untagged frame belongs to. Ask both.",
  affected(v) { return v.devs[0]; },
  options(v) {
    const what = v.kind === "dept-closet" ? "the " + v.deptName + "'s" : "the staff";
    return [
      { id: "right", right: true, text: "The two ends of the trunk between the switches disagree on the native VLAN" },
      { id: "allowed", text: "The trunk no longer allows " + what + " VLAN", why: "show interfaces trunk lists it among the VLANs allowed at both ends, and active." },
      { id: "deleted", text: what.charAt(0).toUpperCase() + what.slice(1) + " VLAN has been deleted from the back switch", why: "show vlan brief on the back switch lists it, active, with its ports." },
      { id: "dtp", text: "The trunk has stopped trunking and fallen back to an access port", why: "show interfaces trunk shows both ends trunking, mode on, and the other VLANs still cross it tagged." },
      { id: "port", text: v.kind === "dept-closet" ? "The " + v.deptName + "'s PCs' ports have been moved to another VLAN" : "The " + v.names[0] + "'s port has been moved to another VLAN", why: "show interfaces switchport on the back switch gives each port the VLAN the records have for it." },
      { id: "pool", text: "The router's pool for " + what + " VLAN has run out", why: "Devices in that VLAN out front renew from the same pool at once" + (v.kind === "dept-closet" ? ": the department's are the only ones, and show ip dhcp pool has addresses free." : ".") }
    ];
  },
  rung1() { return "On the back switch, at your laptop's console: what it logs as the console wakes, and show interfaces trunk. Then the closet switch's show interfaces trunk, from the manager's PC, and hold both ends against the records."; },
  rung2() { return "On a trunk, every VLAN but one crosses tagged. The native VLAN crosses untagged, and each end puts what arrives untagged into its own native VLAN. If the two ends' natives differ, a VLAN sent untagged from one end lands in another VLAN at the other."; },
  fixHints() { return ["Both ends of that trunk should have the native VLAN the records give the trunks. Find the end that doesn't.", "Put that end back as the records have it. Matching the other end to it would carry a VLAN in use untagged.", "Save that switch, then have whatever lost its network ask again."]; },
  exhibits(sim, v) { return nativeOf(sim, v.end, TRUNK[v.end]) === v.vlan && nativeOf(sim, v.far, TRUNK[v.far]) === v.native && v.devs.every(function (id) { return !online(sim, id); }) && online(sim, "pc"); },
  nativesRight(sim, v, saved) { return nativeOf(sim, "msw", TRUNK.msw, saved) === v.native && nativeOf(sim, "bsw", TRUNK.bsw, saved) === v.native; },
  fixed(sim, v) { return SB08.nativesRight(sim, v) && SB08.nativesRight(sim, v, true) && v.devs.every(function (id) { return online(sim, id); }) && ["pc", "bpc", "dpc1"].every(function (id) { return online(sim, id); }); },
  partial(v, sim) {
    const a = nativeOf(sim, "msw", TRUNK.msw), b = nativeOf(sim, "bsw", TRUNK.bsw);
    if (a === b && a !== v.native) return "It works, but both ends now carry VLAN " + a + ", a VLAN in use, untagged. The records keep the trunks' native VLAN unused (" + v.native + "), so nothing in use rides a trunk untagged: that's what VLAN hopping feeds on.";
    if (!SB08.nativesRight(sim, v, true)) return "It works right now, but the switch hasn't saved it: the next power cut or reload puts the mismatch back.";
    return "It works right now, but the trunk isn't the way the records have it.";
  },
  proves(f, sim, v) { return f.cmd === "ping" && v.devs.indexOf(f.dev) >= 0 && f.replies > 0 && (f.internet || (f.who || []).indexOf("printer") >= 0); },
  proofText: "a PC that lost its network reaching the printer or the internet",
  evidence: [
    { id: "apipa", test: function (f, v) { return f.cmd === "ipconfig" && v.devs.indexOf(f.dev) >= 0 && f.apipa; }, text: function (f, v, sim) { return "ipconfig on the " + name(sim, f.dev) + ": " + f.ip + " (169.254: no DHCP server answered)"; } },
    { id: "log", test: function (f) { return /NATIVE_VLAN_MISMATCH/.test(devOut(f)); }, text: function (f) { const m = devOut(f).match(/Native VLAN mismatch discovered on (\S+) \((\d+)\), with (\S+) (\S+) \((\d+)\)/); return m ? "The console logs a native VLAN mismatch: " + m[1] + " (native " + m[2] + ") against " + m[3] + " " + m[4] + " (native " + m[5] + ")" : "The console logs a native VLAN mismatch"; } },
    { id: "trunkb", test: function (f) { return f.on === "bsw" && /Native vlan/.test(devOut(f)) && /Gi0\/24\s+on\s+802\.1q\s+trunking\s+\d+/.test(devOut(f)); }, text: function (f) { const m = devOut(f).match(/Gi0\/24\s+on\s+802\.1q\s+trunking\s+(\d+)/); return "show interfaces trunk on the back switch: Gi0/24's native VLAN is " + (m ? m[1] : "?"); } },
    { id: "trunkc", test: function (f) { return f.on === "msw" && /Native vlan/.test(devOut(f)) && /Gi0\/23\s+on\s+802\.1q\s+trunking\s+\d+/.test(devOut(f)); }, text: function (f) { const m = devOut(f).match(/Gi0\/23\s+on\s+802\.1q\s+trunking\s+(\d+)/); return "show interfaces trunk on the closet switch: Gi0/23's native VLAN is " + (m ? m[1] : "?"); } },
    { id: "others", test: function (f, v) { const ok = v.kind === "dept-closet" ? /^bpc$/ : /^dpc[12]$/; return f.cmd === "ping" && ok.test(f.dev) && f.replies > 0 && (f.internet || (f.who || []).indexOf("printer") >= 0); }, text: function (f, v, sim) { return "Ping from the " + name(sim, f.dev) + ", on the same back switch over the same trunk: replies"; } }
  ],
  summary(v) {
    const how = { "staff-back": "The back switch's end of the trunk had been given the staff VLAN as its native VLAN, and saved, while the closet's end kept the records' unused one.", "staff-closet": "The closet switch's end of the trunk had been given the staff VLAN as its native VLAN, and saved, while the back switch's end kept the records' unused one.", "dept-closet": "The closet switch's end of the trunk had been given the department's VLAN as its native VLAN, and saved." }[v.kind];
    return { cause: how + " That end sent the VLAN untagged, and the far end put untagged frames into its own native VLAN, so the VLAN went dark beyond the trunk. Every other VLAN, still tagged, crossed as before. Both switches logged the mismatch.", fix: "Set the " + v.endName + "'s end back to native VLAN " + v.native + ", as the records have the trunks, saved, and had the PCs ask for their addresses again." };
  }
};

/* ---------------------------------------------------------------- SB-09 */
/* The trunk between the closet switch and the back switch never forms: both ends put back to negotiate (dynamic auto, "the
   factory setting", and two ends that only answer never trunk), the closet's end made an access port (a desk's settings pasted
   onto the wrong port), or the back switch's end made one. Everything on the back switch goes dark at once, every VLAN: the back
   PC, the department's two PCs, the back door camera. The fix: both ends set to trunk, as the records have them, saved. An end
   left negotiating (dynamic desirable) makes the trunk form, and isn't the records' way. */
const modeOf = function (sim, id, port, saved) { const sw = sim.d[id].sw, P = saved ? sw.startup && sw.startup.ports && sw.startup.ports[port] : sw.ports[port]; return P ? P.mode : null; };
const SB09_STORY = {
  "auto-auto": function (v) { return "Nothing in the " + v.back + " or the " + v.deptName + " has had a network since Saturday: the PCs, and the back door camera too. Out front everything works. On Saturday our nephew put \"the link between the two switches back to its factory setting\" at both ends, because he'd read it fixes slow links."; },
  "access-closet": function (v) { return "Since this morning everything past the " + v.back + " door is off the network: the " + v.backPc + ", the " + v.deptName + "'s PCs and the back door camera. Last night someone set up a port on the closet switch for a new desk, copying the settings from the " + v.pc + "'s port."; },
  "access-back": function (v) { return "The " + v.backPc + ", the " + v.deptName + "'s PCs and the back door camera all went off the network yesterday afternoon. The PCs out front are fine. Yesterday the PC supplier's technician was at the back switch with his laptop, setting up \"the PC ports\"."; }
};
const SB09 = {
  id: "SB-09", n: "09", level: 3, tier: "harder", title: "Everything in the back room is off the network at once", priority: 1, due: "1 h",
  build(seed) {
    const B = settled(seed), sim = B.sim, p = B.plan, r = rng(hash("SB-09:" + seed)), kind = r.pick(["auto-auto", "access-closet", "access-back"]);
    if (kind !== "access-back") onSwitch(sim, "msw", ["configure terminal", "interface gi0/23", kind === "auto-auto" ? "switchport mode dynamic auto" : "switchport mode access", "end"].concat(SAVE));
    if (kind !== "access-closet") onSwitch(sim, "bsw", ["configure terminal", "interface gi0/24", kind === "auto-auto" ? "switchport mode dynamic auto" : "switchport mode access", "end"].concat(SAVE));
    ["bpc", "dpc1", "dpc2"].forEach(function (id) { exec(sim, id, "ipconfig /renew"); });
    freeze(sim);
    return { sim: sim, v: { kind: kind, plan: p, printer: p.printerIp, pc: name(sim, "pc"), backPc: name(sim, "bpc"), back: String(sim.net.roomNames.back).toLowerCase(), deptName: String(sim.net.roomNames.dept).toLowerCase() } };
  },
  brief(v) { return { quote: SB09_STORY[v.kind](v) }; },
  mason: "Everything behind one switch stopped together. Before you look at any one device, look at the one link they all share, from both ends.",
  affected: "bpc",
  options(v) {
    return [
      { id: "right", right: true, text: "The link between the closet switch and the back switch is no longer a trunk" },
      { id: "bsw", text: "The back switch has failed", why: "It answers at its console, its port lights are on, and show interfaces status lists its PCs' ports connected." },
      { id: "cable", text: "The cable between the two switches is faulty", why: "show interfaces status gives both ends connected, 1000 Mb/s, full duplex, with no errors counted." },
      { id: "allowed", text: "The trunk's allowed list no longer carries the back room's VLANs", why: "The allowed list in the running configuration is as the records have it, and it's every VLAN that's gone, not one." },
      { id: "deleted", text: "The back room's VLANs have been deleted from the back switch", why: "show vlan brief on the back switch lists every one of them, active, with their ports." },
      { id: "native", text: "The two ends of the link disagree on the native VLAN", why: "A native mismatch darkens one VLAN and logs itself on the console. Here every VLAN is gone, and the native VLANs in the configuration match." }
    ];
  },
  rung1() { return "On both switches: show interfaces trunk, and show interfaces switchport on the link's port at each end: its administrative mode and its operational mode. The closet switch from the manager's PC; the back switch at your laptop's console."; },
  rung2() { return "A link carries many VLANs only while it's a trunk. Each end's mode decides it: set to trunk, it trunks; set to access, it never does; left to negotiate, it trunks only if the far end asks, and two ends that only answer (dynamic auto) never ask."; },
  fixHints() { return ["Read each end's administrative and operational modes: which end isn't set the way the records have the trunk?", "Set every end that isn't, at both switches if need be, to be a trunk outright, not left to negotiate. Its allowed list and native VLAN are still in its configuration.", "Save each switch you changed, then have the PCs in the back room ask again."]; },
  exhibits(sim, v) { return !(modeOf(sim, "msw", "GigabitEthernet0/23") === "trunk" && modeOf(sim, "bsw", "GigabitEthernet0/24") === "trunk") && ["bpc", "dpc1"].every(function (id) { return !online(sim, id); }) && online(sim, "pc"); },
  modesRight(sim, saved) { return modeOf(sim, "msw", "GigabitEthernet0/23", saved) === "trunk" && modeOf(sim, "bsw", "GigabitEthernet0/24", saved) === "trunk"; },
  fixed(sim, v) { return SB09.modesRight(sim) && SB09.modesRight(sim, true) && ["bpc", "dpc1", "dpc2", "pc"].every(function (id) { return online(sim, id); }); },
  partial(v, sim) {
    if (!SB09.modesRight(sim)) return "It works, but an end of the link is still negotiating: the records set both ends to trunk outright. A port left to negotiate can be talked into trunking by whatever is plugged into it.";
    if (!SB09.modesRight(sim, true)) return "It works right now, but a switch hasn't saved it: the next power cut or reload takes the trunk down again.";
    return "It works right now, but the link isn't the way the records have it.";
  },
  proves(f) { return f.cmd === "ping" && /^(bpc|dpc1|dpc2)$/.test(f.dev) && f.replies > 0 && (f.internet || (f.who || []).indexOf("printer") >= 0); },
  proofText: "a PC in the back room reaching the printer or the internet",
  evidence: [
    { id: "apipa", test: function (f) { return f.cmd === "ipconfig" && /^(bpc|dpc1|dpc2)$/.test(f.dev) && f.apipa; }, text: function (f, v, sim) { return "ipconfig on the " + name(sim, f.dev) + ": " + f.ip + " (169.254: no DHCP server answered)"; } },
    { id: "trunk", test: function (f) { return (f.on === "msw" || f.on === "bsw") && /Native vlan/.test(devOut(f)) && !new RegExp(f.on === "msw" ? "Gi0/23\\s" : "Gi0/24\\s").test(devOut(f).split("Vlans allowed on trunk")[0]); }, text: function (f, v, sim) { return "show interfaces trunk on the " + name(sim, f.on) + ": " + (f.on === "msw" ? "Gi0/23" : "Gi0/24") + ", the link to the other switch, isn't trunking"; } },
    { id: "mode", test: function (f) { return (f.on === "msw" || f.on === "bsw") && /Administrative Mode: .*\nOperational Mode: static access/.test(devOut(f)) && new RegExp("^Name: " + (f.on === "msw" ? "Gi0/23" : "Gi0/24") + "$", "m").test(devOut(f)); }, text: function (f, v, sim) { const m = devOut(f).match(/Administrative Mode: (.*)\nOperational Mode: (.*)/); return "show interfaces switchport on the " + name(sim, f.on) + "'s end of the link: administrative mode " + (m ? m[1] : "?") + ", operational mode " + (m ? m[2] : "?"); } },
    { id: "status", test: function (f) { return (f.on === "msw" || f.on === "bsw") && new RegExp("^" + (f.on === "msw" ? "Gi0/23" : "Gi0/24") + "\\s+\\S+\\s+connected\\s+\\d+\\s", "m").test(devOut(f)); }, text: function (f, v, sim) { const m = devOut(f).match(new RegExp("^" + (f.on === "msw" ? "Gi0/23" : "Gi0/24") + "\\s+\\S+\\s+connected\\s+(\\d+)\\s", "m")); return "show interfaces status on the " + name(sim, f.on) + ": the link's port is connected, in VLAN " + (m ? m[1] : "?") + ", not trunk"; } }
  ],
  summary(v) {
    const how = { "auto-auto": "Both ends of the link had been put back to dynamic auto and saved. An end on dynamic auto trunks only when the far end asks, and neither asked, so the link came up as an access port in VLAN 1.", "access-closet": "The closet switch's end of the link had been made an access port, from a desk's settings, and saved.", "access-back": "The back switch's end of the link had been made an access port and saved." }[v.kind];
    return { cause: how + " With no trunk, none of the back room's VLANs crossed it: everything on the back switch lost the network together.", fix: "Set " + (v.kind === "auto-auto" ? "both ends" : v.kind === "access-closet" ? "the closet switch's end" : "the back switch's end") + " to switchport mode trunk, as the records have them, saved, and had the back room's PCs ask for their addresses again." };
  }
};

/* ---------------------------------------------------------------- SB-10 */
/* A router subinterface tagged for the wrong VLAN: the printers' subinterface given a tag a digit off (nobody prints, everything
   else works), the guests' one likewise (visitors join and get no address), or the department's and the guests' typed back in
   from notes with each other's tags (the department's PCs get guests' addresses and can't print; a visitor's phone gets an
   address in the department's block). The address on each subinterface is right; the tag decides which VLAN hears it. The
   staff VLAN is never the one: with its subinterface gone, no PC could reach the router to fix it (its remote lines take only
   the staff VLAN, and its console is in the locked cabinet). The fix: the tag back, and the address with it (a new tag clears
   a subinterface's address), saved; whatever lost its network asks again. */
const subsOf = function (sim, saved) { const R = sim.d.rtr.sw, src = saved ? R.startup && R.startup.subs : R.subs, out = {}; Object.keys(src || {}).forEach(function (n) { const f = src[n]; out[n] = { vlan: f.vlan, native: !!f.native, ip: f.ip, mask: f.mask }; }); return out; };
const subFor = function (sim, id) { const R = sim.d.rtr.sw; return Object.keys(R.subs).find(function (n) { return R.subs[n].vlan === id; }); };
const SB10_STORY = {
  printers: function (v) { return "Nobody can print since this morning: not the " + v.pc + ", not my PC, not the " + v.deptName + ". Everything else works, the internet too, and the printer says Ready. Last night our nephew, who's learning networking, went through the router \"to see how its VLANs are set up\", and retyped a couple of lines to check he understood them."; },
  guest: function () { return "Customers say the guest Wi-Fi takes the password and then never connects. Our own computers are all fine, and the access point's light is blue. On Sunday a friend of my brother's looked at the router's guest settings, \"just reading them\", he said."; },
  swap: function (v) { return "The " + v.deptName + "'s two PCs restarted this morning: they get online, but they can't print. Everyone else is fine. Late on Friday the company that set up the " + v.deptName + " wiped part of the router's setup by mistake, the " + v.deptName + "'s and the guest Wi-Fi's, and typed both back in from their notes."; }
};
const SB10 = {
  id: "SB-10", n: "10", level: 3, tier: "harder", title: "One part of the business lost its way through the router", priority: 2, due: "2 h",
  build(seed) {
    const B = settled(seed), sim = B.sim, p = B.plan, V = p.vlans, r = rng(hash("SB-10:" + seed)), kind = r.pick(["printers", "guest", "swap"]), before = subsOf(sim);
    const used = Object.keys(V).map(function (k) { return V[k].id; }).concat([1]);
    let wrong = null, sub = null, ds = null, gs = null;
    if (kind === "swap") {
      ds = subFor(sim, V.dept.id); gs = subFor(sim, V.guest.id); const dm = sim.d.rtr.sw.subs[ds].mask, gm = sim.d.rtr.sw.subs[gs].mask;
      onRouter(sim, ["configure terminal", "interface " + gs, "no encapsulation dot1Q", "interface " + ds, "encapsulation dot1Q " + V.guest.id, "ip address " + V.dept.gw + " " + dm,
        "interface " + gs, "encapsulation dot1Q " + V.dept.id, "ip address " + V.guest.gw + " " + gm, "end"].concat(SAVE));
      ["dpc1", "dpc2"].forEach(function (id) { exec(sim, id, "ipconfig /renew"); });   /* their weekly restart: they asked again */
    } else {
      const X = V[kind], id = X.id, cands = [id * 10, Math.floor(id / 10), Number(String(id).split("").reverse().join(""))].filter(function (n) { return n >= 2 && n <= 4094 && n !== id && used.indexOf(n) < 0; });
      wrong = r.pick(cands); sub = subFor(sim, id);
      onRouter(sim, ["configure terminal", "interface " + sub, "encapsulation dot1Q " + wrong, "ip address " + X.gw + " " + sim.d.rtr.sw.subs[sub].mask, "end"].concat(SAVE));   /* a new tag clears the address: typed again after it */
    }
    if (kind !== "printers") { sim.apply({ t: "radio", dev: "guest", on: false }); sim.apply({ t: "radio", dev: "guest", on: true }); }   /* a visitor's phone joining since */
    freeze(sim);
    return { sim: sim, v: { kind: kind, plan: p, before: before, sub: sub, wrong: wrong, vlan: kind === "swap" ? null : V[kind].id, ds: ds, gs: gs,
      printer: p.printerIp, pc: name(sim, "pc"), deptName: String(sim.net.roomNames.dept).toLowerCase() } };
  },
  brief(v) { return { quote: SB10_STORY[v.kind](v) }; },
  mason: "When one VLAN can't get past the router and the switches carry it the whole way, follow its frames to the very end of the trunk: where on the router do they land?",
  affected(v) { return v.kind === "guest" ? "guest" : v.kind === "swap" ? "dpc1" : "pc"; },
  options(v) {
    const what = { printers: "printers'", guest: "guests'", swap: v.deptName + "'s" }[v.kind];
    return [
      { id: "right", right: true, text: v.kind === "swap" ? "The router's subinterfaces for the " + v.deptName + " and the guests are tagged for each other's VLANs" : "The router's subinterface for the " + what + " VLAN is tagged for the wrong VLAN" },
      { id: "trunk", text: "The trunk to the router no longer carries the " + what + " VLAN", why: "show interfaces trunk on the closet switch lists it on the router's port, allowed and active." },
      { id: "deleted", text: "The " + what + " VLAN has been deleted from the switches", why: "show vlan brief lists it, active, and its ports aren't inactive." },
      { id: "shut", text: "The router's subinterface for the " + what + " VLAN has been shut down", why: "show ip interface brief on the router has every subinterface up and up." },
      { id: "addr", text: "The router's address on the " + what + " VLAN has been changed", why: "show ip interface brief gives every subinterface the address the records give its network." },
      v.kind === "printers" ? { id: "printer", text: "The printer's fixed address has been changed", why: "The printer's own panel gives the address the records have for it, and every PC prints to that address." }
        : v.kind === "guest" ? { id: "pw", text: "The guest Wi-Fi's password has been changed", why: "The phone is let on to the guest network and asks for an address: a wrong password is refused before that, and the phone says so." }
          : { id: "ap", text: "The access point now puts the guest Wi-Fi on the " + v.deptName + "'s VLAN", why: "The access point's own page tags the guest network with the VLAN the records give the guests." }
    ];
  },
  rung1(v) { return (v.kind === "guest" ? "On the visitor's phone: its Wi-Fi page." : v.kind === "swap" ? "On a " + v.deptName + " PC: ipconfig, and on the visitor's phone its Wi-Fi page: whose networks are those addresses on?" : "On a PC: a ping to the printer.") + " Then on the router, from the manager's PC: show ip interface brief and show running-config, and hold every subinterface up against the records' VLAN plan."; },
  rung2() { return "A subinterface hears only the frames tagged with the VLAN it's set for. With the wrong tag its address and its pool can be exactly right, and nothing on its own VLAN reaches them; whatever is on the VLAN it's tagged for gets them instead."; },
  fixHints(v) { return ["Compare the VLAN each of the router's subinterfaces is tagged for with the VLAN the records give its network.", "Tag it for its own VLAN again. The router clears a subinterface's address when its tag changes, so give it back the address the records have" + (v.kind === "swap" ? "; and a tag can't go on one subinterface while the other still has it, so free it first." : "."), "Save it, then have whatever lost its network ask again" + (v.kind === "guest" ? ": the visitor's phone joins again." : v.kind === "swap" ? ": the " + v.deptName + "'s PCs and the visitor's phone each keep what they were given until they ask." : ".")]; },
  exhibits(sim, v) {
    const S = subsOf(sim), V = v.plan.vlans;
    if (Object.keys(v.before).every(function (n) { return S[n] && S[n].vlan === v.before[n].vlan; })) return false;
    if (v.kind === "printers") return !reachesPrinter(sim, "pc", v.printer) && online(sim, "pc") && online(sim, "mgr");
    const g = sim.addr("guest");
    if (v.kind === "guest") return !!g && g.kind === "apipa" && online(sim, "pc");
    const d = sim.addr("dpc1"); return !!d && d.kind === "dhcp" && inNet(d.ip, V.guest.net, 24) && !reachesPrinter(sim, "dpc1", v.printer) && !!g && g.kind === "dhcp" && inNet(g.ip, V.dept.net, V.dept.len) && online(sim, "mgr");
  },
  subsRight(sim, v, saved) { const S = subsOf(sim, saved); return Object.keys(v.before).every(function (n) { const a = S[n], b = v.before[n]; return !!a && a.vlan === b.vlan && a.native === b.native && a.ip === b.ip && a.mask === b.mask; }); },
  works(sim, v) {
    const V = v.plan.vlans;
    if (v.kind === "printers") return ["pc", "mgr", "bpc", "dpc1"].every(function (id) { return reachesPrinter(sim, id, v.printer); });
    const g = sim.addr("guest"), gOk = !!g && g.kind === "dhcp" && inNet(g.ip, V.guest.net, 24) && online(sim, "guest");
    if (v.kind === "guest") return gOk;
    return gOk && ["dpc1", "dpc2"].every(function (id) { const a = sim.addr(id); return !!a && a.kind === "dhcp" && inNet(a.ip, V.dept.net, V.dept.len) && online(sim, id) && reachesPrinter(sim, id, v.printer); });
  },
  fixed(sim, v) { return SB10.subsRight(sim, v) && SB10.subsRight(sim, v, true) && SB10.works(sim, v) && online(sim, "pc") && online(sim, "mgr"); },
  partial(v, sim) {
    const V = v.plan.vlans;
    if (SB10.subsRight(sim, v) && !SB10.subsRight(sim, v, true)) return "It works right now, but the router hasn't saved it: the next power cut or reload puts the wrong tag back.";
    if (v.kind === "swap") {
      const g = sim.addr("guest"); if (SB10.subsRight(sim, v) && !(g && g.kind === "dhcp" && inNet(g.ip, V.guest.net, 24))) return "The " + v.deptName + " works, but the visitor's phone still has the address it was given from the " + v.deptName + "'s block: it keeps it until it joins again.";
      if (SB10.subsRight(sim, v) && ["dpc1", "dpc2"].some(function (id) { const a = sim.addr(id); return !(a && a.kind === "dhcp" && inNet(a.ip, V.dept.net, V.dept.len)); })) return "One of the " + v.deptName + "'s PCs still has a guest's address: each keeps what it was given until it asks again.";
    }
    return "It works right now, but the router's subinterfaces aren't the way the records have them.";
  },
  proves(f, sim, v) {
    if (v.kind === "guest") return ((f.join || f.radio) && f.dev === "guest" && !!f.internet) || (f.page === "guest-wifi" && !!f.internet);
    if (v.kind === "swap") return f.cmd === "ping" && (f.dev === "dpc1" || f.dev === "dpc2") && f.replies > 0 && (f.who || []).indexOf("printer") >= 0;
    return (f.print === "ok" && f.port === v.printer) || (f.cmd === "ping" && f.replies > 0 && (f.who || []).indexOf("printer") >= 0);
  },
  proofText: "whatever lost its way reaching through the router: a test page or a ping to the printer, the visitor's phone online, or a department PC reaching the printer",
  evidence: [
    { id: "noprint", test: function (f, v) { return v.kind === "printers" && (f.print === "fail" || (f.cmd === "ping" && f.ip === v.printer && !f.replies)); }, text: function (f) { return f.print ? "Test page from the PC: nothing came out" : "Ping to the printer: no reply"; } },
    { id: "phone", test: function (f, v) { return v.kind === "guest" && (((f.join || f.radio) && f.dev === "guest") || (f.page === "guest-wifi" && f.connected)) && f.apipa; }, text: function () { return "The visitor's phone joins the guest Wi-Fi but gets no address: 169.254, no internet"; } },
    { id: "guestaddr", test: function (f, v) { return v.kind === "swap" && f.cmd === "ipconfig" && (f.dev === "dpc1" || f.dev === "dpc2") && !!f.ip && inNet(f.ip, v.plan.vlans.guest.net, 24); }, text: function (f, v, sim) { return "ipconfig on the " + name(sim, f.dev) + ": " + f.ip + ", an address on the guests' network, gateway " + f.gw; } },
    { id: "visitor", test: function (f, v) { const D = v.plan.vlans.dept; return v.kind === "swap" && f.dev === "guest" && (f.join || f.radio || f.page === "guest-wifi") && !!f.ip && inNet(f.ip, D.net, D.len); }, text: function (f, v) { return "The visitor's phone: " + f.ip + ", an address in the " + v.deptName + "'s block"; } },
    { id: "tag", test: function (f, v) { const o = devOut(f); return f.on === "rtr" && (/Encapsulation 802\.1Q Virtual LAN, Vlan ID/.test(o) || /\n encapsulation dot1Q \d+/.test(o)) && Object.keys(v.before).some(function (n) { const m = o.match(new RegExp("(?:^|\\n)" + n.replace(/[./]/g, "\\$&") + " is [^]*?Vlan ID\\s+(\\d+)|interface " + n.replace(/[./]/g, "\\$&") + "\\n[^!]*? encapsulation dot1Q (\\d+)")); return m && Number(m[1] || m[2]) !== v.before[n].vlan; }); },
      text: function (f, v) { const o = devOut(f), bad = Object.keys(v.before).map(function (n) { const m = o.match(new RegExp("(?:^|\\n)" + n.replace(/[./]/g, "\\$&") + " is [^]*?Vlan ID\\s+(\\d+)|interface " + n.replace(/[./]/g, "\\$&") + "\\n[^!]*? encapsulation dot1Q (\\d+)")); return m && Number(m[1] || m[2]) !== v.before[n].vlan ? n + " tagged for VLAN " + (m[1] || m[2]) + ", its address " + v.before[n].ip : null; }).filter(Boolean); return "On the router: " + bad.join("; "); } },
    { id: "trunk", test: function (f, v) { return f.on === "msw" && /Vlans allowed and active in management domain/.test(devOut(f)); }, text: function () { return "show interfaces trunk on the closet switch: the trunk to the router allows and carries every VLAN in the records"; } },
    { id: "brief", test: function (f) { return f.on === "rtr" && /Interface\s+IP-Address\s+OK\?\s+Method\s+Status\s+Protocol/.test(devOut(f)); }, text: function () { return "show ip interface brief on the router: every subinterface up and up, on the address the records give its network"; } }
  ],
  summary(v) {
    const V = v.plan.vlans, how = v.kind === "swap" ? "The " + v.deptName + "'s and the guests' subinterfaces had been typed back in from notes with each other's VLAN tags, and saved: each kept its own address, NAT and access list, and heard the other VLAN. The " + v.deptName + "'s PCs took guests' addresses, behind the guests' access list, and a visitor's phone took an address in the " + v.deptName + "'s block."
      : "The " + (v.kind === "guest" ? "guests'" : "printers'") + " subinterface " + v.sub + " had been retyped with VLAN tag " + v.wrong + " instead of " + v.vlan + ", its address typed in again after it, and saved. Its address and " + (v.kind === "guest" ? "pool" : "access list") + " were right; nothing on VLAN " + v.vlan + " could reach them.";
    return { cause: how + " The switches carried the VLAN all the way to the router; the router just wasn't listening for it there.", fix: (v.kind === "swap" ? "Freed one tag, tagged each subinterface for its own VLAN again (VLANs " + V.dept.id + " and " + V.guest.id + ")" : "Tagged " + v.sub + " for VLAN " + v.vlan + " again") + ", gave back the address" + (v.kind === "swap" ? "es" : "") + " the new tag cleared, saved, and " + (v.kind === "printers" ? "sent a test page." : v.kind === "guest" ? "had the visitor's phone join again." : "had the " + v.deptName + "'s PCs and the visitor's phone ask again.") };
  }
};

export const BUSINESS_TICKETS = [SB01, SB02, SB03, SB04, SB05, SB06, SB07, SB08, SB09, SB10];
export const BUSINESS_COMING = [];
