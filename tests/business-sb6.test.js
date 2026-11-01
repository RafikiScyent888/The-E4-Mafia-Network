/* Level 3, SB-J6: hardening after the card processor's PCI DSS check. Each business is SB-J5 done, then worked through the real
   command lines and actions as the work order's solution, with one thing left out or done the tempting wrong way; each must fail
   its own line for its own cause, and only that. The other right ways pass. The closet cabinet's door bars the rack, its lock needs
   its key and a shut door, and nothing refused changes anything. */
import test from "node:test";
import assert from "node:assert/strict";
import { BUSINESS_JOBS } from "../js/build/business.js";
import * as B from "../js/build/engine.js";

const def = BUSINESS_JOBS.find((d) => d.id === "SB-J6");
const N = Math.min(25, Number(process.env.SEEDS || 25));
const seeds = Array.from({ length: N }, (_, i) => 6600 + i * 7919);
const E = (dev, port) => ({ dev, port });
const cli = (line) => ({ t: "cmd", dev: "tech", line, cli: true });
const line = (J, id) => B.evaluate(J.def.reqs.find((q) => q.id === id), J.sim, J.v);
const real = (J, id) => { const c = line(J, id); return c.ok ? "met" : c.real.id; };
/* runs are numbered in the order they're laid: pulling "the console cable" pulls whichever one is in */
const run = (J, acts) => { for (let a of acts) { if (a.t === "pull" && /^c-console-/.test(a.cable)) { const c = J.sim.cablesOf("tech").find((x) => x.kind === "console"); if (c) a = Object.assign({}, a, { cable: c.id }); } const r = B.act(J, a); assert.notEqual(r && r.result && r.result.ok, false, "refused: " + JSON.stringify(a) + " " + JSON.stringify(r && r.result)); } };
const tryIt = (s, acts) => { const J = B.open(def, s); run(J, acts); return J; };
const isCmd = (a, l) => a.t === "cmd" && a.line === l;
/* the k-th time a line appears (0: the router's part, 1: the closet switch's, 2: the back switch's, for the lines all three have) */
const nth = (acts, l, k) => { let n = -1; const i = acts.findIndex((a) => isCmd(a, l) && ++n === k); assert.ok(i >= 0, "no " + l + " #" + k); return i; };
const dropAt = (acts, i) => acts.slice(0, i).concat(acts.slice(i + 1));
const swapAt = (acts, i, to) => acts.map((a, j) => (j === i ? Object.assign({}, a, { line: to }) : a));
const putAfter = (acts, i, more) => acts.slice(0, i + 1).concat(more.map(cli), acts.slice(i + 1));
const drop = (acts, pred) => acts.filter((a) => !pred(a));
const snapshot = (sim) => JSON.stringify(sim.net);
/* every line met but the ones named */
const onlyThese = (J, bad, why) => { for (const r of B.check(J).res) if (bad.indexOf(r.id) < 0) assert.ok(r.ok, why + ": " + r.id + " should still be met: " + r.ev); };

test("SB-J6 as found: every line to do, for the real reason; the solution meets them all", () => {
  for (const s of seeds) {
    const J = B.open(def, s);
    assert.deepEqual(["ssh", "vtyacl", "pwenc", "idle", "psec", "park", "access", "lldp", "snoop", "dai", "rack", "still", "saved", "swsaved", "bswsaved"].map((id) => real(J, id)),
      ["domain", "none", "rtr-service", "rtr-long", "off", "cvlan", "dyn", "wan", "msw-vlans", "msw-vlans", "open", "met", "met", "met", "met"], "seed " + s);
    assert.match(line(J, "access").ev, /Gi0\/3 .*\(printer\): administrative mode dynamic auto/, "the printer's port, left to negotiate since SB-J1");
    const K = tryIt(s, def.solve(J.v, J.sim));
    onlyThese(K, [], "the solution, seed " + s);
  }
});

