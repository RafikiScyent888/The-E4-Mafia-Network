/* SB-04 end to end in Node: node tools/wip/sb04run.mjs [seed] */
import { BUSINESS_TICKETS } from "../../js/tickets/business.js";
import * as E from "../../js/tickets/engine.js";
const d = BUSINESS_TICKETS.find((x) => x.id === "SB-04"), seed = +(process.argv[2] || 1);
const T = E.open(d, seed), v = T.v, p = v.plan, dv = v.devs[0];
const mgr = (l) => E.act(T, { t: "cmd", dev: "mgr", line: l });
console.log(d.id, "seed", T.seed, v.kind, "pool", v.pool, "wrong", v.wrong, "gw", v.gw, "| exhibits", d.exhibits(T.sim, v));
if (v.kind === "guest") E.act(T, { t: "view", dev: "guest", key: "wifi" }); else { ["ipconfig", "ping " + v.gw, "ping " + v.printer].forEach((l) => E.act(T, { t: "cmd", dev: dv, line: l })); }
["ssh " + p.user + "@" + p.vlans.staff.gw, p.userPw, "enable", p.rtSecret, "show running-config"].forEach(mgr); mgr("exit");
console.log("evidence:"); T.evidence.forEach((e) => console.log("  -", e.id, e.text));
const conf = (lines, save) => { ["ssh " + p.user + "@" + p.vlans.staff.gw, p.userPw, "enable", p.rtSecret, "configure terminal", "ip dhcp pool " + v.pool].concat(lines, ["end"], save ? ["copy running-config startup-config", ""] : []).forEach(mgr); mgr("exit"); };
const again = () => v.devs.forEach((id) => id === "guest" ? (E.act(T, { t: "radio", dev: "guest", on: false }), E.act(T, { t: "radio", dev: "guest", on: true })) : E.act(T, { t: "cmd", dev: id, line: "ipconfig /renew" }));
const prove = () => v.kind === "guest" ? again() : E.act(T, { t: "cmd", dev: dv, line: "ping " + v.printer });
conf(["default-router " + v.gw], false); again(); prove(); console.log("unsaved: fixed", T.fixed, "partial:", T.partial);
conf([], true); prove(); console.log("saved: fixed", T.fixed, "proven", T.proven); E.guess(T, "right"); console.log("solved", T.solved);
