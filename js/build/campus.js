/* Level 4 build mode: the campus's work orders (Rafiki's HQ; the plan approved 16 November 2026: "Yes to the level 4 plans,
   build it out"). Each starts from the campus as the one before it left it. Every line is an ordered list of causes, as on
   the other levels: the first one really there is what the check saw, everything before it is ruled out by the network. */
import { makeCampus } from "../net/campus.js";
import { Sim } from "../net/sim.js";
import { errDisabled, dotMac, unsaved, chanState, carries } from "../net/swcli.js";
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
  brief() { return { quote: "Last month a visitor plugged a laptop into a socket on the service desk and was on our network in seconds, and someone on 2F brought in a little desk switch and the whole floor went down. Every desk port on all three floors needs locking to the device on it, and the network has to protect itself from anything plugged in where a desk should be." }; },
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

export const CAMPUS_JOBS = [CJ1, CJ2, CJ3];
