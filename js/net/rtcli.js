/* The business router's command line (BR-4200, our own unbranded router), on the switch's parser (swcli.js): the same
   modes, help, Tab, abbreviations, passwords, saving, TFTP and banner, with what a router has of its own. Pure: no page
   code, tested under Node.
   - Routed ports GigabitEthernet0/0 to 0/2, shut down from the box as a real router's are, and subinterfaces
     (GigabitEthernet0/0.10) for routing between VLANs over one trunk: encapsulation dot1Q first, then the address.
   - Static routes, the default route among them (ip route 0.0.0.0 0.0.0.0 next-hop).
   - A DHCP server: excluded addresses, and a pool per network (network, default-router, dns-server, lease).
   - Access lists: numbered standard (1-99) and extended (100-199), and named ones; applied in or out on an interface;
     first match wins, and everything not permitted is denied at the end (the implicit deny).
   - NAT: inside and outside interfaces, PAT (ip nat inside source list N interface X overload) and static NAT.
   What only the network knows (which links are up, the leases handed out, the translations made, the access lists'
   hit counts) the session asks for through its live callback, given by whoever opens it (cmd.js). */
import { CORE, registerOS, pwOk, lldpTable } from "./swcli.js";

const { CONFIG, EXEC_USER, EXEC_PRIV, SHOW, LINE, typed, pwText, hashish, ip4, isMask } = CORE;
/* its ten ports, as the model shows them: eight copper (0/0 to 0/7) and the two SFP slots printed WAN (0/8, 0/9) */
export const RT_PORTS = Array.from({ length: 10 }, function (_, i) { return "GigabitEthernet0/" + i; });
export const RT_SFP = ["GigabitEthernet0/8", "GigabitEthernet0/9"];
const short = function (n) { return n.replace("GigabitEthernet", "Gi"); };
const pad = function (s, n) { return (String(s) + " ".repeat(n)).slice(0, n); };

/* a router fresh from its box: no passwords, every port shut down and without an address, nothing routed but what's connected */
export function newRouter(o = {}) {
  const ifs = {};
  RT_PORTS.forEach(function (n) { ifs[n] = { desc: "", ip: null, mask: null, dhcp: false, shutdown: true, speed: "auto", duplex: "auto", nat: null, aclIn: null, aclOut: null }; });
  return { os: "router", model: "BR-4200", hostname: "Router", enableSecret: null, enablePassword: null, encrypt: false,
    con: { password: null, login: null }, vty: { password: null, login: null, transport: "telnet" }, users: {}, domain: null, rsa: 0, keyGen: 0, banner: null,
    ifs: ifs, subs: {}, routes: [], excluded: [], pools: {}, acls: {}, nat: [], statics: [],
    links: o.links || {}, mac: o.mac || "00e0.4d██.████", serial: "██████████", startup: null, uptime: o.uptime || "2 minutes" };
}
const RT_KEYS = ["hostname", "enableSecret", "enablePassword", "encrypt", "con", "vty", "users", "domain", "rsa", "keyGen", "banner", "ifs", "subs", "routes", "excluded", "pools", "acls", "nat", "statics"];

/* ------------------------------------------------------------ addresses */
const n4 = function (s) { return s.split(".").reduce(function (a, p) { return a * 256 + +p; }, 0); };
const s4 = function (n) { return [24, 16, 8, 0].map(function (b) { return Math.floor(n / Math.pow(2, b)) % 256; }).join("."); };
const bits = function (mask) { return mask.split(".").map(function (p) { return (+p).toString(2); }).join("").replace(/0/g, "").length; };
const lenMask = function (len) { return s4(len ? (Math.pow(2, 32) - Math.pow(2, 32 - len)) : 0); };
const netOf = function (ip, mask) { return s4(n4(ip) - n4(ip) % Math.pow(2, 32 - bits(mask))); };
const isWild = function (s) { return ip4(s); };
/* does an address match a pattern and its wildcard (a 1 bit in the wildcard: don't care) */
export function wildMatch(ip, pat, wild) { const a = n4(ip), p = n4(pat), w = n4(wild); for (let b = 31; b >= 0; b--) { const m = Math.pow(2, b), wb = Math.floor(w / m) % 2; if (!wb && Math.floor(a / m) % 2 !== Math.floor(p / m) % 2) return false; } return true; }

/* ------------------------------------------------------------ interface names */
/* "g0/0", "gi0/0.10", "gigabitethernet 0/1", "GigabitEthernet0/0.10" → the full name; sub: a subinterface number */
function rtName(tokens, i) {
  let t = (tokens[i] || "").toLowerCase(), used = 1;
  const m = /^(g|gi|gig|giga|gigab|gigabi|gigabit|gigabite|gigabitet|gigabiteth|gigabitethe|gigabitether|gigabitethern|gigabitetherne|gigabitethernet)(\d+\/\d+(?:\.\d+)?)?$/.exec(t);
  if (!m) return null;
  let num = m[2]; if (!num) { num = tokens[i + 1]; used = 2; }
  if (!num) return { err: "incomplete", used: used };
  const k = /^(0\/\d+)(?:\.(\d+))?$/.exec(num); if (!k) return { err: "invalid", used: used };
  const phys = "GigabitEthernet" + k[1]; if (RT_PORTS.indexOf(phys) < 0) return { err: "invalid", used: used };
  if (k[2] != null) { const sub = +k[2]; if (sub < 1 || sub > 4294967295) return { err: "invalid", used: used }; return { name: phys + "." + sub, phys: phys, sub: sub, used: used }; }
  return { name: phys, phys: phys, used: used };
}
const isSub = function (n) { return /\.\d+$/.test(n); };
const ifOf = function (r, n) { return isSub(n) ? r.subs[n] : r.ifs[n]; };
/* every interface, the physical ones each followed by its subinterfaces */
export function allIfs(r) {
  const out = [];
  RT_PORTS.forEach(function (n) { out.push(n); Object.keys(r.subs).filter(function (s) { return s.split(".")[0] === n; }).sort(function (a, b) { return +a.split(".")[1] - +b.split(".")[1]; }).forEach(function (s) { out.push(s); }); });
  return out;
}

