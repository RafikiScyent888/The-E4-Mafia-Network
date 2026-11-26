/* Level 5, work order 1: time and logs for the whole network. The two services a Linux server runs for the gear: chrony (NTP: the
   server keeps its own time from the internet's pool and, once its file allows them, hands it to the switches and routers) and
   rsyslog (once its file loads UDP reception on port 514, it writes every message a switch or router sends it into /var/log/syslog,
   under the address the message came from, as the real one does with network gear that sends no hostname). And on the gear's side:
   which server a switch or router keeps time from, and whether each line it logs reaches the server it's told to send to. Plain
   functions over the simulation, no page code: tested under Node. A check never changes the network. */
import { isIp, sameSubnet, ip2n } from "./util.js";

export const CHRONY_CONF = "/etc/chrony/chrony.conf";
export const RSYSLOG_CONF = "/etc/rsyslog.conf";
export const SYSLOG = "/var/log/syslog";
/* Ubuntu 24.04's files as they come: chrony from the pool, serving nobody; rsyslog with UDP and TCP reception commented out */
export const CHRONY_DEFAULT = ["# Welcome to the chrony configuration file. See chrony.conf(5) for more", "# information about usable directives.", "",
  "# Include configuration files found in /etc/chrony/conf.d.", "confdir /etc/chrony/conf.d", "",
  "# Use Ubuntu's ntp server as a time source.", "pool ntp.ubuntu.com        iburst maxsources 4", "pool 0.ubuntu.pool.ntp.org iburst maxsources 1", "pool 1.ubuntu.pool.ntp.org iburst maxsources 1", "pool 2.ubuntu.pool.ntp.org iburst maxsources 2", "",
  "# This directive specify the location of the file containing ID/key pairs for", "# NTP authentication.", "keyfile /etc/chrony/chrony.keys", "",
  "# This directive specify the file into which chronyd will store the rate", "# information.", "driftfile /var/lib/chrony/chrony.drift", "",
  "# Save NTS keys and cookies.", "ntsdumpdir /var/lib/chrony", "", "# Uncomment the following line to turn logging on.", "#log tracking measurements statistics", "",
  "# Log files location.", "logdir /var/log/chrony", "", "# Stop bad estimates upsetting machine clock.", "maxupdateskew 100.0", "",
  "# This directive enables kernel synchronisation (every 11 minutes) of the", "# real-time clock. Note that it can't be used along with the 'rtcfile' directive.", "rtcsync", "",
  "# Step the system clock instead of slewing it if the adjustment is larger than", "# one second, but only in the first three clock updates.", "makestep 1 3", "",
  "# Get TAI-UTC offset and leap seconds from the system tz database.", "# This directive must be commented out when using time sources serving", "# leap-smeared time.", "leapsectz right/UTC", ""].join("\n");
export const RSYSLOG_DEFAULT = ["# /etc/rsyslog.conf configuration file for rsyslog", "#", "# For more information install rsyslog-doc and see", "# /usr/share/doc/rsyslog-doc/html/configuration/index.html", "#",
  "# Default logging rules can be found in /etc/rsyslog.d/50-default.conf", "", "", "#################", "#### MODULES ####", "#################", "",
  "module(load=\"imuxsock\") # provides support for local system logging", "#module(load=\"immark\")  # provides --MARK-- message capability", "",
  "# provides UDP syslog reception", "#module(load=\"imudp\")", "#input(type=\"imudp\" port=\"514\")", "",
  "# provides TCP syslog reception", "#module(load=\"imtcp\")", "#input(type=\"imtcp\" port=\"514\")", "",
  "# provides kernel logging support and enable non-kernel klog messages", "module(load=\"imklog\" permitnonkernelfacility=\"on\")", "",
  "###########################", "#### GLOBAL DIRECTIVES ####", "###########################", "", "# Filter duplicated messages", "$RepeatedMsgReduction on", "",
  "#", "# Set the default permissions for all log files.", "#", "$FileOwner syslog", "$FileGroup adm", "$FileCreateMode 0640", "$DirCreateMode 0755", "$Umask 0022", "$PrivDropToUser syslog", "$PrivDropToGroup syslog", "",
  "#", "# Where to place spool and state files", "#", "$WorkDirectory /var/spool/rsyslog", "", "#", "# Include all config files in /etc/rsyslog.d/", "#", "$IncludeConfig /etc/rsyslog.d/*.conf", ""].join("\n");
