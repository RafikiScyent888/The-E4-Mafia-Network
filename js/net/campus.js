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
/* the training floor's VLAN (work order 7, a new floor end to end), one per set: like the others, its number is its subnet's third octet */
const TRAIN_V = [60, 160, 235];
/* the Training Annex's VLANs (work order 8), one pair per set: the classroom and the Annex's own management network. Behind a routed
   link they're the Annex's alone, but each still gets a subnet of its own, its number its third octet */
const ANNEX_V = [{ cls: 70, mgmt: 71 }, { cls: 170, mgmt: 171 }, { cls: 236, mgmt: 237 }];
const NAMES = { svc: "SERVICE-DESK", bench: "BENCH", office: "OFFICE", servers: "SERVERS", printers: "PRINTERS", mgmt: "MGMT", native: "NATIVE-UNUSED", parking: "PARKING" };
/* the rooms, floor by floor, and the cable runs between them (metres; the riser carries the uplinks up the building) */
export const CAMPUS_FLOORS = { data: 1, svc: 1, c2: 2, bench: 2, c3: 3, office: 3, c4: 4, train: 4, acomms: "A", class: "A" };   /* the fourth floor, the training room (work order 7); the Annex across the car park (work order 8) */
export const CAMPUS_RUN = { data: { svc: 22, c2: 38, bench: 52, c3: 54, office: 68, c4: 70, train: 84 }, svc: { c2: 50, bench: 60, c3: 66, office: 76, c4: 82, train: 92 }, c2: { bench: 18, c3: 26, office: 40, c4: 34, train: 48 }, bench: { c3: 40, office: 48, c4: 52, train: 58 }, c3: { office: 16, c4: 18, train: 32 }, office: { c4: 30, train: 40 }, c4: { train: 16 },
  /* the Training Annex, across the car park (work order 8): every run from the main building there goes out through the duct, well past copper's 100 m */
  acomms: { data: 185, svc: 195, c2: 210, bench: 220, c3: 225, office: 235, c4: 240, train: 250, class: 14 }, class: { data: 196, svc: 206, c2: 221, bench: 231, c3: 236, office: 246, c4: 251, train: 261 } };
