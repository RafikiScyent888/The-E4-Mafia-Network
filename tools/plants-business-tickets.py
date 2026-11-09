# Plants for the small business's tickets: each defect, put into the page, the engine or a ticket, must make its check fail.
# Page plants: `ONLY=tickets-business node tools/drive.mjs`. Node plants: `node --test tests/business-tickets.test.js` (SEEDS=6).
# Contrast plants: `ONLY="business tickets" node tools/aaa.mjs tools/aaa-states.json`.
# Run it in a throwaway copy of the checkout, never in the real one:   python3 tools/plants-business-tickets.py [name ...]
import subprocess, shutil, sys, os, re
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))   # this checkout, wherever it is
PAGE = [
 ("a level 3 ticket opens while its level is locked", "js/desk/app.js", "  if (!isOpen(def.level || 1)) def = HOME_TICKETS[0];", ""),
 ("the business's records left off the ticket", "js/desk/app.js", '  if (net.site === "business" && T.v.plan) tk.appendChild(records(', '  if (false) tk.appendChild(records('),
 ("the business's ticket card says home network", "js/desk/app.js", '({ office: "office network", business: "business network" }[net.site] || "home network")', '(net.site === "office" ? "office network" : "home network")'),
 ("the business's devices given the office's buttons", "js/desk/app.js", "(biz ? BIZ_DEVICES : DEVICES).forEach", "DEVICES.forEach"),
 ("the desk's floor plan not drawn again once it's shown", "js/desk/app.js", "  if (ctx.T) renderDiagram();   /* drawn while hidden", "  if (!phy && ctx.T) renderDiagram();   /* drawn while hidden"),
 ("a business ticket's floor plan drawn from the layout, not where its devices are", "js/desk/draw.js", '  if (!sim.net.extra.build && sim.net.site !== "business") {', "  if (!sim.net.extra.build) {"),
 ("the shelves leave out the small business", "js/desk/left.js", '      if (isOpen(3)) ctx.list.filter(function (t) { return t.level === 3; })', '      if (false) ctx.list.filter(function (t) { return t.level === 3; })'),
 ("the map's small business site lists no tickets", "js/desk/left.js", ' || (s.id === "bakery" && isOpen(3))) {', ") {"),
 ("Mason never says SB-01's fix isn't saved", "js/tickets/business.js", "    if (!(st && st.access === S.id)) return \"It works right now, but the switch hasn't saved it:", "    if (false) return \"It works right now, but the switch hasn't saved it:"),
 ("Level 3 counts 1 tickets", "js/desk/levelsui.js", '" ticket" + (c.ntickets === 1 ? "" : "s")', '" tickets"'),
 ("Level 3 still says its work orders are on the way", "js/desk/levels.js", 'coming: "more tickets on the way" },', 'coming: "more work orders and its tickets on the way" },'),
 ("the counter PC's port moved to the wrong port", "js/tickets/business.js", '["configure terminal", "interface gi0/1", "switchport access vlan " + V, "end"];', '["configure terminal", "interface gi0/2", "switchport access vlan " + V, "end"];'),
 ("a switch command over SSH never reaches the notebook", "js/tickets/business.js", 'const devOut = function (f) { return (f.cmd === "serial" || f.cmd === "ssh" || f.cmd === "telnet") && typeof f.out === "string" ? f.out : ""; };', 'const devOut = function (f) { return ""; };'),
]
PAGE += [
 ("SB-02: the switch's own name for the VLAN accepted", 'js/tickets/business.js', 'return !!run && !!st && run.name === v.vname && st.name === v.vname && SB02.kept(', 'return !!run && !!st && SB02.kept('),
 ("the visitor's phone without its Wi-Fi switch", 'js/net/pages.js', 'heard: nets, radio: { on: true }, facts:', 'heard: nets, radio: null, facts:'),
 ("the switches' console password left off the card", 'js/tickets/business.js', '["Console passwords", "the router " + p.rtConsole + " · both switches " + p.swConsole],', '["Console passwords", "the router " + p.rtConsole],'),
 ('a ping across the router to a VLAN nothing answers on crashes Step through', 'js/net/cmd.js', '  if (rt.fail === "no-reply" && !rt.local && rt.via && sim.d[rt.via] && !(rt.owner && rt.owner.length)) {', '  if (false) {'),
 ("SB-02's evidence blind to a VLAN missing from show vlan brief", 'js/tickets/business.js', 'f.on === v.sw && /VLAN Name\\s+Status\\s+Ports/.test(o) && !new RegExp("^" + v.vlan + "\\\\s", "m").test(o)', 'f.on === v.sw && /NEVER/.test(o) && !new RegExp("^" + v.vlan + "\\\\s", "m").test(o)')]
