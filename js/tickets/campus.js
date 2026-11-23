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
import { coreLinks, addDeskSwitch } from "../net/campus.js";
import { dotMac, chanState } from "../net/swcli.js";
import { rng, hash } from "../net/util.js";
import { exec } from "../net/cmd.js";
import { lxExec, applyNetplan } from "../net/linux.js";
import * as DHCPD from "../net/dhcpd.js";
import { SFP_MODULES } from "../net/sim.js";
const SFP_PID = Object.fromEntries(Object.keys(SFP_MODULES).map(function (k) { return [k, SFP_MODULES[k].pid]; }));
const DHCPD_CONF = DHCPD.CONF;

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
    ["The fibre between the buildings", "core switch 2 " + A.link.hqIf.replace("GigabitEthernet", "Gi") + " " + A.link.hqIp + " · the Annex core " + A.link.anxIf.replace("GigabitEthernet", "Gi") + " " + A.link.anxIp + " · mask " + A.link.mask + ", routed, in OSPF · single-mode fibre, a 1000BASE-LX module at each end"],
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

/* ---------------------------------------------------------------- CP-07 */
/* The bundle between the distribution switches (CP-J3: gi0/21 and gi0/22 at each end, LACP active at both) flagged by the monitoring
   after the contractor's "standardising". Either both ends went to passive (two passive ends never start LACP: each port stands alone,
   Po1 down at both, spanning tree blocking one of the two links), or one end was forced to "on", which bundles without LACP while the
   other end, still active, hears no LACP and stands alone (Po1 up at one end, down at the other). Nothing is down for the desks. */
const CP07_SIDE = { dist1: "distribution switch 1", dist2: "distribution switch 2" };
const chanModes = function (sim, id, saved) { const sw = sim.d[id].sw, w = saved ? sw.startup : sw; return ["GigabitEthernet0/21", "GigabitEthernet0/22"].map(function (n) { const p = w && w.ports[n]; return p && p.chan ? p.chan.mode : null; }); };
const PORT_DEFAULTS = { mode: "dynamic auto", access: 1, native: 1, allowed: "all", nonegotiate: false };   /* a switch port as it comes from the box (swcli's PORT_VLAN) */
const chanStateOf = function (sim, id, n) { const x = sim.d[id], sw = Object.assign({}, x.sw, { links: sim.switchLinks(id) }); return chanState(sw, n); };
const chanUp = function (sim, id) { const x = sim.d[id], sw = Object.assign({}, x.sw, { links: sim.switchLinks(id) }); return ["GigabitEthernet0/21", "GigabitEthernet0/22"].every(function (n) { return chanState(sw, n) === "P"; }); };
const CP07 = {
  id: "CP-07", n: "07", level: 4, tier: "common", title: "Monitoring flags the bundle between the distribution switches", priority: 3, due: "1 day",
  kinds: ["passive", "on"],
  build(seed) {
    const B = settled(seed), sim = B.sim, p = B.plan, r = rng(hash("CP-07:" + seed)), kind = r.pick(CP07.kinds), side = r.pick(["dist1", "dist2"]);
    const set = function (id, mode) { const sw = sim.d[id].sw; [sw, sw.startup].forEach(function (w) { ["GigabitEthernet0/21", "GigabitEthernet0/22"].forEach(function (n) { w.ports[n].chan.mode = mode; }); }); };
    if (kind === "passive") { set("dist1", "passive"); set("dist2", "passive"); } else set(side, "on");
    sim.bump(); sim.relink(sim.links());
    freeze(sim);
    return { sim: sim, v: { kind: kind, side: kind === "on" ? side : null, sideName: kind === "on" ? CP07_SIDE[side] : null, plan: p } };
  },
  brief(v) { return { quote: "The monitoring flagged the link between the two distribution switches this morning: \"Port-channel1 " + (v.kind === "passive" ? "down on both switches" : "down on " + CP07_SIDE[v.side === "dist1" ? "dist2" : "dist1"] + ", up on " + v.sideName) + "\". Nobody has noticed anything. Last night the network contractor was \"standardising the link settings\" on the distribution switches, and saved. The records have the two links between them bundled into one, both ends negotiating it." }; },
  mason: "Two ends of one link have to agree. Ask each end what it thinks it's doing, then ask it about the other.",
  affected: function () { return "dist1"; },
  options(v) {
    const pas = { id: "passive", text: "Both ends of the bundle wait for the other to start the negotiation, so neither does and each link stands alone", why: "show etherchannel summary on " + (v.side ? v.sideName : "distribution switch 1") + " shows no negotiation at all at that end: its ports are bundled by force. The other end, still negotiating, gets no answer." };
    const on = { id: "on", text: "One end is forced into the bundle without negotiating, so the other end, still negotiating, hears nothing and stands alone", why: "show running-config at both ends has the bundle waiting for the other end to start the negotiation: neither is forced. Two waiting ends never start it, so neither end bundles." };
    return [
      { id: "right", right: true, text: v.kind === "passive" ? pas.text : on.text },
      v.kind === "passive" ? on : pas,
      { id: "cable", text: "One of the two links between the distribution switches is unplugged or broken", why: "show interfaces status at each end has gi0/21 and gi0/22 connected: both links are up. It's the bundle that hasn't formed." },
      { id: "vlans", text: "The two links carry different VLANs, so one is suspended from the bundle", why: "A link suspended for mismatched settings shows (s) in show etherchannel summary; these show (I), standing alone, " + (v.kind === "on" ? "or (P) at the forced end, " : "") + "and show running-config gives both links the same trunk settings." },
      { id: "speed", text: "One link runs at a different speed, and a bundle won't take mismatched members", why: "show interfaces status at both ends has both links at a-1000, full duplex: the same speed. A mismatched member would be suspended (s), not standing alone (I)." },
      { id: "stp", text: "Spanning tree blocked the bundle because it saw a loop", why: "Spanning tree blocks one of the two separate links because there's no bundle; it doesn't stop a bundle forming. show etherchannel summary says why it hasn't: the negotiation." }
    ];
  },
  rung1() { return "SSH to both distribution switches (the records have their addresses): show etherchannel summary on each, then show running-config for the two links at each end."; },
  rung2() { return "A bundle that negotiates needs at least one end to start the negotiation: two ends that only wait never begin. And an end forced into the bundle doesn't negotiate at all, so an end that does hears nothing from it."; },
  fixHints() { return ["Compare the two links' bundle lines at each end with what the records have: both ends negotiating, both starting it.", "Change only what was changed, on both links of the end (or ends) that differ.", "Save each switch you change. Then show etherchannel summary at both ends: the bundle up, both links in it."]; },
  modesRight(sim, saved) { return ["dist1", "dist2"].every(function (id) { return chanModes(sim, id, saved).every(function (m) { return m === "active"; }); }); },
  exhibits(sim, v) { return !CP07.modesRight(sim) && !(chanUp(sim, "dist1") && chanUp(sim, "dist2")) && ["sd1", "bn1", "mgr", "tr1"].every(function (d) { return online(sim, d); }); },
  fixed(sim, v) { return CP07.modesRight(sim) && CP07.modesRight(sim, true) && chanUp(sim, "dist1") && chanUp(sim, "dist2") && ["sd1", "bn1", "mgr", "tr1"].every(function (d) { return online(sim, d); }); },
  partial(v, sim) {
    if (!CP07.modesRight(sim)) return "The bundle is up, but not as the records have it: both ends start the negotiation, so either can bring it back after the other restarts. " + (["dist1", "dist2"].some(function (id) { return chanModes(sim, id).some(function (m) { return m === "on"; }); }) ? "An end forced on doesn't negotiate at all, and a mismatch there goes unnoticed." : "One end still only waits.");
    if (!CP07.modesRight(sim, true)) return "The bundle is up, but a distribution switch hasn't saved its change: after its next reload, the same.";
    return "It works, but not the way the records have it.";
  },
  proves(f, sim, v) { return (f.on === "dist1" || f.on === "dist2") && /^1\s+Po1\(SU\)\s+LACP\s+Gi0\/21\(P\)\s+Gi0\/22\(P\)/m.test(devOut(f)); },
  proofText: "show etherchannel summary: Po1 up and in use, negotiated, both links in it",
  evidence: [
    { id: "ec", test: function (f) { const o = devOut(f); return (f.on === "dist1" || f.on === "dist2") && /^1\s+Po1\(S[DU]\)/m.test(o) && !/^1\s+Po1\(SU\)\s+LACP\s+Gi0\/21\(P\)\s+Gi0\/22\(P\)/m.test(o); }, text: function (f) { return "show etherchannel summary on " + CP07_SIDE[f.on] + ": " + (devOut(f).match(/^1\s+Po1.*$/m) || [""])[0].replace(/\s+/g, " ").replace(/^1 /, ""); } },
    { id: "run", test: function (f, v) { const o = devOut(f); return (f.on === "dist1" || f.on === "dist2") && /channel-group 1 mode (passive|on)/.test(o); }, text: function (f, v) { return "show running-config: the links' channel-group lines, " + (v.kind === "passive" ? "mode passive" : "mode on at one end"); } },
    { id: "stat", test: function (f) { const o = devOut(f); return (f.on === "dist1" || f.on === "dist2") && /^Gi0\/21\s.*connected/m.test(o) && /^Gi0\/22\s.*connected/m.test(o); }, text: function () { return "show interfaces status: gi0/21 and gi0/22 both connected"; } }
  ],
  summary(v) {
    return v.kind === "passive"
      ? { cause: "The contractor's standardising set both ends of the bundle to LACP passive, and saved. A passive port answers LACP but never starts it, so with both ends waiting neither began: each link stood alone (I), Po1 was down at both ends, and spanning tree blocked one of the two links.", fix: "On both distribution switches, interface range gi0/21 - 22: channel-group 1 mode active, as the records have it, then saved. LACP came up and both links joined Po1 at each end." }
      : { cause: "The contractor's standardising forced " + v.sideName + "'s end of the bundle on, without LACP, and saved. That end bundled its links by force; the other end, still running LACP active, heard no LACP back and left each link standing alone (I). A forced end also can't notice a mismatch, which is why the records have both ends negotiating.", fix: "On " + v.sideName + ", interface range gi0/21 - 22: channel-group 1 mode active, as the records have it, then saved. LACP came up and both links joined Po1 at each end." };
  }
};

