/* Level 3, SB-J8: the printers' VLAN. Each business is SB-J7 done, then the records' printers' VLAN (its number from the business's
   VLAN set, PRINTERS, 10.<site>.<vlan>.0/24) and the printer's fixed address on it. Worked through the real command lines as the
   work order's solution (over SSH from the manager's PC, to the closet switch and the router), with one thing left out or done the
   tempting wrong way; each must fail its own line for its own cause. The other right ways pass, the closet switch's console in the
   cabinet among them. Also here: a named access list's sequence numbers, and SSH across the router, both new with SB-J8. */
import test from "node:test";
import assert from "node:assert/strict";
import { BUSINESS_JOBS } from "../js/build/business.js";
import * as B from "../js/build/engine.js";
import { exec } from "../js/net/cmd.js";
import { newRouter } from "../js/net/rtcli.js";
import { session, exec as cliExec, complete } from "../js/net/swcli.js";

const def = BUSINESS_JOBS.find((d) => d.id === "SB-J8");
const N = Math.min(25, Number(process.env.SEEDS || 25));
const seeds = Array.from({ length: N }, (_, i) => 8800 + i * 7919);
const line = (J, id) => B.evaluate(J.def.reqs.find((q) => q.id === id), J.sim, J.v);
const real = (J, id) => { const c = line(J, id); return c.ok ? "met" : c.real.id; };
const run = (J, acts) => { for (const a of acts) { const r = B.act(J, a); assert.notEqual(r && r.result && r.result.ok, false, "refused: " + JSON.stringify(a) + " " + JSON.stringify(r && r.result)); } };
const tryIt = (s, acts) => { const J = B.open(def, s); run(J, acts); return J; };
const isCmd = (a, l) => a.t === "cmd" && a.line === l;
/* lines that come twice (configure terminal, end, the save) are found from a line that comes once */
const at = (acts, l, from) => { const i = acts.findIndex((a, k) => k >= (from || 0) && isCmd(a, l)); assert.ok(i >= 0, "no " + l); return i; };
const swap = (acts, l, to) => acts.map((a) => (isCmd(a, l) ? Object.assign({}, a, { line: to }) : a));
const dropAt = (acts, ...ix) => acts.filter((a, i) => ix.indexOf(i) < 0);
const putAt = (acts, i, more) => acts.slice(0, i).concat(more.map((x) => Object.assign({}, acts[i - 1], { line: x })), acts.slice(i));
const onlyThese = (J, bad, why) => { for (const r of B.check(J).res) if (bad.indexOf(r.id) < 0) assert.ok(r.ok, why + ": " + r.id + " should be met: " + r.ev); };
const w = " 0.0.0.255";

test("SB-J8 as found: the printer on the old network, the six lines to do, for the real reason; solved, guests kept off it", () => {
  for (const s of seeds) {
    const J = B.open(def, s), p = J.v.plan, P = p.vlans.printers;
    assert.deepEqual(["pvlan", "pport", "psub", "pfixed", "pprint", "pguest", "still", "saved", "swsaved"].map((id) => real(J, id)), ["none", "vlan", "none", "old", "moved", "open", "met", "met", "met"], "seed " + s);
    assert.ok(/^10\.\d+\.\d+\.0$/.test(P.net) && P.gw === P.net.replace(/\.0$/, ".1") && p.printerIp.split(".")[3] === J.sim.d.printer.ifaces[0].cfg.ip.split(".")[3], "the records' VLAN, and the printer keeping its host number: " + JSON.stringify(P));
    assert.ok(Object.values(p.vlans).filter((x) => x.id === P.id).length === 1, "a VLAN number of its own");
    const K = tryIt(s, def.solve(J.v, J.sim));
    onlyThese(K, [], "the solution, seed " + s);
    assert.equal(K.sim.d.pc.printer.port, p.printerIp); assert.equal(B.act(K, { t: "print" }).facts.print, "ok", "the reception PC's test page prints at the new address");
    const g = K.sim.route("guest", p.printerIp); assert.ok(g.fail, "the visitor's phone can't reach the printer: " + JSON.stringify(g));
    const L = tryIt(s, dropAt(def.solve(J.v, J.sim), at(def.solve(J.v, J.sim), "35 deny ip " + p.vlans.guest.net + w + " " + P.net + w)));
    const g2 = L.sim.route("guest", p.printerIp); assert.ok((g2.routed || g2.local) && !g2.fail, "with no line for it, the visitor's phone reaches the printer, as the line says: " + JSON.stringify(g2));
  }
});

