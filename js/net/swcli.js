/* The managed switch's command line: the industry-standard style (user and
   privileged EXEC, global, interface and line configuration; ? for help,
   Tab to complete, any unique abbreviation), on our own unbranded switch
   (MSW-2800G). Pure: no page code, tested under Node. A switch is plain
   data (newSwitch); a session is a console or SSH login to it (session);
   exec runs one line and returns what the screen shows and the new prompt.
   The running configuration changes as commands are entered; only
   "copy running-config startup-config" (or "write memory") keeps it over a
   reload or a power cut, as on the real thing. Either configuration can be
   copied to a TFTP server (a computer on the network that takes the file):
   the session's tftp callback, given by whoever opens it, does the sending.
   A file on a TFTP server can be copied back in (copy tftp: running-config,
   or startup-config): its lines are entered as configuration commands, the
   hashes of its secrets kept as hashes; the switch's SSH keys are never in a
   file, so a switch built from one has none until they're made again. */

const COPPER = 24, SFP = 4;
export const PORT_NAMES = Array.from({ length: COPPER + SFP }, function (_, i) { return "GigabitEthernet0/" + (i + 1); });
const short = function (n) { return n.replace("GigabitEthernet", "Gi"); };

/* a switch fresh from its box: no passwords, no address, every port on, speed and duplex negotiated */
export function newSwitch(o = {}) {
  const ports = {};
  PORT_NAMES.forEach(function (n, i) { ports[n] = Object.assign({ desc: "", speed: "auto", duplex: "auto", shutdown: false, sfp: i >= COPPER, mdix: true }, PORT_VLAN); });   /* mdix: the port swaps its pairs by itself to suit the far end (auto-MDIX), on from the box */
  const sw = { model: "MSW-2800G", hostname: "Switch", enableSecret: null, enablePassword: null, encrypt: false,
    con: { password: null, login: null }, vty: { password: null, login: null, transport: "telnet" },
    users: {}, domain: null, rsa: 0, keyGen: 0, banner: null, vlan1: { ip: null, mask: null, shutdown: true }, gateway: null, ports: ports,
    vlans: { "1": { name: "default" } }, svis: {},
    links: o.links || {}, mac: o.mac || "00e0.4c██.████", serial: "██████████", startup: null, uptime: o.uptime || "2 minutes" };
  return sw;
}
/* a port's VLAN settings from the box: it negotiates trunking with the far end (DTP, dynamic auto: it trunks only if the
   far end asks), an access port in VLAN 1 otherwise; as a trunk, native VLAN 1 and every VLAN allowed */
const PORT_VLAN = { mode: "dynamic auto", access: 1, native: 1, allowed: "all", nonegotiate: false };
/* a switch saved before VLANs came (the small office's progress in a student's browser) gets them as from the box,
   in what's saved too, so it doesn't read as changed */
function fix(sw) {
  const one = function (c) { if (!c) return; if (!c.vlans) c.vlans = { "1": { name: "default" } }; if (!c.svis) c.svis = {}; if (c.ports) for (const n in c.ports) for (const k in PORT_VLAN) if (c.ports[n][k] === undefined) c.ports[n][k] = PORT_VLAN[k]; };
  one(sw); one(sw.startup); return sw;
}
const clone = function (x) { return x === undefined ? undefined : JSON.parse(JSON.stringify(x)); };
/* a password as the switch keeps it: what was typed, or (copied in from a file) the hash of a secret ("$1$...") or a
   type 7 password ("$7$..."). Does what someone types match it? */
export function pwOk(stored, typed) {
  if (stored == null || typed == null) return false;
  if (stored === typed) return true;
  if (/^\$1\$/.test(stored)) return stored === "$1$Rk3T$" + hashish(typed);
  if (/^\$7\$/.test(stored)) return stored.slice(3) === hashish(typed).slice(0, 14).toUpperCase();
  return false;
}
const CONFIG_KEYS = ["hostname", "enableSecret", "enablePassword", "encrypt", "con", "vty", "users", "domain", "rsa", "keyGen", "vlan1", "gateway", "ports", "banner", "vlans", "svis"];   /* keyGen: which set of RSA keys it holds (each crypto key generate makes a new one) */
/* each kind of device with this command line (this switch; the business router, rtcli.js) registers what's its own: its
   command tree, its prompts, what its configuration is made of, a factory-fresh one, and how its configuration reads */
const OS = {};
export function registerOS(name, os) { OS[name] = os; }
const osOf = function (sw) { return OS[(sw && sw.os) || "switch"]; };
function snapshot(sw) { if (!sw.os) fix(sw); const s = {}; osOf(sw).keys.forEach(function (k) { s[k] = clone(sw[k]); }); return s; }
/* power off and on: what was saved comes back; anything not saved is gone (a factory switch comes back empty) */
export function reload(sw, why) {
  if (!sw.os) fix(sw);
  const base = sw.startup ? clone(sw.startup) : snapshot(osOf(sw).fresh());
  osOf(sw).keys.forEach(function (k) { sw[k] = base[k]; });
  sw.uptime = "0 minutes"; sw.uptimeFixed = null; sw.restart = why || "reload";   /* show version says what brought it back: a power cut, or the reload command */
}

/* ------------------------------------------------------------ interface names */
/* "gi0/3", "g0/3", "gigabitethernet 0/3", "vlan 1", "vlan1" → the full name, or null */
function ifName(tokens, i) {
  let t = (tokens[i] || "").toLowerCase(), used = 1;
  let m = /^(g|gi|gig|giga|gigab|gigabi|gigabit|gigabite|gigabitet|gigabiteth|gigabitethe|gigabitether|gigabitethern|gigabitetherne|gigabitethernet)(\d+\/\d+)?$/.exec(t);
  if (m) {
    let num = m[2]; if (!num) { num = tokens[i + 1]; used = 2; }
    if (!num || !/^0\/\d+$/.test(num)) return { err: "incomplete", used: used };
    const n = "GigabitEthernet" + num; return PORT_NAMES.indexOf(n) >= 0 ? { name: n, used: used } : { err: "invalid", used: used };
  }
  m = /^(v|vl|vla|vlan)(\d+)?$/.exec(t);
  if (m) { let num = m[2]; if (!num) { num = tokens[i + 1]; used = 2; } if (!num) return { err: "incomplete", used: used }; return vlanId(num) ? { name: "Vlan" + (+num), used: used, vlan: +num } : { err: "invalid", used: used }; }
  return null;
}
/* VLANs: 1 to 4094 */
const vlanId = function (s) { return /^\d{1,4}$/.test(String(s)) && +s >= 1 && +s <= 4094; };
/* "10,20,30-32" → [10, 20, 30, 31, 32], or null if any part isn't a VLAN */
export function vlanList(s) {
  const out = []; if (!s) return null;
  for (const part of String(s).split(",")) {
    const m = /^(\d+)(?:-(\d+))?$/.exec(part.trim()); if (!m) return null;
    const a = +m[1], b = m[2] ? +m[2] : a; if (!vlanId(a) || !vlanId(b) || a > b) return null;
    for (let v = a; v <= b; v++) if (out.indexOf(v) < 0) out.push(v);
  }
  return out.sort(function (x, y) { return x - y; });
}
/* [1, 10, 11, 12, 20] → "1,10-12,20"; every VLAN → "1-4094" */
export function vlanText(list) {
  if (list === "all") return "1-4094";
  if (!list.length) return "none";
  const out = []; let a = list[0], b = list[0];
  for (let i = 1; i <= list.length; i++) { const v = list[i]; if (v === b + 1) { b = v; continue; } out.push(a === b ? String(a) : a + "-" + b); a = b = v; }
  return out.join(",");
}
const isSvi = function (n) { return /^Vlan\d+$/.test(n); };
const sviOf = function (sw, n) { return n === "Vlan1" ? sw.vlan1 : sw.svis[n.slice(4)]; };
/* "gi0/13 - 24", "gi0/13-24", "gi0/1 - 4 , gi0/9" (one span is enough here) */
function ifRange(rest) {
  const s = rest.join(" ").toLowerCase().replace(/\s+/g, " ");
  const m = /^g[a-z]*\s?0\/(\d+)\s?-\s?(\d+)$/.exec(s);
  if (!m) return null;
  const a = +m[1], b = +m[2]; if (a < 1 || b > COPPER + SFP || a > b) return null;
  const out = []; for (let k = a; k <= b; k++) out.push("GigabitEthernet0/" + k); return out;
}

/* ------------------------------------------------------------ the command tree */
/* each mode: a list of [word, help, handler or subtree]. A handler gets (S, args, raw) and returns output lines */
const ip4 = function (s) { return /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.test(s || "") && s.split(".").every(function (p) { return +p <= 255; }); };
const isMask = function (s) { if (!ip4(s)) return false; const b = s.split(".").map(function (p) { return (+p).toString(2).padStart(8, "0"); }).join(""); return /^1*0*$/.test(b); };

function status(sw, n) {
  if (n === "Vlan1") return sw.vlan1.shutdown ? ["administratively down", "down"] : [sw.vlan1.ip ? "up" : "up", sw.vlan1.ip ? "up" : "up"];
  if (isSvi(n)) { const s = sviOf(sw, n); if (!s) return ["down", "down"]; return s.shutdown ? ["administratively down", "down"] : ["up", vlanActive(sw, +n.slice(4)) ? "up" : "down"]; }   /* the switch's own interface on a VLAN is up only while the VLAN exists and a port that's up carries it */
  const p = sw.ports[n], l = sw.links[n];
  if (p.shutdown) return ["administratively down", "down"];
  if (!l) return ["down", "down"];
  if (linkFails(p, l)) return ["down", "down"];
  return ["up", "up"];
}
/* trunking, worked out with the far end as the real thing negotiates it (DTP). far: what the far end's port says about
   itself, a switch's { mode, nonegotiate }; null for a device that never negotiates (a computer, a router, an access
   point). access and trunk are fixed; dynamic desirable asks to trunk; dynamic auto trunks only if asked; nonegotiate
   stops a port asking or answering */
export function operMode(p, far) {
  if (p.mode === "access" || p.mode === "trunk") return p.mode;
  if (!far || far.nonegotiate || far.mode === "access") return "access";
  if (p.mode === "dynamic desirable") return "trunk";
  return far.mode === "trunk" || far.mode === "dynamic desirable" ? "trunk" : "access";
}
/* the VLANs a port carries, as it runs: an access port its one VLAN, untagged (none if that VLAN doesn't exist: the port is
   inactive); a trunk every allowed VLAN that exists, tagged, and its native VLAN untagged */
