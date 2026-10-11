/* Build mode: the client jobs on many generated houses. The work order
   fails at the start for the real reason, the scripted solution passes,
   other right ways pass too, the tempting wrong ways fail the line they
   should for the cause they should, checking changes nothing, a saved job
   replays exactly, Mason's ladder climbs and never names the answer, and
   random building never breaks the checker. */
import test from "node:test";
import assert from "node:assert/strict";
import { JOBS } from "../js/build/jobs.js";
import * as B from "../js/build/engine.js";
import { exec } from "../js/net/cmd.js";
import { runLength } from "../js/net/sim.js";
import { rng } from "../js/net/util.js";
import { HOME_TICKETS as TICKETS } from "../js/tickets/home.js";
import * as TE from "../js/tickets/engine.js";
import { physicalState } from "../js/net/physical.js";

const N = Number(process.env.SEEDS || 150);
const byId = Object.fromEntries(JOBS.map((d) => [d.id, d]));
const seeds = (id) => Array.from({ length: N }, (_, i) => 3000 + i * 7919 + id.length);
const E = (dev, port) => ({ dev, port });
const line = (J, id) => B.evaluate(J.def.reqs.find((q) => q.id === id), J.sim, J.v);
const run = (J, acts) => { for (const a of acts) { const r = B.act(J, a); assert.notEqual(r && r.result && r.result.ok, false, "refused: " + JSON.stringify(a) + " " + JSON.stringify(r && r.result)); } };
const solved = (J) => { const c = B.check(J); return c.res.every((x) => x.ok); };
const without = (acts, pred) => acts.filter((a) => !pred(a));

test("every job starts with its work still to do, for the real reason", () => {
  for (const def of JOBS) for (const s of seeds(def.id)) {
    const J = B.open(def, s), c = B.check(J);
    for (const r of c.res) {
      if (r.id === "keep") { assert.ok(r.ok, def.id + " starts with the house working"); continue; }
      assert.equal(r.ok, false, def.id + " " + r.id + " met before any work, seed " + s);
      assert.ok(r.ev && r.ev.length > 10, def.id + " " + r.id + ": no evidence");
    }
    assert.equal(J.done, false);
  }
});

test("the scripted solution passes every line, on every house", () => {
  for (const def of JOBS) for (const s of seeds(def.id)) {
    const J = B.open(def, s);
    run(J, def.solve(J.v, J.sim));
    const c = B.check(J);
    for (const r of c.res) assert.ok(r.ok, def.id + " " + r.id + " not met after the solution, seed " + s + ": " + r.ev);
    assert.equal(J.done, true);
  }
});

test("J1: other right ways pass too (the router in another room, a switch, joining after the rename)", () => {
  for (const s of seeds("J1").slice(0, 60)) {
    const def = byId.J1, J = B.open(def, s);
    run(J, [{ t: "place", dev: "router", room: "office" }, { t: "place", dev: "pc", room: "office" }, { t: "place", dev: "tv", room: "living" },
      { t: "lay", a: E("router", "WAN"), b: E("modem", "ETH") }, { t: "lay", a: E("pc", "NIC"), b: E("router", "LAN 3") }, { t: "lay", a: E("router", "LAN 4"), b: E("tv", "LAN") },
      { t: "router", page: "admin", values: { newPassword: true } }, { t: "router", page: "wifi", values: { newPassword: true } }, { t: "router", page: "wifi", values: { ssid: "Casa " + s } },
      { t: "join", dev: "laptop" }, { t: "join", dev: "phone" }]);
    assert.ok(solved(J), "router in the office, seed " + s + ": " + JSON.stringify(J.last.res.filter((x) => !x.ok)));
    assert.equal(J.sim.cableAt("modem", "ETH").length, runLength("living", "office"), "the run is as long as the house says");
  }
});

