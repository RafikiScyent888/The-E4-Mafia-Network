/* What a device's 3D model shows, worked out from the simulation: which
   plugs are in, out or loose, which lights are lit (and in what colour),
   any damage on a cable, and what is on its screen. Plain data: the
   viewer draws it, the same facts are written out in words under the
   model (so nothing depends on seeing colour), and the tests read it to
   prove each fault really shows on the model. */
import { page } from "./pages.js";
import { prompt } from "./cmd.js";
import { POE } from "./sim.js";

/* the model each device is drawn with (the old router in HOME-10 is a home router too) */
export const MODEL_OF = { modem: "modem", router: "router", rogue: "router", switch: "switch", pc: "pc", laptop: "laptop", printer: "printer", camera: "camera", tv: "tv", mesh: "mesh", injector: "injector", meet: "switch", mpc: "pc" };   /* the office's meeting room (SO-04): an old 5-port switch in the same housing, and a desktop */

/* each model's network ports: the name printed on the model, and the sim's port at that device */
const PORTS = {
  modem: [["CABLE IN", "CABLE IN"], ["ETHERNET", "ETH"]],
  router: [["INTERNET", "WAN"], ["LAN 1", "LAN 1"], ["LAN 2", "LAN 2"], ["LAN 3", "LAN 3"], ["LAN 4", "LAN 4"]],
  switch: [["1", "1"], ["2", "2"], ["3", "3"], ["4", "4"], ["5", "5"]],
  pc: [["LAN", "NIC"]], printer: [["NETWORK", "NET"]], camera: [["PoE", "LAN"]], tv: [["LAN", "LAN"]],
  laptop: [["ETHERNET", "ETH"]], techlaptop: [["ETHERNET", "ETH"], ["USB-C", "USB-C"]], mesh: [["WAN", "WAN"], ["LAN", "LAN"]], injector: [["DATA IN", "DATA IN"], ["DATA + POWER OUT", "PoE OUT"]],
  switch8: [1, 2, 3, 4, 5, 6, 7, 8].map(function (n) { return [String(n), String(n)]; }),
  /* the managed switch: its 24 ports by the numbers printed over and under them, and CONSOLE */
  msw: Array.from({ length: 24 }, function (_, i) { return [String(i + 1), String(i + 1)]; }).concat([["CONSOLE", "CONSOLE"]]),
  /* build mode's PoE+ injector, as photographed: two pairs, "DATA IN" over each input and the pair's number under it */
  injectorDual: [["DATA IN 1", "DATA IN"], ["DATA IN 2", "DATA IN 2"], ["DATA + POWER OUT 1", "PoE OUT"], ["DATA + POWER OUT 2", "PoE OUT 2"]]
};
const INJ = { injector: true, injectorDual: true };
const SAY_PORT = { switch: function (p) { return "Port " + p; }, switch8: function (p) { return "Port " + p; }, msw: function (p) { return /^\d+$/.test(p) ? "Port " + p : p; } };

export function physicalState(sim, id) {
  const x = sim.d[id]; if (!x) return null;
  const model = x.kind === "injector" ? (x.dual ? "injectorDual" : "injector") : x.kind === "mswitch" ? "msw" : x.kind === "techlaptop" ? "techlaptop" : x.kind === "switch" && x.ports === 8 ? "switch8" : MODEL_OF[id]; if (!model) return null;   /* build mode's PoE+ injector is the dual-port one; the office has the managed switch and an old 8-port */
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
      : p.coax || INJ[model] || p.console || pp[1] === "CONSOLE" ? null : p.link ? ((model === "switch" || model === "switch8") && p.speed !== 1000 ? "amber" : "green") : "off";
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
  ports.forEach(function (p) {
    if (model === "laptop" || model === "mesh" || model === "msw" || model === "techlaptop") { if (p.plug === "none") return; }
    if (model === "techlaptop" && p.name === "USB-C") { says.push("USB-C: the USB serial adapter is plugged in, its console cable running to the switch's CONSOLE port."); return; }
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
