/* Client jobs for build mode, the small office (level 2). The office as the
   technician finds it: the provider's modem and router on the closet shelf,
   the old unmanaged switch running the office, the new managed switch in
   its box, the technician's laptop with its console cable. The work is done
   on the switch's own command line, from the console and then over SSH, and
   every line of a work order is checked against the switch and the network
   as they really are. Each line is an ordered list of causes, as on the
   home jobs, so Mason's third rung can strike the ones the network has
   ruled out and leave two. None of it ever says what to type. */
import { makeOffice } from "../net/office.js";
import { Sim } from "../net/sim.js";
import { exec } from "../net/cmd.js";
import { unsaved, duplexEnds, PORT_NAMES, configText } from "../net/swcli.js";
import { online } from "./jobs.js";
import { checkSheet, parseBlock } from "../net/ipam.js";
import { ip2n, n2ip } from "../net/util.js";

const C = function (id, on, text, not, ev, skip) { return { id: id, on: !!on, text: text, not: not, ev: ev, skip: !!skip }; };
const E = function (dev, port) { return { dev: dev, port: port }; };
const cli = function (line) { return { t: "cmd", dev: "tech", line: line, cli: true }; };
const SW = function (sim) { return sim.d.msw.sw; };
const consoleCable = function (sim) { return sim.cablesOf("msw").find(function (c) { return c.kind === "console"; }) || null; };
/* the cable from a device to one of the managed switch's numbered ports, or null */
const onMsw = function (sim, id) { return sim.cablesOf(id).find(function (c) { const e = c.a.dev === "msw" ? c.a : c.b.dev === "msw" ? c.b : null; return e && /^\d+$/.test(e.port); }) || null; };
const printOk = function (sim) { const ip = sim.d.printer.ifaces[0].cfg.ip, r = sim.route("pc", ip); return !!(r.local && r.owner.indexOf("printer") >= 0); };

/* ---------------------------------------------------------------- the lines both jobs share */
const boxCause = function (sim) { return C("box", sim.d.msw.boxed, "The new switch is still in its box", "The switch is out of its box, in the rack.", "The managed switch is still in its box."); };
function savedCauses(sim) {
  const sw = SW(sim);
  return [boxCause(sim),
    C("never", !sw.startup, "Nothing is saved yet: a power cut would bring back the factory settings", "Its configuration has been saved.", "show startup-config: startup-config is not present."),
    C("since", !!sw.startup && unsaved(sw), "There are changes since it was last saved", "What's running is what's saved.", "The running configuration and the startup configuration differ.")];
}
const L_SAVED = {
  id: "saved", text: "The setup survives a power cut",
  causes: savedCauses,
  ok: function () { return "What's running is saved: it comes back after a reload or a power cut."; },
  rung1: function () { return "On the switch: compare show running-config with show startup-config."; },
  rung2: function () { return "Changes take effect at once in the running configuration, which lives in memory. Only what's copied to the startup configuration comes back after a reload or a power cut."; }
};

/* ---------------------------------------------------------------- SO-J1 */
function rackCauses(sim) {
  const c = consoleCable(sim);
  return [boxCause(sim),
    C("cable", !c, "Nothing joins your laptop to the switch's CONSOLE port", "The console cable is in.", "Your laptop's serial terminal: nothing answers on COM3."),
    C("seat", !!c && !sim.cableUp(c), "The console cable isn't seated at one end", "The console cable is seated at both ends.", "Nothing answers on COM3; the console cable is there.")];
}
function nameCauses(sim, v) {
  const sw = SW(sim);
  return [boxCause(sim),
    C("factory", sw.hostname === "Switch", "It still has its factory name", "It has a name of its own.", "The prompt still says Switch."),
    C("plan", sw.hostname !== v.plan.hostname, "It has a name, but not the one in the office's records", "Its name is the one in the office's records.", "The prompt says " + sw.hostname + ".")];
}
function secretCauses(sim, v) {
  const sw = SW(sim);
  return [boxCause(sim),
    C("none", !sw.enableSecret && !sw.enablePassword, "Anyone at the console can type enable and change anything", "Privileged mode is protected.", "enable goes straight to privileged mode, with no password."),
    C("plain", !sw.enableSecret && !!sw.enablePassword, "Only an enable password is set: it sits in the configuration as plain text", "An enable secret is set, stored as a hash.", "show running-config shows the enable password in plain text."),
    C("wrong", !!sw.enableSecret && sw.enableSecret !== v.plan.secret, "An enable secret is set, but it isn't the one in the office's records", "The enable secret is the office's.", "The office's enable secret doesn't open privileged mode.")];
}
function consoleCauses(sim, v) {
  const con = SW(sim).con;
  return [boxCause(sim),
    C("none", !con.password, "The console line has no password", "The console line has a password.", "line con 0 has no password."),
    C("nologin", !!con.password && !con.login, "The console line has a password, but never asks for it", "The console line asks for its password.", "Log out of the console, press RETURN: it goes straight in."),
    C("local", con.login === "local", "The console line checks user names the switch doesn't use for it, not the console password", "The console checks its own password.", "line con 0 is set to login local."),
    C("wrong", !!con.password && con.password !== v.plan.console, "The console asks for a password, but not the one in the office's records", "The console password is the office's.", "The office's console password isn't accepted.")];
}
function keepCauses(sim) {
  return [
    C("pc", !online(sim, "pc"), "The front desk PC isn't online any more", "The front desk PC is online.", "The front desk PC can't reach the internet."),
    C("print", !printOk(sim), "The front desk PC can't reach the printer", "The front desk PC reaches the printer.", "Test pages from the front desk don't print.")];
}
const SO1 = {
  id: "SO-J1", level: "office", title: "Out of the box: name it, lock it, save it",
  already: ["keep"],
  start(seed) { const net = makeOffice(seed), sim = new Sim(net); sim.boot(["pc"]); return { sim: sim, v: { plan: net.plan } }; },
  brief(v, sim) { return { quote: "We've finally bought a proper switch for the closet. Can you set it up so it's ours: named the way our records say, locked, and not something anyone walking past with a laptop can change? The old switch keeps the office running for now; you're moving everything across on your next visit.", from: "the new managed switch, still in its box" }; },
  mason: "Console first: a new switch has no address, so its console port is the only way in. Show, change, then show again to prove it.",
  limits: function (v) { return ["The office's records: this switch is " + v.plan.hostname + ". Enable secret: " + v.plan.secret + ". Console password: " + v.plan.console + ".", "Your laptop is on the closet shelf with its console cable (1.8 m) and USB serial adapter: its serial terminal is set for 9600 baud, 8 data bits, no parity, 1 stop bit.", "The old 8-port switch keeps the office running on this visit: leave its cables where they are."]; },
  reqs: [{
    id: "rack", text: "The new switch is in the closet rack, with your laptop on its console port",
    causes: rackCauses,
    ok: function () { return "The switch is in the rack; your laptop's serial terminal reaches its console."; },
    rung1: function () { return "Look at what's still in its box, then at your laptop's Serial terminal: does anything answer?"; },
    rung2: function () { return "A switch fresh from its box has no address: the only way in is its console port, with a console cable from a computer's serial port or a USB serial adapter."; }
  }, {
    id: "name", text: "It has its name from the office's records",
    causes: nameCauses,
    ok: function (sim) { return "It's called " + SW(sim).hostname + "."; },
    rung1: function () { return "On the switch: show running-config, and read its first lines. The prompt says it too."; },
    rung2: function () { return "A switch's name is set in global configuration mode, and the prompt changes the moment it's set."; }
  }, {
    id: "secret", text: "Privileged mode needs the office's enable secret",
    causes: secretCauses,
    ok: function () { return "An enable secret is set (stored as a hash, never in plain text)."; },
    rung1: function () { return "show running-config: how is privileged mode protected, and how is that stored?"; },
    rung2: function () { return "An enable secret is stored as a one-way hash; an enable password is kept in plain text, and isn't used at all once a secret is set. The secret is the one to set."; }
  }, {
    id: "console", text: "The console asks for the office's console password",
    causes: consoleCauses,
    ok: function () { return "The console line asks for its password."; },
    rung1: function () { return "Log out of the console (exit) and press RETURN: does it ask for anything? Then read line con 0 in the running configuration."; },
    rung2: function () { return "A line's password only counts when the line is told to ask for it: the password and the login together, on that line."; }
  }, L_SAVED, {
    id: "keep", text: "Everything that worked still works: the front desk PC online, and printing",
    causes: keepCauses,
    ok: function () { return "The front desk PC is online and reaches the printer."; },
    rung1: function () { return "On the front desk PC: ipconfig, then ping the router and the printer. Then look at the old switch's lights."; },
    rung2: function () { return "On this visit the old switch carries the office. Anything that moves its cables takes the desks off the network."; }
  }],
  solve(v) {
    const p = v.plan;
    return [{ t: "place", dev: "msw", room: "closet" }, { t: "lay", a: E("tech", "USB-C"), b: E("msw", "CONSOLE") },
      cli(""), cli("enable"), cli("configure terminal"), cli("hostname " + p.hostname), cli("enable secret " + p.secret), cli("line console 0"), cli("password " + p.console), cli("login"), cli("end"), cli("copy running-config startup-config"), cli("")];
  },
  answer(v) {
    return ["Take the switch out of its box and place it in the closet (its rack). Lay the console cable from your laptop's USB-C (the serial adapter) to the switch's CONSOLE port.",
      "Open your laptop's Serial terminal, press RETURN, then: enable, configure terminal.",
      "hostname " + v.plan.hostname + "; enable secret (the office's); line console 0, password (the office's), login; end.",
      "copy running-config startup-config (press RETURN to accept the name). Check with show running-config, and by logging out and back in."];
  },
  summary(v, sim) {
    return ["The new switch is in the closet rack, named " + SW(sim).hostname + " as the office's records say.",
      "Privileged mode needs the enable secret, stored as a hash; the console asks for its password.",
      "It's all saved: it survives a power cut.", "The old switch still runs the office, untouched, until the next visit."];
  }
};