test("J1: the tempting wrong ways fail the right line, for the right reason", () => {
  for (const s of seeds("J1").slice(0, 60)) {
    const def = byId.J1, sol = def.solve(byId.J1.start(s).v);
    const tryIt = function (acts) { const J = B.open(def, s); run(J, acts); return J; };
    /* the modem into a LAN port: the router has nothing to share */
    let J = tryIt(sol.map((a) => a.t === "lay" && a.b.dev === "router" && a.b.port === "WAN" ? { t: "lay", a: a.a, b: E("router", "LAN 3") } : a));
    assert.equal(line(J, "router").real.id, "port"); assert.equal(line(J, "pc").real.id, "wan"); assert.equal(line(J, "wifi").real.id, "wan");
    assert.match(line(J, "router").ev, /INTERNET \(WAN\)/);
    /* the PC straight into the modem: no router, no address */
    J = tryIt(without(sol, (a) => a.t === "lay").concat([{ t: "lay", a: E("modem", "ETH"), b: E("pc", "NIC") }]));
    assert.equal(line(J, "router").real.id, "dev"); assert.equal(line(J, "pc").real.id, "lan"); assert.match(line(J, "pc").ev, /169\.254/);
    /* the PC into the router's internet port */
    J = tryIt(without(sol, (a) => a.t === "lay").concat([{ t: "lay", a: E("router", "WAN"), b: E("pc", "NIC") }]));
    assert.equal(line(J, "pc").real.id, "lan"); assert.equal(line(J, "router").real.id, "none");
    /* the PC in the wrong room */
    J = tryIt(sol.map((a) => a.t === "place" && a.dev === "pc" ? { t: "place", dev: "pc", room: "living" } : a));
    assert.equal(line(J, "pc").real.id, "room"); assert.ok(line(J, "tv").ok);
    /* joined before the rename: the devices look for the old name */
    J = tryIt(without(sol, (a) => a.t === "join").slice(0, 6).concat([{ t: "join", dev: "phone" }, { t: "join", dev: "laptop" }], sol.slice(6, 9)));
    assert.equal(line(J, "wifi").real.id, "name"); assert.match(line(J, "wifi").ev, /ROUTER-/);
    /* joined after the rename but before the new password */
    J = tryIt(sol.slice(0, 7).concat([{ t: "join", dev: "phone" }, { t: "join", dev: "laptop" }], sol.slice(7, 9)));
    assert.equal(line(J, "wifi").real.id, "pass");
    /* hardening skipped */
    J = tryIt(sol.filter((a) => !(a.t === "router" && a.page === "admin")));
    assert.equal(line(J, "admin").real.id, "admin"); assert.ok(line(J, "wifisec").ok);
    J = tryIt(sol.filter((a) => !(a.t === "router" && a.values.newPassword && a.page === "wifi")));
    assert.equal(line(J, "wifisec").real.id, "pass"); assert.ok(line(J, "wifi").ok, "with the label's password the devices still join");
    J = tryIt(sol.filter((a) => !(a.t === "router" && a.values.ssid)).map((a) => a));
    assert.equal(line(J, "wifisec").real.id, "name");
  }
});

test("J2: the printer reserved on the router (then restarted) passes; the reservation alone doesn't yet", () => {
  for (const s of seeds("J2").slice(0, 60)) {
    const def = byId.J2, J = B.open(def, s), sol = def.solve(J.v, J.sim).filter((a) => a.t !== "client" && a.t !== "pcprinter");
    run(J, sol);
    const mac = J.sim.d.printer.ifaces[0].mac, r = J.sim.d.router, want = J.sim.net.prefix + "." + (+r.dhcp.end.split(".")[3] - 1);
    assert.equal(line(J, "printer").real.id, "float");
    const lease = J.sim.addr("printer").ip;
    run(J, [{ t: "pcprinter", ip: lease }]);
    assert.ok(line(J, "print").ok, "printing to today's lease works today"); assert.equal(line(J, "printer").ok, false, "but the printer isn't fixed");
    run(J, [{ t: "router", page: "reservation-add", values: { name: "Printer", mac: mac, ip: want } }]);
    if (want !== lease) { assert.equal(line(J, "printer").real.id, "stale", "reserved, not picked up yet"); }
    run(J, [{ t: "power", dev: "printer" }, { t: "pcprinter", ip: want }]);
    assert.equal(J.sim.addr("printer").ip, want);
    assert.ok(solved(J), "seed " + s + ": " + JSON.stringify(J.last.res.filter((x) => !x.ok)));
  }
});

