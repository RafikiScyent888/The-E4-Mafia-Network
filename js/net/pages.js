/* What each device shows when you open it: its tabs, and what is on each
   tab, worked out from the simulation. Plain data, so the page code draws
   it and the tests read exactly what a student would see. Each page also
   returns "facts" the notebook can record. */
import { isIp } from "./util.js";
import { portName as printedPort, SFP_MODULES } from "./sim.js";

const STILL = { pc: "pc", laptop: "laptop", router: "router", switch: "switch", modem: "modem", printer: "printer", camera: "camera", tv: "tv", mesh: "mesh", meet: "switch", mpc: "pc", mgr: "pc", hire: "pc", bpc: "pc" };   /* the business's back PC (the treatment room's, the kitchen's) too; the office's back office (SO-04) and the manager's PC (SO-08): the same housings */

export function tabsFor(sim, id) {
  const k = sim.d[id].kind, P = STILL[id] || id === "rogue" || k === "injector" || k === "mswitch" || k === "brouter" || k === "techlaptop" || k === "patchpanel" || k === "jack" || k === "bap" ? [["physical", "Physical"]] : [];   /* the old router in HOME-10 is in the house; a hotspot outside it isn't */
  const T = {
    pc: [["cmd", "Command Prompt"], ["settings", "Network settings"], ["printers", "Printers"], ["browser", "Web browser"]],   /* a business PC's browser: how the ceiling access point's page is reached */
    laptop: [["cmd", "Command Prompt"], ["wifi", "Wi-Fi"]],
    router: [["status", "Status"], ["dhcp", "LAN & DHCP"], ["clients", "DHCP clients"], ["wifi", "Wi-Fi"], ["forward", "Port forwarding"]],
    rogue: [["admin", "Admin page"]],
    modem: [["lights", "Lights"], ["status", "Status page"]],
    switch: [["lights", "Lights"]],
    mswitch: [["lights", "Lights"]],
    brouter: [["lights", "Lights"]],
    techlaptop: [["cmd", "Serial terminal"], ["wcmd", "Command Prompt"], ["tftp", "TFTP server"]],   /* its serial terminal on the console cable, Windows' own prompt, and the TFTP server (SO-J5) */
    printer: [["panel", "Control panel"]],
    camera: [["web", "Web page"]],
    tv: [["net", "Network status"]],
    mesh: [["status", "Status"]],
    phone: [["wifi", "Wi-Fi"]],
    isp: [["about", "About"]]
  }[k] || [];
  return T.filter(function (t) { return (t[0] !== "printers" || !!sim.d[id].printer) && (t[0] !== "browser" || sim.net.site === "business"); }).concat(P).map(function (t) { return { key: t[0], title: t[1] }; });
}

/* a business PC's web browser: the address typed, and what comes back. The request goes through the network as a real one does
   (TCP to port 443, or 80 for http://), so a VLAN with no way through, or an access list, stops it for the real reason. Only the
   ceiling access point has a page to open: the router and the switches are managed from their command line (their web servers
   are off), and a Windows PC's firewall drops the connection. Its address is the student's to find: nothing here names it */
export function browse(sim, id, url) {
  const raw = String(url || "").trim(), facts = { page: id + "-browser", url: raw };
  if (!raw) return { kind: "browser", url: "", status: "blank", facts: facts };
  const m = /^(?:(https?):\/\/)?([^/:\s]+)(?::(\d{1,5}))?(\/\S*)?$/i.exec(raw), host = m ? m[2] : raw;
  const scheme = m && m[1] ? m[1].toLowerCase() : "https", port = m && m[3] ? +m[3] : scheme === "http" ? 80 : 443;
  const fail = function (status, head, text, code) { return { kind: "browser", url: raw, status: status, head: head, text: text, code: code, facts: Object.assign(facts, { host: host, ok: false, why: status }) }; };
  if (!m || !isIp(host)) return fail("name", "This site can't be reached", host + "'s server IP address could not be found.", "DNS_PROBE_FINISHED_NXDOMAIN");
  const rt = sim.route(id, host, { proto: "tcp", port: port, sport: 50123 });
  if (rt.fail === "no-link") return fail("offline", "No internet", "This computer isn't connected to a network.", "ERR_INTERNET_DISCONNECTED");
  if (rt.fail === "no-route") return fail("unreachable", "This site can't be reached", host + " is unreachable from this computer.", "ERR_ADDRESS_UNREACHABLE");
  if (rt.fail || !rt.owner) return rt.internet ? fail("refused", "This site can't be reached", host + " refused to connect.", "ERR_CONNECTION_REFUSED") : fail("timeout", "This site can't be reached", host + " took too long to respond.", "ERR_CONNECTION_TIMED_OUT");
  const who = rt.owner[0], x = sim.d[who];   /* two devices on one address: the first to answer (the page never changes the network to pick) */
  if (x.kind === "pc" || x.kind === "laptop" || x.kind === "techlaptop") return fail("timeout", "This site can't be reached", host + " took too long to respond.", "ERR_CONNECTION_TIMED_OUT");
  if (x.kind !== "bap" || (port !== 443 && port !== 80)) return fail("refused", "This site can't be reached", host + " refused to connect.", "ERR_CONNECTION_REFUSED");
  const clients = Object.keys(sim.d).filter(function (k) { const l = sim.wifiLink(k); return l && l.connected && l.ap.id === who; }).length;
  const name = x.host || "AP-" + x.mac.replace(/[^0-9a-f]/gi, "").slice(-6).toUpperCase();
  return { kind: "browser", url: raw, status: "ap", dev: who, shown: "https://" + host + "/", title: "Access point · " + name,
    rows: [["Device name", name], ["Model", "Ceiling access point"], ["IP address", host + " (from DHCP, untagged on its uplink)"], ["Uplink", "eth0 · 1 Gb/s · powered over its cable (PoE)"], ["Wi-Fi clients now", String(clients)]],
    networks: (x.ssids || []).map(function (w) { return { ssid: w.ssid, sec: w.sec, vlan: w.vlan || null }; }),
    facts: Object.assign(facts, { host: host, ok: true, ap: who, networks: (x.ssids || []).map(function (w) { return w.ssid; }) }) };
}