/* ---------------------------------------------------------------- CP-08 */
/* One link of the bundle between the distribution switches suspended: chasing something else, someone changed a trunk setting on one
   member port by itself, and saved. A member has to match its port-channel's trunk settings, so that link is suspended (s): the
   bundle stays up on the other link alone, at half its speed. Either a VLAN taken off the one link's allowed list, or its native VLAN
   taken back to the default. */
const CP08 = {
  id: "CP-08", n: "08", level: 4, tier: "common", title: "The bundle between the distribution switches running on one link", priority: 3, due: "1 day",
  kinds: ["vlan", "native"],
  build(seed) {
    const B = settled(seed), sim = B.sim, p = B.plan, r = rng(hash("CP-08:" + seed)), kind = r.pick(CP08.kinds), side = r.pick(["dist1", "dist2"]), n = r.pick(["GigabitEthernet0/21", "GigabitEthernet0/22"]);
    const sw = sim.d[side].sw, pc = JSON.stringify([sim.d.dist1.sw.pcs, sim.d.dist2.sw.pcs]);
    const drop = r.pick([p.backup.id, p.vlans.printers.id, p.train.id]);
    [sw, sw.startup].forEach(function (w) { const q = w.ports[n]; if (kind === "vlan") q.allowed = q.allowed.filter(function (x) { return x !== drop; }); else q.native = 1; });
    sim.bump(); sim.relink(sim.links());
    freeze(sim);
    return { sim: sim, v: { kind: kind, plan: p, side: side, sideName: CP07_SIDE[side], port: n, short: n.replace("GigabitEthernet", "Gi"), drop: kind === "vlan" ? drop : null, pc: pc } };
  },
  brief(v) { return { quote: "The monitoring flagged the link between the two distribution switches this morning: \"Port-channel1 bandwidth halved on " + v.sideName + "\". Nothing is down, and nobody has noticed. Yesterday the network contractor was chasing a slow transfer between the floors and \"tried a few things\" on the distribution switches; he says he put everything back, and saved." }; },
  mason: "A bundle is only as good as its members agreeing. Find the one that doesn't, then find what it disagrees about.",
  affected: function (v) { return v.side; },
  options(v) {
    const vl = { id: "vlan", text: "One link of the bundle carries a different list of VLANs from the bundle, so it's suspended from it", why: "show running-config has both links' allowed VLANs the same as the port-channel's. What differs on the suspended link is its native VLAN." };
    const nat = { id: "native", text: "One link of the bundle has a different native VLAN from the bundle, so it's suspended from it", why: "show running-config has both links' native VLAN the same as the port-channel's. What differs on the suspended link is the VLANs it's allowed to carry." };
    return [
      { id: "right", right: true, text: v.kind === "vlan" ? vl.text : nat.text },
      v.kind === "vlan" ? nat : vl,
      { id: "cable", text: "One of the two links is unplugged or broken", why: "show interfaces status on " + v.sideName + " has both links connected: a dead link shows notconnect, and show etherchannel summary would mark it down (D), not suspended (s)." },
      { id: "negotiate", text: "One end stopped negotiating the bundle, so both links stand alone", why: "show etherchannel summary on " + v.sideName + " has the bundle up (SU) with one link in it (P): negotiation works. The other link is suspended (s), which is about its settings, not the negotiation." },
      { id: "speed", text: "One link runs at 100 Mb/s, and the bundle won't take a slower member", why: "show interfaces status has both links at a-1000, full duplex: the same speed." },
      { id: "stp", text: "Spanning tree blocked one of the two links because it saw a loop", why: "Spanning tree sees the bundle as one port, Po1, and shows it forwarding. A link inside a bundle is never blocked on its own; the suspended one was taken out of the bundle for its settings." }
    ];
  },
  rung1(v) { return "SSH to " + v.sideName + " (the records have its address): show etherchannel summary, then show running-config for the port-channel and for each of its links."; },
  rung2() { return "A link joins a bundle only if its trunk settings match the port-channel's exactly: its mode, its native VLAN, the VLANs it's allowed to carry. One that differs is suspended, and the bundle runs without it."; },
  fixHints(v) { return ["Put the suspended link's trunk lines beside the port-channel's: one line differs.", "Make the link match the port-channel, not the other way round: the port-channel is as the records have it.", "Save it. Then show etherchannel summary on " + v.sideName + ": both links in the bundle."]; },
  memberRight(sim, v, saved) { const sw = sim.d[v.side].sw, w = saved ? sw.startup : sw, q = w.ports[v.port], pc = w.pcs[1], val = function (o, k) { return JSON.stringify(o[k] === undefined ? PORT_DEFAULTS[k] : o[k]); }; return ["mode", "native", "allowed"].every(function (k) { return val(q, k) === val(pc, k); }); },
  exhibits(sim, v) { return !CP08.memberRight(sim, v) && chanStateOf(sim, v.side, v.port) === "s" && ["sd1", "bn1", "mgr", "tr1"].every(function (d) { return online(sim, d); }); },
  fixed(sim, v) { return CP08.memberRight(sim, v) && CP08.memberRight(sim, v, true) && JSON.stringify([sim.d.dist1.sw.pcs, sim.d.dist2.sw.pcs]) === v.pc && chanUp(sim, "dist1") && chanUp(sim, "dist2") && ["sd1", "bn1", "mgr", "tr1"].every(function (d) { return online(sim, d); }); },
  partial(v, sim) {
    if (JSON.stringify([sim.d.dist1.sw.pcs, sim.d.dist2.sw.pcs]) !== v.pc) return "Both links are in the bundle again, but the port-channel was changed to match the link: the records have the bundle as it was, and every VLAN and the native VLAN on it as before.";
    if (!CP08.memberRight(sim, v, true)) return "Both links are in the bundle again, but " + v.sideName + " hasn't saved it: after its next reload the link is suspended again.";
    return "It works, but not the way the records have it.";
  },
  proves(f, sim, v) { return f.on === v.side && /^1\s+Po1\(SU\)\s+LACP\s+Gi0\/21\(P\)\s+Gi0\/22\(P\)/m.test(devOut(f)); },
  proofText: "show etherchannel summary on that switch: both links in the bundle",
  evidence: [
    { id: "ec", test: function (f, v) { return f.on === v.side && new RegExp(v.short.replace("/", "\\/") + "\\(s\\)").test(devOut(f)); }, text: function (f, v) { return "show etherchannel summary on " + v.sideName + ": " + v.short + " suspended (s), the bundle up on the other link"; } },
    { id: "run", test: function (f, v) { const o = devOut(f); return f.on === v.side && new RegExp("interface " + v.port + "\\b").test(o) && /interface Port-channel1\b/.test(o); }, text: function (f, v) { return "show running-config on " + v.sideName + ": " + v.short + "'s trunk lines against Port-channel1's"; } },
    { id: "stat", test: function (f, v) { const o = devOut(f); return f.on === v.side && /^Gi0\/21\s.*connected/m.test(o) && /^Gi0\/22\s.*connected/m.test(o); }, text: function (f, v) { return "show interfaces status on " + v.sideName + ": both links connected"; } }
  ],
  summary(v) {
    return { cause: "Chasing a slow transfer, the contractor changed " + v.short + " on " + v.sideName + " by itself, " + (v.kind === "vlan" ? "taking VLAN " + v.drop + " off its allowed list" : "taking its native VLAN back to the default, 1") + ", and saved. A link has to match its port-channel's trunk settings to stay in the bundle, so " + v.short + " was suspended and Po1 ran on the other link alone, at half its speed.", fix: "On " + v.sideName + ", interface " + v.short + ": " + (v.kind === "vlan" ? "switchport trunk allowed vlan add " + v.drop : "switchport trunk native vlan " + v.plan.vlans.native.id) + ", the same as Port-channel1, then saved. The link rejoined the bundle (P)." };
  }
};

/* ---------------------------------------------------------------- CP-09 */
/* One of distribution switch 1's two OSPF neighbours (the core switches, one on each uplink, CP-J5) not FULL, flagged by the
   monitoring. Nothing is down: the other uplink carries everything. Either the contractor, testing for a VPN, lowered one uplink's IP
   MTU (the two ends' MTUs differ, so the pair never gets past exchanging their databases: EXSTART), or a router ID was set on
   distribution switch 1 from a configuration copied off core switch 1 (two routers with one ID never become neighbours). Saved. */
