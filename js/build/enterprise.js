/* Level 5 build mode: the enterprise's work orders (the plan approved 24 November 2026: "Yes to the Level 5 plan, build it out").
   Rafiki's IT Services has grown past one campus: the work starts from the campus as Level 4 left it (CP-J10 done) and takes it
   to the enterprise, smallest first. Every line is an ordered list of causes, as on the other levels: the first one really there is
   what the check saw, everything before it is ruled out by the network. */
import { CAMPUS_JOBS, reachCauses, said } from "./campus.js";
import { coreLinks, svcKit, monKit, branchKit } from "../net/campus.js";
import { exec } from "../net/cmd.js";
import { unsaved, saveConfig, spanDest, LEVELS3, snmpKey, pwOk } from "../net/swcli.js";
import { SFP_MODULES } from "../net/sim.js";
import * as RT from "../net/rtcli.js";
import * as DH from "../net/dhcpd.js";
import { ip2n } from "../net/util.js";
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


/* ------------------------------------------------------------ EN-J3, a branch office over a leased line */
/* the branch across town (the plan approved 24 November 2026): a pair of single-mode fibres leased from the provider, 8.4 km from HQ's data
   room to the branch's comms cupboard; the branch router from its box on the far end, the line a routed /30 worked out by hand, OSPF across
   it, the branch's desks addressed by the file server through a relay on the branch router, the internet through the edge router's NAT */
