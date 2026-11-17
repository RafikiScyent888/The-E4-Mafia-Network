/* Layer 3 on a switch (Level 4, the campus; the owner, 15 November 2026: "Go with your recommendations, Rafiki's HQ").
   A switch that routes keeps a routing table as a router does: each of its own interfaces that's up with an address (its
   VLAN interfaces, and ports made routed with "no switchport") gives a connected network and a local address; static
   routes are added by hand; dynamic ones (OSPF, later) are learned. One route per network, the lowest administrative
   distance winning; a packet takes the longest match. Pure: nothing here knows the simulation or the command line. */

const n4 = function (s) { return s.split(".").reduce(function (a, p) { return a * 256 + +p; }, 0); };
const s4 = function (n) { return [24, 16, 8, 0].map(function (b) { return Math.floor(n / Math.pow(2, b)) % 256; }).join("."); };
export const bits = function (mask) { return mask.split(".").map(function (p) { return (+p).toString(2); }).join("").replace(/0/g, "").length; };
export const netOf = function (ip, mask) { return s4(n4(ip) - n4(ip) % Math.pow(2, 32 - bits(mask))); };
export const inNet = function (ip, net, mask) { return !!ip && netOf(ip, mask) === netOf(net, mask); };
/* the distance each kind of route is believed at, as the industry-standard command line has them */
export const DISTANCE = { C: 0, S: 1, O: 110 };
const isDefault = function (t) { return t.net === "0.0.0.0" && t.mask === "0.0.0.0"; };

/* the table. ifs: [{ name, ip, mask, up }] (only an interface that's up counts); statics: [{ net, mask, nh } or { net, mask,
   iface }] as typed; learned: [{ code, net, mask, nh, iface, ad, metric }] from a routing protocol, already worked out.
   A static route by next hop counts only while that next hop is on a connected network (the way out is up) */
export function routeTable(ifs, statics, learned) {
  const T = [], up = ifs.filter(function (f) { return f.up && f.ip && f.mask; });
  up.forEach(function (f) { T.push({ code: "C", net: netOf(f.ip, f.mask), mask: f.mask, iface: f.name, ad: 0 }, { code: "L", net: f.ip, mask: "255.255.255.255", iface: f.name, ad: 0 }); });
  const conn = function (ip) { return up.find(function (f) { return inNet(ip, f.ip, f.mask); }); };
  const cand = [];
  (statics || []).forEach(function (s) {
    if (s.iface) { const f = up.find(function (k) { return k.name === s.iface; }); if (f) cand.push({ code: "S", net: s.net, mask: s.mask, iface: s.iface, ad: s.ad || 1 }); return; }
    const f = conn(s.nh); if (f) cand.push({ code: "S", net: s.net, mask: s.mask, nh: s.nh, iface: f.name, ad: s.ad || 1 });
  });
  (learned || []).forEach(function (r) { cand.push(Object.assign({ ad: DISTANCE[r.code] || 110 }, r)); });
  /* one per network: a connected network can't be replaced; otherwise the lowest distance */
  cand.forEach(function (c) {
    if (T.some(function (t) { return t.code === "C" && t.net === c.net && t.mask === c.mask; })) return;
    const i = T.findIndex(function (t) { return t.code !== "L" && t.net === c.net && t.mask === c.mask; });
    if (i < 0) T.push(c); else if (c.ad < T[i].ad) T[i] = c;
  });
  return T;
}
/* the route a packet to dst takes: the longest match, never a local /32 (that's the switch's own address) */
export function longest(T, dst) {
  let best = null;
  T.forEach(function (t) { if (t.code === "L") return; if (inNet(dst, t.net, t.mask) && (!best || bits(t.mask) > bits(best.mask))) best = t; });
  return best;
}
/* show ip route, in the router's own format, with each route's distance and metric */
export function routeLines(T, routing, gateway) {
  const pad = function (s, n) { return (s + " ".repeat(n)).slice(0, n); };
  /* routing off, the switch is a host: its default gateway and nothing else, as the real thing says it */
  if (!routing) return ["Default gateway is " + (gateway || "not set"), "", pad("Host", 19) + pad("Gateway", 18) + pad("Last Use", 12) + pad("Total Uses", 12) + "Interface", "ICMP redirect cache is empty"];
  const gw = T.find(function (t) { return t.code !== "L" && isDefault(t); });
  const L = ["Codes: L - local, C - connected, S - static, O - OSPF, E2 - OSPF external type 2, * - candidate default", "",
    gw ? "Gateway of last resort is " + (gw.nh || "0.0.0.0") + " to network 0.0.0.0" : "Gateway of last resort is not set", ""];
  T.slice().sort(function (a, b) { return n4(a.net) - n4(b.net) || bits(a.mask) - bits(b.mask); }).forEach(function (t) {
    const len = "/" + bits(t.mask);
    if (t.code === "C" || t.code === "L") { L.push(t.code + "        " + t.net + len + " is directly connected, " + t.iface); return; }
    const code = t.code + (isDefault(t) ? "*" : "") + (t.ext || "");
    L.push(pad(code, 9) + t.net + len + " [" + t.ad + "/" + (t.metric || 0) + "] via " + (t.nh || t.iface) + (t.nh && t.iface ? ", " + t.iface : ""));
    (t.paths || []).slice(1).forEach(function (h) { L.push(" ".repeat(9 + (t.net + len).length + 1) + "[" + t.ad + "/" + (t.metric || 0) + "] via " + h.nh + ", " + h.iface); });   /* equal-cost paths, each its own line under the first */
  });
  return L;
}