export function carries(sw, n, far) {
  fix(sw);
  const p = sw.ports[n], mode = operMode(p, far === undefined ? (sw.links[n] && sw.links[n].dtp) || null : far), has = function (v) { return !!sw.vlans[v]; };
  if (mode === "access") return { mode: mode, untagged: has(p.access) ? p.access : null, tagged: [] };
  const ok = function (v) { return p.allowed === "all" || p.allowed.indexOf(v) >= 0; };
  return { mode: mode, untagged: has(p.native) && ok(p.native) ? p.native : null, tagged: Object.keys(sw.vlans).map(Number).filter(function (v) { return ok(v) && v !== p.native; }) };
}
function vlanActive(sw, v) {
  if (!sw.vlans[v]) return false;
  return PORT_NAMES.some(function (n) { if (status(sw, n)[0] !== "up") return false; const c = carries(sw, n); return c.untagged === v || c.tagged.indexOf(v) >= 0; });
}
/* a link comes up only if both ends can agree: a fixed speed must match the far end's; on fibre the module must suit the far end */
function linkFails(p, l) { if (l.sfpMismatch) return true; const far = l.speed || "auto"; if (p.speed !== "auto" && far !== "auto" && p.speed !== far) return true; if (p.speed !== "auto" && l.max && +p.speed > l.max) return true; return false; }
/* what the port negotiated: speed, and duplex (a fixed end facing auto falls back to half duplex, the classic mismatch) */
function negotiated(p, l) {
  const sp = p.speed !== "auto" ? p.speed : l.speed && l.speed !== "auto" ? l.speed : String(l.max || 1000);
  let dx; if (p.duplex !== "auto") dx = p.duplex; else if (l.duplex && l.duplex !== "auto") dx = "half"; else dx = "full";
  return { speed: sp, duplex: dx, auto: { speed: p.speed === "auto", duplex: p.duplex === "auto" } };
}
/* the duplex each end of a link runs at: a fixed end facing one that negotiates leaves the negotiating end on half duplex,
   so the two disagree (a duplex mismatch); the link stays up, which is what makes it hard to spot */
export function duplexEnds(p, l) {
  const me = negotiated(p, l).duplex, farSet = l.duplex || "auto";
  const far = farSet !== "auto" ? farSet : p.duplex !== "auto" ? "half" : "full";
  return { me: me, far: far, mismatch: me !== far };
}
/* a duplex mismatch shows in the port's counters, climbing as time goes on: late collisions on the half-duplex end,
   CRC errors and runts on the full-duplex end (l.tick: the simulation's clock) */
function mismatchCounters(p, l) {
  const d = duplexEnds(p, l); if (!d.mismatch) return null;
  const t = (l.tick || 0) + 1;
  return d.me === "half" ? { late: 37 * t + 11, collisions: 412 * t + 90, outErr: 37 * t + 11 } : { crc: 53 * t + 7, inErr: 61 * t + 9, runts: 8 * t + 2 };
}

const SHOW = [
  ["running-config", "Current operating configuration", function (S) { return osOf(S.sw).config(S.sw); }],
  ["startup-config", "Contents of startup-config", function (S) { return S.sw.startup ? osOf(S.sw).config(Object.assign({}, S.sw, S.sw.startup), true) : ["startup-config is not present"]; }],
  ["version", "System hardware and software status", function (S) { const sw = S.sw; return ["MSW-2800G Network Operating System, Version 4.2.1", "", sw.hostname + " uptime is " + sw.uptime, "", "Model number: MSW-2800G (24 x 10/100/1000, 4 x SFP)", "Base MAC address: " + sw.mac, "System serial number: " + sw.serial, "", "System returned to ROM by " + (sw.restart || "power-on"), "", "Configuration register: 0x2102"]; }],
  ["ip", "IP information", [["interface", "IP interface status and configuration", [["brief", "Brief summary of IP status and configuration", function (S) { return ipBrief(S.sw); }]]]]],
  ["interfaces", "Interface status and configuration", function (S, args) {
    if (!args.length) return PORT_NAMES.slice(0, 4).reduce(function (a, n) { return a.concat(ifDetail(S.sw, n)); }, []).concat(["(showing the first four; name a port: show interfaces gi0/5)"]);
    if (/^st/i.test(args[0])) return ifStatus(S.sw);
    if (/^tr$/i.test(args[0])) return ["% Ambiguous command:  \"show interfaces " + args[0] + "\""];
    if (/^tru/i.test(args[0])) return trunks(S.sw);
    if (/^tra/i.test(args[0])) return transceivers(S.sw);
    const f = ifName(args, 0); if (!f || f.err) return ["% Invalid input detected at '^' marker."];
    if (isSvi(f.name)) return sviOf(S.sw, f.name) ? vlanDetail(S.sw, f.name) : ["% Invalid input detected at '^' marker."];
    if (args[f.used] && /^sw/i.test(args[f.used])) return switchportOf(S.sw, f.name);
    return ifDetail(S.sw, f.name);
  }, { sub: [["status", "Show interface line status"], ["trunk", "Show interface trunk information"], ["transceiver", "Show the SFP modules' readings (DOM)"], ["GigabitEthernet", "GigabitEthernet IEEE 802.3z (add switchport for its VLAN settings)"], ["Vlan", "The switch's own interface on a VLAN"]] }],
  ["vlan", "VTP VLAN status", function (S, args) {
    if (args[0] && /^i/i.test(args[0])) { if (!vlanId(args[1])) return args[1] ? ["% Invalid input detected at '^' marker."] : ["% Incomplete command."]; return S.sw.vlans[+args[1]] ? vlanTable(S.sw, [+args[1]]) : ["VLAN id " + args[1] + " not found in current VLAN database"]; }
    if (args[0] && !/^b/i.test(args[0])) return ["% Invalid input detected at '^' marker."];
    return vlanTable(S.sw);
  }, { sub: [["brief", "VTP all VLAN status in brief"], ["id", "VTP VLAN status by VLAN id"]] }],
  ["mac", "MAC configuration", [["address-table", "MAC forwarding table", function (S) { return macTable(S.sw); }]]],
  ["inventory", "Physical inventory: the chassis and its modules", function (S) { return inventory(S.sw); }],
  ["crypto", "Encryption module", [["key", "Show long term public keys", [["mypubkey", "Show the switch's own public keys", [["rsa", "Show its RSA keys", function (S) {
    const sw = S.sw; if (!sw.rsa) return ["% No RSA keys: none have been generated."];
    return ["% Key pair was generated at: 10:12:44 UTC Oct 11 2026", "Key name: " + sw.hostname + "." + (sw.domain || "local"), "Key type: RSA KEYS " + sw.rsa + " bits", " Usage: General Purpose Key", " Key is not exportable. Redundancy enabled.", " Fingerprint (SHA256, as SSH clients show it): " + hostKey(sw)];
  }]]]]]]],
  ["history", "Display the session command history", function (S) { return S.history.slice(-10).map(function (h) { return "  " + h; }); }],
  ["clock", "Display the system clock", function () { return ["*10:42:07.311 UTC Sun Oct 11 2026"]; }],
  ["users", "Display information about terminal lines", function (S) { return ["    Line       User       Host(s)              Idle       Location", S.via === "console" ? "*  0 con 0                idle                 00:00:00" : "*  1 vty 0                idle                 00:00:00 (remote)"]; }],
  ["ssh", "Status of SSH server connections", function (S) { return S.sw.rsa ? ["%No SSHv2 server connections running."] : ["%SSH has not been enabled: no RSA keys"]; }]
];