/* is an interface up: shut down, no link on its port (the network says, in links), or (a subinterface) its port down */
export function rtStatus(r, n) {
  const phys = n.split(".")[0], p = r.ifs[phys], f = ifOf(r, n);
  if (!f) return ["deleted", "down"];
  if (f.shutdown) return ["administratively down", "down"];
  if (p.shutdown) return isSub(n) ? ["down", "down"] : ["administratively down", "down"];
  if (!r.links[phys] || !r.links[phys].up) return ["down", "down"];
  return ["up", "up"];
}
/* an interface's address as it runs: the one set, or (ip address dhcp) the one the provider handed out (live) */
export function addrOf(r, n, live) {
  const f = ifOf(r, n); if (!f) return null;
  if (f.dhcp) { const l = live && live("wan", n); return l && l.ip ? { ip: l.ip, mask: l.mask, gw: l.gw, dhcp: true } : null; }
  return f.ip ? { ip: f.ip, mask: f.mask } : null;
}

/* ------------------------------------------------------------ routing */
/* the routing table: connected networks (an interface up with an address), then the static routes whose way out is up.
   One per network: connected wins (distance 0 against 1) */
export function routes(r, live) {
  const T = [];
  allIfs(r).forEach(function (n) {
    const a = addrOf(r, n, live); if (!a || rtStatus(r, n)[1] !== "up") return;
    if (isSub(n) && !(r.subs[n].vlan)) return;
    T.push({ code: "C", net: netOf(a.ip, a.mask), mask: a.mask, iface: n }, { code: "L", net: a.ip, mask: "255.255.255.255", iface: n });
    if (a.dhcp && a.gw) T.push({ code: "S*", net: "0.0.0.0", mask: "0.0.0.0", nh: a.gw, dhcp: true });
  });
  r.routes.forEach(function (s) {
    if (T.some(function (t) { return t.code === "C" && t.net === s.net && t.mask === s.mask; })) return;
    if (s.iface) { if (rtStatus(r, s.iface)[1] === "up") T.push({ code: s.net === "0.0.0.0" && s.mask === "0.0.0.0" ? "S*" : "S", net: s.net, mask: s.mask, iface: s.iface }); return; }
    const via = T.find(function (t) { return t.code === "C" && wildMatch(s.nh, t.net, s4(Math.pow(2, 32) - 1 - n4(t.mask))); });
    if (via) T.push({ code: s.net === "0.0.0.0" && s.mask === "0.0.0.0" ? "S*" : "S", net: s.net, mask: s.mask, nh: s.nh, iface: via.iface });
  });
  return T;
}
/* the route a packet to an address takes: the longest match */
export function lookup(r, dst, live) {
  let best = null;
  routes(r, live).forEach(function (t) { if (t.code === "L") return; if (wildMatch(dst, t.net, s4(Math.pow(2, 32) - 1 - n4(t.mask))) && (!best || bits(t.mask) > bits(best.mask))) best = t; });
  if (best && best.code === "S*" && !best.iface && best.nh) { const via = routes(r, live).find(function (t) { return t.code === "C" && wildMatch(best.nh, t.net, s4(Math.pow(2, 32) - 1 - n4(t.mask))); }); if (via) best = Object.assign({}, best, { iface: via.iface }); }
  return best;
}

/* ------------------------------------------------------------ access lists */
export const PORT_WORDS = { ftp: 21, ssh: 22, telnet: 23, smtp: 25, domain: 53, bootps: 67, bootpc: 68, tftp: 69, www: 80, http: 80, pop3: 110, ntp: 123, snmp: 161, https: 443, syslog: 514 };
/* an address in an access list: any; host A; A W (pattern and wildcard); a standard list's bare A (a host) */
function addrSpec(a, i, standard) {
  if (!a[i]) return null;
  if (/^any$/i.test(a[i])) return { spec: { ip: "0.0.0.0", wild: "255.255.255.255" }, used: 1 };
  if (/^host$/i.test(a[i])) return ip4(a[i + 1]) ? { spec: { ip: a[i + 1], wild: "0.0.0.0" }, used: 2 } : null;
  if (!ip4(a[i])) return null;
  if (a[i + 1] && isWild(a[i + 1])) return { spec: { ip: a[i], wild: a[i + 1] }, used: 2 };
  return standard ? { spec: { ip: a[i], wild: "0.0.0.0" }, used: 1 } : null;
}
function portSpec(a, i) {
  if (!a[i]) return { spec: null, used: 0 };
  const op = a[i].toLowerCase(), val = function (w) { if (w == null) return null; if (/^\d+$/.test(w) && +w <= 65535) return +w; return PORT_WORDS[w.toLowerCase()] || null; };
  if (op === "range") { const x = val(a[i + 1]), y = val(a[i + 2]); return x != null && y != null ? { spec: { op: "range", n: x, m: y }, used: 3 } : null; }
  if (/^(eq|neq|gt|lt)$/.test(op)) { const x = val(a[i + 1]); return x != null ? { spec: { op: op, n: x }, used: 2 } : null; }
  return { spec: null, used: 0 };
}
/* one line of an access list, from its words: "permit 192.168.10.0 0.0.0.255" (standard), "deny tcp any host 10.0.0.5 eq 22" (extended) */
export function parseAce(type, a) {
  const action = (a[0] || "").toLowerCase(); if (action !== "permit" && action !== "deny") return null;
  if (type === "standard") { const s = addrSpec(a, 1, true); if (!s || a.length > 1 + s.used) return null; return { action: action, proto: "ip", src: s.spec, dst: { ip: "0.0.0.0", wild: "255.255.255.255" }, port: null }; }
  const proto = (a[1] || "").toLowerCase(); if (!/^(ip|tcp|udp|icmp)$/.test(proto)) return null;
  const s = addrSpec(a, 2, false); if (!s) return null;
  let i = 2 + s.used, sp = null;
  if (proto === "tcp" || proto === "udp") { const p = portSpec(a, i); if (!p) return null; sp = p.spec; i += p.used; }
  const d = addrSpec(a, i, false); if (!d) return null; i += d.used;
  let dp = null; if (proto === "tcp" || proto === "udp") { const p = portSpec(a, i); if (!p) return null; dp = p.spec; i += p.used; }
  if (a[i] && /^log$/i.test(a[i])) i++;
  if (i !== a.length) return null;
  return { action: action, proto: proto, src: s.spec, dst: d.spec, sport: sp, port: dp };
}
const portOk = function (sp, n) { if (!sp) return true; if (n == null) return false; return sp.op === "eq" ? n === sp.n : sp.op === "neq" ? n !== sp.n : sp.op === "gt" ? n > sp.n : sp.op === "lt" ? n < sp.n : n >= sp.n && n <= sp.m; };
/* does a line match a packet { proto: "icmp"|"tcp"|"udp", src, dst, port } */
export function aceMatch(e, pk) {
  if (e.remark) return false;
  if (e.proto !== "ip" && e.proto !== pk.proto) return false;
  if (!wildMatch(pk.src, e.src.ip, e.src.wild) || !wildMatch(pk.dst, e.dst.ip, e.dst.wild)) return false;
  return portOk(e.port, pk.port) && portOk(e.sport, pk.sport);
}
/* what an access list does with a packet: the first line that matches (its index), or the implicit deny at the end (-1).
   A list that doesn't exist permits everything, as an access-group naming a missing list does on the real thing */
