/* The business as SB-J10 leaves it, for building the business tickets: run from the repo root.
   node tools/wip/sbt.mjs [seed] [lines...]   each line "dev|command" runs in order and its output prints */
import { BUSINESS_JOBS } from "../../js/build/business.js";
import { exec } from "../../js/net/cmd.js";
import * as SW from "../../js/net/swcli.js";
const SB10 = BUSINESS_JOBS.find(function (d) { return d.id === "SB-J10"; });
const seed = +(process.argv[2] || 4242);
const b = SB10.start(seed), sim = b.sim;
for (const a of SB10.solve(b.v, sim)) { if (a.t === "cmd") exec(sim, a.dev, a.line, a.win); else sim.apply(a); }
sim.cli = {}; sim.lastTrace = null; if (sim.d.tech.tftp) sim.d.tech.tftp.on = false; sim.net.extra.build = false;
const p = b.v.plan;
console.log("business:", sim.net.client.name, "|", p.rtHost, p.swHost, p.bswHost, "| vlans", JSON.stringify(Object.fromEntries(Object.entries(p.vlans).map(function (e) { return [e[0], e[1].id + (e[1].net ? " " + e[1].net : "")]; }))));
console.log("creds:", p.user, p.userPw, "sw", p.swIp, p.swSecret, p.swConsole, "rt", p.rtSecret, p.rtConsole);
console.log("devices:", Object.keys(sim.d).map(function (k) { return k + (sim.d[k].boxed ? "(boxed)" : ""); }).join(" "));
console.log("tech cables:", sim.cablesOf("tech").map(function (c) { return c.id + " " + c.a.dev + ":" + c.a.port + "-" + c.b.dev + ":" + c.b.port; }).join("; "), "| cabinet", JSON.stringify(sim.net.cabinet || sim.d.cab && sim.d.cab.state || null));
["pc", "mgr", "bpc", "dpc1", "dpc2", "printer", "cam1", "cam2", "ap"].forEach(function (id) { const a = sim.d[id] && sim.addr(id); console.log(id, sim.d[id] ? sim.d[id].label : "-", a ? a.ip + " " + a.kind : "no addr"); });
for (const l of process.argv.slice(3)) { if (/^(msw|bsw)!/.test(l)) { const S = SW.session(sim.d[l.slice(0, 3)].sw, { via: "console" }); S.mode = "priv"; S.pending = null; S.fresh = false; l.slice(4).split(";").forEach(function (x) { SW.exec(S, x); }); console.log("\n### planted on " + l.slice(0, 3) + ": " + l.slice(4)); continue; } const i = l.indexOf("|"), dev = l.slice(0, i), line = l.slice(i + 1); const r = exec(sim, dev, line); console.log("\n### " + dev + "> " + line + "\n" + (r && typeof r.out === "string" ? r.out : r && r.facts && typeof r.facts.out === "string" ? r.facts.out : JSON.stringify(r && r.facts || r).slice(0, 600))); }
export { sim, b };
