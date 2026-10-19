/* The Windows Command Prompt on the PCs and laptops. Output follows real
   Windows formatting, worked out from the simulation, never canned.
   exec() records the command as an action first, so a saved ticket replays
   exactly (renew and release change state; pings draw from the same random
   source on replay). */
import { isIp, isApipa, isLoopback, sameSubnet, hash, pad, lpad } from "./util.js";
import * as SW from "./swcli.js";
import { SFP_MODULES, swPort } from "./sim.js";

const STATIC_ARP = [["224.0.0.22", "01-00-5e-00-00-16"], ["224.0.0.251", "01-00-5e-00-00-fb"], ["239.255.255.250", "01-00-5e-7f-ff-fa"], ["255.255.255.255", "ff-ff-ff-ff-ff-ff"]];

export const HELP = [
  ["ipconfig", "show this computer's addresses (ipconfig /all for everything)"],
  ["ipconfig /release", "give the address back to the DHCP server"],
  ["ipconfig /renew", "ask the DHCP server for an address again"],
  ["ipconfig /flushdns", "empty the computer's cache of looked-up names"],
  ["ping <address or name>", "test whether something answers (-n 10 for ten tries, -t to keep going)"],
  ["tracert <address or name>", "list the routers a packet passes through"],
  ["nslookup <name> [server]", "ask a DNS server for a name's address"],
  ["arp -a", "show the hardware addresses this computer has heard"],
  ["netsh wlan show interfaces", "Wi-Fi: the network, signal, band and channel (Wi-Fi only)"],
  ["netsh wlan show networks mode=bssid", "Wi-Fi: every network this computer can hear (Wi-Fi only)"],
  ["netsh wlan show drivers", "Wi-Fi: what this computer's Wi-Fi adapter supports (Wi-Fi only)"],
  ["getmac", "show this computer's hardware address"],
  ["hostname", "show this computer's name"],
  ["ssh <user>@<address>", "log in to a switch's command line over the network (SSH, encrypted)"],
  ["ssh-keygen -R <address>", "forget a host's remembered SSH key (its line in known_hosts)"],
  ["telnet <address>", "log in to a switch's command line with Telnet (not encrypted)"],
  ["dir <folder>", "list the files in a folder (your laptop: dir C:\\TFTP-Root)"],
  ["cls", "clear the screen"]
];

/* Windows' own label strings (each 39 characters, value starts at column 40) */
const ROWS = {
  "Connection-specific DNS Suffix": "   Connection-specific DNS Suffix  . : ",
  "Link-local IPv6 Address": "   Link-local IPv6 Address . . . . . : ",
  "IPv4 Address": "   IPv4 Address. . . . . . . . . . . : ",
  "Autoconfiguration IPv4 Address": "   Autoconfiguration IPv4 Address. . : ",
  "Subnet Mask": "   Subnet Mask . . . . . . . . . . . : ",
  "Default Gateway": "   Default Gateway . . . . . . . . . : ",
  "Media State": "   Media State . . . . . . . . . . . : ",
  "Host Name": "   Host Name . . . . . . . . . . . . : ",
  "Primary Dns Suffix": "   Primary Dns Suffix  . . . . . . . : ",
  "Node Type": "   Node Type . . . . . . . . . . . . : ",
  "IP Routing Enabled": "   IP Routing Enabled. . . . . . . . : ",
  "WINS Proxy Enabled": "   WINS Proxy Enabled. . . . . . . . : ",
  "Description": "   Description . . . . . . . . . . . : ",
  "Physical Address": "   Physical Address. . . . . . . . . : ",
  "DHCP Enabled": "   DHCP Enabled. . . . . . . . . . . : ",
  "Autoconfiguration Enabled": "   Autoconfiguration Enabled . . . . : ",
  "Lease Obtained": "   Lease Obtained. . . . . . . . . . : ",
  "Lease Expires": "   Lease Expires . . . . . . . . . . : ",
  "DHCP Server": "   DHCP Server . . . . . . . . . . . : ",
  "DNS Servers": "   DNS Servers . . . . . . . . . . . : ",
  "NetBIOS over Tcpip": "   NetBIOS over Tcpip. . . . . . . . : "
};
export { ROWS };
function row(label, value) { return ROWS[label] + (value == null ? "" : value); }
function when(hoursFromNow) {
  const d = new Date(Date.now() + hoursFromNow * 3600 * 1000);
  return d.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" }) + " " + d.toLocaleTimeString("en-US");
}
function v6(m) { const h = hash(m); return "fe80::" + (h & 0xffff).toString(16) + ":" + ((h >>> 16) & 0xffff).toString(16) + ":" + (hash(m + "a") & 0xffff).toString(16) + ":" + (hash(m + "b") & 0xffff).toString(16) + "%" + (10 + h % 9); }

/* your laptop has two terminals: its serial terminal on the console cable (the device's own id) and, with win, its
   Windows Command Prompt. Each keeps its own logins (an SSH session in one isn't in the other) */
const keyOf = function (id, win) { return win ? id + "/win" : id; };
/* the prompt a terminal shows right now: Windows', or the switch's when this terminal is logged in to one (your laptop
   on its console cable, or a computer's SSH or Telnet session), or the question it's waiting for (a password) */
export function prompt(sim, id, win) {
  const x = sim.d[id], st = sim.cli && sim.cli[keyOf(id, win)];
  if (x.kind === "techlaptop" && !win) return st && consoleTarget(sim, id) === st.sw ? (st.prompt != null ? st.prompt : SW.promptOf(st.S)) : "";
  if (st && st.auth) return st.ask;
  if (st && st.S) return st.prompt != null ? st.prompt : SW.promptOf(st.S);
  return "C:\\Users\\" + (x.user || "user") + ">";
}
/* the switch session a terminal is in, ready for a command (for ? help and Tab, which change nothing), or null */
export function cliSession(sim, id, win) {
  const st = sim.cli && sim.cli[keyOf(id, win)];
  if (!st || !st.S || st.auth || st.S.pending || st.S.mode === "gone" || st.S.mode === "login") return null;
  if (sim.d[id].kind === "techlaptop" && !win && consoleTarget(sim, id) !== st.sw) return null;
  return st.S;
}
/* whether the next thing typed in a terminal is a password (not shown as it's typed) */
export function secretNext(sim, id, win) { const st = sim.cli && sim.cli[keyOf(id, win)]; return !!(st && (st.auth && st.auth.secret || st.S && (st.S.mode === "login" || (st.S.pending && /^(enable|login)$/.test(st.S.pending.kind))))); }

/* run a command line on a device (win: your laptop's Command Prompt, not its serial terminal): returns { out, facts, clear } */
export function exec(sim, id, line, win) {
  sim.apply(win ? { t: "cmd", dev: id, line: line, win: true } : { t: "cmd", dev: id, line: line });
  const x = sim.d[id], raw = String(line == null ? "" : line), k = keyOf(id, win), before = sim.links();
  const st = sim.cli && sim.cli[k];
  const r = x.kind === "techlaptop" && !win ? serial(sim, id, raw) : st && (st.auth || st.S) ? remote(sim, id, raw, k) : run(sim, id, raw.trim(), k);
  sim.relink(before);   /* a switch port brought up (or shut) by that line: whatever is cabled to it gets its link, and asks for an address */
  return r;
}