test("J2: the tempting wrong ways fail the right line, for the right reason", () => {
  for (const s of seeds("J2").slice(0, 60)) {
    const def = byId.J2, J0 = B.open(def, s), sol = def.solve(J0.v, J0.sim), r = J0.sim.d.router, pre = J0.sim.net.prefix;
    const tryIt = function (acts) { const J = B.open(def, s); run(J, acts); return J; };
    const withPrinter = (ip, mask) => sol.map((a) => a.t === "client" ? { t: "client", dev: "printer", values: { mode: "static", ip: ip, mask: mask || r.lan.mask, gw: r.lan.ip } } : a.t === "pcprinter" ? { t: "pcprinter", ip: ip } : a);
    /* no switch: two runs through the wall */
    let J = tryIt(without(sol, (a) => a.t === "lay" || (a.t === "place" && a.dev === "switch")).concat([{ t: "lay", a: E("router", "LAN 1"), b: E("pc", "NIC") }, { t: "lay", a: E("router", "LAN 3"), b: E("printer", "NET") }]));
    assert.equal(line(J, "wall").real.id, "many"); assert.ok(line(J, "pc").ok); assert.ok(line(J, "print").ok);
    /* a fixed address inside the router's range */
    const inside = pre + "." + (+r.dhcp.end.split(".")[3] - 2);
    J = tryIt(withPrinter(inside));
    assert.equal(line(J, "printer").real.id, "range"); assert.ok(line(J, "print").ok, "it prints today: the trap is tomorrow");
    /* a fixed address on another network */
    J = tryIt(withPrinter("10.0.0.5", "255.255.255.0"));
    assert.equal(line(J, "printer").real.id, "net"); assert.equal(line(J, "print").real.id, "reach");
    /* the right network, the wrong mask */
    J = tryIt(withPrinter(pre + ".5", "255.255.0.0"));
    assert.equal(line(J, "printer").real.id, "net");
    /* the TV's address */
    const tv = J0.sim.addr("tv").ip;
    J = tryIt(withPrinter(tv));
    assert.equal(line(J, "printer").real.id, "range");   /* the TV's lease is in the range: the first thing wrong */
    J = tryIt(withPrinter(r.lan.ip));
    assert.equal(line(J, "printer").real.id, "twin", "the router's own address");
    /* the PC pointed somewhere else, or nowhere */
    J = tryIt(sol.filter((a) => a.t !== "pcprinter"));
    assert.equal(line(J, "print").real.id, "none"); assert.ok(line(J, "printer").ok);
    J = tryIt(sol.map((a) => a.t === "pcprinter" ? { t: "pcprinter", ip: pre + ".6" } : a));
    assert.equal(line(J, "print").real.id, "wrong");
    /* breaking what worked: the TV's cable pulled to free a port */
    J = tryIt(sol);
    run(J, [{ t: "pull", cable: J.sim.cableAt("tv", "LAN").id }]);
    assert.equal(line(J, "keep").real.id, "cable"); assert.match(line(J, "keep").ev, /TV/);
    /* the router moved into the office: the modem and the TV both have to come through the wall */
    J = tryIt([]);
    run(J, [{ t: "pull", cable: J.sim.cableAt("modem", "ETH").id }, { t: "pull", cable: J.sim.cableAt("tv", "LAN").id }, { t: "place", dev: "router", room: "office" }]);
    run(J, sol.filter((a) => a.t !== "lay").concat([{ t: "lay", a: E("modem", "ETH"), b: E("router", "WAN") }, { t: "lay", a: E("router", "LAN 2"), b: E("tv", "LAN") }, { t: "lay", a: E("router", "LAN 1"), b: E("pc", "NIC") }, { t: "lay", a: E("router", "LAN 3"), b: E("printer", "NET") }]));
    assert.equal(line(J, "wall").real.id, "many"); assert.ok(line(J, "keep").ok);
  }
});

