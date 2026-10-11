/* The simulation: given the state of the cables, the settings and the
   leases, it works out what really happens. Commands and device pages only
   ever ask it; nothing is canned. So a fault shows up wherever it really
   would, and a fix works only if it fixes the real cause.
   Every change goes through apply(), so a ticket can be replayed exactly
   (progress is saved as the list of actions). */
import { rng, hash, ip2n, n2ip, sameSubnet, isIp, isApipa, isPublic, isPrivate, isLoopback, broadcast, maskBits } from "./util.js";

/* each radio has its own hardware address: the 5 GHz one is the next number up */
function bump(m) { const p = m.split("-"); p[5] = ((parseInt(p[5], 16) + 1) & 255).toString(16).padStart(2, "0"); return p.join("-"); }
const DNS_PUBLIC = ["8.8.8.8", "8.8.4.4", "1.1.1.1", "1.0.0.1", "9.9.9.9"];
export const SITES = { "rafiki-it.example": "203.0.113.80", "www.rafiki-it.example": "203.0.113.80", "www.example.com": "203.0.113.81", "example.com": "203.0.113.81", "learn.example.org": "203.0.113.82" };

/* Wi-Fi signal (percent) from an access point's room to a client's room, by band */
const SIGNAL = {
  living: { living: [95, 90], kitchen: [80, 68], office: [70, 52], garage: [55, 34], porch: [62, 42], upstairs: [44, 24] },
  upstairs: { upstairs: [86, 78], living: [50, 36], office: [42, 28], kitchen: [40, 26], garage: [30, 14], porch: [34, 18] }
};

export class Sim {
  constructor(net) {
    this.net = net; this.d = net.devices; this.n = 0; this.log = []; this.lastTrace = null; this.arp = {};
    for (const id in this.d) this.arp[id] = {};
  }