const EXEC_USER = [
  ["enable", "Turn on privileged commands", function (S) {
    const sw = S.sw; if (sw.enableSecret || sw.enablePassword) { S.pending = { kind: "enable", tries: 0 }; return ["Password: "]; }
    S.mode = "priv"; return [];
  }],
  ["exit", "Exit from the EXEC", function (S) { return logout(S); }],
  ["logout", "Exit from the EXEC", function (S) { return logout(S); }],
  ["show", "Show running system information", SHOW.filter(function (c) { return ["version", "clock", "history", "users", "ip", "interfaces"].indexOf(c[0]) >= 0; })],
  ["ping", "Send echo messages", function (S, a) { return pingOut(S, a); }]
];
const EXEC_PRIV = [
  ["configure", "Enter configuration mode", [["terminal", "Configure from the terminal", function (S) { S.mode = "config"; return ["Enter configuration commands, one per line.  End with CNTL/Z."]; }]], { bare: function (S) { S.pending = { kind: "confterm" }; return ["Configuring from terminal, memory, or network [terminal]? "]; } }],
  ["copy", "Copy from one file to another", [["running-config", "Copy from current system configuration", [["startup-config", "Copy to startup configuration", function (S) { S.pending = { kind: "copyname" }; return ["Destination filename [startup-config]? "]; }], ["tftp:", "Copy to tftp: file system", function (S, a, raw) { return tftpAsk(S, "running", raw); }]]],
    ["startup-config", "Copy from startup configuration", [["tftp:", "Copy to tftp: file system", function (S, a, raw) { return tftpAsk(S, "startup", raw); }]]],
    ["tftp:", "Copy from tftp: file system", [["running-config", "Update (merge with) current system configuration", function (S, a, raw) { return tftpGetAsk(S, "running", raw); }], ["startup-config", "Copy to startup configuration", function (S, a, raw) { return tftpGetAsk(S, "startup", raw); }]]]]],
  ["write", "Write running configuration to memory", [["memory", "Write to NV memory", function (S) { save(S.sw); return ["Building configuration...", "[OK]"]; }]], { bare: function (S) { save(S.sw); return ["Building configuration...", "[OK]"]; } }],
  ["disable", "Turn off privileged commands", function (S) { S.mode = "user"; return []; }],
  ["exit", "Exit from the EXEC", function (S) { return logout(S); }],
  ["logout", "Exit from the EXEC", function (S) { return logout(S); }],
  ["reload", "Halt and perform a cold restart", function (S) {
    S.pending = { kind: "reload", unsaved: changed(S.sw) };
    return S.pending.unsaved ? ["", "System configuration has been modified. Save? [yes/no]: "] : ["Proceed with reload? [confirm]"];
  }],
  ["show", "Show running system information", SHOW],
  ["ping", "Send echo messages", function (S, a) { return pingOut(S, a); }],
  ["clear", "Reset functions", [["counters", "Clear counters on one or all interfaces", function (S) { S.pending = { kind: "confirm", then: function () { return []; } }; return ["Clear \"show interface\" counters on all interfaces [confirm]"]; }]]]
];
const CONFIG = [
  ["hostname", "Set system's network name", function (S, a) {
    if (!a.length) return ["% Incomplete command."];
    if (!/^[A-Za-z][A-Za-z0-9-]{0,62}$/.test(a[0])) return ["% Hostname contains one or more illegal characters."];
    S.sw.hostname = a[0]; return [];
  }],
  ["enable", "Modify enable password parameters", [
    ["secret", "Assign the privileged level secret", function (S, a) { if (!a.length) return ["% Incomplete command."]; S.sw.enableSecret = typed(a); return []; }],
    ["password", "Assign the privileged level password", function (S, a) { if (!a.length) return ["% Incomplete command."]; const pw = typed(a); if (pwOk(S.sw.enableSecret, pw)) return ["The enable password you have chosen is the same as your enable secret.", "This is not recommended.  Re-enter the enable password."]; S.sw.enablePassword = pw; return []; }]
  ]],
  ["interface", "Select an interface to configure", function (S, a) {
    if (!a.length) return ["% Incomplete command."];
    if (/^r/i.test(a[0])) { const r = ifRange(a.slice(1)); if (!r) return ["% Invalid input detected at '^' marker."]; S.mode = "ifrange"; S.ifs = r; return []; }
    const f = ifName(a, 0); if (!f) return ["% Invalid input detected at '^' marker."]; if (f.err === "incomplete") return ["% Incomplete command."];
    if (f.err) return ["% Invalid input detected at '^' marker."];
    if (isSvi(f.name) && !sviOf(S.sw, f.name)) S.sw.svis[f.vlan] = { ip: null, mask: null, shutdown: false };   /* the switch's own interface on a VLAN is made by naming it */
    S.mode = "if"; S.ifs = [f.name]; return [];
  }, { sub: [["GigabitEthernet", "GigabitEthernet IEEE 802.3z"], ["Vlan", "The switch's own interface on a VLAN"], ["range", "interface range command"]] }],
  ["vlan", "VLAN commands", function (S, a) {
    if (!a.length) return ["% Incomplete command."];
    const L = vlanList(a.join("")); if (!L) return ["% Invalid input detected at '^' marker."];
    L.forEach(function (v) { if (!S.sw.vlans[v]) S.sw.vlans[v] = { name: "VLAN" + String(v).padStart(4, "0") }; });
    S.mode = "vlan"; S.vl = L; return [];
  }, { sub: [["<1-4094>", "VLAN ID, or a list such as 10,20,30-35"]] }],
  ["line", "Configure a terminal line", [["console", "Primary terminal line", function (S, a) { if (a[0] !== "0") return a.length ? ["% Invalid input detected at '^' marker."] : ["% Incomplete command."]; S.mode = "line"; S.line = "con"; return []; }], ["vty", "Virtual terminal", function (S, a) { if (!a.length) return ["% Incomplete command."]; if (!/^\d+$/.test(a[0]) || (a[1] && !/^\d+$/.test(a[1])) || +a[0] > 15 || +(a[1] || 0) > 15) return ["% Invalid input detected at '^' marker."]; S.mode = "line"; S.line = "vty"; return []; }]]],
  ["ip", "Global IP configuration subcommands", [
    ["default-gateway", "Specify default gateway (if not routing IP)", function (S, a) { if (!a.length) return ["% Incomplete command."]; if (!ip4(a[0])) return ["% Invalid input detected at '^' marker."]; S.sw.gateway = a[0]; return []; }],
    ["domain-name", "Define the default domain name", function (S, a) { if (!a.length) return ["% Incomplete command."]; S.sw.domain = a[0]; return []; }],
    ["ssh", "Configure ssh options", [["version", "Specify protocol version", function (S, a) { return a[0] === "2" ? [] : ["% Invalid input detected at '^' marker."]; }]]]
  ]],
  ["username", "Establish User Name Authentication", function (S, a) {
    if (a.length < 3 || !/^(secret|password)$/i.test(a[1])) return a.length < 3 ? ["% Incomplete command."] : ["% Invalid input detected at '^' marker."];
    S.sw.users[a[0]] = a.length > 3 && /^[057]$/.test(a[2]) ? typed(a.slice(2)) : a.slice(2).join(" "); return [];
  }],
  ["crypto", "Encryption module", [["key", "Long term key operations", [["generate", "Generate new keys", [["rsa", "Generate RSA keys", function (S, a) {
    if (!S.sw.domain) return ["% Please define a domain-name first."];
    if (S.sw.hostname === "Switch") return ["% Please define a hostname other than Switch."];
    const m = a.join(" ").match(/modulus\s+(\d+)/i); if (m) return rsa(S, +m[1]);
    S.pending = { kind: "modulus" }; return ["The name for the keys will be: " + S.sw.hostname + "." + S.sw.domain, "Choose the size of the key modulus in the range of 360 to 4096 for your", "  General Purpose Keys. Choosing a key modulus greater than 512 may take", "  a few minutes.", "", "How many bits in the modulus [512]: "];
  }]]]]]]],
  ["service", "Modify use of network based services", [["password-encryption", "Encrypt system passwords", function (S) { S.sw.encrypt = true; return []; }]]],
  ["banner", "Define a login banner", [["motd", "Set Message of the Day banner", function (S, a, raw) { return bannerStart(S, raw); }]]],
  ["do", "To run exec commands in config mode", function (S, a, raw) { const was = S.mode; S.mode = "priv"; const r = run(S, raw.replace(/^\s*do\s+/i, "")); S.mode = was; return r.lines; }],
  ["no", "Negate a command or set its defaults", [
    ["hostname", "Set system's network name", function (S) { S.sw.hostname = "Switch"; return []; }],
    ["enable", "Modify enable password parameters", [["secret", "Assign the privileged level secret", function (S) { S.sw.enableSecret = null; return []; }], ["password", "Assign the privileged level password", function (S) { S.sw.enablePassword = null; return []; }]]],
    ["ip", "Global IP configuration subcommands", [["default-gateway", "Specify default gateway", function (S) { S.sw.gateway = null; return []; }], ["domain-name", "Define the default domain name", function (S) { S.sw.domain = null; return []; }]]],
    ["username", "Establish User Name Authentication", function (S, a) { delete S.sw.users[a[0]]; return []; }],
    ["vlan", "VLAN commands", function (S, a) {
      const L = vlanList(a.join("")); if (!L) return a.length ? ["% Invalid input detected at '^' marker."] : ["% Incomplete command."];
      if (L.indexOf(1) >= 0) return ["%Default VLAN 1 may not be deleted."];
      L.forEach(function (v) { delete S.sw.vlans[v]; }); return [];   /* its ports stay assigned to it, and go inactive */
    }],
    ["interface", "Select an interface to configure", function (S, a) {
      const f = ifName(a, 0); if (!f || f.err || !isSvi(f.name) || f.name === "Vlan1") return ["% Invalid input detected at '^' marker."];
      delete S.sw.svis[f.vlan]; return [];
    }],
    ["service", "Modify use of network based services", [["password-encryption", "Encrypt system passwords", function (S) { S.sw.encrypt = false; return []; }]]],
    ["banner", "Define a login banner", [["motd", "Set Message of the Day banner", function (S) { S.sw.banner = null; return []; }]]]
  ]],
  ["end", "Exit from configure mode", function (S) { S.mode = "priv"; return []; }],
  ["exit", "Exit from configure mode", function (S) { S.mode = "priv"; return []; }]
];
const IFACE = [
  ["description", "Interface specific description", function (S, a, raw) { const d = raw.replace(/^\s*\S+\s*/, ""); if (!d) return ["% Incomplete command."]; S.ifs.forEach(function (n) { if (isSvi(n)) sviOf(S.sw, n).desc = d.slice(0, 240); else S.sw.ports[n].desc = d.slice(0, 240); }); return []; }],
  ["speed", "Configure speed operation.", [["10", "Force 10 Mbps operation", function (S) { return setPort(S, "speed", "10"); }], ["100", "Force 100 Mbps operation", function (S) { return setPort(S, "speed", "100"); }], ["1000", "Force 1000 Mbps operation", function (S) { return setPort(S, "speed", "1000"); }], ["auto", "Enable AUTO speed configuration", function (S) { return setPort(S, "speed", "auto"); }]]],
  ["duplex", "Configure duplex operation.", [["full", "Force full duplex operation", function (S) { return setPort(S, "duplex", "full"); }], ["half", "Force half-duplex operation", function (S) { return setPort(S, "duplex", "half"); }], ["auto", "Enable AUTO duplex configuration", function (S) { return setPort(S, "duplex", "auto"); }]]],
  ["mdix", "Set Media Dependent Interface with Crossover", [["auto", "Enable automatic MDI crossover detection on this interface", function (S) { return setPort(S, "mdix", true); }]]],
  ["shutdown", "Shutdown the selected interface", function (S) { S.ifs.forEach(function (n) { if (isSvi(n)) sviOf(S.sw, n).shutdown = true; else S.sw.ports[n].shutdown = true; }); return S.ifs.map(function (n) { return "%LINK-5-CHANGED: Interface " + n + ", changed state to administratively down"; }); }],
  ["ip", "Interface Internet Protocol config commands", [["address", "Set the IP address of an interface", function (S, a) {
    if (!isSvi(S.ifs[0])) return ["% Invalid input detected at '^' marker.", "  (a switch port is layer 2: the switch's own address goes on interface vlan 1)"];
    if (a.length < 2) return ["% Incomplete command."]; if (!ip4(a[0]) || !isMask(a[1])) return ["% Invalid input detected at '^' marker."];
    const s = sviOf(S.sw, S.ifs[0]); s.ip = a[0]; s.mask = a[1]; return [];
  }]]],
  ["switchport", "Set switching mode characteristics", [
    ["mode", "Set trunking mode of the interface", [
      ["access", "Set trunking mode to ACCESS unconditionally", function (S) { return setMode(S, "access"); }],
      ["trunk", "Set trunking mode to TRUNK unconditionally", function (S) { return setMode(S, "trunk"); }],
      ["dynamic", "Set trunking mode to dynamically negotiate access or trunk mode", [["auto", "Set trunking mode dynamic negotiation parameter to AUTO", function (S) { return setMode(S, "dynamic auto"); }], ["desirable", "Set trunking mode dynamic negotiation parameter to DESIRABLE", function (S) { return setMode(S, "dynamic desirable"); }]]]]],
    ["access", "Set access mode characteristics of the interface", [["vlan", "Set VLAN when interface is in access mode", function (S, a) {
      if (!a.length) return ["% Incomplete command."]; if (!vlanId(a[0])) return ["% Invalid input detected at '^' marker."];
      const v = +a[0], out = []; if (!S.sw.vlans[v]) { S.sw.vlans[v] = { name: "VLAN" + String(v).padStart(4, "0") }; out.push("% Access VLAN does not exist. Creating vlan " + v); }
      return out.concat(setPort(S, "access", v));
    }, { sub: [["<1-4094>", "VLAN ID of the VLAN when this port is in access mode"]] }]]],
    ["trunk", "Set trunking characteristics of the interface", [
      ["native", "Set trunking native characteristics when interface is in trunking mode", [["vlan", "Set native VLAN when interface is in trunking mode", function (S, a) { if (!a.length) return ["% Incomplete command."]; if (!vlanId(a[0])) return ["% Invalid input detected at '^' marker."]; return setPort(S, "native", +a[0]); }, { sub: [["<1-4094>", "VLAN ID of the native VLAN when this port is in trunking mode"]] }]]],
      ["allowed", "Set allowed VLAN characteristics when interface is in trunking mode", [["vlan", "Set allowed VLANs when interface is in trunking mode", function (S, a) { return allowed(S, a); }, { sub: [["WORD", "VLAN IDs of the allowed VLANs when this port is in trunking mode (replaces the list)"], ["add", "add VLANs to the current list"], ["all", "all VLANs"], ["except", "all VLANs except the following"], ["none", "no VLANs"], ["remove", "remove VLANs from the current list"]] }]]]]],
    ["nonegotiate", "Device will not engage in negotiation protocol on this interface", function (S) {
      if (S.ifs.some(function (n) { return !isSvi(n) && /^dynamic/.test(S.sw.ports[n].mode); })) return ["Command rejected: Conflict between 'nonegotiate' and 'dynamic' status."];
      return setPort(S, "nonegotiate", true);
    }]]],
  ["no", "Negate a command or set its defaults", [
    ["shutdown", "Shutdown the selected interface", function (S) { const out = []; S.ifs.forEach(function (n) { if (isSvi(n)) { sviOf(S.sw, n).shutdown = false; out.push("%LINK-3-UPDOWN: Interface " + n + ", changed state to up"); } else { S.sw.ports[n].shutdown = false; const st = status(S.sw, n); out.push("%LINK-3-UPDOWN: Interface " + n + ", changed state to " + (st[0] === "up" ? "up" : "down")); } }); return out; }],
    ["description", "Interface specific description", function (S) { S.ifs.forEach(function (n) { if (isSvi(n)) sviOf(S.sw, n).desc = ""; else S.sw.ports[n].desc = ""; }); return []; }],
    ["speed", "Configure speed operation.", function (S) { return setPort(S, "speed", "auto"); }],
    ["duplex", "Configure duplex operation.", function (S) { return setPort(S, "duplex", "auto"); }],
    ["mdix", "Set Media Dependent Interface with Crossover", [["auto", "Enable automatic MDI crossover detection on this interface", function (S) { return setPort(S, "mdix", false); }]]],
    ["ip", "Interface Internet Protocol config commands", [["address", "Set the IP address of an interface", function (S) { if (isSvi(S.ifs[0])) { const s = sviOf(S.sw, S.ifs[0]); s.ip = null; s.mask = null; } return []; }]]],
    ["switchport", "Set switching mode characteristics", [
      ["mode", "Set trunking mode of the interface", function (S) { return setMode(S, "dynamic auto"); }],
      ["access", "Set access mode characteristics of the interface", [["vlan", "Set VLAN when interface is in access mode", function (S) { return setPort(S, "access", 1); }]]],
      ["trunk", "Set trunking characteristics of the interface", [
        ["native", "Set trunking native characteristics when interface is in trunking mode", [["vlan", "Set native VLAN when interface is in trunking mode", function (S) { return setPort(S, "native", 1); }]]],
        ["allowed", "Set allowed VLAN characteristics when interface is in trunking mode", [["vlan", "Set allowed VLANs when interface is in trunking mode", function (S) { return setPort(S, "allowed", "all"); }]]]]],
      ["nonegotiate", "Device will not engage in negotiation protocol on this interface", function (S) { return setPort(S, "nonegotiate", false); }]]]
  ]],
  ["interface", "Select an interface to configure", null],
  ["do", "To run exec commands in config mode", null],
  ["end", "Exit from configure mode", function (S) { S.mode = "priv"; S.ifs = null; return []; }],
  ["exit", "Exit from interface configuration mode", function (S) { S.mode = "config"; S.ifs = null; return []; }]
];
const LINE = [
  ["password", "Set a password", function (S, a) { if (!a.length) return ["% Incomplete command."]; S.sw[S.line].password = typed(a); return []; }],
  ["login", "Enable password checking", [["local", "Local password checking", function (S) { S.sw[S.line].login = "local"; return []; }]], { bare: function (S) { if (!S.sw[S.line].password) { S.sw[S.line].login = "password"; return ["% Login disabled on line " + (S.line === "con" ? "0" : "1") + ", until 'password' is set"]; } S.sw[S.line].login = "password"; return []; } }],
  ["transport", "Define transport protocols for line", [["input", "Define which protocols to use when connecting to the terminal server", [["ssh", "TCP/IP SSH protocol", function (S) { return setTransport(S, "ssh"); }], ["telnet", "TCP/IP Telnet protocol", function (S) { return setTransport(S, "telnet"); }], ["all", "All protocols", function (S) { return setTransport(S, "all"); }], ["none", "No protocols", function (S) { return setTransport(S, "none"); }]]]]],
  ["exec-timeout", "Set the EXEC timeout", function () { return []; }],
  ["logging", "Modify message logging facilities", [["synchronous", "Synchronized message output", function () { return []; }]]],
  ["no", "Negate a command or set its defaults", [["password", "Set a password", function (S) { S.sw[S.line].password = null; return []; }], ["login", "Enable password checking", function (S) { S.sw[S.line].login = null; return []; }]]],
  ["do", "To run exec commands in config mode", null],
  ["end", "Exit from configure mode", function (S) { S.mode = "priv"; S.line = null; return []; }],
  ["exit", "Exit from line configuration mode", function (S) { S.mode = "config"; S.line = null; return []; }]
];
/* config sub-modes also take the global commands that move you elsewhere (interface, line), as the real thing does */
IFACE.find(function (c) { return c[0] === "interface"; })[2] = CONFIG.find(function (c) { return c[0] === "interface"; })[2];
IFACE.find(function (c) { return c[0] === "interface"; })[3] = CONFIG.find(function (c) { return c[0] === "interface"; })[3];
[IFACE, LINE].forEach(function (t) { t.find(function (c) { return c[0] === "do"; })[2] = CONFIG.find(function (c) { return c[0] === "do"; })[2]; });
LINE.splice(0, 0, ["line", "Configure a terminal line", CONFIG.find(function (c) { return c[0] === "line"; })[2]]);
IFACE.splice(0, 0, ["line", "Configure a terminal line", CONFIG.find(function (c) { return c[0] === "line"; })[2]]);
/* VLAN configuration: name it */
const VLAN = [
  ["name", "Ascii name of the VLAN", function (S, a) {
    if (!a.length) return ["% Incomplete command."];
    if (S.vl.indexOf(1) >= 0) return ["%Default VLAN 1 may not have its name changed."];
    if (!/^[\x21-\x7e]{1,32}$/.test(a[0])) return ["% Invalid input detected at '^' marker."];
    S.vl.forEach(function (v) { if (S.sw.vlans[v]) S.sw.vlans[v].name = a[0]; }); return [];
  }],
  ["no", "Negate a command or set its defaults", [["name", "Ascii name of the VLAN", function (S) { S.vl.forEach(function (v) { if (v !== 1 && S.sw.vlans[v]) S.sw.vlans[v].name = "VLAN" + String(v).padStart(4, "0"); }); return []; }]]],
  ["vlan", "VLAN commands", CONFIG.find(function (c) { return c[0] === "vlan"; })[2]],
  ["interface", "Select an interface to configure", CONFIG.find(function (c) { return c[0] === "interface"; })[2], CONFIG.find(function (c) { return c[0] === "interface"; })[3]],
  ["do", "To run exec commands in config mode", CONFIG.find(function (c) { return c[0] === "do"; })[2]],
  ["end", "Exit from configure mode", function (S) { S.mode = "priv"; S.vl = null; return []; }],
  ["exit", "Apply changes, bump revision number, and exit mode", function (S) { S.mode = "config"; S.vl = null; return []; }]
];
IFACE.splice(0, 0, ["vlan", "VLAN commands", CONFIG.find(function (c) { return c[0] === "vlan"; })[2]]);
LINE.splice(0, 0, ["vlan", "VLAN commands", CONFIG.find(function (c) { return c[0] === "vlan"; })[2]]);
const TREE = { user: EXEC_USER, priv: EXEC_PRIV, config: CONFIG, if: IFACE, ifrange: IFACE, line: LINE, vlan: VLAN };
const treeOf = function (S) { return osOf(S.sw).tree; };