/* ------------------------------------------------------------ switches: the console, SSH and Telnet */
/* the switch on the other end of this laptop's console cable, if the cable is in at both ends and the switch is on */
function consoleTarget(sim, id) {
  const c = sim.cablesOf(id).find(function (k) { return k.kind === "console"; });
  if (!c || !sim.cableUp(c)) return null;
  const far = c.a.dev === id ? c.b.dev : c.a.dev; return sim.d[far].kind === "mswitch" || sim.d[far].kind === "brouter" ? far : null;
}
/* what a switch's own ping reaches: anything that answers (Windows computers don't, by default) */
function reachFrom(sim, sw) {
  return function (ip) { const r = sim.route(sw, ip); if (r.fail) return false; if (r.local) { const k = sim.d[r.owner[0]].kind; return !(k === "pc" || k === "laptop"); } return !!(r.internet || r.modem); };
}
/* a TFTP write from a switch: it lands only on a computer it can reach with a TFTP server running (your laptop's).
   The file goes in the server's folder (a file of the same name is replaced) and its log says who sent it */
function tftpFrom(sim, sw) {
  return function (host, name, text, o) {
    const r = sim.route(sw, host);
    if (r.fail === "no-link" || r.fail === "no-route") return { err: "No route to host" };
    if (r.fail || !r.local) return { err: "Timed out" };
    const x = sim.d[r.owner[0]], srv = x && x.tftp;
    if (!srv || !srv.on) return { err: "Timed out" };
    const from = r.src || sim.addr(sw).ip, f = { name: name, text: text, bytes: text.length, from: from, which: o.which, unsaved: !!o.unsaved, at: sim.n };
    srv.files = srv.files.filter(function (g) { return g.name.toLowerCase() !== name.toLowerCase(); }).concat([f]);
    srv.log.push("Write request from " + from + " for " + name + ": received " + text.length + " bytes");
    return { ok: true };
  };
}
/* a TFTP read from a switch: the file comes only from a computer it can reach with a TFTP server running, by its name
   (Windows: case doesn't matter), and the server's log says who asked for it */