export function aclVerdict(r, name, pk) {
  const L = r.acls[name]; if (!L) return { permit: true, line: null, missing: true };
  for (let i = 0; i < L.lines.length; i++) if (aceMatch(L.lines[i], pk)) return { permit: L.lines[i].action === "permit", line: i };
  return { permit: false, line: -1 };
}
const specText = function (s) { return s.wild === "255.255.255.255" ? "any" : s.wild === "0.0.0.0" ? "host " + s.ip : s.ip + " " + s.wild; };
const portText = function (p) { const w = function (n) { const k = Object.keys(PORT_WORDS).find(function (x) { return PORT_WORDS[x] === n && x !== "http" && x !== "https" && x !== "ssh"; }); return k || String(n); }; return p.op === "range" ? "range " + w(p.n) + " " + w(p.m) : p.op + " " + w(p.n); };
export function aceText(type, e) {
  if (e.remark) return "remark " + e.remark;
  if (type === "standard") return e.action + " " + (e.src.wild === "0.0.0.0" ? e.src.ip : specText(e.src));
  return [e.action, e.proto, specText(e.src)].concat(e.sport ? [portText(e.sport)] : [], [specText(e.dst)], e.port ? [portText(e.port)] : []).join(" ");
}
const aclType = function (num) { return num >= 1 && num <= 99 || num >= 1300 && num <= 1999 ? "standard" : num >= 100 && num <= 199 || num >= 2000 && num <= 2699 ? "extended" : null; };

/* ------------------------------------------------------------ DHCP */
/* the pool for an interface's network, if there is one */
export function poolFor(r, ip, mask) { const k = Object.keys(r.pools).find(function (p) { const q = r.pools[p]; return q.network && q.network === netOf(ip, mask) && q.mask === mask; }); return k ? Object.assign({ name: k }, r.pools[k]) : null; }
/* the addresses a pool hands out, lowest first: its network's usable addresses, less the excluded ones */
export function poolAddrs(r, name) {
  const q = r.pools[name]; if (!q || !q.network) return [];
  const lo = n4(q.network) + 1, hi = n4(q.network) + Math.pow(2, 32 - bits(q.mask)) - 2, out = [];
  for (let n = lo; n <= hi && out.length < 1024; n++) { const ip = s4(n); if (!r.excluded.some(function (x) { return n >= n4(x[0]) && n <= n4(x[1]); })) out.push(ip); }
  return out;
}

/* ------------------------------------------------------------ the commands */
const has = function (list, word) { return list.find(function (c) { return c[0] === word; }); };
const pick = function (list, words) { return words.map(function (w) { return has(list, w); }).filter(Boolean); };
const bad = ["% Invalid input detected at '^' marker."], inc = ["% Incomplete command."];

function setIfs(S, k, v) { S.ifs.forEach(function (n) { const f = ifOf(S.sw, n); if (f) f[k] = v; }); return []; }
function rtAddress(S, a) {
  if (!a.length) return inc;
  const n = S.ifs[0], f = ifOf(S.sw, n);
  if (/^dhcp$/i.test(a[0])) { if (isSub(n)) return bad; f.dhcp = true; f.ip = null; f.mask = null; return []; }
  if (a.length < 2) return inc; if (!ip4(a[0]) || !isMask(a[1])) return bad;
  if (isSub(n) && !f.vlan) return ["% Configuring IP routing on a LAN subinterface is only allowed if that", "subinterface is already configured as part of an IEEE 802.1Q vLAN."];
  if (a[0] === netOf(a[0], a[1]) || n4(a[0]) === n4(netOf(a[0], a[1])) + Math.pow(2, 32 - bits(a[1])) - 1) return ["Bad mask /" + bits(a[1]) + " for address " + a[0]];
  const clash = allIfs(S.sw).find(function (o) { const g = ifOf(S.sw, o); return o !== n && g && g.ip && netOf(g.ip, g.mask) === netOf(a[0], a[1]); });
  if (clash) return ["% " + netOf(a[0], a[1]) + " overlaps with " + clash];
  f.ip = a[0]; f.mask = a[1]; f.dhcp = false; return [];
}
function encap(S, a) {
  const n = S.ifs[0]; if (!isSub(n)) return ["% Invalid input detected at '^' marker.", "  (802.1Q tags go on a subinterface, such as " + n + ".10)"];
  if (!a.length || !/^dot1q$/i.test(a[0])) return a.length ? bad : inc;
  const v = a[1]; if (!v) return inc; if (!/^\d+$/.test(v) || +v < 1 || +v > 4094) return bad;
  if (a[2] && !/^native$/i.test(a[2])) return bad;
  const other = Object.keys(S.sw.subs).find(function (s) { return s !== n && s.split(".")[0] === n.split(".")[0] && S.sw.subs[s].vlan === +v; });
  if (other) return ["% VLAN ID " + v + " is already used by " + other];
  const f = S.sw.subs[n]; if (f.vlan && f.vlan !== +v) { f.ip = null; f.mask = null; }   /* a new tag clears the address, as on the real thing */
  f.vlan = +v; f.native = !!a[2]; return [];
}
function accessGroup(S, a, off) {
  if (a.length < 2) return inc; const dir = a[1].toLowerCase(); if (dir !== "in" && dir !== "out") return bad;
  const f = ifOf(S.sw, S.ifs[0]), k = dir === "in" ? "aclIn" : "aclOut";
  if (off) { f[k] = null; return []; }
  f[k] = a[0]; return [];
}
function aclLine(S, name, type, a) {
  if (/^remark$/i.test(a[0] || "")) { const t = a.slice(1).join(" "); if (!t) return inc; (S.sw.acls[name] = S.sw.acls[name] || { type: type, lines: [] }).lines.push({ remark: t }); return []; }
  const e = parseAce(type, a); if (!e) return a.length > 1 ? bad : inc;
  const L = S.sw.acls[name] = S.sw.acls[name] || { type: type, lines: [] };
  if (L.type !== type) return ["% Access list " + name + " is a " + L.type + " list"];
  L.lines.push(e); return [];
}
function natRule(S, a, off) {
  /* inside source list N interface X overload | inside source static [tcp|udp] LOCAL [LPORT] (interface X | GLOBAL) [GPORT] */
  if (!/^inside$/i.test(a[0] || "") || !/^source$/i.test(a[1] || "")) return a.length ? bad : inc;
  const w = (a[2] || "").toLowerCase();
  if (w === "list") {
    const list = a[3]; if (!list) return inc;
    if (!/^interface$/i.test(a[4] || "")) return a[4] ? ["% Only PAT onto an interface's address is set up here: ip nat inside source list " + list + " interface <outside interface> overload"] : inc;
    const f = rtName(a, 5); if (!f || f.err) return f && f.err === "incomplete" ? inc : bad;
    const ov = (a[5 + f.used] || "").toLowerCase() === "overload";
    const rule = { list: list, iface: f.name, overload: ov };
    S.sw.nat = S.sw.nat.filter(function (x) { return x.list !== list; });
    if (!off) S.sw.nat.push(rule);
    return [];
  }
  if (w === "static") {
    let i = 3, proto = null; if (/^(tcp|udp)$/i.test(a[3] || "")) { proto = a[3].toLowerCase(); i = 4; }
    const loc = a[i]; if (!ip4(loc)) return loc ? bad : inc; i++;
    let lport = null; if (proto) { if (!/^\d+$/.test(a[i] || "")) return inc; lport = +a[i]; i++; }
    let out = null, oif = null;
    if (/^interface$/i.test(a[i] || "")) { const f = rtName(a, i + 1); if (!f || f.err) return bad; oif = f.name; i += 1 + f.used; }
    else { if (!ip4(a[i])) return a[i] ? bad : inc; out = a[i]; i++; }
    let gport = null; if (proto) { if (!/^\d+$/.test(a[i] || "")) return inc; gport = +a[i]; i++; }
    const st = { proto: proto, local: loc, lport: lport, global: out, iface: oif, gport: gport };
    const same = function (x) { return x.local === st.local && x.lport === st.lport && x.proto === st.proto; };
    S.sw.statics = S.sw.statics.filter(function (x) { return !same(x); });
    if (!off) S.sw.statics.push(st);
    return [];
  }
  return bad;
}
function ipRoute(S, a, off) {
  if (a.length < 3) return inc; if (!ip4(a[0]) || !isMask(a[1])) return bad;
  const net = a[0], mask = a[1]; if (netOf(net, mask) !== net) return ["%Inconsistent address and mask"];
  let nh = null, iface = null; if (ip4(a[2])) nh = a[2]; else { const f = rtName(a, 2); if (!f || f.err) return bad; iface = f.name; }
  const same = function (x) { return x.net === net && x.mask === mask && x.nh === nh && x.iface === iface; };
  if (off) { S.sw.routes = S.sw.routes.filter(function (x) { return !(x.net === net && x.mask === mask && (a.length < 3 || same(x))); }); return []; }
  if (!S.sw.routes.some(same)) S.sw.routes.push({ net: net, mask: mask, nh: nh, iface: iface });
  return [];
}
function excluded(S, a, off) {
  if (!a.length) return inc; if (!ip4(a[0]) || (a[1] && !ip4(a[1]))) return bad;
  const lo = a[0], hi = a[1] || a[0]; if (n4(hi) < n4(lo)) return ["% Invalid input detected at '^' marker.", "  (the high address comes second)"];
  S.sw.excluded = S.sw.excluded.filter(function (x) { return !(x[0] === lo && x[1] === hi); });
  if (!off) S.sw.excluded.push([lo, hi]);
  return [];
}

