/* SB-05 end to end in Node: node tools/wip/sb05run.mjs [seed] */
import { BUSINESS_TICKETS, businessRecords } from "../../js/tickets/business.js";
import * as E from "../../js/tickets/engine.js";
const d = BUSINESS_TICKETS.find((x) => x.id === "SB-05"), seed = +(process.argv[2] || 1);
const T = E.open(d, seed), v = T.v, p = v.plan;
const mgr = (l) => E.act(T, { t: "cmd", dev: "mgr", line: l }), pc = (l) => E.act(T, { t: "cmd", dev: "pc", line: l });
console.log(d.id, "seed", T.seed, v.kind, "wrong", v.wrong, "gw", v.gw, "| exhibits", d.exhibits(T.sim, v), "|", businessRecords(v, T.sim).find((r) => r[0] === "The provider")[1]);
["ping 8.8.8.8", "ping " + v.printer, "tracert 8.8.8.8"].forEach(pc);
["ssh " + p.user + "@" + p.vlans.staff.gw, p.userPw, "enable", p.rtSecret, "show ip route", "show running-config"].forEach(mgr); mgr("exit");
console.log("evidence:"); T.evidence.forEach((e) => console.log("  -", e.id, e.text));
const conf = (lines, save) => { ["ssh " + p.user + "@" + p.vlans.staff.gw, p.userPw, "enable", p.rtSecret, "configure terminal"].concat(lines, ["end"], save ? ["copy running-config startup-config", ""] : []).forEach(mgr); mgr("exit"); };
if (v.wrong) { conf(["ip route 0.0.0.0 0.0.0.0 " + v.gw], true); pc("ping 8.8.8.8"); console.log("added beside the wrong one: fixed", T.fixed, "partial:", T.partial); }
conf((v.wrong ? ["no ip route 0.0.0.0 0.0.0.0 " + v.wrong] : []).concat(["ip route 0.0.0.0 0.0.0.0 " + v.gw]), false); pc("tracert 8.8.8.8"); console.log("unsaved: fixed", T.fixed, "partial:", T.partial);
conf([], true); pc("tracert 8.8.8.8"); console.log("saved: fixed", T.fixed, "proven", T.proven); E.guess(T, "right"); console.log("solved", T.solved);