/* the password words after a command: "5 $1$..." is a secret's hash as a configuration file has it, "7 ..." a type 7
   password, "0 ..." plain text; otherwise the last word, as typed */
function typed(a) {
  if (a.length > 1 && a[0] === "5" && /^\$1\$/.test(a[1])) return a[1];
  if (a.length > 1 && a[0] === "7") return "$7$" + a[1];
  if (a.length > 1 && a[0] === "0") return a[1];
  return a[a.length - 1];
}
function setPort(S, k, v) { if (S.ifs.some(isSvi) && ["access", "native", "allowed", "nonegotiate", "mode"].indexOf(k) >= 0) return ["% Invalid input detected at '^' marker.", "  (switchport settings are for the switch's ports, not its own interface on a VLAN)"]; S.ifs.forEach(function (n) { if (!isSvi(n)) S.sw.ports[n][k] = Array.isArray(v) ? v.slice() : v; }); return []; }
/* the trunking mode: a dynamic mode and nonegotiate can't go together */
function setMode(S, m) {
  if (/^dynamic/.test(m) && S.ifs.some(function (n) { return !isSvi(n) && S.sw.ports[n].nonegotiate; })) return ["Command rejected: Conflict between 'nonegotiate' and 'dynamic' status."];
  return setPort(S, "mode", m);
}
/* switchport trunk allowed vlan 10,20 | add 30 | remove 20 | except 1 | all | none. A bare list replaces the whole list:
   the classic mistake when adding one VLAN to a trunk is to leave out "add" */
