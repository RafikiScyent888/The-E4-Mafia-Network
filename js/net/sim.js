/* The simulation: given the state of the cables, the settings and the
   leases, it works out what really happens. Commands and device pages only
   ever ask it; nothing is canned. So a fault shows up wherever it really
   would, and a fix works only if it fixes the real cause.
   Every change goes through apply(), so a ticket can be replayed exactly
   (progress is saved as the list of actions). */
import { rng, hash, ip2n, n2ip, sameSubnet, isIp, isApipa, isPublic, isPrivate, isLoopback, broadcast, network, maskBits } from "./util.js";
import { reload as reloadSwitch, duplexEnds, carries, ownAddrs, psRunOf, errDisabled, dotMac, l3Ifs, l3Route, l3Table, chanState, portUp, ospfPassive, PORT_NAMES as SW_PORTS } from "./swcli.js";
import { solve as ospfSolve, wildMatch as ospfMatch, ifCost as ospfCost } from "./ospf.js";
import { solve as stpSolve, costOf as stpCost } from "./stp.js";
import * as RT from "./rtcli.js";

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
export const PORTS = { router: ["WAN", "LAN 1", "LAN 2", "LAN 3", "LAN 4"], switch: ["1", "2", "3", "4", "5"], modem: ["ETH"], pc: ["NIC"], printer: ["NET"], camera: ["LAN"], tv: ["LAN"], injector: ["DATA IN", "PoE OUT"], mesh: ["WAN", "LAN"], dcam: ["LAN"] };
/* what a PoE injector can send down the cable: at the injector, and what reaches the device after the cable's loss (IEEE 802.3af and 802.3at) */
export const POE = { af: { pse: 15.4, pd: 12.95 }, at: { pse: 30, pd: 25.5 } };
export const PORT_NAME = { WAN: "INTERNET (WAN)", ETH: "ETHERNET", NIC: "Ethernet", NET: "NETWORK", LAN: "LAN", "PoE OUT": "DATA + POWER OUT" };
/* an injector's ports in pairs: each DATA + POWER OUT carries on the link from its own DATA IN, and nothing else.
   The dual-port PoE+ injector (build mode's injector2) has two pairs, kept apart as on the real thing */
export const POE_PAIR = { "PoE OUT": "DATA IN", "DATA IN": "PoE OUT", "PoE OUT 2": "DATA IN 2", "DATA IN 2": "PoE OUT 2" };
export const DUAL_PORTS = ["DATA IN", "DATA IN 2", "PoE OUT", "PoE OUT 2"];
const DUAL_NAME = { "DATA IN": "DATA IN 1", "DATA IN 2": "DATA IN 2", "PoE OUT": "DATA + POWER OUT 1", "PoE OUT 2": "DATA + POWER OUT 2" };
/* the name printed by a port on the device itself: what the student reads on the model and in every list */
export function portName(x, port) { if (x && x.kind === "patchpanel") return /R$/.test(port) ? "port " + port.slice(0, -1) + " (punched down at the back)" : "port " + port; return (x && x.dual && DUAL_NAME[port]) || (x && x.kind === "techlaptop" && port === "USB-C" ? "USB-C (its USB serial adapter)" : null) || PORT_NAME[port] || port; }
/* the managed switch's copper ports and its console port (its SFP slots take a fibre module: level 2's later jobs) */
export const MSW_PORTS = Array.from({ length: 24 }, function (_, i) { return String(i + 1); }).concat(["CONSOLE", "SFP1", "SFP2", "SFP3", "SFP4"]);
/* a managed switch's port, by the name the switch itself uses: copper "4" is GigabitEthernet0/4, fibre slot "SFP1" is GigabitEthernet0/25 */
export function swPort(port) { const m = /^SFP(\d)$/.exec(port); return "GigabitEthernet0/" + (m ? 24 + +m[1] : port); }
/* the SFP modules in the van, and what each one is: its wavelength, the fibre it's made for, its speed, the colour of
   its bail latch (the industry's habit: black for SX, blue for LX), and what's printed on its label */
