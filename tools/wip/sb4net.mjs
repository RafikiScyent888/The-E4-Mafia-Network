/* SB-J4's network in the sim, by hand: SB-J3 done, then the back switch on a trunk from the closet switch.
   node tools/wip/sb4net.mjs [seed] [variant]   variant: native1 | noallow | dynamic */
import { BUSINESS_JOBS } from "../../js/build/business.js";
import { addBackSwitch } from "../../js/net/business.js";
import * as B from "../../js/build/engine.js";
import { exec } from "../../js/net/cmd.js";
const seed = +(process.argv[2] || 11), variant = process.argv[3] || "";
const J = B.open(BUSINESS_JOBS[2], seed); for (const a of BUSINESS_JOBS[2].solve(J.v, J.sim)) B.act(J, a);
const sim = J.sim, p = J.v.plan, S = p.vlans.staff, N = p.vlans.native, T = p.trunk, E = (dev, port) => ({ dev, port });
addBackSwitch(sim);
const ap = (x) => { const r = sim.apply(x); if (r && r.ok === false) console.log("refused", JSON.stringify(x), JSON.stringify(r)); };
const cli = (l) => exec(sim, "tech", l).out;
const con = () => sim.cablesOf("tech").find((c) => c.kind === "console");
ap({ t: "place", dev: "bsw", room: "back" });
ap({ t: "pull", cable: "c-msw-bpc" });
ap({ t: "lay", a: E("msw", T.closet), b: E("bsw", T.back) });
ap({ t: "lay", a: E("bpc", "NIC"), b: E("bsw", p.backPort) });
ap({ t: "pull", cable: con().id }); ap({ t: "place", dev: "tech", room: "back" }); ap({ t: "lay", a: E("tech", "USB-C"), b: E("bsw", "CONSOLE") });
let out = "";
const bswLines = ["", "enable", "configure terminal", "hostname " + p.bswHost, "enable secret " + p.swSecret, "line console 0", "password " + p.swConsole, "login", "exit",
  "vlan " + S.id, "name " + S.name, "exit",
  "interface gi0/" + p.backPort, "description " + p.desc["4"], "switchport mode access", "switchport access vlan " + S.id,
  "interface gi0/" + T.back, "description " + T.backDesc].concat(variant === "dynamic" ? [] : ["switchport mode trunk"]).concat(
  variant === "noallow" ? [] : ["switchport trunk allowed vlan " + S.id], ["switchport trunk native vlan " + N.id, "interface range gi0/2 - 23", "shutdown", "interface range gi0/25 - 28", "shutdown", "end", "copy running-config startup-config", "", "show interfaces trunk", "show vlan brief"]);
for (const l of bswLines) out += cli(l);
console.log(out.split("\n").filter((l) => /%|Invalid|Gi0\/24|Gi0\/1 |VLAN|^\d+\s/.test(l)).join("\n"));
ap({ t: "pull", cable: con().id }); ap({ t: "place", dev: "tech", room: "closet" }); ap({ t: "lay", a: E("tech", "USB-C"), b: E("msw", "CONSOLE") });
out = "";
for (const l of ["", p.swConsole, "enable", p.swSecret, "configure terminal", "interface gi0/" + T.closet, "description " + T.closetDesc, "switchport mode trunk", "switchport trunk allowed vlan " + S.id,
  "switchport trunk native vlan " + (variant === "native1" ? 1 : N.id), "no shutdown", "interface gi0/4", "no description", "shutdown", "end", "copy running-config startup-config", "", "show interfaces trunk"]) out += cli(l);
console.log(out.split("\n").filter((l) => /%|Invalid|Gi0\/2[34]|Port|native/i.test(l)).join("\n"));
console.log("bpc renew:", exec(sim, "bpc", "ipconfig /renew").out.split("\n").filter((l) => /IPv4|Autoconfiguration/.test(l)).join(" | "));
const a = sim.addr("bpc"); console.log("bpc addr", a && a.ip, a && a.kind, " internet", sim.route("bpc", "8.8.8.8").internet, " prints", !!(sim.route("bpc", sim.d.printer.ifaces[0].cfg.ip).routed));
console.log("pc still", sim.route("pc", "8.8.8.8").internet, " visitor still", sim.route("guest", "8.8.8.8").internet);
