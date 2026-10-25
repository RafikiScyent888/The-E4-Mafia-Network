/* Level 3, SB-J3's page parts (js/net/pages.js, js/net/physical.js): a business PC's web browser, the visitor's phone at the
   business, the ceiling access point's Physical tab. The access point's own page opens only through the network, for the
   real reason; nothing a page shows changes the network. */
import test from "node:test";
import assert from "node:assert/strict";
import { BUSINESS_JOBS } from "../js/build/business.js";
import { JOBS } from "../js/build/jobs.js";
import { OFFICE_JOBS } from "../js/build/office.js";
import * as B from "../js/build/engine.js";
import { tabsFor, page, browse } from "../js/net/pages.js";
import { physicalState } from "../js/net/physical.js";

const N = Number(process.env.SEEDS || 40);
const SB3 = BUSINESS_JOBS.find((d) => d.id === "SB-J3");
const seeds = Array.from({ length: N }, (_, i) => 9000 + i * 7919);
const solved = (s, until) => { const J = B.open(SB3, s), sol = SB3.solve(J.v, J.sim); for (const a of sol) { if (until && until(a)) break; B.act(J, a); } return J; };
const ring = (sim) => physicalState(sim, "ap").leds.find((l) => l.role === "ring");
/* everything a page could change: the network, and what each computer has learnt (its ARP table, whose turn it is on a shared address) */
const state = (sim) => JSON.stringify([sim.net, sim.arp, sim.turns || {}]);

test("a business PC has a web browser; nothing else gains one; the access point's settings are only on its page", () => {
  const J = B.open(SB3, seeds[0]);
  for (const id of ["pc", "mgr", "bpc"]) assert.ok(tabsFor(J.sim, id).some((t) => t.key === "browser"), id + " has a web browser");
  assert.deepEqual(tabsFor(J.sim, "ap").map((t) => t.key), ["physical"], "the access point: its Physical tab only");
  assert.ok(!tabsFor(J.sim, "guest").some((t) => t.key === "browser"), "the visitor's phone has no browser here");
  assert.ok(tabsFor(B.open(BUSINESS_JOBS[0], seeds[0]).sim, "pc").some((t) => t.key === "browser"), "SB-J1's business PCs have one too");
  for (const J of [B.open(JOBS[0], seeds[0]), B.open(OFFICE_JOBS[0], seeds[0])]) assert.ok(!tabsFor(J.sim, "pc").some((t) => t.key === "browser"), J.def.id + ": a house's or an office's PC has none");
});

test("the browser: the access point's page once it has an address and a way to it, the browser's own words otherwise; it changes nothing", () => {
  for (const s of seeds) {
    const J0 = B.open(SB3, s), p = J0.v.plan, before = state(J0.sim);
    assert.equal(browse(J0.sim, "mgr", "").status, "blank");
    assert.equal(browse(J0.sim, "mgr", "ap.local").code, "DNS_PROBE_FINISHED_NXDOMAIN", "a name: no such host");
    assert.equal(browse(J0.sim, "mgr", p.lanGw).code, "ERR_CONNECTION_REFUSED", "the router: managed from its command line");
    assert.equal(browse(J0.sim, "mgr", p.swIp).code, "ERR_CONNECTION_REFUSED", "the switch: the same");
    assert.equal(browse(J0.sim, "mgr", J0.sim.addr("pc").ip).code, "ERR_CONNECTION_TIMED_OUT", "another PC: Windows' firewall drops it");
    assert.equal(state(J0.sim), before, "browsing changed the network, seed " + s);
    /* the work done: its address is on the old network, the page opens from the manager's PC, and lists the guest network */
    const J = solved(s), ip = J.sim.addr("ap").ip, was = state(J.sim), P = browse(J.sim, "mgr", ip);
    assert.ok(ip.startsWith(p.lan.replace(/\.0$/, ".")), "the access point's address is on the old network, seed " + s);
    assert.equal(P.status, "ap", "the page opens, seed " + s);
    assert.deepEqual(P.networks.map((n) => [n.ssid, n.vlan]), [[p.guestSsid, p.vlans.guest.id]]);
    assert.equal(browse(J.sim, "mgr", "http://" + ip).status, "ap", "http:// reaches it too");
    assert.equal(browse(J.sim, "mgr", ip + ":22").code, "ERR_CONNECTION_REFUSED", "nothing on another port");
    assert.equal(browse(J.sim, "pc", ip).status, "ap", "from any staff PC");
    assert.ok(!JSON.stringify(P).includes(p.guestPw), "the page never shows the network's password");
    assert.equal(state(J.sim), was, "opening the access point's page changed the network, seed " + s);
  }
});

