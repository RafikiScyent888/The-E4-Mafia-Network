/* Level 3, SB-J10: a new department, end to end. Each business is SB-J9 done (you took your laptop and its cables home), then the
   department's records: its room off the back room, its VLAN from the business's VLAN set, a /26, /27 or /28 block given in CIDR
   only, its two PCs in their boxes, the manager's address to keep. Worked through the real command lines as the work order's
   solution (over SSH from the manager's PC to the closet switch and the router, then the back switch at its console), with one
   thing left out or done the tempting wrong way; each must fail its own line for its own cause. The other right ways pass.
   Also here: the router's manual bindings (a reservation), new with SB-J10. */
import test from "node:test";
import assert from "node:assert/strict";
import { BUSINESS_JOBS } from "../js/build/business.js";
import * as B from "../js/build/engine.js";
import { newRouter, clientIdOf, dotHex, manualFor } from "../js/net/rtcli.js";
import { session, exec as cliExec, configText } from "../js/net/swcli.js";

const def = BUSINESS_JOBS.find((d) => d.id === "SB-J10");
const N = Math.min(25, Number(process.env.SEEDS || 25));
const seeds = Array.from({ length: N }, (_, i) => 10100 + i * 7919);
const line = (J, id) => B.evaluate(J.def.reqs.find((q) => q.id === id), J.sim, J.v);
const real = (J, id) => { const c = line(J, id); return c.ok ? "met" : c.real.id; };
const run = (J, acts) => { for (const a of acts) { const r = B.act(J, a); assert.notEqual(r && r.result && r.result.ok, false, "refused: " + JSON.stringify(a) + " " + JSON.stringify(r && r.result)); } };
const tryIt = (s, acts) => { const J = B.open(def, s); run(J, acts); return J; };
const isCmd = (a, l) => a.t === "cmd" && a.line === l;
/* lines that come twice (configure terminal, end, the save) are found from a line that comes once */
const at = (acts, l, from) => { const i = acts.findIndex((a, k) => k >= (from || 0) && isCmd(a, l)); assert.ok(i >= 0, "no " + l); return i; };
const swap = (acts, l, to) => acts.map((a) => (isCmd(a, l) ? Object.assign({}, a, { line: to }) : a));
const swapAt = (acts, i, to) => acts.map((a, k) => (k === i ? Object.assign({}, a, { line: to }) : a));
const dropAt = (acts, ...ix) => acts.filter((a, i) => ix.indexOf(i) < 0);
const putAt = (acts, i, more) => acts.slice(0, i).concat(more.map((x) => Object.assign({}, acts[i - 1], { line: x })), acts.slice(i));
const onlyThese = (J, bad, why) => { for (const r of B.check(J).res) if (bad.indexOf(r.id) < 0) assert.ok(r.ok, why + ": " + r.id + " should be met: " + r.ev); };
const reach = (J, from, to, proto) => { const r = J.sim.route(from, to, proto); return !!((r.local || r.routed) && !r.fail && r.owner && r.owner.length); };
const w = " 0.0.0.255";

