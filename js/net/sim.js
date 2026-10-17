/* The simulation: given the state of the cables, the settings and the
   leases, it works out what really happens. Commands and device pages only
   ever ask it; nothing is canned. So a fault shows up wherever it really
   would, and a fix works only if it fixes the real cause.
   Every change goes through apply(), so a ticket can be replayed exactly
   (progress is saved as the list of actions). */
import { rng, hash, ip2n, n2ip, sameSubnet, isIp, isApipa, isPublic, isPrivate, isLoopback, broadcast, network, maskBits } from "./util.js";
import { reload as reloadSwitch } from "./swcli.js";

/* each radio has its own hardware address: the 5 GHz one is the next number up */
function bump(m) { const p = m.split("-"); p[5] = ((parseInt(p[5], 16) + 1) & 255).toString(16).padStart(2, "0"); return p.join("-"); }
const DNS_PUBLIC = ["8.8.8.8", "8.8.4.4", "1.1.1.1", "1.0.0.1", "9.9.9.9"];
export const SECURITY = ["WPA2-Personal", "WPA2/WPA3-Personal", "WPA3-Personal"];
export const SITES = { "rafiki-it.example": "203.0.113.80", "www.rafiki-it.example": "203.0.113.80", "www.example.com": "203.0.113.81", "example.com": "203.0.113.81", "learn.example.org": "203.0.113.82" };

/* Wi-Fi signal (percent) from an access point's room to a client's room, by band */
const SIGNAL = {
  living: { living: [95, 90], kitchen: [80, 68], office: [70, 52], garage: [55, 34], porch: [62, 42], upstairs: [44, 24], landing: [72, 56] },
  upstairs: { upstairs: [86, 78], living: [50, 36], office: [42, 28], kitchen: [40, 26], garage: [30, 14], porch: [34, 18], landing: [80, 70] },
  /* an access point in any other room (build mode puts the router, or a mesh node, where the student chooses) */
  office: { office: [95, 90], living: [70, 52], kitchen: [58, 40], garage: [72, 56], porch: [50, 30], upstairs: [38, 20], landing: [50, 34] },
  kitchen: { kitchen: [95, 90], living: [80, 68], office: [58, 40], garage: [62, 44], porch: [70, 52], upstairs: [40, 22], landing: [55, 38] },
  garage: { garage: [95, 90], office: [72, 56], kitchen: [62, 44], living: [55, 34], porch: [45, 26], upstairs: [28, 12], landing: [35, 18] },
  porch: { porch: [95, 90], living: [62, 42], kitchen: [70, 52], office: [50, 30], garage: [45, 26], upstairs: [30, 14], landing: [40, 22] },
  /* the landing at the top of the stairs: one floor up, one door from the back bedroom */
  landing: { landing: [95, 90], upstairs: [88, 80], living: [72, 56], office: [50, 34], kitchen: [55, 38], garage: [35, 18], porch: [40, 22] }
};

/* build mode: the ports each kind of device has (the sim's names), where some devices have to go,
   and how long a cable run is between two rooms of the house, in metres, as it really goes (walls, ceilings) */
export const PORTS = { router: ["WAN", "LAN 1", "LAN 2", "LAN 3", "LAN 4"], switch: ["1", "2", "3", "4", "5"], modem: ["ETH"], pc: ["NIC"], printer: ["NET"], camera: ["LAN"], tv: ["LAN"], injector: ["DATA IN", "PoE OUT"], mesh: ["WAN", "LAN"] };
/* what a PoE injector can send down the cable: at the injector, and what reaches the device after the cable's loss (IEEE 802.3af and 802.3at) */
export const POE = { af: { pse: 15.4, pd: 12.95 }, at: { pse: 30, pd: 25.5 } };
export const PORT_NAME = { WAN: "INTERNET (WAN)", ETH: "ETHERNET", NIC: "Ethernet", NET: "NETWORK", LAN: "LAN", "PoE OUT": "DATA + POWER OUT" };
/* an injector's ports in pairs: each DATA + POWER OUT carries on the link from its own DATA IN, and nothing else.
   The dual-port PoE+ injector (build mode's injector2) has two pairs, kept apart as on the real thing */
export const POE_PAIR = { "PoE OUT": "DATA IN", "DATA IN": "PoE OUT", "PoE OUT 2": "DATA IN 2", "DATA IN 2": "PoE OUT 2" };
export const DUAL_PORTS = ["DATA IN", "DATA IN 2", "PoE OUT", "PoE OUT 2"];
const DUAL_NAME = { "DATA IN": "DATA IN 1", "DATA IN 2": "DATA IN 2", "PoE OUT": "DATA + POWER OUT 1", "PoE OUT 2": "DATA + POWER OUT 2" };
/* the name printed by a port on the device itself: what the student reads on the model and in every list */
export function portName(x, port) { return (x && x.dual && DUAL_NAME[port]) || (x && x.kind === "techlaptop" && port === "USB-C" ? "USB-C (its USB serial adapter)" : null) || PORT_NAME[port] || port; }
/* the managed switch's copper ports and its console port (its SFP slots take a fibre module: level 2's later jobs) */
export const MSW_PORTS = Array.from({ length: 24 }, function (_, i) { return String(i + 1); }).concat(["CONSOLE"]);
export function portsOf(x) {
  if (!x) return [];
  if (x.dual) return DUAL_PORTS;
  if (x.kind === "switch" && x.ports) return Array.from({ length: x.ports }, function (_, i) { return String(i + 1); });   /* the office's old switch has 8 */
  if (x.kind === "mswitch") return MSW_PORTS;
  if (x.kind === "techlaptop") return ["USB-C", "ETH"];   /* the USB serial adapter for the console cable, and its own Ethernet port */
  return PORTS[x.kind] || [];
}
/* a console cable: your laptop's USB serial adapter to a switch's CONSOLE port */
const consoleEnd = function (x, port) { return !!x && ((x.kind === "mswitch" && port === "CONSOLE") || (x.kind === "techlaptop" && port === "USB-C")); };
export const FIXED_ROOM = { modem: ["living", "by the cable outlet: there's one, in the living room"], camera: ["porch", "on its mount by the front door"] };
const RUN = { office: { living: 14, kitchen: 18, garage: 12, porch: 38, upstairs: 20, landing: 18 }, living: { kitchen: 10, garage: 22, porch: 20, upstairs: 15, landing: 8 }, kitchen: { garage: 16, porch: 14, upstairs: 22, landing: 14 }, garage: { porch: 30, upstairs: 28, landing: 24 }, porch: { upstairs: 32, landing: 22 }, upstairs: { landing: 6 } };
export function runLength(a, b, net) { if (a === b) return 3; const T = (net && net.runs) || RUN; return (T[a] && T[a][b]) || (T[b] && T[b][a]) || 40; }   /* net: the office has its own rooms and runs */
export const COPPER_MAX = 100;

export class Sim {
  constructor(net) {
    this.net = net; this.d = net.devices; this.n = 0; this.log = []; this.lastTrace = null; this.arp = {};
    for (const id in this.d) this.arp[id] = {};
  }