test("SB-J6: the router's tempting wrong ways fail their own line", () => {
  for (const s of seeds.slice(0, 15)) {
    const J0 = B.open(def, s), p = J0.v.plan, S = p.vlans.staff, sol = def.solve(J0.v, J0.sim), T = (acts) => tryIt(s, acts);
    let J = T(drop(sol, (a) => isCmd(a, "transport input ssh")));
    assert.equal(real(J, "ssh"), "telnet", "Telnet left on (the lines take Telnet from the box)"); onlyThese(J, ["ssh"], "Telnet left on");
    J = T(swapAt(sol, nth(sol, "transport input ssh", 0), "transport input ssh telnet"));
    assert.equal(real(J, "ssh"), "telnet", "both SSH and Telnet taken");
    J = T(swapAt(sol, nth(sol, "crypto key generate rsa modulus 2048", 0), "crypto key generate rsa modulus 512"));
    assert.equal(real(J, "ssh"), "small", "512-bit keys: SSH version 1 only");
    J = T(drop(sol, (a) => isCmd(a, "login local")));
    assert.equal(real(J, "ssh"), "login", "the lines never told to use the router's users");
    J = T(swapAt(sol, nth(sol, "permit " + S.net + " 0.0.0.255", 0), "permit any"));
    assert.equal(real(J, "vtyacl"), "wide", "permit any"); onlyThese(J, ["vtyacl"], "permit any");
    J = T(swapAt(sol, nth(sol, "permit " + S.net + " 0.0.0.255", 0), "permit host 10.255.255.254"));
    assert.equal(real(J, "vtyacl"), "staff", "a list that shuts staff out too");
    J = T(swapAt(sol, nth(sol, "access-class " + p.vtyAcl + " in", 0), "access-class " + p.vtyAcl + " out"));
    assert.equal(real(J, "vtyacl"), "out", "applied out");
    J = T(swapAt(sol, nth(sol, "access-class " + p.vtyAcl + " in", 0), "access-class " + p.vtyAcl + "S in"));
    assert.equal(real(J, "vtyacl"), "missing", "a list that doesn't exist lets everyone in");
    J = T(swapAt(swapAt(sol, nth(sol, "ip access-list standard " + p.vtyAcl, 0), "ip access-list standard VTY"), nth(sol, "access-class " + p.vtyAcl + " in", 0), "access-class VTY in"));
    assert.equal(real(J, "vtyacl"), "name", "a list that works, but not the records'");
    J = T(putAfter(sol, nth(sol, "configure terminal", 0), ["enable password 7 0822455D0A16"]));
    assert.equal(real(J, "pwenc"), "rtr-enable"); assert.match(line(J, "pwenc").real.text, /type 7/, "a type 7 enable password: reversible");
    J = T(dropAt(sol, nth(sol, "service password-encryption", 0)));
    assert.equal(real(J, "pwenc"), "rtr-service", "the router's passwords left readable");
    J = T(swapAt(sol, nth(sol, "exec-timeout " + p.idle + " 0", 0), "exec-timeout 0 0"));
    assert.equal(real(J, "idle"), "rtr-never", "exec-timeout 0 0: never logs out"); onlyThese(J, ["idle"], "exec-timeout 0 0");
    J = T(swapAt(sol, nth(sol, "exec-timeout " + p.idle + " 0", 1), "exec-timeout 15 0"));
    assert.equal(real(J, "idle"), "rtr-long", "the console at fifteen minutes");
    J = T(drop(sol, (a) => isCmd(a, "no lldp transmit")));
    assert.equal(real(J, "lldp"), "wan"); onlyThese(J, ["lldp"], "LLDP left on");
    J = T(swapAt(sol, nth(sol, "no lldp transmit", 0), "no lldp receive"));
    assert.equal(real(J, "lldp"), "rx", "listening stopped, sending not");
    J = T(swapAt(sol, nth(sol, "interface " + p.wanPort, 0), "interface " + p.lanPort));
    assert.equal(real(J, "lldp"), "inside", "LLDP off on the inside port instead");
    J = T(dropAt(sol, nth(sol, "copy running-config startup-config", 0)));
    assert.equal(real(J, "saved"), "since", "the router's work never saved");
  }
});

