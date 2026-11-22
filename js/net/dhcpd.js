/* ISC's DHCP server (isc-dhcp-server, dhcpd) on the campus's file server (Level 4, work order 10: the central DHCP server). Its
   configuration file as Ubuntu installs it, read the way dhcpd reads it: the statements a technician uses (subnet declarations with
   their ranges and options, the global options, lease times, host declarations with fixed addresses), dhcpd's own error messages with
   the line and a caret, the interfaces it listens on (the INTERFACESv4 line in /etc/default/isc-dhcp-server, and a subnet declaration
   for each), and the lease it picks for a client a relay sends it. Plain functions, no page code: tested under Node. */
import { ip2n, n2ip, isIp, maskBits, network } from "./util.js";

export const CONF = "/etc/dhcp/dhcpd.conf", DEFAULTS = "/etc/default/isc-dhcp-server", LEASES = "/var/lib/dhcp/dhcpd.leases", UNIT = "isc-dhcp-server";
export const BANNER = ["Internet Systems Consortium DHCP Server 4.4.3-P1", "Copyright 2004-2022 Internet Systems Consortium.", "All rights reserved.", "For info, please visit https://www.isc.org/software/dhcp/"];
const DEFAULT_LEASE = 43200;   /* dhcpd's own default, when the file sets none */

/* the files as the package puts them there: Ubuntu's sample configuration (every subnet in it commented out), and the defaults file */
export const SAMPLE = [
  "# dhcpd.conf", "#", "# Sample configuration file for ISC dhcpd", "#", "# Attention: If /etc/ltsp/dhcpd.conf exists, that will be used as", "# configuration file instead of this file.", "#", "",
  "# option definitions common to all supported networks...", "option domain-name \"example.org\";", "option domain-name-servers ns1.example.org, ns2.example.org;", "",
  "default-lease-time 600;", "max-lease-time 7200;", "",
  "# The ddns-updates-style parameter controls whether or not the server will", "# attempt to do a DNS update when a lease is confirmed. We default to the", "# behavior of the version 2 packages ('none', since DHCP v2 didn't", "# have support for DDNS.)", "ddns-update-style none;", "",
  "# If this DHCP server is the official DHCP server for the local", "# network, the authoritative directive should be uncommented.", "#authoritative;", "",
  "# Use this to send dhcp log messages to a different log file (you also", "# have to hack syslog.conf to complete the redirection).", "#log-facility local7;", "",
  "# No service will be given on this subnet, but declaring it helps the", "# DHCP server to understand the network topology.", "", "#subnet 10.152.187.0 netmask 255.255.255.0 {", "#}", "",
  "# This is a very basic subnet declaration.", "", "#subnet 10.254.239.0 netmask 255.255.255.224 {", "#  range 10.254.239.10 10.254.239.20;", "#  option routers rtr-239-0-1.example.org, rtr-239-0-2.example.org;", "#}", "",
  "# A slightly different configuration for an internal subnet.", "#subnet 10.5.5.0 netmask 255.255.255.224 {", "#  range 10.5.5.26 10.5.5.30;", "#  option domain-name-servers ns1.internal.example.org;", "#  option domain-name \"internal.example.org\";", "#  option subnet-mask 255.255.255.224;", "#  option routers 10.5.5.1;", "#  option broadcast-address 10.5.5.31;", "#  default-lease-time 600;", "#  max-lease-time 7200;", "#}", "",
  "# Hosts which require special configuration options can be listed in", "# host statements.   If no address is specified, the address will be", "# allocated dynamically (if possible), but the host-specific information", "# will still come from the host declaration.", "",
  "#host passacaglia {", "#  hardware ethernet 0:0:c0:5d:bd:95;", "#  filename \"vmunix.passacaglia\";", "#  server-name \"toccata.example.com\";", "#}", "",
  "# Fixed IP addresses can also be specified for hosts.   These addresses", "# should not also be listed as being available for dynamic assignment.", "#host fantasia {", "#  hardware ethernet 08:00:07:26:c0:a5;", "#  fixed-address fantasia.example.com;", "#}", ""
].join("\n");
export const DEFAULTS_TEXT = [
  "# Defaults for isc-dhcp-server (sourced by /etc/init.d/isc-dhcp-server)", "", "# Path to dhcpd's config file (default: /etc/dhcp/dhcpd.conf).", "#DHCPDv4_CONF=/etc/dhcp/dhcpd.conf", "#DHCPDv6_CONF=/etc/dhcp/dhcpd6.conf", "",
  "# Path to dhcpd's PID file (default: /var/run/dhcpd.pid).", "#DHCPDv4_PID=/var/run/dhcpd.pid", "#DHCPDv6_PID=/var/run/dhcpd6.pid", "",
  "# Additional options to start dhcpd with.", "#\tDon't use options -cf or -pf here; use DHCPD_CONF/ DHCPD_PID instead", "#OPTIONS=\"\"", "",
  "# On what interfaces should the DHCP server (dhcpd) serve DHCP requests?", "#\tSeparate multiple interfaces with spaces, e.g. \"eth0 eth1\".", "INTERFACESv4=\"\"", "INTERFACESv6=\"\"", ""
].join("\n");