function allowed(S, a) {
  if (!a.length) return ["% Incomplete command."];
  const w = a[0].toLowerCase(), all = []; for (let v = 1; v <= 4094; v++) all.push(v);
  const each = function (f) { const bad = []; S.ifs.forEach(function (n) { if (isSvi(n)) return; const p = S.sw.ports[n], cur = p.allowed === "all" ? all.slice() : p.allowed.slice(), r = f(cur); if (r === null) bad.push(n); else p.allowed = r.length === 4094 ? "all" : r; }); return bad.length ? ["% Invalid input detected at '^' marker."] : []; };
  if (w === "all") return setPort(S, "allowed", "all");
  if (w === "none") return setPort(S, "allowed", []);
  if (/^(add|remove|except)$/.test(w)) {
    const L = vlanList(a.slice(1).join("")); if (!L) return a.length > 1 ? ["% Invalid input detected at '^' marker."] : ["% Incomplete command."];
    if (w === "add") return each(function (cur) { return cur.concat(L.filter(function (v) { return cur.indexOf(v) < 0; })).sort(function (x, y) { return x - y; }); });
    if (w === "remove") return each(function (cur) { return cur.filter(function (v) { return L.indexOf(v) < 0; }); });
    return setPort(S, "allowed", all.filter(function (v) { return L.indexOf(v) < 0; }).length === 4094 ? "all" : all.filter(function (v) { return L.indexOf(v) < 0; }));
  }
  const L = vlanList(a.join("")); if (!L) return ["% Invalid input detected at '^' marker."];
  return setPort(S, "allowed", L);
}
function setTransport(S, v) { if (S.line !== "vty") return ["% Invalid input detected at '^' marker.", "  (transport input is for the vty lines: remote logins)"]; S.sw.vty.transport = v; return []; }
function rsa(S, bits) { if (bits < 360 || bits > 4096) return ["% Invalid input detected at '^' marker."]; S.sw.rsa = bits; S.sw.keyGen = (S.sw.keyGen || 0) + 1; return ["% Generating " + bits + " bit RSA keys, keys will be non-exportable...", "[OK] (elapsed time was 2 seconds)", "", "%SSH-5-ENABLED: SSH 2.0 has been enabled"]; }
function save(sw) { sw.startup = snapshot(sw); }
/* banner motd: the first character after "motd" is the delimiter, and the message runs to the next one. On one line it
   ends there (anything after it is ignored); if the line ends first, the message carries on over the lines that follow */
function bannerStart(S, raw) {
  const m = /^\s*\S+\s+\S+\s*([\s\S]*)$/.exec(raw), rest = m ? m[1] : "";
  if (!rest) return ["% Incomplete command."];
  const d = rest[0], body = rest.slice(1), k = body.indexOf(d);
  if (k >= 0) { S.sw.banner = body.slice(0, k); return []; }
  S.pending = { kind: "banner", delim: d, text: [body] };
  return ["Enter TEXT message.  End with the character '" + d + "'."];
}
/* what a configuration looks like as a file: from its first "!" to "end" (no "Building configuration..." heading) */
export function configText(sw, which) {
  if (which === "startup") return sw.startup ? osOf(sw).config(Object.assign({}, sw, sw.startup), true).slice(3).join("\n") + "\n" : null;
  return osOf(sw).config(sw).slice(3).join("\n") + "\n";
}
/* copy running-config tftp: (or startup-config): ask for the server and the file name, as the real thing does.
   "tftp://host/name" on the line fills in both answers' defaults */
function tftpAsk(S, which, raw) {
  if (which === "startup" && !S.sw.startup) return ["%Error opening nvram:/startup-config (No such file or directory)"];
  const u = /tftp:\/\/([^\/\s]*)\/?(\S*)/i.exec(raw || "");
  S.pending = { kind: "tftphost", which: which, host: u ? u[1] : "", file: u && u[2] ? u[2] : S.sw.hostname.toLowerCase() + "-confg" };
  return ["Address or name of remote host [" + S.pending.host + "]? "];
}
function tftpSend(S, p) {
  const text = configText(S.sw, p.which), url = "tftp://" + p.host + "/" + p.file;
  const r = S.tftp ? S.tftp(p.host, p.file, text, { which: p.which, unsaved: changed(S.sw) }) : { err: "Timed out" };
  if (!r || r.err) return (r && r.err === "Timed out" ? ["....."] : []).concat(["%Error opening " + url + " (" + ((r && r.err) || "Timed out") + ")"]);
  const secs = 0.02 + text.length / 48000;
  return ["!!", text.length + " bytes copied in " + secs.toFixed(3) + " secs (" + Math.round(text.length / secs) + " bytes/sec)"];
}
/* copy tftp: running-config (or startup-config): the server, the file, where it goes, then the file is fetched by the
   session's tftpGet callback. Into the running configuration its lines are merged in as commands (anything the file
   doesn't mention stays as it is); into the startup configuration it replaces what's saved, as a switch starting from it
   would have it, and takes effect at the next reload */
function tftpGetAsk(S, into, raw) {
  const u = /tftp:\/\/([^\/\s]*)\/?(\S*)/i.exec(raw || "");
  S.pending = { kind: "gethost", into: into, host: u ? u[1] : "", file: u && u[2] ? u[2] : "" };
  return ["Address or name of remote host [" + S.pending.host + "]? "];
}
function tftpLoad(S, p) {
  const url = "tftp://" + p.host + "/" + p.file, r = S.tftpGet ? S.tftpGet(p.host, p.file) : { err: "Timed out" };
  if (!r || r.err) return ["Accessing " + url + "..."].concat(r && r.err === "Timed out" ? ["....."] : [], ["%Error opening " + url + " (" + ((r && r.err) || "Timed out") + ")"]);
  const n = r.text.length, secs = 0.02 + n / 48000, out = ["Accessing " + url + "...", "Loading " + p.file + " from " + p.host + " (via " + (r.via || S.via1 || "Vlan1") + "): !", "[OK - " + n + " bytes]", "", n + " bytes copied in " + secs.toFixed(3) + " secs (" + Math.round(n / secs) + " bytes/sec)"];
  if (p.into === "startup") { S.sw.startup = bootFrom(S.sw, r.text); return out; }
  applyText(S.sw, r.text, false);
  return out.concat(["%SYS-5-CONFIG_I: Configured from " + url + " by " + (S.via === "console" ? "console" : "vty0")]);
}
/* a configuration file's lines entered as configuration commands. boot: as a switch starting from the file sees it, so an
   interface the file names comes up unless the file shuts it down (on a merge, an interface keeps its state unless the
   file says otherwise, as the real thing does) */
function applyText(sw, text, boot) {
  const S = { sw: sw, mode: "config", history: [], pending: null, via: "console", fresh: false }, L = String(text || "").split("\n");
  for (let i = 0; i < L.length; i++) {
    const raw = L[i].replace(/\r$/, ""), t = raw.trim();
    if (!t || t[0] === "!" || /^(version|building configuration|current configuration)/i.test(t)) continue;
    if (/^end$/i.test(t)) break;
    if (/^banner motd \^C/i.test(t)) {   /* the banner, written with ^C at each end, over as many lines as it has */
      let body = raw.slice(raw.indexOf("^C") + 2);
      while (body.indexOf("^C") < 0 && i < L.length - 1) body += "\n" + L[++i].replace(/\r$/, "");
      sw.banner = body.indexOf("^C") >= 0 ? body.slice(0, body.indexOf("^C")) : body;
      continue;
    }
    if (!/^\s/.test(raw)) { S.mode = "config"; S.ifs = null; S.line = null; }   /* a line at the margin is a global command */
    run(S, t); S.pending = null;
    if (boot && S.mode !== "config" && S.ifs && /^interface\s/i.test(t)) S.ifs.forEach(function (n) { osOf(sw).bootUp(sw, n); });
  }
}
/* what the startup configuration becomes from a file: a factory switch with the file entered, keeping the keys it has saved */
function bootFrom(sw, text) {
  const t = snapshot(osOf(sw).fresh()), keys = sw.startup || { rsa: 0, keyGen: 0 }; if (sw.os) t.os = sw.os;
  t.rsa = keys.rsa || 0; t.keyGen = keys.keyGen || 0; t.links = {};
  applyText(t, text, true);
  return snapshot(t);
}
/* whether the running configuration differs from what is saved (a factory switch has nothing saved) */
export function unsaved(sw) { return changed(sw); }
function changed(sw) { return JSON.stringify(snapshot(sw)) !== JSON.stringify(sw.startup || snapshot(osOf(sw).fresh())); }
function logout(S) { S.mode = "gone"; return ["", S.sw.hostname + " con0 is now available", "", "", "", "Press RETURN to get started."]; }
function pingOut(S, a) {
  if (!a.length || !ip4(a[0])) return a.length ? ["% Unrecognized host or address, or protocol not running."] : ["% Incomplete command."];
  if (!ownAddrs(S.sw).length) return ["Type escape sequence to abort.", "Sending 5, 100-byte ICMP Echos to " + a[0] + ", timeout is 2 seconds:", ".....", "Success rate is 0 percent (0/5)"];
  const ok = S.reach ? S.reach(a[0]) : false;
  return ["Type escape sequence to abort.", "Sending 5, 100-byte ICMP Echos to " + a[0] + ", timeout is 2 seconds:", ok ? "!!!!!" : ".....", ok ? "Success rate is 100 percent (5/5), round-trip min/avg/max = 1/1/2 ms" : "Success rate is 0 percent (0/5)"];
}

/* the switch's own addresses: each of its interfaces on a VLAN with an address, up (VLAN 1 as it always was) */
export function ownAddrs(sw) {
  fix(sw); const out = [];
  if (sw.vlan1.ip && !sw.vlan1.shutdown) out.push({ vlan: 1, ip: sw.vlan1.ip, mask: sw.vlan1.mask });
  Object.keys(sw.svis).forEach(function (v) { const s = sw.svis[v]; if (s.ip && status(sw, "Vlan" + v)[1] === "up") out.push({ vlan: +v, ip: s.ip, mask: s.mask }); });
  return out;
}
/* ------------------------------------------------------------ the show outputs */
/* a password as a configuration shows it: a secret as its hash; a password plain, or type 7 with service password-encryption.
   Copied in from a file, a hash stays the hash it was */