function tftpGetFrom(sim, sw) {
  return function (host, name) {
    const r = sim.route(sw, host);
    if (r.fail === "no-link" || r.fail === "no-route") return { err: "No route to host" };
    if (r.fail || !r.local) return { err: "Timed out" };
    const x = sim.d[r.owner[0]], srv = x && x.tftp;
    if (!srv || !srv.on) return { err: "Timed out" };
    const f = srv.files.find(function (g) { return g.name.toLowerCase() === String(name).toLowerCase(); }), from = r.src || sim.addr(sw).ip;
    if (!f) { srv.log.push("Read request from " + from + " for " + name + ": file not found"); return { err: "No such file or directory" }; }
    srv.log.push("Read request from " + from + " for " + f.name + ": sent " + f.text.length + " bytes");
    return { text: f.text, via: r.outIf || null };
  };
}
/* a session on a switch or the business router: the callbacks it needs from the network */
function opts(sim, tgt, via) { const o = { via: via, reach: reachFrom(sim, tgt), tftp: tftpFrom(sim, tgt), tftpGet: tftpGetFrom(sim, tgt) }; if (sim.d[tgt].kind === "brouter") o.live = sim.rtLive(tgt); return o; }
const sync = function (sim, id) { return sim.d[id].kind === "brouter" ? sim.syncRouter(id) : sim.syncSwitch(id); };
const lines = function (L) { return L.length ? L.join("\n") + "\n" : ""; };
function serial(sim, id, raw) {
  sim.cli = sim.cli || {};
  const tgt = consoleTarget(sim, id);
  let st = sim.cli[id];
  if (!tgt) return { out: "(Nothing answers on COM3: the console cable isn't joined to a powered switch's CONSOLE port.)\n", facts: { cmd: "serial", connected: false }, serial: true };
  sync(sim, tgt);
  if (!st || st.sw !== tgt) st = sim.cli[id] = { S: SW.session(sim.d[tgt].sw, opts(sim, tgt, "console")), sw: tgt, via: "console" };
  const r = SW.exec(st.S, raw); st.prompt = r.prompt;
  const dup = sim.d[tgt].kind === "mswitch" && dupAddr(sim, tgt); if (dup && st.dup !== dup) { st.dup = dup; r.out = r.out.concat([dup]); }   /* once a session, as the console log shows it */
  const sl = sfpLog(sim, tgt), sk = sl.join("|"); if (sl.length && st.sfp !== sk) { st.sfp = sk; r.out = r.out.concat(sl); }
  return { out: lines(r.out), facts: { cmd: "serial", dev: id, connected: true, mode: st.S.mode, line: raw.trim(), out: r.out.join("\n"), asked: !!r.secret }, secret: !!r.secret, cli: true, keep: r.keep };   /* asked: the switch is asking for a password next */
}
function remote(sim, id, raw, k) {
  const st = sim.cli[k], sw = sim.d[st.sw];
  if (st.auth) {   /* the password (or user name) the remote end asked for */
    const A = st.auth;
    if (A.step === "user") { A.user = raw.trim(); A.step = "pass"; A.secret = true; st.ask = "Password: "; return { out: "", facts: { cmd: st.via }, secret: true, cli: true }; }
    const ok = st.via === "ssh" ? sw.sw.vty.login === "local" && SW.pwOk(sw.sw.users[A.user], raw) : A.local ? SW.pwOk(sw.sw.users[A.user], raw) : SW.pwOk(sw.sw.vty.password, raw);
    if (ok) {
      const S = SW.session(sw.sw, opts(sim, st.sw, "vty")); S.mode = "user"; S.pending = null;
      st.S = S; st.auth = null; st.ask = null; st.prompt = SW.promptOf(S);
      const m = st.via === "ssh" ? SW.motd(sw.sw) : [];   /* over SSH the message of the day comes once you're in; Telnet showed it before the password */
      return { out: m.length ? lines(m.concat([""])) : st.via === "ssh" ? "" : "\n", facts: { cmd: st.via, dev: id, login: true, host: st.host, user: A.user }, cli: true };
    }
    A.tries++;
    if (A.tries >= 3) { delete sim.cli[k]; return { out: st.via === "ssh" ? A.user + "@" + st.host + ": Permission denied (password).\n" : "% Bad passwords\n\nConnection to host lost.\n", facts: { cmd: st.via, dev: id, login: false, denied: true, user: A.user } }; }
    return { out: st.via === "ssh" ? "Permission denied, please try again.\n" : "% Login invalid\n", facts: { cmd: st.via, dev: id, denied: true, user: A.user }, secret: true, cli: true };
  }
  sync(sim, st.sw);
  const r = SW.exec(st.S, raw);
  if (st.S.mode === "gone") { delete sim.cli[k]; return { out: lines(r.out.filter(function (l) { return !/con0 is now available|Press RETURN/.test(l); })).replace(/\n+$/, "\n") + (st.via === "ssh" ? "Connection to " + st.host + " closed.\n" : "\nConnection to host lost.\n"), facts: { cmd: st.via, closed: true } }; }
  st.prompt = r.prompt;
  return { out: lines(r.out), facts: { cmd: st.via, dev: id, line: raw.trim(), mode: st.S.mode, out: r.out.join("\n") }, secret: !!r.secret, cli: true, keep: r.keep };
}
/* a switch hears another device answer ARP for its own address, and logs it to the console */
function dupAddr(sim, sw) {
  const a = sim.addr(sw); if (!a) return null;
  const o = sim.owners(a.ip, sim.domain(sim.homeNode(sw))).filter(function (d) { return d !== sw; }); if (!o.length) return null;
  const m = sim.macOf(o[0]).replace(/[^0-9a-f]/gi, "").toLowerCase();
  return "%IP-4-DUPADDR: Duplicate address " + a.ip + " on Vlan1, sourced by " + m.slice(0, 4) + "." + m.slice(4, 8) + "." + m.slice(8, 12);
}
/* a module its slot can't run (a 10 Gb/s SFP+ in a 1 Gb/s SFP slot): the switch says so on the console and err-disables the port */
function sfpLog(sim, sw) {
  const x = sim.d[sw], L = [];
  Object.keys(x.sfp || {}).forEach(function (k) { const m = x.sfp[k] && SFP_MODULES[x.sfp[k]]; if (!m || m.rate === 1000) return; const n = swPort(k).replace("GigabitEthernet", "Gi");
    L.push("%PHY-4-UNSUPPORTED_TRANSCEIVER: Unsupported transceiver found in " + n, "%PM-4-ERR_DISABLE: gbic-invalid error detected on " + n + ", putting " + n + " in err-disable state"); });
  return L;
}
/* ssh-keygen -R host: take a host's remembered key off this computer's list of known hosts */
function sshKeygen(sim, id, args) {
  const facts = { cmd: "ssh-keygen", dev: id }, home = "C:\\Users\\" + (sim.d[id].user || "user") + "/.ssh/known_hosts";
  if (args[0] !== "-R" || !args[1]) return { out: "usage: ssh-keygen -R hostname   (remove a host's key from known_hosts)\n", facts: Object.assign(facts, { usage: true }) };
  const kh = sim.d[id].knownHosts, host = args[1];
  if (!kh || !kh[host]) return { out: "Host " + host + " not found in " + home + "\n", facts: Object.assign(facts, { host: host, removed: false }) };
  delete kh[host];
  return { out: "# Host " + host + " found: line 1\n" + home + " updated.\nOriginal contents retained as " + home + ".old\n", facts: Object.assign(facts, { host: host, removed: true }) };
}
/* ssh user@host, or ssh -l user host: Windows' own OpenSSH client */
function ssh(sim, id, args, k) {
  let user = null, host = null;
  for (let i = 0; i < args.length; i++) { if (args[i] === "-l") user = args[++i]; else if (!host) host = args[i]; }
  if (host && host.indexOf("@") > 0) { user = host.split("@")[0]; host = host.split("@").slice(1).join("@"); }
  if (!host) return { out: "usage: ssh [-l login_name] destination [command]\n", facts: { cmd: "ssh", usage: true } };
  user = user || sim.d[id].user || "user";
  const facts = { cmd: "ssh", dev: id, host: host, user: user };
  if (!isIp(host)) return { out: "ssh: Could not resolve hostname " + host.toLowerCase() + ": No such host is known.\n", facts: Object.assign(facts, { ok: false, why: "name" }) };
  const rt = sim.route(id, host);
  if (rt.fail === "no-link" || rt.fail === "no-route") return { out: "ssh: connect to host " + host + " port 22: Network is unreachable\n", facts: Object.assign(facts, { ok: false, why: "unreachable" }) };
  if (rt.fail || !rt.local) return { out: "ssh: connect to host " + host + " port 22: Connection timed out\n", facts: Object.assign(facts, { ok: false, why: "timeout" }) };
  const who = sim.turn(id, host, rt.owner), x = sim.d[who];   /* two devices on one address take turns */
  if (x.kind !== "mswitch" && x.kind !== "brouter") return { out: x.kind === "pc" || x.kind === "laptop" ? "ssh: connect to host " + host + " port 22: Connection timed out\n" : "ssh: connect to host " + host + " port 22: Connection refused\n", facts: Object.assign(facts, { ok: false, why: "no-ssh" }) };
  const v = x.sw.vty;
  if (!x.sw.rsa || !/^(ssh|all)$/.test(v.transport)) return { out: "ssh: connect to host " + host + " port 22: Connection refused\n", facts: Object.assign(facts, { ok: false, why: "refused" }) };
  if (x.sw.rsa < 768) return { out: "Protocol major versions differ: 2 vs. 1\n", facts: Object.assign(facts, { ok: false, why: "v1" }) };
  /* the host keys this computer has met before (SO-13's office keeps a list): a different key from the one remembered stops the
     connection, as OpenSSH does; a host met for the first time is added to the list */
  const kh = sim.d[id].knownHosts, fp = SW.hostKey(x.sw), home = "C:\\Users\\" + (sim.d[id].user || "user") + "/.ssh/known_hosts";
  if (kh && kh[host] && kh[host] !== fp) return { out: ["@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@", "@    WARNING: REMOTE HOST IDENTIFICATION HAS CHANGED!     @", "@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@",
    "IT IS POSSIBLE THAT SOMEONE IS DOING SOMETHING NASTY!", "Someone could be eavesdropping on you right now (man-in-the-middle attack)!", "It is also possible that a host key has just been changed.", "The fingerprint for the RSA key sent by the remote host is", fp + ".",
    "Please contact your system administrator.", "Add correct host key in " + home + " to get rid of this message.", "Offending RSA key in " + home + ":1", "Host key for " + host + " has changed and you have requested strict checking.", "Host key verification failed.", ""].join("\n"), facts: Object.assign(facts, { ok: false, why: "hostkey", fp: fp }) };
  const added = !!kh && !kh[host]; if (added) kh[host] = fp;   /* keys under 768 bits: the switch offers only SSH version 1, and Windows' client speaks only version 2 */
  if (!v.login) return { out: "Password required, but none set\nConnection to " + host + " closed by remote host.\n", facts: Object.assign(facts, { ok: false, why: "no-login" }) };
  sim.cli = sim.cli || {};
  sim.cli[k || id] = { sw: who, via: "ssh", host: host, auth: { step: "pass", user: user, tries: 0, secret: true }, ask: user + "@" + host + "'s password: " };
  return { out: added ? "Warning: Permanently added '" + host + "' (RSA) to the list of known hosts.\n" : "", facts: Object.assign(facts, { ok: true, asked: true, added: added }), secret: true, cli: true };
}
/* telnet host: port 23, everything (passwords too) sent in the clear */
function telnet(sim, id, args, k) {
  const host = args[0], facts = { cmd: "telnet", dev: id, host: host };
  if (!host) return { out: "\nUsage: telnet [host [port]]\n", facts: Object.assign(facts, { usage: true }) };
  const fail = "Connecting To " + host + "...Could not open connection to the host, on port 23: Connect failed\n";
  if (!isIp(host)) return { out: "Connecting To " + host + "...Could not open connection to the host, on port 23: Connect failed\n", facts: Object.assign(facts, { ok: false }) };
  const rt = sim.route(id, host);
  if (rt.fail || !rt.local) return { out: fail, facts: Object.assign(facts, { ok: false, why: "unreachable" }) };
  const who = rt.owner[0], x = sim.d[who];
  if ((x.kind !== "mswitch" && x.kind !== "brouter") || !/^(telnet|all)$/.test(x.sw.vty.transport)) return { out: fail, facts: Object.assign(facts, { ok: false, why: "refused" }) };
  const v = x.sw.vty;
  if (!v.login || (v.login === "password" && !v.password)) return { out: "\nPassword required, but none set\n\nConnection to host lost.\n", facts: Object.assign(facts, { ok: false, why: "no-login" }) };
  sim.cli = sim.cli || {};
  sim.cli[k || id] = v.login === "local" ? { sw: who, via: "telnet", host: host, auth: { step: "user", tries: 0, local: true, secret: false }, ask: "Username: " } : { sw: who, via: "telnet", host: host, auth: { step: "pass", tries: 0, secret: true }, ask: "Password: " };
  return { out: lines(SW.motd(x.sw)) + "\nUser Access Verification\n\n", facts: Object.assign(facts, { ok: true, asked: true }), secret: v.login !== "local", cli: true };
}

