/* The small office template (level 2): a client's office with the
   provider's modem and router on the closet shelf, the old unmanaged 8-port
   switch that runs the office today, the new managed switch still in its
   box, the front desk PC and the printer cabled back through the patch
   panel, and the technician's own laptop with its console cable. The seed
   decides the business, its addresses and its plans (the switch's name,
   management address and passwords, as the office's own records give
   them). */
import { rng, mac } from "./util.js";
import { newSwitch } from "./swcli.js";

export const BUSINESSES = [
  { name: "Bright Ledger Accounting", tag: "BL", manager: "Dana", street: "200 Harbor Road, Suite 4" },
  { name: "Harborview Dental", tag: "HV", manager: "Priya", street: "18 Quay Street" },
  { name: "Summit Insurance Brokers", tag: "SI", manager: "Marcus", street: "77 Ridge Avenue" },
  { name: "Cedar & Pine Architects", tag: "CP", manager: "Lena", street: "5 Mill Lane" },
  { name: "Northgate Physio", tag: "NG", manager: "Tomas", street: "41 North Gate" },
  { name: "Riverside Legal", tag: "RL", manager: "Grace", street: "9 River Walk" }
];
const PREFIXES = ["192.168.40", "192.168.20", "10.10.30", "172.16.12"];
const RANGES = [[100, 199], [50, 150], [120, 220], [60, 180]];
const SECRETS = ["Ledger2026!", "Closet-Key9", "Rack!Mount7", "Patch#Bay42", "Uplink*2026", "Fibre&Copper8"];
const CONSOLES = ["Closet42!", "Serial-Line7", "Console#26", "Cabinet!19", "Shelf*Two8", "BlueCable5"];
const USERS = ["netadmin", "tech", "officeit", "rafiki"];
const USERPW = ["Sw1tch-Admin!", "Remote#Mgmt42", "SSH-only*26", "Vty!Lines15"];

/* the rooms, for the floor plan, the Place form and the length of a run between two rooms (metres, as it really goes) */
export const OFFICE_ROOMS = { closet: "Network closet", front: "Front desk", open: "Open-plan office", manager: "Manager's office", meeting: "Meeting room" };
export const OFFICE_RUN = { closet: { front: 18, open: 12, manager: 22, meeting: 26 }, front: { open: 10, manager: 16, meeting: 14 }, open: { manager: 9, meeting: 12 }, manager: { meeting: 10 } };
/* where some things have to go */
export const OFFICE_FIXED = { modem: ["closet", "on the closet shelf, where the provider's line comes in"], router: ["closet", "on the closet shelf, beside the modem"], mswitch: ["closet", "in the closet rack, under the patch panel"] };
/* where things sit: the logical diagram (x, y) and the office floor plan (px, py) */
export const OFFICE_LAYOUT = {
  isp: { x: 55, y: 80 },
  modem: { x: 236, y: 80, px: 120, py: 120, room: "closet" },
  router: { x: 420, y: 80, px: 120, py: 210, room: "closet", lab: "above" },
  switch: { x: 230, y: 280, px: 230, py: 210, room: "closet", lab: "left" },
  msw: { x: 560, y: 280, px: 230, py: 120, room: "closet", lab: "right" },
  tech: { x: 760, y: 280, px: 120, py: 300, room: "closet", lab: "left" },
  pc: { x: 300, y: 440, px: 470, py: 140, room: "front" },
  printer: { x: 540, y: 440, px: 520, py: 400, room: "open" }
};
export const OFFICE_ROOM_BOX = { closet: [30, 30, 300, 370], front: [300, 30, 640, 270], open: [300, 270, 760, 520], manager: [640, 30, 980, 270], meeting: [760, 270, 980, 520] };