  /* ------------------------------------------------------------ cables and power */
  cable(id) { return this.net.cables.find(function (c) { return c.id === id; }); }
  cableAt(dev, port) { return this.net.cables.find(function (c) { return (c.a.dev === dev && c.a.port === port) || (c.b.dev === dev && c.b.port === port); }); }
  cablesOf(dev) { return this.net.cables.filter(function (c) { return c.a.dev === dev || c.b.dev === dev; }); }
  on(id) { const x = this.d[id]; if (!x || x.on === false || x.boxed) return false; return x.poe ? this.poePowered(id) : true; }   /* boxed: still in its box (build mode), not set up */
  /* the injector a PoE device's cable comes from (its PoE OUT, both plugs in, the pairs intact), or null */
  poeSource(id) {
    const c = this.cablesOf(id)[0]; if (!c || c.kind === "coax") return null;
    const me = c.a.dev === id ? c.a : c.b, far = c.a.dev === id ? c.b : c.a, inj = this.d[far.dev];
    if (!me.seated || !far.seated || c.cond === "crushed") return null;
    return inj && inj.kind === "injector" && /^PoE OUT/.test(far.port) ? inj : null;
  }
  /* a PoE device is on only while power comes down its cable: the injector plugged in, and a kind of PoE the device
     can use (802.3af or 802.3at: 48 V after a handshake; passive 24 V won't do) */
  poePowered(id) { const inj = this.poeSource(id); return !!inj && !!inj.power && !!POE[inj.std]; }
  /* powered, but by less than it can draw: it starts, in a reduced mode (an 802.3at camera on 802.3af: no heater, no night vision) */
  poeShort(id) { const inj = this.poeSource(id); return this.poePowered(id) && POE[inj.std].pd < (this.d[id].draw || 6.5); }
  cableUp(c) {
    if (!c) return false;
    if (c.kind === "coax") return c.a.tight && c.b.tight && c.cond === "good";
    if (c.kind === "console") return c.a.seated && c.b.seated && this.on(c.a.dev) && this.on(c.b.dev);   /* serial, not Ethernet: "up" means the console answers */
    if (c.length > COPPER_MAX) return false;                /* past 100 m the signal has faded too far for Ethernet to hold a link */
    if (!c.a.seated || !c.b.seated) return false;
    if (c.cond === "crushed") return false;                 /* pairs 1-2 or 3-6 open: no link at all */
    for (const e of [c.a, c.b]) {   /* a managed switch's port: shut down, or a fixed speed the far end can't match, and there's no link */
      const x = this.d[e.dev]; if (!x || x.kind !== "mswitch") continue;
      const p = x.sw.ports["GigabitEthernet0/" + e.port]; if (!p || p.shutdown) return false;
      const fs = this.speedSetting(e === c.a ? c.b : c.a); if (p.speed !== "auto" && fs !== "auto" && p.speed !== fs) return false;
    }
    const ij = [c.a, c.b].find(function (e) { return this.d[e.dev] && this.d[e.dev].kind === "injector"; }, this);
    if (ij) {  /* an injector passes the data pairs straight through: the link is end to end */
      const o = this.cableAt(ij.dev, POE_PAIR[ij.port]);   /* the cable in the same pair's other port */
      if (!o || o === c || !o.a.seated || !o.b.seated || o.cond === "crushed") return false;
      return [c.a, c.b, o.a, o.b].filter(function (e) { return e.dev !== ij.dev; }).every(function (e) { return this.on(e.dev); }, this);
    }
    return this.on(c.a.dev) && this.on(c.b.dev);
  }
  speed(c) {   /* gigabit needs all four pairs; 100 Mb/s needs only 1-2 and 3-6; a speed fixed at either end is what the link runs at */
    if (!this.cableUp(c)) return 0;
    let sp = c.cond === "damaged" ? 100 : 1000;
    if (c.kind === "cat6") [c.a, c.b].forEach(function (e) { const f = this.speedSetting(e); if (f !== "auto") sp = Math.min(sp, +f); }, this);
    return sp;
  }
  /* what speed an end of a cable is set to: a managed switch port's setting, a computer's adapter's, or auto */
  speedSetting(e) {
    const x = this.d[e.dev]; if (!x) return "auto";
    if (x.kind === "mswitch") { const p = x.sw.ports["GigabitEthernet0/" + e.port]; return p ? p.speed : "auto"; }
    return (x.ifaces && x.ifaces[0].cfg.speed) || "auto";
  }
  /* the managed switch's view of its own links, for its show commands: refreshed from the cables before it's asked */
  syncSwitch(id) {
    const x = this.d[id]; if (!x || x.kind !== "mswitch") return null;
    x.sw.links = this.switchLinks(id); x.sw.uptime = (2 + this.n) + " minutes";
    return x.sw;
  }
  /* what each of a managed switch's ports sees at the far end of its cable, worked out without changing anything
     (a check must never change the network: a saved job has to replay exactly) */
  switchLinks(id) {
    const x = this.d[id]; if (!x || x.kind !== "mswitch") return {};
    const L = {};
    for (const c of this.cablesOf(id)) {
      if (c.kind !== "cat6") continue;
      const me = c.a.dev === id ? c.a : c.b, far = c.a.dev === id ? c.b : c.a, fd = this.d[far.dev];
      if (!/^\d+$/.test(me.port) || !me.seated || !far.seated || c.cond === "crushed" || (c.length || 0) > COPPER_MAX || !this.on(far.dev)) continue;
      const m = (fd.kind === "router" || fd.kind === "rogue" ? fd.mac : fd.ifaces ? fd.ifaces[0].mac : "02-00-5e-" + (hash(far.dev) >>> 0).toString(16).padStart(8, "0").slice(0, 6).replace(/(..)(..)(..)/, "$1-$2-$3")).replace(/-/g, "");
      L["GigabitEthernet0/" + me.port] = { mac: m.slice(0, 4) + "." + m.slice(4, 8) + "." + m.slice(8, 12), speed: this.speedSetting(far), duplex: (fd.ifaces && fd.ifaces[0].cfg.duplex) || "auto", max: c.cond === "damaged" ? 100 : 1000, counters: c.counters || null, tick: this.n };
    }
    return L;
  }

  /* ------------------------------------------------------------ the provider and the modem */
  modemSynced() {
    const m = this.d.modem, c = this.cable("c-coax");
    return this.on("modem") && this.cableUp(c) && this.net.isp.up && !this.net.isp.outage;
  }
  modemLights() {
    const on = this.on("modem"), c = this.cable("c-coax"), sig = on && this.cableUp(c) && this.net.isp.up;
    const synced = this.modemSynced();
    return {
      POWER: on ? "on" : "off",
      DS: !on ? "off" : sig ? "on" : "blinking",
      US: !on ? "off" : synced ? "on" : sig ? "blinking" : "off",
      ONLINE: !on ? "off" : synced ? "on" : "off",
      LINK: !on ? "off" : this.cableUp(this.cableAt("modem", "ETH")) ? "on" : "off"
    };
  }
  /* the cable from the modem's ETHERNET to the router's INTERNET (WAN) port, whatever it's called; into a LAN port it isn't one */
  wanCable() { const c = this.cableAt("modem", "ETH"); return c && ((c.a.dev === "router" && c.a.port === "WAN") || (c.b.dev === "router" && c.b.port === "WAN")) ? c : null; }
  wanUp() { return this.on("router") && this.cableUp(this.wanCable()) && this.modemSynced(); }
  wan() { return this.wanUp() ? { ip: this.net.isp.wanIp, mask: "255.255.255.0", gw: this.net.isp.gw, dns: this.net.isp.dns.slice() } : null; }

