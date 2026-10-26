/* Level 3 build mode: the small business's work orders (js/build/business.js),
   worked on the business router's and the closet switch's own command lines. */
import test from "node:test";
import assert from "node:assert/strict";
import { BUSINESS_JOBS } from "../js/build/business.js";
import * as B from "../js/build/engine.js";
import { prompt } from "../js/net/cmd.js";
import { rng } from "../js/net/util.js";

const N = Number(process.env.SEEDS || 150);
const byId = Object.fromEntries(BUSINESS_JOBS.map((d) => [d.id, d]));
const seeds = (id) => Array.from({ length: N }, (_, i) => 9000 + i * 7919 + id.length);
const E = (dev, port) => ({ dev, port });
const cli = (line) => ({ t: "cmd", dev: "tech", line, cli: true });
const line = (J, id) => B.evaluate(J.def.reqs.find((q) => q.id === id), J.sim, J.v);
/* runs are numbered in the order they're laid, so a case that lays one cable fewer gives the console cable another number:
   pulling "the console cable" pulls whichever one is in */
const run = (J, acts) => { for (let a of acts) { if (a.t === "pull" && /^c-console-/.test(a.cable)) { const c = J.sim.cablesOf("tech").find((x) => x.kind === "console"); if (c) a = Object.assign({}, a, { cable: c.id }); } const r = B.act(J, a); assert.notEqual(r && r.result && r.result.ok, false, "refused: " + JSON.stringify(a) + " " + JSON.stringify(r && r.result)); } };
const swap = (acts, from, to) => acts.map((a) => (a.t === "cmd" && a.line === from ? Object.assign({}, a, { line: to }) : a));
const drop = (acts, pred) => acts.filter((a) => !pred(a));
/* a line put in straight after another (the first time it appears) */
const after = (acts, at, more) => { const i = acts.findIndex((a) => a.t === "cmd" && a.line === at); assert.ok(i >= 0, "no line " + at); return acts.slice(0, i + 1).concat(more.map(cli), acts.slice(i + 1)); };
const tryIt = (def, s, acts) => { const J = B.open(def, s); run(J, acts); return J; };

test("every business job starts with its work still to do, for the real reason; the solution passes every line", () => {
  for (const def of BUSINESS_JOBS) for (const s of seeds(def.id)) {
    let J = B.open(def, s), c = B.check(J);
    for (const r of c.res) {
      if ((def.already || []).indexOf(r.id) >= 0) { assert.ok(r.ok, def.id + " " + r.id + " should be met before any work, seed " + s); continue; }
      assert.equal(r.ok, false, def.id + " " + r.id + " met before any work, seed " + s); assert.ok(r.ev && r.ev.length > 10);
    }
    J = B.open(def, s);
    for (const a of def.solve(J.v, J.sim)) { const r = B.act(J, a); assert.notEqual(r && r.result && r.result.ok, false, def.id + " seed " + s + ", the solution as written refused: " + JSON.stringify(a) + " " + JSON.stringify(r && r.result)); }   /* exactly as written: its console cables by their own numbers */
    c = B.check(J);
    for (const r of c.res) assert.ok(r.ok, def.id + " " + r.id + " not met after the solution, seed " + s + ": " + r.ev);
    assert.equal(J.done, true);
  }
});

test("SB-J1: the tempting wrong ways fail the right line, for the right reason", () => {
  const def = byId["SB-J1"];
  for (const s of seeds("SB-J1").slice(0, 40)) {
    const J0 = B.open(def, s), p = J0.v.plan, sol = def.solve(J0.v, J0.sim), T = (acts) => tryIt(def, s, acts);
    assert.equal(line(T([]), "rack").real.id, "box");
    assert.equal(line(T(sol.slice(0, 1)), "rack").real.id, "cable", "in the rack, no console cable");
    let J = T(swap(sol, "enable secret " + p.rtSecret, "enable password " + p.rtSecret));
    assert.equal(line(J, "lock").real.id, "plain", "an enable password, not a secret");
    J = T(drop(sol, (a) => a.line === "login"));
    assert.equal(line(J, "lock").real.id, "conlogin", "a console password that's never asked for");
    J = T(swap(sol, "hostname " + p.rtHost, "hostname EDGE"));
    assert.equal(line(J, "lock").real.id, "name");
    /* the provider's port left shut down: no address, no internet, and nobody online */
    J = T(drop(sol, (a) => a.line === "no shutdown" && sol.indexOf(a) < sol.findIndex((x) => x.line === "interface " + p.lanPort)));
    assert.equal(line(J, "wan").real.id, "shut"); assert.ok(line(J, "lan").ok, "the inside is fine");
    assert.equal(line(J, "online").ok, false);
    /* the modem and the switch in each other's ports */
    J = T(sol.map((a) => (a.t === "lay" && a.a.dev === "modem" ? { t: "lay", a: E("modem", "ETH"), b: E("rtr", "Gi0/1") } : a.t === "lay" && a.b.dev === "msw" ? { t: "lay", a: E("rtr", "Gi0/0"), b: E("msw", "24") } : a)));
    assert.equal(line(J, "wan").real.id, "port"); assert.equal(line(J, "lan").real.id, "port");
    /* the router's cable into a switch port that's shut down */
    J = T(sol.map((a) => (a.t === "lay" && a.b.dev === "msw" ? { t: "lay", a: E("rtr", "Gi0/1"), b: E("msw", "5") } : a)));
    assert.equal(line(J, "lan").real.id, "swport");
    /* the inside address mistyped */
    J = T(swap(sol, "ip address " + p.lanGw + " " + p.mask, "ip address " + p.lanGw.replace(/\.1$/, ".2") + " " + p.mask));
    assert.equal(line(J, "lan").real.id, "wrong");
    J = T(drop(sol, (a) => a.line === "ip nat inside"));
    assert.equal(line(J, "nat").real.id, "inside"); assert.equal(line(J, "online").ok, false, "nobody gets out untranslated");
    J = T(swap(sol, "ip nat inside source list 1 interface " + p.wanPort + " overload", "ip nat inside source list 1 interface " + p.wanPort));
    assert.equal(line(J, "nat").real.id, "overload");
    J = T(swap(sol, "access-list 1 permit " + p.lan + " 0.0.0.255", "access-list 1 permit 10.99.99.0 0.0.0.255"));
    assert.equal(line(J, "nat").real.id, "list");
    J = T(drop(sol, (a) => a.line === "ip dhcp excluded-address " + p.excl[0] + " " + p.excl[1]));
    assert.equal(line(J, "dhcp").real.id, "excl");
    J = T(drop(sol, (a) => a.line === "dns-server " + p.dns.join(" ")));
    assert.equal(line(J, "dhcp").real.id, "dns");
    assert.equal(line(J, "online").real.id, "dns", "a lease with no DNS servers: online but no names");
    /* nobody renewed: the old router's lease, its DNS server the gateway's address */
    J = T(drop(sol, (a) => a.line === "ipconfig /renew"));
    assert.equal(line(J, "online").real.id, "stale");
    J = T(drop(sol, (a) => a.line === "copy running-config startup-config"));
    assert.equal(line(J, "saved").real.id, "never");
    J = T(sol.concat([cli("configure terminal"), cli("interface " + p.lanPort), cli("description CHANGED"), cli("end")]));
    assert.equal(line(J, "saved").real.id, "since", "changed after saving");
  }
});

