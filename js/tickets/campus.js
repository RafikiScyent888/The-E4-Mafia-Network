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
    ["The edge router", p.edge.host + " · by SSH at " + coreLinks(p)[0].ia + " · its console in the data room · its internet port (" + p.edge.wan.replace("GigabitEthernet", "Gi") + ") takes its address, and the provider's default, from the provider by DHCP"],
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

/* ---------------------------------------------------------------- CP-04 */
/* Saturday's reload of distribution switch 1 (a firmware update): while it was down, distribution switch 2 took every gateway, as it
   should. When switch 1 came back it took them all back but one floor's: that group's line on switch 1 was changed during the test and
   saved, either preempt taken off (to stop it flapping) or the priority taken back to the default (where it ties with switch 2's, and
   the tie goes to the higher address, switch 2's). Nothing is down: the floor's traffic goes to switch 2, across the bundle from
   where spanning tree sends that VLAN, and the monitoring has flagged it. */
const CP04_VLANS = { svc: "the service desk's VLAN", bench: "the bench VLAN", office: "the office VLAN", train: "the training VLAN" };
const sbRec = function (sim, id, vid, saved) { const sw = sim.d[id].sw, w = saved ? sw.startup : sw, r = w && w.svis && w.svis[String(vid)]; return r && r.standby ? r.standby[String(vid)] || null : null; };
const sbKey = function (sim, vid) { const S = sim.hsrpState(); return Object.keys(S).find(function (k) { return S[k].members.some(function (m) { return m.id === "dist1" && m.iface === "Vlan" + vid; }); }); };
const sbActive = function (sim, vid) { const S = sim.hsrpState(), k = sbKey(sim, vid); return k && S[k].active ? S[k].active.id : null; };
const CP04 = {
  id: "CP-04", n: "04", level: 4, tier: "common", title: "Distribution switch 2 still the gateway after Saturday's reload", priority: 3, due: "1 day",
  kinds: ["preempt", "priority"],
  build(seed) {
    const B = settled(seed), sim = B.sim, p = B.plan, r = rng(hash("CP-04:" + seed)), kind = r.pick(CP04.kinds), vk = r.pick(["svc", "bench", "office", "train"]), V = vlanOf(p, vk);
    const d2 = JSON.stringify([sbRec(sim, "dist2", V.id), sbRec(sim, "dist2", V.id, true)]);
    /* the test's change, saved */
    const sw = sim.d.dist1.sw; [sw, sw.startup].forEach(function (w) { const G = w.svis[String(V.id)].standby[String(V.id)]; if (kind === "preempt") delete G.preempt; else delete G.pri; });
    /* the reload: switch 2 took the group while switch 1 was down, and keeps it */
    sim.bump(); sim.relink(sim.links());
    sim.net.extra.hsrp[sbKey(sim, V.id)] = "dist2"; sim.hsrpTick();
    sw.restart = "reload"; sw.uptimeFixed = "2 days, 1 hour, 6 minutes"; sim.d.dist2.sw.uptimeFixed = "5 weeks, 2 days, 7 hours, 41 minutes";
    sim.bump();
    freeze(sim);
    return { sim: sim, v: { kind: kind, vk: vk, plan: p, vid: V.id, vname: CP04_VLANS[vk], gw: V.gw, d2: d2, own2: V.gw.replace(/\.1$/, ".3") } };
  },
  brief(v) { return { quote: "The monitoring flagged it this morning: distribution switch 2 has been the active gateway for " + v.vname + " since Saturday night. Nobody on that floor has complained. On Saturday distribution switch 1 had its firmware updated and was reloaded; the contractor tested a failover first, and every other VLAN's gateway went back to switch 1 when it came up. The records have switch 1 active for every VLAN." }; },
  mason: "Nothing's broken, so nobody will tell you what's wrong. The two switches will, if you put their answers side by side.",
  affected: function () { return "dist1"; },
  options(v) {
    const pre = { id: "preempt", text: "Distribution switch 1 no longer preempts for that group, so it stays standby however high its priority", why: "show standby brief on distribution switch 1 has the P beside that group: it preempts. Its priority is what keeps it standby: no higher than switch 2's." };
    const pri = { id: "priority", text: "Distribution switch 1's priority for that group is back at the default, no higher than switch 2's, and the tie goes to switch 2's higher address", why: "show standby brief on distribution switch 1 has that group at priority 110, as the records have it. What's missing is the P: it never takes the role back." };
    return [
      { id: "right", right: true, text: v.kind === "preempt" ? pre.text : pri.text },
      v.kind === "preempt" ? pri : pre,
      { id: "down", text: "Distribution switch 1's interface for that VLAN didn't come back up after the reload", why: "show standby brief on distribution switch 1 lists the group as Standby, not Init, and show ip interface brief has the VLAN's interface up and up." },
      { id: "split", text: "The two switches' groups for that VLAN have different numbers, so each is in a group of its own", why: "Both switches show the same group number, and each names the other: switch 2 active, switch 1 standby." },
      { id: "stp", text: "Spanning tree made distribution switch 2 the root for that VLAN after the reload, and the gateway followed it", why: "Standby doesn't follow spanning tree, and show spanning-tree for that VLAN on distribution switch 1 still says this bridge is the root." },
      { id: "booting", text: "Distribution switch 1 is still starting up after the firmware update", why: "show version on distribution switch 1 has it up two days, it answers SSH, and it's active for every other VLAN." }
    ];
  },
  rung1() { return "SSH to both distribution switches (the records have their addresses): show standby brief on each, and put the flagged VLAN's lines side by side: who's active, each one's priority, the P."; },
  rung2() { return "A standby router takes the active role back only if it preempts and its priority is higher than the active router's. With equal priorities the higher address wins."; },
  fixHints(v) { return ["On distribution switch 1, compare the flagged group's line in show standby brief with every other group's line: something is different.", "Put that group back as the records have every group on switch 1: its priority above switch 2's, and preempt. Switch 2 needs nothing.", "Save it. Then show standby brief on distribution switch 1: it should be active for the group again."]; },
  right1(sim, v, saved) { const G = sbRec(sim, "dist1", v.vid, saved); return !!G && G.pri === 110 && !!G.preempt && G.ip === v.gw; },
  exhibits(sim, v) { return sbActive(sim, v.vid) === "dist2" && !CP04.right1(sim, v) && ["sd1", "bn1", "mgr", "tr1"].every(function (d) { return online(sim, d); }); },
  fixed(sim, v) { return CP04.right1(sim, v) && CP04.right1(sim, v, true) && sbActive(sim, v.vid) === "dist1" && JSON.stringify([sbRec(sim, "dist2", v.vid), sbRec(sim, "dist2", v.vid, true)]) === v.d2 && ["sd1", "bn1", "mgr", "tr1"].every(function (d) { return online(sim, d); }); },
  partial(v, sim) {
    if (JSON.stringify([sbRec(sim, "dist2", v.vid), sbRec(sim, "dist2", v.vid, true)]) !== v.d2) return "Distribution switch 1 is active again, but switch 2's settings for the group have changed: the records have switch 2 at the default, standing by. The fault was on switch 1.";
    if (!CP04.right1(sim, v)) return "Distribution switch 1 is active again, but only because switch 2 dropped out for a moment: switch 1's settings for the group are still wrong, so after the next reload switch 2 keeps it again.";
    if (!CP04.right1(sim, v, true)) return "Distribution switch 1 is active again, but it hasn't saved the change: after the next reload the group stays on switch 2 again.";
    return "It works, but not the way the records have it.";
  },
  proves(f, sim, v) { return f.on === "dist1" && new RegExp("^Vl" + v.vid + "\\s+" + v.vid + "\\s+\\d+\\s+.{2}Active\\s+local\\b", "m").test(devOut(f)); },
  proofText: "show standby brief on distribution switch 1: active for the flagged VLAN's group",
  evidence: [
    { id: "sb2", test: function (f, v) { return f.on === "dist2" && new RegExp("^Vl" + v.vid + "\\s+" + v.vid + "\\s+\\d+\\s+.{2}Active\\s+local\\b", "m").test(devOut(f)); }, text: function (f, v) { return "show standby brief on distribution switch 2: active for Vl" + v.vid; } },
    { id: "sb1", test: function (f, v) { return f.on === "dist1" && new RegExp("^Vl" + v.vid + "\\s+" + v.vid + "\\s+\\d+\\s+.{2}Standby\\b", "m").test(devOut(f)); }, text: function (f, v) { return "show standby brief on distribution switch 1: standby for Vl" + v.vid + (v.kind === "preempt" ? ", priority 110 but no P" : ", P but priority 100") + ", active for every other VLAN"; } },
    { id: "ver", test: function (f) { return f.on === "dist1" && /uptime is 2 days/.test(devOut(f)); }, text: function () { return "show version on distribution switch 1: up two days, returned to ROM by reload"; } },
    { id: "run", test: function (f, v) { const o = devOut(f); return f.on === "dist1" && new RegExp("interface Vlan" + v.vid + "\\b").test(o) && new RegExp("standby " + v.vid + " ip ").test(o); }, text: function (f, v) { return "show running-config on distribution switch 1: interface Vlan" + v.vid + "'s standby lines, " + (v.kind === "preempt" ? "no preempt among them" : "no priority among them"); } }
  ],
  summary(v) {
    return { cause: "During Saturday's failover test the contractor changed distribution switch 1's standby settings for " + v.vname + " and saved: " + (v.kind === "preempt" ? "he took preempt off, so switch 1 never takes the active role back, however high its priority." : "he took its priority back to the default, 100, the same as switch 2's, and with equal priorities the higher address, switch 2's, wins.") + " While switch 1 reloaded, switch 2 became active for every group; when switch 1 came back it took every group back but that one.", fix: "On distribution switch 1, interface vlan " + v.vid + ": " + (v.kind === "preempt" ? "standby " + v.vid + " preempt" : "standby " + v.vid + " priority 110") + ", then saved. Switch 1 took the group back at once and switch 2 stood by, as the records have it." };
  }
};

