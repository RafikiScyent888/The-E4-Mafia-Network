/* What a device's 3D model shows, worked out from the simulation: which
   plugs are in, out or loose, which lights are lit (and in what colour),
   any damage on a cable, and what is on its screen. Plain data: the
   viewer draws it, the same facts are written out in words under the
   model (so nothing depends on seeing colour), and the tests read it to
   prove each fault really shows on the model. */
import { page, cableName } from "./pages.js";
import { prompt } from "./cmd.js";
import { POE, SFP_MODULES } from "./sim.js";

/* the model each device is drawn with (the old router in HOME-10 is a home router too) */
export const MODEL_OF = { modem: "modem", router: "router", rogue: "router", switch: "switch", pc: "pc", laptop: "laptop", printer: "printer", camera: "camera", tv: "tv", mesh: "mesh", injector: "injector", meet: "switch", mpc: "pc", mgr: "pc", hire: "pc", bpc: "pc" };   /* the office's meeting room (SO-04): an old 5-port switch in the same housing, and a desktop */

/* each model's network ports: the name printed on the model, and the sim's port at that device */
const PORTS = {
  modem: [["CABLE IN", "CABLE IN"], ["ETHERNET", "ETH"]],
  router: [["INTERNET", "WAN"], ["LAN 1", "LAN 1"], ["LAN 2", "LAN 2"], ["LAN 3", "LAN 3"], ["LAN 4", "LAN 4"]],
  switch: [["1", "1"], ["2", "2"], ["3", "3"], ["4", "4"], ["5", "5"]],
  pc: [["LAN", "NIC"]], printer: [["NETWORK", "NET"]], camera: [["PoE", "LAN"]], tv: [["LAN", "LAN"]],
  laptop: [["ETHERNET", "ETH"]], techlaptop: [["ETHERNET", "ETH"], ["USB-C", "USB-C"]], mesh: [["WAN", "WAN"], ["LAN", "LAN"]], injector: [["DATA IN", "DATA IN"], ["DATA + POWER OUT", "PoE OUT"]],
  switch8: [1, 2, 3, 4, 5, 6, 7, 8].map(function (n) { return [String(n), String(n)]; }),
  /* the business router (BR-4200): copper GE 0/0 to 0/7, the SFP slots GE 0/8 and 0/9, CON */
  brouter: Array.from({ length: 10 }, function (_, i) { return ["Gi0/" + i, "Gi0/" + i]; }).concat([["CONSOLE", "CONSOLE"]]),
  /* the managed switch: its 24 ports by the numbers printed over and under them, and CONSOLE */
  msw: Array.from({ length: 24 }, function (_, i) { return [String(i + 1), String(i + 1)]; }).concat([["CONSOLE", "CONSOLE"], ["SFP1", "SFP1"], ["SFP2", "SFP2"], ["SFP3", "SFP3"], ["SFP4", "SFP4"]]),
  /* build mode's PoE+ injector, as photographed: two pairs, "DATA IN" over each input and the pair's number under it */
  injectorDual: [["DATA IN 1", "DATA IN"], ["DATA IN 2", "DATA IN 2"], ["DATA + POWER OUT 1", "PoE OUT"], ["DATA + POWER OUT 2", "PoE OUT 2"]],
  /* the closet rack (SO-08): the patch panel's 24 front jacks, "P1" to "P24" on the model; the wall jack has nothing in its front */
  rack: Array.from({ length: 24 }, function (_, i) { return ["P" + (i + 1), String(i + 1)]; }),
  wallplate: [],
  /* the ceiling access point: its one port, in the bay on its top */
  ceilingAP: [["ETH", "ETH"]],   /* "port:ETH" on the model; printed ETH (PoE IN) beside it */
  /* the dome cameras (SB-J5): the waterproof RJ45 coupler on the end of each one's pigtail */
  domeCeiling: [["LAN", "LAN"]], domeWall: [["LAN", "LAN"]]
};
/* what the installer wrote on the panel's tabs, from his map */
const TAB = { front: "FRONT", open: "OPEN", manager: "MGR", meeting: "MEET" };
const INJ = { injector: true, injectorDual: true };
const SAY_PORT = { brouter: function (p) { return p === "CONSOLE" ? "CON (console)" : "Port GE " + p.slice(2) + (+p.slice(4) >= 8 ? " (SFP slot)" : "") + ", " + p; }, switch: function (p) { return "Port " + p; }, switch8: function (p) { return "Port " + p; }, msw: function (p) { return /^\d+$/.test(p) ? "Port " + p : p; }, rack: function (p) { return "Patch panel port " + p.slice(1); } };

