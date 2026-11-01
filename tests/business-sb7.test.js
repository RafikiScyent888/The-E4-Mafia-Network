/* Level 3, SB-J7: the provider's fixed address. Each business is SB-J6 done, then the provider's letter (a /28, /29 or /30 from
   192.0.2.0/24, the gateway its first or last usable address). Worked through the real command lines as the work order's
   solution (over SSH from the manager's PC), with one thing left out or done the tempting wrong way; each must fail its own line
   for its own cause. The other right ways pass, the console in the closet cabinet among them. */
import test from "node:test";
import assert from "node:assert/strict";
import { BUSINESS_JOBS } from "../js/build/business.js";
import * as B from "../js/build/engine.js";

const def = BUSINESS_JOBS.find((d) => d.id === "SB-J7");
const N = Math.min(25, Number(process.env.SEEDS || 25));
const seeds = Array.from({ length: N }, (_, i) => 7700 + i * 7919);
const E = (dev, port) => ({ dev, port });
const line = (J, id) => B.evaluate(J.def.reqs.find((q) => q.id === id), J.sim, J.v);
const real = (J, id) => { const c = line(J, id); return c.ok ? "met" : c.real.id; };
const run = (J, acts) => { for (const a of acts) { const r = B.act(J, a); assert.notEqual(r && r.result && r.result.ok, false, "refused: " + JSON.stringify(a) + " " + JSON.stringify(r && r.result)); } };
const tryIt = (s, acts) => { const J = B.open(def, s); run(J, acts); return J; };
const isCmd = (a, l) => a.t === "cmd" && a.line === l;
const at = (acts, l) => { const i = acts.findIndex((a) => isCmd(a, l)); assert.ok(i >= 0, "no " + l); return i; };
const swap = (acts, l, to) => acts.map((a) => (isCmd(a, l) ? Object.assign({}, a, { line: to }) : a));
const drop = (acts, pred) => acts.filter((a) => !pred(a));
const putAfter = (acts, l, more) => { const i = at(acts, l); return acts.slice(0, i + 1).concat(more.map((x) => Object.assign({}, acts[i], { line: x })), acts.slice(i + 1)); };
const onlyThese = (J, bad, why) => { for (const r of B.check(J).res) if (bad.indexOf(r.id) < 0) assert.ok(r.ok, why + ": " + r.id + " should be met: " + r.ev); };

test("SB-J7 as found: on switch-over day the old address still works; the three lines to do, for the real reason; solved", () => {
  for (const s of seeds) {
    const J = B.open(def, s), F = J.v.plan.fixed, sim = J.sim;
    assert.deepEqual(["wan", "route", "remote", "still", "saved"].map((id) => real(J, id)), ["dhcp", "none", "notyet", "met", "met"], "seed " + s);
    assert.ok(sim.fromInternet(sim.net.isp.wanIp, J.v.plan.cams[0].ext, "tcp").ok, "the old address still reaches the cameras");
    assert.ok([28, 29, 30].indexOf(F.len) >= 0 && F.ip !== F.gw && F.ip !== F.net && F.ip !== F.bcast, "a usable address in a small block: " + JSON.stringify(F));
    const K = tryIt(s, def.solve(J.v, J.sim));
    onlyThese(K, [], "the solution, seed " + s);
    assert.equal(K.sim.fromInternet(sim.net.isp.wanIp, J.v.plan.cams[0].ext, "tcp").why, "old", "moved over: the old address reaches nothing");
    assert.equal(K.sim.route("pc", "8.8.8.8").nat.global, F.ip, "everyone goes out on the fixed address");
  }
});

