/* Client jobs for build mode, the home level. Each job builds the house as
   the technician finds it (the boxes still sealed, the router at its factory
   settings), and its work order is a list of lines the network checks.
   Each line is an ordered list of the things that could stop it: the first
   one that is really there is what the check saw, and every one before it
   has been ruled out, so Mason's third rung can strike those with a reason
   each and leave two. None of it ever says what to type or where to plug. */
import { makeHome } from "../net/home.js";
import { Sim } from "../net/sim.js";
import { rng, hash, ip2n, sameSubnet } from "../net/util.js";

const PUBLIC = "203.0.113.80";
export const NAME = { router: "router", modem: "modem", pc: "office PC", tv: "smart TV", switch: "switch", printer: "printer", phone: "phone", laptop: "laptop", camera: "camera", injector: "PoE injector", injector2: "PoE+ injector", mesh: "mesh node" };
export const IN = { office: "the office", living: "the living room", kitchen: "the kitchen", garage: "the garage", upstairs: "the back bedroom upstairs", landing: "the landing at the top of the stairs", porch: "by the front door" };
const cap = function (s) { return s[0].toUpperCase() + s.slice(1); };
const C = function (id, on, text, not, ev, skip) { return { id: id, on: !!on, text: text, not: not, ev: ev, skip: !!skip }; };
const placed = function (sim, id) { return !!sim.d[id] && !sim.d[id].boxed; };
const surname = function (net) { return net.client.name.replace(/^(Mrs?|Ms)\. /, ""); };

/* is a device online the way the client means it: an address from the house, the internet, and names that look up */
export function online(sim, id) {
  const a = sim.addr(id); if (!a || a.kind === "apipa") return false;
  const r = sim.route(id, PUBLIC); if (!r.internet) return false;
  return a.dns.some(function (s) { return sim.dnsServerWorks(id, s); });
}

/* ---------------------------------------------------------------- what can stop a line */
function routerCauses(sim) {
  const mc = sim.cableAt("modem", "ETH"), far = mc && (mc.a.dev === "modem" ? mc.b : mc.a);
  return [
    C("box", sim.d.router.boxed, "The router is still in its box", "The router is out of its box.", "The router is still in its box."),
    C("none", !mc, "Nothing joins the modem to the router", "The modem's ETHERNET port has a cable in it.", "Nothing is plugged into the modem's ETHERNET port."),
    C("dev", mc && far.dev !== "router", "The modem is cabled to something other than the router", "The modem's cable goes to the router.", mc && far.dev !== "router" ? "The modem's ETHERNET cable goes to the " + NAME[far.dev] + "." : ""),
    C("port", mc && far.dev === "router" && far.port !== "WAN", "The modem's cable is in one of the router's LAN ports", "The modem's cable is in the router's INTERNET (WAN) port.", "The router's Status page says: Internet (WAN) disconnected, no cable from the modem in the INTERNET (WAN) port."),
    C("link", mc && !sim.cableUp(mc), "The cable between the modem and the router has no link", "That cable has a link.", "The modem's LINK light is off."),
    C("wan", !sim.wanUp(), "The router can't get online through the modem", "The router is online.", "The router's Internet light is off.")
  ];
}
function wiredCauses(sim, id, room) {
  const x = sim.d[id], N = NAME[id], f = x.ifaces[0], here = sim.net.rooms[id];
  const c = sim.cableAt(id, f.port), a = sim.addr(id), lan = sim.on("router") && sim.domain(sim.homeNode(id)).has("router:lan");
  const toR = a && sim.route(id, sim.d.router.lan.ip), net = a && sim.route(id, PUBLIC), dns = !!a && a.dns.some(function (s) { return sim.dnsServerWorks(id, s); });
  return [
    C("box", x.boxed, "The " + N + " is still in its box", "The " + N + " is out of its box.", "The " + N + " is still in its box."),
    C("room", !x.boxed && room && here !== room, "The " + N + " is in the wrong room", "It's in " + IN[room] + ", where the order puts it.", "The " + N + " is in " + IN[here] + "; the order puts it in " + IN[room] + ".", !room),
    C("cable", !c, "Nothing is plugged into the " + N + "'s network port", "Its network port has a cable in it.", cap(N) + ": no link. Nothing is plugged into its network port."),
    C("link", c && !sim.cableUp(c), "Its cable has no link", "Its cable has a link.", cap(N) + ": a cable is in its network port, but there's no link."),
    C("lan", !lan, "Its cable doesn't lead to the router's house side (a LAN port, or a switch cabled to one)", "Its cable leads to the router's house side.", cap(N) + ": " + (a && a.kind === "apipa" ? "it has a link, but no address came: it gave itself " + a.ip + "." : "it has a link, but nothing answers at the router's address.")),
    C("ip", !(toR && toR.local), "Its own IP settings don't fit the router's network", "Its IP settings fit: it reaches the router.", cap(N) + ": it's cabled to the router's side, but it can't reach the router."),
    C("wan", !sim.wanUp(), "The router itself isn't online", "The router is online: its Internet light is on.", cap(N) + " reaches the router, but the router has no internet."),
    C("gw", !(net && net.internet) || !dns, "Its gateway or DNS settings are wrong", "Its gateway and DNS work.", cap(N) + " reaches the router, but not the internet" + (net && net.internet ? ": names don't look up." : "."))
  ];
}
function wifiCauses(sim, id) {
  const x = sim.d[id], N = NAME[id], f = x.ifaces[0], w = sim.d.router.wifi, l = sim.wifiLink(id), a = sim.addr(id), room = sim.net.rooms[id];
  const saved = f.saved.ssid;
  return [
    C("router", !placed(sim, "router"), "The router isn't set up yet, so there's no Wi-Fi", "The router is set up: its Wi-Fi is on.", "The router is still in its box: there's no Wi-Fi yet."),
    C("join", !saved, "The " + N + " hasn't been joined to the Wi-Fi", "It has a Wi-Fi network saved.", cap(N) + ": not connected to any Wi-Fi."),
    C("name", saved && saved !== w.ssid, "The " + N + " is saved to a network name that isn't there any more", "It's saved to the network's name as it is now.", cap(N) + ": it keeps looking for " + saved + ", and no network of that name is in range."),
    C("range", l && l.reason === "no-network", "The Wi-Fi doesn't reach " + IN[room], "The Wi-Fi reaches " + IN[room] + ".", cap(N) + ": " + w.ssid + " isn't in range in " + IN[room] + "."),
    C("pass", l && l.reason === "auth", "The " + N + " has an old Wi-Fi password saved", "Its saved password is the network's.", cap(N) + ": can't join " + w.ssid + ": the saved password is wrong."),
    C("sec", l && l.reason === "security", "The " + N + "'s Wi-Fi can't use the network's security", "Its Wi-Fi can use the network's security.", cap(N) + ": can't connect to " + w.ssid + "."),
    C("addr", !a || a.kind === "apipa", "No address came from the router", "It has an address from the router.", cap(N) + ": on the Wi-Fi, but no address came: " + (a ? "it gave itself " + a.ip + "." : "none at all.")),
    C("wan", !sim.wanUp(), "The router itself isn't online", "The router is online: its Internet light is on.", cap(N) + ": on the Wi-Fi, but no internet.")
  ];
}
/* the first device in a list that isn't online, and what stops it; every one online: nothing stops it */
function firstDown(sim, list) {
  for (const it of list) if (!online(sim, it[0])) return it[1](sim, it[0]);
  return [C("none", false, "", "", "")];
}

/* ---------------------------------------------------------------- the lines the jobs share */
const L_ROUTER = {
  id: "router", text: "The router set up and online: the house's internet comes in through it",
  causes: routerCauses,
  ok: function (sim) { return "The router is online through the modem: its Status page says Internet (WAN) connected."; },
  rung1: function () { return "Start at the modem: follow its ETHERNET cable to where it goes in at the far end. Then open the router's Status page and read its Internet (WAN) line."; },
  rung2: function () { return "A home router has two sides. One port faces the provider (INTERNET, or WAN); the others face the house (LAN). The modem's line has to come in on the provider's side, or the router has nothing to share."; }
};
function L_WIRED(id, room) {
  const N = NAME[id];
  return {
    id: id, text: "The " + N + " online, on a cable, in " + IN[room],
    causes: function (sim) { return wiredCauses(sim, id, room); },
    ok: function (sim) { return cap(N) + ": online, over a cable, with the address " + sim.addr(id).ip + " from the router."; },
    rung1: function () { return "Open the " + N + ": " + (id === "tv" ? "its Network status page" : "its Command Prompt (ipconfig, then a ping to 203.0.113.80)") + ", and its Physical tab. Where does its cable go at the far end?"; },
    rung2: function () { return "A wired device gets its address and its way out from the router's house side: one of its LAN ports, or a switch that is itself cabled to one. The modem and the router's INTERNET port are the provider's side: nothing in the house gets an address there."; }
  };
}
const L_WIFI = {
  id: "wifi", text: "The phone and the laptop online over the Wi-Fi",
  causes: function (sim) { return firstDown(sim, [["phone", wifiCauses], ["laptop", wifiCauses]]); },
  ok: function (sim) { return "Phone and laptop: both on " + sim.d.router.wifi.ssid + ", online."; },
  rung1: function () { return "Open the phone's and the laptop's Wi-Fi pages: which network does each one look for, and what does it say about it? Then compare with the router's Wi-Fi page."; },
  rung2: function () { return "A device remembers a Wi-Fi network by its name and its password. Change either one on the router, and every device has to be joined again with the new one."; }
};
const L_WIFISEC = {
  id: "wifisec", text: "The Wi-Fi renamed, with a password of its own (not the one on the label)",
  causes: function (sim) {
    const r = sim.d.router, w = r.wifi;
    return [
      C("box", r.boxed, "The router is still in its box", "The router is out of its box.", "The router is still in its box."),
      C("name", w.ssid === r.factorySsid, "The Wi-Fi still has its factory name", "It has a name of its own.", "The Wi-Fi is still called " + r.factorySsid + ", the name printed on the router's label."),
      C("pass", (w.gen || 1) === 1, "The Wi-Fi password is still the one on the label", "Its password has been changed.", "The Wi-Fi password is still the one printed on the router's label: anyone who reads it can join.")
    ];
  },
  ok: function (sim) { return "The Wi-Fi is called " + sim.d.router.wifi.ssid + ", with a new password."; },
  rung1: function () { return "Open the router's Wi-Fi page, and think about what's printed on the label under the router."; },
  rung2: function () { return "Out of the box, a router's Wi-Fi name and password are printed on its label for anyone in the house to read, and the name tells the street what model it is. Hardening a new router starts with changing those defaults."; }
};
const L_ADMIN = {
  id: "admin", text: "The router's admin password changed from the one on the label",
  causes: function (sim) {
    const r = sim.d.router;
    return [
      C("box", r.boxed, "The router is still in its box", "The router is out of its box.", "The router is still in its box."),
      C("admin", r.admin.gen === 1, "The admin password is still the one on the label", "It's been changed.", "The router's admin pages still open with the password printed on its label.")
    ];
  },
  ok: function () { return "The router's admin pages take a new password; the label's no longer works."; },
  rung1: function () { return "Open the router's Status page and read every line, to the bottom."; },
  rung2: function () { return "The password that opens the router's own pages isn't the Wi-Fi's. Out of the box it's on the label too, and anyone on the network who knows it can change every setting."; }
};

