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

export const BUSINESS_TICKETS = [SB01];
export const BUSINESS_COMING = [];
