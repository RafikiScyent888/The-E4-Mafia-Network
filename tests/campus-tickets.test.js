/* Tier 4 campus tickets, checked on several generated campuses each: the fault shows in what a student would type (the switches' own
   show commands over SSH from a desk PC, ipconfig, ping), the board is one right and five near misses, the real fix works and is
   proven, the tempting wrong fixes don't (a fix that weakens what the records set works today, isn't the fix, and Mason says so), the
   ladder climbs as the program's rule says, a saved ticket replays exactly, and the campus's records on the card carry what a
   technician needs to log in. A campus takes three or four seconds to build (CP-J1 to CP-J10 replayed), so few seeds. */
import test from "node:test";
import assert from "node:assert/strict";
import { CAMPUS_TICKETS, campusRecords } from "../js/tickets/campus.js";
import * as E from "../js/tickets/engine.js";
import { exec } from "../js/net/cmd.js";
import { coreLinks } from "../js/net/campus.js";
import { rng, hash } from "../js/net/util.js";

const N = Number(process.env.SEEDS || 4);
const seeds = Array.from({ length: N }, (_, i) => 6100 + i * 7919);
/* every variant on every run: the seeds, plus a campus for each variant they miss (a ticket picks its variant from the seed alone) */
const seedsOf = (def, n) => { const base = seeds.slice(0, n || seeds.length); if (!def.kinds) return base; const kind = (s) => rng(hash(def.id + ":" + s)).pick(def.kinds), have = new Set(base.map(kind)), extra = [];
  for (let s = 1; have.size < def.kinds.length && s < 2000; s++) if (!have.has(kind(s))) { have.add(kind(s)); extra.push(s); }
  return base.concat(extra); };
const on = (dev) => (line) => ({ t: "cmd", dev: dev, line: line });
const out = (T, acts) => acts.map((a) => (E.act(T, a) || {}).out || "").join("");
/* SSH from another desk PC to a switch, privileged; then lines; out again */
const ssh = (T, from, ip) => { const p = T.v.plan, f = on(from); return [f("ssh " + p.user + "@" + ip), f(p.userPw), f("enable"), f(p.secret)]; };
const onSw = (T, lines, save) => { const v = T.v, f = on(CP01.other(v)); return ssh(T, CP01.other(v), v.plan.sw[v.sw].ip).concat([f("configure terminal")], lines.map(f), [f("end")], save ? [f("copy running-config startup-config"), f("")] : [], [f("exit")]); };
const CP01 = CAMPUS_TICKETS.find((d) => d.id === "CP-01");
const bounce = (T) => onSw(T, ["interface gi0/" + T.v.port, "shutdown", "no shutdown"]);
const proof = (T) => [on(T.v.dev)("ping 8.8.8.8")];

test("CP-01: the fault shows in the commands: the PC with no link, its port err-disabled by port security, one violation by the visitor's address, the PC's own still the sticky one", () => {
  for (const s of seedsOf(CP01)) {
    const T = E.open(CP01, s), v = T.v, f = on(CP01.other(v));
    assert.ok(CP01.exhibits(T.sim, v), s + " exhibits");
    assert.match(out(T, [on(v.dev)("ipconfig")]), /Media disconnected/);
    const o = out(T, ssh(T, CP01.other(v), v.plan.sw[v.sw].ip).concat([f("show interfaces status"), f("show port-security interface gi0/" + v.port), f("show port-security address"), f("show port-security")]));
    assert.match(o, new RegExp("^Gi0/" + v.port + "\\s.*err-disabled", "m"), s + " err-disabled");
    assert.match(o, /Port Status\s+: Secure-shutdown/); assert.match(o, /Security Violation Count\s+: 1/);
    assert.ok(o.indexOf("Last Source Address:Vlan   : " + v.visitor + ":" + v.vid) >= 0, s + " the visitor's address the last source");
    assert.match(o, new RegExp(v.pcMac.replace(/\./g, "\\.") + "\\s+SecureSticky\\s+Gi0/" + v.port + "\\b"), s + " the PC's own address still the sticky one");
    assert.equal(T.fixed, false);
    assert.ok(T.evidence.some((e) => e.id === "psint") && T.evidence.some((e) => e.id === "status") && T.evidence.some((e) => e.id === "psaddr") && T.evidence.some((e) => e.id === "ipc"), s + " the notebook took the evidence");
  }
});

test("CP-01: the board is one right answer and five near misses, each with its reason", () => {
  const T = E.open(CP01, seeds[0]);
  assert.equal(T.opts.length, 6); assert.equal(T.opts.filter((o) => o.right).length, 1);
  assert.ok(T.opts.filter((o) => !o.right).every((o) => o.why && o.why.length > 30));
});

