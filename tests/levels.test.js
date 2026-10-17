/* The level lock, stage by stage: a level still being built can't count as
   finished, so the next level can't open early, however much of what is
   built the student has done. */
import test from "node:test"; import assert from "node:assert/strict";
import { LEVELS, finished, built, isOpen, lockText } from "../js/desk/levels.js";

const all = function (L) { const P = { t: {}, j: {} }; LEVELS.slice(0, L).forEach(function (Lv) { Lv.tickets.forEach(function (id) { P.t[id] = 1; }); Lv.jobs.forEach(function (id) { P.j[id] = 1; }); }); return P; };

test("Home finished opens the small office", function () {
  assert.equal(finished(LEVELS[0], all(1)), true);
  assert.equal(isOpen(2, all(1)), true);
  assert.equal(isOpen(2, { t: {}, j: {} }), false);
});
test("the small office, still being built, is never finished: level 3 stays shut", function () {
  const L = LEVELS[1], P = all(2);
  assert.ok(L.planned > L.jobs.length + L.tickets.length, "the small office is still being built");
  assert.equal(built(L), false);
  assert.equal(finished(L, P), false, "doing everything built so far doesn't finish it");
  assert.equal(isOpen(3, P), false);
  assert.match(lockText(3, P), /still being built/);
  assert.doesNotMatch(lockText(3, P), /to go\)/);
});
test("once everything planned exists and is done, the level is finished", function () {
  const L = Object.assign({}, LEVELS[1], { planned: LEVELS[1].jobs.length + LEVELS[1].tickets.length });
  assert.equal(built(L), true);
  assert.equal(finished(L, all(2)), true);
});