test("SB-J10 as found: the department's records worked out, its PCs in their boxes, every line to do for the real reason; solved, only the manager let in", () => {
  const blocks = new Set(), rooms = new Set();
  for (const s of seeds) {
    const J = B.open(def, s), p = J.v.plan, D = p.vlans.dept, S = p.vlans.staff, sim = J.sim;
    assert.deepEqual(["dplace", "dvlan", "dport", "dpsec", "dsub", "dpool", "dnet", "dguard", "mgrip", "dapart", "still", "saved", "swsaved", "bswsaved"].map((id) => real(J, id)),
      ["box", "bnone", "shut", "off", "none", "none", "noaddr", "snoop", "none", "nosub", "met", "met", "met", "met"], "seed " + s);
    /* the block: a /26, /27 or /28 inside 10.<site>.<vlan>.0, never its first block; the gateway its first usable address */
    const size = Math.pow(2, 32 - D.len), base = +D.net.split(".")[3];
    assert.ok([26, 27, 28].indexOf(D.len) >= 0 && base % size === 0 && base > 0 && base + size <= 256, "the block: " + JSON.stringify(D));
    assert.equal(D.net.split(".").slice(0, 3).join("."), "10." + S.net.split(".")[1] + "." + D.id, "inside 10.<site>.<vlan>.0");
    assert.deepEqual([D.gw, D.first, D.last, D.bcast].map((x) => +x.split(".")[3]), [base + 1, base + 2, base + size - 2, base + size - 1]);
    assert.equal(D.mask, "255.255.255." + (256 - size)); assert.equal(D.wild, "0.0.0." + (size - 1));
    assert.ok(Object.values(p.vlans).filter((x) => x.id === D.id).length === 1, "a VLAN number of its own");
    blocks.add(D.len); rooms.add(sim.net.roomNames.dept);
    /* the manager's address: one of the staff network's kept-back ten, nothing there now */
    assert.ok([7, 8, 9].indexOf(+p.mgrIp.split(".")[3]) >= 0 && p.mgrIp.startsWith(S.net.replace(/\.0$/, ".")), p.mgrIp);
    assert.deepEqual(sim.owners(p.mgrIp, sim.domain(sim.homeNode("mgr"))), [], "nothing at the manager's address yet");
    /* the PCs in their boxes in the back room; your laptop with no cables */
    for (const id of ["dpc1", "dpc2"]) { assert.ok(sim.d[id].boxed && sim.net.rooms[id] === "back" && sim.d[id].kind === "pc"); }
    assert.deepEqual(sim.cablesOf("tech"), [], "your laptop's cables went home with you");
    assert.equal(sim.net.cables.filter((c) => c.a.dev === "tech" || c.b.dev === "tech").length, 0);
    const K = tryIt(s, def.solve(J.v, J.sim));
    onlyThese(K, [], "the solution, seed " + s);
    const a1 = K.sim.addr("dpc1"), a2 = K.sim.addr("dpc2"), m = K.sim.addr("mgr");
    assert.ok([a1, a2].every((a) => a.kind === "dhcp" && a.mask === D.mask && a.gw === D.gw && +a.ip.split(".")[3] > base + 1 && +a.ip.split(".")[3] < base + size - 1), "both PCs inside the block: " + JSON.stringify([a1, a2]));
    assert.equal(m.ip, p.mgrIp, "the manager's PC at its reserved address"); assert.ok(K.sim.d.rtr.leases.some((l) => l.ip === p.mgrIp && l.manual), "a manual binding");
    for (const way of [{ proto: "tcp", port: 445, sport: 50000 }, { proto: "tcp", port: 3389, sport: 50000 }, undefined]) {
      assert.ok(reach(K, "mgr", a1.ip, way), "the manager reaches the department: " + JSON.stringify(way));
      assert.ok(!reach(K, "pc", a1.ip, way) && !reach(K, "bpc", a2.ip, way), "the rest of the staff don't: " + JSON.stringify(way));
      assert.ok(!reach(K, "guest", a2.ip, way), "nor do the guests: " + JSON.stringify(way));
    }
  }
  assert.equal(blocks.size, 3, "all three sizes of block come up"); assert.ok(rooms.size >= 4, "each business its own department: " + [...rooms]);
});

