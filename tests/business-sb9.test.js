/* Level 3, SB-J9: the router rebuilt from its backup. Each business is SB-J8 done, then the router's power supply dies: your
   backup of it (taken right after the printers' VLAN went in) is on your laptop's TFTP server, the replacement is in its box,
   the dead router's cables are out and the cabinet is locked. Worked through the real command lines as the work order's
   solution, with one thing left out or done the tempting wrong way; each must fail its own line for its own cause. The other
   right ways pass: the backup merged into the running configuration (each port it names opened by hand), the laptop's address
   given with netsh, another network for the transfer. Also here: the laptop's Network settings tab, netsh's set address,
   and a port opened on the console reporting the link it really has. */
import test from "node:test";
import assert from "node:assert/strict";
import { BUSINESS_JOBS } from "../js/build/business.js";
import * as B from "../js/build/engine.js";
import { exec } from "../js/net/cmd.js";
import { tabsFor, page } from "../js/net/pages.js";
import { configText } from "../js/net/swcli.js";

const def = BUSINESS_JOBS.find((d) => d.id === "SB-J9");
const N = Math.min(12, Number(process.env.SEEDS || 12));
const seeds = Array.from({ length: N }, (_, i) => 9900 + i * 7919);
const line = (J, id) => B.evaluate(J.def.reqs.find((q) => q.id === id), J.sim, J.v);
const real = (J, id) => { const c = line(J, id); return c.ok ? "met" : c.real.id; };
const run = (J, acts) => { for (const a of acts) { const r = B.act(J, a); assert.notEqual(r && r.result && r.result.ok, false, "refused: " + JSON.stringify(a) + " " + JSON.stringify(r && r.result)); } };
const tryIt = (s, acts) => { const J = B.open(def, s); run(J, acts); return J; };
const isCmd = (a, l) => a.t === "cmd" && a.line === l;
const at = (acts, l, from) => { const i = acts.findIndex((a, k) => k >= (from || 0) && isCmd(a, l)); assert.ok(i >= 0, "no " + l); return i; };
const t = (l) => ({ t: "cmd", dev: "tech", line: l, cli: true });
const onlyThese = (J, bad, why) => { for (const r of B.check(J).res) if (bad.indexOf(r.id) < 0) assert.ok(r.ok, why + ": " + r.id + " should be met: " + r.ev); };

test("SB-J9 as found: the router dead and replaced, the backup on your laptop; every line to do, for the real reason; solved", () => {
  for (const s of seeds) {
    const J = B.open(def, s), p = J.v.plan, sim = J.sim;
    assert.deepEqual(def.reqs.map((q) => real(J, q.id)), ["box", "box", "box", "box", "box", "box", "box", "met"], "seed " + s);
    assert.ok(sim.d.rtr.boxed && sim.d.rtr.sw.hostname === "Router", "the replacement, fresh from its box");
    assert.ok(!sim.cablesOf("rtr").length, "the dead router's cables pulled");
    assert.ok(sim.d.cab.locked && !sim.d.cab.open && !sim.d.cab.key, "the cabinet locked, its key with the manager");
    const f = sim.d.tech.tftp.files.find((x) => x.name === p.backup.name);
    assert.ok(f && f.name === p.rtHost.toLowerCase() + "-confg" && f.text === p.backup.text && /ip access-list extended/.test(f.text) && f.text.indexOf(p.printerIp) < 0 && f.text.indexOf(p.vlans.printers.gw) >= 0, "the backup, current: the printers' subinterface in it");
    const K = tryIt(s, def.solve(J.v, J.sim));
    onlyThese(K, [], "the solution, seed " + s);
    assert.equal(configText(K.sim.d.rtr.sw), p.backup.text, "running the backup, line for line");
    assert.match(exec(K.sim, "mgr", "ssh " + p.user + "@" + p.vlans.staff.gw).out + "", /^$|Warning/, "SSH from the manager's PC asks for the password, no warning");
  }
});

