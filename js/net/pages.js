/* What each device shows when you open it: its tabs, and what is on each
   tab, worked out from the simulation. Plain data, so the page code draws
   it and the tests read exactly what a student would see. Each page also
   returns "facts" the notebook can record. */
import { isIp } from "./util.js";

const STILL = { pc: "pc", laptop: "laptop", router: "router", switch: "switch", modem: "modem", printer: "printer", camera: "camera", tv: "tv", mesh: "mesh" };

export function tabsFor(sim, id) {
  const k = sim.d[id].kind, P = STILL[id] || id === "rogue" || k === "injector" ? [["physical", "Physical"]] : [];   /* the old router in HOME-10 is in the house; a hotspot outside it isn't */
  const T = {
    pc: [["cmd", "Command Prompt"], ["settings", "Network settings"], ["printers", "Printers"]],
    laptop: [["cmd", "Command Prompt"], ["wifi", "Wi-Fi"]],
    router: [["status", "Status"], ["dhcp", "LAN & DHCP"], ["clients", "DHCP clients"], ["wifi", "Wi-Fi"], ["forward", "Port forwarding"]],
    rogue: [["admin", "Admin page"]],
    modem: [["lights", "Lights"], ["status", "Status page"]],
    switch: [["lights", "Lights"]],
    printer: [["panel", "Control panel"]],
    camera: [["web", "Web page"]],
    tv: [["net", "Network status"]],
    mesh: [["status", "Status"]],
    phone: [["wifi", "Wi-Fi"]],
    isp: [["about", "About"]]
  }[k] || [];
  return T.concat(P).map(function (t) { return { key: t[0], title: t[1] }; });
}

/* the portable cable tester's reading for a cable (main at one end, remote at the other) */
export function tester(c) {
  if (c.kind === "coax") return { text: "This tester is for twisted-pair cable; coax isn't tested this way. Look at the connector instead.", pins: null };
  const open = c.cond === "crushed" ? [1, 2, 3, 6] : c.cond === "damaged" ? [4, 5, 7, 8] : [];
  const pass = [1, 2, 3, 4, 5, 6, 7, 8].filter(function (p) { return open.indexOf(p) < 0; });
  const text = open.length ? "Pins " + open.join(", ") + ": OPEN (the remote's lights for those pins stay dark).\nPins " + pass.join(", ") + " and G (shield): pass, in order." : "Pins 1 2 3 4 5 6 7 8 and G (shield): all pass, in order. Wired straight-through (T568B at both ends).";
  return { text: text, open: open };
}

function endName(sim, c, end) { const e = c[end]; const d = sim.d[e.dev]; return d.label + (e.port && e.dev !== "wall" ? " (" + portName(e) + ")" : ""); }
function portName(e) { return /^\d$/.test(e.port) ? "port " + e.port : e.port; }
export function cableName(sim, c, fromDev) {
  const other = c.a.dev === fromDev ? c.b : c.a;
  if (c.kind === "coax") return "Coax cable, wall outlet to the modem's CABLE IN";
  if (other.dev === "rogue") return "Patch cable to a box not on the diagram (" + other.port + ")";
  if (fromDev === "rogue") return "Patch cable to the 5-port switch (port " + other.port + ")";
  return "Patch cable to the " + sim.d[other.dev].label.replace(/^([A-Z])(?=[a-z]+(\s|$))/, function (m) { return m.toLowerCase(); }).replace(/^isp$/, "ISP") + (/^\d$/.test(other.port) ? " (port " + other.port + ")" : other.port ? " (" + other.port + ")" : "");
}

/* what you see when you look at one end of a cable */
export function look(sim, cableId, end) {
  const c = sim.cable(cableId), e = c[end];
  if (c.kind === "coax") return e.tight ? "Screwed on snugly; it doesn't turn by hand." : "Loose: the F-connector spins freely by hand, and the centre wire is barely touching.";
  if (!e.seated) return "Not plugged in: the plug is lying loose behind the " + (e.dev === "pc" ? "desk" : e.dev === "switch" ? "shelf" : "furniture") + ".";
  let s = "Clicked in and latched.";
  if (c.cond === "crushed") s += " Along the run under the desk, the jacket is flattened where a chair wheel rolls over it.";
  if (c.cond === "damaged" && (!c.kink || c.kink === end)) s += " A hand's width from this plug the jacket is kinked and split; the blue and brown pairs show through.";   /* the damage is near one end only */
  const up = sim.cableUp(c);
  s += up ? " The link light by the jack is on." : " The link light by the jack is off.";
  return s;
}