test("SB-J10: the router's manual bindings: host, client-identifier, hardware-address, as on the real thing", () => {
  const r = newRouter(), S = session(r), say = (l) => cliExec(S, l).out;
  ["", "enable", "configure terminal", "interface gi0/1", "ip address 10.5.20.1 255.255.255.0", "no shutdown", "exit", "ip dhcp pool STAFF", "network 10.5.20.0 255.255.255.0", "default-router 10.5.20.1", "dns-server 203.0.113.53", "exit"].forEach(say);
  say("ip dhcp pool MGR");
  assert.deepEqual(say("host 10.5.20.0 255.255.255.0"), ["% 10.5.20.0 is not a host address with mask 255.255.255.0"], "a network address is no host");
  assert.deepEqual(say("client-identifier 01aa-bbcc-ddee-ff"), ["% Invalid input detected at '^' marker."], "Windows' dashes aren't dotted hex");
  assert.deepEqual(say("client-identifier 1aa.bbcc.ddee.ff"), ["% Invalid input detected at '^' marker."], "an odd number of digits");
  assert.deepEqual(say("host 10.5.20.8"), []); assert.equal(r.pools.MGR.hostMask, "255.0.0.0", "no mask given: the address's class mask");
  assert.deepEqual(say("host 10.5.20.8 /24"), []); assert.equal(r.pools.MGR.hostMask, "255.255.255.0");
  assert.deepEqual(say("client-identifier 01AA.BBCC.DDEE.FF"), []); assert.equal(r.pools.MGR.clientId, "01aabbccddeeff");
  assert.deepEqual(say("network 10.5.20.0 255.255.255.0"), ["% This pool binds a host: a network needs a pool of its own"]);
  say("exit"); say("ip dhcp pool STAFF"); assert.deepEqual(say("host 10.5.20.9 255.255.255.0"), ["% This pool hands out a network: a host binding needs a pool of its own"]); say("exit");
  const text = configText(r, "running");
  assert.ok(/ip dhcp pool MGR\n host 10\.5\.20\.8 255\.255\.255\.0\n client-identifier 01aa\.bbcc\.ddee\.ff\n!/.test(text), "its lines in the running configuration:\n" + text);
  /* matched on the client identifier a client sends (01, then its MAC); what it doesn't set comes from the network pool it falls in */
  assert.equal(clientIdOf("AA:BB:CC:DD:EE:FF"), "01aabbccddeeff"); assert.equal(dotHex("01aabbccddeeff"), "01aa.bbcc.ddee.ff");
  const M = manualFor(r, "01aabbccddeeff", "10.5.20.1", "255.255.255.0");
  assert.deepEqual([M.host, M.mask, M.router, M.dns, M.manual], ["10.5.20.8", "255.255.255.0", ["10.5.20.1"], ["203.0.113.53"], true]);
  assert.equal(manualFor(r, "aabbccddeeff", "10.5.20.1", "255.255.255.0"), null, "the MAC alone isn't what the client sends");
  assert.equal(manualFor(r, "01aabbccddeeff", "10.9.9.1", "255.255.255.0"), null, "only on the interface whose network it's on");
  say("ip dhcp pool MGR"); say("no client-identifier"); say("hardware-address aabb.ccdd.eeff");
  assert.equal(manualFor(r, "01aabbccddeeff", "10.5.20.1", "255.255.255.0"), null, "a hardware-address binding is for clients that send no client identifier");
  say("host 10.5.20.8"); say("client-identifier 01aa.bbcc.ddee.ff");
  const W = manualFor(r, "01aabbccddeeff", "10.5.20.1", "255.255.255.0");
  assert.deepEqual([W.mask, W.router, W.dns], ["255.0.0.0", [], []], "a class mask wider than the network pool's: nothing to inherit");
  say("no host"); say("no client-identifier"); say("no hardware-address"); assert.deepEqual([r.pools.MGR.host, r.pools.MGR.clientId, r.pools.MGR.hw], [null, null, null]);
});