  /* ------------------------------------------------------------ Wi-Fi */
  aps() {
    const out = [], r = this.d.router;
    if (this.on("router")) {
      out.push({ id: "router", node: "router:lan", room: this.net.rooms.router, band: 24, ch: this.ch24(), ssid: r.wifi.ssid, mac: r.mac, sec: r.wifi.sec });
      out.push({ id: "router", node: "router:lan", room: this.net.rooms.router, band: 5, ch: r.wifi.ch5, ssid: r.wifi.ssid, mac: bump(r.mac), sec: r.wifi.sec });
      if (this.guestOn()) {   /* the guest network: its own name and password on the same radios, its own subnet behind them */
        const g = r.guest, gm = bump(bump(r.mac));
        out.push({ id: "router", node: "router:guest", room: this.net.rooms.router, band: 24, ch: this.ch24(), ssid: g.ssid, mac: gm, sec: g.sec, gen: g.gen, guest: true });
        out.push({ id: "router", node: "router:guest", room: this.net.rooms.router, band: 5, ch: r.wifi.ch5, ssid: g.ssid, mac: bump(gm), sec: g.sec, gen: g.gen, guest: true });
      }
    }
    /* a hotspot outside the house broadcasting the house's own network name, open (HOME-15) */
    const tw = this.d.twin;
    if (tw && this.on("twin")) out.push({ id: "twin", node: "twin:lan", band: 24, ch: tw.ch, ssid: tw.ssid, mac: tw.mac, sec: "Open", heard: tw.heard });
    const m = this.d.mesh;
    if (m && this.meshLink().ok) {   /* wired or wireless back to the router, it broadcasts the house's Wi-Fi */
      out.push({ id: "mesh", node: "mesh", room: this.net.rooms.mesh, band: 24, ch: this.ch24(), ssid: r.wifi.ssid, mac: m.ifaces[0].mac, sec: r.wifi.sec });
      out.push({ id: "mesh", node: "mesh", room: this.net.rooms.mesh, band: 5, ch: 149, ssid: r.wifi.ssid, mac: bump(m.ifaces[0].mac), sec: r.wifi.sec });
    }
    return out;
  }
  /* the mesh node's link back to the router. The tickets set it; in a build house it's worked out from where the node is:
     a cable from its WAN or LAN port that leads to the router's house side, or else the 5 GHz signal between the two rooms
     (40% or more holds a backhaul) */
  meshLink() {
    const m = this.d.mesh; if (!m || !this.on("mesh") || !this.on("router")) return { ok: false, kind: null };
    if (!this.net.extra.build) return { ok: !!m.backhaul.ok, kind: "wifi", signal: m.backhaul.ok ? 74 : 0 };
    if (this.cablesOf("mesh").some(function (c) { return this.cableUp(c); }, this) && this.wiredTo("mesh", "router:lan")) return { ok: true, kind: "wired" };
    const s = this.signal(this.net.rooms.router, this.net.rooms.mesh, 5);
    return { ok: s >= 40, kind: "wifi", signal: s };
  }
  /* is a node joined to another over working cables alone (no Wi-Fi)? */
  wiredTo(from, to) {
    const e = [];
    for (const c of this.net.cables) if (c.kind !== "coax" && this.cableUp(c)) e.push([this.nodeOf(c.a.dev, c.a.port), this.nodeOf(c.b.dev, c.b.port)]);
    const seen = new Set([from]), q = [from];
    while (q.length) { const v = q.shift(); for (const [a, b] of e) { const w = a === v ? b : b === v ? a : null; if (w && !seen.has(w)) { seen.add(w); q.push(w); } } }
    return seen.has(to);
  }
  ch24() { const w = this.d.router.wifi; return w.ch24mode === "auto" ? this.bestChannel(this.net.rooms.router) : w.ch24; }
  /* what Auto picks: the non-overlapping channel with the least heard around the router */
  bestChannel(room) {
    let best = 1, bestP = Infinity;
    for (const c of [1, 6, 11]) { const p = this.crowd(c, room); if (p < bestP - 0.001) { best = c; bestP = p; } }
    return best;
  }
  /* how crowded a 2.4 GHz channel is in a room: neighbours within 4 channels overlap, the nearer the worse */
  crowd(ch, room) {
    let p = 0;
    for (const nb of this.net.neighbours) {
      if (nb.band !== 24) continue;
      const gap = Math.abs(nb.ch - ch); if (gap > 4) continue;
      const s = (nb.heard[room] || 0) / 100;
      p += s * (gap === 0 ? 1 : (5 - gap) / 5);
    }
    return p;
  }
  /* Wi-Fi security: a device joins only a network whose security its adapter supports. Transition mode
     (WPA2/WPA3) takes either: WPA3 from the devices that can, WPA2 from the ones that can't */
  canSec(f, sec) { const can = f.secs || ["WPA2-Personal", "WPA3-Personal"]; if (sec === "Open") return true; return sec === "WPA2/WPA3-Personal" ? can.indexOf("WPA2-Personal") >= 0 || can.indexOf("WPA3-Personal") >= 0 : can.indexOf(sec) >= 0; }
  usesSec(f, sec) { const can = f.secs || ["WPA2-Personal", "WPA3-Personal"]; return sec === "WPA2/WPA3-Personal" ? (can.indexOf("WPA3-Personal") >= 0 ? "WPA3-Personal" : "WPA2-Personal") : sec; }
  heardAt(ap, room) { return ap.heard ? (ap.heard[room] || 0) : this.signal(ap.room, room, ap.band); }
  signal(apRoom, room, band) { const t = SIGNAL[apRoom]; if (!t || !t[room]) return 0; return t[room][band === 24 ? 0 : 1]; }
  /* a Wi-Fi client's link: which access point, band and channel, how strong, and how lossy */
  wifiLink(id) {
    const x = this.d[id]; if (!x || !x.ifaces || !this.on(id)) return null;
    const f = x.ifaces.find(function (i) { return i.type === "wifi"; }); if (!f) return null;
    const room = this.net.rooms[id];
    let best = null;
    for (const ap of this.aps()) {
      if (!f.saved.ssid || ap.ssid !== f.saved.ssid) continue;
      if ((ap.sec === "Open") !== (f.saved.sec === "Open")) continue;   /* a saved profile is for one kind of network: open, or secured */
      if (f.bands.indexOf(ap.band) < 0) continue;
      const s = this.heardAt(ap, room);
      if (s < 20) continue;
      const score = s + (ap.band === 5 ? 10 : 0);           /* band steering: prefers 5 GHz when it is strong enough */
      if (ap.band === 5 && s < 45) continue;
      if (!best || score > best.score) best = { ap: ap, signal: s, score: score };
    }
    if (!best) return { connected: false, reason: "no-network", room: room };
    if (!this.canSec(f, best.ap.sec)) return { connected: false, reason: "security", ap: best.ap, signal: best.signal, room: room };
    if (best.ap.sec !== "Open" && (!f.saved.passOk || (f.saved.gen || 1) !== (best.ap.gen || this.d.router.wifi.gen || 1))) return { connected: false, reason: "auth", ap: best.ap, signal: best.signal, room: room };   /* the password it has saved isn't the network's (any more) */
    const crowd = best.ap.band === 24 ? this.crowd(best.ap.ch, room) : 0;
    const weak = best.signal < 35 ? (35 - best.signal) / 60 : 0;
    const loss = Math.min(0.6, Math.max(0, (crowd - 0.35) * 0.55) + weak);
    const rate = best.ap.band === 5 ? (best.signal > 70 ? 866.7 : 400) : (loss > 0.1 ? 26 : best.signal > 60 ? 144.4 : 72.2);
    return { connected: true, ap: best.ap, band: best.ap.band, ch: best.ap.ch, signal: best.signal, loss: loss, crowd: crowd, rate: rate, room: room, sec: this.usesSec(f, best.ap.sec) };
  }