test("J3: the tempting wrong ways fail the right line, for the right reason; other right ways pass", () => {
  let heat = 0;
  for (const s of seeds("J3").slice(0, 80)) {
    const def = byId.J3, J0 = B.open(def, s), v = J0.v, sol = def.solve(v, J0.sim), inj = v.heat ? "injector2" : "injector", other = v.heat ? "injector" : "injector2";
    if (v.heat) heat++;
    const tryIt = function (acts) { const J = B.open(def, s); run(J, acts); return J; };
    const swapInj = (a) => JSON.parse(JSON.stringify(a).split('"' + inj + '"').join('"' + other + '"'));
    /* the other injector: right for the plain camera, short for the one with the heater */
    let J = tryIt(sol.map(swapInj));
    if (v.heat) { assert.equal(line(J, "power").real.id, "short"); assert.ok(line(J, "cam").ok, "it starts, on limited power"); assert.match(line(J, "power").ev, /limited/); }
    else assert.ok(solved(J), "the plain camera runs on either injector");
    /* straight into the switch: no power; the injector the wrong way round: no power either */
    J = tryIt([{ t: "place", dev: "camera", room: "porch" }, { t: "lay", a: E("switch", "4"), b: E("camera", "LAN") }]);
    assert.equal(line(J, "cam").real.id, "poe"); assert.equal(line(J, "power").real.id, "off");
    J = tryIt([{ t: "place", dev: inj, room: "office" }, { t: "place", dev: "camera", room: "porch" }, { t: "lay", a: E("switch", "4"), b: E(inj, "PoE OUT") }, { t: "lay", a: E(inj, "DATA IN"), b: E("camera", "LAN") }]);
    assert.equal(line(J, "cam").real.id, "poe");
    /* powered, but the injector's DATA IN left empty; the injector's own adapter pulled */
    J = tryIt(sol.slice(0, 2).concat([sol[3]]));
    assert.equal(line(J, "cam").real.id, "data"); assert.equal(J.sim.on("camera"), true);
    J = tryIt(sol.concat([{ t: "injector", dev: inj, values: { power: false } }]));
    assert.equal(line(J, "cam").real.id, "plug");
    /* its address: on DHCP with nothing to hold it; reserved but not restarted */
    J = tryIt(sol.slice(0, 4));
    assert.equal(line(J, "fixed").real.id, "float"); assert.ok(line(J, "cam").ok);
    const lease = J.sim.addr("camera").ip, want = sol[4].values.ip;
    J = tryIt(sol.slice(0, 5));
    if (lease !== want) assert.equal(line(J, "fixed").real.id, "stale");
    /* the forward: none, to the wrong address, to the wrong port */
    J = tryIt(sol.slice(0, 6));
    assert.equal(line(J, "away").real.id, "none"); assert.ok(line(J, "fixed").ok);
    J = tryIt(sol.slice(0, 6).concat([{ t: "router", page: "forward-add", values: { name: "Camera", ext: "8443", ip: J0.sim.net.prefix + ".5", port: "443" } }]));
    assert.equal(line(J, "away").real.id, "where", "forwarded to the printer");
    J = tryIt(sol.slice(0, 6).concat([{ t: "router", page: "forward-add", values: { name: "Camera", ext: "8443", ip: want, port: "554" } }]));
    assert.equal(line(J, "away").real.id, "port");
    /* other right ways: the injector by the camera on the porch, and the camera fixed by hand outside the range */
    J = tryIt([{ t: "place", dev: inj, room: "porch" }].concat(sol.slice(1)));
    assert.ok(solved(J), "the injector on the porch, the long run before it");
    J = tryIt(sol.slice(0, 4).concat([{ t: "client", dev: "camera", values: { mode: "static", ip: J0.sim.net.prefix + ".6", mask: J0.sim.d.router.lan.mask, gw: J0.sim.d.router.lan.ip } }, { t: "router", page: "forward-add", values: { name: "Cam", ext: "8443", ip: J0.sim.net.prefix + ".6", port: "443" } }]));
    assert.ok(solved(J), "fixed by hand outside the range: " + JSON.stringify(J.last.res.filter((x) => !x.ok)));
  }
  assert.ok(heat > 15 && heat < 65, "both cameras generated (" + heat + " of 80 with the heater)");
});