/* ---------------------------------------------------------------- the house as the technician finds it */
const KEEP = { isp: 1, wall: 1, modem: 1, router: 1, phone: 1, laptop: 1 };
function factory(seed, devices, rooms) {
  const net = makeHome(seed), R = rng(hash("build:" + seed)), d = net.devices, r = d.router;
  net.extra.build = true;
  for (const id of Object.keys(d)) if (!KEEP[id] && devices.indexOf(id) < 0) { delete d[id]; delete net.rooms[id]; }
  net.cables = net.cables.filter(function (c) { return c.kind === "coax"; });   /* the provider left the modem cabled to the wall outlet */
  const home = r.wifi.ssid;
  r.factorySsid = "ROUTER-" + R.int(4096, 65535).toString(16).toUpperCase(); r.wifi.ssid = r.factorySsid; r.wifi.gen = 1; r.admin = { gen: 1 };
  r.dhcp.reservations = []; r.forwards = []; r.leases = [];
  /* the router's guest network, off as it comes from the box: its own subnet and pool, kept off the home network by default */
  const gp = "192.168." + ((+net.prefix.split(".")[2] + 100) % 256);
  r.guest = { kind: "router", on: false, ssid: "", sec: "Open", gen: 1, isolate: true, lan: { ip: gp + ".1", mask: "255.255.255.0" }, dhcp: { on: true, start: gp + ".10", end: gp + ".60", leaseH: 8, dnsMode: "router", dns: ["", ""], reservations: [] }, leases: [] };
  for (const id of ["router"].concat(devices)) d[id].boxed = true;
  ["phone", "laptop"].forEach(function (id) { d[id].ifaces[0].saved = { ssid: null, passOk: false }; });
  Object.assign(net.rooms, rooms || {});
  if (d.printer) { d.printer.ifaces[0].cfg = { mode: "dhcp", dnsMode: "auto" }; d.printer.sub = "DHCP"; }
  if (d.pc) d.pc.printer.port = "";
  return { net: net, home: home };
}
/* a job that starts after an earlier one: those devices already in and working, the way the earlier job left them */
function settle(sim, home, steps) {
  for (const s of steps) {
    if (s.t === "place") sim.place(s.dev, s.room);
    else if (s.t === "lay") sim.lay(s.a, s.b);
  }
  const r = sim.d.router; r.wifi.ssid = home; r.wifi.gen = 2; r.admin = { gen: 2 };
  ["phone", "laptop"].forEach(function (id) { sim.d[id].ifaces[0].saved = { ssid: home, passOk: true, gen: 2 }; });
  sim.boot(["tv", "phone", "laptop"]);
}
const E = function (dev, port) { return { dev: dev, port: port }; };

/* ---------------------------------------------------------------- J1 */
const J1 = {
  id: "J1", title: "Move-in: get the house online",
  start(seed) {
    const f = factory(seed, ["pc", "tv"], { laptop: "kitchen", phone: "living" });
    const sim = new Sim(f.net); sim.boot();
    return { sim: sim, v: { home: f.home, surname: surname(f.net) } };
  },
  brief(v) { return { quote: "The internet company came this morning: the modem's in the living room by the cable outlet, and its lights are all on. Everything else is still in its boxes. I want my computer in the office, the TV in the living room on a cable, and our phone and laptop on the Wi-Fi. My brother says never leave a router the way it comes out of the box, whatever that means.", from: "new house, the internet just put in" }; },
  mason: "Read the whole order before you unbox anything. Plan where each cable runs, then set things up.",
  limits: ["The modem stays where the provider put it: by the cable outlet in the living room.", "A copper run is 100 m at most: each run's length shows as you lay it.", "No budget limit: use what the job needs."],
  reqs: [L_ROUTER, L_WIRED("pc", "office"), L_WIRED("tv", "living"), L_WIFI, L_WIFISEC, L_ADMIN],
  /* one way to do it (the tests and the instructor's answer); any way the network accepts passes */
  solve(v) {
    return [{ t: "place", dev: "router", room: "living" }, { t: "place", dev: "pc", room: "office" }, { t: "place", dev: "tv", room: "living" },
      { t: "lay", a: E("modem", "ETH"), b: E("router", "WAN") }, { t: "lay", a: E("router", "LAN 1"), b: E("pc", "NIC") }, { t: "lay", a: E("router", "LAN 2"), b: E("tv", "LAN") },
      { t: "router", page: "wifi", values: { ssid: v.home } }, { t: "router", page: "wifi", values: { newPassword: true } }, { t: "router", page: "admin", values: { newPassword: true } },
      { t: "join", dev: "phone" }, { t: "join", dev: "laptop" }];
  },
  answer(v) {
    return ["Place the router in the living room, beside the modem; the PC in the office; the TV in the living room.", "Lay the modem's ETHERNET to the router's INTERNET (WAN) port, then a router LAN port to the PC (a 14 m run through the office wall) and another to the TV.",
      "On the router's Wi-Fi page: a new name (for example " + v.home + "), saved; then Change the Wi-Fi password.", "On the router's Status page: Change the admin password.", "Join the phone (its Wi-Fi page) and the laptop (Wi-Fi tab, Networks in range) to the new name. Joining before the rename means joining again after it."];
  },
  summary(v, sim) {
    const r = sim.d.router, pcRun = sim.cableAt("pc", "NIC");
    return ["The modem's line comes in on the router's INTERNET (WAN) port; the house is on its LAN side, where the router hands out addresses (DHCP).",
      "The office PC is wired" + (pcRun ? " on a " + pcRun.length + " m run" : "") + ", and the TV is wired in the living room.",
      "The Wi-Fi is " + r.wifi.ssid + ", with a password of its own; the phone and the laptop are joined to it.",
      "The router is hardened: its factory Wi-Fi name and both label passwords are gone."];
  }
};

/* ---------------------------------------------------------------- J2 */
/* a device others must always find (a printer, a camera): a fixed address on the router's network that the router never
   hands out, or one reserved for it on the router and picked up. base: what has to be right before its address matters */
