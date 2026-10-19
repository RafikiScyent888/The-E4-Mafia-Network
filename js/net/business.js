/* The small business template (level 3): a client's shop or clinic with
   the provider's modem and router on the closet shelf, the managed switch in
   the closet rack (set up as the small office's was: named, locked, SSH only,
   its ports described, the spares shut), the reception PC, the manager's PC,
   the printer and a PC in the back of house, all on one flat network, and the
   new business router (BR-4200) in its box. The seed decides the business,
   its addresses and its records: the router's and switches' names and
   passwords, the VLANs it's moving to, the subnets and the DHCP pools. */
import { rng, mac } from "./util.js";
import { newSwitch, session, exec } from "./swcli.js";
import { newRouter } from "./rtcli.js";

/* each business: its name, its tag (in every hostname), its manager, where it is, what its rooms are called, and what
   its staff, its guests and its back of house are */
export const BUSINESSES = [
  { name: "Harbor Lane Vet Clinic", tag: "HL", manager: "Nadia", street: "12 Harbor Lane", counter: "Reception", guest: "Waiting room", back: "Treatment rooms", backPc: "Treatment room PC", pc: "Reception PC" },
  { name: "Bright Smile Dental", tag: "BSD", manager: "Owen", street: "48 Elm Street", counter: "Reception", guest: "Waiting room", back: "Surgery rooms", backPc: "Surgery PC", pc: "Reception PC" },
  { name: "Golden Crust Bakery Café", tag: "GC", manager: "Rosa", street: "3 Market Square", counter: "Front counter", guest: "Café seating", back: "Kitchen", backPc: "Kitchen PC", pc: "Till PC" },
  { name: "Eastside Physio Clinic", tag: "EP", manager: "Kofi", street: "77 East Road", counter: "Reception", guest: "Waiting room", back: "Treatment rooms", backPc: "Treatment room PC", pc: "Reception PC" },
  { name: "Spoke & Chain Bike Shop", tag: "SC", manager: "Mei", street: "9 Canal Street", counter: "Shop counter", guest: "Shop floor", back: "Workshop", backPc: "Workshop PC", pc: "Counter PC" },
  { name: "Chapter & Bean Bookshop Café", tag: "CB", manager: "Lars", street: "21 Library Row", counter: "Till", guest: "Café corner", back: "Stock room", backPc: "Stock room PC", pc: "Till PC" }
];
const PREFIXES = ["192.168.10", "192.168.30", "192.168.60", "172.16.40"];
const RANGES = [[100, 199], [50, 150], [120, 220], [60, 180]];
const SECRETS = ["Rack&Route7", "Closet!Key26", "Uplink#Bay9", "Trunk*Line42", "Vlan!Wall88", "Router&Rack5"];
const CONSOLES = ["Serial!Two4", "Console#88", "Blue*Cable3", "Line0!Con7", "Rollover#9", "Com3!Port5"];
const USERS = ["netadmin", "rafiki", "bizit", "tech"];
const USERPW = ["SSH-only*26", "Remote#Mgmt42", "Vty!Lines15", "Admin&Key9"];
/* the VLANs the business moves to, from its records: numbers differ business to business, names don't */
const VLAN_SETS = [
  { staff: 10, guest: 40, cameras: 60, mgmt: 99, native: 999, parking: 998, dept: 30, printers: 50 },
  { staff: 20, guest: 50, cameras: 70, mgmt: 90, native: 666, parking: 667, dept: 25, printers: 55 },
  { staff: 110, guest: 140, cameras: 160, mgmt: 199, native: 888, parking: 889, dept: 120, printers: 150 },
  { staff: 30, guest: 60, cameras: 80, mgmt: 100, native: 777, parking: 778, dept: 35, printers: 65 }
];