/* ---------------------------------------------------------------- CP-05 */
/* Nobody on the campus reaches the internet; inside, everything works. The edge router is the only way out, and OSPF carries its
   default to every other router only while it originates one, which it does only while it has a default of its own (the provider's,
   learned with its address by DHCP). Two ways it stopped, each saved on the edge router: a clean-up took "default-information
   originate" off; or, after the provider's visit, its internet port was left on the address the engineer had it type by hand, so
   there's no lease, no default of its own, and nothing to hand on. */
const CP05 = {
  id: "CP-05", n: "05", level: 4, tier: "common", title: "No internet anywhere on the campus, though everything inside works", priority: 1, due: "1 h",
  kinds: ["originate", "wan"],
  build(seed) {
    const B = settled(seed), sim = B.sim, p = B.plan, r = rng(hash("CP-05:" + seed)), kind = r.pick(CP05.kinds), pc = r.pick(["sd1", "bn2", "fin", "tr2", "cl1"]);
    const rt = sim.d.edge.sw, isp = sim.net.isp, wan = p.edge.wan;
    if (kind === "originate") [rt.ospf, rt.startup.ospf].forEach(function (O) { delete O.originate; });
    else [rt, rt.startup].forEach(function (w) { const f = w.ifs[wan]; f.dhcp = false; f.ip = isp.wanIp; f.mask = isp.mask || "255.255.255.0"; });
    sim.bump(); sim.relink(sim.links());
    freeze(sim);
    return { sim: sim, v: { kind: kind, plan: p, pc: pc, pcName: name(sim, pc), wan: wan, wanIp: isp.wanIp, edgeIp: coreLinks(p)[0].ia, routes: JSON.stringify(rt.routes || []) } };
  },
  brief(v) { return { quote: v.kind === "originate"
    ? "Nobody at HQ or the Annex can reach the internet since this morning: email, the suppliers' sites, the card machine's updates. Inside, everything works: the file server, printing, the Annex from HQ. The " + v.pcName + " still has its address. Last night the network contractor tidied the configurations on the core routing, \"removing lines that weren't needed\", and saved."
    : "Nobody at HQ or the Annex can reach the internet since yesterday afternoon: email, the suppliers' sites, the card machine's updates. Inside, everything works: the file server, printing, the Annex from HQ. The " + v.pcName + " still has its address. Yesterday the provider's engineer was in the data room checking the line; he had someone type the line's address into the edge router by hand while he tested, said the line was fine, and left. The router was saved before he went." }; },
  mason: "Everything inside works, so the trouble is at the way out. Follow a desk's traffic towards the internet and see where it's turned back, then ask that router where it thinks the way out is.",
  affected: function (v) { return v.pc; },
  options(v) {
    const orig = { id: "originate", text: "The edge router no longer hands its default route into OSPF, so no router inside has a way out", why: "show running-config on the edge router still has default-information originate under router ospf 1. It has nothing to originate: show ip route there has no gateway of last resort." };
    const wanO = { id: "wan", text: "The edge router has no default route of its own any more, so there's nothing for it to hand into OSPF", why: "show ip route on the edge router has its gateway of last resort, the provider's, and a ping from it to the internet answers. What's missing is the line under router ospf 1 that hands it on." };
    return [
      { id: "right", right: true, text: v.kind === "originate" ? orig.text : wanO.text },
      v.kind === "originate" ? wanO : orig,
      { id: "provider", text: "The provider's line is down", why: v.kind === "originate" ? "The edge router itself reaches the internet: a ping from it to 8.8.8.8 answers, and show ip interface brief has its internet port up." : "show ip interface brief on the edge router has its internet port up, and it reaches the provider's gateway: a ping to it answers. It's the routes beyond that it has none of." },
      { id: "nat", text: "The edge router's address translation stopped, so replies can't find their way back", why: "The desks' traffic never reaches the edge router: tracert from a desk stops at its own gateway with Destination net unreachable. Translation would need the traffic to get there first." },
      { id: "ospf", text: "OSPF between the core and the distribution switches went down in the tidy-up", why: "show ip ospf neighbor on distribution switch 1 lists both core switches FULL, and every network inside is reachable from every desk." },
      { id: "dns", text: "The DNS servers the desks are given stopped answering", why: "A ping to 8.8.8.8 by its address fails too, and tracert stops at the desk's own gateway: it's routing, not names." }
    ];
  },
  rung1(v) { return "From the " + v.pcName + ": tracert to an address on the internet. Then SSH to the device that turns it back, and on to the edge router (the records have both): their routing tables, and where each one's way out comes from."; },
  rung2() { return "Routers inside a network learn the way out from the edge router, by the routing protocol, only if the edge router announces a default; and it can announce one only while it has a default route of its own to the provider."; },
  fixHints(v) { return ["On the edge router: show ip route (is there a gateway of last resort?), show running-config (the internet port, and the routing protocol's section), and a ping from it to the internet.", v.kind === "originate" ? "Put back what was tidied away: the edge router's routing protocol needs to announce its default again. Nothing inside needs changing." : "The records have the edge router's internet port taking its address, and the provider's default with it, from the provider. Put it back that way; nothing inside needs changing.", "Save it. Then from the " + v.pcName + ": a ping to the internet."]; },
  edgeRight(sim, v, saved) { const rt = sim.d.edge.sw, w = saved ? rt.startup : rt; return !!w && !!w.ospf && !!w.ospf.originate && !!w.ifs[v.wan].dhcp; },
  exhibits(sim, v) { return !CP05.edgeRight(sim, v) && !online(sim, v.pc) && !online(sim, "mgr") && !online(sim, "cl2"); },
  fixed(sim, v) { return CP05.edgeRight(sim, v) && CP05.edgeRight(sim, v, true) && JSON.stringify(sim.d.edge.sw.routes || []) === v.routes && ["sd1", "mgr", "tr1", "cl1", v.pc].every(function (d) { return online(sim, d); }); },
  partial(v, sim) {
    if (JSON.stringify(sim.d.edge.sw.routes || []) !== v.routes) return "The campus is out again, but by a default route typed into the edge router: the records have the provider hand it over with the line's address, and a route typed by hand stops working the day the provider changes its gateway.";
    if (!CP05.edgeRight(sim, v)) return "It works, but the edge router isn't set up the way the records have it.";
    if (!CP05.edgeRight(sim, v, true)) return "The campus is out again, but the edge router hasn't saved it: after the next reload, the same.";
    return "It works, but not the way the records have it.";
  },
  proves(f, sim, v) { return f.cmd === "ping" && f.dev === v.pc && f.replies > 0 && !!f.internet; },
  proofText: "a ping from a desk to the internet that gets replies",
  evidence: [
    { id: "unreach", test: function (f, v) { return f.dev === v.pc && ((f.cmd === "ping" && f.kind === "net-unreachable") || (f.cmd === "tracert" && !!f.stopAt)); }, text: function (f, v) { return (f.cmd === "tracert" ? "tracert" : "ping") + " from the " + v.pcName + ": its own gateway answers Destination net unreachable"; } },
    { id: "d1route", test: function (f) { return f.on === "dist1" && /Gateway of last resort is not set/.test(devOut(f)); }, text: function () { return "show ip route on distribution switch 1: no gateway of last resort"; } },
    { id: "d1nbr", test: function (f) { const o = devOut(f); return f.on === "dist1" && /Neighbor ID\s+Pri\s+State/.test(o) && (o.match(/FULL/g) || []).length >= 2; }, text: function () { return "show ip ospf neighbor on distribution switch 1: both core switches FULL"; } },
    { id: "edgeroute", test: function (f, v) { const o = devOut(f); return f.on === "edge" && /Gateway of last resort/.test(o) && (v.kind === "wan" ? /Gateway of last resort is not set/.test(o) : /Gateway of last resort is \S+ to network 0\.0\.0\.0/.test(o)); }, text: function (f, v) { return v.kind === "wan" ? "show ip route on the edge router: no gateway of last resort of its own" : "show ip route on the edge router: its gateway of last resort, the provider's"; } },
    { id: "edgerun", test: function (f, v) { const o = devOut(f); return f.on === "edge" && /router ospf 1/.test(o) && (v.kind === "wan" ? new RegExp("interface " + v.wan + "\\s+ip address " + v.wanIp.replace(/\./g, "\\.")).test(o) : !/default-information originate/.test(o)); }, text: function (f, v) { return v.kind === "wan" ? "show running-config on the edge router: the internet port on an address typed by hand, not from the provider" : "show running-config on the edge router: router ospf 1 without default-information originate"; } }
  ],
  summary(v) {
    return v.kind === "originate"
      ? { cause: "The contractor's tidy-up took default-information originate out of the edge router's OSPF and saved it. The edge router still had its default to the provider, but no longer announced it, so no router inside had a way out: every desk's gateway answered Destination net unreachable for the internet.", fix: "On the edge router, under router ospf 1: default-information originate, then saved. Every router inside learned the default again (O*E2), and the " + v.pcName + " reached the internet." }
      : { cause: "While the provider's engineer tested the line, the edge router's internet port was given the line's address by hand, and saved. With no DHCP lease it had no default route of its own, so it had nothing to originate: OSPF still ran, but no router inside learned a way out.", fix: "On the edge router, interface " + v.wan + ": ip address dhcp, as the records have it, then saved. It took its address and the provider's default again, announced the default into OSPF, and the " + v.pcName + " reached the internet." };
  }
};