/* ------------------------------------------------------------ reading the file */
function lex(text) {
  const T = [], L = String(text).split("\n");
  L.forEach(function (s, li) {
    let i = 0;
    while (i < s.length) {
      const ch = s[i];
      if (ch === "#") break;
      if (/\s/.test(ch)) { i++; continue; }
      if ("{};,".indexOf(ch) >= 0) { T.push({ v: ch, line: li + 1, col: i }); i++; continue; }
      if (ch === "\"") { let j = i + 1; while (j < s.length && s[j] !== "\"") j++; T.push({ v: s.slice(i + 1, j), str: true, line: li + 1, col: i }); i = j + 1; continue; }
      let j = i; while (j < s.length && !/[\s{};,#"]/.test(s[j])) j++;
      T.push({ v: s.slice(i, j), line: li + 1, col: i }); i = j;
    }
  });
  return { T: T, L: L };
}
const LIST_OPTS = { "domain-name-servers": 1, routers: 1, "ntp-servers": 1 }, ONE_IP = { "subnet-mask": 1, "broadcast-address": 1 }, STR_OPTS = { "domain-name": 1 };
export const macNorm = function (m) { return String(m || "").toLowerCase().replace(/-/g, ":").split(":").map(function (h) { return h.length === 1 ? "0" + h : h; }).join(":"); };

/* the file read as dhcpd reads it: { errors: [{ line, col, msg }], global, subnets: [{ net, mask, ranges, opts, lease, line }], hosts: [{ name, mac, ip, line }] } */
export function parse(text) {
  const X = lex(text), T = X.T, out = { errors: [], warnings: [], global: { opts: {} }, subnets: [], hosts: [], lines: X.L };
  let p = 0;
  const err = function (tok, msg) { const t = tok || T[T.length - 1] || { line: X.L.length, col: 0 }; out.errors.push({ line: tok ? t.line : X.L.length, col: tok ? t.col : 0, msg: tok ? msg : "unexpected end of file" }); throw out; };
  const next = function () { return T[p++]; }, peek = function () { return T[p]; };
  const semi = function () { const t = next(); if (!t || t.v !== ";") err(t, "semicolon expected."); };
  const ipTok = function (what) { const t = next(); if (!t || t.str || !isIp(t.v)) err(t, what || "expecting an IP address"); return t.v; };
  const optionStmt = function (into) {
    const nm = next(); if (!nm || nm.str || /[{};,]/.test(nm.v)) err(nm, "expecting identifier after option keyword.");
    const n = nm.v;
    if (LIST_OPTS[n]) { const vals = []; for (;;) { const t = next(); if (!t || /[{};,]/.test(t.v)) err(t, "expecting IP address or hostname"); vals.push(t.v); const s = peek(); if (s && s.v === ",") { p++; continue; } break; } semi(); into[n] = vals; return; }
    if (ONE_IP[n]) { into[n] = ipTok(); semi(); return; }
    if (STR_OPTS[n]) { const t = next(); if (!t || /[{};,]/.test(t.v)) err(t, "expecting a string."); into[n] = t.v; semi(); return; }
    err(nm, "no option named " + n + " in space dhcp");
  };
  const numStmt = function () { const t = next(); if (!t || !/^\d+$/.test(t.v)) err(t, "expecting numeric value."); semi(); return +t.v; };
  const block = function (kind, into) {   /* statements up to the closing brace (or the end of the file at the top) */
    for (;;) {
      const t = next();
      if (!t) { if (kind === "top") return; err(null); }
      if (t.v === "}") { if (kind === "top") err(t, "expecting a parameter or declaration"); return; }
      if (t.v === ";") continue;
      switch (t.str ? "" : t.v) {
        case "option": optionStmt(into.opts); break;
        case "default-lease-time": into.lease = numStmt(); break;
        case "max-lease-time": into.maxLease = numStmt(); break;
        case "ddns-update-style": case "log-facility": case "ping-check": { const v = next(); if (!v || /[{};,]/.test(v.v)) err(v, "expecting a parameter or declaration"); semi(); break; }
        case "authoritative": semi(); into.auth = true; break;
        case "not": { const a = next(); if (!a || a.v !== "authoritative") err(a, "expecting a parameter or declaration"); semi(); into.auth = false; break; }
        case "subnet": {
          if (kind !== "top") err(t, "subnet declarations not allowed here.");
          const net = ipTok(), nm = next(); if (!nm || nm.v !== "netmask") err(nm, "expecting netmask");
          const mask = ipTok(), ob = next(); if (!ob || ob.v !== "{") err(ob, "expecting left brace.");
          const S = { net: net, mask: mask, ranges: [], opts: {}, line: t.line, col: t.col, rangeAt: [] };
          block("subnet", S); out.subnets.push(S); break;
        }
        case "range": {
          if (kind !== "subnet") err(t, "range declaration not allowed here.");
          const a = ipTok(); let b = a; const q = peek(); if (q && q.v !== ";") b = ipTok();
          semi(); into.ranges.push(ip2n(a) <= ip2n(b) ? [a, b] : [b, a]); into.rangeAt.push(t.line); break;
        }
        case "host": {
          const nm = next(); if (!nm || /[{};,]/.test(nm.v)) err(nm, "expecting a host name"); const ob = next(); if (!ob || ob.v !== "{") err(ob, "expecting left brace.");
          const H = { name: nm.v, mac: null, ip: null, opts: {}, line: t.line };
          for (;;) {
            const h = next(); if (!h) err(null); if (h.v === "}") break; if (h.v === ";") continue;
            if (h.v === "hardware") { const e = next(); if (!e || e.v !== "ethernet") err(e, "expecting a network hardware type"); const m = next(); if (!m || m.str) err(m, "expecting a hardware address"); const bad = /[^0-9a-fA-F:]/.exec(m.v); if (bad) err({ line: m.line, col: m.col + bad.index }, "semicolon expected."); const parts = m.v.split(":"); if (parts.length !== 6 || parts.some(function (x) { return !/^[0-9a-fA-F]{1,2}$/.test(x); })) err(m, "hardware address too short."); H.mac = macNorm(m.v); semi(); }
            else if (h.v === "fixed-address") { H.ip = ipTok(); semi(); }
            else if (h.v === "option") optionStmt(H.opts);
            else err(h, "expecting a parameter or declaration");
          }
          out.hosts.push(H); break;
        }
        default: err(t, "expecting a parameter or declaration");
      }
    }
  };
  try { block("top", out.global); } catch (e) { if (e !== out) throw e; return out; }
  /* what dhcpd checks once it has read it all */
  for (const S of out.subnets) {
    if (!validMask(S.mask) || network(S.net, S.mask) !== S.net) { out.errors.push({ line: S.line, col: S.col, msg: "subnet " + S.net + " netmask " + S.mask + ": bad subnet number/mask combination." }); return out; }
    for (let i = 0; i < S.ranges.length; i++) { const r = S.ranges[i]; if (network(r[0], S.mask) !== S.net || network(r[1], S.mask) !== S.net) { out.errors.push({ line: S.rangeAt[i], col: 2, msg: "Address range " + r[0] + " to " + r[1] + " not on net " + S.net + "/" + S.mask + "!" }); return out; } }
  }
  for (const H of out.hosts) { if (!H.ip) continue; const S = subnetOf(out, H.ip); if (S && S.ranges.some(function (r) { return ip2n(H.ip) >= ip2n(r[0]) && ip2n(H.ip) <= ip2n(r[1]); })) out.warnings.push("Dynamic and static leases present for " + H.ip + "."); }
  return out;
}
function validMask(m) { if (!isIp(m)) return false; const n = ip2n(m) >>> 0; return n !== 0 && ((~n >>> 0) & ((~n >>> 0) + 1)) === 0; }
export function subnetOf(conf, ip) { return conf.subnets.find(function (S) { return network(ip, S.mask) === S.net; }) || null; }
/* dhcpd's report of the first thing it couldn't read: the line, the line itself, a caret under the spot */
export function errorLines(conf, path) {
  const e = conf.errors[0]; if (!e) return [];
  const src = conf.lines[e.line - 1] || "";
  return [(path || CONF) + " line " + e.line + ": " + e.msg, src, " ".repeat(Math.max(0, e.col)) + "^", "Configuration file errors encountered -- exiting"];
}
export function interfacesOf(defaultsText) {
  const m = /^\s*INTERFACESv4\s*=\s*"([^"]*)"\s*$/m.exec(String(defaultsText || "")) || /^\s*INTERFACESv4\s*=\s*(\S*)\s*$/m.exec(String(defaultsText || ""));
  return m ? m[1].split(/\s+/).filter(Boolean) : [];
}