/* dir: the folders a technician looks in here. Your laptop's TFTP server keeps what it's sent in C:\TFTP-Root */
function dir(sim, id, args) {
  const x = sim.d[id], want = (args.join(" ") || "C:\\Users\\" + (x.user || "user")).replace(/[\\/]+$/, "").toLowerCase(), facts = { cmd: "dir", dev: id };
  const srv = x.tftp, head = function (p) { return [" Volume in drive C has no label.", " Volume Serial Number is ████-████", "", " Directory of " + p, ""]; };
  if (srv && /^(c:)?[\\/]?tftp-root$/.test(want)) {
    const L = head(srv.root), when = function (f) { return "10/17/2026  " + lpad(10 + Math.floor(f.at / 60) % 2, 2) + ":" + String(10 + f.at % 50).padStart(2, "0") + " AM"; };
    L.push("10/17/2026  09:58 AM    <DIR>          .", "10/17/2026  09:58 AM    <DIR>          ..");
    let total = 0; srv.files.forEach(function (f) { total += f.bytes; L.push(when(f) + "    " + lpad(f.bytes.toLocaleString("en-US"), 14) + " " + f.name); });
    L.push(lpad(srv.files.length, 16) + " File(s) " + lpad(total.toLocaleString("en-US"), 14) + " bytes", "               2 Dir(s)  212,384,710,656 bytes free");
    facts.files = srv.files.map(function (f) { return f.name; });
    return { out: L.join("\n") + "\n", facts: facts };
  }
  if (/^(c:)?[\\/]?users[\\/]/.test(want) || want === "") return { out: head("C:\\Users\\" + (x.user || "user")).concat(["10/17/2026  09:58 AM    <DIR>          .", "10/17/2026  09:58 AM    <DIR>          ..", "10/17/2026  09:58 AM    <DIR>          Desktop", "10/17/2026  09:58 AM    <DIR>          Documents", "10/17/2026  09:58 AM    <DIR>          Downloads", "               0 File(s)              0 bytes", "               5 Dir(s)  212,384,710,656 bytes free"]).join("\n") + "\n", facts: facts };
  return { out: "The system cannot find the file specified.\n", facts: facts };
}

function adapterName(f) { return f.type === "wifi" ? "Wireless LAN adapter " + f.name : "Ethernet adapter " + f.name; }

function ipconfig(sim, id, args) {
  const x = sim.d[id], f = x.ifaces[0], a = sim.addr(id), sub = (args[0] || "").toLowerCase();
  const facts = { cmd: "ipconfig", sub: sub || "", dev: id, media: a ? "connected" : "disconnected", ip: a && a.ip, apipa: !!(a && a.kind === "apipa"), gw: a && a.gw, dns: a ? a.dns.slice() : [], kind: a && a.kind };
  const lines = ["", "Windows IP Configuration", "", ""];
  let pre = [];
  if (sub === "/release") {
    if (!a) { pre.push("No operation can be performed on " + f.name + " while it has its media disconnected."); }
    else if (f.cfg.mode === "static") { pre.push("The operation failed as no adapter is in the state permissible for this operation."); }
    else { sim.release(id); facts.released = true; }
  } else if (sub === "/renew") {
    if (!a) { pre.push("No operation can be performed on " + f.name + " while it has its media disconnected."); facts.result = "media"; }
    else if (f.cfg.mode === "static") { pre.push("The operation failed as no adapter is in the state permissible for this operation."); facts.result = "static"; }
    else {
      const r = sim.dhcp(id, "renew"); facts.result = r.result;
      if (r.result !== "lease") pre.push("An error occurred while renewing interface " + f.name + " : unable to contact your DHCP server. Request has timed out.");
    }
  } else if (sub === "/flushdns") {
    lines.push("Successfully flushed the DNS Resolver Cache.");
    return { out: lines.join("\n"), facts: facts };
  } else if (sub === "/?" || (sub && sub !== "/all")) {
    return { out: "\nUSAGE:\n    ipconfig [/all | /release | /renew | /flushdns]\n\nwhere\n    /all       Display full configuration information.\n    /release   Release the IPv4 address for the adapter.\n    /renew     Renew the IPv4 address for the adapter.\n    /flushdns  Purges the DNS Resolver cache.\n", facts: facts };
  }
  const now = sim.addr(id);
  Object.assign(facts, { media: now ? "connected" : "disconnected", ip: now && now.ip, mask: now && now.mask, apipa: !!(now && now.kind === "apipa"), gw: now && now.gw, dns: now ? now.dns.slice() : [], kind: now && now.kind });
  if (pre.length) lines.splice(3, 0, ...pre, "");   /* messages come between the title and the adapters, as Windows prints them */
  const all = sub === "/all";
  if (all) {
    if (!pre.length && lines[lines.length - 1] === "" && lines[lines.length - 2] === "") lines.pop();   /* /all puts the host details one line under the title */
    lines.push(row("Host Name", x.host || "PC"), row("Primary Dns Suffix", ""), row("Node Type", "Hybrid"), row("IP Routing Enabled", "No"), row("WINS Proxy Enabled", "No"), "");
  }
  lines.push(adapterName(f) + ":", "");
  if (!now) {
    lines.push(row("Media State", "Media disconnected"), row("Connection-specific DNS Suffix", ""));
    if (all) lines.push(row("Description", f.desc || "Network Adapter"), row("Physical Address", f.mac.toUpperCase()), row("DHCP Enabled", f.cfg.mode === "dhcp" ? "Yes" : "No"), row("Autoconfiguration Enabled", "Yes"));
    return { out: lines.join("\n") + "\n", facts: facts };
  }
  lines.push(row("Connection-specific DNS Suffix", ""));
  if (all) lines.push(row("Description", f.desc || "Network Adapter"), row("Physical Address", f.mac.toUpperCase()), row("DHCP Enabled", f.cfg.mode === "dhcp" ? "Yes" : "No"), row("Autoconfiguration Enabled", "Yes"));
  lines.push(row("Link-local IPv6 Address", v6(f.mac) + (all ? "(Preferred) " : "")));
  if (facts.released) {
    lines.push(row("Default Gateway", ""));
    return { out: lines.join("\n") + "\n", facts: facts };
  }
  if (now.kind === "apipa") lines.push(row("Autoconfiguration IPv4 Address", now.ip + (all ? "(Preferred) " : "")));
  else lines.push(row("IPv4 Address", now.ip + (all ? "(Preferred) " : "")));
  lines.push(row("Subnet Mask", now.mask));
  if (all && now.kind === "dhcp") lines.push(row("Lease Obtained", when(-0.5)), row("Lease Expires", when((f.lease.hours || 24) - 0.5)));
  lines.push(row("Default Gateway", now.gw || ""));
  if (all) {
    if (now.kind === "dhcp") lines.push(row("DHCP Server", now.server));
    const dns = now.dns.length ? now.dns : ["fec0:0:0:ffff::1%1", "fec0:0:0:ffff::2%1", "fec0:0:0:ffff::3%1"];
    lines.push(row("DNS Servers", dns[0])); for (let i = 1; i < dns.length; i++) lines.push(" ".repeat(39) + dns[i]);
    lines.push(row("NetBIOS over Tcpip", "Enabled"));
  }
  return { out: lines.join("\n") + "\n", facts: facts };
}

