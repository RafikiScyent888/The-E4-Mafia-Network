/* SB-J5 probe: each line at the start, then after the solution, on a few seeds */
import { BUSINESS_JOBS } from "../../js/build/business.js";
import * as B from "../../js/build/engine.js";
const def = BUSINESS_JOBS[4], N = +(process.env.N || 3);
for (let i = 0; i < N; i++) {
  const s = 9000 + i * 7919 + 5, t0 = Date.now();
  let J = B.open(def, s), c = B.check(J);
  console.log("seed", s, "open ms", Date.now() - t0);
  for (const r of c.res) console.log("  start", r.id, r.ok ? "MET" : "-", r.ok ? "" : r.ev);
  J = B.open(def, s);
  for (const a of def.solve(J.v, J.sim)) { const r = B.act(J, a); if (r && r.result && r.result.ok === false) console.log("  REFUSED", JSON.stringify(a), JSON.stringify(r.result)); }
  c = B.check(J);
  for (const r of c.res) if (!r.ok) console.log("  after", r.id, "NOT MET:", r.ev);
  console.log("  done", J.done);
}