function pwText(sw, p, kind) { if (/^\$1\$/.test(p)) return "5 " + p; if (/^\$7\$/.test(p)) return "7 " + p.slice(3); return kind === "secret" ? "5 $1$Rk3T$" + hashish(p) : sw.encrypt ? "7 " + hashish(p).slice(0, 14).toUpperCase() : p; }
function runningConfig(sw, startup) {
  const L = ["Building configuration...", "", "Current configuration : " + (1800 + JSON.stringify(sw.ports).length % 900) + " bytes", "!", "version 4.2", sw.encrypt ? "service password-encryption" : "no service password-encryption", "!", "hostname " + sw.hostname, "!"];
  const pw = function (p, kind) { return pwText(sw, p, kind); };
  if (sw.enableSecret) L.push("enable secret " + pw(sw.enableSecret, "secret"));
  if (sw.enablePassword) L.push("enable password " + pw(sw.enablePassword));
  Object.keys(sw.users).forEach(function (u) { L.push("username " + u + " secret " + pw(sw.users[u], "secret")); });
  if (sw.enableSecret || sw.enablePassword || Object.keys(sw.users).length) L.push("!");
  if (sw.domain) L.push("ip domain-name " + sw.domain, "!");
  Object.keys(sw.vlans || {}).map(Number).sort(function (a, b) { return a - b; }).forEach(function (v) { if (v === 1) return; L.push("vlan " + v); if (sw.vlans[v].name !== "VLAN" + String(v).padStart(4, "0")) L.push(" name " + sw.vlans[v].name); L.push("!"); });
  PORT_NAMES.forEach(function (n) { const p = Object.assign({}, PORT_VLAN, sw.ports[n]); L.push("interface " + n); if (p.desc) L.push(" description " + p.desc);
    if (p.access !== 1) L.push(" switchport access vlan " + p.access);
    if (p.native !== 1) L.push(" switchport trunk native vlan " + p.native);
    if (p.allowed !== "all") L.push(" switchport trunk allowed vlan " + vlanText(p.allowed));
    if (p.mode !== "dynamic auto") L.push(" switchport mode " + p.mode);
    if (p.nonegotiate) L.push(" switchport nonegotiate"); if (p.speed !== "auto") L.push(" speed " + p.speed); if (p.duplex !== "auto") L.push(" duplex " + p.duplex); if (p.mdix === false) L.push(" no mdix auto"); if (p.shutdown) L.push(" shutdown"); L.push("!"); });
  L.push("interface Vlan1"); if (sw.vlan1.desc) L.push(" description " + sw.vlan1.desc); L.push(sw.vlan1.ip ? " ip address " + sw.vlan1.ip + " " + sw.vlan1.mask : " no ip address"); if (sw.vlan1.shutdown) L.push(" shutdown"); L.push("!");
  Object.keys(sw.svis || {}).map(Number).sort(function (a, b) { return a - b; }).forEach(function (v) { const s = sw.svis[v]; L.push("interface Vlan" + v); if (s.desc) L.push(" description " + s.desc); L.push(s.ip ? " ip address " + s.ip + " " + s.mask : " no ip address"); if (s.shutdown) L.push(" shutdown"); L.push("!"); });
  if (sw.gateway) L.push("ip default-gateway " + sw.gateway, "!");
  if (sw.banner != null) L.push("banner motd ^C" + sw.banner + "^C", "!");   /* shown with ^C as its delimiter, whatever was typed */
  L.push("line con 0"); if (sw.con.password) L.push(" password " + pw(sw.con.password)); if (sw.con.login) L.push(sw.con.login === "local" ? " login local" : " login");
  L.push("line vty 0 15"); if (sw.vty.password) L.push(" password " + pw(sw.vty.password)); if (sw.vty.login) L.push(sw.vty.login === "local" ? " login local" : " login"); L.push(" transport input " + sw.vty.transport);
  L.push("!", "end");
  return L;
}
function hashish(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return (h.toString(36) + "Q8zW2kP0").slice(0, 22).replace(/^./, "a"); }
function ipBrief(sw) {
  const pad = function (s, n) { return (s + " ".repeat(n)).slice(0, n); };
  const L = [pad("Interface", 23) + pad("IP-Address", 16) + "OK? " + pad("Method", 7) + pad("Status", 22) + "Protocol"];
  const v = status(sw, "Vlan1");
  L.push(pad("Vlan1", 23) + pad(sw.vlan1.ip || "unassigned", 16) + "YES " + pad(sw.vlan1.ip ? "manual" : "unset", 7) + pad(v[0], 22) + (sw.vlan1.shutdown ? "down" : "up"));
  Object.keys(sw.svis || {}).map(Number).sort(function (a, b) { return a - b; }).forEach(function (k) { const s = sw.svis[k], st = status(sw, "Vlan" + k); L.push(pad("Vlan" + k, 23) + pad(s.ip || "unassigned", 16) + "YES " + pad(s.ip ? "manual" : "unset", 7) + pad(st[0], 22) + st[1]); });
  PORT_NAMES.forEach(function (n) { const s = status(sw, n); L.push(pad(n, 23) + pad("unassigned", 16) + "YES " + pad("unset", 7) + pad(s[0], 22) + s[1]); });
  return L;
}
/* the fingerprint of the switch's RSA host key, as an SSH client shows it: a new one each time keys are made */
export function hostKey(sw) {
  if (!sw.rsa) return null;
  const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/", seed = String(sw.mac) + ":" + sw.rsa + ":" + (sw.keyGen || 0) + (sw.unit ? ":" + sw.unit : "");   /* unit: a replacement switch makes keys of its own */
  let out = "", h = 2166136261;
  for (let i = 0; out.length < 43; i++) { for (const ch of seed + ":" + i) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } out += A[h % 64] + A[(h >>> 6) % 64] + A[(h >>> 12) % 64]; }
  return "SHA256:" + out.slice(0, 43);
}
/* what each SFP module reads about itself (digital optical monitoring): it sends light whatever happens; it receives
   only what the far end sends it on a wavelength it can hear. -40 dBm is no light at all */