test("SB-J6: the switches' tempting wrong ways fail their own line, and what they break", () => {
  for (const s of seeds.slice(0, 15)) {
    const J0 = B.open(def, s), p = J0.v.plan, S = p.vlans.staff, G = p.vlans.guest, P = p.vlans.parking, cv = p.vlans.cameras, sol = def.solve(J0.v, J0.sim), T = (acts) => tryIt(s, acts);
    const sticky = "switchport port-security mac-address sticky", both = S.id + "," + G.id;
    let J = T(dropAt(sol, nth(sol, "service password-encryption", 2)));
    assert.equal(real(J, "pwenc"), "bsw-service", "the back switch's passwords left readable");
    J = T(drop(sol, (a) => isCmd(a, sticky)));
    assert.equal(real(J, "psec"), "sticky", "learned but not stuck"); onlyThese(J, ["psec"], "no sticky");
    J = T(putAfter(sol, nth(sol, sticky, 0), ["switchport port-security violation restrict"]));
    assert.equal(real(J, "psec"), "viol", "restrict: the port stays up");
    J = T(putAfter(sol, nth(sol, sticky, 0), ["switchport port-security maximum 2"]));
    assert.equal(real(J, "psec"), "max", "two devices");
    J = T(putAfter(sol, nth(sol, sticky, 0), ["interface gi0/" + p.apPort, "switchport port-security"]));
    assert.equal(real(J, "psec"), "ap", "port security on the access point's port"); assert.equal(real(J, "still"), "guest", "and the visitor's phone shuts it");
    J = T(putAfter(sol, nth(sol, sticky, 0), ["interface gi0/" + p.trunk.closet, "switchport port-security"]));
    assert.equal(real(J, "psec"), "uplink", "port security on the trunk to the back switch"); assert.equal(line(J, "still").ok, false, "and the back of house is cut off");
    /* the parking VLAN never made: giving a port to it makes it, with the switch's own name for it */
    const pv = nth(sol, "vlan " + P.id, 0); assert.ok(isCmd(sol[pv + 1], "name " + P.name) && isCmd(sol[pv + 2], "exit"));
    J = T(sol.slice(0, pv).concat(sol.slice(pv + 3)));   /* the closet switch's vlan, name and exit */
    assert.equal(real(J, "park"), "cname", "the parking VLAN made by the access line, never named");
    J = T(drop(sol, (a) => isCmd(a, "switchport access vlan " + P.id)));
    assert.equal(real(J, "park"), "vlan", "spares left in their old VLANs"); onlyThese(J, ["park"], "spares not parked");
    J = T(dropAt(sol, nth(sol, "switchport mode access", 1)));
    assert.equal(real(J, "park"), "mode", "the closet's spares left to negotiate");
    J = T(putAfter(sol, nth(sol, "shutdown", 0), ["interface gi0/10", "no shutdown"]));
    assert.equal(real(J, "park"), "open", "a spare opened");
    J = T(dropAt(sol, nth(sol, "switchport mode access", 0)));
    assert.equal(real(J, "access"), "dyn", "the printer's port still negotiating"); onlyThese(J, ["access"], "the printer's port");
    J = T(swapAt(sol, nth(sol, "switchport mode access", 0), "switchport mode trunk"));
    assert.equal(real(J, "access"), "trunk", "the printer's port made a trunk");
    J = T(putAfter(sol, nth(sol, "switchport mode access", 0), ["switchport access vlan " + S.id]));
    assert.ok(line(J, "access").ok, "an access port, but in the staff VLAN"); assert.equal(real(J, "still"), "print", "the printer's fixed address is on the old network");
    /* snooping and inspection */
    J = T(dropAt(sol, nth(sol, "ip dhcp snooping trust", 0)));
    assert.equal(real(J, "snoop"), "msw-trust", "the router's port untrusted"); assert.equal(real(J, "still"), "lease", "so nobody renewing gets an address");
    J = T(drop(sol, (a) => isCmd(a, "ip dhcp snooping")));
    assert.equal(real(J, "snoop"), "msw-on", "snooping set for its VLANs, never turned on"); assert.equal(real(J, "dai"), "msw-blind", "and inspection has no bindings");
    J = T(putAfter(sol, nth(sol, "ip arp inspection trust", 0), ["interface gi0/1", "ip dhcp snooping trust"]));
    assert.equal(real(J, "snoop"), "msw-device", "a PC's port trusted");
    J = T(putAfter(sol, nth(sol, "ip arp inspection trust", 0), ["interface gi0/" + p.apPort, "ip dhcp snooping trust"]));
    assert.equal(real(J, "snoop"), "msw-device"); assert.match(line(J, "snoop").real.text, /the access point is on/, "the access point's port trusted");
    J = T(dropAt(sol, nth(sol, "ip arp inspection trust", 0)));
    assert.equal(real(J, "dai"), "msw-trust", "the router's port untrusted for ARP"); assert.equal(real(J, "still"), "arp", "the router's replies dropped");
    J = T(putAfter(sol, nth(sol, "ip arp inspection vlan " + both, 0), ["ip arp inspection vlan " + cv.id]));
    assert.equal(real(J, "dai"), "msw-fixed", "inspection on the cameras' VLAN"); assert.equal(real(J, "still"), "cams", "the cameras' fixed addresses are dropped");
    J = T(putAfter(sol, nth(sol, "ip arp inspection vlan " + both, 0), ["ip arp inspection vlan 1"]));
    assert.equal(real(J, "dai"), "msw-fixed", "inspection on the old network"); assert.equal(real(J, "still"), "print", "the printer's fixed address is dropped");
    J = T(dropAt(sol, nth(sol, "ip dhcp snooping vlan " + S.id, 0)));
    assert.equal(real(J, "snoop"), "bsw-vlans", "the back switch never snooping");
    J = T(dropAt(sol, nth(sol, "copy running-config startup-config", 2)));
    assert.equal(real(J, "bswsaved"), "since", "the back switch's work never saved");
  }
});

