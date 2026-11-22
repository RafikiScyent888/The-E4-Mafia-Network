/* The Linux command line on the campus's rack servers (Level 4, work order 9: jumbo frames for the backup network). Ubuntu Server's
   bash, as far as a technician needs it for the network: logging in on the server's own console (or arriving over SSH), sudo, ip
   (addresses, links, routes, and setting a port's MTU), ping with its size and don't-fragment options, ethtool, the netplan file
   (read it, set a port's MTU in it, apply it), and reboot. What `ip link set ... mtu` changes is gone at the next reboot; what's
   in netplan stays, as on the real thing. Plain functions over the simulation, no page code: tested under Node. */
import { isIp, sameSubnet, maskBits, broadcast, network, lpad, pad, hash } from "./util.js";
import * as D from "./dhcpd.js";

export const LX_HELP = [
  ["ip a  (ip addr, ip -br a)", "this server's ports, their state, MTU and addresses"],
  ["ip link  (ip -s link show eno2)", "its ports, their MTU, and their counters"],
  ["sudo ip link set dev eno2 mtu 9000", "set a port's MTU now (gone at the next reboot)"],
  ["ip route  (ip r)", "its routing table"],
  ["ping -c 4 <address>", "send echo requests (ping runs until stopped if -c isn't given)"],
  ["ping -M do -s <bytes> <address>", "a big ping that must not be cut up: does a frame that size get through?"],
  ["ethtool eno2", "a port's speed, duplex and whether it has a link"],
  ["sudo cat /etc/netplan/50-cloud-init.yaml", "the server's network settings file, as it starts up with"],
  ["sudo netplan get [key]", "read the netplan settings (a key such as ethernets.eno2.mtu)"],
  ["sudo netplan set <key>=<value>", "change one, such as ethernets.eno2.mtu=9000 (in the file only)"],
  ["sudo netplan apply", "put the file's settings into effect now"],
  ["sudo reboot", "restart the server (it comes back with what's in its netplan file)"],
  ["hostname, whoami, uname -a", "who and where you are"],
  ["ls <folder>, cat <file>", "list a folder, show a file"],
  ["sudo nano <file>", "edit a file (Ctrl+O writes it out, Ctrl+X leaves the editor)"],
  ["sudo -i", "a root shell (exit to leave it)"],
  ["clear", "clear the screen"],
  ["exit  (logout)", "log out"]
];
/* on a server with the DHCP server installed (work order 10) */
export const LX_HELP_DHCP = [
  ["sudo nano /etc/dhcp/dhcpd.conf", "the DHCP server's settings: its subnets, ranges, options, reservations"],
  ["sudo nano /etc/default/isc-dhcp-server", "which ports it serves on (INTERFACESv4)"],
  ["dhcpd -t -cf /etc/dhcp/dhcpd.conf", "check the settings file without starting anything"],
  ["sudo systemctl restart isc-dhcp-server", "start it again with the file as it is now (start, stop too)"],
  ["sudo systemctl enable isc-dhcp-server", "start it at every boot (disable to stop that; --now starts it too)"],
  ["systemctl status isc-dhcp-server", "running or not, since when, and its last messages"],
  ["journalctl -u isc-dhcp-server", "everything it has said (-n 20 for the last twenty lines)"],
  ["dhcp-lease-list", "the addresses it has handed out, to whom"]
];
export const NETPLAN_FILE = "/etc/netplan/50-cloud-init.yaml";
const MAX_MTU = 9216, MIN_MTU = 68;

/* a session: on the server's own console it starts at the login prompt; over SSH it's already logged in */
export function lxStart(via, user) { return via === "console" ? { via: via, mode: "login", user: null, tries: 0, root: false, sudoOk: false } : { via: via, mode: "shell", user: user, tries: 0, root: false, sudoOk: false }; }
export function lxPrompt(sim, id, st) {
  const x = sim.d[id], h = x.host;
  if (!st || st.mode === "login") return h + " login: ";
  if (st.mode === "pass") return "Password: ";
  if (st.mode === "sudo") return "[sudo] password for " + st.user + ": ";
  if (st.edit) return "";
  return (st.root ? "root" : st.user) + "@" + h + ":~" + (st.root ? "# " : "$ ");
}
export function lxSecret(st) { return !!st && (st.mode === "pass" || st.mode === "sudo"); }
export function motd(sim, id) {
  const x = sim.d[id], a = sim.ifAddr(id, 0);
  return ["Welcome to Ubuntu 24.04.1 LTS (GNU/Linux 6.8.0-49-generic x86_64)", "", "  System information as of Sun Nov 22 10:42:07 UTC 2026", "", "  System load:  0.08              Processes:             191", "  Usage of /:   23.4% of 438.91GB  Users logged in:       1", "  Memory usage: 9%                IPv4 address for eno1: " + (a ? a.ip : "(none)"), "", "Last login: Fri Nov 20 16:31:12 2026 from " + (x.lastFrom || "10.0.0.1"), ""];
}

/* one line typed to the server: returns { out: [lines], closed, clear, facts } */
export function lxExec(sim, id, st, raw, text) {
  const x = sim.d[id], line = String(raw == null ? "" : raw);
  if (st.edit) return editKey(sim, id, st, line, text);
  if (st.mode === "login") { const u = line.trim(); if (!u) return { out: [] }; st.user = u; st.mode = "pass"; return { out: [], secret: true }; }
  if (st.mode === "pass") {
    if ((x.lx.users || {})[st.user] === line) { st.mode = "shell"; st.tries = 0; st.root = false; st.sudoOk = false; return { out: motd(sim, id), facts: { cmd: "login", dev: id, user: st.user, ok: true } }; }
    st.mode = "login"; return { out: ["", "Login incorrect"], facts: { cmd: "login", dev: id, user: st.user, ok: false } };
  }
  if (st.mode === "sudo") {
    if ((x.lx.users || {})[st.user] === line) { st.mode = "shell"; st.tries = 0; st.sudoOk = true; const p = st.pend; st.pend = null; return run(sim, id, st, p, true); }
    st.tries++;
    if (st.tries >= 3) { st.mode = "shell"; st.tries = 0; st.pend = null; return { out: ["sudo: 3 incorrect password attempts"], facts: { cmd: "sudo", dev: id, ok: false } }; }
    return { out: ["Sorry, try again."], secret: true, facts: { cmd: "sudo", dev: id, ok: false } };
  }
  return run(sim, id, st, line.trim(), st.root);
}

