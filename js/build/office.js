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
import { unsaved } from "../net/swcli.js";
import { online } from "./jobs.js";

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

export const OFFICE_JOBS = [SO1, SO2];