test("J4: in the dead spot with no way back fails; the landing, or the bedroom with a cable back, passes", () => {
  for (const s of seeds("J4").slice(0, 80)) {
    const def = byId.J4, J0 = B.open(def, s), free = ["LAN 1", "LAN 3", "LAN 4"].find((p) => !J0.sim.cableAt("router", p));
    const tryIt = function (acts) { const J = B.open(def, s); run(J, acts); return J; };
    let J = tryIt([{ t: "place", dev: "mesh", room: "upstairs" }]);
    assert.equal(line(J, "mesh").real.id, "weak"); assert.equal(line(J, "bedroom").real.id, "weak");
    assert.match(line(J, "bedroom").ev, /44%/);
    J = tryIt([{ t: "place", dev: "mesh", room: "living" }]);
    assert.ok(line(J, "mesh").ok); assert.equal(line(J, "bedroom").real.id, "weak", "beside the router it helps nobody upstairs");
    J = tryIt([{ t: "place", dev: "mesh", room: "kitchen" }]);
    assert.equal(line(J, "bedroom").real.id, "weak");
    J = tryIt([{ t: "place", dev: "mesh", room: "landing" }]);
    assert.ok(solved(J), "the landing");
    assert.equal(J.sim.wifiLink("laptop").ap.id, "mesh");
    J = tryIt([{ t: "place", dev: "mesh", room: "upstairs" }, { t: "lay", a: E("router", free), b: E("mesh", "WAN") }]);
    assert.ok(solved(J), "the bedroom, wired back: " + JSON.stringify(J.last.res.filter((x) => !x.ok)));
    assert.equal(J.sim.meshLink().kind, "wired");
    /* a cable that leads nowhere: the TV's freed port */
    J = tryIt([{ t: "pull", cable: J0.sim.cableAt("tv", "LAN").id }, { t: "place", dev: "mesh", room: "upstairs" }, { t: "place", dev: "tv", room: "living" }, { t: "lay", a: E("tv", "LAN"), b: E("mesh", "LAN") }]);
    assert.equal(line(J, "mesh").real.id, "wire"); assert.equal(line(J, "keep").real.id, "lan");
  }
});

test("the 3D models show B2's states: the mesh node's ring, the PoE+ labels, the camera on limited power", () => {
  for (const s of seeds("J4").slice(0, 30)) {
    const J = B.open(byId.J4, s);
    run(J, [{ t: "place", dev: "mesh", room: "upstairs" }]);
    let M = physicalState(J.sim, "mesh"), ring = M.leds.find((l) => l.role === "STATUS");
    assert.deepEqual([ring.state, ring.color], ["on", "amber"], "no link back: the ring is amber");
    run(J, [{ t: "place", dev: "mesh", room: "landing" }]);
    M = physicalState(J.sim, "mesh"); ring = M.leds.find((l) => l.role === "STATUS");
    assert.deepEqual([ring.state, ring.color], ["on", "green"]);
  }
  for (const s of seeds("J3").slice(0, 40)) {
    const J = B.open(byId.J3, s), sol = byId.J3.solve(J.v, J.sim);
    run(J, sol.map((a) => JSON.parse(JSON.stringify(a).split('"injector2"').join('"injector"'))));   /* always the 802.3af one */
    const C2 = physicalState(J.sim, "camera"), says = C2.says.join(" ");
    if (J.v.heat) { assert.equal(C2.opts.poe, "PoE+ 802.3at"); assert.match(says, /PoE\+ 802\.3at, up to 25\.5 W/); assert.match(says, /limited power/); }
    else { assert.equal(C2.opts.poe, undefined); assert.doesNotMatch(says, /limited/); }
    run(J, [{ t: "place", dev: "injector2", room: "office" }]);
    const I2 = physicalState(J.sim, "injector2");
    assert.equal(I2.model, "injector"); assert.equal(I2.opts.std, "at"); assert.match(I2.says.join(" "), /IEEE 802\.3at/);
    assert.equal(I2.leds.find((l) => l.role === "PoE").state, "off", "the spare injector powers nothing");
    assert.equal(physicalState(J.sim, "injector").leds.find((l) => l.role === "PoE").state, "on");
  }
});

