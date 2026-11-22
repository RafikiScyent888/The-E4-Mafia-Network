/* Level 4 build mode: the campus's work orders (js/build/campus.js), worked on the switches' own command lines, over SSH from
   a desk PC. Each: the work still to do for the real reason; the solution passing every line; the tempting wrong ways each
   failing their own line for their own cause; other right ways passing; the help never naming a password or an address. */
import test from "node:test";
import assert from "node:assert/strict";
import { CAMPUS_JOBS } from "../js/build/campus.js";
import * as B from "../js/build/engine.js";
import { coreLinks } from "../js/net/campus.js";

const N = Number(process.env.SEEDS || 12);
const byId = Object.fromEntries(CAMPUS_JOBS.map((d) => [d.id, d]));
const seeds = (id) => Array.from({ length: N }, (_, i) => 11000 + i * 7919 + id.length);
const run = (J, acts) => { for (const a of acts) B.act(J, a); return J; };
const line = (J, id) => B.evaluate(J.def.reqs.find((q) => q.id === id), J.sim, J.v);
const swap = (acts, from, to) => acts.map((a) => (a.line === from ? Object.assign({}, a, { line: to }) : a));
const drop = (acts, pred) => acts.filter((a) => !pred(a));
const tryIt = (def, s, acts) => run(B.open(def, s), acts);

test("every campus job starts with its work still to do, for the real reason; the solution passes every line", () => {
  for (const def of CAMPUS_JOBS) for (const s of seeds(def.id)) {
    let J = B.open(def, s), c = B.check(J);
    for (const r of c.res) {
      if ((def.already || []).indexOf(r.id) >= 0) { assert.ok(r.ok, def.id + " " + r.id + " should be met before any work, seed " + s + ": " + r.ev); continue; }
      assert.equal(r.ok, false, def.id + " " + r.id + " met before any work, seed " + s); assert.ok(r.ev && r.ev.length > 10);
    }
    J = tryIt(def, s, def.solve(B.open(def, s).v)); c = B.check(J);
    for (const r of c.res) assert.ok(r.ok, def.id + " " + r.id + " not met after the solution, seed " + s + ": " + r.ev);
    assert.equal(J.done, true);
  }
});

test("each work order starts from the one before it done: every line of the one before is met", () => {
  for (let i = 1; i < CAMPUS_JOBS.length; i++) {
    const prev = CAMPUS_JOBS[i - 1], def = CAMPUS_JOBS[i];
    for (const s of seeds(def.id).slice(0, 3)) {
      const J = B.open(def, s);
      for (const q of prev.reqs) { const r = B.evaluate(q, J.sim, J.v); assert.ok(r.ok, def.id + " starts without " + prev.id + "'s " + q.id + ", seed " + s + ": " + r.ev); }
    }
  }
});

test("CP-J1: the tempting wrong ways each fail their own line for their own cause", () => {
  const def = byId["CP-J1"];
  for (const s of seeds("CP-J1").slice(0, 6)) {
    const sol = def.solve(B.open(def, s).v), first = sol.find((a) => /^interface range/.test(a.line)).line;
    const cause = (J, id) => { const r = line(J, id); return r.ok ? null : r.real.id; };
    let J = tryIt(def, s, swap(sol, first, "interface range gi0/1 - 24"));   /* the whole switch, uplinks too: BPDU guard shuts them, port security counts the floor */
    assert.ok(["err", "guard", "ps"].indexOf(cause(J, "uplinks")) >= 0, s + " uplinks: " + cause(J, "uplinks")); assert.equal(line(J, "works").ok, false, "a floor cut off");
    J = tryIt(def, s, drop(sol, (a) => a.line === "switchport port-security mac-address sticky")); assert.equal(cause(J, "ps"), "sticky");
    J = tryIt(def, s, swap(sol, "switchport port-security mac-address sticky", "switchport port-security violation restrict")); assert.ok(["viol", "sticky"].indexOf(cause(J, "ps")) >= 0, s + " " + cause(J, "ps"));
    J = tryIt(def, s, drop(sol, (a) => a.line === "spanning-tree bpduguard enable")); assert.equal(cause(J, "guard"), "none");
    J = tryIt(def, s, drop(sol, (a) => a.line === "spanning-tree portfast")); assert.equal(cause(J, "edge"), "portfast");
    const saves = sol.map((a, i) => (a.line === "copy running-config startup-config" ? i : -1)).filter((i) => i >= 0);
    J = tryIt(def, s, sol.filter((a, i) => i !== saves[1] && i !== saves[1] + 1)); assert.equal(cause(J, "saved2"), "unsaved"); assert.ok(line(J, "saved1").ok && line(J, "saved3").ok);
    /* a range that reaches the spares: opened, or moved out of the parking VLAN */
    const after = (extra) => { const i = sol.findIndex((a) => a.line === "spanning-tree bpduguard enable"); return sol.slice(0, i + 1).concat(extra.map((l) => Object.assign({}, sol[i], { line: l })), sol.slice(i + 1)); };
    J = tryIt(def, s, after(["interface range gi0/1 - 22", "no shutdown"])); assert.equal(cause(J, "spares"), "open", s + " spares opened");
    J = tryIt(def, s, after(["interface range gi0/1 - 22", "switchport access vlan " + J.v.plan.vlans.svc.id])); assert.equal(cause(J, "spares"), "park", s + " spares moved out of parking");
    J = tryIt(def, s, after(["interface range gi0/1 - 22", "switchport port-security maximum 2"])); assert.equal(cause(J, "ps"), "max", s + " two devices a port");
    /* one port missed among the rest, behind a first port that's right: each found */
    J = tryIt(def, s, after(["interface gi0/2", "switchport port-security maximum 2"])); assert.equal(cause(J, "ps"), "max", s + " one port taking two devices");
    J = tryIt(def, s, after(["interface gi0/3", "switchport port-security violation restrict"])); assert.equal(cause(J, "ps"), "viol", s + " one port only counting a stranger");
    const rng = sol.find((a) => /^interface range/.test(a.line)), part = sol.flatMap((a) => (a === rng ? [Object.assign({}, a, { line: "interface range gi0/1 - 2" })] : a.line === "spanning-tree bpduguard enable" && sol.indexOf(a) < sol.indexOf(rng) + 6 ? [a, ...["interface gi0/3", "switchport port-security", "spanning-tree portfast", "spanning-tree bpduguard enable"].map((l) => Object.assign({}, a, { line: l }))] : [a]));
    J = tryIt(def, s, part); assert.equal(cause(J, "ps"), "sticky", s + " one port not told to stick");
    /* the bench floor's range taken to every port: its PCs cut off while both printers still answer from the service desk */
    const second = sol.filter((a) => /^interface range/.test(a.line))[1].line;
    J = tryIt(def, s, swap(sol, second, "interface range gi0/1 - 24")); assert.equal(cause(J, "works"), "pc", s + " the bench floor cut off: " + cause(J, "works"));
  }
});

