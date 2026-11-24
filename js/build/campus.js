/* Level 4 build mode: the campus's work orders (Rafiki's HQ; the plan approved 16 November 2026: "Yes to the level 4 plans,
   build it out"). Each starts from the campus as the one before it left it. Every line is an ordered list of causes, as on
   the other levels: the first one really there is what the check saw, everything before it is ruled out by the network. */
import { makeCampus, coreLinks, installCore, coreCables, fileServer, dhcpKit, CAMPUS_RUN } from "../net/campus.js";
import * as DH from "../net/dhcpd.js";
import { ip2n } from "../net/util.js";
import { Sim, SFP_MODULES, runLength } from "../net/sim.js";
import { errDisabled, dotMac, unsaved, chanState, carries, l3Ifs, l3Route, pwOk } from "../net/swcli.js";
import * as RT from "../net/rtcli.js";
import { exec } from "../net/cmd.js";
import { bridgeId } from "../net/stp.js";

const C = function (id, on, text, not, ev) { return { id: id, on: !!on, text: text, not: not, ev: ev }; };
export const CAMPUS_PCS = ["sd1", "hd1", "bn1", "bn2", "mgr", "fin"];
const ACCESS = [["acc1", "1F access switch"], ["acc2", "2F access switch"], ["acc3", "3F access switch"]];
const gi = function (n) { return n.replace("GigabitEthernet", "Gi"); };
const psRead = function (p) { return Object.assign({ on: false, max: 1, viol: "shutdown", sticky: false, macs: [] }, (p && p.ps) || {}); };
const name = function (sim, id) { return String(sim.d[id].label).replace(/^[A-Z](?=[a-z])/, function (m) { return m.toLowerCase(); }); };
/* every desk port on the three floors as the records have them: the switch, the port, what's on it, and the cable joining them */
function desks(sim, v) {
  const out = [];
  ACCESS.forEach(function (a) {
    const D = v.plan.desks[a[0]]; Object.keys(D).forEach(function (p) {
      const n = "GigabitEthernet0/" + p, dev = D[p][0], c = sim.net.cables.find(function (k) { return (k.a.dev === a[0] && k.a.port === p && k.b.dev === dev) || (k.b.dev === a[0] && k.b.port === p && k.a.dev === dev); });
      out.push({ sw: a[0], at: a[1], n: n, dev: dev, p: sim.d[a[0]].sw.ports[n], c: c, up: !!c && sim.cableUp(c) });
    });
  });
  return out;
}
const UPLINKS = ["GigabitEthernet0/23", "GigabitEthernet0/24"];
function uplinks(sim) { const out = []; ACCESS.forEach(function (a) { UPLINKS.forEach(function (n) { out.push({ sw: a[0], at: a[1], n: n, p: sim.d[a[0]].sw.ports[n] }); }); }); return out; }
function spares(sim, v) { const out = []; ACCESS.forEach(function (a) { const used = Object.keys(v.plan.desks[a[0]]).map(Number); for (let k = 1; k <= 22; k++) if (used.indexOf(k) < 0) out.push({ sw: a[0], at: a[1], n: "GigabitEthernet0/" + k, p: sim.d[a[0]].sw.ports["GigabitEthernet0/" + k] }); }); return out; }

/* ------------------------------------------------------------ CP-J1, lock down the access ports */
function psCauses(sim, v) {
  const rows = desks(sim, v), stuck = function (r) { return psRead(r.p).macs.filter(function (k) { return k.sticky; }); }, mac = function (r) { return dotMac(sim.macOf(r.dev)); };
  const bad = function (r) { const P = psRead(r.p); return !r.up || !P.on || errDisabled(sim.d[r.sw].sw, r.n) || P.max > 1 || P.viol !== "shutdown" || !stuck(r).some(function (k) { return k.mac === mac(r); }); };
  const r = rows.find(bad) || rows[0], P = psRead(r.p), who = name(sim, r.dev), g = gi(r.n), st = stuck(r), other = st.find(function (k) { return k.mac !== mac(r); });
  return [C("cable", !r.up, "The " + who + " has no link to the " + r.at, "Each desk is on its floor's switch.", "The Cable runs table: the " + who + "'s run has no link."),
    C("off", r.up && !P.on, "The " + who + "'s port has no port security: any device plugged in there gets on the network", "Its port has port security.", "show port-security interface " + g + " on the " + r.at + ": Port Security : Disabled."),
    C("err", r.up && P.on && errDisabled(sim.d[r.sw].sw, r.n), "The " + who + "'s port has been shut by a violation: it's cut off until the port is reset", "Its port is up.", "show interfaces status on the " + r.at + ": " + g + " err-disabled."),
    C("max", P.on && P.max > 1, "Its port takes more than one device", "It takes one device.", "show port-security interface " + g + " on the " + r.at + ": Maximum MAC Addresses : " + P.max + "."),
    C("viol", P.on && P.viol !== "shutdown", "A stranger on its port is " + (P.viol === "protect" ? "dropped" : "counted") + ", but the port stays up", "A stranger shuts the port.", "show port-security interface " + g + " on the " + r.at + ": Violation Mode : " + (P.viol === "protect" ? "Protect" : "Restrict") + "."),
    C("sticky", P.on && !st.length, "Its port learns the device's address but doesn't keep it: unplugged, another device takes its place", "The device's address is stuck in the configuration.", "show running-config on the " + r.at + ": " + g + " has no sticky address."),
    C("wrong", P.on && st.length > 0 && !st.some(function (k) { return k.mac === mac(r); }), "Its port has stuck another device's address, not the " + who + "'s", "It holds the right device's address.", "show port-security address on the " + r.at + ": " + g + " holds " + (other ? other.mac : "") + ".")];
}
function edgeCauses(sim, v) {
  const r = desks(sim, v).find(function (x) { return !(x.p.stp && x.p.stp.portfast); });
  return [C("portfast", !!r, (r ? "The " + name(sim, r.dev) + "'s port on the " + r.at : "A desk port") + " isn't an edge port: after every reboot the desk waits while spanning tree listens and learns", "Every desk port is an edge port.", r ? "show spanning-tree on the " + r.at + ": " + gi(r.n) + " has no Edge." : "")];
}
function guardCauses(sim, v) {
  const rows = desks(sim, v), r = rows.find(function (x) { return !(x.p.stp && x.p.stp.bpduguard); });
  return [C("none", !!r, (r ? "The " + name(sim, r.dev) + "'s port on the " + r.at : "A desk port") + " has no BPDU guard: a switch plugged in there would join the spanning tree", "Every desk port has BPDU guard.", r ? "show running-config on the " + r.at + ": " + gi(r.n) + " has no spanning-tree bpduguard." : "")];
}
function upCauses(sim, v) {
  const U = uplinks(sim), err = U.find(function (u) { return errDisabled(sim.d[u.sw].sw, u.n); }), guard = U.find(function (u) { return u.p.stp && u.p.stp.bpduguard; }), ps = U.find(function (u) { return psRead(u.p).on; }), fast = U.find(function (u) { return u.p.stp && u.p.stp.portfast; }), shut = U.find(function (u) { return u.p.shutdown; }), mode = U.find(function (u) { return u.p.mode !== "trunk"; });
  const at = function (u) { return u ? gi(u.n) + " on the " + u.at : ""; };
  return [C("shut", !!shut, "An uplink is shut down: " + at(shut), "Every uplink is open.", "show interfaces status: " + at(shut) + " disabled."),
    C("err", !!err, "An uplink has been err-disabled: " + at(err) + " (BPDU guard heard the distribution switch, or port security counted the floor)", "No uplink is err-disabled.", "show interfaces status: " + at(err) + " err-disabled."),
    C("guard", !!guard, "BPDU guard is on an uplink: " + at(guard) + ". It hears the distribution switch and shuts the floor's way out", "The uplinks have no BPDU guard.", "show running-config: " + at(guard) + " has spanning-tree bpduguard enable."),
    C("ps", !!ps, "Port security is on an uplink: " + at(ps) + ". Everything behind it counts as another device", "The uplinks have no port security.", "show port-security: " + at(ps) + " is secured."),
    C("fast", !!fast, "An uplink is an edge port: " + at(fast) + ". A port to a switch that skips listening can loop the network", "No uplink is an edge port.", "show spanning-tree: " + at(fast) + " Edge."),
    C("mode", !!mode, "An uplink isn't a trunk: " + at(mode), "Every uplink is a trunk.", "show interfaces trunk: " + at(mode) + " missing.")];
}
function spareCauses(sim, v) {
  const S = spares(sim, v), open = S.find(function (r) { return !r.p.shutdown; }), park = S.find(function (r) { return r.p.access !== v.plan.vlans.parking.id; });
  return [C("open", !!open, "A spare port is open: " + (open ? gi(open.n) + " on the " + open.at : ""), "Every spare port is shut.", "show interfaces status: " + (open ? gi(open.n) : "") + " notconnect, not disabled."),
    C("park", !!park, "A spare port isn't in the parking VLAN: " + (park ? gi(park.n) + " on the " + park.at : ""), "Every spare port is in the parking VLAN.", "show interfaces status: " + (park ? gi(park.n) : "") + " not in VLAN " + v.plan.vlans.parking.id + ".")];
}
function workCauses(sim, v) {
  const off = CAMPUS_PCS.find(function (id) { return !sim.route(id, "8.8.8.8").internet; }), pr = ["pr1", "pr3"].find(function (id) { return !sim.route("sd1", v.plan.printers[id]).routed; });
  return [C("pc", !!off, (off ? "The " + name(sim, off) : "A PC") + " can't reach the internet", "Every PC is online.", off ? "ping 8.8.8.8 from the " + name(sim, off) + ": no reply." : ""),
    C("printer", !!pr, (pr ? "The " + name(sim, pr) : "A printer") + " doesn't answer from the service desk", "Both printers answer.", pr ? "ping " + v.plan.printers[pr] + " from the service desk PC: no reply." : "")];
}
const savedCauses = function (id, label) { return function (sim) { return [C("unsaved", unsaved(sim.d[id].sw), "The " + label + " hasn't been saved: a power cut takes the changes away", "It's saved.", "show startup-config on the " + label + ": it's not what's running.")]; }; };

const CJ1 = {
  id: "CP-J1", level: "campus", title: "Lock down the access ports: port security, portfast and BPDU guard on every desk",
  already: ["uplinks", "spares", "works", "saved1", "saved2", "saved3"],
  start(seed) { const net = makeCampus(seed), sim = new Sim(net); sim.boot(CAMPUS_PCS); return { sim: sim, v: { plan: net.plan } }; },
  brief() { return { quote: "Last month a visitor plugged a laptop into a socket on the service desk and was on our network in seconds, and someone on 2F brought in a little desk switch and the whole floor went down. Every desk port on all three floors needs locking to the device on it, and the network has to protect itself from anything plugged in where a desk should be.", from: "Rafiki, owner" }; },
  mason: "One floor at a time: secure its desk ports, prove it, save it, then the next. Look at which ports are desks before you type a range: the uplinks to the distribution switches are on the same switch.",
  limits: function (v) {
    const p = v.plan, S = p.sw;
    return ["The switches: " + ACCESS.map(function (a) { return S[a[0]].host + " " + S[a[0]].ip; }).join(", ") + ". Enable secret: " + p.secret + ". SSH user " + p.user + ", password " + p.userPw + ", from any desk PC.",
      "Every desk port: one device, its address stuck in the configuration (sticky), a stranger shuts the port. Every desk port an edge port (portfast) with BPDU guard.",
      "Ports 23 and 24 on each access switch are its uplinks to the distribution switches: none of this goes on them.", "Spare ports stay shut, in the parking VLAN " + p.vlans.parking.id + "."];
  },
  reqs: [
    { id: "ps", text: "Every desk port on the three floors has port security: one device, its address stuck, a stranger shuts the port", causes: psCauses,
      ok: function () { return "Every desk port holds its own device's address, sticky, and a stranger shuts it."; },
      rung1: function () { return "show port-security on each access switch, then show port-security interface for a desk port, and its lines in show running-config."; },
      rung2: function () { return "A port remembers an address only if it's told to stick it; one address and shutdown is the strictest, and the default count is one."; } },
    { id: "edge", text: "Every desk port is an edge port", causes: edgeCauses,
      ok: function () { return "Every desk port is an edge port (portfast)."; },
      rung1: function () { return "show spanning-tree on each access switch: the Type column, port by port."; },
      rung2: function () { return "A port to a single computer can go straight to forwarding: spanning tree has nothing to learn there."; } },
    { id: "guard", text: "Every desk port has BPDU guard", causes: guardCauses,
      ok: function () { return "Every desk port has BPDU guard."; },
      rung1: function () { return "show running-config on each access switch: the desk ports' spanning-tree lines."; },
      rung2: function () { return "Only a switch sends spanning tree's messages: a desk port that hears one can be shut on the spot."; } },
    { id: "uplinks", text: "Every floor still reaches both distribution switches, its uplinks untouched", causes: upCauses,
      ok: function () { return "Every uplink is a trunk, open, with no guard of any kind."; },
      rung1: function () { return "show interfaces status on each access switch, ports 23 and 24, then their lines in show running-config."; },
      rung2: function () { return "An uplink hears the distribution switch's spanning tree and carries every device on the floor: a desk's protections cut it off."; } },
    { id: "spares", text: "Every spare port is still shut, in the parking VLAN", causes: spareCauses,
      ok: function () { return "Every spare port is shut, in the parking VLAN."; },
      rung1: function () { return "show interfaces status on each access switch."; },
      rung2: function () { return "A range that reaches past the desks opens and changes ports that were parked."; } },
    { id: "works", text: "Everyone still works: every PC online, both printers answering", causes: workCauses,
      ok: function () { return "Every PC is online and both printers answer."; },
      rung1: function () { return "ping 8.8.8.8 from each PC, and the printers from the service desk."; },
      rung2: function () { return "A desk port that's shut, or holds the wrong address, cuts that desk off."; } },
    { id: "saved1", text: "The 1F access switch is saved", causes: savedCauses("acc1", "1F access switch"), ok: function () { return "It's saved."; }, rung1: function () { return "show startup-config against show running-config."; }, rung2: function () { return "Only what's saved survives a power cut."; } },
    { id: "saved2", text: "The 2F access switch is saved", causes: savedCauses("acc2", "2F access switch"), ok: function () { return "It's saved."; }, rung1: function () { return "show startup-config against show running-config."; }, rung2: function () { return "Only what's saved survives a power cut."; } },
    { id: "saved3", text: "The 3F access switch is saved", causes: savedCauses("acc3", "3F access switch"), ok: function () { return "It's saved."; }, rung1: function () { return "show startup-config against show running-config."; }, rung2: function () { return "Only what's saved survives a power cut."; } }
  ],
  solve(v) {
    const p = v.plan, out = [], t = function (l) { out.push({ t: "cmd", dev: "sd1", line: l }); };
    ACCESS.forEach(function (a) {
      const ports = Object.keys(p.desks[a[0]]).map(function (n) { return "gi0/" + n; }).join(" , ");
      ["ssh " + p.user + "@" + p.sw[a[0]].ip, p.userPw, "enable", p.secret, "configure terminal", "interface range " + ports, "switchport port-security", "switchport port-security mac-address sticky",
        "spanning-tree portfast", "spanning-tree bpduguard enable", "end", "copy running-config startup-config", "", "exit"].forEach(t);
    });
    return out;
  },
  answer(v) {
    const p = v.plan;
    return ACCESS.map(function (a) { return "From the service desk PC: ssh " + p.user + "@" + p.sw[a[0]].ip + "; enable; configure terminal; interface range " + Object.keys(p.desks[a[0]]).map(function (n) { return "gi0/" + n; }).join(" , ") + ": switchport port-security, switchport port-security mac-address sticky, spanning-tree portfast, spanning-tree bpduguard enable; end; copy running-config startup-config."; });
  },
  summary() { return ["Every desk port on the three floors holds its own device's address and shuts on a stranger.", "Every desk port is an edge port with BPDU guard: a switch plugged in where a desk should be shuts its own port, not the floor.", "The uplinks are untouched, the spares still parked, and each access switch is saved."]; }
};

/* ------------------------------------------------------------ CP-J2, the spanning-tree root where it belongs */
/* the VLANs in use (the ones with addresses), as the records list them; each has its own spanning tree */
const USED = ["svc", "bench", "office", "servers", "printers", "mgmt"];
const DISTS = [["dist1", "distribution switch 1"], ["dist2", "distribution switch 2"]];
export const said = function (sim, id) { return id === "dist1" || id === "dist2" ? DISTS.find(function (d) { return d[0] === id; })[1] : id === "anxc" ? "the Annex core switch" : id === "anxa" ? "the Annex access switch" : name(sim, id); };   /* the Annex's switches (work order 8) as said mid-sentence */
const cmpBid = function (a, b) { return a.prio - b.prio || (a.mac < b.mac ? -1 : a.mac > b.mac ? 1 : 0); };
/* each VLAN in use: its root, and each switch's bridge ID in it */
function trees(sim, v) {
  const all = sim.stpAll();
  return USED.map(function (k) {
    const id = v.plan.vlans[k].id, T = all[id], B = {};
    Object.keys(T.sws).forEach(function (s) { B[s] = bridgeId(T.sws[s].prio, id, T.sws[s].mac); });
    const root = T.result.bridges.dist1 ? T.result.bridges.dist1.root : Object.keys(B).sort(function (a, b) { return cmpBid(B[a], B[b]); })[0];
    return { k: k, id: id, B: B, root: root, prio: function (s) { return B[s].prio - id; } };
  });
}
function rootCauses(sim, v) {
  const t = trees(sim, v).find(function (x) { return x.root !== "dist1"; }) || null, r = t && t.root;
  const at = t ? "show spanning-tree vlan " + t.id + " on distribution switch 1: the root is " + said(sim, r) + " (priority " + t.prio(r) + "), not this bridge." : "";
  return [C("left", r === "acc2", "A VLAN in use still has the 2F access switch as its root: left at the defaults it has the lowest address, so every floor's traffic between the distribution switches crosses a switch on the bench floor", "No VLAN's root is the 2F access switch.", at),
    C("access", !!r && /^acc/.test(r) && r !== "acc2", "A VLAN in use has another access switch as its root (" + (r ? said(sim, r) : "") + "): pushing the 2F switch back only hands the root to the next-lowest address", "No access switch is a root.", at),
    C("dist2", r === "dist2", "Distribution switch 2 is the root of a VLAN in use: there, its priority is below distribution switch 1's", "Distribution switch 2 isn't the root.", at)];
}
function backupCauses(sim, v) {
  const T = trees(sim, v), bad = function (t) { const d2 = t.B.dist2, d1 = t.B.dist1; return t.prio("dist2") === 32768 || Object.keys(t.B).some(function (s) { return /^acc/.test(s) && cmpBid(t.B[s], d2) < 0; }) || d2.prio <= d1.prio; };
  const t = T.find(bad) || T[0], acc = Object.keys(t.B).filter(function (s) { return /^acc/.test(s) && cmpBid(t.B[s], t.B.dist2) < 0; }).sort(function (a, b) { return cmpBid(t.B[a], t.B[b]); })[0];
  const ev = "show spanning-tree vlan " + t.id + " on distribution switch 2: Bridge ID priority " + t.prio("dist2") + " (distribution switch 1's is " + t.prio("dist1") + ").";
  return [C("left", t.prio("dist2") === 32768, "Distribution switch 2 is left at the default priority: if distribution switch 1 fails, the switch with the lowest address takes the root, and that's the 2F access switch", "Distribution switch 2 has a priority of its own.", ev),
    C("access", !!acc, "An access switch would beat distribution switch 2 if distribution switch 1 failed (" + (acc ? said(sim, acc) : "") + ", priority " + (acc ? t.prio(acc) : "") + ")", "Distribution switch 2 is lower than every access switch.", "show spanning-tree vlan " + t.id + " on " + (acc ? "the " + said(sim, acc) : "an access switch") + ": its Bridge ID priority."),
    C("tie", t.B.dist2.prio === t.B.dist1.prio, "The two distribution switches have the same priority: distribution switch 1 is root only because its address is lower, and nothing says which should be", "Distribution switch 2's priority is above distribution switch 1's.", ev),
    C("below", t.B.dist2.prio < t.B.dist1.prio, "Distribution switch 2's priority is below distribution switch 1's", "Distribution switch 2's priority is above distribution switch 1's.", ev)];
}
function switchesCauses(sim, v) {
  const S = v.plan.sw, gone = ["dist1", "dist2", "acc1", "acc2", "acc3"].find(function (id) { return !sim.route("sd1", S[id].ip).routed && !sim.route("sd1", S[id].ip).local; });
  const who = !gone ? "A switch" : /^dist/.test(gone) ? said(sim, gone).replace(/^d/, "D") : "The " + said(sim, gone);
  return workCauses(sim, v).concat([C("switch", !!gone, who + " doesn't answer from the service desk", "Every switch answers.", gone ? "ping " + S[gone].ip + " from the service desk PC: no reply." : "")]);
}
const savedAccess = function (sim) { const id = ["acc1", "acc2", "acc3"].find(function (a) { return unsaved(sim.d[a].sw); }); return [C("unsaved", !!id, (id ? "The " + name(sim, id) : "An access switch") + " has changes that haven't been saved", "Every access switch is saved.", id ? "show startup-config on the " + name(sim, id) + ": it's not what's running." : "")]; };

const CJ2 = {
  id: "CP-J2", level: "campus", title: "The spanning-tree root where it belongs: distribution switch 1, with distribution switch 2 behind it",
  already: ["works", "saved1", "saved2", "saved3"],
  start(seed) {
    const b = CJ1.start(seed), sim = b.sim;
    for (const a of CJ1.solve(b.v)) { if (a.t === "cmd") exec(sim, a.dev, a.line); else sim.apply(a); }
    sim.cli = {};
    return { sim: sim, v: b.v };
  },
  brief() { return { quote: "Last Tuesday someone on the bench floor knocked the power out of the little switch in the 2F closet, and the whole building stopped for half a minute: the service desk, management, the lot, not just 2F. The 2F switch is only meant to serve its own floor. Sort out who's in charge of the network, so losing one floor's switch only loses that floor.", from: "Rafiki, owner" }; },
  mason: "Find the root before you change anything: show spanning-tree on any switch says who it is, and why. Then decide who should be root, who takes over when it's gone, and set it where it belongs, not by pushing someone else down.",
  limits: function (v) {
    const p = v.plan, S = p.sw;
    return ["The VLANs in use: " + USED.map(function (k) { return p.vlans[k].id + " " + p.vlans[k].name; }).join(", ") + ". Each has its own spanning tree.",
      "Distribution switch 1 (" + S.dist1.host + " " + S.dist1.ip + ") is to be the root of every VLAN in use; distribution switch 2 (" + S.dist2.host + " " + S.dist2.ip + ") the secondary, taking over if distribution switch 1 fails.",
      "The access switches stay as they are. Enable secret: " + p.secret + ". SSH user " + p.user + ", password " + p.userPw + ", from any desk PC."];
  },
  reqs: [
    { id: "root", text: "Distribution switch 1 is the root of every VLAN in use", causes: rootCauses,
      ok: function () { return "Distribution switch 1 is the root of every VLAN in use."; },
      rung1: function () { return "show spanning-tree on distribution switch 1, VLAN by VLAN: the Root ID against this switch's Bridge ID."; },
      rung2: function () { return "The lowest bridge ID wins: the priority first, then the address. A switch becomes root by lowering its own priority, for each VLAN it's to be root of."; } },
    { id: "backup", text: "Distribution switch 2 takes over every VLAN in use if distribution switch 1 fails", causes: backupCauses,
      ok: function () { return "Distribution switch 2's priority is above distribution switch 1's and below every access switch's."; },
      rung1: function () { return "show spanning-tree on distribution switch 2 and on each access switch: each one's Bridge ID priority, VLAN by VLAN."; },
      rung2: function () { return "Take the root away and the next-lowest bridge ID wins. The one meant to take over needs a priority between the root's and everyone else's."; } },
    { id: "works", text: "Everyone still works: every PC online, both printers and every switch answering", causes: switchesCauses,
      ok: function () { return "Every PC is online; both printers and every switch answer."; },
      rung1: function () { return "ping 8.8.8.8 from each PC; the printers and the switches from the service desk."; },
      rung2: function () { return "Moving the root changes which links block: every floor still has a way up."; } },
    { id: "saved1", text: "Distribution switch 1 is saved", causes: savedCauses("dist1", "distribution switch 1"), ok: function () { return "It's saved."; }, rung1: function () { return "show startup-config against show running-config."; }, rung2: function () { return "Only what's saved survives a power cut."; } },
    { id: "saved2", text: "Distribution switch 2 is saved", causes: savedCauses("dist2", "distribution switch 2"), ok: function () { return "It's saved."; }, rung1: function () { return "show startup-config against show running-config."; }, rung2: function () { return "Only what's saved survives a power cut."; } },
    { id: "saved3", text: "Every access switch is saved", causes: savedAccess, ok: function () { return "Every access switch is saved."; }, rung1: function () { return "show startup-config against show running-config, on each."; }, rung2: function () { return "A change typed and not saved is gone after a power cut."; } }
  ],
  solve(v) {
    const p = v.plan, out = [], t = function (l) { out.push({ t: "cmd", dev: "sd1", line: l }); }, list = USED.map(function (k) { return p.vlans[k].id; }).join(",");
    [["dist1", "primary"], ["dist2", "secondary"]].forEach(function (d) {
      ["ssh " + p.user + "@" + p.sw[d[0]].ip, p.userPw, "enable", p.secret, "configure terminal", "spanning-tree vlan " + list + " root " + d[1], "end", "copy running-config startup-config", "", "exit"].forEach(t);
    });
    return out;
  },
  answer(v) { const p = v.plan, list = USED.map(function (k) { return p.vlans[k].id; }).join(","); return ["From the service desk PC: ssh " + p.user + "@" + p.sw.dist1.ip + "; configure terminal; spanning-tree vlan " + list + " root primary; end; copy running-config startup-config.", "Then ssh " + p.user + "@" + p.sw.dist2.ip + ": spanning-tree vlan " + list + " root secondary; save."]; },
  summary() { return ["Distribution switch 1 is the root of every VLAN in use: each floor's traffic goes straight up to it.", "Distribution switch 2 is the secondary: if distribution switch 1 fails, it takes over, not an access switch.", "Losing one floor's switch now loses only that floor."]; }
};

/* ------------------------------------------------------------ CP-J3, the two links between the distribution switches as one */
const DLINKS = ["GigabitEthernet0/21", "GigabitEthernet0/22"];
/* each distribution switch's end of the two links: the ports, their channel settings and the state each member works out */
function lagEnds(sim) {
  return DISTS.map(function (d) {
    sim.syncSwitch(d[0]); const sw = sim.d[d[0]].sw, view = Object.assign({}, sw, { links: sim.switchLinks(d[0]) });
    return { id: d[0], at: d[1], sw: sw, view: view, ports: DLINKS.map(function (n) { const p = sw.ports[n]; return { n: n, p: p, chan: p.chan || null, st: p.chan ? chanState(view, n) : null }; }) };
  });
}
function lagCauses(sim) {
  const E = lagEnds(sim), all = E.flatMap(function (e) { return e.ports.map(function (q) { return Object.assign({ at: e.at }, q); }); });
  const inCh = function (e) { return e.ports.filter(function (q) { return q.chan; }); }, modes = all.filter(function (q) { return q.chan; }).map(function (q) { return q.chan.mode; });
  const none = !all.some(function (q) { return q.chan; }), alone = !none && E.some(function (e) { return !inCh(e).length; });
  const one = !none && !alone && E.find(function (e) { return inCh(e).length === 1 || (inCh(e).length === 2 && inCh(e)[0].chan.group !== inCh(e)[1].chan.group); });
  const mixed = modes.indexOf("on") >= 0 && modes.some(function (m) { return m !== "on"; }), passive = modes.length > 0 && modes.every(function (m) { return m === "passive"; });
  const susp = all.find(function (q) { return q.st === "s"; }), down = all.find(function (q) { return q.st === "D"; }), on = modes.length > 0 && modes.every(function (m) { return m === "on"; });
  const ev = function (e) { return "show etherchannel summary on " + e + ": "; }, g = function (q) { return q ? gi(q.n) : ""; };
  const T = none ? sim.stpAll()[USED.map(function (k) { return sim.net.plan.vlans[k].id; })[0]] : null, blk = T ? E.flatMap(function (e) { return DLINKS.filter(function (n) { const r = T.result.roles[e.id + " " + n]; return r && r.sts === "BLK"; }).map(function (n) { return [e.at, gi(n)]; }); })[0] : null;
  return [C("none", none, "The two links are still two separate trunks: spanning tree blocks one of them, so it carries nothing until the other fails", "The two links are in a port-channel.", blk ? "show spanning-tree on " + blk[0] + ": " + blk[1] + " Altn BLK." : "show etherchannel summary on both: no port-channel."),
    C("alone", alone, "Only one end is bundled: " + (alone ? E.find(function (e) { return inCh(e).length; }).at + "'s ports are in a port-channel, " + E.find(function (e) { return !inCh(e).length; }).at + "'s aren't" : ""), "Both ends are bundled.", alone ? ev(E.find(function (e) { return inCh(e).length; }).at) + "both ports I (stand-alone)." : ""),
    C("one", !!one, "Only one of the two links is in the port-channel at " + (one ? one.at : "one end") + ": the other is still a trunk on its own", "Both links are in it at each end.", one ? ev(one.at) + "one port in the channel." : ""),
    C("passive", passive, "Both ends are passive: each waits for the other to start LACP, so nothing ever bundles", "One end at least is active.", passive ? ev("distribution switch 1") + "both ports I (stand-alone), LACP passive at both ends." : ""),
    C("mixed", mixed, "One end is forced on and the other runs LACP: the forced end bundles without asking, the other never hears LACP and won't", "Both ends bundle the same way.", mixed ? ev(E.find(function (e) { return inCh(e).some(function (q) { return q.chan.mode !== "on"; }); }).at) + "I (stand-alone)." : ""),
    C("susp", !!susp, "A member is suspended (" + g(susp) + " at " + (susp ? susp.at : "") + "): its VLAN settings aren't the port-channel's, so it carries nothing", "No member is suspended.", susp ? ev(susp.at) + g(susp) + "(s)." : ""),
    C("down", !!down, "A member is down (" + g(down) + " at " + (down ? down.at : "") + ")", "Every member is up.", down ? ev(down.at) + g(down) + "(D)." : ""),
    C("on", on, "The bundle is forced on at both ends, not negotiated: nothing checks the far end, so a cable patched to the wrong switch would join it anyway", "It's negotiated by LACP.", on ? ev("distribution switch 1") + "Protocol -, mode on." : "")];
}
/* what the link between the distribution switches carries, at each end: the port-channel's settings if bundled, else the ports' */
function dtrunkCauses(sim, v) {
  const p = v.plan, want = USED.map(function (k) { return p.vlans[k].id; }), E = lagEnds(sim);
  let bad = null;
  E.forEach(function (e) { e.ports.forEach(function (q) { if (bad) return; const c = carries(e.view, q.n), o = q.chan && e.sw.pcs && e.sw.pcs[q.chan.group] ? e.sw.pcs[q.chan.group] : q.p, nm = q.chan ? "Port-channel" + q.chan.group : gi(q.n);
    if (o.mode !== "trunk") bad = { k: "mode", at: e.at, nm: nm };
    else if (want.some(function (x) { return (c.tagged || []).indexOf(x) < 0 && c.untagged !== x; }) || (o.allowed !== "all" && want.some(function (x) { return o.allowed.indexOf(x) < 0; }))) bad = { k: "allowed", at: e.at, nm: nm, miss: want.filter(function (x) { return o.allowed !== "all" && o.allowed.indexOf(x) < 0; }) };
    else if ((o.native || 1) !== p.vlans.native.id) bad = { k: "native", at: e.at, nm: nm }; }); });
  const ev = bad ? "show interfaces trunk on " + bad.at + ": " + bad.nm : "";
  return [C("mode", !!bad && bad.k === "mode", (bad ? bad.nm + " at " + bad.at : "The link") + " isn't a trunk: only one VLAN crosses between the distribution switches", "It's a trunk.", ev + " missing."),
    C("allowed", !!bad && bad.k === "allowed", (bad ? bad.nm + " at " + bad.at : "The link") + " doesn't carry every VLAN in use" + (bad && bad.miss && bad.miss.length ? " (" + bad.miss.length + " left off its allowed list)" : ""), "It carries every VLAN in use.", ev + ": Vlans allowed on trunk."),
    C("native", !!bad && bad.k === "native", (bad ? bad.nm + " at " + bad.at : "The link") + "'s native VLAN isn't the unused one the records give", "Its native VLAN is the records'.", ev + ": Native vlan.")];
}
const rootKept = function (sim, v) { const r = rootCauses(sim, v), b = backupCauses(sim, v); return r.concat(b.map(function (c) { return Object.assign({}, c, { id: "b-" + c.id }); })); };