function fixedCauses(sim, id, base) {
  const f = sim.d[id].ifaces[0], r = sim.d.router, a = sim.addr(id), N = NAME[id];
  const res = r.dhcp.reservations.find(function (v) { return v.mac === f.mac; }), st = f.cfg.mode === "static";
  const onNet = st && sameSubnet(f.cfg.ip, r.lan.ip, r.lan.mask) && f.cfg.mask === r.lan.mask;
  const inRange = st && ip2n(f.cfg.ip) >= ip2n(r.dhcp.start) && ip2n(f.cfg.ip) <= ip2n(r.dhcp.end);
  const twins = a ? sim.owners(a.ip, sim.domain(sim.homeNode(id))).filter(function (o) { return o !== id; }) : [];
  return base.concat([
    C("float", !st && !res, "The " + N + " takes whatever address the router hands it", "It keeps one address.", "The " + N + " gets its address from the router, with nothing to keep it the same: it can change when its lease runs out."),
    C("stale", !st && res && (!a || a.ip !== res.ip), "The " + N + " hasn't picked up its reserved address yet", "It's using its reserved address.", res ? "The router has " + res.ip + " reserved for the " + N + ", but the " + N + " is still on " + (a ? a.ip : "no address") + ": it hasn't asked for an address since." : ""),
    C("net", st && !onNet, "Its fixed address or mask doesn't fit the router's network", "Its fixed address and mask fit the router's network.", "The " + N + " has fixed settings, but they don't fit the network the router runs."),
    C("range", st && onNet && inRange, "Its fixed address is inside the range the router hands out", "Its fixed address is outside the range the router hands out.", "The " + N + "'s fixed address is one the router can also hand to another device."),
    C("twin", st && (f.cfg.ip === r.lan.ip || twins.length > 0), "Another device has the same address", "Nothing else answers at its address.", "Two devices answer at the " + N + "'s address.")
  ]);
}
function printerCauses(sim) { return fixedCauses(sim, "printer", wiredCauses(sim, "printer", "office").slice(0, 5)); }   /* in its box, the room, the cable, the link, the house side */
function printCauses(sim) {
  const port = sim.d.pc.printer.port, pa = sim.addr("printer"), pc = sim.addr("pc");
  const rt = port && pc ? sim.route("pc", port) : null;
  return [
    C("printer", !placed(sim, "printer") || !pa || pa.kind === "apipa", "The printer isn't on the network yet", "The printer is on the network.", "The printer isn't on the network yet."),
    C("pc", !placed(sim, "pc") || !pc || pc.kind === "apipa", "The office PC isn't on the network yet", "The office PC is on the network.", "The office PC isn't on the network yet."),
    C("none", !port, "The office PC's printer isn't pointed at any address", "Its printer is pointed at an address.", "The office PC's printer has no address set: a test page goes nowhere."),
    C("wrong", port && pa && port !== pa.ip, "The office PC sends its print jobs to an address that isn't the printer's", "It sends them to the printer's address.", "A test page from the office PC doesn't print."),
    C("reach", !(rt && rt.local && rt.owner.length === 1 && rt.owner[0] === "printer"), "The office PC can't get its print jobs to the printer", "It reaches the printer.", "A test page from the office PC doesn't print every time: more than one device, or none, answers at that address.")
  ];
}
function wallCauses(sim) {
  const rooms = sim.net.rooms, office = function (id) { return rooms[id] === "office"; };
  const cross = sim.net.cables.filter(function (c) { return c.kind !== "coax" && office(c.a.dev) !== office(c.b.dev); });
  const here = function (id) { return placed(sim, id) && office(id); };
  const both = ["pc", "printer"].every(function (id) { return sim.on("router") && sim.domain(sim.homeNode(id)).has("router:lan"); });
  return [
    C("set", !here("pc") || !here("printer"), "The PC and the printer aren't both set up in the office yet", "Both are set up in the office.", "The office PC and the printer aren't both set up in the office yet."),
    C("many", cross.length > 1, "More than one cable goes through the office wall", "Only one cable goes through the wall.", cross.length + " cables go through the office wall. There's one hole, and the client won't have another drilled."),
    C("none", cross.length === 0, "No cable goes through the office wall", "A cable goes through the wall.", "No cable goes through the office wall: the office isn't joined to the router."),
    C("share", !both, "The one cable doesn't serve both the PC and the printer", "It serves both.", "The one cable through the wall doesn't reach both the office PC and the printer.")
  ];
}
const J2 = {
  id: "J2", title: "The home office: a wired PC and a printer",
  already: ["keep"],   /* lines met before any work: the job is not to break them */
  start(seed) {
    const f = factory(seed, ["switch", "pc", "printer", "tv"], { laptop: "kitchen", phone: "living" });
    const sim = new Sim(f.net);
    settle(sim, f.home, [{ t: "place", dev: "router", room: "living" }, { t: "place", dev: "tv", room: "living" }, { t: "lay", a: E("modem", "ETH"), b: E("router", "WAN") }, { t: "lay", a: E("router", "LAN 2"), b: E("tv", "LAN") }]);
    return { sim: sim, v: { home: f.home, surname: surname(f.net) } };
  },
  brief() { return { quote: "We've been in a month and everything works. Now I'm working from home: the computer and a new printer go in the office. The printer has to work from the computer every time, not just today. There's one hole through the office wall for a cable, and I'm not having another drilled.", from: "working from home now" }; },
  mason: "One hole, two devices. Work out what goes where before you lay anything.",
  limits: ["One hole through the office wall for a cable: the client won't have another drilled.", "A copper run is 100 m at most: each run's length shows as you lay it.", "No budget limit: use what the job needs."],
  reqs: [L_WIRED("pc", "office"), {
    id: "printer", text: "The printer in the office, on a fixed address the router will never hand to anything else",
    causes: printerCauses,
    ok: function (sim) { const f = sim.d.printer.ifaces[0], r = sim.d.router; return f.cfg.mode === "static" ? "The printer is fixed at " + f.cfg.ip + ", outside the range the router hands out (" + r.dhcp.start + " to " + r.dhcp.end + ")." : "The router always gives the printer " + sim.addr("printer").ip + ": it's reserved for the printer's hardware address."; },
    rung1: function () { return "Compare three pages: the printer's Control panel, the router's LAN & DHCP page (the range it hands out) and its DHCP clients page."; },
    rung2: function () { return "A device that others must always find, like a printer, needs an address that never changes: set by hand on the device, on the router's network but outside the range the router hands out, or reserved for it on the router. Two devices can never share an address."; }
  }, {
    id: "print", text: "The office PC prints to it",
    causes: printCauses,
    ok: function (sim) { return "A test page from the office PC to " + sim.d.pc.printer.port + " prints."; },
    rung1: function () { return "Open the office PC's Printers tab: which address does it send print jobs to? Compare it with the printer's own Control panel."; },
    rung2: function () { return "Windows sends a print job to the address in the printer's port, nowhere else. It has to be the printer's own address, and only the printer's."; }
  }, {
    id: "wall", text: "Just the one cable through the office wall, for both the PC and the printer",
    causes: wallCauses,
    ok: function () { return "One cable goes through the office wall, and both the office PC and the printer reach the router over it."; },
    rung1: function () { return "Count the runs in the Cable runs list that go through the office wall: from a device in the office to one in another room."; },
    rung2: function () { return "One cable can serve many devices: a switch at its end shares the one run among everything plugged into it. That's how one hole in a wall serves a whole room."; }
  }, {
    id: "keep", text: "Everything that worked before still works: the internet, the TV, the phone and the laptop",
    causes: function (sim) { return sim.wanUp() ? firstDown(sim, [["tv", function (s) { return wiredCauses(s, "tv", "living"); }], ["phone", wifiCauses], ["laptop", wifiCauses]]) : routerCauses(sim); },
    ok: function () { return "The internet, the TV, the phone and the laptop all still work."; },
    rung1: function () { return "Open each device the check names and read its network page. What did you move or change that it depended on?"; },
    rung2: function () { return "A technician leaves a house better than they found it, never worse. Before you move a cable that works, know what it carries."; }
  }],
  solve(v, sim) {
    const ip = sim.net.prefix + ".5";
    return [{ t: "place", dev: "switch", room: "office" }, { t: "place", dev: "pc", room: "office" }, { t: "place", dev: "printer", room: "office" },
      { t: "lay", a: E("router", "LAN 1"), b: E("switch", "1") }, { t: "lay", a: E("switch", "2"), b: E("pc", "NIC") }, { t: "lay", a: E("switch", "3"), b: E("printer", "NET") },
      { t: "client", dev: "printer", values: { mode: "static", ip: ip, mask: sim.d.router.lan.mask, gw: sim.d.router.lan.ip } }, { t: "pcprinter", ip: ip }];
  },
  answer(v, sim) {
    const r = sim.d.router;
    return ["Place the switch, the PC and the printer in the office.", "One run through the wall: a router LAN port to the switch. Then the PC and the printer to the switch (short runs inside the office).",
      "The printer's Control panel: Manual, an address on " + sim.net.prefix + ".x outside the router's range (" + r.dhcp.start + " to " + r.dhcp.end + "), for example " + sim.net.prefix + ".5, mask " + r.lan.mask + ", gateway " + r.lan.ip + ". (Or leave it on DHCP and reserve its address on the router's DHCP clients page, then restart the printer.)",
      "The office PC's Printers tab: the printer port set to that address. Print a test page."];
  },
  summary(v, sim) {
    const f = sim.d.printer.ifaces[0];
    return ["A switch in the office shares the one run through the wall between the PC and the printer.",
      f.cfg.mode === "static" ? "The printer has a fixed address, " + f.cfg.ip + ", outside the router's DHCP range, so nothing else can ever be given it." : "The printer's address, " + sim.addr("printer").ip + ", is reserved for it on the router, so it gets the same one every time.",
      "The office PC prints to that address, today and every day after.",
      "The TV, the phone and the laptop work as they did."];
  }
};

/* ---------------------------------------------------------------- the house after J1 and J2 */
const J2_START = [{ t: "place", dev: "router", room: "living" }, { t: "place", dev: "tv", room: "living" }, { t: "lay", a: E("modem", "ETH"), b: E("router", "WAN") }, { t: "lay", a: E("router", "LAN 2"), b: E("tv", "LAN") }];
function afterJ2(seed, devices, rooms) {
  const f = factory(seed, ["switch", "pc", "printer", "tv"].concat(devices), Object.assign({ laptop: "kitchen", phone: "living" }, rooms || {}));
  const sim = new Sim(f.net), v = { home: f.home, surname: surname(f.net) };
  settle(sim, f.home, J2_START);
  for (const a of J2.solve(v, sim)) sim.apply(a);   /* the home office as J2 left it: switch, PC, printer fixed and printing */
  return { sim: sim, v: v, net: f.net };
}
/* the lines of a later job that ask for everything that worked to keep working */
function keepCauses(sim, extra) {
  if (!sim.wanUp()) return routerCauses(sim);
  const down = firstDown(sim, [["tv", function (s) { return wiredCauses(s, "tv", "living"); }], ["pc", function (s) { return wiredCauses(s, "pc", "office"); }], ["phone", wifiCauses], ["laptop", wifiCauses]].filter(function (x) { return !extra || extra.indexOf(x[0]) < 0; }));
  if (down.some(function (c) { return c.on; })) return down;
  return extra && extra.indexOf("print") >= 0 ? down : printCauses(sim);
}
const L_KEEP = function (skip, what) {
  return {
    id: "keep", text: "Everything that worked before still works: " + what,
    causes: function (sim) { return keepCauses(sim, skip); },
    ok: function () { return cap(what) + ": all still working."; },
    rung1: function () { return "Open each device the check names and read its network page. What did you move or change that it depended on?"; },
    rung2: function () { return "A technician leaves a house better than they found it, never worse. Before you move a cable that works, know what it carries."; }
  };
};