function run(sim, id, st, line, root) {
  const x = sim.d[id], t = line.split(/\s+/).filter(Boolean), c = t[0] || "", args = t.slice(1), facts = { cmd: c, dev: id, linux: true, line: line };
  const done = function (out, more) { return Object.assign({ out: out, facts: Object.assign(facts, (more && more.facts) || {}) }, more || {}); };
  if (!c) return done([]);
  switch (c) {
    case "sudo": {
      if (!args.length) return done(["usage: sudo -h | -K | -k | -V", "usage: sudo [-u user] command"]);
      if (args[0] === "-i" || (args[0] === "su" && args.length === 1) || args[0] === "-s") { if (root || st.sudoOk) { st.root = true; return done([]); } st.mode = "sudo"; st.pend = "__root__"; return done([], { secret: true }); }
      if (root || st.sudoOk) return run(sim, id, st, args.join(" "), true);
      st.mode = "sudo"; st.pend = args.join(" "); return done([], { secret: true });
    }
    case "__root__": if (!root) return done([c + ": command not found"]); st.root = true; return done([]);   /* only ever reached after sudo -i's password */
    case "exit": case "logout": {
      if (st.root && !root) { st.root = false; return done(["logout"]); }
      if (st.root) { st.root = false; return done(["logout"]); }
      if (st.via === "console") { st.mode = "login"; st.user = null; st.sudoOk = false; return done(["logout", "", "Ubuntu 24.04.1 LTS " + x.host + " tty1", ""], { facts: { logout: true } }); }
      return done(["logout"], { closed: true, facts: { logout: true } });
    }
    case "clear": return done([], { clear: true });
    case "help": return done(["Commands you can use on this server:", ""].concat(LX_HELP.concat(x.lx.dhcpd ? LX_HELP_DHCP : []).map(function (h) { return "  " + pad(h[0], 40) + h[1]; })));
    case "hostname": return done([x.host]);
    case "whoami": return done([root ? "root" : st.user]);
    case "uname": return done([args[0] === "-a" ? "Linux " + x.host + " 6.8.0-49-generic #49-Ubuntu SMP PREEMPT_DYNAMIC Mon Nov  4 02:06:24 UTC 2024 x86_64 x86_64 x86_64 GNU/Linux" : "Linux"]);
    case "ip": return done(ipCmd(sim, id, args, root));
    case "ping": return ping(sim, id, args, facts);
    case "ethtool": return done(ethtool(sim, id, args));
    case "cat": return done(cat(sim, id, args, root));
    case "ls": return done(ls(sim, id, args, root));
    case "netplan": return done(netplan(sim, id, args, root), { facts: { netplan: args[0] || "" } });
    case "nano": case "vi": case "vim": case "editor": return nano(sim, id, st, args, root, c, facts);
    case "systemctl": return done(systemctl(sim, id, args, root), { facts: { systemctl: args.filter(function (w) { return w[0] !== "-"; }).join(" ") } });
    case "service": return done(args.length >= 2 ? systemctl(sim, id, [args[1], args[0]], root) : ["Usage: service < option > | --status-all | [ service_name [ command | --full-restart ] ]"]);
    case "journalctl": return done(journalctl(sim, id, args));
    case "dhcpd": return done(dhcpdCmd(sim, id, args));
    case "dhcp-lease-list": return done(leaseList(sim, id));
    case "reboot": case "shutdown": {
      if (c === "shutdown" && !(args[0] === "-r")) return done(["(This server stays on: it's in use. To restart it: sudo reboot)"]);
      if (!root) return done(["Failed to set wall message, ignoring: Interactive authentication required.", "Call to Reboot failed: Interactive authentication required."]);
      reboot(sim, id);
      st.edit = null;
      if (st.via === "console") { st.mode = "login"; st.user = null; st.root = false; st.sudoOk = false; return done(["", "Broadcast message from root@" + x.host + " on pts/1 (Sun 2026-11-22 10:42:07 UTC):", "", "The system will reboot now!", "", "[  OK  ] Stopped target network.target - Network.", "[  OK  ] Reached target reboot.target - System Reboot.", "", "Ubuntu 24.04.1 LTS " + x.host + " tty1", ""], { facts: { reboot: true } }); }
      return done([], { closed: true, closedBy: "remote", facts: { reboot: true } });
    }
    default: return done([c + ": command not found"]);
  }
}

