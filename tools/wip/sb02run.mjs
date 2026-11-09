/* SB-02 end to end in Node: node tools/wip/sb02run.mjs [seed] */
import { BUSINESS_TICKETS } from "../../js/tickets/business.js";
import * as E from "../../js/tickets/engine.js";
const d = BUSINESS_TICKETS.find((x) => x.id === "SB-02"), seed = +(process.argv[2] || 1);
const T = E.open(d, seed), v = T.v, p = v.plan;
const mgr = (l) => E.act(T, { t: "cmd", dev: "mgr", line: l }), tech = (l) => E.act(T, { t: "cmd", dev: "tech", line: l, cli: true });
console.log(d.id, "seed", T.seed, v.kind, "vlan", v.vlan, v.vname, "on", v.sw, "| exhibits", d.exhibits(T.sim, v), "| affected", d.affected(v));
console.log("brief:", d.brief(v).quote);
if (v.kind === "staff") { E.act(T, { t: "cmd", dev: "bpc", line: "ipconfig" }); ["", p.swConsole, "enable", p.swSecret, "show vlan brief", "show interfaces gi0/1 switchport", "show interfaces status", "show interfaces trunk", "show running-config"].forEach(tech); }
else { if (v.kind === "printers") E.act(T, { t: "print" }); else E.act(T, { t: "radio", dev: "guest", on: false }), E.act(T, { t: "radio", dev: "guest", on: true });
  ["ssh " + p.user + "@" + p.swIp, p.userPw, "enable", p.swSecret, "show vlan brief", "show interfaces gi0/3 switchport", "show interfaces status", "show interfaces trunk", "show running-config"].forEach(mgr); mgr("exit"); }
console.log("evidence:"); T.evidence.forEach((e) => console.log("  -", e.id, e.text));
const fix = (lines, save) => { if (v.sw === "bsw") { lines.forEach(tech); if (save) ["copy running-config startup-config", ""].forEach(tech); } else { ["ssh " + p.user + "@" + p.swIp, p.userPw, "enable", p.swSecret].forEach(mgr); lines.forEach(mgr); if (save) ["copy running-config startup-config", ""].forEach(mgr); mgr("exit"); } };
const again = () => { if (v.kind === "staff") E.act(T, { t: "cmd", dev: "bpc", line: "ipconfig /renew" }); if (v.kind === "guest") { E.act(T, { t: "radio", dev: "guest", on: false }); E.act(T, { t: "radio", dev: "guest", on: true }); } };
const prove = () => v.kind === "staff" ? E.act(T, { t: "cmd", dev: "bpc", line: "ping " + v.printer }) : v.kind === "printers" ? E.act(T, { t: "print" }) : (E.act(T, { t: "radio", dev: "guest", on: false }), E.act(T, { t: "radio", dev: "guest", on: true }));
fix(["configure terminal", "vlan " + v.vlan, "end"], true); again(); prove(); console.log("default name, saved: fixed", T.fixed, "partial:", T.partial);
fix(["configure terminal", "vlan " + v.vlan, "name " + v.vname, "end"], false); prove(); console.log("named, unsaved: fixed", T.fixed, "partial:", T.partial);
fix([], true); prove(); console.log("saved: fixed", T.fixed, "proven", T.proven); E.guess(T, "right"); console.log("solved", T.solved);
