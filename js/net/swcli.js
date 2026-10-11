/* The managed switch's command line: the industry-standard style (user and
   privileged EXEC, global, interface and line configuration; ? for help,
   Tab to complete, any unique abbreviation), on our own unbranded switch
   (MSW-2800G). Pure: no page code, tested under Node. A switch is plain
   data (newSwitch); a session is a console or SSH login to it (session);
   exec runs one line and returns what the screen shows and the new prompt.
   The running configuration changes as commands are entered; only
   "copy running-config startup-config" (or "write memory") keeps it over a
   reload or a power cut, as on the real thing. */

const COPPER = 24, SFP = 4;
export const PORT_NAMES = Array.from({ length: COPPER + SFP }, function (_, i) { return "GigabitEthernet0/" + (i + 1); });
const short = function (n) { return n.replace("GigabitEthernet", "Gi"); };

/* a switch fresh from its box: no passwords, no address, every port on, speed and duplex negotiated */
export function newSwitch(o = {}) {
  const ports = {};
  PORT_NAMES.forEach(function (n, i) { ports[n] = { desc: "", speed: "auto", duplex: "auto", shutdown: false, sfp: i >= COPPER }; });
  const sw = { model: "MSW-2800G", hostname: "Switch", enableSecret: null, enablePassword: null, encrypt: false,
    con: { password: null, login: null }, vty: { password: null, login: null, transport: "telnet" },
    users: {}, domain: null, rsa: 0, vlan1: { ip: null, mask: null, shutdown: true }, gateway: null, ports: ports,
    links: o.links || {}, mac: o.mac || "00e0.4c██.████", serial: "██████████", startup: null, uptime: o.uptime || "2 minutes" };
  return sw;
}
const clone = function (x) { return JSON.parse(JSON.stringify(x)); };
const CONFIG_KEYS = ["hostname", "enableSecret", "enablePassword", "encrypt", "con", "vty", "users", "domain", "rsa", "vlan1", "gateway", "ports"];
function snapshot(sw) { const s = {}; CONFIG_KEYS.forEach(function (k) { s[k] = clone(sw[k]); }); return s; }
/* power off and on: what was saved comes back; anything not saved is gone (a factory switch comes back empty) */
export function reload(sw) {
  const base = sw.startup ? clone(sw.startup) : snapshot(newSwitch());
  CONFIG_KEYS.forEach(function (k) { sw[k] = base[k]; });
  sw.uptime = "0 minutes";
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
  if (m) { let num = m[2]; if (!num) { num = tokens[i + 1]; used = 2; } if (!num) return { err: "incomplete", used: used }; return num === "1" ? { name: "Vlan1", used: used } : { err: "novlan", used: used, num: num }; }
  return null;
}
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
  const p = sw.ports[n], l = sw.links[n];
  if (p.shutdown) return ["administratively down", "down"];
  if (!l) return ["down", "down"];
  if (linkFails(p, l)) return ["down", "down"];
  return ["up", "up"];
}
/* a link comes up only if both ends can agree: a fixed speed must match the far end's; on fibre the module must suit the far end */
function linkFails(p, l) { if (l.sfpMismatch) return true; const far = l.speed || "auto"; if (p.speed !== "auto" && far !== "auto" && p.speed !== far) return true; return false; }
/* what the port negotiated: speed, and duplex (a fixed end facing auto falls back to half duplex, the classic mismatch) */
function negotiated(p, l) {
  const sp = p.speed !== "auto" ? p.speed : l.speed && l.speed !== "auto" ? l.speed : String(l.max || 1000);
  let dx; if (p.duplex !== "auto") dx = p.duplex; else if (l.duplex && l.duplex !== "auto") dx = "half"; else dx = "full";
  return { speed: sp, duplex: dx, auto: { speed: p.speed === "auto", duplex: p.duplex === "auto" } };
}