export function physicalState(sim, id) {
  const x = sim.d[id]; if (!x) return null;
  const model = x.kind === "patchpanel" ? "rack" : x.kind === "jack" ? "wallplate" : x.kind === "injector" ? (x.dual ? "injectorDual" : "injector") : x.kind === "mswitch" ? "msw" : x.kind === "brouter" ? "brouter" : x.kind === "bap" ? "ceilingAP" : x.kind === "dcam" ? (x.mount === "ceiling" ? "domeCeiling" : "domeWall") : x.kind === "techlaptop" ? "techlaptop" : x.kind === "switch" && x.ports === 8 ? "switch8" : MODEL_OF[id]; if (!model) return null;   /* build mode's PoE+ injector is the dual-port one; the office has the managed switch and an old 8-port */
  const ports = [], leds = [], says = [], opts = {};
  /* the device an injector output powers right now (its PoE light lit), or null */
  const feeds = function (port) { const c = sim.cableAt(id, port); if (!c) return null; const o = c.a.dev === id ? c.b.dev : c.a.dev; return sim.d[o] && sim.d[o].poe && sim.on(o) && sim.poeSource(o) === x ? o : null; };
  const on = sim.on(id);
  PORTS[model].forEach(function (pp) {
    const c = sim.cableAt(id, pp[1]);
    const p = { name: pp[0], label: (SAY_PORT[model] || function (n) { return n; })(pp[0]), plug: "none", link: false, speed: 0, damage: null, coax: !!(c && c.kind === "coax") };
    if (c) {
      const end = c.a.dev === id && c.a.port === pp[1] ? "a" : "b", e = c[end];
      if (c.kind === "coax") p.plug = e.tight ? "in" : "loose";
      else p.plug = e.seated ? "in" : "out";
      p.link = sim.cableUp(c); p.speed = sim.speed(c);
      /* the damage shows on the model at the end it is near: crushed under the PC's desk, the split a hand's width from its plug */
      if (c.cond === "crushed" && end === (c.a.dev === "pc" ? "a" : "b")) p.damage = "crushed";
      if (c.cond === "damaged" && (!c.kink || c.kink === end)) p.damage = "split";
    }
    if (c && c.kind === "console") { p.console = true; p.link = false; }
    p.lights = model === "injectorDual" ? (/^PoE OUT/.test(pp[1]) ? (feeds(pp[1]) ? "green" : "off") : null)   /* its outputs' corner lights: lit while that output powers a device */
      : p.coax || INJ[model] || p.console || pp[1] === "CONSOLE" || model === "rack" ? null : p.link ? ((model === "switch" || model === "switch8") && p.speed !== 1000 ? "amber" : "green") : "off";
    ports.push(p);
  });
  if (INJ[model]) ports.push({ name: "DC IN", label: "Power adapter cord (DC IN, " + (model === "injectorDual" ? "right" : "left") + " side)", plug: x.power ? "in" : "out", dc: true, link: false, speed: 0, damage: null, coax: false, lights: null });
  const L = function (role, name, state, color) { leds.push({ role: role, name: name, state: state, color: color || "green" }); };
  if (model === "modem") {
    const M = sim.modemLights();
    L("POWER", "POWER", M.POWER); L("DS", "DS", M.DS); L("US", "US", M.US); L("ONLINE", "ONLINE", M.ONLINE, "blue"); L("LINK/ACT", "LINK/ACT", M.LINK);
  } else if (model === "router") {
    const wifi = !!x.wifi && on, lanUp = ports.some(function (p) { return /^LAN/.test(p.name) && p.link; });
    L("⏻", "Power", on ? "on" : "off"); L("◎", "Internet", on && (id === "router" ? sim.wanUp() : false) ? "on" : "off");
    L("2.4G", "2.4G", wifi ? "on" : "off"); L("5G", "5G", wifi ? "on" : "off"); L("LAN", "LAN", on && lanUp ? "on" : "off"); L("WPS", "WPS", "off");
    opts.wan = ports[0].plug !== "none"; opts.lans = ports.slice(1).map(function (p) { return p.plug !== "none"; });
  } else if (model === "switch" || model === "switch8") {
    L("POWER", "Power", on ? "on" : "off");
    if (x.print) { opts.title = x.print[0]; opts.under = x.print.slice(1); }
    opts.plugged = ports.map(function (p) { return p.plug !== "none"; });
  } else if (model === "msw") {
    L("SYSTEM", "SYSTEM", on ? "on" : "off"); L("POWER", "POWER", on ? "on" : "off"); L("PSU", "Power supply", on ? "on" : "off"); L("FAN", "Fan", on ? "on" : "off");
    opts.plugged = ports.slice(0, 24).map(function (p) { return p.plug !== "none"; }); opts.console = ports[24].plug !== "none";
    /* the SFP slots (SO-10): a module drawn wherever the switch has one, its bail latch the module's colour, with its cord when a
       fibre is in it (SO-J10: a module just put in has none) */
    const mods = x.sfp || {}, slot = function (k) { return mods["SFP" + (k + 1)] ? SFP_MODULES[mods["SFP" + (k + 1)]] : null; }, corded = function (k) { return ports[25 + k].plug !== "none"; };
    opts.sfp = [0, 1, 2, 3].map(function (k) { const c = sim.cableAt(id, "SFP" + (k + 1)); return slot(k) && corded(k) ? (c && c.fiber === "SMF" ? 0xf2c200 : 0xe8893a) : null; });   /* orange multimode, yellow single-mode */
    opts.sfpBare = [0, 1, 2, 3].map(function (k) { return !!slot(k) && !corded(k); });
    opts.sfpBail = [0, 1, 2, 3].map(function (k) { const m = slot(k); return m ? (m.bail === "blue" ? 0x2f6fd0 : 0x1d1e21) : null; });
    opts.sfpText = [0, 1, 2, 3].map(function (k) { const c = sim.cableAt(id, "SFP" + (k + 1)); return c && c.jacket ? c.jacket + "  ·  LC-LC DUPLEX" : null; });
  } else if (model === "brouter") {
    /* the business router: its status lights, each copper port's plug and lights, the SFP slots' modules and their LNK/ACT lights, the console cable */
    const act = on && ports.some(function (p) { return p.link; });
    L("PWR", "PWR", on ? "on" : "off"); L("SYS", "SYS", on ? "on" : "off"); L("ACT", "ACT", act ? "on" : "off"); L("ALM", "ALM", "off", "amber"); L("PSU", "Power supply", on ? "on" : "off"); L("FAN", "Fan", on ? "on" : "off");
    [8, 9].forEach(function (n) { const p = ports[n]; L("GE 0/" + n + " LNK", "GE 0/" + n + " LNK", p.link ? "on" : "off"); L("GE 0/" + n + " ACT", "GE 0/" + n + " ACT", p.link ? "on" : "off"); });   /* the slots' lights are on the panel beside them, not on the cage */
    opts.plugged = ports.slice(0, 8).map(function (p) { return p.plug !== "none"; }); opts.lights = ports.slice(0, 8).map(function (p) { return p.lights === "green"; });
    opts.console = ports[10].plug !== "none";
    const mods = x.sfp || {};
    opts.sfp = [8, 9].map(function (n) { const c = sim.cableAt(id, "Gi0/" + n); return mods["Gi0/" + n] && c ? (c.fiber === "SMF" ? 0xf2c200 : 0xe8893a) : null; });
  } else if (model === "rack") {
    /* the patch panel's cords down to the managed switch under it, the tabs as written, the switch's port lights */
    opts.patches = []; opts.tabs = {};
    sim.cablesOf(id).forEach(function (c) { const e = c.a.dev === id ? c.a : c.b, o = e === c.a ? c.b : c.a; if (!/R$/.test(e.port) && o.dev === "msw") opts.patches.push([+e.port, +o.port]); });
    opts.patches.sort(function (a, b) { return a[0] - b[0]; });
    Object.keys(x.tabs || {}).forEach(function (n) { opts.tabs[n] = TAB[x.tabs[n]] || ""; });
    opts.swLights = Array.from({ length: 24 }, function (_, i) { const c = sim.cableAt("msw", String(i + 1)); return !!c && sim.cableUp(c); });
  } else if (model === "wallplate") {
    opts.plugged = false;
  } else if (model === "mesh") {
    const ok = on && sim.meshLink().ok;
    L("STATUS", "Status ring", on ? "on" : "off", ok ? "green" : "amber"); L("LINK", "Side light", on && !ok ? "on" : "off", "amber");
    opts.weak = !ok;
  } else if (model === "printer") {
    const P = page(sim, "printer", "panel"), a = sim.addr("printer");
    L("attention", "Attention light", a ? "off" : "on", "amber");
    opts.screen = { status: a ? "ONLINE (" + a.ip + ")" : "NO NETWORK CONNECTION", ip: P.values.ip || "--" };
  } else if (model === "tv") {
    const P = page(sim, "tv", "net");
    opts.screen = { connected: !!sim.addr("tv"), rows: P.rows.slice(1, 4).concat([["MAC address", "██:██:██:██:██:██"]]) };
  } else if (model === "laptop") {
    opts.screen = [prompt(sim, id) + "_"];   /* Command Prompt open and waiting: what it says is for the student to find out */
  } else if (model === "techlaptop") {
    /* your laptop: the USB serial adapter in its USB-C while the console cable is in; on screen, the TFTP server while it
       runs (its address and what it has been sent), otherwise the serial terminal at the switch's prompt, or Command Prompt */
    opts.console = ports[1].plug !== "none";
    const s = x.tftp, a = sim.addr(id);
    if (s.on) { opts.title = "TFTP server  \u00b7  " + s.root; opts.screen = [a && a.kind !== "apipa" ? "Listening on " + a.ip + ", UDP port 69" : "Listening: no network on Ethernet", ""].concat(s.files.length ? s.files.map(function (f) { return f.name + "   " + f.bytes + " bytes, from " + f.from; }) : ["No files received yet."]); }
    else if (ports[1].plug !== "none") { opts.title = "Serial terminal  \u00b7  COM3  \u00b7  9600 baud, 8-N-1"; opts.screen = ["", prompt(sim, id) + "_"]; }
    else { opts.title = "Command Prompt"; opts.screen = [prompt(sim, id, true) + "_"]; }
    ports[1].lights = null;
  } else if (model === "camera") {
    opts.ipLine = "IP: set by DHCP"; if (x.draw > POE.af.pd) opts.poe = "PoE+ 802.3at";
  } else if (model === "injector") {
    L("POWER", "POWER", x.power ? "on" : "off", "blue"); L("PoE", "STATUS", feeds("PoE OUT") ? "on" : "off");   /* blue while its adapter is in; STATUS green while it powers the device on its output */
    opts.std = x.std;
  } else if (model === "injectorDual") {
    L("POWER", "Active PoE+", x.power ? "on" : "off");   /* ready to power: its adapter is in. Each output's own lights say which one is powering a device */
    opts.std = x.std;
  }

  /* the same facts in words, for the list under the model */
  const lit = function (l) { return l.name + " " + (l.state === "on" ? (l.color === "amber" ? "on, amber" : l.color === "blue" ? "on, blue" : "on") : l.state === "blinking" ? "blinking" : "off"); };
  if (leds.length) says.push((model === "modem" ? "Front lights: " : model === "router" ? "Top lights: " : "Lights: ") + leds.filter(function (l) { return !(model === "mesh" && l.role === "LINK" && l.state === "off"); }).map(lit).join(", ") + ".");
  if (model === "rack") {
    says.push("The managed switch is mounted under the patch panel; short blue cords join the panel's front to it.");
    opts.patches.forEach(function (pc) { const port = ports[pc[0] - 1]; says.push("Patch panel port " + pc[0] + ": a cord " + (port.plug === "in" ? "clicked in" : "out of the port, hanging loose") + ", down to the switch's port " + pc[1] + ". The switch's light for port " + pc[1] + ": " + (opts.swLights[pc[1] - 1] ? "on" : "off") + "."); });
    const tabs = Object.keys(opts.tabs).filter(function (n) { return opts.tabs[n]; }).sort(function (a, b) { return a - b; });
    if (tabs.length) says.push("Written on the panel's tabs: " + tabs.map(function (n) { return "port " + n + " " + opts.tabs[n]; }).join(", ") + ".");
    const back = sim.cablesOf(id).map(function (c) { const e = c.a.dev === id ? c.a : c.b; return /R$/.test(e.port) ? +e.port.slice(0, -1) : null; }).filter(function (n) { return n; }).sort(function (a, b) { return a - b; });
    says.push("At the back of the panel: runs punched down behind ports " + back.join(", ") + ". Nothing on them says where they go.");
    return { id: id, model: model, label: x.label, ports: ports, leds: leds, opts: opts, says: says };
  }
  if (model === "ceilingAP") {   /* the ceiling access point: its light ring says power, its uplink and its networks (in words too) */
    const c = sim.cableAt(id, "ETH"), up = on && !!c && sim.cableUp(c), n = (x.ssids || []).length, p0 = ports[0];
    const ring = !on ? ["off", null, "off: no power (it takes its power down its cable)"] : !up ? ["on", "amber", "on, amber: it has power, but no link on its uplink"] : !n ? ["blinking", "blue", "blinking blue: on the network, but broadcasting nothing (no networks set up on it yet)"] : ["on", "blue", "on, blue: on the network, broadcasting " + n + (n === 1 ? " network" : " networks")];
    L("ring", "Light ring", ring[0], ring[1]);
    opts.cable = p0.plug !== "none";
    says.push("The light ring round its face: " + ring[2] + ".");
    says.push("ETH (PoE IN), in the bay on its top: " + (p0.plug === "none" ? "empty." : p0.plug === "out" ? "unplugged: the plug is out, hanging loose." : "plugged in: " + cableName(sim, c, id).replace(/^Patch cable/, "the cable") + "."));
    says.push("Its label, on top: CEILING ACCESS POINT, 802.11ac Wave 2, 802.3af PoE. Its settings are on its own web page, at the address it's given.");
    return { id: id, model: model, label: x.label, ports: ports, leds: leds, opts: opts, says: says };
  }
  if (model === "domeCeiling" || model === "domeWall") {   /* a dome camera: its status light says power, then the network (in words too) */
    const c = sim.cableAt(id, "LAN"), up = on && !!c && sim.cableUp(c), a = on ? sim.addr(id) : null, net = up && !!a && a.kind !== "apipa", p0 = ports[0], ceil = model === "domeCeiling";
    const st = !on ? ["off", "off: no power (it takes its power down its network cable)"] : !net ? ["blinking", "blinking blue: it has power, but isn't on the network yet" + (up ? " (no address)" : " (no link on its cable)")] : ["on", "on, blue: on the network"];
    L("status", "Status light", st[0], "blue");
    opts.cable = p0.plug !== "none"; opts.status = st[0] === "blinking" ? "blink" : st[0];
    p0.lights = null;
    says.push("The status light on the housing, beside the bubble: " + st[1] + ".");
    says.push("Its pigtail's network coupler, " + (ceil ? "above the tile" : "under the junction box") + ": " + (p0.plug === "none" ? "empty: nothing plugged in." : p0.plug === "out" ? "unplugged: the plug is out, hanging loose." : "plugged in: " + cableName(sim, c, id).replace(/^Patch cable/, "the cable") + ", its waterproof sleeve screwed on.") + " The pigtail's DC lead is capped, never used: the power comes down the network cable.");
    says.push("Its label: IP DOME CAMERA, 4 MP, IR 30 m, IEEE 802.3af PoE, IP66. The MAC and serial number are covered. Its settings are on its own web page, at its address.");
    return { id: id, model: model, label: x.label, ports: ports, leds: leds, opts: opts, says: says };
  }
  if (model === "wallplate") { says.push("A data/voice wall plate: nothing plugged into its ETHERNET or TELEPHONE jack. Its run goes back through the wall to the closet."); return { id: id, model: model, label: x.label, ports: ports, leds: leds, opts: opts, says: says }; }
  ports.forEach(function (p) {
    if (model === "laptop" || model === "mesh" || model === "msw" || model === "brouter" || model === "techlaptop") { if (p.plug === "none") return; }
    if (model === "techlaptop" && p.name === "USB-C") { const c = sim.cableAt(id, "USB-C"), o = c && (c.a.dev === id ? c.b.dev : c.a.dev); says.push("USB-C: the USB serial adapter is plugged in, its console cable running to the " + (o ? sim.d[o].label.replace(/^([A-Z])(?=[a-z]+(\s|$))/, function (m) { return m.toLowerCase(); }) : "switch") + "'s CONSOLE port."); return; }
    let s = p.label + ": ";
    if (p.coax) s += p.plug === "in" ? "the coax connector is screwed on snugly." : "the coax connector is loose, backed off its thread.";
    else if (p.dc) s += p.plug === "in" ? "plugged in." : "unplugged: its plug is out, hanging loose.";
    else if (p.console) s += p.plug === "in" ? "the console cable is plugged in (to your laptop's USB serial adapter)." : "the console cable is out of the port, hanging loose.";
    else if (INJ[model]) s += (p.plug === "none" ? "empty." : p.plug === "out" ? "unplugged: the plug is out of the port, hanging loose." : "cable plugged in.") + (p.lights ? " Its lights " + (p.lights === "off" ? "off." : "on, green: it's powering the device on it.") : "");
    else if (p.plug === "none") s += "empty.";
    else if (p.plug === "out") s += "unplugged: the plug is out of the port, hanging loose. Lights off.";
    else s += "cable plugged in. Lights " + (p.lights === "off" ? "off" : p.lights === "amber" ? "on, amber (10/100 Mb/s)" : model === "switch" ? "on, green (1 Gb/s)" : "on") + ".";
    if (p.damage === "crushed") s += " Along the run behind the desk, a stretch of the cable is flattened.";
    if (p.damage === "split") s += " A hand's width from the plug the jacket is kinked and split open; blue and brown wires show through.";
    says.push(s);
  });
  if (model === "laptop" && ports[0].plug === "none") says.push("ETHERNET: empty (this laptop is on Wi-Fi). On screen: Command Prompt, waiting for a command.");
  if (model === "techlaptop") { if (ports[0].plug === "none") says.push("ETHERNET: empty."); if (ports[1].plug === "none") says.push("USB-C: empty (the console cable isn't plugged in)."); says.push("On screen: " + opts.title.replace(/\s+\u00b7\s+/g, ", ") + (x.tftp.on ? ". " + opts.screen.filter(Boolean).join(". ") + "." : ".")); }
  if (model === "mesh") says.push("No network cables: it reaches the router over Wi-Fi.");
  if (model === "msw") Object.keys(x.sfp || {}).forEach(function (k) { const m = x.sfp[k] && SFP_MODULES[x.sfp[k]]; if (m) says.push(k + ": a module, its label " + m.label + ", its bail latch " + m.bail + "."); });
  if (model === "brouter") { [8, 9].forEach(function (n) { const m = x.sfp && x.sfp["Gi0/" + n] && SFP_MODULES[x.sfp["Gi0/" + n]]; if (m) says.push("GE 0/" + n + ": a module, its label " + m.label + ", its bail latch " + m.bail + "."); }); if (!ports.some(function (p) { return p.plug !== "none"; })) says.push("Nothing plugged into it yet."); says.push("Printed on the front: BUSINESS ROUTER, MODEL: BR-4200; WAN 0/8 and WAN 0/9 over the SFP slots. Its settings are on its command line, not on lights or buttons."); }
  if (model === "msw") { if (!ports.some(function (p) { return p.plug !== "none"; })) says.push("Nothing plugged into it yet."); says.push("Printed on the front: MANAGED SWITCH 24-PORT + 4 SFP, MODEL: MSW-2800G. Its settings are on its command line, not on lights or buttons."); }
  if (x.labelText) says.push("Its label: " + x.labelText + ".");
  if (model === "printer") says.push("Control panel screen: " + opts.screen.status + ", IP address " + opts.screen.ip + ".");
  if (model === "tv") says.push("Screen: Network Status, wired (LAN) " + (opts.screen.connected ? "connected" : "not connected") + "; " + opts.screen.rows.slice(0, 3).map(function (r) { return r[0] + " " + r[1]; }).join("; ") + ".");
  if (model === "camera") { says.push("Printed beside its port: " + (x.draw > POE.af.pd ? "PoE+ 802.3at, up to " + x.draw + " W (heater on)" : "PoE 802.3af") + " (it takes its power down the cable). Its label gives the model and says the address is set by DHCP; the hardware address is covered."); if (!on) says.push("No power: the camera is dark."); else if (sim.poeShort(id)) says.push("Its status light blinks amber: running on limited power."); }
  if (model === "injector") says.push("Its label: " + (x.std === "passive" ? "SINGLE-PORT PASSIVE PoE INJECTOR, OUTPUT 24V ⎓ 1A" : x.std === "at" ? "SINGLE-PORT GIGABIT PoE+ INJECTOR, IEEE 802.3at, OUTPUT 54V ⎓ 0.56A (30W)" : "SINGLE-PORT GIGABIT PoE INJECTOR, IEEE 802.3af, OUTPUT 48V ⎓ 0.32A (15.4W)") + ".");
  if (model === "injectorDual") says.push("Its label: DUAL-PORT GIGABIT PoE+ INJECTOR, IEEE 802.3at. Total PoE power budget DC 54V ⎓ 1.1A (60W); port max DC 54V ⎓ 0.56A (30W). Each DATA IN carries on only to the DATA + POWER OUT with the same number.");
  return { id: id, model: model, label: x.label, ports: ports, leds: leds, opts: opts, says: says };
}

/* a short key for what the model looks like, so the viewer only rebuilds when something visible changed */
export function stateKey(S) { return S ? JSON.stringify([S.model, S.ports, S.leds, S.opts]) : ""; }
