/* Tier 1 home tickets. Each one builds a client's house from the home
   template, plants its fault, and says how to tell the fault is really
   there (exhibits), what fixes it at the source (fixed), and what proves
   the fix (proves). The six options are one right answer and five near
   misses a technician really makes; each wrong one carries the reason it
   is wrong, which Mason only shows at the third rung of help. */
import { makeHome } from "../net/home.js";
import { Sim } from "../net/sim.js";
import { rng, hash, mac, network, broadcast } from "../net/util.js";

const PUBLIC_TEST = "203.0.113.80";
const winDevs = ["pc", "laptop"];
const devName = { pc: "office PC", laptop: "laptop" };

/* ---------------------------------------------------------------- HOME-01 */
const HOME01 = {
  id: "HOME-01", n: "01", tier: "common", title: "The office PC has no internet", priority: 3, due: "4 h",
  build(seed) {
    const net = makeHome(seed), r = rng(hash("HOME-01:" + seed));
    const kind = r.pick(["pc-end", "switch-end", "crushed"]);
    const sim = new Sim(net); sim.boot();
    const c = sim.cable("c-switch-pc");
    if (kind === "pc-end") c.b.seated = false; else if (kind === "switch-end") c.a.seated = false; else c.cond = "crushed";
    return { sim: sim, v: { kind: kind, port: net.ports.pc } };
  },
  brief(v, net) {
    const extra = { "pc-end": "I moved the desk on Sunday to vacuum behind it, if that matters.", "switch-end": "My grandson was tidying the cables on the office shelf yesterday.", "crushed": "It was flaky all week and stopped completely this morning. I've got a new office chair, if that matters." }[v.kind];
    return { quote: "The computer in my office says there's no internet. The laptop and the TV are fine. " + extra };
  },
  mason: "Read the lights before you touch anything.",
  affected: "pc",
  options(v) {
    return [
      { id: "right", right: true, text: "The office PC's patch cable to switch port " + v.port + " is unplugged or broken" },
      { id: "nic", text: "The PC's network adapter is disabled in Windows", why: "A disabled adapter doesn't show up in ipconfig at all. This one shows \"Media disconnected\": it's enabled, with no link." },
      { id: "dhcp", text: "The router's DHCP server is off", why: "With no DHCP the PC would give itself a 169.254 address. It has no address at all, because it has no link." },
      { id: "switch", text: "The switch has failed", why: "The switch's other ports are lit, and the printer works through it." },
      { id: "gw", text: "The office PC has the wrong default gateway", why: "A gateway only matters once there's a link. With \"Media disconnected\" the PC can't even reach its own network." },
      { id: "isp", text: "The internet service is down", why: "The laptop and the TV reach the internet, so the provider and the router are fine." }
    ];
  },
  rung1(v) { return "Start at the office PC: what does Windows say about its network adapter (ipconfig)? Then look at the light on switch port " + v.port + ", the other end of its cable."; },
  rung2() { return "Find the lowest layer that's broken. \"Media disconnected\" and a dark port light are a Layer 1 problem: nothing above it (addresses, gateways, DNS) can work until the physical link does."; },
  fixHints(v) { return ["Go to the cable itself: the office PC's Physical tab, or the switch's Physical tab for port " + v.port + ".", "Look at both ends before you replace anything. Reseat what's loose; if the link stays down with both ends clicked in, test the cable.", "Look at the plug at each end of the PC's cable and read what you find. If both are clicked in and the light stays off, the cable tester shows which pins are open."]; },
  exhibits(sim) { return !sim.hasLink("pc") && !!sim.route("laptop", PUBLIC_TEST).internet && sim.hasLink("tv"); },
  fixed(sim) { const a = sim.addr("pc"); return sim.hasLink("pc") && !!a && a.kind === "dhcp" && !!sim.route("pc", PUBLIC_TEST).internet; },
  proves(f) { return f.cmd === "ping" && f.dev === "pc" && f.beyond; },
  proofText: "a ping from the office PC that gets replies",
  evidence: [
    { id: "ipc", test: function (f) { return f.cmd === "ipconfig" && f.dev === "pc" && f.media === "disconnected"; }, text: function () { return "ipconfig on the office PC: Media disconnected (no link)"; } },
    { id: "lights", test: function (f, v) { return f.page === "switch-lights" && f.ports.some(function (p) { return p.port === v.port && !p.up; }); }, text: function (f, v) { return "Switch lights: port " + v.port + " (office PC) is off; the other used ports are on"; } },
    { id: "laptop", test: function (f) { return f.cmd === "ping" && f.dev === "laptop" && f.ok && f.internet; }, text: function () { return "The laptop reaches the internet: the provider and the router work"; } },
    { id: "settings", test: function (f) { return f.page === "pc-settings" && !f.connected; }, text: function () { return "Network settings on the PC: Ethernet not connected"; } },
    { id: "look", test: function (f) { return f.phys === "look" && f.cable === "c-switch-pc"; }, text: function (f) { return "Looked at the cable at the " + (f.end === "b" ? "PC" : "switch") + " end: " + (f.seated ? (f.cond === "crushed" ? "clicked in, but the jacket is flattened along the run" : "clicked in") : "not plugged in"); } },
    { id: "test", test: function (f) { return f.phys === "test" && f.cable === "c-switch-pc"; }, text: function (f) { return "Cable tester on the PC's cable: " + (f.open.length ? "pins " + f.open.join(", ") + " open" : "all pins pass"); } }
  ],
  summary(v) {
    const cause = { "pc-end": "The PC's patch cable had come out of the PC's network port when the desk was moved.", "switch-end": "The PC's patch cable had been pulled out of switch port " + v.port + " during the tidy-up.", "crushed": "The PC's patch cable was crushed under the new chair's wheels: pins 1, 2, 3 and 6 were open." }[v.kind];
    const fix = v.kind === "crushed" ? "Swapped in a new patch cable (and routed it away from the chair)." : "Plugged the cable back in until it clicked.";
    return { cause: cause, fix: fix };
  }
};

/* ---------------------------------------------------------------- HOME-02 */
const HOME02 = {
  id: "HOME-02", n: "02", tier: "common", title: "New laptop shows 169.254 address", priority: 3, due: "4 h",
  build(seed) {
    const net = makeHome(seed), r = rng(hash("HOME-02:" + seed));
    const who = r.pick(["nephew", "son", "neighbour"]);
    const L = net.devices.laptop; L.label = "New laptop"; L.host = "NEW-LAPTOP"; net.rooms.laptop = "living";
    const sim = new Sim(net); sim.boot(["mesh", "tv", "camera", "phone", "pc"]);
    net.devices.router.dhcp.on = false;                       /* switched off while "sorting out the printer" */
    sim.dhcp("laptop", "join");
    return { sim: sim, v: { who: who } };
  },
  brief(v) {
    const extra = { nephew: "My nephew was in the router settings on Saturday, sorting out the printer.", son: "My son changed some router settings at the weekend so the printer would keep its address.", neighbour: "The neighbour's boy logged into the router on Saturday to help with the printer." }[v.who];
    return { quote: "I've just set up my new laptop. It says it's connected to the Wi-Fi, but nothing will load. Everything else seems fine. " + extra };
  },
  mason: "Start with the device that's complaining: what address did it get?",
  affected: "laptop",
  options(v, sim) {
    const r = sim.d.router, size = r.dhcp.end.split(".").map(Number)[3] - r.dhcp.start.split(".").map(Number)[3] + 1;
    return [
      { id: "right", right: true, text: "The router's DHCP server is turned off, so the new laptop can't get an address" },
      { id: "pool", text: "The router's DHCP range is full: no addresses left", why: "The DHCP clients page shows only " + r.leases.length + " of " + size + " addresses leased: there's plenty of room." },
      { id: "pass", text: "The laptop's saved Wi-Fi password is wrong", why: "A wrong password never connects at all. This laptop is connected: it just gave itself a 169.254 address." },
      { id: "static", text: "The laptop has a static IP address typed in", why: "ipconfig /all shows \"DHCP Enabled: Yes\": it's set to ask for an address." },
      { id: "rogue", text: "A second router is handing out addresses", why: "A rogue DHCP server hands out a working-looking address (like 10.0.0.x) with a gateway. It doesn't leave a 169.254 address with none." },
      { id: "dead", text: "The router has failed", why: "Its pages load, and the TV, phone and office PC still work through it." }
    ];
  },
  rung1() { return "Look at the new laptop's address (ipconfig), then at the router's LAN & DHCP page."; },
  rung2() { return "An address starting 169.254 is one a computer gives itself when no DHCP server answers. The devices that still work got their addresses earlier. Find out why no server answered now."; },
  fixHints() { return ["The setting lives on the router's LAN & DHCP page.", "Turn the service back on and save. Then make the laptop ask again: it won't ask by itself until its next retry.", "Two steps: the router setting, then a renew on the laptop (ipconfig has a switch for it)."]; },
  exhibits(sim) { const a = sim.addr("laptop"), t = sim.addr("tv"); return !!a && a.kind === "apipa" && !!t && t.kind === "dhcp" && !sim.d.router.dhcp.on; },
  fixed(sim) { const a = sim.addr("laptop"); return sim.d.router.dhcp.on && !!a && a.kind === "dhcp" && !!sim.route("laptop", PUBLIC_TEST).internet; },
  proves(f) { return f.cmd === "ping" && f.dev === "laptop" && f.beyond; },
  proofText: "a ping from the new laptop that gets replies",
  evidence: [
    { id: "apipa", test: function (f) { return f.cmd === "ipconfig" && f.dev === "laptop" && f.apipa; }, text: function (f) { return "ipconfig on the new laptop: " + f.ip + " (169.254: it gave itself that) and no default gateway"; } },
    { id: "dhcpyes", test: function (f) { return f.cmd === "ipconfig" && f.sub === "/all" && f.dev === "laptop"; }, text: function () { return "ipconfig /all on the laptop: DHCP Enabled: Yes"; } },
    { id: "renew", test: function (f) { return f.cmd === "ipconfig" && f.sub === "/renew" && f.dev === "laptop" && f.result && f.result !== "lease"; }, text: function () { return "ipconfig /renew on the laptop: unable to contact your DHCP server"; } },
    { id: "off", test: function (f) { return f.page === "router-dhcp" && !f.on; }, text: function () { return "Router LAN & DHCP page: DHCP server Off"; } },
    { id: "clients", test: function (f) { return f.page === "router-clients"; }, text: function (f) { return "Router DHCP clients: " + f.count + " of " + f.size + " addresses leased"; } },
    { id: "wifi", test: function (f) { return f.page === "laptop-wifi" && f.connected; }, text: function () { return "Laptop Wi-Fi: connected"; } }
  ],
  summary() { return { cause: "The router's DHCP server had been switched off at the weekend. Devices that already had addresses kept working; the new laptop got no answer and gave itself a 169.254 address.", fix: "Turned DHCP back on (LAN & DHCP page), saved, then ran ipconfig /renew on the laptop." }; }
};