test("SB-J7: the tempting wrong ways fail their own line, and what they break", () => {
  for (const s of seeds.slice(0, 15)) {
    const J0 = B.open(def, s), p = J0.v.plan, F = p.fixed, sol = def.solve(J0.v, J0.sim), T = (acts) => tryIt(s, acts), isp = J0.sim.net.isp;
    const addr = "ip address " + F.ip + " " + F.mask, rt = "ip route 0.0.0.0 0.0.0.0 " + F.gw;
    let J = T(swap(sol, addr, "ip address " + F.ip + " 255.255.255.0"));
    assert.equal(real(J, "wan"), "mask", "a /24 mask"); assert.equal(line(J, "still").ok, false, "and nobody gets out");
    J = T(swap(sol, addr, "ip address " + F.gw + " " + F.mask));
    assert.equal(real(J, "wan"), "gwaddr", "the provider's gateway's address typed as the router's");
    /* the block's network address with the block's mask: refused at the router, as on the real thing ("Bad mask"); with a /24 it
       takes it, and the line says what's wrong with it */
    J = B.open(def, s); for (const a of swap(sol, addr, "ip address " + F.net + " " + F.mask)) { const r = B.act(J, a); if (a.line === "ip address " + F.net + " " + F.mask) assert.match(String(r.out), /Bad mask \/\d+ for address/); }
    assert.equal(real(J, "wan"), "dhcp", "refused: still on DHCP");
    J = T(swap(sol, addr, "ip address " + F.net + " 255.255.255.0"));
    assert.equal(real(J, "wan"), "edge", "the block's network address, taken with a /24");
    J = T(drop(sol, (a) => isCmd(a, rt)));
    assert.equal(real(J, "route"), "none", "no default route"); assert.equal(real(J, "remote"), "back", "the cameras' answers have no way back"); assert.equal(real(J, "still"), "net", "staff offline");
    J = T(swap(sol, rt, "ip route 0.0.0.0 0.0.0.0 " + isp.gw));
    assert.equal(real(J, "route"), "old", "the default route to the old gateway"); onlyThese(J, ["route", "remote", "still"], "the old gateway");
    J = T(swap(sol, rt, "ip route 0.0.0.0 0.0.0.0 " + p.wanPort));
    assert.equal(real(J, "route"), "iface", "the default route naming the port"); assert.equal(real(J, "still"), "net");
    const other = F.ip.replace(/\d+$/, (n) => String(+n + (F.ip === F.bcast.replace(/\d+$/, (b) => String(+b - 1)) ? -1 : 1)));
    if (other !== F.gw && other !== F.net && other !== F.bcast) { J = T(swap(sol, rt, "ip route 0.0.0.0 0.0.0.0 " + other)); assert.equal(real(J, "route"), "hop", "a next hop in the block that isn't the gateway"); }
    J = T(swap(sol, rt, "ip route 0.0.0.0 0.0.0.0 10.250.0.1"));
    assert.equal(real(J, "route"), "gone", "a next hop on no network the router has");
    J = T(drop(sol, (a) => isCmd(a, addr)));
    assert.equal(real(J, "wan"), "dhcp", "the route but not the address"); assert.equal(real(J, "route"), "pending", "the route set, not in the table yet");
    J = T(drop(sol, (a) => isCmd(a, "copy running-config startup-config") || (a.t === "cmd" && a.line === "" && sol.indexOf(a) === at(sol, "copy running-config startup-config") + 1)));
    assert.equal(real(J, "saved"), "since", "not saved");
  }
});

test("SB-J7: other right ways pass: the route before the address, the console in the cabinet locked again after; left unlocked, caught", () => {
  for (const s of seeds.slice(0, 12)) {
    const J0 = B.open(def, s), p = J0.v.plan, F = p.fixed, sol = def.solve(J0.v, J0.sim);
    /* the way out typed first: in the table once the address is in */
    const addr = "ip address " + F.ip + " " + F.mask, rt = "ip route 0.0.0.0 0.0.0.0 " + F.gw;
    let acts = drop(sol, (a) => isCmd(a, rt)); acts = putAfter(acts, "configure terminal", [rt]);
    onlyThese(tryIt(s, acts), [], "the route first, seed " + s);
    /* at the console: the cabinet unlocked and opened with the manager's key, the laptop carried back to the closet */
    const t = (l) => ({ t: "cmd", dev: "tech", line: l, cli: true }), J = B.open(def, s), con = J.sim.cablesOf("tech").find((c) => c.kind === "console");
    const viaConsole = [{ t: "cabinet", values: { key: true } }, { t: "cabinet", values: { locked: false } }, { t: "cabinet", values: { open: true } },
      { t: "pull", cable: con.id }, { t: "place", dev: "tech", room: "closet" }, { t: "lay", a: E("tech", "USB-C"), b: E("rtr", "CONSOLE") },
      t(""), t(p.rtConsole), t("enable"), t(p.rtSecret), t("configure terminal"), t("interface " + p.wanPort), t(addr), t("exit"), t(rt), t("end"), t("copy running-config startup-config"), t("")];
    const shut = [{ t: "cabinet", values: { open: false } }, { t: "cabinet", values: { locked: true } }, { t: "cabinet", values: { key: false } }];
    run(J, viaConsole.concat(shut)); onlyThese(J, [], "the console, the cabinet locked again, seed " + s);
    const K = tryIt(s, viaConsole.concat(shut.slice(0, 2)));
    assert.equal(real(K, "still"), "rack", "the key left in the lock"); onlyThese(K, ["still"], "the key left in");
    const L = tryIt(s, viaConsole);
    assert.equal(real(L, "still"), "rack", "the cabinet left open");
  }
});

test("checking SB-J7 changes nothing, part done or done", () => {
  for (const s of seeds.slice(0, 6)) {
    const J = B.open(def, s), sol = def.solve(J.v, J.sim);
    for (const k of [0, 7, 9, sol.length]) {
      const K = tryIt(s, sol.slice(0, k)), was = JSON.stringify(K.sim.net);
      for (const q of def.reqs) { B.evaluate(q, K.sim, K.v); q.rung1(K.v, K.sim); q.rung2(K.v, K.sim); q.ok(K.sim, K.v); }
      def.summary(K.v, K.sim); def.answer(K.v, K.sim); def.limits(K.v, K.sim);
      assert.equal(JSON.stringify(K.sim.net), was, "seed " + s + ", after " + k + " steps");
    }
  }
});