/* the portable cable tester's reading for a cable (main at one end, remote at the other) */
export function tester(c) {
  if (c.kind === "coax") return { text: "This tester is for twisted-pair cable; coax isn't tested this way. Look at the connector instead.", pins: null };
  const open = c.cond === "crushed" ? [1, 2, 3, 6] : c.cond === "damaged" ? [4, 5, 7, 8] : [];
  const pass = [1, 2, 3, 4, 5, 6, 7, 8].filter(function (p) { return open.indexOf(p) < 0; });
  const text = open.length ? "Pins " + open.join(", ") + ": OPEN (the remote's lights for those pins stay dark).\nPins " + pass.join(", ") + " and G (shield): pass, in order." : c.wiring === "crossover" ? "Pins 1 2 3 4 5 6 7 8 and G (shield): all pass. Wired crossover (T568A at one end, T568B at the other): pairs 1-2 and 3-6 swapped." : "Pins 1 2 3 4 5 6 7 8 and G (shield): all pass, in order. Wired straight-through (T568B at both ends).";
  return { text: text, open: open };
}

function endName(sim, c, end) { const e = c[end]; const d = sim.d[e.dev]; return d.label + (e.port && e.dev !== "wall" ? " (" + (d.kind === "injector" ? printedPort(d, e.port) : portName(e)) + ")" : ""); }   /* an injector's ports by the names printed on it */
const lowerFirst = function (s) { return s.replace(/^([A-Z])(?=[a-z]+(\s|$))/, function (m) { return m.toLowerCase(); }); };
function portName(e) { return /^\d$/.test(e.port) ? "port " + e.port : e.port; }
export function cableName(sim, c, fromDev) {
  const other = c.a.dev === fromDev ? c.b : c.a, me = other === c.a ? c.b : c.a;
  /* the patch panel: at the back, a run you can't tell from the others without tracing it; at the front, a cord you can follow by eye */
  if (sim.d[fromDev].kind === "patchpanel") return /R$/.test(me.port) ? "Run punched down at the back of port " + me.port.slice(0, -1) : "Patch cord in port " + me.port + ", down to the " + lowerFirst(sim.d[other.dev].label) + (/^\d+$/.test(other.port) ? " (port " + other.port + ")" : "");
  if (sim.d[fromDev].kind === "jack") return "The run from this jack back to the closet";
  if (sim.d[other.dev].kind === "patchpanel") return /R$/.test(other.port) ? "Cable to the wall jack (its run goes back to the patch panel in the closet)" : "Patch cord to the patch panel (port " + other.port + ")";
  if (c.kind === "coax") return "Coax cable, wall outlet to the modem's CABLE IN";
  if (c.kind === "fibre") return "Fibre patch cord, " + me.port + " to the " + lowerFirst(sim.d[other.dev].label) + " (" + other.port + ")";
  if (c.kind === "console") return fromDev === "tech" ? "Console cable to the " + lowerFirst(sim.d[other.dev].label) + " (CONSOLE)" : "Console cable to your laptop (its USB serial adapter)";
  if (fromDev === "tech") return "Patch cable from your laptop's ETHERNET to the " + sim.d[other.dev].label.replace(/^([A-Z])(?=[a-z]+(\s|$))/, function (m) { return m.toLowerCase(); }) + (/^\d+$/.test(other.port) ? " (port " + other.port + ")" : other.port ? " (" + other.port + ")" : "");
  if (other.dev === "tech") return "Patch cable to your laptop (its ETHERNET port)";
  if (other.dev === "rogue") return "Patch cable to a box not on the diagram (" + other.port + ")";
  if (fromDev === "rogue") return "Patch cable to the 5-port switch (port " + other.port + ")";
  return "Patch cable to the " + sim.d[other.dev].label.replace(/^([A-Z])(?=[a-z]+(\s|$))/, function (m) { return m.toLowerCase(); }).replace(/^isp$/, "ISP") + (/^\d+$/.test(other.port) ? " (port " + other.port + ")" : other.port ? " (" + (sim.d[other.dev].kind === "injector" ? printedPort(sim.d[other.dev], other.port) : other.port) + ")" : "");   /* an injector's ports by the names printed on it */
}

/* what you see when you look at one end of a cable */
export function look(sim, cableId, end) {
  const c = sim.cable(cableId), e = c[end];
  if (c.kind === "coax") return e.tight ? "Screwed on snugly; it doesn't turn by hand." : "Loose: the F-connector spins freely by hand, and the centre wire is barely touching.";
  if (c.kind === "fibre") {   /* an SFP module with its LC duplex cord: what's printed on the module, its bail, the cord's jacket */
    const x = sim.d[e.dev], m = x.sfp && SFP_MODULES[x.sfp[e.port]];
    return (e.seated ? "The LC duplex plug is clicked into the module in " + e.port + "." : "The LC plug is out of the module.") + (m ? " The module's label: " + m.label + "; its bail latch is " + m.bail + "." : " The slot is empty.") +
      " The cord's jacket: " + (c.fiber === "SMF" ? "yellow" : "orange") + ", printed " + c.jacket + ". " + (sim.cableUp(c) ? "The slot's link light is on." : "The slot's link light is off.");
  }
  const ex = sim.d[e.dev];
  if (ex.kind === "patchpanel" && /R$/.test(e.port)) return "Punched down at the back of port " + e.port.slice(0, -1) + ": the eight wires sit firmly in their slots, in order. Nothing on it says which room it goes to.";
  if (ex.kind === "jack") return "Nothing is plugged into this jack. The run behind it goes back to the closet.";
  if (!e.seated) return "Not plugged in: the plug is lying loose behind the " + (e.dev === "pc" ? "desk" : e.dev === "switch" ? "shelf" : "furniture") + ".";
  let s = "Clicked in and latched.";
  if (c.cond === "crushed") s += " Along the run under the desk, the jacket is flattened where a chair wheel rolls over it.";
  if (c.cond === "damaged" && (!c.kink || c.kink === end)) s += " A hand's width from this plug the jacket is kinked and split; the blue and brown pairs show through.";   /* the damage is near one end only */
  const up = sim.cableUp(c);
  s += up ? " The link light by the jack is on." : " The link light by the jack is off.";
  return s;
}

