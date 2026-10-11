/* The home template: a client's house with a cable modem, a home router,
   a 5-port switch in the office, and the usual devices. Every home ticket
   starts from this and changes what its fault needs. The seed decides the
   client, the addresses, the DHCP range, which switch port is which, and
   the neighbours' Wi-Fi, so two students rarely see the same house twice. */
import { rng, mac } from "./util.js";

export const CLIENTS = [
  { name: "Mrs. Hendricks", street: "14 Maple Street" },
  { name: "Mr. Okafor", street: "22 Maple Street" },
  { name: "Ms. Nguyen", street: "9 Maple Street" },
  { name: "Mr. Brennan", street: "31 Maple Street" },
  { name: "Mrs. Alvarez", street: "5 Maple Street" },
  { name: "Mr. Castillo", street: "18 Maple Street" },
  { name: "Ms. Whitfield", street: "27 Maple Street" },
  { name: "Mr. Danso", street: "40 Maple Street" }
];
const PREFIXES = ["192.168.1", "192.168.0", "192.168.50", "192.168.86"];
const RANGES = [[20, 200], [100, 199], [50, 250], [10, 150]];
const NEIGHBOUR_NAMES = ["Parker-Family", "Unit-12", "Garcia_WiFi", "HomeNet-7731", "Ochoa-2.4", "TheLodge", "Willow-House", "Corner-Flat"];

/* where things sit: the logical diagram (x, y) and the house floor plan (px, py, room) */
export const LAYOUT = {
  isp: { x: 55, y: 80 },
  modem: { x: 236, y: 80, px: 650, py: 110, room: "living" },
  router: { x: 400, y: 80, px: 560, py: 150, room: "living", lab: "above" },
  tv: { x: 600, y: 80, px: 680, py: 240, room: "living" },
  switch: { x: 400, y: 280, px: 250, py: 200, room: "office", lab: "left" },
  pc: { x: 200, y: 430, px: 110, py: 140, room: "office" },
  printer: { x: 400, y: 440, px: 360, py: 140, room: "office" },
  camera: { x: 580, y: 430, px: 720, py: 448, room: "porch" },
  mesh: { x: 610, y: 265, px: 850, py: 110, room: "upstairs", lab: "left" },
  phone: { x: 760, y: 250, px: 480, py: 245, room: "living" },
  laptop: { x: 755, y: 420, px: 905, py: 195, room: "upstairs" },
  guest: { x: 780, y: 130, px: 520, py: 360, room: "kitchen" },
  rogue: { px: 330, py: 235, room: "office" }   /* not on the logical diagram: nobody documented it */
};
export const ROOMS = { office: "Office", living: "Living room", kitchen: "Kitchen", garage: "Garage", upstairs: "Back bedroom (upstairs)", porch: "Front door" };

