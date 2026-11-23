/* Tier 4 tickets: the campus (level 4), Rafiki's HQ and the Training Annex. Each one starts from the campus as the work orders left it
   (CP-J1 to CP-J10: the access ports locked down, the spanning-tree root, the distribution switches bundled, the gateways on them and
   shared by standby, OSPF across the core, the fourth floor, the Annex across the car park, jumbo frames for the backup network, the
   central DHCP server), on a day like any other: nobody logged in, your laptop back in the data room. Then the fault is planted the
   way it really got there. As on every level's tickets: exhibits proves the fault shows; six options, one right and five near misses,
   each wrong one with its reason; the fix must be at the source (a fix that only treats the symptom, or one that weakens what the
   records set, works today and Mason says so); the proof is something a student runs. The campus's records are on every ticket card:
   what a technician is given to log in. */
import { CAMPUS_JOBS } from "../build/campus.js";
import { online } from "../build/jobs.js";
import { coreLinks } from "../net/campus.js";
import { dotMac } from "../net/swcli.js";
import { rng, hash } from "../net/util.js";
import { exec } from "../net/cmd.js";

const J10 = CAMPUS_JOBS.find(function (d) { return d.id === "CP-J10"; });
/* the campus as CP-J10 left it, on a day like any other: nobody logged in, the moment frozen */
function settled(seed) {
  const b = J10.start(seed), sim = b.sim;
  for (const a of J10.solve(b.v, sim)) { if (a.t === "cmd") exec(sim, a.dev, a.line, a.win, a.text); else sim.apply(a); }
  freeze(sim);
  return { sim: sim, plan: b.v.plan };
}
function freeze(sim) { sim.cli = {}; sim.lastTrace = null; sim.net.extra.build = false; }   /* a ticket keeps its moment frozen */
/* what a switch or router printed, whichever terminal typed it (your laptop's console, or SSH from a desk PC) */
const devOut = function (f) { return (f.cmd === "serial" || f.cmd === "ssh" || f.cmd === "telnet") && typeof f.out === "string" ? f.out : ""; };
/* a device's name mid-sentence: "the finance PC", "bench PC 2" */
const name = function (sim, id) { return String(sim.d[id].label).replace(/^[A-Z](?=[a-z])/, function (m) { return m.toLowerCase(); }); };

/* the campus's records, as Rafiki's keeps them: what a technician is given to log in to the gear, and the VLAN plan */
export function campusRecords(v, sim) {
  const p = v.plan, V = p.vlans, A = p.annex, S = p.srv, sw = p.sw;
  const at = function (k) { return sw[k] ? sw[k].host + " " + sw[k].ip : null; };
  const vl = function (x, label) { return x ? [label, x.id + " · named " + x.name + (x.net ? " · " + x.net + "/24 · gateway " + x.gw : "")] : null; };
  return [
    ["The switches", "by SSH from a desk PC at their management addresses: " + ["dist1", "dist2", "acc1", "acc2", "acc3", "acc4"].map(at).filter(Boolean).join(" · ") + " · the Annex: " + A.core.host + " " + A.core.ip + " · " + A.acc.host + " " + A.acc.ip + " · the core switches (" + sw.core1.host + ", " + sw.core2.host + ") at their consoles in the data room"],
    ["The edge router", p.edge.host + " · by SSH at " + coreLinks(p)[0].ia + " · its console in the data room"],
    ["Enable secret", p.secret + " (every switch and the edge router)"],
    ["Console password", p.console],
    ["Remote logins (SSH)", "user " + p.user + " · password " + p.userPw],
    ["The servers", S.fsrv.host + " " + S.fsrv.ip + " (the file server and the DHCP server) · " + S.bksrv.host + " " + S.bksrv.ip + " (the backup server) · log in as " + S.user + ", password " + S.pw],
    ["The desks", "1F the service desk and the help desk on the 1F access switch's ports 1 and 2 · 2F bench PCs 1 and 2 on the 2F switch's 1 and 2 · 3F the manager and finance on the 3F switch's 1 and 2 · 4F training PCs 1 and 2 on the 4F switch's 1 and 2 · the Annex classroom PCs on its access switch's 1 and 2"],
    ["The desk ports", "port security on every desk port: sticky, one address, shut down on a violation; portfast and BPDU guard"]
  ].concat([vl(V.svc, "Service desk VLAN"), vl(V.bench, "Bench VLAN"), vl(V.office, "Office VLAN"), vl(p.train, "Training VLAN"), vl(A.cls, "Classroom VLAN (the Annex)"), vl(V.servers, "Servers VLAN"), vl(V.printers, "Printers VLAN"), vl(V.mgmt, "Management VLAN"), vl(A.mgmt, "The Annex's management VLAN"), vl(p.backup, "Backup VLAN (not routed)"), ["Native VLAN", V.native.id + " · named " + V.native.name + " · unused, on the trunks only"], ["Parking VLAN", V.parking.id + " · named " + V.parking.name + " · the spare ports, shut"]].filter(Boolean));
}