const CJ3 = {
  id: "CP-J3", level: "campus", title: "The two links between the distribution switches as one: a port-channel, negotiated by LACP",
  already: ["trunk", "root", "works", "saved1", "saved2"],
  start(seed) {
    const b = CJ2.start(seed), sim = b.sim;
    for (const a of CJ2.solve(b.v)) { if (a.t === "cmd") exec(sim, a.dev, a.line); else sim.apply(a); }
    sim.cli = {};
    return { sim: sim, v: b.v };
  },
  brief() { return { quote: "The installer ran two cables between the distribution switches, for twice the bandwidth and a spare if one failed. The monitoring says one of them has never carried a thing. Make them work as one, both carrying, and if one goes the other keeps going.", from: "Rafiki, owner" }; },
  mason: "Look at why the second cable is idle before you change anything: show spanning-tree on distribution switch 2. Then bundle both ends the same way, and check the bundle from both sides.",
  limits: function (v) {
    const p = v.plan, S = p.sw;
    return ["Between distribution switch 1 (" + S.dist1.host + " " + S.dist1.ip + ") and distribution switch 2 (" + S.dist2.host + " " + S.dist2.ip + "): ports 21 to 21 and 22 to 22, each a trunk now.",
      "The two links to be one port-channel, both ends negotiated by LACP; the port-channel carries what the links carry now: every VLAN in use, the native VLAN " + p.vlans.native.id + ".",
      "Enable secret: " + p.secret + ". SSH user " + p.user + ", password " + p.userPw + ", from any desk PC."];
  },
  reqs: [
    { id: "bundle", text: "The two links between the distribution switches are one port-channel at both ends, negotiated by LACP", causes: lagCauses,
      ok: function () { return "Both links are bundled at both ends, by LACP: spanning tree sees one link, and both carry."; },
      rung1: function () { return "show etherchannel summary on both distribution switches, then show spanning-tree on distribution switch 2."; },
      rung2: function () { return "A bundle forms only if both ends agree: LACP needs at least one end to start it, and a member whose settings differ from its port-channel is set aside."; } },
    { id: "trunk", text: "The link between them still carries every VLAN in use, on the records' native VLAN", causes: dtrunkCauses,
      ok: function () { return "Every VLAN in use crosses between the distribution switches, on the records' native VLAN."; },
      rung1: function () { return "show interfaces trunk on both distribution switches: the port-channel's line, or the ports'."; },
      rung2: function () { return "A port-channel's settings are the bundle's: change them on the port-channel, and the members follow."; } },
    { id: "root", text: "Distribution switch 1 is still the root, distribution switch 2 behind it", causes: rootKept,
      ok: function () { return "Distribution switch 1 is the root of every VLAN in use; distribution switch 2 the secondary."; },
      rung1: function () { return "show spanning-tree on the distribution switches."; },
      rung2: function () { return "Bundling changes ports, not priorities: the root stays where it was put."; } },
    { id: "works", text: "Everyone still works: every PC online, both printers and every switch answering", causes: switchesCauses,
      ok: function () { return "Every PC is online; both printers and every switch answer."; },
      rung1: function () { return "ping 8.8.8.8 from each PC; the printers and the switches from the service desk."; },
      rung2: function () { return "Each floor reaches both distribution switches on its own uplinks: a bundle between them doesn't change that."; } },
    { id: "saved1", text: "Distribution switch 1 is saved", causes: savedCauses("dist1", "distribution switch 1"), ok: function () { return "It's saved."; }, rung1: function () { return "show startup-config against show running-config."; }, rung2: function () { return "Only what's saved survives a power cut."; } },
    { id: "saved2", text: "Distribution switch 2 is saved", causes: savedCauses("dist2", "distribution switch 2"), ok: function () { return "It's saved."; }, rung1: function () { return "show startup-config against show running-config."; }, rung2: function () { return "Only what's saved survives a power cut."; } }
  ],
  solve(v) {
    const p = v.plan, out = [], t = function (l) { out.push({ t: "cmd", dev: "sd1", line: l }); };
    ["dist1", "dist2"].forEach(function (d) { ["ssh " + p.user + "@" + p.sw[d].ip, p.userPw, "enable", p.secret, "configure terminal", "interface range gi0/21 - 22", "channel-group 1 mode active", "end", "copy running-config startup-config", "", "exit"].forEach(t); });
    return out;
  },
  answer(v) { const p = v.plan; return ["From the service desk PC: ssh " + p.user + "@" + p.sw.dist1.ip + "; configure terminal; interface range gi0/21 - 22; channel-group 1 mode active; end; copy running-config startup-config.", "The same on distribution switch 2 (" + p.sw.dist2.ip + "); then show etherchannel summary on both: Po1(SU), both ports (P)."]; },
  summary() { return ["The two links between the distribution switches are one port-channel, negotiated by LACP at both ends.", "Spanning tree sees one link, so neither cable is blocked: both carry, and if one fails the other carries on.", "The port-channel carries every VLAN in use, as the links did."]; }
};

/* ------------------------------------------------------------ CP-J4, the gateways onto distribution switch 1 */
const DHCPV = [["svc", "sd1"], ["bench", "bn1"], ["office", "mgr"]];
/* the link between the edge router and distribution switch 1, as the records give it: a /30 in the campus's block */
const transit = function (p) { const b = p.vlans.svc.net.split(".")[1]; return { net: "10." + b + ".255.0", cidr: "10." + b + ".255.0/30", edge: "10." + b + ".255.1", dist: "10." + b + ".255.2", mask: "255.255.255.252", block: "10." + b + ".0.0", bmask: "255.255.0.0" }; };
const svi = function (sim, k, p) { const sw = sim.d.dist1.sw, v = p.vlans[k].id; return sw.svis[v] || null; };
const sviUp = function (sim, p, k) { return l3Ifs(sim.l3View("dist1")).some(function (f) { return f.name === "Vlan" + p.vlans[k].id && f.up; }); };
function routingCauses(sim) {
  const on = !!sim.d.dist1.sw.routing;
  return [C("off", !on, "Distribution switch 1 doesn't route: ip routing is off, so its VLAN interfaces are only addresses, and nothing passes between them", "It routes.", "show ip route on distribution switch 1: Default gateway is ..., no routing table."),
    C("table", on && !l3Ifs(sim.l3View("dist1")).some(function (f) { return f.up && f.ip && /^Vlan/.test(f.name) && f.name !== "Vlan" + sim.net.plan.vlans.mgmt.id; }), "It routes, but it has no VLAN interface up with an address except the management VLAN's", "Its VLAN interfaces are connected networks.", "show ip route on distribution switch 1: one connected network.")];
}
function sviCauses(sim, v) {
  const p = v.plan, k = USED.find(function (x) { const r = svi(sim, x, p); return !r || r.ip !== p.vlans[x].gw || r.mask !== p.mask || r.shutdown || !sviUp(sim, p, x); }), r = k ? svi(sim, k, p) : null, V = k ? p.vlans[k] : null;
  const at = V ? "show ip interface brief on distribution switch 1: Vlan" + V.id : "";
  return [C("none", !!k && !r, "VLAN " + (V ? V.id + " (" + V.name + ")" : "") + " has no interface on distribution switch 1: nothing there is its gateway", "Every VLAN in use has its interface.", at + " missing."),
    C("addr", !!r && r.ip !== V.gw, "VLAN " + (V ? V.id : "") + "'s interface on distribution switch 1 isn't at the gateway address its devices already use", "Each is at its VLAN's gateway address.", at + " " + (r && r.ip || "unassigned") + "."),
    C("mask", !!r && r.ip === V.gw && r.mask !== p.mask, "VLAN " + (V ? V.id : "") + "'s interface has the wrong mask for its network", "Each has its network's mask.", r ? "show running-config on distribution switch 1: interface Vlan" + V.id + ", ip address " + r.ip + " " + r.mask + "." : ""),
    C("shut", !!r && r.ip === V.gw && r.mask === p.mask && !!r.shutdown, "VLAN " + (V ? V.id : "") + "'s interface is shut down", "Each is up.", at + " administratively down."),
    C("down", !!r && !r.shutdown && r.ip === V.gw && r.mask === p.mask && !sviUp(sim, p, k), "VLAN " + (V ? V.id : "") + "'s interface is down: no port on distribution switch 1 that's up carries the VLAN", "Each is up.", at + " up/down.")];
}
function rosCauses(sim, v) {
  const p = v.plan, subs = Object.keys(sim.d.edge.sw.subs || {}).filter(function (n) { return n.split(".")[0] === p.edge.lan || n.split(".")[0] === p.edge.lan.replace("GigabitEthernet", "Gi"); });
  const dup = USED.find(function (k) { return sim.owners(p.vlans[k].gw, sim.domain(sim.vnode("dist1", p.vlans[k].id))).length > 1; });
  return [C("dup", !!dup, "Two devices answer for VLAN " + (dup ? p.vlans[dup].id : "") + "'s gateway address: the edge router's subinterface and distribution switch 1's interface, both on the VLAN", "Only distribution switch 1 answers for each gateway.", dup ? "arp -a on a PC in the VLAN, twice: the gateway's hardware address changes; %IP-4-DUPADDR on distribution switch 1's console." : ""),
    C("left", subs.length > 0, "Router-on-a-stick isn't retired: the edge router still has " + subs.length + " subinterface" + (subs.length === 1 ? "" : "s") + " for the VLANs in its configuration", "The edge router has no subinterfaces left.", "show ip interface brief on the edge router: " + (subs[0] || "") + ".")];
}
function linkCauses(sim, v) {
  const p = v.plan, t = transit(p), port = sim.d.dist1.sw.ports["GigabitEthernet0/24"], R = sim.rtView("edge"), live = sim.rtLive("edge"), ea = RT.addrOf(R, p.edge.lan, live), e = sim.d.edge.sw.ifs[p.edge.lan] || {};
  const df = l3Ifs(sim.l3View("dist1")).find(function (f) { return f.name === "GigabitEthernet0/24"; });
  return [C("trunk", !port.routed, "Distribution switch 1's port 24 is still a switch port (the old trunk to the edge router): it can't take an address", "It's a routed port.", "show running-config on distribution switch 1: interface GigabitEthernet0/24 has no \"no switchport\"."),
    C("daddr", !!port.routed && (port.ip !== t.dist || port.mask !== t.mask), "Distribution switch 1's end of the link isn't the records' address and mask (the second usable address of the /30)", "Its end has the records' address.", "show ip interface brief on distribution switch 1: Gi0/24 " + (port.ip || "unassigned") + "; show running-config: its mask."),
    C("eaddr", !ea || ea.ip !== t.edge || ea.mask !== t.mask, "The edge router's end of the link isn't the records' address and mask (the first usable address of the /30)", "Its end has the records' address.", "show ip interface brief on the edge router: " + p.edge.lan.replace("GigabitEthernet", "Gi") + " " + (ea ? ea.ip : "unassigned") + "."),
    C("shut", !!port.shutdown || !!e.shutdown, "An end of the link is shut down", "Both ends are up.", "show ip interface brief: administratively down."),
    C("down", !port.shutdown && !e.shutdown && !!df && !df.up, "The link is down", "It's up.", "show ip interface brief on distribution switch 1: Gi0/24 down.")];
}
function routeCauses(sim, v) {
  const p = v.plan, t = transit(p), D = sim.d.dist1.sw.routing ? l3Route(sim.l3View("dist1"), "8.8.8.8", sim.learned("dist1")) : null, R = sim.rtView("edge"), live = sim.rtLive("edge");
  const off = USED.filter(function (k) { const r = RT.lookup(R, p.vlans[k].gw, live); return !r || r.nh !== t.dist; }), miss = off[0], none = off.length === USED.length;
  return [C("def", !D, "Distribution switch 1 has no default route: anything not on its own networks, the internet included, it has nowhere to send", "It has a default route.", "show ip route on distribution switch 1: Gateway of last resort is not set."),
    C("defnh", !!D && D.nh !== t.edge, "Distribution switch 1's default route points somewhere other than the edge router's end of the link", "It points at the edge router.", D ? "show ip route on distribution switch 1: S* 0.0.0.0/0 via " + (D.nh || D.iface) + "." : ""),
    C("back", none, "The edge router has no route back to the campus's networks: replies from the internet have nowhere to go", "It routes the campus's block to distribution switch 1.", "show ip route on the edge router: no route for " + (miss ? p.vlans[miss].net : "") + "."),
    C("narrow", !!miss, "The edge router's route back doesn't cover every VLAN in use (" + (miss ? p.vlans[miss].net : "") + " goes elsewhere or nowhere)", "Every VLAN in use is routed to distribution switch 1.", miss ? "show ip route on the edge router: " + p.vlans[miss].net + " isn't via " + t.dist + "." : "")];
}
function natCauses(sim, v) {
  const p = v.plan, rt = sim.d.edge.sw, subs = Object.keys(rt.subs || {}).filter(function (n) { return n.split(".")[0] === p.edge.lan; });
  const inside = subs.length ? subs.every(function (n) { return rt.subs[n].nat === "inside"; }) : (rt.ifs[p.edge.lan] || {}).nat === "inside";
  const rule = (rt.nat || []).find(function (x) { return x.overload && rt.acls[x.list]; }), covers = rule && RT.aclVerdict(rt, rule.list, { proto: "ip", src: p.vlans.svc.gw, dst: "8.8.8.8" }).permit;
  return [C("inside", !inside, "The edge router's side facing the campus isn't NAT's inside: the campus's addresses go out untranslated, and the provider drops them", "Its campus side is NAT's inside.", "show ip nat translations on the edge router: nothing for the campus; show running-config: " + p.edge.lan + " has no ip nat inside."),
    C("list", inside && !covers, "NAT's list doesn't cover the campus's addresses", "It covers them.", "show access-lists on the edge router.")];
}
function relayCauses(sim, v) {
  const p = v.plan, t = transit(p), bad = DHCPV.find(function (x) { return !sim.dhcpServers(x[1]).length; }), k = bad && bad[0], r = k ? svi(sim, k, p) : null, h = r && r.helpers || [];
  const at = k ? "ipconfig /renew on the " + name(sim, bad[1]) + ": no DHCP server answers." : "";
  return [C("none", !!k && !h.length, "Nothing relays VLAN " + (k ? p.vlans[k].id : "") + "'s DHCP requests: a PC's broadcast for an address stops at its VLAN, and the pools are on the edge router", "Each VLAN's requests are relayed.", at + " show running-config on distribution switch 1: interface Vlan" + (k ? p.vlans[k].id : "") + " has no ip helper-address."),
    C("wrong", !!k && h.length > 0 && h.indexOf(t.edge) < 0, "VLAN " + (k ? p.vlans[k].id : "") + "'s requests are relayed to an address where no DHCP server answers", "They go to the edge router.", at),
    C("noway", !!k && h.indexOf(t.edge) >= 0, "VLAN " + (k ? p.vlans[k].id : "") + "'s requests reach the edge router, but its answer can't get back to distribution switch 1", "The answers get back.", at + " show ip dhcp binding on the edge router: nothing new.")];
}
const at1 = function (p, id) { return id === "dist1" ? p.vlans.mgmt.gw : p.sw[id].ip; };   /* from CP-J4 on, distribution switch 1 answers at the management VLAN's gateway */
export function reachCauses(sim, v) {
  const p = v.plan, gone = ["dist1", "dist2", "acc1", "acc2", "acc3"].find(function (id) { const r = sim.route("sd1", at1(p, id)); return !r.routed && !r.local; });
  const who = !gone ? "A switch" : /^dist/.test(gone) ? said(sim, gone).replace(/^d/, "D") : "The " + said(sim, gone);
  return workCauses(sim, v).concat([C("switch", !!gone, who + " doesn't answer from the service desk", "Every switch answers.", gone ? "ping " + at1(p, gone) + " from the service desk PC: no reply." : "")]);
}
const savedEdge = function (sim) { const sw = sim.d.edge.sw; return [C("unsaved", unsaved(sw), "The edge router hasn't been saved: a power cut takes the changes away", "It's saved.", "show startup-config on the edge router: it's not what's running.")]; };

const CJ4 = {
  id: "CP-J4", level: "campus", title: "The gateways onto distribution switch 1: router-on-a-stick retired, the edge router left to the internet",
  already: ["nat", "dhcp", "works", "saved1", "saved2"],
  start(seed) {
    const b = CJ3.start(seed), sim = b.sim;
    for (const a of CJ3.solve(b.v)) { if (a.t === "cmd") exec(sim, a.dev, a.line); else sim.apply(a); }
    sim.cli = {};
    return { sim: sim, v: b.v };
  },
  brief() { return { quote: "Every packet between two of our floors goes down to the edge router and back up the same cable to distribution switch 1. The distribution switches can route: make distribution switch 1 every network's gateway, and leave the edge router doing what an edge router does, the internet. Nobody should notice, except that things are quicker. Do it before eight tomorrow.", from: "Rafiki, owner" }; },
  mason: "Work from the console, not over the network you're moving: over SSH you're standing on the branch you're cutting. Get everything ready that won't break anything first, then cut over in the order that keeps the outage shortest.",
  limits: function (v) {
    const p = v.plan, t = transit(p);
    return ["Distribution switch 1 (" + p.sw.dist1.host + ") becomes every VLAN's gateway: on each VLAN in use, its interface takes the gateway address the VLAN's devices already use (" + USED.map(function (k) { return p.vlans[k].id + " " + p.vlans[k].gw; }).join(", ") + "). The management VLAN's too: distribution switch 1 answers at " + p.vlans.mgmt.gw + " from now on.",
      "The link between the edge router (" + p.edge.lan + ") and distribution switch 1 (port 24): " + t.cidr + ", the edge router on the first usable address, distribution switch 1 on the second.",
      "Distribution switch 1 sends everything it has no route for to the edge router; the edge router sends the campus's block, " + t.block + "/16, back to distribution switch 1. The edge router keeps NAT and the DHCP pools: distribution switch 1 relays the " + DHCPV.map(function (x) { return p.vlans[x[0]].name; }).join(", ") + " VLANs' requests to it.",
      "Router-on-a-stick is retired: the edge router's subinterfaces removed.",
      "Your laptop's console cable reaches anything in the data room. Console password: " + p.console + ". Enable secret: " + p.secret + "."];
  },
  reqs: [
    { id: "routing", text: "Distribution switch 1 routes", causes: routingCauses,
      ok: function () { return "Distribution switch 1 routes: its VLAN interfaces are connected networks."; },
      rung1: function () { return "show ip route on distribution switch 1."; },
      rung2: function () { return "A layer 3 switch only routes once it's told to; until then its VLAN interfaces are just addresses for managing it."; } },
    { id: "svis", text: "Every VLAN in use has its gateway on distribution switch 1, up", causes: sviCauses,
      ok: function () { return "Every VLAN in use has its interface on distribution switch 1, at its gateway address, up."; },
      rung1: function () { return "show ip interface brief on distribution switch 1, then each VLAN interface in show running-config."; },
      rung2: function () { return "The devices keep the gateway they have: whatever answers at that address on their VLAN is their router."; } },
    { id: "ros", text: "Router-on-a-stick is retired: only distribution switch 1 answers for the gateways", causes: rosCauses,
      ok: function () { return "The edge router has no subinterfaces left; only distribution switch 1 answers for the gateways."; },
      rung1: function () { return "show ip interface brief on the edge router; arp -a on a PC, twice."; },
      rung2: function () { return "Two devices answering for one address take turns: whichever answers last is the one the PC uses."; } },
    { id: "link", text: "The edge router and distribution switch 1 are joined by a routed link, as the records give it", causes: linkCauses,
      ok: function () { return "Distribution switch 1's port 24 is routed, both ends on the records' /30, up."; },
      rung1: function () { return "show ip interface brief on both, and port 24's lines in distribution switch 1's running configuration."; },
      rung2: function () { return "A block's first address is its network and its last its broadcast: the usable ones lie between. An address goes on a routed port, never on a switch port."; } },
    { id: "routes", text: "Routes both ways: distribution switch 1's default to the edge router, the edge router's way back to the campus", causes: routeCauses,
      ok: function () { return "Distribution switch 1 sends the rest to the edge router; the edge router sends the campus's block back."; },
      rung1: function () { return "show ip route on both: the gateway of last resort on one, the route for the campus on the other."; },
      rung2: function () { return "Every router needs a route there and every router on the way back needs a route back: a packet that arrives and can't be answered is lost all the same."; } },
    { id: "nat", text: "The edge router still translates the campus's traffic to the internet", causes: natCauses,
      ok: function () { return "The edge router's campus side is NAT's inside, and its list covers the campus."; },
      rung1: function () { return "show ip nat translations and show running-config on the edge router."; },
      rung2: function () { return "NAT translates only what comes in on an inside interface and goes out on an outside one."; } },
    { id: "dhcp", text: "A PC that asks for an address again still gets one, in every VLAN with a pool", causes: relayCauses,
      ok: function () { return "Each VLAN's requests are relayed to the edge router, and its answers get back."; },
      rung1: function () { return "ipconfig /release then /renew on a PC in each VLAN; the VLAN interfaces' lines on distribution switch 1."; },
      rung2: function () { return "A request for an address is a broadcast: it never crosses a router unless the router relays it, and the relay's address tells the server which pool."; } },
    { id: "works", text: "Everyone still works: every PC online, both printers and every switch answering", causes: reachCauses,
      ok: function () { return "Every PC is online; both printers and every switch answer."; },
      rung1: function () { return "ping 8.8.8.8 from each PC; the printers and the switches from the service desk."; },
      rung2: function () { return "Each switch sends anything off its own network to its default gateway: whatever answers there now."; } },
    { id: "saved1", text: "Distribution switch 1 is saved", causes: savedCauses("dist1", "distribution switch 1"), ok: function () { return "It's saved."; }, rung1: function () { return "show startup-config against show running-config."; }, rung2: function () { return "Only what's saved survives a power cut."; } },
    { id: "saved2", text: "The edge router is saved", causes: savedEdge, ok: function () { return "It's saved."; }, rung1: function () { return "show startup-config against show running-config."; }, rung2: function () { return "Only what's saved survives a power cut."; } }
  ],
  solve(v, sim) {
    const p = v.plan, t = transit(p), out = [], c = function (l) { out.push({ t: "cmd", dev: "tech", line: l, cli: true }); }, n = sim ? sim.net.extra.runs || 0 : 0;
    const login = function () { [""].concat([p.console, "enable", p.secret, "configure terminal"]).forEach(c); };
    /* ready first, breaking nothing: routing on, the new interfaces made but left shut, the default route */
    out.push({ t: "lay", a: { dev: "tech", port: "USB-C" }, b: { dev: "dist1", port: "CONSOLE" } }); login();
    c("ip routing");
    USED.filter(function (k) { return k !== "mgmt"; }).forEach(function (k) { c("interface vlan " + p.vlans[k].id); c("ip address " + p.vlans[k].gw + " " + p.mask); if (DHCPV.some(function (x) { return x[0] === k; })) c("ip helper-address " + t.edge); c("shutdown"); c("exit"); });
    c("ip route 0.0.0.0 0.0.0.0 " + t.edge); c("end");
    /* the edge router: router-on-a-stick out, the link and the way back in (the outage starts) */
    out.push({ t: "pull", cable: "c-console-" + (n + 1) }, { t: "lay", a: { dev: "tech", port: "USB-C" }, b: { dev: "edge", port: "CONSOLE" } }); login();
    USED.forEach(function (k) { c("no interface " + p.edge.lan + "." + p.vlans[k].id); });
    c("interface " + p.edge.lan); c("ip address " + t.edge + " " + t.mask); c("ip nat inside"); c("exit"); c("ip route " + t.block + " " + t.bmask + " " + t.dist); c("end"); c("copy running-config startup-config"); c("");
    /* back to distribution switch 1: the link routed, the gateways up (the outage ends) */
    out.push({ t: "pull", cable: "c-console-" + (n + 2) }, { t: "lay", a: { dev: "tech", port: "USB-C" }, b: { dev: "dist1", port: "CONSOLE" } }); login();
    c("interface gi0/24"); c("no switchport"); c("ip address " + t.dist + " " + t.mask); c("exit");
    c("interface vlan " + p.vlans.mgmt.id); c("ip address " + p.vlans.mgmt.gw + " " + p.mask); c("exit");
    USED.filter(function (k) { return k !== "mgmt"; }).forEach(function (k) { c("interface vlan " + p.vlans[k].id); c("no shutdown"); c("exit"); });
    c("end"); c("copy running-config startup-config"); c("");
    out.push({ t: "pull", cable: "c-console-" + (n + 3) });
    return out;
  },
  answer(v) {
    const p = v.plan, t = transit(p);
    return ["Console into distribution switch 1: ip routing; each VLAN's interface at its gateway address, the pooled VLANs with ip helper-address " + t.edge + ", left shut; ip route 0.0.0.0 0.0.0.0 " + t.edge + ".",
      "Console into the edge router: no interface " + p.edge.lan + ".<each VLAN>; interface " + p.edge.lan + ": ip address " + t.edge + " " + t.mask + ", ip nat inside; ip route " + t.block + " " + t.bmask + " " + t.dist + "; save.",
      "Back on distribution switch 1: interface gi0/24, no switchport, ip address " + t.dist + " " + t.mask + "; the management VLAN's interface to " + p.vlans.mgmt.gw + "; no shutdown on each VLAN interface; save."];
  },
  summary() { return ["Distribution switch 1 routes between the VLANs: each VLAN's gateway is its own interface there.", "The edge router is joined to it by a routed /30 and does the internet: NAT, and the DHCP pools, which distribution switch 1 relays to.", "Traffic between floors no longer goes down to the edge router and back up."]; }
};

