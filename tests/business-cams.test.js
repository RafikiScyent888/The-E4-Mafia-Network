/* Level 3, SB-J5's simulation: the dome cameras on their own VLAN, their fixed addresses set on their own pages, kept apart by an
   access list, and reached from outside through the router's port forwards (static NAT), on the manager's phone on mobile data.
   Each business is SB-J4 done, then built through the real command lines and actions; each break is one thing left out or wrong. */
import test from "node:test";
import assert from "node:assert/strict";
import { BUSINESS_JOBS } from "../js/build/business.js";
import { addCameraKit } from "../js/net/business.js";
import * as B from "../js/build/engine.js";
import { exec } from "../js/net/cmd.js";
import { browse, page } from "../js/net/pages.js";

const N = Math.min(40, Number(process.env.SEEDS || 40));
const seeds = Array.from({ length: N }, (_, i) => 5100 + i * 7919);
const E = (dev, port) => ({ dev, port });
/* o: what to leave out or change (noacl, nonat, nooutside, dhcp, noallow, nopool, nogw, ext: [p1, p2], acl: lines, listens) */
function build(seed, o = {}) {
  const J = B.open(BUSINESS_JOBS[3], seed); for (const a of BUSINESS_JOBS[3].solve(J.v, J.sim)) B.act(J, a);
  const sim = J.sim, p = J.v.plan, C = p.vlans.cameras, T = p.trunk, net3 = C.net.replace(/\.0$/, "."), w = "0.0.0.255";
  addCameraKit(sim); sim.cli = {};
  const ap = (x) => { const r = sim.apply(x); assert.notEqual(r && r.ok, false, "refused: " + JSON.stringify(x) + " " + JSON.stringify(r)); return r; };
  const cli = (lines) => lines.forEach((l) => exec(sim, "tech", l));
  const con = () => sim.cablesOf("tech").find((c) => c.kind === "console");
  ap({ t: "place", dev: "cinj1", room: "closet" }); ap({ t: "place", dev: "cam1", room: "guest" });
  ap({ t: "lay", a: E("msw", p.cams[0].port), b: E("cinj1", "DATA IN") }); ap({ t: "lay", a: E("cinj1", "PoE OUT"), b: E("cam1", "LAN") });
  ap({ t: "place", dev: "cinj2", room: "back" }); ap({ t: "place", dev: "cam2", room: "back" });
  ap({ t: "lay", a: E("bsw", p.cams[1].port), b: E("cinj2", "DATA IN") }); ap({ t: "lay", a: E("cinj2", "PoE OUT"), b: E("cam2", "LAN") });
  const sw = (k, trunkPort) => ["", p.swConsole, "enable", p.swSecret, "configure terminal", "vlan " + C.id, "name " + C.name, "exit",
    "interface gi0/" + p.cams[k].port, "description " + p.cams[k].desc, "switchport mode access", "switchport access vlan " + C.id, "no shutdown", "exit"].concat(
    o.noallow ? [] : ["interface gi0/" + trunkPort, "switchport trunk allowed vlan add " + C.id], ["end", "copy running-config startup-config", ""]);
  cli(sw(0, T.closet));
  ap({ t: "pull", cable: con().id }); ap({ t: "place", dev: "tech", room: "back" }); ap({ t: "lay", a: E("tech", "USB-C"), b: E("bsw", "CONSOLE") });
  cli(sw(1, T.back));
  ap({ t: "pull", cable: con().id }); ap({ t: "place", dev: "tech", room: "closet" }); ap({ t: "lay", a: E("tech", "USB-C"), b: E("rtr", "CONSOLE") });
  const sub = p.lanPort + "." + C.id;
  cli(["", p.rtConsole, "enable", p.rtSecret, "configure terminal", "interface " + sub, "encapsulation dot1Q " + C.id, "ip address " + C.gw + " " + p.vmask].concat(o.nonat ? [] : ["ip nat inside"], ["exit"],
    o.nopool ? [] : ["ip dhcp excluded-address " + C.gw + " " + net3 + p.camExcl, "ip dhcp pool " + C.name, "network " + C.net + " " + p.vmask].concat(o.nogw ? [] : ["default-router " + C.gw], ["exit"]), ["end"]));
  if (!o.dhcp) p.cams.forEach((c) => ap({ t: "client", dev: c.id, values: { mode: "static", ip: net3 + c.host, mask: p.vmask, gw: o.camGw || C.gw } }));
  const ext = o.ext || p.cams.map((c) => c.ext);
  cli(["configure terminal"].concat(o.noacl ? [] : ["interface " + sub, "ip access-group " + p.camAcl + " in", "exit", "ip access-list extended " + p.camAcl].concat(o.acl || ["permit tcp " + C.net + " " + w + " eq 443 any"], ["exit"]),
    p.cams.map((c, k) => "ip nat inside source static tcp " + net3 + c.host + " 443 interface " + p.wanPort + " " + ext[k]),
    o.nooutside ? ["interface " + p.wanPort, "no ip nat outside", "exit"] : [], o.wanAcl ? ["ip access-list extended OUTSIDE-IN", "deny tcp any any eq " + p.cams[0].ext, "permit ip any any", "exit", "interface " + p.wanPort, "ip access-group OUTSIDE-IN in", "exit"] : [], ["end"]));
  if (o.listens) p.cams.forEach((c) => { sim.d[c.id].listens = o.listens; });
  return { sim, p, C, net3, J };
}
const wan = (sim) => sim.net.isp.wanIp;