/* ---------------------------------------------------------------- HOME-03 */
const HOME03 = {
  id: "HOME-03", n: "03", tier: "common", title: "Websites won't load, but Wi-Fi says connected", priority: 3, due: "4 h",
  build(seed) {
    const net = makeHome(seed), r = rng(hash("HOME-03:" + seed));
    const wrong = r.pick(["203.0.113.35", "203.0.113.153", "203.0.113.5"]);
    const who = r.pick(["son", "daughter"]);
    const d = net.devices.router.dhcp; d.dnsMode = "manual"; d.dns = [wrong, ""];
    const sim = new Sim(net); sim.boot();
    return { sim: sim, v: { wrong: wrong, who: who } };
  },
  brief(v) { return { quote: "Websites won't load on the laptop, but the Wi-Fi says it's connected. The TV's apps say there's no internet too. My " + v.who + " changed something in the router last night to \"make the internet faster\". The provider's welcome letter is on the fridge: it lists DNS servers 203.0.113.53 and 203.0.113.54." }; },
  mason: "Is it the road or the map? Test an address by number, then by name.",
  affected: "laptop",
  options() {
    return [
      { id: "right", right: true, text: "The router is handing out the wrong DNS server address" },
      { id: "gw", text: "The laptop's default gateway is wrong", why: "Pinging an internet address by number works, so the gateway is getting packets out." },
      { id: "isp", text: "The provider's internet is down", why: "Pings to internet addresses by number get replies: the internet is up." },
      { id: "wifi", text: "Wi-Fi interference is dropping the connection", why: "Pings come back steadily with no losses: the Wi-Fi link is fine." },
      { id: "proxy", text: "A browser proxy setting is blocking web pages", why: "nslookup fails too, and it doesn't use the browser at all: names aren't being looked up." },
      { id: "cache", text: "A poisoned entry in the laptop's DNS cache", why: "Every name fails, not one site, and nslookup asks the server directly, skipping the cache. The server itself isn't answering." }
    ];
  },
  rung1() { return "Ping an internet address by number (try " + PUBLIC_TEST + "), then look up a name with nslookup. Check which DNS server the laptop was given (ipconfig /all)."; },
  rung2() { return "If numbers work but names don't, the path is fine and name lookup isn't. Compare the DNS server the laptop was given with the provider's."; },
  fixHints() { return ["Where did the laptop get its DNS server from? The router hands it out along with the address (DHCP).", "Correct the DNS server the router hands out (the provider's servers are in the brief, or let the router answer itself), save, then renew on the laptop so it picks up the change.", "Two places: the DNS fields on the router's LAN & DHCP page, then ipconfig /renew on the laptop."]; },
  exhibits(sim) { const a = sim.addr("laptop"); return !!a && !!sim.route("laptop", PUBLIC_TEST).internet && !a.dns.some(function (s) { return sim.dnsServerWorks("laptop", s); }); },
  fixed(sim) {
    const d = sim.d.router.dhcp, a = sim.addr("laptop");
    const handsOut = d.dnsMode === "router" || d.dns.filter(Boolean).some(function (s) { return sim.dnsServerWorks("laptop", s); });
    return handsOut && !!a && a.dns.some(function (s) { return sim.dnsServerWorks("laptop", s); });
  },
  proves(f) { return f.dev === "laptop" && ((f.cmd === "nslookup" && f.ok) || (f.cmd === "ping" && f.byName && f.beyond)); },
  proofText: "a name that looks up on the laptop (nslookup, or ping by name)",
  evidence: [
    { id: "ipok", test: function (f) { return f.cmd === "ping" && f.dev === "laptop" && !f.byName && f.ok && f.internet; }, text: function (f) { return "ping " + f.ip + " (by number) from the laptop: replies, so the path to the internet works"; } },
    { id: "nsfail", test: function (f) { return f.cmd === "nslookup" && f.dev === "laptop" && !f.ok && !f.nx; }, text: function (f) { return "nslookup on the laptop: DNS request timed out (server " + f.server + ")"; } },
    { id: "namefail", test: function (f) { return f.cmd === "ping" && f.dev === "laptop" && f.byName && !f.ok; }, text: function (f) { return "ping " + f.target + " on the laptop: could not find host"; } },
    { id: "dnsall", test: function (f) { return f.cmd === "ipconfig" && f.sub === "/all" && f.dev === "laptop" && f.dns && f.dns.length; }, text: function (f) { return "ipconfig /all on the laptop: DNS server " + f.dns.join(", "); } },
    { id: "router", test: function (f) { return f.page === "router-dhcp" && f.dnsMode === "manual"; }, text: function (f) { return "Router LAN & DHCP page: hands out DNS " + (f.dns.join(", ") || "(blank)"); } },
    { id: "tv", test: function (f) { return f.page === "tv-net" && !f.internet; }, text: function () { return "TV network status: connected, but names don't look up"; } }
  ],
  summary(v) { return { cause: "The router was handing out DNS server " + v.wrong + ", a mistyped copy of the provider's 203.0.113.53. Addresses by number worked; no names could be looked up.", fix: "Corrected the DNS the router hands out (LAN & DHCP page), saved, then renewed the laptop's lease so it picked up the right server." }; }
};

/* ---------------------------------------------------------------- HOME-04 */
const HOME04 = {
  id: "HOME-04", n: "04", tier: "common", title: "Wi-Fi drops in the back bedroom", priority: 3, due: "1 day",
  build(seed) {
    const net = makeHome(seed), r = rng(hash("HOME-04:" + seed));
    const clear = r.pick([1, 11]), busy = clear === 1 ? 11 : 1, side = clear === 1 ? 7 : 5;
    const nb = net.neighbours, five = nb.find(function (x) { return x.band === 5; });
    const names = r.shuffle(["Parker-Family", "Unit-12", "Garcia_WiFi", "HomeNet-7731", "Ochoa-2.4", "TheLodge", "Willow-House", "Corner-Flat"]);
    net.neighbours = [
      { ssid: names[0], ch: 6, band: 24, mac: nb[0].mac, heard: { upstairs: 60, living: 35, office: 30, kitchen: 32, porch: 28 } },
      { ssid: names[1], ch: side, band: 24, mac: nb[1].mac, heard: { upstairs: 50, living: 30, office: 22, kitchen: 26, porch: 20 } },
      { ssid: names[2], ch: busy, band: 24, mac: five.mac.replace(/^02/, "06"), heard: { upstairs: 58, living: 40, office: 36, kitchen: 38, porch: 30 } },
      { ssid: names[3], ch: clear, band: 24, mac: five.mac.replace(/^02/, "0a"), heard: { upstairs: 18, living: 12, office: 10, kitchen: 14, porch: 16 } },
      five
    ];
    const L = net.devices.laptop; L.ifaces[0].bands = [24]; L.label = "Laptop"; L.sub = "Wi-Fi, 2.4 GHz only";
    net.devices.router.wifi.ch24mode = "manual"; net.devices.router.wifi.ch24 = 6;
    const sim = new Sim(net); sim.boot();
    return { sim: sim, v: { clear: clear, busy: busy } };
  },
  brief() { return { quote: "The Wi-Fi keeps dropping on my old laptop in the back bedroom upstairs. Pages stall and video calls freeze. It's like this all day, not just at dinner time, and the Wi-Fi bars look fine. We put a mesh node up there last month." }; },
  mason: "Strong signal and still dropping? Find out who else is on the air.",
  affected: "laptop",
  options(v, sim) {
    const l = sim.wifiLink("laptop");
    return [
      { id: "right", right: true, text: "The 2.4 GHz channel overlaps the neighbours' networks (interference)" },
      { id: "weak", text: "The laptop is too far from the Wi-Fi (weak signal)", why: "The signal is " + (l ? l.signal : 86) + "%: strong. Distance isn't the problem." },
      { id: "micro", text: "The kitchen microwave is interfering", why: "It drops all day, not just when the microwave runs, and the kitchen is downstairs at the other end of the house." },
      { id: "lease", text: "The laptop's DHCP lease keeps expiring", why: "The address stays the same through the drops (ipconfig), and a lease here lasts " + sim.d.router.dhcp.leaseH + " hours." },
      { id: "pass", text: "The Wi-Fi password was changed", why: "A wrong password can't connect at all. This laptop stays connected and just loses packets." },
      { id: "backhaul", text: "The mesh node's link back to the router is failing", why: "The mesh node's status page shows its 5 GHz link to the router is good." }
    ];
  },
  rung1() { return "On the laptop, look at its Wi-Fi details (netsh wlan show interfaces) and at the networks it can hear (netsh wlan show networks mode=bssid)."; },
  rung2() { return "A strong signal that still loses packets points to interference, not distance. On 2.4 GHz, only channels 1, 6 and 11 don't overlap each other."; },
  fixHints() { return ["The router's Wi-Fi page sets the 2.4 GHz channel (the mesh node follows it).", "Pick a channel the neighbours aren't crowding. Of 1, 6 and 11, which one is quiet where the laptop is?", "Read the channel numbers in the list of networks the laptop hears: one of 1 and 11 has a strong neighbour on it; the other is nearly empty."]; },
  exhibits(sim) { const l = sim.wifiLink("laptop"); return !!(l && l.connected && l.band === 24 && l.signal >= 60 && l.loss >= 0.2); },
  fixed(sim) { const l = sim.wifiLink("laptop"); return !!(l && l.connected && l.loss < 0.02) && !!sim.addr("laptop"); },
  proves(f) { return f.cmd === "ping" && f.dev === "laptop" && f.beyond && f.replies === f.sent && f.sent >= 4; },
  proofText: "a ping from the laptop with nothing lost (at least four replies out of four)",
  evidence: [
    { id: "if", test: function (f) { return f.cmd === "netsh-if" && f.connected; }, text: function (f) { return "Laptop Wi-Fi details: signal " + f.signal + "%, " + (f.band === 5 ? "5" : "2.4") + " GHz channel " + f.ch + ", receive rate " + f.rate + " Mb/s"; } },
    { id: "nets", test: function (f) { return f.cmd === "netsh-nets" && f.bssid; }, text: function (f) { return "Networks the laptop hears on 2.4 GHz: " + f.heard.filter(function (h) { return h.band === 24; }).map(function (h) { return h.ssid + " ch " + h.ch + " (" + h.sig + "%)"; }).join(", "); } },
    { id: "loss", test: function (f) { return f.cmd === "ping" && f.dev === "laptop" && f.loss > 0 && f.replies > 0; }, text: function (f) { return "ping from the laptop: " + f.loss + "% lost, with the times jumping around"; } },
    { id: "ip", test: function (f) { return f.cmd === "ipconfig" && f.dev === "laptop" && f.ip && !f.apipa; }, text: function (f) { return "ipconfig on the laptop: " + f.ip + ", the same through the drops"; } },
    { id: "mesh", test: function (f) { return f.page === "mesh-status" && f.backhaul; }, text: function () { return "Mesh node status: its 5 GHz link to the router is good"; } },
    { id: "router", test: function (f) { return f.page === "router-wifi"; }, text: function (f) { return "Router Wi-Fi page: 2.4 GHz on channel " + f.ch24 + (f.mode === "auto" ? " (Auto)" : " (set by hand)"); } }
  ],
  summary(v) { return { cause: "The 2.4 GHz Wi-Fi was set by hand to channel 6, where two neighbours' networks are strong in the back bedroom (one on 6, one overlapping next to it). The old laptop only does 2.4 GHz, so it lost packets all day despite a strong signal.", fix: "Moved the 2.4 GHz channel to " + v.clear + ", the quiet one of 1, 6 and 11 (channel " + v.busy + " has a strong neighbour too)." }; }
};

