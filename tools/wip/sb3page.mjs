/* SB-J3's new page parts, in Node: the business PCs' browser reaching the access point (or not, for the real reason), the
   visitor's phone at the business, the access point's Physical tab. node tools/wip/sb3page.mjs [seed] */
import { BUSINESS_JOBS } from "../../js/build/business.js";
import * as B from "../../js/build/engine.js";
import { tabsFor, page, browse } from "../../js/net/pages.js";
import { physicalState } from "../../js/net/physical.js";
const seed = +(process.argv[2] || 11), def = BUSINESS_JOBS[2];
const show = (what, x) => console.log(what.padEnd(34), typeof x === "string" ? x : JSON.stringify(x).slice(0, 220));
let J = B.open(def, seed);
const p = J.v.plan;
show("mgr tabs", tabsFor(J.sim, "mgr").map((t) => t.key).join(","));
show("ap tabs (boxed)", tabsFor(J.sim, "ap").map((t) => t.key).join(","));
show("browser blank", browse(J.sim, "mgr", "").status);
show("a name", browse(J.sim, "mgr", "ap.local").code);
show("the router's inside address", [browse(J.sim, "mgr", p.lanGw).status, browse(J.sim, "mgr", p.lanGw).code]);
show("the switch", browse(J.sim, "mgr", p.swIp).code);
show("another PC", browse(J.sim, "mgr", J.sim.addr("pc").ip).code);
show("visitor's phone, start", page(J.sim, "guest", "wifi").rows);
show("ap physical (boxed)", physicalState(J.sim, "ap") && physicalState(J.sim, "ap").says);
/* the solution, step by step: the access point's page appears once it has an address and a way to it */
J = B.open(def, seed);
let seen = null;
for (const a of def.solve(J.v, J.sim)) {
  B.act(J, a);
  const ad = J.sim.addr("ap");
  if (ad && ad.kind !== "apipa" && !seen) { seen = ad.ip; show("ap's address appears (step " + a.t + ")", ad.ip); show("  browse to it from mgr", [browse(J.sim, "mgr", ad.ip).status, browse(J.sim, "mgr", ad.ip).code]); show("  physical", physicalState(J.sim, "ap").says[0]); }
}
const apIp = J.sim.addr("ap").ip, P = browse(J.sim, "mgr", apIp);
show("solved: browse mgr -> ap", [P.status, P.title, P.shown]);
show("  rows", P.rows);
show("  networks", P.networks);
show("  http:// too", browse(J.sim, "mgr", "http://" + apIp).status);
show("  port 22", browse(J.sim, "mgr", apIp + ":22").code);
show("  from the visitor's phone? (not a PC)", tabsFor(J.sim, "guest").map((t) => t.key).join(","));
show("check", B.check(J).res.map((r) => r.id + "=" + (r.ok ? "ok" : "no")).join(" "));
show("visitor's phone, solved", page(J.sim, "guest", "wifi").rows);
show("  heard", page(J.sim, "guest", "wifi").heard);
show("ap physical, solved", physicalState(J.sim, "ap").says);
show("ap leds", physicalState(J.sim, "ap").leds);
/* a wrong password typed on the phone, then the right one */
const r1 = B.act(J, { t: "joinssid", dev: "guest", ssid: p.guestSsid, pass: "not-the-one" });
show("wrong password", [r1.facts.ap, page(J.sim, "guest", "wifi").facts.reason, page(J.sim, "guest", "wifi").rows[0][1]]);
const r2 = B.act(J, { t: "joinssid", dev: "guest", ssid: p.guestSsid, pass: p.guestPw });
show("right password", [r2.facts.ap, r2.facts.ip, r2.facts.internet]);
/* the access point's page through the browser: a network removed, then added back (the same act the form sends) */
B.act(J, { t: "apnet", dev: "ap", remove: p.guestSsid });
show("removed: ring", physicalState(J.sim, "ap").says[0]);
show("removed: page networks", browse(J.sim, "mgr", apIp).networks);
const r3 = B.act(J, { t: "apnet", dev: "ap", net: { ssid: p.guestSsid, sec: "WPA2/WPA3-Personal", psk: p.guestPw, vlan: String(p.vlans.guest.id) } });
show("added back", r3.result);
/* the access point unplugged from its injector: no power, and no page */
const c = J.sim.cableAt("ap", "ETH"); c[c.a.dev === "ap" ? "a" : "b"].seated = false;
show("unplugged: browse", browse(J.sim, "mgr", apIp).code);
show("unplugged: physical", physicalState(J.sim, "ap").says.slice(0, 2));