/* ------------------------------------------------------------ CP-J5, OSPF across the core */
/* the five links this work order puts to work (the core switches' ports 2, to distribution switch 2, wait for the next one) */
const CORE5 = function (p) { return coreLinks(p).filter(function (l) { return l.b !== "dist2"; }); };
const endOf = function (l, id) { return l.a === id ? { port: l.ap, ip: l.ia, far: l.b } : { port: l.bp, ip: l.ib, far: l.a }; };
const ifName = function (id, port) { return id === "edge" ? "GigabitEthernet" + port.replace(/^Gi/, "") : "GigabitEthernet0/" + port; };
const OSPF_DEVS = ["edge", "core1", "core2", "dist1"];
const sayOf = function (sim, id) { return id === "edge" ? "the edge router" : id === "core1" ? "core switch 1" : id === "core2" ? "core switch 2" : said(sim, id); };
const Cap = function (t) { return t.replace(/^./, function (m) { return m.toUpperCase(); }); };
const edgeIf = function (sim, n) { const R = sim.rtView("edge"), live = sim.rtLive("edge"); return { a: RT.addrOf(R, n, live), st: RT.rtStatus(R, n), f: sim.d.edge.sw.ifs[n] || {} }; };
function edgeEndCauses(sim, v) {
  const L = CORE5(v.plan).filter(function (l) { return l.a === "edge"; });
  const bad = L.find(function (l) { const e = edgeIf(sim, ifName("edge", l.ap)); return !e.a || e.a.ip !== l.ia || e.a.mask !== l.mask || e.st[1] !== "up"; }) || L[0], n = ifName("edge", bad.ap), e = edgeIf(sim, n), g = gi(n);
  const to = sayOf(sim, bad.b);
  return [C("eaddr", !e.a || e.a.ip !== bad.ia || e.a.mask !== bad.mask, "The edge router's link to " + to + " (" + g + ") isn't on the records' address and mask (the end nearer the provider takes the first usable address)", "Both its links to the core have the records' addresses.", "show ip interface brief on the edge router: " + g + " " + (e.a ? e.a.ip : "unassigned") + "."),
    C("eshut", !!e.f.shutdown, "The edge router's link to " + to + " (" + g + ") is shut down", "Both are up.", "show ip interface brief on the edge router: " + g + " administratively down."),
    C("edown", !e.f.shutdown && e.st[1] !== "up", "The edge router's link to " + to + " (" + g + ") is down", "Both are up.", "show ip interface brief on the edge router: " + g + " down.")];
}
function distEndCauses(sim, v) {
  const L = CORE5(v.plan).filter(function (l) { return l.b === "dist1"; }), ifs = l3Ifs(sim.l3View("dist1"));
  const look = function (l) { const n = ifName("dist1", l.bp), p = sim.d.dist1.sw.ports[n], f = ifs.find(function (x) { return x.name === n; }); return { n: n, p: p, f: f }; };
  const bad = L.find(function (l) { const k = look(l); return !k.p.routed || k.p.ip !== l.ib || k.p.mask !== l.mask || !k.f || !k.f.up; }) || L[0], k = look(bad), g = gi(k.n), to = sayOf(sim, bad.a);
  return [C("trunk", !k.p.routed, "Distribution switch 1's link to " + to + " (" + g + ") is still a switch port: it can't take an address", "Both its links to the core are routed ports.", "show running-config on distribution switch 1: interface " + k.n + " has no \"no switchport\"."),
    C("daddr", !!k.p.routed && (k.p.ip !== bad.ib || k.p.mask !== bad.mask), "Distribution switch 1's link to " + to + " (" + g + ") isn't on the records' address and mask (the end further from the provider takes the second usable address)", "Both have the records' addresses.", "show ip interface brief on distribution switch 1: " + g + " " + (k.p.ip || "unassigned") + "."),
    C("dshut", !!k.p.routed && !!k.p.shutdown, "Distribution switch 1's link to " + to + " (" + g + ") is shut down", "Both are up.", "show ip interface brief on distribution switch 1: " + g + " administratively down."),
    C("ddown", !!k.p.routed && !k.p.shutdown && !!k.f && !k.f.up, "Distribution switch 1's link to " + to + " (" + g + ") is down", "Both are up.", "show ip interface brief on distribution switch 1: " + g + " down.")];
}
/* OSPF on each link: both ends running it, the link in it at both ends, neither passive, the same area, the same MTU: FULL */
const runsOspf = function (sim, id) { const w = sim.d[id].sw; return !!w.ospf && (id === "edge" || !!w.routing); };
const nbrCausesFor = function (pick) { return function (sim, v) {
  const R = sim.ospfAll(), L = pick(v.plan);
  const ofIf = function (id, n) { const r = R.routers[id]; return r ? r.ifs.find(function (f) { return f.name === n; }) : null; };
  const full = function (l) { const A = endOf(l, l.a), Bn = endOf(l, l.b); return (R.nbrs[l.a] || []).some(function (x) { return x.ip === Bn.ip && /^FULL/.test(x.state); }) && (R.nbrs[l.b] || []).some(function (x) { return x.ip === A.ip && /^FULL/.test(x.state); }); };
  const l = L.find(function (k) { return !full(k); }) || L[0], ends = [l.a, l.b].map(function (id) { const e = endOf(l, id), n = ifName(id, e.port); return { id: id, n: n, g: gi(n), f: ofIf(id, n) }; });
  /* an interface that's down isn't in OSPF at all: the link itself first (the Annex's fibre with the wrong modules, CP-J8; a core port shut) */
  const ifUp = function (id, n) { if (id === "edge") return RT.rtStatus(sim.rtView("edge"), n)[1] === "up"; return l3Ifs(sim.l3View(id)).some(function (f) { return f.name === n && f.up; }); };
  const noProc = ends.find(function (e) { return !runsOspf(sim, e.id); }), down = ends.find(function (e) { return runsOspf(sim, e.id) && !e.f && !ifUp(e.id, e.n); });
  const noNet = ends.find(function (e) { return runsOspf(sim, e.id) && !e.f; }), pas = ends.find(function (e) { return e.f && e.f.passive; });
  const both = ends[0].f && ends[1].f, link = Cap(sayOf(sim, l.a)) + " and " + sayOf(sim, l.b);
  return [C("proc", !!noProc, (noProc ? Cap(sayOf(sim, noProc.id)) : "A router") + " doesn't run OSPF", "Every router in the core runs OSPF.", noProc ? "show ip protocols on " + sayOf(sim, noProc.id) + ": nothing." : ""),
    C("down", !noProc && !!down, link + " can't be neighbours: the link between them is down at " + (down ? sayOf(sim, down.id) + " (" + down.g + ")" : "one end"), "The link is up at both ends.", down ? "show ip interface brief on " + sayOf(sim, down.id) + ": " + down.g + " down." : ""),
    C("net", !noProc && !down && !!noNet, (noNet ? Cap(sayOf(sim, noNet.id)) + "'s link to " + sayOf(sim, noNet.id === l.a ? l.b : l.a) + " (" + noNet.g + ")" : "A link") + " isn't in OSPF: none of its network statements covers that interface's address", "Every link of the core is in OSPF at both ends.", noNet ? "show ip ospf interface brief on " + sayOf(sim, noNet.id) + ": " + noNet.g + " missing." : ""),
    C("passive", !noProc && !noNet && !!pas, (pas ? Cap(sayOf(sim, pas.id)) + "'s link to " + sayOf(sim, pas.id === l.a ? l.b : l.a) + " (" + pas.g + ")" : "A link") + " is passive: it advertises the link but never says hello across it, so no neighbour forms", "No link of the core is passive.", pas ? "show ip protocols on " + sayOf(sim, pas.id) + ": Passive Interface(s): " + pas.n + "." : ""),
    C("area", !!both && !pas && ends[0].f.area !== ends[1].f.area, link + " have the link in different areas", "Both ends in area 0.", both ? "show ip ospf interface brief on each: area " + ends[0].f.area + " and " + ends[1].f.area + "." : ""),
    C("mtu", !!both && !pas && ends[0].f.area === ends[1].f.area && (ends[0].f.mtu || 1500) !== (ends[1].f.mtu || 1500), link + " disagree about the link's MTU: they hear each other but never get past EXSTART", "Both ends the same MTU.", "show ip ospf neighbor: EXSTART."),
    C("nofull", !noProc && !noNet && !pas && !(both && (ends[0].f.area !== ends[1].f.area || (ends[0].f.mtu || 1500) !== (ends[1].f.mtu || 1500))) && !full(l), link + " aren't neighbours across their link", "Every pair is FULL.", "show ip ospf neighbor on " + sayOf(sim, l.a) + ".")];
}; };
const nbrCauses = nbrCausesFor(CORE5);
/* distribution switch 1 advertises every VLAN in use, hello only where there's a router; the provider's side out of OSPF */
function passiveCauses(sim, v) {
  const p = v.plan, R = sim.ospfAll(), D = R.routers.dist1, E = R.routers.edge;
  const inO = function (k) { return D && D.ifs.find(function (f) { return f.name === "Vlan" + p.vlans[k].id; }); };
  const noadv = USED.find(function (k) { return !inO(k); }), hello = USED.find(function (k) { const f = inO(k); return f && !f.passive; }), wan = E && E.ifs.find(function (f) { return f.name === p.edge.wan; });
  return [C("noadv", !!noadv, "VLAN " + (noadv ? p.vlans[noadv].id + " (" + p.vlans[noadv].name + ")" : "") + " isn't in OSPF on distribution switch 1: no network statement covers its interface, so nobody else learns it", "Every VLAN in use is in OSPF.", noadv ? "show ip ospf interface brief on distribution switch 1: Vlan" + p.vlans[noadv].id + " missing." : ""),
    C("hello", !!hello, "VLAN " + (hello ? p.vlans[hello].id : "") + "'s interface sends OSPF hellos to the desks: anything there that answers could become a neighbour and feed the campus routes", "The VLAN interfaces are passive.", hello ? "show ip protocols on distribution switch 1: Vlan" + p.vlans[hello].id + " isn't among the passive interfaces." : ""),
    C("wan", !!wan, "The edge router's provider side (" + gi(p.edge.wan) + ") is in OSPF: it says hello to the provider and hands the campus the provider's network", "The provider's side isn't in OSPF.", "show ip ospf interface brief on the edge router: " + gi(p.edge.wan) + ".")];
}
/* the edge router reaches every VLAN in use by OSPF, by both core switches */
function coreRouteCauses(sim, v) {
  const p = v.plan, L = CORE5(p), viaCore = L.filter(function (l) { return l.a === "edge"; }).map(function (l) { return l.ib; }), t = transit(p);
  const D = sim.ospfAll().routers.dist1, lr = sim.learned("edge"), R = sim.rtView("edge"), live = sim.rtLive("edge");
  const of = function (k) { return lr.find(function (r) { return r.net === p.vlans[k].net && r.mask === p.mask; }); };
  const noadv = USED.find(function (k) { return !(D && D.ifs.some(function (f) { return f.name === "Vlan" + p.vlans[k].id; })); });
  const none = USED.find(function (k) { return !of(k); }), direct = USED.find(function (k) { const r = RT.lookup(R, p.vlans[k].gw, live); return r && r.nh === t.dist; });
  const hops = function (k) { return ((of(k) || {}).paths || []).map(function (h) { return h.nh; }); }, one = USED.find(function (k) { const h = hops(k); return !viaCore.every(function (x) { return h.indexOf(x) >= 0; }); });
  const nm = function (k) { return k ? p.vlans[k].net : ""; };
  return [C("noadv", !!noadv, "Distribution switch 1 doesn't advertise " + nm(noadv) + ": the edge router can't learn it", "Every VLAN in use is advertised.", "show ip route ospf on the edge router: no " + nm(noadv) + "."),
    C("none", !noadv && !!none, "The edge router has no OSPF route to " + nm(none), "It learns every VLAN in use.", "show ip route ospf on the edge router: no " + nm(none) + "."),
    C("direct", !!direct, "The edge router still reaches " + nm(direct) + " over the old direct link to distribution switch 1, not through the core", "It goes through the core.", "show ip route on the edge router: " + nm(direct) + " via " + t.dist + "."),
    C("one", !noadv && !none && !direct && !!one, "The edge router learns " + nm(one) + " by only one core switch: if that one fails, the VLAN is cut off until something reconverges", "Both core switches carry every VLAN, at the same cost.", "show ip route on the edge router: " + nm(one) + " has one next hop.")];
}
/* distribution switch 1's way out: the default OSPF brings from the edge router */
function defaultCauses(sim, v) {
  const lr = sim.learned("dist1").find(function (r) { return r.net === "0.0.0.0" && r.mask === "0.0.0.0"; }), D = sim.d.dist1.sw.routing ? l3Route(sim.l3View("dist1"), "8.8.8.8", sim.learned("dist1")) : null;
  const O = sim.d.edge.sw.ospf;
  return [C("noorig", !lr && !(O && O.originate), "The edge router doesn't hand its default route to OSPF: distribution switch 1 never learns a way out", "The edge router originates the default.", "show ip route on distribution switch 1: no O*E2 route; show running-config on the edge router: router ospf has no default-information originate."),
    C("nolearn", !lr && !!(O && O.originate), "The edge router originates a default, but it doesn't reach distribution switch 1", "Distribution switch 1 learns it.", "show ip route on distribution switch 1: no O*E2 route."),
    C("hidden", !!lr && !!D && D.code !== "O", "Distribution switch 1 learns OSPF's default, but its own static default still wins (distance 1 against 110)", "OSPF's default is the one in use.", D ? "show ip route on distribution switch 1: Gateway of last resort is " + (D.nh || "") + ", S*." : "")];
}
function staticCauses(sim, v) {
  const p = v.plan, t = transit(p), ds = (sim.d.dist1.sw.routes || []).find(function (r) { return r.net === "0.0.0.0" && r.mask === "0.0.0.0"; }), es = (sim.d.edge.sw.routes || []).find(function (r) { return r.net !== "0.0.0.0" && /^10\./.test(r.net); });
  return [C("dstatic", !!ds, "Distribution switch 1 still has its static default route", "It has none.", "show running-config on distribution switch 1: ip route 0.0.0.0 0.0.0.0 " + (ds ? ds.nh || ds.iface : "") + "."),
    C("estatic", !!es, "The edge router still has a static route for the campus", "It has none.", es ? "show running-config on the edge router: ip route " + es.net + " " + es.mask + " " + (es.nh || es.iface) + "." : "")];
}
function directCauses(sim, v) {
  const p = v.plan, port = sim.d.dist1.sw.ports["GigabitEthernet0/24"], e = sim.d.edge.sw.ifs[p.edge.lan] || {}, c = sim.cable("c-edge-dist1"), up = !!c && sim.cableUp(c);
  return [C("up", up, "The old direct link between the edge router and distribution switch 1 is still up", "It's retired.", "show ip interface brief on the edge router: " + gi(p.edge.lan) + " up."),
    C("end", !up && (!port.shutdown || !e.shutdown), "The old link is down, but " + (!port.shutdown ? "distribution switch 1's end (Gi0/24)" : "the edge router's end (" + gi(p.edge.lan) + ")") + " is still open: a port not in use is shut", "Both ends are shut.", "show ip interface brief: one end still up/down.")];
}
function natCauses5(sim, v) {
  const p = v.plan, rt = sim.d.edge.sw, R = sim.rtView("edge"), live = sim.rtLive("edge");
  const out = RT.allIfs(R).find(function (n) { if (n === p.edge.wan || n.indexOf(".") > 0) return false; const a = RT.addrOf(R, n, live); return a && /^10\./.test(a.ip) && RT.rtStatus(R, n)[1] === "up" && (rt.ifs[n] || {}).nat !== "inside"; });
  const rule = (rt.nat || []).find(function (x) { return x.overload && rt.acls[x.list]; }), covers = rule && RT.aclVerdict(rt, rule.list, { proto: "ip", src: p.vlans.svc.gw, dst: "8.8.8.8" }).permit;
  return [C("inside", !!out, "The edge router's " + (out ? gi(out) : "") + " faces the campus but isn't NAT's inside: whatever comes in there goes out untranslated, and the provider drops it", "Every interface facing the campus is NAT's inside.", out ? "show running-config on the edge router: " + out + " has no ip nat inside." : ""),
    C("list", !out && !covers, "NAT's list doesn't cover the campus's addresses", "It covers them.", "show access-lists on the edge router.")];
}
function relayCauses5(sim, v) {
  const p = v.plan, t = transit(p), R = sim.rtView("edge"), live = sim.rtLive("edge");
  const mine = RT.allIfs(R).map(function (n) { const a = RT.addrOf(R, n, live); return a && RT.rtStatus(R, n)[1] === "up" ? a.ip : null; }).filter(Boolean);
  const bad = DHCPV.find(function (x) { return !sim.dhcpServers(x[1]).length; }), k = bad && bad[0], r = k ? svi(sim, k, p) : null, h = r && r.helpers || [];
  const at = k ? "ipconfig /release then /renew on the " + name(sim, bad[1]) + ": no DHCP server answers." : "";
  return [C("none", !!k && !h.length, "Nothing relays VLAN " + (k ? p.vlans[k].id : "") + "'s DHCP requests", "Each VLAN's requests are relayed.", at + " show running-config on distribution switch 1: interface Vlan" + (k ? p.vlans[k].id : "") + " has no ip helper-address."),
    C("gone", !!k && h.length > 0 && h.indexOf(t.edge) >= 0 && mine.indexOf(t.edge) < 0, "VLAN " + (k ? p.vlans[k].id : "") + "'s requests are still relayed to the edge router's address on the old link: with that link retired, nothing answers there", "They go to an address the edge router still answers at.", at + " show running-config on distribution switch 1: ip helper-address " + t.edge + "."),
    C("wrong", !!k && h.length > 0 && !h.some(function (x) { return mine.indexOf(x) >= 0; }) && h.indexOf(t.edge) < 0, "VLAN " + (k ? p.vlans[k].id : "") + "'s requests are relayed to an address where no DHCP server answers", "They go to the edge router.", at),
    C("noway", !!k && h.some(function (x) { return mine.indexOf(x) >= 0; }), "VLAN " + (k ? p.vlans[k].id : "") + "'s requests reach the edge router, but its answer can't get back to distribution switch 1", "The answers get back.", at + " show ip dhcp binding on the edge router: nothing new.")];
}
/* the core switches answer from the service desk: a way there, and a way back */
function manageCauses(sim, v) {
  const p = v.plan, L = CORE5(p), addr = { core1: L[0].ib, core2: L[1].ib };
  const r = {}; ["core1", "core2"].forEach(function (id) { r[id] = sim.route("sd1", addr[id]); });
  const bad = ["core1", "core2"].find(function (id) { return !r[id].routed && !r[id].local; }), x = bad ? r[bad] : null;
  return [C("there", !!x && x.why !== "no way back", (bad ? Cap(sayOf(sim, bad)) : "A core switch") + " can't be reached from the service desk: nothing on the way has a route to its link", "Both are reachable.", bad ? "ping " + addr[bad] + " from the service desk PC: " + (x.fail === "net-unreachable" ? "Destination net unreachable." : "Request timed out.") : ""),
    C("back", !!x && x.why === "no way back", (bad ? Cap(sayOf(sim, bad)) : "A core switch") + " gets the service desk's pings but has no route back to the service desk's network", "Both answer.", bad ? "ping " + addr[bad] + " from the service desk PC: Request timed out; show ip route on " + sayOf(sim, bad) + "." : "")];
}
function savedCauses5(sim) {
  return OSPF_DEVS.map(function (id) { return C("unsaved-" + id, unsaved(sim.d[id].sw), Cap(sayOf(sim, id)) + " hasn't been saved: a power cut takes the changes away", "Every device is saved.", "show startup-config on " + sayOf(sim, id) + ": it's not what's running."); });
}

const CJ5 = {
  id: "CP-J5", level: "campus", title: "OSPF across the core: the default from the edge router, the static routes retired",
  already: ["nat", "dhcp", "works", "saved"],
  start(seed) {
    const b = CJ4.start(seed), sim = b.sim;
    for (const a of CJ4.solve(b.v, sim)) { if (a.t === "cmd") exec(sim, a.dev, a.line); else sim.apply(a); }
    const before = sim.links(); installCore(sim.net, function (l) { return l.b !== "dist2"; }); sim.relink(before);   /* the installer's night: the core racked, cabled (distribution switch 2's links wait for it), addressed */
    sim.cli = {};
    return { sim: sim, v: Object.assign({}, b.v, { runs: sim.net.extra.runs || 0 }) };   /* the console cables CP-J4 laid: the walk-through's numbers follow on */
  },
  brief() { return { quote: "The core's in: the installer racked both core switches in the data room last night and cabled them. Right now everything between the campus and the internet still runs over one cable from the edge router to distribution switch 1, held up by two static routes. Put the core to work: OSPF across it, the default route from the edge router, and once it carries everything, retire the old cable and the statics. If a core switch dies, nobody should notice.", from: "Rafiki, owner" }; },
  mason: "Bring the new paths up beside the old ones and prove them before you take anything away: neighbours first, then what's in each table. The old link and the static routes go last.",
  limits: function (v) {
    const p = v.plan, L = CORE5(p), lab = function (id, port) { return id === "edge" ? "the edge router " + port : (id === "dist1" ? "distribution switch 1" : id === "core1" ? "core switch 1" : "core switch 2") + " port " + port; };
    return ["The core's links, from the records (each a /30; the end nearer the provider takes the first usable address, the other end the second): " + L.map(function (l) { return lab(l.a, l.ap) + " to " + lab(l.b, l.bp) + ", " + l.cidr; }).join("; ") + ". The installer has done the core switches' ends; the edge router's and distribution switch 1's are yours. The core switches' ports 2 are for distribution switch 2, cabled when it joins in the next work order.",
      "OSPF: area 0, on the edge router, both core switches and distribution switch 1: every link of the core, and every VLAN in use on distribution switch 1. It says hello only where there's another router: the VLAN interfaces are passive, and the provider's side stays out of it. The edge router originates the default route.",
      "Once OSPF carries everything: the two static routes from the last work order removed, the direct link between the edge router (" + p.edge.lan + ") and distribution switch 1 (port 24) retired, both ends shut, and DHCP still relayed to the edge router.",
      "The core switches: " + p.sw.core1.host + " and " + p.sw.core2.host + ", locked as every switch here is. Your laptop's console cable reaches anything in the data room. Console password: " + p.console + ". Enable secret: " + p.secret + "."];
  },
  reqs: [
    { id: "edge", text: "The edge router's two links to the core are up, on the records' addresses", causes: edgeEndCauses,
      ok: function () { return "Both of the edge router's links to the core are up with the records' addresses."; },
      rung1: function () { return "show ip interface brief on the edge router, then the records' list of links."; },
      rung2: function () { return "A block's first address is its network and its last its broadcast: the two usable ones between go one to each end."; } },
    { id: "dist", text: "Distribution switch 1's two links to the core are routed, up, on the records' addresses", causes: distEndCauses,
      ok: function () { return "Both of distribution switch 1's links to the core are routed ports with the records' addresses, up."; },
      rung1: function () { return "show ip interface brief on distribution switch 1, and those ports in its running configuration."; },
      rung2: function () { return "An address goes on a routed port, never on a switch port: the port has to stop being a switch port first."; } },
    { id: "ospf", text: "OSPF neighbours across every link of the core: the edge router and distribution switch 1 each with both core switches, the core switches with each other", causes: nbrCauses,
      ok: function () { return "Every link of the core has a FULL neighbour at each end."; },
      rung1: function () { return "show ip ospf neighbor on each router, then show ip ospf interface brief where one is missing."; },
      rung2: function () { return "Two routers become neighbours only if both say hello on the link and agree about it: the same area, the same subnet and mask, the same MTU. A network statement only decides which interfaces take part."; } },
    { id: "passive", text: "OSPF only where it belongs: every VLAN in use advertised by distribution switch 1 but passive there, the provider's side left out", causes: passiveCauses,
      ok: function () { return "Distribution switch 1 advertises every VLAN in use without saying hello to the desks; the provider's side isn't in OSPF."; },
      rung1: function () { return "show ip protocols and show ip ospf interface brief on distribution switch 1 and on the edge router."; },
      rung2: function () { return "A passive interface still has its network advertised; it just never looks for a neighbour. Anywhere there's no router to talk to, hellos are only an invitation to something that shouldn't be there."; } },
    { id: "routes", text: "The edge router reaches every VLAN in use by OSPF, through both core switches", causes: coreRouteCauses,
      ok: function () { return "The edge router learns every VLAN in use by OSPF, with a next hop through each core switch."; },
      rung1: function () { return "show ip route on the edge router: what's learned, and by which next hops."; },
      rung2: function () { return "OSPF keeps every path of the same lowest cost; a cheaper path anywhere, an old link included, hides the others."; } },
    { id: "default", text: "Distribution switch 1's way out is the default route OSPF brings from the edge router", causes: defaultCauses,
      ok: function () { return "Distribution switch 1's gateway of last resort is OSPF's external default, from the edge router."; },
      rung1: function () { return "show ip route on distribution switch 1: the gateway of last resort and its code."; },
      rung2: function () { return "A router hands its default to OSPF only when told to, and a route typed by hand is believed over one learned (distance 1 against 110)."; } },
    { id: "statics", text: "The static routes are retired: OSPF carries the campus's routes both ways", causes: staticCauses,
      ok: function () { return "Neither the edge router nor distribution switch 1 has a static route left for the campus."; },
      rung1: function () { return "The ip route lines in each one's running configuration."; },
      rung2: function () { return "A static route never notices a failure on its own: left in, it can carry traffic into a link that's gone."; } },
    { id: "direct", text: "The old direct link between the edge router and distribution switch 1 is retired, both ends shut", causes: directCauses,
      ok: function () { return "The old link is down, both ends shut."; },
      rung1: function () { return "show ip interface brief on both ends of the old link."; },
      rung2: function () { return "A port not in use is shut, so nothing comes up on it by accident."; } },
    { id: "nat", text: "The edge router still translates the campus's traffic to the internet", causes: natCauses5,
      ok: function () { return "Every edge router interface facing the campus is NAT's inside, and its list covers the campus."; },
      rung1: function () { return "show ip nat translations and show running-config on the edge router."; },
      rung2: function () { return "NAT translates only what comes in on an inside interface and goes out on an outside one: every way in from the campus is an inside interface."; } },
    { id: "dhcp", text: "A PC that asks for an address again still gets one, in every VLAN with a pool", causes: relayCauses5,
      ok: function () { return "Each VLAN's requests are relayed to an address the edge router answers at, and the answers get back."; },
      rung1: function () { return "ipconfig /release then /renew on a PC in each VLAN; the VLAN interfaces' lines on distribution switch 1."; },
      rung2: function () { return "A relay sends each request to one address. If that address goes away, so does the DHCP server, as far as the relay knows."; } },
    { id: "works", text: "Everyone still works: every PC online, both printers and every switch answering", causes: reachCauses,
      ok: function () { return "Every PC is online; both printers and every switch answer."; },
      rung1: function () { return "ping 8.8.8.8 from each PC; the printers and the switches from the service desk."; },
      rung2: function () { return "A packet needs a route at every router on the way there, and every router on the way back."; } },
    { id: "manage", text: "Both core switches answer from the service desk", causes: manageCauses,
      ok: function () { return "Both core switches answer from the service desk."; },
      rung1: function () { return "ping each core switch from the service desk PC; then show ip route on the core switch that doesn't answer."; },
      rung2: function () { return "A reply is a packet too: the far end needs its own route back to whoever asked."; } },
    { id: "saved", text: "The edge router, both core switches and distribution switch 1 are saved", causes: savedCauses5,
      ok: function () { return "All four are saved."; }, rung1: function () { return "show startup-config against show running-config on each."; }, rung2: function () { return "Only what's saved survives a power cut."; } }
  ],
  solve(v, sim) {
    const p = v.plan, t = transit(p), L = CORE5(p), b = t.net.split(".")[1], out = [], c = function (l) { out.push({ t: "cmd", dev: "tech", line: l, cli: true }); }, n = sim ? sim.net.extra.runs || 0 : v.runs || 0;
    const login = function () { [""].concat([p.console, "enable", p.secret, "configure terminal"]).forEach(c); };
    const save = function () { c("end"); c("copy running-config startup-config"); c(""); };
    let k = 0; const to = function (dev) { if (k) out.push({ t: "pull", cable: "c-console-" + (n + k) }); k++; out.push({ t: "lay", a: { dev: "tech", port: "USB-C" }, b: { dev: dev, port: "CONSOLE" } }); login(); };
    /* the new paths beside the old: the edge router's ends, NAT inside, OSPF with the default */
    to("edge");
    L.filter(function (l) { return l.a === "edge"; }).forEach(function (l) { c("interface " + ifName("edge", l.ap)); c("ip address " + l.ia + " " + l.mask); c("ip nat inside"); c("no shutdown"); c("exit"); });
    c("router ospf 1"); L.filter(function (l) { return l.a === "edge"; }).forEach(function (l) { c("network " + l.net + " 0.0.0.3 area 0"); }); c("default-information originate"); c("end");
    /* the core switches: the installer did everything but OSPF */
    ["core1", "core2"].forEach(function (id) { to(id); c("router ospf 1"); c("network 10." + b + ".255.0 0.0.0.255 area 0"); save(); });
    /* distribution switch 1: its ends routed, OSPF with every VLAN passive; then the old default, the relay's address, the old link */
    to("dist1");
    L.filter(function (l) { return l.b === "dist1"; }).forEach(function (l) { c("interface gi0/" + l.bp); c("no switchport"); c("ip address " + l.ib + " " + l.mask); c("no shutdown"); c("exit"); });
    c("router ospf 1"); c("network 10." + b + ".0.0 0.0.255.255 area 0"); c("passive-interface default"); L.filter(function (l) { return l.b === "dist1"; }).forEach(function (l) { c("no passive-interface gi0/" + l.bp); }); c("exit");
    c("no ip route 0.0.0.0 0.0.0.0 " + t.edge);
    DHCPV.forEach(function (x) { c("interface vlan " + p.vlans[x[0]].id); c("no ip helper-address " + t.edge); c("ip helper-address " + L[0].ia); c("exit"); });
    c("interface gi0/24"); c("shutdown"); save();
    /* the edge router: its static route and its end of the old link */
    to("edge"); c("no ip route " + t.block + " " + t.bmask + " " + t.dist); c("interface " + p.edge.lan); c("shutdown"); save();
    out.push({ t: "pull", cable: "c-console-" + (n + k) });
    return out;
  },
  answer(v) {
    const p = v.plan, t = transit(p), L = CORE5(p), b = t.net.split(".")[1];
    return ["Console into the edge router: " + L.filter(function (l) { return l.a === "edge"; }).map(function (l) { return "interface " + ifName("edge", l.ap) + ", ip address " + l.ia + " " + l.mask + ", ip nat inside, no shutdown"; }).join("; ") + "; router ospf 1, a network statement for each link (0.0.0.3), default-information originate.",
      "Each core switch: router ospf 1, network 10." + b + ".255.0 0.0.0.255 area 0; save.",
      "Distribution switch 1: ports " + L.filter(function (l) { return l.b === "dist1"; }).map(function (l) { return l.bp + " (no switchport, ip address " + l.ib + " " + l.mask + ")"; }).join(" and ") + "; router ospf 1, network 10." + b + ".0.0 0.0.255.255 area 0, passive-interface default, no passive-interface on the two links. Check the neighbours and the routes, then: no ip route 0.0.0.0 0.0.0.0 " + t.edge + "; each pooled VLAN's helper moved to " + L[0].ia + "; port 24 shut; save.",
      "The edge router: no ip route " + t.block + " " + t.bmask + " " + t.dist + "; " + p.edge.lan + " shut; save."];
  },
  summary() { return ["OSPF runs across the core: the edge router, both core switches and distribution switch 1 are neighbours on every link.", "The edge router hands its default route to OSPF; every VLAN in use comes back to it through both core switches, at the same cost, so either can fail.", "The static routes and the old direct link are retired: nothing is held up by hand any more."]; }
};