/* ---------------------------------------------------------------- SO-J2 */
function moveCauses(sim) {
  const old = sim.cablesOf("switch").filter(function (c) { return c.kind === "cat6"; });
  return [boxCause(sim),
    C("router", !onMsw(sim, "router"), "The router isn't cabled to the new switch", "The router is cabled to the new switch.", "Nothing from the router reaches the new switch."),
    C("pc", !onMsw(sim, "pc"), "The front desk PC isn't cabled to the new switch", "The front desk PC is cabled to it.", "The front desk PC's cable doesn't go to the new switch."),
    C("printer", !onMsw(sim, "printer"), "The printer isn't cabled to the new switch", "The printer is cabled to it.", "The printer's cable doesn't go to the new switch."),
    C("old", old.length > 0, "The old switch still has cables in it", "The old switch is empty, out of use.", "The old switch's lights are still on.")];
}
function deskCauses(sim) {
  const c = onMsw(sim, "pc"), a = sim.addr("pc");
  return [boxCause(sim),
    C("link", !c || !sim.cableUp(c), "The front desk PC's port on the new switch has no link", "The front desk PC's port has a link.", "The front desk PC says: media disconnected."),
    C("addr", !a || a.kind === "apipa", "The front desk PC has no address from the router", "It has an address from the router.", "ipconfig on the front desk PC: " + (a ? a.ip : "no address") + "."),
    C("net", !online(sim, "pc"), "The front desk PC can't reach the internet", "It reaches the internet.", "The front desk PC can't reach the internet."),
    C("print", !printOk(sim), "The front desk PC can't reach the printer", "It reaches the printer.", "Test pages from the front desk don't print.")];
}
function mgmtCauses(sim, v) {
  const sw = SW(sim), v1 = sw.vlan1, r = sim.route("pc", v.plan.ip);
  return [boxCause(sim),
    C("none", !v1.ip, "The switch has no address of its own yet", "It has an address on VLAN 1.", "show ip interface brief: Vlan1 unassigned."),
    C("shut", !!v1.ip && v1.shutdown, "Its address is set, but the interface it's on is shut down", "Its VLAN 1 interface is up.", "show ip interface brief: Vlan1 administratively down."),
    C("wrong", !!v1.ip && v1.ip !== v.plan.ip, "Its address isn't the one in the office's records", "Its address is the office's.", "The switch answers at " + v1.ip + "."),
    C("mask", !!v1.ip && v1.mask !== v.plan.mask, "Its subnet mask doesn't match the office's network", "Its mask matches the office's network.", "Its address has a different mask from the office's network."),
    C("reach", !(r.local && r.owner.indexOf("msw") >= 0), "The front desk PC can't reach it", "The front desk PC reaches it.", "ping from the front desk PC: no reply from the switch.")];
}
function gwCauses(sim, v) {
  const sw = SW(sim);
  return [boxCause(sim),
    C("none", !sw.gateway, "The switch has no default gateway: it can answer its own network, but nothing beyond the router", "It has a default gateway.", "show running-config: no ip default-gateway."),
    C("wrong", !!sw.gateway && sw.gateway !== v.plan.gw, "Its default gateway isn't the office router", "Its default gateway is the office router.", "Its default gateway is " + sw.gateway + ".")];
}
function sshCauses(sim, v) {
  const sw = SW(sim), vty = sw.vty;
  return [boxCause(sim),
    C("domain", !sw.domain && !sw.rsa, "The switch has no domain name, so it can't make its SSH keys", "It has a domain name.", "ssh from the front desk PC: connection refused."),
    C("keys", !sw.rsa, "The switch has no SSH keys yet", "It has its SSH keys.", "ssh from the front desk PC: connection refused."),
    C("short", !!sw.rsa && sw.rsa < 768, "Its keys are too short for SSH version 2 (768 bits or more)", "Its keys are long enough for SSH version 2.", "ssh from the front desk PC is turned away: the switch offers only the old SSH version 1."),
    C("telnet", /^(telnet|all)$/.test(vty.transport), "The remote lines still take Telnet, which sends everything in the clear", "Telnet is off.", "telnet from the front desk PC still connects, or SSH is refused."),
    C("off", vty.transport === "none", "The remote lines take no logins at all", "The remote lines take SSH.", "ssh from the front desk PC: connection refused."),
    C("login", vty.login !== "local", "The remote lines don't check user names", "The remote lines check user names.", "ssh from the front desk PC can't log in."),
    C("user", sw.users[v.plan.user] !== v.plan.userPw, "The office's user name isn't on the switch with its password", "The office's user is on the switch.", "ssh as the office's user: permission denied.")];
}
const SO2 = {
  id: "SO-J2", level: "office", title: "Remote management: an address, SSH only",
  already: ["saved"],
  start(seed) {
    const b = SO1.start(seed), sim = b.sim;
    for (const a of SO1.solve(b.v)) { if (a.t === "cmd") exec(sim, a.dev, a.line); else sim.apply(a); }
    sim.cli = {};   /* a day later: the console asks for its password again */
    return { sim: sim, v: b.v };
  },
  brief(v, sim) { return { quote: "Last week's switch is ready, so today's the day: move the office off the old switch, and make the new one something you can look after from the front desk, without walking to the closet. Our IT policy says no Telnet: it sends passwords in the clear.", from: "moving the office onto the new switch" }; },
  mason: "Move the cables first, then give the switch its own address. Prove each step from the front desk PC: ping it, then log in to it.",
  limits: function (v) { return ["The office's records: the switch's management address is " + v.plan.ip + " (mask " + v.plan.mask + "), its gateway the office router, " + v.plan.gw + ". Its domain: " + v.plan.domain + ".", "Remote logins: user " + v.plan.user + ", password " + v.plan.userPw + ". The enable secret and the console password are last week's: " + v.plan.secret + " and " + v.plan.console + ".", "The office's cables run back to the closet: the front desk PC and the printer are 18 m and 12 m away. Pull a cable before you lay it somewhere new."]; },
  reqs: [{
    id: "move", text: "The office runs through the new switch: the router and both desks on it, the old switch out of use",
    causes: moveCauses,
    ok: function () { return "The router, the front desk PC and the printer are cabled to the new switch; the old switch is empty."; },
    rung1: function () { return "Read the Cable runs table, then both switches' Lights pages."; },
    rung2: function () { return "Moving a network to a new switch is a cable at a time: pull it from the old switch, lay it into the new one. A device's address stays the same; only the switch between them changes."; }
  }, {
    id: "online", text: "Both desks online through it: the front desk PC on the internet, and printing",
    causes: deskCauses,
    ok: function () { return "The front desk PC is online through the new switch and reaches the printer."; },
    rung1: function () { return "On the front desk PC: ipconfig, then ping the router and the printer. On the switch: show interfaces status."; },
    rung2: function () { return "Every port on a new switch is on and negotiates by itself. A port only stops carrying traffic if it's shut down or set to something the other end can't match."; }
  }, {
    id: "mgmt", text: "The switch answers at its management address, from the front desk PC",
    causes: mgmtCauses,
    ok: function (sim) { return "The switch answers at " + SW(sim).vlan1.ip + " from the front desk PC."; },
    rung1: function () { return "On the switch: show ip interface brief. On the front desk PC: ping the switch's address."; },
    rung2: function () { return "A layer 2 switch's own address isn't on a port: it's on its VLAN interface, which has to be brought up like any interface. The address and mask must fit the network it's on."; }
  }, {
    id: "gw", text: "It has a default gateway: the office router",
    causes: gwCauses,
    ok: function () { return "Its default gateway is the office router."; },
    rung1: function () { return "show running-config on the switch: what does it send traffic for other networks to?"; },
    rung2: function () { return "A switch that doesn't route still needs a default gateway, or it can only answer devices on its own network: anyone managing it from elsewhere gets nothing back."; }
  }, {
    id: "ssh", text: "Remote logins are by SSH only, with the office's user name: Telnet is off",
    causes: sshCauses,
    ok: function () { return "SSH logins with the office's user name work; Telnet is refused."; },
    rung1: function () { return "From the front desk PC: ssh as the office's user to the switch, then telnet to it. On the switch: show running-config, the vty lines."; },
    rung2: function () { return "SSH needs keys, and the keys need a name for the switch and a domain to make them from. The remote (vty) lines decide which protocols they take, and whether they check user names."; }
  }, L_SAVED],
  solve(v) {
    const p = v.plan;
    return [{ t: "pull", cable: "c-router-old" }, { t: "pull", cable: "c-old-pc" }, { t: "pull", cable: "c-old-printer" },
      { t: "lay", a: E("router", "LAN 1"), b: E("msw", "1") }, { t: "lay", a: E("msw", "2"), b: E("pc", "NIC") }, { t: "lay", a: E("msw", "3"), b: E("printer", "NET") },
      cli(""), cli(p.console), cli("enable"), cli(p.secret), cli("configure terminal"), cli("interface vlan 1"), cli("ip address " + p.ip + " " + p.mask), cli("no shutdown"), cli("exit"),
      cli("ip default-gateway " + p.gw), cli("ip domain-name " + p.domain), cli("crypto key generate rsa modulus 2048"), cli("username " + p.user + " secret " + p.userPw),
      cli("line vty 0 15"), cli("login local"), cli("transport input ssh"), cli("end"), cli("copy running-config startup-config"), cli("")];
  },
  answer(v) {
    return ["Pull the router's, the front desk PC's and the printer's cables out of the old switch; lay the router's LAN 1 and both desks into the new switch's ports.",
      "On the console (its password, then enable and the secret): configure terminal; interface vlan 1, ip address " + v.plan.ip + " " + v.plan.mask + ", no shutdown; exit.",
      "ip default-gateway " + v.plan.gw + "; ip domain-name " + v.plan.domain + "; crypto key generate rsa (2048 bits); username " + v.plan.user + " secret (the office's).",
      "line vty 0 15: login local, transport input ssh; end; copy running-config startup-config. From the front desk PC: ping the switch, ssh " + v.plan.user + "@" + v.plan.ip + ", and telnet to see it refused."];
  },
  summary(v, sim) {
    return ["The office runs through the new switch; the old one is out of use.", "The switch answers at " + SW(sim).vlan1.ip + ", with the office router as its gateway.",
      "It takes SSH logins with the office's user name, and refuses Telnet.", "It's all saved."];
  }
};

