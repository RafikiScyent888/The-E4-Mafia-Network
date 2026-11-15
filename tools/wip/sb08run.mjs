/* SB-08 end to end in Node: node tools/wip/sb08run.mjs [seed] */
import { BUSINESS_TICKETS } from "../../js/tickets/business.js";
import * as E from "../../js/tickets/engine.js";
const d = BUSINESS_TICKETS.find((x) => x.id === "SB-08"), seed = +(process.argv[2] || 1);
const T = E.open(d, seed), v = T.v, p = v.plan;
const mgr = (l) => E.act(T, { t: "cmd", dev: "mgr", line: l }), tech = (l) => E.act(T, { t: "cmd", dev: "tech", line: l, cli: true });
console.log(d.id, "seed", T.seed, v.kind, "end", v.end, "vlan", v.vlan, "native", v.native, "| exhibits", d.exhibits(T.sim, v));
E.act(T, { t: "cmd", dev: v.devs[0], line: "ipconfig" }); E.act(T, { t: "cmd", dev: v.kind === "dept-closet" ? "bpc" : "dpc1", line: "ping " + v.printer });
["", p.swConsole, "enable", p.swSecret, "show interfaces trunk", "disable", "exit"].forEach(tech);
["ssh " + p.user + "@" + p.swIp, p.userPw, "enable", p.swSecret, "show interfaces trunk"].forEach(mgr); mgr("exit");
console.log("evidence:"); T.evidence.forEach((e) => console.log("  -", e.id, e.text));
const on = (sw, ls, save) => { const L = ["configure terminal"].concat(ls, ["end"], save ? ["copy running-config startup-config", ""] : []); if (sw === "bsw") ["", p.swConsole, "enable", p.swSecret].concat(L, ["disable", "exit"]).forEach(tech); else { ["ssh " + p.user + "@" + p.swIp, p.userPw, "enable", p.swSecret].concat(L).forEach(mgr); mgr("exit"); } };
const port = (sw) => sw === "msw" ? "interface gi0/23" : "interface gi0/24";
const again = () => v.devs.forEach((id) => E.act(T, { t: "cmd", dev: id, line: "ipconfig /renew" })), prove = () => E.act(T, { t: "cmd", dev: v.devs[0], line: "ping " + v.printer });
on(v.far, [port(v.far), "switchport trunk native vlan " + v.vlan], true); again(); prove(); console.log("far end matched to it: fixed", T.fixed, "partial:", T.partial);
on(v.far, [port(v.far), "switchport trunk native vlan " + v.native], true);
on(v.end, [port(v.end), "switchport trunk native vlan " + v.native], false); again(); prove(); console.log("unsaved: fixed", T.fixed, "partial:", T.partial);
on(v.end, [], true); prove(); console.log("saved: fixed", T.fixed, "proven", T.proven); E.guess(T, "right"); console.log("solved", T.solved);