/* the fibre a run between two rooms is laid on, where it isn't the office's OM2 multimode: the duct to the Annex carries OS2 single-mode */
export const CAMPUS_FIBRE = { "acomms|data": { fiber: "SMF", jacket: "OS2 9/125 µm SINGLE-MODE", extra: 0 } };
/* the logical diagram (three tiers, the provider at the top) and the floor plan (three floors, one band each) */
export const CAMPUS_LAYOUT = {
  isp: { x: 10, y: 40 }, modem: { x: 210, y: 40, px: 120, py: 110, room: "data" }, edge: { x: 560, y: 40, lab: "right", px: 290, py: 110, room: "data" },
  core1: { x: 300, y: 150, lab: "left", px: 460, py: 110, room: "data" }, core2: { x: 820, y: 150, lab: "right", px: 460, py: 195, room: "data" },
  dist1: { x: 380, y: 270, lab: "left", px: 290, py: 195, room: "data" }, dist2: { x: 740, y: 270, lab: "right", px: 120, py: 280, room: "data" },
  tech: { x: 30, y: 240, px: 120, py: 195, room: "data", alt: { c4: { x: 1040, y: 270, px: 265, py: 855 }, acomms: { x: 120, y: 1100, px: 190, py: 1150 } } },   /* carried to the Annex's comms room (work order 8): under the Annex core, in its block */   /* carried to the 4F closet (work order 7): beside the new switch on both drawings */
  /* the access row in four (the fourth floor, work order 7), in the same width (a wider diagram would shrink every name on it):
     staggered, 1F and 3F up, 2F and 4F down, so no two names share a line; the desks on two rows under them */
  acc1: { x: 100, y: 410, lab: "right", px: 460, py: 280, room: "data" }, acc2: { x: 370, y: 470, lab: "right", px: 115, py: 455, room: "c2" }, acc3: { x: 630, y: 410, lab: "right", px: 115, py: 655, room: "c3" }, acc4: { x: 860, y: 470, lab: "right", px: 115, py: 855, room: "c4" },
  sd1: { x: 60, y: 590, px: 650, py: 120, room: "svc" }, hd1: { x: 150, y: 700, px: 880, py: 120, room: "svc" }, pr1: { x: 250, y: 590, px: 765, py: 250, room: "svc" },
  bn1: { x: 345, y: 700, px: 480, py: 455, room: "bench" }, bn2: { x: 440, y: 590, px: 740, py: 455, room: "bench" },
  mgr: { x: 545, y: 700, px: 440, py: 655, room: "office" }, fin: { x: 640, y: 590, px: 650, py: 655, room: "office" }, pr3: { x: 745, y: 700, px: 860, py: 655, room: "office" },
  tr1: { x: 815, y: 590, px: 540, py: 855, room: "train" }, tr2: { x: 960, y: 700, px: 780, py: 855, room: "train" },
  /* the Training Annex (work order 8): on the logical diagram a block of its own under the main building (the fibre between them drawn as
     a labelled stub at each end, as a diagram of two buildings shows it); on the floor plan its own band under the main building */
  anxc: { x: 120, y: 960, lab: "right", px: 115, py: 1065, room: "acomms" }, anxa: { x: 380, y: 1100, px: 265, py: 1065, room: "acomms" },
  cl1: { x: 620, y: 1020, px: 540, py: 1075, room: "class" }, cl2: { x: 840, y: 1100, px: 780, py: 1075, room: "class" }
};
export const CAMPUS_ROOM_BOX = { data: [30, 30, 560, 345], svc: [560, 30, 980, 345], c2: [30, 365, 260, 545], bench: [260, 365, 980, 545], c3: [30, 565, 260, 745], office: [260, 565, 980, 745], c4: [30, 765, 330, 945], train: [330, 765, 980, 945], acomms: [30, 985, 330, 1205], class: [330, 985, 980, 1205] };   /* the Annex's band, below the main building (work order 8) */
const swMac = function (hi, lo) { return "00e0.4c" + hi.toString(16).padStart(2, "0") + "." + lo.toString(16).padStart(4, "0"); };
const run = function (sw, lines) { const S = session(sw); ["", "enable", "configure terminal"].concat(lines, ["end", "copy running-config startup-config", ""]).forEach(function (l) { exec(S, l); }); return sw; };

/* every switch's name and locks, as Rafiki's HQ sets them up: the secret, the console password, SSH only with a local user */
const lockLines = function (plan, host) { return ["hostname " + host, "enable secret " + plan.secret, "line console 0", "password " + plan.console, "login", "exit", "ip domain-name " + plan.domain, "username " + plan.user + " secret " + plan.userPw, "crypto key generate rsa modulus 2048", "line vty 0 15", "login local", "transport input ssh", "exit"]; };

/* the core's routed links (work order 5 on), as the records give them: seven /30s in 10.b.255.0/24 after the edge router's link to
   distribution switch 1 (10.b.255.0/30, work order 4), the end nearer the provider on the first usable address. Each: the two
   ends (device and port, as the cable names it), the block, each end's address and its port's description */
export const CORE_LINKS = [["edge", "Gi0/2", "core1", "24"], ["edge", "Gi0/3", "core2", "24"], ["core1", "21", "core2", "21"], ["core1", "1", "dist1", "19"], ["core2", "1", "dist1", "20"], ["core1", "2", "dist2", "19"], ["core2", "2", "dist2", "20"]];
const CORE_DESC = { edge: "EDGE-ROUTER", core1: "CORE1", core2: "CORE2", dist1: "DIST1", dist2: "DIST2" };
export function coreLinks(plan) {
  const b = plan.vlans.svc.net.split(".")[1];
  return CORE_LINKS.map(function (L, i) { const n = 4 * (i + 1); return { id: "c-core-" + (i + 1), a: L[0], ap: L[1], b: L[2], bp: L[3], net: "10." + b + ".255." + n, cidr: "10." + b + ".255." + n + "/30", ia: "10." + b + ".255." + (n + 1), ib: "10." + b + ".255." + (n + 2), mask: "255.255.255.252", da: CORE_DESC[L[2]], db: CORE_DESC[L[0]] }; });
}
/* the installer's night (work order 5): both core switches racked in the data room, out of their boxes, named and locked, routing on,
   each routed port addressed and described from the records, the spares shut, saved; the links cabled (only those `cable` takes:
   work order 5 leaves distribution switch 2's two uncabled until it joins in work order 6). Nothing runs OSPF yet, and the edge
   router's and the distribution switches' ends are left for the technician */
