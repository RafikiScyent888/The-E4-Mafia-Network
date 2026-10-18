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
import { rng, hash, mac } from "../net/util.js";
import { OFFICE_RUN } from "../net/office.js";

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

export const OFFICE_TICKETS = [SO01, SO02, SO03, SO04, SO05];
export const OFFICE_COMING = [];