test("SB-J1: the provider's router left on the network: two gateways, two DHCP servers", () => {
  const def = byId["SB-J1"];
  for (const s of seeds("SB-J1").slice(0, 30)) {
    const J0 = B.open(def, s), p = J0.v.plan, sol = def.solve(J0.v, J0.sim);
    /* the old router stays on the switch's port 24; the new one goes in port 5, opened on the switch's console */
    const acts = drop(sol, (a) => (a.t === "pull" && a.cable === "c-router-msw") || (a.t === "lay" && a.b.dev === "msw"))
      .concat([{ t: "lay", a: E("rtr", "Gi0/1"), b: E("msw", "5") }, { t: "pull", cable: "c-console-1" }, { t: "lay", a: E("tech", "USB-C"), b: E("msw", "CONSOLE") },
        cli(""), cli(p.swConsole), cli("enable"), cli(p.swSecret), cli("configure terminal"), cli("interface gi0/5"), cli("no shutdown"), cli("end")]);
    const J = tryIt(def, s, acts);
    assert.equal(line(J, "lan").real.id, "old");
    assert.equal(line(J, "dhcp").real.id, "old");
  }
});

test("SB-J1: other right ways pass: short port names, an extended list, the pool's lines in any order", () => {
  const def = byId["SB-J1"];
  for (const s of seeds("SB-J1").slice(0, 30)) {
    const J0 = B.open(def, s), p = J0.v.plan, sol = def.solve(J0.v, J0.sim);
    let acts = swap(swap(sol, "interface " + p.wanPort, "int g0/0"), "interface " + p.lanPort, "int g0/1");
    acts = swap(acts, "access-list 1 permit " + p.lan + " 0.0.0.255", "access-list 100 permit ip " + p.lan + " 0.0.0.255 any");
    acts = swap(acts, "ip nat inside source list 1 interface " + p.wanPort + " overload", "ip nat inside source list 100 interface g0/0 overload");
    const i = acts.findIndex((a) => a.line === "default-router " + p.lanGw), j = acts.findIndex((a) => a.line === "dns-server " + p.dns.join(" "));
    [acts[i], acts[j]] = [acts[j], acts[i]];
    const J = tryIt(def, s, acts);
    for (const r of B.check(J).res) assert.ok(r.ok, "SB-J1 " + r.id + ", seed " + s + ": " + r.ev);
  }
});

test("SB-J2: the tempting wrong ways fail the right line, for the right reason", () => {
  const def = byId["SB-J2"];
  for (const s of seeds("SB-J2").slice(0, 40)) {
    const J0 = B.open(def, s), p = J0.v.plan, S = p.vlans.staff, sol = def.solve(J0.v, J0.sim), T = (acts) => tryIt(def, s, acts);
    const sub = p.lanPort + "." + S.id;
    let J = T(swap(sol, "name " + S.name, "name OFFICE"));
    assert.equal(line(J, "vlan").real.id, "name");
    /* left to negotiate: the router never asks, so it stays an access port */
    J = T(swap(sol, "switchport mode trunk", "switchport mode dynamic desirable"));
    assert.equal(line(J, "trunk").real.id, "mode"); assert.equal(line(J, "moved").ok, false);
    J = T(after(sol, "switchport mode trunk", ["switchport trunk allowed vlan 1"]));
    assert.equal(line(J, "trunk").real.id, "allowed");
    J = T(after(sol, "switchport mode trunk", ["switchport trunk native vlan " + S.id]));
    assert.equal(line(J, "trunk").real.id, "native");
    J = T(swap(sol, "encapsulation dot1Q " + S.id, "encapsulation dot1Q " + (S.id + 1)));
    assert.equal(line(J, "sub").real.id, "tag");
    J = T(swap(sol, "interface " + sub, "interface " + p.wanPort + "." + S.id));
    assert.equal(line(J, "sub").real.id, "other", "the subinterface on the provider's port");
    J = T(swap(sol, "ip address " + S.gw + " " + p.vmask, "ip address " + S.gw.replace(/\.1$/, ".254") + " " + p.vmask));
    assert.equal(line(J, "sub").real.id, "addr");
    J = T(drop(sol, (a) => a.line === "ip nat inside"));
    assert.equal(line(J, "sub").real.id, "nat"); assert.equal(line(J, "moved").real.id, "net", "staff have addresses but never get out");
    J = T(drop(sol, (a) => a.line === "access-list 1 permit " + S.net + " 0.0.0.255"));
    assert.equal(line(J, "sub").real.id, "list");
    J = T(drop(sol, (a) => /^ip dhcp excluded-address/.test(a.line || "")));
    assert.equal(line(J, "pool").real.id, "excl");
    J = T(drop(sol, (a) => a.line === "dns-server " + p.dns.join(" ")));
    assert.equal(line(J, "pool").real.id, "dns");
    J = T(drop(sol, (a) => a.line === "default-router " + S.gw));
    assert.equal(line(J, "pool").real.id, "gw");
    /* the back-of-house PC's port forgotten */
    J = T(drop(sol, (a) => a.line === "interface gi0/4" || (a.line === "switchport access vlan " + S.id && sol.indexOf(a) > sol.findIndex((x) => x.line === "interface gi0/4"))));
    assert.equal(line(J, "moved").real.id, "port");
    assert.match(line(J, "moved").ev, new RegExp(J.sim.d.bpc.label.slice(1)));
    J = T(drop(sol, (a) => a.line === "ipconfig /renew"));
    assert.equal(line(J, "moved").real.id, "renew");
    /* the switch saved before its ports moved; the router never saved */
    J = T(sol.filter((a, k) => !(a.line === "copy running-config startup-config" && k > sol.findIndex((x) => x.line === "encapsulation dot1Q " + S.id))));
    assert.equal(line(J, "saved").real.id, "since"); assert.ok(line(J, "swsaved").ok);
    J = T(drop(sol, (a) => a.line === "copy running-config startup-config" && sol.indexOf(a) < sol.findIndex((x) => x.line === "encapsulation dot1Q " + S.id)));
    assert.equal(line(J, "swsaved").real.id, "since"); assert.ok(line(J, "saved").ok);
  }
});

test("SB-J2: other right ways pass: a subinterface numbered its own way, the trunk spelled out, access mode left to default", () => {
  const def = byId["SB-J2"];
  for (const s of seeds("SB-J2").slice(0, 30)) {
    const J0 = B.open(def, s), p = J0.v.plan, S = p.vlans.staff, sol = def.solve(J0.v, J0.sim);
    let acts = swap(sol, "interface " + p.lanPort + "." + S.id, "interface g0/1.7");
    acts = after(acts, "switchport mode trunk", ["switchport trunk native vlan 1", "switchport trunk allowed vlan 1," + S.id]);
    acts = drop(acts, (a) => a.line === "switchport mode access");
    const J = tryIt(def, s, acts);
    for (const r of B.check(J).res) assert.ok(r.ok, "SB-J2 " + r.id + ", seed " + s + ": " + r.ev);
  }
});

