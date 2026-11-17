/* OSPF in one area (Level 4, the campus; the owner, 15 November 2026: "Go with your recommendations": a single area here,
   several at Enterprise). Pure: given each router's OSPF interfaces and which of them share a segment, it works out what the
   real protocol settles on:
   - neighbours: two routers' interfaces on one segment, both in OSPF, neither passive, in the same area, on the same subnet
     with the same mask; a different MTU leaves them stuck in EXSTART (the classic one), the same router ID makes none;
   - on each segment the designated router (highest priority, then highest router ID) and the backup; two routers that are
     neither stop at 2WAY with each other, and are FULL with the DR and BDR;
   - each router's routes: the lowest-cost path to every network another router has in OSPF (the cost of each interface on the
     way out, then that router's own interface into the network); a default route originated by a router that has one, as an
     external type 2 (its metric doesn't grow along the way).
   Nothing here knows the simulation or the command line. */
const n4 = function (s) { return s.split(".").reduce(function (a, p) { return a * 256 + +p; }, 0); };
const s4 = function (n) { return [24, 16, 8, 0].map(function (b) { return Math.floor(n / Math.pow(2, b)) % 256; }).join("."); };
/* a network statement's match: the wildcard's 1 bits don't care */
export function wildMatch(ip, net, wild) { const a = n4(ip), b = n4(net), w = n4(wild); for (let i = 31; i >= 0; i--) { const m = Math.pow(2, i), wb = Math.floor(w / m) % 2; if (!wb && Math.floor(a / m) % 2 !== Math.floor(b / m) % 2) return false; } return true; }
export const netOf = function (ip, mask) { const b = mask.split(".").map(function (p) { return (+p).toString(2); }).join("").replace(/0/g, "").length; return s4(n4(ip) - n4(ip) % Math.pow(2, 32 - b)); };
/* an interface's cost: the reference bandwidth (100 Mb/s by default) over its own, never under 1. A gigabit and a 10 gigabit
   link both cost 1 until the reference is raised: the classic reason to set auto-cost reference-bandwidth */
export function ifCost(mbps, ref) { return Math.max(1, Math.floor((ref || 100) / (mbps || 1000))); }
const ridCmp = function (a, b) { return n4(a) - n4(b); };

/* routers: { id: { rid, ifs: [{ name, ip, mask, area, cost, passive, mtu, pri, seg }], originate: bool (default-information
   originate with a default route of its own) } }. Returns { nbrs: { id: [{ rid, ip, iface, pri, state }] }, roles: { "id name":
   "DR"|"BDR"|"DROTHER" }, routes: { id: [{ code, net, mask, nh, iface, metric }] }, dupRid: [ids] } */