test("the tickets' mesh and injector behave exactly as before (build houses only work them out)", () => {
  for (const id of ["HOME-04", "HOME-13"]) for (const s of [1, 2, 3, 4, 5]) {
    const T = TE.open(TICKETS.find((d) => d.id === id), s);
    if (T.sim.d.mesh) assert.deepEqual(T.sim.meshLink(), { ok: T.sim.d.mesh.backhaul.ok && T.sim.on("mesh") && T.sim.on("router"), kind: T.sim.on("mesh") && T.sim.on("router") ? "wifi" : null, signal: T.sim.on("mesh") && T.sim.on("router") ? (T.sim.d.mesh.backhaul.ok ? 74 : 0) : undefined });
  }
});

test("cabled in any order: a PC on a switch that reaches the router later still gets its address", () => {
  for (const s of seeds("J2").slice(0, 40)) {
    const def = byId.J2, J = B.open(def, s);
    run(J, [{ t: "place", dev: "switch", room: "office" }, { t: "place", dev: "pc", room: "office" }, { t: "lay", a: E("switch", "2"), b: E("pc", "NIC") }]);
    assert.equal(J.sim.addr("pc").kind, "apipa", "nothing to ask yet: it gives itself 169.254");
    run(J, [{ t: "lay", a: E("router", "LAN 1"), b: E("switch", "1") }]);
    assert.equal(J.sim.addr("pc").kind, "dhcp", "it keeps asking, and now the router answers");
    assert.ok(line(J, "pc").ok);
  }
});

test("a device can't be moved with its cables in, or cabled in its box; ports and rooms are checked", () => {
  const def = byId.J1, J = B.open(def, 99);
  assert.equal(B.act(J, { t: "lay", a: E("modem", "ETH"), b: E("router", "WAN") }).result.ok, false, "the router is still boxed");
  assert.equal(B.act(J, { t: "place", dev: "modem", room: "office" }).result.ok, false, "the modem stays by the outlet");
  assert.equal(B.act(J, { t: "place", dev: "router", room: "attic" }).result.ok, false);
  run(J, [{ t: "place", dev: "router", room: "living" }, { t: "place", dev: "pc", room: "office" }, { t: "lay", a: E("modem", "ETH"), b: E("router", "WAN") }]);
  assert.equal(B.act(J, { t: "lay", a: E("router", "WAN"), b: E("pc", "NIC") }).result.ok, false, "the port is taken");
  assert.equal(B.act(J, { t: "lay", a: E("router", "LAN 9"), b: E("pc", "NIC") }).result.ok, false, "no such port");
  assert.equal(B.act(J, { t: "lay", a: E("pc", "NIC"), b: E("pc", "NIC") }).result.ok, false, "both ends on one device");
  assert.equal(B.act(J, { t: "place", dev: "router", room: "office" }).result.ok, false, "cabled where it is");
  run(J, [{ t: "pull", cable: J.sim.cableAt("router", "WAN").id }, { t: "place", dev: "router", room: "office" }]);
  assert.equal(J.sim.net.rooms.router, "office");
  assert.equal(B.act(J, { t: "pull", cable: "c-coax" }).result.ok, false, "the provider's coax stays");
});

test("a run over 100 m has no link, and the check says so (calibration)", () => {
  for (const s of seeds("J1").slice(0, 20)) {
    const def = byId.J1, J = B.open(def, s);
    run(J, def.solve(J.v));
    assert.ok(line(J, "pc").ok);
    J.sim.cableAt("pc", "NIC").length = 120;   /* planted: no room in this house is that far, so stretch one */
    assert.equal(J.sim.hasLink("pc"), false);
    assert.equal(line(J, "pc").real.id, "link");
  }
});