export function makeHome(seed) {
  const r = rng(seed);
  const client = r.pick(CLIENTS);
  const prefix = r.pick(PREFIXES);
  const range = r.pick(RANGES);
  const mask = "255.255.255.0";
  const gw = prefix + ".1";
  /* a static printer address outside the DHCP range, as a careful installer leaves it */
  const outside = [];
  for (let h = 2; h < 254; h++) if ((h < range[0] || h > range[1]) && h !== 1) outside.push(h);
  const printerHost = r.pick(outside.filter(function (h) { return h >= 2 && h <= 19 || h >= 201; }).length ? outside.filter(function (h) { return h >= 2 && h <= 19 || h >= 201; }) : outside);
  /* the camera has a DHCP reservation inside the range */
  const camHost = range[0] + r.int(5, 30);
  const ports = r.shuffle([2, 3, 4, 5]);
  const P = { pc: ports[0], printer: ports[1], camera: ports[2] };
  const ssid = client.name.replace(/^(Mrs?|Ms)\. /, "").toUpperCase() + "-HOME";

  const dev = {
    isp: { id: "isp", kind: "isp", label: "ISP", sub: "Internet" },
    wall: { id: "wall", kind: "wall", label: "Wall outlet", sub: "coax from the street" },
    modem: { id: "modem", kind: "modem", label: "Cable modem", sub: "DOCSIS 3.0", on: true, mgmt: "192.168.100.1", mac: mac(r) },
    router: {
      id: "router", kind: "router", label: "Home router", sub: gw, on: true, mac: mac(r), wanMac: mac(r),
      lan: { ip: gw, mask: mask },
      dhcp: { on: true, start: prefix + "." + range[0], end: prefix + "." + range[1], leaseH: 24, dnsMode: "router", dns: ["", ""], reservations: [] },
      wifi: { ssid: ssid, sec: "WPA2-Personal", ch24mode: "manual", ch24: 6, ch5: 36, guest: false },
      forwards: [],
      leases: [],
      firmware: "2.1." + r.int(10, 60)
    },
    switch: { id: "switch", kind: "switch", label: "5-port switch", sub: "unmanaged", on: true, ports: 5 },
    pc: { id: "pc", kind: "pc", label: "Office PC", sub: "DHCP", on: true, os: "windows", user: "front-desk", host: "OFFICE-PC", printer: { name: "Office printer", port: prefix + "." + printerHost },
      ifaces: [{ name: "Ethernet", type: "eth", port: "NIC", mac: mac(r), desc: "Gigabit Network Connection", cfg: { mode: "dhcp", dnsMode: "auto" }, lease: null, apipa: null }] },
    printer: { id: "printer", kind: "printer", label: "Printer", sub: prefix + "." + printerHost, on: true,
      ifaces: [{ name: "Wired", type: "eth", port: "NET", mac: mac(r), cfg: { mode: "static", ip: prefix + "." + printerHost, mask: mask, gw: gw, dns: [gw] }, lease: null, apipa: null }] },
    camera: { id: "camera", kind: "camera", label: "IP camera", sub: prefix + "." + camHost, on: true, listens: [443, 554],
      ifaces: [{ name: "LAN", type: "eth", port: "LAN", mac: mac(r), cfg: { mode: "dhcp" }, lease: null, apipa: null }] },
    tv: { id: "tv", kind: "tv", label: "Smart TV", sub: "DHCP", on: true,
      ifaces: [{ name: "Wired", type: "eth", port: "LAN", mac: mac(r), cfg: { mode: "dhcp" }, lease: null, apipa: null }] },
    mesh: { id: "mesh", kind: "mesh", label: "Mesh node", sub: "upstairs", on: true, backhaul: { band: 5, ok: true },
      ifaces: [{ name: "Bridge", type: "bridge", mac: mac(r), cfg: { mode: "dhcp" }, lease: null, apipa: null }] },
    phone: { id: "phone", kind: "phone", label: "Phone", sub: "Wi-Fi", on: true,
      ifaces: [{ name: "Wi-Fi", type: "wifi", mac: mac(r), bands: [24, 5], saved: { ssid: ssid, passOk: true }, cfg: { mode: "dhcp" }, lease: null, apipa: null }] },
    laptop: { id: "laptop", kind: "laptop", label: "Laptop", sub: "Wi-Fi", on: true, os: "windows", user: "owner", host: "LAPTOP",
      ifaces: [{ name: "Wi-Fi", type: "wifi", mac: mac(r), bands: [24, 5], desc: "Wireless-AC Network Adapter", saved: { ssid: ssid, passOk: true }, cfg: { mode: "dhcp", dnsMode: "auto" }, lease: null, apipa: null }] }
  };
  dev.router.dhcp.reservations.push({ name: "IP camera", mac: dev.camera.ifaces[0].mac, ip: prefix + "." + camHost });

  const cab = function (id, a, ap, b, bp, kind) { return { id: id, kind: kind || "cat6", a: { dev: a, port: ap, seated: true }, b: { dev: b, port: bp, seated: true }, cond: "good" }; };
  const cables = [
    { id: "c-coax", kind: "coax", a: { dev: "wall", port: "F", tight: true }, b: { dev: "modem", port: "CABLE IN", tight: true }, cond: "good" },
    cab("c-modem-router", "modem", "ETH", "router", "WAN"),
    cab("c-router-switch", "router", "LAN 1", "switch", "1"),
    cab("c-router-tv", "router", "LAN 2", "tv", "LAN"),
    cab("c-switch-pc", "switch", String(P.pc), "pc", "NIC"),
    cab("c-switch-printer", "switch", String(P.printer), "printer", "NET"),
    cab("c-switch-camera", "switch", String(P.camera), "camera", "LAN")
  ];

  /* the neighbours' Wi-Fi, as heard in each room: [channel, strength by room] */
  const names = r.shuffle(NEIGHBOUR_NAMES);
  const neighbours = [
    { ssid: names[0], ch: 1, band: 24, mac: mac(r), heard: { living: 30, office: 38, upstairs: 22, kitchen: 34, porch: 40 } },
    { ssid: names[1], ch: 11, band: 24, mac: mac(r), heard: { living: 26, office: 18, upstairs: 30, kitchen: 20, porch: 24 } },
    { ssid: names[2], ch: 44, band: 5, mac: mac(r), heard: { living: 20, office: 16, upstairs: 18, kitchen: 15, porch: 12 } }
  ];

  return {
    seed: seed, client: client, prefix: prefix, mask: mask, range: range,
    isp: { up: true, outage: false, plan: 500, gw: "198.51.100.1", core: "203.0.113.1", dns: ["203.0.113.53", "203.0.113.54"], wanIp: "198.51.100." + r.int(20, 240) },
    devices: dev, cables: cables, neighbours: neighbours, ports: P,
    rooms: { pc: "office", switch: "office", printer: "office", router: "living", modem: "living", tv: "living", phone: "living", camera: "porch", mesh: "upstairs", laptop: "upstairs" },
    extra: {}
  };
}