/* ---------------------------------------------------------------- HOME-05 */
const HOME05 = {
  id: "HOME-05", n: "05", tier: "common", title: "Nothing works: modem ONLINE light off", priority: 2, due: "2 h",
  build(seed) {
    const net = makeHome(seed), r = rng(hash("HOME-05:" + seed));
    const end = r.pick(["b", "a"]);
    net.cables.find(function (c) { return c.id === "c-coax"; })[end].tight = false;
    const sim = new Sim(net); sim.boot();
    return { sim: sim, v: { end: end } };
  },
  brief() { return { quote: "Nothing works: no internet on anything, Wi-Fi or wired. I checked the provider's app on my phone's mobile data and it says there are no outages near me. The painters moved the TV stand on Tuesday." }; },
  mason: "Work from the outside in. Start at the box the provider's cable plugs into.",
  affected: "pc",
  options() {
    return [
      { id: "right", right: true, text: "The coax connection to the cable modem is loose, so the modem can't lock onto the provider's signal" },
      { id: "outage", text: "The provider has an outage", why: "The provider's app says no outages near this address, and the modem isn't even locking onto a signal: that points inside the house." },
      { id: "router", text: "The home router has failed", why: "The router's pages load, and the devices reach each other and the router." },
      { id: "dns", text: "The DNS server is wrong", why: "Pinging an internet address by number fails too: it's not just names." },
      { id: "dead", text: "The cable modem has died and needs replacing", why: "POWER is on and DS is blinking: the modem is alive, searching for a signal it can't find." },
      { id: "wan", text: "The cable between the modem and the router's WAN port is unplugged", why: "The modem's LINK light is on and the router sees its WAN cable: that cable is fine." }
    ];
  },
  rung1() { return "Read the cable modem's lights, then open its status page."; },
  rung2() { return "Work from the outside in: if the modem can't lock onto the provider's signal, nothing behind it reaches the internet. A blinking DS light means it's searching for that signal."; },
  fixHints() { return ["Go to the modem's Physical tab and look at the coax.", "Follow the coax from the wall to the modem. An F-connector has to be screwed on snugly, finger-tight.", "Look at both ends of the coax: one of them turns by hand."]; },
  exhibits(sim) { return !sim.modemSynced() && !!sim.route("pc", sim.d.router.lan.ip).local; },
  fixed(sim) { return sim.modemSynced() && sim.wanUp(); },
  proves(f) { return winDevs.indexOf(f.dev) >= 0 && f.cmd === "ping" && f.beyond && f.internet; },
  proofText: "a ping to an internet address that gets replies, from the PC or the laptop",
  evidence: [
    { id: "lights", test: function (f) { return f.page === "modem-lights"; }, text: function (f) { const L = f.lights; return "Modem lights: POWER " + L.POWER + ", DS " + L.DS + ", US " + L.US + ", ONLINE " + L.ONLINE + ", LINK " + L.LINK; } },
    { id: "status", test: function (f) { return f.page === "modem-status" && !f.synced; }, text: function () { return "Modem status page: downstream not locked; log: SYNC Timing Synchronization failure"; } },
    { id: "router", test: function (f) { return f.page === "router-status" && !f.wan; }, text: function () { return "Router status: WAN disconnected, waiting for the modem (address 0.0.0.0)"; } },
    { id: "gw", test: function (f) { return f.cmd === "ping" && f.ok && f.local; }, text: function (f) { return "ping " + f.ip + " from the " + devName[f.dev] + ": replies (the home network itself works)"; } },
    { id: "out", test: function (f) { return f.cmd === "ping" && f.kind === "net-unreachable"; }, text: function (f) { return "ping " + f.ip + " from the " + devName[f.dev] + ": Destination net unreachable (the router has no way out)"; } },
    { id: "look", test: function (f) { return f.phys === "look" && f.cable === "c-coax"; }, text: function (f) { return "Looked at the coax at the " + (f.end === "b" ? "modem" : "wall") + ": " + (f.seated ? "snug" : "loose, turns by hand"); } }
  ],
  summary(v) { return { cause: "The coax's F-connector at the " + (v.end === "b" ? "modem's CABLE IN" : "wall outlet behind the TV stand") + " had worked loose when the TV stand was moved, so the modem couldn't lock onto the provider's signal (DS blinking, ONLINE off).", fix: "Screwed the F-connector back on finger-tight; the modem locked on, registered, and handed the router its internet address." }; }
};

/* two devices answering for one address */
function conflicts(sim) {
  const dom = sim.domain("router:lan"), seen = {};
  for (const id in sim.d) { const x = sim.d[id]; if (!x.ifaces || !dom.has(id)) continue; const a = sim.addr(id); if (!a || a.kind === "apipa") continue; (seen[a.ip] = seen[a.ip] || []).push(id); }
  return Object.keys(seen).filter(function (ip) { return seen[ip].length > 1; }).map(function (ip) { return { ip: ip, who: seen[ip] }; });
}

/* ---------------------------------------------------------------- HOME-06 */
const HOME06 = {
  id: "HOME-06", n: "06", tier: "harder", title: "The printer keeps disappearing", priority: 3, due: "1 day",
  build(seed) {
    const net = makeHome(seed), start = net.devices.router.dhcp.start;
    const P = net.devices.printer; P.ifaces[0].cfg.ip = start; P.sub = start; net.devices.pc.printer.port = start;   /* the installer's fixed address, inside the range */
    const sim = new Sim(net); sim.boot(["tv", "mesh", "camera", "phone", "laptop", "pc"]);   /* the new TV asked first, and got the same address */
    return { sim: sim, v: { ip: start, tvMac: net.devices.tv.ifaces[0].mac, prMac: P.ifaces[0].mac } };
  },
  brief() { return { quote: "The office printer keeps disappearing. Sometimes it prints, sometimes the computer says it's offline. The installer set the printer up with a fixed address last year, and we got the new smart TV on Saturday." }; },
  mason: "If it works sometimes, find out what's different when it doesn't.",
  affected: "pc",
  options(v, sim) {
    return [
      { id: "right", right: true, text: "The printer's fixed address is inside the router's DHCP range, so the router gave the same address to another device (an IP conflict)" },
      { id: "cable", text: "The printer's network cable is loose", why: "The printer's link light stays on and pings to it never drop, even while test pages fail." },
      { id: "sleep", text: "The printer goes to sleep and drops off the network", why: "A sleeping printer wakes for a print job. And arp -a shows the printer's address answered by a different hardware address from the printer's own." },
      { id: "driver", text: "The PC's printer driver is broken", why: "Some test pages print and some don't, with nothing changed on the PC. A broken driver fails every time." },
      { id: "pool", text: "The router's DHCP range is full", why: "The DHCP clients page shows plenty of free addresses, and the printer doesn't use DHCP anyway." },
      { id: "switch", text: "The switch port for the printer is failing", why: "Its light stays green and steady, and pings to the printer get every reply." }
    ];
  },
  rung1() { return "Print a test page a few times (the PC's Printers tab), then run arp -a on the PC. Compare the hardware address you see for the printer's address with the one on the printer's own control panel."; },
  rung2() { return "One address, one device. If the hardware address answering for the printer's address changes, two devices are answering for it. A fixed address the router doesn't know about can be handed out again."; },
  fixHints() { return ["The router decides which addresses it hands out (LAN & DHCP, DHCP clients); the printer's own address is on its control panel.", "Two devices can't share an address. Give the printer an address the router will never hand out, make sure the TV ends up on a different one, and check the PC's printer still points at the printer.", "Either move the printer outside the DHCP range (its control panel) and update the PC's printer port; or keep the printer's address, reserve it for the printer on the router, then restart the TV so it takes a new address."]; },
  exhibits(sim, v) { const c = conflicts(sim); return c.some(function (k) { return k.ip === v.ip && k.who.indexOf("printer") >= 0 && k.who.indexOf("tv") >= 0; }); },
  fixed(sim) { const ip = sim.d.pc.printer.port, r = sim.route("pc", ip); return !conflicts(sim).length && !!r.local && r.owner.length === 1 && r.owner[0] === "printer"; },
  proves(f) { return f.print === "ok"; },
  proofText: "a test page that prints (the office PC's Printers tab)",
  evidence: [
    { id: "fail", test: function (f) { return f.print === "fail"; }, text: function (f) { return "Test page from the office PC (to " + f.port + "): didn't print"; } },
    { id: "ok", test: function (f, v, sim) { return f.print === "ok" && conflicts(sim).length > 0; }, text: function () { return "Another test page: this one printed"; } },
    { id: "arp", test: function (f, v) { return f.cmd === "arp" && f.dev === "pc" && f.entries.some(function (e) { return e[0] === v.ip; }); }, text: function (f, v) { return "arp -a on the office PC: " + v.ip + " is at " + f.entries.find(function (e) { return e[0] === v.ip; })[1]; } },
    { id: "panel", test: function (f) { return f.page === "printer-panel"; }, text: function (f) { return "Printer control panel: " + (f.mode === "static" ? "fixed (static) address " : "address ") + f.ip + ", hardware address " + f.mac; } },
    { id: "clients", test: function (f, v) { return f.page === "router-clients" && f.rows.some(function (r) { return r[2] === v.ip; }); }, text: function (f, v) { const r = f.rows.find(function (x) { return x[2] === v.ip; }); return "Router DHCP clients: " + r[0] + " has " + v.ip + " (hardware address " + r[1] + ")"; } },
    { id: "range", test: function (f) { return f.page === "router-dhcp"; }, text: function (f) { return "Router LAN & DHCP: hands out " + f.start + " to " + f.end; } }
  ],
  summary(v) { return { cause: "The printer had a fixed address, " + v.ip + ", inside the router's DHCP range. The router didn't know, and handed the same address to the new TV. Two devices answered for one address, so print jobs went to whichever answered first.", fix: "Moved them apart: the printer on an address the router won't hand out (outside the range, or reserved), the TV on its own address, and the PC's printer pointing at the printer." }; }
};

