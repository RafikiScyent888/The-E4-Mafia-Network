/* Tier 1 home tickets. Each one builds a client's house from the home
   template, plants its fault, and says how to tell the fault is really
   there (exhibits), what fixes it at the source (fixed), and what proves
   the fix (proves). The six options are one right answer and five near
   misses a technician really makes; each wrong one carries the reason it
   is wrong, which Mason only shows at the third rung of help. */
import { makeHome } from "../net/home.js";
import { Sim } from "../net/sim.js";
import { rng, hash } from "../net/util.js";

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

export const HOME_TICKETS = [HOME01, HOME02, HOME03, HOME04, HOME05];
/* listed in the queue; built in the next stage */
export const HOME_COMING = [
  { id: "HOME-06", n: "06", tier: "harder", title: "The printer keeps disappearing" },
  { id: "HOME-07", n: "07", tier: "harder", title: "Guests' phones can't join" },
  { id: "HOME-08", n: "08", tier: "harder", title: "The desktop is slow on the wire" },
  { id: "HOME-09", n: "09", tier: "harder", title: "Can't see the camera from outside" },
  { id: "HOME-10", n: "10", tier: "harder", title: "Some devices get 10.0.0.x addresses" }
];
