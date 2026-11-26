/* Level 5, work order 2 (EN-J2): watching the network from the file server. Plain functions over the simulation, no page code: tested
   under Node. A check never changes the network; a poll from the server is remembered (as the server's own record that it asked).
   - The SNMP agent on each switch and router: what it answers a request that reaches it (its communities for v1 and v2c; for v3 a user,
     its keys and its group's security level), and the MIB rows it answers from (the system group and the interfaces table).
   - Net-SNMP's snmpget, snmpwalk and snmpbulkwalk on a server: their options, ~/.snmp/snmp.conf's defaults, their output and real errors.
   - Notifications from the gear (a change to the configuration) into snmptrapd on the server, written to its system log.
   - tcpdump on a server's port: what reaches it. A port mirrored to it (a SPAN destination) gets a copy of the source port's traffic,
     both ways or one; an ordinary switch port only the switch's own spanning-tree and LLDP frames. To the screen, or to a file. */
import * as SV from "./svc.js";
import { snmpKey, spanDest, portUp, LEVELS3 } from "./swcli.js";

const pad = function (s, n) { s = String(s); return s + (s.length < n ? " ".repeat(n - s.length) : ""); };
const hash = function (s) { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h; };
function clockOf(sim) { const s = 10 * 3600 + 42 * 60 + 7 + (sim.n || 0) * 3, two = function (v) { return (v < 10 ? "0" : "") + v; }; return { day: "Nov 22", hms: two(Math.floor(s / 3600) % 24) + ":" + two(Math.floor(s / 60) % 60) + ":" + two(s % 60), s: s }; }
const SECLEVELS = ["noauthnopriv", "authnopriv", "authpriv"];
export const SEC_NAME = { noauthnopriv: "noAuthNoPriv", authnopriv: "authNoPriv", authpriv: "authPriv" };

/* ------------------------------------------------------------ the agent's MIB: the system group and the interfaces table */
const SYS = "1.3.6.1.2.1.1", IFS = "1.3.6.1.2.1.2", IFT = IFS + ".2.1";
export const OIDS = { "mib-2": "1.3.6.1.2.1", mib2: "1.3.6.1.2.1", system: SYS, sysDescr: SYS + ".1", sysObjectID: SYS + ".2", sysUpTime: SYS + ".3", sysUpTimeInstance: SYS + ".3.0", sysContact: SYS + ".4", sysName: SYS + ".5", sysLocation: SYS + ".6", sysServices: SYS + ".7",
  interfaces: IFS, ifNumber: IFS + ".1", ifTable: IFS + ".2", ifEntry: IFT, ifIndex: IFT + ".1", ifDescr: IFT + ".2", ifType: IFT + ".3", ifMtu: IFT + ".4", ifSpeed: IFT + ".5", ifPhysAddress: IFT + ".6", ifAdminStatus: IFT + ".7", ifOperStatus: IFT + ".8", ifInOctets: IFT + ".10", ifInErrors: IFT + ".14", ifOutOctets: IFT + ".16" };
const BY_NUM = {}; Object.keys(OIDS).forEach(function (k) { if (!/^(mib2|sysUpTimeInstance)$/.test(k)) BY_NUM[OIDS[k]] = k; });
const MODULE = function (num) { return num.indexOf(SYS) === 0 ? "SNMPv2-MIB" : num.indexOf(IFS) === 0 ? "IF-MIB" : "SNMPv2-SMI"; };
/* "SNMPv2-MIB::sysName.0" for a row's number */
export function oidName(num) {
  if (num === SYS + ".3.0") return "DISMAN-EVENT-MIB::sysUpTimeInstance";
  const parts = num.split("."); for (let i = parts.length; i > 0; i--) { const base = parts.slice(0, i).join("."), n = BY_NUM[base]; if (n) return MODULE(num) + "::" + n + (i < parts.length ? "." + parts.slice(i).join(".") : ""); }
  return "SNMPv2-SMI::" + num;
}
const ticks = function (t) { const cs = t % 100, s = Math.floor(t / 100), d = Math.floor(s / 86400), h = Math.floor(s / 3600) % 24, m = Math.floor(s / 60) % 60, sec = s % 60, two = function (v) { return (v < 10 ? "0" : "") + v; };
  return "(" + t + ") " + (d ? d + " day" + (d === 1 ? "" : "s") + ", " : "") + h + ":" + two(m) + ":" + two(sec) + "." + two(cs); };
