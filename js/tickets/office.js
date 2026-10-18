/* Tier 2 tickets: the small office (level 2). Each one starts from the
   office as the work orders left it (the managed switch named, locked, on
   the office's address with SSH only, its ports described and the spares
   shut, the warning banner, everything saved), then plants its fault the way
   it really got there: someone at the switch's console, a power cut. As on
   the home tickets: exhibits proves the fault shows; six options, one right
   and five near misses, each wrong one with its reason; the fix must be at
   the source and saved (a fix that only lives in the running configuration
   works today and Mason says so); the proof is something a student runs. */
import { OFFICE_JOBS } from "../build/office.js";
import { online } from "../build/jobs.js";
import { exec } from "../net/cmd.js";
import * as SW from "../net/swcli.js";
import { rng, hash, mac, ip2n, n2ip } from "../net/util.js";
import { checkSheet, sheetRows, usableIn, prefixOf } from "../net/ipam.js";
import { OFFICE_RUN } from "../net/office.js";
import { SFP_MODULES } from "../net/sim.js";

const SO5 = OFFICE_JOBS.find(function (d) { return d.id === "SO-J5"; });
const PC_PORT = "GigabitEthernet0/2", PR_PORT = "GigabitEthernet0/3";
/* the office as the work orders left it, on a day like any other: nobody logged in, the TFTP server closed */
function settled(seed) {
  const b = SO5.start(seed), sim = b.sim;
  for (const a of SO5.solve(b.v)) { if (a.t === "cmd") exec(sim, a.dev, a.line, a.win); else sim.apply(a); }
  sim.cli = {}; sim.lastTrace = null; sim.d.tech.tftp.on = false; sim.net.extra.build = false;   /* a ticket keeps its moment frozen */
  return { sim: sim, plan: b.v.plan };
}
/* lines typed at the switch's console by whoever caused the fault (privileged, no password asked) */
function onSwitch(sim, lines) {
  const S = SW.session(sim.d.msw.sw, { via: "console" }); S.mode = "priv"; S.pending = null; S.fresh = false;
  lines.forEach(function (l) { SW.exec(S, l); });
}
const SAVE = ["copy running-config startup-config", ""];
const SW_ = function (sim) { return sim.d.msw.sw; };
/* what a switch command printed, whichever terminal typed it (your laptop's console, or SSH from a computer) */
const swOut = function (f) { return (f.cmd === "serial" || f.cmd === "ssh" || f.cmd === "telnet") && typeof f.out === "string" ? f.out : ""; };
/* one interface's block in a show interfaces listing */
const block = function (out, n) { const i = out.indexOf(n + " is "); if (i < 0) return ""; const rest = out.slice(i + n.length), j = rest.search(/\nGigabitEthernet0\/\d+ is /); return out.slice(i, j < 0 ? out.length : i + n.length + j); };
const printOk = function (sim) { const ip = sim.d.printer.ifaces[0].cfg.ip, r = sim.route("pc", ip); return !!(r.local && r.owner.indexOf("printer") >= 0); };
const spareLive = function (sw) { return SW.PORT_NAMES.filter(function (n) { return n !== "GigabitEthernet0/1" && n !== PC_PORT && n !== PR_PORT && !sw.ports[n].shutdown; }); };

/* ---------------------------------------------------------------- SO-01 */
const SO01 = {
  id: "SO-01", n: "01", level: 2, tier: "common", title: "Printing is slow and sometimes fails", priority: 3, due: "4 h",
  build(seed) {
    const B = settled(seed), r = rng(hash("SO-01:" + seed)), kind = r.pick(["auto", "half"]);
    onSwitch(B.sim, ["configure terminal", "interface gi0/3"].concat(kind === "auto" ? ["no speed", "no duplex"] : ["duplex half"], ["end"], SAVE));
    return { sim: B.sim, v: { kind: kind, plan: B.plan, printer: B.sim.d.printer.ifaces[0].cfg.ip } };
  },
  brief(v) {
    return { quote: "Printing crawls again. A page can take a minute to come out, and every so often one never does. " + (v.kind === "auto" ? "The engineer who serviced the printer on Thursday said he'd \"put its switch port back to the defaults\" while he was here." : "My nephew read that old printers prefer half duplex, so he changed the printer's switch port for us last week.") };
  },
  mason: "Look twice before you change anything: errors that climb are the clue.",
  affected: "pc",
  options() {
    return [
      { id: "right", right: true, text: "The printer's switch port and the printer disagree on duplex: the printer is fixed at full, the port runs half" },
      { id: "cable", text: "The printer's patch cable is damaged", why: "A damaged cable shows as CRC errors at both ends, or no link. Late collisions climb only on a half-duplex port, and that's what show interfaces shows here." },
      { id: "shut", text: "The printer's switch port is shut down", why: "The link is up: show interfaces status says connected. A shut port would say disabled, and nothing would print at all." },
      { id: "speed", text: "The printer's port is forced to a speed the printer can't run at", why: "A speed the far end can't match drops the link altogether. This link is up at 100 Mb/s: it's the duplex that's wrong." },
      { id: "spool", text: "The print queue on the front desk PC is stuck", why: "A stuck queue would hold every page. Some pages print, the pings from the PC to the printer lose packets too, and the switch counts errors on the printer's port." },
      { id: "conflict", text: "Another device has the printer's IP address", why: "arp -a on the front desk PC shows the printer's own hardware address, and the losses follow the errors on the printer's port, not a second device." }
    ];
  },
  rung1() { return "On the switch: show interfaces on the printer's port, twice, and read the duplex line and the late collisions. Then the printer's own control panel: how does its network card run?"; },
  rung2() { return "Negotiation needs both ends to take part. When one end is fixed, the other can sense its speed but not its duplex, and falls back to half. Late collisions happen only on a half-duplex port facing one running full."; },
  fixHints() { return ["The printer's network card is fixed and can't negotiate: the switch's end has to be set to match it.", "Set the printer's switch port by hand to the printer's own speed and duplex, then look at show interfaces twice: the late collisions should stop climbing.", "Save it, or the next power cut brings it back."]; },
  exhibits(sim, v) { return sim.mismatched("printer") && printOk(sim); },
  fixed(sim) {
    const sw = SW_(sim), l = sim.switchLinks("msw")[PR_PORT], sp = sw.startup && sw.startup.ports[PR_PORT];
    return !sim.mismatched("printer") && !!l && !!sp && !sp.shutdown && !SW.duplexEnds(sp, l).mismatch && printOk(sim);
  },
  partial() { return "It runs right now, but the switch hasn't saved it: the next power cut or reload puts the printer's port back the way it was."; },
  proves(f, sim, v) { return (f.print === "ok" && !f.slow) || (f.cmd === "ping" && f.dev === "pc" && f.ip === v.printer && f.sent >= 4 && f.replies === f.sent); },
  proofText: "a test page that prints at once, or a ping from the front desk PC to the printer with nothing lost",
  evidence: [
    { id: "int", test: function (f) { const b = block(swOut(f), PR_PORT); return /Half-duplex/.test(b) && /[1-9]\d* late collision/.test(b); }, text: function () { return "show interfaces gi0/3, the printer's port: up, Half-duplex, 100Mb/s, late collisions counted"; } },
    { id: "status", test: function (f) { return /^Gi0\/3\s.*\b(a-)?half\b/m.test(swOut(f)); }, text: function () { return "show interfaces status: Gi0/3, the printer's port, is connected at half duplex"; } },
    { id: "run", test: function (f) { return /interface GigabitEthernet0\/3\n/.test(swOut(f)) && /Building configuration|Current configuration/.test(swOut(f)); }, text: function (f, v) { return "show running-config: the printer's port " + (v.kind === "auto" ? "has no speed or duplex set: it negotiates" : "is set to duplex half"); } },
    { id: "panel", test: function (f) { return f.page === "printer-panel"; }, text: function () { return "The printer's control panel: its network card is fixed at 100 Mb/s, full duplex, and can't negotiate"; } },
    { id: "ping", test: function (f, v) { return f.cmd === "ping" && f.dev === "pc" && f.ip === v.printer && f.replies < f.sent; }, text: function (f) { return "Ping from the front desk PC to the printer: " + f.loss + "% of the packets lost"; } },
    { id: "print", test: function (f) { return f.print === "fail" || (f.print === "ok" && f.slow); }, text: function (f) { return "Test page: " + (f.print === "fail" ? "nothing came out" : "it printed, but took over a minute"); } }
  ],
  summary(v) {
    return { cause: (v.kind === "auto" ? "The printer's switch port had been put back to negotiate. The printer's old card is fixed at 100 Mb/s full duplex and can't negotiate, so the port sensed the speed and fell back to half duplex." : "The printer's switch port had been forced to half duplex; the printer runs full.") + " The two ends disagreed: late collisions on the switch's side, lost frames, slow and failed pages.",
      fix: "Set the printer's port to 100 Mb/s, full duplex, by hand, to match the printer, and saved it." };
  }
};

/* ---------------------------------------------------------------- SO-02 */
const SO02 = {
  id: "SO-02", n: "02", level: 2, tier: "common", title: "One desk has no network", priority: 2, due: "2 h",
  build(seed) {
    const B = settled(seed), r = rng(hash("SO-02:" + seed)), kind = r.pick(["list", "tidy"]);
    onSwitch(B.sim, ["configure terminal", "interface gi0/2", "shutdown", "end"].concat(SAVE));
    return { sim: B.sim, v: { kind: kind, plan: B.plan, pcCable: B.sim.cablesOf("pc")[0].id } };
  },
  brief(v) {
    return { quote: "The front desk computer has had no network since this morning. Everything else in the office is fine: the printer prints from the manager's laptop. " + (v.kind === "list" ? "On Saturday I went through our insurer's checklist and shut the switch ports it said were spare, typing them in from the list." : "Our weekend cleaner says she didn't touch anything, but I did see someone at the closet laptop on Saturday.") };
  },
  mason: "Ask the switch what it thinks of the port before you touch the cable.",
  affected: "pc",
  options() {
    return [
      { id: "right", right: true, text: "The front desk PC's switch port has been shut down on the switch" },
      { id: "cable", text: "The front desk PC's patch cable has come unplugged", why: "Its plugs are clicked in at both ends. The switch says the port is administratively down, not notconnect: the switch itself has been told to shut it." },
      { id: "nic", text: "The front desk PC's network adapter has failed", why: "show interfaces status says disabled: the switch's end is off. A failed adapter would leave the port on but notconnect." },
      { id: "speed", text: "The PC's switch port is forced to a speed the PC can't match", why: "A speed mismatch leaves the port on but notconnect. This one is disabled: shut down." },
      { id: "dhcp", text: "The office router's DHCP server has stopped", why: "With no DHCP the PC would give itself a 169.254 address. It has no link at all: ipconfig says Media disconnected." },
      { id: "switch", text: "The managed switch has failed", why: "The router and the printer still have links through it, and it answers on its console." }
    ];
  },
  rung1() { return "On the front desk PC: ipconfig. Then on the switch: show interfaces status, and find the PC's port by its description."; },
  rung2() { return "A switch port has a state of its own. notconnect means no link from the far end; disabled means the switch has been told to shut the port. Start from what the switch says."; },
  fixHints() { return ["The front desk PC's port is the one described as the front desk's.", "Bring back only that port: the spare ports were shut on purpose and stay shut.", "Save it, or the next power cut shuts the desk out again."]; },
  exhibits(sim) { return !sim.hasLink("pc") && SW_(sim).ports[PC_PORT].shutdown && sim.hasLink("printer"); },
  fixed(sim) {
    const sw = SW_(sim), sp = sw.startup && sw.startup.ports[PC_PORT];
    return online(sim, "pc") && !sw.ports[PC_PORT].shutdown && !!sp && !sp.shutdown && spareLive(sw).length === 0 && spareLive(Object.assign({}, sw, { ports: sw.startup.ports })).length === 0;
  },
  partial(v, sim) { return spareLive(SW_(sim)).length ? "The desk is back, but spare ports are live again: anyone in the office could plug something into them." : "It's back for now, but the switch hasn't saved it: the next power cut shuts the desk's port again."; },
  proves(f) { return f.cmd === "ping" && f.dev === "pc" && f.beyond; },
  proofText: "a ping from the front desk PC that gets replies from something else",
  evidence: [
    { id: "ipc", test: function (f) { return f.cmd === "ipconfig" && f.dev === "pc" && f.media === "disconnected"; }, text: function () { return "ipconfig on the front desk PC: Media disconnected (no link)"; } },
    { id: "status", test: function (f) { return /^Gi0\/2\s.*\bdisabled\b/m.test(swOut(f)); }, text: function () { return "show interfaces status: Gi0/2, the front desk PC's port, is disabled"; } },
    { id: "int", test: function (f) { return /GigabitEthernet0\/2 is administratively down/.test(swOut(f)); }, text: function () { return "show interfaces gi0/2: administratively down"; } },
    { id: "lights", test: function (f) { return f.page === "msw-lights" && f.ports.some(function (p) { return p.port === 2 && !p.up; }); }, text: function () { return "The switch's lights: port 2 (the front desk PC) is off; ports 1 and 3 are on"; } },
    { id: "look", test: function (f, v) { return f.phys === "look" && f.cable === v.pcCable; }, text: function () { return "Looked at the front desk PC's cable: clicked in at that end"; } }
  ],
  summary(v) {
    return { cause: "The front desk PC's switch port had been shut down" + (v.kind === "list" ? ", typed in from the insurer's list of spare ports by mistake" : "") + ", and the change saved.", fix: "Brought just that port back up (no shutdown), left the spare ports shut, and saved." };
  }
};

