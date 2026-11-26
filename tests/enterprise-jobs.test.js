/* Level 5 build mode: the enterprise's work orders (js/build/enterprise.js), worked on the gear's own command lines over SSH from a desk
   PC and on the file server's Linux console. Each: the work still to do for the real reason; the solution passing every line; the
   tempting wrong ways each failing their own line for their own cause; other right ways passing; replay; the help never naming a
   password or an address. */
import test from "node:test";
import assert from "node:assert/strict";
import { ENTERPRISE_JOBS, GEAR, gearAddr } from "../js/build/enterprise.js";
import * as B from "../js/build/engine.js";
import * as SV from "../js/net/svc.js";
import * as MON from "../js/net/mon.js";
const N = Number(process.env.SEEDS || 3);
const EJ1 = ENTERPRISE_JOBS.find((d) => d.id === "EN-J1");
const seeds = Array.from({ length: N }, (_, i) => 15000 + i * 7919);
const line = (J, id) => { const e = B.evaluate(J.def.reqs.find((q) => q.id === id), J.sim, J.v); return Object.assign(e, { cause: e.real ? e.real.id : null }); };
const run = (J, acts) => { for (const a of acts) B.act(J, a); return J; };
const L = (l, text) => (text == null ? { t: "cmd", dev: "fsrv", line: l, cli: true } : { t: "cmd", dev: "fsrv", line: l, cli: true, text });
const login = (J) => ["", J.v.plan.srv.user, J.v.plan.srv.pw].map((l) => L(l));
const nano = (J, path, text) => [L("sudo nano " + path), L(J.v.plan.srv.pw), L("^O", text), L("^X")];
const gear = (J, id, lines, save = true) => { const p = J.v.plan; return ["ssh " + p.user + "@" + gearAddr(p, id), p.userPw, "enable", p.secret, "configure terminal"].concat(lines, ["end"], save ? ["copy running-config startup-config", ""] : [], ["exit"]).map((l) => ({ t: "cmd", dev: "sd1", line: l })); };
const allowOf = (p, bits) => "allow " + (bits === 24 ? p.vlans.mgmt.net + "/24" : p.srv.fsrv.ip.split(".").slice(0, 2).join(".") + ".0.0/16");
const chronyWith = (extra) => SV.CHRONY_DEFAULT.replace("# Log files location.", extra + "\n\n# Log files location.");
const UDP = SV.RSYSLOG_DEFAULT.replace('#module(load="imudp")\n#input(type="imudp" port="514")', 'module(load="imudp")\ninput(type="imudp" port="514")');
/* the walk-through, with one part of it swapped for something else */
const solveWith = (J, swap) => { const acts = EJ1.solve(J.v); return swap ? swap(acts) : acts; };

test("EN-J1 starts with its work still to do, for the real reason; the walk-through passes every line", () => {
  for (const s of seeds) {
    let J = B.open(EJ1, s), c = B.check(J);
    for (const r of c.res) { if (EJ1.already.indexOf(r.id) >= 0) assert.ok(r.ok, s + " " + r.id + " met before any work"); else { assert.equal(r.ok, false, s + " " + r.id); assert.ok(r.ev && r.ev.length > 10); } }
    assert.equal(line(J, "serve").cause, "noallow"); assert.equal(line(J, "sync").cause, "none"); assert.equal(line(J, "listen").cause, "none"); assert.equal(line(J, "send").cause, "nohost");
    J = run(B.open(EJ1, s), EJ1.solve(J.v)); c = B.check(J);
    for (const r of c.res) assert.ok(r.ok, s + " " + r.id + " not met after the walk-through: " + r.ev);
    assert.equal(J.done, true);
    for (const id of GEAR) { const n = SV.ntpState(J.sim, id); assert.ok(n.synced && n.ref === J.v.plan.srv.fsrv.ip, s + " " + id + " synchronized to the file server"); }
  }
});

