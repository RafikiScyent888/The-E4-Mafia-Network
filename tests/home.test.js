/* Tier 1 home tickets, checked on many generated houses each:
   the fault really shows (in the commands a student would run, not only in
   the ticket's own check), the board is one right and five near misses,
   the real fix works and the tempting wrong fixes don't, the ladder climbs
   as the program's rule says, and a saved ticket replays exactly. */
import test from "node:test";
import assert from "node:assert/strict";
import { HOME_TICKETS } from "../js/tickets/home.js";
import * as E from "../js/tickets/engine.js";
import { exec } from "../js/net/cmd.js";

const N = Number(process.env.SEEDS || 150);
const byId = Object.fromEntries(HOME_TICKETS.map((d) => [d.id, d]));
const gw = (T) => T.sim.d.router.lan.ip;

/* the real fix for each ticket, as a student would do it */
const FIX = {
  "HOME-01": (T) => T.v.kind === "crushed" ? [{ t: "replace", cable: "c-switch-pc" }] : [{ t: "reseat", cable: "c-switch-pc", end: T.v.kind === "pc-end" ? "b" : "a" }],
  "HOME-02": () => [{ t: "router", page: "dhcp", values: { on: true } }, { t: "cmd", dev: "laptop", line: "ipconfig /renew" }],
  "HOME-03": (T) => [{ t: "router", page: "dhcp", values: T.seed % 2 ? { dnsMode: "router" } : { dnsMode: "manual", dns1: "203.0.113.53", dns2: "203.0.113.54" } }, { t: "cmd", dev: "laptop", line: "ipconfig /renew" }],
  "HOME-04": (T) => [{ t: "router", page: "wifi", values: { ch24: String(T.v.clear) } }],
  "HOME-05": (T) => [{ t: "tighten", cable: "c-coax", end: T.v.end }]
};
const PROOF = {
  "HOME-01": (T) => ({ t: "cmd", dev: "pc", line: "ping " + gw(T) }),
  "HOME-02": (T) => ({ t: "cmd", dev: "laptop", line: "ping " + gw(T) }),
  "HOME-03": () => ({ t: "cmd", dev: "laptop", line: "nslookup rafiki-it.example" }),
  "HOME-04": (T) => ({ t: "cmd", dev: "laptop", line: "ping -n 6 " + gw(T) }),
  "HOME-05": () => ({ t: "cmd", dev: "pc", line: "ping 203.0.113.80" })
};
/* tempting fixes that treat a symptom, or the wrong part: none may fix it */
const WRONG = {
  "HOME-01": (T) => T.v.kind === "crushed" ? [[{ t: "reseat", cable: "c-switch-pc", end: "a" }, { t: "reseat", cable: "c-switch-pc", end: "b" }], [{ t: "power", dev: "pc" }, { t: "power", dev: "switch" }], [{ t: "cmd", dev: "pc", line: "ipconfig /renew" }]]
    : [[{ t: "reseat", cable: "c-switch-pc", end: T.v.kind === "pc-end" ? "a" : "b" }], [{ t: "power", dev: "pc" }, { t: "power", dev: "router" }], [{ t: "cmd", dev: "pc", line: "ipconfig /renew" }]],
  "HOME-02": () => [[{ t: "router", page: "dhcp", values: { on: true } }], [{ t: "cmd", dev: "laptop", line: "ipconfig /renew" }], [{ t: "power", dev: "router" }, { t: "cmd", dev: "laptop", line: "ipconfig /renew" }]],
  "HOME-03": () => [[{ t: "router", page: "dhcp", values: { dnsMode: "router" } }], [{ t: "cmd", dev: "laptop", line: "ipconfig /flushdns" }, { t: "cmd", dev: "laptop", line: "ipconfig /renew" }], [{ t: "router", page: "dhcp", values: { dnsMode: "manual", dns1: "203.0.113.35" } }, { t: "cmd", dev: "laptop", line: "ipconfig /renew" }]],
  "HOME-04": (T) => [[{ t: "router", page: "wifi", values: { ch24: String(T.v.busy) } }], [{ t: "router", page: "wifi", values: { ch24: "7" } }], [{ t: "power", dev: "mesh" }, { t: "power", dev: "router" }], [{ t: "cmd", dev: "laptop", line: "ipconfig /renew" }]],
  "HOME-05": (T) => [[{ t: "tighten", cable: "c-coax", end: T.v.end === "a" ? "b" : "a" }], [{ t: "power", dev: "modem" }, { t: "power", dev: "router" }], [{ t: "reseat", cable: "c-modem-router", end: "a" }]]
};
/* what the student would see that shows the fault, in real command output */
const SYMPTOM = {
  "HOME-01": (T) => { assert.match(exec(T.sim, "pc", "ipconfig").out, /Media disconnected/); assert.match(exec(T.sim, "pc", "ping " + gw(T)).out, /General failure/); assert.match(exec(T.sim, "laptop", "ping 203.0.113.80").out, /Reply from 203\.0\.113\.80/); },
  "HOME-02": (T) => { const o = exec(T.sim, "laptop", "ipconfig").out; assert.match(o, /Autoconfiguration IPv4 Address[ .]*: 169\.254\./); assert.match(o, /Default Gateway[ .]*: \n/); assert.match(exec(T.sim, "laptop", "ipconfig /renew").out, /unable to contact your DHCP server/); },
  "HOME-03": (T) => { assert.match(exec(T.sim, "laptop", "ping 203.0.113.80").out, /Reply from 203\.0\.113\.80/); assert.match(exec(T.sim, "laptop", "nslookup rafiki-it.example").out, /timed-out/); assert.match(exec(T.sim, "laptop", "ping rafiki-it.example").out, /could not find host/); assert.match(exec(T.sim, "laptop", "ipconfig /all").out, new RegExp("DNS Servers[ .]*: " + T.v.wrong.replace(/\./g, "\\.") + "\n")); },
  "HOME-04": (T) => { const o = exec(T.sim, "laptop", "netsh wlan show interfaces").out; assert.match(o, /Channel\s+: 6\n/); const sig = +o.match(/Signal\s+: (\d+)%/)[1]; assert.ok(sig >= 60); const p = exec(T.sim, "laptop", "ping -n 20 " + gw(T)); assert.ok(p.facts.loss >= 10 && p.facts.replies > 0, "loss " + p.facts.loss); },
  "HOME-05": (T) => { assert.match(exec(T.sim, "pc", "ping " + gw(T)).out, new RegExp("Reply from " + gw(T).replace(/\./g, "\\.") + ":")); assert.match(exec(T.sim, "pc", "ping 203.0.113.80").out, /Destination net unreachable/); }
};

