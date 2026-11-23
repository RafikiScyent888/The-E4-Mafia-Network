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
import { online } from "../js/build/jobs.js";
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

/* ---------------------------------------------------------------- CP-02 */
const CP02 = CAMPUS_TICKETS.find((d) => d.id === "CP-02");
const onDev = (T, lines, save) => { const v = T.v, f = on(v.pc); return [f("ssh " + v.plan.user + "@" + v.swIp), f(v.plan.userPw), f("enable"), f(v.plan.secret), f("configure terminal")].concat(lines.map(f), [f("end")], save === false ? [] : [f("copy running-config startup-config"), f("")], [f("exit")]); };
const unPassive = (T) => onDev(T, ["router ospf 1"].concat(T.v.ups.map((n) => "no passive-interface " + n)));
const proof2 = (T) => [on(T.v.pc)("ping 8.8.8.8")];

test("CP-02: the fault shows in the commands: the desk's traffic stopping at its gateway with no route, the switch with no neighbours, every interface passive, no gateway of last resort, its uplinks up", () => {
  for (const s of seedsOf(CP02)) {
    const T = E.open(CP02, s), v = T.v, f = on(v.pc);
    assert.ok(CP02.exhibits(T.sim, v), s + " exhibits");
    assert.match(out(T, [f("tracert 8.8.8.8")]), /reports: Destination net unreachable\./, s + " tracert stops at the gateway");
    assert.match(out(T, [f("ipconfig")]), new RegExp("Default Gateway[ .]*: " + v.gw.replace(/\./g, "\\.")), s + " the desk still has its lease and gateway");
    const o = out(T, [f("ssh " + v.plan.user + "@" + v.swIp), f(v.plan.userPw), f("enable"), f(v.plan.secret), f("show ip ospf neighbor"), f("show ip protocols"), f("show ip route"), f("show ip interface brief")]);
    assert.ok(!/FULL/.test(o), s + " no neighbours"); assert.match(o, /\(every interface but none\)/); assert.match(o, /Gateway of last resort is not set/);
    for (const n of v.ups) assert.match(o, new RegExp("^" + n + "\\s.*\\bup\\s+up", "m"), s + " " + n + " up");
    assert.equal(T.fixed, false);
    for (const id of ["unreach", "nbr", "proto", "route", "brief"]) assert.ok(T.evidence.some((e) => e.id === id), s + " the notebook took " + id);
    assert.equal(T.opts.length, 6); assert.equal(T.opts.filter((o) => o.right).length, 1); assert.ok(T.opts.filter((o) => !o.right).every((o) => o.why && o.why.length > 30));
    const S = CP02.summary(v); assert.ok(S.cause.length > 80 && S.fix.length > 60);
  }
});

test("CP-02: the ports facing the core taken out of the template, saved, fixes it; the desk's ping to the internet proves it, and a right diagnosis solves it", () => {
  for (const s of seedsOf(CP02)) {
    const T = E.open(CP02, s), v = T.v;
    for (const a of proof2(T)) E.act(T, a); assert.equal(T.proven, false, s + " a ping before the fix proves nothing");
    for (const a of unPassive(T)) E.act(T, a);
    assert.equal(T.fixed, true, s + " fixed");
    E.act(T, on(v.pc)("ping " + v.gw)); assert.equal(T.proven, false, s + " a ping to the gateway isn't the proof");
    for (const a of proof2(T)) E.act(T, a); assert.equal(T.proven, true);
    E.guess(T, T.opts.find((o) => o.right).id); assert.equal(T.solved, true);
  }
});