test("CP-J1: other right ways pass: one port at a time, violation shutdown typed out, the maximum typed as 1", () => {
  const def = byId["CP-J1"];
  for (const s of seeds("CP-J1").slice(0, 4)) {
    const sol = def.solve(B.open(def, s).v), out = [];
    sol.forEach((a) => { out.push(a); if (a.line === "switchport port-security mac-address sticky") out.push(Object.assign({}, a, { line: "switchport port-security maximum 1" }), Object.assign({}, a, { line: "switchport port-security violation shutdown" })); });
    const J = tryIt(def, s, out); assert.ok(B.check(J).res.every((r) => r.ok), s);
  }
});

test("CP-J2: the tempting wrong ways each fail their own line for their own cause", () => {
  const def = byId["CP-J2"];
  for (const s of seeds("CP-J2").slice(0, 6)) {
    const v = B.open(def, s).v, p = v.plan, sol = def.solve(v), cause = (J, id) => { const r = line(J, id); return r.ok ? null : r.real.id; };
    const L = ["svc", "bench", "office", "servers", "printers", "mgmt"].map((k) => p.vlans[k].id), list = L.join(",");
    const on = (id, lines) => ["ssh " + p.user + "@" + p.sw[id].ip, p.userPw, "enable", p.secret, "configure terminal"].concat(lines, ["end", "copy running-config startup-config", "", "exit"]).map((l) => ({ t: "cmd", dev: "sd1", line: l }));
    let J = tryIt(def, s, swap(sol, "spanning-tree vlan " + list + " root primary", "spanning-tree vlan " + L.slice(0, 5).join(",") + " root primary")); assert.equal(cause(J, "root"), "dist2", s + " a VLAN left out of the primary: the secondary is its root");
    J = tryIt(def, s, swap(swap(sol, "spanning-tree vlan " + list + " root primary", "spanning-tree vlan " + L.slice(0, 5).join(",") + " root primary"), "spanning-tree vlan " + list + " root secondary", "spanning-tree vlan " + L.slice(0, 5).join(",") + " root secondary")); assert.equal(cause(J, "root"), "left", s + " a VLAN left out of both");
    J = tryIt(def, s, on("dist1", ["spanning-tree vlan " + list + " root secondary"]).concat(on("dist2", ["spanning-tree vlan " + list + " root primary"]))); assert.equal(cause(J, "root"), "dist2", s + " swapped");
    J = tryIt(def, s, on("acc2", ["spanning-tree vlan " + list + " priority 61440"])); assert.equal(cause(J, "root"), "access", s + " the 2F switch pushed down");
    J = tryIt(def, s, on("dist1", ["spanning-tree vlan " + list + " root primary"])); assert.ok(line(J, "root").ok); assert.equal(cause(J, "backup"), "left", s + " no secondary");
    J = tryIt(def, s, on("dist1", ["spanning-tree vlan " + list + " root primary"]).concat(on("dist2", ["spanning-tree vlan " + list + " root primary"]))); assert.equal(cause(J, "root"), "dist2", s + " both told primary: the second goes under the first");
    J = tryIt(def, s, on("dist1", ["spanning-tree vlan " + list + " priority 24576"]).concat(on("dist2", ["spanning-tree vlan " + list + " priority 24576"]))); assert.ok(line(J, "root").ok); assert.equal(cause(J, "backup"), "tie", s + " a tie");
    J = tryIt(def, s, sol.concat(on("acc1", ["spanning-tree vlan " + list + " priority 28672"]))); assert.ok(line(J, "root").ok); assert.equal(cause(J, "backup"), "access", s + " an access switch beating the secondary");
    J = tryIt(def, s, sol.concat(on("acc3", ["interface range gi0/23 - 24", "switchport trunk allowed vlan remove " + p.vlans.mgmt.id]))); assert.equal(cause(J, "works"), "switch", s + " the 3F switch's management VLAN taken off its uplinks: " + cause(J, "works"));
    const saves = sol.map((a, i) => (a.line === "copy running-config startup-config" ? i : -1)).filter((i) => i >= 0);
    J = tryIt(def, s, sol.filter((a, i) => i !== saves[1] && i !== saves[1] + 1)); assert.equal(cause(J, "saved2"), "unsaved");
    J = tryIt(def, s, sol.concat(on("acc3", ["spanning-tree vlan " + list + " priority 61440"]).slice(0, -3).concat([{ t: "cmd", dev: "sd1", line: "exit" }]))); assert.equal(cause(J, "saved3"), "unsaved", s + " an access switch changed, not saved");
  }
});

test("CP-J2: other right ways pass: priorities typed, a VLAN at a time", () => {
  const def = byId["CP-J2"];
  for (const s of seeds("CP-J2").slice(0, 4)) {
    const v = B.open(def, s).v, p = v.plan, L = ["svc", "bench", "office", "servers", "printers", "mgmt"].map((k) => p.vlans[k].id);
    const on = (id, lines) => ["ssh " + p.user + "@" + p.sw[id].ip, p.userPw, "enable", p.secret, "configure terminal"].concat(lines, ["end", "write memory", "exit"]).map((l) => ({ t: "cmd", dev: "sd1", line: l }));
    let J = tryIt(def, s, on("dist1", ["spanning-tree vlan " + L.join(",") + " priority 4096"]).concat(on("dist2", ["spanning-tree vlan " + L.join(",") + " priority 8192"]))); assert.ok(B.check(J).res.every((r) => r.ok), s + " priorities typed");
    J = tryIt(def, s, on("dist1", L.map((x) => "spanning-tree vlan " + x + " root primary")).concat(on("dist2", L.map((x) => "spanning-tree vlan " + x + " root secondary")))); assert.ok(B.check(J).res.every((r) => r.ok), s + " a VLAN at a time");
  }
});