test("SB-J3: the tempting wrong ways fail the right line, for the right reason", () => {
  const def = byId["SB-J3"];
  for (const s of seeds("SB-J3").slice(0, 25)) {
    const J0 = B.open(def, s), p = J0.v.plan, G = p.vlans.guest, S = p.vlans.staff, sol = def.solve(J0.v, J0.sim), T = (acts) => tryIt(def, s, acts);
    const apnet = (net) => sol.map((a) => (a.t === "apnet" ? { t: "apnet", dev: "ap", net: Object.assign({}, a.net, net) } : a));
    const w = "0.0.0.255", aclLines = ["permit udp any any eq bootps", "deny ip " + G.net + " " + w + " " + S.net + " " + w, "deny ip " + G.net + " " + w + " " + p.lan + " " + w, "permit ip " + G.net + " " + w + " any"];
    /* the guests' list taken out whole: its header, its lines, and the exit that closes it (left behind, that exit would take the
       router out of configuration mode and everything typed after it would be refused) */
    const noAcl = (acts) => { const i = acts.findIndex((a) => a.line === "ip access-list extended " + p.guestAcl), j = acts.findIndex((a, k) => k > i && a.line === "exit"); return acts.filter((a, k) => k < i || k > j); };
    /* power: straight off the switch, the injector the wrong way round, its adapter out */
    let J = T(sol.map((a) => (a.t === "lay" && a.b.dev === "injector" ? { t: "lay", a: E("msw", p.apPort), b: E("ap", "ETH") } : a)).filter((a) => !(a.t === "lay" && a.a.dev === "injector")));
    assert.equal(line(J, "mount").real.id, "switch", "straight off a switch with no PoE");
    J = T(sol.map((a) => (a.t === "lay" && a.b.dev === "injector" ? { t: "lay", a: E("msw", p.apPort), b: E("injector", "PoE OUT") } : a.t === "lay" && a.a.dev === "injector" ? { t: "lay", a: E("injector", "DATA IN"), b: E("ap", "ETH") } : a)));
    assert.equal(line(J, "mount").real.id, "datain", "the injector the wrong way round");
    J = T(sol.concat([{ t: "injector", dev: "injector", values: { power: false } }]));
    assert.equal(line(J, "mount").real.id, "adapter");
    J = T(sol.map((a) => (a.t === "place" && a.dev === "ap" ? { t: "place", dev: "ap", room: "closet" } : a)));
    assert.equal(line(J, "mount").real.id, "room", "the access point left in the closet");
    /* the switch port */
    J = T(drop(sol, (a) => a.line === "no shutdown"));
    assert.equal(line(J, "uplink").real.id, "shut"); assert.equal(line(J, "visitor").ok, false);
    J = T(swap(sol, "description " + p.apDesc, "description AP"));
    assert.equal(line(J, "uplink").real.id, "desc");
    J = T(sol.map((a) => (a.t === "lay" && a.b.dev === "injector" ? { t: "lay", a: E("msw", "6"), b: E("injector", "DATA IN") } : a)));
    assert.equal(line(J, "uplink").real.id, "port", "the run in a port the records keep for something else");
    /* the trunk */
    J = T(drop(sol, (a) => a.line === "switchport mode trunk" && sol.indexOf(a) > sol.findIndex((x) => x.line === "interface gi0/" + p.apPort)));
    assert.equal(line(J, "trunk").real.id, "mode", "left to negotiate: an access point never asks, so it's an access port");
    J = T(swap(sol, "switchport trunk allowed vlan 1," + G.id, "switchport trunk allowed vlan 1"));
    assert.equal(line(J, "trunk").real.id, "allowed"); assert.equal(line(J, "visitor").ok, false);
    J = T(after(sol, "switchport trunk allowed vlan 1," + G.id, ["switchport trunk native vlan " + G.id]));
    assert.equal(line(J, "trunk").real.id, "native");
    J = T(after(sol, "no shutdown", ["interface gi0/24", "switchport trunk allowed vlan 1," + S.id]));   /* still in configuration mode: a line straight after a copy would answer its filename prompt */
    assert.equal(line(J, "trunk").real.id, "uplink", "the trunk to the router doesn't carry the guest VLAN");
    /* the access point's network */
    J = T(apnet({ vlan: "" }));
    assert.equal(line(J, "ssid").real.id, "untagged"); assert.equal(line(J, "visitor").real.id, "lan", "untagged: the visitor lands on the business's own network");
    J = T(apnet({ sec: "Open", psk: "" }));
    assert.equal(line(J, "ssid").real.id, "open");
    J = T(apnet({ sec: "WPA3-Personal" }));
    assert.equal(line(J, "ssid").real.id, "wpa3");
    J = T(apnet({ psk: "Welcome123!" }));
    assert.equal(line(J, "ssid").real.id, "pw"); assert.equal(line(J, "visitor").real.id, "auth", "the visitor types the card's password: rejected");
    J = T(apnet({ vlan: G.id + 1 }));
    assert.equal(line(J, "ssid").real.id, "vlan");
    J = T(sol.slice(0, -1).concat([{ t: "apnet", dev: "ap", net: { ssid: "Test", sec: "Open", psk: "", vlan: "" } }], sol.slice(-1)));
    assert.equal(line(J, "ssid").real.id, "extra", "a test network left on the air");
    J = T(sol.map((a) => (a.t === "joinssid" ? Object.assign({}, a, { pass: p.guestPw.slice(0, -1) }) : a)));
    assert.equal(line(J, "visitor").real.id, "auth");
    /* the access list */
    J = T(drop(noAcl(sol), (a) => a.line === "ip access-group " + p.guestAcl + " in"));
    assert.equal(line(J, "apart").real.id, "staff", "no access list: guests reach the staff PCs"); assert.ok(line(J, "visitor").ok);
    J = T(swap(sol, "ip access-group " + p.guestAcl + " in", "ip access-group " + p.guestAcl + " out"));
    assert.equal(line(J, "visitor").real.id, "net", "applied out: it filters what comes back to the guests, internet replies too: an address, no internet");
    J = T(drop(sol, (a) => a.line === "permit udp any any eq bootps"));
    assert.equal(line(J, "visitor").real.id, "addr", "no permit for DHCP: the DISCOVER from 0.0.0.0 is dropped, so no address");
    J = T(noAcl(sol).map((a) => (a.line === "ip access-group " + p.guestAcl + " in" ? Object.assign({}, a, { line: "ip access-group 41 in" }) : a)).concat([cli("configure terminal"), cli("access-list 41 permit " + G.net + " " + w), cli("end"), { t: "joinssid", dev: "guest", ssid: p.guestSsid, pass: p.guestPw }]));
    assert.equal(line(J, "visitor").real.id, "addr", "a standard list of the guests' own network: it doesn't take the DISCOVER either");
    J = T(swap(sol, "interface " + p.lanPort + "." + G.id, "interface " + p.lanPort + "." + S.id));
    assert.equal(line(J, "staff").ok, false, "the guests' list put on the staff subinterface stops staff");
    J = T(drop(sol, (a) => a.line === "ip nat inside" && sol.indexOf(a) > sol.findIndex((x) => x.line === "interface " + p.lanPort + "." + G.id)));
    assert.equal(line(J, "sub").real.id, "nat"); assert.equal(line(J, "visitor").real.id, "net");
    /* saving */
    J = T(drop(sol, (a) => a.line === "copy running-config startup-config" && sol.indexOf(a) > sol.findIndex((x) => x.line === "interface " + p.lanPort + "." + G.id)));
    assert.equal(line(J, "saved").real.id, "since"); assert.ok(line(J, "swsaved").ok);
  }
});

