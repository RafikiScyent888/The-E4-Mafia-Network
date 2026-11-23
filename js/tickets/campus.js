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

/* ---------------------------------------------------------------- CP-02 */
/* The weekend's hardening template, run on one layer 3 switch and saved: "passive-interface default" under OSPF, so OSPF sends no
   hellos out of a port facing desks. Typed again on a switch that already had it, it also wipes the exceptions the work orders made
   for the ports facing other routers (distribution switch 1's two uplinks to the core, CP-J5; the Annex core's fibre, CP-J8). Their
   networks are still advertised, but nothing is heard across them: no neighbours, no routes beyond the switch's own networks. The
   edge router would be a third place, but with its OSPF silent it has no way back to any desk, so only its console reaches it, and a
   ticket can't carry your laptop there yet. */
const CP02_KIND = {
  hq: { dev: "dist1", ups: ["GigabitEthernet0/19", "GigabitEthernet0/20"], pcs: ["sd1", "bn1", "mgr", "tr1"], other: "cl1", swName: "distribution switch 1", where: "HQ",
    story: function (pc) { return "Since Monday morning nobody at HQ can get on the internet: email, the suppliers' sites, nothing. Inside, printing and the file server still work, and the " + pc + " still has its address. The trainer across the car park says the Annex is fine. Over the weekend the network contractor applied the company's new hardening template; his change sheet says \"template applied to one layer 3 switch, tested, saved\", and nothing more."; } },
  annex: { dev: "anxc", ups: ["GigabitEthernet0/25"], pcs: ["cl1", "cl2"], other: "mgr", swName: "the Annex core switch", where: "the Annex",
    story: function (pc) { return "The Training Annex's classroom can't reach anything outside its own building since the weekend: not the internet, not the file server at HQ. The " + pc + " still has its address, and HQ itself is fine. Over the weekend the network contractor applied the company's new hardening template; his change sheet says \"template applied to one layer 3 switch, tested, saved\", and nothing more."; } }
};
const ospfOn = function (sim, id, saved) { const sw = sim.d[id].sw; return saved ? sw.startup && sw.startup.ospf : sw.ospf; };
const sameSet = function (a, b) { return a.length === b.length && a.every(function (x) { return b.indexOf(x) >= 0; }); };
const CP02 = {
  id: "CP-02", n: "02", level: 4, tier: "common", title: "No way out of the network since the weekend's maintenance", priority: 1, due: "1 h",
  kinds: ["hq", "annex"],
  build(seed) {
    const B = settled(seed), sim = B.sim, p = B.plan, r = rng(hash("CP-02:" + seed)), kind = r.pick(CP02.kinds), K = CP02_KIND[kind], pc = r.pick(K.pcs);
    const sw = sim.d[K.dev].sw, routes = JSON.stringify(sw.routes || []);
    /* the template, typed under router ospf 1 and saved: every interface passive, the exceptions gone */
    [sw.ospf, sw.startup.ospf].forEach(function (O) { O.passiveDefault = true; O.active = []; });
    sim.bump(); sim.relink(sim.links());
    freeze(sim);
    const ip = K.dev === "anxc" ? p.annex.core.ip : p.sw[K.dev].ip;
    return { sim: sim, v: { kind: kind, plan: p, dev: K.dev, ups: K.ups.slice(), pc: pc, pcName: name(sim, pc), other: K.other, swName: K.swName, swIp: ip, where: K.where, routes: routes, gw: sim.d[pc].ifaces[0].lease ? sim.d[pc].ifaces[0].lease.gw : "" } };
  },
  brief(v) { return { quote: CP02_KIND[v.kind].story(v.pcName) }; },
  mason: "Start from what still works and what doesn't. Then follow the traffic until it stops, and ask the last device that answered why it stopped there.",
  affected: function (v) { return v.pc; },
  options(v) {
    const s = v.swName, S = s.charAt(0).toUpperCase() + s.slice(1), up = v.kind === "hq" ? "uplinks to the core switches" : "fibre to core switch 2";
    return [
      { id: "right", right: true, text: "The template made " + s + "'s " + up + " passive under OSPF: it hears no neighbours there, so it has no routes beyond its own networks" },
      { id: "link", text: S + "'s " + up + (v.kind === "hq" ? " are" : " is") + " down after the maintenance", why: "show ip interface brief on " + s + " has " + (v.kind === "hq" ? "both uplinks" : "the fibre port") + " up and up, and show interfaces status says connected. A dead link would show down." },
      { id: "originate", text: "The edge router stopped handing its default route into OSPF", why: (v.kind === "hq" ? "The Annex still reaches the internet through the same core" : "HQ still reaches the internet through the same core") + ", so the default is still in OSPF. " + S + " doesn't hear it: show ip ospf neighbor there lists nobody." },
      { id: "acl", text: "The template put an access list on " + s + "'s " + up + " that blocks traffic leaving", why: "show ip interface on " + (v.kind === "hq" ? "the uplinks" : "the fibre port") + " shows no access list set, and the replies say Destination net unreachable from " + s + " itself: that's a route it doesn't have, not a filter." },
      { id: "network", text: "The template deleted " + s + "'s OSPF network statement, so it no longer takes part in OSPF", why: "show ip protocols on " + s + " still routes for its network statement, and show ip ospf interface brief still lists its interfaces in area 0." },
      { id: "dhcp", text: "The desks lost their addresses when the DHCP server was restarted in the maintenance window", why: "ipconfig on the " + v.pcName + " shows its lease and its gateway, and the gateway answers a ping. A desk without an address would be on 169.254." }
    ];
  },
  rung1(v) { return "From the " + v.pcName + ": tracert to an address on the internet, and see which device answers last. Then SSH to that device (its address is in the records): its routing table, and who it hears routes from."; },
  rung2() { return "A router learns routes only from neighbours it has formed, and OSPF forms one only across an interface that sends and hears hellos. An interface can be in OSPF, its network advertised, and still send no hellos: then nothing is learned across it."; },
  fixHints(v) { return ["On " + v.swName + ": show ip protocols lists the interfaces OSPF keeps quiet; show ip ospf neighbor lists who it hears.", "The template's idea is sound: OSPF quiet on every port facing desks. It only needs its exceptions: the ports that face other routers.", "Save it, as the template was saved. Then from the " + v.pcName + ": a ping to the internet."]; },
  /* OSPF as the records have it on that switch: quiet on every interface but the ones facing other routers */
  ospfRight(sim, v, saved) { const O = ospfOn(sim, v.dev, saved); return !!O && !!O.passiveDefault && sameSet(O.active || [], v.ups); },
  exhibits(sim, v) { const O = ospfOn(sim, v.dev); return !!O.passiveDefault && !v.ups.some(function (n) { return (O.active || []).indexOf(n) >= 0; }) && !online(sim, v.pc) && online(sim, v.other); },
  fixed(sim, v) { return CP02.ospfRight(sim, v) && CP02.ospfRight(sim, v, true) && JSON.stringify(sim.d[v.dev].sw.routes || []) === v.routes && online(sim, v.pc) && online(sim, v.other); },
  partial(v, sim) {
    const O = ospfOn(sim, v.dev);
    if (!O.passiveDefault) return "The desks are out again, but OSPF on " + v.swName + " now talks out of every interface, the desks' networks too: hellos where the desks are, which the template is there to stop: anything plugged into a desk port could answer them and hand the switch routes.";
    if (JSON.stringify(sim.d[v.dev].sw.routes || []) !== v.routes) return "It works, but a static route typed on " + v.swName + " is doing the job OSPF should: the records have every route learned, and a route typed by hand doesn't follow the network when a link fails.";
    if (!CP02.ospfRight(sim, v)) {
      const act = O.active || [], miss = v.ups.filter(function (n) { return act.indexOf(n) < 0; }), extra = act.filter(function (n) { return v.ups.indexOf(n) < 0; });
      if (miss.length) return "The desks are out again, but " + v.swName + " still keeps OSPF quiet on " + miss.join(" and ") + ": everything goes over the other uplink, with nothing to fall back on if it fails.";
      return "The desks are out again, but OSPF on " + v.swName + " now talks out of " + extra.join(" and ") + " too, which faces no router: the template is there to keep it quiet on ports like that.";
    }
    if (!CP02.ospfRight(sim, v, true)) return "The desks are out again, but " + v.swName + " hasn't saved it: the template is still in its saved configuration, so the next reload brings the fault back.";
    return "It works, but not the way the records have it.";
  },
  proves(f, sim, v) { return f.cmd === "ping" && f.dev === v.pc && f.replies > 0 && !!f.internet; },
  proofText: "a ping from the desk to the internet that gets replies",
  evidence: [
    { id: "unreach", test: function (f, v) { return f.dev === v.pc && ((f.cmd === "ping" && f.kind === "net-unreachable") || (f.cmd === "tracert" && !!f.stopAt)); }, text: function (f, v) { return (f.cmd === "tracert" ? "tracert" : "ping") + " from the " + v.pcName + ": " + v.swName + " answers Destination net unreachable"; } },
    { id: "nbr", test: function (f, v) { const o = devOut(f); return f.on === v.dev && /Neighbor ID\s+Pri\s+State/.test(o) && !/FULL/.test(o); }, text: function (f, v) { return "show ip ospf neighbor on " + v.swName + ": no neighbours at all"; } },
    { id: "proto", test: function (f, v) { return f.on === v.dev && /Passive Interface\(s\):\s+\(every interface but none\)/.test(devOut(f)); }, text: function (f, v) { return "show ip protocols on " + v.swName + ": every interface passive, none left talking"; } },
    { id: "route", test: function (f, v) { const o = devOut(f); return f.on === v.dev && /Gateway of last resort is not set/.test(o); }, text: function (f, v) { return "show ip route on " + v.swName + ": no gateway of last resort, only its own networks"; } },
    { id: "brief", test: function (f, v) { const o = devOut(f); return f.on === v.dev && v.ups.every(function (n) { return new RegExp("^" + n + "\\s.*\\bup\\s+up", "m").test(o); }); }, text: function (f, v) { return "show ip interface brief on " + v.swName + ": " + (v.kind === "hq" ? "both uplinks" : "the fibre port") + " up and up"; } }
  ],
  summary(v) {
    const up = v.kind === "hq" ? "two uplinks to the core switches" : "fibre to core switch 2";
    return { cause: "The contractor's hardening template, run on " + v.swName + " and saved, was passive-interface default under OSPF. Typed on a switch that already had it, it wiped the exceptions for its " + up + ": OSPF still advertised the switch's networks, but sent no hellos across those ports, so it formed no neighbours and learned no routes, the default from the edge router among them. Its desks reached each other and nothing beyond.", fix: "On " + v.swName + ", under router ospf 1: no passive-interface for each port facing the core, the template's passive-interface default kept, then saved. Its neighbours came up FULL, the routes came back, and the " + v.pcName + " reached the internet." };
  }
};