/* ------------------------------------------------------------ CP-J6, the virtual gateway: distribution switch 2 joins */
const CORE6 = function (p) { return coreLinks(p).filter(function (l) { return l.b === "dist2"; }); };
/* on every VLAN in use: distribution switch 1 the second address, distribution switch 2 the third, the gateway (the first) shared */
const ownAt = function (p, k, id) { return p.vlans[k].gw.replace(/\.1$/, id === "dist1" ? ".2" : ".3"); };
const sviOf = function (sim, id, p, k) { return (sim.d[id].sw.svis || {})[p.vlans[k].id] || null; };
const sviUpOn = function (sim, id, p, k) { return l3Ifs(sim.l3View(id)).some(function (f) { return f.name === "Vlan" + p.vlans[k].id && f.up; }); };
function join2Causes(sim, v) {
  const p = v.plan, w = sim.d.dist2.sw, ifs = l3Ifs(sim.l3View("dist2")), L = CORE6(p);
  const look = function (l) { const n = "GigabitEthernet0/" + l.bp, q = w.ports[n], f = ifs.find(function (x) { return x.name === n; }); return { n: n, p: q, f: f }; };
  const bad = L.find(function (l) { const k = look(l); return !k.p.routed || k.p.ip !== l.ib || k.p.mask !== l.mask || !k.f || !k.f.up; }) || L[0], k = look(bad), g = gi(k.n), to = sayOf(sim, bad.a);
  return [C("off", !w.routing, "Distribution switch 2 doesn't route: ip routing is off", "It routes.", "show ip route on distribution switch 2: Default gateway is ..., no routing table."),
    C("trunk", !k.p.routed, "Distribution switch 2's link to " + to + " (" + g + ") is still a switch port: it can't take an address", "Both its links to the core are routed ports.", "show running-config on distribution switch 2: interface " + k.n + " has no \"no switchport\"."),
    C("daddr", !!k.p.routed && (k.p.ip !== bad.ib || k.p.mask !== bad.mask), "Distribution switch 2's link to " + to + " (" + g + ") isn't on the records' address and mask (the end further from the provider takes the second usable address)", "Both have the records' addresses.", "show ip interface brief on distribution switch 2: " + g + " " + (k.p.ip || "unassigned") + "."),
    C("dshut", !!k.p.routed && !!k.p.shutdown, "Distribution switch 2's link to " + to + " (" + g + ") is shut down", "Both are up.", "show ip interface brief on distribution switch 2: " + g + " administratively down."),
    C("ddown", !!k.p.routed && !k.p.shutdown && !!k.f && !k.f.up, "Distribution switch 2's link to " + to + " (" + g + ") is down", "Both are up.", "show ip interface brief on distribution switch 2: " + g + " down.")];
}
function passive2Causes(sim, v) {
  const p = v.plan, D = sim.ospfAll().routers.dist2, inO = function (k) { return D && D.ifs.find(function (f) { return f.name === "Vlan" + p.vlans[k].id; }); };
  const noadv = USED.find(function (k) { return !inO(k); }), hello = USED.find(function (k) { const f = inO(k); return f && !f.passive; });
  return [C("noadv", !!noadv, "VLAN " + (noadv ? p.vlans[noadv].id + " (" + p.vlans[noadv].name + ")" : "") + " isn't in OSPF on distribution switch 2: if it's the one answering, the core can't send replies back through it", "Every VLAN in use is in OSPF on it.", noadv ? "show ip ospf interface brief on distribution switch 2: Vlan" + p.vlans[noadv].id + " missing." : ""),
    C("hello", !!hello, "VLAN " + (hello ? p.vlans[hello].id : "") + "'s interface on distribution switch 2 sends OSPF hellos to the desks", "Its VLAN interfaces are passive.", hello ? "show ip protocols on distribution switch 2: Vlan" + p.vlans[hello].id + " isn't among the passive interfaces." : "")];
}
function svi2Causes(sim, v) {
  const p = v.plan, k = USED.find(function (x) { const r = sviOf(sim, "dist2", p, x); return !r || r.ip !== ownAt(p, x, "dist2") || r.mask !== p.mask || r.shutdown || !sviUpOn(sim, "dist2", p, x); }), r = k ? sviOf(sim, "dist2", p, k) : null, V = k ? p.vlans[k] : null;
  const at = V ? "show ip interface brief on distribution switch 2: Vlan" + V.id : "";
  return [C("none", !!k && !r, "VLAN " + (V ? V.id + " (" + V.name + ")" : "") + " has no interface on distribution switch 2: it can't stand in for that gateway", "Every VLAN in use has its interface there.", at + " missing."),
    C("addr", !!r && r.ip !== ownAt(p, k, "dist2"), "VLAN " + (V ? V.id : "") + "'s interface on distribution switch 2 isn't on its own address (the records give it the third)", "Each is on its own address.", at + " " + (r && r.ip || "unassigned") + "."),
    C("mask", !!r && r.ip === ownAt(p, k, "dist2") && r.mask !== p.mask, "VLAN " + (V ? V.id : "") + "'s interface on distribution switch 2 has the wrong mask", "Each has its network's mask.", r ? "show running-config on distribution switch 2: interface Vlan" + V.id + ", ip address " + r.ip + " " + r.mask + "." : ""),
    C("shut", !!r && r.ip === ownAt(p, k, "dist2") && r.mask === p.mask && !!r.shutdown, "VLAN " + (V ? V.id : "") + "'s interface on distribution switch 2 is shut down", "Each is up.", at + " administratively down."),
    C("down", !!r && !r.shutdown && r.ip === ownAt(p, k, "dist2") && r.mask === p.mask && !sviUpOn(sim, "dist2", p, k), "VLAN " + (V ? V.id : "") + "'s interface on distribution switch 2 is down", "Each is up.", at + " up/down.")];
}
function own1Causes(sim, v) {
  const p = v.plan, k = USED.find(function (x) { const r = sviOf(sim, "dist1", p, x); return !r || r.ip !== ownAt(p, x, "dist1") || r.mask !== p.mask; }), r = k ? sviOf(sim, "dist1", p, k) : null, V = k ? p.vlans[k] : null;
  return [C("still", !!r && r.ip === V.gw, "VLAN " + (V ? V.id : "") + "'s gateway address is still distribution switch 1's own interface address: there's nothing for the two switches to share", "Each of its VLAN interfaces is on its own address; the gateway belongs to the group.", "show ip interface brief on distribution switch 1: Vlan" + (V ? V.id : "") + " " + (r ? r.ip : "") + "."),
    C("addr", !!k && !(r && r.ip === V.gw), "VLAN " + (V ? V.id : "") + "'s interface on distribution switch 1 isn't on its own address (the records give it the second)", "Each is on its own address.", "show ip interface brief on distribution switch 1: Vlan" + (V ? V.id : "") + " " + (r && r.ip || "unassigned") + ".")];
}
/* each VLAN in use: one standby group the two share, its virtual address the gateway */
const sbOf = function (sim, id, p, k) { const r = sviOf(sim, id, p, k); return (r && r.standby) || {}; };
function groupCauses(sim, v) {
  const p = v.plan, rows = USED.map(function (k) { const a = sbOf(sim, "dist1", p, k), b = sbOf(sim, "dist2", p, k), both = Object.keys(a).filter(function (g) { return b[g]; }); return { k: k, a: a, b: b, both: both, V: p.vlans[k] }; });
  const none1 = rows.find(function (r) { return !Object.keys(r.a).length; }), none2 = rows.find(function (r) { return !Object.keys(r.b).length; });
  const split = rows.find(function (r) { return Object.keys(r.a).length && Object.keys(r.b).length && !r.both.length; });
  const vip = rows.find(function (r) { return r.both.length && r.both.some(function (g) { return r.a[g].ip !== r.V.gw || r.b[g].ip !== r.V.gw; }); });
  const grp = rows.find(function (r) { return r.both.length && r.both.indexOf(String(r.V.id)) < 0; });
  const nm = function (r) { return r ? "VLAN " + r.V.id : ""; };
  return [C("none1", !!none1, nm(none1) + " has no standby group on distribution switch 1", "Both switches have a group on every VLAN in use.", none1 ? "show standby brief on distribution switch 1: Vl" + none1.V.id + " missing." : ""),
    C("none2", !none1 && !!none2, nm(none2) + " has no standby group on distribution switch 2: if switch 1 goes, nothing answers for the gateway", "Both switches have a group on every VLAN in use.", none2 ? "show standby brief on distribution switch 2: Vl" + none2.V.id + " missing." : ""),
    C("split", !!split, nm(split) + "'s groups have different numbers on the two switches: two groups, each with one member, both active, both answering for the address", "The two switches share one group per VLAN.", split ? "show standby brief on each: Vl" + split.V.id + ", two different groups, both Active." : ""),
    C("vip", !split && !!vip, nm(vip) + "'s virtual address isn't the gateway its devices use, on " + (vip && vip.both.some(function (g) { return vip.a[g].ip !== vip.V.gw; }) ? "distribution switch 1" : "distribution switch 2"), "Each group's virtual address is its VLAN's gateway, on both switches.", vip ? "show standby brief: Vl" + vip.V.id + "'s virtual IP." : ""),
    C("grp", !split && !vip && !!grp, nm(grp) + "'s group number isn't its VLAN's number, as the records keep them", "Each group is numbered for its VLAN.", grp ? "show standby brief: Vl" + grp.V.id + ", group " + grp.both[0] + "." : "")];
}
/* the group's state as it runs: per VLAN in use, who's active */
const groupState = function (s2, p, k) { const S = s2.hsrpState(), key = Object.keys(S).find(function (x) { return S[x].members.some(function (m) { return m.id === "dist1" && m.iface === "Vlan" + p.vlans[k].id; }) || S[x].members.some(function (m) { return m.id === "dist2" && m.iface === "Vlan" + p.vlans[k].id; }); }); return key ? S[key] : null; };
/* a copy of the network to try a failure on: a check never changes the real one */
const copyOf = function (sim) { return new Sim(JSON.parse(JSON.stringify(sim.net))); };
const power = function (s2, id, on) { const b4 = s2.links(); s2.net.devices[id].on = on; s2.relink(b4); };
function activeCauses(sim, v) {
  const p = v.plan, st = USED.map(function (k) { return { k: k, q: groupState(sim, p, k) }; });
  const two = st.find(function (r) { return r.q && r.q.active && r.q.active.id === "dist2"; }), none = st.find(function (r) { return !r.q || !r.q.active; });
  let back = null;
  if (!two && !none) { const s2 = copyOf(sim); power(s2, "dist1", false); power(s2, "dist1", true); back = USED.find(function (k) { const q = groupState(s2, p, k); return !q || !q.active || q.active.id !== "dist1"; }) || null; }
  const nm = function (k) { return k ? "VLAN " + p.vlans[k].id : ""; };
  return [C("none", !!none, (none ? nm(none.k) : "A VLAN") + "'s group has nobody active", "Every group has an active switch.", none ? "show standby brief: Vl" + p.vlans[none.k].id + "." : ""),
    C("dist2", !none && !!two, "Distribution switch 2 is active for " + (two ? nm(two.k) : "a VLAN") + ": the gateway sits on the switch spanning tree doesn't send that VLAN to, so its traffic crosses between them", "Distribution switch 1 is active for every group.", two ? "show standby brief on distribution switch 1: Vl" + p.vlans[two.k].id + " Standby, active " + (two.q.active.ip || "") + "." : ""),
    C("nopre", !!back, "Distribution switch 1 is active now, but after a restart it stays standby for " + nm(back) + ": it never takes back over", "It takes back over (preempt).", back ? "show standby brief on distribution switch 1: Vl" + p.vlans[back].id + ", no P beside its priority." : "")];
}
/* distribution switch 1 fails (on a copy): distribution switch 2 takes every gateway, every PC stays online and still gets an address */
function failCauses(sim, v) {
  const p = v.plan, s2 = copyOf(sim); power(s2, "dist1", false);
  const gone = USED.find(function (k) { const q = groupState(s2, p, k); return !q || !q.active; }), wrong = USED.find(function (k) { const q = groupState(s2, p, k); return q && q.active && q.vip !== p.vlans[k].gw; });
  const off = CAMPUS_PCS.find(function (id) { return !s2.route(id, "8.8.8.8").internet; });
  const lease = DHCPV.find(function (x) { s2.release(x[1]); return s2.dhcp(x[1], "renew").result !== "lease"; });
  const nm = function (k) { return k ? "VLAN " + p.vlans[k].id : ""; };
  return [C("gone", !!gone, "With distribution switch 1 off, nothing answers for " + nm(gone) + "'s gateway", "Distribution switch 2 takes over every gateway.", gone ? "Power distribution switch 1 off, then show standby brief on distribution switch 2: Vl" + p.vlans[gone].id + " missing or not Active." : ""),
    C("vip", !gone && !!wrong, "With distribution switch 1 off, distribution switch 2 takes over " + nm(wrong) + " but answers at a different address from the gateway its devices use", "It answers at each VLAN's gateway.", wrong ? "show standby brief on distribution switch 2: Vl" + p.vlans[wrong].id + "'s virtual IP." : ""),
    C("out", !gone && !wrong && !!off, "With distribution switch 1 off, the " + (off ? name(sim, off) : "") + " reaches its gateway but not the internet: distribution switch 2 has no way out, or nothing knows the way back through it", "Every PC stays online.", off ? "Power distribution switch 1 off, then tracert -d 8.8.8.8 from the " + name(sim, off) + "." : ""),
    C("relay", !gone && !wrong && !off && !!lease, "With distribution switch 1 off, a PC in VLAN " + (lease ? p.vlans[lease[0]].id : "") + " that asks for an address gets none: distribution switch 2 doesn't relay", "Distribution switch 2 relays as switch 1 does.", lease ? "show running-config on distribution switch 2: interface Vlan" + p.vlans[lease[0]].id + " has no ip helper-address." : "")];
}
function saved6Causes(sim) { return ["dist1", "dist2"].map(function (id) { return C("unsaved-" + id, unsaved(sim.d[id].sw), Cap(said(sim, id)) + " hasn't been saved: a power cut takes the changes away", "Both are saved.", "show startup-config on " + said(sim, id) + ": it's not what's running."); }); }

const CJ6 = {
  id: "CP-J6", level: "campus", title: "The virtual gateway: distribution switch 2 joins, every gateway shared by standby",
  already: ["works", "saved"],
  start(seed) {
    const b = CJ5.start(seed), sim = b.sim;
    for (const a of CJ5.solve(b.v, sim)) { if (a.t === "cmd") exec(sim, a.dev, a.line); else sim.apply(a); }
    const before = sim.links(); coreCables(sim.net, function (l) { return l.b === "dist2"; }); sim.relink(before);   /* this morning: distribution switch 2's links to the core cabled */
    sim.cli = {};
    return { sim: sim, v: Object.assign({}, b.v, { runs: sim.net.extra.runs || 0 }) };
  },
  brief() { return { quote: "Distribution switch 1 is every network's gateway now, and that's the trouble: if it dies, every floor goes with it. Distribution switch 2 is sitting right next to it doing nothing clever. Its links to the core were cabled this morning: bring it into the routing, give it a leg on every network, and have the two share each gateway so a PC never notices which one answers. Switch 1 carries the load day to day.", from: "Rafiki, owner" }; },
  mason: "Move each gateway address into its group on distribution switch 1 first, so it's active before distribution switch 2 joins. Then prove the whole point of the job: what happens when distribution switch 1 goes away?",
  limits: function (v) {
    const p = v.plan, L = CORE6(p), lab = function (id, port) { return (id === "core1" ? "core switch 1" : id === "core2" ? "core switch 2" : "distribution switch 2") + " port " + port; };
    return ["Distribution switch 2's links to the core, from the records: " + L.map(function (l) { return lab(l.a, l.ap) + " to " + lab(l.b, l.bp) + ", " + l.cidr; }).join("; ") + " (the core's end the first usable address, distribution switch 2's the second). Cabled this morning.",
      "On every VLAN in use, distribution switch 1's interface takes the network's second address and distribution switch 2's the third; the gateway the devices already use, the first, becomes the standby group's virtual address. Each VLAN's group is numbered for its VLAN. On the management VLAN that makes the switches' own addresses " + p.sw.dist1.ip + " and " + p.sw.dist2.ip + ".",
      "Distribution switch 1 is active: priority 110, and preempt, so it takes back over after a restart. Distribution switch 2 is standby at the default priority.",
      "Distribution switch 2 joins OSPF as distribution switch 1 did: area 0, every VLAN in use advertised, its VLAN interfaces passive. It relays the " + DHCPV.map(function (x) { return p.vlans[x[0]].name; }).join(", ") + " VLANs' DHCP requests to the same edge router address as switch 1.",
      "Your laptop's console cable reaches anything in the data room. Console password: " + p.console + ". Enable secret: " + p.secret + "."];
  },
  reqs: [
    { id: "join", text: "Distribution switch 2 routes, its two links to the core routed and up on the records' addresses", causes: join2Causes,
      ok: function () { return "Distribution switch 2 routes; both its links to the core are routed ports with the records' addresses, up."; },
      rung1: function () { return "show ip route and show ip interface brief on distribution switch 2."; },
      rung2: function () { return "A layer 3 switch only routes once it's told to, and an address goes on a routed port, never on a switch port."; } },
    { id: "ospf", text: "Distribution switch 2 is an OSPF neighbour of both core switches", causes: nbrCausesFor(CORE6),
      ok: function () { return "Both of distribution switch 2's links to the core have a FULL neighbour at each end."; },
      rung1: function () { return "show ip ospf neighbor on distribution switch 2 and on each core switch."; },
      rung2: function () { return "Two routers become neighbours only if both say hello on the link and agree about it: the same area, subnet and mask, the same MTU."; } },
    { id: "passive", text: "Distribution switch 2 advertises every VLAN in use, passive on each", causes: passive2Causes,
      ok: function () { return "Distribution switch 2 advertises every VLAN in use without saying hello to the desks."; },
      rung1: function () { return "show ip protocols and show ip ospf interface brief on distribution switch 2."; },
      rung2: function () { return "Whichever switch answers for a gateway, the replies come back to the networks it advertises."; } },
    { id: "svis2", text: "Distribution switch 2 has its own interface on every VLAN in use, up", causes: svi2Causes,
      ok: function () { return "Distribution switch 2 has an interface on every VLAN in use, on its own address, up."; },
      rung1: function () { return "show ip interface brief on distribution switch 2."; },
      rung2: function () { return "A switch can only stand in for a gateway on a network it has an interface in."; } },
    { id: "own1", text: "Distribution switch 1's VLAN interfaces are on their own addresses: each gateway address belongs to its group", causes: own1Causes,
      ok: function () { return "Distribution switch 1's VLAN interfaces are on their own addresses."; },
      rung1: function () { return "show ip interface brief on distribution switch 1, against the records."; },
      rung2: function () { return "A virtual address is nobody's own: each switch keeps an address of its own on the network, and the group answers at the shared one."; } },
    { id: "groups", text: "Every VLAN in use has one standby group across both switches, its virtual address the gateway the devices use", causes: groupCauses,
      ok: function () { return "Each VLAN in use has one group, numbered for it, on both switches, its virtual address the VLAN's gateway."; },
      rung1: function () { return "show standby brief on both distribution switches, side by side."; },
      rung2: function () { return "Two switches share a gateway only in the same group: the number has to match, and so does the address they answer at."; } },
    { id: "active", text: "Distribution switch 1 is active for every group, and takes back over after a restart", causes: activeCauses,
      ok: function () { return "Distribution switch 1 is active for every group, with preempt, distribution switch 2 standby."; },
      rung1: function () { return "show standby brief on distribution switch 1: the state, the priority, and the P beside it."; },
      rung2: function () { return "The higher priority wins an election, then a tie goes to the higher address; but a switch that comes back only takes over again if preempt lets it."; } },
    { id: "fail", text: "If distribution switch 1 fails, every PC stays online through distribution switch 2, and still gets an address", causes: failCauses,
      ok: function () { return "With distribution switch 1 off, distribution switch 2 answers every gateway, every PC stays online, and DHCP is still relayed."; },
      rung1: function () { return "Picture distribution switch 1 switched off: show standby brief, show ip route and the VLAN interfaces' lines on distribution switch 2."; },
      rung2: function () { return "The standby switch has to be able to do everything the active one does: answer at the address, route the traffic out and back, and relay the requests."; } },
    { id: "works", text: "Everyone still works: every PC online, both printers and every switch answering", causes: reachCauses,
      ok: function () { return "Every PC is online; both printers and every switch answer."; },
      rung1: function () { return "ping 8.8.8.8 from each PC; the printers and the switches from the service desk."; },
      rung2: function () { return "The devices keep the gateway they have: whatever answers at that address is their router."; } },
    { id: "saved", text: "Both distribution switches are saved", causes: saved6Causes,
      ok: function () { return "Both are saved."; }, rung1: function () { return "show startup-config against show running-config on each."; }, rung2: function () { return "Only what's saved survives a power cut."; } }
  ],
  solve(v, sim) {
    const p = v.plan, L = CORE6(p), relay = coreLinks(p)[0].ia, b = p.vlans.svc.net.split(".")[1], out = [], c = function (l) { out.push({ t: "cmd", dev: "tech", line: l, cli: true }); }, n = sim ? sim.net.extra.runs || 0 : v.runs || 0;
    const login = function () { [""].concat([p.console, "enable", p.secret, "configure terminal"]).forEach(c); };
    const save = function () { c("end"); c("copy running-config startup-config"); c(""); };
    /* distribution switch 1 first: each gateway into its group, switch 1 active before switch 2 joins */
    out.push({ t: "lay", a: { dev: "tech", port: "USB-C" }, b: { dev: "dist1", port: "CONSOLE" } }); login();
    USED.forEach(function (k) { const V = p.vlans[k]; c("interface vlan " + V.id); c("ip address " + ownAt(p, k, "dist1") + " " + p.mask); c("standby " + V.id + " ip " + V.gw); c("standby " + V.id + " priority 110"); c("standby " + V.id + " preempt"); c("exit"); });
    save();
    /* distribution switch 2: routing, its links to the core, OSPF, a leg on every VLAN in the groups, the relay */
    out.push({ t: "pull", cable: "c-console-" + (n + 1) }, { t: "lay", a: { dev: "tech", port: "USB-C" }, b: { dev: "dist2", port: "CONSOLE" } }); login();
    c("ip routing");
    L.forEach(function (l) { c("interface gi0/" + l.bp); c("no switchport"); c("ip address " + l.ib + " " + l.mask); c("no shutdown"); c("exit"); });
    c("router ospf 1"); c("network 10." + b + ".0.0 0.0.255.255 area 0"); c("passive-interface default"); L.forEach(function (l) { c("no passive-interface gi0/" + l.bp); }); c("exit");
    USED.forEach(function (k) { const V = p.vlans[k]; c("interface vlan " + V.id); if (k !== "mgmt") c("ip address " + ownAt(p, k, "dist2") + " " + p.mask); if (DHCPV.some(function (x) { return x[0] === k; })) c("ip helper-address " + relay); c("standby " + V.id + " ip " + V.gw); c("no shutdown"); c("exit"); });
    save();
    out.push({ t: "pull", cable: "c-console-" + (n + 2) });
    return out;
  },
  answer(v) {
    const p = v.plan, L = CORE6(p), b = p.vlans.svc.net.split(".")[1];
    return ["Console into distribution switch 1: on each VLAN interface in use, ip address <the second address>, standby <the VLAN's number> ip <the gateway>, standby <number> priority 110, standby <number> preempt; save.",
      "Console into distribution switch 2: ip routing; ports " + L.map(function (l) { return l.bp + " (no switchport, ip address " + l.ib + " " + l.mask + ")"; }).join(" and ") + "; router ospf 1, network 10." + b + ".0.0 0.0.255.255 area 0, passive-interface default, no passive-interface on the two links; on each VLAN in use an interface at the third address (the management VLAN's keeps " + p.sw.dist2.ip + "), standby <number> ip <the gateway>, the pooled VLANs with ip helper-address " + coreLinks(p)[0].ia + "; save.",
      "Then show standby brief on both: switch 1 Active, switch 2 Standby, every group."];
  },
  summary() { return ["Distribution switch 2 is in OSPF beside switch 1, with an interface on every VLAN in use.", "Each VLAN's gateway is a standby group's virtual address: distribution switch 1 answers day to day, the same switch spanning tree sends everything to; distribution switch 2 stands by.", "If switch 1 fails, switch 2 takes every gateway, routes the traffic and relays DHCP; when switch 1 comes back, it takes over again."]; }
};

/* ------------------------------------------------------------ CP-J7, a new floor end to end */
/* the 4F access switch's uplinks, as the records give them: its port 23 to distribution switch 1's port 4, its 24 to switch 2's */
const UP4 = [["dist1", "23", "4"], ["dist2", "24", "4"]];
const cableBetween = function (sim, a, b) { return sim.net.cables.find(function (c) { return c.kind === "cat6" && ((c.a.dev === a && c.b.dev === b) || (c.a.dev === b && c.b.dev === a)); }) || null; };
const endAt = function (c, dev) { return c.a.dev === dev ? c.a.port : c.b.port; };
function rackCauses(sim, v) {
  const x = sim.d.acc4, rows = UP4.map(function (u) { const c = cableBetween(sim, "acc4", u[0]); return { u: u, c: c, right: !!c && endAt(c, "acc4") === u[1] && endAt(c, u[0]) === u[2], up: !!c && sim.cableUp(c) }; });
  const none = rows.find(function (r) { return !r.c; }), wrong = rows.find(function (r) { return r.c && !r.right; }), down = rows.find(function (r) { return r.right && !r.up; });
  const say = function (r) { return r ? said(sim, r.u[0]) : "a distribution switch"; };
  return [C("boxed", !!x.boxed, "The 4F access switch is still in its box", "It's racked in the 4F closet.", "The work order's van list: the 4F access switch, in its box."),
    C("none", !x.boxed && !!none, "The 4F access switch has no uplink to " + say(none), "It's uplinked to both distribution switches.", "The Cable runs table: nothing between the 4F access switch and " + say(none) + "."),
    C("ports", !x.boxed && !none && !!wrong, "The uplink to " + say(wrong) + " isn't on the ports the records give it (the 4F switch's port " + (wrong ? wrong.u[1] : "") + " to the distribution switch's port " + (wrong ? wrong.u[2] : "") + ")", "Both uplinks are on the records' ports.", "The Cable runs table: the uplink's two ends."),
    C("down", !x.boxed && !none && !wrong && !!down, "The uplink to " + say(down) + " has no link: a port at one end is shut", "Both uplinks have a link.", "The Cable runs table: No link; show interfaces status on " + say(down) + ": port " + (down ? down.u[2] : "") + " disabled.")];
}
/* set up as every switch here: name, secret, console password, SSH only with the local user, its management address and gateway */
function base4Causes(sim, v) {
  const p = v.plan, w = sim.d.acc4.sw, m = (w.svis || {})[p.vlans.mgmt.id], u = (w.users || {})[p.user];
  return [C("name", w.hostname !== p.sw.acc4.host, "The 4F access switch isn't named as the records say", "Its name is the records'.", "The prompt says " + w.hostname + "."),
    C("secret", !w.enableSecret || !pwOk(w.enableSecret, p.secret), "Its enable secret isn't the campus's", "Its enable secret is the campus's.", "show running-config: " + (w.enableSecret ? "an enable secret, not the campus's" : "no enable secret") + "."),
    C("console", !w.con.password || !pwOk(w.con.password, p.console) || w.con.login !== "password", "Its console doesn't ask for the campus's console password", "The console asks for it.", "show running-config: line con 0."),
    C("ssh", !w.domain || !(w.rsa >= 768) || !u || !pwOk(u, p.userPw) || w.vty.login !== "local" || w.vty.transport !== "ssh", "Its remote logins aren't SSH only with the campus's local user (a domain, keys, the user, login local, transport input ssh)", "SSH only, with the campus's user.", "show running-config: line vty 0 15, the username, ip domain-name."),
    C("mgmt", !m || m.ip !== p.sw.acc4.ip || m.mask !== p.mask || !!m.shutdown, "It has no management address on the management VLAN, as the records give it", "Its management address is the records'.", "show ip interface brief: Vlan" + p.vlans.mgmt.id + " " + (m && m.ip || "missing") + "."),
    C("gw", w.gateway !== p.vlans.mgmt.gw, "Its default gateway isn't the management VLAN's gateway: it can't answer anything off its own network", "Its default gateway is the management VLAN's.", "show running-config: ip default-gateway " + (w.gateway || "missing") + ".")];
}
/* the training VLAN, created and named on the three switches that carry it */
const TRAIN_ON = ["acc4", "dist1", "dist2"];
function vlan4Causes(sim, v) {
  const T = v.plan.train, miss = TRAIN_ON.find(function (id) { return !(sim.d[id].sw.vlans || {})[T.id]; }), misname = TRAIN_ON.find(function (id) { const q = (sim.d[id].sw.vlans || {})[T.id]; return q && String(q.name).toUpperCase() !== T.name; });
  const who = function (id) { return id ? (id === "acc4" ? "the 4F access switch" : said(sim, id)) : ""; };
  return [C("none", !!miss, "The training VLAN doesn't exist on " + who(miss), "It exists on all three.", "show vlan brief on " + who(miss) + ": no VLAN " + T.id + "."),
    C("name", !miss && !!misname, "The training VLAN on " + who(misname) + " isn't named as the records say", "Named as the records say on all three.", "show vlan brief on " + who(misname) + ".")];
}
/* the 4F's uplinks: trunks as the campus's are, carrying the training and management VLANs all the way, the bundle between the distribution switches too */
function trunk4Causes(sim, v) {
  const p = v.plan, T = p.train.id, M = p.vlans.mgmt.id, N = p.vlans.native.id, ends = [];
  UP4.forEach(function (u) { ends.push({ id: "acc4", n: "GigabitEthernet0/" + u[1], far: { id: u[0], n: "GigabitEthernet0/" + u[2] } }, { id: u[0], n: "GigabitEthernet0/" + u[2], far: { id: "acc4", n: "GigabitEthernet0/" + u[1] } }); });
  const P = function (e) { return sim.d[e.id].sw.ports[e.n]; }, cr = function (e) { const f = P(e.far); return carries(Object.assign({}, sim.d[e.id].sw, { links: sim.switchLinks(e.id) }), e.n, { mode: f.mode, nonegotiate: f.nonegotiate }); };
  const who = function (e) { return e ? (e.id === "acc4" ? "the 4F access switch's port " : said(sim, e.id) + "'s port ") + e.n.split("/")[1] : ""; };
  const notTrunk = ends.find(function (e) { return P(e).mode !== "trunk"; }), neg = ends.find(function (e) { return P(e).mode === "trunk" && !P(e).nonegotiate; });
  const nat = ends.find(function (e) { return P(e).native !== N; });
  const noT = ends.find(function (e) { return cr(e).tagged.indexOf(T) < 0; }), noM = ends.find(function (e) { return cr(e).tagged.indexOf(M) < 0; });
  const po = ["dist1", "dist2"].find(function (id) { const w = sim.d[id].sw, g = w.pcs && Object.keys(w.pcs)[0]; const q = g ? w.pcs[g] : w.ports["GigabitEthernet0/21"]; return !q || (q.allowed !== "all" && String(q.allowed).split(",").map(Number).indexOf(T) < 0 && !String(q.allowed).split(",").some(function (r) { const m = /^(\d+)-(\d+)$/.exec(r); return m && T >= +m[1] && T <= +m[2]; })); });
  return [C("mode", !!notTrunk, who(notTrunk) + " isn't a trunk", "Every uplink end is a trunk.", "show interfaces trunk on " + (notTrunk && notTrunk.id === "acc4" ? "the 4F access switch" : notTrunk ? said(sim, notTrunk.id) : "") + ": port " + (notTrunk ? notTrunk.n.split("/")[1] : "") + " missing."),
    C("dtp", !notTrunk && !!neg, who(neg) + " is a trunk but still negotiates (DTP): the campus's trunks don't", "No uplink end negotiates.", "show interfaces " + (neg ? neg.n.replace("GigabitEthernet", "gi") : "") + " switchport: Negotiation of Trunking: On."),
    C("native", !notTrunk && !!nat, who(nat) + "'s native VLAN isn't the campus's unused one", "Every uplink end's native VLAN is the campus's unused one.", "show interfaces trunk: native " + (nat ? P(nat).native : "") + "."),
    C("train", !notTrunk && !nat && !!noT, who(noT) + " doesn't carry the training VLAN", "Both uplinks carry it at both ends.", "show interfaces trunk: VLAN " + T + " not allowed on port " + (noT ? noT.n.split("/")[1] : "") + "."),
    C("mgmt", !notTrunk && !nat && !noT && !!noM, who(noM) + " doesn't carry the management VLAN: the 4F switch can't be managed over it", "Both uplinks carry the management VLAN.", "show interfaces trunk: VLAN " + M + " not allowed."),
    C("bundle", !!po, "The bundle between the distribution switches doesn't carry the training VLAN on " + (po ? said(sim, po) : "") + ": the two switches can't share its gateway across it", "The bundle carries it.", "show interfaces trunk on " + (po ? said(sim, po) : "") + ": Po1, VLAN " + T + " not allowed.")];
}
/* the training VLAN's spanning-tree root: distribution switch 1, distribution switch 2 the backup (CP-J2's convention) */
function stp4Causes(sim, v) {
  const T = v.plan.train.id, all = sim.stpAll(), R = all[T], root = R && R.result && R.result.root, sws = R ? R.sws : {};
  const ids = Object.keys(sws), rootId = ids.find(function (id) { return sws[id].mac === (root && root.mac) && sws[id].prio === root.prio; }) || (ids.length ? ids.slice().sort(function (a, b) { return cmpBid(sws[a], sws[b]); })[0] : null);
  const second = ids.filter(function (id) { return id !== rootId; }).sort(function (a, b) { return cmpBid(sws[a], sws[b]); })[0];
  return [C("acc4", rootId === "acc4", "The 4F access switch is the training VLAN's spanning-tree root: left at the defaults, it has the lowest address", "Distribution switch 1 is its root.", "show spanning-tree vlan " + T + " on the 4F access switch: This bridge is the root."),
    C("dist2", rootId === "dist2", "Distribution switch 2 is the training VLAN's root: its gateway is on switch 1, so the floor's traffic crosses the bundle", "Distribution switch 1 is its root.", "show spanning-tree vlan " + T + " on distribution switch 2: This bridge is the root."),
    C("nopath", !rootId, "The training VLAN has no spanning tree: no switch carries it", "Distribution switch 1 is its root.", "show spanning-tree vlan " + T + ": not found."),
    C("backup", rootId === "dist1" && second !== "dist2", "Distribution switch 1 is the root, but distribution switch 2 isn't the backup: if switch 1 goes, the 4F switch takes over", "Distribution switch 2 is the backup.", "show spanning-tree vlan " + T + " on distribution switch 2: its priority.")];
}
/* the training VLAN's gateway: both distribution switches, one standby group, switch 1 active with preempt */
function gw4Causes(sim, v) {
  const p = v.plan, T = p.train, own = function (id) { return T.gw.replace(/\.1$/, id === "dist1" ? ".2" : ".3"); }, si = function (id) { return (sim.d[id].sw.svis || {})[T.id] || null; };
  const up = function (id) { return l3Ifs(sim.l3View(id)).some(function (f) { return f.name === "Vlan" + T.id && f.up; }); };
  const noSvi = ["dist1", "dist2"].find(function (id) { const r = si(id); return !r || r.ip !== own(id) || r.mask !== p.mask; }), down = ["dist1", "dist2"].find(function (id) { return si(id) && !up(id); });
  const sb = function (id) { const r = si(id); return (r && r.standby) || {}; }, g1 = sb("dist1"), g2 = sb("dist2"), both = Object.keys(g1).filter(function (g) { return g2[g]; });
  const grp = !both.length, vip = both.length && both.some(function (g) { return g1[g].ip !== T.gw || g2[g].ip !== T.gw; });
  const q = groupState(sim, Object.assign({}, p, { vlans: Object.assign({}, p.vlans, { train: T }) }), "train"), act = q && q.active ? q.active.id : null;
  const pre = both.length && both.every(function (g) { return g1[g].preempt && (g1[g].pri || 100) > (g2[g].pri || 100); });
  const who = function (id) { return id ? said(sim, id) : ""; };
  return [C("svi", !!noSvi, "The training VLAN has no interface on " + who(noSvi) + " on its own address (switch 1 the second, switch 2 the third)", "Both have their own interface on it.", "show ip interface brief on " + who(noSvi) + ": Vlan" + T.id + "."),
    C("down", !noSvi && !!down, "The training VLAN's interface on " + who(down) + " is down", "Both are up.", "show ip interface brief on " + who(down) + ": Vlan" + T.id + " down."),
    C("group", !noSvi && !down && grp, "The two switches don't share a standby group on the training VLAN", "One group, on both.", "show standby brief on each: Vl" + T.id + "."),
    C("vip", !noSvi && !down && !grp && !!vip, "The training VLAN's standby group doesn't answer at the gateway its PCs will use (the first address)", "Its virtual address is the gateway.", "show standby brief: Vl" + T.id + "'s virtual IP."),
    C("active", !noSvi && !down && !grp && !vip && (act !== "dist1" || !pre), "Distribution switch 1 isn't the training gateway's active switch with preempt, as on every other VLAN", "Switch 1 active, priority 110, preempt.", "show standby brief on distribution switch 1: Vl" + T.id + ".")];
}
/* the edge router's pool for the training network */
function pool4Causes(sim, v) {
  const p = v.plan, T = p.train, rt = sim.d.edge.sw, pool = Object.keys(rt.pools || {}).map(function (k) { return rt.pools[k]; }).find(function (q) { return q.network === T.net; });
  const ex = (rt.excluded || []).some(function (e) { return e[0] === T.gw && e[1] === T.gw.replace(/\.1$/, "." + p.excl); });
  return [C("none", !pool, "The edge router has no DHCP pool for the training network", "It has one.", "show ip dhcp pool on the edge router: nothing for " + T.net + "."),
    C("router", !!pool && (pool.router || [])[0] !== T.gw, "The training pool's default router isn't the training VLAN's gateway", "Its default router is the gateway.", "show running-config on the edge router: the pool's default-router."),
    C("dns", !!pool && JSON.stringify(pool.dns || []) !== JSON.stringify(p.dns), "The training pool hands out no DNS servers, or not the campus's", "It hands out the campus's.", "show running-config on the edge router: the pool's dns-server."),
    C("excl", !!pool && !ex, "The training pool doesn't keep its first twenty addresses back, as every pool here does", "It keeps them back.", "show running-config on the edge router: ip dhcp excluded-address.")];
}
function relay4Causes(sim, v) {
  const p = v.plan, T = p.train, R = sim.rtView("edge"), live = sim.rtLive("edge"), mine = RT.allIfs(R).map(function (n) { const a = RT.addrOf(R, n, live); return a && RT.rtStatus(R, n)[1] === "up" ? a.ip : null; }).filter(Boolean);
  const h = function (id) { const r = (sim.d[id].sw.svis || {})[T.id]; return (r && r.helpers) || []; };
  const none = ["dist1", "dist2"].find(function (id) { return !h(id).length; }), wrong = ["dist1", "dist2"].find(function (id) { return h(id).length && !h(id).some(function (x) { return mine.indexOf(x) >= 0; }); });
  return [C("none", !!none, (none ? Cap(said(sim, none)) : "A distribution switch") + " doesn't relay the training VLAN's DHCP requests", "Both relay them.", "show running-config on " + (none ? said(sim, none) : "") + ": interface Vlan" + T.id + " has no ip helper-address."),
    C("wrong", !none && !!wrong, (wrong ? Cap(said(sim, wrong)) : "A distribution switch") + " relays them to an address where the edge router doesn't answer", "Both relay to the edge router.", "show running-config on " + (wrong ? said(sim, wrong) : "") + ": its ip helper-address.")];
}
/* the training room's desks, locked down as every desk here */
function desks4(sim, v) { const D = v.plan.desks4; return Object.keys(D).map(function (port) { const dev = D[port][0], n = "GigabitEthernet0/" + port, c = cableBetween(sim, "acc4", dev); return { port: port, n: n, dev: dev, p: sim.d.acc4.sw.ports[n], c: c, right: !!c && endAt(c, "acc4") === port, up: !!c && sim.cableUp(c) }; }); }
function desk4Causes(sim, v) {
  const p = v.plan, rows = desks4(sim, v), T = p.train.id, pr = function (r) { return psRead(r.p); };
  const none = rows.find(function (r) { return !r.c; }), wrong = rows.find(function (r) { return r.c && !r.right; }), mode = rows.find(function (r) { return r.right && (r.p.mode !== "access" || r.p.access !== T); });
  const ps = rows.find(function (r) { const P = pr(r); return r.right && (!P.on || P.max !== 1 || P.viol !== "shutdown" || !P.sticky); }), edge = rows.find(function (r) { return r.right && !(r.p.stp && r.p.stp.portfast && r.p.stp.bpduguard); });
  const desc = rows.find(function (r) { return r.right && String(r.p.desc).toUpperCase() !== (r.dev.toUpperCase() + "-" + p.train.name); });
  const used = rows.map(function (r) { return +r.port; }), spare = []; for (let k = 1; k <= 22; k++) if (used.indexOf(k) < 0) spare.push(k);
  const open = spare.find(function (k) { const q = sim.d.acc4.sw.ports["GigabitEthernet0/" + k]; return !q.shutdown || q.access !== p.vlans.parking.id; });
  const nm = function (r) { return r ? name(sim, r.dev) : ""; };
  return [C("cable", !!none, "The " + nm(none) + " has no cable to the 4F access switch", "Each training PC is cabled to its port.", "The Cable runs table: nothing from the " + nm(none) + "."),
    C("port", !none && !!wrong, "The " + nm(wrong) + " isn't on the port the records give it (port " + (wrong ? wrong.port : "") + ")", "Each is on its records' port.", "The Cable runs table: the " + nm(wrong) + "'s run."),
    C("vlan", !none && !wrong && !!mode, "The " + nm(mode) + "'s port isn't an access port in the training VLAN", "Each is an access port in it.", "show interfaces status on the 4F access switch: Gi0/" + (mode ? mode.port : "") + "."),
    C("ps", !none && !wrong && !mode && !!ps, "The " + nm(ps) + "'s port isn't locked down as every desk here is (port security: one device, sticky, shut down on a violation)", "Each has port security as the campus does.", "show port-security interface gi0/" + (ps ? ps.port : "") + " on the 4F access switch."),
    C("edge", !none && !wrong && !mode && !ps && !!edge, "The " + nm(edge) + "'s port isn't an edge port with BPDU guard", "Each is an edge port with BPDU guard.", "show running-config on the 4F access switch: interface gi0/" + (edge ? edge.port : "") + "."),
    C("desc", !none && !wrong && !mode && !ps && !edge && !!desc, "The " + nm(desc) + "'s port isn't described as the records say", "Each is described as the records say.", "show interfaces status on the 4F access switch: Gi0/" + (desc ? desc.port : "") + "'s name."),
    C("spare", !!open, "A spare port on the 4F access switch is open or out of the parking VLAN (port " + (open || "") + ")", "Every spare port is parked and shut.", "show interfaces status on the 4F access switch: Gi0/" + (open || "") + ".")];
}
/* the training PCs: addresses in the training network, online */
function online4Causes(sim, v) {
  const p = v.plan, T = p.train, pcs = ["tr1", "tr2"], a = function (id) { return sim.addr(id); };
  const apipa = pcs.find(function (id) { const x = a(id); return !x || !x.ip || /^169\.254\./.test(x.ip); }), other = pcs.find(function (id) { const x = a(id); return x && x.ip && !/^169\.254\./.test(x.ip) && x.ip.split(".").slice(0, 3).join(".") !== T.net.split(".").slice(0, 3).join("."); });
  const off = pcs.find(function (id) { return !sim.route(id, "8.8.8.8").internet; }), D = sim.ospfAll().routers.dist1;
  const noadv = !(D && D.ifs.some(function (f) { return f.name === "Vlan" + T.id; }));
  const nm = function (id) { return id ? name(sim, id) : ""; };
  return [C("apipa", !!apipa, "The " + nm(apipa) + " has no address from DHCP (169.254: it asked and nobody answered)", "Both have addresses from the training pool.", "ipconfig on the " + nm(apipa) + ": Autoconfiguration IPv4 Address 169.254..."),
    C("net", !apipa && !!other, "The " + nm(other) + " has an address, but not in the training network", "Both are in the training network.", "ipconfig on the " + nm(other) + "."),
    C("noadv", !apipa && !other && !!off && noadv, "The training network isn't in OSPF: nothing beyond the distribution switches knows the way back to it", "It's advertised.", "show ip route on the edge router: no " + T.net + "."),
    C("off", !apipa && !other && !!off && !noadv, "The " + nm(off) + " can't reach the internet", "Both are online.", off ? "ping 8.8.8.8 from the " + nm(off) + ": no reply." : "")];
}
function fail4Causes(sim, v) {
  const p = v.plan, T = p.train, s2 = copyOf(sim); power(s2, "dist1", false);
  const q = groupState(s2, Object.assign({}, p, { vlans: Object.assign({}, p.vlans, { train: T }) }), "train");
  const off = ["tr1", "tr2"].find(function (id) { return !s2.route(id, "8.8.8.8").internet; });
  return [C("gone", !q || !q.active, "With distribution switch 1 off, nothing answers for the training VLAN's gateway", "Switch 2 takes it over.", "Picture distribution switch 1 off: show standby brief on distribution switch 2, Vl" + T.id + "."),
    C("off", !!q && !!q.active && !!off, "With distribution switch 1 off, the " + (off ? name(sim, off) : "") + " loses the internet: switch 2 answers the gateway, but the traffic can't get through it (the training VLAN on its uplink, its routes)", "The floor stays online.", "Picture distribution switch 1 off: tracert -d 8.8.8.8 from the " + (off ? name(sim, off) : "") + ".")];
}
function saved7Causes(sim) { return ["acc4", "dist1", "dist2", "edge"].map(function (id) { return C("unsaved-" + id, unsaved(sim.d[id].sw), Cap(id === "acc4" ? "the 4F access switch" : sayOf(sim, id)) + " hasn't been saved: a power cut takes the changes away", "All four are saved.", "show startup-config on " + (id === "acc4" ? "the 4F access switch" : sayOf(sim, id)) + ": it's not what's running."); }); }