/* ---------------------------------------------------------------- HOME-07 */
const OLD_GUESTS = ["Tablet-Jordan", "Phone-Ama", "Laptop-Sam", "Phone-Leo", "Watch-Mia", "Phone-Ruth", "Tablet-Kofi", "Phone-Ines", "Laptop-Dee", "Phone-Tomas"];
const HOME07 = {
  id: "HOME-07", n: "07", tier: "harder", title: "Guests' phones can't join", priority: 3, due: "4 h",
  build(seed) {
    const net = makeHome(seed), r = rng(hash("HOME-07:" + seed));
    const d = net.devices.router.dhcp, base = +d.start.split(".")[3];
    d.end = net.prefix + "." + (base + 9); d.leaseH = 168;                              /* ten addresses, leased for a week */
    net.devices.guest = { id: "guest", kind: "phone", label: "Guest's phone", sub: "Wi-Fi", on: true,
      ifaces: [{ name: "Wi-Fi", type: "wifi", mac: mac(r), bands: [24, 5], saved: { ssid: net.devices.router.wifi.ssid, passOk: true }, cfg: { mode: "dhcp" }, lease: null, apipa: null }] };
    net.rooms.guest = "kitchen";
    const sim = new Sim(net); sim.boot();
    const R = net.devices.router, names = r.shuffle(OLD_GUESTS);   /* last weekend's party guests: gone, but their leases run a week */
    let k = 0;
    for (let h = base; h <= base + 9; h++) { const ip = net.prefix + "." + h; if (R.leases.some(function (l) { return l.ip === ip; }) || d.reservations.some(function (x) { return x.ip === ip; })) continue; R.leases.push({ mac: mac(r), ip: ip, name: names[k % names.length], host: names[k % names.length].toUpperCase() }); k++; }
    sim.dhcp("guest", "join");
    return { sim: sim, v: { size: 10, old: k } };
  },
  brief() { return { quote: "We've had family staying since Friday. Their phones join the Wi-Fi, but they say \"No internet\". Our own phones and the laptop are fine. We had a big party here last weekend too." }; },
  mason: "Joined but no internet? Check what address the guest's phone got.",
  affected: "laptop",
  options() {
    return [
      { id: "right", right: true, text: "The router's DHCP range is used up: every address is still leased, so new phones get none" },
      { id: "off", text: "The router's DHCP server is switched off", why: "The LAN & DHCP page shows DHCP On, and the DHCP clients page is full of leases it handed out." },
      { id: "pass", text: "The guests are typing the wrong Wi-Fi password", why: "Their phones are connected to the Wi-Fi; a wrong password never connects at all." },
      { id: "filter", text: "The router blocks new devices (MAC filtering)", why: "MAC filtering stops a phone joining the Wi-Fi at all. These phones join, then get no address." },
      { id: "far", text: "The guests' phones are too far from the Wi-Fi", why: "The guest's phone shows a strong signal, in the kitchen beside the living room." },
      { id: "isp", text: "The internet service is down", why: "Your own laptop and phone reach the internet." }
    ];
  },
  rung1() { return "Open the guest's phone (its Wi-Fi page): what address did it get? Then look at the router's DHCP clients page and its LAN & DHCP page."; },
  rung2() { return "A phone that joins but gives itself a 169.254 address asked for an address and got none. A DHCP server can only hand out the addresses in its range, and a lease holds its address until it runs out, even after the device has gone."; },
  fixHints() { return ["The router's LAN & DHCP page sets how many addresses it can hand out.", "Make room for new devices: ten addresses don't last when leases run a week. Then have the guest's phone ask again.", "Widen the range (a higher end address), save, then turn the guest phone's Wi-Fi off and on. A shorter lease only helps next time: today's leases still run their course."]; },
  exhibits(sim) { const a = sim.addr("guest"), l = sim.wifiLink("guest"); return !!(l && l.connected) && !!a && a.kind === "apipa" && !!sim.route("laptop", PUBLIC_TEST).internet; },
  fixed(sim) { const a = sim.addr("guest"); return !!a && a.kind === "dhcp" && !!sim.route("guest", PUBLIC_TEST).internet; },
  proves(f) { return (f.page === "guest-wifi" && f.internet) || (f.rejoin && f.dev === "guest" && f.internet); },
  proofText: "the guest's phone showing internet OK (its Wi-Fi page)",
  evidence: [
    { id: "guest", test: function (f) { return f.page === "guest-wifi" && f.apipa; }, text: function (f) { return "Guest's phone: connected to the Wi-Fi, address " + f.ip + " (169.254: it gave itself that), no internet"; } },
    { id: "clients", test: function (f) { return f.page === "router-clients"; }, text: function (f) { return "Router DHCP clients: " + f.count + " of " + f.size + " addresses leased; leases last " + f.leaseH + " hours"; } },
    { id: "range", test: function (f) { return f.page === "router-dhcp"; }, text: function (f) { return "Router LAN & DHCP: DHCP " + (f.on ? "On" : "Off") + ", range " + f.start + " to " + f.end; } },
    { id: "laptop", test: function (f) { return f.cmd === "ping" && f.dev === "laptop" && f.internet && f.ok; }, text: function () { return "The laptop reaches the internet: the provider and router work"; } },
    { id: "again", test: function (f) { return f.rejoin && f.dev === "guest" && f.apipa; }, text: function () { return "Guest's phone, Wi-Fi off and on: still no address"; } }
  ],
  summary() { return { cause: "The DHCP range held only ten addresses and leases lasted a week: last weekend's party guests' devices still held most of them, so new phones got no address and gave themselves 169.254 ones.", fix: "Widened the DHCP range, saved, and had the guest's phone rejoin. (A shorter lease time stops it filling up again.)" }; }
};

/* ---------------------------------------------------------------- HOME-08 */
const HOME08 = {
  id: "HOME-08", n: "08", tier: "harder", title: "The desktop is slow on the wire", priority: 4, due: "2 days",
  build(seed) {
    const net = makeHome(seed), r = rng(hash("HOME-08:" + seed));
    const sim = new Sim(net); sim.boot();
    const c = sim.cable("c-switch-pc"); c.cond = "damaged"; c.kink = r.pick(["a", "b"]);   /* blue and brown pairs open near one end */
    return { sim: sim, v: { port: net.ports.pc, kink: c.kink } };
  },
  brief() { return { quote: "The office desktop is slow on the internet: downloads crawl compared with my laptop. We pay for 500 Mb/s. It's been like this since we rearranged the office." }; },
  mason: "Slow, not dead. Find the narrowest point on the desktop's path.",
  affected: "pc",
  options() {
    return [
      { id: "right", right: true, text: "Damaged pairs in the PC's patch cable are holding its link to 100 Mb/s" },
      { id: "isp", text: "The provider's speed is lower than the plan", why: "The laptop's speed test, on the same internet connection, gets close to the full plan." },
      { id: "nic", text: "The PC's network adapter is set to 100 Mb/s", why: "The adapter's speed and duplex is set to Auto negotiation: it's the link that settled at 100." },
      { id: "wifi", text: "Wi-Fi interference", why: "The desktop is wired: Wi-Fi isn't on its path." },
      { id: "switch", text: "The switch only does 10/100", why: "The switch's other ports light green: 1 Gb/s." },
      { id: "malware", text: "Malware on the PC is using up the bandwidth", why: "Windows and the switch both show the link itself at 100 Mb/s. The limit is in the cable, below anything software does." }
    ];
  },
  rung1() { return "Compare a speed test on the PC with one on the laptop. Then look at the PC's link speed (Network settings) and the colour of its light on the switch."; },
  rung2() { return "A link negotiates the fastest speed both ends and the cable can carry. Gigabit needs all four pairs in the cable; 100 Mb/s needs only two (pins 1, 2, 3 and 6)."; },
  fixHints() { return ["Go to the PC's cable (the PC's or the switch's Physical tab).", "Test the cable to find out which pairs are open. Reseating can't fix a damaged pair.", "With pins 4, 5, 7 and 8 open, the cable needs replacing."]; },
  exhibits(sim) { return sim.speed(sim.cable("c-switch-pc")) === 100 && !!sim.route("pc", PUBLIC_TEST).internet; },
  fixed(sim) { return sim.speed(sim.cable("c-switch-pc")) === 1000; },
  proves(f) { return (f.speed && f.dev === "pc" && f.speed > 300) || (f.page === "pc-settings" && f.speed === 1000); },
  proofText: "the PC's link back at 1 Gb/s: a speed test on the PC, or its Network settings",
  evidence: [
    { id: "link", test: function (f) { return f.page === "pc-settings" && f.speed === 100; }, text: function () { return "PC network settings: link speed 100/100 Mb/s"; } },
    { id: "lights", test: function (f, v) { return f.page === "switch-lights" && f.ports.some(function (p) { return p.port === v.port && p.speed === 100; }); }, text: function (f, v) { return "Switch lights: port " + v.port + " (office PC) amber, 10/100 Mb/s; the other used ports green"; } },
    { id: "pcspeed", test: function (f) { return f.speed && f.dev === "pc" && f.speed < 200; }, text: function (f) { return "Speed test on the PC: " + f.speed + " Mb/s"; } },
    { id: "lapspeed", test: function (f) { return f.speed && f.dev === "laptop"; }, text: function (f) { return "Speed test on the laptop: " + f.speed + " Mb/s"; } },
    { id: "test", test: function (f) { return f.phys === "test" && f.cable === "c-switch-pc"; }, text: function (f) { return "Cable tester on the PC's cable: " + (f.open.length ? "pins " + f.open.join(", ") + " open" : "all pins pass"); } },
    { id: "look", test: function (f, v) { return f.phys === "look" && f.cable === "c-switch-pc" && f.end === v.kink; }, text: function (f) { return "Looked at the cable at the " + (f.end === "b" ? "PC" : "switch") + " end: kinked and split near the plug"; } }
  ],
  summary() { return { cause: "The PC's patch cable was kinked and split near one end: the blue and brown pairs (pins 4, 5, 7 and 8) were open. 100 Mb/s needs only pins 1, 2, 3 and 6, so the link still came up, but at 100 Mb/s instead of 1 Gb/s.", fix: "Swapped in a new patch cable; the link came back at 1 Gb/s (green on the switch)." }; }
};

