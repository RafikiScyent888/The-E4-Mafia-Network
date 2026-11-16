/* The campus template (level 4): Rafiki's IT Services' own headquarters (the owner, 15 November 2026: "Go with your
   recommendations, Rafiki's HQ"; the plan approved 16 November 2026: "Yes to the level 4 plans, build it out"). Three floors:
   1F the service desk and the data room, 2F the technicians' bench, 3F management. As the technician finds it, before the
   first work order:
   - the edge router in the data room runs everything between the VLANs, router-on-a-stick: a subinterface per VLAN on its
     trunk to distribution switch 1, each the VLAN's gateway with a DHCP pool, NAT to the provider (work order 2 moves the
     gateways onto the distribution switch);
   - two layer 3 distribution switches (MSW-3900X) with routing still off, joined by two trunks (not yet bundled: work order 3);
   - an access switch on each floor (MSW-2800G), each uplinked to both distribution switches; left at its defaults, the 2F
     switch has the lowest address, so it's every VLAN's spanning-tree root (work order 4);
   - the two core switches still in their boxes in the data room (work order 5);
   - each switch named, locked, SSH only, its management address on the management VLAN, saved.
   The seed decides the site's addresses, its VLAN numbers and its passwords. */
import { rng, mac } from "./util.js";
import { newSwitch, session, exec } from "./swcli.js";
import { newRouter } from "./rtcli.js";

const SECRETS = ["Core!Riser7", "Dist#Uplink4", "Bench*Floor22", "Riser&Fibre9", "Data!Room31", "Tier3#Mgmt8"];
const CONSOLES = ["Console#HQ5", "Serial!Rack2", "Blue*Line44", "Con0!Desk9"];
const USERS = ["netops", "rafiki", "hqadmin"];
const USERPW = ["Ops-SSH*26", "Rafiki#Vty41", "HQ!Remote17"];
/* the VLAN numbers, one set per site */
const VLAN_SETS = [
  { svc: 10, bench: 20, office: 30, servers: 40, printers: 50, mgmt: 99, native: 999, parking: 998 },
  { svc: 110, bench: 120, office: 130, servers: 140, printers: 150, mgmt: 199, native: 919, parking: 918 },
  { svc: 210, bench: 220, office: 230, servers: 240, printers: 250, mgmt: 254, native: 929, parking: 928 }   /* every addressed VLAN under 255: its number is its subnet's third octet */
];
const NAMES = { svc: "SERVICE-DESK", bench: "BENCH", office: "OFFICE", servers: "SERVERS", printers: "PRINTERS", mgmt: "MGMT", native: "NATIVE-UNUSED", parking: "PARKING" };
/* the rooms, floor by floor, and the cable runs between them (metres; the riser carries the uplinks up the building) */
export const CAMPUS_FLOORS = { data: 1, svc: 1, c2: 2, bench: 2, c3: 3, office: 3 };
export const CAMPUS_RUN = { data: { svc: 22, c2: 38, bench: 52, c3: 54, office: 68 }, svc: { c2: 50, bench: 60, c3: 66, office: 76 }, c2: { bench: 18, c3: 26, office: 40 }, bench: { c3: 40, office: 48 }, c3: { office: 16 } };
/* the logical diagram (three tiers, the provider at the top) and the floor plan (three floors, one band each) */
export const CAMPUS_LAYOUT = {
  modem: { x: 60, y: 40, px: 70, py: 70, room: "data" }, edge: { x: 230, y: 40, px: 150, py: 70, room: "data" },
  core1: { x: 300, y: 110, px: 230, py: 70, room: "data" }, core2: { x: 540, y: 110, px: 300, py: 70, room: "data" },
  dist1: { x: 300, y: 190, px: 150, py: 150, room: "data" }, dist2: { x: 540, y: 190, px: 230, py: 150, room: "data" },
  tech: { x: 70, y: 190, px: 300, py: 150, room: "data" },
  acc1: { x: 150, y: 330, px: 70, py: 150, room: "data" }, acc2: { x: 420, y: 330, px: 80, py: 330, room: "c2" }, acc3: { x: 690, y: 330, px: 80, py: 530, room: "c3" },
  sd1: { x: 70, y: 460, px: 470, py: 80, room: "svc" }, hd1: { x: 150, y: 460, px: 600, py: 80, room: "svc" }, pr1: { x: 230, y: 460, px: 730, py: 80, room: "svc" },
  bn1: { x: 380, y: 460, px: 420, py: 330, room: "bench" }, bn2: { x: 460, y: 460, px: 600, py: 330, room: "bench" },
  mgr: { x: 620, y: 460, px: 420, py: 530, room: "office" }, fin: { x: 700, y: 460, px: 600, py: 530, room: "office" }, pr3: { x: 780, y: 460, px: 760, py: 530, room: "office" }
};
export const CAMPUS_ROOM_BOX = { data: [30, 30, 360, 230], svc: [360, 30, 980, 230], c2: [30, 250, 200, 430], bench: [200, 250, 980, 430], c3: [30, 450, 200, 630], office: [200, 450, 980, 630] };
const swMac = function (hi, lo) { return "00e0.4c" + hi.toString(16).padStart(2, "0") + "." + lo.toString(16).padStart(4, "0"); };
const run = function (sw, lines) { const S = session(sw); ["", "enable", "configure terminal"].concat(lines, ["end", "copy running-config startup-config", ""]).forEach(function (l) { exec(S, l); }); return sw; };