test("SB-J8: the tempting wrong ways fail their own line, and what they break", () => {
  for (const s of seeds.slice(0, 15)) {
    const J0 = B.open(def, s), p = J0.v.plan, P = p.vlans.printers, G = p.vlans.guest, S = p.vlans.staff, sol = def.solve(J0.v, J0.sim), T = (acts) => tryIt(s, acts);
    const deny = "35 deny ip " + G.net + w + " " + P.net + w, sub = "interface " + p.lanPort + "." + P.id, rtAt = at(sol, "ssh " + p.user + "@" + S.gw);
    const client = sol.findIndex((a) => a.t === "client"), cv = sol[client].values, withPrinter = (vals) => sol.map((a, i) => (i === client ? Object.assign({}, a, { values: Object.assign({}, cv, vals) }) : a));
    /* the VLAN made by putting the port in it: named after its number */
    let J = T(dropAt(sol, at(sol, "vlan " + P.id), at(sol, "name " + P.name), at(sol, "exit")));
    assert.equal(real(J, "pvlan"), "name", "made by the port"); onlyThese(J, ["pvlan"], "only its name");
    J = T(dropAt(sol, at(sol, "switchport access vlan " + P.id)));
    assert.equal(real(J, "pport"), "vlan", "the port left in the old VLAN"); assert.equal(real(J, "pprint"), "reach", "the printer cut off");
    J = T(dropAt(sol, at(sol, sub), at(sol, "encapsulation dot1Q " + P.id), at(sol, "ip address " + P.gw + " " + p.vmask), at(sol, "exit", at(sol, sub))));
    assert.equal(real(J, "psub"), "none", "no subinterface"); assert.equal(real(J, "pprint"), "reach");
    J = T(swap(sol, "ip address " + P.gw + " " + p.vmask, "ip address " + P.net.replace(/\.0$/, ".254") + " " + p.vmask));
    assert.equal(real(J, "psub"), "addr", "the gateway at another address"); assert.equal(real(J, "pprint"), "reach", "the printer's gateway isn't there");
    J = T(withPrinter({ gw: p.lanGw }));
    assert.equal(real(J, "pfixed"), "gw", "the old network's gateway"); assert.equal(real(J, "pprint"), "reach", "its answers go nowhere");
    J = T(withPrinter({ gw: "" }));
    assert.equal(real(J, "pfixed"), "gw", "no gateway"); assert.equal(real(J, "pprint"), "reach");
    J = T(dropAt(sol, client));
    assert.equal(real(J, "pfixed"), "old", "the panel never changed"); assert.equal(real(J, "pprint"), "moved");
    J = T(sol.map((a, i) => (i === client ? Object.assign({}, a, { values: { mode: "dhcp" } }) : a)));
    assert.equal(real(J, "pfixed"), "dhcp", "on DHCP, with nothing to hand it out");
    J = T(sol.filter((a) => a.t !== "pcprinter"));
    assert.equal(real(J, "pprint"), "port", "the reception PC still printing to the old address"); onlyThese(J, ["pprint"], "only printing");
    assert.equal(B.act(J, { t: "print" }).facts.print, "fail", "its test page goes to the old address, and nothing prints");
    /* the guests' line: typed in at the end, a line above lets them through first */
    J = T(swap(sol, deny, deny.replace(/^35 /, "")));
    assert.equal(real(J, "pguest"), "late", "the deny after the permit"); onlyThese(J, ["pguest"], "the deny after the permit");
    J = T(dropAt(sol, at(sol, deny)));
    assert.equal(real(J, "pguest"), "open", "no line for the printers");
    J = T(swap(sol, deny, "35 deny ip " + G.net + w + " host " + p.printerIp));
    assert.equal(real(J, "pguest"), "host", "the printer, not its network");
    J = T(swap(sol, deny, "35 deny tcp " + G.net + w + " " + P.net + w + " eq 9100"));
    assert.equal(real(J, "pguest"), "some", "printing stopped, its web page and IPP not"); assert.match(line(J, "pguest").ev, /IPP \(631\)/);
    J = T(swap(sol, deny, "35 deny ip any any"));
    assert.ok(line(J, "pguest").ok, "the printers are kept off"); assert.equal(real(J, "still"), "guest", "and so is everything else: the visitor is offline");
    J = T(swap(dropAt(sol, at(sol, deny)), "ip access-list extended " + p.guestAcl, "no ip access-list extended " + p.guestAcl));
    assert.equal(real(J, "pguest"), "missing", "the list deleted: a missing list lets everything through");
    J = T(putAt(dropAt(sol, at(sol, deny)), at(sol, "ip access-list extended " + p.guestAcl), ["interface " + p.lanPort + "." + G.id, "no ip access-group " + p.guestAcl + " in", "exit"]));
    assert.equal(real(J, "pguest"), "applied", "the list taken off the guests' subinterface");
    /* ARP inspection on the printers' VLAN, as SB-J6 put it on the others: the printer's fixed address has no lease behind it */
    J = T(putAt(sol, at(sol, "interface gi0/3"), ["ip arp inspection vlan " + S.id + "," + G.id + "," + P.id]));
    assert.equal(real(J, "pprint"), "dai", "inspected: the printer dropped"); onlyThese(J, ["pprint"], "inspection on the printers' VLAN");
    J = T(putAt(sol, at(sol, "end"), ["interface gi0/24", "switchport trunk allowed vlan remove " + P.id]));
    assert.equal(real(J, "psub"), "uplink", "the trunk to the router not carrying it");
    J = T(dropAt(sol, at(sol, "copy running-config startup-config"), at(sol, "copy running-config startup-config") + 1));
    assert.equal(real(J, "swsaved"), "since", "the switch not saved"); assert.ok(line(J, "saved").ok);
    J = T(dropAt(sol, at(sol, "copy running-config startup-config", rtAt), at(sol, "copy running-config startup-config", rtAt) + 1));
    assert.equal(real(J, "saved"), "since", "the router not saved"); assert.ok(line(J, "swsaved").ok);
  }
});