test("CP-01: the port shut and opened again fixes it, port security as it was; the PC's ping to the internet proves it, and a right diagnosis solves it", () => {
  for (const s of seedsOf(CP01)) {
    const T = E.open(CP01, s), v = T.v;
    for (const a of proof(T)) E.act(T, a); assert.equal(T.proven, false, s + " a ping before the fix proves nothing");
    for (const a of bounce(T)) E.act(T, a);
    assert.equal(T.fixed, true, s + " fixed"); assert.equal(T.sim.d[v.dev].ifaces[0].lease.server, v.plan.srv.fsrv.ip, s + " the PC asked for its address again when its link came up");
    E.act(T, on(v.dev)("ping " + v.plan.sw[v.sw].ip)); assert.equal(T.proven, false, s + " a ping that stays inside the campus (its own switch answers) isn't the proof");
    for (const a of proof(T)) E.act(T, a); assert.equal(T.proven, true);
    E.guess(T, T.opts.find((o) => o.right).id); assert.equal(T.solved, true);
  }
});

test("CP-01: the tempting wrong fixes don't: no shutdown alone, a restart, a cable reseated, the PC asking again; port security taken off or loosened works today and isn't the fix", () => {
  for (const s of seedsOf(CP01, 2)) {
    const open = () => E.open(CP01, s);
    let T = open(); for (const a of onSw(T, ["interface gi0/" + T.v.port, "no shutdown"])) E.act(T, a); assert.equal(T.fixed, false, s + " no shutdown alone: still err-disabled");
    assert.match(out(T, ssh(T, CP01.other(T.v), T.v.plan.sw[T.v.sw].ip).concat([on(CP01.other(T.v))("show interfaces status")])), new RegExp("^Gi0/" + T.v.port + "\\s.*err-disabled", "m"));
    T = open(); E.act(T, { t: "power", dev: T.v.dev }); E.act(T, on(T.v.dev)("ipconfig /renew")); assert.equal(T.fixed, false, s + " a restart and a renew");
    T = open(); const c = T.sim.cableAt(T.v.dev, "NIC"); E.act(T, { t: "reseat", cable: c.id, end: c.a.dev === T.v.dev ? "a" : "b" }); assert.equal(T.fixed, false, s + " the cable reseated");
    T = open(); for (const a of onSw(T, ["interface gi0/" + T.v.port, "no switchport port-security", "shutdown", "no shutdown"])) E.act(T, a);
    assert.equal(T.fixed, false, s + " port security off"); for (const a of proof(T)) E.act(T, a); assert.equal(T.proven, false); assert.match(T.partial || "", /isn't protected the way the records have it/);
    T = open(); for (const a of onSw(T, ["interface gi0/" + T.v.port, "switchport port-security maximum 2", "shutdown", "no shutdown"])) E.act(T, a);
    assert.equal(T.fixed, false, s + " two addresses allowed"); for (const a of proof(T)) E.act(T, a); assert.match(T.partial || "", /isn't protected/);
    T = open(); for (const a of onSw(T, ["interface gi0/" + T.v.port, "switchport port-security violation restrict", "shutdown", "no shutdown"])) E.act(T, a);
    assert.equal(T.fixed, false, s + " restrict instead of shutdown");
    /* port security off and saved, then back on and not saved: the running copy is the records', the saved one isn't */
    T = open(); for (const a of onSw(T, ["interface gi0/" + T.v.port, "no switchport port-security", "shutdown", "no shutdown"], true).concat(onSw(T, ["interface gi0/" + T.v.port, "switchport port-security"]))) E.act(T, a);
    assert.ok(CP01.secured(T.sim.d[T.v.sw].sw.ports["GigabitEthernet0/" + T.v.port], T.v), s + " the running copy is the records' again");
    assert.equal(T.fixed, false, s + " the saved copy without port security"); for (const a of proof(T)) E.act(T, a); assert.equal(T.proven, false); assert.match(T.partial || "", /saved configuration no longer has port security/);
  }
});

test("CP-01: the ladder climbs 0, 0, rung 1, rung 2, then narrows to two after a reset, for ever", () => {
  const T = E.open(CP01, seeds[1]), wrongs = T.opts.filter((o) => !o.right).map((o) => o.id);
  assert.equal(E.guess(T, wrongs[0]).rung, 0); assert.equal(E.guess(T, wrongs[1]).rung, 0);
  assert.equal(E.guess(T, wrongs[2]).rung, 1); assert.equal(E.guess(T, wrongs[3]).rung, 2);
  assert.equal(E.guess(T, wrongs[3]).ruledOut, true, "a red pick stays red");
  E.resetBoard(T); assert.equal(E.live(T).length, 6); assert.equal(T.wrong, 4, "reset keeps the count");
  assert.equal(E.guess(T, wrongs[4]).rung, 3);
  const L = E.live(T); assert.equal(L.length, 2); assert.ok(L.some((o) => o.right)); assert.ok(T.struck.every((x) => x.why));
  for (let k = 0; k < 3; k++) { E.resetBoard(T); const w = E.live(T).find((o) => !o.right).id; assert.equal(E.guess(T, w).rung, 3); assert.equal(E.live(T).length, 2); }
});

test("CP-01: a saved ticket replays exactly, the SSH session included", () => {
  for (const s of seedsOf(CP01, 2)) {
    const T = E.open(CP01, s), v = T.v;
    for (const a of [on(v.dev)("ipconfig /all"), on(CP01.other(v))("ping -n 2 8.8.8.8")].concat(bounce(T), proof(T))) E.act(T, a);
    const R = E.restore(CP01, JSON.parse(JSON.stringify(E.save(T))));
    assert.equal(R.fixed, T.fixed); assert.deepEqual(R.evidence, T.evidence); assert.equal(R.proven, T.proven);
    assert.equal(JSON.stringify(R.sim.net), JSON.stringify(T.sim.net));
    assert.equal(exec(R.sim, v.dev, "ping -n 3 8.8.8.8").out.replace(/time[<=]\d+ms/g, ""), exec(T.sim, v.dev, "ping -n 3 8.8.8.8").out.replace(/time[<=]\d+ms/g, ""));
  }
});

test("CP-01: the brief and every hint never name the right answer, a password, a VLAN number or the fix's command", () => {
  for (const s of seedsOf(CP01, 3)) {
    const T = E.open(CP01, s), right = T.opts.find((o) => o.right).text.toLowerCase(), p = T.v.plan;
    const texts = [CP01.rung1(T.v, T.sim), CP01.rung2(T.v, T.sim), ...CP01.fixHints(T.v, T.sim), CP01.brief(T.v, T.sim).quote, CP01.mason].map((x) => x.toLowerCase());
    for (const x of texts) {
      assert.ok(x.indexOf(right) < 0, x);
      for (const bad of [p.secret, p.console, p.userPw, p.srv.pw].map((b) => b.toLowerCase())) assert.ok(x.indexOf(bad) < 0, "names a password: " + x);
      for (const n of Object.values(p.vlans).map((V) => String(V.id)).concat([String(p.train.id), String(p.annex.cls.id)])) assert.ok(!new RegExp("\\b" + n + "\\b").test(x), "names VLAN " + n + ": " + x);
      for (const cmd of ["no shutdown", "interface gi", "switchport port-security", "errdisable", "copy running-config"]) assert.ok(x.indexOf(cmd) < 0, "names the command " + cmd + ": " + x);
    }
  }
});

test("Rafiki's records on the card carry every login, the switches' and the edge router's addresses, the servers and the VLAN plan; each login works", () => {
  const T = E.open(CP01, seeds[0]), p = T.v.plan, rows = campusRecords(T.v, T.sim), all = rows.map((r) => r[0] + ": " + r[1]).join("\n");
  for (const x of [p.secret, p.console, p.user, p.userPw, p.edge.host, coreLinks(p)[0].ia, p.srv.fsrv.ip, p.srv.pw, p.annex.core.ip, p.annex.acc.ip].concat(["dist1", "dist2", "acc1", "acc2", "acc3", "acc4"].map((k) => p.sw[k].ip))) assert.ok(all.indexOf(x) >= 0, "the records give " + x);
  for (const V of [p.vlans.svc, p.vlans.bench, p.vlans.office, p.train, p.annex.cls, p.vlans.servers, p.vlans.printers, p.vlans.mgmt]) assert.ok(rows.some((r) => / VLAN/.test(r[0]) && r[1].indexOf(V.id + " · named " + V.name + " · " + V.net + "/24 · gateway " + V.gw) === 0), "the VLAN plan gives " + V.name);
  const sd = on("sd1");
  for (const k of ["dist1", "acc3"]) { assert.match(out(T, ssh(T, "sd1", p.sw[k].ip).concat([sd("show running-config")])), new RegExp("hostname " + p.sw[k].host), "SSH to " + k); E.act(T, sd("exit")); }
  assert.match(out(T, ssh(T, "sd1", coreLinks(p)[0].ia).concat([sd("show running-config")])), new RegExp("hostname " + p.edge.host), "SSH to the edge router"); E.act(T, sd("exit"));
  assert.match(out(T, ssh(T, "sd1", p.annex.acc.ip).concat([sd("show running-config")])), new RegExp("hostname " + p.annex.acc.host), "SSH to the Annex access switch"); E.act(T, sd("exit"));
  assert.match(out(T, [sd("ssh " + p.srv.user + "@" + p.srv.fsrv.ip), sd(p.srv.pw), sd("hostname")]), new RegExp(p.srv.fsrv.host), "SSH to the file server");
});