const BR = function (v) { return v.plan.branch; };
const BROOMS = ["bcomms", "boffice"];
const GI = function (port) { return "GigabitEthernet" + port.slice(2); };   /* a router's port as its interface: Gi0/9 is GigabitEthernet0/9 */
const RIF = function (sim, id, port) { return sim.d[id].sw.ifs[GI(port)]; };
const rUp = function (sim, id, port) { return !sim.d[id].boxed && RT.rtStatus(sim.rtView(id), GI(port))[1] === "up"; };
const theR = function (id) { return id === "edge" ? "the edge router" : "the branch router"; };
const lineFibre = function (sim) { return sim.net.cables.find(function (c) { return c.kind === "fibre" && [c.a.dev, c.b.dev].indexOf("brt") >= 0 && [c.a.dev, c.b.dev].indexOf("edge") >= 0; }) || null; };
const BPCS = ["bpc1", "bpc2"];
const bpcSay = function (sim, id) { return sim.d[id].label.replace(/^[A-Z](?=[a-z])/, function (m) { return m.toLowerCase(); }); };
function rack3Causes(sim, v) {
  const p = v.plan, B = BR(v), x = sim.d.brt, w = x.sw, u = (w.users || {})[p.user], bx = !!x.boxed;
  return [C("boxed", bx, "The branch router is still in its box", "It's racked in the branch's comms cupboard.", "The work order's van list: the branch router, in its box."),
    C("name", !bx && w.hostname !== B.host, "The branch router isn't named as the records say", "Its name is the records'.", "The prompt says " + w.hostname + "."),
    C("secret", !bx && (!w.enableSecret || !pwOk(w.enableSecret, p.secret)), "Its enable secret isn't the campus's", "Its enable secret is the campus's.", "show running-config on the branch router: " + (w.enableSecret ? "an enable secret, not the campus's" : "no enable secret") + "."),
    C("console", !bx && (!w.con.password || !pwOk(w.con.password, p.console) || w.con.login !== "password"), "Its console doesn't ask for the campus's console password", "The console asks for it.", "show running-config on the branch router: line con 0."),
    C("ssh", !bx && (!w.domain || !(w.rsa >= 768) || !u || !pwOk(u, p.userPw) || w.vty.login !== "local" || w.vty.transport !== "ssh"), "Its remote logins aren't SSH only with the campus's local user (a domain, keys, the user, login local, transport input ssh)", "SSH only, with the campus's user.", "show running-config on the branch router: line vty 0 15, the username, ip domain-name; show ip ssh.")];
}
/* the leased line: a single-mode module at each end, the fibre in the records' ports, both ports open */
function line3Causes(sim, v) {
  const B = BR(v), E = sim.d.edge, X = sim.d.brt, me = E.sfp && E.sfp[B.hqPort], mb = X.sfp && X.sfp[B.brPort], f = lineFibre(sim);
  const right = !!f && [[f.a, f.b], [f.b, f.a]].some(function (e) { return e[0].dev === "edge" && e[0].port === B.hqPort && e[1].port === B.brPort; });
  const copper = sim.net.cables.find(function (c) { return c.kind === "cat6" && [c.a, c.b].some(function (e) { return BROOMS.indexOf(sim.net.rooms[e.dev]) >= 0; }) && [c.a, c.b].some(function (e) { const r = sim.net.rooms[e.dev]; return r && BROOMS.indexOf(r) < 0; }); }) || null;
  const mods = [me, mb].filter(Boolean).map(function (m) { return SFP_MODULES[m]; }), plus = mods.some(function (m) { return m.rate !== 1000; }), mm = mods.some(function (m) { return m.fiber !== "SMF"; });
  const shutE = !!RIF(sim, "edge", B.hqPort).shutdown, shutB = !X.boxed && !!RIF(sim, "brt", B.brPort).shutdown, noMod = !me ? "edge" : !mb ? "brt" : null;
  const len = copper ? copper.length : "", nmPort = noMod === "edge" ? B.hqPort : B.brPort;
  return [C("boxed", !!X.boxed, "The branch router is still in its box: the line has nothing to land on at the branch", "The branch router is racked.", "The van list: the branch router, in its box."),
    C("copper", !X.boxed && !f && !!copper, "A copper cable joins HQ to the branch: at " + len + " m it's far past copper's 100 m, so it never links", "HQ and the branch are joined by the leased fibre.", "The Cable runs table: a " + len + " m run, No link."),
    C("nomod", !X.boxed && !f && !copper && !!noMod, "There's no module in " + (noMod ? theR(noMod) : "") + "'s " + nmPort + ": the fibre's LC plug goes into a module", "Both ends have modules.", "The Physical tab of " + (noMod ? theR(noMod) : "") + ": " + nmPort + " empty."),
    C("none", !X.boxed && !f && !copper && !noMod, "The leased fibre isn't plugged in", "It's plugged in at both ends.", "The Cable runs table: no fibre between HQ and the branch."),
    C("slots", !!f && !right, "The fibre isn't in the ports the records give it (the edge router's " + B.hqPort + " to the branch router's " + B.brPort + ")", "It's in the records' ports.", "The Cable runs table: the fibre's two ends."),
    C("plus", !!f && right && plus, "A 10 Gb/s SFP+ module is in a 1 Gb/s SFP slot: the router won't run it", "Both modules run at 1 Gb/s.", "Look at the plug at each end: the module's label."),
    C("mmf", !!f && right && !plus && mm, "A multimode module is on the single-mode line: the light it sends is the wrong kind for that fibre, and 8.4 km is far past its reach", "Both modules are single-mode, as the line is.", "Look at the plug at each end: the module's label, and the jacket's print."),
    C("shut", !!f && right && !plus && !mm && (shutE || shutB), "The line's port is shut on " + (shutE ? "the edge router" : "the branch router"), "Both ports are open.", "show ip interface brief on " + (shutE ? "the edge router" : "the branch router") + ": " + GI(shutE ? B.hqPort : B.brPort) + " administratively down."),
    C("down", !!f && right && !plus && !mm && !shutE && !shutB && !sim.cableUp(f), "The line has no link", "It has a link.", "The Cable runs table: No link.")];
}
/* the line's /30, worked out by hand from the block the records give: HQ the first usable address, the branch the second; each end described */
function addr3Causes(sim, v) {
  const B = BR(v), L = B.link, lo = ip2n(L.net), E = [{ id: "edge", port: B.hqPort, want: L.hq, desc: B.hqDesc }, { id: "brt", port: B.brPort, want: L.br, desc: B.brDesc }].map(function (e) { const f = RIF(sim, e.id, e.port); return Object.assign({ ip: f.ip, mask: f.mask, d: String(f.desc || "").toUpperCase() }, e); });
  const inB = function (ip) { return ip2n(ip) >= lo && ip2n(ip) <= lo + 3; }, at = function (e) { return e ? Cap(theR(e.id)) + "'s end of the line (" + GI(e.port) + ")" : ""; };
  const none = E.find(function (e) { return !e.ip; }), mask = !none && E.find(function (e) { return e.mask !== L.mask; }), out = !none && !mask && E.find(function (e) { return !inB(e.ip); });
  const edge = !none && !mask && !out && E.find(function (e) { return ip2n(e.ip) === lo || ip2n(e.ip) === lo + 3; }), same = !none && !mask && !out && !edge && E[0].ip === E[1].ip;
  const swap = !none && !mask && !out && !edge && !same && E.find(function (e) { return e.ip !== e.want; }), desc = E.find(function (e) { return !!e.ip && e.d !== e.desc; });
  const show = function (e) { return e ? "show ip interface brief on " + theR(e.id) + ": " + GI(e.port) + " " + (e.ip || "unassigned") + "." : ""; };
  return [C("none", !!none, at(none) + " has no address", "Both ends have addresses.", show(none)),
    C("mask", !!mask, at(mask) + "'s mask isn't the line's block's size: the records give the line a /30", "Both ends have the block's mask.", mask ? "show running-config on " + theR(mask.id) + ": interface " + GI(mask.port) + ", ip address " + mask.ip + " " + mask.mask + "." : ""),
    C("out", !!out, at(out) + "'s address isn't in the line's block", "Both ends are in the block.", show(out)),
    C("edge", !!edge, at(edge) + " is on the block's network or broadcast address: neither can be a device's", "Both ends are on usable addresses.", show(edge)),
    C("same", same, "Both ends of the line have the same address", "Each end has its own.", "show ip interface brief on each router: " + E[0].ip + " twice."),
    C("swap", !!swap, "The ends aren't the way round the records say: HQ takes the first usable address, the branch the second", "HQ has the first, the branch the second.", show(swap)),
    C("desc", !!desc, at(desc) + " isn't described as the records say", "Both ends are described.", desc ? "show interfaces description on " + theR(desc.id) + ": " + GI(desc.port) + "." : "")];
}
/* the branch router as the branch's gateway: its LAN port cabled to the branch switch, on the records' address, up */
function lan3Causes(sim, v) {
  const B = BR(v), X = sim.d.brt, c = sim.net.cables.find(function (k) { return k.kind === "cat6" && [k.a.dev, k.b.dev].indexOf("brt") >= 0 && [k.a.dev, k.b.dev].indexOf("bsw2") >= 0; }) || null;
  const rp = c ? (c.a.dev === "brt" ? c.a.port : c.b.port) : null, sp = c ? (c.a.dev === "bsw2" ? c.a.port : c.b.port) : null, f = RIF(sim, "brt", B.lanPort), right = rp === B.lanPort && sp === B.swPort;
  return [C("boxed", !!X.boxed, "The branch router is still in its box", "It's racked.", "The van list: the branch router, in its box."),
    C("cable", !X.boxed && !c, "The branch router isn't cabled to the branch switch", "It's cabled to the switch.", "The Cable runs table: nothing between the branch router and the branch switch."),
    C("ports", !!c && !right, "The router's cable to the branch switch isn't on the ports the records give it (the router's " + B.lanPort + " to the switch's port " + B.swPort + ")", "It's on the records' ports.", "The Cable runs table: the run's two ends."),
    C("addr", !X.boxed && (f.ip !== B.lan.gw || f.mask !== B.lan.mask), "The branch router's " + GI(B.lanPort) + " isn't on the branch's gateway address as the records give it", "It's the branch's gateway.", "show ip interface brief on the branch router: " + GI(B.lanPort) + " " + (f.ip || "unassigned") + "."),
    C("shut", !X.boxed && f.ip === B.lan.gw && !!f.shutdown, "The branch router's " + GI(B.lanPort) + " is shut", "It's open.", "show ip interface brief on the branch router: administratively down."),
    C("down", !!c && right && f.ip === B.lan.gw && !f.shutdown && !rUp(sim, "brt", B.lanPort), "The branch router's " + GI(B.lanPort) + " is down", "It's up.", "show ip interface brief on the branch router: " + GI(B.lanPort) + " down."),
    C("desc", !X.boxed && f.ip === B.lan.gw && String(f.desc || "").toUpperCase() !== B.lanDesc, "The branch router's " + GI(B.lanPort) + " isn't described as the records say", "It's described.", "show interfaces description on the branch router.")];
}
/* OSPF across the line: both routers running it, the line in it at both ends, neither passive there, the same area: FULL */
function ospf3Causes(sim, v) {
  const B = BR(v), R = sim.ospfAll(), runs = function (id) { return !sim.d[id].boxed && !!sim.d[id].sw.ospf; };
  const ends = [{ id: "edge", port: B.hqPort }, { id: "brt", port: B.brPort }].map(function (e) { const r = R.routers[e.id]; return Object.assign({ f: r ? r.ifs.find(function (f) { return f.name === GI(e.port); }) : null, up: rUp(sim, e.id, e.port) }, e); });
  const full = ["edge", "brt"].every(function (id) { return (R.nbrs[id] || []).some(function (nb) { const o = id === "edge" ? ends[1] : ends[0]; return nb.iface === GI(id === "edge" ? B.hqPort : B.brPort) && o.f && nb.ip === o.f.ip && /^FULL/.test(nb.state); }); });
  const noProc = ends.find(function (e) { return !runs(e.id); }), down = !noProc && ends.find(function (e) { return !e.up; }), noNet = !noProc && !down && ends.find(function (e) { return !e.f; });
  const pas = !noProc && !down && !noNet && ends.find(function (e) { return e.f.passive; }), area = !noProc && !down && !noNet && !pas && ends[0].f.area !== ends[1].f.area;
  return [C("proc", !!noProc, (noProc ? Cap(theR(noProc.id)) : "A router") + " doesn't run OSPF", "Both routers run OSPF.", noProc ? "show ip protocols on " + theR(noProc.id) + ": nothing." : ""),
    C("down", !!down, "The routers can't be neighbours: the line is down at " + (down ? theR(down.id) + " (" + GI(down.port) + ")" : "one end"), "The line is up at both ends.", down ? "show ip interface brief on " + theR(down.id) + ": " + GI(down.port) + " down." : ""),
    C("net", !!noNet, (noNet ? Cap(theR(noNet.id)) + "'s end of the line" : "An end") + " isn't in OSPF: none of its network statements covers that interface's address", "The line is in OSPF at both ends.", noNet ? "show ip ospf interface brief on " + theR(noNet.id) + ": " + GI(noNet.port) + " missing." : ""),
    C("passive", !!pas, (pas ? Cap(theR(pas.id)) + "'s end of the line" : "An end") + " is passive: it advertises the line but never says hello across it, so no neighbour forms", "Neither end is passive.", pas ? "show ip protocols on " + theR(pas.id) + ": Passive Interface(s)." : ""),
    C("area", area, "The two ends of the line are in different areas", "Both ends in area 0.", "show ip ospf interface brief on each router: the Area column."),
    C("nofull", !noProc && !down && !noNet && !pas && !area && !full, "The routers aren't neighbours across the line", "They're FULL.", "show ip ospf neighbor on the edge router.")];
}
/* each side learns the other: the branch's network at HQ (advertised, passive towards the desks), the way out at the branch */
function routes3Causes(sim, v) {
  const B = BR(v), R = sim.ospfAll(), X = R.routers.brt, f = X ? X.ifs.find(function (q) { return q.name === GI(B.lanPort); }) : null;
  const er = RT.lookup(sim.rtView("edge"), B.lan.gw, sim.rtLive("edge")), learned = !!er && er.iface === GI(B.hqPort);
  const br = sim.d.brt.boxed ? null : RT.lookup(sim.rtView("brt"), "8.8.8.8", sim.rtLive("brt"));
  return [C("noadv", !f, "The branch's network isn't in OSPF at the branch router: HQ never learns the way to it", "The branch router advertises it.", "show ip ospf interface brief on the branch router: " + GI(B.lanPort) + " missing."),
    C("hello", !!f && f.passive === false, "The branch router says OSPF hello on the branch's network: anything on a desk there that answered could feed the campus routes", "It's passive towards the desks.", "show ip protocols on the branch router: Passive Interface(s)."),
    C("learn", !!f && !learned, "The edge router hasn't learned the branch's network across the line", "It has.", "show ip route on the edge router: no " + B.lan.net + " via the line."),
    C("noway", !br, "The branch router has no way out: no default route, learned or typed", "It has the way out.", "show ip route on the branch router: no Gateway of last resort.")];
}
/* the branch's desks addressed by the file server: a relay on the branch router, the branch's subnet in dhcpd's file, the server restarted on it */
const F3 = function (sim, path) { const F = sim.d.fsrv.lx.files || {}; return F[path] ? F[path].text : ""; };
function desks3Causes(sim, v) {
  const p = v.plan, B = BR(v), fs = p.srv.fsrv.ip, f = RIF(sim, "brt", B.lanPort), h = (!sim.d.brt.boxed && f.helpers) || [], c = DH.parse(F3(sim, DH.CONF)), S = c.errors.length ? null : c.subnets.find(function (q) { return q.net === B.lan.net; }) || null;
  const D = sim.d.fsrv.lx.dhcpd || {}, stale = D.state === "active" && !!D.run && D.run.file !== F3(sim, DH.CONF), o = S ? DH.leaseOpts(c, S, null) : null;
  const lo = S && S.ranges.length ? Math.min.apply(null, S.ranges.map(function (q) { return ip2n(q[0]); })) : null, hi = S && S.ranges.length ? Math.max.apply(null, S.ranges.map(function (q) { return ip2n(q[1]); })) : null;
  const first = ip2n(B.lan.net) + p.excl + 1, last = ip2n(B.lan.net) + 254;
  const nolease = BPCS.find(function (id) { const l = sim.d[id].ifaces[0].lease; return !l || l.server !== fs; }), at = function (id) { return id ? bpcSay(sim, id) : ""; };
  return [C("nohelper", !h.length, "The branch router doesn't relay the desks' requests for an address: a broadcast stops at the router", "It relays them.", "show running-config on the branch router: interface " + GI(B.lanPort) + " has no ip helper-address."),
    C("helper", h.length > 0 && h.indexOf(fs) < 0, "The branch router relays the desks' requests to an address where no DHCP server answers", "It relays them to the file server.", "show running-config on the branch router: ip helper-address " + h.join(", ") + "."),
    C("syntax", c.errors.length > 0, "The DHCP server can't read its file: line " + (c.errors[0] ? c.errors[0].line + ", " + c.errors[0].msg : ""), "It reads the file.", "dhcpd -t -cf " + DH.CONF + "."),
    C("nosub", !c.errors.length && !S, "The DHCP server's file has no subnet for the branch's network: it has nothing to hand out there", "The branch's subnet is declared.", "cat " + DH.CONF + ": no subnet " + B.lan.net + "."),
    C("range", !!S && !S.ranges.length, "The branch's subnet has no range: there's nothing in it to hand out", "It has its range.", "cat " + DH.CONF + ": subnet " + B.lan.net + " has no range line."),
    C("kept", !!S && lo != null && lo < first, "The branch's range reaches into the first twenty addresses, kept back for the gateway and the gear", "It keeps the first twenty back.", "cat " + DH.CONF + ": the range in subnet " + B.lan.net + "."),
    C("small", !!S && lo != null && lo >= first && (lo > first || hi < last), "The branch's range isn't the records' twenty-first to the last", "It's the records'.", "cat " + DH.CONF + ": the range in subnet " + B.lan.net + "."),
    C("routers", !!o && o.routers[0] !== B.lan.gw, "The branch's leases " + (o && o.routers.length ? "carry the wrong default gateway" : "carry no default gateway (no routers option)") + ": its desks can't leave their network", "They carry the branch router's address.", "cat " + DH.CONF + ": option routers in subnet " + B.lan.net + "."),
    C("dns", !!o && o.dns.join(",") !== p.dns.join(","), "The branch's leases don't carry the campus's two DNS servers", "They carry the campus's.", "cat " + DH.CONF + ": option domain-name-servers."),
    C("failed", D.state === "failed" || D.state === "inactive", "The DHCP server isn't running" + (D.state === "failed" ? ": it stopped on its file" : ""), "It's running.", "systemctl status isc-dhcp-server."),
    C("stale", stale, "The DHCP server is running from an older copy of its file: it reads it only as it starts", "It's running the file as it is now.", "systemctl status isc-dhcp-server: running since before the file was last written."),
    C("notyet", !!nolease, "The " + at(nolease) + " has no address from the file server: it hasn't asked again since the way was ready", "Both desks have their addresses.", "ipconfig on the " + at(nolease) + ": Autoconfiguration IPv4 Address 169.254....")];
}
/* the desks reach HQ and the internet: back through the line, out through the edge router's NAT */
function reach3Causes(sim, v) {
  const p = v.plan, B = BR(v), fs = p.srv.fsrv.ip, back = BPCS.find(function (id) { const r = sim.route(id, fs); return r.fail || !(r.local || r.routed); }), off = !back && BPCS.find(function (id) { return !sim.route(id, "8.8.8.8").internet; });
  const nat = RIF(sim, "edge", B.hqPort).nat !== "inside", at = function (id) { return id ? bpcSay(sim, id) : ""; };
  return [C("back", !!back, "The " + at(back) + " gets no answer from the file server", "Both reach the file server.", back ? "ping " + fs + " from the " + at(back) + "; tracert to see where it stops." : ""),
    C("nat", !!off && nat, "The " + at(off) + " reaches HQ but not the internet: the edge router doesn't translate what comes in on the line", "Both reach the internet.", "show ip nat translations on the edge router, after a ping from the branch: nothing from " + B.lan.net.replace(/\.0$/, ".x") + "."),
    C("off", !!off && !nat, "The " + at(off) + " can't reach the internet", "Both reach the internet.", off ? "ping 8.8.8.8 from the " + at(off) + ": no reply." : "")];
}
function saved3Causes(sim) { return ["edge", "brt"].map(function (id) { return C("unsaved-" + id, !sim.d[id].boxed && unsaved(sim.d[id].sw), Cap(theR(id)) + " hasn't been saved: a power cut takes the changes away", "Both routers are saved.", "show startup-config on " + theR(id) + ": it's not what's running."); }); }
/* the file the walk-through writes: the campus's file as the branch's turn starts, with the branch's subnet added before the reservation */
function dhcpText3(v) {
  const B = BR(v), p = v.plan, add = "# the " + B.name + " branch, across town (its router relays its requests)\nsubnet " + B.lan.net + " netmask " + B.lan.mask + " {\n  range " + B.lan.net.replace(/0$/, String(p.excl + 1)) + " " + B.lan.net.replace(/0$/, "254") + ";\n  option routers " + B.lan.gw + ";\n}\n";
  const F = v.dhconf || "", i = F.indexOf("\nhost ");
  return i >= 0 ? F.slice(0, i + 1) + add + F.slice(i) : F + "\n" + add;
}
const EJ3 = {
  id: "EN-J3", level: "enterprise", title: "A branch office across town: a leased fibre line, the branch router from its box, OSPF across it, the desks addressed from HQ",
  already: ["works", "saved"],
  start(seed) {
    const b = EJ2.start(seed), sim = b.sim;
    for (const a of EJ2.solve(b.v)) { if (a.t === "cmd") exec(sim, a.dev, a.line, a.win, a.text); else sim.apply(a); }
    branchKit(sim.net); ["brt", "bsw2", "bpc1", "bpc2"].forEach(function (id) { sim.arp[id] = sim.arp[id] || {}; });
    BPCS.forEach(function (id) { sim.dhcp(id, "boot"); });   /* both desks asked at nine this morning: nobody answered */
    sim.cli = {};
    return { sim: sim, v: Object.assign({}, b.v, { runs: sim.net.extra.runs || 0, dhconf: F3(sim, DH.CONF) }) };
  },
  brief(v) { const B = BR(v); return { quote: "We've taken a small office across town, the " + B.name + " branch, for two of the team. The provider has lit a pair of fibres from our data room to its comms cupboard: " + B.km + " km, ours end to end. The installer racked the switch there and cabled both desks; the router's still in its box. Put the branch on our network: its addresses from our file server like every desk here, and the internet through our edge router.", from: "Rafiki, owner" }; },
  mason: "Bring the line up before you route over it: the modules and the fibre, then the addresses, then a neighbour across it. Then the desks: a request for an address is a broadcast, and a broadcast stops at the branch router unless the router carries it on.",
  limits: function (v) {
    const p = v.plan, B = BR(v), S = p.srv, b = p.vlans.svc.net.split(".")[1];
    return ["The leased line: a pair of single-mode fibres (OS2), " + B.km + " km, from HQ's data room to the branch's comms cupboard. At HQ it's for the edge router's " + B.hqPort + " (an SFP slot, empty); at the branch, the branch router's " + B.brPort + ". In the van: 1000BASE-SX modules (multimode, up to 550 m), 1000BASE-LX (single-mode, up to 10 km) and a 10GBASE-SR SFP+.",
      "The line is a routed link of its own: the block " + B.link.net + "/30. HQ takes the first usable address, the branch the second. The edge router's end described " + B.hqDesc + ", the branch router's " + B.brDesc + ".",
      "The branch router (BR-4200), in its box in the comms cupboard: named " + B.host + ", locked as every router here (enable secret " + p.secret + ", console password " + p.console + ", SSH only with the user " + p.user + ", password " + p.userPw + ", domain " + p.domain + "). Its " + B.lanPort + " is the branch's gateway, " + B.lan.gw + " on " + B.lan.net + "/24, cabled to the branch switch's port " + B.swPort + " and described " + B.lanDesc + ". Your laptop's console cable is 1.8 m: take your laptop to the branch.",
      "The branch switch runs as it came from its box, one network, both desks on its ports 1 and 2: it's set up on a later visit.",
      "OSPF, process 1, area 0, as everywhere here: the line at both ends; the branch's network at the branch router, with no hellos to the desks. The edge router already hands the way out to OSPF.",
      "The branch's desks get their addresses from the file server, as every desk here does, through a relay on the branch router. " + DH.CONF + " gets a subnet for the branch: ." + (p.excl + 1) + " to .254, its routers option the branch's gateway; the campus's DNS servers and a day's lease, as the rest of the file says. Log in on the file server's console or over SSH as " + S.user + ", password " + S.pw + "; sudo asks for it too.",
      "The internet: through the edge router, which translates everything from 10." + b + ".0.0/16 that comes in on an inside interface.",
      "Both routers saved."];
  },
  reqs: [
    { id: "rack", text: "The branch router is racked in the branch's comms cupboard, named and locked as every router here", causes: rack3Causes,
      ok: function () { return "The branch router is racked, named and locked."; },
      rung1: function () { return "The van list; show running-config on the branch router."; },
      rung2: function () { return "A router from its box answers anyone at its console and has no name: every router here gets the same locks before anything else."; } },
    { id: "line", text: "The leased line is up: a module at each end that suits the fibre, the fibre in, both ports open", causes: line3Causes,
      ok: function () { return "The line has a link."; },
      rung1: function () { return "The Cable runs table; the Physical tab at each end: the module's label and the jacket's print."; },
      rung2: function () { return "A module has to suit the fibre it sends into and the distance it has to cover; copper stops at 100 m."; } },
    { id: "addr", text: "The line's two ends are on the line's own block: HQ the first usable address, the branch the second, each described", causes: addr3Causes,
      ok: function () { return "Both ends are on the block's two usable addresses, the right way round."; },
      rung1: function () { return "show ip interface brief and show interfaces description on each router."; },
      rung2: function () { return "A /30 has four addresses: the network, two usable, the broadcast. Work it out on paper first."; } },
    { id: "lan", text: "The branch router is the branch's gateway: its LAN port cabled to the branch switch, on the records' address, up", causes: lan3Causes,
      ok: function () { return "The branch router's LAN port is up on the branch's gateway address."; },
      rung1: function () { return "The Cable runs table; show ip interface brief on the branch router."; },
      rung2: function () { return "An interface needs its address, no shutdown and a link before anything routes through it."; } },
    { id: "ospf", text: "The edge router and the branch router are OSPF neighbours across the line", causes: ospf3Causes,
      ok: function () { return "The two routers are FULL neighbours across the line."; },
      rung1: function () { return "show ip ospf neighbor and show ip ospf interface brief on each router."; },
      rung2: function () { return "Two routers become neighbours when both run OSPF on the link, in the same area, and say hello across it."; } },
    { id: "routes", text: "Each side learns the other: HQ learns the branch's network, the branch the way out, and the desks hear no OSPF", causes: routes3Causes,
      ok: function () { return "The edge router has the branch's network over the line; the branch router has the way out; its LAN is passive."; },
      rung1: function () { return "show ip route on both routers; show ip protocols on the branch router."; },
      rung2: function () { return "A router advertises only the networks its network statements cover; a passive interface is advertised but says no hello."; } },
    { id: "desks", text: "Both branch PCs have their addresses from the file server, through the branch router", causes: desks3Causes,
      ok: function () { return "Both branch PCs have leases from the file server, with the branch's gateway."; },
      rung1: function () { return "show running-config on the branch router; cat the DHCP server's file; ipconfig /all on a branch PC."; },
      rung2: function () { return "A relay sends a desk's request on, with its own address in it, and the server picks the subnet that address is in; a server reads its file only as it starts."; } },
    { id: "reach", text: "Both branch PCs reach the file server and the internet", causes: reach3Causes,
      ok: function () { return "Both branch PCs reach the file server and the internet."; },
      rung1: function () { return "ping and tracert from a branch PC; show ip nat translations on the edge router."; },
      rung2: function () { return "Private addresses leave for the internet only through a translation, and the router translates only what comes in on an inside interface."; } },
    { id: "works", text: "Everyone at HQ still works: every PC online, both printers and every switch answering", causes: reachCauses,
      ok: function () { return "Every PC is online; both printers and every switch answer."; },
      rung1: function () { return "ping 8.8.8.8 from each PC; the printers and the switches from the service desk."; },
      rung2: function () { return "A new link in OSPF is a change for every router that learns it."; } },
    { id: "saved", text: "The edge router and the branch router are saved", causes: saved3Causes,
      ok: function () { return "Both are saved."; }, rung1: function () { return "show startup-config against show running-config on each."; }, rung2: function () { return "Only what's saved survives a power cut."; } }
  ],
  solve(v) {
    const p = v.plan, B = BR(v), L = B.link, S = p.srv, fs = S.fsrv.ip, out = [], n = v.runs || 0;
    let k = 0; const lay = function (a, b) { k++; out.push({ t: "lay", a: a, b: b }); return n + k; };
    const c = function (l) { out.push({ t: "cmd", dev: "tech", line: l, cli: true }); };
    /* unpack and cable: the router, a single-mode module at each end, the line, the router to the branch switch */
    out.push({ t: "place", dev: "brt", room: "bcomms" });
    out.push({ t: "sfp", dev: "edge", slot: B.hqPort, type: "1000BASE-LX" }, { t: "sfp", dev: "brt", slot: B.brPort, type: "1000BASE-LX" });
    lay({ dev: "edge", port: B.hqPort }, { dev: "brt", port: B.brPort });
    lay({ dev: "brt", port: B.lanPort }, { dev: "bsw2", port: B.swPort });
    /* the branch router from its box, on its console at the branch */
    out.push({ t: "place", dev: "tech", room: "bcomms" }); const con = lay({ dev: "tech", port: "USB-C" }, { dev: "brt", port: "CONSOLE" });
    ["", "enable", "configure terminal", "hostname " + B.host, "enable secret " + p.secret, "line console 0", "password " + p.console, "login", "exit", "ip domain-name " + p.domain, "username " + p.user + " secret " + p.userPw, "crypto key generate rsa modulus 2048", "line vty 0 15", "login local", "transport input ssh", "exit",
      "interface " + B.brPort, "description " + B.brDesc, "ip address " + L.br + " " + L.mask, "no shutdown", "exit",
      "interface " + B.lanPort, "description " + B.lanDesc, "ip address " + B.lan.gw + " " + B.lan.mask, "ip helper-address " + fs, "no shutdown", "exit",
      "router ospf 1", "network " + L.net + " 0.0.0.3 area 0", "network " + B.lan.net + " 0.0.0.255 area 0", "passive-interface " + B.lanPort, "exit", "end", "copy running-config startup-config", ""].forEach(c);
    /* back at HQ: the edge router's end of the line */
    out.push({ t: "pull", cable: "c-console-" + con }, { t: "place", dev: "tech", room: "data" });
    const con2 = lay({ dev: "tech", port: "USB-C" }, { dev: "edge", port: "CONSOLE" });
    ["", p.console, "enable", p.secret, "configure terminal", "interface " + B.hqPort, "description " + B.hqDesc, "ip address " + L.hq + " " + L.mask, "ip nat inside", "no shutdown", "exit", "router ospf 1", "network " + L.net + " 0.0.0.3 area 0", "end", "copy running-config startup-config", "", "show ip ospf neighbor"].forEach(c);
    out.push({ t: "pull", cable: "c-console-" + con2 });
    /* the file server: the branch's subnet, restarted */
    const X = function (l, text) { const a = { t: "cmd", dev: "fsrv", line: l, cli: true }; if (text != null) a.text = text; out.push(a); };
    ["", S.user, S.pw].forEach(function (l) { X(l); });
    X("sudo nano " + DH.CONF); X(S.pw); X("^O", dhcpText3(v)); X("^X"); X("sudo systemctl restart isc-dhcp-server");
    BPCS.forEach(function (id) { out.push({ t: "cmd", dev: id, line: "ipconfig /renew" }); });
    return out;
  },
  answer(v) {
    const p = v.plan, B = BR(v), L = B.link, fs = p.srv.fsrv.ip;
    return ["Place the branch router in the branch's comms cupboard. Put a 1000BASE-LX module (single-mode) in the edge router's " + B.hqPort + " and the branch router's " + B.brPort + ", and lay the fibre between them; lay the branch router's " + B.lanPort + " to the branch switch's port " + B.swPort + ".",
      "Take your laptop to the branch and console into the branch router: hostname " + B.host + ", the campus's enable secret, console password, domain, user and keys, SSH only; interface " + B.brPort + ": description " + B.brDesc + ", ip address " + L.br + " " + L.mask + " (the block's second usable), no shutdown; interface " + B.lanPort + ": description " + B.lanDesc + ", ip address " + B.lan.gw + " " + B.lan.mask + ", ip helper-address " + fs + ", no shutdown; router ospf 1, network " + L.net + " 0.0.0.3 area 0, network " + B.lan.net + " 0.0.0.255 area 0, passive-interface " + B.lanPort + "; save.",
      "Back at HQ, the edge router: interface " + B.hqPort + ": description " + B.hqDesc + ", ip address " + L.hq + " " + L.mask + " (the first usable), ip nat inside, no shutdown; router ospf 1, network " + L.net + " 0.0.0.3 area 0; save. show ip ospf neighbor: the branch router FULL.",
      "On the file server: sudo nano " + DH.CONF + ", a subnet " + B.lan.net + " netmask " + B.lan.mask + " with range ." + (p.excl + 1) + " to .254 and option routers " + B.lan.gw + "; sudo systemctl restart isc-dhcp-server. Then ipconfig /renew on both branch PCs."];
  },
  summary(v) { const B = BR(v); return ["The " + B.name + " branch is on the network over a leased fibre line, " + B.km + " km of single-mode with a long-reach module at each end.", "The line is a routed /30 of its own, worked out by hand, and OSPF runs across it: HQ learns the branch's network, the branch learns the way out.", "The branch's desks get their addresses from the file server at HQ, carried there by the branch router's relay, and reach the internet through the edge router."]; }
};

export const ENTERPRISE_JOBS = [EJ1, EJ2, EJ3];