test("SB-J3: other right ways pass: WPA2/WPA3, every VLAN left allowed, a DHCP line of its own, a list of another name", () => {
  const def = byId["SB-J3"];
  for (const s of seeds("SB-J3").slice(0, 25)) {
    const J0 = B.open(def, s), p = J0.v.plan, G = p.vlans.guest, sol = def.solve(J0.v, J0.sim);
    let acts = sol.map((a) => (a.t === "apnet" ? { t: "apnet", dev: "ap", net: Object.assign({}, a.net, { sec: "WPA2/WPA3-Personal" }) } : a));
    acts = drop(acts, (a) => a.line === "switchport trunk allowed vlan 1," + G.id);
    acts = swap(acts, "permit udp any any eq bootps", "permit udp any eq bootpc any eq bootps");
    acts = acts.map((a) => (a.line ? Object.assign({}, a, { line: a.line.replace(p.guestAcl, "VISITORS") }) : a));
    const J = tryIt(def, s, acts);
    for (const r of B.check(J).res) assert.ok(r.ok, "SB-J3 " + r.id + ", seed " + s + ": " + r.ev);
  }
});

/* SB-J4 is typed at two consoles: the back switch's, then the closet switch's. A line that appears at both is picked by where it falls */
const sb4 = (sol) => { const at = sol.findIndex((a) => a.t === "lay" && a.b.dev === "msw" && a.b.port === "CONSOLE"); return { back: (l) => (a, k) => k < at && a.line === l, closet: (l) => (a, k) => k > at && a.line === l }; };
const swapAt = (acts, where, to) => acts.map((a, k) => (where(a, k) ? Object.assign({}, a, { line: to }) : a));
const dropAt = (acts, where) => acts.filter((a, k) => !where(a, k));

test("SB-J4: the tempting wrong ways fail the right line, for the right reason", () => {
  const def = byId["SB-J4"];
  for (const s of seeds("SB-J4").slice(0, 25)) {
    const J0 = B.open(def, s), p = J0.v.plan, S = p.vlans.staff, G = p.vlans.guest, N = p.vlans.native, Tr = p.trunk, sol = def.solve(J0.v, J0.sim), T = (acts) => tryIt(def, s, acts), at = sb4(sol);
    const relay = (fn) => sol.map((a) => (a.t === "lay" && a.a.dev === "bpc" ? fn(a) : a));   /* the back PC's new run */
    assert.equal(line(T([]), "lock").real.id, "box");
    /* the trunk's two ends */
    let J = T(swapAt(sol, at.closet("switchport trunk native vlan " + N.id), "switchport trunk native vlan 1"));
    assert.equal(line(J, "trunk").real.id, "split", "native VLAN 1 at the closet end only"); assert.ok(line(J, "back").ok, "staff frames are tagged: they still cross");
    J = T(dropAt(sol, (a) => a.line === "switchport trunk native vlan " + N.id));
    assert.equal(line(J, "trunk").real.id, "native", "both ends left on VLAN 1"); assert.ok(line(J, "back").ok);
    J = T(dropAt(sol, at.back("switchport trunk allowed vlan " + S.id)));
    assert.equal(line(J, "trunk").real.id, "extra", "the back end allows every VLAN");
    J = T(swapAt(sol, at.closet("switchport trunk allowed vlan " + S.id), "switchport trunk allowed vlan " + S.id + "," + G.id));
    assert.equal(line(J, "trunk").real.id, "extra", "the guests' VLAN carried to the back room too");
    J = T(swapAt(sol, at.closet("switchport trunk allowed vlan " + S.id), "switchport trunk allowed vlan " + G.id));
    assert.equal(line(J, "trunk").real.id, "allowed"); assert.equal(line(J, "back").ok, false, "the staff VLAN never reaches the back PC");
    J = T(dropAt(sol, at.back("switchport mode trunk")));
    assert.equal(line(J, "trunk").real.id, "dtp", "the back end left dynamic: it trunks only because the closet end is a trunk"); assert.ok(line(J, "back").ok);
    J = T(swapAt(sol, at.closet("switchport mode trunk"), "switchport mode dynamic desirable"));
    assert.equal(line(J, "trunk").real.id, "dtp", "the closet end asks to trunk rather than being set as one");
    J = T(dropAt(sol, (a) => a.line === "switchport mode trunk"));
    assert.equal(line(J, "trunk").real.id, "mode", "both ends left dynamic auto: neither asks, so it's an access link"); assert.equal(line(J, "back").ok, false);
    J = T(swapAt(sol, at.closet("description " + Tr.closetDesc), "description TRUNK"));
    assert.equal(line(J, "trunk").real.id, "desc");
    J = T(dropAt(sol, at.closet("no shutdown")));
    assert.equal(line(J, "trunk").real.id, "shut", "the closet end was a spare: shut down"); assert.equal(line(J, "back").ok, false);
    /* the closet's trunk to the router typed over: port 24 instead of the records' port for the back switch */
    J = T(swapAt(sol, at.closet("interface gi0/" + Tr.closet), "interface gi0/24"));
    assert.equal(line(J, "trunk").real.id, "shut"); assert.equal(line(J, "still").ok, false, "the router's trunk now carries only the staff VLAN");
    assert.ok(line(J, "still").list.find((c) => c.id === "guest").on, "the guests are cut off too");
    /* the cabling */
    J = T(sol.map((a) => (a.t === "lay" && a.a.dev === "msw" && a.b.dev === "bsw" ? { t: "lay", a: E("msw", "22"), b: E("bsw", Tr.back) } : a)));
    assert.equal(line(J, "trunk").real.id, "ports", "the run in a closet port the records don't give it");
    J = T(sol.filter((a) => !(a.t === "lay" && a.a.dev === "msw" && a.b.dev === "bsw")));
    assert.equal(line(J, "trunk").real.id, "cable");
    J = T(sol.filter((a) => !(a.t === "pull" && a.cable === "c-msw-bpc") && !(a.t === "lay" && a.a.dev === "bpc")));
    assert.equal(line(J, "back").real.id, "old", "the PC left on its long run to the closet");
    J = T(relay((a) => ({ t: "lay", a: a.a, b: E("bsw", "2") })));
    assert.equal(line(J, "back").real.id, "port");
    /* the back switch */
    J = T(dropAt(sol, at.back("switchport access vlan " + S.id)));
    assert.equal(line(J, "back").real.id, "vlan");
    J = T(dropAt(sol, at.back("description " + p.desc["4"])));
    assert.equal(line(J, "back").real.id, "desc");
    J = T(dropAt(sol, (a, k) => at.back("vlan " + S.id)(a, k) || at.back("name " + S.name)(a, k) || (k > 0 && a.line === "exit" && sol[k - 1].line === "name " + S.name)));
    assert.equal(line(J, "vlan").real.id, "name", "never made: the access port creates it, named VLAN and its number"); assert.ok(line(J, "back").ok);
    J = T(swapAt(sol, at.back("name " + S.name), "name OFFICE"));
    assert.equal(line(J, "vlan").real.id, "name");
    J = T(swapAt(sol, at.back("enable secret " + p.swSecret), "enable password " + p.swSecret));
    assert.equal(line(J, "lock").real.id, "plain");
    J = T(dropAt(sol, at.back("login")));
    assert.equal(line(J, "lock").real.id, "conlogin");
    J = T(swapAt(sol, at.back("hostname " + p.bswHost), "hostname BACKSW"));
    assert.equal(line(J, "lock").real.id, "name");
    /* spares */
    J = T(dropAt(sol, (a, k) => a.line === "interface range gi0/25 - 28" || (a.line === "shutdown" && sol[k - 1].line === "interface range gi0/25 - 28")));
    assert.equal(line(J, "spares").real.id, "back", "the back switch's fibre slots left open");
    J = T(dropAt(sol, (a, k) => at.closet("interface gi0/4")(a, k) || at.closet("no description")(a, k) || (a.line === "shutdown" && sol[k - 1].line === "no description")));
    assert.equal(line(J, "spares").real.id, "old", "the PC's old port in the closet left open");
    J = T(dropAt(sol, at.closet("no description")));
    assert.equal(line(J, "spares").real.id, "olddesc");
    /* saving: each switch its own */
    J = T(dropAt(sol, at.back("copy running-config startup-config")));
    assert.equal(line(J, "bswsaved").real.id, "never"); assert.ok(line(J, "swsaved").ok);
    J = T(dropAt(sol, at.closet("copy running-config startup-config")));
    assert.equal(line(J, "swsaved").real.id, "since"); assert.ok(line(J, "bswsaved").ok);
  }
});