export function page(sim, id, key, opts) {
  const x = sim.d[id], r = sim.d.router;
  if (key === "browser") return browse(sim, id, opts && opts.url);
  if (x.kind === "techlaptop" && key === "tftp") {   /* your laptop's TFTP server: what it listens on, and what it has been sent */
    const s = x.tftp, a = sim.addr(id);
    return { kind: "tftp", title: "TFTP server", on: s.on, root: s.root, addr: a && a.kind !== "apipa" ? a.ip : null, apipa: !!(a && a.kind === "apipa"), linked: sim.hasLink(id),
      files: s.files.map(function (f) { return { name: f.name, bytes: f.bytes, from: f.from, text: f.text }; }), log: s.log.slice(-8),
      facts: { page: "tech-tftp", on: s.on, addr: a && a.ip, files: s.files.map(function (f) { return f.name; }) } };
  }
  const yes = function (b) { return b ? "Yes" : "No"; };
  if (key === "physical") {
    const cables = sim.cablesOf(id).map(function (c) {
      const end = c.a.dev === id ? "a" : "b", me = c[end], far = c[end === "a" ? "b" : "a"], pp = x.kind === "patchpanel", toPanelBack = sim.d[far.dev].kind === "patchpanel" && /R$/.test(far.port);
      let acts = c.kind === "coax" ? ["look", "tighten"] : c.kind === "console" ? ["look", "reseat", "unplug"] : c.kind === "fibre" ? ["look", "polarity"] : ["look", "reseat", "unplug", "test", "replace"].concat(sim.net.site ? ["crossover"] : []);   /* the van for the office and the business carries crossover cables too */
      if (pp && /R$/.test(me.port)) acts = ["look", "test"];                     /* a run punched down at the back of the panel */
      else if (pp) acts = acts.concat(["repatch"]);                               /* a patch cord in the panel's front */
      else if (x.kind === "jack") acts = ["look", "test", "tone"];
      else if (toPanelBack) acts = acts.concat(["tone"]);                         /* a desk's cable whose run goes back to the panel */
      return { cable: c.id, end: end, name: cableName(sim, c, id), acts: acts, labels: pp && /R$/.test(me.port) ? { look: "Look at the punch-down" } : x.kind === "jack" ? { look: "Look at the jack" } : null };
    }).sort(function (p, q) { return x.kind === "patchpanel" ? (/^Patch/.test(p.name) ? 0 : 1) - (/^Patch/.test(q.name) ? 0 : 1) || parseInt(p.name.replace(/^\D+/, ""), 10) - parseInt(q.name.replace(/^\D+/, ""), 10) : 0; });
    if (id === "modem") { /* the coax's wall end is reached from the modem too: it's behind the TV stand */
      const cx = sim.cable("c-coax"); cables.forEach(function (k) { if (k.cable === "c-coax") k.name = "Coax cable at the modem's CABLE IN"; });
      cables.push({ cable: "c-coax", end: "a", name: "Coax cable at the wall outlet (behind the TV stand)", acts: ["look", "tighten"] });
    }
    const inj = x.kind === "injector" ? { power: !!x.power, std: x.std, swap: !sim.net.extra.build } : null;   /* in a build house the right injector comes out of the van, not a swap */
    const free = x.kind === "patchpanel" ? Array.from({ length: 24 }, function (_, i) { return String(i + 1); }).filter(function (p) { return !sim.cableAt(id, p); }) : null;   /* front ports a cord can move to */
    return { kind: "physical", still: STILL[id] ? "assets/stills/" + STILL[id] + ".jpg" : null, label: x.label, cables: cables, restart: x.kind !== "injector" && x.kind !== "patchpanel" && x.kind !== "jack", injector: inj, probe: x.kind === "patchpanel", freePorts: free,
      /* each SFP slot with a module, and the modules from the van; in build mode an empty slot too, and the van carries a 10 Gb/s SFP+ module as well (SO-J10) */
      sfp: x.kind === "mswitch" ? Object.keys(x.sfp || {}).filter(function (k) { return x.sfp[k] || sim.net.extra.build; }).map(function (k) { return { slot: k, type: x.sfp[k] || null, label: x.sfp[k] ? SFP_MODULES[x.sfp[k]].label : "empty, no module in it", swaps: (sim.net.extra.build ? ["1000BASE-SX", "1000BASE-LX", "10GBASE-SR"] : ["1000BASE-SX", "1000BASE-LX"]).filter(function (t) { return t !== x.sfp[k]; }) }; }) : null,
      facts: { page: id + "-physical", rogue: id === "rogue", injector: inj, camera: id === "camera" ? sim.on("camera") : undefined } };
  }
  if (id === "router") {
    if (key === "status") {
      const w = sim.wan(), lanUsed = r.leases.length;
      const rows = [
        ["Internet (WAN)", w ? "Connected" : sim.cableUp(sim.wanCable()) ? "Disconnected: waiting for the modem (no address from the provider)" : "Disconnected: no cable from the modem in the INTERNET (WAN) port"],
        ["WAN address", w ? w.ip : "0.0.0.0"], ["WAN gateway", w ? w.gw : "0.0.0.0"],
        ["LAN address", r.lan.ip + " / " + r.lan.mask],
        ["DHCP server", r.dhcp.on ? "On · " + r.dhcp.start + " to " + r.dhcp.end : "Off"],
        ["Wi-Fi 2.4 GHz", r.wifi.ssid + " · channel " + sim.ch24() + (r.wifi.ch24mode === "auto" ? " (Auto)" : "")],
        ["Wi-Fi 5 GHz", r.wifi.ssid + " · channel " + r.wifi.ch5],
        ["Clients with a lease", String(lanUsed)], ["Firmware", r.firmware]];
      if (r.guest) rows.push(["Guest network", r.guest.on ? r.guest.ssid + (r.guest.sec === "Open" ? " · open, no password" : " · secured") + (r.guest.isolate ? " · guests kept off the home network" : " · guests can reach the home network") : "Off"]);
      if (r.admin) rows.push(["Admin password", r.admin.gen > 1 ? "Changed from the factory one" : "The factory one, printed on the router's label"]);   /* build mode: a router fresh from its box */
      return { kind: "rows", title: "Status", rows: rows, admin: !!r.admin, facts: { page: "router-status", wan: !!w, dhcpOn: r.dhcp.on } };
    }
    if (key === "dhcp") return { kind: "form", form: "router-dhcp", title: "LAN & DHCP", values: { lanIp: r.lan.ip, mask: r.lan.mask, on: r.dhcp.on, start: r.dhcp.start, end: r.dhcp.end, leaseH: r.dhcp.leaseH, dnsMode: r.dhcp.dnsMode, dns1: r.dhcp.dns[0], dns2: r.dhcp.dns[1] },
      facts: { page: "router-dhcp", on: r.dhcp.on, start: r.dhcp.start, end: r.dhcp.end, dnsMode: r.dhcp.dnsMode, dns: r.dhcp.dns.filter(Boolean) } };
    if (key === "clients") {
      const resv = r.dhcp.reservations;
      const rows = r.leases.map(function (l) { return [l.name, l.mac, l.ip, resv.some(function (v) { return v.mac === l.mac; }) ? "Reserved" : "DHCP"]; })
        .concat(r.guest && r.guest.on ? r.guest.leases.map(function (l) { return [l.name, l.mac, l.ip, "Guest network"]; }) : []);   /* guests' leases are on their own subnet */
      const size = (function () { const a = r.dhcp.start.split(".").map(Number)[3], b = r.dhcp.end.split(".").map(Number)[3]; return b - a + 1; })();
      const inRange = r.leases.filter(function (l) { const n = +l.ip.split(".")[3]; return n >= +r.dhcp.start.split(".")[3] && n <= +r.dhcp.end.split(".")[3]; }).length;
      return { kind: "table", title: "DHCP clients", head: ["Device", "Hardware address", "IP address", "Type"], rows: rows, reserve: true, reservations: resv.map(function (v) { return [v.name, v.mac, v.ip]; }), leaseH: r.dhcp.leaseH,
        note: inRange + " of " + size + " addresses in the range are leased. Leases last " + r.dhcp.leaseH + " hours; a device keeps its address that long even after it leaves.", facts: { page: "router-clients", count: inRange, size: size, rows: rows, leaseH: r.dhcp.leaseH } };
    }
    if (key === "forward") return { kind: "form", form: "router-forward", title: "Port forwarding", add: !!r.factorySsid, rules: r.forwards.map(function (f) { return { name: f.name, ext: f.ext, ip: f.ip, port: f.port }; }), wan: sim.wan() ? sim.wan().ip : "0.0.0.0", facts: { page: "router-forward", rules: r.forwards.map(function (f) { return { ext: f.ext, ip: f.ip, port: f.port }; }) } };
    if (key === "wifi") return { kind: "form", form: "router-wifi", title: "Wi-Fi", values: { ssid: r.wifi.ssid, sec: r.wifi.sec, changed: (r.wifi.gen || 1) > 1, rename: !!r.factorySsid, factory: !!r.factorySsid && (r.wifi.gen || 1) === 1, client: !!sim.net.extra.oldWifi, guest: r.guest ? { on: r.guest.on, ssid: r.guest.ssid, isolate: r.guest.isolate, open: r.guest.sec === "Open", subnet: r.guest.lan.ip.replace(/\.\d+$/, ".x") } : null, bssids: sim.aps().filter(function (a) { return a.id === "router"; }).map(function (a) { return [a.band === 5 ? "5 GHz" : "2.4 GHz", a.mac.toUpperCase().replace(/-/g, ":")]; }), ch24: r.wifi.ch24mode === "auto" ? "auto" : String(r.wifi.ch24), ch24now: sim.ch24(), ch5: String(r.wifi.ch5) }, facts: { page: "router-wifi", ch24: sim.ch24(), mode: r.wifi.ch24mode, sec: r.wifi.sec } };
  }
  if (id === "modem") {
    const L = sim.modemLights(), syn = sim.modemSynced();
    if (key === "lights") {
      const say = { on: "on (steady)", off: "off", blinking: "blinking" };
      const mean = { POWER: "power", DS: "downstream: the signal from the provider", US: "upstream: talking back to the provider", ONLINE: "registered with the provider", LINK: "Ethernet to the router" };
      return { kind: "lights", title: "Lights", lights: Object.keys(L).map(function (k) { return { name: k, state: L[k], text: say[L[k]], mean: mean[k] }; }), facts: { page: "modem-lights", lights: L } };
    }
    if (key === "status") {
      const sig = sim.cableUp(sim.cable("c-coax")) && sim.net.isp.up;
      const rows = [["Address", "192.168.100.1 (the modem's own status page)"], ["Downstream", sig ? "Locked · 32 channels · power +2.1 dBmV · SNR 39 dB" : "Not locked: searching for a signal"],
        ["Upstream", syn ? "Ranged · 4 channels · power 44 dBmV" : "Not ranged"], ["Provisioning", syn ? "Online (registered)" : "Offline"], ["Ethernet", L.LINK === "on" ? "Connected, 1 Gb/s" : "No link"]];
      const log = syn ? ["Cable Modem Reboot due to power reset", "DHCP renew: WAN address handed to the router"] : sig ? ["No Ranging Response received - T3 time-out"] : ["SYNC Timing Synchronization failure - Failed to acquire QAM/QPSK symbol timing", "No Ranging Response received - T3 time-out"];
      return { kind: "rows", title: "Status page", rows: rows, log: log, facts: { page: "modem-status", synced: syn, signal: sig } };
    }
  }
  if ((x.kind === "switch" || x.kind === "mswitch") && key === "lights") {
    const rows = [], n = x.kind === "mswitch" ? 24 : x.ports || 5;
    for (let p = 1; p <= n; p++) {
      const c = sim.cableAt(id, String(p));
      if (x.kind === "mswitch" && !c) continue;   /* 24 ports: list the ones with a cable */
      const who = c ? (function () { const o = c.a.dev === id ? c.b : c.a; return sim.d[o.dev].undocumented ? "a box that isn't on the diagram" : "the " + sim.d[o.dev].label.replace(/^([A-Z])(?=[a-z]+(\s|$))/, function (m) { return m.toLowerCase(); }); })() : null;
      const sp = c ? sim.speed(c) : 0;
      const state = !c ? "off (nothing plugged in)" : sp === 0 ? "off" : x.kind === "mswitch" ? "on, green: link up" : sp === 1000 ? "on, green: 1 Gb/s link" : "on, amber: 10/100 Mb/s link";
      rows.push({ port: p, who: who, state: state, up: sp > 0, speed: sp });
    }
    if (x.kind === "mswitch") Object.keys(x.sfp || {}).forEach(function (k) {   /* its fibre slots with a cord in (SO-10): a link light each */
      const c = sim.cableAt(id, k); if (!c) return;
      const o = c.a.dev === id ? c.b : c.a, up = sim.cableUp(c);
      rows.push({ port: k, who: "the " + sim.d[o.dev].label.replace(/^([A-Z])(?=[a-z]+(\s|$))/, function (m) { return m.toLowerCase(); }) + " (fibre)", state: up ? "on, green: link up" : "off", up: up, speed: up ? 1000 : 0 });
    });
    if (x.kind === "mswitch") {
      const on = sim.on(id), con = sim.cablesOf(id).find(function (c) { return c.kind === "console"; });
      return { kind: "lights-ports", title: "Lights", ports: rows, lights: [{ name: "SYSTEM", state: on ? "on" : "off", text: on ? "on, green" : "off", mean: "the switch has started" }, { name: "POWER", state: on ? "on" : "off", text: on ? "on, green" : "off", mean: "power is on" }],
        note: "Managed: every port's settings, and the switch's own address, are on its command line. Reach it from your laptop's serial terminal on the console cable" + (con ? " (plugged into its CONSOLE port now)" : "") + ", or over the network once it has an address. Its port lights are green when a port has a link, whatever the speed: ask the switch (show interfaces status) for the speed and duplex.", facts: { page: id + "-lights", ports: rows } };
    }
    return { kind: "lights-ports", title: "Lights", ports: rows, note: "Unmanaged: no console and no settings. Read the lights: green is 1 Gb/s, amber is 10/100 Mb/s." + (x.labelText ? " Its label: " + x.labelText + "." : ""), facts: { page: id + "-lights", ports: rows } };
  }
  if (x.kind === "pc" && key === "settings") {   /* every PC's, not only the front desk's */
    const a = sim.addr(id), f = x.ifaces[0], c = sim.cableAt(id, f.port), sp = c ? sim.speed(c) : 0;
    const rows = [["Ethernet", a ? "Connected" : "Not connected (unplugged)"], ["IP assignment", f.cfg.mode === "dhcp" ? "Automatic (DHCP)" : "Manual"], ["DNS server assignment", f.cfg.dnsMode === "static" ? "Manual" : "Automatic (DHCP)"],
      ["Link speed (Receive/Transmit)", sp ? sp + "/" + sp + " (Mbps)" : "--"], ["IPv4 address", a ? a.ip : "--"], ["IPv4 DNS servers", a && a.dns.length ? a.dns.join(", ") : "--"], ["Physical address (MAC)", f.mac.toUpperCase()]];
    rows.splice(4, 0, ["Speed & duplex", "Auto negotiation" + (x.maxMbps ? " (a 10/" + x.maxMbps + " Mbps adapter)" : "")]);
    const st = f.cfg.mode === "static", dns = st ? (f.cfg.dns || []) : [];
    return { kind: "rows", title: "Network settings", rows: rows, speedTest: true, ipForm: { mode: f.cfg.mode, ip: st ? f.cfg.ip : "", mask: st ? f.cfg.mask : "", gw: st ? f.cfg.gw || "" : "", dns1: dns[0] || "", dns2: dns[1] || "" },
      facts: { page: id === "pc" ? "pc-settings" : id + "-settings", speed: sp, connected: !!a, mode: f.cfg.mode, ip: st ? f.cfg.ip : a && a.ip, mask: st ? f.cfg.mask : a && a.mask, gw: st ? f.cfg.gw : a && a.gw } };
  }
  if (x.kind === "brouter" && key === "lights") {   /* the business router: its status lights, and a light for each port with a cable (copper, then the two SFP slots) */
    const on = sim.on(id), rows = [], con = sim.cablesOf(id).find(function (c) { return c.kind === "console"; });
    for (let i = 0; i < 10; i++) {
      const port = "Gi0/" + i, c = sim.cableAt(id, port); if (!c) continue;
      const o = c.a.dev === id && c.a.port === port ? c.b : c.a, up = sim.cableUp(c);
      rows.push({ port: "GE 0/" + i + (i >= 8 ? " (SFP)" : ""), who: "the " + lowerFirst(sim.d[o.dev].label) + (c.kind === "fibre" ? " (fibre)" : ""), state: up ? "on, green: link up" : "off", up: up, speed: up ? 1000 : 0 });
    }
    const act = on && rows.some(function (r) { return r.up; });
    return { kind: "lights-ports", title: "Lights", ports: rows,
      lights: [{ name: "PWR", state: on ? "on" : "off", text: on ? "on, green" : "off", mean: "power is on" }, { name: "SYS", state: on ? "on" : "off", text: on ? "on, green" : "off", mean: "the router has started" },
        { name: "ACT", state: act ? "on" : "off", text: act ? "on, green" : "off", mean: "traffic on its ports" }, { name: "ALM", state: "off", text: "off", mean: "an alarm (a fan or power fault)" }],
      note: "A router's ports come from the box shut down, and each one's settings and address are on its command line. Reach it from your laptop's serial terminal on the console cable" + (con ? " (plugged into its CON port now)" : "") + ", or over the network once it has an address. A port's light is green when it has a link: ask the router (show ip interface brief) whether the port is up and what address it has.",
      facts: { page: id + "-lights", ports: rows } };
  }
  if (id === "pc" && key === "printers") {
    const pr = x.printer;
    return { kind: "printers", title: "Printers", name: pr.name, port: pr.port, facts: { page: "pc-printers", port: pr.port } };
  }
  if (id === "laptop" && key === "wifi") {
    const l = sim.wifiLink("laptop"), a = sim.addr("laptop"), f = x.ifaces[0];
    const rows = l && l.connected ? [["Wi-Fi", "Connected to " + l.ap.ssid], ["Protocol", l.band === 5 ? "Wi-Fi 5 (802.11ac)" : "Wi-Fi 4 (802.11n)"], ["Security type", l.sec], ["Network band", l.band === 5 ? "5 GHz" : "2.4 GHz"], ["Network channel", String(l.ch)], ["Link speed (Receive/Transmit)", l.rate + "/" + l.rate + " (Mbps)"], ["IPv4 address", a ? a.ip : "--"], ["IPv4 DNS servers", a && a.dns.length ? a.dns.join(", ") : "--"]]
      : [["Wi-Fi", l && l.reason === "auth" ? "Can't connect to this network (the password was rejected)" : l && l.reason === "security" ? "Can't connect to this network" : f.saved.ssid ? "Not connected: no saved network in range" : "Not connected"], ["Saved network", f.saved.ssid ? f.saved.ssid + (f.saved.sec === "Open" ? " (open)" : "") : "(none)"]];
    /* the networks Windows would list to pick from: the house's name, once per kind (secured, or an open copy) */
    const nets = [], seen = {};
    for (const ap of sim.aps()) { const sg = sim.heardAt(ap, sim.net.rooms.laptop); if (sg < 15) continue; const k = ap.ssid + (ap.sec === "Open" ? "|open" : "|sec"); if (seen[k]) { seen[k].signal = Math.max(seen[k].signal, sg); continue; } seen[k] = { ssid: ap.ssid, open: ap.sec === "Open", sec: ap.sec, signal: sg, now: !!(l && l.connected && l.ap.ssid === ap.ssid && (l.ap.sec === "Open") === (ap.sec === "Open")) }; nets.push(seen[k]); }
    return { kind: "rows", title: "Wi-Fi", rows: rows, speedTest: !!(l && l.connected), networks: nets, forget: !!f.saved.ssid, facts: { page: "laptop-wifi", connected: !!(l && l.connected), reason: l && l.reason, ch: l && l.ch, band: l && l.band, signal: l && l.signal } };
  }
  if (id === "printer" && key === "panel") {
    const f = x.ifaces[0], a = sim.addr("printer");
    return { kind: "form", form: "printer", title: "Control panel", status: a ? "Ready" : "No network connection", mac: f.mac, link: f.cfg.speed ? f.cfg.speed + " Mb/s, " + (f.cfg.duplex || "full") + " duplex (fixed: this card can't negotiate)" : null,
      values: { mode: f.cfg.mode, ip: f.cfg.mode === "static" ? f.cfg.ip : a ? a.ip : "", mask: f.cfg.mode === "static" ? f.cfg.mask : a ? a.mask : sim.d.router.lan.mask, gw: f.cfg.mode === "static" ? f.cfg.gw : a ? a.gw : sim.d.router.lan.ip },
      facts: { page: "printer-panel", ip: f.cfg.mode === "static" ? f.cfg.ip : a && a.ip, mode: f.cfg.mode, mac: f.mac, mask: f.cfg.mode === "static" ? f.cfg.mask : a && a.mask, gw: f.cfg.mode === "static" ? f.cfg.gw : a && a.gw } };
  }
  if (id === "camera" && key === "web") {
    const a = sim.addr("camera"), up = a && sim.route("camera", "203.0.113.80").internet;
    if (!a) return { kind: "rows", title: "Web page", rows: [["Camera's page", "This page can't be reached: nothing answers at the camera's address"]], facts: { page: "camera-web", ip: null, online: false } };
    const rows = [["Camera", a ? "Online, recording" : "Offline"], ["IP address", a ? a.ip + (a.kind === "dhcp" ? " (from DHCP)" : " (static)") : "--"], ["Gateway", a && a.gw || "--"], ["Cloud viewing", up ? "Connected" : "Can't reach the internet"]];
    if (sim.net.extra.build) {   /* build mode: what it's powered by, and how the app reaches it from away (as its manual says) */
      const inj = sim.poeSource("camera"), short = sim.poeShort("camera");
      rows.push(["Power", (inj.std === "at" ? "PoE+ (802.3at)" : "PoE (802.3af)") + (short ? ": limited. The heater and night vision are off (they need up to " + x.draw + " W)" : ": full")]);
      rows.push(["Viewing from away", "The app connects to the house's public address on port 8443. Forward that port to this camera's port 443."]);
    }
    return { kind: "rows", title: "Web page", rows: rows, facts: { page: "camera-web", ip: a && a.ip, online: true } };
  }
  if (id === "tv" && key === "net") {
    const a = sim.addr("tv"), up = a && sim.route("tv", "203.0.113.80").internet, dns = a && a.dns.some(function (s) { return sim.dnsServerWorks("tv", s); });
    return { kind: "rows", title: "Network status", rows: [["Wired (LAN)", a ? "Connected" : "Not connected"], ["IP address", a ? a.ip : "--"], ["Gateway", a && a.gw || "--"], ["DNS", a && a.dns.length ? a.dns.join(", ") : "--"], ["Internet", up && dns ? "Connected" : up ? "Connected, but names don't look up" : "No internet"]], facts: { page: "tv-net", internet: !!(up && dns) } };
  }
  if (id === "mesh" && key === "status") {
    const m = x, a = sim.addr("mesh"), n = Object.keys(sim.d).filter(function (k) { const l = sim.wifiLink(k); return l && l.connected && l.ap.id === "mesh"; }).length, ml = sim.meshLink();
    const bh = ml.ok ? (ml.kind === "wired" ? "Wired (Ethernet), 1 Gb/s" : "5 GHz, good (signal " + ml.signal + "%, " + (ml.signal > 70 ? 866 : 400) + " Mb/s)") : ml.kind === "wifi" && sim.net.extra.build ? "Lost: the router's 5 GHz signal here is " + ml.signal + "%, too weak to hold a link (it needs 40%)" : "Lost: can't reach the router";
    return { kind: "rows", title: "Status", rows: [["Mode", ml.kind === "wired" ? "Access point (wired to the router)" : "Access point (wireless bridge to the router)"], ["Backhaul to the router", bh], ["2.4 GHz channel", String(sim.ch24()) + " (follows the router)"], ["Clients on this node", String(n)], ["IP address", a ? a.ip : "--"]], facts: { page: "mesh-status", backhaul: ml.ok, clients: n } };
  }
  if (x.kind === "phone" && key === "wifi" && sim.net.site === "business") {   /* a phone at the business: the networks it hears, each joined by name with its password typed in (the client gives visitors the guest one) */
    const l = sim.wifiLink(id), a = sim.addr(id), up = !!(a && sim.route(id, "203.0.113.80").internet), f = x.ifaces[0];
    const status = l && l.connected ? "Connected to " + l.ap.ssid + (l.band === 5 ? " (5 GHz)" : " (2.4 GHz)") + " · signal " + l.signal + "%" : l && l.reason === "auth" ? "Can't join " + l.ap.ssid + ": the password is wrong" : l && l.reason === "security" ? "Can't join " + l.ap.ssid + ": this phone doesn't support its security" : f.saved.ssid ? "Not connected: it can't hear " + f.saved.ssid + " here" : "Not connected";
    const rows = [["Wi-Fi", status], ["IP address", a ? a.ip + (a.kind === "apipa" ? " (it gave itself this: no address came)" : "") : "--"], ["Router", a && a.gw || "--"], ["Internet", up ? "OK" : "No internet"]];
    const nets = [], seen = {};
    for (const ap of sim.aps()) { const sg = sim.heardAt(ap, sim.net.rooms[id]); if (sg < 15) continue; const k = ap.ssid + (ap.sec === "Open" ? "|open" : "|sec"); if (seen[k]) { seen[k].signal = Math.max(seen[k].signal, sg); continue; } seen[k] = { ssid: ap.ssid, open: ap.sec === "Open", sec: ap.sec, signal: sg, now: !!(l && l.connected && l.ap.ssid === ap.ssid) }; nets.push(seen[k]); }
    return { kind: "rows", title: "Wi-Fi", rows: rows, heard: nets, facts: { page: id + "-wifi", internet: up, ip: a && a.ip, apipa: !!(a && a.kind === "apipa"), connected: !!(l && l.connected), reason: l && l.reason, heard: nets.map(function (n) { return n.ssid; }) } };
  }
  if (x.kind === "phone" && key === "wifi") {
    const l = sim.wifiLink(id), a = sim.addr(id), up = !!(a && sim.route(id, "203.0.113.80").internet);
    const rows = [["Wi-Fi", l && l.connected ? "Connected to " + l.ap.ssid + (l.band === 5 ? " (5 GHz)" : " (2.4 GHz)") + " · signal " + l.signal + "%" : l && l.reason === "auth" ? "Can't join " + l.ap.ssid + ": the saved password is wrong" : "Not connected"], ["IP address", a ? a.ip + (a.kind === "apipa" ? " (it gave itself this: no address came)" : "") : "--"], ["Router", a && a.gw || "--"], ["Internet", up ? "OK" : "No internet"]];
    /* not joined to the house's network as it's called now (build mode: a new phone, or the network renamed) and it's in range: join it by name */
    const w = sim.d.router.wifi, f = x.ifaces[0], hear = sim.aps().some(function (ap) { return ap.id === "router" && ap.ssid === w.ssid && sim.heardAt(ap, sim.net.rooms[id]) >= 20; });
    const join = !(l && l.connected) && f.saved.ssid !== w.ssid && hear ? w.ssid : null;
    const nets = [], seen = {};   /* more than one network to pick from (build mode's guest network): the list, as a phone shows it */
    for (const ap of sim.aps()) { const sg = sim.heardAt(ap, sim.net.rooms[id]); if (sg < 15) continue; const k = ap.ssid + (ap.sec === "Open" ? "|open" : "|sec"); if (seen[k]) { seen[k].signal = Math.max(seen[k].signal, sg); continue; } seen[k] = { ssid: ap.ssid, open: ap.sec === "Open", sec: ap.sec, signal: sg, now: !!(l && l.connected && l.ap.ssid === ap.ssid && (l.ap.sec === "Open") === (ap.sec === "Open")) }; nets.push(seen[k]); }
    return { kind: "rows", title: "Wi-Fi", rows: rows, join: join, networks: sim.net.extra.build && nets.length > 1 ? nets : null, rejoin: !(l && l.reason === "auth") && !join, reenter: !!(l && l.reason === "auth"), cameraApp: id === "phone" && sim.d.router.forwards.length > 0, facts: { page: id === "guest" ? "guest-wifi" : "phone-wifi", internet: up, ip: a && a.ip, apipa: !!(a && a.kind === "apipa"), connected: !!(l && l.connected) } };
  }
  if (id === "rogue" && key === "admin") {
    const g = x;
    return { kind: "form", form: "rogue", title: "Admin page", values: { dhcpOn: g.dhcp.on }, rows: [["Model", "Home router (old)"], ["LAN address", g.lan.ip + " / " + g.lan.mask], ["DHCP server", g.dhcp.on ? "On · " + g.dhcp.start + " to " + g.dhcp.end : "Off"], ["Internet (WAN)", g.wanOk ? "Connected" : "No cable in the WAN port"], ["Clients with a lease", String(g.leases.length)]], facts: { page: "rogue-admin", dhcpOn: g.dhcp.on } };
  }
  if (id === "isp" && key === "about") return { kind: "rows", title: "About", rows: [["What it is", "The provider's network: outside the home. You can't log in here; test toward it from inside (ping, tracert)."], ["Provider DNS servers", sim.net.isp.dns.join(", ")]], facts: { page: "isp" } };
  return { kind: "rows", title: key, rows: [], facts: {} };
}