export function installCore(net, cable) {
  const plan = net.plan, D = net.devices, L = coreLinks(plan);
  ["core1", "core2"].forEach(function (id) {
    const mine = L.filter(function (l) { return l.a === id || l.b === id; }), used = mine.map(function (l) { return +(l.a === id ? l.ap : l.bp); });
    const lines = lockLines(plan, plan.sw[id].host).concat(["ip routing"]);
    mine.forEach(function (l) { const me = l.a === id; lines.push("interface gi0/" + (me ? l.ap : l.bp), "description " + (me ? l.da : l.db), "no switchport", "ip address " + (me ? l.ia : l.ib) + " " + l.mask, "no shutdown", "exit"); });
    const spare = []; for (let k = 1; k <= 28; k++) if (used.indexOf(k) < 0) spare.push(k);
    lines.push("interface range " + spare.map(function (k) { return "gi0/" + k; }).join(" , "), "shutdown", "exit");
    run(D[id].sw, lines); delete D[id].boxed;
  });
  coreCables(net, cable);
  return L;
}
/* the core's links cabled (only those `cable` takes), each 2 m across the data room */
export function coreCables(net, cable) {
  coreLinks(net.plan).filter(cable || function () { return true; }).forEach(function (l) { if (!net.cables.some(function (c) { return c.id === l.id; })) net.cables.push({ id: l.id, kind: "cat6", a: { dev: l.a, port: l.ap, seated: true }, b: { dev: l.b, port: l.bp, seated: true }, cond: "good", length: 2 }); });
}