/* ---------------------------------------------------------------- CP-03 */
/* A floor's gateway nobody answers for: on Saturday the contractor re-entered distribution switch 1's standby lines from his notes
   after a failover test, and typed one VLAN's virtual address wrong. Distribution switch 1 is still the active router for that group
   (priority 110, preempt), so the group answers for the address it was given; distribution switch 2, standby, answers for nothing.
   The floor's desks still use the gateway the records give, and nothing answers it: they reach each other and nothing else. */
const CP03_KIND = {
  svc: { vlan: "svc", pcs: ["sd1", "hd1"], floor: "1F", other: "mgr", room: "the service desk and the help desk on the first floor" },
  bench: { vlan: "bench", pcs: ["bn1", "bn2"], floor: "2F", other: "sd1", room: "the repair bench on the second floor" },
  office: { vlan: "office", pcs: ["mgr", "fin"], floor: "3F", other: "bn1", room: "the offices on the third floor" },
  train: { vlan: "train", pcs: ["tr1", "tr2"], floor: "4F", other: "fin", room: "the training room on the fourth floor" }
};
const vlanOf = function (p, k) { return k === "train" ? p.train : p.vlans[k]; };
const sbIp = function (sim, id, vid, saved) { const sw = sim.d[id].sw, w = saved ? sw.startup : sw, r = w && w.svis && w.svis[String(vid)]; return r && r.standby && r.standby[String(vid)] ? r.standby[String(vid)].ip || null : null; };
const CP03 = {
  id: "CP-03", n: "03", level: 4, tier: "common", title: "A whole floor reaches only itself after Saturday's change", priority: 1, due: "1 h",
  kinds: ["svc", "bench", "office", "train"],
  build(seed) {
    const B = settled(seed), sim = B.sim, p = B.plan, r = rng(hash("CP-03:" + seed)), kind = r.pick(CP03.kinds), K = CP03_KIND[kind], V = vlanOf(p, K.vlan);
    const last = r.pick([11, 10, 100]), typo = V.gw.replace(/\.1$/, "." + last), pc = r.pick(K.pcs);
    /* the standby line retyped wrong on distribution switch 1, and saved */
    const sw = sim.d.dist1.sw; [sw, sw.startup].forEach(function (w) { w.svis[String(V.id)].standby[String(V.id)].ip = typo; });
    sim.bump(); sim.relink(sim.links());
    freeze(sim);
    return { sim: sim, v: { kind: kind, plan: p, vid: V.id, vname: V.name, gw: V.gw, typo: typo, own1: V.gw.replace(/\.1$/, ".2"), pcs: K.pcs.slice(), pc: pc, pcName: name(sim, pc), other: K.other, otherName: name(sim, K.other), floor: K.floor, room: K.room } };
  },
  brief(v) { return { quote: "Since Saturday " + v.room + " can't reach anything but each other: no internet, no file server, no printing to the printers. The " + v.pcName + " still has its address. Every other floor is fine. On Saturday the network contractor tested a failover between the two distribution switches, then re-entered the standby settings on distribution switch 1 from his notes and saved." }; },
  mason: "Find the first hop the floor's traffic takes, and ask who's meant to answer it, and who actually does.",
  affected: function (v) { return v.pc; },
  options(v) {
    return [
      { id: "right", right: true, text: "Distribution switch 1, the active router for the floor's standby group, answers for a virtual address that isn't the floor's gateway" },
      { id: "dhcp", text: "The DHCP server hands the floor's desks the wrong gateway", why: "ipconfig on the " + v.pcName + " shows the gateway the records give for its VLAN: the desks are asking the right address. Nothing answers it." },
      { id: "active2", text: "Distribution switch 2 took over the floor's gateway in the failover test and doesn't route it", why: "show standby brief on either switch has distribution switch 1 active for the floor's group, preempt set, distribution switch 2 standby." },
      { id: "trunk", text: "The floor's VLAN was left off the trunks to the distribution switches after the test", why: "The " + v.pcName + " reaches distribution switch 1's own address on its VLAN: a ping to it answers, and show interfaces trunk on the floor's access switch lists the VLAN forwarding." },
      { id: "svi", text: "Distribution switch 1's interface for the floor's VLAN was left shut after the test", why: "show ip interface brief on distribution switch 1 has the VLAN's interface up and up, and its own address on the floor answers a ping." },
      { id: "acl", text: "An access list on the floor's VLAN interface drops everything leaving the floor", why: "The desk's ping to its gateway gets no answer at all, and arp -a has no entry for the gateway: nothing is answering for that address. A list would still let the address be found." }
    ];
  },
  rung1(v) { return "On the " + v.pcName + ": ipconfig, ping its gateway, then arp -a. Then from a desk on another floor, SSH to the distribution switches (the records have their addresses): who answers for the floor's gateway?"; },
  rung2() { return "A standby group shares one virtual address between two routers, and the active one answers for it, as configured on the active one. If the address the active router was given isn't the one the devices use as their gateway, nobody answers theirs."; },
  fixHints(v) { return ["show standby brief on both distribution switches: the floor's group, who's active, and the virtual address beside it. Compare it with the gateway the records give.", "Correct it where it went wrong, on the switch that's active for the group; the other switch, and the desks, are already right.", "Save it, as the change was saved. Then from the " + v.pcName + ": a ping to the internet."]; },
  exhibits(sim, v) { return sbIp(sim, "dist1", v.vid) === v.typo && sim.hsrpVips("dist1").some(function (q) { return q.vip === v.typo; }) && !v.pcs.some(function (d) { return online(sim, d); }) && online(sim, v.other); },
  fixed(sim, v) {
    return sbIp(sim, "dist1", v.vid) === v.gw && sbIp(sim, "dist1", v.vid, true) === v.gw && sbIp(sim, "dist2", v.vid) === v.gw && sbIp(sim, "dist2", v.vid, true) === v.gw
      && sim.hsrpVips("dist1").some(function (q) { return q.vip === v.gw; }) && v.pcs.every(function (d) { return online(sim, d); }) && online(sim, v.other);
  },
  partial(v, sim) {
    if (!sim.hsrpVips("dist1").some(function (q) { return q.vip === v.gw; })) return "The floor is out again, but distribution switch 1 isn't the floor's active gateway any more: distribution switch 2 answers alone, with nothing behind it if it fails, and away from the switch the floor's traffic is meant to use.";
    if (sbIp(sim, "dist2", v.vid) !== v.gw) return "The floor is out again, but distribution switch 2's standby address for the floor isn't its gateway any more: if distribution switch 1 fails, nobody answers it.";
    if (sbIp(sim, "dist1", v.vid, true) !== v.gw) return "The floor is out again, but distribution switch 1 hasn't saved it: its saved configuration still has the wrong address, so the next reload brings the fault back.";
    return "It works, but not the way the records have it.";
  },
  proves(f, sim, v) { return f.cmd === "ping" && f.dev === v.pc && f.replies > 0 && !!f.internet; },
  proofText: "a ping from a desk on the floor to the internet that gets replies",
  evidence: [
    { id: "ipc", test: function (f, v) { return f.cmd === "ipconfig" && f.dev === v.pc && f.gw === v.gw; }, text: function (f, v) { return "ipconfig on the " + v.pcName + ": its address, and the gateway the records give, " + v.gw; } },
    { id: "gwping", test: function (f, v) { return f.cmd === "ping" && f.dev === v.pc && f.ip === v.gw && !f.replies; }, text: function (f, v) { return "ping " + v.gw + " from the " + v.pcName + ": nothing answers the gateway"; } },
    { id: "own1", test: function (f, v) { return f.cmd === "ping" && f.dev === v.pc && f.ip === v.own1 && f.replies > 0; }, text: function (f, v) { return "ping " + v.own1 + " from the " + v.pcName + ": distribution switch 1's own address on the floor answers"; } },
    { id: "sb", test: function (f, v) { return (f.on === "dist1" || f.on === "dist2") && new RegExp("^Vl" + v.vid + "\\s+" + v.vid + "\\s.*" + v.typo.replace(/\./g, "\\.") + "\\s*$", "m").test(devOut(f)); }, text: function (f, v) { return "show standby brief: Vl" + v.vid + ", distribution switch 1 active, virtual address " + v.typo + ", not " + v.gw; } }
  ],
  summary(v) {
    return { cause: "Re-entering distribution switch 1's standby settings on Saturday, the contractor typed the " + v.floor + " VLAN's virtual address as " + v.typo + " instead of " + v.gw + ", and saved. Distribution switch 1 is the active router for that group, so the group answered for " + v.typo + "; the floor's desks still used " + v.gw + ", the gateway the records give, and nobody answered it.", fix: "On distribution switch 1, interface vlan " + v.vid + ": standby " + v.vid + " ip " + v.gw + ", then saved. Distribution switch 1 answered for the gateway again, distribution switch 2 standby behind it, and the " + v.pcName + " reached the internet." };
  }
};

export const CAMPUS_TICKETS = [CP01, CP02, CP03];
export const CAMPUS_COMING = [];
