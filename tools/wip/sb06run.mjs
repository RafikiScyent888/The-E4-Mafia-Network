/* SB-06 end to end in Node: node tools/wip/sb06run.mjs [seed] */
import { BUSINESS_TICKETS } from "../../js/tickets/business.js";
import * as E from "../../js/tickets/engine.js";
const d = BUSINESS_TICKETS.find((x) => x.id === "SB-06"), seed = +(process.argv[2] || 1);
const T = E.open(d, seed), v = T.v, p = v.plan;
const mgr = (l) => E.act(T, { t: "cmd", dev: "mgr", line: l }), pc = (l) => E.act(T, { t: "cmd", dev: "pc", line: l });
console.log(d.id, "seed", T.seed, v.kind, "| exhibits", d.exhibits(T.sim, v));
["ping 8.8.8.8", "ping " + v.printer].forEach(pc); E.act(T, { t: "cmd", dev: "dpc1", line: "ping 8.8.8.8" });
["ssh " + p.user + "@" + p.vlans.staff.gw, p.userPw, "enable", p.rtSecret, "ping 8.8.8.8", "show ip nat translations", "show running-config"].forEach(mgr); mgr("exit");
console.log("evidence:"); T.evidence.forEach((e) => console.log("  -", e.id, e.text));
const lines = Object.keys(v.roles).flatMap((n) => ["interface " + n, "ip nat " + v.roles[n]]);
const conf = (ls, save) => { ["ssh " + p.user + "@" + p.vlans.staff.gw, p.userPw, "enable", p.rtSecret, "configure terminal"].concat(ls, ["end"], save ? ["copy running-config startup-config", ""] : []).forEach(mgr); mgr("exit"); };
conf(lines, false); pc("ping 8.8.8.8"); console.log("unsaved: fixed", T.fixed, "partial:", T.partial);
conf([], true); pc("tracert 8.8.8.8"); console.log("saved: fixed", T.fixed, "proven", T.proven); E.guess(T, "right"); console.log("solved", T.solved);