export function makeCampus(seed) {
  const r = rng(seed ^ 0x4c41), V = VLAN_SETS[r.int(0, VLAN_SETS.length - 1)], b = r.pick([16, 27, 38, 49, 63]), TV = TRAIN_V[VLAN_SETS.indexOf(V)];
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
    up: { acc1: "1", acc2: "2", acc3: "3", acc4: "4" }, distLinks: ["21", "22"], edgePort: "24",
    /* the fourth floor (work order 7): the training VLAN, the 4F access switch, its desks */
    train: { id: TV, name: "TRAINING", net: net24(TV), gw: ip(TV, 1) }, desks4: { "1": ["tr1", "train"], "2": ["tr2", "train"] }
  };
  /* the Training Annex (work order 8): a collapsed core, one layer 3 switch as core and distribution, an access switch for the classroom.
     The fibre from core switch 2's SFP1 to the Annex core's SFP1 is a routed link, the next /30 of the core's block after its seven;
     the Annex core is its classroom's gateway and its own management network's (on the first address of each) */
  const AV = ANNEX_V[VLAN_SETS.indexOf(V)], lk = "10." + b + ".255.";
  plan.annex = { cls: { id: AV.cls, name: "CLASSROOM", net: net24(AV.cls), gw: ip(AV.cls, 1) }, mgmt: { id: AV.mgmt, name: "ANNEX-MGMT", net: net24(AV.mgmt), gw: ip(AV.mgmt, 1) },
    core: { host: "RIT-ANX-CORE", ip: ip(AV.mgmt, 1) }, acc: { host: "RIT-ANX-ACC", ip: ip(AV.mgmt, 11) },
    link: { hq: "core2", hqPort: "SFP1", hqIf: "GigabitEthernet0/25", anxPort: "SFP1", anxIf: "GigabitEthernet0/25", net: lk + "32", hqIp: lk + "33", anxIp: lk + "34", mask: "255.255.255.252", hqDesc: "ANNEX-FIBRE", anxDesc: "HQ-CORE2" },
    up: { core: "1", acc: "24" }, desks: { "1": ["cl1", "cls"], "2": ["cl2", "cls"] } };
  plan.sw.acc4 = { host: "RIT-ACC-4F", ip: ip(V.mgmt, 14) };
  const all = Object.keys(V).filter(function (k) { return k !== "native" && k !== "parking"; }).map(function (k) { return V[k]; }).sort(function (x, y) { return x - y; });
  const vlanLines = Object.keys(V).flatMap(function (k) { return ["vlan " + V[k], "name " + NAMES[k], "exit"]; });
  const lock = function (host) { return lockLines(plan, host); };
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
    acc4: { id: "acc4", kind: "mswitch", label: "4F access switch", sub: "MSW-2800G", on: true, boxed: true, fixed: ["c4", "in the 4F closet, on its shelf"], mac: swMac(0x10, 0x0505), sw: newSwitch({ mac: swMac(0x10, 0x0505) }) },   /* in its box, from the factory (work order 7) */
    tech: { id: "tech", kind: "techlaptop", label: "Your laptop", sub: "console", on: true, os: "windows", user: "tech", host: "RAFIKI-TECH",
      ifaces: [{ name: "Ethernet", type: "eth", port: "ETH", mac: mac(rng(seed ^ 0x7ec4)), desc: "Ethernet Connection (USB-C dock)", cfg: { mode: "dhcp", dnsMode: "auto" }, lease: null, apipa: null }], tftp: { on: false, root: "C:\\TFTP-Root", files: [], log: [] } }
  };
  const r2 = rng(seed ^ 0x4f4f);   /* the training floor's PCs (work order 7): their own stream, so every other part of the campus is drawn as before */
  ["tr1", "tr2"].forEach(function (id, i) { dev[id] = { id: id, kind: "pc", label: "Training PC " + (i + 1), sub: "DHCP", on: true, boxed: true, os: "windows", user: i ? "trainee" : "trainer", host: "RIT-TRAINING-PC-" + (i + 1), ifaces: nic(r2) }; });
  const r3 = rng(seed ^ 0xa11e);   /* the Annex's classroom PCs (work order 8): their own stream too */
  dev.anxc = { id: "anxc", kind: "mswitch", label: "Annex core switch", sub: "MSW-3900X", on: true, boxed: true, fixed: ["acomms", "in the Annex's comms room, in its rack"], mac: swMac(0x60, 0x0001), sw: newSwitch({ l3: true, mac: swMac(0x60, 0x0001) }), sfp: { SFP1: null, SFP2: null, SFP3: null, SFP4: null } };
  dev.anxa = { id: "anxa", kind: "mswitch", label: "Annex access switch", sub: "MSW-2800G", on: true, boxed: true, fixed: ["acomms", "in the Annex's comms room, in its rack"], mac: swMac(0x10, 0x0606), sw: newSwitch({ mac: swMac(0x10, 0x0606) }) };
  ["cl1", "cl2"].forEach(function (id, i) { dev[id] = { id: id, kind: "pc", label: "Classroom PC " + (i + 1), sub: "DHCP", on: true, boxed: true, os: "windows", user: i ? "student" : "instructor", host: "RIT-CLASSROOM-PC-" + (i + 1), ifaces: nic(r3) }; });
  const cab = function (id, a, ap, b2, bp, len) { return { id: id, kind: "cat6", a: { dev: a, port: ap, seated: true }, b: { dev: b2, port: bp, seated: true }, cond: "good", length: len }; };
  const rooms = {}; Object.keys(CAMPUS_LAYOUT).forEach(function (id) { if (CAMPUS_LAYOUT[id].room) rooms[id] = CAMPUS_LAYOUT[id].room; });   /* the provider (on the logical diagram only) has no room */
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
    roomNames: { data: "Data room (1F)", svc: "Service desk (1F)", c2: "2F closet", bench: "Technicians' bench (2F)", c3: "3F closet", office: "Management (3F)", c4: "4F closet", train: "Training room (4F)", acomms: "Annex comms room", class: "Classroom (Annex)" }, floors: CAMPUS_FLOORS, runs: CAMPUS_RUN, fibre: CAMPUS_FIBRE,
    extra: { build: true }
  };
}
