/* Tier 2 small-office tickets, checked on many generated offices each: the
   fault shows in what a student would type (the switch's own show commands,
   ipconfig, ping, ssh), the board is one right and five near misses, the
   real fix works and is proven, the tempting wrong fixes don't (a fix that
   isn't saved works today, isn't the fix, and Mason says so), the ladder
   climbs as the program's rule says, and a saved ticket replays exactly. */
import test from "node:test";
import assert from "node:assert/strict";
import { OFFICE_TICKETS } from "../js/tickets/office.js";
import * as E from "../js/tickets/engine.js";
import { exec } from "../js/net/cmd.js";
import { ip2n, n2ip } from "../js/net/util.js";
import { checkSheet, sheetRows } from "../js/net/ipam.js";

const N = Number(process.env.SEEDS || 150);
const seeds = Array.from({ length: N }, (_, i) => 3000 + i * 7919);
const cli = (line) => ({ t: "cmd", dev: "tech", line, cli: true }), pc = (line) => ({ t: "cmd", dev: "pc", line });
const login = (T) => [cli(""), cli(T.v.plan.console), cli("enable"), cli(T.v.plan.secret)];
const conf = (T, lines) => login(T).concat([cli("configure terminal")], lines.map(cli), [cli("end")]);
const SAVE = [cli("copy running-config startup-config"), cli("")];
const out = (T, acts) => acts.map((a) => (E.act(T, a) || {}).out || "").join("");
/* SO-09: the sheet with the misplaced block put back, and the first address after that block's gateway */
const sheetFixed = (T) => { const rows = T.sim.net.ipam.map((r) => Object.assign({}, r)); rows[T.v.moved] = T.v.orig; return rows; };
const homeAddr = (T) => n2ip(ip2n(T.v.orig.net) + 2);
const moveDevice = (T, ip, save) => T.v.kind === "gear" ? conf(T, ["interface vlan 1", "ip address " + ip + " " + T.v.plan.mask]).concat(save === false ? [] : SAVE) : [{ t: "client", dev: "printer", values: { mode: "static", ip, mask: T.v.plan.mask, gw: T.v.plan.gw } }].concat(save === false ? [] : [{ t: "pcprinter", ip }]);

