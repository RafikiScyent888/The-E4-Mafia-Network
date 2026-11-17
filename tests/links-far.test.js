/* A switch's own view of a link sees the far end's port: shut on another managed switch, or on a router, and the port here is
   down too (up/up before 17 November 2026, while the cable carried nothing). Every level with a switch joined to a switch or a
   router: the business's trunk to the back switch and its router, the campus's distribution pair and edge router. */
import test from "node:test";
import assert from "node:assert/strict";
import { makeCampus } from "../js/net/campus.js";
import { Sim } from "../js/net/sim.js";
import * as C from "../js/net/swcli.js";

const PCS = ["sd1", "hd1", "bn1", "bn2", "mgr", "fin"];
function conf(sim, id, lines) {
  const before = sim.links(); if (sim.d[id].kind === "mswitch") sim.syncSwitch(id);
  const S = C.session(sim.d[id].sw, sim.d[id].kind === "mswitch" ? { live: sim.swLive(id) } : { live: sim.rtLive(id) }); S.mode = "priv"; S.fresh = false; S.pending = null;
  ["configure terminal"].concat(lines, ["end"]).forEach((l) => C.exec(S, l)); if (sim.d[id].kind === "mswitch") sim.syncSwitch(id); sim.relink(before);
}
const show = (sim, id, line) => { sim.syncSwitch(id); const S = C.session(sim.d[id].sw, { live: sim.swLive(id) }); S.mode = "priv"; S.fresh = false; S.pending = null; return C.exec(S, line).out.join("\n"); };
const statusOf = (out, port) => (out.split("\n").find((l) => l.startsWith(port + " ")) || "");

test("the far switch's port shut: this end says notconnect, and comes back when it's opened", () => {
  for (const s of [3, 4, 5]) {
    const sim = new Sim(makeCampus(s)); sim.boot(PCS);
    assert.match(statusOf(show(sim, "dist1", "show interfaces status"), "Gi0/21"), /connected/, s + " up to start with");
    conf(sim, "dist2", ["interface gi0/21", "shutdown"]);
    const st = statusOf(show(sim, "dist1", "show interfaces status"), "Gi0/21"); assert.match(st, /notconnect/, s + " " + st);
    assert.match(show(sim, "dist1", "show interfaces gi0/21"), /is down, line protocol is down/, s);
    assert.match(statusOf(show(sim, "dist2", "show interfaces status"), "Gi0/21"), /disabled/, s + " the far end itself says disabled");
    conf(sim, "dist2", ["interface gi0/21", "no shutdown"]); assert.match(statusOf(show(sim, "dist1", "show interfaces status"), "Gi0/21"), /connected/, s + " opened again");
  }
});

test("the router's port shut: the switch's port to it goes down, and a routed port loses its connected network", () => {
  for (const s of [3, 4]) {
    const sim = new Sim(makeCampus(s)); sim.boot(PCS); const p = sim.net.plan;
    conf(sim, "edge", ["interface " + p.edge.lan, "shutdown"]);
    assert.match(statusOf(show(sim, "dist1", "show interfaces status"), "Gi0/24"), /notconnect/, s);
    conf(sim, "edge", ["interface " + p.edge.lan, "no shutdown"]); conf(sim, "dist1", ["ip routing", "interface gi0/24", "no switchport", "ip address 10.9.255.2 255.255.255.252"]);
    assert.ok(C.l3Ifs(sim.l3View("dist1")).find((f) => f.name === "GigabitEthernet0/24").up, s + " routed, up");
    conf(sim, "edge", ["interface " + p.edge.lan, "shutdown"]);
    assert.equal(C.l3Ifs(sim.l3View("dist1")).find((f) => f.name === "GigabitEthernet0/24").up, false, s + " the router's end shut: down");
    assert.ok(!/10\.9\.255\.0\/30/.test(show(sim, "dist1", "show ip route")), s + " no connected network for a link that's down");
  }
});

/* The links worked out once a pass (17 November 2026: a campus work order's reload replays every step) are kept only while nothing
   they read changes: a port shut part way through the pass (port security, BPDU guard) or a lease given or let go. */
test("within a pass: a port shut part way through (as BPDU guard shuts it) and the kept links are worked out again", () => {
  for (const s of [3, 4]) {
    const sim = new Sim(makeCampus(s)); sim.boot(PCS);
    sim.withEdges(function () {
      assert.ok(this.switchLinks("dist1")["GigabitEthernet0/21"], s + " switch 1 sees switch 2 to start with");
      const run = C.psRunOf(this.d.dist2.sw, "GigabitEthernet0/21"); run.err = true; run.why = "bpduguard"; this.edgesChanged();
      assert.equal(this.switchLinks("dist1")["GigabitEthernet0/21"], undefined, s + " switch 2's end shut: no link at switch 1's end, in the same pass");
    });
  }
});

test("within a pass: a lease let go or given and the kept links are worked out again (an access point advertises its address)", async () => {
  const { BUSINESS_JOBS } = await import("../js/build/business.js"), B = await import("../js/build/engine.js");
  const def = BUSINESS_JOBS.find((d) => d.id === "SB-J3");
  for (const s of [11, 2025]) {
    const J = B.open(def, s); for (const a of def.solve(J.v, J.sim)) B.act(J, a);
    const sim = J.sim, port = "GigabitEthernet0/" + J.v.plan.apPort, addr = () => { const l = sim.switchLinks("msw")[port]; return l && l.lldp ? l.lldp.addr : "none"; };
    const ip = sim.addr("ap").ip; assert.ok(ip, s + " the access point has its address");
    sim.withEdges(function () {
      assert.equal(addr(), ip, s + " advertised to start with");
      this.release("ap"); assert.equal(addr(), null, s + " let go: no address advertised, in the same pass");
      this.dhcp("ap", "renew"); assert.equal(addr(), sim.addr("ap").ip, s + " given again: advertised again, in the same pass");
    });
  }
});
