# Plants for the Level 2 cases in tools/models.mjs: each defect, put into the
# model or the page, must make `ONLY=office node tools/models.mjs` fail.
import subprocess, shutil, sys, os
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
PLANTS = [
 ("console plug never drawn", "js/desk/model3d.js", "console: o.console, sfp:", "console: false, sfp:"),
 ("managed switch drawn empty", "js/desk/model3d.js", "OFF.managedSwitch({ plugged: o.plugged,", "OFF.managedSwitch({ plugged: [],"),
 ("old switch lights as photographed", "assets/models/office-gear.js", "const d = led(COL.ledGreen, l[3], 0.95);", "const d = led(COL.ledGreen, true, 0.95);"),
 ("POWER back on top of port 1", "assets/models/office-gear.js", '[[-104, 15.2, "POWER", true]]', '[[-96, 18.5, "POWER", true]]'),
 ("the laptop's serial adapter never drawn", "js/desk/model3d.js", "OFF.techLaptop({ screen: o.screen, title: o.title, console: o.console })", "OFF.techLaptop({ screen: o.screen, title: o.title, console: false })"),
 ("the laptop's Ethernet port read from the wrong port", "js/net/physical.js", 'techlaptop: [["ETHERNET", "ETH"], ["USB-C", "USB-C"]]', 'techlaptop: [["ETHERNET", "NIC"], ["USB-C", "USB-C"]]'),
 ("the laptop's Ethernet light lit with no link", "js/net/physical.js", '    ports[1].lights = null;', '    ports[1].lights = null; ports[0].lights = "green";'),
 ("the back office switch drawn with no model", "js/net/physical.js", 'injector: "injector", meet: "switch", mpc: "pc", mgr: "pc" };', 'injector: "injector", mpc: "pc", mgr: "pc" };'),
 ("a crossover cable never lights the uplink", "js/net/sim.js", 'return (mdix(c.a) !== mdix(c.b)) === (c.wiring !== "crossover");', "return mdix(c.a) !== mdix(c.b);"),
 ("old switch keeps its cords", "js/desk/model3d.js", "OFF.desktopSwitch8({ plugged: o.plugged, cords: true })", "OFF.desktopSwitch8({ cords: true })"),
 ("the rack draws the preview's cords, not the sim's", "js/desk/model3d.js", "OFF.wallRack6U({ managed: true, patches: o.patches,", "OFF.wallRack6U({ managed: true,"),
 ("the rack's switch lights ignore the sim", "js/desk/model3d.js", "tabs: o.tabs, swLights: o.swLights });", "tabs: o.tabs });"),
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
        r = subprocess.run(["node", "tools/models.mjs"], env=dict(os.environ, ONLY="office"), capture_output=True, text=True, timeout=900)
        lines = r.stdout.strip().splitlines(); fail = [l for l in lines if l.startswith(("SO-J", "crashed", "page errors"))]
        print(("CAUGHT" if r.returncode else "MISSED") + " · " + name + ("" if not fail else " · " + fail[0][:140]))
        if not r.returncode: bad = 1
    finally:
        shutil.move(bak, f)
sys.exit(bad)
