/* Level 4, the campus: the gateways moved off the edge router onto distribution switch 1 (router-on-a-stick retired), done by
   hand on many campuses. Distribution switch 1 routes, each VLAN's gateway its own interface there; a routed link to the edge
   router (a /30); a default route one way and the campus's block the other; DHCP relayed to the edge router's pools. What the
   PCs reach, through both, and what breaks for its own reason when a piece is missing. */
import test from "node:test";
import assert from "node:assert/strict";
import { makeCampus } from "../js/net/campus.js";
import { Sim } from "../js/net/sim.js";
import * as C from "../js/net/swcli.js";

const PCS = ["sd1", "hd1", "bn1", "bn2", "mgr", "fin"];
const seeds = Array.from({ length: 8 }, (_, i) => 5000 + i * 7919);
/* a console session already in privileged mode: what's typed goes straight in */
function conf(sim, id, lines) {
  const before = sim.links(); if (sim.d[id].kind === "mswitch") sim.syncSwitch(id);
  const S = C.session(sim.d[id].sw, sim.d[id].kind === "mswitch" ? { live: sim.swLive(id) } : {}); S.mode = "priv"; S.fresh = false; S.pending = null;
  const out = ["configure terminal"].concat(lines, ["end"]).map((l) => C.exec(S, l).out).flat();
  if (sim.d[id].kind === "mswitch") sim.syncSwitch(id); sim.relink(before); return out;
}
const b = (p) => p.vlans.svc.net.split(".")[1];
const T = (p) => ({ net: "10." + b(p) + ".255.0", edge: "10." + b(p) + ".255.1", dist: "10." + b(p) + ".255.2", mask: "255.255.255.252" });
const USED = ["svc", "bench", "office", "servers", "printers", "mgmt"], DHCP = ["svc", "bench", "office"];
/* the cut-over, piece by piece, so a test can leave one out */
const PARTS = {
  svis: (p) => ["ip routing"].concat(USED.flatMap((k) => ["interface vlan " + p.vlans[k].id, "ip address " + p.vlans[k].gw + " " + p.mask, "no shutdown", "exit"])),
  helpers: (p) => DHCP.flatMap((k) => ["interface vlan " + p.vlans[k].id, "ip helper-address " + T(p).edge, "exit"]),
  link: (p) => ["interface gi0/24", "no switchport", "ip address " + T(p).dist + " " + T(p).mask, "no shutdown", "exit"],
  def: (p) => ["ip route 0.0.0.0 0.0.0.0 " + T(p).edge],
  ros: (p) => USED.map((k) => "no interface " + p.edge.lan + "." + p.vlans[k].id),
  edgeIf: (p) => ["interface " + p.edge.lan, "ip address " + T(p).edge + " " + T(p).mask, "ip nat inside", "no shutdown", "exit"],
  back: (p) => ["ip route 10." + b(p) + ".0.0 255.255.0.0 " + T(p).dist]
};
function moved(seed, leave) {
  const net = makeCampus(seed), sim = new Sim(net); sim.boot(PCS); const p = net.plan, L = leave || [];
  const want = (k) => L.indexOf(k) < 0 ? PARTS[k](p) : [];
  conf(sim, "edge", want("ros").concat(want("edgeIf"), want("back")));
  conf(sim, "dist1", want("svis").concat(want("helpers"), want("link"), want("def")));
  return { sim, p };
}
const online = (sim, id) => !!sim.route(id, "8.8.8.8").internet;
const renew = (sim, id) => { sim.release(id); return sim.dhcp(id, "renew"); };

test("before the move, the edge router is every VLAN's gateway: the internet one hop away", () => {
  for (const s of seeds.slice(0, 3)) { const net = makeCampus(s), sim = new Sim(net); sim.boot(PCS); const r = sim.route("sd1", "8.8.8.8"); assert.equal(r.internet, true); assert.equal(r.via, "edge"); }
});

test("moved: every PC online through distribution switch 1 and the edge router, two routers crossed; printers and switches answer", () => {
  for (const s of seeds) {
    const { sim, p } = moved(s);
    for (const id of PCS) { const r = sim.route(id, "8.8.8.8"); assert.equal(r.internet, true, s + " " + id + " " + JSON.stringify(r)); assert.equal(r.hops[0], sim.addr(id).gw, s + " " + id + " first hop its gateway, distribution switch 1"); assert.equal(r.hops[1], T(p).edge, s + " then the edge router"); assert.equal(r.routers, 2, s + " two routers"); }
    for (const pr of ["pr1", "pr3"]) assert.ok(sim.route("bn1", p.printers[pr]).routed, s + " " + pr);
    for (const id of ["dist1", "dist2", "acc1", "acc2", "acc3"]) { const at = id === "dist1" ? p.vlans.mgmt.gw : p.sw[id].ip, r = sim.route("sd1", at); assert.ok(r.routed || r.local, s + " " + id + " " + JSON.stringify(r)); }   /* distribution switch 1 now answers at the management VLAN's gateway */
    assert.ok(sim.route("sd1", T(p).edge).routed, s + " the edge router's own address across the link");
    assert.ok(sim.route("edge", sim.addr("mgr").ip).routed, s + " the edge router reaches a PC, through distribution switch 1");
  }
});