  /* ------------------------------------------------------------ layer 2: who can hear whom */
  nodeOf(dev, port) {
    const k = this.d[dev] && this.d[dev].kind;
    if (k === "router" || k === "rogue") return port === "WAN" ? dev + ":wan" : dev + ":lan";
    if (k === "injector" && / 2$/.test(port)) return dev + ":2";   /* a dual injector's second pair: a path of its own, never bridged to the first */
    return dev;
  }
  /* bridging devices pass frames between everything joined to them */
  edges() {
    const e = [];
    for (const c of this.net.cables) {
      if (c.kind === "coax" || c.kind === "console" || !this.cableUp(c)) continue;
      e.push([this.nodeOf(c.a.dev, c.a.port), this.nodeOf(c.b.dev, c.b.port)]);
    }
    const m = this.d.mesh;
    if (m && this.meshLink().ok && this.meshLink().kind === "wifi") e.push(["mesh", "router:lan"]);   /* a wired link is a cable: it's in the edges already */
    for (const id in this.d) { const l = this.wifiLink(id); if (l && l.connected) e.push([id, l.ap.node]); }
    return e;
  }
  domain(node) {
    const e = this.edges(), seen = new Set([node]), q = [node];
    while (q.length) { const v = q.shift(); for (const [a, b] of e) { const w = a === v ? b : b === v ? a : null; if (w && !seen.has(w)) { seen.add(w); q.push(w); } } }
    return seen;
  }
  /* the node a device's network interface sits on */
  homeNode(id) { return this.nodeOf(id, "LAN"); }
  hasLink(id) {
    const x = this.d[id]; if (!x || !this.on(id)) return false;
    const f = x.ifaces && x.ifaces[0]; if (!f) return false;
    if (f.type === "wifi") { const l = this.wifiLink(id); return !!(l && l.connected); }
    if (f.type === "bridge") return x.backhaul ? this.meshLink().ok : true;
    return this.cableUp(this.cableAt(id, f.port));
  }

  /* ------------------------------------------------------------ addresses */
  /* the address an interface really has right now (none without a link) */
  addr(id) {
    const x = this.d[id];
    if (id === "router") return this.on("router") ? { ip: x.lan.ip, mask: x.lan.mask, gw: null, dns: [], kind: "static" } : null;
    if (x.kind === "rogue") return this.on(id) ? { ip: x.lan.ip, mask: x.lan.mask, gw: null, dns: [], kind: "static" } : null;
    if (x.kind === "mswitch") { const v = x.sw.vlan1; return this.on(id) && v.ip && !v.shutdown ? { ip: v.ip, mask: v.mask, gw: x.sw.gateway || null, dns: [], kind: "static" } : null; }   /* its own address, on VLAN 1 */
    if (!x.ifaces || !this.hasLink(id)) return null;
    const f = x.ifaces[0];
    let a = null;
    if (f.cfg.mode === "static") a = { ip: f.cfg.ip, mask: f.cfg.mask, gw: f.cfg.gw || null, dns: (f.cfg.dns || []).filter(Boolean), kind: "static" };
    else if (f.lease) a = { ip: f.lease.ip, mask: f.lease.mask, gw: f.lease.gw, dns: f.lease.dns.slice(), kind: "dhcp", server: f.lease.server, obtained: f.lease.obtained };
    else if (f.apipa) a = { ip: f.apipa, mask: "255.255.0.0", gw: null, dns: [], kind: "apipa" };
    if (a && f.cfg.dnsMode === "static" && f.cfg.mode !== "static") a.dns = (f.cfg.dns || []).filter(Boolean);
    return a;
  }
  /* every device in a broadcast domain that answers ARP for an address */
  owners(ip, dom) {
    const out = [];
    for (const id in this.d) {
      const x = this.d[id];
      if (x.kind === "router" || x.kind === "rogue") { if ((dom.has(id + ":lan") && this.on(id) && x.lan.ip === ip) || (id === "router" && this.guestOn() && dom.has("router:guest") && x.guest.lan.ip === ip)) out.push(id); continue; }
      if (x.kind === "mswitch") { if (dom.has(id)) { const a = this.addr(id); if (a && a.ip === ip) out.push(id); } continue; }
      if (!x.ifaces) continue;
      if (!dom.has(id)) continue;
      const a = this.addr(id); if (a && a.ip === ip) out.push(id);
    }
    return out;
  }
  macOf(id) { const x = this.d[id]; if (x.kind === "router" || x.kind === "rogue" || x.kind === "mswitch") return x.mac; return x.ifaces[0].mac; }
  ttlOf(id) { const k = this.d[id].kind; return k === "pc" || k === "laptop" ? 128 : k === "mswitch" ? 255 : 64; }