PAGE += [
 ('SB-03: a trunk carrying every VLAN accepted', 'js/tickets/business.js', '  rightList(al, v) { return carriesAll(al, v.lost) && (v.before', '  rightList(al, v) { return carriesAll(al, v.lost) || (v.before')]
PAGE += [
 ("SB-04: the router's records left off the card", 'js/tickets/business.js', '    ["The router", p.rtHost + " · by SSH from a staff PC at " + S.gw +', '    ["The router", p.rtHost + " · by SSH from a staff PC" +')]
PAGE += [
 ("SB-05: the provider's letter left off the card", 'js/tickets/business.js', '].concat(p.fixed ? [["The provider", "fixed address "', '].concat(false ? [["The provider", "fixed address "'),
 ("the provider's gateway never answers a ping", 'js/net/sim.js', '      if (!this.wanHopOk(w, rt) && dst !== w.gw) return { fail: "no-reply", src: src,', '      if (!this.wanHopOk(w, rt)) return { fail: "no-reply", src: src,')]
# each built ticket left off the desk, from the ticket list as it stands (so a new ticket needs nothing here)
_src = open("js/tickets/business.js").read()
_m = re.search(r"export const BUSINESS_TICKETS = \[([^\]]*)\];", _src)
_ids = [x.strip() for x in _m.group(1).split(",")]
PAGE += [(t[:2] + "-" + t[2:] + " left off the desk", "js/tickets/business.js", _m.group(0), "export const BUSINESS_TICKETS = [" + ", ".join(x for x in _ids if x != t) + "];") for t in _ids]
PAGE += [('the native VLAN mismatch never logged', 'js/net/cmd.js', '    if (!p || !q || p.mode !== "trunk" || q.mode !== "trunk" || p.shutdown || q.shutdown || p.native === q.native) continue;', '    continue;')]
NODE = [
 ("a fix left unsaved counts as fixed", "js/tickets/business.js", "return port(run) && port(st) && !!a", "return port(run) && !!a"),
 ("every spare port unparked counts as fixed", "js/tickets/business.js", "    return [\"GigabitEthernet0/4\"].concat(", "    return true || [\"GigabitEthernet0/4\"].concat("),
 ("a ping to the internet proves it", "js/tickets/business.js", '(f.cmd === "ping" && f.dev === "pc" && f.replies > 0 && (f.who || []).indexOf("printer") >= 0)', '(f.cmd === "ping" && f.dev === "pc" && f.replies > 0)'),
 ("the PC never asks again after the plant (it keeps its staff address)", "js/tickets/business.js", '    exec(sim, "pc", "ipconfig /renew");   /* the PC asked again', '    /* exec(sim, "pc", "ipconfig /renew"); */   /* the PC asked again'),
 ("a fix hint names the staff VLAN", "js/tickets/business.js", '"Put that one port back in the VLAN the records give the staff,', '"Put that one port back in VLAN " + v.plan.vlans.staff.id + ", the staff\'s,'),
 ("the records leave out the back switch", "js/tickets/business.js", '    ["The back switch", p.bswHost + " · at its console', '    ["The back switch", "at its console'),
 ("the records leave out the department's VLAN", "js/tickets/business.js", 'V.dept ? vl("dept", cap(V.dept.name.toLowerCase()) + " VLAN") : null,', "null,"),
 ("the ticket engine drops the phones' Wi-Fi switch", "js/tickets/engine.js", "joinssid: 1, apnet: 1, radio: 1, cabinet: 1 };", "joinssid: 1, apnet: 1, cabinet: 1 };"),
 ("the ticket engine drops a phone joining a network", "js/tickets/engine.js", "joinssid: 1, apnet: 1, radio: 1, cabinet: 1 };", "apnet: 1, radio: 1, cabinet: 1 };"),
 ("the ticket engine drops the closet cabinet", "js/tickets/engine.js", "joinssid: 1, apnet: 1, radio: 1, cabinet: 1 };", "joinssid: 1, apnet: 1, radio: 1 };"),
 ("a wrong option left without its reason", "js/tickets/business.js", 'why: "The manager\'s PC, in the staff VLAN on the same closet switch, prints and gets online. show interfaces trunk lists the staff VLAN on the router\'s port." },', 'why: "" },'),
]
NODE += [('SB-02: the VLAN put back unsaved counts', 'js/tickets/business.js', 'return !!run && !!st && run.name === v.vname && st.name === v.vname', 'return !!run && run.name === v.vname'),
 ('SB-02: another VLAN lost on the way counts', 'js/tickets/business.js', '  kept(sim, v, saved) { return ["msw", "bsw"].every(', '  kept(sim, v, saved) { return true || ["msw", "bsw"].every('),
 ("SB-02: the back PC's ping to itself proves it", 'js/tickets/business.js', 'if (v.kind === "staff") return f.cmd === "ping" && f.dev === "bpc" && f.replies > 0 && (f.who || []).some(function (w) { return w !== "bpc"; });', 'if (v.kind === "staff") return f.cmd === "ping" && f.dev === "bpc" && f.replies > 0;'),
 ('SB-02: the back PC left on 169.254 counts', 'js/tickets/business.js', 'if (v.kind === "staff") { const a = sim.addr("bpc"); return !!a && a.kind === "dhcp" && inNet(a.ip, S.net, 24) && online(sim, "bpc"); }', 'if (v.kind === "staff") return true;'),
 ('SB-02: a hint names the VLAN', 'js/tickets/business.js', '"Put back what\'s missing on that switch, named as the records name it.', '"Put back VLAN " + v.vlan + " on that switch, named as the records name it.')]