test("SB-J9: the tempting wrong ways fail their own line, and what they break", () => {
  for (const s of seeds.slice(0, 8)) {
    const J0 = B.open(def, s), p = J0.v.plan, sol = def.solve(J0.v, J0.sim), T = (acts) => tryIt(s, acts);
    const rl = at(sol, "reload"), keys = at(sol, "crypto key generate rsa modulus 2048"), save = at(sol, "copy running-config startup-config");
    /* yes to saving before the reload: the factory settings saved over the backup */
    let J = T(sol.slice(0, rl + 1).concat([t("yes"), t(""), t(""), t("enable"), t("configure terminal"), t("crypto key generate rsa modulus 2048"), t("end")]));
    assert.equal(real(J, "restored"), "factory", "the factory settings saved over the file");
    /* copied into startup, never reloaded */
    J = T(sol.slice(0, rl).concat([t("configure terminal"), t("hostname X"), t("end")]));
    assert.equal(real(J, "restored"), "startup", "in startup, running what it started with"); assert.equal(real(J, "back"), "net", "nobody online");
    /* merged into running, the ports the file names left shut: a merge never opens a port */
    const name = sol[at(sol, "copy tftp: startup-config") + 2].line;
    J = T(sol.slice(0, at(sol, "copy tftp: startup-config")).concat([t("copy tftp: running-config"), t("10.0.0.2"), t(name), t("")]));
    assert.equal(real(J, "restored"), "part", "the merge"); assert.match(line(J, "restored").ev, /interface Gi0\/0/); assert.equal(real(J, "back"), "net");
    /* no keys made again */
    J = T(sol.filter((a, i) => i !== keys));
    assert.equal(real(J, "ssh"), "keys", "a file never carries the keys"); onlyThese(J, ["ssh"], "no keys");
    /* the old key left on the manager's PC */
    J = T(sol.filter((a) => !(a.t === "cmd" && a.dev === "mgr")));
    assert.equal(real(J, "ssh"), "known", "the manager's PC remembers the old router's key");
    /* the modem and the switch swapped round on the router */
    J = T(sol.map((a) => (a.t === "lay" && a.a.dev === "modem" ? { t: "lay", a: a.a, b: { dev: "rtr", port: "Gi0/1" } } : a.t === "lay" && a.b.dev === "msw" ? { t: "lay", a: { dev: "rtr", port: "Gi0/0" }, b: a.b } : a)));
    assert.equal(real(J, "cabled"), "wan", "the modem in the inside port"); assert.equal(real(J, "remote"), "wan", "the provider's side down");
    /* the router's cable in a parked switch port, not the trunk */
    J = T(sol.map((a) => (a.t === "lay" && a.b.dev === "msw" ? { t: "lay", a: a.a, b: { dev: "msw", port: "22" } } : a)));
    assert.equal(real(J, "cabled"), "trunk", "a parked port, not the trunk"); assert.equal(real(J, "back"), "net");
    /* not saved after the keys */
    J = T(sol.filter((a, i) => i !== save && i !== save + 1));
    assert.equal(real(J, "saved"), "since", "the keys not saved");
    /* the laptop with no address: the copy times out */
    J = B.open(def, s); for (const a of sol.filter((a) => a.t !== "client")) { const r = B.act(J, a); if (isCmd(a, "")) void r; }
    assert.equal(real(J, "restored"), "factory", "no address on the laptop: nothing came across");
    assert.ok(J.sim.d.tech.tftp.log.every((l) => !/Read request/.test(l)), "the server never heard from the router");
    /* the TFTP server never started */
    J = T(sol.filter((a) => a.t !== "tftp"));
    assert.equal(real(J, "restored"), "factory", "the server not running");
    /* the laptop's cable left in, the cabinet left open, the key left in the lock */
    J = T(sol.filter((a) => !(a.t === "pull" && /^c-run-/.test(a.cable))));
    assert.equal(real(J, "tidy"), "eth", "the laptop's cable left in");
    J = T(sol.slice(0, -3)); assert.equal(real(J, "tidy"), "open", "the cabinet left open");
    J = T(sol.slice(0, -1)); assert.equal(real(J, "tidy"), "key", "the key left in the lock");
  }
});

