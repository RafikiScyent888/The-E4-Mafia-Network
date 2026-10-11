/* The 3D models in the Physical tab: on many generated houses, each fault
   a student could find with their eyes really shows on the model (plug out,
   connector loose, lights dark or amber, the cable split or crushed), the
   healthy parts look healthy, the fix changes what the model shows, every
   light is also written out in words (never colour alone), and reading the
   model never changes the network. */
import test from "node:test";
import assert from "node:assert/strict";
import { HOME_TICKETS } from "../js/tickets/home.js";
import * as E from "../js/tickets/engine.js";
import { physicalState, stateKey, MODEL_OF } from "../js/net/physical.js";
import { tabsFor } from "../js/net/pages.js";

const N = Number(process.env.SEEDS || 150);
const byId = Object.fromEntries(HOME_TICKETS.map((d) => [d.id, d]));
const seeds = (id) => Array.from({ length: N }, (_, i) => 1000 + i * 7919 + id.length);
const port = (S, name) => S.ports.find((p) => p.name === name);
const led = (S, role) => S.leds.find((l) => l.role === role);

test("every device with a Physical tab has a model, and reading it changes nothing", () => {
  for (const def of HOME_TICKETS) for (const s of seeds(def.id).slice(0, 20)) {
    const T = E.open(def, s), before = JSON.stringify(T.sim.net), n = T.sim.n;
    for (const id of Object.keys(T.sim.d)) {
      const hasTab = tabsFor(T.sim, id).some((t) => t.key === "physical");
      const S = physicalState(T.sim, id);
      if (hasTab) assert.ok(S && MODEL_OF[id], def.id + " " + id + " has a Physical tab but no model");
      if (S) { assert.ok(S.says.length > 0); assert.equal(typeof stateKey(S), "string"); }
    }
    assert.equal(JSON.stringify(T.sim.net), before, def.id + ": reading the models changed the network");
    assert.equal(T.sim.n, n, def.id + ": reading the models counted as an action");
  }
});

test("every light and port is written out in words, not left to colour", () => {
  for (const def of HOME_TICKETS) for (const s of seeds(def.id).slice(0, 10)) {
    const T = E.open(def, s);
    for (const id of Object.keys(MODEL_OF)) {
      if (!T.sim.d[id]) continue;
      const S = physicalState(T.sim, id), text = S.says.join(" ");
      for (const l of S.leds) if (!(S.model === "mesh" && l.role === "LINK" && l.state === "off")) assert.ok(text.includes(l.name + " " + (l.state === "blinking" ? "blinking" : l.state)), def.id + " " + id + ": light " + l.name + " not in words: " + text);
      for (const p of S.ports) if (p.plug !== "none" || (S.model !== "laptop" && S.model !== "mesh")) assert.ok(text.includes(p.label + ":"), def.id + " " + id + ": port " + p.label + " not in words");
      for (const p of S.ports) if (p.lights === "amber") assert.ok(/amber \(10\/100 Mb\/s\)/.test(text), "amber is named and explained");
    }
  }
});

test("a healthy house looks healthy", () => {
  for (const s of seeds("HOME-03").slice(0, 40)) {
    const T = E.open(byId["HOME-03"], s), net = T.sim.net;   /* HOME-03's fault is a setting: the cables and lights are all fine */
    const M = physicalState(T.sim, "modem");
    assert.deepEqual(M.leds.map((l) => l.state), ["on", "on", "on", "on", "on"]);
    assert.equal(port(M, "CABLE IN").plug, "in");
    const R = physicalState(T.sim, "router");
    assert.equal(led(R, "◎").state, "on");
    assert.deepEqual(R.opts.lans, [true, true, false, false]);
    assert.equal(port(R, "LAN 3").plug, "none");
    const W = physicalState(T.sim, "switch");
    for (const k of ["pc", "printer", "camera"]) { const p = port(W, String(net.ports[k])); assert.equal(p.plug, "in"); assert.equal(p.lights, "green"); }
    assert.equal(port(W, "1").lights, "green");
    assert.equal(W.opts.plugged.filter(Boolean).length, 4);
    assert.equal(port(physicalState(T.sim, "pc"), "LAN").lights, "green");
    assert.equal(port(physicalState(T.sim, "laptop"), "ETHERNET").plug, "none");
    assert.equal(physicalState(T.sim, "mesh").ports.every((p) => p.plug === "none"), true);
    const Pr = physicalState(T.sim, "printer");
    assert.ok(Pr.opts.screen.status.includes(T.sim.d.printer.ifaces[0].cfg.ip), "the printer's screen shows its real address");
    assert.equal(led(Pr, "attention").state, "off");
    assert.ok(physicalState(T.sim, "tv").opts.screen.rows.some((r) => r[1] === T.sim.addr("tv").ip), "the TV's screen shows its real address");
  }
});

test("HOME-01: the unplugged end, or the crushed run, shows on the model", () => {
  const seen = new Set();
  for (const s of seeds("HOME-01")) {
    const T = E.open(byId["HOME-01"], s), sw = String(T.v.port);
    const pc = port(physicalState(T.sim, "pc"), "LAN"), sp = port(physicalState(T.sim, "switch"), sw);
    seen.add(T.v.kind);
    assert.equal(pc.lights, "off"); assert.equal(sp.lights, "off");
    if (T.v.kind === "pc-end") { assert.equal(pc.plug, "out"); assert.equal(sp.plug, "in"); }
    if (T.v.kind === "switch-end") { assert.equal(sp.plug, "out"); assert.equal(pc.plug, "in"); }
    if (T.v.kind === "crushed") { assert.equal(pc.damage, "crushed"); assert.equal(sp.damage, null); assert.equal(pc.plug, "in"); assert.equal(sp.plug, "in"); }
    /* the fix shows too */
    if (T.v.kind === "crushed") E.act(T, { t: "replace", cable: "c-switch-pc" }); else E.act(T, { t: "reseat", cable: "c-switch-pc", end: T.v.kind === "pc-end" ? "b" : "a" });
    const pc2 = port(physicalState(T.sim, "pc"), "LAN"), sp2 = port(physicalState(T.sim, "switch"), sw);
    assert.deepEqual([pc2.plug, pc2.lights, pc2.damage, sp2.plug, sp2.lights], ["in", "green", null, "in", "green"]);
  }
  assert.equal(seen.size, 3, "all three kinds generated");
});