export const SFP_MODULES = {
  "1000BASE-SX": { nm: 850, fiber: "MMF", rate: 1000, bail: "black", show: "1000BaseSX", pid: "SFP-1000BASE-SX", label: "1000BASE-SX · 850 nm · multimode · up to 550 m" },
  "1000BASE-LX": { nm: 1310, fiber: "SMF", rate: 1000, bail: "blue", show: "1000BaseLX", pid: "SFP-1000BASE-LX", label: "1000BASE-LX · 1310 nm · single-mode · up to 10 km" },
  "10GBASE-SR": { nm: 850, fiber: "MMF", rate: 10000, bail: "black", show: "10GBaseSR", pid: "SFP-10G-SR", label: "SFP+ 10GBASE-SR · 850 nm · multimode · up to 300 m" }
};
/* a patch panel's 24 ports: the jack at the front ("7") and the run punched down behind it ("7R") */
export const PANEL_PORTS = Array.from({ length: 24 }, function (_, i) { return String(i + 1); }).concat(Array.from({ length: 24 }, function (_, i) { return (i + 1) + "R"; }));
export function portsOf(x) {
  if (!x) return [];
  if (x.kind === "patchpanel") return PANEL_PORTS;
  if (x.dual) return DUAL_PORTS;
  if (x.kind === "switch" && x.ports) return Array.from({ length: x.ports }, function (_, i) { return String(i + 1); });   /* the office's old switch has 8 */
  if (x.kind === "mswitch") return MSW_PORTS;
  if (x.kind === "brouter") return RT_PORT_NAMES;
  if (x.kind === "bap") return ["ETH"];
  if (x.kind === "techlaptop") return ["USB-C", "ETH"];
  if (x.kind === "jack") return ["JACK"];   /* the USB serial adapter for the console cable, and its own Ethernet port */
  return PORTS[x.kind] || [];
}
/* a console cable: your laptop's USB serial adapter to a switch's CONSOLE port */
const consoleEnd = function (x, port) { return !!x && (((x.kind === "mswitch" || x.kind === "brouter") && port === "CONSOLE") || (x.kind === "techlaptop" && port === "USB-C")); };
/* an SFP slot: the managed switch's SFP1 to SFP4, the business router's Gi0/8 and Gi0/9 (printed WAN) */
export const isSfpSlot = function (x, port) { return !!x && ((x.kind === "mswitch" && /^SFP\d$/.test(port)) || (x.kind === "brouter" && /^Gi0\/[89]$/.test(port))); };
export const RT_PORT_NAMES = Array.from({ length: 10 }, function (_, i) { return "Gi0/" + i; }).concat(["CONSOLE"]);
export const FIXED_ROOM = { modem: ["living", "by the cable outlet: there's one, in the living room"], camera: ["porch", "on its mount by the front door"] };
/* a device's name mid-sentence: "the back switch", "the manager's PC", "the PoE injector", "the ISP", "your laptop" */
const theDev = function (x) { return /^your /i.test(x.label) ? x.label.toLowerCase() : "the " + x.label.replace(/^[A-Z](?=[a-z']*(\s|$))/, function (m) { return m.toLowerCase(); }); };
const cap = function (s) { return s[0].toUpperCase() + s.slice(1); };
const RUN = { office: { living: 14, kitchen: 18, garage: 12, porch: 38, upstairs: 20, landing: 18 }, living: { kitchen: 10, garage: 22, porch: 20, upstairs: 15, landing: 8 }, kitchen: { garage: 16, porch: 14, upstairs: 22, landing: 14 }, garage: { porch: 30, upstairs: 28, landing: 24 }, porch: { upstairs: 32, landing: 22 }, upstairs: { landing: 6 } };
export function runLength(a, b, net) { if (a === b) return 3; const T = (net && net.runs) || RUN; return (T[a] && T[a][b]) || (T[b] && T[b][a]) || 40; }   /* net: the office has its own rooms and runs */
export const COPPER_MAX = 100;
/* the business router's ports as printed on it ("Gi0/0") and as its command line names them ("GigabitEthernet0/0") */
const RT_IF = function (port) { const m = /^Gi0\/(\d)$/.exec(port || ""); return m ? "GigabitEthernet0/" + m[1] : null; };
const RT_PORT = function (n) { return n.split(".")[0].replace("GigabitEthernet", "Gi"); };

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
  /* a patch panel joins the jack at each front port to the run punched down behind it: a cable into either is, for the
     link, one path from the device at one end to the device at the other (the lengths added, the worse condition, a
     crossover only if just one of the two crosses). null: nothing on the other side, or a plug out at the panel */
  panelEnd(c) { return [c.a, c.b].find(function (e) { return this.d[e.dev] && this.d[e.dev].kind === "patchpanel"; }, this) || null; }
  viaPanel(c) {
    const pe = this.panelEnd(c); if (!pe) return c;
    const pair = /R$/.test(pe.port) ? pe.port.slice(0, -1) : pe.port + "R", o = this.cableAt(pe.dev, pair); if (!o) return null;
    const oe = o.a.dev === pe.dev && o.a.port === pair ? o.a : o.b, near = pe === c.a ? c.b : c.a, far = oe === o.a ? o.b : o.a;
    if (!pe.seated || !oe.seated) return null;
    const worst = [c.cond, o.cond].indexOf("crushed") >= 0 ? "crushed" : [c.cond, o.cond].indexOf("damaged") >= 0 ? "damaged" : "good";
    return { id: c.id, kind: "cat6", a: near, b: far, cond: worst, length: (c.length || 0) + (o.length || 0), wiring: (c.wiring === "crossover") !== (o.wiring === "crossover") ? "crossover" : "straight", via: [c.id, o.id] };
  }
  /* the device beyond a PoE injector on this cable (what LLDP hears through it), or null if there's no injector on it */
  viaInjectorEnd(c, id) { const v = [c.a, c.b].some(function (e) { return this.d[e.dev] && this.d[e.dev].kind === "injector"; }, this) ? this.viaInjector(c.kind === "cat6" && this.panelEnd(c) ? this.viaPanel(c) : c) : null; if (!v) return null; return v.a.dev === id ? v.b : v.a; }
  /* a link through a PoE injector, one path from the device on its output to the device on its input (the same pair's
     other port), each side through the patch panel if it's patched. null: nothing on the injector's other side */
  viaInjector(c) {
    const ie = [c.a, c.b].find(function (e) { return this.d[e.dev] && this.d[e.dev].kind === "injector"; }, this), near = ie === c.a ? c.b : c.a;
    let o = this.cableAt(ie.dev, POE_PAIR[ie.port]); if (!o) return null;
    if (o.kind === "cat6" && this.panelEnd(o)) { o = this.viaPanel(o); if (!o) return null; }
    const far = o.a.dev === ie.dev ? o.b : o.a;
    return { id: c.id, kind: "cat6", a: near, b: far, cond: c.cond, length: (c.length || 0) + (o.length || 0), via: (c.via || [c.id]).concat(o.via || [o.id]) };
  }
  /* a fibre link: both plugs in, a module in each end that its slot can run (a 1 Gb/s SFP slot can't run a 10 Gb/s SFP+
     module), the two modules the same kind (850 nm talks only to 850 nm), each made for the fibre between them, the
     LC pair the right way round (each end's transmit to the other's receive), both switches on and both ports open */
  fibreUp(c) {
    if (!c.a.seated || !c.b.seated || c.polarity === "flipped") return false;
    const mods = [c.a, c.b].map(function (e) { const x = this.d[e.dev], m = x && x.sfp && x.sfp[e.port]; return m ? SFP_MODULES[m] : null; }, this);
    if (!mods[0] || !mods[1] || mods.some(function (m) { return m.rate !== 1000 || m.fiber !== c.fiber; }) || mods[0].nm !== mods[1].nm) return false;
    return [c.a, c.b].every(function (e) { const x = this.d[e.dev]; if (!this.on(e.dev)) return false; if (x.kind === "brouter") { const f = x.sw.ifs[RT_IF(e.port)]; return !!f && !f.shutdown; } if (x.kind !== "mswitch") return true; const p = x.sw.ports[swPort(e.port)]; return !!p && !p.shutdown; }, this);
  }
  cableUp(c) {
    if (!c) return false;
    if (c.kind === "fibre") return this.fibreUp(c);
    if (c.kind === "cat6" && this.panelEnd(c)) { const v = this.viaPanel(c); return !!v && this.cableUp(v); }
    if ([c.a, c.b].some(function (e) { return this.d[e.dev] && this.d[e.dev].kind === "jack"; }, this)) return false;   /* a run to a wall jack with nothing plugged into it */
    if (c.kind === "coax") return c.a.tight && c.b.tight && c.cond === "good";
    if (c.kind === "console") return c.a.seated && c.b.seated && this.on(c.a.dev) && this.on(c.b.dev);   /* serial, not Ethernet: "up" means the console answers */
    if (c.length > COPPER_MAX) return false;                /* past 100 m the signal has faded too far for Ethernet to hold a link */
    if (!c.a.seated || !c.b.seated) return false;
    if (c.cond === "crushed") return false;                 /* pairs 1-2 or 3-6 open: no link at all */
    for (const e of [c.a, c.b]) {   /* a managed switch's port: shut down, or a fixed speed the far end can't match, and there's no link */
      const x = this.d[e.dev]; if (!x || x.kind !== "mswitch") continue;
      const p = x.sw.ports[swPort(e.port)]; if (!p || p.shutdown || errDisabled(x.sw, swPort(e.port))) return false;
      const fs = this.speedSetting(e === c.a ? c.b : c.a); if (p.speed !== "auto" && fs !== "auto" && p.speed !== fs) return false;
      const fx = this.d[(e === c.a ? c.b : c.a).dev], top = Math.min((fx && fx.maxMbps) || 1000, c.cond === "damaged" ? 100 : 1000);
      if (p.speed !== "auto" && +p.speed > top) return false;   /* a speed forced above what the far end (or the cable) can run: no link */
    }
    for (const e of [c.a, c.b]) { const x = this.d[e.dev]; if (x && x.kind === "brouter") { const ph = RT_IF(e.port); if (!ph || x.sw.ifs[ph].shutdown) return false; } }   /* a router's port shut down: no link */
    if (!this.pairsMeet(c)) return false;                   /* both ends transmitting on the same pair (TX/RX transposed): no link */
    const ij = [c.a, c.b].find(function (e) { return this.d[e.dev] && this.d[e.dev].kind === "injector"; }, this);
    if (ij) {  /* an injector passes the data pairs straight through: the link is end to end */
      const o = this.cableAt(ij.dev, POE_PAIR[ij.port]);   /* the cable in the same pair's other port */
      if (!o || o === c || !o.a.seated || !o.b.seated || o.cond === "crushed") return false;
      const fe = o.a.dev === ij.dev ? o.b : o.a, fx = this.d[fe.dev];   /* and the port on the far side open: a shut switch or router port is no link, through the injector or not */
      if (fx && fx.kind === "mswitch") { const p = fx.sw.ports[swPort(fe.port)]; if (!p || p.shutdown || errDisabled(fx.sw, swPort(fe.port))) return false; }
      if (fx && fx.kind === "brouter") { const ph = RT_IF(fe.port); if (!ph || fx.sw.ifs[ph].shutdown) return false; }
      return [c.a, c.b, o.a, o.b].filter(function (e) { return e.dev !== ij.dev; }).every(function (e) { return this.on(e.dev); }, this);
    }
    return this.on(c.a.dev) && this.on(c.b.dev);
  }
  /* do the two ends' transmit pairs reach each other's receive pairs? A switch port's pairs are the other way round from a
     computer's (MDI-X against MDI), so like to like needs a crossover cable, unless either end swaps its pairs by itself
     (auto-MDIX: every modern port, a managed switch's port unless turned off, never an old 10/100 switch) */
  pairsMeet(c) {
    const auto = function (e) { const x = this.d[e.dev]; if (!x) return true; if (x.kind === "mswitch") { const p = x.sw.ports[swPort(e.port)]; return !p || p.mdix !== false; } return x.mdix !== false; }.bind(this);
    if (auto(c.a) || auto(c.b)) return true;
    const mdix = function (e) { const k = this.d[e.dev].kind; return k === "switch" || k === "mswitch"; }.bind(this);
    return (mdix(c.a) !== mdix(c.b)) === (c.wiring !== "crossover");
  }
  speed(c) {   /* gigabit needs all four pairs; 100 Mb/s needs only 1-2 and 3-6; a speed fixed at either end is what the link runs at */
    if (!this.cableUp(c)) return 0;
    if (this.panelEnd(c)) c = this.viaPanel(c);   /* through a patch panel: the whole path */
    let sp = c.cond === "damaged" ? 100 : 1000;
    [c.a, c.b].forEach(function (e) { const x = this.d[e.dev]; if (x && x.maxMbps) sp = Math.min(sp, x.maxMbps); }, this);   /* an old 10/100 device */
    if (c.kind === "cat6") [c.a, c.b].forEach(function (e) { const f = this.speedSetting(e); if (f !== "auto") sp = Math.min(sp, +f); }, this);
    return sp;
  }
  /* what speed an end of a cable is set to: a managed switch port's setting, a computer's adapter's, or auto */
  speedSetting(e) {
    const x = this.d[e.dev]; if (!x) return "auto";
    if (x.kind === "mswitch") { const p = x.sw.ports[swPort(e.port)]; return p ? p.speed : "auto"; }
    return (x.ifaces && x.ifaces[0].cfg.speed) || "auto";
  }
  /* the managed switch's view of its own links, for its show commands: refreshed from the cables before it's asked */
  syncSwitch(id) {
    const x = this.d[id]; if (!x || x.kind !== "mswitch") return null;
    x.sw.links = this.switchLinks(id); x.sw.uptime = x.sw.uptimeFixed || (2 + this.n) + " minutes";   /* a ticket can set how long it has really been up (since Sunday's power cut) */
    return x.sw;
  }
  /* what the far end of a link says about itself over LLDP (neighbour discovery): a switch, a router or an access point,
     its name, the port it's on, what it is, and its management address. Computers don't send it */
  lldpOf(end) {
    const x = end && this.d[end.dev]; if (!x || !this.on(end.dev)) return null;
    /* the address it advertises is the one it's configured with (worked out from its own links, two devices asking each other would never finish) */
    if (x.kind === "mswitch") { const sw = x.sw, v = sw.vlan1.ip && !sw.vlan1.shutdown ? sw.vlan1 : Object.keys(sw.svis || {}).map(function (k) { return sw.svis[k]; }).find(function (f) { return f.ip && !f.shutdown; }); return { id: sw.hostname, port: swPort(end.port), caps: "B", model: sw.model, addr: v ? v.ip : null }; }
    if (x.kind === "brouter") { if (!RT.lldpSends(x.sw, RT_IF(end.port))) return null; const r = x.sw, f = RT.allIfs(r).map(function (n) { return n.indexOf(".") > 0 ? r.subs[n] : r.ifs[n]; }).find(function (g) { return g && g.ip && !g.shutdown; }); return { id: r.hostname, port: RT_IF(end.port), caps: "R", model: r.model, addr: f ? f.ip : null }; }
    if (x.kind === "bap") { const f = x.ifaces && x.ifaces[0], a = f && f.lease; return { id: x.host || "AP-" + x.mac.replace(/[^0-9a-f]/gi, "").slice(-6).toUpperCase(), port: "eth0", caps: "W", model: "Ceiling access point", addr: a ? a.ip : null }; }
    return null;
  }
  /* what a managed switch's port says about trunking to the far end (DTP); null from anything else */
  dtpOf(end) { const x = end && this.d[end.dev]; if (x && x.dtp) return { mode: x.dtp, nonegotiate: false };   /* a device that negotiates a trunk itself (SB-15's laptop) */
    if (!x || x.kind !== "mswitch") return null; const p = x.sw.ports[swPort(end.port)]; return p && !p.routed ? { mode: p.mode || "dynamic auto", nonegotiate: !!p.nonegotiate } : null; }   /* a routed port never negotiates (Level 4) */
  /* the far end's port-channel settings, if it's a switch port in one (LACP's partner, Level 4) */
  chanOf(end) { const x = end && this.d[end.dev]; if (!x || x.kind !== "mswitch") return null; const p = x.sw.ports[swPort(end.port)]; return p && p.chan ? { group: p.chan.group, mode: p.chan.mode } : null; }
  /* what each of a managed switch's ports sees at the far end of its cable, worked out without changing anything
     (a check must never change the network: a saved job has to replay exactly) */
  switchLinks(id) {
    const x = this.d[id]; if (!x || x.kind !== "mswitch") return {};
    const L = {};
    /* each SFP slot with a module in it: what the switch reads from the module, and whether light comes back */
    Object.keys(x.sfp || {}).forEach(function (slot) {
      const M = SFP_MODULES[x.sfp[slot]], c = this.cableAt(id, slot); if (!M) return;
      const far = c ? (c.a.dev === id && c.a.port === slot ? c.b : c.a) : null, fd = far && this.d[far.dev], up = !!c && c.kind === "fibre" && this.fibreUp(c), mm = fd && fd.mac ? fd.mac.replace(/[^0-9a-f]/gi, "").toLowerCase() : "";
      L[swPort(slot)] = { lldp: up ? this.lldpOf(far) : null, dtp: this.dtpOf(far), chan: this.chanOf(far), farDev: far ? far.dev : null, module: M.show, pid: M.pid, unsupported: M.rate !== 1000, sfpMismatch: !up, light: up, mac: up ? mm.slice(0, 4) + "." + mm.slice(4, 8) + "." + mm.slice(8, 12) : null, speed: "1000", duplex: "full", max: 1000, tick: this.n };
    }, this);
    for (const c0 of this.cablesOf(id)) {
      if (c0.kind !== "cat6") continue;
      const c = this.panelEnd(c0) ? this.viaPanel(c0) : c0; if (!c) continue;   /* patched through a panel: the device beyond it */
      const me = c.a.dev === id ? c.a : c.b, far = c.a.dev === id ? c.b : c.a, fd = this.d[far.dev];
      if (!/^\d+$/.test(me.port) || !me.seated || !far.seated || fd.kind === "jack" || c.cond === "crushed" || (c.length || 0) > COPPER_MAX || !this.on(far.dev) || !this.pairsMeet(c)) continue;
      const m = (fd.kind === "router" || fd.kind === "rogue" ? fd.mac : fd.ifaces ? fd.ifaces[0].mac : "02-00-5e-" + (hash(far.dev) >>> 0).toString(16).padStart(8, "0").slice(0, 6).replace(/(..)(..)(..)/, "$1-$2-$3")).replace(/-/g, "");
      L["GigabitEthernet0/" + me.port] = { lldp: this.cableUp(c0) ? this.lldpOf(this.viaInjectorEnd(c0, id) || far) : null, dtp: this.dtpOf(far), chan: this.chanOf(far), farDev: far.dev, mac: m.slice(0, 4) + "." + m.slice(4, 8) + "." + m.slice(8, 12), speed: this.speedSetting(far), duplex: (fd.ifaces && fd.ifaces[0].cfg.duplex) || "auto", max: c.cond === "damaged" ? 100 : 1000, counters: c.counters || null, tick: this.n };
      if (fd.maxMbps) L["GigabitEthernet0/" + me.port].max = Math.min(L["GigabitEthernet0/" + me.port].max, fd.maxMbps);
      if (fd.dtp && this.cableUp(c0)) {   /* a device trunking with the port (SB-15): its frames come in on every VLAN the port carries, so the switch learns it in each */
        const n = "GigabitEthernet0/" + me.port, cr = carries(x.sw, n, { mode: fd.dtp, nonegotiate: false }), mac = L[n].mac;
        if (cr.mode === "trunk") L[n].macs = [cr.untagged].concat(cr.tagged).filter(function (v) { return v != null; }).map(function (v) { return { vlan: v, mac: mac }; });
      }
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
    if (r && this.on("router") && !r.wifi.off) {   /* off: a router whose Wi-Fi has been turned off (the small business's provider's router) */
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
    for (const id in this.d) {   /* a business access point (powered over its cable, its cable up): each of its networks on both radios, each on its own VLAN */
      const x = this.d[id]; if (x.kind !== "bap" || !this.on(id) || !this.cableUp(this.cableAt(id, "ETH"))) continue;
      (x.ssids || []).forEach(function (w, i) { const node = this.bapNode(id, w.vlan); let m = x.mac; for (let k = 0; k < i * 2; k++) m = bump(m);
        out.push({ id: id, node: node, room: this.net.rooms[id], band: 24, ch: x.ch24 || 6, ssid: w.ssid, mac: m, sec: w.sec, gen: w.gen || 1, vlan: w.vlan, guest: !!w.guest, psk: w.psk });
        out.push({ id: id, node: node, room: this.net.rooms[id], band: 5, ch: x.ch5 || 36, ssid: w.ssid, mac: bump(m), sec: w.sec, gen: w.gen || 1, vlan: w.vlan, guest: !!w.guest, psk: w.psk }); }, this);
    }
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
  signal(apRoom, room, band) { const t = (this.net.signal && this.net.signal[apRoom]) || SIGNAL[apRoom]; if (!t || !t[room]) return 0; return t[room][band === 24 ? 0 : 1]; }   /* a site with rooms of its own has its own table (net.signal) */
  /* a Wi-Fi client's link: which access point, band and channel, how strong, and how lossy */
  wifiLink(id) {
    const x = this.d[id]; if (!x || !x.ifaces || !this.on(id)) return null;
    const f = x.ifaces.find(function (i) { return i.type === "wifi"; }); if (!f || f.off) return null;   /* off: its Wi-Fi turned off (a phone on mobile data) */
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
    if (best.ap.sec !== "Open" && (!f.saved.passOk || (f.saved.gen || 1) !== (best.ap.gen || (this.d.router && this.d.router.wifi.gen) || 1))) return { connected: false, reason: "auth", ap: best.ap, signal: best.signal, room: room };   /* the password it has saved isn't the network's (any more) */
    const crowd = best.ap.band === 24 ? this.crowd(best.ap.ch, room) : 0;
    const weak = best.signal < 35 ? (35 - best.signal) / 60 : 0;
    const loss = Math.min(0.6, Math.max(0, (crowd - 0.35) * 0.55) + weak);
    const rate = best.ap.band === 5 ? (best.signal > 70 ? 866.7 : 400) : (loss > 0.1 ? 26 : best.signal > 60 ? 144.4 : 72.2);
    return { connected: true, ap: best.ap, band: best.ap.band, ch: best.ap.ch, signal: best.signal, loss: loss, crowd: crowd, rate: rate, room: room, sec: this.usesSec(f, best.ap.sec) };
  }

  /* ------------------------------------------------------------ layer 2: who can hear whom */
  /* a business access point's networks on layer 2: each VLAN its own node; untagged (no VLAN set) on the access point itself, with its own address */
  bapNode(id, vlan) { return vlan ? id + "#v" + vlan : id + "#n"; }
  nodeOf(dev, port) {
    const k = this.d[dev] && this.d[dev].kind;
    if (k === "bap") return this.bapNode(dev, null);
    if (k === "router" || k === "rogue") return port === "WAN" ? dev + ":wan" : dev + ":lan";
    if (k === "injector" && / 2$/.test(port)) return dev + ":2";   /* a dual injector's second pair: a path of its own, never bridged to the first */
    if (k === "patchpanel") return dev + ":" + String(port).replace(/R$/, "");   /* each port joins only its own front jack and its own run */
    return dev;
  }
  /* bridging devices pass frames between everything joined to them */
  edges() {
    const e = [], seen = new Set();
    this._stpNow = this.stpLoops() ? this.stpAll() : null;
    for (const c0 of this.net.cables) {
      if (c0.kind === "coax" || c0.kind === "console" || !this.cableUp(c0)) continue;
      let c = c0;
      if (c0.kind === "cat6" && this.panelEnd(c0)) c = this.viaPanel(c0);   /* patched through a panel: one link, end to end */
      if (c && [c.a, c.b].some(function (x) { return this.d[x.dev] && this.d[x.dev].kind === "injector"; }, this)) { c = this.viaInjector(c); if (!c) continue; }   /* through a PoE injector too: it passes every frame, tagged or not */
      if (c.via && c.via.some(function (id) { const k = this.cable(id); return !k || !this.cableUp(k); }, this)) continue;   /* a path is up only if every cable along it is: a shut switch port or a plug out on the far side of the injector stops it */
      if (c.via) { const k = c.via.slice().sort().join("+"); if (seen.has(k)) continue; seen.add(k); }
      this.linkEdges(c, e);
    }
    const m = this.d.mesh;
    if (m && this.meshLink().ok && this.meshLink().kind === "wifi") e.push(["mesh", "router:lan"]);   /* a wired link is a cable: it's in the edges already */
    for (const id in this.d) { const l = this.wifiLink(id); if (l && l.connected) e.push([id, l.ap.node]); }
    return e;
  }
  /* a VLAN's own node inside a managed switch: VLAN 1 is the switch itself, as it always was */
  vnode(dev, v) { return v === 1 ? dev : dev + ":v" + v; }
  /* the frames one link carries, VLAN by VLAN: untagged at each end (an access port's VLAN, a trunk's native VLAN,
     everything a computer or a router sends), and tagged where both ends carry the same VLAN. A trunk's native VLAN
     meeting an access port, or two different native VLANs, join two VLANs into one, as on the real thing */
  linkEdges(c, e) {
    const side = function (end, far) {
      const x = this.d[end.dev];
      if (x && x.kind === "mswitch") {
        if (x.sw.ports[swPort(end.port)] && x.sw.ports[swPort(end.port)].routed) return { u: this.l3Node(end.dev, swPort(end.port)), t: {} };   /* a layer 3 switch's routed port: untagged, to the port itself */
        if (x.sw.ports[swPort(end.port)] && x.sw.ports[swPort(end.port)].chan && chanState(Object.assign({}, x.sw, { links: this.switchLinks(end.dev) }), swPort(end.port)) === "s") return { u: null, t: {} };   /* suspended from its port-channel: it carries nothing */
        const fx = this.d[far.dev], fp = fx && fx.kind === "mswitch" ? fx.sw.ports[swPort(far.port)] : fx && fx.dtp ? { mode: fx.dtp, nonegotiate: false } : null, cr = carries(x.sw, swPort(end.port), fp && !fp.routed ? { mode: fp.mode, nonegotiate: fp.nonegotiate } : null), t = {};   /* the far end a switch port, or a device that negotiates a trunk itself (SB-15) */
        const blk = this.stpBlockedOn(end.dev, swPort(end.port)) || [];   /* spanning tree: an alternate port forwards nothing in its VLANs */
        cr.tagged.forEach(function (v) { if (blk.indexOf(v) < 0) t[v] = this.vnode(end.dev, v); }, this);
        return { u: cr.untagged != null && blk.indexOf(cr.untagged) < 0 ? this.vnode(end.dev, cr.untagged) : null, t: t };
      }
      if (x && x.kind === "bap") { const t = {}; (x.ssids || []).forEach(function (w) { if (w.vlan) t[w.vlan] = this.bapNode(end.dev, w.vlan); }, this); return { u: this.bapNode(end.dev, null), t: t }; }   /* its uplink: untagged for itself (and any network with no VLAN), each network's VLAN tagged */
      if (x && x.kind === "brouter") {   /* a routed port: untagged to the port itself (or its native subinterface), each subinterface's tag to that subinterface */
        const ph = RT_IF(end.port), r = x.sw; if (!ph || !r.ifs[ph] || r.ifs[ph].shutdown) return { u: null, t: {} };
        let u = this.rtNode(end.dev, ph); const t = {};
        Object.keys(r.subs).forEach(function (n) { const f = r.subs[n]; if (n.split(".")[0] !== ph || !f.vlan || f.shutdown) return; if (f.native) u = this.rtNode(end.dev, n); else t[f.vlan] = this.rtNode(end.dev, n); }, this);
        return { u: u, t: t };
      }
      if (x && x.dtp) {   /* a device that negotiates a trunk (SB-15): where the switch's port trunks with it, it's in every VLAN the port carries */
        const fx = this.d[far.dev], t = {}; if (!fx || fx.kind !== "mswitch") return { u: this.nodeOf(end.dev, end.port), t: t };
        const cr = carries(fx.sw, swPort(far.port), { mode: x.dtp, nonegotiate: false });
        if (cr.mode === "trunk") cr.tagged.forEach(function (v) { t[v] = end.dev + ":v" + v; });
        return { u: this.nodeOf(end.dev, end.port), t: t };
      }
      return { u: this.nodeOf(end.dev, end.port), t: {} };
    }.bind(this);
    const a = side(c.a, c.b), b = side(c.b, c.a), m = { ea: c.a, eb: c.b };   /* each edge keeps its cable's ends (the first node is c.a's): the port a frame comes into a switch by */
    if (a.u && b.u) e.push([a.u, b.u, m]);
    for (const v in a.t) if (b.t[v]) e.push([a.t[v], b.t[v], m]);
  }
  domain(node) {
    const e = this.edges(), seen = new Set([node]), q = [node];
    while (q.length) { const v = q.shift(); for (const [a, b] of e) { const w = a === v ? b : b === v ? a : null; if (w && !seen.has(w)) { seen.add(w); q.push(w); } } }
    return seen;
  }
  /* ------------------------------------------------------------ the switches' guards: DHCP snooping, ARP inspection, port security */
  /* a node inside a managed switch: which switch and which VLAN; null for anything else */
  swNode(node) { const i = node.indexOf(":v"), dev = i > 0 ? node.slice(0, i) : node, x = this.d[dev]; return x && x.kind === "mswitch" ? { dev: dev, vlan: i > 0 ? +node.slice(i + 2) : 1 } : null; }
  /* the way across layer 2 from one node to another: each switch it passes, the VLAN, and the port the frame comes in by */
  l2Path(from, to) {
    const e = this.edges(), prev = new Map([[from, null]]), q = [from];
    while (q.length) { const v = q.shift(); if (v === to) break; for (const ed of e) { const w = ed[0] === v ? ed[1] : ed[1] === v ? ed[0] : null; if (w && !prev.has(w)) { prev.set(w, { from: v, m: ed[2] || null }); q.push(w); } } }
    if (!prev.has(to)) return null;
    const out = []; let v = to;
    while (prev.get(v)) { const p = prev.get(v), s = this.swNode(v); if (s) { const end = p.m ? (p.m.ea.dev === s.dev ? p.m.ea : p.m.eb) : null; out.unshift({ dev: s.dev, vlan: s.vlan, port: end ? swPort(end.port) : null }); } v = p.from; }
    return out;
  }
  anySnoop() { for (const id in this.d) { const x = this.d[id]; if (x.kind === "mswitch" && x.sw.snoop && x.sw.snoop.on) return true; } return false; }
  anyDai() { for (const id in this.d) { const x = this.d[id]; if (x.kind === "mswitch" && x.sw.dai && x.sw.dai.vlans.length) return true; } return false; }
  /* a DHCP server's node by its key: a router's LAN side ("router"), its guest network ("router:guest"), a business router's interface ("rtr@...") */
  srvNode(key) { if (key.indexOf("@") > 0) { const rl = this.relayOf(key); if (rl) return rl.node; const [rid, n] = key.split("@"); return this.rtNode(rid, n); } return key === "router:guest" ? "router:guest" : key + ":lan"; }
  /* DHCP snooping: a server's answers are dropped at the first switch that snoops their VLAN and doesn't trust the port they
     come in by. Where, or null */
  snoopBlock(serverNode, clientNode) {
    const P = this.l2Path(serverNode, clientNode); if (!P) return null;
    for (const h of P) { const sw = this.d[h.dev].sw, S = sw.snoop; if (S && S.on && S.vlans.indexOf(h.vlan) >= 0 && h.port && !(sw.ports[h.port] && sw.ports[h.port].dtrust)) return h; }
    return null;
  }
  /* a lease seen through a snooping switch, from a client on a port it doesn't trust: the switch binds the client's address to
     that port (show ip dhcp snooping binding). Kept as the switch runs, never saved */
  snoopLearn(id, key, ip) {
    if (!this.anySnoop()) return;
    const P = this.l2Path(this.homeNode(id), this.srvNode(key)); if (!P) return;
    const mac = dotMac(this.macOf(id));
    for (const h of P) {
      const sw = this.d[h.dev].sw, S = sw.snoop; if (!S || !S.on || S.vlans.indexOf(h.vlan) < 0 || !h.port || (sw.ports[h.port] && sw.ports[h.port].dtrust)) continue;
      sw.snoopBind = (sw.snoopBind || []).filter(function (b) { return b.mac !== mac; }); sw.snoopBind.push({ mac: mac, ip: ip, vlan: h.vlan, port: h.port, lease: 86400 });
    }
  }
  /* Dynamic ARP Inspection: a device's ARP is dropped at the first switch inspecting its VLAN, on a port it doesn't trust, with no
     snooping binding there for the device's address. Where, or null */
  arpBlock(fromNode, toNode, mac, ip) {
    const P = this.l2Path(fromNode, toNode); if (!P) return null;
    const m = dotMac(mac);
    for (const h of P) {
      const sw = this.d[h.dev].sw; if (!sw.dai || sw.dai.vlans.indexOf(h.vlan) < 0 || !h.port || (sw.ports[h.port] && sw.ports[h.port].atrust)) continue;
      const snooped = !!(sw.snoop && sw.snoop.on && sw.snoop.vlans.indexOf(h.vlan) >= 0);
      if (!snooped || !(sw.snoopBind || []).some(function (b) { return b.mac === m && b.ip === ip && b.vlan === h.vlan && b.port === h.port; })) return Object.assign({ who: ip }, h);
    }
    return null;
  }
  /* the node a device answers ARP for an address on */
  arpNode(o, ip, dom) {
    const x = this.d[o]; if (!x) return null;
    if (x.kind === "router" || x.kind === "rogue") return dom.has(o + ":lan") ? o + ":lan" : dom.has("router:guest") ? "router:guest" : null;
    if (x.kind === "brouter") { const n = this.rtIfFor(o, ip, dom); return n ? this.rtNode(o, n) : null; }
    if (x.kind === "mswitch") { const m = this.mgmtAddrs(o).find(function (a) { return a.ip === ip; }); return m ? this.vnode(o, m.vlan) : null; }
    if (x.kind === "bap") return this.bapNode(o, null);
    return this.nodeOf(o, "LAN");
  }
  /* an ARP exchange between a peer and the device answering for an address, both ways: the request reaching it, the answer coming back */
  arpBlocked(peerNode, peerMac, peerIp, o, ip, dom) {
    if (!this.anyDai()) return null;
    const on = this.arpNode(o, ip, dom); if (!on) return null;
    return this.arpBlock(peerNode, on, peerMac, peerIp) || this.arpBlock(on, peerNode, this.macOf(o), ip);
  }
  /* what's behind a switch port: every device whose frames come into the switch by it, with the VLAN they come in on (null without a link) */
  behindPort(id, n) {
    const k = +n.split("/")[1], p = k > 24 ? "SFP" + (k - 24) : String(k), c0 = this.cableAt(id, p); if (!c0 || !this.cableUp(c0)) return null;
    const e = this.edges(), own = function (v) { const s = this.swNode(v); return !!s && s.dev === id; }.bind(this), seen = new Set(), out = [], macs = new Set();
    for (const ed of e) {
      const m = ed[2]; if (!m) continue;
      const mine = m.ea.dev === id && m.ea.port === p ? 0 : m.eb.dev === id && m.eb.port === p ? 1 : -1; if (mine < 0) continue;
      const vlan = (this.swNode(mine === 0 ? ed[0] : ed[1]) || { vlan: 1 }).vlan, q = [mine === 0 ? ed[1] : ed[0]];
      while (q.length) {
        const v = q.shift(); if (seen.has(v) || own(v)) continue; seen.add(v);
        const dev = v.split(/[:#@]/)[0], x = this.d[dev];
        if (x && this.on(dev)) { const mac = x.kind === "brouter" || x.kind === "router" || x.kind === "rogue" || x.kind === "mswitch" || (x.ifaces && this.hasLink(dev)) ? dotMac(this.macOf(dev)) : null; if (mac && !macs.has(mac)) { macs.add(mac); out.push({ mac: mac, vlan: vlan, dev: dev }); } }
        for (const f of e) { const w = f[0] === v ? f[1] : f[1] === v ? f[0] : null; if (w && !seen.has(w)) q.push(w); }
      }
    }
    return out;
  }
  /* port security after each change: on each secured port that's up, the addresses behind it are learned (stuck into the running
     configuration when sticky) up to its limit; one more is a violation, which shuts the port (err-disabled) in shutdown mode. A
     port that loses its link forgets what it learned without sticking */
  portSecurity() {
    for (const id in this.d) {
      const x = this.d[id]; if (x.kind !== "mswitch" || !this.on(id)) continue;
      const sw = x.sw;
      for (const n in sw.ports) {
        const P = sw.ports[n].ps; if (!P || !P.on) continue;
        const run = psRunOf(sw, n); if (run.err) continue;
        const macs = this.behindPort(id, n); if (!macs) { run.dyn = []; continue; }
        run.seen = run.seen || [];
        for (const m of macs) {
          if (P.macs.some(function (k) { return k.mac === m.mac; }) || run.dyn.some(function (k) { return k.mac === m.mac; })) continue;
          if (P.macs.length + run.dyn.length < P.max) { if (P.sticky) P.macs.push({ mac: m.mac, sticky: true }); else run.dyn.push({ mac: m.mac, vlan: m.vlan }); continue; }
          if (run.seen.indexOf(m.mac) < 0) { run.viol++; run.seen.push(m.mac); }
          run.last = { mac: m.mac, vlan: m.vlan };
          if (P.viol === "shutdown") { run.err = true; break; }
        }
      }
    }
  }
  /* bindings go with snooping: turned off, or a VLAN taken out of it, and the switch forgets them */
  snoopTidy() { for (const id in this.d) { const x = this.d[id]; if (x.kind !== "mswitch" || !x.sw.snoopBind) continue; const S = x.sw.snoop; x.sw.snoopBind = S && S.on ? x.sw.snoopBind.filter(function (b) { return S.vlans.indexOf(b.vlan) >= 0; }) : []; } }
  /* the node a device's network interface sits on */
  homeNode(id) { const x = this.d[id]; if (x && x.kind === "mswitch") { const a = this.addr(id); return this.vnode(id, a && a.vlan ? a.vlan : 1); } return this.nodeOf(id, "LAN"); }   /* a managed switch: the VLAN its management address is on */
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
    if (x.kind === "mswitch") {   /* its own address: VLAN 1's as it always was, or its interface on another VLAN (the one its default gateway is on, if there's a choice) */
      if (!this.on(id)) return null; const A = this.mgmtAddrs(id); if (!A.length) return null;
      const g = x.sw.gateway, pick = A.find(function (o) { return g && sameSubnet(o.ip, g, o.mask); }) || A[0];
      return { ip: pick.ip, mask: pick.mask, gw: g || null, dns: [], kind: "static", vlan: pick.vlan };
    }
    if (!x.ifaces || !this.hasLink(id)) return null;
    const f = x.ifaces[0];
    let a = null;
    if (f.cfg.mode === "static") a = { ip: f.cfg.ip, mask: f.cfg.mask, gw: f.cfg.gw || null, dns: (f.cfg.dns || []).filter(Boolean), kind: "static" };
    else if (f.lease) a = { ip: f.lease.ip, mask: f.lease.mask, gw: f.lease.gw, dns: f.lease.dns.slice(), kind: "dhcp", server: f.lease.server, obtained: f.lease.obtained };
    else if (f.apipa) a = { ip: f.apipa, mask: "255.255.0.0", gw: null, dns: [], kind: "apipa" };
    if (a && f.cfg.dnsMode === "static" && f.cfg.mode !== "static") a.dns = (f.cfg.dns || []).filter(Boolean);
    return a;
  }
  /* a managed switch's own addresses, worked out from its cables as they are now without storing anything (a check must
     never change the network). Only an interface on a VLAN other than 1 needs its links: it's up only while a port carries it */
  mgmtAddrs(id) {
    const sw = this.d[id].sw, more = Object.keys(sw.svis || {}).some(function (v) { return sw.svis[v].ip; });
    return ownAddrs(more ? Object.assign({}, sw, { links: this.switchLinks(id) }) : sw);
  }
  /* every device in a broadcast domain that answers ARP for an address */
  owners(ip, dom) {
    const out = [];
    for (const id in this.d) {
      const x = this.d[id];
      if (x.kind === "router" || x.kind === "rogue") { if ((dom.has(id + ":lan") && this.on(id) && x.lan.ip === ip) || (id === "router" && this.guestOn() && dom.has("router:guest") && x.guest.lan.ip === ip)) out.push(id); continue; }
      if (x.kind === "brouter") { if (this.on(id) && this.rtIfFor(id, ip, dom)) out.push(id); continue; }
      if (x.kind === "mswitch") { if (this.on(id)) { if (this.mgmtAddrs(id).some(function (o) { return o.ip === ip && dom.has(this.vnode(id, o.vlan)); }, this) || this.routedAddrs(id).some(function (o) { return o.ip === ip && dom.has(o.node); }) || this.hsrpVips(id).some(function (o) { return o.vip === ip && dom.has(o.node); })) out.push(id); } continue; }
      if (!x.ifaces) continue;
      if (!dom.has(x.kind === "bap" ? this.bapNode(id, null) : id)) continue;   /* a business access point's own address is on its untagged side */
      const a = this.addr(id); if (a && a.ip === ip) out.push(id);
    }
    return out;
  }
  macOf(id) { const x = this.d[id]; if (x.kind === "router" || x.kind === "rogue" || x.kind === "mswitch") return x.mac; if (x.kind === "brouter") return x.sw.mac.replace(/[^0-9a-f]/gi, "").replace(/(..)(?!$)/g, "$1-"); return x.ifaces[0].mac; }
  ttlOf(id) { const k = this.d[id].kind; return k === "pc" || k === "laptop" ? 128 : k === "mswitch" || k === "brouter" ? 255 : 64; }

  /* DHCP servers a client's request reaches */
  dhcpServers(id, raw) {   /* raw: before any snooping switch drops their answers */
    const dom = this.domain(this.homeNode(id)), out = [];
    for (const sid in this.d) {
      const s = this.d[sid];
      if ((s.kind === "router" || s.kind === "rogue") && this.on(sid) && s.dhcp && s.dhcp.on && dom.has(sid + ":lan")) out.push(sid);
    }
    if (this.guestOn() && dom.has("router:guest")) out.push("router:guest");   /* the guest network has its own pool, on its own subnet */
    for (const rid in this.d) {   /* the business router: each interface on this broadcast domain with a pool for its network ("rtr@GigabitEthernet0/0.10") */
      if (this.d[rid].kind !== "brouter" || !this.on(rid)) continue;
      const R = this.rtView(rid), live = this.rtLive(rid);
      /* an access list in on the interface sees the DISCOVER too (from 0.0.0.0 to everyone, UDP 68 to 67): one that doesn't permit it
         leaves the clients on 169.254, as on the real thing. Checked, never counted: a check changes nothing */
      const discover = { proto: "udp", src: "0.0.0.0", dst: "255.255.255.255", sport: 68, port: 67 };
      RT.allIfs(R).forEach(function (n) { const a = RT.addrOf(R, n, live), f = n.indexOf(".") > 0 ? R.subs[n] : R.ifs[n]; if (a && RT.rtStatus(R, n)[1] === "up" && dom.has(this.rtNode(rid, n)) && RT.poolFor(R, a.ip, a.mask) && (!f.aclIn || RT.aclVerdict(R, f.aclIn, discover).permit)) out.push(rid + "@" + n); }, this);
    }
    out.push.apply(out, this.relays(dom));
    if (raw || !this.anySnoop()) return out;
    const me = this.homeNode(id);
    return out.filter(function (k) { return !this.snoopBlock(this.srvNode(k), me); }, this);   /* an answer coming in by a port a snooping switch doesn't trust never reaches the client */
  }
  /* DHCP relay (ip helper-address): a layer 3 switch routing, with an interface up on the client's broadcast domain that has helpers,
     sends the request on to each helper as a unicast from its own way out, the relaying interface's address (giaddr) in it. A business
     router at a helper's address answers from its pool for giaddr's network, if the request reaches it and its answer can be routed
     back to giaddr. Keys "rtr@relay|switch|interface|helper". Worked out, never stored */
  relays(dom) {
    const out = [];
    for (const sid in this.d) {
      if (!this.routes3(sid)) continue;
      const V = this.l3View(sid), sw = this.d[sid].sw;
      l3Ifs(V).forEach(function (f) {
        const m = /^Vlan(\d+)$/.exec(f.name), rec = m ? (+m[1] === 1 ? sw.vlan1 : sw.svis[m[1]]) : sw.ports[f.name];
        if (!f.up || !f.ip || !rec || !rec.helpers || !dom.has(this.l3Node(sid, f.name))) return;
        rec.helpers.forEach(function (h) {
          const there = this.routeFromL3(sid, h, { proto: "udp", port: 67, sport: 67 }), rid = there && !there.fail && (there.local || there.routed) && there.owner ? there.owner.find(function (o) { return this.d[o].kind === "brouter"; }, this) : null;
          if (!rid || !this.on(rid)) return;
          const R = this.rtView(rid), live = this.rtLive(rid), at = RT.allIfs(R).find(function (n) { const x = RT.addrOf(R, n, live); return x && x.ip === h && RT.rtStatus(R, n)[1] === "up"; });
          if (!at || !RT.poolFor(R, f.ip, f.mask)) return;
          const back = this.routeFromRouter(rid, f.ip, { proto: "udp", port: 67, sport: 67 });
          if (back.fail || !(back.local || back.routed) || !(back.owner || []).some(function (o) { return o === sid; })) return;
          out.push(rid + "@relay|" + sid + "|" + f.name + "|" + h);
        }, this);
      }, this);
    }
    return out;
  }
  /* a relayed key's parts: the router, the relaying switch and interface (with its address now), the helper address */
  relayOf(key) {
    const [rid, rest] = key.split("@"); if (!rest || rest.indexOf("relay|") !== 0) return null;
    const [, sid, ifn, h] = rest.split("|"), f = l3Ifs(this.l3View(sid)).find(function (k) { return k.name === ifn; });
    return { rid: rid, sid: sid, ifn: ifn, helper: h, giaddr: f ? { ip: f.ip, mask: f.mask } : null, node: this.l3Node(sid, ifn) };
  }
  /* the servers a client's request reaches whose answers a snooping switch drops: where (for the checks' causes) */
  snoopDrops(id) {
    if (!this.anySnoop()) return [];
    const all = this.dhcpServers(id, true), me = this.homeNode(id); return all.map(function (k) { const b = this.snoopBlock(this.srvNode(k), me); return b ? Object.assign({ server: k }, b) : null; }, this).filter(Boolean);
  }
  /* the business router's offer from the pool for an interface's network: the client's own address back if it's still free,
     else the lowest free one. Like the real server it checks an address isn't answering first: one in use by a device set by
     hand (an address nobody excluded) goes on its conflict list and is skipped */
  rtOffer(key, mac) {
    const rl = this.relayOf(key), [rid, n] = key.split("@"), x = this.d[rid], R = x.sw, a = rl ? rl.giaddr : RT.addrOf(R, n, this.rtLive(rid)), P = a && RT.poolFor(R, a.ip, a.mask); if (!P) return null;   /* relayed: the pool for the relaying interface's network */
    x.leases = x.leases || []; x.conflicts = x.conflicts || [];
    const taken = new Set(x.leases.filter(function (l) { return l.mac !== mac; }).map(function (l) { return l.ip; })), dom = this.domain(rl ? rl.node : this.rtNode(rid, n));
    /* a manual binding for this client (a reservation, matched on the client identifier it sends): its address and nothing else,
       unless something else already answers at it */
    const M = RT.manualFor(R, RT.clientIdOf(mac), a.ip, a.mask);
    if (M) {
      const o = this.owners(M.host, dom).filter(function (d) { const k = this.d[d]; return d !== rid && !(k.ifaces && k.ifaces[0].mac === mac); }, this);
      if (o.length || taken.has(M.host) || M.host === a.ip) { if (!x.conflicts.some(function (c) { return c.ip === M.host; })) x.conflicts.push({ ip: M.host, how: "Ping" }); return null; }
      return { ip: M.host, pool: M };
    }
    const free = RT.poolAddrs(R, P.name).filter(function (ip) { return !taken.has(ip) && ip !== a.ip; });
    const mine = x.leases.find(function (l) { return l.mac === mac && l.pool === P.name; });
    if (mine && free.indexOf(mine.ip) >= 0) return { ip: mine.ip, pool: P };
    for (const ip of free) {
      const o = this.owners(ip, dom).filter(function (d) { const k = this.d[d]; return d !== rid && !(k.ifaces && k.ifaces[0].mac === mac); }, this);
      if (o.length) { if (!x.conflicts.some(function (c) { return c.ip === ip; })) x.conflicts.push({ ip: ip, how: "Ping" }); continue; }
      return { ip: ip, pool: P };
    }
    return null;
  }
  /* a DHCP server by its key: a router's LAN side ("router", "rogue") or the router's guest network ("router:guest") */
  srv(key) { if (key.indexOf("@") > 0) return this.d[key.split("@")[0]]; return key === "router:guest" ? this.d.router.guest : this.d[key]; }
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
    for (const sid of order) {
      if (sid.indexOf("@") > 0) { const o = this.rtOffer(sid, f.mac); if (o) { ans = o.ip; server = sid; this.rtLease(sid, x, f, o); this.snoopLearn(id, sid, o.ip); break; } continue; }
      const ip = this.offer(sid, f.mac, f.lease && f.lease.server === this.srv(sid).lan.ip ? f.lease.ip : null); if (ip) { ans = ip; server = sid; break; }
    }
    if (!ans) {
      if (!f.apipa) f.apipa = "169.254." + (1 + hash(f.mac) % 254) + "." + (1 + hash(f.mac + "x") % 254);
      f.lease = null;
      return { result: servers.length ? "no-offer" : "timeout", servers: servers };
    }
    if (server.indexOf("@") > 0) { f.apipa = null; return { result: "lease", ip: ans, server: server }; }
    const s = this.srv(server);
    s.leases = s.leases.filter(function (l) { return l.mac !== f.mac; });
    s.leases.push({ mac: f.mac, ip: ans, name: x.label, host: x.host || x.label.replace(/\s+/g, "-").toUpperCase() });
    const dns = s.dhcp.dnsMode === "router" ? [s.lan.ip] : s.dhcp.dns.filter(Boolean);
    f.lease = { ip: ans, mask: s.lan.mask, gw: s.lan.ip, dns: dns, server: s.lan.ip, obtained: this.n, hours: s.dhcp.leaseH };
    f.apipa = null; this.snoopLearn(id, server, ans);
    return { result: "lease", ip: ans, server: server };
  }
  /* a lease from the business router: what its pool says (its mask, its default router, its DNS servers), right or wrong */
  rtLease(key, x, f, o) {
    const rl = this.relayOf(key), [rid, n] = key.split("@"), r = this.d[rid], a = rl ? { ip: rl.helper } : RT.addrOf(r.sw, n, this.rtLive(rid)), P = o.pool;   /* relayed: the server is the helper address */
    r.leases = r.leases.filter(function (l) { return l.mac !== f.mac; });
    r.leases.push({ mac: f.mac, ip: o.ip, pool: P.name, name: x.label, host: x.host || x.label.replace(/\s+/g, "-").toUpperCase(), manual: !!P.manual });
    f.lease = { ip: o.ip, mask: P.mask, gw: P.router[0] || null, dns: P.dns.slice(), server: a.ip, obtained: this.n, hours: P.lease === "infinite" ? 0 : P.lease[0] * 24 + (P.lease[1] || 0), domain: P.domain || null };
  }
  release(id) {
    const f = this.d[id].ifaces[0], m = dotMac(f.mac);
    for (const sid in this.d) if (this.d[sid].kind === "mswitch" && this.d[sid].sw.snoopBind) this.d[sid].sw.snoopBind = this.d[sid].sw.snoopBind.filter(function (b) { return b.mac !== m; });
    for (const rid in this.d) if (this.d[rid].kind === "brouter" && this.d[rid].leases) this.d[rid].leases = this.d[rid].leases.filter(function (l) { return l.mac !== f.mac; });
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
    this.snoopTidy(); this.portSecurity(); this.bpduGuard(); this.hsrpTick();
    /* a DHCP pool still being typed (a console in its dhcp-config mode): a device asks now and then, not on every line, so it doesn't
       catch the pool half made (its network typed, its default-router not yet: a lease with no gateway) */
    const cli = this.cli || {}, poolOpen = Object.keys(cli).some(function (k) { const st = cli[k]; return !!(st && st.S && st.S.mode === "dhcp"); });
    for (const id in this.d) {
      const x = this.d[id]; if (!x.ifaces || x.ifaces[0].cfg.mode === "static") continue;
      const now = this.hasLink(id), f = x.ifaces[0];
      if (now && !before[id]) this.dhcp(id, "link");
      /* build mode: a device that gave itself 169.254 keeps asking (Windows tries every few minutes), so cabling the
         router in after the switch still gets everyone an address. The tickets keep the moment frozen. */
      else if (now && this.net.extra.build && f.apipa && !f.lease && !poolOpen && this.dhcpServers(id).length) this.dhcp(id, "retry");
    }
  }
  links() { const o = {}; for (const id in this.d) if (this.d[id].ifaces) o[id] = this.hasLink(id); return o; }

  /* ------------------------------------------------------------ reaching an address */
  /* the path a packet from a device takes to an address, without sending it */
  route(id, dst, proto, oneWay) {
    if (this.d[id] && this.d[id].kind === "brouter") return this.routeFromRouter(id, dst, proto);
    if (this.routes3(id)) return this.routeFromL3(id, dst, proto);
    const a = this.addr(id);
    if (!a) return { fail: "no-link" };
    if (isLoopback(dst)) return { local: true, owner: [id], hops: [] };
    const dom = this.domain(this.homeNode(id));
    let next = null;
    if (sameSubnet(a.ip, dst, a.mask)) next = dst;
    else if (a.gw && sameSubnet(a.ip, a.gw, a.mask)) next = a.gw;
    else return { fail: "no-route", addr: a };
    let owners = this.owners(next, dom);
    if (!owners.length) return { fail: next === dst ? "host-unreachable" : "gateway-unreachable", addr: a, next: next };
    if (this.anyDai()) {   /* an ARP request or its answer dropped by a switch inspecting ARP: as if nobody answered */
      const me = this.homeNode(id), mm = this.macOf(id); let blk = null;
      owners = owners.filter(function (o) { const b = this.arpBlocked(me, mm, a.ip, o, next, dom); if (b) blk = blk || b; return !b; }, this);
      if (!owners.length) return { fail: next === dst ? "host-unreachable" : "gateway-unreachable", addr: a, next: next, dai: blk };
    }
    if (next === dst) {
      /* the reply has to come back too: a device whose mask puts the sender on another network sends its
         reply to its gateway, and if that gateway isn't on its own network either, the reply never leaves */
      const back = owners.filter((o) => this.canReply(o, a.ip, dom));
      if (!back.length) return { fail: "no-reply", owner: owners, addr: a, next: next };
      return { local: true, owner: back, addr: a, next: next };
    }
    /* through a router */
    const gwId = owners[0], g = this.d[gwId];
    if (g.kind === "brouter") return this.routeBR(id, a, dst, gwId, dom, proto);
    if (this.routes3(gwId)) return this.routeL3(id, a, dst, gwId, dom, proto, oneWay);
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
    if (this.routes3(id)) return !!l3Route(this.l3View(id), to, this.learned(id));   /* a switch that routes replies by its own table */
    if (x.kind === "router" || x.kind === "rogue" || x.kind === "brouter" || (!x.ifaces && x.kind !== "mswitch")) return true;
    const b = this.addr(id); if (!b) return false;
    if (sameSubnet(b.ip, to, b.mask)) return true;
    return !!(b.gw && sameSubnet(b.ip, b.gw, b.mask) && this.owners(b.gw, dom).some((g) => this.d[g].kind === "router" || this.d[g].kind === "rogue" || this.d[g].kind === "brouter" || this.routes3(g)));   /* the router hands it back across the LAN */
  }
  /* the quality of the first hop: Wi-Fi loss and delay */
  hop(id) {
    const l = this.wifiLink(id); if (l && l.connected) return { loss: l.loss, base: l.band === 5 ? 3 : 5 };
    return this.mismatched(id) ? { loss: 0.3, base: 1 } : { loss: 0, base: 0 };   /* a duplex mismatch: frames lost to late collisions on the half-duplex end */
  }
  /* is this device on a managed switch port whose duplex disagrees with its own (the link up, the two ends running differently)? */
  mismatched(id) {
    const c = this.cablesOf(id).map(function (k) { return k.kind === "cat6" && this.panelEnd(k) ? this.viaPanel(k) : k; }, this).find(function (k) { return k && k.kind === "cat6" && (k.a.dev === "msw" || k.b.dev === "msw"); }); if (!c || !this.cableUp(c)) return false;
    const e = c.a.dev === "msw" ? c.a : c.b; if (!/^\d+$/.test(e.port)) return false;
    const n = swPort(e.port), p = this.d.msw.sw.ports[n], lk = this.switchLinks("msw")[n];
    return !!(p && lk && duplexEnds(p, lk).mismatch);
  }

  /* ------------------------------------------------------------ spanning tree (Level 4, the campus: stp.js) */
  /* switch ports cabled to each other, with their links up: "dev|GigabitEthernet0/23" to { dev, port } */
  switchPeers() {
    const P = {};
    for (const c0 of this.net.cables) {
      if (c0.kind !== "cat6" && c0.kind !== "fibre") continue;
      const c = c0.kind === "cat6" && this.panelEnd(c0) ? this.viaPanel(c0) : c0; if (!c || !this.cableUp(c0)) continue;
      const A = this.d[c.a.dev], Bd = this.d[c.b.dev]; if (!A || !Bd || A.kind !== "mswitch" || Bd.kind !== "mswitch" || !this.on(c.a.dev) || !this.on(c.b.dev)) continue;
      const pa = swPort(c.a.port), pb = swPort(c.b.port); P[c.a.dev + "|" + pa] = { dev: c.b.dev, port: pb }; P[c.b.dev + "|" + pb] = { dev: c.a.dev, port: pa };
    }
    return P;
  }
  /* could the switches make a loop at all (more links than a tree has, in any group of them)? If not, nothing ever blocks, and
     the office's and the business's networks are worked out as they always were */
  stpLoops() {
    /* a loop needs two links between switches at least: count the cables that could be one (a switch at one end, a switch or a patch
       panel at the other) before working anything out, so a network with one trunk costs nothing */
    let k = 0; for (const c of this.net.cables) { const A = this.d[c.a.dev], Bd = this.d[c.b.dev]; if (!A || !Bd) continue; const sa = A.kind === "mswitch", sb = Bd.kind === "mswitch"; if ((sa && (sb || Bd.kind === "patchpanel")) || (sb && A.kind === "patchpanel")) k++; }
    if (k < 2) return false;
    const P = this.switchPeers(), adj = {}, seen = {};
    Object.keys(P).forEach(function (k) { const a = k.split("|")[0], b = P[k].dev; (adj[a] = adj[a] || []).push(b); });
    for (const s0 in adj) {
      if (seen[s0]) continue; let nodes = 0, ends = 0; const q = [s0]; seen[s0] = true;
      while (q.length) { const v = q.shift(); nodes++; ends += adj[v].length; adj[v].forEach(function (w) { if (!seen[w]) { seen[w] = true; q.push(w); } }); }
      if (ends / 2 >= nodes) return true;
    }
    return false;
  }
  stpPrio(sw, v) { return sw.stp && sw.stp.prio && sw.stp.prio[v] != null ? sw.stp.prio[v] : 32768; }
  /* one VLAN's spanning tree: every switch with the VLAN, every port of theirs that's up and carries it (a bundled port-channel
     once), each with its cost, number, far end and whether it's an edge port. Worked out, never stored */
  stpVlan(v, peers, views) {
    const sws = {}, ports = [], byLp = {};
    const lpOf = function (sw, view, n) { const p = sw.ports[n]; return p.chan && chanState(view, n) === "P" ? "Po" + p.chan.group : n; };
    for (const id in this.d) {
      const x = this.d[id]; if (x.kind !== "mswitch" || !this.on(id) || !x.sw.vlans || !x.sw.vlans[v]) continue;
      const view = views[id]; sws[id] = { mac: x.sw.mac || x.mac, prio: this.stpPrio(x.sw, v) };
      SW_PORTS.forEach(function (n) {
        const p = x.sw.ports[n]; if (!p || p.routed || !portUp(view, n)) return;
        const cs = p.chan ? chanState(view, n) : null; if (cs === "s" || cs === "D") return;
        const cr = carries(view, n); if (cr.untagged !== v && cr.tagged.indexOf(v) < 0) return;
        const lp = lpOf(x.sw, view, n), l = view.links[n] || {}, mbps = p.speed !== "auto" ? +p.speed : Math.min(+(l.max || 1000), l.speed && l.speed !== "auto" ? +l.speed : 1000);
        const peer = peers[id + "|" + n]; let far = null;
        if (peer && this.d[peer.dev].sw.vlans && this.d[peer.dev].sw.vlans[v]) { const fv = views[peer.dev], fp = this.d[peer.dev].sw.ports[peer.port], fc = carries(fv, peer.port); if (fp && !fp.routed && (fc.untagged === v || fc.tagged.indexOf(v) >= 0)) far = { sw: peer.dev, lp: lpOf(this.d[peer.dev].sw, fv, peer.port) }; }
        const key = id + " " + lp;
        if (byLp[key]) { byLp[key].mbps += mbps; byLp[key].members++; return; }
        byLp[key] = { sw: id, lp: lp, num: lp.indexOf("Po") === 0 ? 100 + +lp.slice(2) : +n.split("/")[1], mbps: mbps, members: 1, far: far, edge: !!(p.stp && p.stp.portfast), fixed: p.stp && p.stp.cost };
        ports.push(byLp[key]);
      }, this);
    }
    ports.forEach(function (q) { q.cost = q.fixed || stpCost(q.mbps / (q.members || 1), q.lp.indexOf("Po") === 0 ? q.members : 1); });
    return { sws: sws, ports: ports, result: stpSolve(sws, ports, v) };
  }
  /* every VLAN's, kept until a switch or a cable changes */
  stpAll() {
    const ids = Object.keys(this.d).filter(function (id) { return this.d[id].kind === "mswitch"; }, this);
    const sig = JSON.stringify(ids.map(function (id) { const x = this.d[id]; return [id, this.on(id), x.sw.ports, x.sw.pcs, x.sw.stp, x.sw.vlans, x.sw.psRun, x.sfp]; }, this)) + JSON.stringify(this.net.cables);
    if (this._stp && this._stp.sig === sig) return this._stp.all;
    const peers = this.switchPeers(), views = {}, vl = {};
    ids.forEach(function (id) { if (this.on(id)) { views[id] = Object.assign({}, this.d[id].sw, { links: this.switchLinks(id) }); Object.keys(this.d[id].sw.vlans || {}).forEach(function (k) { vl[k] = true; }); } }, this);
    const all = {}; Object.keys(vl).map(Number).forEach(function (v) { all[v] = this.stpVlan(v, peers, views); }, this);
    this._stp = { sig: sig, all: all }; return all;
  }
  /* the VLANs a switch port doesn't forward (an alternate port, blocking), only where a loop is possible at all */
  stpBlockedOn(id, n) {
    if (!this._stpNow) return null;
    const x = this.d[id], p = x.sw.ports[n], lp = p && p.chan ? "Po" + p.chan.group : n, out = [];
    for (const v in this._stpNow) { const r = this._stpNow[v].result.roles[id + " " + lp] || this._stpNow[v].result.roles[id + " " + n]; if (r && r.sts === "BLK") out.push(+v); }
    return out;
  }
  /* BPDU guard after each change: a port with it on that hears another switch is shut down (err-disabled), until someone shuts it
     and opens it again */
  bpduGuard() {
    let peers = null;
    for (const id in this.d) {
      const x = this.d[id]; if (x.kind !== "mswitch" || !this.on(id)) continue;
      for (const n in x.sw.ports) {
        const p = x.sw.ports[n]; if (!p.stp || !p.stp.bpduguard || p.shutdown) continue;
        const run = psRunOf(x.sw, n); if (run.err) continue;
        peers = peers || this.switchPeers(); const peer = peers[id + "|" + n]; if (!peer) continue;
        const fp = this.d[peer.dev].sw.ports[peer.port]; if (!fp || fp.routed || fp.shutdown) continue;
        run.err = true; run.why = "bpduguard";
      }
    }
  }
  /* what a switch's command line asks the network: its spanning tree for a VLAN, its routing protocol's routes */
  swLive(id) {
    const self = this;
    return function (k, v) {
      if (k === "stp") { const all = self.stpAll(); return all[v] ? { result: all[v].result, ports: all[v].ports.filter(function (q) { return q.sw === id; }), me: id } : null; }
      if (k === "stpvlans") return Object.keys(self.stpAll()).map(Number).filter(function (w) { return self.d[id].sw.vlans[w]; });
      if (k === "learned") return self.learned(id);
      if (k === "hsrp") {
        const S = self.hsrpState(), out = [];
        Object.keys(S).forEach(function (key) { const q = S[key]; q.members.filter(function (m) { return m.id === id; }).forEach(function (m) {
          const state = !m.up ? "Init" : q.active && q.active.id === id && q.active.iface === m.iface ? "Active" : q.standby && q.standby.id === id ? "Standby" : "Listen";
          out.push({ iface: m.iface, grp: m.grp, pri: m.pri, preempt: m.preempt, state: state, active: q.active ? (q.active.id === id ? "local" : q.active.ip) : "unknown", standby: q.standby ? (q.standby.id === id ? "local" : q.standby.ip) : "unknown", vip: q.vip || m.vip });
        }); });
        return out.sort(function (p, q2) { return p.iface < q2.iface ? -1 : p.iface > q2.iface ? 1 : p.grp - q2.grp; });
      }
      if (k === "ospf") {
        const R = self.ospfAll(), me = R.routers[id]; if (!me) return null;
        const nb = R.nbrs[id] || [];
        return { rid: me.rid, nbrs: nb, ifs: me.ifs.map(function (f) { const on = nb.filter(function (q) { return q.iface === f.name; }); return { name: f.name, ip: f.ip, mask: f.mask, area: f.area, cost: f.cost, passive: f.passive, role: R.roles[id + " " + f.name] || null, nbrs: on.length, full: on.filter(function (q) { return /^FULL/.test(q.state); }).length }; }) };
      }
      return null;
    };
  }

  /* ------------------------------------------------------------ the layer 3 switches (Level 4, the campus: swcli.js, l3.js) */
  /* a switch that routes: a layer 3 one, switched on, with "ip routing" */
  routes3(id) { const x = this.d[id]; return !!x && x.kind === "mswitch" && !!x.sw && x.sw.os === "l3switch" && !!x.sw.routing && this.on(id); }
  /* the node one of its interfaces is on: a VLAN interface is its VLAN inside the switch, a routed port a node of its own */
  l3Node(id, n) { const m = /^Vlan(\d+)$/.exec(n); return m ? this.vnode(id, +m[1]) : id + "@" + n; }
  /* the switch as it runs now, its links fresh (a copy: a check changes nothing) */
  l3View(id) { return Object.assign({}, this.d[id].sw, { links: this.switchLinks(id) }); }
  /* its routed ports' addresses (up, with an address), each with its node */
  routedAddrs(id) {
    const x = this.d[id]; if (!x.sw || x.sw.os !== "l3switch" || !Object.keys(x.sw.ports).some(function (n) { return x.sw.ports[n].routed; })) return [];
    return l3Ifs(this.l3View(id)).filter(function (f) { return f.up && f.ip && !/^Vlan/.test(f.name); }).map(function (f) { return { ip: f.ip, mask: f.mask, node: this.l3Node(id, f.name), iface: f.name }; }, this);
  }
  /* routes OSPF worked out for it (each switch that routes, with "router ospf") */
  learned(id) { const x = this.d[id]; if (!x || !x.sw || !x.sw.ospf) return []; const R = this.ospfAll(); return (R.routes[id] || []).map(function (r) { return Object.assign({ ad: 110 }, r); }); }
  /* ------------------------------------------------------------ first-hop redundancy: standby (Level 4) */
  /* each standby group on each segment: its members (switch, interface, real address, virtual address, priority, preempt, up),
     kept until a switch or a cable changes. Only a layer 3 switch has any */
  hsrpGroups() {
    const ids = Object.keys(this.d).filter(function (id) { const x = this.d[id]; return x.kind === "mswitch" && x.sw.os === "l3switch" && this.on(id); }, this);
    const any = ids.some(function (id) { const w = this.d[id].sw; return Object.keys(w.svis || {}).some(function (k) { return w.svis[k].standby; }) || (w.vlan1 && w.vlan1.standby) || Object.keys(w.ports).some(function (k) { return w.ports[k].standby; }); }, this);
    if (!any) return {};
    const sig = JSON.stringify(Object.keys(this.d).filter(function (id) { return this.d[id].kind === "mswitch"; }, this).map(function (id) { const w = this.d[id].sw; return [id, this.on(id), w.ports, w.svis, w.vlan1, w.vlans, w.pcs, w.stp]; }, this)) + JSON.stringify(this.net.cables);
    if (this._hsrp && this._hsrp.sig === sig) return this._hsrp.G;
    const G = {}, segs = {};
    const segOf = function (node) { if (segs[node]) return segs[node]; const D = [...this.domain(node)].sort(), k = D[0]; D.forEach(function (n) { segs[n] = k; }); return k; }.bind(this);
    ids.forEach(function (id) {
      const w = this.d[id].sw;
      l3Ifs(this.l3View(id)).forEach(function (f) {
        const rec = /^Vlan/.test(f.name) ? (f.name === "Vlan1" ? w.vlan1 : w.svis[f.name.slice(4)]) : w.ports[f.name]; if (!rec || !rec.standby) return;
        const seg = f.up ? segOf(this.l3Node(id, f.name)) : this.l3Node(id, f.name);
        Object.keys(rec.standby).forEach(function (g) { const c = rec.standby[g], k = seg + "|" + g; (G[k] = G[k] || []).push({ id: id, iface: f.name, ip: f.ip, vip: c.ip || null, pri: c.pri == null ? 100 : c.pri, preempt: !!c.preempt, up: !!(f.up && f.ip), grp: +g, node: this.l3Node(id, f.name) }); }, this);
      }, this);
    }, this);
    this._hsrp = { sig: sig, G: G }; return G;
  }
  /* the election after each change: the active router stays active while it's up, unless one with a higher priority and preempt
     set comes along; when it goes, the best of the rest (highest priority, then highest address) takes over */
  hsrpTick() {
    const G = this.hsrpGroups(), keys = Object.keys(G); if (!keys.length && !(this.net.extra && this.net.extra.hsrp)) return;
    this.net.extra = this.net.extra || {}; const A = this.net.extra.hsrp = this.net.extra.hsrp || {};
    const rank = function (p, q) { return q.pri - p.pri || ip2n(q.ip) - ip2n(p.ip); };
    keys.forEach(function (k) {
      const el = G[k].filter(function (m) { return m.up; }).sort(rank); if (!el.length) { delete A[k]; return; }
      const cur = el.find(function (m) { return m.id === A[k]; }), best = el[0];
      if (!cur) A[k] = best.id; else if (best.id !== cur.id && best.preempt && best.pri > cur.pri) A[k] = best.id;
    });
    Object.keys(A).forEach(function (k) { if (!G[k]) delete A[k]; });
  }
  /* each group's state: who's active and who's standby, the virtual address the active one answers for */
  hsrpState() {
    const G = this.hsrpGroups(), A = (this.net.extra && this.net.extra.hsrp) || {}, out = {};
    const rank = function (p, q) { return q.pri - p.pri || ip2n(q.ip) - ip2n(p.ip); };
    Object.keys(G).forEach(function (k) {
      const el = G[k].filter(function (m) { return m.up; }).sort(rank), act = el.find(function (m) { return m.id === A[k]; }) || null;
      const sby = el.filter(function (m) { return !act || m.id !== act.id; })[0] || null;
      out[k] = { members: G[k], active: act, standby: sby, vip: act ? act.vip || (el.find(function (m) { return m.vip; }) || {}).vip : null };
    });
    return out;
  }
  /* the virtual addresses a switch answers ARP for now (it's the active router in that group), each with its node */
  hsrpVips(id) {
    const x = this.d[id]; if (!x.sw || x.sw.os !== "l3switch") return [];
    const S = this.hsrpState(), out = []; Object.keys(S).forEach(function (k) { const q = S[k]; if (q.active && q.active.id === id && q.vip) out.push({ vip: q.vip, node: q.active.node }); }); return out;
  }

  /* ------------------------------------------------------------ OSPF (Level 4, the campus: ospf.js) */
  /* every switch's OSPF interfaces (up, an address, in a network statement), each on its segment (its layer 2 broadcast domain),
     and what the protocol settles on; kept until a switch or a cable changes */
  ospfAll() {
    const ids = Object.keys(this.d).filter(function (id) { const x = this.d[id]; return x.kind === "mswitch" && x.sw.os === "l3switch" && x.sw.ospf && x.sw.routing && this.on(id); }, this);
    const sig = JSON.stringify(Object.keys(this.d).filter(function (id) { return this.d[id].kind === "mswitch"; }, this).map(function (id) { const w = this.d[id].sw; return [id, this.on(id), w.ports, w.svis, w.ospf, w.routes, w.routing, w.vlans, w.pcs, w.stp, w.vlan1]; }, this)) + JSON.stringify(this.net.cables);
    if (this._ospf && this._ospf.sig === sig) return this._ospf.res;
    const routers = {}, segs = {};
    const segOf = function (node) { if (segs[node]) return segs[node]; const D = [...this.domain(node)].sort(), k = D[0]; D.forEach(function (n) { segs[n] = k; }); return k; }.bind(this);
    ids.forEach(function (id) {
      const sw = this.d[id].sw, O = sw.ospf, view = this.l3View(id), up = l3Ifs(view).filter(function (f) { return f.up && f.ip; });
      const ifs = [];
      up.forEach(function (f) {
        const st = O.nets.find(function (x) { return ospfMatch(f.ip, x.net, x.wild); }); if (!st) return;
        const rec = /^Vlan/.test(f.name) ? (f.name === "Vlan1" ? sw.vlan1 : sw.svis[f.name.slice(4)]) : sw.ports[f.name];
        const mbps = /^Vlan/.test(f.name) ? 1000 : (rec.speed && rec.speed !== "auto" ? +rec.speed : 1000);
        ifs.push({ name: f.name, ip: f.ip, mask: f.mask, area: st.area, cost: rec.ospfCost || ospfCost(mbps, O.refBw), passive: ospfPassive(O, f.name), mtu: rec.mtu || 1500, pri: rec.ospfPri, seg: segOf(this.l3Node(id, f.name)) });
      }, this);
      const rid = O.rid || up.map(function (f) { return f.ip; }).sort(function (a, b) { return ip2n(b) - ip2n(a); })[0] || "0.0.0.0";
      const def = !!O.originate && l3Table(view, []).some(function (t) { return t.code === "S" && t.net === "0.0.0.0" && t.mask === "0.0.0.0"; });
      routers[id] = { rid: rid, ifs: ifs, originate: def };
    }, this);
    const res = ospfSolve(routers); res.routers = routers;
    this._ospf = { sig: sig, res: res }; return res;
  }
  /* a packet from a device through layer 3 switches: in at its gateway, the longest match there, out; on to the next hop's
     switch while the route says so, until it reaches the destination's own network, where whoever owns the address answers.
     Each switch it crosses takes one off the TTL. The reply has to find its own way back: the destination's route to the
     sender must work too (oneWay: this is that check, so it doesn't check again). A next hop that never answers, a network
     no switch has a route to, a loop, each stops it for its own reason. Worked out, never stored: a check changes nothing */
  routeL3(id, a, dst, gwId, dom, proto, oneWay, depth) {
    const base = { via: gwId, addr: a }, hops = [a.gw], seen = [];
    let cur = gwId, routers = 0;
    if ((depth || 0) > 8) return Object.assign({ fail: "no-reply", hops: hops, why: "loop", routers: 16 }, base);   /* handed back and forth between switches and a router until the TTL runs out */
    while (routers < 16) {
      if (seen.indexOf(cur) >= 0) return Object.assign({ fail: "no-reply", hops: hops.slice(), why: "loop", routers: routers }, base);   /* round in a circle until the TTL runs out */
      seen.push(cur); routers++;
      const V = this.l3View(cur), mine = l3Ifs(V).find(function (f) { return f.up && f.ip === dst; });
      if (mine) {   /* one of this switch's own addresses */
        if (routers > 1 && !oneWay) { const r = this.routeFromL3(cur, a.ip, proto, true); if (r.fail || !(r.local || r.routed)) return Object.assign({ fail: "no-reply", hops: hops.slice(), why: "no way back", routers: routers }, base); }
        return Object.assign(routers === 1 ? { local: true } : { routed: true }, { owner: [cur], next: dst, hops: hops.concat(routers === 1 ? [] : [dst]), routers: routers - 1 }, base);
      }
      const rt = l3Route(V, dst, this.learned(cur));
      if (!rt) return Object.assign({ fail: "net-unreachable", hops: [hops[hops.length - 1]], path: hops.slice(), why: "no-route", at: cur, routers: routers }, base);   /* this switch has no route: it says so */
      const odom = this.domain(this.l3Node(cur, rt.iface)), next = rt.nh || dst;
      const owners = this.owners(next, odom).filter(function (o) { return o !== cur; });
      if (!owners.length) return Object.assign({ fail: "no-reply", hops: hops.slice(), why: rt.nh ? "next-hop" : "arp", at: cur, routers: routers }, base);   /* its ARP for the next hop, or the destination, goes unanswered */
      if (rt.nh) {
        const n = owners[0];
        if (this.d[n].kind === "brouter") {   /* on into a business router (the campus's edge): it carries on from its interface on this network */
          const br = this.routeBR(id, { ip: a.ip, mask: a.mask, gw: rt.nh, kind: a.kind }, dst, n, odom, proto, oneWay, (depth || 0) + 1);
          return Object.assign({}, br, { via: gwId, addr: a, hops: hops.concat(br.hops || []), routers: routers + (br.routers || 1) });
        }
        if (!this.routes3(n)) return Object.assign({ fail: "beyond", hops: hops.concat([rt.nh]), routers: routers }, base);   /* a next hop that doesn't route it on */
        hops.push(rt.nh); cur = n; continue;
      }
      const back = owners.filter(function (o) { return this.canReply(o, a.ip, odom); }, this);
      if (!back.length) return Object.assign({ fail: "no-reply", hops: hops.slice(), why: "their gateway", owner: owners, routers: routers }, base);
      if (!oneWay) { const r = this.route(back[0], a.ip, proto, true); if (r.fail || !(r.local || r.routed)) return Object.assign({ fail: "no-reply", hops: hops.slice(), why: "no way back", owner: owners, routers: routers }, base); }
      return Object.assign({ local: false, routed: true, owner: back, outIf: rt.iface, next: dst, hops: hops.concat([dst]), routers: routers }, base);
    }
    return Object.assign({ fail: "no-reply", hops: hops, why: "loop", routers: routers }, base);
  }
  /* a packet the switch sends itself (its ping): out by its own routing table, from the way-out interface's address */
  routeFromL3(rid, dst, proto, oneWay) {
    const V = this.l3View(rid), ifs = l3Ifs(V);
    if (ifs.some(function (f) { return f.up && f.ip === dst; })) return { local: true, owner: [rid], hops: [], self: true };
    const rt = l3Route(V, dst, this.learned(rid)); if (!rt) return { fail: "no-route" };
    const src = ifs.find(function (f) { return f.name === rt.iface; }), a = { ip: src.ip, mask: src.mask, gw: rt.nh || null, kind: "static" };
    const odom = this.domain(this.l3Node(rid, rt.iface)), next = rt.nh || dst;
    const owners = this.owners(next, odom).filter(function (o) { return o !== rid; });
    if (!owners.length) return { fail: "no-reply", addr: a, why: "arp" };
    if (rt.nh) { const n = owners[0]; if (this.d[n].kind === "brouter") { const br = this.routeBR(rid, a, dst, n, odom, proto, oneWay, 1); return Object.assign({}, br, { hops: [rt.nh].concat((br.hops || []).slice(1)) }); } if (!this.routes3(n)) return { fail: "beyond", addr: a, hops: [rt.nh] }; const r = this.routeL3(rid, a, dst, n, odom, proto, oneWay); return Object.assign({}, r, { routers: (r.routers || 0) }); }
    const back = owners.filter(function (o) { return this.canReply(o, a.ip, odom); }, this);
    return back.length ? { local: true, owner: back, addr: a, next: dst } : { fail: "no-reply", owner: owners, addr: a };
  }

  /* ------------------------------------------------------------ the business router (BR-4200: rtcli.js) */
  /* each of its interfaces (a port, a subinterface) is a node of its own on layer 2 */
  rtNode(id, n) { return id + "@" + n; }
  /* what its ports see at the far end, worked out without storing anything */
  routerLinks(id) {
    const L = {};
    RT.RT_PORTS.forEach(function (n) { const c = this.cableAt(id, RT_PORT(n)); if (!c || c.kind === "console") return; const v = c.kind === "cat6" && this.panelEnd(c) ? this.viaPanel(c) : c; if (!v) return; const far = v.a.dev === id ? v.b : v.a, up = this.cableUp(c); L[n] = { up: up, far: far.dev, lldp: up ? this.lldpOf(far) : null }; }, this);
    return L;
  }
  syncRouter(id) { const x = this.d[id]; if (!x || x.kind !== "brouter") return null; x.sw.links = this.routerLinks(id); x.sw.uptime = x.sw.uptimeFixed || (2 + this.n) + " minutes"; return x.sw; }
  /* the router as it runs now, for working things out: its configuration with its links fresh (a copy: a check changes nothing) */
  rtView(id) { return Object.assign({}, this.d[id].sw, { links: this.routerLinks(id) }); }
  /* the provider's side: the interface cabled to the modem, the modem in sync, and its address (handed out by the provider to
     "ip address dhcp", or set by hand: it must be the address the provider gave the business) */
  rtWan(id, R) {
    R = R || this.rtView(id);
    const n = RT.RT_PORTS.find(function (k) { return R.links[k] && R.links[k].far === "modem"; }); if (!n) return null;
    const f = R.ifs[n], up = R.links[n].up && !f.shutdown && this.modemSynced(), isp = this.net.isp;
    const dyn = f.dhcp || (f.ip === isp.wanIp && f.mask === (isp.mask || "255.255.255.0")), fx = isp.fixed, fixed = !f.dhcp && !!fx && f.ip === fx.ip && f.mask === fx.mask;
    /* addr: the business's public address as the internet sees it; gw: the provider's gateway for it, the only next hop out */
    return { iface: n, up: up, lease: up && f.dhcp ? { ip: isp.wanIp, mask: isp.mask || "255.255.255.0", gw: isp.gw } : null, ok: up && (dyn || fixed), addr: up && dyn ? isp.wanIp : up && fixed ? fx.ip : null, gw: fixed ? fx.gw : isp.gw, fixed: fixed };
  }
  /* the way out to the provider: the route's next hop has to be the provider's gateway for the address in use. A route that names
     only the port would have the router ask by ARP for every address on the internet, and the provider doesn't answer for them */
  wanHopOk(w, rt) { return !!w && !!rt && (!!rt.dhcp || (!!rt.nh && rt.nh === w.gw)); }
  /* the business's public address now (the router's provider side as it's really set), or the provider's changing one */
  publicIp() { const rid = Object.keys(this.d).find(function (id) { return this.d[id].kind === "brouter" && this.on(id); }, this), w = rid && this.rtWan(rid); return w && w.addr ? w.addr : this.net.isp.wanIp; }
  /* what the router's command line asks the network: the provider's lease, its leases, its translations, its hit counts */
  rtLive(id) {
    const self = this, x = this.d[id];
    return function (k, n) {
      if (k === "wan") { const w = self.rtWan(id); return w && w.iface === n ? w.lease : null; }
      if (k === "leases") return (x.leases || []).slice();
      if (k === "nat") return (x.xlate || []).slice();
      if (k === "hits") return x.hits || {};
      if (k === "arp") return self.rtArp(id);
      if (k === "clear-nat") { x.xlate = []; return null; }
      if (k === "clear-dhcp") { x.leases = []; return null; }
      if (k === "clear-hits") { x.hits = {}; return null; }
      return null;
    };
  }
  /* the router's ARP table, as show ip arp lists it: its own address on each interface that's up, then each device it hears on
     its inside networks, by the hardware address that answered last (two devices on one address take turns, so the entry flips
     between them: SB-14). Worked out, never stored: a check changes nothing */
  rtArp(id) {
    const R = this.rtView(id), live = this.rtLive(id), w = this.rtWan(id, R), cache = this.arp[id] || {}, out = [];
    const dot = function (m) { const h = String(m || "").replace(/[^0-9a-f]/gi, "").toLowerCase(); return h.length === 12 ? h.replace(/(.{4})(?=.)/g, "$1.") : String(m || ""); };
    const ips = [];
    for (const d in this.d) {
      if (d === id) continue; const x = this.d[d];
      if (x.kind === "mswitch") { if (this.on(d)) this.mgmtAddrs(d).forEach(function (o) { ips.push(o.ip); }); continue; }
      if (x.kind === "brouter" || !(x.ifaces || x.kind === "router" || x.kind === "rogue")) continue;
      const a = this.addr(d); if (a && a.ip && a.kind !== "apipa") ips.push(a.ip);
    }
    RT.allIfs(R).forEach(function (n) {
      const a = RT.addrOf(R, n, live); if (!a || RT.rtStatus(R, n)[1] !== "up") return;
      out.push({ ip: a.ip, mac: dot(this.macOf(id)), iface: n, own: true });
      if (w && w.iface === n) return;   /* the provider's side: nothing of the business's is out there */
      const dom = this.domain(this.rtNode(id, n)), seen = {};
      ips.forEach(function (ip) {
        if (seen[ip] || ip === a.ip || !sameSubnet(ip, a.ip, a.mask)) return; seen[ip] = true;
        const o = this.owners(ip, dom).filter(function (k) { return k !== id; }, this); if (!o.length) return;
        const last = o.length > 1 && cache[ip] && o.some(function (k) { return this.macOf(k) === cache[ip]; }, this) ? cache[ip] : this.macOf(o[0]);
        out.push({ ip: ip, mac: dot(last), iface: n, own: false, age: cache[ip] ? 0 : hash(ip) % 4 });
      }, this);
    }, this);
    return out.sort(function (p, q) { return ip2n(p.ip) - ip2n(q.ip); });
  }
  /* the router's interface with this address that a device in this broadcast domain reaches (up, its address set) */
  rtIfFor(id, ip, dom, R) {
    R = R || this.rtView(id); const live = this.rtLive(id);
    return RT.allIfs(R).find(function (n) { const a = RT.addrOf(R, n, live); return a && a.ip === ip && RT.rtStatus(R, n)[1] === "up" && dom.has(this.rtNode(id, n)); }, this) || null;
  }
  /* a packet from a device, through the router: in on the interface the device's gateway is, checked against the access list
     in on that interface; routed by the longest match; out through the access list out on the way-out interface; NAT to the
     provider. The reply has to come back the same way, through the same lists the other way round (access lists remember
     nothing). acls: each list line a packet matched, for the hit counts when the traffic is really sent */
  routeBR(id, a, dst, rid, dom, proto, oneWay, depth) {
    const R = this.rtView(rid), live = this.rtLive(rid), P = proto || { proto: "icmp" }, acls = [];
    const inIf = this.rtIfFor(rid, a.gw, dom, R); if (!inIf) return { fail: "gateway-unreachable", addr: a, next: a.gw };
    if ((depth || 0) > 8) return { fail: "no-reply", addr: a, hops: [a.gw], why: "loop", routers: 16 };
    /* a source routed in from another router (a layer 3 switch in front of it): the reply needs a route back there too */
    const ia = RT.addrOf(R, inIf, live), far = !!(ia && !sameSubnet(a.ip, ia.ip, ia.mask)), self = this;
    const wayBack = function () { if (!far || oneWay) return true; const r = self.routeFromRouter(rid, a.ip, Object.assign({}, P, { src: dst, dst: a.ip, port: P.sport, sport: P.port }), (depth || 0) + 1); return !r.fail && !!(r.local || r.routed); };
    const pass = function (n, dir, pk) { const f = RT.allIfs(R).indexOf(n) >= 0 ? (n.indexOf(".") > 0 ? R.subs[n] : R.ifs[n]) : null, L = f && (dir === "in" ? f.aclIn : f.aclOut); if (!L) return true; const v = RT.aclVerdict(R, L, pk); if (!v.missing) acls.push([L, v.line]); return v.permit; };
    const req = Object.assign({}, P, { src: a.ip, dst: dst }), rep = Object.assign({}, P, { src: dst, dst: a.ip, port: P.sport, sport: P.port });
    const gwIp = a.gw, base = { via: rid, addr: a, inIf: inIf, acls: acls };
    if (!pass(inIf, "in", req)) return Object.assign({ fail: "blocked", hops: [], acl: { iface: inIf, dir: "in" } }, base);   /* checked as it comes in, before anything else: even tracert's first probe gets no answer */
    /* to one of the router's own addresses */
    const own = RT.allIfs(R).find(function (n) { const x = RT.addrOf(R, n, live); return x && x.ip === dst && RT.rtStatus(R, n)[1] === "up"; });
    if (own) return pass(inIf, "out", rep) && wayBack() ? Object.assign({ local: true, owner: [rid], next: dst, hops: [dst], routed: own !== inIf }, base) : Object.assign({ fail: "no-reply", hops: [gwIp], why: far ? "no way back" : undefined }, base);
    const rt = RT.lookup(R, dst, live);
    if (!rt) return Object.assign({ fail: "net-unreachable", hops: [gwIp], why: "no-route" }, base);
    const outIf = rt.iface, w = this.rtWan(rid, R);
    if (!pass(outIf, "out", req)) return Object.assign({ fail: "blocked", hops: [gwIp], acl: { iface: outIf, dir: "out" } }, base);
    if (w && outIf === w.iface) {   /* towards the provider */
      if (!w.ok) return Object.assign({ fail: "net-unreachable", hops: [gwIp], why: "wan" }, base);
      if (!this.wanHopOk(w, rt) && dst !== w.gw) return Object.assign({ fail: "no-reply", hops: [gwIp], why: rt.nh ? "next-hop" : "no-arp" }, base);   /* sent to a next hop that isn't the provider's: nothing comes back (the provider's gateway itself answers on the connected network) */
      if (!isPublic(dst)) return Object.assign({ fail: "beyond", hops: [gwIp, w.gw] }, base);
      const fin = (inIf.indexOf(".") > 0 ? R.subs[inIf] : R.ifs[inIf]).nat, fout = R.ifs[outIf].nat;
      const rule = R.nat.find(function (x) { return x.iface === outIf && RT.aclVerdict(R, x.list, { proto: "ip", src: a.ip, dst: dst }).permit && R.acls[x.list]; });
      if (isPrivate(a.ip) && !(fin === "inside" && fout === "outside" && rule && rule.overload)) return Object.assign({ fail: "no-nat", hops: [gwIp], why: !rule ? "no rule" : fin !== "inside" ? "inside" : fout !== "outside" ? "outside" : "overload" }, base);   /* a private source the provider won't route: no reply ever comes */
      if (!pass(outIf, "in", Object.assign({}, rep, { dst: w.addr })) || !pass(inIf, "out", rep)) return Object.assign({ fail: "no-reply", hops: [gwIp] }, base);
      if (!wayBack()) return Object.assign({ fail: "no-reply", hops: [gwIp, w.gw], why: "no way back" }, base);   /* translated back, then nowhere to send it */
      return Object.assign({ internet: true, nat: { inside: a.ip, global: w.addr }, hops: dst === w.gw ? [gwIp, w.gw] : [gwIp, w.gw, this.net.isp.core, dst] }, base);
    }
    /* out onto another of the business's own networks */
    const odom = this.domain(this.rtNode(rid, outIf)), next = rt.nh || dst, oa = RT.addrOf(R, outIf, live);
    let blk = null; const owners = this.owners(next, odom).filter(function (o) { if (o === rid) return false; const b = oa && this.arpBlocked(this.rtNode(rid, outIf), this.macOf(rid), oa.ip, o, next, odom); if (b) blk = blk || b; return !b; }, this);
    if (!owners.length) return Object.assign({ fail: "no-reply", hops: [gwIp], why: "arp", dai: blk }, base);   /* the router's ARP for it goes unanswered (or a switch inspecting ARP drops it): Request timed out */
    if (rt.nh && this.routes3(owners[0])) {   /* on to a layer 3 switch: it carries on by its own table */
      if (!pass(outIf, "in", rep) || !pass(inIf, "out", rep)) return Object.assign({ fail: "no-reply", hops: [gwIp], why: "reply blocked" }, base);
      const r = this.routeL3(id, { ip: a.ip, mask: a.mask, gw: rt.nh, kind: a.kind }, dst, owners[0], odom, proto, oneWay, (depth || 0) + 1);
      return Object.assign({}, r, { via: rid, addr: a, inIf: inIf, acls: acls, hops: [gwIp].concat(r.hops || []), routers: (r.routers || 0) + 1 });
    }
    if (rt.nh) return Object.assign({ fail: "beyond", hops: [gwIp, rt.nh] }, base);
    const back = owners.filter(function (o) { return this.canReply(o, a.ip, odom); }, this);
    if (!back.length) return Object.assign({ fail: "no-reply", hops: [gwIp], why: "their gateway" }, base);   /* the router answers tracert's first probe; nothing after it */
    if (!pass(outIf, "in", rep) || !pass(inIf, "out", rep)) return Object.assign({ fail: "no-reply", hops: [gwIp], why: "reply blocked" }, base);
    return Object.assign({ local: false, routed: true, owner: back, outIf: outIf, next: dst, hops: [gwIp, dst] }, base);
  }

  /* a packet the router sends itself (its ping, a TFTP copy): out by its own routing table, from the way-out interface's
     address. The reply comes in through that interface's access list in (what the router sends isn't checked going out) */
  routeFromRouter(rid, dst, proto, depth) {
    if (!this.on(rid)) return { fail: "no-link" };
    const R = this.rtView(rid), live = this.rtLive(rid), acls = [];
    const own = RT.allIfs(R).find(function (n) { const a = RT.addrOf(R, n, live); return a && a.ip === dst && RT.rtStatus(R, n)[1] === "up"; });
    if (own || isLoopback(dst)) return { local: true, owner: [rid], hops: [], src: dst };
    const rt = RT.lookup(R, dst, live); if (!rt) return { fail: "no-route" };
    const outIf = rt.iface, oa = RT.addrOf(R, outIf, live), src = oa ? oa.ip : null, w = this.rtWan(rid, R);
    const rep = Object.assign({}, proto || { proto: "icmp" }, { src: dst, dst: src });
    const inOk = function (n, pk) { const f = n.indexOf(".") > 0 ? R.subs[n] : R.ifs[n]; if (!f || !f.aclIn) return true; const v = RT.aclVerdict(R, f.aclIn, pk); if (!v.missing) acls.push([f.aclIn, v.line]); return v.permit; };
    if (w && outIf === w.iface) {
      if (!w.ok) return { fail: "net-unreachable", src: src };
      if (!this.wanHopOk(w, rt) && dst !== w.gw) return { fail: "no-reply", src: src, why: rt.nh ? "next-hop" : "no-arp" };   /* the provider's gateway itself answers on the connected network, whatever the routes say */
      if (!isPublic(dst)) return { fail: "beyond", src: src, hops: [w.gw] };
      return inOk(outIf, rep) ? { internet: true, src: src, outIf: outIf, hops: dst === w.gw ? [w.gw] : [w.gw, this.net.isp.core, dst], acls: acls } : { fail: "no-reply", src: src, acls: acls };
    }
    const odom = this.domain(this.rtNode(rid, outIf)), next = rt.nh || dst;
    let blk = null; const owners = this.owners(next, odom).filter(function (o) { if (o === rid) return false; const b = src && this.arpBlocked(this.rtNode(rid, outIf), this.macOf(rid), src, o, next, odom); if (b) blk = blk || b; return !b; }, this);
    if (!owners.length) return { fail: "host-unreachable", src: src, next: next, dai: blk };
    if (rt.nh && this.routes3(owners[0])) {   /* on to a layer 3 switch: it carries on by its own table; the reply comes back in through this interface's list */
      const r = this.routeL3(rid, { ip: src, mask: oa.mask, gw: rt.nh, kind: "static" }, dst, owners[0], odom, proto, true, (depth || 0) + 1);
      if (r.fail) return Object.assign({ src: src }, r);
      return inOk(outIf, rep) ? Object.assign({}, r, { src: src, outIf: outIf, acls: acls }) : { fail: "no-reply", src: src, acls: acls };
    }
    if (rt.nh) return { fail: "beyond", src: src, hops: [rt.nh] };
    const back = owners.filter(function (o) { return this.canReply(o, src, odom); }, this);
    if (!back.length || !inOk(outIf, rep)) return { fail: "no-reply", src: src, acls: acls };
    return { local: true, owner: back, src: src, outIf: outIf, hops: [dst], acls: acls };
  }

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
    const barred = this.cabinetBars(act);
    if (barred) { this.relink(before); return { ok: false, errs: [barred] }; }
    switch (act.t) {
      case "reseat": { const c = this.cable(act.cable), e = c[act.end]; if (c.kind === "coax") e.tight = true; else e.seated = true; res = { ok: true }; break; }
      case "unplug": { const c = this.cable(act.cable); c[act.end].seated = false; res = { ok: true }; break; }
      case "crossover": { const c = this.cable(act.cable); c.cond = "good"; c.wiring = "crossover"; c.a.seated = true; c.b.seated = true; res = { ok: true }; break; }   /* a crossover patch cable in its place */
      case "replace": { const c = this.cable(act.cable); c.cond = "good"; delete c.wiring; c.a.seated = true; c.b.seated = true; if (c.kind === "coax") { c.a.tight = true; c.b.tight = true; } res = { ok: true }; break; }
      case "tighten": { const c = this.cable(act.cable); c[act.end].tight = true; res = { ok: true }; break; }
      case "power": {
        const x = this.d[act.dev];
        if (x.ifaces && x.ifaces[0].cfg.mode !== "static") { /* a restart asks for its address again */ }
        if (x.kind === "mswitch") { reloadSwitch(x.sw, "power-on"); for (const k in (this.cli || {})) if (this.cli[k].sw === act.dev) delete this.cli[k]; }   /* power off and on: only what was saved comes back; every login to it is dropped */
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
      case "radio": { const f = (this.d[act.dev].ifaces || []).find(function (i) { return i.type === "wifi"; }); if (!f) { res = { ok: false, errs: ["It has no Wi-Fi"] }; break; } f.off = !act.on; if (f.off) this.release(act.dev); else if (this.hasLink(act.dev)) this.dhcp(act.dev, "join"); res = { ok: true, on: !f.off }; break; }   /* a phone's Wi-Fi turned off or on */
      case "forget": { const f = this.d[act.dev].ifaces[0]; f.saved = { ssid: null, passOk: false }; this.release(act.dev); res = { ok: true }; break; }
      case "join": {                                            /* join the house's network by name: the secured one with its current password, or (open) a copy with none; or (ssid) the guest network */
        const f = this.d[act.dev].ifaces[0], w = this.d.router.wifi, g = this.d.router.guest;
        if (g && act.ssid && act.ssid === g.ssid) f.saved = g.sec === "Open" ? { ssid: g.ssid, passOk: true, sec: "Open" } : { ssid: g.ssid, passOk: true, gen: g.gen };
        else f.saved = act.open ? { ssid: w.ssid, passOk: true, sec: "Open" } : { ssid: w.ssid, passOk: true, gen: w.gen || 1 }; this.release(act.dev);   /* open: the copy with no password */
        res = this.hasLink(act.dev) ? this.dhcp(act.dev, "join") : { result: "no-wifi" }; break;
      }
      case "joinssid": {                                        /* join a business access point's network by name, with its password (the client's records give it) */
        const f = this.d[act.dev].ifaces[0], ap = this.aps().find(function (p) { return p.ssid === act.ssid; });
        const pw = typeof act.pass === "string" ? !!ap && act.pass === ap.psk : act.pass !== false;   /* typed on the phone: it must be the network's password */
        f.saved = ap ? (ap.sec === "Open" ? { ssid: ap.ssid, passOk: true, sec: "Open" } : { ssid: ap.ssid, passOk: !!(ap && pw), gen: ap.gen }) : { ssid: act.ssid, passOk: false };
        this.release(act.dev); res = this.hasLink(act.dev) ? this.dhcp(act.dev, "join") : { result: "no-wifi" }; break;
      }
      case "apnet": {                                           /* the business access point's web page: a network saved (a new name adds one, a name it has updates it) or removed */
        const x = this.d[act.dev], errs = []; if (!x || x.kind !== "bap") { res = { ok: false, errs: ["That isn't an access point"] }; break; }
        if (act.remove != null) { const i = x.ssids.findIndex(function (w) { return w.ssid === act.remove; }); if (i < 0) { res = { ok: false, errs: ["There's no network called " + act.remove] }; break; } x.ssids.splice(i, 1); res = { ok: true }; break; }
        const v = act.net || {}, ssid = String(v.ssid || "").trim(), sec = v.sec, psk = String(v.psk || ""), vl = String(v.vlan == null ? "" : v.vlan).trim();
        if (!ssid || ssid.length > 32 || !/^[\x20-\x7e]+$/.test(ssid)) errs.push("A network name is 1 to 32 letters, digits or symbols");
        if (["WPA2-Personal", "WPA2/WPA3-Personal", "WPA3-Personal", "Open"].indexOf(sec) < 0) errs.push("Choose the security");
        if (sec !== "Open" && (psk.length < 8 || psk.length > 63)) errs.push("A WPA2 or WPA3 password is 8 to 63 characters");
        if (vl && !(/^\d+$/.test(vl) && +vl >= 1 && +vl <= 4094)) errs.push("A VLAN ID is a number from 1 to 4094, or blank for the access point's own network");
        if (errs.length) { res = { ok: false, errs: errs }; break; }
        const was = x.ssids.find(function (w) { return w.ssid === ssid; });
        if (!was && x.ssids.length >= 4) { res = { ok: false, errs: ["This access point broadcasts up to four networks"] }; break; }
        const w = was || { ssid: ssid, gen: 0 };
        if (!was || w.psk !== psk || w.sec !== sec) w.gen = (w.gen || 0) + 1;   /* a new password or security: every device has to join again */
        Object.assign(w, { sec: sec, psk: sec === "Open" ? "" : psk, vlan: vl ? +vl : null });
        if (!was) x.ssids.push(w);
        res = { ok: true, ssid: ssid }; break;
      }
      case "cabinet": res = this.cabinet(act.values || {}); break;   /* the closet cabinet (SB-J6): its door, its lock, its key */
      case "pcprinter": { const ip = String(act.ip || "").trim(); if (!isIp(ip)) { res = { ok: false, errs: ["The printer port must be an IPv4 address"] }; break; } this.d.pc.printer.port = ip; res = { ok: true }; break; }
      case "client": res = this.setClient(act.dev, act.values); break;
      case "cmd": res = { ok: true }; break;                    /* commands are replayed by the command runner */
      case "tftp": { const s = this.d[act.dev || "tech"].tftp; if (s) s.on = !!act.on; res = { ok: !!s, on: !!(s && s.on) }; break; }   /* your laptop's TFTP server, started or stopped */
      case "sfp": {                                             /* a module out of an SFP slot and another from the van in */
        const x = this.d[act.dev]; if (!x || !x.sfp || !(act.slot in x.sfp) || !SFP_MODULES[act.type]) { res = { ok: false }; break; }
        x.sfp[act.slot] = act.type; res = { ok: true, type: act.type }; break;
      }
      case "polarity": { const c = this.cable(act.cable); if (!c || c.kind !== "fibre") { res = { ok: false }; break; } c.polarity = c.polarity === "flipped" ? "ab" : "flipped"; res = { ok: true, polarity: c.polarity }; break; }   /* the LC pair swapped over at one end */
      case "tone": { const c = this.cable(act.cable); this.net.extra.tone = c ? c.id : null; res = { ok: !!c }; break; }   /* the tone generator clipped onto a run at the desk end */
      case "repatch": {                                         /* a patch cord moved to another front port of the panel */
        const c = this.cable(act.cable), pe = c && this.panelEnd(c), to = String(act.port || "");
        if (!pe || /R$/.test(pe.port) || !/^\d+$/.test(to) || +to < 1 || +to > 24) { res = { ok: false, err: "That cord isn't in the panel's front" }; break; }
        if (to === pe.port) { res = { ok: true, same: true }; break; }
        if (this.cableAt(pe.dev, to)) { res = { ok: false, err: "Port " + to + " already has a cord in it" }; break; }
        pe.port = to; pe.seated = true; res = { ok: true, port: to }; break;
      }
      case "cablemap": {                                        /* the office's cable map as saved: a room (or nothing) for each panel port */
        const m = {}; Object.keys(act.map || {}).forEach(function (p) { if (/^\d+$/.test(p) && +p >= 1 && +p <= 24) m[p] = String(act.map[p] || "").slice(0, 20); });
        this.net.cablemap = m; res = { ok: true }; break;
      }
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
  /* the closet cabinet (SB-J6): what's in it (the business router and the closet switch) is reached only with its door open,
     to lay, pull, reseat, unplug or swap a cable at it, or to power it off and on. Nothing else is barred, and a level without the cabinet has no bar */
  cabinetBars(act) {
    const K = this.d.cab; if (!K || K.open) return null;
    let devs = [];
    if (act.t === "lay") devs = [act.a && act.a.dev, act.b && act.b.dev];
    else if (act.t === "pull") { const c = this.net.cables.find(function (x) { return x.id === act.cable; }); if (c) devs = [c.a.dev, c.b.dev]; }
    else if (act.t === "power" || act.t === "place") devs = [act.dev];
    else if (/^(reseat|unplug|tighten)$/.test(act.t)) { const c = this.cable(act.cable); if (c && c[act.end]) devs = [c[act.end].dev]; }   /* a plug at that end */
    else if (/^(replace|crossover|polarity)$/.test(act.t)) { const c = this.cable(act.cable); if (c) devs = [c.a.dev, c.b.dev]; }        /* the whole cable, both ends */
    const d = devs.find(function (x) { return K.holds.indexOf(x) >= 0; }); if (!d) return null;
    return cap(theDev(this.d[d])) + " is in the closet cabinet, and its door is " + (K.locked ? "locked: unlock it and open it first" : "shut: open it first");
  }
  /* its door opened or shut, its lock turned, its key put in or taken out: one at a time. The lock turns only with the key in
     it and the door shut (its bolt goes into the frame); a locked door doesn't open */
  cabinet(v) {
    const K = this.d.cab; if (!K) return { ok: false, errs: ["There's no cabinet here"] };
    const say = function () { return { ok: true, open: K.open, locked: K.locked, key: K.key }; };
    if ("key" in v) {
      if (!!v.key === K.key) return { ok: false, errs: [K.key ? "The key is already in the lock" : "The key isn't in the lock: you have it"] };
      K.key = !!v.key; return say();
    }
    if ("locked" in v) {
      if (!K.key) return { ok: false, errs: ["Put the key in the lock first"] };
      if (v.locked && K.open) return { ok: false, errs: ["Shut the door first: the lock's bolt turns into the frame"] };
      K.locked = !!v.locked; return say();
    }
    if ("open" in v) {
      if (v.open && K.locked) return { ok: false, errs: ["It's locked: unlock it first"] };
      K.open = !!v.open; return say();
    }
    return { ok: false, errs: ["Open or shut the door, turn the lock, or take the key"] };
  }
  place(id, room) {
    const x = this.d[id];
    if (!x) return { ok: false, errs: ["No such device"] };
    if (!(this.net.roomNames ? this.net.roomNames[room] : SIGNAL[room])) return { ok: false, errs: ["There's no room called " + room] };
    const fx = x.fixed || (this.net.fixed || FIXED_ROOM)[x.kind]; if (fx && fx[0] !== room) return { ok: false, errs: [cap(theDev(x)) + " goes " + fx[1]] };
    if (!x.boxed && this.cablesOf(id).some(function (c) { return c.kind !== "coax"; }) && this.net.rooms[id] !== room) return { ok: false, errs: ["Pull its cables out first: it's still cabled where it is"] };
    x.boxed = false; this.net.rooms[id] = room;
    return { ok: true, room: room };
  }
  /* build mode: lay a patch cable between two free ports; it comes as long as the run between the rooms */
  lay(a, b) {
    const errs = [], A = this.d[a && a.dev], B = this.d[b && b.dev];
    if (!A || !B) return { ok: false, errs: ["Choose a device and a port for each end"] };
    if (a.dev === b.dev) return { ok: false, errs: ["Both ends are on " + theDev(A) + ": a cable joins two devices"] };
    [[A, a], [B, b]].forEach(function (e) {
      if (e[0].boxed) errs.push(cap(theDev(e[0])) + " is still in its box: place it first");
      else if (portsOf(e[0]).indexOf(e[1].port) < 0) errs.push(cap(theDev(e[0])) + " has no port " + e[1].port);
      else if (this.cableAt(e[1].dev, e[1].port)) errs.push(cap(theDev(e[0])) + "'s " + (portName(e[0], e[1].port) === e[1].port ? "port " + e[1].port : portName(e[0], e[1].port)) + " already has a cable in it");
    }, this);
    if (errs.length) return { ok: false, errs: errs };
    const slot = function (X, e) { return isSfpSlot(X, e.port); }, sa = slot(A, a), sb = slot(B, b);
    if (sa !== sb) return { ok: false, errs: ["A fibre run joins two SFP slots; copper goes in the numbered ports"] };
    if (sa) {   /* the fibre's LC plug goes into a module: a slot with none takes no fibre */
      const empty = [[A, a], [B, b]].find(function (e) { return !(e[0].sfp && e[0].sfp[e[1].port]); });
      if (empty) return { ok: false, errs: ["Put a module in the " + empty[0].label + "'s " + empty[1].port + " first: the fibre's LC plug goes into the module"] };
      const nf = (this.net.extra.runs = (this.net.extra.runs || 0) + 1), flen = runLength(this.net.rooms[a.dev], this.net.rooms[b.dev], this.net) + (this.net.rooms[a.dev] === this.net.rooms[b.dev] ? 0 : 9);   /* the run in the wall goes the long way round, past the lift's motor room */
      const fc = { id: "c-fibre-" + nf, kind: "fibre", fiber: "MMF", jacket: "OM2 50/125 µm MULTIMODE", polarity: "ab", a: { dev: a.dev, port: a.port, seated: true }, b: { dev: b.dev, port: b.port, seated: true }, length: flen };
      this.net.cables.push(fc);
      return { ok: true, cable: fc.id, length: flen };
    }
    const back = [[A, a], [B, b]].find(function (e) { return e[0].kind === "patchpanel" && /R$/.test(e[1].port); });
    if (back) return { ok: false, errs: ["The back of the patch panel is punched down: a patch cord goes in its front"] };
    const ca = consoleEnd(A, a.port), cb = consoleEnd(B, b.port);
    const who = function (X) { return X.kind === "brouter" ? "router" : "switch"; }, far = A.kind === "techlaptop" ? B : A;
    const conErr = function (X) { return X.kind === "techlaptop" ? "Your laptop's USB serial adapter takes the console cable: its other end goes to a switch's or router's CONSOLE port" : "The " + who(X) + "'s CONSOLE port takes the console cable from your laptop, not a network cable"; };
    if (ca !== cb) return { ok: false, errs: [conErr(ca ? A : B)] };
    if (ca && (A.kind === "techlaptop") === (B.kind === "techlaptop")) return { ok: false, errs: ["A console cable joins your laptop to a switch's or router's CONSOLE port"] };   /* never two CONSOLE ports to each other */
    if (ca && this.net.rooms[a.dev] !== this.net.rooms[b.dev]) return { ok: false, errs: ["The console cable is 1.8 m long: your laptop has to be in the same room as the " + who(far)] };
    const cord = (A.kind === "patchpanel" || B.kind === "patchpanel") && this.net.rooms[a.dev] === this.net.rooms[b.dev];   /* a patch cord in the rack, panel to switch */
    const n = (this.net.extra.runs = (this.net.extra.runs || 0) + 1), len = ca ? 1.8 : cord ? 0.5 : runLength(this.net.rooms[a.dev], this.net.rooms[b.dev], this.net);
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

  /* a connection from out on the internet (a phone on mobile data) to an address and port: the business router's own address on
     the provider's side, sent on by a static mapping to a device inside (a port forward). In through the provider-side
     interface's access list; translated only between an interface set nat outside and one set nat inside; routed; out through
     the inside interface's list to a device listening on that port; its reply back to its own gateway and through the same
     lists the other way (access lists remember nothing). Nothing here changes the network.
     Returns { ok, who, local, lport, outIf } or { fail: "timeout" | "refused", why } */
  fromInternet(dst, port, proto) {
    const P = proto || "tcp", isp = this.net.isp, src = isp.cell || "172.58.14.97", sport = 51544;
    if (!isp.up || isp.outage) return { fail: "timeout", why: "provider" };
    const rid = Object.keys(this.d).find(function (id) { return this.d[id].kind === "brouter" && this.on(id); }, this);
    if (!rid) return { fail: "timeout", why: "nobody" };
    const R = this.rtView(rid), live = this.rtLive(rid), w = this.rtWan(rid, R);
    const fixedIp = isp.fixed ? isp.fixed.ip : null;
    if (dst !== isp.wanIp && dst !== fixedIp) return { fail: "timeout", why: "nobody" };   /* not the business's address at all */
    if (!w || !w.ok) return { fail: "timeout", why: "wan" };
    if (dst !== w.addr) return { fail: "timeout", why: dst === fixedIp ? "notyet" : "old" };   /* the fixed address reaches nothing until the router takes it; the old one, nothing after */
    const f = function (n) { return n.indexOf(".") > 0 ? R.subs[n] : R.ifs[n]; };
    const pass = function (n, dir, pk) { const x = f(n), L = x && (dir === "in" ? x.aclIn : x.aclOut); return !L || RT.aclVerdict(R, L, pk).permit; };
    if (!pass(w.iface, "in", { proto: P, src: src, dst: dst, port: port, sport: sport })) return { fail: "timeout", why: "acl-in", iface: w.iface };
    const st = R.statics.find(function (x) { return (x.proto ? x.proto === P && +x.gport === +port : true) && ((x.iface && x.iface === w.iface) || x.global === dst); });
    if (!st) return { fail: "refused", why: "no-forward" };   /* nothing sends it on: the router itself answers, and has nothing on that port */
    if ((f(w.iface) || {}).nat !== "outside") return { fail: "refused", why: "outside" };   /* not set nat outside: no translating at all */
    const local = st.local, lport = st.proto ? st.lport : port, rt = RT.lookup(R, local, live);
    if (!rt || rt.iface === w.iface) return { fail: "timeout", why: "no-route", local: local };
    const outIf = rt.iface;
    if ((f(outIf) || {}).nat !== "inside") return { fail: "timeout", why: "inside", local: local, outIf: outIf };
    if (!pass(outIf, "out", { proto: P, src: src, dst: local, port: lport, sport: sport })) return { fail: "timeout", why: "acl-out", local: local, outIf: outIf };
    const odom = this.domain(this.rtNode(rid, outIf)), ga = RT.addrOf(R, outIf, live);
    let blk = null; const owners = this.owners(local, odom).filter(function (o) { if (o === rid) return false; const b = ga && this.arpBlocked(this.rtNode(rid, outIf), this.macOf(rid), ga.ip, o, local, odom); if (b) blk = blk || b; return !b; }, this);
    if (!owners.length) return { fail: "timeout", why: "arp", local: local, outIf: outIf, dai: blk };   /* nobody at that address answers the router's ARP (or a switch inspecting ARP drops it) */
    const who = owners[0], x = this.d[who], a = this.addr(who), gw = RT.addrOf(R, outIf, live);
    if ((x.listens || []).indexOf(+lport) < 0) return { fail: "refused", why: "port", who: who, local: local, lport: lport };
    if (!a || !gw || a.gw !== gw.ip) return { fail: "timeout", why: "gateway", who: who, local: local, lport: lport };   /* its reply goes to its gateway: it must be the router */
    const rep = { proto: P, src: local, dst: src, port: sport, sport: lport };
    if (!pass(outIf, "in", rep) || !pass(w.iface, "out", Object.assign({}, rep, { src: dst, sport: port }))) return { fail: "timeout", why: "reply", who: who, local: local, lport: lport, outIf: outIf };
    const back = RT.lookup(R, src, live);   /* the answer goes back out by the router's own routes: to the provider's gateway */
    if (!back || back.iface !== w.iface || !this.wanHopOk(w, back)) return { fail: "timeout", why: "back", who: who, local: local, lport: lport, outIf: outIf };
    return { ok: true, who: who, local: local, lport: lport, outIf: outIf, src: src };
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
    /* on the PC's own network, or through a business router (staff print across it since SB-J2): there, the PC's ARP is for its gateway */
    if (r.routed && !r.local) {   /* across the router: the router's ARP asks for the printer's address, and with two devices on it they take turns (SB-14) */
      if (r.fail || !r.owner || !r.owner.length) return { ok: false, why: r.fail || "beyond", port: ip };   /* as before */
      const who = this.turn(r.via || "rtr", ip, r.owner);
      return who === "printer" ? { ok: true, port: ip } : { ok: false, why: "wrong-device", who: who, port: ip, conflict: r.owner.length > 1 };
    }
    if (!r.local) return { ok: false, why: r.fail || "beyond", port: ip };
    const who = this.turn("pc", ip, r.owner);
    this.arp.pc[ip] = this.macOf(who);
    if (who === "printer" && this.mismatched("printer")) return this.n % 3 === 0 ? { ok: false, why: "timeout", port: ip, slow: true } : { ok: true, port: ip, slow: true };   /* a duplex mismatch: pages crawl, and every so often one never arrives */
    return who === "printer" ? { ok: true, port: ip } : { ok: false, why: "wrong-device", who: who, port: ip, conflict: r.owner.length > 1 };
  }

  /* two devices on one address: whichever answers the ARP question gets the traffic, so tries take turns (per computer
     and address, whatever is being sent), and the computer's ARP table holds whoever answered last */
  turn(id, ip, owners) {
    if (owners.length < 2) return owners[0];
    const t = this.turns = this.turns || {}, k = id + ">" + ip; t[k] = (t[k] || 0) + 1;
    const who = owners[(t[k] - 1) % owners.length]; this.arp[id][ip] = this.macOf(who); return who;
  }
  /* a per-action random source, so replays give the same pings */
  r(tag) { return rng(hash(this.net.seed + ":" + this.n + ":" + tag)); }
}
