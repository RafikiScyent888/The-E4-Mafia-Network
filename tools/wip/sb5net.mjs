/* SB-J5's network in the sim, by hand: SB-J4 done, then the two cameras on their own VLAN, their fixed addresses, kept apart, and
   reached from outside through port forwards. node tools/wip/sb5net.mjs [seed] [variant]
   variant: noacl | nonat | dhcp (cameras left on DHCP) | wifi (the phone on the guest Wi-Fi) | noallow (the trunk between the switches never carries it) */
import { BUSINESS_JOBS } from "../../js/build/business.js";
import { addCameraKit } from "../../js/net/business.js";
import * as B from "../../js/build/engine.js";
import { exec } from "../../js/net/cmd.js";
import { browse } from "../../js/net/pages.js";
const seed = +(process.argv[2] || 11), variant = process.argv[3] || "";
const J = B.open(BUSINESS_JOBS[3], seed); for (const a of BUSINESS_JOBS[3].solve(J.v, J.sim)) B.act(J, a);
const sim = J.sim, p = J.v.plan, C = p.vlans.cameras, S = p.vlans.staff, G = p.vlans.guest, T = p.trunk, E = (dev, port) => ({ dev, port });
addCameraKit(sim); sim.cli = {};
const ap = (x) => { const r = sim.apply(x); if (r && r.ok === false) console.log("refused", JSON.stringify(x), JSON.stringify(r)); return r; };
const cli = (lines) => lines.map((l) => String(exec(sim, "tech", l).out)).filter((l) => /%|Invalid|Incomplete/.test(l));
const con = () => sim.cablesOf("tech").find((c) => c.kind === "console");
const net3 = C.net.replace(/\.0$/, ".");
ap({ t: "place", dev: "cinj1", room: "closet" }); ap({ t: "place", dev: "cam1", room: "guest" });
ap({ t: "lay", a: E("msw", p.cams[0].port), b: E("cinj1", "DATA IN") }); ap({ t: "lay", a: E("cinj1", "PoE OUT"), b: E("cam1", "LAN") });
ap({ t: "place", dev: "cinj2", room: "back" }); ap({ t: "place", dev: "cam2", room: "back" });
ap({ t: "lay", a: E("bsw", p.cams[1].port), b: E("cinj2", "DATA IN") }); ap({ t: "lay", a: E("cinj2", "PoE OUT"), b: E("cam2", "LAN") });
console.log("powered", sim.on("cam1"), sim.on("cam2"), "addr", JSON.stringify(sim.addr("cam1")), JSON.stringify(sim.addr("cam2")));
console.log("closet:", cli(["", p.swConsole, "enable", p.swSecret, "configure terminal", "vlan " + C.id, "name " + C.name, "exit",
  "interface gi0/" + p.cams[0].port, "description " + p.cams[0].desc, "switchport mode access", "switchport access vlan " + C.id, "no shutdown", "exit"].concat(
  variant === "noallow" ? [] : ["interface gi0/" + T.closet, "switchport trunk allowed vlan add " + C.id], ["end", "copy running-config startup-config", ""])));
ap({ t: "pull", cable: con().id }); ap({ t: "place", dev: "tech", room: "back" }); ap({ t: "lay", a: E("tech", "USB-C"), b: E("bsw", "CONSOLE") });
console.log("back:", cli(["", p.swConsole, "enable", p.swSecret, "configure terminal", "vlan " + C.id, "name " + C.name, "exit",
  "interface gi0/" + p.cams[1].port, "description " + p.cams[1].desc, "switchport mode access", "switchport access vlan " + C.id, "no shutdown", "exit"].concat(
  variant === "noallow" ? [] : ["interface gi0/" + T.back, "switchport trunk allowed vlan add " + C.id], ["end", "copy running-config startup-config", ""])));
ap({ t: "pull", cable: con().id }); ap({ t: "place", dev: "tech", room: "closet" }); ap({ t: "lay", a: E("tech", "USB-C"), b: E("rtr", "CONSOLE") });
const sub = p.lanPort + "." + C.id, w = "0.0.0.255";
console.log("router:", cli(["", p.rtConsole, "enable", p.rtSecret, "configure terminal", "interface " + sub, "encapsulation dot1Q " + C.id, "ip address " + C.gw + " " + p.vmask].concat(variant === "nonat" ? [] : ["ip nat inside"], ["exit",
  "ip dhcp excluded-address " + C.gw + " " + net3 + p.camExcl, "ip dhcp pool " + C.name, "network " + C.net + " " + p.vmask, "default-router " + C.gw, "exit", "end"])));