test("SB-J10: show ip dhcp binding lists each client by the client ID it sent, a reservation as Manual", () => {
  const s = seeds[0], K = tryIt(s, def.solve(B.open(def, s).v, B.open(def, s).sim)), p = K.v.plan;
  run(K, [{ t: "pull", cable: K.sim.cablesOf("tech").find((c) => c.kind === "console").id }, { t: "place", dev: "tech", room: "closet" }, { t: "cabinet", values: { key: true } }, { t: "cabinet", values: { locked: false } }, { t: "cabinet", values: { open: true } },
    { t: "lay", a: { dev: "tech", port: "USB-C" }, b: { dev: "rtr", port: "CONSOLE" } }]);
  for (const l of ["", p.rtConsole, "enable", p.rtSecret]) B.act(K, { t: "cmd", dev: "tech", line: l, cli: true });
  const lines = [].concat(B.act(K, { t: "cmd", dev: "tech", line: "show ip dhcp binding", cli: true }).out).join("\n").split("\n");
  const mine = dotHex(clientIdOf(K.sim.d.mgr.ifaces[0].mac));
  assert.ok(lines.some((l) => l.startsWith(p.mgrIp) && l.includes(mine) && /Infinite\s+Manual$/.test(l)), "the manager's PC, by its client ID, Manual:\n" + lines.join("\n"));
  assert.ok(lines.filter((l) => / Automatic$/.test(l)).every((l) => /\s01[0-9a-f]{2}\.[0-9a-f]{4}\.[0-9a-f]{4}\.[0-9a-f]{2}\s/.test(l)), "every client by 01 and its MAC");
});

