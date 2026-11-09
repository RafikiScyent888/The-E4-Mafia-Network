/* SB-01 in Node: each variant's fault, evidence, the fix and its proof. node tools/wip/sb01.mjs [seed] */
import { BUSINESS_TICKETS, businessRecords } from "../../js/tickets/business.js";
import * as E from "../../js/tickets/engine.js";
const d = BUSINESS_TICKETS[0], seed = +(process.argv[2] || 1);
const T = E.open(d, seed), p = T.v.plan, sw = function (l) { return E.act(T, { t: "cmd", dev: "mgr", line: l }); };
console.log(d.id, "seed", T.seed, "kind", T.v.kind, "vlan", T.v.vlan, "pc", T.v.pc, "| exhibits", d.exhibits(T.sim, T.v), "fixed", T.fixed);
console.log("brief:", d.brief(T.v).quote);
businessRecords(T.v, T.sim).forEach(function (r) { console.log("  " + r[0] + ": " + r[1]); });
const r0 = E.act(T, { t: "cmd", dev: "pc", line: "ipconfig /all" }); E.act(T, { t: "cmd", dev: "pc", line: "ping " + p.printerIp }); E.act(T, { t: "cmd", dev: "pc", line: "ping 8.8.8.8" }); E.act(T, { t: "print" });
["ssh " + p.user + "@" + p.swIp, p.userPw, "show interfaces status", "show interfaces gi0/1 switchport", "enable", p.swSecret, "show vlan brief", "show running-config"].forEach(sw);
console.log("evidence:"); T.evidence.forEach(function (e) { console.log("  -", e.id, e.text); });
["configure terminal", "interface gi0/1", "switchport access vlan " + p.vlans.staff.id, "end"].forEach(sw);
E.act(T, { t: "cmd", dev: "pc", line: "ipconfig /renew" });
let r = E.act(T, { t: "cmd", dev: "pc", line: "ping " + p.printerIp }); console.log("unsaved: fixed", T.fixed, "partial", T.partial, "proven", T.proven);
sw("copy running-config startup-config"); sw("");
r = E.act(T, { t: "cmd", dev: "pc", line: "ping " + p.printerIp }); console.log("saved: fixed", T.fixed, "proven", T.proven, "partial", T.partial);
console.log("guess:", E.guess(T, "right"), "solved", T.solved);
{
  const sw2 = T.sim.d.msw.sw, S = p.vlans.staff, a = T.sim.addr("pc");
  console.log("debug run", JSON.stringify(sw2.ports["GigabitEthernet0/1"]).slice(0, 300));
  console.log("debug start", JSON.stringify(sw2.startup && sw2.startup.ports && sw2.startup.ports["GigabitEthernet0/1"]).slice(0, 300), Object.keys(sw2.startup || {}).join(","));
  console.log("debug addr", JSON.stringify(a), "spares", d.sparesParked(T.sim, T.v));
}