test("the access point's page is unreachable for the real reason: no address yet, no power, or its port not carrying its own network", () => {
  for (const s of seeds.slice(0, 12)) {
    /* before the switch's port is opened: no address at all */
    const J = solved(s, (a) => a.t === "cmd" && /^switchport mode trunk$/.test(a.line)), ap = J.sim.addr("ap");
    assert.ok(!ap || ap.kind === "apipa", "no address before its port is open, seed " + s);
    /* solved, then its plug pulled at the injector's output: no power, no page */
    const K = solved(s), ip = K.sim.addr("ap").ip, c = K.sim.cableAt("ap", "ETH");
    c[c.a.dev === "ap" ? "a" : "b"].seated = false;
    assert.equal(browse(K.sim, "mgr", ip).code, "ERR_CONNECTION_TIMED_OUT", "unplugged: nothing answers, seed " + s);
    /* solved, then its port's native VLAN moved off the old network: the access point keeps its lease but can't be reached */
    const L = solved(s); B.act(L, { t: "cmd", dev: "tech", line: "", cli: true });
    const ip2 = L.sim.addr("ap").ip, sw = L.sim.d.msw.sw.ports["GigabitEthernet0/" + L.v.plan.apPort];
    sw.native = L.v.plan.vlans.staff.id;
    assert.notEqual(browse(L.sim, "mgr", ip2).status, "ap", "its untagged frames on the wrong VLAN: no page, seed " + s);
  }
});

test("the visitor's phone at the business: the networks it hears, joined by name with the password typed in", () => {
  for (const s of seeds.slice(0, 12)) {
    const J = solved(s, (a) => a.t === "joinssid"), p = J.v.plan;
    let P = page(J.sim, "guest", "wifi");
    assert.deepEqual(P.heard.map((n) => n.ssid), [p.guestSsid], "it hears the guest network, seed " + s);
    assert.match(P.rows[0][1], /^Not connected/);
    B.act(J, { t: "joinssid", dev: "guest", ssid: p.guestSsid, pass: "not-the-password" });
    P = page(J.sim, "guest", "wifi");
    assert.equal(P.facts.reason, "auth"); assert.match(P.rows[0][1], /the password is wrong/);
    const r = B.act(J, { t: "joinssid", dev: "guest", ssid: p.guestSsid, pass: p.guestPw });
    assert.equal(r.facts.ap, "ap"); assert.ok(r.facts.internet, "online, seed " + s);
    P = page(J.sim, "guest", "wifi");
    assert.ok(P.heard[0].now && /^Connected to /.test(P.rows[0][1]));
  }
});

test("the access point's light ring follows the simulation, and its words say the same", () => {
  for (const s of seeds.slice(0, 12)) {
    const J0 = B.open(SB3, s);
    assert.equal(ring(J0.sim).state, "off", "in its box: dark");
    const J1 = solved(s, (a) => a.t === "apnet");
    assert.deepEqual([ring(J1.sim).state, ring(J1.sim).color], ["blinking", "blue"], "on the network, no networks yet, seed " + s);
    assert.match(physicalState(J1.sim, "ap").says[0], /blinking blue/);
    const J = solved(s);
    assert.deepEqual([ring(J.sim).state, ring(J.sim).color], ["on", "blue"]);
    assert.match(physicalState(J.sim, "ap").says[0], /on, blue: on the network, broadcasting 1 network/);
    /* powered by the injector, but the switch's port shut: power, no uplink */
    B.act(J, { t: "cmd", dev: "tech", line: "", cli: true });
    J.sim.d.msw.sw.ports["GigabitEthernet0/" + J.v.plan.apPort].shutdown = true;
    assert.deepEqual([ring(J.sim).state, ring(J.sim).color], ["on", "amber"], "no link on its uplink, seed " + s);
    assert.match(physicalState(J.sim, "ap").says[0], /amber: it has power, but no link/);
  }
});

test("the DHCP trap: a guests' access list with no DHCP line leaves the visitor with no address, and Mason's hints point there", () => {
  for (const s of seeds.slice(0, 12)) {
    const J = B.open(SB3, s), p = J.v.plan, sol = SB3.solve(J.v, J.sim).filter((a) => !(a.t === "cmd" && /eq bootps$/.test(a.line)));
    for (const a of sol) B.act(J, a);
    const a = J.sim.addr("guest"), q = SB3.reqs.find((r) => r.id === "visitor"), c = B.evaluate(q, J.sim, J.v);
    assert.ok(!a || a.kind === "apipa", "no address for the visitor, seed " + s);
    assert.equal(c.real && c.real.id, "addr", "the line says it joined but got no address, seed " + s);
    const r1 = q.rung1(J.v, J.sim), r2 = q.rung2(J.v, J.sim);
    assert.match(r1, /show access-lists/); assert.match(r2, /UDP port 67/);
    for (const x of [p.guestAcl, "bootps", "permit", p.guestPw, p.vlans.guest.net]) assert.ok(r1.indexOf(x) < 0 && r2.indexOf(x) < 0, "a hint names " + x + ", seed " + s);
    /* with the line in, the hints go back to the general ones */
    const K = solved(s); assert.doesNotMatch(q.rung1(K.v, K.sim), /access-lists/);
  }
});