/* ---------------------------------------------------------------- HOME-09 */
const HOME09 = {
  id: "HOME-09", n: "09", tier: "harder", title: "Can't see the camera from outside", priority: 3, due: "1 day",
  build(seed) {
    const net = makeHome(seed), d = net.devices.router.dhcp, start = +d.start.split(".")[3];
    d.reservations = []; net.devices.camera.sub = "DHCP";
    const old = net.prefix + "." + (start + 2);
    net.devices.router.forwards = [{ name: "Camera", ext: 8443, ip: old, port: 443 }];
    const sim = new Sim(net); sim.boot(["mesh", "tv", "phone", "camera", "laptop", "pc"]);   /* after the power cut the phone came back first and got the camera's old address */
    return { sim: sim, v: { old: old } };
  },
  brief() { return { quote: "I can't see the porch camera on my phone when I'm out. At home on the Wi-Fi it works fine. We had a power cut on Thursday night." }; },
  mason: "Outside in: follow the connection from the internet to the camera.",
  affected: "phone",
  partial() { return "It works now. Will it still work after the next power cut? Make sure the camera's address can't move again."; },
  options() {
    return [
      { id: "right", right: true, text: "The router's port forward still points at the camera's old address; the camera got a new one from DHCP" },
      { id: "offline", text: "The camera is offline", why: "Its own page loads, at its new address, and it's recording." },
      { id: "block", text: "The provider blocks incoming connections", why: "It worked for months on the same provider and plan, and the router's WAN address is public." },
      { id: "data", text: "The phone's mobile data is off", why: "The camera app on mobile data reaches the router; it's the hop from the router to the camera that fails." },
      { id: "dnat", text: "Double NAT: the cable modem is acting as a router too", why: "The router's WAN address is public (198.51.100.x), straight from the provider: there's only one NAT." },
      { id: "pass", text: "The camera's password was changed", why: "A wrong password gives a login error. This connection never reaches the camera at all." }
    ];
  },
  rung1() { return "Try the camera app on mobile data (the phone), then compare the router's Port forwarding page with the camera's address now (its page, or the DHCP clients list)."; },
  rung2() { return "A port forward sends outside connections to one fixed internal address. If the device's address changes, the forward points at whatever has that address now."; },
  fixHints() { return ["Outside connections come in through the router's Port forwarding page.", "A forward points at an address. Is that still the camera's? And what stops the camera's address moving again after the next power cut?", "Two places: point the forward at the camera's address now, and reserve that address for the camera on the DHCP clients page so it can't move again."]; },
  exhibits(sim, v) { const o = sim.outside(8443), a = sim.addr("camera"); return !o.ok && !!a && a.ip !== v.old; },
  fixed(sim) {
    const o = sim.outside(8443); if (!o.ok || o.who !== "camera") return false;
    const c = sim.d.camera.ifaces[0], a = sim.addr("camera");
    return c.cfg.mode === "static" || sim.d.router.dhcp.reservations.some(function (r) { return r.mac === c.mac && r.ip === a.ip; });
  },
  proves(f) { return !!f.outside && f.ok; },
  proofText: "the camera app connecting on mobile data (the phone's Wi-Fi page)",
  evidence: [
    { id: "app", test: function (f) { return f.outside && !f.ok; }, text: function () { return "Camera app on mobile data: can't connect"; } },
    { id: "fwd", test: function (f) { return f.page === "router-forward"; }, text: function (f) { return "Router port forwarding: " + f.rules.map(function (r) { return "outside port " + r.ext + " goes to " + r.ip + ":" + r.port; }).join("; "); } },
    { id: "cam", test: function (f) { return f.page === "camera-web"; }, text: function (f) { return "Camera page: online at " + f.ip; } },
    { id: "clients", test: function (f, v) { return f.page === "router-clients"; }, text: function (f, v) { const c = f.rows.find(function (r) { return r[0] === "IP camera"; }), o = f.rows.find(function (r) { return r[2] === v.old; }); return "Router DHCP clients: IP camera at " + (c ? c[2] : "?") + (o ? "; " + o[0] + " at " + v.old : ""); } },
    { id: "wan", test: function (f) { return f.page === "router-status" && f.wan; }, text: function (f, v, sim) { return "Router status: WAN address " + sim.net.isp.wanIp + " (public, from the provider)"; } }
  ],
  summary(v) { return { cause: "After the power cut the camera asked for an address and got a new one; with no reservation, its old address " + v.old + " went to the phone. The port forward still sent outside connections to " + v.old + ", which is the phone now, so they were refused.", fix: "Pointed the forward at the camera's current address and reserved that address for the camera, so the next power cut can't move it." }; }
};

/* ---------------------------------------------------------------- HOME-10 */
const HOME10 = {
  id: "HOME-10", n: "10", tier: "harder", title: "Some devices get 10.0.0.x addresses", priority: 2, due: "4 h",
  build(seed) {
    const net = makeHome(seed), r = rng(hash("HOME-10:" + seed)), P = net.ports;
    const free = [2, 3, 4, 5].find(function (p) { return p !== P.pc && p !== P.printer && p !== P.camera; });
    net.devices.rogue = { id: "rogue", kind: "rogue", label: "Old router", sub: "not on the diagram", on: true, undocumented: true, mac: mac(r),
      lan: { ip: "10.0.0.1", mask: "255.255.255.0" }, dhcp: { on: true, start: "10.0.0.2", end: "10.0.0.100", leaseH: 24, dnsMode: "router", dns: ["", ""], reservations: [] }, leases: [], wanOk: false };
    net.cables.push({ id: "c-rogue", kind: "cat6", a: { dev: "switch", port: String(free), seated: true }, b: { dev: "rogue", port: "LAN 1", seated: true }, cond: "good" });
    net.rooms.rogue = "office"; net.extra.rogueWins = ["laptop", "tv"];
    const sim = new Sim(net); sim.boot();
    return { sim: sim, v: { port: free } };
  },
  brief(v, sim) { return { quote: "The laptop and the TV can't get online, but the office PC is fine. The laptop's address starts 10.0.0, but the technician's sticker on our router says " + sim.net.prefix + ".something. My son found our old router in the garage yesterday and set it up in the office for better Wi-Fi." }; },
  mason: "Who gave the laptop that address?",
  affected: "laptop",
  options(v, sim) {
    return [
      { id: "right", right: true, text: "A second router plugged into the network is handing out its own addresses (a rogue DHCP server)" },
      { id: "range", text: "The router's DHCP range was changed to 10.0.0.x", why: "The router's LAN & DHCP page still hands out " + sim.net.prefix + ".x, and the office PC got one of those." },
      { id: "static", text: "The laptop has a static 10.0.0.x address typed in", why: "ipconfig /all shows DHCP Enabled: Yes, with a DHCP server at 10.0.0.1." },
      { id: "isp", text: "The provider moved the house to 10.0.0.x addresses", why: "The provider's address is on the router's WAN side. Addresses inside the house come from a box inside the house." },
      { id: "neighbour", text: "The laptop joined a neighbour's Wi-Fi", why: "netsh wlan show interfaces shows it on the house's own network name." },
      { id: "apipa", text: "No DHCP server answered, so the laptop gave itself an address", why: "Self-given addresses start 169.254 and come with no gateway. This one has a gateway, 10.0.0.1." }
    ];
  },
  rung1() { return "On the laptop, ipconfig /all: which DHCP server gave it its address? Then look at the switch's lights against the diagram."; },
  rung2() { return "Every device takes its address from whichever DHCP server answers first. Two servers on one network means some devices get the wrong network, and the wrong gateway."; },
  fixHints() { return ["Find what's handing out 10.0.0.x: ipconfig /all names the DHCP server, and the switch shows a cable to something that isn't on the diagram (the floor plan shows where).", "Stop the extra DHCP server, then have the affected devices ask again: they keep a wrong address until they do.", "Unplug the old router (or turn its DHCP off on its own admin page), then ipconfig /renew on the laptop and restart the TV."]; },
  exhibits(sim) { const a = sim.addr("laptop"), t = sim.addr("tv"), p = sim.addr("pc"); return !!a && a.ip.indexOf("10.0.0.") === 0 && !!t && t.ip.indexOf("10.0.0.") === 0 && !!p && p.server === sim.d.router.lan.ip; },
  fixed(sim) {
    const rogueServes = sim.dhcpServers("pc").some(function (s) { return sim.d[s].kind === "rogue"; });
    const ok = function (id) { const a = sim.addr(id); return !!a && a.kind === "dhcp" && a.server === sim.d.router.lan.ip; };
    return !rogueServes && ok("laptop") && ok("tv");
  },
  proves(f) { return f.dev === "laptop" && f.cmd === "ping" && f.beyond && f.internet; },
  proofText: "a ping to an internet address from the laptop that gets replies",
  evidence: [
    { id: "ip", test: function (f) { return f.cmd === "ipconfig" && f.dev === "laptop" && f.ip && f.ip.indexOf("10.0.0.") === 0; }, text: function (f) { return "ipconfig on the laptop: " + f.ip + ", gateway " + f.gw; } },
    { id: "server", test: function (f) { return f.cmd === "ipconfig" && f.sub === "/all" && f.dev === "laptop" && f.ip && f.ip.indexOf("10.0.0.") === 0; }, text: function () { return "ipconfig /all on the laptop: DHCP Server 10.0.0.1"; } },
    { id: "out", test: function (f) { return f.cmd === "ping" && f.dev === "laptop" && f.kind === "net-unreachable"; }, text: function (f) { return "ping " + f.ip + " from the laptop: Destination net unreachable (from 10.0.0.1)"; } },
    { id: "lights", test: function (f, v) { return f.page === "switch-lights" && f.ports.some(function (p) { return p.port === v.port && p.up; }); }, text: function (f, v) { return "Switch lights: port " + v.port + " is lit, with a cable to a box that isn't on the diagram"; } },
    { id: "pc", test: function (f) { return f.cmd === "ipconfig" && f.dev === "pc" && f.kind === "dhcp"; }, text: function (f) { return "ipconfig on the office PC: " + f.ip + ", gateway " + f.gw; } },
    { id: "admin", test: function (f) { return f.page === "rogue-admin"; }, text: function () { return "The old router's admin page: DHCP server handing out 10.0.0.2 to 10.0.0.100; no internet cable in its WAN port"; } }
  ],
  summary() { return { cause: "The old router, plugged into the switch, was running its own DHCP server. Devices that asked for an address while it was there took whichever answer came first; the laptop and TV got 10.0.0.x with a gateway that has no internet.", fix: "Took the old router off the network (or switched off its DHCP), then had the laptop and TV ask again: ipconfig /renew, and a restart." }; }
};