test("DHCP relayed: a PC that asks again gets its address from the edge router's pool for its own VLAN, through distribution switch 1", () => {
  for (const s of seeds) {
    const { sim, p } = moved(s);
    for (const [id, k] of [["sd1", "svc"], ["bn2", "bench"], ["fin", "office"]]) {
      const r = renew(sim, id), a = sim.addr(id);
      assert.equal(r.result, "lease", s + " " + id + " " + JSON.stringify(r)); assert.match(r.server, /^edge@relay\|dist1\|Vlan/, s + " relayed");
      assert.equal(a.ip.split(".").slice(0, 3).join("."), p.vlans[k].net.split(".").slice(0, 3).join("."), s + " " + id + " in its VLAN's network"); assert.equal(a.gw, p.vlans[k].gw);
      assert.equal(sim.d[id].ifaces[0].lease.server, T(p).edge, s + " the DHCP server is the edge router's address"); assert.ok(online(sim, id), s + " " + id + " online again");
    }
  }
});

test("each piece left out breaks what it should, for its own reason", () => {
  for (const s of seeds.slice(0, 4)) {
    let { sim, p } = moved(s, ["helpers"]);
    assert.ok(online(sim, "sd1"), s + " no relay: the PCs keep their leases for now"); assert.equal(renew(sim, "sd1").result, "timeout", s + " no relay: nobody answers a PC that asks again");
    ({ sim, p } = moved(s, ["back"]));
    let r = sim.route("sd1", "8.8.8.8"); assert.equal(r.internet, undefined, s + " no route back"); assert.equal(r.why, "no way back", s + " " + JSON.stringify(r));
    assert.equal(renew(sim, "hd1").result, "timeout", s + " no route back: the offer can't get back to the relay");
    ({ sim, p } = moved(s, ["def"]));
    r = sim.route("sd1", "8.8.8.8"); assert.equal(r.fail, "net-unreachable", s + " no default route on distribution switch 1"); assert.equal(r.why, "no-route");
    ({ sim, p } = moved(s, ["ros", "edgeIf", "back", "link", "def"]));
    const g = p.vlans.svc.gw; assert.deepEqual(sim.owners(g, sim.domain(sim.homeNode("sd1"))).sort(), ["dist1", "edge"], s + " the gateways on distribution switch 1 while router-on-a-stick still runs: two devices answer for each");
    ({ sim, p } = moved(s, ["link"]));
    assert.ok(!online(sim, "sd1"), s + " no routed link: nothing reaches the edge router");
  }
});

test("NAT still decides: the edge router's link to the campus not nat inside, nothing gets out", () => {
  for (const s of seeds.slice(0, 3)) {
    const { sim, p } = moved(s); conf(sim, "edge", ["interface " + p.edge.lan, "no ip nat inside", "exit"]);
    const r = sim.route("sd1", "8.8.8.8"); assert.equal(r.fail, "no-nat", s + " " + JSON.stringify(r));
  }
});

test("a loop between them (a network nobody has, sent back and forth) stops for the loop, it doesn't run for ever", () => {
  for (const s of seeds.slice(0, 3)) {
    const { sim, p } = moved(s), r = sim.route("sd1", "10." + b(p) + ".200.9");
    assert.equal(r.fail, "no-reply", s + " " + JSON.stringify(r)); assert.equal(r.why, "loop");
  }
});

test("helper-address: in the running configuration, saved, taken away again; refused on a switch port", () => {
  const { sim, p } = moved(seeds[0]);
  const run = C.configText(sim.d.dist1.sw); assert.ok(run.indexOf(" ip helper-address " + T(p).edge) > 0, run);
  const o = conf(sim, "dist1", ["interface gi0/5", "ip helper-address 10.0.0.1"]); assert.ok(o.some((l) => /a helper address goes on a routed port or a VLAN interface/.test(l)), o.join("\n"));
  conf(sim, "dist1", ["interface vlan " + p.vlans.svc.id, "no ip helper-address " + T(p).edge]);
  assert.equal(renew(sim, "sd1").result, "timeout"); assert.equal(renew(sim, "bn1").result, "lease", "the other VLANs still relayed");
});

test("a check never changes the network: routes and the relays worked out leave it as it was", () => {
  const { sim } = moved(seeds[1]); const before = JSON.stringify(sim.net);
  for (const id of PCS) { sim.route(id, "8.8.8.8"); sim.dhcpServers(id); }
  sim.route("edge", sim.addr("sd1").ip);
  assert.equal(JSON.stringify(sim.net), before);
});