test("a met line is really met: the office PC's own ping gets replies; an unmet one really fails", () => {
  for (const s of seeds("J1").slice(0, 30)) {
    const def = byId.J1, J = B.open(def, s);
    run(J, def.solve(J.v));
    const K = B.restore(def, B.save(J));
    assert.match(exec(K.sim, "pc", "ping 203.0.113.80").out, /Reply from 203\.0\.113\.80/);
    run(K, [{ t: "pull", cable: K.sim.cableAt("pc", "NIC").id }]);
    assert.equal(line(K, "pc").real.id, "cable");
    assert.doesNotMatch(exec(K.sim, "pc", "ping 203.0.113.80").out, /Reply from 203\.0\.113\.80/);
  }
});

test("checking the job changes nothing in the network", () => {
  for (const def of JOBS) for (const s of seeds(def.id).slice(0, 40)) {
    const J = B.open(def, s), sol = def.solve(J.v, J.sim);
    for (let k = 0; k <= sol.length; k++) {
      const before = JSON.stringify(J.sim.net), n = J.sim.n, arp = JSON.stringify(J.sim.arp);
      B.check(J); B.mason(J);
      assert.equal(JSON.stringify(J.sim.net), before, def.id + ": checking changed the network");
      assert.equal(J.sim.n, n); assert.equal(JSON.stringify(J.sim.arp), arp);
      if (k < sol.length) B.act(J, sol[k]);
    }
  }
});

test("a saved job replays exactly", () => {
  for (const def of JOBS) for (const s of seeds(def.id).slice(0, 40)) {
    const J = B.open(def, s), sol = def.solve(J.v, J.sim);
    run(J, sol.slice(0, 4)); B.act(J, { t: "cmd", dev: "pc", line: "ipconfig /all" }); B.check(J); run(J, sol.slice(4)); B.act(J, { t: "print" }); B.check(J);
    J.notes = "plan: " + s;
    const K = B.restore(def, JSON.parse(JSON.stringify(B.save(J))));
    assert.equal(JSON.stringify(K.sim.net), JSON.stringify(J.sim.net));
    assert.equal(K.sim.n, J.sim.n);
    assert.deepEqual([K.checks, K.done, K.notes, K.fails], [J.checks, J.done, J.notes, J.fails]);
  }
});