/* ---------------------------------------------------------------- J3 */
function cameraCauses(sim) {
  const x = sim.d.camera, c = sim.cableAt("camera", "LAN"), far = c && (c.a.dev === "camera" ? c.b : c.a), inj = far && sim.d[far.dev];
  const isInj = !!inj && inj.kind === "injector" && far.port === "PoE OUT", a = sim.addr("camera");
  const lan = sim.on("router") && sim.domain(sim.homeNode("camera")).has("router:lan");
  return [
    C("box", x.boxed, "The camera is still in its box", "It's out of its box, on its mount.", "The camera is still in its box."),
    C("cable", !c, "Nothing is plugged into the camera", "Its port has a cable in it.", "The camera is dark: nothing is plugged into it."),
    C("poe", c && !isInj, "Its cable doesn't come from a PoE injector's PoE OUT, so no power comes down it", "Its cable comes from an injector's PoE OUT.", "The camera is dark: no power comes down its cable."),
    C("plug", isInj && !inj.power, "The injector's own power adapter isn't plugged in", "The injector is plugged in.", "The camera is dark, and so is the injector's Power light."),
    C("data", isInj && !sim.cableAt(far.dev, "DATA IN"), "Nothing joins the injector's DATA IN to the network", "The injector's DATA IN is cabled.", "The camera has power (its light is on), but no link to the network."),
    C("lan", !lan, "The injector's DATA IN doesn't lead to the router's house side", "It leads to the router's house side.", "The camera has power and a link, but no address came: " + (a && a.kind === "apipa" ? "it gave itself " + a.ip + "." : "nothing answers at the router's address.")),
    C("addr", !a || a.kind === "apipa", "No address came from the router", "It has an address from the router.", "The camera has power, but no address.")
  ];
}
function awayCauses(sim) {
  const a = sim.addr("camera"), f = sim.d.router.forwards.find(function (x) { return +x.ext === 8443; }), o = sim.outside(8443);
  return [
    C("cam", !a || a.kind === "apipa", "The camera isn't on the network yet", "The camera is on the network.", "The camera isn't on the network yet."),
    C("wan", !sim.wanUp(), "The router isn't online", "The router is online.", "The router has no internet."),
    C("none", !f, "Nothing comes in from outside on port 8443", "The router forwards port 8443.", "The camera app on mobile data can't connect: the router lets nothing in on port 8443."),
    C("where", f && f.ip !== a.ip, "Port 8443 is forwarded to an address that isn't the camera's", "Port 8443 goes to the camera's address.", "The camera app on mobile data can't connect: " + (o.why === "nobody" ? "nothing answered." : "the connection was refused.")),
    C("port", f && f.port !== 443, "Port 8443 reaches the camera, but not the port its app uses", "It reaches the camera's app port.", "The camera app on mobile data connects to something, but gets no picture.")
  ];
}
const J3 = {
  id: "J3", title: "The porch camera, powered over its cable",
  already: ["keep"],   /* lines met before any work: the job is not to break them */
  start(seed) {
    const b = afterJ2(seed, ["camera", "injector"]), d = b.net.devices, heat = rng(hash("J3:" + seed))() < 0.5;
    d.injector.label = "PoE injector (802.3af)"; d.injector.std = "af"; d.injector.power = true;
    d.injector2 = Object.assign(JSON.parse(JSON.stringify(d.injector)), { id: "injector2", label: "PoE+ injector (802.3at)", sub: "802.3at", std: "at", boxed: true });
    b.net.rooms.injector2 = "office";
    d.camera.draw = heat ? 25.5 : 6.5; d.camera.sub = "DHCP";
    b.v.heat = heat;
    return { sim: b.sim, v: b.v };
  },
  brief(v) { return { quote: "I want a camera by the front door, and I want to see it on my phone when I'm away, at work or on holiday. " + (v.heat ? "I bought the one with a heater in it, for the winters here; the box is on the hall table. " : "The box is on the hall table. ") + "There's no power socket out on the porch, and I'm not having one put in.", from: "a camera for the porch" }; },
  mason: "Read every label before you lay a cable. The power has to come down the same cable as the network.",
  limits: function (v) { return ["The camera's box says: " + (v.heat ? "PoE+ (IEEE 802.3at), up to 25.5 W with its heater on." : "PoE (IEEE 802.3af), up to 6.5 W."), "In the van: an 802.3af PoE injector (15.4 W out) and an 802.3at PoE+ injector (30 W out).", "No power socket on the porch. A copper run is 100 m at most: each run's length shows as you lay it.", "No budget limit: use what the job needs."]; },
  reqs: [{
    id: "cam", text: "The camera on the porch, powered over its cable, on the network",
    causes: function (sim) { return cameraCauses(sim).concat([C("wan", !sim.wanUp(), "The router itself isn't online", "The router is online.", "The camera has an address, but the router has no internet.")]); },
    ok: function (sim) { return "The camera is on the porch, powered over its cable, at " + sim.addr("camera").ip + "."; },
    rung1: function () { return "Open the camera's Web page and its Physical tab, then follow its cable back: what is at the other end, and which of its ports is it in?"; },
    rung2: function () { return "Power over Ethernet comes from the PSE end: a PoE switch, or an injector between an ordinary switch and the device. The injector's DATA IN takes the network; its PoE OUT sends the network and the power on to the device."; }
  }, {
    id: "power", text: "Enough power for everything the camera does, night vision and all",
    causes: function (sim, v) { return [C("off", !sim.on("camera"), "The camera isn't powered yet", "It's powered.", "The camera isn't powered yet."), C("short", sim.poeShort("camera"), "The injector gives less power than the camera can draw", "The injector gives it all it can draw.", "The camera's page says its power is limited: the heater and night vision are off.")]; },
    ok: function (sim) { return "The camera runs on full power from the " + (sim.poeSource("camera").std === "at" ? "802.3at PoE+" : "802.3af PoE") + " injector."; },
    rung1: function () { return "Compare two labels: the camera's box (in the limits) and the injector's (its Physical tab). Then read the Power line on the camera's Web page."; },
    rung2: function () { return "Every PoE device has a power class. An 802.3af injector delivers about 13 W to the device; an 802.3at (PoE+) one about 25.5 W. A device that needs more than it gets may start, with its hungriest parts switched off."; }
  }, {
    id: "fixed", text: "The camera's address never changes",
    causes: function (sim) { return fixedCauses(sim, "camera", cameraCauses(sim)); },
    ok: function (sim) { const f = sim.d.camera.ifaces[0]; return f.cfg.mode === "static" ? "The camera is fixed at " + f.cfg.ip + ", outside the range the router hands out." : "The router always gives the camera " + sim.addr("camera").ip + ": it's reserved for its hardware address."; },
    rung1: function () { return "Compare the camera's Web page with the router's DHCP clients page and its LAN & DHCP page."; },
    rung2: function () { return "Anything that has to be found at the same address every time (a camera the router forwards to, a printer) needs an address that never moves: reserved for it on the router, or set by hand outside the range the router hands out."; }
  }, {
    id: "away", text: "The client can see the camera from away: the camera app on the phone, over mobile data",
    causes: awayCauses,
    ok: function (sim) { const o = sim.outside(8443); return "Port 8443 from outside reaches the camera at " + o.target + ": the camera app on mobile data shows the porch."; },
    rung1: function () { return "Read the camera's Web page (how its app connects), then the router's Port forwarding page. Try the camera app on the phone, on mobile data."; },
    rung2: function () { return "From the internet, only the router's public address can be reached. A port forward tells the router which device, and which port on it, gets the connections that arrive on an outside port. It only keeps working if that device's address doesn't change."; }
  }, L_KEEP(null, "the internet, the TV, the office PC and its printer, the phone and the laptop")],
  solve(v, sim) {
    const inj = v.heat ? "injector2" : "injector", r = sim.d.router, ip = sim.net.prefix + "." + (+r.dhcp.end.split(".")[3] - 1);
    return [{ t: "place", dev: inj, room: "office" }, { t: "place", dev: "camera", room: "porch" },
      { t: "lay", a: E("switch", "4"), b: E(inj, "DATA IN") }, { t: "lay", a: E(inj, "PoE OUT"), b: E("camera", "LAN") },
      { t: "router", page: "reservation-add", values: { name: "IP camera", mac: sim.d.camera.ifaces[0].mac, ip: ip } }, { t: "power", dev: "camera" },
      { t: "router", page: "forward-add", values: { name: "Camera", ext: "8443", ip: ip, port: "443" } }];
  },
  answer(v, sim) {
    return ["Read the camera's box: " + (v.heat ? "it needs 802.3at (PoE+): up to 25.5 W. The 802.3af injector would start it with no heater and no night vision; use the PoE+ injector." : "802.3af is enough (up to 6.5 W): either injector works."),
      "Place the injector in the office by the switch, and the camera on the porch (its mount is fixed). A free switch port to the injector's DATA IN; the injector's PoE OUT to the camera (38 m, under 100 m).",
      "Fix the camera's address: on the router's DHCP clients page, reserve one for its hardware address, then restart the camera (its Physical tab) so it asks again. Or set it by hand outside the range.",
      "On the router's Port forwarding page: outside port 8443 to the camera's address, port 443 (the camera's Web page says so). Test it with the phone's camera app on mobile data."];
  },
  summary(v, sim) {
    return ["The camera on the porch takes its power and its network down one cable, from the " + (sim.poeSource("camera").std === "at" ? "802.3at PoE+" : "802.3af PoE") + " injector in the office" + (v.heat ? ": enough for its heater and night vision." : "."),
      "Its address never changes, so the forward to it keeps working after every power cut.",
      "Port 8443 from the internet reaches the camera's port 443: the client sees the porch from anywhere.",
      "Everything that worked before still works."];
  }
};

