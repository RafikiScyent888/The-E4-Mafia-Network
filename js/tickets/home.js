/* Tier 1 home tickets. Each one builds a client's house from the home
   template, plants its fault, and says how to tell the fault is really
   there (exhibits), what fixes it at the source (fixed), and what proves
   the fix (proves). The six options are one right answer and five near
   misses a technician really makes; each wrong one carries the reason it
   is wrong, which Mason only shows at the third rung of help. */
import { makeHome } from "../net/home.js";
import { Sim } from "../net/sim.js";
import { rng, hash, mac } from "../net/util.js";

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

export const HOME_TICKETS = [HOME01, HOME02, HOME03, HOME04, HOME05, HOME06, HOME07, HOME08, HOME09, HOME10];
export const HOME_COMING = [];