/* snmptrapd (Level 5, work order 2): Net-SNMP's trap receiver. Its file names the SNMPv3 users it takes notifications from (createUser,
   their keys; an informs sender needs no engine ID, a traps sender does: -e) and what it does with them (authUser log), or the communities
   it takes v1 and v2c from (authCommunity log). It writes each notification it accepts to the system log */
export const TRAPD_CONF = "/etc/snmp/snmptrapd.conf";
export const TRAPD_HEAD = ["###############################################################################", "#", "# EXAMPLE-trap.conf:", "#   An example configuration file for configuring the Net-SNMP snmptrapd agent.", "#", "###############################################################################", "#", "# This file is intended to only be an example.", "# When the snmptrapd agent starts up, this is where it will look for it.", "#", "# All lines beginning with a '#' are comments and are intended for you", "# to read.  All other lines are configuration commands for the agent.", "", "#", "# PLEASE: read the snmptrapd.conf(5) manual page as well!", "#", "#authCommunity log,execute,net private", "#authCommunity log,execute,net public", "#", "## send mail when get any events", "#traphandle default /usr/bin/traptoemail -s smtp.example.org foobar@example.org", "#", "## send mail when get linkDown", "#traphandle .1.3.6.1.6.3.1.1.5.3 /usr/bin/traptoemail -s smtp.example.org foobar@example.org", ""].join("\n");
export function parseTrapd(text) {
  const out = { users: {}, auth: {}, comms: [], noAuthz: false, bad: [] };
  live(text).forEach(function (l) {
    const w = l.match(/"[^"]*"|\S+/g).map(function (t) { return t.replace(/^"|"$/g, ""); }), k = w[0];
    if (k === "createUser") {
      let i = 1, eid = null; if (w[i] === "-e") { eid = (w[i + 1] || "").replace(/^0x/i, "").toUpperCase(); i += 2; }
      const name = w[i++], aa = (w[i] || "").toUpperCase(), ap = w[i + 1], xa0 = (w[i + 2] || "").toUpperCase(), xp = w[i + 3];
      if (!name) { out.bad.push(l); return; }
      const xa = xa0 === "AES" || xa0 === "AES128" ? "AES128" : xa0;
      out.users[name] = { eid: eid, auth: aa && ap ? { alg: aa, pw: ap } : null, priv: xa && xp ? { alg: xa, pw: xp } : null };
    } else if (k === "authUser") { const types = (w[1] || "").split(","), name = w[2]; if (name && types.indexOf("log") >= 0) out.auth[name] = (w[3] || "authNoPriv").toLowerCase(); else out.bad.push(l); }
    else if (k === "authCommunity") { const types = (w[1] || "").split(","); if (w[2] && types.indexOf("log") >= 0) out.comms.push(w[2]); }
    else if (k === "disableAuthorization") out.noAuthz = /^yes$/i.test(w[1] || "");
  });
  return out;
}
export const UNITS = {
  chrony: { desc: "chrony, an NTP client/server", file: "/usr/lib/systemd/system/chrony.service", exe: "/usr/sbin/chronyd", proc: "chronyd", docs: "man:chronyd(8) man:chronyc(1) man:chrony.conf(5)", conf: CHRONY_CONF },
  snmptrapd: { desc: "Simple Network Management Protocol (SNMP) Trap Daemon.", file: "/usr/lib/systemd/system/snmptrapd.service", exe: "/usr/sbin/snmptrapd -LOw -f -p /run/snmptrapd.pid", proc: "snmptrapd", docs: "man:snmptrapd(8)", conf: TRAPD_CONF },
  rsyslog: { desc: "System Logging Service", file: "/usr/lib/systemd/system/rsyslog.service", exe: "/usr/sbin/rsyslogd -n -iNONE", proc: "rsyslogd", docs: "man:rsyslogd(8) man:rsyslog.conf(5) https://www.rsyslog.com/doc/", conf: RSYSLOG_CONF }
};

