/* Running a ticket: the student's actions, the diagnosis board with its
   ladder of help, the fix and the proof. No page code here, so the tests
   drive exactly what the page drives.

   The ladder (the program's rule, never the answer):
     wrong guesses 1 and 2: nothing; let them think
     wrong guess 3: rung 1, where to look
     wrong guess 4: rung 2, the principle that decides it
     wrong guess 5 and every one after: rung 3, the field narrowed to two,
       each option removed with its reason
   A wrong pick stays ruled out until it is solved or the board is reset.
   Resetting clears the board, not the count, so help stays where it was. */
import { exec } from "../net/cmd.js";
import { page, physical } from "../net/pages.js";
import { rng, hash } from "../net/util.js";

const STATE_CHANGING = { cmd: 1, reseat: 1, unplug: 1, replace: 1, tighten: 1, power: 1, router: 1, client: 1, rogue: 1, print: 1, speed: 1, outside: 1, rejoin: 1, pcprinter: 1, forget: 1, join: 1, injector: 1, tftp: 1 };   /* print, speed and outside change nothing, but they draw on the same counter as ping, so replay needs them */
const PHYSICAL = { look: 1, test: 1, reseat: 1, unplug: 1, replace: 1, tighten: 1, power: 1 };

/* open a ticket on a seed; if a generated network ever failed to show its fault, move to the next seed */
export function open(def, seed) {
  let s = seed >>> 0, built = null;
  for (let tries = 0; tries < 40; tries++) {
    built = def.build(s);
    if (def.exhibits(built.sim, built.v)) break;
    built = null; s = (Math.imul(s, 2654435761) + 7) >>> 0;
  }
  if (!built) throw new Error(def.id + ": the fault would not show on any seed");
  const opts = rng(hash(def.id + "/opts/" + s)).shuffle(def.options(built.v, built.sim));
  return { def: def, seed: s, sim: built.sim, v: built.v, opts: opts, reds: [], struck: [], wrong: 0, rung: 0, diagnosed: false, fixed: false, proven: false, solved: false, evidence: [], net: [], fixHint: 0, notes: "", partial: null };
}

/* rebuild the network for a saved ticket and replay what changed it */
export function restore(def, saved) {
  const T = open(def, saved.seed);
  for (const a of saved.net || []) apply(T, a, true);
  Object.assign(T, { reds: saved.reds || [], struck: saved.struck || [], wrong: saved.wrong || 0, rung: saved.rung || 0, diagnosed: !!saved.diagnosed, proven: !!saved.proven, solved: !!saved.solved, evidence: saved.evidence || [], fixHint: saved.fixHint || 0, notes: saved.notes || "" });
  T.fixed = def.fixed(T.sim, T.v);
  return T;
}
export function save(T) {
  return { seed: T.seed, net: T.net, reds: T.reds, struck: T.struck, wrong: T.wrong, rung: T.rung, diagnosed: T.diagnosed, proven: T.proven, solved: T.solved, evidence: T.evidence, fixHint: T.fixHint, notes: T.notes };
}

/* everything the student does goes through here */
export function act(T, a) {
  const res = apply(T, a, false);
  if (res && res.facts) observe(T, res.facts);
  T.fixed = T.def.fixed(T.sim, T.v);
  if (res && res.facts && T.fixed && !T.proven && T.def.proves(res.facts, T.sim, T.v)) { T.proven = true; res.proved = true; T.partial = null; }
  /* it works, but the cause is still there (a symptom treated): Mason says so */
  else if (res && res.facts && !T.fixed && !T.proven && T.def.partial && T.def.proves(res.facts, T.sim, T.v)) { T.partial = T.def.partial(T.v, T.sim); res.partial = T.partial; }
  if (!T.solved && T.diagnosed && T.fixed && T.proven) { T.solved = true; res.solved = true; }
  return res;
}

