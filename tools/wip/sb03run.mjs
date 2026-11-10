/* SB-03 end to end in Node: node tools/wip/sb03run.mjs [seed] */
import { BUSINESS_TICKETS } from "../../js/tickets/business.js";
import * as E from "../../js/tickets/engine.js";
const d = BUSINESS_TICKETS.find((x) => x.id === "SB-03"), seed = +(process.argv[2] || 1);
const T = E.open(d, seed), v = T.v, p = v.plan;
const mgr = (l) => E.act(T, { t: "cmd", dev: "mgr", line: l });
console.log(d.id, "seed", T.seed, v.kind, "lost", v.lost, "before", JSON.stringify(v.before).slice(0, 40), "| exhibits", d.exhibits(T.sim, v));
if (v.kind === "back") { E.act(T, { t: "cmd", dev: "bpc", line: "ipconfig" }); E.act(T, { t: "cmd", dev: "dpc1", line: "ping " + v.printer }); }
else if (v.kind === "router") E.act(T, { t: "print" }); else { E.act(T, { t: "radio", dev: "guest", on: false }); E.act(T, { t: "radio", dev: "guest", on: true }); }
["ssh " + p.user + "@" + p.swIp, p.userPw, "enable", p.swSecret, "show interfaces trunk", "show vlan brief", "show running-config"].forEach(mgr); mgr("exit");
console.log("evidence:"); T.evidence.forEach((e) => console.log("  -", e.id, e.text));
const conf = (lines, save) => { ["ssh " + p.user + "@" + p.swIp, p.userPw, "enable", p.swSecret, "configure terminal", "interface " + v.short].concat(lines, ["end"], save ? ["copy running-config startup-config", ""] : []).forEach(mgr); mgr("exit"); };
const again = () => { if (v.kind === "back") E.act(T, { t: "cmd", dev: "bpc", line: "ipconfig /renew" }); if (v.kind === "ap") { E.act(T, { t: "radio", dev: "guest", on: false }); E.act(T, { t: "radio", dev: "guest", on: true }); } };
const prove = () => v.kind === "back" ? E.act(T, { t: "cmd", dev: "bpc", line: "ping " + v.printer }) : v.kind === "router" ? E.act(T, { t: "print" }) : again();
if (v.kind !== "router") { conf(["switchport trunk allowed vlan all"], true); again(); prove(); console.log("all, saved: fixed", T.fixed, "partial:", T.partial); conf(["switchport trunk allowed vlan " + (Array.isArray(v.before) ? v.before.join(",") : "all")], true); }
conf(["switchport trunk allowed vlan add " + v.lost.join(",")], false); again(); prove(); console.log("add, unsaved: fixed", T.fixed, "partial:", T.partial);
conf([], true); prove(); console.log("saved: fixed", T.fixed, "proven", T.proven); E.guess(T, "right"); console.log("solved", T.solved);