export function uptimeTicks(sim, id) { return 15230000 + (hash(id) % 400000) + (sim.n || 0) * 300; }
/* the device's interfaces as the agent numbers them: a switch's 28 ports, a router's routed ports */
function ifRows(sim, id) {
  const x = sim.d[id], sw = x.sw;
  if (x.kind === "mswitch") {
    const view = Object.assign({}, sw, { links: sim.switchLinks(id) });
    return Object.keys(sw.ports).map(function (n) { const p = sw.ports[n], up = portUp(view, n); return { name: n, admin: !p.shutdown, up: up, mtu: sw.jumboRun || 1500, speed: up ? 1000000000 : 10000000 }; });
  }
  return Object.keys(sw.ifs || {}).filter(function (n) { return n.indexOf(".") < 0; }).map(function (n) {
    const f = sw.ifs[n], short = n.replace("GigabitEthernet", "Gi"), c = sim.cableAt(id, short), up = !f.shutdown && !!c && sim.cableUp(c);
    return { name: n, admin: !f.shutdown, up: up, mtu: 1500, speed: up ? 1000000000 : 10000000 };
  });
}
export function mibRows(sim, id) {
  const x = sim.d[id], sw = x.sw, o = sw.snmp || {}, router = x.kind === "brouter", I = ifRows(sim, id), mac = String(x.mac || sw.mac || "").replace(/[^0-9a-f]/gi, "").toLowerCase();
  const R = [
    [SYS + ".1.0", "STRING", (router ? "BR-4200 Network Operating System, Version 4.2.1" : (sw.model === "MSW-3900X" ? "MSW-3900X" : "MSW-2800G") + " Network Operating System, Version 4.2.1")],
    [SYS + ".2.0", "OID", "SNMPv2-SMI::enterprises.99999.1." + (router ? "4200" : sw.model === "MSW-3900X" ? "3900" : "2800")],   /* our own unbranded gear: a made-up enterprise number */
    [SYS + ".3.0", "Timeticks", ticks(uptimeTicks(sim, id))],
    [SYS + ".4.0", "STRING", o.contact || ""], [SYS + ".5.0", "STRING", sw.hostname + (sw.domain ? "." + sw.domain : "")], [SYS + ".6.0", "STRING", o.loc || ""],
    [SYS + ".7.0", "INTEGER", router ? "78" : "6"], [IFS + ".1.0", "INTEGER", String(I.length)]];
  const col = function (c, f) { I.forEach(function (r, i) { R.push([IFT + "." + c + "." + (i + 1)].concat(f(r, i))); }); };
  col(1, function (r, i) { return ["INTEGER", String(i + 1)]; }); col(2, function (r) { return ["STRING", r.name]; }); col(3, function () { return ["INTEGER", "ethernetCsmacd(6)"]; });
  col(4, function (r) { return ["INTEGER", String(r.mtu)]; }); col(5, function (r) { return ["Gauge32", String(r.speed)]; });
  col(6, function (r, i) { const m = (parseInt(mac.slice(-2) || "0", 16) + i + 1) % 256; return ["STRING", (mac.slice(0, 10) || "00e04c0000").match(/../g).map(function (b) { return String(parseInt(b, 16).toString(16)); }).join(":") + ":" + m.toString(16)]; });
  col(7, function (r) { return ["INTEGER", r.admin ? "up(1)" : "down(2)"]; }); col(8, function (r) { return ["INTEGER", r.up ? "up(1)" : "down(2)"]; });
  col(10, function (r) { return ["Counter32", String(r.up ? 48211934 + hash(id + r.name) % 900000000 : 0)]; }); col(14, function () { return ["Counter32", "0"]; });
  col(16, function (r) { return ["Counter32", String(r.up ? 21774231 + hash(r.name + id) % 900000000 : 0)]; });
  const cmp = function (a, b) { const p = a.split(".").map(Number), q = b.split(".").map(Number); for (let i = 0; i < Math.max(p.length, q.length); i++) { if (p[i] == null) return -1; if (q[i] == null) return 1; if (p[i] !== q[i]) return p[i] - q[i]; } return 0; };
  return R.map(function (r) { return { num: r[0], type: r[1], val: r[2] }; }).sort(function (a, b) { return cmp(a.num, b.num); });
}
/* an OID as typed: "sysName.0", "SNMPv2-MIB::sysName.0", ".1.3.6.1.2.1.1.5.0", "1.3.6.1.2.1.1.5.0" → its number, or { err } */
export function oidOf(raw) {
  const t = String(raw).replace(/^[\w-]+::/, "");
  if (/^\.?\d+(\.\d+)*$/.test(t)) return { num: t.replace(/^\./, "") };
  const m = /^([A-Za-z][\w-]*)((?:\.\d+)*)$/.exec(t); if (!m) return { err: raw + ": Unknown Object Identifier (Sub-id not found: (top) -> " + t + ")" };
  const base = OIDS[m[1]]; if (!base) return { err: raw + ": Unknown Object Identifier (Sub-id not found: (top) -> " + m[1] + ")" };
  return { num: base + m[2] };
}
export function rowText(r, numeric) { return (numeric ? "." + r.num : oidName(r.num)) + " = " + (r.type === "STRING" && r.val === "" ? "STRING: " : r.type + ": " + r.val); }

