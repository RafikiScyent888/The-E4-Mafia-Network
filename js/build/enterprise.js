/* Level 5 build mode: the enterprise's work orders (the plan approved 24 November 2026: "Yes to the Level 5 plan, build it out").
   Rafiki's IT Services has grown past one campus: the work starts from the campus as Level 4 left it (CP-J10 done) and takes it
   to the enterprise, smallest first. Every line is an ordered list of causes, as on the other levels: the first one really there is
   what the check saw, everything before it is ruled out by the network. */
import { CAMPUS_JOBS, reachCauses, said } from "./campus.js";
import { coreLinks, svcKit, monKit } from "../net/campus.js";
import { exec } from "../net/cmd.js";
import { unsaved, saveConfig, spanDest, LEVELS3, snmpKey } from "../net/swcli.js";
import * as MON from "../net/mon.js";
import * as SV from "../net/svc.js";

const C = function (id, on, text, not, ev) { return { id: id, on: !!on, text: text, not: not, ev: ev }; };
const Cap = function (t) { return t.replace(/^./, function (m) { return m.toUpperCase(); }); };
const CJ10 = CAMPUS_JOBS.find(function (d) { return d.id === "CP-J10"; });

/* ------------------------------------------------------------ EN-J1, time and logs for the whole network */
/* every switch and router on the campus, and the address a technician reaches each one at (the records' management addresses; the
   core switches at their links to the edge router; the edge router at its link to core switch 1) */