/* what one echo attempt does; returns a line and whether a real reply came back */
/* interference loses a steady share of packets: spread evenly through a run, from a random starting point,
   so four pings on a 36% link always lose one or two (never a lucky clean run that hides the fault) */
function lostAt(i, loss, phase) { return loss > 0 && Math.floor((i + 1) * loss + phase) > Math.floor(i * loss + phase); }
function attempt(sim, id, ip, rt, i, R, phase) {
  if (rt.fail === "no-link" || rt.fail === "no-route") return { line: "PING: transmit failed. General failure.", got: false, counted: false };
  if (rt.fail === "host-unreachable" || rt.fail === "gateway-unreachable") return { line: "Reply from " + rt.addr.ip + ": Destination host unreachable.", got: false, counted: true };
  if (rt.fail === "net-unreachable") return { line: "Reply from " + rt.hops[0] + ": Destination net unreachable.", got: false, counted: true };
  if (rt.fail === "no-reply") { if (rt.via && rt.addr && rt.addr.gw) sim.arp[id][rt.addr.gw] = sim.macOf(rt.via); else if (rt.owner) sim.arp[id][ip] = sim.macOf(rt.owner[0]); return { line: "Request timed out.", got: false, counted: false }; }   /* it answered the ARP (or the router did, for another network); the reply is what never comes */
  if (rt.fail) return { line: "Request timed out.", got: false, counted: false };
  const h = sim.hop(id);
  let loss = h.loss, base = h.base;
  if (rt.local) {
    const who = rt.owner[(i + (hash(ip) % rt.owner.length)) % rt.owner.length];
    const k = sim.d[who].kind;
    if (who !== id && (k === "pc" || k === "laptop")) return { line: "Request timed out.", got: false, counted: false, who: who };   /* Windows Firewall drops ping by default */
    const hd = sim.hop(who); loss = 1 - (1 - loss) * (1 - hd.loss); base += hd.base;
    sim.arp[id][ip] = sim.macOf(who);
    if (lostAt(i, loss, phase)) return { line: "Request timed out.", got: false, counted: false };
    const t = who === id ? 0 : base + Math.floor(R() * (base ? 6 : 2)) + (loss > 0.05 ? Math.floor(R() * 180) : 0);
    return { line: "Reply from " + ip + ": bytes=32 time" + (t < 1 ? "<1ms" : "=" + t + "ms") + " TTL=" + sim.ttlOf(who), got: true, counted: true, t: t, who: who };
  }
  const gw = rt.addr.gw; if (gw) sim.arp[id][gw] = sim.macOf(rt.via);
  if (rt.routed) {   /* through the business router to another of the business's networks: one hop, so the TTL comes back one less */
    const who = rt.owner[0], k = sim.d[who].kind;
    if (k === "pc" || k === "laptop") return { line: "Request timed out.", got: false, counted: false, who: who };   /* Windows Firewall, as on any network */
    if (lostAt(i, loss, phase)) return { line: "Request timed out.", got: false, counted: false };
    const t = 1 + base + Math.floor(R() * 3);
    return { line: "Reply from " + ip + ": bytes=32 time" + (t < 1 ? "<1ms" : "=" + t + "ms") + " TTL=" + (sim.ttlOf(who) - 1), got: true, counted: true, t: t, who: who };
  }
  if (lostAt(i, loss, phase)) return { line: "Request timed out.", got: false, counted: false };
  const t = (rt.modem ? 2 : 12) + base + Math.floor(R() * 9) + (loss > 0.05 ? Math.floor(R() * 220) : 0);
  return { line: "Reply from " + ip + ": bytes=32 time=" + t + "ms TTL=" + (rt.modem ? 63 : 56), got: true, counted: true, t: t };
}

function resolveName(sim, id, name) {
  const a = sim.addr(id);
  if (!a) return { ok: false, why: "no-link" };
  for (const s of a.dns) if (sim.dnsServerWorks(id, s)) { const ip = sim.lookup(name); return ip ? { ok: true, ip: ip, server: s } : { ok: false, why: "nx", server: s }; }
  return { ok: false, why: "timeout", server: a.dns[0] };
}