  /* DHCP servers a client's request reaches */
  dhcpServers(id) {
    const dom = this.domain(this.homeNode(id)), out = [];
    for (const sid in this.d) {
      const s = this.d[sid];
      if ((s.kind === "router" || s.kind === "rogue") && this.on(sid) && s.dhcp && s.dhcp.on && dom.has(sid + ":lan")) out.push(sid);
    }
    if (this.guestOn() && dom.has("router:guest")) out.push("router:guest");   /* the guest network has its own pool, on its own subnet */
    return out;
  }
  /* a DHCP server by its key: a router's LAN side ("router", "rogue") or the router's guest network ("router:guest") */
  srv(key) { return key === "router:guest" ? this.d.router.guest : this.d[key]; }
  guestOn() { const r = this.d.router; return !!(r && r.guest && r.guest.on && this.on("router")); }
  inGuest(ip) { const g = this.d.router && this.d.router.guest; return !!(g && ip && sameSubnet(ip, g.lan.ip, g.lan.mask)); }
  /* the lowest free address in a server's pool (reservations kept for their owners) */
  offer(sid, mac, want) {
    const s = this.srv(sid), dh = s.dhcp, lo = ip2n(dh.start), hi = ip2n(dh.end);
    const res = dh.reservations.find(function (r) { return r.mac === mac; });
    if (res) return res.ip;
    const taken = new Set();
    for (const l of s.leases) if (l.mac !== mac) taken.add(l.ip);
    for (const r of dh.reservations) taken.add(r.ip);
    const mine = s.leases.find(function (l) { return l.mac === mac; });
    if (mine && !taken.has(mine.ip) && ip2n(mine.ip) >= lo && ip2n(mine.ip) <= hi) return mine.ip;
    if (want && !taken.has(want) && ip2n(want) >= lo && ip2n(want) <= hi) return want;
    for (let n = lo; n <= hi; n++) { const ip = n2ip(n); if (!taken.has(ip) && ip !== s.lan.ip) return ip; }
    return null;
  }
  /* a client asks for an address (DORA); returns what happened */
  dhcp(id, why) {
    const x = this.d[id], f = x.ifaces[0];
    if (f.cfg.mode === "static") return { result: "static" };
    if (!this.hasLink(id)) return { result: "media" };
    const servers = this.dhcpServers(id);
    let ans = null, server = null;
    const wins = (this.net.extra && this.net.extra.rogueWins) || [];
    const order = servers.slice().sort(function (a, b) { const ra = this.srv(a).kind === "rogue", rb = this.srv(b).kind === "rogue"; return wins.indexOf(id) >= 0 ? (rb - ra) : (ra - rb); }.bind(this));   /* whoever answers first: a rogue server beats the router for the devices it is quicker to */
    for (const sid of order) { const ip = this.offer(sid, f.mac, f.lease && f.lease.server === this.srv(sid).lan.ip ? f.lease.ip : null); if (ip) { ans = ip; server = sid; break; } }
    if (!ans) {
      if (!f.apipa) f.apipa = "169.254." + (1 + hash(f.mac) % 254) + "." + (1 + hash(f.mac + "x") % 254);
      f.lease = null;
      return { result: servers.length ? "no-offer" : "timeout", servers: servers };
    }
    const s = this.srv(server);
    s.leases = s.leases.filter(function (l) { return l.mac !== f.mac; });
    s.leases.push({ mac: f.mac, ip: ans, name: x.label, host: x.host || x.label.replace(/\s+/g, "-").toUpperCase() });
    const dns = s.dhcp.dnsMode === "router" ? [s.lan.ip] : s.dhcp.dns.filter(Boolean);
    f.lease = { ip: ans, mask: s.lan.mask, gw: s.lan.ip, dns: dns, server: s.lan.ip, obtained: this.n, hours: s.dhcp.leaseH };
    f.apipa = null;
    return { result: "lease", ip: ans, server: server };
  }
  release(id) {
    const f = this.d[id].ifaces[0];
    if (f.lease) { const s = Object.values(this.d).concat(this.d.router && this.d.router.guest ? [this.d.router.guest] : []).find(function (v) { return (v.kind === "router" || v.kind === "rogue") && v.lan.ip === f.lease.server; }); if (s) s.leases = s.leases.filter(function (l) { return l.mac !== f.mac; }); }
    f.lease = null; f.apipa = null;
  }
  /* bring the house up: everyone asks for an address, in a realistic order */
  boot(order) {
    order = order || ["mesh", "tv", "camera", "phone", "laptop", "pc"];
    for (const id of order) if (this.d[id] && this.d[id].ifaces) this.dhcp(id, "boot");
  }
  /* after something changes physically, clients whose link came up ask again */
  relink(before) {
    for (const id in this.d) {
      const x = this.d[id]; if (!x.ifaces || x.ifaces[0].cfg.mode === "static") continue;
      const now = this.hasLink(id), f = x.ifaces[0];
      if (now && !before[id]) this.dhcp(id, "link");
      /* build mode: a device that gave itself 169.254 keeps asking (Windows tries every few minutes), so cabling the
         router in after the switch still gets everyone an address. The tickets keep the moment frozen. */
      else if (now && this.net.extra.build && f.apipa && !f.lease && this.dhcpServers(id).length) this.dhcp(id, "retry");
    }
  }
  links() { const o = {}; for (const id in this.d) if (this.d[id].ifaces) o[id] = this.hasLink(id); return o; }

  /* ------------------------------------------------------------ reaching an address */
  /* the path a packet from a device takes to an address, without sending it */
  route(id, dst) {
    const a = this.addr(id);
    if (!a) return { fail: "no-link" };
    if (isLoopback(dst)) return { local: true, owner: [id], hops: [] };
    const dom = this.domain(this.homeNode(id));
    let next = null;
    if (sameSubnet(a.ip, dst, a.mask)) next = dst;
    else if (a.gw && sameSubnet(a.ip, a.gw, a.mask)) next = a.gw;
    else return { fail: "no-route", addr: a };
    const owners = this.owners(next, dom);
    if (!owners.length) return { fail: next === dst ? "host-unreachable" : "gateway-unreachable", addr: a, next: next };
    if (next === dst) {
      /* the reply has to come back too: a device whose mask puts the sender on another network sends its
         reply to its gateway, and if that gateway isn't on its own network either, the reply never leaves */
      const back = owners.filter((o) => this.canReply(o, a.ip, dom));
      if (!back.length) return { fail: "no-reply", owner: owners, addr: a, next: next };
      return { local: true, owner: back, addr: a, next: next };
    }
    /* through a router */
    const gwId = owners[0], g = this.d[gwId];
    if (g.kind === "router" && this.inGuest(a.ip) && this.guestOn()) {   /* from the guest network: the internet yes; the home network only if the router allows it */
      if (sameSubnet(dst, g.lan.ip, g.lan.mask) || dst === this.d.modem.mgmt) {
        if (g.guest.isolate) return { fail: "blocked", via: gwId, addr: a, hops: [g.guest.lan.ip] };
        const o = this.owners(dst, this.domain("router:lan"));
        return o.length ? { local: true, owner: o, via: gwId, addr: a, next: dst, hops: [g.guest.lan.ip] } : { fail: "host-unreachable", addr: a, next: dst };
      }
    }
    if (g.kind === "router") {
      if (dst === this.d.modem.mgmt) return this.on("modem") && this.cableUp(this.wanCable()) ? { via: gwId, modem: true, addr: a, hops: [g.lan.ip, dst] } : { fail: "beyond", via: gwId, addr: a, hops: [g.lan.ip] };
      if (sameSubnet(dst, g.lan.ip, g.lan.mask)) return { fail: "host-unreachable", addr: a, next: dst };
      if (!this.wanUp()) return { fail: "net-unreachable", via: gwId, addr: a, hops: [g.lan.ip] };
      if (isPublic(dst)) return { via: gwId, internet: true, addr: a, hops: [g.lan.ip, this.net.isp.gw, this.net.isp.core, dst] };
      return { fail: "beyond", via: gwId, addr: a, hops: [g.lan.ip, this.net.isp.gw] };
    }
    if (g.kind === "rogue") {
      if (!g.wanOk) return { fail: "net-unreachable", via: gwId, addr: a, hops: [g.lan.ip] };
      return { via: gwId, internet: true, addr: a, hops: [g.lan.ip, this.d.router.lan.ip, this.net.isp.gw, dst] };
    }
    return { fail: "beyond", addr: a, hops: [next] };
  }
  /* can this device send a reply to an address on its own LAN? */
  canReply(id, to, dom) {
    const x = this.d[id];
    if (x.kind === "router" || x.kind === "rogue" || (!x.ifaces && x.kind !== "mswitch")) return true;
    const b = this.addr(id); if (!b) return false;
    if (sameSubnet(b.ip, to, b.mask)) return true;
    return !!(b.gw && sameSubnet(b.ip, b.gw, b.mask) && this.owners(b.gw, dom).some((g) => this.d[g].kind === "router" || this.d[g].kind === "rogue"));   /* the router hands it back across the LAN */
  }
  /* the quality of the first hop: Wi-Fi loss and delay */
  hop(id) { const l = this.wifiLink(id); return l && l.connected ? { loss: l.loss, base: l.band === 5 ? 3 : 5 } : { loss: 0, base: 0 }; }