test("SB-J4: other right ways pass: one range with a comma, names spelled out, no negotiation, the PC's port left to default, no renew", () => {
  const def = byId["SB-J4"];
  for (const s of seeds("SB-J4").slice(0, 25)) {
    const J0 = B.open(def, s), p = J0.v.plan, Tr = p.trunk, sol = def.solve(J0.v, J0.sim);
    let acts = dropAt(sol, (a, k) => a.line === "interface range gi0/25 - 28" || (a.line === "shutdown" && sol[k - 1].line === "interface range gi0/25 - 28"));
    acts = swap(acts, "interface range gi0/2 - 23", "interface range gi0/2 - 23 , gi0/25 - 28");
    const at2 = sb4(acts);
    acts = swapAt(acts, at2.closet("interface gi0/" + Tr.closet), "interface GigabitEthernet0/" + Tr.closet);
    acts = swap(acts, "interface gi0/" + Tr.back, "int g0/" + Tr.back);
    acts = after(acts, "switchport trunk native vlan " + p.vlans.native.id, ["switchport nonegotiate"]);   /* the back end; the closet end below */
    const at3 = sb4(acts), k = acts.findIndex((a, i) => at3.closet("switchport trunk native vlan " + p.vlans.native.id)(a, i));
    acts = acts.slice(0, k + 1).concat([cli("switchport nonegotiate")], acts.slice(k + 1));
    acts = drop(acts, (a) => a.line === "switchport mode access" || a.line === "ipconfig /renew");
    const J = tryIt(def, s, acts);
    for (const r of B.check(J).res) assert.ok(r.ok, "SB-J4 " + r.id + ", seed " + s + ": " + r.ev);
  }
});

/* SB-J5's solution: the closet switch's lines, then the back switch's (its console laid), then the router's (its console laid) */
const sb5 = (sol) => { const b = sol.findIndex((a) => a.t === "lay" && a.b.dev === "bsw" && a.b.port === "CONSOLE"), r = sol.findIndex((a) => a.t === "lay" && a.b.dev === "rtr" && a.b.port === "CONSOLE"); return { closet: (l) => (a, k) => k < b && a.line === l, back: (l) => (a, k) => k > b && k < r && a.line === l, rtr: (l) => (a, k) => k > r && a.line === l }; };
const afterAt = (acts, where, more) => { const i = acts.findIndex((a, k) => where(a, k)); assert.ok(i >= 0, "no such line"); return acts.slice(0, i + 1).concat(more.map(cli), acts.slice(i + 1)); };