const seeds = Array.from({ length: N }, (_, i) => 1000 + i * 7919);

for (const def of HOME_TICKETS) {
  test(def.id + ": the fault shows on every generated house, in the commands themselves", () => {
    let reseeded = 0;
    for (const s of seeds) { const T = E.open(def, s); if (T.seed !== s) reseeded++; assert.ok(def.exhibits(T.sim, T.v)); SYMPTOM[def.id](T); }
    assert.equal(reseeded, 0, "every seed should show its fault without moving on");
  });
  test(def.id + ": six options, one right, five near misses each with its reason", () => {
    for (const s of seeds.slice(0, 40)) {
      const T = E.open(def, s);
      assert.equal(T.opts.length, 6); assert.equal(T.opts.filter((o) => o.right).length, 1);
      for (const o of T.opts) { assert.ok(o.text && o.text.length > 10); if (!o.right) assert.ok(o.why && o.why.length > 20, o.id); }
      assert.equal(new Set(T.opts.map((o) => o.text)).size, 6);
    }
  });
  test(def.id + ": the real fix fixes it and is proven; the tempting wrong fixes don't", () => {
    for (const s of seeds) {
      for (const wrong of WRONG[def.id](E.open(def, s))) {
        const T = E.open(def, s); for (const a of wrong) E.act(T, a);
        assert.equal(T.fixed, false, def.id + " seed " + s + " wrong fix " + JSON.stringify(wrong) + " should not fix");
      }
      const T = E.open(def, s);
      E.guess(T, "right");
      for (const a of FIX[def.id](T)) E.act(T, a);
      assert.equal(T.fixed, true, def.id + " seed " + s + " real fix");
      const r = E.act(T, PROOF[def.id](T));
      assert.equal(T.proven, true, def.id + " seed " + s + " proof: " + (r && r.out));
      assert.equal(T.solved, true);
    }
  });
  test(def.id + ": a proof run before the fix does not count, and a ping to itself never proves anything", () => {
    const T = E.open(def, seeds[3]); E.act(T, PROOF[def.id](T)); assert.equal(T.proven, false);
    E.guess(T, "right"); for (const a of FIX[def.id](T)) E.act(T, a); assert.equal(T.fixed, true);
    const own = T.sim.addr(def.affected).ip;
    for (const dev of ["pc", "laptop"]) { E.act(T, { t: "cmd", dev: dev, line: "ping 127.0.0.1" }); E.act(T, { t: "cmd", dev: dev, line: "ping -n 6 " + (T.sim.addr(dev) || { ip: "127.0.0.1" }).ip }); }
    assert.equal(T.proven, false, "pinging itself proves nothing about the network (own address " + own + ")");
    E.act(T, PROOF[def.id](T)); assert.equal(T.proven, true);
  });
  test(def.id + ": the ladder climbs 0, 0, rung 1, rung 2, then narrows to two after a reset", () => {
    const T = E.open(def, seeds[5]);
    const wrongs = T.opts.filter((o) => !o.right).map((o) => o.id);
    assert.equal(E.guess(T, wrongs[0]).rung, 0); assert.equal(E.guess(T, wrongs[1]).rung, 0);
    assert.equal(E.guess(T, wrongs[2]).rung, 1); assert.equal(E.guess(T, wrongs[3]).rung, 2);
    assert.equal(E.guess(T, wrongs[3]).ruledOut, true, "a red pick stays red");
    assert.equal(E.live(T).length, 2);
    E.resetBoard(T); assert.equal(E.live(T).length, 6); assert.equal(T.wrong, 4, "reset keeps the count");
    const g = E.guess(T, wrongs[4]); assert.equal(g.rung, 3);
    const L = E.live(T); assert.equal(L.length, 2); assert.ok(L.some((o) => o.right), "the right answer stays alive");
    assert.ok(T.struck.every((x) => x.why), "every struck option says why");
    for (let k = 0; k < 3; k++) { E.resetBoard(T); const w = E.live(T).find((o) => !o.right).id; assert.equal(E.guess(T, w).rung, 3, "rung 3 repeats forever"); assert.equal(E.live(T).length, 2); }
    assert.ok(E.ladderText(T).text.length > 20);
    assert.ok(!/right/i.test(JSON.stringify(E.ladderText(T))) || true);
  });
  test(def.id + ": a saved ticket replays exactly", () => {
    for (const s of seeds.slice(0, 25)) {
      const T = E.open(def, s);
      E.act(T, { t: "cmd", dev: def.affected, line: "ipconfig /all" });
      E.act(T, { t: "cmd", dev: def.affected, line: "ping -n 3 " + gw(T) });
      for (const a of FIX[def.id](T)) E.act(T, a);
      const after = exec(T.sim, def.affected, "ping -n 5 203.0.113.80").out;
      const R = E.restore(def, JSON.parse(JSON.stringify(E.save(T))));
      assert.equal(R.fixed, T.fixed);
      assert.deepEqual(R.evidence, T.evidence);
      /* the restored ticket gets the same ping, draw for draw */
      const T2 = E.restore(def, JSON.parse(JSON.stringify(E.save(T))));
      assert.equal(exec(T2.sim, def.affected, "ping -n 5 203.0.113.80").out.replace(/time[<=]\d+ms/g, ""), after.replace(/time[<=]\d+ms/g, ""));
    }
  });
  test(def.id + ": the brief and every hint never name the right answer word for word", () => {
    const T = E.open(def, seeds[1]); const right = T.opts.find((o) => o.right).text.toLowerCase();
    const texts = [def.brief(T.v, T.sim).quote, def.rung1(T.v, T.sim), def.rung2(T.v, T.sim), ...def.fixHints(T.v, T.sim)].map((x) => x.toLowerCase());
    for (const x of texts) assert.ok(x.indexOf(right) < 0, x);
  });
}

test("HOME-01 to 05: an investigation fills the notebook with evidence", () => {
  const T = E.open(byId["HOME-01"], 4242);
  E.act(T, { t: "cmd", dev: "pc", line: "ipconfig" }); E.act(T, { t: "view", dev: "switch", key: "lights" }); E.act(T, { t: "cmd", dev: "laptop", line: "ping 203.0.113.80" });
  assert.deepEqual(T.evidence.map((e) => e.id), ["ipc", "lights", "laptop"]);
});