test("SB-J6: clients never asked again, and the cabinet left the tempting ways", () => {
  for (const s of seeds.slice(0, 15)) {
    const J0 = B.open(def, s), sol = def.solve(J0.v, J0.sim), T = (acts) => tryIt(s, acts);
    let J = T(drop(sol, (a) => a.line === "ipconfig /renew"));
    assert.equal(real(J, "still"), "stale", "leases from before snooping: dropped by inspection");
    J = T(drop(sol, (a) => a.t === "rejoin"));
    assert.equal(real(J, "still"), "guest", "the visitor's phone never joined again"); assert.match(line(J, "still").real.text, /ARP inspection drops it/);
    J = T(drop(sol, (a) => a.t === "cabinet" && "key" in a.values));
    assert.equal(real(J, "rack"), "key", "locked, the key left in the lock"); onlyThese(J, ["rack"], "the key left in");
    J = T(drop(sol, (a) => a.t === "cabinet" && !("open" in a.values)));
    assert.equal(real(J, "rack"), "unlocked", "shut, not locked");
    J = T(drop(sol, (a) => a.t === "cabinet"));
    assert.equal(real(J, "rack"), "open", "left standing open");
  }
});

test("SB-J6: other right ways pass", () => {
  for (const s of seeds.slice(0, 12)) {
    const J0 = B.open(def, s), p = J0.v.plan, S = p.vlans.staff, sol = def.solve(J0.v, J0.sim);
    let acts = swapAt(sol, nth(sol, "crypto key generate rsa modulus 2048", 0), "crypto key generate rsa modulus 1024");
    /* an extended list for the lines, permitting SSH from staff */
    acts = swapAt(acts, nth(acts, "ip access-list standard " + p.vtyAcl, 0), "ip access-list extended " + p.vtyAcl);
    acts = swapAt(acts, nth(acts, "permit " + S.net + " 0.0.0.255", 0), "permit tcp " + S.net + " 0.0.0.255 any eq 22");
    /* the timeout in seconds; LLDP off everywhere; the settings the records want given in full */
    acts = swapAt(acts, nth(acts, "exec-timeout " + p.idle + " 0", 0), "exec-timeout 0 " + p.idle * 60);
    acts = swapAt(acts, nth(acts, "interface " + p.wanPort, 0), "no lldp run"); acts = dropAt(acts, nth(acts, "no lldp transmit", 0));
    acts = putAfter(acts, nth(acts, "switchport port-security", 0), ["switchport port-security maximum 1", "switchport port-security violation shutdown"]);
    /* the trunk to the back switch trusted too */
    acts = putAfter(acts, nth(acts, "ip arp inspection trust", 0), ["interface gi0/" + p.trunk.closet, "ip dhcp snooping trust", "ip arp inspection trust"]);
    /* the cabinet shut and locked first, then opened again to work in it, and locked again at the end */
    acts = [{ t: "cabinet", values: { open: false } }, { t: "cabinet", values: { locked: true } }, { t: "cabinet", values: { key: false } },
      { t: "cabinet", values: { key: true } }, { t: "cabinet", values: { locked: false } }, { t: "cabinet", values: { open: true } }].concat(acts);
    const J = tryIt(s, acts);
    onlyThese(J, [], "other right ways, seed " + s);
  }
});