/* the rooms, for the floor plan, the Place form and the length of a run between two rooms (metres, as it really goes) */
export const BUSINESS_RUN = { closet: { counter: 16, office: 24, guest: 14, back: 30 }, counter: { office: 12, guest: 10, back: 20 }, office: { guest: 14, back: 12 }, guest: { back: 16 } };
export const BUSINESS_FIXED = { modem: ["closet", "on the closet shelf, where the provider's line comes in"], router: ["closet", "on the closet shelf, beside the modem"], mswitch: ["closet", "in the closet rack"], brouter: ["closet", "in the closet rack, above the switch"] };
/* where things sit: the logical diagram (x, y) and the floor plan (px, py) */
export const BUSINESS_LAYOUT = {
  isp: { x: 55, y: 80 },
  modem: { x: 236, y: 80, px: 120, py: 120, room: "closet" },
  router: { x: 420, y: 80, px: 120, py: 210, room: "closet", lab: "above" },
  rtr: { x: 420, y: 200, px: 230, py: 120, room: "closet", lab: "right" },
  msw: { x: 560, y: 300, px: 230, py: 210, room: "closet", lab: "right" },
  tech: { x: 760, y: 430, px: 120, py: 300, room: "closet" },
  pc: { x: 300, y: 440, px: 470, py: 140, room: "counter" },
  mgr: { x: 740, y: 170, px: 820, py: 150, room: "office", lab: "left" },
  printer: { x: 540, y: 450, px: 560, py: 200, room: "counter" },
  bpc: { x: 110, y: 440, px: 820, py: 400, room: "back" }
};
export const BUSINESS_ROOM_BOX = { closet: [30, 30, 300, 370], counter: [300, 30, 640, 270], office: [640, 30, 980, 270], guest: [300, 270, 660, 520], back: [660, 270, 980, 520] };

/* the managed switch as the business has it: set up as the small office's was, its records the business's */
function closetSwitch(r, plan, desc) {
  const sw = newSwitch({ mac: "00e0.4c" + [r.int(16, 255), r.int(0, 255), r.int(0, 255)].map(function (b) { return b.toString(16).padStart(2, "0"); }).join("").replace(/^(..)(....)$/, "$1.$2") });
  const S = session(sw);
  const lines = ["", "enable", "configure terminal", "hostname " + plan.swHost, "enable secret " + plan.swSecret, "line console 0", "password " + plan.swConsole, "login", "exit",
    "ip domain-name " + plan.domain, "username " + plan.user + " secret " + plan.userPw, "crypto key generate rsa modulus 2048", "line vty 0 15", "login local", "transport input ssh", "exit",
    "interface vlan 1", "ip address " + plan.swIp + " " + plan.mask, "no shutdown", "exit", "ip default-gateway " + plan.lanGw];
  Object.keys(desc).forEach(function (p) { lines.push("interface gi0/" + p, "description " + desc[p]); });
  lines.push("interface range gi0/5 - 23", "shutdown", "interface range gi0/25 - 28", "shutdown", "end", "copy running-config startup-config", "");
  lines.forEach(function (l) { exec(S, l); });
  return sw;
}