/* the real fix, as a student would type it at your laptop's console */
const FIX = {
  "SO-01": (T) => conf(T, ["interface gi0/3", "speed 100", "duplex full"]).concat(SAVE),
  "SO-02": (T) => conf(T, ["interface gi0/2", "no shutdown"]).concat(SAVE),
  "SO-03": (T) => conf(T, T.v.kind === "user" ? ["username " + T.v.user + " secret " + T.v.pw] : ["interface vlan 1", "ip address " + T.v.newIp + " " + T.v.plan.mask]).concat(SAVE),
  "SO-04": (T) => T.seed % 2 ? [{ t: "crossover", cable: "c-back-up" }, { t: "cmd", dev: "mpc", line: "ipconfig /renew" }] : conf(T, ["interface gi0/5", "mdix auto"]).concat(SAVE, [{ t: "cmd", dev: "mpc", line: "ipconfig /renew" }]),
  "SO-05": (T) => conf(T, T.v.kind === "nokeys" ? ["crypto key generate rsa modulus 2048"] : T.v.kind === "telnet" ? ["line vty 0 15", "transport input ssh"] : ["line vty 0 15", "login local"]).concat(SAVE),
  "SO-06": (T) => conf(T, ["interface vlan 1", "ip address " + T.v.plan.ip + " " + T.v.plan.mask]).concat(SAVE),
  "SO-07": (T) => conf(T, ["interface gi0/2", T.seed % 2 ? "speed auto" : "speed 100"]).concat(SAVE),
  "SO-09": (T) => [{ t: "ipam", rows: sheetFixed(T) }].concat(moveDevice(T, homeAddr(T)))
};
/* what proves it, run from the front desk PC */
const PROOF = {
  "SO-01": (T) => [pc("ping " + T.v.printer)],
  "SO-02": (T) => [pc("ping " + T.v.plan.gw)],
  "SO-03": (T) => T.v.kind === "user" ? [pc("ssh " + T.v.user + "@" + T.v.plan.ip), pc(T.v.pw)] : [pc("ping " + T.v.newIp)],
  "SO-04": () => [{ t: "cmd", dev: "mpc", line: "ping 203.0.113.80" }],
  "SO-05": (T) => [pc("ssh " + T.v.plan.user + "@" + T.v.plan.ip), pc(T.v.plan.userPw)],
  "SO-06": (T) => [pc("ping " + T.v.plan.ip)],
  "SO-07": (T) => [pc("ping " + T.v.plan.gw)],
  "SO-09": () => [{ t: "print" }]
};
/* the real fix without saving it: it works, it isn't the fix */
const UNSAVED = (def, T) => def.id === "SO-09" ? FIX[def.id](T).slice(1) : def.id === "SO-04" ? conf(T, ["interface gi0/5", "mdix auto"]).concat([{ t: "cmd", dev: "mpc", line: "ipconfig /renew" }]) : FIX[def.id](T).slice(0, -2);
/* tempting fixes that treat a symptom, or the wrong part: none may fix it */
const WRONG = {
  "SO-01": (T) => [[{ t: "power", dev: "printer" }], [{ t: "power", dev: "msw" }], conf(T, ["interface gi0/3", "duplex half"]).concat(SAVE), conf(T, ["interface gi0/3", "shutdown", "no shutdown"]).concat(SAVE)],
  "SO-02": (T) => [conf(T, ["interface range gi0/2 - 28", "no shutdown"]).concat(SAVE), [{ t: "power", dev: "pc" }], [{ t: "power", dev: "msw" }], [{ t: "reseat", cable: T.v.pcCable, end: "b" }], [pc("ipconfig /renew")]],
  "SO-03": (T) => [[{ t: "power", dev: "msw" }], login(T).concat([cli("reload"), cli("")]), T.v.kind === "user" ? conf(T, ["username " + T.v.user + " secret wrong-one"]).concat(SAVE) : conf(T, ["interface vlan 1", "ip address " + T.v.plan.ip + " " + T.v.plan.mask]).concat(SAVE)],
  "SO-04": (T) => [[{ t: "replace", cable: "c-back-up" }, { t: "cmd", dev: "mpc", line: "ipconfig /renew" }], [{ t: "power", dev: "meet" }, { t: "power", dev: "msw" }], conf(T, ["interface gi0/5", "speed 100"]).concat(SAVE), conf(T, ["interface gi0/5", "shutdown", "no shutdown"]).concat(SAVE), [{ t: "cmd", dev: "mpc", line: "ipconfig /renew" }]],
  "SO-05": (T) => [[{ t: "power", dev: "msw" }], T.v.kind === "telnet" ? conf(T, ["line vty 0 15", "transport input all"]).concat(SAVE) : T.v.kind === "nokeys" ? conf(T, ["crypto key generate rsa modulus 512"]).concat(SAVE) : conf(T, ["line vty 0 15", "no password"]).concat(SAVE), [pc("ipconfig /renew")]],
  /* a mask that happens to work but isn't the records' is not the fix either */
  "SO-06": (T) => [[{ t: "power", dev: "msw" }], conf(T, ["interface vlan 1", "shutdown", "no shutdown"]).concat(SAVE), conf(T, ["ip default-gateway " + T.v.plan.gw]).concat(SAVE), [pc("ipconfig /renew")], conf(T, ["interface vlan 1", "ip address " + T.v.plan.ip + " 255.255.0.0"]).concat(SAVE)],
  "SO-07": (T) => [conf(T, ["interface gi0/2", "shutdown", "no shutdown"]).concat(SAVE), [{ t: "replace", cable: T.v.pcCable }], [{ t: "power", dev: "pc" }], [{ t: "power", dev: "msw" }], conf(T, ["interface gi0/2", "speed 100", "duplex full"]).concat(SAVE), [pc("ipconfig /renew")]],
  /* the records put right with the devices still clashing; the clash ended outside the device's block; the device moved but
     the switch not saved or the PC still printing to the old address; the block's own mask put on the switch */
  "SO-09": (T) => { const rows = sheetFixed(T), out200 = n2ip((ip2n(T.v.addr) & ~255) + 200); return [[{ t: "power", dev: "printer" }], [{ t: "power", dev: "msw" }], [{ t: "ipam", rows }],
    conf(T, ["interface vlan 1", "ip address " + out200 + " " + T.v.plan.mask]).concat(SAVE, [{ t: "ipam", rows }]),
    [{ t: "ipam", rows }].concat(moveDevice(T, homeAddr(T), false)),
    [{ t: "ipam", rows }].concat(conf(T, ["interface vlan 1", "ip address " + (T.v.kind === "gear" ? homeAddr(T) : T.v.addr) + " 255.255.255.248"]), SAVE),
    /* the clash ended by moving the printer to the end of its block as written, the sheet left overlapping */
    (() => { const P = T.sim.net.ipam[T.v.P], last = P.last; return [{ t: "client", dev: "printer", values: { mode: "static", ip: last, mask: T.v.plan.mask, gw: T.v.plan.gw } }, { t: "pcprinter", ip: last }]; })()]; }
};
/* the fault, in real output */
const SYMPTOM = {
  "SO-01": (T) => {
    const a = out(T, login(T).concat([cli("show interfaces gi0/3")])), b = out(T, [cli("show interfaces gi0/3")]);
    assert.match(a, /GigabitEthernet0\/3 is up, line protocol is up/); assert.match(a, /Half-duplex, 100Mb\/s/);
    const late = (s) => +s.match(/(\d+) late collision/g).pop().split(" ")[0]; assert.ok(late(b) > late(a), "the late collisions climb");
    const p = E.act(T, pc("ping " + T.v.printer)); assert.ok(p.facts.replies > 0 && p.facts.replies < p.facts.sent, "some pings to the printer are lost");
  },
  "SO-02": (T) => {
    assert.match(E.act(T, pc("ipconfig")).out, /Media disconnected/);
    assert.match(out(T, login(T).concat([cli("show interfaces status")])), /Gi0\/2\s+FRONT-DESK-PC\s+disabled/);
  },
  "SO-03": (T) => {
    assert.match(out(T, login(T).concat([cli("show version")])), /uptime is 1 day, 9 hours[^]*System returned to ROM by power-on/);
    if (T.v.kind === "user") { E.act(T, pc("ssh " + T.v.user + "@" + T.v.plan.ip)); assert.match(E.act(T, pc(T.v.pw)).out, /Permission denied/); }
    else { const p = E.act(T, pc("ping " + T.v.newIp)); assert.equal(p.facts.replies, 0); assert.ok(E.act(T, pc("ping " + T.v.plan.ip)).facts.replies > 0, "the old address answers"); }
  },
  "SO-04": (T) => {
    assert.match(out(T, login(T).concat([cli("show interfaces status")])), /Gi0\/5\s+BACK-OFFICE\s+notconnect/);
    assert.match(out(T, [cli("show running-config")]), /interface GigabitEthernet0\/5\n description BACK-OFFICE\n no mdix auto\n/);
    assert.match(E.act(T, { t: "test", cable: "c-back-up" }).text, /all pass, in order\. Wired straight-through/);
    assert.match(E.act(T, { t: "cmd", dev: "mpc", line: "ipconfig" }).out, /Autoconfiguration IPv4 Address[ .]*: 169\.254\./);
    const L = E.act(T, { t: "view", dev: "meet", key: "lights" }); assert.deepEqual(L.ports.map((x) => x.port + ":" + x.up), ["1:false", "2:true", "3:false", "4:false", "5:false"]);
  },
  "SO-05": (T) => {
    assert.ok(E.act(T, pc("ping " + T.v.plan.ip)).facts.replies > 0, "the switch answers ping");
    const r = E.act(T, pc("ssh " + T.v.plan.user + "@" + T.v.plan.ip));
    if (T.v.kind === "lines") { assert.match(E.act(T, pc(T.v.plan.userPw)).out, /Permission denied/); }
    else assert.match(r.out, /Connection refused/);
  },
  "SO-06": (T) => {
    const v = T.v, p = E.act(T, pc("ping " + v.plan.ip));
    assert.equal(p.facts.replies, 0);
    if (v.kind === "mask") { assert.match(p.out, /Request timed out\./); assert.ok(E.act(T, pc("arp -a")).facts.entries.some((e) => e[0] === v.plan.ip && e[1]), "the switch answered the ARP"); }
    else { assert.match(p.out, /Destination host unreachable/); assert.ok(!E.act(T, pc("arp -a")).facts.entries.some((e) => e[0] === v.plan.ip)); }
    assert.match(E.act(T, pc("ssh " + v.plan.user + "@" + v.plan.ip)).out, /Connection timed out/);
    assert.ok(E.act(T, pc("ping " + v.plan.gw)).facts.replies > 0, "the PC reaches the router");
    const run = out(T, login(T).concat([cli("show running-config")]));
    assert.ok(run.indexOf("interface Vlan1\n ip address " + v.ip + " " + v.mask + "\n") >= 0); assert.ok(run.indexOf("ip default-gateway " + v.plan.gw) >= 0);
    assert.match(out(T, [cli("show ip interface brief")]), new RegExp("Vlan1\\s+" + v.ip.replace(/\./g, "\\.") + "\\s.*up\\s+up"));
  },
  "SO-07": (T) => {
    assert.match(E.act(T, pc("ipconfig")).out, /Media disconnected/);
    assert.match(E.act(T, pc("ipconfig /all")).out, /Fast Ethernet Adapter \(10\/100\)/);
    assert.match(out(T, login(T).concat([cli("show interfaces status")])), /Gi0\/2\s+FRONT-DESK-PC\s+notconnect\s+1\s+auto\s+1000/);
    assert.match(out(T, [cli("show running-config")]), /interface GigabitEthernet0\/2\n description FRONT-DESK-PC\n speed 1000\n/);
    assert.match(E.act(T, { t: "test", cable: T.v.pcCable }).text, /all pass/);
    assert.match(JSON.stringify(E.act(T, { t: "view", dev: "pc", key: "settings" }).rows), /a 10\/100 Mbps adapter/);
  },
  "SO-09": (T) => {
    const v = T.v, prints = [], seen = new Set();
    for (let k = 0; k < 2; k++) { prints.push(E.act(T, { t: "print" }).facts.print); seen.add(E.act(T, pc("arp -a")).facts.entries.find((e) => e[0] === v.addr)[1]); }
    assert.deepEqual(prints.sort(), ["fail", "ok"], "every other page");
    assert.deepEqual([...seen].sort(), [T.sim.macOf("msw"), T.sim.macOf("printer")].sort(), "arp -a shows both hardware addresses in turn");
    const s1 = E.act(T, pc("ssh " + v.plan.user + "@" + v.addr)); assert.ok(s1.facts.asked, "the first try reaches the switch");
    for (let k = 0; k < 3; k++) E.act(T, pc("wrong-one"));
    assert.match(E.act(T, pc("ssh " + v.plan.user + "@" + v.addr)).out, /Connection refused/, "the next reaches the printer");
    assert.match(out(T, login(T)), /%IP-4-DUPADDR: Duplicate address \S+ on Vlan1, sourced by [0-9a-f]{4}\.[0-9a-f]{4}\.[0-9a-f]{4}/);
    const sh = E.act(T, { t: "ipamcheck" }).facts.sheet;
    assert.deepEqual(sh.map((r) => r.issues.map((x) => x.text.split(":")[0]).join("|")), ["", "", "Overlap", "Overlap"], "only the two blocks overlap, nothing else wrong");
    assert.ok(T.sim.addr("pc").ip !== v.addr && T.sim.d.router.dhcp.start.split(".")[3] > 1);
  }
};