function ping(sim, id, args) {
  let n = 4, t = false, target = null;
  for (let i = 0; i < args.length; i++) { const a = args[i].toLowerCase(); if (a === "-n" || a === "/n") { n = Math.max(1, Math.min(20, parseInt(args[++i], 10) || 4)); } else if (a === "-t" || a === "/t") { t = true; } else if (a === "-4") { } else if (!target) target = args[i]; }
  if (!target) return { out: "\nUsage: ping [-t] [-n count] target_name\n\nOptions:\n    -t             Ping the specified host until stopped.\n    -n count       Number of echo requests to send.\n", facts: { cmd: "ping", usage: true } };
  if (t) n = 8;
  const facts = { cmd: "ping", dev: id, target: target, byName: !isIp(target) };
  let ip = target, head;
  if (!isIp(target)) {
    const r = resolveName(sim, id, target);
    if (!r.ok) { facts.kind = "dns-fail"; facts.ok = false; return { out: "Ping request could not find host " + target + ". Please check the name and try again.\n", facts: facts }; }
    ip = r.ip; head = "Pinging " + target + " [" + ip + "] with 32 bytes of data:";
  } else head = "Pinging " + ip + " with 32 bytes of data:";
  facts.ip = ip;
  const rt = sim.route(id, ip);
  const R = sim.r("ping" + ip);
  const lines = ["", head]; let got = 0, counted = 0; const times = []; const phase = R();
  for (let i = 0; i < n; i++) { const r = attempt(sim, id, ip, rt, i, R, phase); lines.push(r.line); if (r.got) { got++; times.push(r.t); } if (r.counted) counted++; if (r.who) facts.who = (facts.who || []).concat(r.who); }
  if (t) lines.push("Control-C", "^C");
  const lost = n - counted;
  lines.push("", "Ping statistics for " + ip + ":", "    Packets: Sent = " + n + ", Received = " + counted + ", Lost = " + lost + " (" + Math.round(lost / n * 100) + "% loss),");
  if (times.length) { const mn = Math.min(...times), mx = Math.max(...times), av = Math.round(times.reduce(function (s, v) { return s + v; }, 0) / times.length); lines.push("Approximate round trip times in milli-seconds:", "    Minimum = " + mn + "ms, Maximum = " + mx + "ms, Average = " + av + "ms"); }
  facts.sent = n; facts.replies = got; facts.ok = got > 0;
  /* a reply from something other than this computer: only that proves anything about the network */
  facts.beyond = got > 0 && !isLoopback(ip) && (!!rt.internet || (!!rt.local && (facts.who || []).some(function (w) { return w !== id; }))); facts.loss = Math.round((n - got) / n * 100);
  facts.kind = rt.fail || (rt.local ? "local" : rt.internet ? "internet" : "ok");
  facts.local = !!rt.local; facts.internet = !!rt.internet;
  sim.lastTrace = trace(sim, id, ip, rt, got > 0);
  routerCount(sim, rt, n, ip);
  return { out: lines.join("\n") + "\n", facts: facts };
}
/* traffic really sent through the business router: each access list line it matched counts (show access-lists), and a
   translation is made for each conversation to the provider (show ip nat translations) */
function routerCount(sim, rt, n, ip) {
  const x = rt && rt.via && sim.d[rt.via]; if (!x || x.kind !== "brouter") return;
  (rt.acls || []).forEach(function (h) { if (h[1] < 0) return; x.hits = x.hits || {}; const L = x.hits[h[0]] = x.hits[h[0]] || {}; L[h[1]] = (L[h[1]] || 0) + n; });
  if (rt.nat) { x.xlate = x.xlate || []; const k = 1 + (x.xlate.length % 32); x.xlate.push({ proto: "icmp", ig: rt.nat.global + ":" + k, il: rt.nat.inside + ":" + k, ol: ip + ":" + k, og: ip + ":" + k }); if (x.xlate.length > 24) x.xlate.shift(); }
}

/* the packet's journey, hop by hop, for Step through */
function trace(sim, id, ip, rt, ok) {
  const steps = [], a = rt.addr, me = sim.d[id];
  if (!a) { steps.push({ at: me.label, what: "No link on " + me.ifaces[0].name + ": the packet never leaves", ok: false }); return steps; }
  if (rt.fail === "no-route") { steps.push({ at: me.label, what: "No route to " + ip + " (no default gateway)", ok: false }); return steps; }
  const next = rt.local || rt.fail === "no-reply" ? ip : a.gw;
  steps.push({ at: me.label, what: "ARP: who has " + next + "? (broadcast to ff-ff-ff-ff-ff-ff)", l2: me.ifaces[0].mac + " → ff-ff-ff-ff-ff-ff", l3: "", ok: true });
  if (rt.fail === "host-unreachable" || rt.fail === "gateway-unreachable") { steps.push({ at: me.label, what: "No answer to the ARP: nobody on this network has " + next, ok: false }); return steps; }
  const nh = rt.local || rt.fail === "no-reply" ? rt.owner[0] : rt.via;
  steps.push({ at: sim.d[nh].label, what: "ARP reply: " + next + " is at " + sim.macOf(nh), ok: true });
  steps.push({ at: me.label, what: "ICMP echo request", l2: me.ifaces[0].mac + " → " + sim.macOf(nh), l3: a.ip + " → " + ip + "  TTL " + sim.ttlOf(id), ok: true });
  if (rt.fail === "no-reply") { const b = sim.addr(nh); steps.push({ at: sim.d[nh].label, what: "No reply: with mask " + b.mask + ", " + a.ip + " is on another network to it, and its gateway " + (b.gw || "(none)") + " isn't on its own network either, so the reply never leaves", ok: false }); return steps; }
  if (rt.local) { steps.push({ at: sim.d[nh].label, what: ok ? "ICMP echo reply" : "No reply (dropped)", l3: ip + " → " + a.ip, ok: ok }); return steps; }
  const r = sim.d[rt.via];
  if (rt.fail === "net-unreachable") { steps.push({ at: r.label, what: "No route to the internet (WAN down): sends back Destination net unreachable", ok: false }); return steps; }
  if (rt.internet && r.kind === "router") {
    steps.push({ at: r.label, what: "NAT: private " + a.ip + " becomes public " + sim.net.isp.wanIp + "; TTL down by 1", l3: sim.net.isp.wanIp + " → " + ip + "  TTL " + (sim.ttlOf(id) - 1), ok: true });
    steps.push({ at: "Cable modem", what: "Bridges the frame onto the provider's cable network", ok: true });
    steps.push({ at: "Provider", what: "Routes it across the internet: " + sim.net.isp.gw + ", " + sim.net.isp.core, ok: true });
    steps.push({ at: ip, what: ok ? "ICMP echo reply comes back the same way; the router reverses the NAT" : "No reply", ok: ok });
  } else steps.push({ at: r.label, what: ok ? "Forwarded and answered" : "Forwarded, no answer", ok: ok });
  return steps;
}

