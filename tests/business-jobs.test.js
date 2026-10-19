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
const run = (J, acts) => { for (const a of acts) { const r = B.act(J, a); assert.notEqual(r && r.result && r.result.ok, false, "refused: " + JSON.stringify(a) + " " + JSON.stringify(r && r.result)); } };
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
    J = B.open(def, s); run(J, def.solve(J.v, J.sim)); c = B.check(J);
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
      p.guestSsid, p.guestPw, p.guestAcl, p.vlans.guest.name, "dot1Q " + p.vlans.guest.id, "vlan " + p.vlans.guest.id, p.apDesc];
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
    const devs = ["rtr", "msw", "tech", "pc", "mgr", "bpc", "printer", "modem"].concat(J.sim.d.router ? ["router"] : [], J.sim.d.ap ? ["ap", "injector"] : []);
    const P = { rtr: ["Gi0/0", "Gi0/1", "Gi0/2", "Gi0/7", "CONSOLE"], msw: ["1", "2", "4", "5", "24", "CONSOLE"], tech: ["USB-C", "ETH"], pc: ["NIC"], mgr: ["NIC"], bpc: ["NIC"], printer: ["NET"], modem: ["ETH"], router: ["LAN 1", "WAN"], ap: ["ETH"], injector: ["DATA IN", "PoE OUT"] };
    const LINES = ["", "enable", p.rtSecret, p.swSecret, p.rtConsole, p.swConsole, "configure terminal", "end", "exit", "interface gi0/0", "interface gi0/1", "interface gi0/1." + p.vlans.staff.id, "interface gi0/24", "interface gi0/2",
      "shutdown", "no shutdown", "ip address dhcp", "ip address " + p.lanGw + " " + p.mask, "ip nat inside", "ip nat outside", "encapsulation dot1Q " + p.vlans.staff.id, "switchport mode trunk", "switchport mode access", "switchport access vlan " + p.vlans.staff.id,
      "vlan " + p.vlans.staff.id, "name STAFF", "vlan " + p.vlans.guest.id, "interface gi0/5", "switchport trunk allowed vlan 1," + p.vlans.guest.id, "ip access-group GUEST-IN in", "ip access-list extended GUEST-IN", "deny ip any any", "permit ip any any", "ip dhcp pool X", "network " + p.lan + " " + p.mask, "default-router " + p.lanGw, "access-list 1 permit any", "ip nat inside source list 1 interface gi0/0 overload", "hostname X1",
      "copy running-config startup-config", "reload", "no", "show ip interface brief", "show ip nat translations", "show vlan brief", "?"];
    for (let k = 0; k < 40; k++) {
      const pick = R();
      if (pick < 0.1) B.act(J, { t: "place", dev: R.pick(devs), room: R.pick(rooms) });
      else if (pick < 0.3) { const a = R.pick(devs), b = R.pick(devs); B.act(J, { t: "lay", a: E(a, R.pick(P[a])), b: E(b, R.pick(P[b])) }); }
      else if (pick < 0.4) { const c = R.pick(J.sim.net.cables.filter((x) => x.kind !== "coax")); if (c) B.act(J, { t: "pull", cable: c.id }); }
      else if (pick < 0.85) B.act(J, cli(R.pick(LINES)));
      else if (pick < 0.88) B.act(J, { t: "power", dev: R.pick(["rtr", "msw"]) });
      else if (pick < 0.9 && J.sim.d.ap) B.act(J, R() < 0.5 ? { t: "apnet", dev: "ap", net: { ssid: R.pick([p.guestSsid, "Test"]), sec: R.pick(["WPA2-Personal", "Open", "WPA3-Personal"]), psk: R.pick([p.guestPw, "short", "password123"]), vlan: R.pick(["", p.vlans.guest.id, 7]) } } : { t: "joinssid", dev: "guest", ssid: R.pick([p.guestSsid, "Test"]), pass: R.pick([p.guestPw, "nope-nope"]) });
      else B.act(J, { t: "cmd", dev: R.pick(["pc", "mgr", "bpc"]), line: R.pick(["ipconfig", "ipconfig /renew", "ping " + p.lanGw, "ping 8.8.8.8", "tracert 8.8.8.8"]) });
      for (const q of def.reqs) { const c = B.evaluate(q, J.sim, J.v); assert.ok(typeof c.ev === "string" && c.ev.length > 10, def.id + " " + q.id + ": empty evidence"); if (!c.ok) assert.ok(c.list.filter((x) => !x.skip).length >= 2, def.id + " " + q.id + ": a failing line needs two causes or more"); }
    }
    const K = B.restore(def, JSON.parse(JSON.stringify(B.save(J))));
    assert.equal(JSON.stringify(K.sim.net), JSON.stringify(J.sim.net), "random business work replays exactly");
    assert.equal(prompt(K.sim, "tech"), prompt(J.sim, "tech"));
  }
});
