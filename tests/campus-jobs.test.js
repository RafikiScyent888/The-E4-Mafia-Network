/* Level 4 build mode: the campus's work orders (js/build/campus.js), worked on the switches' own command lines, over SSH from
   a desk PC. Each: the work still to do for the real reason; the solution passing every line; the tempting wrong ways each
   failing their own line for their own cause; other right ways passing; the help never naming a password or an address. */
import test from "node:test";
import assert from "node:assert/strict";
import { CAMPUS_JOBS } from "../js/build/campus.js";
import * as B from "../js/build/engine.js";

const N = Number(process.env.SEEDS || 12);
const byId = Object.fromEntries(CAMPUS_JOBS.map((d) => [d.id, d]));
const seeds = (id) => Array.from({ length: N }, (_, i) => 11000 + i * 7919 + id.length);
const run = (J, acts) => { for (const a of acts) B.act(J, a); return J; };
const line = (J, id) => B.evaluate(J.def.reqs.find((q) => q.id === id), J.sim, J.v);
const swap = (acts, from, to) => acts.map((a) => (a.line === from ? Object.assign({}, a, { line: to }) : a));
const drop = (acts, pred) => acts.filter((a) => !pred(a));
const tryIt = (def, s, acts) => run(B.open(def, s), acts);

test("every campus job starts with its work still to do, for the real reason; the solution passes every line", () => {
  for (const def of CAMPUS_JOBS) for (const s of seeds(def.id)) {
    let J = B.open(def, s), c = B.check(J);
    for (const r of c.res) {
      if ((def.already || []).indexOf(r.id) >= 0) { assert.ok(r.ok, def.id + " " + r.id + " should be met before any work, seed " + s + ": " + r.ev); continue; }
      assert.equal(r.ok, false, def.id + " " + r.id + " met before any work, seed " + s); assert.ok(r.ev && r.ev.length > 10);
    }
    J = tryIt(def, s, def.solve(B.open(def, s).v)); c = B.check(J);
    for (const r of c.res) assert.ok(r.ok, def.id + " " + r.id + " not met after the solution, seed " + s + ": " + r.ev);
    assert.equal(J.done, true);
  }
});

test("CP-J1: the tempting wrong ways each fail their own line for their own cause", () => {
  const def = byId["CP-J1"];
  for (const s of seeds("CP-J1").slice(0, 6)) {
    const sol = def.solve(B.open(def, s).v), first = sol.find((a) => /^interface range/.test(a.line)).line;
    const cause = (J, id) => { const r = line(J, id); return r.ok ? null : r.real.id; };
    let J = tryIt(def, s, swap(sol, first, "interface range gi0/1 - 24"));   /* the whole switch, uplinks too: BPDU guard shuts them, port security counts the floor */
    assert.ok(["err", "guard", "ps"].indexOf(cause(J, "uplinks")) >= 0, s + " uplinks: " + cause(J, "uplinks")); assert.equal(line(J, "works").ok, false, "a floor cut off");
    J = tryIt(def, s, drop(sol, (a) => a.line === "switchport port-security mac-address sticky")); assert.equal(cause(J, "ps"), "sticky");
    J = tryIt(def, s, swap(sol, "switchport port-security mac-address sticky", "switchport port-security violation restrict")); assert.ok(["viol", "sticky"].indexOf(cause(J, "ps")) >= 0, s + " " + cause(J, "ps"));
    J = tryIt(def, s, drop(sol, (a) => a.line === "spanning-tree bpduguard enable")); assert.equal(cause(J, "guard"), "none");
    J = tryIt(def, s, drop(sol, (a) => a.line === "spanning-tree portfast")); assert.equal(cause(J, "edge"), "portfast");
    const saves = sol.map((a, i) => (a.line === "copy running-config startup-config" ? i : -1)).filter((i) => i >= 0);
    J = tryIt(def, s, sol.filter((a, i) => i !== saves[1] && i !== saves[1] + 1)); assert.equal(cause(J, "saved2"), "unsaved"); assert.ok(line(J, "saved1").ok && line(J, "saved3").ok);
  }
});

test("CP-J1: other right ways pass: one port at a time, violation shutdown typed out, the maximum typed as 1", () => {
  const def = byId["CP-J1"];
  for (const s of seeds("CP-J1").slice(0, 4)) {
    const sol = def.solve(B.open(def, s).v), out = [];
    sol.forEach((a) => { out.push(a); if (a.line === "switchport port-security mac-address sticky") out.push(Object.assign({}, a, { line: "switchport port-security maximum 1" }), Object.assign({}, a, { line: "switchport port-security violation shutdown" })); });
    const J = tryIt(def, s, out); assert.ok(B.check(J).res.every((r) => r.ok), s);
  }
});

test("no help names a password, an address or a VLAN number; Mason's ladder climbs on a failing line", () => {
  for (const def of CAMPUS_JOBS) for (const s of seeds(def.id).slice(0, 3)) {
    const J = B.open(def, s), p = J.v.plan, secrets = [p.secret, p.console, p.userPw].concat(Object.values(p.sw).map((w) => w.ip).filter(Boolean));
    const words = [def.mason].concat(def.reqs.flatMap((q) => [q.rung1(J.v), q.rung2(J.v)])).join("\n");
    for (const x of secrets) assert.ok(words.indexOf(x) < 0, def.id + " help names " + x);
    for (const k of Object.keys(p.vlans)) assert.ok(!new RegExp("\\b" + p.vlans[k].id + "\\b").test(words), def.id + " help names VLAN " + p.vlans[k].id);
    for (let i = 0; i < 5; i++) B.check(J);
    const m = B.mason(J); assert.ok(m && JSON.stringify(m).length > 20);
  }
});
