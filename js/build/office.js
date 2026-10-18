/* Client jobs for build mode, the small office (level 2). The office as the
   technician finds it: the provider's modem and router on the closet shelf,
   the old unmanaged switch running the office, the new managed switch in
   its box, the technician's laptop with its console cable. The work is done
   on the switch's own command line, from the console and then over SSH, and
   every line of a work order is checked against the switch and the network
   as they really are. Each line is an ordered list of causes, as on the
   home jobs, so Mason's third rung can strike the ones the network has
   ruled out and leave two. None of it ever says what to type. */
import { makeOffice, OFFICE_RUN } from "../net/office.js";
import { Sim, SFP_MODULES, swPort } from "../net/sim.js";
import { exec } from "../net/cmd.js";
import { unsaved, duplexEnds, PORT_NAMES, configText, newSwitch, hostKey, pwOk } from "../net/swcli.js";
import { online } from "./jobs.js";
import { checkSheet, parseBlock } from "../net/ipam.js";
import { ip2n, n2ip, rng, mac } from "../net/util.js";

const C = function (id, on, text, not, ev, skip) { return { id: id, on: !!on, text: text, not: not, ev: ev, skip: !!skip }; };
const E = function (dev, port) { return { dev: dev, port: port }; };
const cli = function (line) { return { t: "cmd", dev: "tech", line: line, cli: true }; };
const SW = function (sim) { return sim.d.msw.sw; };
const consoleCable = function (sim) { return sim.cablesOf("msw").find(function (c) { return c.kind === "console"; }) || null; };
/* the cable from a device to one of the managed switch's numbered ports, or null; through a patch panel (SO-J9), the path from the
   device to the switch port its run is patched to */