test("HOME-05: the loose coax shows at the modem when it is the modem end; DS blinks either way", () => {
  const seen = new Set();
  for (const s of seeds("HOME-05")) {
    const T = E.open(byId["HOME-05"], s), M = physicalState(T.sim, "modem");
    seen.add(T.v.end);
    assert.equal(port(M, "CABLE IN").plug, T.v.end === "b" ? "loose" : "in");
    assert.equal(led(M, "DS").state, "blinking"); assert.equal(led(M, "ONLINE").state, "off");
    assert.equal(led(physicalState(T.sim, "router"), "◎").state, "off");
    E.act(T, { t: "tighten", cable: "c-coax", end: T.v.end });
    const M2 = physicalState(T.sim, "modem");
    assert.equal(port(M2, "CABLE IN").plug, "in"); assert.equal(led(M2, "ONLINE").state, "on");
  }
  assert.equal(seen.size, 2);
});

test("HOME-08: amber on the switch port, and the split shows at the end it is near", () => {
  const seen = new Set();
  for (const s of seeds("HOME-08")) {
    const T = E.open(byId["HOME-08"], s), sp = port(physicalState(T.sim, "switch"), String(T.v.port)), pc = port(physicalState(T.sim, "pc"), "LAN");
    seen.add(T.v.kind || T.v.kink);
    assert.equal(sp.lights, "amber"); assert.equal(pc.lights, "green");
    assert.equal(sp.damage, T.v.kink === "a" ? "split" : null);
    assert.equal(pc.damage, T.v.kink === "b" ? "split" : null);
    E.act(T, { t: "replace", cable: "c-switch-pc" });
    const sp2 = port(physicalState(T.sim, "switch"), String(T.v.port));
    assert.equal(sp2.lights, "green"); assert.equal(sp2.damage, null);
  }
  assert.equal(seen.size, 2, "both ends generated");
});

test("HOME-10: the old router is on the switch's spare port, LAN only, no internet light", () => {
  for (const s of seeds("HOME-10")) {
    const T = E.open(byId["HOME-10"], s);
    const W = physicalState(T.sim, "switch"), p = port(W, String(T.v.port));
    assert.equal(p.plug, "in"); assert.equal(p.lights, "green");
    assert.equal(W.opts.plugged.filter(Boolean).length, 5, "every switch port has a cable");
    const R = physicalState(T.sim, "rogue");
    assert.equal(R.model, "router");
    assert.deepEqual([R.opts.wan, ...R.opts.lans], [false, true, false, false, false]);
    assert.equal(led(R, "◎").state, "off"); assert.equal(led(R, "LAN").state, "on");
  }
});

test("a student's own unplugging shows, and so does putting it back", () => {
  for (const s of seeds("HOME-03").slice(0, 30)) {
    const T = E.open(byId["HOME-03"], s);
    E.act(T, { t: "unplug", cable: "c-router-tv", end: "a" });
    assert.equal(port(physicalState(T.sim, "router"), "LAN 2").plug, "out");
    assert.equal(port(physicalState(T.sim, "tv"), "LAN").lights, "off");
    assert.equal(physicalState(T.sim, "tv").opts.screen.connected, false);
    E.act(T, { t: "reseat", cable: "c-router-tv", end: "a" });
    assert.equal(port(physicalState(T.sim, "router"), "LAN 2").plug, "in");
  }
});

test("HOME-13: the injector's unplugged adapter or its passive label shows, the camera is dark, and the fix lights it", () => {
  const seen = new Set();
  for (const s of seeds("HOME-13")) {
    const T = E.open(byId["HOME-13"], s), I = physicalState(T.sim, "injector"), C = physicalState(T.sim, "camera"), W = physicalState(T.sim, "switch");
    seen.add(T.v.kind);
    assert.equal(port(I, "DC IN").plug, T.v.kind === "unplugged" ? "out" : "in");
    assert.equal(led(I, "POWER").state, T.v.kind === "unplugged" ? "off" : "on");
    assert.equal(led(I, "PoE").state, "off");
    assert.equal(I.opts.std, T.v.kind === "passive" ? "passive" : "af");
    assert.match(I.says.join(" "), T.v.kind === "passive" ? /PASSIVE PoE INJECTOR, OUTPUT 24V/ : /IEEE 802\.3af/);
    assert.equal(port(C, "PoE").lights, "off"); assert.match(C.says.join(" "), /No power: the camera is dark/);
    assert.equal(port(W, String(T.v.port)).lights, "off");
    E.act(T, T.v.kind === "unplugged" ? { t: "injector", values: { power: true } } : { t: "injector", values: { swap: true } });
    assert.equal(led(physicalState(T.sim, "injector"), "PoE").state, "on");
    assert.equal(port(physicalState(T.sim, "camera"), "PoE").lights, "green");
    assert.equal(port(physicalState(T.sim, "switch"), String(T.v.port)).lights, "green");
  }
  assert.equal(seen.size, 2);
});