function transceivers(sw) {
  const pad = function (s, n) { return (s + " ".repeat(n)).slice(0, n); }, rows = PORT_NAMES.filter(function (n) { return sw.links[n] && sw.links[n].module; });
  if (!rows.length) return ["% No transceivers found: every SFP slot is empty."];
  const L = ["                                    Optical   Optical", "           Temperature  Voltage     Tx Power  Rx Power", "Port       (Celsius)    (Volts)     (dBm)     (dBm)", "---------  -----------  ----------  --------  --------"];
  rows.forEach(function (n) { const l = sw.links[n]; if (l.unsupported) { L.push(pad(short(n), 11) + "% Unsupported transceiver (" + l.module + "): no readings"); return; } L.push(pad(short(n), 11) + pad("33.8", 13) + pad("3.29", 12) + pad("-5.6", 10) + (l.light ? "-6.1" : "-40.0") + (l.light ? "" : "    (no light received)")); });
  return L;
}
function inventory(sw) {
  const L = ['NAME: "1", DESCR: "MSW-2800G 24 x 10/100/1000 + 4 x SFP"', "PID: MSW-2800G       , VID: V01  , SN: ████████", ""];
  PORT_NAMES.forEach(function (n) { const l = sw.links[n]; if (l && l.module) L.push('NAME: "' + n + '", DESCR: "' + l.module + ' SFP' + (l.unsupported ? "+ (not supported in this slot)" : "") + '"', "PID: " + l.pid + (l.unsupported ? "" : "") + "   , VID: V01  , SN: ████████", ""); });
  return L;
}
function ifStatus(sw) {
  const pad = function (s, n) { return (s + " ".repeat(n)).slice(0, n); };
  const L = [pad("Port", 10) + pad("Name", 19) + pad("Status", 13) + pad("Vlan", 11) + pad("Duplex", 7) + pad("Speed", 7) + "Type"];
  PORT_NAMES.forEach(function (n) {
    const p = sw.ports[n], l = sw.links[n], st = status(sw, n), up = st[0] === "up";
    const ng = up ? negotiated(p, l) : null;
    const dx = up ? (ng.auto.duplex ? "a-" : "") + ng.duplex : p.duplex === "auto" ? "auto" : p.duplex;
    const sp = up ? (ng.auto.speed ? "a-" : "") + ng.speed : p.speed === "auto" ? "auto" : p.speed;
    L.push(pad(short(n), 10) + pad(p.desc, 19) + pad(p.shutdown ? "disabled" : l && l.unsupported ? "err-disabled" : up ? "connected" : "notconnect", 13) + pad(vlanCol(sw, n, up), 11) + pad(dx, 7) + pad(sp, 7) + (p.sfp ? (l && l.module ? l.module : "Not Present") : "10/100/1000BaseTX"));
  });
  return L;
}
function ifDetail(sw, n) {
  const p = sw.ports[n], l = sw.links[n], st = status(sw, n), up = st[0] === "up", ng = up ? negotiated(p, l) : null, c = (l && (l.counters || (up ? mismatchCounters(p, l) : null))) || {};
  const L = [n + " is " + st[0] + ", line protocol is " + st[1] + (up ? " (connected)" : p.shutdown ? " (disabled)" : " (notconnect)"),
    "  Hardware is Gigabit Ethernet, address is " + sw.mac + " (bia " + sw.mac + ")"];
  if (p.desc) L.push("  Description: " + p.desc);
  L.push("  MTU 1500 bytes, BW " + (up ? ng.speed * 1000 : 1000000) + " Kbit/sec, DLY 10 usec,",
    "  " + (up ? (ng.duplex === "full" ? "Full" : "Half") + "-duplex, " + ng.speed + "Mb/s" : "Auto-duplex, Auto-speed") + ", media type is " + (p.sfp ? "SFP" : "10/100/1000BaseTX"),
    "  5 minute input rate " + (up ? c.rate || 2000 : 0) + " bits/sec, " + (up ? 3 : 0) + " packets/sec",
    "     " + (c.input || (up ? 182311 : 0)) + " packets input, " + (c.inbytes || (up ? 22740118 : 0)) + " bytes, 0 no buffer",
    "     " + (c.runts || 0) + " runts, 0 giants, 0 throttles",
    "     " + (c.inErr || 0) + " input errors, " + (c.crc || 0) + " CRC, 0 frame, 0 overrun, 0 ignored",
    "     " + (c.output || (up ? 161840 : 0)) + " packets output, " + (c.outbytes || (up ? 19008214 : 0)) + " bytes, 0 underruns",
    "     " + (c.outErr || 0) + " output errors, " + (c.collisions || 0) + " collisions, 0 interface resets",
    "     0 babbles, " + (c.late || 0) + " late collision, 0 deferred");
  return L;
}
function vlanDetail(sw, n) { n = n || "Vlan1"; const v = sviOf(sw, n), s = status(sw, n); return [n + " is " + s[0] + ", line protocol is " + s[1], "  Hardware is EtherSVI, address is " + sw.mac].concat(v.desc ? ["  Description: " + v.desc] : [], [v.ip ? "  Internet address is " + v.ip + "/" + v.mask.split(".").map(function (p) { return (+p).toString(2); }).join("").replace(/0/g, "").length : "  Internet address is not set"]); }
/* show interfaces status: an access port's VLAN, "trunk", or "unassigned" when its VLAN doesn't exist */
function vlanCol(sw, n, up) { const p = sw.ports[n], c = carries(sw, n); if (up && c.mode === "trunk") return "trunk"; if (p.mode === "trunk") return "trunk"; return sw.vlans[p.access] ? String(p.access) : "unassigned"; }
/* show vlan brief: each VLAN, its name, and the access ports in it that are running as access ports */
function vlanTable(sw, only) {
  fix(sw); const pad = function (x, k) { return (x + " ".repeat(k)).slice(0, k); };
  const L = [pad("VLAN", 5) + pad("Name", 33) + pad("Status", 10) + "Ports", "---- -------------------------------- --------- -------------------------------"];
  (only || Object.keys(sw.vlans).map(Number).sort(function (a, b) { return a - b; })).forEach(function (v) {
    const ports = PORT_NAMES.filter(function (n) { const up = status(sw, n)[0] === "up"; return carries(sw, n).mode === "access" && sw.ports[n].access === v && !(up && carries(sw, n).mode === "trunk"); }).map(short);
    const lines = []; for (let i = 0; i < ports.length; i += 4) lines.push(ports.slice(i, i + 4).join(", "));
    L.push(pad(String(v), 5) + pad(sw.vlans[v].name, 33) + pad("active", 10) + (lines[0] || ""));
    lines.slice(1).forEach(function (x) { L.push(" ".repeat(48) + x); });
  });
  return L;
}
/* show interfaces trunk: the ports running as trunks, and what each carries */
function trunks(sw) {
  fix(sw); const pad = function (x, k) { return (x + " ".repeat(k)).slice(0, k); };
  const T = PORT_NAMES.filter(function (n) { return status(sw, n)[0] === "up" && carries(sw, n).mode === "trunk"; });
  if (!T.length) return [];
  const mode = function (p) { return p.mode === "trunk" ? (p.nonegotiate ? "on (no DTP)" : "on") : p.mode === "dynamic desirable" ? "desirable" : "auto"; };
  const L = [pad("Port", 12) + pad("Mode", 17) + pad("Encapsulation", 15) + pad("Status", 14) + "Native vlan"];
  T.forEach(function (n) { L.push(pad(short(n), 12) + pad(mode(sw.ports[n]), 17) + pad("802.1q", 15) + pad("trunking", 14) + sw.ports[n].native); });
  L.push("", pad("Port", 12) + "Vlans allowed on trunk"); T.forEach(function (n) { L.push(pad(short(n), 12) + vlanText(sw.ports[n].allowed)); });
  L.push("", pad("Port", 12) + "Vlans allowed and active in management domain"); T.forEach(function (n) { const c = carries(sw, n), a = c.tagged.concat(c.untagged != null ? [c.untagged] : []).sort(function (x, y) { return x - y; }); L.push(pad(short(n), 12) + vlanText(a)); });
  return L;
}
/* show interfaces gi0/N switchport */
function switchportOf(sw, n) {
  fix(sw); const p = sw.ports[n], up = status(sw, n)[0] === "up", c = carries(sw, n);
  const admin = { access: "static access", trunk: "trunk", "dynamic auto": "dynamic auto", "dynamic desirable": "dynamic desirable" }[p.mode];
  const nm = function (v) { return v + " (" + (sw.vlans[v] ? sw.vlans[v].name : "Inactive") + ")"; };
  return ["Name: " + short(n), "Switchport: Enabled", "Administrative Mode: " + admin, "Operational Mode: " + (!up ? "down" : c.mode === "trunk" ? "trunk" : "static access"),
    "Administrative Trunking Encapsulation: dot1q", "Operational Trunking Encapsulation: " + (up && c.mode === "trunk" ? "dot1q" : "native"),
    "Negotiation of Trunking: " + (p.nonegotiate || p.mode === "access" ? "Off" : "On"), "Access Mode VLAN: " + nm(p.access), "Trunking Native Mode VLAN: " + nm(p.native),
    "Trunking VLANs Enabled: " + (p.allowed === "all" ? "ALL" : vlanText(p.allowed))];
}
function macTable(sw) {
  const L = ["          Mac Address Table", "-------------------------------------------", "", "Vlan    Mac Address       Type        Ports", "----    -----------       --------    -----"];
  const rows = [];
  PORT_NAMES.forEach(function (n) { const l = sw.links[n]; if (!l || status(sw, n)[0] !== "up") return; const c = carries(sw, n);
    if (l.macs) l.macs.forEach(function (m) { if (m.vlan === c.untagged || c.tagged.indexOf(m.vlan) >= 0) rows.push([m.vlan, m.mac, n]); });   /* what's been heard through the port, VLAN by VLAN (beyond a trunk, many) */
    else if (l.mac && c.untagged != null) rows.push([c.untagged, l.mac, n]); });
  rows.sort(function (a, b) { return a[0] - b[0]; }).forEach(function (r) { L.push(String(r[0]).padStart(4) + "    " + r[1] + "    DYNAMIC     " + short(r[2])); });
  L.push("Total Mac Addresses for this criterion: " + (L.length - 5)); return L;
}