test("CP-J3: the tempting wrong ways each fail their own line for their own cause", () => {
  const def = byId["CP-J3"];
  for (const s of seeds("CP-J3").slice(0, 6)) {
    const v = B.open(def, s).v, p = v.plan, sol = def.solve(v), cause = (J, id) => { const r = line(J, id); return r.ok ? null : r.real.id; };
    const on = (id, lines) => ["ssh " + p.user + "@" + p.sw[id].ip, p.userPw, "enable", p.secret, "configure terminal"].concat(lines, ["end", "copy running-config startup-config", "", "exit"]).map((l) => ({ t: "cmd", dev: "sd1", line: l }));
    const both = (a, b) => on("dist1", a).concat(on("dist2", b || a));
    let J = B.open(def, s); assert.match(line(J, "bundle").ev, /Gi0\/2[12] Altn BLK/, s + " the evidence names the blocked port: " + line(J, "bundle").ev);
    J = tryIt(def, s, on("dist1", ["interface range gi0/21 - 22", "channel-group 1 mode active"])); assert.equal(cause(J, "bundle"), "alone", s + " one end");
    J = tryIt(def, s, both(["interface range gi0/21 - 22", "channel-group 1 mode passive"])); assert.equal(cause(J, "bundle"), "passive", s + " passive, passive");
    J = tryIt(def, s, both(["interface range gi0/21 - 22", "channel-group 1 mode on"], ["interface range gi0/21 - 22", "channel-group 1 mode active"])); assert.equal(cause(J, "bundle"), "mixed", s + " on and LACP");
    J = tryIt(def, s, both(["interface range gi0/21 - 22", "channel-group 1 mode on"])); assert.equal(cause(J, "bundle"), "on", s + " on, on");
    J = tryIt(def, s, both(["interface gi0/21", "channel-group 1 mode active"])); assert.equal(cause(J, "bundle"), "one", s + " one link each end");
    J = tryIt(def, s, sol.concat(on("dist1", ["interface gi0/22", "switchport trunk allowed vlan remove " + p.vlans.mgmt.id]))); assert.equal(cause(J, "bundle"), "susp", s + " a member changed on its own");
    J = tryIt(def, s, sol.concat(on("dist1", ["interface gi0/22", "shutdown"]))); assert.equal(cause(J, "bundle"), "down", s + " a member shut");
    J = tryIt(def, s, sol.concat(both(["interface port-channel 1", "switchport trunk allowed vlan " + p.vlans.svc.id]))); assert.ok(line(J, "bundle").ok); assert.equal(cause(J, "trunk"), "allowed", s + " the port-channel's list replaced");
    const L = ["svc", "bench", "office", "servers", "printers", "mgmt"].map((k) => p.vlans[k].id).join(",");
    J = tryIt(def, s, sol.concat(on("dist1", ["no spanning-tree vlan " + L]))); assert.equal(cause(J, "root"), "dist2", s + " distribution switch 1's priority taken off on the way");
    const saves = sol.map((a, i) => (a.line === "copy running-config startup-config" ? i : -1)).filter((i) => i >= 0);
    J = tryIt(def, s, sol.filter((a, i) => i !== saves[0] && i !== saves[0] + 1)); assert.equal(cause(J, "saved1"), "unsaved");
  }
});

test("CP-J3: other right ways pass: active with passive, a different group number at each end, typed port by port", () => {
  const def = byId["CP-J3"];
  for (const s of seeds("CP-J3").slice(0, 4)) {
    const v = B.open(def, s).v, p = v.plan;
    const on = (id, lines) => ["ssh " + p.user + "@" + p.sw[id].ip, p.userPw, "enable", p.secret, "configure terminal"].concat(lines, ["end", "write memory", "exit"]).map((l) => ({ t: "cmd", dev: "sd1", line: l }));
    let J = tryIt(def, s, on("dist1", ["interface range gi0/21 - 22", "channel-group 1 mode active"]).concat(on("dist2", ["interface range gi0/21 - 22", "channel-group 1 mode passive"]))); assert.ok(B.check(J).res.every((r) => r.ok), s + " active, passive");
    J = tryIt(def, s, on("dist1", ["interface gi0/21", "channel-group 5 mode active", "interface gi0/22", "channel-group 5 mode active"]).concat(on("dist2", ["interface range gi0/21 - 22", "channel-group 2 mode active"]))); assert.ok(B.check(J).res.every((r) => r.ok), s + " group 5 one end, 2 the other, port by port");
  }
});

test("CP-J4: the tempting wrong ways each fail their own line for their own cause", () => {
  const def = byId["CP-J4"];
  for (const s of seeds("CP-J4").slice(0, 5)) {
    const v = B.open(def, s).v, p = v.plan, sol = def.solve(v), cause = (J, id) => { const r = line(J, id); return r.ok ? null : r.real.id; };
    const b = p.vlans.svc.net.split(".")[1], T = { edge: "10." + b + ".255.1", dist: "10." + b + ".255.2", mask: "255.255.255.252" };
    const is = (l) => (a) => a.line === l, sub = (acts, f) => acts.flatMap((a) => { const r = f(a); return r === undefined ? [a] : r.map((l) => Object.assign({}, a, { line: l })); });
    let J = tryIt(def, s, drop(sol, is("ip routing"))); assert.equal(cause(J, "routing"), "off", s + " routing never turned on");
    J = tryIt(def, s, drop(sol, is("no shutdown"))); assert.equal(cause(J, "svis"), "shut", s + " the VLAN interfaces left shut"); assert.equal(line(J, "works").ok, false);
    J = tryIt(def, s, drop(sol, is("ip address " + p.vlans.mgmt.gw + " " + p.mask))); assert.equal(cause(J, "svis"), "addr", s + " the management VLAN's interface left on its own address"); assert.equal(cause(J, "works"), "switch", s + " the switches' default gateway gone");
    J = tryIt(def, s, swap(sol, "ip address " + T.dist + " " + T.mask, "ip address " + T.dist + " 255.255.255.0")); assert.equal(cause(J, "link"), "daddr", s + " the link's mask on distribution switch 1");
    J = tryIt(def, s, sub(sol, (a) => (/^no interface /.test(a.line) ? [a.line.slice(3), "shutdown", "exit"] : undefined))); assert.equal(cause(J, "ros"), "left", s + " the subinterfaces shut, not removed"); assert.ok(line(J, "works").ok);
    J = tryIt(def, s, drop(sol, is("ip route 10." + b + ".0.0 255.255.0.0 " + T.dist))); assert.equal(cause(J, "routes"), "back", s + " no route back"); assert.equal(line(J, "works").ok, false);
    J = tryIt(def, s, swap(sol, "ip route 10." + b + ".0.0 255.255.0.0 " + T.dist, "ip route " + p.vlans.svc.net + " 255.255.255.0 " + T.dist)); assert.equal(cause(J, "routes"), "narrow", s + " a route back for one VLAN");
    J = tryIt(def, s, swap(sol, "ip route 0.0.0.0 0.0.0.0 " + T.edge, "ip route 0.0.0.0 0.0.0.0 10." + b + "." + p.vlans.servers.id + ".254")); assert.equal(cause(J, "routes"), "defnh", s + " the default route at the wrong next hop");
    J = tryIt(def, s, drop(sol, is("ip helper-address " + T.edge))); assert.equal(cause(J, "dhcp"), "none", s + " nothing relayed"); assert.ok(line(J, "works").ok, s + " the PCs keep their leases for now");
    J = tryIt(def, s, swap(sol, "ip helper-address " + T.edge, "ip helper-address " + p.vlans.servers.gw)); assert.equal(cause(J, "dhcp"), "wrong", s + " relayed where nobody answers");
    J = tryIt(def, s, drop(sol, is("ip nat inside"))); assert.equal(cause(J, "nat"), "inside", s + " the link not NAT's inside"); assert.equal(line(J, "works").ok, false);
    const saves = sol.map((a, i) => (a.line === "copy running-config startup-config" ? i : -1)).filter((i) => i >= 0);
    J = tryIt(def, s, sol.filter((a, i) => i !== saves[0] && i !== saves[0] + 1)); assert.equal(cause(J, "saved2"), "unsaved", s + " the edge router unsaved");
  }
});