/* a physical action from the Physical tab: returns text for the notebook line and the result */
export function physical(sim, act) {
  const c = act.cable ? sim.cable(act.cable) : null;
  if (act.t === "look") { const text = look(sim, act.cable, act.end); return { text: text, facts: { phys: "look", cable: act.cable, end: act.end, seated: c.kind === "coax" ? c[act.end].tight : c[act.end].seated, cond: c.cond } }; }
  if (act.t === "test") { const t = tester(c); return { text: t.text, facts: { phys: "test", cable: act.cable, open: t.open || [] } }; }
  if (act.t === "probe") {   /* the inductive probe run along the back of the panel: it sounds where the toned run is punched down */
    const tc = sim.net.extra.tone && sim.cable(sim.net.extra.tone), pe = tc && sim.panelEnd(tc), port = pe && /R$/.test(pe.port) ? pe.port.slice(0, -1) : null;
    return { text: !tc ? "Nothing to hear: the tone generator isn't on any run yet. Clip it onto a run at the desk end first." : port ? "The probe screams at the back of port " + port + ": that's where the toned run is punched down. Every other port is quiet." : "The probe hears nothing along the back of the panel: the run with the tone on it doesn't come here.", facts: { phys: "probe", dev: act.dev, toned: tc ? tc.id : null, port: port } };
  }
  const before = c ? JSON.stringify([c.a, c.b, c.cond]) : null;
  const done = sim.apply(act) || {};
  if (act.t === "reseat") return { text: c[act.end].seated && before === JSON.stringify([c.a, c.b, c.cond]) ? "Pushed it home: it was already clicked in." : "Plugged it back in until it clicked.", facts: { phys: "reseat", cable: act.cable, end: act.end } };
  if (act.t === "replace") return { text: "Swapped in a new, tested patch cable (straight-through).", facts: { phys: "replace", cable: act.cable } };
  if (act.t === "polarity") return { text: done.polarity === "flipped" ? "Unclipped the LC duplex plug at this end and swapped its two fibres over: each end's transmit now meets the other end's transmit." : "Swapped the LC pair back over: each end's transmit meets the other end's receive again.", facts: { phys: "polarity", cable: act.cable, polarity: done.polarity } };
  if (act.t === "tone") return { text: "Clipped the tone generator onto the run at the desk end and switched it on: it's sending its warble down the cable.", facts: { phys: "tone", cable: act.cable } };
  if (act.t === "repatch") { const r = done; return { text: r.ok === false ? r.err + ": nothing moved." : r.same ? "It's already in that port." : "Moved the patch cord to port " + act.port + " on the panel.", facts: { phys: "repatch", cable: act.cable, port: act.port, ok: r.ok !== false } }; }
  if (act.t === "crossover") return { text: "Swapped in a crossover patch cable (T568A at one end, T568B at the other).", facts: { phys: "crossover", cable: act.cable } };
  if (act.t === "unplug") return { text: "Unplugged it.", facts: { phys: "unplug", cable: act.cable, end: act.end } };
  if (act.t === "tighten") return { text: before === JSON.stringify([c.a, c.b, c.cond]) ? "Already snug: no change." : "Screwed the connector on finger-tight.", facts: { phys: "tighten", cable: act.cable, end: act.end } };
  if (act.t === "power") return { text: "Restarted the " + (/^[A-Z][a-z]+(\s|$)/.test(sim.d[act.dev].label) ? sim.d[act.dev].label[0].toLowerCase() + sim.d[act.dev].label.slice(1) : sim.d[act.dev].label) + ". It's back up a minute later.", facts: { phys: "power", dev: act.dev } };
  return { text: "", facts: {} };
}
