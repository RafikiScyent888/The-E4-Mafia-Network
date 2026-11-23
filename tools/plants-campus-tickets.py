# Plants for the campus's tickets: each defect, put into the page, the engine or a ticket, must make its check fail.
# Page plants: `ONLY=tickets-campus node tools/drive.mjs`. Node plants: `node --test tests/campus-tickets.test.js` (SEEDS=4).
# Contrast plants: `ONLY="campus tickets" node tools/aaa.mjs tools/aaa-states.json` (one state each, named after the plant).
# Run it in a throwaway copy of the checkout, never in the real one:   python3 tools/plants-campus-tickets.py [name ...]
# The drive and the contrast tool need CHROME and E4_PIN set, as they always do. KINDS=page (or node, aaa, or a list) runs just those.
import subprocess, shutil, sys, os, re
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))   # this checkout, wherever it is
PAGE = [
 ("a level 4 ticket opens while its level is locked", "js/desk/app.js", "  if (!isOpen(def.level || 1)) def = HOME_TICKETS[0];", ""),
 ("Rafiki's records left off the campus ticket", "js/desk/app.js", '  if (net.site === "campus" && T.v.plan) tk.appendChild(records(', '  if (false) tk.appendChild(records('),
 ("the campus ticket card says business network", "js/desk/app.js", '{ office: "office network", business: "business network", campus: "campus network" }[net.site]', '{ office: "office network", business: "business network", campus: "business network" }[net.site]'),
 ("the campus's devices given the house's buttons", "js/desk/app.js", '(site === "campus" ? CAMPUS_DEVICES : biz ? BIZ_DEVICES : DEVICES)', '(biz ? BIZ_DEVICES : DEVICES)'),
 ("the shelves leave out the campus's tickets", "js/desk/left.js", "      if (isOpen(4)) ctx.list.filter(function (t) { return t.level === 4; })", "      if (false) ctx.list.filter(function (t) { return t.level === 4; })"),
 ("the map's Rafiki HQ site lists no tickets", "js/desk/left.js", ' || ((s.id === "hq" || s.id === "annex") && isOpen(4))) {', ") {"),
 ("the campus's work orders left without their titles in the queue (as live before the Ticket Desk)", "js/desk/levels.js", "BUSINESS_JOBS, BUSINESS_TICKETS, CAMPUS_JOBS, CAMPUS_TICKETS).forEach", "BUSINESS_JOBS, BUSINESS_TICKETS, CAMPUS_TICKETS).forEach"),
 ("Level 4 says nothing more is coming, with 14 tickets still to build", "js/desk/levels.js", ', planned: 25, coming: "more tickets on the way" },', ", planned: 25 },"),
 ("the records' SSH login without its password", "js/tickets/campus.js", '["Remote logins (SSH)", "user " + p.user + " · password " + p.userPw],', '["Remote logins (SSH)", "user " + p.user],'),
 ("the records leave out the access switches' addresses", "js/tickets/campus.js", '["dist1", "dist2", "acc1", "acc2", "acc3", "acc4"].map(at)', '["dist1", "dist2"].map(at)'),
 ("the port opened without shutting it brings it back from err-disabled", "js/net/swcli.js", '} else { S.sw.ports[n].shutdown = false; const st = status(S.sw, ', '} else { S.sw.ports[n].shutdown = false; if (S.sw.psRun && S.sw.psRun[n]) S.sw.psRun[n].err = false; const st = status(S.sw, '),
]
# each built ticket left off the desk, from the ticket list as it stands (so a new ticket needs nothing here)
_src = open("js/tickets/campus.js").read()
_m = re.search(r"export const CAMPUS_TICKETS = \[([^\]]*)\];", _src)
_ids = [x.strip() for x in _m.group(1).split(",")]
PAGE += [(t[:2] + "-" + t[2:] + " left off the desk", "js/tickets/campus.js", _m.group(0), "export const CAMPUS_TICKETS = [" + ", ".join(x for x in _ids if x != t) + "];") for t in _ids]
NODE = [
 ("CP-01: port security switched off counts as fixed", "js/tickets/campus.js", "&& CP01.secured(sw.ports[n], v) && CP01.secured(st, v) && online(", "&& online("),
 ("CP-01: the saved copy's port security weakened counts", "js/tickets/campus.js", "&& CP01.secured(sw.ports[n], v) && CP01.secured(st, v) && online(", "&& CP01.secured(sw.ports[n], v) && online("),
 ("CP-01: two addresses allowed counts as the records' setting", "js/tickets/campus.js", "return !!P && P.on && P.max === 1 && P.sticky", "return !!P && P.on && P.max <= 2 && P.sticky"),
 ("CP-01: restrict on a violation counts as the records' setting", "js/tickets/campus.js", 'P.sticky && P.viol === "shutdown" && P.macs.length === 1', 'P.sticky && P.macs.length === 1'),
 ("CP-01: a ping that stays inside proves it", "js/tickets/campus.js", 'return f.cmd === "ping" && f.dev === v.dev && f.replies > 0 && !!f.internet; },', 'return f.cmd === "ping" && f.dev === v.dev && f.replies > 0; },'),
 ("CP-01: the port opened without shutting it brings it back from err-disabled", "js/net/swcli.js", '} else { S.sw.ports[n].shutdown = false; const st = status(S.sw, ', '} else { S.sw.ports[n].shutdown = false; if (S.sw.psRun && S.sw.psRun[n]) S.sw.psRun[n].err = false; const st = status(S.sw, '),
 ("CP-01: a fix hint names the commands", "js/tickets/campus.js", '"The port security settings are the records\' and still right: the port only needs to come back. An err-disabled port comes back when it\'s shut and opened again."', '"The port security settings are the records\' and still right: type shutdown, then no shutdown, on the port."'),
 ("CP-01: a wrong option left without its reason", "js/tickets/campus.js", 'why: "The other desk on the same switch is online, and show interfaces trunk on " + s + " lists both uplinks trunking." }', 'why: "" }'),
 ("CP-01: the fault planted without the visitor's address as the last source", "js/tickets/campus.js", "seen: [dotMac(vm)], last: { mac: dotMac(vm), vlan: vid } };", "seen: [dotMac(vm)], last: null };"),
]
NODE += [
 ("CP-02: the template taken off altogether counts", "js/tickets/campus.js", "return !!O && !!O.passiveDefault && sameSet(O.active || [], v.ups); },", "return !!O && (!O.passiveDefault || sameSet(O.active || [], v.ups)); },"),
 ("CP-02: one uplink of two counts", "js/tickets/campus.js", "return !!O && !!O.passiveDefault && sameSet(O.active || [], v.ups); },", "return !!O && !!O.passiveDefault && v.ups.some(function (n) { return (O.active || []).indexOf(n) >= 0; }); },"),
 ("CP-02: the fix unsaved counts", "js/tickets/campus.js", "fixed(sim, v) { return CP02.ospfRight(sim, v) && CP02.ospfRight(sim, v, true) && ", "fixed(sim, v) { return CP02.ospfRight(sim, v) && "),
 ("CP-02: a static route typed by hand counts", "js/tickets/campus.js", " && JSON.stringify(sim.d[v.dev].sw.routes || []) === v.routes && online(sim, v.pc)", " && online(sim, v.pc)"),
 ("CP-02: a ping to the gateway proves it", "js/tickets/campus.js", 'return f.cmd === "ping" && f.dev === v.pc && f.replies > 0 && !!f.internet; },\n  proofText: "a ping from the desk to', 'return f.cmd === "ping" && f.dev === v.pc && f.replies > 0; },\n  proofText: "a ping from the desk to'),
 ("CP-02: the template planted in the running configuration only", "js/tickets/campus.js", "[sw.ospf, sw.startup.ospf].forEach(function (O) { O.passiveDefault = true; O.active = []; });", "[sw.ospf].forEach(function (O) { O.passiveDefault = true; O.active = []; });"),
 ("CP-02: rung 2 names the answer", "js/tickets/campus.js", "and still send no hellos: then nothing is learned across it.", "and still send no hellos (a passive interface): then nothing is learned across it."),
 ("CP-02: a wrong option left without its reason", "js/tickets/campus.js", 'why: "show ip protocols on " + s + " still routes for its network statement, and show ip ospf interface brief still lists its interfaces in area 0." },', 'why: "" },'),
 ("CP-02: show ip protocols never lists the passive interfaces", "js/net/swcli.js", 'O.passiveDefault ? ["  Passive Interface(s):", "    (every interface but " + ((O.active || []).map(short).join(", ") || "none") + ")"] : O.passive.length', 'false ? [] : O.passive.length'),
]
PAGE += [
 ("CP-02: the Annex core's address left off the records", "js/tickets/campus.js", '" · the Annex: " + A.core.host + " " + A.core.ip + " · "', '" · the Annex: " + A.core.host + " · "'),
 ("CP-02: show ip protocols never lists the passive interfaces", "js/net/swcli.js", 'O.passiveDefault ? ["  Passive Interface(s):", "    (every interface but " + ((O.active || []).map(short).join(", ") || "none") + ")"] : O.passive.length', 'false ? [] : O.passive.length'),
]
NODE += [
 ("CP-03: the fix unsaved counts", "js/tickets/campus.js", 'return sbIp(sim, "dist1", v.vid) === v.gw && sbIp(sim, "dist1", v.vid, true) === v.gw && ', 'return sbIp(sim, "dist1", v.vid) === v.gw && '),
 ("CP-03: distribution switch 1 out of the group counts", "js/tickets/campus.js", '      && sim.hsrpVips("dist1").some(function (q) { return q.vip === v.gw; }) && v.pcs.every(', '      && v.pcs.every('),
 ("CP-03: one desk on the floor online is enough", "js/tickets/campus.js", '&& v.pcs.every(function (d) { return online(sim, d); }) && online(sim, v.other);', '&& v.pcs.some(function (d) { return online(sim, d); }) && online(sim, v.other);'),
 ("CP-03: a ping to the gateway proves it", "js/tickets/campus.js", 'proves(f, sim, v) { return f.cmd === "ping" && f.dev === v.pc && f.replies > 0 && !!f.internet; },\n  proofText: "a ping from a desk on the floor', 'proves(f, sim, v) { return f.cmd === "ping" && f.dev === v.pc && f.replies > 0; },\n  proofText: "a ping from a desk on the floor'),
 ("CP-03: the typo planted in the running configuration only", "js/tickets/campus.js", "[sw, sw.startup].forEach(function (w) { w.svis[String(V.id)].standby[String(V.id)].ip = typo; });", "[sw].forEach(function (w) { w.svis[String(V.id)].standby[String(V.id)].ip = typo; });"),
 ("CP-03: rung 1 names the address", "js/tickets/campus.js", 'return "On the " + v.pcName + ": ipconfig, ping its gateway, then arp -a.', 'return "On the " + v.pcName + ": ipconfig, ping " + v.typo + ", then arp -a.'),
 ("CP-03: a wrong option left without its reason", "js/tickets/campus.js", 'why: "show standby brief on either switch has distribution switch 1 active for the floor\'s group, preempt set, distribution switch 2 standby." },', 'why: "" },'),
 ("CP-03: the standby group answers on the standby switch's address", "js/net/sim.js", "vip: act ? act.vip || (el.find(function (m) { return m.vip; }) || {}).vip : null };", "vip: sby ? sby.vip : act ? act.vip : null };"),
]
PAGE += [
 ("CP-03: the VLAN plan on the card leaves out the gateways", "js/tickets/campus.js", '(x.net ? " · " + x.net + "/24 · gateway " + x.gw : "")', '(x.net ? " · " + x.net + "/24" : "")'),
 ("CP-03: show standby brief shows no virtual address", "js/net/swcli.js", '+ pad(q.standby, 16) + (q.vip || "unknown");', '+ pad(q.standby, 16) + "unknown";'),
]
AAA = [
 ("the records' passwords faint", "css/e4.css", ".office-recs dd { margin: 0; color: var(--ink);", ".office-recs dd { margin: 0; color: #9aa3b5;", "CP-01 the card with Rafiki's records"),
]
only = sys.argv[1:]
bad = 0
def run(kind, name, f, a, b, extra=None):
    global bad
    if only and not any(o in name for o in only): return
    src = open(f).read()
    assert src.count(a) == 1, (name, src.count(a))
    bak = f + ".plant-bak"; shutil.copy(f, bak)
    open(f, "w").write(src.replace(a, b))
    try:
        if kind == "page": r = subprocess.run(["node", "tools/drive.mjs"], env=dict(os.environ, ONLY=os.environ.get("DRIVE_ONLY", "tickets-campus")), capture_output=True, text=True, timeout=5400)
        elif kind == "node": r = subprocess.run(["node", "--test", "tests/campus-tickets.test.js"], env=dict(os.environ, SEEDS=os.environ.get("SEEDS", "4")), capture_output=True, text=True, timeout=5400)
        else: r = subprocess.run(["node", "tools/aaa.mjs", "tools/aaa-states.json"], env=dict(os.environ, ONLY=extra), capture_output=True, text=True, timeout=5400)
        out = r.stdout.strip().splitlines()
        if kind == "aaa": r.returncode = 1 if any(l.startswith("FAIL overall") for l in out) else 0   # the contrast tool's verdict is its last line, not its exit code
        fails = [l for l in out if l.startswith(("CP-", "campus tickets", "not ok", "FAIL ", "levels"))] or [l for l in out if "stopped" in l or "rror" in l]
        print(("CAUGHT" if r.returncode else "MISSED") + " · " + kind + " · " + name + " · " + str(len(fails)) + " failing" + ("" if not fails else ": " + fails[0][:170]), flush=True)
        if not r.returncode: bad = 1
    finally:
        shutil.move(bak, f)
if os.environ.get("KINDS", "page,node,aaa").find("page") >= 0:
    for p in PAGE: run("page", *p)
if os.environ.get("KINDS", "page,node,aaa").find("node") >= 0:
    for p in NODE: run("node", *p)
if os.environ.get("KINDS", "page,node,aaa").find("aaa") >= 0:
    for p in AAA: run("aaa", *p[:4], extra=p[4])
sys.exit(bad)