/* ------------------------------------------------------------ the agent: what a request from a server gets back */
/* q: { ver: "1" | "2c" | "3", comm, user, level (one of SECLEVELS), aa, ap, xa, xp } */
export function agent(sim, srv, ip, q) {
  const p = SV.pathFrom(sim, srv, ip), id = p.ok ? p.owner : null, x = id && sim.d[id];
  if (!x || !x.sw || (x.kind !== "mswitch" && x.kind !== "brouter")) return { err: "timeout" };
  const sw = x.sw, o = sw.snmp, U = sw.snmpUsers || {};
  if (!o && !Object.keys(U).length) return { err: "timeout", id: id };   /* no agent running: nothing answers on UDP 161 */
  if (q.ver !== "3") { const c = o && o.comms.find(function (k) { return k.name === q.comm; }); return c ? { ok: true, id: id, how: "v" + q.ver, rw: c.rw } : { err: "timeout", id: id }; }   /* a wrong community gets no answer at all */
  const u = U[q.user]; if (!u || u.ver !== "v3") return { err: "user", id: id };
  const want = SECLEVELS.indexOf(q.level), has = u.priv ? 2 : u.auth ? 1 : 0;
  if (want > has) return { err: "level", id: id };
  if (want >= 1 && (u.auth.alg !== q.aa || u.auth.key !== snmpKey(q.ap, q.aa))) return { err: "auth", id: id };
  if (want === 2 && (u.priv.alg !== q.xa || u.priv.key !== snmpKey(q.xp, q.xa))) return { err: "decrypt", id: id };
  const G = o && o.groups[u.group]; if (!G || G.ver !== "v3" || want < LEVELS3.indexOf(G.level)) return { err: "authz", id: id };
  return { ok: true, id: id, how: "v3", level: q.level };
}

/* ------------------------------------------------------------ snmpget, snmpwalk, snmpbulkwalk on a server */
const HOME = function (sim, id, st) { return st && st.root ? "/root" : "/home/" + ((st && st.user) || Object.keys(sim.d[id].lx.users || {})[0]); };
/* ~/.snmp/snmp.conf and /etc/snmp/snmp.conf: the defaults Net-SNMP's tools read (defVersion, defSecurityName, defSecurityLevel,
   defAuthType, defAuthPassphrase, defPrivType, defPrivPassphrase, defCommunity) */
