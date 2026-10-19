/* SB-J3's network in the sim, by hand: SB-J2 done, then the guest kit and the guest configuration */
import { BUSINESS_JOBS } from "../../js/build/business.js";
import { addGuestKit } from "../../js/net/business.js";
import * as B from "../../js/build/engine.js";
import { exec } from "../../js/net/cmd.js";
const seed = +(process.argv[2] || 11);
const J = B.open(BUSINESS_JOBS[1], seed); for (const a of BUSINESS_JOBS[1].solve(J.v, J.sim)) B.act(J, a);
const sim = J.sim, p = J.v.plan, G = p.vlans.guest, S = p.vlans.staff, E = (dev, port) => ({ dev, port });
addGuestKit(sim);
const cli = (l) => exec(sim, "tech", l).out;
const ap = (x) => console.log(JSON.stringify(x), JSON.stringify(sim.apply(x)).slice(0, 160));
ap({ t: "place", dev: "injector", room: "closet" }); ap({ t: "place", dev: "ap", room: "guest" });
ap({ t: "lay", a: E("msw", "5"), b: E("injector", "DATA IN") }); ap({ t: "lay", a: E("injector", "PoE OUT"), b: E("ap", "ETH") });
ap({ t: "pull", cable: sim.cablesOf("tech").find((c) => c.kind === "console").id }); ap({ t: "lay", a: E("tech", "USB-C"), b: E("msw", "CONSOLE") });
let out = "";
for (const l of ["", p.swConsole, "enable", p.swSecret, "configure terminal", "vlan " + G.id, "name " + G.name, "exit", "interface gi0/5", "description " + p.apDesc, "switchport mode trunk", "switchport trunk allowed vlan 1," + G.id, "no shutdown", "end", "copy running-config startup-config", "", "show interfaces trunk", "show lldp neighbors"]) out += cli(l);
console.log(out.split("\n").filter((l) => /%|Invalid|Gi0\/5|Gi0\/24|AP/.test(l)).join("\n"));
ap({ t: "pull", cable: sim.cablesOf("tech").find((c) => c.kind === "console").id }); ap({ t: "lay", a: E("tech", "USB-C"), b: E("rtr", "CONSOLE") });
out = "";
const net = G.net, wild = "0.0.0.255";
for (const l of ["", p.rtConsole, "enable", p.rtSecret, "configure terminal", "interface " + p.lanPort + "." + G.id, "encapsulation dot1Q " + G.id, "ip address " + G.gw + " " + p.vmask, "ip nat inside", "ip access-group " + p.guestAcl + " in", "exit",
  "ip access-list extended " + p.guestAcl, "permit udp any any eq bootps", "deny ip " + net + " " + wild + " " + S.net + " " + wild, "deny ip " + net + " " + wild + " " + p.lan + " " + wild, "permit ip " + net + " " + wild + " any", "exit",
  "ip dhcp excluded-address " + G.gw + " " + G.net.replace(/\.0$/, ".10"), "ip dhcp pool " + G.name, "network " + G.net + " " + p.vmask, "default-router " + G.gw, "dns-server " + p.dns.join(" "), "exit",
  "access-list 1 permit " + G.net + " 0.0.0.255", "end", "copy running-config startup-config", "", "show ip dhcp binding"]) out += cli(l);
console.log(out.split("\n").filter((l) => /%|Invalid|\.\d+\s+[0-9a-f.]{14}/.test(l)).join("\n"));
const apA = sim.addr("ap"); console.log("ap on:", sim.on("ap"), "ap addr:", apA && apA.ip, apA && apA.kind);
console.log("mgr reaches ap:", JSON.stringify(sim.route("mgr", apA && apA.ip)).slice(0, 200));
ap({ t: "apnet", dev: "ap", net: { ssid: p.guestSsid, sec: "WPA2-Personal", psk: p.guestPw, vlan: G.id } });
console.log("aps:", sim.aps().map((a) => a.id + ":" + a.ssid + ":" + a.band + ":vlan" + a.vlan).join(" "));
ap({ t: "joinssid", dev: "guest", ssid: p.guestSsid, pass: "wrong-one-1" }); console.log("wrong pw:", JSON.stringify(sim.wifiLink("guest")).slice(0, 120), JSON.stringify(sim.addr("guest")));
ap({ t: "joinssid", dev: "guest", ssid: p.guestSsid, pass: p.guestPw }); const ga = sim.addr("guest"); console.log("right pw:", ga && ga.ip, ga && ga.dns);
console.log("guest internet:", sim.route("guest", "8.8.8.8").internet, " guest->printer:", JSON.stringify(sim.route("guest", sim.d.printer.ifaces[0].cfg.ip)).slice(0, 120));
console.log("guest->staff pc:", JSON.stringify(sim.route("guest", sim.addr("pc").ip)).slice(0, 120), " guest->switch:", JSON.stringify(sim.route("guest", p.swIp)).slice(0, 100));
console.log("staff->guest:", JSON.stringify(sim.route("pc", ga.ip)).slice(0, 120), " staff->printer:", !!sim.route("pc", sim.d.printer.ifaces[0].cfg.ip).routed, " staff internet:", sim.route("pc", "8.8.8.8").internet);
console.log(exec(sim, "guest", "ping 8.8.8.8").out.slice(0, 200));