const RT_IFACE = [
  ["description", "Interface specific description", function (S, a, raw) { const d = raw.replace(/^\s*\S+\s*/, ""); if (!d) return inc; return setIfs(S, "desc", d.slice(0, 240)); }],
  ["ip", "Interface Internet Protocol config commands", [
    ["address", "Set the IP address of an interface", function (S, a) { return rtAddress(S, a); }, { sub: [["A.B.C.D", "IP address"], ["dhcp", "IP Address negotiated via DHCP"]] }],
    ["nat", "NAT interface commands", [["inside", "Inside interface for address translation", function (S) { return setIfs(S, "nat", "inside"); }], ["outside", "Outside interface for address translation", function (S) { return setIfs(S, "nat", "outside"); }]]],
    ["access-group", "Specify access control for packets", function (S, a) { return accessGroup(S, a, false); }, { sub: [["WORD", "Access list name or number, then in or out"]] }]]],
  ["encapsulation", "Set encapsulation type for an interface", [["dot1Q", "IEEE 802.1Q Virtual LAN", function (S, a) { return encap(S, ["dot1q"].concat(a)); }, { sub: [["<1-4094>", "IEEE 802.1Q VLAN ID, then native for the untagged VLAN"]] }]]],
  ["speed", "Configure speed operation.", [["10", "Force 10 Mbps operation", function (S) { return setIfs(S, "speed", "10"); }], ["100", "Force 100 Mbps operation", function (S) { return setIfs(S, "speed", "100"); }], ["1000", "Force 1000 Mbps operation", function (S) { return setIfs(S, "speed", "1000"); }], ["auto", "Enable AUTO speed configuration", function (S) { return setIfs(S, "speed", "auto"); }]]],
  ["duplex", "Configure duplex operation.", [["full", "Force full duplex operation", function (S) { return setIfs(S, "duplex", "full"); }], ["half", "Force half-duplex operation", function (S) { return setIfs(S, "duplex", "half"); }], ["auto", "Enable AUTO duplex configuration", function (S) { return setIfs(S, "duplex", "auto"); }]]],
  ["shutdown", "Shutdown the selected interface", function (S) { setIfs(S, "shutdown", true); return S.ifs.map(function (n) { return "%LINK-5-CHANGED: Interface " + n + ", changed state to administratively down"; }); }],
  ["no", "Negate a command or set its defaults", [
    ["shutdown", "Shutdown the selected interface", function (S) { setIfs(S, "shutdown", false); return S.ifs.map(function (n) { const st = rtStatus(S.sw, n); return "%LINK-3-UPDOWN: Interface " + n + ", changed state to " + (st[0] === "up" ? "up" : "down"); }); }],
    ["description", "Interface specific description", function (S) { return setIfs(S, "desc", ""); }],
    ["ip", "Interface Internet Protocol config commands", [
      ["address", "Set the IP address of an interface", function (S) { S.ifs.forEach(function (n) { const f = ifOf(S.sw, n); f.ip = null; f.mask = null; f.dhcp = false; }); return []; }],
      ["nat", "NAT interface commands", [["inside", "Inside interface for address translation", function (S) { return setIfs(S, "nat", null); }], ["outside", "Outside interface for address translation", function (S) { return setIfs(S, "nat", null); }]]],
      ["access-group", "Specify access control for packets", function (S, a) { return accessGroup(S, a, true); }]]],
    ["encapsulation", "Set encapsulation type for an interface", [["dot1Q", "IEEE 802.1Q Virtual LAN", function (S) { S.ifs.forEach(function (n) { if (isSub(n)) { const f = S.sw.subs[n]; f.vlan = null; f.native = false; f.ip = null; f.mask = null; } }); return []; }]]],
    ["speed", "Configure speed operation.", function (S) { return setIfs(S, "speed", "auto"); }],
    ["duplex", "Configure duplex operation.", function (S) { return setIfs(S, "duplex", "auto"); }]]],
  ["interface", "Select an interface to configure", null],
  ["do", "To run exec commands in config mode", null],
  ["end", "Exit from configure mode", function (S) { S.mode = "priv"; S.ifs = null; return []; }],
  ["exit", "Exit from interface configuration mode", function (S) { S.mode = "config"; S.ifs = null; return []; }]
];
const RT_POOL = [
  ["network", "Network number and mask", function (S, a) {
    if (!a.length) return inc; if (!ip4(a[0])) return bad;
    let mask = a[1]; if (mask && /^\/\d+$/.test(mask)) mask = lenMask(+mask.slice(1)); if (!mask) return inc; if (!isMask(mask)) return bad;
    if (netOf(a[0], mask) !== a[0]) return ["% " + a[0] + " is not a network address with mask " + mask];
    const P = S.sw.pools[S.pool]; P.network = a[0]; P.mask = mask; return [];
  }, { sub: [["A.B.C.D", "Network number in dotted-decimal notation, then its mask (or /prefix)"]] }],
  ["default-router", "Default routers", function (S, a) { if (!a.length) return inc; if (!a.every(ip4)) return bad; S.sw.pools[S.pool].router = a.slice(0, 8); return []; }, { sub: [["A.B.C.D", "The gateway's address, as the clients will use it"]] }],
  ["dns-server", "DNS servers", function (S, a) { if (!a.length) return inc; if (!a.every(ip4)) return bad; S.sw.pools[S.pool].dns = a.slice(0, 8); return []; }, { sub: [["A.B.C.D", "Server's address"]] }],
  ["domain-name", "Domain name", function (S, a) { if (!a.length) return inc; S.sw.pools[S.pool].domain = a[0]; return []; }],
  ["lease", "Address lease time", function (S, a) { if (!a.length) return inc; if (/^infinite$/i.test(a[0])) { S.sw.pools[S.pool].lease = "infinite"; return []; } if (!/^\d+$/.test(a[0])) return bad; S.sw.pools[S.pool].lease = [+a[0], +(a[1] || 0), +(a[2] || 0)]; return []; }, { sub: [["<0-365>", "Days, then hours and minutes"], ["infinite", "Infinite lease"]] }],
  ["no", "Negate a command or set its defaults", [
    ["network", "Network number and mask", function (S) { const P = S.sw.pools[S.pool]; P.network = null; P.mask = null; return []; }],
    ["default-router", "Default routers", function (S) { S.sw.pools[S.pool].router = []; return []; }],
    ["dns-server", "DNS servers", function (S) { S.sw.pools[S.pool].dns = []; return []; }],
    ["domain-name", "Domain name", function (S) { S.sw.pools[S.pool].domain = null; return []; }],
    ["lease", "Address lease time", function (S) { S.sw.pools[S.pool].lease = [1, 0, 0]; return []; }]]],
  ["do", "To run exec commands in config mode", null],
  ["end", "Exit from configure mode", function (S) { S.mode = "priv"; S.pool = null; return []; }],
  ["exit", "Exit from DHCP pool configuration mode", function (S) { S.mode = "config"; S.pool = null; return []; }]
];
const RT_NACL = [
  ["permit", "Specify packets to forward", function (S, a, raw) { return aclLine(S, S.acl, S.aclType, raw.trim().split(/\s+/)); }],
  ["deny", "Specify packets to reject", function (S, a, raw) { return aclLine(S, S.acl, S.aclType, raw.trim().split(/\s+/)); }],
  ["remark", "Access list entry comment", function (S, a, raw) { return aclLine(S, S.acl, S.aclType, raw.trim().split(/\s+/)); }],
  ["do", "To run exec commands in config mode", null],
  ["end", "Exit from configure mode", function (S) { S.mode = "priv"; S.acl = null; return []; }],
  ["exit", "Exit from access-list configuration mode", function (S) { S.mode = "config"; S.acl = null; return []; }]
];