test("EN-J1: the gear's own view: show ntp status, show clock and show logging say what the network says; the server's log and chrony's clients agree", () => {
  const J = run(B.open(EJ1, seeds[0]), EJ1.solve(B.open(EJ1, seeds[0]).v)), p = J.v.plan, fs = p.srv.fsrv.ip;
  const out = (acts) => acts.map((a) => (B.act(J, a) || {}).out || "").join("");
  const o = out(gear(J, "acc2", ["do show ntp status", "do show clock", "do show logging", "do send log 6 from the bench"], false));
  assert.match(o, new RegExp("Clock is synchronized, stratum 3, reference is " + fs.replace(/\./g, "\\.")));
  assert.match(o, /^\d\d:\d\d:\d\d\.\d{3} UTC Sun Nov 22 2026$/m, "the clock is the network's, not marked *");
  assert.match(o, new RegExp("Logging to " + fs.replace(/\./g, "\\.") + "  \\(udp port 514")); assert.match(o, /Trap logging: level informational/);
  const sys = out([L("tail -n 3 /var/log/syslog"), L("sudo chronyc clients")]);
  assert.match(sys, new RegExp(p.sw.acc2.ip.replace(/\./g, "\\.") + " \\d+: Nov 22 [0-9:.]+: %SYS-6-USERLOG_INFO: Message from tty2\\(user id: \\): from the bench"), "send log 6 reached the server, under the switch's address");
  assert.match(sys, new RegExp("^" + p.sw.acc2.ip.replace(/\./g, "\\.") + "\\s+12", "m"), "chronyc clients lists the switch");
  /* a switch with no time server: its own count since boot, marked as not authoritative */
  const K = B.open(EJ1, seeds[0]), k = (K.v.plan), o2 = gear(K, "acc1", ["do show clock", "do show ntp status"], false).map((a) => (B.act(K, a) || {}).out || "").join("");
  assert.match(o2, /^\*\d\d:\d\d:\d\d\.\d{3} UTC Mon Mar 1 1993$/m); assert.match(o2, /%NTP is not enabled\./);
});