const CJ7 = {
  id: "CP-J7", level: "campus", title: "A new floor end to end: the training room on 4F, its switch from the box, its VLAN all the way to the internet",
  already: ["works", "saved"],   /* a switch fresh from its box has nothing unsaved */
  start(seed) {
    const b = CJ6.start(seed), sim = b.sim;
    for (const a of CJ6.solve(b.v, sim)) { if (a.t === "cmd") exec(sim, a.dev, a.line); else sim.apply(a); }
    ["tr1", "tr2"].forEach(function (id) { delete sim.d[id].boxed; });   /* the training room's PCs are at their desks; the 4F switch is still in its box */
    sim.cli = {};
    return { sim: sim, v: Object.assign({}, b.v, { runs: sim.net.extra.runs || 0 }) };
  },
  brief() { return { quote: "We've taken the fourth floor for the new training team. The two training PCs are on their desks, the riser cables are run up to the 4F closet, and the new access switch is still in its box. Make the floor part of the campus, the same as every other floor: its own network, its gateway on the distribution switches, addresses from the edge router, and locked down like everything else. If a distribution switch dies, training carries on.", from: "Rafiki, owner" }; },
  mason: "End to end means every hop: the desk port, the switch, both uplinks, both distribution switches, the bundle between them, the gateway, the pool and the way back. Build it in that order, and test from the desk at the end.",
  limits: function (v) {
    const p = v.plan, T = p.train, A = p.sw.acc4;
    return ["The 4F access switch: " + A.host + ", locked as every switch here (enable secret " + p.secret + ", console password " + p.console + ", SSH only with the user " + p.user + ", password " + p.userPw + ", domain " + p.domain + "), managed at " + A.ip + " on the management VLAN, its gateway that VLAN's. It starts from the factory: reach it on the console.",
      "Its uplinks: its port 23 to distribution switch 1's port 4, its port 24 to distribution switch 2's port 4. Trunks as the campus's are: native VLAN " + p.vlans.native.id + " (" + p.vlans.native.name + "), no negotiation, carrying the 4F's VLANs, the training VLAN and the management VLAN. The bundle between the distribution switches carries the training VLAN too.",
      "The training VLAN: " + T.id + ", named " + T.name + ", " + T.net + "/24. Its gateway " + T.gw + " is a standby group shared by the distribution switches (switch 1 the second address, active, priority 110, preempt; switch 2 the third), its group numbered for the VLAN; distribution switch 1 its spanning-tree root, switch 2 the backup. The edge router hands out its addresses (the first " + p.excl + " kept back, the campus's DNS), and both distribution switches relay the requests to the same edge router address as the other VLANs.",
      "The desks: Training PC 1 on port 1, Training PC 2 on port 2, each an access port in the training VLAN, described TR1-" + T.name + " and TR2-" + T.name + ", locked down as every desk here (port security: one device, sticky, shut down on a violation; an edge port with BPDU guard). Every spare port parked in VLAN " + p.vlans.parking.id + " and shut.",
      "Your laptop's console cable is 1.8 m: it reaches the 4F switch from the 4F closet."];
  },
  reqs: [
    { id: "rack", text: "The 4F access switch is racked in the 4F closet, uplinked to both distribution switches as the records say", causes: rackCauses,
      ok: function () { return "The 4F access switch is racked, both uplinks on the records' ports, with a link."; },
      rung1: function () { return "The Cable runs table, and show interfaces status on each distribution switch."; },
      rung2: function () { return "A cable needs a port open at both ends before it carries anything: the campus parks and shuts every spare port."; } },
    { id: "base", text: "The 4F access switch is set up as every switch here: name, secret, console password, SSH only, its management address and gateway", causes: base4Causes,
      ok: function () { return "Named, locked, SSH only, managed on the management VLAN."; },
      rung1: function () { return "show running-config on the 4F access switch, against the records."; },
      rung2: function () { return "A switch fresh from the factory has none of this: every line the other switches have, it needs typed."; } },
    { id: "vlan", text: "The training VLAN exists, named as the records say, on the 4F switch and both distribution switches", causes: vlan4Causes,
      ok: function () { return "The training VLAN exists and is named on all three."; },
      rung1: function () { return "show vlan brief on each of the three."; },
      rung2: function () { return "A VLAN only exists on a switch it's been made on: every switch that carries it needs it."; } },
    { id: "trunks", text: "The 4F's uplinks are trunks as the campus's are, carrying the training and management VLANs, and the bundle between the distribution switches carries the training VLAN too", causes: trunk4Causes,
      ok: function () { return "Both uplinks trunk as the campus's do and carry the floor's VLANs; the bundle carries the training VLAN."; },
      rung1: function () { return "show interfaces trunk on the 4F switch and on both distribution switches."; },
      rung2: function () { return "A trunk carries only the VLANs its allowed list names, at both ends: a VLAN left off any hop stops there."; } },
    { id: "stp", text: "The training VLAN's spanning-tree root is distribution switch 1, distribution switch 2 the backup", causes: stp4Causes,
      ok: function () { return "Distribution switch 1 is the training VLAN's root, switch 2 the backup."; },
      rung1: function () { return "show spanning-tree vlan on the 4F switch and on both distribution switches, for the training VLAN."; },
      rung2: function () { return "Every VLAN elects its own root; a new one, left at the defaults, goes to the lowest address, wherever that is."; } },
    { id: "gw", text: "The training VLAN's gateway is shared by standby: both distribution switches on their own addresses, distribution switch 1 active", causes: gw4Causes,
      ok: function () { return "Both distribution switches have their own interface on the training VLAN; the gateway is the group's virtual address, switch 1 active with preempt."; },
      rung1: function () { return "show ip interface brief and show standby brief on both distribution switches."; },
      rung2: function () { return "The gateway is the same arrangement as on every other VLAN since the last work order: two own addresses and one shared one."; } },
    { id: "pool", text: "The edge router hands out addresses for the training network, as for the other VLANs", causes: pool4Causes,
      ok: function () { return "The edge router has a pool for the training network: its default router the gateway, the campus's DNS, the first addresses kept back."; },
      rung1: function () { return "show ip dhcp pool and the pools in show running-config on the edge router."; },
      rung2: function () { return "A pool hands out what it's told: the network, the default router, the DNS servers; addresses kept for the gateway and the gear are excluded first."; } },
    { id: "relay", text: "Both distribution switches relay the training VLAN's DHCP requests to the edge router", causes: relay4Causes,
      ok: function () { return "Both relay the training VLAN's requests to the edge router."; },
      rung1: function () { return "The training VLAN interface's lines in show running-config on both distribution switches."; },
      rung2: function () { return "A request for an address is a broadcast; it reaches the edge router's pool only if the VLAN's gateway relays it, and either switch might be the gateway."; } },
    { id: "desks", text: "Each training PC is on its port, locked down as every desk here; the spare ports parked and shut", causes: desk4Causes,
      ok: function () { return "Both training PCs on their ports, access ports in the training VLAN, port security, edge ports with BPDU guard, described; the spares parked and shut."; },
      rung1: function () { return "show interfaces status and show port-security on the 4F switch."; },
      rung2: function () { return "Every desk port on this campus is set up the same way: whatever the first work order did on the other floors, this floor needs too."; } },
    { id: "online", text: "Both training PCs have addresses in the training network and reach the internet", causes: online4Causes,
      ok: function () { return "Both training PCs are online with addresses from the training pool."; },
      rung1: function () { return "ipconfig /all then ping 8.8.8.8 on each training PC; tracert if a ping fails."; },
      rung2: function () { return "A PC that gave itself an automatic private (APIPA) address asked and nobody answered: follow the request from the desk to the pool."; } },
    { id: "fail", text: "If distribution switch 1 fails, the training floor stays online", causes: fail4Causes,
      ok: function () { return "With distribution switch 1 off, switch 2 answers the training gateway and the floor stays online."; },
      rung1: function () { return "Picture distribution switch 1 off: show standby brief and show interfaces trunk on distribution switch 2."; },
      rung2: function () { return "The standby switch can only take over what reaches it: the VLAN on its uplink to the floor, an interface, the group."; } },
    { id: "works", text: "Everyone else still works: every PC online, both printers and every switch answering", causes: reachCauses,
      ok: function () { return "Every PC is online; both printers and every switch answer."; },
      rung1: function () { return "ping 8.8.8.8 from each PC; the printers and the switches from the service desk."; },
      rung2: function () { return "Changing a trunk or the bundle changes it for every VLAN it carries."; } },
    { id: "saved", text: "The 4F switch, both distribution switches and the edge router are saved", causes: saved7Causes,
      ok: function () { return "All four are saved."; }, rung1: function () { return "show startup-config against show running-config on each."; }, rung2: function () { return "Only what's saved survives a power cut."; } }
  ],
  solve(v, sim) {
    const p = v.plan, T = p.train, A = p.sw.acc4, relay = coreLinks(p)[0].ia, out = [], n = sim ? sim.net.extra.runs || 0 : v.runs || 0;
    let k = 0; const lay = function (a, b) { k++; out.push({ t: "lay", a: a, b: b }); return n + k; };
    const c = function (l) { out.push({ t: "cmd", dev: "tech", line: l, cli: true }); };
    const login = function () { [""].concat([p.console, "enable", p.secret, "configure terminal"]).forEach(c); };
    const save = function () { c("end"); c("copy running-config startup-config"); c(""); };
    let con = 0; const consoleTo = function (dev) { if (con) out.push({ t: "pull", cable: "c-console-" + con }); con = lay({ dev: "tech", port: "USB-C" }, { dev: dev, port: "CONSOLE" }); };
    /* rack it and cable it: the uplinks, the desks */
    out.push({ t: "place", dev: "acc4", room: "c4" });
    UP4.forEach(function (u) { lay({ dev: "acc4", port: u[1] }, { dev: u[0], port: u[2] }); });
    Object.keys(p.desks4).forEach(function (port) { lay({ dev: p.desks4[port][0], port: "NIC" }, { dev: "acc4", port: port }); });
    /* the 4F switch from the factory, on its console */
    out.push({ t: "place", dev: "tech", room: "c4" }); consoleTo("acc4");
    ["", "enable", "configure terminal", "hostname " + A.host, "enable secret " + p.secret, "line console 0", "password " + p.console, "login", "exit", "ip domain-name " + p.domain, "username " + p.user + " secret " + p.userPw, "crypto key generate rsa modulus 2048", "line vty 0 15", "login local", "transport input ssh", "exit"].forEach(c);
    [[T.id, T.name], [p.vlans.mgmt.id, p.vlans.mgmt.name], [p.vlans.native.id, p.vlans.native.name], [p.vlans.parking.id, p.vlans.parking.name]].forEach(function (q) { c("vlan " + q[0]); c("name " + q[1]); c("exit"); });
    c("interface range gi0/23 - 24"); c("switchport trunk native vlan " + p.vlans.native.id); c("switchport trunk allowed vlan " + T.id + "," + p.vlans.mgmt.id); c("switchport mode trunk"); c("switchport nonegotiate"); c("exit");
    c("interface vlan " + p.vlans.mgmt.id); c("ip address " + A.ip + " " + p.mask); c("no shutdown"); c("exit"); c("ip default-gateway " + p.vlans.mgmt.gw);
    Object.keys(p.desks4).forEach(function (port) { const d = p.desks4[port][0]; c("interface gi0/" + port); c("description " + d.toUpperCase() + "-" + T.name); c("switchport mode access"); c("switchport access vlan " + T.id); c("switchport port-security"); c("switchport port-security maximum 1"); c("switchport port-security mac-address sticky"); c("switchport port-security violation shutdown"); c("spanning-tree portfast"); c("spanning-tree bpduguard enable"); c("exit"); });
    c("interface range gi0/3 - 22"); c("switchport mode access"); c("switchport access vlan " + p.vlans.parking.id); c("shutdown"); c("exit");
    c("interface range gi0/25 - 28"); c("shutdown"); c("exit");
    save();
    /* both distribution switches: the VLAN, the uplink, the bundle, the root, the gateway, the relay */
    out.push({ t: "pull", cable: "c-console-" + con }); con = 0; out.push({ t: "place", dev: "tech", room: "data" });
    ["dist1", "dist2"].forEach(function (id, i) {
      consoleTo(id); login();
      c("vlan " + T.id); c("name " + T.name); c("exit");
      c("interface gi0/4"); c("description ACC-4F"); c("switchport trunk native vlan " + p.vlans.native.id); c("switchport trunk allowed vlan " + T.id + "," + p.vlans.mgmt.id); c("switchport mode trunk"); c("switchport nonegotiate"); c("no shutdown"); c("exit");
      c("interface port-channel 1"); c("switchport trunk allowed vlan add " + T.id); c("exit");
      c("spanning-tree vlan " + T.id + " root " + (i ? "secondary" : "primary"));
      c("interface vlan " + T.id); c("ip address " + T.gw.replace(/\.1$/, i ? ".3" : ".2") + " " + p.mask); c("ip helper-address " + relay); c("standby " + T.id + " ip " + T.gw); if (!i) { c("standby " + T.id + " priority 110"); c("standby " + T.id + " preempt"); } c("no shutdown"); c("exit");
      save();
    });
    /* the edge router: the pool */
    consoleTo("edge"); login();
    c("ip dhcp excluded-address " + T.gw + " " + T.gw.replace(/\.1$/, "." + p.excl)); c("ip dhcp pool " + T.name); c("network " + T.net + " " + p.mask); c("default-router " + T.gw); c("dns-server " + p.dns.join(" ")); c("exit");
    save();
    out.push({ t: "pull", cable: "c-console-" + con });
    /* the desks ask again */
    ["tr1", "tr2"].forEach(function (id) { out.push({ t: "cmd", dev: id, line: "ipconfig /renew" }); });
    return out;
  },
  answer(v) {
    const p = v.plan, T = p.train;
    return ["Place the 4F access switch in the 4F closet; lay its port 23 to distribution switch 1's port 4 and its port 24 to switch 2's; lay each training PC to its port.",
      "Carry your laptop to the 4F closet and console in: the name and locks, VLANs " + T.id + " (" + T.name + "), the management, native and parking VLANs; gi0/23 - 24 trunks (native " + p.vlans.native.id + ", allowed " + T.id + "," + p.vlans.mgmt.id + ", nonegotiate); the management address and default gateway; desk ports 1 and 2 as every desk here; the spares parked and shut; save.",
      "On each distribution switch: vlan " + T.id + "; gi0/4 the trunk to the 4F (no shutdown); interface port-channel 1, switchport trunk allowed vlan add " + T.id + "; spanning-tree vlan " + T.id + " root primary (switch 1) or secondary (switch 2); interface vlan " + T.id + " on its own address with ip helper-address, standby " + T.id + " ip " + T.gw + " (switch 1 priority 110, preempt); save.",
      "On the edge router: the excluded addresses and a pool " + T.name + " for " + T.net + " with default-router " + T.gw + " and the campus's DNS; save. Then ipconfig /renew on each training PC."];
  },
  summary() { return ["The fourth floor is part of the campus: the 4F access switch is set up as every switch here and uplinked to both distribution switches.", "The training VLAN runs from the desk ports up both uplinks and across the bundle; distribution switch 1 is its root and its active gateway, switch 2 stands by.", "The edge router hands out its addresses through both distribution switches' relays, and the floor stays online if distribution switch 1 fails."]; }
};

/* ------------------------------------------------------------ CP-J8, the Training Annex on a collapsed core */
/* the Annex across the car park: a layer 3 switch as its core and distribution in one, an access switch for the classroom, joined to the
   main building by single-mode fibre into core switch 2, routed and in OSPF (the plan approved 16 November 2026) */
const AN = function (v) { return v.plan.annex; };
const annexLink = function (p) { const L = p.annex.link; return { id: "annex", a: L.hq, ap: "25", b: "anxc", bp: "25", ia: L.hqIp, ib: L.anxIp, mask: L.mask }; };
const theA = function (id) { return id === "anxc" ? "the Annex core switch" : "the Annex access switch"; };
function rack8Causes(sim, v) {
  const A = AN(v), c = cableBetween(sim, "anxa", "anxc"), right = !!c && endAt(c, "anxa") === A.up.acc && endAt(c, "anxc") === A.up.core, up = !!c && sim.cableUp(c);
  const boxed = sim.d.anxc.boxed || sim.d.anxa.boxed;
  return [C("core", !!sim.d.anxc.boxed, "The Annex core switch is still in its box", "It's racked in the Annex's comms room.", "The work order's van list: the Annex core switch, in its box."),
    C("acc", !!sim.d.anxa.boxed, "The Annex access switch is still in its box", "It's racked beside the core.", "The van list: the Annex access switch, in its box."),
    C("none", !boxed && !c, "The Annex access switch has no uplink to the Annex core", "It's uplinked to the core.", "The Cable runs table: nothing between the two Annex switches."),
    C("ports", !!c && !right, "The uplink isn't on the ports the records give it (the access switch's port " + A.up.acc + " to the core's port " + A.up.core + ")", "It's on the records' ports.", "The Cable runs table: the uplink's two ends."),
    C("down", !!c && right && !up, "The uplink has no link: a port at one end is shut", "It has a link.", "The Cable runs table: No link; show interfaces status on each Annex switch.")];
}
/* the fibre between the buildings: single-mode modules in the records' slots, the run plugged in, both ports open */
function fibre8Causes(sim, v) {
  const L = AN(v).link, H = sim.d[L.hq], X = sim.d.anxc, mh = H.sfp && H.sfp[L.hqPort], ma = X.sfp && X.sfp[L.anxPort];
  const f = sim.net.cables.find(function (c) { return c.kind === "fibre" && [c.a.dev, c.b.dev].indexOf("anxc") >= 0 && [c.a.dev, c.b.dev].indexOf(L.hq) >= 0; }) || null;
  const right = !!f && [[f.a, f.b], [f.b, f.a]].some(function (e) { return e[0].dev === L.hq && e[0].port === L.hqPort && e[1].port === L.anxPort; });
  const copper = sim.net.cables.find(function (c) { return c.kind === "cat6" && [c.a, c.b].some(function (e) { return sim.net.rooms[e.dev] === "acomms" || sim.net.rooms[e.dev] === "class"; }) && [c.a, c.b].some(function (e) { const r = sim.net.rooms[e.dev]; return r && r !== "acomms" && r !== "class"; }); }) || null;
  const mods = [mh, ma].filter(Boolean).map(function (m) { return SFP_MODULES[m]; }), plus = mods.some(function (m) { return m.rate !== 1000; }), mm = mods.some(function (m) { return m.fiber !== "SMF"; });
  const shutH = H.sw.ports[L.hqIf].shutdown, shutA = !X.boxed && X.sw.ports[L.anxIf].shutdown, noMod = !mh ? "core switch 2" : !ma ? "the Annex core switch" : null;
  return [C("boxed", !!X.boxed, "The Annex core switch is still in its box", "It's racked.", "The van list: the Annex core switch, in its box."),
    C("copper", !X.boxed && !f && !!copper, "A copper cable joins the buildings: at " + (copper ? copper.length : "") + " m it's far past copper's 100 m, so it never links", "The buildings are joined by the fibre.", "The Cable runs table: a " + (copper ? copper.length : "") + " m run, No link."),
    C("nomod", !X.boxed && !f && !copper && !!noMod, "There's no module in " + (noMod || "") + "'s SFP1: the fibre's LC plug goes into a module", "Both slots have modules.", "The Physical tab of " + (noMod || "") + ": SFP1 empty."),
    C("none", !X.boxed && !f && !copper && !noMod, "The fibre between the buildings isn't plugged in", "It's plugged in at both ends.", "The Cable runs table: no fibre run."),
    C("slots", !!f && !right, "The fibre isn't in the slots the records give it (core switch 2's SFP1 to the Annex core's SFP1)", "It's in the records' slots.", "The Cable runs table: the fibre's two ends."),
    C("plus", !!f && right && plus, "A 10 Gb/s SFP+ module is in a 1 Gb/s SFP slot: the switch won't run it", "Both modules run at 1 Gb/s.", "show interfaces transceiver on the switch with it: unsupported."),
    C("mmf", !!f && right && !plus && mm, "A multimode module is on the single-mode run: the light it sends is the wrong kind for that fibre", "Both modules are single-mode, as the run is.", "Look at the plug at each end: the module's label, and the jacket's print."),
    C("shut", !!f && right && !plus && !mm && (shutH || shutA), "The fibre's port is shut on " + (shutH ? "core switch 2" : "the Annex core switch"), "Both ports are open.", "show interfaces status on " + (shutH ? "core switch 2" : "the Annex core switch") + ": Gi0/25 disabled."),
    C("down", !!f && right && !plus && !mm && !shutH && !shutA && !sim.cableUp(f), "The fibre has no link", "It has a link.", "The Cable runs table: No link.")];
}
/* each Annex switch set up as every switch here; the core is the Annex's management gateway on its first address, the access switch
   managed on the records' address with that gateway */