/* ---------------------------------------------------------------- SO-03 */
const USERS = [["maya", "Maya", "Front-Desk#26"], ["jordan", "Jordan", "Closet!Key8"], ["sam", "Sam", "Rack#Mount3"], ["ola", "Ola", "Uplink*44"]];
const SO03 = {
  id: "SO-03", n: "03", level: 2, tier: "common", title: "Monday: Friday's switch changes are gone", priority: 3, due: "4 h",
  build(seed) {
    const B = settled(seed), r = rng(hash("SO-03:" + seed)), kind = r.pick(["user", "addr"]), sim = B.sim, p = B.plan;
    const u = r.pick(USERS), host = r.pick([5, 6, 8, 9, 240, 241].filter(function (h) { return sim.net.prefix + "." + h !== p.ip; })), newIp = sim.net.prefix + "." + host;   /* a new address, never the one it's on */
    /* Friday: the change made at the console, and never saved */
    onSwitch(sim, ["configure terminal"].concat(kind === "user" ? ["username " + u[0] + " secret " + u[2]] : ["interface vlan 1", "ip address " + newIp + " " + p.mask], ["end"]));
    /* Sunday: the power cut. Monday morning: it has been up since */
    sim.apply({ t: "power", dev: "msw" }); sim.cli = {};
    SW_(sim).uptimeFixed = "1 day, 9 hours, 14 minutes";
    return { sim: sim, v: { kind: kind, plan: p, user: u[0], who: u[1], pw: u[2], newIp: newIp } };
  },
  brief(v) {
    const notes = v.kind === "user" ? "Friday's IT notes: \"Added a switch login for " + v.who + ", the new office manager: user " + v.user + ", secret " + v.pw + ".\"" : "Friday's IT notes: \"Moved the switch's management address to " + v.newIp + " (mask " + v.plan.mask + "), as on the new address plan.\"";
    return { quote: (v.kind === "user" ? v.who + " can't log in to the switch from the front desk: it says permission denied." : "The new monitoring says the switch is down: nothing answers at its address.") + " The power went off for a few hours on Sunday. " + notes };
  },
  mason: "Compare what was done with what's there. Then ask the switch when it last started, and why.",
  records(v) { if (v.kind !== "addr") return null; const p = v.plan; return [["The switch", p.hostname + " · management address " + v.newIp + ", mask " + p.mask + " (the new address plan, from Friday) · gateway " + p.gw], ["Console password", p.console], ["Enable secret", p.secret], ["Remote logins (SSH)", "user " + p.user + " · password " + p.userPw]]; },
  affected: "pc",
  options(v) {
    return [
      { id: "right", right: true, text: "Friday's change was never saved, so Sunday's power cut brought back the configuration saved before it" },
      { id: "undone", text: "Someone undid Friday's change over the weekend", why: "show version says the switch came back from a power cut, and the saved configuration never had Friday's change in it." },
      { id: "factory", text: "The switch was reset to its factory settings", why: "Its name, passwords, address and SSH are all still there: only Friday's change is missing." },
      { id: "memory", text: "The switch's memory failed and lost part of its configuration", why: "The saved configuration is intact, exactly as it was last saved. Nothing is corrupt: Friday's change was never in it." },
      { id: "reload", text: "Friday's change needs a reload before it takes effect", why: "Changes on the switch take effect the moment they're typed. A restart is exactly what removed this one." },
      v.kind === "user" ? { id: "pw", text: v.who + " is typing the password wrong", why: "show running-config has no such user at all: there's no password to get wrong." }
        : { id: "pcnet", text: "The front desk PC has moved to another network", why: "The front desk PC still reaches the router and the printer, and the switch answers on its old address." }
    ];
  },
  rung1() { return "On the switch: show version (how long it's been up, and what brought it back). Then compare Friday's notes with show running-config and show startup-config."; },
  rung2() { return "A change on a switch takes effect at once, in the running configuration, which lives in memory and is lost when the power goes. Only what was copied to the startup configuration comes back."; },
  fixHints() { return ["Friday's notes in the ticket say exactly what was changed.", "Make the change again, then check it works from the front desk PC.", "Save it this time."]; },
  exhibits(sim, v) { const sw = SW_(sim); return sw.restart === "power-on" && (v.kind === "user" ? !sw.users[v.user] : sw.vlan1.ip === v.plan.ip); },
  fixed(sim, v) {
    const sw = SW_(sim), st = sw.startup;
    if (v.kind === "user") return sw.users[v.user] === v.pw && !!st && st.users[v.user] === v.pw;
    const r = sim.route("pc", v.newIp);
    return sw.vlan1.ip === v.newIp && !!st && st.vlan1.ip === v.newIp && !!(r.local && r.owner.indexOf("msw") >= 0);
  },
  partial() { return "It works now, but it isn't saved: the next power cut takes it away again, exactly as Sunday's did."; },
  proves(f, sim, v) { return v.kind === "user" ? (f.cmd === "ssh" && f.login && f.user === v.user) : ((f.cmd === "ping" && f.dev === "pc" && f.ip === v.newIp && f.replies > 0) || (f.cmd === "ssh" && f.login && f.host === v.newIp)); },
  proofText: "an SSH login as the new user, or a ping or SSH login to the switch's new address, from the front desk PC",
  evidence: [
    { id: "ver", test: function (f) { return /System returned to ROM by power-on/.test(swOut(f)); }, text: function () { return "show version: up 1 day, 9 hours; it came back from a power cut (power-on)"; } },
    { id: "startup", test: function (f) { return /hostname /.test(swOut(f)) && /^\s*(do\s+)?sh\S*\s+st/i.test(f.line || ""); }, text: function (f, v) { return "show startup-config: " + (v.kind === "user" ? "no username " + v.user : "VLAN 1 still on the old address"); } },
    { id: "running", test: function (f) { return /hostname /.test(swOut(f)) && /^\s*(do\s+)?sh\S*\s+r/i.test(f.line || ""); }, text: function (f, v) { return "show running-config: " + (v.kind === "user" ? "no username " + v.user + " either" : "VLAN 1 on the old address, not " + v.newIp); } },
    { id: "denied", test: function (f, v) { return v.kind === "user" && f.cmd === "ssh" && (f.denied || /Permission denied/.test(f.out || "")); }, text: function (f, v) { return "ssh as " + v.user + " from the front desk PC: permission denied"; } },
    { id: "noping", test: function (f, v) { return v.kind === "addr" && f.cmd === "ping" && f.ip === v.newIp && !f.replies; }, text: function (f, v) { return "Ping to " + v.newIp + " from the front desk PC: no reply"; } },
    { id: "brief", test: function (f) { return /Vlan1\s+\d/.test(swOut(f)); }, text: function () { return "show ip interface brief: VLAN 1 is on the switch's old address"; } }
  ],
  summary(v) {
    return { cause: "Friday's change (" + (v.kind === "user" ? "the login for " + v.who : "the new management address") + ") went into the running configuration and was never saved. Sunday's power cut brought the switch back on its startup configuration, from before Friday.", fix: "Made Friday's change again from the notes, checked it from the front desk PC, and saved it with copy running-config startup-config." };
  }
};

/* ---------------------------------------------------------------- SO-05 */
const SO05 = {
  id: "SO-05", n: "05", level: 2, tier: "common", title: "Can't SSH to the switch", priority: 3, due: "4 h",
  build(seed) {
    const B = settled(seed), r = rng(hash("SO-05:" + seed)), kind = r.pick(["nokeys", "telnet", "lines"]), sim = B.sim, sw = SW_(sim);
    if (kind === "nokeys") { sw.rsa = 0; sw.startup.rsa = 0; }   /* a replacement switch loaded from the backup: keys don't travel in a configuration file */
    else if (kind === "telnet") onSwitch(sim, ["configure terminal", "line vty 0 15", "transport input telnet", "end"].concat(SAVE));
    else onSwitch(sim, ["configure terminal", "line vty 0 15", "password " + r.pick(["Remote99!", "Vty-Pass7", "LetMeIn#2"]), "login", "end"].concat(SAVE));
    return { sim: sim, v: { kind: kind, plan: B.plan } };
  },
  brief(v) {
    return { quote: "Nobody can SSH to the closet switch from the front desk any more. " + { nokeys: "It failed on Thursday and the supplier swapped it under warranty on Friday; their engineer loaded our saved configuration from the backup onto the new one.", telnet: "A contractor was in on Friday \"sorting out remote access\" for his monitoring tool.", lines: "My nephew was in the switch on Friday: he said he'd \"made the remote login simpler\"." }[v.kind] };
  },
  mason: "Read exactly what comes back. Refused and denied are different answers.",
  affected: "pc",
  options(v) {
    const R = {
      nokeys: { id: "nokeys", text: "The switch has no RSA keys, so it has nothing to offer SSH with", why: "show ssh says SSH is enabled: the switch has its keys." },
      telnet: { id: "telnet", text: "The remote lines take only Telnet, so the switch refuses SSH", why: "show running-config: line vty 0 15 has transport input ssh." },
      lines: { id: "lines", text: "The remote lines check a line password instead of the office's user names", why: "show running-config: line vty 0 15 has login local." }
    };
    const out = ["nokeys", "telnet", "lines"].map(function (k) { return k === v.kind ? { id: "right", right: true, text: R[k].text } : R[k]; });
    return out.concat([
      { id: "fw", text: "The front desk PC's firewall is blocking SSH", why: "The switch answers: the connection is " + (v.kind === "lines" ? "taken and the login denied" : "refused") + " by the switch itself, not dropped on the way." },
      { id: "addr", text: "The switch's management address has changed", why: "Ping from the front desk PC reaches the switch at its address, and SSH gets an answer from it." },
      { id: "pw", text: "The office user's password has been changed", why: v.kind === "lines" ? "show running-config still has the office's user with its secret: the remote lines aren't checking user names at all." : "The connection is refused before any password is asked: a password can't be the problem." }
    ]);
  },
  rung1() { return "From the front desk PC: ssh as the office's user, and read exactly what comes back. Then, on your laptop's console: show running-config (the vty lines) and show ssh."; },
  rung2() { return "SSH needs three things on the switch: keys to encrypt with, remote lines that accept SSH, and those lines checking the office's user names. Refused means the switch won't talk SSH at all; denied means it talked, but didn't accept the login."; },
  fixHints() { return ["Work on the switch from your laptop's console: the console doesn't need SSH.", "Fix the one thing the switch is missing, then try ssh again from the front desk PC.", "Save it, and check Telnet is still refused."]; },
  exhibits(sim, v) { const sw = SW_(sim); return v.kind === "nokeys" ? !sw.rsa : v.kind === "telnet" ? sw.vty.transport === "telnet" : sw.vty.login === "password"; },
  fixed(sim, v) {
    const sw = SW_(sim), st = sw.startup, p = v.plan, r = sim.route("pc", p.ip);
    const ok = function (c) { return c.rsa >= 768 && c.vty.transport === "ssh" && c.vty.login === "local" && c.users[p.user] === p.userPw; };
    return ok(sw) && !!st && ok(st) && !!(r.local && r.owner.indexOf("msw") >= 0);
  },
  partial(v, sim) { const sw = SW_(sim); return /^(telnet|all)$/.test(sw.vty.transport) ? "SSH works, but the remote lines still take Telnet too: passwords cross the office in the clear. The office's policy is SSH only." : "SSH works now, but the switch hasn't saved it: after the next power cut it's back to how it was."; },
  proves(f) { return f.cmd === "ssh" && f.dev === "pc" && f.login; },
  proofText: "an SSH login from the front desk PC with the office's user name",
  evidence: [
    { id: "refused", test: function (f) { return f.cmd === "ssh" && f.dev === "pc" && f.why === "refused"; }, text: function () { return "ssh from the front desk PC: Connection refused (the switch won't talk SSH)"; } },
    { id: "denied", test: function (f) { return f.cmd === "ssh" && f.dev === "pc" && f.denied; }, text: function () { return "ssh from the front desk PC: the switch asks for a password, then Permission denied for the office's user"; } },
    { id: "ping", test: function (f, v) { return f.cmd === "ping" && f.dev === "pc" && f.ip === v.plan.ip && f.replies > 0; }, text: function () { return "Ping from the front desk PC reaches the switch's management address"; } },
    { id: "showssh", test: function (f) { return /SSH has not been enabled|No SSHv2 server connections/.test(swOut(f)); }, text: function (f) { return "show ssh: " + (/not been enabled/.test(swOut(f)) ? "SSH has not been enabled: no RSA keys" : "SSH is enabled"); } },
    { id: "vty", test: function (f) { return /line vty 0 15/.test(swOut(f)); }, text: function (f, v, sim) { const t = SW_(sim).vty; return "show running-config, line vty 0 15: " + (t.login === "local" ? "login local" : t.login ? "login (a line password)" : "no login") + ", transport input " + t.transport; } },
    { id: "telnet", test: function (f) { return f.cmd === "telnet" && f.dev === "pc" && f.ok; }, text: function () { return "telnet from the front desk PC: the switch accepts it"; } }
  ],
  summary(v) {
    return { cause: { nokeys: "The replacement switch had no RSA keys: keys aren't part of a configuration file, so loading the saved configuration brought back everything except them, and with no keys there is no SSH.", telnet: "The remote (vty) lines had been set to take Telnet only, so the switch refused SSH.", lines: "The remote (vty) lines had been changed from login local to a line password, so they no longer checked the office's user names: every SSH login was denied." }[v.kind],
      fix: { nokeys: "Generated RSA keys (2048 bits) on the switch from the console, checked SSH from the front desk PC, and saved.", telnet: "Set the vty lines back to transport input ssh, checked SSH (and that Telnet is refused), and saved.", lines: "Set the vty lines back to login local, checked SSH with the office's user, and saved." }[v.kind] };
  }
};