/* ---------------------------------------------------------------- J4 */
function bedroomCauses(sim) {
  const l = sim.wifiLink("laptop");
  const list = wifiCauses(sim, "laptop");
  if (list.some(function (c) { return c.on; })) return list;
  return list.concat([C("weak", l.signal < 45, "The signal in the back bedroom is too weak for video calls", "The signal there is strong.", "Laptop in the back bedroom: on " + l.ap.ssid + " at " + l.signal + "% (" + (l.band === 5 ? "5 GHz" : "2.4 GHz") + "), from the " + (l.ap.id === "mesh" ? "mesh node" : "router") + " in " + IN[l.ap.room] + ". Video calls break up below about 45%.")]);
}
function meshCauses(sim) {
  const m = sim.d.mesh, ml = sim.meshLink(), cabled = sim.cablesOf("mesh").length > 0;
  return [
    C("box", m.boxed, "The mesh node is still in its box", "It's out of its box.", "The mesh node is still in its box."),
    C("wire", cabled && !ml.ok, "The mesh node's cable doesn't lead to the router's house side", "Its cable leads to the router's house side.", "The mesh node's status ring is amber, and its cable doesn't lead back to the router's house side."),
    C("weak", !ml.ok, "The mesh node is too far from the router for its wireless link", "Its wireless link to the router is strong.", "The mesh node's status ring is amber: its link back to the router is lost.")
  ];
}
const J4 = {
  id: "J4", title: "Wi-Fi to every room",
  already: ["keep"],   /* lines met before any work: the job is not to break them */
  start(seed) {
    const b = afterJ2(seed, ["mesh"], { laptop: "upstairs" });
    b.net.devices.laptop.label = "Laptop"; b.net.devices.mesh.sub = "mesh node";
    return { sim: b.sim, v: b.v };
  },
  brief(v) { return { quote: "My son's laptop has moved up to the back bedroom and his video calls keep breaking up. The Wi-Fi works everywhere downstairs. I bought a mesh node, it's still in the box. Can you sort it out so it reaches him?", from: "the Wi-Fi upstairs" }; },
  mason: "Look at what the laptop sees before you place anything. A mesh node is only as good as its own link back to the router.",
  limits: function () { return ["One mesh node, in its box. It joins the router's network by itself once it's set up and powered.", "A copper run is 100 m at most: each run's length shows as you lay it.", "No budget limit: use what the job needs."]; },
  reqs: [{
    id: "bedroom", text: "Video calls in the back bedroom upstairs: the laptop there on a strong Wi-Fi signal",
    causes: bedroomCauses,
    ok: function (sim) { const l = sim.wifiLink("laptop"); return "Laptop in the back bedroom: " + l.signal + "% (" + (l.band === 5 ? "5 GHz" : "2.4 GHz") + "), from the " + (l.ap.id === "mesh" ? "mesh node" : "router") + ". Plenty for video calls."; },
    rung1: function () { return "Open the laptop's Wi-Fi tab (signal, band, channel), then the mesh node's Status page. Look at the house plan: which rooms are near the back bedroom?"; },
    rung2: function () { return "Wi-Fi weakens with every wall, floor and metre, and 5 GHz weakens faster than 2.4 GHz. An extra access point helps the room it's near, if it can still reach the router."; }
  }, {
    id: "mesh", text: "The mesh node set up, with a good link back to the router",
    causes: meshCauses,
    ok: function (sim) { const ml = sim.meshLink(); return "The mesh node's link back to the router is " + (ml.kind === "wired" ? "a cable (wired backhaul)." : "strong: the router's 5 GHz signal there is " + ml.signal + "%."); },
    rung1: function () { return "Open the mesh node's Status page and its Physical tab: what does it say about its backhaul, and what colour is its status ring?"; },
    rung2: function () { return "A mesh node repeats the router's Wi-Fi, so it needs its own good link back (the backhaul): a cable to the router's house side, or a strong 5 GHz signal. Halfway between the router and the dead spot is the classic place."; }
  }, L_KEEP(["laptop"], "the internet, the TV, the office PC and its printer, and the phone")],
  solve() { return [{ t: "place", dev: "mesh", room: "landing" }]; },
  answer() {
    return ["The laptop upstairs gets about 44% from the router downstairs: not enough. The mesh node goes between them.",
      "Either: place the mesh node on the landing at the top of the stairs (the router's 5 GHz reaches it at 56%, and it reaches the bedroom at 80%).",
      "Or: place it in the back bedroom and give it a wired backhaul, a cable from a free router LAN port to its WAN port (15 m). In the bedroom with no cable its link is lost (24%)."];
  },
  summary(v, sim) {
    const ml = sim.meshLink(), l = sim.wifiLink("laptop");
    return ["The mesh node is " + (ml.kind === "wired" ? "wired back to the router (wired backhaul)" : "on " + IN[sim.net.rooms.mesh] + ", with a strong wireless link back to the router (" + ml.signal + "%)") + ".",
      "The laptop in the back bedroom now gets " + l.signal + "%: video calls hold.",
      "Everything that worked before still works."];
  }
};

/* ---------------------------------------------------------------- J5 */
function guestNetCauses(sim) {
  const r = sim.d.router, g = r.guest;
  return [
    C("off", !g.on, "The router's guest network isn't switched on", "It's on.", "The router has no guest network: visitors would have to be given the home network's password."),
    C("open", g.sec === "Open", "The guest network has no password", "It has a password of its own.", "The guest network " + (g.ssid ? g.ssid + " " : "") + "is open: anyone in range can join it, no password asked.")
  ];
}
function visitorCauses(sim) {
  const g = sim.d.router.guest, f = sim.d.guest.ifaces[0], l = sim.wifiLink("guest"), a = sim.addr("guest");
  const onHome = l && l.connected && l.ap.node === "router:lan";
  return [
    C("net", !g.on, "There's no guest network for the visitor to join", "The guest network is on.", "There's no guest network to join yet."),
    C("home", onHome, "The visitor's phone is on the home network", "It isn't on the home network.", "The visitor's phone is on " + sim.d.router.wifi.ssid + ", the house's own network."),
    C("join", !(l && l.connected && l.ap.node === "router:guest"), "The visitor's phone hasn't joined the guest network", "It's on the guest network.", "The visitor's phone: " + (l && l.reason === "auth" ? "can't join " + l.ap.ssid + ": the password it has is old." : "not on the guest network.")),
    C("addr", !a || a.kind === "apipa", "No address came from the guest network", "It has an address from the guest network.", "The visitor's phone is on the guest network, but no address came."),
    C("wan", !sim.route("guest", PUBLIC).internet, "The router isn't online", "The router is online.", "The visitor's phone is on the guest network, but has no internet.")
  ];
}
function apartCauses(sim) {
  const g = sim.d.router.guest, l = sim.wifiLink("guest");
  const onGuest = !!(l && l.connected && l.ap.node === "router:guest" && sim.addr("guest"));
  const see = ["pc", "printer"].filter(function (id) { const a = sim.addr(id); return a && sim.route("guest", a.ip).local; });
  return [
    C("visitor", !onGuest, "The visitor's phone isn't on the guest network yet", "It's on the guest network.", "Can't be checked yet: the visitor's phone isn't on the guest network."),
    C("iso", see.length > 0, "Guests can reach the house's own devices", "Guests can't reach them.", "From the visitor's phone the house's " + see.map(function (id) { return NAME[id]; }).join(" and the ") + " answer" + (see.length === 1 ? "s" : "") + ": guests can reach the home network.")
  ];
}
function ownCauses(sim) {
  const on = ["phone", "laptop"].filter(function (id) { const l = sim.wifiLink(id); return l && l.connected && l.ap.node === "router:guest"; });
  if (on.length) return [C("guest", true, "One of the house's own devices is on the guest network", "They're all on the home network.", "The house's " + on.map(function (id) { return NAME[id]; }).join(" and ") + " " + (on.length === 1 ? "is" : "are") + " on the guest network: cut off from the printer and the rest of the house.")];
  return keepCauses(sim);
}
const J5 = {
  id: "J5", title: "A guest Wi-Fi kept apart",
  already: ["keep"],   /* lines met before any work: the job is not to break them */
  start(seed) {
    const b = afterJ2(seed, [], {}), d = b.net.devices;
    d.guest = { id: "guest", kind: "phone", label: "Visitor's phone", sub: "Wi-Fi", on: true,
      ifaces: [{ name: "Wi-Fi", type: "wifi", mac: "02-6a-" + (1000 + seed % 9000).toString(16).padStart(4, "0").replace(/(..)(..)/, "$1-$2") + "-5e-71", bands: [24, 5], saved: { ssid: null, passOk: false }, cfg: { mode: "dhcp" }, lease: null, apipa: null }] };
    b.net.rooms.guest = "kitchen"; b.sim.arp.guest = {};
    return { sim: b.sim, v: b.v };
  },
  brief() { return { quote: "We have visitors all the time, and I give them the Wi-Fi password. My son says that's how his friend printed rubbish on our printer from the driveway. I want visitors to have their own Wi-Fi, with its own password, that gets them the internet and nothing else. One of them is here now, in the kitchen.", from: "a guest Wi-Fi" }; },
  mason: "Two networks, one router. Decide what each one is allowed to reach before you switch anything on.",
  limits: function () { return ["The router has a guest network, off as it comes from the box. Its guests get addresses on a subnet of their own.", "The home network keeps its name and password: the house's own devices stay on it.", "No budget limit: use what the job needs."]; },
  reqs: [{
    id: "guestnet", text: "A guest Wi-Fi with a name and a password of its own",
    causes: guestNetCauses,
    ok: function (sim) { return "The guest network " + sim.d.router.guest.ssid + " is on, with a password of its own."; },
    rung1: function () { return "Open the router's Wi-Fi page and read all of it, down to the bottom."; },
    rung2: function () { return "A guest network is a second network on the same router: its own name, its own password, its own subnet. Visitors get that password, never the home network's."; }
  }, {
    id: "visitor", text: "The visitor's phone online, on the guest Wi-Fi",
    causes: visitorCauses,
    ok: function (sim) { return "The visitor's phone is on " + sim.d.router.guest.ssid + " with " + sim.addr("guest").ip + ", and online."; },
    rung1: function () { return "Open the visitor's phone: which networks does it see, and which is it on? Compare its address with the router's guest network."; },
    rung2: function () { return "A device joins the network whose name and password it's given. Give a visitor the home network's password, and they're on the home network, guest network or not."; }
  }, {
    id: "apart", text: "Guests get the internet and nothing else: none of the house's devices answer them",
    causes: apartCauses,
    ok: function () { return "From the visitor's phone the office PC and the printer don't answer: the guest network reaches the internet only."; },
    rung1: function () { return "Read the guest network's settings on the router's Wi-Fi page, and the visitor's address beside the printer's."; },
    rung2: function () { return "Segmentation keeps devices that don't trust each other apart. A guest network's isolation lets guests out to the internet while the router drops anything they send towards the home network."; }
  }, {
    id: "keep", text: "The house's own devices stay on the home network, and everything still works",
    causes: ownCauses,
    ok: function () { return "The phone and the laptop are on the home network; the TV, the office PC and its printer all work."; },
    rung1: function () { return "Open the house's own phone and laptop: which network is each on?"; },
    rung2: function () { return "A household device on the guest network is cut off from the printer and the rest of the house: isolation works both ways."; }
  }],
  solve(v, sim) { return [{ t: "router", page: "guest", values: { on: true, ssid: v.surname.toUpperCase() + "-GUEST", isolate: true } }, { t: "router", page: "guest", values: { newPassword: true } }, { t: "join", dev: "guest", ssid: v.surname.toUpperCase() + "-GUEST" }]; },
  answer(v) {
    return ["On the router's Wi-Fi page, Guest network: On, a name of its own (for example " + v.surname.toUpperCase() + "-GUEST), \"Keep guests off the home network\" ticked, Save. Then Set a guest password.",
      "On the visitor's phone (its Wi-Fi page, the networks list): connect to the guest network, not the home one.",
      "Check from the visitor's phone that the printer doesn't answer; leave the house's own phone and laptop on the home network."];
  },
  summary(v, sim) {
    const g = sim.d.router.guest;
    return ["The router runs a second network, " + g.ssid + ", with a password of its own, on its own subnet (" + g.lan.ip.replace(/\.\d+$/, ".x") + ").",
      "Guests get the internet and nothing else: the router keeps them off the home network.",
      "The house's own devices stay on " + sim.d.router.wifi.ssid + "."];
  }
};