test("SB-J9: other right ways pass: the backup merged and each port opened by hand, the laptop's address by netsh, another network", () => {
  for (const s of seeds.slice(0, 6)) {
    const J0 = B.open(def, s), p = J0.v.plan, sol = def.solve(J0.v, J0.sim), cp = at(sol, "copy tftp: startup-config"), name = sol[cp + 2].line, after = at(sol, "crypto key generate rsa modulus 2048") - 1;
    /* merged: the file's lines entered as commands; the ports it names opened by hand, as on the real thing */
    const merge = sol.slice(0, cp).concat([t("copy tftp: running-config"), t("10.0.0.2"), t(name), t(""), t("configure terminal"), t("interface " + p.wanPort), t("no shutdown"), t("interface " + p.lanPort), t("no shutdown"), t("end")], sol.slice(after));
    onlyThese(tryIt(s, merge), [], "the merge, seed " + s);
    /* the laptop's address given in its Command Prompt */
    const nets = sol.map((a) => (a.t === "client" ? { t: "cmd", dev: "tech", line: 'netsh interface ipv4 set address name="Ethernet" static 10.0.0.2 255.255.255.0', win: true } : a));
    onlyThese(tryIt(s, nets), [], "netsh, seed " + s);
    /* another network for the transfer */
    const other = sol.map((a) => (a.t === "client" ? Object.assign({}, a, { values: { mode: "static", ip: "192.168.77.20", mask: "255.255.255.0", gw: "" } }) : isCmd(a, "ip address 10.0.0.1 255.255.255.0") ? t("ip address 192.168.77.1 255.255.255.0") : isCmd(a, "10.0.0.2") ? t("192.168.77.20") : a));
    onlyThese(tryIt(s, other), [], "another network, seed " + s);
  }
});

test("checking SB-J9 changes nothing, part done or done", () => {
  for (const s of seeds.slice(0, 4)) {
    const J = B.open(def, s), sol = def.solve(J.v, J.sim);
    for (const k of [0, 6, 12, 22, 30, sol.length]) {
      const K = tryIt(s, sol.slice(0, k)), was = JSON.stringify([K.sim.net, K.sim.arp, K.sim.turns || {}]);
      for (const q of def.reqs) { B.evaluate(q, K.sim, K.v); q.rung1(K.v, K.sim); q.rung2(K.v, K.sim); q.ok(K.sim, K.v); }
      def.summary(K.v, K.sim); def.answer(K.v, K.sim); def.limits(K.v, K.sim);
      assert.equal(JSON.stringify([K.sim.net, K.sim.arp, K.sim.turns || {}]), was, "seed " + s + ", after " + k + " steps");
    }
  }
});

test("your laptop: a Network settings tab, netsh's set address, and a port opened on the console says it came up", () => {
  const J = B.open(def, seeds[0]), sim = J.sim;
  assert.deepEqual(tabsFor(sim, "tech").map((x) => x.key), ["cmd", "wcmd", "settings", "tftp", "physical"]);
  assert.ok(page(sim, "tech", "settings").ipForm && !page(sim, "tech", "settings").speedTest, "the IP form, no speed test");
  const w = (l) => exec(sim, "tech", l, true);
  assert.equal(w('netsh interface ipv4 set address name="Ethernet" static 10.0.0.2 255.255.255.0').facts.ok, true);
  assert.deepEqual([sim.d.tech.ifaces[0].cfg.mode, sim.d.tech.ifaces[0].cfg.ip], ["static", "10.0.0.2"]);
  assert.match(w('netsh interface ipv4 set address name="Wi-Fi" static 10.0.0.3 255.255.255.0').out, /interface name you entered was not found/);
  assert.match(w('netsh interface ipv4 set address name="Ethernet" static 10.0.0.2 255.0.255.0').out, /parameter is incorrect/);
  assert.equal(w('netsh interface ipv4 set address name=Ethernet static 10.0.0.9/24').facts.mask, "255.255.255.0");
  assert.equal(w('netsh interface ipv4 set address name="Ethernet" source=dhcp').facts.mode, "dhcp");
  /* the walk-through as far as opening the laptop's port: the console says the link came up, with its line protocol */
  const K = B.open(def, seeds[0]), sol = def.solve(K.v, K.sim); let out = "";
  for (const a of sol.slice(0, at(sol, "no shutdown") + 1)) { const r = B.act(K, a); if (isCmd(a, "no shutdown")) out = String(r.out); }
  assert.match(out, /GigabitEthernet0\/2, changed state to up\n%LINEPROTO-5-UPDOWN: Line protocol on Interface GigabitEthernet0\/2, changed state to up/);
  const L = B.open(def, seeds[0]); for (const a of sol.slice(0, at(sol, "no shutdown") + 1).filter((a) => !(a.t === "lay" && a.a.dev === "tech" && a.a.port === "ETH"))) { const r = B.act(L, a); if (isCmd(a, "no shutdown")) out = String(r.out); }
  assert.match(out, /GigabitEthernet0\/2, changed state to down\n?$/, "nothing plugged in: down, and no line protocol");
});