/* ---------------------------------------------------------------- SO-04 */
/* the back office (what was the meeting room): an old 10/100 switch whose ports are fixed MDI-X (no auto-MDIX), cabled back
   to the closet switch's port 5 with a straight-through patch run, and a desk on it */
function backOffice(sim, r) {
  const d = sim.d, net = sim.net;
  d.meet = { id: "meet", kind: "switch", label: "Back office switch", sub: "unmanaged, 10/100", on: true, ports: 5, mdix: false, maxMbps: 100,
    print: ["UNMANAGED 5-PORT FAST ETHERNET SWITCH", "UNMANAGED 5-PORT FAST ETHERNET SWITCH · MODEL: FS-105", "10/100 Mbps · MDI-X ports (no auto-MDIX) · 5V ⎓ 1A"], labelText: "10/100 Mbps, MDI-X ports (no auto-MDIX)" };
  d.mpc = { id: "mpc", kind: "pc", label: "Back office PC", sub: "DHCP", on: true, os: "windows", user: "backoffice", host: "BACKOFFICE-PC", printer: { name: "Office printer", port: d.pc.printer.port },
    ifaces: [{ name: "Ethernet", type: "eth", port: "NIC", mac: mac(r), desc: "Gigabit Network Connection", cfg: { mode: "dhcp", dnsMode: "auto" }, lease: null, apipa: null }] };
  net.rooms.meet = "meeting"; net.rooms.mpc = "meeting"; sim.arp.meet = {}; sim.arp.mpc = {};
  net.cables.push({ id: "c-back-up", kind: "cat6", a: { dev: "msw", port: "5", seated: true }, b: { dev: "meet", port: "1", seated: true }, cond: "good", length: OFFICE_RUN.closet.meeting });
  net.cables.push({ id: "c-back-pc", kind: "cat6", a: { dev: "meet", port: "2", seated: true }, b: { dev: "mpc", port: "NIC", seated: true }, cond: "good", length: 3 });
}
const SO04 = {
  id: "SO-04", n: "04", level: 2, tier: "common", title: "The back office's new switch won't link", priority: 3, due: "4 h",
  build(seed) {
    const B = settled(seed), r = rng(hash("SO-04:" + seed)), kind = r.pick(["port", "template"]), sim = B.sim;
    backOffice(sim, r);
    onSwitch(sim, ["configure terminal"].concat(kind === "template" ? ["interface range gi0/1 - 24", "no mdix auto"] : [], ["interface gi0/5", "description BACK-OFFICE", "no shutdown"], kind === "port" ? ["no mdix auto"] : [], ["end"], SAVE));
    sim.dhcp("mpc", "boot");   /* it asks, and nothing answers: 169.254 */
    return { sim: sim, v: { kind: kind, plan: B.plan } };
  },
  brief(v) {
    return { quote: "We've turned the meeting room into a back office: a little switch in there for a desk and the conference phone, cabled back to the closet. The installer's cable tester passes the run, but nothing in the back office connects. " + (v.kind === "template" ? "Last month a contractor ran his \"security template\" on the closet switch." : "The contractor who set up the closet switch's port for it said he'd \"locked the port down properly\".") };
  },
  mason: "Read both switches' lights, then ask each end of that run what it is.",
  affected: "mpc",
  options() {
    return [
      { id: "right", right: true, text: "Both ends transmit on the same pair: a straight-through run between two switch ports, with auto-MDIX turned off on the closet's port (TX/RX transposed)" },
      { id: "long", text: "The run to the back office is too long for Ethernet", why: "It's 26 m, far inside the 100 m limit, and the tester passes every pin." },
      { id: "cable", text: "The run's cable is damaged", why: "The cable tester passes all eight pins: the wiring is intact. It also says how it's wired: straight-through." },
      { id: "shut", text: "The closet switch's port 5 is shut down", why: "show interfaces status says notconnect, not disabled: the port is on, but sees no link." },
      { id: "speed", text: "The closet port's speed is forced to something the old switch can't run", why: "show running-config has no speed line on gi0/5: it negotiates. What it does have is no mdix auto." },
      { id: "faulty", text: "The back office switch is faulty", why: "Its lights show the back office PC's link on port 2: the switch works. Only its uplink, port 1, is dark." }
    ];
  },
  rung1() { return "On the closet switch: show interfaces status, then show running-config for the back office's port. Then the cable tester on the run, and the back office switch's label."; },
  rung2() { return "A link needs each end's transmit pair to reach the other end's receive pair. A switch port's pairs are the reverse of a computer's, so two switches need a crossover between them, unless one end can swap its pairs by itself (auto-MDIX)."; },
  fixHints() { return ["The tester says how the run is wired; the old switch's label says what its ports can do.", "Either end can be the fix: a port that swaps its pairs by itself, or a cable that crosses them.", "If you change the closet switch, save it. Then have the back office PC ask for its address again."]; },
  exhibits(sim) { const c = sim.cable("c-back-up"); return !!c && !sim.cableUp(c) && c.a.seated && c.b.seated && c.cond === "good" && !SW_(sim).ports["GigabitEthernet0/5"].shutdown && sim.hasLink("mpc"); },
  fixed(sim) {
    const c = sim.cable("c-back-up"), sw = SW_(sim), sp = sw.startup && sw.startup.ports["GigabitEthernet0/5"];
    return sim.cableUp(c) && (c.wiring === "crossover" || (!!sp && sp.mdix !== false && !sp.shutdown)) && online(sim, "mpc");
  },
  partial() { return "The link's up, but the closet switch hasn't saved the change: the next power cut turns auto-MDIX off on that port again, and the back office goes dark."; },
  proves(f) { return f.cmd === "ping" && f.dev === "mpc" && f.beyond; },
  proofText: "a ping from the back office PC that gets replies from beyond it",
  evidence: [
    { id: "ipc", test: function (f) { return f.cmd === "ipconfig" && f.dev === "mpc" && f.apipa; }, text: function () { return "ipconfig on the back office PC: a 169.254 address (no DHCP server reached)"; } },
    { id: "status", test: function (f) { return /^Gi0\/5\s.*\bnotconnect\b/m.test(swOut(f)); }, text: function () { return "show interfaces status: Gi0/5, the back office's port, is notconnect (on, but no link)"; } },
    { id: "run", test: function (f) { const o = swOut(f), i = o.indexOf("interface GigabitEthernet0/5\n"); return i >= 0 && /^[^!]* no mdix auto/.test(o.slice(i)); }, text: function () { return "show running-config: the back office's port, gi0/5, has no mdix auto"; } },
    { id: "test", test: function (f) { return f.phys === "test" && f.cable === "c-back-up"; }, text: function () { return "Cable tester on the run to the back office: all pins pass, wired straight-through"; } },
    { id: "lights", test: function (f) { return f.page === "meet-lights"; }, text: function () { return "The back office switch's lights: port 2 (its PC) on, amber; port 1 (the run to the closet) off. Its label: 10/100, MDI-X ports, no auto-MDIX"; } },
    { id: "closet", test: function (f) { return f.page === "msw-lights" && f.ports.some(function (p) { return p.port === 5 && !p.up; }); }, text: function () { return "The closet switch's lights: port 5 (the back office) off"; } }
  ],
  summary(v) {
    return { cause: "Two switch ports faced each other over a straight-through run, so both transmitted on the same pair (TX/RX transposed). The back office's old 10/100 switch can't swap its pairs, and auto-MDIX had been turned off on the closet's port " + (v.kind === "template" ? "(the contractor's template turned it off on every port)." : "(the contractor's \"lock-down\")."),
      fix: "Turned auto-MDIX back on for that port and saved it (or swapped in a crossover cable), then had the back office PC ask for its address again." };
  }
};

/* ---------------------------------------------------------------- SO-06 */
/* the switch's own address typed in again by hand: the mask too small (the front desk PC and the gateway both off its
   network, so it hears the ping and its reply goes nowhere), or the address with a digit slipped (another network) */
const SLIP = { "192.168.40": "192.168.4", "192.168.20": "192.168.2", "10.10.30": "10.10.3", "172.16.12": "172.16.21" };
const SO06 = {
  id: "SO-06", n: "06", level: 2, tier: "common", title: "The switch answers nothing from the office PC", priority: 3, due: "4 h",
  build(seed) {
    const B = settled(seed), sim = B.sim, p = B.plan, host = +p.ip.split(".")[3], r = rng(hash("SO-06:" + seed));
    const kind = r.pick(host >= 5 ? ["mask", "addr"] : ["addr"]);   /* a mask small enough to leave the gateway out needs the switch away from it */
    const badMask = host >= 240 ? "255.255.255.240" : "255.255.255.252", badIp = SLIP[sim.net.prefix] + "." + host;
    const ip = kind === "addr" ? badIp : p.ip, mask = kind === "mask" ? badMask : p.mask;
    onSwitch(sim, ["configure terminal", "interface vlan 1", "ip address " + ip + " " + mask, "end"].concat(SAVE));
    return { sim: sim, v: { kind: kind, plan: p, ip: ip, mask: mask, story: r.pick(["firmware", "monitor"]) } };
  },
  brief(v) {
    return { quote: "Since Friday nothing reaches the closet switch over the network: SSH from the front desk just times out, and the new monitoring says it's down. Everything else in the office works, through that same switch. " +
      (v.story === "firmware" ? "Its firmware was updated on Friday, and its management address typed in again by hand afterwards." : "A contractor set up the monitoring on Friday and \"checked the switch's management settings\" while he was in.") +
      " The office's records: switch management address " + v.plan.ip + ", mask " + v.plan.mask + ", gateway " + v.plan.gw + "." };
  },
  mason: "Something answering and something replying are two different things. Find out which one you've got.",
  affected: "pc",
  options(v) {
    return [
      { id: "right", right: true, text: "The switch's own management address or mask doesn't fit the office network, so it can't answer the front desk PC" },
      { id: "ssh", text: "SSH has been turned off on the switch", why: "Ping gets no answer either, and SSH has nothing to do with ping. show running-config still has transport input ssh on the vty lines." },
      { id: "vlan", text: "The switch's VLAN 1 interface is shut down", why: "show ip interface brief says Vlan1 is up, and its line protocol is up." },
      { id: "fw", text: "The front desk PC's firewall is blocking it", why: "Windows Firewall stops pings coming in to a PC, not the PC's own going out, and the front desk PC reaches the router and the printer." },
      { id: "gw", text: "The switch has no default gateway", why: "show running-config has ip default-gateway " + v.plan.gw + ". And with an address and mask that fitted the office, the front desk PC would be on the switch's own network: a reply to it wouldn't need a gateway at all." },
      { id: "port", text: "The front desk PC's switch port is shut down", why: "The front desk PC reaches the router and the printer through the switch, and show interfaces status says its port is connected." }
    ];
  },
  rung1() { return "From the front desk PC: ping the switch, then arp -a. Then on your laptop's console: show ip interface brief and show running-config, and hold the switch's own address and mask up against the office's records."; },
  rung2() { return "A device works out who is on its own network from its address and its mask. Anything it thinks is elsewhere, it sends to its gateway, and if the gateway isn't on its network either, the reply goes nowhere. An address on another network isn't reached at all without a router in between."; },
  fixHints() { return ["Work on the switch from your laptop's console: the console doesn't need the network.", "Put the switch's management address back as the office's records have it, address and mask both, on its VLAN 1 interface.", "Save it, then try the switch again from the front desk PC."]; },
  exhibits(sim, v) { const r = sim.route("pc", v.plan.ip); return !!r.fail && online(sim, "pc") && SW_(sim).vlan1.ip === v.ip; },
  fixed(sim, v) {
    const sw = SW_(sim), st = sw.startup, p = v.plan, r = sim.route("pc", p.ip), ok = function (c) { return c.vlan1.ip === p.ip && c.vlan1.mask === p.mask && !c.vlan1.shutdown; };
    return ok(sw) && !!st && ok(st) && !!(r.local && r.owner.indexOf("msw") >= 0);
  },
  partial(v, sim) { const s = SW_(sim).vlan1; return s.ip !== v.plan.ip || s.mask !== v.plan.mask ? "It answers now, but not on the address and mask in the office's records: the monitoring, the backups and the next technician all go by those." : "It answers now, but the switch hasn't saved it: the next power cut or reload brings back the address it had, and the switch disappears again."; },
  proves(f, sim, v) { return (f.cmd === "ping" && f.dev === "pc" && f.ip === v.plan.ip && f.replies > 0) || (f.cmd === "ssh" && f.dev === "pc" && f.login && f.host === v.plan.ip); },
  proofText: "a ping or an SSH login from the front desk PC to the switch's address in the office's records",
  evidence: [
    { id: "ping", test: function (f, v) { return f.cmd === "ping" && f.dev === "pc" && f.ip === v.plan.ip && !f.replies; }, text: function (f) { return "Ping from the front desk PC to the switch's address: " + (f.kind === "no-reply" ? "Request timed out, every one" : "Destination host unreachable (nothing on the office's network has that address)"); } },
    { id: "arp", test: function (f, v) { return f.cmd === "arp" && f.dev === "pc" && (f.entries || []).some(function (e) { return e[0] === v.plan.ip && e[1]; }); }, text: function () { return "arp -a on the front desk PC: the switch's address has a hardware address, so the switch heard the question and answered it"; } },
    { id: "ssh", test: function (f, v) { return f.cmd === "ssh" && f.dev === "pc" && f.why === "timeout"; }, text: function () { return "ssh from the front desk PC: Connection timed out"; } },
    { id: "brief", test: function (f, v) { return new RegExp("Vlan1\\s+" + v.ip.replace(/\./g, "\\.") + "\\s").test(swOut(f)); }, text: function (f, v) { return "show ip interface brief: Vlan1 is up, on " + v.ip; } },
    { id: "run", test: function (f, v) { return swOut(f).indexOf("interface Vlan1\n ip address " + v.ip + " " + v.mask + "\n") >= 0; }, text: function (f, v) { return "show running-config: interface Vlan1 has ip address " + v.ip + " " + v.mask; } },
    { id: "vlan", test: function (f, v) { return /Internet address is /.test(swOut(f)) && swOut(f).indexOf(v.ip + "/") >= 0; }, text: function (f, v) { return "show interfaces vlan 1: Internet address is " + v.ip + "/" + v.mask.split(".").map(function (x) { return (+x).toString(2); }).join("").replace(/0/g, "").length; } }
  ],
  summary(v) {
    return { cause: v.kind === "mask" ? "The switch's mask had been typed as " + v.mask + " instead of " + v.plan.mask + ". To the switch, the front desk PC and the gateway were both on other networks: it heard the ping (arp -a had its hardware address) and sent the reply towards a gateway it couldn't reach, so nothing came back."
      : "The switch's address had been typed as " + v.ip + ", a digit slipped: another network altogether. Nothing on the office's network had the address the records give, and with no router between, nothing could reach the one it had.",
      fix: "Set interface vlan 1 back to " + v.plan.ip + " " + v.plan.mask + " from the console, checked it from the front desk PC, and saved." };
  }
};

