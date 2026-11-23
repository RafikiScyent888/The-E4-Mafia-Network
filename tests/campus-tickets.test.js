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