export const GEAR = ["edge", "core1", "core2", "dist1", "dist2", "acc1", "acc2", "acc3", "acc4", "anxc", "anxa"];
export function gearAddr(p, id) { const L = coreLinks(p); return id === "edge" ? L[0].ia : id === "core1" ? L[0].ib : id === "core2" ? L[1].ib : id === "anxc" ? p.annex.core.ip : id === "anxa" ? p.annex.acc.ip : p.sw[id].ip; }
const who = function (sim, id) { return id === "edge" ? "the edge router" : said(sim, id); };
/* where each device's time and log traffic leaves from (the source address the server sees) */
const srcOf = function (sim, id, ip) { return SV.pathFrom(sim, id, ip).src; };
function serveCauses(sim, v) {
  const S = SV.svcOf(sim, "fsrv", "chrony"), fs = v.plan.srv.fsrv.ip, F = ((sim.d.fsrv.lx.files || {})[SV.CHRONY_CONF] || {}).text || "";
  const up = !!S && S.state === "active", file = SV.parseChrony(F), stale = up && JSON.stringify(file.allow) !== JSON.stringify(S.run.allow);
  const left = up && !stale && S.run.allow.length ? GEAR.find(function (id) { const s = srcOf(sim, id, fs); return !!s && !SV.chronyServes(sim, "fsrv", s); }) : null;
  return [C("stopped", !up, "chrony isn't running on the file server" + (S && S.state === "failed" ? ": it stopped on a line in its file it couldn't read" : ""), "It's running.", "systemctl status chrony on the file server."),
    C("nosync", up && !SV.serverSynced(sim, "fsrv"), "The file server's own clock isn't locked to the internet's time sources", "It's locked to them.", "chronyc sources on the file server: no source marked ^*."),
    C("stale", stale, "chrony's file has changed since it started: it's still running with the old one", "It's running with its file as it is.", "systemctl status chrony: when it started, against when " + SV.CHRONY_CONF + " was written (ls -l)."),
    C("noallow", up && !stale && !S.run.allow.length, "chrony serves nobody: its file has no allow line, so it answers no one's requests for time", "It allows the network's gear.", "cat " + SV.CHRONY_CONF + " on the file server: no allow line."),
    C("narrow", !!left, "chrony's allow leaves out " + (left ? who(sim, left) : "") + "'s address (" + (left ? srcOf(sim, left, fs) : "") + "): its requests for time are refused", "Every switch's and router's address is allowed.", "sudo chronyc clients on the file server, against the address each device sends from.")];
}
function syncCauses(sim, v) {
  const fs = v.plan.srv.fsrv.ip, st = GEAR.map(function (id) { return { id: id, n: SV.ntpState(sim, id) }; }), bad = st.find(function (q) { return !q.n.synced; });
  const w = bad ? bad.n.why : null, at = bad ? who(sim, bad.id) : "", list = bad ? (sim.d[bad.id].sw.ntp || []).join(", ") : "";
  return [C("none", w === "none", Cap(at) + " has no NTP server", "Every device has one.", bad ? "show running-config | include ntp on " + at + ": nothing." : ""),
    C("wrong", w === "unreachable" || w === "no-ntp", Cap(at) + " is told to keep time from " + list + ", where no time server answers it", "Every device asks the file server.", bad ? "show ntp associations on " + at + ": reach 0." : ""),
    C("refused", w === "refused", Cap(at) + "'s requests reach the file server, but chrony there refuses them", "chrony answers every device.", bad ? "show ntp status on " + at + ": unsynchronized; sudo chronyc clients on the file server." : ""),
    C("unsynced", w === "unsynced", "The file server answers " + at + ", but has no time of its own to give", "The file server has its time.", "chronyc tracking on the file server: Not synchronised.")];
}
function listenCauses(sim, v) {
  const S = SV.svcOf(sim, "fsrv", "rsyslog"), up = !!S && S.state === "active", F = ((sim.d.fsrv.lx.files || {})[SV.RSYSLOG_CONF] || {}).text || "", file = SV.parseRsyslog(F);
  const stale = up && (file.udp !== S.run.udp || file.tcp !== S.run.tcp);
  return [C("stopped", !up, "rsyslog isn't running on the file server", "It's running.", "systemctl status rsyslog on the file server."),
    C("stale", stale, "rsyslog's file has changed since it started: it's still running with the old one", "It's running with its file as it is.", "systemctl status rsyslog, and sudo ss -ulpn: nothing on 514."),
    C("tcp", up && !stale && !!S.run.tcp && !S.run.udp, "rsyslog takes syslog over TCP only: the switches and the router send theirs over UDP", "It takes UDP.", "sudo ss -tulpn on the file server: 514 under TCP, not UDP."),
    C("none", up && !stale && !S.run.udp && !S.run.tcp, "rsyslog takes no messages from the network: its UDP reception is still commented out", "It listens on UDP 514.", "cat " + SV.RSYSLOG_CONF + ": the imudp lines start with #."),
    C("port", up && !stale && !!S.run.udp && S.run.udp !== 514, "rsyslog listens on UDP port " + (S && S.run ? S.run.udp : "") + ": the gear sends to 514", "It listens on 514.", "sudo ss -ulpn on the file server.")];
}
const TRAP = ["emergencies", "alerts", "critical", "errors", "warnings", "notifications", "informational", "debugging"];
function sendCauses(sim, v) {
  const fs = v.plan.srv.fsrv.ip;
  const st = GEAR.map(function (id) { const sw = sim.d[id].sw, h = sw.logHosts || [], t = sw.logTrap == null ? 6 : sw.logTrap; return { id: id, h: h, t: t, to: h.indexOf(fs) >= 0, got: SV.arrivedFrom(sim, "fsrv", srcOf(sim, id, fs)) }; });
  const bad = st.find(function (q) { return !q.to || q.t < 5 || !q.got; }), at = bad ? who(sim, bad.id) : "";
  return [C("nohost", !!bad && !bad.h.length, Cap(at) + " has no log host: its log stays in its own buffer", "Every device has one.", bad ? "show logging on " + at + ": no Logging to line." : ""),
    C("wronghost", !!bad && bad.h.length > 0 && !bad.to, Cap(at) + " sends its log to " + (bad ? bad.h.join(", ") : "") + ", not to the file server", "Every device sends to the file server.", bad ? "show logging on " + at + ": the Logging to line." : ""),
    C("trap", !!bad && bad.to && bad.t < 5, Cap(at) + "'s trap level (" + (bad ? TRAP[bad.t] : "") + ") sends only messages more serious than a change to its configuration", "Every device sends at informational.", bad ? "show logging on " + at + ": Trap logging: level " + TRAP[bad ? bad.t : 6] + "." : ""),
    C("nothing", !!bad && bad.to && bad.t >= 5 && !bad.got, "Nothing from " + at + " has reached the file server: it hasn't logged anything since it was told where to send, or it was told before the server listened", "Something from every device has arrived.", bad ? "grep " + srcOf(sim, bad.id, fs) + " /var/log/syslog on the file server: nothing." : "")];
}
function savedCauses(sim) { return GEAR.map(function (id) { return C("unsaved-" + id, unsaved(sim.d[id].sw), Cap(who(sim, id)) + " hasn't been saved", "Every switch and the router are saved.", "show startup-config on " + who(sim, id) + ": it's not what's running."); }); }
const CHRONY_ALLOW = function (p) { return "allow " + p.srv.fsrv.ip.split(".").slice(0, 2).join(".") + ".0.0/16"; };
const EJ1 = {
  id: "EN-J1", level: "enterprise", title: "Time and logs for the whole network: every switch and router on the file server's clock, and logging to it",
  already: ["works", "saved"],
  start(seed) {
    const b = CJ10.start(seed), sim = b.sim;
    for (const a of CJ10.solve(b.v, sim)) { if (a.t === "cmd") exec(sim, a.dev, a.line, a.win, a.text); else sim.apply(a); }
    svcKit(sim.net);
    sim.cli = {};
    return { sim: sim, v: Object.assign({}, b.v, { runs: sim.net.extra.runs || 0 }) };
  },
  brief() { return { quote: "Last week the link to the Annex dropped for a few minutes and nobody could say when, or which switch saw it first: every switch keeps its own little log, and none of them agree on the time. Put the lot on one clock and one log: the file server already keeps good time from the internet, and it can collect everything the switches and the router have to say.", from: "Rafiki, owner" }; },
  mason: "Two services, two directions. Time flows out from the server, logs flow in to it. Get each service listening before you point the gear at it, and prove each one from the gear's side as well as the server's.",
  limits: function (v) {
    const p = v.plan, S = p.srv, fs = S.fsrv.ip;
    return ["The file server (" + S.fsrv.host + ", " + fs + " on eno1): Ubuntu's chrony and rsyslog, running and enabled since it went in. chrony keeps the server's own time from the internet's pool; its settings are " + SV.CHRONY_CONF + ". rsyslog writes the server's own log, /var/log/syslog; its settings are " + SV.RSYSLOG_CONF + ". Log in on its console (its tab) or over SSH as " + S.user + ", password " + S.pw + "; sudo asks for it too.",
      "Who takes time from the file server: every switch and router on the campus, which send from addresses in " + p.srv.fsrv.ip.split(".").slice(0, 2).join(".") + ".0.0/16 (the management network, the servers network, the links between the routing switches, the Annex). Nothing outside the campus.",
      "Every switch and router: the file server as its NTP server and its log host, sending at informational (the level a change to its configuration is logged at). A message from each must reach the server: a device logs a line each time someone leaves configuration mode, and send log writes one by hand.",
      "The gear, and where to reach it by SSH from a desk PC: " + GEAR.map(function (id) { return (id === "edge" ? "the edge router" : id) + " " + gearAddr(p, id); }).join("; ") + ". Locked as every one here: enable secret " + p.secret + ", SSH with the user " + p.user + ", password " + p.userPw + ".",
      "Every switch and router saved."];
  },
  reqs: [
    { id: "serve", text: "The file server keeps time from the internet and hands it to every switch and router on the campus", causes: serveCauses,
      ok: function () { return "chrony is locked to the internet's time and allows the campus's gear."; },
      rung1: function () { return "chronyc sources and cat /etc/chrony/chrony.conf on the file server; sudo chronyc clients once the gear asks."; },
      rung2: function () { return "A time server answers only the clients it's told to allow, by the address their requests come from; and a service reads its file as it starts, so a change waits for a restart."; } },
    { id: "sync", text: "Every switch and the edge router keeps its time from the file server", causes: syncCauses,
      ok: function () { return "Every device's clock is synchronized to the file server."; },
      rung1: function () { return "show ntp status and show ntp associations on each switch and the router."; },
      rung2: function () { return "A device keeps time only from a server it can reach that answers it; until then its clock is its own count since it booted, marked as not authoritative."; } },
    { id: "listen", text: "The file server takes syslog messages from the network", causes: listenCauses,
      ok: function () { return "rsyslog listens on UDP 514."; },
      rung1: function () { return "cat /etc/rsyslog.conf and sudo ss -ulpn on the file server."; },
      rung2: function () { return "A syslog server only hears the network once its reception module is loaded and an input opened on the port and protocol the senders use; network gear sends over UDP to port 514."; } },
    { id: "send", text: "Every switch and the edge router sends its log to the file server, and a message from each has arrived", causes: sendCauses,
      ok: function () { return "Every device sends to the file server at informational, and something from each is in /var/log/syslog."; },
      rung1: function () { return "show logging on each device; tail and grep /var/log/syslog on the file server."; },
      rung2: function () { return "A device sends each line it logs to its log hosts, if the line is at least as serious as its trap level; a line sent before the server listened is gone, so test once both ends are ready."; } },
    { id: "works", text: "Everyone still works: every PC online, both printers and every switch answering", causes: reachCauses,
      ok: function () { return "Every PC is online; both printers and every switch answer."; },
      rung1: function () { return "ping 8.8.8.8 from each PC; the printers and the switches from the service desk."; },
      rung2: function () { return "Pointing the gear at a time server and a log host changes nothing about the traffic it carries."; } },
    { id: "saved", text: "Every switch and the edge router is saved", causes: savedCauses,
      ok: function () { return "All of them are saved."; }, rung1: function () { return "show startup-config against show running-config on each."; }, rung2: function () { return "Only what's saved survives a power cut, or a reload."; } }
  ],
  solve(v) {
    const p = v.plan, S = p.srv, fs = S.fsrv.ip, out = [];
    const L = function (l, text) { const a = { t: "cmd", dev: "fsrv", line: l, cli: true }; if (text != null) a.text = text; out.push(a); };
    /* the server first: chrony allowing the campus, rsyslog taking UDP 514, each restarted */
    [""].concat([S.user, S.pw]).forEach(function (l) { L(l); });
    L("chronyc sources");
    L("sudo nano " + SV.CHRONY_CONF); L(S.pw); L("^O", SV.CHRONY_DEFAULT.replace("# Log files location.", "# The campus's switches and routers take their time from here.\n" + CHRONY_ALLOW(p) + "\n\n# Log files location.")); L("^X");
    L("sudo systemctl restart chrony");
    L("sudo nano " + SV.RSYSLOG_CONF); L("^O", SV.RSYSLOG_DEFAULT.replace('#module(load="imudp")\n#input(type="imudp" port="514")', 'module(load="imudp")\ninput(type="imudp" port="514")')); L("^X");
    L("sudo systemctl restart rsyslog"); L("sudo ss -ulpn");
    /* then every switch and router, by SSH from the service desk PC: its time server and its log host, saved */
    const D = function (l) { out.push({ t: "cmd", dev: "sd1", line: l }); };
    GEAR.forEach(function (id) {
      ["ssh " + p.user + "@" + gearAddr(p, id), p.userPw, "enable", p.secret, "configure terminal", "ntp server " + fs, "logging host " + fs, "end", "copy running-config startup-config", "", "show ntp status", "exit"].forEach(D);
    });
    L("tail -n 20 /var/log/syslog");
    return out;
  },
  answer(v) {
    const p = v.plan, S = p.srv, fs = S.fsrv.ip;
    return ["On the file server: sudo nano " + SV.CHRONY_CONF + " and add " + CHRONY_ALLOW(p) + "; sudo systemctl restart chrony.",
      "sudo nano " + SV.RSYSLOG_CONF + ": take the # off module(load=\"imudp\") and input(type=\"imudp\" port=\"514\"); sudo systemctl restart rsyslog; sudo ss -ulpn shows 514.",
      "On every switch and the edge router (SSH from a desk PC): configure terminal, ntp server " + fs + ", logging host " + fs + ", end (leaving configuration mode logs a line), copy running-config startup-config; show ntp status says synchronized.",
      "On the file server: tail /var/log/syslog has a line from each device's address."];
  },
  summary() { return ["One clock for the whole network: the file server keeps time from the internet and hands it to every switch and router on the campus.", "One log: every switch and router sends what it logs to the file server, where it's all in /var/log/syslog with the same time on every line.", "Next time the Annex's link drops, the server's log says when, and which switch saw it first."]; }
};