/* ---------------------------------------------------------------- SO-07 */
/* the front desk's port fixed at 1000 Mb/s a year ago for the PC it had then; the spare PC from the storeroom has a
   10/100 card, so there is no speed both ends can run and no link at all */
const SO07 = {
  id: "SO-07", n: "07", level: 2, tier: "common", title: "The spare PC on the front desk won't connect", priority: 2, due: "2 h",
  build(seed) {
    const B = settled(seed), sim = B.sim, r = rng(hash("SO-07:" + seed)), kind = r.pick(["contractor", "notes"]);
    sim.d.pc.maxMbps = 100; sim.d.pc.ifaces[0].desc = "Fast Ethernet Adapter (10/100)";   /* the spare from the storeroom */
    onSwitch(sim, ["configure terminal", "interface gi0/2", "speed 1000", "end"].concat(SAVE));   /* a year ago, for the PC it had then */
    const c = sim.cablesOf("pc")[0];
    return { sim: sim, v: { kind: kind, plan: B.plan, pcCable: c.id, run: c.length } };
  },
  brief(v) {
    return { quote: "The front desk computer died on Monday, so we've put the old spare from the storeroom on the desk, on the same cable. Windows says the network cable is unplugged, but it's clicked in at both ends. " +
      (v.kind === "contractor" ? "Last year the IT contractor set the front desk's switch port \"to run at full speed\" for the computer we had then." : "The switch's notes from last year say the front desk's port was \"set by hand to match the new PC\".") };
  },
  mason: "Two ends have to agree before anything flows. Ask each end what it can do.",
  affected: "pc",
  options(v) {
    return [
      { id: "right", right: true, text: "The front desk's switch port is fixed at 1000 Mb/s, and the spare PC's network card only runs 10/100" },
      { id: "cable", text: "The front desk PC's cable is damaged", why: "The cable tester passes every pin. And a damaged pair still gives a link, at 100 Mb/s: this one has no link at all." },
      { id: "shut", text: "The front desk PC's switch port is shut down", why: "show interfaces status says notconnect, not disabled: the port is on, but sees no link." },
      { id: "duplex", text: "The port and the PC disagree on duplex", why: "A duplex mismatch keeps the link up and loses packets. This port has no link at all: notconnect." },
      { id: "static", text: "The spare PC still has a fixed address from another network", why: "ipconfig says Media disconnected: there's no link yet, so no address of any kind is in play. An address only matters once there's a link." },
      { id: "long", text: "The run to the front desk is too long for Ethernet", why: "It's " + v.run + " m, far inside the 100 m limit, and the old PC worked on the same cable." }
    ];
  },
  rung1() { return "On the front desk PC: ipconfig /all, and what its network adapter is (its Network settings page says too). Then on the switch: show interfaces status and show running-config for the front desk's port."; },
  rung2() { return "Both ends of a link must run at the same speed. A port left to negotiate settles on the fastest speed both ends share; a port fixed at a speed the other end can't reach has nothing to agree on, and the link stays down."; },
  fixHints() { return ["The PC's card can't go faster than it was made to: the switch's end is the one to change.", "Let the front desk's port negotiate its speed again, or set it to one the card can run. Leave its duplex alone unless the PC's is fixed too.", "Save it, then check the PC has an address and reaches beyond the office."]; },
  exhibits(sim, v) { const c = sim.cable(v.pcCable), p = SW_(sim).ports[PC_PORT]; return !sim.hasLink("pc") && !!c && c.a.seated && c.b.seated && c.cond === "good" && !p.shutdown && p.speed === "1000" && sim.hasLink("printer"); },
  fixed(sim) {
    const sw = SW_(sim), sp = sw.startup && sw.startup.ports[PC_PORT], l = sim.switchLinks("msw")[PC_PORT];
    return online(sim, "pc") && !sim.mismatched("pc") && !!sp && !!l && !sp.shutdown && (sp.speed === "auto" || +sp.speed <= 100) && !SW.duplexEnds(sp, l).mismatch;
  },
  partial(v, sim) { return sim.mismatched("pc") ? "It links now, but the port's duplex is fixed while the PC negotiates: the PC falls back to half duplex, and packets are lost. Fix both ends, or neither." : "The desk's back, but the switch hasn't saved it: the next power cut puts the port back at 1000, and the desk goes dark again."; },
  proves(f) { return f.cmd === "ping" && f.dev === "pc" && f.beyond; },
  proofText: "a ping from the front desk PC that gets replies from something else",
  evidence: [
    { id: "ipc", test: function (f) { return f.cmd === "ipconfig" && f.dev === "pc" && f.media === "disconnected"; }, text: function () { return "ipconfig on the front desk PC: Media disconnected (no link)"; } },
    { id: "settings", test: function (f) { return f.page === "pc-settings" && !f.connected; }, text: function () { return "The front desk PC's network settings: a 10/100 adapter, set to negotiate, not connected"; } },
    { id: "status", test: function (f) { return /^Gi0\/2\s.*\bnotconnect\s+1\s+\S+\s+1000\b/m.test(swOut(f)); }, text: function () { return "show interfaces status: Gi0/2, the front desk's port, notconnect, its speed fixed at 1000"; } },
    { id: "run", test: function (f) { const o = swOut(f), i = o.indexOf("interface GigabitEthernet0/2\n"); return i >= 0 && /^[^!]* speed 1000\n/.test(o.slice(i)); }, text: function () { return "show running-config: the front desk's port, gi0/2, has speed 1000"; } },
    { id: "test", test: function (f, v) { return f.phys === "test" && f.cable === v.pcCable; }, text: function () { return "Cable tester on the front desk PC's cable: all eight pins pass"; } },
    { id: "lights", test: function (f) { return f.page === "msw-lights" && f.ports.some(function (p) { return p.port === 2 && !p.up; }); }, text: function () { return "The switch's lights: port 2 (the front desk PC) dark"; } }
  ],
  summary() {
    return { cause: "The front desk's switch port had been fixed at 1000 Mb/s for the PC it had a year ago. The spare PC's card runs only 10 or 100 Mb/s, so the two ends had no speed in common, and no link came up.",
      fix: "Let the port negotiate again (or set it to 100), saved it, and the PC got its address as soon as the link came up." };
  }
};

/* ---------------------------------------------------------------- SO-08 */
/* last week's new cabling: every desk's wall jack runs back to a 24-port patch panel in the closet rack, punched down
   behind one of its ports, and a short patch cord joins that port's front to the switch. The installer's cable map has
   the manager's run and the meeting room's the wrong way round, and the manager's new PC was patched from the map */
