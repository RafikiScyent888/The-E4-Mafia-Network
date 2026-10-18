/* Level 2 build mode: the small office's work orders (js/build/office.js),
   the managed switch in the simulation, the console cable, SSH and Telnet
   from the office PC. */
import test from "node:test";
import assert from "node:assert/strict";
import { OFFICE_JOBS } from "../js/build/office.js";
import * as B from "../js/build/engine.js";
import { prompt, cliSession, secretNext } from "../js/net/cmd.js";
import { rng } from "../js/net/util.js";
import { physicalState } from "../js/net/physical.js";

const N = Number(process.env.SEEDS || 150);
const byId = Object.fromEntries(OFFICE_JOBS.map((d) => [d.id, d]));
const seeds = (id) => Array.from({ length: N }, (_, i) => 5000 + i * 7919 + id.length);
const E = (dev, port) => ({ dev, port });
const cli = (line) => ({ t: "cmd", dev: "tech", line, cli: true });
const pc = (line) => ({ t: "cmd", dev: "pc", line });
const line = (J, id) => B.evaluate(J.def.reqs.find((q) => q.id === id), J.sim, J.v);
const run = (J, acts) => { for (const a of acts) { const r = B.act(J, a); assert.notEqual(r && r.result && r.result.ok, false, "refused: " + JSON.stringify(a) + " " + JSON.stringify(r && r.result)); } };
const solved = (J) => B.check(J).res.every((x) => x.ok);
const swap = (acts, from, to) => acts.map((a) => (a.t === "cmd" && a.line === from ? Object.assign({}, a, { line: to }) : a));
const drop = (acts, pred) => acts.filter((a) => !pred(a));