test("SB-J6's closet cabinet: its door bars the rack, its lock needs its key and a shut door; a refusal changes nothing", () => {
  for (const s of seeds.slice(0, 6)) {
    const J = B.open(def, s), sim = J.sim, con = () => sim.cablesOf("tech").find((c) => c.kind === "console");
    const no = (a, re) => { const was = snapshot(sim), o = B.act(J, a), r = o.result || { ok: !(o.facts && o.facts.refused), errs: [o.text] }; assert.equal(r.ok, false, JSON.stringify(a)); assert.match(r.errs[0], re); assert.equal(snapshot(sim), was, "a refusal changes nothing: " + JSON.stringify(a)); };
    const yes = (a) => { const o = B.act(J, a), r = o.result || { ok: !(o.facts && o.facts.refused) }; assert.notEqual(r.ok, false, JSON.stringify(a) + " " + JSON.stringify(r)); return r; };
    no({ t: "cabinet", values: { locked: true } }, /Shut the door first/);
    yes({ t: "cabinet", values: { open: false } });
    no({ t: "pull", cable: con().id }, /in the closet cabinet, and its door is shut: open it first/);
    no({ t: "lay", a: E("tech", "ETH"), b: E("msw", "10") }, /closet switch is in the closet cabinet/);
    no({ t: "power", dev: "rtr" }, /in the closet cabinet/);
    no({ t: "place", dev: "tech", room: "back" }, /Pull its cables out first/);   /* the console cable is still in the router */
    yes({ t: "cabinet", values: { key: false } });
    no({ t: "cabinet", values: { locked: true } }, /Put the key in the lock first/);
    no({ t: "cabinet", values: { key: false } }, /isn't in the lock/);
    yes({ t: "cabinet", values: { key: true } }); yes({ t: "cabinet", values: { locked: true } });
    no({ t: "cabinet", values: { open: true } }, /It's locked: unlock it first/);
    no({ t: "pull", cable: con().id }, /door is locked: unlock it and open it first/);
    /* the back switch isn't in the cabinet: a cable at it is laid as ever */
    const L = sim.net.cables.find((c) => (c.a.dev === "bsw" || c.b.dev === "bsw") && c.kind !== "console" && (c.a.dev === "bpc" || c.b.dev === "bpc"));
    yes({ t: "pull", cable: L.id }); yes({ t: "lay", a: E("bpc", "NIC"), b: E("bsw", p0(J)) });
    yes({ t: "cabinet", values: { locked: false } }); yes({ t: "cabinet", values: { open: true } }); yes({ t: "pull", cable: con().id });
    const K = B.restore(def, JSON.parse(JSON.stringify(B.save(J))));
    assert.equal(snapshot(K.sim), snapshot(sim), "the cabinet's door, lock and key replay exactly");
  }
});
const p0 = (J) => J.v.plan.backPort;

test("checking SB-J6 changes nothing, part done or done", () => {
  for (const s of seeds.slice(0, 6)) {
    const J = B.open(def, s), sol = def.solve(J.v, J.sim);
    for (const k of [0, Math.floor(sol.length / 3), Math.floor(sol.length * 2 / 3), sol.length]) {
      const K = tryIt(s, sol.slice(0, k)), was = snapshot(K.sim);
      for (const q of def.reqs) { B.evaluate(q, K.sim, K.v); q.rung1(K.v, K.sim); q.rung2(K.v, K.sim); q.ok(K.sim, K.v); }
      def.summary(K.v, K.sim); def.answer(K.v, K.sim); def.limits(K.v, K.sim);
      assert.equal(snapshot(K.sim), was, "seed " + s + ", after " + k + " steps");
    }
  }
});