test("SB-J5: the tempting wrong ways fail the right line, for the right reason", () => {
  const def = byId["SB-J5"];
  for (const s of seeds("SB-J5").slice(0, 25)) {
    const J0 = B.open(def, s), p = J0.v.plan, S = p.vlans.staff, cv = p.vlans.cameras, Tr = p.trunk, sol = def.solve(J0.v, J0.sim), T = (acts) => tryIt(def, s, acts), at = sb5(sol);
    const [a, b] = p.cams, n3 = cv.net.replace(/\.0$/, "."), w = "0.0.0.255", sub = p.lanPort + "." + cv.id, wan = J0.sim.net.isp.wanIp;
    const relay = (test, to) => sol.flatMap((x) => (x.t === "lay" && test(x) ? to(x) : [x]));
    const fwd = (c, local, lport, ext) => "ip nat inside source static tcp " + local + " " + lport + " interface " + p.wanPort + " " + ext;
    const why = (J, id, cause) => line(J, id).list.find((c) => c.id === cause).on;
    assert.equal(line(T([]), "cam1").real.id, "box");
    /* the power: straight from a switch, into the wrong side of the injector, on the other camera's injector, the injector elsewhere */
    let J = T(relay((x) => x.a.dev === "msw" && x.b.dev === "cinj1" || x.a.dev === "cinj1", (x) => (x.a.dev === "msw" ? [{ t: "lay", a: E("msw", a.port), b: E("cam1", "LAN") }] : [])));
    assert.equal(line(J, "cam1").real.id, "switch", "neither switch gives power"); assert.equal(line(J, "view").real.id, "off");
    J = T(relay((x) => x.a.dev === "msw" && x.b.dev === "cinj1" || x.a.dev === "cinj1", (x) => (x.a.dev === "msw" ? [{ t: "lay", a: E("msw", a.port), b: E("cinj1", "PoE OUT") }, { t: "lay", a: E("cinj1", "DATA IN"), b: E("cam1", "LAN") }] : [])));
    assert.equal(line(J, "cam1").real.id, "datain");
    J = T(sol.map((x) => JSON.parse(JSON.stringify(x).replace(/"cinj1"/g, "\"cinjX\"").replace(/"cinj2"/g, "\"cinj1\"").replace(/"cinjX"/g, "\"cinj2\""))));
    assert.equal(line(J, "cam1").real.id, "label", "each camera on the other's injector: it works, but not as the records have it"); assert.equal(line(J, "cam2").real.id, "label"); assert.ok(line(J, "remote").ok);
    J = T(sol.map((x) => (x.t === "place" && x.dev === "cinj2" ? { t: "place", dev: "cinj2", room: "closet" } : x)));
    assert.equal(line(J, "cam2").real.id, "injroom", "the back door camera's injector in the closet, beside the AP's");
    J = T(relay((x) => x.a.dev === "bsw" && x.b.dev === "cinj2", () => [{ t: "lay", a: E("msw", "7"), b: E("cinj2", "DATA IN") }]));
    assert.equal(line(J, "cam2").real.id, "where", "the back door camera's run home to the closet switch, not the back switch");
    J = T(relay((x) => x.a.dev === "msw" && x.b.dev === "cinj1", () => [{ t: "lay", a: E("msw", "7"), b: E("cinj1", "DATA IN") }]));
    assert.equal(line(J, "cam1").real.id, "port"); assert.equal(line(J, "ports").real.id, "path");
    J = T(sol.map((x) => (x.t === "place" && x.dev === "cam1" ? { t: "place", dev: "cam1", room: "counter" } : x)));
    assert.equal(line(J, "cam1").real.id, "room");
    J = T(sol.concat([{ t: "injector", dev: "cinj1", values: { power: false } }]));
    assert.equal(line(J, "cam1").real.id, "adapter");
    J = T(sol.filter((x) => !(x.t === "lay" && x.a.dev === "msw" && x.b.dev === "cinj1")));
    assert.equal(line(J, "cam1").real.id, "datain2", "powered, no network");
    /* the VLAN and the ports */
    J = T(dropAt(sol, (x, k) => at.back("vlan " + cv.id)(x, k) || at.back("name " + cv.name)(x, k) || (k > 0 && x.line === "exit" && sol[k - 1].line === "name " + cv.name && at.back("exit")(x, k))));
    assert.equal(line(J, "vlan").real.id, "bname", "never made on the back switch: the access port makes it, named VLAN and its number");
    J = T(swapAt(sol, at.closet("name " + cv.name), "name CCTV"));
    assert.equal(line(J, "vlan").real.id, "cname");
    J = T(dropAt(sol, at.back("switchport mode access")));
    assert.equal(line(J, "ports").real.id, "mode", "left to negotiate: it works today, and a laptop at the back door could ask for a trunk"); assert.ok(line(J, "remote").ok);
    J = T(dropAt(sol, at.closet("no shutdown")));
    assert.equal(line(J, "ports").real.id, "shut"); assert.equal(line(J, "view").ok, false);
    J = T(swapAt(sol, at.closet("description " + a.desc), "description CAMERA"));
    assert.equal(line(J, "ports").real.id, "desc");
    J = T(dropAt(sol, at.closet("switchport access vlan " + cv.id)));
    assert.equal(line(J, "ports").real.id, "vlan", "an access port in VLAN 1: the old network");
    /* the trunks */
    J = T(dropAt(sol, at.back("switchport trunk allowed vlan add " + cv.id)));
    assert.equal(line(J, "trunks").real.id, "back"); assert.equal(line(J, "view").ok, false, "the back door camera never reaches the router");
    J = T(swapAt(sol, at.closet("switchport trunk allowed vlan add " + cv.id), "switchport trunk allowed vlan " + cv.id));
    assert.equal(line(J, "trunks").real.id, "staff", "the allowed list replaced: staff dropped"); assert.equal(line(J, "still").real.id, "net", "the back PC is cut off");
    J = T(dropAt(sol, (x) => x.line === "switchport trunk allowed vlan add " + cv.id));
    assert.equal(line(J, "trunks").real.id, "closet"); assert.ok(line(J, "still").ok);
    /* the router */
    J = T(dropAt(sol, at.rtr("ip nat inside")));
    assert.equal(line(J, "sub").real.id, "nat"); assert.equal(line(J, "remote").real.id, "inside"); assert.ok(line(J, "view").ok, "inside, the pages still open");
    J = T(swapAt(sol, at.rtr("ip dhcp excluded-address " + cv.gw + " " + n3 + p.camExcl), "ip dhcp excluded-address " + cv.gw + " " + n3 + "10"));
    assert.equal(line(J, "pool").real.id, "excl", "only the first ten kept back: the cameras' fixed addresses could be leased");
    J = T(dropAt(sol, at.rtr("default-router " + cv.gw)));
    assert.equal(line(J, "pool").real.id, "gw");
    /* the fixed addresses */
    J = T(sol.filter((x) => !(x.t === "client" && x.dev === "cam2")));
    assert.equal(line(J, "fixed").real.id, "dhcp"); assert.equal(line(J, "remote").real.id, "nobody", "the forward points at an address nobody has");
    J = T(sol.map((x) => (x.t === "client" && x.dev === "cam1" ? Object.assign({}, x, { values: Object.assign({}, x.values, { gw: n3 + "254" }) }) : x)));
    assert.equal(line(J, "fixed").real.id, "gw"); assert.equal(line(J, "view").real.id, "gateway"); assert.equal(line(J, "remote").real.id, "gateway");
    J = T(sol.map((x) => (x.t === "client" && x.dev === "cam1" ? Object.assign({}, x, { values: Object.assign({}, x.values, { ip: n3 + "21" }) }) : x)));
    assert.equal(line(J, "fixed").real.id, "ip"); assert.equal(line(J, "view").real.id, "nobody");
    /* the list on before the cameras had their addresses: their DHCP requests are dropped (the guests' trap, SB-J3) */
    J = T(afterAt(sol.filter((x) => x.t !== "client"), at.rtr("ip nat inside"), ["ip access-group " + p.camAcl + " in", "exit", "ip access-list extended " + p.camAcl, "permit tcp " + cv.net + " " + w + " eq 443 any", "exit", "interface " + sub]));
    assert.equal(line(J, "fixed").real.id, "lease"); assert.match(def.reqs.find((q) => q.id === "fixed").rung1(J.v, J.sim), /first message/);
    /* the list: none, the guests' list copied (with the cameras put in NAT's list), out instead of in, the ports the wrong way round */
    J = T(dropAt(sol, at.rtr("ip access-group " + p.camAcl + " in")));
    assert.equal(line(J, "apart").real.id, "staff"); assert.ok(line(J, "view").ok && line(J, "remote").ok, "no list: everything works, and nothing is kept apart");
    J = T(afterAt(sol.flatMap((x, k) => (at.rtr("permit tcp " + cv.net + " " + w + " eq 443 any")(x, k) ? ["deny ip " + cv.net + " " + w + " " + S.net + " " + w, "deny ip " + cv.net + " " + w + " " + p.lan + " " + w, "permit ip " + cv.net + " " + w + " any"].map(cli) : [x])),
      (x) => x.line === fwd(b, n3 + b.host, 443, b.ext), ["access-list 1 permit " + cv.net + " " + w]));
    assert.equal(line(J, "apart").real.id, "internet", "kept off the business's own networks, but free to call out to the internet");
    J = T(swapAt(sol, at.rtr("ip access-group " + p.camAcl + " in"), "ip access-group " + p.camAcl + " out"));
    assert.equal(line(J, "apart").real.id, "staff", "out: it checks what goes to the cameras, not what they send"); assert.equal(line(J, "view").real.id, "blocked");
    J = T(swapAt(sol, at.rtr("permit tcp " + cv.net + " " + w + " eq 443 any"), "permit tcp " + cv.net + " " + w + " any eq 443"));
    assert.equal(line(J, "apart").real.id, "staff", "to 443, not from it: a camera can open HTTPS to anything"); assert.equal(line(J, "view").real.id, "reply"); assert.equal(line(J, "remote").real.id, "reply");
    /* the forwards */
    J = T(swapAt(swapAt(sol, at.rtr(fwd(a, n3 + a.host, 443, a.ext)), fwd(a, n3 + b.host, 443, a.ext)), at.rtr(fwd(b, n3 + b.host, 443, b.ext)), fwd(b, n3 + a.host, 443, b.ext)));
    assert.equal(line(J, "remote").real.id, "swap");
    J = T(swapAt(sol, at.rtr(fwd(a, n3 + a.host, 443, a.ext)), fwd(a, n3 + a.host, 80, a.ext)));
    assert.equal(line(J, "remote").real.id, "http", "to the camera's plain page: the manager's password in plain text");
    J = T(swapAt(sol, at.rtr(fwd(a, n3 + a.host, 443, a.ext)), fwd(a, n3 + a.host, a.ext, a.ext)));
    assert.equal(line(J, "remote").real.id, "port", "the outside port sent on unchanged: the camera doesn't answer there");
    J = T(swapAt(sol, at.rtr(fwd(a, n3 + a.host, 443, a.ext)), fwd(a, n3 + a.host, 443, 443)));
    assert.equal(line(J, "remote").real.id, "forward", "the camera on the router's 443, not the records' port");
    J = T(afterAt(sol, at.rtr(fwd(b, n3 + b.host, 443, b.ext)), ["interface " + p.wanPort, "no ip nat outside", "exit"]));
    assert.equal(line(J, "remote").real.id, "outside"); assert.equal(line(J, "still").real.id, "net");
    J = T(afterAt(sol, at.rtr(fwd(b, n3 + b.host, 443, b.ext)), ["ip access-list extended OUTSIDE-IN", "deny tcp any any eq " + a.ext, "permit ip any any", "exit", "interface " + p.wanPort, "ip access-group OUTSIDE-IN in", "exit"]));
    assert.equal(line(J, "remote").real.id, "aclin");
    /* saving: each device its own */
    J = T(dropAt(sol, at.rtr("copy running-config startup-config")));
    assert.equal(line(J, "saved").real.id, "since"); assert.ok(line(J, "swsaved").ok && line(J, "bswsaved").ok);
    J = T(dropAt(sol, at.back("copy running-config startup-config")));
    assert.equal(line(J, "bswsaved").real.id, "since"); assert.ok(line(J, "swsaved").ok);
    J = T(dropAt(sol, at.closet("copy running-config startup-config")));
    assert.equal(line(J, "swsaved").real.id, "since"); assert.ok(why(J, "swsaved", "since"));
    assert.ok(wan);
  }
});