test("the cameras: powered over their cables by the injectors, a lease on the cameras' VLAN with its gateway, then their fixed addresses", () => {
  for (const s of seeds) {
    const { sim, p, C, net3 } = build(s, { dhcp: true });
    for (const c of p.cams) {
      assert.ok(sim.on(c.id), c.id + " powered");
      const a = sim.addr(c.id); assert.equal(a.kind, "dhcp", c.id + " " + JSON.stringify(a));
      assert.ok(a.ip.startsWith(net3) && +a.ip.split(".")[3] > p.camExcl, c.id + " leased from the pool, above the excluded " + JSON.stringify(a));
      assert.equal(a.gw, C.gw, "the lease carries the default router: the camera didn't catch the pool half typed");
    }
    const b = build(s);
    p.cams.forEach((c) => assert.deepEqual([b.sim.addr(c.id).ip, b.sim.addr(c.id).kind], [net3 + c.host, "static"]));
  }
});

test("a camera on 169.254 asks again once its pool exists, not while the pool is still being typed", () => {
  for (const s of seeds.slice(0, 10)) {
    const { sim, p } = build(s, { nopool: true, dhcp: true, noacl: true });   /* the list would stop its request anyway: it lets out only replies from 443 */
    assert.equal(sim.addr("cam1").kind, "apipa", "no pool: it gave itself an address");
    const C = p.vlans.cameras;
    ["configure terminal", "ip dhcp pool " + C.name, "network " + C.net + " " + p.vmask].forEach((l) => exec(sim, "tech", l));
    assert.equal(sim.addr("cam1").kind, "apipa", "still typing the pool: no lease yet");
    ["default-router " + C.gw, "exit"].forEach((l) => exec(sim, "tech", l));
    assert.equal(sim.addr("cam1").kind, "dhcp"); assert.equal(sim.addr("cam1").gw, C.gw);
  }
});

test("from outside, each forward reaches its camera; every break fails for its own reason, and checking changes nothing", () => {
  for (const s of seeds) {
    let { sim, p } = build(s);
    const before = JSON.stringify(sim.net);
    p.cams.forEach((c) => { const r = sim.fromInternet(wan(sim), c.ext); assert.equal(r.ok, true, JSON.stringify(r)); assert.equal(r.who, c.id); assert.equal(r.lport, 443); });
    assert.equal(JSON.stringify(sim.net), before, "checking from outside changes nothing");
    assert.equal(sim.fromInternet(wan(sim), 9999).why, "no-forward", "no forward for that port: the router has nothing there");
    assert.equal(sim.fromInternet("203.0.113.200", 8443).why, "nobody", "someone else's address");
    const why = (o, k) => sim2(s, o).fromInternet(wan(sim), p.cams[k || 0].ext).why;
    const sim2 = (s2, o) => build(s2, o).sim;
    assert.equal(why({ nonat: true }), "inside", "the cameras' subinterface not set nat inside");
    assert.equal(why({ nooutside: true }), "outside", "the provider's side not set nat outside");
    assert.equal(why({ dhcp: true }), "arp", "left on DHCP: nobody at the forwarded address");
    assert.equal(why({ noallow: true }, 1), "arp", "the trunk between the switches never carries the cameras' VLAN: the back door camera is cut off");
    assert.equal(why({ noallow: true }, 0), undefined, "the closet's camera still works");
    assert.equal(why({ listens: [80] }), "port", "forwarded to a port the camera doesn't answer on");
    assert.equal(why({ camGw: p.vlans.cameras.net.replace(/\.0$/, ".254") }), "gateway", "the camera's gateway isn't the router: its reply never comes back");
    assert.equal(why({ acl: ["permit tcp " + p.vlans.cameras.net + " 0.0.0.255 any eq 443"] }), "reply", "the list permits to port 443, not from it: the camera's replies are dropped");
    assert.equal(why({ wanAcl: true }), "acl-in", "an access list in on the provider's side drops it");
  }
});