function apply(T, a, replay) {
  if (STATE_CHANGING[a.t] && !replay) T.net.push(a);
  if (a.t === "cmd") return exec(T.sim, a.dev, a.line, a.win);
  if (a.t === "view") return page(T.sim, a.dev, a.key);
  if (PHYSICAL[a.t]) return physical(T.sim, a);
  if (a.t === "router") { const r = T.sim.apply(a); return { result: r, facts: r.ok ? { saved: a.page } : {} }; }
  if (a.t === "client") { const r = T.sim.apply(a); return { result: r, facts: r.ok ? { client: a.dev, saved: true } : {} }; }
  if (a.t === "rogue") { const r = T.sim.apply(a); return { result: r, facts: { rogueDhcp: T.sim.d.rogue.dhcp.on } }; }
  if (a.t === "pcprinter") { const r = T.sim.apply(a); return { result: r, facts: r.ok ? { pcprinter: a.ip } : {} }; }
  if (a.t === "print") { const r = T.sim.apply(a); return { result: r, facts: { print: r.ok ? "ok" : "fail", slow: !!r.slow, port: r.port, who: r.who, conflict: !!r.conflict } }; }
  if (a.t === "tftp") { const r = T.sim.apply(a); return { result: r, facts: { tftp: r.on } }; }
  if (a.t === "speed") { const r = T.sim.apply(a); return { result: r, facts: { speed: r.ok ? r.down : 0, dev: a.dev, link: r.link } }; }
  if (a.t === "outside") { const r = T.sim.apply(a); return { result: r, facts: { outside: true, ok: !!r.ok, why: r.why, port: a.port, target: r.target } }; }
  if (a.t === "injector") { const r = T.sim.apply(a); return { result: r, facts: { injector: true, power: r.power, std: r.std, camera: T.sim.on("camera") } }; }
  if (a.t === "forget") { const r = T.sim.apply(a); return { result: r, facts: { forgot: a.dev } }; }
  if (a.t === "join") { const r = T.sim.apply(a), ad = T.sim.addr(a.dev), l = T.sim.wifiLink(a.dev); return { result: r, facts: { join: r.result, dev: a.dev, ap: l && l.connected ? l.ap.id : null, ip: ad && ad.ip, internet: !!(ad && T.sim.route(a.dev, "203.0.113.80").internet) } }; }
  if (a.t === "rejoin") { const r = T.sim.apply(a); const ad = T.sim.addr(a.dev); return { result: r, facts: { rejoin: r.result, dev: a.dev, ip: ad && ad.ip, apipa: !!(ad && ad.kind === "apipa"), internet: !!(ad && T.sim.route(a.dev, "203.0.113.80").internet) } }; }
  return null;
}

/* the notebook: each piece of evidence once, in the order found */
function observe(T, facts) {
  for (const e of T.def.evidence) {
    if (T.evidence.some(function (x) { return x.id === e.id; })) continue;
    let hit = false; try { hit = e.test(facts, T.v, T.sim); } catch (err) { hit = false; }
    if (hit) T.evidence.push({ id: e.id, text: e.text(facts, T.v, T.sim) });
  }
}

export function guess(T, id) {
  if (T.diagnosed) return { already: true };
  const o = T.opts.find(function (x) { return x.id === id; });
  if (!o) return { none: true };
  if (T.reds.indexOf(id) >= 0 || T.struck.some(function (s) { return s.id === id; })) return { ruledOut: true };
  if (o.right) {
    T.diagnosed = true;
    if (T.fixed && T.proven) T.solved = true;
    return { right: true };
  }
  T.reds.push(id); T.wrong++;
  T.rung = T.wrong >= 5 ? 3 : T.wrong === 4 ? 2 : T.wrong === 3 ? 1 : 0;
  if (T.rung === 3) narrow(T);
  return { right: false, rung: T.rung };
}

/* rung 3: strike wrong options, each with its reason, until two remain alive */
export function narrow(T) {
  const live = function () { return T.opts.filter(function (o) { return T.reds.indexOf(o.id) < 0 && !T.struck.some(function (s) { return s.id === o.id; }); }); };
  let L = live();
  while (L.length > 2) {
    const victim = L.filter(function (o) { return !o.right; }).pop();
    T.struck.push({ id: victim.id, why: victim.why });
    L = live();
  }
  return L;
}
export function live(T) { return T.opts.filter(function (o) { return T.reds.indexOf(o.id) < 0 && !T.struck.some(function (s) { return s.id === o.id; }); }); }

export function resetBoard(T) { T.reds = []; T.struck = []; }   /* the count stays: the next wrong guess brings back the rung they had reached */
/* back to the network as it was found; the diagnosis and the notebook stay */
export function resetNetwork(T) {
  const keep = save(T); keep.net = [];
  const fresh = restore(T.def, keep);
  Object.assign(T, { sim: fresh.sim, net: [], fixed: fresh.fixed });
}
export function ladderText(T) {
  if (T.rung === 1) return { rung: 1, text: T.def.rung1(T.v, T.sim) };
  if (T.rung === 2) return { rung: 2, text: T.def.rung2(T.v, T.sim) };
  if (T.rung === 3) return { rung: 3, text: "Mason has narrowed it to two. Each option he struck says why. " + T.def.rung2(T.v, T.sim) };
  return null;
}
export function nextFixHint(T) { const h = T.def.fixHints(T.v, T.sim); const i = Math.min(T.fixHint, h.length - 1); T.fixHint++; return { step: i + 1, text: h[i] }; }