/* ---------------------------------------------------------------- SO-J3 */
const WHO = { router: "the router", pc: "the front desk PC", printer: "the printer" };
/* the managed switch's port a device is cabled to ("GigabitEthernet0/3"), or null */
const portOf = function (sim, id) { const c = onMsw(sim, id); if (!c) return null; return "GigabitEthernet0/" + (c.a.dev === "msw" ? c.a.port : c.b.port); };
const shortPort = function (n) { return n.replace("GigabitEthernet", "Gi"); };
function descCauses(sim, v) {
  const sw = SW(sim), want = v.plan.desc, ids = ["router", "pc", "printer"].filter(function (id) { return portOf(sim, id); });
  const has = function (id) { return (sw.ports[portOf(sim, id)].desc || "").trim().toUpperCase(); };
  const blank = ids.find(function (id) { return !has(id); });
  const swapped = ids.find(function (id) { const d = has(id); return d && d !== want[id] && ids.some(function (o) { return o !== id && want[o] === d; }); });
  const wrong = ids.find(function (id) { const d = has(id); return d && d !== want[id]; });
  return [
    C("none", !!blank, "Some ports in use have no description", "Every port in use has a description.", blank ? "show interfaces status: the Name column is empty on " + shortPort(portOf(sim, blank)) + ", " + WHO[blank] + "'s port." : ""),
    C("swap", !!swapped, "A description is on the wrong port: it names another device", "Each description is on its own device's port.", swapped ? shortPort(portOf(sim, swapped)) + " is " + WHO[swapped] + "'s port, but it's named " + has(swapped) + "." : ""),
    C("wrong", !!wrong, "A description isn't the one in the office's records", "Every description matches the office's records.", wrong ? shortPort(portOf(sim, wrong)) + " is named " + has(wrong) + "." : "")];
}
function printerCauses(sim) {
  const sw = SW(sim), n = portOf(sim, "printer"), p = n && sw.ports[n], l = n && sim.switchLinks("msw")[n];   /* read, never sync: a check changes nothing */
  const up = !!(p && l && !p.shutdown && !(p.speed !== "auto" && l.speed && l.speed !== "auto" && p.speed !== l.speed));
  const d = up ? duplexEnds(p, l) : null;
  return [
    C("link", !up, "The printer's port has no link", "The printer's port has a link.", n ? "show interfaces status: " + shortPort(n) + " is " + (p && p.shutdown ? "disabled" : "notconnect") + "." : "The printer isn't cabled to the new switch."),
    C("auto", up && d.mismatch && p.duplex === "auto", "The port is left to negotiate, but the printer can't: the switch falls back to half duplex while the printer runs full", "The port's duplex is set, not left to negotiate.", "show interfaces " + (n ? shortPort(n) : "") + ": Half-duplex, and the late collisions climb every time you look."),
    C("half", up && d.mismatch && p.duplex === "half", "The port is forced to half duplex; the printer runs full", "The port runs full duplex, like the printer.", "show interfaces " + (n ? shortPort(n) : "") + ": Half-duplex, late collisions climbing."),
    C("speed", up && !d.mismatch && p.speed === "auto", "Its duplex is set, but its speed is still left to negotiate: set both to match a device that can't negotiate", "Its speed is set to match the printer.", "show running-config: " + (n ? "interface " + n : "the printer's port") + " has a duplex line but no speed line.")];
}
function unusedCauses(sim) {
  const sw = SW(sim), used = {};
  ["router", "pc", "printer"].forEach(function (id) { const n = portOf(sim, id); if (n) used[n] = id; });
  const cut = Object.keys(used).find(function (n) { return sw.ports[n].shutdown; });
  const open = PORT_NAMES.find(function (n) { return !used[n] && !sw.ports[n].sfp && !sw.ports[n].shutdown; });
  const sfp = PORT_NAMES.find(function (n) { return !used[n] && sw.ports[n].sfp && !sw.ports[n].shutdown; });
  return [
    C("used", !!cut, "A port that's in use has been shut down", "Every port in use is on.", cut ? "show interfaces status: " + shortPort(cut) + ", " + WHO[used[cut]] + "'s port, is disabled." : ""),
    C("open", !!open, "Unused ports are still live: anyone in the office could plug something in", "Every unused copper port is shut down.", open ? "show interfaces status: " + shortPort(open) + " is notconnect, not disabled." : ""),
    C("sfp", !!sfp, "The fibre slots are unused but still live", "The unused fibre slots are shut down too.", sfp ? "show interfaces status: " + shortPort(sfp) + " (a fibre slot) is notconnect, not disabled." : "")];
}
const SO3 = {
  id: "SO-J3", level: "office", title: "The ports: descriptions, the printer's speed and duplex, unused ports shut",
  already: ["keep", "saved"],
  start(seed) {
    const b = SO2.start(seed), sim = b.sim;
    for (const a of SO2.solve(b.v)) { if (a.t === "cmd") exec(sim, a.dev, a.line); else sim.apply(a); }
    sim.cli = {};   /* a few days later: the console asks for its password again */
    return { sim: sim, v: b.v };
  },
  brief() { return { quote: "Since you moved us onto the new switch, printing crawls: a page can take minutes, and some never come out. And our insurer's checklist says every switch port should say what's plugged into it, and the spare ones should be switched off.", from: "the office manager" }; },
  mason: "Read before you change anything: show interfaces status lists every port, and show interfaces on one port shows how it's really running. Look twice: errors that climb are the clue.",
  limits: function (v) { return ["The office's records, port descriptions: the router's port " + v.plan.desc.router + ", the front desk PC's " + v.plan.desc.pc + ", the printer's " + v.plan.desc.printer + ".", "The printer is an older model: its network card is fixed at 100 Mb/s, full duplex, and can't negotiate.", "Your laptop is still on the console; the switch's passwords are the office's."]; },
  reqs: [{
    id: "desc", text: "Every port in use is described as the office's records say",
    causes: descCauses,
    ok: function () { return "Each port in use says what's plugged into it, as the records say."; },
    rung1: function () { return "On the switch: show interfaces status, and read the Name column against the records."; },
    rung2: function () { return "A description is set on the port itself, in interface configuration. It's only a label, so it has to be checked against what's really cabled there."; }
  }, {
    id: "printer", text: "The printer's port matches the printer: 100 Mb/s, full duplex, no errors climbing",
    causes: printerCauses,
    ok: function (sim) { return "The printer's port runs 100 Mb/s, full duplex, set by hand to match the printer, with no errors climbing."; },
    rung1: function () { return "show interfaces on the printer's port, twice: read the duplex line, then the late collisions."; },
    rung2: function () { return "Negotiation needs both ends to take part. When one end is fixed, the other can sense its speed but not its duplex, and falls back to half. Set the port by hand to match the device."; }
  }, {
    id: "unused", text: "Every unused port is shut down, the fibre slots too; every port in use stays on",
    causes: unusedCauses,
    ok: function () { return "The unused ports and fibre slots are shut down; the three in use are on."; },
    rung1: function () { return "show interfaces status: which ports are notconnect, and which say disabled?"; },
    rung2: function () { return "A port that isn't shut down will bring up whatever is plugged into it. Shutting unused ports is a basic hardening step, and a range of ports can be configured at once."; }
  }, Object.assign({}, L_SAVED), {
    id: "keep", text: "Everything still works: the front desk PC online, and printing",
    causes: keepCauses,
    ok: function () { return "The front desk PC is online and reaches the printer."; },
    rung1: function () { return "On the front desk PC: ping the router and the printer. On the switch: show interfaces status."; },
    rung2: function () { return "Shutting a port takes down whatever is on it. Check which ports are really in use before shutting a range."; }
  }],
  solve(v) {
    const p = v.plan;
    return [cli(""), cli(p.console), cli("enable"), cli(p.secret), cli("configure terminal"),
      cli("interface gi0/1"), cli("description " + p.desc.router), cli("interface gi0/2"), cli("description " + p.desc.pc),
      cli("interface gi0/3"), cli("description " + p.desc.printer), cli("speed 100"), cli("duplex full"),
      cli("interface range gi0/4 - 28"), cli("shutdown"), cli("end"), cli("copy running-config startup-config"), cli("")];
  },
  answer(v) {
    return ["On the console (its password, enable and the secret): configure terminal.",
      "interface gi0/1, description " + v.plan.desc.router + "; interface gi0/2, description " + v.plan.desc.pc + "; interface gi0/3, description " + v.plan.desc.printer + ", speed 100, duplex full.",
      "interface range gi0/4 - 28, shutdown; end.",
      "copy running-config startup-config. Check with show interfaces status, and show interfaces gi0/3 twice: no late collisions climbing."];
  },
  summary(v, sim) {
    return ["Every port in use says what's on it, as the office's records say.", "The printer's port is set to 100 Mb/s, full duplex, to match the printer: no more late collisions, and printing runs at full speed.",
      "The unused ports and fibre slots are shut down.", "It's all saved."];
  }
};