test("CP-J4: other right ways pass: the VLAN interfaces brought up at once, a route back for each VLAN, every VLAN relayed", () => {
  const def = byId["CP-J4"];
  for (const s of seeds("CP-J4").slice(0, 3)) {
    const v = B.open(def, s).v, p = v.plan, sol = def.solve(v), b = p.vlans.svc.net.split(".")[1], dist = "10." + b + ".255.2";
    const used = ["svc", "bench", "office", "servers", "printers", "mgmt"].map((k) => p.vlans[k]);
    const acts = sol.flatMap((a) => (a.line === "shutdown" ? [] : a.line === "ip route 10." + b + ".0.0 255.255.0.0 " + dist ? used.map((x) => Object.assign({}, a, { line: "ip route " + x.net + " " + p.mask + " " + dist })) : [a]))
      .flatMap((a) => (a.line === "ip routing" ? [a].concat(["servers", "printers"].flatMap((k) => ["interface vlan " + p.vlans[k].id, "ip helper-address 10." + b + ".255.1", "exit"]).map((l) => Object.assign({}, a, { line: l }))) : [a]));
    const J = tryIt(def, s, acts); const c = B.check(J); assert.ok(c.res.every((r) => r.ok), s + " " + c.res.filter((r) => !r.ok).map((r) => r.id + ": " + r.ev).join("; "));
  }
});

test("CP-J5: the tempting wrong ways each fail their own line for their own cause", () => {
  const def = byId["CP-J5"];
  for (const s of seeds("CP-J5").slice(0, 4)) {
    const v = B.open(def, s).v, p = v.plan, sol = def.solve(v), cause = (J, id) => { const r = line(J, id); return r.ok ? null : r.real.id; };
    const b = p.vlans.svc.net.split(".")[1], L = coreLinks(p), E1 = L[0], E2 = L[1], D1 = L[3], old = "10." + b + ".255.1";
    const is = (l) => (a) => a.line === l, sub = (acts, f) => acts.flatMap((a) => { const r = f(a); return r === undefined ? [a] : r.map((l) => Object.assign({}, a, { line: l })); });
    /* each device's OSPF lines, found by where they sit in the walk-through (between laying the console on it and pulling it) */
    const seg = (dev) => { const out = []; let on = null; sol.forEach((a, i) => { if (a.t === "lay") on = a.b.dev; if (a.t === "pull") on = null; if (on === dev) out.push(i); }); return out; };
    const onDev = (dev, pred) => { const S = seg(dev); return (a, i) => S.indexOf(i) >= 0 && pred(a); };
    const dropAt = (acts, f) => acts.filter((a, i) => !f(a, i)), subAt = (acts, f) => acts.flatMap((a, i) => { const r = f(a, i); return r === undefined ? [a] : r.map((l) => Object.assign({}, a, { line: l })); });
    let J = tryIt(def, s, swap(sol, "ip address " + E1.ia + " " + E1.mask, "ip address " + E1.ib + " " + E1.mask)); assert.equal(cause(J, "edge"), "eaddr", s + " the edge router's end on the second usable address");
    J = tryIt(def, s, drop(sol, is("no switchport"))); assert.equal(cause(J, "dist"), "trunk", s + " distribution switch 1's ends left switch ports");
    J = tryIt(def, s, dropAt(sol, onDev("core2", (a) => /^(router ospf|network )/.test(a.line)))); assert.equal(cause(J, "ospf"), "proc", s + " core switch 2 without OSPF"); assert.equal(cause(J, "routes"), "one", s + " every VLAN by one core switch only"); assert.ok(line(J, "works").ok, s + " core switch 1 carries everything");
    J = tryIt(def, s, swap(sol, "network " + E2.net + " 0.0.0.3 area 0", "network " + E2.net + " 0.0.0.0 area 0")); assert.equal(cause(J, "ospf"), "net", s + " a wildcard that matches only the block's own address");
    J = tryIt(def, s, drop(sol, (a) => /^no passive-interface /.test(a.line))); assert.equal(cause(J, "ospf"), "passive", s + " every interface passive, the links too"); assert.equal(line(J, "works").ok, false);
    J = tryIt(def, s, swap(sol, "network 10." + b + ".0.0 0.0.255.255 area 0", "network 10." + b + ".0.0 0.0.255.255 area 1")); assert.equal(cause(J, "ospf"), "area", s + " distribution switch 1 in another area");
    J = tryIt(def, s, drop(sol, is("passive-interface default"))); assert.equal(cause(J, "passive"), "hello", s + " the VLAN interfaces saying hello to the desks"); assert.ok(line(J, "works").ok);
    J = tryIt(def, s, subAt(sol, (a, i) => (onDev("edge", (x) => x.line === "default-information originate")(a, i) ? ["network 0.0.0.0 255.255.255.255 area 0", "default-information originate"] : undefined))); assert.equal(cause(J, "passive"), "wan", s + " the provider's side in OSPF");
    J = tryIt(def, s, drop(sol, is("default-information originate"))); assert.equal(cause(J, "default"), "noorig", s + " no default handed to OSPF"); assert.equal(line(J, "works").ok, false, s + " nothing gets out once the static default is gone");
    J = tryIt(def, s, drop(sol, is("no ip route 0.0.0.0 0.0.0.0 " + old))); assert.equal(cause(J, "statics"), "dstatic", s + " the static default left in"); assert.ok(line(J, "default").ok, s + " its next hop is gone with the old link, so OSPF's default is the one in use");
    J = tryIt(def, s, drop(sol, (a) => /^no ip route 10\./.test(a.line))); assert.equal(cause(J, "statics"), "estatic", s + " the edge router's static left in");
    J = tryIt(def, s, drop(sol, is("shutdown"))); assert.equal(cause(J, "direct"), "up", s + " the old link left up"); assert.equal(cause(J, "dhcp"), null, s + " the relay's new address works either way");
    const shuts = sol.map((a, i) => (a.line === "shutdown" ? i : -1)).filter((i) => i >= 0);
    J = tryIt(def, s, sol.filter((a, i) => i !== shuts[shuts.length - 1])); assert.equal(cause(J, "direct"), "end", s + " only distribution switch 1's end shut");
    J = tryIt(def, s, drop(sol, (a) => /helper-address/.test(a.line))); assert.equal(cause(J, "dhcp"), "gone", s + " the relay left on the old link's address"); assert.ok(line(J, "works").ok, s + " the PCs keep their leases for now");
    J = tryIt(def, s, drop(sol, is("ip nat inside"))); assert.equal(cause(J, "nat"), "inside", s + " the edge router's links to the core not NAT's inside"); assert.equal(cause(J, "works"), "pc");
    J = tryIt(def, s, swap(sol, "network 10." + b + ".0.0 0.0.255.255 area 0", "network 10." + b + ".255.0 0.0.0.255 area 0")); assert.equal(cause(J, "passive"), "noadv", s + " only the links in OSPF"); assert.equal(cause(J, "routes"), "noadv"); assert.equal(cause(J, "manage"), "back", s + " the core switches have no way back to the desks");
    const saves = seg("core1").filter((i) => sol[i].line === "copy running-config startup-config");
    J = tryIt(def, s, sol.filter((a, i) => saves.indexOf(i) < 0 && saves.indexOf(i - 1) < 0)); assert.equal(cause(J, "saved"), "unsaved-core1", s + " core switch 1 unsaved");
  }
});

