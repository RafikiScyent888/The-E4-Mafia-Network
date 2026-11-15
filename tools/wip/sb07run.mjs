/* SB-07 end to end in Node: node tools/wip/sb07run.mjs [seed] */
import { BUSINESS_TICKETS } from "../../js/tickets/business.js";
import * as E from "../../js/tickets/engine.js";
const d = BUSINESS_TICKETS.find((x) => x.id === "SB-07"), seed = +(process.argv[2] || 1);
const T = E.open(d, seed), v = T.v, p = v.plan;
const mgr = (l) => E.act(T, { t: "cmd", dev: "mgr", line: l });
console.log(d.id, "seed", T.seed, v.kind, v.net, v.wild, "| exhibits", d.exhibits(T.sim, v), "| before", v.before.join("; "));
if (v.kind === "guest") E.act(T, { t: "view", dev: "guest", key: "wifi" }); else ["ping 8.8.8.8", "ping " + v.printer].forEach((l) => E.act(T, { t: "cmd", dev: v.dev, line: l }));
E.act(T, { t: "cmd", dev: v.kind === "dept" ? "pc" : "dpc1", line: "ping 8.8.8.8" });
["ssh " + p.user + "@" + p.vlans.staff.gw, p.userPw, "enable", p.rtSecret, "show access-lists"].forEach(mgr); mgr("exit");
console.log("evidence:"); T.evidence.forEach((e) => console.log("  -", e.id, e.text));
const conf = (ls, save) => { ["ssh " + p.user + "@" + p.vlans.staff.gw, p.userPw, "enable", p.rtSecret, "configure terminal"].concat(ls, ["end"], save ? ["copy running-config startup-config", ""] : []).forEach(mgr); mgr("exit"); };
const again = () => { if (v.kind === "guest") { E.act(T, { t: "radio", dev: "guest", on: false }); E.act(T, { t: "radio", dev: "guest", on: true }); } else E.act(T, { t: "cmd", dev: v.dev, line: "ping 8.8.8.8" }); };
if (v.kind !== "dept") { conf(["access-list 1 permit " + v.net + " " + v.wild], true); again(); console.log("added, wrong line left: fixed", T.fixed, "partial:", T.partial); }
conf(["no access-list 1"].concat(v.before.map((k) => "access-list 1 " + k)), false); again(); console.log("rebuilt, unsaved: fixed", T.fixed, "partial:", T.partial);
conf([], true); again(); console.log("saved: fixed", T.fixed, "proven", T.proven); E.guess(T, "right"); console.log("solved", T.solved);
