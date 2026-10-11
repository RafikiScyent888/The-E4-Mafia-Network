/* What a device's 3D model shows, worked out from the simulation: which
   plugs are in, out or loose, which lights are lit (and in what colour),
   any damage on a cable, and what is on its screen. Plain data: the
   viewer draws it, the same facts are written out in words under the
   model (so nothing depends on seeing colour), and the tests read it to
   prove each fault really shows on the model. */
import { page } from "./pages.js";
import { prompt } from "./cmd.js";

/* the model each device is drawn with (the old router in HOME-10 is a home router too) */
export const MODEL_OF = { modem: "modem", router: "router", rogue: "router", switch: "switch", pc: "pc", laptop: "laptop", printer: "printer", camera: "camera", tv: "tv", mesh: "mesh" };

/* each model's network ports: the name printed on the model, and the sim's port at that device */
const PORTS = {
  modem: [["CABLE IN", "CABLE IN"], ["ETHERNET", "ETH"]],
  router: [["INTERNET", "WAN"], ["LAN 1", "LAN 1"], ["LAN 2", "LAN 2"], ["LAN 3", "LAN 3"], ["LAN 4", "LAN 4"]],
  switch: [["1", "1"], ["2", "2"], ["3", "3"], ["4", "4"], ["5", "5"]],
  pc: [["LAN", "NIC"]], printer: [["NETWORK", "NET"]], camera: [["PoE", "LAN"]], tv: [["LAN", "LAN"]],
  laptop: [["ETHERNET", "ETH"]], mesh: [["WAN", "WAN"], ["LAN", "LAN"]]
};
const SAY_PORT = { switch: function (p) { return "Port " + p; } };

export function physicalState(sim, id) {
  const model = MODEL_OF[id]; if (!model) return null;
  const x = sim.d[id], ports = [], leds = [], says = [], opts = {};
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
    p.lights = p.coax ? null : p.link ? (model === "switch" && p.speed !== 1000 ? "amber" : "green") : "off";
    ports.push(p);
  });
  const L = function (role, name, state, color) { leds.push({ role: role, name: name, state: state, color: color || "green" }); };
  if (model === "modem") {
    const M = sim.modemLights();
    L("POWER", "POWER", M.POWER); L("DS", "DS", M.DS); L("US", "US", M.US); L("ONLINE", "ONLINE", M.ONLINE, "blue"); L("LINK/ACT", "LINK/ACT", M.LINK);
  } else if (model === "router") {
    const wifi = !!x.wifi && on, lanUp = ports.some(function (p) { return /^LAN/.test(p.name) && p.link; });
    L("⏻", "Power", on ? "on" : "off"); L("◎", "Internet", on && (id === "router" ? sim.wanUp() : false) ? "on" : "off");
    L("2.4G", "2.4G", wifi ? "on" : "off"); L("5G", "5G", wifi ? "on" : "off"); L("LAN", "LAN", on && lanUp ? "on" : "off"); L("WPS", "WPS", "off");
    opts.wan = ports[0].plug !== "none"; opts.lans = ports.slice(1).map(function (p) { return p.plug !== "none"; });
  } else if (model === "switch") {
    L("POWER", "Power", on ? "on" : "off");
    opts.plugged = ports.map(function (p) { return p.plug !== "none"; });
  } else if (model === "mesh") {
    const ok = on && x.backhaul && x.backhaul.ok && sim.on("router");
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
  } else if (model === "camera") {
    opts.ipLine = "IP: set by DHCP";
  }

  /* the same facts in words, for the list under the model */
  const lit = function (l) { return l.name + " " + (l.state === "on" ? (l.color === "amber" ? "on, amber" : l.color === "blue" ? "on, blue" : "on") : l.state === "blinking" ? "blinking" : "off"); };
  if (leds.length) says.push((model === "modem" ? "Front lights: " : model === "router" ? "Top lights: " : "Lights: ") + leds.filter(function (l) { return !(model === "mesh" && l.role === "LINK" && l.state === "off"); }).map(lit).join(", ") + ".");
  ports.forEach(function (p) {
    if (model === "laptop" || model === "mesh") { if (p.plug === "none") return; }
    let s = p.label + ": ";
    if (p.coax) s += p.plug === "in" ? "the coax connector is screwed on snugly." : "the coax connector is loose, backed off its thread.";
    else if (p.plug === "none") s += "empty.";
    else if (p.plug === "out") s += "unplugged: the plug is out of the port, hanging loose. Lights off.";
    else s += "cable plugged in. Lights " + (p.lights === "off" ? "off" : p.lights === "amber" ? "on, amber (10/100 Mb/s)" : model === "switch" ? "on, green (1 Gb/s)" : "on") + ".";
    if (p.damage === "crushed") s += " Along the run behind the desk, a stretch of the cable is flattened.";
    if (p.damage === "split") s += " A hand's width from the plug the jacket is kinked and split open; blue and brown wires show through.";
    says.push(s);
  });
  if (model === "laptop" && ports[0].plug === "none") says.push("ETHERNET: empty (this laptop is on Wi-Fi). On screen: Command Prompt, waiting for a command.");
  if (model === "mesh") says.push("No network cables: it reaches the router over Wi-Fi.");
  if (model === "printer") says.push("Control panel screen: " + opts.screen.status + ", IP address " + opts.screen.ip + ".");
  if (model === "tv") says.push("Screen: Network Status, wired (LAN) " + (opts.screen.connected ? "connected" : "not connected") + "; " + opts.screen.rows.slice(0, 3).map(function (r) { return r[0] + " " + r[1]; }).join("; ") + ".");
  if (model === "camera") says.push("Its label gives the model and says the address is set by DHCP; the hardware address is covered.");
  return { id: id, model: model, label: x.label, ports: ports, leds: leds, opts: opts, says: says };
}

/* a short key for what the model looks like, so the viewer only rebuilds when something visible changed */
export function stateKey(S) { return S ? JSON.stringify([S.model, S.ports, S.leds, S.opts]) : ""; }
