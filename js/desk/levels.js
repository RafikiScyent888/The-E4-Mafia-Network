/* The levels, and the lock between them. The owner, 11 October 2026: "I
   want the student to finish each level before moving on and when they
   finish the objectives that they are suppose to be learning, the next
   level unlocks for them." And: "instructor pin unlocks everything."
   A level is finished when every one of its tickets and work orders is done
   (free build doesn't count). Levels go live stage by stage (the owner, 17
   October 2026: "Stage by stage"), so a level still being built carries
   `planned`, the number of tickets and work orders it will have; it can't
   count as finished until all of them exist, so the next level can't open
   early. The instructor's PIN opens every level for
   that browser tab; the instructor can also open every level on one
   computer for one student. Progress is read from the two pages' own
   saves, so nothing is counted twice. */
import { HOME_TICKETS } from "../tickets/home.js";
import { JOBS } from "../build/jobs.js";
import { OFFICE_JOBS } from "../build/office.js";

export const LEVELS = [
  { n: 1, id: "home", name: "Home", the: "the home level", tickets: HOME_TICKETS.map(function (t) { return t.id; }), jobs: JOBS.filter(function (d) { return !d.free; }).map(function (d) { return d.id; }) },
  /* 10 work orders (5 and the standing 5 extra) and 15 tickets (10 and 5 extra), as agreed 11 October 2026 */
  { n: 2, id: "office", name: "Small office", the: "the small office", tickets: [], jobs: OFFICE_JOBS.map(function (d) { return d.id; }), planned: 25, coming: "more work orders and tickets are on the way" },
  { n: 3, id: "business", name: "Small business", the: "the small business", tickets: [], jobs: [], later: true },
  { n: 4, id: "campus", name: "Campus", the: "the campus", tickets: [], jobs: [], later: true },
  { n: 5, id: "enterprise", name: "Enterprise", the: "the enterprise level", tickets: [], jobs: [], later: true }
];
const TITLES = {}; HOME_TICKETS.concat(JOBS, OFFICE_JOBS).forEach(function (d) { TITLES[d.id] = d.title; });
export function titleOf(id) { return TITLES[id] || ""; }
const OPEN_HERE = "e4-levels-open";
const read = function (k) { try { return JSON.parse(localStorage.getItem(k) || "null") || {}; } catch (e) { return {}; } };

/* what's been done in this browser: tickets solved (the Ticket Desk's save), work orders done (build mode's) */
export function progress() { return { t: read("e4-network-v1").solved || {}, j: read("e4-build-v1").done || {} }; }
export function counts(L, P) {
  return { tickets: L.tickets.filter(function (id) { return P.t[id]; }).length, ntickets: L.tickets.length, jobs: L.jobs.filter(function (id) { return P.j[id]; }).length, njobs: L.jobs.length };
}
export function built(L) { return !L.planned || L.tickets.length + L.jobs.length >= L.planned; }
export function finished(L, P) { const c = counts(L, P); return !L.later && built(L) && c.tickets === c.ntickets && c.jobs === c.njobs; }
export function whatsLeft(L, P) { return { tickets: L.tickets.filter(function (id) { return !P.t[id]; }), jobs: L.jobs.filter(function (id) { return !P.j[id]; }) }; }
export function instructorOn() { try { return sessionStorage.getItem("e4-instructor") === "1"; } catch (e) { return false; } }
export function openHere() { try { return localStorage.getItem(OPEN_HERE) === "1"; } catch (e) { return false; } }
export function setOpenHere(on) { try { if (on) localStorage.setItem(OPEN_HERE, "1"); else localStorage.removeItem(OPEN_HERE); } catch (e) { } }
/* is level n open to this student now: the first always; any other once the one before it is finished, or the instructor has opened it */
export function isOpen(n, P) {
  if (n <= 1) return true;
  if (instructorOn() || openHere()) return true;
  const prev = LEVELS[n - 2]; return finished(prev, P || progress());
}
/* why a level is locked, in words: what's still to do on the level before it */
export function lockText(n, P) {
  const prev = LEVELS[n - 2], left = whatsLeft(prev, P || progress()), parts = [];
  if (left.tickets.length) parts.push(left.tickets.length + " ticket" + (left.tickets.length === 1 ? "" : "s"));
  if (left.jobs.length) parts.push(left.jobs.length + " work order" + (left.jobs.length === 1 ? "" : "s"));
  if (!built(prev)) return "Locked: opens when " + prev.name + " is finished. " + prev.name + " is still being built" + (parts.length ? " (" + parts.join(" and ") + " ready for you now)" : ", and you've done everything ready so far") + ".";
  return "Locked: opens when " + prev.name + " is finished (" + parts.join(" and ") + " to go).";
}
export function levelOfJob(id) { return LEVELS.find(function (L) { return L.jobs.indexOf(id) >= 0; }) || LEVELS[0]; }