test("CP-J5: other right ways pass: one statement for every link, interfaces passive one at a time, router IDs, the relay by core switch 2's side, the old cable pulled", () => {
  const def = byId["CP-J5"];
  for (const s of seeds("CP-J5").slice(0, 3)) {
    const v = B.open(def, s).v, p = v.plan, sol = def.solve(v), b = p.vlans.svc.net.split(".")[1], L = coreLinks(p), used = ["svc", "bench", "office", "servers", "printers", "mgmt"].map((k) => p.vlans[k].id);
    let n = 0; const rid = ["1.1.1.1", "2.2.2.2", "3.3.3.3", "4.4.4.4"];
    const acts = sol.flatMap((a) => {
      if (a.line === "network " + L[0].net + " 0.0.0.3 area 0") return [Object.assign({}, a, { line: "network 10." + b + ".255.0 0.0.0.255 area 0" })];
      if (a.line === "network " + L[1].net + " 0.0.0.3 area 0") return [];
      if (a.line === "router ospf 1") return [a, Object.assign({}, a, { line: "router-id " + rid[n++] })];
      if (a.line === "passive-interface default") return used.map((id) => Object.assign({}, a, { line: "passive-interface vlan " + id }));
      if (/^no passive-interface /.test(a.line)) return [];
      if (a.line === "ip helper-address " + L[0].ia) return [Object.assign({}, a, { line: "ip helper-address " + L[1].ia })];
      return [a];
    }).concat([{ t: "pull", cable: "c-edge-dist1" }]);
    const J = tryIt(def, s, acts); const c = B.check(J); assert.ok(c.res.every((r) => r.ok), s + " " + c.res.filter((r) => !r.ok).map((r) => r.id + ": " + r.ev).join("; "));
  }
});

/* the walk-through's lines typed on one device: between laying the console on it and pulling it */
const segOf = (sol, dev) => { const out = []; let on = null; sol.forEach((a, i) => { if (a.t === "lay") on = a.b.dev; if (a.t === "pull") on = null; if (on === dev) out.push(i); }); return out; };
const editOn = (sol, dev, f) => { const S = segOf(sol, dev); return sol.flatMap((a, i) => { if (S.indexOf(i) < 0 || a.t !== "cmd") return [a]; const r = f(a.line); return r === undefined ? [a] : r.map((l) => Object.assign({}, a, { line: l })); }); };

test("CP-J6: the tempting wrong ways each fail their own line for their own cause", () => {
  const def = byId["CP-J6"];
  for (const s of seeds("CP-J6").slice(0, 3)) {
    const v = B.open(def, s).v, p = v.plan, sol = def.solve(v), cause = (J, id) => { const r = line(J, id); return r.ok ? null : r.real.id; };
    const V = p.vlans.svc, own = (k, n) => p.vlans[k].gw.replace(/\.1$/, "." + n);
    let J = tryIt(def, s, editOn(sol, "dist2", (l) => (l === "ip routing" ? [] : undefined))); assert.equal(cause(J, "join"), "off", s + " distribution switch 2 not routing");
    J = tryIt(def, s, editOn(sol, "dist2", (l) => (l === "no switchport" ? [] : undefined))); assert.equal(cause(J, "join"), "trunk", s + " its links left switch ports");
    J = tryIt(def, s, editOn(sol, "dist2", (l) => (l === "router ospf 1" ? ["interface gi0/19"] : /^(network |passive-interface|no passive)/.test(l) ? [] : undefined)));   /* the block's own exit kept in step */ assert.equal(cause(J, "ospf"), "proc", s + " no OSPF on switch 2"); assert.equal(cause(J, "fail"), "out", s + " so with switch 1 gone, nothing knows the way back through switch 2"); assert.ok(line(J, "works").ok);
    J = tryIt(def, s, editOn(sol, "dist2", (l) => (/^no passive-interface/.test(l) ? [] : undefined))); assert.equal(cause(J, "ospf"), "passive", s + " its links passive too");
    J = tryIt(def, s, editOn(sol, "dist2", (l) => (l === "passive-interface default" ? [] : undefined))); assert.equal(cause(J, "passive"), "hello", s + " hellos to the desks");
    J = tryIt(def, s, editOn(sol, "dist2", (l) => (l === "ip address " + own("svc", 3) + " " + p.mask ? ["ip address " + own("svc", 4) + " " + p.mask] : undefined))); assert.equal(cause(J, "svis2"), "addr", s + " switch 2 on an address the records don't give it");
    J = tryIt(def, s, editOn(sol, "dist1", (l) => (/^ip address /.test(l) ? [] : undefined))); assert.equal(cause(J, "own1"), "still", s + " switch 1 kept the gateway as its own address");
    J = tryIt(def, s, editOn(sol, "dist2", (l) => (l === "standby " + V.id + " ip " + V.gw ? ["standby 1 ip " + V.gw] : undefined))); assert.equal(cause(J, "groups"), "split", s + " the two switches in different groups");
    J = tryIt(def, s, editOn(sol, "dist2", (l) => (l === "standby " + V.id + " ip " + V.gw ? ["standby " + V.id + " ip " + V.gw.replace(/\.1$/, ".254")] : undefined))); assert.equal(cause(J, "groups"), "vip", s + " switch 2's virtual address mistyped"); assert.equal(cause(J, "fail"), "vip", s + " so it takes over the wrong address"); assert.ok(line(J, "works").ok, s + " nobody notices until switch 1 fails");
    J = tryIt(def, s, editOn(sol, "dist1", (l) => (/ priority 110$/.test(l) ? [] : undefined))); assert.equal(cause(J, "active"), "nopre", s + " switch 1 at the default priority: after a restart switch 2 keeps it");
    J = tryIt(def, s, editOn(sol, "dist1", (l) => (/ preempt$/.test(l) ? [] : undefined))); assert.equal(cause(J, "active"), "nopre", s + " no preempt");
    J = tryIt(def, s, editOn(sol, "dist2", (l) => (/^ip helper-address/.test(l) ? [] : undefined))); assert.equal(cause(J, "fail"), "relay", s + " switch 2 doesn't relay");
    J = tryIt(def, s, editOn(sol, "dist2", (l) => (l === "standby " + p.vlans.mgmt.id + " ip " + p.vlans.mgmt.gw ? [] : undefined))); assert.equal(cause(J, "groups"), "none2", s + " the management VLAN left out on switch 2"); assert.equal(cause(J, "fail"), "gone");
    J = tryIt(def, s, ["dist1", "dist2"].reduce((acc, d) => editOn(acc, d, (l) => { const m = /^standby (\d+) (.*)$/.exec(l); return m && m[1] === String(V.id) ? ["standby 7 " + m[2]] : undefined; }), sol)); assert.equal(cause(J, "groups"), "grp", s + " a group numbered off the records' convention"); assert.ok(line(J, "fail").ok);
    const saves = segOf(sol, "dist2").filter((i) => sol[i].line === "copy running-config startup-config");
    J = tryIt(def, s, sol.filter((a, i) => saves.indexOf(i) < 0 && saves.indexOf(i - 1) < 0)); assert.equal(cause(J, "saved"), "unsaved-dist2", s + " switch 2 unsaved");
    { /* switch 2 configured first, switch 1 left at the default priority: switch 2 is active and stays so (a tie goes to the higher address) */
      const S1 = segOf(sol, "dist1"), S2 = segOf(sol, "dist2"), one = sol.filter((a, i) => S1.indexOf(i) >= 0 && !/ priority 110$/.test(a.line || "")), two = sol.filter((a, i) => S2.indexOf(i) >= 0);
      J = tryIt(def, s, sol.slice(0, S1[0]).concat(two, [{ t: "pull", cable: "c-console-" + (v.runs + 1) }], one, [{ t: "pull", cable: "c-console-" + (v.runs + 2) }]));
      assert.equal(cause(J, "active"), "dist2", s + " switch 2 active"); assert.ok(line(J, "fail").ok && line(J, "works").ok, s + " everything works, through the wrong switch");
    }
  }
});