test("SB-J10: the tempting wrong ways fail their own line, and what they break", () => {
  for (const s of seeds.slice(0, 12)) {
    const J0 = B.open(def, s), p = J0.v.plan, D = p.vlans.dept, S = p.vlans.staff, G = p.vlans.guest, T = p.trunk, dp = p.dept, sol = def.solve(J0.v, J0.sim), X = (acts) => tryIt(s, acts);
    const back = at(sol, "configure terminal", sol.findIndex((a) => a.t === "lay" && a.a.dev === "tech")), rt = at(sol, "ssh " + p.user + "@" + S.gw);
    const mac = J0.sim.d.mgr.ifaces[0].mac, hex = String(mac).replace(/[^0-9a-f]/gi, "").toLowerCase(), cid = "client-identifier " + dotHex(clientIdOf(mac));
    const addD = "switchport trunk allowed vlan add " + D.id, list = ["permit ip host " + p.mgrIp + " " + D.net + " " + D.wild, "deny ip " + S.net + w + " " + D.net + " " + D.wild, "deny ip " + G.net + w + " " + D.net + " " + D.wild, "permit ip any any"];
    const renews = sol.map((a, i) => (a.t === "cmd" && a.line === "ipconfig /renew" ? i : -1)).filter((i) => i >= 0);
    /* the back switch's trunk given only the department's VLAN: the list replaced, the back of house cut off */
    let J = X(swapAt(sol, at(sol, addD, back), "switchport trunk allowed vlan " + D.id));
    assert.equal(real(J, "dvlan"), "replaced", "replaced, not added to"); assert.equal(real(J, "still"), "net", "the back PC cut off");
    /* the VLAN never made on the closet switch: nothing of it crosses the trunk */
    J = X(dropAt(sol, at(sol, "vlan " + D.id), at(sol, "name " + D.name), at(sol, "exit", at(sol, "name " + D.name))));
    assert.equal(real(J, "dvlan"), "cnone", "not on the closet switch"); assert.equal(real(J, "dnet"), "noaddr", "no address for the PCs");
    /* the VLAN made on the back switch by putting the ports in it: named after its number */
    J = X(dropAt(sol, at(sol, "vlan " + D.id, back), at(sol, "name " + D.name, back), at(sol, "exit", at(sol, "name " + D.name, back))));
    assert.equal(real(J, "dvlan"), "bname", "made by the ports"); onlyThese(J, ["dvlan"], "only its name");
    /* the subinterface given the /24 every other VLAN has */
    J = X(swap(sol, "ip address " + D.gw + " " + D.mask, "ip address " + D.gw + " 255.255.255.0"));
    assert.equal(real(J, "dsub"), "wide", "the habit's /24"); assert.equal(real(J, "dpool"), "nomatch", "the pool answers nobody"); assert.equal(real(J, "dnet"), "noaddr");
    /* the gateway at the block's last usable address */
    J = X(swap(swap(sol, "ip address " + D.gw + " " + D.mask, "ip address " + D.last + " " + D.mask), "default-router " + D.gw, "default-router " + D.last));
    assert.equal(real(J, "dsub"), "last", "the last, not the first"); assert.equal(real(J, "dpool"), "router");
    /* the block's network or broadcast address as the gateway: refused, with the block's mask */
    J = B.open(def, s); run(J, sol.slice(0, at(sol, "ip address " + D.gw + " " + D.mask)));
    for (const ip of [D.net, D.bcast]) assert.match([].concat(B.act(J, { t: "cmd", dev: "mgr", line: "ip address " + ip + " " + D.mask }).out).join("\n"), new RegExp("Bad mask /" + D.len + " for address " + ip.replace(/\./g, "\\.")), "refused: " + ip);
    /* the pool for the whole /24 */
    J = X(swap(sol, "network " + D.net + " " + D.mask, "network " + D.net.replace(/\.\d+$/, ".0") + " 255.255.255.0"));
    assert.equal(real(J, "dpool"), "wide", "a whole /24"); assert.equal(real(J, "dnet"), "noaddr");
    /* the habit's gateway, .1 */
    J = X(swap(sol, "default-router " + D.gw, "default-router " + D.net.replace(/\.\d+$/, ".1")));
    assert.equal(real(J, "dpool"), "router", "the habit's .1"); assert.equal(real(J, "dnet"), "gw", "the PCs handed it");
    /* no line in NAT's list; the mask where the wildcard goes */
    J = X(dropAt(sol, at(sol, "access-list 1 permit " + D.net + " " + D.wild)));
    assert.equal(real(J, "dnet"), "natlist", "NAT's list never names the block");
    J = X(swap(sol, "access-list 1 permit " + D.net + " " + D.wild, "access-list 1 permit " + D.net + " " + D.mask));
    assert.equal(real(J, "dnet"), "natmask", "the mask for the wildcard");
    /* no ip nat inside on the subinterface */
    J = X(dropAt(sol, at(sol, "ip nat inside", rt)));
    assert.equal(real(J, "dnet"), "natin", "not NAT's inside");
    /* the department's list with nothing at the end to let the rest through */
    J = X(dropAt(sol, at(sol, "permit ip any any", rt)));
    assert.equal(real(J, "dnet"), "reply", "the deny you never see"); assert.equal(real(J, "dapart"), "met", "it still keeps everyone else off");
    /* the staff denied above the manager's line */
    J = X(swap(swap(sol, list[0], "ZZ"), list[1], list[0]).map((a) => (isCmd(a, "ZZ") ? Object.assign({}, a, { line: list[1] }) : a)));
    assert.equal(real(J, "dapart"), "late", "the first line that matches decides");
    /* the list applied in, not out */
    J = X(swap(sol, "ip access-group " + dp.acl + " out", "ip access-group " + dp.acl + " in"));
    assert.equal(real(J, "dapart"), "dir", "in reads what the department sends");
    /* no list applied at all; the list under another name */
    J = X(dropAt(sol, at(sol, "ip access-group " + dp.acl + " out")));
    assert.equal(real(J, "dapart"), "none", "nothing applied");
    J = X(swap(sol, "ip access-group " + dp.acl + " out", "ip access-group " + dp.acl + "X out"));
    assert.equal(real(J, "dapart"), "missing", "a list that doesn't exist lets everything through");
    /* guests left out of the list */
    J = X(dropAt(sol, at(sol, list[2])));
    assert.equal(real(J, "dapart"), "guest", "guests let in");
    /* the PCs' own addresses, not the block */
    const a1 = tryIt(s, sol).sim.addr("dpc1").ip, a2 = tryIt(s, sol).sim.addr("dpc2").ip;
    J = X(dropAt(sol, at(sol, list[1]), at(sol, list[2])).flatMap((a) => (isCmd(a, list[3]) && a.dev === "mgr" ? [a1, a2].flatMap((ip) => ["deny ip " + S.net + w + " host " + ip, "deny ip " + G.net + w + " host " + ip]).concat(list[3]).map((l) => Object.assign({}, a, { line: l })) : [a])));
    assert.equal(real(J, "dapart"), "host", "these two PCs, not the department's network");
    /* the reservation by hardware address; the MAC alone as the client identifier; no mask */
    J = X(swap(sol, cid, "hardware-address " + dotHex(hex)));
    assert.equal(real(J, "mgrip"), "hw", "a hardware-address binding"); assert.equal(real(J, "dapart"), "mgraddr", "the list names an address the manager isn't at");
    J = X(swap(sol, cid, "client-identifier " + dotHex(hex)));
    assert.equal(real(J, "mgrip"), "no01", "the MAC alone");
    J = X(swap(sol, "host " + p.mgrIp + " " + p.vmask, "host " + p.mgrIp));
    assert.equal(real(J, "mgrip"), "mask", "the class mask"); assert.ok(line(J, "mgrip").real.text.includes("class mask")); assert.equal(J.sim.addr("mgr").mask, "255.0.0.0"); assert.equal(real(J, "still"), "net", "the manager's PC offline");
    /* the manager's PC never asks again; set by hand instead of reserved */
    J = X(dropAt(sol, renews[0]));
    assert.equal(real(J, "mgrip"), "renew", "a reservation waits for the PC to ask"); assert.equal(real(J, "dapart"), "mgraddr");
    J = X(sol.filter((a, i) => !(a.t === "cmd" && a.dev === "mgr" && i >= at(sol, "ip dhcp pool MANAGER-PC") && i <= at(sol, cid) + 1) && i !== renews[0]).concat([{ t: "client", dev: "mgr", values: { mode: "static", ip: p.mgrIp, mask: p.vmask, gw: S.gw, dns: p.dns } }]));
    assert.equal(real(J, "mgrip"), "staticdai", "ARP inspection has no lease to check it against"); assert.equal(real(J, "still"), "net", "the manager's PC offline");
    /* no port security; the ports left parked; left shut; not described */
    const ra = at(sol, "interface range gi0/" + dp.ports[0] + " - " + dp.ports[1]);
    J = X(dropAt(sol, at(sol, "switchport port-security", ra), at(sol, "switchport port-security mac-address sticky", ra)));
    assert.equal(real(J, "dpsec"), "off", "no port security"); onlyThese(J, ["dpsec"], "only port security");
    J = X(dropAt(sol, at(sol, "switchport access vlan " + D.id, ra)));
    assert.equal(real(J, "dport"), "park", "still in the parking VLAN"); assert.equal(real(J, "dnet"), "noaddr");
    J = X(dropAt(sol, at(sol, "no shutdown", ra)));
    assert.equal(real(J, "dport"), "shut", "left shut");
    J = X(dropAt(sol, at(sol, "description " + dp.desc[0]), at(sol, "description " + dp.desc[1])));
    assert.equal(real(J, "dport"), "desc", "no descriptions"); onlyThese(J, ["dport"], "only the descriptions");
    /* a PC on a back switch port the records don't give it; a PC cabled to the closet switch, through the cabinet opened and locked again */
    J = X(sol.map((a) => (a.t === "lay" && a.b.dev === "bsw" && a.a.dev === "dpc1" ? { t: "lay", a: a.a, b: { dev: "bsw", port: "5" } } : a)));
    assert.equal(real(J, "dplace"), "port", "a port the records don't give it");
    const cab = (v) => ({ t: "cabinet", values: v });
    J = X(sol.flatMap((a) => (a.t === "lay" && a.b.dev === "bsw" && a.a.dev === "dpc1" ? [cab({ key: true }), cab({ locked: false }), cab({ open: true }), { t: "lay", a: a.a, b: { dev: "msw", port: "4" } }, cab({ open: false }), cab({ locked: true }), cab({ key: false })] : [a])));
    assert.equal(real(J, "dplace"), "where", "to the closet switch");
    /* left in the back room */
    J = X(sol.filter((a) => !(a.t === "place" && a.dev === "dpc2") && !(a.t === "lay" && a.a.dev === "dpc2")));
    assert.equal(real(J, "dplace"), "box", "still in its box");
    /* snooping not added; nor inspection; inspection without snooping */
    J = X(dropAt(sol, at(sol, "ip dhcp snooping vlan " + D.id), at(sol, "ip arp inspection vlan " + D.id)));
    assert.equal(real(J, "dguard"), "snoop", "no guards on the new VLAN"); onlyThese(J, ["dguard"], "only the guards");
    J = X(dropAt(sol, at(sol, "ip dhcp snooping vlan " + D.id)));
    assert.equal(real(J, "dguard"), "snoop"); assert.equal(real(J, "dnet"), "blind", "inspected where nothing's snooped");
    /* the ports opened before the guards, and the PCs never asked again: their leases are from before snooping */
    const g1 = at(sol, "ip dhcp snooping vlan " + D.id), g2 = at(sol, "ip arp inspection vlan " + D.id), tail = at(sol, "end", ra);
    const early = dropAt(sol, g1, g2, renews[1], renews[2]); const e2 = putAt(early, early.findIndex((a, i) => i > ra && isCmd(a, "end")) + 1, ["configure terminal", "ip dhcp snooping vlan " + D.id, "ip arp inspection vlan " + D.id, "end"]); void tail;
    J = X(e2);
    assert.equal(real(J, "dnet"), "old", "a lease from before snooping"); assert.equal(real(J, "dguard"), "met");
    /* not saved */
    J = X(dropAt(sol, at(sol, "copy running-config startup-config", back)));
    assert.equal(real(J, "bswsaved"), "since"); assert.equal(real(J, "saved"), "met");
  }
});