test("SB-J8: other right ways pass: the list rebuilt, any source, a subinterface numbered its own way, the panel first, the closet switch's console", () => {
  for (const s of seeds.slice(0, 12)) {
    const J0 = B.open(def, s), p = J0.v.plan, P = p.vlans.printers, G = p.vlans.guest, sol = def.solve(J0.v, J0.sim), deny = "35 deny ip " + G.net + w + " " + P.net + w;
    let acts = putAt(dropAt(sol, at(sol, deny)), at(sol, "ip access-list extended " + p.guestAcl) + 1, ["no 40", "deny ip " + G.net + w + " " + P.net + w, "permit ip " + G.net + w + " any"]);
    onlyThese(tryIt(s, acts), [], "the last line taken out and put back after the deny, seed " + s);
    onlyThese(tryIt(s, swap(sol, deny, "35 deny ip any " + P.net + w)), [], "from any source, seed " + s);
    onlyThese(tryIt(s, swap(sol, "interface " + p.lanPort + "." + P.id, "interface gi0/1.7")), [], "a subinterface numbered its own way, seed " + s);
    const client = sol.find((a) => a.t === "client");
    onlyThese(tryIt(s, [client].concat(sol.filter((a) => a !== client))), [], "the printer's panel first, seed " + s);
    /* the closet switch at its console: the cabinet unlocked with the manager's key, your laptop carried back to the closet, locked again after */
    const t = (l) => ({ t: "cmd", dev: "tech", line: l, cli: true }), J = B.open(def, s), con = J.sim.cablesOf("tech").find((c) => c.kind === "console");
    const viaConsole = [{ t: "cabinet", values: { key: true } }, { t: "cabinet", values: { locked: false } }, { t: "cabinet", values: { open: true } },
      { t: "pull", cable: con.id }, { t: "place", dev: "tech", room: "closet" }, { t: "lay", a: { dev: "tech", port: "USB-C" }, b: { dev: "msw", port: "CONSOLE" } },
      t(""), t(p.swConsole), t("enable"), t(p.swSecret), t("configure terminal"), t("vlan " + P.id), t("name " + P.name), t("exit"), t("interface gi0/3"), t("switchport access vlan " + P.id), t("end"), t("copy running-config startup-config"), t("")];
    const rest = sol.slice(at(sol, "ssh " + p.user + "@" + p.vlans.staff.gw)), shut = [{ t: "cabinet", values: { open: false } }, { t: "cabinet", values: { locked: true } }, { t: "cabinet", values: { key: false } }];
    run(J, viaConsole.concat(rest, shut)); onlyThese(J, [], "the closet switch's console, the cabinet locked again, seed " + s);
    const K = tryIt(s, viaConsole.concat(rest));
    assert.equal(real(K, "still"), "rack", "the cabinet left open"); onlyThese(K, ["still"], "the cabinet left open");
  }
});

test("checking SB-J8 changes nothing, part done or done", () => {
  for (const s of seeds.slice(0, 6)) {
    const J = B.open(def, s), sol = def.solve(J.v, J.sim);
    for (const k of [0, 9, 20, 26, sol.length - 1, sol.length]) {
      const K = tryIt(s, sol.slice(0, k)), was = JSON.stringify([K.sim.net, K.sim.arp, K.sim.turns || {}]);
      for (const q of def.reqs) { B.evaluate(q, K.sim, K.v); q.rung1(K.v, K.sim); q.rung2(K.v, K.sim); q.ok(K.sim, K.v); }
      def.summary(K.v, K.sim); def.answer(K.v, K.sim); def.limits(K.v, K.sim);
      assert.equal(JSON.stringify([K.sim.net, K.sim.arp, K.sim.turns || {}]), was, "seed " + s + ", after " + k + " steps");
    }
  }
});