test("CP-J6: other right ways pass: switch 2 configured first, other priorities, preempt on both, interfaces passive one at a time", () => {
  const def = byId["CP-J6"];
  for (const s of seeds("CP-J6").slice(0, 2)) {
    const v = B.open(def, s).v, p = v.plan, sol = def.solve(v), used = ["svc", "bench", "office", "servers", "printers", "mgmt"].map((k) => p.vlans[k].id);
    const S1 = segOf(sol, "dist1"), S2 = segOf(sol, "dist2"), first = sol.slice(0, S1[0]);
    const one = sol.filter((a, i) => S1.indexOf(i) >= 0), two = sol.filter((a, i) => S2.indexOf(i) >= 0), pull = (n) => ({ t: "pull", cable: "c-console-" + n });
    const tweak1 = one.map((a) => (/ priority 110$/.test(a.line || "") ? Object.assign({}, a, { line: a.line.replace(/110$/, "150") }) : a));
    const tweak2 = two.flatMap((a) => {
      if (/^standby \d+ ip /.test(a.line || "")) { const g = a.line.split(" ")[1]; return [a, Object.assign({}, a, { line: "standby " + g + " priority 90" }), Object.assign({}, a, { line: "standby " + g + " preempt" })]; }
      if (a.line === "passive-interface default") return used.map((id) => Object.assign({}, a, { line: "passive-interface vlan " + id }));
      if (/^no passive-interface /.test(a.line || "")) return [];
      return [a];
    });
    const acts = first.concat(tweak2, [pull(v.runs + 1)], tweak1, [pull(v.runs + 2)]);   /* switch 2 first, then switch 1 takes over by preempt */
    const J = tryIt(def, s, acts); const c = B.check(J); assert.ok(c.res.every((r) => r.ok), s + " " + c.res.filter((r) => !r.ok).map((r) => r.id + ": " + r.ev).join("; "));
  }
});

test("CP-J7: the tempting wrong ways each fail their own line for their own cause", () => {
  const def = byId["CP-J7"];
  for (const s of seeds("CP-J7").slice(0, 3)) {
    const v = B.open(def, s).v, p = v.plan, T = p.train, sol = def.solve(v), cause = (J, id) => { const r = line(J, id); return r.ok ? null : r.real.id; };
    const on = (dev, from, to) => editOn(sol, dev, (l) => (l === from ? (to === null ? [] : [].concat(to)) : undefined)), drp = (dev, re) => editOn(sol, dev, (l) => (re.test(l) ? [] : undefined));
    let J = tryIt(def, s, sol.map((a) => (a.t === "lay" && a.a.dev === "acc4" && a.a.port === "23" ? Object.assign({}, a, { b: { dev: "dist1", port: "5" } }) : a))); assert.equal(cause(J, "rack"), "ports", s + " the uplink on another port");
    J = tryIt(def, s, editOn(sol, "dist1", (l) => (l === "no shutdown" ? [] : undefined))); assert.equal(cause(J, "rack"), "down", s + " distribution switch 1's port 4 left shut");
    J = tryIt(def, s, on("acc4", "hostname " + p.sw.acc4.host, "hostname RIT-ACC4")); assert.equal(cause(J, "base"), "name", s + " named off the records");
    J = tryIt(def, s, on("acc4", "ip default-gateway " + p.vlans.mgmt.gw, null)); assert.equal(cause(J, "base"), "gw", s + " no default gateway");
    J = tryIt(def, s, editOn(sol, "dist2", (l) => (l === "vlan " + T.id ? ["vlan " + p.vlans.native.id] : undefined))); assert.equal(cause(J, "vlan"), "none", s + " the VLAN never made on switch 2");
    J = tryIt(def, s, on("acc4", "name " + T.name, "name TRAIN")); assert.equal(cause(J, "vlan"), "name", s + " named off the records on the 4F switch");
    J = tryIt(def, s, drp("acc4", /^switchport (mode trunk|nonegotiate)$/)); assert.equal(cause(J, "trunks"), "mode", s + " the 4F's uplinks left to negotiate with ends that don't");
    J = tryIt(def, s, on("acc4", "switchport nonegotiate", null)); assert.equal(cause(J, "trunks"), "dtp", s + " still negotiating");
    J = tryIt(def, s, on("acc4", "switchport trunk native vlan " + p.vlans.native.id, null)); assert.equal(cause(J, "trunks"), "native", s + " native VLAN 1 on the 4F's side");
    J = tryIt(def, s, on("dist1", "switchport trunk allowed vlan " + T.id + "," + p.vlans.mgmt.id, "switchport trunk allowed vlan " + p.vlans.mgmt.id)); assert.equal(cause(J, "trunks"), "train", s + " switch 1's end leaves the training VLAN off");
    J = tryIt(def, s, on("acc4", "switchport trunk allowed vlan " + T.id + "," + p.vlans.mgmt.id, "switchport trunk allowed vlan " + T.id)); assert.equal(cause(J, "trunks"), "mgmt", s + " the management VLAN left off the 4F's uplinks");
    J = tryIt(def, s, drp("dist1", /^switchport trunk allowed vlan add /)); assert.equal(cause(J, "trunks"), "bundle", s + " the bundle on switch 1 never given the training VLAN");
    J = tryIt(def, s, ["dist1", "dist2"].reduce((acc, d) => editOn(acc, d, (l) => (/^spanning-tree vlan /.test(l) ? [] : undefined)), sol)); assert.equal(cause(J, "stp"), "acc4", s + " the root left to the defaults: the 4F switch's address is lowest");
    J = tryIt(def, s, ["dist1", "dist2"].reduce((acc, d) => editOn(acc, d, (l) => (/^spanning-tree vlan .* root primary$/.test(l) ? [l.replace("primary", "secondary")] : /^spanning-tree vlan .* root secondary$/.test(l) ? [l.replace("secondary", "primary")] : undefined)), sol)); assert.equal(cause(J, "stp"), "dist2", s + " the root on switch 2");
    J = tryIt(def, s, drp("dist2", /^spanning-tree vlan /)); assert.equal(cause(J, "stp"), "backup", s + " no backup: the 4F switch is next");
    J = tryIt(def, s, on("dist2", "ip address " + T.gw.replace(/\.1$/, ".3") + " " + p.mask, null)); assert.equal(cause(J, "gw"), "svi", s + " switch 2 with no address on the training VLAN"); assert.equal(cause(J, "fail"), "gone");
    J = tryIt(def, s, on("dist1", "standby " + T.id + " priority 110", null)); assert.equal(cause(J, "gw"), "active", s + " switch 1 at the default priority");
    J = tryIt(def, s, drp("edge", /^(ip dhcp pool|network |default-router|dns-server)/)); assert.equal(cause(J, "pool"), "none", s + " no pool"); assert.equal(cause(J, "online"), "apipa");
    J = tryIt(def, s, on("edge", "default-router " + T.gw, "default-router " + T.gw.replace(/\.1$/, ".254"))); assert.equal(cause(J, "pool"), "router", s + " the pool's default router wrong"); assert.equal(cause(J, "online"), "off");
    J = tryIt(def, s, drp("edge", /^ip dhcp excluded-address/)); assert.equal(cause(J, "pool"), "excl", s + " nothing kept back");
    J = tryIt(def, s, drp("dist2", /^ip helper-address/)); assert.equal(cause(J, "relay"), "none", s + " switch 2 doesn't relay"); assert.ok(line(J, "online").ok, s + " switch 1 relays meanwhile");
    J = tryIt(def, s, drp("acc4", /^switchport port-security/)); assert.equal(cause(J, "desks"), "ps", s + " the desks not locked down");
    J = tryIt(def, s, on("acc4", "interface range gi0/3 - 22", "interface range gi0/5 - 22")); assert.equal(cause(J, "desks"), "spare", s + " spares 3 and 4 left open");
    J = tryIt(def, s, sol.map((a) => (a.t === "lay" && a.a.dev === "tr2" ? Object.assign({}, a, { b: { dev: "acc4", port: "3" } }) : a))); assert.equal(cause(J, "desks"), "port", s + " a PC on a spare port");
    J = tryIt(def, s, drp("acc4", /^copy running-config/)); assert.equal(cause(J, "saved"), "unsaved-acc4", s + " the 4F switch unsaved");
  }
});