/* ------------------------------------------------------------ EN-J2, watching the network: SNMPv3 and a mirrored port */
/* the installer's 2019 template, found on the gear: public read-only everywhere, a read-write community on the access switches, each
   device's room and the NOC as its contact; all saved */
const RW_ON = ["acc1", "acc2", "acc3", "acc4", "anxa"];
const ROOM_OF = { edge: "Data room (1F)", core1: "Data room (1F)", core2: "Data room (1F)", dist1: "Data room (1F)", dist2: "Data room (1F)", acc1: "Data room (1F)", acc2: "2F closet", acc3: "3F closet", acc4: "4F closet", anxc: "Annex comms room", anxa: "Annex comms room" };
function template(sim, p) {
  GEAR.forEach(function (id) {
    const sw = sim.d[id].sw;
    sw.snmp = { comms: [{ name: "public", rw: false, acl: null }].concat(RW_ON.indexOf(id) >= 0 ? [{ name: p.mon.rw, rw: true, acl: null }] : []), groups: {}, hosts: [], traps: null, loc: ROOM_OF[id], contact: "Rafiki's IT Services NOC" };
    saveConfig(sw);
  });
}
const MON_U = function (sw, M) { return (sw.snmpUsers || {})[M.user]; };
function v2cCauses(sim) {
  const rw = GEAR.find(function (id) { const o = sim.d[id].sw.snmp; return o && o.comms.some(function (c) { return c.rw; }); });
  const ro = GEAR.find(function (id) { const o = sim.d[id].sw.snmp; return o && o.comms.length; });
  return [C("rw", !!rw, rw ? Cap(who(sim, rw)) + " still has a read-write community: anyone who knows it can change its configuration over the network" : "", "No read-write community is left.", rw ? "show running-config | include community on " + who(sim, rw) + "." : ""),
    C("ro", !rw && !!ro, ro ? Cap(who(sim, ro)) + " still answers a community over SNMPv1 and v2c, sent in clear text: anyone who hears it can read the device" : "", "No community is left.", ro ? "show snmp community on " + who(sim, ro) + "." : "")];
}
function v3Causes(sim, v) {
  const M = v.plan.mon, at = function (f) { return GEAR.find(f); };
  const ng = at(function (id) { const o = sim.d[id].sw.snmp; return !o || !o.groups[M.group] || o.groups[M.group].ver !== "v3"; });
  const lv = !ng && at(function (id) { return sim.d[id].sw.snmp.groups[M.group].level !== "priv"; });
  const nu = !ng && !lv && at(function (id) { const u = MON_U(sim.d[id].sw, M); return !u || u.ver !== "v3"; });
  const ug = !ng && !lv && !nu && at(function (id) { return MON_U(sim.d[id].sw, M).group !== M.group; });
  const au = !ng && !lv && !nu && !ug && at(function (id) { const u = MON_U(sim.d[id].sw, M); return !u.auth || u.auth.alg !== "SHA" || u.auth.key !== snmpKey(M.authPw, "SHA"); });
  const pv = !ng && !lv && !nu && !ug && !au && at(function (id) { const u = MON_U(sim.d[id].sw, M); return !u.priv || u.priv.alg !== "AES128" || u.priv.key !== snmpKey(M.privPw, "AES128"); });
  return [C("nogroup", !!ng, ng ? Cap(who(sim, ng)) + " has no SNMPv3 group by the records' name" : "", "Every device has the group.", ng ? "show snmp group on " + who(sim, ng) + "." : ""),
    C("level", !!lv, lv ? Cap(who(sim, lv)) + "'s group lets a user in without encryption (" + sim.d[lv].sw.snmp.groups[M.group].level + ")" : "", "Every group requires encryption (priv).", lv ? "show snmp group on " + who(sim, lv) + ": its security model." : ""),
    C("nouser", !!nu, nu ? Cap(who(sim, nu)) + " has no SNMPv3 user for the monitoring server" : "", "Every device has the user.", nu ? "show snmp user on " + who(sim, nu) + " (a user never shows in the running configuration)." : ""),
    C("usergroup", !!ug, ug ? Cap(who(sim, ug)) + "'s monitoring user is in another group" : "", "The user is in the records' group everywhere.", ug ? "show snmp user on " + who(sim, ug) + ": its Group-name." : ""),
    C("auth", !!au, au ? Cap(who(sim, au)) + "'s monitoring user doesn't authenticate as the records say (its protocol or its passphrase)" : "", "It authenticates with SHA and the records' passphrase.", au ? "snmpget from the file server to " + who(sim, au) + ": Authentication failure, or show snmp user: its protocol." : ""),
    C("priv", !!pv, pv ? Cap(who(sim, pv)) + "'s monitoring user doesn't encrypt as the records say (its protocol or its passphrase)" : "", "It encrypts with AES 128 and the records' passphrase.", pv ? "snmpget from the file server to " + who(sim, pv) + ": Decryption error, or show snmp user: its privacy protocol." : "")];
}
function polledCauses(sim, v) {
  const M = v.plan.mon, P = sim.d.fsrv.lx.snmpPolled || {}, V12 = sim.d.fsrv.lx.snmpV12 || {};
  const miss = GEAR.find(function (id) { return !P[id] || P[id].level !== "authpriv" || P[id].user !== M.user; });
  return [C("v2", !!miss && !!V12[miss], miss ? "The file server has only asked " + who(sim, miss) + " with a community (SNMPv1 or v2c), never as the monitoring user" : "", "Every device answered the monitoring user.", miss ? "snmpget from the file server to " + who(sim, miss) + ", as the monitoring user." : ""),
    C("notyet", !!miss && !V12[miss], miss ? "The file server hasn't had an encrypted SNMPv3 answer from " + who(sim, miss) + " as the monitoring user yet" : "", "Every device answered the monitoring user.", miss ? "snmpget from the file server to " + who(sim, miss) + " at authPriv." : "")];
}
function trapCauses(sim, v) {
  const M = v.plan.mon, fs = v.plan.srv.fsrv.ip;
  const st = GEAR.map(function (id) { const o = sim.d[id].sw.snmp || { hosts: [], traps: null }, h = o.hosts.find(function (q) { return q.ip === fs; }); return { id: id, o: o, h: h, on: !!o.traps && (o.traps[0] === "all" || o.traps.indexOf("config") >= 0), got: MON.trapFrom(sim, "fsrv", SV.pathFrom(sim, id, fs).src) }; });
  const bad = st.find(function (q) { return !q.h || q.h.kind !== "informs" || q.h.ver !== "3" || q.h.level !== "priv" || q.h.name !== M.user || !q.on || !q.got; }), at = bad ? who(sim, bad.id) : "";
  return [C("nohost", !!bad && !bad.o.hosts.length, Cap(at) + " sends its notifications nowhere", "Every device sends them to the file server.", bad ? "show snmp host on " + at + ": nothing." : ""),
    C("wronghost", !!bad && bad.o.hosts.length > 0 && !bad.h, Cap(at) + " sends its notifications to " + (bad ? bad.o.hosts.map(function (q) { return q.ip; }).join(", ") : "") + ", not to the file server", "Every device sends them to the file server.", bad ? "show snmp host on " + at + "." : ""),
    C("kind", !!bad && !!bad.h && bad.h.kind !== "informs" && bad.h.ver === "3", Cap(at) + " sends SNMPv3 traps, which the server can't read without each device's engine ID: informs need no engine ID, and are acknowledged", "Every device sends informs.", bad ? "show snmp host on " + at + ": its type." : ""),
    C("as", !!bad && !!bad.h && (bad.h.ver !== "3" || bad.h.level !== "priv" || bad.h.name !== M.user), Cap(at) + " sends its notifications with another version, security level or user than the server takes", "Every device sends as the monitoring user, encrypted.", bad ? "show snmp host on " + at + ": user and security model." : ""),
    C("off", !!bad && !!bad.h && !bad.on, Cap(at) + " has no notifications turned on for a change to its configuration", "Every device sends one when its configuration changes.", bad ? "show running-config | include traps on " + at + "." : ""),
    C("nothing", !!bad && !!bad.h && bad.on && !bad.got, "Nothing from " + at + " has reached snmptrapd on the file server: it sends one when its configuration changes", "One from every device has arrived.", bad ? "grep snmptrapd /var/log/syslog on the file server." : "")];
}
function mirrorCauses(sim, v) {
  const M = v.plan.mon, c = sim.cableAt("fsrv", "eno3"), far = c ? (c.a.dev === "fsrv" ? c.b : c.a) : null, on1 = far && far.dev === M.sw;
  const n = on1 ? "GigabitEthernet0/" + far.port : null, sw = sim.d[M.sw].sw, D = n ? spanDest(sw, n) : null, srcN = "GigabitEthernet0/" + M.src;
  const S = D ? D.src.find(function (s) { return s.ifc === srcN; }) : null;
  return [C("nocable", !on1, c ? "The file server's eno3 is cabled to " + who(sim, far.dev) + ", not the 1F access switch with the service desk PC on it" : "Nothing is cabled to the file server's eno3", "eno3 is cabled to the 1F access switch.", "The runs table: eno3."),
    C("shut", on1 && sw.ports[n].shutdown, "The 1F access switch's port for eno3 is shut", "The port is open.", "show interfaces status on the 1F access switch."),
    C("nosession", on1 && !sw.ports[n].shutdown && !D, "No mirroring session copies anything to the 1F access switch's port for eno3", "A session copies to it.", "show monitor session all on the 1F access switch."),
    C("vlan", !!D && !S && D.vlans.length > 0, "The session mirrors whole VLANs, every desk on them, not the service desk PC's port alone", "It mirrors the PC's port alone.", "show monitor session all: Source VLANs."),
    C("source", !!D && !S && !D.vlans.length, "The session mirrors another port, not the service desk PC's", "It mirrors the service desk PC's port.", "show monitor session all, against show interfaces status (the PC's port)."),
    C("dir", !!S && S.dir !== "both", "The session copies only what the service desk PC " + (S && S.dir === "rx" ? "sends" : "receives") + " (" + (S ? S.dir : "") + "), not both ways", "It copies both ways.", "show monitor session all: RX Only or TX Only.")];
}
function captureCauses(sim, v) {
  const M = v.plan.mon, E = (sim.d.fsrv.lx.files || {})[M.file], ip = (sim.addr("sd1") || {}).ip, f = sim.d.fsrv.ifaces.find(function (q) { return q.name === "eno3"; });
  const P = E && E.pcap ? E.pcap : null, out = P && P.some(function (q) { return q.from === ip; }), inn = P && P.some(function (q) { return q.to === ip; });
  return [C("down", !P && f && f.admin === "down", "The file server's eno3 is down: tcpdump can't capture on a port that isn't up", "eno3 is up.", "ip link show eno3 on the file server."),
    C("none", !P && !(f && f.admin === "down"), "There's no capture at " + M.file + " on the file server", "The capture is there.", "ls -l /tmp on the file server."),
    C("other", !!P && !out && !inn, "The capture at " + M.file + " holds none of the service desk PC's traffic", "It holds the PC's traffic.", "tcpdump -n -r " + M.file + " on the file server."),
    C("oneway", !!P && (out || inn) && !(out && inn), "The capture holds only what the service desk PC " + (out ? "sends" : "receives") + ", not both ways", "It holds both ways.", "tcpdump -n -r " + M.file + ": the PC's address on both sides?")];
}
const EJ2 = {
  id: "EN-J2", level: "enterprise", title: "Watching the network: SNMPv3 from the file server, and a mirror of the service desk's port",
  already: ["works", "saved"],
  start(seed) {
    const b = EJ1.start(seed), sim = b.sim;
    for (const a of EJ1.solve(b.v)) { if (a.t === "cmd") exec(sim, a.dev, a.line, a.win, a.text); else sim.apply(a); }
    monKit(sim.net); template(sim, sim.net.plan);
    sim.cli = {};
    return { sim: sim, v: Object.assign({}, b.v, { runs: sim.net.extra.runs || 0 }) };
  },
  brief() { return { quote: "An auditor went through the switches last month and found the 2019 installer's community strings still on every one of them, one of them read-write. Get monitoring onto something modern: the file server polls everything, encrypted, and hears about every change. And the security team wants to see what the service desk PC is really sending: give them a capture of its traffic, both ways.", from: "Rafiki, owner" }; },
  mason: "SNMPv3 is a user with keys, in a group with a security level: the agent checks both before it answers. And a mirror copies a port's traffic to another port: what's on the far end of that port sees it, and nothing else does.",
  limits: function (v) {
    const p = v.plan, S = p.srv, M = p.mon;
    return ["The monitoring server is the file server (" + S.fsrv.host + ", " + S.fsrv.ip + "): Net-SNMP's tools (snmpget, snmpwalk) and tcpdump installed; snmptrapd running and set up for the monitoring user (its settings are /etc/snmp/snmptrapd.conf), writing what it receives to /var/log/syslog. Log in on its console or over SSH as " + S.user + ", password " + S.pw + ".",
      "SNMPv3 on every switch and router: the group " + M.group + ", requiring encryption; the user " + M.user + " in it, authenticating with SHA (passphrase " + M.authPw + ") and encrypting with AES 128 (passphrase " + M.privPw + "). Notifications to the file server as informs, version 3, encrypted, as that user, when a device's configuration changes. No community strings left anywhere.",
      "Polled: the file server asks each device for its name (sysName.0) as the monitoring user, encrypted, and gets an answer.",
      "The mirror: the service desk PC is on the 1F access switch's port " + M.src + ". The file server's third network port (eno3, port 3 on its back) is free, with no address; the 1F access switch's port " + M.dst + " is spare for it. Session " + M.session + ", the PC's port both ways. The capture: the PC's traffic both ways, saved on the file server as " + M.file + " for the security team (tcpdump writes its files as its own user).",
      "The gear, by SSH from a desk PC: " + GEAR.map(function (id) { return (id === "edge" ? "the edge router" : id) + " " + gearAddr(p, id); }).join("; ") + ". Locked as every one here: enable secret " + p.secret + ", SSH with the user " + p.user + ", password " + p.userPw + ".",
      "Every switch and router saved."];
  },
  reqs: [
    { id: "v2c", text: "No switch or router answers a community string any more", causes: v2cCauses,
      ok: function () { return "No community is left on any device."; },
      rung1: function () { return "show running-config | include community on each switch and the router."; },
      rung2: function () { return "SNMPv1 and v2c send their community in clear text, and a community is all they check; the no form of the command that set it removes it."; } },
    { id: "v3", text: "Every switch and the edge router takes SNMPv3 from the monitoring user, authenticated and encrypted", causes: v3Causes,
      ok: function () { return "Every device has the group, requiring encryption, and the user with the records' protocols and passphrases."; },
      rung1: function () { return "show snmp group and show snmp user on each device; snmpget from the file server."; },
      rung2: function () { return "An SNMPv3 user belongs to a group, and the group's security level is the least the agent accepts; the user's keys are made from its passphrases, so both ends must use the same protocols and passphrases."; } },
    { id: "polled", text: "The file server has polled every switch and the edge router as the monitoring user, encrypted", causes: polledCauses,
      ok: function () { return "Every device answered the file server's encrypted SNMPv3 request."; },
      rung1: function () { return "snmpget on the file server, one device at a time; ~/.snmp/snmp.conf can hold the settings."; },
      rung2: function () { return "Prove it from the server's side: the poller has to ask, at the security level the group requires, and get the value back."; } },
    { id: "traps", text: "Every switch and the edge router sends informs to the file server when its configuration changes, and one from each has arrived", causes: trapCauses,
      ok: function () { return "Every device sends informs to the file server, and snmptrapd has logged one from each."; },
      rung1: function () { return "show snmp host on each device; grep snmptrapd /var/log/syslog on the file server."; },
      rung2: function () { return "A notification goes to each host the device is told about, of the kinds turned on; a v3 trap needs the sender's engine ID at the receiver, an inform doesn't; and nothing is sent until something happens."; } },
    { id: "mirror", text: "The service desk PC's port is mirrored, both ways, to a port cabled to the file server's third port", causes: mirrorCauses,
      ok: function () { return "The 1F access switch copies the service desk PC's port, both ways, to the port eno3 is on."; },
      rung1: function () { return "show monitor session all and show interfaces status on the 1F access switch; the runs table."; },
      rung2: function () { return "A mirroring session has a source (a port, both ways or one) and a destination port; whatever is cabled to the destination sees the copy."; } },
    { id: "capture", text: "A capture of the service desk PC's traffic, both ways, is saved on the file server as the records say", causes: captureCauses,
      ok: function () { return "The capture holds the service desk PC's traffic, both ways."; },
      rung1: function () { return "ip link show eno3, then tcpdump -n -r on the saved file."; },
      rung2: function () { return "tcpdump captures on a port that's up, and writes its file as its own user, so it needs a folder that user can write in."; } },
    { id: "works", text: "Everyone still works: every PC online, both printers and every switch answering", causes: reachCauses,
      ok: function () { return "Every PC is online; both printers and every switch answer."; },
      rung1: function () { return "ping 8.8.8.8 from each PC; the printers and the switches from the service desk."; },
      rung2: function () { return "Monitoring watches the traffic; it shouldn't change where any of it goes."; } },
    { id: "saved", text: "Every switch and the edge router is saved", causes: savedCauses,
      ok: function () { return "All of them are saved."; }, rung1: function () { return "show startup-config against show running-config on each; show snmp user after a save."; }, rung2: function () { return "Only what's saved survives a power cut, or a reload."; } }
  ],
  solve(v) {
    const p = v.plan, S = p.srv, M = p.mon, fs = S.fsrv.ip, out = [];
    out.push({ t: "lay", a: { dev: "fsrv", port: "eno3" }, b: { dev: M.sw, port: M.dst } });
    const D = function (l) { out.push({ t: "cmd", dev: "sd1", line: l }); };
    GEAR.forEach(function (id) {
      ["ssh " + p.user + "@" + gearAddr(p, id), p.userPw, "enable", p.secret, "configure terminal", "no snmp-server community public"].concat(RW_ON.indexOf(id) >= 0 ? ["no snmp-server community " + M.rw] : [],
        ["snmp-server group " + M.group + " v3 priv", "snmp-server user " + M.user + " " + M.group + " v3 auth sha " + M.authPw + " priv aes 128 " + M.privPw, "snmp-server host " + fs + " informs version 3 priv " + M.user, "snmp-server enable traps config"],
        id === M.sw ? ["interface gi0/" + M.dst, "no shutdown", "exit", "monitor session " + M.session + " source interface gi0/" + M.src + " both", "monitor session " + M.session + " destination interface gi0/" + M.dst] : [],
        ["end", "copy running-config startup-config", "", "exit"]).forEach(D);
    });
    const L = function (l) { out.push({ t: "cmd", dev: "fsrv", line: l, cli: true }); };
    [""].concat([S.user, S.pw]).forEach(L);
    GEAR.forEach(function (id) { L("snmpget -v3 -l authPriv -u " + M.user + " -a SHA -A " + M.authPw + " -x AES -X " + M.privPw + " " + gearAddr(p, id) + " sysName.0"); });
    L("sudo ip link set eno3 up"); L(S.pw);
    L("sudo tcpdump -i eno3 -n -c 40 -w " + M.file); L("tcpdump -n -r " + M.file);
    L("grep snmptrapd /var/log/syslog");
    return out;
  },
  answer(v) {
    const p = v.plan, M = p.mon, fs = p.srv.fsrv.ip;
    return ["Lay a cable from the file server's eno3 to the 1F access switch's port " + M.dst + ".",
      "On every switch and the edge router (SSH from a desk PC): no snmp-server community public (and no snmp-server community " + M.rw + " on the access switches), snmp-server group " + M.group + " v3 priv, snmp-server user " + M.user + " " + M.group + " v3 auth sha " + M.authPw + " priv aes 128 " + M.privPw + ", snmp-server host " + fs + " informs version 3 priv " + M.user + ", snmp-server enable traps config, end (the change sends an inform), copy running-config startup-config.",
      "On the 1F access switch also: interface gi0/" + M.dst + ", no shutdown; monitor session " + M.session + " source interface gi0/" + M.src + " both; monitor session " + M.session + " destination interface gi0/" + M.dst + ".",
      "On the file server: snmpget -v3 -l authPriv -u " + M.user + " -a SHA -A " + M.authPw + " -x AES -X " + M.privPw + " <each device> sysName.0; sudo ip link set eno3 up; sudo tcpdump -i eno3 -n -c 40 -w " + M.file + "; tcpdump -n -r " + M.file + "."];
  },
  summary() { return ["No community strings left: nothing on the network answers SNMP in clear text any more, and nothing can be changed over it.", "SNMPv3 everywhere: the file server polls every switch and router as one user, authenticated and encrypted, and each sends an inform when its configuration changes.", "A copy of the service desk PC's traffic, both ways, in a capture file for the security team: a mirror on the switch, tcpdump on the server."]; }
};

export const ENTERPRISE_JOBS = [EJ1, EJ2];