/* ---------------------------------------------------------------- HOME-11 */
/* the printer's mask typed wrong: chosen so the office PC and the router are both off its network */
const NARROW = [["255.255.255.248", 8], ["255.255.255.240", 16]];
const HOME11 = {
  id: "HOME-11", n: "11", tier: "more", title: "The printer stopped after its settings were put back", priority: 3, due: "1 day",
  build(seed) {
    const net = makeHome(seed), r = rng(hash("HOME-11:" + seed)), range = net.range, m = r.pick(NARROW), size = m[1], ok = [];
    for (let h = 2; h <= 253; h++) {
      const b = h - h % size, e = b + size - 1;
      if (h === b || h === e || b === 0) continue;                 /* not the block's own number or broadcast; not the router's block */
      if (!(e < range[0] || b > range[1])) continue;              /* the whole block outside the DHCP range: nothing that asks for an address lands in it */
      ok.push(h);
    }
    const ip = net.prefix + "." + r.pick(ok), P = net.devices.printer, f = P.ifaces[0];
    f.cfg.ip = ip; f.cfg.mask = m[0]; P.sub = ip; net.devices.pc.printer.port = ip;
    const sim = new Sim(net); sim.boot();
    return { sim: sim, v: { ip: ip, mask: m[0], prMac: f.mac, lo: network(ip, m[0]), hi: broadcast(ip, m[0]) } };
  },
  brief() { return { quote: "Nothing will print since the printer company's technician reset the office printer on Monday and typed its settings back in. Its screen says it's online at its usual address, and the computer still lists it. The internet's fine on everything." }; },
  mason: "Find where the conversation breaks: on the way to the printer, or on the way back.",
  affected: "pc",
  options(v, sim) {
    return [
      { id: "right", right: true, text: "The printer's subnet mask is wrong: it thinks the office PC is on another network, so its replies never come back" },
      { id: "cable", text: "The printer's cable or its switch port is bad", why: "arp -a on the office PC shows the printer's own hardware address: it heard the PC and answered. Frames get through the cable and the port." },
      { id: "port", text: "The PC's printer port points at the wrong address", why: "The port is the address on the printer's control panel, and arp -a shows that address belongs to the printer's own hardware address." },
      { id: "conflict", text: "Another device has taken the printer's address", why: "arp -a shows the printer's own hardware address for it, every time, and no DHCP client has it." },
      { id: "gateway", text: "The printer's default gateway is wrong", why: "Its gateway is the router, " + sim.d.router.lan.ip + ", as it should be. And the office PC is on the same network as the printer: a reply to it shouldn't need a gateway at all." },
      { id: "firewall", text: "The office PC's firewall is blocking the printer", why: "A firewall lets in the replies to what the PC itself sent. And the laptop can't reach the printer either." }
    ];
  },
  rung1() { return "Ping the printer from the office PC, then run arp -a. Then compare every setting on the printer's control panel with the PC's own (ipconfig)."; },
  rung2() { return "A device that answers ARP but never answers a ping can hear you: frames reach it. What's wrong is in its IP settings. Every device on one network has to agree on the subnet mask, or it decides the others are somewhere else."; },
  fixHints() { return ["The printer's own settings are on its control panel (Network > TCP/IP).", "Compare the printer's subnet mask with the office PC's (ipconfig) and the router's. Every device on this network uses the same one.", "On the printer's control panel set the subnet mask to 255.255.255.0, the same as everything else here; keep its address and gateway, save, then print a test page."]; },
  exhibits(sim, v) { return sim.route("pc", v.ip).fail === "no-reply"; },   /* routes only: a test print here would leave its trace in the PC's ARP cache */
  fixed(sim) { const rt = sim.route("pc", sim.d.pc.printer.port); return !!rt.local && rt.owner.length === 1 && rt.owner[0] === "printer"; },
  proves(f) { return f.print === "ok"; },
  proofText: "a test page that prints (the office PC's Printers tab)",
  evidence: [
    { id: "ping", test: function (f, v) { return f.cmd === "ping" && f.dev === "pc" && f.ip === v.ip && f.kind === "no-reply"; }, text: function (f) { return "ping " + f.ip + " from the office PC: every request timed out"; } },
    { id: "arp", test: function (f, v) { return f.cmd === "arp" && f.dev === "pc" && f.entries.some(function (e) { return e[0] === v.ip; }); }, text: function (f, v) { return "arp -a on the office PC: " + v.ip + " is at " + f.entries.find(function (e) { return e[0] === v.ip; })[1]; } },
    { id: "panel", test: function (f) { return f.page === "printer-panel"; }, text: function (f) { return "Printer control panel: address " + f.ip + ", mask " + f.mask + ", gateway " + f.gw + ", hardware address " + f.mac; } },
    { id: "pc", test: function (f) { return f.cmd === "ipconfig" && f.dev === "pc" && !!f.ip; }, text: function (f) { return "ipconfig on the office PC: " + f.ip + ", mask " + f.mask + ", gateway " + f.gw; } },
    { id: "fail", test: function (f) { return f.print === "fail"; }, text: function (f) { return "Test page from the office PC (to " + f.port + "): nothing printed"; } }
  ],
  summary(v) { return { cause: "When the printer's settings were typed back in, its subnet mask went in as " + v.mask + " instead of 255.255.255.0. With that mask the printer believes only " + v.lo + " to " + v.hi + " are on its network, so the office PC, and the router it uses as its gateway, are \"somewhere else\" to it. It heard the PC (it answered ARP), but sent every reply towards a gateway it couldn't reach, so nothing came back.", fix: "Set the printer's mask to 255.255.255.0 on its control panel, the same as every other device here, kept its address and gateway, and printed a test page." }; }
};

/* ---------------------------------------------------------------- HOME-12 */
const HOME12 = {
  id: "HOME-12", n: "12", tier: "more", title: "The office PC prints but can't get online", priority: 2, due: "4 h",
  build(seed) {
    const net = makeHome(seed), r = rng(hash("HOME-12:" + seed)), range = net.range, other = net.prefix === "192.168.0" ? "192.168.1" : "192.168.0";
    const kind = r.pick(["same", "other"]);                       /* the old router at .254 on this network, or on the old network altogether */
    const gw = kind === "same" ? net.prefix + ".254" : other + ".1";
    const used = [1, 254, +net.devices.printer.ifaces[0].cfg.ip.split(".")[3]], free = [];
    for (let h = 2; h <= 253; h++) if ((h < range[0] || h > range[1]) && used.indexOf(h) < 0) free.push(h);
    const ip = net.prefix + "." + r.pick(free), f = net.devices.pc.ifaces[0];
    f.cfg = { mode: "static", ip: ip, mask: net.mask, gw: gw, dns: net.isp.dns.slice(), dnsMode: "static" };
    net.devices.pc.sub = ip;
    const sim = new Sim(net); sim.boot();
    return { sim: sim, v: { kind: kind, gw: gw, ip: ip } };
  },
  brief() { return { quote: "The office PC can't get on the internet, but it still prints fine and everyone else in the house is online. We changed our router last month; the old one's in a cupboard. A friend set the PC up with fixed settings years ago." }; },
  mason: "It prints, so its cable and its address work. Follow a packet that's leaving the house.",
  affected: "pc",
  options(v, sim) {
    return [
      { id: "right", right: true, text: "The office PC's default gateway is typed in as the old router's address, so it has no way off its own network" },
      { id: "dns", text: "The office PC's DNS servers are wrong", why: "A ping to an internet address by number fails too, and DNS only turns names into numbers. Its DNS servers are the provider's, which work for everyone else." },
      { id: "cable", text: "The office PC's cable or switch port is bad", why: "It prints every time, and its link light is green: it reaches the printer through that cable and port." },
      { id: "isp", text: "The router has lost its internet connection", why: "The laptop, phone and TV are online through the same router right now." },
      { id: "conflict", text: "The office PC's address conflicts with another device", why: "No DHCP client has it, and the printer answers it every time." },
      { id: "mask", text: "The office PC's subnet mask is wrong", why: "Its mask is " + sim.net.mask + ", the same as the router's and every other device's, and the printer on the same network answers it." }
    ];
  },
  rung1() { return "On the office PC, ipconfig, then ping its default gateway. Compare that gateway with the router's own address (at the top of every router page)."; },
  rung2() { return "A computer sends everything that isn't on its own network to its default gateway. If nothing answers at that address, or it isn't even on the computer's network, nothing leaves the house: local things still work."; },
  fixHints() { return ["The office PC's IP settings are on its Network settings tab (Edit IP settings).", "Its default gateway has to be the router that's there now. Or let the router hand it its settings.", "In the office PC's Edit IP settings, set the gateway to " + "the router's address (shown at the top of the router's pages), or choose Automatic (DHCP), save, then ping an internet address."]; },
  exhibits(sim) { const o = sim.route("pc", PUBLIC_TEST), p = sim.route("pc", sim.d.pc.printer.port); return (o.fail === "gateway-unreachable" || o.fail === "no-route") && !!p.local && p.owner[0] === "printer"; },
  fixed(sim) { return !!sim.route("pc", PUBLIC_TEST).internet; },
  proves(f) { return f.dev === "pc" && f.cmd === "ping" && f.beyond && f.internet; },
  proofText: "a ping to an internet address from the office PC that gets replies",
  evidence: [
    { id: "ip", test: function (f) { return f.cmd === "ipconfig" && f.dev === "pc" && !!f.ip; }, text: function (f) { return "ipconfig on the office PC: " + f.ip + ", default gateway " + (f.gw || "(none)") + (f.kind === "static" ? " (typed in by hand)" : ""); } },
    { id: "gw", test: function (f, v) { return f.cmd === "ping" && f.dev === "pc" && f.ip === v.gw; }, text: function (f) { return "ping " + f.ip + " (the PC's gateway): " + (f.kind === "no-route" ? "transmit failed, general failure" : f.kind === "gateway-unreachable" || f.kind === "host-unreachable" ? "Destination host unreachable" : "replies"); } },
    { id: "out", test: function (f, v) { return f.cmd === "ping" && f.dev === "pc" && f.ip !== v.gw && (f.kind === "gateway-unreachable" || f.kind === "no-route"); }, text: function (f) { return "ping " + f.ip + " from the office PC: " + (f.kind === "no-route" ? "transmit failed, general failure" : "Destination host unreachable"); } },
    { id: "print", test: function (f) { return f.print === "ok"; }, text: function () { return "Test page from the office PC: printed (its own network works)"; } },
    { id: "settings", test: function (f) { return f.page === "pc-settings"; }, text: function (f) { return "Office PC network settings: " + (f.mode === "static" ? "Manual, gateway " + f.gw : "Automatic (DHCP)"); } }
  ],
  summary(v, sim) { const g = sim ? sim.d.router.lan.ip : "the router"; return { cause: "Years ago the office PC was given fixed settings with the old router's address, " + v.gw + ", as its default gateway. The new router is " + g + ", and nothing answers at " + v.gw + (v.kind === "other" ? " (it isn't even on the PC's network)" : "") + ". The PC still reached everything on its own network, the printer included, but every packet for the internet went to a gateway that isn't there.", fix: "Set the office PC's gateway to the router, " + g + " (or set it back to Automatic (DHCP)) in its IP settings. The internet came back." }; }
};

