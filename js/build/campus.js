/* Level 4 build mode: the campus's work orders (Rafiki's HQ; the plan approved 16 November 2026: "Yes to the level 4 plans,
   build it out"). Each starts from the campus as the one before it left it. Every line is an ordered list of causes, as on
   the other levels: the first one really there is what the check saw, everything before it is ruled out by the network. */
import { makeCampus } from "../net/campus.js";
import { Sim } from "../net/sim.js";
import { errDisabled, dotMac, unsaved } from "../net/swcli.js";

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

export const CAMPUS_JOBS = [CJ1];
