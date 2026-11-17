/* Level 4 build mode: the campus's work orders (Rafiki's HQ; the plan approved 16 November 2026: "Yes to the level 4 plans,
   build it out"). Each starts from the campus as the one before it left it. Every line is an ordered list of causes, as on
   the other levels: the first one really there is what the check saw, everything before it is ruled out by the network. */
import { makeCampus, coreLinks, installCore, coreCables } from "../net/campus.js";
import { Sim } from "../net/sim.js";
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
const said = function (sim, id) { return id === "dist1" || id === "dist2" ? DISTS.find(function (d) { return d[0] === id; })[1] : name(sim, id); };
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
function reachCauses(sim, v) {
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
  const noProc = ends.find(function (e) { return !runsOspf(sim, e.id); }), noNet = ends.find(function (e) { return runsOspf(sim, e.id) && !e.f; }), pas = ends.find(function (e) { return e.f && e.f.passive; });
  const both = ends[0].f && ends[1].f, link = Cap(sayOf(sim, l.a)) + " and " + sayOf(sim, l.b);
  return [C("proc", !!noProc, (noProc ? Cap(sayOf(sim, noProc.id)) : "A router") + " doesn't run OSPF", "Every router in the core runs OSPF.", noProc ? "show ip protocols on " + sayOf(sim, noProc.id) + ": nothing." : ""),
    C("net", !noProc && !!noNet, (noNet ? Cap(sayOf(sim, noNet.id)) + "'s link to " + sayOf(sim, noNet.id === l.a ? l.b : l.a) + " (" + noNet.g + ")" : "A link") + " isn't in OSPF: none of its network statements covers that interface's address", "Every link of the core is in OSPF at both ends.", noNet ? "show ip ospf interface brief on " + sayOf(sim, noNet.id) + ": " + noNet.g + " missing." : ""),
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
  already: ["works"],
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
      rung2: function () { return "A PC with a 169.254 address asked and nobody answered: follow the request from the desk to the pool."; } },
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

export const CAMPUS_JOBS = [CJ1, CJ2, CJ3, CJ4, CJ5, CJ6, CJ7];