const RT_CONFIG = pick(CONFIG, ["hostname", "enable", "line", "username", "crypto", "service", "banner", "do", "end", "exit"]).concat([
  ["interface", "Select an interface to configure", function (S, a) {
    if (!a.length) return inc;
    const f = rtName(a, 0); if (!f) return bad; if (f.err === "incomplete") return inc; if (f.err) return bad;
    if (f.sub != null && !S.sw.subs[f.name]) S.sw.subs[f.name] = { desc: "", vlan: null, native: false, ip: null, mask: null, shutdown: false, nat: null, aclIn: null, aclOut: null };   /* a subinterface is made by naming it */
    S.mode = "if"; S.ifs = [f.name]; return [];
  }, { sub: [["GigabitEthernet", "GigabitEthernet IEEE 802.3z (add .N for a subinterface)"]] }],
  ["ip", "Global IP configuration subcommands", [
    has(has(CONFIG, "ip")[2], "domain-name"), has(has(CONFIG, "ip")[2], "ssh"),
    ["route", "Establish static routes", function (S, a) { return ipRoute(S, a, false); }, { sub: [["A.B.C.D", "Destination prefix, then its mask, then the next hop's address or the way-out interface"]] }],
    ["dhcp", "Configure DHCP server and relay parameters", [
      ["excluded-address", "Prevent DHCP from assigning certain addresses", function (S, a) { return excluded(S, a, false); }, { sub: [["A.B.C.D", "Low IP address, then (if a range) the high one"]] }],
      ["pool", "Configure DHCP address pools", function (S, a) { if (!a.length) return inc; if (!S.sw.pools[a[0]]) S.sw.pools[a[0]] = { network: null, mask: null, router: [], dns: [], domain: null, lease: [1, 0, 0] }; S.mode = "dhcp"; S.pool = a[0]; return []; }, { sub: [["WORD", "Pool name"]] }]]],
    ["access-list", "Named access-list", [
      ["standard", "Standard Access List", function (S, a) { if (!a.length) return inc; return namedAcl(S, a[0], "standard"); }],
      ["extended", "Extended Access List", function (S, a) { if (!a.length) return inc; return namedAcl(S, a[0], "extended"); }]]],
    ["nat", "NAT configuration commands", function (S, a) { return natRule(S, a, false); }, { sub: [["inside", "Inside address translation"]] }]]],
  ["access-list", "Add an access list entry", function (S, a) {
    if (!a.length) return inc; if (!/^\d+$/.test(a[0])) return bad;
    const type = aclType(+a[0]); if (!type) return bad;
    if (a.length < 2) return inc;
    return aclLine(S, a[0], type, a.slice(1));
  }, { sub: [["<1-99>", "IP standard access list (sources)"], ["<100-199>", "IP extended access list (protocol, source, destination, port)"]] }],
  ["no", "Negate a command or set its defaults", pick(has(CONFIG, "no")[2], ["hostname", "enable", "username", "service", "banner"]).concat([
    ["interface", "Select an interface to configure", function (S, a) { const f = rtName(a, 0); if (!f || f.err || f.sub == null) return ["% Invalid input detected at '^' marker.", "  (only a subinterface can be removed)"]; delete S.sw.subs[f.name]; return []; }],
    ["ip", "Global IP configuration subcommands", [
      has(has(has(CONFIG, "no")[2], "ip")[2], "domain-name"),
      ["route", "Establish static routes", function (S, a) { return ipRoute(S, a, true); }],
      ["dhcp", "Configure DHCP server and relay parameters", [
        ["excluded-address", "Prevent DHCP from assigning certain addresses", function (S, a) { return excluded(S, a, true); }],
        ["pool", "Configure DHCP address pools", function (S, a) { if (!a.length) return inc; if (!S.sw.pools[a[0]]) return ["%Pool " + a[0] + " not found"]; delete S.sw.pools[a[0]]; return []; }]]],
      ["access-list", "Named access-list", [
        ["standard", "Standard Access List", function (S, a) { if (a[0]) delete S.sw.acls[a[0]]; return []; }],
        ["extended", "Extended Access List", function (S, a) { if (a[0]) delete S.sw.acls[a[0]]; return []; }]]],
      ["nat", "NAT configuration commands", function (S, a) { return natRule(S, a, true); }]]],
    ["access-list", "Add an access list entry", function (S, a) { if (!a.length) return inc; delete S.sw.acls[a[0]]; return []; }]]),
  ]]);