test("the access list keeps the cameras from starting anything; staff still open the cameras' pages", () => {
  for (const s of seeds) {
    const { sim, p, net3 } = build(s);
    for (const c of p.cams) {
      assert.equal(sim.route(c.id, sim.addr("mgr").ip, { proto: "tcp", port: 445, sport: 50000 }).fail, "blocked", c.id + " to the manager's PC");
      assert.ok(!sim.route(c.id, "8.8.8.8").internet, c.id + " to the internet");
      assert.ok(!sim.route(c.id, sim.addr("guest").ip).local, c.id + " to the visitor's phone");
      const pg = browse(sim, "mgr", "https://" + net3 + c.host);
      assert.equal(pg.status, "cam", "the manager's PC opens " + c.id + "'s page"); assert.equal(pg.net.mode, "static");
    }
    const open = build(s, { noacl: true }).sim;
    assert.ok(!open.route("cam1", open.addr("mgr").ip, { proto: "tcp", port: 445, sport: 50000 }).fail, "no list: a camera reaches the staff PCs");
    assert.ok(sim.route("pc", "8.8.8.8").internet && sim.route("bpc", "8.8.8.8").internet && sim.route("guest", "8.8.8.8").internet, "everyone else still online");
  }
});

test("the manager's phone: on mobile data it reaches the forwards and nothing private; on the guest Wi-Fi the business's own address refuses", () => {
  for (const s of seeds.slice(0, 15)) {
    const { sim, p, net3 } = build(s);
    assert.equal(page(sim, "mphone", "wifi").rows[0][1], "Off", "its Wi-Fi starts off");
    p.cams.forEach((c) => { const r = browse(sim, "mphone", "https://" + wan(sim) + ":" + c.ext); assert.equal(r.status, "cam"); assert.equal(r.dev, c.id); assert.equal(r.remote, true); });
    assert.equal(browse(sim, "mphone", "https://" + net3 + "11").status, "timeout", "a private address means nothing on the internet");
    assert.equal(browse(sim, "mphone", "https://" + wan(sim) + ":9999").status, "refused");
    sim.apply({ t: "radio", dev: "mphone", on: true }); sim.apply({ t: "joinssid", dev: "mphone", ssid: p.guestSsid, pass: p.guestPw });
    assert.ok(sim.wifiLink("mphone").connected);
    assert.equal(browse(sim, "mphone", "https://" + wan(sim) + ":8443").status, "refused", "from inside, the router doesn't loop back to its own forwards: test from outside");
    sim.apply({ t: "radio", dev: "mphone", on: false });
    assert.equal(browse(sim, "mphone", "https://" + wan(sim) + ":8443").status, "cam", "Wi-Fi off again: mobile data");
  }
});

test("the cameras' list applied before their addresses are fixed: their DHCP request is dropped (the trap the guests' list set in SB-J3)", () => {
  for (const s of seeds.slice(0, 10)) {
    const { sim } = build(s, { nopool: true, dhcp: true });
    const p = sim.net.plan, C = p.vlans.cameras;
    ["configure terminal", "ip dhcp pool " + C.name, "network " + C.net + " " + p.vmask, "default-router " + C.gw, "exit", "end"].forEach((l) => exec(sim, "tech", l));
    assert.equal(sim.addr("cam1").kind, "apipa", "the pool is there, but the list in on the cameras' subinterface drops the DISCOVER");
  }
});

test("show ip nat translations lists the static forwards before any traffic", () => {
  const { sim, p, net3 } = build(seeds[0]);
  const out = String(exec(sim, "tech", "show ip nat translations").out);
  p.cams.forEach((c) => assert.match(out, new RegExp("tcp\\s+" + wan(sim).replace(/\./g, "\\.") + ":" + c.ext + "\\s+" + (net3 + c.host).replace(/\./g, "\\.") + ":443\\s+---\\s+---")));
});