/* ------------------------------------------------------------ the server's ports */
const colon = function (m) { return String(m).replace(/-/g, ":").toLowerCase(); };
function v6(m) { const b = colon(m).split(":").map(function (h) { return parseInt(h, 16); }); b[0] ^= 2; const w = [b[0] << 8 | b[1], b[2] << 8 | 0xff, 0xfe << 8 | b[3], b[4] << 8 | b[5]]; return "fe80::" + w.map(function (n) { return n.toString(16); }).join(":"); }
const ALT = { eno1: "enp1s0f0", eno2: "enp1s0f1" };
function ports(sim, id) {
  const x = sim.d[id];
  return x.ifaces.map(function (f, j) { const c = sim.cableAt(id, f.port), up = sim.on(id) && !!c && sim.cableUp(c); return { f: f, j: j, up: up, mtu: f.mtu || 1500, ip: f.cfg && f.cfg.ip, mask: f.cfg && f.cfg.mask, gw: f.cfg && f.cfg.gw }; });
}
function findPort(sim, id, name) { return ports(sim, id).find(function (p) { return p.f.name === name; }); }
function ipCmd(sim, id, a, root) {
  a = a.slice(); let brief = false, stats = false;
  while (a[0] && a[0][0] === "-") { const o = a.shift(); if (/^-br(ief)?$/.test(o)) brief = true; else if (/^-s(tat(istic)?s?)?$/.test(o)) stats = true; else if (o === "-4" || o === "-c" || o === "-color" || o === "--color") { } else return ['Option "' + o + '" is unknown, try "ip -help".']; }
  const obj = a.shift() || "";
  if (!obj) return ["Usage: ip [ OPTIONS ] OBJECT { COMMAND | help }", "where  OBJECT := { address | link | route | ... }", "       OPTIONS := { -s[tatistics] | -br[ief] | -4 | ... }"];
  if (/^a(d(d(r(e(s(s)?)?)?)?)?)?$/.test(obj)) return ipAddr(sim, id, a, brief, root);
  if (/^l(i(n(k)?)?)?$/.test(obj)) return ipLink(sim, id, a, brief, stats, root);
  if (/^r(o(u(t(e)?)?)?)?$/.test(obj)) return ipRoute(sim, id, a);
  return ['Object "' + obj + '" is unknown, try "ip help".'];
}
/* "show", "show dev eno2", "show eno2", "eno2": the port asked for, or every port */
function devArg(a) { a = a.slice(); if (a[0] && /^(show|list|lst|sh)$/.test(a[0])) a.shift(); if (a[0] === "dev") a.shift(); return a[0] || null; }
function headLine(p, i) { return (i + 2) + ": " + p.f.name + ": <" + (p.up ? "BROADCAST,MULTICAST,UP,LOWER_UP" : "NO-CARRIER,BROADCAST,MULTICAST,UP") + "> mtu " + p.mtu + " qdisc mq state " + (p.up ? "UP" : "DOWN") + " group default qlen 1000"; }
const LO = ["1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN group default qlen 1000", "    link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00"];
function ipAddr(sim, id, a, brief, root) {
  if (a[0] && /^(add|del|delete|change|replace|flush)$/.test(a[0])) return ["(This server's addresses come from its netplan file, and they're right: this work is about its MTU.)"];
  const want = devArg(a), P = ports(sim, id);
  if (want && want !== "lo" && !P.some(function (p) { return p.f.name === want; })) return ['Device "' + want + '" does not exist.'];
  if (brief) return (want ? [] : [pad("lo", 17) + pad("UNKNOWN", 15) + "127.0.0.1/8 ::1/128"]).concat(P.filter(function (p) { return !want || p.f.name === want; }).map(function (p) { return pad(p.f.name, 17) + pad(p.up ? "UP" : "DOWN", 15) + (p.ip ? p.ip + "/" + maskBits(p.mask) + " " : "") + (p.up ? v6(p.f.mac) + "/64" : ""); }));
  const L = want && want !== "lo" ? [] : LO.concat(["    inet 127.0.0.1/8 scope host lo", "       valid_lft forever preferred_lft forever"]);
  P.forEach(function (p, i) {
    if (want && p.f.name !== want) return;
    L.push(headLine(p, i), "    link/ether " + colon(p.f.mac) + " brd ff:ff:ff:ff:ff:ff", "    altname " + ALT[p.f.name]);
    if (p.ip) L.push("    inet " + p.ip + "/" + maskBits(p.mask) + " brd " + broadcast(p.ip, p.mask) + " scope global " + p.f.name, "       valid_lft forever preferred_lft forever");
    if (p.up) L.push("    inet6 " + v6(p.f.mac) + "/64 scope link", "       valid_lft forever preferred_lft forever");
  });
  return L;
}
function ipLink(sim, id, a, brief, stats, root) {
  if (a[0] === "set") return linkSet(sim, id, a.slice(1), root);
  const want = devArg(a), P = ports(sim, id);
  if (want && want !== "lo" && !P.some(function (p) { return p.f.name === want; })) return ['Device "' + want + '" does not exist.'];
  if (brief) return (want ? [] : [pad("lo", 17) + pad("UNKNOWN", 15) + "00:00:00:00:00:00 <LOOPBACK,UP,LOWER_UP>"]).concat(P.filter(function (p) { return !want || p.f.name === want; }).map(function (p) { return pad(p.f.name, 17) + pad(p.up ? "UP" : "DOWN", 15) + colon(p.f.mac) + " <" + (p.up ? "BROADCAST,MULTICAST,UP,LOWER_UP" : "NO-CARRIER,BROADCAST,MULTICAST,UP") + ">"; }));
  const L = want && want !== "lo" ? [] : LO.slice();
  P.forEach(function (p, i) {
    if (want && p.f.name !== want) return;
    L.push(headLine(p, i).replace(" group default", " mode DEFAULT group default"), "    link/ether " + colon(p.f.mac) + " brd ff:ff:ff:ff:ff:ff");
    if (stats) {
      const err = rxErrAt(sim, id, p.f.port), h = hash(id + p.f.name), rb = p.up ? 48211934 + h % 900000 : 0, rp = p.up ? 391812 + h % 9000 : 0;
      L.push("    RX:  bytes packets errors dropped  missed   mcast", "    " + lpad(rb, 10) + lpad(rp, 8) + lpad(err, 7) + lpad(0, 8) + lpad(0, 8) + lpad(p.up ? 1204 : 0, 8), "    TX:  bytes packets errors dropped carrier collsns", "    " + lpad(p.up ? 21774231 + h % 700000 : 0, 10) + lpad(p.up ? 204511 + h % 7000 : 0, 8) + lpad(0, 7) + lpad(0, 8) + lpad(0, 8) + lpad(0, 8));
    }
    L.push("    altname " + ALT[p.f.name]);
  });
  return L;
}
function linkSet(sim, id, a, root) {
  a = a.slice(); if (a[0] === "dev") a.shift();
  const name = a.shift(); if (!name) return ['Not enough information: "dev" argument is required.'];
  const p = findPort(sim, id, name); if (!p) return ['Cannot find device "' + name + '"'];
  if (!a.length) return ['Not enough information: an attribute to set (such as mtu) is required.'];
  const k = a.shift();
  if (k === "mtu") {
    const v = a.shift(); if (!v || !/^\d+$/.test(v)) return ['Error: argument "' + (v || "") + '" is wrong: Invalid MTU'];
    if (!root) return ["RTNETLINK answers: Operation not permitted"];
    if (+v > MAX_MTU) return ["Error: mtu greater than device maximum."];
    if (+v < MIN_MTU) return ["Error: mtu less than device minimum."];
    p.f.mtu = +v; if (sim.bump) sim.bump(); return [];
  }
  if (k === "up" || k === "down") return ["(This server's ports stay up here. To take one down, unplug its cable on the Physical tab.)"];
  return ['Error: either "dev" is duplicate, or "' + k + '" is a garbage.'];
}
function ipRoute(sim, id, a) {
  if (a[0] && /^(add|del|delete|change|replace|flush)$/.test(a[0])) return ["(This server's routes come from its netplan file, and they're right: this work is about its MTU.)"];
  const P = ports(sim, id), L = [], gw = P.find(function (p) { return p.gw; });
  if (gw) L.push("default via " + gw.gw + " dev " + gw.f.name + " proto static" + (gw.up ? "" : " linkdown"));
  P.forEach(function (p) { if (p.ip) L.push(network(p.ip, p.mask) + "/" + maskBits(p.mask) + " dev " + p.f.name + " proto kernel scope link src " + p.ip + (p.up ? "" : " linkdown")); });
  return L;
}
function rxErrAt(sim, id, port) { const e = sim.net.extra && sim.net.extra.rxerr; return (e && e[id + "|" + port]) || 0; }
function rxErr(sim, id, port, k) { const e = sim.net.extra || (sim.net.extra = {}), g = e.rxerr || (e.rxerr = {}), key = id + "|" + port; g[key] = (g[key] || 0) + k; }
function ethtool(sim, id, a) {
  if (!a[0]) return ["ethtool: bad command line argument(s)", "For more information run ethtool -h"];
  const p = findPort(sim, id, a[a.length - 1]); if (!p) return ["netlink error: no device matches name (offset 24)", "netlink error: No such device"];
  const c = sim.cableAt(id, p.f.port), sp = p.up && c ? sim.speed(c) : 0;
  return ["Settings for " + p.f.name + ":", "\tSupported ports: [ TP ]", "\tSupported link modes:   10baseT/Half 10baseT/Full", "\t                        100baseT/Half 100baseT/Full", "\t                        1000baseT/Full", "\tSpeed: " + (p.up ? (sp || 1000) + "Mb/s" : "Unknown!"), "\tDuplex: " + (p.up ? "Full" : "Unknown! (255)"), "\tAuto-negotiation: on", "\tPort: Twisted Pair", "\tMDI-X: " + (p.up ? "off (auto)" : "Unknown (auto)"), "\tLink detected: " + (p.up ? "yes" : "no")];
}