export function makeBusiness(seed) {
  const r = rng(seed ^ 0x3b17);
  const biz = r.pick(BUSINESSES), k = r.int(0, PREFIXES.length - 1), prefix = PREFIXES[k], range = RANGES[k], mask = "255.255.255.0", gw = prefix + ".1";
  const V = VLAN_SETS[r.int(0, VLAN_SETS.length - 1)], b = r.pick([12, 24, 31, 47, 58]);
  const sub = function (vlan) { return "10." + b + "." + vlan + ".0"; };   /* each VLAN's subnet from the records: 10.<site>.<vlan>.0/24, its gateway .1 */
  const domain = biz.name.split(/[ &]/)[0].toLowerCase().replace(/[^a-z]/g, "") + ".biz";
  const printerHost = r.pick([10, 11, 15, 20]);
  const plan = {
    /* the router (SB-J1) */
    rtHost: biz.tag + "-RTR1", rtSecret: r.pick(SECRETS), rtConsole: r.pick(CONSOLES), wanPort: "GigabitEthernet0/0", lanPort: "GigabitEthernet0/1",
    excl: [gw, prefix + ".20"], dns: ["203.0.113.53", "203.0.113.54"], pool: "LAN",
    /* the closet switch, as the business has it already */
    swHost: biz.tag + "-CLOSET-SW1", swSecret: r.pick(SECRETS), swConsole: r.pick(CONSOLES), swIp: prefix + ".2", user: r.pick(USERS), userPw: r.pick(USERPW),
    domain: domain, mask: mask, lanGw: gw, lan: prefix + ".0",
    /* the VLANs it moves to, one at a time */
    vlans: {
      staff: { id: V.staff, name: "STAFF", net: sub(V.staff), gw: "10." + b + "." + V.staff + ".1" },
      guest: { id: V.guest, name: "GUEST", net: sub(V.guest), gw: "10." + b + "." + V.guest + ".1" },
      cameras: { id: V.cameras, name: "CAMERAS", net: sub(V.cameras), gw: "10." + b + "." + V.cameras + ".1" },
      mgmt: { id: V.mgmt, name: "MGMT", net: sub(V.mgmt), gw: "10." + b + "." + V.mgmt + ".1" },
      native: { id: V.native, name: "NATIVE-UNUSED" }, parking: { id: V.parking, name: "PARKING" }
    },
    vmask: "255.255.255.0",
    /* the switch's port descriptions, by what's plugged in */
    desc: { "1": biz.pc.toUpperCase().replace(/[^A-Z0-9]+/g, "-"), "2": "MANAGER-PC", "3": "PRINTER", "4": biz.backPc.toUpperCase().replace(/[^A-Z0-9]+/g, "-"), "24": "UPLINK-ROUTER" }
  };
  const sw = closetSwitch(r, plan, plan.desc);
  const ifc = function (port, rr, cfg) { return [{ name: "Ethernet", type: "eth", port: port, mac: mac(rr), desc: "Gigabit Network Connection", cfg: cfg || { mode: "dhcp", dnsMode: "auto" }, lease: null, apipa: null }]; };
  const dev = {
    isp: { id: "isp", kind: "isp", label: "ISP", sub: "Internet" },
    wall: { id: "wall", kind: "wall", label: "Wall outlet", sub: "the provider's line" },
    modem: { id: "modem", kind: "modem", label: "Cable modem", sub: "the provider's", on: true, mgmt: "192.168.100.1", mac: mac(r) },
    /* the provider's router: the one the business has today, doing DHCP and NAT for its one flat network */
    router: {
      id: "router", kind: "router", label: "Provider's router", sub: gw, on: true, mac: mac(r), wanMac: mac(r),
      lan: { ip: gw, mask: mask },
      dhcp: { on: true, start: prefix + "." + range[0], end: prefix + "." + range[1], leaseH: 24, dnsMode: "router", dns: ["", ""], reservations: [] },
      wifi: { ssid: biz.tag + "-WIFI", sec: "WPA2-Personal", ch24mode: "manual", ch24: 1, ch5: 44, guest: false, gen: 2, off: true },
      admin: { gen: 2 }, forwards: [], leases: [], firmware: "3.0." + r.int(10, 60)
    },
    /* the new business router, in its box */
    rtr: { id: "rtr", kind: "brouter", label: "Business router", sub: "BR-4200", on: true, boxed: true, sw: newRouter({ mac: "00e0.4d" + [r.int(16, 255), r.int(0, 255), r.int(0, 255)].map(function (x) { return x.toString(16).padStart(2, "0"); }).join("").replace(/^(..)(....)$/, "$1.$2") }), sfp: { "Gi0/8": null, "Gi0/9": null } },
    msw: { id: "msw", kind: "mswitch", label: "Closet switch", sub: "MSW-2800G", on: true, mac: mac(r), sw: sw },
    pc: { id: "pc", kind: "pc", label: biz.pc, sub: "DHCP", on: true, os: "windows", user: "frontdesk", host: biz.tag + "-" + biz.pc.toUpperCase().replace(/[^A-Z0-9]+/g, "-"), printer: { name: "Printer", port: prefix + "." + printerHost }, ifaces: ifc("NIC", r) },
    mgr: { id: "mgr", kind: "pc", label: "Manager's PC", sub: "DHCP", on: true, os: "windows", user: biz.manager.toLowerCase(), host: biz.tag + "-MANAGER-PC", ifaces: ifc("NIC", r) },
    printer: { id: "printer", kind: "printer", label: "Printer", sub: prefix + "." + printerHost, on: true,
      ifaces: [{ name: "Wired", type: "eth", port: "NET", mac: mac(r), cfg: { mode: "static", ip: prefix + "." + printerHost, mask: mask, gw: gw, dns: [gw] }, lease: null, apipa: null }] },
    bpc: { id: "bpc", kind: "pc", label: biz.backPc, sub: "DHCP", on: true, os: "windows", user: "staff", host: biz.tag + "-" + biz.backPc.toUpperCase().replace(/[^A-Z0-9]+/g, "-"), ifaces: ifc("NIC", r) },
    tech: { id: "tech", kind: "techlaptop", label: "Your laptop", sub: "console", on: true, os: "windows", user: "tech", host: "RAFIKI-TECH",
      ifaces: [{ name: "Ethernet", type: "eth", port: "ETH", mac: mac(rng(seed ^ 0x7ec4)), desc: "Ethernet Connection (USB-C dock)", cfg: { mode: "dhcp", dnsMode: "auto" }, lease: null, apipa: null }],
      tftp: { on: false, root: "C:\\TFTP-Root", files: [], log: [] } }
  };
  const cab = function (id, a, ap, b2, bp, len) { return { id: id, kind: "cat6", a: { dev: a, port: ap, seated: true }, b: { dev: b2, port: bp, seated: true }, cond: "good", length: len }; };
  const cables = [
    { id: "c-coax", kind: "coax", a: { dev: "wall", port: "F", tight: true }, b: { dev: "modem", port: "CABLE IN", tight: true }, cond: "good" },
    cab("c-modem-router", "modem", "ETH", "router", "WAN", 1),
    cab("c-router-msw", "router", "LAN 1", "msw", "24", 1),
    cab("c-msw-pc", "msw", "1", "pc", "NIC", BUSINESS_RUN.closet.counter),
    cab("c-msw-mgr", "msw", "2", "mgr", "NIC", BUSINESS_RUN.closet.office),
    cab("c-msw-printer", "msw", "3", "printer", "NET", BUSINESS_RUN.closet.counter),
    cab("c-msw-bpc", "msw", "4", "bpc", "NIC", BUSINESS_RUN.closet.back)
  ];
  return {
    seed: seed, site: "business", client: { name: biz.name, street: biz.street, manager: biz.manager, tag: biz.tag }, prefix: prefix, mask: mask, range: range, plan: plan,
    isp: { up: true, outage: false, plan: 500, gw: "198.51.100.1", core: "203.0.113.1", dns: ["203.0.113.53", "203.0.113.54"], wanIp: "198.51.100." + r.int(20, 240), mask: "255.255.255.0" },
    devices: dev, cables: cables, neighbours: [], ports: {},
    rooms: { modem: "closet", router: "closet", rtr: "closet", msw: "closet", tech: "closet", pc: "counter", mgr: "office", printer: "counter", bpc: "back" },
    roomNames: { closet: "Network closet", counter: biz.counter, office: "Manager's office", guest: biz.guest, back: biz.back }, runs: BUSINESS_RUN, fixed: BUSINESS_FIXED,
    extra: { build: true }
  };
}