/* ------------------------------------------------------------ the parser */
/* match a word against a list of commands: exact, or the one command it is a prefix of */
function match(list, w) {
  const lw = w.toLowerCase(), exact = list.filter(function (c) { return c[0].toLowerCase() === lw || (c[0] === "tftp:" && /^tftp:\/\//.test(lw)); });   /* tftp://host/file names the server and the file on the line */
  if (exact.length) return { one: exact[0] };
  const m = list.filter(function (c) { return c[0].toLowerCase().indexOf(lw) === 0; });
  return m.length === 1 ? { one: m[0] } : m.length ? { many: m } : { none: true };
}
const caret = function (prompt, raw, pos) { return " ".repeat(prompt.length + pos) + "^"; };
/* a global command typed in a sub-mode (interface, line, VLAN...) is run as a global command, and you're back in global
   configuration, as on the real thing: nothing runs until a line parses, so trying it there is safe */
function run(S, raw) {
  const r = run1(S, raw);
  if (!r.none || /^(user|priv|config|login|gone)$/.test(S.mode)) return r;
  const was = { mode: S.mode, ifs: S.ifs, line: S.line, vl: S.vl, pool: S.pool, acl: S.acl };
  S.mode = "config"; S.ifs = null; S.line = null; S.vl = null; S.pool = null; S.acl = null;
  const r2 = run1(S, raw); if (!r2.none) return r2;
  Object.assign(S, was); return r;
}
function run1(S, raw) {
  const line = raw.replace(/\s+$/, ""), tokens = line.trim().split(/\s+/).filter(Boolean);
  if (!tokens.length) return { lines: [] };
  let list = treeOf(S)[S.mode], i = 0, pos = line.indexOf(tokens[0]);
  while (i < tokens.length) {
    const r = match(list, tokens[i]);
    if (r.none) return { lines: [caret(promptOf(S), line, pos), "% Invalid input detected at '^' marker."], none: true };
    if (r.many) return { lines: ["% Ambiguous command:  \"" + line.trim() + "\""] };
    const c = r.one, h = c[2];
    if (typeof h === "function") return { lines: h(S, tokens.slice(i + 1), line) || [] };
    i++;
    if (i >= tokens.length) return { lines: c[3] && c[3].bare ? c[3].bare(S) : ["% Incomplete command."] };
    pos = line.indexOf(tokens[i], pos + tokens[i - 1].length);
    list = h;
  }
  return { lines: ["% Incomplete command."] };
}
/* "?" help: after a space, every word that can come next; straight after letters, the words starting with them */
function help(S, raw) {
  const pre = raw.slice(0, -1), endsSpace = /\s$/.test(pre) || pre === "", tokens = pre.trim().split(/\s+/).filter(Boolean);
  let list = treeOf(S)[S.mode], extra = null, from = 0;
  if (!/^(user|priv)$/.test(S.mode) && tokens.length && match(list, tokens[0]).one && match(list, tokens[0]).one[0] === "do" && (tokens.length > 1 || endsSpace)) { list = treeOf(S).priv; from = 1; }   /* "do" runs an EXEC command: its help is EXEC's */
  const upto = endsSpace ? tokens : tokens.slice(0, -1);
  for (let i = from; i < upto.length; i++) {
    const r = match(list, upto[i]); if (!r.one) return r.many ? ["% Ambiguous command:  \"" + pre.trim() + "\""] : ["% Unrecognized command"];
    const h = r.one[2];
    if (typeof h === "function") { return r.one[3] && r.one[3].sub && i === upto.length - 1 ? fmt(r.one[3].sub).concat(["  <cr>"]) : ["  LINE    the value (a name, an address, a password)", "  <cr>"]; }
    list = h; if (r.one[3] && r.one[3].bare && i === upto.length - 1) extra = "  <cr>";
  }
  if (endsSpace) return fmt(list).concat(extra ? [extra] : []);
  const w = tokens[tokens.length - 1].toLowerCase();
  const m = list.filter(function (c) { return c[0].toLowerCase().indexOf(w) === 0; });
  return m.length ? [m.map(function (c) { return c[0]; }).join("  ")] : ["% Unrecognized command"];
}
function fmt(list) { const wd = Math.max.apply(null, list.map(function (c) { return c[0].length; })) + 3; return list.map(function (c) { return "  " + (c[0] + " ".repeat(wd)).slice(0, wd) + c[1]; }); }
/* Tab: complete the word being typed, if only one command starts with it */
export function complete(S, raw) {
  if (!raw.trim() || /\s$/.test(raw)) return raw;
  const tokens = raw.trim().split(/\s+/); let list = treeOf(S)[S.mode];
  for (let i = 0; i < tokens.length - 1; i++) { const r = match(list, tokens[i]); if (!r.one || !Array.isArray(r.one[2])) return raw; list = r.one[2]; }
  const r = match(list, tokens[tokens.length - 1]); if (!r.one) return raw;
  tokens[tokens.length - 1] = r.one[0]; return tokens.join(" ") + " ";
}

/* ------------------------------------------------------------ sessions */
export function promptOf(S) {
  const h = S.sw.hostname, P = Object.assign({ user: ">", priv: "#", config: "(config)#", if: "(config-if)#", line: "(config-line)#" }, osOf(S.sw).prompts);
  if (S.mode === "login") return "Password: ";
  if (S.mode === "gone") return "";
  return h + (P[S.mode] || ">");
}
/* a console login: the password prompt only if the console line asks for one */
export function session(sw, o = {}) {
  const S = { sw: sw, mode: "user", history: [], pending: null, via: o.via || "console", reach: o.reach, tftp: o.tftp, tftpGet: o.tftpGet, live: o.live, via1: o.via1, fresh: true };   /* live: what only the network knows (a router's leases, translations, hit counts); via1: the interface a file comes in on */   /* fresh: the first RETURN wakes the line ("Press RETURN to get started") */
  const ln = S.via === "console" ? sw.con : sw.vty;
  if (ln.login === "password" && ln.password) { S.mode = "login"; S.pending = { kind: "login", tries: 0 }; }
  return S;
}
export function banner(S) { return S.mode === "login" ? ["", "User Access Verification", ""] : ["", "Press RETURN to get started.", ""]; }
/* what a console shows as its line wakes: the message of the day, if there is one, then the password prompt if it asks */
export function motd(sw) { return sw.banner != null ? [""].concat(String(sw.banner).split("\n")) : []; }
function wake(S) { return motd(S.sw).concat(S.mode === "login" ? ["", "User Access Verification", ""] : []); }
/* run one line; returns { out: [lines], prompt, secret: true when the next input is a password (not echoed) } */
export function exec(S, raw) {
  raw = String(raw == null ? "" : raw);
  if (S.mode === "gone") { const fresh = session(S.sw, { via: S.via, reach: S.reach, tftp: S.tftp, tftpGet: S.tftpGet, live: S.live, via1: S.via1 }); Object.assign(S, fresh); S.fresh = false; return { out: wake(S), prompt: promptOf(S), secret: S.mode === "login" }; }   /* RETURN at "Press RETURN to get started" */
  if (S.fresh) { S.fresh = false; if (!raw.trim()) return { out: wake(S), prompt: promptOf(S), secret: S.mode === "login" }; }
  if (S.pending) return answer(S, raw);
  if (/\?$/.test(raw)) return { out: help(S, raw), prompt: promptOf(S), keep: raw.slice(0, -1) };
  if (raw.trim()) S.history.push(raw.trim());
  /* "| include", "| exclude", "| begin", "| section": filter what a show command prints */
  const pipe = (/^(user|priv)$/.test(S.mode) || /^\s*do\s/i.test(raw)) && /^(.*?)\s\|\s*(\S+)\s*(.*)$/.exec(raw);   /* show commands only: a | in a banner is part of its words */
  if (pipe) {
    const f = match([["include"], ["exclude"], ["begin"], ["section"]], pipe[2]);
    if (!f.one || !pipe[3]) return { out: ["% Invalid input detected at '^' marker."], prompt: promptOf(S) };
    const r = run(S, pipe[1]), re = new RegExp(pipe[3].replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    let out = r.lines;
    if (f.one[0] === "include") out = out.filter(function (l) { return re.test(l); });
    else if (f.one[0] === "exclude") out = out.filter(function (l) { return !re.test(l); });
    else if (f.one[0] === "begin") { const k = out.findIndex(function (l) { return re.test(l); }); out = k < 0 ? [] : out.slice(k); }
    else { const keep = []; let on = false; out.forEach(function (l) { if (/^\S/.test(l)) on = re.test(l); if (on) keep.push(l); }); out = keep; }
    return ask(S, out);
  }
  const r = run(S, raw);
  return ask(S, r.lines);
}
/* a command that asks a question (a password, a confirmation) ends with it: it becomes the prompt */
function ask(S, lines) {
  if (!S.pending) return { out: lines, prompt: promptOf(S) };
  if (S.pending.kind === "banner") return { out: lines, prompt: "" };   /* the banner's own lines come with no prompt in front of them */
  const q = lines.length ? lines[lines.length - 1] : ""; return { out: lines.slice(0, -1), prompt: q, secret: /^(enable|login)$/.test(S.pending.kind) };
}
function answer(S, raw) {
  const p = S.pending, t = raw.trim();
  if (p.kind === "login" || p.kind === "enable") {
    const want = p.kind === "login" ? S.sw[S.via === "console" ? "con" : "vty"].password : (S.sw.enableSecret || S.sw.enablePassword);
    if (pwOk(want, raw)) { S.pending = null; S.mode = p.kind === "login" ? "user" : "priv"; return { out: [], prompt: promptOf(S) }; }
    p.tries++;
    if (p.tries >= 3) { S.pending = null; if (p.kind === "login") { S.mode = "gone"; return { out: ["% Bad passwords", "", "Press RETURN to get started."], prompt: "" }; } return { out: ["% Bad secrets"], prompt: promptOf(S) }; }
    return { out: [], prompt: "Password: ", secret: true };   /* asked again, up to three tries */
  }
  if (p.kind === "banner") {   /* the lines of a banner, until the delimiter comes */
    const k = raw.indexOf(p.delim);
    if (k < 0) { p.text.push(raw); return { out: [], prompt: "" }; }
    p.text.push(raw.slice(0, k)); S.pending = null; S.sw.banner = p.text.join("\n");
    return { out: [], prompt: promptOf(S) };
  }
  if (p.kind === "tftphost") {
    const h = t || p.host;
    if (!h || !/^[A-Za-z0-9.-]+$/.test(h)) { S.pending = null; return { out: ["%Error parsing tftp://" + (h || "") + "/" + p.file + " (Bad IP address or host name)"], prompt: promptOf(S) }; }
    p.host = h; p.kind = "tftpfile";
    return { out: [], prompt: "Destination filename [" + p.file + "]? " };
  }
  if (p.kind === "tftpfile") { S.pending = null; if (t) p.file = t; return { out: tftpSend(S, p), prompt: promptOf(S) }; }
  if (p.kind === "gethost") {
    const h = t || p.host;
    if (!h || !/^[A-Za-z0-9.-]+$/.test(h)) { S.pending = null; return { out: ["%Error parsing tftp://" + (h || "") + "/" + p.file + " (Bad IP address or host name)"], prompt: promptOf(S) }; }
    p.host = h; p.kind = "getsrc";
    return { out: [], prompt: "Source filename [" + p.file + "]? " };
  }
  if (p.kind === "getsrc") {
    if (t) p.file = t;
    if (!p.file) { S.pending = null; return { out: ["%Error parsing tftp://" + p.host + "/ (Bad file name)"], prompt: promptOf(S) }; }
    p.kind = "getdst";
    return { out: [], prompt: "Destination filename [" + p.into + "-config]? " };
  }
  if (p.kind === "getdst") {
    S.pending = null;
    if (t && t.toLowerCase() !== p.into + "-config") return { out: ["% Only " + p.into + "-config is a destination here: say which configuration with the copy command."], prompt: promptOf(S) };
    return { out: tftpLoad(S, p), prompt: promptOf(S) };
  }
  if (p.kind === "copyname") { S.pending = null; if (!t || t === "startup-config") { save(S.sw); return { out: ["Building configuration...", "[OK]"], prompt: promptOf(S) }; } return { out: ["% Only startup-config is a destination on this switch."], prompt: promptOf(S) }; }
  if (p.kind === "confterm") { S.pending = null; if (!t || /^t/i.test(t)) { S.mode = "config"; return { out: ["Enter configuration commands, one per line.  End with CNTL/Z."], prompt: promptOf(S) }; } return { out: ["?Must be \"terminal\""], prompt: promptOf(S) }; }
  if (p.kind === "modulus") { S.pending = null; return { out: rsa(S, t ? +t : 512), prompt: promptOf(S) }; }
  if (p.kind === "confirm") { S.pending = null; if (!t || /^y/i.test(t)) return { out: p.then(), prompt: promptOf(S) }; return { out: [], prompt: promptOf(S) }; }
  if (p.kind === "reload") {
    if (p.unsaved && !p.asked) {
      if (/^y/i.test(t)) { save(S.sw); p.asked = true; p.unsaved = false; return ask(S, ["Building configuration...", "[OK]", "Proceed with reload? [confirm]"]); }
      if (/^n/i.test(t)) { p.asked = true; return ask(S, ["Proceed with reload? [confirm]"]); }
      return ask(S, ["% Please answer 'yes' or 'no'.", "System configuration has been modified. Save? [yes/no]: "]);
    }
    S.pending = null;
    if (t && !/^y/i.test(t) && t !== "") return { out: [], prompt: promptOf(S) };
    reload(S.sw, "reload"); const fresh = session(S.sw, { via: S.via, reach: S.reach, tftp: S.tftp, tftpGet: S.tftpGet, live: S.live, via1: S.via1 }); Object.assign(S, fresh);
    return { out: ["", "%SYS-5-RELOAD: Reload requested by console. Reload Reason: Reload command.", "", "Loading the system image... [OK]", "", osOf(S.sw).image, S.sw.startup ? "" : "No startup configuration found: starting with factory settings.", ""].concat(banner(S)), prompt: promptOf(S), secret: S.mode === "login" };
  }
  S.pending = null; return { out: [], prompt: promptOf(S) };
}

registerOS("switch", { bootUp: function (sw, n) { if (isSvi(n)) sviOf(sw, n).shutdown = false; else sw.ports[n].shutdown = false; }, tree: TREE, prompts: { ifrange: "(config-if-range)#", vlan: "(config-vlan)#" }, keys: CONFIG_KEYS, fresh: function () { return newSwitch(); }, config: runningConfig, image: "MSW-2800G Network Operating System, Version 4.2.1" });
/* what another device with this command line (the business router, rtcli.js) builds its own from */
export const CORE = { CONFIG: CONFIG, EXEC_USER: EXEC_USER, EXEC_PRIV: EXEC_PRIV, SHOW: SHOW, LINE: LINE, typed: typed, pwText: pwText, hashish: hashish, clone: clone, ip4: ip4, isMask: isMask,
  save: save, changed: changed, logout: logout, setTransport: setTransport, applyText: applyText, snapshot: snapshot };