/* ---------------------------------------------------------------- free build */
/* no work order: whatever the student builds, the network checks its health */
const LIVE = ["router", "switch", "pc", "printer", "tv", "injector", "injector2", "camera", "mesh"];
function healthCauses(sim) {
  const set = LIVE.filter(function (id) { return placed(sim, id); });
  const list = [C("none", set.length === 0, "Nothing is set up yet", "Devices are set up.", "Nothing is out of its box yet: the house has only the modem.")];
  if (!placed(sim, "router")) return list.concat([C("router", true, "Nothing hands out addresses: the router is still in its box", "The router is set up.", "The router is still in its box: nothing set up can get an address or reach the internet.")]);
  const order = [["router", routerCauses]].concat(["pc", "printer", "tv"].filter(function (id) { return placed(sim, id); }).map(function (id) { return [id, function (s) { return wiredCauses(s, id); }]; }));
  if (placed(sim, "camera")) order.push(["camera", function (s) { return cameraCauses(s).concat([C("wan", !s.wanUp(), "The router itself isn't online", "The router is online.", "The camera has an address, but the router has no internet.")]); }]);
  for (const it of order) { const c = it[1](sim, it[0]); if (c.some(function (x) { return x.on; })) return list.concat(c); }
  if (placed(sim, "mesh") && !sim.meshLink().ok) return list.concat(meshCauses(sim));
  return list.concat(firstDown(sim, [["phone", wifiCauses], ["laptop", wifiCauses]]));
}
function clashCauses(sim) {
  const seen = {}, clash = [];
  for (const id of Object.keys(sim.d)) { const a = sim.addr(id); if (!a || a.kind === "apipa" || id === "router") continue; if (seen[a.ip] && sim.domain(sim.homeNode(id)).has(seen[a.ip])) clash.push([seen[a.ip], id, a.ip]); else seen[a.ip] = id; }
  const r = sim.d.router, onRouter = Object.keys(sim.d).filter(function (id) { const f = sim.d[id].ifaces && sim.d[id].ifaces[0]; return f && f.cfg.mode === "static" && f.cfg.ip === r.lan.ip && placed(sim, id); });
  return [C("none", !LIVE.some(function (id) { return placed(sim, id); }), "Nothing is set up yet", "Devices are set up.", "Nothing is set up yet."), C("clash", clash.length > 0 || onRouter.length > 0, "Two devices have the same address", "Every address is used once.", clash.length ? "The " + NAME[clash[0][0]] + " and the " + NAME[clash[0][1]] + " both answer at " + clash[0][2] + "." : onRouter.length ? "The " + NAME[onRouter[0]] + " is set to the router's own address." : "")];
}
function hardenedCauses(sim) {
  const r = sim.d.router;
  return [C("box", r.boxed, "The router is still in its box", "It's out of its box.", "The router is still in its box.")].concat(L_WIFISEC.causes(sim).slice(1), L_ADMIN.causes(sim).slice(1));
}
function runsCauses(sim) {
  const runs = sim.net.cables.filter(function (c) { return c.kind !== "coax"; });
  const long = runs.find(function (c) { return c.length > 100; }), dead = runs.find(function (c) { return !sim.cableUp(c); });
  return [
    C("none", runs.length === 0, "No cables laid yet", "Cables are laid.", "No cables are laid yet."),
    C("long", !!long, "A run is longer than copper Ethernet can carry", "Every run is 100 m or less.", long ? "The run from the " + NAME[long.a.dev] + " to the " + NAME[long.b.dev] + " is " + long.length + " m: over 100 m there's no link." : ""),
    C("dead", !!dead, "A cable has no link", "Every cable has a link.", dead ? "The cable from the " + NAME[dead.a.dev] + " to the " + NAME[dead.b.dev] + " has no link." : "")
  ];
}
const FB = {
  id: "FB", title: "Free build: an empty house, every device in the van", free: true,
  start(seed) {
    const f = factory(seed, ["switch", "pc", "printer", "tv", "camera", "injector", "mesh"], { laptop: "kitchen", phone: "living" }), d = f.net.devices;
    d.injector.label = "PoE injector (802.3af)"; d.injector.power = true;
    d.injector2 = Object.assign(JSON.parse(JSON.stringify(d.injector)), { id: "injector2", label: "PoE+ injector (802.3at)", sub: "802.3at", std: "at", boxed: true }); f.net.rooms.injector2 = "office";
    d.camera.draw = 6.5;
    const sim = new Sim(f.net); sim.boot();
    return { sim: sim, v: { home: f.home, surname: surname(f.net) } };
  },
  brief() { return { quote: "No client on this one: the house is yours. Everything's in the van. Build the network you'd want, then check it.", from: "free build" }; },
  mason: "Build it the way you would for a client, then let the network tell you how it stands.",
  limits: function () { return ["Every device in the van: router, switch, PC, printer, TV, camera, both PoE injectors, a mesh node. Use any of them, in any room.", "The modem stays by the living-room outlet. A copper run is 100 m at most.", "No budget limit. Check as often as you like: the check tests whatever you've built."]; },
  reqs: [{
    id: "online", text: "Every device you've set up is online",
    causes: healthCauses,
    ok: function (sim) { const n = LIVE.filter(function (id) { return placed(sim, id); }).length; return n + " device" + (n === 1 ? "" : "s") + " set up, and everything that should be online is."; },
    rung1: function () { return "Open the device the check names: its own page, its Physical tab, and where its cable goes."; },
    rung2: function () { return "Work from the bottom up: power and the cable, then the link, then an address from the router, then the way out to the internet."; }
  }, {
    id: "clash", text: "No two devices share an address",
    causes: clashCauses,
    ok: function () { return "Every address on the network is used once."; },
    rung1: function () { return "Compare the router's DHCP clients page with the settings of every device you gave a fixed address."; },
    rung2: function () { return "An address belongs to one device. Fixed addresses go outside the range the router hands out, and never on the router's own."; }
  }, {
    id: "hardened", text: "The router hardened: its own Wi-Fi name and password, its own admin password",
    causes: hardenedCauses,
    ok: function (sim) { return "The Wi-Fi is " + sim.d.router.wifi.ssid + " with its own password, and the admin password is changed."; },
    rung1: function () { return "Read the router's Status and Wi-Fi pages, and what's printed on its label."; },
    rung2: function () { return "A router's factory name and passwords are printed on it for anyone to read. Change them before anything else."; }
  }, {
    id: "runs", text: "Every cable within 100 m, and every one with a link",
    causes: runsCauses,
    ok: function () { return "Every cable is within 100 m and has a link."; },
    rung1: function () { return "Read the Cable runs list: the length and the link on every row."; },
    rung2: function () { return "A cable with no link is unplugged, broken, too long, or leads to something off or still in its box."; }
  }],
  solve(v) { return J1.solve(v); },   /* one build that passes: J1's (any healthy build does) */
  answer() { return ["There's no one answer: any network whose devices are all online, with no clashing addresses, a hardened router and every cable working, passes."]; },
  summary(v, sim) { const n = LIVE.filter(function (id) { return placed(sim, id); }).length; return ["Your build: " + n + " device" + (n === 1 ? "" : "s") + " set up, every one online, no address used twice, the router hardened, every cable working."]; }
};