NODE += [("SB-03: the trunk's list put back unsaved counts", 'js/tickets/business.js', '  fixed(sim, v) { return SB03.rightList(allowedOf(sim, "msw", v.port), v) && SB03.rightList(allowedOf(sim, "msw", v.port, true), v) &&', '  fixed(sim, v) { return SB03.rightList(allowedOf(sim, "msw", v.port), v) &&'),
 ('SB-03: the department left off the back trunk counts', 'js/tickets/business.js', '&& online(sim, "bpc") && online(sim, "dpc1"); }\n    if (v.kind === "ap") { const g', '&& online(sim, "bpc"); }\n    if (v.kind === "ap") { const g'),
 ("SB-03: a hint names the trunk's command", 'js/tickets/business.js', '"Add back only what\'s missing, to what that trunk carries now:', '"switchport trunk allowed vlan add what\'s missing, to what that trunk carries now:')]
NODE += [('SB-04: the pool put right unsaved counts', 'js/tickets/business.js', '  fixed(sim, v) { return SB04.poolsRight(sim, v) && SB04.poolsRight(sim, v, true) &&', '  fixed(sim, v) { return SB04.poolsRight(sim, v) &&'),
 ('SB-04: the PCs never asking again counts', 'js/tickets/business.js', 'return !!a && a.kind === "dhcp" && a.gw === v.gw && online(sim, id); }) && online(sim, "mgr"); },', 'return true; }) && online(sim, "mgr"); },'),
 ('SB-04: a gateway typed in on each PC counts', 'js/tickets/business.js', '  fixed(sim, v) { return SB04.poolsRight(sim, v) && SB04.poolsRight(sim, v, true) && v.devs.every(', '  fixed(sim, v) { return v.devs.every('),
 ("SB-04: a hint names the pool's command", 'js/tickets/business.js', '"Give that pool the gateway the records give the VLAN,', '"Give that pool a default-router of the gateway the records give the VLAN,')]
NODE += [('SB-05: the right route beside the wrong one counts', 'js/tickets/business.js', '  rightRoutes(sim, v, saved) { const D = defaults(sim, saved); return D.length === 1 && D[0].nh === v.gw; },', '  rightRoutes(sim, v, saved) { const D = defaults(sim, saved); return D.some(function (x) { return x.nh === v.gw; }); },'),
 ('SB-05: the route put right unsaved counts', 'js/tickets/business.js', '  fixed(sim, v) { return SB05.rightRoutes(sim, v) && SB05.rightRoutes(sim, v, true) &&', '  fixed(sim, v) { return SB05.rightRoutes(sim, v) &&'),
 ('SB-05: a tracert to the router itself proves it', 'js/tickets/business.js', 'proves(f) { return /^(pc|mgr|bpc)$/.test(f.dev) && ((f.cmd === "ping" && !!f.internet && f.replies > 0) || (f.cmd === "tracert" && f.ok === true && !/^(10|127)\\.|^192\\.168\\./.test(String(f.target)))); },', 'proves(f) { return /^(pc|mgr|bpc)$/.test(f.dev) && ((f.cmd === "ping" && !!f.internet && f.replies > 0) || (f.cmd === "tracert" && f.ok === true)); },'),
 ('SB-05: a hint names the route', 'js/tickets/business.js', '"The records hold the provider\'s letter: the gateway the business\'s way out goes through."', '"The records hold the provider\'s letter: ip route 0.0.0.0 0.0.0.0 to the gateway the business\'s way out goes through."')]