test("SB-J5: other right ways pass: the allowed list given whole, a named port, a DHCP line in the list, the address in the forward, a subinterface numbered its own way", () => {
  const def = byId["SB-J5"];
  for (const s of seeds("SB-J5").slice(0, 25)) {
    const J0 = B.open(def, s), p = J0.v.plan, S = p.vlans.staff, cv = p.vlans.cameras, sol = def.solve(J0.v, J0.sim), at = sb5(sol), w = "0.0.0.255", wan = J0.sim.net.isp.wanIp, n3 = cv.net.replace(/\.0$/, ".");
    let acts = swap(sol, "switchport trunk allowed vlan add " + cv.id, "switchport trunk allowed vlan " + S.id + "," + cv.id);
    acts = swapAt(acts, at.rtr("permit tcp " + cv.net + " " + w + " eq 443 any"), "permit udp any any eq bootps");
    acts = afterAt(acts, at.rtr("permit udp any any eq bootps"), ["permit tcp " + cv.net + " " + w + " eq https any"]);
    acts = acts.map((a) => (a.t === "cmd" && /^ip nat inside source static tcp /.test(a.line) ? Object.assign({}, a, { line: a.line.replace("interface " + p.wanPort, wan) }) : a));
    acts = swap(swap(acts, "interface " + p.lanPort + "." + cv.id, "interface gi0/1.6" + cv.id), "ip dhcp excluded-address " + cv.gw + " " + n3 + p.camExcl, "ip dhcp excluded-address " + cv.gw + " " + n3 + "30");
    acts = acts.map((a) => (a.t === "client" ? Object.assign({}, a, { values: Object.assign({}, a.values, { dns: ["203.0.113.53"] }) }) : a));
    const J = tryIt(def, s, acts);
    for (const r of B.check(J).res) assert.ok(r.ok, "SB-J5 " + r.id + ", seed " + s + ": " + r.ev);
  }
});

test("the business jobs replay exactly, and undo takes back the last line typed", () => {
  for (const def of BUSINESS_JOBS) for (const s of seeds(def.id).slice(0, 30)) {
    const J = B.open(def, s), sol = def.solve(J.v, J.sim), half = Math.floor(sol.length / 2);
    run(J, sol.slice(0, half)); B.check(J); run(J, sol.slice(half)); B.check(J); J.notes = "plan " + s;
    const K = B.restore(def, JSON.parse(JSON.stringify(B.save(J))));
    assert.equal(JSON.stringify(K.sim.net), JSON.stringify(J.sim.net)); assert.equal(prompt(K.sim, "tech"), prompt(J.sim, "tech"));
    assert.deepEqual([K.checks, K.done, K.notes], [J.checks, J.done, J.notes]);
    const con = J.sim.cablesOf("tech").find((c) => c.kind === "console"), id = con.a.dev === "tech" ? con.b.dev : con.a.dev, was = J.sim.d[id].sw.hostname;
    B.act(J, cli("configure terminal")); B.act(J, cli("hostname TEMP")); assert.equal(J.sim.d[id].sw.hostname, "TEMP");
    const gone = B.undo(J); assert.equal(gone.line, "hostname TEMP"); assert.equal(J.sim.d[id].sw.hostname, was);
  }
});