  /* ------------------------------------------------------------ names */
  /* can this device get an answer from a DNS server? */
  dnsServerWorks(id, server) {
    if (!isIp(server)) return false;
    const r = this.route(id, server);
    if (r.fail) return false;
    if (r.local) {
      const o = this.d[r.owner[0]];
      if (o.kind === "router") return this.wanUp();            /* the router passes questions on to the provider */
      if (o.kind === "rogue") return !!o.wanOk;
      return false;                                           /* nothing else in a home answers DNS */
    }
    if (r.internet) return this.net.isp.dns.indexOf(server) >= 0 || DNS_PUBLIC.indexOf(server) >= 0;
    return false;
  }
  lookup(name) {
    name = String(name).toLowerCase().replace(/\.$/, "");
    if (SITES[name]) return SITES[name];
    if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(name)) return null;
    if (!/\.(com|org|net|edu|gov|io|example|info|us|uk)$/.test(name)) return null;
    return "203.0.113." + (100 + hash(name) % 140);
  }

  /* ------------------------------------------------------------ actions: every change goes through here */
  apply(act) {
    this.n++;
    const before = this.links();
    let res = null;
    switch (act.t) {
      case "reseat": { const c = this.cable(act.cable), e = c[act.end]; if (c.kind === "coax") e.tight = true; else e.seated = true; res = { ok: true }; break; }
      case "unplug": { const c = this.cable(act.cable); c[act.end].seated = false; res = { ok: true }; break; }
      case "replace": { const c = this.cable(act.cable); c.cond = "good"; c.a.seated = true; c.b.seated = true; if (c.kind === "coax") { c.a.tight = true; c.b.tight = true; } res = { ok: true }; break; }
      case "tighten": { const c = this.cable(act.cable); c[act.end].tight = true; res = { ok: true }; break; }
      case "power": {
        const x = this.d[act.dev];
        if (x.ifaces && x.ifaces[0].cfg.mode !== "static") { /* a restart asks for its address again */ }
        if (x.kind === "mswitch") { reloadSwitch(x.sw); for (const k in (this.cli || {})) if (this.cli[k].sw === act.dev) delete this.cli[k]; }   /* power off and on: only what was saved comes back; every login to it is dropped */
        res = { ok: true, restarted: act.dev };
        break;
      }
      case "router": res = this.setRouter(act.page, act.values); break;
      case "place": res = this.place(act.dev, act.room); break;
      case "lay": res = this.lay(act.a, act.b); break;
      case "pull": { const i = this.net.cables.findIndex(function (c) { return c.id === act.cable; }); if (i < 0 || this.net.cables[i].kind === "coax") { res = { ok: false, errs: ["There's no such cable to pull"] }; break; } this.net.cables.splice(i, 1); res = { ok: true }; break; }
      case "injector": { const j = this.d[act.dev || "injector"]; if ("power" in act.values) j.power = !!act.values.power; if (act.values.swap) j.std = "af"; res = { ok: true, power: j.power, std: j.std }; break; }   /* swap: a new 802.3af injector in the same place, same cables, same adapter */
      case "rogue": { const g = this.d.rogue; if ("dhcpOn" in act.values) g.dhcp.on = !!act.values.dhcpOn; res = { ok: true }; break; }
      case "print": res = this.printTest(); break;
      case "speed": res = this.speedTest(act.dev); break;
      case "outside": res = this.outside(act.port); break;
      case "rejoin": res = this.hasLink(act.dev) ? this.dhcp(act.dev, "rejoin") : { result: "no-wifi" }; break;
      case "forget": { const f = this.d[act.dev].ifaces[0]; f.saved = { ssid: null, passOk: false }; this.release(act.dev); res = { ok: true }; break; }
      case "join": {                                            /* join the house's network by name: the secured one with its current password, or (open) a copy with none; or (ssid) the guest network */
        const f = this.d[act.dev].ifaces[0], w = this.d.router.wifi, g = this.d.router.guest;
        if (g && act.ssid && act.ssid === g.ssid) f.saved = g.sec === "Open" ? { ssid: g.ssid, passOk: true, sec: "Open" } : { ssid: g.ssid, passOk: true, gen: g.gen };
        else f.saved = act.open ? { ssid: w.ssid, passOk: true, sec: "Open" } : { ssid: w.ssid, passOk: true, gen: w.gen || 1 }; this.release(act.dev);   /* open: the copy with no password */
        res = this.hasLink(act.dev) ? this.dhcp(act.dev, "join") : { result: "no-wifi" }; break;
      }
      case "pcprinter": { const ip = String(act.ip || "").trim(); if (!isIp(ip)) { res = { ok: false, errs: ["The printer port must be an IPv4 address"] }; break; } this.d.pc.printer.port = ip; res = { ok: true }; break; }
      case "client": res = this.setClient(act.dev, act.values); break;
      case "cmd": res = { ok: true }; break;                    /* commands are replayed by the command runner */
      case "tftp": { const s = this.d[act.dev || "tech"].tftp; if (s) s.on = !!act.on; res = { ok: !!s, on: !!(s && s.on) }; break; }   /* your laptop's TFTP server, started or stopped */
      case "ipam": {                                            /* the IPAM sheet as saved: the strings as typed, trimmed */
        this.net.ipam = (act.rows || []).slice(0, 8).map(function (r) { const o = {}; ["net", "mask", "first", "last", "bc", "gw"].forEach(function (k) { o[k] = String(r && r[k] != null ? r[k] : "").trim().slice(0, 40); }); return o; });
        res = { ok: true }; break;
      }
      default: res = { ok: false, err: "unknown action" };
    }
    this.relink(before);
    if (act.t === "power" && this.d[act.dev].ifaces && this.hasLink(act.dev)) this.dhcp(act.dev, "restart");
    this.log.push(act);
    return res;
  }
  setRouter(page, v) {
    const r = this.d.router, errs = [];
    if (page === "dhcp") {
      const nd = Object.assign({}, r.dhcp);
      if ("on" in v) nd.on = !!v.on;
      if ("start" in v) nd.start = String(v.start).trim();
      if ("end" in v) nd.end = String(v.end).trim();
      if ("dnsMode" in v) nd.dnsMode = v.dnsMode === "manual" ? "manual" : "router";
      if ("dns1" in v || "dns2" in v) nd.dns = [String(v.dns1 || "").trim(), String(v.dns2 || "").trim()];
      if ("leaseH" in v) nd.leaseH = Math.max(1, Math.min(168, parseInt(v.leaseH, 10) || 24));
      if (!isIp(nd.start) || !sameSubnet(nd.start, r.lan.ip, r.lan.mask)) errs.push("The start address must be in " + this.net.prefix + ".x");
      if (!isIp(nd.end) || !sameSubnet(nd.end, r.lan.ip, r.lan.mask)) errs.push("The end address must be in " + this.net.prefix + ".x");
      if (!errs.length && ip2n(nd.start) > ip2n(nd.end)) errs.push("The start address must come before the end address");
      if (!errs.length && ip2n(nd.start) <= ip2n(r.lan.ip) && ip2n(r.lan.ip) <= ip2n(nd.end)) errs.push("The range can't include the router's own address, " + r.lan.ip);
      if (nd.dnsMode === "manual") { if (!isIp(nd.dns[0])) errs.push("Primary DNS must be an IPv4 address, like 203.0.113.53"); if (nd.dns[1] && !isIp(nd.dns[1])) errs.push("Secondary DNS must be an IPv4 address, or left empty"); }
      if (errs.length) return { ok: false, errs: errs };
      r.dhcp = nd; return { ok: true };
    }
    if (page === "wifi") {
      if ("ssid" in v) { const n = String(v.ssid || "").trim(); if (!n || n.length > 32 || !/^[\x20-\x7e]+$/.test(n)) return { ok: false, errs: ["The network name must be 1 to 32 letters, numbers or symbols"] }; if (r.guest && r.guest.ssid === n) return { ok: false, errs: ["That's the guest network's name: the home network needs its own"] }; }
      if ("ch24" in v) { if (v.ch24 === "auto") r.wifi.ch24mode = "auto"; else { const c = parseInt(v.ch24, 10); if (!(c >= 1 && c <= 11)) return { ok: false, errs: ["2.4 GHz channel must be 1 to 11, or Auto"] }; r.wifi.ch24mode = "manual"; r.wifi.ch24 = c; } }
      if ("ch5" in v) { const c = parseInt(v.ch5, 10); if ([36, 40, 44, 48, 149, 153, 157, 161].indexOf(c) < 0) return { ok: false, errs: ["5 GHz channel must be one of 36, 40, 44, 48, 149, 153, 157, 161"] }; r.wifi.ch5 = c; }
      if (v.newPassword) r.wifi.gen = Math.max(r.wifi.gen || 1, this.net.extra.oldWifi || 0) + 1;   /* a new Wi-Fi password: every device has to be given it again */
      if (v.clientPassword && this.net.extra.oldWifi) r.wifi.gen = this.net.extra.oldWifi;   /* build mode: the client's own password, typed in from the card on the fridge: the house's devices know it */
      if ("ssid" in v) r.wifi.ssid = String(v.ssid).trim();   /* a new name: devices joined to the old one have to join the new one */
      if ("sec" in v) { if (SECURITY.indexOf(v.sec) < 0) return { ok: false, errs: ["Security must be one of " + SECURITY.join(", ")] }; r.wifi.sec = v.sec; if (r.guest && r.guest.sec !== "Open") r.guest.sec = v.sec; }
      return { ok: true };
    }
    if (page === "reservation-add") {
      if (!/^([0-9a-f]{2}[-:]){5}[0-9a-f]{2}$/i.test(String(v.mac || "").trim())) return { ok: false, errs: ["The hardware address must look like 02-1a-2b-3c-4d-5e"] };
      v = Object.assign({}, v, { mac: String(v.mac).trim().toLowerCase().replace(/:/g, "-") });
      if (!isIp(v.ip) || !sameSubnet(v.ip, r.lan.ip, r.lan.mask) || v.ip === r.lan.ip) return { ok: false, errs: ["The reserved address must be in " + this.net.prefix + ".x"] };
      r.dhcp.reservations = r.dhcp.reservations.filter(function (x) { return x.mac !== v.mac; });
      r.dhcp.reservations.push({ name: v.name || "Device", mac: v.mac, ip: v.ip }); return { ok: true };
    }
    if (page === "forward") {
      const f = r.forwards.find(function (x) { return String(x.ext) === String(v.ext); });
      if (!f) return { ok: false, errs: ["No forward for that port"] };
      if (!isIp(v.ip) || !sameSubnet(v.ip, r.lan.ip, r.lan.mask) || v.ip === r.lan.ip) return { ok: false, errs: ["The internal address must be a device in " + this.net.prefix + ".x"] };
      f.ip = String(v.ip).trim(); return { ok: true };
    }
    if (page === "guest" && r.guest) {   /* build mode: the router's guest network */
      const g = r.guest;
      if ("ssid" in v) { const n = String(v.ssid || "").trim(); if (!n || n.length > 32 || !/^[\x20-\x7e]+$/.test(n)) return { ok: false, errs: ["The guest network's name must be 1 to 32 letters, numbers or symbols"] }; if (n === r.wifi.ssid) return { ok: false, errs: ["The guest network needs a name of its own, not the home network's"] }; }
      if ("on" in v) g.on = !!v.on;
      if ("ssid" in v) g.ssid = String(v.ssid).trim();
      if ("isolate" in v) g.isolate = !!v.isolate;
      if (v.newPassword) { g.gen = (g.gen || 1) + 1; g.sec = r.wifi.sec; }   /* a password of its own: from now on it's secured like the home network */
      return { ok: true };
    }
    if (page === "forward-add") {   /* build mode: a new forward from the outside port to a device's port */
      const ext = parseInt(v.ext, 10), port = parseInt(v.port, 10), ip = String(v.ip || "").trim(), name = String(v.name || "").trim() || "Forward";
      if (!(ext >= 1 && ext <= 65535) || String(ext) !== String(v.ext).trim()) return { ok: false, errs: ["The outside port must be a number from 1 to 65535"] };
      if (!(port >= 1 && port <= 65535) || String(port) !== String(v.port).trim()) return { ok: false, errs: ["The device's port must be a number from 1 to 65535"] };
      if (!isIp(ip) || !sameSubnet(ip, r.lan.ip, r.lan.mask) || ip === r.lan.ip) return { ok: false, errs: ["The internal address must be a device in " + this.net.prefix + ".x"] };
      r.forwards = r.forwards.filter(function (x) { return +x.ext !== ext; });
      r.forwards.push({ name: name.slice(0, 32), ext: ext, ip: ip, port: port }); return { ok: true };
    }
    if (page === "forward-del") { r.forwards = r.forwards.filter(function (x) { return +x.ext !== +v.ext; }); return { ok: true }; }
    if (page === "admin") { if (v.newPassword) r.admin = { gen: ((r.admin && r.admin.gen) || 1) + 1 }; return { ok: true }; }   /* the password for the router's own pages */
    if (page === "reservation-del") { r.dhcp.reservations = r.dhcp.reservations.filter(function (x) { return x.mac !== v.mac; }); return { ok: true }; }
    return { ok: false, errs: ["Unknown page"] };
  }
  /* build mode: take a device out of its box and put it in a room (or move it: its cables must come out first) */
  place(id, room) {
    const x = this.d[id];
    if (!x) return { ok: false, errs: ["No such device"] };
    if (!(this.net.roomNames ? this.net.roomNames[room] : SIGNAL[room])) return { ok: false, errs: ["There's no room called " + room] };
    const fx = (this.net.fixed || FIXED_ROOM)[x.kind]; if (fx && fx[0] !== room) return { ok: false, errs: ["The " + x.label.replace(/^([A-Z])(?=[a-z]+(\s|$))/, function (m) { return m.toLowerCase(); }) + " goes " + fx[1]] };
    if (!x.boxed && this.cablesOf(id).some(function (c) { return c.kind !== "coax"; }) && this.net.rooms[id] !== room) return { ok: false, errs: ["Pull its cables out first: it's still cabled where it is"] };
    x.boxed = false; this.net.rooms[id] = room;
    return { ok: true, room: room };
  }
  /* build mode: lay a patch cable between two free ports; it comes as long as the run between the rooms */
  lay(a, b) {
    const errs = [], A = this.d[a && a.dev], B = this.d[b && b.dev];
    if (!A || !B) return { ok: false, errs: ["Choose a device and a port for each end"] };
    if (a.dev === b.dev) return { ok: false, errs: ["Both ends are on the " + A.label + ": a cable joins two devices"] };
    [[A, a], [B, b]].forEach(function (e) {
      if (e[0].boxed) errs.push("The " + e[0].label + " is still in its box: place it first");
      else if (portsOf(e[0]).indexOf(e[1].port) < 0) errs.push("The " + e[0].label + " has no port " + e[1].port);
      else if (this.cableAt(e[1].dev, e[1].port)) errs.push("The " + e[0].label + "'s " + (portName(e[0], e[1].port) === e[1].port ? "port " + e[1].port : portName(e[0], e[1].port)) + " already has a cable in it");
    }, this);
    if (errs.length) return { ok: false, errs: errs };
    const ca = consoleEnd(A, a.port), cb = consoleEnd(B, b.port);
    if (ca !== cb) return { ok: false, errs: [ca ? (A.kind === "mswitch" ? "The switch's CONSOLE port takes the console cable from your laptop, not a network cable" : "Your laptop's USB serial adapter takes the console cable: its other end goes to a switch's CONSOLE port") : (B.kind === "mswitch" ? "The switch's CONSOLE port takes the console cable from your laptop, not a network cable" : "Your laptop's USB serial adapter takes the console cable: its other end goes to a switch's CONSOLE port")] };
    if (ca && A.kind === B.kind) return { ok: false, errs: ["A console cable joins your laptop to a switch's CONSOLE port"] };
    if (ca && this.net.rooms[a.dev] !== this.net.rooms[b.dev]) return { ok: false, errs: ["The console cable is 1.8 m long: your laptop has to be in the same room as the switch"] };
    const n = (this.net.extra.runs = (this.net.extra.runs || 0) + 1), len = ca ? 1.8 : runLength(this.net.rooms[a.dev], this.net.rooms[b.dev], this.net);
    const c = { id: (ca ? "c-console-" : "c-run-") + n, kind: ca ? "console" : "cat6", a: { dev: a.dev, port: a.port, seated: true }, b: { dev: b.dev, port: b.port, seated: true }, cond: "good", length: len };
    this.net.cables.push(c);
    return { ok: true, cable: c.id, length: len };
  }

  /* a device's own IP settings. Like a real printer or Windows, it takes any setting that is well formed,
     right or wrong for this network: what happens next is worked out like everything else. */
  setClient(id, v) {
    const f = this.d[id].ifaces[0];
    if (v.mode === "static") {
      const errs = [], ip = String(v.ip || "").trim(), mask = String(v.mask || "").trim(), gw = String(v.gw || "").trim(), bits = maskBits(mask);
      if (!isIp(ip)) errs.push("The IP address must be four numbers from 0 to 255, like " + this.net.prefix + ".20");
      if (bits === null || bits < 8 || bits > 30) errs.push("That subnet mask isn't valid: it must look like 255.255.255.0");
      if (!errs.length && (ip === network(ip, mask) || ip === broadcast(ip, mask))) errs.push(ip + " is that network's own number or its broadcast address: no device can use it");
      if (gw && !isIp(gw)) errs.push("The gateway must be an IPv4 address, or left empty");
      let dns = v.dns ? v.dns.map(function (d) { return String(d || "").trim(); }).filter(Boolean) : (f.cfg.dns && f.cfg.dns.length ? f.cfg.dns : (gw ? [gw] : []));
      if (dns.some(function (d) { return !isIp(d); })) errs.push("A DNS server must be an IPv4 address, or left empty");
      if (errs.length) return { ok: false, errs: errs };
      v = { mode: "static", ip: ip, mask: mask, gw: gw, dns: dns };
    }
    if ("mode" in v) f.cfg.mode = v.mode;
    if ("ip" in v) f.cfg.ip = v.ip;
    if ("mask" in v) f.cfg.mask = v.mask;
    if ("gw" in v) f.cfg.gw = v.gw;
    if ("dns" in v) f.cfg.dns = v.dns;
    if ("dnsMode" in v) f.cfg.dnsMode = v.dnsMode;
    if (v.mode === "static") { this.release(id); f.cfg.dnsMode = "static"; }
    if (v.mode === "dhcp") { f.cfg.dnsMode = "auto"; if (this.hasLink(id)) this.dhcp(id, "change"); }
    return { ok: true };
  }

  /* a connection from the internet to the house's public address on a port (port forwarding, NAT) */
  outside(port) {
    if (!this.wanUp()) return { ok: false, why: "wan" };
    const f = this.d.router.forwards.find(function (x) { return +x.ext === +port; });
    if (!f) return { ok: false, why: "no-forward" };
    const o = this.owners(f.ip, this.domain("router:lan"));
    if (!o.length) return { ok: false, why: "nobody", target: f.ip, forward: f };
    const who = o[0], d = this.d[who];
    if (d.listens && d.listens.indexOf(+f.port) >= 0) return { ok: true, who: who, target: f.ip, forward: f };
    return { ok: false, why: "refused", who: who, target: f.ip, forward: f };
  }
  /* an internet speed test from a device: the slowest of the plan, the link and the Wi-Fi */
  speedTest(id) {
    const r = this.route(id, "203.0.113.80");
    if (!r.internet) return { ok: false, why: r.fail || "no-internet" };
    const plan = this.net.isp.plan || 500, x = this.d[id], f = x.ifaces[0];
    let link = 1000;
    if (f.type === "wifi") { const l = this.wifiLink(id); link = l ? l.rate * 0.62 * (1 - l.loss) : 0; }
    else link = this.speed(this.cableAt(id, f.port)) * 0.94;
    const R = this.r("speed" + id), v = Math.min(plan * 0.96, link) * (0.97 + R() * 0.03);
    return { ok: true, down: Math.round(v), up: Math.round(Math.min(plan * 0.04, link) * 10) / 10, plan: plan, link: f.type === "wifi" ? null : this.speed(this.cableAt(id, f.port)) };
  }
  /* the office PC sends a test page to its printer port; with two devices on one address, it goes to whoever answers ARP */
  printTest() {
    const ip = this.d.pc.printer.port, r = this.route("pc", ip);
    if (!r.local) return { ok: false, why: r.fail || "beyond", port: ip };
    const who = r.owner[this.n % r.owner.length];
    this.arp.pc[ip] = this.macOf(who);
    return who === "printer" ? { ok: true, port: ip } : { ok: false, why: "wrong-device", who: who, port: ip, conflict: r.owner.length > 1 };
  }

  /* a per-action random source, so replays give the same pings */
  r(tag) { return rng(hash(this.net.seed + ":" + this.n + ":" + tag)); }
}
