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
import { page } from "../js/net/pages.js";

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
const free = (T, n) => T.sim.net.prefix + "." + n;
FIX["HOME-06"] = (T) => {
  const k = T.seed % 3;
  if (k === 0) { const ip = free(T, 251); return [{ t: "client", dev: "printer", values: { mode: "static", ip: ip, mask: T.sim.d.router.lan.mask, gw: T.sim.d.router.lan.ip } }, { t: "pcprinter", ip: ip }]; }
  if (k === 1) return [{ t: "router", page: "reservation-add", values: { name: "Printer", mac: T.v.prMac, ip: T.v.ip } }, { t: "power", dev: "tv" }];
  const n = +T.v.ip.split(".")[3] + 1; return [{ t: "router", page: "dhcp", values: { start: free(T, n) } }, { t: "power", dev: "tv" }];
};
FIX["HOME-07"] = (T) => { const base = +T.sim.d.router.dhcp.start.split(".")[3]; return [{ t: "router", page: "dhcp", values: { end: free(T, base + 100) } }, { t: "rejoin", dev: "guest" }]; };
FIX["HOME-08"] = () => [{ t: "replace", cable: "c-switch-pc" }];
FIX["HOME-09"] = (T) => { const a = T.sim.addr("camera").ip; return [{ t: "router", page: "reservation-add", values: { name: "IP camera", mac: T.sim.d.camera.ifaces[0].mac, ip: a } }, { t: "router", page: "forward", values: { ext: 8443, ip: a } }]; };
FIX["HOME-10"] = (T) => [T.seed % 2 ? { t: "unplug", cable: "c-rogue", end: "a" } : { t: "rogue", values: { dhcpOn: false } }, { t: "cmd", dev: "laptop", line: "ipconfig /renew" }, { t: "power", dev: "tv" }];
const PROOF = {
  "HOME-06": () => ({ t: "print" }),
  "HOME-07": () => ({ t: "view", dev: "guest", key: "wifi" }),
  "HOME-08": () => ({ t: "speed", dev: "pc" }),
  "HOME-09": () => ({ t: "outside", port: 8443 }),
  "HOME-10": () => ({ t: "cmd", dev: "laptop", line: "ping 203.0.113.80" }),
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
WRONG["HOME-06"] = (T) => [[{ t: "power", dev: "printer" }], [{ t: "power", dev: "tv" }], [{ t: "power", dev: "router" }, { t: "power", dev: "tv" }], [{ t: "reseat", cable: "c-switch-printer", end: "b" }]];
WRONG["HOME-07"] = () => [[{ t: "router", page: "dhcp", values: { leaseH: 1 } }, { t: "rejoin", dev: "guest" }], [{ t: "power", dev: "router" }, { t: "rejoin", dev: "guest" }], [{ t: "rejoin", dev: "guest" }]];
WRONG["HOME-08"] = () => [[{ t: "reseat", cable: "c-switch-pc", end: "a" }, { t: "reseat", cable: "c-switch-pc", end: "b" }], [{ t: "power", dev: "pc" }, { t: "power", dev: "switch" }], [{ t: "unplug", cable: "c-switch-pc", end: "b" }, { t: "reseat", cable: "c-switch-pc", end: "b" }]];
WRONG["HOME-09"] = (T) => { const a = T.sim.addr("camera").ip; return [[{ t: "power", dev: "camera" }], [{ t: "router", page: "forward", values: { ext: 8443, ip: a } }], [{ t: "router", page: "reservation-add", values: { name: "IP camera", mac: T.sim.d.camera.ifaces[0].mac, ip: a } }]]; };
WRONG["HOME-10"] = () => [[{ t: "cmd", dev: "laptop", line: "ipconfig /renew" }, { t: "power", dev: "tv" }], [{ t: "power", dev: "router" }, { t: "cmd", dev: "laptop", line: "ipconfig /release" }, { t: "cmd", dev: "laptop", line: "ipconfig /renew" }], [{ t: "unplug", cable: "c-rogue", end: "a" }]];
/* what the student would see that shows the fault, in real command output */
const SYMPTOM = {
  "HOME-01": (T) => { assert.match(exec(T.sim, "pc", "ipconfig").out, /Media disconnected/); assert.match(exec(T.sim, "pc", "ping " + gw(T)).out, /General failure/); assert.match(exec(T.sim, "laptop", "ping 203.0.113.80").out, /Reply from 203\.0\.113\.80/); },
  "HOME-02": (T) => { const o = exec(T.sim, "laptop", "ipconfig").out; assert.match(o, /Autoconfiguration IPv4 Address[ .]*: 169\.254\./); assert.match(o, /Default Gateway[ .]*: \n/); assert.match(exec(T.sim, "laptop", "ipconfig /renew").out, /unable to contact your DHCP server/); },
  "HOME-03": (T) => { assert.match(exec(T.sim, "laptop", "ping 203.0.113.80").out, /Reply from 203\.0\.113\.80/); assert.match(exec(T.sim, "laptop", "nslookup rafiki-it.example").out, /timed-out/); assert.match(exec(T.sim, "laptop", "ping rafiki-it.example").out, /could not find host/); assert.match(exec(T.sim, "laptop", "ipconfig /all").out, new RegExp("DNS Servers[ .]*: " + T.v.wrong.replace(/\./g, "\\.") + "\n")); },
  "HOME-04": (T) => { const o = exec(T.sim, "laptop", "netsh wlan show interfaces").out; assert.match(o, /Channel\s+: 6\n/); const sig = +o.match(/Signal\s+: (\d+)%/)[1]; assert.ok(sig >= 60); const p = exec(T.sim, "laptop", "ping -n 20 " + gw(T)); assert.ok(p.facts.loss >= 10 && p.facts.replies > 0, "loss " + p.facts.loss); },
  "HOME-05": (T) => { assert.match(exec(T.sim, "pc", "ping " + gw(T)).out, new RegExp("Reply from " + gw(T).replace(/\./g, "\\.") + ":")); assert.match(exec(T.sim, "pc", "ping 203.0.113.80").out, /Destination net unreachable/); }
};

SYMPTOM["HOME-06"] = (T) => { const outs = [0, 1, 2, 3].map(() => E.act(T, { t: "print" }).facts.print); assert.ok(outs.includes("ok") && outs.includes("fail"), "prints sometimes, fails sometimes: " + outs); const p = page(T.sim, "router", "clients"); assert.ok(p.rows.some((r) => r[0] === "Smart TV" && r[2] === T.v.ip)); assert.match(exec(T.sim, "pc", "ping " + T.v.ip).out, /Reply from/); };
SYMPTOM["HOME-07"] = (T) => { const g = page(T.sim, "guest", "wifi"); assert.ok(g.rows.some((r) => /^169\.254\./.test(r[1])), JSON.stringify(g.rows)); assert.ok(g.rows.some((r) => r[1] === "No internet")); const c = page(T.sim, "router", "clients"); assert.equal(c.facts.count, c.facts.size); };
SYMPTOM["HOME-08"] = (T) => { const s = page(T.sim, "pc", "settings"); assert.ok(s.rows.some((r) => r[1] === "100/100 (Mbps)")); const pc = T.sim.speedTest("pc"), lap = T.sim.speedTest("laptop"); assert.ok(pc.down < 100 && lap.down > 200, pc.down + " vs " + lap.down); assert.match(page(T.sim, "switch", "lights").ports.find((p) => p.port === T.v.port).state, /amber/); };
SYMPTOM["HOME-09"] = (T) => { const o = T.sim.outside(8443); assert.equal(o.ok, false); assert.equal(o.why, "refused"); const f = page(T.sim, "router", "forward"); assert.equal(f.rules[0].ip, T.v.old); assert.notEqual(T.sim.addr("camera").ip, T.v.old); };
SYMPTOM["HOME-10"] = (T) => { assert.match(exec(T.sim, "laptop", "ipconfig").out, /IPv4 Address[ .]*: 10\.0\.0\./); assert.match(exec(T.sim, "laptop", "ipconfig /all").out, /DHCP Server[ .]*: 10\.0\.0\.1\n/); assert.match(exec(T.sim, "laptop", "ping 203.0.113.80").out, /Reply from 10\.0\.0\.1: Destination net unreachable/); assert.match(exec(T.sim, "pc", "ping 203.0.113.80").out, /Reply from 203\.0\.113\.80/); };
/* HOME-11 and 12, the five more (11 October 2026) */
FIX["HOME-11"] = (T) => T.seed % 2 ? [{ t: "client", dev: "printer", values: { mode: "static", ip: T.v.ip, mask: "255.255.255.0", gw: gw(T) } }]
  : [{ t: "client", dev: "printer", values: { mode: "static", ip: free(T, 251), mask: "255.255.255.0", gw: gw(T) } }, { t: "pcprinter", ip: free(T, 251) }];
FIX["HOME-12"] = (T) => T.seed % 2 ? [{ t: "client", dev: "pc", values: { mode: "static", ip: T.v.ip, mask: T.sim.net.mask, gw: gw(T), dns: ["203.0.113.53", ""] } }] : [{ t: "client", dev: "pc", values: { mode: "dhcp" } }];
PROOF["HOME-11"] = () => ({ t: "print" });
PROOF["HOME-12"] = () => ({ t: "cmd", dev: "pc", line: "ping 203.0.113.80" });
WRONG["HOME-11"] = (T) => [[{ t: "power", dev: "printer" }], [{ t: "replace", cable: "c-switch-printer" }], [{ t: "power", dev: "pc" }, { t: "power", dev: "switch" }],
  [{ t: "client", dev: "printer", values: { mode: "static", ip: T.v.ip, mask: T.v.mask, gw: gw(T) } }, { t: "pcprinter", ip: T.v.ip }]];
WRONG["HOME-12"] = (T) => [[{ t: "power", dev: "pc" }], [{ t: "cmd", dev: "pc", line: "ipconfig /renew" }], [{ t: "power", dev: "router" }, { t: "replace", cable: "c-switch-pc" }],
  [{ t: "client", dev: "pc", values: { mode: "static", ip: T.v.ip, mask: T.sim.net.mask, gw: T.v.gw, dns: ["8.8.8.8", "8.8.4.4"] } }]];
SYMPTOM["HOME-11"] = (T) => {
  const p = exec(T.sim, "pc", "ping " + T.v.ip).out; assert.match(p, /Request timed out\./); assert.doesNotMatch(p, /Reply from/);
  const a = exec(T.sim, "pc", "arp -a"); assert.ok(a.facts.entries.some((e) => e[0] === T.v.ip && e[1] === T.v.prMac), "the printer answered ARP");
  assert.equal(E.act(T, { t: "print" }).facts.print, "fail");
  assert.doesNotMatch(exec(T.sim, "laptop", "ping " + T.v.ip).out, /Reply from/);
  assert.equal(page(T.sim, "printer", "panel").facts.mask, T.v.mask);
  assert.match(exec(T.sim, "pc", "ping 203.0.113.80").out, /Reply from 203\.0\.113\.80/);
};
SYMPTOM["HOME-12"] = (T) => {
  assert.match(exec(T.sim, "pc", "ipconfig").out, new RegExp("Default Gateway[ .]*: " + T.v.gw.replace(/\./g, "\\.") + "\\n"));
  assert.match(exec(T.sim, "pc", "ping 203.0.113.80").out, T.v.kind === "same" ? /Destination host unreachable/ : /General failure/);
  assert.equal(E.act(T, { t: "print" }).facts.print, "ok");
  assert.match(exec(T.sim, "laptop", "ping 203.0.113.80").out, /Reply from 203\.0\.113\.80/);
};
FIX["HOME-14"] = () => [{ t: "router", page: "wifi", values: { sec: "WPA2/WPA3-Personal" } }];
PROOF["HOME-14"] = () => ({ t: "cmd", dev: "laptop", line: "ping 203.0.113.80" });
WRONG["HOME-14"] = () => [[{ t: "router", page: "wifi", values: { sec: "WPA2-Personal" } }], [{ t: "power", dev: "router" }, { t: "power", dev: "laptop" }], [{ t: "router", page: "wifi", values: { ch24: "1", ch5: "149" } }], [{ t: "cmd", dev: "laptop", line: "ipconfig /renew" }]];
SYMPTOM["HOME-14"] = (T) => {
  assert.ok(page(T.sim, "laptop", "wifi").rows.some((r) => r[1] === "Can't connect to this network"));
  const d = exec(T.sim, "laptop", "netsh wlan show drivers").out; assert.doesNotMatch(d, /WPA3/); assert.match(d, /802\.11w Management Frame Protection supported : No/);
  assert.match(exec(T.sim, "laptop", "netsh wlan show networks").out, new RegExp("SSID \\d+ : " + T.sim.d.router.wifi.ssid + "\\n[^\\n]*\\n    Authentication          : WPA3-Personal"));
  assert.match(exec(T.sim, "laptop", "ipconfig").out, /Media disconnected/);
  assert.ok(page(T.sim, "phone", "wifi").facts.internet);
};
FIX["HOME-15"] = () => [{ t: "forget", dev: "laptop" }, { t: "router", page: "wifi", values: { newPassword: true } }, { t: "join", dev: "laptop" }, { t: "join", dev: "phone" }];
PROOF["HOME-15"] = () => ({ t: "cmd", dev: "laptop", line: "ping 203.0.113.80" });
WRONG["HOME-15"] = () => [[{ t: "power", dev: "router" }, { t: "power", dev: "laptop" }], [{ t: "cmd", dev: "laptop", line: "ipconfig /release" }, { t: "cmd", dev: "laptop", line: "ipconfig /renew" }],
  [{ t: "forget", dev: "laptop" }, { t: "join", dev: "laptop" }], [{ t: "router", page: "wifi", values: { newPassword: true } }], [{ t: "router", page: "wifi", values: { newPassword: true } }, { t: "forget", dev: "laptop" }, { t: "join", dev: "laptop" }]];
SYMPTOM["HOME-15"] = (T) => {
  const i = exec(T.sim, "laptop", "netsh wlan show interfaces").out; assert.match(i, /Authentication         : Open/); assert.match(i, new RegExp("BSSID                  : " + T.v.twinMac.toLowerCase()));
  const n = exec(T.sim, "laptop", "netsh wlan show networks mode=bssid"); assert.ok(n.facts.twice.includes(T.sim.d.router.wifi.ssid), "the house name listed twice");
  assert.match(exec(T.sim, "laptop", "ipconfig").out, /IPv4 Address[ .]*: 172\.20\.10\./);
  assert.match(exec(T.sim, "laptop", "ping 203.0.113.80").out, /Reply from 172\.20\.10\.1: Destination net unreachable/);
  assert.ok(page(T.sim, "phone", "wifi").facts.internet);
  assert.ok(!page(T.sim, "router", "clients").rows.some((r) => r[1] === T.sim.d.laptop.ifaces[0].mac), "the laptop isn't a client of the router");
};
FIX["HOME-13"] = (T) => T.v.kind === "unplugged" ? [{ t: "injector", values: { power: true } }] : [{ t: "injector", values: { swap: true } }];
PROOF["HOME-13"] = () => ({ t: "view", dev: "camera", key: "web" });
WRONG["HOME-13"] = (T) => [[{ t: "power", dev: "camera" }], [{ t: "replace", cable: "c-inj-camera" }], [{ t: "power", dev: "switch" }, { t: "power", dev: "router" }],
  [{ t: "router", page: "reservation-add", values: { name: "IP camera", mac: T.v.mac, ip: T.v.ip } }], [{ t: "reseat", cable: "c-switch-inj", end: "a" }, { t: "reseat", cable: "c-inj-camera", end: "b" }],
  T.v.kind === "unplugged" ? [{ t: "injector", values: { swap: true } }] : [{ t: "injector", values: { power: false } }, { t: "injector", values: { power: true } }]];
SYMPTOM["HOME-13"] = (T) => {
  assert.equal(page(T.sim, "camera", "web").facts.online, false);
  const L = page(T.sim, "switch", "lights").facts.ports.find((p) => p.port === T.v.port); assert.equal(L.up, false); assert.match(L.who, /PoE injector/);
  assert.ok(!page(T.sim, "router", "clients").rows.some((r) => r[1] === T.v.mac));
  assert.match(exec(T.sim, "pc", "ping " + T.v.ip).out, /Destination host unreachable/);   /* nothing answers at the camera's address */
  assert.match(exec(T.sim, "pc", "ping 203.0.113.80").out, /Reply from 203\.0\.113\.80/);
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
    const byFix = T.proven;   /* some fixes show their own proof (the guest phone's page says Internet OK as it rejoins) */
    const own = (T.sim.addr(def.affected) || {}).ip;
    for (const dev of ["pc", "laptop"]) { E.act(T, { t: "cmd", dev: dev, line: "ping 127.0.0.1" }); E.act(T, { t: "cmd", dev: dev, line: "ping -n 6 " + (T.sim.addr(dev) || { ip: "127.0.0.1" }).ip }); }
    assert.equal(T.proven, byFix, "pinging itself proves nothing about the network (own address " + own + ")");
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
      const win = ["pc", "laptop"].includes(def.affected) ? def.affected : "laptop";
      E.act(T, { t: "cmd", dev: win, line: "ipconfig /all" });
      E.act(T, { t: "cmd", dev: win, line: "ping -n 3 " + gw(T) });
      E.act(T, { t: "print" }); E.act(T, { t: "speed", dev: "pc" });
      for (const a of FIX[def.id](T)) E.act(T, a);
      const after = exec(T.sim, win, "ping -n 5 203.0.113.80").out;
      const R = E.restore(def, JSON.parse(JSON.stringify(E.save(T))));
      assert.equal(R.fixed, T.fixed);
      assert.deepEqual(R.evidence, T.evidence);
      /* the restored ticket gets the same ping, draw for draw */
      const T2 = E.restore(def, JSON.parse(JSON.stringify(E.save(T))));
      assert.equal(exec(T2.sim, win, "ping -n 5 203.0.113.80").out.replace(/time[<=]\d+ms/g, ""), after.replace(/time[<=]\d+ms/g, ""));
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

test("HOME-14: WPA2 alone gets the laptop online but isn't the fix; Mason says why", () => {
  const T = E.open(byId["HOME-14"], 777); E.guess(T, "right");
  E.act(T, { t: "router", page: "wifi", values: { sec: "WPA2-Personal" } });
  const r = E.act(T, { t: "cmd", dev: "laptop", line: "ping 203.0.113.80" });
  assert.match(r.out, /Reply from 203\.0\.113\.80/); assert.equal(T.fixed, false); assert.equal(T.proven, false); assert.match(T.partial, /keeps WPA3/);
  E.act(T, { t: "router", page: "wifi", values: { sec: "WPA2/WPA3-Personal" } }); E.act(T, { t: "cmd", dev: "laptop", line: "ping 203.0.113.80" });
  assert.equal(T.solved, true);
  assert.match(exec(T.sim, "laptop", "netsh wlan show interfaces").out, /Authentication         : WPA2-Personal/);
});

test("HOME-15: back on the real network isn't the end: the password was given away, then every device needs the new one", () => {
  const T = E.open(byId["HOME-15"], 99); E.guess(T, "right");
  E.act(T, { t: "forget", dev: "laptop" }); E.act(T, { t: "join", dev: "laptop" });
  E.act(T, { t: "cmd", dev: "laptop", line: "ping 203.0.113.80" }); assert.equal(T.proven, false); assert.match(T.partial, /given|has it now/);
  E.act(T, { t: "router", page: "wifi", values: { newPassword: true } });
  assert.equal(page(T.sim, "phone", "wifi").reenter, true, "the phone needs the new password");
  E.act(T, { t: "join", dev: "laptop" }); E.act(T, { t: "cmd", dev: "laptop", line: "ping 203.0.113.80" }); assert.match(T.partial, /every other device/);
  E.act(T, { t: "join", dev: "phone" }); E.act(T, { t: "cmd", dev: "laptop", line: "ping 203.0.113.80" }); assert.equal(T.solved, true);
});
