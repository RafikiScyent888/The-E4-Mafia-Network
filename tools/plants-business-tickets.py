# Plants for the small business's tickets: each defect, put into the page, the engine or a ticket, must make its check fail.
# Page plants: `ONLY=tickets-business node tools/drive.mjs`. Node plants: `node --test tests/business-tickets.test.js` (SEEDS=6).
# Contrast plants: `ONLY="business tickets" node tools/aaa.mjs tools/aaa-states.json`.
# Run it in a throwaway copy of the checkout, never in the real one:   python3 tools/plants-business-tickets.py [name ...]
import subprocess, shutil, sys, os
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))   # this checkout, wherever it is
PAGE = [
 ("a level 3 ticket opens while its level is locked", "js/desk/app.js", "  if (!isOpen(def.level || 1)) def = HOME_TICKETS[0];", ""),
 ("SB-01 left off the desk", "js/tickets/business.js", "export const BUSINESS_TICKETS = [SB01, SB02, SB03];", "export const BUSINESS_TICKETS = [SB02, SB03];"),
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
PAGE += [("SB-02 left off the desk", "js/tickets/business.js", "export const BUSINESS_TICKETS = [SB01, SB02, SB03];", "export const BUSINESS_TICKETS = [SB01, SB03];"),
 ("SB-02: the switch's own name for the VLAN accepted", 'js/tickets/business.js', 'return !!run && !!st && run.name === v.vname && st.name === v.vname && SB02.kept(', 'return !!run && !!st && SB02.kept('),
 ("the visitor's phone without its Wi-Fi switch", 'js/net/pages.js', 'heard: nets, radio: { on: true }, facts:', 'heard: nets, radio: null, facts:'),
 ("the switches' console password left off the card", 'js/tickets/business.js', '["Console passwords", "the router " + p.rtConsole + " · both switches " + p.swConsole],', '["Console passwords", "the router " + p.rtConsole],'),
 ('a ping across the router to a VLAN nothing answers on crashes Step through', 'js/net/cmd.js', '  if (rt.fail === "no-reply" && !rt.local && rt.via && sim.d[rt.via] && !(rt.owner && rt.owner.length)) {', '  if (false) {'),
 ("SB-02's evidence blind to a VLAN missing from show vlan brief", 'js/tickets/business.js', 'f.on === v.sw && /VLAN Name\\s+Status\\s+Ports/.test(o) && !new RegExp("^" + v.vlan + "\\\\s", "m").test(o)', 'f.on === v.sw && /NEVER/.test(o) && !new RegExp("^" + v.vlan + "\\\\s", "m").test(o)')]
PAGE += [('SB-03 left off the desk', 'js/tickets/business.js', 'export const BUSINESS_TICKETS = [SB01, SB02, SB03];', 'export const BUSINESS_TICKETS = [SB01, SB02];'),
 ('SB-03: a trunk carrying every VLAN accepted', 'js/tickets/business.js', '  rightList(al, v) { return carriesAll(al, v.lost) && (v.before', '  rightList(al, v) { return carriesAll(al, v.lost) || (v.before')]
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