console.log("leases", JSON.stringify(sim.addr("cam1")), JSON.stringify(sim.addr("cam2")));
const pg = browse(sim, "mgr", "https://" + sim.addr("cam1").ip); console.log("mgr browses cam1 (DHCP):", pg.status, pg.head || "", pg.text || "");
if (variant !== "dhcp") p.cams.forEach((c) => ap({ t: "client", dev: c.id, values: { mode: "static", ip: net3 + c.host, mask: p.vmask, gw: C.gw } }));
console.log("fixed", JSON.stringify(sim.addr("cam1")), JSON.stringify(sim.addr("cam2")));
console.log("router 2:", cli(["configure terminal"].concat(variant === "noacl" ? [] : ["interface " + sub, "ip access-group " + p.camAcl + " in", "exit", "ip access-list extended " + p.camAcl, "permit tcp " + C.net + " " + w + " eq 443 any", "exit"],
  p.cams.map((c) => "ip nat inside source static tcp " + net3 + c.host + " 443 interface " + p.wanPort + " " + c.ext), ["end", "copy running-config startup-config", ""])));
for (const c of p.cams) { const r = sim.route("mgr", net3 + c.host, { proto: "tcp", port: 443, sport: 50123 }); console.log("mgr -> " + c.id + " 443:", r.fail || (r.routed ? "routed" : r.local ? "local" : "?")); }
for (const c of p.cams) { const r = sim.route(c.id, sim.addr("mgr").ip, { proto: "tcp", port: 445, sport: 50000 }); console.log(c.id + " -> mgr 445:", r.fail || "REACHED"); const i = sim.route(c.id, "8.8.8.8"); console.log(c.id + " -> internet:", i.fail || (i.internet ? "REACHED" : "?")); }
if (variant === "wifi") { ap({ t: "radio", dev: "mphone", on: true }); ap({ t: "joinssid", dev: "mphone", ssid: p.guestSsid, pass: p.guestPw }); }
for (const c of p.cams) { const r = sim.fromInternet(sim.net.isp.wanIp, c.ext); console.log("internet -> " + sim.net.isp.wanIp + ":" + c.ext + ":", JSON.stringify(r)); }
console.log("staff still:", sim.route("pc", "8.8.8.8").internet, sim.route("bpc", "8.8.8.8").internet, "guest:", sim.route("guest", "8.8.8.8").internet);
/* the pages: the manager's PC opens each camera's page; the phone on mobile data opens each forward; on the guest Wi-Fi it can't */
for (const c of p.cams) { const r = browse(sim, "mgr", "https://" + net3 + c.host); console.log("mgr page " + c.id + ":", r.status, r.title || r.text, JSON.stringify(r.net || {})); }
ap({ t: "radio", dev: "mphone", on: false });
for (const c of p.cams) { const r = browse(sim, "mphone", "https://" + sim.net.isp.wanIp + ":" + c.ext); console.log("phone (mobile data) " + c.ext + ":", r.status, r.title || r.text); }
console.log("phone (mobile data) private:", browse(sim, "mphone", "https://" + net3 + "11").status);
ap({ t: "radio", dev: "mphone", on: true }); ap({ t: "joinssid", dev: "mphone", ssid: p.guestSsid, pass: p.guestPw });
console.log("phone (guest Wi-Fi) 8443:", browse(sim, "mphone", "https://" + sim.net.isp.wanIp + ":8443").status, browse(sim, "mphone", "https://" + sim.net.isp.wanIp + ":8443").text);
ap({ t: "pull", cable: con().id }); ap({ t: "place", dev: "tech", room: "closet" }); ap({ t: "lay", a: E("tech", "USB-C"), b: E("rtr", "CONSOLE") });
exec(sim, "tech", ""); exec(sim, "tech", p.rtConsole); exec(sim, "tech", "enable"); exec(sim, "tech", p.rtSecret);
console.log(String(exec(sim, "tech", "show ip nat translations").out));