export function page(sim, id, key) {
  const x = sim.d[id], r = sim.d.router;
  const yes = function (b) { return b ? "Yes" : "No"; };
  if (key === "physical") {
    const cables = sim.cablesOf(id).map(function (c) {
      const end = c.a.dev === id ? "a" : "b";
      const acts = c.kind === "coax" ? ["look", "tighten"] : ["look", "reseat", "unplug", "test", "replace"];
      return { cable: c.id, end: end, name: cableName(sim, c, id), acts: acts };
    });
    if (id === "modem") { /* the coax's wall end is reached from the modem too: it's behind the TV stand */
      const cx = sim.cable("c-coax"); cables.forEach(function (k) { if (k.cable === "c-coax") k.name = "Coax cable at the modem's CABLE IN"; });
      cables.push({ cable: "c-coax", end: "a", name: "Coax cable at the wall outlet (behind the TV stand)", acts: ["look", "tighten"] });
    }
    const inj = x.kind === "injector" ? { power: !!x.power, std: x.std, swap: !sim.net.extra.build } : null;   /* in a build house the right injector comes out of the van, not a swap */
    return { kind: "physical", still: STILL[id] ? "assets/stills/" + STILL[id] + ".jpg" : null, label: x.label, cables: cables, restart: x.kind !== "injector", injector: inj,
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
      if (r.admin) rows.push(["Admin password", r.admin.gen > 1 ? "Changed from the factory one" : "The factory one, printed on the router's label"]);   /* build mode: a router fresh from its box */
      return { kind: "rows", title: "Status", rows: rows, admin: !!r.admin, facts: { page: "router-status", wan: !!w, dhcpOn: r.dhcp.on } };
    }
    if (key === "dhcp") return { kind: "form", form: "router-dhcp", title: "LAN & DHCP", values: { lanIp: r.lan.ip, mask: r.lan.mask, on: r.dhcp.on, start: r.dhcp.start, end: r.dhcp.end, leaseH: r.dhcp.leaseH, dnsMode: r.dhcp.dnsMode, dns1: r.dhcp.dns[0], dns2: r.dhcp.dns[1] },
      facts: { page: "router-dhcp", on: r.dhcp.on, start: r.dhcp.start, end: r.dhcp.end, dnsMode: r.dhcp.dnsMode, dns: r.dhcp.dns.filter(Boolean) } };
    if (key === "clients") {
      const resv = r.dhcp.reservations;
      const rows = r.leases.map(function (l) { return [l.name, l.mac, l.ip, resv.some(function (v) { return v.mac === l.mac; }) ? "Reserved" : "DHCP"]; });
      const size = (function () { const a = r.dhcp.start.split(".").map(Number)[3], b = r.dhcp.end.split(".").map(Number)[3]; return b - a + 1; })();
      const inRange = r.leases.filter(function (l) { const n = +l.ip.split(".")[3]; return n >= +r.dhcp.start.split(".")[3] && n <= +r.dhcp.end.split(".")[3]; }).length;
      return { kind: "table", title: "DHCP clients", head: ["Device", "Hardware address", "IP address", "Type"], rows: rows, reserve: true, reservations: resv.map(function (v) { return [v.name, v.mac, v.ip]; }), leaseH: r.dhcp.leaseH,
        note: inRange + " of " + size + " addresses in the range are leased. Leases last " + r.dhcp.leaseH + " hours; a device keeps its address that long even after it leaves.", facts: { page: "router-clients", count: inRange, size: size, rows: rows, leaseH: r.dhcp.leaseH } };
    }
    if (key === "forward") return { kind: "form", form: "router-forward", title: "Port forwarding", add: !!r.factorySsid, rules: r.forwards.map(function (f) { return { name: f.name, ext: f.ext, ip: f.ip, port: f.port }; }), wan: sim.wan() ? sim.wan().ip : "0.0.0.0", facts: { page: "router-forward", rules: r.forwards.map(function (f) { return { ext: f.ext, ip: f.ip, port: f.port }; }) } };
    if (key === "wifi") return { kind: "form", form: "router-wifi", title: "Wi-Fi", values: { ssid: r.wifi.ssid, sec: r.wifi.sec, changed: (r.wifi.gen || 1) > 1, rename: !!r.factorySsid, factory: !!r.factorySsid && (r.wifi.gen || 1) === 1, bssids: sim.aps().filter(function (a) { return a.id === "router"; }).map(function (a) { return [a.band === 5 ? "5 GHz" : "2.4 GHz", a.mac.toUpperCase().replace(/-/g, ":")]; }), ch24: r.wifi.ch24mode === "auto" ? "auto" : String(r.wifi.ch24), ch24now: sim.ch24(), ch5: String(r.wifi.ch5) }, facts: { page: "router-wifi", ch24: sim.ch24(), mode: r.wifi.ch24mode, sec: r.wifi.sec } };
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
  if (id === "switch" && key === "lights") {
    const rows = [];
    for (let p = 1; p <= 5; p++) {
      const c = sim.cableAt("switch", String(p));
      const who = c ? (function () { const o = c.a.dev === "switch" ? c.b : c.a; return sim.d[o.dev].undocumented ? "a box that isn't on the diagram" : "the " + sim.d[o.dev].label.replace(/^([A-Z])(?=[a-z]+(\s|$))/, function (m) { return m.toLowerCase(); }); })() : null;
      const sp = c ? sim.speed(c) : 0;
      const state = !c ? "off (nothing plugged in)" : sp === 0 ? "off" : sp === 1000 ? "on, green: 1 Gb/s link" : "on, amber: 10/100 Mb/s link";
      rows.push({ port: p, who: who, state: state, up: sp > 0, speed: sp });
    }
    return { kind: "lights-ports", title: "Lights", ports: rows, note: "Unmanaged: no console and no settings. Read the lights: green is 1 Gb/s, amber is 10/100 Mb/s.", facts: { page: "switch-lights", ports: rows } };
  }
  if (id === "pc" && key === "settings") {
    const a = sim.addr("pc"), f = x.ifaces[0], c = sim.cableAt("pc", f.port), sp = sim.speed(c);
    const rows = [["Ethernet", a ? "Connected" : "Not connected (unplugged)"], ["IP assignment", f.cfg.mode === "dhcp" ? "Automatic (DHCP)" : "Manual"], ["DNS server assignment", f.cfg.dnsMode === "static" ? "Manual" : "Automatic (DHCP)"],
      ["Link speed (Receive/Transmit)", sp ? sp + "/" + sp + " (Mbps)" : "--"], ["IPv4 address", a ? a.ip : "--"], ["IPv4 DNS servers", a && a.dns.length ? a.dns.join(", ") : "--"], ["Physical address (MAC)", f.mac.toUpperCase()]];
    rows.splice(4, 0, ["Speed & duplex", "Auto negotiation"]);
    const st = f.cfg.mode === "static", dns = st ? (f.cfg.dns || []) : [];
    return { kind: "rows", title: "Network settings", rows: rows, speedTest: true, ipForm: { mode: f.cfg.mode, ip: st ? f.cfg.ip : "", mask: st ? f.cfg.mask : "", gw: st ? f.cfg.gw || "" : "", dns1: dns[0] || "", dns2: dns[1] || "" },
      facts: { page: "pc-settings", speed: sp, connected: !!a, mode: f.cfg.mode, ip: st ? f.cfg.ip : a && a.ip, mask: st ? f.cfg.mask : a && a.mask, gw: st ? f.cfg.gw : a && a.gw } };
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
    return { kind: "form", form: "printer", title: "Control panel", status: a ? "Ready" : "No network connection", mac: f.mac,
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
  if (x.kind === "phone" && key === "wifi") {
    const l = sim.wifiLink(id), a = sim.addr(id), up = !!(a && sim.route(id, "203.0.113.80").internet);
    const rows = [["Wi-Fi", l && l.connected ? "Connected to " + l.ap.ssid + (l.band === 5 ? " (5 GHz)" : " (2.4 GHz)") + " · signal " + l.signal + "%" : l && l.reason === "auth" ? "Can't join " + l.ap.ssid + ": the saved password is wrong" : "Not connected"], ["IP address", a ? a.ip + (a.kind === "apipa" ? " (it gave itself this: no address came)" : "") : "--"], ["Router", a && a.gw || "--"], ["Internet", up ? "OK" : "No internet"]];
    /* not joined to the house's network as it's called now (build mode: a new phone, or the network renamed) and it's in range: join it by name */
    const w = sim.d.router.wifi, f = x.ifaces[0], hear = sim.aps().some(function (ap) { return ap.id === "router" && ap.ssid === w.ssid && sim.heardAt(ap, sim.net.rooms[id]) >= 20; });
    const join = !(l && l.connected) && f.saved.ssid !== w.ssid && hear ? w.ssid : null;
    return { kind: "rows", title: "Wi-Fi", rows: rows, join: join, rejoin: !(l && l.reason === "auth") && !join, reenter: !!(l && l.reason === "auth"), cameraApp: id === "phone" && sim.d.router.forwards.length > 0, facts: { page: id === "guest" ? "guest-wifi" : "phone-wifi", internet: up, ip: a && a.ip, apipa: !!(a && a.kind === "apipa"), connected: !!(l && l.connected) } };
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
  const before = c ? JSON.stringify([c.a, c.b, c.cond]) : null;
  sim.apply(act);
  if (act.t === "reseat") return { text: c[act.end].seated && before === JSON.stringify([c.a, c.b, c.cond]) ? "Pushed it home: it was already clicked in." : "Plugged it back in until it clicked.", facts: { phys: "reseat", cable: act.cable, end: act.end } };
  if (act.t === "replace") return { text: "Swapped in a new, tested patch cable.", facts: { phys: "replace", cable: act.cable } };
  if (act.t === "unplug") return { text: "Unplugged it.", facts: { phys: "unplug", cable: act.cable, end: act.end } };
  if (act.t === "tighten") return { text: before === JSON.stringify([c.a, c.b, c.cond]) ? "Already snug: no change." : "Screwed the connector on finger-tight.", facts: { phys: "tighten", cable: act.cable, end: act.end } };
  if (act.t === "power") return { text: "Restarted the " + (/^[A-Z][a-z]+(\s|$)/.test(sim.d[act.dev].label) ? sim.d[act.dev].label[0].toLowerCase() + sim.d[act.dev].label.slice(1) : sim.d[act.dev].label) + ". It's back up a minute later.", facts: { phys: "power", dev: act.dev } };
  return { text: "", facts: {} };
}