  /* ------------------------------------------------------------ cables and power */
  cable(id) { return this.net.cables.find(function (c) { return c.id === id; }); }
  cableAt(dev, port) { return this.net.cables.find(function (c) { return (c.a.dev === dev && c.a.port === port) || (c.b.dev === dev && c.b.port === port); }); }
  cablesOf(dev) { return this.net.cables.filter(function (c) { return c.a.dev === dev || c.b.dev === dev; }); }
  on(id) { const x = this.d[id]; return !!x && x.on !== false; }
  cableUp(c) {
    if (!c) return false;
    if (c.kind === "coax") return c.a.tight && c.b.tight && c.cond === "good";
    if (!c.a.seated || !c.b.seated) return false;
    if (c.cond === "crushed") return false;                 /* pairs 1-2 or 3-6 open: no link at all */
    return this.on(c.a.dev) && this.on(c.b.dev);
  }
  speed(c) { if (!this.cableUp(c)) return 0; return c.cond === "damaged" ? 100 : 1000; }   /* gigabit needs all four pairs; 100 Mb/s needs only 1-2 and 3-6 */

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
      LINK: !on ? "off" : this.cableUp(this.cable("c-modem-router")) ? "on" : "off"
    };
  }
  wanUp() { return this.on("router") && this.cableUp(this.cable("c-modem-router")) && this.modemSynced(); }
  wan() { return this.wanUp() ? { ip: this.net.isp.wanIp, mask: "255.255.255.0", gw: this.net.isp.gw, dns: this.net.isp.dns.slice() } : null; }

  /* ------------------------------------------------------------ Wi-Fi */
  aps() {
    const out = [], r = this.d.router;
    if (this.on("router")) {
      out.push({ id: "router", node: "router:lan", room: this.net.rooms.router, band: 24, ch: this.ch24(), ssid: r.wifi.ssid, mac: r.mac });
      out.push({ id: "router", node: "router:lan", room: this.net.rooms.router, band: 5, ch: r.wifi.ch5, ssid: r.wifi.ssid, mac: bump(r.mac) });
    }
    const m = this.d.mesh;
    if (m && this.on("mesh") && m.backhaul.ok && this.on("router")) {
      out.push({ id: "mesh", node: "mesh", room: this.net.rooms.mesh, band: 24, ch: this.ch24(), ssid: r.wifi.ssid, mac: m.ifaces[0].mac });
      out.push({ id: "mesh", node: "mesh", room: this.net.rooms.mesh, band: 5, ch: 149, ssid: r.wifi.ssid, mac: bump(m.ifaces[0].mac) });
    }
    return out;
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
  signal(apRoom, room, band) { const t = SIGNAL[apRoom]; if (!t || !t[room]) return 0; return t[room][band === 24 ? 0 : 1]; }
  /* a Wi-Fi client's link: which access point, band and channel, how strong, and how lossy */
  wifiLink(id) {
    const x = this.d[id]; if (!x || !x.ifaces || !this.on(id)) return null;
    const f = x.ifaces.find(function (i) { return i.type === "wifi"; }); if (!f) return null;
    const room = this.net.rooms[id];
    let best = null;
    for (const ap of this.aps()) {
      if (ap.ssid !== f.saved.ssid) continue;
      if (f.bands.indexOf(ap.band) < 0) continue;
      const s = this.signal(ap.room, room, ap.band);
      if (s < 20) continue;
      const score = s + (ap.band === 5 ? 10 : 0);           /* band steering: prefers 5 GHz when it is strong enough */
      if (ap.band === 5 && s < 45) continue;
      if (!best || score > best.score) best = { ap: ap, signal: s, score: score };
    }
    if (!best) return { connected: false, reason: "no-network", room: room };
    if (!f.saved.passOk) return { connected: false, reason: "auth", ap: best.ap, signal: best.signal, room: room };
    const crowd = best.ap.band === 24 ? this.crowd(best.ap.ch, room) : 0;
    const weak = best.signal < 35 ? (35 - best.signal) / 60 : 0;
    const loss = Math.min(0.6, Math.max(0, (crowd - 0.35) * 0.55) + weak);
    const rate = best.ap.band === 5 ? (best.signal > 70 ? 866.7 : 400) : (loss > 0.1 ? 26 : best.signal > 60 ? 144.4 : 72.2);
    return { connected: true, ap: best.ap, band: best.ap.band, ch: best.ap.ch, signal: best.signal, loss: loss, crowd: crowd, rate: rate, room: room };
  }

  /* ------------------------------------------------------------ layer 2: who can hear whom */
  nodeOf(dev, port) {
    if (dev === "router" || dev === "rogue") return port === "WAN" ? dev + ":wan" : dev + ":lan";
    return dev;
  }
  /* bridging devices pass frames between everything joined to them */
  edges() {
    const e = [];
    for (const c of this.net.cables) {
      if (c.kind === "coax" || !this.cableUp(c)) continue;
      e.push([this.nodeOf(c.a.dev, c.a.port), this.nodeOf(c.b.dev, c.b.port)]);
    }
    const m = this.d.mesh;
    if (m && this.on("mesh") && this.on("router") && m.backhaul.ok) e.push(["mesh", "router:lan"]);
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
    if (f.type === "bridge") return x.backhaul ? x.backhaul.ok && this.on("router") : true;
    return this.cableUp(this.cableAt(id, f.port));
  }

  /* ------------------------------------------------------------ addresses */
  /* the address an interface really has right now (none without a link) */
  addr(id) {
    const x = this.d[id];
    if (id === "router") return this.on("router") ? { ip: x.lan.ip, mask: x.lan.mask, gw: null, dns: [], kind: "static" } : null;
    if (x.kind === "rogue") return this.on(id) ? { ip: x.lan.ip, mask: x.lan.mask, gw: null, dns: [], kind: "static" } : null;
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
      if (x.kind === "router" || x.kind === "rogue") { if (dom.has(id + ":lan") && this.on(id) && x.lan.ip === ip) out.push(id); continue; }
      if (!x.ifaces) continue;
      if (!dom.has(id)) continue;
      const a = this.addr(id); if (a && a.ip === ip) out.push(id);
    }
    return out;
  }
  macOf(id) { const x = this.d[id]; if (x.kind === "router" || x.kind === "rogue") return x.mac; return x.ifaces[0].mac; }
  ttlOf(id) { const k = this.d[id].kind; return k === "pc" || k === "laptop" ? 128 : 64; }

  /* DHCP servers a client's request reaches */
  dhcpServers(id) {
    const dom = this.domain(this.homeNode(id)), out = [];
    for (const sid in this.d) {
      const s = this.d[sid];
      if ((s.kind === "router" || s.kind === "rogue") && this.on(sid) && s.dhcp && s.dhcp.on && dom.has(sid + ":lan")) out.push(sid);
    }
    return out;
  }
  /* the lowest free address in a server's pool (reservations kept for their owners) */
  offer(sid, mac, want) {
    const s = this.d[sid], dh = s.dhcp, lo = ip2n(dh.start), hi = ip2n(dh.end);
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
    const order = servers.slice().sort(function (a, b) { return (hash(f.mac + a) % 7) - (hash(f.mac + b) % 7); });   /* whoever answers first */
    for (const sid of order) { const ip = this.offer(sid, f.mac, f.lease && f.lease.server === this.d[sid].lan.ip ? f.lease.ip : null); if (ip) { ans = ip; server = sid; break; } }
    if (!ans) {
      if (!f.apipa) f.apipa = "169.254." + (1 + hash(f.mac) % 254) + "." + (1 + hash(f.mac + "x") % 254);
      f.lease = null;
      return { result: servers.length ? "no-offer" : "timeout", servers: servers };
    }
    const s = this.d[server];
    s.leases = s.leases.filter(function (l) { return l.mac !== f.mac; });
    s.leases.push({ mac: f.mac, ip: ans, name: x.label, host: x.host || x.label.replace(/\s+/g, "-").toUpperCase() });
    const dns = s.dhcp.dnsMode === "router" ? [s.lan.ip] : s.dhcp.dns.filter(Boolean);
    f.lease = { ip: ans, mask: s.lan.mask, gw: s.lan.ip, dns: dns, server: s.lan.ip, obtained: this.n, hours: s.dhcp.leaseH };
    f.apipa = null;
    return { result: "lease", ip: ans, server: server };
  }
  release(id) {
    const f = this.d[id].ifaces[0];
    if (f.lease) { const s = Object.values(this.d).find(function (v) { return (v.kind === "router" || v.kind === "rogue") && v.lan.ip === f.lease.server; }); if (s) s.leases = s.leases.filter(function (l) { return l.mac !== f.mac; }); }
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
      const now = this.hasLink(id);
      if (now && !before[id]) this.dhcp(id, "link");
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
    if (next === dst) return { local: true, owner: owners, addr: a, next: next };
    /* through a router */
    const gwId = owners[0], g = this.d[gwId];
    if (g.kind === "router") {
      if (dst === this.d.modem.mgmt) return this.on("modem") && this.cableUp(this.cable("c-modem-router")) ? { via: gwId, modem: true, addr: a, hops: [g.lan.ip, dst] } : { fail: "beyond", via: gwId, addr: a, hops: [g.lan.ip] };
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
        res = { ok: true, restarted: act.dev };
        break;
      }
      case "router": res = this.setRouter(act.page, act.values); break;
      case "client": res = this.setClient(act.dev, act.values); break;
      case "cmd": res = { ok: true }; break;                    /* commands are replayed by the command runner */
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
      if ("ch24" in v) { if (v.ch24 === "auto") r.wifi.ch24mode = "auto"; else { const c = parseInt(v.ch24, 10); if (!(c >= 1 && c <= 11)) return { ok: false, errs: ["2.4 GHz channel must be 1 to 11, or Auto"] }; r.wifi.ch24mode = "manual"; r.wifi.ch24 = c; } }
      if ("ch5" in v) { const c = parseInt(v.ch5, 10); if ([36, 40, 44, 48, 149, 153, 157, 161].indexOf(c) < 0) return { ok: false, errs: ["5 GHz channel must be one of 36, 40, 44, 48, 149, 153, 157, 161"] }; r.wifi.ch5 = c; }
      return { ok: true };
    }
    if (page === "reservation-add") {
      if (!isIp(v.ip) || !sameSubnet(v.ip, r.lan.ip, r.lan.mask)) return { ok: false, errs: ["The reserved address must be in " + this.net.prefix + ".x"] };
      r.dhcp.reservations = r.dhcp.reservations.filter(function (x) { return x.mac !== v.mac; });
      r.dhcp.reservations.push({ name: v.name || "Device", mac: v.mac, ip: v.ip }); return { ok: true };
    }
    if (page === "reservation-del") { r.dhcp.reservations = r.dhcp.reservations.filter(function (x) { return x.mac !== v.mac; }); return { ok: true }; }
    return { ok: false, errs: ["Unknown page"] };
  }
  setClient(id, v) {
    const f = this.d[id].ifaces[0];
    if ("mode" in v) f.cfg.mode = v.mode;
    if ("ip" in v) f.cfg.ip = v.ip;
    if ("mask" in v) f.cfg.mask = v.mask;
    if ("gw" in v) f.cfg.gw = v.gw;
    if ("dns" in v) f.cfg.dns = v.dns;
    if ("dnsMode" in v) f.cfg.dnsMode = v.dnsMode;
    if (f.cfg.mode === "dhcp" && this.hasLink(id)) this.dhcp(id, "change");
    return { ok: true };
  }

  /* a per-action random source, so replays give the same pings */
  r(tag) { return rng(hash(this.net.seed + ":" + this.n + ":" + tag)); }
}