test("SB-J10: other right ways pass: the list in the other direction, guests kept off by their own list, the reservation by prefix, NAT for the whole site", () => {
  for (const s of seeds.slice(0, 8)) {
    const J0 = B.open(def, s), p = J0.v.plan, D = p.vlans.dept, S = p.vlans.staff, G = p.vlans.guest, dp = p.dept, sol = def.solve(J0.v, J0.sim);
    const list = ["permit ip host " + p.mgrIp + " " + D.net + " " + D.wild, "deny ip " + S.net + w + " " + D.net + " " + D.wild, "deny ip " + G.net + w + " " + D.net + " " + D.wild, "permit ip any any"];
    /* in on the department's subinterface, judging what the department sends back */
    let acts = swap(sol, "ip access-group " + dp.acl + " out", "ip access-group " + dp.acl + " in");
    acts = swap(swap(swap(acts, list[0], "permit ip " + D.net + " " + D.wild + " host " + p.mgrIp), list[1], "deny ip " + D.net + " " + D.wild + " " + S.net + w), list[2], "deny ip " + D.net + " " + D.wild + " " + G.net + w);
    onlyThese(tryIt(s, acts), [], "the list in, seed " + s);
    /* guests kept off by a line in their own list, ahead of the line that lets them out */
    const gi = at(sol, list[2]), extra = ["exit", "ip access-list extended " + p.guestAcl, "36 deny ip " + G.net + w + " " + D.net + " " + D.wild];
    acts = dropAt(sol, gi); acts = putAt(acts, at(acts, list[3]) + 1, extra);
    onlyThese(tryIt(s, acts), [], "guests in their own list, seed " + s);
    /* the reservation's mask as a prefix; NAT's line for every 10. network of the site; the ports one at a time */
    acts = swap(sol, "host " + p.mgrIp + " " + p.vmask, "host " + p.mgrIp + " /24");
    acts = swap(acts, "access-list 1 permit " + D.net + " " + D.wild, "access-list 1 permit 10." + S.net.split(".")[1] + ".0.0 0.0.255.255");
    onlyThese(tryIt(s, acts), [], "prefix and a site-wide NAT line, seed " + s);
    /* snooping and inspection on the closet switch too, the way to the router already trusted there */
    const cl = at(sol, "switchport trunk allowed vlan add " + D.id);
    acts = putAt(sol, cl + 1, ["exit", "ip dhcp snooping vlan " + D.id, "ip arp inspection vlan " + D.id, "interface gi0/" + p.trunk.closet]);
    onlyThese(tryIt(s, acts), [], "guards on both switches, seed " + s);
  }
});