function tracert(sim, id, args) {
  const target = args.filter(function (a) { return a[0] !== "-"; })[0];
  if (!target) return { out: "\nUsage: tracert target_name\n", facts: { cmd: "tracert", usage: true } };
  const facts = { cmd: "tracert", dev: id, target: target };
  let ip = target, head;
  if (!isIp(target)) {
    const r = resolveName(sim, id, target);
    if (!r.ok) { facts.ok = false; facts.kind = "dns-fail"; return { out: "Unable to resolve target system name " + target + ".\n", facts: facts }; }
    ip = r.ip; head = ["", "Tracing route to " + target + " [" + ip + "]", "over a maximum of 30 hops:", ""];
  } else head = ["", "Tracing route to " + ip + " over a maximum of 30 hops", ""];
  let rt = sim.route(id, ip); const R = sim.r("tracert" + ip), lines = head.slice();
  const ms = function (base) { const v = base + Math.floor(R() * 4); return v < 1 ? "    <1 ms" : lpad(v + " ms", 9); };
  const hopLine = function (k, base, addr) { return lpad(k, 3) + ms(base) + ms(base) + ms(base) + "  " + addr; };
  if (rt.fail === "no-link" || rt.fail === "no-route") { lines.push("Transmit error: code 1231.", "", "Trace complete."); facts.ok = false; return { out: lines.join("\n") + "\n", facts: facts }; }
  if (rt.fail === "host-unreachable" || rt.fail === "gateway-unreachable") { lines.push(lpad(1, 3) + "  " + rt.addr.ip + "  reports: Destination host unreachable.", "", "Trace complete."); facts.ok = false; return { out: lines.join("\n") + "\n", facts: facts }; }
  const w = sim.hop(id).base;
  if (rt.local) { lines.push(hopLine(1, w, ip), "", "Trace complete."); facts.ok = true; facts.reached = 1; return { out: lines.join("\n") + "\n", facts: facts }; }
  const hops = (rt.hops || []).slice();
  if (rt.routed && /^(pc|laptop)$/.test(sim.d[rt.owner[0]].kind)) { hops.pop(); rt = Object.assign({}, rt, { fail: "firewall" }); }   /* a Windows PC at the end: its firewall answers nothing */
  if (!hops.length) { for (let k = 0; k < 5; k++) lines.push(lpad(k + 1, 3) + "     *        *        *     Request timed out."); lines.push("^C"); facts.ok = false; return { out: lines.join("\n") + "\n", facts: facts }; }
  lines.push(hopLine(1, w, hops[0]));
  if (rt.fail === "net-unreachable") { lines.push(lpad(2, 3) + "  " + hops[0] + "  reports: Destination net unreachable.", "", "Trace complete."); facts.ok = false; facts.stopAt = hops[0]; return { out: lines.join("\n") + "\n", facts: facts }; }
  for (let k = 1; k < hops.length; k++) lines.push(hopLine(k + 1, w + 7 + k * 3, hops[k] + (k === hops.length - 1 && !isIp(target) ? "" : "")));
  if (rt.fail) { for (let k = hops.length; k < hops.length + 5; k++) lines.push(lpad(k + 1, 3) + "     *        *        *     Request timed out."); lines.push("^C"); facts.ok = false; return { out: lines.join("\n") + "\n", facts: facts }; }
  lines.push("", "Trace complete."); facts.ok = true; facts.reached = hops.length;
  return { out: lines.join("\n") + "\n", facts: facts };
}

function nslookup(sim, id, args) {
  const name = args[0], forced = args[1];
  const facts = { cmd: "nslookup", dev: id, name: name };
  if (!name) return { out: "Interactive mode isn't available here. Type: nslookup <name> [server]\n", facts: facts };
  const a = sim.addr(id);
  const server = forced || (a && a.dns[0]);
  facts.server = server;
  if (!server) { facts.ok = false; return { out: "*** Default servers are not available\nServer:  UnKnown\nAddress:  127.0.0.1\n\n*** UnKnown can't find " + name + ": No response from server\n", facts: facts }; }
  const works = !!a && sim.dnsServerWorks(id, server);
  if (!works) {
    facts.ok = false;
    return { out: "DNS request timed out.\n    timeout was 2 seconds.\nServer:  UnKnown\nAddress:  " + server + "\n\nDNS request timed out.\n    timeout was 2 seconds.\nDNS request timed out.\n    timeout was 2 seconds.\n*** Request to UnKnown timed-out\n", facts: facts };
  }
  const ip = sim.lookup(name);
  if (!ip) { facts.ok = false; facts.nx = true; return { out: "Server:  UnKnown\nAddress:  " + server + "\n\n*** UnKnown can't find " + name + ": Non-existent domain\n", facts: facts }; }
  facts.ok = true; facts.ip = ip;
  return { out: "Server:  UnKnown\nAddress:  " + server + "\n\nNon-authoritative answer:\nName:    " + name + "\nAddress:  " + ip + "\n", facts: facts };
}

function arp(sim, id, args) {
  const a = sim.addr(id), facts = { cmd: "arp", dev: id };
  if (!args.length || (args[0].toLowerCase() !== "-a" && args[0].toLowerCase() !== "/a")) return { out: "\nDisplays and modifies the IP-to-Physical address translation tables.\n\nARP -a        Displays current ARP entries.\n", facts: facts };
  if (!a) { facts.entries = []; return { out: "No ARP Entries Found.\n", facts: facts }; }
  /* a working computer has always talked to its gateway */
  if (a.gw && !sim.arp[id][a.gw]) { const dom = sim.domain(sim.homeNode(id)); const o = sim.owners(a.gw, dom); if (o.length) sim.arp[id][a.gw] = sim.macOf(o[0]); }
  const lines = ["", "Interface: " + a.ip + " --- 0x" + (10 + hash(id) % 6).toString(16), "  Internet Address      Physical Address      Type"];
  const ent = Object.keys(sim.arp[id]).filter(function (ip) { return sameSubnet(ip, a.ip, a.mask) && ip !== a.ip; }).sort(function (p, q) { return p.split(".").map(Number)[3] - q.split(".").map(Number)[3]; });
  facts.entries = ent.map(function (ip) { return [ip, sim.arp[id][ip]]; });
  for (const ip of ent) lines.push("  " + pad(ip, 22) + pad(sim.arp[id][ip], 22) + "dynamic");
  lines.push("  " + pad(bcast(a), 22) + pad("ff-ff-ff-ff-ff-ff", 22) + "static");
  for (const s of STATIC_ARP) lines.push("  " + pad(s[0], 22) + pad(s[1], 22) + "static");
  return { out: lines.join("\n") + "\n", facts: facts };
}
function bcast(a) { const p = a.ip.split(".").map(Number), m = a.mask.split(".").map(Number); return p.map(function (v, i) { return (v & m[i]) | (255 - m[i]); }).join("."); }

