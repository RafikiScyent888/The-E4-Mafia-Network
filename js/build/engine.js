/* Build mode: a client job worked from its work order. The job builds the
   house as it stands when the technician arrives (devices in their boxes,
   the router at its factory settings), the student places, cables and sets
   up, and "Check the job" tests every line of the order with the network
   itself: real routes, real links, real settings. Every action is recorded,
   so a saved job replays exactly, like a ticket. */
import { exec } from "../net/cmd.js";
import { page, physical } from "../net/pages.js";
import { hash } from "../net/util.js";

const PUBLIC = "203.0.113.80";
const STATE = { cmd: 1, reseat: 1, unplug: 1, replace: 1, tighten: 1, power: 1, router: 1, client: 1, print: 1, speed: 1, outside: 1, rejoin: 1, pcprinter: 1, forget: 1, join: 1, injector: 1, place: 1, lay: 1, pull: 1 };
const PHYSICAL = { look: 1, test: 1, reseat: 1, unplug: 1, replace: 1, tighten: 1, power: 1 };

export function open(def, seed) {
  const s = seed >>> 0, b = def.start(s);
  return { def: def, seed: s, sim: b.sim, v: b.v, net: [], checks: 0, fails: {}, last: null, done: false, notes: "" };
}
export function act(J, a) { if (STATE[a.t]) J.net.push(a); return apply(J, a); }
function apply(J, a) {
  const sim = J.sim;
  if (a.t === "cmd") return exec(sim, a.dev, a.line);
  if (a.t === "view") return page(sim, a.dev, a.key);
  if (PHYSICAL[a.t]) return physical(sim, a);
  if (a.t === "rejoin" || a.t === "join") { const r = sim.apply(a), ad = sim.addr(a.dev), l = sim.wifiLink(a.dev); return { result: r, facts: { join: r.result, dev: a.dev, ap: l && l.connected ? l.ap.id : null, ip: ad && ad.ip, apipa: !!(ad && ad.kind === "apipa"), internet: !!(ad && sim.route(a.dev, PUBLIC).internet) } }; }
  if (a.t === "print") { const r = sim.apply(a); return { result: r, facts: { print: r.ok ? "ok" : "fail", port: r.port } }; }
  if (a.t === "speed") { const r = sim.apply(a); return { result: r, facts: { speed: r.ok ? r.down : 0, dev: a.dev } }; }
  if (a.t === "outside") { const r = sim.apply(a); return { result: r, facts: { outside: true, ok: !!r.ok, why: r.why } }; }
  if (a.t === "injector") { const r = sim.apply(a); return { result: r, facts: { injector: true, power: r.power, std: r.std, camera: sim.on("camera") } }; }
  const r = sim.apply(a); return { result: r, facts: {} };
}

/* one line of the order, worked out from the network as it is: the first thing really stopping it, or met */
export function evaluate(q, sim, v) {
  const list = q.causes(sim, v), real = list.find(function (c) { return c.on && !c.skip; });
  return { ok: !real, ev: real ? real.ev : q.ok(sim, v), list: list, real: real || null };
}
/* check every line of the order; a line still not met counts towards Mason's help for it */
export function check(J) {
  J.checks++;
  const res = J.def.reqs.map(function (q) { const c = evaluate(q, J.sim, J.v); J.fails[q.id] = c.ok ? 0 : (J.fails[q.id] || 0) + 1; return { id: q.id, text: q.text, ok: c.ok, ev: c.ev }; });
  J.last = { n: J.checks, res: res, at: J.net.length };   /* at: how much had been done when it was checked, so the page can say the house changed since */
  if (res.every(function (x) { return x.ok; })) J.done = true;
  return J.last;
}
/* Mason's third rung for a line: what's stopping it, narrowed to two (the real cause and its nearest neighbour,
   in an order that doesn't give it away), and every cause before the real one struck with the reason it isn't that.
   Only those are struck: the network has really ruled them out. */
export function narrow(list, real, seed) {
  const live = list.filter(function (c) { return !c.skip; }), i = live.indexOf(real);
  if (i < 0) return null;
  let struck = live.slice(0, i), other = live[i + 1] || null;
  if (!other && struck.length) { other = struck[struck.length - 1]; struck = struck.slice(0, -1); }
  const two = other ? (hash(seed + ":" + real.id) % 2 ? [real, other] : [other, real]) : [real];
  return { two: two.map(function (c) { return c.text; }), struck: struck.map(function (c) { return { text: c.text, why: c.not }; }) };
}
/* Mason, on the first line not met: nothing for its first two failing checks, then where to look, then the
   principle, then (the fifth and every check after) the field narrowed to two. Never what to type or where to plug. */
export function mason(J) {
  if (!J.last) return null;
  const miss = J.last.res.find(function (x) { return !x.ok; }); if (!miss) return null;
  const q = J.def.reqs.find(function (r) { return r.id === miss.id; }), n = J.fails[miss.id] || 0;
  if (n < 3) return null;
  const rung = n >= 5 ? 3 : n === 4 ? 2 : 1;
  if (rung === 1) return { line: miss.text, rung: 1, text: q.rung1(J.v, J.sim) };
  if (rung === 2) return { line: miss.text, rung: 2, text: q.rung2(J.v, J.sim) };
  const c = evaluate(q, J.sim, J.v), nw = c.real && narrow(c.list, c.real, J.seed);
  if (!nw || nw.two.length < 2) return { line: miss.text, rung: 3, text: q.rung2(J.v, J.sim) };   /* met since the last check, or nothing to narrow between: never one option left, that would be the answer */
  const low = function (s) { return s.replace(/^./, function (m) { return m.toLowerCase(); }); };
  return { line: miss.text, rung: 3, text: "It's one of these two: " + low(nw.two[0]) + ", or " + low(nw.two[1]) + ".", struck: nw.struck, principle: q.rung2(J.v, J.sim) };
}
/* undo the last change (and any Command Prompt commands typed after it): the job replays without it. A line typed to a
   switch's command line counts as a change. Checks, Mason's count and the notes stay */
const QUIET = { cmd: 1, print: 1, speed: 1, outside: 1 };
export function undo(J) {
  let i = J.net.length - 1; while (i >= 0 && QUIET[J.net[i].t] && !J.net[i].cli) i--;   /* a line typed to a switch is a change: undo takes it back */
  if (i < 0) return null;
  const gone = J.net[i], keep = save(J); keep.net = J.net.slice(0, i);
  const K = restore(J.def, keep); J.sim = K.sim; J.net = K.net;
  return gone;
}
/* the house back as the technician found it, same house */
export function reset(J) { const keep = save(J); keep.net = []; const K = restore(J.def, keep); J.sim = K.sim; J.net = []; }
export function save(J) { return { seed: J.seed, net: J.net, checks: J.checks, fails: J.fails, last: J.last, done: J.done, notes: J.notes }; }
export function restore(def, saved) {
  const J = open(def, saved.seed);
  for (const a of saved.net || []) { J.net.push(a); apply(J, a); }
  Object.assign(J, { checks: saved.checks || 0, fails: saved.fails || {}, last: saved.last || null, done: !!saved.done, notes: saved.notes || "" });
  return J;
}