/* ------------------------------------------------------------ files and netplan */
export function netplanText(x) {
  const N = x.lx.netplan, L = ["network:", "  version: 2", "  ethernets:"];
  Object.keys(N).forEach(function (n) {
    const e = N[n]; L.push("    " + n + ":", "      addresses:", "      - \"" + e.addr + "\"");
    if (e.mtu) L.push("      mtu: " + e.mtu);
    if (e.gw) L.push("      routes:", "      - to: \"default\"", "        via: \"" + e.gw + "\"");
    if (e.dns && e.dns.length) { L.push("      nameservers:", "        addresses:"); e.dns.forEach(function (d) { L.push("        - " + d); }); }
  });
  return L;
}
function cat(sim, id, a, root) {
  const x = sim.d[id]; if (!a.length) return ["(cat waits for typing here on a real server; name a file: cat /etc/hostname)"];
  return a.reduce(function (out, f) {
    if (f === NETPLAN_FILE) return out.concat(root ? netplanText(x) : ["cat: " + f + ": Permission denied"]);
    if (f === "/etc/hostname") return out.concat([x.host]);
    const t = fileText(sim, id, f); if (t != null) return out.concat(t.replace(/\n$/, "").split("\n"));
    if (x.lx.dhcpd && /^\/etc\/(dhcp|default)\/?$/.test(f)) return out.concat(["cat: " + f + ": Is a directory"]);
    if (f === "/etc/os-release") return out.concat(['PRETTY_NAME="Ubuntu 24.04.1 LTS"', 'NAME="Ubuntu"', 'VERSION_ID="24.04"', 'VERSION="24.04.1 LTS (Noble Numbat)"']);
    return out.concat(["cat: " + f + ": No such file or directory"]);
  }, []);
}
function ls(sim, id, a, root) {
  const long = a.some(function (w) { return /^-[a-zA-Z]*l/.test(w); }), dir = a.filter(function (w) { return w[0] !== "-"; })[0] || "~";
  if (dir === "/etc/netplan" || dir === "/etc/netplan/") return long ? ["total 4", "-rw------- 1 root root " + netplanText(sim.d[id]).join("\n").length + " Nov 20 16:20 50-cloud-init.yaml"] : ["50-cloud-init.yaml"];
  const D0 = sim.d[id].lx.dhcpd;
  if (D0 && (dir === "/etc/dhcp" || dir === "/etc/dhcp/")) return long ? ["total 12", "drwxr-xr-x 2 root root 4096 Nov 20 16:24 ddns-keys", "-rw-r--r-- 1 root root " + fileText(sim, id, D.CONF).length + " " + stamp(sim, id, D.CONF) + " dhcpd.conf", "-rw-r--r-- 1 root root 1735 Nov 20 16:24 dhcpd6.conf"] : ["ddns-keys  dhcpd.conf  dhcpd6.conf"];
  if (D0 && (dir === D.CONF || dir === D.DEFAULTS)) return [long ? "-rw-r--r-- 1 root root " + fileText(sim, id, dir).length + " " + stamp(sim, id, dir) + " " + dir : dir];
  if (dir === "~" || dir === "." || dir === "/home/" + (sim.d[id].lx && Object.keys(sim.d[id].lx.users)[0])) return [];
  if (dir === NETPLAN_FILE) return [long ? "-rw------- 1 root root " + netplanText(sim.d[id]).join("\n").length + " Nov 20 16:20 " + NETPLAN_FILE : NETPLAN_FILE];
  return ["ls: cannot access '" + dir + "': No such file or directory"];
}
const NP_USAGE = ["usage: netplan [-h] [--debug] {apply,get,set} ...", "", "Network configuration in YAML", "", "options:", "  -h, --help  show this help message and exit", "  --debug     Enable debug messages", "", "Available commands:", "    apply     Apply current netplan config to running system", "    get       Get a setting by specifying a nested key like \"ethernets.eth0.addresses\", or \"all\"", "    set       Add new setting by specifying a dotted key=value pair like ethernets.eth0.dhcp4=true"];
function netplan(sim, id, a, root) {
  const x = sim.d[id], N = x.lx.netplan, sub = a[0];
  if (!sub || sub === "-h" || sub === "--help" || sub === "help") return NP_USAGE;
  if (!/^(get|set|apply)$/.test(sub)) return NP_USAGE.slice(0, 1).concat(["netplan: error: argument : invalid choice: '" + sub + "' (choose from 'apply', 'get', 'set')"]);
  if (!root) return ["PermissionError: [Errno 13] Permission denied: '" + NETPLAN_FILE + "'"];
  if (sub === "apply") { applyNetplan(sim, id); return []; }
  if (sub === "get") {
    const key = a[1]; if (!key || key === "all") return netplanText(x);
    const k = key.split("."); if (k[0] === "network") k.shift();
    if (k[0] === "ethernets" && k.length === 1) return Object.keys(N).map(function (n) { return n + ":"; });
    if (k[0] !== "ethernets" || !N[k[1]]) return ["null"];
    if (k.length === 2) return netplanText({ lx: { netplan: { [k[1]]: N[k[1]] } } }).slice(4).map(function (l) { return l.slice(6); });
    if (k[2] === "mtu" && k.length === 3) return [N[k[1]].mtu ? String(N[k[1]].mtu) : "null"];
    if (k[2] === "addresses" && k.length === 3) return ["- \"" + N[k[1]].addr + "\""];
    return ["null"];
  }
  /* set: ethernets.<port>.mtu=<n> (or null to take it out) */
  const m = /^(?:network\.)?([^=]+)=(.*)$/.exec(a.slice(1).join(" "));
  if (!m) return ["netplan: error: the following arguments are required: key_value"];
  const k = m[1].split("."), v = m[2].trim();
  if (k[0] !== "ethernets" || k.length !== 3) return ["(This server's netplan takes ethernets.<port>.mtu here: its addresses and routes are set already.)"];
  if (!N[k[1]]) return ["Error in network definition: " + NETPLAN_FILE + ": unknown interface '" + k[1] + "' (this server's ports are " + Object.keys(N).join(" and ") + ")"];
  if (k[2] !== "mtu") return /^(addresses|routes|nameservers|dhcp4|dhcp6|gateway4)$/.test(k[2]) ? ["(This server's netplan takes ethernets.<port>.mtu here: its addresses and routes are set already.)"] : ["Error in network definition: unknown key '" + k[2] + "'"];
  if (v === "null" || v === "") { delete N[k[1]].mtu; return []; }
  if (!/^\d+$/.test(v)) return ["Error in network definition: " + NETPLAN_FILE + ": invalid unsigned int value '" + v + "'"];
  N[k[1]].mtu = +v; return [];
}
/* the file's settings put into effect: each port's MTU (1500 if the file has none); a device's maximum refuses more, as networkd does */
export function applyNetplan(sim, id) {
  const x = sim.d[id], N = x.lx.netplan;
  x.ifaces.forEach(function (f) { const e = N[f.name]; const want = e && e.mtu ? e.mtu : 1500; f.mtu = Math.max(MIN_MTU, Math.min(MAX_MTU, want)); });
  if (sim.bump) sim.bump();
}
/* a restart: it comes back with what's in its netplan file (an MTU set only with ip link is gone) */
export function reboot(sim, id) {
  applyNetplan(sim, id); const x = sim.d[id]; x.boots = (x.boots || 0) + 1;
  const S = x.lx.dhcpd; if (S) { if (S.state === "active") dhcpdStop(sim, id); if (S.enabled) dhcpdStart(sim, id); }   /* a service enabled starts at boot; one that isn't stays off */
}