/* ------------------------------------------------------------ reading the two files, as each service does when it starts */
const live = function (t) { return String(t || "").split("\n").map(function (l) { return l.replace(/#.*$/, "").trim(); }).filter(Boolean); };
/* chrony: its time sources (pool or server lines) and who it serves (allow, with or without a network; deny) */
export function parseChrony(text) {
  const out = { sources: [], allow: [], deny: [], bad: [] };
  live(text).forEach(function (l, i) {
    const w = l.split(/\s+/), k = w[0].toLowerCase();
    if (k === "pool" || k === "server" || k === "peer") { if (w[1]) out.sources.push(w[1]); else out.bad.push(l); }
    else if (k === "allow" || k === "deny") { const net = w[1] || "all", ok = net === "all" || cidr(net); if (!ok) out.bad.push(l); else out[k].push(net); }
  });
  return out;
}
/* "10.63.0.0/16", "10.63.199" (chrony takes a partial address as its network), or one address */
export function cidr(s) {
  const m = /^(\d+(?:\.\d+){0,3})(?:\/(\d+))?$/.exec(String(s)); if (!m) return null;
  const parts = m[1].split(".").map(Number); if (parts.some(function (p) { return p > 255; })) return null;
  const bits = m[2] != null ? +m[2] : parts.length * 8; if (bits > 32) return null;
  while (parts.length < 4) parts.push(0);
  return { net: parts.join("."), bits: bits };
}
export function inNet(ip, net) {
  if (net === "all") return true; const c = cidr(net); if (!c || !isIp(ip)) return false;
  const mask = c.bits ? (0xffffffff << (32 - c.bits)) >>> 0 : 0; return ((ip2n(ip) & mask) >>> 0) === ((ip2n(c.net) & mask) >>> 0);
}
/* rsyslog: the network reception it loads, the new way (module and input) or the old ($ModLoad and $UDPServerRun) */
export function parseRsyslog(text) {
  const L = live(text), out = { udp: null, tcp: null, mods: {} };
  L.forEach(function (l) {
    const mod = /^module\(\s*load\s*=\s*"(\w+)"/i.exec(l), inp = /^input\(\s*type\s*=\s*"(\w+)"(?:.*?port\s*=\s*"(\d+)")?/i.exec(l), old = /^\$ModLoad\s+(\w+)/i.exec(l);
    if (mod) out.mods[mod[1].toLowerCase()] = true;
    if (old) out.mods[old[1].toLowerCase()] = true;
    if (inp) { const t = inp[1].toLowerCase(); if (out.mods[t]) out[t === "imudp" ? "udp" : t === "imtcp" ? "tcp" : "x"] = +(inp[2] || 514); else out.unloaded = t; }
    const ur = /^\$UDPServerRun\s+(\d+)/i.exec(l); if (ur && out.mods.imudp) out.udp = +ur[1];
    const tr = /^\$InputTCPServerRun\s+(\d+)/i.exec(l); if (tr && out.mods.imtcp) out.tcp = +tr[1];
  });
  return out;
}

/* ------------------------------------------------------------ a server's services */
export function svcOf(sim, id, unit) { const x = sim.d[id]; return x && x.lx && x.lx.svc ? x.lx.svc[unit] || null : null; }
const fileOf = function (sim, id, path) { const F = (sim.d[id].lx && sim.d[id].lx.files) || {}; return F[path] ? F[path].text : null; };
/* what a service runs with: its file as it read it when it last started */
export function startRun(sim, id, unit) {
  const t = fileOf(sim, id, UNITS[unit].conf) || "";
  return unit === "chrony" ? Object.assign({ text: t }, parseChrony(t)) : unit === "snmptrapd" ? Object.assign({ text: t }, parseTrapd(t)) : Object.assign({ text: t }, parseRsyslog(t));
}
/* the server's own clock source: chrony running, with a pool or a server, and the internet reachable from the server */
export function serverSynced(sim, id) {
  const S = svcOf(sim, id, "chrony"); if (!S || S.state !== "active" || !S.run || !S.run.sources.length || !sim.on(id)) return false;
  const r = sim.route(id, "8.8.8.8"); return !!(r && !r.fail && (r.internet || r.routed || r.local));
}
/* does chrony on this server hand time to a client at this address? (allow lines, then deny; nothing allowed: nobody) */
export function chronyServes(sim, id, src) {
  const S = svcOf(sim, id, "chrony"); if (!S || S.state !== "active" || !S.run) return false;
  return S.run.allow.some(function (n) { return inNet(src, n); }) && !S.run.deny.some(function (n) { return inNet(src, n); });
}
export function rsyslogUdp(sim, id) { const S = svcOf(sim, id, "rsyslog"); return !!S && S.state === "active" && !!S.run && S.run.udp === 514; }
/* the server at an address (a computer with services), or null */
export function serverAt(sim, ip) { for (const id in sim.d) { const x = sim.d[id]; if (x.kind !== "server" || !x.lx || !x.lx.svc) continue; if (x.ifaces.some(function (f) { return f.cfg && f.cfg.ip === ip; })) return id; } return null; }

/* ------------------------------------------------------------ the gear's side */
/* the path from a switch or router to an address: whether it gets there and back, and the address its packets leave from */
export function pathFrom(sim, dev, ip) {
  const r = sim.route(dev, ip); if (!r || r.fail) return { ok: false, why: r ? r.fail : "no-route" };
  const owner = r.owner && r.owner[0]; return { ok: !!owner && (r.local || r.routed), owner: owner, src: (r.addr && r.addr.ip) || r.src || null };
}
/* a switch's or router's NTP: the first server it's told to use that answers with time; or why none does */
export function ntpState(sim, dev) {
  const sw = sim.d[dev] && sim.d[dev].sw, list = (sw && sw.ntp) || [];
  if (!list.length) return { synced: false, servers: [], why: "none" };
  const tried = list.map(function (ip) {
    const p = pathFrom(sim, dev, ip); if (!p.ok) return { ip: ip, why: "unreachable" };
    const srv = sim.d[p.owner] && sim.d[p.owner].kind === "server" ? p.owner : null, ch = srv ? svcOf(sim, srv, "chrony") : null;
    if (!ch || ch.state !== "active") return { ip: ip, why: "no-ntp" };   /* no chrony there, or stopped: nothing answers on port 123 */
    if (!chronyServes(sim, srv, p.src)) return { ip: ip, why: "refused", srv: srv, src: p.src };
    if (!serverSynced(sim, srv)) return { ip: ip, why: "unsynced", srv: srv, src: p.src };
    return { ip: ip, ok: true, srv: srv, src: p.src };
  });
  const good = tried.find(function (t) { return t.ok; });
  return good ? { synced: true, ref: good.ip, srv: good.srv, src: good.src, stratum: 3, servers: tried } : { synced: false, servers: tried, why: tried[0].why };
}
/* one line a switch or router sends to a log host: it lands in the server's syslog if the host is a server whose rsyslog takes UDP 514
   and the path is there both ways. The server writes the time it got it and the address it came from (no hostname in the message) */
export function deliver(sim, dev, host, line, k) {
  const p = pathFrom(sim, dev, host); if (!p.ok) return false;
  const srv = p.owner; if (!srv || sim.d[srv].kind !== "server" || !rsyslogUdp(sim, srv)) return false;
  const x = sim.d[srv], L = x.lx.syslog || (x.lx.syslog = []);
  L.push((k ? k.day + " " + k.hms : "Nov 22 10:42:07") + " " + p.src + " " + line); if (L.length > 400) L.splice(0, L.length - 400);
  return true;
}
/* has anything from this device reached this server's syslog? (by the address it sends from) */
export function arrivedFrom(sim, srv, src) { const L = (sim.d[srv].lx && sim.d[srv].lx.syslog) || []; return !!src && L.some(function (l) { return l.split(" ")[3] === src; }); }