/* ---------------------------------------------------------------- CP-06 */
/* An access switch made the root of spanning tree for its floor's VLAN: the contractor's "standard settings" on it carried a bridge
   priority for that VLAN below distribution switch 1's (CP-J2 made switch 1 root, switch 2 the next, every access switch at the
   default). Nothing is down: the access switch's two uplinks now both forward, and the bundle between the distribution switches is
   blocked for that VLAN, so their standby hellos and anything between them go round through the access switch. The monitoring flagged
   the new root. */
const CP06_KIND = {
  acc1: { vlan: "svc", floor: "1F", label: "Service desk VLAN", vname: "the service desk's VLAN" },
  acc2: { vlan: "bench", floor: "2F", label: "Bench VLAN", vname: "the bench VLAN" },
  acc3: { vlan: "office", floor: "3F", label: "Office VLAN", vname: "the office VLAN" },
  acc4: { vlan: "train", floor: "4F", label: "Training VLAN", vname: "the training VLAN" }
};
const stpPrio = function (sim, id, vid, saved) { const sw = sim.d[id].sw, w = saved ? sw.startup : sw, s = w && w.stp; return s && s.prio && s.prio[vid] != null ? s.prio[vid] : 32768; };
const stpRoot = function (sim, vid) { const all = sim.stpAll(), T = all[vid], B = T && T.result.bridges.dist1; return B ? B.root : null; };
const CP06 = {
  id: "CP-06", n: "06", level: 4, tier: "common", title: "Monitoring says the root bridge moved to an access switch", priority: 3, due: "1 day",
  kinds: ["acc1", "acc2", "acc3", "acc4"],
  build(seed) {
    const B = settled(seed), sim = B.sim, p = B.plan, r = rng(hash("CP-06:" + seed)), kind = r.pick(CP06.kinds), K = CP06_KIND[kind], V = vlanOf(p, K.vlan), prio = r.pick([0, 4096, 8192, 20480]);
    const dist = JSON.stringify(["dist1", "dist2"].map(function (d) { return [stpPrio(sim, d, V.id), stpPrio(sim, d, V.id, true)]; }));
    const sw = sim.d[kind].sw; [sw, sw.startup].forEach(function (w) { w.stp = w.stp || { mode: "rapid-pvst", prio: {} }; w.stp.prio = w.stp.prio || {}; w.stp.prio[V.id] = prio; });
    sim.bump(); sim.relink(sim.links());
    freeze(sim);
    return { sim: sim, v: { kind: kind, plan: p, sw: kind, swName: K.floor + " access switch", floor: K.floor, label: K.label, vname: K.vname, vid: V.id, prio: prio, swIp: p.sw[kind].ip, dist: dist } };
  },
  brief(v) { return { quote: "The monitoring flagged a spanning-tree topology change on " + v.vname + " overnight, and since then it reports the root bridge for that VLAN as the " + v.swName + ". Nobody has noticed anything wrong. Last night the network contractor was on the " + v.swName + ", putting on \"the standard settings\", and saved. The records have distribution switch 1 as the root for every VLAN, and distribution switch 2 as the one to take over." }; },
  mason: "Nothing's down, so ask the switches. Spanning tree is an election: find out who won, and what they voted with.",
  affected: function (v) { return v.sw; },
  options(v) {
    const s = "the " + v.swName;
    return [
      { id: "right", right: true, text: "The " + v.swName + " has a bridge priority for the VLAN below distribution switch 1's, so it won the root election" },
      { id: "mac", text: "The " + v.swName + " won on its lower hardware address: the priorities are all the same", why: "show spanning-tree on distribution switch 1 gives its own priority below the default, and the root's as lower still. Priority decides the election before any address does." },
      { id: "uplink", text: "Distribution switch 1 lost the root because its link to " + s + " went down", why: "show spanning-tree on distribution switch 1 has its port towards " + s + " up and forwarding, as its root port: the link is up, and the root is on the far side of it." },
      { id: "dist2", text: "Distribution switch 2 took the root overnight and passed it to " + s, why: "show spanning-tree on distribution switch 2 shows its own priority as the records have it, and the same root as everyone else. The root isn't passed on: every switch elects the lowest bridge ID it hears." },
      { id: "guard", text: "The settings took BPDU guard off " + s + "'s uplinks, so they now take part in the election", why: "The uplinks are trunks: BPDU guard and portfast are for the desk ports, and show running-config has the desk ports still with both. Every switch's uplinks take part in the election; what decides it is the bridge ID." },
      { id: "mode", text: s.charAt(0).toUpperCase() + s.slice(1) + " was left running a different kind of spanning tree from the others, so it doesn't hear them", why: "show spanning-tree on " + s + " says rstp, as on every other switch, and lists its uplinks as designated: it hears the others, and they've accepted it as the root." }
    ];
  },
  rung1(v) { return "SSH to distribution switch 1 and to the " + v.swName + " (the records have both addresses): show spanning-tree for the flagged VLAN on each. Who's the root, and what are the Bridge ID priorities?"; },
  rung2() { return "Every switch elects the lowest bridge ID it hears as the root: the priority first, then the address only if the priorities tie. A switch meant never to be the root keeps the default priority."; },
  fixHints(v) { return ["show running-config on the " + v.swName + ": its spanning-tree lines.", "Take off whatever makes the " + v.swName + " win: the records have every access switch at the default. Distribution switch 1 doesn't need anything.", "Save it. Then show spanning-tree for that VLAN on distribution switch 1: it should be the root again."]; },
  exhibits(sim, v) { return stpRoot(sim, v.vid) === v.sw && ["sd1", "bn1", "mgr", "tr1"].every(function (d) { return online(sim, d); }); },
  fixed(sim, v) { return stpPrio(sim, v.sw, v.vid) === 32768 && stpPrio(sim, v.sw, v.vid, true) === 32768 && JSON.stringify(["dist1", "dist2"].map(function (d) { return [stpPrio(sim, d, v.vid), stpPrio(sim, d, v.vid, true)]; })) === v.dist && stpRoot(sim, v.vid) === "dist1" && ["sd1", "bn1", "mgr", "tr1"].every(function (d) { return online(sim, d); }); },
  partial(v, sim) {
    if (JSON.stringify(["dist1", "dist2"].map(function (d) { return [stpPrio(sim, d, v.vid), stpPrio(sim, d, v.vid, true)]; })) !== v.dist) return "Distribution switch 1 is the root again, but by changing the distribution switches' priorities: the " + v.swName + " is still set to beat distribution switch 2, so if switch 1 fails the access switch becomes the root, not switch 2.";
    if (stpPrio(sim, v.sw, v.vid) !== 32768) return "Distribution switch 1 is the root again, but the " + v.swName + " isn't at the default priority the records have for every access switch: it's still placed in the election where it shouldn't be.";
    if (stpPrio(sim, v.sw, v.vid, true) !== 32768) return "Distribution switch 1 is the root again, but the " + v.swName + " hasn't saved it: after its next reload it wins again.";
    return "It works, but not the way the records have it.";
  },
  proves(f, sim, v) { return f.on === "dist1" && new RegExp("^VLAN0*" + v.vid + "\\b[\\s\\S]*?Root ID\\s+Priority\\s+\\d+\\s+Address\\s+\\S+\\s+This bridge is the root", "m").test(devOut(f)); },
  proofText: "show spanning-tree for the VLAN on distribution switch 1: this bridge is the root",
  evidence: [
    { id: "d1", test: function (f, v) { const o = devOut(f); return f.on === "dist1" && new RegExp("^VLAN0*" + v.vid + "\\b").test(o) && new RegExp("Root ID\\s+Priority\\s+" + (v.prio + v.vid) + "\\b").test(o); }, text: function (f, v) { return "show spanning-tree on distribution switch 1: the VLAN's root has priority " + (v.prio + v.vid) + ", below its own"; } },
    { id: "acc", test: function (f, v) { const o = devOut(f); return f.on === v.sw && new RegExp("^VLAN0*" + v.vid + "\\b[\\s\\S]*?This bridge is the root", "m").test(o); }, text: function (f, v) { return "show spanning-tree on the " + v.swName + ": this bridge is the root for the VLAN"; } },
    { id: "run", test: function (f, v) { return f.on === v.sw && new RegExp("spanning-tree vlan " + v.vid + " priority " + v.prio + "\\b").test(devOut(f)); }, text: function (f, v) { return "show running-config on the " + v.swName + ": a spanning-tree priority for the VLAN, " + v.prio; } }
  ],
  summary(v) {
    return { cause: "The contractor's \"standard settings\" gave the " + v.swName + " a spanning-tree priority of " + v.prio + " for " + v.vname + ", below distribution switch 1's, and saved. The lowest bridge ID wins the root election, so the access switch became the root: its uplinks both forwarding, the bundle between the distribution switches blocked for that VLAN, their traffic for it going round through the access switch.", fix: "On the " + v.swName + ": no spanning-tree vlan " + v.vid + " priority, back to the default the records have for every access switch, then saved. Distribution switch 1 won the election again, distribution switch 2 next." };
  }
};

export const CAMPUS_TICKETS = [CP01, CP02, CP03, CP04, CP05, CP06];
export const CAMPUS_COMING = [];