function base8For(id) { return function (sim, v) {
  const p = v.plan, A = AN(v), w = sim.d[id].sw, rec = id === "anxc" ? A.core : A.acc, m = (w.svis || {})[A.mgmt.id], u = (w.users || {})[p.user], who = theA(id), Who = Cap(who);
  const out = [C("name", w.hostname !== rec.host, Who + " isn't named as the records say", "Its name is the records'.", "The prompt says " + w.hostname + "."),
    C("secret", !w.enableSecret || !pwOk(w.enableSecret, p.secret), "Its enable secret isn't the campus's", "Its enable secret is the campus's.", "show running-config: " + (w.enableSecret ? "an enable secret, not the campus's" : "no enable secret") + "."),
    C("console", !w.con.password || !pwOk(w.con.password, p.console) || w.con.login !== "password", "Its console doesn't ask for the campus's console password", "The console asks for it.", "show running-config: line con 0."),
    C("ssh", !w.domain || !(w.rsa >= 768) || !u || !pwOk(u, p.userPw) || w.vty.login !== "local" || w.vty.transport !== "ssh", "Its remote logins aren't SSH only with the campus's local user (a domain, keys, the user, login local, transport input ssh)", "SSH only, with the campus's user.", "show running-config: line vty 0 15, the username, ip domain-name."),
    C("mgmt", !m || m.ip !== rec.ip || m.mask !== p.mask || !!m.shutdown, "It has no address on the Annex's management VLAN, as the records give it", "Its management address is the records'.", "show ip interface brief: Vlan" + A.mgmt.id + " " + (m && m.ip || "missing") + ".")];
  if (id === "anxa") out.push(C("gw", w.gateway !== A.mgmt.gw, "Its default gateway isn't the Annex core's management address: it can't answer anything off its own network", "Its default gateway is the Annex core.", "show running-config: ip default-gateway " + (w.gateway || "missing") + "."));
  else out.push(C("routing", !w.routing, "Routing is off on the Annex core switch: it can't route between its networks and the fibre", "Routing is on.", "show ip route on the Annex core switch: the default gateway, not a routing table."));
  return out;
}; }
/* the routed link over the fibre: both ends routed ports on the records' /30, described */
function link8Causes(sim, v) {
  const L = AN(v).link, H = sim.d[L.hq].sw.ports[L.hqIf], X = sim.d.anxc.sw.ports[L.anxIf];
  const end = function (P, ip, desc, who, g) { return [C(who + "sw", !P.routed, Cap(who === "hq" ? "core switch 2" : "the Annex core switch") + "'s fibre port is still a switch port: the link between the buildings is routed, as every core link is", "Both ends are routed ports.", "show running-config: interface " + g + " has no 'no switchport'."),
    C(who + "ip", !!P.routed && (P.ip !== ip || P.mask !== L.mask), Cap(who === "hq" ? "core switch 2" : "the Annex core switch") + "'s fibre port isn't on the records' address", "Both ends are on the records' addresses.", "show ip interface brief: " + g + " " + (P.ip || "unassigned") + "."),
    C(who + "desc", !!P.routed && P.ip === ip && String(P.desc || "").toUpperCase() !== desc, Cap(who === "hq" ? "core switch 2" : "the Annex core switch") + "'s fibre port isn't described as the records say", "Both ends are described.", "show interfaces status: " + g + "'s name.")]; };
  return end(H, L.hqIp, L.hqDesc, "hq", "Gi0/25").concat(end(X, L.anxIp, L.anxDesc, "anx", "Gi0/25"));
}
const nbr8Causes = nbrCausesFor(function (p) { return [annexLink(p)]; });
/* the Annex's two VLANs on both its switches */
function vlan8Causes(sim, v) {
  const A = AN(v), want = [A.cls, A.mgmt], miss = [], bad = [];
  ["anxc", "anxa"].forEach(function (id) { want.forEach(function (q) { const x = (sim.d[id].sw.vlans || {})[q.id]; if (!x) miss.push([id, q]); else if (String(x.name).toUpperCase() !== q.name) bad.push([id, q]); }); });
  return [C("none", miss.length > 0, miss.length ? "VLAN " + miss[0][1].id + " (" + miss[0][1].name + ") doesn't exist on " + theA(miss[0][0]) : "", "Both VLANs exist on both Annex switches.", miss.length ? "show vlan brief on " + theA(miss[0][0]) + "." : ""),
    C("name", !miss.length && bad.length > 0, bad.length ? "VLAN " + bad[0][1].id + " on " + theA(bad[0][0]) + " isn't named as the records say" : "", "Named as the records say.", bad.length ? "show vlan brief on " + theA(bad[0][0]) + "." : "")];
}
/* the uplink between the Annex's switches: a trunk as the campus's are, carrying the classroom and the Annex's management VLANs */
function trunk8Causes(sim, v) {
  const p = v.plan, A = AN(v), N = p.vlans.native.id, ends = [{ id: "anxc", n: "GigabitEthernet0/" + A.up.core, far: { id: "anxa", n: "GigabitEthernet0/" + A.up.acc } }, { id: "anxa", n: "GigabitEthernet0/" + A.up.acc, far: { id: "anxc", n: "GigabitEthernet0/" + A.up.core } }];
  const P = function (e) { return sim.d[e.id].sw.ports[e.n]; }, cr = function (e) { const f = P(e.far); return carries(Object.assign({}, sim.d[e.id].sw, { links: sim.switchLinks(e.id) }), e.n, { mode: f.mode, nonegotiate: f.nonegotiate }); };
  const who = function (e) { return e ? Cap(theA(e.id)) + "'s port " + e.n.split("/")[1] : ""; };
  const notTrunk = ends.find(function (e) { return P(e).routed || P(e).mode !== "trunk"; }), neg = ends.find(function (e) { return P(e).mode === "trunk" && !P(e).nonegotiate; }), nat = ends.find(function (e) { return P(e).native !== N; });
  const noC = ends.find(function (e) { return cr(e).tagged.indexOf(A.cls.id) < 0; }), noM = ends.find(function (e) { return cr(e).tagged.indexOf(A.mgmt.id) < 0; });
  return [C("mode", !!notTrunk, who(notTrunk) + " isn't a trunk", "Both ends are trunks.", "show interfaces trunk on " + (notTrunk ? theA(notTrunk.id) : "") + "."),
    C("dtp", !notTrunk && !!neg, who(neg) + " is a trunk but still negotiates (DTP): the campus's trunks don't", "Neither end negotiates.", "show interfaces " + (neg ? "gi0/" + neg.n.split("/")[1] : "") + " switchport: Negotiation of Trunking: On."),
    C("native", !notTrunk && !!nat, who(nat) + "'s native VLAN isn't the campus's unused one", "Both ends' native VLAN is the campus's unused one.", "show interfaces trunk: native " + (nat ? P(nat).native : "") + "."),
    C("cls", !notTrunk && !nat && !!noC, who(noC) + " doesn't carry the classroom VLAN", "Both ends carry it.", "show interfaces trunk: VLAN " + A.cls.id + " not allowed."),
    C("mgmt", !notTrunk && !nat && !noC && !!noM, who(noM) + " doesn't carry the Annex's management VLAN: the access switch can't be managed over it", "Both ends carry it.", "show interfaces trunk: VLAN " + A.mgmt.id + " not allowed.")];
}
/* the classroom's gateway on the Annex core, and both its networks in OSPF, passive, so the main building learns the way to them */
function gw8Causes(sim, v) {
  const A = AN(v), r = (sim.d.anxc.sw.svis || {})[A.cls.id] || null, up = l3Ifs(sim.l3View("anxc")).some(function (f) { return f.name === "Vlan" + A.cls.id && f.up; });
  const X = sim.ospfAll().routers.anxc, inO = function (q) { return X && X.ifs.find(function (f) { return f.name === "Vlan" + q.id; }); };
  const noadv = [A.cls, A.mgmt].find(function (q) { return !inO(q); }), hello = [A.cls, A.mgmt].find(function (q) { const f = inO(q); return f && !f.passive; });
  return [C("svi", !r || r.ip !== A.cls.gw || r.mask !== v.plan.mask, "The classroom VLAN has no interface on the Annex core on its gateway address (the first)", "Its gateway is the Annex core's interface.", "show ip interface brief on the Annex core switch: Vlan" + A.cls.id + "."),
    C("down", !!r && r.ip === A.cls.gw && !up, "The classroom VLAN's interface on the Annex core is down: no port that's up carries the VLAN", "It's up.", "show ip interface brief on the Annex core switch: Vlan" + A.cls.id + " down."),
    C("noadv", !!r && up && !!noadv, "VLAN " + (noadv ? noadv.id + " (" + noadv.name + ")" : "") + " isn't in OSPF on the Annex core: nothing in the main building learns the way to it", "Both of the Annex's networks are in OSPF.", "show ip ospf interface brief on the Annex core switch."),
    C("hello", !!r && up && !noadv && !!hello, "VLAN " + (hello ? hello.id : "") + "'s interface sends OSPF hellos to the classroom: anything there that answers could feed the campus routes", "Both are passive.", "show ip protocols on the Annex core switch: Passive Interface(s).")];
}
/* the edge router's pool for the classroom, and the Annex core relaying the classroom's requests to it */
function pool8Causes(sim, v) { return pool4Causes(sim, Object.assign({}, v, { plan: Object.assign({}, v.plan, { train: AN(v).cls }) })).map(function (c) { c.text = c.text.replace(/the training (network|pool)/g, "the classroom $1").replace(/The training pool/g, "The classroom pool"); return c; }); }
function relay8Causes(sim, v) {
  const A = AN(v), R = sim.rtView("edge"), live = sim.rtLive("edge"), mine = RT.allIfs(R).map(function (n) { const a = RT.addrOf(R, n, live); return a && RT.rtStatus(R, n)[1] === "up" ? a.ip : null; }).filter(Boolean);
  const r = (sim.d.anxc.sw.svis || {})[A.cls.id], h = (r && r.helpers) || [];
  return [C("none", !h.length, "The Annex core doesn't relay the classroom's DHCP requests", "It relays them.", "show running-config on the Annex core switch: interface Vlan" + A.cls.id + " has no ip helper-address."),
    C("wrong", h.length > 0 && !h.some(function (x) { return mine.indexOf(x) >= 0; }), "It relays them to an address where the edge router doesn't answer", "It relays to the edge router.", "show running-config on the Annex core switch: its ip helper-address.")];
}
/* the classroom's desks on the Annex access switch, locked down as every desk here */
function desk8Causes(sim, v) {
  const p = v.plan, A = AN(v), D = A.desks, w = sim.d.anxa.sw, rows = Object.keys(D).map(function (port) { const dev = D[port][0], n = "GigabitEthernet0/" + port, c = cableBetween(sim, "anxa", dev); return { port: port, n: n, dev: dev, p: w.ports[n], c: c, right: !!c && endAt(c, "anxa") === port }; });
  const none = rows.find(function (r) { return !r.c; }), wrong = rows.find(function (r) { return r.c && !r.right; }), mode = rows.find(function (r) { return r.right && (r.p.mode !== "access" || r.p.access !== A.cls.id); });
  const ps = rows.find(function (r) { const P = psRead(r.p); return r.right && (!P.on || P.max !== 1 || P.viol !== "shutdown" || !P.sticky); }), edge = rows.find(function (r) { return r.right && !(r.p.stp && r.p.stp.portfast && r.p.stp.bpduguard); });
  const desc = rows.find(function (r) { return r.right && String(r.p.desc).toUpperCase() !== (r.dev.toUpperCase() + "-" + A.cls.name); });
  const used = rows.map(function (r) { return +r.port; }).concat([+A.up.acc]), open = []; for (let k = 1; k <= 24; k++) if (used.indexOf(k) < 0) { const q = w.ports["GigabitEthernet0/" + k]; if (!q.shutdown || q.access !== p.vlans.parking.id) open.push(k); }
  const nm = function (r) { return r ? name(sim, r.dev) : ""; };
  return [C("cable", !!none, "The " + nm(none) + " has no cable to the Annex access switch", "Each classroom PC is cabled to its port.", "The Cable runs table: nothing from the " + nm(none) + "."),
    C("port", !none && !!wrong, "The " + nm(wrong) + " isn't on the port the records give it (port " + (wrong ? wrong.port : "") + ")", "Each is on its records' port.", "The Cable runs table: the " + nm(wrong) + "'s run."),
    C("vlan", !none && !wrong && !!mode, "The " + nm(mode) + "'s port isn't an access port in the classroom VLAN", "Each is an access port in it.", "show interfaces status on the Annex access switch: Gi0/" + (mode ? mode.port : "") + "."),
    C("ps", !none && !wrong && !mode && !!ps, "The " + nm(ps) + "'s port isn't locked down as every desk here is (port security: one device, sticky, shut down on a violation)", "Each has port security as the campus does.", "show port-security interface gi0/" + (ps ? ps.port : "") + " on the Annex access switch."),
    C("edge", !none && !wrong && !mode && !ps && !!edge, "The " + nm(edge) + "'s port isn't an edge port with BPDU guard", "Each is an edge port with BPDU guard.", "show running-config on the Annex access switch: interface gi0/" + (edge ? edge.port : "") + "."),
    C("desc", !none && !wrong && !mode && !ps && !edge && !!desc, "The " + nm(desc) + "'s port isn't described as the records say", "Each is described as the records say.", "show interfaces status on the Annex access switch: Gi0/" + (desc ? desc.port : "") + "'s name."),
    C("spare", open.length > 0, "A spare port on the Annex access switch is open or out of the parking VLAN (port " + (open[0] || "") + ")", "Every spare port is parked and shut.", "show interfaces status on the Annex access switch: Gi0/" + (open[0] || "") + ".")];
}
/* the classroom PCs: addresses in the classroom network, online */
function online8Causes(sim, v) {
  const A = AN(v), pcs = ["cl1", "cl2"], a = function (id) { return sim.addr(id); }, pre = A.cls.net.split(".").slice(0, 3).join(".");
  const apipa = pcs.find(function (id) { const x = a(id); return !x || !x.ip || /^169\.254\./.test(x.ip); }), other = pcs.find(function (id) { const x = a(id); return x && x.ip && !/^169\.254\./.test(x.ip) && x.ip.split(".").slice(0, 3).join(".") !== pre; });
  const off = pcs.find(function (id) { return !sim.route(id, "8.8.8.8").internet; }), X = sim.ospfAll().routers.anxc, noadv = !(X && X.ifs.some(function (f) { return f.name === "Vlan" + A.cls.id; }));
  const nm = function (id) { return id ? name(sim, id) : ""; };
  return [C("apipa", !!apipa, "The " + nm(apipa) + " has no address from DHCP (169.254: it asked and nobody answered)", "Both have addresses from the classroom pool.", "ipconfig on the " + nm(apipa) + ": Autoconfiguration IPv4 Address 169.254..."),
    C("net", !apipa && !!other, "The " + nm(other) + " has an address, but not in the classroom network", "Both are in the classroom network.", "ipconfig on the " + nm(other) + "."),
    C("noadv", !apipa && !other && !!off && noadv, "The classroom network isn't in OSPF: the main building doesn't know the way back to it", "It's advertised.", "show ip route on the edge router: no " + A.cls.net + "."),
    C("off", !apipa && !other && !!off && !noadv, "The " + nm(off) + " can't reach the internet", "Both are online.", off ? "ping 8.8.8.8 from the " + nm(off) + ": no reply." : "")];
}
/* the Annex's switches managed from the main building, as every switch here is: the service desk reaches both */
function manage8Causes(sim, v) {
  const A = AN(v), ok = function (ip) { const r = sim.route("sd1", ip); return !r.fail && !!(r.local || r.routed); };
  return [C("core", !ok(A.core.ip), "The service desk PC gets no answer from the Annex core switch's management address", "The Annex core answers from the service desk.", "ping " + "the Annex core's management address from the service desk PC: no reply."),
    C("acc", ok(A.core.ip) && !ok(A.acc.ip), "The service desk PC reaches the Annex core but not the Annex access switch: its management address, its gateway, or the VLAN on the uplink", "Both answer.", "ping the Annex access switch's management address from the service desk PC: no reply.")];
}
function saved8Causes(sim) { return ["anxc", "anxa", "core2", "edge"].map(function (id) { const who = id === "anxc" || id === "anxa" ? theA(id) : sayOf(sim, id); return C("unsaved-" + id, unsaved(sim.d[id].sw), Cap(who) + " hasn't been saved: a power cut takes the changes away", "All four are saved.", "show startup-config on " + who + ": it's not what's running."); }); }

const CJ8 = {
  id: "CP-J8", level: "campus", title: "The Training Annex: a collapsed core across the car park, joined by single-mode fibre, routed and in OSPF",
  already: ["works", "saved"],   /* switches fresh from their boxes have nothing unsaved */
  start(seed) {
    const b = CJ7.start(seed), sim = b.sim;
    for (const a of CJ7.solve(b.v, sim)) { if (a.t === "cmd") exec(sim, a.dev, a.line); else sim.apply(a); }
    ["cl1", "cl2"].forEach(function (id) { delete sim.d[id].boxed; });   /* the classroom's PCs are at their desks; both Annex switches are still in their boxes */
    sim.d.core2.sfp = { SFP1: null, SFP2: null, SFP3: null, SFP4: null };   /* core switch 2's fibre slots, empty: the duct's fibre lands there */
    sim.cli = {};
    return { sim: sim, v: Object.assign({}, b.v, { runs: sim.net.extra.runs || 0 }) };
  },
  brief() { return { quote: "The Training Annex across the car park is ours now. The installers have pulled single-mode fibre through the duct from the data room to the Annex's comms room, and both switches for it are in their boxes there. Make it a little campus of its own, one core switch doing the lot, but tied into ours: the classroom gets its addresses from the edge router like everyone else, and I want to manage those switches from the service desk.", from: "Rafiki, owner" }; },
  mason: "Two buildings, one routing domain. Get the light across first, then the routed link and its neighbours, then build the Annex inside out: its VLANs, its uplink, its gateway, the pool and the relay, the desks. Test from a classroom PC at the end.",
  limits: function (v) {
    const p = v.plan, A = AN(v), L = A.link;
    return ["The Annex core switch: " + A.core.host + " (MSW-3900X), locked as every switch here (enable secret " + p.secret + ", console password " + p.console + ", SSH only with the user " + p.user + ", password " + p.userPw + ", domain " + p.domain + "), routing on, managed at " + A.core.ip + ": the gateway of the Annex's management VLAN. The Annex access switch: " + A.acc.host + " (MSW-2800G), locked the same way, managed at " + A.acc.ip + ", its gateway the core. Both start from the factory: reach them on the console.",
      "The fibre: OS2 single-mode through the duct, " + runLength("data", "acomms", { runs: CAMPUS_RUN }) + " m, from core switch 2's SFP1 (Gi0/25) to the Annex core's SFP1 (Gi0/25). The van has 1000BASE-SX, 1000BASE-LX and 10GBASE-SR modules. A routed link on " + L.net + "/30: core switch 2 " + L.hqIp + ", described " + L.hqDesc + "; the Annex core " + L.anxIp + ", described " + L.anxDesc + ". OSPF area 0, as the core is; the Annex core's own networks advertised and passive.",
      "The Annex's VLANs: " + A.cls.id + " named " + A.cls.name + " (" + A.cls.net + "/24, gateway " + A.cls.gw + " on the Annex core), and " + A.mgmt.id + " named " + A.mgmt.name + " (" + A.mgmt.net + "/24). The access switch's port " + A.up.acc + " to the core's port " + A.up.core + ": a trunk as the campus's are, native VLAN " + p.vlans.native.id + " (" + p.vlans.native.name + "), no negotiation, carrying both. The edge router hands out the classroom's addresses (the first " + p.excl + " kept back, the campus's DNS); the Annex core relays the requests to the same edge router address as every other relay here.",
      "The desks: Classroom PC 1 on port 1, Classroom PC 2 on port 2, each an access port in the classroom VLAN, described CL1-" + A.cls.name + " and CL2-" + A.cls.name + ", locked down as every desk here. Every spare port on both Annex switches parked in VLAN " + p.vlans.parking.id + " and shut.",
      "Your laptop's console cable is 1.8 m: carry it to the Annex's comms room for its switches, and back to the data room for core switch 2 and the edge router."];
  },
  reqs: [
    { id: "rack", text: "Both Annex switches are racked in the Annex's comms room, the access switch uplinked to the core as the records say", causes: rack8Causes,
      ok: function () { return "Both Annex switches are racked; the access switch's uplink is on the records' ports, with a link."; },
      rung1: function () { return "The Cable runs table, and the van list."; },
      rung2: function () { return "Unpacking comes before cabling: a switch in its box has no ports to plug into."; } },
    { id: "fibre", text: "The fibre between the buildings is up: core switch 2's SFP1 to the Annex core's SFP1", causes: fibre8Causes,
      ok: function () { return "The fibre is up: single-mode modules at both ends, the run plugged in, both ports open."; },
      rung1: function () { return "The Physical tab of each switch at the fibre's ends, and the Cable runs table."; },
      rung2: function () { return "A fibre link needs the same kind of light at both ends, the kind the fibre is made for, in slots that can run it; and copper stops at a hundred metres."; } },
    { id: "core", text: "The Annex core switch is set up as every switch here, routing on, managed on the Annex's management VLAN", causes: base8For("anxc"),
      ok: function () { return "The Annex core is named, locked, SSH only, routing, managed on its management VLAN."; },
      rung1: function () { return "show running-config on the Annex core switch, against the records."; },
      rung2: function () { return "A switch fresh from the factory has none of this; a layer 3 switch also routes only once it's told to."; } },
    { id: "acc", text: "The Annex access switch is set up as every switch here, managed on the Annex's management VLAN", causes: base8For("anxa"),
      ok: function () { return "The Annex access switch is named, locked, SSH only, managed, its gateway the core."; },
      rung1: function () { return "show running-config on the Annex access switch, against the records."; },
      rung2: function () { return "A switch that doesn't route answers from off its own network only through its default gateway."; } },
    { id: "link", text: "The link over the fibre is routed at both ends, on the records' addresses", causes: link8Causes,
      ok: function () { return "Both ends of the fibre are routed ports on the records' addresses, described."; },
      rung1: function () { return "show ip interface brief and show interfaces status at both ends of the fibre."; },
      rung2: function () { return "Every link between the campus's routers is routed: a port gets an address only once it stops being a switch port."; } },
    { id: "ospf", text: "Core switch 2 and the Annex core are OSPF neighbours across the fibre", causes: nbr8Causes,
      ok: function () { return "Core switch 2 and the Annex core are FULL across the fibre."; },
      rung1: function () { return "show ip ospf neighbor and show ip ospf interface brief at both ends."; },
      rung2: function () { return "Two routers become neighbours only on an interface both have in OSPF, in the same area, neither passive."; } },
    { id: "vlans", text: "The classroom VLAN and the Annex's management VLAN exist on both Annex switches, named as the records say", causes: vlan8Causes,
      ok: function () { return "Both VLANs exist and are named on both Annex switches."; },
      rung1: function () { return "show vlan brief on each Annex switch."; },
      rung2: function () { return "Behind a routed link the Annex's VLANs are its own: they exist only where they've been made."; } },
    { id: "trunk", text: "The uplink between the Annex's switches is a trunk as the campus's are, carrying both its VLANs", causes: trunk8Causes,
      ok: function () { return "The uplink trunks as the campus's do and carries both VLANs."; },
      rung1: function () { return "show interfaces trunk on each Annex switch."; },
      rung2: function () { return "A trunk carries only the VLANs its allowed list names, at both ends."; } },
    { id: "gw", text: "The classroom's gateway is on the Annex core, and both the Annex's networks are in OSPF, passive", causes: gw8Causes,
      ok: function () { return "The classroom's gateway is the Annex core's interface; both networks are advertised, passive."; },
      rung1: function () { return "show ip interface brief and show ip protocols on the Annex core switch."; },
      rung2: function () { return "A network the main building should reach has to be in OSPF; an interface facing desks says no hellos."; } },
    { id: "pool", text: "The edge router hands out addresses for the classroom network, as for the other VLANs", causes: pool8Causes,
      ok: function () { return "The edge router has a pool for the classroom: its default router the gateway, the campus's DNS, the first addresses kept back."; },
      rung1: function () { return "show ip dhcp pool and the pools in show running-config on the edge router."; },
      rung2: function () { return "A pool hands out what it's told: the network, the default router, the DNS servers; addresses kept for the gateway and the gear are excluded first."; } },
    { id: "relay", text: "The Annex core relays the classroom's DHCP requests to the edge router", causes: relay8Causes,
      ok: function () { return "The Annex core relays the classroom's requests to the edge router."; },
      rung1: function () { return "The classroom VLAN interface's lines in show running-config on the Annex core switch."; },
      rung2: function () { return "A request for an address is a broadcast: it stops at the classroom's gateway unless the gateway relays it."; } },
    { id: "desks", text: "Each classroom PC is on its port, locked down as every desk here; the spare ports parked and shut", causes: desk8Causes,
      ok: function () { return "Both classroom PCs on their ports, locked down, described; the spares parked and shut."; },
      rung1: function () { return "show interfaces status and show port-security on the Annex access switch."; },
      rung2: function () { return "Every desk port on this campus is set up the same way, in either building."; } },
    { id: "online", text: "Both classroom PCs have addresses in the classroom network and reach the internet", causes: online8Causes,
      ok: function () { return "Both classroom PCs are online with addresses from the classroom pool."; },
      rung1: function () { return "ipconfig /all then ping 8.8.8.8 on each classroom PC; tracert if a ping fails."; },
      rung2: function () { return "A PC that gave itself an automatic private (APIPA) address asked and nobody answered: follow the request from the desk to the pool, and the reply back."; } },
    { id: "manage", text: "Both Annex switches answer from the service desk, as every switch here does", causes: manage8Causes,
      ok: function () { return "The service desk PC reaches both Annex switches."; },
      rung1: function () { return "ping each Annex switch's management address from the service desk PC; tracert if one fails."; },
      rung2: function () { return "A reply has to find its way back too: the main building learns the Annex's networks only through OSPF."; } },
    { id: "works", text: "Everyone else still works: every PC online, both printers and every switch answering", causes: reachCauses,
      ok: function () { return "Every PC is online; both printers and every switch answer."; },
      rung1: function () { return "ping 8.8.8.8 from each PC; the printers and the switches from the service desk."; },
      rung2: function () { return "A change on a core switch is a change for every network behind it."; } },
    { id: "saved", text: "Both Annex switches, core switch 2 and the edge router are saved", causes: saved8Causes,
      ok: function () { return "All four are saved."; }, rung1: function () { return "show startup-config against show running-config on each."; }, rung2: function () { return "Only what's saved survives a power cut."; } }
  ],
  solve(v, sim) {
    const p = v.plan, A = AN(v), L = A.link, relay = coreLinks(p)[0].ia, b = p.vlans.svc.net.split(".")[1], out = [], n = sim ? sim.net.extra.runs || 0 : v.runs || 0;
    let k = 0; const lay = function (a, b2) { k++; out.push({ t: "lay", a: a, b: b2 }); return n + k; };
    const c = function (l) { out.push({ t: "cmd", dev: "tech", line: l, cli: true }); };
    const login = function () { [""].concat([p.console, "enable", p.secret, "configure terminal"]).forEach(c); };
    const save = function () { c("end"); c("copy running-config startup-config"); c(""); };
    const fresh = function (host) { ["", "enable", "configure terminal", "hostname " + host, "enable secret " + p.secret, "line console 0", "password " + p.console, "login", "exit", "ip domain-name " + p.domain, "username " + p.user + " secret " + p.userPw, "crypto key generate rsa modulus 2048", "line vty 0 15", "login local", "transport input ssh", "exit"].forEach(c); };
    const vlans = function () { [[A.cls.id, A.cls.name], [A.mgmt.id, A.mgmt.name], [p.vlans.native.id, p.vlans.native.name], [p.vlans.parking.id, p.vlans.parking.name]].forEach(function (q) { c("vlan " + q[0]); c("name " + q[1]); c("exit"); }); };
    const trunk = function () { c("switchport trunk native vlan " + p.vlans.native.id); c("switchport trunk allowed vlan " + A.cls.id + "," + A.mgmt.id); c("switchport mode trunk"); c("switchport nonegotiate"); };
    let con = 0; const consoleTo = function (dev) { if (con) out.push({ t: "pull", cable: "c-console-" + con }); con = lay({ dev: "tech", port: "USB-C" }, { dev: dev, port: "CONSOLE" }); };
    /* unpack and cable: the modules, the fibre, the uplink, the desks */
    out.push({ t: "place", dev: "anxc", room: "acomms" }, { t: "place", dev: "anxa", room: "acomms" });
    out.push({ t: "sfp", dev: L.hq, slot: L.hqPort, type: "1000BASE-LX" }, { t: "sfp", dev: "anxc", slot: L.anxPort, type: "1000BASE-LX" });
    lay({ dev: L.hq, port: L.hqPort }, { dev: "anxc", port: L.anxPort });
    lay({ dev: "anxa", port: A.up.acc }, { dev: "anxc", port: A.up.core });
    Object.keys(A.desks).forEach(function (port) { lay({ dev: A.desks[port][0], port: "NIC" }, { dev: "anxa", port: port }); });
    /* the Annex core from the factory */
    out.push({ t: "place", dev: "tech", room: "acomms" }); consoleTo("anxc");
    fresh(A.core.host); c("ip routing"); vlans();
    c("interface gi0/25"); c("description " + L.anxDesc); c("no switchport"); c("ip address " + L.anxIp + " " + L.mask); c("no shutdown"); c("exit");
    c("interface gi0/" + A.up.core); c("description ANX-ACCESS"); trunk(); c("exit");
    c("interface vlan " + A.mgmt.id); c("ip address " + A.core.ip + " " + p.mask); c("no shutdown"); c("exit");
    c("interface vlan " + A.cls.id); c("ip address " + A.cls.gw + " " + p.mask); c("ip helper-address " + relay); c("no shutdown"); c("exit");
    c("router ospf 1"); c("network 10." + b + ".0.0 0.0.255.255 area 0"); c("passive-interface default"); c("no passive-interface gi0/25"); c("exit");
    c("interface range gi0/2 - 24 , gi0/26 - 28"); c("switchport access vlan " + p.vlans.parking.id); c("shutdown"); c("exit");
    save();
    /* the Annex access switch from the factory */
    consoleTo("anxa");
    fresh(A.acc.host); vlans();
    c("interface gi0/" + A.up.acc); c("description ANX-CORE"); trunk(); c("exit");
    c("interface vlan " + A.mgmt.id); c("ip address " + A.acc.ip + " " + p.mask); c("no shutdown"); c("exit"); c("ip default-gateway " + A.mgmt.gw);
    Object.keys(A.desks).forEach(function (port) { const d = A.desks[port][0]; c("interface gi0/" + port); c("description " + d.toUpperCase() + "-" + A.cls.name); c("switchport mode access"); c("switchport access vlan " + A.cls.id); c("switchport port-security"); c("switchport port-security maximum 1"); c("switchport port-security mac-address sticky"); c("switchport port-security violation shutdown"); c("spanning-tree portfast"); c("spanning-tree bpduguard enable"); c("exit"); });
    c("interface range gi0/3 - 23"); c("switchport mode access"); c("switchport access vlan " + p.vlans.parking.id); c("shutdown"); c("exit");
    c("interface range gi0/25 - 28"); c("shutdown"); c("exit");
    save();
    /* back to the data room: core switch 2's end of the fibre, then the edge router's pool */
    out.push({ t: "pull", cable: "c-console-" + con }); con = 0; out.push({ t: "place", dev: "tech", room: "data" });
    consoleTo(L.hq); login();
    c("interface gi0/25"); c("description " + L.hqDesc); c("no switchport"); c("ip address " + L.hqIp + " " + L.mask); c("no shutdown"); c("exit");
    save();
    consoleTo("edge"); login();
    c("ip dhcp excluded-address " + A.cls.gw + " " + A.cls.gw.replace(/\.1$/, "." + p.excl)); c("ip dhcp pool " + A.cls.name); c("network " + A.cls.net + " " + p.mask); c("default-router " + A.cls.gw); c("dns-server " + p.dns.join(" ")); c("exit");
    save();
    out.push({ t: "pull", cable: "c-console-" + con });
    ["cl1", "cl2"].forEach(function (id) { out.push({ t: "cmd", dev: id, line: "ipconfig /renew" }); });
    return out;
  },
  answer(v) {
    const p = v.plan, A = AN(v), L = A.link, b = p.vlans.svc.net.split(".")[1];
    return ["Place both Annex switches in the Annex's comms room. Put a 1000BASE-LX module in core switch 2's SFP1 and in the Annex core's SFP1 (the run is single-mode) and lay the fibre between them; lay the access switch's port " + A.up.acc + " to the core's port " + A.up.core + ", and each classroom PC to its port.",
      "Carry your laptop to the Annex's comms room and console into the Annex core: the name and locks, ip routing, VLANs " + A.cls.id + " and " + A.mgmt.id + " (and the native and parking VLANs); gi0/25 no switchport, ip address " + L.anxIp + " " + L.mask + "; gi0/" + A.up.core + " a trunk as the campus's; interface vlan " + A.mgmt.id + " " + A.core.ip + "; interface vlan " + A.cls.id + " " + A.cls.gw + " with ip helper-address; router ospf 1, network 10." + b + ".0.0 0.0.255.255 area 0, passive-interface default, no passive-interface gi0/25; the spares parked and shut; save.",
      "The Annex access switch: the name and locks, the VLANs, gi0/" + A.up.acc + " the trunk, interface vlan " + A.mgmt.id + " " + A.acc.ip + ", ip default-gateway " + A.mgmt.gw + "; desk ports 1 and 2 as every desk here; the spares parked and shut; save.",
      "Back in the data room, core switch 2: interface gi0/25, no switchport, ip address " + L.hqIp + " " + L.mask + ", no shutdown; save. The edge router: the excluded addresses and a pool " + A.cls.name + " for " + A.cls.net + " with default-router " + A.cls.gw + " and the campus's DNS; save. Then ipconfig /renew on each classroom PC."];
  },
  summary() { return ["The Training Annex is a collapsed core of its own: one layer 3 switch routes its classroom and management networks, an access switch serves the desks.", "Single-mode fibre joins it to core switch 2: a routed link, OSPF neighbours across it, the Annex's networks advertised to the whole campus.", "The classroom's addresses come from the edge router through the Annex core's relay, and both Annex switches are managed from the service desk."]; }
};


/* ------------------------------------------------------------ CP-J9, jumbo frames for the backup network */
/* the backup server in the 2F closet and the file server in the data room, joined by a backup network of their own (a VLAN, not routed),
   9000-byte frames all the way: each server's backup port (eno2), and every switch the VLAN crosses (both access switches, both
   distribution switches). The switches' jumbo MTU takes effect at a reload: the work is done in the maintenance window */