/* ---------------------------------------------------------------- the five more (J6 to J10) */
/* J6: the router died; its replacement goes in so every device rejoins by itself */
function sameWifiCauses(sim) {
  const r = sim.d.router, home = sim.net.extra.homeSsid, old = sim.net.extra.oldWifi;
  return [
    C("box", r.boxed, "The new router is still in its box", "It's out of its box.", "The new router is still in its box."),
    C("name", r.wifi.ssid !== home, "The new router's Wi-Fi has a different name from the old one", "It has the old network's name.", "The new router's Wi-Fi is called " + r.wifi.ssid + "; the house's phones and laptops are looking for " + home + "."),
    C("pass", r.wifi.gen !== old, "Its Wi-Fi password isn't the one the house's devices know", "It has the client's password.", "The Wi-Fi is called " + home + " again, but the phone and the laptop can't join: the password isn't the one they know.")
  ];
}
const J6 = {
  id: "J6", title: "The replacement router",
  start(seed) {
    const b = afterJ2(seed, [], {}), sim = b.sim, net = b.net, r = net.devices.router, R = rng(hash("J6:" + seed));
    net.extra.homeSsid = b.v.home; net.extra.oldWifi = r.wifi.gen;
    net.cables = net.cables.filter(function (c) { return c.a.dev !== "router" && c.b.dev !== "router"; });   /* the dead router is gone: its cables are still in the house, unplugged */
    r.boxed = true; r.factorySsid = "ROUTER-" + R.int(4096, 65535).toString(16).toUpperCase(); r.wifi.ssid = r.factorySsid; r.wifi.gen = 1; r.admin = { gen: 1 }; r.leases = []; r.mac = r.mac.replace(/..$/, "7e");
    return { sim: sim, v: b.v };   /* the devices keep the leases they had: back on the same network, they carry on with them or ask again as their links come up */
  },
  brief() { return { quote: "The router died in the storm last night. The shop gave me a new one, still in the box. Can you put it in without me having to set up every phone, laptop and the printer all over again? The Wi-Fi password is on the card on the fridge.", from: "the router died" }; },
  mason: "Every device in this house already knows one network: its name and its password. Make the new router be that network.",
  limits: function () { return ["The new router is a different model: its own factory name and passwords, printed on its label.", "The house's devices stay as they are: nobody re-joins anything by hand.", "No budget limit: use what the job needs."]; },
  reqs: [L_ROUTER, {
    id: "same", text: "The Wi-Fi as it was: the same name and password, so every device rejoins by itself",
    causes: sameWifiCauses,
    ok: function (sim) { return "The Wi-Fi is " + sim.d.router.wifi.ssid + " with the client's own password: the house's devices rejoined by themselves."; },
    rung1: function () { return "Open the phone and the laptop: which network are they looking for, and what do they say about it? Then the new router's Wi-Fi page."; },
    rung2: function () { return "A device rejoins a network it knows: the same name and the same password. A replacement router that matches the old one's name and password is, to every device, the same network."; }
  }, L_KEEP(null, "the internet, the TV, the office PC and its printer, the phone and the laptop"), L_ADMIN],
  solve(v) { return [{ t: "place", dev: "router", room: "living" }, { t: "lay", a: E("modem", "ETH"), b: E("router", "WAN") }, { t: "lay", a: E("router", "LAN 1"), b: E("switch", "1") }, { t: "lay", a: E("router", "LAN 2"), b: E("tv", "LAN") },
    { t: "router", page: "wifi", values: { ssid: v.home } }, { t: "router", page: "wifi", values: { clientPassword: true } }, { t: "router", page: "admin", values: { newPassword: true } }]; },
  answer(v) { return ["Place the new router where the old one was and re-lay its cables: the modem to its INTERNET (WAN) port, a LAN port to the switch and one to the TV.", "On its Wi-Fi page: the old name (" + v.home + "), saved; then type in the client's Wi-Fi password from the card. Don't make a new one: every device would need it.", "Change its admin password (its Status page)."]; },
  summary(v, sim) { return ["The new router took the old network's name and password: to every device it's the same network, so they all rejoined by themselves.", "The printer kept its fixed address, outside the new router's range, and still prints.", "The new router's admin password is changed from its label's."]; }
};

/* J7: a fixed address for the office PC, done right */
function reachCauses(sim) {
  const pc = sim.addr("pc"), lap = sim.addr("laptop"), rt = pc && lap ? sim.route("laptop", pc.ip) : null;
  return [
    C("pc", !pc || pc.kind === "apipa", "The office PC isn't on the network", "The office PC is on the network.", "The office PC isn't on the network."),
    C("lap", !lap || lap.kind === "apipa", "The laptop isn't on the network", "The laptop is on the network.", "The laptop isn't on the network."),
    C("reach", !(rt && rt.local && rt.owner.indexOf("pc") >= 0), "The laptop can't reach the office PC's address", "It reaches it.", "From the laptop, nothing answers at the office PC's address as the office PC.")
  ];
}
const J7 = {
  id: "J7", title: "A fixed address for the office PC",
  already: ["online", "reach", "keep"],   /* lines met before any work: the job is not to break them */
  start(seed) { const b = afterJ2(seed, [], {}); return { sim: b.sim, v: b.v }; },
  brief() { return { quote: "I want to connect to the office computer from my laptop in the kitchen, and the app wants an address that never changes. Can you give the office computer a fixed one? Last time my brother tried, the computer lost the internet.", from: "a fixed address" }; },
  mason: "A fixed address isn't one setting. Think about everything the router used to hand the PC along with its address.",
  limits: function () { return ["The office PC is set up by hand in Windows (Network settings, Edit IP settings).", "No budget limit: use what the job needs."]; },
  reqs: [{
    id: "fixed", text: "The office PC on a fixed address the router will never hand to anything else",
    causes: function (sim) { return fixedCauses(sim, "pc", wiredCauses(sim, "pc", "office").slice(0, 5)); },
    ok: function (sim) { const f = sim.d.pc.ifaces[0]; return f.cfg.mode === "static" ? "The office PC is fixed at " + f.cfg.ip + ", outside the range the router hands out." : "The router always gives the office PC " + sim.addr("pc").ip + ": it's reserved for its hardware address."; },
    rung1: function () { return "Compare the office PC's Network settings with the router's LAN & DHCP page."; },
    rung2: function () { return "A fixed address must be on the router's network, outside the range the router hands out, and used by nothing else. Or reserve one for the device on the router."; }
  }, {
    id: "online", text: "The office PC still reaches the internet, names and all",
    causes: function (sim) { return wiredCauses(sim, "pc", "office"); },
    ok: function (sim) { return "The office PC reaches the internet, and names look up."; },
    rung1: function () { return "On the office PC: ipconfig /all, then ping 203.0.113.80 and a ping by name. Which one fails?"; },
    rung2: function () { return "Set an address by hand and you set everything DHCP used to hand over: the mask, the default gateway (the way out) and the DNS servers (names to numbers). Leave one out and that part stops."; }
  }, {
    id: "reach", text: "The laptop reaches the office PC at its fixed address",
    causes: reachCauses,
    ok: function (sim) { return "The laptop reaches the office PC at " + sim.addr("pc").ip + "."; },
    rung1: function () { return "Compare the office PC's address and mask with the laptop's (ipconfig on each)."; },
    rung2: function () { return "Two devices talk directly only when each sees the other inside its own network: the part of the address the mask covers has to match."; }
  }, L_KEEP(["pc"], "the internet, the TV, the printer, the phone and the laptop")],
  solve(v, sim) { const r = sim.d.router; return [{ t: "client", dev: "pc", values: { mode: "static", ip: sim.net.prefix + ".6", mask: r.lan.mask, gw: r.lan.ip, dns: [r.lan.ip, ""] } }]; },
  answer(v, sim) { const r = sim.d.router; return ["On the office PC, Network settings, Edit IP settings: Manual.", "An address on " + sim.net.prefix + ".x outside the router's range (" + r.dhcp.start + " to " + r.dhcp.end + "), not the printer's, for example " + sim.net.prefix + ".6; mask " + r.lan.mask + "; gateway " + r.lan.ip + "; DNS " + r.lan.ip + " (or the provider's).", "Or leave it automatic and reserve its address on the router."]; },
  summary(v, sim) { const f = sim.d.pc.ifaces[0]; return [f.cfg.mode === "static" ? "The office PC is fixed at " + f.cfg.ip + ", with its mask, gateway and DNS set too." : "The office PC's address is reserved for it on the router.", "It still reaches the internet by name, and the laptop finds it at the same address every time."]; }
};