export function solve(routers) {
  const ids = Object.keys(routers), out = { nbrs: {}, roles: {}, routes: {}, dupRid: [] };
  ids.forEach(function (id) { out.nbrs[id] = []; out.routes[id] = []; });
  const rids = {}; ids.forEach(function (id) { const r = routers[id].rid; (rids[r] = rids[r] || []).push(id); });
  Object.keys(rids).forEach(function (r) { if (rids[r].length > 1) out.dupRid = out.dupRid.concat(rids[r]); });
  /* who can hear whom on each segment (hellos agree), and whether their databases can be exchanged (MTU) */
  const segs = {};
  ids.forEach(function (id) { routers[id].ifs.forEach(function (f) { if (f.passive || !f.seg) return; (segs[f.seg] = segs[f.seg] || []).push({ id: id, f: f }); }); });
  const hears = function (a, b) { return a.id !== b.id && a.f.area === b.f.area && a.f.mask === b.f.mask && netOf(a.f.ip, a.f.mask) === netOf(b.f.ip, b.f.mask) && routers[a.id].rid !== routers[b.id].rid; };
  const adjOk = {};   /* "a|b|seg": FULL possible between them on this segment */
  Object.keys(segs).forEach(function (sg) {
    const M = segs[sg];
    /* the segment's members that hear one another: the DR and BDR among them (priority 0 never stands) */
    const live = M.filter(function (m) { return M.some(function (o) { return hears(m, o); }); });
    const cand = live.filter(function (m) { return (m.f.pri == null ? 1 : m.f.pri) > 0; }).sort(function (a, b) { return (b.f.pri == null ? 1 : b.f.pri) - (a.f.pri == null ? 1 : a.f.pri) || ridCmp(routers[b.id].rid, routers[a.id].rid); });
    const dr = cand[0] || null, bdr = cand[1] || null;
    live.forEach(function (m) { out.roles[m.id + " " + m.f.name] = dr && m.id === dr.id ? "DR" : bdr && m.id === bdr.id ? "BDR" : "DROTHER"; });
    live.forEach(function (m) {
      M.forEach(function (o) {
        if (!hears(m, o)) return;
        const roleO = out.roles[o.id + " " + o.f.name], roleM = out.roles[m.id + " " + m.f.name];
        const pair = roleO === "DROTHER" && roleM === "DROTHER" ? "2WAY" : (m.f.mtu || 1500) !== (o.f.mtu || 1500) ? "EXSTART" : "FULL";
        out.nbrs[m.id].push({ rid: routers[o.id].rid, ip: o.f.ip, iface: m.f.name, pri: o.f.pri == null ? 1 : o.f.pri, state: pair + "/" + (roleO === "DROTHER" ? "DROTHER" : roleO) });
        if (pair === "FULL") adjOk[m.id + "|" + o.id + "|" + sg] = true;
      });
    });
  });
  /* the graph SPF runs on: A reaches B across a segment if they're FULL, or both FULL with the same DR there (2WAY neighbours) */
  const link = function (a, b, sg) {
    if (adjOk[a + "|" + b + "|" + sg] && adjOk[b + "|" + a + "|" + sg]) return true;
    const D = (segs[sg] || []).find(function (m) { return out.roles[m.id + " " + m.f.name] === "DR"; });
    return !!D && D.id !== a && D.id !== b && adjOk[a + "|" + D.id + "|" + sg] && adjOk[D.id + "|" + a + "|" + sg] && adjOk[b + "|" + D.id + "|" + sg] && adjOk[D.id + "|" + b + "|" + sg] && (segs[sg] || []).some(function (m) { return m.id === b; });
  };
  ids.forEach(function (src) {
    const dist = {}, first = {}, done = {}; dist[src] = 0;
    for (;;) {
      let u = null; Object.keys(dist).forEach(function (k) { if (!done[k] && (u === null || dist[k] < dist[u])) u = k; }); if (u === null) break; done[u] = true;
      routers[u].ifs.forEach(function (f) {
        if (f.passive || !f.seg) return;
        (segs[f.seg] || []).forEach(function (o) {
          if (o.id === u || !link(u, o.id, f.seg) || !hears({ id: u, f: f }, o)) return;
          const d = dist[u] + (f.cost || 1);
          if (dist[o.id] === undefined || d < dist[o.id] || (d === dist[o.id] && u === src && ridCmp(o.f.ip, first[o.id].nh) < 0)) { dist[o.id] = d; first[o.id] = u === src ? { nh: o.f.ip, iface: f.name } : first[u]; }
        });
      });
    }
    const mine = routers[src].ifs.map(function (f) { return netOf(f.ip, f.mask) + "/" + f.mask; }), best = {};
    Object.keys(dist).forEach(function (x) {
      if (x === src) return;
      routers[x].ifs.forEach(function (f) {
        const key = netOf(f.ip, f.mask) + "/" + f.mask; if (mine.indexOf(key) >= 0) return;
        const m = dist[x] + (f.cost || 1);
        if (!best[key] || m < best[key].metric) best[key] = { code: "O", net: netOf(f.ip, f.mask), mask: f.mask, nh: first[x].nh, iface: first[x].iface, metric: m };
      });
      if (routers[x].originate && !best["0.0.0.0/0.0.0.0"]) best["0.0.0.0/0.0.0.0"] = { code: "O", ext: "E2", net: "0.0.0.0", mask: "0.0.0.0", nh: first[x].nh, iface: first[x].iface, metric: 1 };
    });
    out.routes[src] = Object.keys(best).map(function (k) { return best[k]; });
  });
  return out;
}