/* ------------------------------------------------------------ ping, Linux's */
function ping(sim, id, a, facts) {
  let n = 0, size = 56, hint = "want", target = null, ifn = null;
  for (let i = 0; i < a.length; i++) {
    const w = a[i];
    if (w === "-c") { n = parseInt(a[++i], 10); if (!(n > 0)) return { out: ["ping: invalid argument: '" + (a[i] || "") + "'"], facts: facts }; }
    else if (w === "-s") { size = parseInt(a[++i], 10); if (!(size >= 0) || size > 65507) return { out: ["ping: invalid argument: '" + (a[i] || "") + "': out of range: 0 <= value <= 65507"], facts: facts }; }
    else if (w === "-M") { hint = a[++i]; if (!/^(do|want|dont|probe)$/.test(hint || "")) return { out: ["ping: invalid -M argument: " + (hint || "")], facts: facts }; }
    else if (w === "-I") ifn = a[++i];
    else if (/^-[iWwq4]$/.test(w)) { if (/^-[iWw]$/.test(w)) i++; }
    else if (w[0] === "-") return { out: ["ping: invalid option -- '" + w.replace(/^-+/, "")[0] + "'", "", "Usage", "  ping [options] <destination>"], facts: facts };
    else target = w;
  }
  if (!target) return { out: ["ping: usage error: Destination address required"], facts: facts };
  const stop = !n; if (stop) n = 4;   /* without -c ping runs until stopped: here it's stopped after four, as you would with Ctrl+C */
  let ip = target;
  if (!isIp(target)) { const ok = sim.lookup && sim.lookup(target); if (!ok) return { out: ["ping: " + target + ": Temporary failure in name resolution"], facts: Object.assign(facts, { target: target, ok: false, why: "name" }) }; ip = ok; }
  const df = hint === "do", total = size + 28, j = sim.ifFor(id, ip), me = sim.ifAddr(id, j);
  Object.assign(facts, { target: target, ip: ip, size: size, df: df, total: total });
  if (ifn && !sim.d[id].ifaces.some(function (f) { return f.name === ifn; })) return { out: ["ping: SO_BINDTODEVICE " + ifn + ": No such device"], facts: facts };
  const r = sim.sized(id, ip, total, df), rt = r.rt || {};
  if (r.why === "route" && (rt.fail === "no-link" || rt.fail === "no-route")) return { out: ["ping: connect: Network is unreachable"], facts: Object.assign(facts, { ok: false, why: "unreachable", sent: 0, replies: 0 }) };
  const L = ["PING " + ip + " (" + ip + ") " + size + "(" + total + ") bytes of data."], R = sim.r("lxping" + ip + ":" + size), times = [];
  let got = 0, errs = 0; const who = r.who || (rt.owner && rt.owner[0]), wx = who && sim.d[who];
  const fw = !!wx && (wx.kind === "pc" || wx.kind === "laptop") && !wx.echo;   /* Windows' firewall drops ping, as on any network */
  for (let i = 1; i <= n; i++) {
    if (r.why === "local") { L.push("ping: local error: message too long, mtu=" + r.mtu); errs++; continue; }
    if (r.why === "frag") { L.push("From " + (r.gw || "") + " icmp_seq=" + i + " Frag needed and DF set (mtu = 1500)"); errs++; continue; }
    if (r.why === "route") {
      if (rt.fail === "host-unreachable" || rt.fail === "gateway-unreachable") { L.push("From " + (me ? me.ip : "") + " icmp_seq=" + i + " Destination Host Unreachable"); errs++; }
      else if (rt.fail === "net-unreachable") { L.push("From " + (rt.hops && rt.hops[0]) + " icmp_seq=" + i + " Destination Net Unreachable"); errs++; }
      continue;
    }
    if (!r.ok || fw) continue;   /* dropped on the way (a giant at a switch, or too big for the receiver) or never answered: nothing comes back */
    const t = (rt.local ? 0.3 : 0.9) + R() * 0.25 + (total > 1500 ? 0.4 : 0);
    times.push(t); got++;
    L.push((size + 8) + " bytes from " + ip + ": icmp_seq=" + i + " ttl=" + ((wx ? sim.ttlOf(who) : 64) - (rt.routers || 0)) + " time=" + t.toFixed(3) + " ms");
  }
  if (r.why === "giant" && r.at && r.at.port) sim.giant(r.at, n);   /* every one of them dropped at that switch port, and counted there */
  if (r.why === "receiver" && who) { const wf = sim.d[who].ifaces && sim.d[who].ifaces.find(function (f) { return f.cfg && f.cfg.ip === ip; }); if (wf) rxErr(sim, who, wf.port, n); }
  if (stop) L.push("^C");
  L.push("--- " + ip + " ping statistics ---", n + " packets transmitted, " + got + " received, " + (errs ? "+" + errs + " errors, " : "") + Math.round((n - got) / n * 100) + "% packet loss, time " + (n - 1) * 1001 + "ms");
  if (times.length) { const mn = Math.min.apply(null, times), mx = Math.max.apply(null, times), av = times.reduce(function (s, v) { return s + v; }, 0) / times.length, md = Math.sqrt(times.reduce(function (s, v) { return s + (v - av) * (v - av); }, 0) / times.length); L.push("rtt min/avg/max/mdev = " + [mn, av, mx, md].map(function (v) { return v.toFixed(3); }).join("/") + " ms"); }
  Object.assign(facts, { sent: n, replies: got, ok: got > 0, why: r.ok ? (fw ? "firewall" : "ok") : r.why, at: r.at || null, beyond: got > 0 && who !== id, local: !!rt.local });
  return { out: L, facts: facts };
}

