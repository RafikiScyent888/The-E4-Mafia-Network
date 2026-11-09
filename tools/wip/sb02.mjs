/* SB-02 exploration: delete a VLAN on a switch and see what breaks. node tools/wip/sb02.mjs [seed] */
import { BUSINESS_JOBS } from "../../js/build/business.js";
import { exec } from "../../js/net/cmd.js";
import * as SW from "../../js/net/swcli.js";
import { online } from "../../js/build/jobs.js";
const SB10 = BUSINESS_JOBS.find((d) => d.id === "SB-J10"), seed = +(process.argv[2] || 11);
function fresh() { const b = SB10.start(seed), sim = b.sim; for (const a of SB10.solve(b.v, sim)) { if (a.t === "cmd") exec(sim, a.dev, a.line, a.win); else sim.apply(a); } sim.cli = {}; sim.net.extra.build = false; return { sim, p: b.v.plan }; }
const on = (sim, id, lines) => { const S = SW.session(sim.d[id].sw, { via: "console" }); S.mode = "priv"; S.pending = null; S.fresh = false; lines.forEach((l) => SW.exec(S, l)); };
const reach = (sim, a, ip) => { const r = sim.route(a, ip); return !r.fail && r.owner ? r.owner.join("/") : "FAIL:" + (r.fail || "none"); };
for (const [sw, key] of [["bsw", "staff"], ["bsw", "cameras"], ["msw", "printers"], ["msw", "guest"], ["msw", "staff"]]) {
  const { sim, p } = fresh(), V = p.vlans[key];
  on(sim, sw, ["configure terminal", "no vlan " + V.id, "end", "copy running-config startup-config", ""]);
  ["pc", "mgr", "bpc"].forEach((id) => exec(sim, id, "ipconfig /renew"));
  sim.apply({ t: "radio", dev: "guest", on: false }); sim.apply({ t: "radio", dev: "guest", on: true });
  const g = sim.addr("guest");
  console.log(sw, key, V.id, "| pc", online(sim, "pc"), "mgr", online(sim, "mgr"), "bpc", online(sim, "bpc"), "dpc1", online(sim, "dpc1"), "| mgr->printer", reach(sim, "mgr", p.printerIp), "mgr->cam2", reach(sim, "mgr", "10." + p.vlans.cameras.net.split(".")[1] + "." + p.vlans.cameras.id + ".12"), "| guest", g && g.ip, g && g.kind);
}