test("Mason: nothing for two failing checks, then where to look, the principle, and two options forever", () => {
  for (const def of JOBS) for (const s of seeds(def.id).slice(0, 40)) {
    const J = B.open(def, s);
    const wrong = { J1: [{ t: "place", dev: "router", room: "living" }, { t: "place", dev: "pc", room: "office" }, { t: "lay", a: E("modem", "ETH"), b: E("router", "LAN 1") }],
      J2: [{ t: "place", dev: "pc", room: "office" }, { t: "place", dev: "switch", room: "office" }, { t: "lay", a: E("switch", "1"), b: E("pc", "NIC") }],
      J3: [{ t: "place", dev: "camera", room: "porch" }, { t: "lay", a: E("switch", "4"), b: E("camera", "LAN") }],   /* straight into the switch: no power */
      J4: [{ t: "place", dev: "mesh", room: "upstairs" }] }[def.id];   /* in the dead spot itself, with no way back */
    run(J, wrong);
    const seen = [];
    for (let k = 1; k <= 12; k++) { B.check(J); const m = B.mason(J); seen.push(m ? m.rung : 0); if (m && m.rung === 3) {
      assert.match(m.text, /^It's one of these two: .+, or .+\.$/);
      const first = J.last.res.find((x) => !x.ok), c = line(J, first.id);
      assert.ok(m.text.toLowerCase().includes(c.real.text.toLowerCase()), "the real cause is one of the two");
      for (const st of m.struck) { const cz = c.list.find((z) => z.text === st.text); assert.equal(cz.on, false, "struck only what the network has ruled out"); assert.ok(st.why); }
    } }
    assert.deepEqual(seen, [0, 0, 1, 2, 3, 3, 3, 3, 3, 3, 3, 3], def.id + " ladder");
    /* met lines reset their count */
    run(J, def.id === "J1" ? [{ t: "pull", cable: J.sim.cableAt("modem", "ETH").id }, { t: "lay", a: E("modem", "ETH"), b: E("router", "WAN") }] : []);
    if (def.id === "J1") { B.check(J); assert.equal(J.fails.router, 0); }
  }
});

test("no help ever names the answer: no address to set, no port to use, no name to type", () => {
  for (const def of JOBS) for (const s of seeds(def.id).slice(0, 30)) {
    const J = B.open(def, s);
    const bad = [J.v.home, J.sim.net.prefix + ".5"];
    /* what Mason really says, at every rung, on every line, as the job is worked through */
    const said = [], sol = def.solve(J.v, J.sim);
    for (let k = 0; k <= sol.length; k++) {
      for (let c = 0; c < 6; c++) { B.check(J); const m = B.mason(J); if (m) said.push(m.text, m.principle || "", ...(m.struck || []).map((x) => x.text + " " + x.why)); }
      if (k < sol.length) B.act(J, sol[k]);
    }
    assert.ok(said.length > 20, def.id + ": Mason was heard");
    for (const q of def.reqs) said.push(q.rung1(J.v, J.sim), q.rung2(J.v, J.sim));
    for (const t of said) {
      for (const b of bad) assert.ok(!t.includes(b), def.id + ": " + t);
      assert.doesNotMatch(t, /\b(LAN [1-4]|port [1-5])\b/, def.id + " names a port: " + t);
      const addrs = t.match(/\d+\.\d+\.\d+\.\d+/g) || [];
      assert.deepEqual(addrs.filter((x) => x !== "203.0.113.80"), [], def.id + " names an address: " + t);   /* the internet test address is the only one Mason says */
    }
  }
});

test("random building never breaks the checker, and an unmet line always says what stopped it", () => {
  const rooms = ["office", "living", "kitchen", "garage", "upstairs", "porch"];
  for (const def of JOBS) for (const s of seeds(def.id).slice(0, 60)) {
    const J = B.open(def, s), R = rng(s * 31 + 7), devs = Object.keys(J.sim.d).filter((d) => !["isp", "wall"].includes(d));
    for (let k = 0; k < 40; k++) {
      const pick = R();
      const dev = R.pick(devs), x = J.sim.d[dev];
      if (pick < 0.3) B.act(J, { t: "place", dev: dev, room: R.pick(rooms) });
      else if (pick < 0.7) { const d2 = R.pick(devs), P = { router: ["WAN", "LAN 1", "LAN 2", "LAN 3", "LAN 4"], switch: ["1", "2", "3", "4", "5"], modem: ["ETH"], pc: ["NIC"], printer: ["NET"], tv: ["LAN"] }; if (P[x.kind] && P[J.sim.d[d2].kind]) B.act(J, { t: "lay", a: E(dev, R.pick(P[x.kind])), b: E(d2, R.pick(P[J.sim.d[d2].kind])) }); }
      else if (pick < 0.8) { const c = R.pick(J.sim.net.cables); if (c) B.act(J, { t: "pull", cable: c.id }); }
      else if (pick < 0.85) B.act(J, { t: "join", dev: R.pick(["phone", "laptop"]) });
      else if (pick < 0.9) B.act(J, { t: "router", page: "wifi", values: R() < 0.5 ? { ssid: "Net" + k } : { newPassword: true } });
      else if (pick < 0.95 && J.sim.d.printer) B.act(J, { t: "client", dev: "printer", values: R() < 0.5 ? { mode: "dhcp" } : { mode: "static", ip: J.sim.net.prefix + "." + R.int(2, 254), mask: "255.255.255.0", gw: J.sim.d.router.lan.ip } });
      else B.act(J, { t: "cmd", dev: "pc", line: R.pick(["ipconfig", "ipconfig /renew", "ping 203.0.113.80"]) });
      for (const q of def.reqs) { const c = B.evaluate(q, J.sim, J.v); assert.ok(typeof c.ev === "string" && c.ev.length > 10, def.id + " " + q.id + " seed " + s + " step " + k + ": empty evidence"); if (!c.ok) assert.ok(c.real.not && c.real.text); }
    }
    const K = B.restore(def, B.save(J));
    assert.equal(JSON.stringify(K.sim.net), JSON.stringify(J.sim.net), "random builds replay exactly");
  }
});