/* ------------------------------------------------------------ files, the editor (work order 10) */
/* a file the server holds as text: the DHCP server's two files, the leases file it writes, anything written with the editor */
function fileText(sim, id, path) {
  const x = sim.d[id], F = x.lx.files || {};
  if (path === D.LEASES && x.lx.dhcpd) return leasesText(sim, id);
  return F[path] ? F[path].text : null;
}
function stamp(sim, id, path) { const F = sim.d[id].lx.files || {}; return F[path] && F[path].at ? F[path].at : "Nov 20 16:24"; }
const nLines = function (t) { const L = String(t).split("\n"); if (L.length && L[L.length - 1] === "") L.pop(); return L.length; };
/* the clock in the server's logs: Sunday morning, moving on a few seconds with everything done */
function clock(sim) { const s = 10 * 3600 + 42 * 60 + 7 + (sim.n || 0) * 3, two = function (v) { return (v < 10 ? "0" : "") + v; }; return { day: "Nov 22", hms: two(Math.floor(s / 3600) % 24) + ":" + two(Math.floor(s / 60) % 60) + ":" + two(s % 60), s: s }; }
export function editState(st) {
  const E = st && st.edit; if (!E) return null;
  return { path: E.path, text: E.text, ro: !E.root, isNew: !!E.isNew, status: E.status || "" };
}
function nano(sim, id, st, args, root, c, facts) {
  if (c === "vi" || c === "vim") return { out: ["(The editor on this console is nano: sudo nano <file>. Ctrl+O writes the file out, Ctrl+X leaves.)"], facts: facts };
  const path = args.filter(function (w) { return w[0] !== "-" && w[0] !== "+"; }).pop();
  if (!path) return { out: ["(Name the file to edit: sudo nano /etc/dhcp/dhcpd.conf)"], facts: facts };
  if (path === NETPLAN_FILE) return { out: ["(This server's netplan file is changed with sudo netplan set here: sudo netplan set ethernets.eno2.mtu=9000.)"], facts: facts };
  if (/^\/etc\/(dhcp|default|netplan)\/?$/.test(path) || /\/$/.test(path)) return { out: ["(" + path + " is a folder: name a file in it, such as /etc/dhcp/dhcpd.conf)"], facts: facts };
  if (path === D.LEASES) return { out: ["(" + D.LEASES + " is written by the DHCP server itself: read it with cat, or dhcp-lease-list)"], facts: facts };
  const t = fileText(sim, id, path), isNew = t == null;
  st.edit = { path: path, root: !!root, text: isNew ? "" : t, isNew: isNew };
  st.edit.status = isNew ? "[ New File ]" : !root && /^\/etc\//.test(path) ? "[ File '" + path + "' is unwritable ]" : "[ Read " + nLines(t) + " lines ]";
  if (!root && !/^\/etc\//.test(path)) st.edit.root = true;   /* a file of your own, in your home folder */
  return { out: [], edit: editState(st), facts: Object.assign(facts, { nano: path, ro: !st.edit.root }) };
}
/* the editor's keys: ^O writes the text out (as root, or it's refused), ^X leaves; anything else is typing, which stays in the editor */
function editKey(sim, id, st, line, text) {
  const E = st.edit, facts = { cmd: "nano", dev: id, linux: true, path: E.path };
  if (line === "^O") {
    if (text == null) return { out: [], edit: editState(st), facts: facts };
    if (!E.root) { E.status = "[ Error writing " + E.path + ": Permission denied ]"; return { out: [], edit: editState(st), facts: Object.assign(facts, { write: E.path, ok: false }) }; }
    const x = sim.d[id], F = x.lx.files || (x.lx.files = {}), k = clock(sim);
    F[E.path] = { text: String(text), at: k.day + " " + k.hms.slice(0, 5) }; E.text = String(text); E.isNew = false;
    E.status = "[ Wrote " + nLines(text) + " line" + (nLines(text) === 1 ? "" : "s") + " ]";
    if (sim.bump) sim.bump();
    return { out: [], edit: editState(st), facts: Object.assign(facts, { write: E.path, ok: true }) };
  }
  if (line === "^X") { st.edit = null; return { out: [], facts: Object.assign(facts, { nanoExit: true }) }; }
  return { out: [], edit: editState(st), facts: facts };
}

/* ------------------------------------------------------------ the DHCP server's service */
const UNIT_FILE = "/usr/lib/systemd/system/isc-dhcp-server.service";
function journal(sim, id, who, lines) { const x = sim.d[id], J = x.lx.dhcpd.journal, k = clock(sim); lines.forEach(function (l) { J.push(k.day + " " + k.hms + " " + x.host + " " + who + ": " + l); }); if (J.length > 400) J.splice(0, J.length - 400); }
function ifacesOf(sim, id) { return sim.d[id].ifaces.map(function (f) { return { name: f.name, ip: f.cfg && f.cfg.ip, mask: f.cfg && f.cfg.mask, mac: f.mac }; }); }
/* start dhcpd as systemd does: Started at once (it runs in the foreground), then whatever dhcpd says, and if it exits, the failure */
export function dhcpdStart(sim, id) {
  const x = sim.d[id], S = x.lx.dhcpd, F = x.lx.files || {};
  S.pid = (S.pid || 2190) + 7 + (hash(id + S.pid) % 5);
  const r = D.start((F[D.CONF] || {}).text || "", (F[D.DEFAULTS] || {}).text || "", ifacesOf(sim, id)), k = clock(sim);
  journal(sim, id, "systemd[1]", ["Started isc-dhcp-server.service - ISC DHCP IPv4 server."]);
  journal(sim, id, "dhcpd[" + S.pid + "]", r.log);
  if (r.ok) { S.state = "active"; S.run = { conf: r.conf, listen: r.listen, file: (F[D.CONF] || {}).text || "", defaults: (F[D.DEFAULTS] || {}).text || "" }; }
  else { S.state = "failed"; S.run = null; journal(sim, id, "systemd[1]", ["isc-dhcp-server.service: Main process exited, code=exited, status=1/FAILURE", "isc-dhcp-server.service: Failed with result 'exit-code'."]); }
  S.since = k; S.why = r.why || null;
  changed(sim); return r;
}
function dhcpdStop(sim, id) {
  const S = sim.d[id].lx.dhcpd;
  if (S.state === "active") { journal(sim, id, "systemd[1]", ["Stopping isc-dhcp-server.service - ISC DHCP IPv4 server..."]); journal(sim, id, "dhcpd[" + S.pid + "]", ["Received signal 15, initiating shutdown."]); journal(sim, id, "systemd[1]", ["isc-dhcp-server.service: Deactivated successfully.", "Stopped isc-dhcp-server.service - ISC DHCP IPv4 server."]); S.state = "inactive"; S.since = clock(sim); }
  S.run = null; changed(sim);
}
function changed(sim) { if (sim.leaseChanged) sim.leaseChanged(); if (sim.bump) sim.bump(); }
function ago(sim, k) { const d = Math.max(1, clock(sim).s - (k ? k.s : 0)); return d >= 86400 ? Math.floor(d / 86400) + " day" + (d >= 172800 ? "s" : "") + " " + Math.floor(d % 86400 / 3600) + "h ago" : d >= 3600 ? Math.floor(d / 3600) + "h " + Math.floor(d % 3600 / 60) + "min ago" : d < 60 ? d + "s ago" : Math.floor(d / 60) + "min " + (d % 60) + "s ago"; }
function systemctl(sim, id, a, root) {
  const x = sim.d[id], S = x.lx.dhcpd, opts = a.filter(function (w) { return w[0] === "-"; }), w = a.filter(function (q) { return q[0] !== "-"; }), verb = w[0] || "", unit0 = w[1] || "", unit = unit0.replace(/\.service$/, "");
  if (!verb) return ["(systemctl lists every service on a real server; here: systemctl status isc-dhcp-server)"];
  if (verb === "daemon-reload") return root ? [] : ["Failed to reload daemon: Interactive authentication required."];
  if (!/^(status|start|stop|restart|enable|disable|is-active|is-enabled|is-failed|reload|try-restart|reload-or-restart)$/.test(verb)) return ["Unknown command verb '" + verb + "'."];
  if (!unit) return verb === "status" ? ["(systemctl status lists every service on a real server; name one: systemctl status isc-dhcp-server)"] : ["Too few arguments."];
  if (unit !== D.UNIT || !S) return verb === "status" ? ["Unit " + unit + ".service could not be found."] : /^is-/.test(verb) ? [verb === "is-enabled" ? "Failed to get unit file state for " + unit + ".service: No such file or directory" : "inactive"] : ["Failed to " + verb + " " + unit + ".service: Unit " + unit + ".service not found."];
  const now = opts.indexOf("--now") >= 0;
  if (verb === "status") return status(sim, id);
  if (verb === "is-active") return [S.state];
  if (verb === "is-failed") return [S.state === "failed" ? "failed" : S.state];
  if (verb === "is-enabled") return [S.enabled ? "enabled" : "disabled"];
  if (!root) return ["Failed to " + verb + " " + unit + ".service: Interactive authentication required.", "See system logs and 'systemctl status " + unit + ".service' for details."];
  if (verb === "reload") return ["Failed to reload " + unit + ".service: Job type reload is not applicable for unit " + unit + ".service."];
  if (verb === "start") { if (S.state !== "active") dhcpdStart(sim, id); return []; }
  if (verb === "stop") { dhcpdStop(sim, id); return []; }
  if (verb === "restart" || verb === "reload-or-restart" || (verb === "try-restart" && S.state === "active")) { dhcpdStop(sim, id); dhcpdStart(sim, id); return []; }
  if (verb === "try-restart") return [];
  const sync = ["Synchronizing state of " + unit + ".service with SysV service script with /usr/lib/systemd/systemd-sysv-install.", "Executing: /usr/lib/systemd/systemd-sysv-install " + verb + " " + unit];
  if (verb === "enable") { const out = sync.concat(S.enabled ? [] : ["Created symlink /etc/systemd/system/multi-user.target.wants/" + unit + ".service → " + UNIT_FILE + "."]); S.enabled = true; if (now && S.state !== "active") dhcpdStart(sim, id); changed(sim); return out; }
  const out = sync.concat(S.enabled ? ["Removed \"/etc/systemd/system/multi-user.target.wants/" + unit + ".service\"."] : []); S.enabled = false; if (now) dhcpdStop(sim, id); changed(sim); return out;
}
function status(sim, id) {
  const x = sim.d[id], S = x.lx.dhcpd, up = S.state === "active", failed = S.state === "failed", k = S.since;
  const when = k ? "since " + (k.day === "Nov 20" ? "Fri 2026-11-20 " : "Sun 2026-11-22 ") + k.hms + " UTC; " + ago(sim, k) : "";
  const L = [(failed ? "× " : up ? "● " : "○ ") + "isc-dhcp-server.service - ISC DHCP IPv4 server", "     Loaded: loaded (" + UNIT_FILE + "; " + (S.enabled ? "enabled" : "disabled") + "; preset: enabled)",
    "     Active: " + (up ? "active (running) " + when : failed ? "failed (Result: exit-code) " + when : "inactive (dead)" + (k ? " " + when : "")), "       Docs: man:dhcpd(8)"];
  if (up) L.push("   Main PID: " + S.pid + " (dhcpd)", "      Tasks: 1 (limit: 38149)", "     Memory: 4.6M (peak: 4.9M)", "        CPU: 14ms", "     CGroup: /system.slice/isc-dhcp-server.service", "             └─" + S.pid + " dhcpd -user dhcpd -group dhcpd -f -4 -pf /run/dhcp-server/dhcpd.pid -cf " + D.CONF + (S.run.listen.length ? " " + D.interfacesOf((x.lx.files[D.DEFAULTS] || {}).text).join(" ") : ""));
  if (failed) L.push("    Process: " + S.pid + " ExecStart=/bin/sh -ec CONFIG_FILE=/etc/dhcp/dhcpd.conf; [ -e \"$CONFIG_FILE\" ]; exec dhcpd -user dhcpd -group dhcpd -f -4 -pf /run/dhcp-server/dhcpd.pid -cf $CONFIG_FILE $INTERFACESv4 (code=exited, status=1/FAILURE)", "   Main PID: " + S.pid + " (code=exited, status=1/FAILURE)", "        CPU: 11ms");
  const J = S.journal.slice(-10); return J.length ? L.concat([""], J) : L;
}
function journalctl(sim, id, a) {
  const x = sim.d[id], S = x.lx.dhcpd; let unit = null, n = 0;
  for (let i = 0; i < a.length; i++) {
    const w = a[i];
    if (w === "-u" || w === "--unit") unit = a[++i];
    else if (/^--unit=/.test(w)) unit = w.slice(7);
    else if (/^-[a-z]*u$/.test(w)) unit = a[++i];
    else if (/^-[a-z]*u./.test(w)) unit = w.slice(w.indexOf("u") + 1);
    else if (w === "-n" || w === "--lines") n = parseInt(a[++i], 10) || 10;
    else if (/^-n\d+$/.test(w)) n = +w.slice(2);
  }
  if (unit) unit = unit.replace(/\.service$/, "");
  if (!S || (unit && unit !== D.UNIT)) return ["-- No entries --"];
  const J = S.journal; return J.length ? (n ? J.slice(-n) : J.slice(-200)) : ["-- No entries --"];
}
function dhcpdCmd(sim, id, a) {
  const x = sim.d[id]; if (!x.lx.dhcpd) return ["dhcpd: command not found"];
  if (a.indexOf("-t") < 0 && a.indexOf("-T") < 0) return ["(The DHCP server runs as a service here: sudo systemctl start isc-dhcp-server. To check the file: dhcpd -t -cf " + D.CONF + ")"];
  const i = a.indexOf("-cf"), path = i >= 0 ? a[i + 1] : D.CONF, t = fileText(sim, id, path || "");
  if (t == null) return D.BANNER.concat(["Can't open " + (path || "") + ": No such file or directory", "", "exiting."]);
  return D.test(t, path).out;
}
/* the leases file and dhcp-lease-list: what the running server has handed out */
const two = function (v) { return (v < 10 ? "0" : "") + v; };
function when(s) { const d = Math.floor(s / 86400), r = s % 86400; return "2026/11/" + two(22 + d) + " " + two(Math.floor(r / 3600)) + ":" + two(Math.floor(r / 60) % 60) + ":" + two(r % 60); }
function leasesText(sim, id) {
  const S = sim.d[id].lx.dhcpd, L = ["# The format of this file is documented in the dhcpd.leases(5) manual page.", "# This lease file was written by isc-dhcp-4.4.3-P1", "", "# authoring-byte-order entry is generated, DO NOT DELETE", "authoring-byte-order little-endian;", ""];
  (S.leases || []).forEach(function (l) { L.push("lease " + l.ip + " {", "  starts 0 " + when(l.start) + ";", "  ends " + (l.end >= 86400 * 2 ? 1 : 0) + " " + when(l.end) + ";", "  cltt 0 " + when(l.start) + ";", "  binding state " + (l.released ? "free" : "active") + ";", "  next binding state free;", "  rewind binding state free;", "  hardware ethernet " + D.macNorm(l.mac) + ";", "  client-hostname \"" + l.host + "\";", "}"); });
  return L.join("\n") + "\n";
}
function leaseList(sim, id) {
  const S = sim.d[id].lx.dhcpd; if (!S) return ["dhcp-lease-list: command not found"];
  const act = (S.leases || []).filter(function (l) { return !l.released; });
  return ["To get manufacturer names please download http://standards.ieee.org/regauth/oui/oui.txt to /usr/local/etc/oui.txt", "Reading leases from " + D.LEASES, "MAC                IP              hostname       valid until         manufacturer        ", "==============================================================================================="].concat(act.map(function (l) { return pad(D.macNorm(l.mac), 19) + pad(l.ip, 16) + pad(l.host.slice(0, 14), 15) + when(l.end).replace(/\//g, "-") + " -NA-"; }));
}
/* a relay's request reaching the server: it's heard only by a running dhcpd listening on the port that holds the address relayed to */
export function dhcpdHears(sim, id, helper) {
  const x = sim.d[id], S = x && x.lx && x.lx.dhcpd; if (!S || S.state !== "active" || !S.run || !sim.on(id)) return false;
  const f = x.ifaces.find(function (g) { return g.cfg && g.cfg.ip === helper; }); return !!f && S.run.listen.indexOf(f.name) >= 0;
}
export function dhcpdPick(sim, id, giaddr, mac, inUse) { const S = sim.d[id].lx.dhcpd; return D.pick(S.run.conf, giaddr, mac, (S.leases || []).filter(function (l) { return !l.released; }), inUse); }
/* the exchange in the server's log, and the lease it records: what the client is given (its mask, default router, DNS servers, lease time) */
export function dhcpdLease(sim, id, giaddr, client, o) {
  const x = sim.d[id], S = x.lx.dhcpd, m = D.macNorm(client.mac), h = client.host, srvIp = sim.ifAddr(id, 0).ip, k = clock(sim);
  (o.abandoned || []).forEach(function (ip) { journal(sim, id, "dhcpd[" + S.pid + "]", ["Abandoning IP address " + ip + ": pinged before offer"]); });
  journal(sim, id, "dhcpd[" + S.pid + "]", ["DHCPDISCOVER from " + m + " via " + giaddr, "DHCPOFFER on " + o.ip + " to " + m + " (" + h + ") via " + giaddr, "DHCPREQUEST for " + o.ip + " (" + srvIp + ") from " + m + " (" + h + ") via " + giaddr, "DHCPACK on " + o.ip + " to " + m + " (" + h + ") via " + giaddr]);
  const op = D.leaseOpts(S.run.conf, o.sub, o.host);
  S.leases = (S.leases || []).filter(function (l) { return D.macNorm(l.mac) !== m && l.ip !== o.ip; });
  S.leases.push({ ip: o.ip, mac: m, host: h, start: k.s, end: k.s + op.secs, via: giaddr });
  return { ip: o.ip, mask: op.mask, gw: op.routers[0] || null, dns: op.dns, server: srvIp, hours: op.secs / 3600, domain: op.domain };
}
export function dhcpdRefused(sim, id, giaddr, mac, o) {
  const S = sim.d[id].lx.dhcpd, m = D.macNorm(mac);
  journal(sim, id, "dhcpd[" + S.pid + "]", (o.abandoned || []).map(function (ip) { return "Abandoning IP address " + ip + ": pinged before offer"; }).concat(["DHCPDISCOVER from " + m + " via " + giaddr + ": " + (o.why === "segment" ? "unknown network segment" : "network " + o.sub.net + "/" + maskBits(o.sub.mask) + ": no free leases")]));
}
export function dhcpdRelease(sim, id, mac) {
  const S = sim.d[id].lx.dhcpd, m = D.macNorm(mac), l = (S.leases || []).find(function (q) { return D.macNorm(q.mac) === m && !q.released; }); if (!l) return;
  l.released = true; if (S.pid) journal(sim, id, "dhcpd[" + S.pid + "]", ["DHCPRELEASE of " + l.ip + " from " + m + " (" + l.host + ") via " + l.via + " (found)"]);
}
