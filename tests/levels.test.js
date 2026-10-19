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
test("a level still being built is never finished, however much of it is done: the next level stays shut", function () {
  const L = Object.assign({}, LEVELS[1], { planned: LEVELS[1].jobs.length + LEVELS[1].tickets.length + 1 }), P = all(2);
  assert.equal(built(L), false);
  assert.equal(finished(L, P), false, "doing everything built so far doesn't finish it");
});
test("the small office is complete: 10 work orders and 15 tickets, all built; doing them all finishes it", function () {
  const L = LEVELS[1];
  assert.equal(L.jobs.length, 10); assert.equal(L.tickets.length, 15); assert.equal(L.planned, undefined, "a complete level carries no planned");
  assert.equal(built(L), true);
  assert.equal(finished(L, all(1)), false, "nothing of it done yet");
  assert.equal(finished(L, all(2)), true);
  assert.match(lockText(3, all(1)), /\(15 tickets and 10 work orders to go\)/);
});

test("the small business goes live stage by stage: open once the small office is finished, never finished before all 25 exist", function () {
  const L = LEVELS[2];
  assert.equal(L.later, undefined); assert.equal(L.planned, 25, "10 work orders and 15 tickets, as planned");
  assert.deepEqual(L.jobs.slice(0, 2), ["SB-J1", "SB-J2"]);
  assert.equal(isOpen(3, all(1)), false, "locked while the small office isn't finished");
  assert.equal(isOpen(3, all(2)), true, "open once it is");
  assert.equal(built(L), L.jobs.length + L.tickets.length >= 25);
  assert.equal(finished(L, all(3)), built(L), "everything built so far done: finished only once all 25 exist");
  assert.equal(LEVELS[3].later, true, "the campus is built later");
});