/* ---------------------------------------------------------------- SO-J4 */
/* the sheet as saved, a row per group of the office's plan, and what the IPAM checker says of each */
const sheetOf = function (sim, v) { const rows = sim.net.ipam || []; return v.plan.ipam.groups.map(function (g, i) { return Object.assign({ name: g[0], hosts: g[1] }, rows[i] || {}); }); };
const sheetRes = function (sim, v) { return checkSheet(v.plan.ipam.block, sheetOf(sim, v)); };
const groupWhere = function (res, v, test) { const i = res.findIndex(test); return i < 0 ? null : v.plan.ipam.groups[i][0]; };
const has = function (r, field, re) { return r.issues.some(function (x) { return x.field === field && (!re || re.test(x.text)); }); };
const unreadable = function (r) { return r.empty || has(r, "net", /isn't an IPv4/) || has(r, "mask", /write it as/); };
const unreadCause = function (res, v) { const g = groupWhere(res, v, unreadable); return C("unread", !!g, "Not every group's block is written so it can be read yet", "Every block can be read.", g ? "The IPAM sheet: " + g + "'s network or mask is blank or can't be read." : ""); };
function filledCauses(sim, v) {
  const res = sheetRes(sim, v), none = res.every(function (r) { return r.empty; });
  const blank = groupWhere(res, v, function (r) { return r.empty; });
  const bad = groupWhere(res, v, function (r) { return !r.empty && unreadable(r); });
  return [
    C("none", none, "Nothing is written in the IPAM sheet yet", "The sheet has been filled in.", "The IPAM sheet is empty."),
    C("row", !none && !!blank, "A group has no block written for it", "Every group has a block.", blank ? "The IPAM sheet: " + blank + " is blank." : ""),
    C("format", !!bad, "A block's network or mask isn't written as an address and a mask or /prefix", "Every network and mask can be read.", bad ? "The IPAM sheet: " + bad + "'s network or mask can't be read." : "")];
}
function sizeCauses(sim, v) {
  const res = sheetRes(sim, v);
  const small = groupWhere(res, v, function (r) { return has(r, "mask", /usable addresses/); });
  const big = groupWhere(res, v, function (r) { return !unreadable(r) && !has(r, "mask", /usable addresses/) && r.notes.some(function (n) { return /smaller block/.test(n); }); });
  return [unreadCause(res, v),
    C("small", !!small, "A block is too small for its group", "Every block is big enough for its group.", small ? "The IPAM sheet: " + small + "'s block has fewer usable addresses than the group needs." : ""),
    C("big", !!big, "A block is bigger than its group needs: a smaller one would fit", "Every block is the smallest that fits.", big ? "The IPAM sheet: " + big + "'s block would fit in a smaller one." : "")];
}
function placeCauses(sim, v) {
  const res = sheetRes(sim, v);
  const out = groupWhere(res, v, function (r) { return has(r, "net", /reaches outside/); });
  const align = groupWhere(res, v, function (r) { return has(r, "net", /isn't where a/); });
  const lap = groupWhere(res, v, function (r) { return has(r, "net", /^Overlap/); });
  return [unreadCause(res, v),
    C("outside", !!out, "A block reaches outside the office's range", "Every block is inside the office's range.", out ? "The IPAM sheet: " + out + "'s block runs past the office's range." : ""),
    C("align", !!align, "A block doesn't start where a block of its size begins", "Every block starts on its own boundary.", align ? "The IPAM sheet: " + align + "'s network isn't where a block of its size begins." : ""),
    C("overlap", !!lap, "Two blocks share addresses", "No two blocks overlap.", lap ? "The IPAM sheet: " + lap + "'s block shares addresses with another group's." : "")];
}
function addrCauses(sim, v) {
  const res = sheetRes(sim, v), w = function (f) { return groupWhere(res, v, function (r) { return !unreadable(r) && has(r, f); }); };
  const f = w("first"), l = w("last"), b = w("bc");
  return [unreadCause(res, v),
    C("first", !!f, "A first usable address is wrong", "Every first usable address is right.", f ? "The IPAM sheet: " + f + "'s first usable isn't the first address after its network address." : ""),
    C("last", !!l, "A last usable address is wrong", "Every last usable address is right.", l ? "The IPAM sheet: " + l + "'s last usable isn't the address just before its broadcast." : ""),
    C("bc", !!b, "A broadcast address is wrong", "Every broadcast address is right.", b ? "The IPAM sheet: " + b + "'s broadcast isn't its block's last address." : "")];
}
function gwCausesSheet(sim, v) {
  const res = sheetRes(sim, v), rows = sheetOf(sim, v);
  const blank = groupWhere(res, v, function (r, i) { return !unreadable(r) && has(r, "gw", /not written/); });
  const unusable = groupWhere(res, v, function (r) { return !unreadable(r) && has(r, "gw") && !has(r, "gw", /not written/); });
  const notFirst = groupWhere(res, v, function (r, i) {
    if (unreadable(r) || has(r, "gw")) return false;
    const n = ip2n(rows[i].net); return n != null && ip2n(rows[i].gw) !== n + 1;
  });
  return [unreadCause(res, v),
    C("blank", !!blank, "A block has no gateway written", "Every block has a gateway.", blank ? "The IPAM sheet: " + blank + " has no gateway." : ""),
    C("unusable", !!unusable, "A gateway isn't a usable address in its own block", "Every gateway is a usable address in its block.", unusable ? "The IPAM sheet: " + unusable + "'s gateway can't be used by the devices in its block." : ""),
    C("first", !!notFirst, "A gateway works, but isn't the first usable address, as this office does it", "Every gateway is its block's first usable address.", notFirst ? "The IPAM sheet: " + notFirst + "'s gateway isn't its first usable address." : "")];
}
const keepAll = function (sim) {
  return [C("pc", !online(sim, "pc"), "The front desk PC isn't online any more", "The front desk PC is online.", "The front desk PC can't reach the internet."),
    C("print", !printOk(sim), "The front desk PC can't reach the printer", "The front desk PC reaches the printer.", "Test pages from the front desk don't print.")];
};
const SO4 = {
  id: "SO-J4", level: "office", title: "Subnet the office: the IPAM sheet",
  already: ["keep"], ipam: true,
  start(seed) {
    const b = SO3.start(seed), sim = b.sim;
    for (const a of SO3.solve(b.v)) { if (a.t === "cmd") exec(sim, a.dev, a.line); else sim.apply(a); }
    sim.cli = {};
    return { sim: sim, v: b.v };
  },
  brief(v) { return { quote: "We're growing: guests keep asking for the Wi-Fi, and we're getting a small server. Before anything else is set up, our IT plan says the office's addresses get split into a block for each group, each just big enough, written in the IPAM sheet. Work it out by hand: we'd like you to be able to explain it.", from: "the office manager" }; },
  mason: "Biggest group first. For each one, find the smallest block whose usable addresses cover it, write where it starts and ends, then move on to the next free address.",
  limits: function (v) { const g = v.plan.ipam.groups; return ["The office's range: " + v.plan.ipam.block + ". Groups and how many addresses each needs: " + g.map(function (x) { return x[0] + " " + x[1]; }).join(", ") + ".", "The office's convention: a block's gateway is its first usable address.", "Nothing on the network changes on this visit: the plan is for the next one (the groups' VLANs)."]; },
  reqs: [{
    id: "filled", text: "Every group has its block written in the IPAM sheet",
    causes: filledCauses,
    ok: function () { return "Every group has a block in the sheet."; },
    rung1: function () { return "Open the IPAM sheet: is there a block for every group, written as a network and a mask or /prefix?"; },
    rung2: function () { return "An address plan gives every group its own block, each written as its network address and its size (a mask, or a /prefix)."; }
  }, {
    id: "size", text: "Each block is big enough for its group, and no bigger than it needs",
    causes: sizeCauses,
    ok: function () { return "Each block is the smallest that fits its group."; },
    rung1: function () { return "For each group: how many addresses does it need, and how many usable addresses does its block give?"; },
    rung2: function () { return "A block of /n holds 2 to the power (32 minus n) addresses, two of which no device can use: the network and the broadcast. VLSM gives each group the smallest block whose usable addresses cover it."; }
  }, {
    id: "place", text: "Each block starts where a block its size begins, inside the office's range, with no two overlapping",
    causes: placeCauses,
    ok: function () { return "The blocks sit inside the office's range, each on its own boundary, none overlapping."; },
    rung1: function () { return "Write out where each block starts and ends: does any run past the office's range, or into another?"; },
    rung2: function () { return "A block must start on a multiple of its own size. Placing the biggest first, one straight after another, keeps every block on its boundary and none overlapping."; }
  }, {
    id: "addrs", text: "Each block's first usable, last usable and broadcast addresses are right",
    causes: addrCauses,
    ok: function () { return "Every row's first usable, last usable and broadcast addresses are right."; },
    rung1: function () { return "For each block: what is its network address, and what is its very last address?"; },
    rung2: function () { return "The first usable is one after the network address. The broadcast is the block's last address, and the last usable is the one before it."; }
  }, {
    id: "gw", text: "Each block's gateway is its first usable address, as the office does it",
    causes: gwCausesSheet,
    ok: function () { return "Every block's gateway is its first usable address."; },
    rung1: function () { return "Read the office's convention in the limits, then each row's gateway against its first usable."; },
    rung2: function () { return "A gateway has to be a usable address inside its own block, or the devices there can't reach it. Offices keep it predictable by always using the same one."; }
  }, {
    id: "keep", text: "Everything still works: the front desk PC online, and printing",
    causes: keepAll,
    ok: function () { return "The front desk PC is online and reaches the printer."; },
    rung1: function () { return "On the front desk PC: ping the router and the printer."; },
    rung2: function () { return "This visit is paperwork: nothing on the network needs to change for the plan."; }
  }],
  /* one plan that fits, biggest group first, each block straight after the last (any plan the checker accepts passes) */
  solve(v) {
    const B = parseBlock(v.plan.ipam.block), rows = [];
    let at = B.net;
    v.plan.ipam.groups.map(function (g, i) { return { i: i, hosts: g[1] }; }).sort(function (a, b) { return b.hosts - a.hosts; }).forEach(function (o) {
      let p = 30; while (Math.pow(2, 32 - p) - 2 < o.hosts) p--;
      const sz = Math.pow(2, 32 - p); at = Math.ceil(at / sz) * sz;
      rows[o.i] = { net: n2ip(at), mask: "/" + p, first: n2ip(at + 1), last: n2ip(at + sz - 2), bc: n2ip(at + sz - 1), gw: n2ip(at + 1) };
      at += sz;
    });
    return [{ t: "ipam", rows: rows }];
  },
  answer(v) {
    const r = SO4.solve(v)[0].rows;
    return v.plan.ipam.groups.map(function (g, i) { return g[0] + " (" + g[1] + "): " + r[i].net + " " + r[i].mask + ", usable " + r[i].first + " to " + r[i].last + ", broadcast " + r[i].bc + ", gateway " + r[i].gw + "."; })
      .concat(["Any plan the sheet accepts passes: the blocks can go in another order, as long as each is the smallest that fits, on its boundary, inside the range, with no overlaps."]);
  },
  summary(v) {
    return ["The office's range is split into a block per group, each the smallest that fits (VLSM).", "Every block sits on its own boundary, inside the range, none overlapping; every address in the sheet checks out.",
      "Each block's gateway is its first usable address, ready for the groups' VLANs on the next visit."];
  }
};

/* ---------------------------------------------------------------- SO-J5 */
const norm = function (t) { return String(t == null ? "" : t).replace(/\s+/g, " ").trim().toLowerCase(); };
function bannerCauses(sim, v) {
  const b = SW(sim).banner, have = norm(b), want = norm(v.plan.banner);
  return [
    C("none", !have, "There's no warning banner: a login shows nothing before it asks for the password", "A banner is set.", "Log out of the console and press RETURN: no warning comes up before the password."),
    C("part", !!have && have !== want && want.indexOf(have) >= 0, "The banner holds only part of the wording: the character that opens and closes it turns up in the wording itself, so it was cut short", "The banner holds the whole wording.", "show running-config: the banner is only part of the records' wording."),
    C("wrong", !!have && have !== want && want.indexOf(have) < 0, "There's a banner, but it isn't the wording in the office's records", "The banner is the records' wording.", "show running-config: the banner's words aren't the records' wording.")];
}
/* the TFTP server's folder on your laptop, a file in it by name (Windows: case doesn't matter), and the switch's own name for its backups */
const files = function (sim) { return sim.d.tech.tftp.files; };
const fileNamed = function (sim, name) { const n = name.toLowerCase(); return files(sim).find(function (f) { return f.name.toLowerCase() === n; }) || null; };
const backupName = function (sim) { return SW(sim).hostname.toLowerCase() + "-confg"; };
const lapOnNet = function (sim) { const a = sim.addr("tech"); return !!(a && a.kind !== "apipa"); };
/* a copy on your laptop, worked out the same way for the backup and the baseline: the server and the network first, then the
   file under its name, then whether it holds what's saved (a copy of the running configuration with changes not yet saved,
   or one taken before the last save, isn't what the switch comes back with) */
function copyCauses(sim, name, others, what) {
  const f = fileNamed(sim, name), st = configText(SW(sim), "startup"), s = sim.d.tech.tftp, any = files(sim).length > 0;   /* once a file has landed, the server and the network have done their part */
  const elsewhere = !f && files(sim).some(function (g) { return others(g.name.toLowerCase()); });
  const off = !!f && f.text !== st, run = off && f.which === "running" && f.unsaved, landed = "Files have reached your laptop, so that isn't what's missing.";
  return [
    C("server", !f && !any && !s.on, "The TFTP server on your laptop isn't running, so nothing can send it a file", s.on ? "The TFTP server is running." : landed, "Your laptop's TFTP server tab: Stopped."),
    C("net", !f && !any && !lapOnNet(sim), "Your laptop isn't on the office network, so the switch can't reach it", lapOnNet(sim) ? "Your laptop has an address on the office network." : landed, "Your laptop's TFTP server tab: no address to listen on."),
    C("none", !f && !elsewhere, "There's no " + what + " on your laptop yet", "There's a " + what + " on your laptop.", "Your laptop's TFTP server tab: no " + what + " among the files received."),
    C("name", !f && elsewhere, "A copy is on your laptop, but not under the name the " + what + " goes by", "The " + what + " is under its own name.", "Your laptop's TFTP server tab: a copy, under another name."),
    C("running", run, "The copy was taken from the running configuration while it had changes that weren't saved: it isn't what the switch would come back with", "The copy matches what's saved.", "The file on your laptop differs from show startup-config."),
    C("stale", off && !run, "The copy is older than what's saved now", "The copy matches what's saved now.", "The file on your laptop differs from show startup-config.")];
}
function backupCauses(sim, v) { const bn = v.plan.baseline.toLowerCase(); return copyCauses(sim, backupName(sim), function (n) { return n !== bn; }, "backup"); }
function baselineCauses(sim, v) { const bk = backupName(sim); return copyCauses(sim, v.plan.baseline, function (n) { return n !== bk; }, "baseline copy"); }
function tidyCauses(sim) {
  const sw = SW(sim), used = {}, lap = sim.cablesOf("tech").find(function (c) { return c.kind === "cat6"; });
  ["router", "pc", "printer"].forEach(function (id) { const n = portOf(sim, id); if (n) used[n] = id; });
  const cut = Object.keys(used).find(function (n) { return sw.ports[n].shutdown; });
  const open = PORT_NAMES.find(function (n) { return !used[n] && !sw.ports[n].sfp && !sw.ports[n].shutdown; });
  const sfp = PORT_NAMES.find(function (n) { return !used[n] && sw.ports[n].sfp && !sw.ports[n].shutdown; });
  return [
    C("plugged", !!lap, "Your laptop is still cabled to the office network", "Your laptop's Ethernet is unplugged.", "Cable runs: your laptop's ETHERNET still has a cable in it."),
    C("used", !!cut, "A port that's in use has been shut down", "Every port in use is on.", cut ? "show interfaces status: " + shortPort(cut) + ", " + WHO[used[cut]] + "'s port, is disabled." : ""),
    C("open", !!open, "A spare port is live again: anyone in the office could plug something into it", "Every spare copper port is shut down.", open ? "show interfaces status: " + shortPort(open) + " is not disabled." : ""),
    C("sfp", !!sfp, "A fibre slot is live again", "The fibre slots are shut down.", sfp ? "show interfaces status: " + shortPort(sfp) + " (a fibre slot) is not disabled." : "")];
}
const SO5 = {
  id: "SO-J5", level: "office", title: "A warning banner, a backup and a baseline",
  already: ["saved", "tidy", "keep"],
  start(seed) {
    const b = SO4.start(seed), sim = b.sim;
    for (const a of SO4.solve(b.v)) sim.apply(a);
    sim.cli = {};
    /* for the instructor's worked way: the address your laptop will be given when it's plugged in, and that cable's name */
    return { sim: sim, v: Object.assign({}, b.v, { lapIp: sim.offer("router", sim.d.tech.ifaces[0].mac, null), lapCable: "c-run-" + ((sim.net.extra.runs || 0) + 1) }) };
  },
  brief() { return { quote: "Our insurer's checklist again. Every login to the switch has to show our warning first. And if that switch ever died, we'd want a copy of how it's set up kept somewhere other than the switch, so a new one could go in the same; plus a baseline we can compare against if we ever think someone's changed something.", from: "the office manager" }; },
  mason: "A backup is only worth what it would bring back. Know which configuration you're copying before you copy it, and read the file once it lands.",
  limits: function (v) { return ["The office's records, the banner's wording: " + v.plan.banner, "Backups go to your laptop by TFTP, under the name the switch suggests for its own backup. The baseline is a second copy, kept under the name " + v.plan.baseline + ".", "Your laptop has its own Ethernet port and a TFTP server (its own tab). Every spare port on the switch was shut down last visit and must be again when you leave; take your laptop's cable with you.", "Your laptop is still on the console. The switch's console password and enable secret are the office's: " + v.plan.console + " and " + v.plan.secret + "."]; },
  reqs: [{
    id: "banner", text: "Every login shows the office's warning banner first",
    causes: bannerCauses,
    ok: function () { return "Every login shows the office's warning first."; },
    rung1: function () { return "Log out of the console (exit) and press RETURN: what comes up before the password? Then read show running-config near the end."; },
    rung2: function () { return "A banner's text sits between two copies of one delimiter character, which mustn't appear anywhere in the text. The message of the day shows on every console and remote login."; }
  }, Object.assign({}, L_SAVED), {
    id: "backup", text: "A backup of the saved configuration is on your laptop, under the switch's own name for it",
    causes: backupCauses,
    ok: function () { return "Your laptop holds a backup matching what's saved."; },
    rung1: function () { return "Your laptop's TFTP server tab: is it running, and what is it listening on? Then read what's arrived beside show startup-config."; },
    rung2: function () { return "A switch sends a copy of either configuration to a TFTP server at the address you give it: the running one (what's in memory now, saved or not) or the startup one (what comes back after a reload). The server has to be running and reachable."; }
  }, {
    id: "baseline", text: "A baseline copy of the saved configuration is on your laptop, under the name in the office's records",
    causes: baselineCauses,
    ok: function () { return "Your laptop holds the baseline, matching what's saved."; },
    rung1: function () { return "Your laptop's TFTP server tab: what is each file called, and does the baseline match show startup-config?"; },
    rung2: function () { return "A baseline is the known-good configuration, kept under a fixed name to compare against later. It's a copy like any other: only its name sets it apart."; }
  }, {
    id: "tidy", text: "Your laptop is unplugged, every spare port is shut down again, and every port in use is on",
    causes: tidyCauses,
    ok: function () { return "Your laptop's cable is out; the spare ports and fibre slots are shut down; the three in use are on."; },
    rung1: function () { return "The Cable runs table, then show interfaces status: is anything of yours still plugged in, and which spare ports aren't disabled?"; },
    rung2: function () { return "A port opened for one job goes back to shut when the job's done, or it's a way in for anyone who plugs into it."; }
  }, {
    id: "keep", text: "Everything still works: the front desk PC online, and printing",
    causes: keepAll,
    ok: function () { return "The front desk PC is online and reaches the printer."; },
    rung1: function () { return "On the front desk PC: ping the router and the printer."; },
    rung2: function () { return "A spare port opened and shut again changes nothing for the ports in use."; }
  }],
  /* one way: the banner saved first; a spare port opened without saving it, so the saved configuration still has it shut;
     the saved configuration copied (twice: the backup and the baseline); then the port shut again and the cable pulled,
     so what's running is what's saved once more */
  solve(v) {
    const p = v.plan;
    return [cli(""), cli(p.console), cli("enable"), cli(p.secret), cli("configure terminal"), cli("banner motd #" + p.banner + "#"), cli("end"), cli("copy running-config startup-config"), cli(""),
      cli("configure terminal"), cli("interface gi0/4"), cli("no shutdown"), cli("end"),
      { t: "lay", a: E("tech", "ETH"), b: E("msw", "4") }, { t: "tftp", dev: "tech", on: true },
      cli("copy startup-config tftp:"), cli(v.lapIp), cli(""), cli("copy startup-config tftp:"), cli(v.lapIp), cli(p.baseline),
      { t: "pull", cable: v.lapCable }, cli("configure terminal"), cli("interface gi0/4"), cli("shutdown"), cli("end"), cli("")];
  },
  answer(v) {
    return ["On the console (its password, enable and the secret): configure terminal; banner motd, then a delimiter that isn't in the wording (such as #), the records' wording, the same delimiter; end; copy running-config startup-config.",
      "Open a spare port without saving it: interface gi0/4, no shutdown, end. Lay a cable from your laptop's ETHERNET to port 4, start the TFTP server, and read its address (the TFTP tab, or ipconfig in its Command Prompt).",
      "copy startup-config tftp: to your laptop's address, accepting the switch's own name; again, naming it " + v.plan.baseline + ". Read both files in the TFTP tab: they match show startup-config.",
      "Pull your laptop's cable and shut the port again (interface gi0/4, shutdown): what's running is what's saved once more, and the saved copy never had the port open. (A spare router port works for the laptop too, and then the switch's ports never change.)"];
  },
  summary(v, sim) {
    return ["Every login to " + SW(sim).hostname + " shows the office's warning first.", "The saved configuration is backed up on your laptop under the switch's own name, with a baseline copy under the records' name, both matching what the switch would come back with.",
      "The spare port is shut again and your laptop's cable is out.", "It's all saved, and the office runs as before."];
  }
};

export const OFFICE_JOBS = [SO1, SO2, SO3, SO4, SO5];