const SHOW = [
  ["running-config", "Current operating configuration", function (S) { return runningConfig(S.sw); }],
  ["startup-config", "Contents of startup-config", function (S) { return S.sw.startup ? runningConfig(Object.assign({}, S.sw, S.sw.startup), true) : ["startup-config is not present"]; }],
  ["version", "System hardware and software status", function (S) { const sw = S.sw; return ["MSW-2800G Network Operating System, Version 4.2.1", "", sw.hostname + " uptime is " + sw.uptime, "", "Model number: MSW-2800G (24 x 10/100/1000, 4 x SFP)", "Base MAC address: " + sw.mac, "System serial number: " + sw.serial, "", "Configuration register: 0x2102"]; }],
  ["ip", "IP information", [["interface", "IP interface status and configuration", [["brief", "Brief summary of IP status and configuration", function (S) { return ipBrief(S.sw); }]]]]],
  ["interfaces", "Interface status and configuration", function (S, args) {
    if (!args.length) return PORT_NAMES.slice(0, 4).reduce(function (a, n) { return a.concat(ifDetail(S.sw, n)); }, []).concat(["(showing the first four; name a port: show interfaces gi0/5)"]);
    if (/^st/i.test(args[0])) return ifStatus(S.sw);
    const f = ifName(args, 0); if (!f || f.err) return ["% Invalid input detected at '^' marker."];
    return f.name === "Vlan1" ? vlanDetail(S.sw) : ifDetail(S.sw, f.name);
  }, { sub: [["status", "Show interface line status"], ["GigabitEthernet", "GigabitEthernet IEEE 802.3z"], ["Vlan", "The switch's own interface (VLAN 1)"]] }],
  ["mac", "MAC configuration", [["address-table", "MAC forwarding table", function (S) { return macTable(S.sw); }]]],
  ["history", "Display the session command history", function (S) { return S.history.slice(-10).map(function (h) { return "  " + h; }); }],
  ["clock", "Display the system clock", function () { return ["*10:42:07.311 UTC Sun Oct 11 2026"]; }],
  ["users", "Display information about terminal lines", function (S) { return ["    Line       User       Host(s)              Idle       Location", "*  0 con 0                idle                 00:00:00"]; }],
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
  ["copy", "Copy from one file to another", [["running-config", "Copy from current system configuration", [["startup-config", "Copy to startup configuration", function (S) { S.pending = { kind: "copyname" }; return ["Destination filename [startup-config]? "]; }]]]]],
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
    ["secret", "Assign the privileged level secret", function (S, a) { if (!a.length) return ["% Incomplete command."]; S.sw.enableSecret = a[a.length - 1]; return []; }],
    ["password", "Assign the privileged level password", function (S, a) { if (!a.length) return ["% Incomplete command."]; const pw = a[a.length - 1]; if (S.sw.enableSecret === pw) return ["The enable password you have chosen is the same as your enable secret.", "This is not recommended.  Re-enter the enable password."]; S.sw.enablePassword = pw; return []; }]
  ]],
  ["interface", "Select an interface to configure", function (S, a) {
    if (!a.length) return ["% Incomplete command."];
    if (/^r/i.test(a[0])) { const r = ifRange(a.slice(1)); if (!r) return ["% Invalid input detected at '^' marker."]; S.mode = "ifrange"; S.ifs = r; return []; }
    const f = ifName(a, 0); if (!f) return ["% Invalid input detected at '^' marker."]; if (f.err === "incomplete") return ["% Incomplete command."];
    if (f.err === "novlan") return ["% VLAN " + f.num + " does not exist on this switch yet (VLANs come with the small business level)."];
    if (f.err) return ["% Invalid input detected at '^' marker."];
    S.mode = "if"; S.ifs = [f.name]; return [];
  }, { sub: [["GigabitEthernet", "GigabitEthernet IEEE 802.3z"], ["Vlan", "The switch's own interface (VLAN 1)"], ["range", "interface range command"]] }],
  ["line", "Configure a terminal line", [["console", "Primary terminal line", function (S, a) { if (a[0] !== "0") return a.length ? ["% Invalid input detected at '^' marker."] : ["% Incomplete command."]; S.mode = "line"; S.line = "con"; return []; }], ["vty", "Virtual terminal", function (S, a) { if (!a.length) return ["% Incomplete command."]; if (!/^\d+$/.test(a[0]) || (a[1] && !/^\d+$/.test(a[1])) || +a[0] > 15 || +(a[1] || 0) > 15) return ["% Invalid input detected at '^' marker."]; S.mode = "line"; S.line = "vty"; return []; }]]],
  ["ip", "Global IP configuration subcommands", [
    ["default-gateway", "Specify default gateway (if not routing IP)", function (S, a) { if (!a.length) return ["% Incomplete command."]; if (!ip4(a[0])) return ["% Invalid input detected at '^' marker."]; S.sw.gateway = a[0]; return []; }],
    ["domain-name", "Define the default domain name", function (S, a) { if (!a.length) return ["% Incomplete command."]; S.sw.domain = a[0]; return []; }],
    ["ssh", "Configure ssh options", [["version", "Specify protocol version", function (S, a) { return a[0] === "2" ? [] : ["% Invalid input detected at '^' marker."]; }]]]
  ]],
  ["username", "Establish User Name Authentication", function (S, a) {
    if (a.length < 3 || !/^(secret|password)$/i.test(a[1])) return a.length < 3 ? ["% Incomplete command."] : ["% Invalid input detected at '^' marker."];
    S.sw.users[a[0]] = a.slice(2).join(" "); return [];
  }],
  ["crypto", "Encryption module", [["key", "Long term key operations", [["generate", "Generate new keys", [["rsa", "Generate RSA keys", function (S, a) {
    if (!S.sw.domain) return ["% Please define a domain-name first."];
    if (S.sw.hostname === "Switch") return ["% Please define a hostname other than Switch."];
    const m = a.join(" ").match(/modulus\s+(\d+)/i); if (m) return rsa(S, +m[1]);
    S.pending = { kind: "modulus" }; return ["The name for the keys will be: " + S.sw.hostname + "." + S.sw.domain, "Choose the size of the key modulus in the range of 360 to 4096 for your", "  General Purpose Keys. Choosing a key modulus greater than 512 may take", "  a few minutes.", "", "How many bits in the modulus [512]: "];
  }]]]]]]],
  ["service", "Modify use of network based services", [["password-encryption", "Encrypt system passwords", function (S) { S.sw.encrypt = true; return []; }]]],
  ["do", "To run exec commands in config mode", function (S, a, raw) { const was = S.mode; S.mode = "priv"; const r = run(S, raw.replace(/^\s*do\s+/i, "")); S.mode = was; return r.lines; }],
  ["no", "Negate a command or set its defaults", [
    ["hostname", "Set system's network name", function (S) { S.sw.hostname = "Switch"; return []; }],
    ["enable", "Modify enable password parameters", [["secret", "Assign the privileged level secret", function (S) { S.sw.enableSecret = null; return []; }], ["password", "Assign the privileged level password", function (S) { S.sw.enablePassword = null; return []; }]]],
    ["ip", "Global IP configuration subcommands", [["default-gateway", "Specify default gateway", function (S) { S.sw.gateway = null; return []; }], ["domain-name", "Define the default domain name", function (S) { S.sw.domain = null; return []; }]]],
    ["username", "Establish User Name Authentication", function (S, a) { delete S.sw.users[a[0]]; return []; }],
    ["service", "Modify use of network based services", [["password-encryption", "Encrypt system passwords", function (S) { S.sw.encrypt = false; return []; }]]]
  ]],
  ["end", "Exit from configure mode", function (S) { S.mode = "priv"; return []; }],
  ["exit", "Exit from configure mode", function (S) { S.mode = "priv"; return []; }]
];
const IFACE = [
  ["description", "Interface specific description", function (S, a, raw) { const d = raw.replace(/^\s*\S+\s*/, ""); if (!d) return ["% Incomplete command."]; S.ifs.forEach(function (n) { if (n !== "Vlan1") S.sw.ports[n].desc = d.slice(0, 240); }); return []; }],
  ["speed", "Configure speed operation.", [["10", "Force 10 Mbps operation", function (S) { return setPort(S, "speed", "10"); }], ["100", "Force 100 Mbps operation", function (S) { return setPort(S, "speed", "100"); }], ["1000", "Force 1000 Mbps operation", function (S) { return setPort(S, "speed", "1000"); }], ["auto", "Enable AUTO speed configuration", function (S) { return setPort(S, "speed", "auto"); }]]],
  ["duplex", "Configure duplex operation.", [["full", "Force full duplex operation", function (S) { return setPort(S, "duplex", "full"); }], ["half", "Force half-duplex operation", function (S) { return setPort(S, "duplex", "half"); }], ["auto", "Enable AUTO duplex configuration", function (S) { return setPort(S, "duplex", "auto"); }]]],
  ["shutdown", "Shutdown the selected interface", function (S) { S.ifs.forEach(function (n) { if (n === "Vlan1") S.sw.vlan1.shutdown = true; else S.sw.ports[n].shutdown = true; }); return S.ifs.map(function (n) { return "%LINK-5-CHANGED: Interface " + n + ", changed state to administratively down"; }); }],
  ["ip", "Interface Internet Protocol config commands", [["address", "Set the IP address of an interface", function (S, a) {
    if (S.ifs[0] !== "Vlan1") return ["% Invalid input detected at '^' marker.", "  (a switch port is layer 2: the switch's own address goes on interface vlan 1)"];
    if (a.length < 2) return ["% Incomplete command."]; if (!ip4(a[0]) || !isMask(a[1])) return ["% Invalid input detected at '^' marker."];
    S.sw.vlan1.ip = a[0]; S.sw.vlan1.mask = a[1]; return [];
  }]]],
  ["switchport", "Set switching mode characteristics", [["mode", "Set trunking mode of the interface", [["access", "Set trunking mode to ACCESS unconditionally", function () { return []; }]]]]],
  ["no", "Negate a command or set its defaults", [
    ["shutdown", "Shutdown the selected interface", function (S) { const out = []; S.ifs.forEach(function (n) { if (n === "Vlan1") { S.sw.vlan1.shutdown = false; out.push("%LINK-3-UPDOWN: Interface Vlan1, changed state to up"); } else { S.sw.ports[n].shutdown = false; const st = status(S.sw, n); out.push("%LINK-3-UPDOWN: Interface " + n + ", changed state to " + (st[0] === "up" ? "up" : "down")); } }); return out; }],
    ["description", "Interface specific description", function (S) { S.ifs.forEach(function (n) { if (n !== "Vlan1") S.sw.ports[n].desc = ""; }); return []; }],
    ["speed", "Configure speed operation.", function (S) { return setPort(S, "speed", "auto"); }],
    ["duplex", "Configure duplex operation.", function (S) { return setPort(S, "duplex", "auto"); }],
    ["ip", "Interface Internet Protocol config commands", [["address", "Set the IP address of an interface", function (S) { if (S.ifs[0] === "Vlan1") { S.sw.vlan1.ip = null; S.sw.vlan1.mask = null; } return []; }]]]
  ]],
  ["interface", "Select an interface to configure", null],
  ["do", "To run exec commands in config mode", null],
  ["end", "Exit from configure mode", function (S) { S.mode = "priv"; S.ifs = null; return []; }],
  ["exit", "Exit from interface configuration mode", function (S) { S.mode = "config"; S.ifs = null; return []; }]
];
const LINE = [
  ["password", "Set a password", function (S, a) { if (!a.length) return ["% Incomplete command."]; S.sw[S.line].password = a[a.length - 1]; return []; }],
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
const TREE = { user: EXEC_USER, priv: EXEC_PRIV, config: CONFIG, if: IFACE, ifrange: IFACE, line: LINE };

function setPort(S, k, v) { S.ifs.forEach(function (n) { if (n !== "Vlan1") S.sw.ports[n][k] = v; }); return []; }
function setTransport(S, v) { if (S.line !== "vty") return ["% Invalid input detected at '^' marker.", "  (transport input is for the vty lines: remote logins)"]; S.sw.vty.transport = v; return []; }
function rsa(S, bits) { if (bits < 360 || bits > 4096) return ["% Invalid input detected at '^' marker."]; S.sw.rsa = bits; return ["% Generating " + bits + " bit RSA keys, keys will be non-exportable...", "[OK] (elapsed time was 2 seconds)", "", "%SSH-5-ENABLED: SSH 2.0 has been enabled"]; }
function save(sw) { sw.startup = snapshot(sw); }
/* whether the running configuration differs from what is saved (a factory switch has nothing saved) */
export function unsaved(sw) { return changed(sw); }
function changed(sw) { return JSON.stringify(snapshot(sw)) !== JSON.stringify(sw.startup || snapshot(newSwitch())); }
function logout(S) { S.mode = "gone"; return ["", S.sw.hostname + " con0 is now available", "", "", "", "Press RETURN to get started."]; }
function pingOut(S, a) {
  if (!a.length || !ip4(a[0])) return a.length ? ["% Unrecognized host or address, or protocol not running."] : ["% Incomplete command."];
  if (!S.sw.vlan1.ip || S.sw.vlan1.shutdown) return ["Type escape sequence to abort.", "Sending 5, 100-byte ICMP Echos to " + a[0] + ", timeout is 2 seconds:", ".....", "Success rate is 0 percent (0/5)"];
  const ok = S.reach ? S.reach(a[0]) : false;
  return ["Type escape sequence to abort.", "Sending 5, 100-byte ICMP Echos to " + a[0] + ", timeout is 2 seconds:", ok ? "!!!!!" : ".....", ok ? "Success rate is 100 percent (5/5), round-trip min/avg/max = 1/1/2 ms" : "Success rate is 0 percent (0/5)"];
}

/* ------------------------------------------------------------ the show outputs */
function runningConfig(sw, startup) {
  const L = ["Building configuration...", "", "Current configuration : " + (1800 + JSON.stringify(sw.ports).length % 900) + " bytes", "!", "version 4.2", sw.encrypt ? "service password-encryption" : "no service password-encryption", "!", "hostname " + sw.hostname, "!"];
  const pw = function (p, kind) { return kind === "secret" ? "5 $1$Rk3T$" + hashish(p) : sw.encrypt ? "7 " + hashish(p).slice(0, 14).toUpperCase() : p; };
  if (sw.enableSecret) L.push("enable secret " + pw(sw.enableSecret, "secret"));
  if (sw.enablePassword) L.push("enable password " + pw(sw.enablePassword));
  Object.keys(sw.users).forEach(function (u) { L.push("username " + u + " secret " + pw(sw.users[u], "secret")); });
  if (sw.enableSecret || sw.enablePassword || Object.keys(sw.users).length) L.push("!");
  if (sw.domain) L.push("ip domain-name " + sw.domain, "!");
  PORT_NAMES.forEach(function (n) { const p = sw.ports[n]; L.push("interface " + n); if (p.desc) L.push(" description " + p.desc); if (p.speed !== "auto") L.push(" speed " + p.speed); if (p.duplex !== "auto") L.push(" duplex " + p.duplex); if (p.shutdown) L.push(" shutdown"); L.push("!"); });
  L.push("interface Vlan1"); L.push(sw.vlan1.ip ? " ip address " + sw.vlan1.ip + " " + sw.vlan1.mask : " no ip address"); if (sw.vlan1.shutdown) L.push(" shutdown"); L.push("!");
  if (sw.gateway) L.push("ip default-gateway " + sw.gateway, "!");
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
  PORT_NAMES.forEach(function (n) { const s = status(sw, n); L.push(pad(n, 23) + pad("unassigned", 16) + "YES " + pad("unset", 7) + pad(s[0], 22) + s[1]); });
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
    L.push(pad(short(n), 10) + pad(p.desc, 19) + pad(p.shutdown ? "disabled" : up ? "connected" : "notconnect", 13) + pad("1", 11) + pad(dx, 7) + pad(sp, 7) + (p.sfp ? (l && l.module ? l.module : "Not Present") : "10/100/1000BaseTX"));
  });
  return L;
}
function ifDetail(sw, n) {
  const p = sw.ports[n], l = sw.links[n], st = status(sw, n), up = st[0] === "up", ng = up ? negotiated(p, l) : null, c = (l && l.counters) || {};
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
function vlanDetail(sw) { const s = status(sw, "Vlan1"); return ["Vlan1 is " + s[0] + ", line protocol is " + (sw.vlan1.shutdown ? "down" : "up"), "  Hardware is EtherSVI, address is " + sw.mac, sw.vlan1.ip ? "  Internet address is " + sw.vlan1.ip + "/" + sw.vlan1.mask.split(".").map(function (p) { return (+p).toString(2); }).join("").replace(/0/g, "").length : "  Internet address is not set"]; }
function macTable(sw) {
  const L = ["          Mac Address Table", "-------------------------------------------", "", "Vlan    Mac Address       Type        Ports", "----    -----------       --------    -----"];
  PORT_NAMES.forEach(function (n) { const l = sw.links[n]; if (l && l.mac && status(sw, n)[0] === "up") L.push("   1    " + l.mac + "    DYNAMIC     " + short(n)); });
  L.push("Total Mac Addresses for this criterion: " + (L.length - 5)); return L;
}

/* ------------------------------------------------------------ the parser */
/* match a word against a list of commands: exact, or the one command it is a prefix of */
function match(list, w) {
  const lw = w.toLowerCase(), exact = list.filter(function (c) { return c[0].toLowerCase() === lw; });
  if (exact.length) return { one: exact[0] };
  const m = list.filter(function (c) { return c[0].toLowerCase().indexOf(lw) === 0; });
  return m.length === 1 ? { one: m[0] } : m.length ? { many: m } : { none: true };
}
const caret = function (prompt, raw, pos) { return " ".repeat(prompt.length + pos) + "^"; };
function run(S, raw) {
  const line = raw.replace(/\s+$/, ""), tokens = line.trim().split(/\s+/).filter(Boolean);
  if (!tokens.length) return { lines: [] };
  let list = TREE[S.mode], i = 0, pos = line.indexOf(tokens[0]);
  while (i < tokens.length) {
    const r = match(list, tokens[i]);
    if (r.none) return { lines: [caret(promptOf(S), line, pos), "% Invalid input detected at '^' marker."] };
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
  let list = TREE[S.mode], extra = null, from = 0;
  if (/^(config|if|ifrange|line)$/.test(S.mode) && tokens.length && match(list, tokens[0]).one && match(list, tokens[0]).one[0] === "do" && (tokens.length > 1 || endsSpace)) { list = TREE.priv; from = 1; }   /* "do" runs an EXEC command: its help is EXEC's */
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
  const tokens = raw.trim().split(/\s+/); let list = TREE[S.mode];
  for (let i = 0; i < tokens.length - 1; i++) { const r = match(list, tokens[i]); if (!r.one || !Array.isArray(r.one[2])) return raw; list = r.one[2]; }
  const r = match(list, tokens[tokens.length - 1]); if (!r.one) return raw;
  tokens[tokens.length - 1] = r.one[0]; return tokens.join(" ") + " ";
}

/* ------------------------------------------------------------ sessions */
export function promptOf(S) {
  const h = S.sw.hostname;
  return { user: h + ">", priv: h + "#", config: h + "(config)#", if: h + "(config-if)#", ifrange: h + "(config-if-range)#", line: h + "(config-line)#", login: "Password: ", gone: "" }[S.mode] || h + ">";
}
/* a console login: the password prompt only if the console line asks for one */
export function session(sw, o = {}) {
  const S = { sw: sw, mode: "user", history: [], pending: null, via: o.via || "console", reach: o.reach };
  const ln = S.via === "console" ? sw.con : sw.vty;
  if (ln.login === "password" && ln.password) { S.mode = "login"; S.pending = { kind: "login", tries: 0 }; }
  return S;
}
export function banner(S) { return S.mode === "login" ? ["", "User Access Verification", ""] : ["", "Press RETURN to get started.", ""]; }
/* run one line; returns { out: [lines], prompt, secret: true when the next input is a password (not echoed) } */
export function exec(S, raw) {
  raw = String(raw == null ? "" : raw);
  if (S.mode === "gone") { const fresh = session(S.sw, { via: S.via, reach: S.reach }); Object.assign(S, fresh); return { out: S.mode === "login" ? ["", "User Access Verification", ""] : [], prompt: promptOf(S), secret: S.mode === "login" }; }   /* RETURN at "Press RETURN to get started" */
  if (S.pending) return answer(S, raw);
  if (/\?$/.test(raw)) return { out: help(S, raw), prompt: promptOf(S), keep: raw.slice(0, -1) };
  if (raw.trim()) S.history.push(raw.trim());
  /* "| include", "| exclude", "| begin", "| section": filter what a show command prints */
  const pipe = /^(.*?)\s\|\s*(\S+)\s*(.*)$/.exec(raw);
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
  const q = lines.length ? lines[lines.length - 1] : ""; return { out: lines.slice(0, -1), prompt: q, secret: /^(enable|login)$/.test(S.pending.kind) };
}
function answer(S, raw) {
  const p = S.pending, t = raw.trim();
  if (p.kind === "login" || p.kind === "enable") {
    const want = p.kind === "login" ? S.sw[S.via === "console" ? "con" : "vty"].password : (S.sw.enableSecret || S.sw.enablePassword);
    if (raw === want) { S.pending = null; S.mode = p.kind === "login" ? "user" : "priv"; return { out: [], prompt: promptOf(S) }; }
    p.tries++;
    if (p.tries >= 3) { S.pending = null; if (p.kind === "login") { S.mode = "gone"; return { out: ["% Bad passwords", "", "Press RETURN to get started."], prompt: "" }; } return { out: ["% Bad secrets"], prompt: promptOf(S) }; }
    return { out: [], prompt: "Password: ", secret: true };   /* asked again, up to three tries */
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
    reload(S.sw); const fresh = session(S.sw, { via: S.via, reach: S.reach }); Object.assign(S, fresh);
    return { out: ["", "%SYS-5-RELOAD: Reload requested by console. Reload Reason: Reload command.", "", "Loading the system image... [OK]", "", "MSW-2800G Network Operating System, Version 4.2.1", S.sw.startup ? "" : "No startup configuration found: starting with factory settings.", ""].concat(banner(S)), prompt: promptOf(S), secret: S.mode === "login" };
  }
  S.pending = null; return { out: [], prompt: promptOf(S) };
}
