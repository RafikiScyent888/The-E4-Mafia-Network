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
export const NAME = { router: "router", modem: "modem", pc: "office PC", tv: "smart TV", switch: "switch", printer: "printer", phone: "phone", laptop: "laptop", camera: "IP camera", injector: "PoE injector", mesh: "mesh node" };
export const IN = { office: "the office", living: "the living room", kitchen: "the kitchen", garage: "the garage", upstairs: "the back bedroom upstairs", porch: "by the front door" };
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
function printerCauses(sim) {
  const x = sim.d.printer, f = x.ifaces[0], r = sim.d.router, a = sim.addr("printer");
  const base = wiredCauses(sim, "printer", "office").slice(0, 5);   /* in its box, the room, the cable, the link, the house side */
  const res = r.dhcp.reservations.find(function (v) { return v.mac === f.mac; }), st = f.cfg.mode === "static";
  const onNet = st && sameSubnet(f.cfg.ip, r.lan.ip, r.lan.mask) && f.cfg.mask === r.lan.mask;
  const inRange = st && ip2n(f.cfg.ip) >= ip2n(r.dhcp.start) && ip2n(f.cfg.ip) <= ip2n(r.dhcp.end);
  const twins = a ? sim.owners(a.ip, sim.domain(sim.homeNode("printer"))).filter(function (o) { return o !== "printer"; }) : [];
  return base.concat([
    C("float", !st && !res, "The printer takes whatever address the router hands it", "It keeps one address.", "The printer gets its address from the router, with nothing to keep it the same: it can change when its lease runs out."),
    C("stale", !st && res && (!a || a.ip !== res.ip), "The printer hasn't picked up its reserved address yet", "It's using its reserved address.", res ? "The router has " + res.ip + " reserved for the printer, but the printer is still on " + (a ? a.ip : "no address") + ": it hasn't asked for an address since." : ""),
    C("net", st && !onNet, "Its fixed address or mask doesn't fit the router's network", "Its fixed address and mask fit the router's network.", "The printer has fixed settings, but they don't fit the network the router runs."),
    C("range", st && onNet && inRange, "Its fixed address is inside the range the router hands out", "Its fixed address is outside the range the router hands out.", "The printer's fixed address is one the router can also hand to another device."),
    C("twin", st && (f.cfg.ip === r.lan.ip || twins.length > 0), "Another device has the same address", "Nothing else answers at its address.", "Two devices answer at the printer's address.")
  ]);
}
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

export const JOBS = [J1, J2];
export const JOBS_COMING = [
  { id: "J3", title: "The porch camera, powered over its cable" },
  { id: "J4", title: "Wi-Fi to every room" },
  { id: "J5", title: "A guest Wi-Fi kept apart" }
];
