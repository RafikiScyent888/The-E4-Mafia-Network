/* SB-J6's network in the sim, by hand: SB-J5 done, then the hardening, step by step, printing what each guard does to the
   business. node tools/wip/sb6net.mjs [seed] [variant]. Not part of the site */
import { BUSINESS_JOBS } from "../../js/build/business.js";
import * as B from "../../js/build/engine.js";
import { exec } from "../../js/net/cmd.js";
const seed = +(process.argv[2] || 11), variant = process.argv[3] || "";
const J = B.open(BUSINESS_JOBS[4], seed); for (const a of BUSINESS_JOBS[4].solve(J.v, J.sim)) B.act(J, a);
const sim = J.sim, p = J.v.plan;
const E = (dev, port) => ({ dev, port }), ap = (x) => { const r = sim.apply(x); if (r && r.ok === false) console.log("refused", JSON.stringify(x), JSON.stringify(r)); return r; };
const cli = (lines, all) => lines.map((l) => String(exec(sim, "tech", l).out)).filter((l) => all || /%|Invalid|Incomplete|rejected/.test(l));
const con = () => sim.cablesOf("tech").find((c) => c.kind === "console");
const to = (dev, room) => { ap({ t: "pull", cable: con().id }); ap({ t: "place", dev: "tech", room: room }); ap({ t: "lay", a: E("tech", "USB-C"), b: E(dev, "CONSOLE") }); exec(sim, "tech", ""); };
const v = p.vlans, inet = (id) => { const r = sim.route(id, "8.8.8.8"); return r.internet ? "online" : r.fail + (r.dai ? " (ARP dropped at " + r.dai.dev + " " + r.dai.port + " vlan " + r.dai.vlan + ")" : ""); };
const state = (tag) => console.log(tag.padEnd(34), "pc:", inet("pc"), "| mgr:", inet("mgr"), "| bpc:", inet("bpc"), "| guest:", inet("guest"), "| cams:", p.cams.map((c) => sim.fromInternet(sim.net.isp.wanIp, c.ext).ok ? "ok" : sim.fromInternet(sim.net.isp.wanIp, c.ext).why).join(","), "| print:", (() => { const r = sim.route("pc", sim.d.printer.ifaces[0].cfg.ip); return !!((r.local || r.routed) && r.owner && r.owner.indexOf("printer") >= 0); })());
state("SB-J6 start");
to("msw", "closet"); console.log("login closet:", cli(["", p.swConsole, "enable", p.swSecret, "configure terminal"]));
/* variants: notrust (the router's port left untrusted), cams (ARP inspection on the cameras' VLAN too), old (on the old network, VLAN 1, too) */
const dv = [v.staff.id, v.guest.id].concat(variant === "cams" ? [v.cameras.id] : [], variant === "old" ? [1] : []).join(",");
console.log("snoop closet:", cli(["ip dhcp snooping vlan " + dv, "ip dhcp snooping"].concat(variant === "notrust" ? [] : ["interface gi0/24", "ip dhcp snooping trust", "ip arp inspection trust", "exit"])));
state("closet snooping on");
for (const id of ["pc", "mgr", "bpc"]) exec(sim, id, "ipconfig /renew");
state("staff renewed");
console.log("dai closet:", cli(["ip arp inspection vlan " + dv]));
state("closet ARP inspection on");
ap({ t: "radio", dev: "guest", on: false }); ap({ t: "radio", dev: "guest", on: true }); ap({ t: "joinssid", dev: "guest", ssid: p.guestSsid, pass: p.guestPw });
state("guest rejoined");
console.log(cli(["do show ip dhcp snooping binding"], true).join("\n"));
/* port security on the front PC's port, sticky, one address, shut on violation */
console.log("psec:", cli(["interface gi0/1", "switchport mode access", "switchport port-security", "switchport port-security mac-address sticky", "switchport port-security maximum 1", "switchport port-security violation shutdown", "end"]));
console.log(cli(["show port-security interface gi0/1"], true).join("\n"));
/* a stranger: the PC's cable into your laptop instead */
const pcc = sim.cablesOf("pc").find((c) => c.kind === "cat6"); const pe = pcc.a.dev === "pc" ? "a" : "b";
ap({ t: "pull", cable: pcc.id }); ap({ t: "lay", a: E("tech", "ETH"), b: E("msw", "1") });
console.log(cli(["show interfaces status"], true).join("\n").split("\n").filter((l) => /Gi0\/1 /.test(l)).join("\n"));
console.log(cli(["show port-security"], true).join("\n"));
ap({ t: "pull", cable: sim.cablesOf("tech").find((c) => c.kind === "cat6").id }); ap({ t: "lay", a: E("pc", "NIC"), b: E("msw", "1") });
state("PC back, port still shut");
console.log("reset:", cli(["configure terminal", "interface gi0/1", "shutdown", "no shutdown", "end"])); exec(sim, "pc", "ipconfig /renew");
state("port reset, PC renewed");
console.log(cli(["show running-config"], true).join("\n").split("\n").filter((l) => /snooping|inspection|port-security/.test(l)).join("\n"));