function namedAcl(S, name, type) {
  if (/^\d+$/.test(name)) { const t = aclType(+name); if (t && t !== type) return bad; }
  if (S.sw.acls[name] && S.sw.acls[name].type !== type) return ["% A named " + S.sw.acls[name].type + " IP access list with this name already exists"];
  if (!S.sw.acls[name]) S.sw.acls[name] = { type: type, lines: [], named: true };
  S.mode = type === "standard" ? "sacl" : "nacl"; S.acl = name; S.aclType = type; return [];
}

/* config sub-modes take the global commands that move you elsewhere, as the real thing does */
RT_IFACE.find(function (c) { return c[0] === "interface"; }).splice(2, 2, has(RT_CONFIG, "interface")[2], has(RT_CONFIG, "interface")[3]);
[RT_IFACE, RT_POOL, RT_NACL].forEach(function (t) { t.find(function (c) { return c[0] === "do"; })[2] = has(CONFIG, "do")[2]; });
const RT_LINE = LINE.filter(function (c) { return c[0] !== "vlan"; });
RT_IFACE.splice(0, 0, ["line", "Configure a terminal line", has(CONFIG, "line")[2]]);
RT_POOL.splice(0, 0, ["interface", "Select an interface to configure", has(RT_CONFIG, "interface")[2], has(RT_CONFIG, "interface")[3]]);
const RT_LINE2 = RT_LINE.map(function (c) { return c[0] === "line" ? ["line", c[1], has(CONFIG, "line")[2]] : c; });
RT_LINE2.splice(0, 0, ["interface", "Select an interface to configure", has(RT_CONFIG, "interface")[2], has(RT_CONFIG, "interface")[3]]);