test("Mason on the business jobs: nothing for two failing checks, then where to look, the principle, and two options forever", () => {
  for (const def of BUSINESS_JOBS) for (const s of seeds(def.id).slice(0, 40)) {
    const J = B.open(def, s), seen = [];
    for (let k = 1; k <= 10; k++) { B.check(J); const m = B.mason(J); seen.push(m ? m.rung : 0); if (m && m.rung === 3) {
      assert.match(m.text, /^It's one of these two: .+, or .+\.$/);
      const first = J.last.res.find((x) => !x.ok), c = line(J, first.id);
      assert.ok(m.text.toLowerCase().includes(c.real.text.toLowerCase()), "the real cause is one of the two");
      for (const st of m.struck) assert.equal(c.list.find((z) => z.text === st.text).on, false, "struck only what the network has ruled out");
    } }
    assert.deepEqual(seen, [0, 0, 1, 2, 3, 3, 3, 3, 3, 3], def.id + " ladder");
  }
});

test("no help on the business jobs names the answer: no name, password, VLAN number or address", () => {
  for (const def of BUSINESS_JOBS) for (const s of seeds(def.id).slice(0, 30)) {
    const J = B.open(def, s), p = J.v.plan, sol = def.solve(J.v, J.sim);
    const bad = [p.rtHost, p.rtSecret, p.rtConsole, p.swHost, p.swSecret, p.swConsole, p.user, p.userPw, p.vlans.staff.name, "dot1Q " + p.vlans.staff.id, "vlan " + p.vlans.staff.id,
      p.guestSsid, p.guestPw, p.guestAcl, p.vlans.guest.name, "dot1Q " + p.vlans.guest.id, "vlan " + p.vlans.guest.id, p.apDesc,
      p.bswHost, p.trunk.closetDesc, p.trunk.backDesc, p.desc["4"], p.vlans.native.name, "vlan " + p.vlans.native.id,
      p.camAcl, p.vlans.cameras.name, "dot1Q " + p.vlans.cameras.id, "vlan " + p.vlans.cameras.id, ...p.cams.map((c) => c.desc), ...p.cams.map((c) => String(c.ext))];
    const said = [];
    for (let k = 0; k <= sol.length; k++) {
      for (let c = 0; c < 6; c++) { B.check(J); const m = B.mason(J); if (m) said.push(m.text, m.principle || "", ...(m.struck || []).map((x) => x.text + " " + x.why)); }
      if (k < sol.length) B.act(J, sol[k]);
    }
    assert.ok(said.length > 3);
    for (const q of def.reqs) said.push(q.rung1(J.v, J.sim), q.rung2(J.v, J.sim));
    for (const t of said) { for (const b of bad) assert.ok(!t.includes(b), def.id + " gives away " + b + ": " + t); assert.ok(!new RegExp("\\b" + p.pool + "\\b").test(t), def.id + " names the pool: " + t); assert.deepEqual(t.match(/\d+\.\d+\.\d+\.\d+/g) || [], [], def.id + " names an address: " + t); }
  }
});

test("random work on the business never breaks the checker; an unmet line always has two causes or more and replays exactly", () => {
  for (const def of BUSINESS_JOBS) for (const s of seeds(def.id).slice(0, 50)) {
    const J = B.open(def, s), p = J.v.plan, R = rng(s * 17 + 3), rooms = ["closet", "counter", "office", "back"];
    const devs = ["rtr", "msw", "tech", "pc", "mgr", "bpc", "printer", "modem"].concat(J.sim.d.router ? ["router"] : [], J.sim.d.ap ? ["ap", "injector"] : [], J.sim.d.bsw ? ["bsw"] : [], J.sim.d.cam1 ? ["cam1", "cam2", "cinj1", "cinj2"] : []);
    const P = { rtr: ["Gi0/0", "Gi0/1", "Gi0/2", "Gi0/7", "CONSOLE"], msw: ["1", "2", "4", "5", "6", "23", "24", "CONSOLE"], tech: ["USB-C", "ETH"], pc: ["NIC"], mgr: ["NIC"], bpc: ["NIC"], printer: ["NET"], modem: ["ETH"], router: ["LAN 1", "WAN"], ap: ["ETH"], injector: ["DATA IN", "PoE OUT"], bsw: ["1", "2", "23", "24", "CONSOLE"],
      cam1: ["LAN"], cam2: ["LAN"], cinj1: ["DATA IN", "PoE OUT"], cinj2: ["DATA IN", "PoE OUT"] };
    const cv = p.vlans.cameras, c3 = cv.net.replace(/\.0$/, ".");
    const LINES = ["", "enable", p.rtSecret, p.swSecret, p.rtConsole, p.swConsole, "configure terminal", "end", "exit", "interface gi0/0", "interface gi0/1", "interface gi0/1." + p.vlans.staff.id, "interface gi0/24", "interface gi0/2",
      "shutdown", "no shutdown", "ip address dhcp", "ip address " + p.lanGw + " " + p.mask, "ip nat inside", "ip nat outside", "encapsulation dot1Q " + p.vlans.staff.id, "switchport mode trunk", "switchport mode access", "switchport access vlan " + p.vlans.staff.id,
      "vlan " + p.vlans.staff.id, "name STAFF", "vlan " + p.vlans.guest.id, "interface gi0/5", "switchport trunk allowed vlan 1," + p.vlans.guest.id, "ip access-group GUEST-IN in", "ip access-list extended GUEST-IN", "deny ip any any", "permit ip any any", "ip dhcp pool X", "network " + p.lan + " " + p.mask, "default-router " + p.lanGw, "access-list 1 permit any", "ip nat inside source list 1 interface gi0/0 overload", "hostname X1",
      "interface gi0/23", "switchport trunk native vlan " + p.vlans.native.id, "switchport trunk native vlan 1", "switchport trunk allowed vlan " + p.vlans.staff.id, "switchport mode dynamic desirable", "switchport nonegotiate", "interface range gi0/2 - 23 , gi0/25 - 28",
      "vlan " + cv.id, "name CAMERAS", "interface gi0/6", "switchport access vlan " + cv.id, "switchport trunk allowed vlan add " + cv.id, "interface gi0/1." + cv.id, "encapsulation dot1Q " + cv.id, "ip address " + cv.gw + " " + p.vmask,
      "ip dhcp pool CAMERAS", "network " + cv.net + " " + p.vmask, "default-router " + cv.gw, "ip access-group CAMERAS-IN in", "ip access-list extended CAMERAS-IN", "permit tcp " + cv.net + " 0.0.0.255 eq 443 any",
      "ip nat inside source static tcp " + c3 + "11 443 interface gi0/0 8443", "ip nat inside source static tcp " + c3 + "12 80 interface gi0/0 8444",
      "copy running-config startup-config", "reload", "no", "show ip interface brief", "show ip nat translations", "show vlan brief", "show interfaces trunk", "?"];
    for (let k = 0; k < 40; k++) {
      const pick = R();
      if (pick < 0.1) B.act(J, { t: "place", dev: R.pick(devs), room: R.pick(rooms) });
      else if (pick < 0.3) { const a = R.pick(devs), b = R.pick(devs); B.act(J, { t: "lay", a: E(a, R.pick(P[a])), b: E(b, R.pick(P[b])) }); }
      else if (pick < 0.4) { const c = R.pick(J.sim.net.cables.filter((x) => x.kind !== "coax")); if (c) B.act(J, { t: "pull", cable: c.id }); }
      else if (pick < 0.85) B.act(J, cli(R.pick(LINES)));
      else if (pick < 0.88) B.act(J, { t: "power", dev: R.pick(["rtr", "msw"]) });
      else if (pick < 0.9 && J.sim.d.ap) B.act(J, R() < 0.5 ? { t: "apnet", dev: "ap", net: { ssid: R.pick([p.guestSsid, "Test"]), sec: R.pick(["WPA2-Personal", "Open", "WPA3-Personal"]), psk: R.pick([p.guestPw, "short", "password123"]), vlan: R.pick(["", p.vlans.guest.id, 7]) } } : { t: "joinssid", dev: "guest", ssid: R.pick([p.guestSsid, "Test"]), pass: R.pick([p.guestPw, "nope-nope"]) });
      else if (pick < 0.93 && J.sim.d.cam1) B.act(J, R() < 0.7 ? { t: "client", dev: R.pick(["cam1", "cam2"]), values: R() < 0.2 ? { mode: "dhcp" } : { mode: "static", ip: c3 + R.pick([11, 12, 21]), mask: R.pick([p.vmask, "255.255.0.0"]), gw: R.pick([cv.gw, p.lanGw, ""]) } } : { t: "injector", dev: R.pick(["cinj1", "cinj2"]), values: { power: R() < 0.7 } });
      else B.act(J, { t: "cmd", dev: R.pick(["pc", "mgr", "bpc"]), line: R.pick(["ipconfig", "ipconfig /renew", "ping " + p.lanGw, "ping 8.8.8.8", "tracert 8.8.8.8"]) });
      for (const q of def.reqs) { const c = B.evaluate(q, J.sim, J.v); assert.ok(typeof c.ev === "string" && c.ev.length > 10, def.id + " " + q.id + ": empty evidence"); if (!c.ok) assert.ok(c.list.filter((x) => !x.skip).length >= 2, def.id + " " + q.id + ": a failing line needs two causes or more"); }
    }
    const K = B.restore(def, JSON.parse(JSON.stringify(B.save(J))));
    assert.equal(JSON.stringify(K.sim.net), JSON.stringify(J.sim.net), "random business work replays exactly");
    assert.equal(prompt(K.sim, "tech"), prompt(J.sim, "tech"));
  }
});