const ROOM_NAME = { front: "Front desk", open: "Open-plan office", manager: "Manager's office", meeting: "Meeting room" };
function newCabling(sim, r) {
  const d = sim.d, net = sim.net, free = r.shuffle(["1", "2", "3", "4", "5", "6", "8", "9", "10", "11", "12"]);
  const P = { front: free[0], open: free[1], manager: free[2], meeting: "7" };   /* the map says the manager's is 7: it's the meeting room's */
  d.pp = { id: "pp", kind: "patchpanel", label: "Patch panel", sub: "24-port Cat6", on: true };
  d.mjack = { id: "mjack", kind: "jack", label: "Meeting room wall jack", sub: "nothing plugged in", on: true };
  d.mgr = { id: "mgr", kind: "pc", label: "Manager's PC", sub: "DHCP", on: true, os: "windows", user: "manager", host: "MANAGER-PC", printer: { name: "Office printer", port: d.pc.printer.port },
    ifaces: [{ name: "Ethernet", type: "eth", port: "NIC", mac: mac(r), desc: "Gigabit Network Connection", cfg: { mode: "dhcp", dnsMode: "auto" }, lease: null, apipa: null }] };
  ["pp", "mjack", "mgr"].forEach(function (id) { sim.arp[id] = {}; }); net.rooms.pp = "closet"; net.rooms.mjack = "meeting"; net.rooms.mgr = "manager";
  if (d.switch && !sim.cablesOf("switch").length) { delete d.switch; delete net.rooms.switch; delete sim.arp.switch; }   /* the installer took the old 8-port switch away: the panel is where it stood */
  /* the front desk's and the printer's runs now come back to the panel, each patched to the switch port they had */
  const rewire = function (dev, port, room) { const c = sim.cablesOf(dev)[0], sw = c.a.dev === "msw" ? c.a : c.b; net.cables.push({ id: "c-cord-" + dev, kind: "cat6", a: { dev: "msw", port: sw.port, seated: true }, b: { dev: "pp", port: P[room], seated: true }, cond: "good", length: 0.5 }); sw.dev = "pp"; sw.port = P[room] + "R"; };
  rewire("pc", "2", "front"); rewire("printer", "3", "open");
  net.cables.push({ id: "c-run-mgr", kind: "cat6", a: { dev: "pp", port: P.manager + "R", seated: true }, b: { dev: "mgr", port: "NIC", seated: true }, cond: "good", length: OFFICE_RUN.closet.manager });
  net.cables.push({ id: "c-run-meet", kind: "cat6", a: { dev: "pp", port: "7R", seated: true }, b: { dev: "mjack", port: "JACK", seated: true }, cond: "good", length: OFFICE_RUN.closet.meeting });
  net.cables.push({ id: "c-cord-mgr", kind: "cat6", a: { dev: "msw", port: "4", seated: true }, b: { dev: "pp", port: "7", seated: true }, cond: "good", length: 0.5 });   /* patched from the map */
  const map = {}; map[P.front] = "front"; map[P.open] = "open"; map["7"] = "manager"; map[P.manager] = "meeting";
  net.cablemap = map; d.pp.tabs = Object.assign({}, map);   /* the installer wrote the panel's tabs from his map */
  return P;
}
/* does the cable map name, for every panel port, the room its run really goes to (and nothing for a port with no run)? */
const mapRight = function (sim) {
  const m = sim.net.cablemap || {}, real = {};
  sim.cablesOf("pp").forEach(function (c) { const e = c.a.dev === "pp" ? c.a : c.b, o = e === c.a ? c.b : c.a; if (/R$/.test(e.port)) real[e.port.slice(0, -1)] = sim.net.rooms[o.dev]; });
  for (let n = 1; n <= 24; n++) if ((m[n] || "") !== (real[n] || "")) return false;
  return true;
};
const SO08 = {
  id: "SO-08", n: "08", level: 2, tier: "harder", title: "The cable map says port 7; the cable isn't in port 7", priority: 2, due: "2 h", cablemap: true,
  build(seed) {
    const B = settled(seed), sim = B.sim, r = rng(hash("SO-08:" + seed)), P = newCabling(sim, r);
    onSwitch(sim, ["configure terminal", "interface gi0/4", "description MANAGER-PC", "no shutdown", "end"].concat(SAVE));
    sim.dhcp("mgr", "boot");
    return { sim: sim, v: { plan: B.plan, ports: P, story: r.pick(["away", "door"]) } };
  },
  brief(v) {
    return { quote: "Last week we had new cabling put in: every desk's wall jack now runs back to a patch panel in the closet rack, and short patch cords join the panel to the switch. The manager's new PC in the manager's office has no network at all. The installer's cable map says the manager's jack is port 7, so that's the port he patched to the manager's port on the switch, and he swears the cord is good. " +
      (v.story === "away" ? "He's on another job this week." : "His cable map is taped inside the rack door.") };
  },
  mason: "A map is only as good as whoever wrote it. Ask the cable.",
  affected: "mgr",
  options() {
    return [
      { id: "right", right: true, text: "The manager's run is punched down on a different panel port from the one the cable map gives, so the switch was patched to the wrong run" },
      { id: "cord", text: "The patch cord from panel port 7 to the switch is faulty", why: "Port 7's cord is fine; port 7's run goes somewhere else. The tone from the manager's jack comes out at another port, with nothing patched into it." },
      { id: "shut", text: "The manager's switch port is shut down", why: "show interfaces status says notconnect, not disabled: the port is on, but sees no link." },
      { id: "run", text: "The manager's run is damaged", why: "The cable tester passes every pin of the manager's run, from the panel to the jack." },
      { id: "nic", text: "The manager's PC's network adapter has failed", why: "Its run lands at the panel on a port with nothing patched into it: there's no path to the switch for it to link on, whatever the adapter." },
      { id: "dhcp", text: "The router has run out of addresses to hand out", why: "ipconfig says Media disconnected: there's no link at all, so DHCP never comes into it." }
    ];
  },
  rung1() { return "On the manager's PC: ipconfig. On the switch: show interfaces status. Then the cable map, and follow the manager's cable to the panel: the tone generator on it at the desk end, the probe along the back of the panel."; },
  rung2() { return "A patch panel joins each run at its back to whatever is patched into the same port at its front. A map is somebody's notes: a tone put on a cable at one end shows where it really lands at the other."; },
  fixHints() { return ["Find where the manager's run really lands: tone it at the desk end, then probe the back of the panel.", "Move the manager's patch cord to that port.", "Then put the cable map right, so it matches what the tone showed you: the next technician will trust it."]; },
  exhibits(sim, v) { const c = sim.cable("c-cord-mgr"); return !sim.hasLink("mgr") && !!c && c.b.port === "7" && (sim.net.cablemap || {})["7"] === "manager" && online(sim, "pc") && printOk(sim); },
  fixed(sim) { return online(sim, "mgr") && mapRight(sim) && online(sim, "pc") && printOk(sim); },
  partial(v, sim) { return !online(sim, "pc") || !printOk(sim) ? "The manager's online, but the front desk or the printer isn't any more: a cord that was right has been moved." : "The manager's online, but the cable map still has the runs the wrong way round: the next technician will patch from it and get it wrong again."; },
  proves(f) { return f.cmd === "ping" && f.dev === "mgr" && f.beyond; },
  proofText: "a ping from the manager's PC that gets replies from something else",
  evidence: [
    { id: "ipc", test: function (f) { return f.cmd === "ipconfig" && f.dev === "mgr" && f.media === "disconnected"; }, text: function () { return "ipconfig on the manager's PC: Media disconnected (no link)"; } },
    { id: "status", test: function (f) { return /^Gi0\/4\s+MANAGER-PC\s+notconnect/m.test(swOut(f)); }, text: function () { return "show interfaces status: Gi0/4, the manager's port, is notconnect (on, but no link)"; } },
    { id: "lights", test: function (f) { return f.page === "msw-lights" && f.ports.some(function (p) { return p.port === 4 && !p.up; }); }, text: function () { return "The switch's lights: port 4 (the manager's) dark"; } },
    { id: "test", test: function (f) { return f.phys === "test" && f.cable === "c-run-mgr"; }, text: function () { return "Cable tester on the manager's run: all eight pins pass"; } },
    { id: "probe", test: function (f) { return f.phys === "probe" && f.toned === "c-run-mgr" && !!f.port; }, text: function (f) { return "Tone on the manager's run at the desk: the probe finds it at the back of panel port " + f.port; } },
    { id: "probe7", test: function (f) { return f.phys === "probe" && f.toned === "c-run-meet" && !!f.port; }, text: function (f) { return "Tone on the meeting room's wall jack: the probe finds it at the back of panel port " + f.port; } },
    { id: "cord", test: function (f, v, sim) { const c = sim.cable("c-cord-mgr"); return f.phys === "look" && f.cable === "c-cord-mgr" && c.b.port === "7"; }, text: function () { return "The cord in panel port 7: clicked in, and it runs down to the switch's port 4"; } }
  ],
  summary(v) {
    return { cause: "The installer's cable map had the manager's run and the meeting room's the wrong way round. The manager's run is punched down at port " + v.ports.manager + ", the meeting room's at port 7, so patching port 7 to the manager's switch port joined it to an empty jack in the meeting room.",
      fix: "Toned the manager's run to find it at port " + v.ports.manager + ", moved the patch cord there, and put the cable map right." };
  }
};

/* ---------------------------------------------------------------- SO-10 */
/* the back office (what was the meeting room) on a second managed switch of the same model, joined to the closet over
   fibre: the run passes the lift's motor room, and fibre doesn't pick up its interference. Multimode fibre, and an SX
   module in the back office's switch; the closet's slot holds the wrong kind of module */