/* ------------------------------------------------------------ the show outputs */
function rtBrief(r, live) {
  const L = [pad("Interface", 27) + pad("IP-Address", 16) + "OK? " + pad("Method", 7) + pad("Status", 22) + "Protocol"];
  allIfs(r).forEach(function (n) { const f = ifOf(r, n), a = addrOf(r, n, live), s = rtStatus(r, n); L.push(pad(n, 27) + pad(a ? a.ip : "unassigned", 16) + "YES " + pad(f.dhcp ? "DHCP" : f.ip ? "manual" : "unset", 7) + pad(s[0], 22) + s[1]); });
  return L;
}
function rtRoutes(r, live) {
  const T = routes(r, live), gw = T.find(function (t) { return t.code === "S*"; });
  const L = ["Codes: L - local, C - connected, S - static, * - candidate default", "", gw ? "Gateway of last resort is " + (gw.nh || "0.0.0.0") + " to network 0.0.0.0" : "Gateway of last resort is not set", ""];
  T.slice().sort(function (a, b) { return n4(a.net) - n4(b.net) || bits(a.mask) - bits(b.mask); }).forEach(function (t) {
    const len = "/" + bits(t.mask);
    if (t.code === "C") L.push("C        " + t.net + len + " is directly connected, " + t.iface);
    else if (t.code === "L") L.push("L        " + t.net + len + " is directly connected, " + t.iface);
    else L.push(pad(t.code, 9) + t.net + len + " [1/0] via " + (t.nh || t.iface) + (t.nh && t.iface ? ", " + t.iface : ""));
  });
  return L;
}
function rtAcls(r, only, live) {
  const L = [], hits = (live && live("hits")) || {};
  Object.keys(r.acls).filter(function (k) { return !only || k === only; }).sort(function (a, b) { const x = /^\d+$/.test(a), y = /^\d+$/.test(b); return x && y ? +a - +b : x ? -1 : y ? 1 : a < b ? -1 : 1; }).forEach(function (k) {
    const A = r.acls[k], num = /^\d+$/.test(k);
    L.push((A.type === "standard" ? "Standard" : "Extended") + " IP access list " + k);
    let seq = 0; A.lines.forEach(function (e, i) { if (e.remark) return; seq += 10; const h = hits[k] && hits[k][i]; L.push("    " + seq + " " + aceText(A.type, e) + (h ? " (" + h + " match" + (h === 1 ? "" : "es") + ")" : "")); });
    if (!num && !A.lines.filter(function (e) { return !e.remark; }).length) L.push("    (no entries: everything is denied by the implicit deny at the end)");
  });
  return L;
}
function rtBindings(r, live) {
  const B = (live && live("leases")) || [];
  const L = ["Bindings from all pools not associated with VRF:", pad("IP address", 18) + pad("Client-ID/", 22) + pad("Lease expiration", 26) + "Type", pad("", 18) + pad("Hardware address", 22)];
  B.forEach(function (b) { const h = b.mac.replace(/[^0-9a-f]/gi, "").toLowerCase(); L.push(pad(b.ip, 18) + pad(h.slice(0, 4) + "." + h.slice(4, 8) + "." + h.slice(8, 12), 22) + pad(b.expires || "Oct 20 2026 09:14 AM", 26) + "Automatic"); });
  return L;
}
function rtPools(r, live) {
  const B = (live && live("leases")) || [], L = [];
  Object.keys(r.pools).forEach(function (k) {
    const P = r.pools[k], A = poolAddrs(r, k), used = B.filter(function (b) { return b.pool === k; }).length;
    L.push("", "Pool " + k + " :", " Utilization mark (high/low)    : 100 / 0", " Subnet size (first/next)       : 0 / 0", " Total addresses                : " + (P.network ? Math.pow(2, 32 - bits(P.mask)) - 2 : 0), " Leased addresses               : " + used, " Excluded addresses             : " + (P.network ? Math.pow(2, 32 - bits(P.mask)) - 2 - A.length : 0), " Pending event                  : none");
    if (P.network) L.push(" 1 subnet is currently in the pool :", " Current index        IP address range                    Leased/Excluded/Total", " " + pad(A.length > used ? A[used] : "0.0.0.0", 21) + pad(s4(n4(P.network) + 1) + "    - " + s4(n4(P.network) + Math.pow(2, 32 - bits(P.mask)) - 2), 36) + used + "    / " + (Math.pow(2, 32 - bits(P.mask)) - 2 - A.length) + "     / " + (Math.pow(2, 32 - bits(P.mask)) - 2));
    else L.push(" (no network: this pool hands out nothing)");
  });
  return L.length ? L : ["% No DHCP pools are configured"];
}
function rtNat(r, live) {
  const T = (live && live("nat")) || [];
  const L = [pad("Pro", 5) + pad("Inside global", 22) + pad("Inside local", 22) + pad("Outside local", 22) + "Outside global"];
  (r.statics || []).forEach(function (x) {   /* the static mappings (port forwards), listed whether or not anything has used them */
    const ga = x.iface ? addrOf(r, x.iface, live) : null, g = x.iface ? (ga ? ga.ip : null) : x.global; if (!g) return;
    L.push(pad(x.proto || "---", 5) + pad(g + (x.gport != null ? ":" + x.gport : ""), 22) + pad(x.local + (x.lport != null ? ":" + x.lport : ""), 22) + pad("---", 22) + "---");
  });
  T.forEach(function (t) { L.push(pad(t.proto, 5) + pad(t.ig, 22) + pad(t.il, 22) + pad(t.ol, 22) + t.og); });
  return L;
}
function rtIfDetail(r, n, live) {
  const f = ifOf(r, n), s = rtStatus(r, n), a = addrOf(r, n, live);
  const L = [n + " is " + s[0] + ", line protocol is " + s[1], "  Hardware is BR-4200 Gigabit Ethernet, address is " + r.mac + " (bia " + r.mac + ")"];
  if (f.desc) L.push("  Description: " + f.desc);
  L.push(a ? "  Internet address is " + a.ip + "/" + bits(a.mask) : "  Internet address is not set");
  if (isSub(n)) L.push("  Encapsulation 802.1Q Virtual LAN, Vlan ID  " + (f.vlan || "(none)") + (f.native ? " (native)" : ""));
  else L.push("  MTU 1500 bytes, BW 1000000 Kbit/sec, DLY 10 usec,", "  Full Duplex, 1000Mbps, media type is " + (RT_SFP.indexOf(n) >= 0 ? "SFP" : "RJ45"));
  if (f.aclIn || f.aclOut) L.push("  Inbound  access list is " + (f.aclIn || "not set"), "  Outgoing access list is " + (f.aclOut || "not set"));
  return L;
}
function rtRunning(r, startup) {
  const L = ["Building configuration...", "", "Current configuration : " + (1400 + JSON.stringify(r.subs).length % 900) + " bytes", "!", "version 4.2", r.encrypt ? "service password-encryption" : "no service password-encryption", "!", "hostname " + r.hostname, "!"];
  const pw = function (p, kind) { return pwText(r, p, kind); };
  if (r.enableSecret) L.push("enable secret " + pw(r.enableSecret, "secret"));
  if (r.enablePassword) L.push("enable password " + pw(r.enablePassword));
  if (r.enableSecret || r.enablePassword) L.push("!");
  r.excluded.forEach(function (x) { L.push("ip dhcp excluded-address " + x[0] + (x[1] !== x[0] ? " " + x[1] : "")); });
  if (r.excluded.length) L.push("!");
  Object.keys(r.pools).forEach(function (k) { const P = r.pools[k]; L.push("ip dhcp pool " + k); if (P.network) L.push(" network " + P.network + " " + P.mask); if (P.router.length) L.push(" default-router " + P.router.join(" ")); if (P.dns.length) L.push(" dns-server " + P.dns.join(" ")); if (P.domain) L.push(" domain-name " + P.domain); if (P.lease === "infinite") L.push(" lease infinite"); else if (P.lease.join() !== "1,0,0") L.push(" lease " + P.lease.filter(function (x, i) { return i === 0 || x; }).join(" ")); L.push("!"); });
  if (r.domain) L.push("ip domain-name " + r.domain);
  Object.keys(r.users).forEach(function (u) { L.push("username " + u + " secret " + pw(r.users[u], "secret")); });
  if (r.domain || Object.keys(r.users).length) L.push("!");
  allIfs(r).forEach(function (n) {
    const f = ifOf(r, n); L.push("interface " + n);
    if (f.desc) L.push(" description " + f.desc);
    if (isSub(n) && f.vlan) L.push(" encapsulation dot1Q " + f.vlan + (f.native ? " native" : ""));
    L.push(f.dhcp ? " ip address dhcp" : f.ip ? " ip address " + f.ip + " " + f.mask : " no ip address");
    if (f.aclIn) L.push(" ip access-group " + f.aclIn + " in");
    if (f.aclOut) L.push(" ip access-group " + f.aclOut + " out");
    if (f.nat) L.push(" ip nat " + f.nat);
    if (f.shutdown) L.push(" shutdown");
    if (!isSub(n)) { if (f.speed !== "auto") L.push(" speed " + f.speed); if (f.duplex !== "auto") L.push(" duplex " + f.duplex); }
    L.push("!");
  });
  r.nat.forEach(function (x) { L.push("ip nat inside source list " + x.list + " interface " + x.iface + (x.overload ? " overload" : "")); });
  r.statics.forEach(function (x) { L.push("ip nat inside source static " + (x.proto ? x.proto + " " : "") + x.local + (x.lport != null ? " " + x.lport : "") + (x.iface ? " interface " + x.iface : " " + x.global) + (x.gport != null ? " " + x.gport : "")); });
  r.routes.forEach(function (x) { L.push("ip route " + x.net + " " + x.mask + " " + (x.nh || x.iface)); });
  if (r.nat.length || r.statics.length || r.routes.length) L.push("!");
  Object.keys(r.acls).forEach(function (k) {
    const A = r.acls[k];
    if (A.named) { L.push("ip access-list " + A.type + " " + k); A.lines.forEach(function (e) { L.push(" " + aceText(A.type, e)); }); }
    else A.lines.forEach(function (e) { L.push("access-list " + k + " " + aceText(A.type, e)); });
  });
  if (Object.keys(r.acls).length) L.push("!");
  if (r.banner != null) L.push("banner motd ^C" + r.banner + "^C", "!");
  L.push("line con 0"); if (r.con.password) L.push(" password " + pw(r.con.password)); if (r.con.login) L.push(r.con.login === "local" ? " login local" : " login");
  L.push("line vty 0 4"); if (r.vty.password) L.push(" password " + pw(r.vty.password)); if (r.vty.login) L.push(r.vty.login === "local" ? " login local" : " login"); L.push(" transport input " + r.vty.transport);
  L.push("!", "end");
  return L;
}
function rtPing(S, a) {
  if (!a.length || !ip4(a[0])) return a.length ? ["% Unrecognized host or address, or protocol not running."] : inc;
  const r = S.reach ? S.reach(a[0]) : null, ok = r === true || (r && r.ok), n = r && r.n != null ? r.n : ok ? 5 : 0, marks = r && r.marks ? r.marks : (ok ? "!!!!!" : ".....");
  return ["Type escape sequence to abort.", "Sending 5, 100-byte ICMP Echos to " + a[0] + ", timeout is 2 seconds:", marks, "Success rate is " + (n * 20) + " percent (" + n + "/5)" + (n ? ", round-trip min/avg/max = 1/1/2 ms" : "")];
}

