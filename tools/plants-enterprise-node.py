# Plants for Level 5 (the enterprise) in Node: each defect, put into the code, must make the enterprise tests fail.
# Run it in a throwaway copy of the checkout, never in the real one:   python3 tools/plants-enterprise-node.py [name ...]
# SEEDS=2 shortens the work orders' tests.
import subprocess, shutil, sys, os
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
TESTS = ["tests/enterprise-jobs.test.js", "tests/levels.test.js"]
if os.environ.get("TESTS"): TESTS = os.environ["TESTS"].split()
E, SV, SW, RT, CMD, LX = "js/build/enterprise.js", "js/net/svc.js", "js/net/swcli.js", "js/net/rtcli.js", "js/net/cmd.js", "js/net/linux.js"
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
 ("leaving configuration mode logs nothing", SW, 'if (CFG_MODE(was) && S.mode === "priv") devLog(S, 5, "SYS-5-CONFIG_I",', 'if (false) devLog(S, 5, "SYS-5-CONFIG_I",'),
 ("a log line typed over SSH never leaves the device", CMD, 'r.out = linkNews(sim, st.sw, r.out); drainLogs(sim, st.sw);', 'r.out = linkNews(sim, st.sw, r.out);'),
 ("a device's clock never marked as its own count", SW, 'if (n.synced) return { star: ""', 'if (true) return { star: ""'),
 ("a switch's running configuration without its time server and log host", SW, '  svcLines(sw, L);\n', ''),
 ("the router's running configuration without its time server and log host", RT, '  svcLines(r, L);\n', ''),
 ("the time server and log host never saved", SW, ', "ntp", "logHosts", "logTrap"];', '];'),
 ("chronyc clients lists nobody", LX, 'return n.synced && n.srv === id; });', 'return false; });'),
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
