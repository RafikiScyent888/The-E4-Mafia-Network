# Plants for Level 5 (the enterprise) in Node: each defect, put into the code, must make the enterprise tests fail.
# Run it in a throwaway copy of the checkout, never in the real one:   python3 tools/plants-enterprise-node.py [name ...]
# SEEDS=2 shortens the work orders' tests.
import subprocess, shutil, sys, os
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
TESTS = ["tests/enterprise-jobs.test.js", "tests/levels.test.js"]
if os.environ.get("TESTS"): TESTS = os.environ["TESTS"].split()
E, SV, SW, RT, CMD, LX, MO = "js/build/enterprise.js", "js/net/svc.js", "js/net/swcli.js", "js/net/rtcli.js", "js/net/cmd.js", "js/net/linux.js", "js/net/mon.js"
PLANTS = [
 # EN-J1's lines: every cause, each must be the one a wrong way stops at
 ("EN-J1: serve: chrony stopped passes", E, 'C("stopped", !up, "chrony isn', 'C("stopped", false, "chrony isn'),
 ("EN-J1: serve: the server's own clock not locked passes", E, 'C("nosync", up && !SV.serverSynced(sim, "fsrv"), ', 'C("nosync", false, '),
 ("EN-J1: serve: chrony running its old file passes", E, 'C("stale", stale, "chrony', 'C("stale", false, "chrony'),
 ("EN-J1: serve: no allow line passes", E, 'C("noallow", up && !stale && !S.run.allow.length, ', 'C("noallow", false, '),
 ("EN-J1: serve: an allow too narrow passes", E, 'C("narrow", !!left, ', 'C("narrow", false, '),
 ("EN-J1: sync: no NTP server passes", E, 'C("none", w === "none", ', 'C("none", false, '),
 ("EN-J1: sync: the wrong NTP server passes", E, 'C("wrong", w === "unreachable" || w === "no-ntp", ', 'C("wrong", false, '),
 ("EN-J1: sync: refused passes", E, 'C("refused", w === "refused", ', 'C("refused", false, '),
 ("EN-J1: sync: a server with no time of its own passes", E, 'C("unsynced", w === "unsynced", ', 'C("unsynced", false, '),
 ("EN-J1: listen: rsyslog stopped passes", E, 'C("stopped", !up, "rsyslog isn', 'C("stopped", false, "rsyslog isn'),
 ("EN-J1: listen: rsyslog running its old file passes", E, 'C("stale", stale, "rsyslog', 'C("stale", false, "rsyslog'),
 ("EN-J1: listen: TCP only passes", E, 'C("tcp", up && !stale && !!S.run.tcp && !S.run.udp, ', 'C("tcp", false, '),
 ("EN-J1: listen: UDP reception commented out passes", E, 'C("none", up && !stale && !S.run.udp && !S.run.tcp, ', 'C("none", false, '),
 ("EN-J1: listen: another port passes", E, 'C("port", up && !stale && !!S.run.udp && S.run.udp !== 514, ', 'C("port", false, '),
 ("EN-J1: send: no log host passes", E, 'C("nohost", !!bad && !bad.h.length, ', 'C("nohost", false, '),
 ("EN-J1: send: the wrong log host passes", E, 'C("wronghost", !!bad && bad.h.length > 0 && !bad.to, ', 'C("wronghost", false, '),
 ("EN-J1: send: a trap level under informational passes", E, 'C("trap", !!bad && bad.to && bad.t < 5, ', 'C("trap", false, '),
 ("EN-J1: send: nothing arrived passes", E, 'C("nothing", !!bad && bad.to && bad.t >= 5 && !bad.got, ', 'C("nothing", false, '),
 ("EN-J1: an unsaved device passes", E, 'return C("unsaved-" + id, unsaved(sim.d[id].sw), ', 'return C("unsaved-" + id, false, '),
 ("EN-J1: a hint names the file server's address", E, 'rung1: function () { return "show ntp status and show ntp associations on each switch and the router."; },', 'rung1: function (v) { return "show ntp associations: the server is " + v.plan.srv.fsrv.ip + "."; },'),
 ("EN-J1: the walk-through allows only one /24", E, 'return "allow " + p.srv.fsrv.ip.split(".").slice(0, 2).join(".") + ".0.0/16"; };', 'return "allow " + p.srv.fsrv.ip.split(".").slice(0, 3).join(".") + ".0/24"; };'),
 # the simulation: chrony, rsyslog, the gear's NTP and logging
 ("chrony serves whoever asks, whatever its allow lines", SV, 'return S.run.allow.some(function (n) { return inNet(src, n); }) && !S.run.deny', 'return true && !S.run.deny'),
 ("chrony's deny lines ignored", SV, ' && !S.run.deny.some(function (n) { return inNet(src, n); });', ';'),
 ("a network matches any address", SV, 'return ((ip2n(ip) & mask) >>> 0) === ((ip2n(c.net) & mask) >>> 0);', 'return true;'),
 ("an NTP server out of reach counted as answering", SV, 'const p = pathFrom(sim, dev, ip); if (!p.ok) return { ip: ip, why: "unreachable" };', 'const p = pathFrom(sim, dev, ip); if (!p.ok) return { ip: ip, ok: true, src: p.src };'),
 ("chrony locked to the internet with no sources", SV, '!S.run || !S.run.sources.length || !sim.on(id)', '!S.run || !sim.on(id)'),
 ("chrony locked to the internet with the internet cut off", SV, 'const r = sim.route(id, "8.8.8.8"); return !!(r && !r.fail && (r.internet || r.routed || r.local));', 'return true;'),
 ("a log line lands whatever rsyslog takes", SV, ' || !rsyslogUdp(sim, srv)) return false;', ') return false;'),
 ("the trap level ignored", SW, '  if (sev > trapOf(sw)) return;\n', ''),
 ("send log with no level sent at informational", SW, 'sev = sv && +sv[1] <= 7 ? +sv[1] : 7,', 'sev = sv && +sv[1] <= 7 ? +sv[1] : 6,'),
 ("leaving configuration mode logs nothing", SW, '{ devLog(S, 5, "SYS-5-CONFIG_I", "Configured from console by " + (S.via === "console" ? "console" : "vty0")); trapConfig(S); }', '{ trapConfig(S); }'),   # re-aimed 26 November 2026: EN-J2 sends a notification there too
 ("a log line typed over SSH never leaves the device", CMD, 'r.out = linkNews(sim, st.sw, r.out); drainLogs(sim, st.sw);', 'r.out = linkNews(sim, st.sw, r.out);'),
 ("a device's clock never marked as its own count", SW, 'if (n.synced) return { star: ""', 'if (true) return { star: ""'),
 ("a switch's running configuration without its time server and log host", SW, '  svcLines(sw, L);\n', ''),
 ("the router's running configuration without its time server and log host", RT, '  svcLines(r, L);\n', ''),
 ("the time server and log host never saved", SW, '"jumbo", "ntp", "logHosts", "logTrap", "snmp"', '"jumbo", "snmp"'),   # re-aimed 26 November 2026: EN-J2's keys follow them
 ("chronyc clients lists nobody", LX, 'return n.synced && n.srv === id; });', 'return false; });'),
 # EN-J2: every cause of its lines
 ("EN-J2: v2c: a read-write community left passes", E, 'C("rw", !!rw, ', 'C("rw", false, '),
 ("EN-J2: v2c: public left passes", E, 'C("ro", !rw && !!ro, ', 'C("ro", false, '),
 ("EN-J2: v3: no group passes", E, 'C("nogroup", !!ng, ', 'C("nogroup", false, '),
 ("EN-J2: v3: a group without encryption passes", E, 'C("level", !!lv, ', 'C("level", false, '),
 ("EN-J2: v3: no user passes", E, 'C("nouser", !!nu, ', 'C("nouser", false, '),
 ("EN-J2: v3: the user in another group passes", E, 'C("usergroup", !!ug, ', 'C("usergroup", false, '),
 ("EN-J2: v3: the wrong authentication passes", E, 'C("auth", !!au, ', 'C("auth", false, '),
 ("EN-J2: v3: the wrong privacy passes", E, 'C("priv", !!pv, ', 'C("priv", false, '),
 ("EN-J2: polled: a community poll counts", E, 'C("v2", !!miss && !!V12[miss], ', 'C("v2", false, '),
 ("EN-J2: polled: never polled passes", E, 'C("notyet", !!miss && !V12[miss], ', 'C("notyet", false, '),
 ("EN-J2: traps: no host passes", E, 'C("nohost", !!bad && !bad.o.hosts.length, ', 'C("nohost", false, '),
 ("EN-J2: traps: another host passes", E, 'C("wronghost", !!bad && bad.o.hosts.length > 0 && !bad.h, ', 'C("wronghost", false, '),
 ("EN-J2: traps: v3 traps pass", E, 'C("kind", !!bad && !!bad.h && bad.h.kind !== "informs" && bad.h.ver === "3", ', 'C("kind", false, '),
 ("EN-J2: traps: another version or user passes", E, 'C("as", !!bad && !!bad.h && (bad.h.ver !== "3" || bad.h.level !== "priv" || bad.h.name !== M.user), ', 'C("as", false, '),
 ("EN-J2: traps: notifications off passes", E, 'C("off", !!bad && !!bad.h && !bad.on, ', 'C("off", false, '),
 ("EN-J2: traps: nothing arrived passes", E, 'C("nothing", !!bad && !!bad.h && bad.on && !bad.got, ', 'C("nothing", false, '),
 ("EN-J2: mirror: eno3 cabled elsewhere passes", E, 'C("nocable", !on1, ', 'C("nocable", false, '),
 ("EN-J2: mirror: the destination shut passes", E, 'C("shut", on1 && sw.ports[n].shutdown, ', 'C("shut", false, '),
 ("EN-J2: mirror: no session passes", E, 'C("nosession", on1 && !sw.ports[n].shutdown && !D, ', 'C("nosession", false, '),
 ("EN-J2: mirror: a whole VLAN passes", E, 'C("vlan", !!D && !S && D.vlans.length > 0, ', 'C("vlan", false, '),
 ("EN-J2: mirror: another port passes", E, 'C("source", !!D && !S && !D.vlans.length, ', 'C("source", false, '),
 ("EN-J2: mirror: one direction passes", E, 'C("dir", !!S && S.dir !== "both", ', 'C("dir", false, '),
 ("EN-J2: capture: eno3 down passes", E, 'C("down", !P && f && f.admin === "down", ', 'C("down", false, '),
 ("EN-J2: capture: no file passes", E, 'C("none", !P && !(f && f.admin === "down"), ', 'C("none", false, '),
 ("EN-J2: capture: another computer's traffic passes", E, 'C("other", !!P && !out && !inn, ', 'C("other", false, '),
 ("EN-J2: capture: one direction passes", E, 'C("oneway", !!P && (out || inn) && !(out && inn), ', 'C("oneway", false, '),
 ("EN-J2: a hint names the monitoring user", E, 'rung1: function () { return "show snmp group and show snmp user on each device; snmpget from the file server."; },', 'rung1: function (v) { return "show snmp user " + v.plan.mon.user + " on each device."; },'),
 # EN-J2: the agent, the notifications, the mirror, tcpdump, the switch's own words
 ("any community answers", MO, 'const c = o && o.comms.find(function (k) { return k.name === q.comm; });', 'const c = o && o.comms[0];'),
 ("the authentication passphrase never checked", MO, ' || u.auth.key !== snmpKey(q.ap, q.aa))) return { err: "auth", id: id };', ')) return { err: "auth", id: id };'),
 ("the privacy passphrase never checked", MO, ' || u.priv.key !== snmpKey(q.xp, q.xa))) return { err: "decrypt", id: id };', ')) return { err: "decrypt", id: id };'),
 ("the group's security level never checked", MO, ' || want < LEVELS3.indexOf(G.level)) return { err: "authz", id: id };', ') return { err: "authz", id: id };'),
 ("a poll never remembered", MO, 'P[r.id] = { level: q.level, user: q.user }; }', '}'),
 ("v3 traps read without the sender's engine ID", MO, '    if (h.kind !== "informs" && tu.eid !== (sw.engineId || null)) return false;   /* a v3 trap is keyed to the sender\'s engine ID */\n', ''),
 ("a notification sent with traps off", SW, 'if (!o || !o.traps || (o.traps[0] !== "all" && o.traps.indexOf("config") < 0)) return;', 'if (!o) return;'),
 ("a mirror copies both ways whatever it's told", MO, 'f.dir === "both" || (f.dir === "rx" ? p.dir === "out" : p.dir === "in")', 'true'),
 ("any switch port hears a computer's traffic", MO, 'if (!M) return { link: true, sw: far.dev, port: n, frames: [{ kind: "stp", sw: far.dev }, { kind: "lldp", sw: far.dev, port: n }] };', 'if (!M) return { link: true, sw: far.dev, port: n, frames: [{ kind: "host", dev: "sd1", dir: "both" }] };'),
 ("tcpdump writes into a home folder", LX, '    if (!asRoot && /^\\/(home|root)\\//.test(path)) return ["tcpdump: " + wf + ": Permission denied"];', '    if (false) return [];'),
 ("tcpdump captures on a port that's down", LX, '  if (p && !p.admin) return ["tcpdump: " + name + ": That device is not up"];', ''),
 ("ip link set up does nothing", LX, '    p.f.admin = k === "up" ? "up" : "down"; if (sim.bump) sim.bump(); return [];', '    return [];'),
 ("the mirror's port says connected", SW, '(spanDest(sw, n) ? "monitoring" : "connected")', '"connected"'),
 ("a SNMPv3 user shows in the running configuration", SW, '    if (o.loc) L.push("snmp-server location " + o.loc);', '    Object.keys(sw.snmpUsers || {}).forEach(function (u) { L.push("snmp-server user " + u + " " + sw.snmpUsers[u].group + " v3"); });\n    if (o.loc) L.push("snmp-server location " + o.loc);'),
 ("a pipe filter takes its words as text, not a regular expression", SW, 're = (function () { try { return new RegExp(pipe[3], "i"); } catch (e) {', 're = (function () { try { throw 0; } catch (e) {'),
]
only = sys.argv[1:]
bad = 0
for P in PLANTS:
    name, edits = P[0], (P[1] if isinstance(P[1], list) else [P[1:]])
    if only and not any(o in name for o in only): continue
    for f, a, b in edits: assert open(f).read().count(a) == 1, (name, f, open(f).read().count(a))
    files = sorted(set(e[0] for e in edits))
    for f in files: shutil.copy(f, f + ".plant-bak")
    for f, a, b in edits: src = open(f).read(); open(f, "w").write(src.replace(a, b))
    try:
        r = subprocess.run(["node", "--test"] + TESTS, capture_output=True, text=True, timeout=3000)
        fails = [l for l in r.stdout.splitlines() if l.startswith("not ok")]
        print(("CAUGHT" if r.returncode else "MISSED") + " · " + name + " · " + str(len(fails)) + " failing" + ("" if not fails else ": " + fails[0][:150]), flush=True)
        if not r.returncode: bad = 1
    finally:
        for f in files: shutil.move(f + ".plant-bak", f)
sys.exit(bad)