/* ---------------------------------------------------------------- HOME-13 */
const HOME13 = {
  id: "HOME-13", n: "13", tier: "more", title: "The porch camera is offline, at home and away", priority: 2, due: "1 day",
  build(seed) {
    const net = makeHome(seed), r = rng(hash("HOME-13:" + seed)), kind = r.pick(["unplugged", "passive"]), inj = net.devices.injector;
    if (kind === "unplugged") inj.power = false;                  /* its adapter knocked out when the office was cleaned */
    else inj.std = "passive";                                     /* the replacement bought online: passive 24 V */
    const sim = new Sim(net); sim.boot();
    return { sim: sim, v: { kind: kind, port: net.ports.camera, mac: net.devices.camera.ifaces[0].mac, ip: net.devices.router.dhcp.reservations.find(function (x) { return x.name === "IP camera"; }).ip } };
  },
  brief(v) { return { quote: v.kind === "unplugged" ? "The porch camera's been offline since the weekend: the app says \"device offline\" at home on the Wi-Fi and when I'm out. The cleaners did the office on Friday. Nothing else has changed." : "The little box for the porch camera in the office stopped working last week, so I bought a replacement online and plugged it in exactly where the old one was. Its light comes on, but the camera's still offline, at home and away." }; },
  mason: "The camera has no plug of its own. So where does it get its power?",
  affected: "phone",
  options(v, sim) {
    return [
      { id: "right", right: true, text: "The camera has no power: its PoE injector isn't supplying the power it needs down the cable" },
      { id: "reservation", text: "The camera's DHCP reservation was lost", why: "A camera without its reservation still gets some address and shows on the DHCP clients page. This one isn't there at all, and its port light is off." },
      { id: "cable", text: "The cable from the injector to the camera is damaged", why: "The cable tester passes it, pins 1 to 8 in order, and both plugs are latched in." },
      { id: "forward", text: "The router's port forward for the camera is wrong", why: "A port forward only matters from outside the house. The camera's offline at home on the Wi-Fi too." },
      { id: "crashed", text: "The camera has crashed and needs restarting", why: "Restarting changes nothing: it never comes on. A crashed camera still has power, and a link light." },
      { id: "switch", text: "The switch port for the camera has failed", why: "That port's light is off because nothing at the far end has power: the injector passes the link straight through from the camera. The switch's other ports all work." }
    ];
  },
  rung1() { return "Follow the camera's cable back from the camera: the camera's own port lights, the injector's lights and label (its Physical tab), and the switch port it ends in."; },
  rung2() { return "A PoE camera has no power supply of its own: it runs on power sent down its network cable. No power on the cable, no camera: no link light, no address, nothing to ping. And it has to be the kind of PoE the camera expects."; },
  fixHints() { return ["The camera gets its power from the PoE injector in the office: open the injector (its Physical tab).", "Is the injector plugged in? Is it the kind of PoE the camera asks for (printed beside the camera's port)?", "Plug the injector's power adapter back in; or, if it's a passive 24 V injector, swap in an 802.3af one. Then check the camera answers."]; },
  exhibits(sim) { return !sim.on("camera") && !sim.addr("camera") && !!sim.route("phone", PUBLIC_TEST).internet; },
  fixed(sim) { return sim.on("camera") && !!sim.addr("camera"); },
  proves(f, sim) { return (f.page === "camera-web" && f.online) || (f.cmd === "ping" && f.beyond && f.local && f.ip === (sim.addr("camera") || {}).ip); },
  proofText: "the camera's own page coming up (its Web page tab), or a ping to the camera that gets replies",
  evidence: [
    { id: "web", test: function (f) { return f.page === "camera-web" && !f.online; }, text: function () { return "The camera's page: can't be reached, nothing answers"; } },
    { id: "lights", test: function (f, v) { return f.page === "switch-lights" && f.ports.some(function (p) { return p.port === v.port && !p.up; }); }, text: function (f, v) { return "Switch lights: port " + v.port + " (cable to the PoE injector) is off"; } },
    { id: "clients", test: function (f, v) { return f.page === "router-clients" && !f.rows.some(function (r) { return r[1] === v.mac; }); }, text: function () { return "Router DHCP clients: the camera isn't on the list"; } },
    { id: "ping", test: function (f, v) { return f.cmd === "ping" && f.ip === v.ip && !f.ok; }, text: function (f, v) { return "ping " + v.ip + " (the camera's reserved address): no reply"; } },
    { id: "inj", test: function (f) { return f.page === "injector-physical" && !!f.injector; }, text: function (f) { return "The PoE injector: power adapter " + (f.injector.power ? "plugged in" : "unplugged") + "; its label says " + (f.injector.std === "passive" ? "PASSIVE PoE, 24V" : "IEEE 802.3af, 48V"); } },
    { id: "cam", test: function (f) { return f.page === "camera-physical" && f.camera === false; }, text: function () { return "The camera: dark, its port lights off; printed beside its port, PoE 802.3af"; } }
  ],
  summary(v) { return { cause: v.kind === "unplugged" ? "The camera takes its power down its network cable from the PoE injector in the office (802.3af). The injector's power adapter had been knocked out when the office was cleaned, so the camera got no power at all: no link, no address, nothing to see." : "The camera takes its power down its network cable (802.3af: 48 V, after a handshake). The replacement injector was a passive 24 V one, which an 802.3af camera won't take power from, so it stayed dark: no link, no address, nothing to see.", fix: v.kind === "unplugged" ? "Plugged the injector's power adapter back in; the camera powered up, took its reserved address and came back online." : "Swapped in an 802.3af PoE injector; the camera powered up, took its reserved address and came back online." }; }
};

