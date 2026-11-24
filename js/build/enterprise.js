/* Level 5 build mode: the enterprise's work orders (the plan approved 24 November 2026: "Yes to the Level 5 plan, build it out").
   Rafiki's IT Services has grown past one campus: the work starts from the campus as Level 4 left it (CP-J10 done) and takes it
   to the enterprise, smallest first. Every line is an ordered list of causes, as on the other levels: the first one really there is
   what the check saw, everything before it is ruled out by the network. */
import { CAMPUS_JOBS, reachCauses, said } from "./campus.js";
import { coreLinks, svcKit } from "../net/campus.js";
import { exec } from "../net/cmd.js";
import { unsaved } from "../net/swcli.js";
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

export const ENTERPRISE_JOBS = [EJ1];