const SRVS = ["fsrv", "bksrv"];
const BK_ON = ["acc1", "dist1", "dist2", "acc2"];
const BK_MTU = 9000;
const sw9 = function (sim, id) { return id === "acc1" ? "the 1F access switch" : id === "acc2" ? "the 2F access switch" : said(sim, id); };
const srv9 = function (id) { return id === "fsrv" ? "the file server" : "the backup server"; };
const nic9 = function (n) { return "port " + n.slice(-1) + " (" + n + ")"; };
const other9 = function (id) { return id === "fsrv" ? "bksrv" : "fsrv"; };
function rack9Causes(sim, v) {
  const S = v.plan.srv.bksrv, x = sim.d.bksrv, rows = ["eno1", "eno2"].map(function (n) { const c = sim.cableAt("bksrv", n), far = c ? (c.a.dev === "bksrv" ? c.b : c.a) : null; return { n: n, c: c, right: !!far && far.dev === S.sw && far.port === S.ports[n] }; });
  const none = rows.find(function (r) { return !r.c; }), wrong = rows.find(function (r) { return r.c && !r.right; });
  return [C("boxed", !!x.boxed, "The backup server is still in its box", "It's racked in the 2F closet.", "The work order's van list: the backup server, in its box."),
    C("none", !x.boxed && !!none, "The backup server's " + (none ? nic9(none.n) : "") + " has no cable", "Both its ports are cabled.", "The Cable runs table: nothing from the backup server's " + (none ? nic9(none.n) : "") + "."),
    C("ports", !x.boxed && !none && !!wrong, "The backup server's " + (wrong ? nic9(wrong.n) : "") + " isn't on the port the records give it (the 2F access switch's port " + (wrong ? S.ports[wrong.n] : "") + ")", "Both are on the records' ports.", "The Cable runs table: the backup server's runs.")];
}
function vlan9Causes(sim, v) {
  const B = v.plan.backup, miss = BK_ON.find(function (id) { return !(sim.d[id].sw.vlans || {})[B.id]; }), misname = BK_ON.find(function (id) { const q = (sim.d[id].sw.vlans || {})[B.id]; return q && String(q.name).toUpperCase() !== B.name; });
  return [C("none", !!miss, "The backup VLAN doesn't exist on " + (miss ? sw9(sim, miss) : ""), "It exists on all four.", "show vlan brief on " + (miss ? sw9(sim, miss) : "") + ": no VLAN " + B.id + "."),
    C("name", !miss && !!misname, "The backup VLAN on " + (misname ? sw9(sim, misname) : "") + " isn't named as the records say", "Named as the records say on all four.", "show vlan brief on " + (misname ? sw9(sim, misname) : "") + ".")];
}
/* the trunks it crosses: each access switch's two uplinks, both ends, and the bundle between the distribution switches */
function trunk9Causes(sim, v) {
  const p = v.plan, B = p.backup.id, ends = [];
  ["acc1", "acc2"].forEach(function (a) { [["dist1", "23"], ["dist2", "24"]].forEach(function (u) { ends.push({ id: a, n: "GigabitEthernet0/" + u[1], far: { id: u[0], n: "GigabitEthernet0/" + p.up[a] } }, { id: u[0], n: "GigabitEthernet0/" + p.up[a], far: { id: a, n: "GigabitEthernet0/" + u[1] } }); }); });
  const P = function (e) { return sim.d[e.id].sw.ports[e.n]; }, cr = function (e) { const f = P(e.far); return carries(Object.assign({}, sim.d[e.id].sw, { links: sim.switchLinks(e.id) }), e.n, { mode: f.mode, nonegotiate: f.nonegotiate }); };
  const who = function (e) { return e ? sw9(sim, e.id) + "'s port " + e.n.split("/")[1] : ""; };
  const no = ends.find(function (e) { return cr(e).tagged.indexOf(B) < 0; });
  const inList = function (q) { return !!q && (q.allowed === "all" || String(q.allowed).split(",").some(function (r) { const m = /^(\d+)(?:-(\d+))?$/.exec(r.trim()); return m && B >= +m[1] && B <= +(m[2] || m[1]); })); };
  const po = ["dist1", "dist2"].find(function (id) { const w = sim.d[id].sw, g = w.pcs && Object.keys(w.pcs)[0]; return !inList(g ? w.pcs[g] : w.ports["GigabitEthernet0/21"]); });
  return [C("trunk", !!no, who(no) + " doesn't carry the backup VLAN", "Every uplink carries it at both ends.", "show interfaces trunk on " + (no ? sw9(sim, no.id) : "") + ": VLAN " + B + " not allowed on port " + (no ? no.n.split("/")[1] : "") + "."),
    C("bundle", !no && !!po, "The bundle between the distribution switches doesn't carry the backup VLAN on " + (po ? said(sim, po) : "") + ": if the way up through one distribution switch goes, the other can't hand the frames across", "The bundle carries it.", "show interfaces trunk on " + (po ? said(sim, po) : "") + ": Po1, VLAN " + B + " not allowed.")];
}
/* a VLAN's spanning-tree root and the switch next in line */
function rootOf(sim, vid) {
  const all = sim.stpAll(), R = all[vid], root = R && R.result && R.result.root, sws = R ? R.sws : {};
  const ids = Object.keys(sws), rootId = ids.find(function (id) { return sws[id].mac === (root && root.mac) && sws[id].prio === root.prio; }) || (ids.length ? ids.slice().sort(function (a, b) { return cmpBid(sws[a], sws[b]); })[0] : null);
  return { rootId: rootId, second: ids.filter(function (id) { return id !== rootId; }).sort(function (a, b) { return cmpBid(sws[a], sws[b]); })[0] || null };
}
function stp9Causes(sim, v) {
  const B = v.plan.backup.id, t = rootOf(sim, B), r = t.rootId;
  return [C("nopath", !r, "The backup VLAN has no spanning tree: no switch carries it", "Distribution switch 1 is its root.", "show spanning-tree vlan " + B + ": not found."),
    C("access", r === "acc1" || r === "acc2", (r ? Cap(sw9(sim, r)) : "An access switch") + " is the backup VLAN's spanning-tree root: left at the defaults, the switch with the lowest address wins", "Distribution switch 1 is its root.", "show spanning-tree vlan " + B + " on " + (r ? sw9(sim, r) : "") + ": This bridge is the root."),
    C("dist2", r === "dist2", "Distribution switch 2 is the backup VLAN's root: every other VLAN's is switch 1", "Distribution switch 1 is its root.", "show spanning-tree vlan " + B + " on distribution switch 2: This bridge is the root."),
    C("backup", r === "dist1" && t.second !== "dist2", "Distribution switch 1 is the root, but distribution switch 2 isn't next in line: if switch 1 goes, an access switch takes over", "Distribution switch 2 is the backup.", "show spanning-tree vlan " + B + " on distribution switch 2: its priority.")];
}
/* the servers' four switch ports: port 1 (eno1) in the servers VLAN, port 2 (eno2) in the backup VLAN, edge ports with BPDU guard, described, open */
function ports9(sim, v) {
  const p = v.plan, out = [];
  SRVS.forEach(function (id) { const S = p.srv[id]; [["eno1", p.vlans.servers], ["eno2", p.backup]].forEach(function (q) { const n = "GigabitEthernet0/" + S.ports[q[0]]; out.push({ srv: id, nic: q[0], sw: S.sw, n: n, p: sim.d[S.sw].sw.ports[n], vlan: q[1], desc: id.toUpperCase() + "-" + q[1].name }); }); });
  return out;
}
function port9Causes(sim, v) {
  const rows = ports9(sim, v), at = function (r) { return r ? sw9(sim, r.sw) + "'s port " + r.n.split("/")[1] + " (" + srv9(r.srv) + "'s " + r.nic + ")" : ""; };
  const shut = rows.find(function (r) { return r.p.shutdown || errDisabled(sim.d[r.sw].sw, r.n); }), vl = rows.find(function (r) { return r.p.mode !== "access" || r.p.access !== r.vlan.id; });
  const edge = rows.find(function (r) { return !(r.p.stp && r.p.stp.portfast && r.p.stp.bpduguard); }), desc = rows.find(function (r) { return String(r.p.desc).toUpperCase() !== r.desc; });
  return [C("shut", !!shut, Cap(at(shut)) + " is shut", "All four are open.", "show interfaces status on " + (shut ? sw9(sim, shut.sw) : "") + ": Gi0/" + (shut ? shut.n.split("/")[1] : "") + " disabled."),
    C("vlan", !shut && !!vl, Cap(at(vl)) + " isn't an access port in the " + (vl ? (vl.nic === "eno1" ? "servers" : "backup") : "") + " VLAN", "Each is an access port in its VLAN.", "show interfaces status on " + (vl ? sw9(sim, vl.sw) : "") + ": Gi0/" + (vl ? vl.n.split("/")[1] : "") + "."),
    C("edge", !shut && !vl && !!edge, Cap(at(edge)) + " isn't an edge port with BPDU guard, as every port facing one computer here is", "Each is an edge port with BPDU guard.", "show running-config on " + (edge ? sw9(sim, edge.sw) : "") + ": interface gi0/" + (edge ? edge.n.split("/")[1] : "") + "."),
    C("desc", !shut && !vl && !edge && !!desc, Cap(at(desc)) + " isn't described as the records say", "Each is described as the records say.", "show interfaces status on " + (desc ? sw9(sim, desc.sw) : "") + ": Gi0/" + (desc ? desc.n.split("/")[1] : "") + "'s name.")];
}
const reach9 = function (sim, from, ip) { const r = sim.route(from, ip); return !r.fail && !!(r.local || r.routed); };
function online9Causes(sim, v) {
  const S = v.plan.srv, link = !sim.ifAddr("bksrv", 0);
  const sd = !link && !reach9(sim, "sd1", S.bksrv.ip), fs = !link && !sd && !reach9(sim, "bksrv", S.fsrv.ip);
  return [C("link", link, "The backup server's port 1 (eno1) has no link", "It has a link.", "ip a on the backup server: eno1 NO-CARRIER, state DOWN."),
    C("sd", sd, "The service desk PC gets no answer from the backup server on the servers network", "The service desk reaches it.", "ping the backup server's address from the service desk PC: no reply."),
    C("files", fs, "The backup server can't reach the file server on the servers network", "It reaches the file server.", "ping the file server's address from the backup server: no reply.")];
}
/* the backup network at the ordinary size, both ways */
function bknet9Causes(sim, v) {
  const S = v.plan.srv, down = SRVS.find(function (id) { return !sim.ifAddr(id, 1); });
  const way = !down && SRVS.find(function (id) { return !sim.sized(id, S[other9(id)].bip, 84, false).ok; });
  return [C("link", !!down, Cap(srv9(down)) + "'s port 2 (eno2) has no link", "Both backup ports have a link.", "ip a on " + srv9(down) + ": eno2 NO-CARRIER, state DOWN."),
    C("way", !!way, "The servers' backup ports can't reach each other: the backup VLAN doesn't run all the way between them (a switch without it, a trunk that doesn't carry it, a port not in it)", "They reach each other.", "ping " + (way ? S[other9(way)].bip : "") + " from " + srv9(way) + ": no reply.")];
}
const jumboRun = function (sim, id) { return sim.d[id].sw.jumboRun || 1500; }, jumboSet = function (sim, id) { return sim.d[id].sw.jumbo || 1500; };
function jumbo9Causes(sim, v) {
  const f = BK_ON.find(function (id) { return jumboRun(sim, id) < BK_MTU; }), set = f ? jumboSet(sim, f) : 0;
  return [C("none", !!f && set === 1500, Cap(f ? sw9(sim, f) : "") + " still passes only 1500-byte frames: no jumbo MTU set", "Every switch on the way passes jumbo frames.", "show system mtu on " + (f ? sw9(sim, f) : "") + ": System Jumbo MTU size is 1500 bytes."),
    C("small", !!f && set > 1500 && set < BK_MTU, Cap(f ? sw9(sim, f) : "") + "'s jumbo MTU is set below " + BK_MTU + " bytes", "Every switch on the way takes " + BK_MTU + ".", "show system mtu on " + (f ? sw9(sim, f) : "") + "."),
    C("wait", !!f && set >= BK_MTU, Cap(f ? sw9(sim, f) : "") + " has its jumbo MTU set, but it takes effect only at its next reload", "Every switch on the way has reloaded with it.", "show system mtu on " + (f ? sw9(sim, f) : "") + ": On next reload, System Jumbo MTU will be " + set + " bytes.")];
}
function mtu9Causes(sim, v) {
  const m = function (id, j) { return sim.ifMtu(id, j); }, bad = SRVS.find(function (id) { return m(id, 1) !== BK_MTU; }), one = SRVS.find(function (id) { return m(id, 0) !== 1500; });
  return [C("eno2", !!bad, Cap(srv9(bad)) + "'s backup port (eno2) has an MTU of " + (bad ? m(bad, 1) : "") + ", not " + BK_MTU, "Both backup ports are at " + BK_MTU + ".", "ip link show eno2 on " + srv9(bad) + ": mtu " + (bad ? m(bad, 1) : "") + "."),
    C("eno1", !bad && !!one, Cap(srv9(one)) + "'s own port (eno1) has its MTU changed: the servers network, its gateway and its users stay at 1500", "Both servers' own ports stay at 1500.", "ip link show eno1 on " + srv9(one) + ": mtu " + (one ? m(one, 0) : "") + ".")];
}
/* a 9000-byte packet that mustn't be cut up, both ways: what ping -M do -s 8972 says */
function big9Causes(sim, v) {
  const S = v.plan.srv, rs = SRVS.map(function (id) { return { id: id, r: sim.sized(id, S[other9(id)].bip, BK_MTU, true) }; }), bad = rs.find(function (q) { return !q.r.ok; }), r = bad ? bad.r : {}, from = bad ? srv9(bad.id) : "", to = bad ? srv9(other9(bad.id)) : "";
  const at = r.at && r.at.port ? sw9(sim, r.at.dev) : "";
  return [C("local", r.why === "local", Cap(from) + " won't send it: its backup port's MTU is smaller (ping says message too long)", "Both send it whole.", "ping -M do -s 8972 from " + from + ": local error: message too long, mtu=" + (r.mtu || "") + "."),
    C("giant", r.why === "giant", Cap(at) + " drops it on the way from " + from + ": it's over that switch's MTU", "No switch drops it.", "ping -M do -s 8972 from " + from + ": 100% packet loss; show interfaces " + (r.at && r.at.port ? r.at.port.replace("GigabitEthernet", "gi") : "") + " on " + at + ": giants."),
    C("recv", r.why === "receiver" || r.why === "sender", Cap(r.why === "sender" ? from : to) + " drops it as it arrives: its backup port's MTU is smaller", "Both take it.", "ip -s link show eno2 on " + (r.why === "sender" ? from : to) + ": RX errors."),
    C("other", !!bad && !/^(local|giant|receiver|sender)$/.test(r.why), "It doesn't get from " + from + " to " + to + " at all", "It gets through both ways.", "ping " + (bad ? S[other9(bad.id)].bip : "") + " from " + from + ": no reply.")];
}
/* what a restart keeps: each server's netplan file, each switch's saved configuration */
function persist9Causes(sim, v) {
  const np = SRVS.find(function (id) { const e = sim.d[id].lx.netplan.eno2; return !e || e.mtu !== BK_MTU; }), sw = BK_ON.find(function (id) { const st = sim.d[id].sw.startup; return !st || !(st.jumbo >= BK_MTU); });
  return [C("netplan", !!np, Cap(srv9(np)) + "'s " + BK_MTU + " isn't in its netplan file: set with ip link alone, it's gone at the next reboot", "Both servers keep it in their netplan.", "sudo netplan get ethernets.eno2.mtu on " + srv9(np) + ": " + (np && sim.d[np].lx.netplan.eno2 && sim.d[np].lx.netplan.eno2.mtu || "null") + "."),
    C("switch", !np && !!sw, Cap(sw ? sw9(sim, sw) : "") + "'s jumbo MTU isn't saved: at its next reload it starts at 1500 again", "Every switch has it saved.", "show startup-config on " + (sw ? sw9(sim, sw) : "") + ": no system mtu jumbo.")];
}
function fail9Causes(sim, v) {
  const S = v.plan.srv, s2 = copyOf(sim); power(s2, "dist1", false);
  const way = SRVS.find(function (id) { return !s2.sized(id, S[other9(id)].bip, 84, false).ok; }), big = !way && SRVS.find(function (id) { return !s2.sized(id, S[other9(id)].bip, BK_MTU, true).ok; });
  return [C("way", !!way, "With distribution switch 1 off, the servers can't reach each other on the backup network: the way through distribution switch 2 is missing it (the VLAN, an uplink)", "They still reach each other.", "Picture distribution switch 1 off: show interfaces trunk and show vlan brief on distribution switch 2."),
    C("big", !!big, "With distribution switch 1 off, " + BK_MTU + "-byte packets are dropped on the way through distribution switch 2", "Jumbo frames still get through.", "Picture distribution switch 1 off: show system mtu on distribution switch 2.")];
}
function saved9Causes(sim) { return BK_ON.map(function (id) { return C("unsaved-" + id, unsaved(sim.d[id].sw), Cap(sw9(sim, id)) + " hasn't been saved: a power cut takes the changes away", "All four are saved.", "show startup-config on " + sw9(sim, id) + ": it's not what's running."); }); }

const CJ9 = {
  id: "CP-J9", level: "campus", title: "Jumbo frames for the backup network: a backup server on another floor, 9000-byte frames all the way",
  already: ["works", "saved"],
  start(seed) {
    const b = CJ8.start(seed), sim = b.sim;
    for (const a of CJ8.solve(b.v, sim)) { if (a.t === "cmd") exec(sim, a.dev, a.line); else sim.apply(a); }
    fileServer(sim.net);   /* the file server in the data room since last month; the backup server is in its box */
    sim.cli = {};
    return { sim: sim, v: Object.assign({}, b.v, { runs: sim.net.extra.runs || 0 }) };
  },
  brief() { return { quote: "The file server's nightly backup runs past the morning now. We've bought a backup server and it's going in the 2F closet, so a fire in the data room can't take the files and their copy together. Give the two servers a backup network of their own, and make it jumbo: 9000-byte frames the whole way. Tonight's the maintenance window, so the switches can restart; nobody's networks change but the servers'.", from: "Rafiki, owner" }; },
  mason: "Jumbo frames are all or nothing: every switch the backup VLAN crosses, and both servers' backup ports, or the big frames vanish on the way without a word. Build the backup network at the ordinary size first, then make it big, then prove it with a big ping that mustn't be cut up.",
  limits: function (v) {
    const p = v.plan, B = p.backup, S = p.srv;
    return ["The backup server: " + S.bksrv.host + ", in its box; its place is the 2F closet's rack. Its port 1 (eno1) to the 2F access switch's port " + S.bksrv.ports.eno1 + ", its port 2 (eno2) to its port " + S.bksrv.ports.eno2 + ". The supplier set it up from the records: eno1 " + S.bksrv.ip + "/24 (gateway " + p.vlans.servers.gw + "), eno2 " + S.bksrv.bip + "/24 with no gateway. Log in as " + S.user + ", password " + S.pw + " (the same on both servers; sudo asks for it too).",
      "The file server: " + S.fsrv.host + ", in the data room's rack: eno1 " + S.fsrv.ip + " on the 1F access switch's port " + S.fsrv.ports.eno1 + " (the servers VLAN), eno2 " + S.fsrv.bip + " cabled to its port " + S.fsrv.ports.eno2 + ".",
      "The backup VLAN: " + B.id + ", named " + B.name + ", " + B.net + "/24. Not routed: no gateway, no interface on any switch. It runs from the 1F access switch up both its uplinks, across the bundle between the distribution switches, and down both the 2F access switch's uplinks; distribution switch 1 its spanning-tree root, switch 2 the backup.",
      "The servers' switch ports: each server's port 1 an access port in the servers VLAN (" + p.vlans.servers.id + "), its port 2 an access port in the backup VLAN, each an edge port with BPDU guard, described FSRV-SERVERS, FSRV-BACKUP, BKSRV-SERVERS and BKSRV-BACKUP.",
      "Jumbo frames: " + B.mtu + "-byte packets on the backup network. Each server's eno2 at MTU " + B.mtu + ", kept in its netplan file (" + "/etc/netplan/50-cloud-init.yaml" + "); every switch the backup VLAN crosses passing them (system mtu jumbo " + B.mtu + " or more: it takes effect at a reload, and tonight they can reload). Each server's eno1, and every other network, stays at 1500.",
      "The test: from one server, ping -M do -s 8972 the other's backup address. 8972 bytes of data, 8 of ICMP header and 20 of IP header make " + B.mtu + "; -M do says it mustn't be cut up on the way.",
      "The switches are locked as every switch here: enable secret " + p.secret + ", console password " + p.console + ", SSH with the user " + p.user + ", password " + p.userPw + ". Your laptop's console cable is 1.8 m: the 1F access switch and the distribution switches from the data room, the 2F access switch from the 2F closet. Each server's own console is on its tab."];
  },
  reqs: [
    { id: "rack", text: "The backup server is racked in the 2F closet, its two ports cabled to the 2F access switch as the records say", causes: rack9Causes,
      ok: function () { return "The backup server is racked; both its ports are on the records' ports."; },
      rung1: function () { return "The Cable runs table, and the van list."; },
      rung2: function () { return "A server's two ports go to two different switch ports: which is which matters, because each port is set up for its own network."; } },
    { id: "vlan", text: "The backup VLAN exists, named as the records say, on every switch it crosses: both access switches and both distribution switches", causes: vlan9Causes,
      ok: function () { return "The backup VLAN exists and is named on all four."; },
      rung1: function () { return "show vlan brief on each of the four."; },
      rung2: function () { return "A VLAN only exists on a switch it's been made on, even one that only passes it along."; } },
    { id: "trunks", text: "The trunks it crosses carry it: both access switches' uplinks at both ends, and the bundle between the distribution switches", causes: trunk9Causes,
      ok: function () { return "Every uplink on the way carries the backup VLAN at both ends; so does the bundle."; },
      rung1: function () { return "show interfaces trunk on both access switches and both distribution switches."; },
      rung2: function () { return "A trunk carries only the VLANs its allowed list names, at both ends: a VLAN left off any hop stops there."; } },
    { id: "stp", text: "The backup VLAN's spanning-tree root is distribution switch 1, distribution switch 2 the backup", causes: stp9Causes,
      ok: function () { return "Distribution switch 1 is the backup VLAN's root, switch 2 next in line."; },
      rung1: function () { return "show spanning-tree vlan on the access switches and both distribution switches, for the backup VLAN."; },
      rung2: function () { return "Every VLAN elects its own root; a new one, left at the defaults, goes to the lowest address, wherever that is."; } },
    { id: "ports", text: "Each server's switch ports: port 1 in the servers VLAN, port 2 in the backup VLAN, edge ports with BPDU guard, described, open", causes: port9Causes,
      ok: function () { return "All four server ports are open access ports in their VLANs, edge ports with BPDU guard, described."; },
      rung1: function () { return "show interfaces status on both access switches, and their running configuration for those ports."; },
      rung2: function () { return "Each of a server's two ports is on its own network: the switch port has to be in that network's VLAN."; } },
    { id: "online", text: "The backup server is on the servers network: the service desk reaches it, and it reaches the file server", causes: online9Causes,
      ok: function () { return "The backup server answers from the service desk, and reaches the file server."; },
      rung1: function () { return "ip a and ip route on the backup server; ping it from the service desk PC."; },
      rung2: function () { return "A server's address comes with it; what it needs from the network is a link, and the right VLAN on its switch port."; } },
    { id: "bknet", text: "The two servers reach each other on the backup network", causes: bknet9Causes,
      ok: function () { return "Each server reaches the other's backup address."; },
      rung1: function () { return "ip a on each server, then ping the other's backup address."; },
      rung2: function () { return "A network that isn't routed has no gateway to help: both ports have to be in the same VLAN, joined all the way at layer 2."; } },
    { id: "jumbo", text: "Every switch the backup VLAN crosses passes jumbo frames, " + BK_MTU + " bytes or more, in effect now", causes: jumbo9Causes,
      ok: function () { return "All four switches have reloaded with a jumbo MTU of " + BK_MTU + " or more."; },
      rung1: function () { return "show system mtu on each of the four."; },
      rung2: function () { return "A layer 2 switch can't cut a frame up: one too big for any switch on the way is simply dropped. And on these switches a new jumbo MTU waits for a reload."; } },
    { id: "mtu", text: "Each server's backup port (eno2) has an MTU of " + BK_MTU + "; their own ports (eno1) stay at 1500", causes: mtu9Causes,
      ok: function () { return "Both backup ports are at " + BK_MTU + "; both servers' own ports at 1500."; },
      rung1: function () { return "ip link on each server."; },
      rung2: function () { return "Both ends of a link have to agree on the largest packet: the computer at each end decides what it sends and what it takes."; } },
    { id: "big", text: "A " + BK_MTU + "-byte packet crosses the backup network both ways without being cut up", causes: big9Causes,
      ok: function () { return "ping -M do -s 8972 gets through both ways."; },
      rung1: function () { return "ping -M do -s 8972 from each server to the other's backup address; show interfaces on the switches for giants."; },
      rung2: function () { return "The data you ask ping for is only part of the packet: the ICMP header and the IP header go on top (eight bytes and twenty), and the whole packet has to fit the MTU of every port and switch on the way. With the don't-fragment bit, the first thing too small to pass it drops it."; } },
    { id: "persist", text: "It survives a restart: each server keeps " + BK_MTU + " in its netplan file, and every switch has its jumbo MTU saved", causes: persist9Causes,
      ok: function () { return "Both netplan files have it; all four switches have it saved."; },
      rung1: function () { return "sudo netplan get ethernets.eno2.mtu on each server; show startup-config on each switch."; },
      rung2: function () { return "What ip link sets lives until the next reboot; a server starts up from its netplan file, a switch from its saved configuration."; } },
    { id: "fail", text: "If distribution switch 1 fails, the backup network still runs, jumbo frames and all", causes: fail9Causes,
      ok: function () { return "With distribution switch 1 off, the backup network runs through switch 2, jumbo frames and all."; },
      rung1: function () { return "Picture distribution switch 1 off: show vlan brief, show interfaces trunk and show system mtu on distribution switch 2."; },
      rung2: function () { return "Spanning tree finds the other way round when a switch fails: that way has to be ready too, the VLAN and the size."; } },
    { id: "works", text: "Everyone else still works: every PC online, both printers and every switch answering", causes: reachCauses,
      ok: function () { return "Every PC is online; both printers and every switch answer."; },
      rung1: function () { return "ping 8.8.8.8 from each PC; the printers and the switches from the service desk."; },
      rung2: function () { return "A reload takes a switch away for a moment: everything should come back on its own, from what's saved."; } },
    { id: "saved", text: "Both access switches and both distribution switches are saved", causes: saved9Causes,
      ok: function () { return "All four are saved."; }, rung1: function () { return "show startup-config against show running-config on each."; }, rung2: function () { return "Only what's saved survives a power cut, or a reload."; } }
  ],
  solve(v, sim) {
    const p = v.plan, B = p.backup, S = p.srv, out = [], n = sim ? sim.net.extra.runs || 0 : v.runs || 0;
    let k = 0; const lay = function (a, b) { k++; out.push({ t: "lay", a: a, b: b }); return n + k; };
    const c = function (l) { out.push({ t: "cmd", dev: "tech", line: l, cli: true }); };
    const login = function () { [""].concat([p.console, "enable", p.secret, "configure terminal"]).forEach(c); };
    const save = function () { c("end"); c("copy running-config startup-config"); c(""); };
    const reload = function () { c("reload"); c(""); };   /* saved first, so it only asks to proceed */
    let con = 0; const consoleTo = function (dev) { if (con) out.push({ t: "pull", cable: "c-console-" + con }); con = lay({ dev: "tech", port: "USB-C" }, { dev: dev, port: "CONSOLE" }); };
    const vlan = function () { c("vlan " + B.id); c("name " + B.name); c("exit"); };
    const port = function (id, nic, V) { c("interface gi0/" + S[id].ports[nic]); c("description " + id.toUpperCase() + "-" + V.name); c("switchport mode access"); c("switchport access vlan " + V.id); c("spanning-tree portfast"); c("spanning-tree bpduguard enable"); c("no shutdown"); c("exit"); };
    /* rack the backup server and cable it */
    out.push({ t: "place", dev: "bksrv", room: "c2" });
    ["eno1", "eno2"].forEach(function (nic) { lay({ dev: "bksrv", port: nic }, { dev: S.bksrv.sw, port: S.bksrv.ports[nic] }); });
    /* the 1F access switch: the VLAN, its uplinks, the file server's backup port, jumbo frames, then a reload */
    consoleTo("acc1"); login(); vlan();
    c("interface range gi0/23 - 24"); c("switchport trunk allowed vlan add " + B.id); c("exit");
    port("fsrv", "eno2", B); c("system mtu jumbo " + B.mtu); save(); reload();
    /* both distribution switches: the VLAN, the uplinks to the access switches, the bundle, the root, jumbo frames, a reload */
    ["dist1", "dist2"].forEach(function (id, i) {
      consoleTo(id); login(); vlan();
      c("interface range gi0/" + p.up.acc1 + " - " + p.up.acc2); c("switchport trunk allowed vlan add " + B.id); c("exit");
      c("interface port-channel 1"); c("switchport trunk allowed vlan add " + B.id); c("exit");
      c("spanning-tree vlan " + B.id + " root " + (i ? "secondary" : "primary"));
      c("system mtu jumbo " + B.mtu); save(); reload();
    });
    /* the 2F access switch, from the 2F closet */
    out.push({ t: "pull", cable: "c-console-" + con }); con = 0; out.push({ t: "place", dev: "tech", room: "c2" });
    consoleTo("acc2"); login(); vlan();
    c("interface range gi0/23 - 24"); c("switchport trunk allowed vlan add " + B.id); c("exit");
    port("bksrv", "eno1", p.vlans.servers); port("bksrv", "eno2", B); c("system mtu jumbo " + B.mtu); save(); reload();
    out.push({ t: "pull", cable: "c-console-" + con }); out.push({ t: "place", dev: "tech", room: "data" });
    /* each server: its backup port at 9000 in its netplan file, put into effect; then the big ping that mustn't be cut up */
    SRVS.forEach(function (id) { const L = function (l) { out.push({ t: "cmd", dev: id, line: l, cli: true }); };
      [""].concat([S.user, S.pw, "sudo netplan set ethernets.eno2.mtu=" + B.mtu, S.pw, "sudo netplan apply"]).forEach(L); });
    out.push({ t: "cmd", dev: "fsrv", line: "ping -M do -s 8972 -c 4 " + S.bksrv.bip, cli: true });
    return out;
  },
  answer(v) {
    const p = v.plan, B = p.backup, S = p.srv;
    return ["Place the backup server in the 2F closet; lay its port 1 (eno1) to the 2F access switch's port " + S.bksrv.ports.eno1 + " and its port 2 (eno2) to its port " + S.bksrv.ports.eno2 + ".",
      "From the data room, console into the 1F access switch: vlan " + B.id + " (name " + B.name + "); gi0/23 - 24, switchport trunk allowed vlan add " + B.id + "; gi0/" + S.fsrv.ports.eno2 + " an access port in VLAN " + B.id + " (description FSRV-BACKUP, portfast, BPDU guard, no shutdown); system mtu jumbo " + B.mtu + "; save; reload.",
      "Each distribution switch: vlan " + B.id + "; its ports to the access switches (gi0/" + p.up.acc1 + " - " + p.up.acc2 + ") and interface port-channel 1, switchport trunk allowed vlan add " + B.id + "; spanning-tree vlan " + B.id + " root primary (switch 1) or secondary (switch 2); system mtu jumbo " + B.mtu + "; save; reload.",
      "From the 2F closet, the 2F access switch: the VLAN, the uplinks, gi0/" + S.bksrv.ports.eno1 + " in the servers VLAN (BKSRV-SERVERS) and gi0/" + S.bksrv.ports.eno2 + " in the backup VLAN (BKSRV-BACKUP), each an edge port with BPDU guard; system mtu jumbo " + B.mtu + "; save; reload.",
      "On each server's console: log in, sudo netplan set ethernets.eno2.mtu=" + B.mtu + ", sudo netplan apply. Then from one server, ping -M do -s 8972 the other's backup address."];
  },
  summary() { return ["The backup server is racked in the 2F closet, on another floor from the files it copies, and on the servers network.", "The two servers have a backup network of their own: a VLAN from the 1F access switch, across both distribution switches, to the 2F access switch, with distribution switch 1 its root.", "It carries 9000-byte frames all the way: both servers' backup ports in their netplan files, every switch on the way reloaded with a jumbo MTU, and it still runs through distribution switch 2 if switch 1 fails."]; }
};