function fibreBackOffice(sim, r, closetModule) {
  const d = sim.d, net = sim.net;
  d.bsw = { id: "bsw", kind: "mswitch", label: "Back office switch", sub: "MSW-2800G", on: true, mac: mac(r), sw: SW.newSwitch(), sfp: { SFP1: "1000BASE-SX", SFP2: null, SFP3: null, SFP4: null } };
  d.msw.sfp = { SFP1: closetModule, SFP2: null, SFP3: null, SFP4: null };
  d.mpc = { id: "mpc", kind: "pc", label: "Back office PC", sub: "DHCP", on: true, os: "windows", user: "backoffice", host: "BACKOFFICE-PC", printer: { name: "Office printer", port: d.pc.printer.port },
    ifaces: [{ name: "Ethernet", type: "eth", port: "NIC", mac: mac(r), desc: "Gigabit Network Connection", cfg: { mode: "dhcp", dnsMode: "auto" }, lease: null, apipa: null }] };
  net.rooms.bsw = "meeting"; net.rooms.mpc = "meeting"; sim.arp.bsw = {}; sim.arp.mpc = {};
  net.cables.push({ id: "c-fibre", kind: "fibre", fiber: "MMF", jacket: "OM2 50/125 µm MULTIMODE", polarity: "ab", a: { dev: "msw", port: "SFP1", seated: true }, b: { dev: "bsw", port: "SFP1", seated: true }, length: OFFICE_RUN.closet.meeting + 9 });
  net.cables.push({ id: "c-back-pc", kind: "cat6", a: { dev: "bsw", port: "1", seated: true }, b: { dev: "mpc", port: "NIC", seated: true }, cond: "good", length: 3 });
}
const SO10 = {
  id: "SO-10", n: "10", level: 2, tier: "harder", title: "The fibre link to the back office is dark", priority: 2, due: "2 h",
  build(seed) {
    const B = settled(seed), sim = B.sim, r = rng(hash("SO-10:" + seed)), kind = r.pick(["lx", "lx-back", "plus"]);
    fibreBackOffice(sim, r, kind === "lx" ? "1000BASE-LX" : kind === "plus" ? "10GBASE-SR" : "1000BASE-SX");
    if (kind === "lx-back") sim.d.bsw.sfp.SFP1 = "1000BASE-LX";   /* this time it's the back office's end that holds the wrong one */
    onSwitch(sim, ["configure terminal", "interface gi0/25", "description BACK-OFFICE-FIBRE", "no shutdown", "end"].concat(SAVE));
    sim.dhcp("mpc", "boot");   /* it asks, and nothing beyond its own switch answers: 169.254 */
    return { sim: sim, v: { kind: kind, plan: B.plan, end: kind === "lx-back" ? "bsw" : "msw", story: r.pick(["spare", "shop"]) } };
  },
  brief(v) {
    return { quote: "The back office is on its own switch now, joined to the closet by a fibre run: the installer said fibre because the run passes the lift's motor room. Since he left, nothing in the back office connects. " +
      (v.story === "spare" ? "He fitted the modules from the spares in his van, and said they're \"all the same thing really\"." : "We bought the modules ourselves from a computer shop, from his list, to save money.") };
  },
  mason: "Light has to leave one end on a wavelength the other end can hear. Read both ends.",
  affected: "mpc",
  options(v) {
    const rightText = v.kind === "plus" ? "The closet's SFP slot holds a 10 Gb/s SFP+ module, which a 1 Gb/s SFP slot can't run" : "The two ends' SFP modules don't match: one is 1000BASE-LX (1310 nm, single-mode), the other 1000BASE-SX (850 nm, multimode)";
    return [
      { id: "right", right: true, text: rightText },
      v.kind === "plus" ? { id: "mismatch", text: "The two ends' SFP modules don't match: one is 1000BASE-LX (1310 nm, single-mode), the other 1000BASE-SX (850 nm, multimode)", why: "Both modules' labels say 850 nm, multimode: they're the same kind of light. The closet's is SFP+, 10 Gb/s, and its slot is err-disabled." }
        : { id: "plus", text: "The closet's SFP slot holds a 10 Gb/s SFP+ module, which a 1 Gb/s SFP slot can't run", why: "Both modules are 1 Gb/s SFP modules: show interfaces status lists the port as notconnect, not err-disabled, and show inventory has no SFP+." },
      { id: "polarity", text: "The fibre's LC pair is crossed the wrong way, transmit to transmit", why: "No turn of the LC pair can join 850 nm to 1310 nm, or run an SFP+ in an SFP slot. Read the modules' labels first." },
      { id: "dirty", text: "The LC connectors are dirty, and too little light gets through", why: "A dirty connector dims the light; it doesn't take it away entirely. And show interfaces transceiver can't hear a wavelength it isn't made for at all." },
      { id: "shut", text: "The closet switch's fibre port is shut down", why: "show interfaces status doesn't say disabled: the port is open." },
      { id: "long", text: "The fibre run is too long for the modules", why: "It's " + (OFFICE_RUN.closet.meeting + 9) + " m. Multimode at 1 Gb/s reaches hundreds of metres; single-mode, kilometres." }
    ];
  },
  rung1() { return "On the closet switch: show interfaces status, show interfaces transceiver and show inventory. Then read the modules' labels and the cord's jacket, at both ends."; },
  rung2() { return "An SFP module sends one wavelength on one kind of fibre at one speed. Both ends must send and listen on the same wavelength, on fibre made for it, at a speed their slots can run; a 1 Gb/s SFP slot can't run a 10 Gb/s SFP+ module."; },
  fixHints() { return ["The van has both kinds of 1 Gb/s module: SX for multimode, LX for single-mode.", "The fibre in the wall is the one thing you can't swap: match the modules to it.", "Then have the back office PC ask for its address again, and test from it."]; },
  exhibits(sim) { const c = sim.cable("c-fibre"); return !!c && !sim.cableUp(c) && c.a.seated && c.b.seated && !SW_(sim).ports["GigabitEthernet0/25"].shutdown && sim.hasLink("mpc"); },
  fixed(sim) { const c = sim.cable("c-fibre"); return sim.cableUp(c) && online(sim, "mpc"); },
  proves(f) { return f.cmd === "ping" && f.dev === "mpc" && f.beyond; },
  proofText: "a ping from the back office PC that gets replies from beyond it",
  evidence: [
    { id: "ipc", test: function (f) { return f.cmd === "ipconfig" && f.dev === "mpc" && f.apipa; }, text: function () { return "ipconfig on the back office PC: a 169.254 address (no DHCP server reached)"; } },
    { id: "status", test: function (f) { return /^Gi0\/25\s.*\b(notconnect|err-disabled)\b/m.test(swOut(f)); }, text: function (f) { return "show interfaces status: Gi0/25, the fibre to the back office, is " + (/^Gi0\/25\s.*err-disabled/m.test(swOut(f)) ? "err-disabled" : "notconnect") + ", its module " + ((swOut(f).match(/^Gi0\/25\s.*\s(\S+)$/m) || [])[1] || ""); } },
    { id: "dom", test: function (f) { return /^Gi0\/25\s+(.*-40\.0|% Unsupported)/m.test(swOut(f)); }, text: function (f) { return /Unsupported/.test(swOut(f)) ? "show interfaces transceiver: Gi0/25, unsupported transceiver, no readings" : "show interfaces transceiver: Gi0/25 sends light (-5.6 dBm) and receives none (-40.0 dBm)"; } },
    { id: "inv", test: function (f) { return /NAME: "GigabitEthernet0\/25"/.test(swOut(f)); }, text: function (f) { return "show inventory: Gi0/25 holds " + ((swOut(f).match(/NAME: "GigabitEthernet0\/25", DESCR: "([^"]+)"/) || [])[1] || "a module"); } },
    { id: "log", test: function (f) { return /%PHY-4-UNSUPPORTED_TRANSCEIVER/.test(swOut(f)); }, text: function () { return "The switch's console: %PHY-4-UNSUPPORTED_TRANSCEIVER on Gi0/25, put in err-disable state"; } },
    { id: "lookc", test: function (f) { return f.phys === "look" && f.cable === "c-fibre" && f.end === "a"; }, text: function (f, v, sim) { return "The closet's end: module labelled " + SFP_MODULES[sim.d.msw.sfp.SFP1].label + "; the cord's jacket: orange, OM2 50/125 µm multimode"; } },
    { id: "lookb", test: function (f) { return f.phys === "look" && f.cable === "c-fibre" && f.end === "b"; }, text: function (f, v, sim) { return "The back office's end: module labelled " + SFP_MODULES[sim.d.bsw.sfp.SFP1].label; } }
  ],
  summary(v) {
    return { cause: v.kind === "plus" ? "The closet switch's SFP slot held an SFP+ 10GBASE-SR module. Its light was the right kind (850 nm, multimode), but a 1 Gb/s SFP slot can't run a 10 Gb/s module: the switch flagged it unsupported and err-disabled the port."
      : "The " + (v.kind === "lx" ? "closet's" : "back office's") + " module was a 1000BASE-LX: 1310 nm light, made for single-mode fibre. The other end's 1000BASE-SX sends and listens at 850 nm, and the run is multimode. Neither end could hear the other.",
      fix: "Swapped the wrong module for a 1000BASE-SX, to match the other end and the multimode fibre, then had the back office PC ask for its address again." };
  }
};

/* ---------------------------------------------------------------- SO-11 */
/* the front desk PC's port fixed at full duplex by hand; the PC negotiates, senses the speed but not the duplex, and falls
   back to half. The other way round from SO-01: here the switch's end is the full-duplex one, so it counts CRC errors and runts */
const SO11 = {
  id: "SO-11", n: "11", level: 2, tier: "more", title: "Copying files to the front desk PC crawls", priority: 3, due: "4 h",
  build(seed) {
    const B = settled(seed), r = rng(hash("SO-11:" + seed)), kind = r.pick(["giga", "fast"]);
    onSwitch(B.sim, ["configure terminal", "interface gi0/2", "speed " + (kind === "giga" ? "1000" : "100"), "duplex full", "end"].concat(SAVE));
    return { sim: B.sim, v: { kind: kind, plan: B.plan, pcCable: B.sim.cablesOf("pc")[0].id, story: r.pick(["tune", "guide"]) } };
  },
  brief(v) {
    return { quote: "Since last week everything to and from the front desk computer crawls: copying the accounts folder takes ten minutes, and video calls freeze. Everywhere else in the office is fine. " +
      (v.story === "tune" ? "Our IT person \"tuned the front desk's switch port for speed\" while the new accounts software went in." : "I followed an online guide that said to \"lock your important ports to full duplex\", and did the front desk's.") };
  },
  mason: "Errors that climb are counted at one end. Which end, and why?",
  affected: "pc",
  options() {
    return [
      { id: "right", right: true, text: "The front desk PC's switch port is fixed at full duplex, so the PC, left to negotiate, has fallen back to half" },
      { id: "cable", text: "The front desk PC's cable is damaged", why: "The cable tester passes every pin. And the port's duplex is set by hand while the PC negotiates: the errors are counted at the switch's full-duplex end only." },
      { id: "printer", text: "The printer's port has a duplex mismatch again", why: "show interfaces gi0/3 counts no errors. It's gi0/2, the front desk's port, whose CRC errors and runts climb." },
      { id: "speed", text: "The port is forced to a speed the PC can't run", why: "The link is up and passing traffic. A speed the PC couldn't run would leave no link at all." },
      { id: "nic", text: "The front desk PC's network adapter is failing", why: "show running-config has duplex full set by hand on gi0/2, and the PC is set to negotiate: that pair always disagrees, whatever the adapter." },
      { id: "emi", text: "Interference on the run is corrupting frames", why: "The run is 18 m of Cat6 through the front office, nowhere near a motor, and the errors are exactly a mismatch's: CRC errors and runts at the full-duplex end." }
    ];
  },
  rung1() { return "On the switch: show interfaces gi0/2, twice, and show running-config for that port. On the front desk PC: ping something, and count what's lost."; },
  rung2() { return "When one end is fixed and the other negotiates, the negotiating end senses the speed but not the duplex, and falls back to half. Then the full-duplex end counts CRC errors and runts, and the half-duplex end late collisions."; },
  fixHints() { return ["The PC negotiates. The switch's end should too.", "Take the port's speed and duplex back to automatic, then look at show interfaces twice: the errors should stop climbing.", "Save it."]; },
  exhibits(sim) { return sim.mismatched("pc") && online(sim, "pc"); },
  fixed(sim) { const sw = SW_(sim), sp = sw.startup && sw.startup.ports[PC_PORT]; return online(sim, "pc") && !sim.mismatched("pc") && sw.ports[PC_PORT].duplex === "auto" && !!sp && sp.duplex === "auto" && !sp.shutdown; },
  partial(v, sim) { return SW_(sim).ports[PC_PORT].duplex === "half" ? "No more errors, but the port now runs half duplex: everything waits its turn. Let both ends negotiate, and they'll settle on full." : "It's quick now, but the switch hasn't saved it: the next power cut fixes the port at full duplex again."; },
  proves(f) { return f.cmd === "ping" && f.dev === "pc" && f.beyond && f.sent >= 4 && f.replies === f.sent; },
  proofText: "a ping from the front desk PC to something else, with nothing lost",
  evidence: [
    { id: "int", test: function (f) { const b = block(swOut(f), PC_PORT); return /Full-duplex/.test(b) && /[1-9]\d* CRC/.test(b); }, text: function () { return "show interfaces gi0/2, the front desk's port: up, Full-duplex, CRC errors and runts counted"; } },
    { id: "run", test: function (f) { const o = swOut(f), i = o.indexOf("interface GigabitEthernet0/2\n"); return i >= 0 && /^[^!]* duplex full\n/.test(o.slice(i)); }, text: function () { return "show running-config: the front desk's port, gi0/2, has duplex full set by hand"; } },
    { id: "ping", test: function (f) { return f.cmd === "ping" && f.dev === "pc" && f.replies < f.sent && f.replies > 0; }, text: function (f) { return "Ping from the front desk PC: " + f.loss + "% of the packets lost"; } },
    { id: "settings", test: function (f) { return f.page === "pc-settings"; }, text: function () { return "The front desk PC's network settings: speed and duplex set to Auto negotiation"; } },
    { id: "test", test: function (f, v) { return f.phys === "test" && f.cable === v.pcCable; }, text: function () { return "Cable tester on the front desk PC's cable: all eight pins pass"; } }
  ],
  summary(v) {
    return { cause: "The front desk's switch port had been fixed at " + (v.kind === "giga" ? "1000" : "100") + " Mb/s, full duplex, by hand. The PC negotiates: it sensed the speed but not the duplex, and fell back to half. The two ends disagreed: CRC errors and runts on the switch's full-duplex end, late collisions on the PC's, frames lost both ways.",
      fix: "Set the port's speed and duplex back to automatic, so both ends negotiate (and settle on full), and saved it." };
  }
};

/* ---------------------------------------------------------------- SO-12 */
/* the console line with no login: anyone at the closet with a console cable is straight at the switch's prompt */
const SO12 = {
  id: "SO-12", n: "12", level: 2, tier: "more", title: "Anyone with a console cable gets straight in", priority: 2, due: "1 day",
  build(seed) {
    const B = settled(seed), r = rng(hash("SO-12:" + seed)), kind = r.pick(["nologin", "cleared"]);
    onSwitch(B.sim, ["configure terminal", "line console 0", "no login"].concat(kind === "cleared" ? ["no password"] : [], ["end"], SAVE));
    return { sim: B.sim, v: { kind: kind, plan: B.plan, story: r.pick(["locked", "unknown"]) } };
  },
  brief(v) {
    return { quote: "Our insurer's auditor plugged a console cable into the closet switch on Tuesday and was at its prompt without typing a password. They won't sign us off until it's fixed. " +
      (v.story === "locked" ? "A contractor who'd locked himself out last month says he \"took the console's password check off to get back in\"." : "Nobody here knows who changed it.") };
  },
  mason: "Each way into a switch has its own lock. Find which one is open.",
  affected: "tech",
  options() {
    return [
      { id: "right", right: true, text: "The switch's console line asks for no password: its login has been turned off" },
      { id: "enable", text: "The switch has no enable secret", why: "Typing enable still asks for the secret. It's the console line's own login that's missing, before you ever get to enable." },
      { id: "vty", text: "The remote (vty) lines let anyone log in", why: "The auditor came in on the console cable, not over the network. show running-config has login local on the vty lines." },
      { id: "telnet", text: "Telnet is turned on", why: "The vty lines take SSH only, and the console isn't reached over the network at all." },
      { id: "banner", text: "The warning banner is missing", why: "The banner shows as the console wakes. A banner warns; it doesn't lock anything." },
      { id: "user", text: "The office's user account was deleted", why: "show running-config still has the office's user. And the console line checks a line password, as it was set up, not user names." }
    ];
  },
  rung1() { return "On your laptop's serial terminal: wake the switch's console and watch what it asks for. Then show running-config, and read the line con 0 section."; },
  rung2() { return "Each way into a switch has its own lock: the console line, the remote lines, and enable for the privileged commands. A line with no login lets anyone at that line straight in."; },
  fixHints() { return ["The console line needs its password, and needs to ask for it.", "Set it from the office's records, then log out and wake the console again: it should ask.", "Save it."]; },
  exhibits(sim) { const c = SW_(sim).con; return !c.login; },
  fixed(sim, v) {
    const sw = SW_(sim), p = v.plan, ok = function (c) { return (c.login === "password" && c.password === p.console) || c.login === "local"; };
    return ok(sw.con) && !!sw.startup && ok(sw.startup.con);
  },
  partial(v, sim) { const c = SW_(sim).con; return c.login === "password" && c.password !== v.plan.console ? "It asks now, but not for the office's console password: the records and the switch disagree, and the next technician is locked out." : "It asks now, but the switch hasn't saved it: the next power cut opens the console again."; },
  proves(f) { return f.cmd === "serial" && /User Access Verification/.test(f.out || ""); },
  proofText: "your laptop's serial terminal: the console, woken again, asking for its password",
  evidence: [
    { id: "wake", test: function (f) { return f.cmd === "serial" && f.connected && f.mode === "user" && !/User Access Verification/.test(f.out || "") && /^\s*$/.test(f.line || "") ; }, text: function () { return "The console woke straight to the switch's prompt: no password asked"; } },
    { id: "run", test: function (f) { const o = swOut(f), i = o.indexOf("line con 0"); return i >= 0 && /Building configuration|Current configuration/.test(o) && !/^line con 0\n(?: password .*\n)? login/m.test(o.slice(i)); }, text: function (f, v) { return "show running-config, line con 0: " + (v.kind === "cleared" ? "no password and no login" : "a password, but no login: it's never asked for"); } },
    { id: "enable", test: function (f) { return f.cmd === "serial" && f.asked && /^\s*en/i.test(f.line || ""); }, text: function () { return "enable still asks for the enable secret"; } }
  ],
  summary(v) {
    return { cause: "The console line's login had been turned off" + (v.kind === "cleared" ? ", and its password cleared" : " (its password was still there, never asked for)") + ", and that saved. Anyone with a console cable at the closet was straight at the switch's prompt.",
      fix: "Set the console password from the office's records, turned login back on, checked the console asks again, and saved." };
  }
};

/* ---------------------------------------------------------------- SO-13 */
/* the switch's RSA keys made again (a contractor fixing something else, or a replacement loaded from the backup and given
   fresh keys); the front desk PC remembers the old key, and OpenSSH refuses the new one. The lesson: check a changed key
   against the switch itself before trusting it, then forget the old one */
const SO13 = {
  id: "SO-13", n: "13", level: 2, tier: "more", title: "SSH warns the switch's identity has changed", priority: 2, due: "4 h",
  build(seed) {
    const B = settled(seed), sim = B.sim, r = rng(hash("SO-13:" + seed)), kind = r.pick(["regen", "replaced"]), sw = SW_(sim);
    sim.d.pc.knownHosts = {}; sim.d.pc.knownHosts[B.plan.ip] = SW.hostKey(sw);   /* the front desk has logged in before: it remembers this key */
    onSwitch(sim, ["configure terminal", "crypto key generate rsa modulus 2048", "end"].concat(SAVE));
    return { sim: sim, v: { kind: kind, plan: B.plan, oldKey: sim.d.pc.knownHosts[B.plan.ip] } };
  },
  brief(v) {
    return { quote: "SSH from the front desk to the closet switch now prints a big warning about the remote host's identity having changed, and stops. " +
      (v.kind === "regen" ? "A contractor was in on Thursday \"sorting out the switch's encryption\"." : "The switch was swapped under warranty last week; the supplier's engineer loaded our backup onto the new one.") + " Is someone attacking us?" };
  },
  mason: "Before you trust a new key, ask the switch itself what key it holds.",
  affected: "pc",
  options() {
    return [
      { id: "right", right: true, text: "The switch's SSH keys were made again, so it now offers a different host key from the one the front desk PC remembers" },
      { id: "mitm", text: "Someone is intercepting the connection (a man in the middle)", why: "The fingerprint in the warning is the one the switch itself shows on its console, where nothing can sit in the middle: it's the switch's own new key." },
      { id: "pw", text: "The SSH password was changed", why: "It never gets as far as a password: the PC stops at the host key, before any login." },
      { id: "telnet", text: "The switch now takes Telnet only", why: "Telnet only would refuse the connection. This one connects, offers a key, and the PC refuses the key." },
      { id: "nokeys", text: "The switch has no RSA keys", why: "With no keys the switch refuses SSH outright. This one offers a key, just a different one from before." },
      { id: "addr", text: "Another device has taken the switch's address", why: "The fingerprint the warning shows matches the one on the switch's own console, and ping reaches it at its address." }
    ];
  },
  rung1() { return "From the front desk PC: ssh to the switch, and read the whole warning, the fingerprint included. Then on your laptop's console: show crypto key mypubkey rsa."; },
  rung2() { return "An SSH client remembers each host's key and refuses a different one: that's what stops an impostor. A key also changes, legitimately, when a switch's keys are made again. The way to tell is to compare the new fingerprint with the one the switch shows on its own console."; },
  fixHints() { return ["Check first: the fingerprint in the warning against the one on the switch's console.", "When they match, have the front desk PC forget the old key for that address: Help lists the command that removes one host's line from its known hosts.", "Then SSH again: the PC learns the new key, and the login works."]; },
  exhibits(sim, v) { const kh = sim.d.pc.knownHosts; return !!kh && kh[v.plan.ip] === v.oldKey && SW.hostKey(SW_(sim)) !== v.oldKey; },
  fixed(sim, v) { const kh = sim.d.pc.knownHosts || {}, fp = SW.hostKey(SW_(sim)); return !!fp && (!kh[v.plan.ip] || kh[v.plan.ip] === fp) && SW_(sim).startup.keyGen === SW_(sim).keyGen; },
  proves(f, sim, v) { return f.cmd === "ssh" && f.dev === "pc" && f.login && f.host === v.plan.ip; },
  proofText: "an SSH login from the front desk PC to the switch",
  evidence: [
    { id: "warn", test: function (f) { return f.cmd === "ssh" && f.dev === "pc" && f.why === "hostkey"; }, text: function (f) { return "ssh from the front desk PC: REMOTE HOST IDENTIFICATION HAS CHANGED; the switch offers " + f.fp; } },
    { id: "fp", test: function (f) { return /Fingerprint \(SHA256/.test(swOut(f)); }, text: function (f, v, sim) { return "show crypto key mypubkey rsa on the console: the switch's own key is " + SW.hostKey(SW_(sim)) + ", the same as the warning's"; } },
    { id: "ping", test: function (f, v) { return f.cmd === "ping" && f.dev === "pc" && f.ip === v.plan.ip && f.replies > 0; }, text: function () { return "Ping from the front desk PC reaches the switch's address"; } }
  ],
  summary(v) {
    return { cause: (v.kind === "regen" ? "The contractor made new RSA keys on the switch" : "The replacement switch was given fresh RSA keys (keys don't travel in a backup)") + ". The front desk PC remembered the old key for the switch's address, and OpenSSH refuses a key it doesn't expect: exactly what it's for. The fingerprint on the switch's own console matched the warning's, so the change was the switch's, not an impostor's.",
      fix: "Checked the warning's fingerprint against the switch's console, removed the old key from the front desk PC (ssh-keygen -R), and logged in again so it learned the new one." };
  }
};

/* ---------------------------------------------------------------- SO-14 */
/* the new cabling (SO-08's, with its map right this time); the printer moved to a desk by the window, its new run on
   another panel port. Whoever moved it patched the printer's cord across correctly, then "tidied" the front desk's cord
   out of its port: into the printer's old port (its run now to an empty jack), or a spare port with no run at all */
const SO14 = {
  id: "SO-14", n: "14", level: 2, tier: "more", title: "The printer moved desks; now the front desk is offline", priority: 2, due: "2 h", cablemap: true,
  build(seed) {
    const B = settled(seed), sim = B.sim, d = sim.d, net = sim.net, r = rng(hash("SO-14:" + seed)), kind = r.pick(["old", "spare"]);
    const free = r.shuffle(["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"]), P = { front: free[0], old: free[1], open: free[2], spare: free[3] };
    d.pp = { id: "pp", kind: "patchpanel", label: "Patch panel", sub: "24-port Cat6", on: true };
    d.ojack = { id: "ojack", kind: "jack", label: "Open-plan wall jack (the printer's old desk)", sub: "nothing plugged in", on: true };
    ["pp", "ojack"].forEach(function (id) { sim.arp[id] = {}; }); net.rooms.pp = "closet"; net.rooms.ojack = "open";
    if (d.switch && !sim.cablesOf("switch").length) { delete d.switch; delete net.rooms.switch; delete sim.arp.switch; }
    const pcRun = sim.cablesOf("pc")[0], prRun = sim.cablesOf("printer")[0];
    pcRun.a = { dev: "pp", port: P.front + "R", seated: true }; pcRun.b = { dev: "pc", port: "NIC", seated: true };
    prRun.a = { dev: "pp", port: P.old + "R", seated: true }; prRun.b = { dev: "ojack", port: "JACK", seated: true };   /* the printer's old run: its jack empty now */
    net.cables.push({ id: "c-run-print2", kind: "cat6", a: { dev: "pp", port: P.open + "R", seated: true }, b: { dev: "printer", port: "NET", seated: true }, cond: "good", length: OFFICE_RUN.closet.open + 4 });
    net.cables.push({ id: "c-cord-printer", kind: "cat6", a: { dev: "msw", port: "3", seated: true }, b: { dev: "pp", port: P.open, seated: true }, cond: "good", length: 0.5 });   /* moved across, correctly */
    net.cables.push({ id: "c-cord-pc", kind: "cat6", a: { dev: "msw", port: "2", seated: true }, b: { dev: "pp", port: kind === "old" ? P.old : P.spare, seated: true }, cond: "good", length: 0.5 });   /* "tidied" out of its port */
    const map = {}; map[P.front] = "front"; map[P.open] = "open"; map[P.old] = "open";   /* the map was kept up to date: the old jack is still a jack in the open-plan office */
    net.cablemap = map; d.pp.tabs = Object.assign({}, map);
    sim.relink(Object.assign(sim.links(), { pc: true }));
    return { sim: sim, v: { kind: kind, plan: B.plan, ports: P, pcRun: pcRun.id, story: r.pick(["it", "manager"]) } };
  },
  brief(v) {
    return { quote: "On Monday " + (v.story === "it" ? "our IT person" : "the office manager") + " moved the printer to the desk by the window and repatched it in the closet: the printer works fine at its new desk. But the front desk computer has had no network since. The cable map was updated for the printer's new jack." };
  },
  mason: "The map says where things should be. Check where they are.",
  affected: "pc",
  options() {
    return [
      { id: "right", right: true, text: "The front desk's patch cord was moved out of the front desk's panel port, so the front desk's run has no cord" },
      { id: "run", text: "Moving the printer damaged the front desk's run", why: "The cable tester passes every pin of the front desk's run, and the tone from its desk comes out at its own port on the panel." },
      { id: "map", text: "The cable map is wrong", why: "The tone from the front desk's cable lands at the port the map gives for the front desk: the map is right. It's the cord that isn't there." },
      { id: "shut", text: "The front desk's switch port is shut down", why: "show interfaces status says notconnect, not disabled: the port is on, but sees no link." },
      { id: "ip", text: "The printer's new desk took the front desk PC's address", why: "ipconfig on the front desk PC says Media disconnected: there's no link, so no address of any kind is in play." },
      { id: "swport", text: "The printer is now on the front desk's switch port", why: "The printer's cord runs down to the switch's port 3, its own. The front desk's port 2 has a cord that leads nowhere live." }
    ];
  },
  rung1() { return "On the front desk PC: ipconfig. On the switch: show interfaces status. Then the cable map against the patch panel: which port is the front desk's, and what's patched into it?"; },
  rung2() { return "A patch panel joins each run at its back to whatever is patched into the same port at its front. A port with a run and no cord is a desk with no network; a cord in a port with no live run is a switch port with nothing on it."; },
  fixHints() { return ["The map is right: use it to find the front desk's port on the panel.", "Put the front desk's cord back into that port.", "Then check the front desk PC has an address, and that the printer still prints."]; },
  exhibits(sim, v) { return !sim.hasLink("pc") && sim.hasLink("printer") && mapRight(sim) && !sim.cableAt("pp", v.ports.front); },
  fixed(sim) { return online(sim, "pc") && printOk(sim) && mapRight(sim); },
  partial(v, sim) { return !printOk(sim) ? "The front desk is back, but the printer isn't any more: its cord was the right one." : "The front desk is back, but the cable map no longer matches the panel: put it back, or the next technician will patch from a wrong map."; },
  proves(f) { return f.cmd === "ping" && f.dev === "pc" && f.beyond; },
  proofText: "a ping from the front desk PC that gets replies from something else",
  evidence: [
    { id: "ipc", test: function (f) { return f.cmd === "ipconfig" && f.dev === "pc" && f.media === "disconnected"; }, text: function () { return "ipconfig on the front desk PC: Media disconnected (no link)"; } },
    { id: "status", test: function (f) { return /^Gi0\/2\s+FRONT-DESK-PC\s+notconnect/m.test(swOut(f)); }, text: function () { return "show interfaces status: Gi0/2, the front desk's port, is notconnect"; } },
    { id: "probe", test: function (f, v) { return f.phys === "probe" && f.toned === v.pcRun && !!f.port; }, text: function (f) { return "Tone on the front desk's cable: the probe finds its run at the back of panel port " + f.port + ", with no cord in the front"; } },
    { id: "cord", test: function (f) { return f.phys === "look" && f.cable === "c-cord-pc"; }, text: function (f, v, sim) { return "The front desk's cord, from the switch's port 2, is in panel port " + sim.cable("c-cord-pc").b.port; } },
    { id: "test", test: function (f, v) { return f.phys === "test" && f.cable === v.pcRun; }, text: function () { return "Cable tester on the front desk's run: all eight pins pass"; } }
  ],
  summary(v) {
    return { cause: "When the printer was repatched for its new desk, the front desk's cord was " + (v.kind === "old" ? "moved into the printer's old panel port, whose run now ends at an empty jack" : "moved into a spare panel port with no run behind it") + ". The front desk's own port " + v.ports.front + " was left with its run and no cord.",
      fix: "Followed the map to the front desk's port " + v.ports.front + " (the tone confirmed it), and put the front desk's cord back there." };
  }
};

/* ---------------------------------------------------------------- SO-15 */
/* the fibre to the back office, cleaned on Friday and put back with its LC pair the wrong way round: each end's transmit
   on the other end's transmit. The right modules (SX at both ends) on the right fibre */
const SO15 = {
  id: "SO-15", n: "15", level: 2, tier: "more", title: "The fibre went dark after it was cleaned", priority: 2, due: "2 h",
  build(seed) {
    const B = settled(seed), sim = B.sim, r = rng(hash("SO-15:" + seed));
    fibreBackOffice(sim, r, "1000BASE-SX");
    sim.cable("c-fibre").polarity = "flipped";
    onSwitch(sim, ["configure terminal", "interface gi0/25", "description BACK-OFFICE-FIBRE", "no shutdown", "end"].concat(SAVE));
    sim.dhcp("mpc", "boot");
    return { sim: sim, v: { plan: B.plan, kind: r.pick(["closet", "back"]) } };
  },
  brief(v) {
    return { quote: "The fibre to the back office worked for months. On Friday the installer came back to clean the connectors at " + (v.kind === "closet" ? "the closet end" : "the back office's end") + ", tested both strands with his light meter (both passed), and plugged everything back in. Since then nothing in the back office connects." };
  },
  mason: "Light that leaves one end has to arrive where the other end listens.",
  affected: "mpc",
  options() {
    return [
      { id: "right", right: true, text: "The LC pair went back the wrong way round: each end's transmit faces the other end's transmit" },
      { id: "mismatch", text: "The two ends' SFP modules don't match", why: "Both modules' labels say 1000BASE-SX, 850 nm, multimode, and the fibre is multimode." },
      { id: "dirty", text: "The connectors are still dirty", why: "A dirty connector dims the light; it doesn't take it away. show interfaces transceiver reads nothing at all coming back." },
      { id: "broken", text: "A strand of the fibre broke while it was being cleaned", why: "The installer's light meter passed both strands after cleaning: light gets through each one." },
      { id: "shut", text: "The closet switch's fibre port is shut down", why: "show interfaces status says notconnect, not disabled: the port is open." },
      { id: "plus", text: "A 10 Gb/s module was fitted by mistake", why: "show inventory lists two 1000BASE-SX modules, and the port is notconnect, not err-disabled." }
    ];
  },
  rung1() { return "On the closet switch: show interfaces status and show interfaces transceiver. Then read both modules' labels, and think about which way each strand runs."; },
  rung2() { return "A duplex fibre has two strands, one each way: one end's transmit must land on the other end's receive. Swap them over at one end and both ends shout into each other's mouths, and nobody hears anything."; },
  fixHints() { return ["The modules are right and the fibre is good: it's how the two strands meet the modules.", "Swap the LC pair over at one end, not both.", "Then have the back office PC ask for its address again."]; },
  exhibits(sim) { const c = sim.cable("c-fibre"); return !!c && c.polarity === "flipped" && !sim.cableUp(c) && sim.hasLink("mpc"); },
  fixed(sim) { return sim.cableUp(sim.cable("c-fibre")) && online(sim, "mpc"); },
  proves(f) { return f.cmd === "ping" && f.dev === "mpc" && f.beyond; },
  proofText: "a ping from the back office PC that gets replies from beyond it",
  evidence: [
    { id: "ipc", test: function (f) { return f.cmd === "ipconfig" && f.dev === "mpc" && f.apipa; }, text: function () { return "ipconfig on the back office PC: a 169.254 address (no DHCP server reached)"; } },
    { id: "status", test: function (f) { return /^Gi0\/25\s.*\bnotconnect\b.*1000BaseSX/m.test(swOut(f)); }, text: function () { return "show interfaces status: Gi0/25, the fibre to the back office, notconnect, its module 1000BaseSX"; } },
    { id: "dom", test: function (f) { return /^Gi0\/25\s+.*-40\.0/m.test(swOut(f)); }, text: function () { return "show interfaces transceiver: Gi0/25 sends light (-5.6 dBm) and receives none (-40.0 dBm)"; } },
    { id: "lookc", test: function (f) { return f.phys === "look" && f.cable === "c-fibre" && f.end === "a"; }, text: function () { return "The closet's end: module labelled 1000BASE-SX, 850 nm, multimode; the cord's jacket orange, OM2 multimode"; } },
    { id: "lookb", test: function (f) { return f.phys === "look" && f.cable === "c-fibre" && f.end === "b"; }, text: function () { return "The back office's end: module labelled 1000BASE-SX, 850 nm, multimode"; } }
  ],
  summary(v) {
    return { cause: "When the connectors were cleaned at " + (v.kind === "closet" ? "the closet end" : "the back office's end") + ", the LC pair went back the wrong way round: each end's transmit strand landed on the other end's transmit. Both strands were good and both modules right; neither end received any light.",
      fix: "Swapped the LC pair over at one end, then had the back office PC ask for its address again." };
  }
};

/* ---------------------------------------------------------------- SO-09 */
/* the office has started using SO-J4's address plan, ready for next year's VLANs: the router hands out only the Staff
   block, and each fixed device takes the first address after its block's gateway, keeping the office's mask and
   gateway for now. One block was written on top of another on the sheet, so the printer and the switch were both
   given the same address: whichever answers the ARP question gets the traffic */
const groupAt = function (net, name) { return net.plan.ipam.groups.findIndex(function (g) { return g[0] === name; }); };
const blockRow = function (n, p, mask) { const sz = Math.pow(2, 32 - p); return { net: n2ip(n), mask: mask, first: n2ip(n + 1), last: n2ip(n + sz - 2), bc: n2ip(n + sz - 1), gw: n2ip(n + 1) }; };
const owners = function (sim, ip) { const r = sim.route("pc", ip); return r.local ? r.owner : []; };
const clash = function (sim) { const o = owners(sim, sim.d.printer.ifaces[0].cfg.ip); return o.length > 1; };
const sheetOk = function (sim) { return checkSheet(sim.net.plan.ipam.block, sheetRows(sim.net)).every(function (r) { return r.ok; }); };
const dotted = function (m) { m = m.replace(/[^0-9a-f]/gi, "").toLowerCase(); return m.slice(0, 4) + "." + m.slice(4, 8) + "." + m.slice(8, 12); };
const SO09 = {
  id: "SO-09", n: "09", level: 2, tier: "harder", title: "Two groups fighting over addresses", priority: 2, due: "2 h", ipam: true,
  build(seed) {
    const B = settled(seed), sim = B.sim, p = B.plan, net = sim.net, r = rng(hash("SO-09:" + seed));
    const P = groupAt(net, "Printers and servers"), G = groupAt(net, "Network gear"), S = groupAt(net, "Staff");
    const kind = r.pick(["gear", "printers"]), moved = kind === "gear" ? G : P, onto = kind === "gear" ? P : G;
    const rows = net.ipam.map(function (o) { return Object.assign({}, o); }), orig = Object.assign({}, rows[moved]);
    rows[moved] = blockRow(ip2n(rows[onto].net), prefixOf(orig.mask), orig.mask);   /* written on top of the other group's block: same start */
    net.ipam = rows;
    const addr = n2ip(ip2n(rows[onto].net) + 2);   /* the first address after the gateway, in both blocks */
    /* DHCP now hands out only the Staff block (its gateway, the router, kept out); the front desk PC has renewed into it */
    sim.d.router.dhcp.start = n2ip(ip2n(rows[S].first) + 1); sim.d.router.dhcp.end = rows[S].last; sim.dhcp("pc", "boot");
    const pr = sim.d.printer; pr.ifaces[0].cfg.ip = addr; pr.sub = addr; sim.d.pc.printer.port = addr;
    onSwitch(sim, ["configure terminal", "interface vlan 1", "ip address " + addr + " " + p.mask, "end"].concat(SAVE));
    return { sim: sim, v: { kind: kind, plan: p, addr: addr, P: P, G: G, moved: moved, onto: onto, orig: orig, story: r.pick(["friday", "parttime"]) } };
  },
  brief(v) {
    return { quote: "Since last week the printer works every other page, and SSH to the switch from the front desk is just as random: one try asks for the password, the next is refused. Last week we started using the address plan on our IPAM sheet, ready for next year's VLANs: the router now hands out only the Staff block, and each fixed device took the first address after its own block's gateway, keeping the office's mask and gateway for now. " +
      (v.story === "friday" ? "The printer and the switch were both renumbered on Friday, from the sheet." : "Our part-time IT person renumbered the printer on Wednesday and the switch on Friday, both from the sheet.") };
  },
  mason: "When something works every other time, ask who's answering.",
  records(v) { const p = v.plan; return [["The switch", p.hostname + " · management address: the first address after the Network gear block's gateway, on the IPAM sheet · mask " + p.mask + " · gateway " + p.gw], ["Console password", p.console], ["Enable secret", p.secret], ["Remote logins (SSH)", "user " + p.user + " · password " + p.userPw]]; },
  affected: "pc",
  options(v) {
    return [
      { id: "right", right: true, text: "Two blocks on the IPAM sheet overlap, so the printer and the switch were both given the same address" },
      { id: "dhcp", text: "The router's DHCP has handed the printer's address to a computer", why: "DHCP hands out only the Staff block now, and its clients list has nothing at that address. The two hardware addresses taking turns there are the printer's and the switch's." },
      { id: "nic", text: "The printer's network card is failing", why: "Each page that never came out went to the switch: arp -a showed the switch's hardware address at the printer's address just then. The printer prints every page that reaches it." },
      { id: "duplex", text: "The printer's switch port and the printer disagree on duplex", why: "Pings to the printer's address lose nothing, and the printer's port is still set by hand to match it. A duplex mismatch slows every page; this fails every other one." },
      { id: "keys", text: "The switch's SSH keys are damaged", why: "When SSH is refused it's the printer that answered (arp -a has the printer's hardware address then); the next try reaches the switch, which asks for the password." },
      { id: "port", text: "The front desk PC's printer is set up with the wrong address", why: "It points at the address on the printer's own control panel. The trouble is that something else answers at that address too." }
    ];
  },
  rung1() { return "On the front desk PC: print a test page twice, with arp -a after each. On your laptop's console: what does the switch say by itself? Then check the office's IPAM sheet."; },
  rung2() { return "Two devices can't share an address: whichever answers the ARP question gets the traffic, so things work every other time. Blocks on an address plan mustn't share addresses either, or the devices numbered from them can land on the same one."; },
  fixHints() { return ["Start with the records: the sheet has to be right before anything is numbered from it.", "Write the block that sits on top of another where it belongs, then give its device a free address inside it. The office's mask and gateway stay as they are.", "Save the switch if you changed it, point the front desk PC at the printer if the printer moved, and print a test page."]; },
  exhibits(sim, v) { return SW_(sim).vlan1.ip === v.addr && sim.d.printer.ifaces[0].cfg.ip === v.addr && clash(sim) && !sheetOk(sim); },
  fixed(sim, v) {
    if (!sheetOk(sim)) return false;
    const rows = sheetRows(sim.net), sw = SW_(sim), st = sw.startup, pr = sim.d.printer.ifaces[0].cfg, p = v.plan;
    const ok = function (c) { return usableIn(c.vlan1.ip, rows[v.G]) && c.vlan1.mask === p.mask && !c.vlan1.shutdown; };
    if (!ok(sw) || !st || !ok(st) || st.vlan1.ip !== sw.vlan1.ip) return false;
    if (pr.mode !== "static" || !usableIn(pr.ip, rows[v.P]) || pr.mask !== p.mask || pr.gw !== p.gw) return false;
    const a = owners(sim, sw.vlan1.ip), b = owners(sim, pr.ip);
    return a.length === 1 && a[0] === "msw" && b.length === 1 && b[0] === "printer" && sim.d.pc.printer.port === pr.ip;
  },
  partial(v, sim) {
    if (clash(sim)) return "That one came out, but will the next? The printer and the switch still answer at the same address.";
    if (!sheetOk(sim)) return "It works now, but the IPAM sheet still has two blocks sharing addresses: the next device numbered from it lands on somebody else's address.";
    const sw = SW_(sim); if (sw.startup && sw.startup.vlan1.ip !== sw.vlan1.ip) return "It works now, but the switch hasn't saved its new address: the next power cut puts it back on the printer's.";
    return "It works now, but the records and the network disagree: each device belongs inside its own group's block on the sheet.";
  },
  proves(f, sim) { return (f.print === "ok" && !f.slow) || (f.cmd === "ssh" && f.dev === "pc" && f.login && f.host === SW_(sim).vlan1.ip); },
  proofText: "a test page from the front desk PC, or an SSH login to the switch",
  evidence: [
    { id: "printfail", test: function (f, v, sim) { return f.print === "fail" && clash(sim); }, text: function () { return "Test page from the front desk PC: nothing came out"; } },
    { id: "printok", test: function (f, v, sim) { return f.print === "ok" && clash(sim); }, text: function () { return "Test page from the front desk PC: this one printed"; } },
    { id: "refused", test: function (f, v, sim) { return f.cmd === "ssh" && f.dev === "pc" && f.why === "no-ssh" && clash(sim); }, text: function (f) { return "ssh from the front desk PC to " + f.host + ": Connection refused"; } },
    { id: "asked", test: function (f, v, sim) { return f.cmd === "ssh" && f.dev === "pc" && f.asked && clash(sim); }, text: function (f) { return "ssh from the front desk PC to " + f.host + ": this time it asked for a password"; } },
    { id: "arpsw", test: function (f, v, sim) { return f.cmd === "arp" && f.dev === "pc" && clash(sim) && (f.entries || []).some(function (e) { return e[0] === v.addr && e[1] === sim.macOf("msw"); }); }, text: function (f, v, sim) { return "arp -a on the front desk PC: " + v.addr + " at " + sim.macOf("msw"); } },
    { id: "arppr", test: function (f, v, sim) { return f.cmd === "arp" && f.dev === "pc" && clash(sim) && (f.entries || []).some(function (e) { return e[0] === v.addr && e[1] === sim.macOf("printer"); }); }, text: function (f, v, sim) { return "arp -a on the front desk PC: " + v.addr + " at " + sim.macOf("printer"); } },
    { id: "dup", test: function (f) { return /%IP-4-DUPADDR/.test(swOut(f)); }, text: function (f, v, sim) { return "The switch's console: %IP-4-DUPADDR, its own address " + v.addr + " answered by another device too (" + dotted(sim.macOf("printer")) + ")"; } },
    { id: "panel", test: function (f, v, sim) { return f.page === "printer-panel" && clash(sim); }, text: function (f, v) { return "The printer's control panel: its address is " + v.addr; } },
    { id: "brief", test: function (f, v) { return new RegExp("Vlan1\\s+" + v.addr.replace(/\./g, "\\.") + "\\s").test(swOut(f)); }, text: function (f, v) { return "show ip interface brief: Vlan1 on " + v.addr; } },
    { id: "sheet", test: function (f) { return !!f.ipam && f.sheet.some(function (r) { return r.issues.some(function (x) { return /^Overlap/.test(x.text); }); }); }, text: function (f, v, sim) { const g = sim.net.plan.ipam.groups, n = f.sheet.map(function (r, i) { return r.issues.some(function (x) { return /^Overlap/.test(x.text); }) ? g[i][0] : null; }).filter(Boolean); return "The IPAM sheet, checked: " + n.join(" and ") + " share addresses"; } }
  ],
  summary(v) {
    const g = ["Staff", "Guests", "Printers and servers", "Network gear"], mv = v.kind === "gear" ? "Network gear" : "Printers and servers", on = v.kind === "gear" ? "Printers and servers" : "Network gear";
    return { cause: "On the IPAM sheet the " + mv + " block had been written on top of the " + on + " block, starting at the same address. Each group's first device takes the address after its block's gateway, so the printer and the switch were both given " + v.addr + ". Whichever answered the ARP question got the traffic: every other page and every other SSH went to the wrong device, and the switch logged the duplicate.",
      fix: "Wrote the block where it belongs, so no two blocks share an address; gave its device a free address inside it (" + (v.kind === "gear" ? "the switch, saved" : "the printer, with the front desk PC pointed at it") + "); then printed a test page." };
  }
};

export const OFFICE_TICKETS = [SO01, SO02, SO03, SO04, SO05, SO06, SO07, SO08, SO09, SO10, SO11, SO12, SO13, SO14, SO15];
export { ROOM_NAME };
export const OFFICE_COMING = [];