test("EN-J1: the tempting wrong ways each fail their own line for their own cause", () => {
  for (const s of seeds.slice(0, 2)) {
    const o = () => B.open(EJ1, s), p = o().v.plan, fs = p.srv.fsrv.ip;
    /* chrony allowing only the management network: the distribution switches, the cores, the Annex core and the router are refused */
    let J = run(o(), solveWith(o(), (a) => a.map((x) => x.text && /allow /.test(x.text) ? Object.assign({}, x, { text: chronyWith(allowOf(p, 24)) }) : x)));
    assert.equal(line(J, "serve").cause, "narrow", s + " a /24"); assert.equal(line(J, "sync").cause, "refused");
    /* the allow written but chrony never restarted */
    J = run(o(), solveWith(o(), (a) => a.filter((x) => x.line !== "sudo systemctl restart chrony")));
    assert.equal(line(J, "serve").cause, "stale", s + " not restarted"); assert.equal(line(J, "sync").cause, "refused");
    /* TCP reception uncommented instead of UDP */
    J = run(o(), solveWith(o(), (a) => a.map((x) => x.text && /imudp/.test(x.text) && x.dev === "fsrv" && x.line === "^O" && /input\(type="imudp"/.test(x.text) ? Object.assign({}, x, { text: SV.RSYSLOG_DEFAULT.replace('#module(load="imtcp")\n#input(type="imtcp" port="514")', 'module(load="imtcp")\ninput(type="imtcp" port="514")') }) : x)));
    assert.equal(line(J, "listen").cause, "tcp", s + " TCP"); assert.equal(line(J, "send").cause, "nothing");
    /* rsyslog's file right, rsyslog not restarted */
    J = run(o(), solveWith(o(), (a) => a.filter((x) => x.line !== "sudo systemctl restart rsyslog")));
    assert.equal(line(J, "listen").cause, "stale", s + " rsyslog not restarted"); assert.equal(line(J, "send").cause, "nothing");
    /* the gear pointed at the file server's backup address */
    J = run(o(), solveWith(o(), (a) => a.map((x) => x.line === "ntp server " + fs ? Object.assign({}, x, { line: "ntp server " + p.srv.fsrv.bip }) : x)));
    assert.equal(line(J, "sync").cause, "wrong", s + " the backup address");
    /* the edge router told where to log before the server listened, and nothing logged since: its line is gone */
    const block = (acts, id) => { const k = acts.findIndex((x) => x.dev === "sd1" && x.line === "ssh " + p.user + "@" + gearAddr(p, id)); return [k, 12]; };
    J = o(); run(J, gear(J, "edge", ["ntp server " + fs, "logging host " + fs])); run(J, solveWith(J, (a) => { const [k, n] = block(a, "edge"); return a.filter((x, i) => i < k || i >= k + n); }));
    assert.equal(line(J, "send").cause, "nothing", s + " logged before the server listened");
    run(J, gear(J, "edge", ["do send log 6 a test line"], false)); assert.equal(line(J, "send").ok, true, s + " a line sent once both ends are ready arrives");
    /* a trap level of errors: the configuration change never goes */
    J = run(o(), solveWith(o(), (a) => { const [k] = block(a, "acc3"); return a.slice(0, k + 5).concat([{ t: "cmd", dev: "sd1", line: "logging trap errors" }], a.slice(k + 5)); }));
    assert.equal(line(J, "send").cause, "trap", s + " trap errors");
    /* one device left unsaved */
    J = run(o(), solveWith(o(), (a) => { const k = a.findIndex((x) => x.line === "ntp server " + fs); return a.filter((x, i) => !(i > k && i < k + 5 && x.line === "copy running-config startup-config")); }));
    assert.equal(line(J, "saved").ok, false, s + " unsaved");
  }
});

test("EN-J1: more wrong ways: a service stopped, the server's own clock lost, another port, the wrong log host, a deny line, the provider down; the trap level and send log's level; the running configuration", () => {
  const s = seeds[0], o = () => B.open(EJ1, s), p = o().v.plan, fs = p.srv.fsrv.ip;
  const sudo = (J, l) => { const r = B.act(J, L(l)); if (/\[sudo\] password/.test((r && r.out) || "")) B.act(J, L(J.v.plan.srv.pw)); };
  const done = () => run(o(), EJ1.solve(o().v));
  const chronyText = (x) => x.text && x.line === "^O" && /^allow /m.test(x.text), rsysText = (x) => x.text && x.line === "^O" && /input\(type="imudp"/.test(x.text);
  /* chrony stopped after the work: the server serves no time, and the gear's requests go unanswered */
  let J = done(); sudo(J, "sudo systemctl stop chrony");
  assert.equal(line(J, "serve").cause, "stopped", "chrony stopped"); assert.equal(line(J, "sync").cause, "wrong", "nothing answers on 123");
  /* rsyslog stopped */
  J = done(); sudo(J, "sudo systemctl stop rsyslog"); assert.equal(line(J, "listen").cause, "stopped", "rsyslog stopped");
  /* chrony's pool lines commented out: the server has no time of its own to give */
  J = run(o(), solveWith(o(), (a) => a.map((x) => chronyText(x) ? Object.assign({}, x, { text: chronyWith(allowOf(p, 16)).replace(/^pool /gm, "#pool ") }) : x)));
  assert.equal(line(J, "serve").cause, "nosync", "no sources"); assert.equal(line(J, "sync").cause, "unsynced");
  /* the provider down: the server loses the internet's time, and so does everything taking time from it */
  J = done(); J.sim.net.isp.outage = true;
  assert.equal(line(J, "serve").cause, "nosync", "the provider down"); assert.equal(line(J, "sync").cause, "unsynced");
  /* rsyslog listening on another port */
  J = run(o(), solveWith(o(), (a) => a.map((x) => rsysText(x) ? Object.assign({}, x, { text: UDP.replace('input(type="imudp" port="514")', 'input(type="imudp" port="10514")') }) : x)));
  assert.equal(line(J, "listen").cause, "port", "port 10514"); assert.equal(line(J, "send").cause, "nothing");
  /* one switch logging to the file server's backup address instead */
  J = done(); run(J, gear(J, "acc2", ["no logging host " + fs, "logging host " + p.srv.fsrv.bip]));
  assert.equal(line(J, "send").cause, "wronghost", "the backup address");
  /* chrony allowing the campus but denying the management network */
  J = run(o(), solveWith(o(), (a) => a.map((x) => chronyText(x) ? Object.assign({}, x, { text: chronyWith(allowOf(p, 16) + "\ndeny " + p.vlans.mgmt.net + "/24") }) : x)));
  assert.equal(line(J, "serve").cause, "narrow", "a deny line"); assert.equal(line(J, "sync").cause, "refused");
  /* the trap level: at errors, neither a change to the configuration nor an informational line goes; back at informational, the change does */
  J = done(); const src3 = SV.pathFrom(J.sim, "acc3", fs).src, from3 = () => J.sim.d.fsrv.lx.syslog.filter((l) => l.split(" ")[3] === src3).length, n3 = from3();
  run(J, gear(J, "acc3", ["logging trap errors", "do send log 6 an informational line"], false)); assert.equal(from3(), n3, "nothing sent at trap errors");
  run(J, gear(J, "acc3", ["logging trap informational"], false)); assert.equal(from3(), n3 + 1, "the change to the configuration sent once back at informational");
  /* send log with no level is debugging, under the trap level; with level 6 it goes */
  J = done(); run(J, gear(J, "acc2", ["do send log hello from the bench", "do send log 6 hello again"], false));
  assert.ok(!J.sim.d.fsrv.lx.syslog.some((l) => /hello from the bench/.test(l)), "send log with no level stays on the switch"); assert.ok(J.sim.d.fsrv.lx.syslog.some((l) => /USERLOG_INFO: .*hello again/.test(l)), "send log 6 arrives");
  /* the running configuration says it: a switch and the edge router */
  const show = (id) => gear(J, id, ["do show running-config | include ntp", "do show running-config | include logging"], false).map((a) => (B.act(J, a) || {}).out || "").join("");
  for (const id of ["acc1", "edge"]) { const out = show(id); assert.match(out, new RegExp("^ntp server " + fs.replace(/\./g, "\\.") + "$", "m"), id + " ntp server"); assert.match(out, new RegExp("^logging host " + fs.replace(/\./g, "\\.") + "$", "m"), id + " logging host"); }
  /* and saved: a switch that has them taken off without saving gets them back from what it saved when its power is cut (a save that left them
     out would pass every line above, and the switch would come back without them) */
  J = done(); run(J, gear(J, "acc2", ["no ntp server " + fs, "no logging host " + fs], false));
  assert.equal(line(J, "sync").cause, "none", "taken off acc2, not saved"); assert.ok(!(J.sim.d.acc2.sw.logHosts || []).length, "the log host off acc2");
  B.act(J, { t: "power", dev: "acc2" });
  assert.equal(line(J, "sync").ok, true, "back after the power cut: the saved time server"); assert.deepEqual(J.sim.d.acc2.sw.logHosts, [fs], "the saved log host back");
});

test("EN-J1: other right ways pass: allow for the whole network spelled out per subnet, rsyslog's old-style lines, logging <address>, a test line by hand", () => {
  const s = seeds[0], o = () => B.open(EJ1, s), p = o().v.plan, fs = p.srv.fsrv.ip, b2 = fs.split(".").slice(0, 2).join(".");
  const OLD = SV.RSYSLOG_DEFAULT.replace('#module(load="imudp")\n#input(type="imudp" port="514")', '$ModLoad imudp\n$UDPServerRun 514');
  const J = run(o(), solveWith(o(), (a) => a.map((x) => x.text && /^allow /m.test(x.text) ? Object.assign({}, x, { text: chronyWith("allow " + b2 + ".0.0/17\nallow " + b2 + ".128.0/17") }) : x.text && /input\(type="imudp"/.test(x.text) ? Object.assign({}, x, { text: OLD }) : x.line === "logging host " + fs ? Object.assign({}, x, { line: "logging " + fs }) : x)));
  for (const r of B.check(J).res) assert.ok(r.ok, r.id + ": " + r.ev);
});

test("EN-J1: rungs and the ladder; a saved job replays exactly; the help never names a password or an address", () => {
  const J = B.open(EJ1, seeds[0]), p = J.v.plan;
  const texts = [].concat(...EJ1.reqs.map((q) => [q.text, q.rung1(J.v, J.sim), q.rung2(J.v, J.sim), q.ok(J.v, J.sim)]), [EJ1.mason, EJ1.brief(J.v).quote]).map((x) => String(x).toLowerCase());
  for (const t of texts) { for (const bad of [p.secret, p.userPw, p.srv.pw, p.srv.fsrv.ip, p.srv.fsrv.ip.split(".").slice(0, 2).join(".")].map((x) => String(x).toLowerCase())) assert.ok(t.indexOf(bad) < 0, "names " + bad + ": " + t); }
  const U = run(B.open(EJ1, seeds[0]), EJ1.solve(J.v).slice(0, 40));
  const R = B.restore(EJ1, JSON.parse(JSON.stringify(B.save(U))));
  assert.equal(JSON.stringify(R.sim.net), JSON.stringify(U.sim.net));
});

/* ---------------------------------------------------------------- EN-J2, watching the network: SNMPv3 and a mirrored port */
const EJ2 = ENTERPRISE_JOBS.find((d) => d.id === "EN-J2");
const solve2 = (J, swap) => { const acts = EJ2.solve(J.v); return swap ? swap(acts) : acts; };
/* the SSH block typed to one device in the walk-through: from its ssh to the exit after its save */
const blk = (acts, p, id) => { const k = acts.findIndex((x) => x.dev === "sd1" && x.line === "ssh " + p.user + "@" + gearAddr(p, id)); const c = acts.findIndex((x, i) => i > k && x.line === "copy running-config startup-config"); return [k, c + 2]; };
const inBlk = (acts, p, id, f) => { const [k, e] = blk(acts, p, id); return acts.map((x, i) => (i >= k && i <= e ? f(x) : x)).filter(Boolean); };
const sayOut = (J, acts) => acts.map((a) => (B.act(J, a) || {}).out || "").join("");
const srvLines = (J, lines) => ["", J.v.plan.srv.user, J.v.plan.srv.pw].concat(lines).map((l) => L(l));

test("EN-J2 starts with its work still to do, for the real reason; the walk-through passes every line", () => {
  for (const s of seeds.slice(0, Math.max(1, N - 1))) {
    let J = B.open(EJ2, s), c = B.check(J);
    for (const r of c.res) { if (EJ2.already.indexOf(r.id) >= 0) assert.ok(r.ok, s + " " + r.id + " met before any work"); else { assert.equal(r.ok, false, s + " " + r.id); assert.ok(r.ev && r.ev.length > 10); } }
    assert.equal(line(J, "v2c").cause, "rw"); assert.equal(line(J, "v3").cause, "nogroup"); assert.equal(line(J, "polled").cause, "notyet");
    assert.equal(line(J, "traps").cause, "nohost"); assert.equal(line(J, "mirror").cause, "nocable"); assert.equal(line(J, "capture").cause, "down");
    const pv = sayOut(J, srvLines(J, ["snmpget -v2c -c public " + gearAddr(J.v.plan, "acc2") + " sysName.0", "snmpget -v2c -c not-the-community " + gearAddr(J.v.plan, "acc2") + " sysName.0", "exit"]));
    assert.match(pv, /SNMPv2-MIB::sysName\.0 = STRING: /, "the old community answers"); assert.match(pv, /Timeout: No Response from /, "a wrong one gets no answer at all");
    J = run(B.open(EJ2, s), EJ2.solve(J.v)); c = B.check(J);
    for (const r of c.res) assert.ok(r.ok, s + " " + r.id + " not met after the walk-through: " + r.ev);
    assert.equal(J.done, true);
  }
});

test("EN-J2: the gear's and the server's own view: show snmp, the running configuration without the user, the mirror and its port, Net-SNMP's answers and errors, tcpdump's", () => {
  const J = run(B.open(EJ2, seeds[0]), EJ2.solve(B.open(EJ2, seeds[0]).v)), p = J.v.plan, M = p.mon, fs = p.srv.fsrv.ip, esc = (x) => String(x).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  /* each command's own output, on one device, over SSH from the service desk PC */
  const showOn = (id, cmds) => { const D = (l) => (B.act(J, { t: "cmd", dev: "sd1", line: l }) || {}).out || ""; ["ssh " + p.user + "@" + gearAddr(p, id), p.userPw, "enable", p.secret].forEach(D); const o = cmds.map(D); D("exit"); return o; };
  const [su, sg, sh, rc, ms, st] = showOn("acc1", ["show snmp user", "show snmp group", "show snmp host", "show running-config | include snmp|monitor", "show monitor session all", "show interfaces status"]), a1 = [su, sg, sh, ms, st].join("\n");
  assert.match(a1, new RegExp("User name: " + esc(M.user) + "[\\s\\S]*Authentication Protocol: SHA\\nPrivacy Protocol: AES128\\nGroup-name: " + esc(M.group)));
  assert.match(a1, new RegExp("groupname: " + esc(M.group) + "\\s+security model:v3 priv"));
  assert.match(a1, new RegExp("Notification host: " + esc(fs) + "\\tudp-port: 162\\ttype: inform\\nuser: " + esc(M.user) + "\\tsecurity model: v3 priv"));
  assert.match(rc, new RegExp("^snmp-server group " + esc(M.group) + " v3 priv$", "m")); assert.match(rc, new RegExp("^snmp-server host " + esc(fs) + " informs version 3 priv " + esc(M.user) + "$", "m"));
  assert.match(rc, /^snmp-server enable traps config$/m); assert.ok(!/snmp-server user|snmp-server community/.test(rc), "the user never shows in the running configuration, and no community is left");
  assert.match(rc, new RegExp("^monitor session 1 source interface Gi0/" + M.src + "$", "m")); assert.match(rc, new RegExp("^monitor session 1 destination interface Gi0/" + M.dst + "$", "m"));
  assert.match(a1, new RegExp("Source Ports\\s+:\\n\\s+Both\\s+: Gi0/" + M.src + "\\nDestination Ports\\s+: Gi0/" + M.dst));
  assert.match(a1, new RegExp("^Gi0/" + M.dst + "\\s.*\\smonitoring\\s", "m"), "the mirror's port says monitoring");
  const v3 = "snmpget -v3 -l authPriv -u " + M.user + " -a SHA -A " + M.authPw + " -x AES -X " + M.privPw + " ", ad = gearAddr(p, "acc2");
  const sv = sayOut(J, srvLines(J, [v3 + ad + " sysName.0", "snmpwalk -v3 -l authPriv -u " + M.user + " -a SHA -A " + M.authPw + " -x AES -X " + M.privPw + " " + gearAddr(p, "edge") + " system",
    "snmpget -v2c -c public " + ad + " sysName.0", "snmpget -v3 -l authPriv -u " + M.user + " -a SHA -A wrong-passphrase -x AES -X " + M.privPw + " " + ad + " sysName.0",
    "snmpget -v3 -l authPriv -u " + M.user + " -a SHA -A " + M.authPw + " -x AES -X wrong-passphrase " + ad + " sysName.0", "snmpget -v3 -l authNoPriv -u " + M.user + " -a SHA -A " + M.authPw + " " + ad + " sysName.0",
    "snmpget -v3 -l authPriv -u nobody -a SHA -A " + M.authPw + " -x AES -X " + M.privPw + " " + ad + " sysName.0", "sudo tcpdump -i eno3 -n -c 3 -w servicedesk.pcap", p.srv.pw, "ls -l /tmp", "cat " + M.file, "tcpdump -n -r " + M.file + " host 8.8.8.8"]));
  assert.match(sv, /SNMPv2-MIB::sysName\.0 = STRING: \S+\.rafiki-it\.lan/); assert.match(sv, /SNMPv2-MIB::sysDescr\.0 = STRING: BR-4200 Network Operating System/); assert.match(sv, /DISMAN-EVENT-MIB::sysUpTimeInstance = Timeticks: \(\d+\) \d+ days?, \d+:\d\d:\d\d\.\d\d/);
  assert.match(sv, new RegExp("Timeout: No Response from " + esc(ad) + "\\."), "public is gone: no answer"); assert.match(sv, /snmpget: Authentication failure \(incorrect password, community or key\)/); assert.match(sv, /snmpget: Decryption error/);
  assert.match(sv, /Reason: authorizationError \(access denied to that object\)/, "authNoPriv against a group that requires priv"); assert.match(sv, /snmpget: Unknown user name/);
  assert.match(sv, /tcpdump: servicedesk\.pcap: Permission denied/, "tcpdump writes as its own user: not into a home folder");
  assert.match(sv, /-rw-r--r-- 1 tcpdump tcpdump \d+ Nov 22 [\d:]+ servicedesk\.pcap/); assert.match(sv, /is a packet capture, not text/);
  assert.match(sv, /reading from file \/tmp\/servicedesk\.pcap, link-type EN10MB/);
});

test("EN-J2: the tempting wrong ways each fail their own line for their own cause", () => {
  const s = seeds[0], o = () => B.open(EJ2, s), p = o().v.plan, M = p.mon, fs = p.srv.fsrv.ip;
  const drop = (id, l) => (a) => inBlk(a, p, id, (x) => (x.line === l ? null : x));
  const swap = (id, l, n) => (a) => inBlk(a, p, id, (x) => (x.line === l ? Object.assign({}, x, { line: n }) : x));
  const user = "snmp-server user " + M.user + " " + M.group + " v3 auth sha " + M.authPw + " priv aes 128 " + M.privPw, host = "snmp-server host " + fs + " informs version 3 priv " + M.user;
  const T = (f) => run(o(), solve2(o(), f));
  let J = T(drop("acc3", "no snmp-server community " + M.rw)); assert.equal(line(J, "v2c").cause, "rw", "the read-write community left on one switch");
  J = T(drop("edge", "no snmp-server community public")); assert.equal(line(J, "v2c").cause, "ro", "public left on the router");
  J = T(swap("dist1", "snmp-server group " + M.group + " v3 priv", "snmp-server group " + M.group + " v3 auth")); assert.equal(line(J, "v3").cause, "level", "a group that doesn't require encryption");
  J = T(swap("acc2", user, user.replace(" auth sha ", " auth md5 "))); assert.equal(line(J, "v3").cause, "auth", "MD5");
  J = T(swap("acc4", user, user.replace(" priv aes 128 " + M.privPw, " priv aes 128 wrong-privacy"))); assert.equal(line(J, "v3").cause, "priv", "a wrong privacy passphrase"); assert.equal(line(J, "polled").cause, "notyet"); assert.equal(line(J, "traps").cause, "nothing", "its inform can't be read either");
  J = T((a) => a.filter((x) => !/^snmpget /.test(x.line || ""))); assert.equal(line(J, "polled").cause, "notyet", "never polled");
  J = o(); run(J, srvLines(J, ["snmpget -v2c -c public " + gearAddr(p, "edge") + " sysName.0", "exit"])); run(J, solve2(J, (a) => a.filter((x) => !/^snmpget /.test(x.line || "")))); assert.equal(line(J, "polled").cause, "v2", "asked with the community only");
  const srcOf2 = (J, id) => SV.pathFrom(J.sim, id, fs).src;
  J = T(swap("edge", host, "snmp-server host " + fs + " version 3 priv " + M.user)); assert.equal(line(J, "traps").cause, "kind", "v3 traps, not informs"); assert.equal(MON.trapFrom(J.sim, "fsrv", srcOf2(J, "edge")), false, "and the server can't read them");
  J = T(swap("edge", host, "snmp-server host " + fs + " informs version 2c public")); assert.equal(line(J, "traps").cause, "as", "informs with a community");
  J = T(drop("core1", "snmp-server enable traps config")); assert.equal(line(J, "traps").cause, "off", "notifications never turned on"); assert.equal(MON.trapFrom(J.sim, "fsrv", srcOf2(J, "core1")), false, "so none was sent");
  J = o(); run(J, srvLines(J, ["sudo systemctl stop snmptrapd", p.srv.pw, "exit"])); run(J, solve2(J)); assert.equal(line(J, "traps").cause, "nothing", "snmptrapd stopped while the gear was set up");
  J = T((a) => a.map((x) => (x.t === "lay" ? Object.assign({}, x, { b: { dev: "acc2", port: "10" } }) : x))); assert.equal(line(J, "mirror").cause, "nocable", "eno3 cabled to the wrong switch");
  J = T(drop(M.sw, "no shutdown")); assert.equal(line(J, "mirror").cause, "shut", "the destination port left shut"); assert.equal(line(J, "capture").cause, "other");
  J = T((a) => inBlk(a, p, M.sw, (x) => (/^monitor session /.test(x.line || "") ? null : x))); assert.equal(line(J, "mirror").cause, "nosession", "no session at all: the port is an ordinary port"); assert.equal(line(J, "capture").cause, "other", "it hears only the switch's own frames");
  const src = "monitor session 1 source interface gi0/" + M.src + " both";
  J = T(swap(M.sw, src, src.replace(" both", " rx"))); assert.equal(line(J, "mirror").cause, "dir", "only what it sends"); assert.equal(line(J, "capture").cause, "oneway");
  const other = Object.keys(p.desks.acc1).find((k) => p.desks.acc1[k][0] === "hd1");
  J = T(swap(M.sw, src, "monitor session 1 source interface gi0/" + other + " both")); assert.equal(line(J, "mirror").cause, "source", "the help desk PC's port"); assert.equal(line(J, "capture").cause, "other");
  J = T(swap(M.sw, src, "monitor session 1 source vlan " + p.vlans.svc.id)); assert.equal(line(J, "mirror").cause, "vlan", "the whole VLAN"); assert.equal(line(J, "capture").ok, true, "the capture still holds the PC's traffic");
  J = T((a) => a.filter((x) => x.line !== "sudo ip link set eno3 up")); assert.equal(line(J, "capture").cause, "down", "eno3 never brought up");
  J = T((a) => a.map((x) => (/tcpdump .* -w /.test(x.line || "") ? Object.assign({}, x, { line: x.line.replace(M.file, "servicedesk.pcap") }) : x))); assert.equal(line(J, "capture").cause, "none", "written to the home folder: refused");
  J = T(drop("anxa", "copy running-config startup-config")); assert.equal(line(J, "saved").ok, false, "one switch unsaved");
});

test("EN-J2: other right ways pass: the SNMP settings in ~/.snmp/snmp.conf, snmpwalk, the source without both, another spare port, -Z root", () => {
  const s = seeds[0], o = () => B.open(EJ2, s), p = o().v.plan, M = p.mon, alt = String(+M.dst + 1);
  const conf = "defVersion 3\ndefSecurityName " + M.user + "\ndefSecurityLevel authPriv\ndefAuthType SHA\ndefAuthPassphrase " + M.authPw + "\ndefPrivType AES\ndefPrivPassphrase " + M.privPw + "\n";
  const J = run(o(), solve2(o(), (a) => {
    const i = a.findIndex((x) => /^snmpget /.test(x.line || ""));
    return a.slice(0, i).concat([L("nano ~/.snmp/snmp.conf"), L("^O", conf), L("^X")], a.slice(i).map((x, k) => (/^snmpget /.test(x.line || "") ? Object.assign({}, x, { line: (k % 2 ? "snmpget " : "snmpwalk ") + x.line.split(" ").slice(-2).join(" ").replace(" sysName.0", k % 2 ? " sysName.0" : " system") }) : x)))
      .map((x) => (x.t === "lay" ? Object.assign({}, x, { b: { dev: M.sw, port: alt } }) : /tcpdump .* -w /.test(x.line || "") ? Object.assign({}, x, { line: x.line.replace("tcpdump ", "tcpdump -Z root ") }) : x));
  }).map((x) => (x.dev === "sd1" && x.line ? Object.assign({}, x, { line: x.line.replace("interface gi0/" + M.dst, "interface gi0/" + alt).replace("destination interface gi0/" + M.dst, "destination interface gi0/" + alt).replace(" both", "") }) : x)));
  for (const r of B.check(J).res) assert.ok(r.ok, r.id + ": " + r.ev);
});

test("EN-J2: rungs and the ladder; a saved job replays exactly; the help never names a passphrase, the user, the group, a community or an address", () => {
  const J = B.open(EJ2, seeds[0]), p = J.v.plan, M = p.mon;
  const texts = [].concat(...EJ2.reqs.map((q) => [q.text, q.rung1(J.v, J.sim), q.rung2(J.v, J.sim), q.ok(J.v, J.sim)]), [EJ2.mason, EJ2.brief(J.v).quote]).map((x) => String(x).toLowerCase());
  for (const t of texts) for (const bad of [M.authPw, M.privPw, M.user, M.group, M.rw, p.secret, p.userPw, p.srv.pw, p.srv.fsrv.ip].map((x) => String(x).toLowerCase())) assert.ok(t.indexOf(bad) < 0, "names " + bad + ": " + t);
  const U = run(B.open(EJ2, seeds[0]), EJ2.solve(J.v).slice(0, 60));
  const R = B.restore(EJ2, JSON.parse(JSON.stringify(B.save(U))));
  assert.equal(JSON.stringify(R.sim.net), JSON.stringify(U.sim.net));
});
