/* SB-09 end to end in Node: node tools/wip/sb09run.mjs [seed] */
import { BUSINESS_TICKETS } from "../../js/tickets/business.js";
import * as E from "../../js/tickets/engine.js";
const d = BUSINESS_TICKETS.find((x) => x.id === "SB-09"), seed = +(process.argv[2] || 1);
const T = E.open(d, seed), v = T.v, p = v.plan;
const mgr = (l) => E.act(T, { t: "cmd", dev: "mgr", line: l }), tech = (l) => E.act(T, { t: "cmd", dev: "tech", line: l, cli: true });
console.log(d.id, "seed", T.seed, v.kind, "| exhibits", d.exhibits(T.sim, v));
E.act(T, { t: "cmd", dev: "bpc", line: "ipconfig" });
["", p.swConsole, "enable", p.swSecret, "show interfaces trunk", "show interfaces gi0/24 switchport", "show interfaces status", "disable", "exit"].forEach(tech);
["ssh " + p.user + "@" + p.swIp, p.userPw, "enable", p.swSecret, "show interfaces trunk", "show interfaces gi0/23 switchport"].forEach(mgr); mgr("exit");
console.log("evidence:"); T.evidence.forEach((e) => console.log("  -", e.id, e.text));
const on = (sw, ls, save) => { const L = ["configure terminal"].concat(ls, ["end"], save ? ["copy running-config startup-config", ""] : []); if (sw === "bsw") ["", p.swConsole, "enable", p.swSecret].concat(L, ["disable", "exit"]).forEach(tech); else { ["ssh " + p.user + "@" + p.swIp, p.userPw, "enable", p.swSecret].concat(L).forEach(mgr); mgr("exit"); } };
const again = () => ["bpc", "dpc1", "dpc2"].forEach((id) => E.act(T, { t: "cmd", dev: id, line: "ipconfig /renew" })), prove = () => E.act(T, { t: "cmd", dev: "bpc", line: "ping " + v.printer });
const ends = v.kind === "auto-auto" ? ["msw", "bsw"] : v.kind === "access-closet" ? ["msw"] : ["bsw"], port = (sw) => sw === "msw" ? "interface gi0/23" : "interface gi0/24";
on(ends[0], [port(ends[0]), "switchport mode dynamic desirable"], true); again(); prove(); console.log("one end desirable: fixed", T.fixed, "partial:", T.partial);
ends.forEach((sw) => on(sw, [port(sw), "switchport mode trunk"], false)); again(); prove(); console.log("trunk, unsaved: fixed", T.fixed, "partial:", T.partial);
ends.forEach((sw) => on(sw, [], true)); prove(); console.log("saved: fixed", T.fixed, "proven", T.proven); E.guess(T, "right"); console.log("solved", T.solved);
