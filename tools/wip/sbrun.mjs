import { BUSINESS_JOBS } from "../../js/build/business.js";
import * as B from "../../js/build/engine.js";
const seeds = (process.argv[2] || "1,2,3").split(",").map(Number);
for (const def of BUSINESS_JOBS) for (const s of seeds) {
  let J = B.open(def, s), c = B.check(J);
  console.log(def.id, s, "start:", c.res.map((r) => r.id + "=" + (r.ok ? "ok" : "no")).join(" "));
  for (const r of c.res) if (!r.ok) console.log("   ", r.id, "|", r.ev);
  J = B.open(def, s);
  for (const a of def.solve(J.v, J.sim)) { const r = B.act(J, a); if (r && r.result && r.result.ok === false) console.log("  refused", JSON.stringify(a), JSON.stringify(r.result)); if (a.t === "cmd" && r && r.out && /%|Invalid/.test(r.out)) console.log("  out", a.line, "->", r.out.split("\n").filter((l) => /%|Invalid/.test(l)).join(" / ")); }
  c = B.check(J);
  console.log(def.id, s, "after:", c.res.map((r) => r.id + "=" + (r.ok ? "ok" : "no")).join(" "));
  for (const r of c.res) if (!r.ok) console.log("   ", r.id, "|", r.ev);
}