/* ------------------------------------------------------------ starting the service */
/* what dhcpd does at start: read the file, find the interfaces it was given (or all of them), listen on each with a subnet declaration
   for its address. Returns { ok, log: [lines], conf, listen: [names] }. ifaces: [{ name, ip, mask, mac }] */
export function start(confText, defaultsText, ifaces) {
  const conf = parse(confText), log = BANNER.slice();
  if (conf.errors.length) return { ok: false, log: log.concat(errorLines(conf)), conf: conf, listen: [], why: "conf" };
  log.push("Config file: " + CONF, "Database file: " + LEASES, "PID file: /run/dhcp-server/dhcpd.pid");
  conf.warnings.forEach(function (w) { log.push(w); });
  const asked = interfacesOf(defaultsText), use = asked.length ? asked : ifaces.filter(function (f) { return f.ip; }).map(function (f) { return f.name; }), listen = [];
  for (const n of use) {
    const f = ifaces.find(function (g) { return g.name === n; });
    if (!f) { log.push("Error getting hardware address for \"" + n + "\": No such device", "", "If you think you have received this message due to a bug rather", "than a configuration issue please read the section on submitting", "bugs on either our web page at www.isc.org or in the README file", "before submitting a bug.  These pages explain the proper", "process and the information we find helpful for debugging.", "", "exiting."); return { ok: false, log: log, conf: conf, listen: [], why: "nodev", dev: n }; }
    if (!f.ip || !subnetOf(conf, f.ip)) { log.push("", "No subnet declaration for " + n + " (" + (f.ip || "no IPv4 addresses") + ").", "** Ignoring requests on " + n + ".  If this is not what", "   you want, please write a subnet declaration", "   in your dhcpd.conf file for the network segment", "   to which interface " + n + " is attached. **", ""); continue; }
    listen.push(n);
  }
  if (!listen.length) { log.push("", "Not configured to listen on any interfaces!", "", "If you think you have received this message due to a bug rather", "than a configuration issue please read the section on submitting", "bugs on either our web page at www.isc.org or in the README file", "before submitting a bug.  These pages explain the proper", "process and the information we find helpful for debugging.", "", "exiting."); return { ok: false, log: log, conf: conf, listen: [], why: "nolisten" }; }
  log.push("Wrote 0 leases to leases file.");
  listen.forEach(function (n) { const f = ifaces.find(function (g) { return g.name === n; }), S = subnetOf(conf, f.ip), w = "LPF/" + n + "/" + macNorm(f.mac) + "/" + S.net + "/" + maskBits(S.mask); log.push("Listening on " + w, "Sending on   " + w); });
  log.push("Sending on   Socket/fallback/fallback-net", "Server starting service.");
  return { ok: true, log: log, conf: conf, listen: listen };
}
/* dhcpd -t: the file checked, nothing started */
export function test(confText, path) {
  const conf = parse(confText);
  return conf.errors.length ? { ok: false, out: BANNER.concat(errorLines(conf, path)) } : { ok: true, out: BANNER.concat(["Config file: " + (path || CONF), "Database file: " + LEASES, "PID file: /run/dhcp-server/dhcpd.pid"], conf.warnings) };
}