test("CP-02: the tempting wrong fixes don't: the template taken off altogether, one uplink of two, a static route, the fix unsaved, the other distribution switch", () => {
  for (const s of seedsOf(CP02, 2)) {
    const open = () => E.open(CP02, s);
    let T = open(); for (const a of onDev(T, ["router ospf 1", "no passive-interface default"])) E.act(T, a);
    assert.equal(T.fixed, false, s + " the template off"); for (const a of proof2(T)) E.act(T, a); assert.equal(T.proven, false); assert.match(T.partial || "", /talks out of every interface/);
    T = open(); for (const a of unPassive(T).slice(0, 0).concat(onDev(T, ["router ospf 1"].concat(T.v.ups.map((n) => "no passive-interface " + n)), false))) E.act(T, a);
    assert.equal(T.fixed, false, s + " unsaved"); for (const a of proof2(T)) E.act(T, a); assert.match(T.partial || "", /hasn't saved it/);
    T = open(); const nh = T.v.kind === "hq" ? coreLinks(T.v.plan).find((l) => l.b === "dist1").ia : null;
    if (nh) { for (const a of onDev(T, ["ip route 0.0.0.0 0.0.0.0 " + nh])) E.act(T, a); assert.equal(T.fixed, false, s + " a static default"); for (const a of proof2(T)) E.act(T, a); assert.equal(T.proven, false); assert.match(T.partial || "", /static route/); }
    /* the real fix, and a static default typed on top of it: it works, and isn't the records' */
    T = open(); const nh2 = T.v.kind === "hq" ? coreLinks(T.v.plan).find((l) => l.b === "dist1").ia : T.v.plan.annex.link.hqIp;
    for (const a of unPassive(T).concat(onDev(T, ["ip route 0.0.0.0 0.0.0.0 " + nh2]))) E.act(T, a);
    assert.equal(T.fixed, false, s + " the fix with a static default on top"); for (const a of proof2(T)) E.act(T, a); assert.equal(T.proven, false); assert.match(T.partial || "", /static route/);
    if (T.v.kind === "hq") {
      T = open(); for (const a of onDev(T, ["router ospf 1", "no passive-interface " + T.v.ups[0]])) E.act(T, a);
      assert.equal(T.fixed, false, s + " one uplink of two"); for (const a of proof2(T)) E.act(T, a); assert.equal(T.proven, false); assert.match(T.partial || "", /still keeps OSPF quiet on/);
      T = open(); const v = T.v, f = on(v.pc); for (const a of [f("ssh " + v.plan.user + "@" + v.plan.sw.dist2.ip), f(v.plan.userPw), f("enable"), f(v.plan.secret), f("configure terminal"), f("router ospf 1"), f("no passive-interface default"), f("end"), f("exit")]) E.act(T, a);
      assert.equal(T.fixed, false, s + " distribution switch 2 changed instead"); assert.ok(CP02.exhibits(T.sim, T.v));
    } else {
      T = open(); for (const a of onDev(T, ["router ospf 1", "no passive-interface vlan " + T.v.plan.annex.cls.id])) E.act(T, a);
      assert.equal(T.fixed, false, s + " the classroom's VLAN interface instead"); assert.ok(CP02.exhibits(T.sim, T.v));
    }
  }
});

test("CP-02: the ladder climbs, and a saved ticket replays exactly", () => {
  const T = E.open(CP02, seedsOf(CP02)[0]), wrongs = T.opts.filter((o) => !o.right).map((o) => o.id);
  assert.equal(E.guess(T, wrongs[0]).rung, 0); assert.equal(E.guess(T, wrongs[1]).rung, 0); assert.equal(E.guess(T, wrongs[2]).rung, 1); assert.equal(E.guess(T, wrongs[3]).rung, 2);
  E.resetBoard(T); assert.equal(E.guess(T, wrongs[4]).rung, 3); assert.equal(E.live(T).length, 2); assert.ok(E.live(T).some((o) => o.right));
  for (const s of seedsOf(CP02, 1)) {
    const U = E.open(CP02, s), v = U.v;
    for (const a of [on(v.pc)("tracert 8.8.8.8")].concat(unPassive(U), proof2(U))) E.act(U, a);
    const R = E.restore(CP02, JSON.parse(JSON.stringify(E.save(U))));
    assert.equal(R.fixed, U.fixed); assert.deepEqual(R.evidence, U.evidence); assert.equal(R.proven, U.proven); assert.equal(JSON.stringify(R.sim.net), JSON.stringify(U.sim.net));
  }
});

test("CP-02: the brief and every hint never name the right answer, a password, a VLAN number or the fix's command", () => {
  for (const s of seedsOf(CP02)) {
    const T = E.open(CP02, s), right = T.opts.find((o) => o.right).text.toLowerCase(), p = T.v.plan;
    const texts = [CP02.rung1(T.v, T.sim), CP02.rung2(T.v, T.sim), ...CP02.fixHints(T.v, T.sim), CP02.brief(T.v, T.sim).quote, CP02.mason].map((x) => x.toLowerCase());
    for (const x of texts) {
      assert.ok(x.indexOf(right) < 0, x);
      for (const bad of [p.secret, p.console, p.userPw, p.srv.pw].map((b) => b.toLowerCase())) assert.ok(x.indexOf(bad) < 0, "names a password: " + x);
      for (const n of Object.values(p.vlans).map((V) => String(V.id)).concat([String(p.train.id), String(p.annex.cls.id)])) assert.ok(!new RegExp("\\b" + n + "\\b").test(x), "names VLAN " + n + ": " + x);
      for (const cmd of ["passive", "router ospf", "copy running-config", "gi0/19", "gi0/20", "gi0/25"]) assert.ok(x.indexOf(cmd) < 0, "names " + cmd + ": " + x);
    }
  }
});

/* ---------------------------------------------------------------- CP-03 */
const CP03 = CAMPUS_TICKETS.find((d) => d.id === "CP-03");
const onDist = (T, which, lines, save) => { const v = T.v, f = on(v.other); return [f("ssh " + v.plan.user + "@" + v.plan.sw[which].ip), f(v.plan.userPw), f("enable"), f(v.plan.secret), f("configure terminal")].concat(lines.map(f), [f("end")], save === false ? [] : [f("copy running-config startup-config"), f("")], [f("exit")]); };
const vipFix = (T) => onDist(T, "dist1", ["interface vlan " + T.v.vid, "standby " + T.v.vid + " ip " + T.v.gw]);
const proof3 = (T) => [on(T.v.pc)("ping 8.8.8.8")];

test("CP-03: the fault shows in the commands: the floor's desks with the right gateway and nobody answering it, distribution switch 1's own address answering, the group active on distribution switch 1 at the wrong address", () => {
  for (const s of seedsOf(CP03)) {
    const T = E.open(CP03, s), v = T.v, f = on(v.pc), g = on(v.other);
    assert.ok(CP03.exhibits(T.sim, v), s + " exhibits");
    assert.match(out(T, [f("ipconfig")]), new RegExp("Default Gateway[ .]*: " + v.gw.replace(/\./g, "\\.")), s + " the right gateway");
    assert.match(out(T, [f("ping " + v.gw)]), /Destination host unreachable|Request timed out/); assert.match(out(T, [f("ping " + v.own1)]), /Reply from .*bytes=/, s + " distribution switch 1's own address answers");
    assert.ok(out(T, [f("arp -a")]).indexOf(v.gw + " ") < 0, s + " no ARP entry for the gateway");
    const o = out(T, [g("ssh " + v.plan.user + "@" + v.plan.sw.dist1.ip), g(v.plan.userPw), g("enable"), g(v.plan.secret), g("show standby brief")]);
    assert.match(o, new RegExp("^Vl" + v.vid + "\\s+" + v.vid + "\\s+110\\s+P Active\\s.*" + v.typo.replace(/\./g, "\\.") + "\\s*$", "m"), s + " distribution switch 1 active at the wrong address");
    assert.equal(T.fixed, false);
    for (const id of ["ipc", "gwping", "own1", "sb"]) assert.ok(T.evidence.some((e) => e.id === id), s + " the notebook took " + id);
    assert.equal(T.opts.length, 6); assert.equal(T.opts.filter((o) => o.right).length, 1); assert.ok(T.opts.filter((o) => !o.right).every((o) => o.why && o.why.length > 30));
    const S = CP03.summary(v); assert.ok(S.cause.length > 80 && S.fix.length > 60);
  }
});

test("CP-03: the virtual address put right on distribution switch 1, saved, fixes it; the desk's ping to the internet proves it, and a right diagnosis solves it", () => {
  for (const s of seedsOf(CP03)) {
    const T = E.open(CP03, s), v = T.v;
    for (const a of proof3(T)) E.act(T, a); assert.equal(T.proven, false, s + " a ping before the fix proves nothing");
    for (const a of vipFix(T)) E.act(T, a);
    assert.equal(T.fixed, true, s + " fixed");
    E.act(T, on(v.pc)("ping " + v.gw)); assert.equal(T.proven, false, s + " a ping to the gateway isn't the proof");
    for (const a of proof3(T)) E.act(T, a); assert.equal(T.proven, true);
    E.guess(T, T.opts.find((o) => o.right).id); assert.equal(T.solved, true);
  }
});

test("CP-03: the tempting wrong fixes don't: distribution switch 1 taken out of the group, distribution switch 2 matched to the wrong address, the fix unsaved, the desk given a gateway by hand", () => {
  for (const s of seedsOf(CP03, 2)) {
    const open = () => E.open(CP03, s);
    let T = open(); for (const a of onDist(T, "dist1", ["interface vlan " + T.v.vid, "no standby " + T.v.vid])) E.act(T, a);
    assert.equal(T.fixed, false, s + " distribution switch 1 out of the group"); for (const a of proof3(T)) E.act(T, a); assert.equal(T.proven, false); assert.match(T.partial || "", /isn't the floor's active gateway/);
    T = open(); for (const a of onDist(T, "dist2", ["interface vlan " + T.v.vid, "standby " + T.v.vid + " ip " + T.v.typo])) E.act(T, a);
    assert.equal(T.fixed, false, s + " distribution switch 2 matched to the typo"); assert.ok(CP03.exhibits(T.sim, T.v));
    T = open(); for (const a of onDist(T, "dist1", ["interface vlan " + T.v.vid, "standby " + T.v.vid + " ip " + T.v.gw], false)) E.act(T, a);
    assert.equal(T.fixed, false, s + " unsaved"); for (const a of proof3(T)) E.act(T, a); assert.match(T.partial || "", /hasn't saved it/);
    T = open(); E.act(T, { t: "client", dev: T.v.pc, values: { mode: "static", ip: T.sim.addr(T.v.pc).ip, mask: T.v.plan.mask, gw: T.v.typo, dns: [] } });
    assert.equal(T.fixed, false, s + " the desk pointed at the wrong address by hand");
  }
});

test("CP-03: the ladder climbs, and a saved ticket replays exactly", () => {
  const T = E.open(CP03, seedsOf(CP03)[0]), wrongs = T.opts.filter((o) => !o.right).map((o) => o.id);
  assert.equal(E.guess(T, wrongs[0]).rung, 0); assert.equal(E.guess(T, wrongs[1]).rung, 0); assert.equal(E.guess(T, wrongs[2]).rung, 1); assert.equal(E.guess(T, wrongs[3]).rung, 2);
  E.resetBoard(T); assert.equal(E.guess(T, wrongs[4]).rung, 3); assert.equal(E.live(T).length, 2); assert.ok(E.live(T).some((o) => o.right));
  const U = E.open(CP03, seedsOf(CP03, 1)[0]), v = U.v;
  for (const a of [on(v.pc)("ping " + v.gw)].concat(vipFix(U), proof3(U))) E.act(U, a);
  const R = E.restore(CP03, JSON.parse(JSON.stringify(E.save(U))));
  assert.equal(R.fixed, U.fixed); assert.deepEqual(R.evidence, U.evidence); assert.equal(R.proven, U.proven); assert.equal(JSON.stringify(R.sim.net), JSON.stringify(U.sim.net));
});

test("CP-03: the brief and every hint never name the right answer, a password, a VLAN number, either address or the fix's command", () => {
  for (const s of seedsOf(CP03)) {
    const T = E.open(CP03, s), right = T.opts.find((o) => o.right).text.toLowerCase(), p = T.v.plan;
    const texts = [CP03.rung1(T.v, T.sim), CP03.rung2(T.v, T.sim), ...CP03.fixHints(T.v, T.sim), CP03.brief(T.v, T.sim).quote, CP03.mason].map((x) => x.toLowerCase());
    for (const x of texts) {
      assert.ok(x.indexOf(right) < 0, x);
      for (const bad of [p.secret, p.console, p.userPw, p.srv.pw].map((b) => b.toLowerCase())) assert.ok(x.indexOf(bad) < 0, "names a password: " + x);
      for (const n of Object.values(p.vlans).map((V) => String(V.id)).concat([String(p.train.id), String(p.annex.cls.id)])) assert.ok(!new RegExp("\\b" + n + "\\b").test(x), "names VLAN " + n + ": " + x);
      for (const bad of [T.v.gw, T.v.typo, "standby " + T.v.vid, "interface vlan", "copy running-config"]) assert.ok(x.indexOf(bad) < 0, "names " + bad + ": " + x);
    }
  }
});

/* ---------------------------------------------------------------- CP-04 */
const CP04 = CAMPUS_TICKETS.find((d) => d.id === "CP-04");
const onD = (T, which, lines, save) => { const v = T.v, f = on("sd1"); return [f("ssh " + v.plan.user + "@" + v.plan.sw[which].ip), f(v.plan.userPw), f("enable"), f(v.plan.secret), f("configure terminal")].concat(lines.map(f), [f("end")], save === false ? [] : [f("copy running-config startup-config"), f("")], [f("exit")]); };
const fix4 = (T) => onD(T, "dist1", ["interface vlan " + T.v.vid, T.v.kind === "preempt" ? "standby " + T.v.vid + " preempt" : "standby " + T.v.vid + " priority 110"]);
const proof4 = (T) => { const v = T.v, f = on("sd1"); return [f("ssh " + v.plan.user + "@" + v.plan.sw.dist1.ip), f(v.plan.userPw), f("enable"), f(v.plan.secret), f("show standby brief"), f("exit")]; };

test("CP-04: the fault shows in the commands: switch 2 active for the flagged VLAN, switch 1 standby with its priority or preempt changed, up two days by reload; nobody offline", () => {
  for (const s of seedsOf(CP04)) {
    const T = E.open(CP04, s), v = T.v, f = on("sd1");
    assert.ok(CP04.exhibits(T.sim, v), s + " exhibits");
    const o2 = out(T, [f("ssh " + v.plan.user + "@" + v.plan.sw.dist2.ip), f(v.plan.userPw), f("enable"), f(v.plan.secret), f("show standby brief"), f("exit")]);
    assert.match(o2, new RegExp("^Vl" + v.vid + "\\s+" + v.vid + "\\s+100\\s{3}Active\\s+local", "m"), s + " switch 2 active");
    const o1 = out(T, [f("ssh " + v.plan.user + "@" + v.plan.sw.dist1.ip), f(v.plan.userPw), f("enable"), f(v.plan.secret), f("show standby brief"), f("show version"), f("show running-config"), f("exit")]);
    assert.match(o1, new RegExp("^Vl" + v.vid + "\\s+" + v.vid + "\\s+" + (v.kind === "preempt" ? "110\\s{3}" : "100 P ") + "Standby\\b", "m"), s + " switch 1 standby, " + v.kind);
    assert.match(o1, /uptime is 2 days/); assert.match(o1, /returned to ROM by reload/);
    assert.equal(T.fixed, false); assert.equal(T.proven, false, s + " show standby brief before the fix proves nothing");
    for (const id of ["sb2", "sb1", "ver", "run"]) assert.ok(T.evidence.some((e) => e.id === id), s + " the notebook took " + id);
    assert.equal(T.opts.length, 6); assert.equal(T.opts.filter((o) => o.right).length, 1); assert.ok(T.opts.filter((o) => !o.right).every((o) => o.why && o.why.length > 30));
    assert.ok(T.opts.some((o) => !o.right && o.id === (v.kind === "preempt" ? "priority" : "preempt")), s + " the other cause is a near miss");
    const S = CP04.summary(v); assert.ok(S.cause.length > 80 && S.fix.length > 60);
  }
});

test("CP-04: switch 1's group put back as the records have it, saved, fixes it; show standby brief on switch 1 proves it, and a right diagnosis solves it", () => {
  for (const s of seedsOf(CP04)) {
    const T = E.open(CP04, s);
    for (const a of fix4(T)) E.act(T, a);
    assert.equal(T.fixed, true, s + " fixed");
    for (const a of proof4(T)) E.act(T, a); assert.equal(T.proven, true, s + " proven");
    E.guess(T, T.opts.find((o) => o.right).id); assert.equal(T.solved, true);
  }
});

test("CP-04: the tempting wrong fixes don't: the other variant's fix, switch 2 lowered or bounced, the fix unsaved", () => {
  for (const s of seedsOf(CP04)) {
    const open = () => E.open(CP04, s);
    let T = open(); for (const a of onD(T, "dist1", ["interface vlan " + T.v.vid, T.v.kind === "preempt" ? "standby " + T.v.vid + " priority 120" : "standby " + T.v.vid + " preempt"])) E.act(T, a);
    assert.equal(T.fixed, false, s + " the other variant's fix"); assert.ok(CP04.exhibits(T.sim, T.v), s + " switch 2 still active");
    T = open(); for (const a of onD(T, "dist2", ["interface vlan " + T.v.vid, "standby " + T.v.vid + " priority 90"])) E.act(T, a);
    assert.equal(T.fixed, false, s + " switch 2 lowered"); for (const a of proof4(T)) E.act(T, a);
    if (T.v.kind === "priority") assert.match(T.partial || "", /switch 2's settings for the group have changed/, s + " switch 1 preempts over the lowered switch 2"); else assert.ok(CP04.exhibits(T.sim, T.v), s + " switch 1 doesn't preempt: switch 2 stays active");
    T = open(); for (const a of onD(T, "dist2", ["interface vlan " + T.v.vid, "shutdown", "no shutdown"])) E.act(T, a);
    assert.equal(T.fixed, false, s + " switch 2 bounced"); for (const a of proof4(T)) E.act(T, a); assert.equal(T.proven, false); assert.match(T.partial || "", /only because switch 2 dropped out/);
    T = open(); for (const a of fix4(T).slice(0, 0).concat(onD(T, "dist1", ["interface vlan " + T.v.vid, T.v.kind === "preempt" ? "standby " + T.v.vid + " preempt" : "standby " + T.v.vid + " priority 110"], false))) E.act(T, a);
    assert.equal(T.fixed, false, s + " unsaved"); for (const a of proof4(T)) E.act(T, a); assert.match(T.partial || "", /hasn't saved the change/);
  }
});

test("CP-04: the ladder climbs, and a saved ticket replays exactly", () => {
  const T = E.open(CP04, seedsOf(CP04)[0]), wrongs = T.opts.filter((o) => !o.right).map((o) => o.id);
  assert.equal(E.guess(T, wrongs[0]).rung, 0); assert.equal(E.guess(T, wrongs[1]).rung, 0); assert.equal(E.guess(T, wrongs[2]).rung, 1); assert.equal(E.guess(T, wrongs[3]).rung, 2);
  E.resetBoard(T); assert.equal(E.guess(T, wrongs[4]).rung, 3); assert.equal(E.live(T).length, 2); assert.ok(E.live(T).some((o) => o.right));
  const U = E.open(CP04, seedsOf(CP04, 1)[0]);
  for (const a of fix4(U).concat(proof4(U))) E.act(U, a);
  const R = E.restore(CP04, JSON.parse(JSON.stringify(E.save(U))));
  assert.equal(R.fixed, U.fixed); assert.deepEqual(R.evidence, U.evidence); assert.equal(R.proven, U.proven); assert.equal(JSON.stringify(R.sim.net), JSON.stringify(U.sim.net));
});

test("CP-04: the brief and every hint never name the right answer, a password, a VLAN number or the fix's command", () => {
  for (const s of seedsOf(CP04)) {
    const T = E.open(CP04, s), right = T.opts.find((o) => o.right).text.toLowerCase(), p = T.v.plan;
    const texts = [CP04.rung1(T.v, T.sim), CP04.rung2(T.v, T.sim), ...CP04.fixHints(T.v, T.sim), CP04.brief(T.v, T.sim).quote, CP04.mason].map((x) => x.toLowerCase());
    for (const x of texts) {
      assert.ok(x.indexOf(right) < 0, x);
      for (const bad of [p.secret, p.console, p.userPw, p.srv.pw].map((b) => b.toLowerCase())) assert.ok(x.indexOf(bad) < 0, "names a password: " + x);
      for (const n of Object.values(p.vlans).map((V) => String(V.id)).concat([String(p.train.id), String(p.annex.cls.id)])) assert.ok(!new RegExp("\\b" + n + "\\b").test(x), "names VLAN " + n + ": " + x);
      for (const bad of ["standby " + T.v.vid, "priority 110", "interface vlan", "copy running-config"]) assert.ok(x.indexOf(bad) < 0, "names " + bad + ": " + x);
    }
    for (const x of [CP04.brief(T.v, T.sim).quote, CP04.mason].map((y) => y.toLowerCase())) for (const bad of ["preempt", "priority"]) assert.ok(x.indexOf(bad) < 0, "the brief or Mason's opener names " + bad + ": " + x);
  }
});

/* ---------------------------------------------------------------- CP-05 */
const CP05 = CAMPUS_TICKETS.find((d) => d.id === "CP-05");
const onEdge = (T, lines, save) => { const v = T.v, f = on(v.pc); return [f("ssh " + v.plan.user + "@" + v.edgeIp), f(v.plan.userPw), f("enable"), f(v.plan.secret), f("configure terminal")].concat(lines.map(f), [f("end")], save === false ? [] : [f("copy running-config startup-config"), f("")], [f("exit")]); };
const fix5 = (T) => onEdge(T, T.v.kind === "originate" ? ["router ospf 1", "default-information originate"] : ["interface " + T.v.wan, "ip address dhcp"]);
const proof5 = (T) => [on(T.v.pc)("ping 8.8.8.8")];

test("CP-05: the fault shows in the commands: every desk's gateway turning the internet back, distribution switch 1 with its neighbours and no way out, the edge router without the default or not announcing it", () => {
  for (const s of seedsOf(CP05)) {
    const T = E.open(CP05, s), v = T.v, f = on(v.pc);
    assert.ok(CP05.exhibits(T.sim, v), s + " exhibits");
    assert.match(out(T, [f("tracert 8.8.8.8")]), /reports: Destination net unreachable\./);
    assert.match(out(T, [f("ping " + v.plan.srv.fsrv.ip)]), /Reply from .*bytes=/, s + " inside works");
    const d = out(T, [f("ssh " + v.plan.user + "@" + v.plan.sw.dist1.ip), f(v.plan.userPw), f("enable"), f(v.plan.secret), f("show ip route"), f("show ip ospf neighbor"), f("exit")]);
    assert.match(d, /Gateway of last resort is not set/); assert.equal((d.match(/FULL/g) || []).length, 2, s + " both cores FULL");
    const o = out(T, [f("ssh " + v.plan.user + "@" + v.edgeIp), f(v.plan.userPw), f("enable"), f(v.plan.secret), f("show ip route"), f("show running-config"), f("exit")]);
    if (v.kind === "originate") { assert.match(o, /Gateway of last resort is \S+ to network 0\.0\.0\.0/); assert.ok(!/default-information originate/.test(o)); }
    else { assert.match(o, /Gateway of last resort is not set/); assert.match(o, new RegExp("interface " + v.wan + "\\s+ip address " + v.wanIp.replace(/\./g, "\\."))); assert.match(o, /default-information originate/); }
    assert.equal(T.fixed, false);
    for (const id of ["unreach", "d1route", "d1nbr", "edgeroute", "edgerun"]) assert.ok(T.evidence.some((e) => e.id === id), s + " the notebook took " + id);
    assert.equal(T.opts.length, 6); assert.equal(T.opts.filter((o) => o.right).length, 1); assert.ok(T.opts.filter((o) => !o.right).every((o) => o.why && o.why.length > 30));
    assert.ok(T.opts.some((o) => !o.right && o.id === (v.kind === "originate" ? "wan" : "originate")), s + " the other cause is a near miss");
    const S = CP05.summary(v); assert.ok(S.cause.length > 80 && S.fix.length > 60);
  }
});

test("CP-05: the edge router put back as the records have it, saved, fixes it; a desk's ping to the internet proves it, and a right diagnosis solves it", () => {
  for (const s of seedsOf(CP05)) {
    const T = E.open(CP05, s), v = T.v;
    for (const a of proof5(T)) E.act(T, a); assert.equal(T.proven, false);
    for (const a of fix5(T)) E.act(T, a);
    assert.equal(T.fixed, true, s + " fixed");
    E.act(T, on(v.pc)("ping " + v.edgeIp)); assert.equal(T.proven, false, s + " a ping to the edge router isn't the proof");
    for (const a of proof5(T)) E.act(T, a); assert.equal(T.proven, true);
    E.guess(T, T.opts.find((o) => o.right).id); assert.equal(T.solved, true);
  }
});

test("CP-05: the tempting wrong fixes don't: a default typed on the edge router or on distribution switch 1, the other variant's fix, the fix unsaved", () => {
  for (const s of seedsOf(CP05)) {
    const open = () => E.open(CP05, s);
    let T = open(); const gw = T.sim.net.isp.gw; for (const a of onEdge(T, ["ip route 0.0.0.0 0.0.0.0 " + gw])) E.act(T, a);
    assert.equal(T.fixed, false, s + " a default typed on the edge router");
    if (T.v.kind === "wan") { for (const a of proof5(T)) E.act(T, a); assert.equal(T.proven, false); assert.match(T.partial || "", /typed into the edge router/); } else assert.ok(CP05.exhibits(T.sim, T.v), s + " typed on top of the one it has: still nothing announced");
    T = open(); const f = on(T.v.pc), nh = coreLinks(T.v.plan).find((l) => l.b === "dist1").ia;
    for (const a of [f("ssh " + T.v.plan.user + "@" + T.v.plan.sw.dist1.ip), f(T.v.plan.userPw), f("enable"), f(T.v.plan.secret), f("configure terminal"), f("ip route 0.0.0.0 0.0.0.0 " + nh), f("end"), f("exit")]) E.act(T, a);
    assert.equal(T.fixed, false, s + " a default on distribution switch 1"); assert.ok(!online(T.sim, T.v.pc), s + " the core has no way out either");
    T = open(); for (const a of onEdge(T, T.v.kind === "originate" ? ["interface " + T.v.wan, "ip address dhcp"] : ["router ospf 1", "default-information originate"])) E.act(T, a);
    assert.equal(T.fixed, false, s + " the other variant's fix"); assert.ok(CP05.exhibits(T.sim, T.v));
    T = open(); for (const a of onEdge(T, T.v.kind === "originate" ? ["router ospf 1", "default-information originate"] : ["interface " + T.v.wan, "ip address dhcp"], false)) E.act(T, a);
    assert.equal(T.fixed, false, s + " unsaved"); for (const a of proof5(T)) E.act(T, a); assert.match(T.partial || "", /hasn't saved it/);
  }
});

test("CP-05: the ladder climbs, and a saved ticket replays exactly", () => {
  const T = E.open(CP05, seedsOf(CP05)[0]), wrongs = T.opts.filter((o) => !o.right).map((o) => o.id);
  assert.equal(E.guess(T, wrongs[0]).rung, 0); assert.equal(E.guess(T, wrongs[1]).rung, 0); assert.equal(E.guess(T, wrongs[2]).rung, 1); assert.equal(E.guess(T, wrongs[3]).rung, 2);
  E.resetBoard(T); assert.equal(E.guess(T, wrongs[4]).rung, 3); assert.equal(E.live(T).length, 2); assert.ok(E.live(T).some((o) => o.right));
  const U = E.open(CP05, seedsOf(CP05, 1)[0]);
  for (const a of fix5(U).concat(proof5(U))) E.act(U, a);
  const R = E.restore(CP05, JSON.parse(JSON.stringify(E.save(U))));
  assert.equal(R.fixed, U.fixed); assert.deepEqual(R.evidence, U.evidence); assert.equal(R.proven, U.proven); assert.equal(JSON.stringify(R.sim.net), JSON.stringify(U.sim.net));
});

test("CP-05: the brief and every hint never name the right answer, a password, a VLAN number or the fix's command", () => {
  for (const s of seedsOf(CP05)) {
    const T = E.open(CP05, s), right = T.opts.find((o) => o.right).text.toLowerCase(), p = T.v.plan;
    const texts = [CP05.rung1(T.v, T.sim), CP05.rung2(T.v, T.sim), ...CP05.fixHints(T.v, T.sim), CP05.brief(T.v, T.sim).quote, CP05.mason].map((x) => x.toLowerCase());
    for (const x of texts) {
      assert.ok(x.indexOf(right) < 0, x);
      for (const bad of [p.secret, p.console, p.userPw, p.srv.pw].map((b) => b.toLowerCase())) assert.ok(x.indexOf(bad) < 0, "names a password: " + x);
      for (const n of Object.values(p.vlans).map((V) => String(V.id)).concat([String(p.train.id), String(p.annex.cls.id)])) assert.ok(!new RegExp("\\b" + n + "\\b").test(x), "names VLAN " + n + ": " + x);
      for (const bad of ["default-information", "ip address dhcp", "router ospf", "copy running-config"]) assert.ok(x.indexOf(bad) < 0, "names " + bad + ": " + x);
    }
    for (const x of [CP05.brief(T.v, T.sim).quote, CP05.mason].map((y) => y.toLowerCase())) for (const bad of ["originate", "dhcp", "default route"]) assert.ok(x.indexOf(bad) < 0, "the brief or Mason's opener names " + bad + ": " + x);
  }
});

/* ---------------------------------------------------------------- CP-06 */
const CP06 = CAMPUS_TICKETS.find((d) => d.id === "CP-06");
const onSw6 = (T, ip, lines, save) => { const v = T.v, f = on("sd1"); return [f("ssh " + v.plan.user + "@" + ip), f(v.plan.userPw), f("enable"), f(v.plan.secret), f("configure terminal")].concat(lines.map(f), [f("end")], save === false ? [] : [f("copy running-config startup-config"), f("")], [f("exit")]); };
const fix6 = (T) => onSw6(T, T.v.swIp, ["no spanning-tree vlan " + T.v.vid + " priority"]);
const proof6 = (T) => { const v = T.v, f = on("sd1"); return [f("ssh " + v.plan.user + "@" + v.plan.sw.dist1.ip), f(v.plan.userPw), f("enable"), f(v.plan.secret), f("show spanning-tree vlan " + v.vid), f("exit")]; };

test("CP-06: the fault shows in the commands: distribution switch 1 hearing a lower root, the access switch the root, its priority in its configuration; nobody offline", () => {
  for (const s of seedsOf(CP06)) {
    const T = E.open(CP06, s), v = T.v, f = on("sd1");
    assert.ok(CP06.exhibits(T.sim, v), s + " exhibits");
    const d = out(T, proof6(T)); assert.match(d, new RegExp("Root ID\\s+Priority\\s+" + (v.prio + v.vid) + "\\b")); assert.ok(!/This bridge is the root/.test(d), s + " switch 1 not root");
    assert.equal(T.proven, false, s + " the show before the fix proves nothing");
    const a = out(T, [f("ssh " + v.plan.user + "@" + v.swIp), f(v.plan.userPw), f("enable"), f(v.plan.secret), f("show spanning-tree vlan " + v.vid), f("show running-config"), f("exit")]);
    assert.match(a, /This bridge is the root/); assert.match(a, new RegExp("spanning-tree vlan " + v.vid + " priority " + v.prio + "\\b"));
    assert.equal(T.fixed, false);
    for (const id of ["d1", "acc", "run"]) assert.ok(T.evidence.some((e) => e.id === id), s + " the notebook took " + id);
    assert.equal(T.opts.length, 6); assert.equal(T.opts.filter((o) => o.right).length, 1); assert.ok(T.opts.filter((o) => !o.right).every((o) => o.why && o.why.length > 30));
    const S = CP06.summary(v); assert.ok(S.cause.length > 80 && S.fix.length > 60);
  }
});

test("CP-06: the access switch back at the default, saved, fixes it; show spanning-tree on distribution switch 1 proves it, and a right diagnosis solves it", () => {
  for (const s of seedsOf(CP06)) {
    const T = E.open(CP06, s);
    for (const a of fix6(T)) E.act(T, a); assert.equal(T.fixed, true, s + " fixed");
    for (const a of proof6(T)) E.act(T, a); assert.equal(T.proven, true, s + " proven");
    E.guess(T, T.opts.find((o) => o.right).id); assert.equal(T.solved, true);
  }
  const T = E.open(CP06, seedsOf(CP06)[0]); for (const a of onSw6(T, T.v.swIp, ["spanning-tree vlan " + T.v.vid + " priority 32768"])) E.act(T, a); assert.equal(T.fixed, true, "the default typed in full counts too");
});

test("CP-06: the tempting wrong fixes don't: distribution switch 1 lowered further, the access switch only raised above switch 1, the fix unsaved, another VLAN's priority taken off", () => {
  for (const s of seedsOf(CP06, 2)) {
    const open = () => E.open(CP06, s);
    let T = open(); for (const a of onSw6(T, T.v.plan.sw.dist1.ip, ["spanning-tree vlan " + T.v.vid + " priority 0"])) E.act(T, a);
    if (T.v.prio > 0) { assert.equal(T.fixed, false, s + " switch 1 lowered to 0"); for (const a of proof6(T)) E.act(T, a); assert.equal(T.proven, false); assert.match(T.partial || "", /changing the distribution switches' priorities/); }
    T = open(); for (const a of onSw6(T, T.v.swIp, ["spanning-tree vlan " + T.v.vid + " priority 28672"])) E.act(T, a);
    assert.equal(T.fixed, false, s + " raised above switch 1 but not to the default"); for (const a of proof6(T)) E.act(T, a); assert.match(T.partial || "", /isn't at the default priority/);
    T = open(); for (const a of onSw6(T, T.v.swIp, ["no spanning-tree vlan " + T.v.vid + " priority"], false)) E.act(T, a);
    assert.equal(T.fixed, false, s + " unsaved"); for (const a of proof6(T)) E.act(T, a); assert.match(T.partial || "", /hasn't saved it/);
    T = open(); const other = [T.v.plan.vlans.svc.id, T.v.plan.vlans.bench.id].find((x) => x !== T.v.vid); for (const a of onSw6(T, T.v.swIp, ["no spanning-tree vlan " + other + " priority"])) E.act(T, a);
    assert.equal(T.fixed, false, s + " another VLAN's"); assert.ok(CP06.exhibits(T.sim, T.v));
  }
});

test("CP-06: the ladder climbs, and a saved ticket replays exactly", () => {
  const T = E.open(CP06, seedsOf(CP06)[0]), wrongs = T.opts.filter((o) => !o.right).map((o) => o.id);
  assert.equal(E.guess(T, wrongs[0]).rung, 0); assert.equal(E.guess(T, wrongs[1]).rung, 0); assert.equal(E.guess(T, wrongs[2]).rung, 1); assert.equal(E.guess(T, wrongs[3]).rung, 2);
  E.resetBoard(T); assert.equal(E.guess(T, wrongs[4]).rung, 3); assert.equal(E.live(T).length, 2); assert.ok(E.live(T).some((o) => o.right));
  const U = E.open(CP06, seedsOf(CP06, 1)[0]);
  for (const a of fix6(U).concat(proof6(U))) E.act(U, a);
  const R = E.restore(CP06, JSON.parse(JSON.stringify(E.save(U))));
  assert.equal(R.fixed, U.fixed); assert.deepEqual(R.evidence, U.evidence); assert.equal(R.proven, U.proven); assert.equal(JSON.stringify(R.sim.net), JSON.stringify(U.sim.net));
});

test("CP-06: the brief and every hint never name the right answer, a password, a VLAN number or the fix's command", () => {
  for (const s of seedsOf(CP06)) {
    const T = E.open(CP06, s), right = T.opts.find((o) => o.right).text.toLowerCase(), p = T.v.plan;
    const texts = [CP06.rung1(T.v, T.sim), CP06.rung2(T.v, T.sim), ...CP06.fixHints(T.v, T.sim), CP06.brief(T.v, T.sim).quote, CP06.mason].map((x) => x.toLowerCase());
    for (const x of texts) {
      assert.ok(x.indexOf(right) < 0, x);
      for (const bad of [p.secret, p.console, p.userPw, p.srv.pw].map((b) => b.toLowerCase())) assert.ok(x.indexOf(bad) < 0, "names a password: " + x);
      for (const n of Object.values(p.vlans).map((V) => String(V.id)).concat([String(p.train.id), String(p.annex.cls.id)])) assert.ok(!new RegExp("\\b" + n + "\\b").test(x), "names VLAN " + n + ": " + x);
      for (const bad of ["spanning-tree vlan", "copy running-config", String(T.v.prio) === "0" ? "priority 0" : String(T.v.prio)]) assert.ok(x.indexOf(bad) < 0, "names " + bad + ": " + x);
    }
    for (const x of [CP06.brief(T.v, T.sim).quote, CP06.mason].map((y) => y.toLowerCase())) assert.ok(x.indexOf("priority") < 0, "the brief or Mason's opener names the priority: " + x);
  }
});

/* ---------------------------------------------------------------- CP-07 */
const CP07 = CAMPUS_TICKETS.find((d) => d.id === "CP-07");
const onDx = (T, which, lines, save) => { const v = T.v, f = on("sd1"); return [f("ssh " + v.plan.user + "@" + v.plan.sw[which].ip), f(v.plan.userPw), f("enable"), f(v.plan.secret), f("configure terminal")].concat(lines.map(f), [f("end")], save === false ? [] : [f("copy running-config startup-config"), f("")], [f("exit")]); };
const ends7 = (T) => (T.v.kind === "passive" ? ["dist1", "dist2"] : [T.v.side]);
const fix7 = (T) => ends7(T).flatMap((d) => onDx(T, d, ["interface range gi0/21 - 22", "channel-group 1 mode active"]));
const proof7 = (T) => { const v = T.v, f = on("sd1"); return [f("ssh " + v.plan.user + "@" + v.plan.sw.dist1.ip), f(v.plan.userPw), f("enable"), f(v.plan.secret), f("show etherchannel summary"), f("exit")]; };

test("CP-07: the fault shows in the commands: the bundle not formed at one end or both, the links standing alone and connected, the channel-group lines changed; nobody offline", () => {
  for (const s of seedsOf(CP07)) {
    const T = E.open(CP07, s), v = T.v, f = on("sd1");
    assert.ok(CP07.exhibits(T.sim, v), s + " exhibits");
    const sum = {}; for (const d of ["dist1", "dist2"]) sum[d] = out(T, [f("ssh " + v.plan.user + "@" + v.plan.sw[d].ip), f(v.plan.userPw), f("enable"), f(v.plan.secret), f("show etherchannel summary"), f("show interfaces status"), f("show running-config"), f("exit")]);
    if (v.kind === "passive") for (const d of ["dist1", "dist2"]) { assert.match(sum[d], /Po1\(SD\)\s+LACP\s+Gi0\/21\(I\)\s+Gi0\/22\(I\)/, s + " " + d); assert.match(sum[d], /channel-group 1 mode passive/); }
    else { const other = v.side === "dist1" ? "dist2" : "dist1"; assert.match(sum[v.side], /Po1\(SU\)\s+-\s+Gi0\/21\(P\)\s+Gi0\/22\(P\)/); assert.match(sum[v.side], /channel-group 1 mode on/); assert.match(sum[other], /Po1\(SD\)\s+LACP\s+Gi0\/21\(I\)\s+Gi0\/22\(I\)/); }
    for (const d of ["dist1", "dist2"]) { assert.match(sum[d], /^Gi0\/21\s.*connected/m); assert.match(sum[d], /^Gi0\/22\s.*connected/m); }
    assert.equal(T.fixed, false); assert.equal(T.proven, false);
    for (const id of ["ec", "run", "stat"]) assert.ok(T.evidence.some((e) => e.id === id), s + " the notebook took " + id);
    assert.equal(T.opts.length, 6); assert.equal(T.opts.filter((o) => o.right).length, 1); assert.ok(T.opts.filter((o) => !o.right).every((o) => o.why && o.why.length > 30));
    assert.ok(T.opts.some((o) => !o.right && o.id === (v.kind === "passive" ? "on" : "passive")), s + " the other cause is a near miss");
    const S = CP07.summary(v); assert.ok(S.cause.length > 80 && S.fix.length > 60);
  }
});

test("CP-07: the changed ends back to active, saved, fix it; show etherchannel summary proves it, and a right diagnosis solves it", () => {
  for (const s of seedsOf(CP07)) {
    const T = E.open(CP07, s);
    for (const a of fix7(T)) E.act(T, a); assert.equal(T.fixed, true, s + " fixed");
    for (const a of proof7(T)) E.act(T, a); assert.equal(T.proven, true, s + " proven");
    E.guess(T, T.opts.find((o) => o.right).id); assert.equal(T.solved, true);
  }
});

test("CP-07: the tempting wrong fixes don't: one end only (passive), both ends forced on, the forced end only set to passive, the fix unsaved, a link bounced", () => {
  for (const s of seedsOf(CP07)) {
    const open = () => E.open(CP07, s);
    let T = open();
    if (T.v.kind === "passive") { for (const a of onDx(T, "dist1", ["interface range gi0/21 - 22", "channel-group 1 mode active"])) E.act(T, a); assert.equal(T.fixed, false, s + " one end only"); for (const a of proof7(T)) E.act(T, a); assert.equal(T.proven, false); assert.match(T.partial || "", /One end still only waits/); }
    else { for (const a of onDx(T, T.v.side, ["interface range gi0/21 - 22", "channel-group 1 mode passive"])) E.act(T, a); assert.equal(T.fixed, false, s + " the forced end set to passive"); for (const a of proof7(T)) E.act(T, a); assert.match(T.partial || "", /One end still only waits/); }
    T = open(); for (const d of ["dist1", "dist2"]) for (const a of onDx(T, d, ["interface range gi0/21 - 22", "channel-group 1 mode on"])) E.act(T, a);
    assert.equal(T.fixed, false, s + " both forced on");
    T = open(); for (const a of ends7(T).flatMap((d) => onDx(T, d, ["interface range gi0/21 - 22", "channel-group 1 mode active"], false))) E.act(T, a);
    assert.equal(T.fixed, false, s + " unsaved"); for (const a of proof7(T)) E.act(T, a); assert.match(T.partial || "", /hasn't saved its change/);
    T = open(); for (const a of onDx(T, "dist1", ["interface gi0/22", "shutdown", "no shutdown"])) E.act(T, a);
    assert.equal(T.fixed, false, s + " a link bounced"); assert.ok(CP07.exhibits(T.sim, T.v));
  }
});

test("CP-07: the ladder climbs, and a saved ticket replays exactly", () => {
  const T = E.open(CP07, seedsOf(CP07)[0]), wrongs = T.opts.filter((o) => !o.right).map((o) => o.id);
  assert.equal(E.guess(T, wrongs[0]).rung, 0); assert.equal(E.guess(T, wrongs[1]).rung, 0); assert.equal(E.guess(T, wrongs[2]).rung, 1); assert.equal(E.guess(T, wrongs[3]).rung, 2);
  E.resetBoard(T); assert.equal(E.guess(T, wrongs[4]).rung, 3); assert.equal(E.live(T).length, 2); assert.ok(E.live(T).some((o) => o.right));
  const U = E.open(CP07, seedsOf(CP07, 1)[0]);
  for (const a of fix7(U).concat(proof7(U))) E.act(U, a);
  const R = E.restore(CP07, JSON.parse(JSON.stringify(E.save(U))));
  assert.equal(R.fixed, U.fixed); assert.deepEqual(R.evidence, U.evidence); assert.equal(R.proven, U.proven); assert.equal(JSON.stringify(R.sim.net), JSON.stringify(U.sim.net));
});

test("CP-07: the brief and every hint never name the right answer, a password or the fix's command", () => {
  for (const s of seedsOf(CP07)) {
    const T = E.open(CP07, s), right = T.opts.find((o) => o.right).text.toLowerCase(), p = T.v.plan;
    const texts = [CP07.rung1(T.v, T.sim), CP07.rung2(T.v, T.sim), ...CP07.fixHints(T.v, T.sim), CP07.brief(T.v, T.sim).quote, CP07.mason].map((x) => x.toLowerCase());
    for (const x of texts) {
      assert.ok(x.indexOf(right) < 0, x);
      for (const bad of [p.secret, p.console, p.userPw, p.srv.pw].map((b) => b.toLowerCase())) assert.ok(x.indexOf(bad) < 0, "names a password: " + x);
      for (const bad of ["channel-group", "mode active", "mode passive", "mode on", "copy running-config"]) assert.ok(x.indexOf(bad) < 0, "names " + bad + ": " + x);
    }
    for (const x of [CP07.brief(T.v, T.sim).quote, CP07.mason].map((y) => y.toLowerCase())) for (const bad of ["passive", "lacp", "forced"]) assert.ok(x.indexOf(bad) < 0, "the brief or Mason's opener names " + bad + ": " + x);
  }
});

/* ---------------------------------------------------------------- CP-08 */
const CP08 = CAMPUS_TICKETS.find((d) => d.id === "CP-08");
const line8 = (T) => (T.v.kind === "vlan" ? "switchport trunk allowed vlan add " + T.v.drop : "switchport trunk native vlan " + T.v.plan.vlans.native.id);
const fix8 = (T) => onDx(T, T.v.side, ["interface " + T.v.short.toLowerCase(), line8(T)]);
const proof8 = (T) => { const v = T.v, f = on("sd1"); return [f("ssh " + v.plan.user + "@" + v.plan.sw[v.side].ip), f(v.plan.userPw), f("enable"), f(v.plan.secret), f("show etherchannel summary"), f("exit")]; };

test("CP-08: the fault shows in the commands: one link suspended, the bundle up on the other, both connected, the link's trunk line differing from the port-channel's; nobody offline", () => {
  for (const s of seedsOf(CP08)) {
    const T = E.open(CP08, s), v = T.v, f = on("sd1");
    assert.ok(CP08.exhibits(T.sim, v), s + " exhibits");
    const o = out(T, [f("ssh " + v.plan.user + "@" + v.plan.sw[v.side].ip), f(v.plan.userPw), f("enable"), f(v.plan.secret), f("show etherchannel summary"), f("show interfaces status"), f("show running-config"), f("exit")]);
    assert.match(o, new RegExp("Po1\\(SU\\)\\s+LACP\\s+.*" + v.short.replace("/", "\\/") + "\\(s\\)"), s + " the link suspended");
    const blk = (o.split("interface " + v.port + "\n")[1] || "").split("!")[0];
    assert.ok(v.kind === "vlan" ? blk.indexOf("allowed vlan") >= 0 && !new RegExp("\\b" + v.drop + "\\b").test(blk.match(/allowed vlan (\S+)/)[1]) : !/native vlan/.test(blk), s + " its trunk line differs: " + blk);
    assert.equal(T.fixed, false); assert.equal(T.proven, false);
    for (const id of ["ec", "run", "stat"]) assert.ok(T.evidence.some((e) => e.id === id), s + " the notebook took " + id);
    assert.equal(T.opts.length, 6); assert.equal(T.opts.filter((o) => o.right).length, 1); assert.ok(T.opts.filter((o) => !o.right).every((o) => o.why && o.why.length > 30));
    assert.ok(T.opts.some((o) => !o.right && o.id === (v.kind === "vlan" ? "native" : "vlan")), s + " the other cause is a near miss");
    const S = CP08.summary(v); assert.ok(S.cause.length > 80 && S.fix.length > 60);
  }
});

test("CP-08: the link made to match the port-channel, saved, fixes it; show etherchannel summary proves it, and a right diagnosis solves it", () => {
  for (const s of seedsOf(CP08)) {
    const T = E.open(CP08, s);
    for (const a of fix8(T)) E.act(T, a); assert.equal(T.fixed, true, s + " fixed");
    for (const a of proof8(T)) E.act(T, a); assert.equal(T.proven, true, s + " proven");
    E.guess(T, T.opts.find((o) => o.right).id); assert.equal(T.solved, true);
  }
});

test("CP-08: the tempting wrong fixes don't: the port-channel changed to match the link, the link bounced, the link taken out of the bundle, the fix unsaved", () => {
  for (const s of seedsOf(CP08)) {
    const open = () => E.open(CP08, s);
    let T = open(); for (const a of onDx(T, T.v.side, ["interface port-channel 1", T.v.kind === "vlan" ? "switchport trunk allowed vlan remove " + T.v.drop : "no switchport trunk native vlan"])) E.act(T, a);
    assert.equal(T.fixed, false, s + " the port-channel matched to the link");
    T = open(); for (const a of onDx(T, T.v.side, ["interface " + T.v.short.toLowerCase(), "shutdown", "no shutdown"])) E.act(T, a);
    assert.equal(T.fixed, false, s + " the link bounced"); assert.ok(CP08.exhibits(T.sim, T.v));
    T = open(); for (const a of onDx(T, T.v.side, ["interface " + T.v.short.toLowerCase(), "no channel-group"])) E.act(T, a);
    assert.equal(T.fixed, false, s + " the link out of the bundle");
    T = open(); for (const a of onDx(T, T.v.side, ["interface " + T.v.short.toLowerCase(), line8(T)], false)) E.act(T, a);
    assert.equal(T.fixed, false, s + " unsaved"); for (const a of proof8(T)) E.act(T, a); assert.match(T.partial || "", /hasn't saved it/);
  }
});

test("CP-08: the ladder climbs, and a saved ticket replays exactly", () => {
  const T = E.open(CP08, seedsOf(CP08)[0]), wrongs = T.opts.filter((o) => !o.right).map((o) => o.id);
  assert.equal(E.guess(T, wrongs[0]).rung, 0); assert.equal(E.guess(T, wrongs[1]).rung, 0); assert.equal(E.guess(T, wrongs[2]).rung, 1); assert.equal(E.guess(T, wrongs[3]).rung, 2);
  E.resetBoard(T); assert.equal(E.guess(T, wrongs[4]).rung, 3); assert.equal(E.live(T).length, 2); assert.ok(E.live(T).some((o) => o.right));
  const U = E.open(CP08, seedsOf(CP08, 1)[0]);
  for (const a of fix8(U).concat(proof8(U))) E.act(U, a);
  const R = E.restore(CP08, JSON.parse(JSON.stringify(E.save(U))));
  assert.equal(R.fixed, U.fixed); assert.deepEqual(R.evidence, U.evidence); assert.equal(R.proven, U.proven); assert.equal(JSON.stringify(R.sim.net), JSON.stringify(U.sim.net));
});

test("CP-08: the brief and every hint never name the right answer, a password, a VLAN number, the link or the fix's command", () => {
  for (const s of seedsOf(CP08)) {
    const T = E.open(CP08, s), right = T.opts.find((o) => o.right).text.toLowerCase(), p = T.v.plan;
    const texts = [CP08.rung1(T.v, T.sim), CP08.rung2(T.v, T.sim), ...CP08.fixHints(T.v, T.sim), CP08.brief(T.v, T.sim).quote, CP08.mason].map((x) => x.toLowerCase());
    for (const x of texts) {
      assert.ok(x.indexOf(right) < 0, x);
      for (const bad of [p.secret, p.console, p.userPw, p.srv.pw].map((b) => b.toLowerCase())) assert.ok(x.indexOf(bad) < 0, "names a password: " + x);
      for (const n of Object.values(p.vlans).map((V) => String(V.id)).concat([String(p.train.id), String(p.annex.cls.id), String(p.backup.id)])) assert.ok(!new RegExp("\\b" + n + "\\b").test(x), "names VLAN " + n + ": " + x);
      for (const bad of ["switchport", "copy running-config", T.v.short.toLowerCase()]) assert.ok(x.indexOf(bad) < 0, "names " + bad + ": " + x);
    }
    for (const x of [CP08.brief(T.v, T.sim).quote, CP08.mason].map((y) => y.toLowerCase())) for (const bad of ["native", "allowed", "suspend"]) assert.ok(x.indexOf(bad) < 0, "the brief or Mason's opener names " + bad + ": " + x);
  }
});

/* ---------------------------------------------------------------- CP-09 */
const CP09 = CAMPUS_TICKETS.find((d) => d.id === "CP-09");
const fix9 = (T) => onDx(T, "dist1", T.v.kind === "mtu" ? ["interface " + T.v.short.toLowerCase(), "no ip mtu"] : ["router ospf 1", "no router-id"]);
const proof9 = (T) => { const v = T.v, f = on("sd1"); return [f("ssh " + v.plan.user + "@" + v.plan.sw.dist1.ip), f(v.plan.userPw), f("enable"), f(v.plan.secret), f("show ip ospf neighbor"), f("exit")]; };

test("CP-09: the fault shows in the commands: one core switch not FULL on distribution switch 1 (EXSTART, or missing), the added line in its configuration; nobody offline", () => {
  for (const s of seedsOf(CP09)) {
    const T = E.open(CP09, s), v = T.v, f = on("sd1");
    assert.ok(CP09.exhibits(T.sim, v), s + " exhibits");
    const o = out(T, [f("ssh " + v.plan.user + "@" + v.plan.sw.dist1.ip), f(v.plan.userPw), f("enable"), f(v.plan.secret), f("show ip ospf neighbor"), f("show ip protocols"), f("show running-config"), f("exit")]);
    if (v.kind === "mtu") { assert.match(o, new RegExp("EXSTART\\S*\\s+\\S+\\s+\\S+\\s+" + v.port)); assert.match(o, new RegExp("ip mtu " + v.mtu)); }
    else { assert.equal((o.match(/FULL/g) || []).length, 1, s + " one FULL"); assert.match(o, new RegExp("Router ID " + v.coreRid.replace(/\./g, "\\."))); }
    assert.equal(T.fixed, false); assert.equal(T.proven, false);
    for (const id of ["nbr", "run", "proto"]) assert.ok(T.evidence.some((e) => e.id === id), s + " the notebook took " + id);
    assert.equal(T.opts.length, 6); assert.equal(T.opts.filter((o) => o.right).length, 1); assert.ok(T.opts.filter((o) => !o.right).every((o) => o.why && o.why.length > 30));
    assert.ok(T.opts.some((o) => !o.right && o.id === (v.kind === "mtu" ? "rid" : "mtu")), s + " the other cause is a near miss");
    const S = CP09.summary(v); assert.ok(S.cause.length > 80 && S.fix.length > 60);
  }
});

test("CP-09: the contractor's line taken off, saved, fixes it; show ip ospf neighbor proves it, and a right diagnosis solves it", () => {
  for (const s of seedsOf(CP09)) {
    const T = E.open(CP09, s);
    for (const a of fix9(T)) E.act(T, a); assert.equal(T.fixed, true, s + " fixed");
    for (const a of proof9(T)) E.act(T, a); assert.equal(T.proven, true, s + " proven");
    E.guess(T, T.opts.find((o) => o.right).id); assert.equal(T.solved, true);
  }
});

test("CP-09: the tempting wrong fixes don't: the other uplink matched to it, a different router ID typed, the uplink bounced, the fix unsaved", () => {
  for (const s of seedsOf(CP09)) {
    const open = () => E.open(CP09, s);
    let T = open();
    if (T.v.kind === "mtu") { const other = T.v.port === "GigabitEthernet0/19" ? "gi0/20" : "gi0/19"; for (const a of onDx(T, "dist1", ["interface " + other, "ip mtu " + T.v.mtu])) E.act(T, a); assert.equal(T.fixed, false, s + " the other uplink lowered too"); }
    else { for (const a of onDx(T, "dist1", ["router ospf 1", "router-id 10.255.255.1"])) E.act(T, a); assert.equal(T.fixed, false, s + " another router ID typed"); for (const a of proof9(T)) E.act(T, a); assert.equal(T.proven, false); assert.match(T.partial || "", /isn't as the records have it/, s + " both FULL, and Mason says why it isn't the fix"); }
    T = open(); for (const a of onDx(T, "dist1", ["interface " + T.v.short.toLowerCase(), "shutdown", "no shutdown"])) E.act(T, a);
    assert.equal(T.fixed, false, s + " the uplink bounced"); assert.ok(CP09.exhibits(T.sim, T.v));
    T = open(); for (const a of onDx(T, "dist1", T.v.kind === "mtu" ? ["interface " + T.v.short.toLowerCase(), "no ip mtu"] : ["router ospf 1", "no router-id"], false)) E.act(T, a);
    assert.equal(T.fixed, false, s + " unsaved"); for (const a of proof9(T)) E.act(T, a); assert.match(T.partial || "", /hasn't saved it/);
  }
});

test("CP-09: the ladder climbs, and a saved ticket replays exactly", () => {
  const T = E.open(CP09, seedsOf(CP09)[0]), wrongs = T.opts.filter((o) => !o.right).map((o) => o.id);
  assert.equal(E.guess(T, wrongs[0]).rung, 0); assert.equal(E.guess(T, wrongs[1]).rung, 0); assert.equal(E.guess(T, wrongs[2]).rung, 1); assert.equal(E.guess(T, wrongs[3]).rung, 2);
  E.resetBoard(T); assert.equal(E.guess(T, wrongs[4]).rung, 3); assert.equal(E.live(T).length, 2); assert.ok(E.live(T).some((o) => o.right));
  const U = E.open(CP09, seedsOf(CP09, 1)[0]);
  for (const a of fix9(U).concat(proof9(U))) E.act(U, a);
  const R = E.restore(CP09, JSON.parse(JSON.stringify(E.save(U))));
  assert.equal(R.fixed, U.fixed); assert.deepEqual(R.evidence, U.evidence); assert.equal(R.proven, U.proven); assert.equal(JSON.stringify(R.sim.net), JSON.stringify(U.sim.net));
});

test("CP-09: the brief and every hint never name the right answer, a password or the fix's command", () => {
  for (const s of seedsOf(CP09)) {
    const T = E.open(CP09, s), right = T.opts.find((o) => o.right).text.toLowerCase(), p = T.v.plan;
    const texts = [CP09.rung1(T.v, T.sim), CP09.rung2(T.v, T.sim), ...CP09.fixHints(T.v, T.sim), CP09.brief(T.v, T.sim).quote, CP09.mason].map((x) => x.toLowerCase());
    for (const x of texts) {
      assert.ok(x.indexOf(right) < 0, x);
      for (const bad of [p.secret, p.console, p.userPw, p.srv.pw].map((b) => b.toLowerCase())) assert.ok(x.indexOf(bad) < 0, "names a password: " + x);
      for (const bad of ["ip mtu", "router-id", "copy running-config", T.v.coreRid]) assert.ok(x.indexOf(bad) < 0, "names " + bad + ": " + x);
    }
    for (const x of [CP09.brief(T.v, T.sim).quote, CP09.mason].map((y) => y.toLowerCase())) for (const bad of ["mtu", "router id"]) assert.ok(x.indexOf(bad) < 0, "the brief or Mason's opener names " + bad + ": " + x);
  }
});

/* ---------------------------------------------------------------- CP-10 */
const CP10 = CAMPUS_TICKETS.find((d) => d.id === "CP-10");
const onR = (T, which, lines, save) => { const v = T.v, f = on(v.other); return [f("ssh " + v.plan.user + "@" + v.plan.sw[which].ip), f(v.plan.userPw), f("enable"), f(v.plan.secret), f("configure terminal")].concat(lines.map(f), [f("end")], save === false ? [] : [f("copy running-config startup-config"), f("")], [f("exit")]); };
const relayLines = (T) => ["interface vlan " + T.v.vid].concat(T.v.to.length ? ["no ip helper-address " + T.v.to[0]] : [], ["ip helper-address " + T.v.srv]);
const fix10 = (T) => onR(T, "dist1", relayLines(T)).concat(onR(T, "dist2", relayLines(T)));
const proof10 = (T) => [on(T.v.pc)("ipconfig /renew"), on(T.v.pc)("ping 8.8.8.8")];

test("CP-10: the fault shows in the commands: the desk on 169.254, the other desk on the floor fine, both distribution switches relaying the floor elsewhere, the server's log with nothing from the floor", () => {
  for (const s of seedsOf(CP10)) {
    const T = E.open(CP10, s), v = T.v, f = on(v.pc), g = on(v.other);
    assert.ok(CP10.exhibits(T.sim, v), s + " exhibits");
    assert.match(out(T, [f("ipconfig /all")]), /Autoconfiguration IPv4 Address[ .]*: 169\.254\./); assert.match(out(T, [g("ipconfig")]), new RegExp("IPv4 Address[ .]*: " + v.vnet.replace(/\./g, "\\.")));
    for (const d of ["dist1", "dist2"]) { const o = out(T, [g("ssh " + v.plan.user + "@" + v.plan.sw[d].ip), g(v.plan.userPw), g("enable"), g(v.plan.secret), g("show running-config"), g("exit")]); const blk = (o.split("interface Vlan" + v.vid + "\n")[1] || "").split("!")[0]; assert.ok(blk.indexOf("ip helper-address " + v.srv) < 0 && (v.to.length ? blk.indexOf("ip helper-address " + v.to[0]) >= 0 : !/helper/.test(blk)), s + " " + d + ": " + blk); }
    const j = out(T, [g("ssh " + v.plan.srv.user + "@" + v.plan.srv.fsrv.ip), g(v.plan.srv.pw), g("journalctl -u isc-dhcp-server"), g("exit")]);
    assert.ok(j.indexOf("via " + v.vnet) < 0 || /DHCPACK on [\d.]+ to .* via/.test(j), s + " the log");
    assert.equal(T.fixed, false);
    for (const id of ["apipa", "other", "run"]) assert.ok(T.evidence.some((e) => e.id === id), s + " the notebook took " + id);
    assert.equal(T.opts.length, 6); assert.equal(T.opts.filter((o) => o.right).length, 1); assert.ok(T.opts.filter((o) => !o.right).every((o) => o.why && o.why.length > 30));
    const S = CP10.summary(v); assert.ok(S.cause.length > 80 && S.fix.length > 60);
  }
});

test("CP-10: both relays put right, saved, fix it once the desk asks again; its ping to the internet proves it, and a right diagnosis solves it", () => {
  for (const s of seedsOf(CP10)) {
    const T = E.open(CP10, s), v = T.v;
    for (const a of fix10(T)) E.act(T, a); assert.equal(T.fixed, false, s + " not until the desk asks again");
    for (const a of proof10(T)) E.act(T, a); assert.equal(T.fixed, true, s + " fixed"); for (const a of [on(v.pc)("ping 8.8.8.8")]) E.act(T, a); assert.equal(T.proven, true, s + " proven");
    assert.equal(T.sim.d[v.pc].ifaces[0].lease.server, v.srv);
    E.guess(T, T.opts.find((o) => o.right).id); assert.equal(T.solved, true);
  }
});

test("CP-10: the tempting wrong fixes don't: one switch only, the desk given an address by hand, the fix unsaved, the relay pointed at the edge router", () => {
  for (const s of seedsOf(CP10)) {
    const open = () => E.open(CP10, s);
    let T = open(); for (const a of onR(T, "dist1", relayLines(T)).concat(proof10(T))) E.act(T, a);
    assert.equal(T.fixed, false, s + " distribution switch 1 only"); assert.match(T.partial || "", /only one distribution switch relays/);
    T = open(); const a0 = T.v.vnet + "200"; E.act(T, { t: "client", dev: T.v.pc, values: { mode: "static", ip: a0, mask: T.v.plan.mask, gw: T.v.vnet + "1", dns: [T.v.plan.srv.fsrv.ip] } }); for (const a of [on(T.v.pc)("ping 8.8.8.8")]) E.act(T, a);
    assert.equal(T.fixed, false, s + " an address by hand");
    T = open(); for (const a of onR(T, "dist1", relayLines(T), false).concat(onR(T, "dist2", relayLines(T), false), proof10(T))) E.act(T, a);
    assert.equal(T.fixed, false, s + " unsaved"); assert.match(T.partial || "", /hasn't saved the change/);
    T = open(); const edge = coreLinks(T.v.plan)[0].ia; for (const a of onR(T, "dist1", ["interface vlan " + T.v.vid, "ip helper-address " + edge]).concat(onR(T, "dist2", ["interface vlan " + T.v.vid, "ip helper-address " + edge]), proof10(T))) E.act(T, a);
    assert.equal(T.fixed, false, s + " the edge router");
  }
});

test("CP-10: the ladder climbs, and a saved ticket replays exactly", () => {
  const T = E.open(CP10, seedsOf(CP10)[0]), wrongs = T.opts.filter((o) => !o.right).map((o) => o.id);
  assert.equal(E.guess(T, wrongs[0]).rung, 0); assert.equal(E.guess(T, wrongs[1]).rung, 0); assert.equal(E.guess(T, wrongs[2]).rung, 1); assert.equal(E.guess(T, wrongs[3]).rung, 2);
  E.resetBoard(T); assert.equal(E.guess(T, wrongs[4]).rung, 3); assert.equal(E.live(T).length, 2); assert.ok(E.live(T).some((o) => o.right));
  const U = E.open(CP10, seedsOf(CP10, 1)[0]);
  for (const a of fix10(U).concat(proof10(U))) E.act(U, a);
  const R = E.restore(CP10, JSON.parse(JSON.stringify(E.save(U))));
  assert.equal(R.fixed, U.fixed); assert.deepEqual(R.evidence, U.evidence); assert.equal(R.proven, U.proven); assert.equal(JSON.stringify(R.sim.net), JSON.stringify(U.sim.net));
});

test("CP-10: the brief and every hint never name the right answer, a password, a VLAN number, an address or the fix's command", () => {
  for (const s of seedsOf(CP10)) {
    const T = E.open(CP10, s), right = T.opts.find((o) => o.right).text.toLowerCase(), p = T.v.plan;
    const texts = [CP10.rung1(T.v, T.sim), CP10.rung2(T.v, T.sim), ...CP10.fixHints(T.v, T.sim), CP10.brief(T.v, T.sim).quote, CP10.mason].map((x) => x.toLowerCase());
    for (const x of texts) {
      assert.ok(x.indexOf(right) < 0, x);
      for (const bad of [p.secret, p.console, p.userPw, p.srv.pw].map((b) => b.toLowerCase())) assert.ok(x.indexOf(bad) < 0, "names a password: " + x);
      for (const n of Object.values(p.vlans).map((V) => String(V.id)).concat([String(p.train.id), String(p.annex.cls.id)])) assert.ok(!new RegExp("\\b" + n + "\\b").test(x), "names VLAN " + n + ": " + x);
      for (const bad of ["helper-address", "copy running-config", T.v.srv].concat(T.v.to)) assert.ok(x.indexOf(bad) < 0, "names " + bad + ": " + x);
    }
    for (const x of [CP10.brief(T.v, T.sim).quote, CP10.mason].map((y) => y.toLowerCase())) for (const bad of ["relay", "helper", "dhcp"]) assert.ok(x.indexOf(bad) < 0, "the brief or Mason's opener names " + bad + ": " + x);
  }
});

/* ---------------------------------------------------------------- CP-11 */
const CP11 = CAMPUS_TICKETS.find((d) => d.id === "CP-11");
const onA = (T, lines, save) => { const v = T.v, f = on(v.pc); return [f("ssh " + v.plan.user + "@" + v.swIp), f(v.plan.userPw), f("enable"), f(v.plan.secret), f("configure terminal")].concat(lines.map(f), [f("end")], save === false ? [] : [f("copy running-config startup-config"), f("")], [f("exit")]); };
const fix11 = (T) => onA(T, ["interface " + T.v.short.toLowerCase(), "ip address " + T.v.ip + " " + T.v.mask]);
const proof11 = (T) => [on(T.v.pc)("ping 8.8.8.8")];

test("CP-11: the fault shows in the commands: the classroom turned back at the Annex core, no neighbour, the fibre port up with the wrong address or mask, the ping across answering only when the block is right", () => {
  for (const s of seedsOf(CP11)) {
    const T = E.open(CP11, s), v = T.v, f = on(v.pc);
    assert.ok(CP11.exhibits(T.sim, v), s + " exhibits");
    assert.match(out(T, [f("tracert " + v.plan.srv.fsrv.ip)]), /reports: Destination net unreachable\./);
    const o = out(T, [f("ssh " + v.plan.user + "@" + v.swIp), f(v.plan.userPw), f("enable"), f(v.plan.secret), f("show ip ospf neighbor"), f("show ip interface brief"), f("ping " + v.peer), f("show running-config"), f("exit")]);
    assert.ok(!/FULL|EXSTART/.test(o), s + " no neighbour"); assert.match(o, new RegExp("^" + v.port + "\\s.*\\bup\\s+up", "m"));
    assert.match(o, v.kind === "mask" ? /Success rate is 100 percent/ : /Success rate is 0 percent/, s + " the ping across");
    assert.match(o, new RegExp("ip address " + (v.badIp || v.ip).replace(/\./g, "\\.") + " " + (v.badMask || v.mask).replace(/\./g, "\\.")));
    assert.equal(T.fixed, false);
    for (const id of ["unreach", "nbr", "run", "peer"]) assert.ok(T.evidence.some((e) => e.id === id), s + " the notebook took " + id);
    assert.equal(T.opts.length, 6); assert.equal(T.opts.filter((o) => o.right).length, 1); assert.ok(T.opts.filter((o) => !o.right).every((o) => o.why && o.why.length > 30));
    assert.ok(T.opts.some((o) => !o.right && o.id === (v.kind === "mask" ? "addr" : "mask")), s + " the other cause is a near miss");
    const S = CP11.summary(v); assert.ok(S.cause.length > 80 && S.fix.length > 60);
  }
});

test("CP-11: the Annex core's end put back as the records have it, saved, fixes it; a classroom PC's ping to the internet proves it, and a right diagnosis solves it", () => {
  for (const s of seedsOf(CP11)) {
    const T = E.open(CP11, s), v = T.v;
    for (const a of fix11(T)) E.act(T, a); assert.equal(T.fixed, true, s + " fixed");
    E.act(T, on(v.pc)("ping " + v.plan.annex.cls.gw)); assert.equal(T.proven, false, s + " a ping to the gateway isn't the proof");
    for (const a of proof11(T)) E.act(T, a); assert.equal(T.proven, true);
    E.guess(T, T.opts.find((o) => o.right).id); assert.equal(T.solved, true);
  }
});

test("CP-11: the tempting wrong fixes don't: half the fix (address or mask only), a static default on the Annex core, the port bounced, the fix unsaved", () => {
  for (const s of seedsOf(CP11)) {
    const open = () => E.open(CP11, s);
    let T = open(); const half = T.v.kind === "mask" ? T.v.ip + " 255.255.255.248" : T.v.badIp + " " + T.v.mask;
    if (T.v.kind === "mask" && T.v.badMask === "255.255.255.248") { for (const a of onA(T, ["interface " + T.v.short.toLowerCase(), "ip address " + T.v.ip + " 255.255.255.240"])) E.act(T, a); }
    else for (const a of onA(T, ["interface " + T.v.short.toLowerCase(), "ip address " + half])) E.act(T, a);
    assert.equal(T.fixed, false, s + " not the records' address and mask"); assert.ok(CP11.exhibits(T.sim, T.v));
    T = open(); for (const a of onA(T, ["ip route 0.0.0.0 0.0.0.0 " + T.v.peer])) E.act(T, a);
    assert.equal(T.fixed, false, s + " a static default"); assert.ok(!online(T.sim, T.v.pc), s + " no way back for the replies");
    T = open(); for (const a of onA(T, ["interface " + T.v.short.toLowerCase(), "shutdown", "no shutdown"])) E.act(T, a);
    assert.equal(T.fixed, false, s + " bounced");
    T = open(); for (const a of onA(T, ["interface " + T.v.short.toLowerCase(), "ip address " + T.v.ip + " " + T.v.mask], false).concat(proof11(T))) E.act(T, a);
    assert.equal(T.fixed, false, s + " unsaved"); assert.match(T.partial || "", /hasn't saved it/);
  }
});

test("CP-11: the ladder climbs, and a saved ticket replays exactly", () => {
  const T = E.open(CP11, seedsOf(CP11)[0]), wrongs = T.opts.filter((o) => !o.right).map((o) => o.id);
  assert.equal(E.guess(T, wrongs[0]).rung, 0); assert.equal(E.guess(T, wrongs[1]).rung, 0); assert.equal(E.guess(T, wrongs[2]).rung, 1); assert.equal(E.guess(T, wrongs[3]).rung, 2);
  E.resetBoard(T); assert.equal(E.guess(T, wrongs[4]).rung, 3); assert.equal(E.live(T).length, 2); assert.ok(E.live(T).some((o) => o.right));
  const U = E.open(CP11, seedsOf(CP11, 1)[0]);
  for (const a of fix11(U).concat(proof11(U))) E.act(U, a);
  const R = E.restore(CP11, JSON.parse(JSON.stringify(E.save(U))));
  assert.equal(R.fixed, U.fixed); assert.deepEqual(R.evidence, U.evidence); assert.equal(R.proven, U.proven); assert.equal(JSON.stringify(R.sim.net), JSON.stringify(U.sim.net));
});

test("CP-11: the brief and every hint never name the right answer, a password, an address, a mask or the fix's command", () => {
  for (const s of seedsOf(CP11)) {
    const T = E.open(CP11, s), right = T.opts.find((o) => o.right).text.toLowerCase(), p = T.v.plan;
    const texts = [CP11.rung1(T.v, T.sim), CP11.rung2(T.v, T.sim), ...CP11.fixHints(T.v, T.sim), CP11.brief(T.v, T.sim).quote, CP11.mason].map((x) => x.toLowerCase());
    for (const x of texts) {
      assert.ok(x.indexOf(right) < 0, x);
      for (const bad of [p.secret, p.console, p.userPw, p.srv.pw].map((b) => b.toLowerCase())) assert.ok(x.indexOf(bad) < 0, "names a password: " + x);
      for (const bad of ["ip address", "copy running-config", T.v.ip, T.v.peer, T.v.mask, T.v.badIp, T.v.badMask].filter(Boolean)) assert.ok(x.indexOf(bad) < 0, "names " + bad + ": " + x);
    }
    for (const x of [CP11.brief(T.v, T.sim).quote, CP11.mason].map((y) => y.toLowerCase())) assert.ok(x.indexOf("mask") < 0, "the brief or Mason's opener names the mask: " + x);
  }
});

/* ---------------------------------------------------------------- CP-12 */
const CP12 = CAMPUS_TICKETS.find((d) => d.id === "CP-12");
const onSrv = (T, lines) => { const f = (l, t) => ({ t: "cmd", dev: "mgr", line: l, text: t }), p = T.v.plan; return [f("ssh " + p.srv.user + "@" + p.srv.fsrv.ip), f(p.srv.pw)].concat(lines.map((l) => (Array.isArray(l) ? f(l[0], l[1]) : f(l))), [f("exit")]); };
const confNow = (T) => T.sim.d.fsrv.lx.files["/etc/dhcp/dhcpd.conf"].text;
const goodConf = (T) => confNow(T).replace(/  range [^\n]*\n  option [^\n]*\n\}\n*$/, "  range " + T.v.net + ".21 " + T.v.net + ".254;\n  option routers " + T.v.net + ".1;\n}\n");
const edit12 = (T, text, restart) => onSrv(T, ["sudo nano /etc/dhcp/dhcpd.conf", T.v.plan.srv.pw, ["^O", text], "^X"].concat(restart === false ? [] : ["sudo systemctl restart isc-dhcp-server"]));
const proof12 = (T) => [on(T.v.pc)("ipconfig /renew"), on(T.v.pc)("ping 8.8.8.8")];

test("CP-12: the fault shows in the commands: the desk on 169.254, the DHCP service failed, its log and dhcpd -t naming the contractor's line", () => {
  for (const s of seedsOf(CP12)) {
    const T = E.open(CP12, s), v = T.v;
    assert.ok(CP12.exhibits(T.sim, v), s + " exhibits");
    assert.match(out(T, [on(v.pc)("ipconfig /all")]), /Autoconfiguration IPv4 Address[ .]*: 169\.254\./);
    const o = out(T, onSrv(T, ["systemctl status isc-dhcp-server", "journalctl -u isc-dhcp-server -n 12", "dhcpd -t -cf /etc/dhcp/dhcpd.conf", "systemctl is-enabled isc-dhcp-server"]));
    assert.match(o, /Active: failed/); assert.match(o, /^enabled$/m);
    assert.match(o, { semicolon: /semicolon expected/, range: /not on net/, option: /no option named router in space dhcp/ }[v.kind], s + " the error names the line");
    assert.equal(T.fixed, false);
    for (const id of ["apipa", "status", "journal", "test"]) assert.ok(T.evidence.some((e) => e.id === id), s + " the notebook took " + id);
    assert.equal(T.opts.length, 6); assert.equal(T.opts.filter((o) => o.right).length, 1); assert.ok(T.opts.filter((o) => !o.right).every((o) => o.why && o.why.length > 30));
    const S = CP12.summary(v); assert.ok(S.cause.length > 80 && S.fix.length > 60);
  }
});

test("CP-12: the file put right as the change sheet has it, the service started, fixes it once the desk asks again; its ping to the internet proves it, and a right diagnosis solves it", () => {
  for (const s of seedsOf(CP12)) {
    const T = E.open(CP12, s), v = T.v;
    for (const a of edit12(T, goodConf(T))) E.act(T, a);
    assert.equal(T.sim.d.fsrv.lx.dhcpd.state, "active", s + " running"); assert.equal(T.fixed, false, s + " not until the desk asks again");
    for (const a of proof12(T)) E.act(T, a); assert.equal(T.fixed, true, s + " fixed"); E.act(T, on(v.pc)("ping 8.8.8.8")); assert.equal(T.proven, true);
    assert.equal(T.sim.d[v.pc].ifaces[0].lease.server, v.srv);
    E.guess(T, T.opts.find((o) => o.right).id); assert.equal(T.solved, true);
  }
});

test("CP-12: the tempting wrong fixes don't: a restart with the file as it is, the file put right but not restarted, the new block taken out, an address set by hand", () => {
  for (const s of seedsOf(CP12)) {
    const open = () => E.open(CP12, s);
    let T = open(); for (const a of onSrv(T, ["sudo systemctl restart isc-dhcp-server", T.v.plan.srv.pw]).concat(proof12(T))) E.act(T, a);
    assert.equal(T.fixed, false, s + " restarted as it is"); assert.equal(T.sim.d.fsrv.lx.dhcpd.state, "failed");
    T = open(); for (const a of edit12(T, goodConf(T), false).concat(proof12(T))) E.act(T, a);
    assert.equal(T.fixed, false, s + " written, not restarted"); assert.ok(!online(T.sim, T.v.pc));
    T = open(); const cut = confNow(T).replace(/\n# Meeting room[\s\S]*$/, "\n"); for (const a of edit12(T, cut).concat(proof12(T))) E.act(T, a);
    assert.equal(T.fixed, false, s + " the new block taken out"); assert.match(T.partial || "", /meeting-room network is gone/);
    /* the server put right, but the desk given a working address by hand instead of asking again */
    T = open(); const P = T.v.plan, V = { sd1: P.vlans.svc, bn2: P.vlans.bench, fin: P.vlans.office, tr2: P.train, cl2: P.annex.cls }[T.v.pc];
    for (const a of edit12(T, goodConf(T))) E.act(T, a);
    E.act(T, { t: "client", dev: T.v.pc, values: { mode: "static", ip: V.gw.replace(/\.1$/, ".19"), mask: P.mask, gw: V.gw, dns: T.sim.d.mgr.ifaces[0].lease.dns.slice() } }); E.act(T, on(T.v.pc)("ping 8.8.8.8"));
    assert.ok(online(T.sim, T.v.pc), s + " the address by hand works"); assert.equal(T.fixed, false, s + " an address by hand"); assert.match(T.partial || "", /set by hand/);
  }
});

test("CP-12: the ladder climbs, and a saved ticket replays exactly, the editor's writes included", () => {
  const T = E.open(CP12, seedsOf(CP12)[0]), wrongs = T.opts.filter((o) => !o.right).map((o) => o.id);
  assert.equal(E.guess(T, wrongs[0]).rung, 0); assert.equal(E.guess(T, wrongs[1]).rung, 0); assert.equal(E.guess(T, wrongs[2]).rung, 1); assert.equal(E.guess(T, wrongs[3]).rung, 2);
  E.resetBoard(T); assert.equal(E.guess(T, wrongs[4]).rung, 3); assert.equal(E.live(T).length, 2); assert.ok(E.live(T).some((o) => o.right));
  const U = E.open(CP12, seedsOf(CP12, 1)[0]);
  for (const a of edit12(U, goodConf(U)).concat(proof12(U))) E.act(U, a);
  const R = E.restore(CP12, JSON.parse(JSON.stringify(E.save(U))));
  assert.equal(R.fixed, U.fixed); assert.deepEqual(R.evidence, U.evidence); assert.equal(R.proven, U.proven); assert.equal(JSON.stringify(R.sim.net), JSON.stringify(U.sim.net));
});

test("CP-12: the brief and every hint never name the right answer, a password or the mistake", () => {
  for (const s of seedsOf(CP12)) {
    const T = E.open(CP12, s), right = T.opts.find((o) => o.right).text.toLowerCase(), p = T.v.plan;
    const texts = [CP12.rung1(T.v, T.sim), CP12.rung2(T.v, T.sim), ...CP12.fixHints(T.v, T.sim), CP12.brief(T.v, T.sim).quote, CP12.mason].map((x) => x.toLowerCase());
    for (const x of texts) {
      assert.ok(x.indexOf(right) < 0, x);
      for (const bad of [p.secret, p.console, p.userPw, p.srv.pw].map((b) => b.toLowerCase())) assert.ok(x.indexOf(bad) < 0, "names a password: " + x);
      for (const bad of ["semicolon", "option router ", "not on net", "systemctl restart"]) assert.ok(x.indexOf(bad) < 0, "names " + bad + ": " + x);
    }
  }
});

/* ---------------------------------------------------------------- CP-13 */
const CP13 = CAMPUS_TICKETS.find((d) => d.id === "CP-13");
const sshSrv = (T, which, lines) => { const f = (l) => ({ t: "cmd", dev: "mgr", line: l }), p = T.v.plan; return [f("ssh " + p.srv.user + "@" + p.srv[which].ip), f(p.srv.pw)].concat(lines.map(f), [f("exit")]); };
const sshSw = (T, id, lines) => { const f = (l) => ({ t: "cmd", dev: "mgr", line: l }), p = T.v.plan; return [f("ssh " + p.user + "@" + p.sw[id].ip), f(p.userPw), f("enable"), f(p.secret)].concat(lines.map(f), [f("exit")]); };
const fix13 = (T) => T.v.kind === "switch" ? sshSw(T, T.v.sw, ["configure terminal", "system mtu jumbo 9000", "end", "copy running-config startup-config", "", "reload", ""]) : sshSrv(T, T.v.srv, ["sudo netplan set ethernets.eno2.mtu=9000", T.v.plan.srv.pw, "sudo netplan apply"]);
const proof13 = (T) => sshSrv(T, "fsrv", ["ping -M do -s 8972 -c 3 " + T.v.bb]);

test("CP-13: the fault shows in the commands: a plain ping between the servers' backup addresses answered, the big one not, the piece at 1500 saying so; nobody offline", () => {
  for (const s of seedsOf(CP13)) {
    const T = E.open(CP13, s), v = T.v;
    assert.ok(CP13.exhibits(T.sim, v), s + " exhibits");
    const o = out(T, sshSrv(T, "fsrv", ["ping -c 2 " + v.bb, "ping -M do -s 8972 -c 2 " + v.bb]));
    assert.match(o, /2 packets transmitted, 2 received/); assert.match(o, /2 packets transmitted, 0 received|message too long/);
    if (v.kind === "switch") assert.match(out(T, sshSw(T, v.sw, ["show system mtu"])), /System Jumbo MTU size is 1500 bytes/);
    else assert.match(out(T, sshSrv(T, v.srv, ["ip link show eno2"])), /eno2: .*mtu 1500\b/);
    assert.equal(T.fixed, false); assert.equal(T.proven, false);
    for (const id of ["small", "big", "where"]) assert.ok(T.evidence.some((e) => e.id === id), s + " the notebook took " + id);
    assert.equal(T.opts.length, 6); assert.equal(T.opts.filter((o) => o.right).length, 1); assert.ok(T.opts.filter((o) => !o.right).every((o) => o.why && o.why.length > 30));
    assert.ok(T.opts.some((o) => !o.right && o.id === (v.kind === "switch" ? "server" : "switch")), s + " the other cause is a near miss");
    const S = CP13.summary(v); assert.ok(S.cause.length > 80 && S.fix.length > 60);
  }
});

test("CP-13: the piece put back to jumbo frames where it lasts fixes it; the big ping between the servers proves it, and a right diagnosis solves it", () => {
  for (const s of seedsOf(CP13)) {
    const T = E.open(CP13, s);
    for (const a of fix13(T)) E.act(T, a); assert.equal(T.fixed, true, s + " fixed");
    for (const a of proof13(T)) E.act(T, a); assert.equal(T.proven, true, s + " proven");
    E.guess(T, T.opts.find((o) => o.right).id); assert.equal(T.solved, true);
  }
});

test("CP-13: the tempting wrong fixes don't: jumbo set but the switch not reloaded, the server's MTU set with ip link only, the other server lowered to match", () => {
  for (const s of seedsOf(CP13)) {
    const open = () => E.open(CP13, s);
    let T = open();
    if (T.v.kind === "switch") { for (const a of sshSw(T, T.v.sw, ["configure terminal", "system mtu jumbo 9000", "end", "copy running-config startup-config", ""]).concat(proof13(T))) E.act(T, a); assert.equal(T.fixed, false, s + " not reloaded"); assert.ok(CP13.exhibits(T.sim, T.v)); }
    else { for (const a of sshSrv(T, T.v.srv, ["sudo ip link set eno2 mtu 9000", T.v.plan.srv.pw]).concat(proof13(T))) E.act(T, a); assert.equal(T.fixed, false, s + " ip link only"); assert.match(T.partial || "", /isn't in its netplan file/); }
    T = open(); const other = T.v.kind === "server" ? (T.v.srv === "fsrv" ? "bksrv" : "fsrv") : "bksrv";
    for (const a of sshSrv(T, other, ["sudo netplan set ethernets.eno2.mtu=1500", T.v.plan.srv.pw, "sudo netplan apply"])) E.act(T, a);
    assert.equal(T.fixed, false, s + " the other server lowered to 1500");
  }
});

test("CP-13: the ladder climbs, and a saved ticket replays exactly", () => {
  const T = E.open(CP13, seedsOf(CP13)[0]), wrongs = T.opts.filter((o) => !o.right).map((o) => o.id);
  assert.equal(E.guess(T, wrongs[0]).rung, 0); assert.equal(E.guess(T, wrongs[1]).rung, 0); assert.equal(E.guess(T, wrongs[2]).rung, 1); assert.equal(E.guess(T, wrongs[3]).rung, 2);
  E.resetBoard(T); assert.equal(E.guess(T, wrongs[4]).rung, 3); assert.equal(E.live(T).length, 2); assert.ok(E.live(T).some((o) => o.right));
  const U = E.open(CP13, seedsOf(CP13, 1)[0]);
  for (const a of fix13(U).concat(proof13(U))) E.act(U, a);
  const R = E.restore(CP13, JSON.parse(JSON.stringify(E.save(U))));
  assert.equal(R.fixed, U.fixed); assert.deepEqual(R.evidence, U.evidence); assert.equal(R.proven, U.proven); assert.equal(JSON.stringify(R.sim.net), JSON.stringify(U.sim.net));
});

test("CP-13: the brief and every hint never name the right answer, a password or the fix's command", () => {
  for (const s of seedsOf(CP13)) {
    const T = E.open(CP13, s), right = T.opts.find((o) => o.right).text.toLowerCase(), p = T.v.plan;
    const texts = [CP13.rung1(T.v, T.sim), CP13.rung2(T.v, T.sim), ...CP13.fixHints(T.v, T.sim), CP13.brief(T.v, T.sim).quote, CP13.mason].map((x) => x.toLowerCase());
    for (const x of texts) {
      assert.ok(x.indexOf(right) < 0, x);
      for (const bad of [p.secret, p.console, p.userPw, p.srv.pw].map((b) => b.toLowerCase())) assert.ok(x.indexOf(bad) < 0, "names a password: " + x);
      for (const bad of ["system mtu jumbo", "netplan set", "ethernets.eno2"]) assert.ok(x.indexOf(bad) < 0, "names " + bad + ": " + x);
    }
    for (const x of [CP13.brief(T.v, T.sim).quote, CP13.mason].map((y) => y.toLowerCase())) for (const bad of ["mtu", "jumbo", "1500"]) assert.ok(x.indexOf(bad) < 0, "the brief or Mason's opener names " + bad + ": " + x);
  }
});

/* ---------------------------------------------------------------- CP-14 */
const CP14 = CAMPUS_TICKETS.find((d) => d.id === "CP-14");
const fix14 = (T) => [{ t: "sfp", dev: "anxc", slot: T.v.slot, type: "1000BASE-LX" }];
const proof14 = (T) => [on(T.v.pc)("ping 8.8.8.8")];

test("CP-14: the fault shows in the commands and on the module: the Annex core's fibre port notconnect with no light, or err-disabled and unsupported, the inventory naming the wrong module", () => {
  for (const s of seedsOf(CP14)) {
    const T = E.open(CP14, s), v = T.v, f = on(v.pc);
    assert.ok(CP14.exhibits(T.sim, v), s + " exhibits");
    const o = out(T, [f("ssh " + v.plan.user + "@" + v.swIp), f(v.plan.userPw), f("enable"), f(v.plan.secret), f("show interfaces status"), f("show interfaces transceiver"), f("show inventory"), f("exit")]);
    assert.match(o, new RegExp("^Gi0\\/25\\s.*" + (v.kind === "sx" ? "notconnect\\s+.*1000BaseSX" : "err-disabled\\s+.*10GBaseSR"), "m"));
    assert.match(o, v.kind === "sx" ? /-40\.0\s+\(no light received\)/ : /Unsupported transceiver/);
    assert.match(o, v.kind === "sx" ? /PID: SFP-1000BASE-SX/ : /PID: SFP-10G-SR/);
    E.act(T, { t: "look", cable: v.fibre, end: v.end });
    assert.equal(T.fixed, false);
    for (const id of ["stat", "inv", "look"]) assert.ok(T.evidence.some((e) => e.id === id), s + " the notebook took " + id);
    assert.equal(T.opts.length, 6); assert.equal(T.opts.filter((o) => o.right).length, 1); assert.ok(T.opts.filter((o) => !o.right).every((o) => o.why && o.why.length > 30));
    assert.ok(T.opts.some((o) => !o.right && o.id === (v.kind === "sx" ? "sfpplus" : "sx")), s + " the other cause is a near miss");
    const S = CP14.summary(v); assert.ok(S.cause.length > 80 && S.fix.length > 60);
  }
});

test("CP-14: a 1000BASE-LX from the van in the Annex core's slot fixes it; a classroom PC's ping to the internet proves it, and a right diagnosis solves it", () => {
  for (const s of seedsOf(CP14)) {
    const T = E.open(CP14, s), v = T.v;
    for (const a of proof14(T)) E.act(T, a); assert.equal(T.proven, false);
    for (const a of fix14(T)) E.act(T, a); assert.equal(T.fixed, true, s + " fixed");
    for (const a of proof14(T)) E.act(T, a); assert.equal(T.proven, true);
    E.guess(T, T.opts.find((o) => o.right).id); assert.equal(T.solved, true);
  }
});

test("CP-14: the tempting wrong fixes don't: the other wrong module, the strands swapped at the Annex end, the port bounced", () => {
  for (const s of seedsOf(CP14)) {
    const open = () => E.open(CP14, s);
    let T = open(); E.act(T, { t: "sfp", dev: "anxc", slot: T.v.slot, type: T.v.kind === "sx" ? "10GBASE-SR" : "1000BASE-SX" });
    assert.equal(T.fixed, false, s + " the other wrong module"); assert.ok(!online(T.sim, T.v.pc));
    T = open(); E.act(T, { t: "polarity", cable: T.v.fibre, end: T.v.end }); assert.equal(T.fixed, false, s + " the strands swapped");
    T = open(); for (const a of [on(T.v.pc)("ssh " + T.v.plan.user + "@" + T.v.swIp), on(T.v.pc)(T.v.plan.userPw), on(T.v.pc)("enable"), on(T.v.pc)(T.v.plan.secret), on(T.v.pc)("configure terminal"), on(T.v.pc)("interface gi0/25"), on(T.v.pc)("shutdown"), on(T.v.pc)("no shutdown"), on(T.v.pc)("end"), on(T.v.pc)("exit")]) E.act(T, a);
    assert.equal(T.fixed, false, s + " the port bounced"); assert.ok(CP14.exhibits(T.sim, T.v));
  }
});

test("CP-14: the ladder climbs, and a saved ticket replays exactly, the module swap included", () => {
  const T = E.open(CP14, seedsOf(CP14)[0]), wrongs = T.opts.filter((o) => !o.right).map((o) => o.id);
  assert.equal(E.guess(T, wrongs[0]).rung, 0); assert.equal(E.guess(T, wrongs[1]).rung, 0); assert.equal(E.guess(T, wrongs[2]).rung, 1); assert.equal(E.guess(T, wrongs[3]).rung, 2);
  E.resetBoard(T); assert.equal(E.guess(T, wrongs[4]).rung, 3); assert.equal(E.live(T).length, 2); assert.ok(E.live(T).some((o) => o.right));
  const U = E.open(CP14, seedsOf(CP14, 1)[0]);
  for (const a of fix14(U).concat(proof14(U))) E.act(U, a);
  const R = E.restore(CP14, JSON.parse(JSON.stringify(E.save(U))));
  assert.equal(R.fixed, U.fixed); assert.deepEqual(R.evidence, U.evidence); assert.equal(R.proven, U.proven); assert.equal(JSON.stringify(R.sim.net), JSON.stringify(U.sim.net));
});

test("CP-14: the brief and every hint never name the right answer, a password or the module to fit", () => {
  for (const s of seedsOf(CP14)) {
    const T = E.open(CP14, s), right = T.opts.find((o) => o.right).text.toLowerCase(), p = T.v.plan;
    const texts = [CP14.rung1(T.v, T.sim), CP14.rung2(T.v, T.sim), ...CP14.fixHints(T.v, T.sim), CP14.brief(T.v, T.sim).quote, CP14.mason].map((x) => x.toLowerCase());
    for (const x of texts) {
      assert.ok(x.indexOf(right) < 0, x);
      for (const bad of [p.secret, p.console, p.userPw, p.srv.pw].map((b) => b.toLowerCase())) assert.ok(x.indexOf(bad) < 0, "names a password: " + x);
      for (const bad of ["1000base-lx", "1000base-sx", "10gbase-sr", "sfp+", "multimode", "1310", "850"]) assert.ok(x.indexOf(bad) < 0, "names " + bad + ": " + x);
    }
  }
});

/* ---------------------------------------------------------------- CP-15 */
const CP15 = CAMPUS_TICKETS.find((d) => d.id === "CP-15");
/* from the manager's PC on the third floor (the bench is cut off): SSH to the 2F access switch, lines, out again */
const on15 = (T, lines, save) => { const f = on("mgr"); return ssh(T, "mgr", T.v.swIp).concat([f("configure terminal")], lines.map(f), [f("end")], save ? [f("copy running-config startup-config"), f("")] : [], [f("exit")]); };
const bounce15 = (T) => on15(T, T.v.ports.flatMap((n) => ["interface gi0/" + n, "shutdown", "no shutdown"]));
const proof15 = (T) => [on("bn1")("ping 8.8.8.8")];
const err15 = (T, n) => { const r = T.sim.d.acc2.sw.psRun["GigabitEthernet0/" + n]; return r && r.err ? r.why : null; };

test("CP-15: the fault shows in the commands: the bench port(s) err-disabled by BPDU guard, port security not the reason; the bench PC still holding its address, its gateway silent", () => {
  for (const s of seedsOf(CP15)) {
    const T = E.open(CP15, s), v = T.v, f = on("mgr");
    assert.ok(CP15.exhibits(T.sim, v), s + " exhibits");
    assert.deepEqual(v.ports, v.kind === "customer" ? ["1"] : ["1", "2"]);
    const ipc = out(T, [on("bn1")("ipconfig")]); assert.match(ipc, /IPv4 Address/, s + " the PC keeps its lease"); assert.doesNotMatch(ipc, /Media disconnected/, s + " its own link is up (to the switch on the bench)");
    assert.match(out(T, [on("bn1")("ping " + v.plan.vlans.bench.gw)]), /Request timed out|Destination host unreachable/);
    const o = out(T, ssh(T, "mgr", v.swIp).concat([f("show interfaces status"), f("show interfaces status err-disabled"), f("show port-security interface gi0/1"), f("exit")]));
    for (const n of v.ports) { assert.match(o, new RegExp("^Gi0/" + n + "\\s.*err-disabled", "m"), s + " err-disabled " + n); assert.match(o, new RegExp("^Gi0/" + n + "\\s+\\S+\\s+err-disabled\\s+bpduguard", "m"), s + " the reason " + n); }
    if (v.kind === "customer") { assert.match(o, /^Gi0\/2\s.*connected/m, s + " port 2 still up"); assert.ok(online(T.sim, "bn2")); }
    assert.match(o, /Port Status\s+: Secure-down/); assert.match(o, /Security Violation Count\s+: 0/);
    assert.equal(T.fixed, false);
    assert.ok(T.evidence.some((e) => e.id === "stat") && T.evidence.some((e) => e.id === "why"), s + " the notebook took the evidence");
    E.act(T, { t: "look", cable: v.runs[0], end: "b" }); assert.ok(T.evidence.some((e) => e.id === "look"), s + " looking at the bench cable is evidence");
  }
});

test("CP-15: the board is one right answer and five near misses, each with its reason; each variant's answer is the other's near miss", () => {
  const T = E.open(CP15, seedsOf(CP15)[0]);
  assert.equal(T.opts.length, 6); assert.equal(T.opts.filter((o) => o.right).length, 1);
  assert.ok(T.opts.filter((o) => !o.right).every((o) => o.why && o.why.length > 30));
  for (const s of seedsOf(CP15)) { const U = E.open(CP15, s), other = U.v.kind === "customer" ? "loop" : "customer"; assert.ok(U.opts.some((o) => o.id === other && !o.right), s); }
});

test("CP-15: the switch taken away, then each shut port shut and opened again, fixes it; a bench PC's ping to the internet proves it, and a right diagnosis solves it", () => {
  for (const s of seedsOf(CP15)) {
    const T = E.open(CP15, s), v = T.v;
    for (const a of proof15(T)) E.act(T, a); assert.equal(T.proven, false);
    E.act(T, { t: "unstray", dev: "dsw" }); assert.equal(T.fixed, false, s + " taken away, the port(s) still shut");
    assert.ok(v.ports.every((n) => err15(T, n) === "bpduguard"), s + " an err-disabled port waits to be shut and opened");
    for (const a of bounce15(T)) E.act(T, a); assert.equal(T.fixed, true, s + " fixed");
    assert.ok(T.sim.d.dsw.boxed && T.sim.cable("c-acc2-bn1").b.dev === "bn1" && !T.sim.cable("c-dsw-bn1"), s + " each run back in its PC, the lead gone");
    for (const a of proof15(T)) E.act(T, a); assert.equal(T.proven, true);
    E.guess(T, T.opts.find((o) => o.right).id); assert.equal(T.solved, true);
  }
});

test("CP-15: the tempting wrong fixes don't: the port bounced with the switch still there, BPDU guard taken off, one cable of the loop pulled, port security off too (it works, and Mason says so), the switch away but BPDU guard left off", () => {
  for (const s of seedsOf(CP15)) {
    const open = () => E.open(CP15, s);
    let T = open(); for (const a of bounce15(T)) E.act(T, a);
    /* bounced with it still there: the customer's switch sends its own BPDUs, so straight back down; the loop's ports bounced one at a
       time each come up while the other is still shut, so nothing comes back round, but both PCs' addresses do, and port security shuts
       each; bounced together (a range), each hears the other's BPDUs again */
    assert.equal(T.fixed, false); assert.ok(T.v.ports.every((n) => err15(T, n) === (T.v.kind === "customer" ? "bpduguard" : "psecure")), s + " bounced with it still there: straight back down");
    if (T.v.kind === "loop") { T = open(); for (const a of on15(T, ["interface range gi0/1 - 2", "shutdown", "no shutdown"])) E.act(T, a); assert.equal(T.fixed, false); assert.ok(["1", "2"].every((n) => err15(T, n) === "bpduguard"), s + " the loop's ports bounced together: BPDU guard again"); }
    T = open(); for (const a of on15(T, T.v.ports.flatMap((n) => ["interface gi0/" + n, "no spanning-tree bpduguard enable", "shutdown", "no shutdown"]))) E.act(T, a);
    assert.equal(T.fixed, false); assert.ok(T.v.ports.every((n) => err15(T, n) === "psecure"), s + " BPDU guard off: port security shuts it instead (a second address)");
    T = open(); for (const a of on15(T, T.v.ports.flatMap((n) => ["interface gi0/" + n, "spanning-tree bpduguard disable", "no port-security", "shutdown", "no shutdown"]).map((l) => l === "no port-security" ? "no switchport port-security" : l))) E.act(T, a);
    for (const a of proof15(T)) E.act(T, a);
    assert.equal(T.fixed, false); assert.equal(T.proven, false); assert.match(String(T.partial), /portfast and BPDU guard/, s + " it works with both protections off, and Mason says so");
    T = open(); E.act(T, { t: "unstray", dev: "dsw" }); for (const a of on15(T, T.v.ports.flatMap((n) => ["interface gi0/" + n, "no spanning-tree bpduguard enable", "shutdown", "no shutdown"]), true)) E.act(T, a);
    for (const a of proof15(T)) E.act(T, a);
    assert.equal(T.fixed, false); assert.equal(T.proven, false); assert.match(String(T.partial), /BPDU guard/, s + " away, but BPDU guard left off: Mason says so");
    if (T.v.kind === "loop") {
      T = open(); E.act(T, { t: "unplug", cable: "c-acc2-bn2", end: "b" }); for (const a of on15(T, ["interface gi0/1", "shutdown", "no shutdown"])) E.act(T, a);
      assert.equal(T.fixed, false); assert.equal(err15(T, "1"), "psecure", s + " one cable of the loop pulled: port 1 has both PCs behind it, and port security shuts it");
    }
  }
});

test("CP-15: BPDUs pass through an unmanaged switch: the loop variant's desk switch sends none of its own, and a single cable from it to a desk port trips nothing", () => {
  const s = seedsOf(CP15).find((x) => E.open(CP15, x).v.kind === "loop"), T = E.open(CP15, s);
  assert.equal(T.sim.d.dsw.kind, "switch");
  E.act(T, { t: "unplug", cable: "c-acc2-bn2", end: "b" }); E.act(T, { t: "unplug", cable: "c-dsw-bn2", end: "a" });
  for (const a of on15(T, ["interface gi0/1", "shutdown", "no shutdown"])) E.act(T, a);
  assert.equal(err15(T, "1"), null, "one cable from the desk switch, one PC behind it: nothing heard, nothing shut");
  assert.ok(online(T.sim, "bn1"));
});

test("CP-15: the ladder climbs, and a saved ticket replays exactly, the switch taken away included", () => {
  const T = E.open(CP15, seedsOf(CP15)[0]), wrongs = T.opts.filter((o) => !o.right).map((o) => o.id);
  assert.equal(E.guess(T, wrongs[0]).rung, 0); assert.equal(E.guess(T, wrongs[1]).rung, 0); assert.equal(E.guess(T, wrongs[2]).rung, 1); assert.equal(E.guess(T, wrongs[3]).rung, 2);
  E.resetBoard(T); assert.equal(E.guess(T, wrongs[4]).rung, 3); assert.equal(E.live(T).length, 2); assert.ok(E.live(T).some((o) => o.right));
  for (const s of seedsOf(CP15)) {
    const U = E.open(CP15, s); E.act(U, { t: "unstray", dev: "dsw" }); for (const a of bounce15(U).concat(proof15(U))) E.act(U, a);
    const R = E.restore(CP15, JSON.parse(JSON.stringify(E.save(U))));
    assert.equal(R.fixed, U.fixed); assert.deepEqual(R.evidence, U.evidence); assert.equal(R.proven, U.proven); assert.equal(JSON.stringify(R.sim.net), JSON.stringify(U.sim.net));
  }
});

test("CP-15: the brief and every hint never name the right answer, a password or the reason the switch gives", () => {
  for (const s of seedsOf(CP15)) {
    const T = E.open(CP15, s), right = T.opts.find((o) => o.right).text.toLowerCase(), p = T.v.plan;
    const texts = [CP15.rung1(T.v, T.sim), CP15.rung2(T.v, T.sim), ...CP15.fixHints(T.v, T.sim), CP15.brief(T.v, T.sim).quote, CP15.mason].map((x) => x.toLowerCase());
    for (const x of texts) {
      assert.ok(x.indexOf(right) < 0, x);
      for (const bad of [p.secret, p.console, p.userPw, p.srv.pw].map((b) => b.toLowerCase())) assert.ok(x.indexOf(bad) < 0, "names a password: " + x);
    }
    for (const x of [CP15.rung1(T.v, T.sim), CP15.brief(T.v, T.sim).quote, CP15.mason].map((y) => y.toLowerCase())) for (const bad of ["bpdu", "loop", "spanning"]) assert.ok(x.indexOf(bad) < 0, "rung 1, the brief or Mason names " + bad + ": " + x);
  }
});