test("CP-J7: other right ways pass: priorities typed for the root, the bundle's list given whole, the training VLAN added a line at a time", () => {
  const def = byId["CP-J7"];
  for (const s of seeds("CP-J7").slice(0, 2)) {
    const v = B.open(def, s).v, p = v.plan, T = p.train, sol = def.solve(v), all = ["svc", "bench", "office", "servers", "printers", "mgmt"].map((k) => p.vlans[k].id).concat([T.id]).sort((a, b) => a - b);
    let acts = ["dist1", "dist2"].reduce((acc, d) => editOn(acc, d, (l) => {
      if (/^spanning-tree vlan .* root primary$/.test(l)) return ["spanning-tree vlan " + T.id + " priority 24576"];
      if (/^spanning-tree vlan .* root secondary$/.test(l)) return ["spanning-tree vlan " + T.id + " priority 28672"];
      if (/^switchport trunk allowed vlan add /.test(l)) return ["switchport trunk allowed vlan " + all.join(",")];
      return undefined;
    }), sol);
    acts = editOn(acts, "acc4", (l) => (l === "switchport trunk allowed vlan " + T.id + "," + p.vlans.mgmt.id ? ["switchport trunk allowed vlan " + T.id, "switchport trunk allowed vlan add " + p.vlans.mgmt.id] : undefined));
    const J = tryIt(def, s, acts); const c = B.check(J); assert.ok(c.res.every((r) => r.ok), s + " " + c.res.filter((r) => !r.ok).map((r) => r.id + ": " + r.ev).join("; "));
  }
});

test("CP-J8: the tempting wrong ways each fail their own line for their own cause", () => {
  const def = byId["CP-J8"];
  for (const s of seeds("CP-J8").slice(0, 3)) {
    const v = B.open(def, s).v, p = v.plan, A = p.annex, L = A.link, sol = def.solve(v), cause = (J, id) => { const r = line(J, id); return r.ok ? null : r.real.id; };
    const on = (dev, from, to) => editOn(sol, dev, (l) => (l === from ? (to === null ? [] : [].concat(to)) : undefined)), drp = (dev, re) => editOn(sol, dev, (l) => (re.test(l) ? [] : undefined));
    const mod = (dev, type) => sol.map((a) => (a.t === "sfp" && a.dev === dev ? Object.assign({}, a, { type: type }) : a));
    let J = tryIt(def, s, sol.map((a) => (a.t === "lay" && a.a.dev === "anxa" && a.a.port === A.up.acc ? Object.assign({}, a, { a: { dev: "anxa", port: "23" } }) : a))); assert.equal(cause(J, "rack"), "ports", s + " the uplink on another port");
    J = tryIt(def, s, mod(L.hq, "1000BASE-SX").map((a) => (a.t === "sfp" ? Object.assign({}, a, { type: "1000BASE-SX" }) : a))); assert.equal(cause(J, "fibre"), "mmf", s + " multimode modules on the single-mode run"); assert.equal(cause(J, "ospf"), "down");
    J = tryIt(def, s, mod(L.hq, "10GBASE-SR")); assert.equal(cause(J, "fibre"), "plus", s + " an SFP+ in core switch 2's slot");
    J = tryIt(def, s, sol.map((a) => (a.t === "lay" && a.a.dev === L.hq && a.a.port === L.hqPort ? { t: "lay", a: { dev: L.hq, port: "22" }, b: { dev: "anxc", port: "20" } } : a))); assert.equal(cause(J, "fibre"), "copper", s + " copper across the car park");
    J = tryIt(def, s, editOn(sol, L.hq, (l) => (l === "no shutdown" ? [] : undefined))); assert.equal(cause(J, "fibre"), "shut", s + " core switch 2's fibre port left shut");
    J = tryIt(def, s, on("anxc", "hostname " + A.core.host, "hostname RIT-ANNEX")); assert.equal(cause(J, "core"), "name", s + " the core named off the records");
    J = tryIt(def, s, on("anxc", "ip routing", null)); assert.equal(cause(J, "core"), "routing", s + " routing left off"); assert.equal(cause(J, "ospf"), "proc");
    J = tryIt(def, s, on("anxa", "ip default-gateway " + A.mgmt.gw, null)); assert.equal(cause(J, "acc"), "gw", s + " no default gateway"); assert.equal(cause(J, "manage"), "acc");
    J = tryIt(def, s, drp(L.hq, /^no switchport$/)); assert.equal(cause(J, "link"), "hqsw", s + " core switch 2's end still a switch port");
    J = tryIt(def, s, on("anxc", "ip address " + L.anxIp + " " + L.mask, "ip address " + L.anxIp.replace(/\.34$/, ".38") + " " + L.mask)); assert.equal(cause(J, "link"), "anxip", s + " the Annex end on the wrong address");
    J = tryIt(def, s, on("anxc", "description " + L.anxDesc, "description FIBRE")); assert.equal(cause(J, "link"), "anxdesc", s + " the Annex end described off the records");
    J = tryIt(def, s, on("anxc", "no passive-interface gi0/25", null)); assert.equal(cause(J, "ospf"), "passive", s + " the fibre left passive");
    J = tryIt(def, s, editOn(sol, "anxc", (l) => (/^network .* area 0$/.test(l) ? [l.replace(/area 0$/, "area 1")] : undefined))); assert.equal(cause(J, "ospf"), "area", s + " the Annex in area 1");
    J = tryIt(def, s, on("anxa", "name " + A.cls.name, "name CLASS")); assert.equal(cause(J, "vlans"), "name", s + " the classroom VLAN misnamed on the access switch");
    J = tryIt(def, s, drp("anxa", /^switchport nonegotiate$/)); assert.equal(cause(J, "trunk"), "dtp", s + " the access switch's end still negotiating");
    J = tryIt(def, s, editOn(sol, "anxc", (l) => (l === "switchport trunk allowed vlan " + A.cls.id + "," + A.mgmt.id ? ["switchport trunk allowed vlan " + A.cls.id] : undefined))); assert.equal(cause(J, "trunk"), "mgmt", s + " the management VLAN off the core's end"); assert.equal(cause(J, "manage"), "core", s + " no port carries it on the core: its own management interface goes down too");
    J = tryIt(def, s, on("anxc", "ip address " + A.cls.gw + " " + p.mask, "ip address " + A.cls.gw.replace(/\.1$/, ".254") + " " + p.mask)); assert.equal(cause(J, "gw"), "svi", s + " the classroom's gateway on the wrong address");
    J = tryIt(def, s, drp("anxc", /^(no )?passive-interface /)); assert.equal(cause(J, "gw"), "hello", s + " hellos to the classroom"); assert.ok(line(J, "ospf").ok, s + " the fibre's neighbours meanwhile");
    J = tryIt(def, s, drp("edge", /^(ip dhcp pool|network |default-router|dns-server)/)); assert.equal(cause(J, "pool"), "none", s + " no pool"); assert.equal(cause(J, "online"), "apipa");
    J = tryIt(def, s, drp("edge", /^ip dhcp excluded-address/)); assert.equal(cause(J, "pool"), "excl", s + " nothing kept back");
    J = tryIt(def, s, drp("anxc", /^ip helper-address/)); assert.equal(cause(J, "relay"), "none", s + " no relay"); assert.equal(cause(J, "online"), "apipa");
    J = tryIt(def, s, drp("anxa", /^switchport port-security/)); assert.equal(cause(J, "desks"), "ps", s + " the desks not locked down");
    J = tryIt(def, s, on("anxa", "interface range gi0/3 - 23", "interface range gi0/5 - 23")); assert.equal(cause(J, "desks"), "spare", s + " spares 3 and 4 left open");
    J = tryIt(def, s, drp("anxa", /^copy running-config/)); assert.equal(cause(J, "saved"), "unsaved-anxa", s + " the access switch unsaved");
  }
});