/* J8: an old laptop that only does 2.4 GHz, in a kitchen full of the neighbours' Wi-Fi */
function speedOf(sim, id) { const l = sim.wifiLink(id); return l && l.connected ? Math.round(Math.min(sim.net.isp.plan * 0.96, l.rate * 0.62 * (1 - l.loss))) : 0; }
const J8 = {
  id: "J8", title: "The old laptop in the kitchen",
  already: ["online", "keep"],   /* lines met before any work: the job is not to break them */
  start(seed) {
    const b = afterJ2(seed, [], {}), net = b.net, R = rng(hash("J8:" + seed)), ch = R.shuffle([1, 6, 11]), L = net.devices.laptop;
    L.label = "Old laptop"; L.ifaces[0].bands = [24]; L.ifaces[0].secs = ["WPA2-Personal"]; L.ifaces[0].desc = "Wireless-N Network Adapter";
    const [clear, autoPick, third] = ch;   /* the router's Auto picks from where the router is: a channel the kitchen hears loud */
    net.neighbours = [
      { ssid: "Parker-Family", ch: autoPick, band: 24, mac: "02-5c-11-a0-3e-01", heard: { kitchen: 72, living: 12, office: 30, upstairs: 10, porch: 40, garage: 20, landing: 10 } },
      { ssid: "Unit-12", ch: third, band: 24, mac: "02-5c-11-a0-3e-02", heard: { kitchen: 55, living: 46, office: 30, upstairs: 15, porch: 25, garage: 30, landing: 20 } },
      { ssid: "HomeNet-7731", ch: clear, band: 24, mac: "02-5c-11-a0-3e-03", heard: { kitchen: 14, living: 64, office: 20, upstairs: 30, porch: 20, garage: 10, landing: 25 } }
    ];
    net.devices.router.wifi.ch24mode = "auto";
    b.sim.dhcp("laptop", "boot");
    b.v.clear = clear; b.v.auto = autoPick;
    return { sim: b.sim, v: b.v };
  },
  brief() { return { quote: "My old laptop lives in the kitchen for recipes and the cooking videos, and the videos keep stopping. The phone's fine in there. It's an old laptop, but it's all I need. I'm not buying a new one.", from: "the old laptop" }; },
  mason: "Look at the air where the laptop is, not where the router is.",
  limits: function () { return ["The old laptop's Wi-Fi only does 2.4 GHz, WPA2.", "The router's 2.4 GHz channel is on Auto, as it came.", "No budget limit, but no new laptop: the client is keeping it."]; },
  reqs: [{
    id: "online", text: "The old laptop online over the Wi-Fi, in the kitchen",
    causes: function (sim) { return wifiCauses(sim, "laptop"); },
    ok: function (sim) { return "The old laptop is on " + sim.d.router.wifi.ssid + " in the kitchen, online."; },
    rung1: function () { return "Open the old laptop's Wi-Fi tab and its Command Prompt (netsh wlan show interfaces)."; },
    rung2: function () { return "A device joins only a network its adapter can use: the band, and the security."; }
  }, {
    id: "fast", text: "Fast enough in the kitchen for cooking videos: 50 Mb/s or more on the old laptop",
    causes: function (sim) { const sp = speedOf(sim, "laptop"); return [C("off", !sp, "The old laptop isn't online", "It's online.", "The old laptop isn't online."), C("slow", sp > 0 && sp < 50, "Its 2.4 GHz channel is crowded in the kitchen", "Its channel is clear there.", "A speed test on the old laptop in the kitchen gets about " + sp + " Mb/s, and its pings to the router lose packets.")]; },
    ok: function (sim) { return "A speed test on the old laptop in the kitchen gets about " + speedOf(sim, "laptop") + " Mb/s."; },
    rung1: function () { return "From the old laptop in the kitchen: netsh wlan show networks mode=bssid. What's on each channel there, and how strong? Then the router's Wi-Fi page."; },
    rung2: function () { return "On 2.4 GHz only channels 1, 6 and 11 don't overlap. A channel that's quiet at the router can be loud where the device is: survey the air at the device, and pick the channel that's clear there."; }
  }, L_KEEP(["laptop"], "the internet, the TV, the office PC and its printer, and the phone")],
  solve(v) { return [{ t: "router", page: "wifi", values: { ch24: String(v.clear) } }]; },
  answer(v) { return ["In the kitchen, on the old laptop: netsh wlan show networks mode=bssid. The router's Auto picked channel " + v.auto + " (quiet at the router), but a neighbour is loud on it in the kitchen.", "On the router's Wi-Fi page set the 2.4 GHz channel by hand to " + v.clear + ", the one that's clear in the kitchen. Run a speed test on the old laptop."]; },
  summary(v, sim) { return ["The router's 2.4 GHz is on channel " + sim.ch24() + ", the one that's clear in the kitchen, chosen from a survey on the old laptop where it's used.", "The old laptop gets about " + speedOf(sim, "laptop") + " Mb/s there: the videos play."]; }
};

/* J9: WPA3 on everything that can, with one old laptop that can't */
function strongCauses(sim) {
  const weak = ["phone", "laptop"].find(function (id) { const l = sim.wifiLink(id), f = sim.d[id].ifaces[0]; return l && l.connected && l.sec !== "WPA3-Personal" && sim.canSec(f, "WPA3-Personal"); });
  const sec = sim.d.router.wifi.sec;
  return [
    C("wpa2", weak && sec === "WPA2-Personal", "The router offers WPA2 and nothing stronger", "The router offers WPA3.", weak ? "The " + NAME[weak] + " connects with WPA2-Personal, though it can use WPA3." : ""),
    C("weak", !!weak, "A device that can use WPA3 is still connecting with WPA2", "Every device uses the strongest security it can.", weak ? "The " + NAME[weak] + " connects with WPA2-Personal, though it can use WPA3." : "")
  ];
}
const J9 = {
  id: "J9", title: "WPA3, with one old laptop",
  already: ["keep"],   /* lines met before any work: the job is not to break them */
  start(seed) { const b = afterJ2(seed, [], {}), L = b.net.devices.laptop; L.label = "Old laptop"; L.ifaces[0].secs = ["WPA2-Personal"]; L.ifaces[0].desc = "Wireless-N Network Adapter"; return { sim: b.sim, v: b.v }; },
  brief() { return { quote: "I read that WPA3 is the safe Wi-Fi now. I want it on everything that can use it. Mind, the laptop is getting on a bit, and it still has to work.", from: "WPA3" }; },
  mason: "Find out what each device can do before you change what the router asks of them.",
  limits: function () { return ["The router offers WPA2, WPA2/WPA3 (transition) and WPA3 on its Wi-Fi page.", "The old laptop stays: no new adapter."]; },
  reqs: [{
    id: "strong", text: "Every Wi-Fi device on the strongest security it can use",
    causes: strongCauses,
    ok: function () { return "The phone connects with WPA3; the old laptop with WPA2, the best it can do."; },
    rung1: function () { return "On the old laptop: netsh wlan show drivers (what it can do) and netsh wlan show interfaces (what it's using). Then the router's Wi-Fi page."; },
    rung2: function () { return "WPA3 only shuts out devices that can't use it; WPA2 only holds back the ones that can. Transition mode offers both, and each device takes the best it can."; }
  }, L_KEEP(null, "the internet, the TV, the office PC and its printer, the phone and the old laptop")],
  solve() { return [{ t: "router", page: "wifi", values: { sec: "WPA2/WPA3-Personal" } }]; },
  answer() { return ["netsh wlan show drivers on the old laptop: WPA2 only. WPA3-only would cut it off; WPA2-only would hold the phone back.", "On the router's Wi-Fi page: Security, WPA2/WPA3-Personal (transition). The phone takes WPA3, the old laptop WPA2."]; },
  summary() { return ["The router offers WPA2 and WPA3 together (transition mode): the phone uses WPA3, the old laptop WPA2, and nothing is cut off."]; }
};

/* J10: moving day: the TV upstairs, the printer to the kitchen, nothing broken */
const J10 = {
  id: "J10", title: "Moving day: the TV and the printer",
  already: ["keep"],   /* lines met before any work: the job is not to break them */
  start(seed) { const b = afterJ2(seed, [], {}); return { sim: b.sim, v: b.v }; },
  brief() { return { quote: "We're turning the office into a nursery. The TV goes up to the back bedroom, and the printer moves down to the kitchen. The office computer stays where it is for now, and it has to still print.", from: "moving day" }; },
  mason: "Moving a device means its cables come out first. Know what each cable carried before you pull it.",
  limits: function () { return ["A device's cables come out before it moves. A copper run is 100 m at most.", "No budget limit: use what the job needs."]; },
  reqs: [L_WIRED("tv", "upstairs"), {
    id: "printer", text: "The printer in the kitchen, still on its fixed address, and the office PC still prints to it",
    causes: function (sim) { return fixedCauses(sim, "printer", wiredCauses(sim, "printer", "kitchen").slice(0, 5)).concat(printCauses(sim)); },
    ok: function (sim) { return "The printer is in the kitchen at " + sim.addr("printer").ip + ", and a test page from the office PC prints."; },
    rung1: function () { return "Open the printer's Control panel and the office PC's Printers tab, and follow the printer's cable."; },
    rung2: function () { return "A device keeps its fixed address wherever it's plugged in on the same network; what changes is the cable. The PC finds it at the same address as before."; }
  }, L_KEEP(["tv", "print"], "the internet, the office PC, the phone and the laptop")],
  solve(v, sim) { return [{ t: "pull", cable: sim.cableAt("tv", "LAN").id }, { t: "place", dev: "tv", room: "upstairs" }, { t: "lay", a: E("router", "LAN 2"), b: E("tv", "LAN") },
    { t: "pull", cable: sim.cableAt("printer", "NET").id }, { t: "place", dev: "printer", room: "kitchen" }, { t: "lay", a: E("router", "LAN 3"), b: E("printer", "NET") }]; },
  answer() { return ["Pull the TV's cable, move the TV to the back bedroom, and lay a run from a router LAN port to it (15 m).", "Pull the printer's cable, move the printer to the kitchen, and lay a run from a free router LAN port to it (10 m). Leave its fixed address alone: the office PC prints to it as before."]; },
  summary() { return ["The TV is wired in the back bedroom; the printer is wired in the kitchen on the same fixed address, so the office PC prints to it without a change."]; }
};

export const JOBS = [J1, J2, J3, J4, J5, J6, J7, J8, J9, J10, FB];
export const JOBS_COMING = [];