for (const def of OFFICE_TICKETS) {
  test(def.id + ": the fault shows on every generated office, in the commands themselves", () => {
    let reseeded = 0;
    for (const s of seeds) { const T = E.open(def, s); if (T.seed !== s) reseeded++; assert.ok(def.exhibits(T.sim, T.v)); assert.equal(T.fixed, false); SYMPTOM[def.id](T); }
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
  test(def.id + ": the real fix fixes it and is proven; the tempting wrong fixes don't; unsaved works but isn't the fix", () => {
    for (const s of seeds) {
      for (const wrong of WRONG[def.id](E.open(def, s))) {
        const T = E.open(def, s); for (const a of wrong) E.act(T, a);
        assert.equal(T.fixed, false, def.id + " seed " + s + " wrong fix " + JSON.stringify(wrong.map((a) => a.line || a.t)) + " should not fix");
      }
      let T = E.open(def, s); for (const a of UNSAVED(def, T)) E.act(T, a);
      assert.equal(T.fixed, false, def.id + " seed " + s + ": not saved isn't fixed");
      for (const a of PROOF[def.id](T)) E.act(T, a);
      assert.equal(T.proven, false); assert.ok(T.partial && T.partial.length > 20, def.id + " seed " + s + ": Mason says it works but isn't saved (" + T.partial + ")");
      T = E.open(def, s); E.guess(T, "right");
      for (const a of FIX[def.id](T)) E.act(T, a);
      assert.equal(T.fixed, true, def.id + " seed " + s + " real fix");
      for (const a of PROOF[def.id](T)) E.act(T, a);
      assert.equal(T.proven, true, def.id + " seed " + s + " proof"); assert.equal(T.solved, true);
    }
  });
  test(def.id + ": a proof run before the fix does not count, and a ping to itself never proves anything", () => {
    const T = E.open(def, seeds[3]); for (const a of PROOF[def.id](T)) E.act(T, a); assert.equal(T.proven, false);
    E.guess(T, "right"); for (const a of FIX[def.id](T)) E.act(T, a); assert.equal(T.fixed, true);
    const byFix = T.proven;
    E.act(T, pc("ping 127.0.0.1")); E.act(T, pc("ping -n 6 " + (T.sim.addr("pc") || { ip: "127.0.0.1" }).ip));
    assert.equal(T.proven, byFix, "pinging itself proves nothing");
    for (const a of PROOF[def.id](T)) E.act(T, a); assert.equal(T.proven, true);
  });
  test(def.id + ": the ladder climbs 0, 0, rung 1, rung 2, then narrows to two after a reset, for ever", () => {
    const T = E.open(def, seeds[5]), wrongs = T.opts.filter((o) => !o.right).map((o) => o.id);
    assert.equal(E.guess(T, wrongs[0]).rung, 0); assert.equal(E.guess(T, wrongs[1]).rung, 0);
    assert.equal(E.guess(T, wrongs[2]).rung, 1); assert.equal(E.guess(T, wrongs[3]).rung, 2);
    assert.equal(E.guess(T, wrongs[3]).ruledOut, true, "a red pick stays red");
    E.resetBoard(T); assert.equal(E.live(T).length, 6); assert.equal(T.wrong, 4, "reset keeps the count");
    assert.equal(E.guess(T, wrongs[4]).rung, 3);
    const L = E.live(T); assert.equal(L.length, 2); assert.ok(L.some((o) => o.right)); assert.ok(T.struck.every((x) => x.why));
    for (let k = 0; k < 3; k++) { E.resetBoard(T); const w = E.live(T).find((o) => !o.right).id; assert.equal(E.guess(T, w).rung, 3); assert.equal(E.live(T).length, 2); }
  });
  test(def.id + ": a saved ticket replays exactly, the switch's console included", () => {
    for (const s of seeds.slice(0, 25)) {
      const T = E.open(def, s);
      for (const a of login(T).concat([cli("show interfaces status"), pc("ipconfig /all"), pc("ping -n 3 " + T.v.plan.gw), { t: "print" }])) E.act(T, a);
      for (const a of FIX[def.id](T)) E.act(T, a);
      const R = E.restore(def, JSON.parse(JSON.stringify(E.save(T))));
      assert.equal(R.fixed, T.fixed); assert.deepEqual(R.evidence, T.evidence);
      assert.equal(JSON.stringify(R.sim.net), JSON.stringify(T.sim.net));
      assert.equal(exec(R.sim, "pc", "ping -n 5 " + (T.v.printer || T.v.plan.gw)).out.replace(/time[<=]\d+ms/g, ""), exec(T.sim, "pc", "ping -n 5 " + (T.v.printer || T.v.plan.gw)).out.replace(/time[<=]\d+ms/g, ""));
    }
  });
  test(def.id + ": the brief and every hint never name the right answer, a password or the fix's command", () => {
    for (const s of seeds.slice(0, 20)) {
      const T = E.open(def, s), right = T.opts.find((o) => o.right).text.toLowerCase(), p = T.v.plan;
      const texts = [def.rung1(T.v, T.sim), def.rung2(T.v, T.sim), ...def.fixHints(T.v, T.sim), def.brief(T.v, T.sim).quote].map((x) => x.toLowerCase());
      for (const x of texts) {
        assert.ok(x.indexOf(right) < 0, x);
        for (const bad of [p.secret, p.console, p.userPw].map((b) => b.toLowerCase())) assert.ok(x.indexOf(bad) < 0, def.id + " names a password: " + x);
        for (const cmd of ["no shutdown", "duplex full", "speed 100", "transport input ssh", "login local", "crypto key", "copy running-config", "mdix auto", "ip address", "speed auto", "no speed", "speed 1000", "pcprinter"]) assert.ok(x.indexOf(cmd) < 0, def.id + " names the fix's command (" + cmd + "): " + x);
      }
    }
  });
}

test("SO-09: any plan the sheet accepts, with each device in its own block, fixes it; the other block moved works too", () => {
  const def = OFFICE_TICKETS.find((d) => d.id === "SO-09");
  for (const s of seeds.slice(0, 60)) {
    let T = E.open(def, s); const v = T.v;
    /* the misplaced block written somewhere else free (the top of the range), its device inside it */
    const rows = T.sim.net.ipam.map((r) => Object.assign({}, r)), p = +v.orig.mask.slice(1), sz = 2 ** (32 - p), base = ip2n(v.addr) & ~255, n = base + 256 - sz;
    rows[v.moved] = { net: n2ip(n), mask: v.orig.mask, first: n2ip(n + 1), last: n2ip(n + sz - 2), bc: n2ip(n + sz - 1), gw: n2ip(n + 1) };
    E.guess(T, "right"); for (const a of [{ t: "ipam", rows }].concat(moveDevice(T, n2ip(n + 3)), [{ t: "print" }])) E.act(T, a);
    assert.ok(checkSheet(T.sim.net.plan.ipam.block, sheetRows(T.sim.net)).every((r) => r.ok)); assert.equal(T.fixed, true, "seed " + s + " another free block"); assert.equal(T.solved, true);
    /* or the other block moved instead, and the other device with it */
    T = E.open(def, s); const other = T.v.onto, rows2 = T.sim.net.ipam.map((r) => Object.assign({}, r)), q = +rows2[other].mask.slice(1), sz2 = 2 ** (32 - q), m = base + 256 - sz2;
    rows2[other] = { net: n2ip(m), mask: rows2[other].mask, first: n2ip(m + 1), last: n2ip(m + sz2 - 2), bc: n2ip(m + sz2 - 1), gw: n2ip(m + 1) };
    const T2 = Object.assign({}, T, { v: Object.assign({}, T.v, { kind: T.v.kind === "gear" ? "printers" : "gear" }) });
    for (const a of [{ t: "ipam", rows: rows2 }].concat(moveDevice(T2, n2ip(m + 2)))) E.act(T, a);
    assert.equal(T.fixed, true, "seed " + s + " the other block moved");
  }
});

test("SO-01 to 05: an investigation at the switch's console fills the notebook", () => {
  const def = OFFICE_TICKETS.find((d) => d.id === "SO-01"), T = E.open(def, 4242);
  for (const a of login(T).concat([cli("show interfaces gi0/3"), cli("show interfaces status"), pc("ping " + T.v.printer), { t: "view", dev: "printer", key: "panel" }])) E.act(T, a);
  assert.deepEqual(T.evidence.map((e) => e.id), ["int", "status", "ping", "panel"]);
});