function colonMac(m) { return m.replace(/-/g, ":"); }
function netsh(sim, id, args) {
  const s = args.join(" ").toLowerCase().replace(/\s+/g, " ");
  const x = sim.d[id], f = x.ifaces[0];
  if (f.type !== "wifi") return { out: "There is no wireless interface on the system.\n", facts: { cmd: "netsh", dev: id, none: true } };
  if (/^wlan show int/.test(s)) {
    const l = sim.wifiLink(id), facts = { cmd: "netsh-if", dev: id, connected: !!(l && l.connected) };
    const lines = ["", "There is 1 interface on the system:", "", "    Name                   : " + f.name, "    Description            : " + (f.desc || "Wireless Adapter"), "    Physical address       : " + colonMac(f.mac)];
    if (!l || !l.connected) { lines.push("    State                  : disconnected", "    Radio status           : Hardware On", "                             Software On", "", "    Hosted network status  : Not available"); return { out: lines.join("\n") + "\n", facts: facts }; }
    Object.assign(facts, { signal: l.signal, ch: l.ch, band: l.band, rate: l.rate, ap: l.ap.id, bssid: colonMac(l.ap.mac), auth: l.sec });
    lines.push("    State                  : connected", "    SSID                   : " + l.ap.ssid, "    BSSID                  : " + colonMac(l.ap.mac), "    Network type           : Infrastructure",
      "    Radio type             : " + (l.band === 5 ? "802.11ac" : "802.11n"), "    Authentication         : " + l.sec, "    Cipher                 : " + (l.sec === "Open" ? "None" : "CCMP"), "    Connection mode        : Auto Connect",
      "    Band                   : " + (l.band === 5 ? "5 GHz" : "2.4 GHz"), "    Channel                : " + l.ch, "    Receive rate (Mbps)    : " + l.rate, "    Transmit rate (Mbps)   : " + l.rate,
      "    Signal                 : " + l.signal + "%", "    Profile                : " + f.saved.ssid, "", "    Hosted network status  : Not available");
    return { out: lines.join("\n") + "\n", facts: facts };
  }
  if (/^wlan show net/.test(s)) {
    const bssid = /mode=bssid/.test(s), room = sim.net.rooms[id], facts = { cmd: "netsh-nets", dev: id, bssid: bssid, heard: [] };
    const nets = {};
    /* one entry per network name and security, as Windows lists them: an open copy of a name shows as its own network */
    for (const ap of sim.aps()) { const sg = sim.heardAt(ap, room); if (sg < 15) continue; const au = sim.usesSec(f, ap.sec), k = ap.ssid + "|" + au; (nets[k] = nets[k] || { ssid: ap.ssid, auth: au, list: [] }).list.push({ mac: ap.mac, sig: sg, band: ap.band, ch: ap.ch }); facts.auth = facts.auth || {}; if (ap.sec !== "Open" || !facts.auth[ap.ssid]) facts.auth[ap.ssid] = au; }
    for (const nb of sim.net.neighbours) { const sg = nb.heard[room] || 0; if (sg < 15) continue; const k = nb.ssid + "|WPA2-Personal"; (nets[k] = nets[k] || { ssid: nb.ssid, auth: "WPA2-Personal", list: [] }).list.push({ mac: nb.mac, sig: sg, band: nb.band, ch: nb.ch }); }
    const names = Object.keys(nets);
    facts.twice = names.map(function (k) { return nets[k].ssid; }).filter(function (n, i, a) { return a.indexOf(n) !== i; });
    const lines = ["", "Interface name : " + f.name, "There are " + names.length + " networks currently visible.", ""];
    names.forEach(function (n, i) {
      lines.push("SSID " + (i + 1) + " : " + nets[n].ssid, "    Network type            : Infrastructure", "    Authentication          : " + nets[n].auth, "    Encryption              : " + (nets[n].auth === "Open" ? "None" : "CCMP"));
      if (bssid) nets[n].list.forEach(function (b, k) { facts.heard.push({ ssid: nets[n].ssid, auth: nets[n].auth, mac: colonMac(b.mac), ch: b.ch, sig: b.sig, band: b.band }); lines.push("    BSSID " + (k + 1) + "                 : " + colonMac(b.mac), "         Signal             : " + b.sig + "%", "         Radio type         : " + (b.band === 5 ? "802.11ac" : "802.11n"), "         Band               : " + (b.band === 5 ? "5 GHz" : "2.4 GHz"), "         Channel            : " + b.ch); });
      lines.push("");
    });
    return { out: lines.join("\n"), facts: facts };
  }
  if (/^wlan show driver/.test(s)) {
    /* what the adapter itself can do: the honest way to find out whether it supports WPA3 */
    const can = f.secs || ["WPA2-Personal", "WPA3-Personal"], wpa3 = can.indexOf("WPA3-Personal") >= 0, facts = { cmd: "netsh-drivers", dev: id, secs: can.slice(), wpa3: wpa3 };
    const L = ["", "Interface name: " + f.name, "", "    Driver                    : " + (f.desc || "Wireless Adapter"), "    Type                      : Native Wi-Fi Driver",
      "    Radio types supported     : " + (f.bands.indexOf(5) >= 0 ? "802.11b 802.11g 802.11n 802.11a 802.11ac" : "802.11b 802.11g 802.11n"), "    FIPS 140 mode supported   : Yes",
      "    802.11w Management Frame Protection supported : " + (wpa3 ? "Yes" : "No"), "    Hosted network supported  : No",
      "    Authentication and cipher supported in infrastructure mode:", "                                Open            None", "                                WPA2-Personal   CCMP", "                                WPA2-Enterprise CCMP"];
    if (wpa3) L.push("                                WPA3-Personal   CCMP", "                                WPA3-Personal   GCMP", "                                WPA3-Enterprise GCMP-256");
    return { out: L.join("\n") + "\n", facts: facts };
  }
  return { out: "The following command was not found: " + args.join(" ") + ".\nTry: netsh wlan show interfaces, netsh wlan show networks mode=bssid, or netsh wlan show drivers\n", facts: { cmd: "netsh", dev: id } };
}

export function run(sim, id, line, k) {
  const parts = line.split(/\s+/).filter(Boolean);
  if (!parts.length) return { out: "", facts: {} };
  const c = parts[0].toLowerCase().replace(/\.exe$/, ""), args = parts.slice(1), x = sim.d[id];
  switch (c) {
    case "ipconfig": return ipconfig(sim, id, args);
    case "ping": return ping(sim, id, args);
    case "tracert": return tracert(sim, id, args);
    case "nslookup": return nslookup(sim, id, args);
    case "arp": return arp(sim, id, args);
    case "netsh": return netsh(sim, id, args);
    case "ssh": return ssh(sim, id, args, k);
    case "ssh-keygen": return sshKeygen(sim, id, args);
    case "telnet": return telnet(sim, id, args, k);
    case "dir": return dir(sim, id, args);
    case "hostname": return { out: (x.host || "PC") + "\n", facts: { cmd: "hostname" } };
    case "getmac": return { out: "\nPhysical Address    Transport Name\n=================== ==========================================================\n" + x.ifaces[0].mac.toUpperCase() + "   " + (sim.addr(id) ? "\\Device\\Tcpip_{" + (hash(id) >>> 0).toString(16).toUpperCase() + "}" : "Media disconnected") + "\n", facts: { cmd: "getmac" } };
    case "cls": return { out: "", clear: true, facts: { cmd: "cls" } };
    case "help": case "?": return { out: "Commands you can use here:\n\n" + HELP.map(function (h) { return "  " + pad(h[0], 38) + h[1]; }).join("\n") + "\n", facts: { cmd: "help" } };
    case "ver": return { out: "\nWindows [Version 10.0.22631]\n", facts: { cmd: "ver" } };
    case "whoami": return { out: (x.host || "pc").toLowerCase() + "\\" + (x.user || "user") + "\n", facts: { cmd: "whoami" } };
    case "exit": return { out: "(This window stays open: it's your terminal for this device.)\n", facts: { cmd: "exit" } };
    default: return { out: "'" + parts[0] + "' is not recognized as an internal or external command,\noperable program or batch file.\nType help to see the commands you can use here.\n", facts: { cmd: "unknown" } };
  }
}
