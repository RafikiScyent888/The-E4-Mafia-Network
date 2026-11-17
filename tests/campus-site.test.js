/* Level 4, the campus: Rafiki's HQ as the technician finds it, on many seeds. Every PC has its VLAN's address from the edge
   router; the VLANs reach each other through the edge router (router-on-a-stick); the internet through NAT; the printers on
   their fixed addresses; the 2F access switch is every VLAN's spanning-tree root (left at the defaults, the lowest address);
   the core switches are in their boxes; every switch is named, locked, SSH only, on the management VLAN, and saved. */
import test from "node:test";
import assert from "node:assert/strict";
import { makeCampus } from "../js/net/campus.js";
import { Sim } from "../js/net/sim.js";
import * as C from "../js/net/swcli.js";

const PCS = ["sd1", "hd1", "bn1", "bn2", "mgr", "fin"];
const seeds = Array.from({ length: 12 }, (_, i) => 3000 + i * 7919);
const built = (s) => { const net = makeCampus(s), sim = new Sim(net); sim.boot(PCS); return { net, sim, V: net.plan.vlans }; };
const show = (sim, id, line) => { sim.syncSwitch(id); const S = C.session(sim.d[id].sw, { live: sim.swLive(id) }); S.mode = "priv"; S.fresh = false; S.pending = null; return C.exec(S, line).out.join("\n"); };
const inNet = (ip, net) => ip.split(".").slice(0, 3).join(".") === net.split(".").slice(0, 3).join(".");

test("every PC has its own VLAN's address from the edge router, and reaches the internet", () => {
  for (const s of seeds) {
    const { sim, V } = built(s), want = { sd1: "svc", hd1: "svc", bn1: "bench", bn2: "bench", mgr: "office", fin: "office" };
    for (const id of PCS) { const a = sim.addr(id); assert.ok(a && a.kind === "dhcp" && inNet(a.ip, V[want[id]].net), s + " " + id + " " + JSON.stringify(a)); assert.equal(a.gw, V[want[id]].gw); assert.equal(sim.route(id, "8.8.8.8").internet, true, s + " " + id); }
  }
});

test("the VLANs reach each other through the edge router, one hop (router-on-a-stick), and the printers on their fixed addresses", () => {
  for (const s of seeds) {
    const { sim, net } = built(s);
    const r = sim.route("sd1", sim.addr("mgr").ip); assert.equal(r.routed, true, s + JSON.stringify(r)); assert.equal(r.via, "edge");
    for (const p of ["pr1", "pr3"]) { const q = sim.route("bn1", net.plan.printers[p]); assert.equal(q.routed, true, s + " " + p); assert.deepEqual(q.owner, [p]); }
  }
});

test("the 2F access switch is every VLAN's spanning-tree root; one link between the distribution switches blocks", () => {
  for (const s of seeds.slice(0, 4)) {
    const { sim, V } = built(s);
    for (const k of ["svc", "bench", "office", "mgmt"]) assert.match(show(sim, "acc2", "show spanning-tree vlan " + V[k].id), /This bridge is the root/, s + " " + k);
    assert.match(show(sim, "dist2", "show spanning-tree vlan " + V.svc.id), /Altn BLK/, "something blocks: two links between the distribution switches and a dual-homed floor");
  }
});

test("the core switches are in their boxes; the distribution switches are layer 3 with routing off; every switch named, locked, SSH only, saved", () => {
  for (const s of seeds.slice(0, 4)) {
    const { sim, net } = built(s);
    assert.equal(sim.d.core1.boxed, true); assert.equal(sim.d.core2.boxed, true);
    for (const id of ["dist1", "dist2"]) { assert.equal(sim.d[id].sw.os, "l3switch"); assert.equal(sim.d[id].sw.routing, false); }
    for (const id of ["dist1", "dist2", "acc1", "acc2", "acc3"]) {
      const sw = sim.d[id].sw; assert.equal(sw.hostname, net.plan.sw[id].host); assert.ok(sw.enableSecret); assert.equal(sw.vty.transport, "ssh"); assert.ok(!C.unsaved(sw), id + " saved");
      assert.ok(sim.route("sd1", net.plan.sw[id].ip).routed, s + " " + id + " reachable on the management VLAN");
    }
  }
});

test("every address the plan gives is a real one (a VLAN's number is its subnet's third octet, so none over 254)", () => {
  const ok = (ip) => /^\d+\.\d+\.\d+\.\d+$/.test(ip) && ip.split(".").every((o) => +o <= 255);
  for (let s = 1; s < 400; s += 7) { const p = makeCampus(s).plan; Object.values(p.vlans).forEach((v) => { if (v.net) { assert.ok(ok(v.net) && ok(v.gw), s + " " + v.name + " " + v.net); } }); Object.values(p.sw).forEach((w) => { if (w.ip) assert.ok(ok(w.ip), s + " " + w.ip); }); Object.values(p.printers).forEach((x) => assert.ok(ok(x), s + " " + x)); }
});

test("the seed decides the addresses, the VLAN numbers and the passwords; the same seed builds the same campus", () => {
  const a = makeCampus(1), b = makeCampus(1); assert.equal(JSON.stringify(a), JSON.stringify(b));
  const V = new Set(seeds.map((s) => makeCampus(s).plan.vlans.svc.id)), P = new Set(seeds.map((s) => makeCampus(s).plan.secret));
  assert.ok(V.size > 1 && P.size > 1);
});