test("a named access list takes sequence numbers: a line put in by its number, one taken out by its number or its words, the others keeping theirs", () => {
  const r = newRouter({ mac: "00e0.4d12.3456" }), H = { L: { 0: 5, 3: 9 } }, S = session(r, { live: (k) => (k === "hits" ? H : null) }), x = (l) => (cliExec(S, l).out || []).join("\n");
  ["", "enable", "configure terminal", "ip access-list extended L", "permit udp any any eq bootps", "deny ip 10.1.40.0 0.0.0.255 10.1.10.0 0.0.0.255", "deny ip 10.1.40.0 0.0.0.255 192.168.10.0 0.0.0.255", "permit ip 10.1.40.0 0.0.0.255 any"].forEach(x);
  const seqs = () => x("do show access-lists").split("\n").slice(1).map((l) => +l.trim().split(" ")[0]);
  assert.deepEqual(seqs(), [10, 20, 30, 40]);
  assert.equal(x("35 deny ip 10.1.40.0 0.0.0.255 10.1.50.0 0.0.0.255"), "");
  assert.deepEqual(seqs(), [10, 20, 30, 35, 40]); assert.match(x("do show access-lists"), /35 deny ip 10\.1\.40\.0 0\.0\.0\.255 10\.1\.50\.0 0\.0\.0\.255\n\s+40 permit/);
  assert.deepEqual(H.L, { 0: 5, 4: 9 }, "the last line's matches stay with it");
  assert.equal(x("35 permit ip any any"), "% Duplicate sequence number");
  assert.match(x("?"), /<1-2147483647>\s+Sequence Number/); assert.equal(complete(S, "3"), "3", "Tab leaves a number as typed");
  x("no 10"); assert.deepEqual(seqs(), [20, 30, 35, 40], "the others keep their numbers"); assert.deepEqual(H.L, { 3: 9 });
  x("de ip any host 8.8.8.8"); assert.deepEqual(seqs(), [20, 30, 35, 40, 50], "a line with no number goes at the end, ten on");
  x("no deny ip any host 8.8.8.8"); assert.deepEqual(seqs(), [20, 30, 35, 40], "taken out by its words");
  assert.match(x("no 999"), /^$/, "a number not in the list: nothing happens");
  x("end"); const cfg = x("show running-config"); assert.match(cfg, /ip access-list extended L\n deny ip 10\.1\.40\.0 0\.0\.0\.255 10\.1\.10\.0 0\.0\.0\.255\n/, "the configuration lists the lines in order, without their numbers");
  assert.equal(x("show access-lists").split("\n")[1].trim().split(" ")[0], "20");
  /* a list whose numbers were never fixed by an insert: a line taken out still leaves the others theirs */
  ["configure terminal", "ip access-list standard M", "permit 10.0.0.0 0.0.0.255", "permit 10.0.1.0 0.0.0.255", "permit 10.0.2.0 0.0.0.255", "no 20", "end"].forEach(x);
  assert.deepEqual(x("show access-lists M").split("\n").slice(1).map((l) => +l.trim().split(" ")[0]), [10, 30], "taken out, the last line keeps 30");
});

test("SSH crosses the business router, judged by its access lists as TCP port 22; ping and SSH are told apart", () => {
  for (const s of seeds.slice(0, 6)) {
    const J = B.open(def, s), p = J.v.plan, sim = J.sim;
    let o = exec(sim, "bpc", "ssh " + p.user + "@" + p.swIp); assert.ok(o.facts.ok, "the back PC to the closet switch, across the router: " + o.out);
    [p.userPw, "enable", p.swSecret].forEach((l) => exec(sim, "bpc", l)); assert.match(exec(sim, "bpc", "show vlan brief").out, /PARKING/, "logged in, privileged, on the closet switch"); exec(sim, "bpc", "exit");
    /* an access list in on the staff subinterface stopping SSH to the switch, nothing else */
    const m = (l) => exec(sim, "mgr", l);
    [ "ssh " + p.user + "@" + p.vlans.staff.gw, p.userPw, "enable", p.rtSecret, "configure terminal", "ip access-list extended NO-SSH", "deny tcp any host " + p.swIp + " eq 22", "permit ip any any", "exit",
      "interface " + p.lanPort + "." + p.vlans.staff.id, "ip access-group NO-SSH in", "end", "exit"].forEach(m);
    o = exec(sim, "pc", "ssh " + p.user + "@" + p.swIp); assert.equal(o.facts.why, "timeout", "stopped by the list: " + o.out);
    assert.match(exec(sim, "pc", "ping " + p.swIp).out, /Reply from/, "ping still gets through");
  }
});