/* ------------------------------------------------------------ a lease for a client */
/* what the running server offers a client whose request a relay sent it from giaddr: { ip, sub, host } or { why: "segment" | "full" }.
   leases: [{ ip, mac }]; inUse(ip): something already answers there (dhcpd pings an address before it offers it) */
export function pick(conf, giaddr, mac, leases, inUse) {
  const S = subnetOf(conf, giaddr); if (!S) return { why: "segment" };
  const m = macNorm(mac), H = conf.hosts.find(function (h) { return h.mac === m && h.ip && network(h.ip, S.mask) === S.net; });
  if (H) return { ip: H.ip, sub: S, host: H };
  const fixed = new Set(conf.hosts.filter(function (h) { return h.ip; }).map(function (h) { return h.ip; }));
  const taken = new Set(leases.filter(function (l) { return macNorm(l.mac) !== m; }).map(function (l) { return l.ip; }));
  const inRange = function (ip) { return S.ranges.some(function (r) { return ip2n(ip) >= ip2n(r[0]) && ip2n(ip) <= ip2n(r[1]); }); };
  const mine = leases.find(function (l) { return macNorm(l.mac) === m && inRange(l.ip); });
  if (mine && !fixed.has(mine.ip)) return { ip: mine.ip, sub: S };
  const abandoned = [];
  for (const r of S.ranges) for (let n = ip2n(r[0]); n <= ip2n(r[1]); n++) {
    const ip = n2ip(n); if (taken.has(ip) || fixed.has(ip) || ip === giaddr) continue;
    if (inUse && inUse(ip)) { abandoned.push(ip); continue; }
    return { ip: ip, sub: S, abandoned: abandoned };
  }
  return { why: "full", sub: S, abandoned: abandoned };
}
/* the options a lease carries: the subnet's, else the file's own; DNS servers named rather than numbered can't be sent (dhcpd can't look
   them up here), so a client gets none of those */
export function leaseOpts(conf, S, H) {
  const o = Object.assign({}, conf.global.opts, S.opts, H ? H.opts : {}), ipsOnly = function (l) { return (l || []).filter(isIp); };
  return { mask: o["subnet-mask"] || S.mask, routers: ipsOnly(o.routers), dns: ipsOnly(o["domain-name-servers"]), dnsNamed: (o["domain-name-servers"] || []).some(function (d) { return !isIp(d); }), domain: o["domain-name"] || null, secs: S.lease || conf.global.lease || DEFAULT_LEASE };
}