const RT_SHOW = pick(SHOW, ["startup-config", "history", "clock", "users", "ssh", "crypto"]).concat([
  ["version", "System hardware and software status", function (S) { const r = S.sw; return ["BR-4200 Network Operating System, Version 4.2.1", "", r.hostname + " uptime is " + r.uptime, "", "Model number: BR-4200 (8 x 10/100/1000 + 2 x SFP routed ports)", "Base MAC address: " + r.mac, "System serial number: " + r.serial, "", "System returned to ROM by " + (r.restart || "power-on"), "", "Configuration register: 0x2102"]; }],
  ["running-config", "Current operating configuration", function (S) { return rtRunning(S.sw); }],
  ["ip", "IP information", [
    ["interface", "IP interface status and configuration", [["brief", "Brief summary of IP status and configuration", function (S) { return rtBrief(S.sw, S.live); }]]],
    ["route", "IP routing table", function (S) { return rtRoutes(S.sw, S.live); }],
    ["dhcp", "Show items in the DHCP database", [["binding", "DHCP address bindings", function (S) { return rtBindings(S.sw, S.live); }], ["pool", "DHCP pools information", function (S) { return rtPools(S.sw, S.live); }]]],
    ["nat", "IP NAT information", [["translations", "Translation entries", function (S) { return rtNat(S.sw, S.live); }]]],
    ["access-lists", "List IP access lists", function (S, a) { return rtAcls(S.sw, a[0], S.live); }]]],
  ["access-lists", "List access lists", function (S, a) { return rtAcls(S.sw, a[0], S.live); }],
  ["lldp", "LLDP information (neighbour discovery)", [["neighbors", "LLDP neighbor entries", function (S, a) { return lldpTable(S.sw, a[0] && /^d/i.test(a[0]), RT_PORTS); }, { sub: [["detail", "Show detailed information: each neighbour's management address"]] }]]],
  ["interfaces", "Interface status and configuration", function (S, a) {
    if (!a.length) return allIfs(S.sw).reduce(function (L, n) { return L.concat(rtIfDetail(S.sw, n, S.live)); }, []);
    const f = rtName(a, 0); if (!f || f.err || !ifOf(S.sw, f.name)) return bad;
    return rtIfDetail(S.sw, f.name, S.live);
  }, { sub: [["GigabitEthernet", "GigabitEthernet IEEE 802.3z"]] }]
]);
const RT_USER = EXEC_USER.map(function (c) { return c[0] === "show" ? ["show", c[1], RT_SHOW.filter(function (x) { return ["version", "clock", "history", "users", "ip", "interfaces"].indexOf(x[0]) >= 0; })] : c[0] === "ping" ? ["ping", c[1], function (S, a) { return rtPing(S, a); }] : c; });
const RT_CLEAR_IP = ["ip", "IP", [["nat", "Clear NAT", [["translation", "Clear dynamic translation", function (S) { if (S.live) S.live("clear-nat"); return []; }]]], ["dhcp", "Delete items from the DHCP database", [["binding", "DHCP address bindings", function (S) { if (S.live) S.live("clear-dhcp"); return []; }]]], ["access-list", "Clear access list statistical information", [["counters", "Clear access list counters", function (S) { if (S.live) S.live("clear-hits"); return []; }]]]]];
const RT_PRIV = EXEC_PRIV.map(function (c) { return c[0] === "show" ? ["show", c[1], RT_SHOW] : c[0] === "ping" ? ["ping", c[1], function (S, a) { return rtPing(S, a); }] : c[0] === "clear" ? ["clear", c[1], c[2].concat([RT_CLEAR_IP])] : c; });

registerOS("router", {
  tree: { user: RT_USER, priv: RT_PRIV, config: RT_CONFIG, if: RT_IFACE, line: RT_LINE2, dhcp: RT_POOL, nacl: RT_NACL, sacl: RT_NACL },
  prompts: { if: "(config-if)#", dhcp: "(dhcp-config)#", nacl: "(config-ext-nacl)#", sacl: "(config-std-nacl)#" },
  keys: RT_KEYS, fresh: function () { return newRouter(); }, config: rtRunning, image: "BR-4200 Network Operating System, Version 4.2.1",
  bootUp: function (r, n) { const f = ifOf(r, n); if (f) f.shutdown = false; }
});
export { pwOk, netOf, bits, n4, s4 };