function snmpDefaults(sim, id, st) {
  const F = sim.d[id].lx.files || {}, out = {};
  ["/etc/snmp/snmp.conf", HOME(sim, id, st) + "/.snmp/snmp.conf"].forEach(function (path) {
    const t = F[path] && F[path].text; if (!t) return;
    t.split("\n").forEach(function (l) { const m = /^\s*(def\w+)\s+(.+?)\s*$/.exec(l.replace(/#.*$/, "")); if (m) out[m[1].toLowerCase()] = m[2].replace(/^"|"$/g, ""); });
  });
  return out;
}
const PRIV = function (s) { s = String(s || "").toUpperCase(); return s === "AES" || s === "AES128" ? "AES128" : s; };
export function snmpTool(sim, id, st, c, args) {
  const D = snmpDefaults(sim, id, st), q = { ver: D.defversion || "3", comm: D.defcommunity || null, user: D.defsecurityname || null, level: (D.defsecuritylevel || "noAuthNoPriv").toLowerCase(), aa: (D.defauthtype || "MD5").toUpperCase(), ap: D.defauthpassphrase || null, xa: PRIV(D.defprivtype || "DES"), xp: D.defprivpassphrase || null };
  let numeric = false; const rest = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i], v = function () { return a.length > 2 ? a.slice(2) : args[++i]; };
    if (/^-v/.test(a)) q.ver = String(v() || "").toLowerCase(); else if (/^-c/.test(a)) q.comm = v(); else if (/^-l/.test(a)) q.level = String(v() || "").toLowerCase();
    else if (/^-u/.test(a)) q.user = v(); else if (/^-a/.test(a)) q.aa = String(v() || "").toUpperCase(); else if (/^-A/.test(a)) q.ap = v();
    else if (/^-x/.test(a)) q.xa = PRIV(v()); else if (/^-X/.test(a)) q.xp = v(); else if (/^-O/.test(a)) { if (/n/.test(v() || "")) numeric = true; }
    else if (/^-[trCmMIL]/.test(a)) v(); else if (/^-/.test(a)) return { out: [c + ": Unknown option: " + a, "USAGE: " + c + " [OPTIONS] AGENT OID [OID]..."] };
    else rest.push(a);
  }
  const host = rest.shift(), walk = c !== "snmpget";
  if (!host) return { out: ["No hostname specified.", "USAGE: " + c + " [OPTIONS] AGENT " + (walk ? "[OID]" : "OID [OID]...")] };
  if (!walk && !rest.length) return { out: ["Missing object name", "USAGE: snmpget [OPTIONS] AGENT OID [OID]..."] };
  if (["1", "2c", "3"].indexOf(q.ver) < 0) return { out: ["Invalid version specified after -v flag: " + q.ver] };
  if (q.ver !== "3" && !q.comm) return { out: ["No community name specified."] };
  if (q.ver === "3") {
    if (SECLEVELS.indexOf(q.level) < 0) return { out: ["Invalid security level specified after -l flag: " + q.level] };
    if (!q.user) return { out: [c + ": No securityName specified"] };
    if (["MD5", "SHA"].indexOf(q.aa) < 0) return { out: ["Invalid authentication protocol specified after -a flag: " + q.aa] };
    if (q.level !== "noauthnopriv" && (!q.ap || q.ap.length < 8)) return { out: [q.ap ? "Error: passphrase chosen is below the length requirements of the USM (min=8)." : c + ": Error generating a key (Ku) from the supplied authentication pass phrase."] };
    if (q.level === "authpriv" && (!q.xp || q.xp.length < 8)) return { out: [q.xp ? "Error: passphrase chosen is below the length requirements of the USM (min=8)." : c + ": Error generating a key (Ku) from the supplied privacy pass phrase."] };
  }
  const ip = host.replace(/^udp:/, "").replace(/:161$/, ""), r = agent(sim, id, ip, q);
  if (r.ok && r.how === "v3") { const P = sim.d[id].lx.snmpPolled || (sim.d[id].lx.snmpPolled = {}); P[r.id] = { level: q.level, user: q.user }; }   /* the server's own record that it asked, and was answered */
  if (r.ok && r.how !== "v3") { const P = sim.d[id].lx.snmpV12 || (sim.d[id].lx.snmpV12 = {}); P[r.id] = q.comm; }
  const facts = { snmp: c, host: ip, ok: !!r.ok, err: r.err || null, dev: r.id || null, ver: q.ver, level: q.level };
  if (!r.ok) {
    const out = r.err === "timeout" ? ["Timeout: No Response from " + ip + "."] : r.err === "user" ? [c + ": Unknown user name"] : r.err === "level" ? [c + ": Unsupported security level"]
      : r.err === "auth" ? [c + ": Authentication failure (incorrect password, community or key)"] : r.err === "decrypt" ? [c + ": Decryption error"] : null;
    if (out) return { out: out, facts: facts };
    const first = oidOf(rest[0] || "system"); return { out: ["Error in packet", "Reason: authorizationError (access denied to that object)", "Failed object: " + (first.num ? oidName(first.num) : rest[0])].slice(0, walk ? 2 : 3), facts: facts };
  }
  const rows = mibRows(sim, r.id), out = [];
  if (!walk) {
    for (const t of rest) { const o = oidOf(t); if (o.err) { out.push(o.err); continue; } const row = rows.find(function (x) { return x.num === o.num; });
      out.push(row ? rowText(row, numeric) : (numeric ? "." + o.num : oidName(o.num)) + " = " + (rows.some(function (x) { return x.num.indexOf(o.num.split(".").slice(0, -1).join(".") + ".") === 0; }) ? "No Such Instance currently exists at this OID" : "No Such Object available on this agent at this OID")); }
    return { out: out, facts: facts };
  }
  const o = oidOf(rest[0] || "mib-2"); if (o.err) return { out: [o.err], facts: facts };
  const got = rows.filter(function (x) { return x.num === o.num || x.num.indexOf(o.num + ".") === 0; });
  if (!got.length) return { out: [(numeric ? "." + o.num : oidName(o.num)) + " = No Such Object available on this agent at this OID"], facts: facts };
  return { out: got.map(function (x) { return rowText(x, numeric); }), facts: facts };
}

/* ------------------------------------------------------------ notifications: the gear to snmptrapd */
/* one notification (a change to the configuration) from a device to a host, as traps or informs: it lands in the server's log if
   snmptrapd runs there and its file takes it (a v3 user it knows with the same keys, and an authUser for it; traps from v3 need the
   sender's engine ID on createUser; v1 and v2c an authCommunity) */
export function notify(sim, dev, h, k) {
  const p = SV.pathFrom(sim, dev, h.ip); if (!p.ok) return false;
  const srv = p.owner, x = sim.d[srv]; if (!x || x.kind !== "server" || !x.lx || !x.lx.svc) return false;
  const T = x.lx.svc.snmptrapd; if (!T || T.state !== "active" || !T.run) return false;
  const run = T.run, sw = sim.d[dev].sw;
  if (h.ver === "3") {
    const u = (sw.snmpUsers || {})[h.name], tu = run.users[h.name]; if (!u || !tu) return false;
    const need = LEVELS3.indexOf(h.level); if (need >= 1 && (!u.auth || !tu.auth || u.auth.alg !== tu.auth.alg || u.auth.key !== snmpKey(tu.auth.pw, tu.auth.alg))) return false;
    if (need === 2 && (!u.priv || !tu.priv || u.priv.alg !== tu.priv.alg || u.priv.key !== snmpKey(tu.priv.pw, tu.priv.alg))) return false;
    if (h.kind !== "informs" && tu.eid !== (sw.engineId || null)) return false;   /* a v3 trap is keyed to the sender's engine ID */
    if (!run.noAuthz) { const lv = run.auth[h.name]; if (!lv || LEVELS3.indexOf(lv === "authnopriv" ? "auth" : lv === "noauth" ? "noauth" : lv) > need) return false; }
  } else if (!run.noAuthz && run.comms.indexOf(h.name) < 0) return false;
  const L = x.lx.syslog || (x.lx.syslog = []), port = 50000 + hash(dev + h.ip) % 15000, n = (sw.trapSeq = (sw.trapSeq || 0) + 1);
  L.push((k ? k.day + " " + k.hms : "Nov 22 10:42:07") + " " + x.host + " snmptrapd[" + T.pid + "]: <UNKNOWN> [UDP: [" + p.src + "]:" + port + "->[" + h.ip + "]:162]:#012DISMAN-EVENT-MIB::sysUpTimeInstance = Timeticks: " + ticks(uptimeTicks(sim, dev)) + "#011SNMPv2-MIB::snmpTrapOID.0 = OID: SNMPv2-SMI::enterprises.99999.43.2.0.1#011SNMPv2-SMI::enterprises.99999.43.1.1.6.1.3." + n + " = INTEGER: commandLine(1)#011SNMPv2-SMI::enterprises.99999.43.1.1.6.1.4." + n + " = INTEGER: running(2)#011SNMPv2-SMI::enterprises.99999.43.1.1.6.1.5." + n + " = INTEGER: commandSource(3)");
  if (L.length > 400) L.splice(0, L.length - 400);
  return true;
}
/* has a notification from this device's address reached the server? */
export function trapFrom(sim, srv, src) { const L = (sim.d[srv].lx && sim.d[srv].lx.syslog) || []; return !!src && L.some(function (l) { return / snmptrapd\[\d+\]: /.test(l) && l.indexOf("[UDP: [" + src + "]:") >= 0; }); }

/* ------------------------------------------------------------ tcpdump on a server port */
/* what a server's port receives: the switch port at the far end of its cable; if that's a SPAN destination, a copy of each source's
   traffic in the directions mirrored; otherwise only what a switch sends on any port (spanning tree, LLDP) */
export function heard(sim, id, nic) {
  const x = sim.d[id], f = x.ifaces.find(function (q) { return q.name === nic; }); if (!f) return null;
  const c = sim.cableAt(id, f.port); if (!c || !sim.cableUp(c)) return { link: false, frames: [] };
  const far = c.a.dev === id ? c.b : c.a, fd = sim.d[far.dev]; if (!fd || fd.kind !== "mswitch") return { link: true, frames: [] };
  const n = "GigabitEthernet0/" + far.port.replace(/^SFP(\d)$/, function (m, d) { return String(24 + +d); }), sw = fd.sw;
  const view = Object.assign({}, sw, { links: sim.switchLinks(far.dev) }); if (sw.ports[n] && sw.ports[n].shutdown) return { link: false, frames: [] };
  const M = spanDest(sw, n);
  if (!M) return { link: true, sw: far.dev, port: n, frames: [{ kind: "stp", sw: far.dev }, { kind: "lldp", sw: far.dev, port: n }] };
  const srcs = [];
  M.src.forEach(function (s) { if (portUp(view, s.ifc)) { const d = deviceOn(sim, far.dev, s.ifc); if (d) srcs.push({ dev: d, dir: s.dir }); } });
  if (M.vlans.length) Object.keys(sw.ports).forEach(function (pn) { const P = sw.ports[pn]; if (P.mode !== "trunk" && M.vlans.indexOf(P.access || 1) >= 0 && portUp(view, pn)) { const d = deviceOn(sim, far.dev, pn); if (d) srcs.push({ dev: d, dir: "both" }); } });
  return { link: true, sw: far.dev, port: n, span: M.id, frames: srcs.map(function (s) { return { kind: "host", dev: s.dev, dir: s.dir }; }) };
}
function deviceOn(sim, sw, ifc) { const port = ifc.replace(/^GigabitEthernet0\//, ""), p = +port > 24 ? "SFP" + (+port - 24) : port, c = sim.cableAt(sw, p); if (!c) return null; const v = sim.panelEnd && sim.panelEnd(c) ? sim.viaPanel(c) : c; if (!v) return null; const far = v.a.dev === sw ? v.b : v.a; return far.dev; }
/* a computer's traffic for a few seconds: its own (out) and to it (in); the same every time for the same computer */
function hostPackets(sim, dev) {
  const a = sim.addr(dev); if (!a || !a.ip) return [];
  const ip = a.ip, gw = a.gw, dns = (a.dns && a.dns[0]) || gw, h = hash(dev), sp = 49152 + h % 12000, web = "52.96." + (h % 200 + 20) + "." + (h % 90 + 100), q = 1000 + h % 60000;
  const vmac = "00:00:0c:07:ac:" + ("0" + ((+(gw || "0.0.0.1").split(".")[2]) % 256).toString(16)).slice(-2);
  return [
    { dir: "out", from: ip, to: dns, len: 39, text: "IP " + ip + "." + (sp + 3) + " > " + dns + ".53: " + q + "+ A? outlook.office365.com. (39)" },
    { dir: "in", from: dns, to: ip, len: 55, text: "IP " + dns + ".53 > " + ip + "." + (sp + 3) + ": " + q + " 1/0/0 A " + web + " (55)" },
    { dir: "out", from: ip, to: web, len: 0, text: "IP " + ip + "." + sp + " > " + web + ".443: Flags [S], seq " + (1938847331 + h % 99999) + ", win 64240, options [mss 1460,nop,wscale 8,nop,nop,sackOK], length 0" },
    { dir: "in", from: web, to: ip, len: 0, text: "IP " + web + ".443 > " + ip + "." + sp + ": Flags [S.], seq 2841990123, ack " + (1938847332 + h % 99999) + ", win 65535, options [mss 1440,nop,wscale 8,nop,nop,sackOK], length 0" },
    { dir: "out", from: ip, to: web, len: 0, text: "IP " + ip + "." + sp + " > " + web + ".443: Flags [.], ack 1, win 1026, length 0" },
    { dir: "out", from: ip, to: web, len: 517, text: "IP " + ip + "." + sp + " > " + web + ".443: Flags [P.], seq 1:518, ack 1, win 1026, length 517" },
    { dir: "in", from: web, to: ip, len: 1440, text: "IP " + web + ".443 > " + ip + "." + sp + ": Flags [.], seq 1:1441, ack 518, win 2052, length 1440" },
    { dir: "in", from: web, to: ip, len: 1440, text: "IP " + web + ".443 > " + ip + "." + sp + ": Flags [P.], seq 1441:2881, ack 518, win 2052, length 1440" },
    { dir: "out", from: ip, to: web, len: 0, text: "IP " + ip + "." + sp + " > " + web + ".443: Flags [.], ack 2881, win 1026, length 0" },
    { dir: "out", from: ip, to: gw, len: 28, text: "ARP, Request who-has " + gw + " tell " + ip + ", length 28" },
    { dir: "in", from: gw, to: ip, len: 46, text: "ARP, Reply " + gw + " is-at " + vmac + ", length 46" },
    { dir: "out", from: ip, to: "239.255.255.250", len: 174, text: "IP " + ip + "." + (sp + 9) + " > 239.255.255.250.1900: UDP, length 174" }];
}
/* each packet's time: from the server's clock, a few milliseconds apart, in order */
const stamp = function (sim, i) { const k = clockOf(sim), t = k.s * 1000000 + 104118 + i * 23117 + hash(i + "|" + (sim.n || 0)) % 997, s = Math.floor(t / 1000000), two = function (v) { return (v < 10 ? "0" : "") + v; };
  return two(Math.floor(s / 3600) % 24) + ":" + two(Math.floor(s / 60) % 60) + ":" + two(s % 60) + "." + String(t % 1000000).padStart(6, "0"); };
/* the packets a capture on this port takes, in order (with -c n, the first n, the traffic going on round again) */
export function capture(sim, id, nic, count) {
  const H = heard(sim, id, nic); if (!H || !H.link) return [];
  let all = [];
  H.frames.forEach(function (f) {
    if (f.kind === "host") all = all.concat(hostPackets(sim, f.dev).filter(function (p) { return f.dir === "both" || (f.dir === "rx" ? p.dir === "out" : p.dir === "in"); }).map(function (p) { return Object.assign({ host: f.dev }, p); }));
    else if (f.kind === "stp") { const s = sim.d[f.sw].sw; all.push({ dir: "sw", from: null, to: null, len: 43, text: "STP 802.1w, Rapid STP, Flags [Learn, Forward], bridge-id 8001." + String(s.mac || "").toLowerCase() + ".8001, length 43" }); }
    else all.push({ dir: "sw", from: null, to: null, len: 220, text: "LLDP, length 220: " + sim.d[f.sw].sw.hostname });
  });
  if (!all.length) return [];
  const n = count || all.length, out = []; for (let i = 0; i < n; i++) out.push(Object.assign({}, all[i % all.length]));
  return out.map(function (p, i) { return Object.assign(p, { t: stamp(sim, i) }); });
}