test("CP-J8: other right ways pass: a network statement for each of the Annex's networks, interfaces passive one at a time, the trunk's list a line at a time, the relay to the edge router's other link", () => {
  const def = byId["CP-J8"];
  for (const s of seeds("CP-J8").slice(0, 2)) {
    const v = B.open(def, s).v, p = v.plan, A = p.annex, L = A.link, sol = def.solve(v), b = p.vlans.svc.net.split(".")[1], other = coreLinks(p)[1].ia;
    let acts = editOn(sol, "anxc", (l) => {
      if (l === "network 10." + b + ".0.0 0.0.255.255 area 0") return ["network " + L.net + " 0.0.0.3 area 0", "network " + A.cls.net + " 0.0.0.255 area 0", "network " + A.mgmt.net + " 0.0.0.255 area 0"];
      if (l === "passive-interface default") return ["passive-interface vlan " + A.cls.id, "passive-interface vlan " + A.mgmt.id];
      if (l === "no passive-interface gi0/25") return [];
      if (/^ip helper-address /.test(l)) return ["ip helper-address " + other];
      return undefined;
    });
    acts = editOn(acts, "anxa", (l) => (l === "switchport trunk allowed vlan " + A.cls.id + "," + A.mgmt.id ? ["switchport trunk allowed vlan " + A.cls.id, "switchport trunk allowed vlan add " + A.mgmt.id] : undefined));
    const J = tryIt(def, s, acts); const c = B.check(J); assert.ok(c.res.every((r) => r.ok), s + " " + c.res.filter((r) => !r.ok).map((r) => r.id + ": " + r.ev).join("; "));
  }
});

test("the PCs waiting on a pool get their addresses the moment it's finished being typed: a console leaving the pool's mode starts a pass", () => {
  const def = byId["CP-J8"];
  for (const s of seeds("CP-J8").slice(0, 2)) {
    const J = B.open(def, s), A = J.v.plan.annex, sol = def.solve(J.v, J.sim), seg = segOf(sol, "edge");
    const at = seg.find((i) => sol[i].line === "exit" && /^dns-server /.test(sol[i - 1].line));
    assert.ok(at > 0, s + " the pool's exit in the walk-through");
    for (let i = 0; i < at; i++) B.act(J, sol[i]);
    assert.ok(/^169\.254\./.test(J.sim.addr("cl1").ip), s + " still waiting while the pool is being typed");
    B.act(J, sol[at]);
    const ip = J.sim.addr("cl1").ip; assert.ok(ip.indexOf(A.cls.net.replace(/0$/, "")) === 0, s + " an address from the classroom pool as soon as the console leaves it: " + ip);
  }
});

test("no help names a password, an address or a VLAN number; Mason's ladder climbs on a failing line", () => {
  for (const def of CAMPUS_JOBS) for (const s of seeds(def.id).slice(0, 3)) {
    const J = B.open(def, s), p = J.v.plan, b = p.vlans.svc.net.split(".")[1], secrets = [p.secret, p.console, p.userPw].concat(Object.values(p.sw).map((w) => w.ip).filter(Boolean), Object.values(p.vlans).flatMap((x) => [x.gw, x.net]).filter(Boolean), Object.values(p.printers), ["10." + b + ".255.", "10." + b + ".0.0"]);
    const words = [def.mason].concat(def.reqs.flatMap((q) => [q.rung1(J.v), q.rung2(J.v)])).join("\n");
    for (const x of secrets) assert.ok(words.indexOf(x) < 0, def.id + " help names " + x);
    for (const k of Object.keys(p.vlans)) assert.ok(!new RegExp("\\b" + p.vlans[k].id + "\\b").test(words), def.id + " help names VLAN " + p.vlans[k].id);
    assert.ok(!new RegExp("\\b" + p.train.id + "\\b").test(words) && words.indexOf(p.train.net) < 0 && words.indexOf(p.train.gw) < 0, def.id + " help names the training VLAN or its addresses");
    const A = p.annex; for (const q of [A.cls, A.mgmt]) assert.ok(!new RegExp("\\b" + q.id + "\\b").test(words) && words.indexOf(q.net) < 0 && words.indexOf(q.gw) < 0, def.id + " help names an Annex VLAN or its addresses");
    for (const x of [A.core.host, A.acc.host, A.acc.ip, A.link.hqIp, A.link.anxIp, A.link.net, A.link.hqDesc, A.link.anxDesc]) assert.ok(words.indexOf(x) < 0, def.id + " help names " + x);
    for (let i = 0; i < 5; i++) B.check(J);
    const m = B.mason(J); assert.ok(m && JSON.stringify(m).length > 20);
  }
});