/* ---------------------------------------------------------------- HOME-14 */
const HOME14 = {
  id: "HOME-14", n: "14", tier: "more", title: "The old laptop won't join the Wi-Fi any more", priority: 3, due: "1 day",
  build(seed) {
    const net = makeHome(seed), r = rng(hash("HOME-14:" + seed)), who = r.pick(["son", "daughter", "nephew"]);
    const L = net.devices.laptop, f = L.ifaces[0];
    L.label = "Old laptop"; L.host = "OLD-LAPTOP"; f.desc = "Wireless-N Network Adapter"; f.secs = ["WPA2-Personal"];   /* an older adapter: WPA2 is as far as it goes */
    net.rooms.laptop = r.pick(["living", "upstairs"]);
    net.devices.router.wifi.sec = "WPA3-Personal";                 /* "the most secure setting" */
    const sim = new Sim(net); sim.boot();
    return { sim: sim, v: { who: who } };
  },
  brief(v) { return { quote: "My " + v.who + " read that WPA3 is safer and changed the Wi-Fi to \"the most secure setting\" on Sunday. Since then my old laptop can't connect at all: it just says it can't connect to this network. The phones are fine and I haven't changed the password." }; },
  mason: "The phones get on, the laptop doesn't. What can the phones do that the laptop can't?",
  affected: "laptop",
  options(v, sim) {
    return [
      { id: "right", right: true, text: "The router is set to WPA3 only, and the old laptop's Wi-Fi adapter can't do WPA3" },
      { id: "password", text: "The Wi-Fi password was changed and the laptop has the old one", why: "The phones are still connected with the same saved password. And the laptop is turned away before any password is tried: the network's security type isn't one its adapter supports." },
      { id: "range", text: "The laptop is too far from the router", why: "netsh wlan show networks lists the house network, at a good signal, from where the laptop is." },
      { id: "channel", text: "The 2.4 GHz channel is crowded by the neighbours", why: "Interference makes a connection drop packets; it doesn't stop a laptop joining. And the phones join on the same channels." },
      { id: "dhcp", text: "The router's DHCP range is full", why: "The laptop never gets onto the Wi-Fi, so it never asks for an address. A full range leaves a device joined, with a 169.254 address." },
      { id: "adapter", text: "The laptop's Wi-Fi adapter has failed", why: "netsh wlan show networks lists every network nearby: the adapter works. It's this one network it can't join." }
    ];
  },
  rung1() { return "On the laptop: netsh wlan show networks (what security does the house network use?) and netsh wlan show drivers (what can this adapter do?). Then look at the router's Wi-Fi page."; },
  rung2() { return "A device can only join a network whose security it supports. Older adapters stop at WPA2, so a network set to WPA3 alone turns them away, whatever the password. Some settings let both kinds join."; },
  fixHints() { return ["The router's Wi-Fi page sets the network's security.", "Choose a setting the old laptop supports without taking WPA3 away from the devices that have it.", "On the router's Wi-Fi page set Security to WPA2/WPA3-Personal (transition), save, then check the laptop joins and gets online."]; },
  exhibits(sim) { const l = sim.wifiLink("laptop"), ph = sim.wifiLink("phone"); return !!l && l.reason === "security" && !!ph && ph.connected; },
  fixed(sim) { const l = sim.wifiLink("laptop"); return sim.d.router.wifi.sec === "WPA2/WPA3-Personal" && !!l && l.connected; },
  partial(v, sim) { const l = sim.wifiLink("laptop"); return sim.d.router.wifi.sec === "WPA2-Personal" && !!l && l.connected ? "The laptop's online, but now every device in the house is back on WPA2, the phones included. Is there a setting that lets the laptop on and keeps WPA3 for everything that can use it?" : null; },
  proves(f) { return f.dev === "laptop" && f.cmd === "ping" && f.beyond && f.internet; },
  proofText: "a ping to an internet address from the old laptop that gets replies",
  evidence: [
    { id: "page", test: function (f) { return f.page === "laptop-wifi" && f.reason === "security"; }, text: function () { return "Laptop Wi-Fi: \"Can't connect to this network\""; } },
    { id: "nets", test: function (f, v, sim) { return f.cmd === "netsh-nets" && f.dev === "laptop" && f.auth && !!f.auth[sim.d.router.wifi.ssid]; }, text: function (f, v, sim) { return "netsh wlan show networks on the laptop: " + sim.d.router.wifi.ssid + " uses " + f.auth[sim.d.router.wifi.ssid]; } },
    { id: "drivers", test: function (f) { return f.cmd === "netsh-drivers" && f.dev === "laptop"; }, text: function (f) { return "netsh wlan show drivers on the laptop: supports " + f.secs.join(", ") + (f.wpa3 ? "" : " (no WPA3, no 802.11w)"); } },
    { id: "router", test: function (f) { return f.page === "router-wifi"; }, text: function (f) { return "Router Wi-Fi page: Security " + f.sec; } },
    { id: "phone", test: function (f) { return f.page === "phone-wifi" && f.connected; }, text: function () { return "Phone Wi-Fi: connected, online"; } }
  ],
  summary() { return { cause: "The router's Wi-Fi security was changed to WPA3-Personal only. The old laptop's adapter supports WPA2 at most (netsh wlan show drivers), so the network turned it away before any password was tried. The phones support WPA3, so they carried on.", fix: "Set the router's Wi-Fi security to WPA2/WPA3-Personal (transition mode): the old laptop joins with WPA2, and everything newer keeps WPA3." }; }
};

/* ---------------------------------------------------------------- HOME-15 */
const onReal = function (sim, id) { const l = sim.wifiLink(id); return !!l && l.connected && (l.ap.id === "router" || l.ap.id === "mesh"); };
const HOME15 = {
  id: "HOME-15", n: "15", tier: "more", title: "The laptop says connected, but nothing loads", priority: 1, due: "2 h",
  build(seed) {
    const net = makeHome(seed), r = rng(hash("HOME-15:" + seed)), w = net.devices.router.wifi;
    net.rooms.laptop = r.pick(["living", "kitchen"]);
    /* a hotspot in a car outside, broadcasting the house's own network name, open, with a fake "router update" page */
    net.devices.twin = { id: "twin", kind: "rogue", label: "Unknown hotspot", sub: "outside the house", on: true, undocumented: true, mac: mac(r), ssid: w.ssid, ch: r.pick([1, 11]),
      heard: { living: 74, kitchen: 70, office: 58, upstairs: 48, porch: 82, garage: 40 },
      lan: { ip: "172.20.10.1", mask: "255.255.255.240" }, dhcp: { on: true, start: "172.20.10.2", end: "172.20.10.14", leaseH: 24, dnsMode: "router", dns: ["", ""], reservations: [] }, leases: [], wanOk: false };
    net.devices.laptop.ifaces[0].saved = { ssid: w.ssid, passOk: true, sec: "Open" };   /* clicked the name again, and got the open copy */
    const sim = new Sim(net); sim.boot();
    return { sim: sim, v: { twinMac: net.devices.twin.mac.toUpperCase().replace(/-/g, ":") } };
  },
  brief() { return { quote: "Last night the laptop dropped off the Wi-Fi. When I clicked our network's name again, a page popped up saying the router needed a firmware update and asked for the Wi-Fi password, so I typed it in. Since then the laptop says it's connected, but nothing loads. The phones are fine." }; },
  mason: "Same name. Is it the same network?",
  affected: "laptop",
  options(v, sim) {
    return [
      { id: "right", right: true, text: "A fake open hotspot is using the house's network name (an evil twin): the laptop joined it, and the password went into its fake page" },
      { id: "firmware", text: "The router's firmware update failed", why: "The router's pages show it running normally, the phones are online through it, and a router never asks for the Wi-Fi password on a page that pops up." },
      { id: "apipa", text: "No DHCP server answered, so the laptop gave itself an address", why: "Its address, 172.20.10.x, came with a gateway and a DHCP server, 172.20.10.1. A self-given one starts 169.254 and has neither." },
      { id: "channel", text: "A neighbour's network on the same channel is interfering", why: "Interference loses packets on the right network. The laptop is joined to a different access point altogether: its BSSID isn't one of the router's." },
      { id: "rogue", text: "A second DHCP server on the house network is handing out the wrong addresses", why: "The phones, on the same router, have the house's addresses, and the router's DHCP clients page doesn't list the laptop: it isn't on the house network at all." },
      { id: "dns", text: "The laptop's DNS server is wrong", why: "It can't reach an internet address by number either: its gateway, 172.20.10.1, answers Destination net unreachable." }
    ];
  },
  rung1() { return "On the laptop: netsh wlan show interfaces (which BSSID, what security?) and netsh wlan show networks mode=bssid. Compare them with the router's own radios and security on its Wi-Fi page."; },
  rung2() { return "Anyone can broadcast any network name. A real network is known by its security and its access points' hardware addresses (BSSIDs). An open copy of your network's name that asks for your password is an attack, not your router."; },
  fixHints() { return ["The laptop's Wi-Fi tab shows the networks in range and the one it has saved.", "Get the laptop back on the real, secured network. And the Wi-Fi password was typed into a stranger's page: it isn't secret any more.", "On the laptop, forget the saved network and connect to the secured one. Then change the Wi-Fi password (router's Wi-Fi page) and give the new one to the laptop and the phone."]; },
  exhibits(sim) { const l = sim.wifiLink("laptop"); return !!l && l.connected && l.ap.id === "twin" && onReal(sim, "phone"); },
  fixed(sim) { return onReal(sim, "laptop") && onReal(sim, "phone") && (sim.d.router.wifi.gen || 1) > 1 && !!sim.route("laptop", PUBLIC_TEST).internet; },
  partial(v, sim) {
    if (!onReal(sim, "laptop")) return null;
    if ((sim.d.router.wifi.gen || 1) === 1) return "The laptop's back on the real network. But the Wi-Fi password was typed into that fake page: whoever runs the hotspot has it now, and can join the real network whenever they like.";
    if (!onReal(sim, "phone")) return "The laptop's fine with the new password. Has every other device in the house been given it?";
    return null;
  },
  proves(f) { return f.dev === "laptop" && f.cmd === "ping" && f.beyond && f.internet; },
  proofText: "a ping to an internet address from the laptop that gets replies",
  evidence: [
    { id: "if", test: function (f) { return f.cmd === "netsh-if" && f.dev === "laptop" && f.ap === "twin"; }, text: function (f) { return "netsh wlan show interfaces on the laptop: BSSID " + f.bssid + ", Authentication " + f.auth; } },
    { id: "nets", test: function (f, v, sim) { return f.cmd === "netsh-nets" && f.dev === "laptop" && f.twice.indexOf(sim.d.router.wifi.ssid) >= 0; }, text: function (f, v, sim) { return "netsh wlan show networks on the laptop: " + sim.d.router.wifi.ssid + " listed twice, once secured and once open"; } },
    { id: "ip", test: function (f) { return f.cmd === "ipconfig" && f.dev === "laptop" && f.ip && f.ip.indexOf("172.20.10.") === 0; }, text: function (f) { return "ipconfig on the laptop: " + f.ip + ", gateway " + f.gw; } },
    { id: "out", test: function (f) { return f.cmd === "ping" && f.dev === "laptop" && f.kind === "net-unreachable"; }, text: function (f) { return "ping " + f.ip + " from the laptop: Destination net unreachable (from 172.20.10.1)"; } },
    { id: "router", test: function (f) { return f.page === "router-wifi"; }, text: function (f, v, sim) { return "Router Wi-Fi page: Security " + f.sec + "; its radios are " + sim.aps().filter(function (a) { return a.id === "router"; }).map(function (a) { return a.mac.toUpperCase().replace(/-/g, ":"); }).join(" and "); } },
    { id: "clients", test: function (f, v, sim) { return f.page === "router-clients" && !f.rows.some(function (r) { return r[1] === sim.d.laptop.ifaces[0].mac; }); }, text: function () { return "Router DHCP clients: the laptop isn't on the list"; } }
  ],
  summary(v) { return { cause: "A hotspot outside the house was broadcasting the house's own network name, open, with a fake \"firmware update\" page. When the laptop dropped off, clicking the name again joined the open copy (BSSID " + v.twinMac + ", not the router's), and the Wi-Fi password went into its page. The hotspot has no internet: the laptop was cut off, and the password was given away.", fix: "Forgot the open network on the laptop and joined the real, secured one; changed the Wi-Fi password on the router, since it had been given away; and gave the new password to the laptop and the phone." }; }
};

export const HOME_TICKETS = [HOME01, HOME02, HOME03, HOME04, HOME05, HOME06, HOME07, HOME08, HOME09, HOME10, HOME11, HOME12, HOME13, HOME14, HOME15];
export const HOME_COMING = [];