NODE += [('SB-06: part of the roles put right counts', 'js/tickets/business.js', 'return Object.keys(v.roles).every(function (n) { return R[n] === v.roles[n]; }) && Object.keys(R).every(function (n) { return v.roles[n] === R[n]; }); },', 'return R["GigabitEthernet0/0"] === "outside"; },'),
 ('SB-06: the roles put right unsaved count', 'js/tickets/business.js', '  fixed(sim, v) { return SB06.rolesRight(sim, v) && SB06.rolesRight(sim, v, true) &&', '  fixed(sim, v) { return SB06.rolesRight(sim, v) &&'),
 ('SB-06: a hint names the NAT commands', 'js/tickets/business.js', '"Mark each interface for the side it\'s really on:', '"Mark each interface ip nat inside or ip nat outside for the side it\'s really on:')]
NODE += [('SB-07: a list that permits anything counts', 'js/tickets/business.js', '  listRight(sim, v, saved) { const L = natList(sim, saved).slice().sort().join("|"); return L === v.before.slice().sort().join("|"); },', '  listRight(sim, v, saved) { const L = natList(sim, saved); return L.indexOf("permit any") >= 0 || L.slice().sort().join("|") === v.before.slice().sort().join("|"); },'),
 ('SB-07: the wrong line left in counts', 'js/tickets/business.js', '  listRight(sim, v, saved) { const L = natList(sim, saved).slice().sort().join("|"); return L === v.before.slice().sort().join("|"); },', '  listRight(sim, v, saved) { const L = natList(sim, saved); return v.before.every(function (k) { return L.indexOf(k) >= 0; }); },'),
 ("SB-07: a hint names the list's command", 'js/tickets/business.js', '"Make the list match that network as the records give it, network and wildcard,', '"Use access-list 1 permit to match that network as the records give it, network and wildcard,')]
NODE += [('SB-08: the other end matched to it counts', 'js/tickets/business.js', '  nativesRight(sim, v, saved) { return nativeOf(sim, "msw", TRUNK.msw, saved) === v.native && nativeOf(sim, "bsw", TRUNK.bsw, saved) === v.native; },', '  nativesRight(sim, v, saved) { return nativeOf(sim, "msw", TRUNK.msw, saved) === nativeOf(sim, "bsw", TRUNK.bsw, saved); },'),
 ('SB-08: the native put back unsaved counts', 'js/tickets/business.js', '  fixed(sim, v) { return SB08.nativesRight(sim, v) && SB08.nativesRight(sim, v, true) &&', '  fixed(sim, v) { return SB08.nativesRight(sim, v) &&'),
 ('SB-08: a hint names the native VLAN command', 'js/tickets/business.js', '"Put that end back as the records have it.', '"Put that end\'s switchport trunk native vlan back as the records have it.')]
AAA = [
 ("the cabinet's label left without its plate on the desk's floor plan", "js/desk/app.js", 'if (phy) plates($("plan"), ".rl, .ns, .cabl", "#f4f6fb");', 'if (phy) plates($("plan"), ".rl, .ns", "#f4f6fb");', "SB-01 the floor plan"),
 ("the records' passwords faint", "css/e4.css", ".office-recs dd { margin: 0; color: var(--ink);", ".office-recs dd { margin: 0; color: #9aa3b5;", "SB-01 the ticket card"),
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
        if kind == "page": r = subprocess.run(["node", "tools/drive.mjs"], env=dict(os.environ, ONLY="tickets-business"), capture_output=True, text=True, timeout=2400)
        elif kind == "node": r = subprocess.run(["node", "--test", "tests/business-tickets.test.js"], env=dict(os.environ, SEEDS="6"), capture_output=True, text=True, timeout=2400)
        else: r = subprocess.run(["node", "tools/aaa.mjs", "tools/aaa-states.json"], env=dict(os.environ, ONLY=extra), capture_output=True, text=True, timeout=2400)
        out = r.stdout.strip().splitlines()
        if kind == "aaa": r.returncode = 1 if any(l.startswith("FAIL overall") for l in out) else 0   # the contrast tool's verdict is its last line, not its exit code
        fails = [l for l in out if l.startswith(("SB-", "business tickets", "not ok", "FAIL ", "levels"))] or [l for l in out if "stopped" in l or "rror" in l]
        print(("CAUGHT" if r.returncode else "MISSED") + " · " + kind + " · " + name + " · " + str(len(fails)) + " failing" + ("" if not fails else ": " + fails[0][:170]), flush=True)
        if not r.returncode: bad = 1
    finally:
        shutil.move(bak, f)
for p in PAGE: run("page", *p)
for p in NODE: run("node", *p)
for p in AAA: run("aaa", *p[:4], extra=p[4])
sys.exit(bad)