export function makeCampus(seed) {
  const r = rng(seed ^ 0x4c41), V = VLAN_SETS[r.int(0, VLAN_SETS.length - 1)], b = r.pick([16, 27, 38, 49, 63]);
  const net24 = function (v) { return "10." + b + "." + v + ".0"; }, ip = function (v, h) { return "10." + b + "." + v + "." + h; };
  const vl = {}; Object.keys(V).forEach(function (k) { vl[k] = k === "native" || k === "parking" ? { id: V[k], name: NAMES[k] } : { id: V[k], name: NAMES[k], net: net24(V[k]), gw: ip(V[k], 1) }; });   /* the native and parking VLANs carry no addresses */
  const plan = {
    tag: "RIT", domain: "rafiki-it.lan", secret: r.pick(SECRETS), console: r.pick(CONSOLES), user: r.pick(USERS), userPw: r.pick(USERPW), mask: "255.255.255.0",
    vlans: vl, dns: ["203.0.113.53", "203.0.113.54"], excl: 20,
    edge: { host: "RIT-EDGE", wan: "GigabitEthernet0/0", lan: "GigabitEthernet0/1" },
    sw: { dist1: { host: "RIT-DIST1", ip: ip(V.mgmt, 2) }, dist2: { host: "RIT-DIST2", ip: ip(V.mgmt, 3) }, acc1: { host: "RIT-ACC-1F", ip: ip(V.mgmt, 11) }, acc2: { host: "RIT-ACC-2F", ip: ip(V.mgmt, 12) }, acc3: { host: "RIT-ACC-3F", ip: ip(V.mgmt, 13) }, core1: { host: "RIT-CORE1" }, core2: { host: "RIT-CORE2" } },
    printers: { pr1: ip(V.printers, 10), pr3: ip(V.printers, 11) },
    /* the access ports: each switch's desk ports, what's on them and its VLAN */
    desks: { acc1: { "1": ["sd1", "svc"], "2": ["hd1", "svc"], "3": ["pr1", "printers"] }, acc2: { "1": ["bn1", "bench"], "2": ["bn2", "bench"] }, acc3: { "1": ["mgr", "office"], "2": ["fin", "office"], "3": ["pr3", "printers"] } },
    /* the uplinks: each access switch's port 23 to distribution 1, port 24 to distribution 2; between the distribution switches, ports 21 and 22 */
    up: { acc1: "1", acc2: "2", acc3: "3" }, distLinks: ["21", "22"], edgePort: "24"
  };
  const all = Object.keys(V).filter(function (k) { return k !== "native" && k !== "parking"; }).map(function (k) { return V[k]; }).sort(function (x, y) { return x - y; });
  const vlanLines = Object.keys(V).flatMap(function (k) { return ["vlan " + V[k], "name " + NAMES[k], "exit"]; });
  const lock = function (host) { return ["hostname " + host, "enable secret " + plan.secret, "line console 0", "password " + plan.console, "login", "exit", "ip domain-name " + plan.domain, "username " + plan.user + " secret " + plan.userPw, "crypto key generate rsa modulus 2048", "line vty 0 15", "login local", "transport input ssh", "exit"]; };
  const trunk = function (ports) { return ["interface range " + ports, "switchport trunk native vlan " + V.native, "switchport trunk allowed vlan " + all.join(","), "switchport mode trunk", "switchport nonegotiate", "exit"]; };
  const mgmt = function (id) { return ["interface vlan " + V.mgmt, "ip address " + plan.sw[id].ip + " " + plan.mask, "no shutdown", "exit", "ip default-gateway " + vl.mgmt.gw]; };
  /* the switches: the 2F access switch has the lowest address of all (left at the defaults, it's the root of every VLAN) */
  const dist = function (id, hi) { const sw = newSwitch({ l3: true, mac: swMac(hi, 0x0201 + (id === "dist2" ? 1 : 0)) });
    const spare = id === "dist1" ? "gi0/4 - 20 , gi0/23 , gi0/25 - 28" : "gi0/4 - 20 , gi0/23 - 28";   /* distribution 1's port 24 is the edge router's trunk */
    return run(sw, lock(plan.sw[id].host).concat(vlanLines, trunk("gi0/1 - 3 , gi0/21 - 22"), id === "dist1" ? trunk("gi0/24") : [], mgmt(id), ["interface range " + spare, "switchport access vlan " + V.parking, "shutdown", "exit"])); };
  const access = function (id, lo) { const sw = newSwitch({ mac: swMac(0x10, lo) }), D = plan.desks[id], lines = lock(plan.sw[id].host).concat(vlanLines, trunk("gi0/23 - 24"), mgmt(id));
    Object.keys(D).forEach(function (p) { lines.push("interface gi0/" + p, "description " + D[p][0].toUpperCase() + "-" + NAMES[D[p][1]], "switchport mode access", "switchport access vlan " + V[D[p][1]], "exit"); });
    const used = Object.keys(D).map(Number), spare = []; for (let n = 1; n <= 22; n++) if (used.indexOf(n) < 0) spare.push(n);
    if (spare.length) lines.push("interface range " + spare.map(function (n) { return "gi0/" + n; }).join(" , "), "switchport mode access", "switchport access vlan " + V.parking, "shutdown", "exit");
    lines.push("interface range gi0/25 - 28", "shutdown", "exit"); return run(sw, lines); };
  const sws = { dist1: dist("dist1", 0x30), dist2: dist("dist2", 0x30), acc1: access("acc1", 0x0303), acc2: access("acc2", 0x0101), acc3: access("acc3", 0x0404) };
  /* the edge router: the provider on Gi0/0, a subinterface per VLAN on its trunk to distribution 1, each the gateway with a pool */
  const rt = newRouter({ mac: swMac(0x40, 0x0001) }), RS = session(rt);   /* the router's command line runs through the same session (registerOS) */
  const rlines = ["", "enable", "configure terminal", "hostname " + plan.edge.host, "enable secret " + plan.secret, "line console 0", "password " + plan.console, "login", "exit", "ip domain-name " + plan.domain, "username " + plan.user + " secret " + plan.userPw, "crypto key generate rsa modulus 2048", "line vty 0 15", "login local", "transport input ssh", "exit",
    "interface " + plan.edge.wan, "ip address dhcp", "ip nat outside", "no shutdown", "exit", "interface " + plan.edge.lan, "no shutdown", "exit"];
  ["svc", "bench", "office", "servers", "printers", "mgmt"].forEach(function (k) { rlines.push("interface " + plan.edge.lan + "." + V[k], "encapsulation dot1Q " + V[k], "ip address " + vl[k].gw + " " + plan.mask, "ip nat inside", "exit"); });
  ["svc", "bench", "office"].forEach(function (k) { rlines.push("ip dhcp excluded-address " + ip(V[k], 1) + " " + ip(V[k], plan.excl), "ip dhcp pool " + NAMES[k], "network " + vl[k].net + " " + plan.mask, "default-router " + vl[k].gw, "dns-server " + plan.dns.join(" "), "exit"); });
  rlines.push("access-list 1 permit 10." + b + ".0.0 0.0.255.255", "ip nat inside source list 1 interface " + plan.edge.wan + " overload", "end", "copy running-config startup-config", "");
  rlines.forEach(function (l) { exec(RS, l); });
  const nic = function (rr, cfg) { return [{ name: "Ethernet", type: "eth", port: "NIC", mac: mac(rr), desc: "Gigabit Network Connection", cfg: cfg || { mode: "dhcp", dnsMode: "auto" }, lease: null, apipa: null }]; };
  const pc = function (id, label, user) { return { id: id, kind: "pc", label: label, sub: "DHCP", on: true, os: "windows", user: user, host: "RIT-" + label.toUpperCase().replace(/[^A-Z0-9]+/g, "-"), ifaces: nic(r) }; };
  const printer = function (id, label, addr, room) { return { id: id, kind: "printer", label: label, sub: addr, on: true, ifaces: [{ name: "Wired", type: "eth", port: "NET", mac: mac(r), cfg: { mode: "static", ip: addr, mask: plan.mask, gw: vl.printers.gw, dns: [vl.printers.gw] }, lease: null, apipa: null }] }; };
  const swDev = function (id, label, sub, l3) { return { id: id, kind: "mswitch", label: label, sub: sub, on: true, mac: sws[id] ? sws[id].mac : null, sw: sws[id] }; };
  const dev = {
    isp: { id: "isp", kind: "isp", label: "ISP", sub: "Internet" }, wall: { id: "wall", kind: "wall", label: "Wall outlet", sub: "the provider's line" },
    modem: { id: "modem", kind: "modem", label: "Provider's modem", sub: "the provider's", on: true, mgmt: "192.168.100.1", mac: mac(r) },
    edge: { id: "edge", kind: "brouter", label: "Edge router", sub: "BR-4200", on: true, sw: rt, sfp: { "Gi0/8": null, "Gi0/9": null } },
    dist1: swDev("dist1", "Distribution switch 1", "MSW-3900X"), dist2: swDev("dist2", "Distribution switch 2", "MSW-3900X"),
    acc1: swDev("acc1", "1F access switch", "MSW-2800G"), acc2: swDev("acc2", "2F access switch", "MSW-2800G"), acc3: swDev("acc3", "3F access switch", "MSW-2800G"),
    core1: { id: "core1", kind: "mswitch", label: "Core switch 1", sub: "MSW-3900X", on: true, boxed: true, mac: swMac(0x50, 0x0001), sw: newSwitch({ l3: true, mac: swMac(0x50, 0x0001) }) },
    core2: { id: "core2", kind: "mswitch", label: "Core switch 2", sub: "MSW-3900X", on: true, boxed: true, mac: swMac(0x50, 0x0002), sw: newSwitch({ l3: true, mac: swMac(0x50, 0x0002) }) },
    sd1: pc("sd1", "Service desk PC", "servicedesk"), hd1: pc("hd1", "Help desk PC", "helpdesk"), bn1: pc("bn1", "Bench PC 1", "bench"), bn2: pc("bn2", "Bench PC 2", "bench"),
    mgr: pc("mgr", "Manager's PC", "rafiki"), fin: pc("fin", "Finance PC", "finance"),
    pr1: printer("pr1", "1F printer", plan.printers.pr1), pr3: printer("pr3", "3F printer", plan.printers.pr3),
    tech: { id: "tech", kind: "techlaptop", label: "Your laptop", sub: "console", on: true, os: "windows", user: "tech", host: "RAFIKI-TECH",
      ifaces: [{ name: "Ethernet", type: "eth", port: "ETH", mac: mac(rng(seed ^ 0x7ec4)), desc: "Ethernet Connection (USB-C dock)", cfg: { mode: "dhcp", dnsMode: "auto" }, lease: null, apipa: null }], tftp: { on: false, root: "C:\\TFTP-Root", files: [], log: [] } }
  };
  const cab = function (id, a, ap, b2, bp, len) { return { id: id, kind: "cat6", a: { dev: a, port: ap, seated: true }, b: { dev: b2, port: bp, seated: true }, cond: "good", length: len }; };
  const rooms = {}; Object.keys(CAMPUS_LAYOUT).forEach(function (id) { rooms[id] = CAMPUS_LAYOUT[id].room; });
  const len = function (a, b2) { const A = rooms[a], B = rooms[b2]; return A === B ? 3 : (CAMPUS_RUN[A] && CAMPUS_RUN[A][B]) || (CAMPUS_RUN[B] && CAMPUS_RUN[B][A]) || 40; };
  const cables = [{ id: "c-coax", kind: "coax", a: { dev: "wall", port: "F", tight: true }, b: { dev: "modem", port: "CABLE IN", tight: true }, cond: "good" },
    cab("c-modem-edge", "modem", "ETH", "edge", "Gi0/0", 1), cab("c-edge-dist1", "edge", "Gi0/1", "dist1", plan.edgePort, 1),
    cab("c-dist-21", "dist1", "21", "dist2", "21", 1), cab("c-dist-22", "dist1", "22", "dist2", "22", 1)];
  ["acc1", "acc2", "acc3"].forEach(function (a) { cables.push(cab("c-" + a + "-d1", a, "23", "dist1", plan.up[a], len(a, "dist1")), cab("c-" + a + "-d2", a, "24", "dist2", plan.up[a], len(a, "dist2"))); });
  Object.keys(plan.desks).forEach(function (a) { const D = plan.desks[a]; Object.keys(D).forEach(function (p) { const d = D[p][0]; cables.push(cab("c-" + a + "-" + d, a, p, d, d.indexOf("pr") === 0 ? "NET" : "NIC", len(a, d))); }); });
  return {
    seed: seed, site: "campus", client: { name: "Rafiki's IT Services", street: "HQ", manager: "Rafiki", tag: plan.tag }, mask: plan.mask, plan: plan,
    isp: { up: true, outage: false, plan: 1000, gw: "198.51.100.1", core: "203.0.113.1", dns: plan.dns.slice(), wanIp: "198.51.100." + r.int(20, 240), mask: "255.255.255.0" },
    devices: dev, cables: cables, neighbours: [], ports: {}, rooms: rooms,
    roomNames: { data: "Data room (1F)", svc: "Service desk (1F)", c2: "2F closet", bench: "Technicians' bench (2F)", c3: "3F closet", office: "Management (3F)" }, floors: CAMPUS_FLOORS, runs: CAMPUS_RUN,
    extra: { build: true }
  };
}