export function makeOffice(seed) {
  const r = rng(seed ^ 0x5a17);
  const biz = r.pick(BUSINESSES), k = r.int(0, PREFIXES.length - 1), prefix = PREFIXES[k], range = RANGES[k], mask = "255.255.255.0", gw = prefix + ".1";
  const swHost = r.pick([2, 3, 5, 250, 252]), printerHost = r.pick([10, 11, 20, 21, 30]);
  const plan = {
    hostname: biz.tag + "-CLOSET-SW1", ip: prefix + "." + swHost, mask: mask, gw: gw, domain: biz.name.split(/[ &]/)[0].toLowerCase().replace(/[^a-z]/g, "") + ".lan",
    secret: r.pick(SECRETS), console: r.pick(CONSOLES), user: r.pick(USERS), userPw: r.pick(USERPW)
  };
  const dev = {
    isp: { id: "isp", kind: "isp", label: "ISP", sub: "Internet" },
    wall: { id: "wall", kind: "wall", label: "Wall outlet", sub: "the provider's line" },
    modem: { id: "modem", kind: "modem", label: "Cable modem", sub: "the provider's", on: true, mgmt: "192.168.100.1", mac: mac(r) },
    router: {
      id: "router", kind: "router", label: "Office router", sub: gw, on: true, mac: mac(r), wanMac: mac(r),
      lan: { ip: gw, mask: mask },
      dhcp: { on: true, start: prefix + "." + range[0], end: prefix + "." + range[1], leaseH: 24, dnsMode: "router", dns: ["", ""], reservations: [] },
      wifi: { ssid: biz.tag + "-OFFICE", sec: "WPA2-Personal", ch24mode: "manual", ch24: 1, ch5: 44, guest: false, gen: 2 },
      admin: { gen: 2 }, forwards: [], leases: [], firmware: "3.0." + r.int(10, 60)
    },
    switch: { id: "switch", kind: "switch", label: "Old 8-port switch", sub: "unmanaged", on: true, ports: 8 },
    msw: { id: "msw", kind: "mswitch", label: "Managed switch", sub: "MSW-2800G", on: true, boxed: true, mac: mac(r), sw: newSwitch() },
    pc: { id: "pc", kind: "pc", label: "Front desk PC", sub: "DHCP", on: true, os: "windows", user: "frontdesk", host: "FRONTDESK-PC", printer: { name: "Office printer", port: prefix + "." + printerHost },
      ifaces: [{ name: "Ethernet", type: "eth", port: "NIC", mac: mac(r), desc: "Gigabit Network Connection", cfg: { mode: "dhcp", dnsMode: "auto" }, lease: null, apipa: null }] },
    printer: { id: "printer", kind: "printer", label: "Office printer", sub: prefix + "." + printerHost, on: true,
      ifaces: [{ name: "Wired", type: "eth", port: "NET", mac: mac(r), cfg: { mode: "static", ip: prefix + "." + printerHost, mask: mask, gw: gw, dns: [gw] }, lease: null, apipa: null }] },
    tech: { id: "tech", kind: "techlaptop", label: "Your laptop", sub: "console", on: true, os: "windows", user: "tech", host: "RAFIKI-TECH" }
  };
  const cab = function (id, a, ap, b, bp, len) { return { id: id, kind: "cat6", a: { dev: a, port: ap, seated: true }, b: { dev: b, port: bp, seated: true }, cond: "good", length: len }; };
  const cables = [
    { id: "c-coax", kind: "coax", a: { dev: "wall", port: "F", tight: true }, b: { dev: "modem", port: "CABLE IN", tight: true }, cond: "good" },
    cab("c-modem-router", "modem", "ETH", "router", "WAN", 1),
    cab("c-router-old", "router", "LAN 1", "switch", "1", 1),
    cab("c-old-pc", "switch", "2", "pc", "NIC", OFFICE_RUN.closet.front),
    cab("c-old-printer", "switch", "3", "printer", "NET", OFFICE_RUN.closet.open)
  ];
  return {
    seed: seed, site: "office", client: { name: biz.name, street: biz.street, manager: biz.manager, tag: biz.tag }, prefix: prefix, mask: mask, range: range, plan: plan,
    isp: { up: true, outage: false, plan: 500, gw: "198.51.100.1", core: "203.0.113.1", dns: ["203.0.113.53", "203.0.113.54"], wanIp: "198.51.100." + r.int(20, 240) },
    devices: dev, cables: cables, neighbours: [], ports: {},
    rooms: { modem: "closet", router: "closet", switch: "closet", msw: "closet", tech: "closet", pc: "front", printer: "open" },
    roomNames: OFFICE_ROOMS, runs: OFFICE_RUN, fixed: OFFICE_FIXED,
    extra: { build: true }
  };
}