const CP09_UP = { "GigabitEthernet0/19": "core1", "GigabitEthernet0/20": "core2" };
const ospfNbr = function (sim, core) { const L = sim.ospfLive("dist1"), c = sim.ospfLive(core); return ((L && L.nbrs) || []).find(function (q) { return q.rid === (c && c.rid); }) || null; };
const CP09 = {
  id: "CP-09", n: "09", level: 4, tier: "common", title: "An OSPF neighbour on distribution switch 1 not coming up", priority: 3, due: "1 day",
  kinds: ["mtu", "rid"],
  build(seed) {
    const B = settled(seed), sim = B.sim, p = B.plan, r = rng(hash("CP-09:" + seed)), kind = r.pick(CP09.kinds), port = kind === "rid" ? "GigabitEthernet0/19" : r.pick(["GigabitEthernet0/19", "GigabitEthernet0/20"]), core = CP09_UP[port];
    const mtu = r.pick([1400, 1476, 1492]), sw = sim.d.dist1.sw, coreRid = sim.ospfLive("core1").rid;
    [sw, sw.startup].forEach(function (w) { if (kind === "mtu") w.ports[port].mtu = mtu; else w.ospf.rid = coreRid; });
    sim.bump(); sim.relink(sim.links());
    freeze(sim);
    return { sim: sim, v: { kind: kind, plan: p, port: port, short: port.replace("GigabitEthernet", "Gi"), core: core, coreName: core === "core1" ? "core switch 1" : "core switch 2", mtu: kind === "mtu" ? mtu : null, coreRid: coreRid } };
  },
  brief(v) { return { quote: v.kind === "mtu"
    ? "The monitoring flagged distribution switch 1 this morning: \"OSPF neighbour " + v.coreName + ": state EXSTART for 14 hours\". Nothing is down, and nobody has noticed. Yesterday the network contractor was on distribution switch 1 testing settings for next month's VPN to the branch, and saved before he left."
    : "The monitoring flagged distribution switch 1 this morning: \"OSPF neighbour " + v.coreName + ": lost\". Nothing is down, and nobody has noticed. Yesterday the network contractor tidied distribution switch 1's routing settings, copying a few lines across from the core switches' configurations \"to keep them consistent\", and saved." }; },
  mason: "A neighbour that won't come up has a reason it can't agree with you. Look at what each end says about itself on that link.",
  affected: function () { return "dist1"; },
  options(v) {
    const mtu = { id: "mtu", text: "The two ends of that link have different IP MTUs, so the pair can't finish exchanging their databases", why: "show running-config on distribution switch 1 has no ip mtu on either uplink: both are at the default, like the core's. The pair isn't stuck exchanging databases; it never forms at all." };
    const rid = { id: "rid", text: "Distribution switch 1 has the same router ID as " + v.coreName + ", so the two never become neighbours", why: "show ip protocols on distribution switch 1 gives a router ID no other router has. The neighbour gets as far as EXSTART, so they've agreed who's who; it's the database exchange that stalls." };
    return [
      { id: "right", right: true, text: v.kind === "mtu" ? mtu.text : rid.text },
      v.kind === "mtu" ? rid : mtu,
      { id: "link", text: "The uplink to " + v.coreName + " is down", why: "show ip interface brief on distribution switch 1 has " + v.short + " up and up, and a ping to " + v.coreName + "'s end of the link answers." },
      { id: "passive", text: "OSPF is set passive on distribution switch 1's uplink to " + v.coreName, why: "show ip protocols on distribution switch 1 lists every interface passive but the two uplinks, as the records have it: both uplinks send hellos." },
      { id: "area", text: "That uplink is in a different OSPF area from " + v.coreName + "'s end", why: "show ip ospf interface brief on distribution switch 1 has both uplinks in area 0, and so does its network statement: one area, as the records have it." },
      { id: "cost", text: "The uplink's OSPF cost was raised, so " + v.coreName + " is no longer used", why: "A cost decides which path routes use; it doesn't stop a neighbour forming. show ip ospf interface brief has both uplinks at the same cost, and the neighbour itself is what's missing." }
    ];
  },
  rung1(v) { return "SSH to distribution switch 1 (the records have its address): show ip ospf neighbor, show ip protocols, show ip ospf interface brief, then show running-config for its two uplinks. Compare the uplink to " + v.coreName + " with the other one."; },
  rung2() { return "Two routers become OSPF neighbours only if they agree: the same area, subnet and mask on the link, different router IDs, and, to finish exchanging their databases, the same largest packet size (MTU) at both ends."; },
  fixHints(v) { return ["Put the two uplinks' lines side by side in show running-config, and read show ip protocols: what differs from the records, and from the other uplink?", "Take off what the contractor added that the records don't have; the core switches need nothing.", "Save it. Then show ip ospf neighbor on distribution switch 1: both core switches FULL."]; },
  d1Right(sim, v, saved) { const sw = sim.d.dist1.sw, w = saved ? sw.startup : sw; return !w.ports["GigabitEthernet0/19"].mtu && !w.ports["GigabitEthernet0/20"].mtu && !w.ospf.rid; },
  exhibits(sim, v) { const q = ospfNbr(sim, v.core); return !CP09.d1Right(sim, v) && (!q || !/^FULL/.test(q.state)) && ["sd1", "bn1", "mgr", "tr1", "cl1"].every(function (d) { return online(sim, d); }); },
  fixed(sim, v) { return CP09.d1Right(sim, v) && CP09.d1Right(sim, v, true) && ["core1", "core2"].every(function (c) { const q = ospfNbr(sim, c); return !!q && /^FULL/.test(q.state); }) && ["sd1", "bn1", "mgr", "tr1", "cl1"].every(function (d) { return online(sim, d); }); },
  partial(v, sim) {
    if (!CP09.d1Right(sim, v)) return "Both neighbours are FULL, but distribution switch 1 isn't as the records have it: they keep every uplink at the default MTU and let each router pick its own ID. Whatever was set to get there will catch someone out later.";
    if (!CP09.d1Right(sim, v, true)) return "Both neighbours are FULL, but distribution switch 1 hasn't saved it: after its next reload, the same.";
    return "It works, but not the way the records have it.";
  },
  proves(f, sim, v) { const o = devOut(f); return f.on === "dist1" && /Neighbor ID\s+Pri\s+State/.test(o) && (o.match(/FULL/g) || []).length >= 2 && !/EXSTART/.test(o); },
  proofText: "show ip ospf neighbor on distribution switch 1: both core switches FULL",
  evidence: [
    { id: "nbr", test: function (f, v) { const o = devOut(f); return f.on === "dist1" && /Neighbor ID\s+Pri\s+State/.test(o) && (v.kind === "mtu" ? /EXSTART/.test(o) : (o.match(/FULL/g) || []).length === 1); }, text: function (f, v) { return v.kind === "mtu" ? "show ip ospf neighbor on distribution switch 1: " + v.coreName + " stuck in EXSTART" : "show ip ospf neighbor on distribution switch 1: one core switch FULL, " + v.coreName + " missing"; } },
    { id: "run", test: function (f, v) { const o = devOut(f); return f.on === "dist1" && (v.kind === "mtu" ? new RegExp("ip mtu " + v.mtu + "\\b").test(o) : new RegExp("router-id " + v.coreRid.replace(/\./g, "\\.")).test(o)); }, text: function (f, v) { return v.kind === "mtu" ? "show running-config on distribution switch 1: ip mtu " + v.mtu + " on " + v.short : "show running-config on distribution switch 1: router-id " + v.coreRid + " under router ospf 1"; } },
    { id: "proto", test: function (f, v) { return f.on === "dist1" && new RegExp("Router ID " + (v.kind === "rid" ? v.coreRid.replace(/\./g, "\\.") : "\\S+")).test(devOut(f)) && /Routing Protocol is "ospf/.test(devOut(f)); }, text: function (f, v) { return "show ip protocols on distribution switch 1: its router ID" + (v.kind === "rid" ? ", " + v.coreRid + ", " + v.coreName + "'s own" : ""); } }
  ],
  summary(v) {
    return v.kind === "mtu"
      ? { cause: "Testing for next month's VPN, the contractor set ip mtu " + v.mtu + " on distribution switch 1's uplink to " + v.coreName + " and saved. OSPF checks the MTU while two routers exchange their databases: with 1500 at the core's end and " + v.mtu + " at this end they never got past it, stuck in EXSTART, and that link carried no routes.", fix: "On distribution switch 1, interface " + v.short + ": no ip mtu, back to the default like the core's end, then saved. The neighbour came up FULL." }
      : { cause: "Copying lines across from the core switches' configurations, the contractor gave distribution switch 1 router-id " + v.coreRid + ", core switch 1's own, and saved. Two OSPF routers with the same ID never become neighbours, so that uplink carried no routes.", fix: "On distribution switch 1, under router ospf 1: no router-id, so it picks its own again, then saved. The neighbour came up FULL." };
  }
};

/* ---------------------------------------------------------------- CP-10 */
/* A floor's DHCP relays reverted. Both distribution switches relay each desk VLAN's requests to the DHCP server on the file server
   (CP-J10); the contractor re-applied the floor's VLAN interface lines from an old change sheet on both, and saved, so the floor's
   requests now go to the edge router's old address (its pools went in CP-J10), or to the backup server's (one digit off the file
   server's), or nowhere. Desks with a lease from before keep working; one that asks again gets 169.254. */
const CP10 = {
  id: "CP-10", n: "10", level: 4, tier: "common", title: "A desk on one floor gets no address since the weekend", priority: 2, due: "2 h",
  kinds: ["old", "typo", "gone"],
  build(seed) {
    const B = settled(seed), sim = B.sim, p = B.plan, r = rng(hash("CP-10:" + seed)), kind = r.pick(CP10.kinds), vk = r.pick(["svc", "bench", "office", "train"]), K = CP03_KIND[vk], V = vlanOf(p, vk);
    const pc = r.pick(K.pcs), other = K.pcs.find(function (d) { return d !== pc; });
    const to = kind === "old" ? [coreLinks(p)[0].ia] : kind === "typo" ? [p.srv.bksrv.ip] : [];
    ["dist1", "dist2"].forEach(function (id) { const sw = sim.d[id].sw; [sw, sw.startup].forEach(function (w) { w.svis[String(V.id)].helpers = to.slice(); }); });
    sim.bump(); sim.relink(sim.links());
    exec(sim, pc, "ipconfig /release"); exec(sim, pc, "ipconfig /renew");   /* Monday morning: the desk asks again */
    freeze(sim);
    return { sim: sim, v: { kind: kind, plan: p, vk: vk, vid: V.id, label: CP06_KIND[{ svc: "acc1", bench: "acc2", office: "acc3", train: "acc4" }[vk]].label, pc: pc, pcName: name(sim, pc), other: other, otherName: name(sim, other), floor: K.floor, room: K.room, to: to, srv: p.srv.fsrv.ip, vnet: V.net.replace(/0$/, "") } };
  },
  brief(v) { return { quote: "The " + v.pcName + " has no network this morning: it was moved to a new desk on Friday and restarted today. The " + v.otherName + ", on the same floor, works fine, and so does everyone else. Over the weekend the network contractor re-applied the settings for that floor's network on both distribution switches \"from the change sheet\", and saved." }; },
  mason: "One desk asked for something this morning and the other didn't need to. Follow the asking.",
  affected: function (v) { return v.pc; },
  options(v) {
    return [
      { id: "right", right: true, text: "The floor's requests for an address are relayed somewhere that doesn't hand addresses out" + (v.kind === "gone" ? " (or nowhere at all)" : "") + ", on both distribution switches" },
      { id: "pool", text: "The DHCP server has run out of addresses for the floor's network", why: "The server's lease list for the floor has plenty free, and its log shows no request from the floor's network arriving at all: it never heard the desk ask." },
      { id: "service", text: "The DHCP server stopped running over the weekend", why: "systemctl status on the file server has it active (running), and a desk on another floor that asks for an address gets one." },
      { id: "port", text: "The new desk's switch port is shut or in the wrong VLAN", why: "ipconfig on the " + v.pcName + " shows a link, and the access switch has its port connected in the floor's VLAN, with the " + v.otherName + " beside it working." },
      { id: "dist1", text: "Only distribution switch 1's relay for the floor is wrong; distribution switch 2 would still get the request through", why: "Both distribution switches relay the floor's requests, and both have the same wrong setting: either alone, right, would have got the desk its address." },
      { id: "apipa", text: "The " + v.pcName + "'s network settings were set by hand to 169.254 when it was moved", why: "ipconfig /all on the " + v.pcName + " says DHCP Enabled: Yes, and Autoconfiguration: it gave itself 169.254 because nothing answered." }
    ];
  },
  rung1(v) { return "On the " + v.pcName + ": ipconfig /all. Then SSH to both distribution switches (the records have their addresses): show running-config for the floor's VLAN interface, and compare it with another floor's. The DHCP server's own log on the file server says who it heard from."; },
  rung2() { return "A PC asks for an address with a broadcast, which stops at its own VLAN. The router for that VLAN has to pass the request on to the DHCP server, to an address it's been given; given the wrong one, or none, the request goes nowhere useful."; },
  fixHints(v) { return ["Compare the floor's VLAN interface lines on each distribution switch with another floor's: the line that passes requests on differs.", "Put it right on both switches, as every other floor has it: the records give the DHCP server's address.", "Save both. Then on the " + v.pcName + ": ask for an address again, and ping the internet."]; },
  relayRight(sim, v, saved) { return ["dist1", "dist2"].every(function (id) { const sw = sim.d[id].sw, w = saved ? sw.startup : sw, h = w.svis[String(v.vid)].helpers || []; return h.length === 1 && h[0] === v.srv; }); },
  exhibits(sim, v) { const a = sim.addr(v.pc); return !CP10.relayRight(sim, v) && !!a && /^169\.254\./.test(a.ip) && online(sim, v.other); },
  fixed(sim, v) { return CP10.relayRight(sim, v) && CP10.relayRight(sim, v, true) && online(sim, v.pc) && online(sim, v.other) && sim.d[v.pc].ifaces[0].lease && sim.d[v.pc].ifaces[0].lease.server === v.srv && ["sd1", "bn1", "mgr", "tr1"].every(function (d) { return online(sim, d); }); },
  partial(v, sim) {
    const L = sim.d[v.pc].ifaces[0].lease;
    if (!L || L.server !== v.srv) return "The " + v.pcName + " is online, but not with an address from the DHCP server: set by hand, it's outside what the server knows about, and the next desk moved will have the same trouble.";
    if (!CP10.relayRight(sim, v)) return "The " + v.pcName + " has its address, but only one distribution switch relays the floor's requests to the DHCP server: with that one off, the floor's desks get none. The records have both relaying.";
    if (!CP10.relayRight(sim, v, true)) return "The " + v.pcName + " has its address, but a distribution switch hasn't saved the change: after its next reload the floor's requests go astray again.";
    return "It works, but not the way the records have it.";
  },
  proves(f, sim, v) { return f.cmd === "ping" && f.dev === v.pc && f.replies > 0 && !!f.internet; },
  proofText: "a ping from the desk to the internet that gets replies, with an address from the DHCP server",
  evidence: [
    { id: "apipa", test: function (f, v) { return f.cmd === "ipconfig" && f.dev === v.pc && !!f.apipa; }, text: function (f, v) { return "ipconfig on the " + v.pcName + ": 169.254, an address it gave itself"; } },
    { id: "other", test: function (f, v) { return f.cmd === "ipconfig" && f.dev === v.other && !!f.ip && !f.apipa; }, text: function (f, v) { return "ipconfig on the " + v.otherName + ": its address from before the weekend, still good"; } },
    { id: "run", test: function (f, v) { const o = devOut(f), blk = (o.split("interface Vlan" + v.vid + "\n")[1] || "").split("!")[0]; return (f.on === "dist1" || f.on === "dist2") && o.indexOf("interface Vlan" + v.vid + "\n") >= 0 && blk.indexOf("ip helper-address " + v.srv) < 0; }, text: function (f, v) { return "show running-config on " + CP07_SIDE[f.on] + ": interface Vlan" + v.vid + (v.to.length ? " relays to " + v.to[0] + ", not the DHCP server" : " relays to nothing"); } },
    { id: "journal", test: function (f, v) { const o = devOut(f); return f.on === "fsrv" && /DHCPDISCOVER/.test(o) && o.indexOf("via " + v.vnet) < 0; }, text: function () { return "the DHCP server's log: requests from other floors, none from this one"; } }
  ],
  summary(v) {
    return { cause: "Re-applying the floor's VLAN interface lines from an old change sheet, the contractor left both distribution switches relaying the floor's DHCP requests " + (v.kind === "old" ? "to the edge router's old address, where the pools were before the DHCP server took over" : v.kind === "typo" ? "to " + v.to[0] + ", the backup server, one digit off the file server's address" : "nowhere: the relay line was gone") + ", and saved. Desks with a lease from before kept working; the " + v.pcName + ", asking again, heard nothing and gave itself 169.254.", fix: "On both distribution switches, interface vlan " + v.vid + ": " + (v.to.length ? "no ip helper-address " + v.to[0] + ", " : "") + "ip helper-address " + v.srv + ", then saved. The " + v.pcName + " asked again and got its address from the DHCP server." };
  }
};

/* ---------------------------------------------------------------- CP-11 */
/* The Annex core's end of the fibre re-addressed in a tidy-up "from the IPAM sheet", and saved. Either the mask was typed wider than the
   link's (the two ends still reach each other, a ping across answers, but OSPF won't make neighbours of two ends with different masks),
   or the address typed is outside the link's block altogether (the ends can't reach each other at all). Either way the Annex core has
   no neighbour, no routes out, and the classroom reaches nothing beyond its building. Core switch 2's end is as it was. */
const CP11 = {
  id: "CP-11", n: "11", level: 4, tier: "common", title: "The Annex cut off after its core switch was tidied", priority: 1, due: "1 h",
  kinds: ["mask", "addr"],
  build(seed) {
    const B = settled(seed), sim = B.sim, p = B.plan, r = rng(hash("CP-11:" + seed)), kind = r.pick(CP11.kinds), L = p.annex.link, pc = r.pick(["cl1", "cl2"]);
    const mask = r.pick(["255.255.255.248", "255.255.255.240"]), addr = L.anxIp.replace(/\.(\d+)$/, function (m, d) { return "." + (+d + r.pick([3, 4, 7])); });   /* a usable address in another block (.37, .38, .41), never a block's own address or its broadcast */
    const sw = sim.d.anxc.sw; [sw, sw.startup].forEach(function (w) { const q = w.ports[L.anxIf]; if (kind === "mask") q.mask = mask; else q.ip = addr; });
    sim.bump(); sim.relink(sim.links());
    freeze(sim);
    return { sim: sim, v: { kind: kind, plan: p, pc: pc, pcName: name(sim, pc), port: L.anxIf, short: L.anxIf.replace("GigabitEthernet", "Gi"), ip: L.anxIp, peer: L.hqIp, mask: L.mask, badMask: kind === "mask" ? mask : null, badIp: kind === "addr" ? addr : null, swIp: p.annex.core.ip } };
  },
  brief(v) { return { quote: "Since Monday the Training Annex's classroom can't reach anything outside its own building: not the internet, not the file server at HQ. The " + v.pcName + " still has its address. HQ is fine. Over the weekend the network contractor tidied the Annex core switch's addressing \"to match the IPAM sheet\", and saved; the fibre and both modules were checked last month." }; },
  mason: "Start at the classroom and walk out towards HQ. Where does it stop, and does each end of that link agree about the link?",
  affected: function (v) { return v.pc; },
  options(v) {
    const mk = { id: "mask", text: "The Annex core's end of the fibre has a different mask from core switch 2's, so OSPF won't make them neighbours", why: "show running-config on the Annex core has the fibre port at the link's mask; it's the address that's outside the link's block, so the two ends can't reach each other at all (a ping across fails)." };
    const ad = { id: "addr", text: "The Annex core's end of the fibre has an address outside the link's block, so the two ends can't reach each other", why: "A ping from the Annex core to core switch 2's end of the link answers: they reach each other. The address is in the link's block; what differs is the mask." };
    return [
      { id: "right", right: true, text: v.kind === "mask" ? mk.text : ad.text },
      v.kind === "mask" ? ad : mk,
      { id: "fibre", text: "The fibre between the buildings is down", why: "show interfaces status on the Annex core has its fibre port connected, and show ip interface brief has it up and up." },
      { id: "passive", text: "The tidy-up made the Annex core's fibre port passive under OSPF", why: "show ip protocols on the Annex core lists every interface passive but the fibre port, as the records have it." },
      { id: "module", text: "The modules at the two ends are different kinds since last month's check", why: "The link is up at both ends: show interfaces status says connected, which a mismatched pair of modules never would." },
      { id: "gateway", text: "The classroom PCs' gateway was changed in the tidy-up", why: "ipconfig on the " + v.pcName + " shows the gateway the records give, and a ping to it answers: the Annex core is reachable, it just has no way on." }
    ];
  },
  rung1(v) { return "From the " + v.pcName + ": tracert to an address at HQ. Then SSH to the Annex core (the records have its address): show ip ospf neighbor, show ip interface brief, show running-config for the fibre port; compare it with what the records give for the fibre, and ping core switch 2's end."; },
  rung2() { return "Two ends of a routed link must be in the same block, with the same mask, to talk at all and to become OSPF neighbours: OSPF checks the mask in every hello and ignores a neighbour whose mask differs."; },
  fixHints(v) { return ["The records give both ends of the fibre, and its mask. Put the Annex core's end beside them.", "Correct the Annex core's end to the records; core switch 2's end is right.", "Save it. Then from the " + v.pcName + ": a ping to the internet."]; },
  portRight(sim, v, saved) { const sw = sim.d.anxc.sw, w = saved ? sw.startup : sw, q = w.ports[v.port]; return q.ip === v.ip && q.mask === v.mask; },
  exhibits(sim, v) { return !CP11.portRight(sim, v) && !online(sim, v.pc) && online(sim, "mgr"); },
  fixed(sim, v) { return CP11.portRight(sim, v) && CP11.portRight(sim, v, true) && online(sim, "cl1") && online(sim, "cl2") && online(sim, "mgr"); },
  partial(v, sim) {
    if (!CP11.portRight(sim, v, true)) return "The classroom is out again, but the Annex core hasn't saved it: after its next reload the fibre port is wrong again.";
    return "It works, but not the way the records have it.";
  },
  proves(f, sim, v) { return f.cmd === "ping" && (f.dev === "cl1" || f.dev === "cl2") && f.replies > 0 && !!f.internet; },
  proofText: "a ping from a classroom PC to the internet that gets replies",
  evidence: [
    { id: "unreach", test: function (f, v) { return (f.dev === "cl1" || f.dev === "cl2") && ((f.cmd === "ping" && f.kind === "net-unreachable") || (f.cmd === "tracert" && !!f.stopAt)); }, text: function (f) { return (f.cmd === "tracert" ? "tracert" : "ping") + " from a classroom PC: the Annex core answers Destination net unreachable"; } },
    { id: "nbr", test: function (f) { const o = devOut(f); return f.on === "anxc" && /Neighbor ID\s+Pri\s+State/.test(o) && !/FULL|EXSTART/.test(o); }, text: function () { return "show ip ospf neighbor on the Annex core: no neighbour"; } },
    { id: "run", test: function (f, v) { return f.on === "anxc" && new RegExp("interface " + v.port + "\\b[\\s\\S]*?ip address " + (v.badIp || v.ip).replace(/\./g, "\\.") + " " + (v.badMask || v.mask).replace(/\./g, "\\.")).test(devOut(f)); }, text: function (f, v) { return "show running-config on the Annex core: the fibre port at " + (v.badIp || v.ip) + " " + (v.badMask || v.mask) + ", against the records' " + v.ip + " " + v.mask; } },
    { id: "peer", test: function (f, v) { return f.on === "anxc" && f.cmd !== "ping" && new RegExp("ping " + v.peer.replace(/\./g, "\\.")).test(String(f.line || "")); }, text: function (f, v) { return "ping from the Annex core to core switch 2's end, " + v.peer + ": " + (v.kind === "mask" ? "it answers" : "nothing"); } }
  ],
  summary(v) {
    return { cause: "Tidying the Annex core's addressing, the contractor typed its end of the fibre as " + (v.badIp || v.ip) + " " + (v.badMask || v.mask) + " and saved; the records, and core switch 2's end, have " + v.ip + " " + v.mask + ". " + (v.kind === "mask" ? "The two ends still reached each other, but OSPF compares masks in its hellos and won't make neighbours of ends that differ." : "The address was outside the link's block, so the two ends couldn't reach each other at all.") + " With no neighbour the Annex core learned no routes, and the classroom reached nothing beyond its building.", fix: "On the Annex core, interface " + v.short + ": ip address " + v.ip + " " + v.mask + ", then saved. The neighbour with core switch 2 came up FULL and the classroom reached the internet." };
  }
};

/* ---------------------------------------------------------------- CP-12 */
/* The DHCP server down after an edit. Yesterday at five the contractor added next month's meeting-room network to the DHCP server's
   file on the file server, from his change sheet, and restarted the service; the file had a mistake in the new block, dhcpd refused it,
   and the service stayed failed. Nothing anyone notices until a desk asks for an address: every desk with a lease keeps working; the one
   restarted this morning gave itself 169.254. The fix is on the server: the file put right (the change sheet in the brief gives the new
   network), the service started, the desk asking again. */
const CP12_DESKS = ["sd1", "bn2", "fin", "tr2", "cl2"];
const CP12 = {
  id: "CP-12", n: "12", level: 4, tier: "common", title: "The desk restarted this morning has no network", priority: 2, due: "2 h",
  kinds: ["semicolon", "range", "option"],
  build(seed) {
    const B = settled(seed), sim = B.sim, p = B.plan, r = rng(hash("CP-12:" + seed)), kind = r.pick(CP12.kinds), pc = r.pick(CP12_DESKS);
    const used = Object.values(p.vlans).map(function (V) { return V.id; }).concat([p.train.id, p.annex.cls.id, p.annex.mgmt.id, p.backup.id]);
    let nn = p.vlans.servers.id + 5; while (used.indexOf(nn) >= 0) nn++;
    const net = p.vlans.svc.net.split(".").slice(0, 2).join(".") + "." + nn, x = sim.d.fsrv, F = x.lx.files, orig = F[DHCPD_CONF].text;
    const block = ["", "# Meeting room, from next month (change sheet MR-1)", "subnet " + net + ".0 netmask 255.255.255.0 {",
      kind === "range" ? "  range " + net.replace(/\.\d+$/, "." + (nn + 1)) + ".21 " + net.replace(/\.\d+$/, "." + (nn + 1)) + ".254;" : "  range " + net + ".21 " + net + ".254;",
      kind === "option" ? "  option router " + net + ".1;" : kind === "semicolon" ? "  option routers " + net + ".1" : "  option routers " + net + ".1;",
      "}", ""];
    F[DHCPD_CONF] = { text: orig.replace(/\n*$/, "\n") + block.join("\n"), at: "Nov 21 17:02" };
    lxExec(sim, "fsrv", { via: "ssh", mode: "shell", user: p.srv.user, root: true, tries: 0, sudoOk: true }, "systemctl restart isc-dhcp-server");
    sim.bump(); sim.relink(sim.links());
    exec(sim, pc, "ipconfig /release"); exec(sim, pc, "ipconfig /renew");   /* this morning: the desk restarted and asked */
    freeze(sim);
    return { sim: sim, v: { kind: kind, plan: p, pc: pc, pcName: name(sim, pc), net: net, nn: nn, orig: orig, srv: p.srv.fsrv.ip } };
  },
  brief(v) { return { quote: "The " + v.pcName + " has no network this morning: it was restarted for updates first thing. Everyone else is working. Yesterday at five the network contractor added next month's meeting-room network to the DHCP server, from his change sheet (MR-1: network " + v.net + ".0/24, addresses " + v.net + ".21 to " + v.net + ".254, gateway " + v.net + ".1), restarted it, and left." }; },
  mason: "Something changed yesterday that nobody tested by asking for an address. Ask the thing that hands them out how it's doing.",
  affected: function (v) { return v.pc; },
  options(v) {
    return [
      { id: "right", right: true, text: "The DHCP server isn't running: the contractor's addition to its file has a mistake, and the restart failed on it" },
      { id: "relay", text: "The distribution switches' relays were changed along with the new network", why: "show running-config on the distribution switches has every floor still relaying to the DHCP server's address, and the server's own log says why it isn't answering: it stopped yesterday." },
      { id: "pool", text: "The DHCP server ran out of addresses for the " + v.pcName + "'s network", why: "systemctl status on the file server says the service failed: it isn't running at all. A full pool would still be running, and say so in the log." },
      { id: "overlap", text: "The new meeting-room network overlaps one already in use, so the server stopped handing out the old one", why: "dhcpd -t names a line in the new block and what's wrong with it, and it isn't an overlap: the meeting room's network isn't used anywhere else." },
      { id: "disabled", text: "The service was disabled, so it didn't start again after the file server restarted overnight", why: "systemctl is-enabled says enabled, and the file server didn't restart: its log shows the service restarted yesterday at five, and failing on the file there and then." },
      { id: "iface", text: "The contractor's change took eno1 out of the defaults file, so dhcpd listens nowhere", why: "/etc/default/isc-dhcp-server still has INTERFACESv4=\"eno1\", and the log's error names a line in dhcpd.conf, not a missing interface." }
    ];
  },
  rung1(v) { return "On the " + v.pcName + ": ipconfig /all. Then, from a desk that works, SSH to the file server (the records have the login): the DHCP service's status, and its log."; },
  rung2() { return "A service reads its file only as it starts: a mistake in the file stops it starting, and it says so in its log, with the line. dhcpd -t checks a file without starting anything."; },
  fixHints(v) { return ["On the file server: systemctl status and journalctl for the DHCP service, and dhcpd -t on its file: they name the line.", "Edit the file with sudo and put the new block right, as the change sheet has it; the rest of the file is fine. Then start the service again.", "Then on the " + v.pcName + ": ask for an address again, and ping the internet."]; },
  fileRight(sim, v) {
    const S = sim.d.fsrv.lx.dhcpd; if (!S || S.state !== "active" || !S.run) return false;
    const C = DHCPD.parse(S.run.file), O = DHCPD.parse(v.orig);
    const mr = C.subnets.find(function (s) { return s.net === v.net + ".0"; });
    return !C.errors.length && O.subnets.every(function (o) { return C.subnets.some(function (s) { return s.net === o.net && JSON.stringify(s.ranges) === JSON.stringify(o.ranges) && JSON.stringify(s.opts) === JSON.stringify(o.opts); }); })
      && !!mr && JSON.stringify(mr.ranges) === JSON.stringify([[v.net + ".21", v.net + ".254"]]) && !!mr.opts.routers && String(mr.opts.routers).indexOf(v.net + ".1") >= 0;
  },
  exhibits(sim, v) { const a = sim.addr(v.pc), S = sim.d.fsrv.lx.dhcpd; return S.state === "failed" && !!a && /^169\.254\./.test(a.ip) && online(sim, "mgr"); },
  fixed(sim, v) { const L = sim.d[v.pc].ifaces[0].lease; return CP12.fileRight(sim, v) && !!sim.d.fsrv.lx.dhcpd.enabled && online(sim, v.pc) && !!L && L.server === v.srv; },
  partial(v, sim) {
    const S = sim.d.fsrv.lx.dhcpd, L = sim.d[v.pc].ifaces[0].lease;
    if (!L || L.server !== v.srv) return "The " + v.pcName + " is online, but not with an address from the DHCP server: set by hand, and every other desk that restarts will have the same trouble.";
    if (S.state === "active" && S.run && !DHCPD.parse(S.run.file).subnets.some(function (s) { return s.net === v.net + ".0"; })) return "The DHCP server is running again, but next month's meeting-room network is gone from its file: the contractor's addition wasn't the mistake, only the way it was typed.";
    if (!CP12.fileRight(sim, v)) return "The DHCP server is running, but its file isn't as the change sheet and the records have it.";
    if (!S.enabled) return "The DHCP server is running, but it won't start by itself after the file server restarts: it's no longer enabled.";
    return "It works, but not the way the records have it.";
  },
  proves(f, sim, v) { return f.cmd === "ping" && f.dev === v.pc && f.replies > 0 && !!f.internet; },
  proofText: "a ping from the desk to the internet, with its address from the DHCP server",
  evidence: [
    { id: "apipa", test: function (f, v) { return f.cmd === "ipconfig" && f.dev === v.pc && !!f.apipa; }, text: function (f, v) { return "ipconfig on the " + v.pcName + ": 169.254, an address it gave itself"; } },
    { id: "status", test: function (f) { return f.on === "fsrv" && /isc-dhcp-server\.service/.test(devOut(f)) && /Active: failed/.test(devOut(f)); }, text: function () { return "systemctl status on the file server: the DHCP service failed"; } },
    { id: "journal", test: function (f) { return f.on === "fsrv" && /dhcpd\[\d+\]: \/etc\/dhcp\/dhcpd\.conf line \d+:/.test(devOut(f)); }, text: function (f) { const m = devOut(f).match(/\/etc\/dhcp\/dhcpd\.conf line (\d+): ([^\n]+)/); return "the DHCP service's log: " + (m ? "line " + m[1] + ", " + m[2] : "an error in its file"); } },
    { id: "test", test: function (f) { return f.on === "fsrv" && /^dhcpd/.test(String(f.line || "").replace(/^sudo /, "")) && /\/etc\/dhcp\/dhcpd\.conf line \d+:/.test(typeof f.out === "string" ? f.out : ""); }, text: function () { return "dhcpd -t on the file: the same line, the same error"; } }
  ],
  summary(v) {
    const what = v.kind === "semicolon" ? "the routers line had no semicolon at its end" : v.kind === "range" ? "the range was typed on the next network up, outside the subnet it was in" : "it said option router, not option routers";
    return { cause: "The contractor added the meeting-room network to the DHCP server's file, but " + what + ". dhcpd refused the file when he restarted the service, and it stayed failed. Desks with leases kept working; the " + v.pcName + ", restarted this morning, asked for an address, got no answer, and gave itself 169.254.", fix: "On the file server, sudo nano /etc/dhcp/dhcpd.conf: the meeting-room block put right as the change sheet has it (range " + v.net + ".21 to " + v.net + ".254, option routers " + v.net + ".1;), dhcpd -t clean, sudo systemctl restart isc-dhcp-server: active. The " + v.pcName + " asked again and got its address from the DHCP server." };
  }
};

/* ---------------------------------------------------------------- CP-13 */
/* Last night's backup failed on every large file. The backup network (CP-J9) carries 9000-byte frames from the file server to the
   backup server, every switch on the way set for jumbo frames and both servers' backup ports at 9000 in their netplan files. One piece
   went back to 1500: a switch on the path, where the contractor took jumbo frames off while chasing his VPN trouble, saved and reloaded
   (it drops the big frames as giants); or a server whose updates rewrote its netplan file and restarted it (it drops what's bigger than
   its port takes). Small packets still pass, so a plain ping works; a big ping that mustn't be cut up doesn't. */
const CP13_SW = { acc1: "the 1F access switch", dist1: "distribution switch 1", acc2: "the 2F access switch" };
const CP13 = {
  id: "CP-13", n: "13", level: 4, tier: "common", title: "Last night's backup failed on every large file", priority: 2, due: "4 h",
  kinds: ["switch", "server"],
  build(seed) {
    const B = settled(seed), sim = B.sim, p = B.plan, r = rng(hash("CP-13:" + seed)), kind = r.pick(CP13.kinds), sw = r.pick(["acc1", "dist1", "acc2"]), srv = r.pick(["bksrv", "fsrv"]);
    if (kind === "switch") { const w = sim.d[sw].sw; delete w.jumbo; delete w.startup.jumbo; delete w.jumboRun; w.restart = "reload"; w.uptimeFixed = "1 day, 22 hours, 9 minutes"; }
    else { const x = sim.d[srv]; delete x.lx.netplan.eno2.mtu; applyNetplan(sim, srv); x.boots = (x.boots || 0) + 1; }
    sim.bump(); sim.relink(sim.links());
    freeze(sim);
    return { sim: sim, v: { kind: kind, plan: p, sw: kind === "switch" ? sw : null, swName: kind === "switch" ? CP13_SW[sw] : null, srv: kind === "server" ? srv : null, srvName: kind === "server" ? (srv === "bksrv" ? "the backup server" : "the file server") : null, mtu: p.backup.mtu, fb: p.srv.fsrv.bip, bb: p.srv.bksrv.bip } };
  },
  brief(v) { return { quote: "Last night's backup failed. The backup software's report: \"Connected to the backup server. Small files copied. Every file over a few kilobytes: transfer stalled, timed out.\" It ran fine the night before. " + (v.kind === "switch" ? "On Saturday the network contractor was working on the switches, chasing his trouble with next month's VPN, and saved what he did." : "The servers installed their updates on Sunday night and restarted themselves.") }; },
  mason: "Small things get through and big things don't. Find out how big is too big, and where on the way it stops.",
  affected: function () { return "fsrv"; },
  options(v) {
    const swo = { id: "switch", text: "A switch on the backup network's path is back at a 1500-byte MTU, so it drops the backup's large frames", why: "show system mtu on every switch on the path says jumbo " + v.mtu + ", in effect now. It's a server's backup port that's at 1500: ip link shows its MTU." };
    const svo = { id: "server", text: "One server's backup port is back at a 1500-byte MTU, so the large frames don't fit it", why: "ip link on both servers shows their backup ports at " + v.mtu + ". It's a switch on the path that's back at 1500: show system mtu says so, and it counts the giants it dropped." };
    return [
      { id: "right", right: true, text: v.kind === "switch" ? swo.text : svo.text },
      v.kind === "switch" ? svo : swo,
      { id: "vlan", text: "The backup VLAN was taken off a trunk on the way", why: "A plain ping from the file server to the backup server's backup address answers: the VLAN is carried end to end. It's only the large frames that don't arrive." },
      { id: "disk", text: "The backup server's disk is full", why: "A full disk wouldn't stop a ping: ping -M do -s 8972 from the file server fails, and a ping with the default size works. It's the size that matters." },
      { id: "speed", text: "A link on the way dropped to 100 Mb/s, too slow for the backup", why: "A slow link still carries every frame, just slower: show interfaces status on the path's switches has every link at a-1000, and the small files copied quickly." },
      { id: "dhcp", text: "The backup server lost its backup address when it restarted", why: "Its backup port has its address from its netplan file, not from DHCP, and a plain ping to that address answers." }
    ];
  },
  rung1(v) { return "SSH to the file server (the records have the login): ping the backup server's backup address, then the same with ping -M do -s 8972. Then look along the way: each server's backup port (ip link), each switch on the path (show system mtu, show interfaces)."; },
  rung2() { return "Every device on a path has to take a frame's size, or it drops it: a switch counts what's too big as giants, a server's port drops what's bigger than its MTU. A large ping that mustn't be cut up shows the smallest MTU on the way."; },
  fixHints(v) { return ["The records have jumbo frames, " + v.mtu + " bytes, on every switch on the backup path and on both servers' backup ports, kept where they survive a restart.", v.kind === "switch" ? "A switch's jumbo MTU takes effect only after a reload, so save it first." : "A server's MTU set only with ip link is gone at its next restart; put it in its netplan file and apply it.", "Then from the file server: ping -M do -s 8972 the backup server's backup address."]; },
  allRight(sim, saved) {
    const sws = ["acc1", "dist1", "dist2", "acc2"].every(function (id) { const w = sim.d[id].sw; return (saved ? w.startup.jumbo : w.jumbo) === 9000 && (saved || w.jumboRun === 9000); });
    const srvs = ["fsrv", "bksrv"].every(function (id) { const x = sim.d[id], e = x.lx.netplan.eno2, f = x.ifaces.find(function (q) { return q.name === "eno2"; }); return e && e.mtu === 9000 && (saved || (f && f.mtu === 9000)); });
    return sws && srvs;
  },
  exhibits(sim, v) { return !CP13.allRight(sim) && ["sd1", "bn1", "mgr", "tr1"].every(function (d) { return online(sim, d); }); },
  fixed(sim, v) { return CP13.allRight(sim) && CP13.allRight(sim, true) && ["sd1", "bn1", "mgr", "tr1"].every(function (d) { return online(sim, d); }); },
  partial(v, sim) {
    if (!CP13.allRight(sim, true)) return "The big frames get through now, but not in a way that lasts: " + (v.kind === "switch" ? "the switch's jumbo MTU isn't saved, so its next reload takes it back to 1500." : "the server's MTU isn't in its netplan file, so its next restart takes it back to 1500.");
    return "It works, but not the way the records have it.";
  },
  proves(f, sim, v) { return (f.on === "fsrv" || f.on === "bksrv") && f.cmd === "ping" && !!f.df && f.size >= 8972 && f.replies > 0; },
  proofText: "from a server, ping -M do -s 8972 to the other's backup address, answered",
  evidence: [
    { id: "small", test: function (f, v) { return f.on === "fsrv" && f.cmd === "ping" && !f.df && f.replies > 0 && f.ip === v.bb; }, text: function () { return "ping from the file server to the backup server's backup address: answered"; } },
    { id: "big", test: function (f, v) { return (f.on === "fsrv" || f.on === "bksrv") && f.cmd === "ping" && !!f.df && f.size >= 8972 && !f.replies; }, text: function () { return "ping -M do -s 8972 between the servers: no reply"; } },
    { id: "where", test: function (f, v) { const o = typeof f.out === "string" ? f.out : ""; return v.kind === "switch" ? f.on === v.sw && /System MTU size is 1500 bytes/.test(o) && !/[Jj]umbo MTU size is 9000/.test(o.split("next reload")[0]) : f.on === v.srv && /eno2: .*mtu 1500\b/.test(o); }, text: function (f, v) { return v.kind === "switch" ? "show system mtu on " + v.swName + ": 1500, no jumbo frames" : "ip link on " + v.srvName + ": eno2 at mtu 1500"; } }
  ],
  summary(v) {
    return v.kind === "switch"
      ? { cause: "Chasing his VPN trouble, the contractor took jumbo frames off " + v.swName + ", saved and reloaded it. It came back at 1500 bytes, on the backup network's path, and dropped every 9000-byte frame the servers sent as a giant. Small packets still fit, so the backup connected and copied small files, then stalled on the large ones.", fix: "On " + v.swName + ": system mtu jumbo " + v.mtu + ", saved, then reloaded to put it into effect. ping -M do -s 8972 between the servers' backup addresses answered." }
      : { cause: "The updates on Sunday night rewrote " + v.srvName + "'s netplan file without the backup port's MTU, and restarted it: eno2 came back at 1500 bytes. The 9000-byte frames from the other server no longer fitted it, so the backup connected and copied small files, then stalled on the large ones.", fix: "On " + v.srvName + ": sudo netplan set ethernets.eno2.mtu=" + v.mtu + ", sudo netplan apply. eno2 at " + v.mtu + " again, in the file and in effect, and ping -M do -s 8972 between the servers' backup addresses answered." };
  }
};

/* ---------------------------------------------------------------- CP-14 */
/* The Annex core's fibre module replaced on Friday after a "receive power low" warning, by the installer, from the spares drawer in the
   data room: the wrong kind. Either a 1000BASE-SX (850 nm, for multimode) on single-mode fibre facing core switch 2's 1000BASE-LX
   (1310 nm): no light either way, the port notconnect; or an SFP+ 10GBASE-SR in a 1 Gb/s slot: unsupported, the port err-disabled.
   The classroom has been cut off since. The fix is physical: a 1000BASE-LX from the van in the Annex core's slot. */
const CP14 = {
  id: "CP-14", n: "14", level: 4, tier: "common", title: "The Annex cut off since its fibre module was replaced", priority: 1, due: "1 h",
  kinds: ["sx", "sfpplus"],
  build(seed) {
    const B = settled(seed), sim = B.sim, p = B.plan, r = rng(hash("CP-14:" + seed)), kind = r.pick(CP14.kinds), L = p.annex.link, pc = r.pick(["cl1", "cl2"]);
    sim.d.anxc.sfp[L.anxPort] = kind === "sx" ? "1000BASE-SX" : "10GBASE-SR";
    sim.bump(); sim.relink(sim.links());
    freeze(sim);
    const fc = sim.cableAt("anxc", L.anxPort);
    return { sim: sim, v: { kind: kind, plan: p, pc: pc, pcName: name(sim, pc), slot: L.anxPort, port: L.anxIf, short: L.anxIf.replace("GigabitEthernet", "Gi"), swIp: p.annex.core.ip, mod: sim.d.anxc.sfp[L.anxPort], fibre: fc ? fc.id : null, end: fc ? (fc.a.dev === "anxc" ? "a" : "b") : null } };
  },
  brief(v) { return { quote: "The Training Annex's classroom has had no connection to HQ or the internet since Friday afternoon. On Friday morning the monitoring had warned of low light on the fibre at the Annex end, and the installer replaced the Annex core switch's fibre module with one from the spares drawer in the data room. The " + v.pcName + " still has its address." }; },
  mason: "Something physical changed on Friday, and the link hasn't worked since. Ask the switch what it thinks it's holding, then go and look.",
  affected: function (v) { return v.pc; },
  options(v) {
    const sx = { id: "sx", text: "The replacement module is made for multimode fibre, at a different wavelength from core switch 2's, so no light gets through either way", why: "show interfaces status calls the port err-disabled, not notconnect: the switch won't use the module at all. show inventory names it an SFP+ 10GBASE-SR, which a 1 Gb/s slot can't run." };
    const sp = { id: "sfpplus", text: "The replacement is a 10 Gb/s SFP+ module in a 1 Gb/s slot, so the switch shuts the port", why: "show interfaces status has the port notconnect, not err-disabled, and show inventory names a 1 Gb/s module. It's the kind of fibre and the wavelength that don't match: show interfaces transceiver receives no light." };
    return [
      { id: "right", right: true, text: v.kind === "sx" ? sx.text : sp.text },
      v.kind === "sx" ? sp : sx,
      { id: "polarity", text: "The fibre's two strands were put back crossed at the Annex end when the module was changed", why: "Crossed strands with matching modules still light each end's receiver from the wrong side and the link stays down, but show inventory and Look at the plug say this module isn't the kind the records give for the fibre." },
      { id: "dirty", text: "The fibre end is dirty, still causing the low light Friday's warning was about", why: "A dirty end lowers the light; it doesn't take it away: show interfaces transceiver " + (v.kind === "sx" ? "receives nothing at all, and the module isn't the records' kind" : "can't even read the module: it's unsupported") + "." },
      { id: "ospf", text: "The Annex core lost its OSPF settings when the module was changed", why: "show running-config on the Annex core has router ospf 1 as the records have it. OSPF has no neighbour because the fibre port is down." },
      { id: "core2", text: "Core switch 2's end of the fibre went down in the same work", why: "The Annex core's own port says why it's down: its module. show inventory and Look at the plug at the Annex end are enough to find it, and core switch 2's module is the records' kind." }
    ];
  },
  rung1(v) { return "SSH to the Annex core from the " + v.pcName + " (the records have its address): show interfaces status, show interfaces transceiver, show inventory. Then the Annex core's Physical tab: look at the fibre module itself, and compare it with what the records give for the fibre."; },
  rung2() { return "The modules at the two ends of a fibre have to agree with each other and with the fibre: the same wavelength, made for that kind of fibre, and a speed the slot can run. A module that fails any of those leaves the link dark, or the port shut."; },
  fixHints(v) { return ["The records say which modules the fibre between the buildings takes.", "The van has 1 Gb/s modules of both kinds: the Annex core's Physical tab swaps them.", "Then from the " + v.pcName + ": a ping to the internet."]; },
  exhibits(sim, v) { return sim.d.anxc.sfp[v.slot] !== "1000BASE-LX" && !online(sim, v.pc) && online(sim, "mgr"); },
  fixed(sim, v) { return sim.d.anxc.sfp[v.slot] === "1000BASE-LX" && sim.d.core2.sfp[v.plan.annex.link.hqPort] === "1000BASE-LX" && online(sim, "cl1") && online(sim, "cl2") && online(sim, "mgr"); },
  partial() { return "It works, but not the way the records have it."; },
  proves(f, sim, v) { return f.cmd === "ping" && (f.dev === "cl1" || f.dev === "cl2") && f.replies > 0 && !!f.internet; },
  proofText: "a ping from a classroom PC to the internet that gets replies",
  evidence: [
    { id: "stat", test: function (f, v) { const o = devOut(f); return f.on === "anxc" && new RegExp("^" + v.short.replace("/", "\\/") + "\\s.*" + (v.kind === "sx" ? "notconnect" : "err-disabled"), "m").test(o); }, text: function (f, v) { return "show interfaces status on the Annex core: " + v.short + " " + (v.kind === "sx" ? "notconnect" : "err-disabled"); } },
    { id: "inv", test: function (f, v) { return f.on === "anxc" && /PID:/.test(devOut(f)) && devOut(f).indexOf(SFP_PID[v.mod]) >= 0; }, text: function (f, v) { return "show inventory on the Annex core: the fibre slot holds " + SFP_PID[v.mod]; } },
    { id: "look", test: function (f, v) { return f.phys === "look" && f.cable === v.fibre && f.end === v.end; }, text: function (f, v) { return "the Annex core's fibre module, looked at: " + v.mod + (v.kind === "sx" ? ", a black bail" : ", an SFP+"); } }
  ],
  summary(v) {
    return { cause: "Friday's replacement module from the spares drawer was " + (v.kind === "sx" ? "a 1000BASE-SX: 850 nm, made for multimode fibre, facing core switch 2's 1000BASE-LX at 1310 nm on single-mode fibre. No light got through either way, so the port stayed notconnect." : "an SFP+ 10GBASE-SR: a 10 Gb/s module in a 1 Gb/s slot. The switch can't run it, so it shut the port (err-disabled).") + " With its only link down, the Annex core had no OSPF neighbour and no way out, and the classroom reached nothing beyond its building.", fix: "On the Annex core's Physical tab: the module in " + v.slot + " swapped for a 1000BASE-LX from the van, as the records have it at both ends. The link came up, OSPF formed with core switch 2, and the classroom reached the internet." };
  }
};

/* ---------------------------------------------------------------- CP-15 */
/* BPDU guard, set on every desk port by CP-J1, shuts a desk port that hears a bridge protocol data unit: a desk port should only ever
   have a computer on it. Two ways it happened at the technicians' bench, each the other's near miss on the board. "customer": a customer's
   managed switch, in for repair, plugged into the bench's network cable with bench PC 1 on it, to download its firmware: it sends its
   own BPDUs (spanning tree is on in every managed switch from the box), so the 2F access switch shut port 1. "loop": a little unmanaged
   8-port switch put on the bench over the weekend, both bench runs and both PCs plugged into it: it sends no BPDUs of its own, but it
   passes the 2F access switch's own from port 1 into port 2 and from port 2 into port 1 (a loop), so both went. The switch isn't in the
   records or on the diagram; it's on the floor plan where it is, and its Physical tab takes it away. The fix: it taken away, then each
   shut port shut and opened again; BPDU guard, portfast and port security left as the records have them. */
const CP15_STORY = {
  customer: function () { return "Bench PC 1 has had no network since this morning. The bench technician was testing a customer's switch that came in for repair: the switch went onto the bench's network cable, with bench PC 1 plugged into it, to download a firmware update for it. Nothing has been unplugged since. Bench PC 2, right beside it, is fine."; },
  loop: function () { return "Neither bench PC has had any network since this morning. Over the weekend somebody tidied the technicians' bench and put a little 8-port switch on it, so the laptops being repaired can have a cable too: both of the bench's network cables and both PCs are plugged into it now. Nothing else on the second floor has a problem."; }
};
const CP15_PORTS = { customer: ["1"], loop: ["1", "2"] };
const cp15Edge = function (q) { return !!q && !!q.stp && !!q.stp.bpduguard && !!q.stp.portfast; };   /* the records' desk port: portfast and BPDU guard */
const CP15 = {
  id: "CP-15", n: "15", level: 4, tier: "harder", title: "The technicians' bench off the network since this morning", priority: 2, due: "2 h",
  kinds: ["customer", "loop"],   /* its variants, in the order a seed picks them (the tests find a campus for each) */
  build(seed) {
    const B = settled(seed), sim = B.sim, p = B.plan, r = rng(hash("CP-15:" + seed)), kind = r.pick(CP15.kinds);
    const ps = {}; CP15_PORTS.loop.forEach(function (n) { ps[n] = JSON.stringify(sim.d.acc2.sw.ports["GigabitEthernet0/" + n].ps); });   /* port security as the records left it, to hold the fix to */
    addDeskSwitch(sim, kind);
    sim.bump(); sim.relink(sim.links());
    freeze(sim);
    const ports = CP15_PORTS[kind], pcs = kind === "customer" ? ["bn1"] : ["bn1", "bn2"];
    return { sim: sim, v: { kind: kind, plan: p, ports: ports, pcs: pcs, ps: ps, swName: "2F access switch", swIp: p.sw.acc2.ip, box: name(sim, "dsw"), pc: name(sim, "bn1"),
      runs: pcs.map(function (pc) { return "c-acc2-" + pc; }) } };
  },
  brief(v) { return { quote: CP15_STORY[v.kind]() }; },
  mason: "A desk port should only ever see a computer. Find out what the switch saw on the bench's port, then go and look at the bench.",
  affected: function (v) { return v.pcs[0]; },
  options(v) {
    const one = { id: "customer", text: "A switch that sends its own BPDUs is on the bench's network cable, so BPDU guard shut that one port", why: "Both bench ports are err-disabled, and the desk switch is an unmanaged one: it sends no BPDUs of its own. The BPDUs it passed on were the 2F access switch's own, out of each bench port and back in at the other." };
    const two = { id: "loop", text: "The bench's two network cables are joined through one switch, a loop, so BPDU guard shut both ports", why: "Only port 1 is err-disabled: port 2 is connected and bench PC 2 is online on it. Nothing joins the two cables; the customer's switch is on port 1's alone, and it sends BPDUs of its own." };
    return [
      { id: "right", right: true, text: v.kind === "customer" ? one.text : two.text },
      v.kind === "customer" ? two : one,
      { id: "psec", text: "Port security shut the bench port: a second device's address arrived on it", why: "show port-security interface has the port Secure-down with no violations: port security didn't shut it. show interfaces status err-disabled gives the reason it was: bpduguard." },
      { id: "stp", text: "Spanning tree is blocking the bench port: it found a loop and chose that port to block", why: "A port spanning tree blocks stays up: show interfaces status calls it connected and spanning tree lists it BLK. This one is err-disabled: shut down, not blocked." },
      { id: "cable", text: "The bench's network cable was damaged when it was moved onto the switch on the bench", why: "A damaged cable shows notconnect. show interfaces status says err-disabled: the switch shut the port itself, whatever is plugged into it." },
      { id: "uplink", text: "The 2F access switch's uplinks went down", why: "show interfaces trunk on the 2F access switch lists both uplinks trunking, and the backup server on the same switch is still reachable." }
    ];
  },
  rung1(v) { return "From a desk PC on another floor, SSH to the " + v.swName + " (the records have its address): show interfaces status, and show interfaces status err-disabled. Then the floor plan: what is on the technicians' bench?"; },
  rung2() { return "BPDU guard shuts an edge port the moment a BPDU arrives on it: only switches send BPDUs, and only a switch, or a loop that brings a switch's own back in, puts one on a desk's port. The port stays err-disabled until somebody shuts it and opens it again, and if whatever sent the BPDU is still there, it goes straight back down."; },
  fixHints(v) { return ["show interfaces status err-disabled on the " + v.swName + " says which protection shut " + (v.ports.length > 1 ? "each port" : "the port") + ".", "BPDU guard, portfast and port security are the records' settings on every desk port: keep them. Take away what is sending the BPDUs first: it's on the bench, and its Physical tab takes it away. Then shut each shut port and open it again.", "Then from a bench PC: a ping to the internet."]; },
  exhibits(sim, v) { const sw = sim.d.acc2.sw; return v.ports.every(function (n) { const r = sw.psRun && sw.psRun["GigabitEthernet0/" + n]; return !!(r && r.err && r.why === "bpduguard"); }) && v.pcs.every(function (pc) { return !online(sim, pc); }) && online(sim, "mgr") && (v.kind === "loop" || online(sim, "bn2")); },
  fixed(sim, v) {
    const sw = sim.d.acc2.sw;
    const ports = CP15_PORTS.loop.every(function (n) { const k = "GigabitEthernet0/" + n, r = sw.psRun && sw.psRun[k], st = sw.startup && sw.startup.ports[k]; return !(r && r.err) && !sw.ports[k].shutdown && cp15Edge(sw.ports[k]) && cp15Edge(st) && JSON.stringify(sw.ports[k].ps) === v.ps[n] && !!st && JSON.stringify(st.ps) === v.ps[n]; });
    return ports && !!sim.d.dsw.boxed && online(sim, "bn1") && online(sim, "bn2") && online(sim, "mgr");
  },
  partial(v, sim) {
    const sw = sim.d.acc2.sw, ks = CP15_PORTS.loop.map(function (n) { return "GigabitEthernet0/" + n; });
    if (ks.some(function (k) { return !cp15Edge(sw.ports[k]); })) return "The bench is back, but not every bench port has portfast and BPDU guard the way the records set them on every desk port. The next switch somebody plugs in at the bench joins the campus's spanning tree, or loops it.";
    if (ks.some(function (k) { const P = sw.ports[k].ps; return !P || !P.on; })) return "The bench is back, but port security isn't on every bench port the way the records have it: one address, sticky, shut down on a violation.";
    if (!sim.d.dsw.boxed) return "It works, but the " + v.box + " is still on the bench's network, between the bench and the 2F access switch, where the records have nothing.";
    if (ks.some(function (k) { const st = sw.startup && sw.startup.ports[k]; return !cp15Edge(st) || !st.ps || !st.ps.on; })) return "The bench is back, but the 2F access switch's saved configuration no longer protects the bench ports as the records set them: after a reload they're unprotected.";
    return "It works, but not the way the records have it.";
  },
  proves(f, sim, v) { return f.cmd === "ping" && (f.dev === "bn1" || f.dev === "bn2") && f.replies > 0 && !!f.internet; },
  proofText: "a ping from a bench PC to the internet that gets replies",
  evidence: [
    { id: "stat", test: function (f, v) { const o = devOut(f); return f.on === "acc2" && v.ports.every(function (n) { return new RegExp("^Gi0\\/" + n + "\\s.*err-disabled", "m").test(o); }); }, text: function (f, v) { return "show interfaces status on the 2F access switch: " + v.ports.map(function (n) { return "Gi0/" + n; }).join(" and ") + " err-disabled"; } },
    { id: "why", test: function (f, v) { const o = devOut(f); return f.on === "acc2" && /Reason/.test(o) && v.ports.every(function (n) { return new RegExp("^Gi0\\/" + n + "\\s.*bpduguard", "m").test(o); }); }, text: function (f, v) { return "show interfaces status err-disabled on the 2F access switch: the reason, bpduguard"; } },
    { id: "look", test: function (f, v) { return f.phys === "look" && v.runs.indexOf(f.cable) >= 0; }, text: function (f, v) { return "the bench's network cable" + (v.runs.length > 1 ? "s" : "") + ", looked at: in the " + v.box + ", not in a PC"; } }
  ],
  summary(v) {
    return { cause: v.kind === "customer" ? "The customer's managed switch, plugged into the bench's network cable, sends BPDUs as every managed switch does from its box. Port 1 on the 2F access switch is a desk port, set with portfast and BPDU guard, so the first BPDU shut it (err-disabled, reason bpduguard), and bench PC 1, behind the customer's switch, lost the network." : "The unmanaged desk switch had both bench cables in it, joining the 2F access switch's ports 1 and 2 into a loop. It sends no BPDUs of its own, but it passed the access switch's own from each port into the other, and BPDU guard shut both (err-disabled, reason bpduguard). Without it, that loop would have flooded the floor.", fix: "The " + v.box + " taken away and each cable plugged back into its bench PC, then " + (v.ports.length > 1 ? "ports 1 and 2" : "port 1") + " on the 2F access switch shut and opened again (an err-disabled port waits for that). BPDU guard, portfast and port security stayed as the records have them." };
  }
};

export const CAMPUS_TICKETS = [CP01, CP02, CP03, CP04, CP05, CP06, CP07, CP08, CP09, CP10, CP11, CP12, CP13, CP14, CP15];
export const CAMPUS_COMING = [];