/* ---------------------------------------------------------------- CP-01 */
/* A desk port shut by port security: a visitor's laptop plugged into the desk's cable for a few minutes. The port holds the desk PC's
   address, sticky, one address, shut down on a violation (CP-J1); the stranger's address was one too many, and the port went
   err-disabled. Putting the PC's cable back changes nothing: an err-disabled port stays down until someone shuts it and opens it again. */
const CP01_KIND = {
  finance: { sw: "acc3", port: "2", dev: "fin", vlan: "office", floor: "3F", story: function () { return "The finance PC on the third floor has had no network since just after lunch. The auditors were in this morning: one of them plugged their laptop into the finance desk's network cable to send something to the printer, and when they'd finished they put the PC's cable back. It never came back."; } },
  bench: { sw: "acc2", port: "2", dev: "bn2", vlan: "bench", floor: "2F", story: function () { return "Bench PC 2 dropped off the network this afternoon and hasn't come back. The parts supplier's engineer borrowed its network cable for a few minutes to download a firmware update onto his laptop. He swears he plugged the PC back in properly, and the cable's clicked in."; } },
  help: { sw: "acc1", port: "2", dev: "hd1", vlan: "svc", floor: "1F", story: function () { return "The help desk PC has been dead to the network since the courier's visit. He asked to charge his laptop at the help desk while he waited, and plugged its network cable in too, to check his deliveries. The PC's cable is back in, but nothing."; } }
};
const port01 = function (v) { return "GigabitEthernet0/" + CP01_KIND[v.kind].port; };
const CP01 = {
  id: "CP-01", n: "01", level: 4, tier: "common", title: "A desk PC dead to the network after a visitor plugged in", priority: 2, due: "2 h",
  kinds: ["finance", "bench", "help"],   /* its variants, in the order a seed picks them (the tests find a campus for each) */
  build(seed) {
    const B = settled(seed), sim = B.sim, p = B.plan, r = rng(hash("CP-01:" + seed)), kind = r.pick(CP01.kinds), K = CP01_KIND[kind];
    const vm = "a4:83:e7:" + [r.int(16, 255), r.int(0, 255), r.int(0, 255)].map(function (x) { return (x < 16 ? "0" : "") + x.toString(16); }).join(":");
    const sw = sim.d[K.sw].sw, n = "GigabitEthernet0/" + K.port, vid = sw.ports[n].access;
    /* what port security did while the stranger's laptop was plugged in: one violation, the port shut down; the PC's sticky address kept */
    sw.psRun = sw.psRun || {}; sw.psRun[n] = { err: true, dyn: [], viol: 1, seen: [dotMac(vm)], last: { mac: dotMac(vm), vlan: vid } };
    sim.bump(); sim.relink(sim.links());
    freeze(sim);
    return { sim: sim, v: { kind: kind, plan: p, sw: K.sw, port: K.port, dev: K.dev, vid: vid, visitor: dotMac(vm), pcMac: dotMac(sim.d[K.dev].ifaces[0].mac), pc: name(sim, K.dev), floor: K.floor, swName: K.floor + " access switch" } };
  },
  brief(v) { return { quote: CP01_KIND[v.kind].story() }; },
  mason: "A port that's been shut for a reason stays shut until somebody looks at the reason. Find out what the switch saw.",
  affected: function (v) { return v.dev; },
  options(v) {
    const pc = v.pc, s = "the " + v.swName;
    return [
      { id: "right", right: true, text: "Port security shut the " + pc + "'s port when the visitor's laptop was plugged in, and it stays shut" },
      { id: "bpdu", text: "BPDU guard shut the " + pc + "'s port: the visitor's laptop was bridging to another network", why: "The port security commands account for it: show port-security interface says Secure-shutdown, one violation, the last source address the laptop's. A laptop sends no BPDUs; a switch plugged in would." },
      { id: "sticky", text: "Port security has stuck the visitor's laptop's address as the port's one allowed address, locking the PC out", why: "show port-security address still lists the PC's own address as the sticky one on its port. The laptop's address is only the last source of the violation, not one the port holds." },
      { id: "cable", text: "The " + pc + "'s network cable was damaged when it was unplugged and plugged back in", why: "A damaged cable shows as notconnect. show interfaces status says err-disabled: the switch shut the port itself, whatever is plugged into it." },
      { id: "pool", text: "The visitor's laptop took the last address the DHCP server had for that network", why: "The PC has no link at all: ipconfig says Media disconnected. A pool run out would leave it on 169.254 with a link, and the other desk on the floor still renews." },
      { id: "uplink", text: s + "'s uplinks went down while the visitor was plugged in", why: "The other desk on the same switch is online, and show interfaces trunk on " + s + " lists both uplinks trunking." }
    ];
  },
  rung1(v) { return "On the " + v.pc + ": ipconfig. Then from another desk PC, SSH to the " + v.swName + " (its address is in the records): show interfaces status, and find the PC's port by what's on it."; },
  rung2() { return "A switch port shut by one of its protections is err-disabled, and stays that way when the cause goes away: it waits for someone to shut it and open it again. The switch's own commands for that protection say what it saw."; },
  fixHints(v) { return ["The " + v.swName + " says which protection shut the port: port security's show commands say what it saw and what it still holds.", "The port security settings are the records' and still right: the port only needs to come back. An err-disabled port comes back when it's shut and opened again.", "Then check the " + v.pc + " has its address and reaches the internet: it asks for one when its link comes up."]; },
  exhibits(sim, v) { const sw = sim.d[v.sw].sw, r = sw.psRun && sw.psRun[port01(v)]; return !!(r && r.err) && !online(sim, v.dev) && online(sim, CP01.other(v)); },
  other(v) { return { acc1: "sd1", acc2: "bn1", acc3: "mgr" }[v.sw]; },
  /* port security as the records have it on that port: on, one address, sticky, shut down on a violation, holding the PC's address and nothing else */
  secured(x, v) { const P = x && x.ps; return !!P && P.on && P.max === 1 && P.sticky && P.viol === "shutdown" && P.macs.length === 1 && P.macs[0].mac === v.pcMac; },
  fixed(sim, v) {
    const sw = sim.d[v.sw].sw, n = port01(v), r = sw.psRun && sw.psRun[n], st = sw.startup && sw.startup.ports[n];
    return !(r && r.err) && !sw.ports[n].shutdown && CP01.secured(sw.ports[n], v) && CP01.secured(st, v) && online(sim, v.dev) && online(sim, CP01.other(v));
  },
  partial(v, sim) {
    const sw = sim.d[v.sw].sw, n = port01(v), st = sw.startup && sw.startup.ports[n];
    if (!CP01.secured(sw.ports[n], v)) return "The " + v.pc + " is back, but its port isn't protected the way the records have it any more: port security on, one address (the PC's), sticky, shut down on a violation. The next stranger's laptop would just work.";
    if (!CP01.secured(st, v)) return "The " + v.pc + " is back, but the switch's saved configuration no longer has port security on that port as the records set it: after a reload the desk is unprotected.";
    return "It works, but not the way the records have it.";
  },
  proves(f, sim, v) { return f.cmd === "ping" && f.dev === v.dev && f.replies > 0 && !!f.internet; },
  proofText: "a ping from the PC to the internet that gets replies",
  evidence: [
    { id: "ipc", test: function (f, v) { return f.cmd === "ipconfig" && f.dev === v.dev && !f.ip; }, text: function (f, v) { return "ipconfig on the " + v.pc + ": Media disconnected"; } },
    { id: "status", test: function (f, v) { return new RegExp("^Gi0/" + v.port + "\\s.*\\berr-disabled\\b", "m").test(devOut(f)); }, text: function (f, v) { return "show interfaces status on the " + v.swName + ": Gi0/" + v.port + ", the " + v.pc + "'s port, err-disabled"; } },
    { id: "intf", test: function (f, v) { return new RegExp("GigabitEthernet0/" + v.port + " is down, line protocol is down \\(err-disabled\\)").test(devOut(f)); }, text: function (f, v) { return "show interfaces gi0/" + v.port + ": down, line protocol down (err-disabled)"; } },
    { id: "psint", test: function (f, v) { const o = devOut(f); return /Port Status\s+: Secure-shutdown/.test(o) && o.indexOf(v.visitor) >= 0; }, text: function (f, v) { return "show port-security interface gi0/" + v.port + ": Secure-shutdown, one violation, last source address " + v.visitor + ", not the PC's"; } },
    { id: "pstable", test: function (f, v) { return new RegExp("Gi0/" + v.port + "\\s+1\\s+1\\s+1\\s+Shutdown").test(devOut(f)); }, text: function (f, v) { return "show port-security on the " + v.swName + ": Gi0/" + v.port + ", one address held, one violation, Shutdown"; } },
    { id: "psaddr", test: function (f, v) { return /Secure Mac Address Table/.test(devOut(f)) && new RegExp(v.pcMac.replace(/\./g, "\\.") + "\\s+SecureSticky\\s+Gi0/" + v.port + "\\b").test(devOut(f)); }, text: function (f, v) { return "show port-security address: the " + v.pc + "'s own address, " + v.pcMac + ", still the sticky one on Gi0/" + v.port; } },
    { id: "mac", test: function (f, v) { return f.cmd === "ipconfig" && f.sub === "/all" && f.dev === v.dev; }, text: function (f, v) { return "ipconfig /all on the " + v.pc + ": its physical address, the one port security holds"; } }
  ],
  summary(v) {
    return { cause: "The visitor's laptop, plugged into the " + v.pc + "'s cable, was a second address on a port allowed one, the PC's, stuck there by port security. That was a violation, and the port shut itself down (err-disabled). Putting the PC's cable back couldn't help: an err-disabled port stays down until someone shuts it and opens it again.", fix: "Shut the " + v.pc + "'s port on the " + v.swName + " (Gi0/" + v.port + ") and opened it again, with port security left exactly as the records have it; the PC asked for its address when its link came up and reached the internet." };
  }
};

export const CAMPUS_TICKETS = [CP01];
export const CAMPUS_COMING = [];