const onMsw = function (sim, id) {
  for (const c0 of sim.cablesOf(id)) { const c = sim.panelEnd(c0) ? sim.viaPanel(c0) : c0; if (!c) continue; const e = c.a.dev === "msw" ? c.a : c.b.dev === "msw" ? c.b : null; if (e && /^\d+$/.test(e.port)) return c; }
  return null;
};
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
    C("wrong", !!sw.enableSecret && !pwOk(sw.enableSecret, v.plan.secret), "An enable secret is set, but it isn't the one in the office's records", "The enable secret is the office's.", "The office's enable secret doesn't open privileged mode.")];
}
function consoleCauses(sim, v) {
  const con = SW(sim).con;
  return [boxCause(sim),
    C("none", !con.password, "The console line has no password", "The console line has a password.", "line con 0 has no password."),
    C("nologin", !!con.password && !con.login, "The console line has a password, but never asks for it", "The console line asks for its password.", "Log out of the console, press RETURN: it goes straight in."),
    C("local", con.login === "local", "The console line checks user names the switch doesn't use for it, not the console password", "The console checks its own password.", "line con 0 is set to login local."),
    C("wrong", !!con.password && !pwOk(con.password, v.plan.console), "The console asks for a password, but not the one in the office's records", "The console password is the office's.", "The office's console password isn't accepted.")];
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
    C("user", !pwOk(sw.users[v.plan.user], v.plan.userPw), "The office's user name isn't on the switch with its password", "The office's user is on the switch.", "ssh as the office's user: permission denied.")];
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
const WHO = { router: "the router", pc: "the front desk PC", printer: "the printer", hire: "the new hire's PC" };
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
/* the switch's ports: the ones in use (by whose device), a port in use shut down, a spare copper port live, a spare fibre slot live */
function spares(sim) {
  const sw = SW(sim), used = {};
  ["router", "pc", "printer", "hire"].forEach(function (id) { const n = sim.d[id] && portOf(sim, id); if (n) used[n] = id; });   /* the new hire's desk once there is one (SO-J7) */
  const cut = Object.keys(used).find(function (n) { return sw.ports[n].shutdown; });
  const open = PORT_NAMES.find(function (n) { return !used[n] && !sw.ports[n].sfp && !sw.ports[n].shutdown; });
  const sfp = PORT_NAMES.find(function (n) { return !used[n] && sw.ports[n].sfp && !sw.ports[n].shutdown; });
  return { used: used, cut: cut, open: open, sfp: sfp };
}
function unusedCauses(sim) {
  const x = spares(sim), used = x.used, cut = x.cut, open = x.open, sfp = x.sfp;
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
  const x = spares(sim), used = x.used, cut = x.cut, open = x.open, sfp = x.sfp, lap = sim.cablesOf("tech").find(function (c) { return c.kind === "cat6"; });
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

/* ---------------------------------------------------------------- SO-J6 */
/* the switch died overnight; the supplier's replacement, the same model, is in its box. The backup from SO-J5 is on your
   laptop. A file brings back every setting but the SSH keys (they never leave a switch), and the front desk PC remembers
   the old switch's key */
const PORT_FOR = { router: "GigabitEthernet0/1", pc: "GigabitEthernet0/2", printer: "GigabitEthernet0/3" };   /* as the backup describes them (SO-J3) */
const capFirst = function (t) { return t.charAt(0).toUpperCase() + t.slice(1); };
/* the part of a configuration a line belongs to, as a technician would name it */
function sectionOf(lines, i) {
  let k = Math.min(i, lines.length - 1); while (k > 0 && (/^\s/.test(lines[k]) || lines[k] === "!")) k--;   /* back to the line that opens its part */
  const t = lines[k] || "";
  if (/^hostname/.test(t)) return "the switch's name";
  if (/^enable/.test(t)) return "the enable secret";
  if (/^username/.test(t)) return "the remote login's user";
  if (/^ip domain-name/.test(t)) return "the domain name";
  if (/^interface Vlan1/.test(t)) return "VLAN 1's address";
  if (/^interface /.test(t)) return "interface " + shortPort(t.replace(/^interface /, ""));
  if (/^ip default-gateway/.test(t)) return "the default gateway";
  if (/^banner/.test(t)) return "the banner";
  if (/^line con/.test(t)) return "the console line";
  if (/^line vty/.test(t)) return "the remote (vty) lines";
  return "a line near " + (t.trim() || "the end");
}
function firstDiff(a, b) { const A = a.split("\n"), Bl = b.split("\n"); for (let i = 0; i < Math.max(A.length, Bl.length); i++) if (A[i] !== Bl[i]) return sectionOf(i < A.length ? A : Bl, i); return null; }
function restoredCauses(sim, v) {
  const sw = SW(sim), run = configText(sw), st = configText(sw, "startup"), want = v.backup;
  return [boxCause(sim),
    C("factory", sw.hostname === "Switch" && st !== want, "None of the backup is on the switch yet: it's still on its factory settings", "The backup has reached the switch.", "The prompt still says Switch."),
    C("startup", st === want && run !== want, "The backup is in the startup configuration, but the switch is still running what it started with: a saved configuration takes effect only when the switch starts", "What's running is the backup.", "show startup-config is the backup; show running-config isn't."),
    C("part", run !== want, "Part of what's running isn't as the backup has it", "What's running is the backup, line for line.", "show running-config: " + (firstDiff(run, want) || "a line") + " isn't as the backup has it.")];
}
function cabledCauses(sim, v) {
  const ids = ["router", "pc", "printer"], miss = ids.find(function (id) { return !onMsw(sim, id); }), wrong = ids.find(function (id) { return onMsw(sim, id) && portOf(sim, id) !== PORT_FOR[id]; });
  return [boxCause(sim),
    C("none", !!miss, "Something that was on the old switch isn't cabled to the new one", "The router and both desks are cabled to the new switch.", miss ? capFirst(WHO[miss]) + " isn't cabled to the new switch." : ""),
    C("port", !!wrong, "A device is on another port from the one the backup sets up for it", "Each is on the port the backup sets up for it.", wrong ? capFirst(WHO[wrong]) + " is on " + shortPort(portOf(sim, wrong)) + "; the backup describes " + shortPort(PORT_FOR[wrong]) + " as " + v.plan.desc[wrong] + "." : "")];
}
function sshBackCauses(sim, v) {
  const sw = SW(sim), p = v.plan, r = sim.route("pc", p.ip), kh = sim.d.pc.knownHosts || {}, vty = sw.vty;
  return [boxCause(sim),
    C("reach", !(r.local && r.owner.indexOf("msw") >= 0), "The front desk PC can't reach the switch at its management address", "The front desk PC reaches it.", "ping from the front desk PC: no reply from the switch."),
    C("keys", !sw.rsa, "The switch has no SSH keys: a configuration file never carries them", "It has SSH keys of its own.", "ssh from the front desk PC: connection refused."),
    C("short", !!sw.rsa && sw.rsa < 768, "Its keys are too short for SSH version 2 (768 bits or more)", "Its keys are long enough for SSH version 2.", "ssh from the front desk PC is turned away: the switch offers only the old SSH version 1."),
    C("lines", !(/^(ssh|all)$/.test(vty.transport) && vty.login === "local" && pwOk(sw.users[p.user], p.userPw)), "The remote lines don't take the office's SSH login", "The remote lines take the office's SSH login.", "ssh from the front desk PC can't log in with the office's user."),
    C("known", !!kh[p.ip] && kh[p.ip] !== hostKey(sw), "The front desk PC remembers the old switch's key, and stops at the new one's", "The front desk PC doesn't hold the old switch's key.", "ssh from the front desk PC: REMOTE HOST IDENTIFICATION HAS CHANGED, and it stops.")];
}
const SO6 = {
  id: "SO-J6", level: "office", title: "A failed switch, rebuilt from its backup",
  already: [],
  start(seed) {
    const b = SO5.start(seed), sim = b.sim, p = b.v.plan;
    for (const a of SO5.solve(b.v)) { if (a.t === "cmd") exec(sim, a.dev, a.line); else sim.apply(a); }
    sim.cli = {}; sim.d.tech.tftp.on = false;
    const name = p.hostname.toLowerCase() + "-confg", backup = fileNamed(sim, name).text;
    sim.d.pc.knownHosts = {}; sim.d.pc.knownHosts[p.ip] = hostKey(SW(sim));   /* the front desk PC has logged in to the old switch before */
    /* overnight the switch died. The office manager pulled its cables and took it away; the replacement is in its box */
    sim.net.cables = sim.net.cables.filter(function (c) { return c.a.dev !== "msw" && c.b.dev !== "msw"; });
    const sw = newSwitch(); sw.unit = 2;
    Object.assign(sim.d.msw, { boxed: true, mac: mac(rng(seed ^ 0x6e57)), sw: sw });
    return { sim: sim, v: Object.assign({}, b.v, { backup: backup, backupName: name, runs: sim.net.extra.runs || 0, lapIp: sim.offer("router", sim.d.tech.ifaces[0].mac, null) }) };
  },
  brief() { return { quote: "The switch died overnight: no lights at all, and nobody can print or get online. The supplier sent a replacement this morning, the same model, under the warranty; it's still in its box. Everything was set up on the old one. You said you kept a copy?", from: "the office manager" }; },
  mason: "Get the new switch talking to your laptop first, then bring the backup across. Then check what came back against what the office needs, not just what the file says.",
  limits: function (v) { return ["Your backup from last visit is on your laptop, in its TFTP server's folder: " + v.backupName + ", and the baseline, " + v.plan.baseline + ".", "The replacement is the same model, fresh from its box: no address, no passwords, every port on. The office manager pulled the old switch's cables; the backup says which port each was on.", "The office's records: the switch is " + v.plan.hostname + ", at " + v.plan.ip + " (mask " + v.plan.mask + "). Enable secret " + v.plan.secret + ", console password " + v.plan.console + "; remote logins: user " + v.plan.user + ", password " + v.plan.userPw + ".", "The front desk PC has logged in to the old switch over SSH before. Your laptop has its console cable, its own Ethernet port and its TFTP server; take its network cable with you when you leave."]; },
  reqs: [{
    id: "rack", text: "The replacement is in the closet rack, with your laptop on its console",
    causes: rackCauses,
    ok: function () { return "The replacement is in the rack; your laptop's serial terminal reaches its console."; },
    rung1: function () { return "Look at what's still in its box, then at your laptop's Serial terminal: does anything answer?"; },
    rung2: function () { return "A switch fresh from its box has no address: the only way in is its console port."; }
  }, {
    id: "restored", text: "It runs the office's configuration again, from your backup",
    causes: restoredCauses,
    ok: function () { return "What's running is the backup, line for line."; },
    rung1: function () { return "Your laptop's TFTP server tab: read the backup. Then show running-config on the switch beside it."; },
    rung2: function () { return "A switch can copy a file from a TFTP server into its running configuration (in effect at once, merged with what's there) or into its startup configuration (in effect the next time it starts). To reach the server at all, it needs an address of its own first."; }
  }, {
    id: "cabled", text: "The router and both desks are back on the ports the backup sets up for them",
    causes: cabledCauses,
    ok: function () { return "The router, the front desk PC and the printer are each on the port the backup describes."; },
    rung1: function () { return "Read the interface descriptions in the backup, then the Cable runs table."; },
    rung2: function () { return "A configuration belongs to the ports, not to the devices: a port's description, speed and duplex only fit the device that's really cabled to it."; }
  }, {
    id: "ssh", text: "SSH from the front desk PC works again",
    causes: sshBackCauses,
    ok: function () { return "The switch has SSH keys of its own, and the front desk PC doesn't hold the old switch's key."; },
    rung1: function () { return "From the front desk PC: ssh to the switch, and read every line it prints. On the switch: show crypto key mypubkey rsa."; },
    rung2: function () { return "SSH keys are made on the switch and kept in its own memory, never in a configuration file. A computer remembers each switch's key and stops if it ever changes: check the new key against the switch's own before telling the computer to forget the old one."; }
  }, Object.assign({}, L_SAVED), {
    id: "tidy", text: "Your laptop is unplugged, every spare port is shut down, and every port in use is on",
    causes: function (sim) { return [boxCause(sim)].concat(tidyCauses(sim)); },
    ok: function () { return "Your laptop's cable is out; the spare ports and fibre slots are shut down; the three in use are on."; },
    rung1: function () { return "The Cable runs table, then show interfaces status: is anything of yours still plugged in, and which spare ports aren't disabled?"; },
    rung2: function () { return "A switch fresh from its box has every port on. The office's own configuration shuts the spares; a port opened for the job is shut again when it's done."; }
  }, {
    id: "keep", text: "The office runs again: the front desk PC online, and printing",
    causes: keepCauses,
    ok: function () { return "The front desk PC is online and reaches the printer."; },
    rung1: function () { return "On the front desk PC: ipconfig, then ping the router and the printer."; },
    rung2: function () { return "Every desk's traffic crosses the switch: until it's back, cabled and configured as before, nothing reaches anything."; }
  }],
  /* one way: cabled as before, a temporary address of the records' own on VLAN 1, your laptop on a spare port, the backup
     copied into the running configuration (the spare port shuts as it lands: the copy has already arrived), keys made
     again, saved; the laptop's cable pulled, and the old key taken off the front desk PC once the new one is checked */
  solve(v) {
    const p = v.plan, n = v.runs;
    return [{ t: "place", dev: "msw", room: "closet" }, { t: "lay", a: E("tech", "USB-C"), b: E("msw", "CONSOLE") },
      { t: "lay", a: E("router", "LAN 1"), b: E("msw", "1") }, { t: "lay", a: E("msw", "2"), b: E("pc", "NIC") }, { t: "lay", a: E("msw", "3"), b: E("printer", "NET") },
      cli(""), cli("enable"), cli("configure terminal"), cli("interface vlan 1"), cli("ip address " + p.ip + " " + p.mask), cli("no shutdown"), cli("end"),
      { t: "lay", a: E("tech", "ETH"), b: E("msw", "4") }, { t: "tftp", dev: "tech", on: true },
      cli("copy tftp: running-config"), cli(v.lapIp), cli(v.backupName), cli(""),
      cli("configure terminal"), cli("crypto key generate rsa modulus 2048"), cli("end"), cli("copy running-config startup-config"), cli(""),
      { t: "pull", cable: "c-run-" + (n + 5) }, { t: "cmd", dev: "pc", line: "ssh-keygen -R " + p.ip }];
  },
  answer(v) {
    return ["Place the switch in the closet; lay the console cable to it, and the router's LAN 1, the front desk PC and the printer to ports 1, 2 and 3 (the backup's descriptions).",
      "On the console (a new switch asks for nothing): enable, configure terminal; interface vlan 1, ip address " + v.plan.ip + " " + v.plan.mask + ", no shutdown; end.",
      "Lay your laptop's ETHERNET to a spare port (all are on from the box), start the TFTP server, read its address. copy tftp: running-config: your laptop's address, " + v.backupName + ", accept running-config. The spare port shuts as the backup lands.",
      "configure terminal, crypto key generate rsa (2048 bits): a file never carries the keys; end; copy running-config startup-config. Pull your laptop's cable.",
      "On the front desk PC: ssh to the switch shows the changed key. Check its fingerprint against show crypto key mypubkey rsa, then ssh-keygen -R " + v.plan.ip + ", and ssh again. (Copying into startup-config and reloading works too: answer no when it asks to save.)"];
  },
  summary(v, sim) {
    return ["The replacement is in the rack, running the office's configuration from your backup, line for line.", "The router and both desks are on the ports the backup sets up for them; the spare ports are shut.",
      "It has SSH keys of its own (no file carries them), and the front desk PC trusts the new key, checked against the switch's own.", "It's all saved, and the office runs again."];
  }
};

/* ---------------------------------------------------------------- SO-J7 */
/* a new hire's desk in the open-plan office: a PC still in its box, a run to lay, a port of its own opened (every spare was
   shut in SO-J3) and described, and the backup on your laptop brought up to date once the change is saved */
const hireOk = function (sim) { const ip = sim.d.printer.ifaces[0].cfg.ip, r = sim.route("hire", ip); return !!(r.local && r.owner.indexOf("printer") >= 0); };
function deskCausesHire(sim) {
  const x = sim.d.hire, c = sim.cablesOf("hire")[0], far = c && (c.a.dev === "hire" ? c.b : c.a);
  return [
    C("box", x.boxed, "The new hire's PC is still in its box", "It's out of its box.", "The new hire's PC is still in its box."),
    C("room", !x.boxed && sim.net.rooms.hire !== "open", "The new hire's PC isn't at their desk in the open-plan office", "It's at the new hire's desk.", "The new hire's PC is in the " + ((sim.net.roomNames || {})[sim.net.rooms.hire] || "wrong room").toLowerCase() + "."),
    C("none", !c, "Nothing joins the new hire's PC to the network", "It has a cable.", "The Cable runs table: nothing in the new hire's PC."),
    C("router", !!c && far.dev === "router", "It's cabled straight to the router, not to the switch: the office's desks all go through the switch", "It isn't on the router.", "The Cable runs table: the new hire's PC goes to the router's " + (far ? far.port : "") + "."),
    C("other", !!c && far.dev !== "router" && !onMsw(sim, "hire"), "Its cable doesn't go to one of the switch's ports", "It's on a switch port.", "The Cable runs table: the new hire's PC isn't cabled to the managed switch.")];
}
function hirePortCauses(sim, v) {
  const sw = SW(sim), n = portOf(sim, "hire"), p = n && sw.ports[n], d = p ? (p.desc || "").trim().toUpperCase() : "";
  return [
    C("nocable", !n, "The new hire's PC isn't on a switch port yet", "It's on a switch port.", "The new hire's PC isn't cabled to the managed switch."),
    C("shut", !!p && p.shutdown, "Its port is shut down, like every spare", "Its port is open.", n ? "show interfaces status: " + shortPort(n) + " is disabled." : ""),
    C("none", !!p && !d, "Its port has no description", "Its port has a description.", n ? "show interfaces status: the Name column is empty on " + shortPort(n) + "." : ""),
    C("wrong", !!p && !!d && d !== v.plan.desc.hire, "Its port's description isn't the one in the office's records", "Its description is the records'.", n ? shortPort(n) + " is named " + d + "." : "")];
}
function hireOnline(sim) {
  const a = sim.addr("hire");
  return [
    C("link", !sim.hasLink("hire"), "The new hire's PC has no link", "It has a link.", "ipconfig on the new hire's PC: Media disconnected."),
    C("addr", !a || a.kind === "apipa", "It has no address from the router", "It has an address from the router.", "ipconfig on the new hire's PC: " + (a ? a.ip : "no address") + "."),
    C("net", !online(sim, "hire"), "It can't reach the internet", "It reaches the internet.", "The new hire's PC can't reach the internet."),
    C("print", !hireOk(sim), "It can't reach the printer", "It reaches the printer.", "Test pages from the new hire's PC don't print.")];
}
const SO7 = {
  id: "SO-J7", level: "office", title: "A new hire's desk",
  already: ["spares", "saved", "backup", "keep"],   /* right as you find them: the job is not to break them, and the backup goes stale the moment the change is saved */
  start(seed) {
    const b = SO6.start(seed), sim = b.sim;
    for (const a of SO6.solve(b.v)) { if (a.t === "cmd") exec(sim, a.dev, a.line); else sim.apply(a); }
    sim.cli = {}; sim.d.tech.tftp.on = false;
    const r = rng(seed ^ 0x41e7), d = sim.d;
    d.hire = { id: "hire", kind: "pc", label: "New hire's PC", sub: "DHCP", on: true, boxed: true, os: "windows", user: "newhire", host: "NEWHIRE-PC", printer: { name: "Office printer", port: d.printer.ifaces[0].cfg.ip },
      ifaces: [{ name: "Ethernet", type: "eth", port: "NIC", mac: mac(r), desc: "Gigabit Network Connection", cfg: { mode: "dhcp", dnsMode: "auto" }, lease: null, apipa: null }] };
    sim.arp.hire = {};
    return { sim: sim, v: Object.assign({}, b.v, { runs: sim.net.extra.runs || 0, lapIp: sim.offer("router", d.tech.ifaces[0].mac, null) }) };
  },
  brief() { return { quote: "We've taken on a new bookkeeper, starting Monday. Their desk is in the open-plan office, and their PC came yesterday: it's still in its box. Can you get them set up on the network, the way the rest of the office is? And keep that copy of the switch's setup you made up to date: after the week we had, I want it right.", from: "the office manager" }; },
  mason: "One port, opened on purpose, and nothing else. A change isn't finished until it's saved, and the copy of it is fresh.",
  limits: function (v) { return ["The office's records, the new hire's port: description " + v.plan.desc.hire + ". Their desk is in the open-plan office; the run back to the closet is 12 m.", "Every spare port on the switch was shut down on purpose: open only the one the new desk needs.", "Backups go to your laptop by TFTP, under the name the switch suggests for its own backup. Your laptop is on the console; take its network cable with you when you leave.", "The switch's console password and enable secret are the office's: " + v.plan.console + " and " + v.plan.secret + "."]; },
  reqs: [{
    id: "desk", text: "The new hire's PC is at their desk in the open-plan office, cabled to the switch",
    causes: deskCausesHire,
    ok: function () { return "The new hire's PC is at their desk, cabled to the switch."; },
    rung1: function () { return "Look at what's still in its box, then at the Cable runs table."; },
    rung2: function () { return "Every desk in the office runs back to the closet switch: it's where each desk gets its own port, with its own settings and its own description."; }
  }, {
    id: "port", text: "Its switch port is open, and described as the office's records say",
    causes: hirePortCauses,
    ok: function (sim) { return shortPort(portOf(sim, "hire")) + " is open, named as the records say."; },
    rung1: function () { return "On the switch: show interfaces status. Find the new hire's port, then read its Status and Name."; },
    rung2: function () { return "A shut-down port stays dark whatever is plugged into it; it comes up only when it's opened in its own interface configuration, where its description is set too."; }
  }, {
    id: "online", text: "The new hire's PC is online, and prints",
    causes: hireOnline,
    ok: function () { return "The new hire's PC is online and reaches the printer."; },
    rung1: function () { return "On the new hire's PC: ipconfig, then ping the router and the printer."; },
    rung2: function () { return "A PC set to get its address automatically asks again by itself once its link comes up; with an address from the router it reaches everything the office does."; }
  }, {
    id: "spares", text: "Every other spare port is still shut down, the ports in use are on, and your laptop is unplugged",
    causes: tidyCauses,
    ok: function () { return "Only the ports in use are on, and your laptop's network cable is out."; },
    rung1: function () { return "show interfaces status: which ports aren't disabled, and what's on each? Then the Cable runs table."; },
    rung2: function () { return "Opening a range opens every port in it. A port that isn't in use is a way in for anyone who plugs into it."; }
  }, Object.assign({}, L_SAVED), {
    id: "backup", text: "The backup on your laptop matches what's saved now",
    causes: function (sim, v) { const bn = v.plan.baseline.toLowerCase(); return copyCauses(sim, backupName(sim), function (n) { return n !== bn; }, "backup"); },
    ok: function () { return "Your laptop's backup matches what's saved."; },
    rung1: function () { return "Your laptop's TFTP server tab: read the backup beside show startup-config."; },
    rung2: function () { return "A backup is a copy of one moment: the moment the switch's saved configuration changes, the copy is out of date. Copy the saved configuration again, under the same name."; }
  }, {
    id: "keep", text: "Everything that worked still works: the front desk PC online, and printing",
    causes: keepAll,
    ok: function () { return "The front desk PC is online and reaches the printer."; },
    rung1: function () { return "On the front desk PC: ping the router and the printer."; },
    rung2: function () { return "A new port opened beside the others changes nothing for them; a range typed by mistake can."; }
  }],
  /* one way: the PC unboxed at the desk and cabled to port 5, the port opened and described, saved; the backup copied again
     from the saved configuration, your laptop on the router's spare port so no switch port is touched */
  solve(v) {
    const p = v.plan, n = v.runs;
    return [{ t: "place", dev: "hire", room: "open" }, { t: "lay", a: E("msw", "5"), b: E("hire", "NIC") },
      cli(""), cli(p.console), cli("enable"), cli(p.secret), cli("configure terminal"), cli("interface gi0/5"), cli("description " + p.desc.hire), cli("no shutdown"), cli("end"), cli("copy running-config startup-config"), cli(""),
      { t: "lay", a: E("tech", "ETH"), b: E("router", "LAN 2") }, { t: "tftp", dev: "tech", on: true },
      cli("copy startup-config tftp:"), cli(v.lapIp), cli(""), { t: "pull", cable: "c-run-" + (n + 2) }];
  },
  answer(v) {
    return ["Place the new hire's PC in the open-plan office; lay its cable to a spare switch port (port 5, say).",
      "On the console: configure terminal; interface gi0/5, description " + v.plan.desc.hire + ", no shutdown; end; copy running-config startup-config. Only that port: a range would open the others too.",
      "Lay your laptop's ETHERNET to the router's LAN 2 (or open a spare port without saving it), start the TFTP server, read its address.",
      "copy startup-config tftp: to your laptop's address, accepting the switch's own name: the backup is replaced. Pull your laptop's cable."];
  },
  summary(v, sim) {
    return ["The new hire's PC is at their desk, on a port of its own (" + shortPort(portOf(sim, "hire")) + "), opened and named as the office's records say.", "Every other spare port is still shut.",
      "It's saved, and the backup on your laptop is the saved configuration as it is now.", "The rest of the office runs as before."];
  }
};

/* ---------------------------------------------------------------- SO-J8 */
/* the printer moved to the manager's office over the weekend. The cabler ran a new 22 m run from there and plugged it into a
   spare switch port, which is shut, so the printer is offline. Its old run is still in its old port, live, ending at an
   empty wall jack in the open-plan office. The printer's settings belong to the port it's on: the new one needs them, and
   the old one goes back to being a spare */
const oldRunPort = function (sim) { const c = sim.cablesOf("ojack")[0], e = c && (c.a.dev === "msw" ? c.a : c.b.dev === "msw" ? c.b : null); return e ? "GigabitEthernet0/" + e.port : null; };
function printerBackCauses(sim) {
  const n = portOf(sim, "printer"), p = n && SW(sim).ports[n];
  return [
    C("none", !n, "The printer isn't cabled to the switch", "The printer's run lands on a switch port.", "The Cable runs table: the printer isn't on the managed switch."),
    C("shut", !!p && p.shutdown, "The printer's new run lands on a port that's shut down", "Its port is open.", n ? "show interfaces status: " + shortPort(n) + ", where the printer's run lands, is disabled." : ""),
    C("link", !!p && !sim.hasLink("printer"), "The printer's port is open, but it has no link", "It has a link.", n ? "show interfaces status: " + shortPort(n) + " is notconnect." : ""),
    C("print", !printOk(sim), "The front desk PC can't reach the printer", "The front desk PC reaches it.", "Test pages from the front desk don't print.")];
}
function descMovedCauses(sim, v) {
  const sw = SW(sim), pn = portOf(sim, "printer"), want = v.plan.desc.printer;
  const stale = PORT_NAMES.find(function (n) { return n !== pn && (sw.ports[n].desc || "").trim().toUpperCase() === want; });
  const what = function (n) { return n === oldRunPort(sim) ? "its run ends at an empty wall jack in the open-plan office" : "nothing on it is the printer"; };
  return descCauses(sim, v).concat([C("stale", !!stale, "A port still says it's the printer's, but the printer isn't on it any more", "Only the printer's own port says it's the printer's.", stale ? shortPort(stale) + " is named " + want + ", but " + what(stale) + "." : "")]);
}
function oldPortCauses(sim) {
  const sw = SW(sim), old = oldRunPort(sim), live = !!old && !sw.ports[old].shutdown;
  return [C("old", live, "The printer's old port is still live: its run ends at an empty wall jack in the open-plan office", "The printer's old port is shut down.", old ? "show interfaces status: " + shortPort(old) + ", the old open-plan run, is not disabled." : "")].concat(tidyCauses(sim).map(function (c) { return c.id === "open" ? Object.assign({}, c, { on: c.on && !(live && spares(sim).open === old) }) : c; }));
}
const keepMoved = function (sim) {
  return [C("pc", !online(sim, "pc"), "The front desk PC isn't online any more", "The front desk PC is online.", "The front desk PC can't reach the internet."),
    C("hire", !online(sim, "hire"), "The new hire's PC isn't online any more", "The new hire's PC is online.", "The new hire's PC can't reach the internet.")];
};
const SO8 = {
  id: "SO-J8", level: "office", title: "The printer moved",
  already: ["saved", "backup", "keep"],
  start(seed) {
    const b = SO7.start(seed), sim = b.sim, d = sim.d, net = sim.net;
    for (const a of SO7.solve(b.v)) { if (a.t === "cmd") exec(sim, a.dev, a.line); else sim.apply(a); }
    sim.cli = {}; d.tech.tftp.on = false;
    const r = rng(seed ^ 0x8e1d), port = String(r.pick([6, 7, 8, 9, 10, 11, 12]));
    /* the printer's old run stays in its port, ending at the open-plan office's wall jack; the printer is in the manager's office on the cabler's new run */
    d.ojack = { id: "ojack", kind: "jack", label: "Open-plan wall jack", sub: "nothing plugged in", on: true }; net.rooms.ojack = "open"; sim.arp.ojack = {};
    const c = sim.cablesOf("printer")[0], pe = c.a.dev === "printer" ? c.a : c.b; pe.dev = "ojack"; pe.port = "JACK";
    net.rooms.printer = "manager";
    net.cables.push({ id: "c-run-cabler", kind: "cat6", a: { dev: "msw", port: port, seated: true }, b: { dev: "printer", port: "NET", seated: true }, cond: "good", length: OFFICE_RUN.closet.manager });
    return { sim: sim, v: Object.assign({}, b.v, { newPort: port, runs: net.extra.runs || 0, lapIp: sim.offer("router", d.tech.ifaces[0].mac, null) }) };
  },
  brief() { return { quote: "The printer was driving everyone mad in the open-plan office, so over the weekend we moved it into my office, and the cabler ran a new cable from there back to the closet. Now nothing prints. He says the cable's fine and plugged in at the switch. And keep your copy of the switch's setup up to date, as before.", from: "the office manager" }; },
  mason: "Find where the new run really lands before you touch anything. Then ask what the printer's old port was doing for it, and what it's doing now.",
  limits: function (v) { return ["The office's records: the printer's port is described " + v.plan.desc.printer + ". The printer is an older model: its network card is fixed at 100 Mb/s, full duplex, and can't negotiate.", "The cabler's new run, from the manager's office back to the closet, is 22 m. The printer's old run is still in the wall, from the open-plan office.", "Backups go to your laptop by TFTP, under the name the switch suggests for its own backup. Take your laptop's network cable with you when you leave.", "The switch's console password and enable secret are the office's: " + v.plan.console + " and " + v.plan.secret + "."]; },
  reqs: [{
    id: "printer", text: "The printer is back online, in the manager's office",
    causes: printerBackCauses,
    ok: function () { return "The printer is online in the manager's office; the front desk PC reaches it."; },
    rung1: function () { return "The Cable runs table: where does the printer's new run land? Then show interfaces status on the switch."; },
    rung2: function () { return "Every spare port on this switch is shut down on purpose. A run plugged into one stays dark until that port is opened."; }
  }, {
    id: "duplex", text: "Its port matches it: 100 Mb/s, full duplex, no errors climbing",
    causes: printerCauses,
    ok: function () { return "The printer's port runs 100 Mb/s, full duplex, set by hand to match the printer, with no errors climbing."; },
    rung1: function () { return "show interfaces on the printer's new port, twice: read the duplex line, then the late collisions."; },
    rung2: function () { return "Speed, duplex and descriptions are settings of a port, not of the device: when a device moves to another port, its settings have to go with it."; }
  }, {
    id: "desc", text: "Every port's description says what's really on it",
    causes: descMovedCauses,
    ok: function () { return "Each port in use says what's on it, and no other port claims the printer."; },
    rung1: function () { return "show interfaces status: read the Name column against the Cable runs table."; },
    rung2: function () { return "A description is only a label on a port. When a device moves, the label on its old port is wrong until someone takes it off."; }
  }, {
    id: "spares", text: "The printer's old port is shut down with the other spares, every port in use is on, and your laptop is unplugged",
    causes: oldPortCauses,
    ok: function () { return "Only the ports in use are on; the old open-plan run is on a shut port; your laptop's cable is out."; },
    rung1: function () { return "show interfaces status: which ports aren't disabled, and what's at the far end of each run?"; },
    rung2: function () { return "A live port whose run ends at an empty wall jack is a way into the network for anyone who plugs into that jack."; }
  }, Object.assign({}, L_SAVED), {
    id: "backup", text: "The backup on your laptop matches what's saved now",
    causes: function (sim, v) { const bn = v.plan.baseline.toLowerCase(); return copyCauses(sim, backupName(sim), function (n) { return n !== bn; }, "backup"); },
    ok: function () { return "Your laptop's backup matches what's saved."; },
    rung1: function () { return "Your laptop's TFTP server tab: read the backup beside show startup-config."; },
    rung2: function () { return "A backup is a copy of one moment: once the saved configuration changes, copy it again under the same name."; }
  }, {
    id: "keep", text: "Everyone else still works: the front desk PC and the new hire's PC online",
    causes: keepMoved,
    ok: function () { return "The front desk PC and the new hire's PC are online."; },
    rung1: function () { return "On each PC: ipconfig, then ping the router."; },
    rung2: function () { return "Moving one device's settings touches two ports; any other port changed by mistake takes a desk off the network."; }
  }],
  /* one way: the printer's settings on the port its new run lands on, the old port cleared and shut, saved; the backup refreshed */
  solve(v) {
    const p = v.plan, n = v.runs;
    return [cli(""), cli(p.console), cli("enable"), cli(p.secret), cli("configure terminal"),
      cli("interface gi0/" + v.newPort), cli("description " + p.desc.printer), cli("speed 100"), cli("duplex full"), cli("no shutdown"),
      cli("interface gi0/3"), cli("no description"), cli("no speed"), cli("no duplex"), cli("shutdown"), cli("end"), cli("copy running-config startup-config"), cli(""),
      { t: "lay", a: E("tech", "ETH"), b: E("router", "LAN 2") }, { t: "tftp", dev: "tech", on: true },
      cli("copy startup-config tftp:"), cli(v.lapIp), cli(""), { t: "pull", cable: "c-run-" + (n + 1) }];
  },
  answer(v) {
    return ["The Cable runs table shows the cabler's run from the printer lands on port " + v.newPort + "; show interfaces status says Gi0/" + v.newPort + " is disabled.",
      "On the console: configure terminal; interface gi0/" + v.newPort + ", description " + v.plan.desc.printer + ", speed 100, duplex full, no shutdown.",
      "interface gi0/3 (its run now ends at the open-plan office's empty wall jack): no description, no speed, no duplex, shutdown; end; copy running-config startup-config.",
      "Refresh the backup: your laptop on the router's LAN 2, the TFTP server started, copy startup-config tftp: under the switch's own name; pull your laptop's cable. (Pulling the old run and laying the printer's run into port 3 works too.)"];
  },
  summary(v, sim) {
    return ["The printer is online in the manager's office, on " + shortPort(portOf(sim, "printer")) + ", set by hand to 100 Mb/s full duplex like the printer, and named as the records say.",
      "Its old port is shut, its label taken off: the open-plan office's empty jack is dead.", "It's saved, and the backup on your laptop is up to date."];
  }
};

/* ---------------------------------------------------------------- SO-J9 */
/* over the weekend the cablers redid the office's cabling: every desk's run, and the two empty wall jacks', comes back to a
   new 24-port patch panel in the closet rack, punched down at its back. They took the old 8-port switch away, patched
   nothing to the switch, and left no map. The switch's ports are still set up for the desks they had */
const DESKS = ["pc", "printer", "hire"];
const MAP_ROOM = { front: "front desk", open: "open-plan office", manager: "manager's office", meeting: "meeting room" };
const descAt = function (sim, n) { return n ? (SW(sim).ports[n].desc || "").trim().toUpperCase() : ""; };
/* where each run punched down at the back of the panel really goes (the room at its far end), by panel port */
const panelRuns = function (sim) { const real = {}; sim.cablesOf("pp").forEach(function (c) { const e = c.a.dev === "pp" ? c.a : c.b, o = e === c.a ? c.b : c.a; if (/R$/.test(e.port)) real[e.port.slice(0, -1)] = sim.net.rooms[o.dev]; }); return real; };
const runOf = function (sim, id) { return sim.cablesOf(id).find(function (c) { const pe = sim.panelEnd(c); return pe && /R$/.test(pe.port); }) || null; };
function patchedCauses(sim) {
  const cordFor = function (id) { const c = runOf(sim, id); return c ? sim.cableAt("pp", sim.panelEnd(c).port.slice(0, -1)) : null; };
  const unp = DESKS.find(function (id) { return !cordFor(id); });
  const notsw = DESKS.find(function (id) { const k = cordFor(id); return k && !onMsw(sim, id); });
  const shut = DESKS.find(function (id) { const n = portOf(sim, id); return n && SW(sim).ports[n].shutdown; });
  const offline = ["pc", "hire"].find(function (id) { return !online(sim, id); });
  return [
    C("none", !!unp, "A desk's run has nothing patched into the front of its panel port", "Every desk's run is patched.", unp ? capFirst(WHO[unp]) + " has no link: " + (unp === "printer" ? "its control panel says the network cable is disconnected." : "ipconfig says Media disconnected.") : ""),
    C("notsw", !!notsw, "A desk is patched to something other than the switch: the office's desks all go through the switch", "Every desk is patched to the switch.", notsw ? capFirst(WHO[notsw]) + "'s panel port is patched to something that isn't the managed switch." : ""),
    C("shut", !!shut, "A desk is patched to a switch port that's shut down", "Every desk's switch port is open.", shut ? "show interfaces status: " + shortPort(portOf(sim, shut)) + ", where " + WHO[shut] + " is patched, is disabled." : ""),
    C("print", !printOk(sim), "The front desk PC can't reach the printer", "The front desk PC reaches the printer.", "Test pages from the front desk don't print."),
    C("online", !!offline, "A desk can't reach the internet", "Both PCs reach the internet.", offline ? capFirst(WHO[offline]) + " can't reach the internet." : "")];
}
function deskPortCauses(sim, v) {
  const on = DESKS.filter(function (id) { return portOf(sim, id); });
  const swapped = on.find(function (id) { const d = descAt(sim, portOf(sim, id)); return d && d !== v.plan.desc[id] && DESKS.some(function (o) { return v.plan.desc[o] === d; }); });
  const spare = on.find(function (id) { return !descAt(sim, portOf(sim, id)); });
  const other = on.find(function (id) { return descAt(sim, portOf(sim, id)) !== v.plan.desc[id]; });
  return [
    C("none", on.length < DESKS.length, "Not every desk is on a switch port yet", "Every desk is on a switch port.", "The front desk PC, the printer and the new hire's PC aren't all patched to the switch yet."),
    C("swap", !!swapped, "A desk is patched to a port set up for another desk", "No desk is on another desk's port.", swapped ? capFirst(WHO[swapped]) + " is on " + shortPort(portOf(sim, swapped)) + ", which is named " + descAt(sim, portOf(sim, swapped)) + "." : ""),
    C("spare", !!spare, "A desk is patched to a spare port, with nothing on it set up for that desk", "No desk is on a spare port.", spare ? capFirst(WHO[spare]) + " is on " + shortPort(portOf(sim, spare)) + ", a port with no description." : ""),
    C("other", !!other, "A desk is on a port whose description doesn't match it", "Each desk is on the port named for it.", other ? capFirst(WHO[other]) + " is on " + shortPort(portOf(sim, other)) + ", named " + descAt(sim, portOf(sim, other)) + "." : "")];
}
function mapCausesJob(sim) {
  const m = sim.net.cablemap || {}, real = panelRuns(sim), empty = !Object.keys(m).some(function (k) { return m[k]; });
  const wrong = Object.keys(real).find(function (n) { return m[n] && m[n] !== real[n]; });
  const missing = Object.keys(real).find(function (n) { return !m[n]; });
  const extra = Object.keys(m).find(function (n) { return m[n] && !real[n]; });
  return [
    C("none", empty, "Nothing is written in the cable map yet", "The map has been filled in.", "The cable map is empty."),
    C("wrong", !!wrong, "A port in the map names a room its run doesn't go to", "Every room in the map is where its port's run goes.", wrong ? "The cable map: port " + wrong + "'s run doesn't go to the " + (MAP_ROOM[m[wrong]] || "room it names") + "." : ""),
    C("missing", !empty && !!missing, "A port with a run punched down on it isn't in the map", "Every run is in the map.", missing ? "The cable map: port " + missing + " has a run, but the map leaves it out." : ""),
    C("extra", !!extra, "The map names a room for a port with no run on it", "The map names nothing for an empty port.", extra ? "The cable map: port " + extra + " has no run punched down on it." : "")];
}
function sparesJ9(sim) {
  const sw = SW(sim), used = spares(sim).used;
  const open = PORT_NAMES.find(function (n) { return !used[n] && !descAt(sim, n) && !sw.ports[n].shutdown; });   /* a port named for a desk isn't a spare, even unpatched */
  return [C("open", !!open, "A spare port is live: anyone in the office could plug something into it", "Every spare port is shut down.", open ? "show interfaces status: " + shortPort(open) + " has nothing on it and is not disabled." : "")]
    .concat(tidyCauses(sim).filter(function (c) { return c.id === "plugged"; }));
}
const SO9 = {
  id: "SO-J9", level: "office", title: "The cable map", cablemap: true,
  already: ["spares", "saved", "backup"],
  start(seed) {
    const b = SO8.start(seed), sim = b.sim, d = sim.d, net = sim.net;
    for (const a of SO8.solve(b.v)) { if (a.t === "cmd") exec(sim, a.dev, a.line); else sim.apply(a); }
    sim.cli = {}; d.tech.tftp.on = false;
    const r = rng(seed ^ 0x9ca7), free = r.shuffle(["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15", "16"]);
    const P = { pc: free[0], printer: free[1], hire: free[2], ojack: free[3], mjack: free[4] };
    d.pp = { id: "pp", kind: "patchpanel", label: "Patch panel", sub: "24-port Cat6", on: true, tabs: {} };
    d.mjack = { id: "mjack", kind: "jack", label: "Meeting room wall jack", sub: "nothing plugged in", on: true };
    net.rooms.pp = "closet"; net.rooms.mjack = "meeting"; sim.arp.pp = {}; sim.arp.mjack = {};
    if (d.switch && !sim.cablesOf("switch").length) { delete d.switch; delete net.rooms.switch; delete sim.arp.switch; }   /* the cablers took the old 8-port switch away: the panel is where it stood */
    net.cables = net.cables.filter(function (c) { return !((c.a.dev === "msw" || c.b.dev === "msw") && ["pc", "printer", "hire", "ojack"].some(function (id) { return c.a.dev === id || c.b.dev === id; })); });
    const LEN = { pc: OFFICE_RUN.closet.front, printer: OFFICE_RUN.closet.manager, hire: OFFICE_RUN.closet.open, ojack: OFFICE_RUN.closet.open, mjack: OFFICE_RUN.closet.meeting }, PORT = { pc: "NIC", printer: "NET", hire: "NIC", ojack: "JACK", mjack: "JACK" };
    Object.keys(P).forEach(function (id) { net.cables.push({ id: "c-pp-" + id, kind: "cat6", a: { dev: "pp", port: P[id] + "R", seated: true }, b: { dev: id, port: PORT[id], seated: true }, cond: "good", length: LEN[id] }); });
    net.cablemap = {};
    const set = {}; DESKS.forEach(function (id) { set[id] = SW(sim).ports && PORT_NAMES.find(function (n) { return descAt(sim, n) === b.v.plan.desc[id]; }); });
    return { sim: sim, v: Object.assign({}, b.v, { P: P, set: set }) };
  },
  brief() { return { quote: "The cablers finally came at the weekend and did it properly: every desk's cable now goes back to a patch panel in the closet rack, and the old little switch has gone. But this morning nobody's on the network at all, and they didn't leave any sort of map of what goes where. Can you get us working again, and write it down so nobody ever has to guess?", from: "the office manager" }; },
  mason: "The switch already knows which port is whose: its descriptions. What nobody knows is which panel port each run is on. Ask the cable, then write down what it told you.",
  limits: function (v) { return ["The switch is set up as you left it: each port in use is described for what was on it (show interfaces status).", "Every run is punched down at the back of the panel: the front desk's, the printer's from the manager's office, the new hire's, the old open-plan run (an empty wall jack now) and the meeting room's (an empty wall jack). A patch cord goes from a panel port's front to a switch port.", "In the van: a tone generator to clip onto a run at the desk end, and an inductive probe to run along the back of the panel.", "The switch's console password and enable secret are the office's: " + v.plan.console + " and " + v.plan.secret + "."]; },
  reqs: [{
    id: "patched", text: "Every desk is patched through the panel to the switch, and online: the front desk PC, the printer and the new hire's PC",
    causes: patchedCauses,
    ok: function () { return "Every desk is patched to the switch; the PCs are online and the front desk prints."; },
    rung1: function () { return "On a desk's Physical tab, put the tone generator on its cable; then run the probe along the back of the panel."; },
    rung2: function () { return "A patch panel joins the run punched down at the back of each port to whatever is patched into the front of the same port. A run with nothing in its front goes nowhere."; }
  }, {
    id: "ports", text: "Each desk is on the switch port set up for it",
    causes: deskPortCauses,
    ok: function () { return "Each desk is on the switch port named for it, with that port's settings."; },
    rung1: function () { return "show interfaces status: read the Name column, then follow each desk's cord from the panel down to the switch."; },
    rung2: function () { return "A switch port's description, speed and duplex were set for one device: patch each desk to the port set up for it, or the settings land on the wrong device."; }
  }, {
    id: "map", text: "The cable map names the room every panel port's run goes to",
    causes: mapCausesJob,
    ok: function () { return "The cable map names the right room for every run, and nothing for the empty ports."; },
    rung1: function () { return "Tone each run from its far end, the empty wall jacks too, and note where the probe sounds."; },
    rung2: function () { return "A cable map records where every run really goes, the unused ones as well: the next person patches from it without tracing anything."; }
  }, {
    id: "spares", text: "Every spare port is still shut down, and your laptop is unplugged",
    causes: sparesJ9,
    ok: function () { return "The spare ports are shut down; your laptop's network cable is out."; },
    rung1: function () { return "show interfaces status: which ports aren't disabled, and what's on each?"; },
    rung2: function () { return "Patching changes nothing on the switch. A port opened for a desk that has one already is a way in for anyone else."; }
  }, Object.assign({}, L_SAVED), {
    id: "backup", text: "The backup on your laptop matches what's saved now",
    causes: function (sim, v) { const bn = v.plan.baseline.toLowerCase(); return copyCauses(sim, backupName(sim), function (n) { return n !== bn; }, "backup"); },
    ok: function () { return "Your laptop's backup matches what's saved."; },
    rung1: function () { return "Your laptop's TFTP server tab: read the backup beside show startup-config."; },
    rung2: function () { return "Patching needs no change on the switch. If you changed and saved anything, the backup is out of date: copy it again."; }
  }],
  /* one way: each desk's run patched to the switch port named for it, the map written; no change on the switch at all */
  solve(v) {
    const P = v.P, sp = function (id) { return v.set[id].replace("GigabitEthernet0/", ""); };
    return [{ t: "lay", a: E("pp", P.pc), b: E("msw", sp("pc")) }, { t: "lay", a: E("pp", P.printer), b: E("msw", sp("printer")) }, { t: "lay", a: E("pp", P.hire), b: E("msw", sp("hire")) },
      { t: "cablemap", map: (function () { const m = {}; m[P.pc] = "front"; m[P.printer] = "manager"; m[P.hire] = "open"; m[P.ojack] = "open"; m[P.mjack] = "meeting"; return m; })() }];
  },
  answer(v) {
    const P = v.P, sp = function (id) { return shortPort(v.set[id]); };
    return ["Tone each run at its far end (the front desk PC's cable, the printer's, the new hire's, both empty wall jacks) and run the probe along the back of the panel: the front desk is port " + P.pc + ", the printer " + P.printer + ", the new hire " + P.hire + ", the open-plan jack " + P.ojack + ", the meeting room jack " + P.mjack + ".",
      "show interfaces status gives the switch port named for each desk: the front desk " + sp("pc") + ", the printer " + sp("printer") + ", the new hire " + sp("hire") + ".",
      "Lay a patch cord from each desk's panel port to its switch port. The empty jacks stay unpatched.",
      "Write the cable map: every port with a run, the empty jacks' too, with the room its run goes to. Save it. Nothing on the switch changes, so the backup stays right."];
  },
  summary(v) {
    return ["Every desk's run is patched from the panel to the switch port set up for it: the office is back online.", "The cable map names the room for every run on the panel, the two empty wall jacks too.", "Nothing on the switch needed changing: the spares are still shut, and the backup still matches."];
  }
};

/* ---------------------------------------------------------------- SO-J10 */
/* the meeting room becomes the back office, on a switch of its own of the same model, in its box. The installer ran a fibre
   run there from the closet (it passes the lift's motor room, so copper was out): OM2 multimode, LC at both ends. The modules
   come from the van; the switch's slots are 1 Gb/s SFP. The closet switch's fibre port was shut with the spares in SO-J3 */
const BSW = function (sim) { return sim.d.bsw.sw; };
const fibreRun = function (sim) { return sim.net.cables.find(function (c) { return c.kind === "fibre" && ((c.a.dev === "msw" && c.b.dev === "bsw") || (c.a.dev === "bsw" && c.b.dev === "msw")); }) || null; };
const modAt = function (sim, e) { const x = sim.d[e.dev]; return x.sfp && x.sfp[e.port] ? SFP_MODULES[x.sfp[e.port]] : null; };
function fibreCauses(sim) {
  const x = sim.d.bsw, c = fibreRun(sim), mods = c ? [modAt(sim, c.a), modAt(sim, c.b)] : [], mswEnd = c && (c.a.dev === "msw" ? c.a : c.b);
  const shut = !!mswEnd && SW(sim).ports[swPort(mswEnd.port)].shutdown;
  return [
    C("box", x.boxed, "The back office switch is still in its box", "It's out of its box, in the back office.", "The back office switch is still in its box."),
    C("run", !x.boxed && !c, "The fibre run isn't plugged into both switches", "The fibre run is plugged in at both ends.", "The Cable runs table: no fibre between the closet switch and the back office switch."),
    C("plus", !!c && mods.some(function (m) { return m && m.rate !== 1000; }), "A 10 Gb/s SFP+ module is in a 1 Gb/s SFP slot, which can't run it", "Both modules are 1 Gb/s SFP modules.", "show interfaces status on the closet switch: its fibre port is err-disabled, or the back office switch's module isn't supported."),
    C("smf", !!c && mods.some(function (m) { return m && m.rate === 1000 && m.fiber !== c.fiber; }), "A single-mode module is on the multimode run", "Both modules are made for multimode fibre.", "show interfaces transceiver: no light received; a module's label says single-mode, the cord's jacket says multimode."),
    C("pair", !!c && !!mods[0] && !!mods[1] && mods[0].nm !== mods[1].nm, "The two ends' modules aren't the same kind", "Both ends are the same kind of module.", "The two modules' labels give different wavelengths."),
    C("shut", shut, "The closet switch's fibre port is shut down", "The closet switch's fibre port is open.", mswEnd ? "show interfaces status: " + shortPort(swPort(mswEnd.port)) + " is disabled." : ""),
    C("dark", !!c && !sim.cableUp(c), "The fibre link is still dark", "The fibre link is up.", "show interfaces status: the fibre port is notconnect.")];
}
function fibrePortCauses(sim, v) {
  const c = fibreRun(sim), e = c && (c.a.dev === "msw" ? c.a : c.b), n = e && swPort(e.port), p = n && SW(sim).ports[n], d = p ? (p.desc || "").trim().toUpperCase() : "";
  return [
    C("norun", !c, "Nothing joins the closet switch to the back office yet", "The fibre run is in the closet switch.", "The Cable runs table: no fibre at the closet switch."),
    C("shut", !!p && p.shutdown, "The closet switch's fibre port is shut down, like every spare", "It's open.", n ? "show interfaces status: " + shortPort(n) + " is disabled." : ""),
    C("none", !!p && !d, "Its fibre port has no description", "It has a description.", n ? "show interfaces status: the Name column is empty on " + shortPort(n) + "." : ""),
    C("wrong", !!p && !!d && d !== v.plan.desc.fibre, "Its description isn't the one in the office's records", "Its description is the records'.", n ? shortPort(n) + " is named " + d + "." : "")];
}
const backOk = function (sim) { const ip = sim.d.printer.ifaces[0].cfg.ip, r = sim.route("mpc", ip); return !!(r.local && r.owner.indexOf("printer") >= 0); };
function backPcCauses(sim) {
  const c = sim.cablesOf("mpc")[0], far = c && (c.a.dev === "mpc" ? c.b : c.a), a = sim.addr("mpc");
  return [
    C("cable", !c || far.dev !== "bsw", "The back office PC isn't cabled to the back office switch", "It's cabled to the back office switch.", "The Cable runs table: the back office PC's cable doesn't go to the back office switch."),
    C("link", !!c && !sim.hasLink("mpc"), "The back office PC has no link", "It has a link.", "ipconfig on the back office PC: Media disconnected."),
    C("addr", !a || a.kind === "apipa", "It has no address from the router", "It has an address from the router.", "ipconfig on the back office PC: " + (a ? a.ip : "no address") + "."),
    C("net", !online(sim, "mpc"), "It can't reach the internet", "It reaches the internet.", "The back office PC can't reach the internet."),
    C("print", !backOk(sim), "It can't reach the printer", "It reaches the printer.", "Test pages from the back office PC don't print.")];
}
function bswCauses(sim, v) {
  const x = sim.d.bsw, sw = BSW(sim), con = sw.con, p = v.plan;
  return [
    C("box", x.boxed, "The back office switch is still in its box", "It's out of its box.", "The back office switch is still in its box."),
    C("factory", sw.hostname === "Switch", "It still has its factory name", "It has a name of its own.", "Its console prompt still says Switch."),
    C("name", sw.hostname !== p.bswHost, "It has a name, but not the one in the office's records", "Its name is the records'.", "Its prompt says " + sw.hostname + "."),
    C("secret", !sw.enableSecret, "Anyone at its console can type enable and change anything", "Privileged mode needs a secret.", sw.enablePassword ? "Only an enable password is set: it sits in the configuration as plain text." : "enable goes straight to privileged mode, with no password."),
    C("secretw", !!sw.enableSecret && !pwOk(sw.enableSecret, p.secret), "Its enable secret isn't the office's", "Its enable secret is the office's.", "The office's enable secret doesn't open its privileged mode."),
    C("con", !con.password || !con.login, "Its console doesn't ask for a password", "Its console asks for a password.", "Log out of its console, press RETURN: it goes straight in."),
    C("conw", !!con.password && !!con.login && !pwOk(con.password, p.console), "Its console asks for a password, but not the office's", "Its console password is the office's.", "The office's console password isn't accepted.")];
}
function bothSaved(sim) {
  const x = sim.d.bsw, b = BSW(sim), m = SW(sim);
  return [
    C("box", x.boxed, "The back office switch is still in its box", "It's out of its box.", "The back office switch is still in its box."),
    C("bnever", !b.startup, "Nothing is saved on the back office switch: a power cut would bring back its factory settings", "The back office switch's configuration is saved.", "On the back office switch, show startup-config: startup-config is not present."),
    C("bsince", !!b.startup && unsaved(b), "The back office switch has changes since it was last saved", "What runs on the back office switch is saved.", "On the back office switch, the running and startup configurations differ."),
    C("msince", unsaved(m), "The closet switch has changes since it was last saved", "What runs on the closet switch is saved.", "On the closet switch, the running and startup configurations differ.")];
}
const SO10 = {
  id: "SO-J10", level: "office", title: "A fibre link to the back office",
  already: ["backup", "keep"],
  start(seed) {
    const b = SO9.start(seed), sim = b.sim, d = sim.d, net = sim.net;
    for (const a of SO9.solve(b.v)) { if (a.t === "cmd") exec(sim, a.dev, a.line); else sim.apply(a); }
    sim.cli = {}; d.tech.tftp.on = false;
    const r = rng(seed ^ 0xb5a1), sw = newSwitch(); sw.unit = 3;
    d.msw.sfp = { SFP1: null, SFP2: null, SFP3: null, SFP4: null };
    d.bsw = { id: "bsw", kind: "mswitch", label: "Back office switch", sub: "MSW-2800G", on: true, boxed: true, mac: mac(r), sw: sw, sfp: { SFP1: null, SFP2: null, SFP3: null, SFP4: null }, fixed: ["meeting", "in the back office (the meeting room), on its wall shelf"] };
    d.mpc = { id: "mpc", kind: "pc", label: "Back office PC", sub: "DHCP", on: true, os: "windows", user: "backoffice", host: "BACKOFFICE-PC", printer: { name: "Office printer", port: d.printer.ifaces[0].cfg.ip },
      ifaces: [{ name: "Ethernet", type: "eth", port: "NIC", mac: mac(r), desc: "Gigabit Network Connection", cfg: { mode: "dhcp", dnsMode: "auto" }, lease: null, apipa: null }] };
    net.rooms.mpc = "meeting"; sim.arp.bsw = {}; sim.arp.mpc = {};
    const con = sim.net.cables.find(function (c) { return c.kind === "console"; });
    return { sim: sim, v: Object.assign({}, b.v, { runs: net.extra.runs || 0, con: con ? con.id : null, lapIp: sim.offer("router", d.tech.ifaces[0].mac, null) }) };
  },
  brief() { return { quote: "We're turning the meeting room into a back office for our two part-timers. A second switch came this week, the same as the one in the closet, and the installer has already run a fibre from the closet to the meeting room: he said copper was out because it passes the lift's motor room. He left it coiled on the shelf in each room. The back office's PC is on its desk. Can you join it all up and set the new switch up the way the closet one is?", from: "the office manager" }; },
  mason: "Read the run before you choose the modules: the fibre in the wall is the one thing you can't change. Then make the new switch the office's own, the way you did the first one.",
  limits: function (v) { return ["The fibre run: OM2 multimode (50/125 µm), 35 m, LC at both ends. Both switches' SFP slots are 1 Gb/s SFP.", "In the van: 1000BASE-SX modules (850 nm, multimode), 1000BASE-LX modules (1310 nm, single-mode), and a 10GBASE-SR SFP+ module (850 nm, multimode, 10 Gb/s).", "The office's records: the back office switch is " + v.plan.bswHost + ", with the closet switch's enable secret (" + v.plan.secret + ") and console password (" + v.plan.console + "). The closet switch's end of the fibre is described " + v.plan.desc.fibre + ".", "Your laptop's console cable is 1.8 m: it reaches a switch in the same room. Backups of the closet switch go to your laptop by TFTP, under the name the switch suggests; take your laptop's network cable with you when you leave."]; },
  reqs: [{
    id: "fibre", text: "The back office switch is in the meeting room, joined to the closet switch over the fibre run",
    causes: fibreCauses,
    ok: function () { return "The fibre link is up between the closet switch and the back office switch."; },
    rung1: function () { return "Read the run's jacket in the limits, then each module's label in the van. On the closet switch: show interfaces status and show interfaces transceiver."; },
    rung2: function () { return "An SFP module sends one wavelength on one kind of fibre at one speed: both ends must match each other, the fibre between them, and the speed their slots can run."; }
  }, {
    id: "port", text: "The closet switch's fibre port is open, and described as the office's records say",
    causes: fibrePortCauses,
    ok: function () { return "The closet switch's fibre port is open, named as the records say."; },
    rung1: function () { return "On the closet switch: show interfaces status, the fibre ports at the end of the list."; },
    rung2: function () { return "The spare ports and the fibre slots were shut down on purpose; a fibre slot comes up only when it's opened in its own interface configuration, where its description is set too."; }
  }, {
    id: "back", text: "The back office PC is online through the back office switch, and prints",
    causes: backPcCauses,
    ok: function () { return "The back office PC is online and reaches the printer."; },
    rung1: function () { return "On the back office PC: ipconfig, then ping the router and the printer."; },
    rung2: function () { return "The back office PC's traffic crosses its own switch, then the fibre, then the closet switch: each hop has to be up. Once it is, a PC on 169.254 asks for an address again."; }
  }, {
    id: "bsw", text: "The back office switch is the office's: its name from the records, the enable secret, the console password",
    causes: bswCauses,
    ok: function (sim) { return "It's called " + BSW(sim).hostname + "; privileged mode and the console are locked with the office's secret and password."; },
    rung1: function () { return "Your laptop's serial terminal on the back office switch: read its prompt, then show running-config."; },
    rung2: function () { return "A switch fresh from its box has no name and no passwords: anyone at its console owns it. The console port is the way in, with the console cable in the same room."; }
  }, {
    id: "saved", text: "Both switches' setups survive a power cut",
    causes: bothSaved,
    ok: function () { return "What runs on each switch is saved."; },
    rung1: function () { return "On each switch: compare show running-config with show startup-config."; },
    rung2: function () { return "Each switch keeps its own startup configuration: saving one saves nothing on the other."; }
  }, {
    id: "backup", text: "The backup of the closet switch on your laptop matches what it has saved",
    causes: function (sim, v) { const bn = v.plan.baseline.toLowerCase(); return copyCauses(sim, backupName(sim), function (n) { return n !== bn; }, "backup"); },
    ok: function () { return "Your laptop's backup of the closet switch matches what it has saved."; },
    rung1: function () { return "Your laptop's TFTP server tab: read the backup beside the closet switch's show startup-config."; },
    rung2: function () { return "Once the closet switch's saved configuration changes, its backup is out of date: copy it again under the same name."; }
  }, {
    id: "keep", text: "Everything that worked still works: the front desk PC and the new hire's PC online, and printing",
    causes: function (sim) { return keepMoved(sim).concat([C("print", !printOk(sim), "The front desk PC can't reach the printer", "The front desk PC reaches the printer.", "Test pages from the front desk don't print.")]); },
    ok: function () { return "The front desk PC and the new hire's PC are online; the front desk prints."; },
    rung1: function () { return "On each PC: ipconfig, then ping the router and the printer."; },
    rung2: function () { return "Opening one fibre port changes nothing for the copper ports; a range typed by mistake can."; }
  }],
  /* one way: SX modules at both ends (multimode, 1 Gb/s), the run plugged in, the back office PC cabled; the closet switch's fibre port
     opened, named, saved, its backup refreshed; your laptop carried to the back office, the new switch named and locked on its console, saved */
  solve(v) {
    const p = v.plan, n = v.runs;
    return [{ t: "place", dev: "bsw", room: "meeting" }, { t: "sfp", dev: "msw", slot: "SFP1", type: "1000BASE-SX" }, { t: "sfp", dev: "bsw", slot: "SFP1", type: "1000BASE-SX" },
      { t: "lay", a: E("msw", "SFP1"), b: E("bsw", "SFP1") }, { t: "lay", a: E("bsw", "1"), b: E("mpc", "NIC") },
      cli(""), cli(p.console), cli("enable"), cli(p.secret), cli("configure terminal"), cli("interface gi0/25"), cli("description " + p.desc.fibre), cli("no shutdown"), cli("end"), cli("copy running-config startup-config"), cli(""),
      { t: "lay", a: E("tech", "ETH"), b: E("router", "LAN 2") }, { t: "tftp", dev: "tech", on: true }, cli("copy startup-config tftp:"), cli(v.lapIp), cli(""), { t: "pull", cable: "c-run-" + (n + 3) },
      { t: "pull", cable: v.con }, { t: "place", dev: "tech", room: "meeting" }, { t: "lay", a: E("tech", "USB-C"), b: E("bsw", "CONSOLE") },
      cli(""), cli("enable"), cli("configure terminal"), cli("hostname " + p.bswHost), cli("enable secret " + p.secret), cli("line console 0"), cli("password " + p.console), cli("login"), cli("end"), cli("copy running-config startup-config"), cli("")];
  },
  answer(v) {
    return ["Place the back office switch in the meeting room. The run is multimode and the slots are 1 Gb/s: put a 1000BASE-SX module in SFP1 of each switch (not the LX: single-mode; not the SFP+: 10 Gb/s). Lay the fibre between the two SFP1 slots, and the back office PC to a port of the new switch.",
      "On the closet switch's console: interface gi0/25, description " + v.plan.desc.fibre + ", no shutdown; end; copy running-config startup-config. Refresh its backup (your laptop on the router's LAN 2, the TFTP server, copy startup-config tftp:), then pull your laptop's cable.",
      "Pull the console cable, place your laptop in the meeting room and lay the console cable to the back office switch's CONSOLE.",
      "On its console: enable, configure terminal, hostname " + v.plan.bswHost + ", enable secret (the office's), line console 0, password (the office's), login, end, copy running-config startup-config. The back office PC asks again for its address once the fibre is up."];
  },
  summary(v, sim) {
    return ["The back office switch is in the meeting room, joined to the closet over the multimode run with a 1000BASE-SX module at each end.", "The closet switch's fibre port is open and named; the back office PC is online and prints.",
      "The back office switch is the office's: " + BSW(sim).hostname + ", locked with the office's secret and console password.", "Both switches are saved, and the closet switch's backup is up to date."];
  }
};

export const OFFICE_JOBS = [SO1, SO2, SO3, SO4, SO5, SO6, SO7, SO8, SO9, SO10];
