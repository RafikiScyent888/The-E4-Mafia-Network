# Plants for the small office's tickets on the Ticket Desk: each defect, put
# into the page or the engine, must make `ONLY=tickets-office node
# tools/drive.mjs` fail. python3 tools/plants-office-tickets-page.py [name ...]
import subprocess, shutil, sys, os
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))   # this checkout, wherever it is
PLANTS = [
 ("a level 2 ticket opens while its level is locked", "js/desk/app.js", "  if (!isOpen(def.level || 1)) def = HOME_TICKETS[0];", ""),
 ("the office tickets left out of the level 2 queue", "js/desk/left.js", "      tickets.forEach(function (t) { ol.appendChild(el(\"li\", null, ticketButton(ctx, t))); });\n", ""),
 ("your laptop has no device button on the desk", "js/desk/app.js", '"printer", "tech", "injector"', '"printer", "injector"'),
 ("the office's ticket card says home network", "js/desk/app.js", '(net.site === "office" ? "office network" : "home network")', '"home network"'),
 ("Mason never says SO-01's fix isn't saved", "js/tickets/office.js", "  partial() { return \"It runs right now, but the switch hasn't saved it: the next power cut or reload puts the printer's port back the way it was.\"; },", "  partial() { return \"\"; },"),
 ("show version never says it came back from a power cut", "js/net/swcli.js", '"System returned to ROM by " + (sw.restart || "power-on"), "",', ''),
 ("a duplex mismatch shows no late collisions", "js/net/swcli.js", "const d = duplexEnds(p, l); if (!d.mismatch) return null;", "return null;"),
 ("a switch command's output never reaches the notebook", "js/net/cmd.js", 'line: raw.trim(), out: r.out.join("\\n") }, secret: !!r.secret, cli: true, keep: r.keep };\n}\nfunction remote', 'line: raw.trim(), out: "" }, secret: !!r.secret, cli: true, keep: r.keep };\n}\nfunction remote'),
 ("SO-04's back office switch has no device button", "js/desk/app.js", '"meet", "bsw", "mpc",', '"bsw", "mpc",'),
 ("no crossover cable in the van", "js/net/pages.js", '.concat(sim.net.site === "office" ? ["crossover"] : [])', ''),
 ("SO-06 to SO-10 left off the desk", "js/tickets/office.js", "SO05, SO06, SO07, SO08, SO09, SO10];", "SO05];"),
 ("Mason never says a fixed duplex leaves the spare PC on half", "js/tickets/office.js", "return sim.mismatched(\"pc\") ? \"It links now", "return false ? \"It links now"),
 ("SO-09's IPAM sheet missing from the desk", "js/desk/app.js", "  ipamSheet(host, { plan: T.sim.net.plan.ipam,", "  if (false) ipamSheet(host, { plan: T.sim.net.plan.ipam,"),
 ("SO-09's sheet says what's wrong before it's checked", "js/desk/app.js", "const checked = ctx.sheetChecked ||", "const checked = true ||"),
 ("the old switch's label never says what its ports can do", "js/net/pages.js", ' + (x.labelText ? " Its label: " + x.labelText + "." : "")', ''),
 ("SO-08's cable map missing from the desk", "js/desk/app.js", "  if (T.def.cablemap) {", "  if (false) {"),
 ("no probe on the patch panel's Physical tab", "js/net/pages.js", 'probe: x.kind === "patchpanel",', "probe: false,"),
 ("no way to move a patch cord", "js/net/pages.js", '      else if (pp) acts = acts.concat(["repatch"]);', ""),
 ("no module swap on the switch's Physical tab", "js/net/pages.js", "sfp: x.kind === \"mswitch\" ? Object.keys(x.sfp || {})", "sfp: false ? Object.keys(x.sfp || {})"),
 ("no LC pair swap on the fibre cord", "js/net/pages.js", 'c.kind === "fibre" ? ["look", "polarity"] :', 'c.kind === "fibre" ? ["look"] :'),
 ("SO-10's back office switch has no device button", "js/desk/app.js", '"bsw", "mpc",', '"mpc",'),
 ("the office's records left off the ticket", "js/desk/app.js", '  if (net.site === "office" && T.v.plan) tk.appendChild(officeRecords(d, T));', ""),
]
only = sys.argv[1:]
bad = 0
for name, f, a, b in PLANTS:
    if only and not any(o in name for o in only): continue
    src = open(f).read()
    assert src.count(a) == 1, (name, src.count(a))
    bak = f + ".plant-bak"; shutil.copy(f, bak)
    open(f, "w").write(src.replace(a, b))
    try:
        r = subprocess.run(["node", "tools/drive.mjs"], env=dict(os.environ, ONLY="tickets-office"), capture_output=True, text=True, timeout=1800)
        out = r.stdout.strip().splitlines()
        fails = [l for l in out if l.startswith(("SO-", "office tickets"))]
        print(("CAUGHT" if r.returncode else "MISSED") + " · " + name + " · " + str(len(fails)) + " failing" + ("" if not fails else ": " + fails[0][:150]))
        if not r.returncode: bad = 1
    finally:
        shutil.move(bak, f)
sys.exit(bad)
