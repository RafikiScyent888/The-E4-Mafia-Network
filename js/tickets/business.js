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

const SB10 = BUSINESS_JOBS.find(function (d) { return d.id === "SB-J10"; });
/* the business as SB-J10 left it, on a day like any other: nobody logged in, the TFTP server closed, the moment frozen */
function settled(seed) {
  const b = SB10.start(seed), sim = b.sim;
  for (const a of SB10.solve(b.v, sim)) { if (a.t === "cmd") exec(sim, a.dev, a.line, a.win); else sim.apply(a); }
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
  const vl = function (k, label) { const x = V[k]; return x ? [label, x.id + " · " + x.net + "/" + (x.len || 24) + " · gateway " + x.gw] : null; };
  const plan = [vl("staff", "Staff VLAN"), vl("guest", "Guests' VLAN"), vl("cameras", "Cameras' VLAN"), vl("printers", "Printers' VLAN"), V.dept ? vl("dept", cap(V.dept.name.toLowerCase()) + " VLAN") : null,
    ["Native VLAN", V.native.id + " · unused, on the trunks only"], ["Parking VLAN", V.parking.id + " · the spare ports, shut"], ["VLAN 1", "the gear's own addresses · " + p.lan + "/24"]].filter(Boolean);
  return [
    ["The router", p.rtHost + " · by SSH from a staff PC at " + S.gw + " · its console is in the closet cabinet, locked; the key is with " + mgr],
    ["The closet switch", p.swHost + " · by SSH from a staff PC at " + p.swIp + " · its console is in the cabinet too"],
    ["The back switch", p.bswHost + " · at its console, in the " + back + ": your laptop is on its console cable"],
    ["Enable secrets", "the router " + p.rtSecret + " · both switches " + p.swSecret],
    ["Console passwords", "the router " + p.rtConsole + " · both switches " + p.swConsole],
    ["Remote logins (SSH)", "user " + p.user + " · password " + p.userPw],
    ["The printer", p.printerIp + ", on the printers' VLAN"]
  ].concat(plan);
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

export const BUSINESS_TICKETS = [SB01, SB02, SB03];
export const BUSINESS_COMING = [];