test("every office job starts with its work still to do, for the real reason; the solution passes every line", () => {
  for (const def of OFFICE_JOBS) for (const s of seeds(def.id)) {
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

test("SO-J1: the tempting wrong ways fail the right line, for the right reason", () => {
  for (const s of seeds("SO-J1").slice(0, 60)) {
    const def = byId["SO-J1"], J0 = B.open(def, s), p = J0.v.plan, sol = def.solve(J0.v, J0.sim);
    const tryIt = (acts) => { const J = B.open(def, s); run(J, acts); return J; };
    assert.equal(line(tryIt([]), "rack").real.id, "box");
    assert.equal(line(tryIt(sol.slice(0, 1)), "rack").real.id, "cable", "in the rack, no console cable");
    let J = tryIt(swap(sol, "enable secret " + p.secret, "enable password " + p.secret));
    assert.equal(line(J, "secret").real.id, "plain", "an enable password, not a secret");
    J = tryIt(swap(sol, "enable secret " + p.secret, "enable secret wrongone1"));
    assert.equal(line(J, "secret").real.id, "wrong");
    J = tryIt(drop(sol, (a) => a.line === "login"));
    assert.equal(line(J, "console").real.id, "nologin", "a console password that's never asked for");
    J = tryIt(swap(sol, "login", "login local"));
    assert.equal(line(J, "console").real.id, "local");
    J = tryIt(swap(sol, "hostname " + p.hostname, "hostname CLOSET"));
    assert.equal(line(J, "name").real.id, "plan");
    J = tryIt(drop(sol, (a) => a.line === "copy running-config startup-config" || (a.line === "" && sol.indexOf(a) > 3)));
    assert.equal(line(J, "saved").real.id, "never");
    J = tryIt(sol.concat([cli("configure terminal"), cli("hostname OOPS"), cli("hostname " + p.hostname), cli("interface gi0/7"), cli("description spare"), cli("end")]));
    assert.equal(line(J, "saved").real.id, "since", "changed after saving");
    /* breaking what worked: the old switch's cable to the front desk pulled */
    J = tryIt(sol.concat([{ t: "pull", cable: "c-old-pc" }]));
    assert.equal(line(J, "keep").real.id, "pc");
  }
});

test("SO-J2: the tempting wrong ways fail the right line, for the right reason; SSH and Telnet from the PC behave", () => {
  for (const s of seeds("SO-J2").slice(0, 60)) {
    const def = byId["SO-J2"], J0 = B.open(def, s), p = J0.v.plan, sol = def.solve(J0.v, J0.sim);
    const tryIt = (acts) => { const J = B.open(def, s); run(J, acts); return J; };
    let J = tryIt(drop(sol, (a) => a.t === "pull" && a.cable === "c-router-old").filter((a) => !(a.t === "lay" && a.a.dev === "router")));
    assert.equal(line(J, "move").real.id, "router", "the router left on the old switch");
    J = tryIt(sol.concat([cli("configure terminal"), cli("interface gi0/2"), cli("shutdown"), cli("end")]));
    assert.equal(line(J, "online").real.id, "link", "the front desk's port shut down");
    J = tryIt(sol.concat([cli("configure terminal"), cli("interface gi0/2"), cli("speed 100"), cli("end")]));
    assert.ok(line(J, "online").ok, "a forced speed facing an adapter that negotiates still links");
    J = tryIt(drop(sol, (a) => a.line === "no shutdown"));
    assert.equal(line(J, "mgmt").real.id, "shut", "VLAN 1 left shut down");
    J = tryIt(swap(sol, "interface vlan 1", "interface gi0/5"));
    assert.equal(line(J, "mgmt").real.id, "none", "the address tried on a port: refused, so none");
    J = tryIt(swap(sol, "ip address " + p.ip + " " + p.mask, "ip address " + p.ip + " 255.255.0.0"));
    assert.equal(line(J, "mgmt").real.id, "mask");
    J = tryIt(drop(sol, (a) => a.line === "ip default-gateway " + p.gw));
    assert.equal(line(J, "gw").real.id, "none"); assert.ok(line(J, "mgmt").ok, "it still answers its own network");
    J = tryIt(drop(sol, (a) => a.line === "ip domain-name " + p.domain));
    assert.equal(line(J, "ssh").real.id, "domain", "no domain: no keys");
    J = tryIt(swap(sol, "crypto key generate rsa modulus 2048", "crypto key generate rsa modulus 512"));
    assert.equal(line(J, "ssh").real.id, "short");
    J = tryIt(drop(sol, (a) => a.line === "transport input ssh"));
    assert.equal(line(J, "ssh").real.id, "telnet", "the vty lines left on Telnet");
    J = tryIt(swap(sol, "login local", "login"));
    assert.equal(line(J, "ssh").real.id, "login");
    J = tryIt(swap(sol, "username " + p.user + " secret " + p.userPw, "username " + p.user + " secret nottheone9"));
    assert.equal(line(J, "ssh").real.id, "user");
    /* the office PC: ssh in with the office's user, the switch's prompt, a wrong password three times, Telnet refused */
    J = tryIt(sol);
    let r = B.act(J, pc("ssh " + p.user + "@" + p.ip)); assert.equal(prompt(J.sim, "pc"), p.user + "@" + p.ip + "'s password: "); assert.equal(secretNext(J.sim, "pc"), true);
    r = B.act(J, pc(p.userPw)); assert.equal(prompt(J.sim, "pc"), p.hostname + ">"); assert.ok(cliSession(J.sim, "pc"));
    assert.doesNotMatch(B.act(J, pc("show running-config | include hostname")).out, /hostname/, "user mode: no running configuration");
    B.act(J, pc("enable")); assert.equal(secretNext(J.sim, "pc"), true); B.act(J, pc(p.secret)); assert.equal(prompt(J.sim, "pc"), p.hostname + "#");
    r = B.act(J, pc("show running-config | include hostname")); assert.match(r.out, new RegExp("hostname " + p.hostname));
    r = B.act(J, pc("exit")); assert.match(r.out, /Connection to .* closed\./); assert.match(prompt(J.sim, "pc"), /^C:\\Users\\/);
    B.act(J, pc("ssh " + p.user + "@" + p.ip)); B.act(J, pc("a")); B.act(J, pc("b")); r = B.act(J, pc("c"));
    assert.match(r.out, /Permission denied \(password\)/); assert.match(prompt(J.sim, "pc"), /^C:\\Users\\/);
    assert.match(B.act(J, pc("telnet " + p.ip)).out, /Could not open connection to the host, on port 23/);
    /* before the keys: SSH is refused; Telnet answers while the vty lines still take it */
    J = tryIt(sol.slice(0, sol.findIndex((a) => /crypto/.test(a.line || ""))));
    assert.match(B.act(J, pc("ssh " + p.user + "@" + p.ip)).out, /Connection refused/);
    assert.match(B.act(J, pc("telnet " + p.ip)).out, /Password required, but none set/, "Telnet on, no vty password: refused by the switch");
    /* SSH only, but no keys: refused; keys too short for version 2: Windows' client and the switch share no version */
    J = tryIt(drop(sol, (a) => /crypto/.test(a.line || "")));
    assert.match(B.act(J, pc("ssh " + p.user + "@" + p.ip)).out, /Connection refused/, "no keys: SSH refused"); assert.equal(cliSession(J.sim, "pc"), null);
    J = tryIt(swap(sol, "crypto key generate rsa modulus 2048", "crypto key generate rsa modulus 512"));
    assert.match(B.act(J, pc("ssh " + p.user + "@" + p.ip)).out, /Protocol major versions differ: 2 vs\. 1/, "512-bit keys: SSH version 1 only"); assert.match(prompt(J.sim, "pc"), /^C:\\Users\\/);
  }
});

test("the console cable: only your laptop's adapter to a switch's CONSOLE port, in the same room; the serial terminal follows it", () => {
  const def = byId["SO-J1"], J = B.open(def, 5005);
  assert.equal(B.act(J, { t: "place", dev: "msw", room: "closet" }).result.ok, true);
  assert.equal(B.act(J, { t: "lay", a: E("router", "LAN 2"), b: E("msw", "CONSOLE") }).result.ok, false, "a network cable into CONSOLE");
  assert.equal(B.act(J, { t: "lay", a: E("tech", "USB-C"), b: E("msw", "5") }).result.ok, false, "the console cable into a network port");
  assert.equal(B.act(J, { t: "place", dev: "tech", room: "front" }).result.ok, true);
  assert.match(B.act(J, { t: "lay", a: E("tech", "USB-C"), b: E("msw", "CONSOLE") }).result.errs[0], /same room/);
  assert.equal(B.act(J, { t: "place", dev: "msw", room: "front" }).result.ok, false, "the switch belongs in the closet rack");
  run(J, [{ t: "place", dev: "tech", room: "closet" }, { t: "lay", a: E("tech", "USB-C"), b: E("msw", "CONSOLE") }]);
  assert.equal(prompt(J.sim, "tech"), "");
  B.act(J, cli("")); assert.equal(prompt(J.sim, "tech"), "Switch>");
  const c = J.sim.net.cables.find((k) => k.kind === "console");
  assert.equal(J.sim.edges().some((e) => e.includes("tech")), false, "a console cable is serial, not part of the network");
  run(J, [{ t: "unplug", cable: c.id, end: c.a.dev === "msw" ? "a" : "b" }]);   /* the switch's end */
  assert.match(B.act(J, cli("enable")).out, /Nothing answers on COM3/);
  const S = physicalState(J.sim, "msw"); assert.equal(S.model, "msw"); assert.equal(S.ports.find((p) => p.name === "CONSOLE").plug, "out");
});

test("a power cut (restart on the Physical tab) brings back only what was saved, and drops the console login", () => {
  for (const s of seeds("SO-J1").slice(0, 20)) {
    const def = byId["SO-J1"], J = B.open(def, s), p = J.v.plan, sol = def.solve(J.v, J.sim);
    run(J, sol.slice(0, sol.findIndex((a) => a.line === "copy running-config startup-config")));
    assert.equal(J.sim.d.msw.sw.hostname, p.hostname);
    run(J, [{ t: "power", dev: "msw" }]);
    assert.equal(J.sim.d.msw.sw.hostname, "Switch", "never saved: the factory name came back");
    assert.equal(line(J, "name").real.id, "factory");
    run(J, sol.slice(2));
    run(J, [{ t: "power", dev: "msw" }]);
    assert.equal(J.sim.d.msw.sw.hostname, p.hostname, "saved: it survives");
    B.act(J, cli("")); assert.equal(prompt(J.sim, "tech"), "Password: ", "the console asks for its password after the restart");
  }
});

test("undo takes back the last line typed to the switch, and the job replays exactly", () => {
  for (const def of OFFICE_JOBS) for (const s of seeds(def.id).slice(0, 30)) {
    const J = B.open(def, s), sol = def.solve(J.v, J.sim), p = J.v.plan;
    run(J, sol.slice(0, 6)); B.act(J, pc("ipconfig /all")); B.check(J); run(J, sol.slice(6)); B.act(J, pc("ping " + p.gw)); B.check(J);
    J.notes = "plan " + s;
    const K = B.restore(def, JSON.parse(JSON.stringify(B.save(J))));
    assert.equal(JSON.stringify(K.sim.net), JSON.stringify(J.sim.net)); assert.equal(K.sim.n, J.sim.n); assert.equal(prompt(K.sim, "tech"), prompt(J.sim, "tech"));
    assert.deepEqual([K.checks, K.done, K.notes], [J.checks, J.done, J.notes]);
    if (!/#\s*$/.test(prompt(J.sim, "tech"))) run(J, [cli(""), cli(p.console), cli("enable"), cli(p.secret)]);   /* a job with no switch work (SO-J4) hasn't logged in */
    const con = J.sim.cablesOf("tech").find((c) => c.kind === "console"), swId = con.a.dev === "tech" ? con.b.dev : con.a.dev, was = J.sim.d[swId].sw.hostname;   /* whichever switch the console cable is on (SO-J10 ends on the back office's) */
    B.act(J, cli("configure terminal")); B.act(J, cli("hostname TEMP"));
    assert.equal(J.sim.d[swId].sw.hostname, "TEMP");
    const gone = B.undo(J); assert.equal(gone.line, "hostname TEMP"); assert.equal(J.sim.d[swId].sw.hostname, was);
  }
});

test("Mason on the office jobs: nothing for two failing checks, then where to look, the principle, and two options forever", () => {
  for (const def of OFFICE_JOBS) for (const s of seeds(def.id).slice(0, 40)) {
    const J = B.open(def, s);
    if (def.id === "SO-J1") run(J, [{ t: "place", dev: "msw", room: "closet" }]);
    const seen = [];
    for (let k = 1; k <= 10; k++) { B.check(J); const m = B.mason(J); seen.push(m ? m.rung : 0); if (m && m.rung === 3) {
      assert.match(m.text, /^It's one of these two: .+, or .+\.$/);
      const first = J.last.res.find((x) => !x.ok), c = line(J, first.id);
      assert.ok(m.text.toLowerCase().includes(c.real.text.toLowerCase()), "the real cause is one of the two");
      for (const st of m.struck) { const cz = c.list.find((z) => z.text === st.text); assert.equal(cz.on, false, "struck only what the network has ruled out"); }
    } }
    assert.deepEqual(seen, [0, 0, 1, 2, 3, 3, 3, 3, 3, 3], def.id + " ladder");
  }
});

test("no help on the office jobs names the answer: no switch name, password, user, address or domain", () => {
  for (const def of OFFICE_JOBS) for (const s of seeds(def.id).slice(0, 30)) {
    const J = B.open(def, s), p = J.v.plan, bad = [p.hostname, p.secret, p.console, p.user, p.userPw, p.ip, p.gw, p.domain, p.banner, p.baseline, p.hostname.toLowerCase() + "-confg"];
    const said = [], sol = def.solve(J.v, J.sim);
    for (let k = 0; k <= sol.length; k++) {
      for (let c = 0; c < 6; c++) { B.check(J); const m = B.mason(J); if (m) said.push(m.text, m.principle || "", ...(m.struck || []).map((x) => x.text + " " + x.why)); }
      if (k < sol.length) B.act(J, sol[k]);
    }
    assert.ok(said.length > 3);
    for (const q of def.reqs) said.push(q.rung1(J.v, J.sim), q.rung2(J.v, J.sim));
    for (const t of said) { for (const b of bad) assert.ok(!t.includes(b), def.id + " gives away " + b + ": " + t); assert.deepEqual(t.match(/\d+\.\d+\.\d+\.\d+/g) || [], [], def.id + " names an address: " + t); }
  }
});

test("random work on the office never breaks the checker; an unmet line always has two causes or more and replays exactly", () => {
  const LINES = ["", "enable", "configure terminal", "end", "exit", "interface gi0/2", "shutdown", "no shutdown", "speed 100", "speed auto", "hostname X1", "interface vlan 1", "ip address 10.9.9.9 255.255.255.0", "no shutdown", "line vty 0 15", "transport input all", "login local", "copy running-config startup-config", "", "reload", "yes", "", "show ip interface brief", "?",
    "interface gi0/4", "banner motd #Keep out#", "banner motd .A. B.", "banner motd Xopen", "more X", "copy startup-config tftp:", "copy running-config tftp:", "192.168.20.51", "10.10.30.121", "backup.cfg"];
  for (const def of OFFICE_JOBS) for (const s of seeds(def.id).slice(0, 50)) {
    const J = B.open(def, s), R = rng(s * 17 + 3), rooms = ["closet", "front", "open", "manager", "meeting"], devs = ["msw", "tech", "pc", "printer", "switch", "router"];
    for (let k = 0; k < 40; k++) {
      const pick = R();
      if (pick < 0.15) B.act(J, { t: "place", dev: R.pick(devs), room: R.pick(rooms) });
      else if (pick < 0.35) { const P = { msw: ["1", "2", "3", "4", "7", "CONSOLE"], tech: ["USB-C", "ETH"], pc: ["NIC"], printer: ["NET"], switch: ["1", "2", "3", "4"], router: ["LAN 1", "LAN 2"] }; const a = R.pick(devs), b = R.pick(devs); B.act(J, { t: "lay", a: E(a, R.pick(P[a])), b: E(b, R.pick(P[b])) }); }
      else if (pick < 0.45) { const c = R.pick(J.sim.net.cables.filter((x) => x.kind !== "coax")); if (c) B.act(J, { t: "pull", cable: c.id }); }
      else if (pick < 0.85) B.act(J, cli(R.pick(LINES)));
      else if (pick < 0.88) B.act(J, { t: "power", dev: "msw" });
      else if (pick < 0.9) B.act(J, { t: "tftp", dev: "tech", on: R() < 0.7 });
      else B.act(J, pc(R.pick(["ipconfig", "ping " + J.v.plan.ip, "ssh " + J.v.plan.user + "@" + J.v.plan.ip, J.v.plan.userPw, "exit", "telnet " + J.v.plan.ip])));
      for (const q of def.reqs) { const c = B.evaluate(q, J.sim, J.v); assert.ok(typeof c.ev === "string" && c.ev.length > 10, def.id + " " + q.id + ": empty evidence"); if (!c.ok) assert.ok(c.list.filter((x) => !x.skip).length >= 2, def.id + " " + q.id + ": a failing line needs two causes or more"); }
    }
    const K = B.restore(def, JSON.parse(JSON.stringify(B.save(J))));
    assert.equal(JSON.stringify(K.sim.net), JSON.stringify(J.sim.net), "random office work replays exactly");
    assert.equal(prompt(K.sim, "tech"), prompt(J.sim, "tech")); assert.equal(prompt(K.sim, "pc"), prompt(J.sim, "pc"));
  }
});

test("the managed switch on the Physical tab: plugs where the cables are, lights from the links, the console plug", () => {
  const def = byId["SO-J2"], J = B.open(def, 5011); run(J, def.solve(J.v, J.sim));
  const S = physicalState(J.sim, "msw");
  assert.deepEqual(S.opts.plugged.slice(0, 4), [true, true, true, false]); assert.equal(S.opts.console, true);
  assert.deepEqual(S.ports.slice(0, 4).map((p) => p.lights), ["green", "green", "green", "off"]);
  run(J, [cli("configure terminal"), cli("interface gi0/3"), cli("shutdown"), cli("end")]);
  assert.equal(physicalState(J.sim, "msw").ports[2].lights, "off", "a shut port goes dark");
  const O = physicalState(J.sim, "switch"); assert.equal(O.model, "switch8"); assert.ok(O.opts.plugged.every((x) => !x), "the old switch emptied");
});

test("SO-J3: the tempting wrong ways fail the right line, for the right reason; a duplex mismatch shows climbing late collisions", () => {
  for (const s of seeds("SO-J3").slice(0, 60)) {
    const def = byId["SO-J3"], J0 = B.open(def, s), p = J0.v.plan, sol = def.solve(J0.v, J0.sim);
    const tryIt = (acts) => { const J = B.open(def, s); run(J, acts); return J; };
    /* the printer's port: left to negotiate, forced half, duplex only, a speed the printer can't match */
    let J = tryIt(drop(sol, (a) => a.line === "duplex full"));
    assert.equal(line(J, "printer").real.id, "auto", "speed set, duplex left to negotiate: still a mismatch");
    J = tryIt(swap(sol, "duplex full", "duplex half"));
    assert.equal(line(J, "printer").real.id, "half");
    J = tryIt(drop(sol, (a) => a.line === "speed 100"));
    assert.equal(line(J, "printer").real.id, "speed", "duplex set by hand, speed still auto");
    J = tryIt(swap(sol, "speed 100", "speed 1000"));
    assert.equal(line(J, "printer").real.id, "link", "a speed the printer can't run: no link");
    assert.equal(line(J, "keep").real.id, "print", "and nothing prints");
    /* the descriptions: one missing, two swapped, one misspelt */
    J = tryIt(drop(sol, (a) => a.line === "description " + p.desc.printer));
    assert.equal(line(J, "desc").real.id, "none");
    J = tryIt(swap(swap(sol, "description " + p.desc.pc, "description TMP"), "description " + p.desc.printer, "description " + p.desc.pc));
    assert.equal(line(J, "desc").real.id, "swap", "the PC's name on the printer's port");
    J = tryIt(swap(sol, "description " + p.desc.router, "description UPLINK-RTR"));
    assert.equal(line(J, "desc").real.id, "wrong");
    J = tryIt(swap(sol, "description " + p.desc.router, "description " + p.desc.router.toLowerCase()));
    assert.ok(line(J, "desc").ok, "the records' wording in lower case still counts");
    /* the unused ports: the copper only, none, or a range that takes in a port in use */
    J = tryIt(swap(sol, "interface range gi0/4 - 28", "interface range gi0/4 - 24"));
    assert.equal(line(J, "unused").real.id, "sfp", "the fibre slots left live");
    J = tryIt(drop(sol, (a) => a.line === "shutdown"));
    assert.equal(line(J, "unused").real.id, "open");
    J = tryIt(swap(sol, "interface range gi0/4 - 28", "interface range gi0/3 - 28"));
    assert.equal(line(J, "unused").real.id, "used", "the printer's port shut with the spares");
    assert.equal(line(J, "keep").real.id, "print");
    /* not saved */
    J = tryIt(drop(sol, (a) => a.line === "copy running-config startup-config" || (a.line === "" && sol.indexOf(a) > 0)));
    assert.equal(line(J, "saved").real.id, "since");
  }
});

test("SO-J3: show interfaces on the printer's port: half duplex and late collisions that climb; set by hand, full duplex and none", () => {
  const def = byId["SO-J3"], J = B.open(def, 5003), p = J.v.plan;
  const lateNow = () => { const out = B.act(J, cli("do show interfaces gi0/3")).result; const t = (out.lines || out.out || []).join ? (out.lines || out.out).join("\n") : String(out.text || ""); return t; };
  run(J, [cli(""), cli(p.console), cli("enable"), cli(p.secret)]);
  const show = () => { const r = B.act(J, cli("show interfaces gi0/3")); return JSON.stringify(r); };
  const a = show(), b = show();
  const late = (t) => +(/(\d+) late collision/.exec(t) || [0, -1])[1];
  assert.match(a, /Half-duplex, 100Mb\/s/);
  assert.ok(late(a) > 0 && late(b) > late(a), "late collisions climb: " + late(a) + " then " + late(b));
  run(J, [cli("configure terminal"), cli("interface gi0/3"), cli("speed 100"), cli("duplex full"), cli("end")]);
  const c = show();
  assert.match(c, /Full-duplex, 100Mb\/s/);
  assert.equal(late(c), 0, "no late collisions once the port matches the printer");
  void lateNow;
});

test("SO-J4: the IPAM sheet's tempting wrong ways fail the right line, for the right reason; any plan the checker accepts passes", () => {
  const n2ip = (n) => [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join(".");
  const ip2n = (s) => s.split(".").reduce((a, x) => a * 256 + +x, 0);
  for (const s of seeds("SO-J4").slice(0, 60)) {
    const def = byId["SO-J4"], J0 = B.open(def, s), groups = J0.v.plan.ipam.groups, good = def.solve(J0.v, J0.sim)[0].rows;
    const sheet = (rows) => { const J = B.open(def, s); run(J, [{ t: "ipam", rows }]); return J; };
    const edit = (i, o) => good.map((r, k) => (k === i ? Object.assign({}, r, o) : r));
    const staff = groups.findIndex((g) => g[0] === "Staff"), gear = groups.findIndex((g) => g[0] === "Network gear");
    const blk = (r) => { const p = +r.mask.slice(1), sz = 2 ** (32 - p), n = ip2n(r.net); return { n, p, sz }; };
    assert.equal(line(B.open(def, s), "filled").real.id, "none");
    assert.equal(line(sheet(edit(gear, { net: "", mask: "", first: "", last: "", bc: "", gw: "" })), "filled").real.id, "row");
    assert.equal(line(sheet(edit(gear, { mask: "/xx" })), "filled").real.id, "format");
    /* too small: staff one size down; too big: staff one size up (both kept on a boundary) */
    const S = blk(good[staff]);
    assert.equal(line(sheet(edit(staff, { mask: "/" + (S.p + 1), last: n2ip(S.n + S.sz / 2 - 2), bc: n2ip(S.n + S.sz / 2 - 1) })), "size").real.id, "small");
    const big = sheet(edit(staff, { mask: "/" + (S.p - 1), last: n2ip(S.n + S.sz * 2 - 2), bc: n2ip(S.n + S.sz * 2 - 1) }));
    assert.equal(line(big, "size").real.id, "big");
    /* off its boundary; reaching outside; overlapping the next block */
    const G = blk(good[gear]);
    assert.equal(line(sheet(edit(gear, { net: n2ip(G.n + 2), first: n2ip(G.n + 3), last: n2ip(G.n + G.sz), bc: n2ip(G.n + G.sz + 1), gw: n2ip(G.n + 3) })), "place").real.id, "align");
    const other = good[gear].net.replace(/^(\d+\.\d+\.)(\d+)/, (m, a, b) => a + (+b + 1));
    assert.equal(line(sheet(edit(gear, { net: other, first: n2ip(ip2n(other) + 1), last: n2ip(ip2n(other) + G.sz - 2), bc: n2ip(ip2n(other) + G.sz - 1), gw: n2ip(ip2n(other) + 1) })), "place").real.id, "outside");
    assert.equal(line(sheet(edit(gear, { net: good[staff].net, first: good[staff].first, last: n2ip(S.n + G.sz - 2), bc: n2ip(S.n + G.sz - 1), gw: good[staff].first })), "place").real.id, "overlap");
    /* the addresses inside a block */
    assert.equal(line(sheet(edit(staff, { first: good[staff].net })), "addrs").real.id, "first");
    assert.equal(line(sheet(edit(staff, { bc: good[staff].last })), "addrs").real.id, "bc");
    assert.equal(line(sheet(edit(staff, { last: good[staff].bc })), "addrs").real.id, "last");
    /* the gateway: blank, unusable, usable but not the first */
    assert.equal(line(sheet(edit(staff, { gw: "" })), "gw").real.id, "blank");
    assert.equal(line(sheet(edit(staff, { gw: good[staff].bc })), "gw").real.id, "unusable");
    assert.equal(line(sheet(edit(staff, { gw: good[staff].last })), "gw").real.id, "first");
    /* another right plan: smallest first, each on its boundary, passes every line */
    const B0 = ip2n(good[0].net) & ~255, alt = []; let at = B0;
    groups.map((g, i) => ({ i, p: +good[i].mask.slice(1) })).sort((a, b) => b.p - a.p).forEach((o) => { const sz = 2 ** (32 - o.p); at = Math.ceil(at / sz) * sz; alt[o.i] = { net: n2ip(at), mask: "255.255.255." + (256 - sz), first: n2ip(at + 1), last: n2ip(at + sz - 2), bc: n2ip(at + sz - 1), gw: n2ip(at + 1) }; at += sz; });
    const J = sheet(alt); assert.ok(B.check(J).res.every((x) => x.ok), "another right plan (smallest first, dotted masks) passes, seed " + s);
  }
});

test("SO-J5: the tempting wrong ways fail the right line, for the right reason; other right ways pass", () => {
  for (const s of seeds("SO-J5").slice(0, 60)) {
    const def = byId["SO-J5"], J0 = B.open(def, s), p = J0.v.plan, sol = def.solve(J0.v, J0.sim);
    const tryIt = (acts) => { const J = B.open(def, s); run(J, acts); return J; };
    const ban = "banner motd #" + p.banner + "#", openAt = sol.findIndex((a) => a.line === "no shutdown") - 2, shutAt = sol.findIndex((a) => a.line === "shutdown") - 2;
    assert.equal(line(tryIt([]), "banner").real.id, "none");
    /* the banner: a delimiter that's in the wording cuts it short; other words; typed over several lines it's right */
    let J = tryIt(swap(sol, ban, "banner motd ." + p.banner + "."));
    assert.equal(line(J, "banner").real.id, "part", "a full stop as the delimiter");
    J = tryIt(swap(sol, ban, "banner motd #Authorized users only#"));
    assert.equal(line(J, "banner").real.id, "wrong");
    const words = p.banner.split(" "), k = sol.findIndex((a) => a.line === ban);
    J = tryIt(sol.slice(0, k).concat([cli("banner motd ^"), cli(words.slice(0, 4).join(" ")), cli(words.slice(4).join(" ") + "^")], sol.slice(k + 1)));
    assert.ok(line(J, "banner").ok, "the wording over several lines");
    /* the backup: the TFTP server never started; the laptop not on the network (never cabled, or on a port left shut) */
    J = tryIt(drop(sol, (a) => a.t === "tftp"));
    assert.equal(line(J, "backup").real.id, "server"); assert.equal(line(J, "baseline").real.id, "server");
    J = tryIt(drop(sol, (a) => a.t === "lay" || a.t === "pull"));
    assert.equal(line(J, "backup").real.id, "net");
    J = tryIt(drop(sol, (a) => a.line === "no shutdown"));
    assert.equal(line(J, "backup").real.id, "net", "cabled to a port still shut");
    /* names: both copies under the baseline's name; the backup under a name of its own; the baseline misnamed */
    const firstName = sol.findIndex((a, i) => i > 0 && a.t === "cmd" && a.line === "" && sol[i - 1].line === J0.v.lapIp);
    J = tryIt(sol.map((a, i) => (i === firstName ? cli(p.baseline) : a)));
    assert.equal(line(J, "backup").real.id, "none"); assert.ok(line(J, "baseline").ok);
    J = tryIt(sol.map((a, i) => (i === firstName ? cli("switch-backup.cfg") : a)));
    assert.equal(line(J, "backup").real.id, "name");
    J = tryIt(swap(sol, p.baseline, "baseline.cfg"));
    assert.equal(line(J, "baseline").real.id, "name"); assert.ok(line(J, "backup").ok);
    /* which configuration: the running one with the port open and not saved; saved with the port open, then shut and saved again */
    J = tryIt(swap(sol, "copy startup-config tftp:", "copy running-config tftp:"));
    assert.equal(line(J, "backup").real.id, "running"); assert.equal(line(J, "baseline").real.id, "running"); assert.ok(line(J, "saved").ok);
    J = tryIt(sol.slice(0, openAt + 4).concat([cli("copy running-config startup-config"), cli("")], sol.slice(openAt + 4), [cli("enable"), cli("copy running-config startup-config"), cli("")]));
    assert.equal(line(J, "backup").real.id, "stale"); assert.equal(line(J, "baseline").real.id, "stale"); assert.ok(line(J, "saved").ok); assert.ok(line(J, "tidy").ok);
    /* leaving: the laptop still cabled; the port left open (and so not what's saved) */
    J = tryIt(drop(sol, (a) => a.t === "pull"));
    assert.equal(line(J, "tidy").real.id, "plugged");
    J = tryIt(sol.slice(0, shutAt).concat([cli("")]));
    assert.equal(line(J, "tidy").real.id, "open"); assert.equal(line(J, "saved").real.id, "since");
    /* another right way: the laptop on a spare router port, no switch port touched; and a running copy taken once it's all saved */
    const viaRouter = sol.filter((a, i) => !(i >= openAt && i < openAt + 4) && !(i >= shutAt && i < shutAt + 4)).map((a) => (a.t === "lay" ? { t: "lay", a: E("tech", "ETH"), b: E("router", "LAN 2") } : a));
    J = tryIt(viaRouter); assert.ok(solved(J), "the laptop on the router's LAN 2, seed " + s);
    J = tryIt(swap(viaRouter, "copy startup-config tftp:", "copy running-config tftp:")); assert.ok(solved(J), "a copy of the running configuration once everything's saved, seed " + s);
  }
});

test("SO-J5: the banner on every login, the copy's real prompts and errors, the laptop's own Command Prompt and TFTP server", () => {
  const def = byId["SO-J5"], J = B.open(def, 5033), p = J.v.plan, sol = def.solve(J.v, J.sim), ip = J.v.lapIp, win = (line) => ({ t: "cmd", dev: "tech", line, win: true });
  const lay = sol.findIndex((a) => a.t === "lay");
  run(J, sol.slice(0, lay));
  /* before the laptop is cabled: its Command Prompt has no address; the copy times out */
  assert.match(B.act(J, win("ipconfig")).out, /Media disconnected/);
  run(J, sol.slice(lay, lay + 1));
  assert.match(B.act(J, win("ipconfig")).out, new RegExp("IPv4 Address[ .]*: " + ip.replace(/\./g, "\\.") + "\n"), "plugged into the opened port, it gets an address");
  let r = B.act(J, cli("copy startup-config tftp:")); assert.equal(prompt(J.sim, "tech"), "Address or name of remote host []? ");
  r = B.act(J, cli(ip)); assert.equal(prompt(J.sim, "tech"), "Destination filename [" + p.hostname.toLowerCase() + "-confg]? ");
  r = B.act(J, cli("")); assert.match(r.out, new RegExp("%Error opening tftp://" + ip.replace(/\./g, "\\.") + "/" + p.hostname.toLowerCase() + "-confg \\(Timed out\\)"), "the server isn't running yet");
  assert.deepEqual(J.sim.d.tech.tftp.files, []);
  run(J, [{ t: "tftp", dev: "tech", on: true }]);
  r = B.act(J, cli("copy startup-config tftp:")); B.act(J, cli(ip)); r = B.act(J, cli(""));
  assert.match(r.out, /^!!\n\d+ bytes copied in \d\.\d{3} secs \(\d+ bytes\/sec\)\n$/);
  const f = J.sim.d.tech.tftp.files[0]; assert.equal(f.name, p.hostname.toLowerCase() + "-confg"); assert.match(f.text, /^!\nversion 4\.2\n/); assert.ok(f.text.includes("banner motd ^C" + p.banner + "^C"));
  assert.match(B.act(J, win("dir C:\\TFTP-Root")).out, new RegExp(f.bytes.toLocaleString("en-US") + " " + f.name));
  assert.ok(J.sim.d.tech.tftp.log.some((l) => l.includes(f.name)));
  /* the TFTP tab and the laptop's 3D model say the same */
  const pg = B.act(J, { t: "view", dev: "tech", key: "tftp" }); assert.equal(pg.addr, ip); assert.equal(pg.on, true); assert.deepEqual(pg.files.map((x) => x.name), [f.name]);
  let S = physicalState(J.sim, "tech"); assert.equal(S.model, "techlaptop"); assert.equal(S.ports[0].plug, "in"); assert.equal(S.ports[0].lights, "green"); assert.equal(S.opts.console, true); assert.match(S.opts.title, /TFTP server/);
  assert.ok(S.says.some((t) => /USB serial adapter is plugged in/.test(t)));
  /* the laptop's two terminals keep their own logins: SSH from its Command Prompt, the console untouched */
  const was = prompt(J.sim, "tech");
  B.act(J, win("ssh " + p.user + "@" + p.ip)); r = B.act(J, win(p.userPw));
  assert.ok(r.out.includes(p.banner), "the banner after an SSH login"); assert.equal(prompt(J.sim, "tech", true), p.hostname + ">"); assert.equal(prompt(J.sim, "tech"), was);
  B.act(J, win("exit")); assert.equal(prompt(J.sim, "tech", true), "C:\\Users\\tech>");
  /* the console: the banner as the line wakes, before the password */
  run(J, sol.slice(lay + 1)); B.act(J, cli("exit")); r = B.act(J, cli(""));
  assert.ok(r.out.indexOf(p.banner) >= 0 && r.out.indexOf(p.banner) < r.out.indexOf("User Access Verification"), "the banner, then the password prompt");
  S = physicalState(J.sim, "tech"); assert.equal(S.ports[0].plug, "none"); assert.ok(S.says.includes("ETHERNET: empty."));
  /* cabled first into a port still shut: no address; the port opened from the console brings the link and an address */
  const L = B.open(def, 5033), openAt = sol.findIndex((a) => a.line === "no shutdown") - 2;
  run(L, sol.slice(0, openAt).concat([sol[lay]]));
  assert.equal(L.sim.addr("tech"), null, "on a port still shut: no link, no address");
  run(L, sol.slice(openAt, openAt + 4));
  assert.equal(L.sim.addr("tech").ip, ip, "the port opened: the laptop asks for an address and gets it");
  /* a laptop's cable in a console port is refused; its USB-C still takes only the console cable */
  const K = B.open(def, 5033);
  assert.equal(B.act(K, { t: "lay", a: E("tech", "ETH"), b: E("msw", "CONSOLE") }).result.ok, false);
  assert.equal(B.act(K, { t: "lay", a: E("tech", "USB-C"), b: E("msw", "5") }).result.ok, false);
});

test("SO-J6: the backup brought back; the tempting wrong ways fail the right line, for the right reason; other right ways pass", () => {
  for (const s of seeds("SO-J6").slice(0, 60)) {
    const def = byId["SO-J6"], J0 = B.open(def, s), p = J0.v.plan, sol = def.solve(J0.v, J0.sim), k = sol.findIndex((a) => a.line === "copy tftp: running-config");
    const tryIt = (acts) => { const J = B.open(def, s); run(J, acts); return J; };
    const intoStart = (then) => sol.slice(0, k).concat([cli("copy tftp: startup-config"), cli(J0.v.lapIp), cli(J0.v.backupName), cli("")], then);
    assert.equal(line(tryIt([]), "restored").real.id, "box");
    /* the backup: never fetched (the server off, or VLAN 1 left shut so the switch can't reach it); into startup only; a reload that saved over it */
    let J = tryIt(sol.filter((a) => a.t !== "tftp"));
    assert.equal(line(J, "restored").real.id, "factory", "the TFTP server never started");
    J = tryIt(sol.slice(0, k).filter((a) => a.line !== "no shutdown").concat(sol.slice(k)));
    assert.equal(line(J, "restored").real.id, "factory", "VLAN 1 left shut: the switch can't reach your laptop");
    J = tryIt(intoStart([]));
    assert.equal(line(J, "restored").real.id, "startup", "in the startup configuration, never reloaded");
    J = tryIt(intoStart([cli("reload"), cli("yes"), cli("")]));
    assert.equal(line(J, "restored").real.id, "factory", "the reload asked to save, and yes saved the factory settings over the backup");
    J = tryIt(sol.concat([cli("configure terminal"), cli("interface gi0/2"), cli("no description"), cli("end"), cli("copy running-config startup-config"), cli("")]));
    assert.equal(line(J, "restored").real.id, "part"); assert.match(line(J, "restored").ev, /interface Gi0\/2/);
    /* the cables: a desk left out, the printer on another port (which the backup shuts) */
    J = tryIt(sol.filter((a) => !(a.t === "lay" && a.b.dev === "pc") && a.t !== "pull"));   /* one cable fewer: your laptop's has another number */
    assert.equal(line(J, "cabled").real.id, "none"); assert.equal(line(J, "keep").real.id, "pc");
    J = tryIt(sol.map((a) => (a.t === "lay" && a.b.dev === "printer" ? { t: "lay", a: E("msw", "5"), b: a.b } : a)));
    assert.equal(line(J, "cabled").real.id, "port", "the printer on port 5"); assert.equal(line(J, "keep").real.id, "print", "and port 5 is shut by the backup");
    /* SSH: no keys (a file never carries them); the old key still remembered by the front desk PC */
    J = tryIt(sol.filter((a) => !/crypto/.test(a.line || "")));
    assert.equal(line(J, "ssh").real.id, "keys"); assert.ok(line(J, "restored").ok, "the configuration is the backup's all the same");
    assert.match(B.act(J, pc("ssh " + p.user + "@" + p.ip)).out, /Connection refused/);
    J = tryIt(sol.filter((a) => !/ssh-keygen/.test(a.line || "")));
    assert.equal(line(J, "ssh").real.id, "known");
    assert.match(B.act(J, pc("ssh " + p.user + "@" + p.ip)).out, /REMOTE HOST IDENTIFICATION HAS CHANGED/);
    /* leaving: the laptop still cabled; nothing saved */
    J = tryIt(sol.filter((a) => a.t !== "pull"));
    assert.equal(line(J, "tidy").real.id, "plugged");
    J = tryIt(sol.filter((a) => a.line !== "copy running-config startup-config"));
    assert.equal(line(J, "saved").real.id, "never");
    /* other right ways: into startup and reloaded (no to saving), then the keys; the laptop on the router's LAN 2 */
    J = tryIt(intoStart([cli("reload"), cli("no"), cli(""), cli(p.console), cli("enable"), cli(p.secret)].concat(sol.slice(k + 4))));
    assert.ok(solved(J), "into startup, then reload, seed " + s);
    J = tryIt(intoStart([cli("reload"), cli("no"), cli(""), cli(p.console), cli("enable"), cli(p.secret)].concat(sol.slice(k + 4).filter((a) => !/crypto/.test(a.line || "")))));
    assert.equal(line(J, "ssh").real.id, "keys", "into startup and reloaded: still no keys, a file never carries them"); assert.ok(line(J, "restored").ok);
    const viaRouter = sol.map((a) => (a.t === "lay" && a.a.dev === "tech" && a.a.port === "ETH" ? { t: "lay", a: E("tech", "ETH"), b: E("router", "LAN 2") } : a));
    J = tryIt(viaRouter); assert.ok(solved(J), "the laptop on the router's LAN 2, seed " + s);
  }
});

test("SO-J6: copy tftp: asks as the real thing does; a file brings back hashes, not passwords; the new key differs", () => {
  const def = byId["SO-J6"], J = B.open(def, 5066), p = J.v.plan, sol = def.solve(J.v, J.sim), k = sol.findIndex((a) => a.line === "copy tftp: running-config");
  run(J, sol.slice(0, k));
  B.act(J, cli("copy tftp: running-config")); assert.equal(prompt(J.sim, "tech"), "Address or name of remote host []? ");
  B.act(J, cli(J.v.lapIp)); assert.equal(prompt(J.sim, "tech"), "Source filename []? ");
  B.act(J, cli("no-such-file")); assert.equal(prompt(J.sim, "tech"), "Destination filename [running-config]? ");
  let r = B.act(J, cli("")); assert.match(r.out, /%Error opening tftp:\/\/[\d.]+\/no-such-file \(No such file or directory\)/);
  assert.equal(J.sim.d.msw.sw.hostname, "Switch");
  run(J, sol.slice(k, k + 4));
  const sw = J.sim.d.msw.sw;
  assert.equal(sw.hostname, p.hostname); assert.match(sw.enableSecret, /^\$1\$/, "the secret comes back as its hash");
  assert.ok(J.sim.d.tech.tftp.log.some((l) => /^Read request from .* for .*: sent \d+ bytes$/.test(l)));
  assert.equal(sw.rsa, 0, "no keys in a file");
  assert.equal(sw.ports["GigabitEthernet0/4"].shutdown, true, "the spare port your laptop was on shuts as the backup lands");
  /* the hashes still let the office's passwords in */
  run(J, [cli("end"), cli("disable"), cli("enable")]); assert.equal(secretNext(J.sim, "tech"), true);
  B.act(J, cli(p.secret)); assert.equal(prompt(J.sim, "tech"), p.hostname + "#");
  run(J, sol.slice(k + 4));
  B.act(J, pc("ssh " + p.user + "@" + p.ip)); r = B.act(J, pc(p.userPw)); assert.equal(prompt(J.sim, "pc"), p.hostname + ">", "the user's hashed secret lets the office's login in");
  assert.notEqual(J.sim.d.pc.knownHosts[p.ip], undefined, "the new key, added after ssh-keygen -R");
});

test("SO-J7: the new hire's desk; the tempting wrong ways fail the right line, for the right reason; other right ways pass", () => {
  for (const s of seeds("SO-J7").slice(0, 60)) {
    const def = byId["SO-J7"], J0 = B.open(def, s), p = J0.v.plan, sol = def.solve(J0.v, J0.sim);
    const tryIt = (acts) => { const J = B.open(def, s); run(J, acts); return J; };
    const save = sol.findIndex((a) => a.line === "copy running-config startup-config"), lap = sol.findIndex((a) => a.t === "lay" && a.a.dev === "tech");
    assert.equal(line(tryIt([]), "desk").real.id, "box");
    /* where it goes: another room; straight into the router */
    let J = tryIt([{ t: "place", dev: "hire", room: "manager" }]);
    assert.equal(line(J, "desk").real.id, "room");
    J = tryIt([sol[0], { t: "lay", a: E("router", "LAN 2"), b: E("hire", "NIC") }]);
    assert.equal(line(J, "desk").real.id, "router", "online through the router, but not on the switch"); assert.ok(line(J, "online").ok, "it does get online that way");
    /* the port: still shut; no description; another wording */
    J = tryIt(sol.filter((a) => a.line !== "no shutdown"));
    assert.equal(line(J, "port").real.id, "shut"); assert.equal(line(J, "online").real.id, "link");
    J = tryIt(sol.filter((a) => !/^description /.test(a.line || "")));
    assert.equal(line(J, "port").real.id, "none");
    J = tryIt(sol.map((a) => (/^description /.test(a.line || "") ? Object.assign({}, a, { line: "description NEW-PC" }) : a)));
    assert.equal(line(J, "port").real.id, "wrong");
    /* a range opened instead of the one port: every spare live */
    J = tryIt(sol.map((a) => (a.line === "interface gi0/5" ? Object.assign({}, a, { line: "interface range gi0/4 - 24" }) : a)));
    assert.equal(line(J, "spares").real.id, "open"); assert.ok(line(J, "online").ok);
    /* saved, but the backup left as it was; a running copy taken before saving; nothing saved at all */
    J = tryIt(sol.slice(0, lap));
    assert.equal(line(J, "backup").real.id, "stale", "the change saved, the backup not refreshed"); assert.ok(line(J, "saved").ok);
    J = tryIt(sol.slice(0, save).concat(sol.slice(lap, lap + 2), [cli("copy running-config tftp:"), cli(J0.v.lapIp), cli("")], [cli("copy running-config startup-config"), cli("")]));
    assert.ok(line(J, "backup").ok, "a running copy taken just before the save, nothing changed between: it is what's saved");
    J = tryIt(sol.slice(0, save).concat(sol.slice(lap, lap + 2), [cli("copy running-config tftp:"), cli(J0.v.lapIp), cli(""), cli("configure terminal"), cli("interface gi0/5"), cli("description " + p.desc.hire + " "), cli("description TEMP"), cli("description " + p.desc.hire), cli("speed 100"), cli("end"), cli("copy running-config startup-config"), cli("")]));
    assert.equal(line(J, "backup").real.id, "running", "a running copy taken with changes unsaved, then another change saved: not what the switch comes back with");
    J = tryIt(sol.filter((a, i) => i !== save && !(i === save + 1)));
    assert.equal(line(J, "saved").real.id, "since");
    /* the laptop left on the network */
    J = tryIt(sol.filter((a) => a.t !== "pull"));
    assert.equal(line(J, "spares").real.id, "plugged");
    /* another right way: the laptop on a spare switch port opened but not saved, then shut again */
    const viaPort = sol.slice(0, lap).concat([cli("configure terminal"), cli("interface gi0/6"), cli("no shutdown"), cli("end"), { t: "lay", a: E("tech", "ETH"), b: E("msw", "6") }], sol.slice(lap + 1, -1), [{ t: "pull", cable: "c-run-" + (J0.v.runs + 2) }, cli("configure terminal"), cli("interface gi0/6"), cli("shutdown"), cli("end")]);
    J = tryIt(viaPort); assert.ok(solved(J), "the laptop on a spare port opened without saving, seed " + s);
  }
});

test("SO-J8: the printer moved; the tempting wrong ways fail the right line, for the right reason; other right ways pass", () => {
  for (const s of seeds("SO-J8").slice(0, 60)) {
    const def = byId["SO-J8"], J0 = B.open(def, s), p = J0.v.plan, sol = def.solve(J0.v, J0.sim), np = J0.v.newPort;
    const tryIt = (acts) => { const J = B.open(def, s); run(J, acts); return J; };
    const drop = (acts, re) => acts.filter((a) => !re.test(a.line || ""));
    let J = tryIt([]);
    assert.equal(line(J, "printer").real.id, "shut"); assert.match(line(J, "printer").ev, new RegExp("Gi0/" + np + ", where the printer's run lands, is disabled"));
    assert.equal(line(J, "spares").real.id, "old");
    /* the port opened with nothing else: the printer links, but the duplex is wrong and the description missing */
    const k = sol.findIndex((a) => a.line === "interface gi0/" + np);
    J = tryIt(sol.slice(0, k + 1).concat([cli("no shutdown"), cli("end")]));
    assert.ok(line(J, "printer").ok, "opened: the printer prints (slowly)"); assert.equal(line(J, "duplex").real.id, "auto"); assert.equal(line(J, "desc").real.id, "none");
    /* the settings carried over, the old port left as it was: still named for the printer, still live */
    const old = sol.findIndex((a) => a.line === "interface gi0/3");
    J = tryIt(sol.slice(0, old).concat(sol.slice(old + 5)));
    assert.equal(line(J, "desc").real.id, "stale"); assert.match(line(J, "desc").ev, /Gi0\/3 is named .*empty wall jack/); assert.equal(line(J, "spares").real.id, "old");
    J = tryIt(drop(sol, /^no description$/));
    assert.equal(line(J, "desc").real.id, "stale", "shut, but still named for the printer"); assert.ok(line(J, "spares").ok);
    J = tryIt(sol.filter((a, i) => !(i === old + 4)));
    assert.equal(line(J, "spares").real.id, "old", "its label taken off, but left live"); assert.ok(line(J, "desc").ok);
    /* half duplex forced; a speed the printer can't run */
    J = tryIt(sol.map((a) => (a.line === "duplex full" ? cli("duplex half") : a)));
    assert.equal(line(J, "duplex").real.id, "half");
    J = tryIt(sol.map((a) => (a.line === "speed 100" ? cli("speed 1000") : a)));
    assert.equal(line(J, "printer").real.id, "link"); assert.equal(line(J, "duplex").real.id, "link");
    /* the backup left behind */
    J = tryIt(sol.slice(0, sol.findIndex((a) => a.t === "lay")));
    assert.equal(line(J, "backup").real.id, "stale"); assert.ok(line(J, "saved").ok);
    /* a range shut that took in the front desk */
    J = tryIt(sol.map((a) => (a.line === "interface gi0/3" ? cli("interface range gi0/2 - 3") : a)));
    assert.equal(line(J, "spares").real.id, "used"); assert.equal(line(J, "keep").real.id, "pc");
    /* another right way: the old run pulled, the printer's run laid into port 3 where its settings already are (no switch change at all) */
    const oldRun = J0.sim.cablesOf("ojack")[0].id;
    J = tryIt([{ t: "pull", cable: oldRun }, { t: "pull", cable: "c-run-cabler" }, { t: "lay", a: E("msw", "3"), b: E("printer", "NET") }]);
    assert.ok(solved(J), "the printer's run into its old port, seed " + s);
  }
});

test("SO-J9: the cable map; the tone and the probe find the runs; the tempting wrong ways fail the right line; other right ways pass", () => {
  for (const s of seeds("SO-J9").slice(0, 60)) {
    const def = byId["SO-J9"], J0 = B.open(def, s), p = J0.v.plan, sol = def.solve(J0.v, J0.sim), P = J0.v.P, sp = (id) => J0.v.set[id].replace("GigabitEthernet0/", "");
    const tryIt = (acts) => { const J = B.open(def, s); run(J, acts); return J; };
    const map = sol.find((a) => a.t === "cablemap"), cords = sol.filter((a) => a.t === "lay");
    /* the probe hears nothing until a run is toned; toned at the front desk, it sounds at that run's panel port */
    let J = B.open(def, s);
    assert.match(B.act(J, { t: "probe" }).text, /Nothing to hear/);
    B.act(J, { t: "tone", cable: "c-pp-pc" }); assert.match(B.act(J, { t: "probe" }).text, new RegExp("back of port " + P.pc + "\\b"));
    const emptyBack = ["17", "18", "19", "20", "21", "22", "23", "24"][s % 8];   /* runs go on 1 to 16: the back of an empty port, punched down with nothing */
    assert.equal(B.act(J, { t: "lay", a: E("pp", emptyBack + "R"), b: E("msw", "24") }).result.ok, false, "the back of the panel takes no cord, even at an empty port");
    J = tryIt(cords.slice(0, 1)); assert.equal(J.sim.net.cables.find((c) => c.a.dev === "pp" && c.a.port === P.pc).length, 0.5, "a patch cord in the rack is half a metre");
    assert.equal(line(B.open(def, s), "patched").real.id, "none");
    /* a desk patched to a spare port (shut); to the router; two desks on each other's ports */
    J = tryIt([{ t: "lay", a: E("pp", P.pc), b: E("msw", "4") }].concat(cords.slice(1), [map]));
    assert.equal(line(J, "patched").real.id, "shut"); assert.equal(line(J, "ports").real.id, "spare");
    J = tryIt([{ t: "lay", a: E("pp", P.pc), b: E("router", "LAN 2") }].concat(cords.slice(1), [map]));
    assert.equal(line(J, "patched").real.id, "notsw", "online through the router, but not on the switch");
    J = tryIt([{ t: "lay", a: E("pp", P.pc), b: E("msw", sp("printer")) }, { t: "lay", a: E("pp", P.printer), b: E("msw", sp("pc")) }, cords[2], map]);
    assert.equal(line(J, "ports").real.id, "swap", "the front desk and the printer on each other's ports");
    /* the map: none; the empty jacks left out; a room wrong; a room for an empty port */
    J = tryIt(cords); assert.equal(line(J, "map").real.id, "none"); assert.ok(line(J, "patched").ok && line(J, "ports").ok);
    const m2 = Object.assign({}, map.map); delete m2[P.mjack];
    J = tryIt(cords.concat([{ t: "cablemap", map: m2 }])); assert.equal(line(J, "map").real.id, "missing", "the meeting room's empty jack left out");
    J = tryIt(cords.concat([{ t: "cablemap", map: Object.assign({}, map.map, { [P.pc]: "open", [P.hire]: "front" }) }])); assert.equal(line(J, "map").real.id, "wrong");
    const empty = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15", "16"].find((n) => !Object.values(P).includes(n));
    J = tryIt(cords.concat([{ t: "cablemap", map: Object.assign({}, map.map, { [empty]: "front" }) }])); assert.equal(line(J, "map").real.id, "extra");
    /* a spare opened and left */
    J = tryIt(sol.concat([cli(""), cli(p.console), cli("enable"), cli(p.secret), cli("configure terminal"), cli("interface gi0/24"), cli("no shutdown"), cli("end")]));
    assert.equal(line(J, "spares").real.id, "open");
    /* another right way: the front desk patched to a spare, that port set up for it and the old one cleared and shut, saved, the backup refreshed */
    const lapIp = J0.sim.offer("router", J0.sim.d.tech.ifaces[0].mac, null), old = sp("pc");
    const alt = [{ t: "lay", a: E("pp", P.pc), b: E("msw", "4") }].concat(cords.slice(1), [map, cli(""), cli(p.console), cli("enable"), cli(p.secret), cli("configure terminal"),
      cli("interface gi0/4"), cli("description " + p.desc.pc), cli("no shutdown"), cli("interface gi0/" + old), cli("no description"), cli("shutdown"), cli("end"), cli("copy running-config startup-config"), cli(""),
      { t: "lay", a: E("tech", "ETH"), b: E("router", "LAN 2") }, { t: "tftp", dev: "tech", on: true }, cli("copy startup-config tftp:"), cli(lapIp), cli("")]);
    J = tryIt(alt); assert.equal(line(J, "spares").real.id, "plugged", "your laptop still on the router");
    J = tryIt(alt.concat([{ t: "pull", cable: J.sim.cablesOf("tech").find((c) => c.kind === "cat6").id }])); assert.ok(solved(J), "the front desk moved to another port and set up there, seed " + s);
  }
});

test("SO-J10: the fibre to the back office; the wrong modules and the tempting wrong ways fail the right line; other right ways pass", () => {
  for (const s of seeds("SO-J10").slice(0, 60)) {
    const def = byId["SO-J10"], J0 = B.open(def, s), p = J0.v.plan, sol = def.solve(J0.v, J0.sim);
    const tryIt = (acts) => { const J = B.open(def, s); run(J, acts); return J; };
    const mod = (dev, type) => sol.map((a) => (a.t === "sfp" && a.dev === dev ? Object.assign({}, a, { type }) : a));
    let J = B.open(def, s);
    assert.equal(line(J, "fibre").real.id, "box");
    assert.equal(B.act(J, { t: "place", dev: "bsw", room: "closet" }).result.ok, false, "the back office switch belongs in the back office");
    run(J, sol.slice(0, 1));
    assert.equal(B.act(J, { t: "lay", a: E("msw", "SFP1"), b: E("bsw", "SFP1") }).result.ok, false, "no module, no fibre: its plug goes into a module");
    assert.equal(B.act(J, { t: "lay", a: E("msw", "SFP1"), b: E("bsw", "3") }).result.ok, false, "fibre from a slot to a copper port");
    assert.equal(B.act(J, { t: "lay", a: E("tech", "USB-C"), b: E("bsw", "CONSOLE") }).result.ok, false, "the console cable doesn't reach the meeting room");
    /* the modules: single-mode at either end or both, the SFP+ at either end */
    J = tryIt(mod("msw", "1000BASE-LX")); assert.equal(line(J, "fibre").real.id, "smf"); assert.equal(line(J, "back").real.id, "addr");
    J = tryIt(mod("bsw", "1000BASE-LX")); assert.equal(line(J, "fibre").real.id, "smf");
    J = tryIt(mod("msw", "10GBASE-SR")); assert.equal(line(J, "fibre").real.id, "plus");
    J = tryIt(mod("bsw", "10GBASE-SR")); assert.equal(line(J, "fibre").real.id, "plus");
    /* the closet's fibre port: left shut; opened with no name */
    J = tryIt(sol.filter((a) => a.line !== "no shutdown")); assert.equal(line(J, "fibre").real.id, "shut"); assert.equal(line(J, "port").real.id, "shut");
    J = tryIt(sol.filter((a) => !/^description /.test(a.line || ""))); assert.equal(line(J, "port").real.id, "none"); assert.ok(line(J, "fibre").ok);
    /* the back office PC on the closet switch instead (a spare, shut) */
    J = tryIt(sol.map((a) => (a.t === "lay" && a.b.dev === "mpc" ? { t: "lay", a: E("msw", "24"), b: E("mpc", "NIC") } : a))); assert.equal(line(J, "back").real.id, "cable");
    /* the new switch: never named; an enable password, not a secret; a console password never asked for */
    const bs = sol.slice(sol.findIndex((a) => a.t === "lay" && a.b.dev === "bsw" && a.b.port === "CONSOLE"));
    const head = sol.slice(0, sol.length - bs.length);
    J = tryIt(head.concat(bs.filter((a) => !/^hostname /.test(a.line || "")))); assert.equal(line(J, "bsw").real.id, "factory");
    J = tryIt(head.concat(bs.map((a) => (/^enable secret /.test(a.line || "") ? cli("enable password " + p.secret) : a)))); assert.equal(line(J, "bsw").real.id, "secret"); assert.match(line(J, "bsw").ev, /plain text/);
    J = tryIt(head.concat(bs.filter((a) => a.line !== "login"))); assert.equal(line(J, "bsw").real.id, "con");
    /* saving: the new switch never saved; the closet switch's change left unsaved */
    J = tryIt(head.concat(bs.slice(0, -2))); assert.equal(line(J, "saved").real.id, "bnever");
    const k = sol.findIndex((a) => a.line === "copy running-config startup-config");
    J = tryIt(sol.filter((a, i) => i !== k && i !== k + 1 && !(a.t === "tftp") && !/tftp:/.test(a.line || ""))); assert.equal(line(J, "saved").real.id, "msince");
    /* the backup not refreshed */
    J = tryIt(sol.filter((a, i) => !(a.t === "tftp") && !/^copy startup-config tftp:/.test(a.line || "") && a.line !== J0.v.lapIp && !(i === sol.findIndex((x) => x.line === J0.v.lapIp) + 1)));
    assert.equal(line(J, "backup").real.id, "stale");
    /* another right way: SFP2 at the closet end (gi0/26), SFP3 at the back office's */
    const alt = sol.map((a) => (a.t === "sfp" && a.dev === "msw" ? Object.assign({}, a, { slot: "SFP2" }) : a.t === "sfp" && a.dev === "bsw" ? Object.assign({}, a, { slot: "SFP3" }) : a.t === "lay" && a.a.port === "SFP1" ? { t: "lay", a: E("msw", "SFP2"), b: E("bsw", "SFP3") } : a.line === "interface gi0/25" ? cli("interface gi0/26") : a));
    J = tryIt(alt); assert.ok(solved(J), "the fibre on other slots, seed " + s);
  }
});