/* ------------------------------------------------------------ work order 10: the central DHCP server */
/* every network the edge router hands out for today: its VLAN, its desks, the switches that relay its requests */
const POOLS10 = function (p) { return [
  { k: "svc", say: "the service desk network", V: p.vlans.svc, pcs: ["sd1", "hd1"], relays: ["dist1", "dist2"] },
  { k: "bench", say: "the bench network", V: p.vlans.bench, pcs: ["bn1", "bn2"], relays: ["dist1", "dist2"] },
  { k: "office", say: "the office network", V: p.vlans.office, pcs: ["mgr", "fin"], relays: ["dist1", "dist2"] },
  { k: "train", say: "the training network", V: p.train, pcs: ["tr1", "tr2"], relays: ["dist1", "dist2"] },
  { k: "cls", say: "the Annex classroom's network", V: p.annex.cls, pcs: ["cl1", "cl2"], relays: ["anxc"] }]; };
const host10 = function (V, h) { return V.net.replace(/\.0$/, "." + h); };
const F10 = function (sim, path) { const F = sim.d.fsrv.lx.files || {}; return F[path] ? F[path].text : ""; };
const conf10 = function (sim) { return DH.parse(F10(sim, DH.CONF)); };
const D10 = function (sim) { return sim.d.fsrv.lx.dhcpd; };
const subFor = function (c, P) { return c.subnets.find(function (S) { return S.net === P.V.net; }) || null; };
const pcSay = function (sim, id) { return sim.d[id].label.replace(/^[A-Z](?=[a-z])/, function (m) { return m.toLowerCase(); }); };
function conf10Causes(sim, v) {
  const p = v.plan, c = conf10(sim), e = c.errors[0], live = c.subnets.length > 0, miss = !e && live && POOLS10(p).find(function (P) { return !subFor(c, P); });
  const own = !e && live && !miss && !c.subnets.some(function (S) { return S.net === p.vlans.servers.net; });
  return [C("syntax", !!e, "The DHCP server can't read its file: line " + (e ? e.line : "") + ", " + (e ? e.msg : ""), "It reads the file.", "dhcpd -t -cf " + DH.CONF + ": " + DH.CONF + " line " + (e ? e.line + ": " + e.msg : "") + "."),
    C("sample", !e && !live, "The DHCP server's file is still the package's sample: every subnet in it is commented out", "The file declares subnets of its own.", "cat " + DH.CONF + ": every subnet line starts with #."),
    C("missing", !!miss, "The file declares no subnet for " + (miss ? miss.say : ""), "Every network the edge router hands out for has its subnet.", "cat " + DH.CONF + ": no subnet " + (miss ? miss.V.net : "") + "."),
    C("own", own, "The file has no subnet declaration for the server's own network, the one its port 1 (eno1) is on: dhcpd won't listen on a port whose network it doesn't know", "Its own network is declared.", "journalctl -u isc-dhcp-server: No subnet declaration for eno1.")];
}
function pools10Causes(sim, v) {
  const p = v.plan, c = conf10(sim), rows = c.errors.length ? [] : POOLS10(p).map(function (P) { const S = subFor(c, P); return S ? { P: P, S: S, o: DH.leaseOpts(c, S, null) } : null; }).filter(Boolean);
  const lo = function (r) { return Math.min.apply(null, r.S.ranges.map(function (q) { return ip2n(q[0]); })); }, hi = function (r) { return Math.max.apply(null, r.S.ranges.map(function (q) { return ip2n(q[1]); })); };
  const none = rows.find(function (r) { return !r.S.ranges.length; }), kept = !none && rows.find(function (r) { return lo(r) < ip2n(host10(r.P.V, p.excl + 1)); });
  const small = !none && !kept && rows.find(function (r) { return lo(r) > ip2n(host10(r.P.V, p.excl + 1)) || hi(r) < ip2n(host10(r.P.V, 254)); });
  const noRt = rows.find(function (r) { return !r.o.routers.length; }), own = !noRt && rows.find(function (r) { return r.o.routers[0] !== r.P.V.gw && r.P.k !== "cls" && (r.o.routers[0] === host10(r.P.V, 2) || r.o.routers[0] === host10(r.P.V, 3)); });
  const wrongRt = !noRt && !own && rows.find(function (r) { return r.o.routers[0] !== r.P.V.gw; });
  const named = rows.find(function (r) { return !r.o.dns.length; }), dns = !named && rows.find(function (r) { return r.o.dns.join(",") !== p.dns.join(","); });
  const lease = rows.find(function (r) { return r.o.secs !== p.dhcp.lease; }), at = function (r) { return r ? r.P.say : ""; };
  const nosub = c.errors.length ? POOLS10(p)[0] : POOLS10(p).find(function (P) { return !subFor(c, P); });
  return [C("nosub", !!nosub, "There's nothing to hand out for " + (nosub ? nosub.say : "") + " yet: the file has no subnet for it" + (c.errors.length ? " it can read" : ""), "Every network has its subnet.", "cat " + DH.CONF + ": no subnet " + (nosub ? nosub.V.net : "") + "."),
    C("range", !!none, Cap(at(none)) + "'s subnet has no range: there's nothing in it to hand out", "Every subnet has its range.", "cat " + DH.CONF + ": subnet " + (none ? none.P.V.net : "") + " has no range line."),
    C("kept", !!kept, Cap(at(kept)) + "'s range reaches into the first twenty addresses, kept back for the gateway and the gear", "Every range keeps the first twenty back.", "cat " + DH.CONF + ": the range in subnet " + (kept ? kept.P.V.net : "") + "."),
    C("small", !!small, Cap(at(small)) + "'s range isn't the records' twenty-first to the last: a range that small runs out", "Every range is the records'.", "cat " + DH.CONF + ": the range in subnet " + (small ? small.P.V.net : "") + "."),
    C("routers", !!noRt, Cap(at(noRt)) + "'s leases carry no default gateway (no routers option): its PCs can't leave their own network", "Every lease carries its gateway.", "cat " + DH.CONF + ": no option routers for subnet " + (noRt ? noRt.P.V.net : "") + "."),
    C("own", !!own, Cap(at(own)) + "'s routers option is one distribution switch's own address, not the gateway the two share: if that switch fails, its PCs lose their way out", "Every routers option is the shared gateway.", "cat " + DH.CONF + ": option routers " + (own ? own.o.routers[0] : "") + "."),
    C("wrongrt", !!wrongRt, Cap(at(wrongRt)) + "'s routers option isn't its gateway", "Every routers option is its network's gateway.", "cat " + DH.CONF + ": option routers " + (wrongRt ? wrongRt.o.routers[0] : "") + "."),
    C("dnsnamed", !!named, Cap(at(named)) + "'s leases carry no DNS servers the PCs can use" + (named && named.o.dnsNamed ? ": the sample's names, which nobody here can look up" : ""), "Every lease carries the campus's DNS servers.", "cat " + DH.CONF + ": option domain-name-servers."),
    C("dns", !!dns, Cap(at(dns)) + "'s DNS servers aren't the campus's two", "Every lease carries the campus's two.", "cat " + DH.CONF + ": option domain-name-servers " + (dns ? dns.o.dns.join(", ") : "") + "."),
    C("lease", !!lease, "Leases last " + (lease ? lease.o.secs : "") + " seconds" + (lease && lease.o.secs === 600 ? " (the sample's ten minutes)" : "") + ", not a day as the records say", "Leases last a day.", "cat " + DH.CONF + ": default-lease-time.")];
}
function resv10Causes(sim, v) {
  const p = v.plan, R = p.dhcp.resv, c = conf10(sim), m = DH.macNorm(sim.d[R.dev].ifaces[0].mac), hs = c.errors.length ? [] : c.hosts;
  const byIp = hs.find(function (h) { return h.ip === R.ip; }), byMac = hs.find(function (h) { return h.mac === m; });
  const S = subnetFor(c, R.ip), inRange = !!S && S.ranges.some(function (q) { return ip2n(R.ip) >= ip2n(q[0]) && ip2n(R.ip) <= ip2n(q[1]); });
  return [C("none", !byIp && !byMac, "The file reserves nothing for the help desk PC", "It has its reservation.", "cat " + DH.CONF + ": no host declaration."),
    C("mac", !!byIp && byIp.mac !== m, "The reservation's hardware address isn't the help desk PC's", "It's the help desk PC's.", "ipconfig /all on the help desk PC: its Physical Address, against the host declaration's hardware ethernet."),
    C("ip", !byIp && !!byMac, "The help desk PC's reservation isn't the records' address", "It's the records' address.", "cat " + DH.CONF + ": fixed-address " + (byMac ? byMac.ip : "") + "."),
    C("range", !!byIp && byIp.mac === m && inRange, "The reserved address is inside the range too: the server could lend it to someone else", "It's outside the range.", "dhcpd -t: Dynamic and static leases present for " + R.ip + ".")];
}
const subnetFor = function (c, ip) { return c.errors.length ? null : DH.subnetOf(c, ip); };
function listen10Causes(sim, v) {
  const L = DH.interfacesOf(F10(sim, DH.DEFAULTS)), have = sim.d.fsrv.ifaces.map(function (f) { return f.name; }), bad = L.find(function (n) { return have.indexOf(n) < 0; });
  return [C("empty", !L.length, "The DHCP server is set to listen on every port (INTERFACESv4 is empty): the backup network's too", "It listens on eno1 only.", "cat " + DH.DEFAULTS + ": INTERFACESv4=\"\"."),
    C("nodev", !!bad, "INTERFACESv4 names " + (bad || "") + ", which this server doesn't have", "It names eno1.", "ip -br a on the file server: its ports are eno1 and eno2."),
    C("eno1", !bad && L.length > 0 && L.indexOf("eno1") < 0, "INTERFACESv4 leaves out eno1, the port the relays' requests arrive on", "It names eno1.", "cat " + DH.DEFAULTS + "."),
    C("eno2", !bad && L.indexOf("eno2") >= 0, "INTERFACESv4 includes eno2 as well, the backup network: no desk is there to serve", "It names eno1 only.", "cat " + DH.DEFAULTS + ".")];
}
function running10Causes(sim, v) {
  const S = D10(sim), why = S.why === "conf" ? "it can't read its file" : S.why === "nodev" ? "INTERFACESv4 names a port it doesn't have" : "it found no port to listen on (no subnet declared for eno1's network)";
  const stale = S.state === "active" && S.run && (S.run.file !== F10(sim, DH.CONF) || S.run.defaults !== F10(sim, DH.DEFAULTS));
  return [C("off", S.state === "inactive", "The DHCP server isn't running", "It's running.", "systemctl status isc-dhcp-server: inactive (dead)."),
    C("failed", S.state === "failed", "The DHCP server tried to start and stopped: " + why, "It's running.", "systemctl status isc-dhcp-server: failed; journalctl -u isc-dhcp-server says why."),
    C("stale", stale, "The DHCP server is running from an older copy of its files: it reads them only as it starts", "It's running the files as they are now.", "systemctl status isc-dhcp-server: running since before the file was last written (ls -l /etc/dhcp)."),
    C("disabled", !S.enabled, "The DHCP server isn't enabled: at the next restart it stays off", "It's enabled.", "systemctl is-enabled isc-dhcp-server: disabled.")];
}
function relays10(sim, v) {
  const p = v.plan, out = [];
  POOLS10(p).forEach(function (P) { P.relays.forEach(function (id) { const r = (sim.d[id].sw.svis || {})[P.V.id]; out.push({ P: P, id: id, h: (r && r.helpers) || [] }); }); });
  return out;
}
function relays10Causes(sim, v) {
  const S = v.plan.srv.fsrv, rows = relays10(sim, v), at = function (r) { return r ? said(sim, r.id) + "'s relay for " + r.P.say : ""; };
  const none = rows.find(function (r) { return !r.h.length; }), bip = !none && rows.find(function (r) { return r.h.indexOf(S.bip) >= 0 && r.h.indexOf(S.ip) < 0; });
  const miss = !none && !bip && rows.find(function (r) { return r.h.indexOf(S.ip) < 0; }), other = !none && !bip && !miss && rows.find(function (r) { return r.h.some(function (h) { return h !== S.ip; }); });
  return [C("none", !!none, Cap(at(none)) + " is gone: nothing sends its requests on", "Every relay is there.", "show running-config on " + (none ? said(sim, none.id) : "") + ": interface Vlan" + (none ? none.P.V.id : "") + " has no ip helper-address."),
    C("bip", !!bip, Cap(at(bip)) + " sends to the file server's backup address: the backup network isn't routed, so nothing gets there", "Every relay sends to the server's own address.", "show running-config on " + (bip ? said(sim, bip.id) : "") + ": ip helper-address " + S.bip + "."),
    C("miss", !!miss, Cap(at(miss)) + " doesn't send to the file server", "Every relay sends to the file server.", "show running-config on " + (miss ? said(sim, miss.id) : "") + ": ip helper-address " + (miss ? miss.h.join(", ") : "") + "."),
    C("other", !!other, Cap(at(other)) + " still sends to " + (other ? other.h.filter(function (h) { return h !== S.ip; }).join(", ") : "") + " as well: every request goes to the old server too", "Every relay sends to the file server alone.", "show running-config on " + (other ? said(sim, other.id) : "") + ": interface Vlan" + (other ? other.P.V.id : "") + ".")];
}
function edge10Causes(sim) {
  const R = sim.d.edge.sw, pools = Object.keys(R.pools || {}), ex = (R.excluded || []).length;
  return [C("pools", pools.length > 0, "The edge router still has DHCP pools (" + pools.join(", ") + "): two servers for the same networks, and a stale copy of the plan", "It has none.", "show ip dhcp pool on the edge router."),
    C("excl", !pools.length && ex > 0, "The edge router still keeps addresses back for pools it no longer has", "It keeps none back.", "show running-config on the edge router: ip dhcp excluded-address.")];
}
function leases10Causes(sim, v) {
  const p = v.plan, S = p.srv.fsrv, all = [];
  POOLS10(p).forEach(function (P) { P.pcs.forEach(function (id) { all.push({ id: id, P: P, l: sim.d[id].ifaces[0].lease }); }); });
  const none = all.find(function (r) { return !r.l; }), old = !none && all.find(function (r) { return r.l.server !== S.ip; });
  const gw = !none && !old && all.find(function (r) { return r.l.gw !== r.P.V.gw; }), dns = !none && !old && !gw && all.find(function (r) { return (r.l.dns || []).join(",") !== p.dns.join(","); });
  const hd = sim.d[p.dhcp.resv.dev].ifaces[0].lease, resv = !none && !old && !!hd && hd.ip !== p.dhcp.resv.ip;
  const at = function (r) { return r ? pcSay(sim, r.id) : ""; };
  return [C("none", !!none, "The " + at(none) + " has no address: its request gets no answer", "Every PC has its address.", "ipconfig on the " + at(none) + ": Autoconfiguration IPv4 Address 169.254...."),
    C("old", !!old, "The " + at(old) + " still holds the address the edge router lent it: it hasn't asked again since the file server took over", "Every PC's lease is the file server's.", "ipconfig /all on the " + at(old) + ": DHCP Server " + (old ? old.l.server : "") + "."),
    C("gw", !!gw, "The " + at(gw) + "'s lease from the file server has " + (gw && gw.l.gw ? "the wrong default gateway" : "no default gateway"), "Every lease has its gateway.", "ipconfig on the " + at(gw) + ": Default Gateway " + (gw ? gw.l.gw || "(none)" : "") + "."),
    C("dns", !!dns, "The " + at(dns) + "'s lease doesn't carry the campus's DNS servers", "Every lease carries them.", "ipconfig /all on the " + at(dns) + ": DNS Servers."),
    C("resv", resv, "The help desk PC isn't on its reserved address: it hasn't asked again since the reservation, or the reservation doesn't match it", "It's on its reserved address.", "ipconfig on the help desk PC: IPv4 Address " + (hd ? hd.ip : "") + ".")];
}
function fail10Causes(sim, v) {
  const p = v.plan, S = p.srv.fsrv, s2 = copyOf(sim); power(s2, "dist1", false);
  const rows = POOLS10(p).filter(function (P) { return P.relays.indexOf("dist1") >= 0; }).map(function (P) { const id = P.pcs[0]; s2.release(id); s2.dhcp(id, "renew"); const l = s2.d[id].ifaces[0].lease; return { P: P, id: id, l: l, out: !!l && !!s2.route(id, "8.8.8.8").internet }; });
  const none = rows.find(function (r) { return !r.l || r.l.server !== S.ip; }), stuck = !none && rows.find(function (r) { return !r.out; });
  return [C("relay", !!none, "With distribution switch 1 off, a PC on " + (none ? none.P.say : "") + " gets no address from the file server: distribution switch 2 doesn't send its requests there", "Distribution switch 2 relays every one.", "Picture distribution switch 1 off: show running-config on distribution switch 2, interface Vlan" + (none ? none.P.V.id : "") + "."),
    C("gw", !!stuck, "With distribution switch 1 off, " + (stuck ? stuck.P.say : "") + "'s PCs get an address but can't leave their network: their gateway goes with the switch", "They still get out through switch 2.", "Picture distribution switch 1 off: the routers option in " + DH.CONF + ".")];
}
const ON10 = ["dist1", "dist2", "anxc"];
function saved10Causes(sim) { return ON10.map(function (id) { return C("unsaved-" + id, unsaved(sim.d[id].sw), Cap(said(sim, id)) + " hasn't been saved", "Every switch and the router are saved.", "show startup-config on " + said(sim, id) + ": it's not what's running."); }).concat([C("unsaved-edge", unsaved(sim.d.edge.sw), "The edge router hasn't been saved", "It's saved.", "show startup-config on the edge router: it's not what's running.")]); }
/* the file the walk-through writes: every desk network's subnet, the server's own, the help desk PC's reservation */
function dhcpText10(v) {
  const p = v.plan, R = p.dhcp.resv, m = v.dh.mac;
  const L = ["# Rafiki's HQ and the Training Annex: one DHCP server for every desk network", "option domain-name-servers " + p.dns.join(", ") + ";", "default-lease-time " + p.dhcp.lease + ";", "max-lease-time " + p.dhcp.lease * 2 + ";", "ddns-update-style none;", "authoritative;", "",
    "# the servers network, this server's own (eno1): nothing handed out here", "subnet " + p.vlans.servers.net + " netmask " + p.mask + " {", "}", ""];
  POOLS10(p).forEach(function (P) { L.push("# " + P.say.replace(/^the /, ""), "subnet " + P.V.net + " netmask " + p.mask + " {", "  range " + host10(P.V, p.excl + 1) + " " + host10(P.V, 254) + ";", "  option routers " + P.V.gw + ";", "}", ""); });
  L.push("host help-desk-pc {", "  hardware ethernet " + m + ";", "  fixed-address " + R.ip + ";", "}", "");
  return L.join("\n");
}

const CJ10 = {
  id: "CP-J10", level: "campus", title: "The central DHCP server: every desk's address from the file server, the edge router out of the job",
  already: ["works", "saved"],
  start(seed) {
    const b = CJ9.start(seed), sim = b.sim;
    for (const a of CJ9.solve(b.v, sim)) { if (a.t === "cmd") exec(sim, a.dev, a.line); else sim.apply(a); }
    dhcpKit(sim.net);   /* isc-dhcp-server on the file server since last month, disabled until it's set up */
    sim.cli = {};
    const R = sim.d.edge.sw;   /* what the walk-through needs from the campus as it starts: the help desk PC's hardware address, the edge router's pools */
    return { sim: sim, v: Object.assign({}, b.v, { runs: sim.net.extra.runs || 0, dh: { mac: DH.macNorm(sim.d[b.v.plan.dhcp.resv.dev].ifaces[0].mac), pools: Object.keys(R.pools || {}), excl: (R.excluded || []).map(function (e) { return e.slice(); }) } }) };
  },
  brief() { return { quote: "Every pool on the edge router is one more thing the router does, and every new network means another pool on it. The installer put a DHCP server on the file server last month and never set it up. Move the lot onto it: every desk network handed out from one place, the relays pointed there, the router out of the job. And the help desk PC keeps one address for good: the remote-support tools are set up for it.", from: "Rafiki, owner" }; },
  mason: "A relay can only send a request somewhere that's listening. Build the server first and check what it says about itself, then move the relays, then take the old pools away, then have every desk ask again.",
  limits: function (v) {
    const p = v.plan, S = p.srv, R = p.dhcp.resv;
    return ["The DHCP server: isc-dhcp-server, put on the file server (" + S.fsrv.host + ", " + S.fsrv.ip + " on its port 1, eno1) by the installer last month and disabled until it's set up. Log in on its console (its tab) as " + S.user + ", password " + S.pw + "; sudo asks for it too. Its settings: " + DH.CONF + ". Which ports it serves on: INTERFACESv4 in " + DH.DEFAULTS + ", eno1 only, never the backup network. It starts at every boot.",
      "The pools: one for each network the edge router hands out for today. " + POOLS10(p).map(function (P) { return P.say.replace(/^the /, "") + " " + P.V.net + "/24 (gateway " + P.V.gw + ")"; }).join("; ") + ". Each hands out ." + (p.excl + 1) + " to .254, keeping the first twenty back for the gateway and the gear; its routers option is that gateway (on the HQ networks the address the two distribution switches share by standby; in the Annex, the Annex core's); DNS servers " + p.dns.join(" and ") + "; leases of a day (" + p.dhcp.lease + " seconds).",
      "The help desk PC keeps " + R.ip + " for good: a reservation on the DHCP server (a host declaration with its hardware address and that fixed address). Its hardware address is on the PC (ipconfig /all); dhcpd writes hardware addresses with colons.",
      "The relays: both distribution switches relay the HQ networks' requests (ip helper-address on each network's interface), the Annex core the classroom's; all of them to the file server's address, and nowhere else. Once the file server serves, the edge router hands out nothing: its pools and its excluded addresses come out.",
      "Every PC on those networks asks again (ipconfig /release, then ipconfig /renew) and gets its address from the file server.",
      "The switches and the router are locked as every one here: enable secret " + p.secret + ", console password " + p.console + ", SSH with the user " + p.user + ", password " + p.userPw + ". Your laptop's console cable is 1.8 m: the distribution switches and the edge router from the data room, the Annex core from the Annex's comms room."];
  },
  reqs: [
    { id: "conf", text: "The DHCP server's file declares a subnet for every network the edge router hands out for, and for its own", causes: conf10Causes,
      ok: function () { return "The file reads cleanly and declares every network, and the server's own."; },
      rung1: function () { return "cat the DHCP server's file, and dhcpd -t to check it."; },
      rung2: function () { return "dhcpd hands out only for the networks it's told about, and it only listens on a port whose own network is declared, even one it hands nothing out on."; } },
    { id: "pools", text: "Each network's subnet hands out the records' range, with its gateway, the campus's DNS servers and a day's lease", causes: pools10Causes,
      ok: function () { return "Every subnet's range, gateway, DNS servers and lease time are the records'."; },
      rung1: function () { return "The DHCP server's file, subnet by subnet, against the records."; },
      rung2: function () { return "A lease carries more than an address: the mask, the default gateway and the DNS servers all come from the server, and a PC uses whatever it's given."; } },
    { id: "resv", text: "The help desk PC has its reservation: its hardware address, the records' address, outside the range", causes: resv10Causes,
      ok: function () { return "The help desk PC's reservation is right."; },
      rung1: function () { return "ipconfig /all on the help desk PC, and the host declaration in the DHCP server's file."; },
      rung2: function () { return "A reservation is matched on the hardware address the PC sends; a fixed address should be one the range never lends."; } },
    { id: "listen", text: "The DHCP server serves on eno1 only", causes: listen10Causes,
      ok: function () { return "INTERFACESv4 names eno1 alone."; },
      rung1: function () { return "The file that says which ports the DHCP server serves on, and ip -br a."; },
      rung2: function () { return "Left empty, the server serves on every port it can; a server with a port on a network of its own should be told which port is for desks."; } },
    { id: "running", text: "The DHCP server is running, from its files as they are now, and starts at every boot", causes: running10Causes,
      ok: function () { return "It's running, from the files as they stand, and enabled."; },
      rung1: function () { return "systemctl status isc-dhcp-server, then journalctl -u isc-dhcp-server."; },
      rung2: function () { return "A service reads its settings as it starts: a change waits for a restart, and a start that fails says why in its log, not on the screen. Starting it and having it start at boot are two different settings."; } },
    { id: "relays", text: "Every relay sends to the file server, and only there: both distribution switches for the HQ networks, the Annex core for the classroom", causes: relays10Causes,
      ok: function () { return "Every relay sends to the file server alone."; },
      rung1: function () { return "show running-config on both distribution switches and the Annex core: each network's interface."; },
      rung2: function () { return "A PC's request is a broadcast that stops at its own network: the switch routing that network passes it on, as a unicast, to each address it's given, and only those."; } },
    { id: "edge", text: "The edge router hands out nothing: its pools and excluded addresses are gone", causes: edge10Causes,
      ok: function () { return "The edge router has no pools left."; },
      rung1: function () { return "show ip dhcp pool and show running-config on the edge router."; },
      rung2: function () { return "Two servers for one network is a fault waiting to happen: the old one comes out when the new one takes over."; } },
    { id: "leases", text: "Every PC on those networks holds a lease from the file server, with its gateway and DNS servers; the help desk PC its reserved address", causes: leases10Causes,
      ok: function () { return "Every PC's lease is the file server's; the help desk PC is on its reserved address."; },
      rung1: function () { return "ipconfig /all on each PC: its address, gateway, DNS servers and the DHCP server it came from."; },
      rung2: function () { return "A PC keeps the lease it has until it asks again; what it's given then is what the new server says."; } },
    { id: "fail", text: "If distribution switch 1 fails, every HQ desk still gets its address and its way out", causes: fail10Causes,
      ok: function () { return "With distribution switch 1 off, every HQ network still gets its leases through switch 2, and leaves by the shared gateway."; },
      rung1: function () { return "Picture distribution switch 1 off: show running-config on distribution switch 2, and the routers options in the DHCP server's file."; },
      rung2: function () { return "Both switches relay, so either can carry a request; and the gateway a lease hands out should be the one that moves when a switch fails."; } },
    { id: "works", text: "Everyone still works: every PC online, both printers and every switch answering", causes: reachCauses,
      ok: function () { return "Every PC is online; both printers and every switch answer."; },
      rung1: function () { return "ping 8.8.8.8 from each PC; the printers and the switches from the service desk."; },
      rung2: function () { return "Moving the server changes where a lease comes from, not what it should say."; } },
    { id: "saved", text: "Both distribution switches, the Annex core and the edge router are saved", causes: saved10Causes,
      ok: function () { return "All four are saved."; }, rung1: function () { return "show startup-config against show running-config on each."; }, rung2: function () { return "Only what's saved survives a power cut, or a reload."; } }
  ],
  solve(v, sim) {
    const p = v.plan, S = p.srv, out = [], n = sim ? sim.net.extra.runs || 0 : v.runs || 0, relay = coreLinks(p)[0].ia;
    let k = 0; const lay = function (a, b) { k++; out.push({ t: "lay", a: a, b: b }); return n + k; };
    const c = function (l) { out.push({ t: "cmd", dev: "tech", line: l, cli: true }); };
    const login = function () { [""].concat([p.console, "enable", p.secret, "configure terminal"]).forEach(c); };
    const save = function () { c("end"); c("copy running-config startup-config"); c(""); };
    let con = 0; const consoleTo = function (dev) { if (con) out.push({ t: "pull", cable: "c-console-" + con }); con = lay({ dev: "tech", port: "USB-C" }, { dev: dev, port: "CONSOLE" }); };
    const L = function (l, text) { const a = { t: "cmd", dev: "fsrv", line: l, cli: true }; if (text != null) a.text = text; out.push(a); };
    /* the server first: its file, its port, started and enabled */
    [""].concat([S.user, S.pw]).forEach(function (l) { L(l); });
    L("systemctl status isc-dhcp-server");
    L("sudo nano " + DH.CONF); L(S.pw); L("^O", dhcpText10(v)); L("^X");
    L("sudo nano " + DH.DEFAULTS); L("^O", DH.DEFAULTS_TEXT.replace("INTERFACESv4=\"\"", "INTERFACESv4=\"eno1\"")); L("^X");
    L("dhcpd -t -cf " + DH.CONF); L("sudo systemctl enable --now isc-dhcp-server"); L("systemctl status isc-dhcp-server");
    /* the relays: both distribution switches, then the edge router's pools out */
    ["dist1", "dist2"].forEach(function (id) { consoleTo(id); login(); POOLS10(p).filter(function (P) { return P.relays.indexOf(id) >= 0; }).forEach(function (P) { c("interface vlan " + P.V.id); c("no ip helper-address " + relay); c("ip helper-address " + S.fsrv.ip); c("exit"); }); save(); });
    consoleTo("edge"); login();
    v.dh.pools.forEach(function (nm) { c("no ip dhcp pool " + nm); });
    v.dh.excl.forEach(function (e) { c("no ip dhcp excluded-address " + e[0] + (e[1] && e[1] !== e[0] ? " " + e[1] : "")); });
    save();
    /* the Annex core, from the Annex's comms room */
    out.push({ t: "pull", cable: "c-console-" + con }); con = 0; out.push({ t: "place", dev: "tech", room: "acomms" });
    consoleTo("anxc"); login(); c("interface vlan " + p.annex.cls.id); c("no ip helper-address " + relay); c("ip helper-address " + S.fsrv.ip); c("exit"); save();
    out.push({ t: "pull", cable: "c-console-" + con }); out.push({ t: "place", dev: "tech", room: "data" });
    /* every desk asks again */
    POOLS10(p).forEach(function (P) { P.pcs.forEach(function (id) { out.push({ t: "cmd", dev: id, line: "ipconfig /release" }, { t: "cmd", dev: id, line: "ipconfig /renew" }); }); });
    return out;
  },
  answer(v) {
    const p = v.plan, S = p.srv, R = p.dhcp.resv;
    return ["On the file server's console: log in; sudo nano " + DH.CONF + ": the campus's DNS servers (option domain-name-servers " + p.dns.join(", ") + ";), default-lease-time " + p.dhcp.lease + ";, an empty subnet for the servers network (" + p.vlans.servers.net + "), and for each desk network a subnet with range ." + (p.excl + 1) + " to .254 and option routers its gateway; a host declaration for the help desk PC (hardware ethernet its address with colons, fixed-address " + R.ip + "); Ctrl+O, Ctrl+X.",
      "sudo nano " + DH.DEFAULTS + ": INTERFACESv4=\"eno1\". Check with dhcpd -t -cf " + DH.CONF + ", then sudo systemctl enable --now isc-dhcp-server, and systemctl status isc-dhcp-server.",
      "On each distribution switch, for each HQ desk network's interface: no ip helper-address (the edge router's), ip helper-address " + S.fsrv.ip + "; save. On the Annex core the same for the classroom's interface.",
      "On the edge router: no ip dhcp pool for each pool, no ip dhcp excluded-address for each line; save.",
      "On every desk PC: ipconfig /release, then ipconfig /renew."];
  },
  summary() { return ["One DHCP server for the whole campus: the file server hands out every desk network's addresses, each with its gateway, the campus's DNS servers and a day's lease, and starts at every boot.", "Both distribution switches and the Annex core relay to it, so a desk still gets its address if distribution switch 1 fails.", "The edge router is out of the job; the help desk PC keeps its address by reservation."]; }
};

export const CAMPUS_JOBS = [CJ1, CJ2, CJ3, CJ4, CJ5, CJ6, CJ7, CJ8, CJ9, CJ10];
